import { expect, test, type Page } from '@playwright/test';

/** Reads the renderer counters the app publishes on window.__sbl. */
async function stats(page: Page) {
  return page.evaluate(() => window.__sbl?.stats ?? null);
}

test.describe('Racing lab', () => {
  test.setTimeout(240_000);

  test('trains to generation 3, shows ghosts, and the inputs overlay draws rays', async ({ page }) => {
    await page.goto('/lab/racing?quality=low');
    await expect(page.getByRole('button', { name: 'Train' })).toBeEnabled({ timeout: 60_000 });
    // Turbo trains headless on every worker, so three generations take seconds.
    await page.keyboard.press('4');
    await page.getByRole('button', { name: 'Train' }).click();
    await expect(page.getByText('Recent champions')).toBeVisible();
    await expect.poll(async () => page.locator('tbody tr').count(), { timeout: 180_000 }).toBeGreaterThanOrEqual(3);

    // V cycles the view: both, population, overlay. Keys avoid fighting the busy software renderer for clicks.
    await page.keyboard.press('v');
    await page.keyboard.press('v');
    await expect.poll(async () => (await stats(page))?.instances.ghosts ?? 0, { timeout: 60_000 }).toBeGreaterThanOrEqual(2);

    await page.keyboard.press(' ');
    await page.keyboard.press('1');
    await page.keyboard.press(' ');
    const before = (await stats(page))?.instances.rays ?? 0;
    await page.keyboard.press('i');
    await expect.poll(async () => (await stats(page))?.instances.rays ?? 0, { timeout: 60_000 }).toBeGreaterThan(before);
  });
});
