/**
 * Discard grading. REQUIREMENTS 4A.2.
 *
 * For a dealt hand, enumerate every legal discard, value each one
 * (expected hand value ± expected crib value), find the best, and report how
 * many points the chosen throw gave away and where it ranks.
 */

import { type Card, cardsEqual } from '../cards.js';
import { type PlayerCount, DEAL_CONFIG } from '../deal.js';
import { CRIB_SIM_ITERATIONS } from './config.js';
import { combinations } from './combinatorics.js';
import { expectedHandValue } from './expected-hand.js';
import { expectedCribValue } from './crib-estimate.js';
import { rankOf, type RankResult } from './rank.js';

export interface DiscardOption {
  /** The cards thrown to the crib. */
  readonly discard: Card[];
  /** The 4 cards kept. */
  readonly keep: Card[];
  /** Exact expected hand value over all unseen starters. */
  readonly expectedHand: number;
  /** Simulated expected crib score (always >= 0). */
  readonly expectedCrib: number;
  /** expectedHand + expectedCrib (own crib) or - (opponent's crib). */
  readonly value: number;
}

export interface DiscardGrade {
  /** Every legal option, sorted best (highest value) to worst. */
  readonly options: DiscardOption[];
  readonly best: DiscardOption;
  readonly chosen: DiscardOption;
  /** best.value - chosen.value, never negative (4A.2 step 5). */
  readonly pointsLost: number;
  readonly rank: RankResult;
}

export interface DiscardGradeArgs {
  readonly playerCount: PlayerCount;
  /** All cards dealt to the player (6 in 2-player, 5 in 3/4-player). */
  readonly dealt: readonly Card[];
  /** The cards the player actually threw. */
  readonly chosenDiscard: readonly Card[];
  /** True if the crib belongs to this player (or their team). */
  readonly cribIsMine: boolean;
  /** Deterministic seed: game id + hand number. */
  readonly seed: string;
  readonly cribSimIterations?: number;
}

function sameCardSet(a: readonly Card[], b: readonly Card[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((card) => b.some((o) => cardsEqual(card, o)));
}

export function gradeDiscard(args: DiscardGradeArgs): DiscardGrade {
  const {
    playerCount,
    dealt,
    chosenDiscard,
    cribIsMine,
    seed,
    cribSimIterations = CRIB_SIM_ITERATIONS,
  } = args;
  const cfg = DEAL_CONFIG[playerCount];

  if (dealt.length !== cfg.dealtEach) {
    throw new Error(
      `${playerCount}-player is dealt ${cfg.dealtEach}, got ${dealt.length}`,
    );
  }
  if (chosenDiscard.length !== cfg.discardsEach) {
    throw new Error(
      `${playerCount}-player throws ${cfg.discardsEach}, got ${chosenDiscard.length}`,
    );
  }

  const cribSign = cribIsMine ? 1 : -1;

  const options: DiscardOption[] = combinations(dealt, cfg.discardsEach).map(
    (discard) => {
      const keep = dealt.filter((card) => !discard.some((d) => cardsEqual(d, card)));
      const expectedHand = expectedHandValue(keep, dealt);
      const expectedCrib = expectedCribValue({
        playerCount,
        thrown: discard,
        dealt,
        seed,
        iterations: cribSimIterations,
      });
      const value = expectedHand + cribSign * expectedCrib;
      return { discard, keep, expectedHand, expectedCrib, value };
    },
  );

  options.sort((a, b) => b.value - a.value);
  const best = options[0]!;

  const chosen = options.find((o) => sameCardSet(o.discard, chosenDiscard));
  if (!chosen) {
    throw new Error('chosenDiscard is not a legal discard from the dealt cards');
  }

  const pointsLost = Math.max(0, best.value - chosen.value);
  const rank = rankOf(
    chosen.value,
    options.map((o) => o.value),
  );

  return { options, best, chosen, pointsLost, rank };
}
