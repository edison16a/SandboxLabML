import { expect, test, type Page } from '@playwright/test';

/** Reads the renderer counters the app publishes on window.__sbl. */
async function stats(page: Page) {
  return page.evaluate(() => window.__sbl?.stats ?? null);
}

async function skipTours(page: Page) {
  await page.addInitScript(() => {
    for (const k of ['racing', 'hideseek', 'driving', 'navigation']) window.localStorage.setItem(`sandboxlab.tour.${k}`, '1');
  });
}

/** Course meters to page pixels on the editor board, which spans the room plus 0.7 m on each side. */
async function boardPoint(page: Page, length: number, x: number, z: number): Promise<[number, number]> {
  const box = (await page.getByTestId('course-board').boundingBox())!;
  return [box.x + ((x + length / 2 + 0.7) / (length + 1.4)) * box.width, box.y + ((z + 7 + 0.7) / 15.4) * box.height];
}

async function drag(page: Page, length: number, a: [number, number], b: [number, number]) {
  const [ax, ay] = await boardPoint(page, length, ...a);
  const [bx, by] = await boardPoint(page, length, ...b);
  await page.mouse.move(ax, ay);
  await page.mouse.down();
  await page.mouse.move(bx, by, { steps: 6 });
  await page.mouse.up();
}

test.describe('Navigation Sandbox', () => {
  test.setTimeout(300_000);

  test('plays a trained model before any training, and switches to the run champions once there are some', async ({ page }) => {
    await skipTours(page);
    await page.goto('/lab/navigation?quality=low');
    await expect(page.getByRole('button', { name: 'Train' })).toBeEnabled({ timeout: 90_000 });

    // Nothing is trained yet, so the Sandbox opens on a model that came trained with the app.
    await page.getByRole('button', { name: 'Sandbox' }).click();
    const panel = page.getByTestId('nav-sandbox');
    await expect(panel).toBeVisible();
    await panel.getByRole('tab', { name: /Runners/ }).click();
    await expect(panel.getByRole('radio', { name: 'Trained model' })).toHaveAttribute('aria-checked', 'true');
    await expect(panel.getByRole('radio', { name: /Advanced/ })).toHaveAttribute('aria-checked', 'true');
    await expect(panel).toContainText(/\d+ running/);
    await expect.poll(async () => (await stats(page))?.instances.agents ?? 0, { timeout: 90_000 }).toBe(8);

    // More copies of another model, then pause and restart.
    await panel.getByRole('radio', { name: /Beginner/ }).click();
    await panel.getByRole('button', { name: 'One more Beginner model' }).click();
    await expect.poll(async () => (await stats(page))?.instances.agents ?? 0, { timeout: 90_000 }).toBe(9);
    await page.keyboard.press(' ');
    await expect(panel.getByRole('button', { name: 'Play' })).toBeVisible();
    await page.keyboard.press('r');
    await expect(panel.getByRole('button', { name: 'Pause' })).toBeVisible();

    // Another level, then back to training, which trains a few generations on Max.
    await panel.getByRole('tab', { name: 'Course' }).click();
    await panel.getByRole('radio', { name: /Level 3/ }).click();
    await expect(page.locator('[data-tour="hud-level"]')).toContainText('Spikes', { timeout: 60_000 });
    await panel.getByRole('button', { name: 'Back to training' }).click();
    await expect(panel).toBeHidden();
    await page.keyboard.press('5');
    await page.getByRole('button', { name: 'Train' }).click();
    await expect.poll(async () => page.locator('tbody tr').count(), { timeout: 180_000 }).toBeGreaterThanOrEqual(2);
    await page.keyboard.press(' ');

    // With champions stored, the field can take them, newest first.
    await page.getByRole('button', { name: 'Sandbox' }).click();
    await panel.getByRole('tab', { name: /Runners/ }).click();
    await panel.getByRole('radio', { name: 'This run' }).click();
    await expect(panel.getByText(/Champion of gen \d+/).first()).toBeVisible();
    await panel.getByRole('button', { name: 'Add', exact: true }).click();
    await expect.poll(async () => (await stats(page))?.instances.agents ?? 0, { timeout: 90_000 }).toBeGreaterThanOrEqual(9);
  });

  test('draws a course in the editor, refuses one with no way through, and saves and plays it', async ({ page }) => {
    await skipTours(page);
    await page.goto('/lab/navigation?quality=low');
    await expect(page.getByRole('button', { name: 'Train' })).toBeEnabled({ timeout: 90_000 });
    await page.getByRole('button', { name: 'Sandbox' }).click();
    const panel = page.getByTestId('nav-sandbox');
    await panel.getByRole('button', { name: 'New course' }).click();
    const dialog = page.getByRole('dialog', { name: 'Course editor' });
    await expect(dialog).toBeVisible();
    await dialog.getByRole('radio', { name: '30 m' }).click();

    // Keys in the editor stay in the editor: C picks the crate tool, not the next camera, and Space presses the focused tool.
    await page.getByTestId('course-board').focus();
    await page.keyboard.press('c');
    await expect(dialog.getByRole('radio', { name: /Crate/ })).toHaveAttribute('aria-checked', 'true');
    await dialog.getByRole('radio', { name: /Wall/ }).focus();
    await page.keyboard.press(' ');
    await expect(dialog.getByRole('radio', { name: /Wall/ })).toHaveAttribute('aria-checked', 'true');
    await page.keyboard.press('n');
    await expect(page.getByRole('dialog')).toHaveCount(1);

    // A wall right across the room leaves no way through, so Save is refused until a gap opens.
    await page.keyboard.press('w');
    await drag(page, 30, [0, -7], [0, 7]);
    await expect(dialog.getByRole('status')).toContainText('no way from the start to the finish');
    await expect(dialog.getByRole('button', { name: 'Save and play' })).toBeDisabled();
    await page.keyboard.press('ControlOrMeta+z');
    await drag(page, 30, [0, -7], [0, 3]);
    await expect(dialog.getByRole('button', { name: 'Save and play' })).toBeEnabled();

    // Spikes, a mover and a crate from the keyboard, then a name.
    await page.keyboard.press('s');
    await drag(page, 30, [4, 1], [5, 7]);
    await page.keyboard.press('m');
    await drag(page, 30, [8, -5], [8, 5]);
    await expect(dialog).toContainText('1 / 12 movers');
    await page.getByTestId('course-board').focus();
    await page.keyboard.press('c');
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('Enter');
    await expect(dialog).toContainText('4 / 48 pieces');
    await expect(dialog).toContainText('level 6');
    await dialog.getByRole('textbox', { name: 'Name' }).fill('Test hall');
    await dialog.getByRole('button', { name: 'Save and play' }).click();
    await expect(dialog).toBeHidden();
    // None of the editor's keys reached the lab behind it.
    await expect(page.getByRole('combobox', { name: 'Camera' })).toContainText('Follow');
    await expect(panel.getByRole('button', { name: 'Pause' })).toBeVisible();

    // It is stored, in play, and still there after a reload.
    await expect(panel.getByRole('button', { name: 'Test hall', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await expect.poll(async () => (await stats(page))?.instances.movers ?? 0, { timeout: 90_000 }).toBe(1);
    await page.reload();
    await expect(page.getByRole('button', { name: 'Train' })).toBeEnabled({ timeout: 90_000 });
    await page.getByRole('button', { name: 'Sandbox' }).click();
    await expect(page.getByTestId('nav-sandbox').getByRole('button', { name: 'Test hall', exact: true })).toBeVisible();
  });
});
