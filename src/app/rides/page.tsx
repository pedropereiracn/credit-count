import type { Metadata } from 'next'
import { Suspense } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { EmptyState } from '@/components/empty-state'
import { RowsSkeleton } from '@/components/skeletons'
import { Button } from '@/components/ui/button'
import { RidesList } from '@/components/rides/rides-list'
import { RidesPagination } from '@/components/rides/rides-pagination'
import { plural } from '@/lib/format'
import type { RideDetail } from '@/components/rides/types'

export const metadata: Metadata = {
  title: 'My rides',
  description: 'Every rollercoaster ride you have logged, newest first.',
}

/** A generous page: 43 seeded rides on the delivered enthusiast account is about
 * two pages at this size, enough to prove pagination without paging forever. */
const PAGE_SIZE = 20

type RidesPageProps = {
  searchParams: Promise<{ page?: string }>
}

export default async function RidesPage({ searchParams }: RidesPageProps) {
  const { page: pageParam } = await searchParams
  const page = Math.max(1, Number.parseInt(pageParam ?? '1', 10) || 1)

  return (
    <div className="mx-auto w-full max-w-3xl">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-heading text-3xl font-bold tracking-tight sm:text-4xl">My rides</h1>
          <p className="mt-1 text-sm font-semibold text-muted-foreground">Every ride, newest first.</p>
        </div>
        <Button asChild className="min-h-11">
          <Link href="/dashboard">Log a ride</Link>
        </Button>
      </header>

      <div className="mt-8">
        <Suspense fallback={<RowsSkeleton rows={8} />}>
          <RidesSection page={page} />
        </Suspense>
      </div>
    </div>
  )
}

async function RidesSection({ page }: { page: number }) {
  const supabase = await createClient()
  const offset = (page - 1) * PAGE_SIZE

  // Three independent reads, all scoped to the caller by the `rides` policy alone
  // (no `.eq('user_id', ...)` anywhere: see src/app/rides/actions.ts and
  // docs/TDD.md section 3). `allCoasterIds` is a plain projection used only to
  // work out, per coaster, how many rides the caller has logged on it: no view
  // serves that for every coaster at once (`my_most_ridden` caps at the single
  // most-ridden one), so this is the closest thing to it that stays true to "the
  // number comes from a real read, never invented in TypeScript".
  const [{ data, error, count }, { data: totals }, { data: allCoasterIds }] = await Promise.all([
    supabase
      .from('rides')
      .select(
        'id, ridden_on, note, coaster:coasters(id, name, track_type, park:parks(id, name), manufacturer:manufacturers(name))',
        { count: 'exact' },
      )
      .order('ridden_on', { ascending: false })
      .order('created_at', { ascending: false })
      .range(offset, offset + PAGE_SIZE - 1),
    supabase.from('my_totals').select('credits, rides').single(),
    supabase.from('rides').select('coaster_id'),
  ])

  if (error) {
    console.error('rides history failed', error)
    return (
      <EmptyState title="Your ride history could not be loaded.">
        Reloading the page usually fixes this. Nothing has been changed.
      </EmptyState>
    )
  }

  const rows = (data ?? []) as unknown as RideDetail[]

  const coasterRideCounts: Record<string, number> = {}
  for (const row of allCoasterIds ?? []) {
    const coasterId = (row as { coaster_id: string }).coaster_id
    coasterRideCounts[coasterId] = (coasterRideCounts[coasterId] ?? 0) + 1
  }

  if (rows.length === 0) {
    if (page === 1) {
      return (
        <EmptyState
          title="No rides yet."
          action={
            <Button asChild className="min-h-11">
              <Link href="/dashboard">Log a ride</Link>
            </Button>
          }
        >
          Your history starts with the first ride you log from the dashboard. Each first ride on
          a coaster is a credit; the rest are rerides.
        </EmptyState>
      )
    }

    return (
      <EmptyState
        title="No more results."
        action={
          <Button asChild variant="outline" className="min-h-11">
            <Link href="/rides">Back to the top</Link>
          </Button>
        }
      >
        That is every ride in your history.
      </EmptyState>
    )
  }

  const totalRides = totals?.rides ?? 0
  const totalCredits = totals?.credits ?? 0
  const hasNext = offset + rows.length < (count ?? rows.length)

  return (
    <>
      <p className="mb-5 text-sm font-semibold text-muted-foreground">
        {plural(totalRides, 'ride')} · {plural(totalCredits, 'credit')} · newest first
      </p>
      <RidesList rows={rows} coasterRideCounts={coasterRideCounts} />
      <RidesPagination page={page} hasPrevious={page > 1} hasNext={hasNext} />
    </>
  )
}
