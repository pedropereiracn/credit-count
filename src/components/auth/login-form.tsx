'use client'

import { useActionState } from 'react'
import Link from 'next/link'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { login, type AuthState } from '@/app/(auth)/actions'
import { FormMessage } from '@/components/auth/form-message'
import { TextField } from '@/components/auth/text-field'
import { PasswordField } from '@/components/auth/password-field'

const initialState: AuthState = { formError: null, fieldErrors: {}, values: { email: '', displayName: '' } }

/** Sign-in: email and password, through the `login` Server Action. */
export function LoginForm({ next }: { next: string }) {
  const [state, formAction, pending] = useActionState<AuthState, FormData>(login, initialState)

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
        labelExtra={
          <Link href="/forgot-password" className="text-xs font-bold text-primary hover:underline">
            Forgot password?
          </Link>
        }
        name="password"
        autoComplete="current-password"
        placeholder="Your password"
        error={state.fieldErrors.password}
      />

      <Button type="submit" size="lg" className="w-full" disabled={pending}>
        {pending && <Loader2 className="animate-spin" aria-hidden="true" />}
        Log in
      </Button>
    </form>
  )
}
