/** Shared shapes for the dashboard's search-and-log flow. */
export type CoasterSearchRow = {
  id: string
  name: string
  trackType: string
  retiredAt: string | null
  parkName: string
  countryCode: string
  manufacturerName: string | null
  /** Whether the signed-in user already has a ride on this coaster: a reride, not a new credit. */
  alreadyRidden: boolean
}
