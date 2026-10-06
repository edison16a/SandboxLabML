import { expect, test, type Page } from '@playwright/test';

/** Reads the renderer counters the app publishes on window.__sbl. */
async function stats(page: Page) {
  return page.evaluate(() => window.__sbl?.stats ?? null);
}

test.describe('Racing lab', () => {
  test.setTimeout(240_000);

  test('trains to generation 3, shows ghosts, and the inputs overlay draws rays', async ({ page }) => {
    // Skip the first-visit tour so it does not sit on top of the controls.
    await page.addInitScript(() => window.localStorage.setItem('sandboxlab.tour.racing', '1'));
    await page.goto('/lab/racing?quality=low');
    await expect(page.getByRole('button', { name: 'Train' })).toBeEnabled({ timeout: 60_000 });
    // Max trains headless on every worker and holds the viewport still, so three generations take
    // seconds and the software renderer does not compete with training for the CPU.
    await page.keyboard.press('5');
    await page.getByRole('button', { name: 'Train' }).click();
    await expect(page.getByText('The viewport is paused so Max can use every core')).toBeVisible();
    await expect(page.getByText('Recent champions')).toBeVisible();
    await expect.poll(async () => page.locator('tbody tr').count(), { timeout: 180_000 }).toBeGreaterThanOrEqual(3);

    // Pausing wakes the viewport and brings the ghosts back.
    await page.keyboard.press(' ');
    await expect(page.getByText('The viewport is paused so Max can use every core')).toBeHidden();
    // V cycles the view: both, population, overlay. Keys avoid fighting the busy software renderer for clicks.
    await page.keyboard.press('v');
    await page.keyboard.press('v');
    await expect.poll(async () => (await stats(page))?.instances.ghosts ?? 0, { timeout: 60_000 }).toBeGreaterThanOrEqual(2);

    await page.keyboard.press('1');
    await page.keyboard.press(' ');
    const before = (await stats(page))?.instances.rays ?? 0;
    await page.keyboard.press('i');
    await expect.poll(async () => (await stats(page))?.instances.rays ?? 0, { timeout: 60_000 }).toBeGreaterThan(before);
  });
});
