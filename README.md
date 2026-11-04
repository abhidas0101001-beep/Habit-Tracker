# Habit Tracker

A personal habit tracker with a GitHub-style contribution heatmap. It runs in the
browser on laptop, tablet and phone, and stores everything on the device (IndexedDB),
so it works offline.

See [PLAN.md](PLAN.md) for the full product and technical plan.

## What works (Phases 1–2)

- Create, edit, archive and delete habits (name, emoji, colour)
  - Types: **yes/no**, **count** (e.g. 8 glasses) and **minutes** (e.g. 30 min)
  - Schedules: every day, specific weekdays, or **N times a week** (streaks counted in weeks)
- **Today** screen: one tap to check a habit off or add 1; minutes open a quick-add sheet (+5 / +15 / +30); on desktop, keys `1`–`9` log habits and `n` adds one
- **Heatmaps**: per habit (last 12 months or any calendar year), all habits combined, and a 12-week strip on Today
  - Five shading levels, month and weekday labels, tooltips, faded rest days
  - Tap or press Enter on a day to change it; arrow keys move between days
  - Fits the screen on desktop and tablet; scrolls sideways on phones, starting at today
- Current and longest streaks, days on target, 30-day completion rate
- Charts: completion by weekday and by month, each with a table view
- Installable app (home screen / dock) that works offline, with an update prompt
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

## Deployment

`.github/workflows/deploy.yml` builds and publishes the app to GitHub Pages on every push
to the default branch (or run it by hand from the Actions tab). One-time setup:
**Settings → Pages → Build and deployment → Source: GitHub Actions**.

The site will be at `https://abhidas0101001-beep.github.io/Habit-Tracker/`. Your habit data
never leaves your device, so the public site only serves the app's code.
