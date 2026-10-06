/**
 * Grader tuning constants. REQUIREMENTS 4A.
 *
 * These are *behavior* knobs, kept in one place so they're easy to tune after
 * the field test. The deer-camp rank NAMES below are defaults; under the theme
 * system (Section 5.1A, Phase 2) the display names move to the theme and only
 * the numeric thresholds stay here.
 */

/** Two options whose values are within this share a rank (4A.2 step 6). */
export const TIE_EPSILON = 0.05;

/** Minimum crib simulations per discard option (4A.2 step 3). */
export const CRIB_SIM_ITERATIONS = 2000;

/** "Hail Mary" kept-hand target used by the future guide (R1). */
export const HAIL_MARY_THRESHOLD = 12;

export interface StandRankBand {
  /** Upper bound (inclusive) on average points lost per hand. */
  readonly maxAvgLost: number;
  /** Stable key; the display label comes from the theme (Section 5.1A). */
  readonly key: string;
  /** Default deer-camp label (until the theme system owns this). */
  readonly defaultLabel: string;
}

/**
 * Stand-rank bands from average points lost per hand (4A.4).
 * Bands are checked in order; the first whose `maxAvgLost` is not exceeded wins.
 */
export const STAND_RANK_BANDS: readonly StandRankBand[] = [
  { maxAvgLost: 0.5, key: 'trophy-buck', defaultLabel: 'Trophy Buck' },
  { maxAvgLost: 1.5, key: 'eight-pointer', defaultLabel: 'Eight-Pointer' },
  { maxAvgLost: 3, key: 'spikehorn', defaultLabel: 'Spikehorn' },
  {
    maxAvgLost: Number.POSITIVE_INFINITY,
    key: 'button-buck',
    defaultLabel: 'Button Buck',
  },
];
