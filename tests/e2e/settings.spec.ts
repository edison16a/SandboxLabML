import { expect, test } from '@playwright/test';

/**
 * Software WebGL counts as a weak GPU, so the Hide and Seek grid stops at
 * 25 arenas until someone picks a quality. Settings shows Medium as the
 * default there, and clicking that Medium has to count as the pick.
 */
test('picking the quality Settings already shows lifts the arena cap', async ({ page }) => {
  test.setTimeout(180_000);
  await page.addInitScript(() => window.localStorage.setItem('sandboxlab.tour.hideseek', '1'));
  await page.goto('/lab/hide-seek');
  const arenas = page.getByRole('radiogroup', { name: 'Arenas on screen' });
  await expect(arenas.getByRole('radio', { name: '25', exact: true })).toBeVisible({ timeout: 120_000 });
  await expect(arenas.getByRole('radio', { name: '50', exact: true })).toHaveCount(0);

  await page.getByRole('button', { name: 'Settings' }).click();
  const quality = page.getByRole('radiogroup', { name: 'Quality' });
  const medium = quality.getByRole('radio', { name: 'Medium' });
  await expect(medium).toHaveAttribute('aria-checked', 'true');
  await expect(page.getByText('Medium suits this GPU.')).toBeVisible();
  await medium.click();
  await expect(page.getByText('Medium suits this GPU.')).toHaveCount(0);
  await page.keyboard.press('Escape');
  await expect(arenas.getByRole('radio', { name: '50', exact: true })).toBeVisible();
});
