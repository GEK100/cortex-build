'use client'

import { useCallback, useRef, useState } from 'react'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { LABEL_COLOURS } from '@/lib/config'

interface EventHit {
  id: string
  captured_at: string
  event_type: string
  headline: string
  snippet: string
  labels: string[]
  similarity: number | null
}
interface Results {
  events: EventHit[]
  actions: { id: string; description: string; status: string; source_kind: string; source_event_id: string }[]
  entities: { id: string; canonical_name: string; entity_type: string }[]
  decisions: { id: string; statement: string; status: string; source_event_id: string }[]
  semantic?: boolean
}

const EMPTY: Results = { events: [], actions: [], entities: [], decisions: [] }

export function SearchView() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Results>(EMPTY)
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null)

  const run = useCallback(async (q: string) => {
    if (!q.trim()) {
      setResults(EMPTY)
      setSearched(false)
      return
    }
    setLoading(true)
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`)
      if (res.ok) setResults(await res.json())
      setSearched(true)
    } finally {
      setLoading(false)
    }
  }, [])

  function onChange(v: string) {
    setQuery(v)
    if (debounce.current) clearTimeout(debounce.current)
    debounce.current = setTimeout(() => run(v), 300)
  }

  const total =
    results.events.length + results.actions.length + results.entities.length + results.decisions.length

  return (
    <div>
      <div className="border-b border-border px-4 py-3">
        <input
          autoFocus
          value={query}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Search events, people, actions, decisions…"
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
        />
        {results.semantic === false && searched && (
          <p className="mt-1 text-[10px] text-muted-foreground">Keyword only — semantic index unavailable.</p>
        )}
      </div>

      <div className="mx-auto max-w-2xl px-4 py-3">
        {loading && <p className="text-sm text-muted-foreground">Searching…</p>}
        {!loading && searched && total === 0 && (
          <p className="text-sm text-muted-foreground">Nothing found for &ldquo;{query}&rdquo;.</p>
        )}

        {results.entities.length > 0 && (
          <Group title="People & organisations">
            {results.entities.map((e) => (
              <Link key={e.id} href={`/stakeholders/${e.id}`} className="block py-1 text-sm hover:underline">
                {e.canonical_name} <span className="text-[11px] text-muted-foreground">· {e.entity_type}</span>
              </Link>
            ))}
          </Group>
        )}

        {results.actions.length > 0 && (
          <Group title="Actions">
            {results.actions.map((a) => (
              <Link key={a.id} href={`/events/${a.source_event_id}`} className="block py-1 text-sm hover:underline">
                {a.description}{' '}
                <span className="text-[11px] text-muted-foreground">· {a.source_kind} · {a.status}</span>
              </Link>
            ))}
          </Group>
        )}

        {results.decisions.length > 0 && (
          <Group title="Decisions">
            {results.decisions.map((d) => (
              <Link key={d.id} href={`/events/${d.source_event_id}`} className="block py-1 text-sm hover:underline">
                {d.statement} <span className="text-[11px] text-muted-foreground">· {d.status}</span>
              </Link>
            ))}
          </Group>
        )}

        {results.events.length > 0 && (
          <Group title="Events">
            {results.events.map((e) => (
              <Link key={e.id} href={`/events/${e.id}`} className="block py-1.5">
                <div className="flex items-baseline justify-between gap-2 text-sm">
                  <span className="truncate hover:underline">{e.headline}</span>
                  <span className="shrink-0 text-[10px] text-muted-foreground">{e.captured_at.slice(0, 10)}</span>
                </div>
                <div className="flex flex-wrap gap-1">
                  {e.labels.slice(0, 3).map((l) => (
                    <span key={l} className={cn('rounded-sm border px-1 text-[9px]', LABEL_COLOURS[l])}>
                      {l}
                    </span>
                  ))}
                </div>
              </Link>
            ))}
          </Group>
        )}
      </div>
    </div>
  )
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-4">
      <h3 className="mb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{title}</h3>
      <div className="divide-y divide-border">{children}</div>
    </section>
  )
}
