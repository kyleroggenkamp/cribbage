-- Server-authoritative engine state + public scores. REQUIREMENTS §6.
--
-- The full @deercamp/game state (the shuffled deck, every hidden hand, the
-- pegging internals) is the source of truth between actions. It is stored as a
-- JSONB blob that NO client can read — only the service role (Edge Functions)
-- touches it. The Edge Function projects the public-safe parts of that blob
-- into games/hands/seats and each player's own rows into private_cards, so RLS,
-- Realtime, and the reconnect snapshot keep working unchanged.

create table public.engine_state (
  game_id    uuid primary key references public.games(id) on delete cascade,
  state      jsonb not null,
  updated_at timestamptz not null default now()
);

-- RLS on, and deliberately NO policies + NO grants to anon/authenticated:
-- clients can neither read nor write it. (The service role bypasses RLS.)
alter table public.engine_state enable row level security;

-- Public per-unit scores live on the game row (readable via games_select).
alter table public.games add column scores jsonb not null default '[]'::jsonb;
