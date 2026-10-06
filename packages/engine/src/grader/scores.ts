/**
 * Aggregating grades into per-hand and per-game numbers, and the stand rank.
 * REQUIREMENTS 4A.4.
 *
 * Discard and pegging points lost are tracked separately (so the exact and the
 * fuzzy numbers don't blur, 4A.3.4) and summed for the hand/game totals.
 */

import { STAND_RANK_BANDS, type StandRankBand } from './config.js';
import { extremesIndices } from './util.js';

export interface HandPointsLost {
  readonly discard: number;
  readonly pegging: number;
  readonly total: number;
}

export function handPointsLost(discard: number, pegging: number): HandPointsLost {
  return { discard, pegging, total: discard + pegging };
}

export interface PlayerGameGrade {
  readonly discardLost: number;
  readonly peggingLost: number;
  readonly totalLost: number;
  readonly handsGraded: number;
  /** Average total points lost per hand (0 if no hands graded). */
  readonly avgLost: number;
  readonly band: StandRankBand;
}

/** The stand-rank band for an average-points-lost-per-hand figure (4A.4). */
export function standRankBand(avgLost: number): StandRankBand {
  for (const band of STAND_RANK_BANDS) {
    if (avgLost <= band.maxAvgLost) return band;
  }
  // STAND_RANK_BANDS ends with Infinity, so this is unreachable; satisfy types.
  return STAND_RANK_BANDS[STAND_RANK_BANDS.length - 1]!;
}

/** Summarize one player's hands into a game grade. */
export function summarizePlayerGame(
  hands: readonly HandPointsLost[],
): PlayerGameGrade {
  const discardLost = hands.reduce((a, h) => a + h.discard, 0);
  const peggingLost = hands.reduce((a, h) => a + h.pegging, 0);
  const totalLost = discardLost + peggingLost;
  const handsGraded = hands.length;
  const avgLost = handsGraded > 0 ? totalLost / handsGraded : 0;
  return {
    discardLost,
    peggingLost,
    totalLost,
    handsGraded,
    avgLost,
    band: standRankBand(avgLost),
  };
}

/**
 * Indices of the player(s) with the most total points lost in the game — the
 * "Button Buck of the Game" award. Ties return every tied index (4A.4).
 */
export function buttonBuckOfGame(totalsLost: readonly number[]): number[] {
  return extremesIndices(totalsLost, Math.max);
}
