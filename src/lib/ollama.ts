/**
 * Optional local-AI explainer — Ollama behind the `answerQuestion()` seam.
 *
 * The rule-based explainer in explainer.ts is always the default and the
 * source of truth: it is instant, offline and never invents anything. This
 * module adds an *optional* second voice — a local Ollama model
 * (qwen2.5:3b-instruct) running on the user's own machine — that rewrites
 * the same grounded evidence in freer prose.
 *
 * Grounding rules, enforced in code, not just in the prompt:
 *   1. The model only ever sees the scan's evidence: endpoint paths,
 *      routes, menu summary and the evidence ledger. No other context.
 *   2. The prompt forbids any endpoint, price or flow step that is not
 *      in that evidence, and tells the model to say "not found" instead.
 *   3. After the model answers, `findUnseenPaths` checks every
 *      /api… or /dapi… path in its text against the endpoints the scan
 *      actually found. Any path not in the scan is flagged in the UI —
 *      the AI draft is never shown as verified fact.
 *
 * Graceful fallback: if Ollama is not running (or the call fails / times
 * out), the caller gets an `OllamaUnavailableError` and the UI simply
 * shows the rule-based answer. Nothing in the app depends on Ollama.
 *
 * Browser → Ollama CORS: the browser page (localhost:4173 / :5173) calls
 * http://localhost:11434 directly, so Ollama must allow that origin —
 * start it with e.g. `OLLAMA_ORIGINS=http://localhost:4173,http://localhost:5173
 * ollama serve`. `checkOllamaAvailable` probes `/api/tags` first, so the
 * UI knows before asking whether the server is even there.
 */
import type { AnalysisResult } from './types'

export const OLLAMA_BASE_URL = 'http://localhost:11434'
export const OLLAMA_MODEL = 'qwen2.5:3b-instruct'
/** How long the UI waits for a local answer (a 3B model on a busy CPU is slow). */
export const OLLAMA_TIMEOUT_MS = 300_000
/** Short probe timeout for the "is Ollama there?" check on panel open. */
export const OLLAMA_PROBE_TIMEOUT_MS = 2_500

export class OllamaUnavailableError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'OllamaUnavailableError'
  }
}

export interface OllamaStatus {
  available: boolean
  models: string[]
  /** Human-readable reason when unavailable (shown in the UI). */
  reason: string | null
}

export async function checkOllamaAvailable(timeoutMs = OLLAMA_PROBE_TIMEOUT_MS): Promise<OllamaStatus> {
  try {
    const res = await fetch(`${OLLAMA_BASE_URL}/api/tags`, {
      signal: AbortSignal.timeout(timeoutMs),
    })
    if (!res.ok) {
      return { available: false, models: [], reason: `Ollama answered HTTP ${res.status} on /api/tags.` }
    }
    const data = (await res.json()) as { models?: Array<{ name?: string }> }
    const models = (data.models ?? []).map((m) => m.name ?? '').filter(Boolean)
    return { available: true, models, reason: null }
  } catch (err) {
    const reason =
      err instanceof Error && err.name === 'TimeoutError'
        ? 'Ollama did not answer within a few seconds — it may be starting up.'
        : 'Ollama is not running on this machine (http://localhost:11434 did not answer). ' +
          'Start it with `ollama serve` — the rule-based explainer still works.'
    return { available: false, models: [], reason }
  }
}

/** Compact, evidence-only context handed to the model. Nothing else. */
export function buildGroundingContext(result: AnalysisResult): string {
  const lines: string[] = []
  lines.push(`Restaurant: ${result.restaurantName ?? result.pageTitle ?? result.inputUrl}`)
  lines.push(`Source analysed: ${result.analysedFrom === 'live' ? 'live fetch' : 'built-in sample page'}`)
  lines.push('')
  lines.push('API endpoints found (the ONLY endpoints that exist in this scan):')
  for (const ep of result.endpoints) {
    lines.push(`- ${ep.method} ${ep.path}${ep.operationName ? ` (GraphQL operation ${ep.operationName})` : ''} [${ep.group}]`)
  }
  lines.push('')
  lines.push(`App screens found: ${result.routes.map((r) => r.path).join(', ') || 'none'}`)
  if (result.flowEdges.length > 0) {
    lines.push(`Inferred navigation flows: ${result.flowEdges.map((e) => e.label).join('; ')}`)
  }
  lines.push('')
  if (result.items.length > 0) {
    const priced = result.items.filter((i) => i.price != null)
    lines.push(
      `Menu: ${result.items.length} items in ${result.categories.length} categories ` +
        `(${result.categories.map((c) => `${c.name}: ${c.itemCount}`).join(', ')}). ` +
        (priced.length > 0
          ? `Prices from ₹${Math.min(...priced.map((i) => i.price as number))} to ₹${Math.max(...priced.map((i) => i.price as number))}.`
          : 'No prices extracted.'),
    )
  } else {
    lines.push('Menu: no items extracted from this page.')
  }
  lines.push('')
  lines.push(`Tech fingerprints: ${result.tech.map((t) => t.name).join(', ') || 'none'}`)
  lines.push('')
  lines.push('Evidence ledger:')
  for (const ev of result.evidence) {
    lines.push(`- [${ev.status.toUpperCase()}] ${ev.claim}`)
  }
  return lines.join('\n')
}

