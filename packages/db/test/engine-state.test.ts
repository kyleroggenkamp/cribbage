/**
 * The engine_state blob is server-only: clients can neither read nor write it
 * (REQUIREMENTS §6 — the deck order and hidden hands never reach a client).
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDb, UID, type TestDb } from './harness.js';

let db: TestDb;
let gameId: string;

beforeEach(async () => {
  db = await createTestDb();
  const [camp] = await db.asUser(
    UID.A,
    `select * from create_camp(2::smallint, 121::smallint, true, false, false,
       'each_hand', 'deer-camp', 'Kyle', 'Ridge')`,
  );
  gameId = camp!.game_id as string;
  // Service role seeds the blob (as the Edge Function would).
  await db.service(
    `insert into engine_state(game_id, state) values ('${gameId}', '{"deck":["5C"],"secret":true}'::jsonb)`,
  );
});

describe('engine_state is server-only', () => {
  it('a seated player cannot read the blob', async () => {
    await expect(
      db.asUser(UID.A, `select state from engine_state where game_id='${gameId}'`),
    ).rejects.toThrow(); // no grant + no policy => permission denied
  });

  it('a seated player cannot write the blob', async () => {
    await expect(
      db.asUser(UID.A, `update engine_state set state='{}'::jsonb where game_id='${gameId}'`),
    ).rejects.toThrow();
  });

  it('the service role can read it (for the Edge Function)', async () => {
    const rows = await db.service(`select state from engine_state where game_id='${gameId}'`);
    expect(rows).toHaveLength(1);
  });
});
