/**
 * menu-xray analyser — passive, local, evidence-first.
 *
 * Input: a public page's HTML + the text of its public JS bundles.
 * Output: endpoints, routes, menu data model, tech fingerprints and an
 * evidence ledger. Everything here is string/regex analysis of text the
 * user already has — no network calls, no login, no calls to the target's
 * API. Runs identically in the browser and in Node (no DOM dependency),
 * so the same code is unit-testable.
 */
import type {
  AnalysisResult,
  Endpoint,
  Evidence,
  FeatureGroup,
  FlowEdge,
  JsBundle,
  MenuCategory,
  MenuItem,
  RouteNode,
  TechFingerprint,
} from './types'

/* ------------------------------------------------------------------ */
/* Small helpers                                                       */
/* ------------------------------------------------------------------ */

function stripTags(s: string): string {
  return s.replace(/<[^>]*>/g, ' ').replace(/&amp;/g, '&').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim()
}

function truncate(s: string, n = 120): string {
  const t = s.replace(/\s+/g, ' ').trim()
  return t.length > n ? `${t.slice(0, n - 1)}…` : t
}

let idCounter = 0
function nextId(prefix: string): string {
  idCounter += 1
  return `${prefix}-${idCounter}`
}

/** Normalise a discovered path: drop origin, trailing slash, fragments. */
function normalisePath(raw: string): string | null {
  let p = raw.trim()
  if (!p) return null
  // Drop scheme + host, keep the path.
  p = p.replace(/^https?:\/\/[^/]+/i, '')
  // Drop query/fragment for the canonical path, but keep them recorded separately.
  p = p.split('#')[0]
  if (p === '/') return p
  if (p.length < 2 || !p.startsWith('/')) return null
  // Skip static assets — they are not API endpoints.
  if (/\.(js|css|png|jpe?g|webp|svg|ico|woff2?|ttf|mp4|map|json)(\?|$)/i.test(p)) return null
  return p
}

function looksLikeApiPath(p: string): boolean {
  return (
    /\/api\//i.test(p) ||
    /\/dapi\//i.test(p) ||
    /\/graphql/i.test(p) ||
    /\/v\d+\//.test(p) ||
    /\/rest\//i.test(p) ||
    /\/rpc\//i.test(p)
  )
}

function classifyGroup(path: string, snippet: string): FeatureGroup {
  const hay = `${path} ${snippet}`.toLowerCase()
  if (/menu|dish|categor|food-item/.test(hay)) return 'menu'
  if (/search|suggest|autocomplete|filter/.test(hay)) return 'search'
  if (/cart|basket/.test(hay)) return 'cart'
  if (/checkout|payment|pay|razorpay|stripe/.test(hay)) return 'checkout'
  // Tracking before order: "/orders/{id}/tracking" is a tracking call,
  // not an order-placement call.
  if (/track|status|eta|delivery-status/.test(hay)) return 'tracking'
  if (/order|place-order|confirm/.test(hay)) return 'order'
  if (/review|rating/.test(hay)) return 'reviews'
  if (/photo|image|gallery/.test(hay)) return 'photos'
  if (/login|signup|auth|token|otp|session/.test(hay)) return 'auth'
  if (/upload|cdn|media|static/.test(hay)) return 'media'
  return 'other'
}

/* ------------------------------------------------------------------ */
/* Endpoint extraction                                                 */
/* ------------------------------------------------------------------ */

