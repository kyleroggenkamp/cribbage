/** Small combinatorics helpers for the grader (n is always tiny: <= 6). */

import { type Card, makeDeck, cardsEqual } from '../cards.js';

/** All size-k combinations of `arr`, as arrays of elements (order preserved). */
export function combinations<T>(arr: readonly T[], k: number): T[][] {
  const result: T[][] = [];
  const n = arr.length;
  if (k < 0 || k > n) return result;

  const idx = Array.from({ length: k }, (_, i) => i);
  while (true) {
    result.push(idx.map((i) => arr[i]!));
    // Advance the odometer from the right.
    let i = k - 1;
    while (i >= 0 && idx[i]! === n - k + i) i--;
    if (i < 0) break;
    idx[i]!++;
    for (let j = i + 1; j < k; j++) idx[j] = idx[j - 1]! + 1;
  }
  return result;
}

/** The 52 cards minus a set of seen cards — the pool the player can't see. */
export function unseenCards(seen: readonly Card[]): Card[] {
  return makeDeck().filter((card) => !seen.some((s) => cardsEqual(s, card)));
}
