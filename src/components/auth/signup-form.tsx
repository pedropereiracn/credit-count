'use client'

import { useActionState } from 'react'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { signup, type AuthState } from '@/app/(auth)/actions'
import { FormMessage } from '@/components/auth/form-message'
import { TextField } from '@/components/auth/text-field'
import { PasswordField } from '@/components/auth/password-field'

const initialState: AuthState = { formError: null, fieldErrors: {}, values: { email: '', displayName: '' } }

/** Sign-up: email, password, display name, always through the Server Action
 * (`signup` never runs `auth.signUp` on the client, per the brief). */
export function SignupForm({ next }: { next: string }) {
  const [state, formAction, pending] = useActionState<AuthState, FormData>(signup, initialState)

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="next" value={next} />

      {state.formError && <FormMessage tone="error">{state.formError}</FormMessage>}

      <TextField
        label="Email"
        name="email"
        type="email"
        autoComplete="email"
        placeholder="you@example.com"
        defaultValue={state.values.email}
        error={state.fieldErrors.email}
      />
      <PasswordField
        label="Password"
        name="password"
        autoComplete="new-password"
        placeholder="At least 6 characters"
        error={state.fieldErrors.password}
      />
      <TextField
        label="Display name"
        name="displayName"
        autoComplete="nickname"
        placeholder="How you want to appear"
        defaultValue={state.values.displayName}
        helpText="2 to 40 characters. Only shown on the leaderboard if you switch that on later."
        error={state.fieldErrors.displayName}
      />

      <Button type="submit" size="lg" className="w-full" disabled={pending}>
        {pending && <Loader2 className="animate-spin" aria-hidden="true" />}
        Create account
      </Button>
    </form>
  )
}
