#!/usr/bin/env node
/**
 * seed-demo.mjs
 *
 * SOW §6 asks that the catalogue be seeded enough that the leaderboard and the
 * dashboard "mean something when demonstrated". The catalogue has 46 coasters
 * and nobody who has ridden any of them: without this script the leaderboard on
 * the call shows only the accounts the security gate created, and every
 * dashboard statistic comes from whatever three rides that gate happened to
 * leave behind. A correct app that looks empty is the worst outcome available,
 * so this exists to make sure it never looks empty.
 *
 * What this creates, every time it runs:
 *
 *   1. 8-12 demo accounts, through the GoTrue admin API (auth.users is not a
 *      table this script may insert into directly: it needs a hashed password
 *      and a confirmed session, and only the admin API produces those).
 *   2. A credit spread across those accounts shaped like a real leaderboard:
 *      a leader well ahead, a contested middle, a thin tail. Never a straight
 *      line, never everyone within a credit or two of each other.
 *   3. A real history for the delivered enthusiast account, A
 *      (enthusiast@creditcount.app / "Alex Rivera"): roughly 35-45 credits
 *      spanning both countries, several parks, and (by design) every
 *      manufacturer in the catalogue, with at least two coasters ridden more
 *      than once, so every one of the five dashboard views has real shape.
 *   4. Roughly two thirds of the demo accounts opted into the public
 *      leaderboard, the rest left out, so "only who opted in appears" is
 *      something a reviewer can see rather than something this document
 *      merely claims.
 *   5. Ride dates grouped by park visit (several rides on one day, not one
 *      ride per day for a year), never before the coaster in question existed,
 *      never after today, because `rides_data_nao_futura` in the schema
 *      rejects that outright.
 *
 * Idempotent by construction, not by accident: account creation is skipped for
 * any email that already exists (checked against a fresh `listUsers` call, not
 * assumed), and every ride this script is responsible for is deleted and
 * reinserted from the same deterministic plan on every run, scoped strictly to
 * the user ids this script itself owns (the demo accounts plus account A). A
 * second run produces the same 8-12 accounts and the same rides, never more.
 *
 * Every credential is read from the environment (CLAUDE.md, "No password ever
 * appears literally inside scripts/"). SUPABASE_SECRET_KEY is the admin key:
 * local only, never in Vercel, never imported by anything under src/.
 *
 * At the end this reads its own numbers back from Postgres and from the public
 * anon RPC a stranger would call. It does not print a number it only computed
 * in memory. The project has already shipped one wrong number that came from
 * trusting a hand count instead of counting (see supabase/audit/gerar_seed.py);
 * this does not repeat that.
 */

import { createClient } from '@supabase/supabase-js'

// ---------------------------------------------------------------- environment

const need = (k) => {
  const v = process.env[k]
  if (!v) {
    console.error(`missing environment variable: ${k}`)
    process.exit(2)
  }
  return v
}

const SUPABASE_URL = need('NEXT_PUBLIC_SUPABASE_URL')
const ANON_KEY = need('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY')
const SERVICE_KEY = need('SUPABASE_SECRET_KEY')
const DEMO_PASSWORD = need('DEMO_ACCOUNTS_PASSWORD')
const A_EMAIL = need('TEST_ENTHUSIAST_EMAIL')

// service role: bypasses RLS entirely, which is the only reason this script is
// allowed to write a ride for a user_id it did not sign in as. Local only.
const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

