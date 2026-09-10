'use client'

import { useTransition } from 'react'
import { toast } from 'sonner'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { deleteRide } from '@/app/rides/actions'

/**
 * Confirms, and says out loud when the credit goes too (AGENTS.md, A5, task 3):
 * `willRemoveCredit` is true exactly when this is the caller's only logged ride on
 * that coaster, which `src/app/rides/page.tsx` works out from a plain count of the
 * caller's own `rides` rows grouped by coaster, since no view serves a per-coaster
 * count for every coaster (only the single most-ridden one, `my_most_ridden`).
 *
 * Radix's `AlertDialogAction` closes the dialog itself on click, before a Server
 * Action bound to a form inside it could realistically finish, so this calls
 * `deleteRide` directly and reports the outcome as a toast rather than an inline
 * message that would never be seen.
 */
export function DeleteRideDialog({
  rideId,
  coasterName,
  willRemoveCredit,
}: {
  rideId: string
  coasterName: string
  willRemoveCredit: boolean
}) {
  const [pending, startTransition] = useTransition()

  function handleDelete() {
    startTransition(async () => {
      const result = await deleteRide(rideId)
      if (result.error) {
        toast.error(result.error)
        return
      }
      toast.success(
        willRemoveCredit
          ? `Ride deleted. The credit for ${coasterName} went with it.`
          : 'Ride deleted.',
      )
    })
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        {/* min-h-11 -mx-2: same 44px tap-target fix as EditRideDialog's trigger,
            same reasoning. */}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="-mx-2 min-h-11 px-2 font-bold text-destructive hover:text-destructive"
        >
          Delete
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete this ride?</AlertDialogTitle>
          <AlertDialogDescription>
            {willRemoveCredit
              ? `This is your only logged ride on ${coasterName}. Deleting it removes that credit too.`
              : `You have other rides logged on ${coasterName}, so its credit stays either way.`}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel className="min-h-11">Keep it</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            className="min-h-11"
            disabled={pending}
            onClick={handleDelete}
          >
            Delete ride
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
