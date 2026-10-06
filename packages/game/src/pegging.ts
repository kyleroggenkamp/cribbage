/**
 * Incremental pegging: the server applies ONE card per action, so it needs a
 * stepper (the engine's playPegging runs a whole round at once). This mirrors
 * play.ts exactly — go / 31-is-2-not-3 / last-card / resets / skipping empty
 * seats — but pauses at each seat that must choose, auto-resolving "Go"s (a go
 * is automatic, §5.3, not a player action). A property test cross-checks it
 * against playPegging so the two can't diverge.
 */

import {
  type Card,
  cardValue,
  cardsEqual,
  canPlay,
  scorePegCard,
  type PegEvent,
} from '@deercamp/engine';

export interface PegLogEntry {
  readonly seat: number;
  readonly kind: 'play' | 'go' | 'last-card';
  readonly card?: Card;
  readonly countAfter: number;
  readonly points: number;
  readonly events: PegEvent[];
}

export interface PeggingState {
  hands: Card[][]; // remaining cards per seat
  count: number;
  series: Card[];
  played: Card[];
  pegPoints: number[];
  turn: number; // the seat that must play next (valid only when !done)
  lastPlayed: number;
  goCount: number;
  playedCount: number;
  totalCards: number;
  done: boolean;
  log: PegLogEntry[];
}

const seatsWithCards = (st: PeggingState) =>
  st.hands.reduce((a, h) => a + (h.length > 0 ? 1 : 0), 0);

function nextWithCards(st: PeggingState, from: number): number {
  const n = st.hands.length;
  for (let step = 1; step <= n; step++) {
    const seat = (from + step) % n;
    if (st.hands[seat]!.length > 0) return seat;
  }
  return from;
}

/** Advance autogos/resets until a seat with a legal play is reached, or end. */
function advanceToActor(st: PeggingState): void {
  const n = st.hands.length;
  while (st.playedCount < st.totalCards) {
    const hand = st.hands[st.turn]!;
    if (hand.length === 0) {
      st.turn = (st.turn + 1) % n;
      continue;
    }
    const hasLegal = hand.some((c) => canPlay(st.count, c));
    if (!hasLegal) {
      st.goCount++;
      if (st.goCount >= seatsWithCards(st)) {
        if (st.lastPlayed >= 0 && st.count !== 31) {
          st.pegPoints[st.lastPlayed]! += 1;
          st.log.push({ seat: st.lastPlayed, kind: 'go', countAfter: st.count, points: 1, events: [] });
        }
        const leader = nextWithCards(st, st.lastPlayed >= 0 ? st.lastPlayed : st.turn);
        st.count = 0;
        st.series = [];
        st.goCount = 0;
        st.lastPlayed = -1;
        st.turn = leader;
        continue;
      }
      st.turn = (st.turn + 1) % n;
      continue;
    }
    return; // st.turn is a seat with a legal play; await its card
  }
  // All cards played: the final card scores last-card (unless it made 31).
  if (st.lastPlayed >= 0 && st.count !== 0 && st.count !== 31) {
    st.pegPoints[st.lastPlayed]! += 1;
    st.log.push({ seat: st.lastPlayed, kind: 'last-card', countAfter: st.count, points: 1, events: [] });
  }
  st.done = true;
}

/** Start the play: `leadSeat` (dealer's left) leads the first series. */
export function initPegging(keptHands: readonly Card[][], leadSeat: number): PeggingState {
  const st: PeggingState = {
    hands: keptHands.map((h) => [...h]),
    count: 0,
    series: [],
    played: [],
    pegPoints: new Array<number>(keptHands.length).fill(0),
    turn: leadSeat,
    lastPlayed: -1,
    goCount: 0,
    playedCount: 0,
    totalCards: keptHands.reduce((a, h) => a + h.length, 0),
    done: false,
    log: [],
  };
  advanceToActor(st);
  return st;
}

/** The legal cards the awaited seat may play right now. */
export function legalPlays(st: PeggingState): Card[] {
  if (st.done) return [];
  return st.hands[st.turn]!.filter((c) => canPlay(st.count, c));
}

/** Apply a card for the awaited seat. Mutates and returns the state. Throws on
 *  an out-of-turn or illegal play. */
export function applyPlay(st: PeggingState, seat: number, card: Card): PeggingState {
  if (st.done) throw new Error('play is over');
  if (seat !== st.turn) throw new Error(`not seat ${seat}'s turn`);
  const hand = st.hands[seat]!;
  const idx = hand.findIndex((c) => cardsEqual(c, card));
  if (idx < 0) throw new Error('card not in hand');
  if (!canPlay(st.count, card)) throw new Error('illegal play: would exceed 31');

  const n = st.hands.length;
  hand.splice(idx, 1);
  const sc = scorePegCard(st.series, card);
  st.series.push(card);
  st.played.push(card);
  st.count = sc.total;
  st.playedCount++;
  st.pegPoints[seat]! += sc.points;
  st.lastPlayed = seat;
  st.goCount = 0;
  st.log.push({ seat, kind: 'play', card, countAfter: st.count, points: sc.points, events: sc.events });

  if (st.count === 31) {
    st.turn = nextWithCards(st, seat);
    st.count = 0;
    st.series = [];
    st.lastPlayed = -1;
  } else {
    st.turn = (st.turn + 1) % n;
  }
  advanceToActor(st);
  return st;
}
