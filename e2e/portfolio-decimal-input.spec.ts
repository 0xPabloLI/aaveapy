import { expect, test } from '@playwright/test';

/**
 * Portfolio decimal input regression tests.
 *
 * Verifies that typing a decimal point after focusing a number input
 * works correctly — the cursor stays in the right position and the
 * value is not mangled. Regression guard for AAV-739.
 *
 * Key scenario: focus an input that already has a formatted value
 * like "1,000", then type "." — the input should show "1,000." (not
 * "0." or "1,000" with the dot swallowed).
 */
test.describe('Portfolio input — decimal point entry', () => {
  async function setupPortfolioWithReserve(page: import('@playwright/test').Page) {
    await page.goto('/');
    await expect(page.getByRole('textbox', { name: 'Borrow amount' })).toBeVisible();
    await page.getByTestId('portfolio-mode-toggle').click();
    await page.getByRole('button', { name: 'Search tokens' }).click();
    await page.getByRole('textbox', { name: 'Search tokens to add' }).fill('USDC');
    const addBtn = page
      .getByRole('button', { name: /^Add .+ \(supply and borrow\)$/ })
      .first();
    await expect(addBtn).toBeVisible();
    await addBtn.click();
    const supplyInput = page.getByRole('textbox', { name: /Supply amount for USDC/i }).first();
    await expect(supplyInput).toBeVisible();
    return supplyInput;
  }

  test('typing decimal point right after focus preserves cursor position', async ({ page }) => {
    const supplyInput = await setupPortfolioWithReserve(page);

    // Enter a whole number, then blur to get it formatted with commas.
    await supplyInput.fill('1000');
    await supplyInput.blur();

    // After blur, the value should be formatted with commas.
    const blurredValue = await supplyInput.inputValue();
    expect(blurredValue).toContain(',');

    // Focus the input again — commas are preserved on focus.
    await supplyInput.focus();

    // Immediately type a decimal point.
    await page.keyboard.press('.');

    // The input should show "1,000." — not "0." and not "1,000" (dot swallowed).
    const value = await supplyInput.inputValue();
    expect(value).toBe('1,000.');
  });

  test('typing decimal point on empty input produces "0."', async ({ page }) => {
    const supplyInput = await setupPortfolioWithReserve(page);

    // Input is empty — focus and type a dot.
    await supplyInput.focus();
    await page.keyboard.press('.');

    const value = await supplyInput.inputValue();
    expect(value).toBe('0.');
  });

  test('cursor is at correct position after typing decimal mid-number', async ({ page }) => {
    const supplyInput = await setupPortfolioWithReserve(page);

    // Type "12.34" via sequential keystrokes.
    await supplyInput.focus();
    await page.keyboard.press('1');
    await page.keyboard.press('2');
    await page.keyboard.press('.');
    await page.keyboard.press('3');
    await page.keyboard.press('4');

    const value = await supplyInput.inputValue();
    expect(value).toBe('12.34');

    // Cursor should be at position 5 (after "4").
    const cursorPos = await supplyInput.evaluate((el: HTMLInputElement) => el.selectionStart);
    expect(cursorPos).toBe(5);
  });

  test('re-focusing formatted value then appending digits works', async ({ page }) => {
    const supplyInput = await setupPortfolioWithReserve(page);

    // Enter a number and blur to get formatting.
    await supplyInput.fill('5000');
    await supplyInput.blur();

    // Focus again and type ".5" — should produce "5,000.5" (commas preserved).
    await supplyInput.focus();
    await page.keyboard.press('.');
    await page.keyboard.press('5');

    const value = await supplyInput.inputValue();
    expect(value).toBe('5,000.5');
  });
});
