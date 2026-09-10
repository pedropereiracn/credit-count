import { defineConfig } from 'vitest/config'
import path from 'node:path'

/**
 * Unit tests only: pure functions in src/lib, next to what they test
 * (src/lib/*.test.ts). No DOM, no React, no network: format.ts and friends do
 * not need any of that, and adding jsdom here would only hide the fact that
 * these functions never touch one.
 *
 * The end-to-end flows (signup, logging a ride, RLS-adjacent UI behaviour)
 * live in tests/e2e and run through Playwright instead (playwright.config.ts):
 * a real browser against `npm run dev`, which is the only way to actually
 * exercise a Server Action or a redirect.
 */
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
