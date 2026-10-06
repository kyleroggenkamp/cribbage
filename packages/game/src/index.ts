/**
 * @deercamp/game — the server-authoritative game state machine.
 *
 * Pure TypeScript, imports @deercamp/engine for all rules. Shared by the
 * Supabase Edge Functions (which load DB state, reduce, persist, broadcast)
 * and the tests. No UI, no network, no direct DB access here.
 */
export * from './pegging.js';
export * from './state.js';
export * from './reduce.js';
export * from './project.js';
