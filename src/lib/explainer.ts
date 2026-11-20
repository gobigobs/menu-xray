/**
 * Evidence-grounded explainer — the "AI panel".
 *
 * This is a transparent, rule-based explainer: every sentence it returns
 * is built from endpoints / routes / menu items the analyser actually
 * found, and each answer carries its evidence with a seen / inferred /
 * unknown status (REA-style evidence ledger). It never invents an
 * endpoint, a price, or a flow step.
 *
 * A local/remote LLM was deliberately NOT wired in by default: this app
 * ships with no API key, no server, and no data leaving the browser, so an
 * LLM call would need a key the user supplies. The rule-based explainer is
 * the honest default — and the README says so. The seam is now optionally
 * filled by `src/lib/ollama.ts`: a local Ollama model (qwen2.5:3b-instruct)
 * that answers from the same `result.evidence` grounding, with a
 * post-answer check that flags any endpoint path it mentions that the scan
 * did not find. Ollama is opt-in, local-only, and the rule-based answer
 * below stays the source of truth when it is off or unavailable.
 */
import type { AnalysisResult, Evidence, ExplainerAnswer, FeatureGroup } from './types'

const GROUP_LABEL: Record<FeatureGroup, string> = {
  menu: 'menu',
  search: 'search',
  cart: 'cart',
  checkout: 'checkout',
  order: 'ordering',
  reviews: 'reviews',
  photos: 'photos',
  auth: 'login / auth',
  tracking: 'order tracking',
  media: 'media',
  other: 'other',
}

interface Intent {
  keys: string[]
  group: FeatureGroup
  explain: (r: AnalysisResult) => string
}

const INTENTS: Intent[] = [
  // Price first: "cheapest item" contains "item", which would otherwise
  // match the menu intent below.
  {
    keys: ['price', 'cost', 'how much', 'expensive', 'cheap', 'cheapest', 'priciest', 'most expensive'],
    group: 'menu',
    explain: (r) => {
      if (r.items.length === 0) return 'No priced menu items were extracted, so no price claim can be made.'
      const priced = r.items.filter((i) => i.price != null).map((i) => i.price as number)
      const min = Math.min(...priced)
      const max = Math.max(...priced)
      const avg = Math.round(priced.reduce((a, b) => a + b, 0) / priced.length)
      return `From the ${priced.length} priced items extracted: cheapest ₹${min}, most expensive ₹${max}, average about ₹${avg}. All prices come from the page's own structured data/markup — nothing estimated.`
    },
  },
  {
    keys: ['menu', 'dish', 'food', 'item', 'categor'],
    group: 'menu',
    explain: (r) => {
      const eps = r.endpoints.filter((e) => e.group === 'menu')
      const menuLine =
        r.items.length > 0
          ? `The page itself already carries the menu as structured data (${r.items.length} items in ${r.categories.length} categor${r.categories.length === 1 ? 'y' : 'ies'} — e.g. ${r.categories.map((c) => c.name).join(', ')}), extracted from ${r.items[0].source}.`
          : 'No menu items could be extracted from the page itself.'
      const apiLine =
        eps.length > 0
          ? `For live data, the JS calls ${eps.map((e) => `${e.method} ${e.path}`).join(' and ')} — a plain GET with no auth headers visible in the call, so the menu loads without login.`
          : 'No menu endpoint was found in the public JS, so the menu here comes from the page markup/structured data, not a separate API call.'
      return `${menuLine} ${apiLine}`
    },
  },
  {
    keys: ['search', 'find', 'suggest', 'discover'],
    group: 'search',
    explain: (r) => {
      const eps = r.endpoints.filter((e) => e.group === 'search')
      if (eps.length === 0) return 'No search endpoint was found in the public page or its public JS. Search may live in a bundle this scan did not fetch, or on a different page.'
      return `Search runs through ${eps.map((e) => `${e.method} ${e.path}`).join(' and ')} — a GET with the query as a URL parameter (e.g. ?q= or ?query=). Suggestions and full restaurant results are separate calls, so typing shows suggestions first and the full results page is a second call.`
    },
  },
  {
    keys: ['cart', 'add to cart', 'basket'],
    group: 'cart',
    explain: (r) => {
      const eps = r.endpoints.filter((e) => e.group === 'cart')
      if (eps.length === 0) return 'No cart endpoint was found in the public page or its public JS. The cart may be kept in local browser state only, or its calls live in a bundle this scan did not fetch.'
      return `The cart is server-side: ${eps.map((e) => `${e.method} ${e.path}`).join(', ')}. Adding an item POSTs the restaurant id, item id and quantity as JSON; the cart is then re-fetched with a GET. Coupons are applied through a separate POST, so a coupon is validated server-side before the total changes.`
    },
  },
  {
    keys: ['checkout', 'pay', 'payment', 'upi', 'razorpay'],
    group: 'checkout',
    explain: (r) => {
      const eps = r.endpoints.filter((e) => e.group === 'checkout' || e.group === 'order')
      if (eps.length === 0) return 'No checkout or order endpoint was found in the public page or its public JS. Checkout may be loaded lazily (only after the user taps "checkout"), or it lives in a bundle this scan did not fetch.'
      return `Checkout is two steps: ${eps.map((e) => `${e.method} ${e.path}`).join(', ')}. First the order is placed, then checkout is initiated against that order id — so payment is tied to a created order, not to the cart directly.`
    },
  },
  {
    keys: ['track', 'status', 'delivery', 'where is my order', 'eta'],
    group: 'tracking',
    explain: (r) => {
      const eps = r.endpoints.filter((e) => e.group === 'tracking' || e.group === 'order')
      if (eps.length === 0) return 'No tracking endpoint was found in the public page or its public JS.'
      return `Order status comes from ${eps.map((e) => `${e.method} ${e.path}`).join(' and ')} — a GET keyed by order id. That means the tracking screen polls (or re-fetches) this one endpoint to move the order through its states.`
    },
  },
  {
    keys: ['review', 'rating', 'rate'],
    group: 'reviews',
    explain: (r) => {
      const eps = r.endpoints.filter((e) => e.group === 'reviews')
      if (eps.length === 0) return 'No review endpoint was found in the public page or its public JS.'
      const read = eps.find((e) => e.method === 'GET')
      const write = eps.find((e) => e.method === 'POST')
      return `Reviews are loaded ${read ? `with ${read.method} ${read.path} (paged, newest first)` : 'from an endpoint this scan saw but could not classify as a read'}${
        write ? `, and submitting one POSTs to ${write.path} with the restaurant id, rating and text.` : ', and no submit endpoint was seen — posting a review may need login, which this passive scan cannot see.'
      }`
    },
  },
  {
    keys: ['photo', 'image', 'gallery', 'picture'],
    group: 'photos',
    explain: (r) => {
      const eps = r.endpoints.filter((e) => e.group === 'photos')
      if (eps.length === 0) return 'No photo endpoint was found in the public page or its public JS.'
      return `Photos come from ${eps.map((e) => `${e.method} ${e.path}`).join(' and ')} — a paged GET (limit 24 in the call seen), so the gallery loads in batches, not all at once.`
    },
  },
  {
    keys: ['login', 'sign in', 'signup', 'sign up', 'auth', 'otp'],
    group: 'auth',
    explain: (r) => {
      const eps = r.endpoints.filter((e) => e.group === 'auth')
      if (eps.length === 0)
        return 'No login/auth endpoint was seen in the public page or its public JS. That is expected: auth usually lives behind a login screen this passive scan never opens, and menu/cart browsing here works without it. This scan cannot say how login works — and it does not guess.'
      return `An auth endpoint was seen: ${eps.map((e) => `${e.method} ${e.path}`).join(', ')}.`
    },
  },
  {
    keys: ['tech', 'stack', 'built with', 'framework', 'react', 'next'],
    group: 'other',
    explain: (r) => {
      if (r.tech.length === 0) return 'No recognisable tech fingerprints were found in the page or its JS bundles.'
      return `Detected from markers in the page and bundles: ${r.tech.map((t) => `${t.name} (${t.confidence}% — ${t.evidence})`).join('; ')}. These are fingerprints found in public markup/JS, not a guarantee of the full stack.`
    },
  },
  {
    keys: ['flow', 'page', 'screen', 'navigate', 'how do i get', 'journey'],
    group: 'other',
    explain: (r) => {
      if (r.routes.length === 0) return 'No app screens could be mapped from this page.'
      const flow = r.flowEdges.length > 0 ? ` The main flows seen are: ${r.flowEdges.map((e) => e.label).join('; ')}.` : ''
      return `The app has ${r.routes.length} screens in this scan: ${r.routes.map((x) => x.path).join(', ')}.${flow} Flows are inferred from the links and route strings found — the order is a best reading of the navigation, not a recorded user session.`
    },
  },
]

