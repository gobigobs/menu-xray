/**
 * Ollama explainer verification — run with:
 *   node --experimental-strip-types src/lib/ollama.test.ts
 * (Node >= 22.6; no dependencies. Needs Ollama running on localhost:11434
 * with the qwen2.5:3b-instruct model pulled for the live checks; when the
 * server is down it reports SKIP instead of failing — the app must work
 * without Ollama, and so must this script.)
 *
 * Live checks: /api/tags answers, a real /api/generate call answers the
 * checkout question from the Zomato sample's evidence, and the answer's
 * endpoint paths all pass the unseen-paths grounding check.
 */
import { analyzePage } from './analyzer.ts'
import { SAMPLE_BUNDLES, SAMPLE_HTML, SAMPLE_URL } from './sample.ts'
import { askOllama, checkOllamaAvailable, OLLAMA_MODEL } from './ollama.ts'

let failures = 0
function check(name: string, cond: boolean, detail = '') {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`)
  if (!cond) failures++
}

const status = await checkOllamaAvailable(5000)
if (!status.available) {
  console.log(`SKIP  live Ollama checks — ${status.reason}`)
  console.log('\nSKIPPED (Ollama not running; start it with `ollama serve` to run the live checks)')
  process.exit(0)
}

check('ollama: server answers /api/tags', status.available, `models: ${status.models.join(', ') || 'none listed'}`)
check(`ollama: model ${OLLAMA_MODEL} is pulled`, status.models.some((m) => m.startsWith('qwen2.5:3b')), status.models.join(', '))

const result = analyzePage(SAMPLE_HTML, SAMPLE_BUNDLES, SAMPLE_URL, 'sample', null)
const started = Date.now()
// Short answer for the live check: on a busy CPU box a 3B model generates
// well under 1 token/sec, so 30 tokens keeps the check to a few minutes
// while still proving the full prompt → generate → parse → grounding path.
// The 15-minute client timeout covers prompt eval (~900 tokens) plus the
// queue when other local clients are also using the model.
const ai = await askOllama('How does checkout work here?', result, OLLAMA_MODEL, { numPredict: 30, timeoutMs: 900_000 })
const tookSec = ((Date.now() - started) / 1000).toFixed(1)

check('ollama: generate returns non-empty prose', ai.answer.length > 40, `${ai.answer.length} chars in ${tookSec}s`)
check(
  'ollama: answer is about checkout (short answer may cut off before the endpoint path)',
  /checkout|order|pay/i.test(ai.answer),
  ai.answer.slice(0, 160),
)
check(
  'ollama: no invented endpoint paths in the answer',
  ai.unseenPaths.length === 0,
  ai.unseenPaths.length > 0 ? `invented: ${ai.unseenPaths.join(', ')}` : 'all paths match the scan',
)

console.log(`\nAnswer (${ai.model}, ${tookSec}s):\n${ai.answer}`)
console.log(failures === 0 ? '\nALL CHECKS PASSED' : `\n${failures} CHECK(S) FAILED`)
process.exit(failures === 0 ? 0 : 1)
