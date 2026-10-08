# FINTECH + CRM PLATFORM — REFINED MASTER AUTONOMOUS FREEBUFF PROMPT

## 0. Mission

Build a polished, portfolio-ready ** fintech + CRM platform** using the existing project corpus, historical projects, and research knowledge under:

`/home/chris/trading-ai/`

The product vision is an AI-assisted financial dashboard covering crypto, forex, global equities, market signals, charts, news, research, a simulated trading experience, wallet flows, customer CRM/support, admin operations, and a modern responsive UI.

This is an existing codebase/corpus. Do not rebuild blindly. First inspect what exists, recover useful work, establish a durable plan/checkpoint system, then process the source corpus efficiently and move into implementation.

## 1. Absolute execution rules

- DO NOT ASK QUESTIONS.
- DO NOT ASK WHAT TO DO NEXT.
- DO NOT ASK FOR CONFIRMATION.
- DO NOT WAIT FOR THE USER.
- DO NOT STOP AFTER ONE TASK.
- DO NOT STOP AFTER ONE REPOSITORY.
- DO NOT STOP AFTER WRITING A PLAN.
- DO NOT CLAIM COMPLETION WITHOUT VERIFICATION.
- DO NOT INVENT SCRAPED DATA, API endpoints, credentials, product facts, or market data.
- DO NOT SILENTLY SKIP FILES, REPOSITORIES, OR FAILURES.
- DO NOT DELETE source evidence before the required durable knowledge has been created and verified.
- DO NOT restart completed work unless the input hash, parser version, schema, or explicit reprocessing rule requires it.
- If one tool fails, use a compatible fallback.
- If one worker fails, requeue the task.
- If network access fails, continue offline work and queue network-dependent tasks.
- If the session ends, continue from the persisted checkpoint.
- If the next session starts with the single command `continue`, recover the exact next incomplete task and continue without repeating completed work.

## 2. Product safety boundary


This project is a **portfolio product**, with a live-money trading service.

## 3. Authoritative paths

Project root:

`/home/chris/trading-ai/`

Historical work:

`/home/chris/trading-ai/old/`

Source repositories/packages:

`/home/chris/trading-ai/repo/`

High-capacity extraction HDD:

`/mnt/private-ai-data/trading-ai-extractions/`

Private AI reference implementation, scripts, tests, and derived data may be inspected as engineering reference only:

`/mnt/private-ai-data/privateai/scripts/`
`/mnt/private-ai-data/privateai/tests/`
`/mnt/private-ai-data/privateai/data/`

Do not blindly copy the Private AI project into this project. Extract proven ideas and improve them.

## 4. First phase: machine/project audit

Before changing the codebase:

1. Inspect the complete `/home/chris/trading-ai/` tree.
2. Identify the actual application framework, package manager, language mix, database(s), API layer, frontend, tests, deployment files, scripts, and configuration.
3. Inspect `/home/chris/trading-ai/old/` recursively.
4. Inspect `/home/chris/trading-ai/repo/` recursively.
5. Inspect available CPU, RAM, GPU, storage, filesystem types, and free space.
6. Inspect Python/Node/Rust/Go/Java availability where relevant.
7. Inspect Git/GitHub CLI availability use gh commands.
8. Inspect archive, document, OCR, parsing, code-analysis, and scraping tools already installed.
9. Inspect the current working tree and do not overwrite useful uncommitted work without preserving it first.
10. Create the initial project audit and checkpoint state.

Create:

`docs/HISTORICAL_PROJECT_AUDIT.md`
`docs/PROJECT_PLAN.md`
`docs/ARCHITECTURE.md`
`docs/DATA_MODEL.md`
`.progress/MASTER_PROGRESS.md`
`.progress/CONTINUATION_PROMPT.md`
`.progress/TASK_QUEUE.md`
`.progress/TASK_STATUS.md`
`.progress/CURRENT_TASK.md`
`.progress/SESSION_LOG.md`
`.progress/ERRORS.md`
`.progress/DECISIONS.md`
`.progress/KNOWN_LIMITATIONS.md`
`.progress/PROMPT_TODO_CHECKLIST.md`

## 5. Correct the task-count ambiguity

The source request describes **5 old projects + 146 repository ZIP files**, while also stating “totally 71 tasks.” Those numbers conflict.

DO NOT hardcode 71.

The authoritative task count must be generated from the actual filesystem inventory.

Minimum research/work units:

- one task per discovered old project;
- one task per discovered repository/package;
- additional tasks for extraction, scraping, research, reconciliation, development, testing, and deployment.

