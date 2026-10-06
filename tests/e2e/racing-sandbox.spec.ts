import { expect, test, type Page } from '@playwright/test';

/** Trains a couple of generations on Max so the Sandbox has champions to race. */
async function trainBriefly(page: Page) {
  await page.addInitScript(() => window.localStorage.setItem('sandboxlab.tour.racing', '1'));
  await page.goto('/lab/racing?quality=low');
  await expect(page.getByRole('button', { name: 'Train' })).toBeEnabled({ timeout: 60_000 });
  await page.keyboard.press('5');
  await page.getByRole('button', { name: 'Train' }).click();
  await expect.poll(async () => page.locator('tbody tr').count(), { timeout: 180_000 }).toBeGreaterThanOrEqual(2);
  await page.keyboard.press(' ');
  await expect(page.getByText('The viewport is paused so Max can use every core')).toBeHidden();
}

async function openSandbox(page: Page) {
  await page.getByRole('button', { name: 'Sandbox', exact: true }).click();
  const panel = page.getByRole('region', { name: 'Sandbox' });
  await expect(panel).toBeVisible({ timeout: 60_000 });
  return panel;
}

test.describe('Racing Sandbox', () => {
  test.setTimeout(300_000);

  test('picks tracks from the gallery, saves a drawn one and races a field of copies', async ({ page }) => {
    await trainBriefly(page);
    let panel = await openSandbox(page);

    // Every built in track is in the gallery, and picking one lights its tile.
    for (const name of ['Oval', 'Sprint', 'Hairpin', 'Esses', 'Grand Prix', 'Random', 'Draw']) await expect(panel.getByRole('button', { name, exact: true })).toBeVisible();
    await panel.getByRole('button', { name: 'Hairpin', exact: true }).click();
    await expect(panel.getByRole('button', { name: 'Hairpin', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await expect(panel.getByRole('button', { name: 'Oval', exact: true })).toHaveAttribute('aria-pressed', 'false');

    // Draw starts the editor on a plain loop; save it under a name.
    await panel.getByRole('button', { name: 'Draw', exact: true }).click();
    await panel.getByRole('button', { name: 'Done' }).click();
    await panel.getByRole('button', { name: 'Save', exact: true }).click();
    await page.getByRole('textbox', { name: 'Track name' }).fill('Test loop');
    await page.getByRole('button', { name: 'Save track' }).click();
    await expect(panel.getByRole('button', { name: 'Test loop', exact: true })).toHaveAttribute('aria-pressed', 'true');

    // The saved track survives a reload.
    await page.reload();
    await expect(page.getByRole('button', { name: 'Train' })).toBeEnabled({ timeout: 60_000 });
    panel = await openSandbox(page);
    await expect(panel.getByRole('button', { name: 'Test loop', exact: true })).toBeVisible();

    // Six copies of the newest champion line up and race.
    await panel.getByRole('tab', { name: /Cars/ }).click();
    while ((await panel.getByRole('listitem').count()) > 1) await panel.getByRole('button', { name: /^Remove Gen/ }).last().click();
    for (let k = 0; k < 5; k++) await panel.getByRole('button', { name: /^One more Gen/ }).click();
    await expect(panel.getByText('6 of 16 cars')).toBeVisible();
    await expect(panel.getByText(/of 6 driving/)).toBeVisible({ timeout: 60_000 });

    // Pause, then restart puts everyone back on the grid and running.
    await panel.getByRole('button', { name: 'Pause' }).click();
    await expect(panel.getByRole('button', { name: 'Play' })).toBeVisible();
    await panel.getByRole('button', { name: 'Restart the race' }).click();
    await expect(panel.getByRole('button', { name: 'Pause' })).toBeVisible();

    // Deleting the saved track takes it out of the gallery.
    await panel.getByRole('tab', { name: 'Track' }).click();
    await panel.getByRole('button', { name: 'Delete Test loop' }).click({ force: true });
    await expect(panel.getByRole('button', { name: 'Test loop', exact: true })).toBeHidden();
  });
});
