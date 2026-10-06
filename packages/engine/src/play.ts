/**
 * The play (pegging) flow across all seats for one hand. REQUIREMENTS 3.5.
 *
 * Models the full round: leads from the dealer's left, clockwise, resets on
 * 31 and on go, skips players who are out of cards, and awards the go (1) /
 * thirty-one (2, no extra go) / last-card (1) points to the right seat.
 *
 * This is pure and deterministic given a card-chooser, so it drives the real
 * game, the camp bots, and the pegging tests from one place.
 */

import { type Card, cardValue } from './cards.js';
import { scorePegCard, type PegEvent } from './score-pegging.js';

export interface PlayLogEntry {
  readonly seat: number;
  /** 'play' | 'go' | 'last-card' */
  readonly kind: 'play' | 'go' | 'last-card';
  readonly card?: Card;
  readonly countAfter: number;
  readonly points: number;
  readonly events: PegEvent[];
  readonly description: string;
}

export interface PlayResult {
  /** Pegging points scored per seat during the play. */
  readonly pegPoints: number[];
  readonly log: PlayLogEntry[];
}

export interface ChooserContext {
  readonly seat: number;
  /** This seat's remaining cards. */
  readonly hand: Card[];
  /** Legal subset of `hand` (would not exceed 31). Never empty when called. */
  readonly legal: Card[];
  /** Cards already down in the current series (since the last reset). */
  readonly series: Card[];
  readonly count: number;
}

export type CardChooser = (ctx: ChooserContext) => Card;

/** Default chooser: the first legal card. Deterministic; used by tests. */
export const firstLegal: CardChooser = (ctx) => ctx.legal[0]!;

/**
 * Run the full play phase.
 * @param hands one array per seat (the 4 kept cards), in seat order
 * @param leadSeat the seat to the dealer's left (leads the first series)
 * @param choose picks a card for a seat from its legal cards
 */
export function playPegging(
  hands: readonly Card[][],
  leadSeat: number,
  choose: CardChooser = firstLegal,
): PlayResult {
  const n = hands.length;
  const remaining = hands.map((h) => [...h]);
  const pegPoints = new Array<number>(n).fill(0);
  const log: PlayLogEntry[] = [];

  const totalCards = remaining.reduce((acc, h) => acc + h.length, 0);
  let played = 0;

  let turn = leadSeat;
  let count = 0;
  let series: Card[] = [];
  let lastPlayed = -1;
  let goCount = 0;

  const seatsWithCards = () => remaining.filter((h) => h.length > 0).length;
  const nextWithCards = (from: number): number => {
    for (let step = 1; step <= n; step++) {
      const seat = (from + step) % n;
      if (remaining[seat]!.length > 0) return seat;
    }
    return from; // nobody has cards; caller is about to stop
  };

  while (played < totalCards) {
    const hand = remaining[turn]!;

    if (hand.length === 0) {
      turn = (turn + 1) % n;
      continue;
    }

    const legal = hand.filter((c) => count + cardValue(c.rank) <= 31);

    if (legal.length === 0) {
      // "Go": this seat has cards but can't play.
      goCount++;
      if (goCount >= seatsWithCards()) {
        // Everyone still holding has passed: the series ends on a go.
        if (lastPlayed >= 0 && count !== 31) {
          pegPoints[lastPlayed]! += 1;
          log.push({
            seat: lastPlayed,
            kind: 'go',
            countAfter: count,
            points: 1,
            events: [],
            description: 'go for 1',
          });
        }
        const leader = nextWithCards(lastPlayed >= 0 ? lastPlayed : turn);
        count = 0;
        series = [];
        goCount = 0;
        lastPlayed = -1;
        turn = leader;
        continue;
      }
      turn = (turn + 1) % n;
      continue;
    }

    // Play a card.
    const card = choose({ seat: turn, hand: [...hand], legal, series: [...series], count });
    const idx = hand.findIndex((c) => c === card);
    if (idx < 0) throw new Error('Chooser returned a card not in hand');
    hand.splice(idx, 1);

    const before = series;
    const sc = scorePegCard(before, card);
    series = [...before, card];
    count = sc.total;
    played++;
    pegPoints[turn]! += sc.points;
    goCount = 0;

    log.push({
      seat: turn,
      kind: 'play',
      card,
      countAfter: count,
      points: sc.points,
      events: sc.events,
      description:
        sc.events.length > 0
          ? sc.events.map((e) => e.description).join(', ')
          : `plays for ${count}`,
    });
    lastPlayed = turn;

    if (count === 31) {
      // 31 already scored (2); no separate go point. Reset.
      const leader = nextWithCards(turn);
      count = 0;
      series = [];
      goCount = 0;
      lastPlayed = -1;
      turn = leader;
      continue;
    }

    turn = (turn + 1) % n;
  }

  // The final card of the play scores 1 for "last card" (unless it made 31,
  // in which case we already reset lastPlayed to -1 and it scored 2 only).
  if (lastPlayed >= 0 && count !== 0 && count !== 31) {
    pegPoints[lastPlayed]! += 1;
    log.push({
      seat: lastPlayed,
      kind: 'last-card',
      countAfter: count,
      points: 1,
      events: [],
      description: 'last card for 1',
    });
  }

  return { pegPoints, log };
}
