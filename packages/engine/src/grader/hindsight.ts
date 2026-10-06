/**
 * Hindsight ("Coulda, shoulda, woulda"). REQUIREMENTS 4A.8.
 *
 * After the starter is cut, show what each player's hand WOULD have scored with
 * every other discard, next to what they actually got. This is exact (no
 * simulation) and is ENTERTAINMENT ONLY: it never feeds grades, ranks, skill,
 * or awards. Nothing here mutates or reads grader output.
 */

import { type Card, cardsEqual } from '../cards.js';
import { type PlayerCount, DEAL_CONFIG } from '../deal.js';
import { handTotal, scoreHand } from '../score-hand.js';
import { combinations } from './combinatorics.js';
import { CUT_FAVORED_TOLERANCE } from './config.js';

export interface HindsightOption {
  readonly discard: Card[];
  readonly keep: Card[];
  /** Kept-hand score with the real starter (and crib effect, in the recap). */
  readonly value: number;
}

export interface Hindsight {
  readonly options: HindsightOption[];
  readonly best: HindsightOption;
  readonly actual: HindsightOption;
  /** best.value - actual.value (>= 0). */
  readonly spread: number;
}

function keepFor(dealt: readonly Card[], discard: readonly Card[]): Card[] {
  return dealt.filter((card) => !discard.some((d) => cardsEqual(d, card)));
}

function sameSet(a: readonly Card[], b: readonly Card[]): boolean {
  return a.length === b.length && a.every((x) => b.some((y) => cardsEqual(x, y)));
}

function build(dealt: readonly Card[], chosenDiscard: readonly Card[], options: HindsightOption[]): Hindsight {
  const sorted = [...options].sort((a, b) => b.value - a.value);
  const best = sorted[0]!;
  const actual = options.find((o) => sameSet(o.discard, chosenDiscard));
  if (!actual) throw new Error('chosenDiscard is not legal for these dealt cards');
  return { options: sorted, best, actual, spread: best.value - actual.value };
}

/**
 * At the cut (private, on the player's own phone): kept-hand points only, since
 * the crib isn't known yet (4A.8 moment 1).
 */
export function hindsightAtCut(args: {
  playerCount: PlayerCount;
  dealt: readonly Card[];
  chosenDiscard: readonly Card[];
  starter: Card;
}): Hindsight {
  const cfg = DEAL_CONFIG[args.playerCount];
  const options: HindsightOption[] = combinations(args.dealt, cfg.discardsEach).map(
    (discard) => {
      const keep = keepFor(args.dealt, discard);
      return { discard, keep, value: handTotal(keep, args.starter, false) };
    },
  );
  return build(args.dealt, args.chosenDiscard, options);
}

/**
 * In the hand recap (public): full hand + crib numbers (4A.8 moment 2). Each
 * option's exact crib effect is added (+ if the crib is the player's own, - for
 * an opponent's). The "other" crib cards are the actual crib minus the player's
 * actual throw, so a hypothetical throw swaps only the player's own cards.
 */
export function hindsightInRecap(args: {
  playerCount: PlayerCount;
  dealt: readonly Card[];
  chosenDiscard: readonly Card[];
  starter: Card;
  /** The actual 4-card crib (known after the show). */
  actualCrib: readonly Card[];
  cribIsMine: boolean;
}): Hindsight {
  const cfg = DEAL_CONFIG[args.playerCount];
  const cribSign = args.cribIsMine ? 1 : -1;

  // The crib cards contributed by everyone else = actual crib minus my throw.
  const otherCribCards = args.actualCrib.filter(
    (card) => !args.chosenDiscard.some((d) => cardsEqual(d, card)),
  );

  const options: HindsightOption[] = combinations(args.dealt, cfg.discardsEach).map(
    (discard) => {
      const keep = keepFor(args.dealt, discard);
      const keptScore = handTotal(keep, args.starter, false);
      const hypoCrib = [...discard, ...otherCribCards];
      const cribScore = scoreHand(hypoCrib, args.starter, true).total;
      return { discard, keep, value: keptScore + cribSign * cribScore };
    },
  );
  return build(args.dealt, args.chosenDiscard, options);
}

export type VerdictTag =
  | 'called-it'
  | 'right-call-wrong-cut'
  | 'blind-squirrel'
  | 'coulda-shoulda-woulda';

export interface Verdict {
  readonly tag: VerdictTag;
  readonly text: string;
}

/** Did the cut favor the actual throw? Best hindsight, or within tolerance. */
export function cutFavored(
  hindsight: Hindsight,
  tolerance = CUT_FAVORED_TOLERANCE,
): boolean {
  return hindsight.spread <= tolerance;
}

/**
 * The verdict tag (4A.8), combining the grader (was it the right throw — discard
 * rank 1 or tied) with hindsight (did the cut favor it).
 */
export function verdict(rightThrow: boolean, cutDidFavor: boolean): Verdict {
  if (rightThrow && cutDidFavor) {
    return { tag: 'called-it', text: 'Called it' };
  }
  if (rightThrow && !cutDidFavor) {
    return { tag: 'right-call-wrong-cut', text: 'Right call, wrong cut' };
  }
  if (!rightThrow && cutDidFavor) {
    return { tag: 'blind-squirrel', text: 'Blind squirrel' };
  }
  return { tag: 'coulda-shoulda-woulda', text: 'Coulda shoulda woulda' };
}

/** Index/indices of the biggest hindsight spread at the table (ties). */
export function couldaShouldaCallout(spreads: readonly number[]): number[] {
  if (spreads.length === 0) return [];
  const max = Math.max(...spreads);
  const out: number[] = [];
  spreads.forEach((s, i) => {
    if (s === max) out.push(i);
  });
  return out;
}
