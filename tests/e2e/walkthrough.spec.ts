import { expect, test, type Page } from '@playwright/test';

/** The value a lab's tour leaves in localStorage once it was finished or skipped. */
function marker(page: Page, key: string) {
  return page.evaluate((k) => window.localStorage.getItem(k), key);
}

test.describe('Walkthrough', () => {
  test.setTimeout(240_000);

  test('walks a first visit through the Racing lab and stays closed once done', async ({ page }) => {
    await page.goto('/lab/racing?quality=low');
    const card = page.getByTestId('walkthrough');
    const title = (name: string) => card.getByRole('heading', { name });

    // A fresh profile gets the welcome card, with focus inside it so the keys drive the tour.
    await expect(title('Welcome to the Racing lab')).toBeVisible({ timeout: 90_000 });
    await expect(card).toBeFocused();
    await card.getByRole('button', { name: 'Start the tour' }).click();
    await expect(title('Every car has a brain')).toBeVisible();
    await expect(card).toContainText('1 / 10');

    // Back returns to the welcome card, and the right arrow moves on again.
    await card.getByRole('button', { name: 'Back' }).click();
    await expect(title('Welcome to the Racing lab')).toBeVisible();
    await page.keyboard.press('ArrowRight');
    await expect(title('Every car has a brain')).toBeVisible();

    // The step waits for the real Train button, which the spotlight leaves clickable, then explains what it started.
    await expect(card).toContainText('Press Train');
    await page.getByRole('button', { name: 'Train' }).click();
    await expect(title('Fitness is the score')).toBeVisible();
    await expect(card).toContainText('Training');
    await expect(card).toBeFocused();

    // Enter goes on, the left arrow comes back to the step as it is now.
    await page.keyboard.press('Enter');
    await expect(title('The best become parents')).toBeVisible();
    await expect(card).toContainText('2 / 10');
    await page.keyboard.press('ArrowLeft');
    await expect(title('Fitness is the score')).toBeVisible();
    // Space still reaches the lab, so training pauses and the software renderer gets the CPU back.
    await page.keyboard.press(' ');
    await expect(page.getByRole('button', { name: 'Train' })).toBeVisible();

    // Escape skips the tour and remembers it.
    await page.keyboard.press('Escape');
    await expect(card).toBeHidden();
    await expect.poll(() => marker(page, 'sandboxlab.tour.racing')).toBe('1');

    // The help menu replays it from the start.
    await page.getByRole('button', { name: 'Help and shortcuts' }).click();
    await page.getByRole('button', { name: 'Replay the tour' }).click();
    await expect(title('Welcome to the Racing lab')).toBeVisible();
    await expect(card).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(title('Every car has a brain')).toBeVisible();
    await card.getByRole('button', { name: 'Skip tour' }).click();
    await expect(card).toBeHidden();

    // Once done it does not open by itself again.
    await page.reload();
    await expect(page.getByRole('button', { name: 'Train' })).toBeEnabled({ timeout: 90_000 });
    await page.waitForTimeout(3000);
    await expect(card).toHaveCount(0);
  });

  test('Hide and Seek opens its own tour once and replays it from its help menu', async ({ page }) => {
    await page.goto('/lab/hide-seek?quality=low');
    const card = page.getByTestId('walkthrough');
    await expect(card.getByRole('heading', { name: 'Welcome to Hide and Seek' })).toBeVisible({ timeout: 90_000 });
    await card.getByRole('button', { name: 'Skip tour' }).click();
    await expect(card).toBeHidden();
    await expect.poll(() => marker(page, 'sandboxlab.tour.hideseek')).toBe('1');
    // Skipping one lab's tour leaves the other lab's for its own first visit.
    expect(await marker(page, 'sandboxlab.tour.racing')).toBeNull();

    await page.getByRole('button', { name: 'Help and shortcuts' }).click();
    await page.getByRole('button', { name: 'Replay the tour' }).click();
    await expect(card.getByRole('heading', { name: 'Welcome to Hide and Seek' })).toBeVisible();
    await expect(card).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(card).toBeHidden();
    // Focus goes back to where it was before the tour took it.
    await expect(page.getByRole('button', { name: 'Help and shortcuts' })).toBeFocused();
  });
});
