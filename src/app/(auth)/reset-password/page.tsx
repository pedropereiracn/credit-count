import type { Metadata } from 'next'
import { AuthShell } from '@/components/auth/auth-shell'
import { ResetPasswordForm } from '@/components/auth/reset-password-form'

export const metadata: Metadata = {
  title: 'Choose a new password',
  description: 'Set a new password for your Credit Count account.',
}

export default function ResetPasswordPage() {
  return (
    <AuthShell heading="Choose a new password" lead="Make it something only you know.">
      <ResetPasswordForm />
    </AuthShell>
  )
}
