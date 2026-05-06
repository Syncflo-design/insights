/**
 * Syncflo Custom Theme — chart series palette override.
 *
 * Insights v3 stores its chart palette in src2/charts/colors.ts as a
 * mutable COLOR_MAP object. By importing this file from src2/main.ts
 * we mutate that object once at module-load time; every subsequent
 * call to getColors() (used by helpers.ts and Sparkline.vue) then
 * returns our muted palette.
 *
 * Why this approach:
 *   - We never edit src2/charts/colors.ts upstream → zero merge
 *     conflicts on Insights upgrades.
 *   - The companion CSS overrides for tile gradients live in
 *     src2/syncflo-custom-overrides.css.
 *
 * To retune: edit the hex values below and redeploy.
 * The raw-hex aliases in COLOR_MAP (e.g. '#449CF0': '#449CF0') are
 * left untouched — those are user-pickable colours, intentionally
 * varied and unlikely to surface as defaults.
 */

import { COLOR_MAP } from './charts/colors'

Object.assign(COLOR_MAP, {
	blue:   '#5e85a8',  // was #318AD8 — steel blue
	pink:   '#b07e7e',  // was #F683AE — dusty rose (was the offending hot pink)
	green:  '#7a9c7d',  // was #48BB74 — soft sage
	red:    '#a06868',  // was #F56B6B — muted brick
	yellow: '#c4a373',  // was #FACF7A — soft amber
	purple: '#8b7991',  // was #44427B — muted plum
	teal:   '#85a0a8',  // was #5FD8C4 — dusty teal
	orange: '#b08c75',  // was #F8814F — warm taupe
	cyan:   '#7a9eb0',  // was #15CCEF — soft slate
	grey:   '#9aa1a6',  // was #A6B1B9 — neutral grey
})
