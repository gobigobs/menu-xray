/**
 * Export a finished x-ray as a downloadable file.
 *
 * Two formats, both generated locally from the AnalysisResult — nothing
 * leaves the browser:
 *   - JSON: the full result object, verbatim (what ⬇ EXPORT JSON already did).
 *   - Markdown: a human-readable report — source, stats, endpoints grouped
 *     by feature, page flow, menu data model, tech fingerprints and the
 *     evidence ledger. Built for pasting into notes / a ticket.
 *
 * Pure functions (no DOM) except `downloadTextFile`, which is the single
 * browser-only helper — so `toMarkdown` / `toJson` are unit-testable in
 * Node alongside the analyser.
 */
import type { AnalysisResult } from './types'

export function reportFilename(result: AnalysisResult, ext: 'json' | 'md'): string {
  const slug = (result.restaurantName ?? result.pageTitle ?? 'menu-xray')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
  const date = result.scannedAt.slice(0, 10)
  return `menu-xray-${slug || 'report'}-${date}.${ext}`
}

export function toJson(result: AnalysisResult): string {
  return JSON.stringify(result, null, 2)
}

function mdHeading(text: string, level = 2): string {
  return `${'#'.repeat(level)} ${text}`
}

export function toMarkdown(result: AnalysisResult): string {
  const lines: string[] = []
  const name = result.restaurantName ?? result.pageTitle ?? result.inputUrl

  lines.push(`# menu-xray — ${name}`)
  lines.push('')
  lines.push(`- **Source:** ${result.inputUrl}`)
  lines.push(`- **Analysed from:** ${result.analysedFrom === 'live' ? 'live fetch' : 'built-in sample page'}`)
  if (result.fetchNote) lines.push(`- **Fetch note:** ${result.fetchNote}`)
  lines.push(`- **Scanned at:** ${result.scannedAt}`)
  lines.push(
    `- **Stats:** ${result.stats.endpoints} endpoints · ${result.stats.routes} screens · ` +
      `${result.stats.menuItems} menu items · ${result.stats.jsBundles} JS bundles ` +
      `(${(result.stats.jsBytes / 1024).toFixed(1)} KB) · ${(result.stats.htmlBytes / 1024).toFixed(1)} KB HTML`,
  )
  lines.push('')

  // Endpoints, grouped by feature.
  lines.push(mdHeading('API map'))
  lines.push('')
  if (result.endpoints.length === 0) {
    lines.push('_No API endpoints were found in the public page or its public JS._')
  } else {
    const groups = [...new Set(result.endpoints.map((e) => e.group))]
    for (const group of groups) {
      lines.push(mdHeading(group, 3))
      lines.push('')
      for (const ep of result.endpoints.filter((e) => e.group === group)) {
        const op = ep.operationName ? ` — GraphQL \`${ep.operationName}\`` : ''
        const params = ep.queryParams?.length ? ` — params: ${ep.queryParams.join(', ')}` : ''
        lines.push(`- \`${ep.method} ${ep.path}\`${op}${params} _(found in ${ep.sourceFile})_`)
      }
      lines.push('')
    }
  }

  // Page flow.
  lines.push(mdHeading('Page flow'))
  lines.push('')
  if (result.routes.length === 0) {
    lines.push('_No app screens could be mapped._')
  } else {
    for (const route of result.routes) {
      lines.push(`- \`${route.path}\` — ${route.label}`)
    }
    if (result.flowEdges.length > 0) {
      lines.push('')
      lines.push('Inferred flows:')
      for (const edge of result.flowEdges) {
        const from = result.routes.find((r) => r.id === edge.from)
        const to = result.routes.find((r) => r.id === edge.to)
        lines.push(`- \`${from?.path ?? edge.from}\` → \`${to?.path ?? edge.to}\` — ${edge.label}`)
      }
    }
  }
  lines.push('')

  // Menu data model.
  lines.push(mdHeading('Menu data model'))
  lines.push('')
  if (result.categories.length === 0) {
    lines.push('_No menu items could be extracted from this page._')
  } else {
    for (const cat of result.categories) {
      lines.push(mdHeading(`${cat.name} (${cat.itemCount})`, 3))
      lines.push('')
      for (const item of cat.items) {
        const price = item.price != null ? `₹${item.price}` : 'price not found'
        const veg = item.veg === true ? ' · veg' : item.veg === false ? ' · non-veg' : ''
        const desc = item.description ? ` — ${item.description}` : ''
        lines.push(`- **${item.name}** — ${price}${veg}${desc}`)
      }
      lines.push('')
    }
  }

  // Tech fingerprints.
  lines.push(mdHeading('Tech fingerprints'))
  lines.push('')
  if (result.tech.length === 0) {
    lines.push('_No recognisable tech fingerprints found._')
  } else {
    for (const t of result.tech) {
      lines.push(`- **${t.name}** (${t.confidence}%) — ${t.evidence}`)
    }
  }
  lines.push('')

  // Evidence ledger.
  lines.push(mdHeading('Evidence ledger'))
  lines.push('')
  if (result.evidence.length === 0) {
    lines.push('_No evidence recorded._')
  } else {
    for (const ev of result.evidence) {
      lines.push(`- **[${ev.status.toUpperCase()}]** ${ev.claim} (${ev.confidence}%) — _${ev.source}: ${ev.snippet}_`)
    }
  }
  lines.push('')
  lines.push('---')
  lines.push('')
  lines.push(
    '_Generated by menu-xray — passive analysis of a public page and its public JS only. ' +
      'No login, no private data, no secrets._',
  )
  lines.push('')

  return lines.join('\n')
}

/** Browser-only helper: trigger a download of in-memory text. */
export function downloadTextFile(filename: string, content: string, mime: string): void {
  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
