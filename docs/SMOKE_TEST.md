# Lobby smoke test (run this on your own machine)

Goal: confirm the **lobby** works end-to-end against your real Supabase —
anonymous sign-in, creating/joining a camp, live seat updates between two
players, and rejoining after a refresh. This is Phase 2 **step 2**.

**Scope:** this does NOT test the game itself. The action pipeline (dealing,
play) runs in an Edge Function that isn't deployed yet, and the game table UI
isn't built. So pressing **Start** will just show a "hunt started" placeholder.
That is expected — we're only checking the lobby and the plumbing under it.

You need: a computer with [Node.js 20+](https://nodejs.org) and a Supabase
account (free tier is fine).

---

## 1. Get the code

```bash
git clone https://github.com/kyleroggenkamp/cribbage.git
cd cribbage
git checkout claude/start-here-0u84x2
npm install
```

(If you already have the repo: `git fetch origin && git checkout
claude/start-here-0u84x2 && git pull`.)

## 2. Create a Supabase project

1. Go to https://supabase.com → **New project**. Pick any name; save the
   database password somewhere (you won't need it for this test).
2. Wait for it to finish provisioning (~2 minutes).

## 3. Apply the database migrations (SQL editor — no CLI needed)

In the Supabase dashboard, open **SQL Editor** → **New query**. Then, **one file
at a time, in order**, copy the entire contents of each file, paste it, and
click **Run**:

1. `supabase/migrations/0001_init.sql`
2. `supabase/migrations/0002_lobby_rpcs.sql`
3. `supabase/migrations/0003_engine_state.sql`

Each should report success. (These create the tables, the security rules, and
the lobby functions. They rely on Supabase's built-in `auth.uid()` and
`authenticated` role, which already exist.)

> Prefer the CLI? Install the [Supabase CLI](https://supabase.com/docs/guides/cli),
> then `supabase link --project-ref <your-ref>` and `supabase db push`.

## 4. Turn on anonymous sign-in

Dashboard → **Authentication** → **Sign In / Providers** (older UIs:
**Providers**) → find **Anonymous Sign-Ins** → **enable** it and save.

Players never make a password; everyone joins as an anonymous user with a
stable id. Without this, creating a camp fails with an auth error.

## 5. Turn on Realtime for the lobby tables

Dashboard → **Database** → **Publications** → open **`supabase_realtime`** →
toggle **on** these three tables:

- `games`
- `seats`
- `hands`

(Older UIs call this **Database → Replication**.) This is what makes a second
player's seat appear on the host's screen without a refresh.

## 6. Point the web app at your project

1. Dashboard → **Project Settings** → **API**. Copy the **Project URL** and the
   **anon public** key (NOT the service_role key).
2. In the repo:

```bash
cp apps/web/.env.local.example apps/web/.env.local
```

3. Open `apps/web/.env.local` and fill both values:

```
NEXT_PUBLIC_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOi...   (the long anon key)
```

Both are safe to expose in a browser; the service_role key is never used here.

## 7. Run it

```bash
npm run dev -w @deercamp/web
```

Open http://localhost:3000.

## 8. The actual test (two players)

You need **two separate sessions** so they're two different anonymous users:
either two phones, or a normal window + an **incognito/private** window, or two
different browsers.

1. **Window A:** type a name (e.g. "Kyle"), tap a player count (2), tap **New
   camp**. You land in the lobby as the host in seat 0. Note the 5-character
   **camp code** at the top.
2. **Window B:** open http://localhost:3000, type a *different* name (e.g.
   "Dave"), type the camp code into **Join camp**, tap **Join camp**.
3. ✅ **Watch Window A:** Dave should appear in seat 1 **without you
   refreshing** (that's Realtime working).
4. Toggle **Ready** / **Silent** / **Dim** in each window; the other side
   should reflect changes within a second.
5. In Window A (host), **Start** becomes available once every seat is filled.
   Tap it → both windows show the "hunt started" placeholder. (Expected — the
   table UI is a later step.)
6. **Reconnect check:** refresh Window B. It should drop you straight back into
   the same seat (that's the `get_game_state` reconnect).

Also try: in the host window, add a **Camp bot** to an open seat (3- or
4-player camp), and confirm it fills the seat.

## What to report back

- Did Dave appear in seat 1 in Window A **without a refresh**? (yes/no)
- Did ready/settings toggles sync between windows?
- Did refresh in Window B keep the seat?
- Any red errors in the browser console (open dev tools → Console) or any
  on-screen error text? Copy the exact message.

That's all I need to know the plumbing is sound before building the game table
on top of it.

---

## If it breaks — likely causes

| Symptom | Cause / fix |
|---|---|
| `Missing NEXT_PUBLIC_SUPABASE_URL / ANON_KEY` on screen | `.env.local` not created or filled; **stop and restart** `npm run dev` after creating it (env is read at startup). |
| Create/Join fails with "Anonymous sign-ins are disabled" | Step 4 not done. |
| Create camp errors with "not authenticated" | Anonymous sign-in isn't working — re-check step 4. |
| Join errors with "no such camp" | Code typed wrong (it excludes look-alikes O/0/I/1/L), or migrations not applied. |
| A permission / "row-level security" error | A migration didn't run; re-run step 3 in order. |
| Seat 1 shows only **after** a manual refresh | Realtime not enabled for `seats` (step 5), or the table isn't in the `supabase_realtime` publication. |
| Console shows a WebSocket/Realtime connection error | Realtime publication not set up (step 5). |

If something fails, paste me the exact error (screen text and/or console) and
which step it happened on, and I'll sort it.
