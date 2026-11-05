import { defineConfig, devices } from '@playwright/test';

// Set PW_CHROMIUM_PATH to use a pre-installed Chromium instead of `npx playwright install`.
const executablePath = process.env.PW_CHROMIUM_PATH || undefined;

export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: true,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: 'http://localhost:4173',
    launchOptions: { executablePath },
  },
  webServer: [
    {
      command: 'npm run build && npx vite preview --port 4173 --strictPort',
      port: 4173,
      reuseExistingServer: !process.env.CI,
    },
    {
      // Same app built with sync turned on, pointed at a fake Supabase that tests mock.
      command:
        'VITE_SUPABASE_URL=https://fake-project.supabase.co VITE_SUPABASE_ANON_KEY=test-anon-key npx vite build --outDir dist-sync && npx vite preview --outDir dist-sync --port 4174 --strictPort',
      port: 4174,
      reuseExistingServer: !process.env.CI,
    },
  ],
  projects: [
    {
      name: 'desktop',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } },
    },
    {
      name: 'tablet',
      use: { ...devices['Desktop Chrome'], viewport: { width: 820, height: 1180 }, hasTouch: true },
    },
    { name: 'phone', use: { ...devices['Pixel 7'] } },
  ],
});
