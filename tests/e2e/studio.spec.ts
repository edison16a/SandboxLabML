import { expect, test, type Page } from '@playwright/test';

/** The code view's text. CodeMirror draws one element per line, so lines are joined with newlines here. */
async function code(page: Page): Promise<string> {
  return page.locator('.cm-content .cm-line').allInnerTexts().then((lines) => lines.join('\n'));
}

test.describe('Studio', () => {
  test('a first visit opens the Driving Beginner preset beside the Driving lessons, and offers only the two labs', async ({ page }) => {
    await page.goto('/studio');
    await expect(page.getByRole('heading', { name: 'Beginner' })).toBeVisible({ timeout: 60_000 });
    await expect.poll(() => code(page)).toContain('for driving v1');
    await expect(page.getByRole('tab', { name: 'Learn' })).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByRole('radiogroup', { name: 'Course' }).getByRole('radio', { name: 'Driving' })).toHaveAttribute('aria-checked', 'true');
    await expect(page.getByRole('list', { name: 'Lessons' }).getByRole('button').first()).toBeVisible();
    await expect(page.getByRole('radiogroup', { name: 'Course' }).getByRole('radio')).toHaveText(['Driving', 'Navigation']);
    await expect(page.getByRole('radiogroup', { name: 'Environment filter' }).getByRole('radio')).toHaveText(['All', 'Driving', 'Navigation']);

    // A second visit opens the last script with the Reference tab.
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Beginner' })).toBeVisible({ timeout: 60_000 });
    await expect(page.getByRole('tab', { name: /Reference/ })).toHaveAttribute('aria-selected', 'true');
  });

  test('a link to a script of a removed lab says so and opens the starter', async ({ page }) => {
    await page.goto('/studio?script=racing-beginner');
    await expect(page.getByText(/lab this version does not have|not on this device/)).toBeVisible({ timeout: 60_000 });
    await expect.poll(() => code(page)).toContain('for driving v1');
  });

  test('a header for a removed lab is an error that blocks the test run', async ({ page }) => {
    await page.goto('/studio');
    await page.getByRole('button', { name: 'New', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'New script' })).toBeVisible();
    await page.locator('.cm-content').click();
    await page.keyboard.press('ControlOrMeta+A');
    await page.keyboard.insertText('script "Old" for racing v1\n\neach tick {\n}\n');
    await page.getByRole('tab', { name: /Problems/ }).click();
    await expect(page.getByText(/This version has no racing lab|There is no environment called racing/)).toBeVisible();
    await page.getByRole('tab', { name: 'Test run' }).click();
    await expect(page.getByRole('button', { name: 'Run one episode' })).toBeDisabled();
    await expect(page.getByText('Fix the errors to test the script.')).toBeVisible();
  });

  test('one script, two views: code edits show as blocks and block edits show as code', async ({ page }) => {
    await page.goto('/studio');
    await expect(page.locator('.cm-editor')).toBeVisible();

    // Presets are read only, so start an editable script.
    await page.getByRole('button', { name: 'New', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'New script' })).toBeVisible();
    await expect.poll(() => code(page)).toContain('stop "stuck" when car.noProgress > 8 s');

    // Type a generation block at the end of the text.
    await page.locator('.cm-content').click();
    await page.keyboard.press('ControlOrMeta+End');
    await page.keyboard.insertText('\neach generation {\n  speciate(target: 4)\n}\n');
    await page.keyboard.press('Escape');
    await expect.poll(() => code(page)).toContain('speciate(target: 4)');
    await expect(page.getByText('Unsaved changes')).toBeVisible();

    // The same script as blocks: change the species target from 4 to 6.
    await page.getByRole('radio', { name: 'Blocks' }).click();
    const blocks = page.getByTestId('blocks-view');
    await expect(blocks.getByRole('region', { name: 'each generation' })).toBeVisible();
    await blocks.getByRole('button', { name: 'Edit target' }).click();
    const number = page.getByRole('textbox', { name: 'Number' });
    await number.fill('6');
    await number.press('Enter');
    await expect(blocks.getByRole('button', { name: 'Edit target' })).toHaveText('6');

    // Back in the code view the text has the new number, and undo brings the old one back.
    await page.getByRole('radio', { name: 'Code' }).click();
    await expect.poll(() => code(page)).toContain('speciate(target: 6)');
    await page.getByRole('button', { name: 'Undo' }).click();
    await expect.poll(() => code(page)).toContain('speciate(target: 4)');
  });

  test('the Reference tab inserts an example into the open script', async ({ page }) => {
    await page.goto('/studio');
    await page.getByRole('button', { name: 'New', exact: true }).click();
    await expect.poll(() => code(page)).toContain('reward +10 when car.arrived');

    // Put the cursor on the arrival line, so the example lands right below it.
    await page.locator('.cm-line', { hasText: 'reward +10 when car.arrived' }).click();
    await page.getByRole('tab', { name: /Reference/ }).click();
    await page.getByRole('textbox', { name: 'Search the reference' }).fill('lidar.min');
    await page.locator('summary', { hasText: 'lidar.min' }).click();
    await page.getByRole('button', { name: 'Insert example for lidar.min' }).click();
    await expect.poll(() => code(page)).toContain('reward +10 when car.arrived\n  reward -0.01 when lidar.min < 1.5 m');
    await expect(page.getByRole('tab', { name: /Problems/ })).toBeVisible();
  });
});
