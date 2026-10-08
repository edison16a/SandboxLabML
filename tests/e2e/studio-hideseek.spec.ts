import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';

/** The first Hide and Seek lesson, read from disk so the test follows the content if it changes. */
const lesson = JSON.parse(readFileSync('content/lessons/hideseek/01-points-for-hiding.json', 'utf8')) as {
  steps: Array<{ solution: string; check: { message: string } }>;
};

test.describe('Studio with Hide and Seek scripts', () => {
  test.setTimeout(180_000);

  test('a test match plays the open script for both teams', async ({ page }) => {
    await page.goto('/studio');
    await page.getByRole('button', { name: /^Advanced\s*Hide and Seek$/ }).click();
    await page.getByRole('tab', { name: 'Test run' }).click();
    await page.getByRole('button', { name: 'Play one match' }).click();
    // The first match loads the physics engine in the worker, which takes a moment.
    await expect(page.getByText('Hider total')).toBeVisible({ timeout: 90_000 });
    await expect(page.getByText('Seeker total')).toBeVisible();
  });

  test('a lesson plays beside a preview and its check tells a starter from a solution', async ({ page }) => {
    await page.goto('/studio');
    await page.getByRole('tab', { name: 'Learn' }).click();
    await page.getByRole('radio', { name: 'Hide and Seek' }).click();
    await page.getByRole('list', { name: 'Lessons' }).getByRole('button').first().click();
    await expect(page.getByRole('img', { name: /Top view of the test match/ })).toBeVisible();

    await page.getByRole('button', { name: 'Load starter' }).click();
    await page.getByRole('button', { name: 'Check', exact: true }).click();
    const status = page.getByRole('status').filter({ hasText: lesson.steps[0].check.message });
    await expect(status).toBeVisible({ timeout: 90_000 });
    await expect(page.getByRole('button', { name: 'Next step' })).toHaveCount(0);

    // Replace the script with the step's solution, and the same check passes.
    await page.locator('.cm-content').click();
    await page.keyboard.press('ControlOrMeta+A');
    await page.keyboard.insertText(lesson.steps[0].solution);
    await page.getByRole('button', { name: 'Check', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Next step' })).toBeVisible({ timeout: 90_000 });
  });
});
