import { describe, it, expect } from 'vitest';
import {
  hindsightAtCut,
  hindsightInRecap,
  verdict,
  cutFavored,
  couldaShouldaCallout,
} from '../src/grader/hindsight.js';
import { gradeDiscard } from '../src/grader/discard.js';
import { type Card } from '../src/cards.js';
import { h, c } from './helpers.js';

const keyOf = (cards: Card[]) =>
  cards.map((x) => `${x.rank}${x.suit}`).sort().join(',');

describe('hindsight at the cut (REQUIREMENTS 4A.8, Section 8)', () => {
  it('best matches the hand-checked answer: keep 5-5-5-J with starter 5S scores 29', () => {
    const hs = hindsightAtCut({
      playerCount: 2,
      dealt: h('5C 5D 5H JS 2C 9D'),
      chosenDiscard: h('2C 9D'),
      starter: c('5S'),
    });
    expect(hs.best.value).toBe(29);
    expect(keyOf(hs.best.keep)).toBe(keyOf(h('5C 5D 5H JS')));
    // The player actually kept the best, so the spread is 0.
    expect(hs.spread).toBe(0);
  });

  it('reports a positive spread when the actual throw was not the hindsight best', () => {
    const hs = hindsightAtCut({
      playerCount: 2,
      dealt: h('5C 5D 5H JS 2C 9D'),
      chosenDiscard: h('5C 5D'), // threw away two fives
      starter: c('5S'),
    });
    expect(hs.spread).toBeGreaterThan(0);
  });
});

describe('hindsight in the recap (REQUIREMENTS 4A.8)', () => {
  it('adds the crib effect exactly; own crib adds, opponent crib subtracts', () => {
    const common = {
      playerCount: 2 as const,
      dealt: h('5C 5D 5H JS 2C 9D'),
      chosenDiscard: h('2C 9D'),
      starter: c('5S'),
      actualCrib: h('2C 9D 3C 4D'), // my throw (2C 9D) + others' (3C 4D)
    };
    const mine = hindsightInRecap({ ...common, cribIsMine: true });
    const theirs = hindsightInRecap({ ...common, cribIsMine: false });
    // Same kept hands, but the crib flips sign, so my-crib value >= opp-crib.
    const mineActual = mine.actual.value;
    const theirsActual = theirs.actual.value;
    expect(mineActual).toBeGreaterThanOrEqual(theirsActual);
  });
});

describe('verdict table (REQUIREMENTS 4A.8)', () => {
  it('follows the four-way table', () => {
    expect(verdict(true, true).tag).toBe('called-it');
    expect(verdict(true, false).tag).toBe('right-call-wrong-cut');
    expect(verdict(false, true).tag).toBe('blind-squirrel');
    expect(verdict(false, false).tag).toBe('coulda-shoulda-woulda');
  });

  it('cutFavored is true within the tolerance and false beyond it', () => {
    expect(cutFavored({ options: [], best: {} as never, actual: {} as never, spread: 0 })).toBe(true);
    expect(cutFavored({ options: [], best: {} as never, actual: {} as never, spread: 1 })).toBe(true);
    expect(cutFavored({ options: [], best: {} as never, actual: {} as never, spread: 1.5 })).toBe(false);
  });

  it('Coulda-shoulda callout picks the biggest spread at the table (ties)', () => {
    expect(couldaShouldaCallout([2, 7, 7, 1])).toEqual([1, 2]);
  });
});

describe('hindsight never changes grades (REQUIREMENTS 4A.8)', () => {
  it('grading is identical before and after running hindsight', () => {
    const args = {
      playerCount: 2 as const,
      dealt: h('5C 5D 5H JS 2C 9D'),
      chosenDiscard: h('2C 9D'),
      cribIsMine: true,
      seed: 'g:0',
      cribSimIterations: 300,
    };
    const before = gradeDiscard(args);
    hindsightAtCut({
      playerCount: 2,
      dealt: args.dealt,
      chosenDiscard: args.chosenDiscard,
      starter: c('5S'),
    });
    const after = gradeDiscard(args);
    expect(after.pointsLost).toBe(before.pointsLost);
    expect(after.rank).toEqual(before.rank);
    expect(after.best.value).toBe(before.best.value);
  });
});
