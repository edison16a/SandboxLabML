import { expect, test, type Page } from '@playwright/test';

/** Reads the renderer counters the app publishes on window.__sbl. */
async function stats(page: Page) {
  return page.evaluate(() => window.__sbl?.stats ?? null);
}

/** Every lab's tour is marked done, so none sits on top of the controls. */
async function skipTours(page: Page) {
  await page.addInitScript(() => {
    for (const k of ['driving', 'navigation']) window.localStorage.setItem(`sandboxlab.tour.${k}`, '1');
  });
}

test.describe('Navigation lab', () => {
  test.setTimeout(300_000);

  test('trains on Max, climbs, and its view toggle, cameras and inputs overlay work', async ({ page }) => {
    await skipTours(page);
    await page.goto('/lab/navigation?quality=low');
    await expect(page.getByRole('button', { name: 'Train' })).toBeEnabled({ timeout: 90_000 });
    // The next generation's course stands ready with the population on its grid before anything trains.
    await expect.poll(async () => (await stats(page))?.instances.agents ?? 0, { timeout: 90_000 }).toBe(100);

    // Max trains headless on every worker and holds the viewport still.
    await page.keyboard.press('5');
    await page.getByRole('button', { name: 'Train' }).click();
    await expect(page.getByText('Paused while Max trains')).toBeVisible();
    await expect(page.getByText('Recent champions')).toBeVisible({ timeout: 120_000 });
    await expect(page.getByText('Curriculum', { exact: true })).toBeVisible();
    await expect(page.getByText('Finishing', { exact: true })).toBeVisible();
    await expect.poll(async () => page.locator('tbody tr').count(), { timeout: 180_000 }).toBeGreaterThanOrEqual(5);
    // The curriculum moves on once the best fifth finishes: past level 0 within a few generations.
    await expect(page.locator('[data-tour="hud-level"]')).not.toContainText('Straight run', { timeout: 180_000 });

    // Pausing wakes the viewport. The Overlay view shows only the ghosts of past champions.
    await page.keyboard.press(' ');
    await expect(page.getByText('Paused while Max trains')).toBeHidden();
    await page.keyboard.press('v');
    await page.keyboard.press('v');
    await expect(page.getByRole('radio', { name: 'Overlay' })).toHaveAttribute('aria-checked', 'true');
    await expect.poll(async () => (await stats(page))?.instances.ghosts ?? 0, { timeout: 90_000 }).toBeGreaterThanOrEqual(1);
    expect((await stats(page))?.instances.agents ?? -1).toBe(0);
    await page.keyboard.press('v');
    await expect(page.getByRole('radio', { name: 'Both' })).toHaveAttribute('aria-checked', 'true');

    // C cycles the cameras: follow, overview, top down, free, and back.
    const camera = page.getByRole('combobox', { name: 'Camera' });
    await expect(camera).toHaveText('Follow');
    for (const name of ['Overview', 'Top down', 'Free', 'Follow']) {
      await page.keyboard.press('c');
      await expect(camera).toHaveText(name);
    }

    // At 1x the population runs on screen, and I draws what the followed runner senses.
    await page.keyboard.press('1');
    await page.keyboard.press(' ');
    await expect.poll(async () => (await stats(page))?.instances.agents ?? 0, { timeout: 90_000 }).toBe(100);
    await page.keyboard.press('i');
    await expect(page.getByText('Followed runner')).toBeVisible();
    await expect.poll(async () => (await stats(page))?.instances.rays ?? 0, { timeout: 90_000 }).toBeGreaterThan(0);
    // The readout is the runner's real inputs, streamed from the worker: a number, not a dash. New runs start on the Starter brain.
    await expect(page.getByText('Followed runner').locator('..')).toContainText(/Finish distance\s*\d+\.\d+ m/, { timeout: 90_000 });
    await page.keyboard.press(' ');
    await expect(page.getByRole('button', { name: 'Train' })).toBeVisible();
  });

  test('opens the New run dialog with its courses and start levels', async ({ page }) => {
    await skipTours(page);
    await page.goto('/lab/navigation?quality=low');
    await expect(page.getByRole('button', { name: 'Train' })).toBeEnabled({ timeout: 90_000 });
    await page.keyboard.press('n');
    const dialog = page.getByRole('dialog', { name: 'New navigation run' });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('button', { name: /Fresh courses/ })).toHaveAttribute('aria-pressed', 'true');
    await dialog.getByRole('radio', { name: '3' }).first().click();
    await expect(dialog).toContainText('Spikes. Rows of spikes.');
    await dialog.getByRole('button', { name: /Zigzag/ }).click();
    await expect(dialog).toContainText('Every generation runs this one course.');
    await expect(dialog.getByText('Start level')).toBeHidden();
    await dialog.getByRole('button', { name: 'Cancel' }).click();
    await expect(dialog).toBeHidden();
  });
});
