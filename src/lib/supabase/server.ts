import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

/**
 * Server client, for Server Components and Server Actions.
 *
 * It carries the same publishable key the browser has, and the caller's session
 * from the cookie. That is deliberate: no server code in this project holds a
 * privilege the browser lacks, so a bug in a Server Action cannot leak anything a
 * bug in the browser could not (docs/TDD.md section 5).
 *
 * This is what makes auth.uid() resolve to one person inside every policy and view.
 */
export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, {
                ...options,
                secure: process.env.NODE_ENV === 'production',
                sameSite: 'lax',
              }),
            )
          } catch {
            // Called from a Server Component, where cookies are read-only.
            // The middleware refreshes the session, so this is safe to ignore.
          }
        },
      },
    },
  )
}
