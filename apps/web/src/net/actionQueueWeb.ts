/**
 * Browser wiring for the offline action queue: a Supabase transport (calls the
 * submit-action Edge Function) and localStorage persistence. The queue logic
 * itself is the tested core in actionQueue.ts.
 */

import { FunctionsHttpError } from '@supabase/supabase-js';
import { supabase } from './supabase';
import {
  createActionQueue,
  type ActionQueue,
  type QueuedAction,
  type QueueStorage,
  type TransportError,
} from './actionQueue';

const STORAGE_KEY = 'dc.actionQueue';

const localStorageQueue: QueueStorage = {
  load() {
    try {
      const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null;
      return raw ? (JSON.parse(raw) as QueuedAction[]) : [];
    } catch {
      return [];
    }
  },
  save(list) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
    } catch {
      /* private mode / full */
    }
  },
};

/** Send one action to the submit-action Edge Function. Resolves when the server
 *  confirms (including an idempotent re-apply); throws transient on a network
 *  error and permanent on a server rejection (e.g. illegal/out-of-turn move). */
async function supabaseTransport(action: QueuedAction): Promise<void> {
  const { error } = await supabase().functions.invoke('submit-action', {
    body: { game_id: action.gameId, action: action.body },
  });
  if (error) {
    const e: TransportError = error;
    // Only a 4xx is a real rejection the client must stop retrying (illegal /
    // out-of-turn move, not seated, …). A 5xx is a SERVER blip — a cold start
    // right after a deploy, an overloaded instance — which is transient and
    // must be retried, else a single cold-start 5xx silently wedges the game
    // (e.g. the host's one deal gets dropped and the table never appears). A
    // fetch/network error (not a FunctionsHttpError) is also transient.
    if (error instanceof FunctionsHttpError) {
      const status = (error as unknown as { context?: { status?: number } }).context?.status ?? 0;
      e.permanent = status >= 400 && status < 500;
    } else {
      e.permanent = false;
    }
    throw e;
  }
}

export function createWebActionQueue(): ActionQueue {
  return createActionQueue({ transport: supabaseTransport, storage: localStorageQueue });
}
