import Link from 'next/link'
import { Button } from '@/components/ui/button'

/**
 * The RPC caps how many rows a single call returns; this only walks pages, it never
 * asks for a bigger one. `hasNext` is inferred from a full page coming back (no
 * separate count query, since that would mean reading outside the RPC boundary).
 */
export function LeaderboardPagination({
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
      aria-label="Leaderboard pages"
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
  const href = target <= 1 ? '/' : `/?page=${target}`

  if (!enabled) {
    return (
      <span
        aria-disabled="true"
        className="inline-flex h-8 min-w-24 items-center justify-center rounded-lg border border-border px-2.5 text-sm font-medium text-muted-foreground/50"
      >
        {label}
      </span>
    )
  }

  return (
    <Button asChild variant="outline" className="min-w-24">
      <Link href={href}>{label}</Link>
    </Button>
  )
}
