import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Button } from '@/components/ui/button'
import { SignOutButton } from '@/components/sign-out-button'
import { CoasterMark } from '@/components/coaster-mark'

/**
 * The one header, on every page. Phase 0 owns it precisely so that no screen agent
 * needs to touch it: it already links every route the app will have.
 *
 * The admin link appears only for admins. That is a courtesy, not a control: the
 * middleware also blocks the route, and the database refuses the writes regardless.
 * Only the third of those three actually protects anything (docs/TDD.md section 3).
 */
export async function AppHeader() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  let isAdmin = false
  let displayName: string | null = null

  if (user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('display_name, role')
      .eq('id', user.id)
      .single()
    isAdmin = profile?.role === 'admin'
    displayName = profile?.display_name ?? null
  }

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/85 backdrop-blur">
      <div className="mx-auto flex h-16 w-full max-w-5xl items-center gap-2 px-4 sm:px-6">
        <Link href="/" className="flex shrink-0 items-center gap-2">
          <CoasterMark className="h-7 w-auto text-primary" />
          <span className="font-heading text-lg font-bold tracking-tight">
            Credit<span className="text-primary">Count</span>
          </span>
        </Link>

        {user && (
          <nav className="ml-4 hidden items-center gap-1 sm:flex">
            <NavLink href="/dashboard">Dashboard</NavLink>
            <NavLink href="/rides">My rides</NavLink>
            {isAdmin && <NavLink href="/admin">Catalogue</NavLink>}
            <NavLink href="/settings">Settings</NavLink>
          </nav>
        )}

        <div className="ml-auto flex items-center gap-2">
          {user ? (
            <>
              <span className="hidden text-sm font-semibold text-muted-foreground md:inline">
                {displayName}
              </span>
              <SignOutButton />
            </>
          ) : (
            <>
              <Button asChild variant="outline" size="sm">
                <Link href="/login">Log in</Link>
              </Button>
              <Button asChild size="sm">
                <Link href="/signup">Sign up</Link>
              </Button>
            </>
          )}
        </div>
      </div>

      {user && (
        <nav className="flex items-center gap-1 overflow-x-auto border-t border-border px-4 py-2 sm:hidden">
          <NavLink href="/dashboard">Dashboard</NavLink>
          <NavLink href="/rides">My rides</NavLink>
          {isAdmin && <NavLink href="/admin">Catalogue</NavLink>}
          <NavLink href="/settings">Settings</NavLink>
        </nav>
      )}
    </header>
  )
}

function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="rounded-lg px-3 py-2 text-sm font-bold text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
    >
      {children}
    </Link>
  )
}
