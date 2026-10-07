import { describe, it, expect } from 'vitest';
import { toTableView, parseCardId } from './gameView';
import type { GameState } from './types';

const seats = [
  { seat_index: 0, team: 0, player_id: 'me', display_name: 'Kyle', stand_name: null, is_bot: false },
  { seat_index: 1, team: 1, player_id: 'opp', display_name: 'Dave', stand_name: null, is_bot: false },
];

function makeState(partial: {
  phase: string;
  turn_seat?: number | null;
  count?: number;
  series?: string[];
  cards_left?: number[];
  starter?: string | null;
  myCards: { kind: string; cards: string[] }[];
  scores?: number[];
  status?: string;
}): GameState {
  return {
    game: { status: partial.status ?? 'playing', player_count: 2, scores: partial.scores ?? [0, 0], dealer_seat: 0, winner_unit: null },
    seats,
    hand: {
      hand_number: 1,
      dealer_seat: 0,
      phase: partial.phase,
      starter: partial.starter ?? null,
      turn_seat: partial.turn_seat ?? null,
      running_count: partial.count ?? 0,
      series: partial.series ?? [],
      cards_left: partial.cards_left ?? [6, 6],
    },
    my_cards: partial.myCards,
  } as unknown as GameState;
}

describe('toTableView', () => {
  it('parses card ids including 10s', () => {
    expect(parseCardId('10S')).toEqual({ rank: '10', suit: 'S' });
    expect(parseCardId('KD')).toEqual({ rank: 'K', suit: 'D' });
  });

  it('discarding: shows my 6 cards and asks me to pick 2 for the crib', () => {
    const v = toTableView(makeState({ phase: 'discarding', myCards: [{ kind: 'dealt', cards: ['5C', '5D', '5H', 'JS', '2C', '9D'] }] }), 'me');
    expect(v.phase).toBe('discarding');
    expect(v.mySeat).toBe(0);
    expect(v.myHand).toHaveLength(6);
    expect(v.discardTarget).toBe(2);
    expect(v.playableIndices).toEqual([]);
    expect(v.statusLine).toContain('Select 2');
    expect(v.opponents).toHaveLength(1);
    expect(v.opponents[0]).toMatchObject({ name: 'Dave', cardCount: 6 });
    expect(v.teams.map((t) => t.name)).toEqual(['You', 'Dave']);
  });

  it('discarding: once I have kept 4, I am not asked again', () => {
    const v = toTableView(makeState({ phase: 'discarding', cards_left: [4, 6], myCards: [{ kind: 'kept', cards: ['5C', '5D', '5H', 'JS'] }] }), 'me');
    expect(v.myHand).toHaveLength(4);
    expect(v.discardTarget).toBeNull();
    expect(v.statusLine).toContain('Waiting');
  });

  it('pegging on my turn: only legal cards are playable and count shows', () => {
    const v = toTableView(
      makeState({ phase: 'pegging', turn_seat: 0, count: 25, series: ['KC'], starter: '5S', cards_left: [4, 3], myCards: [{ kind: 'kept', cards: ['5C', '6D', '7H', '8S'] }] }),
      'me',
    );
    // count 25: 5->30 ok, 6->31 ok, 7->32 no, 8->33 no
    expect(v.playableIndices).toEqual([0, 1]);
    expect(v.count).toBe(25);
    expect(v.series.map((c) => c.rank)).toEqual(['K']);
    expect(v.starter).toEqual({ rank: '5', suit: 'S' });
    expect(v.statusLine).toContain('Your turn');
  });

  it('pegging on opponent turn: nothing playable, waiting status', () => {
    const v = toTableView(makeState({ phase: 'pegging', turn_seat: 1, count: 10, cards_left: [4, 3], myCards: [{ kind: 'kept', cards: ['5C', '6D', '7H', '8S'] }] }), 'me');
    expect(v.playableIndices).toEqual([]);
    expect(v.statusLine).toContain('Waiting for Dave');
  });

  it('game over exposes the winner', () => {
    const s = makeState({ phase: 'done', status: 'over', scores: [121, 90], myCards: [] });
    s.game.winner_unit = 0;
    const v = toTableView(s, 'me');
    expect(v.phase).toBe('over');
    expect(v.winnerUnit).toBe(0);
  });
});
