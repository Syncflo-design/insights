/**
 * Syncflo Custom Theme — KPI tile drill-through (modal).
 *
 * Adds a click-through on configured Number-card tiles. On click, fetches
 * the underlying records via /api/method/frappe.client.get_list and shows
 * them in a centred modal with a header, scrollable table and a footer
 * link to the full ERPNext list.
 *
 * Identifies tiles by `[dashboard_id, 1-indexed nth-of-type position]` —
 * the same position pattern the syncflo-custom-overrides.css theme uses.
 * Insights doesn't expose the chart name on the rendered DOM, so position
 * is the most stable handle without a Vue-component edit.
 *
 * To add drill-through to another tile:
 *   1. Find the dashboard ID from its URL (`/insights/dashboards/<id>`).
 *   2. Find the 1-indexed array position of the chart in dashboard.items.
 *   3. Add an entry to DRILL_MAP[<dashboard_id>][<position>].
 *
 * No upstream Insights files are modified — this file is imported by
 * syncflo-custom-main.ts via the same pattern as the palette and overrides.
 */

type DrillFilter = [string, string, any]

type DrillConfig = {
	title: string
	doctype: string
	filters: DrillFilter[]
	fields: string[]
	order_by?: string
	limit?: number
	currency_columns?: string[]
	date_columns?: string[]
}

const DRILL_MAP: Record<string, Record<number, DrillConfig>> = {
	// ---- MD Overview (blomoplastics) ----
	'2uljes564g': {
		1: {
			title: 'Total Revenue — Sales Invoices',
			doctype: 'Sales Invoice',
			filters: [['docstatus', '=', 1]],
			fields: ['name', 'customer', 'posting_date', 'grand_total', 'status'],
			order_by: 'posting_date desc',
			limit: 200,
			currency_columns: ['grand_total'],
			date_columns: ['posting_date'],
		},
		2: {
			title: 'Outstanding Receivables — Detail',
			doctype: 'Sales Invoice',
			filters: [
				['docstatus', '=', 1],
				['outstanding_amount', '>', 0],
			],
			fields: [
				'name',
				'customer',
				'posting_date',
				'due_date',
				'grand_total',
				'outstanding_amount',
				'status',
			],
			order_by: 'due_date asc',
			limit: 200,
			currency_columns: ['grand_total', 'outstanding_amount'],
			date_columns: ['posting_date', 'due_date'],
		},
		3: {
			title: 'Open Orders — Sales Orders',
			doctype: 'Sales Order',
			filters: [
				['docstatus', '=', 1],
				['status', 'not in', ['Completed', 'Cancelled']],
			],
			fields: ['name', 'customer', 'transaction_date', 'grand_total', 'status'],
			order_by: 'transaction_date desc',
			limit: 200,
			currency_columns: ['grand_total'],
			date_columns: ['transaction_date'],
		},
		4: {
			title: 'Accounts Payable — Detail',
			doctype: 'Purchase Invoice',
			filters: [
				['docstatus', '=', 1],
				['outstanding_amount', '>', 0],
			],
			fields: [
				'name',
				'supplier',
				'posting_date',
				'due_date',
				'grand_total',
				'outstanding_amount',
				'status',
			],
			order_by: 'due_date asc',
			limit: 200,
			currency_columns: ['grand_total', 'outstanding_amount'],
			date_columns: ['posting_date', 'due_date'],
		},
	},
}

// ----------------------------- Plumbing -----------------------------

