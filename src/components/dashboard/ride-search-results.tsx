'use client'

import { Loader2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { countryName } from '@/lib/format'
import type { CoasterSearchRow } from '@/components/dashboard/types'

/**
 * Search results, or the browsable catalogue when the query is empty (task 4:
 * "an empty query lists the catalogue, paginated"). Clicking a row is interaction
 * two of the three-tap ride log.
 */
export function RideSearchResults({
  rows,
  pending,
  query,
  page,
  hasMore,
  onPick,
  onPageChange,
}: {
  rows: CoasterSearchRow[]
  pending: boolean
  query: string
  page: number
  hasMore: boolean
  onPick: (row: CoasterSearchRow) => void
  onPageChange: (page: number) => void
}) {
  return (
    <div className="mt-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-bold tracking-wide text-muted-foreground uppercase">
          {query ? 'Matching coasters' : 'Browse the catalogue'}
        </p>
        {pending && (
          <Loader2 className="size-3.5 animate-spin text-muted-foreground" aria-hidden="true" />
        )}
      </div>

      {rows.length === 0 && !pending && (
        <p className="mt-2 rounded-lg bg-muted/50 px-3 py-2.5 text-sm text-muted-foreground">
          {query ? `No coaster called "${query}" in the catalogue yet.` : 'The catalogue is empty.'}
        </p>
      )}

      <ul className="mt-1 max-h-80 divide-y divide-dashed divide-border overflow-y-auto">
        {rows.map((row) => (
          <li key={row.id}>
            <button
              type="button"
              onClick={() => onPick(row)}
              className="flex w-full items-center justify-between gap-3 rounded-lg px-2 py-2.5 text-left transition-colors hover:bg-secondary focus-visible:bg-secondary focus-visible:outline-none"
            >
              <span className="min-w-0">
                <span className="block truncate font-heading text-sm font-bold">{row.name}</span>
                <span className="block truncate text-xs font-semibold text-muted-foreground">
                  {row.parkName} · {countryName(row.countryCode)}
                </span>
              </span>
              <span className="flex shrink-0 items-center gap-1.5">
                {row.retiredAt && <Badge variant="outline">Retired</Badge>}
                <Badge variant={row.alreadyRidden ? 'secondary' : 'default'}>
                  {row.alreadyRidden ? 'Reride' : 'New credit'}
                </Badge>
              </span>
            </button>
          </li>
        ))}
      </ul>

      {rows.length > 0 && (page > 1 || hasMore) && (
        <div className="mt-2 flex items-center justify-between border-t border-dashed border-border pt-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={page <= 1 || pending}
            onClick={() => onPageChange(page - 1)}
          >
            Previous
          </Button>
          <span className="text-xs font-semibold text-muted-foreground">Page {page}</span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={!hasMore || pending}
            onClick={() => onPageChange(page + 1)}
          >
            Next
          </Button>
        </div>
      )}
    </div>
  )
}
