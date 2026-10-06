/**
 * The show: counting a 4-card hand (or crib) together with the starter.
 * Pure, exact, deterministic. REQUIREMENTS 3.6.
 *
 * Scoring categories:
 *  - Fifteens: each distinct subset of cards summing to 15 = 2
 *  - Pairs: each distinct pair = 2 (so 3-of-a-kind = 6, 4-of-a-kind = 12)
 *  - Runs: each distinct run of 3+ consecutive ranks = 1 per card
 *  - Flush: 4 if all four hand cards share a suit; 5 if the starter matches too.
 *           Crib flushes only count at 5 (all four crib cards + starter).
 *  - Nobs: 1 for a Jack in the hand/crib matching the starter's suit.
 *
 * Ace is low only; Q-K-A is not a run (handled by rankOrder in cards.ts).
 */

import {
  type Card,
  type Rank,
  cardValue,
  rankOrder,
  cardId,
} from './cards.js';

export type ScoreType = 'fifteen' | 'pair' | 'run' | 'flush' | 'nobs';

export interface ScoreEvent {
  readonly type: ScoreType;
  readonly points: number;
  /** Cards that make up this scoring combination, for UI highlighting. */
  readonly cards: Card[];
  /** Short human description, e.g. "fifteen", "pair", "run of 4". */
  readonly description: string;
}

export interface HandScore {
  readonly total: number;
  readonly events: ScoreEvent[];
}

/** All subsets of `arr` of size >= 1, as index lists. Small n only (<= 5). */
function subsets<T>(arr: readonly T[]): T[][] {
  const result: T[][] = [];
  const n = arr.length;
  for (let mask = 1; mask < 1 << n; mask++) {
    const subset: T[] = [];
    for (let i = 0; i < n; i++) {
      if (mask & (1 << i)) subset.push(arr[i]!);
    }
    result.push(subset);
  }
  return result;
}

function scoreFifteens(cards: Card[]): ScoreEvent[] {
  const events: ScoreEvent[] = [];
  for (const subset of subsets(cards)) {
    if (subset.length < 2) continue;
    const sum = subset.reduce((acc, c) => acc + cardValue(c.rank), 0);
    if (sum === 15) {
      events.push({
        type: 'fifteen',
        points: 2,
        cards: subset,
        description: 'fifteen',
      });
    }
  }
  return events;
}

function scorePairs(cards: Card[]): ScoreEvent[] {
  const events: ScoreEvent[] = [];
  for (let i = 0; i < cards.length; i++) {
    for (let j = i + 1; j < cards.length; j++) {
      if (cards[i]!.rank === cards[j]!.rank) {
        events.push({
          type: 'pair',
          points: 2,
          cards: [cards[i]!, cards[j]!],
          description: 'pair',
        });
      }
    }
  }
  return events;
}

/**
 * Runs, counted by combination (double runs, triple runs, double-double runs).
 *
 * Group the cards by rank-order. Walk the distinct ordinals in ascending order
 * and find each maximal consecutive block. A block of >= 3 distinct ranks is a
 * run; the number of distinct runs it produces is the product of the
 * multiplicities of its ranks, and each run scores its length in points.
 */
function scoreRuns(cards: Card[]): ScoreEvent[] {
  const byOrder = new Map<number, Card[]>();
  for (const card of cards) {
    const ord = rankOrder(card.rank);
    const bucket = byOrder.get(ord);
    if (bucket) bucket.push(card);
    else byOrder.set(ord, [card]);
  }

  const ordinals = [...byOrder.keys()].sort((a, b) => a - b);
  const events: ScoreEvent[] = [];

  let i = 0;
  while (i < ordinals.length) {
    // Extend a maximal consecutive block starting at i.
    let j = i;
    while (j + 1 < ordinals.length && ordinals[j + 1]! === ordinals[j]! + 1) {
      j++;
    }
    const blockLen = j - i + 1;
    if (blockLen >= 3) {
      const blockOrdinals = ordinals.slice(i, j + 1);
      const multiplicities = blockOrdinals.map(
        (ord) => byOrder.get(ord)!.length,
      );
      const runCount = multiplicities.reduce((a, b) => a * b, 1);

      // Enumerate each distinct run (one card picked per rank in the block),
      // so the UI can highlight exactly the cards in each run.
      let combos: Card[][] = [[]];
      for (const ord of blockOrdinals) {
        const choices = byOrder.get(ord)!;
        const next: Card[][] = [];
        for (const combo of combos) {
          for (const choice of choices) {
            next.push([...combo, choice]);
          }
        }
        combos = next;
      }
      for (const runCards of combos) {
        events.push({
          type: 'run',
          points: blockLen,
          cards: runCards,
          description: `run of ${blockLen}`,
        });
      }
      // Sanity: combos.length should equal runCount.
      if (combos.length !== runCount) {
        throw new Error('run enumeration mismatch');
      }
    }
    i = j + 1;
  }

  return events;
}

