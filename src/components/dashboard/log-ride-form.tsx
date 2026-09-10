'use client'

import { useState, useTransition } from 'react'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { logRide } from '@/app/dashboard/actions'
import { countryName, TRACK_TYPE_LABELS } from '@/lib/format'
import type { CoasterSearchRow } from '@/components/dashboard/types'

function today(): string {
  return new Date().toISOString().slice(0, 10)
}

/**
 * Interaction three of three: confirm. Date defaults to today, the note is
 * optional (task 5). Submitting calls the `logRide` Server Action directly
 * (rather than binding the form to it with `useActionState`) so this component
 * decides what "success" means: close the sheet/dialog and hand the coaster back
 * to whoever asked for it, instead of a redirect.
 */
export function LogRideForm({
  coaster,
  onLogged,
  onCancel,
}: {
  coaster: CoasterSearchRow
  onLogged: () => void
  onCancel: () => void
}) {
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      const result = await logRide({ error: null }, formData)
      if (result.error) {
        setError(result.error)
        toast.error(result.error)
      } else {
        setError(null)
        toast.success(
          coaster.alreadyRidden
            ? `Another ride on ${coaster.name} logged.`
            : `${coaster.name} logged. That's a new credit.`,
        )
        onLogged()
      }
    })
  }

  return (
    <form action={handleSubmit} className="space-y-4">
      <input type="hidden" name="coasterId" value={coaster.id} />

      <div className="rounded-lg bg-muted/50 px-3 py-2.5">
        <p className="font-heading text-lg font-bold break-words">{coaster.name}</p>
        <p className="mt-0.5 text-sm text-muted-foreground">
          {coaster.parkName} · {countryName(coaster.countryCode)}
          {coaster.manufacturerName ? ` · ${coaster.manufacturerName}` : ''}
        </p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {coaster.retiredAt && <Badge variant="outline">Retired</Badge>}
          <Badge variant={coaster.alreadyRidden ? 'secondary' : 'default'}>
            {coaster.alreadyRidden ? 'Reride, same credit' : 'New credit'}
          </Badge>
          <Badge variant="outline">{TRACK_TYPE_LABELS[coaster.trackType] ?? coaster.trackType}</Badge>
        </div>
      </div>

      {error && (
        <p role="alert" className="text-sm font-semibold text-destructive">
          {error}
        </p>
      )}

      <div className="space-y-1.5">
        <Label htmlFor="riddenOn">Date</Label>
        <Input id="riddenOn" name="riddenOn" type="date" defaultValue={today()} max={today()} required />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="note">Note (optional)</Label>
        <Input id="note" name="note" placeholder="Row, seat, weather" maxLength={280} />
      </div>

      <div className="flex gap-2">
        <Button type="submit" disabled={pending} className="flex-1">
          {pending && <Loader2 className="animate-spin" aria-hidden="true" />}
          Log ride
        </Button>
        <Button type="button" variant="outline" onClick={onCancel} disabled={pending}>
          Cancel
        </Button>
      </div>
    </form>
  )
}
