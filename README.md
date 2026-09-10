# Credit Count

A credit tracker for the rollercoaster enthusiast community. Log the coasters you have
ridden, watch your credits and stats grow, and appear on the public leaderboard only if
you choose to.

Built for the Koin Limited AI Product Engineer task, against the accompanying Statement
of Work. In this community a **credit** is a unique rollercoaster you have ridden at
least once: riding it again adds to your ride count, never to your credit count.

**Live:** https://credit-count-psi.vercel.app

## The one decision that shapes everything

The SOW says four times that privacy must hold **against direct API calls**, not only in
the interface. The browser carries a publishable key by design, so anyone can query
PostgREST directly.

So the interface is a convenience and the database is the control. Every access rule is
a grant or a policy in Postgres, and the delivery includes a script that performs the
attack the acceptance criteria describe and fails the build if any defence gives way.

```bash
node scripts/verify-security.mjs     # 37 checks, exits non-zero on any failure
```

## Documents

| | |
|---|---|
| [docs/TDD.md](docs/TDD.md) | the technical design document, written before the code |
| [docs/WORKING-LOG.md](docs/WORKING-LOG.md) | how the work was directed and reviewed, mistakes included |
| [AGENTS.md](AGENTS.md) | which agent owns which files, and why that prevents collisions |
| [CLAUDE.md](CLAUDE.md) | the rules no agent may break |
| [docs/reviews/](docs/reviews/) | the adversarial reviews, and what they found |

## Running it

```bash
npm install
cp .env.example .env.local        # fill in from the Supabase dashboard
npm run dev
```

Only two variables reach the browser, and both begin with `NEXT_PUBLIC_`. Everything
else stays in `.env.local` and never reaches Vercel or this repository.

```bash
git config core.hooksPath .githooks   # refuses a push carrying key material
```

## Database

Migrations are files, never dashboard edits, so the schema lives in the repository.

```bash
supabase db push                                   # schema, policies, functions, seed
psql "$DATABASE_URL" -f supabase/audit/checks.sql  # what no client can see
node scripts/seed-demo.mjs                         # demo accounts, so the board is not empty
```

| Layer | Where |
|---|---|
| Tables, constraints, indexes | `supabase/migrations/*_schema.sql` |
| RLS, grants, policies | `supabase/migrations/*_security.sql` |
| The three elevated functions | `supabase/migrations/*_functions.sql` |
| The five statistic views | `supabase/migrations/*_views.sql` |
| 46 real coasters | `supabase/migrations/*_seed.sql` |

## Stack

Next.js 16 on Vercel, Supabase for auth, Postgres and every access rule, Tailwind and
shadcn/ui, free tier throughout.
