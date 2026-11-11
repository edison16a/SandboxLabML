import { expect, test, type Page } from '@playwright/test';

/** The value a lab's tour leaves in localStorage once it was finished or skipped. */
function marker(page: Page, key: string) {
  return page.evaluate((k) => window.localStorage.getItem(k), key);
}

test.describe('Navigation walkthrough', () => {
  test.setTimeout(300_000);

  test('walks a first visit through the lab, waits for the real controls and stays closed once done', async ({ page }) => {
    await page.goto('/lab/navigation?quality=low');
    const card = page.getByTestId('walkthrough');
    const title = (name: string) => card.getByRole('heading', { name });

    await expect(title('Welcome to the Navigation lab')).toBeVisible({ timeout: 90_000 });
    await expect(card).toBeFocused();
    await card.getByRole('button', { name: 'Start the tour' }).click();
    await expect(title('Every runner has a brain')).toBeVisible();
    await expect(card).toContainText('1 / 10');

    // The step waits for the real Train button, then explains what it set going.
    await expect(card).toContainText('Press Train');
    await page.getByRole('button', { name: 'Train' }).click();
    await expect(title('Fitness is the score')).toBeVisible();
    await page.keyboard.press('Enter');
    await expect(title('The best become parents')).toBeVisible();
    await page.keyboard.press('ArrowRight');
    await expect(title('Harder courses as they learn')).toBeVisible();
    await page.keyboard.press('ArrowRight');
    await expect(title('Watch it climb')).toBeVisible();
    await page.keyboard.press('ArrowRight');
    await expect(title('Train faster')).toBeVisible();

    // Turbo trains out of sight; the next step brings the lab back to 1x and asks for the Inputs overlay.
    await page.locator('[data-tour="speed"]').getByText('Turbo').click();
    await expect(title('Learning in the background')).toBeVisible();
    await page.keyboard.press('ArrowRight');
    await expect(title('A network only sees numbers')).toBeVisible();
    await expect(page.locator('[data-tour="speed"] [data-state="on"]')).toHaveText('1x');
    await page.keyboard.press('i');
    await expect(title('What the runner senses')).toBeVisible();
    await expect(page.getByText('Followed runner')).toBeVisible();

    // Space still reaches the lab, so training pauses and the software renderer gets the CPU back.
    await page.keyboard.press(' ');
    await expect(page.getByRole('button', { name: 'Train' })).toBeVisible();

    // Escape skips the tour and remembers it.
    await page.keyboard.press('Escape');
    await expect(card).toBeHidden();
    await expect.poll(() => marker(page, 'sandboxlab.tour.navigation')).toBe('1');

    // The help menu replays it from the start.
    await page.getByRole('button', { name: 'Help and shortcuts' }).click();
    await page.getByRole('button', { name: 'Replay the tour' }).click();
    await expect(title('Welcome to the Navigation lab')).toBeVisible();
    await card.getByRole('button', { name: 'Skip tour' }).click();
    await expect(card).toBeHidden();

    // Once done it does not open by itself again.
    await page.reload();
    await expect(page.getByRole('button', { name: 'Train' })).toBeEnabled({ timeout: 90_000 });
    await page.waitForTimeout(3000);
    await expect(card).toHaveCount(0);
  });
});
