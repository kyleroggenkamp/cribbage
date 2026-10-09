-- Fix: a player already seated in a game must be able to REJOIN after the game
-- has started (the §6 reconnect path — e.g. refreshing the tab mid-game).
--
-- The original join_camp raised 'camp already started' whenever status <>
-- 'lobby', BEFORE checking whether the caller was already seated. So a seated
-- player who refreshed after the host started the game got rejected from their
-- own game. Reorder: the idempotent "already seated -> return your seat" check
-- comes first; the status gate only blocks NEW players from joining a game in
-- progress.

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

  -- Already seated? Return the existing seat (idempotent rejoin / reconnect).
  -- This MUST come before the status gate so a seated player can rejoin a game
  -- that is already in progress.
  select s.seat_index into v_seat from public.seats s
    where s.game_id = v_game.id and s.player_id = v_uid;
  if found then
    return query select v_game.id, v_seat;
    return;
  end if;

  -- A new player can only take a seat while the camp is still in the lobby.
  if v_game.status <> 'lobby' then raise exception 'camp already started'; end if;

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
