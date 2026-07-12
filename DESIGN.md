---
name: Aave APY
description: Multi-chain Aave V3 market analysis dashboard with warm, precise data presentation
colors:
  amber-primary: "#D97706"
  amber-primary-light: "#FBBF24"
  emerald-supply: "#10B981"
  emerald-supply-deep: "#059669"
  emerald-supply-deeper: "#047857"
  cyan-borrow: "#06B6D4"
  purple-spread: "#A855F7"
  purple-spread-deep: "#9333EA"
  blue-portfolio: "#3B82F6"
  red-destructive: "#DC2626"
  neutral-warm-bg: "#F5F3EE"
  neutral-warm-card: "#FAF8F4"
  neutral-warm-border: "#D1CBC0"
  neutral-warm-ink: "#1A1714"
  neutral-cool-dark-bg: "#12161E"
  neutral-cool-dark-card: "#1C2028"
  neutral-cool-dark-border: "#323848"
  neutral-cool-dark-ink: "#F5F3EE"
  magenta-brand: "#C242B1"
  cyan-brand: "#1AA3C7"
typography:
  display:
    fontFamily: "Source Sans Pro, ui-sans-serif, system-ui, sans-serif"
    fontSize: "clamp(20px, 2vw + 10px, 24px)"
    fontWeight: 600
    lineHeight: 1.2
  headline:
    fontFamily: "Source Sans Pro, ui-sans-serif, system-ui, sans-serif"
    fontSize: "18px"
    fontWeight: 600
    lineHeight: 1.25
  title:
    fontFamily: "Source Sans Pro, ui-sans-serif, system-ui, sans-serif"
    fontSize: "16px"
    fontWeight: 600
    lineHeight: 1.25
  body:
    fontFamily: "Source Sans Pro, ui-sans-serif, system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.25
  data:
    fontFamily: "Source Sans Pro, ui-sans-serif, system-ui, sans-serif"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: 1.25
  label:
    fontFamily: "Source Sans Pro, ui-sans-serif, system-ui, sans-serif"
    fontSize: "11px"
    fontWeight: 400
    lineHeight: 1.25
  mono:
    fontFamily: "Source Code Pro, ui-monospace, SFMono-Regular, monospace"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.25
rounded:
  lg: "16px"
  md: "14px"
  sm: "12px"
  button: "12px"
  chip: "9999px"
  icon-button: "9999px"
spacing:
  unit: "4px"
  min-safe: "8px"
  card-pad: "16px"
  card-pad-lg: "24px"
  tooltip-pad: "12px"
  row-pad-y: "8px"
components:
  button-primary:
    backgroundColor: "{colors.amber-primary}"
    textColor: "#FFF8F0"
    rounded: "{rounded.button}"
    padding: "8px 16px"
    height: "40px"
  button-primary-hover:
    backgroundColor: "#B45309"
  button-secondary:
    backgroundColor: "{colors.neutral-warm-border}"
    textColor: "{colors.neutral-warm-ink}"
    rounded: "{rounded.button}"
    padding: "8px 16px"
  button-utility:
    backgroundColor: "rgba(250, 248, 244, 0.8)"
    textColor: "{colors.neutral-warm-ink}"
    rounded: "{rounded.button}"
    padding: "8px 16px"
  input-neutral:
    backgroundColor: "transparent"
    textColor: "{colors.neutral-warm-ink}"
    rounded: "{rounded.md}"
    padding: "8px 12px"
    height: "40px"
  input-supply:
    backgroundColor: "rgba(16, 185, 129, 0.1)"
    textColor: "{colors.neutral-warm-ink}"
    rounded: "{rounded.md}"
  input-borrow:
    backgroundColor: "rgba(6, 182, 212, 0.1)"
    textColor: "{colors.neutral-warm-ink}"
    rounded: "{rounded.md}"
  card:
    backgroundColor: "{colors.neutral-warm-card}"
    textColor: "{colors.neutral-warm-ink}"
    rounded: "{rounded.lg}"
    padding: "24px"
  chip:
    backgroundColor: "{colors.neutral-warm-border}"
    textColor: "{colors.neutral-warm-ink}"
    rounded: "{rounded.chip}"
    height: "28px"
  segmented-track:
    backgroundColor: "rgba(209, 203, 192, 0.6)"
    rounded: "{rounded.chip}"
    height: "32px"
---

# Design System: Aave APY

## 1. Overview

**Creative North Star: "The Compass Room"**

A navigator's chart room under warm lamplight — rational, precise, and quietly confident. Every number is a bearing, every color a channel marker, every interaction a deliberate course correction. The room is warm not because it's cozy, but because the person reading the chart deserves to feel looked after. The data is exact; the delivery is human.

