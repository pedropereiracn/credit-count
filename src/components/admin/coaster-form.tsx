'use client'

import { useActionState, useState } from 'react'
import Link from 'next/link'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Card, CardContent } from '@/components/ui/card'
import { createCoaster, updateCoaster, type CoasterFormState } from '@/app/admin/actions'
import { ParkCombobox, type ParkOption } from '@/components/admin/park-combobox'
import { ManufacturerCombobox, type ManufacturerOption } from '@/components/admin/manufacturer-combobox'
import { TrackTypeField } from '@/components/admin/track-type-field'
import { MergeDialog, type MergeCandidate } from '@/components/admin/merge-dialog'

const initialState: CoasterFormState = { formError: null, fieldErrors: {} }

export type CoasterDetail = {
  id: string
  name: string
  track_type: string
  retired_at: string | null
  park_id: string
  manufacturer_id: string | null
}

/**
 * One form for add and edit both, matching the approved prototype's
 * `#/admin/coaster`. The distinction is only which Server Action it is bound
 * to: `createCoaster` for a new row, `updateCoaster` (pre-bound with the id)
 * for an existing one.
 */
export function CoasterForm({
  coaster,
  parks,
  manufacturers,
  initialName = '',
  mergeCandidates = [],
}: {
  coaster?: CoasterDetail
  parks: ParkOption[]
  manufacturers: ManufacturerOption[]
  initialName?: string
  mergeCandidates?: MergeCandidate[]
}) {
  const isEdit = Boolean(coaster)
  const action = isEdit ? updateCoaster.bind(null, coaster!.id) : createCoaster
  const [state, formAction, pending] = useActionState<CoasterFormState, FormData>(action, initialState)
  const [retired, setRetired] = useState(Boolean(coaster?.retired_at))

  return (
    <div className="max-w-xl">
      <p className="text-xs font-bold tracking-[0.14em] text-primary uppercase">Admin · catalogue</p>
      <h1 className="mt-1 font-heading text-3xl font-bold tracking-tight">
        {isEdit ? 'Edit coaster' : 'New coaster'}
      </h1>
      {isEdit && coaster && <p className="mt-1 text-sm font-semibold text-muted-foreground">{coaster.name}</p>}

      <form action={formAction} className="mt-6 space-y-5">
        {state.formError && (
          <p
            role="alert"
            className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-sm font-semibold text-destructive"
          >
            {state.formError}
          </p>
        )}

        <Card>
          <CardContent className="space-y-5 pt-1">
            <div className="space-y-1.5">
              <Label htmlFor="coaster-name">Name</Label>
              <Input
                id="coaster-name"
                name="name"
                className="h-11"
                defaultValue={coaster?.name ?? initialName}
                placeholder="As the park spells it"
                required
                aria-invalid={Boolean(state.fieldErrors.name)}
              />
              {state.fieldErrors.name && (
                <p className="text-sm font-semibold text-destructive">{state.fieldErrors.name}</p>
              )}
            </div>

            <div>
              <ParkCombobox parks={parks} defaultParkId={coaster?.park_id ?? null} />
              <p className="mt-1 text-xs text-muted-foreground">Country comes from the park, so the two never disagree.</p>
              {state.fieldErrors.park && (
                <p className="mt-1 text-sm font-semibold text-destructive">{state.fieldErrors.park}</p>
              )}
            </div>

            <div>
              <ManufacturerCombobox manufacturers={manufacturers} defaultManufacturerId={coaster?.manufacturer_id ?? null} />
              {state.fieldErrors.manufacturer && (
                <p className="mt-1 text-sm font-semibold text-destructive">{state.fieldErrors.manufacturer}</p>
              )}
            </div>

            <div>
              <TrackTypeField defaultValue={coaster?.track_type ?? 'steel'} />
              {state.fieldErrors.trackType && (
                <p className="mt-1 text-sm font-semibold text-destructive">{state.fieldErrors.trackType}</p>
              )}
            </div>

            <div className="flex items-center justify-between gap-4 rounded-lg border border-border p-3">
              <div className="min-w-0">
                <p className="text-sm font-bold">Status</p>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  {retired
                    ? 'Retired. Hidden from the catalogue, still found by search, so past rides can be logged and existing credits stay.'
                    : 'Operating. Listed in the catalogue and found by search.'}
                </p>
              </div>
              <label className="-m-2.5 inline-flex min-h-11 min-w-11 shrink-0 cursor-pointer items-center justify-center p-2.5">
                <Switch checked={retired} onCheckedChange={setRetired} aria-label="Retired" />
              </label>
              <input type="hidden" name="retired" value={retired ? '1' : '0'} />
              <input type="hidden" name="existing_retired_at" value={coaster?.retired_at ?? ''} />
            </div>
          </CardContent>
        </Card>

        <div className="flex gap-2">
          <Button type="submit" disabled={pending} className="min-h-11">
            {pending && <Loader2 className="animate-spin" aria-hidden="true" />}
            {isEdit ? 'Save changes' : 'Add to catalogue'}
          </Button>
          <Button asChild variant="ghost" className="min-h-11">
            <Link href="/admin">Cancel</Link>
          </Button>
        </div>
      </form>

      {isEdit && coaster && (
        <Card className="mt-6">
          <CardContent className="space-y-2 pt-1">
            <p className="font-heading text-base font-bold">Duplicate of another coaster?</p>
            <p className="text-sm text-muted-foreground">
              Merging moves every ride logged on this entry, by any rider, to the coaster you pick, then removes this
              entry from the catalogue. There is no undo.
            </p>
            <MergeDialog
              loser={{ id: coaster.id, name: coaster.name }}
              candidates={mergeCandidates}
              trigger={
                <Button variant="outline" size="sm" className="min-h-11">
                  Merge into another coaster
                </Button>
              }
            />
          </CardContent>
        </Card>
      )}
    </div>
  )
}
