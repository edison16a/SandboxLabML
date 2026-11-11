import { expect, test, type Page } from '@playwright/test';

/** Reads the renderer counters the app publishes on window.__sbl. */
async function counters(page: Page) {
  return page.evaluate(() => window.__sbl?.stats.instances ?? null);
}

/** Opens the lab with its tour marked as seen, so it does not sit on top of the controls. */
async function openLab(page: Page) {
  await page.addInitScript(() => window.localStorage.setItem('sandboxlab.tour.driving', '1'));
  await page.goto('/lab/driving?quality=low');
  await expect(page.getByRole('button', { name: 'Train' })).toBeEnabled({ timeout: 60_000 });
}

test.describe('Driving lab', () => {
  test.setTimeout(300_000);

  test('trains a few generations on Max and charts the curriculum', async ({ page }) => {
    await openLab(page);
    // Max trains headless on every worker and holds the viewport still, so the software renderer stays out of the way.
    await page.keyboard.press('5');
    await page.getByRole('button', { name: 'Train' }).click();
    await expect(page.getByText('Paused while Max trains')).toBeVisible();
    await expect(page.getByText('Recent champions')).toBeVisible({ timeout: 120_000 });
    await expect.poll(async () => page.locator('tbody tr').count(), { timeout: 180_000 }).toBeGreaterThanOrEqual(3);
    await expect(page.getByRole('heading', { name: 'Curriculum' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Arrivals' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Safety' })).toBeVisible();
    await expect(page.getByText('Empty streets').first()).toBeVisible();

    // Pausing wakes the viewport, and past champions drive it.
    await page.keyboard.press(' ');
    await expect(page.getByText('Paused while Max trains')).toBeHidden();
    await expect.poll(async () => (await counters(page))?.population ?? 0, { timeout: 90_000 }).toBeGreaterThanOrEqual(2);
  });

  test('switches views and cameras, and draws what the followed SUV senses', async ({ page }) => {
    await openLab(page);
    await page.getByRole('button', { name: 'Train' }).click();
    // At 1x the live generation drives the city, one hundred SUVs.
    await expect.poll(async () => (await counters(page))?.population ?? 0, { timeout: 120_000 }).toBe(100);
    await expect.poll(async () => (await counters(page))?.focus ?? -1, { timeout: 60_000 }).toBeGreaterThanOrEqual(0);

    // C cycles the cameras: chase, orbit, corner, top down, free.
    const camera = page.getByRole('combobox', { name: 'Camera' });
    await expect(camera).toContainText('Chase');
    await page.keyboard.press('c');
    await expect(camera).toContainText('Orbit');
    await page.keyboard.press('c');
    await expect(camera).toContainText('Corner');
    await expect.poll(async () => (await counters(page))?.camera, { timeout: 30_000 }).toBe(2);
    await page.keyboard.press('c');
    await expect(camera).toContainText('Top down');

    // V cycles what is shown: both, population, overlay. Overlay replays past champions only.
    const view = page.getByRole('radiogroup', { name: 'What to show' });
    await page.keyboard.press('v');
    await expect(view.getByRole('radio', { name: 'Population' })).toHaveAttribute('aria-checked', 'true');
    await page.keyboard.press('v');
    await expect(view.getByRole('radio', { name: 'Overlay' })).toHaveAttribute('aria-checked', 'true');
    await page.keyboard.press('v');
    await expect(view.getByRole('radio', { name: 'Both' })).toHaveAttribute('aria-checked', 'true');

    // I turns the inputs on: lidar beams in the city and the followed SUV's live numbers in a card.
    await page.keyboard.press('i');
    await expect(page.getByText('Followed SUV')).toBeVisible();
    await expect.poll(async () => (await counters(page))?.beams ?? 0, { timeout: 60_000 }).toBeGreaterThan(0);
    await expect(page.getByText('Light ahead').first()).toBeVisible();
    await page.keyboard.press('i');
    await expect(page.getByText('Followed SUV')).toBeHidden();
  });

  test('opens the new run dialog with the city and the levels', async ({ page }) => {
    await openLab(page);
    await page.getByRole('button', { name: 'New run' }).click();
    const dialog = page.getByRole('dialog', { name: 'New driving run' });
    await expect(dialog).toBeVisible();
    for (const city of ['Midtown', 'Harbor', 'Old Town', 'Random']) await expect(dialog.getByRole('button', { name: city, exact: true })).toBeVisible();
    await dialog.getByRole('button', { name: 'Harbor', exact: true }).click();
    await expect(dialog).toContainText('The benchmark drives here');
    await dialog.getByRole('radio', { name: 'Fixed level' }).click();
    await expect(dialog).toContainText('Stays on this level the whole run');
    await dialog.getByRole('button', { name: 'Cancel' }).click();
    await expect(dialog).toBeHidden();
  });
});
