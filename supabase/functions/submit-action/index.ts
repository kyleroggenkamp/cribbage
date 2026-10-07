/**
 * Edge Function `submit-action` — the server-authoritative action pipeline
 * (REQUIREMENTS §6, §1A). It is a THIN shell: every rules decision lives in the
 * tested @deercamp/game state machine; this only moves data.
 *
 * Flow per call:
 *   verify caller (JWT) -> map to seat -> load engine_state blob ->
 *   reduce(action) -> runBots -> auto-deal next hand if the hand finished ->
 *   save blob -> project public rows (games/hands) + per-seat private_cards ->
 *   append to the action log (idempotent on the client action id).
 *
 * Hidden info never reaches a client: the blob lives in engine_state (no client
 * RLS access) and per-seat cards go to private_cards (RLS restricts to owner).
 *
 * NOTE: written to spec but NOT yet run against live Supabase from this repo
 * (the container has no Deno/Supabase). The pure core (reduce/project) is
 * covered by @deercamp/game tests; the start/deal orchestration + the upserts
 * below are what to verify first on a real project.
 */

import { createClient } from 'npm:@supabase/supabase-js@2';
import { makeDeck, cryptoShuffle } from '@deercamp/engine';
import {
  newGame,
  dealHand,
  reduce,
  runBots,
  project,
  type Action,
  type GameState,
} from '@deercamp/game';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  const url = Deno.env.get('SUPABASE_URL')!;
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const authHeader = req.headers.get('Authorization') ?? '';

  // Who is calling?
  const userClient = createClient(url, anonKey, { global: { headers: { Authorization: authHeader } } });
  const { data: { user } } = await userClient.auth.getUser();
  if (!user) return json(401, { error: 'not authenticated' });

  const svc = createClient(url, serviceKey);
  const { game_id: gameId, action } = (await req.json()) as { game_id: string; action: Action & { seat?: number } };

  const { data: game } = await svc.from('games').select('*').eq('id', gameId).single();
  if (!game) return json(404, { error: 'no such game' });
  const { data: seats } = await svc.from('seats').select('*').eq('game_id', gameId).order('seat_index');
  const mySeat = (seats ?? []).find((s) => s.player_id === user.id);
  if (!mySeat) return json(403, { error: 'not seated in this game' });

  // Load the authoritative blob, or initialise it the first time.
  const { data: es } = await svc.from('engine_state').select('state').eq('game_id', gameId).maybeSingle();
  let state: GameState;
  if (es) {
    state = es.state as GameState;
  } else {
    state = newGame(
      { playerCount: game.player_count, target: game.game_length, isBot: (seats ?? []).map((s) => s.is_bot) },
      game.dealer_seat ?? 0,
    );
    dealHand(state, cryptoShuffle(makeDeck()));
    runBots(state);
  }

  // Idempotent on the client action id (the §1A retry guarantee).
  const { data: already } = await svc.from('actions').select('id').eq('id', action.id).maybeSingle();
  if (!already && action.type !== 'deal') {
    if ('seat' in action && action.seat !== mySeat.seat_index) {
      return json(403, { error: 'that is not your seat' });
    }
    reduce(state, action as Action);
    runBots(state);
    // Deal the next hand automatically once one finishes and the game is live.
    if (state.hand && state.hand.phase === 'done' && state.status === 'playing') {
      reduce(state, { id: `deal:${state.handNumber + 1}`, type: 'deal', deck: cryptoShuffle(makeDeck()) });
      runBots(state);
    }
    await svc.from('actions').insert({
      id: action.id,
      game_id: gameId,
      hand_number: state.handNumber,
      seat_index: 'seat' in action ? action.seat : null,
      player_id: user.id,
      type: action.type,
      payload: action,
    });
  }

  // Persist the blob, then project the public-safe state.
  await svc.from('engine_state').upsert({ game_id: gameId, state, updated_at: new Date().toISOString() });
  const p = project(state);
  await svc.from('games').update({
    status: p.game.status,
    dealer_seat: p.game.dealer_seat,
    scores: p.game.scores,
    winner_unit: p.game.winner_unit,
  }).eq('id', gameId);

  if (p.hand) {
    await svc.from('hands').upsert({
      game_id: gameId,
      hand_number: p.hand.hand_number,
      dealer_seat: p.hand.dealer_seat,
      phase: p.hand.phase,
      starter: p.hand.starter,
      turn_seat: p.hand.turn_seat,
      running_count: p.hand.running_count,
      series: p.hand.series,
      cards_left: p.hand.cards_left,
    });
    await svc.from('private_cards').delete().eq('game_id', gameId).eq('hand_number', p.hand.hand_number);
    const seatPlayer = new Map((seats ?? []).map((s) => [s.seat_index, s.player_id]));
    await svc.from('private_cards').insert(
      p.privateCards.map((r) => ({
        game_id: gameId,
        hand_number: p.hand!.hand_number,
        seat_index: r.seat_index,
        player_id: r.shared ? null : seatPlayer.get(r.seat_index) ?? null,
        kind: r.kind,
        cards: r.cards,
      })),
    );
  }

  return json(200, { ok: true });
});
