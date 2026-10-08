# PRIVATE AI / FINTECH + CRM  — MASTER TODO CHECKPOINT

> Use this file as the human-readable companion to the database checkpoint table. The database is the structured source of task state; this file is the quick visual checklist.

## Status legend

- [ ] PENDING
- [~] IN PROGRESS
- [x] VERIFIED / COMPLETED
- [!] FAILED / NEEDS RETRY
- [B] BLOCKED WITH REASON

## Phase 0 — Environment and recovery foundation

- [ ] 0001 Inspect `/home/chris/trading-ai/`
- [ ] 0002 Inspect `/home/chris/trading-ai/old/`
- [ ] 0003 Inspect `/home/chris/trading-ai/repo/`
- [ ] 0004 Identify framework, package manager, backend, frontend, DB, tests
- [ ] 0005 Inspect Git/GitHub CLI
- [ ] 0006 Inspect Python/Node/Rust/Go/Java as relevant
- [ ] 0007 Inspect CPU/RAM/GPU/VRAM/storage
- [ ] 0008 Inspect archive/parser/OCR/scraping tools
- [ ] 0009 Inspect current Git working tree
- [ ] 0010 Create `.progress/` control plane
- [ ] 0011 Create database checkpoint schema
- [ ] 0012 Create `docs/PROJECT_PLAN.md`
- [ ] 0013 Create `docs/ARCHITECTURE.md`
- [ ] 0014 Create `docs/DATA_MODEL.md`
- [ ] 0015 Create `docs/HISTORICAL_PROJECT_AUDIT.md`

## Phase 1 — Corpus inventory

- [ ] 0101 Count actual old projects
- [ ] 0102 Count actual repository/package artifacts
- [ ] 0103 Generate authoritative total task count
- [ ] 0104 Hash all top-level source artifacts
- [ ] 0105 Detect package/archive formats
- [ ] 0106 Generate `REPO_MANIFEST.json`
- [ ] 0107 Generate `REPO_MANIFEST.csv`
- [ ] 0108 Generate `REPO_INVENTORY.md`
- [ ] 0109 Assign stable `OLD-XXXX` IDs
- [ ] 0110 Assign stable `REPO-XXXX` IDs
- [ ] 0111 Create numeric aliases without damaging originals

## Phase 2 — Historical projects

- [ ] 0201 OLD-0001 audit
- [ ] 0202 OLD-0002 audit
- [ ] 0203 OLD-0003 audit
- [ ] 0204 OLD-0004 audit
- [ ] 0205 Classify historical code KEEP/REUSE/REWRITE/REPLACE/DEPRECATED/BROKEN
- [ ] 0206 Extract reusable architecture
- [ ] 0207 Extract reusable UI/UX patterns
- [ ] 0208 Extract reusable API integrations
- [ ] 0209 Extract reusable CRM patterns
- [ ] 0210 Extract reusable trading/market patterns
- [ ] 0211 Extract reusable deployment/testing patterns
- [ ] 0212 Create historical synthesis

## Phase 3 — SSD/HDD processing

- [ ] 0301 Measure SSD free space
- [ ] 0302 Measure HDD free space
- [ ] 0303 Define SSD temporary/staging policy
- [ ] 0304 Define HDD bulk extraction policy
- [ ] 0305 Create cleanup policy
- [ ] 0306 Verify source-preservation policy
- [ ] 0307 Verify cleanup only happens after database/Markdown verification

## Phase 4 — Repository extraction and scraping

- [ ] 0401 Build/choose extraction framework
- [ ] 0402 Benchmark extraction tools
- [ ] 0403 Build recursive nested-archive discovery
- [ ] 0404 Build file-type detection
- [ ] 0405 Build metadata extraction
- [ ] 0406 Build source-code parsing
- [ ] 0407 Build document parsing
- [ ] 0408 Build binary analysis
- [ ] 0409 Build OCR/image analysis
- [ ] 0410 Build URL/entity/technology extraction
- [ ] 0411 Build per-file Markdown generator
- [ ] 0412 Build per-repository SQLite generator
- [ ] 0413 Build global SQLite ingestion
- [ ] 0414 Build reconciliation
- [ ] 0415 Build duplicate detection

## Phase 5 — Per-repository work units

