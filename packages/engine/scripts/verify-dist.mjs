/**
 * Proof that the BUILT engine (packages/engine/dist) imports and runs as a
 * plain ESM module with explicit .js specifiers and only Web-standard globals —
 * i.e. exactly how the Supabase/Deno runtime loads it. Run after `npm run build`:
 *
 *   node scripts/verify-dist.mjs
 *
 * This is the step-0 risk-killer we can run without Deno: if the dist graph
 * loads and scores correctly here, the same files load in Deno (same ESM rules,
 * same Web Crypto global, no Node-only APIs — verified separately by grep).
 */

import { scoreHand, handTotal, parseCards, makeDeck, cryptoShuffle } from '../dist/index.js';

let failures = 0;
function expect(label, actual, want) {
  const ok = actual === want;
  if (!ok) failures++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}: got ${actual}, want ${want}`);
}

// The import graph loaded; now exercise the core scorer.
expect('perfect hand 5C5D5H JS + 5S', handTotal(parseCards(['5C', '5D', '5H', 'JS']), parseCards(['5S'])[0]), 29);
expect('mockup hand 4D5S6C JH + 5H', handTotal(parseCards(['4D', '5S', '6C', 'JH']), parseCards(['5H'])[0]), 17);
expect('crib flush needs 5 (4-card crib flush)', scoreHand(parseCards(['2H', '4H', '6H', '8H']), parseCards(['KS'])[0], true).total, 0);

// Prove the crypto-backed shuffle works under this runtime's Web Crypto.
const deck = cryptoShuffle(makeDeck());
expect('shuffle preserves 52 cards', deck.length, 52);
expect('shuffle keeps 52 distinct', new Set(deck.map((c) => `${c.rank}${c.suit}`)).size, 52);

console.log(failures === 0 ? '\nALL GOOD: built engine runs as portable ESM.' : `\n${failures} FAILURE(S).`);
process.exit(failures === 0 ? 0 : 1);
