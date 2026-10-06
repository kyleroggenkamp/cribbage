/**
 * Haptics (REQUIREMENTS §1A, §7A). One short buzz when it becomes your turn or
 * a hold ends — nothing else. A native implementation swaps in later without
 * touching game code. iOS Safari can't vibrate from the web, so the push
 * notification covers that case (handled in notifications.ts).
 */
export interface Haptics {
  supported(): boolean;
  buzz(): void;
}

export const haptics: Haptics = {
  supported() {
    return typeof navigator !== 'undefined' && 'vibrate' in navigator;
  },
  buzz() {
    if (this.supported()) navigator.vibrate(200);
  },
};
