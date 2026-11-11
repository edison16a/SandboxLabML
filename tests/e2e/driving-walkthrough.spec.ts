import { expect, test } from '@playwright/test';

test.describe('Driving walkthrough', () => {
  test.setTimeout(240_000);

  test('walks a first visit through the Driving lab and stays closed once done', async ({ page }) => {
    await page.goto('/lab/driving?quality=low');
    const card = page.getByTestId('walkthrough');
    const title = (name: string) => card.getByRole('heading', { name });

    // A fresh profile gets the welcome card, with focus inside it so the keys drive the tour.
    await expect(title('Welcome to the Self-driving lab')).toBeVisible({ timeout: 90_000 });
    await expect(card).toBeFocused();
    await card.getByRole('button', { name: 'Start the tour' }).click();
    await expect(title('Every SUV has a brain')).toBeVisible();
    await expect(card).toContainText('1 / 11');

    // The step waits for the real Train button, then explains what it started.
    await expect(card).toContainText('Press Train');
    await page.getByRole('button', { name: 'Train' }).click();
    await expect(title('Fitness is the score')).toBeVisible();
    await expect(card).toContainText('Training');

    // On to the curriculum: the level chip in the viewport is what it frames.
    await page.keyboard.press('Enter');
    await expect(title('The best become parents')).toBeVisible();
    await page.keyboard.press('Enter');
    await expect(title('One level at a time')).toBeVisible();
    await expect(card).toContainText('3 / 11');
    // Space still reaches the lab, so training pauses and the software renderer gets the CPU back.
    await page.keyboard.press(' ');
    await expect(page.getByRole('button', { name: 'Train' })).toBeVisible();

    // Escape skips the tour and remembers it.
    await page.keyboard.press('Escape');
    await expect(card).toBeHidden();
    await expect.poll(() => page.evaluate(() => window.localStorage.getItem('sandboxlab.tour.driving'))).toBe('1');

    // The help menu replays it from the start.
    await page.getByRole('button', { name: 'Help and shortcuts' }).click();
    await page.getByRole('button', { name: 'Replay the tour' }).click();
    await expect(title('Welcome to the Self-driving lab')).toBeVisible();
    await card.getByRole('button', { name: 'Skip tour' }).click();
    await expect(card).toBeHidden();

    // A reload keeps it closed.
    await page.reload();
    await expect(page.getByRole('button', { name: 'Train' })).toBeEnabled({ timeout: 60_000 });
    await expect(card).toBeHidden();
  });
});
