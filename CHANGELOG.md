# v4.42.0 — Phase 65 Final Production Integration

- Added runtime Production Integration Audit.
- Added dashboard production-readiness audit panel.
- Audits execution idempotency, PREPARED boundaries, verified outcomes, recovered signals, SELL fail-closed, assistant authority, qualification consistency, risk authority, connection and integrity context.
- Added final static cross-workspace integration checks.
- Preserved all manual final-submit, deterministic risk, accounting and Trusted-promotion boundaries.

# v4.41.0 — Phase 64 Global UI Polish

- Added skip-link and active-workspace focus management.
- Added aria-current navigation and status-region semantics.
- Added sidebar keyboard navigation and shortcut help.
- Added focus-visible styling and improved touch targets.
- Added reduced-motion support.
- Added global error/rejection feedback without assuming execution state.
- Added responsive shell behavior for tablet/mobile widths.
- Preserved all deterministic risk, execution, accounting and trust boundaries.

# v4.40.0 — Phase 63 Verified Wallet Leaderboard

- Replaced heuristic leaderboard performance with verified-outcome aggregation.
- Added verified win rate, closes, net P&L, profit factor and drawdown.
- Added independent-token repeatability and Early Bird/discovery context.
- Added deterministic risk counts and Shadow qualification state.
- Added evidence inspector with Wallet, Shadow and Solscan handoffs.
- Ranking cannot auto-promote Trusted or authorize execution.

# v4.39.0 — Phase 62 Settings & Security Control Center

- Added global settings security/connection health rail.
- Clarified OS-encrypted secret storage and write-only credential handling.
- Surfaced backup/recovery policy and SHA-256 verification doctrine.
- Added backend-enforced typed confirmation for Reset Everything.
- Preserved deterministic risk, degraded-mode and Phase 32 execution authority.
- Added responsive production Settings layout and security doctrine rail.

# v4.38.0 — Phase 61 Padre Pre-Submit Workspace

- Added read-only Padre workspace context IPC.
- Added current-contract and deterministic-risk side panel.
- Added Phase 32 execution safety/status rail.
- Added Phase 45 governed assistant action history.
- Made PREPARED, SUBMITTED_UNVERIFIED, SETTLED and VERIFIED OUTCOME semantics explicit.
- Preserved persistent isolated Padre BrowserView and manual final-submit boundary.
- Automated SELL remains fail-closed.

# v4.37.0 — Phase 60 AI Assistant Operations UI

- Rebuilt AI Assistant as a three-column governed operator workspace.
- Added live evidence/provider/system/audit health strip.
- Surfaced proposals, Safe Preparation and governed pre-submit actions.
- Added second-confirmation action UI and explicit no-submit semantics.
- Added context-only working memory inspection/archive UI.
- Added Phase 47 full logic audit UI and manual runtime audit trigger.
- Preserved deterministic risk and Phase 32 execution authority boundaries.

# v4.36.0 — Phase 59 Events & System Evidence Center

- Unified cross-ledger operational evidence timeline.
- Added execution-attempt, integrity/recovery, connection, observation, qualification, risk and AI evidence aggregation.
- Added source/severity filtering and identifier search.
- Added forensic event inspector and Solscan/Research/Risk/Wallet handoffs.
- Explicitly separated recorded, prepared, submitted-unverified, settled and verified-outcome semantics.
- No new execution or accounting authority.

# v4.35.0 — Phase 58 Risk Forensics UI

- Rebuilt Risk Center around deterministic Risk Engine v3 authority.
- Added explicit PASS / CAUTION / HARD_BLOCK / UNKNOWN doctrine.
- Added full forensic scan inspector with source evidence and component pressure.
- Added non-overridable hard-block, caution and unknown evidence columns.
- Added holder ownership, creator, provenance and Token-2022 evidence surfaces.
- Added detailed deterministic flag trace.
- Added optional Specialized AI risk explanation with subordinate authority.
- Disabled Risk Center Padre handoff while deterministic HARD_BLOCK is active.
- Preserved Phase 32 review/preparation-only execution boundary.
- Corrected displayed V3 component weights to match engine code.

# v4.34.0 — Phase 57 Early Bird Intelligence UI

