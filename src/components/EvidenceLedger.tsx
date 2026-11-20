import type { Evidence } from '../lib/types'

const STATUS_STYLE: Record<string, string> = {
  seen: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40',
  inferred: 'bg-amber-500/15 text-amber-300 border-amber-500/40',
  unknown: 'bg-red-500/15 text-red-300 border-red-500/40',
}

const STATUS_LABEL: Record<string, string> = {
  seen: 'SEEN',
  inferred: 'INFERRED',
  unknown: 'UNKNOWN',
}

export function EvidenceLedger({ evidence, title }: { evidence: Evidence[]; title?: string }) {
  if (evidence.length === 0) return null
  return (
    <div className="rounded-xl border border-ink-800 bg-ink-950/70">
      <div className="border-b border-ink-800 px-4 py-2 text-[11px] font-semibold tracking-[0.2em] text-zinc-400">
        {title ?? 'EVIDENCE LEDGER — EVERY CLAIM, SOURCED'}
      </div>
      <ul className="divide-y divide-ink-800/80">
        {evidence.map((e, i) => (
          <li key={i} className="px-4 py-3">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`rounded border px-1.5 py-0.5 font-mono text-[10px] font-bold ${STATUS_STYLE[e.status]}`}
              >
                {STATUS_LABEL[e.status]}
              </span>
              <span className="text-sm text-zinc-200">{e.claim}</span>
              <span className="ml-auto font-mono text-xs text-zinc-500">{e.confidence}%</span>
            </div>
            <div className="mt-1 pl-1 font-mono text-[11px] leading-relaxed text-zinc-500">
              <span className="text-zinc-400">{e.source}</span>
              {' — '}
              <span className="break-all">{e.snippet}</span>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
