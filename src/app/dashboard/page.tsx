import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { EmptyState } from '@/components/empty-state'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { CreditHeadline } from '@/components/dashboard/credit-headline'
import { BreakdownCard, type BreakdownRow } from '@/components/dashboard/breakdown-card'
import { MostRiddenCard } from '@/components/dashboard/most-ridden-card'
import { RecentRidesCard, type RecentRideRow } from '@/components/dashboard/recent-rides-card'
import { RideLogger } from '@/components/dashboard/ride-logger'
import { countryName, TRACK_TYPE_LABELS } from '@/lib/format'
import { searchCoasters } from './actions'

export const metadata = { title: 'Dashboard' }

const TRACK_TYPES = Object.keys(TRACK_TYPE_LABELS)

type RecentRideQueryRow = {
  id: string
  ridden_on: string
  note: string | null
  coaster: { name: string; park: { name: string } | null } | null
}

/**
 * The most important screen in the product (see this agent's brief): the credit
 * headline, the four breakdowns, recent rides, and the three-tap ride logger.
 *
 * Every statistic below is read from one of the five views declared
 * `security_invoker = true` in supabase/migrations/20260909000004_views.sql, as
 * the signed-in caller. None of the five is ever filtered by `.eq('user_id', ...)`:
 * the policy on `rides` already does that scoping, once, and every view inherits
 * it (docs/TDD.md section 2). Recent rides is the one read that is not a view,
 * since there is no view for it; it reads `rides` directly and, for the same
 * reason, never adds a user filter either.
 */
export default async function DashboardPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [
    totalsResult,
    byCountryResult,
    byManufacturerResult,
    byTypeResult,
    mostRiddenResult,
    recentRidesResult,
    initialSearch,
  ] = await Promise.all([
    supabase.from('my_totals').select('credits, rides').single(),
    supabase.from('my_credits_by_country').select('country_code, credits'),
    supabase.from('my_credits_by_manufacturer').select('manufacturer, credits'),
    supabase.from('my_credits_by_type').select('track_type, credits'),
    // Zero rides means zero groups out of `my_most_ridden`'s `limit 1`, not a
    // missing single row, so this reads with maybeSingle rather than single.
    supabase.from('my_most_ridden').select('coaster_id, name, park_name, rides, last_ridden').maybeSingle(),
    supabase
      .from('rides')
      .select('id, ridden_on, note, coaster:coasters(name, park:parks(name))')
      .order('ridden_on', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(5),
    searchCoasters('', 1),
  ])

  const credits = totalsResult.data?.credits ?? 0
  const totalRides = totalsResult.data?.rides ?? 0

  const byCountry: BreakdownRow[] = (byCountryResult.data ?? []).map((row) => ({
    label: countryName(row.country_code ?? ''),
    credits: row.credits ?? 0,
  }))

  const byManufacturer: BreakdownRow[] = (byManufacturerResult.data ?? []).map((row) => ({
    label: row.manufacturer ?? 'Unknown',
    credits: row.credits ?? 0,
  }))

  // The three track types are a closed set (docs/TDD.md section 1), so every one
  // gets a bar even at zero: the prototype does the same, and it is what makes
  // "which type am I missing" legible at a glance.
  const typeCredits = new Map(
    (byTypeResult.data ?? []).map((row) => [row.track_type, row.credits ?? 0]),
  )
  const byType: BreakdownRow[] = TRACK_TYPES.map((type) => ({
    label: TRACK_TYPE_LABELS[type],
    credits: typeCredits.get(type) ?? 0,
  }))

  const mostRiddenRow = mostRiddenResult.data
  const mostRidden = mostRiddenRow
    ? {
        name: mostRiddenRow.name ?? '',
        parkName: mostRiddenRow.park_name ?? '',
        rides: mostRiddenRow.rides ?? 0,
        lastRidden: mostRiddenRow.last_ridden ?? '',
      }
    : null

  const recentRidesRows = (recentRidesResult.data ?? []) as unknown as RecentRideQueryRow[]
  const recentRides: RecentRideRow[] = recentRidesRows.map((row) => ({
    id: row.id,
    coasterName: row.coaster?.name ?? 'Unknown coaster',
    parkName: row.coaster?.park?.name ?? '',
    riddenOn: row.ridden_on,
    note: row.note,
  }))

  return (
    <div className="space-y-10">
      <section className="grid gap-6 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:items-start">
        <CreditHeadline credits={credits} rides={totalRides} />

        <Card>
          <CardHeader>
            <CardTitle className="font-heading text-xl font-bold">Log a ride</CardTitle>
            <p className="text-sm text-muted-foreground">Search, pick, confirm. Three taps.</p>
          </CardHeader>
          <CardContent>
            <RideLogger initialRows={initialSearch.rows} initialHasMore={initialSearch.hasMore} />
          </CardContent>
        </Card>
      </section>

      {credits === 0 ? (
        <EmptyState title="No credits yet. Your track is flat.">
          A <strong className="text-foreground">credit</strong> is one coaster you have ridden at
          least once. Ride it again and your rides go up, but the credit stays one. Search above to
          log your first ride, starters like Stealth or Nemesis Reborn are a good place to begin, and
          your stats by country, manufacturer and track type will appear right here.
        </EmptyState>
      ) : (
        <section className="grid gap-4 lg:grid-cols-12">
          <BreakdownCard
            title="Credits by country"
            rows={byCountry}
            emptyMessage="No country yet."
            className="lg:col-span-3"
          />
          <BreakdownCard
            title="Credits by manufacturer"
            rows={byManufacturer}
            emptyMessage="No manufacturer yet."
            className="lg:col-span-5"
          />
          <BreakdownCard
            title="Credits by track type"
            rows={byType}
            emptyMessage="No track type yet."
            className="lg:col-span-4"
          />
          <MostRiddenCard coaster={mostRidden} className="lg:col-span-4" />
          <RecentRidesCard rides={recentRides} totalRides={totalRides} className="lg:col-span-8" />
        </section>
      )}
    </div>
  )
}
