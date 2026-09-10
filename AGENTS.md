# Agent plan

How this app gets built by several agents at once without them standing on each other.

Read `CLAUDE.md` first: it holds the rules that no agent may break. This file holds who
does what, in which order, and which files each one is allowed to write.

---

## 1. The one rule that prevents every conflict

> **An agent may only write files it owns. Everything else is read-only to it.**

Two agents editing one file is the only way this build can corrupt itself, and it is
entirely avoidable, because the App Router makes routes into folders. Give each agent its
own folders and the collision surface goes to zero.

The shared surface (the client helpers, the layout, the header, the UI kit, the generated
types, the migrations) is **finished in Phase 0 and frozen**. No agent after Phase 0
creates a shared file, installs a package, or edits a migration.

Three corollaries, and they are the ones that actually bite:

- **No agent runs `npm install`.** Every dependency any screen needs is installed in
  Phase 0. Two agents installing at once corrupt `package-lock.json`, and that failure
  looks like a broken build somewhere unrelated an hour later.
- **No agent adds a shadcn component.** They are all installed in Phase 0. If one is
  genuinely missing, stop and say so; do not run the CLI.
- **No agent edits `src/app/layout.tsx`, `globals.css`, `middleware.ts`, `src/lib/**`, or
  `src/components/ui/**`.** If a task seems to require it, the task is wrong or Phase 0
  was incomplete. Say so instead of editing.

If two agents genuinely must touch one file, do not run them together. Run them in
sequence, or give one a git worktree and merge deliberately.

---

## 2. Ownership map

| Path | Owner | After that |
|---|---|---|
| `supabase/migrations/**` | Phase 0 | frozen, except A3 which adds one file of its own |
| `supabase/audit/checks.sql` | Phase 0 | frozen |
| `scripts/verify-security.mjs` | Phase 0 | extended only in Phase 4 |
| `src/lib/supabase/**`, `src/lib/types.ts`, `src/lib/format.ts` | Phase 0 | read-only to everyone |
| `src/proxy.ts` | Phase 0 | read-only |
| `src/app/layout.tsx`, `src/app/globals.css` | Phase 0 | read-only |
| `src/components/ui/**` (shadcn) | Phase 0 | read-only |
| `src/components/app-header.tsx`, `empty-state.tsx`, `skeletons.tsx` | Phase 0 | read-only |
| `src/app/(auth)/**` | **A1** | |
| `src/app/page.tsx`, `src/components/leaderboard/**` | **A2** | |
| `supabase/migrations/*_demo_data.sql`, `scripts/seed-demo.mjs` | **A3** | |
| `src/app/dashboard/**`, `src/components/dashboard/**` | **A4** | |
| `src/app/rides/**`, `src/app/settings/**`, `src/components/rides/**`, `src/components/settings/**` | **A5** | |
| `src/app/admin/**`, `src/components/admin/**` | **A6** | |
| anything, one file at a time, alone | **A7** | |

`package.json`, `package-lock.json`, `next.config.ts`, `tsconfig.json`, `docs/TDD.md`:
**nobody but the human owner.**

---

## 3. Phases

Waves run in order. Agents inside a wave run at the same time.

```
Phase 0   infrastructure and the shared floor          (done, sequential, human-led)
Wave 1    A1 auth        A2 leaderboard    A3 demo data
Wave 2    A4 dashboard   A5 rides+settings A6 admin
Wave 3    A7 mobile and polish                          (alone: it crosses files)
Phase 4   gate, red team, TDD reconciliation            (sequential, human-led)
```

**Why Wave 2 waits.** Every screen in Wave 2 is behind a login. Until A1 ships sign-in, an
agent building the dashboard cannot see its own work, and an agent that cannot verify its
work reports success it did not earn.

**Why A3 sits in Wave 1.** It touches only SQL and a seeding script, so it collides with
nothing, and Wave 2 needs the data to exist or every screen it builds looks empty.

**Why A7 runs alone.** A responsive pass by definition edits files owned by others. It is
the one job that cannot be parallel, so it is not.

---

## 4. The agents

Each agent gets: the goal, the files it owns, what it may read, the SOW requirements it
answers, its tasks, and how it proves it is done. An agent that cannot prove it is done is
not done.

### A1. Authentication and session

**Model:** Sonnet. **Depends on:** Phase 0.

**Owns:** `src/app/(auth)/login/page.tsx`, `src/app/(auth)/signup/page.tsx`,
`src/app/(auth)/actions.ts`, `src/app/auth/callback/route.ts`,
`src/components/auth/**`

**Reads:** `src/lib/supabase/**`, `src/proxy.ts`, `src/components/ui/**`,
`prototipo/index.html` (`#/login` and `#/signup`)

**Covers:** SOW §4.1.1, FR1 (the sign-up page a visitor may reach)

