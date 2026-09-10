import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { rideDate } from '@/lib/format'

export type MostRiddenCoaster = {
  name: string
  parkName: string
  rides: number
  lastRidden: string
}

/** The one dark card in the grid, mirroring the prototype's `.s-most` (see task 8's reference). */
export function MostRiddenCard({
  coaster,
  className,
}: {
  coaster: MostRiddenCoaster | null
  className?: string
}) {
  return (
    <Card className={cn('bg-foreground text-background', className)}>
      <CardContent className="flex h-full flex-col">
        <p className="text-xs font-bold tracking-wide text-primary uppercase">Most ridden</p>
        {coaster ? (
          <>
            <p className="mt-2 min-w-0 font-heading text-2xl font-bold break-words">{coaster.name}</p>
            <p className="mt-1 text-sm text-background/70">{coaster.parkName}</p>
            {coaster.lastRidden && (
              <p className="mt-4 text-xs font-semibold text-background/70">
                Last ride {rideDate(coaster.lastRidden)}
              </p>
            )}
            <div className="mt-auto flex items-baseline gap-2 pt-6">
              <span className="credit-number text-4xl text-primary">{coaster.rides}</span>
              <span className="text-xs font-bold tracking-wide text-background/70 uppercase">
                {coaster.rides === 1 ? 'ride' : 'rides'}
              </span>
            </div>
          </>
        ) : (
          <p className="mt-2 text-sm text-background/70">Not enough rides yet.</p>
        )}
      </CardContent>
    </Card>
  )
}
