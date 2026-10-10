# Coinbase knowledge base

Split, de-duplicated reference for integrating **Coinbase** (login, deposits, trading,
withdrawals, and the underlying wallets/payments APIs) into the Veylora app
(`apps/web`). The raw export, `coinbase-api-and-docs.txt`, is a concatenation of
Coinbase Developer Platform (CDP) documentation pages; this directory is that same
content as one file per page — filed under category subfolders — plus a curated map
onto the existing codebase.

- **`docs/<category>/NNN-<slug>.md`** — 163 unique pages, extracted verbatim (deduped
  by content hash), each with a breadcrumb linking back here and to the manifest.
- **`MANIFEST.md`** — auto-generated table of every page, grouped by category.
- **`INTEGRATION.md`** — how each Coinbase product maps onto the **existing** Veylora
  setup (keep what works, add Coinbase alongside) and which Phase 19 task owns it.

Regenerate after a new export:

```bash
python3 scripts/coinbase_extract.py          # split into coinbase/docs/<category> + MANIFEST.md
python3 scripts/coinbase_extract.py --list   # list pages, write nothing
python3 scripts/coinbase_extract.py --check  # assert no live credential leaked
```

## Categories

| Folder | Pages | Covers |
| --- | --- | --- |
| [`docs/platform/`](docs/platform) | 9 | CDP onboarding, authentication/JWT, sandbox, pricing |
| [`docs/wallets/`](docs/wallets) | 17 | Non-custodial wallets, smart accounts, EIP-7702, send/sign, swaps, borrow |
| [`docs/custody/`](docs/custody) | 3 | Custodial wallets (the `coinbase-cdp` custody backend) |
| [`docs/payments/`](docs/payments) | 28 | Deposit destinations, transfers, payment acceptance, webhooks, disbursements |
| [`docs/onramp-offramp/`](docs/onramp-offramp) | 28 | Coinbase-hosted / headless onramp & offramp, quotes, status |
| [`docs/stablecoins/`](docs/stablecoins) | 15 | Custom stablecoins, USDC, stableswapper, swap reference |
| [`docs/auth/`](docs/auth) | 18 | Wallet auth, social login, SIWE, MFA, sessions |
| [`docs/x402/`](docs/x402) | 21 | Machine payments (x402), facilitator, Bazaar |
| [`docs/agents/`](docs/agents) | 5 | Coinbase/Wallet/CDP MCP, agent tooling |
| [`docs/sdk-ui/`](docs/sdk-ui) | 9 | React/RN/Swift components, Next.js, wagmi, viem |
| [`docs/security/`](docs/security) | 10 | Policy engine, EVM/Solana policies, attestation, allowlisting |

## Secret hygiene

The export's header carries **live** CDP credentials (an API key, a secret key, a
private key, entity/subscription ids) and a webhook signing secret. The extractor
reads those values from the source at runtime, **drops** the header block, and
replaces any occurrence elsewhere with `***REDACTED***` — so the generated files are
safe to commit and the script itself contains no secret. `coinbase-api-and-docs.txt`
is git-ignored (`.gitignore`); keep it that way. Runtime credentials belong in
`apps/web/.env` as `CDP_API_KEY_ID` / `CDP_API_KEY_SECRET` / `CDP_WALLET_SECRET`
(plus `COINBASE_WEBHOOK_SECRET` for webhooks) — see
`docs/API_CREDENTIAL_REQUIREMENTS.md`. They never belong in this directory.

> The private key / API secret in the export header should be **rotated** in the CDP
> Portal, since it has been sitting in a plaintext file.

## Where to start

| Goal | Read |
| --- | --- |
| Understand CDP, keys, sandbox vs live | `docs/platform/` — `004` Initial Setup, `005` Authentication, `006` JWT Authentication, `008` Sandbox, `160` Pricing |
| Add **login** | `docs/auth/` — `123` Wallet Authentication, `135` Sign In With Ethereum, `124` Social Login, `139` Session Management |
| Add **deposits** | `docs/onramp-offramp/` + `docs/payments/` — `046`–`072` onramp/offramp, `021`–`025` deposit destinations, `026` transfers |
| Add **trading** | `docs/wallets/` + `docs/payments/` — `110` API Key Wallet, `115` Swaps, `101` Transfers API, `003` Borrow |
| Add **withdrawals** | `docs/onramp-offramp/` + `docs/payments/` — `058`–`067` offramp, `040` disbursements, `062`/`067` status |
| Wire **custody** (already built) | `docs/custody/` + `docs/wallets/` — `016`/`017` custodial wallets, `108` non-custodial, `157` EVM policies |
| Build for **agents/MCP** | `docs/agents/` — `011`–`015`, `084`–`088` |

## Page index

### platform
`004` Initial Setup · `005` Authentication · `006` JWT Authentication ·
`007` Best Practices: API Security · `008` Sandbox · `009` Quickstart ·
`010` Testing with Postman · `160` Pricing · `163` Community and Developer Resources

