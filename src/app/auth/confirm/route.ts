import { type EmailOtpType } from '@supabase/supabase-js'
import { type NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * The landing point for a Supabase email action link built the SSR way: with a
 * `token_hash` and `type` in the query string rather than a URL fragment, so this
 * route handler can see them and verify server-side. `requestPasswordReset` in
 * `../../(auth)/actions.ts` points `redirectTo` here for password recovery; the
 * same route would also carry signup confirmation or an email change if this
 * project ever turns those on.
 *
 * `verifyOtp` establishes the session through the cookies `createClient()` already
 * manages, so by the time we redirect to `next` the visitor is signed in with no
 * extra step, and `/reset-password` (not a public route) is reachable precisely
 * because they now hold that session.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const tokenHash = searchParams.get('token_hash')
  const type = searchParams.get('type') as EmailOtpType | null
  const rawNext = searchParams.get('next') ?? '/dashboard'
  const next = rawNext.startsWith('/') && !rawNext.startsWith('//') ? rawNext : '/dashboard'

  if (tokenHash && type) {
    const supabase = await createClient()
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash })
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  return NextResponse.redirect(`${origin}/login?error=expired-link`)
}
