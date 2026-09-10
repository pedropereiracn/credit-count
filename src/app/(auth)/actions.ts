'use server'

/**
 * Server Actions for authentication. Every one of these runs with the caller's own
 * session, via createClient() from `@/lib/supabase/server`, never an elevated key
 * (CLAUDE.md rule 1). None of them ever sends `role` in sign-up metadata: the
 * `handle_new_user` trigger writes that literal, and this file has no business
 * overriding it (CLAUDE.md rule 9, and the "never" in AGENTS.md's A1 section).
 */

import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import type { AuthError } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'

const DISPLAY_NAME_MIN = 2
const DISPLAY_NAME_MAX = 40
const PASSWORD_MIN = 6

// Type-only exports are erased at compile time, so they are fine to share from a
// 'use server' module. A *value* export (a constant initial state, say) is not: this
// file may only export async functions, and an initial render that imported one
// learned that the hard way (an object literal here becomes `undefined` on the
// client). Each form component below defines its own initial-state literal instead.

export type FieldErrors = Partial<Record<'email' | 'password' | 'displayName', string>>

export type AuthState = {
  formError: string | null
  fieldErrors: FieldErrors
  // Echoed back so a failed attempt does not also cost the visitor their typing.
  // React resets an uncontrolled <form> after any action call, success or not, and
  // resets each field to its *current* defaultValue rather than to blank, which is
  // exactly what lets this survive the reset. The password is never included.
  values: { email: string; displayName: string }
}

export type ForgotPasswordState = {
  formError: string | null
  fieldErrors: Partial<Record<'email', string>>
  success: boolean
  values: { email: string }
}

export type ResetPasswordState = {
  formError: string | null
  fieldErrors: Partial<Record<'password' | 'confirmPassword', string>>
}

/**
 * Only an absolute, same-site path is ever a valid redirect target. `src/proxy.ts`
 * hands us `next` on the query string; without this check a crafted `?next=` could
 * turn a login into an open redirect.
 */
/**
 * Only ever redirect to a path on this site.
 *
 * "starts with / and not //" is the check everybody writes, and it is not enough.
 * Browsers follow the WHATWG URL parser, which treats a backslash in the authority
 * position exactly like a forward slash, so /\\evil.com resolves to https://evil.com.
 * A phishing link on the real domain, over real TLS, handed to someone right after a
 * genuine login. Parsers also strip control characters before resolving, so a value
 * carrying one can mean something different by the time the browser reads it.
 */
function safeNext(value: FormDataEntryValue | null): string {
  const fallback = '/dashboard'
  if (typeof value !== 'string' || value.length === 0) return fallback

  // control characters, tabs and newlines: removed by parsers, so refused here
  if (/[\u0000-\u001F\u007F]/.test(value)) return fallback

  // must be a path, and the second character may not open an authority
  if (value[0] !== '/') return fallback
  if (value[1] === '/' || value[1] === '\\') return fallback

  // and no backslash anywhere: it is never legitimate in a path this app generates
  if (value.includes('\\')) return fallback

  return value
}

/**
 * Built from the incoming request's own headers, never a third environment
 * variable: the Vercel project holds exactly two, both NEXT_PUBLIC_ (CLAUDE.md,
 * "Environment"), and a site-origin constant would have been a third.
 */
async function siteOrigin(): Promise<string> {
  const list = await headers()
  const host = list.get('x-forwarded-host') ?? list.get('host') ?? 'localhost:3000'
  const proto = list.get('x-forwarded-proto') ?? (host.startsWith('localhost') ? 'http' : 'https')
  return `${proto}://${host}`
}

function validateDisplayName(raw: string): string | null {
  const trimmed = raw.trim()
  if (trimmed.length < DISPLAY_NAME_MIN || trimmed.length > DISPLAY_NAME_MAX) {
    return `Display name must be between ${DISPLAY_NAME_MIN} and ${DISPLAY_NAME_MAX} characters.`
  }
  return null
}

/**
 * Turns a GoTrue error into something a visitor can act on. `profiles_nome_tamanho`
 * (the database constraint this mirrors) never actually fires during sign-up: the
 * `handle_new_user` trigger falls back to a generated name for anything under two
 * characters rather than raising, so this client-side check is the only place a
 * short display name is ever caught and explained.
 */
