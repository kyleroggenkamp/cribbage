/**
 * Screen wake lock (REQUIREMENTS §1A, §7A). OFF by default — players lock their
 * phones between turns. An optional "keep screen on" setting uses this.
 */
export interface WakeLock {
  request(): Promise<void>;
  release(): Promise<void>;
}

let sentinel: WakeLockSentinel | null = null;

export const wakeLock: WakeLock = {
  async request() {
    try {
      if (typeof navigator !== 'undefined' && 'wakeLock' in navigator) {
        sentinel = await navigator.wakeLock.request('screen');
      }
    } catch {
      /* not supported / denied */
    }
  },
  async release() {
    try {
      await sentinel?.release();
    } catch {
      /* ignore */
    }
    sentinel = null;
  },
};
