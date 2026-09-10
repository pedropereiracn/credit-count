'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'
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
import { deleteCoaster } from '@/app/admin/actions'

/**
 * AGENTS.md A6 task 4: delete only works when the coaster has no rides, and
 * the screen has to explain that in plain product language, never the raw
 * Postgres foreign-key error. There is no way to know in advance whether a
 * coaster has rides (see the note at the top of src/app/admin/actions.ts), so
 * this always attempts the delete and translates whatever comes back.
 */
export function DeleteCoasterButton({ id, name }: { id: string; name: string }) {
  const [open, setOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function handleDelete(e: React.MouseEvent) {
    // AlertDialogAction closes the dialog itself on click; prevent that so an
    // error can stay on screen instead of vanishing with the dialog.
    e.preventDefault()
    setError(null)
    startTransition(async () => {
      const result = await deleteCoaster(id)
      if (!result.ok) {
        setError(result.error)
        return
      }
      setOpen(false)
      toast.success(`"${name}" deleted from the catalogue.`)
    })
  }

  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (next) setError(null)
      }}
    >
      <AlertDialogTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="text-destructive hover:bg-destructive/10 hover:text-destructive"
        >
          Delete
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete {name}?</AlertDialogTitle>
          <AlertDialogDescription>
            This only works if nobody has ever logged a ride on this coaster. If someone has, retire it instead so
            those credits stay. This cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>

        {error && (
          <p
            role="alert"
            className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm font-semibold text-destructive"
          >
            {error}
          </p>
        )}

        <AlertDialogFooter>
          <AlertDialogCancel>Keep it</AlertDialogCancel>
          <AlertDialogAction variant="destructive" onClick={handleDelete} disabled={pending}>
            {pending && <Loader2 className="animate-spin" aria-hidden="true" />}
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