function authErrorMessage(error: AuthError, context: 'signup' | 'login' | 'reset'): string {
  const code = error.code ?? ''
  const message = error.message.toLowerCase()

  if (context === 'signup' && (code === 'user_already_exists' || message.includes('already registered'))) {
    return 'An account with this email already exists. Try logging in instead.'
  }
  if (context === 'login' && (code === 'invalid_credentials' || message.includes('invalid login credentials'))) {
    return 'Incorrect email or password.'
  }
  if (code === 'same_password') {
    return 'Choose a different password than the one you have now.'
  }
  if (code === 'weak_password' || message.includes('password should') || message.includes('password is')) {
    return `Password must be at least ${PASSWORD_MIN} characters.`
  }
  if (message.includes('session') || message.includes('expired')) {
    return 'That link has expired. Request a new one.'
  }
  if (code === 'email_address_invalid') {
    return 'Enter a valid email address.'
  }
  if (code === 'over_email_send_rate_limit' || message.includes('rate limit')) {
    return 'Too many attempts. Wait a moment and try again.'
  }
  return error.message
}

export async function signup(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const email = String(formData.get('email') ?? '').trim()
  const password = String(formData.get('password') ?? '')
  const displayNameRaw = String(formData.get('displayName') ?? '')
  const displayName = displayNameRaw.trim()
  const next = safeNext(formData.get('next'))
  const values = { email, displayName: displayNameRaw }

  const fieldErrors: FieldErrors = {}
  if (!email) fieldErrors.email = 'Enter your email address.'
  const nameError = validateDisplayName(displayNameRaw)
  if (nameError) fieldErrors.displayName = nameError
  if (password.length < PASSWORD_MIN) {
    fieldErrors.password = `Password must be at least ${PASSWORD_MIN} characters.`
  }
  if (Object.keys(fieldErrors).length > 0) {
    return { formError: null, fieldErrors, values }
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { display_name: displayName } },
  })

  if (error) {
    return { formError: authErrorMessage(error, 'signup'), fieldErrors: {}, values }
  }

  redirect(next)
}

export async function login(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const email = String(formData.get('email') ?? '').trim()
  const password = String(formData.get('password') ?? '')
  const next = safeNext(formData.get('next'))
  const values = { email, displayName: '' }

  const fieldErrors: FieldErrors = {}
  if (!email) fieldErrors.email = 'Enter your email address.'
  if (!password) fieldErrors.password = 'Enter your password.'
  if (Object.keys(fieldErrors).length > 0) {
    return { formError: null, fieldErrors, values }
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword({ email, password })

  if (error) {
    return { formError: authErrorMessage(error, 'login'), fieldErrors: {}, values }
  }

  redirect(next)
}

export async function requestPasswordReset(
  _prev: ForgotPasswordState,
  formData: FormData,
): Promise<ForgotPasswordState> {
  const email = String(formData.get('email') ?? '').trim()
  const values = { email }
  if (!email) {
    return { formError: null, fieldErrors: { email: 'Enter your email address.' }, success: false, values }
  }

  const supabase = await createClient()
  const origin = await siteOrigin()
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}/auth/confirm?next=/reset-password`,
  })

  // Supabase never reveals whether an address is registered here (an enumeration
  // guard on its side), so a real error means the request itself failed, not that
  // "no such account" should be shown.
  if (error) {
    return { formError: authErrorMessage(error, 'reset'), fieldErrors: {}, success: false, values }
  }

  return { formError: null, fieldErrors: {}, success: true, values }
}

export async function resetPassword(
  _prev: ResetPasswordState,
  formData: FormData,
): Promise<ResetPasswordState> {
  const password = String(formData.get('password') ?? '')
  const confirmPassword = String(formData.get('confirmPassword') ?? '')

  const fieldErrors: ResetPasswordState['fieldErrors'] = {}
  if (password.length < PASSWORD_MIN) {
    fieldErrors.password = `Password must be at least ${PASSWORD_MIN} characters.`
  }
  if (confirmPassword !== password) {
    fieldErrors.confirmPassword = 'Passwords do not match.'
  }
  if (Object.keys(fieldErrors).length > 0) {
    return { formError: null, fieldErrors }
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.updateUser({ password })

  if (error) {
    return { formError: authErrorMessage(error, 'reset'), fieldErrors: {} }
  }

  redirect('/dashboard')
}
