import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  HEADER_CONTROL_AFFORDANCE_ICON_CLASS,
  HEADER_CONTROL_DESKTOP_ACTIVE_CLASS,
  HEADER_CONTROL_DESKTOP_CLASS,
  HEADER_CONTROL_FOCUS_RING_CLASS,
  HEADER_CONTROL_ICON_CLASS,
  HEADER_CONTROL_MOBILE_CLASS,
  HEADER_CONTROL_POPOVER_ITEM_CLASS,
  HEADER_CONTROL_TRANSITION_DURATION,
} from '@/lib/headerControlStyles'

/**
 * Header-control consistency guard.
 *
 * Every header control (FAQ link, Wallet button, clock popover, watch
 * address input) must consume the shared token classes in
 * `src/lib/headerControlStyles.ts`. This source-level snapshot prevents
 * regressions where someone re-introduces hardcoded geometry like
 * `w-7`, `text-[11px]`, or a stray `ring-1` focus style.
 *
 * See docs/design/header-controls.md for the token → pixel mapping.
 */

const ROOT = resolve(__dirname, '..')
const read = (rel: string) => readFileSync(resolve(ROOT, rel), 'utf8')

const CONSUMERS = [
  'components/dashboard/Header.tsx',
  'components/dashboard/WalletButton.tsx',
  'components/dashboard/WatchAddressInput.tsx',
  'components/ui/accordion.tsx',
  'components/dashboard/InkAprCalculator.tsx',
  'components/dashboard/IncentiveTooltip.tsx',
] as const

const HEADER_CONTROL_FILES = [
  'components/dashboard/Header.tsx',
  'components/dashboard/WalletButton.tsx',
  'components/dashboard/WatchAddressInput.tsx',
  'components/ui/accordion.tsx',
] as const

describe('Header controls: token contract', () => {
  it('every token resolves to a non-empty string class list', () => {
    for (const cls of [
      HEADER_CONTROL_MOBILE_CLASS,
      HEADER_CONTROL_DESKTOP_CLASS,
      HEADER_CONTROL_DESKTOP_ACTIVE_CLASS,
      HEADER_CONTROL_POPOVER_ITEM_CLASS,
      HEADER_CONTROL_FOCUS_RING_CLASS,
      HEADER_CONTROL_ICON_CLASS,
    ]) {
      expect(cls.trim().length).toBeGreaterThan(0)
    }
  })

  it('mobile + desktop tokens all include the shared focus ring', () => {
    expect(HEADER_CONTROL_MOBILE_CLASS).toContain('focus-visible:ring-2')
    expect(HEADER_CONTROL_MOBILE_CLASS).toContain('focus-visible:ring-offset-2')
    expect(HEADER_CONTROL_DESKTOP_CLASS).toContain('focus-visible:ring-offset-2')
    expect(HEADER_CONTROL_DESKTOP_ACTIVE_CLASS).toContain('focus-visible:ring-offset-2')
  })

  it('mobile token uses --ds-control-h for both width and height', () => {
    expect(HEADER_CONTROL_MOBILE_CLASS).toContain('w-[var(--ds-control-h)]')
    expect(HEADER_CONTROL_MOBILE_CLASS).toContain('h-[var(--ds-control-h)]')
    expect(HEADER_CONTROL_MOBILE_CLASS).toContain('rounded-full')
  })

  it('desktop token uses ds-text-14 and ds-space-* padding', () => {
    expect(HEADER_CONTROL_DESKTOP_CLASS).toContain('ds-text-14')
    expect(HEADER_CONTROL_DESKTOP_CLASS).toContain('px-[var(--ds-space-2)]')
    expect(HEADER_CONTROL_DESKTOP_CLASS).toContain('py-[var(--ds-space-1)]')
  })

  it('chevron affordance icon size is 14px (w-3.5 h-3.5)', () => {
    expect(HEADER_CONTROL_AFFORDANCE_ICON_CLASS).toBe('w-3.5 h-3.5')
  })

  it('transition duration token resolves to duration-200', () => {
    expect(HEADER_CONTROL_TRANSITION_DURATION).toBe('duration-200')
  })
})

