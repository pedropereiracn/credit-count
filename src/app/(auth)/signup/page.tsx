import type { Metadata } from 'next'
import Link from 'next/link'
import { AuthShell } from '@/components/auth/auth-shell'
import { SignupForm } from '@/components/auth/signup-form'

export const metadata: Metadata = {
  title: 'Sign up',
  description: 'Create a Credit Count account and start logging the coasters you have ridden.',
}

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>
}) {
  const { next } = await searchParams

  return (
    <AuthShell
      heading="Start your count"
      lead="Every coaster you have ever ridden, one number."
      footer={
        <>
          Already counting?{' '}
          <Link href={next ? `/login?next=${encodeURIComponent(next)}` : '/login'} className="text-primary hover:underline">
            Log in
          </Link>
        </>
      }
    >
      <SignupForm next={next ?? '/dashboard'} />
    </AuthShell>
  )
}
