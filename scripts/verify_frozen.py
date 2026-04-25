#!/usr/bin/env python3
"""Direct verification of frozen bg on running dev server."""
import time
from playwright.sync_api import sync_playwright

URL = "http://localhost:8080"

def main():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": 1440, "height": 900})
        page.goto(URL, wait_until="networkidle", timeout=30000)
        time.sleep(4)
        page.evaluate("document.documentElement.classList.add('dark')")
        time.sleep(1)

        # 1. Query CSSOM directly for bg-sky-500 rules
        print("=== CSSOM RULES (dev server runtime) ===")
        css_rules = page.evaluate("""() => {
            const results = [];
            for (const ss of document.styleSheets) {
                try {
                    for (const rule of ss.cssRules) {
                        const t = rule.selectorText || '';
                        const c = rule.cssText || '';
                        // All bg-sky-500 variants
                        if (t.includes('bg-sky') || t.includes('ds-bg-sky')) {
                            results.push({selector: t, css: c.substring(0, 120)});
                        }
                    }
                } catch(e) {}
            }
            return results;
        }""")
        for r in css_rules:
            print(f"  {r['selector']:50s} → {r['css']}")
        
        # 2. Click frozen toggle to show frozen assets
        frozen_btns = page.locator('button').filter(has_text='Frozen')
        for btn in frozen_btns.all():
            if btn.is_visible():
                btn.click()
                print("\nClicked frozen filter")
                time.sleep(2)
                break

        # 3. Check desktop frozen row background
        print("\n=== DESKTOP FROZEN ROW ===")
        frozen_rows = page.evaluate("""() => {
            const rows = document.querySelectorAll('tr[data-reserve-id]');
            const results = [];
            for (const tr of rows) {
                const snowflake = tr.querySelector('.lucide-snowflake');
                if (snowflake) {
                    const cs = getComputedStyle(tr);
                    // Check ALL background-related properties
                    results.push({
                        rid: tr.getAttribute('data-reserve-id')?.substring(0, 50),
                        bgColor: cs.backgroundColor,
                        bgImage: cs.backgroundImage,
                        allClasses: tr.className,
                        // Also check td children
                        td_bg: tr.querySelector('td') ? getComputedStyle(tr.querySelector('td')).backgroundColor : 'N/A',
                    });
                }
            }
            return results;
        }""")
        for r in frozen_rows:
            print(f"  RID: {r['rid']}")
            print(f"  Classes: {r['allClasses']}")
            print(f"  TR bg: {r['bgColor']}")
            print(f"  TD bg: {r['td_bg']}")
            print(f"  BG image: {r['bgImage']}")

        # 4. Switch to mobile and check frozen card
        print("\n=== MOBILE FROZEN CARD ===")
        page.set_viewport_size({"width": 390, "height": 844})
        time.sleep(2)
        
        mobile_frozen = page.evaluate("""() => {
            const cards = document.querySelectorAll('[data-reserve-id]');
            const results = [];
            for (const card of cards) {
                if (card.tagName === 'TR') continue; // skip desktop
                const inner = card.querySelector(':scope > div');
                if (!inner) continue;
                // Check if this card's inner div has ds-bg-sky-500-8
                const has_ds = inner.classList.contains('ds-bg-sky-500-8');
                // Check if there's a ❄ indicator
                const has_emoji = inner.textContent.includes('❄');
                const has_snow_svg = !!inner.querySelector('.lucide-snowflake');
                
                if (has_ds || has_emoji || has_snow_svg) {
                    const cs = getComputedStyle(inner);
                    results.push({
                        rid: card.getAttribute('data-reserve-id')?.substring(0, 50),
                        classes: inner.className,
                        bgColor: cs.backgroundColor,
                        has_ds_class: has_ds,
                    });
                }
            }
            return results;
        }""")
        if mobile_frozen:
            for r in mobile_frozen:
                print(f"  RID: {r['rid']}")
                print(f"  Classes: {r['classes']}")
                print(f"  bg: {r['bgColor']}")
                print(f"  has ds-bg-sky-500-8: {r['has_ds_class']}")
        else:
            print("  No frozen mobile cards found via DOM scan")
            # Try scrolling
            page.evaluate("window.scrollTo(0, 500)")
            time.sleep(1)
            mobile_frozen2 = page.evaluate("""() => {
                const cards = document.querySelectorAll('[data-reserve-id]');
                const results = [];
                for (const card of cards) {
                    if (card.tagName === 'TR') continue;
                    const inner = card.querySelector(':scope > div');
                    if (!inner) continue;
                    if (inner.classList.contains('ds-bg-sky-500-8')) {
                        const cs = getComputedStyle(inner);
                        results.push({
                            rid: card.getAttribute('data-reserve-id')?.substring(0, 50),
                            bgColor: cs.backgroundColor,
                        });
                    }
                }
                return results;
            }""")
            if mobile_frozen2:
                for r in mobile_frozen2:
                    print(f"  Found after scroll: [{r['rid']}] bg={r['bgColor']}")
            else:
                print("  Still no mobile frozen cards with ds-bg-sky-500-8")

        # 5. Also check non-frozen card background for comparison
        print("\n=== COMPARISON: non-frozen card bg ===")
        non_frozen_mobile = page.evaluate("""() => {
            const cards = document.querySelectorAll('[data-reserve-id]');
            for (const card of cards) {
                if (card.tagName === 'TR') continue;
                const inner = card.querySelector(':scope > div');
                if (inner && !inner.classList.contains('ds-bg-sky-500-8')) {
                    return getComputedStyle(inner).backgroundColor;
                }
            }
            return 'N/A';
        }""")
        print(f"  Non-frozen card bg: {non_frozen_mobile}")

        browser.close()

if __name__ == "__main__":
    main()