- Rebuilt Early Bird as a launch-reconstruction evidence workspace.
- Added candidate inspector with retained source-level early-entry events.
- Added launch-anchor source, seconds-after-launch, entry rank, reconstruction confidence, history completeness, and source signatures.
- Added historical entry-price evidence without fabricating unavailable values.
- Relabeled run multiples as observed-run estimates, not historical peak proof.
- Added reconstruction-engine coverage panel.
- Added evidence-limited Specialized AI interpretation.
- Made Shadow-only routing boundary explicit.
- Preserved copycat/spray precision penalties and Pending/Ghost routing behavior.
- No Trusted promotion or live-execution authority added.

# v4.33.0 — Phase 56 Intelligence Operations UI

- Rebuilt Intelligence Center as an auditable Phase 27–29 operations workspace.
- Added full discovery candidate ledger including rejected one-hit and cluster-review records.
- Added independent-token repeatability, entry timing/rank, confidence, positive-run, overlap and cluster-penalty evidence.
- Added selected-candidate evidence inspector with source transaction links.
- Added direct handoff to Shadow Lab for already-routed candidates.
- Added Health and Signal detail inspectors with Wallet/Token handoffs.
- Added recent discovery-run history and Phase 29 learning statistics.
- Preserved SHADOW_READY as paper-test eligibility only.
- Preserved no direct Discovery-to-Trusted path.
- Clarified cluster overlap is correlation evidence, not proof of common control.

# v4.32.0 — Phase 55 Research Center Evidence Workspace

- Rebuilt Research Center into a three-column contract/evidence/authority workspace.
- Added exact-mint vs ticker/name identity distinction.
- Added market state and evidence freshness display.
- Elevated Token-2022 restrictions and mint/freeze authority evidence.
- Added holder concentration, creator candidate, creator holdings, related launches, funder and early-holder overlap evidence.
- Added explicit evidence coverage, limitations and UNKNOWN states.
- Added deterministic PASS / CAUTION / HARD BLOCK decision surface.
- Kept AI visibly subordinate to deterministic safety.
- Clarified provenance is evidence, not identity proof.
- Clarified Padre handoff is manual pre-submit review only.
- No execution or risk-override authority added.

# v4.31.0 — Phase 54 Automation Control Center UI

- Redesigned Trusted automation into a dedicated live-control workspace.
- Elevated emergency pause and master execution state.
- Added system mode, observation, market-pricing, Padre, and Phase 32 safety indicators.
- Added recent execution-state visibility for RESERVED, SUBMITTED_UNVERIFIED, FAILED, BLOCKED, UNCERTAIN_AFTER_PAUSE, and related states.
- Added system live-eligibility gate stack.
- Added per-wallet dynamic qualification and effective execution state.
- Preserved fixed, balance-percent, AI-weighted, and Kelly sizing controls.
- Preserved per-wallet trade size, daily trades, daily loss, concurrent positions, liquidity, FDV, AI confidence, TP/SL, and trailing-stop rules.
- Clarified that AI cannot override deterministic safety.
- Clarified automated SELL remains fail-closed until own-wallet evidence is authoritative.
- No new execution authority added.

# v4.30.0 — Phase 53 Ghost / Shadow Qualification UI

- Redesigned Ghost Mode as the Shadow qualification laboratory.
- Added explicit Pending → Shadow Testing → Qualified → Live Healthy lifecycle presentation.
- Added Warning / Auto-Paused / Requalifying attention states.
- Added promotion-readiness banner and exact deterministic qualification progress.
- Added lot-level original/remaining stake, realized/unrealized P&L, partial exits and source signatures.
- Added source-linked verified outcome ledger with entry/exit transaction evidence.
- Added dynamic rolling health and observation-quality panels.
- Added side-by-side Shadow action ledger and timestamped source transaction evidence.
- Disabled automatic live promotion in the Phase 53 UI; promotion remains explicit.
- Preserved fully-closed/source-verified-only qualification semantics.

# v4.29.0 — Phase 52 Positions & Portfolio Accounting UI

- Rebuilt Positions as a strict multi-layer accounting workspace.
- Added Verified Outcomes ledger sourced from Phase 22 evidence.
- Added Open Shadow lot view with cost basis, remaining stake, partial exits and unrealized marks.
- Added execution-state ledger for PREPARED and Phase 32 attempt states.
- Added Operational/Legacy layer kept separate from verified performance.
- Added entry/exit source transaction links.
- Added verified P&L, marked equity, drawdown, recent trend, wallet attribution and token attribution.
- PREPARED explicitly remains accountingCommitted=false.
- SUBMITTED_UNVERIFIED remains distinct from settlement and realized P&L.
- Added read-only portfolio-accounting IPC contract.

