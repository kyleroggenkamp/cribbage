import { describe, it, expect } from 'vitest';
import { makeDeck, cardsEqual } from '../src/cards.js';
import {
  cutLuck,
  cribLuck,
  dealLuck,
  peggingLuck,
  computeHandLuck,
  winnerHeadline,
  excuseLine,
  luckiest,
  unluckiest,
  fmtSigned,
} from '../src/grader/luck.js';
import { type BaselineSet } from '../src/grader/baseline-cases.js';
import { h, c } from './helpers.js';

const TEST_BASELINES: BaselineSet = {
  meta: { generatedAt: 'test', dealLuckSamples: 0, peggingSamples: 0, cribIterations: 0 },
  dealLuck: {
    '2p-dealer': 10,
    '2p-nondealer': 4,
    '3p-dealer': 10,
    '3p-nondealer': 2,
    '4p-dealer': 10,
    '4p-nondealer': 2,
  },
  peggingLuck: {
    '2p-dealer': 4,
    '2p-nondealer': 2,
    '3p-dealer': 4,
    '3p-nondealer': 2,
    '4p-dealer': 6,
    '4p-nondealer': 5,
  },
};

describe('cut luck (REQUIREMENTS 4A.7, Section 8)', () => {
  it('averages to exactly 0 over all possible starters (zero-mean by construction)', () => {
    const dealt = h('5C 5D 5H JS 2C 9D');
    const keep = h('5C 5D 5H JS');
    const starters = makeDeck().filter((card) => !dealt.some((d) => cardsEqual(d, card)));
    const mean =
      starters.reduce((acc, s) => acc + cutLuck(keep, s, dealt), 0) / starters.length;
    expect(mean).toBeCloseTo(0, 10);
  });

  it('is actual score minus expected score for a given starter', () => {
    const dealt = h('5C 5D 5H JS 2C 9D');
    const keep = h('5C 5D 5H JS');
    // With starter 5S the hand is the perfect 29; expected is well below 29,
    // so cut luck is strongly positive.
    expect(cutLuck(keep, c('5S'), dealt)).toBeGreaterThan(0);
  });
});

describe('crib / deal / pegging luck (REQUIREMENTS 4A.7)', () => {
  it('crib luck is actual crib score minus the grader estimate', () => {
    // Crib 5C 5D 5H 5S + starter JD scores 28: fifteens 16 (5+5+5 four ways,
    // 10+5 four ways) + four-of-a-kind 12. So crib luck = 28 - estimate.
    expect(cribLuck(h('5C 5D 5H 5S'), c('JD'), 6)).toBeCloseTo(28 - 6, 10);
  });

  it('deal luck subtracts the case baseline', () => {
    expect(dealLuck(13, 2, 'dealer', TEST_BASELINES)).toBeCloseTo(3, 10);
    expect(dealLuck(3, 2, 'nondealer', TEST_BASELINES)).toBeCloseTo(-1, 10);
  });

  it('pegging luck subtracts the case baseline', () => {
    expect(peggingLuck(7, 2, 'dealer', TEST_BASELINES)).toBeCloseTo(3, 10);
    expect(peggingLuck(5, 4, 'nondealer', TEST_BASELINES)).toBeCloseTo(0, 10);
  });

  it('computeHandLuck sums the four components; crib only on the dealer side', () => {
    const dealt = h('5C 5D 5H JS 2C 9D');
    const keep = h('5C 5D 5H JS');
    const dealerLuck = computeHandLuck({
      playerCount: 2,
      side: 'dealer',
      dealt,
      keep,
      starter: c('5S'),
      bestDiscardValue: 13,
      expectedPeggingUnit: 7,
      crib: h('2C 9D 3C 4D'),
      expectedCrib: 2,
      baselines: TEST_BASELINES,
    });
    expect(dealerLuck.total).toBeCloseTo(
      dealerLuck.deal + dealerLuck.cut + dealerLuck.crib + dealerLuck.pegging,
      10,
    );
    expect(dealerLuck.crib).not.toBe(0);

    const nonDealerLuck = computeHandLuck({
      playerCount: 2,
      side: 'nondealer',
      dealt,
      keep,
      starter: c('5S'),
      bestDiscardValue: 13,
      expectedPeggingUnit: 7,
      crib: h('2C 9D 3C 4D'),
      expectedCrib: 2,
      baselines: TEST_BASELINES,
    });
    expect(nonDealerLuck.crib).toBe(0); // crib luck only for the dealer's side
  });
});

describe('winner headline (REQUIREMENTS 4A.7)', () => {
  it('"Won on cards" when luck clearly beats skill loss', () => {
    expect(winnerHeadline(12, 2).key).toBe('won-on-cards');
  });
  it('"Won on play" when skill loss is small and luck is near zero/negative', () => {
    expect(winnerHeadline(-1, 1).key).toBe('won-on-play');
  });
  it('"Earned it" otherwise', () => {
    expect(winnerHeadline(4, 6).key).toBe('earned-it');
  });
});

describe('excuse line (REQUIREMENTS 4A.7)', () => {
  const base = {
    margin: 4,
    winnerName: 'Dave',
    loserLuck: 0,
    winnerLuck: 0,
    loserSkillLoss: 0,
    winnerSkillLoss: 0,
  };

  it('appears when the loser had worse cards', () => {
    const line = excuseLine({ ...base, loserLuck: -11.2, winnerLuck: 0 });
    expect(line).toContain('Lost by 4');
    expect(line).toContain('11.2 points worse');
  });

  it('appears when the loser played better (gave away fewer)', () => {
    const line = excuseLine({ ...base, loserSkillLoss: 1, winnerSkillLoss: 4.1 });
    expect(line).toContain('3.1 fewer points');
  });

  it('is omitted when it does not make the loser case', () => {
    const line = excuseLine({
      ...base,
      loserLuck: 5, // loser had BETTER cards
      winnerLuck: 0,
      loserSkillLoss: 5, // and played WORSE
      winnerSkillLoss: 1,
    });
    expect(line).toBeNull();
  });
});

describe('luck awards and formatting (REQUIREMENTS 4A.7)', () => {
  it('Horseshoe / Hard-luck hunter pick the extremes, ties included', () => {
    expect(luckiest([1, 5, 5, -2])).toEqual([1, 2]);
    expect(unluckiest([1, 5, 5, -2])).toEqual([3]);
  });

  it('formats with a sign and one decimal, no negative zero', () => {
    expect(fmtSigned(4.23)).toBe('+4.2');
    expect(fmtSigned(-3.56)).toBe('-3.6');
    expect(fmtSigned(-0.01)).toBe('+0.0');
  });
});
