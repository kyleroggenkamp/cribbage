/**
 * Sharing (REQUIREMENTS §2, §7A): the invite link via the native share sheet,
 * falling back to copying to the clipboard.
 */
export interface Share {
  shareLink(url: string, text: string): Promise<'shared' | 'copied' | 'failed'>;
}

export const share: Share = {
  async shareLink(url, text) {
    const nav: Navigator | undefined = typeof navigator !== 'undefined' ? navigator : undefined;
    try {
      if (nav?.share) {
        await nav.share({ url, text });
        return 'shared';
      }
      if (nav?.clipboard) {
        await nav.clipboard.writeText(url);
        return 'copied';
      }
    } catch {
      /* user cancelled or API blocked */
    }
    return 'failed';
  },
};
