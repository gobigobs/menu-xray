/**
 * Shared types for menu-xray.
 *
 * Every claim the app shows carries an evidence trail (REA-style):
 * a claim is `seen` (found verbatim in the page/JS), `inferred` (a
 * reasonable deduction from seen evidence, labelled as such) or
 * `unknown` (asked about, but no evidence found). Nothing is invented.
 */

export type EvidenceStatus = 'seen' | 'inferred' | 'unknown'

export type FeatureGroup =
  | 'menu'
  | 'search'
  | 'cart'
  | 'checkout'
  | 'order'
  | 'reviews'
  | 'photos'
  | 'auth'
  | 'tracking'
  | 'media'
  | 'other'

export interface Evidence {
  /** Short human-readable claim, e.g. "Menu is loaded by GET /api/v1/menu". */
  claim: string
  status: EvidenceStatus
  /** 0–100. Seen evidence scores high; inferred is capped; unknown is 0. */
  confidence: number
  /** Where the evidence came from: file name / URL + line-ish location. */
  source: string
  /** The exact snippet that proves it (truncated). */
  snippet: string
}

export interface Endpoint {
  id: string
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'GRAPHQL' | 'UNKNOWN'
  /** Path as found, e.g. "/api/v1/restaurants/18472931/menu". */
  path: string
  /** Full URL when absolute, otherwise the path. */
  url: string
  group: FeatureGroup
  /** File the endpoint was found in. */
  sourceFile: string
  /** Exact code snippet it was extracted from. */
  snippet: string
  /** GraphQL operation name, when applicable. */
  operationName?: string
  /** Query parameters seen in the call, if any. */
  queryParams?: string[]
}

export interface RouteNode {
  id: string
  path: string
  label: string
  kind: 'page' | 'action' | 'api'
  source: string
}

export interface FlowEdge {
  from: string
  to: string
  label: string
}

export interface MenuItem {
  name: string
  price: number | null
  currency: string
  description: string
  veg: boolean | null
  category: string
  source: string
}

export interface MenuCategory {
  name: string
  itemCount: number
  items: MenuItem[]
}

export interface TechFingerprint {
  name: string
  evidence: string
  confidence: number
}

export interface JsBundle {
  name: string
  url: string
  /** Raw JS text (fetched, or from the built-in sample). */
  code: string
}

export interface AnalysisResult {
  /** The URL the user pasted. */
  inputUrl: string
  /** What was actually analysed: 'live' (fetched in-browser) or 'sample'. */
  analysedFrom: 'live' | 'sample'
  /** Human note when live fetch was not possible (e.g. CORS). */
  fetchNote: string | null
  scannedAt: string
  /** Page <title> / restaurant name when found. */
  pageTitle: string | null
  restaurantName: string | null
  endpoints: Endpoint[]
  routes: RouteNode[]
  flowEdges: FlowEdge[]
  categories: MenuCategory[]
  items: MenuItem[]
  tech: TechFingerprint[]
  evidence: Evidence[]
  stats: {
    htmlBytes: number
    jsBundles: number
    jsBytes: number
    endpoints: number
    routes: number
    menuItems: number
  }
}

export type AnswerStatus = 'answered' | 'partial' | 'unresolved'

export interface ExplainerAnswer {
  question: string
  status: AnswerStatus
  /** Plain-language answer. Only ever built from the evidence below. */
  answer: string
  evidence: Evidence[]
  /** What the app could NOT find — stated explicitly, never papered over. */
  gaps: string[]
}

export interface ScanPhase {
  label: string
  detail: string
  done: boolean
}
