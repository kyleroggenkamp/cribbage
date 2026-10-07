-- Public per-seat remaining card counts, so the table can show how many cards
-- each opponent is holding (public info in cribbage — not the cards themselves).
-- Projected from the engine state into the hands row by submit-action.
alter table public.hands add column cards_left jsonb not null default '[]'::jsonb;
