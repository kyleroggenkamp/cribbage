/**
 * Pegging grading: a one-move look-ahead. REQUIREMENTS 4A.3.
 *
 * For the card a player is about to lay, value every legal card by
 *   net value = points scored immediately
 *             - expected points the next opponent scores in reply,
 * where the reply is averaged over every card the player can't see (weighted
 * equally), assuming the opponent plays that card to score.
 *
 * This is deliberately less exact than discard grading (a single look-ahead);
 * the UI shows pegging and discard results separately so the fuzzy number
 * doesn't blur the exact one.
 *
 * Forced plays (0 or 1 legal card) are NOT graded — gradePegPlay returns null.
 */

import { type Card, cardValue, cardsEqual } from '../cards.js';
import { scorePegCard, canPlay } from '../score-pegging.js';
import { unseenCards } from './combinatorics.js';
import { rankOf, type RankResult } from './rank.js';

export interface PegCandidate {
  readonly card: Card;
  readonly immediate: number;
  readonly expectedReply: number;
  readonly net: number;
}

export interface PegPlayGrade {
  readonly candidates: PegCandidate[];
  readonly best: PegCandidate;
  readonly chosen: PegCandidate;
  readonly pointsLost: number;
  readonly rank: RankResult;
}

export interface PegPlayGradeArgs {
  /** The cards still in the grader's hand (candidates are the legal subset). */
  readonly handRemaining: readonly Card[];
  /** Cards already down in the current series (since the last reset). */
  readonly series: readonly Card[];
  /** Running count before this play. */
  readonly count: number;
  /** Every card this player has seen: their dealt hand, the starter, and every
   *  card laid in the play so far. The opponent's possible cards are the rest. */
  readonly seen: readonly Card[];
  /** The card the player actually laid (must be legal). */
  readonly chosen: Card;
}

/**
 * Grade one pegging play. Returns null for a forced play (not graded, 4A.3.4).
 */
export function gradePegPlay(args: PegPlayGradeArgs): PegPlayGrade | null {
  const { handRemaining, series, count, seen, chosen } = args;

  const legal = handRemaining.filter((c) => canPlay(count, c));
  if (legal.length <= 1) return null; // forced play or no play: not graded

  const unseen = unseenCards(seen);

  const candidates: PegCandidate[] = legal.map((card) => {
    const immediate = scorePegCard([...series], card).points;
    const newSeries = [...series, card];
    const newCount = count + cardValue(card.rank);

    // Expected opponent reply, averaged equally over every unseen card. A card
    // the opponent couldn't legally play contributes a 0 reply (they'd "go").
    let replySum = 0;
    for (const opp of unseen) {
      if (canPlay(newCount, opp)) {
        replySum += scorePegCard(newSeries, opp).points;
      }
    }
    const expectedReply = unseen.length > 0 ? replySum / unseen.length : 0;

    return { card, immediate, expectedReply, net: immediate - expectedReply };
  });

  candidates.sort((a, b) => b.net - a.net);
  const best = candidates[0]!;

  const chosenCandidate = candidates.find((c) => cardsEqual(c.card, chosen));
  if (!chosenCandidate) {
    throw new Error('chosen card is not a legal play from handRemaining');
  }

  const pointsLost = Math.max(0, best.net - chosenCandidate.net);
  const rank = rankOf(
    chosenCandidate.net,
    candidates.map((c) => c.net),
  );

  return { candidates, best, chosen: chosenCandidate, pointsLost, rank };
}
