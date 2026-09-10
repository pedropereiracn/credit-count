import { type NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * The PKCE code-exchange landing point. Nothing this project ships today issues a
 * `code` (sign-up and sign-in are plain email and password; password recovery uses
 * the token_hash flow in `../confirm/route.ts`), but this is the route Supabase's
 * own SSR guide reserves for it, and `src/lib/supabase/proxy.ts` already treats the
 * whole `/auth` prefix as public. Kept so an OAuth provider or a magic link never
 * has nowhere to land.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const rawNext = searchParams.get('next') ?? '/dashboard'
  const next = rawNext.startsWith('/') && !rawNext.startsWith('//') ? rawNext : '/dashboard'

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  return NextResponse.redirect(`${origin}/login?error=expired-link`)
}
