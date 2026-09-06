import { expect, test } from '@playwright/test';

/**
 * FDV continuous input regression test.
 * Verifies that typing multiple characters in the FDV input works
 * without losing focus, resetting value, or cursor jumping.
 *
 * NOTE: The $INK FDV input only renders when the $INK token exists in
 * staging data. If the token is not present, all tests skip gracefully.
 */
test.describe('FDV input — continuous typing', () => {
  const FDV_INPUT_LABEL = 'Estimated $INK FDV in billions';

  /**
   * Navigate to the page and wait for the FDV input to appear.
   * Returns the locator or null if the input is not present.
   */
  async function getFdvInput(page: import('@playwright/test').Page) {
    const fdvInput = page.locator(`input[aria-label="${FDV_INPUT_LABEL}"]`).first();
    // Wait up to 15s for the input to appear (staging API may be slow)
    const visible = await fdvInput.isVisible({ timeout: 15_000 }).catch(() => false);
    return visible ? fdvInput : null;
  }

  test('typing multiple characters keeps focus and accumulates value', async ({ page }) => {
    test.setTimeout(120_000);
    await page.goto('/', { timeout: 30_000, waitUntil: 'domcontentloaded' });

    const fdvInput = await getFdvInput(page);
    test.skip(!fdvInput, '$INK FDV input not found in current staging data');

    // Click to focus, select all
    await fdvInput!.click({ clickCount: 3 });
    await page.waitForTimeout(100);

    // Type characters one by one within MAX_FDV (115.8)
    const chars = '50';
    for (const char of chars) {
      await fdvInput!.press(char, { delay: 30 });
      await page.waitForTimeout(20);
      const stillFocused = await fdvInput!.evaluate(el => document.activeElement === el);
      expect(stillFocused).toBe(true);
    }

    await page.waitForTimeout(500);

    // After typing, the input should still be focused
    const stillFocused = await fdvInput!.evaluate(el => document.activeElement === el);
    expect(stillFocused).toBe(true);

    // Value should contain all typed characters
    const rawValue = await fdvInput!.inputValue();
    expect(rawValue).toBe('50');

    // Blur to commit
    await page.locator('body').click({ position: { x: 0, y: 0 } });
    await page.waitForTimeout(300);

    // After blur, value should be committed
    const formattedValue = await fdvInput!.inputValue();
    expect(formattedValue).toBe('50');
  });

  test('rapid typing does not lose characters', async ({ page }) => {
    test.setTimeout(120_000);
    await page.goto('/', { timeout: 30_000, waitUntil: 'domcontentloaded' });

    const fdvInput = await getFdvInput(page);
    test.skip(!fdvInput, '$INK FDV input not found in current staging data');

    await fdvInput!.click({ clickCount: 3 });
    await page.waitForTimeout(100);

    // Rapid typing with minimal delay (within MAX_FDV=115.8)
    await fdvInput!.pressSequentially('75', { delay: 10 });
    await page.waitForTimeout(500);

    const stillFocused = await fdvInput!.evaluate(el => document.activeElement === el);
    expect(stillFocused).toBe(true);

    const rawValue = await fdvInput!.inputValue();
    expect(rawValue).toBe('75');
  });

  test('typing with decimal point works continuously', async ({ page }) => {
    test.setTimeout(120_000);
    await page.goto('/', { timeout: 30_000, waitUntil: 'domcontentloaded' });

    const fdvInput = await getFdvInput(page);
    test.skip(!fdvInput, '$INK FDV input not found in current staging data');

    await fdvInput!.click({ clickCount: 3 });
    await page.waitForTimeout(100);

    // Type a decimal number
    await fdvInput!.pressSequentially('12.5', { delay: 30 });
    await page.waitForTimeout(500);

    const stillFocused = await fdvInput!.evaluate(el => document.activeElement === el);
    expect(stillFocused).toBe(true);

    const rawValue = await fdvInput!.inputValue();
    expect(rawValue).toBe('12.5');

    // Blur to commit
    await page.locator('body').click({ position: { x: 0, y: 0 } });
    await page.waitForTimeout(300);

    const formattedValue = await fdvInput!.inputValue();
    expect(formattedValue).toBe('12.5');
  });

  test('decimal input is truncated to max 2 decimal places', async ({ page }) => {
    test.setTimeout(120_000);
    await page.goto('/', { timeout: 30_000, waitUntil: 'domcontentloaded' });

    const fdvInput = await getFdvInput(page);
    test.skip(!fdvInput, '$INK FDV input not found in current staging data');

    // Clear and type a value with more than 2 decimal places
    await fdvInput!.click({ clickCount: 3 });
    await page.waitForTimeout(100);

    await fdvInput!.pressSequentially('1.234', { delay: 30 });
    await page.waitForTimeout(500);

    const stillFocused = await fdvInput!.evaluate(el => document.activeElement === el);
    expect(stillFocused).toBe(true);

    // Should be truncated to 2 decimal places
    const rawValue = await fdvInput!.inputValue();
    expect(rawValue).toBe('1.23');

    // Blur to commit
    await page.locator('body').click({ position: { x: 0, y: 0 } });
    await page.waitForTimeout(300);

    const formattedValue = await fdvInput!.inputValue();
    expect(formattedValue).toBe('1.23');
  });

  test('decimal input with exactly 2 decimal places is not truncated', async ({ page }) => {
    test.setTimeout(120_000);
    await page.goto('/', { timeout: 30_000, waitUntil: 'domcontentloaded' });

    const fdvInput = await getFdvInput(page);
    test.skip(!fdvInput, '$INK FDV input not found in current staging data');

    await fdvInput!.click({ clickCount: 3 });
    await page.waitForTimeout(100);

    // Type a value with exactly 2 decimal places
    await fdvInput!.pressSequentially('3.14', { delay: 30 });
    await page.waitForTimeout(500);

    const stillFocused = await fdvInput!.evaluate(el => document.activeElement === el);
    expect(stillFocused).toBe(true);

    // Should stay as-is (already within 2 decimal places)
    const rawValue = await fdvInput!.inputValue();
    expect(rawValue).toBe('3.14');

    // Blur to commit
    await page.locator('body').click({ position: { x: 0, y: 0 } });
    await page.waitForTimeout(300);

    const formattedValue = await fdvInput!.inputValue();
    expect(formattedValue).toBe('3.14');
  });

  test('focus selects all text in the input', async ({ page }) => {
    test.setTimeout(120_000);
    await page.goto('/', { timeout: 30_000, waitUntil: 'domcontentloaded' });

    const fdvInput = await getFdvInput(page);
    test.skip(!fdvInput, '$INK FDV input not found in current staging data');

    // The input starts with a default value (e.g. "1")
    const initialValue = await fdvInput!.inputValue();
    expect(initialValue.length).toBeGreaterThan(0);

    // Click to focus — should select all
    await fdvInput!.click();

    // Poll for the select-all state to settle: under full-suite load the
    // select-all on focus can race the click's caret placement, and a
    // fixed-delay one-shot read turns that race into a flake.
    await expect
      .poll(
        async () => {
          const selection = await fdvInput!.evaluate((el: HTMLInputElement) => ({
            start: el.selectionStart,
            end: el.selectionEnd,
            length: el.value.length,
          }));
          return selection.start === 0 && selection.end === selection.length;
        },
        { timeout: 10_000, message: 'focus selects all text in the input' },
      )
      .toBe(true);
  });

  test('cursor stays after decimal point when typing 1.5', async ({ page }) => {
    test.setTimeout(120_000);
    await page.goto('/', { timeout: 30_000, waitUntil: 'domcontentloaded' });

    const fdvInput = await getFdvInput(page);
    test.skip(!fdvInput, '$INK FDV input not found in current staging data');

    await fdvInput!.click({ clickCount: 3 });
    await page.waitForTimeout(100);

    // Type "1" first
    await fdvInput!.press('1', { delay: 30 });
    await page.waitForTimeout(50);

    // Type "." (decimal point)
    await fdvInput!.press('.', { delay: 30 });
    await page.waitForTimeout(50);

    // Cursor should be at position 2 (after "1.")
    const cursorAfterDot = await fdvInput!.evaluate((el: HTMLInputElement) => el.selectionStart);
    expect(cursorAfterDot).toBe(2);

    // Type "5" after the decimal
    await fdvInput!.press('5', { delay: 30 });
    await page.waitForTimeout(50);

    // Cursor should now be at position 3 (after "1.5")
    const cursorAfterFive = await fdvInput!.evaluate((el: HTMLInputElement) => el.selectionStart);
    expect(cursorAfterFive).toBe(3);

    const rawValue = await fdvInput!.inputValue();
    expect(rawValue).toBe('1.5');
  });
});
