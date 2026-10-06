import { describe, it, expect } from 'vitest';
import { gradePegPlay } from '../src/grader/pegging.js';
import { h, c } from './helpers.js';

describe('pegging grading (REQUIREMENTS 4A.3, Section 8)', () => {
  it('prefers a card that makes 15 over one that scores nothing', () => {
    // Count is 7. Playing the 8 makes 15 (scores 2); playing the 2 makes 9 (0).
    const grade = gradePegPlay({
      handRemaining: h('8D 2C'),
      series: h('7C'),
      count: 7,
      seen: h('7C 8D 2C'),
      chosen: c('2C'),
    });

    expect(grade).not.toBeNull();
    expect(`${grade!.best.card.rank}${grade!.best.card.suit}`).toBe('8D');
    // The 8 scores 2 immediately; the 2 scores 0, so choosing the 2 gives away
    // points.
    expect(grade!.pointsLost).toBeGreaterThan(0);
  });

  it('gives 0 points lost when the best card is chosen', () => {
    const grade = gradePegPlay({
      handRemaining: h('8D 2C'),
      series: h('7C'),
      count: 7,
      seen: h('7C 8D 2C'),
      chosen: c('8D'),
    });
    expect(grade!.pointsLost).toBe(0);
    expect(grade!.rank.position).toBe(1);
  });

  it('does not grade a forced play (only one legal card)', () => {
    // Count 30: only a card of value 1 is legal. One legal card -> not graded.
    const grade = gradePegPlay({
      handRemaining: h('AC KD'), // KD (10) would exceed 31; only AC is legal
      series: h('KH KS KC'),
      count: 30,
      seen: h('KH KS KC AC KD'),
      chosen: c('AC'),
    });
    expect(grade).toBeNull();
  });

  it('pegging points lost is never negative', () => {
    const grade = gradePegPlay({
      handRemaining: h('5D 6C 9S'),
      series: h('10C'),
      count: 10,
      seen: h('10C 5D 6C 9S'),
      chosen: c('9S'),
    });
    expect(grade!.pointsLost).toBeGreaterThanOrEqual(0);
  });
});
