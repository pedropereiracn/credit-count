import { test, expect } from '@playwright/test'
import { pathnameOf } from './support/ui'

/**
 * Task 1: "Visitante vê o ranking e não vê mais nada; /dashboard redireciona
 * para login."
 *
 * Uses Playwright's default, unauthenticated `page` fixture: as long as this
 * test never signs in, it is a visitor for the whole run, which is exactly
 * what FR1 describes.
 */
test.describe('visitor', () => {
  test('sees the public leaderboard and nothing private; /dashboard sends them to /login', async ({
    page,
  }) => {
    await page.goto('/')

    // The ranking itself: heading, and at least one row (the delivered
    // accounts and the seeded demo accounts mean this is never empty; see
    // step 5 of scripts/verify-security.mjs, which depends on the same fact).
    await expect(page.getByRole('heading', { name: 'Most credits' })).toBeVisible()
    await expect(page.locator('ol > li').first()).toBeVisible()

    // Nothing private: the header only renders these links for a signed-in
    // user (src/components/app-header.tsx, `{user && (...)}`).
    await expect(page.getByRole('link', { name: 'Dashboard' })).toHaveCount(0)
    await expect(page.getByRole('link', { name: 'My rides' })).toHaveCount(0)
    await expect(page.getByRole('link', { name: 'Settings' })).toHaveCount(0)
    await expect(page.getByRole('link', { name: 'Catalogue' })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Sign out' })).toHaveCount(0)

    // The visitor's own two actions are still there.
    await expect(page.getByRole('link', { name: 'Log in' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Sign up' })).toBeVisible()

    // A private route redirects to /login, carrying where the visitor was
    // headed (src/lib/supabase/proxy.ts sets `next`).
    await page.goto('/dashboard')
    expect(pathnameOf(page)).toBe('/login')
    expect(new URL(page.url()).searchParams.get('next')).toBe('/dashboard')
    await expect(page.getByRole('button', { name: 'Log in' })).toBeVisible()
  })
})
