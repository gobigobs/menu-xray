/**
 * Verification script for the menu-xray analyser — run with:
 *   node --experimental-strip-types src/lib/analyzer.test.ts
 * (Node >= 22.6; no dependencies, no DOM, no network.)
 * Not part of the shipped app; asserts the demo flow end to end on the
 * built-in sample page.
 */
import { analyzePage } from './analyzer.ts'
import { answerQuestion } from './explainer.ts'
import { SAMPLE_BUNDLES, SAMPLE_HTML, SAMPLE_URL, sampleForUrl } from './sample.ts'
import { SWIGGY_SAMPLE_BUNDLES, SWIGGY_SAMPLE_HTML, SWIGGY_SAMPLE_URL } from './sampleSwiggy.ts'
import { reportFilename, toMarkdown } from './export.ts'
import { buildGroundingContext, findUnseenPaths } from './ollama.ts'

let failures = 0
function check(name: string, cond: boolean, detail = '') {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`)
  if (!cond) failures++
}

const result = analyzePage(SAMPLE_HTML, SAMPLE_BUNDLES, SAMPLE_URL, 'sample', null)

check('restaurant identified', result.restaurantName === 'Burger Barn', String(result.restaurantName))
check('endpoints found', result.stats.endpoints === 14, `${result.stats.endpoints} endpoints`)
check(
  'endpoint groups cover menu/search/cart/checkout/tracking/reviews/photos',
  ['menu', 'search', 'cart', 'checkout', 'tracking', 'reviews', 'photos'].every((g) =>
    result.endpoints.some((e) => e.group === g),
  ),
)
check(
  'menu endpoint is GET /api/v1/restaurants/{id}/menu',
  result.endpoints.some((e) => e.group === 'menu' && e.method === 'GET' && /\/menu$/.test(e.path)),
)
check(
  'GraphQL endpoint found with operation GetRestaurantMenu',
  result.endpoints.some((e) => e.method === 'GRAPHQL' && e.operationName === 'GetRestaurantMenu'),
)
check('checkout POST found', result.endpoints.some((e) => e.group === 'checkout' && e.method === 'POST'))
check('routes found', result.stats.routes === 9, `${result.stats.routes} routes`)
check('flow edges inferred', result.flowEdges.length >= 3, `${result.flowEdges.length} edges`)
check('menu items extracted', result.stats.menuItems === 11, `${result.stats.menuItems} items`)
check(
  'menu categories',
  result.categories.map((c) => c.name).join(',') === 'Smash Burgers,Sides & Shakes,Fried Chicken',
  result.categories.map((c) => `${c.name}(${c.itemCount})`).join(', '),
)
check(
  'menu price extracted',
  result.items.find((i) => i.name === 'Classic Smash Burger')?.price === 199,
)
check(
  'tech fingerprints',
  ['Next.js', 'React', 'GraphQL', 'Webpack', 'Google Maps'].every((t) => result.tech.some((x) => x.name === t)),
  result.tech.map((t) => t.name).join(', '),
)
check('evidence ledger non-empty', result.evidence.length >= 8, `${result.evidence.length} entries`)
check(
  'evidence has seen + unknown entries',
  result.evidence.some((e) => e.status === 'seen') && result.evidence.some((e) => e.status === 'unknown'),
)

const checkout = answerQuestion(result, 'How does checkout work here?')
check('explainer: checkout answered', checkout.status === 'answered', checkout.status)
check(
  'explainer: checkout cites seen evidence',
  checkout.evidence.length > 0 && checkout.evidence.every((e) => e.status === 'seen'),
)
check('explainer: checkout answer names the endpoints', /\/api\/v1\/orders/.test(checkout.answer) && /checkout/.test(checkout.answer))

const menuQ = answerQuestion(result, 'How does menu loading work here?')
check('explainer: menu answered', menuQ.status === 'answered', menuQ.status)

const priceQ = answerQuestion(result, 'What is the cheapest item?')
check('explainer: price answered with real numbers', priceQ.status === 'answered' && /₹99/.test(priceQ.answer), priceQ.answer.slice(0, 120))

const unknownQ = answerQuestion(result, 'How does the loyalty points wallet work?')
check('explainer: unanswerable question is unresolved, not invented', unknownQ.status === 'unresolved', unknownQ.status)
check('explainer: unresolved answer lists gaps', unknownQ.gaps.length > 0)

/* ------------------------------------------------------------------ */
/* Second sample: Swiggy-style page                                    */
/* ------------------------------------------------------------------ */

const swiggy = analyzePage(SWIGGY_SAMPLE_HTML, SWIGGY_SAMPLE_BUNDLES, SWIGGY_SAMPLE_URL, 'sample', null)

check('swiggy: restaurant identified', swiggy.restaurantName === 'Anbu Biryani House', String(swiggy.restaurantName))
check('swiggy: endpoints found', swiggy.stats.endpoints === 12, `${swiggy.stats.endpoints} endpoints`)
check(
  'swiggy: /dapi/ endpoints recognised',
  swiggy.endpoints.every((e) => e.path.startsWith('/dapi/')),
  swiggy.endpoints.map((e) => e.path).join(', '),
)
check(
  'swiggy: menu endpoint is GET /dapi/menu/pl',
  swiggy.endpoints.some((e) => e.group === 'menu' && e.method === 'GET' && e.path === '/dapi/menu/pl'),
)
check(
  'swiggy: groups cover menu/search/cart/checkout/tracking/reviews',
  ['menu', 'search', 'cart', 'checkout', 'tracking', 'reviews'].every((g) =>
    swiggy.endpoints.some((e) => e.group === g),
  ),
)
check('swiggy: checkout POST found', swiggy.endpoints.some((e) => e.group === 'checkout' && e.method === 'POST'))
check('swiggy: menu items extracted', swiggy.stats.menuItems === 10, `${swiggy.stats.menuItems} items`)
check(
  'swiggy: menu categories',
  swiggy.categories.map((c) => c.name).join(',') === 'Biryanis,Starters,Breads & Curries,Beverages',
  swiggy.categories.map((c) => `${c.name}(${c.itemCount})`).join(', '),
)
check(
  'swiggy: menu price extracted',
  swiggy.items.find((i) => i.name === 'Chicken Biryani')?.price === 220,
)
check(
  'swiggy: React + Webpack, no Next.js fingerprint',
  swiggy.tech.some((t) => t.name === 'React') &&
    swiggy.tech.some((t) => t.name === 'Webpack') &&
    !swiggy.tech.some((t) => t.name === 'Next.js'),
  swiggy.tech.map((t) => t.name).join(', '),
)
check('swiggy: routes found', swiggy.stats.routes === 7, `${swiggy.stats.routes} routes`)
check('swiggy: flow edges inferred', swiggy.flowEdges.length >= 3, `${swiggy.flowEdges.length} edges`)

const swiggyCheckout = answerQuestion(swiggy, 'How does checkout work here?')
check('swiggy explainer: checkout answered', swiggyCheckout.status === 'answered', swiggyCheckout.status)
check(
  'swiggy explainer: checkout names the dapi endpoint',
  /\/dapi\/order\/place/.test(swiggyCheckout.answer),
)

/* Sample picker: URL → the right built-in sample. */
check('sampleForUrl: swiggy URL picks swiggy sample', sampleForUrl(SWIGGY_SAMPLE_URL).id === 'swiggy')
check('sampleForUrl: zomato URL picks zomato sample', sampleForUrl(SAMPLE_URL).id === 'zomato')
check('sampleForUrl: unknown URL falls back to zomato sample', sampleForUrl('https://atticafe.in/menu').id === 'zomato')

/* ------------------------------------------------------------------ */
/* Export: Markdown report                                             */
/* ------------------------------------------------------------------ */

const md = toMarkdown(result)
check('export md: has restaurant title', md.startsWith('# menu-xray — Burger Barn'))
check('export md: lists a real endpoint', md.includes('GET /api/v1/restaurants/{param}/menu'))
check('export md: lists a real menu item + price', md.includes('Classic Smash Burger') && md.includes('₹199'))
check('export md: has API map, page flow, menu, evidence sections', ['## API map', '## Page flow', '## Menu data model', '## Evidence ledger'].every((h) => md.includes(h)))
check('export md: states the legal boundary', /public page and its public JS only/.test(md))
check(
  'export md: filename is slugged + dated',
  reportFilename(result, 'md') === `menu-xray-burger-barn-${result.scannedAt.slice(0, 10)}.md`,
  reportFilename(result, 'md'),
)

const swiggyMd = toMarkdown(swiggy)
check('export md (swiggy): lists dapi endpoint + biryani', swiggyMd.includes('/dapi/menu/pl') && swiggyMd.includes('Chicken Biryani'))

/* ------------------------------------------------------------------ */
/* Ollama grounding helpers (pure — no server needed)                  */
/* ------------------------------------------------------------------ */

const ctx = buildGroundingContext(result)
check(
  'ollama grounding: context lists only found endpoints',
  ctx.includes('/api/v1/restaurants/{param}/menu') && ctx.includes('Evidence ledger'),
)
check(
  'ollama grounding: invented path is flagged',
  findUnseenPaths('It calls GET /api/v1/orders and POST /api/v1/loyalty/redeem to finish.', result).join(',') ===
    '/api/v1/loyalty/redeem',
)
check(
  'ollama grounding: real paths pass the check',
  findUnseenPaths('Menu loads via GET /api/v1/restaurants/18472931/menu and checkout via POST /api/v1/checkout/initiate.', result)
    .length === 0,
)

console.log(failures === 0 ? '\nALL CHECKS PASSED' : `\n${failures} CHECK(S) FAILED`)
process.exit(failures === 0 ? 0 : 1)
