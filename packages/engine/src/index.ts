/**
 * @deercamp/engine — the Deer Camp Cribbage rules engine.
 *
 * Pure TypeScript, no UI and no network code (REQUIREMENTS 0, 7A). Imported by
 * both the web app and the Supabase Edge Functions.
 *
 * Phase 1 scope implemented so far: the rules engine (Section 3). The grader,
 * luck/skill, hindsight, and camp bots (Sections 4/4A) build on top of this.
 */

export * from './cards.js';
export * from './rng.js';
export * from './deal.js';
export * from './score-hand.js';
export * from './score-pegging.js';
export * from './play.js';
export * from './show.js';

// The grader ("Stand report"), REQUIREMENTS 4A.
export * from './grader/index.js';
