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
| Section 8 **engine** tests | ✅ passing (34 tests) |
| CLI: `npm run score` | ✅ done |
| CLI: `npm run deal` | ⚠️ partial — deals/cuts/scores, but discard **ranking** needs the grader (next increment) |
| Grader + luck/skill + hindsight (Section 4A) | ⬜ next |
| Camp bots (Section 4) | ⬜ next |
| Multiplayer, UI, PWA (Phases 2–3) | ⬜ not started |

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
      cli/             # npm run score / npm run deal
    test/              # Vitest unit tests (Section 8 engine cases)
```

## Running it (beginner-friendly)

You need [Node.js](https://nodejs.org) 20 or newer. Then, from the repo root:

```bash
npm install          # one time, installs dev tools
npm test             # run every unit test
npm run typecheck    # confirm the types are sound

# Score a hand — first four cards are the hand, the fifth is the starter:
npm run score -- 5H 5S 5C JD 5D     # -> 29 (the perfect hand)
npm run score -- 4D 5S 6C JH 5H     # -> 17 (the mockup hand)
npm run score -- --crib 2H 4H 6H 8H KS   # crib flush rule (0, needs all five)

# Deal a random hand (2, 3, or 4 players):
npm run deal -- 2
```

## A correction to the requirements (please read)

Section 8 lists this required test:

> `7-8-8-9 + starter 9` (double-double run with fifteens) = **24**

That card list is a **typo**. `7-8-8-9` with a starter `9` actually scores
**20** (fifteens 7+8 twice = 4, pairs 8-8 and 9-9 = 4, run 7-8-9 doubled =
12). The hand that scores 24 and matches the "double-double run with fifteens"
description is **`7-7-8-8` with starter `9`** (fifteens 7+8 four ways = 8,
pairs = 4, run doubled = 12 → 24).

The engine is implemented to be mathematically correct. The test suite encodes
the **intended** hand (`7-7-8-8 + 9 = 24`) and also pins the literal typo hand
at its true value (`7-8-8-9 + 9 = 20`) so nobody later "fixes" the engine to
the wrong number. If you'd rather the brief itself be corrected, say so and
I'll update `REQUIREMENTS.md`.

## What's next

The grader (Section 4A) is the next increment: expected hand value (exact),
expected crib value (seeded simulation), discard ranking and "points given
away", then pegging grading, luck vs. skill, and hindsight — each unit-tested
like the engine, and it will complete the `npm run deal` ranking output.
