/**
 * Edge Function `score-hand` — the Phase 2 step-0 spike (REQUIREMENTS §6, §7A).
 *
 * Its only job is to prove the rules engine runs inside the Supabase/Deno
 * runtime. It is NOT a product endpoint — the real server logic (submit-action,
 * grade-hand, ...) comes later. Keep it until the pipeline exists, then delete.
 *
 *   GET  /score-hand           -> engine self-test (scores the perfect 29 hand)
 *   POST /score-hand           -> { cards: string[5], crib?: boolean }
 *
 * Run locally:  supabase functions serve score-hand --no-verify-jwt
 * Deploy:       supabase functions deploy score-hand --no-verify-jwt
 * (--no-verify-jwt only because this throwaway spike takes no auth; the real
 *  functions WILL verify the player's JWT.)
 */

import { scoreFromTokens, engineSelfTest } from '../_shared/engine-smoke.ts';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

Deno.serve((req: Request): Response | Promise<Response> => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  try {
    if (req.method === 'GET') {
      return json({ engine: engineSelfTest() });
    }
    if (req.method === 'POST') {
      return req.json().then((body: { cards?: string[]; crib?: boolean }) => {
        if (!Array.isArray(body.cards)) {
          return json({ error: 'Body must be { cards: string[5], crib?: boolean }' }, 400);
        }
        return json(scoreFromTokens(body.cards, body.crib ?? false));
      });
    }
    return json({ error: 'Use GET (self-test) or POST { cards, crib }' }, 405);
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : String(err) }, 400);
  }
});
