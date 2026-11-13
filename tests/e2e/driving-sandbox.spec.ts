import { expect, test, type Page } from '@playwright/test';

/** Reads the renderer counters the app publishes on window.__sbl. */
async function counters(page: Page) {
  return page.evaluate(() => window.__sbl?.stats.instances ?? null);
}

/** Runs in the page: waits for the Sandbox bar to say the trip is over, then presses its Pause button at once. */
function pauseWhenTripOver(): Promise<void> {
  return new Promise((resolve) => {
    const look = () => {
      const panel = document.querySelector('[aria-label="Sandbox"]');
      const over = Array.from(panel?.querySelectorAll('[role="status"]') ?? []).some((n) => n.textContent?.includes('Trip over'));
      const pause = panel?.querySelector<HTMLButtonElement>('button[aria-label="Pause"]');
      if (over && pause) {
        pause.click();
        resolve();
      } else setTimeout(look, 25);
    };
    look();
  });
}

async function openLab(page: Page) {
  await page.addInitScript(() => window.localStorage.setItem('sandboxlab.tour.driving', '1'));
  await page.goto('/lab/driving?quality=low');
  await expect(page.getByRole('button', { name: 'Train', exact: true })).toBeEnabled({ timeout: 60_000 });
}

async function openSandbox(page: Page) {
  await page.getByRole('button', { name: 'Sandbox', exact: true }).click();
  const panel = page.getByRole('region', { name: 'Sandbox' });
  await expect(panel).toBeVisible({ timeout: 60_000 });
  return panel;
}

