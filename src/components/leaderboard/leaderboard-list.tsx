import { cn } from '@/lib/utils'
import type { LeaderboardRow } from './types'

/**
 * Visual weight follows rank: rank 1 gets the biggest numerals, 2 and 3 a step down,
 * everyone else reads at one calm size. See prototipo/index.html `#/` for the sizing.
 *
 * The one exception is the viewer's own row, tinted so they can find themselves. That
 * marker is decided on the server by matching the row against the viewer's OWN name
 * and credit count (data they already have about themselves), never by adding a column
 * to the public function, which still returns exactly rank/display_name/credits. It is
 * an approximation: two opted-in users with the same display name AND the same credit
 * count would both light up. That is rare, leaks nothing, and the exact fix is a
 * dedicated function returning the caller's position from auth.uid(), left as v2.
 */
const TIER_STYLES = {
  first: {
    rank: 'text-[clamp(1.75rem,7vw,2.75rem)] text-primary',
    name: 'text-[clamp(1.05rem,3.6vw,1.5rem)]',
    credits: 'text-[clamp(1.75rem,7vw,2.75rem)] text-primary',
  },
  podium: {
    rank: 'text-2xl sm:text-3xl',
    name: 'text-base sm:text-lg',
    credits: 'text-2xl sm:text-3xl',
  },
  rest: {
    rank: 'text-lg sm:text-xl',
    name: 'text-sm sm:text-base',
    credits: 'text-lg sm:text-xl',
  },
} as const

function tierOf(rank: number): keyof typeof TIER_STYLES {
  if (rank === 1) return 'first'
  if (rank === 2 || rank === 3) return 'podium'
  return 'rest'
}

/** Renders rank, display name and credits. Nothing else: see AGENTS.md, A2, "Never". */
export function LeaderboardList({
  rows,
  you,
}: {
  rows: LeaderboardRow[]
  you?: { name: string; credits: number } | null
}) {
  return (
    <ol className="divide-y divide-dashed divide-border">
      {rows.map((row, index) => {
        const styles = TIER_STYLES[tierOf(row.rank)]
        const isYou =
          !!you && row.display_name === you.name && row.credits === you.credits
        return (
          <li
            key={`${row.rank}-${index}`}
            className={cn(
              'grid grid-cols-[2.5rem_1fr_auto] items-center gap-3 py-3 sm:grid-cols-[3rem_1fr_auto] sm:gap-4 sm:py-4',
              isYou &&
                'relative rounded-xl bg-accent px-3 sm:px-4 ring-1 ring-primary/25',
            )}
          >
            <span
              className={cn(
                'font-heading font-bold tabular-nums text-muted-foreground',
                styles.rank,
              )}
            >
              {row.rank}
            </span>
            <span
              className={cn(
                'min-w-0 font-heading font-extrabold break-words',
                styles.name,
              )}
            >
              {row.display_name}
              {isYou && (
                <span className="ml-2 align-middle text-[10px] font-bold tracking-wide text-primary uppercase">
                  You
                </span>
              )}
            </span>
            <span className="text-right leading-none">
              <span
                className={cn('block font-heading font-bold tabular-nums', styles.credits)}
              >
                {row.credits}
              </span>
              <span className="mt-1 block text-[10px] font-bold tracking-wide text-muted-foreground uppercase">
                {row.credits === 1 ? 'credit' : 'credits'}
              </span>
            </span>
          </li>
        )
      })}
    </ol>
  )
}
