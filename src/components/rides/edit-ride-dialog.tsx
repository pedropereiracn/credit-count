'use client'

import { useState, useTransition, type FormEvent } from 'react'
import { toast } from 'sonner'
import { AlertCircle, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { updateRide } from '@/app/rides/actions'
import type { RideDetail } from './types'

const NOTE_MAX = 280

function todayIso(): string {
  return new Date().toISOString().slice(0, 10)
}

/**
 * Date and note only, on purpose: there is no coaster field here to change, which
 * is what actually stops a ride moving to another coaster under an edit (AGENTS.md,
 * A5, task 2). A plain `onSubmit` rather than `useActionState` because the dialog's
 * own `open` state needs to survive the action (close on success, stay open with the
 * error visible on failure), which is simpler to own directly than to infer from a
 * server-returned state object.
 */
export function EditRideDialog({ ride }: { ride: RideDetail }) {
  const [open, setOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const coaster = ride.coaster

  function handleOpenChange(next: boolean) {
    setOpen(next)
    if (!next) setError(null)
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const formData = new FormData(event.currentTarget)
    const riddenOn = String(formData.get('riddenOn') ?? '')
    const note = String(formData.get('note') ?? '')

    setError(null)
    startTransition(async () => {
      const result = await updateRide(ride.id, riddenOn, note)
      if (result.error) {
        setError(result.error)
        return
      }
      toast.success('Ride updated.')
      setOpen(false)
    })
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button type="button" variant="ghost" size="sm" className="h-auto px-0 font-bold">
          Edit
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit ride</DialogTitle>
          <DialogDescription>
            {coaster?.name ?? 'This coaster'} · {coaster?.park?.name ?? 'Unknown park'}. To put this
            ride on a different coaster, delete it and log a new one instead.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <p
              role="alert"
              className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-sm font-semibold text-destructive"
            >
              <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              <span>{error}</span>
            </p>
          )}

          <div className="space-y-1.5">
            <Label htmlFor={`ridden-on-${ride.id}`}>Date</Label>
            <Input
              id={`ridden-on-${ride.id}`}
              name="riddenOn"
              type="date"
              defaultValue={ride.ridden_on}
              max={todayIso()}
              required
              aria-invalid={Boolean(error)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor={`note-${ride.id}`}>Note</Label>
            <Textarea
              id={`note-${ride.id}`}
              name="note"
              defaultValue={ride.note ?? ''}
              maxLength={NOTE_MAX}
              placeholder="Optional. Row, seat, weather"
            />
          </div>

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">
                Cancel
              </Button>
            </DialogClose>
            <Button type="submit" disabled={pending}>
              {pending && <Loader2 className="animate-spin" aria-hidden="true" />}
              Save ride
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
