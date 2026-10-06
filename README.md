# Deer Camp Cribbage

A mobile-first PWA for playing cribbage from separate deer stands. See
`REQUIREMENTS.md` (the design brief) for the full product spec.

This repository is being built in the phases from Section 9 of the
requirements, **in order**. We are in **Phase 1: engine and grader**.

## Current status

| Piece | Status |
|---|---|
| Monorepo scaffold (`packages/engine`) | ✅ done |
| Rules engine — deck, deal, the play (pegging), the show, winning (Section 3) | ✅ done |
| Grader core — discard grading, pegging grading, scores & stand rank (4A.1–4A.4) | ✅ done |
| Grader — luck vs. skill (4A.7) + hindsight (4A.8) + baselines | ✅ done |
| Camp bots — Easy level, reuse the grader's evaluators (Section 4) | ✅ done |
| Section 8 **engine + grader** tests | ✅ passing (84 fast + 2 slow) |
| CLI: `npm run score` | ✅ done |
| CLI: `npm run deal` (deals, cuts, ranks every discard with points given away) | ✅ done |
| **Phase 1 complete** pending Kyle's by-hand check of the numbers | ⬜ sign-off |
| Phase 2 step 0 — engine runs in a Supabase Edge Function | ✅ done |
| Phase 2 step 1 — Postgres schema + RLS wall + lobby RPCs (security tests pass) | ✅ done |
| Phase 2 step 2 — Next.js static-export app: anon auth, lobby UI, realtime, reconnect | ✅ done (builds; live run needs your Supabase) |
| Phase 2 steps 3+ — action pipeline / dealing, table UI, §1A behaviors, grading | ⬜ next |

The engine is a pure TypeScript package with **no UI and no network code**
(REQUIREMENTS 0 and 7A), so both the web app and the Supabase Edge Functions
can import it later.

## Layout

```
packages/
  engine/              # @deercamp/engine — pure rules engine (+ grader, later)
    src/
      cards.ts         # ranks, suits, deck, values, run order, parsing
      rng.ts           # crypto-secure shuffle + seedable PRNG for the grader
      deal.ts          # deal tables (2/3/4 players), starter cut, his heels
      score-hand.ts    # the show: fifteens, pairs, runs, flush, nobs
      score-pegging.ts # per-card pegging scores (15/31/pairs/runs)
      play.ts          # the play flow: go, last card, resets, skips
      show.ts          # count order + counting out (stop at target)
      grader/          # the "Stand report" (Section 4A)
        config.ts          # tie epsilon, crib-sim iterations, stand-rank bands
        combinatorics.ts   # combinations + the unseen-card pool
        rank.ts            # ranking with ties + plain-words phrasing
        expected-hand.ts   # exact expected hand value over all starters
        crib-estimate.ts   # seeded crib-value simulation
        discard.ts         # discard grading (value, points lost, rank)
        pegging.ts         # pegging grading (one-move look-ahead)
        scores.ts          # per-hand/per-game totals, stand rank, awards
        pegging-policy.ts  # deterministic standard policy + pegging replay
        luck.ts            # deal/cut/crib/pegging luck, headline, excuse line
        hindsight.ts       # coulda-shoulda: per-starter what-ifs + verdict
        baseline-cases.ts  # the six luck "cases" (player count x side)
        baselines.ts       # GENERATED luck baselines (npm run gen:baselines)
      bots/            # camp bots (Section 4) — Easy level, built on the grader
        discard.ts         # highest-value discard
        pegging.ts         # evaluator-best pegging card + play chooser
        config.ts          # bot move-delay range (applied by the app layer)
      cli/             # npm run score / npm run deal
    scripts/
      generate-baselines.ts  # simulates deals to produce baselines.ts
    test/              # Vitest unit tests; *.slow.test.ts = statistical checks
  db/                  # @deercamp/db — schema + RLS tests vs in-process Postgres
    test/              #   PGlite harness + the security-wall tests
apps/
  web/                 # @deercamp/web — Next.js static-export front end
    app/               #   Home + Lobby screens (routing by ?c=camp code)
    src/net/           #   supabase client, anon auth, RPC wrappers, realtime
    src/themes/        #   deer-camp vocabulary + palette (CSS vars)
    src/device/        #   haptics, notifications, wakelock, share, storage
supabase/
  migrations/          # SQL: tables, RLS policies, lobby RPCs (source of truth)
  functions/           # Edge Functions (Deno); score-hand spike (step 0)
```

## Running it (beginner-friendly)

You need [Node.js](https://nodejs.org) 20 or newer. Then, from the repo root:

```bash
npm install          # one time, installs dev tools
npm test             # run the unit tests (engine + the DB security tests)
npm run typecheck    # confirm the types are sound
npm test -w @deercamp/db   # just the Postgres RLS / security-wall tests

# From packages/engine: the slow statistical checks and baseline regen:
npm run test:slow        # zero-mean luck baseline checks (~90s)
npm run gen:baselines    # regenerate luck baselines (bump args for the field test)

# Score a hand — first four cards are the hand, the fifth is the starter:
npm run score -- 5H 5S 5C JD 5D     # -> 29 (the perfect hand)
npm run score -- 4D 5S 6C JH 5H     # -> 17 (the mockup hand)
npm run score -- --crib 2H 4H 6H 8H KS   # crib flush rule (0, needs all five)

# Deal a random hand (2, 3, or 4 players):
npm run deal -- 2
```

## A correction to the requirements

Section 8 originally listed `7-8-8-9 + starter 9 = 24`. That card list was a
typo: `7-8-8-9 + 9` actually scores **20**. The intended 24-point
"double-double run with fifteens" hand is `7-7-8-8 + 9`, and `REQUIREMENTS.md`
has been corrected to match. The test suite encodes the corrected hand
(`7-7-8-8 + 9 = 24`) and also pins the old typo hand at its true value
(`7-8-8-9 + 9 = 20`) so nobody later "fixes" the engine to a wrong number.

## Two v1 grader simplifications (by design, flagged)

- **Standard pegging policy** (used for pegging luck, 4A.7.1). The spec names
  "the pegging evaluator's choice (4A.3)". The full one-move look-ahead needs
  each seat's hidden-info view, which makes the 100k-deal baselines impractical
  to generate. v1 uses a deterministic *immediate-points* maximiser with a
  fixed tie-break. The baseline and the zero-mean luck property hold for any
  deterministic policy, so this can be upgraded later without changing the luck
  math. (Consistent with 4A.3.4: rough pegging is acceptable for v1.)
- **Shipped baselines** in `baselines.ts` were generated at a reduced sample
  size so the one-time job finishes quickly. Fewer samples/iterations add
  variance, not bias, and the `test:slow` checks confirm luck stays zero-mean.
  Regenerate at the spec's 100k scale before the field test:
  `npm run gen:baselines -- 100000 50000`.

## What's next

Phase 1's engine, grader, and bots are built. The remaining Phase 1 gate is
the human one (Section 9 acceptance): **Kyle checks a set of hands by hand and
agrees with the scores and rankings.** Use `npm run score` and `npm run deal`
to spot-check. Then:

- Phase 2 (Supabase, the table UI, the theme system, holds, weak-signal
  handling) and Phase 3 (PWA, push, etc.).

Camp bots are graded by the same grader as humans (4A.4), so no extra work is
needed to compare a human against a bot — a bot's choices rank like anyone's.
