import type { Metadata } from 'next'
import { AuthShell } from '@/components/auth/auth-shell'
import { ForgotPasswordForm } from '@/components/auth/forgot-password-form'

export const metadata: Metadata = {
  title: 'Reset your password',
  description: 'Get an email link to choose a new Credit Count password.',
}

export default function ForgotPasswordPage() {
  return (
    <AuthShell heading="Reset your password" lead="We will email you a link to choose a new one.">
      <ForgotPasswordForm />
    </AuthShell>
  )
}
