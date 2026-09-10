# Credit Count: Technical Design Document

**Author** Pedro Augusto Pereira · Koin Limited, AI Product Engineer task · September 2026
**Stack** Next.js (App Router) on Vercel · Supabase (Auth, Postgres, RLS) · free tier

---

## 1. Data model

Six tables, seeded with 46 real coasters across 2 countries, 10 parks, 14 manufacturers and 3 track types, plus demo accounts carrying rides, so the board and the breakdowns mean something when demonstrated (SOW §6). `parks` and `manufacturers` are lookups, not free text on `coasters`: SOW §7 names inconsistent entries as a risk to comparability. A unique index on `(park_id, lower(name))` keeps duplicates out while clones across parks stay legal.

| Table | Columns that matter |
|---|---|
| `profiles` | `display_name`, `role`, `show_on_leaderboard` |
| `parks`, `manufacturers` | `name`, plus `country_code` (ISO alpha-2) on `parks` |
| `coasters` | `name`, `park_id`, `manufacturer_id`, `track_type`, `retired_at` |
| `rides` | `user_id`, `coaster_id`, `ridden_on`, `note` |
| `catalogue_audit` | who merged what, and when |

- **Country lives on `parks`,** so no two rows can disagree about it. Every breakdown key is constrained rather than merely `not null`: `track_type` and `country_code` to closed sets, `parks` and `manufacturers` to a unique index on `lower(btrim(name))`, unknown manufacturers coalescing to "Unknown". Normalisation is the database's job, not the form's, so every coaster falls in one bucket of each breakdown.
- **A credit is a query, not a column:** `count(distinct coaster_id)` over that user's rides, so nothing drifts (FR4). Nothing forbids two rides in a day (FR3), and `coaster_id` is `on delete restrict`, so no delete erases history.

## 2. The product

| Route | Shows | Primary action | When empty |
|---|---|---|---|
| `/` | Rank, display name and credits, and nothing else | Sign up | Nobody has opted in |
| `/signup`, `/login` | Email and password; sign-up also takes the display name | Create the account, or sign in | |
| `/forgot-password`, `/reset-password` | Supabase's own recovery flow, nothing built on top (SOW §4.2) | Send the link, then set the password | |
| `/dashboard` | Credits headline, total rides, four breakdowns, recent rides | Log a ride | What a credit is, focused search, coasters to start |
| `/rides` | Every ride, newest first: coaster, park, date, note | Edit or delete one | Same invitation |
| `/settings` | Display name; leaderboard toggle, state in words | Save | |
| `/admin` | Catalogue, searchable, retired hidden. Admins only | Add, edit, retire, merge | Offers to add what was searched |
| `/admin/coasters/[id]` | Name, park, manufacturer, type, retired | Save, retire, merge | |

**Navigation and session.** The header links every route above, admin only when the profile says so; middleware keeps signed-out visitors off private routes. Server components pass the user's JWT to Postgres, which is what makes `auth.uid()` and the views below resolve to one person.

**Dashboard.** Five views, each declared `security_invoker = true`: totals (credits and rides), then credits by country, by manufacturer, by type, and most-ridden coaster. They run with the caller's identity, so **none carries a `where user_id` clause**: the rule is written once, in the policy on `rides`, and every statistic inherits it. Breakdowns are counted lists, largest first; most-ridden ties break on the latest ride. One invariant, checked by the gate: total credits equals the sum of each breakdown. No manual refresh (FR5): every mutation is a Server Action that revalidates the path.

**Logging a ride, three interactions (FR2).** Type in the dashboard search box, click a result, confirm. Search runs on the server and shows each coaster's park, so two sharing a name are told apart; an empty query lists the catalogue, so searching and browsing are one screen (SOW §4.1). The date defaults to today, a future date is refused by a check constraint, the note is optional. A duplicate is legal anyway, and deletable.

**Ride history (FR9).** Paged. Editing changes date and note; moving a ride to another coaster is a delete plus a new entry, so no credit moves under an edit nobody asked for. Deleting confirms, and warns when the credit goes too.

