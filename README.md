# CopyGuard

## Phase 33 — AI Assistant Foundation & Architecture

CopyGuard v4.42.0 adds a persistent governed AI Assistant workspace with conversation sessions, deterministic permission classification, provider routing, local fallback behavior, and an audit trail. The assistant can read/analyze/recommend conversationally, but configuration mutation and live execution remain outside its authority. Phase 32 execution safety stays authoritative.

## Phase 32 — Execution Safety & Full Logic Audit

CopyGuard v4.9.0 closes the logic-build sequence with a persistent one-shot execution ledger, stale/recovered-signal blocking, fresh token-specific BUY quote requirements, fail-closed Padre DOM automation, emergency-pause race protection, and strict separation between manual preparation, Padre submission, and blockchain confirmation. Automated SELL is intentionally fail-closed until CopyGuard has authoritative own-wallet fill/holding evidence; source-wallet SOL value is not treated as a safe sell quantity.

## Phase 31 — Connection Health & Degraded Mode

CopyGuard v4.8.0 tracks Helius, DexScreener, Padre, AI-provider, observation-lag, market-age, rate-limit, and latency health. Execution-critical outages enter DEGRADED mode and fail closed while observation/recovery continues where possible.

## Phase 30 — Data Integrity & Recovery Engine

CopyGuard v4.7.0 adds atomic-style staged JSON persistence, last-known-good recovery, corrupt-file quarantine, cross-ledger integrity auditing, verified-outcome quarantine for broken evidence, and checksum-verified transactional backup restore. Safe repairs rebuild indexes only; CopyGuard never fabricates missing transaction history or outcomes.


## Phase 29 — Closed-Loop Learning Engine

CopyGuard v4.6.0 correlates source-linked verified Shadow outcomes with prior Specialized AI decisions and deterministic Risk Engine decisions. It scores recommendation accuracy, provider/task calibration, and historical performance of risk signals. Learning is advisory-only: it generates proposals after a minimum sample and never rewrites deterministic thresholds or enables live trading automatically.


CopyGuard is a desktop Solana wallet-monitoring, research, risk-control, and trade-assistance application with a dedicated embedded **Padre Terminal** workspace.

**Version:** 4.10.0 — Phase 58 Risk Forensics UI & Architecture

## What is included

- Dashboard and service-health overview
- Live watched-wallet trade feed
- Wallet profiles and trust tiers
- Positions and P&L tracking
- Trusted-wallet automation profiles with an emergency global pause
- Token Research Center with copycat/provenance checks
- Intelligence Center and wallet leaderboard
- Early Bird repeat-entry discovery engine
- Central deterministic Risk Engine v2 and risk-event ledger
- Persistent Notifications + Event Center
- Secure Settings, connection tests, backups, exports, restore, and scoped resets
- Dedicated Padre Terminal tab with persistent Padre browser session
- Governed AI Assistant workspace with persistent sessions and deterministic permission boundaries

## Phase 18 — Unified Helius Observation Engine

CopyGuard now treats Helius observation as a single reliability layer instead of separate per-feature listeners. Enhanced `transactionSubscribe` is attempted first; when it is unavailable or rejected, CopyGuard falls back to standard `logsSubscribe`. Independently, every non-blacklisted watched wallet is polled through Helius RPC every 20 seconds.

The recovery poll stores a persistent per-wallet cursor and up to 5,000 processed signatures in `helius_observation.json`. If the app sleeps or WebSockets disconnect, it pages through wallet history (up to 10 × 100 signatures per recovery cycle), processes unseen transactions oldest-to-newest, and does not intentionally replay already-seen transactions after restart. New existing wallets baseline at the current chain head so historical transactions are not accidentally sent into live automation; an already-running Shadow profile may replay only transactions at or after its Shadow start time.

The Settings → Connections screen includes observation diagnostics and a manual **Poll All Wallets Now** command. WebSocket events and recovery polling both enter the same normalized trade ingestion path before Risk, AI, Shadow, or Trusted automation logic.

## Requirements for development

- Node.js 20 or newer
- npm
- Internet access for initial dependency installation and live data providers

## Run from source

```bash
npm install
npm test
npm start
```

Windows users can also run `CopyGuard.bat` after installing Node.js.

## Build installers

### Windows

```bash
npm install
npm run dist:win
```

or double-click `BUILD.bat`.

The installer is written to `dist-build/`.

### macOS

```bash
npm install
npm run dist:mac
```

### Linux

```bash
npm install
npm run dist:linux
```

## GitHub build

The repository includes:

