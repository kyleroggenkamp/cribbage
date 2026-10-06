/**
 * The grader ("Stand report"). REQUIREMENTS 4A.
 *
 * Pure TypeScript, no UI or network code (4A.1), unit tested like the engine.
 * This is math, not an AI model: the best play is computed exactly (hands) or
 * by seeded simulation (crib), so it costs nothing and gives the same answer
 * every time.
 *
 * Implemented so far: discard grading (4A.2), pegging grading (4A.3), per-hand
 * and per-game scores and the stand rank (4A.4). Luck vs. skill (4A.7) and
 * hindsight (4A.8) are the next increment.
 */

export * from './config.js';
export * from './util.js';
export * from './combinatorics.js';
export * from './rank.js';
export * from './expected-hand.js';
export * from './crib-estimate.js';
export * from './discard.js';
export * from './pegging.js';
export * from './scores.js';
export * from './baseline-cases.js';
export * from './baselines.js';
export * from './pegging-policy.js';
export * from './luck.js';
export * from './hindsight.js';
