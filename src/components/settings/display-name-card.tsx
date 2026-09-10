'use client'

import { useActionState } from 'react'
import { AlertCircle, CheckCircle2, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { updateDisplayName, type DisplayNameState } from '@/app/settings/actions'

/**
 * Same validation as sign-up, same pattern as sign-up: `useActionState` bound to
 * `<form action>`, the failed value echoed back so a rejected attempt does not
 * also cost the visitor their typing (see the comment on `AuthState` in
 * `src/app/(auth)/actions.ts`, which this mirrors).
 */
export function DisplayNameCard({ initialName }: { initialName: string }) {
  const initialState: DisplayNameState = { error: null, success: false, value: initialName }
  const [state, formAction, pending] = useActionState<DisplayNameState, FormData>(
    updateDisplayName,
    initialState,
  )

  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-6">
      <h2 className="font-heading text-lg font-bold">Display name</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Shown on the leaderboard, if you choose to appear.
      </p>

      <form action={formAction} className="mt-4 space-y-4">
        {state.error && (
          <p
            role="alert"
            className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-sm font-semibold text-destructive"
          >
            <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            <span>{state.error}</span>
          </p>
        )}
        {state.success && (
          <p
            role="status"
            className="flex items-start gap-2 rounded-lg border border-primary/25 bg-accent px-3 py-2.5 text-sm font-semibold text-accent-foreground"
          >
            <CheckCircle2 className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            <span>Display name updated.</span>
          </p>
        )}

        <div className="space-y-1.5">
          <Label htmlFor="displayName">Display name</Label>
          <Input
            id="displayName"
            name="displayName"
            autoComplete="nickname"
            defaultValue={state.value}
            required
            aria-invalid={Boolean(state.error)}
          />
          <p className="text-xs font-medium text-muted-foreground">2 to 40 characters.</p>
        </div>

        <Button type="submit" disabled={pending}>
          {pending && <Loader2 className="animate-spin" aria-hidden="true" />}
          Save
        </Button>
      </form>
    </div>
  )
}