- `.github/workflows/ci.yml` — syntax/security-contract validation on pushes and pull requests
- `.github/workflows/build-windows.yml` — manually builds the Windows installer, and also runs for tags beginning with `v`

For a tagged build, push a tag such as `v3.8.0`. The workflow uploads the contents of `dist-build/` as a GitHub Actions artifact. This repository does not include a code-signing certificate; unsigned Windows installers may trigger SmartScreen warnings.

## First launch

1. Open **Settings → Connections**.
2. Add a Helius API key for wallet monitoring and richer Solana data.
3. Optionally add one or more AI-provider keys.
4. Add wallets in **Wallets**. New/discovered wallets should begin as Pending.
5. Open **Padre Terminal** and sign in to Padre if desired. The Padre session uses the persistent `persist:padre` Electron partition.

## Security model

Normal preferences are stored separately from credentials. API credentials are saved through Electron `safeStorage` when supported by the operating system. The renderer only receives masked credential status, and CopyGuard backups deliberately exclude credentials.

CopyGuard starts with global automation disabled and emergency automation pause enabled. Trusted status alone does not activate automated execution. Automated execution additionally requires an enabled per-wallet automation profile and must pass deterministic hard-risk checks.

The Phase 15 migration fix prevents Phase 14 masked placeholders such as `••••A91F` from ever replacing a real encrypted secret during restart.

## Data location

Application data is stored under Electron's per-user `userData` directory in a `copyguard` folder. Use **Settings → Data & Recovery → Open Data Folder** to open the exact location on the current computer.

Persistent stores include wallets, history, open/closed positions, trusted automation profiles, intelligence, Early Bird data, risk events, notifications, research watchlist, and encrypted credentials.

## Padre integration

Padre is a third-party service and its UI/API behavior is outside CopyGuard's control. CopyGuard restricts embedded navigation to Padre domains and limits permission requests from the embedded Padre session. Re-test trading integration after Padre changes its website.

Manual **Copy** actions route the token into Padre and leave final confirmation to the user. Trusted-wallet automation is a separate opt-in system and is disabled by default.

## Important limitations

CopyGuard risk scores and AI assessments are decision-support signals, not guarantees. Wallet behavior does not prove intent, token provenance heuristics do not prove authenticity, and market data can be incomplete or delayed. Automated trading can lose funds rapidly; keep automation disabled until the exact execution path has been tested with your own environment and current Padre UI.

## Repository layout

```text
copyguard-app/
├─ src/
│  ├─ main.js          Electron main process, data engines and IPC
│  └─ preload.js       Narrow renderer bridge
├─ renderer/
│  ├─ app.html         Application shell/workspaces
│  ├─ app.css          UI styling
│  └─ app.js           Renderer controllers
├─ assets/             Application/installer artwork
├─ scripts/
│  └─ validate.js      Static production validation
├─ .github/workflows/  CI and Windows build automation
├─ PHASE-1.md ... PHASE-15.md
└─ package.json
```

## Project history

The current application was rebuilt across 15 phases, moving from a permanent Padre/CopyGuard split-screen into a standalone CopyGuard application where Padre is one dedicated terminal workspace. The `PHASE-*.md` files preserve the build history.

## License

MIT. See `LICENSE`.


## Ghost Trade Qualification (Phase 16)

Pending wallets can be moved into **Ghost Mode** to paper-copy observed BUY/SELL signals using configurable simulated size, slippage and fees. Qualification uses completed sample size, win rate, ROI, profit factor, max drawdown and hard-block rate. Passing wallets become **Qualified**; live activation remains subject to CopyGuard automation, AI, risk and emergency-pause controls. Auto-live is opt-in and disabled by default.


## Phase 26 — Manipulation & Risk Engine

Phase 26 converts the deterministic research package into an enforceable PASS / CAUTION / HARD_BLOCK policy, adds owner/creator/sniper/Token-2022/manipulation rules, an unknown-evidence confidence model, and a persistent risk decision ledger.

## Phase 25 — Token Research Engine
Research now creates a persistent evidence package v3 covering token program type, authority state, holder-owner resolution, creator/origin evidence, sampled creator launch/funder history, provenance, Early Bird overlap, coordination, and explicit evidence limitations before AI review.


## Phase 27 — Wallet Discovery Engine
Repeatability-first wallet discovery rejects one-hit wonders, scores independent early-entry evidence, detects overlapping wallet cohorts, persists discovery decisions, and routes only evidence-backed candidates toward Shadow review.


## Phase 28 — Specialized AI Engine
Six task-specific, evidence-scoped AI contracts with a persistent audit ledger. AI is advisory; deterministic hard blocks and qualification lifecycle rules remain authoritative.