function getDashboardIdFromPath(): string | null {
	const m = window.location.pathname.match(/\/insights\/dashboards\/([^/?#]+)/)
	return m ? m[1] : null
}

function getDrillForTile(tile: Element): DrillConfig | null {
	const dashId = getDashboardIdFromPath()
	if (!dashId || !DRILL_MAP[dashId]) return null
	const parent = tile.parentElement
	if (!parent) return null
	const siblings = Array.from(parent.children).filter((c) =>
		c.classList.contains('vgl-item'),
	)
	const pos = siblings.indexOf(tile) + 1
	return DRILL_MAP[dashId][pos] || null
}

function tagEligibleTiles() {
	const dashId = getDashboardIdFromPath()
	if (!dashId || !DRILL_MAP[dashId]) return
	document.querySelectorAll('.vgl-layout .vgl-item').forEach((tile) => {
		const cfg = getDrillForTile(tile)
		if (!cfg) return
		const card = tile.querySelector(
			'[class*="rounded"][class*="bg-white"][class*="shadow"]',
		) as HTMLElement | null
		if (!card) return
		if (card.dataset.syncfloDrill === 'true') return
		card.dataset.syncfloDrill = 'true'
		card.style.cursor = 'pointer'
		card.title = 'Click to view detail records'
	})
}

// ----------------------------- Modal --------------------------------

const MODAL_ID = 'syncflo-drill-modal'

function closeModal() {
	const existing = document.getElementById(MODAL_ID)
	if (existing) existing.remove()
}

function fmtCurrency(n: any): string {
	const v = Number(n)
	if (!isFinite(v)) return ''
	return v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function fmtDate(s: any): string {
	if (!s) return ''
	const str = String(s).split(' ')[0] // strip time portion if any
	return str
}

function buildErpListUrl(cfg: DrillConfig): string {
	// Build /app/<doctype-kebab>?<filters>
	const slug = cfg.doctype.toLowerCase().replace(/\s+/g, '-')
	const params: string[] = []
	for (const [field, op, value] of cfg.filters) {
		if (op === '=') {
			params.push(`${encodeURIComponent(field)}=${encodeURIComponent(String(value))}`)
		} else {
			// ERPNext list-view URL filter format: ["op", value]
			const encoded = encodeURIComponent(JSON.stringify([op, value]))
			params.push(`${encodeURIComponent(field)}=${encoded}`)
		}
	}
	return `/app/${slug}?${params.join('&')}`
}

function humanizeFieldName(field: string): string {
	return field
		.split('_')
		.map((w) => w.charAt(0).toUpperCase() + w.slice(1))
		.join(' ')
}

async function fetchRows(cfg: DrillConfig): Promise<any[]> {
	const params = new URLSearchParams({
		doctype: cfg.doctype,
		fields: JSON.stringify(cfg.fields),
		filters: JSON.stringify(cfg.filters),
		order_by: cfg.order_by || '',
		limit_page_length: String(cfg.limit || 200),
	})
	const res = await fetch('/api/method/frappe.client.get_list?' + params.toString(), {
		credentials: 'include',
		headers: { 'X-Requested-With': 'XMLHttpRequest' },
	})
	if (!res.ok) throw new Error('Failed to load rows: ' + res.status)
	const json = await res.json()
	return Array.isArray(json.message) ? json.message : []
}

function renderModalShell(cfg: DrillConfig): HTMLElement {
	closeModal()
	const root = document.createElement('div')
	root.id = MODAL_ID
	root.className = 'syncflo-drill-modal'
	root.innerHTML = `
		<div class="syncflo-drill-backdrop"></div>
		<div class="syncflo-drill-card" role="dialog" aria-modal="true">
			<div class="syncflo-drill-header">
				<h3>${cfg.title}</h3>
				<button class="syncflo-drill-close" aria-label="Close">×</button>
			</div>
			<div class="syncflo-drill-body">
				<div class="syncflo-drill-loading">Loading…</div>
			</div>
			<div class="syncflo-drill-footer">
				<a class="syncflo-drill-erp-link" href="${buildErpListUrl(cfg)}" target="_blank" rel="noopener">
					View full list in ERPNext →
				</a>
			</div>
		</div>
	`
	root.querySelector('.syncflo-drill-backdrop')!.addEventListener('click', closeModal)
	root.querySelector('.syncflo-drill-close')!.addEventListener('click', closeModal)
	document.body.appendChild(root)
	return root
}

function renderRowsInto(root: HTMLElement, cfg: DrillConfig, rows: any[]) {
	const body = root.querySelector('.syncflo-drill-body')!
	if (!rows.length) {
		body.innerHTML = '<div class="syncflo-drill-empty">No matching records.</div>'
		return
	}
	const currencySet = new Set(cfg.currency_columns || [])
	const dateSet = new Set(cfg.date_columns || [])
	const headers = cfg.fields
		.map((f) => `<th>${humanizeFieldName(f)}</th>`)
		.join('')
	const rowHtml = rows
		.map((r) => {
			const cells = cfg.fields
				.map((f) => {
					const v = r[f]
					if (v === null || v === undefined) return '<td></td>'
					if (currencySet.has(f)) {
						return `<td class="syncflo-drill-num">${fmtCurrency(v)}</td>`
					}
					if (dateSet.has(f)) {
						return `<td>${fmtDate(v)}</td>`
					}
					if (f === 'name') {
						const slug = cfg.doctype.toLowerCase().replace(/\s+/g, '-')
						return `<td><a href="/app/${slug}/${encodeURIComponent(String(v))}" target="_blank" rel="noopener">${String(
							v,
						)}</a></td>`
					}
					return `<td>${String(v)}</td>`
				})
				.join('')
			return `<tr>${cells}</tr>`
		})
		.join('')
	body.innerHTML = `
		<div class="syncflo-drill-count">${rows.length} record${rows.length === 1 ? '' : 's'}</div>
		<table class="syncflo-drill-table">
			<thead><tr>${headers}</tr></thead>
			<tbody>${rowHtml}</tbody>
		</table>
	`
}

async function openModal(cfg: DrillConfig) {
	const root = renderModalShell(cfg)
	try {
		const rows = await fetchRows(cfg)
		renderRowsInto(root, cfg, rows)
	} catch (err) {
		const body = root.querySelector('.syncflo-drill-body')!
		body.innerHTML = `<div class="syncflo-drill-error">Could not load: ${(err as Error).message}</div>`
	}
}

// -------------------------- Wiring ----------------------------------

document.addEventListener(
	'click',
	(e) => {
		const target = e.target as Element | null
		if (!target) return
		const card = target.closest('[data-syncflo-drill="true"]') as HTMLElement | null
		if (!card) return
		const tile = card.closest('.vgl-item')
		if (!tile) return
		const cfg = getDrillForTile(tile)
		if (!cfg) return
		e.preventDefault()
		e.stopPropagation()
		openModal(cfg)
	},
	true, // capture phase — beats Vue's own click handlers
)

document.addEventListener('keydown', (e) => {
	if (e.key === 'Escape') closeModal()
})

const observer = new MutationObserver(() => {
	tagEligibleTiles()
})
observer.observe(document.body, { childList: true, subtree: true })

// Initial pass once DOM is ready
if (document.readyState === 'loading') {
	document.addEventListener('DOMContentLoaded', tagEligibleTiles)
} else {
	tagEligibleTiles()
}
