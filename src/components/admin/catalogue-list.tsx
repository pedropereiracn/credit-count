'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/components/empty-state'
import { countryName, plural, TRACK_TYPE_LABELS } from '@/lib/format'
import { RetireToggleButton } from '@/components/admin/retire-toggle-button'
import { DeleteCoasterButton } from '@/components/admin/delete-coaster-button'
import { MergeDialog, type MergeCandidate } from '@/components/admin/merge-dialog'

export type CoasterListItem = {
  id: string
  name: string
  track_type: string
  retired_at: string | null
  park: { id: string; name: string; country_code: string } | null
  manufacturer: { id: string; name: string } | null
}

/**
 * AGENTS.md A6 task 1 and 3: searchable, retired hidden by default with a
 * filter to show them, because a demolished coaster is still a credit
 * somebody earned. `coasters` is used directly rather than copied into
 * state, so a Server Action's revalidatePath('/admin') flows straight back
 * into this list once Next re-renders the page around it (no router.refresh
 * needed, matching how the rest of this app's mutations work).
 */
export function CatalogueList({
  coasters,
  parkCount,
  manufacturerCount,
}: {
  coasters: CoasterListItem[]
  parkCount: number
  manufacturerCount: number
}) {
  const [search, setSearch] = useState('')
  const [showRetired, setShowRetired] = useState(false)

  const retiredCount = coasters.filter((c) => c.retired_at).length
  const manufacturersInUse = useMemo(
    () => new Set(coasters.map((c) => c.manufacturer?.id).filter(Boolean)).size,
    [coasters],
  )

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    let list = coasters.filter((c) => showRetired || !c.retired_at)
    if (q) {
      list = list.filter(
        (c) => c.name.toLowerCase().includes(q) || (c.park?.name.toLowerCase().includes(q) ?? false),
      )
    }
    return [...list].sort(
      (a, b) => (a.park?.name ?? '').localeCompare(b.park?.name ?? '') || a.name.localeCompare(b.name),
    )
  }, [coasters, search, showRetired])

  const trimmedSearch = search.trim()

  return (
    <div>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-bold tracking-[0.14em] text-primary uppercase">Admin</p>
          <h1 className="mt-1 font-heading text-3xl font-bold tracking-tight sm:text-4xl">Catalogue</h1>
          <p className="mt-2 text-sm font-semibold text-muted-foreground">
            <b className="text-foreground">{coasters.length}</b> coasters ·{' '}
            <b className="text-foreground">{parkCount}</b> parks ·{' '}
            <b className="text-foreground">{manufacturerCount}</b> manufacturers
            {manufacturersInUse < manufacturerCount && ` (${manufacturersInUse} in use)`}
          </p>
        </div>
        <Button asChild>
          <Link href="/admin/coasters/new">Add coaster</Link>
        </Button>
      </div>

      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by coaster or park"
          aria-label="Search the catalogue"
          className="sm:max-w-sm"
        />
        <label className="flex items-center gap-2 text-sm font-semibold text-muted-foreground select-none">
          <input
            type="checkbox"
            checked={showRetired}
            onChange={(e) => setShowRetired(e.target.checked)}
            className="size-4 rounded border-input accent-primary"
          />
          Show retired ({retiredCount})
        </label>
      </div>

      <div className="mt-4 space-y-2">
        {filtered.length === 0 ? (
          trimmedSearch ? (
            <EmptyState title={`No coaster called "${trimmedSearch}".`}>
              Not in the catalogue yet. Add it now and enthusiasts can log it straight away.
              <div className="mt-4">
                <Button asChild>
                  <Link href={`/admin/coasters/new?name=${encodeURIComponent(trimmedSearch)}`}>
                    Add &ldquo;{trimmedSearch}&rdquo;
                  </Link>
                </Button>
              </div>
            </EmptyState>
          ) : (
            <EmptyState title="The catalogue is empty.">
              Add the first coaster. Every ride anyone logs points at an entry here.
              <div className="mt-4">
                <Button asChild>
                  <Link href="/admin/coasters/new">Add coaster</Link>
                </Button>
              </div>
            </EmptyState>
          )
        ) : (
          <>
            {filtered.map((c) => (
              <CatalogueRow key={c.id} coaster={c} allCoasters={coasters} />
            ))}
            <p className="pt-2 text-xs text-muted-foreground">
              {plural(filtered.length, 'coaster')} shown. Retired coasters are hidden from browsing but stay
              searchable, so a demolished coaster is still a credit to log.
            </p>
          </>
        )}
      </div>
    </div>
  )
}

function CatalogueRow({ coaster: c, allCoasters }: { coaster: CoasterListItem; allCoasters: CoasterListItem[] }) {
  const retired = Boolean(c.retired_at)
  const candidates: MergeCandidate[] = allCoasters
    .filter((o) => o.id !== c.id)
    .map((o) => ({
      id: o.id,
      name: o.name,
      parkName: o.park?.name ?? 'Unknown park',
      countryCode: o.park?.country_code ?? '',
    }))

  return (
    <div className={`rounded-xl border border-border bg-card p-3 sm:p-4 ${retired ? 'opacity-70' : ''}`}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="truncate font-heading font-bold">{c.name}</p>
          <p className="truncate text-sm text-muted-foreground">
            {c.park?.name ?? 'Unknown park'} · {countryName(c.park?.country_code ?? '')}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-muted-foreground">{c.manufacturer?.name ?? 'Unknown'}</span>
          <Badge variant="outline">{TRACK_TYPE_LABELS[c.track_type] ?? c.track_type}</Badge>
          <Badge variant={retired ? 'secondary' : 'default'}>{retired ? 'Retired' : 'Operating'}</Badge>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-1 border-t border-border pt-3">
        <Button asChild variant="ghost" size="sm">
          <Link href={`/admin/coasters/${c.id}`}>Edit</Link>
        </Button>
        <RetireToggleButton id={c.id} name={c.name} retired={retired} />
        <MergeDialog
          loser={{ id: c.id, name: c.name }}
          candidates={candidates}
          trigger={
            <Button type="button" variant="ghost" size="sm">
              Merge
            </Button>
          }
        />
        <DeleteCoasterButton id={c.id} name={c.name} />
      </div>
    </div>
  )
}
