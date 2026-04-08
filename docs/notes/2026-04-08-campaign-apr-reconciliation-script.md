# Campaign APR Reconciliation Report

- Generated at: 2026-04-08T03:56:55.387Z
- API base: https://staging-api.aaveapy.com/api
- Snapshot lastUpdated: 2026-04-08T03:56:05.734Z
- Tolerance: 0.0001pp

## Totals

- all: 30
- plain-match: 11
- capped-required: 10
- needs-data-check: 9
- matched: 18
- not-matched: 12

## Top not-matched rows

| campaignId | chain | token | side | type | category | reason | campaignApr | projectedApr | diff |
|---|---|---|---|---|---|---|---:|---:|---:|
| `15889651832754610062` | Ink | USDe | supply | MAX_REWARD_VALUE_PER_LIQUIDITY_VALUE | needs-data-check | latestTvl<=0 | 3.500000000% | n/a | n/a |
| `14708964836138577048` | Plasma | GHO | supply | DUTCH_AUCTION | needs-data-check | plain-diff-exceeds-tolerance | 3.621978285% | 3.649929921% | +0.027951636pp |
| `14078894403758093874` | Plasma | USDT0 | supply | DUTCH_AUCTION | needs-data-check | plain-diff-exceeds-tolerance | 0.649872968% | 0.654888187% | +0.005015219pp |
| `12054222608540614766` | Ethereum | USDe | supply | MAX_REWARD_VALUE_PER_LIQUIDITY_VALUE | capped-required | max-branch | 3.099855841% | 3.102059355% | +0.002203513pp |
| `4142665379900776771` | Mantle | USDC | supply | DUTCH_AUCTION | needs-data-check | plain-diff-exceeds-tolerance | 2.159662094% | 2.161759648% | +0.002097554pp |
| `1778592639636290926` | Mantle | WETH | supply | DUTCH_AUCTION | needs-data-check | plain-diff-exceeds-tolerance | 1.550345604% | 1.551851364% | +0.001505760pp |
| `9942488449964630984` | Mantle | USDT0 | supply | DUTCH_AUCTION | needs-data-check | plain-diff-exceeds-tolerance | 1.464424934% | 1.465847245% | +0.001422310pp |
| `7900320275654336286` | Mantle | USDT0 | borrow | DUTCH_AUCTION | needs-data-check | plain-diff-exceeds-tolerance | 0.732908888% | 0.733620719% | +0.000711832pp |
| `17479614512326599622` | Mantle | USDC | borrow | DUTCH_AUCTION | needs-data-check | plain-diff-exceeds-tolerance | 0.637428698% | 0.638047796% | +0.000619097pp |
| `14060649811104544450` | Mantle | GHO | supply | DUTCH_AUCTION | needs-data-check | plain-diff-exceeds-tolerance | 5.178780213% | 5.179237854% | +0.000457641pp |
| `3886370444068287679` | Ethereum | RLUSD | supply | MAX_REWARD_VALUE_PER_LIQUIDITY_VALUE | capped-required | max-branch | 3.182359731% | 3.181994960% | -0.000364772pp |
| `4461587008158830948` | Ethereum | RLUSD | supply | MAX_REWARD_VALUE_PER_LIQUIDITY_VALUE | capped-required | max-branch | 2.884558748% | 2.884228111% | -0.000330637pp |

