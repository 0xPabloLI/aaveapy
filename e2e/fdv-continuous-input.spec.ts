import { expect, test } from '@playwright/test';

/**
 * FDV continuous input regression test.
 * Verifies that typing multiple characters in the FDV input works
 * without losing focus, resetting value, or cursor jumping.
 */
test.describe('FDV input — continuous typing', () => {
  test('typing multiple characters keeps focus and accumulates value', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(3000);

    const fdvInput = page.locator('input[aria-label="Estimated $INK FDV in billions"]').first();
    await expect(fdvInput).toBeVisible();

    // Click to focus, select all
    await fdvInput.click({ clickCount: 3 });
    await page.waitForTimeout(100);

    // Type characters one by one within MAX_FDV (115.8)
    const chars = '50';
    for (const char of chars) {
      await fdvInput.press(char, { delay: 30 });
      await page.waitForTimeout(20);
      const stillFocused = await fdvInput.evaluate(el => document.activeElement === el);
      expect(stillFocused).toBe(true);
    }

    await page.waitForTimeout(500);

    // After typing, the input should still be focused
    const stillFocused = await fdvInput.evaluate(el => document.activeElement === el);
    expect(stillFocused).toBe(true);

    // Value should contain all typed characters
    const rawValue = await fdvInput.inputValue();
    expect(rawValue).toBe('50');

    // Blur to commit
    await page.locator('body').click({ position: { x: 0, y: 0 } });
    await page.waitForTimeout(300);

    // After blur, value should be committed
    const formattedValue = await fdvInput.inputValue();
    expect(formattedValue).toBe('50');
  });

  test('rapid typing does not lose characters', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(3000);

    const fdvInput = page.locator('input[aria-label="Estimated $INK FDV in billions"]').first();
    await expect(fdvInput).toBeVisible();

    await fdvInput.click({ clickCount: 3 });
    await page.waitForTimeout(100);

    // Rapid typing with minimal delay (within MAX_FDV=115.8)
    await fdvInput.pressSequentially('75', { delay: 10 });
    await page.waitForTimeout(500);

    const stillFocused = await fdvInput.evaluate(el => document.activeElement === el);
    expect(stillFocused).toBe(true);

    const rawValue = await fdvInput.inputValue();
    expect(rawValue).toBe('75');
  });

  test('typing with decimal point works continuously', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(3000);

    const fdvInput = page.locator('input[aria-label="Estimated $INK FDV in billions"]').first();
    await expect(fdvInput).toBeVisible();

    await fdvInput.click({ clickCount: 3 });
    await page.waitForTimeout(100);

    // Type a decimal number
    await fdvInput.pressSequentially('12.5', { delay: 30 });
    await page.waitForTimeout(500);

    const stillFocused = await fdvInput.evaluate(el => document.activeElement === el);
    expect(stillFocused).toBe(true);

    const rawValue = await fdvInput.inputValue();
    expect(rawValue).toBe('12.5');

    // Blur to commit
    await page.locator('body').click({ position: { x: 0, y: 0 } });
    await page.waitForTimeout(300);

    const formattedValue = await fdvInput.inputValue();
    expect(formattedValue).toBe('12.5');
  });
});