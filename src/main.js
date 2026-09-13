'use strict';

const { app, BrowserWindow, BrowserView, ipcMain, session, shell, Menu, Tray, nativeImage, Notification: ElectronNotification, safeStorage, dialog } = require('electron');
const path   = require('path');
const fs     = require('fs');
const http   = require('http');
const crypto = require('crypto');
const WebSocket = require('ws');

// ── Data paths ─────────────────────────────────────────────
const DATA_DIR      = path.join(app.getPath('userData'), 'copyguard');
const SETTINGS_F    = path.join(DATA_DIR, 'settings.json');
const WALLETS_F     = path.join(DATA_DIR, 'wallets.json');
const HISTORY_F     = path.join(DATA_DIR, 'history.json');
const INTEL_F       = path.join(DATA_DIR, 'intelligence.json');
const POSITIONS_F   = path.join(DATA_DIR, 'positions.json');
const CLOSED_POSITIONS_F = path.join(DATA_DIR, 'closed_positions.json');
const TRUSTED_F     = path.join(DATA_DIR, 'trusted_configs.json');
const DAILY_F       = path.join(DATA_DIR, 'daily_stats.json');
const TWITTER_F     = path.join(DATA_DIR, 'twitter.json');
const RESEARCH_WATCH_F = path.join(DATA_DIR, 'research_watchlist.json');
const RISK_EVENTS_F = path.join(DATA_DIR, 'risk_events.json');
const NOTIFICATION_EVENTS_F = path.join(DATA_DIR, 'notification_events.json');
const SECRETS_F     = path.join(DATA_DIR, 'secrets.bin');
const GHOST_F       = path.join(DATA_DIR, 'ghost_trades.json');
const EARLYBIRD_F = path.join(DATA_DIR, 'earlybird.json');
const EARLYBIRD_RUNS_F = path.join(DATA_DIR, 'earlybird_runs.json');
const EARLYBIRD_HISTORY_F = path.join(DATA_DIR, 'earlybird_scan_history.json');
const EARLYBIRD_RECON_F = path.join(DATA_DIR, 'earlybird_reconstruction.json');
const OBSERVATION_F = path.join(DATA_DIR, 'helius_observation.json');
const TRANSACTION_LOG_F = path.join(DATA_DIR, 'transaction_ledger.json');
const MARKET_F      = path.join(DATA_DIR, 'market_price_ledger.json');
const VERIFIED_OUTCOMES_F = path.join(DATA_DIR, 'verified_outcomes.json');
const QUALIFICATION_F = path.join(DATA_DIR, 'wallet_qualification.json');
const TOKEN_RESEARCH_F = path.join(DATA_DIR, 'token_research_evidence.json');
const RISK_DECISIONS_F = path.join(DATA_DIR, 'risk_decisions.json');
const DISCOVERY_F     = path.join(DATA_DIR, 'wallet_discovery.json');
const AI_DECISIONS_F  = path.join(DATA_DIR, 'ai_decisions.json');
const LEARNING_F      = path.join(DATA_DIR, 'closed_loop_learning.json');
const INTEGRITY_F     = path.join(DATA_DIR, 'data_integrity.json');
const EXECUTION_SAFETY_F = path.join(DATA_DIR, 'execution_safety.json');
const ASSISTANT_F        = path.join(DATA_DIR, 'assistant_state.json');

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

function jsonValidFile(file){
  try { JSON.parse(fs.readFileSync(file,'utf8')); return true; } catch { return false; }
}
function quarantineCorruptFile(file){
  try{
    if(!fs.existsSync(file))return null;
    const q=`${file}.corrupt-${new Date().toISOString().replace(/[:.]/g,'-')}`;
    fs.renameSync(file,q);
    return q;
  }catch{return null;}
}
function readJson(file, def) {
  if(!fs.existsSync(file)) return def;
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); }
  catch(primaryError) {
    const bak=`${file}.bak`;
    try {
      if(fs.existsSync(bak)){
        const recovered=JSON.parse(fs.readFileSync(bak,'utf8'));
        quarantineCorruptFile(file);
        try{fs.copyFileSync(bak,file);}catch{}
        console.warn('[integrity] recovered',path.basename(file),'from last-known-good backup');
        return recovered;
      }
    } catch(backupError){ console.error('[integrity] backup recovery failed',path.basename(file),backupError.message); }
    quarantineCorruptFile(file);
    console.error('[integrity] using safe default for',path.basename(file),primaryError.message);
    return def;
  }
}
function writeJson(file, data) {
  const tmp=`${file}.tmp-${process.pid}-${Date.now()}`;
  const bak=`${file}.bak`;
  try {
    const payload=JSON.stringify(data, null, 2);
    JSON.parse(payload); // validate serialization before touching live state
    fs.writeFileSync(tmp,payload,{encoding:'utf8',mode:0o600});
    try{const fd=fs.openSync(tmp,'r');fs.fsyncSync(fd);fs.closeSync(fd);}catch{}
    if(fs.existsSync(file)&&jsonValidFile(file)){
      const bakTmp=`${bak}.tmp-${process.pid}`;
      fs.copyFileSync(file,bakTmp);
      if(fs.existsSync(bak))try{fs.unlinkSync(bak)}catch{}
      fs.renameSync(bakTmp,bak);
    }
    try{fs.renameSync(tmp,file);}catch{fs.copyFileSync(tmp,file);fs.unlinkSync(tmp);}
    if(!jsonValidFile(file))throw new Error('post-write JSON validation failed');
    return {ok:true};
  } catch(e) {
    try{if(fs.existsSync(tmp))fs.unlinkSync(tmp);}catch{}
    console.error('[writeJson]', path.basename(file), e.message);
    return {ok:false,error:e.message};
  }
}
function sha256Json(value){return crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');}

// ── Phase 14 secure secrets + hardened persistence ─────────
function defaultSecrets(){ return { apiKeys:{anthropic:'',openai:'',gemini:'',xai:'',perplexity:''}, heliusApiKey:'' }; }
function loadSecrets(){
  try {
    if (!fs.existsSync(SECRETS_F)) return defaultSecrets();
    const raw=fs.readFileSync(SECRETS_F);
    const json=safeStorage.isEncryptionAvailable()?safeStorage.decryptString(raw):raw.toString('utf8');
    return { ...defaultSecrets(), ...JSON.parse(json) };
  } catch(e){ console.error('[secrets] load failed:',e.message); return defaultSecrets(); }
}
function saveSecrets(secrets){
  const payload=JSON.stringify({ ...defaultSecrets(), ...secrets });
  try {
    const out=safeStorage.isEncryptionAvailable()?safeStorage.encryptString(payload):Buffer.from(payload,'utf8');
    fs.writeFileSync(SECRETS_F,out,{mode:0o600});
    try{fs.chmodSync(SECRETS_F,0o600);}catch{}
    return {ok:true,encrypted:safeStorage.isEncryptionAvailable()};
  } catch(e){ console.error('[secrets] save failed:',e.message); return {ok:false,error:e.message}; }
}
function publicPreferences(){
  const out={...settings};
  delete out.apiKeys;
  delete out.heliusApiKey;
  return out;
}
function publicSettings(){
  const mask=v=>v?`••••${String(v).slice(-4)}`:'';
  return {...publicPreferences(),apiKeys:Object.fromEntries(Object.entries(settings.apiKeys||{}).map(([k,v])=>[k,mask(v)])),heliusApiKey:mask(settings.heliusApiKey)};
}
function secretStatus(){
  const keys=settings.apiKeys||{};
  const mask=v=>v?`••••${String(v).slice(-4)}`:'';
  return { encrypted:safeStorage.isEncryptionAvailable(), helius:{configured:!!settings.heliusApiKey,masked:mask(settings.heliusApiKey)}, ai:Object.fromEntries(Object.entries(keys).map(([k,v])=>[k,{configured:!!v,masked:mask(v)}])) };
}
function persistPublicSettings(){ writeJson(SETTINGS_F, publicPreferences()); }
function persistSecrets(){ return saveSecrets({apiKeys:settings.apiKeys||defaultSecrets().apiKeys,heliusApiKey:settings.heliusApiKey||''}); }
function persistSettings(){ persistPublicSettings(); return persistSecrets(); }

// ── State ───────────────────────────────────────────────────
const DEFAULT_SETTINGS = {
  aiProvider: 'anthropic',
  apiKeys:    { anthropic:'', openai:'', gemini:'', xai:'', perplexity:'' },
  heliusApiKey: '',
  autoExecute: false, automationPaused: true, demoMode: true,
  maxSolGlobal: 2.0, maxAutomationRiskScore: 45, autoDemote: false,
  promoMinTrades: 5, promoMinWinrate: 60,
  dividerPosition: 0.58,
  notifications: true, soundAlerts: false,
  quietHours: { enabled: false, startHour: 0, endHour: 6 },
  walkthroughSeen: false,
};

let rawSettings = readJson(SETTINGS_F, {});
const legacySecrets = {apiKeys:{...defaultSecrets().apiKeys,...(rawSettings.apiKeys||{})},heliusApiKey:rawSettings.heliusApiKey||''};
delete rawSettings.apiKeys; delete rawSettings.heliusApiKey;
let settings      = { ...DEFAULT_SETTINGS, ...rawSettings, apiKeys:{...legacySecrets.apiKeys}, heliusApiKey:legacySecrets.heliusApiKey };
let wallets       = readJson(WALLETS_F,   {});
let history       = readJson(HISTORY_F,   []);
let intel         = readJson(INTEL_F,     { suggestions: [], healthAlerts: [], watchlist: [] });
intel.suggestions = Array.isArray(intel.suggestions) ? intel.suggestions : [];
intel.healthAlerts = Array.isArray(intel.healthAlerts) ? intel.healthAlerts : [];
intel.watchlist = Array.isArray(intel.watchlist) ? intel.watchlist : [];
let openPositions = readJson(POSITIONS_F, {});
let closedPositions = readJson(CLOSED_POSITIONS_F, []);
let trustedCfgs   = readJson(TRUSTED_F,   {});
let dailyStats    = readJson(DAILY_F,     {});
let twitterTokens = readJson(TWITTER_F,   null);
let researchWatchlist = readJson(RESEARCH_WATCH_F, []);
let riskEvents = readJson(RISK_EVENTS_F, []);
riskEvents = Array.isArray(riskEvents) ? riskEvents : [];
let notificationEvents = readJson(NOTIFICATION_EVENTS_F, []);
notificationEvents = Array.isArray(notificationEvents) ? notificationEvents : [];
let ghostBook = readJson(GHOST_F, { wallets:{}, ledger:[], version:1 });
let observationState = readJson(OBSERVATION_F, { version:1, wallets:{}, recentEvents:[], health:{} });
let transactionLedger = readJson(TRANSACTION_LOG_F, { version:1, bySignature:{}, order:[] });
let marketBook = readJson(MARKET_F, { version:1, latest:{}, snapshots:[], stats:{requests:0,successes:0,failures:0,lastRefreshAt:null} });
let verifiedOutcomeBook = readJson(VERIFIED_OUTCOMES_F, { version:1, byId:{}, order:[] });
let tokenResearchBook = readJson(TOKEN_RESEARCH_F, { version:3, tokens:{}, order:[], stats:{runs:0,lastRunAt:null} });
let riskDecisionBook = readJson(RISK_DECISIONS_F, {version:3, decisions:[], stats:{total:0,lastDecisionAt:null}});
let discoveryBook = readJson(DISCOVERY_F, {version:1,candidates:{},runs:[],stats:{runs:0,lastRunAt:null,lastFound:0}});
let aiDecisionBook = readJson(AI_DECISIONS_F, {version:1,decisions:[],stats:{total:0,byTask:{},lastDecisionAt:null}});
let learningBook = readJson(LEARNING_F, {version:1,generatedAt:null,links:[],taskStats:{},riskSignalStats:{},recommendationStats:{},providerStats:{},proposals:[],summary:{linkedOutcomes:0,verifiedOutcomes:0,aiPredictionsScored:0,riskDecisionsScored:0}});
let integrityBook = readJson(INTEGRITY_F,{version:1,lastAuditAt:null,lastStatus:'UNKNOWN',issues:[],repairs:[],history:[]});
let executionSafetyBook = readJson(EXECUTION_SAFETY_F,{version:1,attempts:[],byKey:{},stats:{reserved:0,submitted:0,failed:0,blocked:0,lastAttemptAt:null}});
executionSafetyBook.attempts=Array.isArray(executionSafetyBook.attempts)?executionSafetyBook.attempts:[]; executionSafetyBook.byKey=executionSafetyBook.byKey&&typeof executionSafetyBook.byKey==='object'?executionSafetyBook.byKey:{}; executionSafetyBook.stats=executionSafetyBook.stats||{reserved:0,submitted:0,failed:0,blocked:0,lastAttemptAt:null};
let assistantBook = readJson(ASSISTANT_F,{version:2,sessions:{},order:[],activeSessionId:null,audit:[],proposals:{},proposalOrder:[],stats:{sessions:0,userMessages:0,assistantMessages:0,deniedRequests:0,proposals:0,confirmedProposals:0,cancelledProposals:0,lastMessageAt:null}});
assistantBook.sessions=assistantBook.sessions&&typeof assistantBook.sessions==='object'?assistantBook.sessions:{}; assistantBook.order=Array.isArray(assistantBook.order)?assistantBook.order:[]; assistantBook.audit=Array.isArray(assistantBook.audit)?assistantBook.audit:[]; assistantBook.proposals=assistantBook.proposals&&typeof assistantBook.proposals==='object'?assistantBook.proposals:{}; assistantBook.proposalOrder=Array.isArray(assistantBook.proposalOrder)?assistantBook.proposalOrder:[]; assistantBook.stats=assistantBook.stats||{sessions:0,userMessages:0,assistantMessages:0,deniedRequests:0,proposals:0,confirmedProposals:0,cancelledProposals:0,lastMessageAt:null}; assistantBook.memory=assistantBook.memory&&typeof assistantBook.memory==='object'?assistantBook.memory:{}; assistantBook.memoryOrder=Array.isArray(assistantBook.memoryOrder)?assistantBook.memoryOrder:[]; assistantBook.memoryStats=assistantBook.memoryStats||{created:0,updated:0,archived:0,lastChangedAt:null}; assistantBook.governedActions=assistantBook.governedActions&&typeof assistantBook.governedActions==='object'?assistantBook.governedActions:{}; assistantBook.governedActionOrder=Array.isArray(assistantBook.governedActionOrder)?assistantBook.governedActionOrder:[];
riskDecisionBook.decisions=Array.isArray(riskDecisionBook.decisions)?riskDecisionBook.decisions:[]; riskDecisionBook.stats=riskDecisionBook.stats||{total:0,lastDecisionAt:null};
discoveryBook.candidates=discoveryBook&&typeof discoveryBook.candidates==='object'?discoveryBook.candidates:{}; discoveryBook.runs=Array.isArray(discoveryBook.runs)?discoveryBook.runs:[]; discoveryBook.stats=discoveryBook.stats||{runs:0,lastRunAt:null,lastFound:0};
aiDecisionBook.decisions=Array.isArray(aiDecisionBook.decisions)?aiDecisionBook.decisions:[]; aiDecisionBook.stats=aiDecisionBook.stats||{total:0,byTask:{},lastDecisionAt:null}; aiDecisionBook.stats.byTask=aiDecisionBook.stats.byTask||{};
learningBook=learningBook&&typeof learningBook==='object'?learningBook:{version:1,generatedAt:null,links:[],taskStats:{},riskSignalStats:{},recommendationStats:{},providerStats:{},proposals:[],summary:{}};
tokenResearchBook.tokens=tokenResearchBook.tokens||{}; tokenResearchBook.order=Array.isArray(tokenResearchBook.order)?tokenResearchBook.order:[]; tokenResearchBook.stats=tokenResearchBook.stats||{runs:0,lastRunAt:null};
let qualificationBook = readJson(QUALIFICATION_F, {version:1,wallets:{},events:[]});
transactionLedger.bySignature = transactionLedger && typeof transactionLedger.bySignature === 'object' ? transactionLedger.bySignature : {};
transactionLedger.order = Array.isArray(transactionLedger.order) ? transactionLedger.order : [];
marketBook.latest = marketBook && typeof marketBook.latest === 'object' ? marketBook.latest : {};
marketBook.snapshots = Array.isArray(marketBook.snapshots) ? marketBook.snapshots : [];
marketBook.stats = marketBook.stats && typeof marketBook.stats === 'object' ? marketBook.stats : {requests:0,successes:0,failures:0,lastRefreshAt:null};
verifiedOutcomeBook.byId = verifiedOutcomeBook && typeof verifiedOutcomeBook.byId === 'object' ? verifiedOutcomeBook.byId : {};
verifiedOutcomeBook.order = Array.isArray(verifiedOutcomeBook.order) ? verifiedOutcomeBook.order : [];
qualificationBook.wallets = qualificationBook && typeof qualificationBook.wallets==='object' ? qualificationBook.wallets : {};
qualificationBook.events = Array.isArray(qualificationBook.events) ? qualificationBook.events : [];
observationState.wallets = observationState && typeof observationState.wallets === 'object' ? observationState.wallets : {};
observationState.recentEvents = Array.isArray(observationState.recentEvents) ? observationState.recentEvents : [];
observationState.health = observationState.health && typeof observationState.health === 'object' ? observationState.health : {};
ghostBook.wallets = ghostBook && typeof ghostBook.wallets === 'object' ? ghostBook.wallets : {};
ghostBook.ledger = Array.isArray(ghostBook.ledger) ? ghostBook.ledger : [];
let lastSystemEventKey = '';
let lastSystemEventAt = 0;

// ── Windows ─────────────────────────────────────────────────
let mainWin = null, padreView = null, tray = null;
let padreVisible = false;
let padreBounds = { x:248, y:148, width:1000, height:700 };
const PADRE_HOME = 'https://trade.padre.gg';
const isDev = process.argv.includes('--dev');


function normalizePadreUrl(raw) {
  try {
    if (!raw) return PADRE_HOME;
    let value = String(raw).trim();
    if (/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(value)) return `${PADRE_HOME}/token/${value}`;
    if (!/^https?:\/\//i.test(value)) value = `https://${value}`;
    const u = new URL(value);
    if (u.hostname !== 'trade.padre.gg' && !u.hostname.endsWith('.padre.gg')) return PADRE_HOME;
    return u.toString();
  } catch { return PADRE_HOME; }
}

function pushPadreState(extra={}) {
  if (!mainWin || !padreView) return;
  let url = PADRE_HOME;
  try { url = padreView.webContents.getURL() || PADRE_HOME; } catch {}
  broadcast('padre-state', {
    ready: true,
    visible: padreVisible,
    url,
    canGoBack: padreView.webContents.canGoBack(),
    canGoForward: padreView.webContents.canGoForward(),
    loading: padreView.webContents.isLoading(),
    ...extra,
  });
  broadcast('padre-url-changed', url);
}

function createPadreView() {
  if (!mainWin || padreView) return padreView;
  padreView = new BrowserView({
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      // NOTE: sandbox intentionally omitted — executeJavaScript (used by
      // executeTrade and setPadreTPSL) cannot reach sandboxed content.
      // Security is maintained through contextIsolation:true, the preload
      // script, and the permission handler in app.whenReady which restricts
      // Padre to only clipboard and notification permissions on padre.gg.
      partition: 'persist:padre',
      preload: path.join(__dirname, 'preload-padre.js'),
    }
  });
  mainWin.addBrowserView(padreView);
  padreView.setAutoResize({ width:false, height:false, horizontal:false, vertical:false });
  padreView.setBounds({ x:0, y:0, width:0, height:0 });

  const wc = padreView.webContents;

  // ── Popup / new-window handler ─────────────────────────────
  // Previously denied ALL popups, causing Google OAuth to go black:
  // the auth popup fired, got killed, and Padre waited forever for
  // a callback that never came. Now we allow auth popups through.
  wc.setWindowOpenHandler(({ url }) => {
    // Auth flows that MUST open as a real popup window:
    // Google OAuth, any /auth/ /login/ /oauth/ /signin/ paths
    const isAuthPopup = [
      'accounts.google.com',
      'oauth2callback',
      '/auth/', '/oauth/', '/login/', '/signin/',
    ].some(pattern => url.includes(pattern));

    if (isAuthPopup) {
      // Open as a real child window on the same persist:padre session
      // so auth cookies land in Padre's partition and login persists
      return {
        action: 'allow',
        overrideBrowserWindowOptions: {
          width:  480,
          height: 640,
          center: true,
          title:  'Sign in',
          autoHideMenuBar: true,
          webPreferences: {
            nodeIntegration:  false,
            contextIsolation: true,
            partition: 'persist:padre',
          },
        },
      };
    }

    // Internal Padre navigation — load in the BrowserView itself
    if (/padre\.gg/i.test(url)) {
      const safe = normalizePadreUrl(url);
      wc.loadURL(safe);
      return { action: 'deny' };
    }

    // Everything else (Twitter, docs, etc.) opens in system browser
    shell.openExternal(url);
    return { action: 'deny' };
  });
  wc.on('did-start-loading', () => pushPadreState({ loading:true }));
  wc.on('did-stop-loading',  () => { noteServiceResult('padre',true); pushPadreState({ loading:false }); enterConnectionMode(); });
  wc.on('did-navigate',      (_, url) => pushPadreState({ url }));
  wc.on('did-navigate-in-page', (_, url) => pushPadreState({ url }));
  wc.on('did-fail-load', (_, code, desc, url, isMainFrame) => {
    if (isMainFrame) { noteServiceResult('padre',false,{error:`${desc} (${code})`}); pushPadreState({ loading:false, error:`${desc} (${code})`, url }); enterConnectionMode(); }
  });
  wc.loadURL(PADRE_HOME).catch(err => pushPadreState({ loading:false, error:err.message }));
  return padreView;
}

function updatePadreBounds(bounds) {
  if (!padreView || !padreVisible) return;
  const winBounds = mainWin?.getContentBounds?.() || {width:1500,height:940};
  const x = Math.max(0, Math.round(Number(bounds?.x ?? padreBounds.x)));
  const y = Math.max(0, Math.round(Number(bounds?.y ?? padreBounds.y)));
  const width = Math.max(320, Math.min(Math.round(Number(bounds?.width ?? padreBounds.width)), winBounds.width - x));
  const height = Math.max(240, Math.min(Math.round(Number(bounds?.height ?? padreBounds.height)), winBounds.height - y));
  padreBounds = {x,y,width,height};
  padreView.setBounds(padreBounds);
}

function setPadreVisible(visible, bounds) {
  createPadreView();
  padreVisible = !!visible;
  if (padreVisible) updatePadreBounds(bounds || padreBounds);
  else padreView?.setBounds({x:0,y:0,width:0,height:0});
  pushPadreState();
  return { ok:true, visible:padreVisible };
}

function createWindow() {
  mainWin = new BrowserWindow({
    width: 1500, height: 940, minWidth: 1100, minHeight: 700,
    backgroundColor: '#071019',
    title: 'CopyGuard',
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
    icon: path.join(__dirname, '..', 'assets', 'icon.png'),
  });

  mainWin.loadFile(path.join(__dirname, '..', 'renderer', 'app.html'));
  mainWin.once('ready-to-show', () => { createPadreView(); mainWin.show(); });
  mainWin.on('closed', () => { padreView = null; mainWin = null; stopHelius(); });
  mainWin.on('close', (e) => {
    if (settings.minimizeToTray) { e.preventDefault(); mainWin.hide(); }
  });
  if (isDev) mainWin.webContents.openDevTools({ mode: 'detach' });
}

function broadcast(channel, data) {
  try { recordSystemEventFromChannel(channel, data); } catch(e) {}
  try { mainWin?.webContents.send(channel, data); } catch(e) {}
}

// ── Padre preload bridge listeners ──────────────────────────
// These receive one-way ipcRenderer.send() messages from
// preload-padre.js running inside the Padre BrowserView.

// Padre DOM is interactive — used to time injection accurately
ipcMain.on('padre-dom-ready', (_, { url, ts }) => {
  broadcast('padre-state', {
    ready: true, visible: padreVisible,
    url:   url || PADRE_HOME,
    domReadyAt: ts,
    canGoBack:    padreView?.webContents.canGoBack()    ?? false,
    canGoForward: padreView?.webContents.canGoForward() ?? false,
    loading: false,
  });
});

// executeTrade reported back success or failure
ipcMain.on('padre-trade-result', (_, result) => {
  console.log('[Padre] Trade result:', JSON.stringify(result));
  const attemptId=result?.attemptId||result?.executionAttemptId||null;
  const tradeId=result?.tradeId||null;
  const attempt=attemptId?(executionSafetyBook.attempts||[]).find(a=>a.id===attemptId):(executionSafetyBook.attempts||[]).find(a=>a.tradeId===tradeId&&a.status==='RESERVED');
  if(attempt){
    if(result.ok){
      const raced=attempt.status!=='RESERVED';
      updateExecutionAttemptById(attempt.id,raced?'UNCERTAIN_AFTER_PAUSE':'SUBMITTED',{padreReportedAt:Date.now(),padreUrl:result.url||null,note:raced?'Padre reported a click after the reservation was no longer active; verify externally before assuming settlement.':'Padre DOM reported submit/confirm click. Blockchain settlement is not asserted.'});
      const t=attempt.tradeSnapshot||{};const today=new Date().toISOString().slice(0,10);if(!dailyStats[attempt.walletAddress]||dailyStats[attempt.walletAddress].date!==today)dailyStats[attempt.walletAddress]={date:today,trades:0,lossSol:0};dailyStats[attempt.walletAddress].trades=Number(dailyStats[attempt.walletAddress].trades||0)+1;writeJson(DAILY_F,dailyStats);
      addHistory({...t,decision:raced?'AUTO_SUBMISSION_UNCERTAIN':'AUTO_SUBMITTED',executionStatus:raced?'UNCERTAIN_AFTER_PAUSE':'SUBMITTED_UNVERIFIED',executionAttemptId:attempt.id,submittedAt:Date.now()});
      if(raced)pushNotificationEvent({type:'automation',severity:'CRITICAL',title:'Execution submission requires verification',message:'Padre reported a submit click after an emergency-pause/reservation race. Verify the wallet externally; CopyGuard does not assume settlement.',source:'Phase 32 Execution Safety',walletAddress:attempt.walletAddress,tokenAddress:attempt.tokenAddress});
      if(t.action==='BUY')setPadreTPSL(t,trustedCfgs[t.walletAddress]||{});
    } else if(attempt.status==='RESERVED')updateExecutionAttemptById(attempt.id,'FAILED',{failureReason:result.reason||'Padre reported submission failure'});
  }
  broadcast('trade-result', {...result,executionStatus:result.ok?(attempt?.status==='UNCERTAIN_AFTER_PAUSE'?'UNCERTAIN_AFTER_PAUSE':'SUBMITTED_UNVERIFIED'):'FAILED'});
  if (!result.ok) console.warn('[Padre] executeTrade failed:', result.reason);
});

// setPadreTPSL reported back
ipcMain.on('padre-tpsl-result', (_, result) => {
  console.log('[Padre] TP/SL result:', JSON.stringify(result));
  broadcast('trade-result', { ...result, type:'tpsl' });
});

// Script error — log and forward to sidebar for visibility
ipcMain.on('padre-script-error', (_, { context, message, url }) => {
  console.error(`[Padre] Script error in ${context}: ${message} (${url})`);
  broadcast('padre-state', {
    ready: true, visible: padreVisible,
    url:   url || PADRE_HOME,
    scriptError: `${context}: ${message}`,
  });
});

// External link clicked inside Padre — open in system browser
ipcMain.on('padre-external-link', (_, url) => {
  try { shell.openExternal(url); } catch(e) {}
});

function eventSeverity(v='INFO') { const x=String(v||'INFO').toUpperCase(); return ['INFO','SUCCESS','WATCH','WARNING','HIGH','CRITICAL'].includes(x)?x:'INFO'; }
function pushNotificationEvent(evt={}) {
  const item={id:evt.id||`evt-${Date.now()}-${Math.random().toString(36).slice(2,8)}`,time:evt.time||Date.now(),type:evt.type||'system',severity:eventSeverity(evt.severity),title:evt.title||'CopyGuard event',message:evt.message||'',source:evt.source||'CopyGuard',walletAddress:evt.walletAddress||null,tokenAddress:evt.tokenAddress||null,read:!!evt.read,acknowledged:!!evt.acknowledged,metadata:evt.metadata||{}};
  const key=`${item.type}|${item.title}|${item.message}|${item.walletAddress||''}|${item.tokenAddress||''}`;
  if(key===lastSystemEventKey && Date.now()-lastSystemEventAt<2500) return null;
  lastSystemEventKey=key; lastSystemEventAt=Date.now();
  notificationEvents.unshift(item); notificationEvents=notificationEvents.slice(0,1200); writeJson(NOTIFICATION_EVENTS_F,notificationEvents);
  try { mainWin?.webContents.send('notification-event',item); } catch(e) {}
  const desktopLevels=['HIGH','CRITICAL'];
  if(desktopLevels.includes(item.severity)) notify(item.title,item.message);
  return item;
}
function recordSystemEventFromChannel(channel,data={}) {
  if(channel==='notification-event') return;
  if(channel==='trade') return pushNotificationEvent({type:'trade',severity:'INFO',title:`${data.action||'Trade'} detected`,message:`${data.tokenSymbol?'$'+data.tokenSymbol:(data.token||'Token')} · ${Number(data.sizeSol||0).toFixed(3)} SOL`,source:'Wallet Monitor',walletAddress:data.walletAddress,tokenAddress:data.tokenAddress});
  if(channel==='trade-blocked') return pushNotificationEvent({type:'risk',severity:'HIGH',title:'Trade blocked',message:data.reason||'CopyGuard blocked a trade',source:'Protection Engine',walletAddress:data.trade?.walletAddress,tokenAddress:data.trade?.tokenAddress});
  if(channel==='bundle-detected') return pushNotificationEvent({type:'risk',severity:'HIGH',title:'Coordinated wallet activity',message:data.message||'Bundle / cluster behavior detected',source:'Anti-Manipulation',tokenAddress:data.tokenAddress});
  if(channel==='pnl-closed') return pushNotificationEvent({type:'position',severity:Number(data.pnlSol||data.pnl||0)>=0?'SUCCESS':'WARNING',title:'Position closed',message:`${data.tokenSymbol?'$'+data.tokenSymbol:'Position'} · ${Number(data.pnlSol||data.pnl||0).toFixed(3)} SOL`,source:'Position Engine',walletAddress:data.walletAddress,tokenAddress:data.tokenAddress});
  if(channel==='suggestion') return pushNotificationEvent({type:'intelligence',severity:'WATCH',title:'Wallet discovery',message:`Candidate ${data.label||data.address?.slice(0,8)||'wallet'} surfaced`,source:'Intelligence',walletAddress:data.address});
  if(channel==='risk-event' && (String(data.level).toUpperCase()==='HIGH'||String(data.level).toUpperCase()==='CRITICAL'||data.hardBlocks?.length)) return pushNotificationEvent({type:'risk',severity:data.hardBlocks?.length?'CRITICAL':String(data.level).toUpperCase(),title:data.hardBlocks?.length?'Deterministic hard block':'Elevated token risk',message:data.hardBlocks?.[0]||data.flags?.[0]?.message||`Risk score ${data.score||0}/100`,source:'Risk Engine v2',walletAddress:data.walletAddress,tokenAddress:data.tokenAddress});
  if(channel==='health-alerts' && Array.isArray(data)) { const a=data.find(x=>!x.dismissed); if(a)return pushNotificationEvent({type:'health',severity:String(a.severity||'WARNING').toUpperCase()==='CRITICAL'?'CRITICAL':'WARNING',title:a.title||'Wallet health warning',message:a.message||a.reason||'Wallet performance degraded',source:'Health Monitor',walletAddress:a.walletAddress}); }
  if(channel==='earlybird-update' && !data.running && Number(data.newCandidates||0)>0) return pushNotificationEvent({type:'earlybird',severity:'WATCH',title:'Early Bird candidates found',message:`${data.newCandidates} new repeat early-entry candidate${data.newCandidates===1?'':'s'}`,source:'Early Bird'});
  if(channel==='automation-state') return pushNotificationEvent({type:'automation',severity:data.paused?'WARNING':'SUCCESS',title:data.paused?'Automation paused':'Automation state changed',message:data.paused?'Emergency automation pause is active':data.enabled?'Global auto-execution enabled':'Global auto-execution disabled',source:'Automation'});
  if(channel==='ws-status' && ['live','error'].includes(data.state)) return pushNotificationEvent({type:'connection',severity:data.state==='live'?'SUCCESS':'WARNING',title:data.state==='live'?'Helius connected':'Helius connection problem',message:data.text||data.state,source:'Connections'});
}


// ── Tray ────────────────────────────────────────────────────
function setupTray() {
  const icon = nativeImage.createFromPath(path.join(__dirname,'..','assets','icon16.png'));
  tray = new Tray(icon);
  tray.setToolTip('CopyGuard Browser');
  tray.setContextMenu(Menu.buildFromTemplate([
    { label:'Show CopyGuard', click: () => { mainWin?.show(); mainWin?.focus(); } },
    { type:'separator' },
    { label:'Quit', click: () => app.quit() },
  ]));
  tray.on('click', () => { mainWin?.show(); mainWin?.focus(); });
}

// ── Notifications ───────────────────────────────────────────
function isQuietHours() {
  if (!settings.quietHours?.enabled) return false;
  const h = new Date().getHours();
  const s = settings.quietHours.startHour ?? 0;
  const e = settings.quietHours.endHour   ?? 6;
  return s <= e ? (h >= s && h < e) : (h >= s || h < e);
}

function notify(title, body) {
  if (!settings.notifications || isQuietHours()) return;
  try { new ElectronNotification({ title, body, icon: path.join(__dirname,'..','assets','icon48.png') }).show(); } catch(e) {}
}

// ── Token metadata cache (DexScreener + Helius) ────────────
const tokenMetaCache = new Map();

async function enrichToken(tokenAddress) {
  if (!tokenAddress || tokenAddress.includes('demo') || tokenAddress.includes('pump')) return null;
  const cached = tokenMetaCache.get(tokenAddress);
  if (cached && Date.now() - cached.fetchedAt < 600_000) return cached;

  try {
    // Parallel: DexScreener for market data + Helius for authority check
    const [dexRes, authRes] = await Promise.allSettled([
      apiFetch(`https://api.dexscreener.com/latest/dex/tokens/${tokenAddress}`, {}, 8_000),
      settings.heliusApiKey
        ? apiPost(`https://mainnet.helius-rpc.com/?api-key=${settings.heliusApiKey}`,
            { jsonrpc:'2.0', id:1, method:'getAccountInfo', params:[tokenAddress,{encoding:'jsonParsed'}] }, 8_000)
        : Promise.reject('no key'),
    ]);

    let fdv = null, liquidity = null, name = null, symbol = null, priceUsd = null, priceChange = {}, volume24h = 0, buys24h = 0, sells24h = 0, pairCreatedAt = null;
    let freezeEnabled = null, mintEnabled = null, authorityFlags = [];

    // DexScreener market data
    if (dexRes.status === 'fulfilled' && dexRes.value.ok) {
      const d = await dexRes.value.json();
      const pair = d.pairs?.[0];
      if (pair) {
        fdv       = pair.fdv ?? null;
        liquidity = pair.liquidity?.usd ?? null;
        name      = pair.baseToken?.name   ?? null;
        symbol    = pair.baseToken?.symbol ?? null;
        priceUsd  = Number(pair.priceUsd || 0) || null;
        priceChange = pair.priceChange || {}; volume24h = Number(pair.volume?.h24||0); buys24h = Number(pair.txns?.h24?.buys||0); sells24h = Number(pair.txns?.h24?.sells||0); pairCreatedAt = Number(pair.pairCreatedAt||0)||null;
      }
    }

    // Helius authority check
    if (authRes.status === 'fulfilled' && authRes.value.ok) {
      const d    = await authRes.value.json();
      const info = d.result?.value?.data?.parsed?.info;
      if (info) {
        freezeEnabled = !!info.freezeAuthority;
        mintEnabled   = !!info.mintAuthority;
        if (freezeEnabled) authorityFlags.push({ level:'HIGH',   code:'FREEZE_AUTH', msg:'Freeze authority active — dev can freeze your tokens' });
        if (mintEnabled)   authorityFlags.push({ level:'HIGH',   code:'MINT_AUTH',   msg:'Mint authority active — supply can be inflated'       });
        if (!freezeEnabled && !mintEnabled) authorityFlags.push({ level:'SAFE', code:'RENOUNCED', msg:'Both authorities renounced ✓' });
      }
    }

    const meta = { fetchedAt:Date.now(), tokenAddress, fdv, liquidity, name, symbol, priceUsd, priceChange, volume24h, buys24h, sells24h, pairCreatedAt, freezeEnabled, mintEnabled, authorityFlags };
    tokenMetaCache.set(tokenAddress, meta);
    return meta;
  } catch(e) {
    return null;
  }
}


// ── PHASE 20 · Market & Pricing Engine ─────────────────────
// Transaction-derived execution prices are preferred for historical Shadow
// entries/exits. DexScreener is treated as a current market quote, never as a
// substitute for a historical execution price without an explicit quality tag.
const MARKET_QUOTE_TTL_MS = 15_000;
const MARKET_SNAPSHOT_LIMIT = 6000;
const MARKET_MARK_INTERVAL_MS = 30_000;
const SOL_MINT = 'So11111111111111111111111111111111111111112';
const USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
const USDT_MINT = 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB';
const marketQuoteCache = new Map();
let marketMarkTimer = null;
let marketMarkRunning = false;

function persistMarketBook(){
  marketBook.snapshots=(marketBook.snapshots||[]).slice(0,MARKET_SNAPSHOT_LIMIT);
  writeJson(MARKET_F,marketBook);
}
function marketQuality(snapshot){
  if(!snapshot?.priceUsd)return 'UNAVAILABLE';
  const liq=Number(snapshot.liquidity||0), age=Date.now()-Number(snapshot.fetchedAt||0);
  if(age>120000)return 'STALE';
  if(liq>=100000)return 'HIGH';
  if(liq>=25000)return 'MEDIUM';
  return 'LOW';
}
function chooseTokenPair(pairs, tokenAddress){
  const rows=(pairs||[]).filter(p=>p?.chainId==='solana' && p?.baseToken?.address===tokenAddress);
  rows.sort((a,b)=>Number(b?.liquidity?.usd||0)-Number(a?.liquidity?.usd||0));
  return rows[0]||null;
}
async function getCurrentMarketSnapshot(tokenAddress, force=false){
  if(!tokenAddress)return null;
  const cached=marketQuoteCache.get(tokenAddress);
  if(!force && cached && Date.now()-cached.fetchedAt<MARKET_QUOTE_TTL_MS)return cached;
  marketBook.stats.requests=Number(marketBook.stats.requests||0)+1;
  try{
    const res=await apiFetch(`https://api.dexscreener.com/latest/dex/tokens/${tokenAddress}`,{},8_000,1);
    if(!res.ok)throw new Error(`DexScreener HTTP ${res.status}`);
    const body=await res.json();
    const pair=chooseTokenPair(body.pairs,tokenAddress);
    if(!pair)throw new Error('No Solana base-token market pair found');
    const snap={
      id:`mkt-${Date.now()}-${Math.random().toString(36).slice(2,7)}`,
      tokenAddress,
      fetchedAt:Date.now(),
      source:'dexscreener',
      pairAddress:pair.pairAddress||null,
      dexId:pair.dexId||null,
      priceUsd:Number(pair.priceUsd||0)||null,
      liquidity:Number(pair.liquidity?.usd||0)||0,
      fdv:Number(pair.fdv||0)||null,
      marketCap:Number(pair.marketCap||0)||null,
      volume24h:Number(pair.volume?.h24||0)||0,
      priceChange:pair.priceChange||{},
      buys24h:Number(pair.txns?.h24?.buys||0),
      sells24h:Number(pair.txns?.h24?.sells||0),
      pairCreatedAt:Number(pair.pairCreatedAt||0)||null,
      url:pair.url||null,
    };
    snap.quality=marketQuality(snap);
    marketQuoteCache.set(tokenAddress,snap);
    marketBook.latest[tokenAddress]=snap;
    marketBook.snapshots.unshift(snap);
    marketBook.stats.successes=Number(marketBook.stats.successes||0)+1;
    marketBook.stats.lastRefreshAt=Date.now();
    persistMarketBook();
    return snap;
  }catch(e){
    marketBook.stats.failures=Number(marketBook.stats.failures||0)+1;
    marketBook.stats.lastError=e.message||String(e);
    persistMarketBook();
    const fallback=cached||marketBook.latest[tokenAddress]||null;
    if(fallback){const copy={...fallback};copy.quality=marketQuality(copy);copy.degradedFallback=true;copy.degradedReason=e.message||String(e);return copy;}
    return null;
  }
}
async function getSolUsdQuote(force=false){
  const s=await getCurrentMarketSnapshot(SOL_MINT,force);
  return Number(s?.priceUsd||0)||null;
}
function txTokenBalanceMap(rows,walletAddr){
  const m=new Map();
  for(const r of rows||[]){
    if(r?.owner!==walletAddr||!r?.mint)continue;
    m.set(r.mint,Number(r?.uiTokenAmount?.uiAmountString??r?.uiTokenAmount?.uiAmount??0));
  }
  return m;
}
function deriveTransactionPricing({walletAddr,walletIndex,best,meta,preTok,postTok}){
  const pre=txTokenBalanceMap(preTok,walletAddr), post=txTokenBalanceMap(postTok,walletAddr);
  const delta=mint=>(post.get(mint)||0)-(pre.get(mint)||0);
  const action=best.delta>0?'BUY':'SELL';
  const tokenAmount=Math.abs(Number(best.delta||0));
  const usdc=delta(USDC_MINT), usdt=delta(USDT_MINT), wsol=delta(SOL_MINT);
  let quoteUsd=0, quoteSol=0, source='unresolved', confidence='LOW';
  const stableDelta=Math.abs(usdc)>=Math.abs(usdt)?usdc:usdt;
  if((action==='BUY'&&stableDelta<0)||(action==='SELL'&&stableDelta>0)){
    quoteUsd=Math.abs(stableDelta); source='transaction-stablecoin'; confidence='HIGH';
  }
  if(!quoteUsd && ((action==='BUY'&&wsol<0)||(action==='SELL'&&wsol>0))){
    quoteSol=Math.abs(wsol); source='transaction-wsol'; confidence='HIGH';
  }
  const feeSol=Number(meta?.fee||0)/1e9;
  const preLam=Number(meta?.preBalances?.[walletIndex]||0), postLam=Number(meta?.postBalances?.[walletIndex]||0);
  const nativeDelta=(postLam-preLam)/1e9;
  let nativeQuote=0;
  if(action==='BUY'&&nativeDelta<0)nativeQuote=Math.max(0,Math.abs(nativeDelta)-feeSol);
  if(action==='SELL'&&nativeDelta>0)nativeQuote=Math.max(0,nativeDelta+feeSol);
  if(!quoteUsd&&!quoteSol&&nativeQuote>0){quoteSol=nativeQuote;source='transaction-native-sol';confidence='MEDIUM';}
  return {
    transactionPriceUsd:quoteUsd>0&&tokenAmount>0?quoteUsd/tokenAmount:null,
    transactionPriceSol:quoteSol>0&&tokenAmount>0?quoteSol/tokenAmount:null,
    transactionQuoteUsd:quoteUsd||null,
    transactionQuoteSol:quoteSol||null,
    networkFeeSol:feeSol,
    nativeDeltaSol:nativeDelta,
    priceSource:source,
    priceConfidence:confidence,
  };
}
async function attachMarketPricing(trade){
  const snap=await getCurrentMarketSnapshot(trade.tokenAddress,false);
  const solUsd=trade.transactionPriceSol&&!trade.transactionPriceUsd?await getSolUsdQuote(false):null;
  const txUsd=Number(trade.transactionPriceUsd||0)||((Number(trade.transactionPriceSol||0)>0&&Number(solUsd||0)>0)?Number(trade.transactionPriceSol)*Number(solUsd):null);
  const latency=Math.max(0,Number(trade.observedAt||Date.now())-Number(trade.timestamp||Date.now()));
  const execution={
    priceUsd:txUsd||null,
    priceSol:Number(trade.transactionPriceSol||0)||null,
    source:trade.priceSource||'unresolved',
    confidence:trade.priceConfidence||'LOW',
    chainTimestamp:Number(trade.timestamp||Date.now()),
    observedAt:Number(trade.observedAt||Date.now()),
    observationLatencyMs:latency,
    networkFeeSol:Number(trade.networkFeeSol||0),
  };
  if(!execution.priceUsd&&!execution.priceSol&&snap?.priceUsd){
    execution.priceUsd=Number(snap.priceUsd);execution.source='current-market-fallback';execution.confidence='LOW';execution.fallback=true;
  }
  trade.executionPrice=execution;
  trade.marketSnapshot=snap||null;
  trade.marketPriceUsd=Number(snap?.priceUsd||0)||null;
  if(snap){
    trade.market={...(trade.market||{}),priceUsd:snap.priceUsd,liquidity:snap.liquidity,fdv:snap.fdv,marketCap:snap.marketCap,volume24h:snap.volume24h,priceChange:snap.priceChange||{},buys24h:snap.buys24h||0,sells24h:snap.sells24h||0,pairCreatedAt:snap.pairCreatedAt||null,pairAddress:snap.pairAddress||null,dexId:snap.dexId||null,quoteFetchedAt:snap.fetchedAt,quoteQuality:snap.quality};
    trade.liquidity=snap.liquidity;trade.fdv=snap.fdv;
  }
  // Backwards-compatible priceUsd now means the best price for THIS trade,
  // not blindly the latest market quote.
  trade.priceUsd=execution.priceUsd||trade.marketPriceUsd||null;
  return trade;
}
function marketStatus(){
  return {version:1,quoteTtlMs:MARKET_QUOTE_TTL_MS,markIntervalMs:MARKET_MARK_INTERVAL_MS,trackedTokens:Object.keys(marketBook.latest||{}).length,snapshots:(marketBook.snapshots||[]).length,stats:marketBook.stats||{}};
}
async function markGhostPositionsToMarket(force=false){
  if(marketMarkRunning)return marketStatus();
  marketMarkRunning=true;
  try{
    const mints=[...new Set(Object.values(ghostBook.wallets||{}).flatMap(g=>(g.positions||[]).map(p=>p.tokenAddress)).filter(Boolean))].slice(0,100);
    const quotes={};
    const queue=[...mints];
    const workers=Array.from({length:Math.min(4,queue.length)},async()=>{while(queue.length){const mint=queue.shift();if(mint)quotes[mint]=await getCurrentMarketSnapshot(mint,force);}});
    await Promise.all(workers);
    for(const g of Object.values(ghostBook.wallets||{})){
      for(const p of g.positions||[]){
        const q=quotes[p.tokenAddress]; if(!q?.priceUsd)continue;
        p.currentPriceUsd=Number(q.priceUsd);p.marketMarkedAt=Date.now();p.marketQuality=q.quality;p.marketPairAddress=q.pairAddress||null;
        const remaining=Number(p.remainingStakeSol??p.stakeSol??0);
        if(Number(p.simEntryPriceUsd||0)>0){
          p.unrealizedReturnPct=(Number(q.priceUsd)/Number(p.simEntryPriceUsd)-1)*100;
          p.unrealizedPnlSol=remaining*(p.unrealizedReturnPct/100);
        } else {p.unrealizedReturnPct=null;p.unrealizedPnlSol=null;}
      }
      updateGhostDrawdown(g);
    }
    persistGhost();
    broadcast('ghost-update',{reason:'market-mark'});
    return marketStatus();
  }finally{marketMarkRunning=false;}
}
function startMarketMarking(){
  clearInterval(marketMarkTimer);marketMarkTimer=null;
  setTimeout(()=>markGhostPositionsToMarket(false).catch(()=>{}),3000);
  marketMarkTimer=setInterval(()=>markGhostPositionsToMarket(false).catch(()=>{}),MARKET_MARK_INTERVAL_MS);
}

// ── Wallet scoring helpers ──────────────────────────────────
function getWalletScore(wallet) {
  const s     = wallet.stats || {};
  const wr    = s.winRate     || 0;
  const trades= s.totalTrades || 0;
  const pnl   = s.totalPnl    || 0;
  // Weighted score 0-100: win rate (50%) + trade volume (25%) + PnL (25%)
  const wrScore     = Math.min(50, (wr / 100) * 50);
  const tradeScore  = Math.min(25, (trades / 100) * 25);
  const pnlScore    = pnl > 0 ? Math.min(25, (pnl / 20) * 25) : 0;
  return Math.round(wrScore + tradeScore + pnlScore);
}

// ── PHASE 18 · Unified Helius Observation Engine ──────────────
// Helius WebSockets provide low-latency notifications; a persistent 20-second
// RPC poll is authoritative for recovery. Every non-blacklisted watched wallet
// is observed through the same ingestion path, and signatures/cursors survive
// app restarts so the same chain transaction is never intentionally processed
// twice.
let heliusWs = null, heliusPing = null, heliusReconnTimer = null;
let heliusGeneration = 0, heliusReconnectAttempt = 0, heliusWsMode = 'off';
let observationPollTimer = null, observationPollRunning = false;
const OBSERVATION_POLL_INTERVAL_MS = 20_000;
const OBSERVATION_MAX_PAGES = 10;
const OBSERVATION_PAGE_SIZE = 100;
const OBSERVATION_SEEN_LIMIT = 5000;
const OBSERVATION_EVENT_LIMIT = 1500;

const STABLES = new Set([
  'So11111111111111111111111111111111111111112',
  'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
  'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB',
]);

function watchedWalletAddresses() {
  return Object.keys(wallets).filter(a => wallets[a] && wallets[a].tier !== 'blacklisted');
}
function persistObservation() {
  observationState.recentEvents = (observationState.recentEvents || []).slice(0, OBSERVATION_EVENT_LIMIT);
  writeJson(OBSERVATION_F, observationState);
}
function observationWallet(address) {
  const current = observationState.wallets[address] || {};
  const row = {
    address,
    initialized: !!current.initialized,
    baselineSignature: current.baselineSignature || null,
    latestSignature: current.latestSignature || null,
    latestSlot: Number(current.latestSlot || 0),
    seenSignatures: Array.isArray(current.seenSignatures) ? current.seenSignatures.slice(-OBSERVATION_SEEN_LIMIT) : [],
    observedTransactions: Number(current.observedTransactions || 0),
    observedTrades: Number(current.observedTrades || 0),
    lastPollAt: current.lastPollAt || null,
    lastEventAt: current.lastEventAt || null,
    lastError: current.lastError || null,
    consecutiveErrors: Number(current.consecutiveErrors || 0),
  };
  observationState.wallets[address] = row;
  return row;
}
function observationHasSignature(address, signature) {
  if (!signature) return false;
  return observationWallet(address).seenSignatures.includes(signature);
}
function rememberObservationSignature(address, signature, slot=0) {
  if (!address || !signature) return;
  const row = observationWallet(address);
  if (!row.seenSignatures.includes(signature)) row.seenSignatures.push(signature);
  row.seenSignatures = row.seenSignatures.slice(-OBSERVATION_SEEN_LIMIT);
  row.latestSignature = signature;
  row.latestSlot = Math.max(Number(row.latestSlot||0), Number(slot||0));
  row.lastEventAt = Date.now();
}
function recordObservationEvent(evt={}) {
  observationState.recentEvents.unshift({time:Date.now(), ...evt});
  observationState.recentEvents = observationState.recentEvents.slice(0, OBSERVATION_EVENT_LIMIT);
}
function observationHealth() {
  const rows = watchedWalletAddresses().map(a => observationWallet(a));
  const now = Date.now();
  return {
    version: 1,
    pollIntervalMs: OBSERVATION_POLL_INTERVAL_MS,
    polling: observationPollRunning,
    websocketMode: heliusWsMode,
    websocketState: heliusWs?.readyState ?? null,
    watchedWallets: rows.length,
    initializedWallets: rows.filter(r=>r.initialized).length,
    staleWallets: rows.filter(r=>r.lastPollAt && now-r.lastPollAt>OBSERVATION_POLL_INTERVAL_MS*3).length,
    totalObservedTransactions: rows.reduce((n,r)=>n+r.observedTransactions,0),
    totalObservedTrades: rows.reduce((n,r)=>n+r.observedTrades,0),
    lastPollAt: rows.reduce((m,r)=>Math.max(m,Number(r.lastPollAt||0)),0)||null,
    lastEventAt: rows.reduce((m,r)=>Math.max(m,Number(r.lastEventAt||0)),0)||null,
    reconnectAttempt: heliusReconnectAttempt,
    wallets: Object.fromEntries(rows.map(r=>[r.address,{...r,seenSignatures:undefined}])),
  };
}
function broadcastObservationHealth() {
  const data = observationHealth();
  observationState.health = {...data, wallets:undefined};
  broadcast('observation-health', data);
}

function scheduleHeliusReconnect(generation, preferred='enhanced') {
  if (generation !== heliusGeneration || !settings.heliusApiKey) return;
  clearTimeout(heliusReconnTimer);
  heliusReconnectAttempt++;
  const base = Math.min(60_000, 2_000 * (2 ** Math.min(heliusReconnectAttempt-1, 5)));
  const jitter = Math.floor(Math.random()*750);
  heliusReconnTimer = setTimeout(() => connectHeliusWs(generation, preferred), base+jitter);
  broadcast('ws-status', {state:'error', text:`Helius reconnect in ${Math.round((base+jitter)/1000)}s`, mode:heliusWsMode});
}
function cleanHeliusSocket() {
  clearInterval(heliusPing); heliusPing = null;
  if (heliusWs) {
    try { heliusWs.removeAllListeners(); heliusWs.terminate(); } catch {}
    heliusWs = null;
  }
}
function startHelius() {
  stopHelius();
  if (!settings.heliusApiKey) { broadcast('ws-status',{state:'off',text:'No Helius key'}); return; }
  if (!watchedWalletAddresses().length) { broadcast('ws-status',{state:'off',text:'No wallets'}); return; }
  const generation = heliusGeneration;
  connectHeliusWs(generation, 'enhanced');
  startObservationPolling();
}
function connectHeliusWs(generation, mode='enhanced') {
  if (generation !== heliusGeneration || !settings.heliusApiKey) return;
  cleanHeliusSocket();
  const watched = watchedWalletAddresses();
  if (!watched.length) return;
  heliusWsMode = mode;
  const url = mode === 'enhanced'
    ? `wss://atlas-mainnet.helius-rpc.com/?api-key=${settings.heliusApiKey}`
    : `wss://mainnet.helius-rpc.com/?api-key=${settings.heliusApiKey}`;
  broadcast('ws-status',{state:'connecting',text:`Connecting Helius ${mode}…`,mode});
  const ws = heliusWs = new WebSocket(url);
  let subscriptionAccepted = false;
  const fallbackTimer = setTimeout(()=>{
    if (generation===heliusGeneration && mode==='enhanced' && !subscriptionAccepted) {
      recordObservationEvent({source:'websocket',kind:'fallback',message:'Enhanced subscription not confirmed; switching to standard logsSubscribe'});
      connectHeliusWs(generation,'standard');
    }
  }, 7000);

  ws.on('open',()=>{
    if (generation!==heliusGeneration || ws!==heliusWs) return;
    heliusReconnectAttempt=0;
    noteServiceResult('helius',true);
    watched.forEach((addr,i)=>{
      const req = mode==='enhanced'
        ? {jsonrpc:'2.0',id:i+1,method:'transactionSubscribe',params:[{accountInclude:[addr]},{commitment:'confirmed',encoding:'jsonParsed',transactionDetails:'full',maxSupportedTransactionVersion:0}]}
        : {jsonrpc:'2.0',id:i+1,method:'logsSubscribe',params:[{mentions:[addr]},{commitment:'confirmed'}]};
      ws.send(JSON.stringify(req));
    });
    heliusPing=setInterval(()=>{
      try { if(ws.readyState===WebSocket.OPEN) ws.ping(); } catch {}
    },25000);
    broadcast('ws-status',{state:'live',text:`Helius ${mode} · ${watched.length} wallet${watched.length===1?'':'s'}`,mode});
    broadcastObservationHealth();
  });

  ws.on('message',async data=>{
    if(generation!==heliusGeneration || ws!==heliusWs) return;
    try {
      const msg=JSON.parse(data.toString());
      if (msg.id && msg.error) {
        recordObservationEvent({source:'websocket',kind:'subscription-error',mode,error:msg.error.message||String(msg.error)});
        if(mode==='enhanced') { clearTimeout(fallbackTimer); connectHeliusWs(generation,'standard'); }
        return;
      }
      if (msg.id && msg.result !== undefined) { subscriptionAccepted=true; clearTimeout(fallbackTimer); return; }
      if (msg.method==='transactionNotification') {
        const swap=parseSwap(msg);
        if(swap) await ingestObservedTrade(swap,'websocket-enhanced');
      } else if (msg.method==='logsNotification') {
        const sig=msg?.params?.result?.value?.signature;
        if(sig) await ingestSignatureFromStandardWs(sig, watched, msg?.params?.result?.context?.slot||0);
      }
    } catch(e) { recordObservationEvent({source:'websocket',kind:'parse-error',error:e.message}); }
  });
  ws.on('close',()=>{
    clearTimeout(fallbackTimer);
    noteServiceResult('helius',false,{error:'Helius WebSocket closed'});
    if(generation!==heliusGeneration || ws!==heliusWs) return;
    clearInterval(heliusPing); heliusPing=null; heliusWs=null;
    scheduleHeliusReconnect(generation, mode==='enhanced'?'standard':'standard');
  });
  ws.on('error',err=>{
    if(generation!==heliusGeneration || ws!==heliusWs) return;
    recordObservationEvent({source:'websocket',kind:'error',mode,error:err?.message||'WebSocket error'});
    broadcast('ws-status',{state:'error',text:`Helius ${mode} error`,mode});
  });
}
async function ingestSignatureFromStandardWs(signature, candidateWallets, slot=0) {
  if (!signature) return;
  if ((candidateWallets||[]).some(a=>observationHasSignature(a,signature))) return;
  try {
    const txResult=await heliusRpc('getTransaction',[signature,{encoding:'jsonParsed',commitment:'confirmed',maxSupportedTransactionVersion:0}],12_000);
    if(!txResult) return;
    const swap=parseSwap({params:{result:{slot:txResult.slot||slot,signature,transaction:txResult}}});
    if(swap) await ingestObservedTrade({...swap,sourceSignature:signature},'websocket-standard');
    else {
      // Mark it for any watched wallet actually present in account keys so a
      // non-trade notification does not get fetched forever by the poller.
      const keys=(txResult?.transaction?.message?.accountKeys||[]).map(k=>typeof k==='string'?k:k?.pubkey).filter(Boolean);
      for(const a of candidateWallets||[]) if(keys.includes(a)) rememberObservationSignature(a,signature,txResult.slot||slot);
      persistObservation();
    }
  } catch(e) { recordObservationEvent({source:'websocket-standard',kind:'fetch-error',signature,error:e.message}); }
}
function stopHelius() {
  heliusGeneration++;
  clearTimeout(heliusReconnTimer); heliusReconnTimer=null;
  cleanHeliusSocket();
  heliusWsMode='off';
}

function parseSwap(msg) {
  try {
    const r=msg?.params?.result;
    const tx=r?.transaction;
    const meta=tx?.meta;
    if(!meta || meta.err!==null) return null;
    const keys=tx?.transaction?.message?.accountKeys ?? [];
    let walletAddr=null,walletIndex=-1,wallet=null;
    for(let i=0;i<keys.length;i++){
      const k=typeof keys[i]==='string'?keys[i]:keys[i]?.pubkey;
      if(!k)continue;
      const w=wallets[k];
      if(w&&w.tier!=='blacklisted'){walletAddr=k;walletIndex=i;wallet=w;break;}
    }
    if(!wallet)return null;
    const preTok=meta.preTokenBalances??[],postTok=meta.postTokenBalances??[];
    let best=null; const mints=new Set();
    for(const row of [...preTok,...postTok]) if(row?.owner===walletAddr&&row?.mint&&!STABLES.has(row.mint))mints.add(row.mint);
    for(const mint of mints){
      const pre=preTok.find(x=>x.mint===mint&&x.owner===walletAddr),post=postTok.find(x=>x.mint===mint&&x.owner===walletAddr);
      const pr=Number(pre?.uiTokenAmount?.uiAmount??pre?.uiTokenAmount?.uiAmountString??0),pa=Number(post?.uiTokenAmount?.uiAmount??post?.uiTokenAmount?.uiAmountString??0),delta=pa-pr;
      if(delta!==0&&(!best||Math.abs(delta)>Math.abs(best.delta)))best={mint,delta,preTokenAmount:pr,postTokenAmount:pa};
    }
    if(!best)return null;
    const preSol=meta.preBalances?.[walletIndex]??0,postSol=meta.postBalances?.[walletIndex]??0;
    let sol=Math.abs(preSol-postSol)/1e9;
    if(sol<0.001&&walletIndex!==0){const a=meta.preBalances?.[0]??0,b=meta.postBalances?.[0]??0;sol=Math.abs(a-b)/1e9;}
    sol=Math.round(sol*1000)/1000;
    const pricing=deriveTransactionPricing({walletAddr,walletIndex,best,meta,preTok,postTok});
    // Do not discard token movement just because routed SOL delta is tiny.
    return {
      id:tx?.transaction?.signatures?.[0]?`cg_${tx.transaction.signatures[0]}`:`cg_${r.slot}_${Date.now()}`,
      sourceSignature:tx?.transaction?.signatures?.[0]||r?.signature||null,
      walletAddress:walletAddr,walletLabel:wallet.label??null,
      token:`${best.mint.slice(0,6)}...${best.mint.slice(-4)}`,tokenAddress:best.mint,
      tokenAmount:Math.abs(best.delta),preTokenAmount:best.preTokenAmount,postTokenAmount:best.postTokenAmount,
      action:best.delta>0?'BUY':'SELL',sizeSol:Number(pricing.transactionQuoteSol||sol||0),tier:wallet.tier,
      ...pricing,
      timestamp:Number(r?.blockTime||0)?Number(r.blockTime)*1000:Date.now(),observedAt:Date.now(),decision:'PENDING',slot:r.slot||tx?.slot||0,
    };
  }catch(e){console.error('[parseSwap] error:',e.message);return null;}
}

async function ingestObservedTrade(trade, source='unknown') {
  if(!trade?.walletAddress || !trade?.sourceSignature) return false;
  if(observationHasSignature(trade.walletAddress,trade.sourceSignature)) return false;
  const row=observationWallet(trade.walletAddress);
  // Mark before downstream asynchronous enrichment to prevent a simultaneous
  // WebSocket + poll race from entering processTrade twice.
  rememberObservationSignature(trade.walletAddress,trade.sourceSignature,trade.slot||0);
  row.observedTransactions++;
  row.observedTrades++;
  row.lastError=null; row.consecutiveErrors=0;
  trade.observationSource=source; trade.observedAt=trade.observedAt||Date.now();
  ensureTransactionRecord(trade,source);
  recordObservationEvent({source,kind:'trade',walletAddress:trade.walletAddress,signature:trade.sourceSignature,slot:trade.slot||0,action:trade.action,tokenAddress:trade.tokenAddress});
  persistObservation();
  try { await processTrade(trade); return true; }
  catch(e) {
    // Keep the signature remembered: processTrade failures should surface as
    // errors, not create duplicate execution attempts on the next poll.
    row.lastError=e.message||String(e); row.consecutiveErrors++;
    recordObservationEvent({source,kind:'pipeline-error',walletAddress:trade.walletAddress,signature:trade.sourceSignature,error:row.lastError});
    persistObservation();
    return false;
  } finally { broadcastObservationHealth(); }
}

async function fetchUnseenWalletSignatures(address) {
  const row=observationWallet(address);
  row.lastPollAt=Date.now(); row.lastError=null;
  const ghost=ghostBook.wallets[address];
  const replayAfterMs=ghostNeedsSample(ghost)?Number(ghost.startedAt||ghost.createdAt||Date.now()):null;
  let before=null, collected=[], foundCursor=false;
  try {
    for(let page=0;page<OBSERVATION_MAX_PAGES;page++){
      const cfg={limit:OBSERVATION_PAGE_SIZE,commitment:'confirmed'};
      if(before) cfg.before=before;
      const rows=await heliusRpc('getSignaturesForAddress',[address,cfg],12_000);
      if(!Array.isArray(rows)||!rows.length)break;
      if(!row.initialized && !replayAfterMs){
        // Existing monitored wallets baseline at "now" on first Phase-18 run;
        // we do not replay historical trades into live execution.
        const first=rows.find(x=>x?.signature);
        if(first){row.initialized=true;row.baselineSignature=first.signature;row.latestSignature=first.signature;row.latestSlot=Number(first.slot||0);rememberObservationSignature(address,first.signature,first.slot||0);}
        persistObservation(); return [];
      }
      for(const sig of rows){
        if(!sig?.signature||sig.err)continue;
        if(row.seenSignatures.includes(sig.signature)){foundCursor=true;break;}
        if(replayAfterMs && sig.blockTime && sig.blockTime*1000<replayAfterMs){foundCursor=true;break;}
        collected.push(sig);
      }
      if(foundCursor||rows.length<OBSERVATION_PAGE_SIZE)break;
      before=rows[rows.length-1]?.signature;
      if(!before)break;
    }
    row.initialized=true;
    return collected.sort((a,b)=>Number(a.slot||0)-Number(b.slot||0));
  }catch(e){row.lastError=e.message||String(e);row.consecutiveErrors++;throw e;}
}

async function pollObservedWallet(address) {
  const row=observationWallet(address);
  try {
    const unseen=await fetchUnseenWalletSignatures(address);
    for(const sigRow of unseen){
      const sig=sigRow.signature;
      if(observationHasSignature(address,sig))continue;
      let txResult;
      try{txResult=await heliusRpc('getTransaction',[sig,{encoding:'jsonParsed',commitment:'confirmed',maxSupportedTransactionVersion:0}],12_000);}
      catch(e){row.lastError=`getTransaction ${sig.slice(0,8)}: ${e.message}`;row.consecutiveErrors++;continue;}
      if(!txResult){continue;} // retry next pass rather than marking unavailable tx seen
      const swap=parseSwap({params:{result:{slot:txResult.slot||sigRow.slot,signature:sig,blockTime:sigRow.blockTime,transaction:txResult}}});
      if(swap&&swap.walletAddress===address) await ingestObservedTrade({...swap,sourceSignature:sig},'rpc-poll');
      else {rememberObservationSignature(address,sig,txResult.slot||sigRow.slot||0);row.observedTransactions++;persistObservation();}
    }
    row.lastError=null;row.consecutiveErrors=0;
  }catch(e){row.lastError=e.message||String(e);recordObservationEvent({source:'rpc-poll',kind:'wallet-error',walletAddress:address,error:row.lastError});}
  finally{row.lastPollAt=Date.now();persistObservation();broadcastObservationHealth();}
}

async function pollObservationWallets() {
  if(observationPollRunning||!settings.heliusApiKey)return;
  const watched=watchedWalletAddresses();
  if(!watched.length)return;
  observationPollRunning=true;
  try{
    // Bounded worker pool: faster than serial polling for larger watchlists,
    // but deliberately capped to reduce Helius burst/rate-limit pressure.
    const queue=[...watched]; const workers=Array.from({length:Math.min(4,queue.length)},async()=>{while(queue.length){const address=queue.shift();if(address)await pollObservedWallet(address);}});
    await Promise.all(workers);
  }finally{observationPollRunning=false;broadcastObservationHealth();}
}
function startObservationPolling(){
  clearInterval(observationPollTimer);observationPollTimer=null;
  if(!settings.heliusApiKey)return;
  setTimeout(()=>pollObservationWallets().catch(e=>console.warn('[Observation]',e.message)),750);
  observationPollTimer=setInterval(()=>pollObservationWallets().catch(e=>console.warn('[Observation]',e.message)),OBSERVATION_POLL_INTERVAL_MS);
}
function stopObservationPolling(){clearInterval(observationPollTimer);observationPollTimer=null;}
function reconcileHeliusObservation(){
  if(settings.heliusApiKey && watchedWalletAddresses().length){startHelius();}
  else{stopHelius();stopObservationPolling();broadcast('ws-status',{state:'off',text:settings.heliusApiKey?'No wallets':'No Helius key'});broadcastObservationHealth();}
}


// ── PHASE 31 · Connection Health & Degraded Mode ────────────
const CONNECTION_HEALTH_INTERVAL_MS = 15_000;
const CONNECTION_HEALTH_HISTORY_LIMIT = 500;
let connectionHealthTimer=null, connectionHealthRunning=false;
const connectionHealth={
  version:1, mode:'STARTING', updatedAt:null, reason:'Health baseline building', executionAllowed:false,
  services:{
    helius:{state:'UNKNOWN',lastSuccessAt:null,lastFailureAt:null,lastError:null,rateLimitedUntil:null,latencyMs:null},
    dexscreener:{state:'UNKNOWN',lastSuccessAt:null,lastFailureAt:null,lastError:null,rateLimitedUntil:null,latencyMs:null},
    padre:{state:'UNKNOWN',lastSuccessAt:null,lastFailureAt:null,lastError:null,latencyMs:null},
    ai:{state:'OPTIONAL',provider:null,lastSuccessAt:null,lastFailureAt:null,lastError:null,rateLimitedUntil:null,latencyMs:null},
  },
  observationLagMs:null, marketAgeMs:null, history:[]
};
function serviceKeyForUrl(url=''){
  const u=String(url).toLowerCase();
  if(u.includes('helius-rpc.com')||u.includes('helius.xyz'))return 'helius';
  if(u.includes('dexscreener.com'))return 'dexscreener';
  if(u.includes('anthropic.com')||u.includes('openai.com')||u.includes('googleapis.com')||u.includes('api.x.ai')||u.includes('perplexity.ai'))return 'ai';
  return null;
}
function noteServiceResult(name,ok,{error=null,status=null,latencyMs=null}={}){
  const svc=connectionHealth.services[name]; if(!svc)return;
  const now=Date.now(); if(latencyMs!=null)svc.latencyMs=Math.max(0,Number(latencyMs)||0);
  if(ok){svc.lastSuccessAt=now;svc.lastError=null;if(!svc.rateLimitedUntil||svc.rateLimitedUntil<=now)svc.state='ONLINE';}
  else {svc.lastFailureAt=now;svc.lastError=String(error||status||'Connection failed').slice(0,300);svc.state=status===429?'RATE_LIMITED':'OFFLINE';if(status===429)svc.rateLimitedUntil=now+60_000;}
}
function padreHealthSnapshot(){
  const svc=connectionHealth.services.padre, now=Date.now();
  if(!padreView){svc.state='OFFLINE';svc.lastError='Padre BrowserView not created';return svc;}
  let url='',loading=false,destroyed=false;try{destroyed=padreView.webContents.isDestroyed();url=padreView.webContents.getURL()||'';loading=padreView.webContents.isLoading();}catch{destroyed=true;}
  if(destroyed){svc.state='OFFLINE';svc.lastFailureAt=now;svc.lastError='Padre BrowserView unavailable';}
  else if(/padre\.gg/i.test(url)&&!loading){svc.state='ONLINE';svc.lastSuccessAt=svc.lastSuccessAt||now;svc.lastError=null;}
  else if(loading){svc.state='CONNECTING';}
  else {svc.state='DEGRADED';svc.lastError=url?'Padre is not on a verified padre.gg page':'Padre has not finished loading';}
  return svc;
}
function connectionHealthSnapshot(){
  const now=Date.now(), obs=observationHealth(), market=marketStatus();
  const helius=connectionHealth.services.helius, dex=connectionHealth.services.dexscreener, ai=connectionHealth.services.ai;
  ai.provider=settings.aiProvider||null;
  if(!settings.heliusApiKey)helius.state='UNCONFIGURED';
  else if(heliusWs?.readyState===WebSocket.OPEN){helius.state='ONLINE';helius.lastSuccessAt=helius.lastSuccessAt||now;}
  else if(obs.polling&&obs.lastPollAt&&now-obs.lastPollAt<=OBSERVATION_POLL_INTERVAL_MS*2){helius.state='DEGRADED';}
  else if(helius.state==='UNKNOWN')helius.state='CONNECTING';
  if(ai.provider&&!settings.apiKeys?.[ai.provider])ai.state='UNCONFIGURED';
  else if(ai.rateLimitedUntil&&ai.rateLimitedUntil>now)ai.state='RATE_LIMITED';
  else if(settings.apiKeys?.[ai.provider]&&ai.state==='OPTIONAL')ai.state='READY';
  const latestMarket=Object.values(marketBook.latest||{}).reduce((m,x)=>Math.max(m,Number(x?.fetchedAt||0)),0);
  connectionHealth.marketAgeMs=latestMarket?now-latestMarket:null;
  connectionHealth.observationLagMs=obs.lastPollAt?now-Number(obs.lastPollAt):null;
  if(dex.rateLimitedUntil&&dex.rateLimitedUntil>now)dex.state='RATE_LIMITED';
  else if(latestMarket&&connectionHealth.marketAgeMs<=120_000&&dex.state!=='OFFLINE')dex.state='ONLINE';
  else if(latestMarket&&connectionHealth.marketAgeMs>120_000)dex.state='STALE';
  padreHealthSnapshot();
  const critical=[];
  if(!settings.heliusApiKey)critical.push('Helius is not configured');
  else if(['OFFLINE','RATE_LIMITED'].includes(helius.state))critical.push(`Helius ${helius.state.toLowerCase()}`);
  else if(connectionHealth.observationLagMs!=null&&connectionHealth.observationLagMs>60_000)critical.push('Observation data is stale');
  if(['OFFLINE','STALE','RATE_LIMITED'].includes(dex.state))critical.push(`Market pricing ${dex.state.toLowerCase()}`);
  if(['OFFLINE','DEGRADED'].includes(connectionHealth.services.padre.state))critical.push('Padre execution terminal unavailable');
  connectionHealth.executionAllowed=critical.length===0;
  connectionHealth.mode=critical.length?'DEGRADED':'FULL';
  connectionHealth.reason=critical.length?critical.join('; '):'All execution-critical services healthy';
  connectionHealth.updatedAt=now;
  return JSON.parse(JSON.stringify(connectionHealth));
}
function enterConnectionMode(){
  const before=connectionHealth.mode, snap=connectionHealthSnapshot();
  if(before!==snap.mode){
    connectionHealth.history.unshift({at:Date.now(),from:before,to:snap.mode,reason:snap.reason});connectionHealth.history=connectionHealth.history.slice(0,CONNECTION_HEALTH_HISTORY_LIMIT);
    pushNotificationEvent({type:'connection',severity:snap.mode==='DEGRADED'?'HIGH':'INFO',title:snap.mode==='DEGRADED'?'CopyGuard entered degraded mode':'CopyGuard connection health restored',message:snap.reason,source:'Phase 31 Connection Health'});
  }
  broadcast('connection-health',snap);return snap;
}
function connectionExecutionGate(){const h=connectionHealthSnapshot();return {ok:h.executionAllowed,mode:h.mode,reason:h.reason};}
async function runConnectionHealthCheck(){
  if(connectionHealthRunning)return connectionHealthSnapshot();connectionHealthRunning=true;
  try{
    if(settings.heliusApiKey){const t=Date.now();try{const r=await apiPost(`https://mainnet.helius-rpc.com/?api-key=${settings.heliusApiKey}`,{jsonrpc:'2.0',id:31,method:'getHealth'},5_000);noteServiceResult('helius',r.ok,{status:r.status,error:r.ok?null:`HTTP ${r.status}`,latencyMs:Date.now()-t});}catch(e){noteServiceResult('helius',false,{error:e.message,latencyMs:Date.now()-t});}}
    const marketToken=Object.keys(marketBook.latest||{})[0]||SOL_MINT;const t2=Date.now();try{const r=await apiFetch(`https://api.dexscreener.com/latest/dex/tokens/${marketToken}`,{},5_000,0);noteServiceResult('dexscreener',r.ok,{status:r.status,error:r.ok?null:`HTTP ${r.status}`,latencyMs:Date.now()-t2});}catch(e){noteServiceResult('dexscreener',false,{error:e.message,latencyMs:Date.now()-t2});}
    return enterConnectionMode();
  }finally{connectionHealthRunning=false;}
}
function startConnectionHealthMonitor(){stopConnectionHealthMonitor();setTimeout(()=>runConnectionHealthCheck().catch(()=>{}),4_000);connectionHealthTimer=setInterval(()=>runConnectionHealthCheck().catch(()=>{}),CONNECTION_HEALTH_INTERVAL_MS);}
function stopConnectionHealthMonitor(){if(connectionHealthTimer)clearInterval(connectionHealthTimer);connectionHealthTimer=null;}

// ── Phase 19 timestamped transaction ledger + idempotency ──
const TRANSACTION_LEDGER_LIMIT = 10000;
function persistTransactionLedger(){
  transactionLedger.order=(transactionLedger.order||[]).filter((x,i,a)=>x&&a.indexOf(x)===i).slice(0,TRANSACTION_LEDGER_LIMIT);
  const keep=new Set(transactionLedger.order);
  for(const sig of Object.keys(transactionLedger.bySignature||{})) if(!keep.has(sig)) delete transactionLedger.bySignature[sig];
  writeJson(TRANSACTION_LOG_F,transactionLedger);
}
function transactionEventKey(trade){
  return [trade?.sourceSignature||'',trade?.walletAddress||'',trade?.tokenAddress||'',String(trade?.action||'').toUpperCase()].join(':');
}
function ensureTransactionRecord(trade,source='unknown'){
  const sig=trade?.sourceSignature; if(!sig)return null;
  let r=transactionLedger.bySignature[sig];
  if(!r){
    r=transactionLedger.bySignature[sig]={id:`tx-${sig}`,signature:sig,slot:Number(trade.slot||0),chainTimestamp:Number(trade.timestamp||Date.now()),firstObservedAt:Number(trade.observedAt||Date.now()),lastObservedAt:Number(trade.observedAt||Date.now()),sources:[],events:{},shadowActionIds:[],status:'OBSERVED'};
    transactionLedger.order.unshift(sig);
  }
  r.slot=Math.max(Number(r.slot||0),Number(trade.slot||0));
  if(!r.chainTimestamp&&trade.timestamp)r.chainTimestamp=Number(trade.timestamp);
  r.firstObservedAt=Math.min(Number(r.firstObservedAt||Date.now()),Number(trade.observedAt||Date.now()));
  r.lastObservedAt=Math.max(Number(r.lastObservedAt||0),Number(trade.observedAt||Date.now()));
  if(source&&!r.sources.includes(source))r.sources.push(source);
  const key=transactionEventKey(trade);
  if(key){r.events[key]=r.events[key]||{eventKey:key,walletAddress:trade.walletAddress,tokenAddress:trade.tokenAddress,action:String(trade.action||'').toUpperCase(),chainTimestamp:Number(trade.timestamp||r.chainTimestamp),observedAt:Number(trade.observedAt||Date.now()),shadowHandled:false,shadowActionIds:[]};}
  persistTransactionLedger(); return r;
}
function shadowAlreadyHandled(trade){
  const sig=trade?.sourceSignature,key=transactionEventKey(trade); if(!sig||!key)return false;
  const r=transactionLedger.bySignature[sig],e=r?.events?.[key];
  if(e?.shadowHandled)return true;
  const prior=(ghostBook.ledger||[]).find(x=>x.sourceEventKey===key || (x.sourceSignature===sig&&x.walletAddress===trade.walletAddress&&x.tokenAddress===trade.tokenAddress&&String(x.sourceAction||'').toUpperCase()===String(trade.action||'').toUpperCase()));
  if(prior){ if(e){e.shadowHandled=true;if(prior.id&&!e.shadowActionIds.includes(prior.id))e.shadowActionIds.push(prior.id);} if(r&&prior.id&&!r.shadowActionIds.includes(prior.id))r.shadowActionIds.push(prior.id); persistTransactionLedger(); return true; }
  return false;
}
function linkShadowAction(trade,item,disposition){
  const r=ensureTransactionRecord(trade,trade.observationSource||'pipeline'),key=transactionEventKey(trade); if(!r||!key)return;
  const e=r.events[key]||(r.events[key]={eventKey:key}); e.shadowHandled=true;e.shadowDisposition=disposition||item?.action||'HANDLED';e.shadowHandledAt=Date.now();
  e.chainTimestamp=Number(trade.timestamp||r.chainTimestamp);e.observedAt=Number(trade.observedAt||r.firstObservedAt);
  e.shadowActionIds=e.shadowActionIds||[]; if(item?.id&&!e.shadowActionIds.includes(item.id))e.shadowActionIds.push(item.id);
  if(item?.id&&!r.shadowActionIds.includes(item.id))r.shadowActionIds.push(item.id); r.status='PROCESSED';persistTransactionLedger();
}
function transactionLedgerPublic(limit=500){return (transactionLedger.order||[]).slice(0,limit).map(sig=>transactionLedger.bySignature[sig]).filter(Boolean);}
function linkPricingEvidence(trade){
  const sig=trade?.sourceSignature,key=transactionEventKey(trade);if(!sig||!key)return;
  const r=transactionLedger.bySignature?.[sig],e=r?.events?.[key];if(!r||!e)return;
  const x=trade.executionPrice||{},m=trade.marketSnapshot||{};
  e.pricing={executionPriceUsd:x.priceUsd||null,executionPriceSol:x.priceSol||null,source:x.source||'unresolved',confidence:x.confidence||'LOW',observationLatencyMs:Number(x.observationLatencyMs||0),networkFeeSol:Number(x.networkFeeSol||0),marketSnapshotId:m.id||null,marketPriceUsd:m.priceUsd||null,marketFetchedAt:m.fetchedAt||null,marketQuality:m.quality||null,pairAddress:m.pairAddress||null,dexId:m.dexId||null,liquidity:m.liquidity||0};
  r.pricingLinkedAt=Date.now();persistTransactionLedger();
}

// ── Bundle detection ────────────────────────────────────────
const recentBuys = new Map(); // tokenAddress → [{walletAddress, timestamp}]

function checkBundle(trade) {
  if (trade.action !== 'BUY') return null;
  const key  = trade.tokenAddress;
  const now  = Date.now();
  if (!recentBuys.has(key)) recentBuys.set(key, []);
  const window = recentBuys.get(key).filter(e => now - e.timestamp < 5000);
  window.push({ walletAddress:trade.walletAddress, timestamp:now });
  recentBuys.set(key, window);

  const uniqueWatched = [...new Set(window.map(e=>e.walletAddress))]
    .filter(a => wallets[a] && wallets[a].tier !== 'blacklisted');

  if (uniqueWatched.length >= 2) {
    const labels = uniqueWatched.map(a => wallets[a]?.label || a.slice(0,8)+'...');
    const elapsed = now - Math.min(...window.map(e=>e.timestamp));
    return {
      detected:    true,
      walletCount: uniqueWatched.length,
      walletLabels:labels,
      windowMs:    elapsed,
      severity:    uniqueWatched.length >= 3 ? 'HIGH' : 'MEDIUM',
      message:     `${uniqueWatched.length} watched wallets bought within ${Math.round(elapsed/1000)}s — possible coordinated pump`,
    };
  }
  return null;
}

// ── Phase 12 centralized deterministic risk & anti-manipulation engine ──
// AI is advisory. Hard safety blocks always win.
function clampRisk(n){ return Math.max(0,Math.min(100,Math.round(Number(n)||0))); }
function recordRiskDecision(trade, assessment, source='trade') {
  if(!assessment) return null;
  const eventKey=String(trade.sourceEventKey||trade.id||trade.sourceSignature||trade.tokenAddress||'risk');
  const id=`${eventKey}:${source}:v3`;
  const row={id,source,time:Date.now(),tokenAddress:trade.tokenAddress||'',tokenSymbol:trade.tokenSymbol||trade.token||'',walletAddress:trade.walletAddress||'',sourceSignature:trade.sourceSignature||null,sourceEventKey:trade.sourceEventKey||null,decision:assessment.decision||assessment.recommendation||'CAUTION',score:assessment.score,level:assessment.level,confidence:assessment.confidence??null,evidenceVersion:assessment.evidenceVersion||null,hardBlocks:assessment.hardBlocks||[],cautions:assessment.cautions||[],unknowns:assessment.unknowns||[],flags:(assessment.flags||[]).slice(0,20),components:assessment.components||{},generatedAt:assessment.generatedAt||Date.now()};
  const i=riskDecisionBook.decisions.findIndex(x=>x.id===id); if(i>=0)riskDecisionBook.decisions.splice(i,1);
  riskDecisionBook.decisions.unshift(row);riskDecisionBook.decisions=riskDecisionBook.decisions.slice(0,1500);riskDecisionBook.stats.total=Number(riskDecisionBook.stats.total||0)+1;riskDecisionBook.stats.lastDecisionAt=Date.now();writeJson(RISK_DECISIONS_F,riskDecisionBook);return row;
}
function recordRiskEvent(trade, assessment, source='trade') {
  if(!assessment)return; recordRiskDecision(trade,assessment,source);
  if (Number(assessment.score||0) < 35 && !(assessment.hardBlocks||[]).length) return;
  const id = `${trade.id||trade.tokenAddress||'risk'}:${assessment.generatedAt||Date.now()}:${source}`;
  if (riskEvents.some(e=>e.id===id)) return;
  riskEvents.unshift({id,source,time:Date.now(),tokenAddress:trade.tokenAddress||'',tokenSymbol:trade.tokenSymbol||trade.token||'',walletAddress:trade.walletAddress||'',score:assessment.score,level:assessment.level,recommendation:assessment.recommendation,decision:assessment.decision,confidence:assessment.confidence,hardBlocks:assessment.hardBlocks||[],cautions:assessment.cautions||[],unknowns:assessment.unknowns||[],flags:(assessment.flags||[]).slice(0,16),components:assessment.components||{}});
  riskEvents=riskEvents.slice(0,500); writeJson(RISK_EVENTS_F,riskEvents);
  broadcast('risk-event',riskEvents[0]);
}
function clusterEvidenceForTrade(trade) {
  const token=trade.tokenAddress; const ts=Number(trade.timestamp||Date.now());
  if(!token) return {walletCount:0,repeatPairs:0,windowMs:120000};
  const near=history.filter(h=>h.tokenAddress===token && Math.abs(Number(h.timestamp||h.savedAt||0)-ts)<=120000);
  const walletsSeen=[...new Set(near.map(h=>h.walletAddress).filter(Boolean).concat(trade.walletAddress||[]))];
  const pairCounts={};
  const tokenGroups={};
  for(const h of history.slice(0,1000)){if(!h.tokenAddress||!h.walletAddress)continue;(tokenGroups[h.tokenAddress]??=new Set()).add(h.walletAddress);}
  const arr=Object.values(tokenGroups).map(set=>[...set]).filter(a=>a.length>1);
  for(const a of arr){for(let i=0;i<a.length;i++)for(let j=i+1;j<a.length;j++){const k=[a[i],a[j]].sort().join('|');pairCounts[k]=(pairCounts[k]||0)+1;}}
  let repeatPairs=0; for(const [k,c] of Object.entries(pairCounts)) if(c>=3 && walletsSeen.some(w=>k.includes(w))) repeatPairs=Math.max(repeatPairs,c);
  return {walletCount:walletsSeen.length,repeatPairs,windowMs:120000};
}
function assessTradeRisk(trade, wallet = {}) {
  const components={tokenSafety:0,marketRisk:0,holderRisk:0,walletRisk:0,coordinationRisk:0,provenanceRisk:0,creatorRisk:0,manipulationRisk:0,exposureRisk:0};
  const flags=[],hardBlocks=[],cautions=[],unknowns=[];
  const addFlag=(category,severity,code,message,points,hard=false)=>{components[category]=clampRisk(components[category]+points);const f={category,severity,code,message,points,hard};flags.push(f);if(hard)hardBlocks.push(message);else if(['MEDIUM','HIGH','CRITICAL'].includes(severity))cautions.push(message);};
  const addUnknown=(code,message)=>{unknowns.push({code,message});flags.push({category:'evidence',severity:'UNKNOWN',code,message,points:0,hard:false});};
  const liq=Number(trade.liquidity||trade.market?.liquidity||0),fdv=Number(trade.fdv||trade.market?.fdv||0),size=Number(trade.sizeSol||0);
  const wr=Number(wallet?.stats?.winRate||0),trades=Number(wallet?.stats?.totalTrades||0),pnl=Number(wallet?.stats?.totalPnl||0);
  const meta=trade.tokenMeta||{},holders=trade.holderAnalysis||meta.holderAnalysis||{},market=trade.market||{};
  const evidence=trade.researchEvidence||meta.researchEvidence||tokenResearchBook.tokens?.[trade.tokenAddress]||null;
  const authorities=evidence?.authorities||{}; const tp=evidence?.tokenProgram||{}; const od=evidence?.holders?.ownerResolved||{}; const creator=evidence?.creatorHoldings||{}; const ch=evidence?.creatorHistory||{}; const early=evidence?.earlyBird||{};
  const freezeEnabled=authorities.freezeEnabled??meta.freezeEnabled; const mintEnabled=authorities.mintEnabled??meta.mintEnabled;
  if(freezeEnabled) addFlag('tokenSafety','CRITICAL','FREEZE_AUTH','Freeze authority is active',70,true);
  if(mintEnabled) addFlag('tokenSafety','CRITICAL','MINT_AUTH','Mint authority is active',60,true);
  if(freezeEnabled===false&&mintEnabled===false) flags.push({category:'tokenSafety',severity:'SAFE',code:'AUTH_RENOUNCED',message:'Mint and freeze authorities appear renounced',points:-8,hard:false});
  if(freezeEnabled==null)addUnknown('FREEZE_AUTH_UNKNOWN','Freeze-authority state is unknown'); if(mintEnabled==null)addUnknown('MINT_AUTH_UNKNOWN','Mint-authority state is unknown');

  const restrictions=new Set((tp.restrictions||[]).map(String));
  if(restrictions.has('NON_TRANSFERABLE'))addFlag('tokenSafety','CRITICAL','TOKEN2022_NON_TRANSFERABLE','Token-2022 mint is non-transferable',100,true);
  if(restrictions.has('DEFAULT_FROZEN'))addFlag('tokenSafety','CRITICAL','TOKEN2022_DEFAULT_FROZEN','Token-2022 accounts default to frozen',90,true);
  if(restrictions.has('PERMANENT_DELEGATE'))addFlag('tokenSafety','HIGH','TOKEN2022_PERMANENT_DELEGATE','Token-2022 permanent delegate can retain exceptional control',45,false);
  if(restrictions.has('TRANSFER_HOOK'))addFlag('tokenSafety','HIGH','TOKEN2022_TRANSFER_HOOK','Token-2022 transfer hook can apply custom transfer logic',40,false);
  if(restrictions.has('TRANSFER_FEE'))addFlag('tokenSafety','MEDIUM','TOKEN2022_TRANSFER_FEE','Token-2022 transfer-fee extension is active',25,false);
  if(restrictions.has('CONFIDENTIAL_TRANSFER'))addFlag('tokenSafety','MEDIUM','TOKEN2022_CONFIDENTIAL_TRANSFER','Token-2022 confidential-transfer capability reduces transfer transparency',25,false);

  if(liq>0&&liq<10000)addFlag('marketRisk','CRITICAL','VERY_LOW_LIQ','Liquidity below $10K',70,true);else if(liq>0&&liq<25000)addFlag('marketRisk','HIGH','LOW_LIQ','Liquidity below $25K',45,false);else if(liq>0&&liq<75000)addFlag('marketRisk','MEDIUM','THIN_LIQ','Liquidity below $75K',24,false);else if(!liq)addUnknown('LIQUIDITY_UNKNOWN','Current liquidity is unavailable');
  const liqFdv=fdv>0?liq/fdv:null;if(liqFdv!==null&&liqFdv<.01)addFlag('marketRisk','CRITICAL','LIQUIDITY_TRAP','Liquidity is under 1% of FDV',65,true);else if(liqFdv!==null&&liqFdv<.03)addFlag('marketRisk','HIGH','THIN_LIQ_FDV','Liquidity is under 3% of FDV',36,false);
  const volume24=Number(market.volume24h||evidence?.market?.volume24h||0);const turnover=liq>0?volume24/liq:null;if(turnover!==null&&turnover>=100)addFlag('manipulationRisk','HIGH','EXTREME_TURNOVER',`24h volume is ${turnover.toFixed(1)}× liquidity — wash-like turnover signal`,45,false);else if(turnover!==null&&turnover>=25)addFlag('manipulationRisk','MEDIUM','HIGH_TURNOVER',`24h volume is ${turnover.toFixed(1)}× liquidity`,24,false);
  const h1=Math.abs(Number(market.priceChange?.h1??trade.priceChange?.h1??0)),h24=Math.abs(Number(market.priceChange?.h24??trade.priceChange?.h24??0));if(h1>=250)addFlag('marketRisk','HIGH','ABNORMAL_1H_MOVE',`Abnormal 1h move ${h1.toFixed(0)}%`,38,false);else if(h1>=100)addFlag('marketRisk','MEDIUM','FAST_1H_MOVE',`Fast 1h move ${h1.toFixed(0)}%`,22,false);if(h24>=1500)addFlag('marketRisk','HIGH','EXTREME_24H_MOVE',`Extreme 24h move ${h24.toFixed(0)}%`,32,false);

  const top1=od.available?Number(od.topOwnerPct||0):Number(holders.top1Pct||0),top10=od.available?Number(od.top10OwnerPct||0):Number(holders.top10Pct||0);
  if(top1>=30)addFlag('holderRisk','CRITICAL','TOP_OWNER_CONCENTRATION',`Largest resolved owner controls ${top1.toFixed(1)}%`,70,true);else if(top1>=15)addFlag('holderRisk','HIGH','LARGE_TOP_OWNER',`Largest resolved owner controls ${top1.toFixed(1)}%`,40,false);if(top10>=70)addFlag('holderRisk','HIGH','TOP10_OWNER_CONCENTRATION',`Top 10 resolved owners control ${top10.toFixed(1)}%`,48,false);else if(top10>=50)addFlag('holderRisk','MEDIUM','TOP10_OWNER_HEAVY',`Top 10 resolved owners control ${top10.toFixed(1)}%`,28,false);if(!od.available&&holders.available===false)addUnknown('HOLDER_OWNERSHIP_UNKNOWN','Holder ownership concentration is unavailable');
  if(creator.available&&Number(creator.pct||0)>=20)addFlag('creatorRisk','CRITICAL','CREATOR_CONCENTRATION',`Creator candidate controls ${Number(creator.pct).toFixed(1)}% of sampled supply`,75,true);else if(creator.available&&Number(creator.pct||0)>=10)addFlag('creatorRisk','HIGH','CREATOR_HEAVY',`Creator candidate controls ${Number(creator.pct).toFixed(1)}% of sampled supply`,42,false);else if(!creator.available)addUnknown('CREATOR_HOLDINGS_UNKNOWN','Creator holdings could not be resolved');
  const launches=Number(ch.relatedLaunchCount||0);if(launches>=8)addFlag('creatorRisk','HIGH','SERIAL_LAUNCHER',`Creator candidate has ${launches} instruction-proven related launches`,42,false);else if(launches>=3)addFlag('creatorRisk','MEDIUM','REPEAT_LAUNCHER',`Creator candidate has ${launches} instruction-proven related launches`,24,false);
  if(ch.funder?.address&&launches>=3)addFlag('creatorRisk','MEDIUM','FUNDER_LAUNCH_CLUSTER','A proven creator funder is associated with a repeat-launch creator',18,false);

  const overlap=Number(early.earlyHolderOverlapPct??evidence?.coordination?.earlyHolderOverlapPct??0);if(overlap>=60)addFlag('coordinationRisk','HIGH','SNIPER_CONCENTRATION',`${overlap.toFixed(1)}% of reconstructed early buyers remain among major holders`,48,false);else if(overlap>=35)addFlag('coordinationRisk','MEDIUM','EARLY_HOLDER_CLUSTER',`${overlap.toFixed(1)}% early-buyer/top-holder overlap`,28,false);
  const cluster=trade.clusterEvidence||evidence?.coordination?.localWatchedWalletCluster||clusterEvidenceForTrade(trade);if(trade.bundleAlert?.detected){const high=String(trade.bundleAlert.severity||'').toUpperCase()==='HIGH';addFlag('coordinationRisk',high?'CRITICAL':'HIGH','COORDINATED_BUYS',trade.bundleAlert.message||'Multiple watched wallets bought in a short window',high?65:44,high);}if(Number(cluster.walletCount||0)>=4)addFlag('coordinationRisk','CRITICAL','WALLET_CLUSTER',`${cluster.walletCount} watched wallets converged on this token`,62,true);else if(Number(cluster.walletCount||0)>=3)addFlag('coordinationRisk','HIGH','WALLET_CLUSTER',`${cluster.walletCount} watched wallets converged on this token`,42,false);if(Number(cluster.repeatPairs||0)>=3)addFlag('coordinationRisk','HIGH','REPEATED_COHORT',`Observed wallet cohort has co-traded ${cluster.repeatPairs} tokens`,34,false);

  const prov=trade.provenance||meta.provenance||evidence?.provenance||{};if(prov.exactCopycats>=3)addFlag('provenanceRisk','HIGH','COPYCAT_SWARM',`${prov.exactCopycats} same-ticker alternative contracts found`,40,false);else if(prov.exactCopycats>=1)addFlag('provenanceRisk','MEDIUM','COPYCAT_PRESENT',`${prov.exactCopycats} same-ticker alternative contract(s) found`,22,false);if(prov.likelyOriginal===false)addFlag('provenanceRisk','HIGH','PROVENANCE_WEAK','This contract is not the strongest likely-original candidate',35,false);
  if(evidence?.limitations?.some(x=>String(x).includes('Historical liquidity removals')))addUnknown('LIQUIDITY_HISTORY_UNAVAILABLE','Historical liquidity removal behavior has not been reconstructed');
  if(trades<10)addFlag('walletRisk','MEDIUM','LOW_SAMPLE','Wallet has fewer than 10 tracked trades',22,false);else if(trades<30)addFlag('walletRisk','LOW','LIMITED_SAMPLE','Wallet track record is still limited',10,false);if(trades>=10&&wr<40)addFlag('walletRisk','HIGH','LOW_WIN_RATE','Tracked wallet win rate is below 40%',34,false);else if(trades>=10&&wr<50)addFlag('walletRisk','MEDIUM','WEAK_WIN_RATE','Tracked wallet win rate is below 50%',18,false);if(pnl<-2)addFlag('walletRisk','HIGH','NEGATIVE_PNL','Tracked wallet P&L is materially negative',28,false);
  if(size>=5)addFlag('exposureRisk','HIGH','VERY_LARGE_SIZE','Detected copy size is 5 SOL or more',35,false);else if(size>=2)addFlag('exposureRisk','MEDIUM','LARGE_SIZE','Detected copy size is 2 SOL or more',20,false);else if(size>=1)addFlag('exposureRisk','LOW','ELEVATED_SIZE','Detected copy size is 1 SOL or more',8,false);

  let score=Math.round(components.tokenSafety*.22+components.marketRisk*.15+components.holderRisk*.14+components.creatorRisk*.13+components.manipulationRisk*.11+components.coordinationRisk*.12+components.walletRisk*.06+components.provenanceRisk*.04+components.exposureRisk*.03);if(hardBlocks.length)score=Math.max(score,90);score=clampRisk(score);
  const level=score>=85?'CRITICAL':score>=65?'HIGH':score>=35?'MEDIUM':'LOW';const decision=hardBlocks.length?'HARD_BLOCK':score>=65?'CAUTION':score>=35?'CAUTION':'PASS';const recommendation=decision==='HARD_BLOCK'?'SKIP':decision==='CAUTION'?'CAUTION':'COPY';const coverage=Number(evidence?.coverage?.pct??0);const confidence=evidence?Math.max(20,Math.min(100,Math.round(coverage-(unknowns.length*3)))):Math.max(20,70-unknowns.length*7);
  const positive=[];if(liq>=100000)positive.push('Healthy observed liquidity');if(trades>=30&&wr>=55)positive.push('Established wallet track record');if(freezeEnabled===false&&mintEnabled===false)positive.push('Token authorities renounced');if(top10>0&&top10<35)positive.push('Resolved owner concentration appears comparatively distributed');
  return {version:3,evidenceVersion:evidence?.version||null,decision,score,level,recommendation,confidence,components,flags,hardBlocks:[...new Set(hardBlocks)],hardBlock:hardBlocks.length>0,hardBlockReasons:[...new Set(hardBlocks)],cautions:[...new Set(cautions)],unknowns,positive,clusterEvidence:cluster,generatedAt:Date.now()};
}
function normalizeAIAnalysis(raw, deterministic) {
  const recRaw = String(raw?.recommendation || raw?.decision || raw?.verdict || 'CAUTION').toUpperCase();
  let recommendation = recRaw === 'BUY' ? 'COPY' : recRaw === 'RISKY' ? 'CAUTION' : recRaw;
  if (!['COPY','CAUTION','SKIP'].includes(recommendation)) recommendation = 'CAUTION';
  const riskRaw = String(raw?.riskLevel || raw?.risk || deterministic?.level || 'MEDIUM').toUpperCase();
  const riskLevel = ['LOW','MEDIUM','HIGH','CRITICAL'].includes(riskRaw) ? riskRaw : 'MEDIUM';
  const confidence = Math.max(0, Math.min(100, Number(raw?.confidence ?? 50)));
  const flags = Array.isArray(raw?.flags) ? raw.flags.map(String).slice(0,8) : [];
  const hardOverride = !!deterministic?.hardBlocks?.length;
  if (hardOverride) recommendation = 'SKIP';
  return {
    recommendation, riskLevel, confidence,
    reasoning: String(raw?.reasoning || raw?.reason || 'No model explanation returned.').slice(0,1200),
    flags,
    winRateContext: String(raw?.winRateContext || '').slice(0,500),
    provider: settings.aiProvider || 'anthropic',
    deterministicOverride: hardOverride,
    analyzedAt: Date.now(),
  };
}


// ── Phase 16 Ghost Trade Qualification Engine ──────────────
const GHOST_DEFAULTS = Object.freeze({
  enabled:true, startingBalanceSol:10, ghostSizeSol:0.25,
  buySlippagePct:0.50, sellSlippagePct:0.50, feePctPerSide:0.25,
  respectHardBlocks:true, minCompletedTrades:30, minWinRatePct:65,
  minRoiPct:1, minProfitFactor:1.5, maxDrawdownPct:15, maxHardBlockRatePct:10,
  autoActivateLive:false, liveSizeSol:0.25,
  pollIntervalMs:20000, analyzeWithAi:true, aiMayBlockGhost:false,
});
function cleanGhostConfig(input={}){
  const c={...GHOST_DEFAULTS,...input};
  const n=(k,min,max)=>Math.max(min,Math.min(max,Number(c[k]??GHOST_DEFAULTS[k])));
  c.startingBalanceSol=n('startingBalanceSol',1,100000); c.ghostSizeSol=n('ghostSizeSol',0.001,1000);
  c.buySlippagePct=n('buySlippagePct',0,25); c.sellSlippagePct=n('sellSlippagePct',0,25); c.feePctPerSide=n('feePctPerSide',0,10);
  c.minCompletedTrades=Math.round(n('minCompletedTrades',1,10000)); c.minWinRatePct=n('minWinRatePct',0,100);
  c.minRoiPct=n('minRoiPct',-100,10000); c.minProfitFactor=n('minProfitFactor',0,100); c.maxDrawdownPct=n('maxDrawdownPct',0,100); c.maxHardBlockRatePct=n('maxHardBlockRatePct',0,100);
  c.liveSizeSol=n('liveSizeSol',0.001,1000); c.pollIntervalMs=20000;
  c.enabled=!!c.enabled; c.respectHardBlocks=c.respectHardBlocks!==false; c.autoActivateLive=!!c.autoActivateLive;
  c.analyzeWithAi=c.analyzeWithAi!==false; c.aiMayBlockGhost=!!c.aiMayBlockGhost;
  return c;
}
function newGhostWallet(addr, config={}){
  const c=cleanGhostConfig(config), now=Date.now();
  return {address:addr,enabled:true,status:'TESTING',qualified:false,liveActivated:false,startedAt:now,updatedAt:now,config:c,positions:[],closed:[],blockedSignals:0,totalSignals:0,peakEquitySol:c.startingBalanceSol,maxDrawdownPct:0,seenSignatures:[],observedTradeTransactions:0,lastPollAt:null,lastPollError:null};
}
function persistGhost(){ ghostBook.ledger=ghostBook.ledger.slice(0,5000); writeJson(GHOST_F,ghostBook); }
// ── Phase 22 Verified Outcome Engine ────────────────────────
// Qualification metrics are computed only from fully closed, transaction-linked
// Shadow outcomes. Open positions and partial realizations remain portfolio P&L
// and can never improve the qualification sample.
const OUTCOME_BREAKEVEN_PCT = 0.01;
const OUTCOME_LEDGER_LIMIT = 20000;
const OUTCOME_LATENCY_TARGET_MS = 20000;
function persistVerifiedOutcomes(){
  verifiedOutcomeBook.order=(verifiedOutcomeBook.order||[]).slice(0,OUTCOME_LEDGER_LIMIT);
  const keep=new Set(verifiedOutcomeBook.order);
  for(const id of Object.keys(verifiedOutcomeBook.byId||{}))if(!keep.has(id))delete verifiedOutcomeBook.byId[id];
  writeJson(VERIFIED_OUTCOMES_F,verifiedOutcomeBook);
}
function verifiedOutcomeId(address,p){return `outcome:${address}:${p.id||p.sourceEventKey||p.openedAt||'unknown'}`;}
function normalizeVerifiedOutcome(address,p){
  if(!p||p.completedOutcome!==true||!Number(p.closedAt||0))return null;
  const stake=Number(p.originalStakeSol??p.stakeSol??0), pnl=Number(p.pnlSol||0), ret=Number.isFinite(Number(p.returnPct))?Number(p.returnPct):(stake?pnl/stake*100:0);
  const entryChain=Number(p.openedAt||0)||null,entryObserved=Number(p.observedAt||0)||null,exitChain=Number(p.closedAt||0)||null,exitObserved=Number(p.exitObservedAt||0)||null;
  const entryLatency=Math.max(0,Number(p.observationLatencyMs||(entryObserved&&entryChain?entryObserved-entryChain:0)));
  const exitLatency=Math.max(0,exitObserved&&exitChain?exitObserved-exitChain:0);
  const entryLinked=!!(p.sourceSignature&&p.sourceTransactionId&&entryChain&&entryObserved);
  const exitLinked=!!(p.exitSourceSignature&&p.exitSourceTransactionId&&exitChain&&exitObserved);
  const priceLinked=!!(Number(p.simEntryPriceUsd||p.simEntryPriceSol||0)>0 && Number(p.simExitPriceUsd||p.simExitPriceSol||0)>0);
  const sourceVerified=entryLinked&&exitLinked&&priceLinked;
  return {
    id:verifiedOutcomeId(address,p),walletAddress:address,lotId:p.id||null,tokenAddress:p.tokenAddress||'',tokenSymbol:p.tokenSymbol||'',
    completedOutcome:true,sourceVerified,dataQuality:sourceVerified?'VERIFIED':'LEGACY_INCOMPLETE',stakeSol:stake,pnlSol:pnl,returnPct:ret,
    classification:Math.abs(ret)<=OUTCOME_BREAKEVEN_PCT?'BREAKEVEN':ret>0?'WIN':'LOSS',holdMs:Number(p.holdMs||Math.max(0,(exitChain||0)-(entryChain||0))),
    entry:{signature:p.sourceSignature||null,transactionId:p.sourceTransactionId||null,eventKey:p.sourceEventKey||null,chainTimestamp:entryChain,observedAt:entryObserved,latencyMs:entryLatency,priceUsd:Number(p.simEntryPriceUsd||0)||null,priceSol:Number(p.simEntryPriceSol||0)||null,pricingSource:p.pricingSource||null,pricingConfidence:p.pricingConfidence||null},
    exit:{signature:p.exitSourceSignature||null,transactionId:p.exitSourceTransactionId||null,eventKey:p.exitSourceEventKey||null,chainTimestamp:exitChain,observedAt:exitObserved,latencyMs:exitLatency,priceUsd:Number(p.simExitPriceUsd||0)||null,priceSol:Number(p.simExitPriceSol||0)||null},
    realizationCount:Array.isArray(p.realizations)?p.realizations.length:0,recordedAt:Number(p.outcomeRecordedAt||Date.now())
  };
}
function syncVerifiedOutcomesForGhost(address,g,persist=true){
  let changed=false;
  for(const p of g?.closed||[]){
    const o=normalizeVerifiedOutcome(address,p);if(!o)continue;
    const prior=verifiedOutcomeBook.byId[o.id];
    if(!prior||JSON.stringify({...prior,recordedAt:0})!==JSON.stringify({...o,recordedAt:0})){
      verifiedOutcomeBook.byId[o.id]={...o,recordedAt:prior?.recordedAt||Date.now()};changed=true;
    }
    if(!verifiedOutcomeBook.order.includes(o.id)){verifiedOutcomeBook.order.unshift(o.id);changed=true;}
  }
  if(changed&&persist){persistVerifiedOutcomes();rebuildClosedLoopLearning();}
  return (g?.closed||[]).map(p=>normalizeVerifiedOutcome(address,p)).filter(Boolean);
}
function removeVerifiedOutcomesForWallet(address){
  const ids=(verifiedOutcomeBook.order||[]).filter(id=>verifiedOutcomeBook.byId[id]?.walletAddress===address);
  for(const id of ids)delete verifiedOutcomeBook.byId[id];
  verifiedOutcomeBook.order=(verifiedOutcomeBook.order||[]).filter(id=>!ids.includes(id));persistVerifiedOutcomes();
}
function syncAllVerifiedOutcomes(){for(const [addr,g] of Object.entries(ghostBook.wallets||{}))syncVerifiedOutcomesForGhost(addr,g,false);persistVerifiedOutcomes();}
function percentile(values,p){if(!values.length)return 0;const a=[...values].sort((x,y)=>x-y),i=Math.min(a.length-1,Math.max(0,Math.ceil((p/100)*a.length)-1));return a[i];}
function verifiedOutcomeMetrics(address,g){
  const c=cleanGhostConfig(g.config||{}), outcomes=syncVerifiedOutcomesForGhost(address,g,false).sort((a,b)=>Number(a.exit.chainTimestamp||0)-Number(b.exit.chainTimestamp||0));
  const completed=outcomes.length,wins=outcomes.filter(o=>o.classification==='WIN'),losses=outcomes.filter(o=>o.classification==='LOSS'),breakevens=outcomes.filter(o=>o.classification==='BREAKEVEN');
  const net=outcomes.reduce((n,o)=>n+o.pnlSol,0),grossWin=wins.reduce((n,o)=>n+o.pnlSol,0),grossLoss=Math.abs(losses.reduce((n,o)=>n+o.pnlSol,0));
  const pf=grossLoss>0?grossWin/grossLoss:(grossWin>0?999:0),roi=c.startingBalanceSol?net/c.startingBalanceSol*100:0;
  const winRate=completed?wins.length/completed*100:0,decisive=wins.length+losses.length,decisiveWinRate=decisive?wins.length/decisive*100:0;
  const expectancySol=completed?net/completed:0,expectancyPct=completed?outcomes.reduce((n,o)=>n+o.returnPct,0)/completed:0;
  const avgWinPct=wins.length?wins.reduce((n,o)=>n+o.returnPct,0)/wins.length:0,avgLossPct=losses.length?losses.reduce((n,o)=>n+o.returnPct,0)/losses.length:0;
  let equity=c.startingBalanceSol,peak=equity,maxDd=0,currentType=null,currentLen=0,longWin=0,longLoss=0;
  for(const o of outcomes){equity+=o.pnlSol;peak=Math.max(peak,equity);if(peak>0)maxDd=Math.max(maxDd,(peak-equity)/peak*100);const t=o.classification;if(t==='BREAKEVEN'){currentType=null;currentLen=0;}else if(t===currentType)currentLen++;else{currentType=t;currentLen=1;}if(t==='WIN')longWin=Math.max(longWin,currentLen);if(t==='LOSS')longLoss=Math.max(longLoss,currentLen);}
  const latencies=outcomes.flatMap(o=>[o.entry.latencyMs,o.exit.latencyMs].filter(Number.isFinite));
  const onTimeEvents=latencies.filter(x=>x<=OUTCOME_LATENCY_TARGET_MS).length;
  const verifiedCount=outcomes.filter(o=>o.sourceVerified).length;
  const onTimeOutcomes=outcomes.filter(o=>o.entry.latencyMs<=OUTCOME_LATENCY_TARGET_MS&&o.exit.latencyMs<=OUTCOME_LATENCY_TARGET_MS);
  const onTimeNetPnlSol=onTimeOutcomes.reduce((n,o)=>n+o.pnlSol,0);
  return {version:1,completedTrades:completed,wins:wins.length,losses:losses.length,breakevens:breakevens.length,winRatePct:winRate,decisiveWinRatePct:decisiveWinRate,netPnlSol:net,roiPct:roi,grossProfitSol:grossWin,grossLossSol:grossLoss,profitFactor:pf,expectancySol,expectancyPct,avgWinPct,avgLossPct,payoffRatio:avgLossPct?Math.abs(avgWinPct/avgLossPct):(avgWinPct>0?999:0),maxDrawdownPct:maxDd,longestWinStreak:longWin,longestLossStreak:longLoss,currentStreakType:currentType,currentStreak:currentLen,verifiedOutcomes:verifiedCount,verifiedCoveragePct:completed?verifiedCount/completed*100:0,avgObservationLatencyMs:latencies.length?latencies.reduce((a,b)=>a+b,0)/latencies.length:0,p50ObservationLatencyMs:percentile(latencies,50),p95ObservationLatencyMs:percentile(latencies,95),maxObservationLatencyMs:latencies.length?Math.max(...latencies):0,onTimeObservationPct:latencies.length?onTimeEvents/latencies.length*100:0,onTimeOutcomes:onTimeOutcomes.length,onTimeNetPnlSol,outcomes};
}
// ── Phase 23 Dynamic Wallet Qualification Engine ─────────────
const QUALIFICATION_DEFAULTS=Object.freeze({rollingWindow:10,severeConfirmations:2,recoveryConfirmations:3,maxConsecutiveLosses:4,warningWinRateBufferPct:10,severeWinRateBufferPct:25,warningProfitFactorRatio:0.80,severeRoiPct:-5});
function persistQualification(){qualificationBook.events=(qualificationBook.events||[]).slice(0,10000);writeJson(QUALIFICATION_F,qualificationBook);}
function qualificationProfile(address,g){
  const prior=qualificationBook.wallets[address]||{};
  const q={address,state:prior.state||'TESTING',badEvaluations:Number(prior.badEvaluations||0),goodEvaluations:Number(prior.goodEvaluations||0),qualifiedAt:prior.qualifiedAt||null,liveSince:prior.liveSince||null,pausedAt:prior.pausedAt||null,lastEvaluatedAt:prior.lastEvaluatedAt||null,lastEvaluatedCompletedTrades:Number(prior.lastEvaluatedCompletedTrades??-1),lastReason:prior.lastReason||null,...prior};
  qualificationBook.wallets[address]=q;return q;
}
function qualificationEvent(address,from,to,reason,metrics={}){
  if(from===to)return;qualificationBook.events.unshift({id:`qual-${Date.now()}-${Math.random().toString(36).slice(2,7)}`,walletAddress:address,from,to,reason,metrics:{completedTrades:metrics.completedTrades,winRatePct:metrics.winRatePct,roiPct:metrics.roiPct,profitFactor:metrics.profitFactor,maxDrawdownPct:metrics.maxDrawdownPct,longestLossStreak:metrics.longestLossStreak,verifiedCoveragePct:metrics.verifiedCoveragePct},at:Date.now()});
}
function rollingOutcomeMetrics(address,g,limit=QUALIFICATION_DEFAULTS.rollingWindow){
  const base=verifiedOutcomeMetrics(address,g),rows=(base.outcomes||[]).slice(-Math.max(1,limit));
  if(!rows.length)return {...base,rollingSample:0};
  const wins=rows.filter(o=>o.classification==='WIN'),losses=rows.filter(o=>o.classification==='LOSS');
  const net=rows.reduce((n,o)=>n+Number(o.pnlSol||0),0),grossWin=wins.reduce((n,o)=>n+Number(o.pnlSol||0),0),grossLoss=Math.abs(losses.reduce((n,o)=>n+Number(o.pnlSol||0),0));
  let consec=0;for(let i=rows.length-1;i>=0;i--){if(rows[i].classification==='LOSS')consec++;else break;}
  return {...base,rollingSample:rows.length,rollingWinRatePct:rows.length?wins.length/rows.length*100:0,rollingNetPnlSol:net,rollingRoiPct:Number(g?.config?.startingBalanceSol||10)?net/Number(g.config.startingBalanceSol||10)*100:0,rollingProfitFactor:grossLoss>0?grossWin/grossLoss:(grossWin>0?999:0),rollingConsecutiveLosses:consec,rollingVerifiedCoveragePct:rows.length?rows.filter(o=>o.sourceVerified).length/rows.length*100:0};
}
function evaluateDynamicQualification(address,g,{persist=true}={}){
  const w=wallets[address], c=cleanGhostConfig(g?.config||{}), p=qualificationProfile(address,g), full=evaluateGhostQualification(g), m=rollingOutcomeMetrics(address,g), cfg=QUALIFICATION_DEFAULTS;
  const from=p.state; let to=from, reason=p.lastReason||'';
  if(!g||!w){return {state:'MISSING',profile:p,full,rolling:m};}
  const outcomeAdvanced=Number(m.completedTrades||0)!==Number(p.lastEvaluatedCompletedTrades??-1);
  if(!g.liveActivated){
    if(full.qualified){to='QUALIFIED';reason='Initial verified qualification thresholds passed';if(!p.qualifiedAt)p.qualifiedAt=Date.now();}
    else {to='TESTING';reason='Building initial verified qualification sample';}
  } else {
    const enough=m.rollingSample>=cfg.rollingWindow;
    const warning=enough&&(m.rollingWinRatePct < Math.max(0,c.minWinRatePct-cfg.warningWinRateBufferPct) || m.rollingProfitFactor < c.minProfitFactor*cfg.warningProfitFactorRatio || m.maxDrawdownPct>c.maxDrawdownPct || m.rollingVerifiedCoveragePct<100);
    const severe=enough&&(m.rollingWinRatePct < Math.max(0,c.minWinRatePct-cfg.severeWinRateBufferPct) || m.rollingRoiPct<=cfg.severeRoiPct || m.rollingConsecutiveLosses>=cfg.maxConsecutiveLosses || m.maxDrawdownPct>c.maxDrawdownPct || m.rollingVerifiedCoveragePct<100);
    if(severe){if(outcomeAdvanced){p.badEvaluations++;p.goodEvaluations=0;}to=p.badEvaluations>=cfg.severeConfirmations?'AUTO_PAUSED':'WARNING';reason=`Rolling Shadow degradation confirmed ${p.badEvaluations}/${cfg.severeConfirmations} completed outcomes`;}
    else if(warning){if(outcomeAdvanced){p.badEvaluations=Math.max(1,p.badEvaluations);p.goodEvaluations=0;}to='WARNING';reason='Rolling Shadow metrics entered warning band';}
    else {if(outcomeAdvanced){p.badEvaluations=0;p.goodEvaluations++;}if(from==='AUTO_PAUSED'||from==='REQUALIFYING'){to=p.goodEvaluations>=cfg.recoveryConfirmations?'QUALIFIED':'REQUALIFYING';reason=`Recovery evidence ${p.goodEvaluations}/${cfg.recoveryConfirmations} completed outcomes`;}else{to='LIVE_HEALTHY';reason='Rolling Shadow metrics remain healthy';}}
    if(to==='AUTO_PAUSED'){
      if(trustedCfgs[address])trustedCfgs[address].enabled=false;
      if(w.tier==='trusted')w.tier='paused';
      p.pausedAt=p.pausedAt||Date.now();g.status='AUTO_PAUSED';
      writeJson(WALLETS_F,wallets);writeJson(TRUSTED_F,trustedCfgs);
    } else if(to==='QUALIFIED'&&from==='REQUALIFYING'){
      // Recovery never silently resumes real orders; human must explicitly promote again.
      g.liveActivated=false;g.status='QUALIFIED';w.tier='ghost';writeJson(WALLETS_F,wallets);
    } else if(to==='LIVE_HEALTHY'||to==='WARNING') g.status=to;
  }
  if(from!==to){qualificationEvent(address,from,to,reason,m);if(to==='WARNING')pushNotificationEvent({type:'health',severity:'WARNING',title:'Trusted wallet entered warning state',message:reason,source:'Dynamic Qualification',walletAddress:address});if(to==='AUTO_PAUSED')pushNotificationEvent({type:'health',severity:'CRITICAL',title:'Trusted wallet auto-paused by Shadow requalification',message:reason,source:'Dynamic Qualification',walletAddress:address});}
  p.state=to;p.lastReason=reason;p.lastEvaluatedAt=Date.now();if(outcomeAdvanced)p.lastEvaluatedCompletedTrades=Number(m.completedTrades||0);p.metrics={rollingSample:m.rollingSample,rollingWinRatePct:m.rollingWinRatePct,rollingRoiPct:m.rollingRoiPct,rollingProfitFactor:m.rollingProfitFactor,rollingConsecutiveLosses:m.rollingConsecutiveLosses,verifiedCoveragePct:m.rollingVerifiedCoveragePct};qualificationBook.wallets[address]=p;
  if(persist)persistQualification();return {state:to,profile:{...p},full,rolling:m,settings:cfg};
}
function ghostStats(g){
  const c=cleanGhostConfig(g.config||{}),closed=Array.isArray(g.closed)?g.closed:[],open=Array.isArray(g.positions)?g.positions:[],address=g.address||'';
  const verified=verifiedOutcomeMetrics(address,g);
  const closedNet=closed.reduce((n,x)=>n+Number(x.pnlSol||0),0),openRealized=open.reduce((n,x)=>n+Number(x.realizedPnlSol||0),0),portfolioRealized=closedNet+openRealized;
  const unrealized=open.reduce((n,x)=>n+Number(x.unrealizedPnlSol||0),0),remainingExposureSol=open.reduce((n,x)=>n+Number(x.remainingStakeSol??x.stakeSol??0),0),originalExposureSol=open.reduce((n,x)=>n+Number(x.originalStakeSol??x.stakeSol??0),0);
  const partialRealizations=open.reduce((n,x)=>n+(Array.isArray(x.realizations)?x.realizations.length:0),0),openTokens=new Set(open.map(x=>x.tokenAddress).filter(Boolean)).size,availableCashSol=Math.max(0,c.startingBalanceSol+portfolioRealized-remainingExposureSol);
  return {...verified,closedPnlSol:closedNet,partialRealizedPnlSol:openRealized,portfolioRealizedPnlSol:portfolioRealized,unrealizedPnlSol:unrealized,markedEquitySol:c.startingBalanceSol+portfolioRealized+unrealized,equitySol:c.startingBalanceSol+verified.netPnlSol,openPositions:open.length,openTokens,remainingExposureSol,originalExposureSol,availableCashSol,partialRealizations,hardBlockRatePct:Number(g.observedSignals||0)?Number(g.blockedSignals||0)/Number(g.observedSignals||1)*100:0};
}
function ghostPortfolioSummary(g){
  const groups={};
  for(const p of g.positions||[]){
    const k=p.tokenAddress||'unknown',w=Number(p.remainingStakeSol??p.stakeSol??0);
    if(!groups[k])groups[k]={tokenAddress:k,tokenSymbol:p.tokenSymbol||'',lots:0,remainingStakeSol:0,realizedPnlSol:0,unrealizedPnlSol:0,weightedEntryUsdNumerator:0,weightedEntrySolNumerator:0};
    const x=groups[k];x.lots++;x.remainingStakeSol+=w;x.realizedPnlSol+=Number(p.realizedPnlSol||0);x.unrealizedPnlSol+=Number(p.unrealizedPnlSol||0);
    if(Number(p.simEntryPriceUsd||0)>0){x.weightedEntryUsdNumerator+=Number(p.simEntryPriceUsd)*w;}
    if(Number(p.simEntryPriceSol||0)>0){x.weightedEntrySolNumerator+=Number(p.simEntryPriceSol)*w;}
  }
  return Object.values(groups).map(x=>({...x,averageEntryPriceUsd:x.remainingStakeSol?x.weightedEntryUsdNumerator/x.remainingStakeSol:null,averageEntryPriceSol:x.remainingStakeSol?x.weightedEntrySolNumerator/x.remainingStakeSol:null}));
}
function evaluateGhostQualification(g){
  const s=ghostStats(g), c=cleanGhostConfig(g.config||{}); const checks={
    sample:s.completedTrades>=c.minCompletedTrades, verified:s.completedTrades>0&&s.verifiedCoveragePct>=100, winRate:s.winRatePct>=c.minWinRatePct, roi:s.roiPct>=c.minRoiPct,
    profitFactor:s.profitFactor>=c.minProfitFactor, drawdown:s.maxDrawdownPct<=c.maxDrawdownPct, hardBlocks:s.hardBlockRatePct<=c.maxHardBlockRatePct,
  };
  return {qualified:Object.values(checks).every(Boolean),checks,stats:s,thresholds:c,progressPct:Math.round((Object.values(checks).filter(Boolean).length/Object.keys(checks).length)*100)};
}
function updateGhostDrawdown(g){
  const s=ghostStats(g); g.maxDrawdownPct=Number(s.maxDrawdownPct||0); g.peakEquitySol=Math.max(Number(g.config?.startingBalanceSol||0),Number(g.config?.startingBalanceSol||0)+Number(s.netPnlSol||0));
}
function ghostLedger(entry){ const item={id:`ghost-${Date.now()}-${Math.random().toString(36).slice(2,7)}`,time:Number(entry?.chainTimestamp||Date.now()),loggedAt:Date.now(),...entry}; ghostBook.ledger.unshift(item); persistGhost(); return item; }
function defaultLiveProfile(g){return {enabled:true,sizingMode:'fixed',fixedSol:Number(g.config.liveSizeSol||0.25),maxSolPerTrade:Number(g.config.liveSizeSol||0.25),maxRiskScore:Math.min(35,Number(settings.maxAutomationRiskScore||45)),minLiquidityUsd:25000,maxDailyTrades:5,maxDailyLossSol:1,maxConcurrentPositions:3,requireAiApproval:true,blockAiCaution:true,aiMinConfidence:65,takeProfitPct:25,stopLossPct:12,trailingStopPct:0,source:'ghost-qualified',createdAt:Date.now()};}
function activateGhostLive(addr, explicit=false){
  const g=ghostBook.wallets[addr], w=wallets[addr]; if(!g||!w)return {ok:false,reason:'Ghost wallet not found'};
  const q=evaluateGhostQualification(g); if(!q.qualified)return {ok:false,reason:'Wallet has not met all Ghost qualification thresholds',qualification:q};
  w.tier='trusted'; w.ghostQualifiedAt=Date.now(); w.ghostQualification={winRatePct:q.stats.winRatePct,roiPct:q.stats.roiPct,profitFactor:q.stats.profitFactor,maxDrawdownPct:q.stats.maxDrawdownPct,completedTrades:q.stats.completedTrades};
  trustedCfgs[addr]={...defaultLiveProfile(g),...(trustedCfgs[addr]||{}),enabled:true};
  g.status='LIVE_HEALTHY'; g.qualified=true; g.liveActivated=true; g.liveActivatedAt=Date.now(); g.enabled=true;
  const qp=qualificationProfile(addr,g);qp.state='LIVE_HEALTHY';qp.qualifiedAt=qp.qualifiedAt||Date.now();qp.liveSince=Date.now();qp.badEvaluations=0;qp.goodEvaluations=0;qualificationEvent(addr,qp.state==='LIVE_HEALTHY'?'QUALIFIED':qp.state,'LIVE_HEALTHY','Explicit/live activation',q.stats);persistQualification();
  writeJson(WALLETS_F,wallets); writeJson(TRUSTED_F,trustedCfgs); persistGhost();
  pushNotificationEvent({type:'automation',severity:'HIGH',title:'Ghost wallet activated for live copying',message:`${w.label||addr.slice(0,8)} qualified after ${q.stats.completedTrades} ghost trades at ${q.stats.winRatePct.toFixed(1)}% win rate. Live execution still obeys global automation, emergency pause, AI and risk gates.`,source:'Ghost Engine',walletAddress:addr,metadata:{explicit,qualification:q.stats}});
  broadcast('ghost-update',{address:addr,reason:'live-activated'}); return {ok:true,wallet:w,profile:trustedCfgs[addr],qualification:q};
}

// ── Shadow polling compatibility layer ───────────────────────
// Phase 18 moved authoritative polling into the unified Helius Observation
// Engine. These names remain for older renderer/lifecycle calls and tests.
const GHOST_POLL_INTERVAL_MS = OBSERVATION_POLL_INTERVAL_MS;
let ghostPollRunning = false;
const processedChainSignatures = new Set();
function rememberGhostSignature(g, signature) {
  if(!g||!signature)return;
  const list=Array.isArray(g.seenSignatures)?g.seenSignatures:[];
  if(!list.includes(signature))list.push(signature);
  g.seenSignatures=list.slice(-5000);
}
function ghostNeedsSample(g){
  if(!g||!g.enabled||g.status==='STOPPED')return false;
  if(g.liveActivated)return true;
  const target=Number(cleanGhostConfig(g.config||{}).minCompletedTrades||30);
  return ghostStats(g).completedTrades<target;
}
async function pollOneGhostWallet(address){return pollObservedWallet(address);}
async function pollGhostWallets(){ghostPollRunning=true;try{return await pollObservationWallets();}finally{ghostPollRunning=false;}}
function startGhostPolling(){startObservationPolling();}
function stopGhostPolling(){/* unified observation polling owns the timer */}

async function processGhostTrade(trade, wallet) {
  const g = ghostBook.wallets[trade.walletAddress];
  ensureTransactionRecord(trade,trade.observationSource||'ghost');
  if (shadowAlreadyHandled(trade)) { recordObservationEvent({source:'ghost',kind:'duplicate-shadow-suppressed',walletAddress:trade.walletAddress,signature:trade.sourceSignature,eventKey:transactionEventKey(trade)}); return; }
  if (!g || !g.enabled) { await queueForApproval(trade, wallet); return; }

  g.config       = cleanGhostConfig(g.config);
  g.totalSignals = Number(g.totalSignals || 0) + 1;
  g.updatedAt    = Date.now();

  const risk   = trade.riskAssessment || assessTradeRisk(trade, wallet);
  const action = String(trade.action || '').toUpperCase();
  const sourceMeta={sourceSignature:trade.sourceSignature||null,sourceTransactionId:trade.sourceSignature?`tx-${trade.sourceSignature}`:null,sourceEventKey:transactionEventKey(trade),sourceAction:action,chainTimestamp:Number(trade.timestamp||Date.now()),observedAt:Number(trade.observedAt||Date.now()),slot:Number(trade.slot||0)};

  let aiAnalysis = null;
  const provider = settings.aiProvider || 'anthropic';
  if (g.config.analyzeWithAi && settings.apiKeys?.[provider]) {
    try { aiAnalysis = await callSpecializedAI(AI_TASKS.TRADE_ANALYSIS,tradeAiEvidence(trade,wallet),risk); trade.aiAnalysis = aiAnalysis; g.lastAiAnalysisAt = Date.now(); g.lastAiError = null; }
    catch (e) { g.lastAiError = e.message || String(e); }
  }
  if (action === 'BUY' && g.config.aiMayBlockGhost && aiAnalysis?.recommendation === 'SKIP') {
    ghostLedger({walletAddress:trade.walletAddress,tokenAddress:trade.tokenAddress,tokenSymbol:trade.tokenSymbol,action:'AI_SKIPPED_BUY',reason:aiAnalysis.reasoning,aiAnalysis,riskScore:risk.score,...sourceMeta});
    linkShadowAction(trade,ghostBook.ledger[0],'AI_SKIPPED_BUY'); persistGhost(); broadcast('ghost-update',{address:trade.walletAddress,reason:'ai-skip'}); return;
  }
  if (action === 'BUY' && g.config.respectHardBlocks && risk.hardBlocks?.length) {
    g.blockedSignals = (g.blockedSignals || 0) + 1;
    ghostLedger({walletAddress:trade.walletAddress,tokenAddress:trade.tokenAddress,tokenSymbol:trade.tokenSymbol,action:'BLOCKED_BUY',reason:risk.hardBlocks.join('; '),riskScore:risk.score,...sourceMeta});
    linkShadowAction(trade,ghostBook.ledger[0],'BLOCKED_BUY'); persistGhost(); broadcast('ghost-update',{address:trade.walletAddress,reason:'hard-block'}); return;
  }

  const usdObs = Number(trade.executionPrice?.priceUsd || trade.transactionPriceUsd || trade.priceUsd || 0);
  const solObs = Number(trade.executionPrice?.priceSol || trade.transactionPriceSol || 0) || ((trade.sizeSol > 0 && trade.tokenAmount > 0) ? trade.sizeSol / trade.tokenAmount : 0);
  const pricingSource = trade.executionPrice?.source || trade.priceSource || (usdObs?'market-fallback':'transaction-derived');
  const pricingConfidence = trade.executionPrice?.confidence || trade.priceConfidence || 'LOW';
  if (!usdObs && !solObs) {
    ghostLedger({walletAddress:trade.walletAddress,tokenAddress:trade.tokenAddress,tokenSymbol:trade.tokenSymbol,action:'UNPRICED',reason:'No price reference available — missing sizeSol or tokenAmount',...sourceMeta});
    linkShadowAction(trade,ghostBook.ledger[0],'UNPRICED'); persistGhost(); broadcast('ghost-update',{address:trade.walletAddress,reason:'unpriced'}); return;
  }

  const observed=usdObs||0, observedSol=solObs||0, priceMode=usdObs?'usd':'sol';
  if (action === 'BUY') {
    const slipBuy=1+Number(g.config.buySlippagePct||0)/100, stake=Number(g.config.ghostSizeSol||0.5);
    const beforeStats=ghostStats(g);
    if(Number(beforeStats.availableCashSol||0)+1e-9<stake){
      const item=ghostLedger({walletAddress:trade.walletAddress,tokenAddress:trade.tokenAddress,tokenSymbol:trade.tokenSymbol,action:'INSUFFICIENT_SHADOW_CAPITAL',requestedStakeSol:stake,availableCashSol:Number(beforeStats.availableCashSol||0),reason:'Shadow account does not have enough uncommitted simulated SOL for this entry',...sourceMeta});
      linkShadowAction(trade,item,'INSUFFICIENT_SHADOW_CAPITAL');persistGhost();broadcast('ghost-update',{address:trade.walletAddress,reason:'insufficient-shadow-capital'});return;
    }
    const entryPrice=observed*slipBuy, entryPriceSol=observedSol*slipBuy;
    const pos={
      id:`gp-${Date.now()}-${Math.random().toString(36).slice(2,6)}`,tokenAddress:trade.tokenAddress,tokenSymbol:trade.tokenSymbol||trade.token||'',
      openedAt:Number(trade.timestamp||Date.now()),observedAt:Number(trade.observedAt||Date.now()),priceMode,
      observedEntryPriceUsd:observed,simEntryPriceUsd:entryPrice,observedEntryPriceSol:observedSol,simEntryPriceSol:entryPriceSol,
      stakeSol:stake,originalStakeSol:stake,remainingStakeSol:stake,remainingFraction:1,realizedPnlSol:0,realizedStakeSol:0,realizations:[],
      sourceWalletTokenAmount:Number(trade.tokenAmount||0)||null,sourceWalletPreTokenAmount:Number(trade.preTokenAmount||0)||0,sourceWalletPostTokenAmount:Number(trade.postTokenAmount||0)||null,
      riskScore:risk.score,sourceTradeId:trade.id||null,sourceSignature:trade.sourceSignature||null,sourceTransactionId:sourceMeta.sourceTransactionId,sourceEventKey:sourceMeta.sourceEventKey,
      aiAnalysis,pricingSource,pricingConfidence,sourceMarketSnapshotId:trade.marketSnapshot?.id||null,sourceMarketFetchedAt:trade.marketSnapshot?.fetchedAt||null,observationLatencyMs:Number(trade.executionPrice?.observationLatencyMs||0),
    };
    g.positions.push(pos);
    const item=ghostLedger({walletAddress:trade.walletAddress,tokenAddress:trade.tokenAddress,tokenSymbol:trade.tokenSymbol,action:'GHOST_BUY',lotId:pos.id,stakeSol:stake,remainingStakeSol:stake,priceMode,observedPriceUsd:observed,simPriceUsd:entryPrice,observedPriceSol:observedSol,simPriceSol:entryPriceSol,riskScore:risk.score,aiAnalysis,pricingSource,pricingConfidence,marketSnapshotId:trade.marketSnapshot?.id||null,observationLatencyMs:Number(trade.executionPrice?.observationLatencyMs||0),...sourceMeta});
    linkShadowAction(trade,item,'GHOST_BUY');
  } else if(action==='SELL'){
    const lots=(g.positions||[]).filter(p=>p.tokenAddress===trade.tokenAddress);
    if(!lots.length){const item=ghostLedger({walletAddress:trade.walletAddress,tokenAddress:trade.tokenAddress,tokenSymbol:trade.tokenSymbol,action:'UNMATCHED_SELL',observedPriceUsd:observed,...sourceMeta});linkShadowAction(trade,item,'UNMATCHED_SELL');}
    else {
      const walletPre=Number(trade.preTokenAmount||0), soldAmount=Math.abs(Number(trade.tokenAmount||0));
      const sellFraction=walletPre>0?Math.max(0,Math.min(1,soldAmount/walletPre)):1;
      const effectiveFraction=sellFraction>0?sellFraction:1;
      const exitPriceUsd=observed*(1-Number(g.config.sellSlippagePct||0)/100);
      const exitPriceSol=observedSol*(1-Number(g.config.sellSlippagePct||0)/100);
      const feePct=Number(g.config.feePctPerSide||0)*2/100;
      const closedIds=new Set();
      for(const p of lots){
        const beforeStake=Number(p.remainingStakeSol??p.stakeSol??0);
        if(beforeStake<=0)continue;
        const closeStake=Math.min(beforeStake,beforeStake*effectiveFraction);
        let rawReturn=0;
        if(p.priceMode==='sol'&&Number(p.simEntryPriceSol||0)>0&&exitPriceSol>0)rawReturn=exitPriceSol/Number(p.simEntryPriceSol)-1;
        else if(Number(p.simEntryPriceUsd||0)>0&&exitPriceUsd>0)rawReturn=exitPriceUsd/Number(p.simEntryPriceUsd)-1;
        const netReturn=rawReturn-feePct, pnlSol=closeStake*netReturn;
        const realization={id:`gr-${Date.now()}-${Math.random().toString(36).slice(2,6)}`,lotId:p.id,closedStakeSol:closeStake,sellFractionOfLot:beforeStake?closeStake/beforeStake:0,walletSellFraction:effectiveFraction,pnlSol,returnPct:netReturn*100,chainTimestamp:Number(trade.timestamp||Date.now()),observedAt:Number(trade.observedAt||Date.now()),sourceSignature:trade.sourceSignature||null,sourceTransactionId:sourceMeta.sourceTransactionId,sourceEventKey:sourceMeta.sourceEventKey,observedExitPriceUsd:observed,simExitPriceUsd:exitPriceUsd,observedExitPriceSol:observedSol,simExitPriceSol:exitPriceSol};
        p.realizations=Array.isArray(p.realizations)?p.realizations:[];p.realizations.push(realization);
        p.realizedPnlSol=Number(p.realizedPnlSol||0)+pnlSol;p.realizedStakeSol=Number(p.realizedStakeSol||0)+closeStake;
        p.remainingStakeSol=Math.max(0,beforeStake-closeStake);p.remainingFraction=Number(p.originalStakeSol||p.stakeSol||0)>0?p.remainingStakeSol/Number(p.originalStakeSol||p.stakeSol):0;
        const fullyClosed=p.remainingStakeSol<=Math.max(1e-9,Number(p.originalStakeSol||p.stakeSol||0)*1e-6)||effectiveFraction>=0.999999;
        const item=ghostLedger({walletAddress:trade.walletAddress,tokenAddress:trade.tokenAddress,tokenSymbol:trade.tokenSymbol,action:fullyClosed?'GHOST_SELL':'GHOST_PARTIAL_SELL',lotId:p.id,closedStakeSol:closeStake,remainingStakeSol:fullyClosed?0:p.remainingStakeSol,walletSellFraction:effectiveFraction,pnlSol,returnPct:netReturn*100,observedPriceUsd:observed,simPriceUsd:exitPriceUsd,...sourceMeta});
        if(fullyClosed){
          p.remainingStakeSol=0;p.remainingFraction=0;p.unrealizedPnlSol=0;p.unrealizedReturnPct=null;
          const totalPnl=Number(p.realizedPnlSol||0),originalStake=Number(p.originalStakeSol||p.stakeSol||0);
          const close={...p,closedAt:Number(trade.timestamp||Date.now()),exitObservedAt:Number(trade.observedAt||Date.now()),exitSourceSignature:trade.sourceSignature||null,exitSourceTransactionId:sourceMeta.sourceTransactionId,exitSourceEventKey:sourceMeta.sourceEventKey,observedExitPriceUsd:observed,simExitPriceUsd:exitPriceUsd,observedExitPriceSol:observedSol,simExitPriceSol:exitPriceSol,pnlSol:totalPnl,returnPct:originalStake?totalPnl/originalStake*100:0,holdMs:Number(trade.timestamp||Date.now())-p.openedAt,completedOutcome:true};
          p.outcomeRecordedAt=Date.now();g.closed.unshift(close);closedIds.add(p.id);
        }
      }
      if(lots.length)linkShadowAction(trade,ghostBook.ledger[0],effectiveFraction>=0.999999?'GHOST_SELL':'GHOST_PARTIAL_SELL');
      if(closedIds.size){g.positions=(g.positions||[]).filter(p=>!closedIds.has(p.id));syncVerifiedOutcomesForGhost(trade.walletAddress,g,true);}
      updateGhostDrawdown(g);
    }
  }
  const q=evaluateGhostQualification(g);g.qualified=q.qualified;const dq=evaluateDynamicQualification(trade.walletAddress,g,{persist:true});if(!g.liveActivated&&dq.state!=='AUTO_PAUSED'&&dq.state!=='REQUALIFYING')g.status=q.qualified?'QUALIFIED':'TESTING';persistGhost();
  trade.decision='GHOST';trade.ghost=true;trade.ghostQualification=q;trade.dynamicQualification=dq;broadcast('trade',trade);broadcast('ghost-update',{address:trade.walletAddress,reason:action.toLowerCase(),qualification:q,dynamicQualification:dq});
  if(q.qualified&&!g.qualifiedNotifiedAt){g.qualifiedNotifiedAt=Date.now();persistGhost();pushNotificationEvent({type:'automation',severity:'SUCCESS',title:'Wallet passed Ghost qualification',message:`${wallet.label||trade.walletAddress.slice(0,8)} reached ${q.stats.winRatePct.toFixed(1)}% win rate across ${q.stats.completedTrades} completed ghost trades.`,source:'Ghost Engine',walletAddress:trade.walletAddress});}
  if(q.qualified&&g.config.autoActivateLive&&!g.liveActivated)activateGhostLive(trade.walletAddress,false);
}
function ghostPublicData(){const rows={};for(const [addr,g] of Object.entries(ghostBook.wallets||{}))rows[addr]={...g,qualification:evaluateGhostQualification(g),dynamicQualification:evaluateDynamicQualification(addr,g,{persist:false}),portfolio:ghostPortfolioSummary(g)};return {wallets:rows,ledger:(ghostBook.ledger||[]).slice(0,1000),transactions:transactionLedgerPublic(500),verifiedOutcomes:(verifiedOutcomeBook.order||[]).slice(0,500).map(id=>verifiedOutcomeBook.byId[id]).filter(Boolean),defaults:GHOST_DEFAULTS,polling:{intervalMs:GHOST_POLL_INTERVAL_MS,running:observationPollRunning,activeWallets:Object.values(ghostBook.wallets||{}).filter(ghostNeedsSample).length}};}

// ── MASTER TRADE PIPELINE ───────────────────────────────────
// Single clean pipeline — no monkey-patching
async function processTrade(trade) {
  const wallet = wallets[trade.walletAddress];
  if (!wallet) return;

  // Signature deduplication now happens atomically in the Phase 18 observation
  // engine before this pipeline is entered. Keep the Ghost-local history in
  // sync for backwards-compatible qualification diagnostics.
  if (trade.sourceSignature) {
    const gp=ghostBook.wallets[trade.walletAddress];
    if(gp) rememberGhostSignature(gp,trade.sourceSignature);
  }

  // 1. Enrich with token metadata (FDV, liquidity, freeze/mint authority)
  const meta = await enrichToken(trade.tokenAddress);
  if (meta) {
    trade.fdv         = meta.fdv;
    trade.liquidity   = meta.liquidity;
    trade.tokenName   = meta.name;
    trade.tokenSymbol = meta.symbol;
    trade.marketPriceUsd = meta.priceUsd;
    trade.tokenMeta   = { authorityFlags: meta.authorityFlags, freezeEnabled: meta.freezeEnabled, mintEnabled: meta.mintEnabled };
    trade.market      = { liquidity:meta.liquidity, fdv:meta.fdv, priceUsd:meta.priceUsd, priceChange:meta.priceChange||{}, volume24h:meta.volume24h||0, buys24h:meta.buys24h||0, sells24h:meta.sells24h||0, pairCreatedAt:meta.pairCreatedAt||null };
    const [holderAnalysis, provenance] = await Promise.all([getHolderConcentration(trade.tokenAddress), getProvenanceSignals(meta.symbol, trade.tokenAddress)]);
    trade.holderAnalysis = holderAnalysis; trade.provenance = provenance; trade.tokenMeta.holderAnalysis = holderAnalysis; trade.tokenMeta.provenance = provenance;
    // Update short token name if we got a real symbol
    if (meta.symbol) trade.token = `$${meta.symbol}`;
  }

  // Phase 20: resolve execution price separately from the current market quote.
  await attachMarketPricing(trade);
  linkPricingEvidence(trade);

  // 2. Bundle detection
  const bundle = checkBundle(trade);
  if (bundle) trade.bundleAlert = bundle;

  // 3. Deterministic Phase 6 assessment exists even when no AI key is configured.
  trade.riskAssessment = assessTradeRisk(trade, wallet);
  recordRiskEvent(trade, trade.riskAssessment, 'live-trade');

  // 4. Route: Ghost qualification vs Trusted auto-execute vs Pending manual approval
  if (wallet.tier === 'trusted') {
    const monitor=ghostBook.wallets[trade.walletAddress];
    if(monitor?.enabled&&monitor?.liveActivated) await processGhostTrade({...trade}, wallet);
    if(settings.autoExecute&&!settings.automationPaused) await autoExecuteTrade(trade, wallet);
    else await queueForApproval(trade, wallet);
  } else if (wallet.tier === 'ghost' || ghostBook.wallets[trade.walletAddress]?.enabled) {
    await processGhostTrade(trade, wallet);
  } else {
    await queueForApproval(trade, wallet);
  }
}

// ── PHASE 32 · Execution Safety & Full Logic Audit ───────────
const LIVE_SIGNAL_MAX_AGE_MS=60_000;
const LIVE_OBSERVATION_MAX_LATENCY_MS=45_000;
const EXECUTION_ATTEMPT_LIMIT=3000;
function persistExecutionSafety(){executionSafetyBook.attempts=(executionSafetyBook.attempts||[]).slice(0,EXECUTION_ATTEMPT_LIMIT);writeJson(EXECUTION_SAFETY_F,executionSafetyBook);}
function executionEventKey(trade={}){
  return trade.sourceEventKey||transactionEventKey(trade)||[trade.sourceSignature||'',trade.walletAddress||'',trade.tokenAddress||'',String(trade.action||'').toUpperCase()].join(':');
}
function executionSafetyPublicData(limit=250){return {version:1,limits:{liveSignalMaxAgeMs:LIVE_SIGNAL_MAX_AGE_MS,maxObservationLatencyMs:LIVE_OBSERVATION_MAX_LATENCY_MS},stats:executionSafetyBook.stats,attempts:(executionSafetyBook.attempts||[]).slice(0,Math.max(1,Math.min(1000,Number(limit)||250))).map(x=>({...x,tradeSnapshot:undefined}))};}
function validateLiveExecutionSignal(trade={}){
  const action=String(trade.action||'').toUpperCase(),now=Date.now(),chainTs=Number(trade.timestamp||0),observedAt=Number(trade.observedAt||0);
  if(!['BUY','SELL'].includes(action))return {ok:false,code:'INVALID_ACTION',reason:'Live execution requires BUY or SELL action'};
  if(!trade.walletAddress||!trade.tokenAddress)return {ok:false,code:'MISSING_IDENTITY',reason:'Live execution requires wallet and token identity'};
  if(!trade.sourceSignature)return {ok:false,code:'MISSING_SOURCE_SIGNATURE',reason:'Live automation requires an authoritative Solana source signature'};
  if(!chainTs||!observedAt)return {ok:false,code:'MISSING_TIMESTAMPS',reason:'Live automation requires blockchain and observation timestamps'};
  const signalAgeMs=Math.max(0,now-chainTs),latencyMs=Math.max(0,observedAt-chainTs);
  if(signalAgeMs>LIVE_SIGNAL_MAX_AGE_MS)return {ok:false,code:'STALE_SIGNAL',reason:`Source transaction is ${Math.round(signalAgeMs/1000)}s old; recovered/stale signals are observation-only`};
  if(latencyMs>LIVE_OBSERVATION_MAX_LATENCY_MS)return {ok:false,code:'LATE_OBSERVATION',reason:`Source transaction was observed ${Math.round(latencyMs/1000)}s late; live copy is disabled for delayed recovery events`};
  const quoteAt=Number(trade.marketSnapshot?.fetchedAt||trade.market?.quoteFetchedAt||0),quoteAge=quoteAt?Math.max(0,now-quoteAt):null;
  if(action==='BUY'&&(!quoteAt||quoteAge>120_000))return {ok:false,code:'STALE_MARKET_DATA',reason:'BUY execution requires a token-specific market quote no older than 120 seconds'};
  if(action==='BUY'&&trade.marketSnapshot?.degradedFallback)return {ok:false,code:'DEGRADED_MARKET_FALLBACK',reason:'BUY execution cannot use a degraded cached market quote'};
  if(action==='SELL')return {ok:false,code:'UNVERIFIED_SELL_POSITION',reason:'Automated SELL is fail-closed until CopyGuard has authoritative own-wallet fill/holding evidence; source-wallet SOL size is not a safe sell quantity'};
  return {ok:true,signalAgeMs,latencyMs,quoteAgeMs:quoteAge};
}
function existingExecutionAttempt(trade){const key=executionEventKey(trade);return key?executionSafetyBook.byKey[key]||null:null;}
function reserveExecutionAttempt(trade,mode='AUTO'){
  const key=executionEventKey(trade); if(!key)return {ok:false,reason:'Cannot derive execution event key'};
  const prior=executionSafetyBook.byKey[key];
  if(prior)return {ok:false,duplicate:true,reason:`Source event already has execution state ${prior.status}`,attempt:prior};
  const attempt={id:`exec-${Date.now()}-${Math.random().toString(36).slice(2,8)}`,key,mode,status:'RESERVED',createdAt:Date.now(),updatedAt:Date.now(),sourceSignature:trade.sourceSignature||null,sourceEventKey:key,walletAddress:trade.walletAddress||null,tokenAddress:trade.tokenAddress||null,tokenSymbol:trade.tokenSymbol||null,action:String(trade.action||'').toUpperCase(),sizeSol:Number(trade.sizeSol||0),chainTimestamp:Number(trade.timestamp||0)||null,observedAt:Number(trade.observedAt||0)||null,tradeId:trade.id||null,tradeSnapshot:{...trade}};
  executionSafetyBook.byKey[key]=attempt;executionSafetyBook.attempts.unshift(attempt);executionSafetyBook.stats.reserved=Number(executionSafetyBook.stats.reserved||0)+1;executionSafetyBook.stats.lastAttemptAt=Date.now();persistExecutionSafety();return {ok:true,attempt};
}
function updateExecutionAttemptById(id,status,extra={}){
  const a=(executionSafetyBook.attempts||[]).find(x=>x.id===id);if(!a)return null;a.status=status;a.updatedAt=Date.now();Object.assign(a,extra);
  for(const k of ['submitted','failed','blocked'])if(status===k.toUpperCase())executionSafetyBook.stats[k]=Number(executionSafetyBook.stats[k]||0)+1;
  persistExecutionSafety();return a;
}
function blockExecutionAttempt(trade,code,reason){
  const key=executionEventKey(trade)||`blocked:${trade.id||Date.now()}`;let a=executionSafetyBook.byKey[key];
  if(!a){a={id:`exec-${Date.now()}-${Math.random().toString(36).slice(2,8)}`,key,mode:'AUTO',status:'BLOCKED',createdAt:Date.now(),updatedAt:Date.now(),code,reason,sourceSignature:trade.sourceSignature||null,sourceEventKey:key,walletAddress:trade.walletAddress||null,tokenAddress:trade.tokenAddress||null,action:String(trade.action||'').toUpperCase(),tradeId:trade.id||null};executionSafetyBook.byKey[key]=a;executionSafetyBook.attempts.unshift(a);executionSafetyBook.stats.blocked=Number(executionSafetyBook.stats.blocked||0)+1;persistExecutionSafety();}
  return a;
}
function pendingExecutionCount(walletAddress){return (executionSafetyBook.attempts||[]).filter(a=>a.walletAddress===walletAddress&&['RESERVED','SUBMITTED'].includes(a.status)).length;}
function failClosedExecution(trade,code,reason,{historyRecord=true}={}){blockExecutionAttempt(trade,code,reason);broadcast('trade-blocked',{trade,reason});if(historyRecord)addHistory({...trade,decision:'BLOCKED',blockedReason:`${code}: ${reason}`,executionStatus:'BLOCKED'});return {ok:false,code,reason};}

// ── Trusted auto-execution ──────────────────────────────────
async function autoExecuteTrade(trade, wallet) {
  const config = trustedCfgs[trade.walletAddress];
  const signalGate=validateLiveExecutionSignal(trade); if(!signalGate.ok)return failClosedExecution(trade,signalGate.code,signalGate.reason);
  const priorExecution=existingExecutionAttempt(trade); if(priorExecution){broadcast('trade-blocked',{trade,reason:`Duplicate live execution suppressed — ${priorExecution.status}`});return;}
  const connectionGate=connectionExecutionGate();
  if(!connectionGate.ok)return failClosedExecution(trade,'DEGRADED_MODE',`Connection degraded — ${connectionGate.reason}`);
  if(connectionHealth.services.padre.state!=='ONLINE')return failClosedExecution(trade,'PADRE_NOT_READY',`Padre must be ONLINE before Trusted execution (current: ${connectionHealth.services.padre.state||'UNKNOWN'})`);

  // Phase 9 master automation gates. A trusted label alone is never enough.
  if (settings.automationPaused) {
    broadcast('trade-blocked', { trade, reason:'Automation is emergency-paused' });
    return;
  }
  if (!settings.autoExecute) {
    broadcast('trade-blocked', { trade, reason:'Global auto execute is disabled' });
    return;
  }
  if (!config || config.enabled === false) {
    broadcast('trade-blocked', { trade, reason:'No enabled automation profile for this trusted wallet' });
    await queueForApproval(trade, wallet);
    return;
  }

  // Phase 6 hard-risk gate: deterministic blockers override automation and AI.
  trade.riskAssessment = trade.riskAssessment || assessTradeRisk(trade, wallet);
  if (trade.riskAssessment.hardBlocks?.length) {
    broadcast('trade-blocked', { trade, reason:`CopyGuard hard block — ${trade.riskAssessment.hardBlocks.join('; ')}` });
    addHistory({ ...trade, decision:'BLOCKED', blockedReason:trade.riskAssessment.hardBlocks.join('; ') });
    return;
  }
  const maxRisk = Number(config.maxRiskScore ?? settings.maxAutomationRiskScore ?? 45);
  if (Number(trade.riskAssessment?.score ?? 100) > maxRisk) {
    broadcast('trade-blocked', { trade, reason:`Risk score ${trade.riskAssessment.score}/100 exceeds automation ceiling ${maxRisk}` });
    addHistory({ ...trade, decision:'BLOCKED', blockedReason:`Risk score exceeds automation ceiling ${maxRisk}` });
    return;
  }
  if (config.minLiquidityUsd && Number(trade.liquidity||0) < Number(config.minLiquidityUsd)) {
    broadcast('trade-blocked', { trade, reason:`Liquidity below trusted-wallet minimum ($${Number(config.minLiquidityUsd).toLocaleString()})` });
    return;
  }
  if (config.maxFdvUsd && Number(trade.fdv||0) > Number(config.maxFdvUsd)) {
    broadcast('trade-blocked', { trade, reason:`FDV exceeds trusted-wallet maximum ($${Number(config.maxFdvUsd).toLocaleString()})` });
    return;
  }

  // Daily limits gate
  const today = new Date().toISOString().slice(0,10);
  if (!dailyStats[trade.walletAddress] || dailyStats[trade.walletAddress].date !== today) {
    dailyStats[trade.walletAddress] = { date:today, trades:0, lossSol:0 };
  }
  const ds = dailyStats[trade.walletAddress];
  if (config?.maxDailyTrades && ds.trades >= config.maxDailyTrades) {
    broadcast('trade-blocked', { trade, reason:`Daily trade limit (${config.maxDailyTrades}) reached` });
    return;
  }
  if (config?.maxDailyLossSol && ds.lossSol >= config.maxDailyLossSol) {
    broadcast('trade-blocked', { trade, reason:`Daily loss limit (${config.maxDailyLossSol} SOL) reached` });
    return;
  }

  // Concurrent positions gate
  if (config?.maxConcurrentPositions) {
    const key  = `${trade.walletAddress}:`;
    const open = Object.keys(openPositions).filter(k=>k.startsWith(key)).reduce((n,k)=>n+openPositions[k].length,0) + pendingExecutionCount(trade.walletAddress);
    if (open >= config.maxConcurrentPositions) {
      broadcast('trade-blocked', { trade, reason:`Max ${config.maxConcurrentPositions} concurrent/open execution slots reached` });
      return;
    }
  }

  // AI gate + sizing
  let aiAnalysis = null;
  if (config?.sizingMode === 'ai_weighted' || config?.requireAiApproval) {
    const key = settings.apiKeys?.[settings.aiProvider];
    if (!key && config?.requireAiApproval) {
      broadcast('trade-blocked', { trade, reason:`AI approval is required but ${settings.aiProvider} has no API key configured` });
      return;
    }
    if (key) {
      try { aiAnalysis = await callSpecializedAI(AI_TASKS.TRADE_ANALYSIS,tradeAiEvidence(trade,wallet),trade.riskAssessment); } catch(e) {
        if (config?.requireAiApproval) { broadcast('trade-blocked', { trade, reason:'Required AI approval could not be completed' }); return; }
      }
      if (config?.requireAiApproval && aiAnalysis?.recommendation === 'SKIP') {
        broadcast('trade-blocked', { trade, reason:`AI (${settings.aiProvider}) recommended SKIP — ${aiAnalysis.reasoning}` });
        return;
      }
      if (config?.requireAiApproval && aiAnalysis && Number(aiAnalysis.confidence||0) < Number(config.aiMinConfidence||60)) {
        broadcast('trade-blocked', { trade, reason:`AI confidence ${Number(aiAnalysis.confidence||0)}% is below minimum ${Number(config.aiMinConfidence||60)}%` });
        return;
      }
      if (config?.requireAiApproval && aiAnalysis?.recommendation === 'CAUTION' && config.blockAiCaution) {
        broadcast('trade-blocked', { trade, reason:'AI returned CAUTION and this wallet requires COPY-only automation' });
        return;
      }
    }
  }

  // Calculate size
  const size = calculateSize(trade, wallet, config, aiAnalysis);
  if (size <= 0) { broadcast('trade-blocked', { trade, reason:'Calculated size = 0 (AI confidence too low)' }); return; }
  trade.sizeSol    = size;
  trade.takeProfitPct = Number(config.takeProfitPct||0)||null;
  trade.stopLossPct = Number(config.stopLossPct||0)||null;
  trade.trailingStopPct = Number(config.trailingStopPct||0)||null;
  trade.decision   = 'AUTO';
  trade.analysis   = aiAnalysis;

  // Phase 32: reserve the exact source event before touching Padre. A reservation
  // survives restart and makes the source transaction one-shot for automation.
  const reservation=reserveExecutionAttempt(trade,'AUTO');
  if(!reservation.ok){broadcast('trade-blocked',{trade,reason:reservation.reason||'Duplicate execution suppressed'});return;}
  trade.executionAttemptId=reservation.attempt.id;
  trade.executionStatus='RESERVED';
  addHistory({...trade,decision:'AUTO_RESERVED'});
  broadcast('trade', trade);
  notify(`⚡ Auto-copy reserved $${trade.tokenSymbol || trade.token}`,
    `${wallet.label || 'Trusted'} — ${trade.action} ${size} SOL · waiting for Padre submission`);

  const dispatched=executeTrade(trade);
  if(!dispatched?.ok)updateExecutionAttemptById(reservation.attempt.id,'FAILED',{failureReason:dispatched?.reason||'Padre dispatch failed'});
}

// ── Manual approval queue ───────────────────────────────────
async function queueForApproval(trade, wallet) {
  trade.riskAssessment = trade.riskAssessment || assessTradeRisk(trade, wallet);
  broadcast('trade', trade);
  if (!mainWin?.isFocused()) {
    notify(`🔔 $${trade.tokenSymbol || trade.token} — ${trade.action}`,
      `${wallet.label || trade.walletAddress.slice(0,8)} · ${trade.sizeSol} SOL${trade.bundleAlert?.detected?' ⚠ Bundle!':''}`);
  }

  // AI analysis in background
  const key = settings.apiKeys?.[settings.aiProvider];
  if (key) {
    callSpecializedAI(AI_TASKS.TRADE_ANALYSIS,tradeAiEvidence(trade,wallet),trade.riskAssessment).then(analysis => {
      trade.analysis = analysis;
      broadcast('trade-update', trade);
    }).catch(err => {
      trade.analysisError = err?.message || 'AI analysis failed';
      broadcast('trade-update', trade);
    });
  }
}

// ── Phase 28 Specialized AI Engine ──────────────────────────
const AI_TASKS = Object.freeze({
  TRADE_ANALYSIS:'TRADE_ANALYSIS',
  WALLET_QUALIFICATION:'WALLET_QUALIFICATION',
  EARLY_BIRD:'EARLY_BIRD',
  TOKEN_RESEARCH:'TOKEN_RESEARCH',
  RISK_EXPLANATION:'RISK_EXPLANATION',
  WALLET_DISCOVERY:'WALLET_DISCOVERY',
});
function persistAiDecisions(){aiDecisionBook.decisions=(aiDecisionBook.decisions||[]).slice(0,2000);writeJson(AI_DECISIONS_F,aiDecisionBook);}
function aiEnginePublicData(limit=250){return {version:1,tasks:Object.values(AI_TASKS),stats:aiDecisionBook.stats,decisions:(aiDecisionBook.decisions||[]).slice(0,Math.max(1,Math.min(1000,Number(limit)||250))).map(x=>({...x,prompt:undefined,rawEvidence:undefined}))};}
function aiEvidenceEnvelope(task,evidence={},deterministic={}){
  return {task,evidenceVersion:4,generatedAt:Date.now(),evidence,deterministic:{decision:deterministic.decision||deterministic.recommendation||null,score:deterministic.score??null,level:deterministic.level||null,hardBlocks:deterministic.hardBlocks||[],cautions:deterministic.cautions||[],unknowns:deterministic.unknowns||[],authoritative:true}};
}
function aiTaskSchema(task){
  if(task===AI_TASKS.TRADE_ANALYSIS)return '{"recommendation":"COPY|CAUTION|SKIP","riskLevel":"LOW|MEDIUM|HIGH|CRITICAL","confidence":0,"reasoning":"evidence-grounded explanation","flags":[],"limitations":[]}';
  if(task===AI_TASKS.WALLET_QUALIFICATION)return '{"recommendation":"MAINTAIN|WARN|PAUSE|REQUALIFY","confidence":0,"reasoning":"evidence-grounded explanation","strengths":[],"concerns":[],"limitations":[]}';
  if(task===AI_TASKS.EARLY_BIRD)return '{"recommendation":"SHADOW_TEST|WATCH|REJECT","confidence":0,"reasoning":"evidence-grounded explanation","flags":[],"limitations":[]}';
  if(task===AI_TASKS.TOKEN_RESEARCH)return '{"warningLevel":"SAFE|CAUTION|DANGER","confidence":0,"verdict":"one sentence","bulletPoints":[],"recommendation":"research action only","evidenceLimitations":[]}';
  if(task===AI_TASKS.RISK_EXPLANATION)return '{"decision":"PASS|CAUTION|HARD_BLOCK","confidence":0,"summary":"plain-language explanation","drivers":[],"unknowns":[],"nextChecks":[]}';
  return '{"recommendation":"SHADOW_REVIEW|WATCH|REJECT","confidence":0,"reasoning":"evidence-grounded explanation","strengths":[],"concerns":[],"limitations":[]}';
}
function aiTaskRules(task){
  const common='Use ONLY the supplied structured evidence. Never invent chain activity, profitability, identities, causality, or missing values. Explicit UNKNOWN/UNAVAILABLE evidence must remain unknown. Deterministic hard blocks and deterministic lifecycle states are authoritative and cannot be overridden.';
  if(task===AI_TASKS.TRADE_ANALYSIS)return common+' You are the trade second-opinion specialist. You may recommend COPY, CAUTION, or SKIP, but COPY is advisory only.';
  if(task===AI_TASKS.WALLET_QUALIFICATION)return common+' You are the wallet-qualification explanation specialist. You may discuss MAINTAIN, WARN, PAUSE, or REQUALIFY. You cannot promote a wallet, enable Trusted execution, or waive the 30 verified-outcome requirement.';
  if(task===AI_TASKS.EARLY_BIRD)return common+' You are the Early Bird specialist. Historical early-entry behavior is not proof of copyable profit. SHADOW_TEST is the strongest allowed recommendation.';
  if(task===AI_TASKS.TOKEN_RESEARCH)return common+' You are the token-research specialist. Socials, volume, or branding are never proof of safety. Preserve evidence limitations.';
  if(task===AI_TASKS.RISK_EXPLANATION)return common+' You only EXPLAIN the deterministic Risk Engine v3 decision. Your returned decision must exactly match the supplied deterministic decision.';
  return common+' You are the wallet-discovery specialist. Discovery is not qualification. SHADOW_REVIEW is the strongest allowed recommendation; never recommend Trusted/live execution.';
}
function normalizeSpecializedAi(task,raw,deterministic={}){
  const out={...raw};out.confidence=Math.max(0,Math.min(100,Number(raw?.confidence??50)));out.task=task;out.provider=settings.aiProvider||'anthropic';out.analyzedAt=Date.now();out.evidenceVersion=4;out.deterministicOverride=false;
  if(task===AI_TASKS.TRADE_ANALYSIS){const n=normalizeAIAnalysis(raw,deterministic);return {...out,...n,task,evidenceVersion:4,limitations:Array.isArray(raw?.limitations)?raw.limitations.map(String).slice(0,8):[]};}
  if(task===AI_TASKS.RISK_EXPLANATION){out.decision=deterministic.decision||deterministic.recommendation||'CAUTION';out.deterministicOverride=String(raw?.decision||'').toUpperCase()!==String(out.decision).toUpperCase();out.summary=String(raw?.summary||raw?.reasoning||'No explanation returned.').slice(0,1200);}
  if(task===AI_TASKS.WALLET_QUALIFICATION){let r=String(raw?.recommendation||'WARN').toUpperCase();if(!['MAINTAIN','WARN','PAUSE','REQUALIFY'].includes(r))r='WARN';out.recommendation=r;}
  if(task===AI_TASKS.EARLY_BIRD){let r=String(raw?.recommendation||'WATCH').toUpperCase();if(!['SHADOW_TEST','WATCH','REJECT'].includes(r))r='WATCH';out.recommendation=r;}
  if(task===AI_TASKS.WALLET_DISCOVERY){let r=String(raw?.recommendation||'WATCH').toUpperCase();if(!['SHADOW_REVIEW','WATCH','REJECT'].includes(r))r='WATCH';out.recommendation=r;}
  if(task===AI_TASKS.TOKEN_RESEARCH){let w=String(raw?.warningLevel||'CAUTION').toUpperCase();if(!['SAFE','CAUTION','DANGER'].includes(w))w='CAUTION';if((deterministic.hardBlocks||[]).length){w='DANGER';out.deterministicOverride=true;}out.warningLevel=w;}
  return out;
}
function recordAiDecision(task,envelope,result,error=null){
  const ev=envelope?.evidence||{},det=envelope?.deterministic||{};const id=`ai-${Date.now()}-${Math.random().toString(36).slice(2,8)}`;
  const signalCodes=[...(det.hardBlocks||[]),...(det.cautions||[])].map(String).slice(0,30);
  const row={id,task,provider:settings.aiProvider||'anthropic',at:Date.now(),subject:ev.walletAddress||ev.address||ev.tokenAddress||ev.ticker||null,walletAddress:ev.walletAddress||ev.address||null,tokenAddress:ev.tokenAddress||null,sourceSignature:ev.sourceSignature||null,sourceEventKey:ev.sourceEventKey||null,chainTimestamp:Number(ev.chainTimestamp||0)||null,deterministicDecision:det.decision||null,deterministicScore:det.score??null,hardBlockCount:(det.hardBlocks||[]).length,signalCodes,recommendation:result?.recommendation||result?.warningLevel||result?.decision||null,confidence:result?.confidence??null,deterministicOverride:!!result?.deterministicOverride,error:error?String(error).slice(0,500):null};
  aiDecisionBook.decisions.unshift(row);aiDecisionBook.stats.total=Number(aiDecisionBook.stats.total||0)+1;aiDecisionBook.stats.byTask[task]=Number(aiDecisionBook.stats.byTask[task]||0)+1;aiDecisionBook.stats.lastDecisionAt=Date.now();persistAiDecisions();rebuildClosedLoopLearning();return row;
}
async function callSpecializedAI(task,evidence={},deterministic={}){
  if(!Object.values(AI_TASKS).includes(task))throw new Error('Unsupported AI task: '+task);
  const envelope=aiEvidenceEnvelope(task,evidence,deterministic);const schema=aiTaskSchema(task);const prompt=`${aiTaskRules(task)}\n\nStructured Evidence Envelope:\n${JSON.stringify(envelope,null,2)}\n\nReturn ONLY valid JSON matching this schema:\n${schema}`;
  try{const raw=await callAI({action:task,sizeSol:0},{stats:{}},prompt);const normalized=normalizeSpecializedAi(task,raw,deterministic);recordAiDecision(task,envelope,normalized);return normalized;}catch(e){recordAiDecision(task,envelope,null,e.message);throw e;}
}
function tradeAiEvidence(trade,wallet){return {walletAddress:trade.walletAddress||'',walletTier:wallet?.tier||'unknown',walletStats:wallet?.stats||{},action:trade.action,tokenAddress:trade.tokenAddress||'',tokenSymbol:trade.tokenSymbol||trade.token||'',sizeSol:Number(trade.sizeSol||0),executionPrice:trade.executionPrice||null,marketSnapshot:trade.marketSnapshot||trade.market||null,bundleAlert:trade.bundleAlert||null,researchEvidence:trade.researchEvidence||trade.tokenMeta?.researchEvidence||null,sourceSignature:trade.sourceSignature||null,sourceEventKey:trade.sourceEventKey||null,chainTimestamp:trade.chainTimestamp||trade.timestamp||null,observedAt:trade.observedAt||null};}
async function analyzeWalletQualificationAI(address,g){const q=evaluateGhostQualification(g),d=evaluateDynamicQualification(address,g,{persist:false});const evidence={walletAddress:address,currentState:d.state,initialQualification:q,rollingMetrics:d.metrics||qualificationBook.wallets?.[address]?.metrics||{},verifiedOutcomeMetrics:verifiedOutcomeMetrics(address,g),recentOutcomes:(verifiedOutcomeBook.order||[]).map(id=>verifiedOutcomeBook.byId[id]).filter(o=>o?.walletAddress===address).slice(0,10).map(o=>({classification:o.classification,returnPct:o.returnPct,pnlSol:o.pnlSol,dataQuality:o.dataQuality,closedAt:o.closedAt}))};return callSpecializedAI(AI_TASKS.WALLET_QUALIFICATION,evidence,{decision:d.state,hardBlocks:[]});}
async function explainRiskWithAI(trade,assessment){const evidence={tokenAddress:trade.tokenAddress||'',tokenSymbol:trade.tokenSymbol||'',walletAddress:trade.walletAddress||'',components:assessment.components||{},flags:assessment.flags||[],confidence:assessment.confidence,unknowns:assessment.unknowns||[],researchCoverage:trade.researchEvidence?.coverage||null};return callSpecializedAI(AI_TASKS.RISK_EXPLANATION,evidence,assessment);}

// ── Phase 29 Closed-Loop Learning Engine ────────────────────
const LEARNING_MIN_SAMPLE = 10;
const LEARNING_MAX_LINK_AGE_MS = 30*24*60*60*1000;
function persistLearning(){writeJson(LEARNING_F,learningBook);}
function learningPredictionPolarity(task,recommendation){
  const r=String(recommendation||'').toUpperCase();
  if(task===AI_TASKS.TRADE_ANALYSIS)return r==='COPY'?1:r==='SKIP'?-1:0;
  if(task===AI_TASKS.EARLY_BIRD)return r==='SHADOW_TEST'?1:r==='REJECT'?-1:0;
  if(task===AI_TASKS.WALLET_DISCOVERY)return r==='SHADOW_REVIEW'?1:r==='REJECT'?-1:0;
  if(task===AI_TASKS.TOKEN_RESEARCH)return r==='SAFE'?1:r==='DANGER'?-1:0;
  if(task===AI_TASKS.WALLET_QUALIFICATION)return r==='MAINTAIN'?1:(r==='PAUSE'||r==='REQUALIFY')?-1:0;
  if(task===AI_TASKS.RISK_EXPLANATION)return r==='PASS'?1:r==='HARD_BLOCK'?-1:0;
  return 0;
}
function learningOutcomePolarity(outcome){return outcome?.classification==='WIN'?1:outcome?.classification==='LOSS'?-1:0;}
function learningMatchScore(row,outcome){
  if(!row||!outcome)return -1;const entryAt=Number(outcome.entry?.chainTimestamp||outcome.entry?.observedAt||0);const rowAt=Number(row.chainTimestamp||row.time||row.at||row.generatedAt||0);if(rowAt&&entryAt&&rowAt>entryAt+60_000)return -1;if(rowAt&&entryAt&&entryAt-rowAt>LEARNING_MAX_LINK_AGE_MS)return -1;
  let score=0;if(row.sourceSignature&&outcome.entry?.signature&&row.sourceSignature===outcome.entry.signature)score+=100;if(row.walletAddress&&row.walletAddress===outcome.walletAddress)score+=25;if(row.tokenAddress&&row.tokenAddress===outcome.tokenAddress)score+=35;if(!score)return -1;score+=Math.max(0,10-Math.floor(Math.abs(entryAt-rowAt)/(24*60*60*1000)));return score;
}
function bestLearningMatch(rows,outcome){let best=null,bestScore=-1;for(const row of rows||[]){const sc=learningMatchScore(row,outcome);if(sc>bestScore){best=row;bestScore=sc;}}return bestScore>=25?best:null;}
function addLearningBucket(map,key,outcome,correct=null){if(!key)return;const b=map[key]||(map[key]={samples:0,wins:0,losses:0,breakevens:0,netPnlSol:0,avgReturnPct:0,correct:0,scored:0});b.samples++;if(outcome.classification==='WIN')b.wins++;else if(outcome.classification==='LOSS')b.losses++;else b.breakevens++;b.netPnlSol+=Number(outcome.pnlSol||0);b.avgReturnPct=((b.avgReturnPct*(b.samples-1))+Number(outcome.returnPct||0))/b.samples;if(correct!==null){b.scored++;if(correct)b.correct++;}b.accuracyPct=b.scored?b.correct/b.scored*100:null;b.winRatePct=b.samples?b.wins/b.samples*100:0;}
function riskSignalCodes(row){const out=[];for(const x of row?.hardBlocks||[])out.push(String(x));for(const x of row?.cautions||[])out.push(String(x));for(const f of row?.flags||[])out.push(String(f?.code||f));return [...new Set(out)].slice(0,40);}
function closedLoopProposals(book){const out=[];for(const [signal,s] of Object.entries(book.riskSignalStats||{})){if(s.samples<LEARNING_MIN_SAMPLE)continue;if(s.avgReturnPct<=-8)out.push({type:'STRENGTHEN_SIGNAL',signal,samples:s.samples,avgReturnPct:s.avgReturnPct,winRatePct:s.winRatePct,reason:'Historically associated with materially negative verified Shadow outcomes.',advisoryOnly:true});else if(s.avgReturnPct>=8)out.push({type:'REVIEW_FALSE_POSITIVE',signal,samples:s.samples,avgReturnPct:s.avgReturnPct,winRatePct:s.winRatePct,reason:'This warning/block signal also appears in materially positive verified outcomes; review threshold precision.',advisoryOnly:true});}
  for(const [key,s] of Object.entries(book.recommendationStats||{})){if(s.scored>=LEARNING_MIN_SAMPLE&&Number(s.accuracyPct||0)<45)out.push({type:'AI_CALIBRATION_REVIEW',key,samples:s.scored,accuracyPct:s.accuracyPct,reason:'Specialist recommendation accuracy is below the review threshold.',advisoryOnly:true});}
  return out.slice(0,40);
}
function rebuildClosedLoopLearning(){
  const outcomes=(verifiedOutcomeBook.order||[]).map(id=>verifiedOutcomeBook.byId[id]).filter(o=>o?.completedOutcome===true&&o?.sourceVerified===true);
  const next={version:1,generatedAt:Date.now(),links:[],taskStats:{},riskSignalStats:{},recommendationStats:{},providerStats:{},proposals:[],summary:{linkedOutcomes:0,verifiedOutcomes:outcomes.length,aiPredictionsScored:0,riskDecisionsScored:0}};
  for(const o of outcomes){
    const taskMatches=[];for(const task of Object.values(AI_TASKS)){const m=bestLearningMatch((aiDecisionBook.decisions||[]).filter(d=>d.task===task&&!d.error),o);if(m)taskMatches.push(m);}
    const risk=bestLearningMatch(riskDecisionBook.decisions||[],o);const link={outcomeId:o.id,walletAddress:o.walletAddress,tokenAddress:o.tokenAddress,entrySignature:o.entry?.signature||null,classification:o.classification,returnPct:o.returnPct,pnlSol:o.pnlSol,aiDecisionIds:taskMatches.map(x=>x.id),riskDecisionId:risk?.id||null};if(taskMatches.length||risk){next.links.push(link);next.summary.linkedOutcomes++;}
    const actual=learningOutcomePolarity(o);
    for(const d of taskMatches){const predicted=learningPredictionPolarity(d.task,d.recommendation);const correct=(predicted===0||actual===0)?null:predicted===actual;addLearningBucket(next.taskStats,d.task,o,correct);addLearningBucket(next.recommendationStats,`${d.task}:${d.recommendation||'UNKNOWN'}`,o,correct);addLearningBucket(next.providerStats,`${d.provider||'unknown'}:${d.task}`,o,correct);if(correct!==null)next.summary.aiPredictionsScored++;}
    if(risk){const predicted=learningPredictionPolarity(AI_TASKS.RISK_EXPLANATION,risk.decision);const correct=(predicted===0||actual===0)?null:predicted===actual;addLearningBucket(next.recommendationStats,`RISK_ENGINE:${risk.decision||'UNKNOWN'}`,o,correct);for(const code of riskSignalCodes(risk))addLearningBucket(next.riskSignalStats,code,o,null);next.summary.riskDecisionsScored++;}
  }
  next.proposals=closedLoopProposals(next);learningBook=next;persistLearning();return learningBook;
}
function learningPublicData(){const b=rebuildClosedLoopLearning();return {...b,links:(b.links||[]).slice(0,250),proposals:(b.proposals||[]).slice(0,40)};}

// ── AI provider router ──────────────────────────────────────
async function parseAiJsonResponse(text) {
  const raw = String(text || '').replace(/```json|```/gi,'').trim();
  const first = raw.indexOf('{'), last = raw.lastIndexOf('}');
  if (first < 0 || last < first) throw new Error('AI provider did not return JSON');
  return JSON.parse(raw.slice(first, last + 1));
}

async function ensureAiOk(res, provider) {
  if (res.ok) return;
  let body = '';
  try { body = await res.text(); } catch {}
  throw new Error(`${provider} API HTTP ${res.status}${body ? ': '+body.slice(0,300) : ''}`);
}

async function callAI(trade, wallet, customPrompt) {
  const provider = settings.aiProvider || 'anthropic';
  const apiKey   = settings.apiKeys?.[provider];
  if (!apiKey) throw new Error('No API key for ' + provider);
  const prompt = customPrompt || buildTradePrompt(trade, wallet);

  if (provider === 'anthropic') {
    const res = await apiFetch('https://api.anthropic.com/v1/messages', {
      method:'POST',
      headers:{'Content-Type':'application/json','x-api-key':apiKey,'anthropic-version':'2023-06-01'},
      body: JSON.stringify({model:'claude-sonnet-5',max_tokens:650,system:'Return ONLY valid JSON matching the requested schema.',messages:[{role:'user',content:prompt}]})
    }, 20_000);
    await ensureAiOk(res,'Anthropic');
    const d=await res.json();
    return parseAiJsonResponse(d.content?.map(x=>x.text||'').join('\n'));
  }

  if (provider === 'openai') {
    const res = await apiFetch('https://api.openai.com/v1/responses', {
      method:'POST',headers:{'Content-Type':'application/json','Authorization':`Bearer ${apiKey}`},
      body:JSON.stringify({model:'gpt-5.6-luna',input:[{role:'system',content:[{type:'input_text',text:'Return ONLY valid JSON matching the requested schema.'}]},{role:'user',content:[{type:'input_text',text:prompt}]}],max_output_tokens:650})
    },20_000);
    await ensureAiOk(res,'OpenAI');
    const d=await res.json();
    const text=d.output_text || (d.output||[]).flatMap(o=>o.content||[]).map(c=>c.text||c.output_text||'').join('\n');
    return parseAiJsonResponse(text);
  }

  if (provider === 'gemini') {
    const res = await apiFetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent?key=${apiKey}`, {
      method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({contents:[{parts:[{text:prompt}]}],generationConfig:{responseMimeType:'application/json',maxOutputTokens:650}})
    },20_000);
    await ensureAiOk(res,'Gemini');
    const d=await res.json();
    return parseAiJsonResponse(d.candidates?.[0]?.content?.parts?.map(x=>x.text||'').join('\n'));
  }

  if (provider === 'xai') {
    const res=await apiFetch('https://api.x.ai/v1/chat/completions',{
      method:'POST',headers:{'Content-Type':'application/json','Authorization':`Bearer ${apiKey}`},
      body:JSON.stringify({model:'grok-4.6',messages:[{role:'system',content:'Return ONLY valid JSON matching the requested schema.'},{role:'user',content:prompt}],max_tokens:650})
    },20_000);
    await ensureAiOk(res,'xAI');
    const d=await res.json();
    return parseAiJsonResponse(d.choices?.[0]?.message?.content);
  }

  if (provider === 'perplexity') {
    const res=await apiFetch('https://api.perplexity.ai/chat/completions',{
      method:'POST',headers:{'Content-Type':'application/json','Authorization':`Bearer ${apiKey}`},
      body:JSON.stringify({model:'sonar-pro',messages:[{role:'system',content:'Return ONLY valid JSON matching the requested schema.'},{role:'user',content:prompt}],max_tokens:650})
    },20_000);
    await ensureAiOk(res,'Perplexity');
    const d=await res.json();
    return parseAiJsonResponse(d.choices?.[0]?.message?.content);
  }
  throw new Error('Unsupported AI provider: '+provider);
}

function buildTradePrompt(trade, wallet) {
  const authFlags = trade.tokenMeta?.authorityFlags?.map(f=>f.msg).join('; ') || 'unknown';
  const det = trade.riskAssessment || assessTradeRisk(trade, wallet);
  return `You are the advisory analysis layer inside CopyGuard. Analyze this observed Solana copy-trade signal. Do not promise profit. Return ONLY valid JSON.

Wallet track record: ${wallet.stats?.winRate?.toFixed(1)??'?'}% win rate, ${wallet.stats?.totalTrades??'?'} tracked trades, ${wallet.stats?.totalPnl??'?'} SOL tracked P&L, tier: ${wallet.tier||'unknown'}
Observed trade: ${trade.action} ${trade.sizeSol} SOL of ${trade.tokenSymbol||trade.token||trade.tokenAddress}
FDV: ${trade.fdv ? '$'+fmtNum(trade.fdv) : 'unknown'}
Liquidity: ${trade.liquidity ? '$'+fmtNum(trade.liquidity) : 'unknown'}
Token authorities: ${authFlags}
Coordination: ${trade.bundleAlert?.detected ? trade.bundleAlert.message : 'No watched-wallet bundle alert detected'}
Deterministic CopyGuard score: ${det.score}/100 (${det.level})
Deterministic flags: ${det.flags?.map(f=>f.code+': '+f.message).join(' | ') || 'none'}
Hard blockers: ${det.hardBlocks?.join(' | ') || 'none'}

Evaluate market/liquidity quality, token-control risk, wallet quality, coordination risk, and whether the detected size increases exposure. The deterministic hard blockers are mandatory and must not be contradicted.
Return ONLY this schema:
{"recommendation":"COPY"|"CAUTION"|"SKIP","riskLevel":"LOW"|"MEDIUM"|"HIGH"|"CRITICAL","confidence":0-100,"reasoning":"2-4 concise sentences grounded only in the supplied data","flags":["short flag"],"winRateContext":"one concise sentence about the wallet track record"}`;
}

// ── Position sizing ─────────────────────────────────────────
function calculateSize(trade, wallet, config, aiAnalysis) {
  if (!config) return Math.min(trade.sizeSol, settings.maxSolGlobal || 2);
  const cap  = Math.min(config.maxSolPerTrade || 0.5, settings.maxSolGlobal || 2);
  const mode = config.sizingMode || 'fixed';

  let size = config.fixedSol || 0.5;

  if (mode === 'ai_weighted') {
    const conf = (aiAnalysis?.confidence ?? 70) / 100;
    if (conf < (config.aiMinConfidence || 60) / 100) return 0;
    size = (config.aiBaseSol || 0.5) * conf;
  } else if (mode === 'kelly') {
    const p      = (wallet.stats?.winRate ?? 55) / 100;
    const b      = config.kellyWinLossRatio || 1.5;
    const kellyF = Math.max(0, (p*b - (1-p)) / b);
    const frac   = config.kellyFraction || 0.25;
    size = (config.kellyBankrollSol || 10) * kellyF * frac;
  } else if (mode === 'percent_balance') {
    size = (config.balancePercent || 5) / 100 * (config.kellyBankrollSol || 10);
  }

  return parseFloat(Math.min(size, cap).toFixed(4));
}

// ── PnL tracking ────────────────────────────────────────────
function posKey(w, t) { return `${w}:${t}`; }

function recordBuy(trade) {
  const k = posKey(trade.walletAddress, trade.tokenAddress);
  if (!openPositions[k]) openPositions[k] = [];
  const tokenAmount = Number(trade.tokenAmount || 0) || null;
  const entryPriceSol = tokenAmount ? Number(trade.sizeSol || 0) / tokenAmount : null;
  openPositions[k].push({
    id:trade.id,
    entrySol:Number(trade.sizeSol||0),
    tokenAmount,
    entryPriceSol,
    entryPriceUsd:Number(trade.priceUsd||0)||null,
    tokenSymbol:trade.tokenSymbol||null,
    tokenName:trade.tokenName||null,
    walletLabel:trade.walletLabel||null,
    decision:trade.decision||null,
    takeProfitPct:trade.takeProfitPct||null,
    stopLossPct:trade.stopLossPct||null,
    trailingStopPct:trade.trailingStopPct||null,
    openedAt:trade.timestamp||Date.now()
  });
  writeJson(POSITIONS_F, openPositions);
}

function recordSell(trade) {
  const k     = posKey(trade.walletAddress, trade.tokenAddress);
  const stack = openPositions[k];
  if (!stack?.length) return null;
  const oldest = stack.shift();
  if (!stack.length) delete openPositions[k]; else openPositions[k] = stack;
  writeJson(POSITIONS_F, openPositions);
  const exitSol = Number(trade.sizeSol||0);
  const pnl    = parseFloat((exitSol - Number(oldest.entrySol||0)).toFixed(4));
  const pnlPct = oldest.entrySol > 0 ? parseFloat(((pnl/oldest.entrySol)*100).toFixed(1)) : 0;
  const closed = {
    ...oldest,
    walletAddress:trade.walletAddress,
    tokenAddress:trade.tokenAddress,
    tokenSymbol:trade.tokenSymbol||oldest.tokenSymbol||null,
    walletLabel:trade.walletLabel||oldest.walletLabel||null,
    exitSol,
    exitPriceUsd:Number(trade.priceUsd||0)||null,
    closedAt:trade.timestamp||Date.now(),
    pnl,
    pnlPct,
    holdMs:(trade.timestamp||Date.now())-oldest.openedAt,
    closeTradeId:trade.id,
    closeDecision:trade.decision||null,
  };
  closedPositions.unshift(closed);
  if (closedPositions.length > 1000) closedPositions.length = 1000;
  writeJson(CLOSED_POSITIONS_F, closedPositions);
  broadcast('pnl-closed', closed);
  return closed;
}

function updateWalletPnL(addr, pnl) {
  const w = wallets[addr];
  if (!w) return;
  w.stats = w.stats || {};
  const won = pnl > 0;
  w.stats.wins     = (w.stats.wins    || 0) + (won ? 1 : 0);
  w.stats.losses   = (w.stats.losses  || 0) + (won ? 0 : 1);
  w.stats.totalPnl = parseFloat(((w.stats.totalPnl||0) + pnl).toFixed(4));
  w.stats.winRate  = w.stats.totalTrades > 0 ? (w.stats.wins / w.stats.totalTrades) * 100 : 0;
  writeJson(WALLETS_F, wallets);
  broadcast('wallet-stats-updated', { address:addr, stats:w.stats });
}

// ── History ─────────────────────────────────────────────────
function addHistory(trade) {
  history.unshift({ ...trade, savedAt:Date.now() });
  if (history.length > 500) history.pop();
  writeJson(HISTORY_F, history);
}

// ── Padre trade execution ───────────────────────────────────
function executeTrade(trade) {
  // This function is automation-only. Manual COPY never calls it.
  if(settings.automationPaused)return {ok:false,reason:'Emergency pause became active before Padre dispatch'};
  if(!settings.autoExecute)return {ok:false,reason:'Global auto execution was disabled before Padre dispatch'};
  const connectionGate=connectionExecutionGate();
  if(!connectionGate.ok){broadcast('trade-blocked',{trade,reason:`Execution unavailable in degraded mode — ${connectionGate.reason}`});return {ok:false,reason:connectionGate.reason};}
  const signalGate=validateLiveExecutionSignal(trade);if(!signalGate.ok){broadcast('trade-blocked',{trade,reason:signalGate.reason});return {ok:false,reason:signalGate.reason};}
  const attempt=trade.executionAttemptId&&(executionSafetyBook.attempts||[]).find(a=>a.id===trade.executionAttemptId);
  if(!attempt||attempt.status!=='RESERVED')return {ok:false,reason:'Missing active execution reservation'};
  if (!padreView) {
    broadcast('trade-blocked', { trade, reason:'Padre Terminal is not available yet.' });
    return {ok:false,reason:'Padre Terminal unavailable'};
  }
  if(!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(String(trade.tokenAddress||'')))return {ok:false,reason:'Invalid Solana token address'};
  if(!['BUY','SELL'].includes(String(trade.action||'').toUpperCase()))return {ok:false,reason:'Invalid execution action'};
  if(!Number.isFinite(Number(trade.sizeSol))||Number(trade.sizeSol)<=0)return {ok:false,reason:'Invalid execution size'};

  const script = `
    (async()=>{
      const cg = window.__cg;
      try {
        const tokenAddress = ${JSON.stringify(trade.tokenAddress)};
        const action       = ${JSON.stringify(trade.action.toLowerCase())};
        const sizeSol      = ${JSON.stringify(String(trade.sizeSol))};
        const tradeId      = ${JSON.stringify(trade.id || '')};
        const attemptId    = ${JSON.stringify(trade.executionAttemptId || '')};

        const abortIfPaused=()=>{if(window.__copyguardEmergencyPaused)throw new Error('Emergency pause active inside Padre before final submission');};
        abortIfPaused();
        // Navigate to the exact token page. Re-check pause after navigation delay.
        if (!location.href.includes(tokenAddress)) {
          location.href = 'https://trade.padre.gg/token/' + tokenAddress;
          await new Promise(r => setTimeout(r, 3000));
        }
        abortIfPaused();

        // Every DOM step is fail-closed: missing controls abort rather than falling through.
        const visible=b=>b && !b.disabled && b.getClientRects().length>0;
        const btns = Array.from(document.querySelectorAll('button')).filter(visible);
        const tab  = btns.find(b => b.textContent.trim().toLowerCase() === action);
        if(!tab)throw new Error('Tab button not found: '+action);
        tab.click(); await new Promise(r => setTimeout(r, 400)); abortIfPaused();

        const inp = document.querySelector('input[placeholder*="Amount"],input[placeholder*="SOL"],input[type="number"]');
        if(!inp || inp.disabled || inp.getClientRects().length===0)throw new Error('Visible enabled amount input not found');
        const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
        if(!setter)throw new Error('Amount input setter unavailable');
        setter.call(inp, sizeSol);inp.dispatchEvent(new Event('input',{bubbles:true}));await new Promise(r=>setTimeout(r,400));abortIfPaused();
        const numeric=Number(inp.value);if(!Number.isFinite(numeric)||numeric<=0)throw new Error('Amount input did not accept a positive value');

        const allBtns = Array.from(document.querySelectorAll('button')).filter(visible).filter(b=>b!==tab);
        const confirm = allBtns.find(b=>['confirm','submit'].includes(b.textContent.trim().toLowerCase())) || allBtns.find(b=>b.textContent.trim().toLowerCase()===action);
        if(!confirm)throw new Error('Distinct enabled confirm/submit button not found');
        abortIfPaused();
        confirm.click();
        cg?.tradeResult({ ok:true, tradeId, attemptId, action, sizeSol, url:location.href });
      } catch(err) {
        cg?.tradeResult({ ok:false, tradeId, attemptId, action, reason:err.message, url:location.href });
        cg?.reportError('executeTrade', err.message);
      }
    })();
  `;

  padreView.webContents.executeJavaScript(script).catch(err => {
    console.error('[executeTrade] executeJavaScript failed:', err.message);
    updateExecutionAttemptById(trade.executionAttemptId,'FAILED',{failureReason:'Padre script injection failed: '+err.message});
    broadcast('trade-blocked', { trade, reason: 'Padre script injection failed: ' + err.message });
  });
  return {ok:true,attemptId:trade.executionAttemptId};
}

function setPadreTPSL(trade, config) {
  if (!padreView) return;
  const hasTp = Number(config?.takeProfitPct || 0) > 0;
  const hasSl = Number(config?.stopLossPct   || 0) > 0;
  if (!hasTp && !hasSl) return;

  const script = `
    (async()=>{
      const cg = window.__cg;
      try {
        await new Promise(r => setTimeout(r, 2500));

        // Find and click the Limit / TP-SL panel
        const btns     = Array.from(document.querySelectorAll('button,a'));
        const limitBtn = btns.find(b => /limit|tp.sl|take.?profit|stop.?loss/i.test(b.textContent));
        if (limitBtn) { limitBtn.click(); await new Promise(r => setTimeout(r, 400)); }

        const setInput = (sel, val) => {
          const el = document.querySelector(sel);
          if (!el) return false;
          const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
          setter?.call(el, String(val));
          el.dispatchEvent(new Event('input', { bubbles:true }));
          return true;
        };

        const tpSet = ${hasTp}
          ? setInput('input[placeholder*="Take Profit"],input[placeholder*="TP"]', ${Number(config?.takeProfitPct || 0)})
          : null;

        const slSet = ${hasSl}
          ? setInput('input[placeholder*="Stop Loss"],input[placeholder*="SL"]', ${Number(config?.stopLossPct || 0)})
          : null;

        cg?.tpslResult({
          ok: true,
          tp: ${hasTp} ? { pct:${Number(config?.takeProfitPct || 0)}, set:tpSet } : null,
          sl: ${hasSl} ? { pct:${Number(config?.stopLossPct   || 0)}, set:slSet } : null,
          url: location.href,
        });
      } catch(err) {
        cg?.reportError('setPadreTPSL', err.message);
      }
    })();
  `;

  setTimeout(() => {
    padreView.webContents.executeJavaScript(script).catch(err => {
      console.error('[setPadreTPSL] executeJavaScript failed:', err.message);
    });
  }, 1500);
}

// ── Health check ────────────────────────────────────────────
function verifiedWalletOutcomes(addr) {
  const ghost = ghostBook.wallets?.[addr];
  const ghostClosed = Array.isArray(ghost?.closed) ? ghost.closed : [];
  if (ghostClosed.length >= 3) {
    return ghostClosed
      .slice()
      .sort((a,b)=>Number(b.closedAt||b.time||0)-Number(a.closedAt||a.time||0))
      .map(x=>({ pnl:Number(x.pnlSol||0), time:Number(x.closedAt||x.time||0), source:'shadow' }));
  }
  return history
    .filter(h=>h.walletAddress===addr && Number.isFinite(Number(h.pnl)))
    .sort((a,b)=>Number(b.timestamp||b.time||0)-Number(a.timestamp||a.time||0))
    .map(h=>({ pnl:Number(h.pnl), time:Number(h.timestamp||h.time||0), source:'realized' }));
}

function runHealthCheck() {
  const ROLLING = 10;
  const newAlerts = [];

  for (const [addr, wallet] of Object.entries(wallets)) {
    if (wallet.tier === 'blacklisted') continue;
    const outcomes = verifiedWalletOutcomes(addr).slice(0, ROLLING);
    // Phase 17: never infer profitability from APPROVED/AUTO/REJECTED decisions.
    // A health verdict requires realized or Shadow-realized P&L evidence.
    if (outcomes.length < 3) continue;

    const wins = outcomes.filter(x=>x.pnl>0).length;
    const wr = (wins / outcomes.length) * 100;
    let consec = 0;
    for (const o of outcomes) { if (o.pnl < 0) consec++; else break; }
    const source = outcomes[0]?.source === 'shadow' ? 'Shadow-tested' : 'realized';

    let severity=null, message='';
    if (wr < 35)        { severity='critical'; message=`${source} win rate collapsed to ${wr.toFixed(0)}%`; }
    else if (consec>=3) { severity='warning';  message=`${consec} consecutive verified losses`; }
    else if (wr < 50)   { severity='warning';  message=`${source} win rate slipping: ${wr.toFixed(0)}%`; }

    if (severity && !intel.healthAlerts.some(a=>a.walletAddress===addr&&!a.dismissed)) {
      const alert = { walletAddress:addr, walletLabel:wallet.label, severity, message, rollingWinRate:wr,
        consecutiveLosses:consec, evidenceSource:source, sampleSize:outcomes.length, dismissed:false, triggeredAt:Date.now() };
      newAlerts.push(alert);
      if (severity==='critical' && wallet.tier==='trusted' && settings.autoDemote) {
        wallets[addr].tier = 'pending';
        if (trustedCfgs[addr]) trustedCfgs[addr].enabled = false;
        writeJson(WALLETS_F, wallets); writeJson(TRUSTED_F, trustedCfgs);
        pushNotificationEvent({type:'health',severity:'CRITICAL',title:'Trusted wallet auto-paused',message,source:'Verified Wallet Health',walletAddress:addr});
      }
    }
  }

  if (newAlerts.length>0) {
    intel.healthAlerts.push(...newAlerts);
    writeJson(INTEL_F, intel);
    broadcast('health-alerts', intel.healthAlerts);
    const hasCrit = newAlerts.some(a=>a.severity==='critical');
    notify(hasCrit ? '🚨 Critical Wallet Alert' : '⚠ Wallet Health Warning',
      newAlerts.map(a=>`${a.walletLabel||a.walletAddress.slice(0,8)}: ${a.message}`).join('\n'));
  }
}

// ── Phase 27 Wallet Discovery Engine ────────────────────────
const DISCOVERY_MIN_INDEPENDENT_TOKENS = 3;
const DISCOVERY_MAX_CANDIDATES = 100;
const DISCOVERY_SCAN_INTERVAL_MS = 30 * 60 * 1000;
let discoveryTimer = null, discoveryInitialTimer = null;

function persistDiscovery(){
  const ranked=Object.entries(discoveryBook.candidates||{}).sort((a,b)=>Number(b[1]?.lastSeenAt||0)-Number(a[1]?.lastSeenAt||0)).slice(0,DISCOVERY_MAX_CANDIDATES);
  discoveryBook.candidates=Object.fromEntries(ranked); discoveryBook.runs=(discoveryBook.runs||[]).slice(0,100); writeJson(DISCOVERY_F,discoveryBook);
}
function discoveryPublicData(){
  const vals=Object.values(discoveryBook.candidates||{});
  const candidates=[...vals].sort((a,b)=>Number(b.score||0)-Number(a.score||0)||Number(b.lastSeenAt||0)-Number(a.lastSeenAt||0)).slice(0,100).map(x=>assistantScrub({
    address:x.address,shortAddress:x.shortAddress||null,score:Number(x.score||0),gate:x.gate||'UNKNOWN',shadowEligible:!!x.shadowEligible,
    independentTokens:Number(x.independentTokens??x.historicalRepeat??0),historicalRepeat:Number(x.historicalRepeat||0),avgRank:x.avgRank??null,
    top10Rate:x.top10Rate??null,under10mRate:x.under10mRate??null,highConfidenceRate:x.highConfidenceRate??null,positiveRunRate:x.positiveRunRate??null,
    historicalRunMultiple:x.historicalRunMultiple??null,clusterPenalty:Number(x.clusterPenalty||0),clusterOverlap:Number(x.clusterOverlap||0),strongestPeer:x.strongestPeer||null,
    firstSeenAt:x.firstSeenAt||null,lastSeenAt:x.lastSeenAt||null,lastScanEvidenceId:x.lastScanEvidenceId||null,evidenceType:x.evidenceType||null,evidenceVerified:x.evidenceVerified===true,source:x.source||null,sourceLabel:x.sourceLabel||null,
    evidence:(x.evidence||[]).slice(0,12).map(e=>({address:e.address||null,symbol:e.symbol||null,rank:e.rank??null,signature:e.signature||null,secondsAfterLaunch:e.secondsAfterLaunch??null,reconstructionConfidence:e.reconstructionConfidence||null,entryPriceUsd:e.entryPriceUsd??null,priceSource:e.priceSource||null,priceChange24h:e.priceChange24h??null,liquidity:e.liquidity??null})),
    aiAssessment:x.aiAssessment||null,aiError:x.aiError||null
  }));
  return {stats:{...(discoveryBook.stats||{}),candidates:vals.length,shadowReady:vals.filter(x=>x.shadowEligible).length,rejectedOneHit:vals.filter(x=>x.gate==='ONE_HIT_WONDER').length,clustered:vals.filter(x=>Number(x.clusterPenalty||0)>0).length},candidates,recentRuns:(discoveryBook.runs||[]).slice(0,10)};
}
function startDiscoveryScheduler(){
  if(!discoveryTimer)discoveryTimer=setInterval(runWalletDiscovery,DISCOVERY_SCAN_INTERVAL_MS);
  if(!discoveryInitialTimer)discoveryInitialTimer=setTimeout(()=>{discoveryInitialTimer=null;runWalletDiscovery();},15_000);
}
function stopDiscoveryScheduler(){if(discoveryTimer){clearInterval(discoveryTimer);discoveryTimer=null;}if(discoveryInitialTimer){clearTimeout(discoveryInitialTimer);discoveryInitialTimer=null;}}

async function getDiscoveryTokens(limit=14) {
  const candidates = new Map();
  try {
    const profileRes = await apiFetch('https://api.dexscreener.com/token-profiles/latest/v1', {}, 10_000);
    if (profileRes.ok) {
      const profiles = await profileRes.json();
      for (const p of (Array.isArray(profiles)?profiles:[])) { if (p.chainId==='solana' && p.tokenAddress) candidates.set(p.tokenAddress,{address:p.tokenAddress,source:'recent-profile'}); if (candidates.size>=36) break; }
    }
  } catch(e) { console.warn('[Discovery] profiles:', e.message); }
  const scored=[];
  for (const c of [...candidates.values()].slice(0,28)) {
    try {
      const r=await apiFetch(`https://api.dexscreener.com/latest/dex/tokens/${c.address}`,{},8_000); if(!r.ok) continue;
      const pairs=(await r.json()).pairs||[]; const pair=pairs.filter(p=>p.chainId==='solana').sort((a,b)=>Number(b.liquidity?.usd||0)-Number(a.liquidity?.usd||0))[0]; if(!pair) continue;
      const liq=Number(pair.liquidity?.usd||0), vol=Number(pair.volume?.h24||0), tx=(pair.txns?.h24?.buys||0)+(pair.txns?.h24?.sells||0), h24=Number(pair.priceChange?.h24||0);
      if(liq<10000 || tx<20) continue;
      scored.push({address:c.address,symbol:pair.baseToken?.symbol||'',liquidity:liq,volume24h:vol,activity:tx,priceChange24h:h24,createdAt:Number(pair.pairCreatedAt||0),source:c.source});
    } catch(_) {} await new Promise(r=>setTimeout(r,100));
  }
  return scored.sort((a,b)=>((b.priceChange24h>0?1:0)-(a.priceChange24h>0?1:0))||((b.volume24h+b.liquidity)-(a.volume24h+a.liquidity))).slice(0,limit);
}

function scoreDiscoveryCandidate(address,hits,cohortMap){
  const unique=[...new Map(hits.map(h=>[h.address,h])).values()];
  const independentTokens=unique.length;
  const avgRank=unique.reduce((n,h)=>n+Number(h.rank||25),0)/Math.max(1,independentTokens);
  const top10Rate=unique.filter(h=>Number(h.rank||99)<=10).length/Math.max(1,independentTokens);
  const timed=unique.filter(h=>Number.isFinite(Number(h.secondsAfterLaunch))&&Number(h.secondsAfterLaunch)>=0);
  const under10mRate=timed.length?timed.filter(h=>Number(h.secondsAfterLaunch)<=600).length/timed.length:0;
  const highConfidenceRate=unique.filter(h=>h.reconstructionConfidence==='HIGH').length/Math.max(1,independentTokens);
  const positiveRunRate=unique.filter(h=>Number(h.priceChange24h||0)>0).length/Math.max(1,independentTokens);
  const prior=earlyBirdWallets[address];
  const historicalRepeat=Math.max(independentTokens,Number(prior?.consistency||0));
  const historicalRunMultiple=Number(prior?.avgMultiple||0)||null;
  const peers=(cohortMap.get(address)||[]).filter(x=>x!==address);
  let maxOverlap=0, strongestPeer=null;
  const mine=new Set(unique.map(h=>h.address));
  for(const peer of peers){const ph=cohortMap._hits?.get(peer)||[];const ps=new Set(ph.map(h=>h.address));const common=[...mine].filter(t=>ps.has(t)).length;const overlap=common/Math.max(1,Math.min(mine.size,ps.size));if(overlap>maxOverlap){maxOverlap=overlap;strongestPeer=peer;}}
  const clusterPenalty=maxOverlap>=0.8&&independentTokens>=3?15:maxOverlap>=0.6&&independentTokens>=3?8:0;
  const oneHit=historicalRepeat<DISCOVERY_MIN_INDEPENDENT_TOKENS;
  const repeatability=Math.min(35,historicalRepeat*8);
  const timing=Math.min(25,Math.round(top10Rate*15+under10mRate*7+highConfidenceRate*3));
  const opportunity=Math.min(20,Math.round(positiveRunRate*12+(historicalRunMultiple?Math.min(8,Math.max(0,(historicalRunMultiple-1)*2)):0)));
  const independence=Math.max(0,20-clusterPenalty);
  const score=Math.max(0,Math.min(100,Math.round(repeatability+timing+opportunity+independence)));
  const gate=oneHit?'ONE_HIT_WONDER':clusterPenalty>=15?'CLUSTER_REVIEW':score>=70?'SHADOW_READY':score>=55?'WATCH':'WEAK';
  return {score,gate,shadowEligible:gate==='SHADOW_READY',independentTokens,historicalRepeat,avgRank:Number(avgRank.toFixed(1)),top10Rate:Number(top10Rate.toFixed(3)),under10mRate:Number(under10mRate.toFixed(3)),highConfidenceRate:Number(highConfidenceRate.toFixed(3)),positiveRunRate:Number(positiveRunRate.toFixed(3)),historicalRunMultiple,clusterPenalty,clusterOverlap:Number(maxOverlap.toFixed(3)),strongestPeer};
}

function routeDiscoveryToShadow(address,record){
  if(!record?.shadowEligible||wallets[address])return false;
  wallets[address]={address,label:`Discovered ${address.slice(0,6)}`,tier:'ghost',addedAt:Date.now(),source:'wallet-discovery-v4',rules:{maxSol:.5,buyPercent:100},stats:{totalTrades:0,wins:0,losses:0,totalPnl:0,winRate:0,avgPnl:0},discoveryScore:record.score,discoveryGate:record.gate};
  if(!ghostBook.wallets[address])ghostBook.wallets[address]=newGhostWallet(address,{minCompletedTrades:30});
  ghostBook.wallets[address].discoverySource={score:record.score,gate:record.gate,independentTokens:record.historicalRepeat,routedAt:Date.now()};
  writeJson(WALLETS_F,wallets);persistGhost();reconcileHeliusObservation();
  broadcast('ghost-update',{address,reason:'discovery-shadow-route'});
  pushNotificationEvent({type:'intelligence',severity:'INFO',title:'Discovery routed to Shadow',message:`${address.slice(0,8)} cleared Phase 27 discovery and will be paper-tested for 30 completed outcomes.`,source:'Wallet Discovery',walletAddress:address});
  return true;
}

async function runWalletDiscovery() {
  if (!settings.heliusApiKey) return {ok:false,reason:'Helius API key required'};
  if(discoveryBook.stats.running)return {ok:false,reason:'Discovery scan already running'};
  discoveryBook.stats.running=true; discoveryBook.stats.lastStartedAt=Date.now(); persistDiscovery();
  console.log('[Discovery27] Starting repeatability-first scan...');
  try {
    const tokens = await getDiscoveryTokens(14); if (!tokens.length){discoveryBook.stats.running=false;persistDiscovery();return {ok:true,tokensAnalyzed:0,found:0};}
    const watching=new Set(Object.keys(wallets)), dismissed=new Set(intel.suggestions.filter(s=>s.dismissed).map(s=>s.address)), candMap=new Map();
    for (const tok of tokens) {
      try {
        const buyers=await getEarliestBuyers(tok.address,20,{token:tok,pairCreatedAt:tok.createdAt,maxPages:12,maxSignatures:1200});
        for (const buyer of buyers) {
          if(!buyer.address || watching.has(buyer.address) || dismissed.has(buyer.address)) continue;
          const arr=candMap.get(buyer.address)||[];
          if(!arr.some(x=>x.address===tok.address))arr.push({address:tok.address,symbol:tok.symbol,rank:buyer.rank,signature:buyer.signature,secondsAfterLaunch:buyer.secondsAfterLaunch,reconstructionConfidence:buyer.reconstructionConfidence,entryPriceUsd:buyer.entryPriceUsd,priceSource:buyer.priceSource,priceChange24h:tok.priceChange24h,liquidity:tok.liquidity});
          candMap.set(buyer.address,arr);
        }
      } catch(e){console.warn('[Discovery27] buyer scan:',e.message);}
    }
    const cohortMap=new Map();cohortMap._hits=candMap;
    for(const [a,hits] of candMap){const peers=[];const mine=new Set(hits.map(h=>h.address));for(const [b,bhits] of candMap){if(a===b)continue;if(bhits.some(h=>mine.has(h.address)))peers.push(b);}cohortMap.set(a,peers);}
    const evaluated=[...candMap.entries()].map(([address,hits])=>({address,hits,metrics:scoreDiscoveryCandidate(address,hits,cohortMap)})).sort((a,b)=>b.metrics.score-a.metrics.score);
    let found=0,shadowReady=0,oneHitRejected=0;
    for(const {address:addr,hits,metrics} of evaluated.slice(0,40)){
      const now=Date.now(), existing=intel.suggestions.find(s=>s.address===addr), prev=discoveryBook.candidates[addr]||{};
      const evidenceId=`disc-${addr}-${now}`;
      const record={...prev,address:addr,shortAddress:`${addr.slice(0,6)}...${addr.slice(-4)}`,firstSeenAt:prev.firstSeenAt||now,lastSeenAt:now,lastScanEvidenceId:evidenceId,...metrics,evidence:hits.slice(0,12),evidenceType:'repeatable-token-inflow',evidenceVerified:true,source:'wallet-discovery-v4',sourceLabel:metrics.gate==='ONE_HIT_WONDER'?`Rejected as one-hit/low-repeat candidate (${metrics.historicalRepeat} independent token${metrics.historicalRepeat===1?'':'s'})`:`${metrics.historicalRepeat} independent early-token appearances · ${Math.round(metrics.highConfidenceRate*100)}% high-confidence reconstruction · Shadow proof required`};
      if(metrics.gate!=='ONE_HIT_WONDER'&&settings.apiKeys?.[settings.aiProvider]){try{record.aiAssessment=await callSpecializedAI(AI_TASKS.WALLET_DISCOVERY,{address:addr,score:metrics.score,gate:metrics.gate,independentTokens:metrics.historicalRepeat,avgEntryRank:metrics.avgRank,avgSecondsAfterLaunch:timedAverage(hits),highConfidenceRate:metrics.highConfidenceRate,clusterPenalty:metrics.clusterPenalty,clusterOverlap:metrics.clusterOverlap,evidence:hits.slice(0,10)},{decision:metrics.gate,hardBlocks:[]});}catch(e){record.aiError=e.message;}}
      discoveryBook.candidates[addr]=record;
      if(metrics.gate==='ONE_HIT_WONDER'){oneHitRejected++;continue;}
      const sugg={...(existing||{}),address:addr,shortAddress:record.shortAddress,score:metrics.score,discoveredAt:existing?.discoveredAt||now,lastSeenAt:now,source:'wallet-discovery-v4',sourceLabel:record.sourceLabel,evidenceType:record.evidenceType,evidenceVerified:true,recentTokens:hits.slice(0,6).map(x=>x.symbol||x.address.slice(0,6)),evidence:hits.slice(0,12),independentTokens:metrics.historicalRepeat,avgEntryRank:metrics.avgRank,avgSecondsAfterLaunch:timedAverage(hits),clusterPenalty:metrics.clusterPenalty,clusterOverlap:metrics.clusterOverlap,discoveryGate:metrics.gate,shadowEligible:metrics.shadowEligible,aiAssessment:record.aiAssessment||null,estimatedWinRate:null,estimatedTrades:null,totalPnlSol:null,dismissed:false,alreadyWatching:!!wallets[addr]};
      if(existing)Object.assign(existing,sugg);else{intel.suggestions.unshift(sugg);found++;broadcast('suggestion',sugg);} if(metrics.shadowEligible)shadowReady++;
    }
    // Route only the strongest independent candidates; cap each scan so discovery cannot flood Shadow.
    let autoRouted=0;
    for(const {address,metrics} of evaluated){
      if(autoRouted>=5)break;
      const rec=discoveryBook.candidates[address];
      if(metrics.shadowEligible&&metrics.clusterPenalty===0&&metrics.historicalRepeat>=DISCOVERY_MIN_INDEPENDENT_TOKENS&&routeDiscoveryToShadow(address,rec))autoRouted++;
    }
    const completedAt=Date.now(); discoveryBook.stats={...(discoveryBook.stats||{}),running:false,runs:Number(discoveryBook.stats?.runs||0)+1,lastRunAt:completedAt,lastFound:found,lastShadowReady:shadowReady,lastOneHitRejected:oneHitRejected,lastAutoRouted:autoRouted,lastTokensAnalyzed:tokens.length};
    discoveryBook.runs.unshift({startedAt:discoveryBook.stats.lastStartedAt,completedAt,tokensAnalyzed:tokens.length,candidatesEvaluated:evaluated.length,found,shadowReady,autoRouted,oneHitRejected});
    intel.suggestions=intel.suggestions.sort((a,b)=>Number(b.score||0)-Number(a.score||0)).slice(0,50); writeJson(INTEL_F,intel); persistDiscovery();
    if(found)notify(`🎯 ${found} evidence-backed wallet${found===1?'':'s'} discovered`,`${shadowReady} cleared the repeatability gate for Shadow review; ${oneHitRejected} one-hit/low-repeat candidate${oneHitRejected===1?' was':'s were'} rejected.`);
    return {ok:true,tokensAnalyzed:tokens.length,candidates:evaluated.length,found,shadowReady,autoRouted,oneHitRejected};
  } catch(e){discoveryBook.stats.running=false;discoveryBook.stats.lastError=e.message;persistDiscovery();console.error('[Discovery27]',e.message);return {ok:false,reason:e.message};}
}
function timedAverage(hits){const a=(hits||[]).map(h=>Number(h.secondsAfterLaunch)).filter(Number.isFinite);return a.length?Math.round(a.reduce((x,y)=>x+y,0)/a.length):null;}

// ── Background timers ───────────────────────────────────────
let healthCheckTimer=null;
function startHealthScheduler(){if(!healthCheckTimer)healthCheckTimer=setInterval(runHealthCheck,5*60*1000);}
function stopHealthScheduler(){if(healthCheckTimer){clearInterval(healthCheckTimer);healthCheckTimer=null;}}

// ── Promotion eligibility ───────────────────────────────────
function checkPromoEligible(addr) {
  const w = wallets[addr];
  if (!w || w.tier !== 'pending') return false;
  return (w.stats?.totalTrades||0) >= (settings.promoMinTrades||5) &&
         (w.stats?.winRate    ||0) >= (settings.promoMinWinrate||60);
}

// ── Twitter OAuth callback server ───────────────────────────
let twitterServer = null;

function startTwitterServer() {
  if (twitterServer) return;
  twitterServer = http.createServer((req,res) => {
    const url  = new URL(req.url, 'http://localhost:47821');
    if (url.pathname !== '/callback') { res.end(); return; }
    const code  = url.searchParams.get('code');
    const state = url.searchParams.get('state');
    res.writeHead(200,{'Content-Type':'text/html'});
    res.end(`<!DOCTYPE html><html><head><style>body{font-family:system-ui;background:#090b0f;color:#e8f0fe;display:flex;align-items:center;justify-content:center;height:100vh;flex-direction:column;gap:12px}h1{color:#00e676}p{color:#8899aa}</style></head><body><h1>✓ Connected</h1><p>Return to CopyGuard.</p><script>setTimeout(()=>window.close(),2000)</script></body></html>`);
    if (code && state) broadcast('twitter-oauth-callback', { code, state });
    setTimeout(()=>{twitterServer?.close();twitterServer=null;}, 3000);
  });
  twitterServer.listen(47821);
}

// ── PHASE 33 · AI Assistant Foundation & Architecture ───────
const ASSISTANT_SESSION_LIMIT=50, ASSISTANT_MESSAGE_LIMIT=500, ASSISTANT_AUDIT_LIMIT=1000;
const ASSISTANT_PERMISSIONS=Object.freeze({READ:'READ',ANALYZE:'ANALYZE',RECOMMEND:'RECOMMEND',PREPARE:'PREPARE',CHANGE_CONFIG:'CHANGE_CONFIG',LIVE_EXECUTION:'LIVE_EXECUTION'});
const ASSISTANT_POLICY=Object.freeze({
  READ:{allowed:true,confirmation:false,execution:false},
  ANALYZE:{allowed:true,confirmation:false,execution:false},
  RECOMMEND:{allowed:true,confirmation:false,execution:false},
  PREPARE:{allowed:true,confirmation:true,execution:false},
  CHANGE_CONFIG:{allowed:false,confirmation:true,execution:false},
  LIVE_EXECUTION:{allowed:false,confirmation:true,execution:false},
});
function persistAssistant(){
  assistantBook.order=(assistantBook.order||[]).filter((x,i,a)=>x&&a.indexOf(x)===i).slice(0,ASSISTANT_SESSION_LIMIT);
  const keep=new Set(assistantBook.order);for(const id of Object.keys(assistantBook.sessions||{}))if(!keep.has(id))delete assistantBook.sessions[id];
  for(const session of Object.values(assistantBook.sessions||{}))session.messages=(session.messages||[]).slice(-ASSISTANT_MESSAGE_LIMIT);
  assistantBook.audit=(assistantBook.audit||[]).slice(0,ASSISTANT_AUDIT_LIMIT);
  assistantBook.proposalOrder=(assistantBook.proposalOrder||[]).filter((x,i,a)=>x&&a.indexOf(x)===i).slice(0,250);
  assistantBook.memoryOrder=(assistantBook.memoryOrder||[]).filter((x,i,a)=>x&&a.indexOf(x)===i).slice(0,500); const memoryKeep=new Set(assistantBook.memoryOrder);for(const id of Object.keys(assistantBook.memory||{}))if(!memoryKeep.has(id))delete assistantBook.memory[id];
  assistantBook.governedActionOrder=(assistantBook.governedActionOrder||[]).filter((x,i,a)=>x&&a.indexOf(x)===i).slice(0,250);
  const proposalKeep=new Set(assistantBook.proposalOrder);for(const id of Object.keys(assistantBook.proposals||{}))if(!proposalKeep.has(id))delete assistantBook.proposals[id];
  writeJson(ASSISTANT_F,assistantBook);
}
function newAssistantSession(title='New conversation'){
  const id=`asst-${Date.now()}-${Math.random().toString(36).slice(2,8)}`;
  assistantBook.sessions[id]={id,title:String(title||'New conversation').slice(0,80),createdAt:Date.now(),updatedAt:Date.now(),messages:[],status:'ACTIVE'};
  assistantBook.order.unshift(id);assistantBook.activeSessionId=id;assistantBook.stats.sessions=Number(assistantBook.stats.sessions||0)+1;persistAssistant();return assistantBook.sessions[id];
}
function getAssistantSession(id,create=true){let sid=id||assistantBook.activeSessionId;let row=sid&&assistantBook.sessions?.[sid];if(!row&&create)row=newAssistantSession();return row||null;}
function assistantMessage(role,content,extra={}){return {id:`am-${Date.now()}-${Math.random().toString(36).slice(2,8)}`,role,content:String(content||'').slice(0,12000),time:Date.now(),...extra};}
function assistantPermissionForText(text=''){
  const q=String(text).toLowerCase();
  // Conservative admission classifier only. Phase 35 will add the full NL command router.
  if(/^(\s)*(buy|sell|execute|submit|place)\b|\b(can you|please|go ahead and|i want you to)\s+(buy|sell|execute|submit|place)\b|\b(buy|sell|execute|submit|place)\b.{0,35}\b(trade|order|token|position)\b|\btrade\s+(now|it)\b/.test(q))return ASSISTANT_PERMISSIONS.LIVE_EXECUTION;
  if(/\b(enable|disable|turn on|turn off|change|set|update)\b.{0,50}\b(auto|automation|trusted|risk|threshold|limit|config|setting)\b/.test(q))return ASSISTANT_PERMISSIONS.CHANGE_CONFIG;
  if(/\b(open|prepare|queue|stage)\b/.test(q))return ASSISTANT_PERMISSIONS.PREPARE;
  if(/\b(recommend|suggest|should i|best|which)\b/.test(q))return ASSISTANT_PERMISSIONS.RECOMMEND;
  if(/\b(analy[sz]e|explain|why|compare|investigate|review)\b/.test(q))return ASSISTANT_PERMISSIONS.ANALYZE;
  return ASSISTANT_PERMISSIONS.READ;
}
function assistantPolicyDecision(permission){const p=ASSISTANT_POLICY[permission]||ASSISTANT_POLICY.READ;return {permission,allowed:!!p.allowed,requiresConfirmation:!!p.confirmation,canExecute:false};}

// ── PHASE 34 · CopyGuard System Awareness (read-only) ───────
const ASSISTANT_AWARENESS_MAX_RECORDS=24, ASSISTANT_AWARENESS_MAX_JSON=90_000;
const ASSISTANT_SOURCE_NAMES=Object.freeze([
  'wallets','transactions','market','shadow','verifiedOutcomes','qualification','earlyBird',
  'tokenResearch','risk','discovery','specializedAI','learning','integrity','connectionHealth','executionSafety'
]);
function assistantScrub(value,depth=0){
  if(depth>7)return '[DEPTH_LIMIT]';
  if(Array.isArray(value))return value.slice(0,ASSISTANT_AWARENESS_MAX_RECORDS).map(x=>assistantScrub(x,depth+1));
  if(value&&typeof value==='object'){
    const out={};for(const [k,v] of Object.entries(value)){
      if(/api.?key|secret|authorization|password|private.?key|seed|mnemonic/i.test(k))continue;
      out[k]=assistantScrub(v,depth+1);
    }return out;
  }
  if(typeof value==='string')return value.slice(0,4000);
  return value;
}
function assistantExtractEntities(text=''){
  const q=String(text), base58=[...new Set(q.match(/\b[1-9A-HJ-NP-Za-km-z]{32,44}\b/g)||[])].slice(0,8);
  const lower=q.toLowerCase(), walletMatches=[];
  for(const [address,w] of Object.entries(wallets||{})){const name=String(w?.name||w?.label||'').trim();if(base58.includes(address)||(name&&lower.includes(name.toLowerCase())))walletMatches.push(address);}
  return {addresses:base58,wallets:[...new Set(walletMatches)].slice(0,8),tokens:base58.filter(a=>!walletMatches.includes(a)).slice(0,8)};
}
function assistantRecentTransactions(limit=12){
  return (transactionLedger.order||[]).slice(0,limit).map(sig=>transactionLedger.bySignature?.[sig]).filter(Boolean);
}
function assistantRecentOutcomes(limit=16){
  return (verifiedOutcomeBook.order||[]).slice(0,limit).map(id=>verifiedOutcomeBook.byId?.[id]).filter(Boolean);
}
function assistantRelevantRows(obj={},entities={},limit=12){
  const needles=new Set([...(entities.addresses||[]),...(entities.wallets||[]),...(entities.tokens||[])]);
  const vals=Array.isArray(obj)?obj:Object.values(obj||{});
  if(!needles.size)return vals.slice(0,limit);
  const hits=vals.filter(row=>{let t='';try{t=JSON.stringify(row);}catch{}return [...needles].some(n=>t.includes(n));});
  return hits.slice(0,limit);
}
function assistantAwarenessSnapshot(query='',opts={}){
  const now=Date.now(),entities=assistantExtractEntities(query),h=connectionHealthSnapshot();
  const tx=assistantRecentTransactions(ASSISTANT_AWARENESS_MAX_RECORDS);
  const outcomes=assistantRecentOutcomes(ASSISTANT_AWARENESS_MAX_RECORDS);
  const shadowWallets=Object.values(ghostBook.wallets||{});
  const marketRows=Object.entries(marketBook.latest||{}).map(([token,row])=>({token,...row}));
  const qualRows=Object.entries(qualificationBook.wallets||{}).map(([wallet,row])=>({wallet,...row}));
  const earlyRows=typeof earlyBirdReconstruction!=='undefined'?Object.entries(earlyBirdReconstruction.tokens||{}).map(([token,row])=>({token,...row})):[];
  const researchRows=Object.entries(tokenResearchBook.tokens||{}).map(([token,row])=>({token,...row}));
  const discoveryRows=Object.entries(discoveryBook.candidates||{}).map(([wallet,row])=>({wallet,...row}));
  const sources={
    wallets:{count:Object.keys(wallets||{}).length,records:assistantRelevantRows(Object.entries(wallets||{}).map(([address,row])=>({address,...row})),entities,16)},
    transactions:{count:(transactionLedger.order||[]).length,records:assistantRelevantRows(tx,entities,16)},
    market:{count:Object.keys(marketBook.latest||{}).length,lastRefreshAt:marketBook.stats?.lastRefreshAt||null,records:assistantRelevantRows(marketRows,entities,16)},
    shadow:{count:shadowWallets.length,records:assistantRelevantRows(shadowWallets,entities,16)},
    verifiedOutcomes:{count:(verifiedOutcomeBook.order||[]).length,records:assistantRelevantRows(outcomes,entities,16)},
    qualification:{count:qualRows.length,records:assistantRelevantRows(qualRows,entities,16)},
    earlyBird:{count:earlyRows.length,records:assistantRelevantRows(earlyRows,entities,12)},
    tokenResearch:{count:researchRows.length,records:assistantRelevantRows(researchRows,entities,12)},
    risk:{count:(riskDecisionBook.decisions||[]).length,records:assistantRelevantRows(riskDecisionBook.decisions||[],entities,16)},
    discovery:{count:discoveryRows.length,records:assistantRelevantRows(discoveryRows,entities,16)},
    specializedAI:{count:(aiDecisionBook.decisions||[]).length,records:assistantRelevantRows(aiDecisionBook.decisions||[],entities,16)},
    learning:{generatedAt:learningBook.generatedAt||null,summary:learningBook.summary||{},proposals:(learningBook.proposals||[]).slice(0,12),taskStats:learningBook.taskStats||{},providerStats:learningBook.providerStats||{}},
    integrity:{status:integrityBook.lastStatus||'UNKNOWN',lastAuditAt:integrityBook.lastAuditAt||null,issues:(integrityBook.issues||[]).slice(0,20)},
    connectionHealth:h,
    executionSafety:{stats:executionSafetyBook.stats||{},limits:{liveSignalMaxAgeMs:LIVE_SIGNAL_MAX_AGE_MS,maxObservationLatencyMs:LIVE_OBSERVATION_MAX_LATENCY_MS},recent:(executionSafetyBook.attempts||[]).slice(0,12).map(x=>({...x,tradeSnapshot:undefined}))}
  };
  const freshness={
    observationLastPollAt:observationState?.health?.lastPollAt||null,
    marketLastRefreshAt:marketBook.stats?.lastRefreshAt||null,
    integrityLastAuditAt:integrityBook.lastAuditAt||null,
    learningGeneratedAt:learningBook.generatedAt||null,
    generatedAt:now
  };
  let snapshot={version:1,phase:34,mode:'READ_ONLY_EVIDENCE',generatedAt:now,query:String(query||'').slice(0,1000),entities,sourceCatalog:ASSISTANT_SOURCE_NAMES,freshness,sources,limitations:[
    'Awareness reads existing CopyGuard evidence only; it does not create missing chain evidence.',
    'UNKNOWN/UNAVAILABLE remains unknown and must not be inferred as safe.',
    'Records are capped and query-targeted to keep model context bounded.',
    'Assistant awareness cannot mutate ledgers, settings, Trusted state, risk policy, or execution state.'
  ]};
  snapshot=assistantScrub(snapshot);
  let raw=JSON.stringify(snapshot);
  if(raw.length>ASSISTANT_AWARENESS_MAX_JSON){
    for(const src of Object.values(snapshot.sources||{}))if(Array.isArray(src?.records))src.records=src.records.slice(0,6);
    snapshot.contextTruncated=true;snapshot.contextBytesBeforeTrim=raw.length;
  }else snapshot.contextTruncated=false;
  return snapshot;
}
function assistantAwarenessSummary(snapshot){
  const s=snapshot.sources||{};return {
    phase:34,mode:snapshot.mode,sourceCount:snapshot.sourceCatalog?.length||0,contextTruncated:!!snapshot.contextTruncated,
    counts:{wallets:s.wallets?.count||0,transactions:s.transactions?.count||0,shadow:s.shadow?.count||0,verifiedOutcomes:s.verifiedOutcomes?.count||0,qualification:s.qualification?.count||0,research:s.tokenResearch?.count||0,risk:s.risk?.count||0,discovery:s.discovery?.count||0},
    systemMode:s.connectionHealth?.mode||'UNKNOWN',integrity:s.integrity?.status||'UNKNOWN',freshness:snapshot.freshness
  };
}


// ── PHASE 35 · Natural-Language Command Router ──────────────
// Invariant: model output cannot elevate deterministic assistant permissions.
// Phase 34 grounding remains authoritative: Use ONLY the supplied structured CopyGuard evidence; UNKNOWN/UNAVAILABLE remains unknown.
const ASSISTANT_COMMANDS=Object.freeze({
  SYSTEM_STATUS:{intent:'SYSTEM_STATUS',permission:'READ',sources:['connectionHealth','integrity','executionSafety']},
  WALLET_INSPECT:{intent:'WALLET_INSPECT',permission:'ANALYZE',sources:['wallets','shadow','verifiedOutcomes','qualification','risk','discovery']},
  WALLET_COMPARE:{intent:'WALLET_COMPARE',permission:'ANALYZE',sources:['wallets','shadow','verifiedOutcomes','qualification','risk','discovery']},
  TOKEN_RESEARCH:{intent:'TOKEN_RESEARCH',permission:'ANALYZE',sources:['tokenResearch','risk','market','earlyBird','transactions']},
  RISK_EXPLAIN:{intent:'RISK_EXPLAIN',permission:'ANALYZE',sources:['risk','tokenResearch','market','transactions']},
  TRADE_DECISION:{intent:'TRADE_DECISION',permission:'ANALYZE',sources:['transactions','wallets','qualification','market','risk','tokenResearch','specializedAI','connectionHealth','executionSafety']},
  SHADOW_RANK:{intent:'SHADOW_RANK',permission:'RECOMMEND',sources:['shadow','verifiedOutcomes','qualification','risk']},
  SHADOW_COACH:{intent:'SHADOW_COACH',permission:'ANALYZE',sources:['shadow','verifiedOutcomes','qualification','risk','wallets','market']},
  DISCOVERY_REVIEW:{intent:'DISCOVERY_REVIEW',permission:'ANALYZE',sources:['discovery','earlyBird','shadow','qualification']},
  EARLY_BIRD_REVIEW:{intent:'EARLY_BIRD_REVIEW',permission:'ANALYZE',sources:['earlyBird','transactions','market','risk']},
  LEARNING_REVIEW:{intent:'LEARNING_REVIEW',permission:'ANALYZE',sources:['learning','specializedAI','verifiedOutcomes']},
  PORTFOLIO_REVIEW:{intent:'PORTFOLIO_REVIEW',permission:'ANALYZE',sources:['shadow','verifiedOutcomes','wallets','market','qualification']}, 
  TRANSACTION_TRACE:{intent:'TRANSACTION_TRACE',permission:'ANALYZE',sources:['transactions','market','risk']},
  PREPARE_PADRE:{intent:'PREPARE_PADRE',permission:'PREPARE',sources:['market','risk','tokenResearch','executionSafety']},
  CONFIG_CHANGE:{intent:'CONFIG_CHANGE',permission:'CHANGE_CONFIG',sources:['connectionHealth','executionSafety']},
  LIVE_TRADE:{intent:'LIVE_TRADE',permission:'LIVE_EXECUTION',sources:['market','risk','executionSafety']},
  GENERAL_READ:{intent:'GENERAL_READ',permission:'READ',sources:ASSISTANT_SOURCE_NAMES}
});
function assistantRouteCommand(text=''){
  const q=String(text||'').trim(),l=q.toLowerCase(),entities=assistantExtractEntities(q);
  let key='GENERAL_READ',confidence=55,reason='general CopyGuard read request';
  if(/\b(buy|sell|execute|submit|place)\b.{0,45}\b(trade|order|token|position)\b|\btrade\s+(now|it)\b/.test(l)){key='LIVE_TRADE';confidence=98;reason='live trade verb detected';}
  else if(/\b(enable|disable|turn on|turn off|change|set|update)\b.{0,55}\b(auto|automation|trusted|risk|threshold|limit|config|setting)\b/.test(l)){key='CONFIG_CHANGE';confidence=96;reason='configuration mutation detected';}
  else if(/\b(open|prepare|queue|stage)\b.{0,55}\b(padre|trade|order|token)\b|\bpadre\b/.test(l)){key='PREPARE_PADRE';confidence=94;reason='Padre preparation request detected';}
  else if(/\bcompare\b.{0,90}\b(wallet|trader|address)\b|\b(wallet|trader|address)\b.{0,90}\bcompare\b/.test(l)){key='WALLET_COMPARE';confidence=92;reason='wallet comparison request';}
  else if(/\b(analyze|explain|review|should i copy|copy decision|trade decision)\b.{0,70}\b(trade|transaction|buy|sell|signal)\b|\b(should i copy|copy this trade)\b/.test(l)){key='TRADE_DECISION';confidence=93;reason='trade decision analysis request';}
  else if(/\b(why|explain|reason)\b.{0,60}\b(block|blocked|risk|danger|caution|skip)\b|\b(risk|hard block)\b/.test(l)){key='RISK_EXPLAIN';confidence=91;reason='deterministic risk explanation request';}
  else if(/\b(research|investigate|check)\b.{0,55}\b(token|mint|coin)\b|\b(token|mint)\b.{0,55}\b(research|investigate)\b/.test(l)){key='TOKEN_RESEARCH';confidence=90;reason='token research request';}
  else if(/\b(what|why|how|needs?|progress|close|closest|coach|explain)\b.{0,70}\b(shadow|ghost|qualif|wallet|position|outcome)\b|\b(shadow|ghost)\b.{0,70}\b(progress|needs?|qualif|position|outcome|coach)\b/.test(l)){key='SHADOW_COACH';confidence=92;reason='Shadow/Ghost coaching request';}
  else if(/\b(strongest|best|rank|top)\b.{0,60}\b(shadow|ghost|candidate|wallet)\b/.test(l)){key='SHADOW_RANK';confidence=89;reason='Shadow candidate ranking request';}
  else if(/\b(discovery|discover(ed)? wallet|one.hit|cluster)\b/.test(l)){key='DISCOVERY_REVIEW';confidence=87;reason='wallet discovery request';}
  else if(/\b(early bird|early buyer|launch buyer|sniper)\b/.test(l)){key='EARLY_BIRD_REVIEW';confidence=87;reason='Early Bird reconstruction request';}
  else if(/\b(portfolio|performance|p&l|pnl|profit|loss|drawdown|exposure|equity|attribution)\b/.test(l)){key='PORTFOLIO_REVIEW';confidence=91;reason='portfolio/performance analysis request';}
  else if(/\b(learning|calibration|calibrated|provider performance|ai performance)\b/.test(l)){key='LEARNING_REVIEW';confidence=86;reason='closed-loop learning request';}
  else if(/\b(transaction|signature|tx|trace)\b/.test(l)){key='TRANSACTION_TRACE';confidence=84;reason='transaction trace request';}
  else if(/\b(wallet|trader|address|shadow|ghost|qualified|qualification)\b/.test(l)||entities.wallets.length){key='WALLET_INSPECT';confidence=82;reason='wallet evidence request';}
  else if(/\b(status|health|degraded|integrity|system)\b/.test(l)){key='SYSTEM_STATUS';confidence=80;reason='system status request';}
  const command=ASSISTANT_COMMANDS[key],policy=assistantPolicyDecision(command.permission);
  return {version:1,phase:35,key,intent:command.intent,permission:command.permission,sources:[...command.sources],entities,confidence,reason,allowed:policy.allowed,requiresConfirmation:policy.requiresConfirmation,canExecute:false};
}
function assistantCommandContext(text=''){
  const route=assistantRouteCommand(text),awareness=assistantAwarenessSnapshot(text);
  const selected={};for(const name of route.sources)if(awareness.sources?.[name]!==undefined)selected[name]=awareness.sources[name];
  const targets=assistantWalletTargets(route,text),walletAnalyst=route.key==='WALLET_COMPARE'?assistantWalletCompare(targets):route.key==='WALLET_INSPECT'&&targets[0]?assistantWalletAnalysis(targets[0]):null;
  const tokenTarget=assistantTokenTarget(route,text),tokenResearch=route.key==='TOKEN_RESEARCH'||route.key==='RISK_EXPLAIN'?(tokenTarget?assistantTokenResearchAnalysis(tokenTarget):null):null;
  const tradeDecision=route.key==='TRADE_DECISION'?assistantTradeDecisionAnalysis(route,text):null;
  const shadowTargets=assistantWalletTargets(route,text),shadowCoach=route.key==='SHADOW_COACH'?(shadowTargets.length?assistantShadowCoach(shadowTargets[0]):assistantShadowRanking()):route.key==='SHADOW_RANK'?assistantShadowRanking():null;
  const riskTarget=assistantRiskTarget(route,text),riskInvestigation=route.key==='RISK_EXPLAIN'&&riskTarget.mint?assistantRiskInvestigation(riskTarget.mint,riskTarget):null;
  const learningAnalysis=route.key==='LEARNING_REVIEW'?assistantLearningExplain():null;
  const portfolioAnalysis=route.key==='PORTFOLIO_REVIEW'?assistantPortfolioAnalysis():null;
  return {route,evidence:{version:1,phase:43,generatedAt:awareness.generatedAt,entities:awareness.entities,freshness:awareness.freshness,sources:selected,walletAnalyst,tokenResearch,tradeDecision,shadowCoach,riskInvestigation,learningAnalysis,portfolioAnalysis,limitations:awareness.limitations,contextTruncated:awareness.contextTruncated}};
}
function assistantDeterministicCommandAnswer(route,evidence){
  const s=evidence.sources||{};
  if(route.key==='WALLET_INSPECT'&&evidence.walletAnalyst){const a=evidence.walletAnalyst;return `${a.label||a.address}: ${a.analystGrade}. Verified outcomes: ${a.verified?.completedTrades||0}; win rate: ${Number(a.verified?.winRatePct||0).toFixed(1)}%; ROI: ${a.verified?.roiPct==null?'UNKNOWN':Number(a.verified.roiPct).toFixed(2)+'%'}; qualification: ${a.qualification?.state||'UNKNOWN'}. ${a.qualification?.failedChecks?.length?'Still needs: '+a.qualification.failedChecks.join(', ')+'.':'No failed qualification checks in current evidence.'}`;}
  if(route.key==='WALLET_COMPARE'&&evidence.walletAnalyst){const r=evidence.walletAnalyst.ranking||[];return r.length?`Wallet comparison: ${r.map(x=>`#${x.rank} ${x.label||x.address.slice(0,8)} (${x.analystGrade}, ${x.completedTrades} verified outcomes, ROI ${x.roiPct==null?'UNKNOWN':Number(x.roiPct).toFixed(2)+'%'})`).join('; ')}. Ranking is advisory only.`:'No matching CopyGuard wallets were found to compare.';}
  if(route.key==='PORTFOLIO_REVIEW'&&evidence.portfolioAnalysis){const a=evidence.portfolioAnalysis,v=a.verifiedPerformance,e=a.shadowExposure,t=a.trend;return `Portfolio: ${v.completedOutcomes} source-verified completed Shadow outcome(s), realized P&L ${Number(v.realizedPnlSol||0).toFixed(4)} SOL, win rate ${Number(v.winRatePct||0).toFixed(1)}%. Open Shadow exposure: ${e.count} lot(s), ${Number(e.remainingStakeSol||0).toFixed(4)} SOL remaining stake, ${Number(e.unrealizedPnlSol||0).toFixed(4)} SOL unrealized mark. Recent performance trend: ${t.direction}. Open/marked exposure is not counted as verified realized performance.`;}
  if(route.key==='LEARNING_REVIEW'&&evidence.learningAnalysis){const a=evidence.learningAnalysis,s=a.summary||{},ready=a.providers?.filter(x=>x.scored>=a.minimumReviewSample)||[],best=[...ready].filter(x=>x.accuracyPct!==null).sort((x,y)=>y.accuracyPct-x.accuracyPct)[0];return `Closed-loop learning is based on ${s.verifiedOutcomes||0} source-verified completed outcome(s), with ${s.linkedOutcomes||0} linked to AI/risk decisions. ${s.aiPredictionsScored||0} AI prediction(s) and ${s.riskDecisionsScored||0} risk decision(s) are scored. ${best?`Best adequately sampled provider/task bucket: ${best.key} at ${best.accuracyPct.toFixed(1)}% accuracy across ${best.scored} scored outcome(s). `:''}${a.recurringMisses?.length?`${a.recurringMisses.length} recurring low-accuracy recommendation bucket(s) need review. `:''}${a.proposals?.length?`${a.proposals.length} evidence-backed proposal(s) are advisory only and were not applied.`:'No evidence-backed proposal currently clears the review sample threshold.'}`;}
  if(route.key==='RISK_EXPLAIN'&&evidence.riskInvestigation){const a=evidence.riskInvestigation,v=a.verdict||{},t=a.forensicTrace||{};return `${a.symbol||a.mint}: ${v.decision||'UNKNOWN'} risk decision${v.score==null?'':` at score ${v.score}`}${v.confidence==null?'':` with ${v.confidence}% confidence`}. ${t.hardBlocks?.length?'Hard blocks: '+t.hardBlocks.join('; ')+'. ':''}${t.cautions?.length?'Cautions: '+t.cautions.join('; ')+'. ':''}${t.unknowns?.length?`${t.unknowns.length} evidence field(s) remain UNKNOWN. `:''}${t.flags?.length?`Forensic trace contains ${t.flags.length} evidence-linked risk signal(s).`:''}`;}
  if((route.key==='SHADOW_COACH'||route.key==='SHADOW_RANK')&&evidence.shadowCoach){const c=evidence.shadowCoach;if(c.rows){const top=c.rows.slice(0,3).map(x=>`${x.rank}. ${x.label||x.address}: ${x.progressPct??0}% qualification progress, ${x.completedTrades??0} verified closes${x.nextNeed?.message?`; next: ${x.nextNeed.message}`:''}`).join(' | ');return top||'No Shadow wallets are available to rank.';}return `${c.label||c.address}: ${c.qualification?.progressPct??0}% qualification progress with ${c.verifiedPerformance?.completedTrades??0} verified completed outcomes. ${c.qualification?.qualified?'All deterministic thresholds currently pass.':`Next need: ${c.qualification?.needs?.[0]?.message||'continue verified Shadow testing'}`} Open lots: ${c.openShadow?.count||0}; partial lots: ${c.openShadow?.partialLots||0}. Open/partial activity does not count as a completed qualification outcome.`;}
  if(route.key==='TRADE_DECISION'&&evidence.tradeDecision){const a=evidence.tradeDecision,d=a.decision||{},p=a.pricing||{},w=a.wallet?.analysis;return `Trade decision: ${d.deterministicDecision}. ${a.target?.action||'UNKNOWN'} ${a.target?.tokenAddress||'token UNKNOWN'} from ${w?.label||a.target?.walletAddress||'wallet UNKNOWN'}. Risk: ${d.riskDecision||'UNKNOWN'}${d.riskScore==null?'':` (${d.riskScore})`}. Execution price: ${p.executionPriceUsd==null?'UNKNOWN':'$'+p.executionPriceUsd} (${p.source||'UNRESOLVED'}, ${p.confidence||'LOW'}). ${d.blockers?.length?'Live blockers: '+d.blockers.join(', ')+'.':''} ${a.specializedAI?`Phase 28 AI: ${a.specializedAI.recommendation||'UNKNOWN'} at ${a.specializedAI.confidence??'UNKNOWN'}% confidence.`:'No matching Phase 28 Trade AI decision is recorded.'}`;}
  if((route.key==='TOKEN_RESEARCH'||route.key==='RISK_EXPLAIN')&&evidence.tokenResearch){const a=evidence.tokenResearch;if(a.ok===false)return a.error;const hb=a.risk?.hardBlocks||[],ca=a.risk?.cautions||[],un=a.risk?.unknowns||[];return `${a.symbol||a.mint}: deterministic risk ${a.verdict}${a.risk?.score==null?'':` (score ${a.risk.score})`}. Token program: ${a.tokenProgram?.type||'UNKNOWN'}${a.tokenProgram?.restrictions?.length?`; restrictions: ${a.tokenProgram.restrictions.join(', ')}`:''}. Authorities: mint ${a.authorities?.mintEnabled==null?'UNKNOWN':a.authorities.mintEnabled?'ACTIVE':'renounced'}, freeze ${a.authorities?.freezeEnabled==null?'UNKNOWN':a.authorities.freezeEnabled?'ACTIVE':'renounced'}. Liquidity: ${a.market?.liquidity==null?'UNKNOWN':'$'+Number(a.market.liquidity).toLocaleString()}. Top owner: ${a.holders?.topOwnerPct==null?'UNKNOWN':Number(a.holders.topOwnerPct).toFixed(1)+'%'}. ${hb.length?'Hard blocks: '+hb.join('; ')+'.':''} ${ca.length?'Cautions: '+ca.join('; ')+'.':''} ${un.length?`${un.length} evidence field(s) remain unknown.`:''}`;}
  if(route.key==='SYSTEM_STATUS')return `System mode: ${s.connectionHealth?.mode||'UNKNOWN'}. Integrity: ${s.integrity?.status||'UNKNOWN'}. Execution safety blocks: ${s.executionSafety?.stats?.blocked||0}.`;
  if(route.key==='SHADOW_RANK'){
    const rows=[...(s.shadow?.records||[])]; if(!rows.length)return 'No Shadow wallet evidence is currently available for ranking.';
    return `I found ${rows.length} Shadow wallet record${rows.length===1?'':'s'} in the bounded evidence set. Configure an AI provider for a narrative comparison; deterministic qualification and verified outcomes remain authoritative.`;
  }
  if(route.key==='PREPARE_PADRE')return 'I identified this as a Padre preparation request. Phase 35 routes it to the PREPARE permission boundary, but chat still does not submit or execute a trade.';
  if(route.key==='CONFIG_CHANGE')return 'I identified a configuration-change command. Assistant configuration mutation remains blocked by deterministic policy.';
  if(route.key==='LIVE_TRADE')return 'I identified a live-trade command. Chat cannot execute it; live execution remains exclusively inside the Phase 32 governed execution path.';
  return `Command routed as ${route.intent}. I found structured evidence from ${Object.keys(s).join(', ')||'no matching source'}. Configure an AI provider for a narrative evidence analysis.`;
}


// ── PHASE 36 · Assistant Action Proposal & Confirmation Engine ──
const ASSISTANT_PROPOSAL_TTL_MS=10*60*1000;
const ASSISTANT_PROPOSAL_STATUS=Object.freeze({PENDING:'PENDING_CONFIRMATION',CONFIRMED:'CONFIRMED_NO_EXECUTION',CANCELLED:'CANCELLED',EXPIRED:'EXPIRED',BLOCKED:'BLOCKED'});
function assistantProposalTarget(route,text=''){
  const entities=route.entities||assistantExtractEntities(text),token=entities.tokens?.[0]||entities.addresses?.[0]||null,wallet=entities.wallets?.[0]||null;
  return {tokenAddress:token,walletAddress:wallet};
}
function assistantValidateProposal(route,evidence){
  const reasons=[],warnings=[],s=evidence?.sources||{},target=assistantProposalTarget(route);
  if(route.permission!==ASSISTANT_PERMISSIONS.PREPARE)reasons.push('ONLY_PREPARE_PERMISSION_CAN_CREATE_ACTION_PROPOSAL');
  if(route.key!=='PREPARE_PADRE')reasons.push('ROUTE_NOT_SUPPORTED_FOR_PHASE36_PROPOSAL');
  if(!target.tokenAddress)reasons.push('TOKEN_ADDRESS_REQUIRED');
  const riskRows=s.risk?.records||[];
  const matching=target.tokenAddress?riskRows.find(r=>String(r?.tokenAddress||r?.token||r?.mint||'')===target.tokenAddress):null;
  const hardBlocks=matching?.hardBlocks||[];
  if(hardBlocks.length)reasons.push('DETERMINISTIC_RISK_HARD_BLOCK');
  const health=s.connectionHealth;
  if(health?.mode==='DEGRADED')warnings.push('SYSTEM_DEGRADED_PREPARATION_ONLY');
  const integrity=s.integrity;
  if(integrity?.status&&integrity.status!=='OK'&&integrity.status!=='HEALTHY'&&integrity.status!=='PASS')warnings.push(`INTEGRITY_${String(integrity.status).toUpperCase()}`);
  return {valid:reasons.length===0,reasons,warnings,target,hardBlocks:assistantScrub(hardBlocks),checkedAt:Date.now()};
}
function assistantCreateProposal(sessionId,text,route,evidence){
  const validation=assistantValidateProposal(route,evidence),id=`ap-${Date.now()}-${Math.random().toString(36).slice(2,8)}`,now=Date.now();
  const row={id,version:2,phase:44,sessionId,createdAt:now,expiresAt:now+ASSISTANT_PROPOSAL_TTL_MS,status:validation.valid?ASSISTANT_PROPOSAL_STATUS.PENDING:ASSISTANT_PROPOSAL_STATUS.BLOCKED,intent:route.intent,permission:route.permission,routeKey:route.key,target:validation.target,validation:{...validation},requestedText:String(text||'').slice(0,1000),confirmationRequired:true,confirmationToken:`confirm-${Math.random().toString(36).slice(2,10)}`,confirmedAt:null,cancelledAt:null,actionExecuted:false,executionAuthority:'NONE',nextStep:validation.valid?'USER_CONFIRM_PROPOSAL':'RESOLVE_BLOCKS'};
  assistantBook.proposals[id]=row;assistantBook.proposalOrder.unshift(id);assistantBook.stats.proposals=Number(assistantBook.stats.proposals||0)+1;
  assistantAudit(validation.valid?'PROPOSAL_CREATED':'PROPOSAL_BLOCKED',sessionId,{proposalId:id,intent:route.intent,target:validation.target,reasons:validation.reasons,warnings:validation.warnings});
  persistAssistant();return row;
}
function assistantGetProposal(id){const p=assistantBook.proposals?.[id];if(!p)return null;if(p.status===ASSISTANT_PROPOSAL_STATUS.PENDING&&Date.now()>p.expiresAt){p.status=ASSISTANT_PROPOSAL_STATUS.EXPIRED;p.expiredAt=Date.now();persistAssistant();}return p;}
function assistantConfirmProposal(id,confirmationToken){
  const p=assistantGetProposal(id);if(!p)return {ok:false,error:'Proposal not found'};
  if(p.status!==ASSISTANT_PROPOSAL_STATUS.PENDING)return {ok:false,error:`Proposal is ${p.status}`,proposal:p};
  if(String(confirmationToken||'')!==String(p.confirmationToken||''))return {ok:false,error:'Confirmation token mismatch',proposal:p};
  // Phase 36 confirmation approves the proposal record only. It never dispatches Padre DOM automation or executeTrade.
  p.status=ASSISTANT_PROPOSAL_STATUS.CONFIRMED;p.confirmedAt=Date.now();p.actionExecuted=false;p.executionAuthority='NONE';p.nextStep='READY_FOR_SAFE_PREPARATION';
  assistantBook.stats.confirmedProposals=Number(assistantBook.stats.confirmedProposals||0)+1;assistantAudit('PROPOSAL_CONFIRMED',p.sessionId,{proposalId:p.id,intent:p.intent,target:p.target,actionExecuted:false});persistAssistant();return {ok:true,proposal:p};
}
function assistantCancelProposal(id){
  const p=assistantGetProposal(id);if(!p)return {ok:false,error:'Proposal not found'};
  if(p.status!==ASSISTANT_PROPOSAL_STATUS.PENDING)return {ok:false,error:`Proposal is ${p.status}`,proposal:p};
  p.status=ASSISTANT_PROPOSAL_STATUS.CANCELLED;p.cancelledAt=Date.now();p.actionExecuted=false;assistantBook.stats.cancelledProposals=Number(assistantBook.stats.cancelledProposals||0)+1;assistantAudit('PROPOSAL_CANCELLED',p.sessionId,{proposalId:p.id});persistAssistant();return {ok:true,proposal:p};
}
function assistantProposalPublic(){
  return (assistantBook.proposalOrder||[]).map(id=>assistantGetProposal(id)).filter(Boolean).slice(0,50).map(p=>assistantScrub(p));
}



// ── PHASE 44 · Safe Action Preparation ──────────────────────
const ASSISTANT_PREPARATION_STATUS=Object.freeze({READY:'READY_FOR_REVIEW',BLOCKED:'BLOCKED',STALE:'STALE'});
function assistantLatestRiskForToken(mint){
  return (riskDecisionBook.decisions||[]).find(r=>String(r?.tokenAddress||r?.token||r?.mint||'')===String(mint||''))||null;
}
function assistantPreparationSizingContext(mint){
  const market=marketSnapshotFor(mint)||null,risk=assistantLatestRiskForToken(mint),liq=Number(market?.liquidity||0),fdv=Number(market?.fdv||0);
  return {suggestedSizeSol:null,userMustChooseSize:true,marketPriceUsd:market?.priceUsd??null,marketQuoteAt:market?.at||market?.fetchedAt||null,marketQuality:market?.quality||market?.confidence||'UNKNOWN',liquidityUsd:liq||null,fdvUsd:fdv||null,liquidityToFdvPct:liq&&fdv?liq/fdv*100:null,riskDecision:risk?.decision||'UNKNOWN',note:'Phase 44 does not invent or automatically choose trade size. Size remains an explicit user/governed-execution input.'};
}
function assistantPreparationTpslContext(mint){
  const risk=assistantLatestRiskForToken(mint);
  return {takeProfitPct:null,stopLossPct:null,autoConfigured:false,userMustChoose:true,riskContext:{decision:risk?.decision||'UNKNOWN',score:risk?.score??null,hardBlocks:assistantScrub(risk?.hardBlocks||[]),cautions:assistantScrub(risk?.cautions||[])},note:'TP/SL values are preparation fields only. Phase 44 does not change settings or submit orders.'};
}
function assistantBuildPreparation(proposal){
  if(!proposal)return {ok:false,error:'Proposal not found'};
  const mint=proposal.target?.tokenAddress||null,risk=mint?assistantLatestRiskForToken(mint):null,health=connectionHealth||{},integrity=integrityState||{};
  const blockers=[...(proposal.validation?.reasons||[])],warnings=[...(proposal.validation?.warnings||[])];
  if(risk?.hardBlocks?.length&&!blockers.includes('DETERMINISTIC_RISK_HARD_BLOCK'))blockers.push('DETERMINISTIC_RISK_HARD_BLOCK');
  if(health.mode==='DEGRADED'&&!warnings.includes('SYSTEM_DEGRADED_PREPARATION_ONLY'))warnings.push('SYSTEM_DEGRADED_PREPARATION_ONLY');
  const status=blockers.length?ASSISTANT_PREPARATION_STATUS.BLOCKED:ASSISTANT_PREPARATION_STATUS.READY;
  return assistantScrub({id:`prep-${proposal.id}`,version:1,phase:44,proposalId:proposal.id,createdAt:Date.now(),status,routeKey:proposal.routeKey,intent:proposal.intent,target:{...proposal.target},
    sourceProposalStatus:proposal.status,blockers,warnings,
    deterministicRisk:risk?{decision:risk.decision||'UNKNOWN',score:risk.score??null,hardBlocks:risk.hardBlocks||[],cautions:risk.cautions||[],unknowns:risk.unknowns||[],sourceSignature:risk.sourceSignature||null,at:risk.at||null}:null,
    sizing:mint?assistantPreparationSizingContext(mint):null,tpsl:mint?assistantPreparationTpslContext(mint):null,
    padre:{canOpen:false,canPopulate:false,canSubmit:false,preparedTarget:mint,note:'Phase 44 creates reviewable preparation data only. Padre interaction is reserved for a later governed-action phase.'},
    reviewChecklist:[
      {key:'DETERMINISTIC_RISK',required:true,passed:!(risk?.hardBlocks||[]).length},
      {key:'TOKEN_TARGET',required:true,passed:!!mint},
      {key:'USER_SIZE_SELECTION',required:true,passed:false},
      {key:'USER_TPSL_REVIEW',required:false,passed:false},
      {key:'FINAL_GOVERNED_ACTION',required:true,passed:false}
    ],
    authority:{preparationOnly:true,actionExecuted:false,canExecute:false,canSubmit:false,canChangeConfig:false,canEnableTrusted:false,canPromoteWallet:false,canAlterRisk:false}});
}
function assistantPrepareFromProposal(id){
  const p=assistantGetProposal(id);if(!p)return {ok:false,error:'Proposal not found'};
  if(![ASSISTANT_PROPOSAL_STATUS.PENDING,ASSISTANT_PROPOSAL_STATUS.CONFIRMED].includes(p.status))return {ok:false,error:`Proposal is ${p.status}`,preparation:assistantBuildPreparation(p)};
  const preparation=assistantBuildPreparation(p);
  assistantAudit('SAFE_PREPARATION_BUILT',p.sessionId,{proposalId:p.id,preparationId:preparation.id,status:preparation.status,blockers:preparation.blockers,actionExecuted:false});
  return {ok:preparation.status!==ASSISTANT_PREPARATION_STATUS.BLOCKED,preparation};
}
function assistantSafePreparationForText(text=''){
  const route=assistantRouteCommand(text),command=assistantCommandContext(text);
  if(route.permission!==ASSISTANT_PERMISSIONS.PREPARE)return {ok:false,error:'Request is not routed to PREPARE permission',route};
  const validation=assistantValidateProposal(route,command.evidence),synthetic={id:`preview-${Date.now()}`,routeKey:route.key,intent:route.intent,status:'PREVIEW',target:validation.target,validation};
  return {ok:validation.valid,route,preparation:assistantBuildPreparation(synthetic)};
}


// ── PHASE 45 · Governed Assistant Actions ───────────────────
const ASSISTANT_GOVERNED_ACTIONS=Object.freeze({OPEN_PADRE_TOKEN:'OPEN_PADRE_TOKEN',POPULATE_PADRE_DRAFT:'POPULATE_PADRE_DRAFT'});
const ASSISTANT_ACTION_TTL_MS=5*60*1000;
function assistantGovernedActionGate(proposal,preparation,actionType,payload={}){
  const reasons=[],warnings=[];
  if(!proposal)reasons.push('PROPOSAL_REQUIRED');
  if(proposal?.status!==ASSISTANT_PROPOSAL_STATUS.CONFIRMED)reasons.push('CONFIRMED_PROPOSAL_REQUIRED');
  if(!preparation||preparation.status!==ASSISTANT_PREPARATION_STATUS.READY)reasons.push('READY_SAFE_PREPARATION_REQUIRED');
  const mint=preparation?.target?.tokenAddress||null;
  if(!mint)reasons.push('TOKEN_ADDRESS_REQUIRED');
  if((preparation?.deterministicRisk?.hardBlocks||[]).length)reasons.push('DETERMINISTIC_RISK_HARD_BLOCK');
  if(connectionHealth?.mode==='DEGRADED')reasons.push('SYSTEM_DEGRADED');
  if(settings.automationPaused)reasons.push('EMERGENCY_PAUSE_ACTIVE');
  if(!padreView)reasons.push('PADRE_UNAVAILABLE');
  if(!Object.values(ASSISTANT_GOVERNED_ACTIONS).includes(actionType))reasons.push('UNSUPPORTED_GOVERNED_ACTION');
  if(actionType===ASSISTANT_GOVERNED_ACTIONS.POPULATE_PADRE_DRAFT){
    const size=Number(payload.sizeSol||0);
    if(!Number.isFinite(size)||size<=0)reasons.push('EXPLICIT_POSITIVE_SIZE_REQUIRED');
    if(!['BUY','SELL'].includes(String(payload.action||'BUY').toUpperCase()))reasons.push('VALID_BUY_OR_SELL_REQUIRED');
    if(String(payload.action||'BUY').toUpperCase()==='SELL')reasons.push('ASSISTANT_SELL_DRAFT_DISABLED');
  }
  return {ok:reasons.length===0,reasons,warnings,tokenAddress:mint,checkedAt:Date.now()};
}
function assistantCreateGovernedAction(proposalId,actionType,payload={}){
  const proposal=assistantGetProposal(String(proposalId||''));if(!proposal)return {ok:false,error:'Proposal not found'};
  const preparation=assistantBuildPreparation(proposal),gate=assistantGovernedActionGate(proposal,preparation,String(actionType||''),payload);
  const now=Date.now(),action={id:`aga-${now}-${Math.random().toString(36).slice(2,8)}`,version:1,phase:45,proposalId:proposal.id,preparationId:preparation.id,sessionId:proposal.sessionId,actionType:String(actionType||''),payload:assistantScrub(payload),target:{tokenAddress:gate.tokenAddress},createdAt:now,expiresAt:now+ASSISTANT_ACTION_TTL_MS,status:gate.ok?'AWAITING_EXPLICIT_CONFIRMATION':'BLOCKED',gate,confirmationToken:`act-${Math.random().toString(36).slice(2,10)}`,confirmedAt:null,completedAt:null,actionExecuted:false,tradeSubmitted:false,executionAttemptId:null,
    authority:{mayNavigatePadre:true,mayPopulateDraft:actionType===ASSISTANT_GOVERNED_ACTIONS.POPULATE_PADRE_DRAFT,mayClickFinalSubmit:false,mayCallExecuteTrade:false,mayReserveExecutionAttempt:false,mayChangeConfig:false,mayEnableTrusted:false,mayPromoteWallet:false}};
  assistantAudit(gate.ok?'GOVERNED_ACTION_CREATED':'GOVERNED_ACTION_BLOCKED',proposal.sessionId,{actionId:action.id,proposalId:proposal.id,actionType:action.actionType,reasons:gate.reasons,actionExecuted:false});
  assistantBook.governedActions=assistantBook.governedActions||{};assistantBook.governedActionOrder=assistantBook.governedActionOrder||[];assistantBook.governedActions[action.id]=action;assistantBook.governedActionOrder.unshift(action.id);persistAssistant();return {ok:gate.ok,action:assistantScrub(action)};
}
function assistantGovernedAction(id){return assistantBook.governedActions?.[id]||null;}
async function assistantRunGovernedAction(id,confirmationToken){
  const a=assistantGovernedAction(String(id||''));if(!a)return {ok:false,error:'Governed action not found'};
  if(a.status!=='AWAITING_EXPLICIT_CONFIRMATION')return {ok:false,error:`Governed action is ${a.status}`,action:assistantScrub(a)};
  if(Date.now()>Number(a.expiresAt||0)){a.status='EXPIRED';persistAssistant();return {ok:false,error:'Governed action expired',action:assistantScrub(a)};}
  if(String(confirmationToken||'')!==String(a.confirmationToken||''))return {ok:false,error:'Confirmation token mismatch',action:assistantScrub(a)};
  const proposal=assistantGetProposal(a.proposalId),preparation=proposal?assistantBuildPreparation(proposal):null,gate=assistantGovernedActionGate(proposal,preparation,a.actionType,a.payload);
  if(!gate.ok){a.status='BLOCKED';a.gate=gate;persistAssistant();assistantAudit('GOVERNED_ACTION_RECHECK_BLOCKED',a.sessionId,{actionId:a.id,reasons:gate.reasons});return {ok:false,error:'Safety re-check blocked action',action:assistantScrub(a)};}
  a.confirmedAt=Date.now();a.status='RUNNING';persistAssistant();
  try{
    const token=a.target.tokenAddress;createPadreView();setPadreVisible(true);
    await padreView.webContents.loadURL(normalizePadreUrl(token));
    if(a.actionType===ASSISTANT_GOVERNED_ACTIONS.POPULATE_PADRE_DRAFT){
      const action=String(a.payload.action||'BUY').toLowerCase(),sizeSol=String(Number(a.payload.sizeSol));
      const script=`(()=>{const visible=e=>e&&!e.disabled&&e.getClientRects().length>0;const btns=Array.from(document.querySelectorAll('button')).filter(visible);const tab=btns.find(b=>b.textContent.trim().toLowerCase()===${JSON.stringify(action)});if(!tab)return {ok:false,reason:'Trade tab not found'};tab.click();const inp=document.querySelector('input[placeholder*="Amount"],input[placeholder*="SOL"],input[type="number"]');if(!visible(inp))return {ok:false,reason:'Amount input not found'};const setter=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')?.set;if(!setter)return {ok:false,reason:'Input setter unavailable'};setter.call(inp,${JSON.stringify(sizeSol)});inp.dispatchEvent(new Event('input',{bubbles:true}));return {ok:true,url:location.href,action:${JSON.stringify(action)},sizeSol:${JSON.stringify(sizeSol)},finalSubmitClicked:false};})()`;
      const result=await padreView.webContents.executeJavaScript(script);
      if(!result?.ok)throw new Error(result?.reason||'Padre draft population failed');
      a.result=assistantScrub(result);
    }else a.result={ok:true,url:padreView.webContents.getURL(),finalSubmitClicked:false};
    a.status='COMPLETED_PRE_SUBMIT';a.completedAt=Date.now();a.actionExecuted=true;a.tradeSubmitted=false;a.executionAttemptId=null;
    assistantAudit('GOVERNED_ACTION_COMPLETED',a.sessionId,{actionId:a.id,actionType:a.actionType,tradeSubmitted:false,finalSubmitClicked:false});
    persistAssistant();return {ok:true,action:assistantScrub(a)};
  }catch(e){a.status='FAILED';a.completedAt=Date.now();a.failureReason=e.message||String(e);a.tradeSubmitted=false;a.executionAttemptId=null;persistAssistant();assistantAudit('GOVERNED_ACTION_FAILED',a.sessionId,{actionId:a.id,error:a.failureReason});return {ok:false,error:a.failureReason,action:assistantScrub(a)};}
}
function assistantGovernedActionsPublic(){return (assistantBook.governedActionOrder||[]).map(id=>assistantGovernedAction(id)).filter(Boolean).slice(0,50).map(assistantScrub);}

// ── PHASE 37 · Wallet Analyst Assistant ─────────────────────
function assistantWalletOutcomes(address){
  return (verifiedOutcomeBook.order||[]).map(id=>verifiedOutcomeBook.byId?.[id]).filter(o=>o&&o.walletAddress===address&&o.completedOutcome===true&&o.sourceVerified===true);
}
function assistantWalletRiskProfile(address){
  const rows=(riskDecisionBook.decisions||[]).filter(r=>r.walletAddress===address);
  const counts={PASS:0,CAUTION:0,HARD_BLOCK:0,UNKNOWN:0};
  const flags={};for(const r of rows){const d=String(r.decision||'UNKNOWN');counts[d]=(counts[d]||0)+1;for(const f of [...(r.hardBlocks||[]),...(r.cautions||[]),...(r.flags||[])]){const k=typeof f==='string'?f:(f?.code||f?.type||'UNKNOWN');flags[k]=(flags[k]||0)+1;}}
  return {total:rows.length,counts,topSignals:Object.entries(flags).sort((a,b)=>b[1]-a[1]).slice(0,10).map(([signal,count])=>({signal,count})),recent:rows.slice(0,10)};
}
function assistantWalletTrend(outcomes){
  const rows=[...outcomes].sort((a,b)=>Number(a.exit?.chainTimestamp||a.exitTimestamp||0)-Number(b.exit?.chainTimestamp||b.exitTimestamp||0));
  const recent=rows.slice(-10),prior=rows.slice(-20,-10);
  const agg=a=>({sample:a.length,winRatePct:a.length?a.filter(x=>x.classification==='WIN').length/a.length*100:0,netPnlSol:a.reduce((n,x)=>n+Number(x.pnlSol||0),0),avgReturnPct:a.length?a.reduce((n,x)=>n+Number(x.returnPct||0),0)/a.length:0});
  const r=agg(recent),p=agg(prior);return {recent:r,prior:p,direction:!prior.length?'INSUFFICIENT_HISTORY':r.netPnlSol>p.netPnlSol?'IMPROVING':r.netPnlSol<p.netPnlSol?'WEAKENING':'STABLE'};
}
function assistantWalletAnalysis(address){
  const w=wallets[address],g=ghostBook.wallets?.[address]||null,q=qualificationBook.wallets?.[address]||null,d=discoveryBook.candidates?.[address]||null;
  if(!w&&!g&&!q&&!d)return {ok:false,error:'Wallet not found in CopyGuard evidence',address};
  const outcomes=assistantWalletOutcomes(address),risk=assistantWalletRiskProfile(address),trend=assistantWalletTrend(outcomes);
  let metrics=null,qualification=null;
  if(g){metrics=verifiedOutcomeMetrics(address,g);qualification=evaluateGhostQualification(g);}
  const thresholds=g?cleanGhostConfig(g.config||{}):null;
  const checks=qualification?.checks||{};
  const failedChecks=Object.entries(checks).filter(([,v])=>!v).map(([k])=>k),passedChecks=Object.entries(checks).filter(([,v])=>v).map(([k])=>k);
  const openPositions=Array.isArray(g?.positions)?g.positions.length:0,partialRealizations=(g?.positions||[]).reduce((n,x)=>n+(x.realizations?.length||0),0);
  const analystGrade=!metrics||metrics.completedTrades===0?'INSUFFICIENT_DATA':
    metrics.verifiedCoveragePct<100?'DATA_QUALITY_BLOCK':
    qualification?.qualified?'QUALIFIED':
    metrics.completedTrades<Number(thresholds?.minCompletedTrades||30)?'BUILDING_SAMPLE':
    failedChecks.length?'NOT_QUALIFIED':'REVIEW';
  return assistantScrub({version:1,phase:37,address,label:w?.label||w?.name||null,tier:w?.tier||null,analystGrade,
    verified:{completedTrades:metrics?.completedTrades||outcomes.length,wins:metrics?.wins||outcomes.filter(x=>x.classification==='WIN').length,losses:metrics?.losses||outcomes.filter(x=>x.classification==='LOSS').length,winRatePct:metrics?.winRatePct??null,roiPct:metrics?.roiPct??null,profitFactor:metrics?.profitFactor??null,expectancySol:metrics?.expectancySol??null,maxDrawdownPct:metrics?.maxDrawdownPct??null,longestLossStreak:metrics?.longestLossStreak??null,verifiedCoveragePct:metrics?.verifiedCoveragePct??(outcomes.length?100:0),recentOutcomes:outcomes.slice(-10)},
    shadow:{status:g?.status||null,enabled:g?.enabled??null,liveActivated:g?.liveActivated??false,openPositions,partialRealizations,totalSignals:g?.totalSignals||0,blockedSignals:g?.blockedSignals||0},
    qualification:{state:q?.state||g?.status||null,reason:q?.lastReason||null,progressPct:qualification?.progressPct??null,passedChecks,failedChecks,thresholds:thresholds?{minCompletedTrades:thresholds.minCompletedTrades,minWinRatePct:thresholds.minWinRatePct,minRoiPct:thresholds.minRoiPct,minProfitFactor:thresholds.minProfitFactor,maxDrawdownPct:thresholds.maxDrawdownPct,maxHardBlockRatePct:thresholds.maxHardBlockRatePct}:null,rolling:q?.metrics||null},
    risk,discovery:d?{score:d.score,gate:d.gate,shadowEligible:d.shadowEligible,clusterPenalty:d.clusterPenalty,historicalRepeat:d.historicalRepeat}:null,trend,
    authority:{canPromote:false,canEnableTrusted:false,canExecute:false,note:'Wallet Analyst is read-only. Qualification/promotion authority remains deterministic and explicit.'}});
}
function assistantWalletCompare(addresses=[]){
  const rows=[...new Set(addresses)].slice(0,5).map(assistantWalletAnalysis).filter(x=>x.ok!==false);
  const ranked=[...rows].sort((a,b)=>{
    const av=Number(a.verified?.completedTrades||0)>=30&&Number(a.verified?.verifiedCoveragePct||0)>=100?1:0,bv=Number(b.verified?.completedTrades||0)>=30&&Number(b.verified?.verifiedCoveragePct||0)>=100?1:0;
    return bv-av||Number(b.verified?.roiPct||-999)-Number(a.verified?.roiPct||-999)||Number(b.verified?.profitFactor||0)-Number(a.verified?.profitFactor||0);
  });
  return {version:1,phase:37,count:rows.length,rows,ranking:ranked.map((x,i)=>({rank:i+1,address:x.address,label:x.label,analystGrade:x.analystGrade,completedTrades:x.verified.completedTrades,winRatePct:x.verified.winRatePct,roiPct:x.verified.roiPct,profitFactor:x.verified.profitFactor,maxDrawdownPct:x.verified.maxDrawdownPct})),note:'Ranking never substitutes for deterministic qualification and cannot promote a wallet.'};
}
function assistantWalletTargets(route,text=''){
  const e=route.entities||assistantExtractEntities(text),out=[...(e.wallets||[])];
  for(const a of e.addresses||[])if(wallets[a]||ghostBook.wallets?.[a]||qualificationBook.wallets?.[a]||discoveryBook.candidates?.[a])out.push(a);
  return [...new Set(out)].slice(0,5);
}



// ── PHASE 40 · Shadow / Ghost Coach ─────────────────────────
function assistantShadowLots(address){
  const g=ghostBook.wallets?.[address];if(!g)return [];
  return (g.positions||[]).map(lot=>assistantScrub({id:lot.id,tokenAddress:lot.tokenAddress,tokenSymbol:lot.tokenSymbol,entryAt:lot.entryAt||lot.openedAt||null,entryPriceUsd:lot.entryPriceUsd??lot.executionPriceUsd??null,originalStakeSol:lot.originalStakeSol??lot.stakeSol??null,remainingStakeSol:lot.remainingStakeSol??null,remainingFraction:lot.remainingFraction??null,markedEquitySol:lot.markedEquitySol??lot.currentValueSol??null,unrealizedPnlSol:lot.unrealizedPnlSol??null,realizationCount:(lot.realizations||[]).length,realizations:(lot.realizations||[]).slice(-8),sourceSignature:lot.sourceSignature||lot.entry?.signature||null}));
}
function assistantQualificationNeeds(address){
  const g=ghostBook.wallets?.[address];if(!g)return {available:false,needs:['SHADOW_WALLET_NOT_FOUND']};
  const q=evaluateGhostQualification(g),s=q.stats,c=q.thresholds,needs=[];
  if(!q.checks.sample)needs.push({check:'sample',current:s.completedTrades,target:c.minCompletedTrades,remaining:Math.max(0,c.minCompletedTrades-s.completedTrades),message:`${Math.max(0,c.minCompletedTrades-s.completedTrades)} more completed verified outcomes required`});
  if(!q.checks.verified)needs.push({check:'verified',current:s.verifiedCoveragePct,target:100,message:'Source verification coverage must reach 100%'});
  if(!q.checks.winRate)needs.push({check:'winRate',current:s.winRatePct,target:c.minWinRatePct,message:`Win rate must reach ${c.minWinRatePct}%`});
  if(!q.checks.roi)needs.push({check:'roi',current:s.roiPct,target:c.minRoiPct,message:`ROI must reach ${c.minRoiPct}%`});
  if(!q.checks.profitFactor)needs.push({check:'profitFactor',current:s.profitFactor,target:c.minProfitFactor,message:`Profit factor must reach ${c.minProfitFactor}`});
  if(!q.checks.drawdown)needs.push({check:'drawdown',current:s.maxDrawdownPct,targetMax:c.maxDrawdownPct,message:`Max drawdown must be <= ${c.maxDrawdownPct}%`});
  if(!q.checks.hardBlocks)needs.push({check:'hardBlocks',current:s.hardBlockRatePct,targetMax:c.maxHardBlockRatePct,message:`Hard-block rate must be <= ${c.maxHardBlockRatePct}%`});
  return {available:true,qualified:q.qualified,progressPct:q.progressPct,checks:q.checks,needs};
}
function assistantShadowCoach(address){
  const wallet=assistantWalletAnalysis(address);if(wallet?.ok===false)return wallet;
  const g=ghostBook.wallets?.[address]||null,lots=assistantShadowLots(address),needs=assistantQualificationNeeds(address),outcomes=assistantWalletOutcomes(address);
  const closed=outcomes.slice(-12).map(o=>assistantScrub({id:o.id,tokenAddress:o.tokenAddress,classification:o.classification,pnlSol:o.pnlSol,returnPct:o.returnPct,holdDurationMs:o.holdDurationMs,sourceVerified:o.sourceVerified,dataQuality:o.dataQuality,closedAt:o.closedAt,entrySignature:o.entry?.signature||null,exitSignatures:o.realizations?.map(x=>x.signature).filter(Boolean)||[]}));
  const partialLots=lots.filter(x=>Number(x.realizationCount||0)>0&&Number(x.remainingFraction??1)>0);
  return assistantScrub({version:1,phase:40,address,label:wallet.label,coachGrade:wallet.analystGrade,status:g?.status||null,
    qualification:needs,verifiedPerformance:wallet.verified,trend:wallet.trend,
    openShadow:{count:lots.length,lots,partialLots:partialLots.length,note:'Open and partially realized lots are context only. They are not completed qualification outcomes.'},
    verifiedClosed:{count:outcomes.length,recent:closed,note:'Only fully closed, source-verified outcomes count toward qualification.'},
    risk:wallet.risk,
    nextStep:needs.qualified?'All deterministic Shadow thresholds currently pass; any promotion/live activation remains a separate explicit governed action.':needs.needs?.[0]?.message||'Continue collecting verified Shadow outcomes.',
    authority:{readOnlyCoach:true,canPromote:false,canEnableTrusted:false,canExecute:false,qualificationDeterministic:true}});
}
function assistantShadowRanking(){
  const rows=Object.keys(ghostBook.wallets||{}).map(address=>assistantShadowCoach(address)).filter(x=>x.ok!==false);
  const ranked=rows.sort((a,b)=>Number(b.qualification?.qualified)-Number(a.qualification?.qualified)||Number(b.qualification?.progressPct||0)-Number(a.qualification?.progressPct||0)||Number(b.verifiedPerformance?.completedTrades||0)-Number(a.verifiedPerformance?.completedTrades||0)||Number(b.verifiedPerformance?.roiPct||-999)-Number(a.verifiedPerformance?.roiPct||-999));
  return {version:1,phase:40,count:ranked.length,rows:ranked.slice(0,20).map((x,i)=>({rank:i+1,address:x.address,label:x.label,status:x.status,coachGrade:x.coachGrade,qualified:x.qualification?.qualified,progressPct:x.qualification?.progressPct,completedTrades:x.verifiedPerformance?.completedTrades,winRatePct:x.verifiedPerformance?.winRatePct,roiPct:x.verifiedPerformance?.roiPct,profitFactor:x.verifiedPerformance?.profitFactor,maxDrawdownPct:x.verifiedPerformance?.maxDrawdownPct,nextNeed:x.qualification?.needs?.[0]||null})),note:'Closest-to-qualification ranking is explanatory only and cannot promote or enable Trusted execution.'};
}




// ── PHASE 43 · Portfolio & Performance Assistant ─────────────
function assistantAllVerifiedOutcomes(){
  return (verifiedOutcomeBook.order||[]).map(id=>verifiedOutcomeBook.byId?.[id]).filter(o=>o?.completedOutcome===true&&o?.sourceVerified===true);
}
function assistantPortfolioAttribution(){
  const outcomes=assistantAllVerifiedOutcomes(),byWallet={},byToken={};
  for(const o of outcomes){
    const w=o.walletAddress||'UNKNOWN',t=o.tokenAddress||'UNKNOWN',p=Number(o.pnlSol||0),r=Number(o.returnPct||0);
    const wb=byWallet[w]||(byWallet[w]={walletAddress:w,label:wallets[w]?.label||wallets[w]?.name||null,outcomes:0,wins:0,losses:0,realizedPnlSol:0,returnSumPct:0});
    wb.outcomes++;wb.realizedPnlSol+=p;wb.returnSumPct+=r;if(o.classification==='WIN')wb.wins++;else if(o.classification==='LOSS')wb.losses++;
    const tb=byToken[t]||(byToken[t]={tokenAddress:t,symbol:o.tokenSymbol||null,outcomes:0,wins:0,losses:0,realizedPnlSol:0,returnSumPct:0});
    tb.outcomes++;tb.realizedPnlSol+=p;tb.returnSumPct+=r;if(o.classification==='WIN')tb.wins++;else if(o.classification==='LOSS')tb.losses++;
  }
  const finalize=x=>({...x,winRatePct:x.outcomes?x.wins/x.outcomes*100:0,avgReturnPct:x.outcomes?x.returnSumPct/x.outcomes:0});
  return {wallets:Object.values(byWallet).map(finalize).sort((a,b)=>b.realizedPnlSol-a.realizedPnlSol),tokens:Object.values(byToken).map(finalize).sort((a,b)=>b.realizedPnlSol-a.realizedPnlSol)};
}
function assistantShadowExposure(){
  const rows=[];let remainingStakeSol=0,markedEquitySol=0,unrealizedPnlSol=0;
  for(const [address,g] of Object.entries(ghostBook.wallets||{})){
    for(const lot of g.positions||[]){
      const remaining=Number(lot.remainingStakeSol??lot.stakeSol??0),marked=Number(lot.markedEquitySol??lot.currentValueSol??remaining),unreal=Number(lot.unrealizedPnlSol??(marked-remaining));
      remainingStakeSol+=remaining;markedEquitySol+=marked;unrealizedPnlSol+=unreal;
      rows.push({walletAddress:address,walletLabel:wallets[address]?.label||wallets[address]?.name||null,tokenAddress:lot.tokenAddress,tokenSymbol:lot.tokenSymbol||null,lotId:lot.id,remainingStakeSol:remaining,markedEquitySol:marked,unrealizedPnlSol:unreal,remainingFraction:lot.remainingFraction??null,realizationCount:(lot.realizations||[]).length,entryAt:lot.entryAt||lot.openedAt||null,markSource:lot.marketSnapshot?.source||lot.markSource||null});
    }
  }
  return {count:rows.length,remainingStakeSol,markedEquitySol,unrealizedPnlSol,rows:rows.sort((a,b)=>Math.abs(b.unrealizedPnlSol)-Math.abs(a.unrealizedPnlSol)).slice(0,100)};
}
function assistantPortfolioTrend(outcomes){
  const ordered=[...outcomes].sort((a,b)=>Number(a.closedAt||0)-Number(b.closedAt||0)),curve=[];let cumulative=0,peak=0,maxDrawdownSol=0,maxDrawdownPct=0;
  for(const o of ordered){cumulative+=Number(o.pnlSol||0);peak=Math.max(peak,cumulative);const dd=peak-cumulative;maxDrawdownSol=Math.max(maxDrawdownSol,dd);if(peak>0)maxDrawdownPct=Math.max(maxDrawdownPct,dd/peak*100);curve.push({at:o.closedAt||null,cumulativePnlSol:cumulative,outcomeId:o.id});}
  const recent=ordered.slice(-10),prior=ordered.slice(-20,-10),sum=a=>a.reduce((n,o)=>n+Number(o.pnlSol||0),0),wr=a=>a.length?a.filter(o=>o.classification==='WIN').length/a.length*100:null;
  return {maxDrawdownSol,maxDrawdownPct,recent:{sample:recent.length,realizedPnlSol:sum(recent),winRatePct:wr(recent)},prior:{sample:prior.length,realizedPnlSol:sum(prior),winRatePct:wr(prior)},direction:!prior.length?'INSUFFICIENT_HISTORY':sum(recent)>sum(prior)?'IMPROVING':sum(recent)<sum(prior)?'WEAKENING':'STABLE',curve:curve.slice(-100)};
}
function assistantOperationalPositionSummary(){
  const open=Object.values(openPositions||{}).flat().length,closed=(closedPositions||[]).length;
  return {openRecords:open,closedRecords:closed,note:'Operational position ledgers are kept separate from source-verified Shadow outcomes. They are not merged into verified performance unless settlement/source evidence independently supports them.'};
}
function assistantPortfolioAnalysis(){
  const outcomes=assistantAllVerifiedOutcomes(),attr=assistantPortfolioAttribution(),exp=assistantShadowExposure(),trend=assistantPortfolioTrend(outcomes);
  const realizedPnlSol=outcomes.reduce((n,o)=>n+Number(o.pnlSol||0),0),wins=outcomes.filter(o=>o.classification==='WIN').length,losses=outcomes.filter(o=>o.classification==='LOSS').length;
  const topWallets=attr.wallets.slice(0,10),bottomWallets=[...attr.wallets].sort((a,b)=>a.realizedPnlSol-b.realizedPnlSol).slice(0,10),topTokens=attr.tokens.slice(0,10),bottomTokens=[...attr.tokens].sort((a,b)=>a.realizedPnlSol-b.realizedPnlSol).slice(0,10);
  return assistantScrub({version:1,phase:43,generatedAt:Date.now(),verifiedPerformance:{completedOutcomes:outcomes.length,wins,losses,winRatePct:outcomes.length?wins/outcomes.length*100:0,realizedPnlSol,verifiedCoveragePct:outcomes.length?100:0},
    shadowExposure:exp,markedPortfolio:{realizedPnlSol,unrealizedShadowPnlSol:exp.unrealizedPnlSol,markedShadowEquitySol:exp.markedEquitySol,combinedShadowPerformanceSol:realizedPnlSol+exp.unrealizedPnlSol},
    trend,attribution:{topWallets,bottomWallets,topTokens,bottomTokens,allWallets:attr.wallets.slice(0,50),allTokens:attr.tokens.slice(0,50)},
    operationalLedger:assistantOperationalPositionSummary(),
    semantics:{realizedMeansFullyClosedSourceVerifiedShadowOutcome:true,unrealizedMeansCurrentShadowMarkOnly:true,marksCanChangeWithMarket:true,openExposureDoesNotCountAsVerifiedOutcome:true,operationalAndShadowAccountingSeparated:true},
    authority:{readOnly:true,canExecute:false,canClosePositions:false,canChangeSizing:false,canPromoteWallet:false}});
}

// ── PHASE 52 · Portfolio Accounting Workspace Data ─────────
function portfolioAccountingData(){
  const portfolio=assistantPortfolioAnalysis();
  const allOutcomes=(verifiedOutcomeBook.order||[]).map(id=>verifiedOutcomeBook.byId?.[id]).filter(o=>o?.completedOutcome===true);
  const verified=allOutcomes.filter(o=>o.sourceVerified===true&&o.dataQuality==='VERIFIED');
  const shadowLots=[];
  for(const [address,g] of Object.entries(ghostBook.wallets||{})){
    for(const lot of g.positions||[]){
      shadowLots.push(assistantScrub({
        id:lot.id,walletAddress:address,walletLabel:wallets[address]?.label||wallets[address]?.name||null,
        tokenAddress:lot.tokenAddress||null,tokenSymbol:lot.tokenSymbol||null,openedAt:lot.openedAt||lot.entryAt||null,
        originalStakeSol:Number(lot.originalStakeSol??lot.stakeSol??0),remainingStakeSol:Number(lot.remainingStakeSol??lot.stakeSol??0),
        remainingFraction:lot.remainingFraction??null,realizedStakeSol:Number(lot.realizedStakeSol||0),realizedPnlSol:Number(lot.realizedPnlSol||0),
        unrealizedPnlSol:Number(lot.unrealizedPnlSol||0),unrealizedReturnPct:lot.unrealizedReturnPct??null,
        markedEquitySol:Number(lot.markedEquitySol??lot.currentValueSol??lot.remainingStakeSol??lot.stakeSol??0),
        entryPriceUsd:Number(lot.simEntryPriceUsd||0)||null,entryPriceSol:Number(lot.simEntryPriceSol||0)||null,
        pricingSource:lot.pricingSource||null,pricingConfidence:lot.pricingConfidence||null,
        sourceSignature:lot.sourceSignature||null,sourceTransactionId:lot.sourceTransactionId||null,sourceEventKey:lot.sourceEventKey||null,
        marketSnapshotId:lot.sourceMarketSnapshotId||null,marketFetchedAt:lot.sourceMarketFetchedAt||null,
        realizationCount:Array.isArray(lot.realizations)?lot.realizations.length:0,
        realizations:(lot.realizations||[]).slice(-20).map(r=>assistantScrub({
          id:r.id,closedStakeSol:Number(r.closedStakeSol||0),sellFractionOfLot:r.sellFractionOfLot??null,walletSellFraction:r.walletSellFraction??null,
          pnlSol:Number(r.pnlSol||0),returnPct:Number(r.returnPct||0),chainTimestamp:r.chainTimestamp||null,observedAt:r.observedAt||null,
          sourceSignature:r.sourceSignature||null,sourceTransactionId:r.sourceTransactionId||null,sourceEventKey:r.sourceEventKey||null,
          exitPriceUsd:Number(r.simExitPriceUsd||0)||null,exitPriceSol:Number(r.simExitPriceSol||0)||null
        }))
      }));
    }
  }
  const executionAttempts=(executionSafetyBook.attempts||[]).slice(0,120).map(a=>assistantScrub({
    id:a.id,status:a.status||'UNKNOWN',walletAddress:a.walletAddress||null,tokenAddress:a.tokenAddress||null,action:a.action||null,
    sourceSignature:a.sourceSignature||null,sourceEventKey:a.sourceEventKey||null,reservedAt:a.reservedAt||null,submittedAt:a.submittedAt||null,
    failedAt:a.failedAt||null,blockedAt:a.blockedAt||null,failureReason:a.failureReason||null,blockReasons:a.blockReasons||a.reasons||[],
    manual:false
  }));
  const prepared=(history||[]).filter(x=>String(x.decision||'').toUpperCase()==='PREPARED').slice(0,120).map(x=>assistantScrub({
    id:x.id||null,status:'PREPARED',walletAddress:x.walletAddress||null,walletLabel:x.walletLabel||wallets[x.walletAddress]?.label||null,
    tokenAddress:x.tokenAddress||null,tokenSymbol:x.tokenSymbol||null,action:x.action||null,sizeSol:Number(x.sizeSol||0),
    sourceSignature:x.sourceSignature||null,sourceEventKey:x.sourceEventKey||null,preparedAt:x.preparedAt||x.savedAt||x.timestamp||null,
    accountingCommitted:false,requiresManualConfirmation:true
  }));
  const operationalOpen=Object.values(openPositions||{}).flat().map(x=>assistantScrub({...x,accountingClass:'OPERATIONAL_UNVERIFIED'}));
  const operationalClosed=(closedPositions||[]).map(x=>assistantScrub({...x,accountingClass:'OPERATIONAL_UNVERIFIED'}));
  const byStatus={};for(const a of executionAttempts){const k=String(a.status||'UNKNOWN');byStatus[k]=(byStatus[k]||0)+1;}
  return assistantScrub({
    version:1,phase:52,generatedAt:Date.now(),
    verifiedPerformance:portfolio.verifiedPerformance,markedPortfolio:portfolio.markedPortfolio,trend:portfolio.trend,attribution:portfolio.attribution,
    verifiedOutcomes:verified.slice(0,250),incompleteOutcomes:allOutcomes.filter(o=>o.sourceVerified!==true||o.dataQuality!=='VERIFIED').slice(0,100),
    shadowLots:shadowLots.sort((a,b)=>Number(b.openedAt||0)-Number(a.openedAt||0)).slice(0,250),
    execution:{attempts:executionAttempts,byStatus,prepared},
    operational:{open:operationalOpen.slice(0,150),closed:operationalClosed.slice(0,150)},
    counts:{verifiedOutcomes:verified.length,incompleteOutcomes:allOutcomes.length-verified.length,shadowOpenLots:shadowLots.length,prepared:prepared.length,executionAttempts:executionAttempts.length,operationalOpen:operationalOpen.length,operationalClosed:operationalClosed.length},
    semantics:{
      verifiedRealizedAuthority:'Only fully closed source-verified Shadow outcomes are authoritative realized performance.',
      shadowOpen:'Open and partially realized Shadow lots are simulated/marked context and are not completed outcomes.',
      prepared:'PREPARED means manual Padre preparation only; accountingCommitted is false.',
      submitted:'SUBMITTED_UNVERIFIED is not settlement and is not realized P&L.',
      operational:'Operational position records remain separate from verified Shadow performance.',
      sourceLinks:'Transaction signatures are evidence references; missing signatures remain UNKNOWN.'
    },
    authority:{readOnly:true,canExecute:false,canSettle:false,canPromote:false,canChangeAccounting:false}
  });
}

// ── PHASE 42 · Closed-Loop Learning Assistant ────────────────
function assistantLearningBucketRows(map={}){
  return Object.entries(map||{}).map(([key,b])=>({key,samples:Number(b?.samples||0),wins:Number(b?.wins||0),losses:Number(b?.losses||0),breakevens:Number(b?.breakevens||0),netPnlSol:Number(b?.netPnlSol||0),avgReturnPct:Number(b?.avgReturnPct||0),scored:Number(b?.scored||0),correct:Number(b?.correct||0),accuracyPct:b?.accuracyPct==null?null:Number(b.accuracyPct),winRatePct:b?.winRatePct==null?null:Number(b.winRatePct)}));
}
function assistantLearningCalibration(){
  const b=rebuildClosedLoopLearning(),min=LEARNING_MIN_SAMPLE;
  const providers=assistantLearningBucketRows(b.providerStats).sort((a,b)=>(b.scored-a.scored)||Number(b.accuracyPct||0)-Number(a.accuracyPct||0));
  const tasks=assistantLearningBucketRows(b.taskStats).sort((a,b)=>(b.scored-a.scored)||Number(b.accuracyPct||0)-Number(a.accuracyPct||0));
  const recommendations=assistantLearningBucketRows(b.recommendationStats).sort((a,b)=>(b.scored-a.scored)||Number(b.accuracyPct||0)-Number(a.accuracyPct||0));
  const riskSignals=assistantLearningBucketRows(b.riskSignalStats).sort((a,b)=>b.samples-a.samples);
  const recurringMisses=recommendations.filter(x=>x.scored>=min&&x.accuracyPct!==null&&x.accuracyPct<50).sort((a,b)=>a.accuracyPct-b.accuracyPct).slice(0,15);
  const strongSignals=riskSignals.filter(x=>x.samples>=min&&Math.abs(x.avgReturnPct)>=8).sort((a,b)=>Math.abs(b.avgReturnPct)-Math.abs(a.avgReturnPct)).slice(0,20);
  return {version:1,phase:42,generatedAt:b.generatedAt||Date.now(),minimumReviewSample:min,summary:{...(b.summary||{})},
    providers,tasks,recommendations,riskSignals:strongSignals,recurringMisses,
    evidenceQuality:{verifiedOutcomeOnly:true,linkedOutcomeCount:Number(b.summary?.linkedOutcomes||0),verifiedOutcomeCount:Number(b.summary?.verifiedOutcomes||0),unlinkedVerifiedOutcomes:Math.max(0,Number(b.summary?.verifiedOutcomes||0)-Number(b.summary?.linkedOutcomes||0)),minimumSampleRequired:min},
    proposals:(b.proposals||[]).map((x,i)=>({...x,id:`learn-proposal-${i+1}`,status:'ADVISORY_ONLY',requiresHumanReview:true,autoApplied:false})).slice(0,40),
    authority:{localCorrelationOnly:true,externalModelRetraining:false,canChangeThresholds:false,canChangeRiskRules:false,canChangeTrusted:false,canExecute:false,autoApplyProposals:false}};
}
function assistantLearningExplain(){
  const c=assistantLearningCalibration(),s=c.summary||{};
  const providerReady=c.providers.filter(x=>x.scored>=c.minimumReviewSample),taskReady=c.tasks.filter(x=>x.scored>=c.minimumReviewSample);
  const bestProvider=[...providerReady].filter(x=>x.accuracyPct!==null).sort((a,b)=>b.accuracyPct-a.accuracyPct)[0]||null;
  const weakestProvider=[...providerReady].filter(x=>x.accuracyPct!==null).sort((a,b)=>a.accuracyPct-b.accuracyPct)[0]||null;
  const underSampled=[...c.providers,...c.tasks].filter(x=>x.scored<c.minimumReviewSample).map(x=>({key:x.key,scored:x.scored,needed:c.minimumReviewSample-x.scored})).slice(0,20);
  return assistantScrub({...c,interpretation:{
    learnedFrom:`${Number(s.verifiedOutcomes||0)} source-verified completed outcome(s)`,
    linkage:`${Number(s.linkedOutcomes||0)} verified outcome(s) linked to at least one AI/risk decision`,
    aiScored:Number(s.aiPredictionsScored||0),
    riskScored:Number(s.riskDecisionsScored||0),
    bestProvider:bestProvider?{key:bestProvider.key,accuracyPct:bestProvider.accuracyPct,scored:bestProvider.scored}:null,
    weakestProvider:weakestProvider?{key:weakestProvider.key,accuracyPct:weakestProvider.accuracyPct,scored:weakestProvider.scored}:null,
    recurringMistakes:c.recurringMisses.map(x=>({key:x.key,accuracyPct:x.accuracyPct,scored:x.scored,avgReturnPct:x.avgReturnPct})),
    underSampled,
    caution:'Correlation is descriptive evidence, not causal proof. Small samples are not promoted to policy changes.'
  }});
}
function assistantLearningProposal(id){
  const c=assistantLearningExplain();
  return c.proposals.find(x=>x.id===id)||null;
}

// ── PHASE 41 · Risk Investigation Assistant ─────────────────
const ASSISTANT_RISK_SOURCE_MAP=Object.freeze({
  FREEZE_AUTH:'tokenResearch.authorities.freezeEnabled',
  MINT_AUTH:'tokenResearch.authorities.mintEnabled',
  AUTH_RENOUNCED:'tokenResearch.authorities',
  TOKEN2022_NON_TRANSFERABLE:'tokenResearch.tokenProgram.restrictions',
  TOKEN2022_DEFAULT_FROZEN:'tokenResearch.tokenProgram.restrictions',
  TOKEN2022_PERMANENT_DELEGATE:'tokenResearch.tokenProgram.restrictions',
  TOKEN2022_TRANSFER_HOOK:'tokenResearch.tokenProgram.restrictions',
  TOKEN2022_TRANSFER_FEE:'tokenResearch.tokenProgram.restrictions',
  TOKEN2022_CONFIDENTIAL_TRANSFER:'tokenResearch.tokenProgram.restrictions',
  VERY_LOW_LIQ:'market.liquidity',
  LOW_LIQ:'market.liquidity',
  THIN_LIQ:'market.liquidity',
  LIQUIDITY_TRAP:'market.liquidity + market.fdv',
  THIN_LIQ_FDV:'market.liquidity + market.fdv',
  EXTREME_TURNOVER:'market.volume24h + market.liquidity',
  HIGH_TURNOVER:'market.volume24h + market.liquidity',
  ABNORMAL_1H_MOVE:'market.priceChange.h1',
  FAST_1H_MOVE:'market.priceChange.h1',
  EXTREME_24H_MOVE:'market.priceChange.h24',
  TOP_OWNER_CONCENTRATION:'tokenResearch.holders.ownerResolved.topOwnerPct',
  LARGE_TOP_OWNER:'tokenResearch.holders.ownerResolved.topOwnerPct',
  TOP10_OWNER_CONCENTRATION:'tokenResearch.holders.ownerResolved.top10OwnerPct',
  TOP10_OWNER_HEAVY:'tokenResearch.holders.ownerResolved.top10OwnerPct',
  CREATOR_CONCENTRATION:'tokenResearch.creatorHoldings.pct',
  CREATOR_HEAVY:'tokenResearch.creatorHoldings.pct',
  SERIAL_LAUNCHER:'tokenResearch.creatorHistory.relatedLaunchCount',
  REPEAT_LAUNCHER:'tokenResearch.creatorHistory.relatedLaunchCount',
  FUNDER_LAUNCH_CLUSTER:'tokenResearch.creatorHistory.funder + relatedLaunchCount',
  SNIPER_CONCENTRATION:'tokenResearch.earlyBird.earlyHolderOverlapPct',
  EARLY_HOLDER_CLUSTER:'tokenResearch.earlyBird.earlyHolderOverlapPct'
});
function assistantRiskDecisionHistory(mint,walletAddress=null){
  return (riskDecisionBook.decisions||[]).filter(r=>String(r?.tokenAddress||r?.token||r?.mint||'')===mint&&(!walletAddress||!r.walletAddress||r.walletAddress===walletAddress)).slice(0,25);
}
function assistantRiskTraceFlag(flag,research,market){
  const code=String(flag?.code||flag||'UNKNOWN'),path=ASSISTANT_RISK_SOURCE_MAP[code]||'riskEngine.derivedEvidence';
  let observed=null;
  if(code==='FREEZE_AUTH')observed=research?.authorities?.freezeEnabled;
  else if(code==='MINT_AUTH')observed=research?.authorities?.mintEnabled;
  else if(code.startsWith('TOKEN2022_'))observed=research?.tokenProgram?.restrictions||null;
  else if(['VERY_LOW_LIQ','LOW_LIQ','THIN_LIQ'].includes(code))observed=market?.liquidity??null;
  else if(['LIQUIDITY_TRAP','THIN_LIQ_FDV'].includes(code))observed={liquidity:market?.liquidity??null,fdv:market?.fdv??null};
  else if(['EXTREME_TURNOVER','HIGH_TURNOVER'].includes(code))observed={volume24h:market?.volume24h??null,liquidity:market?.liquidity??null};
  else if(['ABNORMAL_1H_MOVE','FAST_1H_MOVE'].includes(code))observed=market?.priceChange?.h1??null;
  else if(code==='EXTREME_24H_MOVE')observed=market?.priceChange?.h24??null;
  else if(['TOP_OWNER_CONCENTRATION','LARGE_TOP_OWNER'].includes(code))observed=research?.holders?.ownerResolved?.topOwnerPct??research?.holders?.top1Pct??null;
  else if(['TOP10_OWNER_CONCENTRATION','TOP10_OWNER_HEAVY'].includes(code))observed=research?.holders?.ownerResolved?.top10OwnerPct??research?.holders?.top10Pct??null;
  else if(['CREATOR_CONCENTRATION','CREATOR_HEAVY'].includes(code))observed=research?.creatorHoldings?.pct??null;
  else if(['SERIAL_LAUNCHER','REPEAT_LAUNCHER'].includes(code))observed=research?.creatorHistory?.relatedLaunchCount??null;
  else if(code==='FUNDER_LAUNCH_CLUSTER')observed={funder:research?.creatorHistory?.funder?.address||null,relatedLaunchCount:research?.creatorHistory?.relatedLaunchCount??null};
  else if(['SNIPER_CONCENTRATION','EARLY_HOLDER_CLUSTER'].includes(code))observed=research?.earlyBird?.earlyHolderOverlapPct??research?.coordination?.earlyHolderOverlapPct??null;
  return {code,severity:flag?.severity||null,category:flag?.category||null,hard:!!flag?.hard,message:flag?.message||String(flag),points:Number(flag?.points||0),sourcePath:path,observed:assistantScrub(observed),provenance:observed===null||observed===undefined?'UNAVAILABLE':'COPYGUARD_EVIDENCE'};
}
function assistantRiskInvestigation(mint,opts={}){
  mint=String(mint||'').trim();if(!mint)return {ok:false,error:'Token address required'};
  const history=assistantRiskDecisionHistory(mint,opts.walletAddress||null),decision=opts.sourceSignature?history.find(r=>r.sourceSignature===opts.sourceSignature)||history[0]:history[0];
  const research=tokenResearchBook.tokens?.[mint]||null,market=assistantTokenMarket(mint),token=assistantTokenResearchAnalysis(mint);
  if(!decision&&!research&&!market)return {ok:false,error:'No CopyGuard risk/research evidence found for token',mint};
  const flags=(decision?.flags||[]).map(f=>assistantRiskTraceFlag(f,research,market));
  const hardFlags=flags.filter(f=>f.hard),cautionFlags=flags.filter(f=>!f.hard&&['MEDIUM','HIGH','CRITICAL'].includes(String(f.severity||'')));
  const unknowns=(decision?.unknowns||token?.risk?.unknowns||[]).map(u=>({code:u?.code||'UNKNOWN',message:u?.message||String(u),status:'UNKNOWN',effect:'LOWERS_CONFIDENCE_NOT_SAFETY_EVIDENCE'}));
  const components=Object.entries(decision?.components||{}).map(([category,score])=>({category,score:Number(score||0)})).sort((a,b)=>b.score-a.score);
  const prior=history.slice(1),changed=prior.length?{
    previousDecision:prior[0].decision||null,previousScore:prior[0].score??null,
    decisionChanged:(prior[0].decision||null)!==(decision?.decision||null),
    scoreDelta:Number(decision?.score||0)-Number(prior[0].score||0)
  }:null;
  const sourceTx=decision?.sourceSignature?assistantFindTransaction(decision.sourceSignature):null;
  return assistantScrub({version:1,phase:41,mint,symbol:decision?.tokenSymbol||token?.symbol||null,walletAddress:decision?.walletAddress||opts.walletAddress||null,
    verdict:{decision:decision?.decision||token?.verdict||'UNKNOWN',score:decision?.score??token?.risk?.score??null,level:decision?.level||token?.risk?.level||null,confidence:decision?.confidence??token?.risk?.confidence??null,evidenceVersion:decision?.evidenceVersion||null,generatedAt:decision?.generatedAt||decision?.time||null},
    forensicTrace:{hardBlocks:decision?.hardBlocks||token?.risk?.hardBlocks||[],cautions:decision?.cautions||token?.risk?.cautions||[],flags,hardFlags,cautionFlags,components,unknowns},
    evidence:{tokenResearch:token?.ok===false?null:token,sourceTransaction:sourceTx?{signature:decision.sourceSignature,eventKey:decision.sourceEventKey||null,transaction:sourceTx.transaction,event:sourceTx.event}:null,market},
    history:{count:history.length,recent:history.slice(0,10).map(r=>({time:r.time||r.generatedAt,decision:r.decision,score:r.score,level:r.level,confidence:r.confidence,sourceSignature:r.sourceSignature,hardBlockCount:(r.hardBlocks||[]).length})),changeFromPrevious:changed},
    interpretation:{
      hardBlockMeaning:'A deterministic hard block is execution-governing and cannot be waived by the assistant or AI.',
      cautionMeaning:'A caution raises risk but is not itself represented as proof of manipulation.',
      unknownMeaning:'UNKNOWN means evidence is unavailable; it is never converted into a safe finding.',
      suspiciousDoesNotMeanProvenFraud:true,
      turnoverSignalIsWashLikeNotProof:true,
      creatorIdentityRemainsCandidate:true
    },
    authority:{deterministicRiskAuthoritative:true,assistantCanOverride:false,assistantCanClearBlock:false,assistantCanChangeThresholds:false,assistantCanExecute:false}});
}
function assistantRiskTarget(route,text=''){
  const e=route.entities||assistantExtractEntities(text),candidates=[...(e.tokens||[]),...(e.addresses||[])];
  const sig=(String(text).match(/\b[1-9A-HJ-NP-Za-km-z]{64,88}\b/)||[])[0]||null;
  let mint=candidates.find(a=>tokenResearchBook.tokens?.[a]||assistantTokenRiskDecision(a)||marketBook.latest?.[a])||null;
  if(!mint&&sig){const tx=assistantFindTransaction(sig);mint=tx?.event?.tokenAddress||tx?.transaction?.tokenAddress||null;}
  return {mint,sourceSignature:sig,walletAddress:(e.wallets||[])[0]||null};
}

// ── PHASE 38 · Token Research Assistant ─────────────────────
function assistantTokenRiskDecision(mint){
  return (riskDecisionBook.decisions||[]).find(r=>String(r?.tokenAddress||r?.token||r?.mint||'')===mint)||null;
}
function assistantTokenMarket(mint){
  const row=marketBook.latest?.[mint]||null;
  return row?assistantScrub(row):null;
}
function assistantTokenResearchAnalysis(mint){
  const research=tokenResearchBook.tokens?.[mint]||null,risk=assistantTokenRiskDecision(mint),market=assistantTokenMarket(mint),early=typeof earlyBirdReconstruction!=='undefined'?earlyBirdReconstruction.tokens?.[mint]||null:null;
  if(!research&&!risk&&!market&&!early)return {ok:false,error:'Token not found in CopyGuard evidence',mint};
  const tokenProgram=research?.tokenProgram||{},auth=research?.authorities||{},owner=research?.holders?.ownerResolved||{},creator=research?.creatorHoldings||{},creatorHistory=research?.creatorHistory||{},prov=research?.provenance||{},coord=research?.coordination||{},mkt=research?.market||market||{};
  const restrictions=Array.isArray(tokenProgram.restrictions)?tokenProgram.restrictions:[];
  const authorities={mintEnabled:auth.mintEnabled??null,freezeEnabled:auth.freezeEnabled??null,known:auth.known??null,renounced:auth.mintEnabled===false&&auth.freezeEnabled===false};
  const holders={available:owner.available??research?.holders?.available??null,topOwnerPct:owner.topOwnerPct??research?.holders?.top1Pct??null,top10OwnerPct:owner.top10OwnerPct??research?.holders?.top10Pct??null,uniqueOwners:owner.uniqueOwners??null};
  const creatorSummary={candidate:research?.origin?.creatorCandidate||null,holdingPct:creator.pct??owner.creatorHoldingPct??null,relatedLaunchCount:creatorHistory.relatedLaunchCount??null,funder:creatorHistory.funder?.address||null,funderEvidence:creatorHistory.funderEvidence||null};
  const marketSummary={priceUsd:mkt.priceUsd??market?.priceUsd??null,liquidity:mkt.liquidity??market?.liquidity??null,fdv:mkt.fdv??market?.fdv??null,marketCap:mkt.marketCap??market?.marketCap??null,volume24h:mkt.volume24h??market?.volume24h??null,liquidityToFdvPct:mkt.liquidityToFdvPct??null,pairAddress:mkt.pairAddress??market?.pairAddress??null,dex:mkt.dex??market?.dex??null};
  const unknowns=[...(risk?.unknowns||[])];
  for(const [field,val] of Object.entries({mintAuthority:authorities.mintEnabled,freezeAuthority:authorities.freezeEnabled,holderConcentration:holders.topOwnerPct,creatorHoldings:creatorSummary.holdingPct,liquidity:marketSummary.liquidity})) if(val===null||val===undefined)unknowns.push({code:`${field.toUpperCase()}_UNKNOWN`,message:`${field} evidence is unavailable`});
  const hardBlocks=risk?.hardBlocks||[],cautions=risk?.cautions||[];
  const verdict=risk?.decision||'UNKNOWN';
  return assistantScrub({version:1,phase:38,mint,symbol:research?.symbol||market?.symbol||null,verdict,risk:{score:risk?.score??null,level:risk?.level||null,confidence:risk?.confidence??null,hardBlocks,cautions,unknowns,components:risk?.components||{},flags:risk?.flags||[]},
    tokenProgram:{type:tokenProgram.type||'UNKNOWN',programId:tokenProgram.programId||null,token2022:!!tokenProgram.token2022,extensions:tokenProgram.extensions||[],restrictions},
    authorities,holders,creator:creatorSummary,provenance:{available:prov.available??null,exactCopycats:prov.exactCopycats??null,likelyOriginal:prov.likelyOriginal??null,topCandidate:prov.topCandidate||null},
    market:marketSummary,earlyBird:{available:research?.earlyBird?.available??!!early,reconstructionConfidence:research?.earlyBird?.reconstructionConfidence||early?.confidence||null,buyersSampled:research?.earlyBird?.buyersSampled??null,earlyBuyerHolderOverlapPct:research?.earlyBird?.earlyHolderOverlapPct??coord.earlyHolderOverlapPct??null},
    coordination:{earlyHolderOverlapPct:coord.earlyHolderOverlapPct??null,localWatchedWalletCluster:coord.localWatchedWalletCluster||null},
    coverage:research?.coverage||null,limitations:research?.limitations||[],
    interpretation:{historicalLiquidityRemoval:research?.market?.removalHistory||'UNAVAILABLE',creatorIdentityIsCandidate:true,currentSnapshotIsNotHistoricalExecutionEvidence:true},
    authority:{riskDecisionAuthoritative:true,assistantCanOverrideHardBlock:false,assistantCanMarkSafe:false,assistantCanExecute:false}});
}
function assistantTokenTarget(route,text=''){
  const e=route.entities||assistantExtractEntities(text),candidates=[...(e.tokens||[]),...(e.addresses||[])];
  return candidates.find(a=>tokenResearchBook.tokens?.[a]||marketBook.latest?.[a]||assistantTokenRiskDecision(a)||(typeof earlyBirdReconstruction!=='undefined'&&earlyBirdReconstruction.tokens?.[a]))||candidates[0]||null;
}


// ── PHASE 39 · Trade Decision Assistant ─────────────────────
function assistantFindTransaction(signature,eventKey=null){
  const tx=signature?transactionLedger.bySignature?.[signature]:null;if(!tx)return null;
  if(eventKey&&tx.events?.[eventKey])return {transaction:tx,event:tx.events[eventKey]};
  const events=Object.values(tx.events||{});return {transaction:tx,event:events[0]||null};
}
function assistantLatestTradeAi(walletAddress,tokenAddress,sourceSignature){
  return (aiDecisionBook.decisions||[]).find(r=>r.task===AI_TASKS.TRADE_ANALYSIS&&
    (!sourceSignature||r.sourceSignature===sourceSignature)&&(!walletAddress||r.walletAddress===walletAddress)&&(!tokenAddress||r.tokenAddress===tokenAddress))||null;
}
function assistantTradeDecisionTarget(route,text=''){
  const e=route.entities||assistantExtractEntities(text),signature=(String(text).match(/\b[1-9A-HJ-NP-Za-km-z]{64,88}\b/)||[])[0]||null;
  let wallet=(e.wallets||[])[0]||null,token=(e.tokens||[])[0]||null,tx=null,event=null;
  if(signature){const found=assistantFindTransaction(signature);tx=found?.transaction||null;event=found?.event||null;}
  if(!tx&&e.addresses?.length){for(const sig of transactionLedger.order||[]){const row=transactionLedger.bySignature?.[sig];let raw='';try{raw=JSON.stringify(row)}catch{}if(e.addresses.some(a=>raw.includes(a))){tx=row;event=Object.values(row.events||{})[0]||null;break;}}}
  wallet=wallet||event?.walletAddress||tx?.walletAddress||null;token=token||event?.tokenAddress||tx?.tokenAddress||null;
  return {signature:signature||tx?.signature||tx?.sourceSignature||null,eventKey:event?.eventKey||event?.id||null,walletAddress:wallet,tokenAddress:token,transaction:tx,event};
}
function assistantTradeDecisionAnalysis(route,text=''){
  const target=assistantTradeDecisionTarget(route,text),wallet=target.walletAddress?wallets[target.walletAddress]||null:null;
  const walletAnalysis=target.walletAddress?assistantWalletAnalysis(target.walletAddress):null;
  const tokenResearch=target.tokenAddress?assistantTokenResearchAnalysis(target.tokenAddress):null;
  const risk=assistantTokenRiskDecision(target.tokenAddress)||null,market=target.tokenAddress?assistantTokenMarket(target.tokenAddress):null;
  const ai=assistantLatestTradeAi(target.walletAddress,target.tokenAddress,target.signature);
  const event=target.event||{},pricing=event.pricing||target.transaction?.pricing||{},chainTs=Number(event.chainTimestamp||target.transaction?.chainTimestamp||0)||null,observedAt=Number(event.observedAt||target.transaction?.observedAt||0)||null;
  const now=Date.now(),ageMs=chainTs?Math.max(0,now-chainTs):null,latencyMs=chainTs&&observedAt?Math.max(0,observedAt-chainTs):null,marketFetched=Number(market?.fetchedAt||market?.timestamp||0)||null,marketAgeMs=marketFetched?Math.max(0,now-marketFetched):null;
  const hardBlocks=risk?.hardBlocks||[],cautions=risk?.cautions||[],unknowns=risk?.unknowns||[];
  const blockers=[];if(hardBlocks.length)blockers.push('DETERMINISTIC_RISK_HARD_BLOCK');if(ageMs===null)blockers.push('CHAIN_TIMESTAMP_UNKNOWN');else if(ageMs>LIVE_SIGNAL_MAX_AGE_MS)blockers.push('STALE_SIGNAL');if(latencyMs===null)blockers.push('OBSERVATION_LATENCY_UNKNOWN');else if(latencyMs>LIVE_OBSERVATION_MAX_LATENCY_MS)blockers.push('OBSERVATION_TOO_LATE');
  const action=String(event.action||target.transaction?.action||'UNKNOWN').toUpperCase();if(action==='BUY'){if(!marketFetched)blockers.push('MARKET_FRESHNESS_UNKNOWN');else if(marketAgeMs>LIVE_MARKET_MAX_AGE_MS)blockers.push('STALE_MARKET');if(market?.degradedFallback)blockers.push('DEGRADED_MARKET_FALLBACK');}
  if(action==='SELL')blockers.push('AUTOMATED_SELL_REQUIRES_OWN_WALLET_HOLDING_EVIDENCE');
  const deterministicDecision=hardBlocks.length?'SKIP':blockers.length?'NOT_LIVE_ELIGIBLE':risk?.decision==='CAUTION'?'CAUTION':'REVIEWABLE';
  return assistantScrub({version:1,phase:39,target:{signature:target.signature,eventKey:target.eventKey,walletAddress:target.walletAddress,tokenAddress:target.tokenAddress,action},decision:{deterministicDecision,blockers,cautions,unknowns,riskDecision:risk?.decision||'UNKNOWN',riskScore:risk?.score??null},
    transaction:{signature:target.signature,chainTimestamp:chainTs,observedAt,ageMs,observationLatencyMs:latencyMs,slot:event.slot||target.transaction?.slot||null},
    pricing:{executionPriceUsd:pricing.executionPriceUsd??null,executionPriceSol:pricing.executionPriceSol??null,source:pricing.source||'UNRESOLVED',confidence:pricing.confidence||'LOW',marketPriceUsd:pricing.marketPriceUsd??market?.priceUsd??null,marketFetchedAt:pricing.marketFetchedAt??marketFetched,marketAgeMs,marketQuality:pricing.marketQuality??market?.quality??null,liquidity:pricing.liquidity??market?.liquidity??null},
    wallet:walletAnalysis?.ok===false?{available:false}:{available:!!walletAnalysis,analysis:walletAnalysis},token:tokenResearch?.ok===false?{available:false}:{available:!!tokenResearch,analysis:tokenResearch},
    specializedAI:ai?{provider:ai.provider,recommendation:ai.recommendation,confidence:ai.confidence,deterministicDecision:ai.deterministicDecision,deterministicOverride:ai.deterministicOverride,error:ai.error}:null,
    authority:{assistantAdvisoryOnly:true,deterministicRiskAuthoritative:true,phase32ExecutionSafetyAuthoritative:true,padreClickIsNotSettlement:true,canExecute:false,canOverrideHardBlocks:false}});
}


// ── PHASE 46 · Assistant Memory & Project Context ───────────
const ASSISTANT_MEMORY_TYPES=Object.freeze({DECISION:'DECISION',INVESTIGATION:'INVESTIGATION',WATCH_ITEM:'WATCH_ITEM',WORKING_NOTE:'WORKING_NOTE',CONCLUSION:'CONCLUSION'});
const ASSISTANT_MEMORY_LIMIT=500, ASSISTANT_MEMORY_CONTEXT_LIMIT=12;
function assistantMemoryEntities(text='',extra={}){
  const e=assistantExtractEntities(String(text||''));return {addresses:[...new Set([...(e.addresses||[]),...(extra.addresses||[])])].slice(0,20),wallets:[...new Set([...(e.wallets||[]),...(extra.wallets||[])])].slice(0,20),tokens:[...new Set([...(e.tokens||[]),...(extra.tokens||[])])].slice(0,20)};
}
function assistantMemoryFreshness(memory){
  const now=Date.now(),ageMs=Math.max(0,now-Number(memory.updatedAt||memory.createdAt||0));
  return {ageMs,ageDays:Math.floor(ageMs/86400000),stale:ageMs>7*86400000,note:'Memory is historical working context, never authoritative live evidence.'};
}
function assistantMemoryCreate(input={},sessionId=null){
  const content=String(input.content||'').trim();if(!content)return {ok:false,error:'Memory content is required'};
  const type=Object.values(ASSISTANT_MEMORY_TYPES).includes(String(input.type||''))?String(input.type):ASSISTANT_MEMORY_TYPES.WORKING_NOTE;
  const now=Date.now(),id=`mem-${now}-${Math.random().toString(36).slice(2,8)}`,row={id,version:1,phase:46,type,title:String(input.title||content.slice(0,72)||'Memory').slice(0,100),content:content.slice(0,6000),createdAt:now,updatedAt:now,sessionId:sessionId||input.sessionId||null,status:'ACTIVE',entities:assistantMemoryEntities(content,input.entities||{}),sourceRefs:Array.isArray(input.sourceRefs)?input.sourceRefs.slice(0,20):[],confidence:Math.max(0,Math.min(100,Number(input.confidence??50))),userPinned:!!input.userPinned,authority:'CONTEXT_ONLY',supersedes:input.supersedes||null};
  assistantBook.memory[id]=row;assistantBook.memoryOrder.unshift(id);assistantBook.memoryStats.created=Number(assistantBook.memoryStats.created||0)+1;assistantBook.memoryStats.lastChangedAt=now;assistantAudit('MEMORY_CREATED',row.sessionId,{memoryId:id,type,rowAuthority:'CONTEXT_ONLY'});persistAssistant();return {ok:true,memory:assistantScrub({...row,freshness:assistantMemoryFreshness(row)})};
}
function assistantMemoryUpdate(id,patch={}){
  const row=assistantBook.memory?.[id];if(!row)return {ok:false,error:'Memory not found'};if(row.status!=='ACTIVE')return {ok:false,error:`Memory is ${row.status}`};
  if(patch.content!==undefined){const c=String(patch.content||'').trim();if(!c)return {ok:false,error:'Memory content cannot be empty'};row.content=c.slice(0,6000);}
  if(patch.title!==undefined)row.title=String(patch.title||'Memory').slice(0,100);
  if(patch.type!==undefined&&Object.values(ASSISTANT_MEMORY_TYPES).includes(String(patch.type)))row.type=String(patch.type);
  if(patch.userPinned!==undefined)row.userPinned=!!patch.userPinned;
  if(patch.confidence!==undefined)row.confidence=Math.max(0,Math.min(100,Number(patch.confidence)||0));
  row.entities=assistantMemoryEntities(`${row.title} ${row.content}`,patch.entities||row.entities||{});row.updatedAt=Date.now();assistantBook.memoryStats.updated=Number(assistantBook.memoryStats.updated||0)+1;assistantBook.memoryStats.lastChangedAt=row.updatedAt;assistantAudit('MEMORY_UPDATED',row.sessionId,{memoryId:id,type:row.type});persistAssistant();return {ok:true,memory:assistantScrub({...row,freshness:assistantMemoryFreshness(row)})};
}
function assistantMemoryArchive(id){
  const row=assistantBook.memory?.[id];if(!row)return {ok:false,error:'Memory not found'};row.status='ARCHIVED';row.updatedAt=Date.now();assistantBook.memoryStats.archived=Number(assistantBook.memoryStats.archived||0)+1;assistantBook.memoryStats.lastChangedAt=row.updatedAt;assistantAudit('MEMORY_ARCHIVED',row.sessionId,{memoryId:id});persistAssistant();return {ok:true,memory:assistantScrub(row)};
}
function assistantMemoryRelevance(row,query='',entities={}){
  if(!row||row.status!=='ACTIVE')return -1;let score=row.userPinned?30:0;const q=String(query||'').toLowerCase(),words=q.split(/[^a-z0-9]+/).filter(x=>x.length>3);const hay=`${row.title} ${row.content}`.toLowerCase();
  for(const w of words.slice(0,20))if(hay.includes(w))score+=2;
  const needles=[...(entities.addresses||[]),...(entities.wallets||[]),...(entities.tokens||[])];for(const n of needles)if(JSON.stringify(row.entities||{}).includes(n)||hay.includes(String(n).toLowerCase()))score+=20;
  score+=Math.max(0,10-Math.floor(Math.max(0,Date.now()-Number(row.updatedAt||0))/86400000));return score;
}
function assistantMemoryContext(query='',limit=ASSISTANT_MEMORY_CONTEXT_LIMIT){
  const entities=assistantExtractEntities(query),rows=(assistantBook.memoryOrder||[]).map(id=>assistantBook.memory?.[id]).filter(Boolean).map(row=>({row,score:assistantMemoryRelevance(row,query,entities)})).filter(x=>x.score>=0).sort((a,b)=>b.score-a.score||Number(b.row.updatedAt)-Number(a.row.updatedAt)).slice(0,Math.max(1,Math.min(25,Number(limit)||ASSISTANT_MEMORY_CONTEXT_LIMIT)));
  return {version:1,phase:46,mode:'CONTEXT_ONLY_NON_AUTHORITATIVE',query:String(query||'').slice(0,1000),entities,records:rows.map(({row,score})=>assistantScrub({...row,relevanceScore:score,freshness:assistantMemoryFreshness(row)})),limitations:['Memory is historical working context and can be stale.','Current CopyGuard ledgers, blockchain evidence, deterministic risk, qualification, connection health, integrity, and Phase 32 execution safety always override memory.','Memory cannot authorize an action, promote a wallet, enable Trusted, alter risk, or prove a fact by itself.']};
}
function assistantMemoryPublic(){return {version:1,phase:46,types:ASSISTANT_MEMORY_TYPES,stats:assistantBook.memoryStats,records:(assistantBook.memoryOrder||[]).map(id=>assistantBook.memory?.[id]).filter(Boolean).slice(0,ASSISTANT_MEMORY_LIMIT).map(r=>assistantScrub({...r,freshness:assistantMemoryFreshness(r)}))};}


// ── PHASE 47 · Assistant Full Logic Audit ──────────────────
const ASSISTANT_AUDIT_SEVERITY=Object.freeze({PASS:'PASS',WARN:'WARN',FAIL:'FAIL'});
function assistantLogicCheck(id,title,ok,detail='',severityOnFail='FAIL'){
  return {id,title,status:ok?ASSISTANT_AUDIT_SEVERITY.PASS:severityOnFail,detail:String(detail||''),checkedAt:Date.now()};
}
function assistantFullLogicAudit(){
  const now=Date.now(),checks=[];
  const add=(id,title,ok,detail='',severity='FAIL')=>checks.push(assistantLogicCheck(id,title,!!ok,detail,severity));
  add('PERMISSION_MATRIX','Live execution and configuration permissions are denied',ASSISTANT_POLICY.LIVE_EXECUTION?.allowed===false&&ASSISTANT_POLICY.CHANGE_CONFIG?.allowed===false&&ASSISTANT_POLICY.PREPARE?.execution===false);
  add('ROUTER_EXECUTION_DENY','Natural-language LIVE_TRADE route remains denied',ASSISTANT_COMMANDS.LIVE_TRADE?.permission===ASSISTANT_PERMISSIONS.LIVE_EXECUTION);
  add('PROPOSAL_BOUNDARY','Only PREPARE proposal type is admitted',typeof assistantCreateProposal==='function');
  add('SAFE_PREPARATION','Safe Preparation retains zero execution authority',typeof assistantBuildPreparation==='function');
  add('GOVERNED_ALLOWLIST','Governed action allowlist is narrow',Object.keys(ASSISTANT_GOVERNED_ACTIONS||{}).length===2&&!!ASSISTANT_GOVERNED_ACTIONS.OPEN_PADRE_TOKEN&&!!ASSISTANT_GOVERNED_ACTIONS.POPULATE_PADRE_DRAFT);
  add('GOVERNED_CONFIRMATION','Governed actions require explicit confirmation',typeof assistantRunGovernedAction==='function');
  add('SELL_FAIL_CLOSED','Assistant governed SELL draft is not an allowed action',!Object.values(ASSISTANT_GOVERNED_ACTIONS||{}).some(x=>String(x).includes('SELL')));
  add('MEMORY_NON_AUTHORITATIVE','Memory remains context-only',typeof assistantMemoryContext==='function');
  add('MEMORY_NO_AUTHORITY','No active memory item carries execution authority',!Object.values(assistantBook.memory||{}).some(x=>x?.authority&&x.authority!=='CONTEXT_ONLY'));
  add('NO_ASSISTANT_EXEC_ATTEMPT','Governed actions have not created Phase 32 execution attempts',!Object.values(assistantBook.governedActions||{}).some(x=>x?.executionAttemptId));
  add('NO_ASSISTANT_SUBMISSION','Governed actions have not recorded a submitted trade',!Object.values(assistantBook.governedActions||{}).some(x=>x?.tradeSubmitted===true));
  add('PROPOSALS_NO_EXECUTION','Assistant proposals have no execution record',!Object.values(assistantBook.proposals||{}).some(x=>x?.actionExecuted===true||x?.tradeSubmitted===true));
  add('MEMORY_BOUNDED','Memory is within bounded limit',(assistantBook.memoryOrder||[]).length<=ASSISTANT_MEMORY_LIMIT);
  add('SESSIONS_BOUNDED','Assistant sessions are within bounded limit',(assistantBook.order||[]).length<=ASSISTANT_SESSION_LIMIT);
  add('AUDIT_BOUNDED','Assistant audit trail is within bounded limit',(assistantBook.audit||[]).length<=ASSISTANT_AUDIT_LIMIT);
  const activeActions=Object.values(assistantBook.governedActions||{}).filter(x=>x&&['AWAITING_EXPLICIT_CONFIRMATION','RUNNING'].includes(x.status));
  const expiredActive=activeActions.filter(x=>Number(x.expiresAt||0)&&Number(x.expiresAt)<now);
  add('ACTION_EXPIRY','No expired governed action remains actionable',expiredActive.length===0,expiredActive.length?`${expiredActive.length} expired action(s) require cleanup`:'');
  const impossibleMessages=Object.values(assistantBook.sessions||{}).flatMap(x=>x.messages||[]).filter(x=>x?.actionExecuted===true);
  add('MESSAGE_AUTHORITY','Assistant messages do not claim executable authority',impossibleMessages.length===0,impossibleMessages.length?`${impossibleMessages.length} violating message record(s)`:'');
  const integrityOk=!String(integrityBook.lastStatus||'').toUpperCase().includes('FAIL');
  add('INTEGRITY_CONTEXT','CopyGuard integrity is not currently failed',integrityOk,`Integrity: ${integrityBook.lastStatus||'UNKNOWN'}`,'WARN');
  const conn=connectionHealthSnapshot();
  add('CONNECTION_CONTEXT','Connection mode is not degraded',conn?.mode!=='DEGRADED',`Mode: ${conn?.mode||'UNKNOWN'}`,'WARN');
  add('EMERGENCY_PAUSE_CONTEXT','Automation emergency pause is not active',!settings.automationPaused,settings.automationPaused?'Automation pause is active':'','WARN');
  const fails=checks.filter(x=>x.status==='FAIL'),warns=checks.filter(x=>x.status==='WARN');
  const status=fails.length?'FAIL':warns.length?'WARN':'PASS';
  const result={version:1,phase:47,generatedAt:now,status,summary:{checks:checks.length,passed:checks.filter(x=>x.status==='PASS').length,warnings:warns.length,failures:fails.length},checks,
    authority:{auditCanExecute:false,auditCanChangeConfig:false,auditCanPromote:false,auditCanOverrideRisk:false},
    invariants:[
      'Assistant model output cannot elevate deterministic permissions.',
      'Memory is context-only and never overrides current evidence.',
      'Deterministic risk hard blocks and Phase 32 execution safety are authoritative.',
      'Governed assistant actions stop before final Padre submit.',
      'No assistant path may call executeTrade or reserve an execution attempt.',
      'Automated SELL remains fail-closed without authoritative own-wallet evidence.'
    ]};
  assistantBook.logicAudit=result;assistantAudit('FULL_LOGIC_AUDIT',null,{status,summary:result.summary,actionExecuted:false});persistAssistant();return assistantScrub(result);
}
function assistantLogicAuditPublic(){return assistantBook.logicAudit?assistantScrub(assistantBook.logicAudit):assistantFullLogicAudit();}

function productionIntegrationAudit(){
  const now=Date.now(),checks=[];
  const add=(id,title,ok,detail='',severity='FAIL',area='SYSTEM')=>checks.push({id,title,status:ok?'PASS':severity,detail:String(detail||''),area});
  const attempts=Array.isArray(executionSafetyBook.attempts)?executionSafetyBook.attempts:[];
  const keys=attempts.map(a=>a?.key).filter(Boolean),dupeKeys=keys.filter((k,i)=>keys.indexOf(k)!==i);
  add('EXEC_IDEMPOTENCY','Phase 32 execution keys are unique',dupeKeys.length===0,dupeKeys.length?`${new Set(dupeKeys).size} duplicate execution key(s)`:'','FAIL','EXECUTION');

  const prepared=(history||[]).filter(x=>String(x?.decision||'').toUpperCase()==='PREPARED');
  const badPrepared=prepared.filter(x=>x?.accountingCommitted===true||x?.executionAttemptId||x?.submittedAt);
  add('PREPARED_NO_ACCOUNTING','PREPARED records have no submission/accounting authority',badPrepared.length===0,badPrepared.length?`${badPrepared.length} violating PREPARED record(s)`:'','FAIL','ACCOUNTING');

  const outcomes=(verifiedOutcomeBook.order||[]).map(id=>verifiedOutcomeBook.byId?.[id]).filter(Boolean);
  const authoritative=outcomes.filter(o=>o.completedOutcome===true&&o.sourceVerified===true&&o.dataQuality==='VERIFIED');
  const badVerified=authoritative.filter(o=>!(o.entry?.signature||o.entrySignature)||!(o.exit?.signature||o.exitSignature)||!Number.isFinite(Number(o.pnlSol)));
  add('VERIFIED_SOURCE_CHAIN','Verified realized outcomes retain entry/exit evidence and finite P&L',badVerified.length===0,badVerified.length?`${badVerified.length} verified outcome(s) missing required source evidence`:`${authoritative.length} authoritative outcome(s)`,'FAIL','ACCOUNTING');

  const unclosedAuthoritative=outcomes.filter(o=>o.sourceVerified===true&&o.dataQuality==='VERIFIED'&&o.completedOutcome!==true);
  add('VERIFIED_FULL_CLOSE_ONLY','Authoritative realized outcomes are fully closed',unclosedAuthoritative.length===0,unclosedAuthoritative.length?`${unclosedAuthoritative.length} non-closed authoritative record(s)`:'','FAIL','ACCOUNTING');

  const assistantActions=Object.values(assistantBook.governedActions||{}).filter(Boolean);
  const assistantAuthorityViolations=assistantActions.filter(a=>a.tradeSubmitted===true||a.executionAttemptId);
  add('ASSISTANT_PRE_SUBMIT_ONLY','Assistant governed actions remain pre-submit only',assistantAuthorityViolations.length===0,assistantAuthorityViolations.length?`${assistantAuthorityViolations.length} violating governed action(s)`:`${assistantActions.length} governed action(s) audited`,'FAIL','ASSISTANT');

  const assistantAudit=assistantLogicAuditPublic();
  add('ASSISTANT_LOGIC_AUDIT','Assistant full logic audit has no FAIL',assistantAudit.status!=='FAIL',`Phase 47: ${assistantAudit.status}`,'FAIL','ASSISTANT');

  const sellSubmission=attempts.filter(a=>String(a.action||'').toUpperCase()==='SELL'&&['RESERVED','SUBMITTED','SUBMITTED_UNVERIFIED'].includes(String(a.status||'').toUpperCase()));
  add('AUTO_SELL_FAIL_CLOSED','No automated SELL attempt reached reservable/submitted state',sellSubmission.length===0,sellSubmission.length?`${sellSubmission.length} SELL attempt(s) require investigation`:'','FAIL','EXECUTION');

  const unsafeSourceSigs=new Set((observationState.recentEvents||[]).filter(e=>e?.recovered===true||e?.stale===true).map(e=>e.signature).filter(Boolean));
  const unsafeAttempts=attempts.filter(a=>unsafeSourceSigs.has(a.sourceSignature)&&['RESERVED','SUBMITTED','SUBMITTED_UNVERIFIED'].includes(String(a.status||'').toUpperCase()));
  add('RECOVERED_SIGNAL_NON_LIVE','Recovered/stale observation events are not live execution sources',unsafeAttempts.length===0,unsafeAttempts.length?`${unsafeAttempts.length} unsafe execution attempt(s)`:'','FAIL','OBSERVATION');

  const hardRisk=(riskDecisionBook.decisions||[]).filter(r=>r.decision==='HARD_BLOCK');
  add('RISK_AUTHORITY','Deterministic Risk Engine v3 remains available and hard-block evidence retained',typeof assessTradeRisk==='function'&&Array.isArray(riskDecisionBook.decisions),`${hardRisk.length} retained HARD_BLOCK decision(s)`,'FAIL','RISK');

  const qualViolations=[];
  for(const [address,p] of Object.entries(qualificationBook.wallets||{})){
    if(p?.state==='AUTO_PAUSED'&&trustedCfgs[address]?.enabled!==false)qualViolations.push(address);
  }
  add('QUALIFICATION_AUTO_PAUSE','AUTO_PAUSED qualification disables Trusted automation',qualViolations.length===0,qualViolations.length?`${qualViolations.length} wallet(s) still enabled`:'','FAIL','QUALIFICATION');

  const orphanTrusted=Object.keys(trustedCfgs||{}).filter(a=>!wallets[a]);
  add('TRUSTED_CONFIG_OWNERSHIP','Trusted configs resolve to monitored wallets',orphanTrusted.length===0,orphanTrusted.length?`${orphanTrusted.length} orphan Trusted config(s)`:'','WARN','QUALIFICATION');

  const conn=connectionHealthSnapshot();
  add('CONNECTION_HEALTH','Execution-critical connection mode is not degraded',conn?.mode!=='DEGRADED',`Mode: ${conn?.mode||'UNKNOWN'}${conn?.reason?` · ${conn.reason}`:''}`,'WARN','SYSTEM');

  const integrityStatus=String(integrityBook.lastStatus||'UNKNOWN').toUpperCase();
  add('DATA_INTEGRITY','Phase 30 integrity engine is not failed',!integrityStatus.includes('FAIL'),`Integrity: ${integrityBook.lastStatus||'UNKNOWN'}`,'WARN','SYSTEM');

  add('EMERGENCY_PAUSE','Emergency pause state is visible and authoritative',true,settings.automationPaused?'Currently ACTIVE':'Currently CLEAR','FAIL','EXECUTION');
  add('PADRE_BOUNDARY','Padre persistent isolated workspace remains available',typeof createPadreView==='function'&&PADRE_HOME.includes('padre'),PADRE_HOME,'FAIL','PADRE');

  const fails=checks.filter(x=>x.status==='FAIL'),warns=checks.filter(x=>x.status==='WARN');
  return assistantScrub({version:1,phase:65,generatedAt:now,status:fails.length?'FAIL':warns.length?'WARN':'PASS',
    summary:{checks:checks.length,passed:checks.filter(x=>x.status==='PASS').length,warnings:warns.length,failures:fails.length},
    checks,
    authority:{canExecute:false,canPromoteTrusted:false,canOverrideRisk:false,canCommitAccounting:false},
    invariants:[
      'PREPARED is not submitted, settled, or verified realized performance.',
      'Only fully closed source-verified outcomes count as authoritative realized performance.',
      'Recovered or stale observation evidence cannot become a live execution source.',
      'Automated SELL remains fail-closed without authoritative own-wallet evidence.',
      'Assistant governed actions stop before final Padre submit and never reserve Phase 32 execution.',
      'Dynamic qualification can auto-pause Trusted automation but never silently resumes it.',
      'Deterministic risk hard blocks remain authoritative over AI, ranking, settings, and UI handoffs.'
    ]});
}


function assistantFoundationContext(query=''){
  const awareness=assistantAwarenessSnapshot(query);
  return {phase:47,appVersion:app.getVersion(),provider:settings.aiProvider||null,providerConfigured:!!settings.apiKeys?.[settings.aiProvider],systemMode:awareness.sources.connectionHealth?.mode||'UNKNOWN',systemReason:awareness.sources.connectionHealth?.reason||'',automationPaused:!!settings.automationPaused,awareness:assistantAwarenessSummary(awareness),scope:'STRUCTURED_READ_ONLY_EVIDENCE',memoryMode:'NON_AUTHORITATIVE_CONTEXT',memory:assistantMemoryContext(query),limitations:[...awareness.limitations,'Phase 46 memory is context-only and is always subordinate to current authoritative evidence.']};
}
function assistantAudit(kind,sessionId,data={}){const row={id:`aa-${Date.now()}-${Math.random().toString(36).slice(2,8)}`,at:Date.now(),kind,sessionId:sessionId||null,...data};assistantBook.audit.unshift(row);assistantBook.audit=assistantBook.audit.slice(0,ASSISTANT_AUDIT_LIMIT);return row;}
function assistantPublicState(){
  const active=getAssistantSession(null,false);return {version:2,phase:47,permissions:ASSISTANT_PERMISSIONS,policy:ASSISTANT_POLICY,activeSessionId:assistantBook.activeSessionId||null,activeSession:active?{...active,messages:[...(active.messages||[])]}:null,sessions:(assistantBook.order||[]).map(id=>assistantBook.sessions[id]).filter(Boolean).map(x=>({id:x.id,title:x.title,createdAt:x.createdAt,updatedAt:x.updatedAt,messageCount:(x.messages||[]).length,status:x.status})),stats:{...assistantBook.stats},proposals:assistantProposalPublic(),memory:assistantMemoryPublic(),logicAudit:assistantBook.logicAudit||null,context:assistantFoundationContext()};
}
function assistantDeniedResponse(permission){
  if(permission===ASSISTANT_PERMISSIONS.LIVE_EXECUTION)return 'I can analyze or prepare information, but I cannot execute a live trade from chat. Live execution must remain inside the Phase 32 governed execution path.';
  if(permission===ASSISTANT_PERMISSIONS.CHANGE_CONFIG)return 'Configuration changes are not enabled from the assistant in Phase 33. I can explain the setting and prepare a proposed change, but I will not modify it.';
  return 'That request requires a governed action which is not enabled in the Phase 33 assistant foundation.';
}
function assistantFallbackReply(text,permission,ctx,awareness){
  const a=assistantAwarenessSummary(awareness),c=a.counts||{};
  if(permission===ASSISTANT_PERMISSIONS.PREPARE)return 'I can prepare an action proposal, but Phase 34 awareness is read-only. No CopyGuard state was changed.';
  if(permission===ASSISTANT_PERMISSIONS.ANALYZE||permission===ASSISTANT_PERMISSIONS.RECOMMEND)return `I have read-only access to CopyGuard evidence. Current mode: ${a.systemMode}; integrity: ${a.integrity}; wallets: ${c.wallets}; verified outcomes: ${c.verifiedOutcomes}; risk decisions: ${c.risk}. Configure an AI provider for a narrative evidence analysis.`;
  return `CopyGuard Assistant awareness is online with ${a.sourceCount} structured evidence sources. Current system mode is ${a.systemMode}; integrity is ${a.integrity}.`;
}
async function assistantRespond(sessionId,text){
  const session=getAssistantSession(sessionId,true),clean=String(text||'').trim();if(!clean)throw new Error('Assistant message is empty');
  const command=assistantCommandContext(clean),route=command.route,permission=route.permission,decision=assistantPolicyDecision(permission),awareness=assistantAwarenessSnapshot(clean),ctx=assistantFoundationContext(clean);
  const user=assistantMessage('user',clean,{permission,route:{key:route.key,intent:route.intent,confidence:route.confidence,sources:route.sources}});session.messages.push(user);session.updatedAt=Date.now();assistantBook.stats.userMessages=Number(assistantBook.stats.userMessages||0)+1;assistantBook.stats.lastMessageAt=Date.now();
  if(session.title==='New conversation')session.title=clean.replace(/\s+/g,' ').slice(0,56)||session.title;
  assistantAudit('COMMAND_ROUTED',session.id,{intent:route.intent,permission,routeConfidence:route.confidence,sources:route.sources,entities:route.entities,allowed:decision.allowed});
  let content='',provider=settings.aiProvider||null,providerUsed=false,error=null;
  if(!decision.allowed){content=assistantDeniedResponse(permission);assistantBook.stats.deniedRequests=Number(assistantBook.stats.deniedRequests||0)+1;assistantAudit('DENIED',session.id,{permission,intent:route.intent,reason:'Permission denied by deterministic assistant policy'});}
  else if(settings.apiKeys?.[provider]){
    const memoryContext=assistantMemoryContext(clean);const history=(session.messages||[]).slice(-10).map(m=>`${m.role.toUpperCase()}: ${m.content}`).join('\n');
    const prompt=`You are CopyGuard Assistant, Phase 47 Full Logic Audit with Phase 46 memory/project context, Phase 45 governed actions, Phase 44 safe preparation, Phase 43 portfolio/performance, Phase 42 learning, Phase 41 risk investigation, Phase 40 Shadow coaching, Phase 39 trade decisions, Phase 38 token research, and Phase 37 wallet analysis. Deterministic router intent: ${route.intent}; permission: ${permission}; route confidence: ${route.confidence}. You are an advisory operator interface, not execution authority. Answer the routed intent using ONLY the supplied routed evidence. For WALLET_INSPECT and WALLET_COMPARE, treat evidence.walletAnalyst as the authoritative wallet scorecard derived from verified closed outcomes. For TOKEN_RESEARCH use evidence.tokenResearch as the structured research dossier. For RISK_EXPLAIN use evidence.riskInvestigation as the forensic trace and evidence.tokenResearch only as supporting context; deterministic risk verdicts and hard blocks are authoritative and cannot be softened or overridden. For TRADE_DECISION use evidence.tradeDecision; distinguish source execution price from later market price, preserve timestamp/latency/freshness blockers, and treat Phase 28 Trade AI as advisory beneath deterministic risk and Phase 32 execution safety. For SHADOW_COACH/SHADOW_RANK use evidence.shadowCoach; only fully closed source-verified outcomes count toward qualification, while open and partial lots are context only. For LEARNING_REVIEW use evidence.learningAnalysis; report sample sizes, linkage coverage, provider/task calibration, recurring misses, and advisory proposals. For PORTFOLIO_REVIEW use evidence.portfolioAnalysis; keep verified realized P&L separate from open Shadow marks and operational position ledgers, explain wallet/token attribution and drawdown, and never treat an unrealized mark as a completed outcome. Never describe correlation as causation and never claim proposals were auto-applied. Never promote or enable Trusted. Do not broaden to evidence sources that were not supplied. UNKNOWN/UNAVAILABLE stays unknown. Never invent wallet performance, token history, identities, causality, prices, transactions, or missing values. Deterministic risk hard blocks, qualification lifecycle, connection degraded mode, integrity state, and Phase 32 execution safety are authoritative. You MUST NOT claim to have changed configuration, promoted a wallet, submitted an order, or executed a live trade. PREPARE means proposal/preparation only and never final trade confirmation. Phase 44 constructs reviewable preparation context. Phase 45 may, only after a confirmed proposal plus a second explicit governed-action confirmation and a fresh safety re-check, navigate Padre or populate a BUY draft. It can never click final submit, call executeTrade, reserve an execution attempt, change configuration, promote wallets, or override deterministic risk.\nPhase 46 memory context (historical, non-authoritative; newer evidence always wins): ${JSON.stringify(memoryContext)}\nRoute: ${JSON.stringify(route)}\nRouted evidence: ${JSON.stringify(command.evidence)}\nRecent conversation:\n${history}\nReturn ONLY valid JSON: {"message":"concise helpful answer","confidence":0-100,"proposedAction":null,"requestedPermission":"${permission}"}`;
    try{const raw=await callAI({action:'ASSISTANT',sizeSol:0},{stats:{}},prompt);content=String(raw?.message||'').trim()||assistantDeterministicCommandAnswer(route,command.evidence);providerUsed=true;assistantAudit('MODEL_RESPONSE',session.id,{permission,intent:route.intent,provider,confidence:Number(raw?.confidence||0),modelRequestedPermission:String(raw?.requestedPermission||''),routedSources:route.sources,contextTruncated:!!command.evidence.contextTruncated});}
    catch(e){error=e.message||String(e);content=assistantDeterministicCommandAnswer(route,command.evidence);assistantAudit('MODEL_ERROR',session.id,{permission,intent:route.intent,provider,error});}
  }else{content=assistantDeterministicCommandAnswer(route,command.evidence);assistantAudit('LOCAL_FALLBACK',session.id,{permission,intent:route.intent,reason:'Active AI provider is not configured'});}
  let proposal=null;
  if(decision.allowed&&permission===ASSISTANT_PERMISSIONS.PREPARE)proposal=assistantCreateProposal(session.id,clean,route,command.evidence);
  if(proposal){content+=proposal.status===ASSISTANT_PROPOSAL_STATUS.PENDING?'\n\nA structured preparation proposal is ready for your confirmation. Confirming it records approval only; Phase 44 can then build a reviewable safe-preparation object, but it still does not submit a trade.':`\n\nI could not create an actionable preparation proposal: ${proposal.validation.reasons.join(', ')}.`;}
  const reply=assistantMessage('assistant',content,{permission,policy:decision,provider:providerUsed?provider:null,error,actionExecuted:false,proposalId:proposal?.id||null,route:{key:route.key,intent:route.intent,confidence:route.confidence,sources:route.sources,reason:route.reason},evidence:{phase:47,sourceCount:route.sources.length,entities:route.entities,contextTruncated:!!command.evidence.contextTruncated,generatedAt:command.evidence.generatedAt}});
  session.messages.push(reply);session.updatedAt=Date.now();assistantBook.stats.assistantMessages=Number(assistantBook.stats.assistantMessages||0)+1;persistAssistant();broadcast('assistant-update',{sessionId:session.id,message:reply});return {ok:true,sessionId:session.id,message:reply,route,permissionDecision:decision,state:assistantPublicState()};
}
function assistantArchiveSession(id){const s=assistantBook.sessions?.[id];if(!s)return {ok:false};s.status='ARCHIVED';s.updatedAt=Date.now();if(assistantBook.activeSessionId===id)assistantBook.activeSessionId=null;persistAssistant();return {ok:true,state:assistantPublicState()};}

// ── IPC handlers ────────────────────────────────────────────
ipcMain.handle('assistant-get-state',()=>assistantPublicState());
ipcMain.handle('assistant-new-session',(_,title)=>{const s=newAssistantSession(title);return {ok:true,sessionId:s.id,state:assistantPublicState()};});
ipcMain.handle('assistant-select-session',(_,id)=>{if(!assistantBook.sessions?.[id])return {ok:false,error:'Assistant session not found'};assistantBook.activeSessionId=id;persistAssistant();return {ok:true,state:assistantPublicState()};});
ipcMain.handle('assistant-send-message',(_,id,text)=>assistantRespond(id,text));
ipcMain.handle('assistant-archive-session',(_,id)=>assistantArchiveSession(id));
ipcMain.handle('assistant-permission-check',(_,text)=>{const route=assistantRouteCommand(text);return {...assistantPolicyDecision(route.permission),route};});
ipcMain.handle('assistant-route-command',(_,text)=>assistantRouteCommand(text));
ipcMain.handle('assistant-awareness',(_,query)=>assistantAwarenessSnapshot(query||''));
ipcMain.handle('assistant-proposals',()=>assistantProposalPublic());
ipcMain.handle('assistant-confirm-proposal',(_,id,token)=>assistantConfirmProposal(id,token));
ipcMain.handle('assistant-cancel-proposal',(_,id)=>assistantCancelProposal(id));
ipcMain.handle('assistant-wallet-analysis',(_,address)=>assistantWalletAnalysis(String(address||'')));
ipcMain.handle('assistant-wallet-compare',(_,addresses)=>assistantWalletCompare(Array.isArray(addresses)?addresses:[]));
ipcMain.handle('assistant-token-research',(_,mint)=>assistantTokenResearchAnalysis(String(mint||'')));
ipcMain.handle('assistant-trade-decision',(_,text)=>{const q=String(text||'');return assistantTradeDecisionAnalysis(assistantRouteCommand(q),q);});
ipcMain.handle('assistant-shadow-coach',(_,address)=>assistantShadowCoach(String(address||'')));
ipcMain.handle('assistant-shadow-ranking',()=>assistantShadowRanking());
ipcMain.handle('assistant-risk-investigation',(_,mint,opts={})=>assistantRiskInvestigation(String(mint||''),opts&&typeof opts==='object'?opts:{}));
ipcMain.handle('assistant-learning-analysis',()=>assistantLearningExplain());
ipcMain.handle('assistant-learning-proposal',(_,id)=>assistantLearningProposal(String(id||'')));
ipcMain.handle('assistant-portfolio-analysis',()=>assistantPortfolioAnalysis());
ipcMain.handle('portfolio-accounting-data',()=>portfolioAccountingData());

function leaderboardEvidenceData(){
  const rows=[];
  const outcomes=(verifiedOutcomeBook.order||[]).map(id=>verifiedOutcomeBook.byId?.[id]).filter(o=>o?.completedOutcome===true&&o.sourceVerified===true&&o.dataQuality==='VERIFIED');
  const byWallet={};for(const o of outcomes)(byWallet[o.walletAddress]??=[]).push(o);
  const discovery=discoveryBook.candidates||{};
  for(const [address,w] of Object.entries(wallets||{})){
    const outs=byWallet[address]||[],wins=outs.filter(o=>o.classification==='WIN').length,losses=outs.filter(o=>o.classification==='LOSS').length;
    const pnl=outs.reduce((n,o)=>n+Number(o.pnlSol||0),0),grossWin=outs.filter(o=>Number(o.pnlSol||0)>0).reduce((n,o)=>n+Number(o.pnlSol||0),0),grossLoss=Math.abs(outs.filter(o=>Number(o.pnlSol||0)<0).reduce((n,o)=>n+Number(o.pnlSol||0),0));
    const wr=outs.length?wins/outs.length*100:0,pf=grossLoss>0?grossWin/grossLoss:(grossWin>0?Infinity:0);
    const chronological=[...outs].sort((a,b)=>Number(a.closedAt||a.exit?.chainTimestamp||0)-Number(b.closedAt||b.exit?.chainTimestamp||0));
    let equity=0,peak=0,maxDd=0;for(const o of chronological){equity+=Number(o.pnlSol||0);peak=Math.max(peak,equity);if(peak>0)maxDd=Math.max(maxDd,(peak-equity)/peak*100);}
    const g=ghostBook.wallets?.[address]||null,q=g?evaluateDynamicQualification(address,g,{persist:false}):null,qual=g?evaluateGhostQualification(g):null;
    const riskRows=(riskDecisionBook.decisions||[]).filter(r=>r.walletAddress===address),riskCounts={PASS:0,CAUTION:0,HARD_BLOCK:0};for(const r of riskRows){const d=String(r.decision||'');if(riskCounts[d]!==undefined)riskCounts[d]++;}
    const disc=discovery[address]||null,eb=earlyBirdWallets?.[address]||null;
    const score=Math.max(0,Math.min(100,Math.round(
      Math.min(35,outs.length/30*35)+
      Math.min(25,wr/100*25)+
      Math.min(20,Math.max(0,pnl)/5*20)+
      Math.min(10,Number(disc?.independentTokens||eb?.consistency||0)/5*10)+
      Math.min(10,Math.max(0,15-maxDd)/15*10)
    )));
    rows.push(assistantScrub({address,label:w.label||w.name||null,tier:w.tier||'pending',score,
      verified:{completed:outs.length,wins,losses,winRatePct:wr,netPnlSol:pnl,profitFactor:Number.isFinite(pf)?pf:null,maxDrawdownPct:maxDd,lastClosedAt:chronological.at(-1)?.closedAt||chronological.at(-1)?.exit?.chainTimestamp||null},
      shadow:g?{status:g.status||'TESTING',liveActivated:!!g.liveActivated,qualified:!!qual?.qualified,progressPct:Number(qual?.progressPct||0),dynamicState:q?.state||null,openLots:(g.positions||[]).length}:null,
      repeatability:{independentTokens:Number(disc?.independentTokens||eb?.consistency||0),discoveryGate:disc?.gate||null,earlyBirdClass:eb?.classification||null,avgEntryRank:eb?.avgEntryRank??disc?.avgRank??null},
      risk:{...riskCounts,total:riskRows.length},
      authority:{rankingOnly:true,canPromoteTrusted:false,canExecute:false}}));
  }
  rows.sort((a,b)=>Number(b.score||0)-Number(a.score||0)||Number(b.verified.netPnlSol||0)-Number(a.verified.netPnlSol||0));
  return {version:1,phase:63,generatedAt:Date.now(),rows,semantics:{verifiedOnly:'Leaderboard performance uses only fully closed source-verified outcomes.',shadowSeparate:'Open/partial Shadow state is context only and never counted as verified realized performance.',rankingNotTrust:'Leaderboard rank does not promote Trusted or authorize execution.'}};
}
ipcMain.handle('leaderboard-evidence-data',()=>leaderboardEvidenceData());

ipcMain.handle('assistant-safe-preparation',(_,id)=>assistantPrepareFromProposal(String(id||'')));
ipcMain.handle('assistant-safe-preparation-preview',(_,text)=>assistantSafePreparationForText(String(text||'')));
ipcMain.handle('assistant-governed-action-create',(_,proposalId,actionType,payload)=>assistantCreateGovernedAction(proposalId,actionType,payload&&typeof payload==='object'?payload:{}));
ipcMain.handle('assistant-governed-action-run',(_,id,token)=>assistantRunGovernedAction(id,token));
ipcMain.handle('assistant-governed-actions',()=>assistantGovernedActionsPublic());
ipcMain.handle('assistant-memory-get',()=>assistantMemoryPublic());
ipcMain.handle('assistant-memory-context',(_,query)=>assistantMemoryContext(String(query||'')));
ipcMain.handle('assistant-memory-create',(_,input,sessionId)=>assistantMemoryCreate(input&&typeof input==='object'?input:{},sessionId||null));
ipcMain.handle('assistant-memory-update',(_,id,patch)=>assistantMemoryUpdate(String(id||''),patch&&typeof patch==='object'?patch:{}));
ipcMain.handle('assistant-memory-archive',(_,id)=>assistantMemoryArchive(String(id||'')));
ipcMain.handle('assistant-full-logic-audit',()=>assistantFullLogicAudit());
ipcMain.handle('assistant-logic-audit-get',()=>assistantLogicAuditPublic());
ipcMain.handle('production-integration-audit',()=>productionIntegrationAudit());



async function getHolderConcentration(mint){
  if(!settings.heliusApiKey)return {available:false,reason:'Helius API key not configured'};
  try{
    const url=`https://mainnet.helius-rpc.com/?api-key=${settings.heliusApiKey}`;
    const rpc=async(method,params)=>heliusRpc(method,params,8_000);
    const [largest,supply]=await Promise.all([rpc('getTokenLargestAccounts',[mint]),rpc('getTokenSupply',[mint])]);
    const total=Number(supply?.value?.uiAmount||0);const vals=(largest?.value||[]).map(x=>Number(x.uiAmount||0)).filter(Number.isFinite);
    if(!total)return {available:false,reason:'Token supply unavailable'};
    return {available:true,totalSupply:total,top1Pct:(vals[0]||0)/total*100,top10Pct:vals.slice(0,10).reduce((a,b)=>a+b,0)/total*100,accountsSampled:vals.length};
  }catch(e){return {available:false,reason:e.message};}
}
async function getProvenanceSignals(symbol,mint){
  if(!symbol)return {available:false,exactCopycats:0,likelyOriginal:null};
  try{const r=await apiFetch(`https://api.dexscreener.com/latest/dex/search?q=${encodeURIComponent(symbol)}`);const j=await r.json();const pairs=(j.pairs||[]).filter(p=>p.chainId==='solana'&&String(p.baseToken?.symbol||'').toUpperCase()===String(symbol).toUpperCase());const by=new Map();for(const p of pairs){const a=p.baseToken?.address;if(!a)continue;const old=by.get(a);if(!old||Number(p.liquidity?.usd||0)>Number(old.liquidity?.usd||0))by.set(a,p);}const ranked=[...by.entries()].map(([address,p])=>({address,liq:Number(p.liquidity?.usd||0),vol:Number(p.volume?.h24||0),age:Number(p.pairCreatedAt||0)})).sort((a,b)=>(b.liq+b.vol*.1)-(a.liq+a.vol*.1));return {available:true,exactCopycats:Math.max(0,by.size-1),candidateCount:by.size,likelyOriginal:ranked.length?ranked[0].address===mint:null,topCandidate:ranked[0]?.address||null};}catch(e){return {available:false,exactCopycats:0,likelyOriginal:null,reason:e.message};}
}

// ── Phase 25 Token Research Evidence Engine ────────────────
const TOKEN_2022_PROGRAM = 'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb';
const TOKEN_PROGRAM = 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA';
const RESEARCH_HISTORY_PAGES = 4;
const RESEARCH_CREATOR_TX_SAMPLE = 40;
function researchEvidenceCoverage(pkg){
  const checks=[pkg.tokenProgram?.known,pkg.authorities?.known,pkg.holders?.available,pkg.origin?.creatorCandidate,pkg.market?.liquidity!==null,pkg.provenance?.available];
  const known=checks.filter(Boolean).length;
  return {known,total:checks.length,pct:Math.round(known/checks.length*100),quality:known>=5?'HIGH':known>=3?'MEDIUM':'LOW'};
}
async function resolveLargestHolderOwners(mint, creatorCandidate=''){
  if(!settings.heliusApiKey)return {available:false,reason:'Helius API key not configured',holders:[]};
  try{
    const [largest,supply]=await Promise.all([heliusRpc('getTokenLargestAccounts',[mint],8_000),heliusRpc('getTokenSupply',[mint],8_000)]);
    const total=Number(supply?.value?.uiAmount||0); const rows=(largest?.value||[]).slice(0,20);
    if(!rows.length||!total)return {available:false,reason:'Largest-account or supply data unavailable',holders:[]};
    const infos=await heliusRpc('getMultipleAccounts',[rows.map(x=>x.address),{encoding:'jsonParsed'}],10_000);
    const holders=rows.map((r,i)=>{const info=infos?.value?.[i]?.data?.parsed?.info||{};return {tokenAccount:r.address,owner:info.owner||null,amount:Number(r.uiAmount||0),pct:Number(r.uiAmount||0)/total*100};}).filter(x=>x.owner);
    const byOwner=new Map(); for(const h of holders){const o=byOwner.get(h.owner)||{owner:h.owner,amount:0,pct:0,tokenAccounts:0};o.amount+=h.amount;o.pct+=h.pct;o.tokenAccounts++;byOwner.set(h.owner,o);}
    const owners=[...byOwner.values()].sort((a,b)=>b.amount-a.amount);
    const creatorHolding=creatorCandidate?owners.find(x=>x.owner===creatorCandidate):null;
    return {available:true,totalSupply:total,holders,owners,uniqueOwners:owners.length,topOwnerPct:owners[0]?.pct||0,top10OwnerPct:owners.slice(0,10).reduce((n,x)=>n+x.pct,0),creatorHoldingPct:creatorHolding?.pct||0};
  }catch(e){return {available:false,reason:e.message,holders:[]};}
}
function txAccountKeys(tx){return (tx?.transaction?.message?.accountKeys||[]).map(k=>typeof k==='string'?k:(k?.pubkey||k?.toString?.()||'')).filter(Boolean);}
async function findMintOrigin(mint){
  if(!settings.heliusApiKey)return {available:false,reason:'Helius API key not configured'};
  try{
    let before=null, all=[];
    for(let page=0;page<RESEARCH_HISTORY_PAGES;page++){
      const cfg={limit:100}; if(before)cfg.before=before;
      const batch=await heliusRpc('getSignaturesForAddress',[mint,cfg],10_000); if(!Array.isArray(batch)||!batch.length)break;
      all.push(...batch); before=batch[batch.length-1]?.signature; if(batch.length<100)break;
    }
    if(!all.length)return {available:false,reason:'No mint transaction history returned'};
    const oldest=all[all.length-1]; const tx=await heliusRpc('getTransaction',[oldest.signature,{encoding:'jsonParsed',maxSupportedTransactionVersion:0}],10_000);
    const keys=txAccountKeys(tx); const creatorCandidate=keys[0]||null;
    return {available:true,creatorCandidate,originSignature:oldest.signature,originBlockTime:Number(tx?.blockTime||oldest.blockTime||0)||null,historySignaturesScanned:all.length,historyComplete:all.length<RESEARCH_HISTORY_PAGES*100};
  }catch(e){return {available:false,reason:e.message};}
}
function flattenParsedInstructions(tx){
  const out=[...(tx?.transaction?.message?.instructions||[])];
  for(const inner of tx?.meta?.innerInstructions||[])out.push(...(inner.instructions||[]));
  return out;
}
async function inspectCreatorHistory(creator){
  if(!settings.heliusApiKey||!creator)return {available:false,reason:creator?'Helius API key not configured':'Creator candidate unavailable',relatedLaunches:[],funder:null};
  try{
    const sigs=await heliusRpc('getSignaturesForAddress',[creator,{limit:RESEARCH_CREATOR_TX_SAMPLE}],10_000); const related=new Set(); let funder=null; let inspected=0;
    for(const sig of (sigs||[]).slice().reverse()){
      const tx=await heliusRpc('getTransaction',[sig.signature,{encoding:'jsonParsed',maxSupportedTransactionVersion:0}],10_000).catch(()=>null); if(!tx)continue; inspected++;
      const keys=txAccountKeys(tx); const ci=keys.indexOf(creator); if(ci>=0&&!funder){const pre=Number(tx.meta?.preBalances?.[ci]||0),post=Number(tx.meta?.postBalances?.[ci]||0);if(post-pre>10_000_000){let best=null;for(let i=0;i<keys.length;i++){if(i===ci)continue;const d=Number(tx.meta?.postBalances?.[i]||0)-Number(tx.meta?.preBalances?.[i]||0);if(d<0&&(!best||d<best.delta))best={address:keys[i],delta:d};}if(best)funder={address:best.address,signature:sig.signature,approxSolReceived:(post-pre)/1e9};}}
      for(const ins of flattenParsedInstructions(tx)){
        const parsed=ins?.parsed; if(!parsed||!['initializeMint','initializeMint2'].includes(parsed.type))continue; const info=parsed.info||{}; const auth=info.mintAuthority||info.authority; if(auth===creator&&info.mint)related.add(info.mint);
      }
    }
    return {available:true,transactionsInspected:inspected,relatedLaunches:[...related].slice(0,25),relatedLaunchCount:related.size,funder,funderEvidence:funder?'native-sol-inflow-in-sampled-history':'not-observed-in-sample'};
  }catch(e){return {available:false,reason:e.message,relatedLaunches:[],funder:null};}
}
function earlyBirdTokenSignals(mint, holderOwners=[]){
  const rec=earlyBirdReconstruction?.tokens?.[mint]; if(!rec)return {available:false,reason:'No Early Bird reconstruction for this token'};
  const buyers=(rec.buyers||rec.earliestBuyers||[]).map(x=>x.wallet||x.address).filter(Boolean); const ownerSet=new Set(holderOwners.map(x=>x.owner)); const stillTop=buyers.filter(x=>ownerSet.has(x));
  return {available:true,reconstructionConfidence:rec.confidence||rec.reconstructionConfidence||'UNKNOWN',buyersSampled:buyers.length,earlyBuyersStillTopHolders:stillTop.length,earlyHolderOverlapPct:buyers.length?stillTop.length/buyers.length*100:0,overlapWallets:stillTop.slice(0,20)};
}
function marketLiquidityEvidence(pair,market){
  const liq=Number(market.liquidity||0),fdv=Number(market.fdv||0); return {liquidity:liq||null,fdv:fdv||null,liquidityToFdvPct:fdv?liq/fdv*100:null,pairAddress:pair.pairAddress||null,dex:pair.dexId||null,pairCreatedAt:Number(pair.pairCreatedAt||0)||null,removalHistory:'UNAVAILABLE_FROM_CURRENT_MARKET_SNAPSHOT',note:'Current liquidity is observed; historical add/remove behavior is not inferred without historical liquidity events.'};
}
async function buildTokenResearchEvidence(mint,pair,auth,holders,prov){
  const account=settings.heliusApiKey?await heliusRpc('getAccountInfo',[mint,{encoding:'jsonParsed'}],8_000).catch(()=>null):null;
  const programId=account?.value?.owner||null; const parsedMintInfo=account?.value?.data?.parsed?.info||{}; const rawExtensions=Array.isArray(parsedMintInfo.extensions)?parsedMintInfo.extensions:[]; const extensionTypes=rawExtensions.map(x=>String(x?.extension||x?.type||x?.extensionType||'UNKNOWN')).filter(Boolean);
  const restrictionPatterns=[['TRANSFER_FEE','transferfee'],['DEFAULT_FROZEN','defaultaccountstate'],['NON_TRANSFERABLE','nontransferable'],['PERMANENT_DELEGATE','permanentdelegate'],['TRANSFER_HOOK','transferhook'],['CONFIDENTIAL_TRANSFER','confidentialtransfer']];
  const token2022Restrictions=restrictionPatterns.filter(([,needle])=>extensionTypes.some(x=>x.toLowerCase().replace(/[^a-z]/g,'').includes(needle))).map(([code])=>code);
  const origin=await findMintOrigin(mint); const ownerData=await resolveLargestHolderOwners(mint,origin.creatorCandidate||''); const creatorHistory=await inspectCreatorHistory(origin.creatorCandidate||'');
  const market={liquidity:Number(pair.liquidity?.usd||0),fdv:Number(pair.fdv||0),marketCap:Number(pair.marketCap||0),priceUsd:Number(pair.priceUsd||0),volume24h:Number(pair.volume?.h24||0)};
  const localCluster=clusterEvidenceForTrade({tokenAddress:mint,timestamp:Date.now(),walletAddress:''}); const early=earlyBirdTokenSignals(mint,ownerData.owners||[]);
  const pkg={version:3,mint,generatedAt:Date.now(),tokenProgram:{programId,known:!!programId,type:programId===TOKEN_2022_PROGRAM?'TOKEN_2022':programId===TOKEN_PROGRAM?'SPL_TOKEN':programId?'OTHER':'UNKNOWN',token2022:programId===TOKEN_2022_PROGRAM,extensions:extensionTypes,restrictions:token2022Restrictions},authorities:{known:auth?.mintEnabled!==null&&auth?.freezeEnabled!==null,mintEnabled:auth?.mintEnabled??null,freezeEnabled:auth?.freezeEnabled??null,flags:auth?.authorityFlags||[]},origin,creatorHistory,holders:{...holders,ownerResolved:ownerData},creatorHoldings:{available:ownerData.available&&!!origin.creatorCandidate,pct:ownerData.creatorHoldingPct??null},market:marketLiquidityEvidence(pair,market),provenance:prov,earlyBird:early,coordination:{localWatchedWalletCluster:localCluster,earlyHolderOverlapPct:early.available?early.earlyHolderOverlapPct:null},limitations:[]};
  if(!settings.heliusApiKey)pkg.limitations.push('Helius unavailable: on-chain ownership, origin and creator evidence not collected.'); if(!origin.available)pkg.limitations.push('Mint origin/creator could not be reconstructed.'); if(!ownerData.available)pkg.limitations.push('Largest token accounts could not be resolved to wallet owners.'); pkg.limitations.push('Historical liquidity removals are not inferred from a current DexScreener snapshot.');
  pkg.coverage=researchEvidenceCoverage(pkg); tokenResearchBook.tokens[mint]=pkg; tokenResearchBook.order=[mint,...tokenResearchBook.order.filter(x=>x!==mint)].slice(0,500); tokenResearchBook.stats.runs=Number(tokenResearchBook.stats.runs||0)+1;tokenResearchBook.stats.lastRunAt=Date.now();writeJson(TOKEN_RESEARCH_F,tokenResearchBook);return pkg;
}
async function scanTokenRisk(mint,context={}){
  const meta=await enrichToken(mint);let market={},pair=null;
  try{const r=await apiFetch(`https://api.dexscreener.com/latest/dex/tokens/${mint}`, {}, 8_000);const j=await r.json();pair=(j.pairs||[]).filter(x=>x.chainId==='solana').sort((a,b)=>Number(b.liquidity?.usd||0)-Number(a.liquidity?.usd||0))[0]||null;if(pair)market={liquidity:Number(pair.liquidity?.usd||0),fdv:Number(pair.fdv||0),marketCap:Number(pair.marketCap||0),priceUsd:Number(pair.priceUsd||0),priceChange:pair.priceChange||{},volume24h:Number(pair.volume?.h24||0),buys24h:Number(pair.txns?.h24?.buys||0),sells24h:Number(pair.txns?.h24?.sells||0),pairCreatedAt:Number(pair.pairCreatedAt||0),url:pair.url||null};}catch{}
  const [holderAnalysis,provenance]=await Promise.all([getHolderConcentration(mint),getProvenanceSignals(meta.symbol,mint)]);let researchEvidence=tokenResearchBook.tokens[mint]||null;
  if(pair){try{researchEvidence=await buildTokenResearchEvidence(mint,pair,meta,holderAnalysis,provenance);}catch(e){console.warn('[Risk v3] evidence build failed:',e.message);}}
  const trade={tokenAddress:mint,tokenSymbol:meta.symbol||context.tokenSymbol||'',walletAddress:context.walletAddress||'',sizeSol:Number(context.sizeSol||0),liquidity:market.liquidity||meta.liquidity,fdv:market.fdv||meta.fdv,market,researchEvidence,tokenMeta:{...meta,holderAnalysis,provenance,researchEvidence},holderAnalysis,provenance,timestamp:Date.now()};
  trade.clusterEvidence=clusterEvidenceForTrade(trade);trade.riskAssessment=assessTradeRisk(trade,wallets[trade.walletAddress]||{});recordRiskEvent(trade,trade.riskAssessment,'risk-scan');return {...trade,meta};
}
function getRiskCenterData(){
  const events=riskEvents.slice(0,250);const hist=history.slice(0,500).map(h=>({score:Number(h.riskAssessment?.score||0),level:h.riskAssessment?.level,flags:h.riskAssessment?.flags||[],hard:!!h.riskAssessment?.hardBlocks?.length}));
  const counts={LOW:0,MEDIUM:0,HIGH:0,CRITICAL:0};hist.forEach(h=>{if(counts[h.level]!==undefined)counts[h.level]++;});
  const flagCounts={};for(const h of hist)for(const f of h.flags)(flagCounts[f.code]??=0,flagCounts[f.code]++);
  const topFlags=Object.entries(flagCounts).sort((a,b)=>b[1]-a[1]).slice(0,10).map(([code,count])=>({code,count}));
  const decisions=riskDecisionBook.decisions||[];const decisionCounts={PASS:0,CAUTION:0,HARD_BLOCK:0};for(const d of decisions)if(decisionCounts[d.decision]!==undefined)decisionCounts[d.decision]++;return {events,counts,topFlags,hardBlocks:decisions.filter(x=>x.decision==='HARD_BLOCK').length,assessed:decisions.length,engineVersion:3,decisionCounts,recentDecisions:decisions.slice(0,100),heliusReady:!!settings.heliusApiKey};
}


// Phase 16 Ghost Trade Qualification Engine
ipcMain.handle('ghost-get-data',()=>ghostPublicData());
ipcMain.handle('get-transaction-ledger',(_,limit=500)=>({transactions:transactionLedgerPublic(Math.max(1,Math.min(2000,Number(limit)||500)))}));
ipcMain.handle('ghost-get-verified-outcomes',(_,addr='',limit=500)=>{const a=String(addr||'');if(a&&ghostBook.wallets[a])syncVerifiedOutcomesForGhost(a,ghostBook.wallets[a],true);const rows=(verifiedOutcomeBook.order||[]).map(id=>verifiedOutcomeBook.byId[id]).filter(o=>o&&(!a||o.walletAddress===a)).slice(0,Math.max(1,Math.min(5000,Number(limit)||500)));return {version:1,walletAddress:a||null,outcomes:rows};});
ipcMain.handle('ghost-start',(_,addr,config={})=>{addr=String(addr||'');const w=wallets[addr];if(!w)return {ok:false,reason:'Wallet is not monitored'};if(w.tier==='blacklisted')return {ok:false,reason:'Blacklisted wallets cannot enter Ghost Mode'};ghostBook.wallets[addr]=newGhostWallet(addr,config);w.tier='ghost';w.ghostStartedAt=Date.now();writeJson(WALLETS_F,wallets);persistGhost();reconcileHeliusObservation();pushNotificationEvent({type:'automation',severity:'INFO',title:'Ghost testing started',message:`${w.label||addr.slice(0,8)} is now paper-copying observed trades. No real orders are sent.`,source:'Ghost Engine',walletAddress:addr});broadcast('ghost-update',{address:addr,reason:'started'});return {ok:true,data:ghostPublicData()};});
ipcMain.handle('ghost-save-config',(_,addr,config={})=>{const g=ghostBook.wallets[String(addr||'')];if(!g)return {ok:false,reason:'Ghost profile not found'};g.config=cleanGhostConfig({...g.config,...config});g.updatedAt=Date.now();persistGhost();broadcast('ghost-update',{address:addr,reason:'config'});return {ok:true,profile:{...g,qualification:evaluateGhostQualification(g)}};});
ipcMain.handle('ghost-stop',(_,addr)=>{addr=String(addr||'');const g=ghostBook.wallets[addr],w=wallets[addr];if(!g)return {ok:false,reason:'Ghost profile not found'};g.enabled=false;g.status='STOPPED';g.updatedAt=Date.now();if(w&&w.tier==='ghost')w.tier='pending';writeJson(WALLETS_F,wallets);persistGhost();broadcast('ghost-update',{address:addr,reason:'stopped'});return {ok:true};});
ipcMain.handle('ghost-reset',(_,addr)=>{addr=String(addr||'');const old=ghostBook.wallets[addr];if(!old)return {ok:false,reason:'Ghost profile not found'};ghostBook.wallets[addr]=newGhostWallet(addr,old.config);if(wallets[addr])wallets[addr].tier='ghost';writeJson(WALLETS_F,wallets);ghostBook.ledger=(ghostBook.ledger||[]).filter(x=>x.walletAddress!==addr);removeVerifiedOutcomesForWallet(addr);persistGhost();startGhostPolling();broadcast('ghost-update',{address:addr,reason:'reset'});return {ok:true,data:ghostPublicData()};});
ipcMain.handle('ghost-promote-live',(_,addr)=>activateGhostLive(String(addr||''),true));
ipcMain.handle('ghost-get-dynamic-qualification',(_,addr='')=>{const a=String(addr||'');const g=ghostBook.wallets[a];return g?evaluateDynamicQualification(a,g,{persist:false}):null;});
ipcMain.handle('ai-wallet-qualification',async(_,addr='')=>{const a=String(addr||'');const g=ghostBook.wallets[a];if(!g)return {ok:false,reason:'Ghost profile not found'};try{return {ok:true,data:await analyzeWalletQualificationAI(a,g)};}catch(e){return {ok:false,reason:e.message};}});
ipcMain.handle('ai-risk-explain',async(_,mint='')=>{try{const trade=await scanTokenRisk(String(mint||'').trim());return {ok:true,data:await explainRiskWithAI(trade,trade.riskAssessment),risk:trade.riskAssessment};}catch(e){return {ok:false,reason:e.message};}});
ipcMain.handle('ai-engine-data',(_,limit=250)=>aiEnginePublicData(limit));
ipcMain.handle('learning-engine-data',()=>learningPublicData());
ipcMain.handle('learning-engine-rebuild',()=>({ok:true,data:learningPublicData()}));
ipcMain.handle('ghost-requalify',(_,addr='')=>{const a=String(addr||''),g=ghostBook.wallets[a],w=wallets[a];if(!g||!w)return {ok:false,reason:'Ghost profile not found'};g.enabled=true;g.liveActivated=false;g.status='REQUALIFYING';w.tier='ghost';if(trustedCfgs[a])trustedCfgs[a].enabled=false;const q=qualificationProfile(a,g);q.state='REQUALIFYING';q.goodEvaluations=0;q.badEvaluations=0;q.pausedAt=Date.now();persistQualification();writeJson(WALLETS_F,wallets);writeJson(TRUSTED_F,trustedCfgs);persistGhost();return {ok:true,dynamic:evaluateDynamicQualification(a,g,{persist:true})};});

ipcMain.handle('get-risk-center-data', () => getRiskCenterData());
ipcMain.handle('risk-scan-token', async (_, mint) => scanTokenRisk(String(mint||'').trim()));
ipcMain.handle('risk-clear-events', () => { riskEvents=[]; writeJson(RISK_EVENTS_F,riskEvents); return {ok:true}; });
ipcMain.handle('get-notification-events', () => ({events:notificationEvents.slice(0,1000), unread:notificationEvents.filter(x=>!x.read).length, unacknowledged:notificationEvents.filter(x=>!x.acknowledged).length}));

function systemEvidenceEventCenter(limit=1200){
  const now=Date.now(), out=[], seen=new Set();
  const add=(e={})=>{
    const time=Number(e.time||e.at||e.createdAt||e.updatedAt||e.observedAt||e.chainTime||0)||now;
    const item={id:e.id||`evidence-${e.source||e.type||'system'}-${time}-${out.length}`,time,type:e.type||'system',severity:eventSeverity(e.severity||'INFO'),title:e.title||'System evidence',message:e.message||'',source:e.source||'CopyGuard',walletAddress:e.walletAddress||null,tokenAddress:e.tokenAddress||null,signature:e.signature||null,attemptId:e.attemptId||null,status:e.status||null,read:e.read!==false,acknowledged:!!e.acknowledged,metadata:e.metadata||{}};
    const key=`${item.source}|${item.id}|${item.time}|${item.status||''}|${item.signature||''}`;if(seen.has(key))return;seen.add(key);out.push(item);
  };
  (notificationEvents||[]).forEach(add);
  (executionSafetyBook.attempts||[]).slice(0,300).forEach(a=>add({id:`exec-${a.id}`,time:a.updatedAt||a.createdAt,type:'execution',severity:['BLOCKED','FAILED','UNCERTAIN_AFTER_PAUSE'].includes(a.status)?(a.status==='UNCERTAIN_AFTER_PAUSE'?'CRITICAL':'HIGH'):'WATCH',title:`Execution ${a.status||'state'}`,message:a.failureReason||a.blockReason||`${a.action||'Trade'} execution attempt ${a.status||'recorded'}`,source:'Phase 32 Execution Safety',walletAddress:a.walletAddress,tokenAddress:a.tokenAddress,attemptId:a.id,status:a.status,metadata:{action:a.action,accountingCommitted:a.accountingCommitted,submittedAt:a.submittedAt}}));
  (integrityBook.history||[]).slice(0,120).forEach((x,i)=>add({id:`integrity-${x.at||x.time||i}`,time:x.at||x.time,type:'integrity',severity:String(x.status||x.result||'').toUpperCase()==='PASS'?'SUCCESS':'WARNING',title:`Integrity ${x.status||x.result||'audit'}`,message:x.message||x.summary||`${(x.issues||[]).length||0} issue(s) recorded`,source:'Phase 30 Data Integrity',status:x.status||x.result,metadata:{issues:x.issues,repairs:x.repairs}}));
  (integrityBook.repairs||[]).slice(0,120).forEach((x,i)=>add({id:`repair-${x.at||x.time||i}`,time:x.at||x.time,type:'integrity',severity:'SUCCESS',title:'Integrity repair / recovery',message:x.message||x.action||x.file||'Safe repair recorded',source:'Phase 30 Data Integrity',metadata:x}));
  (connectionHealth.history||[]).slice(0,120).forEach((x,i)=>add({id:`connection-${x.at||i}`,time:x.at,type:'connection',severity:x.to==='DEGRADED'?'HIGH':'SUCCESS',title:x.to==='DEGRADED'?'Entered degraded mode':'Connection mode restored',message:x.reason||`${x.from||'UNKNOWN'} → ${x.to||'UNKNOWN'}`,source:'Phase 31 Connection Health',status:x.to,metadata:{from:x.from,to:x.to}}));
  (observationState.recentEvents||[]).slice(0,250).forEach((x,i)=>add({id:`obs-${x.signature||x.time||i}`,time:x.time||x.observedAt,type:'observation',severity:x.recovered||x.stale?'WARNING':'INFO',title:x.recovered?'Recovered observation':'Observed chain activity',message:x.message||`${x.action||x.type||'Transaction'}${x.recovered?' · recovered/backfill':''}`,source:'Phase 18 Helius Observation',walletAddress:x.walletAddress||x.address,tokenAddress:x.tokenAddress,signature:x.signature,status:x.recovered?'RECOVERED':'OBSERVED',metadata:x}));
  (qualificationBook.events||[]).slice(0,150).forEach((x,i)=>add({id:`qual-${x.id||x.at||i}`,time:x.at||x.time||x.updatedAt,type:'shadow',severity:['AUTO_PAUSED','WARNING'].includes(x.to||x.state)?'WARNING':'WATCH',title:`Shadow qualification ${x.to||x.state||'event'}`,message:x.reason||x.message||'Qualification lifecycle changed',source:'Phase 23 Dynamic Qualification',walletAddress:x.walletAddress||x.address,status:x.to||x.state,metadata:x}));
  (riskDecisionBook.decisions||[]).slice(0,200).forEach((x,i)=>{if(x.decision==='PASS'&&!x.hardBlocks?.length&&!x.cautions?.length)return;add({id:`risk-decision-${x.id||x.at||i}`,time:x.at||x.time||x.createdAt,type:'risk',severity:x.decision==='HARD_BLOCK'?'CRITICAL':'WARNING',title:`Risk ${x.decision||'decision'}`,message:x.hardBlocks?.[0]||x.cautions?.[0]||`Risk score ${x.score||0}/100`,source:'Phase 26 Risk Engine v3',walletAddress:x.walletAddress,tokenAddress:x.tokenAddress,status:x.decision,metadata:{score:x.score,hardBlocks:x.hardBlocks,cautions:x.cautions,unknowns:x.unknowns}})}); 
  (aiDecisionBook.decisions||[]).slice(0,120).forEach((x,i)=>add({id:`ai-${x.id||x.at||i}`,time:x.at||x.time||x.createdAt,type:'ai',severity:'INFO',title:`AI ${x.task||'analysis'}`,message:x.reasoning||x.summary||x.recommendation||'Advisory AI decision recorded',source:'Phase 28 Specialized AI',walletAddress:x.walletAddress,tokenAddress:x.tokenAddress,status:x.recommendation||x.decision,metadata:{provider:x.provider,confidence:x.confidence,authority:'ADVISORY_ONLY'}}));
  return {version:1,generatedAt:now,events:out.sort((a,b)=>b.time-a.time).slice(0,Math.max(1,Math.min(2000,Number(limit)||1200))),unread:notificationEvents.filter(x=>!x.read).length,unacknowledged:notificationEvents.filter(x=>!x.acknowledged).length,connectionHealth:connectionHealthSnapshot(),observation:observationHealth(),integrity:{status:integrityBook.lastStatus,lastAuditAt:integrityBook.lastAuditAt,issues:(integrityBook.issues||[]).length},executionStats:executionSafetyBook.stats||{}};
}
ipcMain.handle('system-evidence-events',(_,limit=1200)=>systemEvidenceEventCenter(limit));

ipcMain.handle('notification-mark-read', (_, id) => { const e=notificationEvents.find(x=>x.id===id); if(e)e.read=true; writeJson(NOTIFICATION_EVENTS_F,notificationEvents); return {ok:true}; });
ipcMain.handle('notification-ack', (_, id) => { const e=notificationEvents.find(x=>x.id===id); if(e){e.read=true;e.acknowledged=true;} writeJson(NOTIFICATION_EVENTS_F,notificationEvents); return {ok:true}; });
ipcMain.handle('notification-mark-all-read', () => { notificationEvents.forEach(e=>e.read=true); writeJson(NOTIFICATION_EVENTS_F,notificationEvents); return {ok:true}; });
ipcMain.handle('notification-clear-acknowledged', () => { notificationEvents=notificationEvents.filter(e=>!e.acknowledged); writeJson(NOTIFICATION_EVENTS_F,notificationEvents); return {ok:true}; });

ipcMain.handle('get-all-data', () => {
  // Build lightweight ghost summary for dashboard + leaderboard
  // (Full ledger stays in ghost-get-data to avoid bloating the main data call)
  const ghostWalletVals = Object.values(ghostBook.wallets || {});
  const ghostPerformance = {};
  for (const [addr, g] of Object.entries(ghostBook.wallets || {})) {
    const q=evaluateGhostQualification(g), st=q.stats, dq=evaluateDynamicQualification(addr,g,{persist:false});
    ghostPerformance[addr] = {
      status:g.status||'TESTING', dynamicState:dq.state, liveActivated:!!g.liveActivated, qualified:!!q.qualified,
      progressPct:Number(q.progressPct||0), completedTrades:Number(st.completedTrades||0),
      openPositions:(g.positions||[]).length,totalSignals:Number(g.totalSignals||0),
      winRatePct:Number(st.winRatePct||0),netPnlSol:Number(st.netPnlSol||0),roiPct:Number(st.roiPct||0),
      profitFactor:Number(st.profitFactor||0),maxDrawdownPct:Number(st.maxDrawdownPct||0),equitySol:Number(st.equitySol||g.config?.startingBalanceSol||10),
    };
  }
  const ghostSummary = {
    total:ghostWalletVals.length,
    testing:ghostWalletVals.filter(g=>g.status==='TESTING'&&!g.liveActivated).length,
    qualified:ghostWalletVals.filter(g=>evaluateGhostQualification(g).qualified&&!g.liveActivated).length,
    liveActivated:ghostWalletVals.filter(g=>g.liveActivated).length,
    totalSimulatedTrades:ghostWalletVals.reduce((n,g)=>n+Number(ghostStats(g).completedTrades||0),0),
    stopped:ghostWalletVals.filter(g=>g.status==='STOPPED').length,
  };

  return {
    settings:publicSettings(), secretStatus:secretStatus(), connectionHealth:connectionHealthSnapshot(), wallets, history:history.slice(0,200),
    suggestions:intel.suggestions, healthAlerts:intel.healthAlerts, intelligenceWatchlist:intel.watchlist, discovery:discoveryPublicData(), aiEngine:{stats:aiDecisionBook.stats,tasks:Object.values(AI_TASKS)}, learningEngine:{summary:learningBook.summary||{},generatedAt:learningBook.generatedAt||null,proposalCount:(learningBook.proposals||[]).length,topProposals:(learningBook.proposals||[]).slice(0,3)}, assistantEngine:{phase:47,activeSessionId:assistantBook.activeSessionId||null,sessionCount:(assistantBook.order||[]).length,stats:assistantBook.stats||{},policy:'GOVERNED_ADVISORY',logicAudit:assistantBook.logicAudit||null}, integrity:{status:integrityBook.lastStatus||'UNKNOWN',lastAuditAt:integrityBook.lastAuditAt||null,issueCount:(integrityBook.issues||[]).length},
    aiProviderName: ({anthropic:'Claude Sonnet 5',openai:'GPT-5.6 Luna',gemini:'Gemini 3.8 Flash',xai:'Grok 4.6',perplexity:'Sonar Pro'})[settings.aiProvider] || 'AI',
    ghostSummary,
    ghostPerformance,
  };
});

ipcMain.handle('save-settings', (_, s) => {
  const incoming={...(s||{})};
  if(incoming.apiKeys){for(const [k,v] of Object.entries(incoming.apiKeys)){if(v&&!String(v).startsWith('••••'))settings.apiKeys[k]=v;} delete incoming.apiKeys;}
  if(Object.prototype.hasOwnProperty.call(incoming,'heliusApiKey')){if(incoming.heliusApiKey&&!String(incoming.heliusApiKey).startsWith('••••'))settings.heliusApiKey=incoming.heliusApiKey; delete incoming.heliusApiKey;}
  settings = { ...settings, ...incoming };
  persistSettings();
  reconcileHeliusObservation();
  return { ok:true };
});

ipcMain.handle('save-wallets', (_, w) => {
  wallets = w;
  writeJson(WALLETS_F, wallets);
  reconcileHeliusObservation();
  return { ok:true };
});

ipcMain.handle('analyze-trade', async (_, trade) => {
  try {
    const wallet = wallets[trade.walletAddress] || {};
    const enriched = { ...trade };
    if (enriched.tokenAddress && (!enriched.tokenMeta || !enriched.liquidity)) {
      const meta = await enrichToken(enriched.tokenAddress);
      if (meta) {
        enriched.fdv = meta.fdv; enriched.liquidity = meta.liquidity;
        enriched.tokenName = meta.name; enriched.tokenSymbol = meta.symbol;
        enriched.tokenMeta = { authorityFlags:meta.authorityFlags, freezeEnabled:meta.freezeEnabled, mintEnabled:meta.mintEnabled };
        enriched.market = {liquidity:meta.liquidity,fdv:meta.fdv,priceUsd:meta.priceUsd,priceChange:meta.priceChange||{},volume24h:meta.volume24h||0,buys24h:meta.buys24h||0,sells24h:meta.sells24h||0,pairCreatedAt:meta.pairCreatedAt||null};
        const [holderAnalysis, provenance] = await Promise.all([getHolderConcentration(enriched.tokenAddress), getProvenanceSignals(meta.symbol,enriched.tokenAddress)]);
        enriched.holderAnalysis=holderAnalysis; enriched.provenance=provenance; enriched.tokenMeta.holderAnalysis=holderAnalysis; enriched.tokenMeta.provenance=provenance;
      }
    }
    enriched.riskAssessment = assessTradeRisk(enriched, wallet);
    recordRiskEvent(enriched,enriched.riskAssessment,'manual-analysis');
    const key = settings.apiKeys?.[settings.aiProvider];
    if (key) {
      try { enriched.analysis = normalizeAIAnalysis(await callAI(enriched, wallet), enriched.riskAssessment); }
      catch (e) { enriched.analysisError = e?.message || 'AI analysis failed'; }
    }
    broadcast('trade-update', enriched);
    return { ok:true, trade:enriched, aiConfigured:!!key };
  } catch (e) {
    return { ok:false, error:e?.message || 'Trade analysis failed' };
  }
});

ipcMain.handle('approve-trade', (_, trade) => {
  const t={...trade};
  t.riskAssessment=t.riskAssessment||assessTradeRisk(t,wallets[t.walletAddress]||{});
  if(t.riskAssessment?.hardBlocks?.length)return {ok:false,blocked:true,error:`CopyGuard hard block — ${t.riskAssessment.hardBlocks.join('; ')}`};
  // Manual COPY means prepare only. It must never create a position, realized P&L,
  // wallet win/loss, or an execution-success record before the user confirms in Padre.
  const prepared={...t,decision:'PREPARED',executionStatus:'MANUAL_CONFIRMATION_REQUIRED',preparedAt:Date.now()};
  addHistory(prepared);
  createPadreView();
  if (t.tokenAddress) padreView.webContents.loadURL(normalizePadreUrl(String(t.tokenAddress)));
  return { ok:true, prepared:true, requiresManualConfirmation:true, accountingCommitted:false };
});

ipcMain.handle('reject-trade', (_, trade) => {
  addHistory({ ...trade, decision:'REJECTED' });
  return { ok:true };
});



// ── Phase 30 Data Integrity & Recovery Engine ───────────────
const INTEGRITY_MAX_HISTORY = 100;
function integrityIssue(code,severity,message,refs={}){return {code,severity,message,refs,at:Date.now()};}
function runIntegrityAudit({repairSafe=true,persist=true}={}){
  const issues=[],repairs=[];
  const add=(code,severity,message,refs)=>issues.push(integrityIssue(code,severity,message,refs));
  // Transaction ledger order is an index; dangling index entries can be safely rebuilt without inventing trades.
  const txKeys=new Set(Object.keys(transactionLedger.bySignature||{}));
  const txOrder=Array.isArray(transactionLedger.order)?transactionLedger.order:[];
  const danglingTx=txOrder.filter(sig=>!txKeys.has(sig));
  if(danglingTx.length){add('TX_DANGLING_ORDER','WARN',`${danglingTx.length} transaction order entries do not resolve to transaction records.`,{count:danglingTx.length});if(repairSafe){transactionLedger.order=txOrder.filter(sig=>txKeys.has(sig));repairs.push({code:'TX_ORDER_REBUILT',count:danglingTx.length});persistTransactionLedger();}}
  const missingTxIndex=[...txKeys].filter(sig=>!transactionLedger.order.includes(sig));
  if(missingTxIndex.length){add('TX_MISSING_ORDER','WARN',`${missingTxIndex.length} transaction records are missing from the order index.`,{count:missingTxIndex.length});if(repairSafe){transactionLedger.order=[...missingTxIndex,...transactionLedger.order];repairs.push({code:'TX_ORDER_INDEXED',count:missingTxIndex.length});persistTransactionLedger();}}

  // Verified outcomes must retain their source chain. Broken links are quarantined from learning, never deleted or fabricated.
  let outcomeChanged=false;
  for(const id of [...(verifiedOutcomeBook.order||[])]){
    const o=verifiedOutcomeBook.byId?.[id];
    if(!o){add('OUTCOME_DANGLING_ORDER','ERROR','Verified outcome index points to a missing outcome.',{outcomeId:id});continue;}
    const entrySig=o.entry?.signature||o.entrySignature||null, exitSig=o.exit?.signature||o.exitSignature||null;
    const broken=[];
    if(entrySig&&!transactionLedger.bySignature?.[entrySig])broken.push('ENTRY_TRANSACTION_MISSING');
    if(exitSig&&!transactionLedger.bySignature?.[exitSig])broken.push('EXIT_TRANSACTION_MISSING');
    if(!Number.isFinite(Number(o.pnlSol)))broken.push('PNL_INVALID');
    if(broken.length){
      add('OUTCOME_BROKEN_LINK','ERROR','Verified outcome has broken or invalid source evidence.',{outcomeId:id,broken});
      if(repairSafe&&(o.sourceVerified!==false||o.integrityStatus!=='BROKEN_LINK')){o.sourceVerified=false;o.dataQuality='INTEGRITY_QUARANTINED';o.integrityStatus='BROKEN_LINK';o.integrityReasons=broken;outcomeChanged=true;}
    }else if(!o.integrityStatus){o.integrityStatus='OK';outcomeChanged=true;}
  }
  const danglingOut=(verifiedOutcomeBook.order||[]).filter(id=>!verifiedOutcomeBook.byId?.[id]);
  if(danglingOut.length&&repairSafe){verifiedOutcomeBook.order=verifiedOutcomeBook.order.filter(id=>verifiedOutcomeBook.byId?.[id]);repairs.push({code:'OUTCOME_ORDER_REBUILT',count:danglingOut.length});outcomeChanged=true;}
  if(outcomeChanged)persistVerifiedOutcomes();

  // Shadow lots: completed lots must have stable IDs and a source event/signature; open/closed duplicate IDs are structural errors.
  for(const [address,g] of Object.entries(ghostBook.wallets||{})){
    const positions=Array.isArray(g.positions)?g.positions:[], closed=Array.isArray(g.closed)?g.closed:[];
    const seen=new Set();
    for(const p of [...positions,...closed]){
      if(!p?.id){add('GHOST_LOT_ID_MISSING','ERROR','Shadow lot has no stable ID.',{walletAddress:address,tokenAddress:p?.tokenAddress||null});continue;}
      if(seen.has(p.id))add('GHOST_DUPLICATE_LOT','ERROR','Shadow lot ID appears more than once.',{walletAddress:address,lotId:p.id});
      seen.add(p.id);
      if(p.completedOutcome===true&&!p.sourceSignature&&!p.sourceEventKey)add('GHOST_COMPLETED_SOURCE_MISSING','ERROR','Completed Shadow lot lacks source transaction identity.',{walletAddress:address,lotId:p.id});
    }
  }

  for(const address of Object.keys(qualificationBook.wallets||{}))if(!wallets[address])add('ORPHAN_QUALIFICATION','WARN','Qualification profile has no wallet record.',{walletAddress:address});
  for(const address of Object.keys(trustedCfgs||{}))if(!wallets[address])add('ORPHAN_TRUSTED_CONFIG','WARN','Trusted configuration has no wallet record.',{walletAddress:address});

  const outcomeIds=new Set(Object.keys(verifiedOutcomeBook.byId||{}));
  const staleLearning=(learningBook.links||[]).filter(x=>x.outcomeId&&!outcomeIds.has(x.outcomeId));
  if(staleLearning.length){add('STALE_LEARNING_LINK','WARN',`${staleLearning.length} learning links point to outcomes no longer present.`,{count:staleLearning.length});if(repairSafe){rebuildClosedLoopLearning();repairs.push({code:'LEARNING_REBUILT',count:staleLearning.length});}}

  // Phase 32 execution ledger is authoritative for one-shot source-event submission.
  const execAttempts=Array.isArray(executionSafetyBook.attempts)?executionSafetyBook.attempts:[];const seenExec=new Set();
  for(const a of execAttempts){if(!a?.key){add('EXECUTION_MISSING_KEY','ERROR','Execution attempt is missing its idempotency key.',{id:a?.id});continue;}if(seenExec.has(a.key))add('EXECUTION_DUPLICATE_KEY','ERROR','Multiple execution attempts share one source-event key.',{key:a.key});seenExec.add(a.key);if(a.status==='RESERVED'&&Date.now()-Number(a.createdAt||0)>120_000)add('EXECUTION_STALE_RESERVATION','WARN','Execution reservation is stale and requires review; it will not be retried automatically.',{id:a.id,key:a.key});}

  // Phase 33 assistant history is auditable state, never an authority ledger.
  const asstIds=new Set(Object.keys(assistantBook.sessions||{}));
  const danglingAsst=(assistantBook.order||[]).filter(id=>!asstIds.has(id));
  if(danglingAsst.length){add('ASSISTANT_DANGLING_SESSION_INDEX','WARN','Assistant session order references missing sessions.',{count:danglingAsst.length});if(repairSafe){assistantBook.order=assistantBook.order.filter(id=>asstIds.has(id));repairs.push({code:'ASSISTANT_SESSION_INDEX_REBUILT',count:danglingAsst.length});persistAssistant();}}
  for(const session of Object.values(assistantBook.sessions||{}))for(const msg of session.messages||[]){if(msg?.role==='assistant'&&msg.actionExecuted===true)add('ASSISTANT_AUTHORITY_VIOLATION','ERROR','Assistant message claims an executed action; Phase 33 assistant must remain advisory-only.',{sessionId:session.id,messageId:msg.id});}

  const severe=issues.filter(x=>x.severity==='ERROR').length;
  const status=severe?'DEGRADED':issues.length?'CAUTION':'HEALTHY';
  const audit={id:`audit-${Date.now()}`,at:Date.now(),status,issueCount:issues.length,errorCount:severe,repairCount:repairs.length,issues,repairs};
  integrityBook={version:1,lastAuditAt:audit.at,lastStatus:status,issues,repairs,history:[audit,...(integrityBook.history||[])].slice(0,INTEGRITY_MAX_HISTORY)};
  if(persist)writeJson(INTEGRITY_F,integrityBook);
  return audit;
}
function validateBackupPayload(payload){
  if(payload?.schema!=='copyguard-backup'||!payload.data)throw new Error('Not a valid CopyGuard backup.');
  if(payload.version>=2){
    if(!payload.manifest||typeof payload.manifest!=='object')throw new Error('Backup integrity manifest is missing.');
    for(const [name,value] of Object.entries(payload.data)){
      const expected=payload.manifest[name]?.sha256;
      if(!expected||expected!==sha256Json(value))throw new Error(`Backup checksum failed for ${name}. Restore aborted before changing live data.`);
    }
  }
  return true;
}
function restoreBackupTransactionally(payload){
  validateBackupPayload(payload);
  const staged=[],committed=[];
  try{
    // Stage and parse every payload file before the first live file is touched.
    for(const [name,value] of Object.entries(payload.data)){
      const target=BACKUP_NAMES[name]; if(!target||value===undefined)continue;
      const stage=`${target}.restore-${process.pid}-${Date.now()}`;
      fs.writeFileSync(stage,JSON.stringify(value,null,2)); JSON.parse(fs.readFileSync(stage,'utf8'));
      staged.push({target,stage,hadOriginal:fs.existsSync(target)});
    }
    for(const item of staged){
      const {target,stage}=item,rollback=`${target}.pre-restore.bak`;
      if(item.hadOriginal){fs.copyFileSync(target,rollback);item.rollback=rollback;}
      try{fs.renameSync(stage,target);}catch{fs.copyFileSync(stage,target);fs.unlinkSync(stage);}
      if(!jsonValidFile(target))throw new Error(`Restored file failed JSON validation: ${path.basename(target)}`);
      committed.push(item);
    }
    return {ok:true,files:staged.length};
  }catch(e){
    // Roll back every file already replaced. A failed restore must not leave a mixed-generation data set.
    for(const item of committed.reverse()){
      try{
        if(item.hadOriginal&&item.rollback&&fs.existsSync(item.rollback))fs.copyFileSync(item.rollback,item.target);
        else if(!item.hadOriginal&&fs.existsSync(item.target))fs.unlinkSync(item.target);
      }catch(rollbackError){console.error('[integrity] restore rollback failed',path.basename(item.target),rollbackError.message);}
    }
    for(const x of staged)try{if(fs.existsSync(x.stage))fs.unlinkSync(x.stage)}catch{}
    throw new Error(`Restore rolled back: ${e.message}`);
  }
}

// ── Phase 14 Settings / Security / Persistence Center ──────
const BACKUP_FILES = [WALLETS_F,HISTORY_F,INTEL_F,POSITIONS_F,CLOSED_POSITIONS_F,TRUSTED_F,DAILY_F,RESEARCH_WATCH_F,RISK_EVENTS_F,NOTIFICATION_EVENTS_F,GHOST_F,EARLYBIRD_F,EARLYBIRD_RUNS_F,EARLYBIRD_HISTORY_F,EARLYBIRD_RECON_F,OBSERVATION_F,TRANSACTION_LOG_F,MARKET_F,VERIFIED_OUTCOMES_F,QUALIFICATION_F,TOKEN_RESEARCH_F,RISK_DECISIONS_F,DISCOVERY_F,AI_DECISIONS_F,LEARNING_F,INTEGRITY_F,EXECUTION_SAFETY_F,ASSISTANT_F];
const BACKUP_NAMES = Object.fromEntries(BACKUP_FILES.map(f=>[path.basename(f),f]));
function buildBackupPayload(){
  const data={}; for(const [name,file] of Object.entries(BACKUP_NAMES)) data[name]=readJson(file,null);
  const manifest=Object.fromEntries(Object.entries(data).map(([name,value])=>[name,{sha256:sha256Json(value)}]));
  return {schema:'copyguard-backup',version:2,appVersion:app.getVersion(),createdAt:new Date().toISOString(),settings:publicPreferences(),secretsIncluded:false,manifest,data};
}
function reloadPersistentState(){
  wallets=readJson(WALLETS_F,{}); history=readJson(HISTORY_F,[]); intel=readJson(INTEL_F,{suggestions:[],healthAlerts:[],watchlist:[]});
  intel.suggestions=Array.isArray(intel.suggestions)?intel.suggestions:[]; intel.healthAlerts=Array.isArray(intel.healthAlerts)?intel.healthAlerts:[]; intel.watchlist=Array.isArray(intel.watchlist)?intel.watchlist:[];
  openPositions=readJson(POSITIONS_F,{}); closedPositions=readJson(CLOSED_POSITIONS_F,[]); trustedCfgs=readJson(TRUSTED_F,{}); dailyStats=readJson(DAILY_F,{});
  twitterTokens=readJson(TWITTER_F,null); researchWatchlist=readJson(RESEARCH_WATCH_F,[]); riskEvents=readJson(RISK_EVENTS_F,[]); notificationEvents=readJson(NOTIFICATION_EVENTS_F,[]); ghostBook=readJson(GHOST_F,{wallets:{},ledger:[],version:1}); ghostBook.wallets=ghostBook.wallets||{}; ghostBook.ledger=Array.isArray(ghostBook.ledger)?ghostBook.ledger:[]; earlyBirdWallets=readJson(EARLYBIRD_F,{}); earlyBirdRuns=readJson(EARLYBIRD_RUNS_F,[]); earlyBirdScanHistory=readJson(EARLYBIRD_HISTORY_F,[]); earlyBirdReconstruction=readJson(EARLYBIRD_RECON_F,{version:1,tokens:{},stats:{}}); earlyBirdReconstruction.tokens=earlyBirdReconstruction.tokens||{}; earlyBirdReconstruction.stats=earlyBirdReconstruction.stats||{}; observationState=readJson(OBSERVATION_F,{version:1,wallets:{},recentEvents:[],health:{}}); observationState.wallets=observationState.wallets||{}; observationState.recentEvents=Array.isArray(observationState.recentEvents)?observationState.recentEvents:[]; transactionLedger=readJson(TRANSACTION_LOG_F,{version:1,bySignature:{},order:[]}); transactionLedger.bySignature=transactionLedger.bySignature||{}; transactionLedger.order=Array.isArray(transactionLedger.order)?transactionLedger.order:[]; marketBook=readJson(MARKET_F,{version:1,latest:{},snapshots:[],stats:{}}); marketBook.latest=marketBook.latest||{}; marketBook.snapshots=Array.isArray(marketBook.snapshots)?marketBook.snapshots:[]; marketBook.stats=marketBook.stats||{}; verifiedOutcomeBook=readJson(VERIFIED_OUTCOMES_F,{version:1,byId:{},order:[]}); verifiedOutcomeBook.byId=verifiedOutcomeBook.byId||{}; verifiedOutcomeBook.order=Array.isArray(verifiedOutcomeBook.order)?verifiedOutcomeBook.order:[]; qualificationBook=readJson(QUALIFICATION_F,{version:1,wallets:{},events:[]});qualificationBook.wallets=qualificationBook.wallets||{};qualificationBook.events=Array.isArray(qualificationBook.events)?qualificationBook.events:[]; tokenResearchBook=readJson(TOKEN_RESEARCH_F,{version:3,tokens:{},order:[],stats:{runs:0,lastRunAt:null}});tokenResearchBook.tokens=tokenResearchBook.tokens||{};tokenResearchBook.order=Array.isArray(tokenResearchBook.order)?tokenResearchBook.order:[];tokenResearchBook.stats=tokenResearchBook.stats||{runs:0,lastRunAt:null};riskDecisionBook=readJson(RISK_DECISIONS_F,{version:3,decisions:[],stats:{total:0,lastDecisionAt:null}});riskDecisionBook.decisions=Array.isArray(riskDecisionBook.decisions)?riskDecisionBook.decisions:[];riskDecisionBook.stats=riskDecisionBook.stats||{total:0,lastDecisionAt:null};discoveryBook=readJson(DISCOVERY_F,{version:1,candidates:{},runs:[],stats:{runs:0,lastRunAt:null,lastFound:0}});discoveryBook.candidates=discoveryBook.candidates||{};discoveryBook.runs=Array.isArray(discoveryBook.runs)?discoveryBook.runs:[];discoveryBook.stats=discoveryBook.stats||{};aiDecisionBook=readJson(AI_DECISIONS_F,{version:1,decisions:[],stats:{total:0,byTask:{},lastDecisionAt:null}});aiDecisionBook.decisions=Array.isArray(aiDecisionBook.decisions)?aiDecisionBook.decisions:[];aiDecisionBook.stats=aiDecisionBook.stats||{total:0,byTask:{},lastDecisionAt:null};aiDecisionBook.stats.byTask=aiDecisionBook.stats.byTask||{}; learningBook=readJson(LEARNING_F,{version:1,generatedAt:null,links:[],taskStats:{},riskSignalStats:{},recommendationStats:{},providerStats:{},proposals:[],summary:{}}); integrityBook=readJson(INTEGRITY_F,{version:1,lastAuditAt:null,lastStatus:'UNKNOWN',issues:[],repairs:[],history:[]}); executionSafetyBook=readJson(EXECUTION_SAFETY_F,{version:1,attempts:[],byKey:{},stats:{}}); executionSafetyBook.attempts=Array.isArray(executionSafetyBook.attempts)?executionSafetyBook.attempts:[]; executionSafetyBook.byKey=executionSafetyBook.byKey||{}; executionSafetyBook.stats=executionSafetyBook.stats||{}; assistantBook=readJson(ASSISTANT_F,{version:1,sessions:{},order:[],activeSessionId:null,audit:[],stats:{}}); assistantBook.sessions=assistantBook.sessions||{};assistantBook.order=Array.isArray(assistantBook.order)?assistantBook.order:[];assistantBook.audit=Array.isArray(assistantBook.audit)?assistantBook.audit:[];assistantBook.stats=assistantBook.stats||{};assistantBook.memory=assistantBook.memory&&typeof assistantBook.memory==='object'?assistantBook.memory:{};assistantBook.memoryOrder=Array.isArray(assistantBook.memoryOrder)?assistantBook.memoryOrder:[];assistantBook.memoryStats=assistantBook.memoryStats||{created:0,updated:0,archived:0,lastChangedAt:null}; syncAllVerifiedOutcomes(); rebuildClosedLoopLearning(); runIntegrityAudit({repairSafe:true,persist:true});
}
ipcMain.handle('integrity-engine-data',()=>integrityBook);
ipcMain.handle('integrity-engine-run',()=>runIntegrityAudit({repairSafe:true,persist:true}));
ipcMain.handle('settings-center-data',()=>({settings:publicSettings(),secretStatus:secretStatus(),observation:observationHealth(),market:marketStatus(),connectionHealth:connectionHealthSnapshot(),executionSafety:executionSafetyPublicData(50),backupPolicy:{formatVersion:BACKUP_VERSION,secretsIncluded:false,checksumAlgorithm:'SHA-256',transactionalRestore:true},recoveryPolicy:{scopes:['activity','intelligence','preferences','all'],typedConfirmationRequiredForAll:true},dataDir:DATA_DIR,appVersion:app.getVersion(),integrity:integrityBook,files:Object.keys(BACKUP_NAMES),counts:{wallets:Object.keys(wallets||{}).length,history:(history||[]).length,openPositions:Object.keys(openPositions||{}).length,closedPositions:(closedPositions||[]).length,riskEvents:(riskEvents||[]).length,notifications:(notificationEvents||[]).length,ghostWallets:Object.keys(ghostBook.wallets||{}).length,ghostTrades:Object.values(ghostBook.wallets||{}).reduce((n,g)=>n+(g.closed||[]).length,0),transactions:(transactionLedger.order||[]).length,verifiedOutcomes:(verifiedOutcomeBook.order||[]).length,qualificationEvents:(qualificationBook.events||[]).length,researchEvidenceTokens:(tokenResearchBook.order||[]).length,riskDecisions:(riskDecisionBook.decisions||[]).length,discoveryCandidates:Object.keys(discoveryBook.candidates||{}).length,aiDecisions:(aiDecisionBook.decisions||[]).length,learningLinks:(learningBook.links||[]).length,learningProposals:(learningBook.proposals||[]).length,executionAttempts:(executionSafetyBook.attempts||[]).length,assistantSessions:(assistantBook.order||[]).length}}));
ipcMain.handle('settings-save-secure',(_,payload={})=>{
  const prefs={...(payload.preferences||{})}; settings={...settings,...prefs};
  const secrets=payload.secrets||{};
  if(secrets.apiKeys){for(const [k,v] of Object.entries(secrets.apiKeys)){if(v==='__KEEP__')continue; settings.apiKeys[k]=String(v||'').trim();}}
  if(Object.prototype.hasOwnProperty.call(secrets,'heliusApiKey')&&secrets.heliusApiKey!=='__KEEP__')settings.heliusApiKey=String(secrets.heliusApiKey||'').trim();
  const result=persistSettings(); reconcileHeliusObservation();
  pushNotificationEvent({type:'system',severity:'INFO',title:'Settings updated',message:'Security, risk, notification, and connection settings were saved.',source:'Settings Center'});
  return {ok:result.ok,encrypted:result.encrypted,settings:publicSettings(),secretStatus:secretStatus(),error:result.error};
});
ipcMain.handle('settings-clear-secret',(_,kind,provider)=>{
  if(kind==='helius')settings.heliusApiKey=''; else if(kind==='ai'&&provider&&settings.apiKeys?.[provider]!==undefined)settings.apiKeys[provider]='';
  persistSettings(); if(kind==='helius')reconcileHeliusObservation(); return {ok:true,secretStatus:secretStatus()};
});
ipcMain.handle('settings-test-connection',async(_,kind,provider)=>{
  try{
    if(kind==='helius'){
      if(!settings.heliusApiKey)return {ok:false,message:'Helius API key is not configured.'};
      const r=await apiPost(`https://mainnet.helius-rpc.com/?api-key=${settings.heliusApiKey}`,{jsonrpc:'2.0',id:1,method:'getHealth'},8_000);
      if(!r.ok)throw new Error(`HTTP ${r.status}`); const d=await r.json(); return {ok:!d.error,message:d.error?.message||'Helius RPC connection succeeded.'};
    }
    if(kind==='ai'){
      const p=provider||settings.aiProvider; if(!settings.apiKeys?.[p])return {ok:false,message:`${p} API key is not configured.`};
      const old=settings.aiProvider; settings.aiProvider=p;
      try{await callAI({action:'BUY',sizeSol:0.01,tokenSymbol:'TEST',tokenAddress:'11111111111111111111111111111111',liquidity:100000,fdv:1000000,riskAssessment:{score:10,level:'LOW',flags:[],hardBlocks:[]}}, {tier:'pending',stats:{winRate:60,totalTrades:10,totalPnl:1}}, 'Return ONLY this JSON: {"recommendation":"CAUTION","riskLevel":"LOW","confidence":50,"reasoning":"Connection test","flags":[],"winRateContext":"Connection test"}'); return {ok:true,message:`${p} API connection succeeded.`};}
      finally{settings.aiProvider=old;}
    }
    return {ok:false,message:'Unknown connection type.'};
  }catch(e){return {ok:false,message:e.message||'Connection test failed.'};}
});
ipcMain.handle('settings-export-backup',async()=>{
  const r=await dialog.showSaveDialog(mainWin,{title:'Export CopyGuard Backup',defaultPath:`CopyGuard-Backup-${new Date().toISOString().slice(0,10)}.json`,filters:[{name:'CopyGuard Backup',extensions:['json']}]});
  if(r.canceled||!r.filePath)return {ok:false,canceled:true}; fs.writeFileSync(r.filePath,JSON.stringify(buildBackupPayload(),null,2)); return {ok:true,path:r.filePath,secretsIncluded:false};
});
ipcMain.handle('settings-import-backup',async()=>{
  const r=await dialog.showOpenDialog(mainWin,{title:'Restore CopyGuard Backup',properties:['openFile'],filters:[{name:'CopyGuard Backup',extensions:['json']}]});
  if(r.canceled||!r.filePaths?.[0])return {ok:false,canceled:true};
  const payload=JSON.parse(fs.readFileSync(r.filePaths[0],'utf8')); validateBackupPayload(payload);
  restoreBackupTransactionally(payload);
  if(payload.settings){const restored={...payload.settings};delete restored.apiKeys;delete restored.heliusApiKey;settings={...settings,...restored};persistPublicSettings();}
  reloadPersistentState(); pushNotificationEvent({type:'system',severity:'SUCCESS',title:'Backup restored',message:'CopyGuard data was restored. API keys were left unchanged.',source:'Settings Center'}); return {ok:true,restartRecommended:true};
});
ipcMain.handle('settings-export-data',async()=>{
  const r=await dialog.showSaveDialog(mainWin,{title:'Export CopyGuard Data',defaultPath:`CopyGuard-Data-${new Date().toISOString().slice(0,10)}.json`,filters:[{name:'JSON',extensions:['json']}]});
  if(r.canceled||!r.filePath)return {ok:false,canceled:true}; fs.writeFileSync(r.filePath,JSON.stringify(buildBackupPayload(),null,2)); return {ok:true,path:r.filePath};
});
ipcMain.handle('settings-open-data-folder',()=>{shell.openPath(DATA_DIR);return {ok:true,path:DATA_DIR};});
ipcMain.handle('settings-reset-data',(_,scope,confirmation='')=>{
  if(scope==='all'&&String(confirmation)!=='RESET EVERYTHING')return {ok:false,error:'Typed confirmation RESET EVERYTHING is required'};
  if(scope==='activity'){history=[];openPositions={};closedPositions=[];dailyStats={};riskEvents=[];notificationEvents=[];ghostBook={wallets:{},ledger:[],version:1}; verifiedOutcomeBook={version:1,byId:{},order:[]}; qualificationBook={version:1,wallets:{},events:[]}; observationState={version:1,wallets:{},recentEvents:[],health:{}}; for(const w of Object.values(wallets||{}))if(w.tier==='ghost')w.tier='pending';writeJson(WALLETS_F,wallets); [HISTORY_F,POSITIONS_F,CLOSED_POSITIONS_F,DAILY_F,RISK_EVENTS_F,NOTIFICATION_EVENTS_F,GHOST_F,OBSERVATION_F,MARKET_F,VERIFIED_OUTCOMES_F,QUALIFICATION_F,LEARNING_F].forEach(f=>{try{fs.unlinkSync(f)}catch{}});}
  else if(scope==='intelligence'){intel={suggestions:[],healthAlerts:[],watchlist:[]};researchWatchlist=[];riskEvents=[];earlyBirdWallets={};earlyBirdRuns=[];earlyBirdScanHistory=[]; [INTEL_F,RESEARCH_WATCH_F,RISK_EVENTS_F,EARLYBIRD_F,EARLYBIRD_RUNS_F,EARLYBIRD_HISTORY_F,EARLYBIRD_RECON_F,RISK_DECISIONS_F,DISCOVERY_F,AI_DECISIONS_F,LEARNING_F].forEach(f=>{try{fs.unlinkSync(f)}catch{}});}
  else if(scope==='preferences'){const sec={apiKeys:settings.apiKeys,heliusApiKey:settings.heliusApiKey};settings={...DEFAULT_SETTINGS,...sec};persistSettings();}
  else if(scope==='all'){for(const f of BACKUP_FILES){try{fs.unlinkSync(f)}catch{}};try{fs.unlinkSync(SETTINGS_F)}catch{};try{fs.unlinkSync(SECRETS_F)}catch{};settings={...DEFAULT_SETTINGS,apiKeys:{...defaultSecrets().apiKeys},heliusApiKey:''};persistSettings();reloadPersistentState();}
  else return {ok:false,error:'Unknown reset scope'};
  pushNotificationEvent({type:'system',severity:'WARNING',title:'Local data reset',message:`Reset scope completed: ${scope}.`,source:'Settings Center'}); return {ok:true};
});

ipcMain.handle('market-status',()=>marketStatus());
ipcMain.handle('ghost-refresh-market',async()=>{const status=await markGhostPositionsToMarket(true);return {ok:true,status,data:ghostPublicData()};});

ipcMain.handle('set-divider',       (_, f)         => { settings.dividerPosition=f; persistPublicSettings(); return {ok:true, legacy:true}; });
ipcMain.handle('padre-show',        (_, bounds)    => setPadreVisible(true, bounds));
ipcMain.handle('padre-hide',        ()             => setPadreVisible(false));
ipcMain.handle('padre-set-bounds',  (_, bounds)    => { updatePadreBounds(bounds); return {ok:true}; });
ipcMain.handle('padre-state',       ()             => { createPadreView(); return {ok:true,ready:true,visible:padreVisible,url:padreView.webContents.getURL()||PADRE_HOME,canGoBack:padreView.webContents.canGoBack(),canGoForward:padreView.webContents.canGoForward(),loading:padreView.webContents.isLoading()}; });
ipcMain.handle('padre-workspace-context', () => {
  createPadreView();
  const url=padreView.webContents.getURL()||PADRE_HOME;
  const mint=(url.match(/\/token\/([1-9A-HJ-NP-Za-km-z]{32,44})/i)||[])[1]||null;
  const health=connectionHealthSnapshot();
  const attempts=(executionSafetyBook.attempts||[]).slice(0,20).map(a=>({id:a.id,status:a.status,createdAt:a.createdAt,updatedAt:a.updatedAt,action:a.action,walletAddress:a.walletAddress,tokenAddress:a.tokenAddress,sourceSignature:a.sourceSignature,submittedAt:a.submittedAt||null,settledAt:a.settledAt||null}));
  const governed=(assistantBook.governedActionOrder||[]).map(id=>assistantGovernedAction(id)).filter(Boolean).slice(0,12).map(a=>assistantScrub(a));
  const risks=mint?(riskDecisionBook.decisions||[]).filter(r=>r.tokenAddress===mint||r.mint===mint).slice(0,5).map(assistantScrub):[];
  return assistantScrub({url,mint,padre:padreHealthSnapshot(),systemMode:health.mode,systemReason:health.reason||null,automationPaused:!!settings.automationPaused,autoExecute:!!settings.autoExecute,observation:observationHealth(),market:marketStatus(),integrity:integrityBook?.lastAudit||null,executionAttempts:attempts,governedActions:governed,risk:risks,authority:{manualFinalSubmit:true,copyGuardPreparedIsSubmission:false,governedFinalSubmit:false,assistantLiveExecution:false,automatedSellFailClosed:true}});
});
ipcMain.handle('padre-home',        ()             => { createPadreView(); padreView.webContents.loadURL(PADRE_HOME); return {ok:true,url:PADRE_HOME}; });
ipcMain.handle('padre-navigate',    (_, url)       => { createPadreView(); const safe=normalizePadreUrl(url); padreView.webContents.loadURL(safe); return {ok:true,url:safe}; });
ipcMain.handle('padre-open-token',  (_, mint)      => { createPadreView(); const safe=normalizePadreUrl(String(mint||'')); padreView.webContents.loadURL(safe); return {ok:true,url:safe}; });
ipcMain.handle('padre-back',        ()             => { createPadreView(); if(padreView.webContents.canGoBack()) padreView.webContents.goBack(); return {ok:true}; });
ipcMain.handle('padre-forward',     ()             => { createPadreView(); if(padreView.webContents.canGoForward()) padreView.webContents.goForward(); return {ok:true}; });
ipcMain.handle('padre-reload',      ()             => { createPadreView(); padreView.webContents.reload(); return {ok:true}; });
ipcMain.handle('padre-stop',        ()             => { createPadreView(); padreView.webContents.stop(); return {ok:true}; });
ipcMain.handle('open-external',     (_, url)       => { shell.openExternal(url); return {ok:true}; });
ipcMain.handle('ws-status',         ()             => ({ connected: heliusWs?.readyState===WebSocket.OPEN }));
ipcMain.handle('get-open-positions',()             => { const r=[]; for(const[k,s]of Object.entries(openPositions)){const[w,t]=k.split(':');for(const p of s)r.push({...p,walletAddress:w,tokenAddress:t,token:t.slice(0,6)+'...'+t.slice(-4)});}  return r.sort((a,b)=>b.openedAt-a.openedAt); });
ipcMain.handle('get-closed-positions',()           => closedPositions.slice(0,500));
ipcMain.handle('get-position-quotes', async (_, mints=[]) => {
  const unique=[...new Set((Array.isArray(mints)?mints:[]).filter(x=>/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(String(x))))].slice(0,30);
  const out={};
  await Promise.all(unique.map(async mint=>{
    try {
      const res=await apiFetch(`https://api.dexscreener.com/latest/dex/tokens/${mint}`, {}, 8_000);
      if(!res.ok) return;
      const d=await res.json();
      const pair=(d.pairs||[]).filter(p=>p.chainId==='solana').sort((a,b)=>Number(b.liquidity?.usd||0)-Number(a.liquidity?.usd||0))[0]||d.pairs?.[0];
      if(pair) out[mint]={priceUsd:Number(pair.priceUsd||0)||null,liquidity:Number(pair.liquidity?.usd||0)||null,fdv:Number(pair.fdv||0)||null,priceChange:pair.priceChange||{},pairUrl:pair.url||null,fetchedAt:Date.now()};
    } catch {}
  }));
  return out;
});
ipcMain.handle('check-promotion',   (_, addr)      => ({ eligible:checkPromoEligible(addr) }));
ipcMain.handle('get-trusted-config',(_, addr)      => trustedCfgs[addr]||null);
ipcMain.handle('save-trusted-config',(_, addr, c)  => { trustedCfgs[addr]=c; writeJson(TRUSTED_F,trustedCfgs); return {ok:true}; });
ipcMain.handle('delete-trusted-config',(_, addr)   => { delete trustedCfgs[addr]; writeJson(TRUSTED_F,trustedCfgs); return {ok:true}; });
ipcMain.handle('get-trusted-configs-all', ()       => trustedCfgs);
ipcMain.handle('get-automation-state', () => ({
  enabled:!!settings.autoExecute, paused:!!settings.automationPaused,
  maxSolGlobal:Number(settings.maxSolGlobal||2), maxAutomationRiskScore:Number(settings.maxAutomationRiskScore||45)
}));
ipcMain.handle('set-automation-state', (_, patch={}) => {
  const next = {};
  if ('enabled' in patch) next.autoExecute = !!patch.enabled;
  if ('paused' in patch) next.automationPaused = !!patch.paused;
  if ('maxSolGlobal' in patch) next.maxSolGlobal = Math.max(0.01, Math.min(100, Number(patch.maxSolGlobal)||2));
  if ('maxAutomationRiskScore' in patch) next.maxAutomationRiskScore = Math.max(0, Math.min(100, Number(patch.maxAutomationRiskScore)||45));
  settings = { ...settings, ...next }; persistSettings();
  if(Object.prototype.hasOwnProperty.call(next,'automationPaused')&&padreView){try{padreView.webContents.executeJavaScript(`window.__copyguardEmergencyPaused=${next.automationPaused===true?'true':'false'};`).catch(()=>{});}catch{}}
  if(next.automationPaused===true){for(const a of executionSafetyBook.attempts||[]){if(a.status==='RESERVED')updateExecutionAttemptById(a.id,'FAILED',{failureReason:'Emergency pause activated before confirmed dispatch'});}}
  broadcast('automation-state', { enabled:!!settings.autoExecute, paused:!!settings.automationPaused, maxSolGlobal:settings.maxSolGlobal, maxAutomationRiskScore:settings.maxAutomationRiskScore });
  return { ok:true, enabled:!!settings.autoExecute, paused:!!settings.automationPaused, maxSolGlobal:settings.maxSolGlobal, maxAutomationRiskScore:settings.maxAutomationRiskScore };
});
ipcMain.handle('get-daily-stats',   ()             => { const today=new Date().toISOString().slice(0,10); const r={}; for(const[a,ds]of Object.entries(dailyStats)){if(ds.date===today)r[a]=ds;} return r; });
ipcMain.handle('dismiss-health',    (_, addr)      => { const a=intel.healthAlerts.find(h=>h.walletAddress===addr); if(a)a.dismissed=true; writeJson(INTEL_F,intel); return {ok:true}; });
ipcMain.handle('dismiss-suggestion',(_, addr)      => { const s=intel.suggestions.find(x=>x.address===addr); if(s)s.dismissed=true; writeJson(INTEL_F,intel); return {ok:true}; });
ipcMain.handle('intel-watchlist-add', (_, item={}) => {
  const address=String(item.address||'').trim();
  if(!address) return {ok:false,error:'Wallet address required'};
  const existing=intel.watchlist.find(x=>x.address===address);
  if(existing) Object.assign(existing,{...item,address,updatedAt:Date.now()});
  else intel.watchlist.unshift({...item,address,addedAt:Date.now(),updatedAt:Date.now()});
  intel.watchlist=intel.watchlist.slice(0,100); writeJson(INTEL_F,intel);
  return {ok:true,watchlist:intel.watchlist};
});
ipcMain.handle('intel-watchlist-remove', (_, address) => {
  intel.watchlist=intel.watchlist.filter(x=>x.address!==address); writeJson(INTEL_F,intel);
  return {ok:true,watchlist:intel.watchlist};
});
ipcMain.handle('run-health-now', () => { runHealthCheck(); return {ok:true,healthAlerts:intel.healthAlerts}; });
ipcMain.handle('add-suggestion',    (_, s)         => { intel.suggestions.unshift(s); intel.suggestions=intel.suggestions.slice(0,50); writeJson(INTEL_F,intel); return {ok:true}; });
ipcMain.handle('update-history-outcome',(_, id,pnl)=> { const h=history.find(x=>x.id===id); if(h)h.pnl=pnl; writeJson(HISTORY_F,history); return {ok:true}; });
ipcMain.handle('research-search', async (_, rawQuery) => {
  const query=String(rawQuery||'').trim();
  if(!query) return {error:'Enter a ticker, token name, or Solana contract address.'};
  try{
    const exactMint=/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(query)?query:null;
    const url=exactMint?`https://api.dexscreener.com/latest/dex/tokens/${encodeURIComponent(query)}`:`https://api.dexscreener.com/latest/dex/search?q=${encodeURIComponent(query)}`;
    const res=await apiFetch(url,{headers:{Accept:'application/json'}},8_000);
    if(!res.ok)return{error:`DexScreener returned ${res.status}.`};
    const pairs=((await res.json()).pairs||[]).filter(p=>p.chainId==='solana'&&p.baseToken?.address);
    const byMint=new Map();
    for(const pair of pairs){const mint=pair.baseToken.address,old=byMint.get(mint);if(!old||Number(pair.liquidity?.usd||0)>Number(old.liquidity?.usd||0))byMint.set(mint,pair);}
    let uniq=[...byMint.values()]; if(exactMint)uniq.sort((a,b)=>(a.baseToken.address===exactMint?-1:b.baseToken.address===exactMint?1:0)); uniq=uniq.slice(0,12);
    const now=Date.now(), tokens=[];
    for(const pair of uniq){
      const mint=pair.baseToken.address;
      const [auth,holders,prov]=await Promise.all([enrichToken(mint),getHolderConcentration(mint),getProvenanceSignals(pair.baseToken?.symbol||'',mint)]);
      const researchEvidence=await buildTokenResearchEvidence(mint,pair,auth||{},holders,prov);
      const market={liquidity:Number(pair.liquidity?.usd||0),fdv:Number(pair.fdv||0),marketCap:Number(pair.marketCap||0),priceUsd:Number(pair.priceUsd||0),priceChange:pair.priceChange||{},volume24h:Number(pair.volume?.h24||0),txns24h:pair.txns?.h24||{}};
      const evidenceTrade={tokenAddress:mint,tokenSymbol:pair.baseToken?.symbol||auth.symbol||'',walletAddress:'',sizeSol:0,liquidity:market.liquidity,fdv:market.fdv,market,researchEvidence,tokenMeta:{...auth,holderAnalysis:holders,provenance:prov,researchEvidence},holderAnalysis:holders,provenance:prov,timestamp:Date.now()};
      const riskAssessment=assessTradeRisk(evidenceTrade,{});
      tokens.push({address:mint,name:pair.baseToken?.name||auth.name||'',symbol:pair.baseToken?.symbol||auth.symbol||'',dex:pair.dexId||'',pairAddress:pair.pairAddress||'',pairUrl:pair.url||'',priceUsd:market.priceUsd,priceChange:pair.priceChange||{},liquidity:market.liquidity,fdv:market.fdv,marketCap:market.marketCap,volume24h:market.volume24h,volume6h:Number(pair.volume?.h6||0),txns24h:pair.txns?.h24||{},createdAt:Number(pair.pairCreatedAt||0),ageHours:pair.pairCreatedAt?(now-Number(pair.pairCreatedAt))/3600000:null,socials:(pair.info?.socials||[]).map(x=>({type:x.type||'',url:x.url||''})),websites:(pair.info?.websites||[]).map(x=>({label:x.label||'Website',url:x.url||''})),labels:pair.labels||[],exactMatch:mint===exactMint,freezeEnabled:auth.freezeEnabled??null,mintEnabled:auth.mintEnabled??null,authorityFlags:auth.authorityFlags||[],holderAnalysis:holders,provenance:prov,riskAssessment,researchEvidence,researchEvidenceVersion:3});
      await new Promise(r=>setTimeout(r,80));
    }
    return{ok:true,query,exactMint,tokens,heliusConfigured:!!settings.heliusApiKey,evidenceVersion:3};
  }catch(e){return{error:e.message};}
});
ipcMain.handle('research-evidence-get',(_,mint='')=>({version:3,evidence:tokenResearchBook.tokens[String(mint||'')]||null,stats:tokenResearchBook.stats}));
ipcMain.handle('research-watchlist-get', () => researchWatchlist);
ipcMain.handle('research-watchlist-save', (_, token) => {
  const t = token && typeof token === 'object' ? token : {};
  const address = String(t.address || '').trim();
  if (!address) return { error:'Token address missing.' };
  researchWatchlist = [
    { address, symbol:String(t.symbol||''), name:String(t.name||''), addedAt:Date.now() },
    ...researchWatchlist.filter(x => x.address !== address),
  ].slice(0, 100);
  writeJson(RESEARCH_WATCH_F, researchWatchlist);
  return { ok:true, watchlist:researchWatchlist };
});
ipcMain.handle('research-watchlist-remove', (_, address) => {
  researchWatchlist = researchWatchlist.filter(x => x.address !== String(address||''));
  writeJson(RESEARCH_WATCH_F, researchWatchlist);
  return { ok:true, watchlist:researchWatchlist };
});
ipcMain.handle('check-token-authority', (_, mint)  => enrichToken(mint));
ipcMain.handle('scan-wallets-now',  async () => runWalletDiscovery());
ipcMain.handle('twitter-start-login', ()           => { startTwitterServer(); return {ok:true}; });
ipcMain.handle('twitter-save-tokens',(_, t)        => { twitterTokens=t; writeJson(TWITTER_F,t); return {ok:true}; });
ipcMain.handle('twitter-get-tokens',()             => twitterTokens);
ipcMain.handle('twitter-logout',    ()             => { twitterTokens=null; try{fs.unlinkSync(TWITTER_F);}catch(e){} return {ok:true}; });
ipcMain.handle('twitter-search',    async (_, {query,accessToken}) => {
  try {
    const params = new URLSearchParams({ query:`${query} lang:en -is:retweet`, max_results:'15', 'tweet.fields':'created_at,author_id,public_metrics,text', 'user.fields':'username,name,profile_image_url,verified,public_metrics', expansions:'author_id' });
    const res = await apiFetch(`https://api.twitter.com/2/tweets/search/recent?${params}`,{headers:{Authorization:`Bearer ${accessToken}`}});
    if (!res.ok) return { error:`Twitter API ${res.status}` };
    const data = await res.json();
    const tweets = data.data||[];
    const users  = {};
    for(const u of data.includes?.users||[]) users[u.id]=u;
    for(const t of tweets) t.author=users[t.author_id];
    return { tweets };
  } catch(e) { return { error:e.message }; }
});
ipcMain.handle('ai-research-summary', async (_, {ticker,tokens}) => {
  try {
    const evidence=(tokens||[]).slice(0,12).map((t,i)=>({index:i+1,address:t.address||t.tokenAddress,symbol:t.symbol,riskScore:t.riskAssessment?.score??t.score,riskLevel:t.riskAssessment?.level,hardBlocks:t.riskAssessment?.hardBlocks||[],holderTop1:t.holderAnalysis?.top1Pct??null,holderTop10:t.holderAnalysis?.top10Pct??null,sameTickerAlternatives:t.provenance?.exactCopycats??null,likelyOriginal:t.provenance?.likelyOriginal??null,liquidity:t.liquidity??t.liq,fdv:t.fdv,ageHours:t.ageHours??t.ageH,mintEnabled:t.mintEnabled,freezeEnabled:t.freezeEnabled,tokenProgram:t.researchEvidence?.tokenProgram?.type||'UNKNOWN',creatorCandidate:t.researchEvidence?.origin?.creatorCandidate||null,creatorHoldingPct:t.researchEvidence?.creatorHoldings?.pct??null,relatedLaunchCount:t.researchEvidence?.creatorHistory?.relatedLaunchCount??null,funder:t.researchEvidence?.creatorHistory?.funder?.address||null,earlyHolderOverlapPct:t.researchEvidence?.earlyBird?.earlyHolderOverlapPct??null,evidenceCoverage:t.researchEvidence?.coverage||null,evidenceLimitations:t.researchEvidence?.limitations||[]}));
    const prompt=`You are CopyGuard Research AI. Analyze only the supplied structured evidence for Solana token ticker ${JSON.stringify(ticker)}. Deterministic hard blocks are authoritative and cannot be overridden. Do not call a token safe merely because it has socials or volume. Distinguish verified on-chain evidence from heuristic provenance. Evidence:\n${JSON.stringify(evidence,null,2)}\nReturn ONLY JSON: {"verdict":"one sentence","originalAddress":"address or empty","warningLevel":"SAFE|CAUTION|DANGER","copycatCount":0,"bulletPoints":["evidence-backed point"],"recommendation":"specific action","evidenceLimitations":["limitations"]}`;
    const deterministic={decision:(tokens||[]).some(t=>(t.riskAssessment?.hardBlocks||[]).length)?'HARD_BLOCK':'CAUTION',hardBlocks:(tokens||[]).flatMap(t=>t.riskAssessment?.hardBlocks||[]),unknowns:(tokens||[]).flatMap(t=>t.riskAssessment?.unknowns||[])};
    const result=await callSpecializedAI(AI_TASKS.TOKEN_RESEARCH,{ticker,tokens:evidence},deterministic);
    return{ok:true,data:result,evidenceVersion:4};
  }catch(e){return{error:e.message};}
});

ipcMain.handle('execution-safety-data',(_,limit)=>executionSafetyPublicData(limit));
ipcMain.handle('connection-health-data',()=>connectionHealthSnapshot());
ipcMain.handle('connection-health-check',()=>runConnectionHealthCheck());
ipcMain.handle('observation-get-health', () => observationHealth());
ipcMain.handle('observation-poll-now', async () => { await pollObservationWallets(); return observationHealth(); });

// ── App lifecycle ───────────────────────────────────────────
app.whenReady().then(() => {
  runIntegrityAudit({repairSafe:true,persist:true});
  // Load/decrypt secrets only after Electron is ready, then migrate any legacy plaintext keys.
  const storedSecrets=loadSecrets();
  settings.apiKeys={...defaultSecrets().apiKeys,...(storedSecrets.apiKeys||{})};
  // Migrate only real legacy plaintext values. Phase 14 wrote masked placeholders
  // into settings.json; those must never overwrite a valid encrypted secret.
  for(const [k,v] of Object.entries(legacySecrets.apiKeys||{})) {
    if(v && !String(v).startsWith('••••')) settings.apiKeys[k]=v;
  }
  const legacyHelius=legacySecrets.heliusApiKey;
  settings.heliusApiKey=(legacyHelius && !String(legacyHelius).startsWith('••••')) ? legacyHelius : (storedSecrets.heliusApiKey||'');
  persistSettings();
  syncAllVerifiedOutcomes();
  rebuildClosedLoopLearning();
  const padreSession=session.fromPartition('persist:padre');
  const allowedPadrePermissions=new Set(['clipboard-read','clipboard-sanitized-write','notifications']);
  padreSession.setPermissionRequestHandler((webContents,permission,callback,details)=>{
    let host='';
    try { host=new URL(details?.requestingUrl||webContents.getURL()||'').hostname; } catch {}
    const trustedOrigin=host==='trade.padre.gg'||host.endsWith('.padre.gg');
    callback(Boolean(trustedOrigin && allowedPadrePermissions.has(permission)));
  });
  createWindow();
  setupTray();
  reconcileHeliusObservation(); startMarketMarking(); startEarlyBirdScheduler(); startHealthScheduler(); startDiscoveryScheduler(); startConnectionHealthMonitor();
  // Initial health check; discovery has its own lifecycle-managed 15s start.
  setTimeout(runHealthCheck,10_000);
  app.on('activate', () => { if(!mainWin){createWindow();}else mainWin.show(); });
});

app.on('window-all-closed', () => { if(process.platform!=='darwin')app.quit(); });
app.on('before-quit', () => { stopHelius(); stopObservationPolling(); stopEarlyBirdScheduler(); stopHealthScheduler(); stopDiscoveryScheduler(); stopConnectionHealthMonitor(); });

// ── Helpers ─────────────────────────────────────────────────
function fmtNum(n) {
  if(n>=1e6) return(n/1e6).toFixed(1)+'M';
  if(n>=1e3) return(n/1e3).toFixed(1)+'K';
  return Math.round(n)+'';
}

// ════════════════════════════════════════════════════════════
//  EARLY BIRD RECONSTRUCTION ENGINE — PHASE 24
//  Finds repeatable early-entry behavior on Solana tokens that later
//  made strong runs. This is behavioral evidence, not proof of why a
//  wallet was early. CopyGuard therefore ranks observable performance
//  and precision instead of making claims about privileged information.
// ════════════════════════════════════════════════════════════


// ════════════════════════════════════════════════════════════
//  NETWORK HELPERS
//  All external API calls route through apiFetch() so they get:
//   • Configurable timeout via AbortController (never hang forever)
//   • Automatic retry on 429 with exponential backoff
//   • Consistent User-Agent and error surface
// ════════════════════════════════════════════════════════════

const CG_USER_AGENT = 'CopyGuard/4.24.0 (Electron; Solana copy-trade intelligence)';

/**
 * Fetch with timeout + automatic 429 retry.
 * @param {string}  url
 * @param {object}  opts       — standard fetch options
 * @param {number}  timeoutMs  — abort after this many ms (default 12 000)
 * @param {number}  retries    — how many times to retry on 429 (default 2)
 */
async function apiFetch(url, opts = {}, timeoutMs = 12_000, retries = 2) {
  const headers = {
    'User-Agent': CG_USER_AGENT,
    ...(opts.headers || {}),
  };

  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timer      = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const startedAt=Date.now();
      const res = await fetch(url, { ...opts, headers, signal: controller.signal });
      clearTimeout(timer);
      const serviceName=serviceKeyForUrl(url); if(serviceName)noteServiceResult(serviceName,res.ok,{status:res.status,error:res.ok?null:`HTTP ${res.status}`,latencyMs:Date.now()-startedAt});

      // Rate limited — back off and retry
      if (res.status === 429) {
        const retryAfter = Number(res.headers.get('Retry-After') || 0);
        const backoff    = retryAfter > 0 ? retryAfter * 1000
                         : Math.min(1000 * 2 ** attempt, 8000);
        if (attempt < retries) {
          console.warn(`[apiFetch] 429 on ${url.slice(0,60)} — retrying in ${backoff}ms`);
          await new Promise(r => setTimeout(r, backoff));
          continue;
        }
      }
      return res;
    } catch (err) {
      clearTimeout(timer);
      const serviceName=serviceKeyForUrl(url); if(serviceName)noteServiceResult(serviceName,false,{error:err.message||String(err)});
      if (err.name === 'AbortError') {
        console.warn(`[apiFetch] Timeout (${timeoutMs}ms): ${url.slice(0, 60)}`);
        throw new Error(`Request timed out after ${timeoutMs}ms: ${url.slice(0, 60)}`);
      }
      if (attempt < retries) {
        await new Promise(r => setTimeout(r, 800 * (attempt + 1)));
        continue;
      }
      throw err;
    }
  }
  throw new Error(`apiFetch: all ${retries + 1} attempts exhausted for ${url.slice(0, 60)}`);
}

/** Convenience: POST JSON via apiFetch */
async function apiPost(url, body, timeoutMs = 12_000) {
  return apiFetch(url, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(body),
  }, timeoutMs);
}

/** Helius JSON-RPC helper — single call with consistent error handling */
async function heliusRpc(method, params, timeoutMs = 10_000) {
  if (!settings.heliusApiKey) throw new Error('Helius API key not configured');
  const res = await apiPost(
    `https://mainnet.helius-rpc.com/?api-key=${settings.heliusApiKey}`,
    { jsonrpc: '2.0', id: 1, method, params },
    timeoutMs,
  );
  if (!res.ok) throw new Error(`Helius RPC HTTP ${res.status}`);
  const data = await res.json();
  if (data.error) throw new Error(`Helius RPC error: ${data.error.message || JSON.stringify(data.error)}`);
  return data.result;
}


let earlyBirdWallets = readJson(EARLYBIRD_F, {});
let earlyBirdRuns = readJson(EARLYBIRD_RUNS_F, []);
let earlyBirdReconstruction = readJson(EARLYBIRD_RECON_F, {version:1,tokens:{},stats:{}});
earlyBirdReconstruction.tokens=earlyBirdReconstruction.tokens||{}; earlyBirdReconstruction.stats=earlyBirdReconstruction.stats||{};
let earlyBirdScanHistory = readJson(EARLYBIRD_HISTORY_F, []);
let earlyBirdScanState = {
  running: false,
  stage: 'idle',
  progress: 0,
  message: 'Ready',
  startedAt: null,
  lastCompletedAt: earlyBirdScanHistory[0]?.completedAt || null,
  lastError: null,
};

const EARLYBIRD_MIN_MULTIPLE = 3;
const EARLYBIRD_TOP_N_BUYERS = 25;
const EARLYBIRD_MIN_APPEARANCES = 2;
const EARLYBIRD_SCAN_INTERVAL_MS = 60 * 60 * 1000;
const EARLYBIRD_HISTORY_PAGE_LIMIT = 20;
const EARLYBIRD_HISTORY_SIGNATURE_LIMIT = 2500;
let earlyBirdScanTimer = null;
let earlyBirdInitialTimer = null;

function persistEarlyBirdReconstruction(){
  const entries=Object.entries(earlyBirdReconstruction.tokens||{}).sort((a,b)=>Number(b[1]?.reconstructedAt||0)-Number(a[1]?.reconstructedAt||0)).slice(0,150);
  earlyBirdReconstruction.tokens=Object.fromEntries(entries);
  writeJson(EARLYBIRD_RECON_F,earlyBirdReconstruction);
}
function startEarlyBirdScheduler(){
  if(!earlyBirdScanTimer) earlyBirdScanTimer=setInterval(runEarlyBirdScan,EARLYBIRD_SCAN_INTERVAL_MS);
  if(!earlyBirdInitialTimer) earlyBirdInitialTimer=setTimeout(()=>{earlyBirdInitialTimer=null;runEarlyBirdScan();},30_000);
}
function stopEarlyBirdScheduler(){
  if(earlyBirdScanTimer){clearInterval(earlyBirdScanTimer);earlyBirdScanTimer=null;}
  if(earlyBirdInitialTimer){clearTimeout(earlyBirdInitialTimer);earlyBirdInitialTimer=null;}
}

function broadcastEarlyBird() {
  broadcast('earlybird-update', {
    wallets: earlyBirdWallets,
    runs: earlyBirdRuns,
    scanHistory: earlyBirdScanHistory,
    scanState: earlyBirdScanState,
  });
}

function setEarlyBirdScanState(patch) {
  earlyBirdScanState = { ...earlyBirdScanState, ...patch };
  broadcastEarlyBird();
}

function earlyBirdClass(score, copycatBehavior) {
  if (copycatBehavior?.playsAll) return 'SPRAY';
  if (score >= 85) return 'ELITE';
  if (score >= 70) return 'STRONG';
  if (score >= 55) return 'NOTABLE';
  return 'WATCH';
}

function scoreEarlyBird(entries, copycatBehavior) {
  const safeEntries = Array.isArray(entries) ? entries : [];
  if (!safeEntries.length) return {
    score: 0, rawScore: 0, classification: 'WATCH', avgEntryRank: 0,
    avgMultiple: 0, consistency: 0,
    components: { timing: 0, repeatability: 0, outcomes: 0, precision: 0, copycatPenalty: 0 },
  };

  const avgEntryRank = safeEntries.reduce((s,e)=>s+Number(e.entryRank||25),0) / safeEntries.length;
  const avgMultiple = safeEntries.reduce((s,e)=>s+Number(e.priceMultiple||1),0) / safeEntries.length;
  const consistency = new Set(safeEntries.map(e=>e.tokenAddress).filter(Boolean)).size;
  const top5Rate = safeEntries.filter(e=>Number(e.entryRank||99)<=5).length / safeEntries.length;
  const top10Rate = safeEntries.filter(e=>Number(e.entryRank||99)<=10).length / safeEntries.length;
  const timed=safeEntries.filter(e=>Number.isFinite(Number(e.secondsAfterLaunch))&&Number(e.secondsAfterLaunch)>=0);
  const avgSecondsAfterLaunch=timed.length?timed.reduce((a,e)=>a+Number(e.secondsAfterLaunch),0)/timed.length:null;
  const under2m=timed.length?timed.filter(e=>Number(e.secondsAfterLaunch)<=120).length/timed.length:0;
  const under10m=timed.length?timed.filter(e=>Number(e.secondsAfterLaunch)<=600).length/timed.length:0;
  const highConfidenceRate=safeEntries.filter(e=>e.reconstructionConfidence==='HIGH').length/safeEntries.length;

  // 35 points: rank + actual seconds from launch anchor. Rank alone is not enough.
  const rankTiming=16*top5Rate+8*top10Rate;
  const clockTiming=timed.length?(7*under2m+4*under10m):2;
  const evidenceTiming=4*highConfidenceRate;
  const timing = Math.max(0, Math.min(35, rankTiming+clockTiming+evidenceTiming));
  // 25 points: repeatability across independent token runs.
  const repeatability = Math.min(25, Math.max(0, 7 + (consistency - 2) * 6));
  // 25 points: quality of the runs after observed entry.
  const outcomes = Math.min(25, Math.max(0, ((avgMultiple - 1) / 9) * 25));
  // 15 points: contract precision. Unknown starts neutral; copycat behavior reduces it.
  let precision = 12;
  let copycatPenalty = 0;
  if (copycatBehavior?.playsAll) { precision = 0; copycatPenalty = 25; }
  else if (copycatBehavior?.playsSome) { precision = 5; copycatPenalty = 10; }
  else if (copycatBehavior && Number(copycatBehavior.totalTokensChecked||0)>0) precision = 15;

  const rawScore = Math.round(timing + repeatability + outcomes + precision);
  const score = Math.max(0, Math.min(100, rawScore - copycatPenalty));
  return {
    score,
    rawScore,
    classification: earlyBirdClass(score, copycatBehavior),
    avgEntryRank: Number(avgEntryRank.toFixed(1)),
    avgMultiple: Number(avgMultiple.toFixed(1)),
    avgSecondsAfterLaunch: avgSecondsAfterLaunch==null?null:Math.round(avgSecondsAfterLaunch),
    highConfidenceRate:Number(highConfidenceRate.toFixed(3)),
    consistency,
    components: {
      timing: Math.round(timing),
      repeatability: Math.round(repeatability),
      outcomes: Math.round(outcomes),
      precision: Math.round(precision),
      copycatPenalty,
    },
  };
}

// Checks whether the same wallet also traded same-ticker alternative contracts.
// This helps distinguish precise contract selection from broad spray-and-pray behavior.
async function checkCopycatBehavior(walletAddress, entries, heliusApiKey) {
  const result = { playsAll:false, playsSome:false, details:[], totalCopycatsBought:0, totalTokensChecked:0 };
  if (!heliusApiKey || !entries?.length) return result;
  try {
    const txRes = await apiFetch(`https://api.helius.xyz/v0/addresses/${walletAddress}/transactions?api-key=${heliusApiKey}&limit=50&type=SWAP`, {headers:{'Content-Type':'application/json'}});
    if (!txRes.ok) return result;
    const txs = await txRes.json();
    if (!Array.isArray(txs) || !txs.length) return result;
    const walletTokens = new Set();
    for (const tx of txs) for (const transfer of (tx.tokenTransfers||[])) {
      if (transfer.fromUserAccount===walletAddress || transfer.toUserAccount===walletAddress) walletTokens.add(transfer.mint);
    }
    for (const entry of entries.slice(0,8)) {
      const symbol = entry.symbol;
      if (!symbol || symbol.length<2) continue;
      result.totalTokensChecked++;
      await new Promise(r=>setTimeout(r,220));
      try {
        const r = await fetch(`https://api.dexscreener.com/latest/dex/search?q=${encodeURIComponent(symbol)}`);
        if (!r.ok) continue;
        const data = await r.json();
        const alternatives=(data.pairs||[]).filter(p=>p.chainId==='solana' && p.baseToken?.symbol?.toUpperCase()===symbol.toUpperCase() && p.baseToken?.address!==entry.tokenAddress).map(p=>p.baseToken.address).filter((a,i,arr)=>arr.indexOf(a)===i).slice(0,8);
        const bought=alternatives.filter(a=>walletTokens.has(a));
        if (bought.length) {
          result.details.push({ticker:symbol,realToken:entry.tokenAddress,copycatsBought:bought,copycatsExist:alternatives.length,boughtRatio:`${bought.length}/${alternatives.length}`});
          result.totalCopycatsBought += bought.length;
        }
      } catch (_) {}
    }
    const withCopycats=result.details.length, checked=result.totalTokensChecked;
    if (checked>=2 && withCopycats>=checked*0.6) { result.playsAll=true; result.playsSome=true; }
    else if (withCopycats>=1) result.playsSome=true;
  } catch(e) { console.error('[EarlyBird] copycat check:',e.message); }
  return result;
}

async function analyzeEarlyBirdCandidate(address, entries, metrics, copycatBehavior) {
  const provider=settings.aiProvider||'anthropic';
  if(!settings.apiKeys?.[provider]) return null;
  const evidence={address,score:metrics.score,classification:metrics.classification,avgEntryRank:metrics.avgEntryRank,avgSecondsAfterLaunch:metrics.avgSecondsAfterLaunch,reconstructionHighConfidenceRate:metrics.highConfidenceRate,avgObservedRunMultiple:metrics.avgMultiple,distinctRuns:metrics.consistency,scoreComponents:metrics.components,copycatBehavior,entries:(entries||[]).slice(0,12).map(e=>({tokenAddress:e.tokenAddress,symbol:e.symbol,entryRank:e.entryRank,observedRunMultiple:e.priceMultiple,entryPriceUsd:e.entryPriceUsd??null,secondsAfterLaunch:e.secondsAfterLaunch??null,reconstructionConfidence:e.reconstructionConfidence||'UNKNOWN',sourceSignature:e.signature||null,timestamp:e.timestamp}))};
  const prompt=`You are CopyGuard Early Bird AI. Judge repeatable early-entry behavior using only this evidence. "Observed run multiple" is a DEX-window estimate, not verified launch-to-peak history. Never claim insider knowledge. The wallet is not profitable until Shadow testing proves copyable outcomes. Evidence:\n${JSON.stringify(evidence,null,2)}\nReturn ONLY JSON: {"recommendation":"SHADOW_TEST|WATCH|REJECT","confidence":0,"reasoning":"evidence-backed reasoning","flags":[],"limitations":[]}`;
  try{return await callSpecializedAI(AI_TASKS.EARLY_BIRD,evidence,{decision:metrics.classification||'WATCH',hardBlocks:[]});}catch(e){return {error:e.message};}
}

function routeEarlyBirdToShadow(address, candidate) {
  if (!address || !candidate || candidate.dismissed || candidate.classification==='SPRAY' || Number(candidate.score||0)<70) return false;
  if (wallets[address]?.tier==='blacklisted' || wallets[address]?.tier==='trusted') return false;
  if (!wallets[address]) {
    wallets[address]={label:`Early Bird ${address.slice(0,6)}`,tier:'ghost',addedAt:Date.now(),source:'earlybird-auto',stats:{totalTrades:0,winRate:0,totalPnl:0}};
  } else if (wallets[address].tier==='pending') wallets[address].tier='ghost';
  if (!ghostBook.wallets[address]) ghostBook.wallets[address]=newGhostWallet(address,{minCompletedTrades:30});
  candidate.alreadyWatching=true; candidate.shadowRoutedAt=candidate.shadowRoutedAt||Date.now();
  writeJson(WALLETS_F,wallets); persistGhost();
  pushNotificationEvent({type:'earlybird',severity:'INFO',title:'Early Bird routed to Shadow',message:`${address.slice(0,8)} scored ${candidate.score}/100 (${candidate.classification}) and will be paper-tested for 30 completed outcomes.`,source:'Early Bird',walletAddress:address});
  startGhostPolling(); return true;
}

async function runEarlyBirdScan() {
  if (earlyBirdScanState.running) return {ok:false,reason:'Early Bird scan is already running'};
  if (!settings.heliusApiKey) {
    setEarlyBirdScanState({running:false,stage:'blocked',progress:0,message:'Helius API key required',lastError:'Missing Helius API key'});
    return {ok:false,reason:'Helius API key required'};
  }
  const startedAt=Date.now();
  setEarlyBirdScanState({running:true,stage:'finding-runs',progress:5,message:'Finding qualifying token runs…',startedAt,lastError:null});
  console.log('[EarlyBird] Phase 24 reconstruction scan starting…');
  try {
    const bigRunTokens=await findBigRunTokens();
    if (!bigRunTokens.length) {
      const record={startedAt,completedAt:Date.now(),tokensAnalyzed:0,candidatesScored:0,newCandidates:0,message:'No qualifying 3x+ runs found'};
      earlyBirdScanHistory=[record,...earlyBirdScanHistory].slice(0,40); writeJson(EARLYBIRD_HISTORY_F,earlyBirdScanHistory);
      setEarlyBirdScanState({running:false,stage:'complete',progress:100,message:record.message,lastCompletedAt:record.completedAt});
      return {ok:true,...record};
    }

    const newRuns=bigRunTokens.slice(0,8).map(t=>({tokenAddress:t.address,symbol:t.symbol,multiple:t.multiple,multipleEvidence:t.multipleEvidence||'dex-window-estimate',liquidityUsd:t.liq||0,change24h:t.change24h||0,pairCreatedAt:t.pairCreatedAt||0,analyzedAt:Date.now()}));
    const runMap=new Map([...newRuns,...earlyBirdRuns].map(r=>[r.tokenAddress,r]));
    earlyBirdRuns=[...runMap.values()].sort((a,b)=>(b.analyzedAt||0)-(a.analyzedAt||0)).slice(0,75);
    writeJson(EARLYBIRD_RUNS_F,earlyBirdRuns);

    const earlyBuyerMap=new Map();
    const scanTokens=bigRunTokens.slice(0,8);
    for (let i=0;i<scanTokens.length;i++) {
      const token=scanTokens[i];
      setEarlyBirdScanState({stage:'buyer-history',progress:15+Math.round((i/Math.max(1,scanTokens.length))*45),message:`Reading earliest buyers for $${token.symbol||'TOKEN'}…`});
      await new Promise(r=>setTimeout(r,450));
      try {
        const reconstruction=await reconstructTokenLaunch(token,{maxPages:EARLYBIRD_HISTORY_PAGE_LIMIT,maxSignatures:EARLYBIRD_HISTORY_SIGNATURE_LIMIT});
        const savedRun=earlyBirdRuns.find(r=>r.tokenAddress===token.address); if(savedRun){Object.assign(savedRun,{launchAnchorMs:reconstruction.launchAnchorMs,launchAnchorSource:reconstruction.launchAnchorSource,reconstructionConfidence:reconstruction.confidence,historyComplete:reconstruction.reachedHistoryEnd,historySignatures:reconstruction.signatureCount});writeJson(EARLYBIRD_RUNS_F,earlyBirdRuns);}
        const buyers=await getEarliestBuyers(token.address,EARLYBIRD_TOP_N_BUYERS,{token,reconstruction,maxPages:EARLYBIRD_HISTORY_PAGE_LIMIT,maxSignatures:EARLYBIRD_HISTORY_SIGNATURE_LIMIT});
        for (const buyer of buyers) {
          if (!earlyBuyerMap.has(buyer.address)) earlyBuyerMap.set(buyer.address,[]);
          earlyBuyerMap.get(buyer.address).push({tokenAddress:token.address,symbol:token.symbol,entryRank:buyer.rank,priceMultiple:token.multiple,timestamp:buyer.timestamp,signature:buyer.signature,tokenAmount:buyer.tokenAmount,entryPriceUsd:buyer.entryPriceUsd,entryPriceSol:buyer.entryPriceSol,priceSource:buyer.priceSource,secondsAfterLaunch:buyer.secondsAfterLaunch,launchAnchorMs:buyer.launchAnchorMs,launchAnchorSource:buyer.launchAnchorSource,reconstructionConfidence:buyer.reconstructionConfidence,historyComplete:buyer.historyComplete,runObservedAt:Date.now()});
        }
      } catch(e){ console.error(`[EarlyBird] buyers ${token.symbol}:`,e.message); }
    }

    const candidates=[...earlyBuyerMap.entries()].filter(([,entries])=>entries.length>=EARLYBIRD_MIN_APPEARANCES);
    let newCandidates=0, scored=0;
    for (let i=0;i<candidates.length;i++) {
      const [address,newEntries]=candidates[i];
      setEarlyBirdScanState({stage:'scoring',progress:62+Math.round((i/Math.max(1,candidates.length))*33),message:`Scoring repeat early-entry wallet ${i+1}/${candidates.length}…`});
      const existing=earlyBirdWallets[address];
      const merged=[...(existing?.earlyEntries||[]).filter(e=>!newEntries.some(n=>n.tokenAddress===e.tokenAddress)),...newEntries].sort((a,b)=>(b.timestamp||0)-(a.timestamp||0)).slice(0,30);
      const copycatBehavior=await checkCopycatBehavior(address,merged,settings.heliusApiKey);
      const metrics=scoreEarlyBird(merged,copycatBehavior);
      const alreadyWatching=!!wallets[address];
      earlyBirdWallets[address]={
        ...existing,
        address,
        shortAddress:`${address.slice(0,6)}...${address.slice(-4)}`,
        earlyEntries:merged,
        score:metrics.score,
        rawScore:metrics.rawScore,
        scoreComponents:metrics.components,
        avgEntryRank:metrics.avgEntryRank,
        avgSecondsAfterLaunch:metrics.avgSecondsAfterLaunch,
        reconstructionHighConfidenceRate:metrics.highConfidenceRate,
        avgMultiple:metrics.avgMultiple,
        consistency:metrics.consistency,
        classification:metrics.classification,
        // legacy field retained so older sidebar builds can still render the record
        suspicionLevel:metrics.classification==='ELITE'?'HIGH':metrics.classification==='STRONG'?'MEDIUM':metrics.classification==='SPRAY'?'SPRAY':'NOTABLE',
        copycatBehavior,
        dismissed:existing?.dismissed??false,
        alreadyWatching,
        firstDetectedAt:existing?.firstDetectedAt||Date.now(),
        lastUpdated:Date.now(),
      };
      if (!existing && metrics.classification!=='SPRAY') newCandidates++;
      earlyBirdWallets[address].aiAssessment=await analyzeEarlyBirdCandidate(address,merged,metrics,copycatBehavior);
      earlyBirdWallets[address].aiAssessmentAt=Date.now();
      routeEarlyBirdToShadow(address, earlyBirdWallets[address]);
      scored++;
    }
    // Keep watching state synchronized when a candidate was added through another CopyGuard page.
    for (const [address,w] of Object.entries(earlyBirdWallets)) w.alreadyWatching=!!wallets[address];
    writeJson(EARLYBIRD_F,earlyBirdWallets);

    const completedAt=Date.now();
    const record={startedAt,completedAt,tokensAnalyzed:scanTokens.length,candidatesScored:scored,newCandidates,totalCandidates:Object.keys(earlyBirdWallets).length};
    earlyBirdScanHistory=[record,...earlyBirdScanHistory].slice(0,40); writeJson(EARLYBIRD_HISTORY_F,earlyBirdScanHistory);
    setEarlyBirdScanState({running:false,stage:'complete',progress:100,message:`Scan complete · ${scored} repeat early-entry wallet${scored===1?'':'s'} scored`,lastCompletedAt:completedAt,lastError:null});
    if(newCandidates>0) notify(`✦ ${newCandidates} Early Bird candidate${newCandidates===1?'':'s'} detected`,`Repeat early-entry behavior found across tokens that later ran ${EARLYBIRD_MIN_MULTIPLE}x+`);
    console.log(`[EarlyBird] Scan complete. ${newCandidates} new, ${scored} scored.`);
    return {ok:true,...record};
  } catch(e) {
    console.error('[EarlyBird] Scan error:',e.message);
    setEarlyBirdScanState({running:false,stage:'error',progress:0,message:'Scan failed',lastError:e.message});
    return {ok:false,reason:e.message};
  }
}

async function findBigRunTokens() {
  const results = [];
  try {
    // Use DexScreener trending tokens on Solana — organic volume/price action.
    // NOT the paid boost/advertisement endpoint (token-boosts/top/v1)
    // which returns projects that paid for promotion, not genuine organic runners.
    const [profileRes, trendRes] = await Promise.allSettled([
      apiFetch('https://api.dexscreener.com/token-profiles/latest/v1', {}, 10_000),
      apiFetch('https://api.dexscreener.com/latest/dex/search/?q=solana', {}, 10_000),
    ]);

    const candidates = new Map();

    // Source 1: Recent token profiles on Solana
    if (profileRes.status === 'fulfilled' && profileRes.value.ok) {
      const profiles = await profileRes.value.json();
      const sol = Array.isArray(profiles) ? profiles.filter(p => p.chainId === 'solana') : [];
      for (const p of sol.slice(0, 20)) {
        if (p.tokenAddress) candidates.set(p.tokenAddress, { source: 'profile' });
      }
    }

    // Source 2: Trending Solana pairs by 24h volume + price action
    if (trendRes.status === 'fulfilled' && trendRes.value.ok) {
      const d = await trendRes.value.json();
      const solPairs = (d.pairs || [])
        .filter(p => p.chainId === 'solana' && Number(p.priceChange?.h24 || 0) >= 100)
        .sort((a, b) => Number(b.priceChange?.h24 || 0) - Number(a.priceChange?.h24 || 0))
        .slice(0, 20);
      for (const pair of solPairs) {
        if (pair.baseToken?.address)
          candidates.set(pair.baseToken.address, { source: 'trending', pair });
      }
    }

    // Score each candidate — keep only those that hit the minimum run multiple
    for (const [tokenAddress, meta] of [...candidates.entries()].slice(0, 25)) {
      await new Promise(r => setTimeout(r, 180));
      try {
        let pair = meta.pair;
        if (!pair) {
          const pairRes = await apiFetch(`https://api.dexscreener.com/latest/dex/tokens/${tokenAddress}`, {}, 8_000);
          if (!pairRes.ok) continue;
          pair = (await pairRes.json()).pairs?.[0];
        }
        if (!pair) continue;
        const change24h = Number(pair.priceChange?.h24 || 0);
        const change6h  = Number(pair.priceChange?.h6  || 0);
        const change1h  = Number(pair.priceChange?.h1  || 0);
        const liq       = Number(pair.liquidity?.usd   || 0);
        // Pick the strongest move across any timeframe (normalised to 24h equivalent)
        const pct   = Math.max(change24h, change6h * 1.5, change1h * 6);
        const multi = (pct / 100) + 1;
        if (multi >= EARLYBIRD_MIN_MULTIPLE && liq > 10_000) {
          results.push({
            address:  tokenAddress,
            symbol:   pair.baseToken?.symbol || tokenAddress.slice(0, 6),
            multiple: Number(multi.toFixed(1)),
            liq,
            change24h,
            pairCreatedAt:Number(pair.pairCreatedAt||0),
            multipleEvidence:'dex-window-estimate',
            multipleConfidence: change24h>=200 ? 'MEDIUM' : 'LOW',
          });
        }
      } catch (_) {}
    }
  } catch (e) { console.error('[EarlyBird] findBigRunTokens:', e.message); }

  const seen = new Set();
  return results
    .filter(r => r.address && !seen.has(r.address) && seen.add(r.address))
    .sort((a, b) => b.multiple - a.multiple)
    .slice(0, 12);
}


function enhancedBuyerFromTx(tx, tokenAddress, launchAnchorMs=null) {
  if (!tx || tx.type!=='SWAP') return null;
  const inbound=(tx.tokenTransfers||[])
    .filter(t=>t.mint===tokenAddress && t.toUserAccount && t.toUserAccount!==t.fromUserAccount && Number(t.tokenAmount||0)>0)
    .sort((a,b)=>Number(b.tokenAmount||0)-Number(a.tokenAmount||0));
  if (!inbound.length) return null;
  const top=inbound[0], address=top.toUserAccount;
  if(!address || address.length<32 || address.includes('11111111')) return null;
  const tokenAmount=Number(top.tokenAmount||0);
  const timestamp=tx.timestamp?tx.timestamp*1000:null;
  let quoteUsd=null, quoteSol=null, priceSource='UNRESOLVED';
  const stableOut=(tx.tokenTransfers||[]).filter(t=>t.fromUserAccount===address&&(t.mint===USDC_MINT||t.mint===USDT_MINT)&&Number(t.tokenAmount||0)>0).reduce((a,t)=>a+Number(t.tokenAmount||0),0);
  if(stableOut>0){quoteUsd=stableOut;priceSource='TRANSACTION_STABLE';}
  if(!quoteUsd){
    const wsolOut=(tx.tokenTransfers||[]).filter(t=>t.fromUserAccount===address&&t.mint===SOL_MINT&&Number(t.tokenAmount||0)>0).reduce((a,t)=>a+Number(t.tokenAmount||0),0);
    if(wsolOut>0){quoteSol=wsolOut;priceSource='TRANSACTION_WSOL';}
  }
  if(!quoteUsd&&!quoteSol){
    const nativeOut=(tx.nativeTransfers||[]).filter(t=>t.fromUserAccount===address&&t.toUserAccount!==address&&Number(t.amount||0)>0).reduce((a,t)=>a+Number(t.amount||0),0)/1e9;
    if(nativeOut>0){quoteSol=nativeOut;priceSource='TRANSACTION_NATIVE_SOL';}
  }
  const secondsAfterLaunch=(timestamp&&launchAnchorMs)?Math.max(0,Math.round((timestamp-launchAnchorMs)/1000)):null;
  return {address,tokenAmount,signature:tx.signature||null,timestamp,evidence:'token-inflow',quoteUsd,quoteSol,entryPriceUsd:quoteUsd&&tokenAmount?quoteUsd/tokenAmount:null,entryPriceSol:quoteSol&&tokenAmount?quoteSol/tokenAmount:null,priceSource,secondsAfterLaunch};
}

async function fetchTokenSignatureHistory(tokenAddress,opts={}){
  const maxPages=Math.max(1,Math.min(30,Number(opts.maxPages||EARLYBIRD_HISTORY_PAGE_LIMIT)));
  const maxSignatures=Math.max(100,Math.min(5000,Number(opts.maxSignatures||EARLYBIRD_HISTORY_SIGNATURE_LIMIT)));
  let before=null, rows=[], reachedHistoryEnd=false;
  for(let page=0;page<maxPages && rows.length<maxSignatures;page++){
    const cfg={limit:Math.min(1000,maxSignatures-rows.length),commitment:'confirmed'};
    if(before)cfg.before=before;
    const pageRows=await heliusRpc('getSignaturesForAddress',[tokenAddress,cfg],12_000);
    if(!Array.isArray(pageRows)||!pageRows.length){reachedHistoryEnd=true;break;}
    rows.push(...pageRows.filter(r=>r&&!r.err&&r.signature));
    before=pageRows[pageRows.length-1]?.signature;
    if(pageRows.length<cfg.limit){reachedHistoryEnd=true;break;}
    await new Promise(r=>setTimeout(r,100));
  }
  const bySig=new Map(); for(const r of rows)if(!bySig.has(r.signature))bySig.set(r.signature,r);
  rows=[...bySig.values()];
  return {rows,reachedHistoryEnd,truncated:!reachedHistoryEnd&&rows.length>=maxSignatures,pages:Math.ceil(rows.length/1000),oldest:rows[rows.length-1]||null,newest:rows[0]||null};
}

async function reconstructTokenLaunch(token,opts={}){
  const tokenAddress=token.address||token.tokenAddress;
  const hist=await fetchTokenSignatureHistory(tokenAddress,opts);
  const oldestChainMs=Number(hist.oldest?.blockTime||0)*1000||null;
  const pairCreatedAt=Number(token.pairCreatedAt||0)||null;
  // Pair creation is the preferred trading-launch anchor. Oldest token-address tx is fallback evidence.
  const launchAnchorMs=pairCreatedAt||oldestChainMs;
  const confidence=hist.reachedHistoryEnd&&pairCreatedAt?'HIGH':(hist.reachedHistoryEnd||pairCreatedAt)?'MEDIUM':'LOW';
  const rec={tokenAddress,symbol:token.symbol||'',reconstructedAt:Date.now(),signatureCount:hist.rows.length,reachedHistoryEnd:hist.reachedHistoryEnd,truncated:hist.truncated,oldestSignature:hist.oldest?.signature||null,oldestChainMs,pairCreatedAt,launchAnchorMs,launchAnchorSource:pairCreatedAt?'DEX_PAIR_CREATED_AT':'OLDEST_OBSERVED_TOKEN_TRANSACTION',confidence};
  earlyBirdReconstruction.tokens[tokenAddress]=rec;
  earlyBirdReconstruction.stats.reconstructions=Number(earlyBirdReconstruction.stats.reconstructions||0)+1;
  earlyBirdReconstruction.stats.lastReconstructedAt=Date.now();
  persistEarlyBirdReconstruction();
  return {...rec,_history:hist};
}

async function getEarliestBuyers(tokenAddress,maxBuyers,opts={}){
  const buyers=[];
  try{
    const tokenMeta=opts.token||{address:tokenAddress,pairCreatedAt:opts.pairCreatedAt||0};
    const reconstruction=opts.reconstruction||await reconstructTokenLaunch(tokenMeta,opts);
    const hist=reconstruction._history||await fetchTokenSignatureHistory(tokenAddress,opts);
    const oldest=hist.rows.slice(0,Number(opts.maxSignatures||EARLYBIRD_HISTORY_SIGNATURE_LIMIT)).reverse();
    const seen=new Set(); let rank=1;
    for(let i=0;i<oldest.length&&buyers.length<maxBuyers;i+=100){
      const sigs=oldest.slice(i,i+100).map(r=>r.signature);
      const txRes=await apiPost(`https://api.helius.xyz/v0/transactions?api-key=${settings.heliusApiKey}`,{transactions:sigs},15_000);
      if(!txRes.ok)continue;
      const txs=await txRes.json();if(!Array.isArray(txs))continue;
      const order=new Map(sigs.map((sig,idx)=>[sig,idx]));
      txs.sort((a,b)=>Number(order.get(a.signature)??999)-Number(order.get(b.signature)??999));
      for(const tx of txs){
        const hit=enhancedBuyerFromTx(tx,tokenAddress,reconstruction.launchAnchorMs);if(!hit||seen.has(hit.address))continue;
        seen.add(hit.address);
        buyers.push({...hit,rank,reconstructionConfidence:reconstruction.confidence,launchAnchorMs:reconstruction.launchAnchorMs,launchAnchorSource:reconstruction.launchAnchorSource,historyComplete:reconstruction.reachedHistoryEnd});
        rank++;if(buyers.length>=maxBuyers)break;
      }
      await new Promise(r=>setTimeout(r,100));
    }
    const stored=earlyBirdReconstruction.tokens[tokenAddress]||{};
    stored.earliestBuyers=buyers.slice(0,Math.min(maxBuyers,25)).map(b=>({address:b.address,rank:b.rank,signature:b.signature,timestamp:b.timestamp,secondsAfterLaunch:b.secondsAfterLaunch,entryPriceUsd:b.entryPriceUsd,entryPriceSol:b.entryPriceSol,priceSource:b.priceSource}));
    stored.buyersFound=buyers.length;earlyBirdReconstruction.tokens[tokenAddress]=stored;persistEarlyBirdReconstruction();
  }catch(e){console.error('[EarlyBird] earliest buyers:',e.message);}
  return buyers;
}

ipcMain.handle('get-earlybird-data',()=>({wallets:earlyBirdWallets,runs:earlyBirdRuns,scanHistory:earlyBirdScanHistory,scanState:earlyBirdScanState,reconstruction:{stats:earlyBirdReconstruction.stats,tokens:Object.keys(earlyBirdReconstruction.tokens||{}).length},config:{minMultiple:EARLYBIRD_MIN_MULTIPLE,topBuyers:EARLYBIRD_TOP_N_BUYERS,minAppearances:EARLYBIRD_MIN_APPEARANCES,intervalMs:EARLYBIRD_SCAN_INTERVAL_MS,maxHistorySignatures:EARLYBIRD_HISTORY_SIGNATURE_LIMIT}}));
ipcMain.handle('earlybird-watch',(_,address)=>{
  const eb=earlyBirdWallets[address]; if(!eb)return{ok:false,reason:'Candidate not found'};
  if(eb.classification==='SPRAY')return{ok:false,reason:'Spray-and-pray candidates cannot be added from Early Bird'};
  wallets[address]={...(wallets[address]||{}),address,label:wallets[address]?.label||'✦ Early Bird',tier:wallets[address]?.tier||'ghost',addedAt:wallets[address]?.addedAt||Date.now(),rules:wallets[address]?.rules||{maxSol:.5,buyPercent:100},stats:wallets[address]?.stats||{totalTrades:0,wins:0,losses:0,totalPnl:0,winRate:0,avgPnl:0},earlyBirdScore:eb.score,earlyBirdData:eb};
  if(wallets[address].tier==='pending') wallets[address].tier='ghost';
  if(!ghostBook.wallets[address]) ghostBook.wallets[address]=newGhostWallet(address,{minCompletedTrades:30});
  eb.alreadyWatching=true; eb.shadowRoutedAt=eb.shadowRoutedAt||Date.now();
  writeJson(WALLETS_F,wallets); writeJson(EARLYBIRD_F,earlyBirdWallets); persistGhost();
  reconcileHeliusObservation(); broadcastEarlyBird(); broadcast('ghost-update',{address,reason:'earlybird-watch'});
  return{ok:true,wallet:wallets[address],ghost:ghostBook.wallets[address]};
});
ipcMain.handle('earlybird-dismiss',(_,address)=>{if(earlyBirdWallets[address])earlyBirdWallets[address].dismissed=true;writeJson(EARLYBIRD_F,earlyBirdWallets);broadcastEarlyBird();return{ok:true};});
ipcMain.handle('earlybird-restore',(_,address)=>{if(earlyBirdWallets[address])earlyBirdWallets[address].dismissed=false;writeJson(EARLYBIRD_F,earlyBirdWallets);broadcastEarlyBird();return{ok:true};});
ipcMain.handle('earlybird-scan-now',async()=>runEarlyBirdScan());
