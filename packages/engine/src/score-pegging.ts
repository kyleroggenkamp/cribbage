/**
 * Pegging scores for a single card played onto the current series.
 * REQUIREMENTS 3.5.
 *
 * Scored here (depend only on the cards in the current series):
 *   - total reaches 15 => 2
 *   - total reaches 31 => 2
 *   - pair / three / four of a kind (consecutive same rank at the end) => 2/6/12
 *   - run of 3+ among the most recent cards (longest contiguous suffix) => 1/card
 *
 * NOT scored here (depend on the flow of play, handled in play.ts):
 *   - "go" (1) and "last card" (1).
 * Pairs and runs never carry across a count reset because the caller passes
 * only the current series.
 */

import { type Card, cardValue, rankOrder } from './cards.js';

export type PegScoreType = 'fifteen' | 'thirty-one' | 'pair' | 'run';

export interface PegEvent {
  readonly type: PegScoreType;
  readonly points: number;
  readonly description: string;
}

export interface PegCardScore {
  /** Running total after this card. */
  readonly total: number;
  readonly points: number;
  readonly events: PegEvent[];
}

/** Count how many cards at the tail of `series` share `card`'s rank. */
function trailingSameRank(series: Card[], card: Card): number {
  let k = 1; // the card itself
  for (let i = series.length - 1; i >= 0; i--) {
    if (series[i]!.rank === card.rank) k++;
    else break;
  }
  return k;
}

/** Are these cards a run (distinct, consecutive ranks, any order)? */
function isRun(cards: Card[]): boolean {
  if (cards.length < 3) return false;
  const orders = cards.map((c) => rankOrder(c.rank));
  const unique = new Set(orders);
  if (unique.size !== orders.length) return false; // a duplicate breaks it
  const min = Math.min(...orders);
  const max = Math.max(...orders);
  return max - min === orders.length - 1;
}

/** Length of the longest run formed by the tail of the full series, or 0. */
function trailingRunLength(full: Card[]): number {
  for (let len = full.length; len >= 3; len--) {
    const suffix = full.slice(full.length - len);
    if (isRun(suffix)) return len;
  }
  return 0;
}

const OF_A_KIND: Record<number, { points: number; label: string }> = {
  2: { points: 2, label: 'pair' },
  3: { points: 6, label: 'three of a kind' },
  4: { points: 12, label: 'four of a kind' },
};

/**
 * Score the act of playing `card` onto `seriesBefore` (the cards already down
 * in the current series since the last reset). Throws if the play exceeds 31.
 */
export function scorePegCard(
  seriesBefore: Card[],
  card: Card,
): PegCardScore {
  const total =
    seriesBefore.reduce((acc, c) => acc + cardValue(c.rank), 0) +
    cardValue(card.rank);
  if (total > 31) {
    throw new Error(`Illegal play: total ${total} exceeds 31`);
  }

  const events: PegEvent[] = [];

  if (total === 15) {
    events.push({ type: 'fifteen', points: 2, description: 'fifteen for 2' });
  }
  if (total === 31) {
    events.push({
      type: 'thirty-one',
      points: 2,
      description: 'thirty-one for 2',
    });
  }

  const k = trailingSameRank(seriesBefore, card);
  if (k >= 2) {
    const oak = OF_A_KIND[k]!;
    events.push({ type: 'pair', points: oak.points, description: oak.label });
  }

  const full = [...seriesBefore, card];
  const runLen = trailingRunLength(full);
  if (runLen >= 3) {
    events.push({
      type: 'run',
      points: runLen,
      description: `run of ${runLen}`,
    });
  }

  const points = events.reduce((acc, e) => acc + e.points, 0);
  return { total, points, events };
}

/** Can this card be played legally onto the current count? */
export function canPlay(count: number, card: Card): boolean {
  return count + cardValue(card.rank) <= 31;
}
