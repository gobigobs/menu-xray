import { useEffect, useState } from 'react'
import type { AnalysisResult, ExplainerAnswer } from '../lib/types'
import { SUGGESTED_QUESTIONS, answerQuestion } from '../lib/explainer'
import {
  OLLAMA_MODEL,
  askOllama,
  checkOllamaAvailable,
  type OllamaAnswer,
  type OllamaStatus,
} from '../lib/ollama'
import { EvidenceLedger } from './EvidenceLedger'

const STATUS_STYLE: Record<ExplainerAnswer['status'], string> = {
  answered: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40',
  partial: 'bg-amber-500/15 text-amber-300 border-amber-500/40',
  unresolved: 'bg-red-500/15 text-red-300 border-red-500/40',
}

/**
 * "Ask how it works" — rule-based, evidence-grounded explainer, with an
 * OPTIONAL local-AI second voice (Ollama, on this machine only).
 *
 * The rule-based answer is always shown and is the source of truth: it is
 * built only from what the scan found, instantly, with no network. When
 * Ollama is detected the toggle offers a freer prose rewrite from the
 * same evidence — and any endpoint path the model mentions that the scan
 * did NOT find is flagged, never shown as fact. If Ollama is not running,
 * the toggle is off and the panel works exactly as before.
 */
