# Working log: how this was built with AI

The brief asks how the work was approached with AI: how it was directed, structured and
reviewed. This is that record, written while it happened rather than remembered afterwards.

It includes the mistakes. A log that only contains good decisions is a marketing document,
and the mistakes are where the review process actually shows up.

Two notes before the detail:

- **Working language was Portuguese; the repository, the TDD and the product are English.**
  I direct the model in Portuguese and ship in English.
- **This is a point-in-time log.** Some figures below are from the phase being described
  (the gate grew from 37 checks to 52 as the attack surface did; the catalogue reached 52
  coasters, 12 parks, 14 manufacturers and 3 countries only after a third country was added).
  The authoritative counts are in `docs/TDD.md`. What matters here is the method, not a number.

---

## The shape of the work

```
read the brief  →  analyse what the test measures  →  visual prototype  →  TDD
   →  attack the TDD (3 passes)  →  phase 0 (database, policies, gate, shared floor)
   →  waves of agents building screens  →  adversarial reviews  →  polish
   →  delivery-readiness review  →  ship
                 (no application code until the TDD survived being attacked)
```

Nothing was built until the SOW had been read line by line and the TDD had survived being
attacked. That order is not ceremony: the SOW says four times that privacy must hold against
direct API calls, and an access model is far cheaper to get right on paper than in a schema
other code already depends on.

The rule I set at the start, which drove everything: **a decision taken in the middle of a
build is where rework is born.** So phase 0 removed every decision from the path before any
agent started (column types, library versions, the exact environment-variable names), and the
agents became execution, not invention.

---

## 1. Reading the brief before answering it

The first pass produced a written analysis of what the task actually measures, separate from
what it appears to ask for. The conclusion: **this is an authorisation exercise wearing a
coaster app.** Four separate requirements (FR6, FR8, AC2, AC4) say the rule must hold at the
database, not the interface. Everything else follows from that.

Decisions I made without asking, and recorded with reasons, rather than sending a list of
clarifying questions: country lives on `parks` and never on `coasters`; a credit is a query
and never a stored column; removing a coaster splits into delete, merge and retire.

The brief invites questions. I chose not to send any, because the SOW is unusually complete
and AC6 already provides the mechanism: decide, ship, and flag the deviation with reasoning.

## 2. Design before code

I asked for a clickable prototype with no backend at all: nine screens, a device switch for
desktop and 390px, and the log-a-ride flow actually working on fake data, because that flow
is what gets demonstrated live.

**Why before the code:** an agent building a screen with no target invents one, and six
agents inventing separately produce six moods. The prototype turns "make it nice" into a
specification the screen agents build against.

## 3. Writing the TDD, then attacking it

The TDD went through three review passes before a line of application code existed.

- **Pass 1, a simulated approver.** The document read as if it were the reviewer reading it.
  Verdict: it was a security design document calling itself a technical design document, the
  product section under 8% of the text. Rewritten, product section now roughly a third.
- **Pass 2, a requirements sweep.** Every sentence of the SOW and the brief broken into 78
  atomic statements, each marked met, partial, absent or declared-deviation, with the TDD line
  that satisfies it. Rule: the approver only reads the TDD, so a number that lives in another
  file counts as absent.
- **Pass 3, two independent adversaries in parallel.** One re-did the sweep from scratch with
  no knowledge of my findings; one red-teamed the authorisation design as a Postgres engineer
  trying to break it. They confirmed the three highest findings independently, and each found
  real things the other missed.

## 4. What the reviews found

The value of a review is measured in what it catches. The most useful findings:

- **A screen promised something the security design could not deliver.** The route table said
  the leaderboard would highlight your own row. The function returns exactly `rank`,
  `display_name` and `credits`, and the SOW permits duplicate display names, so matching by
  name would light the wrong row. It shipped as a best-effort match on name plus credits, with
  the limitation stated; the real fix (a separate parameterless function keyed on `auth.uid()`)
  is noted as v2.
- **The gate never read a view.** Five statistic views deliberately carry no `where user_id`,
  because the policy on `rides` already scopes them. Correct, and incomplete: if a view lost
  `security_invoker` it would serve the global aggregate silently. The gate now reads all five
  as a second user and compares against what that user actually owns.
- **The gate never attacked the claim it most needed to.** The TDD states a direct `PATCH` of
  `role` fails at the grant, before RLS. No step tested it, until one did.