# v4.28.0 — Phase 51 Wallet Management & Qualification UI

- Redesigned Wallet Management as a verified qualification console.
- Removed the old 20-trades / 60%-win-rate promotion hint from wallet detail.
- Added source-verified performance metrics and coverage.
- Added deterministic qualification progress and exact pass/fail/unknown checks.
- Added explicit next unmet qualification requirement.
- Added dynamic qualification state and rolling health.
- Added risk-history counts and recurring risk signals.
- Added Phase 27 discovery provenance and cluster/repeat context.
- Added explicit Requalify in Shadow control for warning/paused/requalifying wallets.
- Trusted promotion review is disabled in the UI until deterministic qualification passes.
- Preserved no-auto-promotion and no-silent-live-resume semantics.

# v4.27.0 — Phase 50 Live Feed & Trade Review UI

- Redesigned Live Feed as a source-first trade review workspace.
- Added chain timestamp, observed timestamp, signal age, and observation latency.
- Added source-signature/recovery visibility.
- Separated transaction execution-price evidence from current market price.
- Added current quote age/quality and degraded-market visibility.
- Split deterministic risk authority from AI advisory opinion.
- Added feed-level explanation of Phase 32 stale/late/recovered/SELL safety states.
- Renamed manual COPY action to PREPARE COPY.
- Added observation-quality and execution-doctrine side panels.
- Preserved backend Phase 32 execution gates and manual Padre final confirmation.

# v4.26.0 — Phase 49 Dashboard Command Center

- Redesigned Dashboard as the CopyGuard operational command center.
- Added verified realized P&L, verified closes, and win-rate metrics.
- Added open Shadow exposure, unrealized marks, and marked equity.
- Added drawdown, recent trend, and top wallet contributor views.
- Added prioritized attention queue for risk, degraded mode, automation pause, and wallet health.
- Added AI provider, assistant, learning, and Phase 47 logic-audit status.
- Added clearer operating-mode, integrity, and observation state.
- Preserved all existing execution, risk, accounting, and IPC authority boundaries.

# v4.25.0 — Phase 48 UI Foundation & Navigation System

- Began production UI/UX phase sequence.
- Grouped sidebar into Operations, Intelligence, Safety & Review, and Tools & System.
- Added persistent compact sidebar.
- Added page breadcrumb, phase badge, and contextual subtitle.
- Added global integrity/network health strip.
- Added Ctrl/Cmd+K quick workspace palette with keyboard navigation.
- Added number-key workspace shortcuts.
- Added responsive shell behavior while preserving existing page IDs and backend contracts.

# v4.24.0 — Phase 47 Assistant Full Logic Audit

- Added runtime full-stack assistant logic audit.
- Audits permission, routing, proposal, preparation, governed-action and memory boundaries.
- Detects impossible assistant execution/submission records.
- Verifies no assistant-created Phase 32 execution attempt.
- Verifies governed-action expiry and bounded assistant state.
- Reports environmental integrity/degraded/pause conditions as warnings.
- Added audit IPC/preload contracts.
- Preserved deterministic risk and Phase 32 execution authority.

# v4.23.0 — Phase 46 Assistant Memory & Project Context

- Added persistent bounded assistant working memory.
- Added decision, investigation, watch-item, working-note and conclusion memory types.
- Added entity-aware/relevance-aware memory retrieval.
- Added freshness and stale-memory markers.
- Added create/update/archive/list/context IPC contracts.
- Memory remains context-only and non-authoritative.
- Current ledgers, blockchain evidence and deterministic safety always override memory.
- Memory cannot authorize actions, promote wallets, enable Trusted or alter risk.

# v4.22.0 — Phase 45 Governed Assistant Actions

- Added OPEN_PADRE_TOKEN and POPULATE_PADRE_DRAFT governed actions.
- Added second explicit confirmation token and five-minute action expiry.
- Added fresh deterministic safety re-check immediately before action.
- Emergency pause, degraded mode and risk hard blocks fail closed.
- BUY draft sizing must be explicitly supplied and positive.
- Assistant SELL draft automation remains disabled.
- Final Padre submit/confirm is never clicked by the assistant.
- Governed actions never call executeTrade or reserve Phase 32 execution attempts.
- Added governed-action audit records and IPC/preload contracts.

# v4.21.0 — Phase 44 Safe Action Preparation

