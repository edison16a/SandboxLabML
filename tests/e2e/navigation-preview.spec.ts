import { expect, test } from '@playwright/test';

/** Render counters the viewport publishes on window.__sbl (see StatsProbe). */
async function stats(page: import('@playwright/test').Page) {
  return page.evaluate(() => (window as unknown as { __sbl?: { stats: { drawCalls: number; instances: Record<string, number> } } }).__sbl?.stats ?? null);
}

test('the navigation preview draws a crowd on a course and switches views', async ({ page }) => {
  await page.goto('/preview/navigation?level=5&agents=40&quality=low');
  await expect(page.getByRole('radiogroup', { name: 'Level' })).toBeVisible();
  await expect.poll(async () => (await stats(page))?.instances.agents ?? 0, { timeout: 60_000 }).toBe(40);
  await expect.poll(async () => (await stats(page))?.instances.movers ?? 0, { timeout: 30_000 }).toBeGreaterThan(0);
  expect((await stats(page))?.drawCalls ?? 0).toBeGreaterThan(10);

  await page.getByRole('radio', { name: 'Overview' }).click();
  await expect(page.getByRole('radio', { name: 'Overview' })).toHaveAttribute('aria-checked', 'true');
  await page.keyboard.press('c');
  await expect(page.getByRole('radio', { name: 'Top' })).toHaveAttribute('aria-checked', 'true');

  await page.getByRole('radiogroup', { name: 'Level' }).getByRole('radio', { name: '0' }).click();
  await expect(page.getByText('Straight run')).toBeVisible();
  await expect.poll(async () => (await stats(page))?.instances.movers ?? -1, { timeout: 30_000 }).toBe(0);
});