- **The catalogue is three tables, and the rules named one.** Renaming a manufacturer moves
  every user's breakdown. Same privilege, so the same rule, and the gate now tries all three.
- **A published count is a channel.** Merging two duplicates lowers the credit of anyone who
  rode both, which reveals that they rode both. Inherent to FR7 rather than a defect: a board
  cannot both exist and reveal nothing. Now stated in the TDD as an accepted trade.

## 5. How the build was orchestrated

The build ran as waves of agents in parallel, held together by one rule that made collision
impossible:

> **An agent only writes the files it owns. Everything else is read-only.**

In the Next.js App Router a route is a folder, so each agent was given its own route folders
and the collision surface went to zero. The shared floor (Supabase clients, the proxy, the
layout, the header, design tokens, the UI kit, generated types) was finished in phase 0 and
then frozen: no later agent created a shared file, installed a package, or edited a migration.

Three prohibitions removed the classic hazards of parallel work:

- no agent runs `npm install` (two at once corrupt the lockfile)
- no agent adds a UI component (all were installed up front)
- no agent runs a git command (I commit at the close of each wave)

The full plan, with each agent's brief, lives in `AGENTS.md`, which is in the repository on
purpose: it is part of showing how the AI was directed.

| Wave | Agents | What they built |
|---|---|---|
| Phase 0 | me, sequential | schema, policies, 3 elevated functions, 5 views, the security gate, the shared floor |
| Wave 1 | 3 agents | authentication, public leaderboard, demo data |
| Wave 2 | 3 agents | dashboard, ride history and settings, admin catalogue |
| Wave 3 | 1 agent | polish and mobile (alone, because it crosses every file) |
| Extra | 3 agents | third country, a second gate, flow QA |
| Prep | 2 agents | call preparation, commented SQL to study from |
| Delivery review | 4 agents | security, infra, repo hygiene, requirements conformance (see section 10) |

At the end of every wave I reviewed before opening the next. The waves exist so that work
runs in parallel, which is faster and cheaper in tokens, without agents ever depending on a
file another one is still writing.

## 6. Which models, and why

Model choice was deliberate and split by the kind of thinking each task needs.

- **The strongest model (Claude Opus) for judgement:** phase 0, every adversarial review, and
  the security and conformance passes of the delivery review. These are where an error
  compounds: a wrong policy or a missed requirement propagates into everything built on top.
- **A cheaper model (Claude Sonnet) for transcription against a specification:** the screen
  agents, and the mechanical passes of the delivery review (infra config, repo hygiene, the
  cleanup edits).

The reasoning: by the time the screen agents start, the expensive thinking has already
happened and been written down, as schema, policies, an ownership map and a prototype. What
remains is transcription against a specification, with a gate that fails the build mechanically
rather than depending on the model noticing. A cheaper model is safe exactly where the guard
rails do not rely on its judgement.

## 7. The central move: the gate passed before any screen existed

`verify-security.mjs` ran and passed with zero interface built (37 checks at that point, 52 by
the end). That ordering is the point: if the defences hold with no interface, the defences are
in the database, which is what the SOW is actually asking for. Building the interface first
would leave every later test carrying the doubt that it was testing the screen.

One honest note about that first run: step 7 checks that an opted-out name is absent from the
rendered page, and it passed against a page that was still the framework default and held no
names at all. It only became a real check once the leaderboard screen existed. A test that
passes for the wrong reason is worse than one that fails, so it is called out here.

A second gate appeared later, `verify-ui.mjs` (70 checks in a real headless browser at 390px:
computed fonts, security headers, no sideways scroll). It exists because a real bug (the fonts
never loaded and every page fell back to serif) survived build, types, the security gate and
two adversarial reviews. A person looking at the screen caught it. Neither gate judges whether
something looks good; that stayed human work.

## 8. Mistakes I made, and how they were caught

Worth listing, because they are the proof the review process does something.

- **I corrected a missing requirement with a wrong number.** The sweep found the SOW asks for
  roughly 30 to 50 coasters and the TDD gave no figure. I added a count taken from the seed
  document, which turned out to be wrong. The fix was not the number: the seed is now generated
  by a script that counts the list it emits, and the SQL ends with a block that raises if the
  database does not hold exactly those counts. No hand-asserted number survives anywhere.