- Added structured Safe Preparation objects for PREPARE requests.
- Added deterministic risk/hard-block validation to preparation.
- Added market/liquidity sizing context without automatic size selection.
- Added TP/SL review context without automatic configuration.
- Added explicit Padre target context with open/populate/submit authority disabled.
- Confirmed proposals now advance to READY_FOR_SAFE_PREPARATION only.
- Added preparation review checklist and authority metadata.
- Added preparation and preview IPC/preload contracts.
- Preserved zero live-execution/configuration/promotion authority.

# v4.20.0 — Phase 43 Portfolio & Performance Assistant

- Added PORTFOLIO_REVIEW assistant route.
- Added source-verified realized Shadow P&L summary.
- Added open Shadow stake, marked equity and unrealized P&L summary.
- Added chronological drawdown and recent-vs-prior trend analysis.
- Added wallet and token P&L attribution.
- Added strongest/weakest contributor views.
- Kept operational position ledgers separate from verified Shadow performance.
- Added portfolio analysis IPC/preload contract.
- Assistant remains read-only.

# v4.19.0 — Phase 42 Closed-Loop Learning Assistant

- Added dedicated LEARNING_REVIEW analysis over Phase 29 closed-loop evidence.
- Added provider/task/recommendation calibration summaries.
- Added recurring-miss detection with minimum-sample enforcement.
- Added adequately sampled risk-signal outcome associations.
- Added verified-outcome linkage and under-sampled evidence reporting.
- Added advisory-only learning proposal records for assistant inspection.
- Preserved local-correlation semantics: no external retraining, threshold mutation, Trusted mutation or execution.
- Added learning analysis/proposal IPC and preload contracts.

# v4.18.0 — Phase 41 Risk Investigation Assistant

- Added deterministic forensic investigation over Risk Engine v3 decisions.
- Added evidence-path tracing for token control, Token-2022, liquidity, holder, creator, turnover, price-move and Early Bird concentration signals.
- Added hard-block, caution and unknown separation.
- Added component ranking and recent risk-decision history/change analysis.
- Preserved conservative semantics: suspicious/wash-like signals are not proof of fraud or manipulation.
- Added risk-investigation IPC/preload contract.
- Assistant cannot clear blocks, alter thresholds, or execute.

# v4.17.0 — Phase 40 Shadow / Ghost Coach

- Added SHADOW_COACH natural-language route and deterministic coaching dossier.
- Added open lot and partial-realization explanations.
- Added recent source-verified closed outcome summaries.
- Added exact qualification needs for sample, coverage, win rate, ROI, profit factor, drawdown and hard-block rate.
- Added closest-to-qualification Shadow ranking.
- Open/partial activity cannot count as completed qualification outcomes.
- Coach remains read-only and cannot promote, enable Trusted, or execute.
- Added Shadow Coach/ranking IPC and preload contracts.

# v4.16.0 — Phase 39 Trade Decision Assistant

- Added TRADE_DECISION natural-language route.
- Added source transaction/event correlation and timestamp/latency analysis.
- Added execution-price vs later/current market-price separation.
- Added wallet analyst and token research correlation.
- Added deterministic risk and Phase 32 live-safety blocker explanation.
- Added matching Phase 28 Trade AI audit evidence as advisory context.
- Automated SELL remains fail-closed without own-wallet holdings evidence.
- Added Trade Decision IPC/preload contract.

# v4.15.0 — Phase 38 Token Research Assistant

- Added a structured token-research assistant dossier over Phase 25/26 evidence.
- Added SPL Token / Token-2022 control and restriction summaries.
- Added authority, holder concentration, creator-candidate, launch/funder, provenance, liquidity, Early Bird, coordination and coverage summaries.
- Preserved explicit UNKNOWN/UNAVAILABLE fields and historical-liquidity limitations.
- Deterministic Risk Engine v3 verdict/hard blocks remain authoritative.
- Added token-research IPC/preload contract.

# v4.14.0 — Phase 37 Wallet Analyst Assistant

- Added deterministic wallet analyst scorecards based on source-verified completed outcomes.
- Added qualification pass/fail breakdown, progress, thresholds, rolling state, drawdown, expectancy, streaks and verified coverage.
- Added recent-vs-prior wallet trend analysis.
- Added risk-behavior summaries and discovery context.
- Added advisory multi-wallet comparison/ranking with sample-quality precedence.
- Open positions and partial realizations remain contextual only and cannot improve qualification.
- Added wallet analyst IPC/preload contracts.
- Preserved no-promotion/no-Trusted-enable/no-execution assistant authority boundaries.

