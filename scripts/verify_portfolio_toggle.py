"""Verify portfolio input mode toggle ($/T) behavior in browser."""
from playwright.sync_api import sync_playwright
import sys

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={"width": 1280, "height": 900})

    # Collect console errors
    errors = []
    page.on("console", lambda msg: errors.append(msg.text) if msg.type == "error" else None)

    page.goto("http://localhost:5173")
    page.wait_for_load_state("networkidle")
    page.wait_for_timeout(3000)

    # Screenshot initial state
    page.screenshot(path="/tmp/portfolio_initial.png", full_page=False)
    print("✓ Initial page loaded")

    # Look for portfolio panel - it may need a market selected first
    # Try clicking on a market row to open portfolio
    market_rows = page.locator("table tbody tr, [data-testid='reserve-row']").all()
    if market_rows:
        market_rows[0].click()
        page.wait_for_timeout(1500)
        print(f"✓ Clicked first market row ({len(market_rows)} rows available)")
    else:
        print("⚠ No market rows found, trying alternative selectors")

    page.screenshot(path="/tmp/portfolio_after_click.png", full_page=False)

    # Look for portfolio section / toggle buttons
    portfolio_section = page.locator("[data-testid='portfolio-panel'], .portfolio-panel, [class*='Portfolio']").first
    toggle_buttons = page.locator("button[aria-label*='input mode'], button[aria-label*='toggle'], [data-testid='input-mode-toggle']").all()

    if not toggle_buttons:
        # Broader search: buttons containing $ or T text in portfolio area
        all_buttons = page.locator("button").all()
        toggle_candidates = [b for b in all_buttons if b.is_visible() and any(
            sym in (b.text_content() or "") for sym in ["$/T", "$ → T", "T → $", "USD", "Token"]
        )]
        if toggle_candidates:
            toggle_buttons = toggle_candidates
            print(f"✓ Found {len(toggle_buttons)} toggle candidates by text content")
        else:
            print("⚠ No toggle buttons found. Taking screenshot for manual inspection.")
            page.screenshot(path="/tmp/portfolio_no_toggle.png", full_page=False)

    # Test toggle interaction if found
    if toggle_buttons:
        for i, btn in enumerate(toggle_buttons[:3]):  # Test up to 3 buttons
            if not btn.is_enabled():
                print(f"  Button {i}: DISABLED (orphan position - expected)")
                # Check for tooltip on hover
                btn.hover()
                page.wait_for_timeout(500)
                tooltip = page.locator("[role='tooltip'], [data-state='delayed-open']").first
                if tooltip.is_visible():
                    print(f"    Tooltip visible: '{tooltip.text_content()}'")
                else:
                    print("    No tooltip visible on hover")
                continue

            before_text = btn.text_content()
            print(f"  Button {i}: ENABLED, text='{before_text}'")

            # Find nearby input to check value
            parent = btn.locator("xpath=ancestor::div[3]")
            inputs = parent.locator("input[type='text'], input[type='number'], input:not([type])").all()

            if inputs:
                before_value = inputs[0].input_value()
                print(f"    Input value before toggle: '{before_value}'")

                btn.click()
                page.wait_for_timeout(500)

                after_value = inputs[0].input_value()
                after_text = btn.text_content()
                print(f"    Input value after toggle: '{after_value}'")
                print(f"    Button text after: '{after_text}'")

                if before_value and after_value and before_value != after_value:
                    print(f"    ✓ VALUE CHANGED (conversion happened)")
                elif before_value and after_value and before_value == after_value:
                    print(f"    ⚠ VALUE UNCHANGED (possible bug if price != 1)")
                else:
                    print(f"    ℹ Input empty or cleared")
            else:
                print(f"    No input found near button")
                btn.click()
                page.wait_for_timeout(300)

            page.screenshot(path=f"/tmp/portfolio_toggle_{i}.png", full_page=False)

    # Summary
    print("\n--- Summary ---")
    if errors:
        print(f"Console errors ({len(errors)}):")
        for e in errors[:5]:
            print(f"  - {e[:120]}")
    else:
        print("No console errors")

    browser.close()
    print("\n✓ Browser verification complete")
