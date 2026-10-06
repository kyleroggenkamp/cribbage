/**
 * CLI: score a hand. REQUIREMENTS Section 9 (Phase 1 tooling).
 *
 *   npm run score -- 5H 5S 5C JD 5D
 *   npm run score -- --crib 5H 5S 5C JD 5D
 *
 * Convention: the first four cards are the hand (or crib with --crib), the
 * fifth card is the starter.
 */

import { parseCard } from '../cards.js';
import { scoreHand, describeScore } from '../score-hand.js';

function main(argv: string[]): void {
  const args = [...argv];
  let isCrib = false;
  const cardTokens: string[] = [];
  for (const a of args) {
    if (a === '--crib') isCrib = true;
    else cardTokens.push(a);
  }

  if (cardTokens.length !== 5) {
    console.error(
      'Usage: npm run score -- [--crib] <c1> <c2> <c3> <c4> <starter>',
    );
    console.error('Example: npm run score -- 5H 5S 5C JD 5D');
    process.exitCode = 1;
    return;
  }

  const cards = cardTokens.map(parseCard);
  const hand = cards.slice(0, 4);
  const starter = cards[4]!;
  const result = scoreHand(hand, starter, isCrib);

  const label = isCrib ? 'Crib' : 'Hand';
  const handStr = hand.map((c) => `${c.rank}${c.suit}`).join(' ');
  console.log(`${label}:    ${handStr}`);
  console.log(`Starter: ${starter.rank}${starter.suit}`);
  console.log(`Score:   ${result.total}`);
  console.log(`         ${describeScore(result)}`);
}

main(process.argv.slice(2));