> Generate one row/task for every actual repository after inventory. Do not hard-code the count.

- [ ] REPO-0001 processed + verified
- [ ] REPO-0002 processed + verified
- [ ] REPO-0003 processed + verified
- [ ] REPO-0004 processed + verified
- [ ] REPO-0005 processed + verified
- [ ] REPO-0006 processed + verified
- [ ] REPO-0007 processed + verified
- [ ] REPO-0008 processed + verified
- [ ] REPO-0009 processed + verified
- [ ] REPO-0010 processed + verified
- [ ] ... generate until every actual repository ID is present ...

## Phase 6 — Central knowledge base

- [ ] 0601 Central corpus schema created
- [ ] 0602 Knowledge entity model created
- [ ] 0603 Technology index created
- [ ] 0604 Product/resource index created
- [ ] 0605 API/source index created
- [ ] 0606 Research source index created
- [ ] 0607 Relationship graph created
- [ ] 0608 Historical + repository synthesis created
- [ ] 0609 Development recommendations generated

## Phase 7 — Product requirements and architecture

- [ ] 0701 Product requirements document
- [ ] 0702 User roles defined
- [ ] 0703 User journey defined
- [ ] 0704 Admin journey defined
- [ ] 0705 Trading  state machine defined
- [ ] 0706 Wallet simulation architecture
- [ ] 0707 Market data architecture
- [ ] 0708 News architecture
- [ ] 0709 Chart architecture
- [ ] 0710 CRM architecture
- [ ] 0711 Authentication architecture
- [ ] 0712 Background-task architecture
- [ ] 0713 Error/recovery architecture

## Phase 8 — Branding

- [ ] 0801 Generate at least 10 product names
- [ ] 0802 Record names in `docs/NAME_SUGGESTIONS.md`
- [ ] 0803 Check obvious naming collisions
- [ ] 0804 Select temporary internal slug
- [ ] 0805 Keep final public name changeable until approved

## Phase 9 — External integrations / credentials

- [ ] 0901 Create `docs/API_CREDENTIAL_REQUIREMENTS.md`
- [ ] 0902 Identify market-data API candidates
- [ ] 0903 Identify news/RSS candidates
- [ ] 0904 Identify wallet candidates
- [ ] 0905 Identify auth requirements
- [ ] 0906 Identify chart providers
- [ ] 0907 Identify optional GitHub/Vercel deployment requirements
- [ ] 0908 Create `.env.example`
- [ ] 0909 Verify `.env*` secret handling

## Phase 10 — Linux + Windows distributed development

- [ ] 1001 Determine Linux IP
- [ ] 1002 Verify Windows `192.168.15.92` reachability
- [ ] 1003 Check TCP 22
- [ ] 1004 Check Windows OpenSSH
- [ ] 1005 Configure Windows SSH server if needed
- [ ] 1006 Inspect Windows Defender Firewall
- [ ] 1007 Add restricted inbound SSH rule if required
- [ ] 1008 Check Linux SSH server
- [ ] 1009 Inspect Linux firewall
- [ ] 1010 Add restricted SSH rule if required
- [ ] 1011 Establish Ubuntu → Windows SSH
- [ ] 1012 Establish Windows → Ubuntu SSH
- [ ] 1013 Create/verify dedicated SSH keys
- [ ] 1014 Create machine registry
- [ ] 1015 Create heartbeat/health mechanism
- [ ] 1016 Create distributed task router
- [ ] 1017 Create worker leases/heartbeat/requeue
- [ ] 1018 Test Windows-off fallback
- [ ] 1019 Test Linux-only continuation
- [ ] 1020 Test Windows recovery

## Phase 11 — Core application vertical slice

- [ ] 1101 App boot/build
- [ ] 1102 Landing page
- [ ] 1103 Auth/login
- [ ] 1104 User dashboard
- [ ] 1105 Market overview
- [ ] 1106 Live/current market data adapter
- [ ] 1107 Charts
- [ ] 1108 News feed
- [ ] 1109  wallet/balance
- [ ] 1110 /deposit
- [ ] 1111 Minimum-balance rule
- [ ] 1112 Start trading
- [ ] 1113 Simulated trading terminal
- [ ] 1114 Animated  balance
- [ ] 1115 Stop trading
- [ ] 1116 Force-stop warning
- [ ] 1117  withdrawal
- [ ] 1118 Transaction history
- [ ] 1119 Notifications/toasts

