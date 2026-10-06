import { describe, it, expect } from 'vitest';
import { makeDeck } from '../src/cards.js';
import { dealHands, cutStarter, hisHeels, DEAL_CONFIG } from '../src/deal.js';
import { c } from './helpers.js';

describe('dealing (REQUIREMENTS 3.3-3.4, Section 8)', () => {
  it('3-player deal gives 5/5/5 and 1 card to the crib', () => {
    const deck = makeDeck();
    const { hands, cribSeed, stock } = dealHands(3, deck);
    expect(hands.map((hc) => hc.length)).toEqual([5, 5, 5]);
    expect(cribSeed).toHaveLength(1);
    // 52 - (15 dealt + 1 crib) = 36 left for the cut.
    expect(stock).toHaveLength(36);
  });

  it('2-player deal gives 6/6 and nothing to the crib', () => {
    const { hands, cribSeed } = dealHands(2, makeDeck());
    expect(hands.map((hc) => hc.length)).toEqual([6, 6]);
    expect(cribSeed).toHaveLength(0);
  });

  it('4-player deal gives 5/5/5/5 and nothing to the crib', () => {
    const { hands, cribSeed } = dealHands(4, makeDeck());
    expect(hands.map((hc) => hc.length)).toEqual([5, 5, 5, 5]);
    expect(cribSeed).toHaveLength(0);
  });

  it('the deal table matches the spec: crib always ends at 4', () => {
    for (const pc of [2, 3, 4] as const) {
      const cfg = DEAL_CONFIG[pc];
      const cribCards = cfg.extraToCrib + cfg.discardsEach * pc;
      expect(cribCards).toBe(4);
      expect(cfg.handSizeAfterDiscard).toBe(4);
    }
  });

  it('deals no duplicate cards', () => {
    const { hands, cribSeed, stock } = dealHands(4, makeDeck());
    const all = [...hands.flat(), ...cribSeed, ...stock];
    const ids = new Set(all.map((card) => `${card.rank}${card.suit}`));
    expect(ids.size).toBe(52);
  });

  it('cutStarter returns the top of the stock; his heels is 2 for a Jack', () => {
    expect(hisHeels(c('JD'))).toBe(2);
    expect(hisHeels(c('5D'))).toBe(0);
    const stock = [c('JD'), c('2C')];
    expect(cutStarter(stock)).toEqual(c('JD'));
    expect(hisHeels(cutStarter(stock))).toBe(2);
  });
});
