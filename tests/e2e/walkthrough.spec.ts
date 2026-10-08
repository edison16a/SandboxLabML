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

  test('keeps the drive chapter live after Turbo and leaves the arrows to the tab list', async ({ page }) => {
    await page.goto('/lab/racing?quality=low');
    const card = page.getByTestId('walkthrough');
    const title = (name: string) => card.getByRole('heading', { name });
    await expect(title('Welcome to the Racing lab')).toBeVisible({ timeout: 90_000 });
    await page.keyboard.press('Enter');
    await expect(title('Every car has a brain')).toBeVisible();
    await page.keyboard.press(' ');
    await expect(title('Fitness is the score')).toBeVisible();
    for (const name of ['The best become parents', 'Watch it improve', 'Species protect new ideas', 'Train faster']) {
      await page.keyboard.press('ArrowRight');
      await expect(title(name)).toBeVisible();
    }

    // Turbo trains out of sight, so the steps that show a car drive go back to 1x.
    await page.locator('[data-tour="speed"]').getByText('Turbo').click();
    await expect(title('Learning in the background')).toBeVisible();
    await page.keyboard.press('ArrowRight');
    await expect(title('A network only sees numbers')).toBeVisible();
    await expect(page.locator('[data-tour="speed"] [data-state="on"]')).toHaveText('1x');
    await page.keyboard.press('i');
    await expect(title('What the car senses')).toBeVisible();
    // The readout is live: the followed car's speed is a number, not a dash.
    await expect(page.getByText('Followed car').locator('..')).toContainText(/\d m\/s/, { timeout: 60_000 });

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

  test('Hide and Seek takes its shortcuts from the card, opens once and replays from its help menu', async ({ page }) => {
    await page.goto('/lab/hide-seek?quality=low');
    const card = page.getByTestId('walkthrough');
    const title = (name: string) => card.getByRole('heading', { name });
    await expect(title('Welcome to Hide and Seek')).toBeVisible({ timeout: 90_000 });
    // Started with the mouse, focus sits on Next. Space still trains instead of pressing it.
    await card.getByRole('button', { name: 'Start the tour' }).click();
    await expect(title('Hiders against seekers')).toBeVisible();
    await page.keyboard.press(' ');
    await expect(page.getByRole('button', { name: 'Pause' })).toBeVisible();
    await expect(title('50 matches at once')).toBeVisible();
    for (const name of ['An arms race', 'Fly in close']) {
      await page.keyboard.press('ArrowRight');
      await expect(title(name)).toBeVisible();
    }

    // The step frames the arenas, so a click on one flies in. Escape then backs out of it and the tour stays.
    const viewport = (await page.getByTestId('hs-viewport').boundingBox())!;
    // The grid camera may still be gliding into its framing on a loaded machine, so a click can land between two
    // arenas. Click again until one flies in.
    await expect(async () => {
      await page.mouse.click(viewport.x + viewport.width * 0.54, viewport.y + viewport.height * 0.5);
      await expect(title('Crates, ramps and locks')).toBeVisible({ timeout: 4000 });
    }).toPass({ timeout: 40_000 });
    const backToGrid = page.getByRole('button', { name: /All arenas/ });
    await expect(backToGrid).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(backToGrid).toBeHidden();
    await expect(title('Crates, ramps and locks')).toBeVisible();
    await page.keyboard.press('ArrowRight');
    await expect(title('What they sense')).toBeVisible();
    await page.keyboard.press('i');
    await expect(page.locator('[data-tour="inputs"]')).toHaveAttribute('aria-pressed', 'true');
    await expect(title('Senses in, moves out')).toBeVisible();
    await page.keyboard.press(' ');
    await expect(page.getByRole('button', { name: 'Train' })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(card).toBeHidden();
    await expect.poll(() => marker(page, 'sandboxlab.tour.hideseek')).toBe('1');
    // Skipping one lab's tour leaves the other lab's for its own first visit.
    expect(await marker(page, 'sandboxlab.tour.racing')).toBeNull();

    await page.getByRole('button', { name: 'Help and shortcuts' }).click();
    await page.getByRole('button', { name: 'Replay the tour' }).click();
    await expect(title('Welcome to Hide and Seek')).toBeVisible();
    await expect(card).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(card).toBeHidden();
    // Focus goes back to where it was before the tour took it.
    await expect(page.getByRole('button', { name: 'Help and shortcuts' })).toBeFocused();
  });
});
