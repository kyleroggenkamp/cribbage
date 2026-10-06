/**
 * Expected hand value: the exact average score of 4 kept cards over every
 * possible starter the player can't see. REQUIREMENTS 4A.2 step 2.
 *
 * "Can't see" = the whole deck minus every card the player was dealt (which
 * includes the cards they discarded — they saw those too). So the starter pool
 * is 46 cards in 2-player and 47 in 3/4-player.
 */

import { type Card } from '../cards.js';
import { handTotal } from '../score-hand.js';
import { unseenCards } from './combinatorics.js';

/**
 * @param keep the 4 kept cards
 * @param dealt every card dealt to the player this hand (6 or 5), all unseen
 *   starters are drawn from the deck minus these
 */
export function expectedHandValue(
  keep: readonly Card[],
  dealt: readonly Card[],
): number {
  if (keep.length !== 4) {
    throw new Error(`expectedHandValue expects 4 kept cards, got ${keep.length}`);
  }
  const starters = unseenCards(dealt);
  if (starters.length === 0) throw new Error('No unseen starters');

  let sum = 0;
  for (const starter of starters) {
    sum += handTotal([...keep], starter, false);
  }
  return sum / starters.length;
}
