import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDb, UID, type TestDb } from './harness.js';

let db: TestDb;
beforeEach(async () => {
  db = await createTestDb();
});

function createCamp(uid: string, pc = 2, len = 121) {
  return db.asUser(
    uid,
    `select * from create_camp(${pc}::smallint, ${len}::smallint, true, false, false,
       'each_hand', 'deer-camp', 'Host', 'Ridge stand')`,
  );
}

describe('create_camp (REQUIREMENTS §2)', () => {
  it('creates a game, a 5-char look-alike-free code, and seats the host', async () => {
    const [row] = await createCamp(UID.A);
    expect(String(row!.camp_code)).toMatch(/^[A-HJ-NP-Z2-9]{5}$/); // no O/0/I/1/L
    expect(row!.seat_index).toBe(0);

    const seats = await db.service(
      `select seat_index, player_id from seats where game_id = '${row!.game_id}' order by seat_index`,
    );
    expect(seats).toHaveLength(2);
    expect(seats[0]!.player_id).toBe(UID.A);
    expect(seats[1]!.player_id).toBeNull();
  });

  it('rejects a 61-point game that is not 2-player', async () => {
    await expect(createCamp(UID.A, 3, 61)).rejects.toThrow();
  });

  it('pairs opposite seats into teams in 4-player', async () => {
    const [row] = await createCamp(UID.A, 4);
    const seats = await db.service(
      `select seat_index, team from seats where game_id = '${row!.game_id}' order by seat_index`,
    );
    expect(seats.map((s) => s.team)).toEqual([0, 1, 0, 1]);
  });
});

describe('join_camp (REQUIREMENTS §2)', () => {
  it('seats a second player by code', async () => {
    const [camp] = await createCamp(UID.A);
    const code = camp!.camp_code as string;
    const [joined] = await db.asUser(UID.B, `select * from join_camp('${code}', 'Dave', 'Oak')`);
    expect(joined!.seat_index).toBe(1);

    const seat1 = await db.service(
      `select player_id, display_name from seats where game_id='${camp!.game_id}' and seat_index=1`,
    );
    expect(seat1[0]!.player_id).toBe(UID.B);
    expect(seat1[0]!.display_name).toBe('Dave');
  });

  it('is idempotent: re-joining returns the same seat', async () => {
    const [camp] = await createCamp(UID.A);
    const code = camp!.camp_code as string;
    const [first] = await db.asUser(UID.B, `select * from join_camp('${code}', 'Dave', null)`);
    const [again] = await db.asUser(UID.B, `select * from join_camp('${code}', 'Dave', null)`);
    expect(again!.seat_index).toBe(first!.seat_index);
  });

  it('lets a seated player rejoin after the game has started (reconnect §6)', async () => {
    const [camp] = await createCamp(UID.A);
    const code = camp!.camp_code as string;
    const gameId = camp!.game_id as string;
    await db.asUser(UID.B, `select * from join_camp('${code}', 'Dave', null)`); // fill seat 1
    await db.asUser(UID.A, `select start_game('${gameId}')`); // status -> playing

    // Both seated players must still be able to rejoin (e.g. refresh the tab).
    const [hostAgain] = await db.asUser(UID.A, `select * from join_camp('${code}', 'Host', 'Ridge stand')`);
    const [daveAgain] = await db.asUser(UID.B, `select * from join_camp('${code}', 'Dave', null)`);
    expect(hostAgain!.seat_index).toBe(0);
    expect(daveAgain!.seat_index).toBe(1);

    // But a NEW player still cannot join a game in progress.
    await expect(
      db.asUser(UID.C, `select * from join_camp('${code}', 'Mike', null)`),
    ).rejects.toThrow(/already started/);
  });

  it('rejects a full camp and an unknown code', async () => {
    const [camp] = await createCamp(UID.A); // 2-player
    const code = camp!.camp_code as string;
    await db.asUser(UID.B, `select * from join_camp('${code}', 'Dave', null)`); // fills seat 1
    await expect(
      db.asUser(UID.C, `select * from join_camp('${code}', 'Mike', null)`),
    ).rejects.toThrow();
    await expect(
      db.asUser(UID.C, `select * from join_camp('ZZZZZ', 'Mike', null)`),
    ).rejects.toThrow();
  });
});