**Leaderboard.** Ordered by credits, then display name, then user id, so paging stays stable when people tie; equal credits share a rank. The caller may ask for a page size and the function caps it, so nobody can ask a free-tier database for the whole table.

**Admin.** The coaster form owns all three catalogue tables: park and manufacturer are combo boxes with an add-new option writing the lookup row in the same submit, so an unlisted park costs one form, not three. Retiring sets `retired_at`, hiding a coaster from browsing but keeping it searchable, since a demolished coaster is still a credit to log. A merge names survivor, loser and the rides that move.

**Pleasant, and the phone.** Every list has a heading, an empty state and a skeleton; controls come from shadcn/ui. On a phone (SOW §4.2) nothing scrolls sideways, the layout is one column, and logging a ride is a sheet.

## 3. Authorisation

**The interface is a convenience, never a control.** The SOW states it four times, twice adding it must hold against direct API calls (FR6, FR8, AC2, AC4), and the browser carries a publishable key by design, so anyone can query PostgREST. Grants decide which role reaches which table and column; policies decide which rows, per command, with `USING` and `WITH CHECK` written out. RLS is on before any policy, so every table starts as deny.

- **Own rides only** (FR6, FR9, AC2): per-command policies on `rides` keyed to `auth.uid()`, no admin branch.
- **Catalogue writes are admin-only** (FR8, AC4): the catalogue is three tables, `coasters`, `parks` and `manufacturers`, each carrying the same policies gated by `is_admin()`, itself `SECURITY INVOKER`. Renaming a manufacturer moves every user's breakdown, so it is the same privilege. Enthusiasts hold `SELECT`; a signed-out visitor nothing (FR1).
- **Nobody promotes themselves:** `role` has no write grant for any client role, so a direct PATCH fails at the grant, before RLS. `UPDATE` on `profiles` covers `display_name` and `show_on_leaderboard`; admin is granted by hand in SQL (SOW §4.1).
- **Sign-up cannot inject a role:** `handle_new_user()` writes `role` as a literal; only `display_name` comes from client metadata, trimmed and checked.

`show_on_leaderboard` defaults to false, so privacy is the database's default, not the form's (SOW §2). `catalogue_audit` carries no client policy at all, so with RLS on it is unreachable from the API by design: written by the elevated function, read only in SQL.

## 4. Privileged functions, and the leaderboard trade

Counting credits means reading `rides`, which only its owner may read. Three functions are `SECURITY DEFINER`, each with `search_path = ''` and every name qualified. Nothing else is elevated, and the audit fails if a fourth appears.

