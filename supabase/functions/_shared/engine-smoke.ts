/**
 * Runtime-agnostic engine smoke logic, shared by the Edge Function (Deno) and
 * a Node proof script. It imports @deercamp/engine via a bare specifier that
 * resolves differently per runtime:
 *   - Deno  (Edge Function): import map -> packages/engine/dist/index.js
 *   - Node  (proof script):  npm workspace -> packages/engine
 * Either way it's the exact same engine code, which is the whole point of
 * REQUIREMENTS 7A (one engine, imported everywhere).
 */

import {
  scoreHand,
  parseCards,
  handTotal,
  type Card,
} from '@deercamp/engine';

export interface ScoreResponse {
  readonly cards: string[];
  readonly isCrib: boolean;
  readonly total: number;
  readonly breakdown: string[];
}

/** Score a 5-token hand (4 cards + starter), e.g. ["5C","5D","5H","JS","5S"]. */
export function scoreFromTokens(tokens: string[], isCrib = false): ScoreResponse {
  if (tokens.length !== 5) {
    throw new Error('Expected 5 card tokens: four hand cards + the starter');
  }
  const cards: Card[] = parseCards(tokens);
  const hand = cards.slice(0, 4);
  const starter = cards[4]!;
  const score = scoreHand(hand, starter, isCrib);
  return {
    cards: tokens,
    isCrib,
    total: score.total,
    breakdown: score.events.map((e) => e.description),
  };
}

/**
 * Prove the whole import graph loaded and the engine runs: score the perfect
 * 29 hand. Returns ok:true only if the number is right.
 */
export function engineSelfTest(): { ok: boolean; perfectHand: number; expected: 29 } {
  const perfectHand = handTotal(parseCards(['5C', '5D', '5H', 'JS']), parseCards(['5S'])[0]!);
  return { ok: perfectHand === 29, perfectHand, expected: 29 };
}
