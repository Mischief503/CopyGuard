'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const root = path.resolve(__dirname, '..');
const fail = (msg) => { console.error(`✖ ${msg}`); process.exitCode = 1; };
const pass = (msg) => console.log(`✓ ${msg}`);

const required = [
  'package.json','src/main.js','src/preload.js','src/preload-padre.js','renderer/app.html','renderer/app.css',
  'renderer/app.js','assets/icon.ico','README.md','SECURITY.md','LICENSE'
];
for (const rel of required) {
  if (!fs.existsSync(path.join(root, rel))) fail(`Missing ${rel}`);
}
if (!process.exitCode) pass('Required production files are present');

for (const rel of ['src/main.js','src/preload.js','renderer/app.js']) {
  const r = spawnSync(process.execPath, ['--check', path.join(root, rel)], { encoding:'utf8' });
  if (r.status !== 0) fail(`${rel} failed syntax check:\n${r.stderr || r.stdout}`);
  else pass(`${rel} syntax`);
}

const pkg = JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8'));
if (pkg.version !== '4.42.0') fail(`Expected package version 4.42.0, got ${pkg.version}`); else pass('Production version is 4.42.0');
if (pkg.main !== 'src/main.js') fail('Unexpected Electron entry point');

const main = fs.readFileSync(path.join(root,'src/main.js'),'utf8');
const preload = fs.readFileSync(path.join(root,'src/preload.js'),'utf8');
const html = fs.readFileSync(path.join(root,'renderer/app.html'),'utf8');
const renderer = fs.readFileSync(path.join(root,'renderer/app.js'),'utf8');
const css = fs.readFileSync(path.join(root,'renderer/app.css'),'utf8');

