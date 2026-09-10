import Link from 'next/link'
import { Button } from '@/components/ui/button'

/**
 * Same shape as `src/components/leaderboard/leaderboard-pagination.tsx`, pointed
 * at `/rides` instead of `/`. `hasNext` comes from the page's own exact count
 * (`src/app/rides/page.tsx`), since a ride-history page has no capped RPC to infer
 * it from the way the leaderboard does.
 */
export function RidesPagination({
  page,
  hasPrevious,
  hasNext,
}: {
  page: number
  hasPrevious: boolean
  hasNext: boolean
}) {
  if (!hasPrevious && !hasNext) return null

  return (
    <nav
      aria-label="Ride history pages"
      className="mt-8 flex items-center justify-between gap-3 border-t border-dashed border-border pt-6"
    >
      <PageLink direction="previous" enabled={hasPrevious} page={page} />
      <span className="text-xs font-bold tracking-wide text-muted-foreground uppercase">
        Page {page}
      </span>
      <PageLink direction="next" enabled={hasNext} page={page} />
    </nav>
  )
}

function PageLink({
  direction,
  enabled,
  page,
}: {
  direction: 'previous' | 'next'
  enabled: boolean
  page: number
}) {
  const label = direction === 'previous' ? 'Previous' : 'Next'
  const target = direction === 'previous' ? page - 1 : page + 1
  const href = target <= 1 ? '/rides' : `/rides?page=${target}`

  if (!enabled) {
    return (
      <span
        aria-disabled="true"
        className="inline-flex min-h-11 min-w-24 items-center justify-center rounded-lg border border-border px-2.5 text-sm font-medium text-muted-foreground/50"
      >
        {label}
      </span>
    )
  }

  return (
    <Button asChild variant="outline" className="min-h-11 min-w-24">
      <Link href={href}>{label}</Link>
    </Button>
  )
}
