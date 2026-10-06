/**
 * Luck vs. skill. REQUIREMENTS 4A.7.
 *
 * Luck separates what the cards did for a player from what they did with them.
 * All four components are computed after the show (they need the real starter
 * and crib). Skill is just the negative of points given away (4A.2-4A.3).
 *
 * Baselines (deal luck, pegging luck) are injected so the math is testable and
 * the shipped numbers can be regenerated (see scripts/generate-baselines.ts).
 */

import { type Card } from '../cards.js';
import { scoreHand, handTotal } from '../score-hand.js';
import { type PlayerCount } from '../deal.js';
import { expectedHandValue } from './expected-hand.js';
import {
  type BaselineSet,
  type Side,
  caseKey,
} from './baseline-cases.js';
import { WINNER_HEADLINE } from './config.js';

/** Cut luck: the kept hand's actual score vs. its expected score (4A.7). */
export function cutLuck(
  keep: readonly Card[],
  starter: Card,
  dealt: readonly Card[],
): number {
  return handTotal([...keep], starter, false) - expectedHandValue(keep, dealt);
}

/** Crib luck: the crib's actual score vs. the grader's crib estimate (4A.7). */
export function cribLuck(
  crib: readonly Card[],
  starter: Card,
  expectedCrib: number,
): number {
  return scoreHand([...crib], starter, true).total - expectedCrib;
}

/** Deal luck: best discard value available vs. the baseline for the case. */
export function dealLuck(
  bestDiscardValue: number,
  playerCount: PlayerCount,
  side: Side,
  baselines: BaselineSet,
): number {
  return bestDiscardValue - baselines.dealLuck[caseKey(playerCount, side)];
}

/** Pegging luck: replay pegging (this unit's points) vs. the case baseline. */
export function peggingLuck(
  expectedPeggingUnit: number,
  playerCount: PlayerCount,
  side: Side,
  baselines: BaselineSet,
): number {
  return (
    expectedPeggingUnit - baselines.peggingLuck[caseKey(playerCount, side)]
  );
}

export interface HandLuck {
  readonly deal: number;
  readonly cut: number;
  readonly crib: number;
  readonly pegging: number;
  readonly total: number;
}

export interface HandLuckArgs {
  readonly playerCount: PlayerCount;
  /** The player's side this hand (dealer vs non-dealer / dealer's team). */
  readonly side: Side;
  readonly dealt: readonly Card[];
  readonly keep: readonly Card[];
  readonly starter: Card;
  /** gradeDiscard(...).best.value for this player's dealt cards. */
  readonly bestDiscardValue: number;
  /** The replay's pegging points for this player's scoring unit. */
  readonly expectedPeggingUnit: number;
  /** Set only on the dealer's side: the actual crib and its grader estimate. */
  readonly crib?: readonly Card[];
  readonly expectedCrib?: number;
  readonly baselines: BaselineSet;
}

/** Compute all four luck components (and the total) for one player's hand. */
export function computeHandLuck(args: HandLuckArgs): HandLuck {
  const deal = dealLuck(args.bestDiscardValue, args.playerCount, args.side, args.baselines);
  const cut = cutLuck(args.keep, args.starter, args.dealt);
  const crib =
    args.side === 'dealer' && args.crib
      ? cribLuck(args.crib, args.starter, args.expectedCrib ?? 0)
      : 0;
  const pegging = peggingLuck(
    args.expectedPeggingUnit,
    args.playerCount,
    args.side,
    args.baselines,
  );
  return { deal, cut, crib, pegging, total: deal + cut + crib + pegging };
}

/** Skill is the negative of total points given away (4A.7). */
export function skill(totalPointsGivenAway: number): number {
  return -totalPointsGivenAway;
}

export type WinnerHeadlineKey = 'won-on-cards' | 'won-on-play' | 'earned-it';

export interface WinnerHeadline {
  readonly key: WinnerHeadlineKey;
  readonly text: string;
}

/**
 * The winner's game-over headline (4A.7). `luck` is the winner's total luck;
 * `skillLoss` is the winner's points given away (a non-negative number).
 */
export function winnerHeadline(
  luck: number,
  skillLoss: number,
): WinnerHeadline {
  if (luck - skillLoss >= WINNER_HEADLINE.luckOverSkillLoss) {
    return { key: 'won-on-cards', text: 'Won on cards.' };
  }
  if (
    skillLoss <= WINNER_HEADLINE.smallSkillLoss &&
    luck <= WINNER_HEADLINE.luckNearZero
  ) {
    return { key: 'won-on-play', text: 'Won on play.' };
  }
  return { key: 'earned-it', text: 'Earned it with a little help.' };
}

export interface ExcuseLineArgs {
  /** How many points the loser lost by (winner final - loser final), > 0. */
  readonly margin: number;
  readonly loserLuck: number;
  readonly winnerLuck: number;
  /** Points given away (non-negative) by each. */
  readonly loserSkillLoss: number;
  readonly winnerSkillLoss: number;
  /** Winner's display name for the sentence. */
  readonly winnerName: string;
}

/**
 * The loser's excuse line (4A.7). Returns null unless it makes the loser's
 * case — worse cards, better play, or both. Rounded to one decimal.
 */
export function excuseLine(args: ExcuseLineArgs): string | null {
  const cardsWorseBy = args.winnerLuck - args.loserLuck; // > 0 => loser had worse cards
  const gaveAwayFewerBy = args.winnerSkillLoss - args.loserSkillLoss; // > 0 => loser played better

  const worseCards = cardsWorseBy > 0;
  const betterPlay = gaveAwayFewerBy > 0;
  if (!worseCards && !betterPlay) return null;

  const parts: string[] = [`Lost by ${round1(args.margin)}.`];
  if (worseCards) {
    parts.push(
      `Your cards were ${round1(cardsWorseBy)} points worse than ${args.winnerName}'s.`,
    );
  }
  if (betterPlay) {
    parts.push(`You gave away ${round1(gaveAwayFewerBy)} fewer points.`);
  }
  return parts.join(' ');
}

/** Indices of the luckiest ("Horseshoe") players — ties included (4A.7). */
export function luckiest(totalLucks: readonly number[]): number[] {
  return extremes(totalLucks, Math.max);
}

/** Indices of the unluckiest ("Hard-luck hunter") players — ties (4A.7). */
export function unluckiest(totalLucks: readonly number[]): number[] {
  return extremes(totalLucks, Math.min);
}

function extremes(
  values: readonly number[],
  pick: (...n: number[]) => number,
): number[] {
  if (values.length === 0) return [];
  const target = pick(...values);
  const out: number[] = [];
  values.forEach((v, i) => {
    if (v === target) out.push(i);
  });
  return out;
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

/** Format a luck/skill number with a sign and one decimal, e.g. "+4.2". */
export function fmtSigned(n: number): string {
  const r = round1(n);
  // Avoid "-0.0".
  const safe = Object.is(r, -0) ? 0 : r;
  const sign = safe >= 0 ? '+' : '-';
  return `${sign}${Math.abs(safe).toFixed(1)}`;
}