function scoreFlush(
  hand: Card[],
  starter: Card,
  isCrib: boolean,
): ScoreEvent | null {
  if (hand.length !== 4) return null;
  const suit = hand[0]!.suit;
  const allHandSameSuit = hand.every((c) => c.suit === suit);
  if (!allHandSameSuit) return null;

  const starterMatches = starter.suit === suit;

  if (isCrib) {
    // Crib flush counts ONLY at 5 (all four crib cards + starter). 3.6
    if (starterMatches) {
      return {
        type: 'flush',
        points: 5,
        cards: [...hand, starter],
        description: 'flush (5)',
      };
    }
    return null;
  }

  // Hand flush: 4 for four, 5 if the starter matches too.
  if (starterMatches) {
    return {
      type: 'flush',
      points: 5,
      cards: [...hand, starter],
      description: 'flush (5)',
    };
  }
  return {
    type: 'flush',
    points: 4,
    cards: [...hand],
    description: 'flush (4)',
  };
}

function scoreNobs(hand: Card[], starter: Card): ScoreEvent | null {
  // Nobs: a Jack in the HAND/crib whose suit matches the starter. Never the
  // starter itself (REQUIREMENTS 3.6, test in Section 8).
  for (const card of hand) {
    if (card.rank === ('J' satisfies Rank) && card.suit === starter.suit) {
      return {
        type: 'nobs',
        points: 1,
        cards: [card, starter],
        description: 'nobs',
      };
    }
  }
  return null;
}

/**
 * Score a 4-card hand (or crib) with the starter.
 * @param hand the four kept cards (or four crib cards)
 * @param starter the cut card
 * @param isCrib whether `hand` is the crib (changes the flush rule)
 */
export function scoreHand(
  hand: Card[],
  starter: Card,
  isCrib = false,
): HandScore {
  if (hand.length !== 4) {
    throw new Error(`scoreHand expects exactly 4 cards, got ${hand.length}`);
  }
  const all = [...hand, starter];

  const events: ScoreEvent[] = [
    ...scoreFifteens(all),
    ...scorePairs(all),
    ...scoreRuns(all),
  ];
  const flush = scoreFlush(hand, starter, isCrib);
  if (flush) events.push(flush);
  const nobs = scoreNobs(hand, starter);
  if (nobs) events.push(nobs);

  const total = events.reduce((acc, e) => acc + e.points, 0);
  return { total, events };
}

/**
 * A compact one-line breakdown for the show screen / CLI, with a running
 * total, e.g. "15 for 2, 15 for 4, pair for 6, run for 9, nobs for 10".
 */
export function describeScore(score: HandScore): string {
  if (score.events.length === 0) return 'nothing (0)';
  let running = 0;
  const parts: string[] = [];
  const labelFor: Record<ScoreType, string> = {
    fifteen: '15',
    pair: 'pair',
    run: 'run',
    flush: 'flush',
    nobs: 'nobs',
  };
  for (const e of score.events) {
    running += e.points;
    parts.push(`${labelFor[e.type]} for ${running}`);
  }
  return parts.join(', ');
}

/** Just the number; convenient for tests and the grader. */
export function handTotal(hand: Card[], starter: Card, isCrib = false): number {
  return scoreHand(hand, starter, isCrib).total;
}

/** Stable key for a set of cards (order-independent), for memoization. */
export function cardsKey(cards: Card[]): string {
  return cards.map(cardId).sort().join(',');
}
