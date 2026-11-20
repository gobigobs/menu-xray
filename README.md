# menu-xray

> **Paste a public restaurant page. See how the app works — its hidden APIs, page flow and menu data model, in seconds, with evidence for every claim.**

[![Stack: React 18 + Vite 5 + TypeScript](https://img.shields.io/badge/stack-React%2018%20%E2%80%A2%20Vite%205%20%E2%80%A2%20TypeScript-blue)](#stack)
[![Analyser checks: 48 passing](https://img.shields.io/badge/analyser%20checks-48%20passing-brightgreen)](#verify-the-analyser-no-browser-needed)
[![Passive only](https://img.shields.io/badge/passive%20only-no%20login%20%E2%80%A2%20no%20secrets%20%E2%80%A2%20no%20private%20API-lightgrey)](#legal-boundary--read-this)
[![License: private demo](https://img.shields.io/badge/license-private%20demo-lightgrey)](#legal-boundary--read-this)

![menu-xray home — paste a URL or run a built-in sample](docs/screenshots/home.png)

menu-xray is X-ray vision for food apps. Paste the URL of any **public** restaurant page and it maps the app's **hidden API map**, **page-flow map** and **menu data model**, then explains how each feature works — with a **seen / inferred / unknown** evidence ledger behind every claim. What it could not find is stated, not guessed.

Built as the #1 idea from reverse-engineering research (`research_notes/reverse-engineering-ideas-20261117/findings.md`): the friendly, visual, AI-explained web X-ray that jshound (14★, bare CLI) proved was possible but never built a UI for.

## Quick start (30 seconds)

```bash
npm install && npm run dev   # http://localhost:5173
```

1. Pick a demo sample — **Zomato — Burger Barn** or **Swiggy — Anbu Biryani House** — and click **▶ RUN DEMO** (or paste `https://www.zomato.com/salem/burger-barn-seelanaickenpatti/order`).
2. Watch the scanner run, then the API map blooms.
3. Click a tab — **API MAP**, **PAGE FLOW**, **MENU DATA MODEL**, **ASK HOW IT WORKS** — then **⬇ EXPORT JSON** or **⬇ EXPORT MD** to keep the report.

## What a demo finds

| Sample | Endpoints | Screens | Menu items | Tech fingerprints |
|---|---|---|---|---|
| Zomato — Burger Barn, Salem | 14 (`/api/v1/…` + 1 GraphQL op) | 9 | 11 across 3 categories | Next.js, React, GraphQL, Webpack, Google Maps |
| Swiggy — Anbu Biryani House, Salem | 12 (`/dapi/…`) | 7 | 10 across 4 categories | React, Webpack |

![API map after a demo scan — 14 endpoints in 9 groups, with the evidence ledger](docs/screenshots/demo-apimap.png)

![Menu data model — dishes, prices and the inferred data shape](docs/screenshots/demo-menu.png)

## How it works

```
paste URL ──▶ GET public page (unauthenticated, no cookies)
                 │
                 ├──▶ parse HTML: title, <a> links, JSON-LD menu, inline JS
                 ├──▶ GET same-origin public JS bundles (max 6, ≤1.5 MB each)
                 ├──▶ extract endpoints: fetch / axios / $.ajax / GraphQL ops
                 ├──▶ extract routes + infer flows, extract menu data model
                 └──▶ evidence ledger: every claim tagged SEEN / INFERRED / UNKNOWN
```

All analysis runs **locally in your browser**. Nothing is sent to the target's API, and nothing is uploaded anywhere.

### Why built-in sample pages?

Browsers block cross-origin reads of most real sites (Zomato/Swiggy do not send CORS headers for public reads), so a live paste usually cannot be read from the browser at all. When that happens menu-xray says so in the scanner log and falls back to a **built-in sample** — a realistic, hand-written restaurant page — clearly labelled **SAMPLE PAGE**. The fallback picks the sample matching the pasted URL (a Swiggy URL falls back to the Swiggy-style sample). The demo therefore works fully offline, end to end.

Two other ways to analyse a real page:

- **Paste page HTML** — "or paste page HTML instead" under the URL bar. Save any public page (View Source → copy) and the analyser runs on it locally. No network involved.
- **Same-origin proxy (optional, not bundled)** — a tiny server that fetches the public page on your behalf would make live fetch work. It is deliberately not shipped: a proxy that fetches arbitrary URLs is a footgun, and the sample + paste-HTML paths cover the demo.

## The "Ask how it works" panel — honest note

The panel is a **transparent, rule-based explainer**, not a call to a hosted LLM. Every answer is assembled only from endpoints, routes and menu items the analyser actually found, and it carries its evidence with confidence scores. If the evidence is missing, the answer is `partial` or `unresolved` and the gap is listed — it never invents an endpoint, a price or a flow step.

### Optional local-AI voice (Ollama, on your machine only)

If a local Ollama server is running with the `qwen2.5:3b-instruct` model pulled, the panel shows **● Ollama ready** and an **✦ AI voice** toggle (on by default when Ollama is detected). Asking a question then also produces a prose rewrite from the same evidence, shown above the rule-based answer, which stays the source of truth. Grounding is enforced in code (`src/lib/ollama.ts`): the model only sees the scan's evidence, the prompt forbids anything not in it, and every `/api…` / `/dapi…` path in its answer is checked against the endpoints found — an unfound path is flagged as invented, never shown as fact. If Ollama is not running, the toggle is off and the panel works exactly as before.

```bash
OLLAMA_ORIGINS=http://localhost:4173,http://localhost:5173 ollama serve
ollama pull qwen2.5:3b-instruct   # once, if the model is not already pulled
```

Speed note: this is a 3B model on CPU. On a quiet machine a short answer takes well under a minute; on a heavily loaded box the same answer measured ~0.2 tokens/sec, so the panel waits up to 5 minutes and keeps the rule-based answer visible meanwhile. A hosted LLM was deliberately **not** wired in: this app ships with no API key, no server, and no data leaving the browser.

## Stack

- **React 18 + Vite 5 + TypeScript** (strict) + **Tailwind CSS v4**
- No backend, no database, no graph library — the SVG API map layout is deterministic and hand-rolled; the analyser is pure string/regex code with no DOM dependency, so it runs identically in the browser and in Node.

```
src/
  lib/
    analyzer.ts    — endpoint / route / menu / tech extraction + evidence
    explainer.ts   — rule-based, evidence-grounded Q&A
    ollama.ts      — optional local-AI explainer (Ollama qwen2.5:3b-instruct)
    export.ts      — report export: JSON + Markdown download
    fetchPage.ts   — passive live fetch (public page + same-origin JS)
    sample.ts      — built-in demo pages + sample registry (Zomato + Swiggy)
    sampleSwiggy.ts — Swiggy-style sample page + JS bundles (Anbu Biryani House)
    types.ts       — AnalysisResult, Endpoint, Evidence, …
  components/
    ApiMap.tsx     — SVG node graph (bloom animation)
    FlowMap.tsx    — screens + inferred flows
    DataModel.tsx  — menu categories/items + inferred data shape
    AskPanel.tsx   — "ask how it works" UI (+ optional Ollama AI voice)
    EvidenceLedger.tsx — SEEN / INFERRED / UNKNOWN ledger
  App.tsx          — scan state machine + scanner terminal + tabs
```

## Run it

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # typecheck + production build → dist/
npm run preview  # serve the production build on :4173
```

Node ≥ 20.

## Verify the analyser (no browser needed)

The analyser has no DOM dependency, so it can be exercised directly with Node's built-in TypeScript stripping (Node ≥ 22.6):

```bash
node --experimental-strip-types src/lib/analyzer.test.ts
```

That script analyses both built-in samples and asserts 48 checks: Zomato — 14 endpoints, 9 routes, 11 menu items in 3 categories, Next.js + React + GraphQL fingerprints; Swiggy — 12 `/dapi/` endpoints, 7 routes, 10 menu items in 4 categories, React + Webpack, no Next.js fingerprint; the explainer answers "How does checkout work here?" as `answered` with seen evidence on both; the Markdown export contains the restaurant, a real endpoint and a real price; and the Ollama grounding helpers flag an invented endpoint path while passing real ones.

The Ollama live check is separate — it needs the server running, and skips gracefully when it is not:

```bash
node --experimental-strip-types src/lib/ollama.test.ts
```

It probes `/api/tags`, confirms `qwen2.5:3b-instruct` is pulled, asks the real model the checkout question from the Zomato sample's evidence, and checks the answer names a real endpoint and contains no invented paths.

## Legal boundary — read this

menu-xray analyses **public pages and public JavaScript only**, with **unauthenticated GET requests**. It does not log in, does not touch private data, does not read or exfiltrate credentials or secrets, does not call a target's private API, and does not bypass any protection. If a page needs login or blocks the read, the tool says so and stops — it never works around the block. The sample page's `maps.googleapis.com` script tag contains a placeholder key string (`DEMO_KEY_NOT_REAL`) — it is not a real credential and is never used.

Use it for **learning, interoperability research, and understanding apps you build or are authorised to examine**. Do not use it to copy a competitor's proprietary implementation, to harvest data at scale, or against any target you are not allowed to examine. If you are unsure whether a target is fair game: if it is public, unauthenticated and you are only reading what any visitor's browser already downloads, you are inside the boundary; the moment a login, a token, a bypass or a private API is involved, you are outside it — stop.

## What it is not

- Not a scraper, crawler or data harvester — one page per scan, read-only.
- Not a secret-finder — it deliberately ignores credentials/tokens/secrets.
- Not a tech-stack detector (Wappalyzer/BuiltWith own that lane) and not a REA/Ghidra-style binary tool — it is the visual, food-first, passive web X-ray nobody had built.
- Not a clone-maker — it explains how an app works; it does not reproduce its code, assets or data.

## Roadmap (if this grows)

- Optional same-origin fetch proxy (user-run, allow-listed hosts only).
- Export map as PNG/SVG image.
- More demo targets (Atti Cafe own site) as saved samples.
