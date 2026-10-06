/** Shapes returned by the lobby RPCs (mirror supabase/migrations). */

export type PlayerCount = 2 | 3 | 4;
export type GameStatus = 'lobby' | 'playing' | 'over';

export interface GameRow {
  id: string;
  camp_code: string;
  player_count: PlayerCount;
  game_length: 61 | 121;
  skunk: boolean;
  manual_counting: boolean;
  muggins: boolean;
  stand_report: 'each_hand' | 'end_of_game';
  theme_id: string;
  status: GameStatus;
  host_player_id: string;
  dealer_seat: number | null;
  created_at: string;
}

export interface SeatRow {
  game_id: string;
  seat_index: number;
  team: number;
  player_id: string | null;
  display_name: string | null;
  stand_name: string | null;
  is_bot: boolean;
  ready: boolean;
  silent: boolean;
  stand_mode: boolean;
  notifications_enabled: boolean;
  connection_status: string;
}

export interface HandRow {
  game_id: string;
  hand_number: number;
  dealer_seat: number;
  phase: string;
  starter: string | null;
  turn_seat: number | null;
  running_count: number;
}

export interface GameState {
  game: GameRow;
  seats: SeatRow[];
  hand: HandRow | null;
  my_cards: { kind: string; cards: string[] }[];
}
