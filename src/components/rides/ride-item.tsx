import { rideDate } from '@/lib/format'
import { EditRideDialog } from './edit-ride-dialog'
import { DeleteRideDialog } from './delete-ride-dialog'
import type { RideDetail } from './types'

/** One ride: coaster, park, note, the date, and the two actions FR9 asks for. */
export function RideItem({
  ride,
  rideCountForCoaster,
}: {
  ride: RideDetail
  rideCountForCoaster: number
}) {
  const coaster = ride.coaster
  const parkName = coaster?.park?.name ?? 'Unknown park'
  const manufacturerName = coaster?.manufacturer?.name ?? 'Unknown'

  return (
    <li className="flex items-start justify-between gap-4 py-4 sm:gap-6">
      {/* Left: what was ridden, and the note if there is one. */}
      <div className="min-w-0">
        <h3 className="font-heading text-base font-bold break-words">
          {coaster?.name ?? 'Unknown coaster'}
        </h3>
        <p className="mt-0.5 text-sm font-medium text-muted-foreground">
          {parkName} · {manufacturerName}
        </p>
        {ride.note && (
          <p className="mt-2 text-sm leading-relaxed text-foreground">{ride.note}</p>
        )}
      </div>

      {/* Right: the day this ride sits on (the group header carries the full date,
          this is the day-of-month for a per-row anchor) and the two actions, so the
          card's width is used instead of everything stacking on the left. */}
      <div className="flex shrink-0 flex-col items-end gap-3 text-right">
        <span className="text-sm font-bold whitespace-nowrap text-muted-foreground tabular-nums">
          {rideDate(ride.ridden_on)}
        </span>
        <div className="flex items-center gap-4">
          <EditRideDialog ride={ride} />
          <DeleteRideDialog
            rideId={ride.id}
            coasterName={coaster?.name ?? 'this coaster'}
            willRemoveCredit={rideCountForCoaster <= 1}
          />
        </div>
      </div>
    </li>
  )
}
