import { plural } from '@/lib/format'
import { RideItem } from './ride-item'
import type { RideDetail } from './types'

/** "Sat 5 Sep 2026", the format the reference prototype's `#/rides` groups by. */
function groupDateLabel(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

/**
 * Every ride, newest first (FR9). `rows` already arrive newest-first from the
 * query in `src/app/rides/page.tsx`, so grouping same-day rides together is a
 * single linear pass, no re-sort. A day that straddles a page boundary shows as
 * two small groups with the same date on two pages; that is fine, it is the same
 * trade-off any paginated, grouped list makes.
 */
export function RidesList({
  rows,
  coasterRideCounts,
}: {
  rows: RideDetail[]
  coasterRideCounts: Record<string, number>
}) {
  const groups: { date: string; rides: RideDetail[] }[] = []
  for (const row of rows) {
    const current = groups[groups.length - 1]
    if (current && current.date === row.ridden_on) {
      current.rides.push(row)
    } else {
      groups.push({ date: row.ridden_on, rides: [row] })
    }
  }

  return (
    <div className="space-y-6">
      {groups.map((group) => (
        <section key={group.date}>
          <h2 className="mb-1.5 text-xs font-bold tracking-wide text-muted-foreground uppercase">
            {groupDateLabel(group.date)} · {plural(group.rides.length, 'ride')}
          </h2>
          <ol className="divide-y divide-dashed divide-border rounded-2xl border border-border bg-card px-4 sm:px-5">
            {group.rides.map((ride) => (
              <RideItem
                key={ride.id}
                ride={ride}
                rideCountForCoaster={coasterRideCounts[ride.coaster?.id ?? ''] ?? 0}
              />
            ))}
          </ol>
        </section>
      ))}
    </div>
  )
}
