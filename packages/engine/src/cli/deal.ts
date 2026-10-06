/**
 * CLI: deal a random hand and show the cut and each hand's show-count.
 * REQUIREMENTS Section 9 (Phase 1 tooling).
 *
 *   npm run deal            # 2-player
 *   npm run deal -- 3       # 3-player
 *
 * NOTE: the full Phase 1 spec for this command also ranks every discard option
 * by value and "points given away". That ranking is produced by the grader
 * (REQUIREMENTS 4A.2), which is the next increment on top of this engine. Until
 * then this command deals, cuts, and scores — a smoke test for the engine.
 */

import { makeDeck } from '../cards.js';
import { cryptoShuffle } from '../rng.js';
import { dealHands, cutStarter, hisHeels, type PlayerCount } from '../deal.js';
import { scoreHand, describeScore } from '../score-hand.js';

function main(argv: string[]): void {
  const pcRaw = argv[0] ? Number(argv[0]) : 2;
  if (![2, 3, 4].includes(pcRaw)) {
    console.error('Usage: npm run deal -- [2|3|4]');
    process.exitCode = 1;
    return;
  }
  const playerCount = pcRaw as PlayerCount;

  const deck = cryptoShuffle(makeDeck());
  const { hands, cribSeed, stock } = dealHands(playerCount, deck);
  const starter = cutStarter(stock);

  const fmt = (cs: { rank: string; suit: string }[]) =>
    cs.map((c) => `${c.rank}${c.suit}`).join(' ');

  console.log(`Deal: ${playerCount}-player`);
  console.log(`Starter (cut): ${starter.rank}${starter.suit}`);
  if (hisHeels(starter) > 0) {
    console.log('  -> His heels: dealer pegs 2');
  }
  console.log('');

  hands.forEach((hand, seat) => {
    console.log(`Seat ${seat}: ${fmt(hand)}`);
  });
  if (cribSeed.length > 0) {
    console.log(`Crib seed (dealt to crib): ${fmt(cribSeed)}`);
  }
  console.log('');
  console.log('If each seat kept its full dealt hand, the show would score:');
  console.log('(illustrative only — real play keeps 4 after discarding)');
  hands.forEach((hand, seat) => {
    if (hand.length === 4) {
      const s = scoreHand(hand, starter, false);
      console.log(`  Seat ${seat}: ${s.total}  (${describeScore(s)})`);
    } else {
      console.log(
        `  Seat ${seat}: has ${hand.length} cards; discard to 4 before the show`,
      );
    }
  });
}

main(process.argv.slice(2));
