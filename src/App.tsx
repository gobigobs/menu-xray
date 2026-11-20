import { useCallback, useRef, useState } from 'react'
import type { AnalysisResult } from './lib/types'
import { analyzePage } from './lib/analyzer'
import { fetchPublicPage, FetchBlockedError } from './lib/fetchPage'
import { DEMO_TARGETS, SAMPLES, SAMPLE_URL, sampleForUrl, type SampleId } from './lib/sample'
import { downloadTextFile, reportFilename, toJson, toMarkdown } from './lib/export'
import { ApiMap } from './components/ApiMap'
import { FlowMap } from './components/FlowMap'
import { DataModel } from './components/DataModel'
import { AskPanel } from './components/AskPanel'
import { EvidenceLedger } from './components/EvidenceLedger'

type Phase = 'idle' | 'scanning' | 'done'
type Tab = 'api' | 'flow' | 'model' | 'ask'

interface LogLine {
  text: string
  kind: 'info' | 'ok' | 'warn' | 'err'
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

const TABS: Array<{ id: Tab; label: string }> = [
  { id: 'api', label: 'API MAP' },
  { id: 'flow', label: 'PAGE FLOW' },
  { id: 'model', label: 'MENU DATA MODEL' },
  { id: 'ask', label: 'ASK HOW IT WORKS' },
]

/** Real scan counts for the two built-in samples (from the analyser tests). */
const SAMPLE_CARDS: Array<{ id: SampleId; brand: string; place: string; stats: string }> = [
  { id: 'zomato', brand: 'Zomato', place: 'Burger Barn · Salem', stats: '14 endpoints · 9 screens · 11 dishes' },
  { id: 'swiggy', brand: 'Swiggy', place: 'Anbu Biryani House · Salem', stats: '12 endpoints · 7 screens · 10 dishes' },
]

function downloadJson(result: AnalysisResult) {
  downloadTextFile(reportFilename(result, 'json'), toJson(result), 'application/json')
}

function downloadMarkdown(result: AnalysisResult) {
  downloadTextFile(reportFilename(result, 'md'), toMarkdown(result), 'text/markdown')
}

export default function App() {
  const [url, setUrl] = useState(SAMPLE_URL)
  const [phase, setPhase] = useState<Phase>('idle')
  const [tab, setTab] = useState<Tab>('api')
  const [log, setLog] = useState<LogLine[]>([])
  const [result, setResult] = useState<AnalysisResult | null>(null)
  const [pasteMode, setPasteMode] = useState(false)
  const [pastedHtml, setPastedHtml] = useState('')
  const [sampleId, setSampleId] = useState<SampleId>('zomato')
  const scanToken = useRef(0)

  const pushLog = useCallback((text: string, kind: LogLine['kind'] = 'info') => {
    setLog((prev) => [...prev, { text, kind }])
  }, [])

  const runScan = useCallback(
    async (targetUrl: string) => {
      const token = ++scanToken.current
      const alive = () => token === scanToken.current
      setPhase('scanning')
      setResult(null)
      setTab('api')
      setLog([])

      pushLog(`$ menu-xray scan ${targetUrl}`, 'info')
      await sleep(350)
      if (!alive()) return

      // Pasted-HTML path: no network at all.
      if (pasteMode && pastedHtml.trim().length > 100) {
        pushLog('[1/4] using pasted page HTML — no network request made', 'ok')
        await sleep(300)
        pushLog('[2/4] parsing HTML — title, links, JSON-LD, inline scripts…', 'info')
        await sleep(400)
        pushLog('[3/4] extracting endpoints from inline JS…', 'info')
        await sleep(400)
        const res = analyzePage(pastedHtml, [], targetUrl, 'live', 'Pasted HTML supplied by the user — no fetch was attempted.')
        pushLog(`[4/4] done — ${res.stats.endpoints} endpoints · ${res.stats.routes} screens · ${res.stats.menuItems} menu items`, 'ok')
        if (!alive()) return
        setResult(res)
        setPhase('done')
        return
      }

      // Live attempt, then honest fallback to the built-in sample that
      // matches the pasted URL (Swiggy URL → Swiggy-style sample, else
      // the Zomato-style sample) — labelled SAMPLE below.
      pushLog('[1/4] GET public page (unauthenticated, no cookies)…', 'info')
      let html: string | null = null
      const sample = sampleForUrl(targetUrl)
      let bundles = sample.bundles
      let analysedFrom: 'live' | 'sample' = 'sample'
      let fetchNote: string | null = null
      try {
        const live = await fetchPublicPage(targetUrl)
        html = live.html
        bundles = live.bundles
        analysedFrom = 'live'
        pushLog(`[1/4] page fetched — ${(html.length / 1024).toFixed(1)} KB HTML, ${bundles.length} same-origin JS bundles`, 'ok')
      } catch (err) {
        if (err instanceof FetchBlockedError) {
          pushLog(`[!] live fetch blocked: ${err.message}`, 'warn')
          pushLog(`[!] falling back to the built-in ${sample.label} sample page — labelled SAMPLE below, never presented as live`, 'warn')
          fetchNote = err.message
          html = sample.html
        } else {
          pushLog(`[!] live fetch failed: ${err instanceof Error ? err.message : String(err)}`, 'err')
          pushLog(`[!] falling back to the built-in ${sample.label} sample page`, 'warn')
          fetchNote = err instanceof Error ? err.message : 'live fetch failed'
          html = sample.html
        }
      }
      await sleep(350)
      if (!alive()) return

      pushLog('[2/4] parsing HTML — title, links, JSON-LD, inline scripts…', 'info')
      await sleep(450)
      if (!alive()) return
      pushLog(`[3/4] scanning ${bundles.length} JS bundles for fetch / axios / GraphQL calls…`, 'info')
      await sleep(500)
      if (!alive()) return
      const res = analyzePage(html, bundles, targetUrl, analysedFrom, fetchNote)
      pushLog(
        `[4/4] done — ${res.stats.endpoints} endpoints · ${res.stats.routes} screens · ${res.stats.menuItems} menu items · ${res.tech.length} tech fingerprints`,
        'ok',
      )
      if (!alive()) return
      setResult(res)
      setPhase('done')
    },
    [pasteMode, pastedHtml, pushLog],
  )

  const loadDemo = useCallback(() => {
    setPasteMode(false)
    const demoUrl = SAMPLES[sampleId].url
    setUrl(demoUrl)
    void runScan(demoUrl)
  }, [runScan, sampleId])

  const runSampleCard = useCallback(
    (id: SampleId) => {
      setSampleId(id)
      setPasteMode(false)
      const demoUrl = SAMPLES[id].url
      setUrl(demoUrl)
      void runScan(demoUrl)
    },
    [runScan],
  )

  return (
    <div className="relative min-h-screen bg-ink-950 font-sans text-zinc-200">
      {/* Ambient glow + vignette + refined scanlines */}
      <div className="pointer-events-none fixed inset-0 ambient-glow" aria-hidden />
      <div className="pointer-events-none fixed inset-0 vignette" aria-hidden />
      <div className="pointer-events-none fixed inset-0 z-50 scanlines" aria-hidden />

      <header className="glass sticky top-0 z-40 border-b border-ink-800">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3 px-4 py-3.5">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-emerald-500/50 bg-emerald-500/10 text-xl text-emerald-400 shadow-[0_0_24px_rgba(52,211,153,0.18)]">
              ◉
            </span>
            <div>
              <h1 className="text-lg font-bold tracking-tight text-paper">
                menu<span className="text-emerald-400">-xray</span>
              </h1>
              <p className="font-mono text-[11px] text-zinc-500">passive · public pages only</p>
            </div>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <span className="hidden rounded-full border border-ink-700 px-3 py-1 font-mono text-[10px] tracking-wide text-zinc-400 sm:block">
              NO LOGIN · NO SECRETS · NO PRIVATE API
            </span>
            <a
              href="#readme-note"
              className="rounded-full border border-ink-700 px-3 py-1 font-mono text-[10px] tracking-wide text-zinc-400 transition-colors duration-200 ease-out hover:border-emerald-500/60 hover:text-emerald-300"
            >
              LEGAL BOUNDARY ↓
            </a>
          </div>
        </div>
      </header>

      <main className="relative mx-auto max-w-6xl space-y-5 px-4 py-8">
        {/* Outcome-first hero — the console below it IS the working product */}
        {phase === 'idle' && (
          <section className="reveal pt-2 pb-1 text-center sm:pt-4">
            <p className="font-mono text-[11px] font-medium tracking-[0.28em] text-emerald-400">
              X-RAY VISION FOR FOOD APPS
            </p>
            <h2 className="mx-auto mt-4 max-w-3xl text-5xl font-extrabold leading-[1.04] tracking-tight text-paper sm:text-6xl">
              See how any food app <span className="text-emerald-400">really works.</span>
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-base leading-relaxed text-zinc-400 sm:text-lg">
              Paste a public restaurant page. In seconds, menu-xray maps its hidden APIs, page
              flow and menu data model — every claim backed by evidence.
            </p>
          </section>
        )}

        {/* URL console */}
        <section className="reveal rounded-2xl border border-ink-800 bg-ink-900/80 p-4 shadow-[0_24px_60px_-24px_rgba(0,0,0,0.8)] sm:p-5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-emerald-400">❯</span>
            <input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void runScan(url)
              }}
              placeholder="https://www.zomato.com/salem/your-restaurant/order"
              className="min-w-0 flex-1 rounded-lg border border-ink-700 bg-ink-950 px-3 py-2.5 font-mono text-sm text-zinc-100 outline-none transition-colors duration-200 ease-out placeholder:text-zinc-600 focus:border-emerald-500"
              aria-label="Public restaurant page URL"
              disabled={phase === 'scanning'}
            />
            <button
              onClick={() => void runScan(url)}
              disabled={phase === 'scanning' || !url.trim()}
              className="rounded-lg bg-emerald-500 px-5 py-2.5 text-sm font-bold text-ink-950 transition-all duration-200 ease-out hover:bg-emerald-400 hover:shadow-[0_8px_24px_-6px_rgba(52,211,153,0.5)] active:scale-[0.98] disabled:opacity-50"
            >
              {phase === 'scanning' ? 'SCANNING…' : 'SCAN ▸'}
            </button>
            <button
              onClick={loadDemo}
              disabled={phase === 'scanning'}
              className="rounded-lg border border-emerald-500/60 px-4 py-2.5 text-sm font-bold text-emerald-300 transition-all duration-200 ease-out hover:bg-emerald-500/10 active:scale-[0.98] disabled:opacity-50"
            >
              ▶ RUN DEMO
            </button>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px]">
            <span className="font-mono text-zinc-500">Try:</span>
            {DEMO_TARGETS.map((d) => (
              <button
                key={d.label}
                onClick={() => {
                  setUrl(d.url)
                  setPasteMode(false)
                  void runScan(d.url)
                }}
                disabled={phase === 'scanning'}
                className="rounded-full border border-ink-700 px-2.5 py-1 text-zinc-300 transition-colors duration-200 ease-out hover:border-emerald-500/60 hover:text-emerald-300 disabled:opacity-50"
                title={d.note}
              >
                {d.label}
              </button>
            ))}
            <button
              onClick={() => setPasteMode((v) => !v)}
              className="ml-auto rounded-full border border-ink-700 px-2.5 py-1 text-zinc-400 transition-colors duration-200 ease-out hover:border-emerald-500/60 hover:text-emerald-300"
            >
              {pasteMode ? '✕ hide paste-HTML' : 'or paste page HTML instead'}
            </button>
          </div>

          {pasteMode && (
            <textarea
              value={pastedHtml}
              onChange={(e) => setPastedHtml(e.target.value)}
              rows={5}
              placeholder="Paste a saved page's HTML here (View Source → copy). The analyser runs on it locally — nothing is uploaded."
              className="mt-3 w-full rounded-lg border border-ink-700 bg-ink-950 p-3 font-mono text-xs text-zinc-200 outline-none transition-colors duration-200 ease-out placeholder:text-zinc-600 focus:border-emerald-500"
            />
          )}
        </section>

        {/* Sample picker — two real demos, one tap each */}
        {phase === 'idle' && (
          <section className="reveal" style={{ animationDelay: '90ms' }}>
            <p className="mb-2 text-center font-mono text-[11px] tracking-[0.2em] text-zinc-500">
              OR RUN A BUILT-IN SAMPLE — FULLY OFFLINE
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              {SAMPLE_CARDS.map((card) => {
                const selected = sampleId === card.id
                return (
                  <button
                    key={card.id}
                    onClick={() => runSampleCard(card.id)}
                    className={`group rounded-2xl border p-4 text-left transition-all duration-200 ease-out active:scale-[0.99] ${
                      selected
                        ? 'border-emerald-500/60 bg-emerald-500/[0.07] shadow-[0_0_32px_-8px_rgba(52,211,153,0.35)]'
                        : 'border-ink-800 bg-ink-900/60 hover:border-emerald-500/40 hover:bg-ink-900'
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <span className="text-lg font-extrabold tracking-tight text-paper">
                        {card.brand}
                      </span>
                      <span className="rounded-full border border-ink-700 px-2 py-0.5 font-mono text-[10px] text-zinc-400">
                        SAMPLE
                      </span>
                      <span className="ml-auto font-mono text-xs text-emerald-400 opacity-0 transition-opacity duration-200 ease-out group-hover:opacity-100">
                        RUN →
                      </span>
                    </span>
                    <span className="mt-1 block text-sm text-zinc-300">{card.place}</span>
                    <span className="mt-2 block font-mono text-[11px] text-zinc-500">{card.stats}</span>
                  </button>
                )
              })}
            </div>
            <div className="mt-4 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-zinc-500">
              <span><span className="font-semibold text-zinc-300">API map</span> — hidden endpoints, grouped</span>
              <span><span className="font-semibold text-zinc-300">Page flow</span> — screens &amp; navigation</span>
              <span><span className="font-semibold text-zinc-300">Menu model</span> — dishes, prices, shape</span>
              <span><span className="font-semibold text-zinc-300">Evidence</span> — seen / inferred / unknown</span>
            </div>
          </section>
        )}

        {/* Scanner terminal */}
        {(phase === 'scanning' || log.length > 0) && (
          <section className="reveal overflow-hidden rounded-2xl border border-ink-800 bg-ink-950 shadow-[0_24px_60px_-24px_rgba(0,0,0,0.8)]">
            <div className="flex items-center gap-2 border-b border-ink-800 px-4 py-2.5">
              <span className="h-2.5 w-2.5 rounded-full bg-red-500/80" />
              <span className="h-2.5 w-2.5 rounded-full bg-amber-400/80" />
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-500/80" />
              <span className="ml-2 font-mono text-[11px] text-zinc-500">menu-xray — scanner</span>
              {phase === 'scanning' && <span className="ml-auto animate-pulse font-mono text-[11px] text-emerald-400">● SCANNING</span>}
              {phase === 'done' && <span className="ml-auto font-mono text-[11px] text-emerald-400">✓ COMPLETE</span>}
            </div>
            <div className="h-1 w-full bg-ink-900">
              <div className={phase === 'scanning' ? 'scan-bar h-1 bg-emerald-500' : 'h-1 w-full bg-emerald-500'} />
            </div>
            <div className="max-h-56 overflow-y-auto p-4 font-mono text-[12.5px] leading-relaxed">
              {log.map((line, i) => (
                <div
                  key={i}
                  className={
                    line.kind === 'ok'
                      ? 'text-emerald-300'
                      : line.kind === 'warn'
                        ? 'text-amber-300'
                        : line.kind === 'err'
                          ? 'text-red-300'
                          : 'text-zinc-400'
                  }
                >
                  {line.text}
                </div>
              ))}
              {phase === 'scanning' && <span className="cursor-blink text-emerald-400">▌</span>}
            </div>
          </section>
        )}

        {/* Results */}
        {phase === 'done' && result && (
          <section className="reveal space-y-4">
            {/* Source banner + bento stats */}
            <div className="rounded-2xl border border-ink-800 bg-ink-900/80 p-4 shadow-[0_24px_60px_-24px_rgba(0,0,0,0.8)] sm:p-5">
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`rounded-full border px-2.5 py-0.5 font-mono text-[11px] font-bold ${
                    result.analysedFrom === 'live'
                      ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-300'
                      : 'border-amber-500/50 bg-amber-500/10 text-amber-300'
                  }`}
                >
                  {result.analysedFrom === 'live' ? '● LIVE FETCH' : '● SAMPLE PAGE'}
                </span>
                <span className="min-w-0 flex-1 truncate text-sm font-medium text-zinc-200">
                  {result.restaurantName ?? result.pageTitle ?? result.inputUrl}
                </span>
                <span className="font-mono text-[11px] text-zinc-500">{result.scannedAt.slice(0, 19).replace('T', ' ')}</span>
                <button
                  onClick={() => downloadJson(result)}
                  className="rounded-lg border border-ink-700 px-3 py-1.5 text-[11px] font-bold text-zinc-200 transition-all duration-200 ease-out hover:-translate-y-px hover:border-emerald-500/60 hover:text-emerald-300 active:scale-[0.98]"
                >
                  ⬇ EXPORT JSON
                </button>
                <button
                  onClick={() => downloadMarkdown(result)}
                  className="rounded-lg border border-ink-700 px-3 py-1.5 text-[11px] font-bold text-zinc-200 transition-all duration-200 ease-out hover:-translate-y-px hover:border-emerald-500/60 hover:text-emerald-300 active:scale-[0.98]"
                  title="Human-readable report: API map, page flow, menu, tech and evidence — as Markdown"
                >
                  ⬇ EXPORT MD
                </button>
              </div>
              {result.fetchNote && (
                <p className="mt-3 rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs leading-relaxed text-amber-200/90">
                  Live fetch was blocked, so this is the built-in sample (a realistic restaurant
                  page, hand-written demo data — not a live fetch). Reason: {result.fetchNote}
                </p>
              )}
              <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
                {[
                  ['ENDPOINTS', String(result.stats.endpoints), 'span'],
                  ['SCREENS', String(result.stats.routes), ''],
                  ['MENU ITEMS', String(result.stats.menuItems), ''],
                  ['JS BUNDLES', String(result.stats.jsBundles), ''],
                  ['HTML', `${(result.stats.htmlBytes / 1024).toFixed(1)} KB`, ''],
                  ['TECH', result.tech.length ? result.tech.map((t) => t.name).join(', ') : '—', 'span'],
                ].map(([label, value, span]) => (
                  <div
                    key={label}
                    className={`rounded-xl border border-ink-800 bg-ink-950/70 px-4 py-3 transition-colors duration-200 ease-out hover:border-ink-600 ${
                      span ? 'col-span-2' : ''
                    }`}
                  >
                    <div className="font-mono text-[9px] font-semibold tracking-[0.18em] text-zinc-500">{label}</div>
                    <div
                      className={`mt-1 truncate font-mono font-bold text-paper ${
                        label === 'ENDPOINTS' ? 'text-3xl text-emerald-400' : 'text-sm'
                      }`}
                      title={String(value)}
                    >
                      {value}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Tabs */}
            <div className="flex flex-wrap gap-1 rounded-xl border border-ink-800 bg-ink-900/60 p-1">
              {TABS.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  className={`flex-1 whitespace-nowrap rounded-lg px-3 py-2 text-xs font-bold tracking-wide transition-all duration-200 ease-out active:scale-[0.98] ${
                    tab === t.id ? 'bg-emerald-500 text-ink-950 shadow-[0_8px_20px_-8px_rgba(52,211,153,0.6)]' : 'text-zinc-400 hover:bg-ink-800 hover:text-zinc-200'
                  }`}
                >
                  {t.label}
                  {t.id === 'api' && ` (${result.stats.endpoints})`}
                  {t.id === 'model' && ` (${result.stats.menuItems})`}
                </button>
              ))}
            </div>

            {tab === 'api' && <ApiMap result={result} />}
            {tab === 'flow' && <FlowMap result={result} />}
            {tab === 'model' && <DataModel result={result} />}
            {tab === 'ask' && <AskPanel result={result} />}

            <EvidenceLedger evidence={result.evidence} />
          </section>
        )}

        {/* Legal boundary */}
        <footer id="readme-note" className="rounded-2xl border border-ink-800 bg-ink-900/60 p-5 text-xs leading-relaxed text-zinc-400">
          <div className="font-bold tracking-wider text-zinc-200">LEGAL BOUNDARY — READ THIS</div>
          <p className="mt-1">
            menu-xray analyses <strong className="text-zinc-200">public pages and public JavaScript only</strong>,
            with unauthenticated GET requests. No login, no private data, no credentials, no calls to
            a target&apos;s private API, no bypassing of protections, no scraped secrets. If a page
            needs login or blocks the read, the tool says so and stops — it never works around the
            block. Use it for learning, interoperability research and understanding apps you build
            or are authorised to examine. Full details in the README.
          </p>
        </footer>
      </main>
    </div>
  )
}