describe('Header controls: consumers reference shared tokens', () => {
  for (const file of CONSUMERS) {
    it(`${file} imports from @/lib/headerControlStyles`, () => {
      expect(read(file)).toMatch(/from\s+['"]@\/lib\/headerControlStyles['"]/)
    })
  }
})

describe('Header controls: no hardcoded geometry regressions', () => {
  // Patterns that historically caused wallet button / FAQ / watch input to
  // diverge from the rest of the header controls.
  const FORBIDDEN: Array<{ name: string; re: RegExp }> = [
    { name: 'hardcoded h-7 (legacy watch input height)', re: /\bh-7\b/ },
    { name: 'hardcoded text-[11px] (use ds-text-11)', re: /text-\[11px\]/ },
    { name: 'hardcoded text-[13px] (use ds-text-13)', re: /text-\[13px\]/ },
    { name: 'small focus ring (use shared focus ring)', re: /focus-visible:ring-1\b/ },
    { name: 'inline px-2 py-1 (use --ds-space-* tokens)', re: /\bpx-2 py-1\b/ },
    { name: 'inline gap-1 on header controls (use ds-space-1)', re: /className="[^"]*\bgap-1\b[^"]*"/ },
    { name: 'hardcoded h-4 w-4 chevron (use HEADER_CONTROL_AFFORDANCE_ICON_CLASS)', re: /\bh-4\s+w-4\b/ },
    { name: 'hardcoded opacity-60 on chevron (chevron inherits parent color)', re: /opacity-60/ },
    // Note: this regex matches any `duration-200` in HEADER_CONTROL_FILES only
    // (Header, WalletButton, WatchAddressInput, accordion). Files outside that
    // set (InkAprCalculator, IncentiveTooltip) are covered by the line-level
    // chevron guard below, which is stricter — it only checks ChevronDown lines.
    { name: 'hardcoded duration-200 (use HEADER_CONTROL_TRANSITION_DURATION)', re: /duration-200/ },
  ]

  for (const file of HEADER_CONTROL_FILES) {
    const src = read(file)
    for (const { name, re } of FORBIDDEN) {
      it(`${file} has no ${name}`, () => {
        expect(src).not.toMatch(re)
      })
    }
  }
})

describe('Chevron consumers: no hardcoded chevron geometry', () => {
  const CHEVRON_CONSUMERS = [
    'components/dashboard/InkAprCalculator.tsx',
    'components/dashboard/IncentiveTooltip.tsx',
  ] as const

  for (const file of CHEVRON_CONSUMERS) {
    const src = read(file)
    it(`${file} chevron uses HEADER_CONTROL_AFFORDANCE_ICON_CLASS (no inline w-3.5 h-3.5 on ChevronDown)`, () => {
      const chevronLines = src.split('\n').filter(l => /ChevronDown/.test(l) || (/className/.test(l) && /transition-transform/.test(l)))
      for (const line of chevronLines) {
        expect(line).not.toMatch(/\bw-3\.5\s+h-3\.5\b/)
        expect(line).not.toMatch(/\bh-4\s+w-4\b/)
      }
    })
    it(`${file} chevron has no hardcoded opacity-60`, () => {
      const chevronLines = src.split('\n').filter(l => /ChevronDown/.test(l))
      for (const line of chevronLines) {
        expect(line).not.toMatch(/opacity-60/)
      }
    })
    it(`${file} chevron has no hardcoded duration-200 (use token or keep non-200 duration)`, () => {
      const chevronLines = src.split('\n').filter(l => /ChevronDown/.test(l))
      for (const line of chevronLines) {
        expect(line).not.toMatch(/duration-200/)
      }
    })
  }
})

describe('Header controls: WatchAddressInput exposes confirm + cancel affordances', () => {
  const src = read('components/dashboard/WatchAddressInput.tsx')

  it('renders a Confirm button with aria-label', () => {
    expect(src).toMatch(/aria-label="Confirm watch address"/)
  })

  it('renders a Cancel button with aria-label', () => {
    expect(src).toMatch(/aria-label="Cancel"/)
  })

  it('uses cnDsInputSurface for input styling (DESIGN.md §4)', () => {
    expect(src).toContain('cnDsInputSurface')
    expect(src).not.toContain('HEADER_CONTROL_INPUT_CLASS')
    expect(src).not.toContain('border-border/40')
  })
})