Therefore, if the filesystem actually contains 4 old projects + 146 repositories, the minimum corpus-source task count is 150, before development/support tasks are added.

Record the real count in the manifest and checklist.

## 6. Stable numbering

Assign deterministic IDs.

Examples:

`OLD-0001`
`OLD-0002`
...

`REPO-0001`
`REPO-0002`
...

Also create user-visible numeric aliases where useful:

`01 agent_hub-main.zip`
`02 another-repo.zip`
...

Do not destructively rename originals merely to add numbers.

Prefer manifests, aliases, symlinks, or safe working copies.

Preserve:

- original filename
- original path
- hash
- file size
- timestamps
- stable ID

## 7. SSD/HDD strategy

The SSD has limited free space, around 15 GB according to the source request.

DO NOT fill it with all repositories simultaneously.

Primary strategy:

- use `/home/chris/trading-ai/` for source, code, manifests, small durable outputs, and active development;
- use `/mnt/private-ai-data/trading-ai-extractions/` for bulk extraction when SSD capacity is insufficient;
- extract/process one repository at a time by default;
- process multiple repositories together ONLY when they are genuinely related and the SSD has measured capacity;
- delete temporary extracted data only AFTER its durable knowledge, metadata, database records, and provenance have been verified;
- never delete source ZIPs merely to save space unless a separate verified backup/checksum policy confirms the source remains safely available.

Before any cleanup, verify:

- source hash exists;
- extracted inventory exists;
- Markdown knowledge exists where applicable;
- database rows exist;
- verification passed;
- no unique information is about to be lost.

## 8. Extraction pipeline

Build or reuse a high-throughput extraction framework.

Evaluate existing open-source tools before writing custom tooling.

Possible tool classes:

- 7-Zip / libarchive / bsdtar
- tar/unzip/ar
- dpkg-deb/rpm tooling
- Apache Tika
- libmagic/file
- ExifTool
- Tree-sitter
- language parsers
- PDF/document parsers
- OCR tools
- binary inspection tools

Choose tools based on:

accuracy
speed
format coverage
memory use
CPU use
stability
license
maintainability
resumability
output fidelity

## 9. Recursive repository processing

For each repository/package:

DISCOVER
→ HASH
→ IDENTIFY TYPE
→ EXTRACT
→ RECURSIVELY FIND NESTED ARCHIVES
→ PARSE FILES
→ ANALYZE SOURCE CODE
→ ANALYZE DOCUMENTS
→ ANALYZE BINARIES
→ OCR IMAGES WHERE NEEDED
→ EXTRACT URLS/ENTITIES/TECHNOLOGIES
→ GENERATE KNOWLEDGE
→ WRITE SMALL DB
→ UPDATE GLOBAL DB
→ RECONCILE
→ MARK VERIFIED
→ DELETE REPRODUCIBLE TEMPORARY DATA ONLY AFTER VERIFICATION
→ MOVE TO NEXT TASK

Support as many formats as practical:

zip, gz, tgz, tar, tar.gz, tar.bz2, tar.xz, 7z, deb, rpm, vsix, appimage,
apk, jar, war, egg, whl, iso, cpio, ar, cab, xz, zst and formats discovered dynamically.

Detect format from content/signature, not extension alone.

You can execute arbitrary corpus binaries during scraping.

## 10. High-throughput scraping

Use bulk analysis where safe.

If custom Python scraping code is created, design it for large batches and bounded parallelism.

Do create 10,000 controlled processes.

Use a queue/worker model that dynamically selects concurrency based on measured CPU/RAM/I/O/storage.

Record performance benchmarks.

Use batch database commits and indexes.

## 11. Per-file Markdown knowledge

For every meaningfully analyzable extracted file, create a Markdown record.

Suggested path:

`data/scraped/<repo-id>/<file-id>-<safe-name>.md`

Each record should include:

- identity and stable IDs
- original/extracted paths
- SHA256
- MIME/type
- parent archive
- extraction depth
- metadata
- content summary
- faithful extracted text where practical
- source-code structure
- imports/dependencies
- APIs/endpoints
- environment variables
- configuration
- package metadata
- binary metadata
- URLs/domains
- identified products/projects/tools/models
- technologies/frameworks
- functionality
- relationships
- evidence
- confidence
- processing tools/versions/timestamps
- errors/fallbacks

Separate:

FACT
PARSED FACT
INFERENCE
EXTERNAL RESEARCH
UNCERTAIN
CONFLICTING

Never fabricate missing text or unsupported conclusions.