**Tasks**

1. Sign-up form: email, password, display name. Display name is trimmed and must be 2 to
   40 characters, matching the database constraint, so the constraint is never what the
   user meets first.
2. Sign-in form.
3. Server Actions for both, using `src/lib/supabase/server.ts`. Never a client-side
   `signUp` call that bypasses the server.
4. Real error states: wrong password, email already registered, display name too short.
   No screen may fail silently.
5. Sign-out, wired to the header's existing button.
6. A "forgot password" link using Supabase's built-in flow. SOW §4.2 puts flows *beyond*
   the default out of scope, which means the default itself is in.
7. After sign-in, redirect to `/dashboard`. After sign-up, the same.

**Done when:** a brand-new account can be created and signed into, `handle_new_user` has
written its `profiles` row with `role = 'enthusiast'` and `show_on_leaderboard = false`,
and signing out returns the visitor to `/`.

**Never:** pass `role` in sign-up metadata "to be explicit". The trigger writes it as a
literal, and the gate attacks exactly that field.

### A2. Public leaderboard

**Model:** Sonnet. **Depends on:** Phase 0.

**Owns:** `src/app/page.tsx`, `src/components/leaderboard/**`

**Reads:** `src/lib/supabase/**`, `src/components/ui/**`, `prototipo/index.html` (`#/`)

**Covers:** FR1, FR7, AC3, SOW §4.1.7

**Tasks**

1. Call the `leaderboard` RPC from a Server Component. Never read `profiles` or `rides`
   from this page: the function is the only sanctioned crossing.
2. Render rank, display name, credits. **Nothing else.** Ties share a rank.
3. Paginate. The function caps the page size; the page must not try to raise it.
4. Empty state for when nobody has opted in.
5. Force dynamic rendering (`export const dynamic = 'force-dynamic'`). Opting out has to
   land on the next request, and page caching is what actually breaks that.
6. Header shows Log in and Sign up when signed out.

**Done when:** the page renders signed out, and the network tab shows exactly one call,
to the RPC, carrying three fields per row.

**Never:** add "your row is highlighted". The return type cannot identify anyone, display
names may repeat, and the gate asserts the row shape is exactly those three keys. This was
removed from the TDD on purpose.

### A3. Demo data

**Model:** Sonnet. **Depends on:** Phase 0.

**Owns:** `supabase/migrations/20260910000001_demo_data.sql`, `scripts/seed-demo.mjs`

**Reads:** the schema migrations, `supabase/audit/gerar_seed.py`

**Covers:** SOW §6 ("meaningful **when demonstrated**")

**Why this exists:** the catalogue is seeded, the app is not. Without this, the leaderboard
on the call shows only accounts the gate created and the statistics come from three rides.
An empty demo makes correct work look unfinished.

**Tasks**

1. Create 8 to 12 demo accounts through the auth API (a script, since `auth.users` is not
   a table to insert into), with plausible enthusiast display names.
2. Give them a credit spread that makes a leaderboard interesting: a leader well ahead, a
   tight middle, a tail. Not a straight line.
3. Give the **delivered enthusiast account (A)** a real history: roughly 35 to 45 credits
   across both countries, several parks and manufacturers, and at least one coaster ridden
   more than once, so every breakdown on the dashboard has shape.
4. Opt roughly two thirds of the demo accounts into the leaderboard, and leave the rest
   out, so "opt-in only" is visible rather than asserted.
5. Spread `ridden_on` over plausible park-visit days, not one per day. Do not date a ride
   before the coaster existed.
6. Idempotent: running twice must not double anything.

**Done when:** the signed-out leaderboard has at least 8 rows, account A's dashboard shows
every breakdown with more than one bar, and the gate's step 6 delta assertions still pass.

**Never:** hard-code passwords in the migration. The script reads them from the
environment, like everything else.

### A4. Dashboard and logging a ride

**Model:** Sonnet, and this is the one to watch. **Depends on:** A1, A3.

**Owns:** `src/app/dashboard/**`, `src/components/dashboard/**`

**Reads:** `src/lib/**`, `src/components/ui/**`, `prototipo/index.html` (`#/dashboard`,
`#/dashboard-vazio`)

**Covers:** FR2, FR3, FR4, FR5, SOW §4.1.4, §4.1.5

**Tasks**

1. Credits as the headline number, total rides beside it (FR4).
2. The five views, read as the caller: `my_totals`, `my_credits_by_country`,
   `my_credits_by_manufacturer`, `my_credits_by_type`, `my_most_ridden`.
   **None of them takes a `user_id` filter.** The policy on `rides` already scoped them.
   If you write `.eq('user_id', ...)` anywhere on this screen, you have misunderstood the
   design and you should stop.
