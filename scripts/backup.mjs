// Export every habit and entry from Supabase as a Habit Tracker export file
// (the same format as Settings → Export JSON), written to stdout.
// Needs SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (reads all rows, bypassing RLS).
// Keep the row → record mapping in step with src/sync/mapping.ts.

const url = process.env.SUPABASE_URL?.replace(/\/$/, '');
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.');
  process.exit(1);
}

// New-style secret keys (sb_secret_…) go in `apikey` only; legacy JWT keys also need Authorization.
const headers = { apikey: key };
if (!key.startsWith('sb_')) headers.Authorization = `Bearer ${key}`;

async function all(table) {
  const rows = [];
  const page = 1000;
  for (let offset = 0; ; offset += page) {
    const res = await fetch(
      `${url}/rest/v1/${table}?select=*&order=id.asc&limit=${page}&offset=${offset}`,
      {
        headers,
      },
    );
    if (!res.ok) throw new Error(`${table}: HTTP ${res.status} ${await res.text()}`);
    const batch = await res.json();
    rows.push(...batch);
    if (batch.length < page) return rows;
  }
}

const iso = (t) => new Date(t).toISOString();
const clean = (o) =>
  Object.fromEntries(
    Object.entries(o).filter(([, v]) => v !== null && v !== undefined && v !== false),
  );

const habits = (await all('habits')).map((r) =>
  clean({
    id: r.id,
    name: r.name,
    icon: r.icon,
    color: r.color,
    type: r.type,
    target: r.target,
    unit: r.unit,
    schedule: r.schedule,
    reminderTime: r.reminder_time,
    order: r.sort_order,
    createdAt: iso(r.created_at),
    archivedAt: r.archived_at && iso(r.archived_at),
    updatedAt: iso(r.updated_at),
    deleted: r.deleted,
  }),
);
const entries = (await all('entries')).map((r) =>
  clean({
    id: r.id,
    habitId: r.habit_id,
    date: String(r.date).slice(0, 10),
    value: r.value,
    note: r.note,
    updatedAt: iso(r.updated_at),
    deleted: r.deleted,
  }),
);

process.stdout.write(
  JSON.stringify({
    app: 'habit-tracker',
    version: 1,
    exportedAt: new Date().toISOString(),
    habits,
    entries,
  }),
);
console.error(`Exported ${habits.length} habits and ${entries.length} entries.`);
