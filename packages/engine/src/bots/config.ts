/**
 * Camp bot settings. REQUIREMENTS Section 4.
 *
 * The 1-2 second pause before a bot move (so humans can follow) is a UI/timing
 * concern: the pure engine never sleeps. The app layer reads this range and
 * applies the delay itself.
 */
export const BOT_MOVE_DELAY_MS = { min: 1000, max: 2000 } as const;

/** A delay in [min, max] ms for the app to wait before showing a bot move. */
export function botMoveDelayMs(random: () => number = Math.random): number {
  const { min, max } = BOT_MOVE_DELAY_MS;
  return Math.round(min + random() * (max - min));
}
