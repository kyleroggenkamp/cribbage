import { describe, it, expect } from 'vitest';
import { makeDeck, seededRng, cardsEqual, type Card } from '@deercamp/engine';
import { newGame, type GameConfig } from '../src/state.js';
import { reduce, runBots, type Action } from '../src/reduce.js';

const TWO: GameConfig = { playerCount: 2, target: 121, isBot: [false, false] };

function dealAction(deck: Card[], n: number): Action {
  return { id: `deal:${n}`, type: 'deal', deck };
}

describe('hand lifecycle (REQUIREMENTS §3)', () => {
  it('deals the right sizes and opens the discard phase', () => {
    const g = newGame(TWO, 0);
    reduce(g, dealAction(makeDeck(), 1));
    expect(g.hand!.phase).toBe('discarding');
    expect(g.hand!.dealt.map((h) => h.length)).toEqual([6, 6]);
    expect(g.hand!.starter).toBeNull();
  });

  it('builds a 4-card crib, cuts the starter, and opens the play once all discard', () => {
    const g = newGame(TWO, 0);
    reduce(g, dealAction(makeDeck(), 1));
    const d0 = g.hand!.dealt[0]!.slice(0, 2);
    const d1 = g.hand!.dealt[1]!.slice(0, 2);
    reduce(g, { id: 'x0', type: 'discard', seat: 0, cards: d0 });
    expect(g.hand!.phase).toBe('discarding'); // still waiting on seat 1
    reduce(g, { id: 'x1', type: 'discard', seat: 1, cards: d1 });
    expect(g.hand!.crib).toHaveLength(4);
    expect(g.hand!.starter).not.toBeNull();
    expect(g.hand!.phase).toBe('pegging');
    expect(g.hand!.kept.map((h) => h!.length)).toEqual([4, 4]);
  });

  it('pegs his heels to the dealer when the starter is a Jack', () => {
    // Put a Jack at the starter position (index 12 after a 6+6 deal).
    const deck = makeDeck();
    const jackIdx = deck.findIndex((c) => c.rank === 'J');
    [deck[12], deck[jackIdx]] = [deck[jackIdx]!, deck[12]!];
    expect(deck[12]!.rank).toBe('J');

    const g = newGame(TWO, 0); // dealer = seat 0 = unit 0
    reduce(g, dealAction(deck, 1));
    reduce(g, { id: 'x0', type: 'discard', seat: 0, cards: g.hand!.dealt[0]!.slice(0, 2) });
    reduce(g, { id: 'x1', type: 'discard', seat: 1, cards: g.hand!.dealt[1]!.slice(0, 2) });
    expect(g.hand!.starter!.rank).toBe('J');
    expect(g.scores[0]).toBe(2); // his heels for 2 to the dealer's unit
    expect(g.events.some((e) => e.kind === 'his-heels')).toBe(true);
  });

  it('is idempotent: replaying an action id does nothing', () => {
    const g = newGame(TWO, 0);
    reduce(g, dealAction(makeDeck(), 1));
    const d0 = g.hand!.dealt[0]!.slice(0, 2);
    reduce(g, { id: 'x0', type: 'discard', seat: 0, cards: d0 });
    const cribAfterFirst = g.hand!.crib.length;
    reduce(g, { id: 'x0', type: 'discard', seat: 0, cards: d0 }); // duplicate
    expect(g.hand!.crib.length).toBe(cribAfterFirst);
    expect(g.processed.filter((p) => p === 'x0')).toHaveLength(1);
  });
});

describe('counting out via his heels', () => {
  it('his heels can win the game immediately', () => {
    const deck = makeDeck();
    const jackIdx = deck.findIndex((c) => c.rank === 'J');
    [deck[12], deck[jackIdx]] = [deck[jackIdx]!, deck[12]!];

    const g = newGame(TWO, 0);
    g.scores[0] = 120; // dealer's unit one short
    reduce(g, dealAction(deck, 1));
    reduce(g, { id: 'x0', type: 'discard', seat: 0, cards: g.hand!.dealt[0]!.slice(0, 2) });
    reduce(g, { id: 'x1', type: 'discard', seat: 1, cards: g.hand!.dealt[1]!.slice(0, 2) });
    expect(g.status).toBe('over');
    expect(g.winnerUnit).toBe(0);
    expect(g.hand!.pegging).toBeNull(); // play never started
  });
});

describe('a full all-bot game plays to a winner', () => {
  it('terminates with someone reaching the target (2-player)', () => {
    const cfg: GameConfig = { playerCount: 2, target: 121, isBot: [true, true], botCribIterations: 120 };
    const g = newGame(cfg, 0);
    const rng = seededRng('full-bot-2p');

    reduce(g, dealAction(rng.shuffle(makeDeck()), g.handNumber + 1));
    runBots(g);

    let guard = 0;
    while (g.status === 'playing' && guard++ < 300) {
      expect(g.hand!.phase).toBe('done'); // bots played the whole hand
      reduce(g, dealAction(rng.shuffle(makeDeck()), g.handNumber + 1));
      runBots(g);
    }
    expect(g.status).toBe('over');
    expect(g.winnerUnit).not.toBeNull();
    expect(Math.max(...g.scores)).toBeGreaterThanOrEqual(121);
  });

  it('terminates in a 4-player (team) game', () => {
    const cfg: GameConfig = {
      playerCount: 4,
      target: 121,
      isBot: [true, true, true, true],
      botCribIterations: 80,
    };
    const g = newGame(cfg, 0);
    const rng = seededRng('full-bot-4p');
    reduce(g, dealAction(rng.shuffle(makeDeck()), g.handNumber + 1));
    runBots(g);
    let guard = 0;
    while (g.status === 'playing' && guard++ < 300) {
      reduce(g, dealAction(rng.shuffle(makeDeck()), g.handNumber + 1));
      runBots(g);
    }
    expect(g.status).toBe('over');
    expect(g.scores).toHaveLength(2); // two teams
  });
});
