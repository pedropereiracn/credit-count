'use client'

import { useActionState } from 'react'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  resetPassword,
  type ResetPasswordState,
} from '@/app/(auth)/actions'
import { FormMessage } from '@/components/auth/form-message'
import { PasswordField } from '@/components/auth/password-field'

const initialState: ResetPasswordState = { formError: null, fieldErrors: {} }

/** The last step of the recovery flow: the visitor already holds a recovery
 * session (set server-side by `src/app/auth/confirm/route.ts`), so this only
 * asks for and confirms the new password before calling `auth.updateUser`. */
export function ResetPasswordForm() {
  const [state, formAction, pending] = useActionState<ResetPasswordState, FormData>(
    resetPassword,
    initialState,
  )

  return (
    <form action={formAction} className="space-y-4">
      {state.formError && <FormMessage tone="error">{state.formError}</FormMessage>}

      <PasswordField
        label="New password"
        name="password"
        autoComplete="new-password"
        placeholder="At least 6 characters"
        error={state.fieldErrors.password}
      />
      <PasswordField
        label="Confirm new password"
        name="confirmPassword"
        autoComplete="new-password"
        placeholder="Type it again"
        error={state.fieldErrors.confirmPassword}
      />

      <Button type="submit" size="lg" className="min-h-11 w-full" disabled={pending}>
        {pending && <Loader2 className="animate-spin" aria-hidden="true" />}
        Set new password
      </Button>
    </form>
  )
}