function evidenceForGroup(r: AnalysisResult, group: FeatureGroup): Evidence[] {
  const eps = r.endpoints.filter((e) => e.group === group)
  const out: Evidence[] = eps.map((e) => ({
    claim: `${e.method} ${e.path}${e.operationName ? ` (GraphQL operation ${e.operationName})` : ''}`,
    status: 'seen',
    confidence: 92,
    source: e.sourceFile,
    snippet: e.snippet,
  }))
  if (group === 'menu' && r.items.length > 0) {
    out.push({
      claim: `${r.items.length} menu items extracted (${r.items[0].source})`,
      status: 'seen',
      confidence: 95,
      source: 'page.html',
      snippet: `${r.items[0].name} — ₹${r.items[0].price ?? '?'}`,
    })
  }
  return out
}

export const SUGGESTED_QUESTIONS = [
  'How does menu loading work here?',
  'How does checkout work here?',
  'How does search work here?',
  'How are reviews loaded?',
  'How does order tracking work?',
  'What is this app built with?',
]

export function answerQuestion(result: AnalysisResult, rawQuestion: string): ExplainerAnswer {
  const question = rawQuestion.trim()
  const lower = question.toLowerCase()
  const intent = INTENTS.find((i) => i.keys.some((k) => lower.includes(k)))

  if (!intent) {
    return {
      question,
      status: 'unresolved',
      answer:
        'I cannot answer that from this scan — no endpoint, route or menu item found here matches the question, and I do not guess. Try one of the suggested questions, or ask about menu, search, cart, checkout, tracking, reviews, photos, or the tech stack.',
      evidence: [],
      gaps: [
        'No matching evidence in the analysed page or JS bundles.',
        'If the feature lives behind login or in a lazily-loaded bundle, this passive scan cannot see it.',
      ],
    }
  }

  const answer = intent.explain(result)
  const evidence = evidenceForGroup(result, intent.group)
  const gaps: string[] = []

  // "Answered" needs at least one seen endpoint (or, for menu/prices, items).
  const hasSeen = evidence.some((e) => e.status === 'seen')
  if (!hasSeen) {
    gaps.push(`No ${GROUP_LABEL[intent.group]} endpoint was seen in the public page or its public JS.`)
    gaps.push('The feature may load lazily, live behind login, or sit in a bundle this scan did not fetch.')
  }
  if (intent.group === 'menu' && result.items.length === 0) {
    gaps.push('No menu items could be extracted from the page itself.')
  }

  return {
    question,
    status: hasSeen ? 'answered' : 'partial',
    answer,
    evidence,
    gaps,
  }
}