# v4.13.0 — Phase 36 Assistant Action Proposal & Confirmation

- Added persistent assistant action proposals to the assistant ledger.
- Added deterministic validation, ten-minute expiry, confirmation tokens, cancel/confirm lifecycle, and audit events.
- Added proposal UI cards with explicit warnings/blocks.
- Phase 36 supports PREPARE/PADRE proposals only.
- Confirmation is `CONFIRMED_NO_EXECUTION`; it cannot submit a trade or mutate live accounting.
- Added proposal IPC/preload contracts.

# v4.12.0 — Phase 35 Natural-Language Command Router

- Added deterministic natural-language routing across 13 CopyGuard assistant intents.
- Added per-intent evidence-source contracts and permission mapping.
- Added wallet compare, token research, risk explanation, Shadow ranking, discovery, Early Bird, learning, transaction, system-health and Padre-preparation routes.
- Added explicit config-change and live-trade detection that remains governed by the Phase 33/32 authority boundary.
- Added route audit records, confidence, entity extraction, IPC/preload bridge, and UI intent preview.
- AI receives only the routed evidence subset rather than the entire awareness envelope.

# v4.11.0 — Phase 34 System Awareness

- Added structured read-only assistant awareness across 15 CopyGuard evidence domains.
- Added query-targeted wallet/token/address evidence selection and bounded context envelopes.
- Added secret/private-credential scrubbing and explicit UNKNOWN/UNAVAILABLE preservation.
- Added awareness summary/freshness metadata and assistant evidence-source audit metadata.
- Added read-only `assistant-awareness` IPC/preload bridge and workspace status.
- Preserved Phase 32 execution safety and Phase 33 permission boundaries.

# 4.10.0 — Phase 33 AI Assistant Foundation & Architecture

- Added persistent `assistant_state.json` with bounded conversation sessions, messages, statistics, and audit events.
- Added deterministic assistant permission classes: READ, ANALYZE, RECOMMEND, PREPARE, CHANGE_CONFIG, and LIVE_EXECUTION.
- CHANGE_CONFIG and LIVE_EXECUTION fail closed in Phase 33; PREPARE creates no action by itself.
- Added active-provider routing with a safe local fallback when no AI key is configured or a provider call fails.
- Added a dedicated AI Assistant workspace with session switching and pre-model permission preview.
- Assistant model output cannot elevate permissions or directly invoke protected execution/configuration functions.
- Assistant state participates in Phase 30 checksum backup/restore and integrity auditing.

# 4.9.0 — Phase 32 Execution Safety & Full Logic Audit

- Added persistent `execution_safety.json` keyed by authoritative source transaction event.
- Trusted automation reserves each source event exactly once; restart/reconnect cannot auto-submit it again.
- Live signals older than 60 seconds or observed more than 45 seconds late are observation-only.
- BUY automation requires a token-specific quote no older than 120 seconds and rejects degraded cached quote fallback.
- Manual COPY is preparation-only and no longer creates live positions/P&L before user confirmation.
- Padre DOM automation now fails closed when any required control is missing or invalid.
- Emergency pause propagates into the Padre page and is rechecked immediately before final submission.
- Padre submit clicks are recorded as `SUBMITTED_UNVERIFIED`; CopyGuard does not claim blockchain settlement from DOM evidence.
- Automated SELL is fail-closed until authoritative own-wallet fill/holding evidence exists.
- Phase 30 integrity auditing now checks duplicate execution keys and stale reservations.

# 4.8.0 — Phase 31 Connection Health & Degraded Mode

- Added 15-second health monitoring for Helius RPC/WebSocket, DexScreener, Padre, and active AI provider.
- Added FULL/DEGRADED execution mode with fail-closed live execution.
- Added observation-lag, market-age, rate-limit, latency, and service-state diagnostics.
- Added connection-health UI and manual service checks in Settings.

# 4.7.0 — Phase 30 Data Integrity & Recovery

- Added staged, validated JSON persistence with last-known-good `.bak` copies.
- Added corrupt-file quarantine and automatic recovery from valid backup copies.
- Added persistent `data_integrity.json` and cross-ledger integrity audit.
- Broken verified outcome source links are quarantined from learning, never invented or silently deleted.
- Backup schema v2 includes per-file SHA-256 checksums and staged transactional restore.
- Added Integrity & Recovery status and manual audit control to Settings.

