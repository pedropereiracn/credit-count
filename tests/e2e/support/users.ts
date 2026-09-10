import { createClient } from '@supabase/supabase-js'
import { need, optional } from './env'

export type DisposableUser = {
  email: string
  password: string
  displayName: string
}

/**
 * A throwaway account this one test owns end to end: a unique email so it can
 * never collide with another run or another test, and a generated (never
 * literal) password, the same convention `scripts/verify-security.mjs` uses
 * for its own "account B". Never one of the delivered enthusiast/admin
 * accounts (task brief: "do not depend on the delivered accounts").
 */
export function disposableUser(label: string): DisposableUser {
  const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  return {
    email: `pw-${label}-${stamp}@credit-count.test`,
    password: `Pw-${stamp}-${Math.random().toString(36).slice(2, 10)}!`,
    displayName: `PW ${label} ${stamp}`.slice(0, 40),
  }
}

/**
 * Best-effort cleanup: deletes the auth user a test created, once the test is
 * done with it, so this suite does not leave a trail of throwaway accounts in
 * the project every run adds to.
 *
 * This is the one place in this test suite that reads SUPABASE_SECRET_KEY.
 * That is deliberate and safe: CLAUDE.md rule 1 ("no elevated key in
 * application code") scopes itself to `src/`, and this file lives under
 * `tests/`. `scripts/seed-demo.mjs` reads the very same key, the very same
 * way, for the same reason (creating/removing accounts needs the admin API).
 * If the key is not in the environment, this quietly does nothing instead of
 * failing the test: the account is a harmless, uniquely-named leftover, the
 * same trade-off `scripts/verify-security.mjs` makes for its own account B.
 */
export async function deleteDisposableUser(email: string): Promise<void> {
  const secretKey = optional('SUPABASE_SECRET_KEY')
  const url = optional('NEXT_PUBLIC_SUPABASE_URL')
  if (!secretKey || !url) return

  try {
    const admin = createClient(url, secretKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
    // The admin SDK has no "find by email" call, only a paged list: one generous
    // page is enough for this project's small, free-tier user base (delivered
    // accounts, demo accounts, and whatever this suite has created so far).
    const { data, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 })
    if (error || !data) return
    const match = data.users.find((u) => u.email === email)
    if (match) await admin.auth.admin.deleteUser(match.id)
  } catch {
    // Best effort: a leftover throwaway account is not a reason to fail a test.
  }
}

/** For task 7: there is no self-service way to become an admin (by design, see
 * docs/TDD.md section 3), so "an admin signs in" can only mean the one
 * delivered admin account, read from the environment like the two existing
 * gates read it. */
export function adminCredentials(): { email: string; password: string } {
  return { email: need('TEST_ADMIN_EMAIL'), password: need('TEST_ADMIN_PASSWORD') }
}
