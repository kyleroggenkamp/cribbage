-- Deer Camp Cribbage — core schema, RLS, and lobby RPCs. REQUIREMENTS §6, §7A.
--
-- Design rules enforced here:
--   * Clients never write game tables directly. All writes go through
--     SECURITY DEFINER functions (lobby RPCs here; the action pipeline later)
--     or the service role (Edge Functions). Clients only SELECT, filtered by RLS.
--   * Hidden information (another player's hand, the crib before the show) is
--     walled off by RLS on `private_cards`, not by the UI.
--
-- Assumes the Supabase-provided `auth` schema, `auth.uid()`, and the
-- `authenticated` / `service_role` roles exist (they do on Supabase; the test
-- harness shims them for PGlite).

-- ---------------------------------------------------------------------------
-- Tables (public-safe rows carry NO hidden cards; cards live in private_cards)
-- ---------------------------------------------------------------------------

create table public.games (
  id              uuid primary key default gen_random_uuid(),
  camp_code       text not null unique,
  player_count    smallint not null check (player_count in (2, 3, 4)),
  game_length     smallint not null check (game_length in (61, 121)),
  skunk           boolean not null default true,
  manual_counting boolean not null default false,
  muggins         boolean not null default false,
  stand_report    text not null default 'each_hand'
                    check (stand_report in ('each_hand', 'end_of_game')),
  theme_id        text not null default 'deer-camp',
  status          text not null default 'lobby'
                    check (status in ('lobby', 'playing', 'over')),
  host_player_id  uuid not null,
  dealer_seat     smallint,
  hold_by_seat    smallint,
  hold_at         timestamptz,
  engine_version  text,
  grader_version  text,
  winner_unit     smallint,
  created_at      timestamptz not null default now(),
  last_move_at    timestamptz not null default now(),
  expires_at      timestamptz not null default now() + interval '3 days'
);

create table public.seats (
  game_id               uuid not null references public.games(id) on delete cascade,
  seat_index            smallint not null,
  team                  smallint not null,
  player_id             uuid,
  display_name          text,
  stand_name            text,
  is_bot                boolean not null default false,
  ready                 boolean not null default false,
  silent                boolean not null default true,   -- §1A: silent on by default
  stand_mode            boolean not null default true,   -- §1A: dim on by default
  notifications_enabled boolean not null default false,
  connection_status     text not null default 'offline',
  last_seen_at          timestamptz,
  primary key (game_id, seat_index)
);
create index seats_player_idx on public.seats(player_id);

create table public.hands (
  game_id       uuid not null references public.games(id) on delete cascade,
  hand_number   int not null,
  dealer_seat   smallint not null,
  phase         text not null default 'dealing'
                  check (phase in ('dealing','discarding','cut','pegging','show','done')),
  starter       text,                 -- only set after the cut
  turn_seat     smallint,
  running_count smallint not null default 0,
  series        jsonb not null default '[]'::jsonb,  -- current pegging series
  created_at    timestamptz not null default now(),
  primary key (game_id, hand_number)
);

-- The hidden-information wall.
create table public.private_cards (
  id          uuid primary key default gen_random_uuid(),
  game_id     uuid not null references public.games(id) on delete cascade,
  hand_number int not null,
  seat_index  smallint not null,
  player_id   uuid,                   -- owner; NULL for the crib and for bots
  kind        text not null check (kind in ('dealt','kept','crib')),
  cards       jsonb not null,
  created_at  timestamptz not null default now()
);
create index private_cards_lookup_idx
  on public.private_cards(game_id, hand_number, seat_index);

-- Append-only action log. Client-generated id => idempotent retries (§1A).
create table public.actions (
  id          uuid primary key,       -- supplied by the client
  game_id     uuid not null references public.games(id) on delete cascade,
  hand_number int,
  seat_index  smallint,
  player_id   uuid,
  type        text not null,
  payload     jsonb not null default '{}'::jsonb,
  seq         bigserial,
  created_at  timestamptz not null default now()
);
create index actions_game_idx on public.actions(game_id, seq);

-- ---------------------------------------------------------------------------
-- Helper predicates (SECURITY DEFINER so they bypass RLS and don't recurse)
-- ---------------------------------------------------------------------------

create or replace function public.is_seated(p_game uuid, p_uid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.seats s
    where s.game_id = p_game and s.player_id = p_uid
  );
$$;

create or replace function public.hand_revealed(p_game uuid, p_hand int)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.hands h
    where h.game_id = p_game and h.hand_number = p_hand
      and h.phase in ('show', 'done')
  );
$$;

create or replace function public.is_game_over(p_game uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.games g where g.id = p_game and g.status = 'over'
  );
$$;

-- ---------------------------------------------------------------------------
-- Row-level security
-- ---------------------------------------------------------------------------

alter table public.games         enable row level security;
alter table public.seats         enable row level security;
alter table public.hands         enable row level security;
alter table public.private_cards enable row level security;
alter table public.actions       enable row level security;

-- Seated players read their own game's public rows. No client write policies
-- exist, so clients cannot write these tables at all (only definer RPCs / the
-- service role can).
create policy games_select on public.games for select to authenticated
  using (public.is_seated(id, auth.uid()));

create policy seats_select on public.seats for select to authenticated
  using (public.is_seated(game_id, auth.uid()));

create policy hands_select on public.hands for select to authenticated
  using (public.is_seated(game_id, auth.uid()));

-- THE WALL: you always see your own cards; everyone seated sees all cards only
-- once the hand is revealed (the show). The crib (player_id NULL) is therefore
-- invisible to everyone until the show, then visible to all seated players.
create policy private_cards_select on public.private_cards for select to authenticated
  using (
    player_id = auth.uid()
    or (public.is_seated(game_id, auth.uid()) and public.hand_revealed(game_id, hand_number))
  );

-- You can read your own actions live; the full log opens only once the game is
-- over (for replay / season stats).
create policy actions_select on public.actions for select to authenticated
  using (
    player_id = auth.uid()
    or (public.is_seated(game_id, auth.uid()) and public.is_game_over(game_id))
  );

-- ---------------------------------------------------------------------------
-- Lobby RPCs (SECURITY DEFINER: they create games / read by code, bypassing
-- the SELECT policies above, which is how a player reaches a game pre-seat)
-- ---------------------------------------------------------------------------

-- A 5-char code from an alphabet with no look-alikes (no O/0, I/1/L). §2
create or replace function public.generate_camp_code()
returns text language plpgsql as $$
declare
  alphabet constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  code text;
  i int;
begin
  loop
    code := '';
    for i in 1..5 loop
      code := code || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    end loop;
    exit when not exists (select 1 from public.games where camp_code = code);
  end loop;
  return code;
end;
$$;

-- team for a seat: 4-player pairs opposite seats; otherwise each seat is its own.
create or replace function public.team_of(p_player_count smallint, p_seat int)
returns smallint language sql immutable as $$
  select case when p_player_count = 4 then (p_seat % 2)::smallint else p_seat::smallint end;
$$;

create or replace function public.create_camp(
  p_player_count smallint,
  p_game_length  smallint,
  p_skunk        boolean,
  p_manual       boolean,
  p_muggins      boolean,
  p_stand_report text,
  p_theme        text,
  p_display_name text,
  p_stand_name   text
) returns table (game_id uuid, camp_code text, seat_index int)
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_game uuid;
  v_code text;
  i int;
begin
  if v_uid is null then raise exception 'not authenticated'; end if;
  if p_game_length = 61 and p_player_count <> 2 then
    raise exception '61-point games are 2-player only';
  end if;

  v_code := public.generate_camp_code();
  insert into public.games(camp_code, player_count, game_length, skunk,
                           manual_counting, muggins, stand_report, theme_id,
                           host_player_id)
  values (v_code, p_player_count, p_game_length, p_skunk, p_manual, p_muggins,
          coalesce(p_stand_report, 'each_hand'), coalesce(p_theme, 'deer-camp'), v_uid)
  returning id into v_game;

  -- Create every seat; seat the host at seat 0.
  for i in 0..(p_player_count - 1) loop
    insert into public.seats(game_id, seat_index, team, player_id, display_name, stand_name)
    values (v_game, i, public.team_of(p_player_count, i),
            case when i = 0 then v_uid end,
            case when i = 0 then p_display_name end,
            case when i = 0 then p_stand_name end);
  end loop;

  return query select v_game, v_code, 0;
end;
$$;

create or replace function public.join_camp(
  p_code         text,
  p_display_name text,
  p_stand_name   text,
  p_seat         int default null
) returns table (game_id uuid, seat_index int)
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_game public.games;
  v_seat int;
begin
  if v_uid is null then raise exception 'not authenticated'; end if;

  select * into v_game from public.games where camp_code = upper(p_code);
  if not found then raise exception 'no such camp'; end if;
  if v_game.status <> 'lobby' then raise exception 'camp already started'; end if;

  -- Already seated? Return the existing seat (idempotent rejoin).
  select s.seat_index into v_seat from public.seats s
    where s.game_id = v_game.id and s.player_id = v_uid;
  if found then
    return query select v_game.id, v_seat;
    return;
  end if;

  -- Pick the requested empty seat, else the first empty one.
  if p_seat is not null then
    select s.seat_index into v_seat from public.seats s
      where s.game_id = v_game.id and s.seat_index = p_seat and s.player_id is null;
    if not found then raise exception 'seat taken or invalid'; end if;
  else
    select s.seat_index into v_seat from public.seats s
      where s.game_id = v_game.id and s.player_id is null
      order by s.seat_index limit 1;
    if not found then raise exception 'camp is full'; end if;
  end if;

  -- Alias the target: unqualified game_id/seat_index would collide with this
  -- function's OUT parameters of the same name.
  update public.seats s
    set player_id = v_uid, display_name = p_display_name, stand_name = p_stand_name
    where s.game_id = v_game.id and s.seat_index = v_seat;

  return query select v_game.id, v_seat;
end;
$$;

-- ---------------------------------------------------------------------------
-- Grants. RLS still filters every SELECT; these just open the door.
-- ---------------------------------------------------------------------------
grant select on public.games, public.seats, public.hands,
                 public.private_cards, public.actions to authenticated;
grant execute on function public.create_camp(smallint, smallint, boolean, boolean,
       boolean, text, text, text, text) to authenticated;
grant execute on function public.join_camp(text, text, text, int) to authenticated;
