import { describe, it, expect } from 'vitest';
import { makeDeck, seededRng, playPegging, firstLegal, type Card, type PlayerCount } from '@deercamp/engine';
import { initPegging, applyPlay, legalPlays, type PeggingState } from '../src/pegging.js';

/** Drive the incremental stepper always choosing the first legal card. */
function stepFirstLegal(kept: Card[][], lead: number): PeggingState {
  const st = initPegging(kept, lead);
  let guard = 0;
  while (!st.done && guard++ < 1000) {
    const legal = legalPlays(st);
    applyPlay(st, st.turn, legal[0]!);
  }
  return st;
}

describe('incremental pegging matches engine playPegging', () => {
  it('produces identical peg points over many random deals (2/3/4-player)', () => {
    const rng = seededRng('peg-crosscheck');
    for (const pc of [2, 3, 4] as PlayerCount[]) {
      for (let i = 0; i < 300; i++) {
        const deck = rng.shuffle(makeDeck());
        const kept: Card[][] = [];
        for (let seat = 0; seat < pc; seat++) kept.push(deck.slice(seat * 4, seat * 4 + 4));
        const lead = 1 % pc;

        const stepped = stepFirstLegal(kept, lead);
        const batch = playPegging(kept, lead, firstLegal);

        expect(stepped.done).toBe(true);
        expect(stepped.playedCount).toBe(pc * 4);
        expect(stepped.pegPoints).toEqual(batch.pegPoints);
      }
    }
  });
});

describe('pegging stepper basics', () => {
  it('awaits the lead seat first and refuses an out-of-turn play', () => {
    const kept = [
      [{ rank: '5', suit: 'C' }, { rank: '6', suit: 'D' }, { rank: '7', suit: 'H' }, { rank: '8', suit: 'S' }],
      [{ rank: '5', suit: 'D' }, { rank: '6', suit: 'C' }, { rank: '7', suit: 'S' }, { rank: '9', suit: 'D' }],
    ] as Card[][];
    const st = initPegging(kept, 1);
    expect(st.turn).toBe(1);
    expect(() => applyPlay(st, 0, kept[0]![0]!)).toThrow();
  });
});
