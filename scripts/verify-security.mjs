#!/usr/bin/env node
/**
 * verify-security.mjs
 *
 * AC2 and AC4 describe an attack, so the delivery performs it.
 *
 * This speaks plain HTTP to PostgREST and GoTrue, never the Supabase SDK, because
 * the criteria say "direct API calls". It holds only what a stranger would hold:
 * the project URL, the publishable key, and the two delivered account passwords.
 * All of them come from the environment. Nothing is written down here (AC5).
 *
 * Two rules that shape every assertion:
 *
 *   1. A rejection can be loud or silent. PostgREST answers 403 when a grant or an
 *      INSERT policy blocks you, but it answers 204 to a DELETE or PATCH that simply
 *      matched no rows. Silence is not proof. So every destructive attempt is followed
 *      by the owner re-reading the row and confirming it is unchanged.
 *
 *   2. A gate that only proves failures would pass with the API switched off. Steps 3,
 *      5, 6 and 7 therefore assert that legitimate actions still succeed.
 *
 * Exit code 0 means every defence held and every control passed. Anything else fails
 * the build, and it runs before push.
 */

const need = (k) => {
  const v = process.env[k];
  if (!v) { console.error(`missing environment variable: ${k}`); process.exit(2); }
  return v;
};

const URL_BASE   = need('NEXT_PUBLIC_SUPABASE_URL').replace(/\/$/, '');
const PUBKEY     = need('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY');
const A_EMAIL    = need('TEST_ENTHUSIAST_EMAIL');
const A_PASSWORD = need('TEST_ENTHUSIAST_PASSWORD');
const ADMIN_EMAIL    = need('TEST_ADMIN_EMAIL');
const ADMIN_PASSWORD = need('TEST_ADMIN_PASSWORD');
const APP_URL    = process.env.APP_URL?.replace(/\/$/, '') || null;

// ---------------------------------------------------------------- reporting

let failures = 0, checks = 0;
const cleanup = [];

const ok   = (m) => { checks++; console.log(`  pass  ${m}`); };
const fail = (m, detail) => {
  checks++; failures++;
  console.error(`  FAIL  ${m}`);
  if (detail !== undefined) console.error(`        ${JSON.stringify(detail).slice(0, 400)}`);
};
const step = (n, title) => console.log(`\n${n}. ${title}`);

// ------------------------------------------------------------------- client