3. Breakdowns as counted lists, largest first.
4. Search box: server-side, showing each coaster's park so two of the same name are told
   apart. An empty query lists the catalogue, so search is also the browse surface.
5. Log a ride in **three interactions**: type, click a result, confirm. Count them out
   loud. Date defaults to today, note optional.
6. Every mutation is a Server Action that calls `revalidatePath`, so the statistics move
   with no manual refresh (FR5).
7. Empty state that explains what a credit is and invites the first ride.
8. Recent rides list, linking to `/rides`.

**Done when:** logging a ride takes three interactions, the headline moves without a
reload, and total credits equals the sum of each breakdown.

**Never:** compute credits in TypeScript. The number comes from the view, always.

### A5. Ride history and settings

**Model:** Sonnet. **Depends on:** A1, A3.

**Owns:** `src/app/rides/**`, `src/app/settings/**`, `src/components/rides/**`,
`src/components/settings/**`

**Covers:** FR9, FR7 (the opt-in control), SOW §4.1.6

**Tasks**

1. Ride history, newest first, paginated: coaster, park, date, note.
2. Edit a ride: date and note only. Moving a ride to a different coaster is a delete plus
   a new entry, so no credit silently moves under an edit nobody asked for.
3. Delete, with confirmation, and a warning when the credit goes with it.
4. Settings: edit display name, same validation as sign-up.
5. The leaderboard toggle, with the current state **written out as a sentence**, not just a
   switch position. "You are hidden from the public leaderboard" beats a grey pill.
6. Empty states for both screens.

**Done when:** a ride can be edited and deleted, and toggling the setting changes what the
signed-out leaderboard shows on the next load.

### A6. Admin catalogue

**Model:** Sonnet. **Depends on:** A1.

**Owns:** `src/app/admin/**`, `src/components/admin/**`

**Covers:** FR8, AC4, SOW §4.1.8

**Tasks**

1. Catalogue list, searchable, retired coasters hidden by default with a filter to show
   them.
2. Add and edit a coaster. Park and manufacturer are combo boxes with an add-new option
   that writes the lookup row in the same submit, so an unlisted park costs one form and
   not three.
3. Retire and un-retire (`retired_at`). A retired coaster stays searchable, because a
   demolished coaster is still a credit somebody earned.
4. Delete, allowed only when the coaster has no rides. The foreign key refuses otherwise,
   and the screen must explain that rather than showing a raw error.
5. Merge duplicates: pick survivor and loser, show how many rides will move, confirm that
   it cannot be undone, call `merge_coasters`.
6. The route is invisible to non-admins in the header, **and** the the proxy blocks it,
   **and** the database refuses the writes. Three layers, and only the third is the one
   that counts.

**Done when:** an admin can do all five operations and an enthusiast reaching `/admin` by
typing the URL is refused.

### A7. Mobile and polish

**Model:** Sonnet. **Runs alone.** **Depends on:** everything above merged.

**Owns:** any file, one at a time.

**Covers:** SOW §4.2 ("work well on a phone browser"), §1 ("should not feel like a
prototype")

**Tasks**

1. Every screen at 390px: nothing scrolls sideways, one column, tap targets at least 44px.
2. Logging a ride becomes a bottom sheet on mobile, a dialog on desktop.
3. Every list has a heading, an empty state and a loading skeleton.
4. Focus states and keyboard navigation on every interactive element.
5. `<title>` and meta description per route.
6. Favicon and the wordmark in the header.

**Done when:** all nine routes verified at 390px and at 1440px, with screenshots.

---

## 5. Commit protocol

- **One commit per agent, at the end of its task**, message in English, conventional
  prefix, naming the agent: `feat(dashboard): stats, search and three-tap ride logging`.
- **Nobody commits mid-wave.** Commits happen when a wave closes, so a broken intermediate
  state never reaches the branch.
- **Only one agent may run `npm run build` at a time.** Several agents in one tree share
  `.next/`, and concurrent builds corrupt each other in ways that look like unrelated
  failures. While a wave is running, type-check with `npx tsc --noEmit` instead, and run
  a dev server on your own port (`npm run dev -- -p 30NN`) if you need a browser.
  The full build runs once, when the wave closes.
- **`npm run build` before every commit.** A red build committed by one agent blocks every
  other agent, and they will waste a turn each discovering why.
- The security gate runs at the end of every wave, not only at the end. A policy problem
  found in Wave 1 costs minutes; the same problem found on Sunday night costs the deadline.

## 6. What to do when an agent gets stuck

Stop and describe the problem. Do not:

- loosen a policy or widen a grant to make a query return rows
- move an access decision from Postgres into TypeScript
- add an environment variable
- install a package
- edit a file owned by someone else

Each of those turns a red test green while making the product worse, and this task is
graded on exactly that distinction.
