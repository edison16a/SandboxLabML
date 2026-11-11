import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';

/** The second Driving lesson, read from disk so the test follows the content if it changes. */
const lesson = JSON.parse(readFileSync('content/lessons/driving/02-arrive.json', 'utf8')) as {
  title: string;
  steps: Array<{ solution: string; check: { message: string } }>;
};

test.describe('Studio with Driving scripts', () => {
  test.setTimeout(180_000);

  test('the presets are there, and a test run replays the trip from above', async ({ page }) => {
    await page.goto('/studio');
    for (const tier of ['Beginner', 'Intermediate', 'Advanced']) await expect(page.getByRole('button', { name: new RegExp(`^${tier}\\s*Driving$`) })).toBeVisible();
    await page.getByRole('button', { name: /^Intermediate\s*Driving$/ }).click();
    await expect(page.locator('.cm-content')).toContainText('Intermediate: built-in reward');

    await page.getByRole('tab', { name: 'Test run' }).click();
    await page.getByRole('button', { name: 'Run one episode' }).click();
    await expect(page.getByText('Replay', { exact: true })).toBeVisible({ timeout: 90_000 });
    await expect(page.getByRole('img', { name: /Top view of the test drive/ })).toBeVisible();
    // Beside the stop reason: whether it arrived, and the red lights it ran.
    await expect(page.getByText('arrived', { exact: true })).toBeVisible();
    await expect(page.getByText('Red lights', { exact: true })).toBeVisible();
    await expect(page.getByText('yes', { exact: true })).toBeVisible();
    // The scrubber moves the replay to any tick.
    const scrub = page.getByRole('slider', { name: 'Replay position' });
    await scrub.focus();
    await page.keyboard.press('End');
    await expect(page.getByText(/stopped: arrived/)).toBeVisible();
  });

  test('a Driving lesson plays beside a city preview and its check tells a starter from a solution', async ({ page }) => {
    await page.goto('/studio');
    await page.getByRole('tab', { name: 'Learn' }).click();
    await page.getByRole('radiogroup', { name: 'Course' }).getByRole('radio', { name: 'Driving' }).click();
    const list = page.getByRole('list', { name: 'Lessons' });
    await expect(list.getByRole('button')).toHaveCount(7);
    await list.getByRole('button', { name: new RegExp(lesson.title) }).click();
    await expect(page.getByRole('img', { name: /Top view of the test drive/ })).toBeVisible();

    await page.getByRole('button', { name: 'Load starter' }).click();
    await page.getByRole('button', { name: 'Check', exact: true }).click();
    await expect(page.getByRole('status').filter({ hasText: lesson.steps[0].check.message })).toBeVisible({ timeout: 90_000 });
    await expect(page.getByRole('button', { name: 'Next step' })).toHaveCount(0);

    // The step's solution passes the same check.
    await page.locator('.cm-content').click();
    await page.keyboard.press('ControlOrMeta+A');
    await page.keyboard.insertText(lesson.steps[0].solution);
    await page.getByRole('button', { name: 'Check', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Next step' })).toBeVisible({ timeout: 90_000 });
  });
});
