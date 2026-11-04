import { expect, test, type Page } from '@playwright/test';

async function createHabit(page: Page, name: string) {
  await page.goto('./#/habits/new');
  await page.getByLabel('Name').fill(name);
  await page.getByRole('button', { name: 'Create habit' }).click();
  await expect(page.getByRole('heading', { name })).toBeVisible();
}

test('create a habit, check it off, and see the heatmap update', async ({ page }) => {
  await page.goto('./');
  await expect(page.getByText('Start your first habit')).toBeVisible();

  await createHabit(page, 'Read');
  await page.goto('./');
  const toggle = page.getByRole('button', { name: 'Read: mark done for today' });
  await toggle.click();
  await expect(page.getByRole('button', { name: 'Read: done today, tap to undo' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(page.getByText('1 of 1 done')).toBeVisible();

  await page.getByRole('link', { name: /Read/ }).first().click();
  await expect(page.getByText('Current streak')).toBeVisible();
  const done = page.locator('rect.heat-cell[data-level="4"]');
  await expect(done).toHaveCount(1);

  // The heatmap fits the page: no horizontal scroll on the document itself.
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
});

test('edit a past day from the heatmap', async ({ page }) => {
  await createHabit(page, 'Meditate');
  const cells = page.locator('rect.heat-cell');
  const count = await cells.count();
  const yesterday = cells.nth(count - 2);
  await yesterday.click();
  await page.getByRole('button', { name: 'Mark done' }).click();
  await expect(page.locator('rect.heat-cell[data-level="4"]')).toHaveCount(1);
  await expect(page.getByText('Longest streak').locator('..')).toContainText('1 d');
});

test('data survives a reload (stored on the device)', async ({ page }) => {
  await createHabit(page, 'Stretch');
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Stretch' })).toBeVisible();
});
