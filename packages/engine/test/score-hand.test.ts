import { describe, it, expect } from 'vitest';
import { scoreHand, handTotal } from '../src/score-hand.js';
import { h, c } from './helpers.js';

describe('scoreHand — the show (REQUIREMENTS 3.6, Section 8)', () => {
  it('scores the perfect 29 hand: 5C 5D 5H JS + starter 5S', () => {
    // Four 5s + the right Jack. Fifteens (16) + four of a kind (12) + nobs (1).
    expect(handTotal(h('5C 5D 5H JS'), c('5S'))).toBe(29);
  });

  it('4-4-5-6 + starter 6 (double-double run) = 24', () => {
    expect(handTotal(h('4C 4D 5H 6S'), c('6C'))).toBe(24);
  });

  it('double-double run with fifteens = 24 (intended Section 8 hand)', () => {
    // REQUIREMENTS Section 8 lists "7-8-8-9 + starter 9 = 24". That card list
    // is a TYPO: 7-8-8-9 + 9 scores 20, not 24. The hand that scores 24 and
    // matches the "double-double run with fifteens" description is 7-7-8-8 + 9.
    expect(handTotal(h('7C 7D 8H 8S'), c('9C'))).toBe(24);
  });

  it('the literal (typo) Section 8 hand 7-8-8-9 + 9 actually scores 20', () => {
    // Guards against "fixing" the engine to the wrong expected value.
    expect(handTotal(h('7C 8D 8H 9S'), c('9C'))).toBe(20);
  });

  it('zero-point hand: 2C 4D 6H 8S + starter KC = 0', () => {
    expect(handTotal(h('2C 4D 6H 8S'), c('KC'))).toBe(0);
  });

  it('mockup hand: 4D 5S 6C JH + starter 5H = 17', () => {
    expect(handTotal(h('4D 5S 6C JH'), c('5H'))).toBe(17);
  });

  describe('flushes (REQUIREMENTS 3.6)', () => {
    it('4-card hand flush = 4 when the starter does not match', () => {
      expect(handTotal(h('2H 4H 6H 8H'), c('KS'))).toBe(4);
    });

    it('4-card flush + matching starter = 5', () => {
      expect(handTotal(h('2H 4H 6H 8H'), c('KH'))).toBe(5);
    });

    it('4-card crib flush = 0 (crib needs all five)', () => {
      expect(handTotal(h('2H 4H 6H 8H'), c('KS'), true)).toBe(0);
    });

    it('5-card crib flush = 5', () => {
      expect(handTotal(h('2H 4H 6H 8H'), c('KH'), true)).toBe(5);
    });
  });

  describe('nobs (REQUIREMENTS 3.6)', () => {
    it('counts when the Jack is in hand matching the starter suit', () => {
      // JH matches starter suit (hearts) -> nobs 1, and nothing else scores
      // here (no fifteen, pair, run, or flush), isolating the nobs point.
      expect(handTotal(h('JH 3C 7D KS'), c('AH'))).toBe(1);
    });

    it('does NOT count when the Jack is the starter', () => {
      // Starter is a Jack; hand has no scoring. His heels is a deal rule, not
      // part of hand counting, so the hand total is 0.
      expect(handTotal(h('2C 4D 6H 8S'), c('JH'))).toBe(0);
    });
  });

  it('exposes a breakdown with per-combination events', () => {
    const score = scoreHand(h('5C 5D 5H JS'), c('5S'));
    const fifteens = score.events.filter((e) => e.type === 'fifteen');
    const pairs = score.events.filter((e) => e.type === 'pair');
    expect(fifteens).toHaveLength(8); // 16 points of fifteens
    expect(pairs).toHaveLength(6); // four of a kind = 6 pairs = 12 points
    expect(score.events.some((e) => e.type === 'nobs')).toBe(true);
  });
});
