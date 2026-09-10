import { test, expect } from '@playwright/test'
import { disposableUser, deleteDisposableUser } from './support/users'
import { logRideViaUI, signUpViaUI } from './support/ui'

/** Task 5: "Editar e apagar uma ride própria." */
test.describe('editing and deleting a ride', () => {
  test('a signed-in user can edit and then delete their own ride', async ({ page }) => {
    const user = disposableUser('edit-delete')
    const noteText = `e2e note ${Date.now()}`

    try {
      await signUpViaUI(page, user)
      const ride = await logRideViaUI(page, 'e')

      await page.goto('/rides')
      const rideItem = page.locator('li', { hasText: ride.name }).first()
      await expect(rideItem).toBeVisible()

      // --- edit ---------------------------------------------------------
      await rideItem.getByRole('button', { name: 'Edit', exact: true }).click()
      await expect(page.getByText('Edit ride', { exact: true })).toBeVisible()
      await page.getByLabel('Note', { exact: true }).fill(noteText)
      await page.getByRole('button', { name: 'Save ride', exact: true }).click()

      await expect(page.getByText('Ride updated.')).toBeVisible()
      await expect(page.getByText('Edit ride', { exact: true })).toHaveCount(0)
      await expect(rideItem.getByText(noteText)).toBeVisible()

      // --- delete ---------------------------------------------------------
      await rideItem.getByRole('button', { name: 'Delete', exact: true }).click()
      await expect(page.getByText('Delete this ride?', { exact: true })).toBeVisible()
      await page.getByRole('button', { name: 'Delete ride', exact: true }).click()

      // It was the only ride this account had: deleting it empties the page.
      await expect(page.getByText('No rides yet.')).toBeVisible({ timeout: 10_000 })
      await expect(page.getByText(ride.name)).toHaveCount(0)
    } finally {
      await deleteDisposableUser(user.email)
    }
  })
})
