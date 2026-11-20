/**
 * Live fetch layer — passive only.
 *
 * One unauthenticated GET of the pasted public page, then GETs of its
 * same-origin public JS bundles (max 6, max 1.5 MB each). No login, no
 * cookies/credentials, no POST, no calls to the target's API — the page
 * and its bundles are only *read*, never executed against the target.
 *
 * In practice browsers block this for most real sites (Zomato/Swiggy do
 * not send CORS headers for cross-origin reads), so `fetchPublicPage`
 * throws a `FetchBlockedError` and the app falls back to the built-in
 * sample, labelled as such. A small same-origin proxy (see README) is
 * the honest way to make live fetch work — it is not bundled, because
 * shipping a proxy that fetches arbitrary URLs is a footgun.
 */
import type { JsBundle } from './types'

export class FetchBlockedError extends Error {
  constructor(
    message: string,
    public readonly reason: 'cors' | 'network' | 'http' | 'timeout',
  ) {
    super(message)
    this.name = 'FetchBlockedError'
  }
}

const MAX_BUNDLES = 6
const MAX_BUNDLE_BYTES = 1_500_000
const FETCH_TIMEOUT_MS = 12_000

function fetchWithTimeout(url: string, timeoutMs = FETCH_TIMEOUT_MS): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  return fetch(url, { signal: controller.signal, credentials: 'omit', redirect: 'follow' }).finally(() =>
    clearTimeout(timer),
  )
}

export function scriptSrcs(html: string, base: string): string[] {
  const out: string[] = []
  const re = /<script[^>]*\bsrc\s*=\s*["']([^"']+)["']/gi
  let m: RegExpExecArray | null
  while ((m = re.exec(html)) !== null) {
    try {
      const abs = new URL(m[1], base).toString()
      const pageOrigin = new URL(base).origin
      // Same-origin bundles only: no third-party scripts, no analytics.
      if (new URL(abs).origin === pageOrigin && /\.js(\?|$)/i.test(abs) && !out.includes(abs)) out.push(abs)
    } catch {
      continue
    }
  }
  return out.slice(0, MAX_BUNDLES)
}

export async function fetchPublicPage(url: string): Promise<{ html: string; bundles: JsBundle[] }> {
  let res: Response
  try {
    res = await fetchWithTimeout(url)
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new FetchBlockedError(`Timed out after ${FETCH_TIMEOUT_MS / 1000}s fetching ${url}.`, 'timeout')
    }
    // A TypeError here is almost always the browser refusing a
    // cross-origin read (no CORS headers) — not proof the page is down.
    throw new FetchBlockedError(
      `Browser refused to read ${url} (cross-origin fetch blocked — the site does not send CORS headers for public reads). This is normal for Zomato/Swiggy pages.`,
      'cors',
    )
  }
  if (!res.ok) {
    throw new FetchBlockedError(`The page answered HTTP ${res.status} for ${url}.`, 'http')
  }
  const contentType = res.headers.get('content-type') ?? ''
  if (contentType && !/text\/html|application\/xhtml/i.test(contentType)) {
    throw new FetchBlockedError(`The URL did not return an HTML page (content-type: ${contentType}).`, 'http')
  }
  const html = await res.text()
  if (html.length < 200) {
    throw new FetchBlockedError('The fetched page was nearly empty — it may be a bot-check / JS shell.', 'http')
  }

  const bundles: JsBundle[] = []
  for (const src of scriptSrcs(html, url)) {
    try {
      const b = await fetchWithTimeout(src, 8_000)
      if (!b.ok) continue
      const code = await b.text()
      if (code.length > MAX_BUNDLE_BYTES) continue
      bundles.push({ name: src.split('/').pop() ?? src, url: src, code })
    } catch {
      continue // One dead bundle must not kill the scan.
    }
  }
  return { html, bundles }
}
