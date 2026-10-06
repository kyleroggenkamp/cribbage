/**
 * Offline action queue (REQUIREMENTS §1A weak-signal). Every move is queued with
 * a client-generated id and retried until the server confirms it; the server is
 * idempotent on that id, so a retry can never apply a move twice. Moves show as
 * "sending…" until confirmed and are never silently lost — the queue persists,
 * so a phone that dies mid-send resumes on restart.
 *
 * This core is pure and deterministic (transport, storage, and the retry
 * scheduler are injected), so it is unit-tested without a network or a browser.
 * The browser wiring (Supabase transport + localStorage) lives in the factory
 * at the bottom.
 */

export interface QueuedAction {
  id: string; // client-generated; the server dedupes on it
  gameId: string;
  body: unknown; // the action payload sent to submit-action
  attempts: number;
  createdAt: number;
}

/** Transport resolves when the server has CONFIRMED the action (incl. a dedup
 *  of an already-applied id). It throws to signal failure; set `permanent` on
 *  the error for a server rejection that must NOT be retried (e.g. illegal
 *  move) versus a transient network error (retry). */
export interface TransportError extends Error {
  permanent?: boolean;
}
export type Transport = (action: QueuedAction) => Promise<void>;

export interface QueueStorage {
  load(): QueuedAction[];
  save(list: QueuedAction[]): void;
}

export interface QueueDeps {
  transport: Transport;
  storage: QueueStorage;
  /** Defaults to setTimeout; injected in tests for determinism. */
  schedule?: (fn: () => void, ms: number) => void;
  now?: () => number;
  baseDelayMs?: number; // default 1000
  maxDelayMs?: number; // default 30000
}

export interface QueueState {
  readonly pending: QueuedAction[]; // still trying (includes in-flight)
  readonly sending: boolean;
  readonly lastError: string | null;
}

export interface ActionQueue {
  enqueue(gameId: string, id: string, body: unknown): void;
  getState(): QueueState;
  subscribe(cb: (s: QueueState) => void): () => void;
  /** Attempt the head of the queue now (also called automatically). */
  flush(): Promise<void>;
}

export function createActionQueue(deps: QueueDeps): ActionQueue {
  const schedule = deps.schedule ?? ((fn, ms) => setTimeout(fn, ms));
  const now = deps.now ?? (() => Date.now());
  const base = deps.baseDelayMs ?? 1000;
  const cap = deps.maxDelayMs ?? 30000;

  let list: QueuedAction[] = deps.storage.load();
  let sending = false;
  let lastError: string | null = null;
  let current: Promise<void> | null = null;
  const subs = new Set<(s: QueueState) => void>();

  const state = (): QueueState => ({ pending: [...list], sending, lastError });
  const notify = () => {
    const s = state();
    for (const cb of subs) cb(s);
  };
  const persist = () => deps.storage.save(list);

  const backoff = (attempts: number) => Math.min(cap, base * 2 ** Math.max(0, attempts - 1));

  function flush(): Promise<void> {
    if (!current) current = run().finally(() => { current = null; });
    return current;
  }

  async function run(): Promise<void> {
    // Process in order; stop at the first transient failure so moves apply in
    // the order they were made (the server also enforces turn order).
    while (list.length > 0) {
      const head = list[0]!;
      sending = true;
      notify();
      try {
        await deps.transport(head);
        list = list.slice(1); // confirmed
        lastError = null;
        persist();
        notify();
      } catch (err) {
        const e = err as TransportError;
        head.attempts += 1;
        lastError = e.message ?? 'send failed';
        if (e.permanent) {
          list = list.slice(1); // rejected by the server — drop it
          persist();
          notify();
          continue;
        }
        persist();
        sending = false;
        notify();
        schedule(() => void flush(), backoff(head.attempts)); // retry later
        return;
      }
    }
    sending = false;
    notify();
  }

  return {
    enqueue(gameId, id, body) {
      if (list.some((a) => a.id === id)) return; // de-dupe locally too
      list = [...list, { id, gameId, body, attempts: 0, createdAt: now() }];
      persist();
      notify();
      void flush();
    },
    getState: state,
    subscribe(cb) {
      subs.add(cb);
      cb(state());
      return () => subs.delete(cb);
    },
    flush,
  };
}
