import { expect, test, type Page } from '@playwright/test';

/** Renderer counters the app publishes on window.__sbl. */
function instance(page: Page, key: string) {
  return async () => page.evaluate((k) => window.__sbl?.stats.instances[k] ?? -1, key);
}

/** The Sandbox card's status line, a countdown like the HUD chip: "Prep 9.0 s left", then "Seek 20.8 s left". */
function status(page: Page) {
  return page.getByTestId('sandbox-status');
}

/**
 * Screen point of a room point (x, z) at height y in the top down camera.
 * The camera sits straight above the room center, framed like arenaShot:
 * the 20.8 m room plus a meter each side, walls included, in a 42 degree
 * field of view that leaves the HUD bands clear.
 */
async function topDown(page: Page, x: number, z: number, y: number) {
  const box = await page.getByTestId('hs-viewport').boundingBox();
  if (!box) throw new Error('viewport not found');
  const tanV = Math.tan((42 * Math.PI) / 360);
  const half = 11.4;
  const distance = Math.max(half / (tanV * (box.width / box.height) * 0.94), half / (tanV * 0.84)) + 2.5;
  const depth = distance - y;
  return {
    x: box.x + ((x / (depth * tanV * (box.width / box.height)) + 1) / 2) * box.width,
    y: box.y + ((1 + z / (depth * tanV)) / 2) * box.height,
  };
}

/**
 * The Hide and Seek Sandbox end to end: train a tiny run on Max, open the
 * Sandbox, build a room with the keyboard, spawn more players, run, pause
 * and restart, lock a crate, and find the room again after a reload.
 */
test('the Sandbox plays a room built in the editor with many players, and keeps the room', async ({ page }) => {
  test.setTimeout(420_000);
  await page.addInitScript(() => window.localStorage.setItem('sandboxlab.tour.hideseek', '1'));
  await page.goto('/lab/hide-seek?quality=low');
  // Wait for the first visit's default run to open, or it could replace the run created below.
  await expect.poll(instance(page, 'arenas'), { timeout: 120_000 }).toBe(50);
  await page.getByRole('button', { name: 'New run' }).click();
  await page.getByRole('radio', { name: '20' }).click();
  await page.getByRole('group', { name: 'Rounds per generation' }).getByRole('radio', { name: '1' }).click();
  await page.getByRole('button', { name: 'Create and train' }).click();
  await page.keyboard.press('5');
  await expect(page.getByRole('button', { name: 'Sandbox' })).toBeEnabled({ timeout: 180_000 });
  await page.keyboard.press(' ');
  await expect(page.getByRole('button', { name: 'Train', exact: true })).toBeVisible({ timeout: 60_000 });

  await page.getByRole('button', { name: 'Sandbox' }).click();
  await expect(page.getByTestId('sandbox-card')).toBeVisible({ timeout: 60_000 });
  for (const room of ['Open', 'Corridors', 'Shelter']) {
    await page.getByRole('radio', { name: room, exact: true }).click();
    await expect(page.getByRole('radio', { name: room, exact: true })).toHaveAttribute('aria-checked', 'true');
  }
  await expect.poll(instance(page, 'sandboxAgents'), { timeout: 60_000 }).toBe(4);

  // A wall from (-2, 0) to (-2, -4) and a cube at (4, -4), placed with the keyboard cursor.
  await page.getByRole('button', { name: 'New room' }).click();
  const board = page.getByRole('application', { name: /Room editor board/ });
  await board.focus();
  for (let i = 0; i < 4; i++) await page.keyboard.press('ArrowLeft');
  await page.keyboard.press('Enter');
  for (let i = 0; i < 8; i++) await page.keyboard.press('ArrowUp');
  await page.keyboard.press('Enter');
  // Escape drops a wall in progress, then warns about the unsaved wall, and the editor stays open both times.
  await page.keyboard.press('Enter');
  await page.keyboard.press('Escape');
  await expect(board).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog').getByText('Press Escape again')).toBeVisible();
  await expect(board).toBeVisible();
  await page.keyboard.press('c');
  for (let i = 0; i < 12; i++) await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Enter');
  await page.getByRole('textbox', { name: 'Name' }).fill('Test fort');
  await page.getByRole('button', { name: 'Save and play' }).click();
  await expect(page.getByRole('radio', { name: 'Test fort' })).toHaveAttribute('aria-checked', 'true');

  for (const team of ['hiders', 'seekers']) {
    const spin = page.getByRole('spinbutton', { name: team === 'hiders' ? 'Hiders' : 'Seekers' });
    while (Number(await spin.getAttribute('aria-valuenow')) < (team === 'hiders' ? 4 : 3)) await page.getByRole('button', { name: `More ${team}` }).click();
  }
  await expect.poll(instance(page, 'sandboxAgents'), { timeout: 60_000 }).toBe(7);
  await expect.poll(instance(page, 'sandboxBoxes'), { timeout: 30_000 }).toBe(1);

  await page.getByRole('button', { name: 'Run', exact: true }).click();
  // The 9 s prep counts down from the start, so any other reading means the match is running.
  await expect(status(page)).toContainText(/Seek|Prep [0-8]\./, { timeout: 90_000 });
  await page.getByTestId('sandbox-card').getByRole('button', { name: 'Pause', exact: true }).click();
  // Let the last frames in flight land, then the clock must stand still.
  await page.waitForTimeout(1000);
  const paused = await status(page).innerText();
  await page.waitForTimeout(1500);
  await expect(status(page)).toHaveText(paused);
  await page.getByRole('button', { name: 'Restart', exact: true }).click();
  await expect(status(page)).toContainText('Prep 9.0 s left', { timeout: 30_000 });

  // Lock the cube from above with a double click.
  await page.getByRole('combobox', { name: 'Camera' }).click();
  await page.getByRole('option', { name: 'Top down' }).click();
  await page.waitForTimeout(2500);
  const cube = await topDown(page, 4, -4, 1);
  await page.mouse.dblclick(cube.x, cube.y);
  await expect.poll(instance(page, 'sandboxLocked'), { timeout: 30_000 }).toBe(1);

  await page.reload();
  await expect(page.getByRole('button', { name: 'Sandbox' })).toBeEnabled({ timeout: 120_000 });
  await page.getByRole('button', { name: 'Sandbox' }).click();
  await expect(page.getByRole('radio', { name: 'Test fort' })).toHaveAttribute('aria-checked', 'true', { timeout: 60_000 });
  await expect(page.getByRole('spinbutton', { name: 'Hiders' })).toHaveAttribute('aria-valuenow', '4');
});
