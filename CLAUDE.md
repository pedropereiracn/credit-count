# Credit Count

A credit tracker for rollercoaster enthusiasts. Next.js on Vercel, Supabase for auth,
Postgres and every access rule. Built for the Koin Limited AI Product Engineer task.

**The specification is `docs/TDD.md`.** It was written before any code and it wins every
argument. If the code and the TDD disagree, one of them changes deliberately, never both
in silence (AC6 requires the document to describe what actually shipped).

## What this project is actually graded on

The SOW says four times that privacy must hold **against direct API calls**, not only in
the interface. The browser carries a publishable key by design, so anyone can query
PostgREST directly. That makes the interface a convenience and the database the control.

A generated line that looks reasonable but is subtly wrong here is not a bug. It is
another person's ride history leaving the building.

## Hard rules, no exceptions

1. **No elevated key in application code.** Nothing under `src/` touches the service key
   or the connection string. Server code runs with the caller's session, never more.
2. **No admin branch in any `rides` policy.** SOW §3 says an admin cannot read anyone's
   history. That absence is the requirement, not an oversight.
3. **No SQL function takes a `user_id` argument.** Identity comes from `auth.uid()` in the
   verified JWT, so "give me user X's history" has no signature to call.
4. **Never disable RLS to make a query work.** A query that fails under RLS is asking for a
   policy. It is not asking for `alter table ... disable row level security`.
5. **Exactly three `SECURITY DEFINER` functions exist**: `leaderboard`, `handle_new_user`,
   `merge_coasters`. `supabase/audit/checks.sql` fails the build if a fourth appears.
6. Every `SECURITY DEFINER` function sets `search_path = ''` and schema-qualifies every
   name (`public.rides`, never `rides`).
7. Every view is created `with (security_invoker = true)`.
8. **`credit_count` is never a stored column.** It is always `count(distinct coaster_id)`.
9. **`profiles.role` has no write grant** for `anon` or `authenticated`. The shape of the
   grant is what stops self-promotion, before RLS is even consulted.
10. Every schema change is a file in `supabase/migrations/`. Never an edit in the Supabase
    dashboard: a dashboard edit leaves no trace in the repository.
11. `.env.local` and `.db-credentials` are never committed. No password ever appears
    literally inside `scripts/`.
12. **The catalogue is three tables**: `coasters`, `parks`, `manufacturers`. Every
    catalogue write rule applies to all three. Renaming a manufacturer moves every user's
    breakdown, so it is the same privilege.

## Environment

The Vercel project has **exactly two** environment variables and both begin with
`NEXT_PUBLIC_`:

```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
```

If you believe you need a third, stop and ask. The TDD makes that claim in writing and an
approver can check it in seconds.

`.env.local` additionally holds what never reaches Vercel: the database password (seeding
and the SQL audit, locally) and the test account passwords (the security gate reads them
from the environment).

## Stack decisions already made

| | |
|---|---|
| Next.js | 16, App Router, Server Components and Server Actions |
| Supabase client | `@supabase/ssr`. **Not** `auth-helpers-nextjs`, which is deprecated |
| Styling | Tailwind v4, tokens in `src/app/globals.css` |
| Components | shadcn/ui, already installed. Do not add more without saying so |
| Package manager | npm |
| Email confirmation | **off**, declared in the TDD: no mail provider, accounts delivered out of band |

## Definition of done, for any task

- `npm run build` passes
- `node scripts/verify-security.mjs` exits 0
- `supabase/audit/checks.sql` runs without raising
- nothing scrolls sideways at 390px
- `docs/TDD.md` still describes what exists

## When you get stuck

If a query fails and the cause is not clear within two attempts, stop and describe what you
tried. Do not work around it by loosening a policy, widening a grant, or moving logic into
the Next.js server. Those three are exactly the moves that make every test pass and the
product unsafe.
