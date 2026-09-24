# Backlink Outreach — Localized Aave Rate Pages

Scope: off-site link acquisition for the 9 localized landing pages. Lovable cannot
publish on third-party sites; this document is the prospect list, the pitch copy and
the tracking table for a human to execute.

Source of SERP competitors: Semrush SERP analysis for the primary keyword of each market
(see `docs/seo/keyword-plan.md` for volume/KD).

## 1. Internal link matrix (done in code)

Every localized page now renders:

- `hreflang` alternates for all 9 locales + `x-default` (`src/components/seo/LocaleAlternates.tsx`)
- A visible cross-language nav linking to the other 8 pages (tracked as `locale_<locale>` clicks)
- Existing `related` links to `/`, `/defi-yield-tracker`, market hubs

This is the internal half of the link plan; the rest of this file is external.

## 2. Prospects by market

### FR — `/fr/taux-aave-apy` (target: `defi rendement`, KD 21)
| Prospect | Type | Angle |
| --- | --- | --- |
| coinacademy.fr | Editorial crypto | Offer a live-rate data widget/citation for their Aave guides |
| cryptoast.fr | Editorial crypto | Data citation: "taux Aave V3 en temps réel par réseau" |
| finance-heros.fr | Personal finance | Comparison-table source for DeFi yield article |
| fibo-crypto.fr, investisseurs-heureux.fr | Blog/forum | Resource link in DeFi yield threads |
| r/CryptoFrance | Community | Answer rate questions, link only when it answers the question |

### DE — `/de/aave-zinsen-apy` (target: `aave kurs`, KD 22)
| Prospect | Type | Angle |
| --- | --- | --- |
| blockchainwelt.de, coin-update.de | Editorial | Aave-Zinsen data source |
| finanzfluss forum, wallstreet-online | Finance community | Answer "Aave Zinsen" threads |
| Kryptoszene / BTC-Echo tools pages | Editorial tools list | Add to their DeFi-tool roundups |

### ES — `/es/tasas-aave-apy` (targets: `aave lending`, `aave v3`, KD 41–44)
| Prospect | Type | Angle |
| --- | --- | --- |
| Cointelegraph en Español, Observatorio Blockchain | Editorial | Rate data citation |
| Bit2Me Academy | Academy | Complementary live-data link on their Aave lesson |
| r/CriptoMonedas | Community | Rate comparison answers |

### ID — `/id/apy-aave` (target: `apy adalah`, KD 19)
| Prospect | Type | Angle |
| --- | --- | --- |
| Pintu Academy, Indodax Academy, Pluang blog | Exchange academies | "APY adalah" explainer needs a live example — offer the page |
| Coinvestasi, Blockchain Media Indonesia | Editorial | DeFi yield data source |
| OCBC / Wise finance glossaries | Finance | Long shot; only if they cite external data |

### PT-BR — `/pt-br/taxas-aave-apy`
Livecoins, Portal do Bitcoin, Cointelegraph Brasil, CriptoFacil; plus r/investimentos threads about rendimento em stablecoin.

### JA — `/ja/aave-kinri-apy`
CoinPost, あたらしい経済, Zaif/bitbank blog roundups of DeFi tools.

### IT — `/it/tassi-aave-apy`
Cryptonomist, Criptovaluta.it, Wall Street Italia crypto desk.

### RU — `/ru/stavki-aave-apy`
Forklog, Bits.media, RBC Crypto (data citation only).

### ZH — `/zh/aave-lilv-apy`
鏈新聞 ABMedia, 動區 BlockTempo, 桑幣 Zombit — Taiwan-focused DeFi desks.

## 3. Pitch template (adapt per language)

> Subject: Live Aave V3 rate data for your <topic> article
>
> Hi <name>, I maintain AaveAPY — a free, no-wallet dashboard showing Aave V3/V4 deposit
> and borrow APY across every network, including Merit/Merkl/Brevis incentives and a rate
> simulator. Your article <URL> explains <topic> well but the numbers in it are from
> <date>. If useful, you're welcome to link to <localized URL> as a live-data reference,
> or I can supply a monthly rate snapshot table you can embed. No payment involved.

Rules: one follow-up maximum, never buy links, never use link exchanges or comment spam.

## 4. Asset pack to offer

- Live-rate page per language (this cluster)
- 1200×630 share card: `/og-image-1200x630.jpg`
- Rate-methodology explainer: `docs/rate-calculation.md` (public-facing summary)
- Monthly snapshot table (manual export from the dashboard)

## 5. Tracking

| Date | Market | Prospect | Contact | Status | Result URL |
| --- | --- | --- | --- | --- | --- |
| | | | | | |

Review cadence: monthly, alongside `docs/seo/localized-content-calendar.md`.
Verify acquired links in Search Console > Links, and re-run `semrush--backlink_analysis`
on `aaveapy.com` each quarter.
