import { beforeEach, describe, expect, it } from 'vitest';
import { createDb, type AppDb } from '../data/db';
import { nextStamp } from '../data/repo';
import type { Entry, Habit } from '../domain/types';
import { remoteWins, syncOnce, type CursorStore, type Remote } from './engine';
import type { EntryRow, HabitRow } from './mapping';

/** In-memory stand-in for Supabase with the same rules as supabase/schema.sql. */
class FakeServer {
  habits = new Map<string, HabitRow>();
  entries = new Map<string, EntryRow>();
  private clock = Date.parse('2026-11-05T00:00:00Z');
  online = true;

  private stamp() {
    this.clock += 1000;
    return new Date(this.clock).toISOString().replace('Z', '+00:00');
  }

  remote(): Remote {
    return {
      push: async (habits, entries) => {
        if (!this.online) throw new Error('offline');
        for (const [table, rows] of [
          [this.habits, habits],
          [this.entries, entries],
        ] as const) {
          for (const row of rows) {
            const cur = (table as Map<string, HabitRow | EntryRow>).get(row.id);
            if (!cur || Date.parse(row.updated_at) > Date.parse(cur.updated_at)) {
              (table as Map<string, HabitRow | EntryRow>).set(row.id, {
                ...row,
                synced_at: this.stamp(),
              });
            }
          }
        }
      },
      pull: async (table, since, offset, limit) => {
        if (!this.online) throw new Error('offline');
        const rows = [...(table === 'habits' ? this.habits : this.entries).values()]
          .filter((r) => !since || Date.parse(r.synced_at!) >= Date.parse(since))
          .sort(
            (a, b) =>
              Date.parse(a.synced_at!) - Date.parse(b.synced_at!) || a.id.localeCompare(b.id),
          );
        return rows.slice(offset, offset + limit) as never;
      },
    };
  }
}

function memoryCursors(): CursorStore {
  let v = { habits: null as string | null, entries: null as string | null };
  return { get: () => v, set: (n) => (v = n) };
}

let n = 0;
interface Device {
  db: AppDb;
  cursors: CursorStore;
  sync: () => ReturnType<typeof syncOnce>;
}
function device(server: FakeServer): Device {
  const db = createDb(`device-${++n}`);
  const cursors = memoryCursors();
  return { db, cursors, sync: () => syncOnce(db, server.remote(), cursors) };
}

const HID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

async function addHabit(d: Device, name = 'Read'): Promise<Habit> {
  const t = new Date().toISOString();
  const h: Habit = {
    id: HID,
    name,
    color: 'green',
    type: 'boolean',
    target: 1,
    schedule: { kind: 'daily' },
    order: 0,
    createdAt: t,
    updatedAt: t,
    pending: 1,
  };
  await d.db.habits.put(h);
  return h;
}

async function log(d: Device, date: string, value: number, updatedAt?: string): Promise<void> {
  const id = `${HID}:${date}`;
  const cur = await d.db.entries.get(id);
  const e: Entry = {
    id,
    habitId: HID,
    date,
    value,
    updatedAt: updatedAt ?? nextStamp(cur?.updatedAt),
    deleted: value <= 0,
    pending: 1,
  };
  await d.db.entries.put(e);
}

const value = async (d: Device, date: string) => {
  const e = await d.db.entries.get(`${HID}:${date}`);
  return e && !e.deleted ? e.value : 0;
};

let server: FakeServer;
let phone: Device;
let laptop: Device;

beforeEach(() => {
  server = new FakeServer();
  phone = device(server);
  laptop = device(server);
});

