/**
 * Camp bot pegging. REQUIREMENTS Section 4 (Easy level, v1).
 *
 * "Use the same pegging evaluator as the play grader (4A.3) and pick its best
 * card." For a forced play (one legal card) there is nothing to evaluate, so
 * the bot just plays it; the engine handles automatic "Go".
 */

import { type Card } from '../cards.js';
import { canPlay } from '../score-pegging.js';
import { gradePegPlay } from '../grader/pegging.js';
import { type CardChooser } from '../play.js';

export interface BotPegArgs {
  /** The bot's remaining cards. */
  readonly handRemaining: readonly Card[];
  /** The current series (since the last reset) and running count. */
  readonly series: readonly Card[];
  readonly count: number;
  /** Everything the bot has seen: its dealt hand, the starter, cards played. */
  readonly seen: readonly Card[];
}

/**
 * The bot's card choice, or null if it has no legal play (an automatic "Go").
 */
export function botPegChoice(args: BotPegArgs): Card | null {
  const legal = args.handRemaining.filter((c) => canPlay(args.count, c));
  if (legal.length === 0) return null;
  if (legal.length === 1) return legal[0]!; // forced; the evaluator would skip it

  const grade = gradePegPlay({
    handRemaining: args.handRemaining,
    series: args.series,
    count: args.count,
    seen: args.seen,
    chosen: legal[0]!, // placeholder; we only read .best
  });
  // grade is non-null because there are >= 2 legal cards.
  return grade!.best.card;
}

/**
 * Build a CardChooser for playPegging that drives a camp bot. The caller
 * supplies the bot's full dealt hand and the starter; the chooser derives the
 * unseen pool from those plus the play history the engine passes in.
 */
export function makeBotChooser(opts: {
  dealtHand: readonly Card[];
  starter: Card;
}): CardChooser {
  return (ctx) => {
    const seen = [...opts.dealtHand, opts.starter, ...ctx.played];
    const choice = botPegChoice({
      handRemaining: ctx.hand,
      series: ctx.series,
      count: ctx.count,
      seen,
    });
    // The engine only calls a chooser when at least one legal card exists.
    return choice ?? ctx.legal[0]!;
  };
}
