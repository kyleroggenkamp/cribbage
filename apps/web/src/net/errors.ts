/**
 * Turn anything thrown into a human message. Supabase RPC/Function errors are
 * plain objects (not Error instances) with a `message` field, so `String(e)`
 * on them renders the useless "[object Object]". Prefer a real message.
 */
export function errorMessage(e: unknown): string {
  if (e instanceof Error) return e.message;
  if (e && typeof e === 'object') {
    const o = e as Record<string, unknown>;
    if (typeof o.message === 'string' && o.message) return o.message;
    if (typeof o.error_description === 'string' && o.error_description) return o.error_description;
    if (typeof o.error === 'string' && o.error) return o.error;
    try {
      return JSON.stringify(e);
    } catch {
      /* fall through */
    }
  }
  return String(e);
}
