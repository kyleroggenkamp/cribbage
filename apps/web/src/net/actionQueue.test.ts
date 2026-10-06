import { describe, it, expect, vi } from 'vitest';
import { createActionQueue, type QueuedAction, type TransportError } from './actionQueue';

function memStorage(initial: QueuedAction[] = []) {
  let saved = [...initial];
  return {
    load: () => [...saved],
    save: (l: QueuedAction[]) => {
      saved = [...l];
    },
    get current() {
      return saved;
    },
  };
}

/** A scheduler that records retries so tests can fire them deterministically. */
function manualScheduler() {
  const jobs: { fn: () => void; ms: number }[] = [];
  return {
    schedule: (fn: () => void, ms: number) => jobs.push({ fn, ms }),
    jobs,
    runNext: () => jobs.shift()?.fn(),
  };
}

const permanent = (msg: string): TransportError => Object.assign(new Error(msg), { permanent: true });

describe('offline action queue (REQUIREMENTS §1A)', () => {
  it('sends a queued action and removes it once confirmed', async () => {
    const storage = memStorage();
    const sched = manualScheduler();
    const transport = vi.fn().mockResolvedValue(undefined);
    const q = createActionQueue({ transport, storage, schedule: sched.schedule });

    q.enqueue('g1', 'a1', { type: 'play' });
    await q.flush();

    expect(transport).toHaveBeenCalledTimes(1);
    expect(q.getState().pending).toHaveLength(0);
    expect(q.getState().sending).toBe(false);
    expect(storage.current).toHaveLength(0);
  });

  it('retries a transient failure with exponential backoff, then confirms', async () => {
    const storage = memStorage();
    const sched = manualScheduler();
    const transport = vi
      .fn()
      .mockRejectedValueOnce(new Error('network')) // transient
      .mockResolvedValueOnce(undefined);
    const q = createActionQueue({ transport, storage, schedule: sched.schedule, baseDelayMs: 1000 });

    q.enqueue('g1', 'a1', {});
    await q.flush();

    // Failed once -> still pending, one retry scheduled at the base delay.
    expect(q.getState().pending).toHaveLength(1);
    expect(q.getState().pending[0]!.attempts).toBe(1);
    expect(q.getState().lastError).toBe('network');
    expect(sched.jobs[0]!.ms).toBe(1000);

    // Fire the retry -> now succeeds.
    sched.runNext();
    await q.flush();
    expect(transport).toHaveBeenCalledTimes(2);
    expect(q.getState().pending).toHaveLength(0);
  });

  it('drops a permanently-rejected action and surfaces the error', async () => {
    const storage = memStorage();
    const transport = vi.fn().mockRejectedValue(permanent('illegal move'));
    const q = createActionQueue({ transport, storage, schedule: () => {} });

    q.enqueue('g1', 'bad', {});
    await q.flush();
    expect(q.getState().pending).toHaveLength(0); // dropped, not retried forever
    expect(q.getState().lastError).toBe('illegal move');
  });

  it('preserves order and de-dupes a repeated id', async () => {
    const storage = memStorage();
    const sent: string[] = [];
    const transport = vi.fn(async (a: QueuedAction) => {
      sent.push(a.id);
    });
    const q = createActionQueue({ transport, storage, schedule: () => {} });

    q.enqueue('g1', 'a1', {});
    q.enqueue('g1', 'a2', {});
    q.enqueue('g1', 'a1', {}); // duplicate id ignored
    await q.flush();
    expect(sent).toEqual(['a1', 'a2']);
  });

  it('resumes a persisted queue on reload (phone restart)', async () => {
    const preloaded: QueuedAction[] = [{ id: 'a1', gameId: 'g1', body: {}, attempts: 2, createdAt: 0 }];
    const storage = memStorage(preloaded);
    const transport = vi.fn().mockResolvedValue(undefined);
    const q = createActionQueue({ transport, storage, schedule: () => {} });

    // A fresh queue loaded a pending action from storage.
    expect(q.getState().pending).toHaveLength(1);
    await q.flush();
    expect(transport).toHaveBeenCalledWith(expect.objectContaining({ id: 'a1' }));
    expect(q.getState().pending).toHaveLength(0);
  });
});
