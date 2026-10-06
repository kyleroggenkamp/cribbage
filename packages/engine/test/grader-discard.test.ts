import { describe, it, expect } from 'vitest';
import { makeDeck, cardsEqual, type Card } from '../src/cards.js';
import { handTotal } from '../src/score-hand.js';
import { gradeDiscard } from '../src/grader/discard.js';
import { expectedHandValue } from '../src/grader/expected-hand.js';
import { expectedCribValue } from '../src/grader/crib-estimate.js';
import { rankOf, rankPhrase } from '../src/grader/rank.js';
import { h } from './helpers.js';

const keyOf = (cards: Card[]) =>
  cards
    .map((c) => `${c.rank}${c.suit}`)
    .sort()
    .join(',');

describe('discard grading (REQUIREMENTS 4A.2, Section 8)', () => {
  it('5C 5D 5H JS 2C 9D in 2-player: best keeps 5-5-5-J and throwing 2-9 gives 0 points lost', () => {
    const grade = gradeDiscard({
      playerCount: 2,
      dealt: h('5C 5D 5H JS 2C 9D'),
      chosenDiscard: h('2C 9D'),
      cribIsMine: true,
      seed: 'game1:hand0',
    });

    expect(keyOf(grade.best.keep)).toBe(keyOf(h('5C 5D 5H JS')));
    expect(grade.pointsLost).toBe(0);
    expect(grade.rank.position).toBe(1);
    expect(grade.rank.total).toBe(15); // choose 2 of 6
  });

  it('points lost is never negative and is > 0 for a bad throw', () => {
    const bad = gradeDiscard({
      playerCount: 2,
      dealt: h('5C 5D 5H JS 2C 9D'),
      chosenDiscard: h('5C 5D'), // throwing two of the fives: terrible
      cribIsMine: true,
      seed: 'game1:hand0',
    });
    expect(bad.pointsLost).toBeGreaterThan(0);
    expect(bad.rank.position).toBeGreaterThan(1);
  });

  it('is deterministic for the same seed (crib simulation included)', () => {
    const args = {
      playerCount: 2 as const,
      dealt: h('6C 7D 8H 9S 10C JD'),
      chosenDiscard: h('10C JD'),
      cribIsMine: false,
      seed: 'game7:hand3',
      cribSimIterations: 500,
    };
    const a = gradeDiscard(args);
    const b = gradeDiscard(args);
    expect(a.chosen.value).toBe(b.chosen.value);
    expect(a.best.value).toBe(b.best.value);
    expect(a.options.map((o) => o.value)).toEqual(b.options.map((o) => o.value));
  });

  it('finishes a full 2-player discard grade in under 2 seconds (4A.5)', () => {
    const start = Date.now();
    gradeDiscard({
      playerCount: 2,
      dealt: h('5C 6D 7H 8S 9C 10D'),
      chosenDiscard: h('9C 10D'),
      cribIsMine: true,
      seed: 'perf:0',
      cribSimIterations: 2000,
    });
    const elapsed = Date.now() - start;
    expect(elapsed).toBeLessThan(2000);
  });
});

describe('expected hand value is exact (REQUIREMENTS 4A.2 step 2, Section 8)', () => {
  it('matches a brute-force average over the 46 unseen starters (2-player)', () => {
    const dealt = h('5C 5D 5H JS 2C 9D');
    const keep = h('5C 5D 5H JS');
    const starters = makeDeck().filter(
      (card) => !dealt.some((d) => cardsEqual(d, card)),
    );
    expect(starters.length).toBe(46);
    const brute =
      starters.reduce((acc, s) => acc + handTotal([...keep], s, false), 0) /
      starters.length;
    expect(expectedHandValue(keep, dealt)).toBeCloseTo(brute, 10);
  });

  it('matches a brute-force average over the 47 unseen starters (3/4-player)', () => {
    const dealt = h('4D 5S 6C JH 5H'); // 5 dealt
    const keep = h('4D 5S 6C JH');
    const starters = makeDeck().filter(
      (card) => !dealt.some((d) => cardsEqual(d, card)),
    );
    expect(starters.length).toBe(47);
    const brute =
      starters.reduce((acc, s) => acc + handTotal([...keep], s, false), 0) /
      starters.length;
    expect(expectedHandValue(keep, dealt)).toBeCloseTo(brute, 10);
  });
});

describe('crib estimate determinism (REQUIREMENTS 4A.2 step 3, Section 8)', () => {
  it('gives an identical estimate for the same seed on repeated runs', () => {
    const args = {
      playerCount: 2 as const,
      thrown: h('5C 5D'),
      dealt: h('5C 5D 5H JS 2C 9D'),
      seed: 'game1:hand0',
      iterations: 1000,
    };
    expect(expectedCribValue(args)).toBe(expectedCribValue(args));
  });

  it('values 5-5 into the crib higher than 10-K (5s are crib gold)', () => {
    const dealt = h('5C 5D 10H KS 2C 9D');
    const fives = expectedCribValue({
      playerCount: 2,
      thrown: h('5C 5D'),
      dealt,
      seed: 's:0',
      iterations: 2000,
    });
    const tenKing = expectedCribValue({
      playerCount: 2,
      thrown: h('10H KS'),
      dealt,
      seed: 's:0',
      iterations: 2000,
    });
    expect(fives).toBeGreaterThan(tenKing);
  });
});

describe('ranking with ties (REQUIREMENTS 4A.2 step 6, Section 8)', () => {
  it('best option ranks 1, worst ranks last', () => {
    const values = [5.0, 4.0, 3.0, 1.0];
    expect(rankOf(5.0, values).position).toBe(1);
    expect(rankOf(1.0, values).position).toBe(4);
  });

  it('two options within 0.05 share a rank', () => {
    const values = [5.0, 4.98, 3.0];
    // 5.00 and 4.98 differ by 0.02 (<= epsilon) -> both rank 1.
    expect(rankOf(5.0, values).position).toBe(1);
    expect(rankOf(4.98, values).position).toBe(1);
    expect(rankOf(3.0, values).position).toBe(3);
  });

  it('phrases ranks in plain words', () => {
    expect(rankPhrase({ position: 1, total: 15 })).toBe('best of 15');
    expect(rankPhrase({ position: 15, total: 15 })).toBe('worst of 15');
    expect(rankPhrase({ position: 2, total: 15 })).toBe('2nd best of 15');
    expect(rankPhrase({ position: 13, total: 15 })).toBe('3rd worst of 15');
  });
});