This system rejects the sterile blue-gray of clinical fintech dashboards, the neon-loud gambler's aesthetic of crypto-bro UIs, and the sensory overload of trading terminals with their screaming red/green price action. It also refuses the SaaS-cliché formula of identical card grids, gradient hero metrics, and tracked uppercase eyebrows above every section — patterns that announce "AI made this" before the user reads a single number.

The design lives at the intersection of high data density and breathable spacing: compact reserve tables with 4-layer responsive compression, semantic colors that carry exact financial meaning, and progressive disclosure that lets users scan headlines then drill into incentive breakdowns or simulation scenarios on demand.

**Key Characteristics:**
- Warm mist-white surfaces (light) / deep charcoal-black (dark) with amber gold as the sole accent
- Strict semantic color discipline: each hue maps to one financial concept and nothing else
- Dense data tables with 4-layer responsive compression (column width → padding → content → breakpoint switch)
- Tactile, confident component states — every button press and input focus feels acknowledged
- Flat-by-default elevation; shadows appear only as state feedback, never as decoration

## 2. Colors

The palette is organized by financial semantics, not by hue or hex order. Each color role carries exactly one meaning; no color serves two masters.

### Primary

- **Amber Primary** (#D97706 / hsl 37 92% 50%): The single accent. Used exclusively for primary actions (main CTA buttons, focus rings, active states), never for data or decoration. In dark mode, shifts to a lighter gold (#EAB308 / hsl 43 96% 58%) to maintain contrast.

### Secondary

- **Emerald Supply** (#10B981 / hsl 160 52% 46%): All supply-side data — supply APY, supply amounts, supply incentives, and their associated inputs and borders. Deeper variants (#059669, #047857) for hover and emphasis within the supply lane.
- **Cyan Borrow** (#06B6D4 / hsl 188 94% 43%): All borrow-side data — borrow APY, borrow amounts, borrow incentives. The cool counterpoint to emerald; together they let users scan a table and instantly distinguish sides.
- **Purple Spread** (#A855F7 / hsl 271 91% 65%): The spread (supply minus borrow). A synthetic color that exists only where both sides meet. Deeper variant (#9333EA) for emphasis.
- **Blue Portfolio** (#3B82F6 / hsl 217 91% 60%): Portfolio simulation mode. Signals "you are in a what-if scenario" distinct from live market data.

### Tertiary

- **Red Destructive** (#DC2626 / hsl 0 72% 50%): Errors, destructive actions, and critical warnings only. Not for negative yields or price drops — those are neutral data.
- **Sky Info** (#0EA5E9 / hsl 199 89% 48%): Informational indicators and frozen asset markers.

### Neutral

- **Warm Mist White** (#F5F3EE / hsl 60 4% 95%): Light-mode body background. Warm but not cream — the warmth comes from a 5% chroma lean toward amber, not from saturating toward beige.
- **Warm Card** (#FAF8F4 / hsl 60 9% 97%): Light-mode card surface. Slightly brighter and warmer than the background.
- **Warm Ink** (#1A1714 / hsl 24 9% 10%): Light-mode text. Deep charcoal with a subtle warm undertone, never pure black.
- **Warm Border** (#D1CBC0 / hsl 23 5% 82%): Light-mode borders and dividers. Warm gray, never cool gray.
- **Cool Charcoal** (#12161E / hsl 220 15% 8%): Dark-mode body background. Deep cool black that absorbs.
- **Cool Card** (#1C2028 / hsl 220 12% 12%): Dark-mode card surface.
- **Cool Ink** (#F5F3EE / hsl 60 5% 96%): Dark-mode text. Warm white that prevents the cold feeling of pure white on dark.
- **Cool Border** (#323848 / hsl 220 10% 22%): Dark-mode borders.

### Brand Signature

- **Magenta→Cyan Gradient** (hsl 308→175): The brand's visual signature, used sparingly — logo, gradient text on hover, and gradient borders on featured elements. Not applied to data or interactive states.

**The Semantic Exclusivity Rule.** Each named color role serves exactly one financial concept. Emerald is supply, cyan is borrow, purple is spread, blue is portfolio. No swapping, no borrowing, no "it's close enough." If a new concept needs a color, it gets its own role, not a recycled one.

**The No-Gray Rule.** Neutral grays (Tailwind `text-gray-*`, `bg-gray-*`, `border-gray-*`) are prohibited. All neutrals are tinted toward warm (light mode) or cool (dark mode). Untinted gray is a missed opportunity to reinforce the brand's thermal personality.

## 3. Typography

**Display Font:** Source Sans Pro (with ui-sans-serif, system-ui, sans-serif fallback)
**Body Font:** Source Sans Pro (same family, weight differentiation)
**Mono Font:** Source Code Pro (with ui-monospace, SFMono-Regular, monospace fallback)
**Serif Font:** Source Serif Pro (with Georgia, Cambria, serif fallback — declared but not Google-Fonts-loaded; falls back to system serifs)

**Character:** One well-tuned humanist sans carries everything — headings, data, labels, buttons. The tight size ratio (1.125–1.2 between steps) keeps the scale compact for dense data tables while maintaining clear hierarchy. Source Code Pro for numerical data that demands monospaced alignment. No display/heading pairing; the weight range (400/600/700) does the work.

### Hierarchy

- **Display** (600, clamp(20px, 2vw+10px, 24px), line-height 1.2): Card titles and primary headings. Responsive ceiling via clamp, never fluid body text.
- **Headline** (600, 18px, line-height 1.25): Section headers within cards.
- **Title** (600, 16px, line-height 1.25): Sub-section labels.
- **Body** (400, 14px, line-height 1.25): Primary data values, descriptions, and standard text. The workhorse.
- **Data** (400, 13px, line-height 1.25): Compact table data cells and secondary values.
- **Label** (400, 11px, line-height 1.25): Chips, tooltips, and the smallest annotations.
- **Micro** (400, 8–10px, line-height 1.25): The smallest tier for superscripts and metadata. Use sparingly.
- **Mono** (400/700, 14px, line-height 1.25): Numeric inputs, addresses, and code-like content.

**The Fixed-Rem Rule.** Product UI uses fixed rem sizes, not fluid clamp() scales for body text. Users view at consistent DPI; a fluid body that shrinks in a sidebar looks worse, not better. Only card titles use clamp() for responsive heading sizing.

## 4. Elevation

Flat by default. Shadows appear only as state feedback — hover lifts, focus glows, floating tooltips — never as decorative depth on resting surfaces. Cards and containers use tonal layering (slightly different background values) to separate hierarchy, not shadow mass.

### Shadow Vocabulary

- **2xs** (`0 1px 3px hsl(0 0% 0% / 0.05)`): Subtle presence for card surfaces at rest (light mode).
- **xs** (`0 1px 3px hsl(0 0% 0% / 0.05)`): Equivalent to 2xs; alias for consistency.
- **sm** (`0 1px 3px hsl(0 0% 0% / 0.1), 0 1px 2px -1px hsl(0 0% 0% / 0.1)`): Resting card depth.
- **md** (`0 1px 3px hsl(0 0% 0% / 0.1), 0 2px 4px -1px hsl(0 0% 0% / 0.1)`): Hover lift on cards.
- **lg** (`0 1px 3px hsl(0 0% 0% / 0.1), 0 4px 6px -1px hsl(0 0% 0% / 0.1)`): Popover and dropdown depth.
- **xl** (`0 1px 3px hsl(0 0% 0% / 0.1), 0 8px 10px -1px hsl(0 0% 0% / 0.1)`): Modal and sheet depth.
- **2xl** (`0 1px 3px hsl(0 0% 0% / 0.25)`): Maximum elevation, rarely used.
- **Tooltip** (`0 24px 60px -40px rgb(0 0 0 / 0.35)`): Diffuse ambient glow for floating incentive detail panels.

Dark mode doubles all opacity values — shadows must be perceptually stronger against dark surfaces to read as depth, not just as darker areas.

**The State-Only Rule.** Surfaces are flat at rest. A shadow appears when a card is hovered, a dropdown opens, or a tooltip floats. The shadow is the state change, not the resting identity.

## 5. Components

Every interactive component has: default, hover, focus, active, disabled, and loading states. Tactile and confident — state changes are felt, not just seen.

### Buttons

- **Shape:** Gently rounded (12px radius), 40px height default. Icon buttons fully round (9999px).
- **Primary:** Amber gold background (#D97706) with near-white text. Hover darkens 10%. Focus shows a 2px amber ring.
- **Secondary:** Warm gray background with deep ink text. Hover shifts background toward muted.
- **Utility:** Semi-transparent card background with 60% opacity border. Workhorse for non-primary actions in data-dense views.
- **Warning:** Amber-100 background (light) / amber-900/50 (dark) with amber-800/200 text. Distinct from primary; used for caution-state actions.
- **Ghost:** Transparent background; text only. Hover shows accent background.
- **Disabled:** 50% opacity, pointer-events none. No ambiguity about inoperability.
- **Sizes:** Default 40px, sm 36px, lg 44px (meets 44px mobile touch target minimum).

### Chips / Filter Pills

- **Shape:** Fully rounded (9999px), 28px height. Compact by design — they sit inside data table headers and segmented controls.
- **Unselected:** Muted background with muted-foreground text. Hover brightens.
- **Selected:** Brand magenta border + subtle magenta tint background with foreground text.

### Cards / Containers

- **Corner Style:** Generously rounded (16px radius). Soft but not pillowy.
- **Background:** Warm card white (light) / cool card gray (dark). Slightly distinct from body background for tonal layering.
- **Shadow Strategy:** Flat at rest (shadow-sm maximum). Hover may lift to shadow-md.
- **Border:** 1px warm/cool border at 60% opacity. Present but not demanding.
- **Internal Padding:** 24px for card headers and content areas; 16px for compact cards.

### Inputs / Fields

- **Style:** 14px rounded border, transparent empty state, tinted background when filled.
- **Semantic Variants:** Four surface modes — neutral (default), supply (emerald border + 10% emerald bg when filled), borrow (cyan border + 10% cyan bg when filled), magenta (search/filter focus).
- **Focus:** Border shifts to the variant's primary color + 2px ring at 25-35% opacity. Supply → emerald-600 border + emerald-500 ring; Borrow → cyan border + cyan ring; Neutral → magenta border + magenta ring.
- **Error / Disabled:** Error shows destructive ring. Disabled at 50% opacity with no pointer events.

### Segmented Toggle

- **Shape:** Pill-shaped track (32px height, fully rounded). Sliding indicator with card-white background and subtle shadow.
- **Indicator Motion:** 200ms ease-out (cubic-bezier(0.4, 0, 0.2, 1)). Respects prefers-reduced-motion.
- **Selected State:** Bold weight + foreground text on white indicator. Unselected: muted-foreground, hover foreground.
- **Chip Mode:** 28px track height, 42px minimum segment width for compact filter bars.

### Tooltip / Incentive Detail Panel

- **Shape:** 14px rounded corners, 12px internal padding. Max-width 220px (simple) or 520px (incentive detail).
- **Surface:** Multi-layer radial gradient — white base, warm amber glow top-left, cool cyan glow top-right, fine grid overlay. The "warm lamp on a chart" effect. Dark mode inverts the glow colors.
- **Arrow:** SVG dual-path (fill + stroke separated). Fill matches card background; stroke matches border at 60% opacity.
- **Animation:** 200ms fade-in + zoom-in-95 (desktop) or slide-in-from-bottom (mobile).
- **Semantic Borders:** Left border indicates data type — 3px emerald for supply, 3px cyan for borrow.

### Navigation / Header

- **Style:** Clean top bar with chain selector, wallet connection, and view mode toggles. No sidebar.
- **Typography:** Source Sans Pro 14px for controls. Logo uses gradient text on hover.
- **Mobile:** Bottom sheet for chain selection; touch targets ≥44px.

## 6. Do's and Don'ts

### Do:

- **Do** use semantic colors exclusively for their designated financial concept. Emerald = supply, cyan = borrow, purple = spread, blue = portfolio. No exceptions.
- **Do** tint all neutrals warm (light mode) or cool (dark mode). Untinted gray is a design debt.
- **Do** provide tactile state feedback on every interactive element. A button press, input focus, or toggle slide must be felt through visual response within 150–250ms.
- **Do** use 4-layer responsive compression for data tables: column width → padding → content → breakpoint switch. Never use ellipsis truncation — hard-switch to a more compact row layout instead.
- **Do** ensure 8px minimum spacing between text and border/container edge. Data density does not mean touching.
- **Do** use `active:` instead of `hover:` on mobile. Touch targets must be ≥44px.
- **Do** surface risk information (utilization, caps, liquidity) with appropriate visual hierarchy, not just the highest yield.
- **Do** keep the amber primary accent to ≤10% of any given screen. Its rarity is its impact.

### Don't:

- **Don't** use sterile blue-gray fintech palettes. This is not a banking terminal — it's a navigator's chart room with warm lamplight (per PRODUCT.md anti-reference: "cold, clinical fintech interfaces").
- **Don't** use neon colors, excessive animations, or gambling-like visual cues (per PRODUCT.md: "crypto-bro aesthetic").
- **Don't** prioritize flashy yields over data clarity and risk awareness (per PRODUCT.md: "generic DeFi UI patterns").
- **Don't** use red/green price action visuals that encourage impulsive decisions (per PRODUCT.md: "trading platform intensity").
- **Don't** overwhelm users with too much information at once (per PRODUCT.md: "overly complex financial platform layouts"). Progressive disclosure — core first, details on demand.
- **Don't** use `border-left` or `border-right` greater than 1px as a colored accent stripe on cards, except for the 3px semantic left border on incentive tooltip panels (which is an intentional type-indicator, not decoration).
- **Don't** use gradient text (`background-clip: text`) except for the brand logo hover state.
- **Don't** use glassmorphism, frosted-glass cards, or backdrop-filter blur as decorative effects.
- **Don't** apply shadows to resting surfaces. Shadows appear only on state change (hover, focus, float).
- **Don't** use display or serif fonts in UI labels, buttons, or data cells. One sans family, weight-differentiated.
- **Don't** reinvent standard affordances for flavor — custom scrollbars, non-standard modals, or invented form controls.
