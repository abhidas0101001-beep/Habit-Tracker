# Habit Tracker — Product & Technical Plan

A cross-platform habit tracker (laptop, tablet, phone) whose main feature is a
**GitHub-style contribution heatmap**: one square per day for the past year,
shaded by how much of a habit you completed that day.

---

## 1. Goals and non-goals

### Goals
- **One codebase** that runs well on desktop browsers, tablets and phones, and
  can be installed like a native app.
- **Offline-first**: logging a habit never needs a network connection.
- **The heatmap is the hero**: fast, readable, touch-friendly and accessible.
- **Low friction**: checking off today's habits takes one tap per habit.
- Optional **account + sync** so the same data shows up on every device.

### Non-goals (for v1)
- Social features (friends, leaderboards, sharing feeds).
- Gamification beyond streaks (no coins, avatars or badges).
- Native watch / widget apps (on the roadmap, not in v1).

---

## 2. Recommended tech stack

| Concern | Choice | Why |
|---|---|---|
| App type | **Progressive Web App (PWA)**, wrapped with **Capacitor** for the App Store / Play Store later | One codebase for laptop, tablet and phone; installable from the browser on day one; Capacitor adds native packaging and push notifications when needed |
| UI framework | **React 18 + TypeScript + Vite** | Large ecosystem, fast dev server, strict types for the date maths |
| Styling | **Tailwind CSS** with CSS variables for theme tokens | Responsive breakpoints and dark mode built in |
| Local storage | **IndexedDB via Dexie.js** | Structured, indexed, works offline, handles years of data easily |
| State | **Zustand** for UI state + `dexie-react-hooks` (`useLiveQuery`) for data | Simple; the UI updates as soon as the DB changes |
| Dates | **date-fns** (+ `date-fns-tz`) | Tree-shakeable, immutable, good week/ISO helpers |
| Heatmap rendering | **Custom SVG component** (no chart library) | Full control over layout, a11y and touch; about 371 `<rect>`s is cheap |
| Offline / install | **vite-plugin-pwa** (Workbox) | Service worker, manifest, update prompts |
| Backend (sync) | **Supabase free plan** (Postgres + Auth + Row Level Security) | Free, auth included, no server to run; a single user needs about 1 MB a year of the 500 MB allowance (see §7.1) |
| Testing | **Vitest** + **React Testing Library** + **Playwright** | Unit, component and cross-device E2E (Playwright has phone/tablet presets) |
| Hosting | **Vercel / Netlify / GitHub Pages** | Static hosting, HTTPS (needed for PWA) |

**Alternatives considered**
- *Flutter*: excellent cross-platform UI, but the web build is heavier and a
  web-first heatmap is more natural in SVG/DOM.
- *React Native + Expo*: strong for native-first apps; worth choosing instead if
  App Store presence matters more than browser use from day one. The data layer
  and heatmap logic below carry over almost unchanged.

---

## 3. Core features

### 3.1 Habits
- Create, edit, archive, delete, reorder (drag and drop) habits.
- Fields: name, emoji/icon, colour, description.
- **Habit types**
  - **Yes/No**: done or not done (e.g. "Meditate").
  - **Count**: target number per day (e.g. "Drink 8 glasses of water").
  - **Duration**: target minutes per day (e.g. "Read 30 min").
- **Schedule**: every day / specific weekdays / *N* times per week.
- Optional reminder time per habit.

### 3.2 Daily logging ("Today" screen)
- List of habits due today with a big tap target each.
- Yes/No: tap to toggle. Count: tap to +1, long-press or ± to adjust.
  Duration: quick-add chips (+5 / +15 / +30) or a built-in timer.
- Log or edit **past days** by tapping a heatmap cell.
- Optional short note per entry.

### 3.3 GitHub-style heatmap (see §5 for details)
- **Per-habit heatmap** on each habit's detail page.
- **Overview heatmap** combining all habits (share of scheduled habits done that day).
- Year selector (rolling last 365 days, or calendar years 2025, 2026, …).
- Tooltip / tap popover: "Tue, Nov 4 2026 — 6 / 8 glasses".
- Legend: "Less ▢▢▢▢▢ More".

### 3.4 Statistics
- Current streak, longest streak, total completions.
- Completion rate (last 7 / 30 / 365 days).
- Best weekday (bar chart), monthly trend (line chart).

### 3.5 Settings
- Theme: light / dark / system. Heatmap colour palette per habit.
- First day of week (Sunday / Monday).
- "Day ends at" offset (e.g. 3 AM for night owls).
- Export / import (JSON and CSV). Account and sync.

---

## 4. Data model

