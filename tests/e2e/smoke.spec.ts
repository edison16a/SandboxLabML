import { expect, test } from '@playwright/test';

// Both lab tours are marked done, so neither sits on top of the controls these checks press.
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    for (const k of ['driving', 'navigation']) window.localStorage.setItem(`sandboxlab.tour.${k}`, '1');
  });
});

test('landing page links to every section', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1, name: 'SandboxLabML' })).toBeVisible();
  await expect(page.getByText('Train your own model with machine learning, right in your browser.')).toBeVisible();
  const nav = page.getByRole('navigation', { name: 'Sections' });
  await expect(nav.getByRole('link')).toHaveText(['Driving', 'Navigation', 'Studio', 'Runs']);
  await expect(page.getByRole('link', { name: 'View on GitHub' }).first()).toHaveAttribute('href', /github\.com/);
});

test('Go Train opens the Driving lab', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'Go Train' }).click();
  await expect(page).toHaveURL(/\/lab\/driving$/);
  await expect(page.getByRole('button', { name: 'Train' })).toBeVisible({ timeout: 60_000 });
});

test('runs page renders an empty state with only the two labs', async ({ page }) => {
  await page.goto('/runs');
  await expect(page.getByRole('heading', { name: 'Runs' })).toBeVisible();
  await expect(page.getByText('No runs yet')).toBeVisible();
  await expect(page.getByRole('radiogroup', { name: 'Filter runs' }).getByRole('radio')).toHaveText(['All', 'Driving', 'Navigation']);
});

test('an unknown address shows the 404 page with the way back', async ({ page }) => {
  const response = await page.goto('/lab/somewhere');
  expect(response?.status()).toBe(404);
  await expect(page.getByRole('heading', { name: 'This page does not exist' })).toBeVisible();
  const places = page.getByRole('navigation', { name: 'Places to go' });
  await expect(places.getByRole('link')).toHaveText(['Driving', 'Navigation', 'Studio', 'Home']);
});

test('the old lab addresses land on their successors and keep the run link', async ({ page }) => {
  await page.goto('/lab/hide-seek');
  await expect(page).toHaveURL(/\/lab\/navigation$/);
  await expect(page.getByRole('button', { name: 'Train' })).toBeVisible({ timeout: 60_000 });

  // A run that is not on this device opens the usual run, and the lab says why.
  await page.goto('/lab/racing?run=gone');
  await expect(page).toHaveURL(/\/lab\/driving\?run=gone$/);
  await expect(page.getByText('That run is not on this device any more.')).toBeVisible({ timeout: 60_000 });
  await expect(page.getByRole('button', { name: 'Train' })).toBeEnabled({ timeout: 60_000 });
});
