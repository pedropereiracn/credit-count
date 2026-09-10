import { test, expect } from '@playwright/test'
import { disposableUser, deleteDisposableUser } from './support/users'
import { creditNumber, pathnameOf, signUpViaUI } from './support/ui'

/** Task 2: "Sign-up creates an account, lands on the dashboard, starts with 0 credits." */
test.describe('sign up', () => {
  test('creates an account, lands on /dashboard, and starts at 0 credits', async ({ page }) => {
    const user = disposableUser('signup')

    try {
      await signUpViaUI(page, user)

      expect(pathnameOf(page)).toBe('/dashboard')
      await expect(creditNumber(page)).toHaveText('0')
      await expect(page.getByText('No credits yet. Your track is flat.')).toBeVisible()
      // The header greets the account by the display name it chose at sign-up.
      await expect(page.getByText(user.displayName)).toBeVisible()
    } finally {
      await deleteDisposableUser(user.email)
    }
  })
})
