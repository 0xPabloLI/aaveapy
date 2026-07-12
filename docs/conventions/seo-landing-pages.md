# SEO Landing Page Conventions

## Purpose

`/chain/:slug` pages exist **solely for search discovery**. There is no navigation entry from the
main dashboard UI — users land here via Google/Bing/etc., read the copy, then click the CTA to
jump into the dashboard.

## Canonical Data Source

[src/lib/seoChains.ts](../../src/lib/seoChains.ts) is the single source of truth for all 17 chain
landing pages. Every SEO-relevant field (slug, display name, title, description, intro, highlights,
chain name matchers) lives here.

## URL Catalog

Three files must stay in sync with `seoChains.ts`:

| File | Role | Slug format |
|---|---|---|
| `public/sitemap.xml` | Submitted to Google/Bing Search Console | `/chain/<slug>` |
| `public/llms.txt` | LLM crawler index | `/chain/<slug>` |
| `src/App.tsx` | React Router mapping | `/chain/:slug` |

Automated tests in [src/lib/seoChains.test.ts](../../src/lib/seoChains.test.ts) validate
sitemap.xml and llms.txt against the canonical slugs on every run.

## Content Rules

### Title (`<title>` tag, shown in SERP)

| Rule | Why |
|---|---|
| ≤ 60 characters | Google truncates at ~60; beyond that users never see the rest |
| Chain name **first**, then "Aave APY" | Primary keyword ranking for "{Chain} Aave APY" |
| Include 2-3 key tokens | Capture "ETH lending rates" / "USDC APY" searches even when user doesn't type "Aave" |
| Add a chain-specific differentiator when possible | Avoid identical titles competing for the same SERP slot |
| Never include version numbers | "V2" / "V3" are noise — nobody searches "Aave V3 APY" |

**Pattern:**
```
{ChainName} Aave APY — {Descriptor} Rates for {Token1} & {Token2}
```

**Examples:**
```
Ethereum Aave APY — Live Rates for ETH, USDC & WBTC
Scroll Aave APY — Live zkEVM Rates for ETH & USDC
Linea Aave APY — Consensys zkEVM Rates for ETH & USDC
Sonic Aave APY — High-Speed Rates for ETH & USDC
```

### Description (`<meta name="description">`, SERP snippet)

| Rule | Why |
|---|---|
| ≤ 160 characters | Google clips at ~160 |
| Must contain **"lending"** or **"borrowing"** | Core ranking keywords |
| Must mention chain-specific key tokens | Multi-intent search capture |
| Must mention incentives generically | "All active incentives" / "incentive programs" — never hardcode "Merit" / "Merkl" |

**Pattern:**
```
{Open} Aave lending and borrowing APYs for {Tokens} and all {Chain} reserves. {Incentives} included.
```

### Intro (page body paragraph)

| Rule | Why |
|---|---|
| Describe the chain's Aave deployment factually | Search context + user trust |
| List key asset categories (ETH, stables, BTC proxies, chain-native tokens) | Token keyword density |
| Explain what the page shows | "Live supply and borrow APYs" |
| Mention incentive coverage | "All active incentives factored into the effective yield" |
| Third-person / declarative tone | Avoid "you" / "you'll" — keep consistent across pages |
| **CAN mention V3/V4 when factually necessary** | Unlike title/description, intro is for humans reading the page. Mentioning V3/V4 markets where relevant (e.g., Ethereum V4 Hub & Spoke) is factual and helpful. |

### Highlights (3 bullet points)

| Rule | Why |
|---|---|
| Exactly 3 per chain | Consistent page layout |
| First highlight covers all reserves | "Live supply and borrow APYs for every {Chain} reserve" |
| At least one highlight is chain-specific | Differentiate from other pages |
| Last highlight lists tokens | Keyword coverage |
| Never hardcode incentive names | "All active incentives" — never "Merit" / "Merkl" |

## Prohibitions

| Forbidden | Reason | Applies to |
|---|---|---|
| Version numbers (V2, V3, V4) in **title or description** | Technical noise, nobody searches this | title, description |
| Hardcoded incentive names ("Merit", "Merkl") **anywhere** | Goes stale when programs change | all fields |
| Empty or duplicate slugs | Breaks routing and sitemap | slug field |
| displayName that differs from own title/body copy | Inconsistency confuses crawlers | displayName |
| Title > 60 chars | SERP truncation | title |
| Description > 160 chars | SERP truncation | description |

### Incentive naming: always generic

```
✅ "All active incentives factored into effective yield"
✅ "Incentive programs included"
✅ "All active rewards baked into effective yield"

❌ "Merit incentives included"
❌ "Merit and Merkl incentives factored into effective yield"
❌ "Tydro + Merkl rewards"
```

Exception: **chain-specific incentive programs** (e.g., Ink airdrop / Tydro points) can be named
because they are chain identifiers, not third-party programs that come and go.

## Keywords Strategy

Every page must be discoverable for searches that **don't include "Aave"**:

1. **Tokens** — Title and description contain `ETH`, `USDC`, and at least one chain-specific token
2. **"Lending" / "borrowing"** — Present in every description
3. **"APY" / "rates"** — Present in every title
4. **Chain-specific terms** — Scroll → "zkEVM", Linea → "Consensys zkEVM", Sonic → "High-Speed", etc.

## Display Names

`displayName` should use the **SEO-friendly / user-facing name**, which may differ from the
backend `chainName`:

| SEO displayName | Backend chainName | Rationale |
|---|---|---|
| `BNB Chain` | `BNB` | Users search "BNB Chain", not "BNB" |
| `zkSync Era` | `ZkSync` | Users search "zkSync Era", backend uses abbreviated form |
| `Gnosis Chain` | `Gnosis` | Users search "Gnosis Chain" |

`chainNameMatchers` use case-insensitive substring matching against `reserve.chainName`, so
`['bnb', 'binance']` matches `"BNB"` and `['zksync']` matches `"ZkSync"`.

## Adding a New Chain

1. Add an entry to `SEO_CHAINS` in `src/lib/seoChains.ts` following all rules above
2. Add the `/chain/<slug>` entry to `public/sitemap.xml`
3. Add the `/chain/<slug>` entry to `public/llms.txt`
4. Verify `chainNameMatchers` correctly match the backend `chainName` (case-insensitive)
5. Run `npx vitest run src/lib/seoChains.test.ts` — all URL catalog tests must pass

## Validation Gate

After any change to `src/lib/seoChains.ts`, `public/sitemap.xml`, or `public/llms.txt`:

```bash
npm run lint
npx vitest run src/lib/seoChains.test.ts
npm run build
npx tsc --noEmit
```