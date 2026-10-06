/**
 * CLI: deal a random hand and rank every discard option for the player.
 * REQUIREMENTS Section 9 (Phase 1 tooling), 4A.2.
 *
 *   npm run deal            # 2-player
 *   npm run deal -- 3       # 3-player
 *
 * Grades seat 0's hand as the dealer (so the crib is theirs), listing every
 * legal discard ranked by value, with the points given away vs. the best.
 */

import { makeDeck, type Card } from '../cards.js';
import { cryptoShuffle } from '../rng.js';
import { dealHands, cutStarter, hisHeels, type PlayerCount } from '../deal.js';
import { gradeDiscard } from '../grader/discard.js';
import { rankPhrase } from '../grader/rank.js';
import { rankOf } from '../grader/rank.js';

const fmt = (cs: readonly Card[]) =>
  cs.map((c) => `${c.rank}${c.suit}`.padStart(3, ' ')).join(' ');

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

  console.log(`Deal: ${playerCount}-player  (seat 0 = dealer, crib is theirs)`);
  console.log('');
  hands.forEach((hand, seat) => console.log(`Seat ${seat}: ${fmt(hand)}`));
  if (cribSeed.length > 0) console.log(`Crib seed: ${fmt(cribSeed)}`);
  console.log(`Starter (cut, for reference): ${starter.rank}${starter.suit}`);
  if (hisHeels(starter) > 0) console.log('  -> His heels: dealer pegs 2');
  console.log('');

  // Grade seat 0 as the dealer. Pick an arbitrary "chosen" discard (the first
  // legal one) just to satisfy the API; we print the full ranked list.
  const dealt = hands[0]!;
  const seed = `cli:${Math.random().toString(36).slice(2)}`;

  const firstDiscard =
    playerCount === 2 ? dealt.slice(0, 2) : dealt.slice(0, 1);
  const grade = gradeDiscard({
    playerCount,
    dealt,
    chosenDiscard: firstDiscard,
    cribIsMine: true,
    seed,
  });

  const values = grade.options.map((o) => o.value);
  console.log('Seat 0 discard options, best to worst:');
  console.log('  throw        keep               value  gave away  rank');
  for (const opt of grade.options) {
    const gaveAway = grade.best.value - opt.value;
    const rank = rankOf(opt.value, values);
    console.log(
      `  ${fmt(opt.discard).padEnd(9)}  ${fmt(opt.keep).padEnd(16)}  ` +
        `${opt.value.toFixed(2).padStart(5)}  ${gaveAway
          .toFixed(2)
          .padStart(9)}  ${rankPhrase(rank)}`,
    );
  }
  console.log('');
  console.log(
    `value = expected hand + expected crib (own crib). ` +
      `Crib estimate is seeded, so this is reproducible per seed.`,
  );
}

main(process.argv.slice(2));
