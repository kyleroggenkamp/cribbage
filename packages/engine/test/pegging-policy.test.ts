import { describe, it, expect } from 'vitest';
import { replayPegging, standardPeggingChooser } from '../src/grader/pegging-policy.js';
import { playPegging } from '../src/play.js';
import { h } from './helpers.js';

describe('standard pegging policy (REQUIREMENTS 4A.7.1-4A.7.2, Section 8)', () => {
  it('is deterministic: the same hands replay to the same points every time', () => {
    const kept = [h('5C 6D 7H 8S'), h('5D 6C 7S 9D')];
    const a = replayPegging(kept, 0, 2);
    const b = replayPegging(kept, 0, 2);
    expect(a.perSeat).toEqual(b.perSeat);
    expect(a.perUnit).toEqual(b.perUnit);
  });

  it('sums seat points into teams in 4-player', () => {
    const kept = [
      h('AC 2C 3C 4C'),
      h('5D 6D 7D 8D'),
      h('9H 10H JH QH'),
      h('KS AS 2S 3S'),
    ];
    const { perSeat, perUnit } = replayPegging(kept, 0, 4);
    // Units: seats 0+2 -> unit 0, seats 1+3 -> unit 1.
    expect(perUnit[0]).toBe(perSeat[0]! + perSeat[2]!);
    expect(perUnit[1]).toBe(perSeat[1]! + perSeat[3]!);
  });

  it('every card is played exactly once under the policy', () => {
    const kept = [h('5C 6D 7H 8S'), h('5D 6C 7S 9D')];
    const { log } = playPegging(kept, 1, standardPeggingChooser);
    expect(log.filter((e) => e.kind === 'play')).toHaveLength(8);
  });
});
