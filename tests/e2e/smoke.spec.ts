import { expect, test } from '@playwright/test';

test('landing page links to every section', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1, name: 'SandboxLabML' })).toBeVisible();
  await expect(page.getByText('Train your own model with machine learning, right in your browser.')).toBeVisible();
  for (const name of ['Racing', 'Hide and Seek', 'Studio', 'Runs']) {
    await expect(page.getByRole('navigation', { name: 'Sections' }).getByRole('link', { name })).toBeVisible();
  }
  await expect(page.getByRole('link', { name: 'View on GitHub' }).first()).toHaveAttribute('href', /github\.com/);
});

test('Go Train opens the Racing lab', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'Go Train' }).click();
  await expect(page).toHaveURL(/\/lab\/racing$/);
  await expect(page.getByRole('button', { name: 'Train' })).toBeVisible({ timeout: 60_000 });
});

test('runs page renders an empty state', async ({ page }) => {
  await page.goto('/runs');
  await expect(page.getByRole('heading', { name: 'Runs' })).toBeVisible();
  await expect(page.getByText('No runs yet')).toBeVisible();
});
