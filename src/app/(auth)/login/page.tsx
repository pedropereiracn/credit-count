import type { Metadata } from 'next'
import Link from 'next/link'
import { AuthShell } from '@/components/auth/auth-shell'
import { LoginForm } from '@/components/auth/login-form'
import { FormMessage } from '@/components/auth/form-message'

export const metadata: Metadata = {
  title: 'Log in',
  description: 'Log in to your Credit Count account.',
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>
}) {
  const { next, error } = await searchParams

  return (
    <AuthShell
      heading="Welcome back"
      lead="Your count is where you left it."
      footer={
        <>
          New here?{' '}
          <Link href={next ? `/signup?next=${encodeURIComponent(next)}` : '/signup'} className="text-primary hover:underline">
            Sign up
          </Link>
        </>
      }
    >
      {error === 'expired-link' && (
        <FormMessage tone="error">
          That link has expired or was already used. Request a new one from the sign-in page.
        </FormMessage>
      )}
      <LoginForm next={next ?? '/dashboard'} />
    </AuthShell>
  )
}
