import { expect, test, type BrowserContext, type Page } from '@playwright/test';

/**
 * Sign-in and sync against a mocked Supabase (the sync-enabled build on :4174).
 * The mock follows supabase/schema.sql: last write wins, server-stamped synced_at.
 */

test.use({ baseURL: 'http://localhost:4174', serviceWorkers: 'block' });
test.skip(({ browserName }) => browserName !== 'chromium');

const SUPABASE = 'https://fake-project.supabase.co';
const USER = { id: 'aaaaaaaa-0000-4000-8000-000000000001', email: 'me@example.com' };

type Row = Record<string, unknown> & { id: string; updated_at: string; synced_at?: string };

class MockSupabase {
  habits = new Map<string, Row>();
  entries = new Map<string, Row>();
  pushes = 0;
  private clock = Date.now();

  private jwt() {
    const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url');
    const exp = Math.floor(Date.now() / 1000) + 3600;
    return `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: USER.id, email: USER.email, role: 'authenticated', exp })}.sig`;
  }

  private session() {
    return {
      access_token: this.jwt(),
      token_type: 'bearer',
      expires_in: 3600,
      expires_at: Math.floor(Date.now() / 1000) + 3600,
      refresh_token: 'refresh-token',
      user: {
        id: USER.id,
        aud: 'authenticated',
        role: 'authenticated',
        email: USER.email,
        app_metadata: {},
        user_metadata: {},
        created_at: new Date().toISOString(),
      },
    };
  }

  async attach(context: BrowserContext) {
    await context.route(`${SUPABASE}/**`, async (route) => {
      const req = route.request();
      const url = new URL(req.url());
      const json = (body: unknown, status = 200) =>
        route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

      if (url.pathname === '/auth/v1/otp') return json({});
      if (url.pathname === '/auth/v1/verify') {
        const body = req.postDataJSON() as { token: string };
        return body.token === '123456'
          ? json(this.session())
          : json({ code: 403, msg: 'Token has expired or is invalid' }, 403);
      }
      if (url.pathname === '/auth/v1/user') return json(this.session().user);
      if (url.pathname === '/auth/v1/token') return json(this.session());
      if (url.pathname === '/auth/v1/logout') return route.fulfill({ status: 204 });

      if (url.pathname === '/rest/v1/rpc/push_changes') {
        const { p_habits, p_entries } = req.postDataJSON() as { p_habits: Row[]; p_entries: Row[] };
        this.pushes++;
        for (const [table, rows] of [
          [this.habits, p_habits],
          [this.entries, p_entries],
        ] as const) {
          for (const row of rows) {
            const cur = table.get(row.id);
            if (!cur || Date.parse(row.updated_at) > Date.parse(cur.updated_at)) {
              this.clock += 1;
              table.set(row.id, {
                ...row,
                user_id: USER.id,
                synced_at: new Date(this.clock).toISOString(),
              });
            }
          }
        }
        return route.fulfill({ status: 204 });
      }

      const m = url.pathname.match(/^\/rest\/v1\/(habits|entries)$/);
      if (m) {
        const since = url.searchParams.get('synced_at')?.replace(/^gte\./, '');
        const range = req.headers()['range'] ?? '0-999';
        const [from, to] = range.split('-').map(Number) as [number, number];
        const rows = [...(m[1] === 'habits' ? this.habits : this.entries).values()]
          .filter((r) => !since || Date.parse(r.synced_at!) >= Date.parse(since))
          .sort(
            (a, b) =>
              Date.parse(a.synced_at!) - Date.parse(b.synced_at!) || a.id.localeCompare(b.id),
          )
          .slice(from, to + 1);
        return json(rows);
      }
      return route.fulfill({ status: 404, body: 'not mocked' });
    });
    // Realtime isn't mocked; the app falls back to syncing on focus, edits and a timer.
    await context.routeWebSocket(/fake-project\.supabase\.co/, (ws) => ws.close());
  }
}

async function signIn(page: Page) {
  await page.goto('./#/settings');
  await page.getByPlaceholder('you@example.com').fill(USER.email);
  await page.getByRole('button', { name: 'Email me a code' }).click();
  await page.getByPlaceholder('123456').fill('123456');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByText(`Signed in as ${USER.email}`)).toBeVisible();
  await expect(page.getByRole('status').filter({ hasText: /Synced/ })).toBeVisible();
}

test('sign in, upload local habits, and see them on a second device', async ({ browser }) => {
  const server = new MockSupabase();

  // Device 1 used the app before signing in.
  const phone = await browser.newContext();
  await server.attach(phone);
  const p1 = await phone.newPage();
  await p1.goto('./#/habits/new');
  await p1.getByLabel('Name').fill('Read');
  await p1.getByRole('button', { name: 'Create habit' }).click();
  await expect(p1.getByRole('heading', { name: 'Read' })).toBeVisible();
  await p1.goto('./');
  await p1.getByTestId('log-Read').click();

  await signIn(p1);
  expect(server.habits.size).toBe(1);
  expect(server.entries.size).toBe(1);

  // Device 2 signs in and receives everything.
  const laptop = await browser.newContext();
  await server.attach(laptop);
  const p2 = await laptop.newPage();
  await signIn(p2);
  await p2.goto('./');
  await expect(p2.getByText('1 of 1 done')).toBeVisible();

  // An edit on device 2 reaches device 1 on its next sync.
  await p2.getByTestId('log-Read').click(); // undo today's check-in
  await expect(p2.getByText('0 of 1 done')).toBeVisible();
  await expect.poll(() => [...server.entries.values()][0]?.deleted).toBe(true);
  await p1.goto('./#/settings');
  await p1.getByRole('button', { name: 'Sync now' }).click();
  await p1.goto('./');
  await expect(p1.getByText('0 of 1 done')).toBeVisible();

  await phone.close();
  await laptop.close();
});

test('a wrong code shows an error and keeps you signed out', async ({ browser }) => {
  const server = new MockSupabase();
  const ctx = await browser.newContext();
  await server.attach(ctx);
  const page = await ctx.newPage();
  await page.goto('./#/settings');
  await page.getByPlaceholder('you@example.com').fill(USER.email);
  await page.getByRole('button', { name: 'Email me a code' }).click();
  await page.getByPlaceholder('123456').fill('000000');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByRole('alert')).toContainText(/invalid|expired/i);
  await expect(page.getByText(/Signed in as/)).toHaveCount(0);
  await ctx.close();
});