### wallets
`001` User wallets quickstart · `002` API key wallets quickstart · `003` Borrow ·
`108` Non-Custodial Wallets · `109` Quickstart: User Wallet ·
`110` Quickstart: API Key Wallet · `111` Create & Manage Wallets · `112` Import & Export ·
`113` Send Transactions · `114` Sign Transactions & Messages · `115` Swaps ·
`116` Smart Accounts · `117` EIP-7702 · `118` Spend Permissions ·
`119` Apple Pay (iOS Only) · `120` Cross-Platform (Web, iOS, Android) · `121` Wallet Webhooks

### custody
`016` Custodial Wallets · `017` Custodial Wallets Quickstart · `018` USDC Rewards

### payments
`019` Payments · `020` Metadata · `021` Deposit Destinations ·
`022` Deposit Destinations Quickstart · `023` Fiat Deposit Destinations Quickstart ·
`024` Payment Methods · `025` Payment Methods Quickstart · `026` Transfers ·
`027` Transfer Validation · `028` Example payloads · `029` Transfer Webhooks ·
`030` Verification · `031` Subscriptions · `032` Example payloads ·
`033` Create a recurring report in Portal · `034` Payment Acceptance ·
`035` Payment Acceptance Quickstart · `036` Payment Sessions · `037` Authorization ·
`038` Recurring Payments · `039` Hosted Checkout · `040` Disbursements ·
`041` Payment Acceptance Webhooks · `042` Verification · `043` Webhook Subscriptions ·
`044` Example Payloads · `045` Reports · `161` Transfers Quickstart · `089` Payment Acceptance API

### onramp-offramp
`046` Overview · `047` Quickstart · `048` Onramp: Overview ·
`049` Generating an Onramp URL · `050` Countries & Currencies · `051` Generating Quotes ·
`052` Headless Onramp · `053` Onramp Verification · `054` Limits Upgrade ·
`055` Overview (App2App) · `056` Setup (App2App) · `057` FAQ (App2App) ·
`058` Offramp: Overview · `059` Reference · `060` Countries & Currencies ·
`061` Generating Offramp Quotes · `062` Transaction Status & History ·
`063` One-click-sell Offramp URL · `064` API Reference · `065` Security Requirements ·
`066` Onramp & Offramp Webhooks · `067` Transaction Status & History ·
`068` Onramp Layer 2 Networks · `069` Onramp Supported Payment Methods ·
`070` Onramp Use Cases · `071` Onramp Examples · `072` Onramp FAQ · `162` Coinbase-hosted Onramp

### stablecoins
`093` Custom Stablecoins · `094` Core Concepts · `095` Stablecoin Quickstart ·
`096` Stablecoin Examples · `097` Troubleshooting · `098` Production Readiness ·
`099` Stablecoin Reference · `100` Custom Stablecoin Conversions · `101` Transfers API ·
`102` Stableswapper Quickstart · `103` Key Addresses · `104` Swap Examples ·
`105` Troubleshooting · `106` Production Readiness · `107` Swap Instruction Reference

### auth
`123` Wallet Authentication · `124` Social Login · `125` Google OAuth Configuration ·
`126` Apple OAuth Configuration · `127` X (Twitter) OAuth Configuration ·
`128` Telegram OAuth Configuration · `129` Multi-Factor Authentication (MFA) ·
`130` MFA Enrollment · `131` Handling MFA Prompts · `132` Passkey MFA ·
`133` Customizing MFA Triggers · `134` Request-scoped MFA Verification ·
`135` Sign In With Ethereum · `136` Auth Method Linking · `137` Delegated Signing ·
`138` Implementation Guide · `139` Session Management · `140` Best Practices

### x402
`073` Overview · `074` How x402 works · `075` Quickstart: charge for an endpoint ·
`076` Get discovered (Bazaar) · `077` Charge over MCP · `078` CDP Facilitator ·
`079` Production Configuration · `080` Quickstart: pay for an API ·
`081` Discover services (Bazaar) · `082` Discover & pay over MCP ·
`083` Configure Your x402 Client · `090` x402 Foundation · `091` FAQ ·
`092` Troubleshooting · `122` x402 Payment Protocol

### agents
`011` Overview (choose MCP) · `012` Coinbase MCP · `013` Wallet MCP · `014` CDP MCP ·
`015` CDP Docs MCP · `084` Agentic Accounts · `085` Agentic Wallet ·
`086` Coinbase for Agents · `087` Integrations · `088` Amazon Bedrock AgentCore

### sdk-ui
`141` React Components · `142` React Native Quickstart · `143` Swift Quickstart ·
`144` Next.js Integration · `145` Theming · `146` Wagmi Integration ·
`147` Wallet Standard Integration · `148` viem Compatibility · `149` web3 Compatibility

### security
`150` Security · `151` Domain Allowlisting · `152` First-Party Cookies ·
`153` App Attestation · `154` iOS App Attest · `155` Android Play Integrity ·
`156` Policy Engine · `157` EVM Policies · `158` Solana Policies ·
`159` Solana IDL Policies
