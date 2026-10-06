/**
 * Ranking with ties, shared by discard grading and pegging grading.
 * REQUIREMENTS 4A.2 step 6, 4A.3 step 3.
 *
 * Options within TIE_EPSILON of a higher value share that rank, so a player is
 * never marked down for a statistical tie.
 */

import { TIE_EPSILON } from './config.js';

export interface Ranked<T> {
  readonly item: T;
  readonly value: number;
  /** 1-based position, ties sharing the lower number. */
  readonly position: number;
}

export interface RankResult {
  /** 1-based rank of the chosen item (ties share). */
  readonly position: number;
  /** Total number of options. */
  readonly total: number;
}

/**
 * Rank `items` by `valueOf` (higher is better). An item ranks at
 * 1 + (how many items beat it by more than TIE_EPSILON).
 */
export function rankByValue<T>(
  items: readonly T[],
  valueOf: (item: T) => number,
  epsilon = TIE_EPSILON,
): Ranked<T>[] {
  const valued = items.map((item) => ({ item, value: valueOf(item) }));
  return valued
    .map(({ item, value }) => {
      const position =
        1 + valued.filter((o) => o.value - value > epsilon).length;
      return { item, value, position };
    })
    .sort((a, b) => b.value - a.value);
}

/** Where does the chosen value fall among all values? */
export function rankOf(
  chosenValue: number,
  allValues: readonly number[],
  epsilon = TIE_EPSILON,
): RankResult {
  const position =
    1 + allValues.filter((v) => v - chosenValue > epsilon).length;
  return { position, total: allValues.length };
}

const ORDINAL_SUFFIX = ['th', 'st', 'nd', 'rd'];

/** 1 -> "1st", 2 -> "2nd", 3 -> "3rd", 11 -> "11th", etc. */
export function ordinal(n: number): string {
  const rem100 = n % 100;
  if (rem100 >= 11 && rem100 <= 13) return `${n}th`;
  return `${n}${ORDINAL_SUFFIX[n % 10] ?? 'th'}`;
}

/**
 * Plain, theme-neutral phrasing of a discard rank (4A.5). The themed wording
 * ("Best possible throw", etc.) wraps this in Phase 2 via the theme vocabulary.
 *
 *  position 1          -> "best of N"
 *  position N          -> "worst of N"
 *  top half            -> "2nd best of N", "3rd best of N", ...
 *  bottom half         -> "3rd worst of N", "2nd worst of N", ...
 */
export function rankPhrase(rank: RankResult): string {
  const { position, total } = rank;
  if (total <= 1) return 'only option';
  if (position === 1) return `best of ${total}`;
  if (position === total) return `worst of ${total}`;
  if (position <= total / 2) {
    return `${ordinal(position)} best of ${total}`;
  }
  return `${ordinal(total - position + 1)} worst of ${total}`;
}
