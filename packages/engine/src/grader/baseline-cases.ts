/**
 * The "cases" luck baselines are keyed by (REQUIREMENTS 4A.7):
 * player count × side (dealer vs non-dealer; in 4-player, dealer's team vs the
 * other team).
 */

import { type PlayerCount } from '../deal.js';
import { seatUnitMap } from '../show.js';

export type Side = 'dealer' | 'nondealer';
export type BaselineCaseKey =
  | '2p-dealer'
  | '2p-nondealer'
  | '3p-dealer'
  | '3p-nondealer'
  | '4p-dealer'
  | '4p-nondealer';

export function caseKey(playerCount: PlayerCount, side: Side): BaselineCaseKey {
  return `${playerCount}p-${side}` as BaselineCaseKey;
}

/** All six case keys. */
export const ALL_CASES: BaselineCaseKey[] = [
  '2p-dealer',
  '2p-nondealer',
  '3p-dealer',
  '3p-nondealer',
  '4p-dealer',
  '4p-nondealer',
];

/** Is this seat on the dealer's side (same scoring unit as the dealer)? */
export function sideOfSeat(
  playerCount: PlayerCount,
  seat: number,
  dealerSeat: number,
): Side {
  const unit = seatUnitMap(playerCount);
  return unit[seat] === unit[dealerSeat] ? 'dealer' : 'nondealer';
}

/** Metadata recorded with a generated baseline set, for version stamps. */
export interface BaselineMeta {
  readonly generatedAt: string;
  readonly dealLuckSamples: number;
  readonly peggingSamples: number;
  readonly cribIterations: number;
}

export interface BaselineSet {
  readonly meta: BaselineMeta;
  /** Average best-discard value per case (deal-luck baseline). */
  readonly dealLuck: Record<BaselineCaseKey, number>;
  /** Average standard-policy pegging points per unit per case. */
  readonly peggingLuck: Record<BaselineCaseKey, number>;
}