async function call(path, { token, method = 'GET', body, prefer, raw } = {}) {
  const headers = { apikey: PUBKEY, 'Content-Type': 'application/json' };
  if (token)  headers.Authorization = `Bearer ${token}`;
  if (prefer) headers.Prefer = prefer;
  const res = await fetch(`${URL_BASE}${path}`, {
    method, headers, body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  return raw ? { status: res.status, data, text } : { status: res.status, data };
}

const rest = (p, o) => call(`/rest/v1${p}`, o);
const rpc  = (fn, args, o) => call(`/rest/v1/rpc/${fn}`, { method: 'POST', body: args ?? {}, ...o });

async function signIn(email, password) {
  const r = await call('/auth/v1/token?grant_type=password', {
    method: 'POST', body: { email, password },
  });
  if (r.status !== 200 || !r.data?.access_token) {
    console.error(`cannot sign in as ${email}: ${r.status} ${JSON.stringify(r.data).slice(0, 200)}`);
    process.exit(2);
  }
  return { token: r.data.access_token, id: r.data.user.id };
}

async function signUp(email, password, data) {
  return call('/auth/v1/signup', { method: 'POST', body: { email, password, data } });
}

/** A write is "blocked" whether it errored loudly or matched nothing. The caller
 *  must still re-read as the owner: this only rules out an obvious success. */
const blocked = (r) => r.status === 401 || r.status === 403 || r.status === 404 ||
                       r.status === 204 || (Array.isArray(r.data) && r.data.length === 0);

// ---------------------------------------------------------------------- run

console.log(`Credit Count security gate\n${URL_BASE}`);

const A     = await signIn(A_EMAIL, A_PASSWORD);
const ADMIN = await signIn(ADMIN_EMAIL, ADMIN_PASSWORD);

// ---------------------------------------------------------------------------
step(1, 'Privilege escalation: at sign-up, and afterwards by direct PATCH');
// ---------------------------------------------------------------------------
// The attacker who wins here wins everything, so it is tested twice: once through
// the metadata the sign-up form controls, and once against the profile row itself.
// The account created by the attack becomes user B, so there is no third password
// to deliver and no second identity to keep in sync.

const stamp   = Date.now();
const B_EMAIL = `gate+${stamp}@credit-count.test`;
const B_PASSWORD = `gate-${stamp}-${Math.random().toString(36).slice(2, 10)}`;

const up = await signUp(B_EMAIL, B_PASSWORD, { display_name: 'Gate B', role: 'admin' });
if (up.status >= 400) {
  console.error(`sign-up failed: ${up.status} ${JSON.stringify(up.data).slice(0, 300)}`);
  console.error('if this says email confirmation is required, turn it off: the gate and the');
  console.error('delivered accounts both need to sign in without a mail provider.');
  process.exit(2);
}
const B = await signIn(B_EMAIL, B_PASSWORD);

const bProfile = await rest(`/profiles?id=eq.${B.id}&select=id,display_name,role,show_on_leaderboard`, { token: B.token });
const bRole = bProfile.data?.[0]?.role;
bRole === 'enthusiast'
  ? ok(`sign-up metadata "role":"admin" was ignored, profile is ${bRole}`)
  : fail('sign-up metadata injected a role', bProfile.data);

bProfile.data?.[0]?.show_on_leaderboard === false
  ? ok('new account starts off the leaderboard (SOW 2, privacy is the default)')
  : fail('new account is visible on the leaderboard by default', bProfile.data);

// direct PATCH on role alone
const patchRole = await rest(`/profiles?id=eq.${B.id}`, {
  token: B.token, method: 'PATCH', body: { role: 'admin' },
});
// and mixed with a column the grant does allow, which is the sneakier shape
const patchMixed = await rest(`/profiles?id=eq.${B.id}`, {
  token: B.token, method: 'PATCH', body: { display_name: 'Gate B2', role: 'admin' },
});

// Prefer: return=representation is a different code path: PostgREST reads the row
// back inside the same statement. A column grant violation has to block that read
// too, or the write only looks silent while actually going through under this header.
const patchRepr = await rest(`/profiles?id=eq.${B.id}`, {
  token: B.token, method: 'PATCH', prefer: 'return=representation', body: { role: 'admin' },
});
(patchRepr.status === 401 || patchRepr.status === 403)
  ? ok(`PATCH role with Prefer: return=representation rejected (${patchRepr.status})`)
  : fail('PATCH with return=representation let the write through', patchRepr.data);

// An upsert-as-POST is a second, separate code path into the same column:
// PostgREST turns on_conflict into INSERT ... ON CONFLICT DO UPDATE, checked
// against the INSERT grant and policy rather than the UPDATE one that denies
// role above. profiles has no INSERT grant at all for authenticated (TDD 3), so
// this should die even earlier than the PATCH does.
const upsertRole = await rest(`/profiles?on_conflict=id`, {
  token: B.token, method: 'POST',
  prefer: 'resolution=merge-duplicates,return=representation',
  body: { id: B.id, display_name: 'Gate B Upsert', role: 'admin', show_on_leaderboard: false },
});
(upsertRole.status === 401 || upsertRole.status === 403)
  ? ok(`upsert POST with on_conflict=id rejected (${upsertRole.status})`)
  : fail('an upsert POST promoted the account to admin', upsertRole.data);

const afterPatch = await rest(`/profiles?id=eq.${B.id}&select=role`, { token: B.token });
afterPatch.data?.[0]?.role === 'enthusiast'
  ? ok(`direct PATCH of role rejected (${patchRole.status}, mixed ${patchMixed.status}, ` +
       `representation ${patchRepr.status}, upsert ${upsertRole.status}), still enthusiast`)
  : fail('a direct PATCH promoted the account to admin', afterPatch.data);

// ---------------------------------------------------------------------------
step(2, "Another user's ride history: read, write, delete, and the statistic views");
// ---------------------------------------------------------------------------
// FR6, FR9, AC2. Tested as B and as admin, because SOW 3 says an admin has no
// access to private ride histories either, and most RLS tutorials add that bypass
// without thinking.

const anyCoaster = await rest('/coasters?select=id,name&limit=1', { token: A.token });
const coasterId = anyCoaster.data?.[0]?.id;
if (!coasterId) { console.error('catalogue is empty, seed it first'); process.exit(2); }

const seedRide = await rest('/rides', {
  token: A.token, method: 'POST', prefer: 'return=representation',
  body: { user_id: A.id, coaster_id: coasterId, ridden_on: '2026-01-15', note: 'gate fixture' },
});
const rideId = seedRide.data?.[0]?.id;
if (!rideId) { console.error("could not create A's fixture ride", seedRide); process.exit(2); }
cleanup.push(() => rest(`/rides?id=eq.${rideId}`, { token: A.token, method: 'DELETE' }));

for (const [who, actor] of [['B', B], ['admin', ADMIN]]) {
  const read = await rest(`/rides?id=eq.${rideId}&select=*`, { token: actor.token });
  (Array.isArray(read.data) && read.data.length === 0)
    ? ok(`${who} cannot read A's ride`)
    : fail(`${who} read A's ride`, read.data);

  const upd = await rest(`/rides?id=eq.${rideId}`, {
    token: actor.token, method: 'PATCH', body: { note: `owned by ${who}` },
  });
  const del = await rest(`/rides?id=eq.${rideId}`, { token: actor.token, method: 'DELETE' });
  const ins = await rest('/rides', {
    token: actor.token, method: 'POST',
    body: { user_id: A.id, coaster_id: coasterId, ridden_on: '2026-01-16' },
  });

  // the only assertion that counts: A re-reads the row
  const mine = await rest(`/rides?id=eq.${rideId}&select=id,note`, { token: A.token });
  const row = mine.data?.[0];
  row && row.note === 'gate fixture'
    ? ok(`${who} could not update or delete A's ride (patch ${upd.status}, delete ${del.status}), A re-read it unchanged`)
    : fail(`${who} modified or destroyed A's ride`, mine.data);

  blocked(ins) && !(Array.isArray(ins.data) && ins.data.length)
    ? ok(`${who} cannot insert a ride owned by A (${ins.status})`)
    : fail(`${who} inserted a ride into A's history`, ins.data);
}

// The five statistic views carry no `where user_id`: the policy on rides is what
// scopes them. If one loses security_invoker it serves the global aggregate in
// silence, and the internal invariant would still look correct. So compare what B
// sees against what B actually owns.
const bRides = await rest('/rides?select=id,coaster_id', { token: B.token });
const bOwn = Array.isArray(bRides.data) ? bRides.data.length : -1;
const bTotals = await rest('/my_totals?select=credits,rides', { token: B.token });
const seen = bTotals.data?.[0]?.rides;
seen === bOwn
  ? ok(`my_totals shows B ${seen} rides, exactly what B owns (views are scoped to the caller)`)
  : fail(`a statistic view served B ${seen} rides while B owns ${bOwn}: security_invoker is missing somewhere`, bTotals.data);

// Compared against what B actually owns, not merely "an array came back": the old
// check, `bOwn > 0 || r.data.length === 0`, was true by construction whenever B had
// any rides at all, whatever those rows actually contained. B is freshly created and
// owns zero rides today, so the old line only ever passed for the wrong reason.
const bCredits = bTotals.data?.[0]?.credits;
for (const v of ['my_credits_by_country', 'my_credits_by_manufacturer', 'my_credits_by_type']) {
  const r = await rest(`/${v}?select=credits`, { token: B.token });
  const rows = Array.isArray(r.data) ? r.data : [];
  const viewSum = rows.reduce((t, x) => t + (x.credits ?? 0), 0);
  viewSum === bCredits
    ? ok(`${v} sums to B's own ${bCredits} credits, not a leaked global aggregate`)
    : fail(`${v} summed to ${viewSum}, but B owns ${bCredits} credits: security_invoker is missing somewhere`, r.data);
}

// my_most_ridden has no `credits` column to sum (it is one row, `limit 1`), so it is
// compared against `bOwn` directly instead: zero rows when B owns nothing, exactly
// one row otherwise, and that row's ride count can be at most what B owns.
const bMostRidden = await rest('/my_most_ridden?select=coaster_id,rides', { token: B.token });
const mrRows = Array.isArray(bMostRidden.data) ? bMostRidden.data : [];
const mrOk = bOwn === 0
  ? mrRows.length === 0
  : mrRows.length === 1 && mrRows[0].rides >= 1 && mrRows[0].rides <= bOwn;
mrOk
  ? ok(`my_most_ridden is scoped to B (${bOwn} rides owned, view shows ${mrRows[0]?.rides ?? 0})`)
  : fail(`my_most_ridden leaked or misrepresented rows for a user with ${bOwn} rides`, bMostRidden.data);

// ---------------------------------------------------------------------------
step(3, 'Catalogue writes: all three tables, as an enthusiast and as an admin');
// ---------------------------------------------------------------------------
// FR8, AC4. The catalogue is coasters plus parks plus manufacturers. Renaming a
// manufacturer moves every user's breakdown, so it is the same privilege.

const probe = { coasters: null, parks: null, manufacturers: null };

const parkId = (await rest('/parks?select=id&limit=1', { token: A.token })).data?.[0]?.id;
const attempts = {
  coasters:      { name: `Gate Coaster ${stamp}`, park_id: parkId, track_type: 'steel' },
  parks:         { name: `Gate Park ${stamp}`, country_code: 'GB' },
  manufacturers: { name: `Gate Works ${stamp}` },
};

for (const [table, payload] of Object.entries(attempts)) {
  const asB = await rest(`/${table}`, { token: B.token, method: 'POST', prefer: 'return=representation', body: payload });
  (blocked(asB) && !asB.data?.[0]?.id)
    ? ok(`enthusiast cannot insert into ${table} (${asB.status})`)
    : fail(`enthusiast inserted into ${table}`, asB.data);
}

// an UPDATE on an existing row is the shape that actually damages other users
const anyMan = (await rest('/manufacturers?select=id,name&limit=1', { token: A.token })).data?.[0];
if (anyMan) {
  await rest(`/manufacturers?id=eq.${anyMan.id}`, { token: B.token, method: 'PATCH', body: { name: `Hijacked ${stamp}` } });
  const after = await rest(`/manufacturers?id=eq.${anyMan.id}&select=name`, { token: A.token });
  after.data?.[0]?.name === anyMan.name
    ? ok('enthusiast cannot rename a manufacturer, so nobody else\'s breakdown moves')
    : fail('an enthusiast renamed a manufacturer', after.data);
}

// positive control: the admin must be able to do all three
for (const [table, payload] of Object.entries(attempts)) {
  const asAdmin = await rest(`/${table}`, { token: ADMIN.token, method: 'POST', prefer: 'return=representation', body: payload });
  const id = asAdmin.data?.[0]?.id;
  if (id) {
    probe[table] = id;
    cleanup.push(() => rest(`/${table}?id=eq.${id}`, { token: ADMIN.token, method: 'DELETE' }));
    ok(`admin can insert into ${table} (positive control)`);
  } else {
    fail(`admin could NOT insert into ${table}: the catalogue is unmanageable`, asAdmin.data);
  }
}

// ---------------------------------------------------------------------------
step(4, 'Signed out, and one user reading another: everything closed (FR1)');
// ---------------------------------------------------------------------------

for (const table of ['coasters', 'parks', 'manufacturers', 'profiles', 'rides']) {
  const r = await rest(`/${table}?select=*&limit=5`);
  (r.status === 401 || (Array.isArray(r.data) && r.data.length === 0))
    ? ok(`visitor reads nothing from ${table} (${r.status})`)
    : fail(`a signed-out visitor read ${table}`, r.data);
}

const aSeenByB = await rest(`/profiles?id=eq.${A.id}&select=*`, { token: B.token });
(Array.isArray(aSeenByB.data) && aSeenByB.data.length === 0)
  ? ok("B cannot read A's profile row")
  : fail("B read A's profile", aSeenByB.data);

// ---------------------------------------------------------------------------
step(5, 'The public leaderboard: shape, and that it is not empty (AC3)');
// ---------------------------------------------------------------------------
// "the keys must be exactly these three" is vacuously true on an empty board, and
// an empty board is a real failure mode, so the row count is asserted first.

await rest(`/profiles?id=eq.${A.id}`, { token: A.token, method: 'PATCH', body: { show_on_leaderboard: true } });

const board = await rpc('leaderboard', { page_size: 50, page_offset: 0 });
const rows = Array.isArray(board.data) ? board.data : [];
rows.length > 0
  ? ok(`leaderboard is readable signed out and carries ${rows.length} rows`)
  : fail('leaderboard is empty or unreadable signed out', board.data);

const EXPECTED = ['credits', 'display_name', 'rank'];
const badShape = rows.filter((r) => JSON.stringify(Object.keys(r).sort()) !== JSON.stringify(EXPECTED));
badShape.length === 0 && rows.length > 0
  ? ok('every row carries exactly rank, display_name, credits, and nothing else')
  : fail('the leaderboard exposed a column beyond the three FR7 allows', badShape[0]);

// a caller asking for the whole table must be capped by the function, not obeyed
const greedy = await rpc('leaderboard', { page_size: 100000, page_offset: 0 });
(Array.isArray(greedy.data) && greedy.data.length <= 100)
  ? ok(`page size is capped inside the function (asked 100000, got ${greedy.data.length})`)
  : fail('the caller chose the page size', greedy.data?.length);

// ---------------------------------------------------------------------------
step(6, 'Counting: three coasters, one ridden twice (AC1), and the breakdown invariant');
// ---------------------------------------------------------------------------
// Measured as a delta, never as an absolute, because account A ships with a seeded
// history so the demo is not empty.

const cat = await rest('/coasters?select=id&limit=3', { token: A.token });
const three = (cat.data ?? []).map((c) => c.id);
if (three.length < 3) { console.error('need at least 3 coasters in the catalogue'); process.exit(2); }

const before = (await rest('/my_totals?select=credits,rides', { token: A.token })).data?.[0];

const logged = [];
for (const id of [...three, three[0]]) {           // one of them twice: FR3
  const r = await rest('/rides', {
    token: A.token, method: 'POST', prefer: 'return=representation',
    body: { user_id: A.id, coaster_id: id, ridden_on: '2026-02-01' },
  });
  if (r.data?.[0]?.id) logged.push(r.data[0].id);
}
for (const id of logged) cleanup.push(() => rest(`/rides?id=eq.${id}`, { token: A.token, method: 'DELETE' }));

const after = (await rest('/my_totals?select=credits,rides', { token: A.token })).data?.[0];
const dRides = after.rides - before.rides;
const dCredits = after.credits - before.credits;

dRides === 4
  ? ok('four rides logged, ride count rose by four')
  : fail(`ride count rose by ${dRides}, expected 4`, { before, after });

(dCredits >= 0 && dCredits <= 3)
  ? ok(`credit count rose by ${dCredits}: riding the same coaster twice added a ride, not a credit`)
  : fail(`credit count rose by ${dCredits}, which is impossible for three distinct coasters`, { before, after });

const sum = async (view, field) => {
  const r = await rest(`/${view}?select=credits`, { token: A.token });
  return (r.data ?? []).reduce((t, x) => t + x.credits, 0);
};
const byCountry = await sum('my_credits_by_country');
const byType    = await sum('my_credits_by_type');
const byMaker   = await sum('my_credits_by_manufacturer');
(byCountry === after.credits && byType === after.credits && byMaker === after.credits)
  ? ok(`total credits (${after.credits}) equals the sum of every breakdown`)
  : fail('a breakdown does not sum to the total: a coaster is falling outside a bucket',
         { total: after.credits, byCountry, byType, byMaker });

// ---------------------------------------------------------------------------
step(7, 'Opting out means immediately, asserted against the rendered page (FR7)');
// ---------------------------------------------------------------------------
// The function was already proven correct above. What breaks "immediately" in
// practice is page caching, so this reads the HTML a visitor would receive.

const aName = (await rest(`/profiles?id=eq.${A.id}&select=display_name`, { token: A.token })).data?.[0]?.display_name;

const onBoard = (b) => (Array.isArray(b.data) ? b.data : []).some((r) => r.display_name === aName);

(await rpc('leaderboard', {}), onBoard(await rpc('leaderboard', {})))
  ? ok(`A ("${aName}") is on the board while opted in`)
  : fail('A opted in but does not appear on the board', aName);

// Presence, not only absence. A page that renders nobody at all (a broken ranking, an
// error boundary, a bad deploy) would previously pass this step: it never asserted
// A's name was on the page in the first place, only that it was gone after opting
// out. `!html.includes(name)` is true of an empty page too.
if (APP_URL) {
  const htmlWhileIn = await fetch(`${APP_URL}/`, { cache: 'no-store' }).then((r) => r.text()).catch(() => '');
  htmlWhileIn.includes(aName)
    ? ok(`A's name is present in the rendered page while opted in (${APP_URL})`)
    : fail('A is opted in but absent from the rendered page: a page that renders nobody would pass the absence check below for the wrong reason', APP_URL);
} else {
  console.log('  skip  APP_URL not set, the rendered-page presence check did not run');
}

await rest(`/profiles?id=eq.${A.id}`, { token: A.token, method: 'PATCH', body: { show_on_leaderboard: false } });
!onBoard(await rpc('leaderboard', {}))
  ? ok('opting out removed A from the board on the very next call')
  : fail('A is still on the board after opting out', aName);

if (APP_URL) {
  const html = await fetch(`${APP_URL}/`, { cache: 'no-store' }).then((r) => r.text()).catch(() => '');
  !html.includes(aName)
    ? ok(`A's name is absent from the rendered page at ${APP_URL}`)
    : fail('the rendered page still shows A after opting out: the page is cached', APP_URL);
} else {
  console.log('  skip  APP_URL not set, the rendered-page absence check did not run');
}

await rest(`/profiles?id=eq.${A.id}`, { token: A.token, method: 'PATCH', body: { show_on_leaderboard: true } });
onBoard(await rpc('leaderboard', {}))
  ? ok('opting back in restored A (positive control)')
  : fail('A did not come back after opting in again', aName);

// ---------------------------------------------------------------------------
step(8, 'catalogue_audit: the sixth table, unreachable from the API by design');
// ---------------------------------------------------------------------------
// TDD 3 says this table carries no client policy at all, so RLS-on-plus-zero-policy
// makes it unreachable by construction: written only by merge_coasters, read only in
// SQL. Nothing in this gate had ever tried it. Tried here as all three identities,
// read and write, because "closed" is a claim about every one of those, not just one.

const auditActors = [['signed out', null], ['enthusiast', B], ['admin', ADMIN]];

for (const [who, actor] of auditActors) {
  const opts = actor ? { token: actor.token } : {};

  const read = await rest('/catalogue_audit?select=*&limit=5', opts);
  (read.status === 401 || read.status === 403 || (Array.isArray(read.data) && read.data.length === 0))
    ? ok(`${who} cannot read catalogue_audit (${read.status})`)
    : fail(`${who} read catalogue_audit`, read.data);

  const write = await rest('/catalogue_audit', {
    ...opts, method: 'POST',
    body: {
      action: 'merge', actor_id: actor ? actor.id : null,
      survivor_id: coasterId, loser_id: coasterId, loser_name: 'gate probe', rides_moved: 0,
    },
  });
  (write.status === 401 || write.status === 403)
    ? ok(`${who} cannot write catalogue_audit (${write.status})`)
    : fail(`${who} wrote to catalogue_audit`, write.data);
}

// ---------------------------------------------------------------------------
step(9, 'merge_coasters: the elevated function nobody had attacked');
// ---------------------------------------------------------------------------
// A2 in the security review: merge_coasters re-points another user's rides and is
// one of exactly three SECURITY DEFINER functions, and this gate had never called
// it. Attacked as anon and as enthusiast (both must fail before touching anything),
// then exercised for real as admin, on a duplicate the test creates and cleans up
// itself: a real ride moves from the loser to the survivor, and the loser is gone.

const anonMerge = await rpc('merge_coasters', { survivor: coasterId, loser: coasterId });
(anonMerge.status === 401 || anonMerge.status === 403)
  ? ok(`signed-out call to merge_coasters rejected (${anonMerge.status})`)
  : fail('a signed-out call reached merge_coasters', anonMerge.data);

const enthusiastMerge = await rpc('merge_coasters', { survivor: coasterId, loser: coasterId }, { token: B.token });
(enthusiastMerge.status === 401 || enthusiastMerge.status === 403)
  ? ok(`enthusiast call to merge_coasters rejected (${enthusiastMerge.status})`)
  : fail('an enthusiast call reached merge_coasters', enthusiastMerge.data);

const untouched = await rest(`/coasters?id=eq.${coasterId}&select=id`, { token: A.token });
(untouched.data?.length === 1)
  ? ok('the probed coaster is unchanged after both blocked calls')
  : fail('a blocked merge_coasters call altered the catalogue anyway', untouched.data);

// positive control: admin merging a duplicate this run creates for the purpose
const mergePark = (await rest('/parks?select=id&limit=1', { token: A.token })).data?.[0]?.id;
const survivorMk = await rest('/coasters', {
  token: ADMIN.token, method: 'POST', prefer: 'return=representation',
  body: { name: `Gate Merge Survivor ${stamp}`, park_id: mergePark, track_type: 'steel' },
});
const loserMk = await rest('/coasters', {
  token: ADMIN.token, method: 'POST', prefer: 'return=representation',
  body: { name: `Gate Merge Loser ${stamp}`, park_id: mergePark, track_type: 'steel' },
});
const survivorId = survivorMk.data?.[0]?.id;
const loserId = loserMk.data?.[0]?.id;
if (!survivorId || !loserId) {
  console.error('could not create the merge fixture coasters', survivorMk.data, loserMk.data);
  process.exit(2);
}
// the survivor is cleaned up here; the loser is not, because merge_coasters deletes
// it itself as part of a correct merge, and this cleanup entry must run after the
// ride below is deleted (FK: coaster_id is on delete restrict), so it is pushed
// first and undone last (cleanup runs in reverse).
cleanup.push(() => rest(`/coasters?id=eq.${survivorId}`, { token: ADMIN.token, method: 'DELETE' }));

// give the loser one of A's rides, so the merge moves something real and measurable
const dupRide = await rest('/rides', {
  token: A.token, method: 'POST', prefer: 'return=representation',
  body: { user_id: A.id, coaster_id: loserId, ridden_on: '2026-02-02' },
});
const dupRideId = dupRide.data?.[0]?.id;
if (!dupRideId) { console.error("could not create A's fixture ride on the merge loser", dupRide); process.exit(2); }
cleanup.push(() => rest(`/rides?id=eq.${dupRideId}`, { token: A.token, method: 'DELETE' }));

const merged = await rpc('merge_coasters', { survivor: survivorId, loser: loserId }, { token: ADMIN.token });
(merged.status === 200 && merged.data === 1)
  ? ok(`admin merged the duplicate: ${merged.data} ride moved (positive control)`)
  : fail('admin could not merge a duplicate it is allowed to own', merged);

const loserGone = await rest(`/coasters?id=eq.${loserId}&select=id`, { token: A.token });
(Array.isArray(loserGone.data) && loserGone.data.length === 0)
  ? ok('the losing coaster no longer exists after the merge')
  : fail('the losing coaster survived the merge', loserGone.data);

const rideMoved = await rest(`/rides?id=eq.${dupRideId}&select=coaster_id`, { token: A.token });
rideMoved.data?.[0]?.coaster_id === survivorId
  ? ok("the ride that was on the loser now points at the survivor")
  : fail('the ride did not move to the survivor', rideMoved.data);

// ---------------------------------------------------------------------------
console.log('\nCleaning up what this run created');
// ---------------------------------------------------------------------------
for (const undo of cleanup.reverse()) { try { await undo(); } catch { /* best effort */ } }
console.log(`  the account ${B_EMAIL} remains: deleting a user needs the secret key,`);
console.log('  and no runtime code here is allowed to hold one. Its email is unique per run.');

console.log(`\n${checks - failures}/${checks} checks passed`);
if (failures) { console.error(`${failures} FAILED`); process.exit(1); }
console.log('every defence held, and every positive control passed');
