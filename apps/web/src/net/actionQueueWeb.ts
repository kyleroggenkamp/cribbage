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
    // A non-2xx from the function means the server rejected the move: don't
    // retry forever. A fetch/network error is transient: keep retrying.
    e.permanent = error instanceof FunctionsHttpError;
    throw e;
  }
}

export function createWebActionQueue(): ActionQueue {
  return createActionQueue({ transport: supabaseTransport, storage: localStorageQueue });
}
