import { SignOutButton } from '@/components/sign-out-button'

/** Read-only: the address the account signs in with, and a way out. Matches
 * the reference prototype's `#/settings` third card. */
export function AccountCard({ email }: { email: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-6">
      <h2 className="font-heading text-lg font-bold">Account</h2>
      <p className="mt-1 text-sm text-muted-foreground">{email}</p>
      <div className="mt-4">
        <SignOutButton />
      </div>
    </div>
  )
}