Dates are stored as **local calendar-day strings (`YYYY-MM-DD`)**, not
timestamps, so a check-in at 11 PM in Tokyo never moves to a different day
when viewed in New York. This is the most important decision in the data model.

```ts
type HabitType = 'boolean' | 'count' | 'duration';

type Schedule =
  | { kind: 'daily' }
  | { kind: 'weekdays'; days: number[] }      // 0 = Sun … 6 = Sat
  | { kind: 'timesPerWeek'; times: number };

interface Habit {
  id: string;              // UUID v7 (sortable, generated on-device)
  name: string;
  icon?: string;
  color: string;           // palette key, e.g. 'green'
  type: HabitType;
  target: number;          // 1 for boolean; count or minutes otherwise
  schedule: Schedule;
  reminderTime?: string;   // 'HH:mm'
  order: number;
  createdAt: string;       // ISO timestamp
  archivedAt?: string;
  updatedAt: string;       // for sync
  deleted?: boolean;       // tombstone for sync
}

interface Entry {
  id: string;              // `${habitId}:${date}`, one entry per habit per day
  habitId: string;
  date: string;            // 'YYYY-MM-DD' (local day)
  value: number;           // 1/0 for boolean, count, or minutes
  note?: string;
  updatedAt: string;
  deleted?: boolean;
}
```

**Dexie schema**
```ts
db.version(1).stores({
  habits:  'id, order, archivedAt, updatedAt',
  entries: 'id, habitId, date, [habitId+date], updatedAt',
});
```
The compound index `[habitId+date]` lets a full year for one habit load with a
single range query (`between([id, start], [id, end])`).

---

## 5. Heatmap design (the core feature)

### 5.1 Layout
- Grid of **7 rows (weekdays) × ~53 columns (weeks)**, filled column by column,
  oldest week on the left and the current week on the right.
- The first column starts on the configured first day of the week on or before
  `today − 364 days`; days before the range and after today are left empty.
- **Month labels** above the first column in which each month starts.
- **Weekday labels** (Mon / Wed / Fri) on the left.
- Cell size and gap come from the container width (see §5.4).

### 5.2 Intensity levels (0–4, like GitHub)
For each day, compute a **ratio** and map it to 5 buckets:

| Habit type | ratio |
|---|---|
| Boolean | `value ? 1 : 0` |
| Count / Duration | `min(value / target, 1)` |
| Overview (all habits) | `completed scheduled habits / scheduled habits that day` |

```ts
function level(ratio: number): 0 | 1 | 2 | 3 | 4 {
  if (ratio <= 0) return 0;
  if (ratio < 0.25) return 1;
  if (ratio < 0.5)  return 2;
  if (ratio < 1)    return 3;
  return 4;
}
```
- Boolean habits only ever use levels 0 and 4, which reads cleanly.
- Optional "relative" mode for count habits: buckets based on quartiles of the
  user's own history (that is how GitHub does it), so going over target still
  shows variation.
- Days on which a habit was **not scheduled** get a distinct "rest day" style
  (hatched or lower-opacity), so they don't look like misses.

### 5.3 Colours
- Each palette has 5 tokens, `--heat-0` … `--heat-4`, defined separately for
  light and dark themes (e.g. green, blue, purple, orange, pink).
- Check contrast between `--heat-0` and `--heat-1` in both themes; never rely
  on colour alone (see a11y below).

### 5.4 Responsive behaviour

| Breakpoint | Behaviour |
|---|---|
| **Desktop ≥ 1024 px** | Full year in one row; cells ~12–14 px; hover tooltips |
| **Tablet 640–1023 px** | Full year, cells scale to fit width (min 10 px); tap opens a popover |
| **Phone < 640 px** | Either **horizontal scroll** with the current week pinned in view on load, or a **compact mode** showing the last 26 weeks with a "Show full year" toggle. Optional **vertical layout** (weeks as rows) for portrait mode |

- Cells are at least 10 px to look right, but on touch devices the **hit area**
  is at least 24 px (invisible padding, or a tap picks the nearest cell), and a
  tap opens a bottom sheet to view or edit that day.
- Use a `ResizeObserver` on the container to recompute the cell size; no layout
  depends only on `window.innerWidth`.

### 5.5 Component API
```tsx
<Heatmap
  data={Map<string, number>}        // date -> ratio (0..1)
  endDate="2026-11-04"
  weeks={53}
  weekStart={1}                     // Monday
  palette="green"
  isScheduled={(date) => boolean}
  onCellClick={(date) => void}
  renderTooltip={(date, ratio) => ReactNode}
/>
```
Inside it, a pure function `buildGrid(endDate, weeks, weekStart)` returns
`{ columns: Day[][], monthLabels }`. It is fully unit-tested and has no React
in it.

