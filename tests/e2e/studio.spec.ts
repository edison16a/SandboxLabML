import { expect, test, type Page } from '@playwright/test';

/** The code view's text. CodeMirror draws one element per line, so lines are joined with newlines here. */
async function code(page: Page): Promise<string> {
  return page.locator('.cm-content .cm-line').allInnerTexts().then((lines) => lines.join('\n'));
}

test.describe('Studio', () => {
  test('one script, two views: code edits show as blocks and block edits show as code', async ({ page }) => {
    await page.goto('/studio');
    await expect(page.locator('.cm-editor')).toBeVisible();

    // Presets are read only, so start an editable script.
    await page.getByRole('button', { name: 'New', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'New script' })).toBeVisible();
    await expect.poll(() => code(page)).toContain('stop "crash" when car.offTrack');

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
    await expect.poll(() => code(page)).toContain('reward +1 when checkpoint.passed');

    // Put the cursor on the reward line, so the example lands right below it.
    await page.locator('.cm-line', { hasText: 'reward +1 when checkpoint.passed' }).click();
    await page.getByRole('tab', { name: /Reference/ }).click();
    await page.getByRole('textbox', { name: 'Search the reference' }).fill('lap.count');
    await page.locator('summary', { hasText: 'lap.count' }).click();
    await page.getByRole('button', { name: 'Insert example for lap.count' }).click();
    await expect.poll(() => code(page)).toContain('reward +1 when checkpoint.passed\n  stop "finished" when lap.count >= 3');
    await expect(page.getByRole('tab', { name: /Problems/ })).toBeVisible();
  });
});
