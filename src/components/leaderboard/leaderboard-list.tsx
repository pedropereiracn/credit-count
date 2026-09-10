import { cn } from '@/lib/utils'
import type { LeaderboardRow } from './types'

/**
 * Visual weight follows rank, not identity: rank 1 gets the biggest numerals, 2 and 3
 * a step down, everyone else reads at one calm size. Nothing here is keyed to a
 * specific person, so this scales the same way whether the viewer is signed in,
 * signed out, or on the list themselves. See prototipo/index.html `#/` for the
 * reference sizing this mirrors.
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
export function LeaderboardList({ rows }: { rows: LeaderboardRow[] }) {
  return (
    <ol className="divide-y divide-dashed divide-border">
      {rows.map((row, index) => {
        const styles = TIER_STYLES[tierOf(row.rank)]
        return (
          <li
            key={`${row.rank}-${index}`}
            className="grid grid-cols-[2.5rem_1fr_auto] items-center gap-3 py-3 sm:grid-cols-[3rem_1fr_auto] sm:gap-4 sm:py-4"
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
