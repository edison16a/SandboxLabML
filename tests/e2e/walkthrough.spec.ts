import { expect, test, type Page } from '@playwright/test';

/** The value a lab's tour leaves in localStorage once it was finished or skipped. */
function marker(page: Page, key: string) {
  return page.evaluate((k) => window.localStorage.getItem(k), key);
}

/**
 * How every lab tour handles the keyboard and focus, checked on both labs.
 * The lab specs of their own walk each tour's content.
 */
test.describe('Walkthrough', () => {
  test.setTimeout(240_000);

  test('moves with the keys and keeps focus on its card in the Driving lab', async ({ page }) => {
    await page.goto('/lab/driving?quality=low');
    const card = page.getByTestId('walkthrough');
    const title = (name: string) => card.getByRole('heading', { name });

    // A fresh profile gets the welcome card, with focus inside it so the keys drive the tour.
    await expect(title('Welcome to the Self-driving lab')).toBeVisible({ timeout: 90_000 });
    await expect(card).toBeFocused();
    await card.getByRole('button', { name: 'Start the tour' }).click();
    await expect(title('Every SUV has a brain')).toBeVisible();

    // Back returns to the welcome card, and the right arrow moves on again.
    await card.getByRole('button', { name: 'Back' }).click();
    await expect(title('Welcome to the Self-driving lab')).toBeVisible();
    await page.keyboard.press('ArrowRight');
    await expect(title('Every SUV has a brain')).toBeVisible();

    // The step waits for the real Train button, which the spotlight leaves clickable, then explains what it started.
    await page.getByRole('button', { name: 'Train' }).click();
    await expect(title('Fitness is the score')).toBeVisible();
    await expect(card).toBeFocused();

    // Enter goes on, the left arrow comes back to the step as it is now.
    await page.keyboard.press('Enter');
    await expect(title('The best become parents')).toBeVisible();
    await expect(card).toContainText('2 / 11');
    await page.keyboard.press('ArrowLeft');
    await expect(title('Fitness is the score')).toBeVisible();

    // The help menu replays it from the start, with focus on the card.
    await page.keyboard.press(' ');
    await expect(page.getByRole('button', { name: 'Train' })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(card).toBeHidden();
    await page.getByRole('button', { name: 'Help and shortcuts' }).click();
    await page.getByRole('button', { name: 'Replay the tour' }).click();
    await expect(title('Welcome to the Self-driving lab')).toBeVisible();
    await expect(card).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(title('Every SUV has a brain')).toBeVisible();
    await card.getByRole('button', { name: 'Skip tour' }).click();
    await expect(card).toBeHidden();
  });

  test('keeps the second chapter live after Turbo and leaves the arrows to the tab list', async ({ page }) => {
    await page.goto('/lab/navigation?quality=low');
    const card = page.getByTestId('walkthrough');
    const title = (name: string) => card.getByRole('heading', { name });
    await expect(title('Welcome to the Navigation lab')).toBeVisible({ timeout: 90_000 });
    await page.keyboard.press('Enter');
    await expect(title('Every runner has a brain')).toBeVisible();
    await page.keyboard.press(' ');
    await expect(title('Fitness is the score')).toBeVisible();
    for (const name of ['The best become parents', 'Harder courses as they learn', 'Watch it climb', 'Train faster']) {
      await page.keyboard.press('ArrowRight');
      await expect(title(name)).toBeVisible();
    }

    // Turbo trains out of sight, so the steps that show a runner go back to 1x.
    await page.locator('[data-tour="speed"]').getByText('Turbo').click();
    await expect(title('Learning in the background')).toBeVisible();
    await page.keyboard.press('ArrowRight');
    await expect(title('A network only sees numbers')).toBeVisible();
    await expect(page.locator('[data-tour="speed"] [data-state="on"]')).toHaveText('1x');
    await page.keyboard.press('i');
    await expect(title('What the runner senses')).toBeVisible();
    // The readout is live: the distance to the finish is a number, not a dash.
    await expect(page.getByText('Followed runner').locator('..')).toContainText(/Finish distance\s*\d+\.\d+ m/, { timeout: 90_000 });

    // The arrows still move through the tab list, so the keyboard reaches the Network tab the step asks for.
    await page.keyboard.press('ArrowRight');
    await expect(title('Look inside the champion')).toBeVisible();
    await page.getByRole('tab', { name: 'Progress' }).focus();
    await page.keyboard.press('ArrowRight');
    await expect(page.getByRole('tab', { name: 'Network' })).toHaveAttribute('aria-selected', 'true');
    await expect(title('This is the model running')).toBeVisible();
    await page.keyboard.press(' ');
    await expect(page.getByRole('button', { name: 'Train' })).toBeVisible();
  });

  test('takes its shortcuts from the card in Navigation, remembers each lab apart and hands focus back', async ({ page }) => {
    await page.goto('/lab/navigation?quality=low');
    const card = page.getByTestId('walkthrough');
    const title = (name: string) => card.getByRole('heading', { name });
    await expect(title('Welcome to the Navigation lab')).toBeVisible({ timeout: 90_000 });
    // Started with the mouse, focus sits on Next. Space still trains instead of pressing it.
    await card.getByRole('button', { name: 'Start the tour' }).click();
    await expect(title('Every runner has a brain')).toBeVisible();
    await page.keyboard.press(' ');
    await expect(page.getByRole('button', { name: 'Pause' })).toBeVisible();
    await expect(title('Fitness is the score')).toBeVisible();
    await page.keyboard.press(' ');
    await expect(page.getByRole('button', { name: 'Train' })).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(card).toBeHidden();
    await expect.poll(() => marker(page, 'sandboxlab.tour.navigation')).toBe('1');
    // Skipping one lab's tour leaves the other lab's for its own first visit.
    expect(await marker(page, 'sandboxlab.tour.driving')).toBeNull();

    await page.getByRole('button', { name: 'Help and shortcuts' }).click();
    await page.getByRole('button', { name: 'Replay the tour' }).click();
    await expect(title('Welcome to the Navigation lab')).toBeVisible();
    await expect(card).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(card).toBeHidden();
    // Focus goes back to where it was before the tour took it.
    await expect(page.getByRole('button', { name: 'Help and shortcuts' })).toBeFocused();

    // Once done it does not open by itself again.
    await page.reload();
    await expect(page.getByRole('button', { name: 'Train' })).toBeEnabled({ timeout: 90_000 });
    await page.waitForTimeout(3000);
    await expect(card).toHaveCount(0);
  });
});
