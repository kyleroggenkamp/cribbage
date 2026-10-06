/**
 * Local storage (REQUIREMENTS §2, §7A). Remembers the player's name and stand
 * on this device for next time. Per-device conveniences only — never game
 * state, which lives on the server. Every access is guarded.
 */
export interface Storage {
  get(key: string): string | null;
  set(key: string, value: string): void;
  remove(key: string): void;
}

export const storage: Storage = {
  get(key) {
    try {
      return typeof localStorage !== 'undefined' ? localStorage.getItem(key) : null;
    } catch {
      return null;
    }
  },
  set(key, value) {
    try {
      localStorage.setItem(key, value);
    } catch {
      /* private mode / blocked */
    }
  },
  remove(key) {
    try {
      localStorage.removeItem(key);
    } catch {
      /* ignore */
    }
  },
};

export const KEYS = { displayName: 'dc.displayName', standName: 'dc.standName' } as const;
