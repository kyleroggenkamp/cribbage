/**
 * Notifications (REQUIREMENTS §1A, §7A). The permission + local-notification
 * surface; Web Push registration (VAPID) is wired in Phase 3. Notifications
 * carry no card details (they show on a lock screen).
 */
export interface Notifications {
  supported(): boolean;
  permission(): NotificationPermission | 'unsupported';
  requestPermission(): Promise<NotificationPermission | 'unsupported'>;
}

export const notifications: Notifications = {
  supported() {
    return typeof window !== 'undefined' && 'Notification' in window;
  },
  permission() {
    return this.supported() ? Notification.permission : 'unsupported';
  },
  async requestPermission() {
    if (!this.supported()) return 'unsupported';
    try {
      return await Notification.requestPermission();
    } catch {
      return 'denied';
    }
  },
};
