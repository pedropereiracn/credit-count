import { expect, type Page } from '@playwright/test'
import type { DisposableUser } from './users'

/** The pathname Playwright's `page` is currently on, ignoring host/port/query:
 * comparing this instead of the full URL keeps assertions readable and
 * independent of the exact origin the dev server bound to. */
export function pathnameOf(page: Page): string {
  return new URL(page.url()).pathname
}

/** Signs up through the real form (src/components/auth/signup-form.tsx), the
 * only path the product exposes: there is no admin-created-account shortcut
 * here on purpose, matching how src/app/(auth)/actions.ts is written (the
 * Server Action is the only thing that ever calls `supabase.auth.signUp`). */
export async function signUpViaUI(page: Page, user: DisposableUser, next?: string): Promise<void> {
  await page.goto(next ? `/signup?next=${encodeURIComponent(next)}` : '/signup')
  await page.getByLabel('Email', { exact: true }).fill(user.email)
  await page.getByLabel('Password', { exact: true }).fill(user.password)
  await page.getByLabel('Display name', { exact: true }).fill(user.displayName)
  await page.getByRole('button', { name: 'Create account' }).click()
  await page.waitForURL((url) => url.pathname === (next ?? '/dashboard'), { timeout: 20_000 })
}

export async function loginViaUI(
  page: Page,
  email: string,
  password: string,
  next?: string,
): Promise<void> {
  await page.goto(next ? `/login?next=${encodeURIComponent(next)}` : '/login')
  await page.getByLabel('Email', { exact: true }).fill(email)
  await page.getByLabel('Password', { exact: true }).fill(password)
  await page.getByRole('button', { name: 'Log in' }).click()
  await page.waitForURL((url) => url.pathname === (next ?? '/dashboard'), { timeout: 20_000 })
}

/** The big number on /dashboard (src/components/dashboard/credit-headline.tsx),
 * the same `.credit-number` hook scripts/verify-ui.mjs checks the Fredoka font
 * on. Returns it as a string so callers can use Playwright's own auto-retrying
 * `toHaveText`, which is what actually proves the dashboard updated live
 * (FR5, "no manual refresh") rather than only after a reload. */
export function creditNumber(page: Page) {
  return page.locator('.credit-number').first()
}

export type LoggedRide = {
  /** The coaster's name, read off the search result row before it was clicked. */
  name: string
  /** Whether the UI itself already flagged this as a reride before submit
   * (the "Reride" vs "New credit" badge): task 4's AC1 check starts here,
   * before the credit count is even read back. */
  alreadyRidden: boolean
}

/**
 * The three-tap flow src/components/dashboard/ride-logger.tsx describes in its
 * own comment: type in the search box, click a result, confirm. Assumes the
 * caller is already on /dashboard.
 *
 * `query` is typed into the search box for real (interaction one), which is
 * also what proves the search itself works, not only the confirm step.
 */
export async function logRideViaUI(page: Page, query: string): Promise<LoggedRide> {
  const searchBox = page.getByLabel('Search coasters', { exact: true })
  await searchBox.fill('')
  await searchBox.fill(query) // interaction 1: type

  // Wait for the debounced search to actually replace the results, not just for
  // *a* result to be visible: the dashboard already shows the browsable
  // catalogue before anything is typed, so a bare "visible" check could pass
  // against stale, pre-filter rows.
  await expect(page.getByText('Matching coasters')).toBeVisible({ timeout: 10_000 })

  const row = page.locator('ul li button').first()
  await expect(row).toBeVisible({ timeout: 10_000 })
  const name = (await row.locator('.font-heading').first().innerText()).trim()
  const alreadyRidden = (await row.getByText('Reride', { exact: true }).count()) > 0

  await row.click() // interaction 2: pick

  const logButton = page.getByRole('button', { name: 'Log ride', exact: true })
  await expect(logButton).toBeVisible()
  await logButton.click() // interaction 3: confirm

  // The dialog/sheet closes only on a successful log (RideLogger's handleLogged):
  // the button leaving the DOM is the success signal, true for both the
  // "New credit" and the "Reride" wording of the toast.
  await expect(logButton).toHaveCount(0, { timeout: 10_000 })

  return { name, alreadyRidden }
}

/** Scans the public leaderboard (task 6) for a display name, following "Next"
 * across a few pages: a fresh, zero-credit opted-in account ties on name/id
 * with everyone else at zero, so it is not guaranteed to land on page 1.
 *
 * Scoped to the leaderboard's own `<ol>` (src/components/leaderboard/leaderboard-list.tsx),
 * not the whole page: the signed-in header (src/components/app-header.tsx) also
 * prints the caller's own display name in the top-right corner whenever they
 * are logged in, on every route including `/`, which a page-wide text search
 * would wrongly count as "on the board". */
export async function isNameOnLeaderboard(page: Page, name: string, maxPages = 5): Promise<boolean> {
  for (let p = 1; p <= maxPages; p++) {
    await page.goto(p === 1 ? '/' : `/?page=${p}`)
    if ((await page.locator('ol').getByText(name, { exact: true }).count()) > 0) return true
    const nextLink = page.getByRole('link', { name: 'Next', exact: true })
    const hasNext = await nextLink.isVisible().catch(() => false)
    if (!hasNext) break
  }
  return false
}
