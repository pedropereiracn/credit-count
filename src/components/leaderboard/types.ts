import type { Database } from '@/lib/database.types'

/**
 * The exact shape `leaderboard()` returns: rank, display_name, credits. Nothing else.
 * Pulled straight from the generated types rather than hand-typed, so a column the
 * function stops returning is a compile error here, not a silent gap on the page.
 */
export type LeaderboardRow = Database['public']['Functions']['leaderboard']['Returns'][number]
