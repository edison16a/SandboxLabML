import { expect, test } from '@playwright/test';

test('landing page links to every section', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /Watch neural networks/ })).toBeVisible();
  for (const name of ['Racing', 'Hide and Seek', 'Studio', 'Runs']) {
    await expect(page.getByRole('navigation', { name: 'Sections' }).getByRole('link', { name })).toBeVisible();
  }
  await expect(page.getByRole('link', { name: 'View on GitHub' }).first()).toHaveAttribute('href', /github\.com/);
});

test('runs page renders an empty state', async ({ page }) => {
  await page.goto('/runs');
  await expect(page.getByRole('heading', { name: 'Runs' })).toBeVisible();
  await expect(page.getByText('No runs yet')).toBeVisible();
});
