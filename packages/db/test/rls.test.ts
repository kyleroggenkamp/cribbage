/**
 * The security wall (REQUIREMENTS §6, Section 8 security test): a player's
 * database request cannot return another player's hand, the crib before the
 * show, or the action log before the game is over.
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
  await db.asUser(UID.B, `select * from join_camp('${camp!.camp_code}', 'Dave', 'Oak')`);

  // Simulate what the deal Edge Function will do (service role, bypasses RLS):
  await db.service(
    `insert into hands(game_id, hand_number, dealer_seat, phase)
     values ('${gameId}', 1, 0, 'pegging')`,
  );
  await db.service(`
    insert into private_cards(game_id, hand_number, seat_index, player_id, kind, cards) values
      ('${gameId}', 1, 0, '${UID.A}', 'dealt', '["5C","5D","5H","JS"]'),
      ('${gameId}', 1, 1, '${UID.B}', 'dealt', '["2C","3D","4H","6S"]'),
      ('${gameId}', 1, 0, null,       'crib',  '["KC","KD","QH","QS"]')
  `);
});

describe('private_cards wall during play', () => {
  it('a player sees ONLY their own cards', async () => {
    const a = await db.asUser(UID.A, `select seat_index, player_id from private_cards where game_id='${gameId}'`);
    expect(a).toHaveLength(1);
    expect(a[0]!.player_id).toBe(UID.A);

    const b = await db.asUser(UID.B, `select player_id from private_cards where game_id='${gameId}'`);
    expect(b).toHaveLength(1);
    expect(b[0]!.player_id).toBe(UID.B);
  });

  it('nobody can read the crib before the show', async () => {
    const cribForA = await db.asUser(
      UID.A,
      `select * from private_cards where game_id='${gameId}' and kind='crib'`,
    );
    expect(cribForA).toHaveLength(0);
  });

  it('a non-member sees nothing of the game', async () => {
    const games = await db.asUser(UID.C, `select * from games where id='${gameId}'`);
    const seats = await db.asUser(UID.C, `select * from seats where game_id='${gameId}'`);
    const cards = await db.asUser(UID.C, `select * from private_cards where game_id='${gameId}'`);
    expect(games).toHaveLength(0);
    expect(seats).toHaveLength(0);
    expect(cards).toHaveLength(0);
  });
});

describe('private_cards open at the show', () => {
  it('once the hand is revealed, every seated player sees all cards and the crib', async () => {
    await db.service(`update hands set phase='show' where game_id='${gameId}' and hand_number=1`);

    const a = await db.asUser(UID.A, `select kind, player_id from private_cards where game_id='${gameId}'`);
    expect(a).toHaveLength(3); // A's hand, B's hand, the crib
    expect(a.some((r) => r.player_id === UID.B)).toBe(true);
    expect(a.some((r) => r.kind === 'crib')).toBe(true);

    // ...but a non-member still sees nothing.
    const c = await db.asUser(UID.C, `select * from private_cards where game_id='${gameId}'`);
    expect(c).toHaveLength(0);
  });
});

describe('action log visibility', () => {
  beforeEach(async () => {
    await db.service(`
      insert into actions(id, game_id, hand_number, seat_index, player_id, type) values
        (gen_random_uuid(), '${gameId}', 1, 0, '${UID.A}', 'discard'),
        (gen_random_uuid(), '${gameId}', 1, 1, '${UID.B}', 'discard')
    `);
  });

  it('mid-game, a player sees only their own actions', async () => {
    const a = await db.asUser(UID.A, `select player_id from actions where game_id='${gameId}'`);
    expect(a).toHaveLength(1);
    expect(a[0]!.player_id).toBe(UID.A);
  });

  it('after the game is over, seated players see the full log', async () => {
    await db.service(`update games set status='over' where id='${gameId}'`);
    const a = await db.asUser(UID.A, `select player_id from actions where game_id='${gameId}'`);
    expect(a).toHaveLength(2);
    // A non-member still sees nothing.
    const c = await db.asUser(UID.C, `select * from actions where game_id='${gameId}'`);
    expect(c).toHaveLength(0);
  });
});