- **The database password nearly reached a public repository.** `supabase link` writes
  `supabase/.temp/pooler-url`, the connection string with the password inside, and `git add -A`
  staged it. The pre-push scan caught it before it was ever committed. (Verified at delivery:
  no secret appears in any commit, from the first.)
- **A masked key cost twenty minutes.** The management API returns secret keys partially masked
  unless you ask it to reveal them, which produced "Invalid API key" from an endpoint that was
  otherwise correct.
- **A component library changed an API under me.** The current shadcn default builds on Base
  UI (`render`) rather than Radix (`asChild`), and the build failed on the header. I
  re-initialised on the Radix base, because every agent about to write a screen has `asChild`
  in its training data and would reach for it by reflex.

## 9. Corrections that came from me, not the model

- **A sentence in the TDD was untrue.** It read "I reviewed every grant, policy and elevated
  function line by line." I had not, and I said so. The replacement splits the code in two: the
  security surface, roughly 166 lines of SQL, is read line by line; everything else is held to
  the gate, "since the gate runs on every push and attention does not." A smaller claim, and a
  verifiable one. That reading is a commitment, and it happens before submission.
- **A route was missing.** FR1 says a visitor may reach the leaderboard and a sign-up page. The
  prose mentioned it; the route table did not list `/login` or `/signup`, and the route table is
  where an approver checks. Two review passes had missed it.
- **Four bugs only a person using the app would find**, none of which trips build, types, the
  gate or a security review, because each is "wrong for the user": the serif fallback, a missing
  progress track on the dashboard, calls-to-action sending a signed-in user to sign up, and a
  misaligned ride-history row. The reviews and gates find what is measurable; a person found
  what is not.

## 10. The delivery-readiness review

Before shipping I ran a four-agent review in parallel, one agent per domain, each producing a
ranked findings report that I consolidated:

- **Security** (Opus): re-ran the gate and SQL audit live, verified the twelve hard rules
  against the production database, and ran fourteen direct-API attacks by hand. All held.
- **Infrastructure** (Sonnet): confirmed exactly two `NEXT_PUBLIC_` environment variables on
  Vercel, the live security headers, all migrations applied, RLS on every table, and the
  catalogue counts against the live API.
- **Repo hygiene** (Sonnet): scanned the full git history for secrets (none), confirmed the
  repository is English throughout, and flagged an orphan file and unused assets.
- **Requirements conformance** (Opus): traced every SOW requirement to the TDD and the code,
  and confirmed the TDD describes what actually shipped (AC6).

Two findings were real and fixed, both append-only:

- **`is_admin()` still carried the default `EXECUTE` grant to `anon`.** Harmless only because
  `anon` has no `SELECT` on `profiles`, so the call dies before returning. That is the same
  "safe only because of a second layer" pattern an earlier hardening migration set out to
  remove, and it had missed this one function. Closed in a new migration, and the SQL audit now
  fails the build if `anon` can execute any function except the leaderboard.
- **Production had drifted from the repository.** An earlier pass that translated the code to
  English had edited the already-applied dated migrations in place, so the live functions still
  ran the pre-translation bodies while the repository showed English. The fix was not to edit
  them again: a new migration re-declares the functions with the English source, because an
  applied migration only moves forward. Now what you read in the repo is what runs.

The lesson that recurred to the very end: a migration that has been applied is append-only.

## 11. Language and privacy discipline

- The repository is English throughout: code, the TDD, migrations, the SQL audit, tests, and
  the error messages that appear in an API response. Verified against every tracked file.
- Internal material (the adversarial review write-ups and their screenshots) is kept local and
  out of the public repository. This log is not internal: the brief asks for it.
- Secrets: the entire git history was checked, and no key or password appears in any commit,
  from the first. The secret files were never tracked.

## 12. Deferred to v2 (recorded, not forgotten)

- Your own position on the leaderboard, via a dedicated parameterless function (today it is
  approximated by name plus credits, server-side).
- A unique display name (the SOW permits duplicates, so two people can look identical on the
  board; identity is the UUID).
- A summary table so the leaderboard aggregate scales past the free tier.
- Continuous integration running both gates on every pull request, so a policy change cannot
  reach `main` without the attack passing first. Today that discipline is mine, and discipline
  does not scale. If asked for the single weakest part today, this is the answer.
