import { defineConfig, devices } from '@playwright/test'
import path from 'node:path'

/**
 * End-to-end flows, driven in a real (Chromium) browser against `npm run dev`
 * on localhost, never the deployed app: the point is a reproducible run, and
 * the live site's data is shared and moving (docs/TDD.md, the delivered
 * accounts). See tests/e2e/*.spec.ts for the flows themselves and
 * tests/e2e/support/ for the shared helpers.
 *
 * `.env.local` holds the two NEXT_PUBLIC_ variables the app itself needs (Next
 * loads those on its own for the `npm run dev` process this config starts),
 * plus TEST_ADMIN_EMAIL/PASSWORD (there is no self-service way to become an
 * admin, so the one already delivered is what "an admin signs in" has to mean)
 * and, optionally, SUPABASE_SECRET_KEY, used only by tests/e2e/support/users.ts
 * to delete the throwaway accounts each test creates once it is done with them
 * (tests/, never src/: CLAUDE.md's "no elevated key in application code" rule
 * only ever scoped that to application code). This process (this config file,
 * and the Playwright test workers it forks) needs those same variables in its
 * own process.env, which nothing loads automatically the way Next does for its
 * own dev server, hence loading the file here explicitly.
 */
try {
  process.loadEnvFile(path.resolve(__dirname, '.env.local'))
} catch {
  // No .env.local (e.g. CI with the variables injected directly). Nothing to load.
}

// A dedicated port, deliberately not 3000: this suite manages its own `npm run
// dev` instance end to end (started, and reused across runs in this file's own
// process tree only) rather than attaching to whatever a developer might
// already have running on the default port.
const PORT = Number(process.env.PLAYWRIGHT_PORT ?? 3100)
const baseURL = `http://localhost:${PORT}`

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 45_000,
  expect: { timeout: 10_000 },
  reporter: [['list']],
  use: {
    baseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: 'npm run dev',
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: { PORT: String(PORT) },
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
})
