'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command'
import { mergeCoasters } from '@/app/admin/actions'
import { countryName, plural } from '@/lib/format'

export type MergeCandidate = { id: string; name: string; parkName: string; countryCode: string }

/**
 * AGENTS.md A6 task 5: pick survivor and loser, warn there is no undo, call
 * merge_coasters, show the real count it returns.
 *
 * What this dialog deliberately does not do: claim to know how many rides
 * will move before the admin confirms. That number lives across every
 * rider's rows, which no policy lets an admin session read (docs/TDD.md
 * section 3, "no admin branch in any rides policy"). A number shown here
 * before confirming would have to come from somewhere, and the only honest
 * sources are "the admin's own rides on this coaster" (misleading: it is not
 * the total) or "zero" (worse: it looks like a real answer). So this warns in
 * words instead, calls merge_coasters, and reports the number it actually
 * returns, which is the one number this session can ever legitimately see.
 */
export function MergeDialog({
  loser,
  candidates,
  trigger,
}: {
  loser: { id: string; name: string }
  candidates: MergeCandidate[]
  trigger: React.ReactNode
}) {
  const [open, setOpen] = useState(false)
  const [survivor, setSurvivor] = useState<MergeCandidate | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function reset() {
    setSurvivor(null)
    setError(null)
  }

  function confirmMerge() {
    if (!survivor) return
    setError(null)
    startTransition(async () => {
      const result = await mergeCoasters(survivor.id, loser.id)
      if (!result.ok) {
        setError(result.error)
        return
      }
      setOpen(false)
      reset()
      toast.success(`Merged "${loser.name}" into "${survivor.name}". ${plural(result.moved, 'ride')} moved.`)
    })
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (!next) reset()
      }}
    >
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Merge duplicate</DialogTitle>
          <DialogDescription>
            Every ride logged on <b className="text-foreground">{loser.name}</b> moves to the coaster you pick below,
            then <b className="text-foreground">{loser.name}</b> is removed from the catalogue. Credits are
            recounted for anyone who rode it. There is no undo.
          </DialogDescription>
        </DialogHeader>

        {error && (
          <p
            role="alert"
            className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm font-semibold text-destructive"
          >
            {error}
          </p>
        )}

        {!survivor ? (
          <Command className="rounded-lg border border-border" shouldFilter>
            <CommandInput placeholder="Search the coaster that survives…" />
            <CommandList>
              <CommandEmpty>No coaster found.</CommandEmpty>
              <CommandGroup>
                {candidates.map((c) => (
                  <CommandItem key={c.id} value={`${c.name} ${c.parkName}`} onSelect={() => setSurvivor(c)}>
                    <div className="min-w-0">
                      <div className="truncate">{c.name}</div>
                      <div className="truncate text-xs text-muted-foreground">
                        {c.parkName}
                        {c.countryCode ? ` · ${countryName(c.countryCode)}` : ''}
                      </div>
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        ) : (
          <div className="rounded-lg border border-border p-3 text-sm">
            <p>
              Merge <b>{loser.name}</b> into <b>{survivor.name}</b> ({survivor.parkName})?
            </p>
            <Button
              type="button"
              variant="link"
              size="sm"
              className="-mx-2 mt-1 min-h-11 px-2"
              onClick={() => setSurvivor(null)}
            >
              Pick a different coaster
            </Button>
          </div>
        )}

        <DialogFooter>
          <Button type="button" variant="outline" className="min-h-11" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            className="min-h-11"
            disabled={!survivor || pending}
            onClick={confirmMerge}
          >
            {pending && <Loader2 className="animate-spin" aria-hidden="true" />}
            Merge, no undo
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