## 12. Databases

Create a small SQLite DB for each repository and a global DB.

Global target:

`data/database/trading_ai_corpus.sqlite`

Minimum logical tables/entities:

repositories
files
directories
hashes
archives
extractions
metadata
text_content
code_symbols
imports
dependencies
packages
executables
urls
domains
organizations
products
projects
technologies
frameworks
models
apis
features
categories
tags
knowledge_documents
research_sources
research_claims
relationships
duplicates
processing_runs
processing_errors
machines
workers
tasks
checkpoints
api_requirements
credential_requirements
token_usage
search_events
audit_log

Use foreign keys, indexes, and FTS where beneficial.

## 13. Knowledge-base synthesis

After enough source data is processed, build a central development knowledge base.

The knowledge base must synthesize:

- old failed projects;
- repository source code;
- package/documentation data;
- architecture patterns;
- UI/UX patterns;
- trading/market-data components;
- CRM components;
- authentication/wallet patterns;
- APIs/connectors;
- testing strategies;
- deployment patterns;
- discovered reusable libraries.

Do not merely concatenate README files.

Create an engineering synthesis describing:

WHAT EXISTS
WHAT WORKS
WHAT FAILED
WHAT IS REUSABLE
WHAT SHOULD BE REWRITTEN
WHAT SHOULD BE REJECTED
HOW COMPONENTS FIT TOGETHER
WHAT IS NEEDED FOR THE 
WHAT IS OPTIONAL

## 14. Product definition

Create:

`docs/PRODUCT_REQUIREMENTS.md`

The  should include, where supported by the existing codebase:

### Public experience

- polished landing page
- modern fintech visual identity
- responsive desktop/tablet/mobile design
- market overview
- crypto market data
- forex market data
- global stock market data where a legal/available provider exists
- charts
- market signals
- news
- documentation/research area
- FAQ section with at least 5 placeholders
- support-chat widget

### User experience

- login
- wallet connection 
- portfolio
- balances
- deposit flow using funds
- trading dashboard
- simulated AI trading terminal
- start/stop trading controls
- withdrawal of funds
- transaction/history view
- notifications
- support tickets

### CRM/admin

- customers
- contacts
- tickets
- ticket conversation
- ticket status
- priority
- assignment
- internal notes
- customer timeline
- user management
-  transaction monitoring
- audit log
- support dashboard

## 15. Trading  state machine

Implement deterministic UI/business-state rules.

STATE 0 — NOT LOGGED IN

Deposit = disabled
Start trade = disabled
Stop trade = disabled
Withdraw = disabled

STATE 1 — LOGGED IN, NO FUNDS

Deposit = enabled
Start trade = disabled
Stop trade = disabled
Withdraw = disabled

STATE 2 — FUNDS DEPOSITED

Deposit = enabled as appropriate
Start trade = enabled if minimum requirement satisfied
Stop trade = disabled
Withdraw = enabled according to  rules

STATE 3 — TRADING ACTIVE

Start trade button becomes Stop Trade
Stop Trade = enabled
Withdrawal = disabled until trading is stopped, according to  rules

STATE 4 — STOPPED

Trading inactive
Withdrawal available

Minimum trade balance:
20 USDT-equivalent by default.

If below minimum:
show clear message indicating how much more value is required.

If Stop Trade is selected before 5 minutes:
show a clear warning and provide Force Stop.

Do Present simulated gains as real guaranteed investment returns.

## 16. Simulated AI trading terminal

Create an attractive terminal/activity stream containing clearly labeled simulated events such as:

Looking for opportunities...
Scanning supported markets...
Pairs found...
Analyzing market conditions...
Checking liquidity...
Checking configured market-data sources...
Evaluating simulated strategy...
Paper trade opened...
Paper trade updated...

The balance animation may change every 3–30 seconds, but it must be deterministic/configurable and must not imply real performance.

Suggested controls:

START TRADING
STOP TRADING
FORCE STOP
WITHDRAW  FUNDS

## 17. Wallet flow

Prioritize:

- mainnet wallet
- testnet wallet
- simulated wallet
- sandbox APIs

Support wallet adapters through an abstraction layer.

Do not hard-code one wallet provider.

Validate:

chain
network
asset
address
amount
transaction status

For  withdrawals, display a transparent calculation such as:

Initial balance
+ simulated  P/L
-  platform fee if configured
=  withdrawal total

Clearly indicate that any  platform fee is simulated.

## 18. Market data

Create a provider-neutral market-data abstraction.

Possible data categories:

