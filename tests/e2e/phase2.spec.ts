import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

async function create(page: Page, name: string, setup?: (page: Page) => Promise<void>) {
  await page.goto('./#/habits/new');
  await page.getByLabel('Name').fill(name);
  await setup?.(page);
  await page.getByRole('button', { name: 'Create habit' }).click();
  await expect(page.getByRole('heading', { name })).toBeVisible();
}

test('count habit: tap + and − on Today, partial days shade lighter', async ({ page }) => {
  await create(page, 'Water', async (p) => {
    await p.getByText('Count', { exact: true }).click();
    await p.getByLabel('Daily target').fill('3');
    await p.getByLabel('Unit').fill('glasses');
  });
  await page.goto('./');
  const log = page.getByTestId('log-Water');
  await log.click();
  await expect(page.getByText(/1 \/ 3 glasses/)).toBeVisible();
  await log.click();
  await log.click();
  await expect(page.getByText(/3 \/ 3 glasses/)).toBeVisible();
  await expect(page.getByText('1 of 1 done')).toBeVisible();
  await page.getByRole('button', { name: 'Water: subtract 1' }).click();
  await expect(page.getByText(/2 \/ 3 glasses/)).toBeVisible();

  await page.getByRole('link', { name: /Water/ }).first().click();
  await expect(page.locator('rect.heat-cell[data-level="3"]')).toHaveCount(1);
});

test('minutes habit: log time from the sheet', async ({ page }) => {
  await create(page, 'Reading', async (p) => {
    await p.getByText('Minutes', { exact: true }).click();
  });
  await page.goto('./');
  await page.getByTestId('log-Reading').click();
  await page.getByRole('button', { name: '+15 min' }).click();
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByText(/15 \/ 30 min/)).toBeVisible();
});

test('times-a-week habit shows weekly progress', async ({ page }) => {
  await create(page, 'Gym', async (p) => {
    await p.getByText('Times a week').click();
  });
  await expect(page.getByText('3× per week')).toBeVisible();
  await page.goto('./');
  await expect(page.getByText(/0 \/ 3 this week/)).toBeVisible();
  await page.getByTestId('log-Gym').click();
  await expect(page.getByText(/1 \/ 3 this week/)).toBeVisible();
});

test('works offline after the first visit', async ({ page, context }) => {
  await page.goto('./');
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.reload(); // now controlled by the service worker
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
  await create(page, 'Offline habit');
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Offline habit' })).toBeVisible();
  await page.goto('./#/');
  await page.getByTestId('log-Offline habit').click();
  await expect(page.getByText('1 of 1 done')).toBeVisible();
  await context.setOffline(false);
});

test('no serious accessibility issues on any screen', async ({ page }) => {
  await create(page, 'Read');
  const id = page.url().split('/').pop();
  for (const route of [
    './#/',
    './#/overview',
    `./#/habits/${id}`,
    `./#/habits/${id}/edit`,
    './#/settings',
    './#/habits/new',
  ]) {
    await page.goto(route);
    await page.waitForTimeout(150);
    const { violations } = await new AxeBuilder({ page }).analyze();
    const serious = violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
    expect(
      serious.map(
        (v) =>
          `${route}: ${v.id} – ${v.nodes
            .map((n) => n.target.join(' '))
            .slice(0, 3)
            .join(', ')}`,
      ),
    ).toEqual([]);
  }
});