// anon: exactly what a signed-out visitor holds. Used only to verify the
// public leaderboard at the end, the same way a stranger would see it.
const anon = createClient(SUPABASE_URL, ANON_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

// ------------------------------------------------------------ small utilities

/** Deterministic PRNG (mulberry32) so a rerun proposes the same plan, and the
 *  delete-then-reinsert idempotency strategy below never has to reconcile two
 *  different random histories for the same account. */
function mulberry32(seed) {
  let a = seed >>> 0
  return function () {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function seedFromString(s) {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (Math.imul(h, 31) + s.charCodeAt(i)) | 0
  return h >>> 0
}

function shuffle(array, rng) {
  const a = array.slice()
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

const DAY_MS = 24 * 60 * 60 * 1000
const toISODate = (d) => d.toISOString().slice(0, 10)
// One full day before "now", so no timezone skew between this machine and the
// Postgres server can ever produce a date the `rides_data_nao_futura` check
// constraint rejects as being in the future.
const CUTOFF = new Date(Date.now() - DAY_MS)

// ------------------------------------------------------ coaster world-knowledge
//
// Real opening (or reopening) dates, so no ride is ever dated before the
// coaster existed. Everything not called out individually gets a 2015-01-01
// floor, which is well after every "plain" entry in the seed catalogue opened;
// the coasters below are the ones young enough, or re-launched recently
// enough, that the floor would be wrong.
//
//   Nemesis Reborn        reopened March 2024 (Alton Towers)
//   Hyperia               opened May 2024 (Thorpe Park)
//   Mandrill Mayhem        opened June 2023 (Chessington)
//   Wildcat's Revenge      opened June 2023 (Hersheypark)
//   Pipeline: The Surf Coaster  opened May 2023 (SeaWorld Orlando)
//   Iron Gwazi             opened March 2022 (Busch Gardens Tampa Bay)
//   Ice Breaker            opened February 2022 (SeaWorld Orlando)
//   Jurassic World VelociCoaster  opened June 2021 (Universal Islands of Adventure)
//   Candymonium            opened summer 2020 (Hersheypark)
//   Hagrid's Magical Creatures Motorbike Adventure  opened June 2019 (Universal Islands of Adventure)
//   Icon                   opened June 2018 (Blackpool Pleasure Beach)
//   Wicker Man             opened May 2018 (Alton Towers)
//   The Incredible Hulk Coaster  rebuilt, reopened June 2016 (Universal Islands of Adventure)
//   Mako                   opened June 2016 (SeaWorld Orlando)
//   Stardust Racers, Curse of the Werewolf, Hiccup's Wing Gliders, Mine-Cart
//     Madness              Universal Epic Universe opened May 2025
//
const FLOOR = '2015-01-01'
const MIN_DATE = {
  'Alton Towers::Nemesis Reborn': '2024-04-01',
  'Thorpe Park::Hyperia': '2024-06-01',
  'Chessington World of Adventures::Mandrill Mayhem': '2023-07-01',
  'Hersheypark::Wildcat\'s Revenge': '2023-07-01',
  'SeaWorld Orlando::Pipeline: The Surf Coaster': '2023-06-01',
  'Busch Gardens Tampa Bay::Iron Gwazi': '2022-04-01',
  'SeaWorld Orlando::Ice Breaker': '2022-03-01',
  'Universal Islands of Adventure::Jurassic World VelociCoaster': '2021-07-01',
  'Hersheypark::Candymonium': '2020-07-01',
  'Universal Islands of Adventure::Hagrid\'s Magical Creatures Motorbike Adventure': '2019-07-01',
  'Blackpool Pleasure Beach::Icon': '2018-07-01',
  'Alton Towers::Wicker Man': '2018-06-01',
  'Universal Islands of Adventure::The Incredible Hulk Coaster': '2016-07-01',
  'SeaWorld Orlando::Mako': '2016-07-01',
  'Universal Epic Universe::Stardust Racers': '2025-06-01',
  'Universal Epic Universe::Curse of the Werewolf': '2025-06-01',
  'Universal Epic Universe::Hiccup\'s Wing Gliders': '2025-06-01',
  'Universal Epic Universe::Mine-Cart Madness': '2025-06-01',
}
const minDateFor = (park, name) => MIN_DATE[`${park}::${name}`] ?? FLOOR

// ----------------------------------------------------- account A's real history
//
// 40 distinct coasters (inside the 35-45 the brief asks for), picked by hand
// rather than at random, because every requirement on this account is
// specific: both countries, several parks, and (deliberately generous) every
// one of the 14 manufacturers in the catalogue, so all five dashboard views
// have more than a single bar wherever the view's own shape allows more than
// one (my_totals and my_most_ridden are one row each by design: a headline
// number and a single "most ridden" coaster, not a breakdown).
const ACCOUNT_A_COASTERS = [
  // Alton Towers (GB) - home park, all six
  ['Alton Towers', 'Nemesis Reborn'],
  ['Alton Towers', 'Oblivion'],
  ['Alton Towers', 'The Smiler'],
  ['Alton Towers', 'Wicker Man'],
  ['Alton Towers', 'Rita'],
  ['Alton Towers', 'Th13teen'],
  // Thorpe Park (GB), all five
  ['Thorpe Park', 'Stealth'],
  ['Thorpe Park', 'Nemesis Inferno'],
  ['Thorpe Park', 'Colossus'],
  ['Thorpe Park', 'The Swarm'],
  ['Thorpe Park', 'Hyperia'],
  // Blackpool Pleasure Beach (GB), all four
  ['Blackpool Pleasure Beach', 'The Big One'],
  ['Blackpool Pleasure Beach', 'Icon'],
  ['Blackpool Pleasure Beach', 'Grand National'],
  ['Blackpool Pleasure Beach', 'Big Dipper'],
  // Chessington World of Adventures (GB), both
  ['Chessington World of Adventures', 'Mandrill Mayhem'],
  ['Chessington World of Adventures', 'Vampire'],
  // Universal Islands of Adventure (US), all three
  ['Universal Islands of Adventure', 'The Incredible Hulk Coaster'],
  ['Universal Islands of Adventure', 'Jurassic World VelociCoaster'],
  ['Universal Islands of Adventure', "Hagrid's Magical Creatures Motorbike Adventure"],
  // Universal Studios Florida (US), both
  ['Universal Studios Florida', 'Hollywood Rip Ride Rockit'],
  ['Universal Studios Florida', 'Revenge of the Mummy'],
  // Universal Epic Universe (US), the two oldest of the four (opened May 2025)
  ['Universal Epic Universe', 'Stardust Racers'],
  ['Universal Epic Universe', 'Curse of the Werewolf'],
  // SeaWorld Orlando (US), three of five
  ['SeaWorld Orlando', 'Mako'],
  ['SeaWorld Orlando', 'Manta'],
  ['SeaWorld Orlando', 'Kraken'],
  // Busch Gardens Tampa Bay (US), three of five
  ['Busch Gardens Tampa Bay', 'Iron Gwazi'],
  ['Busch Gardens Tampa Bay', 'SheiKra'],
  ['Busch Gardens Tampa Bay', 'Montu'],
  // Hersheypark (US), all ten - the big US trip
  ['Hersheypark', 'Skyrush'],
  ['Hersheypark', 'Candymonium'],
  ['Hersheypark', "Wildcat's Revenge"],
  ['Hersheypark', 'Great Bear'],
  ['Hersheypark', 'Storm Runner'],
  ['Hersheypark', 'Fahrenheit'],
  ['Hersheypark', 'Lightning Racer'],
  ['Hersheypark', 'Comet'],
  ['Hersheypark', 'Laff Trakk'],
  ['Hersheypark', 'Sooperdooperlooper'],
]

// Extra rides (beyond the one that earns the credit) so at least one coaster,
// in fact two, are ridden more than once: FR3/FR4 need total rides to be able
// to exceed total credits, and my_most_ridden needs an unambiguous answer.
const ACCOUNT_A_REPEATS = [
  { park: 'Alton Towers', name: 'Nemesis Reborn', extraRides: 1, gapDays: [45] },
  { park: 'Hersheypark', name: 'Great Bear', extraRides: 2, gapDays: [70, 160] },
]

// A few notes, applied by (park, name) to specific rides so the history reads
// like a person's, not a fixture. Optional field, well under the 280 char cap.
const ACCOUNT_A_NOTES = {
  'Alton Towers::Nemesis Reborn': 'First ride back after the retrack, worth the wait.',
  'Blackpool Pleasure Beach::Big Dipper': 'Rattly but a proper piece of history.',
  'Universal Islands of Adventure::Jurassic World VelociCoaster': 'Launch out of the raptor paddock is still the best in Florida.',
  'Busch Gardens Tampa Bay::Iron Gwazi': "Best airtime of the whole US trip.",
  'Hersheypark::Great Bear': 'Still holds up next to everything newer here.',
  'Hersheypark::Comet': 'Charming, in a way the steel ones are not.',
}

// ------------------------------------------------------------- demo accounts
//
// 12 accounts (inside the 8-12 the brief asks for). Credits are hand-picked to
// read as one interesting ranking together with account A, not a straight
// line: a leader well ahead (A, 40), a contested pack a few credits apart from
// each other, then a thin tail trailing off toward a brand-new account with
// two credits. `leaderboard` is opted in for roughly two thirds (8 of 12).
const DEMO_ACCOUNTS = [
  { email: 'demo1@creditcount.app', displayName: 'Owen Faulkner', credits: 32, onBoard: true, countryBias: 'GB' },
  { email: 'demo2@creditcount.app', displayName: 'trackrat88', credits: 24, onBoard: true, countryBias: 'mixed' },
  { email: 'demo3@creditcount.app', displayName: 'Megan Talbot', credits: 23, onBoard: true, countryBias: 'US' },
  { email: 'demo4@creditcount.app', displayName: 'loopscream', credits: 21, onBoard: true, countryBias: 'mixed' },
  { email: 'demo5@creditcount.app', displayName: 'Derek Voss', credits: 19, onBoard: false, countryBias: 'GB' },
  { email: 'demo6@creditcount.app', displayName: 'airtimejunkie', credits: 14, onBoard: true, countryBias: 'US' },
  { email: 'demo7@creditcount.app', displayName: 'Priya Nandakumar', credits: 13, onBoard: true, countryBias: 'mixed' },
  { email: 'demo8@creditcount.app', displayName: 'backrowbandit', credits: 11, onBoard: false, countryBias: 'GB' },
  { email: 'demo9@creditcount.app', displayName: 'Callum Ashworth', credits: 9, onBoard: true, countryBias: 'US' },
  { email: 'demo10@creditcount.app', displayName: 'Naomi Okafor', credits: 7, onBoard: false, countryBias: 'mixed' },
  { email: 'demo11@creditcount.app', displayName: 'steelvulture', credits: 4, onBoard: true, countryBias: 'GB' },
  { email: 'demo12@creditcount.app', displayName: 'Ruth Blackwood', credits: 2, onBoard: false, countryBias: 'US' },
]

// ----------------------------------------------------------------- date logic

/** One coaster's-worth of catalogue row, joined against MIN_DATE above. */
function withMinDate(row) {
  return { ...row, minDate: minDateFor(row.parkName, row.name) }
}

/** Groups a user's selected coasters into park visits (several rides, one
 *  date), splitting a park into two visits when there is a lot to ride there
 *  in one trip - real people do not clear a ten-credit park in a single day. */
function buildVisits(coasters) {
  const byPark = new Map()
  for (const c of coasters) {
    if (!byPark.has(c.parkName)) byPark.set(c.parkName, [])
    byPark.get(c.parkName).push(c)
  }
  const visits = []
  for (const [parkName, list] of byPark) {
    if (list.length > 6) {
      const mid = Math.ceil(list.length / 2)
      visits.push({ parkName, coasters: list.slice(0, mid) })
      visits.push({ parkName, coasters: list.slice(mid) })
    } else {
      visits.push({ parkName, coasters: list })
    }
  }
  return visits
}

/** Assigns one date per visit, walking forward in time so a single account's
 *  trips read as a chronology: never before any coaster in that visit existed,
 *  never after CUTOFF, and never earlier than the visit before it. */
function assignVisitDates(visits, seed) {
  const rng = mulberry32(seed)
  const withFloor = visits
    .map((v) => ({
      ...v,
      floor: v.coasters.reduce((max, c) => (c.minDate > max ? c.minDate : max), FLOOR),
    }))
    .sort((a, b) => a.floor.localeCompare(b.floor))

  let cursor = new Date(`${FLOOR}T00:00:00Z`)
  const dated = []
  for (const v of withFloor) {
    const floorDate = new Date(`${v.floor}T00:00:00Z`)
    if (cursor < floorDate) cursor = floorDate
    const jitterDays = Math.floor(rng() * 60)
    let date = new Date(cursor.getTime() + jitterDays * DAY_MS)
    if (date > CUTOFF) date = new Date(CUTOFF)
    if (date < floorDate) date = floorDate
    dated.push({ ...v, date })
    const gapDays = 20 + Math.floor(rng() * 300)
    cursor = new Date(date.getTime() + gapDays * DAY_MS)
  }
  return dated
}

/** Turns dated visits into flat ride rows for one user. */
function ridesFromVisits(userId, datedVisits, notesByKey = {}) {
  const rows = []
  for (const v of datedVisits) {
    for (const c of v.coasters) {
      const key = `${c.parkName}::${c.name}`
      rows.push({
        user_id: userId,
        coaster_id: c.id,
        ridden_on: toISODate(v.date),
        note: notesByKey[key] ?? null,
      })
    }
  }
  return rows
}

/** Extra repeat rides for account A, dated after the coaster's first ride. */
function repeatRides(userId, datedVisits, repeats) {
  const firstRideDate = new Map()
  for (const v of datedVisits) {
    for (const c of v.coasters) {
      const key = `${c.parkName}::${c.name}`
      if (!firstRideDate.has(key)) firstRideDate.set(key, v.date)
    }
  }
  const rows = []
  for (const r of repeats) {
    const key = `${r.park}::${r.name}`
    const first = firstRideDate.get(key)
    const coaster = datedVisits.flatMap((v) => v.coasters).find((c) => `${c.parkName}::${c.name}` === key)
    if (!first || !coaster) continue
    for (let i = 0; i < r.extraRides; i++) {
      const gap = r.gapDays[i] ?? 30 * (i + 1)
      let date = new Date(first.getTime() + gap * DAY_MS)
      if (date > CUTOFF) date = new Date(CUTOFF)
      rows.push({ user_id: userId, coaster_id: coaster.id, ridden_on: toISODate(date), note: null })
    }
  }
  return rows
}

// --------------------------------------------------------------------- main

async function main() {
  console.log('Credit Count demo seed')
  console.log(SUPABASE_URL)

  // -------------------------------------------------------- 1. the catalogue
  const { data: coasterRows, error: catErr } = await admin
    .from('coasters')
    .select('id, name, park:parks(name, country_code), manufacturer:manufacturers(name)')
  if (catErr) throw catErr
  const catalogue = coasterRows.map((c) => ({
    id: c.id,
    name: c.name,
    parkName: c.park.name,
    country: c.park.country_code,
    manufacturer: c.manufacturer?.name ?? 'Unknown',
  }))
  console.log(`\ncatalogue: ${catalogue.length} coasters read back from the database`)

  const findCoaster = (parkName, name) => {
    const c = catalogue.find((x) => x.parkName === parkName && x.name === name)
    if (!c) throw new Error(`coaster not found in catalogue: ${parkName} :: ${name}`)
    return withMinDate(c)
  }

  // ---------------------------------------------------- 2. existing accounts
  const { data: userPage, error: listErr } = await admin.auth.admin.listUsers({ perPage: 1000 })
  if (listErr) throw listErr
  const byEmail = new Map(userPage.users.map((u) => [u.email, u]))

  const accountA = byEmail.get(A_EMAIL)
  if (!accountA) {
    console.error(`account A (${A_EMAIL}) does not exist yet; Phase 0 creates it, this script does not`)
    process.exit(2)
  }

  // ------------------------------------------------- 3. create demo accounts
  let created = 0
  let reused = 0
  for (const acc of DEMO_ACCOUNTS) {
    const existing = byEmail.get(acc.email)
    if (existing) {
      acc.userId = existing.id
      reused++
      continue
    }
    const { data, error } = await admin.auth.admin.createUser({
      email: acc.email,
      password: DEMO_PASSWORD,
      email_confirm: true, // no mail provider in this deployment (TDD 5); demo accounts sign in nowhere anyway
      user_metadata: { display_name: acc.displayName },
    })
    if (error) throw new Error(`could not create ${acc.email}: ${error.message}`)
    acc.userId = data.user.id
    created++
  }
  console.log(`\naccounts: ${created} created, ${reused} already existed, ${DEMO_ACCOUNTS.length} demo accounts total`)

  // handle_new_user() writes the profiles row inside the same transaction as
  // the auth.users insert, but this confirms it landed rather than assuming so.
  for (const acc of DEMO_ACCOUNTS) {
    const { data: prof, error } = await admin
      .from('profiles')
      .select('id')
      .eq('id', acc.userId)
      .maybeSingle()
    if (error) throw error
    if (!prof) throw new Error(`handle_new_user() did not create a profile for ${acc.email}`)
  }

  // ------------------------------------- 4. display name + opt-in, every run
  // Idempotent on purpose: whatever a reviewer toggles by hand in the UI while
  // poking at a demo account, the next run of this script restores the plan
  // above, because these are demo accounts and this script is their source of
  // truth, not a one-time bootstrap.
  for (const acc of DEMO_ACCOUNTS) {
    const { error } = await admin
      .from('profiles')
      .update({ display_name: acc.displayName, show_on_leaderboard: acc.onBoard })
      .eq('id', acc.userId)
    if (error) throw error
  }

  // --------------------------------------------------- 5. build every ride
  const managedUserIds = [accountA.id, ...DEMO_ACCOUNTS.map((a) => a.userId)]
  let allRides = []

  // Account A: the hand-picked 40, plus the repeats.
  {
    const coasters = ACCOUNT_A_COASTERS.map(([park, name]) => findCoaster(park, name))
    const visits = assignVisitDates(buildVisits(coasters), seedFromString(A_EMAIL))
    const base = ridesFromVisits(accountA.id, visits, ACCOUNT_A_NOTES)
    const extra = repeatRides(accountA.id, visits, ACCOUNT_A_REPEATS)
    allRides = allRides.concat(base, extra)
  }

  // Demo accounts: shuffled selection from the catalogue, country-biased.
  for (const acc of DEMO_ACCOUNTS) {
    const rng = mulberry32(seedFromString(acc.email))
    let pool = catalogue.map(withMinDate)
    if (acc.countryBias !== 'mixed') {
      const biased = pool.filter((c) => c.country === acc.countryBias)
      const rest = pool.filter((c) => c.country !== acc.countryBias)
      pool = shuffle(biased, rng).concat(shuffle(rest, rng))
    } else {
      pool = shuffle(pool, rng)
    }
    const chosen = pool.slice(0, Math.min(acc.credits, pool.length))
    const visits = assignVisitDates(buildVisits(chosen), seedFromString(acc.email + ':dates'))
    allRides = allRides.concat(ridesFromVisits(acc.userId, visits))
  }

  // ----------------------------------------- 6. reset and insert, idempotently
  const { error: delErr } = await admin.from('rides').delete().in('user_id', managedUserIds)
  if (delErr) throw delErr

  const CHUNK = 500
  let inserted = 0
  for (let i = 0; i < allRides.length; i += CHUNK) {
    const slice = allRides.slice(i, i + CHUNK)
    const { error } = await admin.from('rides').insert(slice)
    if (error) throw error
    inserted += slice.length
  }
  console.log(`\nrides: cleared previous rows for ${managedUserIds.length} managed accounts, inserted ${inserted} rows`)

  // ------------------------------------------------------------ 7. count, don't assert
  console.log('\nverifying against the database, not against what this script meant to insert')

  const { count: ridesNow, error: cntErr } = await admin
    .from('rides')
    .select('id', { count: 'exact', head: true })
    .in('user_id', managedUserIds)
  if (cntErr) throw cntErr
  console.log(`  rides now in the table for these ${managedUserIds.length} accounts: ${ridesNow}`)

  const { count: onBoardCount, error: obErr } = await admin
    .from('profiles')
    .select('id', { count: 'exact', head: true })
    .in(
      'id',
      DEMO_ACCOUNTS.map((a) => a.userId),
    )
    .eq('show_on_leaderboard', true)
  if (obErr) throw obErr
  console.log(`  demo accounts opted into the leaderboard: ${onBoardCount} / ${DEMO_ACCOUNTS.length}`)

  // Account A's own dashboard, read exactly as A would read it: sign in with
  // the anon key and A's real password, the same client the app uses.
  const A_PASSWORD = need('TEST_ENTHUSIAST_PASSWORD')
  const asA = createClient(SUPABASE_URL, ANON_KEY, { auth: { autoRefreshToken: false, persistSession: false } })
  const { error: signInErr } = await asA.auth.signInWithPassword({ email: A_EMAIL, password: A_PASSWORD })
  if (signInErr) throw new Error(`could not sign in as account A to verify: ${signInErr.message}`)

  const { data: totals, error: totalsErr } = await asA.from('my_totals').select('credits, rides').single()
  if (totalsErr) throw totalsErr
  console.log(`\naccount A (${A_EMAIL}, "Alex Rivera"), read through the same views the dashboard uses:`)
  console.log(`  credits: ${totals.credits}  (target 35-45)`)
  console.log(`  rides:   ${totals.rides}  (must exceed credits: at least one coaster ridden twice)`)

  const viewRowCounts = {}
  for (const view of ['my_totals', 'my_credits_by_country', 'my_credits_by_manufacturer', 'my_credits_by_type', 'my_most_ridden']) {
    const { data, error } = await asA.from(view).select('*')
    if (error) throw error
    viewRowCounts[view] = data.length
    console.log(`  ${view}: ${data.length} row(s)`)
  }

  const { data: mostRidden } = await asA.from('my_most_ridden').select('name, rides').single()
  if (mostRidden) console.log(`  most ridden: "${mostRidden.name}" x${mostRidden.rides}`)

  // The public leaderboard, called exactly as a signed-out visitor calls it.
  const { data: board, error: boardErr } = await anon.rpc('leaderboard', { page_size: 50, page_offset: 0 })
  if (boardErr) throw boardErr
  console.log(`\npublic leaderboard, called signed-out via the anon key: ${board.length} row(s) (must be >= 8)`)
  for (const row of board.slice(0, 5)) {
    console.log(`  #${row.rank}  ${row.display_name}  ${row.credits} credits`)
  }
  if (board.length > 5) console.log(`  ... and ${board.length - 5} more`)

  // -------------------------------------------------------------- exit status
  const problems = []
  if (totals.credits < 35 || totals.credits > 45) problems.push(`account A has ${totals.credits} credits, expected 35-45`)
  if (totals.rides <= totals.credits) problems.push('account A has no repeat ride: rides did not exceed credits')
  if (board.length < 8) problems.push(`public leaderboard has ${board.length} rows, expected at least 8`)
  if (viewRowCounts.my_credits_by_country < 2) problems.push('account A has rides from only one country')

  if (problems.length) {
    console.error('\nFAILED:')
    for (const p of problems) console.error(`  - ${p}`)
    process.exit(1)
  }
  console.log('\ndemo data seeded and verified')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