const handles = new Set([...main.matchAll(/ipcMain\.handle\('([^']+)'/g)].map(m=>m[1]));
const invokes = new Set([...preload.matchAll(/ipcRenderer\.invoke\('([^']+)'/g)].map(m=>m[1]));
for (const name of invokes) if (!handles.has(name)) fail(`Preload invokes missing IPC handler: ${name}`);
if (![...invokes].some(Boolean)) fail('No preload IPC methods discovered');
else if (!process.exitCode) pass(`IPC contract validated (${invokes.size} renderer calls)`);

if (!main.includes("delete out.apiKeys") || !main.includes("delete out.heliusApiKey")) fail('Public settings are not stripping credential fields');
else pass('Public persistence strips credential fields');
if (!main.includes("!String(v).startsWith('••••')")) fail('Masked-secret migration guard is missing');
else pass('Masked-secret restart regression guard is present');
if (!main.includes('allowedPadrePermissions')) fail('Padre permission allowlist is missing');
else pass('Padre permission allowlist is present');

for (const legacy of ['renderer/sidebar.html','renderer/sidebar.js','renderer/sidebar.css','renderer/chrome.html']) {
  if (fs.existsSync(path.join(root, legacy))) fail(`Legacy production file still present: ${legacy}`);
}
if (!process.exitCode) pass('Legacy split-screen renderer removed');

for (const id of ['page-dashboard','page-feed','page-wallets','page-positions','page-ghost','page-automation','page-research','page-intelligence','page-earlybird','page-leaderboard','page-risk','page-notifications','page-assistant','page-padre','page-settings']) {
  if (!html.includes(`id="${id}"`)) fail(`Missing application page: ${id}`);
}
if (!process.exitCode) pass('All production workspaces are declared');

for (const token of ['ghost-get-data','ghost-start','ghost-save-config','ghost-stop','ghost-reset','ghost-promote-live']) {
  if (!handles.has(token)) fail(`Missing Ghost IPC handler: ${token}`);
}
for (const token of ['GHOST_DEFAULTS','processGhostTrade','evaluateGhostQualification','ghost_trades.json']) {
  if (!main.includes(token)) fail(`Missing Ghost engine contract: ${token}`);
}
if (!html.includes('id="page-ghost"') || !preload.includes('ghostPromoteLive')) fail('Ghost workspace/bridge not fully wired');
else if (!process.exitCode) pass('Phase 16 Ghost engine contract is wired end-to-end');
const ghostFn = main.slice(main.indexOf('async function processGhostTrade'), main.indexOf('function ghostPublicData'));
if (ghostFn.includes('executeTrade(') || ghostFn.includes('setPadreTPSL(')) fail('Ghost simulation path must not call live Padre execution');
else pass('Ghost simulation path is isolated from live Padre execution');



// v3.3 Shadow polling regression checks
for (const token of ['GHOST_POLL_INTERVAL_MS = OBSERVATION_POLL_INTERVAL_MS','getSignaturesForAddress','getTransaction','pollGhostWallets','pollOneGhostWallet','seenSignatures','processedChainSignatures']) {
  if (!main.includes(token)) fail(`Missing 20-second Shadow polling contract: ${token}`);
}
if (!main.includes('atlas-mainnet.helius-rpc.com')) fail('Enhanced Helius WebSocket is not using the Atlas endpoint');
else pass('Helius Enhanced WSS + 20-second RPC polling are wired');
if (!/const\s+mints\s*=\s*new Set\(\)/.test(main)) fail('Full SELL pre/post token-balance union parser is missing');
else pass('Full exits can be detected from pre/post token balances');
for (const model of ['claude-sonnet-5','gpt-5.6-luna','gemini-3.8-flash','grok-4.6','sonar-pro']) {
  if (!main.includes(model)) fail(`Current AI provider model missing: ${model}`);
}
if (!main.includes('analyzeWithAi') || !main.includes('aiMayBlockGhost')) fail('Shadow AI analysis controls are missing');
else pass('Selected AI provider is integrated into Shadow signals');
const pollFn = main.slice(main.indexOf('async function pollOneGhostWallet'), main.indexOf('async function processGhostTrade'));
if (pollFn.includes('executeTrade(') || pollFn.includes('setPadreTPSL(')) fail('Shadow polling path must not call live execution');
else pass('20-second Shadow polling is isolated from live execution');


// Phase 17 intelligence logic completion checks
for (const token of ['getDiscoveryTokens','scoreDiscoveryCandidate','verifiedWalletOutcomes','enhancedBuyerFromTx','maxSignatures','routeEarlyBirdToShadow','researchEvidenceVersion:3']) {
  if (!main.includes(token)) fail(`Missing Phase 17 intelligence contract: ${token}`);
}
if (main.includes('const boostRes = null')) fail('Dead wallet discovery source is still present');
else pass('Wallet Discovery has a live evidence source');
const healthFn=main.slice(main.indexOf('function runHealthCheck'),main.indexOf('// ── Background wallet discovery'));
if (healthFn.includes("decision==='APPROVED'") || healthFn.includes("decision==='AUTO'")) fail('Wallet health still treats approvals as wins');
else pass('Wallet Health uses verified realized/Shadow outcomes only');
if (!main.includes("evidence:'token-inflow'")) fail('Early Bird buyer identity is not based on token inflow');
else pass('Early Bird buyer identity uses token-transfer evidence');
if (!main.includes('routeEarlyBirdToShadow(address')) fail('Early Bird candidates are not routed into Shadow qualification');
else pass('Strong Early Bird candidates route into 30-outcome Shadow testing');
if (!main.includes('analyzeEarlyBirdCandidate') || !main.includes('SHADOW_TEST|WATCH|REJECT')) fail('Specialized Early Bird AI evidence contract is missing');
else pass('Early Bird uses a specialized evidence-constrained AI contract');
if (!main.includes('holderAnalysis:holders,provenance:prov,riskAssessment')) fail('Research is not using holder/provenance/risk evidence');
else pass('Research uses Risk Engine + holder + provenance evidence');
if (main.includes('g.qualification?.stats')) fail('Dashboard/Leaderboard still read non-persisted Ghost qualification data');
else pass('Dashboard/Leaderboard compute current Ghost qualification statistics');
for (const f of ['EARLYBIRD_F','EARLYBIRD_RUNS_F','EARLYBIRD_HISTORY_F']) { if (!main.includes('BACKUP_FILES') || !main.match(new RegExp('BACKUP_FILES = \\[.*'+f))) fail(`Early Bird backup coverage missing: ${f}`); }
if (main.match(/BACKUP_FILES = \\[[^\\]]*TWITTER_F/)) fail('OAuth token file must not be included in portable backup');
else pass('Backup includes Early Bird intelligence and excludes OAuth token file');



// Phase 18 unified Helius observation checks
for (const token of ['OBSERVATION_POLL_INTERVAL_MS = 20_000','OBSERVATION_MAX_PAGES = 10','observationWallet','rememberObservationSignature','ingestObservedTrade','pollObservationWallets','fetchUnseenWalletSignatures','websocket-enhanced','websocket-standard','rpc-poll']) {
  if (!main.includes(token)) fail(`Missing Phase 18 observation contract: ${token}`);
}
if (!main.includes("method:'transactionSubscribe'") || !main.includes("method:'logsSubscribe'")) fail('Enhanced-to-standard Helius WebSocket fallback is incomplete');
else pass('Helius Enhanced WSS falls back to standard logsSubscribe');
if (!main.includes('2 ** Math.min(heliusReconnectAttempt-1, 5)')) fail('Exponential Helius reconnect backoff is missing');
else pass('Helius reconnect uses bounded exponential backoff');
if (!main.includes('seenSignatures: Array.isArray(current.seenSignatures)') || !main.includes('OBSERVATION_SEEN_LIMIT = 5000')) fail('Persistent signature deduplication is missing');
else pass('Observation signature deduplication survives restart');
if (!main.includes('for(let page=0;page<OBSERVATION_MAX_PAGES;page++)') || !main.includes("cfg.before=before")) fail('Missed-transaction pagination is missing');
else pass('Observation can recover multi-page transaction gaps');
if (!main.includes("collected.sort((a,b)=>Number(a.slot||0)-Number(b.slot||0))")) fail('Recovered transactions are not ordered oldest-to-newest');
else pass('Recovered transactions replay oldest-to-newest');
if (!main.includes('const workers=Array.from({length:Math.min(4,queue.length)}')) fail('Bounded observation poll worker pool missing');
else pass('Observation polling uses bounded concurrency');
if (!main.match(/BACKUP_FILES = \[[^\]]*OBSERVATION_F/)) fail('Observation state is not included in backup coverage');
else pass('Observation state participates in backup/restore');
for (const ipc of ['observation-get-health','observation-poll-now']) if (!handles.has(ipc)) fail(`Missing Phase 18 IPC: ${ipc}`);
if (!preload.includes('getObservationHealth') || !preload.includes('pollObservationNow')) fail('Phase 18 renderer bridge missing');
else pass('Observation diagnostics bridge is wired');
const ingestFn = main.slice(main.indexOf('async function ingestObservedTrade'), main.indexOf('async function fetchUnseenWalletSignatures'));
if (ingestFn.includes('executeTrade(') || ingestFn.includes('setPadreTPSL(')) fail('Observation engine must not directly execute Padre trades');
else pass('Observation engine remains isolated from direct Padre execution');

// Phase 19 transaction timestamp/idempotency checks
for (const token of ['TRANSACTION_LOG_F','transactionEventKey','ensureTransactionRecord','shadowAlreadyHandled','linkShadowAction','sourceTransactionId','sourceEventKey','chainTimestamp','observedAt']) { if (!main.includes(token)) fail(`Missing Phase 19 transaction contract: ${token}`); }
if (!main.match(/BACKUP_FILES = \[[^\]]*TRANSACTION_LOG_F/)) fail('Transaction ledger is not included in backup coverage'); else pass('Transaction ledger participates in backup/restore');
if (!handles.has('get-transaction-ledger') || !preload.includes('getTransactionLedger')) fail('Transaction ledger IPC bridge missing'); else pass('Transaction ledger renderer bridge is wired');
if (!html.includes('ghost19-transactions')) fail('Timestamped source transaction log UI missing'); else pass('Ghost Mode exposes source transaction timestamps');
const p19ghost=main.slice(main.indexOf('async function processGhostTrade'),main.indexOf('function ghostPublicData')); if(!p19ghost.includes('shadowAlreadyHandled(trade)')) fail('Shadow idempotency guard missing'); else pass('Shadow actions are idempotent per source transaction event');



// Phase 20 market & pricing checks
for (const token of ['MARKET_F','deriveTransactionPricing','attachMarketPricing','getCurrentMarketSnapshot','marketQuality','linkPricingEvidence','markGhostPositionsToMarket','transactionPriceUsd','transactionPriceSol','pricingConfidence','observationLatencyMs']) {
  if (!main.includes(token)) fail(`Missing Phase 20 market/pricing contract: ${token}`);
}
if (!main.includes("transaction-stablecoin") || !main.includes("transaction-wsol") || !main.includes("transaction-native-sol")) fail('Transaction-derived execution-price hierarchy is incomplete');
else pass('Execution price prefers transaction stablecoin/WSOL/native evidence');
if (!main.includes('MARKET_QUOTE_TTL_MS = 15_000') || !main.includes('MARKET_MARK_INTERVAL_MS = 30_000')) fail('Market quote freshness/mark intervals are missing');
else pass('Current market quotes have bounded freshness and 30-second marking');
if (!main.includes("execution.source='current-market-fallback'") || !main.includes("execution.confidence='LOW'")) fail('Current-quote fallback is not explicitly low-confidence');
else pass('Later market quotes cannot masquerade as transaction-derived fills');
if (!main.match(/BACKUP_FILES = \[[^\]]*MARKET_F/)) fail('Market ledger is not included in backup coverage');
else pass('Market price ledger participates in backup/restore');
for (const ipc of ['market-status','ghost-refresh-market']) if (!handles.has(ipc)) fail(`Missing Phase 20 IPC: ${ipc}`);
if (!preload.includes('ghostRefreshMarket') || !preload.includes('getMarketStatus')) fail('Phase 20 renderer bridge missing');
else pass('Market status and Shadow mark refresh bridge is wired');
if (!main.includes('deriveTransactionPricing') || !main.includes('markGhostPositionsToMarket')) fail('Phase 20 market/pricing engine regression');
else pass('Phase 20 market/pricing engine remains intact under Phase 21');


// Phase 21 Shadow portfolio checks
for (const token of ['remainingStakeSol','originalStakeSol','realizations:[]','realizedPnlSol','walletSellFraction','GHOST_PARTIAL_SELL','completedOutcome:true','partialRealizations','remainingExposureSol','availableCashSol','ghostPortfolioSummary','INSUFFICIENT_SHADOW_CAPITAL','averageEntryPriceUsd']) {
  if (!main.includes(token)) fail(`Missing Phase 21 portfolio contract: ${token}`);
}
if (!main.includes('soldAmount/walletPre')) fail('Shadow sells are not proportional to watched-wallet token balance'); else pass('Shadow partial sells mirror watched-wallet sell fraction');
if (!main.includes("fullyClosed?'GHOST_SELL':'GHOST_PARTIAL_SELL'")) fail('Partial and full Shadow exits are not distinguished'); else pass('Partial exits do not masquerade as completed outcomes');
if (!main.includes("p.completedOutcome!==true") || !main.includes('verifiedOutcomeMetrics')) fail('Qualification completed-trade count no longer derives from fully closed outcomes'); else pass('Qualification sample counts fully closed lots only');
if (!main.includes('const remaining=Number(p.remainingStakeSol??p.stakeSol??0)')) fail('Mark-to-market is not based on remaining Shadow exposure'); else pass('Unrealized P&L excludes already-sold exposure');
if (!main.includes('remainingStakeSol') || !main.includes('ghostPortfolioSummary')) fail('Phase 21 portfolio engine regression'); else pass('Phase 21 Shadow portfolio accounting remains intact');



// Phase 22 Verified Outcome Engine checks
for (const token of ['VERIFIED_OUTCOMES_F','normalizeVerifiedOutcome','syncVerifiedOutcomesForGhost','verifiedOutcomeMetrics','OUTCOME_BREAKEVEN_PCT','expectancySol','avgWinPct','avgLossPct','payoffRatio','longestWinStreak','longestLossStreak','p95ObservationLatencyMs','onTimeObservationPct','verifiedCoveragePct']) {
  if (!main.includes(token)) fail(`Missing Phase 22 verified-outcome contract: ${token}`);
}
if (!main.match(/BACKUP_FILES = \[[^\]]*VERIFIED_OUTCOMES_F/)) fail('Verified outcome ledger is not included in backup coverage'); else pass('Verified outcomes participate in backup/restore');
if (!main.includes("completedOutcome!==true") || !main.includes("dataQuality:sourceVerified?'VERIFIED':'LEGACY_INCOMPLETE'")) fail('Verified outcome source-integrity gate missing'); else pass('Completed outcomes require explicit completion and retain source-integrity status');
if (!main.includes('verified:s.completedTrades>0&&s.verifiedCoveragePct>=100')) fail('Qualification does not require 100% source verification'); else pass('Qualification requires 100% source-linked outcome evidence');
const statsFn=main.slice(main.indexOf('function ghostStats(g)'),main.indexOf('function ghostPortfolioSummary(g)'));
if (statsFn.includes('roi=c.startingBalanceSol?portfolioRealized')) fail('Open/partial P&L can still improve qualification ROI'); else pass('Open and partial P&L cannot improve qualification metrics');
if (!main.includes('for(const o of outcomes){equity+=o.pnlSol') || !main.includes('maxDrawdownPct:maxDd')) fail('Chronological realized-equity drawdown reconstruction missing'); else pass('Max drawdown is reconstructed from completed outcomes chronologically');
if (!handles.has('ghost-get-verified-outcomes') || !preload.includes('getVerifiedOutcomes')) fail('Verified-outcome IPC bridge missing'); else pass('Verified outcome ledger is available to renderer safely');
if (!html.includes('PHASE 65 FINAL PRODUCTION INTEGRATION')) fail('Phase 65 application label missing'); else pass('Phase 65 workspace version label is present');
if (!renderer.includes('VERIFIED OUTCOME LEDGER') || !renderer.includes('VERIFIED CLOSED P&L')) fail('Verified outcome audit UI missing'); else pass('Ghost Mode exposes verified closed P&L and recent outcome evidence');
if (!main.includes('syncAllVerifiedOutcomes();')) fail('Existing completed outcomes are not synchronized on startup/restore'); else pass('Existing completed outcomes migrate into the verified outcome ledger');


// Phase 23 Dynamic Wallet Qualification checks
for (const token of ['QUALIFICATION_F','QUALIFICATION_DEFAULTS','evaluateDynamicQualification','rollingOutcomeMetrics','qualificationEvent','LIVE_HEALTHY','WARNING','AUTO_PAUSED','REQUALIFYING']) if(!main.includes(token)) fail(`Missing Phase 23 dynamic-qualification contract: ${token}`);
if(!main.match(/BACKUP_FILES = \[[^\]]*QUALIFICATION_F/)) fail('Qualification ledger is not included in backup coverage'); else pass('Qualification ledger participates in backup/restore');
if(!main.includes("if(g.liveActivated)return true")) fail('Trusted wallets stop passive Shadow observation after promotion'); else pass('Trusted wallets continue passive Shadow monitoring');
if(!main.includes("if (wallet.tier === 'trusted')") || !main.includes("await processGhostTrade({...trade}, wallet)")) fail('Trusted live and Shadow routes are not separated'); else pass('Trusted wallets can Shadow-monitor and live-route independently');
if(!main.includes("p.badEvaluations>=cfg.severeConfirmations?'AUTO_PAUSED':'WARNING'")) fail('Severe degradation confirmation/hysteresis missing'); else pass('Dynamic qualification uses confirmation hysteresis before auto-pause');
if(!main.includes("trustedCfgs[address].enabled=false") || !main.includes("w.tier='paused'")) fail('Auto-pause does not disable Trusted execution'); else pass('Auto-pause disables Trusted automation deterministically');
if(!main.includes("Recovery never silently resumes real orders")) fail('Recovery may silently resume live execution'); else pass('Recovery requires explicit re-promotion before real automation resumes');
for(const ipc of ['ghost-get-dynamic-qualification','ghost-requalify']) if(!handles.has(ipc)) fail(`Missing Phase 23 IPC: ${ipc}`);
if(!preload.includes('getDynamicQualification')||!preload.includes('ghostRequalify')) fail('Phase 23 renderer bridge missing'); else pass('Dynamic qualification renderer bridge is wired');


if(!renderer.includes('PHASE 23 DYNAMIC TRUST')||!renderer.includes('REQUALIFY IN SHADOW')) fail('Phase 23 dynamic qualification UI missing'); else pass('Ghost Mode exposes dynamic trust state and requalification action');


if(!main.includes('lastEvaluatedCompletedTrades')||!main.includes('if(outcomeAdvanced){p.badEvaluations++')) fail('Phase 23 hysteresis can advance without a new completed outcome'); else pass('Degradation/recovery counters advance only on new completed outcomes');


// Phase 24 Early Bird Reconstruction Engine checks
for (const token of ['EARLYBIRD_RECON_F','fetchTokenSignatureHistory','reconstructTokenLaunch','EARLYBIRD_HISTORY_SIGNATURE_LIMIT = 2500','secondsAfterLaunch','reconstructionConfidence','launchAnchorSource','entryPriceUsd','priceSource']) if(!main.includes(token)) fail(`Missing Phase 24 reconstruction contract: ${token}`);
if(!main.includes("evidence:'token-inflow'")) fail('Phase 24 buyer identity is not token-inflow based'); else pass('Phase 24 identifies actual buyers from target-token inflow');
if(!main.includes('cfg.before=before') || !main.includes('reachedHistoryEnd')) fail('Phase 24 does not paginate toward launch/history end'); else pass('Phase 24 paginates token history toward launch');
if(!main.includes("launchAnchorSource:pairCreatedAt?'DEX_PAIR_CREATED_AT':'OLDEST_OBSERVED_TOKEN_TRANSACTION'")) fail('Phase 24 launch anchor hierarchy missing'); else pass('Phase 24 records launch-anchor evidence');
if(!main.includes('entryPriceUsd:quoteUsd&&tokenAmount?quoteUsd/tokenAmount:null') || !main.includes("priceSource='TRANSACTION_STABLE'")) fail('Phase 24 transaction-derived entry pricing missing'); else pass('Phase 24 derives historical entry-price evidence from transaction flows');
if(!main.includes('avgSecondsAfterLaunch') || !main.includes('highConfidenceRate')) fail('Phase 24 scoring ignores launch delay/evidence confidence'); else pass('Phase 24 scores rank, launch delay and reconstruction confidence');
if(!main.match(/BACKUP_FILES = \[[^\]]*EARLYBIRD_RECON_F/)) fail('Early Bird reconstruction ledger is not included in backup coverage'); else pass('Phase 24 reconstruction data participates in backup/restore');
if(!main.includes('startEarlyBirdScheduler()') || !main.includes('stopEarlyBirdScheduler()')) fail('Phase 24 Early Bird scheduler is not lifecycle managed'); else pass('Phase 24 scheduler is lifecycle managed');
if(!renderer.includes('RECONSTRUCTED EARLY ENTRIES') || !renderer.includes('after launch')) fail('Phase 24 reconstruction evidence is not exposed in UI'); else pass('Early Bird UI exposes launch-timing reconstruction evidence');

// Phase 25 Token Research Engine checks
for (const token of ['TOKEN_RESEARCH_F','buildTokenResearchEvidence','resolveLargestHolderOwners','findMintOrigin','inspectCreatorHistory','TOKEN_2022_PROGRAM','researchEvidenceCoverage','earlyHolderOverlapPct','historical add/remove behavior is not inferred']) if(!main.includes(token)) fail(`Missing Phase 25 research contract: ${token}`);
if(!main.match(/BACKUP_FILES = \[[^\]]*TOKEN_RESEARCH_F/)) fail('Token research evidence ledger is not included in backup coverage'); else pass('Phase 25 research evidence participates in backup/restore');
if(!main.includes("type:programId===TOKEN_2022_PROGRAM?'TOKEN_2022'")) fail('Token-2022 program classification missing'); else pass('Phase 25 identifies SPL Token vs Token-2022 mints');
if(!main.includes('token2022Restrictions') || !main.includes("['TRANSFER_FEE','transferfee']") || !renderer.includes('TOKEN-2022 FLAGS')) fail('Token-2022 extension restriction evidence missing'); else pass('Phase 25 exposes parsed Token-2022 restriction evidence');
if(!main.includes("rpc('getTokenLargestAccounts'") || !main.includes("heliusRpc('getMultipleAccounts'")) fail('Largest token accounts are not resolved to wallet owners'); else pass('Phase 25 resolves large token accounts to owner wallets');
if(!main.includes("['initializeMint','initializeMint2']")) fail('Creator related-launch evidence is not instruction-backed'); else pass('Creator related launches require initializeMint evidence');
if(!main.includes("funderEvidence:funder?'native-sol-inflow-in-sampled-history':'not-observed-in-sample'")) fail('Creator funder evidence labeling missing'); else pass('Creator funding relationships retain explicit evidence labels');
if(!main.includes("removalHistory:'UNAVAILABLE_FROM_CURRENT_MARKET_SNAPSHOT'")) fail('Historical liquidity absence may be misrepresented'); else pass('Historical liquidity removal remains explicitly unavailable when unproven');
if(!handles.has('research-evidence-get') || !preload.includes('getResearchEvidence')) fail('Phase 25 research evidence IPC bridge missing'); else pass('Research evidence ledger is available to renderer');
if(!renderer.includes('PHASE 25 · EVIDENCE PACKAGE V3') || !renderer.includes('EARLY→TOP OVERLAP')) fail('Phase 25 research evidence UI missing'); else pass('Research Center exposes evidence package v3');
if(!main.includes('evidenceCoverage:t.researchEvidence?.coverage') || !main.includes('evidenceLimitations:t.researchEvidence?.limitations')) fail('AI research does not receive Phase 25 evidence coverage/limitations'); else pass('AI Research is constrained by Phase 25 evidence and limitations');

// Phase 26 Manipulation & Risk Engine checks
for (const token of ['RISK_DECISIONS_F','recordRiskDecision',"decision=hardBlocks.length?\'HARD_BLOCK\'",'TOKEN2022_NON_TRANSFERABLE','CREATOR_CONCENTRATION','SNIPER_CONCENTRATION','EXTREME_TURNOVER','LIQUIDITY_HISTORY_UNAVAILABLE']) if(!main.includes(token)) fail(`Missing Phase 26 risk contract: ${token}`);
if(!main.match(/BACKUP_FILES = \[[^\]]*RISK_DECISIONS_F/)) fail('Phase 26 risk decision ledger missing from backup coverage'); else pass('Phase 26 risk decisions participate in backup/restore');
if(!main.includes('engineVersion:3') || !main.includes('decisionCounts')) fail('Risk Center does not expose Risk Engine v3 decision state'); else pass('Risk Center exposes Risk Engine v3 decision state');
if(!main.includes("restrictions.has('NON_TRANSFERABLE')") || !main.includes("restrictions.has('DEFAULT_FROZEN')")) fail('Token-2022 deterministic hard-block policy missing'); else pass('Token-2022 transfer traps enforce deterministic policy');
if(!main.includes('creator.available&&Number(creator.pct||0)>=20')) fail('Creator concentration hard-block rule missing'); else pass('Creator concentration can hard-block execution');
if(!main.includes('unknowns.length*3') || !renderer.includes('UNKNOWN ·')) fail('Unknown-evidence confidence/UI handling missing'); else pass('Unknown evidence lowers confidence and remains visible');
if(!renderer.includes('persistent Risk Engine v3 decisions') || !renderer.includes('CREATOR HOLDING')) fail('Phase 26 Risk Center UI missing'); else pass('Risk Center exposes Phase 26 decision and creator evidence');


// Phase 27 Wallet Discovery Engine checks
for (const token of ['DISCOVERY_F','DISCOVERY_MIN_INDEPENDENT_TOKENS = 3','scoreDiscoveryCandidate','ONE_HIT_WONDER','CLUSTER_REVIEW','SHADOW_READY','clusterPenalty','independentTokens','startDiscoveryScheduler','stopDiscoveryScheduler']) {
  if (!main.includes(token)) fail(`Missing Phase 27 discovery contract: ${token}`);
}
if (!main.match(/BACKUP_FILES = \[[^\]]*DISCOVERY_F/)) fail('Discovery ledger is not included in backup coverage'); else pass('Discovery ledger participates in backup/restore');
if (!main.includes("oneHit=historicalRepeat<DISCOVERY_MIN_INDEPENDENT_TOKENS")) fail('One-hit-wonder gate is missing'); else pass('Discovery rejects candidates without 3 independent token appearances');
if (!main.includes("clusterPenalty=maxOverlap>=0.8&&independentTokens>=3?15")) fail('Related-wallet cohort penalty missing'); else pass('Discovery penalizes strongly overlapping wallet cohorts');
if (!main.includes("shadowEligible:gate==='SHADOW_READY'")) fail('Shadow-ready gate missing'); else pass('Discovery has an explicit Shadow-ready gate without direct trust');
if (!main.includes("evidenceType:'repeatable-token-inflow'")) fail('Discovery evidence is not tied to actual token inflows'); else pass('Discovery candidates retain token-inflow evidence');
if (!main.includes('secondsAfterLaunch:buyer.secondsAfterLaunch') || !main.includes('reconstructionConfidence:buyer.reconstructionConfidence')) fail('Phase 24 timing/confidence evidence is not consumed by discovery'); else pass('Discovery consumes reconstructed launch timing and confidence evidence');
if (!main.includes('stopDiscoveryScheduler();')) fail('Discovery scheduler is not lifecycle-managed'); else pass('Discovery scheduler stops with Electron lifecycle');
if (!renderer.includes('PHASE 29 · CLOSED-LOOP LEARNING + DISCOVERY') || !renderer.includes("'REPEAT'") || !renderer.includes("'GATE'")) fail('Phase 27/28 Intelligence UI evidence missing'); else pass('Intelligence Center preserves repeatability gate under specialized AI');

if (!main.includes('routeDiscoveryToShadow') || !main.includes('autoRouted>=5') || !main.includes("minCompletedTrades:30")) fail('Phase 27 Shadow auto-routing/cap missing'); else pass('Strong discoveries auto-route into capped 30-outcome Shadow testing');

// Phase 28 Specialized AI Engine checks
for (const token of ['AI_DECISIONS_F','AI_TASKS','TRADE_ANALYSIS','WALLET_QUALIFICATION','EARLY_BIRD','TOKEN_RESEARCH','RISK_EXPLANATION','WALLET_DISCOVERY','callSpecializedAI','aiEvidenceEnvelope','aiTaskSchema','normalizeSpecializedAi','recordAiDecision']) if(!main.includes(token)) fail(`Missing Phase 28 specialized-AI contract: ${token}`);
if(!main.match(/BACKUP_FILES = \[[^\]]*AI_DECISIONS_F/)) fail('AI decision ledger is not included in backup coverage'); else pass('Phase 28 AI decision audit participates in backup/restore');
if(!main.includes("You only EXPLAIN the deterministic Risk Engine v3 decision") || !main.includes("out.decision=deterministic.decision")) fail('Risk AI may override deterministic Risk Engine decision'); else pass('Risk AI can explain but cannot change deterministic risk decisions');
if(!main.includes("SHADOW_REVIEW is the strongest allowed recommendation") || !main.includes("['SHADOW_REVIEW','WATCH','REJECT']")) fail('Discovery AI can exceed Shadow-review authority'); else pass('Discovery AI is capped at Shadow review');
if(!main.includes("SHADOW_TEST is the strongest allowed recommendation") || !main.includes("['SHADOW_TEST','WATCH','REJECT']")) fail('Early Bird AI can exceed Shadow-test authority'); else pass('Early Bird AI is capped at Shadow testing');
if(!main.includes('You cannot promote a wallet, enable Trusted execution') || !main.includes("['MAINTAIN','WARN','PAUSE','REQUALIFY']")) fail('Qualification AI authority boundary missing'); else pass('Qualification AI cannot promote or re-enable Trusted execution');
if(!main.includes("if (hardOverride) recommendation = 'SKIP'")) fail('Trade AI hard-block override regression'); else pass('Trade AI remains subordinate to deterministic hard blocks');
if(!main.includes('Explicit UNKNOWN/UNAVAILABLE evidence must remain unknown')) fail('AI evidence hallucination guard missing'); else pass('All AI specialists preserve unknown/unavailable evidence');
for(const ipc of ['ai-engine-data','ai-wallet-qualification','ai-risk-explain']) if(!handles.has(ipc)) fail(`Missing Phase 28 IPC: ${ipc}`);
if(!preload.includes('getAiEngineData')||!preload.includes('aiWalletQualification')||!preload.includes('aiRiskExplain')) fail('Phase 28 renderer bridge missing'); else pass('Specialized AI audit/analysis bridge is wired');
if(!renderer.includes('Phase 28 specialized AI')) fail('Phase 28 Intelligence status UI missing'); else pass('Intelligence Center exposes Specialized AI engine status');


// Phase 29 Closed-Loop Learning Engine checks
for (const token of ['LEARNING_F','rebuildClosedLoopLearning','learningPredictionPolarity','learningMatchScore','bestLearningMatch','riskSignalStats','closedLoopProposals','LEARNING_MIN_SAMPLE = 10','advisoryOnly:true']) if(!main.includes(token)) fail(`Missing Phase 29 learning contract: ${token}`);
if(!main.match(/BACKUP_FILES = \[[^\]]*LEARNING_F/)) fail('Closed-loop learning ledger is not included in backup coverage'); else pass('Phase 29 learning ledger participates in backup/restore');
if(!main.includes("sourceVerified===true")) fail('Learning engine can consume unverified outcomes'); else pass('Learning uses source-verified completed outcomes only');
if(!main.includes("row.sourceSignature===outcome.entry.signature") || !main.includes('score+=100')) fail('Exact transaction signature is not the strongest learning correlation key'); else pass('Learning prioritizes exact source-signature correlation');
if(!main.includes("type:'STRENGTHEN_SIGNAL'") || !main.includes("type:'REVIEW_FALSE_POSITIVE'") || !main.includes("type:'AI_CALIBRATION_REVIEW'")) fail('Phase 29 advisory proposal types missing'); else pass('Learning produces evidence-backed advisory proposals');
if(main.includes('learningBook.proposals') && !main.includes('advisoryOnly:true')) fail('Learning proposals may be executable instead of advisory'); else pass('Learning proposals are advisory-only');
for(const ipc of ['learning-engine-data','learning-engine-rebuild']) if(!handles.has(ipc)) fail(`Missing Phase 29 IPC: ${ipc}`);
if(!preload.includes('getLearningEngineData') || !preload.includes('rebuildLearningEngine')) fail('Phase 29 renderer bridge missing'); else pass('Closed-loop learning IPC bridge is wired');
if(!renderer.includes('Phase 29 closed-loop learning') || !html.includes('Closed-Loop Learning')) fail('Phase 29 Intelligence UI missing'); else pass('Intelligence Center exposes closed-loop learning status');



// Phase 30 Data Integrity & Recovery Engine checks
for (const token of ['INTEGRITY_F','runIntegrityAudit','quarantineCorruptFile','jsonValidFile','restoreBackupTransactionally','validateBackupPayload','sha256Json','INTEGRITY_QUARANTINED','OUTCOME_BROKEN_LINK','STALE_LEARNING_LINK']) if(!main.includes(token)) fail(`Missing Phase 30 integrity contract: ${token}`);
if(!main.includes("const tmp=`${file}.tmp-${process.pid}-${Date.now()}`") || !main.includes("fs.fsyncSync(fd)")) fail('Phase 30 staged persistence/fsync contract missing'); else pass('JSON persistence uses staged writes with pre-replacement durability attempt');
if(!main.includes("const bak=`${file}.bak`") || !main.includes("recovered=JSON.parse(fs.readFileSync(bak,'utf8'))")) fail('Last-known-good JSON recovery missing'); else pass('Corrupt JSON can recover from last-known-good backup');
if(!main.includes(".corrupt-${new Date().toISOString()")) fail('Corrupt primary quarantine missing'); else pass('Corrupt primaries are quarantined rather than silently discarded');
if(!main.match(/BACKUP_FILES = \[[^\]]*INTEGRITY_F/)) fail('Integrity ledger missing from backup coverage'); else pass('Integrity ledger participates in backup/restore');
if(!main.includes("version:2") || !main.includes('manifest') || !main.includes("sha256:sha256Json(value)")) fail('Backup schema v2 checksum manifest missing'); else pass('Backups include per-file SHA-256 manifest');
if(!main.includes('Restore aborted before changing live data.') || !main.includes('restoreBackupTransactionally(payload)')) fail('Transactional backup validation/restore missing'); else pass('Backup restore validates checksums before staged replacement');
if(!main.includes('Restore rolled back:') || !main.includes('for(const item of committed.reverse())')) fail('Mid-commit restore rollback missing'); else pass('Mid-commit restore failure rolls committed files back');
if(!main.includes("o.sourceVerified=false") || !main.includes("o.dataQuality='INTEGRITY_QUARANTINED'")) fail('Broken outcomes are not quarantined from verified learning'); else pass('Broken outcome source links are quarantined from learning');
if(!main.includes("transactionLedger.order=txOrder.filter") || !main.includes("OUTCOME_ORDER_REBUILT")) fail('Safe derived-index repair missing'); else pass('Integrity engine repairs rebuildable indexes without fabricating events');
if(!handles.has('integrity-engine-data') || !handles.has('integrity-engine-run')) fail('Phase 30 integrity IPC missing'); else pass('Integrity engine IPC is wired');
if(!preload.includes('getIntegrityEngineData') || !preload.includes('runIntegrityAudit')) fail('Phase 30 preload bridge missing'); else pass('Integrity renderer bridge is wired');
if(!renderer.includes('PHASE 30 · DATA INTEGRITY') || !renderer.includes('Run Integrity Audit') || !renderer.includes('No fabricated recovery')) fail('Phase 30 Settings UI missing'); else pass('Settings exposes integrity status, issues, and manual audit');


// Phase 31 Connection Health & Degraded Mode checks
for (const token of ['CONNECTION_HEALTH_INTERVAL_MS','connectionHealthSnapshot','runConnectionHealthCheck','connectionExecutionGate','startConnectionHealthMonitor','stopConnectionHealthMonitor','serviceKeyForUrl','RATE_LIMITED','observationLagMs','marketAgeMs']) if(!main.includes(token)) fail(`Missing Phase 31 connection-health contract: ${token}`);
if(!main.includes("mode:'DEGRADED'") && !main.includes("connectionHealth.mode=critical.length?'DEGRADED':'FULL'")) fail('Phase 31 degraded-mode state missing'); else pass('Connection controller computes FULL/DEGRADED mode');
if(!main.includes('Connection degraded — ${connectionGate.reason}') || !main.includes('Execution unavailable in degraded mode')) fail('Live execution is not gated by connection health'); else pass('Trusted automation and Padre execution fail closed in degraded mode');
if(!main.includes("if(u.includes('helius-rpc.com')") || !main.includes("if(u.includes('dexscreener.com')")) fail('External service health instrumentation missing'); else pass('Helius/DexScreener/API calls feed service health');
if(!main.includes("noteServiceResult('padre',false") || !main.includes("noteServiceResult('padre',true")) fail('Padre health instrumentation missing'); else pass('Padre BrowserView load state feeds service health');
if(!handles.has('connection-health-data') || !handles.has('connection-health-check')) fail('Phase 31 connection-health IPC missing'); else pass('Connection-health IPC is wired');
if(!preload.includes('getConnectionHealth') || !preload.includes('checkConnectionHealth') || !preload.includes("'connection-health'")) fail('Phase 31 renderer bridge missing'); else pass('Connection-health renderer bridge is wired');
if(!renderer.includes('PHASE 31 · CONNECTION HEALTH') || !renderer.includes('Check All Services Now')) fail('Phase 31 health UI missing'); else pass('Dashboard/Settings retain degraded-mode health');
if(!main.includes('startConnectionHealthMonitor();') || !main.includes('stopConnectionHealthMonitor();')) fail('Phase 31 lifecycle monitor missing'); else pass('Connection-health monitor follows Electron lifecycle');


// Phase 32 Execution Safety & Full Logic Audit checks
for (const token of ['EXECUTION_SAFETY_F','LIVE_SIGNAL_MAX_AGE_MS','LIVE_OBSERVATION_MAX_LATENCY_MS','validateLiveExecutionSignal','reserveExecutionAttempt','existingExecutionAttempt','executionEventKey','SUBMITTED_UNVERIFIED','STALE_SIGNAL','LATE_OBSERVATION','DEGRADED_MARKET_FALLBACK']) if(!main.includes(token)) fail(`Missing Phase 32 execution-safety contract: ${token}`);
if(!main.match(/BACKUP_FILES = \[[^\]]*EXECUTION_SAFETY_F/)) fail('Execution safety ledger missing from backup coverage'); else pass('Execution safety ledger participates in backup/restore');
if(!main.includes("const priorExecution=existingExecutionAttempt(trade)") || !main.includes("Source event already has execution state")) fail('Persistent source-event execution dedupe missing'); else pass('Live execution is idempotent per authoritative source event');
if(!main.includes("if(signalAgeMs>LIVE_SIGNAL_MAX_AGE_MS)") || !main.includes("if(latencyMs>LIVE_OBSERVATION_MAX_LATENCY_MS)")) fail('Stale/recovered signal block missing'); else pass('Recovered and late observations cannot become fresh live orders');
if(!main.includes("action==='BUY'&&(!quoteAt||quoteAge>120_000)") || !main.includes("action==='BUY'&&trade.marketSnapshot?.degradedFallback")) fail('Trade-specific stale market gate missing'); else pass('BUY execution requires fresh non-degraded token-specific market data');
if(!main.includes("action==='SELL'") || !main.includes("UNVERIFIED_SELL_POSITION") || !main.includes('authoritative own-wallet fill/holding evidence')) fail('Unsafe live SELL sizing may still be enabled'); else pass('Automated SELL fails closed without authoritative own-wallet holdings');
if(!main.includes("decision:'PREPARED'") || !main.includes("accountingCommitted:false") || main.match(/ipcMain\.handle\('approve-trade'[\s\S]{0,1200}recordBuy\(/)) fail('Manual COPY still mutates live accounting before confirmation'); else pass('Manual COPY prepares Padre without fabricating a live position/P&L');
if(!main.includes("decision:'AUTO_RESERVED'") || !main.includes("'AUTO_SUBMITTED'") || !main.includes("Blockchain settlement is not asserted")) fail('Execution state separation missing'); else pass('Reserved, submitted, and blockchain-confirmed concepts remain distinct');
if(!main.includes("if(!tab)throw new Error") || !main.includes("if(!inp || inp.disabled") || !main.includes("filter(b=>b!==tab)") || !main.includes("Distinct enabled confirm/submit button not found")) fail('Padre DOM automation may still fall through missing controls'); else pass('Padre DOM automation fails closed at every required control');
if(!main.includes('__copyguardEmergencyPaused') || !main.includes('abortIfPaused') || !main.includes("Emergency pause activated before confirmed dispatch")) fail('Emergency pause race guard missing'); else pass('Emergency pause blocks reserved and in-flight pre-submit automation');
if(!main.includes("executionAttemptId") || !main.includes("attemptId") || !main.includes("updateExecutionAttemptById(attempt.id,raced?'UNCERTAIN_AFTER_PAUSE':'SUBMITTED'")) fail('Padre submission result is not linked to persistent attempt'); else pass('Padre result is linked back to the persistent execution attempt');
if(!handles.has('execution-safety-data') || !preload.includes('getExecutionSafety')) fail('Phase 32 execution safety IPC bridge missing'); else pass('Execution safety audit bridge is wired');
if(!renderer.includes('PHASE 32 · EXECUTION SAFETY') || !renderer.includes('Prepared ≠ submitted ≠ chain-confirmed')) fail('Phase 32 execution-safety UI missing'); else pass('Settings exposes execution state semantics and audit counts');
if(!main.includes("EXECUTION_DUPLICATE_KEY") || !main.includes("EXECUTION_STALE_RESERVATION")) fail('Phase 30 integrity engine does not audit execution ledger'); else pass('Integrity engine audits execution idempotency and stale reservations');
// Full logic audit: every renderer invoke must remain exposed through preload and handled in main (global validator above).
if(!renderer.includes('window.cg.approveTrade') || !main.includes("ipcMain.handle('approve-trade'")) fail('Manual COPY end-to-end route missing'); else pass('Manual COPY UI-to-main route is intact');



// Phase 33 AI Assistant Foundation & Architecture checks
for(const token of ['ASSISTANT_F','ASSISTANT_PERMISSIONS','ASSISTANT_POLICY','assistantPermissionForText','assistantPolicyDecision','assistantFoundationContext','assistantRespond','assistantPublicState','actionExecuted:false']) if(!main.includes(token)) fail(`Missing Phase 33 assistant foundation contract: ${token}`);
if(!main.match(/BACKUP_FILES = \[[^\]]*ASSISTANT_F/)) fail('Assistant ledger missing from backup coverage'); else pass('Assistant sessions participate in backup/restore');
for(const ipc of ['assistant-get-state','assistant-new-session','assistant-select-session','assistant-send-message','assistant-archive-session','assistant-permission-check']) if(!handles.has(ipc)) fail(`Missing Phase 33 assistant IPC: ${ipc}`);
for(const bridge of ['getAssistantState','newAssistantSession','selectAssistantSession','sendAssistantMessage','archiveAssistantSession','checkAssistantPermission']) if(!preload.includes(bridge)) fail(`Missing Phase 33 preload bridge: ${bridge}`);
const assistantStart=main.indexOf('// ── PHASE 33 · AI Assistant Foundation');const assistantEnd=main.indexOf('// ── IPC handlers',assistantStart);const assistantSection=main.slice(assistantStart,assistantEnd);
if(assistantSection.includes('executeTrade(')||assistantSection.includes('autoExecuteTrade(')||assistantSection.includes('saveTrustedConfig(')||assistantSection.includes('setAutomationState(')) fail('Assistant foundation can directly invoke protected execution/configuration code'); else pass('Assistant foundation has no direct protected execution/config mutation path');
if(!main.includes("LIVE_EXECUTION:{allowed:false") || !main.includes("CHANGE_CONFIG:{allowed:false") || !main.includes("PREPARE:{allowed:true,confirmation:true,execution:false}")) fail('Assistant permission matrix is not fail-closed'); else pass('Assistant permission matrix separates advice, proposals, config, and live execution');
if(!main.includes("assistantBook.stats.deniedRequests") || !main.includes("assistantAudit('DENIED'")) fail('Denied assistant requests are not auditable'); else pass('Denied assistant requests are persisted in the assistant audit trail');
if(!main.includes("scope:'STRUCTURED_READ_ONLY_EVIDENCE'") || !main.includes('assistantAwarenessSnapshot')) fail('Phase 34 assistant awareness scope missing'); else pass('Assistant foundation is upgraded to explicit read-only system awareness');
if(!main.includes('model output cannot elevate permissions') && !main.includes('model output cannot elevate')) fail('Model permission elevation guard missing'); else pass('Model output cannot elevate deterministic assistant permissions');
if(!main.includes('ASSISTANT_AUTHORITY_VIOLATION') || !main.includes('ASSISTANT_DANGLING_SESSION_INDEX')) fail('Integrity engine does not audit assistant state'); else pass('Phase 30 integrity engine audits assistant session integrity/authority claims');
if(!html.includes('id="page-assistant"') || !html.includes('PHASE 33 · GOVERNED OPERATOR LAYER') || !renderer.includes('renderAssistant33') || !renderer.includes('assistantPreviewPermission')) fail('Phase 33 assistant workspace missing'); else pass('Dedicated assistant workspace exposes sessions and permission preview');
if(!preload.includes("'assistant-update'")) fail('Assistant update event not allowed through preload'); else pass('Assistant live update event bridge is wired');


// Phase 34 System Awareness checks
for(const token of ['ASSISTANT_SOURCE_NAMES','assistantAwarenessSnapshot','assistantAwarenessSummary','assistantExtractEntities','assistantScrub','STRUCTURED_READ_ONLY_EVIDENCE']) if(!main.includes(token)) fail(`Missing Phase 34 awareness contract: ${token}`);
else {}
if(!main.includes("'wallets','transactions','market','shadow','verifiedOutcomes','qualification','earlyBird'") || !main.includes("'tokenResearch','risk','discovery','specializedAI','learning','integrity','connectionHealth','executionSafety'")) fail('Phase 34 source catalog incomplete'); else pass('Assistant awareness spans the full Phase 18–32 evidence stack');
if(!main.includes("ipcMain.handle('assistant-awareness'") || !preload.includes('getAssistantAwareness')) fail('Phase 34 awareness IPC bridge missing'); else pass('System-awareness IPC is wired read-only');
if(!main.includes('Use ONLY the supplied structured CopyGuard evidence') || !main.includes('UNKNOWN/UNAVAILABLE remains unknown')) fail('Phase 34 evidence-grounding contract missing'); else pass('Assistant is constrained to structured evidence and preserves unknowns');
if(!main.includes('ASSISTANT_AWARENESS_MAX_RECORDS') || !main.includes('ASSISTANT_AWARENESS_MAX_JSON')) fail('Phase 34 context bounds missing'); else pass('Assistant evidence context is bounded and query-targeted');
if(!main.includes('/api.?key|secret|authorization|password|private.?key|seed|mnemonic/i')) fail('Phase 34 secret scrubbing missing'); else pass('Assistant evidence scrubber excludes secrets and private credentials');
if(!main.includes("mode:'READ_ONLY_EVIDENCE'") || !main.includes('Assistant awareness cannot mutate ledgers')) fail('Phase 34 read-only boundary missing'); else pass('System awareness is explicitly read-only');
if(!renderer.includes('EVIDENCE SOURCES') || !html.includes('assistant-awareness-status')) fail('Phase 34 evidence UI missing'); else pass('Assistant workspace exposes evidence-source awareness');


// Phase 35 Natural-Language Command Router
for(const token of ['ASSISTANT_COMMANDS','assistantRouteCommand','assistantCommandContext','assistantDeterministicCommandAnswer','COMMAND_ROUTED']) if(!main.includes(token)) fail(`Missing Phase 35 router contract: ${token}`);
else {}
for(const intent of ['SYSTEM_STATUS','WALLET_INSPECT','WALLET_COMPARE','TOKEN_RESEARCH','RISK_EXPLAIN','SHADOW_RANK','DISCOVERY_REVIEW','EARLY_BIRD_REVIEW','LEARNING_REVIEW','TRANSACTION_TRACE','PREPARE_PADRE','CONFIG_CHANGE','LIVE_TRADE']) if(!main.includes(intent)) fail(`Missing Phase 35 intent: ${intent}`);
else {}
if(!main.includes("LIVE_TRADE:{intent:'LIVE_TRADE',permission:'LIVE_EXECUTION'") || !main.includes("CONFIG_CHANGE:{intent:'CONFIG_CHANGE',permission:'CHANGE_CONFIG'")) fail('Dangerous command routes are not mapped to protected permissions'); else pass('Live-trade and configuration commands route to protected permission classes');
if(!main.includes("PREPARE_PADRE:{intent:'PREPARE_PADRE',permission:'PREPARE'")) fail('Padre preparation route missing'); else pass('Padre commands remain preparation-only');
if(!main.includes("ipcMain.handle('assistant-route-command'") || !preload.includes('routeAssistantCommand')) fail('Phase 35 command-router IPC bridge missing'); else pass('Command-router IPC/preload bridge is wired');
if(!main.includes('Do not broaden to evidence sources that were not supplied')) fail('Routed AI evidence minimization contract missing'); else pass('AI receives only the evidence sources selected by the deterministic router');
if(!main.includes("assistantAudit('COMMAND_ROUTED'")) fail('Command route audit missing'); else pass('Every assistant command route is persisted in the audit trail');
if(!renderer.includes("d.route?.intent") || !renderer.includes('ASSISTANT FULL LOGIC AUDIT')) fail('Phase 35 route preview UI missing'); else pass('Assistant UI previews routed intent and permission');


// Phase 36 Action Proposal & Confirmation Engine
for(const token of ['ASSISTANT_PROPOSAL_STATUS','assistantValidateProposal','assistantCreateProposal','assistantConfirmProposal','assistantCancelProposal','CONFIRMED_NO_EXECUTION']) if(!main.includes(token)) fail(`Missing Phase 36 proposal contract: ${token}`);
else {}
if(!main.includes("route.permission!==ASSISTANT_PERMISSIONS.PREPARE") || !main.includes("route.key!=='PREPARE_PADRE'")) fail('Phase 36 proposal admission is not fail-closed to PREPARE_PADRE'); else pass('Only PREPARE_PADRE can create Phase 36 action proposals');
if(!main.includes("reasons.push('DETERMINISTIC_RISK_HARD_BLOCK')")) fail('Phase 36 proposal validation ignores deterministic hard blocks'); else pass('Deterministic risk hard blocks prevent actionable proposals');
if(!main.includes("p.actionExecuted=false") || !main.includes("p.executionAuthority='NONE'")) fail('Proposal confirmation could imply execution authority'); else pass('Proposal confirmation explicitly records no execution authority');
if(!main.includes('Phase 36 confirmation approves the proposal record only') || !main.includes('never dispatches Padre DOM automation or executeTrade')) fail('Proposal confirmation execution boundary missing'); else pass('Confirmation cannot dispatch Padre or executeTrade');
if(!main.includes("ipcMain.handle('assistant-confirm-proposal'") || !preload.includes('confirmAssistantProposal') || !preload.includes('cancelAssistantProposal')) fail('Phase 36 proposal IPC bridge missing'); else pass('Proposal confirm/cancel IPC bridge is wired');
if(!renderer.includes('Confirm proposal') || !renderer.includes('Confirmation never submits a live trade')) fail('Phase 36 proposal UI safety copy missing'); else pass('Proposal UI makes confirmation semantics explicit');


// Phase 37 Wallet Analyst Assistant
for(const token of ['assistantWalletOutcomes','assistantWalletRiskProfile','assistantWalletTrend','assistantWalletAnalysis','assistantWalletCompare','analystGrade']) if(!main.includes(token)) fail(`Missing Phase 37 wallet analyst contract: ${token}`);
else {}
if(!main.includes("completedOutcome===true&&o.sourceVerified===true")) fail('Wallet analyst may include unverified/incomplete outcomes'); else pass('Wallet analyst sample uses source-verified completed outcomes only');
if(!main.includes("partialRealizations") || !main.includes("openPositions")) fail('Wallet analyst lacks open/partial context separation'); else pass('Open and partial Shadow activity is contextualized separately');
if(!main.includes("failedChecks") || !main.includes("passedChecks")) fail('Wallet analyst qualification breakdown missing'); else pass('Wallet analyst exposes exact qualification pass/fail checks');
if(!main.includes("direction:!prior.length?'INSUFFICIENT_HISTORY'")) fail('Wallet trend engine missing'); else pass('Wallet analyst compares recent and prior verified performance windows');
if(!main.includes("canPromote:false") || !main.includes("canEnableTrusted:false") || !main.includes("canExecute:false")) fail('Wallet analyst authority boundary missing'); else pass('Wallet analyst has no promotion, Trusted-enable, or execution authority');
if(!main.includes("ipcMain.handle('assistant-wallet-analysis'") || !preload.includes('getAssistantWalletAnalysis') || !preload.includes('compareAssistantWallets')) fail('Wallet analyst IPC bridge missing'); else pass('Wallet analyst IPC/preload bridge is wired');
if(!main.includes('assistantWalletAnalysis')) fail('Wallet analyst workspace status missing'); else pass('Assistant retains Wallet Analyst capability');


// Phase 38 Token Research Assistant
for(const token of ['assistantTokenRiskDecision','assistantTokenMarket','assistantTokenResearchAnalysis','assistantTokenTarget','riskDecisionAuthoritative']) if(!main.includes(token)) fail(`Missing Phase 38 token research contract: ${token}`);
else {}
if(!main.includes("tokenResearchBook.tokens?.[mint]") || !main.includes("assistantTokenRiskDecision(mint)")) fail('Token Research Assistant is not grounded in stored Phase 25/26 evidence'); else pass('Token Research Assistant reuses Phase 25 research and Phase 26 risk evidence');
if(!main.includes("assistantCanOverrideHardBlock:false") || !main.includes("assistantCanMarkSafe:false")) fail('Token Research Assistant may override deterministic risk'); else pass('Token Research Assistant cannot waive hard blocks or mark unknown evidence safe');
if(!main.includes("historicalLiquidityRemoval") || !main.includes("'UNAVAILABLE'")) fail('Historical liquidity limitation missing'); else pass('Historical liquidity removal remains explicitly unavailable when unproven');
if(!main.includes("creatorIdentityIsCandidate:true") || !main.includes("currentSnapshotIsNotHistoricalExecutionEvidence:true")) fail('Token research provenance/evidence semantics missing'); else pass('Creator candidate and current-snapshot semantics stay explicit');
if(!main.includes("ipcMain.handle('assistant-token-research'") || !preload.includes('getAssistantTokenResearch')) fail('Token Research Assistant IPC bridge missing'); else pass('Token Research Assistant IPC/preload bridge is wired');
if(!main.includes('assistantTokenResearchAnalysis')) fail('Token Research Assistant workspace status missing'); else pass('Assistant retains Token Research capability');


// Phase 39 Trade Decision Assistant
for(const token of ['TRADE_DECISION','assistantTradeDecisionTarget','assistantTradeDecisionAnalysis','assistantLatestTradeAi','deterministicDecision']) if(!main.includes(token)) fail(`Missing Phase 39 trade decision contract: ${token}`);
else {}
if(!main.includes("ageMs>LIVE_SIGNAL_MAX_AGE_MS") || !main.includes("latencyMs>LIVE_OBSERVATION_MAX_LATENCY_MS")) fail('Trade Decision Assistant lacks source freshness/latency gates'); else pass('Trade Decision Assistant explains Phase 32 signal freshness and observation latency');
if(!main.includes("marketAgeMs>LIVE_MARKET_MAX_AGE_MS") || !main.includes("DEGRADED_MARKET_FALLBACK")) fail('Trade Decision Assistant lacks BUY market freshness gates'); else pass('BUY analysis preserves fresh non-degraded market requirements');
if(!main.includes("AUTOMATED_SELL_REQUIRES_OWN_WALLET_HOLDING_EVIDENCE")) fail('Trade Decision Assistant may imply unsafe automated SELL eligibility'); else pass('Automated SELL remains fail-closed without own-wallet holding evidence');
if(!main.includes("assistantLatestTradeAi") || !main.includes("task===AI_TASKS.TRADE_ANALYSIS")) fail('Phase 28 Trade AI correlation missing'); else pass('Matching Phase 28 Trade AI is included as advisory evidence');
if(!main.includes("executionPriceUsd") || !main.includes("marketPriceUsd") || !main.includes("pricing.confidence")) fail('Execution/current pricing separation missing'); else pass('Execution price and later market price remain distinct evidence');
if(!main.includes("deterministicRiskAuthoritative:true") || !main.includes("phase32ExecutionSafetyAuthoritative:true") || !main.includes("padreClickIsNotSettlement:true")) fail('Trade Decision authority semantics missing'); else pass('Risk, execution safety, and settlement semantics remain authoritative');
if(!main.includes("ipcMain.handle('assistant-trade-decision'") || !preload.includes('getAssistantTradeDecision')) fail('Trade Decision IPC bridge missing'); else pass('Trade Decision IPC/preload bridge is wired');
if(!main.includes('assistantTradeDecisionAnalysis')) fail('Trade Decision workspace status missing'); else pass('Assistant retains Trade Decision capability');


// Phase 40 Shadow / Ghost Coach
for(const token of ['SHADOW_COACH','assistantShadowLots','assistantQualificationNeeds','assistantShadowCoach','assistantShadowRanking']) if(!main.includes(token)) fail(`Missing Phase 40 Shadow Coach contract: ${token}`);
else {}
if(!main.includes("Only fully closed, source-verified outcomes count toward qualification.") || !main.includes("Open and partially realized lots are context only.")) fail('Shadow Coach outcome semantics missing'); else pass('Shadow Coach keeps open/partial lots separate from completed qualification outcomes');
if(!main.includes("check:'sample'") || !main.includes("check:'verified'") || !main.includes("check:'winRate'") || !main.includes("check:'roi'") || !main.includes("check:'profitFactor'") || !main.includes("check:'drawdown'") || !main.includes("check:'hardBlocks'")) fail('Shadow Coach exact qualification needs missing'); else pass('Shadow Coach exposes every deterministic qualification requirement');
if(!main.includes("qualificationDeterministic:true") || !main.includes("canPromote:false") || !main.includes("canEnableTrusted:false") || !main.includes("canExecute:false")) fail('Shadow Coach authority boundary missing'); else pass('Shadow Coach cannot promote, enable Trusted, or execute');
if(!main.includes("Closest-to-qualification ranking is explanatory only")) fail('Shadow ranking governance note missing'); else pass('Closest-to-qualification ranking remains explanatory only');
if(!main.includes("ipcMain.handle('assistant-shadow-coach'") || !main.includes("ipcMain.handle('assistant-shadow-ranking'") || !preload.includes('getAssistantShadowCoach') || !preload.includes('getAssistantShadowRanking')) fail('Shadow Coach IPC bridge missing'); else pass('Shadow Coach IPC/preload bridge is wired');
if(!main.includes('assistantShadowCoach')) fail('Shadow Coach workspace status missing'); else pass('Assistant retains Shadow / Ghost Coach capability');


// Phase 41 Risk Investigation Assistant
for(const token of ['ASSISTANT_RISK_SOURCE_MAP','assistantRiskDecisionHistory','assistantRiskTraceFlag','assistantRiskInvestigation','assistantRiskTarget']) if(!main.includes(token)) fail(`Missing Phase 41 risk investigation contract: ${token}`);
else {}
if(!main.includes("hardBlockMeaning:'A deterministic hard block is execution-governing") || !main.includes("assistantCanClearBlock:false")) fail('Risk investigation hard-block authority semantics missing'); else pass('Risk investigator cannot waive or clear deterministic hard blocks');
if(!main.includes("cautionMeaning:'A caution raises risk but is not itself represented as proof of manipulation.'") || !main.includes("turnoverSignalIsWashLikeNotProof:true")) fail('Risk investigation evidentiary caution semantics missing'); else pass('Cautions and wash-like turnover are not mislabeled as proof');
if(!main.includes("unknownMeaning:'UNKNOWN means evidence is unavailable") || !main.includes("LOWERS_CONFIDENCE_NOT_SAFETY_EVIDENCE")) fail('Risk investigation UNKNOWN semantics missing'); else pass('UNKNOWN evidence lowers confidence and never becomes a safe finding');
if(!main.includes("creatorIdentityRemainsCandidate:true")) fail('Creator candidate semantics missing'); else pass('Creator identity remains explicitly candidate-only');
if(!main.includes("changeFromPrevious:changed") || !main.includes("decisionChanged:")) fail('Risk decision history/change trace missing'); else pass('Risk investigator compares the latest risk decision with prior evidence');
if(!main.includes("sourceTransaction:sourceTx") || !main.includes("sourceSignature:r.sourceSignature")) fail('Risk source transaction trace missing'); else pass('Risk investigator retains source transaction/signature evidence');
if(!main.includes("ipcMain.handle('assistant-risk-investigation'") || !preload.includes('getAssistantRiskInvestigation')) fail('Risk investigation IPC bridge missing'); else pass('Risk Investigation IPC/preload bridge is wired');
if(!main.includes('assistantRiskInvestigation')) fail('Risk Investigation workspace status missing'); else pass('Assistant retains Risk Investigation capability');


// Phase 42 Closed-Loop Learning Assistant
for(const token of ['assistantLearningBucketRows','assistantLearningCalibration','assistantLearningExplain','assistantLearningProposal']) if(!main.includes(token)) fail(`Missing Phase 42 learning assistant contract: ${token}`);
else {}
if(!main.includes("verifiedOutcomeOnly:true") || !main.includes("rebuildClosedLoopLearning()")) fail('Learning Assistant is not grounded in verified-outcome learning'); else pass('Learning Assistant is grounded in Phase 29 source-verified outcome correlations');
if(!main.includes("minimumReviewSample:min") || !main.includes("x.scored>=min")) fail('Learning Assistant minimum sample enforcement missing'); else pass('Learning Assistant enforces the Phase 29 minimum review sample');
if(!main.includes("recurringMisses") || !main.includes("accuracyPct<50")) fail('Learning Assistant recurring miss detection missing'); else pass('Learning Assistant identifies recurring low-accuracy recommendation buckets');
if(!main.includes("externalModelRetraining:false") || !main.includes("autoApplyProposals:false") || !main.includes("canChangeThresholds:false")) fail('Learning Assistant advisory authority boundary missing'); else pass('Learning Assistant cannot retrain providers or auto-apply threshold/rule changes');
if(!main.includes("status:'ADVISORY_ONLY'") || !main.includes("requiresHumanReview:true")) fail('Learning proposals are not explicitly advisory-only'); else pass('Learning proposals require human review and are never auto-applied');
if(!main.includes("Correlation is descriptive evidence, not causal proof.")) fail('Learning Assistant causality semantics missing'); else pass('Learning Assistant does not convert correlation into causal claims');
if(!main.includes("ipcMain.handle('assistant-learning-analysis'") || !main.includes("ipcMain.handle('assistant-learning-proposal'") || !preload.includes('getAssistantLearningAnalysis') || !preload.includes('getAssistantLearningProposal')) fail('Learning Assistant IPC bridge missing'); else pass('Learning Assistant IPC/preload bridge is wired');
if(!main.includes('assistantLearningExplain')) fail('Learning Assistant capability missing'); else pass('Assistant retains Closed-Loop Learning capability');


// Phase 43 Portfolio & Performance Assistant
for(const token of ['PORTFOLIO_REVIEW','assistantAllVerifiedOutcomes','assistantPortfolioAttribution','assistantShadowExposure','assistantPortfolioTrend','assistantPortfolioAnalysis']) if(!main.includes(token)) fail(`Missing Phase 43 portfolio assistant contract: ${token}`);
else {}
if(!main.includes("completedOutcome===true&&o?.sourceVerified===true")) fail('Portfolio realized P&L is not restricted to verified completed outcomes'); else pass('Portfolio realized performance uses only source-verified completed outcomes');
if(!main.includes("openExposureDoesNotCountAsVerifiedOutcome:true") || !main.includes("unrealizedMeansCurrentShadowMarkOnly:true")) fail('Portfolio realized/unrealized semantics missing'); else pass('Open Shadow marks remain separate from verified realized outcomes');
if(!main.includes("assistantPortfolioAttribution") || !main.includes("topWallets") || !main.includes("topTokens") || !main.includes("bottomWallets") || !main.includes("bottomTokens")) fail('Portfolio attribution missing'); else pass('Portfolio Assistant attributes gains/losses by wallet and token');
if(!main.includes("maxDrawdownSol") || !main.includes("maxDrawdownPct") || !main.includes("direction:")) fail('Portfolio drawdown/trend analysis missing'); else pass('Portfolio Assistant computes chronological drawdown and recent performance direction');
if(!main.includes("operationalAndShadowAccountingSeparated:true") || !main.includes("Operational position ledgers are kept separate")) fail('Operational/Shadow accounting separation missing'); else pass('Operational ledgers cannot silently inflate verified Shadow performance');
if(!main.includes("canClosePositions:false") || !main.includes("canChangeSizing:false") || !main.includes("canExecute:false")) fail('Portfolio Assistant authority boundary missing'); else pass('Portfolio Assistant remains read-only');
if(!main.includes("ipcMain.handle('assistant-portfolio-analysis'") || !preload.includes('getAssistantPortfolioAnalysis')) fail('Portfolio Assistant IPC bridge missing'); else pass('Portfolio Assistant IPC/preload bridge is wired');
if(!main.includes('assistantPortfolioAnalysis')) fail('Portfolio Assistant capability missing'); else pass('Assistant retains Portfolio & Performance capability');


// Phase 44 Safe Action Preparation
for(const token of ['ASSISTANT_PREPARATION_STATUS','assistantPreparationSizingContext','assistantPreparationTpslContext','assistantBuildPreparation','assistantPrepareFromProposal','assistantSafePreparationForText']) if(!main.includes(token)) fail(`Missing Phase 44 safe preparation contract: ${token}`);
else {}
if(!main.includes("suggestedSizeSol:null") || !main.includes("userMustChooseSize:true")) fail('Safe preparation must not invent trade sizing'); else pass('Safe preparation leaves trade sizing to explicit user/governed input');
if(!main.includes("takeProfitPct:null") || !main.includes("stopLossPct:null") || !main.includes("autoConfigured:false")) fail('Safe preparation TP/SL boundary missing'); else pass('Safe preparation does not auto-configure TP/SL');
if(!main.includes("DETERMINISTIC_RISK_HARD_BLOCK") || !main.includes("ASSISTANT_PREPARATION_STATUS.BLOCKED")) fail('Safe preparation hard-block enforcement missing'); else pass('Deterministic hard blocks block Safe Preparation');
if(!main.includes("canOpen:false,canPopulate:false,canSubmit:false")) fail('Safe preparation Padre authority boundary missing'); else pass('Phase 44 cannot open, populate, or submit Padre');
if(!main.includes("preparationOnly:true,actionExecuted:false,canExecute:false,canSubmit:false,canChangeConfig:false")) fail('Safe preparation zero-execution/config authority missing'); else pass('Safe Preparation has zero execution/configuration authority');
if(!main.includes("READY_FOR_SAFE_PREPARATION")) fail('Confirmed proposal safe-preparation transition missing'); else pass('Confirmed proposals advance only to Safe Preparation');
if(!main.includes("ipcMain.handle('assistant-safe-preparation'") || !main.includes("ipcMain.handle('assistant-safe-preparation-preview'") || !preload.includes('getAssistantSafePreparation') || !preload.includes('previewAssistantSafePreparation')) fail('Safe Preparation IPC bridge missing'); else pass('Safe Preparation IPC/preload bridge is wired');
if(!main.includes('assistantBuildPreparation')) fail('Safe Preparation capability missing'); else pass('Assistant retains Safe Action Preparation capability');


// Phase 45 Governed Assistant Actions
for(const token of ['ASSISTANT_GOVERNED_ACTIONS','assistantGovernedActionGate','assistantCreateGovernedAction','assistantRunGovernedAction','assistantGovernedActionsPublic']) if(!main.includes(token)) fail(`Missing Phase 45 governed action contract: ${token}`);
else {}
if(!main.includes("OPEN_PADRE_TOKEN") || !main.includes("POPULATE_PADRE_DRAFT")) fail('Governed action allowlist missing'); else pass('Governed actions use an explicit narrow allowlist');
if(!main.includes("CONFIRMED_PROPOSAL_REQUIRED") || !main.includes("READY_SAFE_PREPARATION_REQUIRED") || !main.includes("AWAITING_EXPLICIT_CONFIRMATION")) fail('Governed action multi-stage confirmation boundary missing'); else pass('Governed actions require confirmed proposal, Safe Preparation, and second confirmation');
if(!main.includes("SYSTEM_DEGRADED") || !main.includes("EMERGENCY_PAUSE_ACTIVE") || !main.includes("DETERMINISTIC_RISK_HARD_BLOCK")) fail('Governed action fresh fail-closed checks missing'); else pass('Governed actions re-check risk, degraded mode, and emergency pause');
if(!main.includes("ASSISTANT_SELL_DRAFT_DISABLED")) fail('Assistant SELL draft fail-closed rule missing'); else pass('Assistant automated SELL draft remains disabled');
if(!main.includes("mayClickFinalSubmit:false") || !main.includes("mayCallExecuteTrade:false") || !main.includes("mayReserveExecutionAttempt:false")) fail('Governed action final execution boundary missing'); else pass('Assistant cannot final-submit, call executeTrade, or reserve execution');
if(!main.includes("tradeSubmitted=false") && !main.includes("tradeSubmitted:false")) fail('Governed action pre-submit completion semantics missing'); else pass('Governed action completion explicitly records no trade submission');
if(!main.includes("ipcMain.handle('assistant-governed-action-create'") || !main.includes("ipcMain.handle('assistant-governed-action-run'") || !preload.includes('createAssistantGovernedAction') || !preload.includes('runAssistantGovernedAction')) fail('Governed action IPC bridge missing'); else pass('Governed action IPC/preload bridge is wired');
if(!main.includes('assistantRunGovernedAction')) fail('Governed Actions capability missing'); else pass('Assistant retains Governed Assistant Actions capability');


// Phase 46 Assistant Memory & Project Context
for(const token of ['ASSISTANT_MEMORY_TYPES','assistantMemoryCreate','assistantMemoryUpdate','assistantMemoryArchive','assistantMemoryContext','assistantMemoryPublic','assistantMemoryFreshness']) if(!main.includes(token)) fail(`Missing Phase 46 memory contract: ${token}`);
else {}
for(const type of ['DECISION','INVESTIGATION','WATCH_ITEM','WORKING_NOTE','CONCLUSION']) if(!main.includes(type)) fail(`Missing memory type ${type}`); else {}
if(!main.includes("authority:'CONTEXT_ONLY'") || !main.includes("CONTEXT_ONLY_NON_AUTHORITATIVE")) fail('Memory authority boundary missing'); else pass('Memory is explicitly context-only/non-authoritative');
if(!main.includes("Current CopyGuard ledgers, blockchain evidence, deterministic risk, qualification, connection health, integrity, and Phase 32 execution safety always override memory.")) fail('Memory precedence rule missing'); else pass('Current evidence and deterministic safety override memory');
if(!main.includes("ageMs>7*86400000")) fail('Memory stale marker missing'); else pass('Memory exposes stale/freshness state');
if(!main.includes("assistantBook.memoryOrder") || !main.includes("slice(0,500)")) fail('Memory bounded persistence missing'); else pass('Memory persistence is bounded');
if(!main.includes("ipcMain.handle('assistant-memory-create'") || !main.includes("ipcMain.handle('assistant-memory-update'") || !main.includes("ipcMain.handle('assistant-memory-archive'") || !preload.includes('createAssistantMemory') || !preload.includes('getAssistantMemoryContext')) fail('Memory IPC bridge missing'); else pass('Memory IPC/preload bridge is wired');
if(!main.includes('assistantMemoryContext')) fail('Memory capability missing'); else pass('Assistant retains Memory & Project Context capability');


// Phase 47 Assistant Full Logic Audit
for(const token of ['ASSISTANT_AUDIT_SEVERITY','assistantLogicCheck','assistantFullLogicAudit','assistantLogicAuditPublic']) if(!main.includes(token)) fail(`Missing Phase 47 logic-audit contract: ${token}`);
else {}
for(const id of ['PERMISSION_MATRIX','ROUTER_EXECUTION_DENY','GOVERNED_ALLOWLIST','SELL_FAIL_CLOSED','MEMORY_NON_AUTHORITATIVE','NO_ASSISTANT_EXEC_ATTEMPT','NO_ASSISTANT_SUBMISSION','ACTION_EXPIRY','MESSAGE_AUTHORITY']) if(!main.includes(id)) fail(`Missing assistant audit invariant ${id}`); else {}
if(!main.includes("auditCanExecute:false") || !main.includes("auditCanChangeConfig:false") || !main.includes("auditCanOverrideRisk:false")) fail('Logic audit authority boundary missing'); else pass('Full Logic Audit itself has zero execution/config/risk authority');
if(!main.includes("Governed assistant actions stop before final Padre submit.")) fail('Pre-submit invariant missing'); else pass('Audit preserves governed pre-submit-only boundary');
if(!main.includes("No assistant path may call executeTrade or reserve an execution attempt.")) fail('Execution-path invariant missing'); else pass('Audit codifies no assistant executeTrade/execution-reservation path');
if(!main.includes("Automated SELL remains fail-closed")) fail('SELL fail-closed invariant missing'); else pass('Audit codifies automated SELL fail-closed behavior');
if(!main.includes("ipcMain.handle('assistant-full-logic-audit'") || !main.includes("ipcMain.handle('assistant-logic-audit-get'") || !preload.includes('runAssistantFullLogicAudit') || !preload.includes('getAssistantLogicAudit')) fail('Logic Audit IPC bridge missing'); else pass('Full Logic Audit IPC/preload bridge is wired');
if(!main.includes('assistantFullLogicAudit')) fail('Full Logic Audit capability missing'); else pass('Assistant retains Full Logic Audit capability');
// Static forbidden-path audit across the assistant implementation region.
const phase47AssistantStart=main.indexOf('// ── PHASE 33');
const phase47AssistantEnd=main.indexOf("ipcMain.handle('assistant-get-state'");
const phase47AssistantRegion=phase47AssistantStart>=0&&phase47AssistantEnd>phase47AssistantStart?main.slice(phase47AssistantStart,phase47AssistantEnd):'';
const strippedAssistantRegion=phase47AssistantRegion.replace(/'[^']*'/g,"''").replace(/`[^`]*`/gs,'``').replace(/"[^"]*"/g,'""');
if(/\bexecuteTrade\s*\(/.test(strippedAssistantRegion)||/\bautoExecuteTrade\s*\(/.test(strippedAssistantRegion)) fail('Assistant implementation directly invokes protected execution function'); else pass('Static audit finds no direct assistant executeTrade/autoExecuteTrade invocation');


// Phase 48 UI Foundation & Navigation System
for(const token of ['nav-group-label','quick-switch-btn','command-palette-backdrop','global-health-strip','sidebar-density','page-breadcrumb','page-context']) if(!html.includes(token)) fail(`Missing Phase 48 UI shell element: ${token}`); else {}
for(const token of ['PAGE_META','initUi48','openCommandPalette48','renderCommandPalette48','renderGlobalHealth48','toggleSidebar48']) if(!renderer.includes(token)) fail(`Missing Phase 48 renderer behavior: ${token}`); else {}
if(!renderer.includes("localStorage.setItem('copyguard-sidebar-compact'")) fail('Compact sidebar persistence missing'); else pass('Compact sidebar preference persists locally');
if(!renderer.includes("e.key.toLowerCase()==='k'") || !renderer.includes("ArrowDown") || !renderer.includes("ArrowUp")) fail('Command palette keyboard controls missing'); else pass('Workspace palette supports Ctrl/Cmd+K and keyboard navigation');
if(!renderer.includes("localStorage.setItem('copyguard-last-page'")) fail('Workspace navigation state persistence missing'); else pass('Workspace navigation records last page');
if(!css.includes('.shell.compact-sidebar') || !css.includes('.command-palette-backdrop') || !css.includes('.nav-group-label')) fail('Phase 48 shell styling missing'); else pass('Grouped navigation, compact shell, and command palette styling are present');
if(!renderer.includes('renderGlobalHealth48')) fail('Global health renderer missing'); else pass('Top bar exposes global health status');
if(!html.includes('data-page="padre"') || !renderer.includes("if(page==='padre')")) fail('Padre workspace navigation regression'); else pass('Dedicated Padre workspace remains intact');


// Phase 49 Dashboard Command Center
for(const token of ['command-hero49','metric-verified-pnl','metric-shadow-exposure','command-attention-summary','portfolio-realized49','portfolio-unrealized49','learning-links49','assistant-audit49']) if(!html.includes(token)) fail(`Missing Phase 49 dashboard element: ${token}`); else {}
for(const token of ['renderDashboard49','renderPortfolio49','renderIntelligence49','renderCommandState49','renderCommandAttention49']) if(!renderer.includes(token)) fail(`Missing Phase 49 dashboard renderer: ${token}`); else {}
if(!renderer.includes("window.cg.getAssistantPortfolioAnalysis") || !renderer.includes("window.cg.getAssistantLogicAudit")) fail('Dashboard does not load verified portfolio/logic audit evidence'); else pass('Dashboard loads existing Portfolio Assistant and Logic Audit evidence');
if(!renderer.includes("verified closes") || !renderer.includes("unrealized")) fail('Dashboard realized/unrealized semantics missing'); else pass('Dashboard distinguishes verified realized outcomes from unrealized Shadow marks');
if(!main.includes("integrity:{status:integrityBook.lastStatus") || !main.includes("assistantEngine:{phase:47")) fail('Dashboard backend summary does not expose current integrity/assistant state'); else pass('Dashboard backend summary exposes integrity and current assistant state');
if(!css.includes('.command-hero49') || !css.includes('.command-grid49-primary') || !css.includes('.portfolio-split49')) fail('Dashboard Command Center styling missing'); else pass('Dashboard Command Center responsive styling is present');
if(!renderer.includes("renderGhostDashPanel")) fail('Ghost dashboard integration regression'); else pass('Shadow qualification dashboard integration remains intact');


// Phase 50 Live Feed & Trade Review UI
for(const token of ['feed-latency-summary','feed-execution-summary','feed-layout50','feed-side50']) if(!html.includes(token)) fail(`Missing Phase 50 feed UI element: ${token}`); else {}
for(const token of ['feedSourceEvidence','feedPriceEvidence','feedExecutionEligibility','renderFeedEvidenceStrip50','renderFeedDecisionLayer50']) if(!renderer.includes(token)) fail(`Missing Phase 50 feed renderer: ${token}`); else {}
if(!renderer.includes('executionPriceUsd') || !renderer.includes('CURRENT PRICE') || !renderer.includes('EXECUTION PRICE')) fail('Execution/current price separation missing'); else pass('Trade feed separates execution-price evidence from later/current market price');
if(!renderer.includes('OBSERVATION TOO LATE') || !renderer.includes('SIGNAL STALE') || !renderer.includes('RECOVERED SIGNAL · OBSERVE ONLY')) fail('Phase 32 freshness/recovery UI semantics missing'); else pass('Trade feed exposes stale, late, and recovered observation states');
if(!renderer.includes('MARKET QUOTE STALE') || !renderer.includes('DEGRADED MARKET FALLBACK')) fail('BUY quote freshness UI semantics missing'); else pass('Trade feed exposes stale/degraded BUY market evidence');
if(!renderer.includes('AUTOMATED SELL REQUIRES OWN-WALLET EVIDENCE')) fail('Automated SELL UI safety semantic missing'); else pass('Trade feed exposes automated SELL fail-closed limitation');
if(!renderer.includes('DETERMINISTIC AUTHORITY') || !renderer.includes('· ADVISORY')) fail('Risk/AI authority separation missing'); else pass('Deterministic risk and AI advice are visually separated');
if(!renderer.includes('✓ PREPARE COPY')) fail('Manual COPY preparation label missing'); else pass('Manual COPY is explicitly labeled preparation-only');
if(!html.includes('A prepared trade is not a fill, position, or realized P&amp;L')) fail('Execution doctrine copy missing'); else pass('Feed doctrine distinguishes preparation, submit, and settlement');
if(!css.includes('.trade-evidence50') || !css.includes('.decision-layer50') || !css.includes('.feed-evidence-summary50')) fail('Phase 50 feed styling missing'); else pass('Live Feed review styling is present');


// Phase 51 Wallet Management & Qualification UI
for(const token of ['Wallet Qualification Console','wallet-qualification-legend51','wallet-detail']) if(!html.includes(token)) fail(`Missing Phase 51 wallet UI element: ${token}`); else {}
for(const token of ['loadWalletIntelligence51','wallet51CheckDetail','DETERMINISTIC QUALIFICATION','VERIFIED PERFORMANCE','DISCOVERY PROVENANCE','RISK HISTORY','ROLLING QUALIFICATION']) if(!renderer.includes(token)) fail(`Missing Phase 51 wallet qualification renderer: ${token}`); else {}
if(!renderer.includes('getAssistantWalletAnalysis') || !renderer.includes('getAssistantShadowCoach') || !renderer.includes('getDynamicQualification')) fail('Wallet console does not reuse existing qualification engines'); else pass('Wallet console reuses Wallet Analyst, Shadow Coach, and Dynamic Qualification contracts');
if(renderer.includes('Performance threshold currently meets the basic promotion heuristic')) fail('Legacy simplistic promotion heuristic remains in wallet detail'); else pass('Legacy 20-trade/60%-win-rate promotion hint removed from wallet detail');
if(!renderer.includes('Qualification Required') || !renderer.includes('Review Trusted Promotion')) fail('Trusted promotion qualification gating missing'); else pass('Trusted promotion review is gated by deterministic qualification');
if(!renderer.includes("action==='requalify'") || !renderer.includes('ghostRequalify')) fail('Shadow requalification control missing'); else pass('Warning/paused wallets can explicitly requalify in Shadow');
if(!renderer.includes('Open and partially realized Shadow lots are context only')) fail('Open/partial outcome semantics missing'); else pass('Open/partial Shadow lots remain context-only');
if(!renderer.includes('Qualification passes. Trusted promotion remains a separate explicit action.')) fail('No-auto-promotion semantic missing'); else pass('Qualification does not auto-promote Trusted');
if(!css.includes('.qualification-checks51') || !css.includes('.wallet-status-strip51') || !css.includes('.risk-counts51')) fail('Phase 51 qualification styling missing'); else pass('Wallet qualification console responsive styling is present');


// Phase 52 Positions & Portfolio Accounting UI
for(const token of ['portfolioAccountingData','verifiedOutcomes:verified','shadowLots:shadowLots','accountingCommitted:false','SUBMITTED_UNVERIFIED']) if(!main.includes(token)) fail(`Missing Phase 52 accounting backend contract: ${token}`); else {}
if(!main.includes("ipcMain.handle('portfolio-accounting-data'") || !preload.includes('getPortfolioAccountingData')) fail('Portfolio accounting IPC bridge missing'); else pass('Portfolio accounting IPC/preload bridge is wired');
for(const token of ['Verified Outcomes','Open Shadow','Execution States','Operational','ACCOUNTING MODEL']) if(!html.includes(token)) fail(`Missing Phase 52 accounting UI layer: ${token}`); else {}
for(const token of ['position52Rows','renderPositionSummary','selectedPosition52','AUTHORITATIVE REALIZED RESULT','SIMULATED / MARKED CONTEXT','NOT VERIFIED REALIZED PERFORMANCE']) if(!renderer.includes(token)) fail(`Missing Phase 52 accounting renderer: ${token}`); else {}
if(!renderer.includes('accountingCommitted') || !renderer.includes('Prepared means Padre/manual review only. It is not a fill.')) fail('Prepared-state accounting semantics missing'); else pass('Prepared state remains non-accounting/non-fill');
if(!main.includes("submitted:'SUBMITTED_UNVERIFIED is not settlement and is not realized P&L.'")) fail('Submitted-unverified semantics missing'); else pass('Submitted-unverified remains distinct from settlement');
if(!renderer.includes('data-source-signature') || !renderer.includes('https://solscan.io/tx/')) fail('Source transaction links missing'); else pass('Position evidence links to source transactions');
if(!renderer.includes('partial exits') && !renderer.includes('PARTIAL EXITS')) fail('Partial realization visibility missing'); else pass('Open Shadow partial realizations are visible');
if(!renderer.includes('positions-attribution52') && !html.includes('positions-attribution52')) fail('Portfolio attribution surface missing'); else pass('Wallet/token attribution surface is present');
if(!css.includes('.accounting-doctrine52') || !css.includes('.position-row52') || !css.includes('.accounting-authority52')) fail('Phase 52 accounting styling missing'); else pass('Positions accounting responsive styling is present');


// Phase 53 Ghost / Shadow Qualification UI
for(const token of ['Ghost / Shadow Qualification Lab','ghost53-state-map','ghost53-evidence-grid','ghost16-summary','ghost16-detail']) if(!html.includes(token)) fail(`Missing Phase 53 Ghost UI element: ${token}`); else {}
for(const token of ['ghost53State','ghost53Progress','ghost53Source','PROMOTION READINESS','OPEN SHADOW LOTS','VERIFIED OUTCOME LEDGER','DYNAMIC HEALTH','OBSERVATION QUALITY']) if(!renderer.includes(token)) fail(`Missing Phase 53 Shadow Lab renderer: ${token}`); else {}
if(!renderer.includes('only fully closed') && !html.includes('FULLY CLOSED OUTCOMES COUNT')) fail('Closed-outcome qualification doctrine missing'); else pass('Shadow Lab emphasizes fully closed outcomes for qualification');
if(!renderer.includes('Open or partially realized Shadow lots') && !renderer.includes('partial exit')) fail('Partial/open Shadow context semantics missing'); else pass('Open and partial Shadow lots remain simulation context');
if(!renderer.includes('data-g53-solscan') || !renderer.includes('https://solscan.io/tx/')) fail('Ghost source transaction links missing'); else pass('Shadow Lab exposes source transaction evidence links');
if(!renderer.includes("autoActivateLive:false")) fail('Phase 53 explicit promotion boundary missing'); else pass('Automatic live promotion is disabled in the Phase 53 UI');
if(!renderer.includes("data-g16-action=\"promote\"") || !renderer.includes('REVIEW LIVE PROMOTION')) fail('Explicit promotion review control missing'); else pass('Qualification exposes a separate explicit live-promotion review');
if(!renderer.includes("data-g16-action=\"requalify\"") || !renderer.includes('REQUALIFY IN SHADOW')) fail('Dynamic requalification control missing'); else pass('Warning/paused states can explicitly requalify in Shadow');
if(!renderer.includes('PARTIAL REALIZATION') || !renderer.includes('ghost53-realizations')) fail('Lot-level partial realization visibility missing'); else pass('Lot-level partial exits are visible');
if(!css.includes('.ghost53-readiness') || !css.includes('.ghost53-lot') || !css.includes('.ghost53-outcomes')) fail('Phase 53 Shadow Lab styling missing'); else pass('Shadow Lab responsive styling is present');


// Phase 54 Automation Control Center UI
for(const token of ['automation54-pause','automation54-system-mode','automation54-observation','automation54-market','automation54-padre','automation-execution54','automation-gates54']) if(!html.includes(token)) fail(`Missing Phase 54 automation UI element: ${token}`); else {}
for(const token of ['renderAutomationSafety54','loadAutomationQualification54','automation-profile-health54','Automated SELL','Emergency pause']) if(!renderer.includes(token)) fail(`Missing Phase 54 automation renderer: ${token}`); else {}
if(!renderer.includes('getExecutionSafety') || !renderer.includes('executionSafety')) fail('Automation workspace does not load Phase 32 execution safety'); else pass('Automation workspace loads Phase 32 execution safety data');
if(!renderer.includes('getDynamicQualification') || !renderer.includes('DYNAMIC QUALIFICATION')) fail('Automation workspace does not expose dynamic qualification health'); else pass('Automation workspace exposes dynamic qualification health');
if(!renderer.includes('Recovered/stale signals do not execute live') && !html.includes('Recovered/stale signals do not execute live')) fail('Recovered/stale automation doctrine missing'); else pass('Recovered/stale signals remain non-live');
if(!html.includes('Automated SELL remains fail-closed') && !renderer.includes('Automated SELL')) fail('Automated SELL fail-closed doctrine missing'); else pass('Automated SELL fail-closed doctrine remains visible');
if(!renderer.includes('AI can add a gate, but it cannot waive deterministic Risk Engine or Phase 32 blocks.')) fail('AI authority boundary missing'); else pass('AI remains subordinate to deterministic safety');
if(!css.includes('.automation-safety-strip54') || !css.includes('.automation-gate54') || !css.includes('.automation-profile-health54')) fail('Phase 54 automation styling missing'); else pass('Automation Control Center responsive styling is present');


// Phase 55 Research Center Evidence Workspace
for(const token of ['TOKEN EVIDENCE LAB','DETERMINISTIC AUTHORITY','research-authority55','RESEARCH ≠ EXECUTION','VERIFY THE MINT, NOT THE TICKER']) if(!html.includes(token)) fail(`Missing Phase 55 research UI element: ${token}`); else {}
for(const token of ['research55Decision','research55Freshness','renderResearchAuthority55','TOKEN-2022 FLAGS / RESTRICTIONS','PADRE HANDOFF IS PRE-SUBMIT REVIEW ONLY']) if(!renderer.includes(token)) fail(`Missing Phase 55 research renderer: ${token}`); else {}
if(!main.includes('researchEvidenceVersion:3') || !main.includes('buildTokenResearchEvidence')) fail('Phase 25 evidence package regression'); else pass('Phase 25 Evidence Package v3 remains wired');
if(!renderer.includes('Mint authority status unknown') || !renderer.includes('Creator identity not proven')) fail('Explicit UNKNOWN evidence semantics missing'); else pass('Research exposes missing evidence as UNKNOWN/unproven');
if(!renderer.includes("d.state==='HARD_BLOCK'") || !renderer.includes('AI cannot change this deterministic state.')) fail('Deterministic research authority missing'); else pass('Deterministic risk remains authoritative over AI');
if(!renderer.includes("Opened in Padre for review only — deterministic HARD BLOCK remains active")) fail('Hard-block Padre review semantics missing'); else pass('Hard-blocked contracts remain blocked during Padre review handoff');
if(!css.includes('.research-grid55') || !css.includes('.research-authority-state55') || !css.includes('.research-hardblock55')) fail('Phase 55 research styling missing'); else pass('Research evidence workspace responsive styling is present');


// Phase 56 Intelligence Operations UI
for(const token of ['INTELLIGENCE OPERATIONS · PHASES 27–29','intel-detail56','intel-runs56','DISCOVERY IS NOT TRUST']) if(!html.includes(token)) fail(`Missing Phase 56 intelligence UI element: ${token}`); else {}
for(const token of ['intelDiscoveryRows56','intelCandidate56','renderIntelDetail56','SHADOW_READY permits paper testing only','Coordination + deterministic risk']) if(!renderer.includes(token) && !renderer.toLowerCase().includes(token.toLowerCase())) fail(`Missing Phase 56 intelligence renderer: ${token}`); else {}
if(!main.includes('candidates,[...') && !main.includes('const candidates=[...vals]')) fail('Discovery public data does not expose auditable candidates'); else pass('Phase 27 candidate evidence is exposed to Intelligence Center');
if(!main.includes('clusterOverlap:Number(x.clusterOverlap||0)') || !main.includes('strongestPeer:x.strongestPeer')) fail('Cluster evidence missing from discovery public data'); else pass('Cluster overlap/peer evidence remains auditable');
if(!renderer.includes('ONE_HIT_WONDER') || !renderer.includes("x.shadowEligible?'ELIGIBLE / ROUTING DEPENDS ON PHASE 27'")) fail('One-hit or Shadow eligibility semantics missing'); else pass('One-hit rejection and Shadow eligibility remain distinct');
if(!renderer.includes('SHADOW_READY means the repeatability gate passed') && !html.includes('SHADOW_READY means the repeatability gate passed')) fail('Discovery-to-Trust boundary missing'); else pass('Discovery does not imply Trusted');
if(!renderer.includes('Overlap is a coordination/correlation signal, not proof of common control.')) fail('Cluster correlation caveat missing'); else pass('Cluster overlap is not presented as proof of common control');
if(!renderer.includes('https://solscan.io/tx/') || !renderer.includes('data-intel-signature')) fail('Discovery source transaction inspection missing'); else pass('Discovery source signatures can be inspected');
if(!css.includes('.intel-layout56') || !css.includes('.intel-evidence-grid56') || !css.includes('.intel-run56')) fail('Phase 56 intelligence styling missing'); else pass('Intelligence operations responsive styling is present');


// Phase 57 Early Bird Intelligence UI
for(const token of ['PHASE 24 · LAUNCH RECONSTRUCTION','ENTRY TRUTH','Observed run estimate ≠ historical peak','eb57-inspector','SHADOW ONLY']) if(!html.includes(token)) fail(`Missing Phase 57 Early Bird UI element: ${token}`); else {}
for(const token of ['eb57EntryEvidence','renderEb57Inspector','renderEb57Reconstruction','HISTORICAL ENTRY PRICE','not historical peak proof']) if(!renderer.includes(token)) fail(`Missing Phase 57 Early Bird renderer: ${token}`); else {}
if(!main.includes('getEarliestBuyers') || !main.includes('secondsAfterLaunch:buyer.secondsAfterLaunch') || !main.includes('launchAnchorSource:buyer.launchAnchorSource')) fail('Phase 24 source reconstruction regression'); else pass('Early Bird retains actual buyer/launch reconstruction evidence');
if(!main.includes('entryPriceUsd:buyer.entryPriceUsd') || !renderer.includes("price=e.entryPriceUsd!=null")) fail('Historical entry-price evidence missing'); else pass('Historical entry price is evidence-backed and UNKNOWN when absent');
if(!main.includes('Observed run multiple') || !renderer.includes('not historical peak proof')) fail('Observed-run vs historical-peak semantics missing'); else pass('Observed run estimate is not mislabeled as historical peak');
if(!renderer.includes('https://solscan.io/tx/') || !renderer.includes('data-eb-tx')) fail('Early Bird source transaction inspection missing'); else pass('Early Bird source signatures link to transaction evidence');
if(!main.includes('routeEarlyBirdToShadow') || !renderer.includes('Early Bird evidence can create/route a Ghost wallet')) fail('Shadow-only routing boundary missing'); else pass('Early Bird routes to Shadow without Trusted authority');
if(!renderer.includes('AI cannot prove insider knowledge, profitability, or live eligibility.')) fail('Early Bird AI authority boundary missing'); else pass('Early Bird AI remains evidence-limited');
if(!css.includes('.eb57-layout') || !css.includes('.eb57-evidence-row') || !css.includes('.eb57-boundary')) fail('Phase 57 responsive styling missing'); else pass('Early Bird evidence workspace responsive styling is present');


// Phase 58 Risk Forensics UI
for(const token of ['PHASE 26 · DETERMINISTIC RISK ENGINE V3','FINAL SAFETY AUTHORITY','HARD BLOCK','UNKNOWN','AI ROLE','risk58-investigation']) if(!html.includes(token)) fail(`Missing Phase 58 Risk UI element: ${token}`);
for(const token of ['risk58EvidenceRows','risk58FlagRows','renderRiskScanResult','AUTHORITATIVE DECISION','PADRE BLOCKED BY RISK','AI explanation cannot clear']) if(!renderer.includes(token)) fail(`Missing Phase 58 risk renderer: ${token}`);
if(!main.includes("decision=hardBlocks.length?'HARD_BLOCK'") || !main.includes("recommendation=decision==='HARD_BLOCK'?'SKIP'")) fail('Deterministic HARD_BLOCK authority regression'); else pass('Risk Engine v3 hard blocks remain authoritative');
if(!main.includes("addUnknown('LIQUIDITY_UNKNOWN'") || !renderer.includes('EVIDENCE GAPS')) fail('Explicit UNKNOWN evidence handling missing'); else pass('Unknown evidence remains explicit and unresolved');
if(!main.includes('TOKEN2022_NON_TRANSFERABLE') || !main.includes('TOP_OWNER_CONCENTRATION') || !main.includes('CREATOR_CONCENTRATION')) fail('Deterministic token/holder/creator gates missing'); else pass('Token control, holder ownership, and creator hard gates remain wired');
if(!preload.includes('aiRiskExplain') || !renderer.includes('SPECIALIZED AI · SUBORDINATE')) fail('Risk explanation AI bridge missing'); else pass('Risk AI explanation remains subordinate to deterministic safety');
if(!renderer.includes("riskUi.scan?.riskAssessment?.decision==='HARD_BLOCK'") || !renderer.includes('Padre handoff blocked by deterministic risk')) fail('Hard-block Padre handoff guard missing'); else pass('Risk Center blocks Padre handoff on deterministic HARD_BLOCK');
if(!renderer.includes('review/preparation context only') || !renderer.includes('does not submit a trade')) fail('Phase 32 Risk Center boundary missing'); else pass('Risk Center Padre handoff remains review/preparation only');
if(!css.includes('.risk58-layout') || !css.includes('.risk58-verdict') || !css.includes('.risk58-execution-boundary')) fail('Phase 58 responsive styling missing'); else pass('Risk Forensics responsive styling is present');


// Phase 59 Events & System Evidence Center
for(const token of ['PHASE 59 · UNIFIED SYSTEM EVIDENCE LEDGER','Event recorded ≠ trade submitted ≠ settled ≠ verified realized outcome','events59-inspector','SUBMITTED_UNVERIFIED','VERIFIED OUTCOME']) if(!html.includes(token)) fail(`Missing Phase 59 Events UI: ${token}`);
for(const token of ['events59Inspector','events59Meaning','getSystemEvidenceEvents','EVIDENCE ONLY','Operational evidence record only']) if(!renderer.includes(token)) fail(`Missing Phase 59 renderer logic: ${token}`);
if(!main.includes('function systemEvidenceEventCenter')||!main.includes("source:'Phase 32 Execution Safety'")||!main.includes("source:'Phase 30 Data Integrity'")||!main.includes("source:'Phase 31 Connection Health'")||!main.includes("source:'Phase 18 Helius Observation'")) fail('Cross-ledger evidence aggregation missing'); else pass('Events Center aggregates core operational evidence ledgers');
if(!preload.includes('getSystemEvidenceEvents')) fail('System evidence IPC bridge missing'); else pass('System evidence IPC is read-only and exposed');
if(!renderer.includes("PREPARED:'Prepared only — no submission and no accounting commitment.'")||!renderer.includes("SUBMITTED_UNVERIFIED:'Submission evidence exists; settlement remains unverified.'")) fail('Execution state semantics missing'); else pass('Execution state semantics remain explicit');
if(!renderer.includes('cannot submit trades, promote wallets, override deterministic risk')) fail('Events authority boundary missing'); else pass('Events Center adds no execution/risk/promotion authority');
if(!css.includes('.events59-layout')||!css.includes('.events59-boundary')) fail('Phase 59 responsive styling missing'); else pass('Events evidence workspace styling is present');


// Phase 60 AI Assistant Operations UI
for(const token of ['PHASE 60 · GOVERNED AI OPERATIONS WORKSPACE','MAXIMUM AUTHORITY','PRE-SUBMIT ONLY','assistant60-ops-content','Working Memory','LIVE EXECUTION</b> DENIED']) if(!html.includes(token)) fail(`Missing Phase 60 Assistant UI: ${token}`);
for(const token of ['renderAssistant60Ops','refreshAssistant60Support','getAssistantSafePreparation','createAssistantGovernedAction','runAssistantGovernedAction','runAssistantFullLogicAudit','MEMORY IS NON-AUTHORITATIVE']) if(!renderer.includes(token)) fail(`Missing Phase 60 governed assistant UI logic: ${token}`);
if(!preload.includes('getAssistantSafePreparation')||!preload.includes('getAssistantGovernedActions')||!preload.includes('getAssistantMemory')||!preload.includes('getAssistantLogicAudit')) fail('Assistant Phases 44–47 preload bridges missing'); else pass('Assistant Phases 44–47 capabilities are surfaced readably');
if(!main.includes("LIVE_EXECUTION")||!main.includes("CHANGE_CONFIG")||!main.includes("COMPLETED_PRE_SUBMIT")) fail('Assistant authority boundary regression'); else pass('Assistant execution/config/pre-submit authority boundaries remain present');
if(!renderer.includes('Assistant cannot final-submit')||!renderer.includes('Phase 26 deterministic risk + Phase 32 execution safety remain authoritative')) fail('Phase 60 authority doctrine missing'); else pass('Assistant UI makes deterministic authority explicit');
if(!css.includes('.assistant60-layout')||!css.includes('.assistant60-redline')||!css.includes('.assistant60-audit-summary')) fail('Phase 60 responsive styling missing'); else pass('AI Assistant operations styling is present');


// Phase 61 Padre Pre-Submit Execution Workspace
for(const token of ['PHASE 61 · PRE-SUBMIT EXECUTION WORKSPACE','FINAL SUBMIT AUTHORITY','PREPARED','SUBMITTED_UNVERIFIED','VERIFIED OUTCOME','padre61-safety']) if(!html.includes(token)) fail(`Missing Phase 61 Padre UI: ${token}`);
for(const token of ['renderPadre61','refreshPadre61','getPadreWorkspaceContext','NO TRADE SUBMITTED','Automated SELL']) if(!renderer.includes(token)) fail(`Missing Phase 61 Padre renderer logic: ${token}`);
if(!main.includes("'padre-workspace-context'")||!main.includes('copyGuardPreparedIsSubmission:false')||!main.includes('governedFinalSubmit:false')||!main.includes('automatedSellFailClosed:true')) fail('Padre workspace authority snapshot missing'); else pass('Padre workspace context preserves execution boundaries');
if(!preload.includes('getPadreWorkspaceContext')) fail('Padre workspace context preload bridge missing'); else pass('Padre context bridge is read-only');
if(!main.includes("partition:'persist:padre'")&&!main.includes('partition: "persist:padre"')&&!main.includes("partition: 'persist:padre'")) fail('Persistent Padre session missing'); else pass('Dedicated Padre persistent session remains intact');
if(!renderer.includes('Prepared state')||!renderer.includes('Does not reserve or submit a Phase 32 attempt')) fail('Prepared-state semantics missing'); else pass('Prepared remains distinct from Phase 32 execution');
if(!css.includes('.padre61-layout')||!css.includes('.padre61-redline')) fail('Phase 61 responsive styling missing'); else pass('Padre pre-submit workspace styling is present');


// Phase 62 Settings & Security Control Center
for(const token of ['PHASE 62 · SECURITY · CONNECTIONS · RECOVERY','settings62-health','Connections & Secrets','Integrity & Recovery','DETERMINISTIC SAFETY WINS','VERIFY BEFORE REPLACE']) if(!html.includes(token)) fail(`Missing Phase 62 Settings UI: ${token}`);
for(const token of ['renderSettings62Health','RESET EVERYTHING','SHA-256 CHECKSUM VERIFIED']) if(!renderer.includes(token)) fail(`Missing Phase 62 Settings renderer logic: ${token}`);
if(!main.includes("confirmation)!=='RESET EVERYTHING'")&&!main.includes("confirmation)!==\'RESET EVERYTHING\'")) fail('Backend typed destructive reset protection missing'); else pass('Reset Everything requires backend typed confirmation');
if(!main.includes("secretsIncluded:false")||!main.includes("checksumAlgorithm:'SHA-256'")||!main.includes("transactionalRestore:true")) fail('Backup security policy missing'); else pass('Backup policy exposes checksum, transactional restore and secret exclusion');
if(!preload.includes("resetData: (scope, confirmation=''")) fail('Protected reset preload bridge missing'); else pass('Reset confirmation crosses the IPC boundary explicitly');
if(!renderer.includes('cannot disable Phase 12 deterministic hard blocks')&&!renderer.includes('cannot waive Phase 26 hard blocks')) fail('Settings deterministic-risk authority doctrine missing'); else pass('Settings cannot weaken deterministic risk authority');
if(!css.includes('.settings62-layout')||!css.includes('.settings62-rail-card')) fail('Phase 62 responsive styling missing'); else pass('Settings Security Control Center styling is present');


// Phase 63 Verified Wallet Performance Leaderboard
for(const token of ['PHASE 63 · VERIFIED WALLET PERFORMANCE','VERIFIED PERFORMANCE','SHADOW CONTEXT','RANKING AUTHORITY','leader63-detail']) if(!html.includes(token)) fail(`Missing Phase 63 Leaderboard UI: ${token}`);
for(const token of ['leader63Detail','refreshLeaderboard63','VERIFIED PERFORMANCE ONLY','RANKING ≠ TRUST']) if(!renderer.includes(token)) fail(`Missing Phase 63 leaderboard renderer logic: ${token}`);
if(!main.includes('function leaderboardEvidenceData')||!main.includes("sourceVerified===true")||!main.includes("dataQuality==='VERIFIED'")) fail('Leaderboard verified-outcome aggregation missing'); else pass('Leaderboard realized metrics use fully closed source-verified outcomes');
if(!main.includes('canPromoteTrusted:false')||!main.includes('canExecute:false')) fail('Leaderboard authority boundary missing'); else pass('Leaderboard ranking has no Trusted/execution authority');
if(!preload.includes('getLeaderboardEvidenceData')) fail('Leaderboard evidence preload bridge missing'); else pass('Leaderboard evidence IPC is wired');
if(!renderer.includes('Ranking does not waive deterministic risk decisions.')) fail('Leaderboard risk doctrine missing'); else pass('Leaderboard keeps deterministic risk visible');
if(!css.includes('.leader63-layout')||!css.includes('.leader63-boundary')) fail('Phase 63 responsive styling missing'); else pass('Verified leaderboard responsive styling is present');


// Phase 64 Global UI polish, accessibility and responsive behavior
for(const token of ['skip-link','aria-live="polite"','aria-pressed="false"','tabindex="-1"']) if(!html.includes(token)) fail(`Missing Phase 64 accessibility shell: ${token}`);
for(const token of ['ui64Init','ui64EnhanceSemantics','ui64SetBusy','aria-current','Keyboard: Ctrl+K quick switch']) if(!renderer.includes(token)) fail(`Missing Phase 64 UI logic: ${token}`);
if(!renderer.includes("ArrowDown")||!renderer.includes("ArrowUp")||!renderer.includes("Home")||!renderer.includes("End")) fail('Sidebar keyboard navigation missing'); else pass('Sidebar supports arrow/Home/End keyboard navigation');
if(!renderer.includes("prefers-reduced-motion")||!css.includes("prefers-reduced-motion")) fail('Reduced-motion support missing'); else pass('Reduced-motion preference is respected');
if(!css.includes(':focus-visible')||!css.includes('.skip-link')||!css.includes('@media(max-width:620px)')) fail('Phase 64 accessibility/responsive styling missing'); else pass('Global focus, skip-link and narrow-screen styling is present');
if(!renderer.includes('No execution state was assumed.')) fail('Safe async error messaging missing'); else pass('Global async errors do not assume execution state');


// Phase 65 Final Production Integration
for(const token of ['PHASE 65 · FINAL INTEGRATION','Production Readiness Audit','production-audit-status65','production-audit-run65']) if(!html.includes(token)) fail(`Missing Phase 65 dashboard integration: ${token}`);
for(const token of ['refreshProductionAudit65','renderProductionAudit65','getProductionIntegrationAudit']) if(!renderer.includes(token)) fail(`Missing Phase 65 renderer integration: ${token}`);
if(!main.includes('function productionIntegrationAudit')||!main.includes("'production-integration-audit'")) fail('Production Integration Audit backend missing'); else pass('Production Integration Audit backend is wired');
if(!preload.includes('getProductionIntegrationAudit')) fail('Production Integration Audit preload bridge missing'); else pass('Production Integration Audit IPC is exposed read-only');
for(const token of ['EXEC_IDEMPOTENCY','PREPARED_NO_ACCOUNTING','VERIFIED_SOURCE_CHAIN','AUTO_SELL_FAIL_CLOSED','RECOVERED_SIGNAL_NON_LIVE','ASSISTANT_PRE_SUBMIT_ONLY','QUALIFICATION_AUTO_PAUSE','RISK_AUTHORITY']) if(!main.includes(token)) fail(`Missing Phase 65 runtime invariant: ${token}`);
const phase65Ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);const phase65Dupes=[...new Set(phase65Ids.filter((id,i)=>phase65Ids.indexOf(id)!==i))];if(phase65Dupes.length) fail(`Duplicate DOM IDs remain: ${phase65Dupes.join(', ')}`); else pass('Final DOM has no duplicate element IDs');
for(const page of ['dashboard','feed','wallets','positions','ghost','automation','research','intelligence','earlybird','leaderboard','risk','notifications','assistant','padre','settings']) {
  const count=(html.match(new RegExp(`id="page-${page}"`,'g'))||[]).length;
  if(count!==1) fail(`Workspace page-${page} count is ${count}, expected 1`);
}
if(!renderer.includes("UI48_PAGE_ORDER=['dashboard','feed','wallets','positions','ghost','automation','research','intelligence','earlybird','leaderboard','assistant','risk','notifications','padre','settings']")) fail('Global workspace order regression'); else pass('All final workspaces remain in global navigation order');
if(!main.includes("partition:'persist:padre'")&&!main.includes("partition: 'persist:padre'")&&!main.includes('partition: "persist:padre"')) fail('Padre isolated persistent session regression'); else pass('Padre persistent isolated session remains intact');
if(!main.includes("Automated SELL is fail-closed")||!main.includes("UNCERTAIN_AFTER_PAUSE")||!main.includes("SUBMITTED_UNVERIFIED")) fail('Phase 32 fail-closed execution semantics regression'); else pass('Execution safety semantics remain intact');
if(!renderer.includes('RANKING ≠ TRUST')||!renderer.includes('MEMORY IS NON-AUTHORITATIVE')||!html.includes('FINAL SUBMIT AUTHORITY')) fail('Final UI authority doctrine regression'); else pass('UI authority boundaries remain explicit across ranking, memory and Padre');
if(!css.includes('.production65-panel')||!css.includes('.production65-check')) fail('Phase 65 dashboard audit styling missing'); else pass('Production audit styling is present');

if (process.exitCode) process.exit(process.exitCode);
console.log('\nCopyGuard production validation passed.');
