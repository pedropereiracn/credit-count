/**
 * The shape one row of the ride-history join comes back as: a ride plus enough of
 * its coaster (and that coaster's park and manufacturer) to render one line of
 * history without a second round trip. `createClient()` carries no `<Database>`
 * generic (see `src/lib/supabase/server.ts`), so this is hand-typed and cast at
 * the query site, the same pattern `src/components/leaderboard/types.ts` uses.
 */
export type RideDetail = {
  id: string
  ridden_on: string
  note: string | null
  coaster: {
    id: string
    name: string
    track_type: string
    park: { id: string; name: string } | null
    manufacturer: { name: string } | null
  } | null
}
