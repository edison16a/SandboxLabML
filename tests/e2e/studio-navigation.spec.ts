import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';

/** The first Navigation lesson, read from disk so the test follows the content if it changes. */
const lesson = JSON.parse(readFileSync('content/lessons/navigation/01-first-run.json', 'utf8')) as {
  steps: Array<{ solution: string; check: { message: string } }>;
};

test.describe('Studio with Navigation scripts', () => {
  test.setTimeout(180_000);

  test('lists the three presets, and a test run replays the episode from above', async ({ page }) => {
    await page.goto('/studio');
    await page.getByRole('radio', { name: 'Navigation' }).click();
    for (const tier of ['Beginner', 'Intermediate', 'Advanced']) await expect(page.getByRole('button', { name: new RegExp(`^${tier}\\s*Navigation$`) })).toBeVisible();
    await page.getByRole('button', { name: /^Advanced\s*Navigation$/ }).click();
    await expect(page.locator('.cm-content')).toContainText('coursesPerGeneration(count: 3)');

    await page.getByRole('tab', { name: 'Test run' }).click();
    await page.getByRole('button', { name: 'Run one episode' }).click();
    await expect(page.getByRole('img', { name: /Top view of the test run/ })).toBeVisible({ timeout: 90_000 });
    await expect(page.getByText('Stopped by')).toBeVisible();
    await expect(page.getByText('finished', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('Progress', { exact: true })).toBeVisible();
  });

  test('a lesson plays beside a preview and its check tells a starter from a solution', async ({ page }) => {
    await page.goto('/studio');
    await page.getByRole('tab', { name: 'Learn' }).click();
    // The sidebar's environment filter has a Navigation choice too, so pick the one in the Learn tab's course switch.
    await page.getByRole('radiogroup', { name: 'Course' }).getByRole('radio', { name: 'Navigation' }).click();
    const lessons = page.getByRole('list', { name: 'Lessons' });
    await expect(lessons.getByRole('button')).toHaveCount(6);
    await lessons.getByRole('button').first().click();
    await expect(page.getByRole('img', { name: /Top view of the test run: the course/ })).toBeVisible();

    await page.getByRole('button', { name: 'Load starter' }).click();
    await page.getByRole('button', { name: 'Check', exact: true }).click();
    await expect(page.getByRole('status').filter({ hasText: lesson.steps[0].check.message })).toBeVisible({ timeout: 90_000 });
    await expect(page.getByRole('button', { name: 'Next step' })).toHaveCount(0);

    await page.locator('.cm-content').click();
    await page.keyboard.press('ControlOrMeta+A');
    await page.keyboard.insertText(lesson.steps[0].solution);
    await page.getByRole('button', { name: 'Check', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Next step' })).toBeVisible({ timeout: 90_000 });
  });
});
