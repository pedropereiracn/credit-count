import { rideDate } from '@/lib/format'
import { EditRideDialog } from './edit-ride-dialog'
import { DeleteRideDialog } from './delete-ride-dialog'
import type { RideDetail } from './types'

/** One ride: coaster, park, date, note, and the two actions FR9 asks for. */
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
    <li className="py-4 first:pt-0 last:pb-0">
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1">
        <div className="min-w-0">
          <h3 className="font-heading text-base font-bold break-words">
            {coaster?.name ?? 'Unknown coaster'}
          </h3>
          <p className="text-sm font-medium text-muted-foreground">
            {parkName} · {manufacturerName}
          </p>
        </div>
        <span className="shrink-0 text-sm font-bold tabular-nums text-muted-foreground">
          {rideDate(ride.ridden_on)}
        </span>
      </div>

      {ride.note && <p className="mt-2 text-sm leading-relaxed text-foreground">{ride.note}</p>}

      <div className="mt-3 flex items-center gap-5">
        <EditRideDialog ride={ride} />
        <DeleteRideDialog
          rideId={ride.id}
          coasterName={coaster?.name ?? 'this coaster'}
          willRemoveCredit={rideCountForCoaster <= 1}
        />
      </div>
    </li>
  )
}
