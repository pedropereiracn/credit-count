'use server'

/**
 * Server Actions for /settings. Both run with the caller's own session, via
 * createClient() from `@/lib/supabase/server`, never an elevated key (CLAUDE.md
 * rule 1). `profiles_atualiza_propria` (supabase/migrations/20260909000002_security.sql)
 * already keys every update to `auth.uid()`, and the column grant on `profiles`
 * covers only `display_name` and `show_on_leaderboard`: `role` has no write grant
 * for any client role, so nothing here could touch it even by mistake.
 */

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

// Same bounds `src/app/(auth)/actions.ts` checks at sign-up, and the same
// `profiles_nome_tamanho` constraint underneath: a short or long name is never
// something the visitor meets first at the database.
const DISPLAY_NAME_MIN = 2
const DISPLAY_NAME_MAX = 40

export type DisplayNameState = {
  error: string | null
  success: boolean
  value: string
}

function validateDisplayName(raw: string): string | null {
  const trimmed = raw.trim()
  if (trimmed.length < DISPLAY_NAME_MIN || trimmed.length > DISPLAY_NAME_MAX) {
    return `Display name must be between ${DISPLAY_NAME_MIN} and ${DISPLAY_NAME_MAX} characters.`
  }
  return null
}

export async function updateDisplayName(
  _prev: DisplayNameState,
  formData: FormData,
): Promise<DisplayNameState> {
  const raw = String(formData.get('displayName') ?? '')

  const nameError = validateDisplayName(raw)
  if (nameError) {
    return { error: nameError, success: false, value: raw }
  }

  const trimmed = raw.trim()
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'Your session expired. Sign in again.', success: false, value: raw }
  }

  const { error } = await supabase
    .from('profiles')
    .update({ display_name: trimmed })
    .eq('id', user.id)

  if (error) {
    return { error: error.message, success: false, value: raw }
  }

  // The name shows on the dashboard header and, if the caller opts in, on the
  // public leaderboard (FR7): both need to see it on their next load.
  revalidatePath('/settings')
  revalidatePath('/')
  revalidatePath('/dashboard')

  return { error: null, success: true, value: trimmed }
}

/**
 * One value, one write: whether the caller appears on the public leaderboard.
 * `nextValue` comes straight from the Switch, not FormData, since this is called
 * directly from the client rather than bound to a `<form action>` (see
 * `src/components/settings/leaderboard-toggle-card.tsx`).
 */
export async function setLeaderboardVisibility(
  nextValue: boolean,
): Promise<{ error: string | null }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'Your session expired. Sign in again.' }
  }

  const { error } = await supabase
    .from('profiles')
    .update({ show_on_leaderboard: nextValue })
    .eq('id', user.id)

  if (error) {
    return { error: error.message }
  }

  // FR7 says opting out lands on the next request; revalidating '/' is what makes
  // that literally true rather than aspirational (the leaderboard is also
  // force-dynamic on its own, so this is belt and braces).
  revalidatePath('/settings')
  revalidatePath('/')

  return { error: null }
}