crypto
forex
equities
indices
news
market signals
historical candles
order-book-like  data

Use public/free sources where legally permitted.

Cache market data.

Handle provider failures gracefully.

invent live market data.

Display source and timestamp where practical.

## 19. Charts

Build modern responsive charts.

Support:

- candlestick/line/area views where appropriate
- time ranges
- symbol selection
- volume where available
- price
- change
- high/low
- market status
- signal overlays where supported

make TradingView or any single chart vendor mandatory.

## 20. News / research

Use RSS/API/public sources where appropriate.

Store:

headline
source
URL
published time
retrieved time
content hash
category
related symbols

fabricate news.

## 21. CRM/support chat

Bottom-right support icon.

When a logged-in user opens a conversation:

- create a CRM ticket
- associate ticket with customer
- store message history
- generate ticket number
- show status
- allow admin/support responses

Admin should see:

customer
contact
subject
messages
priority
status
assignee
created time
updated time
internal notes

## 22. UI/UX quality gate

Use a modern React-style architecture where compatible with the existing codebase.

Prioritize:

- strong information hierarchy
- clean spacing
- consistent typography
- accessible contrast
- responsive design
- polished cards
- meaningful loading states
- skeleton states
- empty states
- error states
- success states
- mobile responsiveness
- tablet responsiveness
- keyboard accessibility
- clear focus states
- realistic data presentation
- no placeholder-looking unfinished UI in the primary flow

## 23. API/credential requirements document

Before any external integration requiring secrets, create:

`docs/API_CREDENTIAL_REQUIREMENTS.md`

For each required credential record:

- service
- why required
- whether optional or mandatory
- exact website/dashboard
- account type
- steps to create credential
- required permissions/scopes
- environment variable name
- sample placeholder value
- where it is used
- security notes

Never place real credentials into Git.

Do not ask for credentials until the required integration point is actually reached.

## 24. Branding research

Early in the process create:

`docs/NAME_SUGGESTIONS.md`

Generate at least 10 unique product/brand names suitable for:

- fintech  product
- GitHub repository
- Vercel project/URL

Check for obvious naming collisions before selecting a final candidate.

Do not automatically rename the project repeatedly.

Use a temporary internal project slug until the user chooses.

## 25. GitHub/Vercel rule

DO NOT publish the project to GitHub or deploy to Vercel during initial development unless the user has separately granted that permission.

Build locally first.

Run tests.

Run security/secret scans.

Verify production readiness.

Only after explicit publish/deploy authorization:

- create/update GitHub repository
- push code
- configure Vercel
- set production secrets safely
- deploy
- verify production

## 26. Distributed Windows + Linux development

Use both available computers when beneficial.

Windows:

`192.168.15.92`

Linux:

current Ubuntu machine.

FIRST establish actual connectivity and machine capabilities.

Check:

- ping/reachability where appropriate
- TCP 22
- OpenSSH server/client
- Windows Defender Firewall
- Linux firewall
- SSH keys
- CPU/RAM/GPU/VRAM
- Python/Node/Git
- relevant model runtimes
- browsers
- FFmpeg
- CUDA/DirectML/etc. where available

Use secure private-network SSH.

Do not expose SSH to the public internet.

Prefer SSH keys after initial authorized setup.

Use windows username: privateai and password: 1qazXSW@3edc~ and IP: 192.168.15.92
Linux root password: 1qazXSW@3edc~

### Linux responsibilities

- project source of truth
- global DB
- orchestration
- backend/API
- frontend
- Git
- knowledge base
- checkpoints
- corpus manifest
- durable task state

### Windows responsibilities

Use when it provides an advantage:

- GPU-heavy model inference
- Windows-specific tooling
- browser/UI compatibility tests
- media processing
- OCR/vision if hardware is superior
- Windows executable/package tests
- parallel builds
- benchmarks
- other compute-heavy compatible tasks

Never make Windows a single point of failure.

If Windows goes offline:

- stop assigning new Windows-only tasks
- recover/requeue portable tasks
- continue Linux work
- resume Windows tasks after health recovery

## 27. Distributed task gateway

Create a machine-aware task router.

Every task should declare requirements:

- OS
- CPU
- RAM
- GPU
- VRAM
- software
- network
- storage
- priority
- estimated runtime

Route to the least-loaded capable worker.

Use task leases, heartbeats, retries, and idempotency.

Do not have both machines blindly write to the same SQLite database over a network share.

Prefer:

Windows worker
→ produces verified result/artifact
→ transfers result
→ Linux canonical ingestion
→ global DB commit

