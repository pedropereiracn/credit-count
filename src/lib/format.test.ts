import { describe, expect, it } from 'vitest'
import { countryName, plural, rideDate, TRACK_TYPE_LABELS } from './format'

describe('countryName', () => {
  it('resolves GB to United Kingdom', () => {
    expect(countryName('GB')).toBe('United Kingdom')
  })

  it('resolves US to United States', () => {
    expect(countryName('US')).toBe('United States')
  })

  it('resolves DE to Germany', () => {
    expect(countryName('DE')).toBe('Germany')
  })

  it('is case-insensitive: a lower-case code still resolves', () => {
    expect(countryName('gb')).toBe('United Kingdom')
  })

  it('falls back to the code itself for an invalid code Intl.DisplayNames throws on', () => {
    // A single letter is not a valid ISO 3166-1 alpha-2 region: Intl.DisplayNames
    // throws a RangeError for it, and the catch block returns the *original*
    // argument, not the upper-cased one, which this also pins down.
    expect(countryName('z')).toBe('z')
  })

  it('falls back to the code itself for a well-formed but unassigned code', () => {
    // 'XX' is syntactically a valid region subtag but carries no display name,
    // so Intl.DisplayNames#of returns undefined rather than throwing: the `?? code`
    // branch, not the try/catch one.
    expect(countryName('XX')).toBe('XX')
  })
})

describe('rideDate', () => {
  it('formats an ISO date as day, short month, year (en-GB)', () => {
    expect(rideDate('2026-01-15')).toBe('15 Jan 2026')
  })

  it('does not zero-pad a single-digit day', () => {
    expect(rideDate('2026-12-01')).toBe('1 Dec 2026')
  })
})

describe('plural', () => {
  it('uses the singular form at exactly 1', () => {
    expect(plural(1, 'ride')).toBe('1 ride')
  })

  it('uses the default plural (+s) at 0', () => {
    expect(plural(0, 'ride')).toBe('0 rides')
  })

  it('uses the default plural (+s) above 1', () => {
    expect(plural(2, 'ride')).toBe('2 rides')
  })

  it('accepts an explicit irregular plural instead of the default +s', () => {
    expect(plural(3, 'coaster', 'coasterz')).toBe('3 coasterz')
    expect(plural(1, 'coaster', 'coasterz')).toBe('1 coaster')
  })
})

describe('TRACK_TYPE_LABELS', () => {
  it('carries exactly the three closed-set track types, in the order the dashboard iterates them', () => {
    // src/app/dashboard/page.tsx builds one breakdown bar per Object.keys(TRACK_TYPE_LABELS),
    // in this order, even at zero credits: reordering or resizing this object silently
    // reorders or drops a bar on the real dashboard.
    expect(Object.keys(TRACK_TYPE_LABELS)).toEqual(['steel', 'wooden', 'hybrid'])
  })

  it('capitalises each track type for display', () => {
    expect(TRACK_TYPE_LABELS.steel).toBe('Steel')
    expect(TRACK_TYPE_LABELS.wooden).toBe('Wooden')
    expect(TRACK_TYPE_LABELS.hybrid).toBe('Hybrid')
  })
})