## Phase 34 — System Awareness
The governed AI Assistant now reads a bounded, secret-scrubbed, structured evidence envelope spanning the Phase 18–32 CopyGuard stack. Awareness is read-only and cannot mutate execution, risk, Trusted configuration, or authoritative ledgers.


## Phase 35 — Natural-Language Command Router
Assistant requests are deterministically classified into explicit intents, permissions, and evidence-source contracts before AI reasoning. The router narrows Phase 34 awareness to the relevant subsystem and cannot elevate itself into configuration or live execution authority.


## Phase 36 — Action Proposal & Confirmation
PREPARE requests can become persistent, expiring, evidence-validated proposals. User confirmation approves only the proposal record (`CONFIRMED_NO_EXECUTION`); no live order, Padre submit, accounting mutation, Trusted promotion, or configuration mutation occurs.


## Phase 37 — Wallet Analyst Assistant
The assistant can now inspect and compare CopyGuard wallets using verified closed outcomes, qualification state/checks, Shadow context, risk behavior, discovery evidence, drawdown, expectancy, and recent performance trends. Open/partial activity never improves the qualification sample, and analyst rankings cannot promote or enable Trusted execution.


## Phase 38 — Token Research Assistant
The governed assistant now builds a structured token dossier from Phase 25 research evidence plus Phase 26 deterministic risk: token program controls, authorities, Token-2022 restrictions, holder/creator concentration, launch/funder history, provenance, liquidity, Early Bird overlap, coordination, limitations and unknowns. The Risk Engine verdict remains authoritative.


## Phase 39 — Trade Decision Assistant
Observed signals can now be explained as one correlated decision dossier: source transaction/timestamps, execution pricing vs current market, wallet quality, token research, deterministic risk, Phase 28 Trade AI, and Phase 32 freshness/execution blockers. AI remains advisory and stale signals are never presented as live opportunities.


## Phase 40 — Shadow / Ghost Coach
The assistant now explains open and partial Shadow lots separately from fully closed source-verified outcomes, shows exact qualification checks and remaining requirements, summarizes verified performance/trends, and ranks candidates by closeness to qualification without gaining promotion or execution authority.


## Phase 41 — Risk Investigation Assistant
The assistant can now perform a forensic trace of deterministic risk decisions: hard blocks, cautions, unknowns, evidence-linked flags, component scores, source transactions and recent decision changes. Suspicious or wash-like signals are explicitly not treated as proof, and the assistant cannot clear blocks or change thresholds.


## Phase 42 — Closed-Loop Learning Assistant
The assistant now explains verified-outcome learning: linkage coverage, AI/provider/task accuracy, recommendation calibration, recurring misses, risk-signal performance, under-sampled evidence and improvement proposals. All proposals remain advisory-only and cannot alter thresholds, Trusted state, risk rules or execution.


## Phase 43 — Portfolio & Performance Assistant
The assistant now separates verified realized Shadow outcomes from open marked exposure, computes drawdown and recent trends, attributes P&L by wallet and token, and reports operational position ledgers separately so unverified bookkeeping cannot inflate verified performance.


## Phase 44 — Safe Action Preparation
PREPARE requests can now become structured review objects with deterministic risk evidence, market context, sizing and TP/SL review fields, and Padre target context. Hard blocks remain blocking. No Padre DOM interaction, configuration mutation, promotion, or execution occurs in this phase.


## Phase 45 — Governed Assistant Actions
After two explicit confirmations and a fresh safety re-check, the assistant may navigate Padre to a reviewed token or populate a BUY draft with a user-supplied size. It cannot click final submit, reserve execution, automate SELL, change configuration, or override risk.


## Phase 46 — Assistant Memory & Project Context
Persistent bounded working memory now tracks decisions, investigations, watch items, notes, and conclusions. Memory is explicitly context-only and can never override current blockchain/ledger evidence or deterministic safety.


## Phase 47 — Assistant Full Logic Audit
A runtime audit now verifies the entire Phase 33–46 assistant stack, including permissions, memory authority, proposal/preparation boundaries, governed-action expiry, SELL fail-closed behavior, and the invariant that assistant paths never create Phase 32 execution attempts or submit trades.


## Phase 48 — UI Foundation & Navigation System
The production UI sequence begins with grouped information architecture, a persistent compact sidebar, page breadcrumbs/context, global integrity/network status, a Ctrl/Cmd+K workspace switcher, keyboard navigation, and responsive shell behavior. Existing feature logic and IPC contracts remain unchanged.