### 5.6 Accessibility
- The SVG has `role="grid"`; each cell is a `role="gridcell"` with an
  `aria-label` such as "Tuesday 4 November 2026: 6 of 8, 75 %".
- **Keyboard**: arrow keys move between days, Enter opens the editor, and
  Home/End jump to the start or end of the range (roving `tabindex`).
- Option to show text inside cells or a pattern for colour-blind users.
- A "View as table" toggle for screen-reader users.

### 5.7 Performance
- 371 cells × N habits is small; memoise the grid per `(endDate, weekStart)`
  and the ratio map per habit.
- On the overview page with many habits, lazy-render heatmaps below the fold
  (`IntersectionObserver`).
- Aim for under 16 ms to render one heatmap on a mid-range phone.

---

## 6. Streak and stats logic

- **Current streak**: walk backwards from today (or yesterday, if today isn't
  logged yet) over *scheduled* days only, counting days with ratio ≥ 1.
  Unscheduled days neither break nor extend the streak.
- **Times-per-week habits**: count streaks in **weeks** (a week counts if
  completions ≥ times).
- **Longest streak**: one pass over the sorted entries.
- All stats are pure functions in `src/domain/stats.ts` with thorough tests
  (around DST changes, leap years, and week starts).

---

## 7. Sync (optional, phase 3)

- **Local-first**: Dexie is the source of truth; the UI never waits for the network.
- Supabase tables mirror `habits` and `entries`, plus a `user_id` column, with
  Row Level Security `user_id = auth.uid()`.
- **Sync algorithm** (last-write-wins per record):
  1. Push local records with `updatedAt > lastPushedAt`.
  2. Pull remote records with `updatedAt > lastPulledAt`.
  3. Merge: for each record id, keep the newer `updatedAt`. Deletes are
     tombstones (`deleted: true`), so they sync too.
- Trigger sync on app start, on `online` events, after writes (debounced
  2 s), and from Supabase Realtime for near-instant cross-device updates.
- Since an entry's id is `habitId:date`, two devices logging the same day merge
  into a single record instead of creating duplicates.

### 7.1 Single-user setup (this app has one user: the owner)

The app syncs one person's data across their laptop, tablet and phone, so the
Supabase **free plan** is more than enough: about 3,650 rows (≈ 1 MB) a year
for 10 daily habits, against a 500 MB limit. Three extra steps:

1. **Keep the project awake.** Free projects pause after 7 days without
   activity. Nothing is lost (every device keeps its own copy and catches up
   later), but sync stops until the project is restored in the dashboard. A
   scheduled GitHub Action (`.github/workflows/keepalive.yml`) runs every
   3 days and makes one small read request using a read-only key stored as a
   repository secret.
2. **Lock sign-ups.** After the owner's account exists, turn off
   "Allow new users to sign up" in Supabase Auth settings. RLS
   (`user_id = auth.uid()`) stays as a second safeguard.
3. **Own the backups.** Free-plan backups are limited, so a nightly GitHub
   Action exports `habits` and `entries` to JSON and commits them to a
   **private** backup repository. The in-app JSON export is the manual fallback.

---

## 8. Screens and navigation

| Screen | Contents |
|---|---|
| **Today** | Date header, list of habits due today, quick-log controls, a small overview heatmap strip (last 4 weeks) |
| **Overview** | Year heatmap for all habits combined + one compact heatmap per habit |
| **Habit detail** | Large heatmap, streaks, stats charts, entry history, edit button |
| **Habit editor** | Name, icon, colour, type, target, schedule, reminder |
| **Settings** | Theme, week start, day-end offset, export/import, account |

**Navigation pattern by device**
- Phone: bottom tab bar (Today · Overview · Settings), bottom sheets for editing.
- Tablet: side rail + two-pane layout (habit list | detail).
- Desktop: persistent sidebar, keyboard shortcuts (`n` new habit, `1–9` toggle
  habit *n* for today, `←/→` change day).

---

## 9. Project structure

```
habit-tracker/
├─ public/                  # icons, manifest assets
├─ src/
│  ├─ app/                  # routes, layout shells (phone / tablet / desktop)
│  ├─ components/
│  │  ├─ heatmap/           # Heatmap.tsx, HeatmapCell.tsx, Legend.tsx, buildGrid.ts
│  │  ├─ habits/            # HabitCard, HabitEditor, QuickLog
│  │  └─ ui/                # Button, Sheet, Dialog, Tooltip
│  ├─ domain/               # pure logic: dates.ts, levels.ts, stats.ts, schedule.ts
│  ├─ data/                 # db.ts (Dexie), repositories, sync/
│  ├─ store/                # Zustand stores (UI prefs)
│  ├─ hooks/                # useHabits, useEntries, useHeatmapData
│  └─ styles/               # tailwind.css, theme tokens
├─ tests/e2e/               # Playwright specs (desktop, iPad, iPhone, Pixel)
├─ capacitor.config.ts      # (phase 4)
└─ PLAN.md
```

