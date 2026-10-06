/**
 * Camp bots. REQUIREMENTS Section 4.
 *
 * Easy level only in v1: the bot reuses the grader's discard evaluator (4A.2,
 * highest expected value) and pegging evaluator (4A.3, best card). Pure, so it
 * runs identically on the server and in tests; the move delay is applied by the
 * app layer (see config).
 */
export * from './config.js';
export * from './discard.js';
export * from './pegging.js';
