import { supabase } from './supabase';
import { ensureSignedIn } from './auth';
import type { GameState, PlayerCount } from './types';

/** Thin typed wrappers over the lobby RPCs (supabase/migrations 0001/0002). */

export interface CreateCampOpts {
  playerCount: PlayerCount;
  gameLength: 61 | 121;
  skunk: boolean;
  manualCounting: boolean;
  muggins: boolean;
  standReport: 'each_hand' | 'end_of_game';
  themeId: string;
  displayName: string;
  standName: string | null;
}

export interface CampRef {
  game_id: string;
  camp_code: string;
  seat_index: number;
}

export async function createCamp(o: CreateCampOpts): Promise<CampRef> {
  await ensureSignedIn();
  const { data, error } = await supabase().rpc('create_camp', {
    p_player_count: o.playerCount,
    p_game_length: o.gameLength,
    p_skunk: o.skunk,
    p_manual: o.manualCounting,
    p_muggins: o.muggins,
    p_stand_report: o.standReport,
    p_theme: o.themeId,
    p_display_name: o.displayName,
    p_stand_name: o.standName,
  });
  if (error) throw error;
  return (data as CampRef[])[0]!;
}

export async function joinCamp(
  code: string,
  displayName: string,
  standName: string | null,
  seat?: number,
): Promise<{ game_id: string; seat_index: number }> {
  await ensureSignedIn();
  const { data, error } = await supabase().rpc('join_camp', {
    p_code: code.toUpperCase(),
    p_display_name: displayName,
    p_stand_name: standName,
    p_seat: seat ?? null,
  });
  if (error) throw error;
  return (data as { game_id: string; seat_index: number }[])[0]!;
}

export async function getGameState(gameId: string): Promise<GameState> {
  const { data, error } = await supabase().rpc('get_game_state', { p_game: gameId });
  if (error) throw error;
  return data as GameState;
}

export async function updateSeatSettings(
  gameId: string,
  settings: { silent?: boolean; standMode?: boolean; notifications?: boolean },
): Promise<void> {
  const { error } = await supabase().rpc('update_seat_settings', {
    p_game: gameId,
    p_silent: settings.silent ?? null,
    p_stand_mode: settings.standMode ?? null,
    p_notifications: settings.notifications ?? null,
  });
  if (error) throw error;
}

export async function setReady(gameId: string, ready: boolean): Promise<void> {
  const { error } = await supabase().rpc('set_ready', { p_game: gameId, p_ready: ready });
  if (error) throw error;
}

export async function addBot(gameId: string, seat: number): Promise<void> {
  const { error } = await supabase().rpc('add_bot', { p_game: gameId, p_seat: seat });
  if (error) throw error;
}

export async function removeBot(gameId: string, seat: number): Promise<void> {
  const { error } = await supabase().rpc('remove_bot', { p_game: gameId, p_seat: seat });
  if (error) throw error;
}

export async function startGame(gameId: string): Promise<void> {
  const { error } = await supabase().rpc('start_game', { p_game: gameId });
  if (error) throw error;
}
