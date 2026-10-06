import { describe, it, expect } from 'vitest';
import { makeDeck } from '../src/cards.js';
import { cryptoShuffle } from '../src/rng.js';
import { handTotal } from '../src/score-hand.js';

describe('statistical sanity (REQUIREMENTS Section 8)', () => {
  it('10,000 random hands never exceed 29 and never score 19/25/26/27', () => {
    const impossible = new Set([19, 25, 26, 27]);
    for (let i = 0; i < 10_000; i++) {
      const deck = cryptoShuffle(makeDeck());
      const hand = deck.slice(0, 4);
      const starter = deck[4]!;
      const total = handTotal(hand, starter, false);
      expect(total).toBeLessThanOrEqual(29);
      expect(total).toBeGreaterThanOrEqual(0);
      expect(impossible.has(total)).toBe(false);
    }
  });
});
