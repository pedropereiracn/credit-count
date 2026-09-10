/** Small shared formatters. Owned by phase 0: read by every screen, written by none. */

const COUNTRY_NAMES: Record<string, string> = {
  GB: 'United Kingdom',
  US: 'United States',
}

/** ISO alpha-2 to a name a person recognises. Falls back to the code itself. */
export function countryName(code: string): string {
  return COUNTRY_NAMES[code] ?? code
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
