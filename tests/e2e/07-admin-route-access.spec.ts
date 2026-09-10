import { test, expect } from '@playwright/test'
import { adminCredentials, disposableUser, deleteDisposableUser } from './support/users'
import { loginViaUI, pathnameOf, signUpViaUI } from './support/ui'

/**
 * Task 7: "Enthusiast é barrado em /admin, admin entra."
 *
 * There is no self-service way to become an admin (docs/TDD.md section 3:
 * `profiles.role` has no write grant for any client role), so the admin half
 * of this test signs in with the one delivered admin account, read from the
 * environment exactly like scripts/verify-security.mjs and
 * scripts/verify-ui.mjs read it. The enthusiast half uses a fresh, throwaway
 * account this test creates and cleans up itself.
 */
test.describe('/admin route access', () => {
  test('an enthusiast is redirected to /dashboard; the admin account reaches /admin', async ({
    page,
    browser,
  }) => {
    const user = disposableUser('admin-gate')

    try {
      await signUpViaUI(page, user)
      // Wait for the dashboard to actually render before racing to /admin. Without
      // this, page.goto('/admin') can fire while the sign-up's own client redirect
      // to /dashboard is still in flight, and Playwright reports the transient URL.
      // The server guard itself is deterministic; this only stabilises the test.
      await expect(page.getByText('Your credit count', { exact: false })).toBeVisible()

      await page.goto('/admin')
      await page.waitForLoadState('networkidle')
      expect(pathnameOf(page)).toBe('/dashboard')
      await expect(page.getByRole('heading', { name: 'Catalogue' })).toHaveCount(0)

      const { email, password } = adminCredentials()
      const adminContext = await browser.newContext()
      try {
        const adminPage = await adminContext.newPage()
        await loginViaUI(adminPage, email, password)

        await adminPage.goto('/admin')
        expect(pathnameOf(adminPage)).toBe('/admin')
        await expect(adminPage.getByRole('heading', { name: 'Catalogue' })).toBeVisible()
        await expect(adminPage.getByRole('link', { name: 'Add coaster' })).toBeVisible()
      } finally {
        await adminContext.close()
      }
    } finally {
      await deleteDisposableUser(user.email)
    }
  })
})
