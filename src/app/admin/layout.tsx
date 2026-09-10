import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

/**
 * Every route under /admin passes through here first.
 *
 * This is the second of three layers, and the least important one. The header
 * already hides the admin link from non-admins, and the database refuses the
 * writes regardless of what this layout decides (docs/TDD.md section 3). This
 * check exists so a signed-in enthusiast who types the URL sees a redirect
 * instead of a broken or half-loaded admin screen, not because it is what
 * actually protects anyone's data.
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // The proxy already keeps signed-out visitors off private routes, but that
  // is a separate file this agent does not touch. Checking again here costs
  // nothing and keeps this layout correct on its own.
  if (!user) {
    redirect('/login?next=/admin')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') {
    redirect('/dashboard')
  }

  return <>{children}</>
}