## Phase 12 — CRM

- [ ] 1201 Customer model
- [ ] 1202 Contact model
- [ ] 1203 Ticket model
- [ ] 1204 Ticket creation from support chat
- [ ] 1205 Ticket conversation
- [ ] 1206 Status/priority
- [ ] 1207 Assignee
- [ ] 1208 Internal notes
- [ ] 1209 Customer timeline
- [ ] 1210 Admin ticket list
- [ ] 1211 Admin reply
- [ ] 1212 Ticket persistence
- [ ] 1213 CRM audit log

## Phase 13 — UI/UX polish

- [ ] 1301 Desktop layout
- [ ] 1302 Tablet layout
- [ ] 1303 Mobile layout
- [ ] 1304 Typography system
- [ ] 1305 Spacing system
- [ ] 1306 Button states
- [ ] 1307 Loading states
- [ ] 1308 Empty states
- [ ] 1309 Error states
- [ ] 1310 Success states
- [ ] 1311 Navigation
- [ ] 1312 Support widget
- [ ] 1313 Accessibility/focus states
- [ ] 1314 Final visual consistency pass

## Phase 14 — Testing

- [ ] 1401 Unit tests
- [ ] 1402 Integration tests
- [ ] 1403 DB tests
- [ ] 1404 Auth tests
- [ ] 1405 Trading state tests
- [ ] 1406 Wallet simulation tests
- [ ] 1407 Market-data tests
- [ ] 1408 CRM/ticket tests
- [ ] 1409 Background worker tests
- [ ] 1410 Responsive/UI tests
- [ ] 1411 Error recovery tests
- [ ] 1412 Windows worker unavailable test
- [ ] 1413 Linux-only fallback test
- [ ] 1414 Full  smoke test
- [ ] 1415 Build verification

## Phase 15 — Security and release readiness

- [ ] 1501 Secret scan
- [ ] 1502 `.env` audit
- [ ] 1503 Dependency audit
- [ ] 1504 Auth/session audit
- [ ] 1505 Wallet boundary audit
- [ ] 1506 /live environment separation audit
- [ ] 1507 Audit logs verified
- [ ] 1508 Public/private repository decision documented
- [ ] 1509 Production/deployment checklist

## Phase 16 — GitHub/Vercel — ONLY AFTER EXPLICIT USER AUTHORIZATION

- [ ] 1601 Final local build
- [ ] 1602 Final tests
- [ ] 1603 Final secret scan
- [ ] 1604 Git diff review
- [ ] 1605 GitHub repository creation/update authorized
- [ ] 1606 Push authorized changes
- [ ] 1607 Vercel configuration
- [ ] 1608 Production env variables
- [ ] 1609 Deploy
- [ ] 1610 Verify production
- [ ] 1611 Record deployment URL

## Phase 17 — Final walkthrough gate

- [ ] 1701 Fresh user can open site
- [ ] 1702 User can log in
- [ ] 1703 User can see market data
- [ ] 1704 User can inspect chart
- [ ] 1705 User can see news
- [ ] 1706 User can deposit funds
- [ ] 1707 UI correctly enables Start Trading
- [ ] 1708 Trading terminal animates
- [ ] 1709 Stop Trade works
- [ ] 1710 Force Stop works
- [ ] 1711 Withdrawal calculation is clear
- [ ] 1712 Withdrawal simulation works
- [ ] 1713 User can open support ticket
- [ ] 1714 Admin can see ticket
- [ ] 1715 Admin can reply
- [ ] 1716 UI works on mobile/tablet/desktop
- [ ] 1717 No console-blocking errors
- [ ] 1718 No broken routes
- [ ] 1719 No secrets exposed
- [ ] 1720  can be explained end-to-end in a walkthrough

# CONTINUAL RECOVERY CHECKPOINT

At every checkpoint update:

- current phase
- current task
- current subtask
- machine
- repository/file
- status
- attempt
- last verified output
- next exact action
- next exact command
- errors
- retry count
- database state
- build/test state
- Git state

When the user starts a fresh session and types:

`continue`

read the persisted state, verify the actual filesystem/database, and continue the first incomplete dependency. Never redo verified work.