- **`leaderboard(limit, offset)`,** callable by `anon` and `authenticated`, **is the one whose return type is the security surface.** It returns exactly `rank`, `display_name` and `credits`, names no person in its parameters, and is the single controlled crossing of the `rides` and `profiles` boundaries: no column in the signature can carry which coasters anyone rode (FR7). It filters on `show_on_leaderboard` per call on a dynamic route, so opting out lands on the next request (FR7's "immediately"). `ride_count` is absent because FR7 says display name and credit count only; `rank` answers SOW §4.1's board ranked by credits.
- **`handle_new_user()`,** callable by no client, since `EXECUTE` is revoked and PostgREST will not expose a `trigger` function: it writes the profile row no client may insert.
- **`merge_coasters(uuid,uuid)`,** admin re-checked in the body since a definer bypasses RLS: it re-points another user's rides and returns one integer, the rides moved, an aggregate over the catalogue and never a name.

**No function takes a `user_id` argument.** Identity comes from `auth.uid()` in the verified JWT, so "give me user X's history" has no signature to call.

**Rejected: materialising `credit_count` on `profiles`.** Column grants are per role, not per row, and `authenticated` must read its own full row, so that grant would expose the column on every opted-in row. At scale the summary belongs in its own table, read by `anon`, written by no client: a v2 move.

## 5. Secrets (AC5)

Two values reach the browser by design: the project URL, an address rather than a secret, and the publishable key. Everything else stays in one untracked `.env.local` and never reaches Vercel or the repository: the secret key (seeding demo accounts locally), the connection string (the SQL audit), and the delivered account passwords, which AC5 names as credentials and the gate therefore reads from the environment.

The claim an approver can check in seconds: **the Vercel project has exactly two environment variables, and both begin with `NEXT_PUBLIC_`.** No runtime code holds a privilege the browser lacks, so a Server Action bug leaks nothing. A pre-push hook in `.githooks/` blocks key material in tracked files, a literal password inside `scripts/`, and any elevated variable named under `src/`.

## 6. The verification gate

AC2 and AC4 describe an attack, so the delivery includes it. `scripts/verify-security.mjs` speaks plain HTTP to PostgREST, not the SDK, since the criterion says direct API calls, and holds only what a stranger would: the URL, the publishable key, and the two delivered account passwords (enthusiast A, admin), all read from the environment, since AC5 names credentials and `.env.local` is untracked. It attempts:

1. sign up with `"role":"admin"` in the metadata, then `PATCH` `role` directly on the profile that comes back; both must leave an enthusiast, and that account becomes user B, so there is no third password
2. read, update, delete and insert against A's rides, and read all five statistic views, as B and as admin: a view that lost `security_invoker` serves the global aggregate in silence
3. write to all three catalogue tables as B, then as admin, which must succeed
4. read `coasters` and `profiles` signed out, and A's profile as B: all empty (FR1)
5. read the leaderboard signed out; it must carry rows, and their keys must be exactly `rank`, `display_name`, `credits` (AC3), since an assertion about keys is vacuously true on an empty board
6. log three coasters as A, one twice, asserting credits and rides move correctly (AC1)
7. turn A's leaderboard opt-in off, re-fetch the rendered page signed out and require A's name absent from the HTML, turn it back on (FR7's "immediately", asserted against the page, since caching is what actually breaks it)

Every destructive attempt is followed by A re-reading the row, since PostgREST answers 204 to a DELETE matching nothing. Steps 3, 5, 6 and 7 are positive controls: a gate proving only failures would pass with the API off. It exits non-zero and runs before push, carrying the §2 invariant per account. A SQL audit adds what no client sees: RLS everywhere, no elevated function outside the inventory, no view missing `security_invoker`, and it removes the account each run created.

**Directing the AI.** Claude Code wrote the screens, the seed, this script and the first draft of this document. I read the security surface myself, line by line: the grants, the policies and the three elevated functions, because there a plausible generated line is a breach rather than a bug. The rest of the code I hold to the gate instead of to my own attention, since the gate runs on every push and attention does not.

## 7. Decisions, risks and limits (AC6, SOW §7)

**Removing a coaster** is three operations: one with no rides is deleted, a duplicate merged, a demolished one retired and keeping its credits. The foreign key refuses a delete with rides: losing history to an admin's convenience is the worse outcome.

**Admins cannot read ride history, no exception.** SOW §3 says so, and most RLS tutorials add an admin bypass without thinking. When a user disputes a credit nobody at Koin can look, so support walks them through their own history.

**What a published count leaks.** A merge is the only operation that changes another user's total, and correctly, since a duplicate was never two credits; the audit row keeps who ran it. It also infers: a drop of one says that person rode both entries. A public count over private rows is a channel, inherent to FR7 rather than a defect of the design, because the board cannot both exist and reveal nothing. What the design does control is that no request can ask the question directly, and that nothing but a count crosses the boundary.

**Duplicate display names** are permitted (SOW §9): two users can look identical on the leaderboard, so identity is the UUID and a unique handle is the v2 fix.

**Free tier.** The leaderboard aggregation is the only query not scoped to one user and cannot be cached (FR7), so it is the first cost to stop being free; §4 has the scaling path. The nearer risk is a paused free project, so the gate runs again before the call.

**Declared departures.** Server Actions run on Vercel rather than in Supabase (SOW §6): they are transport and hold no privilege the browser lacks, while every authoritative rule, count and ranking lives in Postgres. Email confirmation is off, since this deployment has no mail provider and the two accounts are delivered out of band. `catalogue_audit` is an addition, because a merge cannot be undone.

**Out of scope** (SOW §4.2, §9): live RCDB, native apps, password reset beyond Supabase defaults, commercial features, localisation, historic imports. Where the build deviated from this document, it was updated to match.