describe('sync engine', () => {
  it('copies habits and entries from one device to another', async () => {
    await addHabit(phone);
    await log(phone, '2026-11-04', 1);
    expect(await phone.sync()).toEqual({ pushed: 2, pulled: 2 });
    expect(await phone.db.entries.where('pending').equals(1).count()).toBe(0);

    await laptop.sync();
    expect((await laptop.db.habits.get(HID))?.name).toBe('Read');
    expect(await value(laptop, '2026-11-04')).toBe(1);
  });

  it('propagates deletions as tombstones', async () => {
    await addHabit(phone);
    await log(phone, '2026-11-04', 1);
    await phone.sync();
    await laptop.sync();

    await log(laptop, '2026-11-04', 0);
    await laptop.sync();
    await phone.sync();
    expect(await value(phone, '2026-11-04')).toBe(0);
    expect((await phone.db.entries.get(`${HID}:2026-11-04`))?.deleted).toBe(true);
  });

  it('resolves offline edits to the same day by last write wins', async () => {
    await addHabit(phone);
    await phone.sync();
    await laptop.sync();

    await log(phone, '2026-11-04', 3, '2026-11-04T10:00:00.000Z');
    await log(laptop, '2026-11-04', 5, '2026-11-04T11:00:00.000Z'); // later edit
    await laptop.sync();
    await phone.sync(); // phone's older edit is refused by the server, then overwritten by the pull
    await laptop.sync();
    expect(await value(phone, '2026-11-04')).toBe(5);
    expect(await value(laptop, '2026-11-04')).toBe(5);
    expect(await phone.db.entries.where('pending').equals(1).count()).toBe(0);
  });

  it('merges a device that used the app before signing in', async () => {
    await addHabit(phone);
    await log(phone, '2026-11-01', 1);
    await phone.sync();

    // The laptop already has the same habit with older local history.
    await addHabit(laptop);
    await log(laptop, '2026-10-31', 1);
    await laptop.sync();
    await phone.sync();
    for (const d of [phone, laptop]) {
      expect(await value(d, '2026-10-31')).toBe(1);
      expect(await value(d, '2026-11-01')).toBe(1);
    }
  });

  it('keeps changes made while offline and uploads them later', async () => {
    await addHabit(phone);
    await phone.sync();
    server.online = false;
    await log(phone, '2026-11-04', 1);
    await expect(phone.sync()).rejects.toThrow('offline');
    expect(await phone.db.entries.where('pending').equals(1).count()).toBe(1);
    server.online = true;
    await phone.sync();
    await laptop.sync();
    expect(await value(laptop, '2026-11-04')).toBe(1);
  });

  it('pulls more than one page of rows', async () => {
    await addHabit(phone);
    const start = Date.parse('2022-01-01T12:00:00Z');
    for (let i = 0; i < 1203; i++) {
      await log(phone, new Date(start + i * 86_400_000).toISOString().slice(0, 10), 1);
    }
    expect((await phone.sync()).pushed).toBe(1204);
    await laptop.sync();
    expect(await laptop.db.entries.count()).toBe(1203);
  });

  it('does not re-apply its own uploads on the next pull', async () => {
    await addHabit(phone);
    await phone.sync();
    const second = await phone.sync();
    expect(second.pushed).toBe(0);
  });
});

describe('remoteWins', () => {
  it('prefers the strictly newer local edit and otherwise the remote', () => {
    expect(remoteWins(undefined, '2026-11-04T10:00:00.000Z')).toBe(true);
    expect(remoteWins({ updatedAt: '2026-11-04T10:00:00.000Z' }, '2026-11-04T10:00:00.000Z')).toBe(
      true,
    );
    expect(remoteWins({ updatedAt: '2026-11-04T11:00:00.000Z' }, '2026-11-04T10:00:00.000Z')).toBe(
      false,
    );
  });
});

describe('nextStamp', () => {
  it('is always later than the previous edit, even if that came from a clock running ahead', () => {
    const future = new Date(Date.now() + 3_600_000).toISOString();
    expect(nextStamp(future) > future).toBe(true);
    expect(Date.parse(nextStamp()) - Date.now()).toBeLessThanOrEqual(0);
  });
});
