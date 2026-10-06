/**
 * The standard pegging policy and a pegging replay. REQUIREMENTS 4A.7.1-4A.7.2.
 *
 * The policy must be DETERMINISTIC so a replay gives the same result every time
 * for the same hands. 4A.7.1 describes it as "the pegging evaluator's choice
 * (4A.3), with ties broken by a fixed rule".
 *
 * v1 simplification: the full one-move-look-ahead evaluator needs each seat's
 * hidden-information view, which would make the 100k-deal baselines in 4A.7.3
 * impractically slow to generate. Since the baseline and the zero-mean luck
 * property hold for ANY deterministic policy, v1 uses an immediate-points
 * maximiser with a fixed tie-break. This is consistent with 4A.3.4's note that
 * rough pegging is acceptable for v1, and it can be upgraded to the full
 * evaluator later without changing the luck math. Flagged in the README.
 */

import { type Card, cardValue, rankOrder, SUITS } from '../cards.js';
import { scorePegCard } from '../score-pegging.js';
import { playPegging, type CardChooser } from '../play.js';
import { type PlayerCount } from '../deal.js';
import { seatUnitMap } from '../show.js';

function suitIndex(card: Card): number {
  return SUITS.indexOf(card.suit);
}

/**
 * Deterministic standard policy: maximise the points scored by this card now;
 * break ties by lowest card value, then rank order, then suit order.
 */
export const standardPeggingChooser: CardChooser = (ctx) => {
  let best = ctx.legal[0]!;
  let bestPoints = scorePegCard([...ctx.series], best).points;

  for (let i = 1; i < ctx.legal.length; i++) {
    const card = ctx.legal[i]!;
    const points = scorePegCard([...ctx.series], card).points;
    if (points > bestPoints) {
      best = card;
      bestPoints = points;
      continue;
    }
    if (points === bestPoints) {
      // Fixed tie-break.
      const a = card;
      const b = best;
      const byValue = cardValue(a.rank) - cardValue(b.rank);
      const byRank = rankOrder(a.rank) - rankOrder(b.rank);
      const bySuit = suitIndex(a) - suitIndex(b);
      if (byValue < 0 || (byValue === 0 && byRank < 0) || (byValue === 0 && byRank === 0 && bySuit < 0)) {
        best = card;
      }
    }
  }
  return best;
};

export interface ReplayResult {
  /** Pegging points per seat under the standard policy. */
  readonly perSeat: number[];
  /** Pegging points per scoring unit (team in 4-player). */
  readonly perUnit: number[];
}

/**
 * Replay a hand's pegging with everyone using the standard policy.
 * @param keptHands the 4 kept cards per seat, in seat order
 * @param dealerSeat the dealer (the seat to its left leads)
 */
export function replayPegging(
  keptHands: readonly Card[][],
  dealerSeat: number,
  playerCount: PlayerCount,
): ReplayResult {
  const leadSeat = (dealerSeat + 1) % playerCount;
  const { pegPoints } = playPegging(keptHands, leadSeat, standardPeggingChooser);

  const unitMap = seatUnitMap(playerCount);
  const unitCount = Math.max(...unitMap) + 1;
  const perUnit = new Array<number>(unitCount).fill(0);
  pegPoints.forEach((pts, seat) => {
    perUnit[unitMap[seat]!]! += pts;
  });

  return { perSeat: pegPoints, perUnit };
};
