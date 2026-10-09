import { describe, it, expect } from 'vitest';
import { makeDeck } from '@deercamp/engine';
import { newGame, type GameConfig } from '../src/state.js';
import { reduce } from '../src/reduce.js';
import { project } from '../src/project.js';

const TWO: GameConfig = { playerCount: 2, target: 121, isBot: [false, false] };

describe('project (GameState -> public rows + private cards)', () => {
  it('during discarding, exposes each seat its full dealt hand and the crib shared', () => {
    const g = newGame(TWO, 0);
    reduce(g, { id: 'd1', type: 'deal', deck: makeDeck() });
    const p = project(g);

    expect(p.hand!.phase).toBe('discarding');
    expect(p.hand!.starter).toBeNull(); // not cut yet -> not public
    const perSeat = p.privateCards.filter((r) => !r.shared);
    expect(perSeat).toHaveLength(2);
    expect(perSeat.every((r) => r.kind === 'dealt' && r.cards.length === 6)).toBe(true);
    const crib = p.privateCards.find((r) => r.shared);
    expect(crib?.kind).toBe('crib');
  });

  it('after discards, exposes the 4 kept cards and the public hand carries the starter', () => {
    const g = newGame(TWO, 0);
    reduce(g, { id: 'd1', type: 'deal', deck: makeDeck() });
    reduce(g, { id: 'x0', type: 'discard', seat: 0, cards: g.hand!.dealt[0]!.slice(0, 2) });
    reduce(g, { id: 'x1', type: 'discard', seat: 1, cards: g.hand!.dealt[1]!.slice(0, 2) });
    const p = project(g);

    expect(p.hand!.phase).toBe('pegging');
    expect(p.hand!.starter).not.toBeNull();
    expect(p.hand!.turn_seat).toBe(1); // dealer's left leads
    expect(p.hand!.cards_left).toEqual([4, 4]); // both kept 4 after discarding
    const kept = p.privateCards.filter((r) => !r.shared);
    expect(kept.every((r) => r.kind === 'kept' && r.cards.length === 4)).toBe(true);
    expect(p.privateCards.find((r) => r.shared)?.cards).toHaveLength(4); // full crib
  });

  it('during the play, a seat sees only its UNPLAYED cards (shrinks as it pegs)', () => {
    const g = newGame(TWO, 0);
    reduce(g, { id: 'd1', type: 'deal', deck: makeDeck() });
    reduce(g, { id: 'x0', type: 'discard', seat: 0, cards: g.hand!.dealt[0]!.slice(0, 2) });
    reduce(g, { id: 'x1', type: 'discard', seat: 1, cards: g.hand!.dealt[1]!.slice(0, 2) });

    const leader = g.hand!.pegging!.turn; // dealer's left leads
    const card = g.hand!.pegging!.hands[leader]![0]!;
    reduce(g, { id: 'p0', type: 'play', seat: leader, card });

    const p = project(g);
    expect(p.hand!.phase).toBe('pegging');
    // The seat that played now holds 3; the other still holds 4.
    const mine = p.privateCards.find((r) => !r.shared && r.seat_index === leader)!;
    expect(mine.cards).toHaveLength(3);
    // The played card is gone from the hand (it lives in the series now).
    const playedId = p.hand!.series.at(-1)!;
    expect(mine.cards).not.toContain(playedId);
    expect(p.hand!.cards_left[leader]).toBe(3);
  });

  it('exposes per-unit scores and no hand when none dealt', () => {
    const g = newGame(TWO, 0);
    g.scores = [10, 7];
    const p = project(g);
    expect(p.game.scores).toEqual([10, 7]);
    expect(p.hand).toBeNull();
  });
});
