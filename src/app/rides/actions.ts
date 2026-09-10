'use server'

/**
 * Server Actions for /rides. Both run with the caller's own session, via
 * createClient() from `@/lib/supabase/server`, never an elevated key (CLAUDE.md
 * rule 1). Neither ever writes `coaster_id`: AGENTS.md is explicit that moving a
 * ride to a different coaster is not an edit, it is a delete plus a new entry, so
 * no credit moves silently under an edit nobody asked for. `rides_atualiza_proprias`
 * and `rides_apaga_proprias` (supabase/migrations/20260909000002_security.sql)
 * already keep either action scoped to the caller's own rows; there is no
 * `.eq('user_id', ...)` here because RLS already is that filter.
 */

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

const NOTE_MAX = 280
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/

/**
 * Turns a raw Postgres error into something a visitor can act on. Both check
 * constraints below live on `public.rides`
 * (supabase/migrations/20260909000001_schema.sql); a client-side check catches
 * either first, this is only the backstop if the two ever disagree.
 */
function friendlyRideError(error: { message: string }): string {
  const message = error.message.toLowerCase()
  if (message.includes('rides_data_nao_futura')) return 'The date cannot be in the future.'
  if (message.includes('rides_nota_tamanho')) return `Note must be ${NOTE_MAX} characters or fewer.`
  return error.message
}

export async function updateRide(
  rideId: string,
  riddenOn: string,
  noteRaw: string,
): Promise<{ error: string | null }> {
  if (!rideId) return { error: 'Missing ride.' }
  if (!DATE_PATTERN.test(riddenOn)) return { error: 'Enter a valid date.' }

  const today = new Date().toISOString().slice(0, 10)
  if (riddenOn > today) return { error: 'The date cannot be in the future.' }

  const note = noteRaw.trim()
  if (note.length > NOTE_MAX) return { error: `Note must be ${NOTE_MAX} characters or fewer.` }

  const supabase = await createClient()
  const { error } = await supabase
    .from('rides')
    .update({ ridden_on: riddenOn, note: note === '' ? null : note })
    .eq('id', rideId)

  if (error) {
    return { error: friendlyRideError(error) }
  }

  revalidatePath('/rides')
  revalidatePath('/dashboard')
  return { error: null }
}

export async function deleteRide(rideId: string): Promise<{ error: string | null }> {
  if (!rideId) return { error: 'Missing ride.' }

  const supabase = await createClient()
  const { error } = await supabase.from('rides').delete().eq('id', rideId)

  if (error) {
    return { error: error.message }
  }

  // A deleted ride can drop a coaster's credit count, which moves the headline on
  // the dashboard and the caller's own row on the public leaderboard (FR5, FR7).
  revalidatePath('/rides')
  revalidatePath('/dashboard')
  revalidatePath('/')
  return { error: null }
}
