'use server'

/**
 * Server Actions owned by A4: searching/browsing the catalogue and logging a
 * ride. Every read here runs as the caller (`createClient()` from
 * `@/lib/supabase/server`), never an elevated key, and never adds
 * `.eq('user_id', ...)`: `rides` is already scoped by its own RLS policy
 * (docs/TDD.md section 3), so a redundant filter here would only hide it if that
 * policy ever broke. Every mutation calls `revalidatePath` so the dashboard's
 * headline and every breakdown move with no manual refresh (FR5).
 */

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { CoasterSearchRow } from '@/components/dashboard/types'

const PAGE_SIZE = 8

type CoasterCatalogueRow = {
  id: string
  name: string
  track_type: string
  retired_at: string | null
  park: { name: string; country_code: string } | null
  manufacturer: { name: string } | null
}

/**
 * The catalogue is 46 coasters (docs/TDD.md section 1): small enough to read once
 * and filter/paginate here, on the server, rather than reach for an `or()` across
 * two joined tables in PostgREST. An empty query returns the first page of
 * everything, which is what makes this the browse surface too (SOW §4.1, task 4).
 */
export async function searchCoasters(
  query: string,
  page = 1,
): Promise<{ rows: CoasterSearchRow[]; hasMore: boolean; page: number }> {
  const supabase = await createClient()

  const [{ data: catalogue, error: catalogueError }, { data: ownRides }] = await Promise.all([
    supabase
      .from('coasters')
      .select(
        'id, name, track_type, retired_at, park:parks(name, country_code), manufacturer:manufacturers(name)',
      )
      .order('name'),
    // Own rides only: rides_le_proprias already restricts this to auth.uid(), so
    // no `.eq('user_id', ...)` belongs here (AGENTS.md, A4, task 2's warning).
    supabase.from('rides').select('coaster_id'),
  ])

  if (catalogueError || !catalogue) {
    console.error('coaster catalogue read failed', catalogueError)
    return { rows: [], hasMore: false, page: 1 }
  }

  const rows = catalogue as unknown as CoasterCatalogueRow[]
  const riddenIds = new Set((ownRides ?? []).map((r) => r.coaster_id))

  const q = query.trim().toLowerCase()
  // Retiring hides a coaster from browsing but keeps it searchable (docs/TDD.md
  // sections 2 and 7): a demolished coaster is still a credit someone can log, so a
  // typed search finds it (with its Retired badge), but the default browse list does
  // not clutter with coasters that no longer stand.
  const matches = q
    ? rows.filter(
        (c) => c.name.toLowerCase().includes(q) || (c.park?.name ?? '').toLowerCase().includes(q),
      )
    : rows.filter((c) => !c.retired_at)

  const safePage = Math.max(1, Math.floor(page) || 1)
  const start = (safePage - 1) * PAGE_SIZE
  const pageRows = matches.slice(start, start + PAGE_SIZE)

  return {
    rows: pageRows.map((c) => ({
      id: c.id,
      name: c.name,
      trackType: c.track_type,
      retiredAt: c.retired_at,
      parkName: c.park?.name ?? 'Unknown park',
      countryCode: c.park?.country_code ?? '',
      manufacturerName: c.manufacturer?.name ?? null,
      alreadyRidden: riddenIds.has(c.id),
    })),
    hasMore: start + PAGE_SIZE < matches.length,
    page: safePage,
  }
}

export type LogRideState = {
  error: string | null
}

/**
 * `rides` has two check constraints a bad request can still hit even after the
 * form's own validation (a future date past the `max`, a note over 280 chars via
 * a direct request): translate those into the same sentence a person would read
 * on the form, instead of a raw Postgres constraint name.
 */
const CONSTRAINT_MESSAGES: Record<string, string> = {
  rides_data_nao_futura: "That date hasn't happened yet.",
  rides_nota_tamanho: 'Keep the note to 280 characters or fewer.',
}

function rideErrorMessage(message: string): string {
  for (const [constraint, friendly] of Object.entries(CONSTRAINT_MESSAGES)) {
    if (message.includes(constraint)) return friendly
  }
  return 'Could not log that ride. Try again.'
}

/**
 * Step three of three: type, click a result, confirm. This is the confirm.
 * `user_id` comes from the session, never from the form: the `with check` on
 * `rides_insere_proprias` would refuse a mismatch anyway, but there is no reason
 * to trust the client for it in the first place.
 */
export async function logRide(_prev: LogRideState, formData: FormData): Promise<LogRideState> {
  const coasterId = String(formData.get('coasterId') ?? '')
  const riddenOn = String(formData.get('riddenOn') ?? '')
  const note = String(formData.get('note') ?? '').trim()

  if (!coasterId) return { error: 'Pick a coaster first.' }
  if (!riddenOn) return { error: 'Pick a date.' }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { error } = await supabase.from('rides').insert({
    user_id: user.id,
    coaster_id: coasterId,
    ridden_on: riddenOn,
    note: note.length > 0 ? note : null,
  })

  if (error) {
    console.error('log ride failed', error)
    return { error: rideErrorMessage(error.message) }
  }

  revalidatePath('/dashboard')
  revalidatePath('/rides')
  return { error: null }
}