---

## 10. Roadmap / milestones

### Phase 0: Setup (≈ 1–2 days)
- [x] Vite + React + TS + Tailwind scaffold, Prettier (ESLint still to add)
- [x] Vitest, Playwright, GitHub Actions CI (typecheck, test, build, E2E)
- [ ] Deploy a preview to Vercel/Netlify

### Phase 1: MVP, local only (≈ 1–2 weeks)
- [x] Dexie schema + repositories
- [x] Create/edit/delete habits (boolean type first)
- [x] Today screen with one-tap toggling
- [x] `buildGrid` + `level` with unit tests
- [x] `<Heatmap>` SVG component: desktop layout, tooltips, legend, month labels
- [x] Habit detail page with heatmap + current/longest streak
- [x] Responsive layouts for phone, tablet and desktop
- [x] JSON export/import

### Phase 2: Richer habits + PWA (≈ 1–2 weeks)
- [ ] Count and duration habit types, schedules (weekdays, N per week)
- [ ] Rest-day styling, overview (all-habits) heatmap
- [ ] Tap-to-edit past days via bottom sheet
- [ ] Keyboard navigation + full a11y pass
- [ ] Dark mode + palettes
- [ ] Service worker, manifest, install prompt, offline test
- [ ] Stats charts (weekday bars, monthly trend)

### Phase 3: Accounts + sync (≈ 1–2 weeks)
- [ ] Supabase project (free plan), tables, RLS policies
- [ ] Email magic-link sign-in for the owner, then disable new sign-ups
- [ ] Push/pull sync with tombstones, Realtime updates
- [ ] Upload existing local data on first sign-in
- [ ] Keep-alive GitHub Action (every 3 days) so the project never pauses
- [ ] Nightly JSON backup Action to a private repository
- [ ] Conflict and offline E2E tests (two browser contexts)

### Phase 4: Native packaging + reminders (≈ 1–2 weeks)
- [ ] Capacitor iOS/Android builds
- [ ] Local notifications for reminders (native); Web Push for PWA where supported
- [ ] Haptics on check-in, app icons, splash screens
- [ ] Store listings

### Later / nice-to-have
- Home-screen widgets (today's habits + mini heatmap)
- Desktop app via Tauri
- Shareable heatmap image (PNG export)
- Habit templates, categories/tags, journaling
- Apple Health / Google Fit integration for automatic tracking

---

## 11. Testing strategy

| Layer | What | Tool |
|---|---|---|
| Unit | `buildGrid`, `level`, streaks, schedules, sync merge: incl. DST, leap years, week starts, timezone shifts | Vitest |
| Component | Heatmap renders correct cell count, labels, aria-labels; keyboard navigation; QuickLog interactions | React Testing Library |
| E2E | Create habit → log → heatmap updates; offline logging; responsive layouts at 375 px, 768 px, 1440 px | Playwright (device presets) |
| Visual | Screenshot diffs of the heatmap in light/dark at each breakpoint | Playwright `toHaveScreenshot` |
| a11y | Automated checks on each screen | `@axe-core/playwright` |

---

## 12. Risks and mitigations

| Risk | Mitigation |
|---|---|
| Timezone / DST bugs shift entries to the wrong day | Store `YYYY-MM-DD` local dates; never do day maths on timestamps; test across zones |
| Heatmap is cramped on phones | Compact 26-week mode, horizontal scroll pinned to today, larger hit areas |
| iOS PWA limits (storage eviction, push) | Request persistent storage (`navigator.storage.persist()`), encourage sign-in for backup, Capacitor build for full native features |
| Sync conflicts | One record per habit-day + last-write-wins + tombstones; keeps the model simple |
| Supabase free project pauses after 7 idle days | Keep-alive Action every 3 days; app keeps working offline while paused |
| Someone else signs up to the hosted app | Disable new sign-ups after creating the owner account; RLS on every table |
| Losing data in a local-only setup | Regular export reminder, optional auto-backup to cloud once signed in |

---

## 13. Definition of done for v1
- Works and is installable on Chrome/Edge/Safari desktop, iPadOS Safari,
  iOS Safari and Android Chrome.
- Habits can be created, logged offline and shown in a year-long heatmap that
  is readable at 375 px width.
- Streaks and completion rates are correct (tests pass).
- Lighthouse: PWA installable, Performance ≥ 90, Accessibility ≥ 95.
- Data can be exported and re-imported without loss.
