# @deercamp/web

The Next.js (App Router) front end, built as a **static export** (`output:
'export'`) — no Next.js server. All server logic is Supabase (see
`supabase/`, `docs/PHASE2_ARCHITECTURE.md`).

## What's here (Phase 2 step 2)

- Anonymous auth (`src/net/auth.ts`) and typed lobby RPC wrappers (`src/net/rpc.ts`).
- `useGameState` (`src/net/useGameState.ts`): Realtime subscription with a
  full-state refetch on every change / reconnect (§1A/§6), plus a connection
  status.
- Theme plumbing (`src/themes/`): deer-camp vocabulary + palette as CSS vars.
  All themed words come from the vocabulary; all hex lives in the palette file.
- Device interfaces (`src/device/`): haptics, notifications, wake lock, share,
  storage — web implementations behind small modules for a later native swap.
- Screens: **Home** (name/stand, new camp, join camp) and **Lobby** (seats,
  code + invite, per-player settings, host bot-fill and start, connection pill).
  Routing carries the camp code as a query param (`/camp?c=ABC12`), which is
  static-export friendly.

Not yet built (later steps): the game table + pegboard (step 4), the action
pipeline / dealing (step 3), grading UI (step 6).

## Run it

Needs a Supabase project with the migrations in `supabase/migrations` applied
and "Allow anonymous sign-ins" enabled.

```bash
cp apps/web/.env.local.example apps/web/.env.local   # fill in your project URL + anon key
npm run dev -w @deercamp/web                          # local dev
npm run build -w @deercamp/web                        # static export to apps/web/out
```

The build works with no env vars (the Supabase client is created lazily), so
CI can type-check and build without secrets; the app only needs them at runtime
in the browser.
