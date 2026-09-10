import { createBrowserClient } from '@supabase/ssr'

/**
 * Browser client. Carries the publishable key, which is public by design: every
 * access rule lives in Postgres, so a client holding this key can still only reach
 * its own rows. See docs/TDD.md section 3.
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
  )
}
