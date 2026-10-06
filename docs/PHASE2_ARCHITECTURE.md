# Phase 2 architecture sketch — the multiplayer game

Status: **draft for review.** This is a design sketch, not built code. It turns
the Phase 2 requirements (REQUIREMENTS §§1A, 2, 5, 6, 7, 7A, and the server-side
parts of §4A) into concrete components, a data model, and a build order. Where
the spec leaves a choice open, this doc makes a recommendation and marks it so
you can override — see **§18 Decisions I need your call on**.

---

## 1. Principles (straight from the brief, don't violate these)

1. **Server-authoritative.** Clients send *actions only* ("discard these",
   "play this"). The server validates every action with the rules engine and
   owns all state. Never trust the client. (§6)
2. **"The server" is Supabase, not Next.js.** The Next.js app is a **static
   export** — no API routes, no server actions, no middleware, no SSR. All
   server logic lives in Supabase Edge Functions + Postgres. (§6, §7A)
3. **Hidden information is enforced in the database (RLS), not hidden in the
   UI.** Opening dev tools must never reveal another player's hand, the crib
   before the show, or the deck order. (§6)
4. **The engine package is the single source of truth for rules**, imported by
   *both* the web app and the Edge Functions. No rule logic is reimplemented in
   SQL or the client. (§7A)
5. **Nothing blocks on a slow network or a slow player.** No turn timers; every
   action is idempotent and retried; reconnect refetches full state. (§1A)
6. **Stay native-ready.** Device features behind small interfaces; no choice
   that blocks a later Capacitor wrapper. (§7A)

---

## 2. System components

```
          Player phones (installed PWA, static files on Vercel/CDN)
          ┌───────────────────────────────────────────────┐
          │  Next.js static export (apps/web)              │
          │   - React UI, pegboard, theme                  │
          │   - @deercamp/engine (client-side, for         │
          │     OPTIMISTIC display + input validation only)│
          │   - device/* interfaces (haptics, push, ...)   │
          │   - offline action queue (IndexedDB)           │
          └───────▲───────────────────────────┬────────────┘
                  │ Realtime (RLS-filtered)    │ RPC / Edge Function calls
                  │ state + private cards       │ (authenticated with anon JWT)
          ┌───────┴───────────────────────────▼────────────┐
          │  Supabase                                       │
          │   Postgres + RLS  ◄── the only writable store   │
          │   Edge Functions (Deno) ── import @deercamp/    │
          │     engine ── validate actions, grade, push     │
          │   Realtime ── broadcasts row changes            │
          │   Auth ── anonymous users (upgradeable)         │
          └─────────────────────────────────────────────────┘
                  │ web-push (VAPID) on turn change / hold end
                  ▼
          Phone OS push (works while app closed / phone locked)
```

The client carries a **copy of the engine** too, but only to render optimistic
previews and to stop obviously-illegal inputs early. The server's engine run is
the one that counts. Both import the exact same package, so they can't disagree.

---

## 3. Repo layout (adds to the current monorepo)

```
packages/
  engine/                 # DONE — pure rules engine + grader + bots
apps/
  web/                    # Next.js App Router, output: 'export'
    app/                  # routes (see §15 for the static-export routing note)
    src/
      device/             # haptics.ts, notifications.ts, wakelock.ts,
                          #   share.ts, storage.ts  (§7A small interfaces)
      net/                # supabase client, action queue, realtime hooks
      state/              # client store (game state from realtime)
      themes/
        deer-camp/        # tokens, vocabulary, razz list, art (§5.1A)
        plain/            # throwaway test theme (acceptance proof, not shipped)
      ui/                 # components: pegboard, table, lobby, count, hold...
supabase/
  migrations/             # SQL: tables, RLS policies, RPCs, triggers
  functions/              # Edge Functions (Deno); import the engine
    _shared/              # engine import map + helpers
    submit-action/
    join-camp/
    grade-hand/
    send-push/
```

`@deercamp/engine` is consumed by `apps/web` through the npm workspace and by
`supabase/functions` through a Deno import map (see §5).

---

## 4. The central integration concern: the engine in three runtimes

The engine must run in the **browser** (web), in **Deno** (Edge Functions), and
in **Node** (its own Vitest tests, already green). It already avoids Node-only
APIs — it uses only `globalThis.crypto` (present in all three) and pure TS with
explicit `.js` ESM import specifiers (which Deno also wants). So the code is
portable; the only work is *wiring*:

