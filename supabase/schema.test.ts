// @vitest-environment node
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { beforeAll, describe, expect, it } from 'vitest';

/**
 * Runs supabase/schema.sql in an in-process Postgres (PGlite) with minimal
 * stand-ins for what Supabase provides (auth schema, roles, realtime publication),
 * then exercises RLS, last-write-wins upserts and the single-user lock.
 */

const ALICE = '11111111-1111-4111-8111-111111111111';
const MALLORY = '22222222-2222-4222-8222-222222222222';
const HABIT = '33333333-3333-4333-8333-333333333333';

let db: PGlite;

async function as<T>(user: string, fn: () => Promise<T>): Promise<T> {
  await db.exec(
    `set role authenticated; select set_config('request.jwt.claim.sub', '${user}', false);`,
  );
  try {
    return await fn();
  } finally {
    await db.exec(`reset role;`);
  }
}

const habitRow = (updatedAt: string, name = 'Read') => ({
  id: HABIT,
  name,
  icon: null,
  color: 'green',
  type: 'count',
  target: 8,
  unit: 'pages',
  schedule: { kind: 'daily' },
  reminder_time: null,
  sort_order: 0,
  created_at: '2026-11-01T08:00:00.000Z',
  archived_at: null,
  updated_at: updatedAt,
  deleted: false,
});

const entryRow = (value: number, updatedAt: string) => ({
  id: `${HABIT}:2026-11-04`,
  habit_id: HABIT,
  date: '2026-11-04',
  value,
  note: null,
  updated_at: updatedAt,
  deleted: false,
});

const push = (habits: unknown[], entries: unknown[]) =>
  db.query('select public.push_changes($1::jsonb, $2::jsonb)', [
    JSON.stringify(habits),
    JSON.stringify(entries),
  ]);

beforeAll(async () => {
  db = new PGlite();
  // Minimal Supabase stand-ins.
  await db.exec(`
    create role anon nologin;
    create role authenticated nologin;
    create schema auth;
    create table auth.users (id uuid primary key);
    create function auth.uid() returns uuid language sql stable as
      $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    grant usage on schema auth to anon, authenticated;
    grant execute on function auth.uid() to anon, authenticated;
    create publication supabase_realtime;
  `);
  const sql = readFileSync(new URL('./schema.sql', import.meta.url), 'utf8');
  await db.exec(sql);
  await db.exec(sql); // must be safe to run twice
  await db.exec(`
    grant usage on schema public to anon, authenticated;
    grant select, insert, update, delete on all tables in schema public to authenticated;
  `);
  await db.exec(`alter table auth.users disable trigger only_one_user;`);
  await db.exec(`insert into auth.users (id) values ('${ALICE}'), ('${MALLORY}');`);
  await db.exec(`alter table auth.users enable trigger only_one_user;`);
});

describe('schema.sql', () => {
  it('pushes rows owned by the caller and stamps synced_at', async () => {
    await as(ALICE, () =>
      push([habitRow('2026-11-04T10:00:00.000Z')], [entryRow(3, '2026-11-04T10:00:00.000Z')]),
    );
    const { rows } = await db.query<{ user_id: string; synced_at: Date; name: string }>(
      'select user_id, synced_at, name from public.habits',
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]!.user_id).toBe(ALICE);
    expect(rows[0]!.synced_at).toBeInstanceOf(Date);
  });

  it('keeps the newer edit (last write wins)', async () => {
    await as(ALICE, () =>
      push(
        [habitRow('2026-11-04T09:00:00.000Z', 'Old name')],
        [entryRow(1, '2026-11-04T09:00:00.000Z')],
      ),
    );
    let { rows } = await db.query<{ name: string }>('select name from public.habits');
    expect(rows[0]!.name).toBe('Read');
    const e1 = await db.query<{ value: number }>('select value from public.entries');
    expect(e1.rows[0]!.value).toBe(3);

    await as(ALICE, () =>
      push(
        [habitRow('2026-11-04T11:00:00.000Z', 'New name')],
        [entryRow(5, '2026-11-04T11:00:00.000Z')],
      ),
    );
    ({ rows } = await db.query<{ name: string }>('select name from public.habits'));
    expect(rows[0]!.name).toBe('New name');
    const e2 = await db.query<{ value: number }>('select value from public.entries');
    expect(e2.rows[0]!.value).toBe(5);
  });

  it('hides and protects rows from other users', async () => {
    const seen = await as(MALLORY, () => db.query('select * from public.habits'));
    expect(seen.rows).toHaveLength(0);
    await expect(
      as(MALLORY, () => push([habitRow('2026-11-05T00:00:00.000Z', 'Hijacked')], [])),
    ).rejects.toThrow();
    const { rows } = await db.query<{ name: string }>('select name from public.habits');
    expect(rows[0]!.name).toBe('New name');
  });

  it('does not let signed-out callers push', async () => {
    await db.exec('set role anon;');
    try {
      await expect(push([], [])).rejects.toThrow(/permission denied/);
      const ping = await db.query<{ ping: Date }>('select public.ping()');
      expect(ping.rows).toHaveLength(1);
    } finally {
      await db.exec('reset role;');
    }
  });

  it('refuses to create a second account', async () => {
    await expect(
      db.exec(`insert into auth.users (id) values ('44444444-4444-4444-8444-444444444444')`),
    ).rejects.toThrow(/only one account/);
  });

  it('adds both tables to the realtime publication', async () => {
    const { rows } = await db.query<{ tablename: string }>(
      `select tablename from pg_publication_tables where pubname = 'supabase_realtime' order by 1`,
    );
    expect(rows.map((r) => r.tablename)).toEqual(['entries', 'habits']);
  });
});
