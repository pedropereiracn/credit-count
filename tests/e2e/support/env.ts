/**
 * Same shape as `need()` in scripts/verify-security.mjs and scripts/verify-ui.mjs:
 * every credential a test needs comes from the environment, never a literal in
 * this file, so the admin gate (task 7) reads TEST_ADMIN_EMAIL/PASSWORD exactly
 * the way the two existing gates do.
 */
export function need(key: string): string {
  const value = process.env[key]
  if (!value) {
    throw new Error(
      `missing environment variable: ${key}. Copy .env.example to .env.local and fill it in.`,
    )
  }
  return value
}

export function optional(key: string): string | undefined {
  return process.env[key]
}
