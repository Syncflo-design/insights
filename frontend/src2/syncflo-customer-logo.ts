// Customer logo swap for Insights — reads Nest Theme Settings.customer_logo
// from the host site and replaces the default Insights logo wherever it
// appears. Falls back silently to the default Insights logo if the field
// is empty, the doctype is missing, or the API call fails.
//
// Phase 2 of the customer-branding work (Phase 1 was hardcoded CSS).
// Set Nest Theme Settings.customer_logo on each customer site to point at
// the customer's logo URL — same one fork serves every NestERP customer.

let cachedLogoUrl: string | null = null

async function loadCustomerLogo() {
  try {
    const response = await fetch(
      "/api/method/frappe.client.get_value" +
        "?doctype=Nest+Theme+Settings&fieldname=customer_logo",
      { credentials: "same-origin" }
    )
    if (!response.ok) return
    const data = await response.json()
    const logoUrl: string | undefined = data?.message?.customer_logo
    if (!logoUrl) return
    cachedLogoUrl = logoUrl
    applyLogo(logoUrl)
  } catch (e) {
    console.warn("[Syncflo] customer logo fetch failed:", e)
  }
}

function applyLogo(url: string) {
  swapLogoOnce(url)
  // Re-run on DOM mutations (Insights is an SPA — logo can be re-rendered
  // when routes change or sidebar toggles)
  const observer = new MutationObserver(() => swapLogoOnce(url))
  observer.observe(document.body, { childList: true, subtree: true })
}

function swapLogoOnce(url: string) {
  const selectors = [
    'img[src*="insights-logo"]',
    'img[src*="frappe-insights"]',
    'img[alt*="Insights" i]',
    'img[alt*="Frappe" i]',
    "header img:first-of-type",
    ".app-logo img",
  ]
  document
    .querySelectorAll<HTMLImageElement>(selectors.join(","))
    .forEach((img) => {
      if (img.dataset.syncfloLogoSwapped === "1") return
      img.src = url
      img.dataset.syncfloLogoSwapped = "1"
      img.style.maxHeight = "32px"
      img.style.width = "auto"
      img.style.objectFit = "contain"
      img.style.background = "#fff"
      img.style.padding = "2px 6px"
      img.style.borderRadius = "4px"
    })
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", loadCustomerLogo)
} else {
  loadCustomerLogo()
}

export {}
