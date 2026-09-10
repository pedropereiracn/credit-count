import { Suspense } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { EmptyState } from '@/components/empty-state'
import { RowsSkeleton } from '@/components/skeletons'
import { Button } from '@/components/ui/button'
import { LeaderboardList } from '@/components/leaderboard/leaderboard-list'
import { LeaderboardPagination } from '@/components/leaderboard/leaderboard-pagination'
import { AboutCredits } from '@/components/leaderboard/about-credits'
import type { LeaderboardRow } from '@/components/leaderboard/types'

/**
 * The public leaderboard: a visitor's front door to the product. FR7 says opting out
 * has to land on the next request, and a cached page is exactly what would break
 * that, so this route is never allowed to serve a stale copy.
 */
export const dynamic = 'force-dynamic'

/**
 * `leaderboard()` caps a page at 100 rows on its own; this asks for fewer, it never
 * asks for more. See supabase/migrations/20260909000003_functions.sql.
 */
const PAGE_SIZE = 25

type HomePageProps = {
  searchParams: Promise<{ page?: string }>
}

export default async function HomePage({ searchParams }: HomePageProps) {
  const { page: pageParam } = await searchParams

  // The header already reflects the session; the aside must too, or it offers a
  // signed-in visitor an account they already have.
  const supabaseAuth = await createClient()
  const { data: { user } } = await supabaseAuth.auth.getUser()

  // Who the viewer is, to tint their own row. Both reads are the viewer's own,
  // scoped by RLS: their profile (name, and whether they even appear) and their
  // credit total. If they have not opted in, there is no row to mark, so `you`
  // stays null. This never touches the public leaderboard function.
  let you: { name: string; credits: number } | null = null
  if (user) {
    const [{ data: profile }, { data: totals }] = await Promise.all([
      supabaseAuth.from('profiles').select('display_name, show_on_leaderboard').eq('id', user.id).single(),
      supabaseAuth.from('my_totals').select('credits').single(),
    ])
    if (profile?.show_on_leaderboard && profile.display_name) {
      you = { name: profile.display_name, credits: totals?.credits ?? 0 }
    }
  }
  const page = Math.max(1, Number.parseInt(pageParam ?? '1', 10) || 1)

  return (
    <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_18rem] lg:items-start">
      <section className="min-w-0">
        <header>
          <p className="text-xs font-bold tracking-[0.14em] text-primary uppercase">
            Public leaderboard
          </p>
          <h1 className="mt-1 font-heading text-3xl font-bold tracking-tight sm:text-4xl">
            Most credits
          </h1>
          <p className="mt-3 max-w-prose text-sm leading-relaxed font-semibold text-muted-foreground sm:text-base">
            A <span className="text-foreground">credit</span> is one coaster you have ridden
            at least once, however many times you ride it again. Ranked by credits, highest
            first; ties share a rank.
          </p>
        </header>

        <div className="mt-8">
          <Suspense fallback={<RowsSkeleton rows={10} />}>
            <LeaderboardSection page={page} you={you} />
          </Suspense>
        </div>
      </section>

      <AboutCredits signedIn={!!user} />
    </div>
  )
}

async function LeaderboardSection({
  page,
  you,
}: {
  page: number
  you: { name: string; credits: number } | null
}) {
  const offset = (page - 1) * PAGE_SIZE

  // The only sanctioned crossing of the `profiles`/`rides` boundary on this page.
  // Never `.from('profiles')` or `.from('rides')` here: docs/TDD.md section 4.
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('leaderboard', {
    page_size: PAGE_SIZE,
    page_offset: offset,
  })

  if (error) {
    console.error('leaderboard rpc failed', error)
    return (
      <EmptyState title="The leaderboard could not be loaded.">
        Reloading the page usually fixes this. Nothing about your own account depends on it.
      </EmptyState>
    )
  }

  const rows = (data ?? []) as LeaderboardRow[]

  if (rows.length === 0) {
    if (page === 1) {
      return (
        <EmptyState
          title="Nobody is on the board yet."
          action={
            <Button asChild className="min-h-11">
              <Link href="/signup">Sign up</Link>
            </Button>
          }
        >
          Enthusiasts show up here only after switching on the public leaderboard from their
          settings. Be the first.
        </EmptyState>
      )
    }

    return (
      <EmptyState
        title="No more results."
        action={
          <Button asChild variant="outline" className="min-h-11">
            <Link href="/">Back to the top</Link>
          </Button>
        }
      >
        That is every enthusiast currently on the board.
      </EmptyState>
    )
  }

  return (
    <>
      <LeaderboardList rows={rows} you={you} />
      <LeaderboardPagination
        page={page}
        hasPrevious={page > 1}
        hasNext={rows.length === PAGE_SIZE}
      />
    </>
  )
}