- **Web:** imported via the workspace, bundled by Next's bundler. No change.
- **Deno Edge Functions:** import map aliasing `@deercamp/engine` to the
  engine's **built** `dist/index.js` (not the source — see the step-0 finding
  below). The engine's seeded RNG and crypto shuffle both work on Deno.

**Step 0 is DONE (spike built, risk retired).** Finding: Deno does **not**
rewrite the engine's `.js` import specifiers to the `.ts` source files, so the
engine must be **built to real `.js` first** (`npm run build -w
@deercamp/engine` → `dist/`), and the import map points at `dist/index.js`.
Verified without Deno (the container can't fetch the Deno binary): the built
dist imports and scores as plain ESM with Web-Crypto shuffle
(`npm run verify:dist`), and `grep` confirms zero Node-only APIs in dist. The
Edge Function (`supabase/functions/score-hand`), import map, and a one-command
deploy/serve recipe are in `supabase/`. Final "deployed and called" is one
command on your machine (you have the Supabase project; this container has no
credentials). See `supabase/README.md`.

> Fallback if local-path import into Edge Functions proves painful: add a build
> step that bundles the engine to a single ESM file the function imports, or
> publish it to a private registry / JSR. Prefer the import map; keep this in
> reserve.

---

## 5. Data model (Postgres)

Tables, with the **intent** of each (exact columns settled in the migration).
Everything a client can see flows through RLS; clients never write game tables
directly — they call Edge Functions / security-definer RPCs.

| Table | Holds | Who can read (RLS) |
|---|---|---|
| `games` | camp code, player count, length, options, theme id, status (lobby/playing/hold/golden-hour/over), dealer seat, hold state, engine+grader versions, timestamps, expiry | seated players (public-safe columns only — **no cards here**) |
| `seats` | seat index, team, player id, display + stand name, is_bot, ready, per-player settings (silent, stand mode, notifications on), connection status | seated players |
| `hands` | hand number, dealer seat, **public** phase (discarding/pegging/show/done), starter (only after cut), pegging series + running count, scores | seated players (still no hidden cards) |
| `private_cards` | each seat's dealt + kept cards, and the crib | **owner only** (`player_id = auth.uid()`); crib row readable by all **only** once the hand reaches `show` |
| `actions` | append-only log: client-generated uuid, seat, type, payload, sequence, timestamp | your **own** actions live; the **full** log only after the game is over |
| `grades` | per hand/player: discard/pegging points lost, luck components, hindsight | **staged** — see §12 (numbers-only at crib-set, full after show, hindsight-at-cut owner-only) |
| `razzes` | from, to (player or all), message key, hand | recipient(s) |
| `push_subscriptions` | endpoint + keys per device | owner only |
| `flags` | "something's off" reports | stored; readable by host / out-of-band |

Key RLS rules:
- `private_cards`: `SELECT` policy `player_id = auth.uid()`. **No** client
  write policy at all — only Edge Functions (service role) write it. This is
  the wall that stops a dev-tools user reading another hand.
- The `games`/`hands` public rows are **public-safe by construction**: they
  never contain a card that isn't legally visible. The broadcast payload is the
  row itself, so there's nothing secret to leak.
- `actions` full-log read is gated on `games.status = 'over'`.

---

## 6. Security model for hidden information (the §6 hard requirement)

Every hidden thing and how it's protected:

| Hidden thing | Protection |
|---|---|
| Another player's dealt/kept hand | `private_cards` RLS, owner-only. Never in any public row or broadcast. |
| The crib before the show | crib stored in `private_cards`; its read policy opens only when `hands.phase = 'show'`. |
| The deck order | lives only inside the Edge Function during the deal; the shuffled remainder is never stored client-readable. Starter is written only when cut. |
| Discard grades before all discards locked | `grades` row not written / not readable until the crib is set. |
| Kept-hand values, best throw, pegging grades before the show | staged release, §12. |
| Hindsight-at-cut line | written to an owner-only row; delivered only to that player. |

**Security tests (from §8) this must pass:** a player's API/DB request cannot
return another player's hand; no grading data reaches any client until all
discards are locked; after that only discard rank + points lost until the show
is complete; before the show only the owner's phone gets their hindsight line.
We write these as Playwright/integration tests that hit Supabase with one
player's JWT and assert the other's cards are unreachable.

---

## 7. The action pipeline (how a turn flows)

One Edge Function, `submit-action`, is the throat everything passes through.

```
client: user taps "Play 7♥"
  -> enqueue action {id: uuid, type:'play', payload:{card:'7H'}} in IndexedDB
  -> mark card "sending…"
  -> POST submit-action (with the player's JWT)

submit-action (Deno, service role, inside one DB transaction):
  1. auth.uid() -> which seat? reject if not this player's seat.
  2. idempotency: has this action id been applied? if yes, return current
     state unchanged (safe retry — §1A).
  3. load full game + this player's private cards.
  4. is the game held / in golden hour? if so, reject everything except the
     allowed resume/release (§1A).
  5. validate with @deercamp/engine (is it this seat's turn? is the play legal?).
  6. apply the state transition with the engine (update count/series/scores,
     detect 15/31/pairs/runs/go/last-card, advance turn, detect a win).
  7. write: new public state rows + append to `actions` (with version stamps).
  8. if the next player to act is a BOT, compute its move with the engine bot
     and apply it too — loop until a human is next or the hand ends.
  9. commit. Realtime broadcasts the changed rows. Fire push on turn change.
  10. if this action locked the crib or completed the show, kick off grading
      (§12), asynchronously.

client: on the broadcast, reconcile; drop the "sending…" marker for confirmed
actions. On failure, the queue retries with backoff until confirmed.
```

Idempotency (step 2) is what makes the §1A weak-signal retry safe: the same
action id can arrive twice and only applies once.

**Bot pacing (step 8):** the server applies bot moves immediately but stamps
them; the client animates the 1–2 s reveal (§4 of the brief). The server never
sleeps inside a function — keeps functions short and cheap.

---

## 8. Realtime + reconnect

- **Transport: Postgres Changes (RLS-filtered), not Broadcast.** Postgres
  Changes respects RLS per subscriber, so private-card rows reach only their
  owner automatically. Broadcast does not enforce RLS, so it's the wrong tool
  for anything secret. Each client subscribes to: the public game/hand rows for
  their game, their own `private_cards`, and `grades`/`razzes` addressed to
  them. (Recommendation — §18.)
- **Reconnect = full refetch, not replay (§1A).** One RPC `get_game_state`
  returns the public state + the caller's private cards in a single response.
  On any disconnect the client calls it and rebuilds; it never tries to replay
  missed events. Because all state is server-side, a phone that dies and
  restarts rejoins with nothing lost.
- **Connection status** in the top bar (connected / weak / offline) comes from
  the Realtime socket state plus recent request success. No polling loop.

---

## 9. Weak-signal handling (§1A)

- **Offline action queue** in IndexedDB (behind `device/storage.ts`). Every
  action has a client uuid; the queue persists across app restarts.
- Send → "sending…" → confirmed-by-broadcast → dequeued. Failures retry with
  exponential backoff; the move is never silently lost.
- Small payloads only; all art is bundled (no server images during play).
- The server's idempotency guarantees at-most-once application.

This is directly testable (§8): with Playwright offline mode, submit a move
offline, go online, assert it applied exactly once.

---

## 10. Deer! hold, no timers, bot fill (§1A)

- **Hold** is server state on `games` (who called it, when). A `hold` action
  freezes the game; `submit-action` then rejects everything except `resume` by
  the holder or `release` by the host (with a confirm step client-side). Hold
  survives disconnects because it's server-side. On release, one
  vibration/notification to everyone via the device interfaces; play resumes
  exactly where it stopped. No bot takeover, no notifications, no golden-hour
  transition while held.
- **No turn timers** anywhere. The "replace with bot" option is a *host action*
  that only becomes available after a seat has been unreachable 10+ minutes,
  never during a hold, never automatic.
- The 3-second minimum on count screens is a client-side gate; counts never
  auto-advance (each phone advances itself).

---

## 11. Server-side grading pipeline (§4A, the heart of the app)

Grading runs on the server (§4A.1) so cards never leak and the client can't be
trusted. Two trigger points invoke `grade-hand`:

1. **Crib set** → compute each player's **discard score** and write
   numbers-only `grades` rows (rank position + points given away). No cards, no
   kept-hand values, no best option. This feeds the discard scoreboard (§4A.5).
   Must land within ~2 s (the engine already does; §8 perf test passed).
2. **Show complete** → compute full discard details, pegging grades, luck vs.
   skill, and public hindsight; write the rest of the `grades` rows and release
   them. The game-over stand report, Button Buck award, excuse line, and
   Horseshoe/Hard-luck awards are computed from these.

Hindsight-at-cut (the private one-liner) is computed right after the cut and
written to an owner-only row. Grading is async: if it isn't done when the hand
ends, the recap shows "Grading…" and fills in on the next broadcast (§4A.1).

Version stamps (engine, grader) are written with every game so an old game can
be re-graded later and compared (§6). The "something's off" flag stores the
game + hand so a flagged hand can be replayed from the action log and re-checked
(§6) — this is the main way real-world scoring/grading mistakes get found.

**Razzing** is DB-only: insert a `razz`, deliver as a banner on next open.
Never vibrates, never pushes, 3-per-player-per-hand cap enforced server-side,
blocked during a hold (§4A.6).

---

## 12. Grade visibility staging (restating, because it's easy to get wrong)

```
discards locked (crib set):  grades: discard RANK + points lost only.  no cards.
                             hindsight-at-cut: owner-only private line.
show complete:               grades: + card details, best option, pegging
                             grades, luck/skill, public hindsight.  released.
```

A single `grades.visibility` column (`locked` / `full`) plus RLS on the private
hindsight row encodes this. The §8 security tests assert exactly these windows.

---

## 13. Theme system plumbing (§5.1A — build it, ship only deer-camp)

- A theme is **one folder**: color/font tokens, a vocabulary map (every themed
  word by key), the razz list, and art.
- **Colors/fonts** become CSS custom properties on `:root`; Tailwind reads the
  variables, so **no hex or font name appears outside `src/themes/`**.
- **All user-facing text** comes from `t(key)` against the theme vocabulary,
  plus a shared base file for neutral strings ("Your turn"). The §5.1A grep
  check — searching outside `src/themes/` for "buck/deer/stand/camp" finds
  nothing user-facing — is a lint/test we can automate.
- Theme id is chosen by the host at camp creation and stored on the game, so
  everyone sees the same words and replays stay faithful.
- **Acceptance proof:** a throwaway `plain` theme (neutral words, default
  colors) can be switched on in dev and the whole game plays with no deer words
  or colors (§5.1A, Phase 2 acceptance).

---

## 14. Device interfaces (§7A)

Each is one small module with a web implementation now, a native swap later:
`haptics.ts` (vibrate), `notifications.ts` (web push registration + show),
`wakelock.ts` (optional keep-screen-on, off by default), `share.ts` (native
share sheet for the invite link), `storage.ts` (local settings + the offline
queue). Game code calls the interface, never the browser API directly.

---

## 15. Frontend architecture

- **Routing under static export (a real gotcha).** `output: 'export'` can't
  prerender dynamic path segments it doesn't know at build time, and camp codes
  are created at runtime. **Recommendation:** carry the camp code as a query
  param or hash (`/camp?c=ABC12`) rendered by a static shell that hydrates and
  fetches state client-side, instead of a dynamic `/camp/[code]` path. Share
  links point at the query-param URL. (§18.)
- **State:** a light client store (Zustand recommended) holds the game state
  pushed by Realtime; components subscribe. Optimistic "sending…" overlays the
  server state until confirmed.
- **Screens** (§5.3): Home, Lobby, Game table, Count ("the show"), Hold, Game
  over — all built **once**, on top of the server (no local-only version).
- **Pegboard** (§5.2): an SVG component, 4 rows of 30 + the 121 "buck pole",
  two pegs per lane leapfrogging, animated front peg. Fits 390 px width.
- Cards are SVG/CSS (off-white `#ECE4D2` faces, suit glyphs as text + `U+FE0E`,
  4.5:1 contrast). 48×48 px min tap targets, 56 px primary buttons, actions in
  the bottom half, no drag/long-press (§1A gloves-and-cold rules).
- **Dark-only, no bright flashes anywhere**, Stand mode dims ~30% (§1A).

---

## 16. PWA (lands in Phase 3, but don't design it out)

Manifest + icons + a Serwist service worker; installable; web push with VAPID
sent from `send-push`. Phase 2 keeps the hooks (the `notifications` device
interface, the push_subscriptions table) so Phase 3 is wiring, not rework.

---

## 17. Testing strategy for Phase 2

- **Engine:** already covered (Phase 1), unchanged.
- **Integration/security:** hit Supabase with player A's JWT, assert player B's
  `private_cards` are unreachable; assert grade-visibility windows; assert the
  action log is unreadable mid-game.
- **Weak-signal:** Playwright offline → online → applied-once.
- **E2E:** one full 2-player game in Playwright (the §7 requirement).
- **Theme:** automated grep check + a smoke test that the `plain` theme renders
  with no deer vocabulary.
- **Acceptance (§9 Phase 2 gate):** 4 phones on cellular finish a 4-player
  game; one phone airplane-moded mid-hand for 2 min rejoins intact; a hold from
  a non-turn phone freezes all four. (Manual, with the real group.)

---

## 18. Decisions I need your call on

Each has my recommendation; override any of them.

1. **Engine → Edge Function packaging.** ✅ RESOLVED in step 0: import map →
   built `dist/index.js` (single-file bundle held in reserve if a CLI version
   won't bundle across directories). See §4.
2. **Realtime transport.** *Rec:* Postgres Changes with RLS (secure per
   subscriber) over Broadcast. _(Kyle: "I don't know" → going with the rec; not
   needed until build step 2.)_
3. **Static-export routing for camp codes.** *Rec:* query-param/hash routing,
   not dynamic path segments. _(Kyle: "I don't know" → going with the rec; not
   needed until build step 2.)_
4. **Client state library.** *Rec:* Zustand (small, no ceremony). _(Kyle: "I
   don't know" → going with the rec; revisit when we build the UI.)_
5. **Bot move execution.** ✅ Kyle approved: server applies immediately, client
   paces the 1–2 s reveal (no server-side sleeps).
6. **Supabase project + Vercel.** ✅ Kyle has accounts, so build step 1 can wire
   a real project (`supabase link`) rather than stubs.

---

## 19. Proposed build order (incremental, riskiest-first, test-as-we-go)

0. ✅ **DONE — Spike:** Edge Function imports `@deercamp/engine` and scores a
   hand. Proves §4. (Built + verified here; final deploy is one command on
   Kyle's machine — `supabase/README.md`.)
1. ✅ **DONE — Supabase schema + RLS + lobby RPCs.** `supabase/migrations/
   0001_init.sql` (games, seats, hands, private_cards, actions; the RLS wall;
   `create_camp` / `join_camp` / code generation). Verified against real
   Postgres in-process (PGlite) in `packages/db` — 12 tests prove a player
   can't read another's hand, the crib is hidden until the show, non-members
   see nothing, and the action log opens only after the game is over. Still to
   add in later steps: `grades`, `razzes`, `push_subscriptions`, `flags`, and
   the seat-settings / `get_game_state` RPCs.
2. ✅ **DONE — Auth + lobby.** `apps/web` (Next.js static export): anonymous
   sign-in, create/join camp by code, Home + Lobby screens, per-player
   settings, host bot-fill + start, Realtime subscription and the
   `get_game_state` reconnect, connection-status pill, theme vocabulary +
   palette, device interfaces. Backend lobby RPCs added in migration 0002 and
   verified in PGlite (19 DB tests total). Builds as a static export with no
   env; the live multiplayer run needs Kyle's Supabase project (migrations
   applied + anonymous sign-ins enabled). Decisions locked: query-param
   routing, Postgres Changes, Zustand available (hooks used for now).
3. 🟡 **IN PROGRESS — the action pipeline.** The server-authoritative state
   machine `@deercamp/game` is DONE and tested (23 tests): the incremental
   pegging stepper (cross-checked against the engine's playPegging over 900
   random deals), the full hand loop (deal → discard → cut/his-heels → pegging
   → show → next, with counting-out/his-heels wins), idempotent `reduce`, camp
   bots driving a game to a winner (2p + 4p), and `project()` mapping state to
   public rows + per-seat private cards. Persistence decision: the authoritative
   state is a server-only `engine_state` JSONB blob (migration 0003, RLS-proven
   unreadable by clients); the public parts project into games/hands + per-seat
   private_cards. The `submit-action` Edge Function (load → reduce → runBots →
   auto-deal → persist → project) is written to spec but **not yet run against
   live Supabase**. Remaining (step 3b): the client offline/retry queue (§1A
   weak-signal), the start/deal orchestration verified live, and the
   offline-applies-once test.
4. **Table UI + pegboard + theme system** (build once on the server), including
   the `plain`-theme acceptance proof.
5. **§1A behaviors:** offline queue, connection status, Deer! hold, no timers,
   host bot-fill; bots fill seats (also gives solo play).
6. **Grading pipeline:** discard scoreboard, hand recap, game-over stand report
   with luck vs. skill + excuse line, private + public hindsight, razzing — the
   staged visibility and its security tests.
7. **Home stretch banner** (§5.3) — public-info only.
8. **Phase 2 acceptance:** the 4-phones-on-cellular run and the security +
   weak-signal automated tests.

Phase 3 (PWA install, web push, Add-to-Home-Screen walkthrough, manual
counting, muggins, skunk display, rematch, animations) follows.

---

## 20. What I'd prototype first if you say "go"

Step 0 and step 1: prove the engine runs in an Edge Function, then stand up the
schema with the `private_cards` RLS and its security test. Those two retire the
only architectural unknowns; everything after is standard app construction that
the spec already specifies in detail.
```