const FETCH_CALL =
  /(?:fetch|axios\.(?:get|post|put|patch|delete|request)|axios|jQuery\.ajax|\$\.ajax|\$\.get|\$\.post|XMLHttpRequest\.open)\s*\(\s*['"`]([^'"`]+)['"`]/g

const URL_LITERAL =
  /['"`](https?:\/\/[a-z0-9.-]+)?(\/(?:api|dapi|graphql|v\d+|rest|rpc)[^'"`\s<>]{1,160})['"`]/g

const URL_FIELD = /\b(?:url|endpoint|apiUrl|baseURL)\s*[:=]\s*['"`]([^'"`]+)['"`]/g

const GRAPHQL_OP = /(?:query|mutation)\s+([A-Za-z0-9_]+)/g

/**
 * Reconstruct a fetch/axios URL argument, including string concatenation
 * (`"/api/v1/restaurants/" + id + "/menu"`) and template literals
 * (`\`/api/v1/orders/${id}/tracking\``). Variables become `{param}` so
 * `/restaurants/18472931/menu` and `/restaurants/9/menu` dedupe to one
 * endpoint shape instead of one endpoint per id.
 */
function extractFetchArg(text: string, callIndex: number): string | null {
  const open = text.indexOf('(', callIndex)
  if (open === -1) return null
  let i = open + 1
  const parts: string[] = []
  let sawLiteral = false
  while (i < text.length) {
    const ch = text[i]
    if (ch === '"' || ch === "'" || ch === '`') {
      let j = i + 1
      let buf = ''
      while (j < text.length && text[j] !== ch) {
        if (text[j] === '$' && text[j + 1] === '{') {
          buf += '{param}'
          const close = text.indexOf('}', j)
          j = close === -1 ? text.length : close + 1
          continue
        }
        buf += text[j]
        j += 1
      }
      if (j >= text.length) return null
      parts.push(buf)
      sawLiteral = true
      i = j + 1
    } else if (/[A-Za-z0-9_$]/.test(ch)) {
      // A variable / expression between literals, e.g. the `e` in
      // "/api/v1/restaurants/" + e + "/menu".
      let j = i
      while (j < text.length && /[A-Za-z0-9_$.[\]]/.test(text[j])) j += 1
      parts.push('{param}')
      i = j
    } else if (ch === '+' || /\s/.test(ch)) {
      i += 1
      continue
    } else {
      break
    }
    // After a part, only a `+` continues the same URL argument.
    let k = i
    while (k < text.length && /\s/.test(text[k])) k += 1
    if (text[k] === '+') {
      i = k + 1
      continue
    }
    break
  }
  if (!sawLiteral) return null
  return parts.join('')
}

/**
 * Span of one fetch()/axios call — from the call keyword to its matching
 * closing paren, paren-depth aware and string aware. Method detection and
 * the evidence snippet use ONLY this span: the old 200-char window bled
 * into the next function and mislabelled methods (a GET next to a POST
 * looked like a POST) and groups (a details call looked like "reviews"
 * because the reviews function followed it).
 */
function fetchCallSpan(text: string, callIndex: number): [number, number] | null {
  const open = text.indexOf('(', callIndex)
  if (open === -1) return null
  let depth = 0
  let i = open
  let quote: string | null = null
  while (i < text.length) {
    const ch = text[i]
    if (quote) {
      if (ch === '\\') {
        i += 2
        continue
      }
      if (ch === quote) quote = null
      i += 1
      continue
    }
    if (ch === '"' || ch === "'" || ch === '`') {
      quote = ch
      i += 1
      continue
    }
    if (ch === '(') depth += 1
    else if (ch === ')') {
      depth -= 1
      if (depth === 0) return [callIndex, i + 1]
    }
    i += 1
  }
  return null
}

export function extractEndpoints(html: string, bundles: JsBundle[]): Endpoint[] {
  const seen = new Map<string, Endpoint>()
  const graphqlOps = new Map<string, string>() // operation name -> snippet

  const add = (method: Endpoint['method'], rawPath: string, sourceFile: string, snippet: string) => {
    const path = normalisePath(rawPath)
    if (!path || !looksLikeApiPath(path)) return
    const cleanPath = path.split('?')[0]
    const queryParams = path.includes('?')
      ? path
          .split('?')[1]
          .split('&')
          .map((kv) => kv.split('=')[0])
          .filter(Boolean)
      : undefined
    const key = `${method}:${cleanPath}`
    // An UNKNOWN-method sighting never creates a second row for a path we
    // already know the real method of — and a real method upgrades it.
    if (method === 'UNKNOWN') {
      if ([...seen.keys()].some((k) => k.endsWith(`:${cleanPath}`))) return
    } else {
      const unknownKey = `UNKNOWN:${cleanPath}`
      if (seen.has(unknownKey)) seen.delete(unknownKey)
    }
    if (seen.has(key)) return
    seen.set(key, {
      id: nextId('ep'),
      method,
      path: cleanPath,
      url: cleanPath,
      group: classifyGroup(cleanPath, snippet),
      sourceFile,
      snippet: truncate(snippet, 160),
      queryParams: queryParams && queryParams.length > 0 ? queryParams : undefined,
    })
  }

  const scanText = (text: string, sourceFile: string) => {
    let m: RegExpExecArray | null

    FETCH_CALL.lastIndex = 0
    while ((m = FETCH_CALL.exec(text)) !== null) {
      const arg = extractFetchArg(text, m.index)
      if (!arg) continue
      // The HTTP method lives in this call's own options object — never in
      // the code after it.
      const span = fetchCallSpan(text, m.index)
      const callText = span ? text.slice(span[0], span[1]) : text.slice(m.index, m.index + 200)
      const methodMatch = callText.match(/method\s*:\s*["'](POST|PUT|PATCH|DELETE|GET)["']/i)
      const method =
        /axios\.post|\$\.post/.test(m[0]) || methodMatch?.[1]?.toUpperCase() === 'POST'
          ? 'POST'
          : /axios\.put/.test(m[0]) || methodMatch?.[1]?.toUpperCase() === 'PUT'
            ? 'PUT'
            : /axios\.delete/.test(m[0]) || methodMatch?.[1]?.toUpperCase() === 'DELETE'
              ? 'DELETE'
              : /axios\.patch/.test(m[0]) || methodMatch?.[1]?.toUpperCase() === 'PATCH'
                ? 'PATCH'
                : 'GET'
      add(method, arg, sourceFile, callText)
    }

    URL_LITERAL.lastIndex = 0
    while ((m = URL_LITERAL.exec(text)) !== null) {
      // Skip fragments of a concatenated URL (".../restaurants/" + id + ...)
      // — the FETCH_CALL pass above already reconstructed the full path.
      if (text[m.index + m[0].length] === '+') continue
      add('UNKNOWN', m[2], sourceFile, text.slice(Math.max(0, m.index - 60), m.index + 120))
    }

    URL_FIELD.lastIndex = 0
    while ((m = URL_FIELD.exec(text)) !== null) {
      add('UNKNOWN', m[1], sourceFile, text.slice(m.index, m.index + 160))
    }

    GRAPHQL_OP.lastIndex = 0
    while ((m = GRAPHQL_OP.exec(text)) !== null) {
      if (!graphqlOps.has(m[1])) graphqlOps.set(m[1], truncate(text.slice(m.index, m.index + 120)))
    }
  }

  scanText(html, 'page.html (inline scripts + markup)')
  for (const b of bundles) scanText(b.code, b.name)

  // Attach GraphQL operation names to graphql endpoints found in the same file.
  const endpoints = [...seen.values()]
  for (const ep of endpoints) {
    if (/graphql/i.test(ep.path)) {
      const op = [...graphqlOps.keys()][0]
      if (op) {
        ep.method = 'GRAPHQL'
        ep.operationName = op
        ep.snippet = graphqlOps.get(op) ?? ep.snippet
      }
    }
  }
  // Any endpoint whose snippet mentions a GraphQL operation gets it too.
  for (const ep of endpoints) {
    if (!ep.operationName) {
      const found = [...graphqlOps.keys()].find((op) => ep.snippet.includes(op))
      if (found) ep.operationName = found
    }
  }

  return endpoints.sort((a, b) => a.group.localeCompare(b.group) || a.path.localeCompare(b.path))
}

/* ------------------------------------------------------------------ */
/* Route / page-flow extraction                                        */
/* ------------------------------------------------------------------ */

const ANCHOR_HREF = /<a\b[^>]*\bhref\s*=\s*["']([^"']+)["']/gi
const JS_ROUTE = /\b(?:path|route|to|href)\s*[:=]\s*['"`](\/[A-Za-z0-9\-_/{}:]{1,80})['"`]/g

function labelForPath(path: string): string {
  const seg = path.split('/').filter(Boolean).pop() ?? 'home'
  const cleaned = seg.replace(/[-_]/g, ' ').replace(/\{[^}]*\}/g, '').trim()
  if (path === '/') return 'Home'
  return cleaned ? cleaned.charAt(0).toUpperCase() + cleaned.slice(1) : 'Page'
}

export function extractRoutes(html: string, bundles: JsBundle[], inputUrl: string): RouteNode[] {
  const seen = new Map<string, RouteNode>()

  const add = (raw: string, source: string, kind: RouteNode['kind'] = 'page') => {
    const path = normalisePath(raw)
    if (!path) return
    // Skip asset-ish and API paths here — those live in the API map.
    if (looksLikeApiPath(path)) return
    const key = path.split('?')[0]
    if (seen.has(key)) return
    seen.set(key, { id: nextId('rt'), path: key, label: labelForPath(key), kind, source })
  }

  // The pasted URL itself is the entry screen.
  try {
    const u = new URL(inputUrl)
    add(u.pathname || '/', 'pasted URL')
  } catch {
    add('/', 'pasted URL')
  }

  let m: RegExpExecArray | null
  ANCHOR_HREF.lastIndex = 0
  while ((m = ANCHOR_HREF.exec(html)) !== null) {
    const href = m[1]
    if (/^(#|mailto:|tel:|javascript:)/i.test(href)) continue
    if (/^https?:\/\//i.test(href)) {
      try {
        const u = new URL(href)
        const self = new URL(inputUrl)
        if (u.host !== self.host) continue // external links are not app screens
        add(u.pathname, 'page.html <a href>')
      } catch {
        continue
      }
    } else {
      add(href, 'page.html <a href>')
    }
  }

  const scanJs = (text: string, source: string) => {
    JS_ROUTE.lastIndex = 0
    let jm: RegExpExecArray | null
    while ((jm = JS_ROUTE.exec(text)) !== null) add(jm[1], source)
  }
  scanJs(html, 'page.html (inline JS)')
  for (const b of bundles) scanJs(b.code, b.name)

  return [...seen.values()].slice(0, 40)
}

const FLOW_RULES: Array<{ from: RegExp; to: RegExp; label: string }> = [
  { from: /^\/?$/, to: /restaurant|salem|order/i, label: 'opens restaurant page' },
  { from: /search/i, to: /restaurant|salem/i, label: 'search result → restaurant' },
  { from: /restaurant|salem|menu/i, to: /order/i, label: 'browse menu → start order' },
  { from: /restaurant|salem|menu/i, to: /review/i, label: 'reads reviews' },
  { from: /restaurant|salem|menu/i, to: /photo|galler/i, label: 'views photos' },
  { from: /order|cart/i, to: /checkout|cart/i, label: 'cart → checkout' },
  { from: /checkout/i, to: /track|confirm|success|order/i, label: 'pay → track order' },
  { from: /track/i, to: /review/i, label: 'after delivery → review' },
]

export function buildFlowEdges(routes: RouteNode[]): FlowEdge[] {
  const edges: FlowEdge[] = []
  const seen = new Set<string>()
  for (const rule of FLOW_RULES) {
    const from = routes.find((r) => rule.from.test(r.path))
    const to = routes.find((r) => rule.to.test(r.path) && r.path !== from?.path)
    if (!from || !to) continue
    const key = `${from.id}->${to.id}`
    if (seen.has(key)) continue
    seen.add(key)
    edges.push({ from: from.id, to: to.id, label: rule.label })
  }
  return edges
}

/* ------------------------------------------------------------------ */
/* Menu data-model extraction                                          */
/* ------------------------------------------------------------------ */

const JSON_LD = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi

function jsonLdItems(html: string): MenuItem[] {
  const items: MenuItem[] = []
  let m: RegExpExecArray | null
  JSON_LD.lastIndex = 0
  while ((m = JSON_LD.exec(html)) !== null) {
    let data: unknown
    try {
      data = JSON.parse(m[1])
    } catch {
      continue
    }
    const walk = (node: unknown, category: string): void => {
      if (!node || typeof node !== 'object') return
      if (Array.isArray(node)) {
        node.forEach((n) => walk(n, category))
        return
      }
      const obj = node as Record<string, unknown>
      const type = typeof obj['@type'] === 'string' ? obj['@type'] : ''
      if (type === 'MenuSection' && typeof obj.name === 'string') {
        walk(obj.hasMenuItem, obj.name)
        walk(obj.hasMenuSection, obj.name)
        return
      }
      if (type === 'MenuItem' || (typeof obj.name === 'string' && (obj.offers || obj.price))) {
        const offers = obj.offers as { price?: number | string } | undefined
        const rawPrice = offers?.price ?? obj.price
        const price = rawPrice == null ? null : Number(String(rawPrice).replace(/[^\d.]/g, '')) || null
        items.push({
          name: String(obj.name),
          price,
          currency: 'INR',
          description: typeof obj.description === 'string' ? obj.description : '',
          veg: null,
          category: category || 'Menu',
          source: 'JSON-LD (schema.org)',
        })
        return
      }
      // Restaurant with a menu array.
      if (obj.hasMenu) walk(obj.hasMenu, category)
      if (obj.hasMenuSection) walk(obj.hasMenuSection, category)
      if (obj.menu) walk(obj.menu, category)
    }
    walk(data, '')
  }
  return items
}

/** Embedded JSON blobs (e.g. __NEXT_DATA__): "name": "...", "price": 249 */
function embeddedJsonItems(html: string): MenuItem[] {
  const items: MenuItem[] = []
  const re = /"name"\s*:\s*"([^"]{2,80})"\s*,[^}]{0,300}?"price"\s*:\s*"?([\d,]+)"?/g
  let m: RegExpExecArray | null
  while ((m = re.exec(html)) !== null) {
    // Skip matches that crossed into a nested object — e.g. a MenuSection
    // ("Smash Burgers") whose first descendant MenuItem carries the price.
    // A real item's name→price span never contains a second "name".
    if ((m[0].match(/"name"\s*:/g) ?? []).length > 1) continue
    const name = m[1].trim()
    if (/restaurant|salem|cafe|page/i.test(name)) continue
    items.push({
      name,
      price: Number(m[2].replace(/,/g, '')),
      currency: 'INR',
      description: '',
      veg: null,
      category: 'Menu',
      source: 'embedded JSON in page',
    })
  }
  return items
}

/** DOM fallback: blocks whose class mentions dish/menu-item, name + ₹ price inside. */
function domItems(html: string): MenuItem[] {
  const items: MenuItem[] = []
  const re =
    /<[^>]*class=["'][^"']*(?:menu-item|dish-item|dish-card|food-item)[^"']*["'][^>]*>([\s\S]{0,900}?)<\/div>/gi
  let m: RegExpExecArray | null
  while ((m = re.exec(html)) !== null) {
    const block = m[1]
    const text = stripTags(block)
    const priceMatch = text.match(/₹\s*([\d,]+)/)
    const name = text
      .replace(/₹\s*[\d,]+/g, '')
      .replace(/\b(veg|non-veg|bestseller|must try)\b/gi, '')
      .trim()
      .split(/\s{2,}/)[0]
      .slice(0, 80)
    if (!name || name.length < 3) continue
    items.push({
      name,
      price: priceMatch ? Number(priceMatch[1].replace(/,/g, '')) : null,
      currency: 'INR',
      description: '',
      veg: /veg/i.test(block) && !/non-veg/i.test(block) ? true : /non-veg/i.test(block) ? false : null,
      category: 'Menu',
      source: 'page DOM (menu-item markup)',
    })
  }
  return items
}

export function extractMenu(html: string): MenuItem[] {
  const byName = new Map<string, MenuItem>()
  for (const item of [...jsonLdItems(html), ...embeddedJsonItems(html), ...domItems(html)]) {
    const key = item.name.toLowerCase()
    if (!byName.has(key)) byName.set(key, item)
  }
  return [...byName.values()]
}

function groupMenu(items: MenuItem[]): MenuCategory[] {
  const map = new Map<string, MenuItem[]>()
  for (const item of items) {
    const list = map.get(item.category) ?? []
    list.push(item)
    map.set(item.category, list)
  }
  return [...map.entries()]
    .map(([name, list]) => ({ name, itemCount: list.length, items: list }))
    .sort((a, b) => b.itemCount - a.itemCount)
}

/* ------------------------------------------------------------------ */
/* Tech fingerprints                                                   */
/* ------------------------------------------------------------------ */

const TECH_CHECKS: Array<{ name: string; test: (html: string, js: string) => string | null; confidence: number }> = [
  {
    name: 'Next.js',
    test: (h) => (h.includes('__NEXT_DATA__') || h.includes('_next/static') ? '__NEXT_DATA__ / _next/static present' : null),
    confidence: 95,
  },
  {
    name: 'React',
    test: (h, j) =>
      h.includes('data-reactroot') || /react-dom|__REACT|React\.createElement/.test(h + j)
        ? 'react-dom / data-reactroot markers in page or bundles'
        : null,
    confidence: 90,
  },
  {
    name: 'GraphQL',
    test: (h, j) => (/graphql/i.test(h + j) ? 'graphql endpoint / operation strings in JS' : null),
    confidence: 90,
  },
  {
    name: 'Webpack',
    test: (_h, j) => (/webpackChunk|__webpack_require__/.test(j) ? 'webpackChunk / __webpack_require__ in bundles' : null),
    confidence: 90,
  },
  {
    name: 'Google Maps',
    test: (h, j) => (/maps\.googleapis|google\.maps/.test(h + j) ? 'maps.googleapis reference' : null),
    confidence: 95,
  },
  {
    name: 'Razorpay',
    test: (h, j) => (/razorpay/i.test(h + j) ? 'razorpay checkout reference' : null),
    confidence: 90,
  },
  {
    name: 'Vue / Nuxt',
    test: (h) => (h.includes('__NUXT__') || h.includes('data-v-') ? '__NUXT__ / data-v- markers' : null),
    confidence: 85,
  },
  {
    name: 'Angular',
    test: (h) => (/ng-version|_ngcontent/.test(h) ? 'ng-version / _ngcontent markers' : null),
    confidence: 90,
  },
  {
    name: 'jQuery',
    test: (h, j) => (/jquery/i.test(h + j) ? 'jQuery reference in page or bundles' : null),
    confidence: 85,
  },
]

export function detectTech(html: string, bundles: JsBundle[]): TechFingerprint[] {
  const js = bundles.map((b) => b.code).join('\n')
  return TECH_CHECKS.filter((t) => t.test(html, js)).map((t) => ({
    name: t.name,
    evidence: t.test(html, js) ?? '',
    confidence: t.confidence,
  }))
}

/* ------------------------------------------------------------------ */
/* Main entry point                                                    */
/* ------------------------------------------------------------------ */

function pageTitle(html: string): string | null {
  const m = html.match(/<title[^>]*>([^<]{1,120})<\/title>/i)
  return m ? stripTags(m[1]) : null
}

function restaurantName(html: string): string | null {
  const ld = html.match(/"@type"\s*:\s*"Restaurant"[^}]{0,400}?"name"\s*:\s*"([^"]+)"/)
  if (ld) return ld[1]
  const h1 = html.match(/<h1[^>]*>([\s\S]{0,120}?)<\/h1>/i)
  return h1 ? stripTags(h1[1]) || null : null
}

export function analyzePage(
  html: string,
  bundles: JsBundle[],
  inputUrl: string,
  analysedFrom: 'live' | 'sample',
  fetchNote: string | null,
): AnalysisResult {
  idCounter = 0
  const endpoints = extractEndpoints(html, bundles)
  const routes = extractRoutes(html, bundles, inputUrl)
  const flowEdges = buildFlowEdges(routes)
  const items = extractMenu(html)
  const categories = groupMenu(items)
  const tech = detectTech(html, bundles)
  const jsBytes = bundles.reduce((n, b) => n + b.code.length, 0)

  const evidence: Evidence[] = []

  for (const group of [...new Set(endpoints.map((e) => e.group))]) {
    const eps = endpoints.filter((e) => e.group === group)
    evidence.push({
      claim: `${eps.length} ${group} endpoint${eps.length === 1 ? '' : 's'} found — e.g. ${eps[0].method} ${eps[0].path}`,
      status: 'seen',
      confidence: 92,
      source: eps[0].sourceFile,
      snippet: eps[0].snippet,
    })
  }
  if (items.length > 0) {
    evidence.push({
      claim: `${items.length} menu items across ${categories.length} categor${categories.length === 1 ? 'y' : 'ies'} extracted from ${items[0].source}`,
      status: 'seen',
      confidence: 95,
      source: 'page.html',
      snippet: `${items[0].name} — ₹${items[0].price ?? '?'}`,
    })
  } else {
    evidence.push({
      claim: 'No menu items could be extracted from this page (no JSON-LD menu, no embedded JSON, no menu-item markup)',
      status: 'unknown',
      confidence: 0,
      source: 'page.html',
      snippet: 'menu extraction: JSON-LD + embedded JSON + DOM patterns all empty',
    })
  }
  for (const t of tech) {
    evidence.push({
      claim: `Tech fingerprint: ${t.name}`,
      status: 'seen',
      confidence: t.confidence,
      source: 'page.html + JS bundles',
      snippet: t.evidence,
    })
  }
  if (routes.length > 1) {
    evidence.push({
      claim: `${routes.length} app screens found; ${flowEdges.length} navigation flows inferred between them`,
      status: 'inferred',
      confidence: 70,
      source: 'page.html links + JS route strings',
      snippet: routes.map((r) => r.path).slice(0, 5).join(' → '),
    })
  }
  if (!endpoints.some((e) => e.group === 'auth')) {
    evidence.push({
      claim: 'No login/auth endpoint was seen in the public page or its public JS — how login works cannot be answered from this scan',
      status: 'unknown',
      confidence: 0,
      source: 'page.html + JS bundles',
      snippet: 'no /login, /auth, /otp or /token endpoint matched',
    })
  }
  if (!endpoints.some((e) => e.group === 'checkout')) {
    evidence.push({
      claim: 'No checkout/payment endpoint was seen — the page may load checkout lazily, or it lives in a bundle this scan did not fetch',
      status: 'unknown',
      confidence: 0,
      source: 'page.html + JS bundles',
      snippet: 'no /checkout, /payment or /pay endpoint matched',
    })
  }

  return {
    inputUrl,
    analysedFrom,
    fetchNote,
    scannedAt: new Date().toISOString(),
    pageTitle: pageTitle(html),
    restaurantName: restaurantName(html),
    endpoints,
    routes,
    flowEdges,
    categories,
    items,
    tech,
    evidence,
    stats: {
      htmlBytes: html.length,
      jsBundles: bundles.length,
      jsBytes,
      endpoints: endpoints.length,
      routes: routes.length,
      menuItems: items.length,
    },
  }
}