test.describe('Driving Sandbox', () => {
  test.setTimeout(300_000);

  test('drives the trained model before any training, on any city, level and route', async ({ page }) => {
    await openLab(page);
    const panel = await openSandbox(page);

    // A run with nothing trained yet opens on the shipped trained model, on the SUVs tab.
    await expect(panel.getByRole('tab', { name: /SUVs/ })).toHaveAttribute('aria-selected', 'true');
    const model = panel.getByRole('switch', { name: 'Drive the trained model' });
    await expect(model).toBeChecked({ timeout: 60_000 });
    await expect(panel.getByText(/preset's champion, benchmark \d+/)).toBeVisible();
    await expect(panel.getByText('of 3 driving')).toBeVisible({ timeout: 60_000 });
    await expect.poll(async () => (await counters(page))?.population ?? 0, { timeout: 90_000 }).toBe(3);

    // One more copy of it lines up behind.
    await panel.getByRole('button', { name: 'One more trained model' }).click();
    await expect(panel.getByText('of 4 driving')).toBeVisible({ timeout: 60_000 });

    // The trip: another city, another level, a new route and a destination picked on the map.
    await panel.getByRole('tab', { name: 'Trip' }).click();
    await panel.getByRole('button', { name: /Harbor/ }).click();
    await expect(panel.getByRole('button', { name: /Harbor/ })).toHaveAttribute('aria-pressed', 'true');
    await panel.getByRole('radiogroup', { name: 'Level' }).getByRole('radio', { name: '3' }).click();
    await expect(page.getByText('3 Pedestrians')).toBeVisible();
    await panel.getByRole('button', { name: 'New route' }).click();
    const map = panel.getByRole('img', { name: /City map/ });
    const box = await map.boundingBox();
    if (box) await page.mouse.click(box.x + box.width * 0.3, box.y + box.height * 0.5);
    await expect(panel.getByText(/of 4 driving/)).toBeVisible({ timeout: 60_000 });
    await expect.poll(async () => (await counters(page))?.people ?? 0, { timeout: 90_000 }).toBeGreaterThan(0);

    // Space pauses the trip rather than training; restart plays it again.
    await page.keyboard.press(' ');
    await expect(panel.getByRole('button', { name: 'Play' })).toBeVisible();
    await panel.getByRole('button', { name: 'Restart the trip' }).click();
    await expect(panel.getByRole('button', { name: 'Pause' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Train', exact: true })).toBeVisible();

    // The model's own inputs label the inputs tab, and lesions work on them.
    await page.getByRole('tab', { name: 'Inputs' }).click();
    await expect(page.getByText('Lesion test')).toBeVisible();

    // Closing goes back to training, where the view switch returns.
    await panel.getByRole('button', { name: 'Back to training' }).click();
    await expect(panel).toBeHidden();
    await expect(page.getByRole('radiogroup', { name: 'What to show' })).toBeVisible();
  });

  test('shows the trip as over once every SUV arrived, holds it while paused, then drives it again', async ({ page }) => {
    await openLab(page);
    // Four times real time, so the first trip ends in well under a minute.
    await page.keyboard.press('3');
    const panel = await openSandbox(page);
    await expect(panel.getByText('of 3 driving')).toBeVisible({ timeout: 120_000 });
    // The page presses Pause itself the moment the trip is over, so a slow test runner cannot miss the 4 s rest.
    const paused = page.evaluate(pauseWhenTripOver);

    // The first trip is one every copy of the trained model arrives on safely.
    const over = panel.getByRole('status').filter({ hasText: 'Trip over' });
    await expect(over).toBeVisible({ timeout: 180_000 });
    await paused;
    await expect(over).toContainText('3 of 3 arrived');

    // Paused while it rests, the finished trip stays on screen past the rest: all three SUVs, one of them followed.
    await expect(panel.getByRole('button', { name: 'Play' })).toBeVisible();
    await page.waitForTimeout(7_000);
    await expect(over).toBeVisible();
    expect(await counters(page)).toMatchObject({ population: 3 });
    expect((await counters(page))?.focus ?? -1).toBeGreaterThanOrEqual(0);

    // Resumed, the replay drives it again, and the bar never reads as empty on the way.
    await panel.getByRole('button', { name: 'Play' }).click();
    const nothing = panel.getByText('Nothing to drive yet');
    const driving = panel.getByText('of 3 driving');
    const until = Date.now() + 60_000;
    while (Date.now() < until && !(await driving.isVisible())) {
      expect(await nothing.isVisible()).toBe(false);
      await page.waitForTimeout(100);
    }
    await expect(driving).toBeVisible();
    await expect(panel.getByRole('button', { name: 'Restart the trip' })).toBeEnabled();
  });

  test('says so when the trained model cannot be loaded', async ({ page }) => {
    await page.route('**/references/driving.json', (route) => route.fulfill({ status: 404, body: '' }));
    await openLab(page);
    const panel = await openSandbox(page);
    await expect(panel.getByText('The trained model could not be loaded.')).toBeVisible({ timeout: 60_000 });
    const model = panel.getByRole('switch', { name: 'Drive the trained model' });
    await expect(model).toBeDisabled();
    await expect(model).not.toBeChecked();
    await expect(panel.getByText('Nothing to drive yet')).toBeVisible();
  });

  test('lines up the run\'s own champions after a little training', async ({ page }) => {
    await openLab(page);
    await page.keyboard.press('5');
    await page.getByRole('button', { name: 'Train', exact: true }).click();
    await expect.poll(async () => page.locator('tbody tr').count(), { timeout: 180_000 }).toBeGreaterThanOrEqual(3);
    await page.keyboard.press(' ');
    await expect(page.getByText('Paused while Max trains')).toBeHidden();

    const panel = await openSandbox(page);
    // With champions to drive it opens on the trip.
    await expect(panel.getByRole('tab', { name: 'Trip' })).toHaveAttribute('aria-selected', 'true');
    await panel.getByRole('tab', { name: /SUVs/ }).click();
    const model = panel.getByRole('switch', { name: 'Drive the trained model' });
    await expect(model).not.toBeChecked();
    await expect(panel.getByRole('listitem').first()).toBeVisible();

    // Down to one champion, then three copies of it.
    while ((await panel.getByRole('listitem').count()) > 1) await panel.getByRole('button', { name: /^Remove Gen/ }).last().click();
    for (let k = 0; k < 2; k++) await panel.getByRole('button', { name: /^One more Gen/ }).click();
    await expect(panel.getByRole('listitem').getByRole('status')).toHaveText(/^3 copies of Gen \d+$/);
    await expect(panel.getByText('of 3 driving')).toBeVisible({ timeout: 60_000 });

    // Training starts from the toolbar and closes the Sandbox first.
    await page.getByRole('button', { name: 'Train', exact: true }).click();
    await expect(panel).toBeHidden();
  });
});
