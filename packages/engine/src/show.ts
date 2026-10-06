/**
 * The show: counting hands in strict order and detecting a win the moment the
 * target is reached. REQUIREMENTS 3.6-3.7.
 *
 * Count order: starting with the player to the dealer's left, clockwise, the
 * dealer's hand LAST, then the crib (which belongs to the dealer / dealer's
 * team). Because of this order the non-dealer can "count out" and win before
 * the dealer ever counts.
 *
 * Scoring is by "unit": a unit is a single player in 2- and 3-player, and a
 * team in 4-player (partners sit opposite). `seatUnit[seat]` gives the unit a
 * seat scores into.
 */

import { type Card } from './cards.js';
import { scoreHand, type HandScore } from './score-hand.js';
import { type PlayerCount } from './deal.js';

export interface ShowStep {
  /** The seat whose hand was counted, or 'crib' for the crib. */
  readonly source: number | 'crib';
  /** The scoring unit (player or team) that received the points. */
  readonly unit: number;
  readonly score: HandScore;
  readonly unitScoreBefore: number;
  readonly unitScoreAfter: number;
  /** True if this step reached the target and ended the game. */
  readonly won: boolean;
}

export interface ShowResult {
  readonly steps: ShowStep[];
  /** The winning unit index, or null if nobody reached the target. */
  readonly winner: number | null;
}

/** Map each seat to its scoring unit. 4-player pairs opposite seats. */
export function seatUnitMap(playerCount: PlayerCount): number[] {
  if (playerCount === 4) return [0, 1, 0, 1];
  return Array.from({ length: playerCount }, (_, i) => i);
}

/** The count order of seats: dealer's left first, dealer last. */
export function countOrder(
  playerCount: PlayerCount,
  dealerSeat: number,
): number[] {
  const order: number[] = [];
  for (let step = 1; step <= playerCount; step++) {
    order.push((dealerSeat + step) % playerCount);
  }
  return order;
}

export interface CountShowArgs {
  readonly playerCount: PlayerCount;
  /** One hand (4 cards) per seat, in seat order. */
  readonly hands: readonly Card[][];
  readonly crib: readonly Card[];
  readonly starter: Card;
  readonly dealerSeat: number;
  /** Current score per unit, before the show. */
  readonly unitScoresBefore: readonly number[];
  readonly target: number;
}

/**
 * Count the show in order, stopping the instant a unit reaches the target.
 */
export function countShow(args: CountShowArgs): ShowResult {
  const {
    playerCount,
    hands,
    crib,
    starter,
    dealerSeat,
    unitScoresBefore,
    target,
  } = args;

  const seatUnit = seatUnitMap(playerCount);
  const scores = [...unitScoresBefore];
  const steps: ShowStep[] = [];
  let winner: number | null = null;

  const applyStep = (
    source: number | 'crib',
    unit: number,
    score: HandScore,
  ): boolean => {
    const before = scores[unit]!;
    const after = before + score.total;
    scores[unit] = after;
    const won = after >= target;
    steps.push({
      source,
      unit,
      score,
      unitScoreBefore: before,
      unitScoreAfter: after,
      won,
    });
    if (won) {
      winner = unit;
      return true;
    }
    return false;
  };

  for (const seat of countOrder(playerCount, dealerSeat)) {
    const unit = seatUnit[seat]!;
    const score = scoreHand([...hands[seat]!], starter, false);
    if (applyStep(seat, unit, score)) return { steps, winner };
  }

  // The crib counts last, into the dealer's unit.
  const dealerUnit = seatUnit[dealerSeat]!;
  const cribScore = scoreHand([...crib], starter, true);
  applyStep('crib', dealerUnit, cribScore);

  return { steps, winner };
}