# 4.6.0 — Phase 29 Closed-Loop Learning Engine

- Added persistent `closed_loop_learning.json` learning ledger.
- Links fully source-verified Shadow outcomes to prior AI and Risk Engine decisions using exact source signature first, then wallet/token/time evidence.
- Scores specialist recommendation accuracy by task, recommendation, and provider.
- Correlates deterministic risk flags with later verified win/loss, return, and P&L.
- Requires at least 10 verified samples before producing tuning proposals.
- Learning proposals are advisory-only and cannot rewrite deterministic thresholds or enable live trading.
- Added Intelligence Center learning status and proposal summaries.
- Added backup/restore, reset, settings counts, IPC, and preload coverage.

# 4.5.0 — Phase 28 Specialized AI Engine
- Added six evidence-scoped AI specialist contracts.
- Added persistent `ai_decisions.json` audit ledger.
- Trade AI hard-block override remains mandatory.
- Risk AI can explain but cannot change Risk Engine v3 decisions.
- Discovery AI cannot recommend beyond Shadow review.
- Early Bird AI cannot recommend beyond Shadow testing.
- Wallet Qualification AI cannot promote or re-enable live execution.
- Token Research AI consumes structured evidence and limitations.

## 4.4.0 — Phase 27 Wallet Discovery Engine
- Added persistent wallet discovery evidence ledger and lifecycle-managed scanner.
- Added 3-independent-token one-hit-wonder gate.
- Added repeatability, launch timing, reconstruction confidence, observed opportunity and cohort-overlap scoring.
- Added SHADOW_READY / WATCH / WEAK / CLUSTER_REVIEW / ONE_HIT_WONDER gates.
- Added discovery backup/restore and richer Intelligence Center evidence.

## 4.3.0 — Phase 26 Manipulation & Risk Engine

- Upgraded deterministic protection to Risk Engine v3 with PASS / CAUTION / HARD_BLOCK decisions.
- Wired Phase 25 owner, creator, Token-2022, Early Bird and provenance evidence into enforcement.
- Added creator concentration, sniper overlap, repeat-launch/funder and wash-like turnover signals.
- Added explicit UNKNOWN evidence handling and confidence scoring.
- Added persistent `risk_decisions.json` audit ledger with backup/restore coverage.
- Risk Center now surfaces v3 decision counts, creator/owner evidence and unknown limitations.

# Changelog

## 4.2.0 — Phase 25 Token Research Engine
- Added persistent token_research_evidence.json evidence ledger.
- Added Token-2022/SPL program identification, holder-owner resolution, creator origin/history and sampled funding evidence.
- Added creator holdings, related initializeMint launch evidence, Early Bird/top-holder overlap and evidence coverage grading.
- AI Research now receives evidence package v3 and limitations.
- Added Phase 25 Research UI evidence panel and backup/recovery coverage.

## 4.1.0 — Phase 24 Early Bird Reconstruction
- Paginated Helius token-history reconstruction toward launch.
- Actual buyer identity from inbound target-token transfers.
- Pair-created/oldest-chain launch anchors with evidence confidence.
- Transaction-derived USDC/USDT, WSOL and native-SOL entry-price evidence.
- Buyer rank plus seconds-after-launch scoring.
- Persistent reconstruction ledger, lifecycle scheduler, backup/recovery integration.
- Strong repeat candidates continue into Shadow qualification; historical behavior remains separate from verified profitability.

## 4.0.0 — Phase 23 Dynamic Wallet Qualification
- Continuous passive Shadow monitoring for Trusted wallets.
- Rolling health evaluation, warning bands, confirmed auto-pause, and recovery hysteresis.
- Persistent auditable qualification-state ledger.
- Live and Shadow routes run independently for Trusted wallets.

## 3.9.0 — Phase 22 Verified Outcome Engine
- Added persistent source-linked verified outcome ledger and rebuilt qualification metrics from completed outcomes only.
- Added expectancy, breakevens, average winner/loser, payoff ratio, chronological drawdown, streaks and latency integrity.
- Added 100% source-evidence coverage as a qualification requirement.

## 3.8.0 — Phase 21 Shadow Portfolio Engine

