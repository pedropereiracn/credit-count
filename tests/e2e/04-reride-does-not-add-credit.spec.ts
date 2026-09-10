import { test, expect } from '@playwright/test'
import { disposableUser, deleteDisposableUser } from './support/users'
import { creditNumber, logRideViaUI, signUpViaUI } from './support/ui'

/**
 * Task 4, AC1, the product's central definition: "Riding the same coaster
 * again raises rides and does not raise credits."
 */
test.describe('riding the same coaster again', () => {
  test('raises the ride count but never the credit count (AC1)', async ({ page }) => {
    const user = disposableUser('reride')

    try {
      await signUpViaUI(page, user)

      const first = await logRideViaUI(page, 'e')
      expect(first.alreadyRidden).toBe(false)
      await expect(creditNumber(page)).toHaveText('1')

      // Search for the exact same coaster by its full name: this is a reride,
      // and the UI itself has to know that *before* the second confirm.
      const second = await logRideViaUI(page, first.name)
      expect(second.name).toBe(first.name)
      expect(second.alreadyRidden).toBe(true)

      await expect(page.getByText(`Another ride on ${first.name} logged.`)).toBeVisible()
      // The whole point of the product: rides go up, credits do not.
      await expect(creditNumber(page)).toHaveText('1')
      await expect(page.getByText('2 rides logged in total.')).toBeVisible()
    } finally {
      await deleteDisposableUser(user.email)
    }
  })
})
