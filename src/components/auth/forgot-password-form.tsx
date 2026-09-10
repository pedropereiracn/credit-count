'use client'

import { useActionState } from 'react'
import Link from 'next/link'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  requestPasswordReset,
  type ForgotPasswordState,
} from '@/app/(auth)/actions'
import { FormMessage } from '@/components/auth/form-message'
import { TextField } from '@/components/auth/text-field'

const initialState: ForgotPasswordState = { formError: null, fieldErrors: {}, success: false, values: { email: '' } }

/** Requests Supabase's default `resetPasswordForEmail` link. Success is generic on
 * purpose: Supabase itself never confirms whether the address is registered. */
export function ForgotPasswordForm() {
  const [state, formAction, pending] = useActionState<ForgotPasswordState, FormData>(
    requestPasswordReset,
    initialState,
  )

  if (state.success) {
    return (
      <FormMessage tone="success">
        If an account exists for that email, a reset link is on its way. Check your inbox.
      </FormMessage>
    )
  }

  return (
    <form action={formAction} className="space-y-4">
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

      <Button type="submit" size="lg" className="min-h-11 w-full" disabled={pending}>
        {pending && <Loader2 className="animate-spin" aria-hidden="true" />}
        Send reset link
      </Button>

      <p className="text-center text-sm font-bold text-muted-foreground">
        <Link href="/login" className="text-primary hover:underline">
          Back to log in
        </Link>
      </p>
    </form>
  )
}
