import { test, expect } from '@playwright/test'
import { disposableUser, deleteDisposableUser } from './support/users'
import { creditNumber, logRideViaUI, signUpViaUI } from './support/ui'

/** Task 3: "Log a ride in three interactions, and the credit count goes up." */
test.describe('logging a ride', () => {
  test('three interactions (type, pick, confirm) raise the credit count', async ({ page }) => {
    const user = disposableUser('log-ride')

    try {
      await signUpViaUI(page, user)
      await expect(creditNumber(page)).toHaveText('0')

      const ride = await logRideViaUI(page, 'e')
      expect(ride.alreadyRidden).toBe(false) // first ride on this coaster: a new credit

      await expect(page.getByText("That's a new credit.")).toBeVisible()
      // Live update, no manual refresh (FR5): the same page, not a reload.
      await expect(creditNumber(page)).toHaveText('1')
      await expect(page.getByText('1 ride logged in total.')).toBeVisible()
    } finally {
      await deleteDisposableUser(user.email)
    }
  })
})
