import type { AppDb } from '../data/db';
import {
  entryToRow,
  habitToRow,
  iso,
  rowToEntry,
  rowToHabit,
  type EntryRow,
  type HabitRow,
} from './mapping';

/** What the engine needs from the server. The real one wraps Supabase. */
export interface Remote {
  push(habits: HabitRow[], entries: EntryRow[]): Promise<void>;
  /** Rows with synced_at >= since (all rows if null), ordered by synced_at then id. */
  pull<T extends 'habits' | 'entries'>(
    table: T,
    since: string | null,
    offset: number,
    limit: number,
  ): Promise<(T extends 'habits' ? HabitRow : EntryRow)[]>;
}

export interface CursorStore {
  get(): { habits: string | null; entries: string | null };
  set(value: { habits: string | null; entries: string | null }): void;
}

export interface SyncResult {
  pushed: number;
  pulled: number;
}

const PUSH_BATCH = 500;
const PULL_PAGE = 1000;
/**
 * Re-read a little before the last cursor: a write that started before our last
 * pull may commit with an earlier synced_at. Merging is idempotent, so overlap is free.
 */
const OVERLAP_MS = 60_000;

/** Last write wins: apply the remote version unless the local one is strictly newer. */
export function remoteWins(
  local: { updatedAt: string } | undefined,
  remoteUpdatedAt: string,
): boolean {
  return !local || remoteUpdatedAt >= local.updatedAt;
}

async function push(db: AppDb, remote: Remote): Promise<number> {
  let pushed = 0;
  // Loop: new local edits made during an upload are picked up by the next round.
  for (let round = 0; round < 20; round++) {
    const habits = await db.habits.where('pending').equals(1).limit(PUSH_BATCH).toArray();
    const entries = await db.entries.where('pending').equals(1).limit(PUSH_BATCH).toArray();
    if (habits.length === 0 && entries.length === 0) break;

    await remote.push(habits.map(habitToRow), entries.map(entryToRow));
    pushed += habits.length + entries.length;

    // Clear the flag only if the record wasn't edited again while uploading.
    await db.transaction('rw', db.habits, db.entries, async () => {
      for (const h of habits) {
        const cur = await db.habits.get(h.id);
        if (cur && cur.updatedAt === h.updatedAt) await db.habits.update(h.id, { pending: 0 });
      }
      for (const e of entries) {
        const cur = await db.entries.get(e.id);
        if (cur && cur.updatedAt === e.updatedAt) await db.entries.update(e.id, { pending: 0 });
      }
    });
  }
  return pushed;
}

async function pullTable<T extends 'habits' | 'entries'>(
  db: AppDb,
  remote: Remote,
  table: T,
  cursor: string | null,
): Promise<{ count: number; cursor: string | null }> {
  const since = cursor ? new Date(Date.parse(cursor) - OVERLAP_MS).toISOString() : null;
  let next = cursor;
  let count = 0;
  for (let offset = 0; ; offset += PULL_PAGE) {
    const rows = await remote.pull(table, since, offset, PULL_PAGE);
    if (rows.length === 0) break;
    await db.transaction('rw', db.habits, db.entries, async () => {
      for (const row of rows) {
        if (table === 'habits') {
          const incoming = rowToHabit(row as HabitRow);
          if (remoteWins(await db.habits.get(incoming.id), incoming.updatedAt)) {
            await db.habits.put(incoming);
            count++;
          }
        } else {
          const incoming = rowToEntry(row as EntryRow);
          if (remoteWins(await db.entries.get(incoming.id), incoming.updatedAt)) {
            await db.entries.put(incoming);
            count++;
          }
        }
        const synced = row.synced_at ? iso(row.synced_at) : null;
        if (synced && (!next || synced > next)) next = synced;
      }
    });
    if (rows.length < PULL_PAGE) break;
  }
  return { count, cursor: next };
}

/** One full round: upload local changes, then download everything newer than the cursors. */
export async function syncOnce(
  db: AppDb,
  remote: Remote,
  cursors: CursorStore,
): Promise<SyncResult> {
  const pushed = await push(db, remote);
  const start = cursors.get();
  const h = await pullTable(db, remote, 'habits', start.habits);
  const e = await pullTable(db, remote, 'entries', start.entries);
  cursors.set({ habits: h.cursor, entries: e.cursor });
  return { pushed, pulled: h.count + e.count };
}
