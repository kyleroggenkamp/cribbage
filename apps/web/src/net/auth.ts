import type { User } from '@supabase/supabase-js';
import { supabase } from './supabase';

/**
 * Anonymous sign-in (REQUIREMENTS §6). Every player gets a stable Supabase
 * user id the first time, reused on return. The id is what stats/grades are
 * tied to (never the display name), and anonymous users can later be upgraded
 * to a permanent account without losing it (R7/R13) — not built in v1.
 *
 * Requires "Allow anonymous sign-ins" enabled in the Supabase project.
 */
export async function ensureSignedIn(): Promise<User> {
  const sb = supabase();
  const { data } = await sb.auth.getSession();
  if (data.session?.user) return data.session.user;

  const { data: anon, error } = await sb.auth.signInAnonymously();
  if (error) throw error;
  if (!anon.user) throw new Error('Anonymous sign-in returned no user');
  return anon.user;
}

export async function currentUserId(): Promise<string | null> {
  const { data } = await supabase().auth.getSession();
  return data.session?.user?.id ?? null;
}
