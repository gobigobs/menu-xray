import { useMemo } from 'react'
import type { AnalysisResult, FeatureGroup } from '../lib/types'

const GROUP_COLORS: Record<FeatureGroup, string> = {
  menu: '#34d399',
  search: '#38bdf8',
  cart: '#fbbf24',
  checkout: '#f472b6',
  order: '#a78bfa',
  reviews: '#facc15',
  photos: '#fb923c',
  auth: '#f87171',
  tracking: '#2dd4bf',
  media: '#94a3b8',
  other: '#71717a',
}

const METHOD_STYLE: Record<string, string> = {
  GET: 'bg-emerald-500/20 text-emerald-300',
  POST: 'bg-amber-500/20 text-amber-300',
  PUT: 'bg-sky-500/20 text-sky-300',
  PATCH: 'bg-sky-500/20 text-sky-300',
  DELETE: 'bg-red-500/20 text-red-300',
  GRAPHQL: 'bg-fuchsia-500/20 text-fuchsia-300',
  UNKNOWN: 'bg-zinc-500/20 text-zinc-300',
}

/**
 * Interactive API map — an SVG node graph that "blooms" when the scan
 * finishes. Layout is deterministic (group columns, stacked endpoints),
 * no graph library, no layout engine to fail.
 */
export function ApiMap({ result }: { result: AnalysisResult }) {
  const groups = useMemo(() => {
    const map = new Map<FeatureGroup, typeof result.endpoints>()
    for (const ep of result.endpoints) {
      const list = map.get(ep.group) ?? []
      list.push(ep)
      map.set(ep.group, list)
    }
    return [...map.entries()]
  }, [result.endpoints])

  if (result.endpoints.length === 0) {
    return (
      <div className="rounded-xl border border-ink-800 bg-ink-950/70 p-6 text-sm text-zinc-400">
        No API endpoints were found in this page or its public JS bundles. The page may be
        server-rendered with no client API calls, or its calls live in a bundle this scan did
        not fetch. The menu data model and page-flow tabs may still have results.
      </div>
    )
  }

  const COL_W = 250
  const ROW_H = 62
  const HEADER_H = 46
  const maxRows = Math.max(...groups.map(([, eps]) => eps.length))
  const width = 190 + groups.length * COL_W
  const height = Math.max(240, HEADER_H + maxRows * ROW_H + 40)
  const pageY = height / 2

  return (
    <div className="overflow-x-auto rounded-xl border border-ink-800 bg-ink-950/70 p-2">
      <svg
        width={width}
        height={height}
        role="img"
        aria-label={`API map: ${result.endpoints.length} endpoints in ${groups.length} groups`}
        className="min-w-full"
      >
        {/* Page node */}
        <g className="bloom" style={{ animationDelay: '0ms' }}>
          <rect x={12} y={pageY - 26} width={160} height={52} rx={10} fill="#0a0b0c" stroke="#34d399" strokeWidth={1.5} />
          <text x={92} y={pageY - 4} textAnchor="middle" fill="#34d399" fontSize={11} fontFamily="monospace" fontWeight="bold">
            PUBLIC PAGE
          </text>
          <text x={92} y={pageY + 13} textAnchor="middle" fill="#a1a1aa" fontSize={10} fontFamily="monospace">
            {(() => {
              try {
                return new URL(result.inputUrl).host
              } catch {
                return 'pasted page'
              }
            })()}
          </text>
        </g>

        {groups.map(([group, eps], gi) => {
          const colX = 190 + gi * COL_W
          const color = GROUP_COLORS[group]
          return (
            <g key={group}>
              {/* Group header */}
              <g className="bloom" style={{ animationDelay: `${120 + gi * 90}ms` }}>
                <rect x={colX} y={10} width={COL_W - 16} height={26} rx={6} fill={color + '22'} stroke={color} strokeOpacity={0.6} />
                <text x={colX + 12} y={28} fill={color} fontSize={11} fontFamily="monospace" fontWeight="bold">
                  {group.toUpperCase()} · {eps.length}
                </text>
              </g>
              {eps.map((ep, ei) => {
                const y = HEADER_H + ei * ROW_H
                const cy = y + 22
                return (
                  <g key={ep.id} className="bloom" style={{ animationDelay: `${250 + gi * 90 + ei * 70}ms` }}>
                    <path
                      d={`M 172 ${pageY} C ${colX - 40} ${pageY}, ${colX - 40} ${cy}, ${colX} ${cy}`}
                      fill="none"
                      stroke={color}
                      strokeOpacity={0.45}
                      strokeWidth={1.2}
                    />
                    <rect x={colX} y={y} width={COL_W - 16} height={46} rx={8} fill="#121317" stroke="#2a2e35" />
                    <rect x={colX} y={y} width={3} height={46} rx={1.5} fill={color} />
                    <text x={colX + 12} y={y + 19} fill="#e4e4e7" fontSize={11} fontFamily="monospace" fontWeight="bold">
                      {ep.method}
                      {ep.operationName ? ` · ${ep.operationName}` : ''}
                    </text>
                    <text x={colX + 12} y={y + 36} fill="#a1a1aa" fontSize={10.5} fontFamily="monospace">
                      {ep.path.length > 34 ? ep.path.slice(0, 33) + '…' : ep.path}
                    </text>
                    <title>{`${ep.method} ${ep.path}\nSource: ${ep.sourceFile}\n${ep.snippet}`}</title>
                  </g>
                )
              })}
            </g>
          )
        })}
      </svg>

      {/* Detail list — the map is also readable as text */}
      <div className="mt-2 grid gap-2 px-2 pb-2 md:grid-cols-2">
        {groups.map(([group, eps]) => (
          <div key={group} className="rounded-xl border border-ink-800 bg-ink-900/40 p-3 transition-colors duration-200 ease-out hover:border-ink-600">
            <div className="mb-2 flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: GROUP_COLORS[group] }} />
              <span className="font-mono text-xs font-bold uppercase tracking-wider text-zinc-200">{group}</span>
              <span className="ml-auto font-mono text-[11px] text-zinc-500">{eps.length} endpoint{eps.length === 1 ? '' : 's'}</span>
            </div>
            <ul className="space-y-1.5">
              {eps.map((ep) => (
                <li key={ep.id} className="font-mono text-[11px] leading-relaxed">
                  <span className={`mr-2 rounded px-1.5 py-0.5 text-[10px] font-bold ${METHOD_STYLE[ep.method]}`}>
                    {ep.method}
                  </span>
                  <span className="break-all text-zinc-300">{ep.path}</span>
                  <span className="block truncate pl-1 text-zinc-600">↳ {ep.sourceFile}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  )
}
