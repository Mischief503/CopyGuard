'use strict';
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('cg', {
  // Data
  getAllData:   ()       => ipcRenderer.invoke('get-all-data'),
  saveSettings:(s)      => ipcRenderer.invoke('save-settings', s),
  saveWallets: (w)      => ipcRenderer.invoke('save-wallets', w),
  wsStatus:    ()       => ipcRenderer.invoke('ws-status'),

  // Trades
  approveTrade:(t)      => ipcRenderer.invoke('approve-trade', t),
  rejectTrade: (t)      => ipcRenderer.invoke('reject-trade', t),
  analyzeTrade:(t)      => ipcRenderer.invoke('analyze-trade', t),
  updateOutcome:(id,p)  => ipcRenderer.invoke('update-history-outcome', id, p),

  // Padre browser controls
  padreShow:    (bounds)=> ipcRenderer.invoke('padre-show', bounds),
  padreHide:    ()      => ipcRenderer.invoke('padre-hide'),
  padreSetBounds:(b)    => ipcRenderer.invoke('padre-set-bounds', b),
  padreState:   ()      => ipcRenderer.invoke('padre-state'),
  getPadreWorkspaceContext: () => ipcRenderer.invoke('padre-workspace-context'),
  padreHome:    ()      => ipcRenderer.invoke('padre-home'),
  padreNavigate:(url)   => ipcRenderer.invoke('padre-navigate', url),
  padreOpenToken:(mint) => ipcRenderer.invoke('padre-open-token', mint),
  padreBack:    ()      => ipcRenderer.invoke('padre-back'),
  padreForward: ()      => ipcRenderer.invoke('padre-forward'),
  padreReload:  ()      => ipcRenderer.invoke('padre-reload'),
  padreStop:    ()      => ipcRenderer.invoke('padre-stop'),
  setDivider:   (f)     => ipcRenderer.invoke('set-divider', f),

  // Phase 12 Risk Center
  getRiskCenterData: () => ipcRenderer.invoke('get-risk-center-data'),
  riskScanToken: (mint) => ipcRenderer.invoke('risk-scan-token', mint),
  riskClearEvents: () => ipcRenderer.invoke('risk-clear-events'),

  // Phase 13 Notifications + Event Center
  getNotificationEvents: () => ipcRenderer.invoke('get-notification-events'),
  getSystemEvidenceEvents: (limit=1200) => ipcRenderer.invoke('system-evidence-events', limit),
  notificationMarkRead: (id) => ipcRenderer.invoke('notification-mark-read', id),
  notificationAck: (id) => ipcRenderer.invoke('notification-ack', id),
  notificationMarkAllRead: () => ipcRenderer.invoke('notification-mark-all-read'),
  notificationClearAcknowledged: () => ipcRenderer.invoke('notification-clear-acknowledged'),

  // Intel
  dismissHealth:(addr)  => ipcRenderer.invoke('dismiss-health', addr),
  dismissSug:   (addr)  => ipcRenderer.invoke('dismiss-suggestion', addr),
  addSuggestion:(s)     => ipcRenderer.invoke('add-suggestion', s),
  intelWatchAdd:(item)   => ipcRenderer.invoke('intel-watchlist-add', item),
  intelWatchRemove:(a)   => ipcRenderer.invoke('intel-watchlist-remove', a),
  runHealthNow:()        => ipcRenderer.invoke('run-health-now'),

  // External
  openExternal: (url)   => ipcRenderer.invoke('open-external', url),

  // Early Bird
  getEarlyBirdData:  ()      => ipcRenderer.invoke('get-earlybird-data'),
  earlyBirdWatch:    (addr)  => ipcRenderer.invoke('earlybird-watch', addr),
  earlyBirdDismiss:  (addr)  => ipcRenderer.invoke('earlybird-dismiss', addr),
  earlyBirdRestore:  (addr)  => ipcRenderer.invoke('earlybird-restore', addr),
  earlyBirdScanNow:  ()      => ipcRenderer.invoke('earlybird-scan-now'),

  // Intel scanning
  scanWalletsNow:    ()      => ipcRenderer.invoke('scan-wallets-now'),

  // Token authority
  checkTokenAuthority: (mint) => ipcRenderer.invoke('check-token-authority', mint),

  // Trusted configs
  getTrustedConfig:     (addr)         => ipcRenderer.invoke('get-trusted-config', addr),
  saveTrustedConfig:    (addr, config) => ipcRenderer.invoke('save-trusted-config', addr, config),
  deleteTrustedConfig:  (addr)         => ipcRenderer.invoke('delete-trusted-config', addr),
  getTrustedConfigsAll: ()             => ipcRenderer.invoke('get-trusted-configs-all'),
  getDailyStats:        ()             => ipcRenderer.invoke('get-daily-stats'),
  getAutomationState:   ()             => ipcRenderer.invoke('get-automation-state'),
  setAutomationState:   (patch)        => ipcRenderer.invoke('set-automation-state', patch),

  // Phase 16 Ghost Trade Qualification
  getGhostData: () => ipcRenderer.invoke('ghost-get-data'),
  getTransactionLedger: (limit=500) => ipcRenderer.invoke('get-transaction-ledger',limit),
  getVerifiedOutcomes: (addr='',limit=500) => ipcRenderer.invoke('ghost-get-verified-outcomes',addr,limit),
  ghostStart: (addr,config) => ipcRenderer.invoke('ghost-start',addr,config),
  ghostSaveConfig: (addr,config) => ipcRenderer.invoke('ghost-save-config',addr,config),
  ghostStop: (addr) => ipcRenderer.invoke('ghost-stop',addr),
  ghostReset: (addr) => ipcRenderer.invoke('ghost-reset',addr),
  ghostPromoteLive: (addr) => ipcRenderer.invoke('ghost-promote-live',addr),
  getDynamicQualification: (addr) => ipcRenderer.invoke('ghost-get-dynamic-qualification',addr),
  ghostRequalify: (addr) => ipcRenderer.invoke('ghost-requalify',addr),
  ghostRefreshMarket: () => ipcRenderer.invoke('ghost-refresh-market'),
  getMarketStatus: () => ipcRenderer.invoke('market-status'),

  // PnL
  getOpenPositions: ()        => ipcRenderer.invoke('get-open-positions'),
  getClosedPositions: ()      => ipcRenderer.invoke('get-closed-positions'),
  getPositionQuotes: (mints)  => ipcRenderer.invoke('get-position-quotes', mints),
  checkPromotion:   (addr)    => ipcRenderer.invoke('check-promotion', addr),

  // Research Center
  researchSearch:      (query)   => ipcRenderer.invoke('research-search', query),
  getResearchEvidence:(mint)    => ipcRenderer.invoke('research-evidence-get', mint),
  getResearchWatchlist:()        => ipcRenderer.invoke('research-watchlist-get'),
  saveResearchWatch:   (token)   => ipcRenderer.invoke('research-watchlist-save', token),
  removeResearchWatch: (address) => ipcRenderer.invoke('research-watchlist-remove', address),

  // AI Research
  aiResearchSummary: (payload) => ipcRenderer.invoke('ai-research-summary', payload),
  getAiEngineData: (limit=250) => ipcRenderer.invoke('ai-engine-data', limit),
  getLearningEngineData: () => ipcRenderer.invoke('learning-engine-data'),
  rebuildLearningEngine: () => ipcRenderer.invoke('learning-engine-rebuild'),
  aiWalletQualification: (addr) => ipcRenderer.invoke('ai-wallet-qualification', addr),
  aiRiskExplain: (mint) => ipcRenderer.invoke('ai-risk-explain', mint),

  // Twitter
  twitterStartLogin:  ()       => ipcRenderer.invoke('twitter-start-login'),
  twitterSaveTokens:  (t)      => ipcRenderer.invoke('twitter-save-tokens', t),
  twitterGetTokens:   ()       => ipcRenderer.invoke('twitter-get-tokens'),
  twitterLogout:      ()       => ipcRenderer.invoke('twitter-logout'),
  twitterSearch:      (p)      => ipcRenderer.invoke('twitter-search', p),

  // Phase 18 Unified Helius Observation Engine
  getObservationHealth: () => ipcRenderer.invoke('observation-get-health'),
  getConnectionHealth: () => ipcRenderer.invoke('connection-health-data'),
  getExecutionSafety: (limit) => ipcRenderer.invoke('execution-safety-data', limit),
  checkConnectionHealth: () => ipcRenderer.invoke('connection-health-check'),
  pollObservationNow: () => ipcRenderer.invoke('observation-poll-now'),

  // Phase 33 AI Assistant Foundation
  getAssistantState: () => ipcRenderer.invoke('assistant-get-state'),
  newAssistantSession: (title) => ipcRenderer.invoke('assistant-new-session', title),
  selectAssistantSession: (id) => ipcRenderer.invoke('assistant-select-session', id),
  sendAssistantMessage: (id,text) => ipcRenderer.invoke('assistant-send-message', id, text),
  archiveAssistantSession: (id) => ipcRenderer.invoke('assistant-archive-session', id),
  checkAssistantPermission: (text) => ipcRenderer.invoke('assistant-permission-check', text),
  getAssistantAwareness: (query='') => ipcRenderer.invoke('assistant-awareness', query),
  routeAssistantCommand: (text) => ipcRenderer.invoke('assistant-route-command', text),
  getAssistantProposals: () => ipcRenderer.invoke('assistant-proposals'),
  confirmAssistantProposal: (id, token) => ipcRenderer.invoke('assistant-confirm-proposal', id, token),
  cancelAssistantProposal: (id) => ipcRenderer.invoke('assistant-cancel-proposal', id),
  getAssistantWalletAnalysis: (address) => ipcRenderer.invoke('assistant-wallet-analysis', address),
  compareAssistantWallets: (addresses) => ipcRenderer.invoke('assistant-wallet-compare', addresses),
  getAssistantTokenResearch: (mint) => ipcRenderer.invoke('assistant-token-research', mint),
  getAssistantTradeDecision: (text) => ipcRenderer.invoke('assistant-trade-decision', text),
  getAssistantShadowCoach: (address) => ipcRenderer.invoke('assistant-shadow-coach', address),
  getAssistantShadowRanking: () => ipcRenderer.invoke('assistant-shadow-ranking'),
  getAssistantRiskInvestigation: (mint, opts={}) => ipcRenderer.invoke('assistant-risk-investigation', mint, opts),
  getAssistantLearningAnalysis: () => ipcRenderer.invoke('assistant-learning-analysis'),
  getAssistantLearningProposal: (id) => ipcRenderer.invoke('assistant-learning-proposal', id),
  getAssistantPortfolioAnalysis: () => ipcRenderer.invoke('assistant-portfolio-analysis'),
  getPortfolioAccountingData: () => ipcRenderer.invoke('portfolio-accounting-data'),
  getLeaderboardEvidenceData: () => ipcRenderer.invoke('leaderboard-evidence-data'),
  getAssistantSafePreparation: (proposalId) => ipcRenderer.invoke('assistant-safe-preparation', proposalId),
  previewAssistantSafePreparation: (text) => ipcRenderer.invoke('assistant-safe-preparation-preview', text),
  createAssistantGovernedAction: (proposalId, actionType, payload={}) => ipcRenderer.invoke('assistant-governed-action-create', proposalId, actionType, payload),
  runAssistantGovernedAction: (id, confirmationToken) => ipcRenderer.invoke('assistant-governed-action-run', id, confirmationToken),
  getAssistantGovernedActions: () => ipcRenderer.invoke('assistant-governed-actions'),
  getAssistantMemory: () => ipcRenderer.invoke('assistant-memory-get'),
  getAssistantMemoryContext: (query) => ipcRenderer.invoke('assistant-memory-context', query),
  createAssistantMemory: (input, sessionId=null) => ipcRenderer.invoke('assistant-memory-create', input, sessionId),
  updateAssistantMemory: (id, patch) => ipcRenderer.invoke('assistant-memory-update', id, patch),
  archiveAssistantMemory: (id) => ipcRenderer.invoke('assistant-memory-archive', id),
  runAssistantFullLogicAudit: () => ipcRenderer.invoke('assistant-full-logic-audit'),
  getAssistantLogicAudit: () => ipcRenderer.invoke('assistant-logic-audit-get'),
  getProductionIntegrationAudit: () => ipcRenderer.invoke('production-integration-audit'),

  // Phase 14 Settings / Security / Persistence Center
  getSettingsCenterData: () => ipcRenderer.invoke('settings-center-data'),
  getIntegrityEngineData: () => ipcRenderer.invoke('integrity-engine-data'),
  runIntegrityAudit: () => ipcRenderer.invoke('integrity-engine-run'),
  saveSettingsSecure: (payload) => ipcRenderer.invoke('settings-save-secure', payload),
  clearSecret: (kind, provider) => ipcRenderer.invoke('settings-clear-secret', kind, provider),
  testConnection: (kind, provider) => ipcRenderer.invoke('settings-test-connection', kind, provider),
  exportBackup: () => ipcRenderer.invoke('settings-export-backup'),
  importBackup: () => ipcRenderer.invoke('settings-import-backup'),
  exportData: () => ipcRenderer.invoke('settings-export-data'),
  openDataFolder: () => ipcRenderer.invoke('settings-open-data-folder'),
  resetData: (scope, confirmation='') => ipcRenderer.invoke('settings-reset-data', scope, confirmation),

  // Settings (alias — same handler, kept for compatibility)
  saveSettingsFull:  (s)       => ipcRenderer.invoke('save-settings', s),

  // Events FROM main → renderer
  on: (channel, cb) => {
    const valid = ['trade','trade-update','trade-result','ws-status','health-alerts','padre-url-changed','padre-state','pnl-closed','twitter-oauth-callback','trade-blocked','bundle-detected','wallet-stats-updated','suggestion','earlybird-update','automation-state','risk-event','notification-event','ghost-update','observation-health','connection-health','assistant-update','padre-dom-ready'];
    if (valid.includes(channel)) {
      ipcRenderer.on(channel, (_e, ...args) => cb(...args));
    }
  },
  off: (channel, cb) => ipcRenderer.removeListener(channel, cb),
});
