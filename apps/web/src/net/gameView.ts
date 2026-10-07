/**
 * Pure mapper: live GameState (from get_game_state) + who I am -> the view model
 * the table renders and the interaction it allows. No React, no network, so it
 * is unit-tested directly.
 */

import type { GameState, SeatRow } from './types';
import type { EngineCard } from '@/ui/Card';
import type { PegLane } from '@/ui/Pegboard';

const UNIT_COLORS = ['var(--peg-a)', 'var(--peg-b)', 'var(--peg-c)', 'var(--peg-b)'];

export function parseCardId(id: string): EngineCard {
  return { rank: id.slice(0, -1), suit: id.slice(-1) } as EngineCard;
}
function value(rank: string): number {
  if (rank === 'A') return 1;
  if (rank === '10' || rank === 'J' || rank === 'Q' || rank === 'K') return 10;
  return Number(rank);
}
function unitOf(seat: SeatRow): number {
  return seat.team;
}

export interface TableView {
  phase: 'lobby' | 'discarding' | 'pegging' | 'show' | 'done' | 'over';
  mySeat: number | null;
  teams: { name: string; score: number; color: string }[];
  lanes: PegLane[];
  opponents: { name: string; standName?: string; cardCount: number; isTurn: boolean; isDealer: boolean; color: string }[];
  starter: EngineCard | null;
  cribCount: number;
  series: EngineCard[];
  count: number;
  myHand: EngineCard[];
  /** When it's my discard: how many cards to pick (else null). */
  discardTarget: number | null;
  /** When it's my pegging turn: indices of myHand that are legal to play. */
  playableIndices: number[];
  statusLine: string;
  winnerUnit: number | null;
}

export function toTableView(state: GameState, myId: string | null): TableView {
  const { game, seats, hand } = state;
  const unitCount = Math.max(...seats.map(unitOf)) + 1;
  const mySeatRow = seats.find((s) => s.player_id === myId) ?? null;
  const mySeat = mySeatRow?.seat_index ?? null;

  const nameOf = (u: number) => {
    const members = seats.filter((s) => unitOf(s) === u);
    const names = members.map((s) => (s.seat_index === mySeat ? 'You' : s.display_name ?? '(open)'));
    return names.join(' & ');
  };

  const teams = Array.from({ length: unitCount }, (_, u) => ({
    name: nameOf(u),
    score: game.scores[u] ?? 0,
    color: UNIT_COLORS[u] ?? 'var(--peg-a)',
  }));
  const lanes: PegLane[] = teams.map((tm) => ({
    label: tm.name,
    color: tm.color,
    front: tm.score,
    back: tm.score, // leapfrog back-peg not tracked publicly yet
  }));

  const opponents = seats
    .filter((s) => s.seat_index !== mySeat && (s.player_id || s.is_bot))
    .map((s) => ({
      name: s.is_bot ? 'Camp bot' : s.display_name ?? '',
      standName: s.stand_name ?? undefined,
      cardCount: hand?.cards_left?.[s.seat_index] ?? 0,
      isTurn: hand?.turn_seat === s.seat_index,
      isDealer: (hand?.dealer_seat ?? game.dealer_seat) === s.seat_index,
      color: UNIT_COLORS[unitOf(s)] ?? 'var(--peg-a)',
    }));

  const myCardsRow = state.my_cards.find((c) => c.kind === 'kept') ?? state.my_cards.find((c) => c.kind === 'dealt');
  const myHand = (myCardsRow?.cards ?? []).map(parseCardId);
  const iDiscarded = state.my_cards.some((c) => c.kind === 'kept');

  const phase = (game.status === 'over' ? 'over' : hand?.phase ?? 'lobby') as TableView['phase'];
  const count = hand?.running_count ?? 0;

  let discardTarget: number | null = null;
  let playableIndices: number[] = [];
  if (phase === 'discarding' && mySeat !== null && !iDiscarded && myHand.length > 0) {
    discardTarget = game.player_count === 2 ? 2 : 1;
  }
  if (phase === 'pegging' && mySeat !== null && hand?.turn_seat === mySeat) {
    playableIndices = myHand.map((c, i) => (count + value(c.rank) <= 31 ? i : -1)).filter((i) => i >= 0);
  }

  const turnName = hand?.turn_seat != null ? nameOf(unitOf(seats[hand.turn_seat] ?? seats[0]!)) : '';
  let statusLine = '';
  if (phase === 'discarding') statusLine = discardTarget ? `Select ${discardTarget} card${discardTarget > 1 ? 's' : ''} for the crib` : 'Waiting for discards…';
  else if (phase === 'pegging') statusLine = playableIndices.length > 0 ? `Your turn. Count is ${count}.` : `Waiting for ${turnName}…`;
  else if (phase === 'show') statusLine = 'The count…';
  else if (phase === 'done') statusLine = 'Hand over.';
  else if (phase === 'over') statusLine = 'Game over.';

  return {
    phase,
    mySeat,
    teams,
    lanes,
    opponents,
    starter: hand?.starter ? parseCardId(hand.starter) : null,
    cribCount: hand && (phase === 'pegging' || phase === 'show' || phase === 'done') ? 4 : 0,
    series: (hand?.series ?? []).map(parseCardId),
    count,
    myHand,
    discardTarget,
    playableIndices,
    statusLine,
    winnerUnit: game.winner_unit,
  };
}
