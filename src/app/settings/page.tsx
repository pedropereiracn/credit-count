import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { EmptyState } from '@/components/empty-state'
import { DisplayNameCard } from '@/components/settings/display-name-card'
import { LeaderboardToggleCard } from '@/components/settings/leaderboard-toggle-card'
import { AccountCard } from '@/components/settings/account-card'

export const metadata: Metadata = {
  title: 'Settings',
  description: 'Edit your display name and control whether you appear on the public leaderboard.',
}

export default async function SettingsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // The proxy (src/lib/supabase/proxy.ts) already keeps a signed-out visitor off
  // this route; this is only the fallback if that session has expired mid-visit.
  if (!user) {
    return (
      <EmptyState title="Your session has expired.">Sign in again to see your settings.</EmptyState>
    )
  }

  const [{ data: profile, error: profileError }, { data: totals }] = await Promise.all([
    supabase.from('profiles').select('display_name, show_on_leaderboard').eq('id', user.id).single(),
    // The credit count in the leaderboard sentence below comes from here, never
    // computed in TypeScript: `count(distinct coaster_id)` lives in the view
    // (docs/TDD.md section 1), this only reads it.
    supabase.from('my_totals').select('credits, rides').single(),
  ])

  if (profileError || !profile) {
    return (
      <EmptyState title="Your settings could not be loaded.">
        Reloading the page usually fixes this. Nothing has been changed.
      </EmptyState>
    )
  }

  return (
    <div className="mx-auto w-full max-w-xl">
      <header>
        <h1 className="font-heading text-3xl font-bold tracking-tight sm:text-4xl">Settings</h1>
      </header>

      <div className="mt-8 space-y-6">
        <DisplayNameCard initialName={profile.display_name} />
        <LeaderboardToggleCard
          initialVisible={profile.show_on_leaderboard}
          displayName={profile.display_name}
          credits={totals?.credits ?? 0}
        />
        <AccountCard email={user.email ?? ''} />
      </div>
    </div>
  )
}
