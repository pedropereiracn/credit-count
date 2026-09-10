'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import { Input } from '@/components/ui/input'
import { searchCoasters } from '@/app/dashboard/actions'
import { RideSearchResults } from '@/components/dashboard/ride-search-results'
import { ResponsiveRideDialog } from '@/components/dashboard/responsive-ride-dialog'
import { LogRideForm } from '@/components/dashboard/log-ride-form'
import type { CoasterSearchRow } from '@/components/dashboard/types'

/**
 * Logging a ride in exactly three interactions (task 5): type in the box, click a
 * result, confirm. The comment on each handler below marks which of the three it
 * is; count them, they only add up to three.
 */
export function RideLogger({
  initialRows,
  initialHasMore,
}: {
  initialRows: CoasterSearchRow[]
  initialHasMore: boolean
}) {
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)
  const [rows, setRows] = useState(initialRows)
  const [hasMore, setHasMore] = useState(initialHasMore)
  const [selected, setSelected] = useState<CoasterSearchRow | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [pending, startTransition] = useTransition()
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  function runSearch(nextQuery: string, nextPage: number) {
    startTransition(async () => {
      const result = await searchCoasters(nextQuery, nextPage)
      setRows(result.rows)
      setHasMore(result.hasMore)
      setPage(result.page)
    })
  }

  useEffect(
    () => () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    },
    [],
  )

  // Interaction one: typing. Debounced so a burst of keystrokes is one search on
  // the server, not one request per key.
  function handleQueryChange(value: string) {
    setQuery(value)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => runSearch(value, 1), 250)
  }

  // Interaction two: clicking a result opens the confirm dialog/sheet.
  function handlePick(row: CoasterSearchRow) {
    setSelected(row)
    setDialogOpen(true)
  }

  function handleLogged() {
    setDialogOpen(false)
    setSelected(null)
    setQuery('')
    runSearch('', 1)
  }

  function closeDialog() {
    setDialogOpen(false)
    setSelected(null)
  }

  return (
    <div>
      <Input
        value={query}
        onChange={(event) => handleQueryChange(event.target.value)}
        placeholder="Coaster or park, e.g. Stealth"
        aria-label="Search coasters"
        autoComplete="off"
      />

      <RideSearchResults
        rows={rows}
        pending={pending}
        query={query}
        page={page}
        hasMore={hasMore}
        onPick={handlePick}
        onPageChange={(nextPage) => runSearch(query, nextPage)}
      />

      {selected && (
        <ResponsiveRideDialog
          open={dialogOpen}
          onOpenChange={(open) => (open ? setDialogOpen(true) : closeDialog())}
          title={selected.alreadyRidden ? 'Log another ride' : 'Log a ride'}
          description="Three taps: search, pick, confirm. This is the confirm."
        >
          {/* Interaction three: confirm, inside LogRideForm. */}
          <LogRideForm coaster={selected} onLogged={handleLogged} onCancel={closeDialog} />
        </ResponsiveRideDialog>
      )}
    </div>
  )
}
