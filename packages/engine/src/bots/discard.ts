/**
 * Camp bot discard. REQUIREMENTS Section 4 (Easy level, v1).
 *
 * "Use the same discard evaluator as the play grader (4A.2) and pick the
 * discard with the highest expected value."
 */

import { type Card } from '../cards.js';
import { type PlayerCount } from '../deal.js';
import { bestDiscardOption } from '../grader/discard.js';

export interface BotDiscardArgs {
  readonly playerCount: PlayerCount;
  /** The cards dealt to the bot. */
  readonly dealt: readonly Card[];
  /** True if the crib belongs to the bot (or its team). */
  readonly cribIsMine: boolean;
  /** Deterministic seed: game id + hand number. */
  readonly seed: string;
  readonly cribSimIterations?: number;
}

/** The cards the bot throws to the crib (the highest-value discard). */
export function botDiscard(args: BotDiscardArgs): Card[] {
  return bestDiscardOption(args).discard;
}
