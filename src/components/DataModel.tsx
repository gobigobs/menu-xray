import type { AnalysisResult } from '../lib/types'

/** Menu data model — categories + items, plus the inferred data shape. */
export function DataModel({ result }: { result: AnalysisResult }) {
  if (result.items.length === 0) {
    return (
      <div className="rounded-xl border border-ink-800 bg-ink-950/70 p-6 text-sm text-zinc-400">
        No menu items could be extracted from this page. The analyser looks for schema.org
        JSON-LD menus, embedded JSON (e.g. __NEXT_DATA__), and menu-item markup — none of
        them were present here.
      </div>
    )
  }

  const priced = result.items.filter((i) => i.price != null)
  const min = priced.length ? Math.min(...priced.map((i) => i.price as number)) : null
  const max = priced.length ? Math.max(...priced.map((i) => i.price as number)) : null

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        {[
          ['CATEGORIES', String(result.categories.length)],
          ['ITEMS', String(result.items.length)],
          ['CHEAPEST', min != null ? `₹${min}` : '—'],
          ['PRICIEST', max != null ? `₹${max}` : '—'],
        ].map(([label, value]) => (
          <div key={label} className="rounded-xl border border-ink-800 bg-ink-950/70 p-3 transition-colors duration-200 ease-out hover:border-ink-600">
            <div className="text-[10px] font-semibold tracking-[0.2em] text-zinc-500">{label}</div>
            <div className="mt-1 font-mono text-xl font-bold text-emerald-300">{value}</div>
          </div>
        ))}
      </div>

      {result.categories.map((cat) => (
        <div key={cat.name} className="rounded-xl border border-ink-800 bg-ink-950/70">
          <div className="flex items-center gap-2 border-b border-ink-800 px-4 py-2">
            <span className="font-mono text-sm font-bold text-zinc-100">{cat.name}</span>
            <span className="ml-auto font-mono text-[11px] text-zinc-500">{cat.itemCount} items</span>
          </div>
          <ul className="divide-y divide-ink-800/70">
            {cat.items.map((item, i) => (
              <li key={i} className="flex items-baseline gap-3 px-4 py-2.5">
                <span className="text-sm text-zinc-200">{item.name}</span>
                {item.veg === true && (
                  <span className="rounded border border-emerald-500/50 px-1 text-[10px] font-bold text-emerald-300">VEG</span>
                )}
                {item.veg === false && (
                  <span className="rounded border border-red-500/50 px-1 text-[10px] font-bold text-red-300">NON-VEG</span>
                )}
                <span className="ml-auto shrink-0 font-mono text-sm font-bold text-emerald-300">
                  {item.price != null ? `₹${item.price}` : '—'}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ))}

      <div className="rounded-xl border border-ink-800 bg-ink-950/70 p-4">
        <div className="mb-2 text-[11px] font-semibold tracking-[0.2em] text-zinc-400">
          INFERRED DATA MODEL — WHAT THE APP&apos;S MENU LOOKS LIKE
        </div>
        <pre className="overflow-x-auto font-mono text-xs leading-relaxed text-zinc-300">{`Restaurant {
  id: number            // e.g. 18472931 (from __NEXT_DATA__ / menu URL)
  name: string
  cuisines: string[]    // ["Burgers", "Fast Food", ...]
  rating: number
  menu: MenuSection[]
}
MenuSection {
  name: string          // "Smash Burgers"
  items: MenuItem[]
}
MenuItem {
  name: string
  description: string
  price: number         // INR, from offers.price
  veg: boolean | null
}`}</pre>
        <p className="mt-2 text-xs text-zinc-500">
          Inferred from the extracted items + the menu endpoint shape. Fields marked from
          structured data are seen; the rest is the simplest shape that fits what was found.
        </p>
      </div>
    </div>
  )
}
