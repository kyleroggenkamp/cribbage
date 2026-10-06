# Supabase — Phase 2 backend

Right now this holds only the **step-0 spike**: an Edge Function that proves the
rules engine runs inside the Supabase (Deno) runtime. The real schema, RLS, and
the `submit-action` / `grade-hand` / `send-push` functions come next (see
`docs/PHASE2_ARCHITECTURE.md`, build steps 1+).

## What step 0 establishes

The engine is a TypeScript package that must run in the browser, in Node (its
tests), and in **Deno** (Edge Functions). The one real risk was Deno: it does
**not** rewrite the engine's `.js` import specifiers to the `.ts` source files.
The fix is to **build the engine to real `.js` first** and import the build:

```
packages/engine/dist/index.js        <- tsc output, real .js files
supabase/functions/import_map.json   <- "@deercamp/engine" -> ../../packages/engine/dist/index.js
```

Verified here without Deno (the container can't fetch the Deno binary):
- `npm run verify:dist -w @deercamp/engine` — the built dist imports and scores
  as plain ESM, Web-Crypto shuffle included (same module rules Deno uses).
- `grep` confirms dist uses **no** Node-only APIs (`require`, `process`,
  `node:*`, `Buffer`, `__dirname`) — only `globalThis.crypto`, which Deno has.

The final "deployed and called" confirmation is one command on your machine
(below), since this container has neither your Supabase credentials nor the
Deno/Supabase binaries.

## Run it yourself

Prereqs: Node 20+, the [Supabase CLI](https://supabase.com/docs/guides/cli),
and a Supabase project (you said you have one).

```bash
# 1. Build the engine so dist/ exists (the function imports it).
npm run build -w @deercamp/engine

# 2. Serve the function locally and smoke-test it.
supabase functions serve score-hand --no-verify-jwt \
  --import-map supabase/functions/import_map.json

#    In another terminal:
curl http://localhost:54321/functions/v1/score-hand          # self-test
#    -> { "engine": { "ok": true, "perfectHand": 29, "expected": 29 } }

curl -X POST http://localhost:54321/functions/v1/score-hand \
  -H 'Content-Type: application/json' \
  -d '{"cards":["4D","5S","6C","JH","5H"]}'                   # the mockup hand
#    -> { ... "total": 17, "breakdown": [...] }

# 3. Deploy to your project (after `supabase link --project-ref <ref>`).
supabase functions deploy score-hand --no-verify-jwt
```

`--no-verify-jwt` is only because this throwaway spike takes no auth. The real
functions will verify the player's JWT.

## If the cross-directory import fails on deploy

Importing `dist/` from outside `supabase/functions/` is the recommended path
(decision §18.1). If a given CLI version refuses to bundle files outside the
functions dir, the fallback is a **single-file bundle** vendored into the
function: bundle the engine to one ESM file (e.g. with esbuild,
`--format=esm --platform=neutral`) and point the import map at that local file.
We'll add that build step only if it's actually needed.

## Cleanup

`score-hand` is a spike. Delete it once `submit-action` exists — it's kept only
so the engine-in-Deno wiring stays exercised until then.