- Added transaction-linked Shadow lots with persistent remaining exposure.
- Added proportional partial-sell mirroring from real wallet pre/post token balances.
- Added per-lot realization history and cumulative realized P&L.
- Qualification samples count only fully closed lots.
- Mark-to-market now values only unsold Shadow exposure.
- Added portfolio metrics for open tokens, remaining exposure and partial realizations.

## 3.7.0 — Phase 20 Market & Pricing Engine

- Separates transaction-derived execution price from later/current market quotes.
- Derives token execution price from USDC/USDT, WSOL, or fee-adjusted native SOL balance changes when available.
- Adds a 15-second quote cache and persistent market snapshot ledger.
- Chooses the highest-liquidity Solana base-token pair for current market marks.
- Adds explicit pricing source/confidence and observation latency to Shadow entries.
- Marks open Shadow positions to market every 30 seconds and tracks unrealized P&L/marked equity.
- Adds manual Refresh Market P&L and market status IPCs.
- Includes market_price_ledger.json in backup/restore/reset handling.

## 3.6.0 — Phase 19 Transaction Interpretation Engine

- Added persistent timestamped transaction ledger keyed by Solana signature.
- Linked Shadow buys/sells to exact source transaction/event IDs.
- Added chain-time vs observation-time audit trail.
- Added crash/restart-safe Shadow idempotency checks.
- Added Ghost Mode source transaction log with Solscan links.
- Added transaction ledger to backup/restore.

# Changelog

## 3.5.0 — Phase 18 Unified Helius Observation Engine

- Added one authoritative observation layer for every non-blacklisted monitored wallet.
- Added persistent 20-second Helius RPC recovery polling across the full watchlist.
- Added restart-safe per-wallet cursors and processed-signature retention in `helius_observation.json`.
- Added multi-page missed-transaction recovery (up to 1,000 signatures per wallet per recovery cycle).
- Added oldest-to-newest replay ordering for recovered transactions.
- Enhanced WebSockets now fall back to standard `logsSubscribe` when `transactionSubscribe` is rejected/unavailable.
- Added exponential WebSocket reconnect backoff and heartbeat pings.
- Added bounded four-worker RPC polling to avoid serial watchlist starvation without creating unbounded request bursts.
- Unified WebSocket and RPC events through `ingestObservedTrade()` before downstream Risk/AI/Shadow/Automation logic.
- Observation signatures are remembered before asynchronous downstream processing to prevent WebSocket/poll races.
- Added observation health IPC, Settings diagnostics, and manual poll command.
- Added observation state to backup/restore/reset coverage.
- Preserved Shadow's 30-completed-outcome qualification semantics.

## 3.4.0 — Phase 17 Intelligence Logic Completion
- Fixed dead Wallet Discovery scan path.
- Added evidence-backed discovery and verified health metrics.
- Paginated Early Bird transaction reconstruction with token-inflow buyer identity.
- Routed strong Early Bird candidates into Shadow qualification.
- Integrated holder/provenance/Risk Engine evidence into Research.
- Added specialized evidence-constrained Research AI.

## 3.3.0 — Phase 16

- Added Ghost Trade Qualification Engine with persistent paper-copy ledger.
- Added simulated slippage/fees, P&L, drawdown, ROI, profit factor and qualification thresholds.
- Added Pending → Ghost → Qualified → Trusted/Live workflow.
- Added optional per-wallet auto-live promotion (off by default) plus explicit live promotion.
- Added Ghost workspace, wallet tier, qualification progress and audit ledger.
- Ghost data is included in backups and reset/recovery handling.

# Changelog

## 3.0.0 - Phase 15 production candidate

- Consolidated the 15-phase CopyGuard rebuild into a GitHub-ready repository.
- Fixed secure-secret restart migration so masked placeholders can never replace
  encrypted API credentials.
- Backups now omit masked credential metadata as well as raw credentials.
- Restores strip any credential fields from imported settings and preserve local
  encrypted secrets.
- Hardened the Padre embedded-session permission handler to trusted Padre origins
  and a small permission allowlist.
- Removed obsolete split-screen/sidebar renderer files from the production tree.
- Added repository documentation, validation tooling, CI, and Windows build workflow.
- Promoted application version to 3.0.0.

## 2.13.0 - Phase 14

Settings, security, connection management, backups, restores, scoped resets and
secure credential persistence.

## 2.12.0 - Phase 13

Persistent Notifications + Event Center.

## 2.11.0 - Phase 12

Central Risk & Anti-Manipulation Engine v2.
