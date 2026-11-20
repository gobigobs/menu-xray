import type { AnalysisResult } from '../lib/types'

/** Page-flow map — screens as nodes, inferred navigation as labelled edges. */
export function FlowMap({ result }: { result: AnalysisResult }) {
  const byId = new Map(result.routes.map((r) => [r.id, r]))

  if (result.routes.length === 0) {
    return (
      <div className="rounded-xl border border-ink-800 bg-ink-950/70 p-6 text-sm text-zinc-400">
        No app screens could be mapped from this page.
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-ink-800 bg-ink-950/70 p-4">
        <div className="mb-3 text-[11px] font-semibold tracking-[0.2em] text-zinc-400">
          SCREENS FOUND — {result.routes.length}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {result.routes.map((route, i) => (
            <span key={route.id} className="flex items-center gap-2">
              {i > 0 && <span className="font-mono text-zinc-600">→</span>}
              <span
                className="bloom rounded-xl border border-ink-700 bg-ink-900 px-3 py-2 font-mono text-xs text-zinc-200 transition-colors duration-200 ease-out hover:border-emerald-500/50"
                style={{ animationDelay: `${i * 80}ms` }}
                title={`Source: ${route.source}`}
              >
                <span className="block font-bold text-emerald-300">{route.label}</span>
                <span className="block text-[11px] text-zinc-500">{route.path}</span>
              </span>
            </span>
          ))}
        </div>
        <p className="mt-3 text-xs leading-relaxed text-zinc-500">
          Screen order follows the order links and route strings were found in the page — it is
          the app&apos;s navigation structure, not a recorded user session.
        </p>
      </div>

      <div className="rounded-xl border border-ink-800 bg-ink-950/70 p-4">
        <div className="mb-3 text-[11px] font-semibold tracking-[0.2em] text-zinc-400">
          INFERRED FLOWS — {result.flowEdges.length}
        </div>
        {result.flowEdges.length === 0 ? (
          <p className="text-sm text-zinc-400">
            Only one screen was found, so no flows could be inferred between screens.
          </p>
        ) : (
          <ul className="space-y-2">
            {result.flowEdges.map((edge, i) => {
              const from = byId.get(edge.from)
              const to = byId.get(edge.to)
              if (!from || !to) return null
              return (
                <li key={i} className="flex flex-wrap items-center gap-2 font-mono text-xs">
                  <span className="rounded bg-ink-900 px-2 py-1 text-zinc-200">{from.path}</span>
                  <span className="text-emerald-400">── {edge.label} ──▶</span>
                  <span className="rounded bg-ink-900 px-2 py-1 text-zinc-200">{to.path}</span>
                  <span className="rounded border border-amber-500/40 bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-bold text-amber-300">
                    INFERRED · 70%
                  </span>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}