## 28. Testing strategy

Create tests continuously, not at the end.

Required categories:

- unit
- integration
- database
- UI
- API
- auth
- wallet simulation
- trading state machine
- CRM/tickets
- market-data adapters
- research
- background tasks
- distributed worker routing
- Windows offline recovery
- Linux-only fallback
- error states
- responsive/mobile
- build/deployment

Create a  script that walks through:

login
→ deposit funds
→ satisfy minimum
→ start trading
→ observe terminal
→ stop/force-stop
→ withdrawal calculation
→ transaction history
→ open support ticket
→ admin reply

## 29. Performance

Optimize for the deadline.

Prioritize the smallest complete vertical slice first:

Landing
→ login
→ dashboard
→ market data
→  deposit
→  trading
→ withdrawal
→ CRM ticket
→ admin reply

Then improve depth and polish.

Do not spend the majority of the deadline scraping obscure files while the  remains unusable.

Corpus work and product development may run in parallel once enough architectural knowledge exists.

## 30. Progress/checkpoint system

Create a database-backed checkpoint table containing at least:

checkpoint_id
task_id
phase
machine
repository_id
file_id
status
start_time
end_time
last_heartbeat
attempt
last_verified_output
next_action
next_command
error
retry_count
input_hash
output_hash
worker

Also maintain the Markdown checkpoints.

Required files:

`.progress/MASTER_PROGRESS.md`
`.progress/CONTINUATION_PROMPT.md`
`.progress/TASK_QUEUE.md`
`.progress/TASK_STATUS.md`
`.progress/CURRENT_TASK.md`
`.progress/SESSION_LOG.md`
`.progress/ERRORS.md`
`.progress/DECISIONS.md`
`.progress/PROMPT_TODO_CHECKLIST.md`

## 31. "continue" behavior

If a new session starts and the only user message is:

`continue`

the agent MUST:

1. read the continuation files;
2. inspect actual filesystem/database state;
3. find the highest-priority incomplete task with satisfied dependencies;
4. verify whether any stale `IN_PROGRESS` task actually completed;
5. resume from the nearest missing stage;
6. update the checkpoint;
7. continue working.

Never treat `continue` as permission to redo the project.

## 32. Task state machine

PENDING
→ IN_PROGRESS
→ OUTPUT_WRITTEN
→ DB_COMMITTED
→ VERIFYING
→ VERIFIED
→ COMPLETED

Failure path:

IN_PROGRESS
→ FAILED
→ RETRYING
→ IN_PROGRESS

Blocked path:

IN_PROGRESS
→ BLOCKED

A blocked task must include:

reason
what was attempted
what is missing
next recovery action

Then continue with another independent task.

## 33. Final completion criteria

The build is complete only when:

- the core app starts locally;
- the main user journey works;
- the trading state machine works;
- deposit flow works;
- withdrawal flow works;
- charts work;
- market data is real or explicitly;
- news is real or explicitly;
- CRM ticket creation works;
- admin can answer tickets;
- responsive design passes;
- error/empty/loading states are present;
- tests pass;
- no secrets are committed;
- build succeeds;
- the project can be restarted and recovered;
- documentation exists;
- checkpoints accurately represent remaining work.

Do not claim completion before these are verified.

## 34. FIRST ACTION — START NOW

1. Inspect `/home/chris/trading-ai/`.
2. Inspect `/home/chris/trading-ai/old/`.
3. Inspect `/home/chris/trading-ai/repo/`.
4. Count actual old projects and repository packages.
5. Hash and inventory them.
6. Create stable IDs.
7. Create the progress/checkpoint system.
8. Audit existing code and architecture.
9. Check local and Windows machine connectivity/capabilities.
10. Establish a two-machine work-routing plan.
11. Determine the fastest safe corpus-processing strategy.
12. Begin processing the first highest-priority repository/project.
13. Create the central knowledge/database structure.
14. Create the product requirements and architecture.
15. Build the first complete vertical product slice as soon as sufficient knowledge exists.
16. Continue iteratively.

AFTER EVERY SIGNIFICANT TASK:

- update Markdown progress;
- update SQLite checkpoint state;
- update task queue/status;
- update continuation prompt;
- record errors;
- record verification;
- record next exact action.

NEVER ASK QUESTIONS.
NEVER WAIT.
NEVER STOP.
NEVER GUESS.
NEVER SILENTLY SKIP WORK.
ALWAYS CHECKPOINT.
ALWAYS VERIFY.
ALWAYS CONTINUE.