## Phase 49 — Dashboard Command Center
The Dashboard is now the operational home screen, combining verified realized performance, open Shadow exposure, drawdown/trends, wallet attribution, risk attention, live activity, qualification state, AI/learning readiness, logic-audit status and service health while preserving strict realized-vs-marked accounting semantics.


## Phase 50 — Live Feed & Trade Review UI
The Live Feed is now source-first: chain time, observed time/latency, transaction execution price, later market price, quote freshness, deterministic risk, AI advice, signature/recovery state, and execution eligibility are visibly separated. Manual COPY is labeled PREPARE COPY and remains preparation-only.


## Phase 51 — Wallet Management & Qualification UI
Wallet Management is now a verified qualification console using the existing Wallet Analyst, Shadow Coach, and Dynamic Qualification engines. It shows exact deterministic pass/fail requirements, verified performance, rolling health, risk history, discovery provenance, and explicit Shadow requalification controls without auto-promoting wallets.


## Phase 52 — Positions & Portfolio Accounting UI
Positions is now split into Verified Outcomes, Open Shadow, Execution States, and Operational records. Verified realized P&L comes only from fully closed source-verified Shadow outcomes; open marks, PREPARED records, SUBMITTED_UNVERIFIED attempts, and legacy operational records remain separate.


## Phase 53 — Ghost / Shadow Qualification UI
Ghost Mode is now the dedicated Shadow qualification lab with lot-level marks, partial exits, verified outcomes, exact deterministic thresholds, rolling dynamic health, source transaction evidence, and explicit requalification/promotion readiness. Automatic live promotion is disabled in the UI.


## Phase 54 — Automation Control Center UI
Trusted automation is now a dedicated live-control workspace with master arming, emergency pause, connection/market/Padre health, dynamic qualification, per-wallet sizing and daily limits, AI gates, exit protection, and recent Phase 32 execution states. Deterministic safety remains authoritative.


## Phase 55 — Research Center Evidence Workspace
Research is now an evidence-first token lab with exact-mint resolution, market evidence, Token-2022 restrictions, authorities, holder concentration, creator/provenance evidence, explicit unknowns, deterministic PASS/CAUTION/HARD BLOCK authority, AI second opinion, and review-only Padre handoff.


## Phase 56 — Intelligence Operations UI
Intelligence Center now exposes Phase 27 repeatability evidence, cluster penalties, one-hit rejection, SHADOW_READY routing, source token appearances, health/risk signals, scan history, and Phase 29 learning evidence in one auditable operations workspace. Discovery never directly grants Trusted status.


## Phase 57 — Early Bird Intelligence UI
Early Bird is now a source-evidence launch reconstruction workspace with actual inbound early-buyer evidence, launch-anchor timing, entry rank, historical entry prices when available, source transaction links, reconstruction confidence, observed-run semantics, AI interpretation, and Shadow-only routing.


## Phase 58 — Risk Forensics UI
Risk Center is now the deterministic safety-forensics workspace: PASS/CAUTION/HARD_BLOCK hierarchy, source evidence, component pressure, explicit UNKNOWNs, holder/creator/provenance/manipulation traces, subordinate AI explanation, and hard-blocked Padre handoff.


## Phase 59 — Events & System Evidence Center
Unified operational evidence timeline across observation, risk, Shadow, automation, execution safety, integrity/recovery, connection health and advisory AI.


## Phase 60 — AI Assistant Operations UI
Phases 33–47 are now surfaced as one governed operator workspace: evidence-aware chat, proposals, Safe Preparation, governed pre-submit actions, context-only memory, and full logic audit visibility.


## Phase 61 — Padre Pre-Submit Execution Workspace
Padre now has a dedicated CopyGuard safety/evidence frame with contract context, deterministic risk, execution states and governed-action history while preserving the manual final-submit boundary.


## Phase 62 — Settings & Security Control Center
Production settings now expose connection/security health, encrypted secret boundaries, automation governance, notification controls, SHA-256 backup/restore, integrity recovery and typed destructive-reset protection.


## Phase 63 — Verified Wallet Performance Leaderboard
Wallet ranking now uses fully closed source-verified outcomes with repeatability, Shadow qualification and deterministic risk context. Ranking never implies Trusted promotion or live execution authority.


## Phase 64 — Global UI Polish
Cross-workspace accessibility, keyboard navigation, focus management, responsive behavior, reduced-motion support, loading/error feedback and final visual consistency polish.


## Phase 65 — Final Production Integration
Final cross-system runtime and static audit across all CopyGuard workspaces, evidence paths, safety boundaries, accounting semantics and governed execution handoffs.
