# Habit Tracker

A personal habit tracker with a GitHub-style contribution heatmap. It runs in the
browser on laptop, tablet and phone, and stores everything on the device (IndexedDB),
so it works offline.

See [PLAN.md](PLAN.md) for the full product and technical plan.

## What works (Phase 1 MVP)

- Create, edit, archive and delete habits (name, emoji, colour, every day or specific weekdays)
- **Today** screen: one tap to check a habit off; on desktop, keys `1`–`9` toggle habits and `n` adds one
- **Heatmaps**: per habit (last 12 months or any calendar year), all habits combined, and a 12-week strip on Today
  - Five shading levels, month and weekday labels, tooltips, faded rest days
  - Tap or press Enter on a day to change it; arrow keys move between days
  - Fits the screen on desktop and tablet; scrolls sideways on phones, starting at today
- Current and longest streaks, total check-ins, 30-day completion rate
- Light / dark / system theme, Monday or Sunday week start
- JSON export and import (newer records win, so re-importing is safe)

## Development

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # unit + component tests (Vitest)
npm run e2e        # browser tests at desktop, tablet and phone sizes (Playwright)
npm run build      # production build in dist/
```

The first `npm run e2e` needs a browser: run `npx playwright install chromium`, or point
`PW_CHROMIUM_PATH` at an existing Chromium.

The build is a static site (hash routing, relative paths), so `dist/` can be hosted on
GitHub Pages, Netlify or Vercel as-is.
