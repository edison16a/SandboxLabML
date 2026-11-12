import { expect, test, type Page } from '@playwright/test';

/** Draw calls of the last frames, from the counters the viewport publishes on window.__sbl. */
async function drawCalls(page: Page): Promise<number> {
  return page.evaluate(() => window.__sbl?.stats.drawCalls ?? 0);
}

/**
 * Software WebGL counts as a weak GPU, so Settings shows Medium as the
 * default with a hint. Clicking that Medium counts as a pick, a lower pick
 * draws the lab with less, and the pick survives a reload.
 */
test('the quality Settings shows is a real choice that the lab follows and keeps', async ({ page }) => {
  test.setTimeout(240_000);
  await page.addInitScript(() => window.localStorage.setItem('sandboxlab.tour.navigation', '1'));
  await page.goto('/lab/navigation');
  await expect(page.getByRole('button', { name: 'Train' })).toBeEnabled({ timeout: 120_000 });
  await expect.poll(() => drawCalls(page), { timeout: 120_000 }).toBeGreaterThan(0);

  await page.getByRole('button', { name: 'Settings' }).click();
  const quality = page.getByRole('radiogroup', { name: 'Quality' });
  const medium = quality.getByRole('radio', { name: 'Medium' });
  await expect(medium).toHaveAttribute('aria-checked', 'true');
  await expect(page.getByText('Medium suits this GPU.')).toBeVisible();
  await medium.click();
  await expect(page.getByText('Medium suits this GPU.')).toHaveCount(0);
  const atMedium = await drawCalls(page);

  // Low drops the shadow map, so the same course takes fewer draw calls.
  await quality.getByRole('radio', { name: 'Low' }).click();
  await page.keyboard.press('Escape');
  await expect.poll(() => drawCalls(page), { timeout: 60_000 }).toBeLessThan(atMedium);

  await page.reload();
  await expect(page.getByRole('button', { name: 'Train' })).toBeEnabled({ timeout: 120_000 });
  await page.getByRole('button', { name: 'Settings' }).click();
  await expect(page.getByRole('radiogroup', { name: 'Quality' }).getByRole('radio', { name: 'Low' })).toHaveAttribute('aria-checked', 'true');
  await expect(page.getByText('Medium suits this GPU.')).toHaveCount(0);
});
