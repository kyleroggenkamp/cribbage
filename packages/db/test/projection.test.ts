/**
 * Integration test for the projection path that submit-action runs after every
 * action: write the public hand row + per-seat private_cards, then serve each
 * player's reconnect snapshot via get_game_state.
 *
 * This reproduces the live "empty hand / waiting for discards locks the game"
 * bug against the REAL schema: after one player discards, the other player's
 * own cards must still come back from get_game_state.
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
  await db.asUser(UID.B, `select * from join_camp('${(camp!.camp_code as string)}', 'Dave', 'Oak', 1)`);
  await db.asUser(UID.A, `select start_game('${gameId}')`);
});

/** Mirror the exact writes submit-action does for a projected hand. */
async function writeProjection(opts: {
  handNumber: number;
  phase: string;
  rows: { seat_index: number; player_id: string | null; kind: string; cards: string[] }[];
}) {
  await db.service(`insert into hands(game_id, hand_number, dealer_seat, phase, cards_left)
    values ('${gameId}', ${opts.handNumber}, 0, '${opts.phase}', '[4,6]'::jsonb)
    on conflict (game_id, hand_number) do update set phase = excluded.phase`);
  await db.service(`delete from private_cards where game_id='${gameId}' and hand_number=${opts.handNumber}`);
  const values = opts.rows
    .map(
      (r) =>
        `('${gameId}', ${opts.handNumber}, ${r.seat_index}, ${
          r.player_id ? `'${r.player_id}'` : 'null'
        }, '${r.kind}', '${JSON.stringify(r.cards)}'::jsonb)`,
    )
    .join(',');
  await db.service(
    `insert into private_cards(game_id, hand_number, seat_index, player_id, kind, cards) values ${values}`,
  );
}

function myCards(state: Record<string, unknown>) {
  return (state.my_cards ?? []) as { kind: string; cards: string[] }[];
}

describe('projection → get_game_state (the hidden-info snapshot)', () => {
  it('after player A discards, B (not yet discarded) still gets their dealt hand', async () => {
    // This is exactly what submit-action projects once seat 0 has discarded in
    // a 2-human game: A kept 4, B still holds the dealt 6, crib (shared) hidden.
    await writeProjection({
      handNumber: 1,
      phase: 'discarding',
      rows: [
        { seat_index: 0, player_id: UID.A, kind: 'kept', cards: ['9C', 'QC', '2S', '9D'] },
        { seat_index: 1, player_id: UID.B, kind: 'dealt', cards: ['8S', '2H', '5D', '8D', '3C', '7H'] },
        { seat_index: 0, player_id: null, kind: 'crib', cards: ['AC', 'AS'] },
      ],
    });

    const [a] = await db.asUser(UID.A, `select get_game_state('${gameId}') as s`);
    const [b] = await db.asUser(UID.B, `select get_game_state('${gameId}') as s`);
    const aState = (a!.s as Record<string, unknown>);
    const bState = (b!.s as Record<string, unknown>);

    // A sees only their kept 4 (crib still hidden pre-show).
    expect(myCards(aState).find((c) => c.kind === 'kept')?.cards).toHaveLength(4);
    // B — the bug: B must still see their dealt 6 so they can discard.
    expect(myCards(bState).find((c) => c.kind === 'dealt')?.cards).toHaveLength(6);
  });

  it('during pegging, each player still gets their own kept 4', async () => {
    await writeProjection({
      handNumber: 1,
      phase: 'pegging',
      rows: [
        { seat_index: 0, player_id: UID.A, kind: 'kept', cards: ['9C', 'QC', '2S', '9D'] },
        { seat_index: 1, player_id: UID.B, kind: 'kept', cards: ['8S', '2H', '5D', '8D'] },
        { seat_index: 0, player_id: null, kind: 'crib', cards: ['AC', 'AS', 'JH', 'QS'] },
      ],
    });

    const [a] = await db.asUser(UID.A, `select get_game_state('${gameId}') as s`);
    const [b] = await db.asUser(UID.B, `select get_game_state('${gameId}') as s`);
    expect(myCards(a!.s as Record<string, unknown>).find((c) => c.kind === 'kept')?.cards).toHaveLength(4);
    expect(myCards(b!.s as Record<string, unknown>).find((c) => c.kind === 'kept')?.cards).toHaveLength(4);
    // Neither sees the crib yet.
    expect(myCards(a!.s as Record<string, unknown>).some((c) => c.kind === 'crib')).toBe(false);
  });
});
