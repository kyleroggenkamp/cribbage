/**
 * Lobby RPCs: seat settings, ready, bots, start, and the reconnect snapshot
 * (REQUIREMENTS §2, §1A, §6). The get_game_state tests also re-assert the
 * privacy guarantee: the snapshot carries only the caller's own cards.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDb, UID, type TestDb } from './harness.js';

let db: TestDb;
let gameId: string;
let code: string;

async function setupCamp(playerCount = 2) {
  const [camp] = await db.asUser(
    UID.A,
    `select * from create_camp(${playerCount}::smallint, 121::smallint, true, false, false,
       'each_hand', 'deer-camp', 'Kyle', 'Ridge')`,
  );
  gameId = camp!.game_id as string;
  code = camp!.camp_code as string;
}

beforeEach(async () => {
  db = await createTestDb();
  await setupCamp(2);
});

describe('seat settings and ready (REQUIREMENTS §1A, §2)', () => {
  it('a player updates only their own seat settings', async () => {
    await db.asUser(UID.A, `select update_seat_settings('${gameId}', false, false, true)`);
    const [seat0] = await db.service(
      `select silent, stand_mode, notifications_enabled from seats where game_id='${gameId}' and seat_index=0`,
    );
    expect(seat0).toMatchObject({ silent: false, stand_mode: false, notifications_enabled: true });
  });

  it('set_ready toggles the caller seat; a non-seated user is rejected', async () => {
    await db.asUser(UID.A, `select set_ready('${gameId}', true)`);
    const [seat0] = await db.service(`select ready from seats where game_id='${gameId}' and seat_index=0`);
    expect(seat0!.ready).toBe(true);
    await expect(db.asUser(UID.C, `select set_ready('${gameId}', true)`)).rejects.toThrow();
  });
});

describe('bots and start (REQUIREMENTS §2)', () => {
  it('the host adds a bot to an empty seat; a non-host cannot', async () => {
    await db.asUser(UID.B, `select * from join_camp('${code}', 'Dave', null)`); // seat 1 taken
    // 2-player camp is now full of humans; use a fresh 3-player camp for a bot.
    await setupCamp(3);
    await expect(db.asUser(UID.B, `select add_bot('${gameId}', 1)`)).rejects.toThrow(); // not host
    await db.asUser(UID.A, `select add_bot('${gameId}', 1)`);
    const [seat1] = await db.service(`select is_bot, ready from seats where game_id='${gameId}' and seat_index=1`);
    expect(seat1).toMatchObject({ is_bot: true, ready: true });
  });

  it('start_game requires every seat filled and is host-only', async () => {
    // One empty seat -> rejected.
    await expect(db.asUser(UID.A, `select start_game('${gameId}')`)).rejects.toThrow();
    // Fill seat 1 with a human, then start.
    await db.asUser(UID.B, `select * from join_camp('${code}', 'Dave', null)`);
    await expect(db.asUser(UID.B, `select start_game('${gameId}')`)).rejects.toThrow(); // not host
    await db.asUser(UID.A, `select start_game('${gameId}')`);
    const [g] = await db.service(`select status from games where id='${gameId}'`);
    expect(g!.status).toBe('playing');
  });
});

describe('get_game_state reconnect snapshot (REQUIREMENTS §6)', () => {
  beforeEach(async () => {
    await db.asUser(UID.B, `select * from join_camp('${code}', 'Dave', 'Oak')`);
  });

  it('returns the public game + seats to a seated player', async () => {
    const [row] = await db.asUser(UID.A, `select get_game_state('${gameId}') as state`);
    const state = row!.state as { game: { camp_code: string }; seats: unknown[]; my_cards: unknown[] };
    expect(state.game.camp_code).toBe(code);
    expect(state.seats).toHaveLength(2);
    expect(state.my_cards).toEqual([]); // no hand dealt yet
  });

  it('a non-member cannot get the snapshot', async () => {
    await expect(db.asUser(UID.C, `select get_game_state('${gameId}')`)).rejects.toThrow();
  });

  it('the snapshot carries only the caller own cards', async () => {
    // Deal a hand (service role, like the pipeline will).
    await db.service(`insert into hands(game_id, hand_number, dealer_seat, phase) values ('${gameId}',1,0,'pegging')`);
    await db.service(`
      insert into private_cards(game_id,hand_number,seat_index,player_id,kind,cards) values
        ('${gameId}',1,0,'${UID.A}','kept','["5C","5D","5H","JS"]'),
        ('${gameId}',1,1,'${UID.B}','kept','["2C","3D","4H","6S"]')
    `);
    const [rowA] = await db.asUser(UID.A, `select get_game_state('${gameId}') as state`);
    const stateA = rowA!.state as { my_cards: { cards: string[] }[] };
    expect(stateA.my_cards).toHaveLength(1);
    expect(stateA.my_cards[0]!.cards).toEqual(['5C', '5D', '5H', 'JS']); // A's, not B's
  });
});
