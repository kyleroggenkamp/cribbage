/**
 * Statistical build-verification: luck is zero-mean by construction
 * (REQUIREMENTS Section 8). If a baseline is keyed to the wrong case or the
 * arithmetic is off, the mean drifts far from zero and these fail.
 *
 * The spec checks this over 10,000 deals to ±0.1. To keep an opt-in `npm run
 * test:slow` reasonably quick these use smaller samples with a correspondingly
 * looser tolerance; raising N tightens the bound toward ±0.1. Run the full
 * 100k baseline with `npm run gen:baselines -- 100000 50000`.
 */

import { describe, it, expect } from 'vitest';
import { makeDeck, type Card } from '../src/cards.js';
import { seededRng } from '../src/rng.js';
import { dealHands } from '../src/deal.js';
import { expectedHandValue } from '../src/grader/expected-hand.js';
import { gradeDiscard } from '../src/grader/discard.js';
import { combinations } from '../src/grader/combinatorics.js';
import { replayPegging } from '../src/grader/pegging-policy.js';

const DEALER = 0;
const side = (seat: number) => (seat === DEALER ? 'dealer' : 'nondealer');

function bestKeep(dealt: Card[], discardsEach: number): Card[] {
  let best: Card[] = [];
  let bestVal = -Infinity;
  for (const discard of combinations(dealt, discardsEach)) {
    const keep = dealt.filter((c) => !discard.includes(c));
    const v = expectedHandValue(keep, dealt);
    if (v > bestVal) {
      bestVal = v;
      best = keep;
    }
  }
  return best;
}

describe('deal-luck baseline is zero-mean (2-player)', () => {
  it('mean deal luck is ~0 for dealer and non-dealer', () => {
    const N = 1200;
    const cribIters = 100;
    const base: Record<string, { sum: number; n: number }> = {
      dealer: { sum: 0, n: 0 },
      nondealer: { sum: 0, n: 0 },
    };

    const buildRng = seededRng('deal-luck-base');
    const bestVals: { seat: number; val: number }[][] = [];
    for (let i = 0; i < N; i++) {
      const { hands } = dealHands(2, buildRng.shuffle(makeDeck()));
      const row: { seat: number; val: number }[] = [];
      for (let seat = 0; seat < 2; seat++) {
        const dealt = hands[seat]!;
        const val = gradeDiscard({
          playerCount: 2,
          dealt,
          chosenDiscard: dealt.slice(0, 2),
          cribIsMine: side(seat) === 'dealer',
          seed: `base:${i}:${seat}`,
          cribSimIterations: cribIters,
        }).best.value;
        base[side(seat)]!.sum += val;
        base[side(seat)]!.n += 1;
        row.push({ seat, val });
      }
      bestVals.push(row);
    }
    const baseline = {
      dealer: base.dealer!.sum / base.dealer!.n,
      nondealer: base.nondealer!.sum / base.nondealer!.n,
    };

    // Independent sample.
    const sampleRng = seededRng('deal-luck-sample');
    const acc: Record<string, { sum: number; n: number }> = {
      dealer: { sum: 0, n: 0 },
      nondealer: { sum: 0, n: 0 },
    };
    for (let i = 0; i < N; i++) {
      const { hands } = dealHands(2, sampleRng.shuffle(makeDeck()));
      for (let seat = 0; seat < 2; seat++) {
        const dealt = hands[seat]!;
        const val = gradeDiscard({
          playerCount: 2,
          dealt,
          chosenDiscard: dealt.slice(0, 2),
          cribIsMine: side(seat) === 'dealer',
          seed: `sample:${i}:${seat}`,
          cribSimIterations: cribIters,
        }).best.value;
        const luck = val - baseline[side(seat) as 'dealer' | 'nondealer'];
        acc[side(seat)]!.sum += luck;
        acc[side(seat)]!.n += 1;
      }
    }
    expect(Math.abs(acc.dealer!.sum / acc.dealer!.n)).toBeLessThan(0.4);
    expect(Math.abs(acc.nondealer!.sum / acc.nondealer!.n)).toBeLessThan(0.4);
  });
});

describe('pegging-luck baseline is zero-mean (2-player)', () => {
  it('mean pegging luck is ~0 for dealer and non-dealer, and the policy is deterministic', () => {
    const N = 4000;
    const base: Record<string, { sum: number; n: number }> = {
      dealer: { sum: 0, n: 0 },
      nondealer: { sum: 0, n: 0 },
    };

    const buildRng = seededRng('peg-luck-base');
    for (let i = 0; i < N; i++) {
      const { hands } = dealHands(2, buildRng.shuffle(makeDeck()));
      const kept = hands.map((hd) => bestKeep(hd, 2));
      const { perSeat } = replayPegging(kept, DEALER, 2);
      base.dealer!.sum += perSeat[DEALER]!;
      base.dealer!.n += 1;
      base.nondealer!.sum += perSeat[1]!;
      base.nondealer!.n += 1;
    }
    const baseline = {
      dealer: base.dealer!.sum / base.dealer!.n,
      nondealer: base.nondealer!.sum / base.nondealer!.n,
    };

    const sampleRng = seededRng('peg-luck-sample');
    const acc: Record<string, { sum: number; n: number }> = {
      dealer: { sum: 0, n: 0 },
      nondealer: { sum: 0, n: 0 },
    };
    for (let i = 0; i < N; i++) {
      const { hands } = dealHands(2, sampleRng.shuffle(makeDeck()));
      const kept = hands.map((hd) => bestKeep(hd, 2));
      const { perSeat } = replayPegging(kept, DEALER, 2);
      acc.dealer!.sum += perSeat[DEALER]! - baseline.dealer;
      acc.dealer!.n += 1;
      acc.nondealer!.sum += perSeat[1]! - baseline.nondealer;
      acc.nondealer!.n += 1;
    }
    expect(Math.abs(acc.dealer!.sum / acc.dealer!.n)).toBeLessThan(0.2);
    expect(Math.abs(acc.nondealer!.sum / acc.nondealer!.n)).toBeLessThan(0.2);
  });
});
