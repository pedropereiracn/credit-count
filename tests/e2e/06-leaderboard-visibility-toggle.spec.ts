import { test, expect } from '@playwright/test'
import { disposableUser, deleteDisposableUser } from './support/users'
import { isNameOnLeaderboard, signUpViaUI } from './support/ui'

/** Task 6: "Turning off the ranking hides the name from the public page." */
test.describe('the public leaderboard toggle', () => {
  test('turning it off hides the name from the public page; turning it on shows it again', async ({
    page,
  }) => {
    const user = disposableUser('board')

    try {
      await signUpViaUI(page, user)

      // New accounts start hidden (SOW 2, privacy is the default), so this
      // begins by proving the name is genuinely absent before opting in at all.
      expect(await isNameOnLeaderboard(page, user.displayName)).toBe(false)

      await page.goto('/settings')
      const toggle = page.getByRole('switch', { name: 'Appear on the public leaderboard' })
      await expect(toggle).not.toBeChecked()

      // --- on: the name appears -----------------------------------------
      await toggle.click()
      await expect(page.getByText('You are now on the public leaderboard.')).toBeVisible()
      expect(await isNameOnLeaderboard(page, user.displayName)).toBe(true)

      // --- off: the name is hidden again ----------------------------------
      await page.goto('/settings')
      await expect(toggle).toBeChecked()
      await toggle.click()
      await expect(page.getByText('You are now hidden from the public leaderboard.')).toBeVisible()
      expect(await isNameOnLeaderboard(page, user.displayName)).toBe(false)
    } finally {
      await deleteDisposableUser(user.email)
    }
  })
})
