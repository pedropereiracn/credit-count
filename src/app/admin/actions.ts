'use server'

/**
 * Server Actions for the admin catalogue. Every one of these runs with the
 * caller's own session, via createClient() from `@/lib/supabase/server`, never
 * an elevated key (CLAUDE.md rule 1).
 *
 * Every action re-checks the caller is an admin before touching anything. The
 * admin/layout.tsx guard covers page loads, but a Server Action is a public
 * endpoint of its own, reachable independently of how the page that renders
 * its form got there. None of this is the actual control, though: the RLS
 * policies on coasters/parks/manufacturers (is_admin(), see
 * supabase/migrations/20260909000002_security.sql) refuse the write regardless
 * of what this file decides. The check here only turns that refusal into a
 * clear message instead of a raw Postgres error (docs/TDD.md section 3).
 *
 * One honest limit, documented rather than worked around: this file cannot
 * show how many rides will move in a merge, or whether a coaster has any
 * rides at all, before attempting the operation. SOW §3 and CLAUDE.md rule 2
 * mean an admin's session has no policy that lets it read another rider's
 * rides, not even a count, so there is no query this action could run to
 * preview that number honestly. `merge_coasters` is the one place that count
 * becomes visible, and only because it is SECURITY DEFINER and moves the rows
 * in the same breath. Delete works the same way: the only way to find out
 * whether a coaster has zero rides is to attempt the delete and read whether
 * the foreign key refused it. Both flows below attempt first and report the
 * real result, rather than a client-side guess dressed up as one.
 */

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

type SupabaseClient = Awaited<ReturnType<typeof createClient>>

const TRACK_TYPES = ['steel', 'wooden', 'hybrid'] as const

export type CoasterFormState = {
  formError: string | null
  fieldErrors: Partial<Record<'name' | 'park' | 'manufacturer' | 'trackType', string>>
}

export type ActionResult = { ok: true } | { ok: false; error: string }
export type MergeResult = { ok: true; moved: number } | { ok: false; error: string }

function todayISO(): string {
  return new Date().toISOString().slice(0, 10)
}

/**
 * Re-checked on every action below, never trusted from the page that called
 * it. Redirect here is deliberate and must never be wrapped in a try/catch:
 * Next.js implements redirect() by throwing, and swallowing that throw would
 * turn a redirect into a silently failed action.
 */
async function requireAdmin(): Promise<SupabaseClient> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

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

  return supabase
}

/**
 * Resolves the park a coaster belongs to, writing a new lookup row in the same
 * submit when the admin picked "add new" in the combobox instead of an
 * existing park (AGENTS.md A6 task 2: one form, not three).
 */
async function resolveParkId(
  supabase: SupabaseClient,
  formData: FormData,
): Promise<{ id: string } | { error: string }> {
  const mode = String(formData.get('park_mode') ?? 'existing')

  if (mode === 'new') {
    const rawName = String(formData.get('park_new_name') ?? '').trim()
    const country = String(formData.get('park_new_country') ?? '').trim().toUpperCase()

    if (rawName.length < 2 || rawName.length > 80) {
      return { error: 'Park name must be between 2 and 80 characters.' }
    }
    if (!/^[A-Z]{2}$/.test(country)) {
      return { error: 'Country code must be two letters, like GB or US.' }
    }

    const { data, error } = await supabase
      .from('parks')
      .insert({ name: rawName, country_code: country })
      .select('id')
      .single()

    if (error) {
      if (error.code === '23505') {
        return { error: `A park called "${rawName}" already exists. Search for it instead of adding it again.` }
      }
      return { error: 'Could not create that park. Try again.' }
    }

    return { id: data.id as string }
  }

  const id = String(formData.get('park_id') ?? '')
  if (!id) {
    return { error: 'Pick a park, or add a new one.' }
  }
  return { id }
}

/** Same idea as resolveParkId, but a manufacturer may also be left unknown (schema allows null; the dashboard views coalesce it to "Unknown"). */
async function resolveManufacturerId(
  supabase: SupabaseClient,
  formData: FormData,
): Promise<{ id: string | null } | { error: string }> {
  const mode = String(formData.get('manufacturer_mode') ?? 'unknown')

  if (mode === 'unknown') {
    return { id: null }
  }

  if (mode === 'new') {
    const rawName = String(formData.get('manufacturer_new_name') ?? '').trim()
    if (rawName.length < 2 || rawName.length > 80) {
      return { error: 'Manufacturer name must be between 2 and 80 characters.' }
    }

    const { data, error } = await supabase
      .from('manufacturers')
      .insert({ name: rawName })
      .select('id')
      .single()

    if (error) {
      if (error.code === '23505') {
        return { error: `A manufacturer called "${rawName}" already exists. Search for it instead of adding it again.` }
      }
      return { error: 'Could not create that manufacturer. Try again.' }
    }

    return { id: data.id as string }
  }

  const id = String(formData.get('manufacturer_id') ?? '')
  if (!id) {
    return { error: 'Pick a manufacturer, mark it unknown, or add a new one.' }
  }
  return { id }
}

