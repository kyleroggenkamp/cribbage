-- Lobby RPCs: seat settings, ready, bots, start, and the reconnect snapshot.
-- REQUIREMENTS §2 (fill seats, start), §1A (per-player silent/stand settings),
-- §6 (reconnect fetches full state; a client only ever gets its OWN cards).
--
-- All are SECURITY DEFINER and check auth.uid()/host explicitly, so they can
-- act across the lobby while never leaking another player's private cards.

create or replace function public.is_host(p_game uuid, p_uid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.games g where g.id = p_game and g.host_player_id = p_uid);
$$;

-- A player updates their OWN seat's per-device settings (§1A). NULL = leave as-is.
create or replace function public.update_seat_settings(
  p_game uuid, p_silent boolean, p_stand_mode boolean, p_notifications boolean
) returns void language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'not authenticated'; end if;
  update public.seats s set
    silent = coalesce(p_silent, s.silent),
    stand_mode = coalesce(p_stand_mode, s.stand_mode),
    notifications_enabled = coalesce(p_notifications, s.notifications_enabled)
  where s.game_id = p_game and s.player_id = v_uid;
  if not found then raise exception 'not seated in this game'; end if;
end;
$$;

create or replace function public.set_ready(p_game uuid, p_ready boolean)
returns void language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'not authenticated'; end if;
  update public.seats s set ready = p_ready
    where s.game_id = p_game and s.player_id = v_uid;
  if not found then raise exception 'not seated in this game'; end if;
end;
$$;

-- Host fills an empty seat with a camp bot (§2). Bots are "ready" by definition.
create or replace function public.add_bot(p_game uuid, p_seat int)
returns void language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid();
begin
  if not public.is_host(p_game, v_uid) then raise exception 'host only'; end if;
  if not exists (select 1 from public.games g where g.id = p_game and g.status = 'lobby') then
    raise exception 'camp not in lobby';
  end if;
  update public.seats s set is_bot = true, player_id = null,
         display_name = 'Camp bot', stand_name = null, ready = true
    where s.game_id = p_game and s.seat_index = p_seat
      and s.player_id is null and s.is_bot = false;
  if not found then raise exception 'seat is not empty'; end if;
end;
$$;

create or replace function public.remove_bot(p_game uuid, p_seat int)
returns void language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid();
begin
  if not public.is_host(p_game, v_uid) then raise exception 'host only'; end if;
  update public.seats s set is_bot = false, display_name = null, ready = false
    where s.game_id = p_game and s.seat_index = p_seat and s.is_bot = true;
  if not found then raise exception 'no bot in that seat'; end if;
end;
$$;

-- Host starts the game once every seat is filled (by a human or a bot). The
-- first deal itself is done by the action pipeline (next build step).
create or replace function public.start_game(p_game uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_open int;
begin
  if not public.is_host(p_game, v_uid) then raise exception 'host only'; end if;
  if not exists (select 1 from public.games g where g.id = p_game and g.status = 'lobby') then
    raise exception 'camp not in lobby';
  end if;
  select count(*) into v_open from public.seats s
    where s.game_id = p_game and s.player_id is null and s.is_bot = false;
  if v_open > 0 then raise exception 'seats still open'; end if;
  update public.games set status = 'playing', last_move_at = now() where id = p_game;
end;
$$;

-- The reconnect snapshot (§6): public game + seats + the current hand, plus the
-- CALLER'S OWN private cards only. Never another player's cards.
create or replace function public.get_game_state(p_game uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_hand int;
begin
  if not public.is_seated(p_game, v_uid) then raise exception 'not seated in this game'; end if;
  select max(h.hand_number) into v_hand from public.hands h where h.game_id = p_game;
  return jsonb_build_object(
    'game',  (select to_jsonb(g) from public.games g where g.id = p_game),
    'seats', (select coalesce(jsonb_agg(to_jsonb(s) order by s.seat_index), '[]'::jsonb)
                from public.seats s where s.game_id = p_game),
    'hand',  (select to_jsonb(h) from public.hands h
                where h.game_id = p_game and h.hand_number = v_hand),
    'my_cards', (select coalesce(jsonb_agg(jsonb_build_object('kind', pc.kind, 'cards', pc.cards)), '[]'::jsonb)
                   from public.private_cards pc
                   where pc.game_id = p_game and pc.player_id = v_uid and pc.hand_number = v_hand)
  );
end;
$$;

grant execute on function public.update_seat_settings(uuid, boolean, boolean, boolean) to authenticated;
grant execute on function public.set_ready(uuid, boolean) to authenticated;
grant execute on function public.add_bot(uuid, int) to authenticated;
grant execute on function public.remove_bot(uuid, int) to authenticated;
grant execute on function public.start_game(uuid) to authenticated;
grant execute on function public.get_game_state(uuid) to authenticated;
