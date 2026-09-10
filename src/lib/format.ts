/** Small shared formatters. Owned by phase 0: read by every screen, written by none. */

/**
 * ISO alpha-2 to a name a person recognises.
 *
 * This was a hand-written map of GB and US. The catalogue then gained a third
 * country and every screen started showing the raw code "DE" beside spelled-out
 * "United Kingdom". Patching it country by country only moves the bug: an admin
 * can add a park anywhere, and the next code would break it again.
 *
 * Intl.DisplayNames ships with the runtime and knows every code, so the map that
 * had to be maintained by hand simply stops existing. The try/catch is for an
 * invalid code rather than a missing one: the database constraint already refuses
 * anything that is not two capital letters.
 */
const NAMES = new Intl.DisplayNames(['en'], { type: 'region' })

export function countryName(code: string): string {
  try {
    return NAMES.of(code.toUpperCase()) ?? code
  } catch {
    return code
  }
}

/** A ride date, as an enthusiast would write it. */
export function rideDate(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

/** "1 ride" / "12 rides", because "1 rides" reads like a bug. */
export function plural(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`
}

export const TRACK_TYPE_LABELS: Record<string, string> = {
  steel: 'Steel',
  wooden: 'Wooden',
  hybrid: 'Hybrid',
}
