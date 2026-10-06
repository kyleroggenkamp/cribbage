/**
 * Dealing and the starter cut. REQUIREMENTS 3.2-3.4.
 *
 * Deal table (the crib always ends at 4 cards):
 *   Players | dealt each | extra to crib | discards each | hand after discard
 *      2    |     6      |      0        |      2         |        4
 *      3    |     5      |      1        |      1         |        4
 *      4    |     5      |      0        |      1         |        4
 */

import { type Card } from './cards.js';

export type PlayerCount = 2 | 3 | 4;

export interface DealConfig {
  readonly dealtEach: number;
  readonly extraToCrib: number;
  readonly discardsEach: number;
  readonly handSizeAfterDiscard: number;
}

export const DEAL_CONFIG: Record<PlayerCount, DealConfig> = {
  2: { dealtEach: 6, extraToCrib: 0, discardsEach: 2, handSizeAfterDiscard: 4 },
  3: { dealtEach: 5, extraToCrib: 1, discardsEach: 1, handSizeAfterDiscard: 4 },
  4: { dealtEach: 5, extraToCrib: 0, discardsEach: 1, handSizeAfterDiscard: 4 },
};

export interface DealResult {
  /** One array per player, in seat order starting from the dealer's left. */
  readonly hands: Card[][];
  /** Cards dealt directly into the crib (3-player only), else empty. */
  readonly cribSeed: Card[];
  /** The rest of the deck, from which the starter is cut. */
  readonly stock: Card[];
}

/**
 * Deal `playerCount` hands from an already-shuffled deck.
 *
 * The deck must be shuffled by the caller (server) with a crypto source.
 * This function is pure: it only slices the deck, so it is deterministic and
 * testable. It does NOT decide dealer rotation — the caller orders `hands`.
 */
export function dealHands(
  playerCount: PlayerCount,
  shuffledDeck: readonly Card[],
): DealResult {
  const cfg = DEAL_CONFIG[playerCount];
  const needed = cfg.dealtEach * playerCount + cfg.extraToCrib;
  if (shuffledDeck.length < needed + 1) {
    throw new Error(
      `Deck too small: need ${needed} dealt + 1 starter, have ${shuffledDeck.length}`,
    );
  }

  const hands: Card[][] = Array.from({ length: playerCount }, () => []);
  let idx = 0;

  // Deal one card at a time, round-robin, as at a real table.
  for (let round = 0; round < cfg.dealtEach; round++) {
    for (let seat = 0; seat < playerCount; seat++) {
      hands[seat]!.push(shuffledDeck[idx++]!);
    }
  }

  const cribSeed: Card[] = [];
  for (let k = 0; k < cfg.extraToCrib; k++) {
    cribSeed.push(shuffledDeck[idx++]!);
  }

  const stock = shuffledDeck.slice(idx);
  return { hands, cribSeed, stock };
}

/**
 * The starter is the top card of the remaining stock after the cut.
 * (The physical "cut by the player to the dealer's right" doesn't change which
 * card is modeled as the top of the stock in online play.)
 */
export function cutStarter(stock: readonly Card[]): Card {
  const starter = stock[0];
  if (!starter) throw new Error('No cards left to cut a starter from');
  return starter;
}

/**
 * "His heels": if the starter is a Jack, the dealer pegs 2 immediately.
 * This can win the game (REQUIREMENTS 3.4). Returns points for the dealer.
 */
export function hisHeels(starter: Card): number {
  return starter.rank === 'J' ? 2 : 0;
}