export function AskPanel({ result }: { result: AnalysisResult }) {
  const [question, setQuestion] = useState('')
  const [answer, setAnswer] = useState<ExplainerAnswer | null>(null)
  const [ollama, setOllama] = useState<OllamaStatus | null>(null)
  const [aiEnabled, setAiEnabled] = useState(false)
  const [aiAnswer, setAiAnswer] = useState<OllamaAnswer | null>(null)
  const [aiState, setAiState] = useState<'idle' | 'thinking' | 'error'>('idle')
  const [aiError, setAiError] = useState<string | null>(null)

  // Probe once on open: is a local Ollama server there?
  useEffect(() => {
    let alive = true
    void checkOllamaAvailable().then((status) => {
      if (!alive) return
      setOllama(status)
      // Default the AI voice on only when the server is actually there.
      if (status.available) setAiEnabled(true)
    })
    return () => {
      alive = false
    }
  }, [])

  const ask = (q: string) => {
    if (!q.trim()) return
    setQuestion(q)
    setAnswer(answerQuestion(result, q))
    setAiAnswer(null)
    setAiError(null)
    if (aiEnabled && ollama?.available) {
      setAiState('thinking')
      void askOllama(q, result)
        .then((a) => {
          setAiAnswer(a)
          setAiState('idle')
        })
        .catch((err: unknown) => {
          setAiError(err instanceof Error ? err.message : 'Ollama did not answer.')
          setAiState('error')
        })
    } else {
      setAiState('idle')
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-ink-800 bg-ink-950/70 p-4">
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <span className="text-[11px] font-semibold tracking-[0.2em] text-zinc-400">
            ASK HOW IT WORKS — ANSWERED ONLY FROM WHAT WAS FOUND
          </span>
          <label className="ml-auto flex cursor-pointer items-center gap-2 text-[11px] text-zinc-300">
            <input
              type="checkbox"
              checked={aiEnabled}
              disabled={!ollama?.available}
              onChange={(e) => setAiEnabled(e.target.checked)}
              className="h-3.5 w-3.5 accent-emerald-500"
            />
            ✦ AI voice (local Ollama · {OLLAMA_MODEL})
          </label>
        </div>
        <div className="mb-3 text-[11px] leading-relaxed text-zinc-500">
          {ollama === null ? (
            'Checking for a local Ollama server…'
          ) : ollama.available ? (
            <span className="text-emerald-300">
              ● Ollama ready on this machine
              {ollama.models.length > 0 ? ` — models: ${ollama.models.join(', ')}` : ''}. The AI
              answer below is a prose rewrite of the same evidence; the rule-based answer stays
              the source of truth.
            </span>
          ) : (
            <span className="text-zinc-500">
              ○ {ollama.reason} Start it with{' '}
              <code className="text-zinc-300">OLLAMA_ORIGINS=http://localhost:4173,http://localhost:5173 ollama serve</code>{' '}
              to enable the AI voice.
            </span>
          )}
        </div>
        <form
          className="flex flex-col gap-2 sm:flex-row"
          onSubmit={(e) => {
            e.preventDefault()
            ask(question)
          }}
        >
          <input
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder='e.g. How does menu loading work here?'
            className="min-w-0 flex-1 rounded-md border border-ink-700 bg-ink-900 px-3 py-2 font-mono text-sm text-zinc-100 outline-none transition-colors duration-200 ease-out placeholder:text-zinc-600 focus:border-emerald-500"
            aria-label="Ask how a feature works"
          />
          <button
            type="submit"
            className="rounded-md bg-emerald-500 px-4 py-2 font-mono text-sm font-bold text-ink-950 transition-all duration-200 ease-out hover:bg-emerald-400 active:scale-[0.98]"
          >
            ASK ▸
          </button>
        </form>
        <div className="mt-3 flex flex-wrap gap-2">
          {SUGGESTED_QUESTIONS.map((q) => (
            <button
              key={q}
              onClick={() => ask(q)}
              className="rounded-full border border-ink-700 bg-ink-900 px-3 py-1 font-mono text-[11px] text-zinc-300 transition-colors duration-200 ease-out hover:border-emerald-500 hover:text-emerald-300"
            >
              {q}
            </button>
          ))}
        </div>
      </div>

      {answer && (
        <div className="space-y-3">
          {/* Optional local-AI rewrite — same evidence, freer prose. */}
          {aiEnabled && ollama?.available && (
            <div className="rounded-xl border border-violet-500/40 bg-violet-500/5 p-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded border border-violet-500/40 bg-violet-500/15 px-2 py-0.5 font-mono text-[11px] font-bold text-violet-300">
                  ✦ AI VOICE — LOCAL OLLAMA · {OLLAMA_MODEL}
                </span>
                {aiState === 'thinking' && <span className="animate-pulse text-[11px] text-violet-300">● thinking on this machine…</span>}
              </div>
              {aiState === 'thinking' && !aiAnswer && (
                <p className="mt-3 text-sm leading-relaxed text-zinc-400">
                  Asking the local model — it only sees the scan evidence above, nothing else. A
                  3B model on CPU can take several minutes, especially on a busy machine; the
                  rule-based answer below is already there while you wait.
                </p>
              )}
              {aiAnswer && (
                <>
                  <p className="mt-3 text-sm leading-relaxed text-zinc-200">{aiAnswer.answer}</p>
                  {aiAnswer.unseenPaths.length > 0 ? (
                    <p className="mt-3 rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs leading-relaxed text-red-200">
                      ⚠ The model mentioned endpoint path(s) the scan did NOT find:{' '}
                      <code className="font-mono">{aiAnswer.unseenPaths.join(', ')}</code>
                      {' '}— treat those as invented, not as evidence. The rule-based answer
                      below is the verified one.
                    </p>
                  ) : (
                    <p className="mt-3 text-[11px] text-zinc-500">
                      ✓ Every endpoint path in this draft matches the scan — no invented paths detected.
                    </p>
                  )}
                </>
              )}
              {aiState === 'error' && aiError && (
                <p className="mt-3 rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs leading-relaxed text-amber-200">
                  AI voice unavailable: {aiError}
                </p>
              )}
            </div>
          )}

          <div className="rounded-xl border border-ink-800 bg-ink-950/70 p-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className={`rounded border px-2 py-0.5 font-mono text-[11px] font-bold ${STATUS_STYLE[answer.status]}`}>
                {answer.status.toUpperCase()}
              </span>
              <span className="font-mono text-sm text-zinc-100">Q: {answer.question}</span>
            </div>
            <p className="mt-3 text-sm leading-relaxed text-zinc-200">{answer.answer}</p>
            {answer.gaps.length > 0 && (
              <div className="mt-3 rounded-md border border-amber-500/30 bg-amber-500/5 p-3">
                <div className="text-[11px] font-bold tracking-wider text-amber-300">WHAT I COULD NOT FIND</div>
                <ul className="mt-1 list-disc space-y-1 pl-4 text-xs leading-relaxed text-amber-200/80">
                  {answer.gaps.map((g, i) => (
                    <li key={i}>{g}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
          <EvidenceLedger evidence={answer.evidence} title="EVIDENCE FOR THIS ANSWER" />
        </div>
      )}
    </div>
  )
}