const SYSTEM_PROMPT = `You explain how a food-delivery restaurant app works, using ONLY the evidence below.
Rules you must follow:
- Mention an API endpoint ONLY if it appears verbatim in the evidence. Never invent, guess or "complete" an endpoint path, a price, or a flow step.
- If the evidence does not cover something the question asks about, say clearly "I could not find that in this scan" and stop — do not fill the gap.
- Keep the answer short (3-6 sentences), plain language, no markdown headings.
- Quote endpoint paths exactly as written in the evidence.`

/**
 * Extract /api… / /dapi… / /graphql paths from model text and return the
 * ones that do NOT match any endpoint the scan found. A path matches when
 * it equals a known path, or equals it after replacing `{param}` segments
 * with any single segment (the analyser normalises ids to {param}).
 */
export function findUnseenPaths(text: string, result: AnalysisResult): string[] {
  const candidates = [...new Set(text.match(/\/[a-z0-9\-_/{}]+/gi) ?? [])].filter((p) =>
    /\/(api|dapi|graphql|rest|rpc|v\d+)\//i.test(p),
  )
  const known = result.endpoints.map((e) => e.path)
  const matches = (candidate: string): boolean =>
    known.some((k) => {
      if (k === candidate) return true
      const pattern = new RegExp(
        '^' +
          k
            .split('/')
            .map((seg) => (seg === '{param}' ? '[^/]+' : seg.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
            .join('/') +
          '$',
      )
      return pattern.test(candidate)
    })
  return candidates.filter((c) => !matches(c))
}

export interface OllamaAnswer {
  answer: string
  model: string
  /** Endpoint paths the model mentioned that the scan did NOT find. */
  unseenPaths: string[]
}

export async function askOllama(
  question: string,
  result: AnalysisResult,
  model: string = OLLAMA_MODEL,
  opts: { numPredict?: number; timeoutMs?: number } = {},
): Promise<OllamaAnswer> {
  const prompt = `${SYSTEM_PROMPT}\n\n--- EVIDENCE FROM THE SCAN ---\n${buildGroundingContext(result)}\n\n--- QUESTION ---\n${question}\n\nAnswer using only the evidence above:`
  const timeoutMs = opts.timeoutMs ?? OLLAMA_TIMEOUT_MS
  let res: Response
  try {
    res = await fetch(`${OLLAMA_BASE_URL}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        prompt,
        stream: false,
        options: { temperature: 0.2, num_predict: opts.numPredict ?? 250 },
      }),
      signal: AbortSignal.timeout(timeoutMs),
    })
  } catch (err) {
    if (err instanceof Error && err.name === 'TimeoutError') {
      throw new OllamaUnavailableError(
        `Ollama took longer than ${timeoutMs / 1000}s to answer — the local model may still be loading. The rule-based answer below is unaffected.`,
      )
    }
    throw new OllamaUnavailableError(
      'Could not reach Ollama at http://localhost:11434. Is `ollama serve` running? The rule-based answer below is unaffected.',
    )
  }
  if (!res.ok) {
    const detail = await res.text().catch(() => '')
    throw new OllamaUnavailableError(
      `Ollama answered HTTP ${res.status}${detail ? `: ${detail.slice(0, 200)}` : ''}. ` +
        (res.status === 404 ? `Model "${model}" may not be pulled — run \`ollama pull ${model}\`. ` : '') +
        'The rule-based answer below is unaffected.',
    )
  }
  const data = (await res.json()) as { response?: string }
  const answer = (data.response ?? '').trim()
  if (!answer) {
    throw new OllamaUnavailableError('Ollama answered but returned empty text. The rule-based answer below is unaffected.')
  }
  return { answer, model, unseenPaths: findUnseenPaths(answer, result) }
}
