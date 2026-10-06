/**
 * Expected crib value: estimate, by simulation, what the crib is worth given
 * the cards a player throws into it. REQUIREMENTS 4A.2 step 3.
 *
 * The crib always ends at 4 cards. The player contributes `discardsEach` of
 * them; the rest (opponents' throws + any card dealt straight to the crib) are
 * unknown, so we fill them — plus the starter — with random unseen cards and
 * average the crib score. The simulation is *seeded* (game id + hand number +
 * the specific throw) so a re-grade always gives the same number.
 *
 * This returns the crib's own expected score (always >= 0). The caller decides
 * the sign: added when the crib is the player's/team's, subtracted when it's an
 * opponent's (done in discard.ts).
 */

import { type Card } from '../cards.js';
import { scoreHand, cardsKey } from '../score-hand.js';
import { seededRng } from '../rng.js';
import { type PlayerCount, DEAL_CONFIG } from '../deal.js';
import { unseenCards } from './combinatorics.js';

export interface CribEstimateArgs {
  readonly playerCount: PlayerCount;
  /** The cards this player throws to the crib (2 in 2-player, else 1). */
  readonly thrown: readonly Card[];
  /** Every card dealt to the player (the unseen pool is the deck minus these). */
  readonly dealt: readonly Card[];
  /** Deterministic seed: game id + hand number + throw. */
  readonly seed: string;
  readonly iterations?: number;
}

/** Draw `n` distinct cards from `pool` using the seeded rng (no replacement). */
function drawDistinct(pool: Card[], n: number, rng: ReturnType<typeof seededRng>): Card[] {
  // Partial Fisher-Yates: enough to pick n without copying the whole pool each time.
  const copy = [...pool];
  const out: Card[] = [];
  for (let i = 0; i < n; i++) {
    const j = i + rng.int(copy.length - i);
    const tmp = copy[i]!;
    copy[i] = copy[j]!;
    copy[j] = tmp;
    out.push(copy[i]!);
  }
  return out;
}

export function expectedCribValue(args: CribEstimateArgs): number {
  const { playerCount, thrown, dealt, seed } = args;
  const iterations = args.iterations ?? 2000;
  const cfg = DEAL_CONFIG[playerCount];

  if (thrown.length !== cfg.discardsEach) {
    throw new Error(
      `${playerCount}-player throws ${cfg.discardsEach} to the crib, got ${thrown.length}`,
    );
  }

  // Cards still unknown to the player after their throw: the deck minus every
  // card they were dealt. (The thrown cards are part of `dealt`.)
  const pool = unseenCards(dealt);

  // How many crib cards remain to be filled, plus one starter.
  const cribFill = 4 - cfg.discardsEach; // opponents' throws + any dealt-to-crib
  const draws = cribFill + 1; // + starter

  // Seed per-throw so the estimate is stable regardless of option order.
  const rng = seededRng(`${seed}:${cardsKey([...thrown])}`);

  let sum = 0;
  for (let i = 0; i < iterations; i++) {
    const drawn = drawDistinct(pool, draws, rng);
    const starter = drawn[0]!;
    const fill = drawn.slice(1);
    const crib = [...thrown, ...fill];
    sum += scoreHand(crib, starter, true).total;
  }
  return sum / iterations;
}
