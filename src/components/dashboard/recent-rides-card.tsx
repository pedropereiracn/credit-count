import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { plural, rideDate } from '@/lib/format'

export type RecentRideRow = {
  id: string
  coasterName: string
  parkName: string
  riddenOn: string
  note: string | null
}

/** The last five rides, with a link to the full history (task 8). */
export function RecentRidesCard({
  rides,
  totalRides,
  className,
}: {
  rides: RecentRideRow[]
  totalRides: number
  className?: string
}) {
  return (
    <Card className={cn('gap-3', className)}>
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="text-xs font-bold tracking-wide text-muted-foreground uppercase">
            Recent rides
          </CardTitle>
          <Link href="/rides" className="text-xs font-bold text-primary hover:underline">
            All {plural(totalRides, 'ride')}
          </Link>
        </div>
      </CardHeader>
      <CardContent>
        {rides.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nothing logged yet.</p>
        ) : (
          <div className="divide-y divide-dashed divide-border">
            {rides.map((ride) => (
              <div key={ride.id} className="flex items-start justify-between gap-3 py-2.5 first:pt-0">
                <div className="min-w-0">
                  <p className="truncate font-heading text-sm font-bold">{ride.coasterName}</p>
                  <p className="truncate text-xs font-semibold text-muted-foreground">{ride.parkName}</p>
                  {ride.note && <p className="mt-0.5 text-xs text-muted-foreground">{ride.note}</p>}
                </div>
                <p className="shrink-0 text-xs font-bold text-muted-foreground">
                  {rideDate(ride.riddenOn)}
                </p>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