function readCoasterBasics(formData: FormData) {
  const name = String(formData.get('name') ?? '').trim()
  const trackType = String(formData.get('track_type') ?? '')
  const retired = formData.get('retired') === '1'
  const existingRetiredAt = String(formData.get('existing_retired_at') ?? '')

  const fieldErrors: CoasterFormState['fieldErrors'] = {}
  if (name.length < 2 || name.length > 120) {
    fieldErrors.name = 'Name must be between 2 and 120 characters.'
  }
  if (!TRACK_TYPES.includes(trackType as (typeof TRACK_TYPES)[number])) {
    fieldErrors.trackType = 'Pick a track type.'
  }

  return {
    name,
    trackType,
    retiredAt: retired ? existingRetiredAt || todayISO() : null,
    fieldErrors,
  }
}

export async function createCoaster(
  _prevState: CoasterFormState,
  formData: FormData,
): Promise<CoasterFormState> {
  const supabase = await requireAdmin()

  const { name, trackType, retiredAt, fieldErrors } = readCoasterBasics(formData)
  if (Object.keys(fieldErrors).length > 0) {
    return { formError: null, fieldErrors }
  }

  const parkResult = await resolveParkId(supabase, formData)
  if ('error' in parkResult) fieldErrors.park = parkResult.error

  const mfrResult = await resolveManufacturerId(supabase, formData)
  if ('error' in mfrResult) fieldErrors.manufacturer = mfrResult.error

  if (Object.keys(fieldErrors).length > 0) {
    return { formError: null, fieldErrors }
  }

  const { error } = await supabase.from('coasters').insert({
    name,
    park_id: (parkResult as { id: string }).id,
    manufacturer_id: (mfrResult as { id: string | null }).id,
    track_type: trackType,
    retired_at: retiredAt,
  })

  if (error) {
    if (error.code === '23505') {
      return {
        formError: `"${name}" already exists at this park. Search the catalogue before adding a duplicate, or merge it in afterwards.`,
        fieldErrors: {},
      }
    }
    return { formError: 'Could not save the coaster. Try again.', fieldErrors: {} }
  }

  revalidatePath('/admin')
  redirect('/admin')
}

export async function updateCoaster(
  id: string,
  _prevState: CoasterFormState,
  formData: FormData,
): Promise<CoasterFormState> {
  const supabase = await requireAdmin()

  const { name, trackType, retiredAt, fieldErrors } = readCoasterBasics(formData)
  if (Object.keys(fieldErrors).length > 0) {
    return { formError: null, fieldErrors }
  }

  const parkResult = await resolveParkId(supabase, formData)
  if ('error' in parkResult) fieldErrors.park = parkResult.error

  const mfrResult = await resolveManufacturerId(supabase, formData)
  if ('error' in mfrResult) fieldErrors.manufacturer = mfrResult.error

  if (Object.keys(fieldErrors).length > 0) {
    return { formError: null, fieldErrors }
  }

  const { error } = await supabase
    .from('coasters')
    .update({
      name,
      park_id: (parkResult as { id: string }).id,
      manufacturer_id: (mfrResult as { id: string | null }).id,
      track_type: trackType,
      retired_at: retiredAt,
    })
    .eq('id', id)

  if (error) {
    if (error.code === '23505') {
      return {
        formError: `"${name}" already exists at this park. Search the catalogue before renaming into a duplicate, or merge them instead.`,
        fieldErrors: {},
      }
    }
    return { formError: 'Could not save the coaster. Try again.', fieldErrors: {} }
  }

  revalidatePath('/admin')
  redirect('/admin')
}

/** Retire and reopen, used by the toggle button on each catalogue row. Reversible, so it needs no confirmation, unlike delete and merge. */
export async function setRetired(id: string, retired: boolean): Promise<ActionResult> {
  const supabase = await requireAdmin()

  const { error } = await supabase
    .from('coasters')
    .update({ retired_at: retired ? todayISO() : null })
    .eq('id', id)

  if (error) {
    return { ok: false, error: 'Could not update this coaster. Try again.' }
  }

  revalidatePath('/admin')
  return { ok: true }
}

/**
 * Allowed only when the coaster has no rides. The foreign key
 * (rides.coaster_id references coasters, on delete restrict) is what actually
 * refuses this, not a check performed here first: there is no query this
 * action can run beforehand that would see rides belonging to other riders
 * (docs/TDD.md section 7, "removing a coaster is three operations").
 */
export async function deleteCoaster(id: string): Promise<ActionResult> {
  const supabase = await requireAdmin()

  const { error } = await supabase.from('coasters').delete().eq('id', id)

  if (error) {
    if (error.code === '23503') {
      return {
        ok: false,
        error:
          'This coaster has rides logged against it, so it cannot be deleted. Retire it instead to hide it while keeping those credits, or merge it into a duplicate.',
      }
    }
    return { ok: false, error: 'Could not delete this coaster. Try again.' }
  }

  revalidatePath('/admin')
  return { ok: true }
}

/**
 * Calls the one SECURITY DEFINER function that can see rides across every
 * rider. It moves the rows and returns the count in the same call; there is
 * no separate preview step, for the reason explained at the top of this file.
 */
export async function mergeCoasters(survivorId: string, loserId: string): Promise<MergeResult> {
  const supabase = await requireAdmin()

  if (!survivorId || !loserId) {
    return { ok: false, error: 'Pick the coaster that survives.' }
  }
  if (survivorId === loserId) {
    return { ok: false, error: 'Pick two different coasters.' }
  }

  const { data, error } = await supabase.rpc('merge_coasters', {
    survivor: survivorId,
    loser: loserId,
  })

  if (error) {
    return { ok: false, error: error.message || 'Could not merge these coasters. Try again.' }
  }

  revalidatePath('/admin')
  return { ok: true, moved: typeof data === 'number' ? data : 0 }
}
