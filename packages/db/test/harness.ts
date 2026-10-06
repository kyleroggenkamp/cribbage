/**
 * Test harness: a real Postgres (PGlite, Postgres compiled to WASM) with the
 * Supabase `auth` schema/roles shimmed in, then our actual migrations applied.
 * This lets us prove RLS end-to-end — simulate two signed-in players and assert
 * one cannot read the other's cards — without a running Supabase.
 *
 * The migrations in supabase/migrations are the single source of truth; this
 * harness applies those exact files.
 */

import { PGlite } from '@electric-sql/pglite';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const migrationsDir = join(here, '..', '..', '..', 'supabase', 'migrations');

/**
 * Shim the pieces Supabase provides at runtime: the `auth` schema + helpers and
 * the anon/authenticated/service_role roles. Mirrors Supabase's own definitions
 * so the migrations run unchanged here and on Supabase.
 */
const AUTH_SHIM = `
  create schema if not exists auth;
  create or replace function auth.uid() returns uuid language sql stable as $$
    select (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')::uuid
  $$;
  create or replace function auth.role() returns text language sql stable as $$
    select nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role'
  $$;
  create role anon nologin;
  create role authenticated nologin;
  create role service_role nologin bypassrls;
  grant usage on schema auth to anon, authenticated, service_role;
  grant usage on schema public to anon, authenticated, service_role;
`;

export interface TestDb {
  /** Run SQL as the service role / setup (bypasses RLS). Returns rows. */
  service(sql: string): Promise<Record<string, unknown>[]>;
  /** Run SQL as a signed-in user (role authenticated, auth.uid() = sub). */
  asUser(sub: string, sql: string): Promise<Record<string, unknown>[]>;
  close(): Promise<void>;
}

export async function createTestDb(): Promise<TestDb> {
  const pg = new PGlite();
  await pg.exec(AUTH_SHIM);

  const files = readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .sort();
  for (const f of files) {
    await pg.exec(readFileSync(join(migrationsDir, f), 'utf8'));
  }

  async function service(sql: string): Promise<Record<string, unknown>[]> {
    const r = await pg.query(sql);
    return r.rows as Record<string, unknown>[];
  }

  async function asUser(sub: string, sql: string): Promise<Record<string, unknown>[]> {
    const claims = JSON.stringify({ sub, role: 'authenticated' });
    // Session-scoped (is_local = false): PGlite runs each statement in its own
    // implicit transaction, so a transaction-local setting would vanish before
    // the query. Reset afterwards so users don't bleed into each other.
    await pg.exec(
      `set role authenticated; select set_config('request.jwt.claims', '${claims}', false);`,
    );
    try {
      const r = await pg.query(sql);
      return r.rows as Record<string, unknown>[];
    } finally {
      await pg.exec(`reset role; select set_config('request.jwt.claims', '', false);`);
    }
  }

  return { service, asUser, close: () => pg.close() };
}

/** Deterministic test UUIDs. */
export const UID = {
  A: '11111111-1111-1111-1111-111111111111',
  B: '22222222-2222-2222-2222-222222222222',
  C: '33333333-3333-3333-3333-333333333333',
  D: '44444444-4444-4444-4444-444444444444',
} as const;
