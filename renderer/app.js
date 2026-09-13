'use strict';
const TITLES={dashboard:'Dashboard',feed:'Live Feed',wallets:'Wallets',positions:'Positions',ghost:'Ghost Mode',automation:'Automation',research:'Research',intelligence:'Intelligence',earlybird:'Early Bird',leaderboard:'Leaderboard',risk:'Risk Center',notifications:'Events',assistant:'AI Assistant',padre:'Padre Terminal',settings:'Settings'};
const PAGE_META={
  dashboard:{group:'Operations',phase:'CORE',context:'System-wide operational overview.',icon:'▦'},
  feed:{group:'Operations',phase:'P5+',context:'Live monitored-wallet activity and review queue.',icon:'◉'},
  wallets:{group:'Operations',phase:'P4+',context:'Wallet trust, history, qualification and controls.',icon:'◎'},
  positions:{group:'Operations',phase:'P8+',context:'Open exposure, realized positions and performance.',icon:'↗'},
  ghost:{group:'Operations',phase:'P21+',context:'Shadow portfolio testing and qualification pipeline.',icon:'◌'},
  automation:{group:'Operations',phase:'P9+',context:'Trusted automation rules and controlled execution state.',icon:'⚡'},
  research:{group:'Intelligence',phase:'P25+',context:'Evidence-backed token research and provenance.',icon:'⌕'},
  intelligence:{group:'Intelligence',phase:'P27+',context:'Wallet discovery, AI evidence and system intelligence.',icon:'◇'},
  earlybird:{group:'Intelligence',phase:'P24+',context:'Launch reconstruction and repeat early-buyer analysis.',icon:'✦'},
  leaderboard:{group:'Intelligence',phase:'P10+',context:'Comparative wallet performance views.',icon:'♛'},
  assistant:{group:'Intelligence',phase:'P47',context:'Evidence-grounded assistant, memory and governed pre-submit actions.',icon:'✦'},
  risk:{group:'Safety & Review',phase:'P26+',context:'Deterministic risk decisions, blocks and forensic evidence.',icon:'◈'},
  notifications:{group:'Safety & Review',phase:'P13+',context:'System events, warnings and acknowledgement queue.',icon:'◌'},
  padre:{group:'Tools & System',phase:'LIVE',context:'Dedicated Padre terminal workspace; final confirmation remains manual.',icon:'⬡'},
  settings:{group:'Tools & System',phase:'P31+',context:'Connections, security, persistence and application controls.',icon:'⚙'}
};

const PHASES={feed:5,wallets:4,positions:8,ghost:16,automation:9,research:7,intelligence:10,earlybird:11,leaderboard:10,risk:12,notifications:13,assistant:33,settings:14};
let currentPage='dashboard';
let padreState={url:'https://trade.padre.gg',loading:false,canGoBack:false,canGoForward:false,error:null,workspace:null};
let state={data:null,positions:[],closedPositions:[],positionQuotes:{},daily:{},trustedConfigs:{},automation:{enabled:false,paused:true,maxSolGlobal:2,maxAutomationRiskScore:45},ws:{connected:false},paused:false,dashboardPortfolio:null,dashboardLogicAudit:null,executionSafety:null,productionAudit:null};
let walletUi={tier:'all',query:'',sort:'recent',selected:null,intelligence:{},loading:new Set()};
let feedUi={filter:'all',query:'',sort:'newest',liveTrades:new Map(),newestId:null};
let researchUi={query:'',tokens:[],selected:null,watchlist:[],loading:false,ai:null};
let positionUi={tab:'verified',query:'',sort:'recent',selected:null,quotesLoading:false,lastQuoteAt:null,accounting:null};
let automationUi={selected:null,qualification:{},loading:new Set()};
let ghostUi={data:{wallets:{},ledger:[],defaults:{}},selected:null,query:'',filter:'all'};
let intelUi={tab:'discover',scanning:false,selected:null,selectedKind:null};
let leaderUi={query:'',tier:'all',sort:'score',selected:null,data:null};
let notifyUi={filter:'all',query:'',data:{events:[],unread:0,unacknowledged:0}};
let settings14Ui={tab:'connections',data:null};
let assistantUi={state:null,sending:false,permission:null,tab:'actions',memory:null,actions:null,audit:null,preparations:{}};
let riskUi={data:{events:[],counts:{},topFlags:[],hardBlocks:0,assessed:0},filter:'all',scan:null,loading:false,ai:null,aiLoading:false};
let earlyBirdUi={tab:'candidates',query:'',classification:'all',sort:'score',selected:null,data:{wallets:{},runs:[],scanHistory:[],scanState:{running:false,progress:0,stage:'idle',message:'Ready'},config:{}}};
let toastTimer=null;
const $=id=>document.getElementById(id);
function esc(v=''){return String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function toast(msg,{urgent=false,duration=3200}={}){const el=$('toast');if(!el)return;el.setAttribute('role',urgent?'alert':'status');el.setAttribute('aria-live',urgent?'assertive':'polite');el.textContent=msg;el.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove('show'),duration)}
function fmtTime(ts){if(!ts)return '—';const d=new Date(ts);return Number.isNaN(d.getTime())?'—':d.toLocaleTimeString([],{hour:'numeric',minute:'2-digit'});}
function shortAddr(a=''){return a.length>14?`${a.slice(0,6)}…${a.slice(-4)}`:a||'Unknown';}
function dayKey(ts){const d=new Date(ts||0);return Number.isNaN(d.getTime())?'':d.toISOString().slice(0,10);}
function placeholder(id){const phase=PHASES[id]||2;const desc={feed:'The dedicated real-time trade approval center will be built here.',wallets:'Full wallet profiles, trust tiers and management controls will be built here.',positions:'Open and closed positions, exposure, P&L and protection controls will be built here.',research:'Token search, copycat detection, authority checks and AI research will be built here.',intelligence:'Wallet discovery, health, watchlists and coordinated-activity signals will be built here.',earlybird:'The early-entry discovery engine gets its own workspace here.',leaderboard:'Comparative wallet performance and rankings will be built here.',assistant:'Persistent governed CopyGuard assistant workspace.',settings:'Connections, AI, risk, security, appearance and data controls will be built here.'}[id];return `<div class="placeholder"><div class="placeholder-inner"><div class="big-icon">${id==='wallets'?'◎':id==='positions'?'↗':id==='research'?'⌕':id==='intelligence'?'◇':id==='earlybird'?'✦':id==='leaderboard'?'♛':id==='settings'?'⚙':'◉'}</div><span class="placeholder-kicker">COPYGUARD 3.0</span><h2>${TITLES[id]}</h2><p>${desc}</p><span class="phase-tag">FULL BUILD SCHEDULED · PHASE ${phase}</span></div></div>`;}
async function go(page){if(!TITLES[page])page='dashboard';currentPage=page;document.querySelectorAll('.nav-item').forEach(x=>{const active=x.dataset.page===page;x.classList.toggle('active',active);if(active)x.setAttribute('aria-current','page');else x.removeAttribute('aria-current');});document.querySelectorAll('.page').forEach(x=>x.classList.remove('active'));const pane=$('page-'+page);if(!pane)return;pane.classList.add('active');$('page-title').textContent=TITLES[page];const meta=PAGE_META[page]||{};if($('page-breadcrumb'))$('page-breadcrumb').textContent=meta.group||'Workspace';if($('page-phase'))$('page-phase').textContent=meta.phase||'CORE';if($('page-context'))$('page-context').textContent=meta.context||'';requestAnimationFrame(()=>{$('page-title')?.focus({preventScroll:true});});try{localStorage.setItem('copyguard-last-page',page);}catch{}closeCommandPalette48();
  // Clear Early Bird badge when user opens that tab
  if(page==='earlybird'){const b=$('eb-nav-badge');if(b)b.style.display='none';}if(page!=='dashboard'&&page!=='padre'&&page!=='wallets'&&page!=='feed'&&page!=='research'&&page!=='automation'&&page!=='ghost'&&page!=='earlybird'&&page!=='risk'&&page!=='notifications'&&page!=='assistant'&&page!=='settings'&&!pane.dataset.loaded){pane.innerHTML=placeholder(page);pane.dataset.loaded='1';}if(page==='wallets')renderWallets();if(page==='automation')renderAutomation();if(page==='ghost')renderGhost16();if(page==='feed'){renderFeed();const badge=$('feed-badge');if(badge){badge.textContent='0';badge.style.display='none';}}if(page==='intelligence')renderIntelligence();if(page==='risk')renderRiskCenter();if(page==='notifications')renderNotifications13();if(page==='assistant'){await refreshAssistant33();renderAssistant33();}if(page==='settings')refreshSettings14();if(page==='earlybird')renderEarlyBird11();if(page==='leaderboard')renderLeaderboard();if(page==='research'){renderResearch();const pending=sessionStorage.getItem('copyguard-research-token');if(pending){sessionStorage.removeItem('copyguard-research-token');const input=$('research-query');if(input)input.value=pending;await runResearch(pending);}}if(page==='padre'){requestAnimationFrame(syncPadreView);}else{await window.cg.padreHide?.();}}
function walletCounts(wallets){const counts={trusted:0,pending:0,ghost:0,paused:0,blacklisted:0,other:0};for(const w of Object.values(wallets||{})){const t=(w.tier||'pending').toLowerCase();if(t in counts)counts[t]++;else counts.other++;}return counts;}
function renderActivity(history){const box=$('recent-activity');if(!history.length){box.innerHTML='<div class="empty-state"><b>No saved trades yet</b><span>New monitored wallet activity will appear here automatically.</span></div>';return;}box.innerHTML=history.slice(0,7).map(t=>{const action=(t.action||'TRADE').toUpperCase();const cls=action==='BUY'?'buy':action==='SELL'?'sell':'neutral';const decision=(t.decision||'SAVED').toUpperCase();const dcls=decision.includes('REJECT')||decision.includes('BLOCK')?'bad':decision.includes('APPROV')||decision.includes('AUTO')?'good':'wait';return `<div class="activity-row"><div class="trade-action ${cls}">${esc(action)}</div><div class="activity-main"><b>${esc(t.tokenSymbol?`$${t.tokenSymbol}`:(t.token||shortAddr(t.tokenAddress)))}</b><small>${esc(t.walletLabel||shortAddr(t.walletAddress))} · ${fmtTime(t.timestamp||t.savedAt)}</small></div><div class="activity-size"><b>${Number(t.sizeSol||0).toFixed(3)} SOL</b><small>${t.fdv?`FDV $${Number(t.fdv).toLocaleString()}`:'tracked trade'}</small></div><span class="decision ${dcls}">${esc(decision)}</span></div>`;}).join('');}
function renderRisk(data){const alerts=(data.healthAlerts||[]).filter(x=>!x.dismissed);const history=data.history||[];const bundle=history.filter(h=>h.bundleAlert?.detected).slice(0,3).map(h=>({type:'Bundle signal',message:h.bundleAlert.message||'Coordinated wallet activity detected',severity:h.bundleAlert.severity||'MEDIUM'}));const items=[...alerts.slice(0,4).map(a=>({type:a.title||'Wallet health',message:a.message||a.reason||shortAddr(a.walletAddress),severity:a.severity||'MEDIUM'})),...bundle].slice(0,5);$('risk-count').textContent=items.length;if(!items.length){$('risk-list').innerHTML='<div class="empty-state compact"><b>No active risk alerts</b><span>CopyGuard has nothing requiring attention right now.</span></div>';return;}$('risk-list').innerHTML=items.map(i=>`<div class="risk-row"><span class="risk-dot ${(i.severity||'').toLowerCase()}"></span><div><b>${esc(i.type)}</b><small>${esc(i.message)}</small></div><em>${esc(i.severity||'WATCH')}</em></div>`).join('');}
function renderServices(){const d=state.data||{},settings=d.settings||{},h=d.connectionHealth||{},sv=h.services||{};const tone=x=>x==='ONLINE'||x==='READY'?'live':x==='CONNECTING'||x==='DEGRADED'||x==='STALE'||x==='RATE_LIMITED'?'warn':'off';const aiState=sv.ai?.state||(settings.apiKeys?.[settings.aiProvider]?'READY':'UNCONFIGURED');const services=[['System Mode',h.mode||'STARTING',h.mode==='FULL'?'live':h.mode==='DEGRADED'?'warn':'off',h.reason||'Connection baseline building'],['Helius',sv.helius?.state||(state.ws.connected?'ONLINE':settings.heliusApiKey?'CONNECTING':'UNCONFIGURED'),tone(sv.helius?.state||(state.ws.connected?'ONLINE':'CONNECTING')),h.observationLagMs==null?'Observation lag unknown':`Observation lag ${Math.round(h.observationLagMs/1000)}s`],['Market Pricing',sv.dexscreener?.state||'UNKNOWN',tone(sv.dexscreener?.state),h.marketAgeMs==null?'Quote age unknown':`Newest quote ${Math.round(h.marketAgeMs/1000)}s old`],['AI Analysis',aiState,tone(aiState),d.aiProviderName||'AI provider'],['Padre Terminal',sv.padre?.state||'UNKNOWN',tone(sv.padre?.state),'Execution-critical terminal'],['Local Persistence','READY','live','Phase 30 integrity protected']];$('service-list').innerHTML=services.map(s=>`<div class="service"><span class="service-icon">${s[2]==='live'?'●':s[2]==='warn'?'◐':'○'}</span><div><b>${s[0]}</b><small>${esc(s[3])}</small></div><strong class="${s[2]}">${s[1]}</strong></div>`).join('');}
function renderTiers(wallets){const c=walletCounts(wallets),total=Math.max(1,Object.values(wallets||{}).length);const rows=[['Trusted',c.trusted,'trusted'],['Pending',c.pending,'pending'],['Ghost',c.ghost,'ghost'],['Paused',c.paused,'paused'],['Blacklisted',c.blacklisted,'blacklisted']];$('tier-bars').innerHTML=rows.map(([n,v,cl])=>`<div class="tier-row"><div><span>${n}</span><b>${v}</b></div><div class="bar"><i class="${cl}" style="width:${Math.round(v/total*100)}%"></i></div></div>`).join('');}

// ── PHASE 49 · Dashboard Command Center ────────────────────
function dash49ToneClass(v=''){
  const x=String(v||'').toUpperCase();
  if(['PASS','FULL','LIVE','ONLINE','READY','HEALTHY','IMPROVING','QUALIFIED'].some(k=>x.includes(k)))return 'positive';
  if(['FAIL','DEGRADED','OFFLINE','CRITICAL','BLOCKED','WEAKENING'].some(k=>x.includes(k)))return 'negative';
  return 'warning';
}
function dash49SetText(id,text,cls=null){const el=$(id);if(!el)return;el.textContent=text;if(cls!==null)el.className=cls;}
function renderCommandAttention49(){
  const d=state.data||{},h=d.connectionHealth||{},alerts=(d.healthAlerts||[]).filter(x=>!x.dismissed),riskCount=Number($('risk-count')?.textContent||0),parts=[];
  if(h.mode==='DEGRADED')parts.push({tone:'negative',label:'DEGRADED MODE',value:h.reason||'Execution-critical service unavailable'});
  if(state.automation.paused)parts.push({tone:'warning',label:'AUTOMATION PAUSED',value:'Trusted auto execution is currently disabled'});
  if(riskCount>0)parts.push({tone:'negative',label:'RISK ATTENTION',value:`${riskCount} current item${riskCount===1?'':'s'} need review`});
  if(alerts.length)parts.push({tone:'warning',label:'WALLET HEALTH',value:`${alerts.length} active wallet health alert${alerts.length===1?'':'s'}`});
  if(!parts.length)parts.push({tone:'positive',label:'NO URGENT BLOCKERS',value:'No current system or risk condition requires immediate review'});
  const box=$('command-attention-summary');if(box)box.innerHTML=parts.slice(0,4).map(x=>`<div class="attention-chip49 ${x.tone}"><span>${x.label}</span><b>${esc(x.value)}</b></div>`).join('');
}
function renderPortfolio49(){
  const a=state.dashboardPortfolio||{},v=a.verifiedPerformance||{},e=a.shadowExposure||{},m=a.markedPortfolio||{},t=a.trend||{},attr=a.attribution||{};
  const pnl=Number(v.realizedPnlSol||0),unreal=Number(e.unrealizedPnlSol||0),stake=Number(e.remainingStakeSol||0),equity=Number(e.markedEquitySol||0);
  dash49SetText('metric-verified-pnl',`${pnl>=0?'+':''}${pnl.toFixed(4)} SOL`,pnl>0?'positive':pnl<0?'negative':'');
  dash49SetText('metric-verified-outcomes',`${Number(v.completedOutcomes||0)} verified closes`);
  dash49SetText('metric-verified-winrate',`${Number(v.winRatePct||0).toFixed(1)}% win rate`);
  dash49SetText('metric-shadow-exposure',`${stake.toFixed(4)} SOL`);
  dash49SetText('metric-shadow-open',`${Number(e.count||0)} open lots`);
  dash49SetText('metric-shadow-unrealized',`${unreal>=0?'+':''}${unreal.toFixed(4)} unrealized`,unreal>0?'positive':unreal<0?'negative':'');
  dash49SetText('portfolio-realized49',`${pnl>=0?'+':''}${pnl.toFixed(4)}`,pnl>0?'positive':pnl<0?'negative':'');
  dash49SetText('portfolio-unrealized49',`${unreal>=0?'+':''}${unreal.toFixed(4)}`,unreal>0?'positive':unreal<0?'negative':'');
  dash49SetText('portfolio-drawdown49',`${Number(t.maxDrawdownPct||0).toFixed(2)}%`);
  dash49SetText('portfolio-equity49',`${equity.toFixed(4)} SOL`);
  dash49SetText('portfolio-trend49',String(t.direction||'INSUFFICIENT_HISTORY').replaceAll('_',' '),dash49ToneClass(t.direction));
  dash49SetText('portfolio-trend-chip',String(t.direction||'NO HISTORY').replaceAll('_',' '),`status-chip49 ${dash49ToneClass(t.direction)}`);
  const contributors=$('portfolio-contributors49'),rows=(attr.topWallets||[]).slice(0,3);
  if(contributors)contributors.innerHTML=rows.length?rows.map((x,i)=>`<div class="contributor-row49"><span>#${i+1}</span><div><b>${esc(x.label||shortAddr(x.walletAddress||''))}</b><small>${Number(x.outcomes||0)} verified outcomes · ${Number(x.winRatePct||0).toFixed(1)}% WR</small></div><strong class="${Number(x.realizedPnlSol||0)>=0?'positive':'negative'}">${Number(x.realizedPnlSol||0)>=0?'+':''}${Number(x.realizedPnlSol||0).toFixed(4)}</strong></div>`).join(''):'<div class="command-empty49">No source-verified closed outcomes yet.</div>';
}
function renderIntelligence49(){
  const d=state.data||{},settings=d.settings||{},learning=d.learningEngine||{},assistant=d.assistantEngine||{},audit=state.dashboardLogicAudit||assistant.logicAudit||{};
  const provider=d.aiProviderName||'AI',hasAI=!!settings.apiKeys?.[settings.aiProvider];
  dash49SetText('metric-ai-dashboard',provider);dash49SetText('metric-ai-key-dashboard',hasAI?'API key ready':'No API key detected');
  dash49SetText('assistant-ready49',assistant.policy||'GOVERNED','positive');
  dash49SetText('assistant-sessions49',`${Number(assistant.sessionCount||0)} sessions`);
  dash49SetText('learning-links49',Number(learning.summary?.linkedOutcomes||0));
  dash49SetText('learning-proposals49',`${Number(learning.proposalCount||0)} advisory proposals`);
  dash49SetText('assistant-audit49',audit.status||'UNKNOWN',dash49ToneClass(audit.status));
}
function renderCommandState49(){
  const d=state.data||{},h=d.connectionHealth||{},integrity=d.integrity?.status||state.dashboardLogicAudit?.status||'UNKNOWN';
  const mode=h.mode||(state.ws.connected?'LIVE':'READY');
  dash49SetText('command-auto-state',state.automation.paused?'PAUSED':d.settings?.autoExecute?'ACTIVE':'MANUAL',state.automation.paused?'warning':d.settings?.autoExecute?'positive':'');
  dash49SetText('command-integrity-state',integrity,dash49ToneClass(integrity));
  dash49SetText('command-observation-state',state.ws.connected?'LIVE':d.settings?.heliusApiKey?'CONNECTING':'OFFLINE',state.ws.connected?'positive':'warning');
  const ring=$('command-state-ring');if(ring)ring.dataset.tone=dash49ToneClass(mode);
}
function renderProductionAudit65(){
  const a=state.productionAudit||{},status=$('production-audit-status65'),summary=$('production-audit-summary65'),box=$('production-audit-checks65');
  if(status){status.textContent=a.status||'UNKNOWN';status.className=dash49ToneClass(a.status||'UNKNOWN');}
  if(summary){const s=a.summary||{};summary.textContent=a.generatedAt?`${Number(s.passed||0)} pass · ${Number(s.warnings||0)} warn · ${Number(s.failures||0)} fail · ${fmtTime(a.generatedAt)}`:'Audit not loaded';}
  if(box){const rows=Array.isArray(a.checks)?a.checks:[];box.innerHTML=rows.length?rows.slice(0,6).map(x=>`<div class="production65-check ${String(x.status||'').toLowerCase()}"><b>${esc(x.status||'CHECK')}</b><span>${esc(x.title||x.id||'Integration check')}</span></div>`).join(''):'<div class="production65-empty">Run the production audit to verify cross-system invariants.</div>';}
}
async function refreshProductionAudit65(){try{state.productionAudit=await window.cg.getProductionIntegrationAudit?.();renderProductionAudit65();return state.productionAudit;}catch(e){console.error('[Production65]',e);toast('Production integration audit could not complete. No execution state was changed.',{urgent:true});return null;}}

function renderDashboard49(){renderPortfolio49();renderIntelligence49();renderCommandState49();renderCommandAttention49();renderProductionAudit65();}

function renderDashboard(){const d=state.data||{},wallets=d.wallets||{},history=d.history||[],settings=d.settings||{};const c=walletCounts(wallets);const today=new Date().toISOString().slice(0,10);const todayTrades=history.filter(h=>dayKey(h.timestamp||h.savedAt)===today);const copied=todayTrades.filter(h=>['APPROVED','AUTO'].includes((h.decision||'').toUpperCase())).length;const blocked=todayTrades.filter(h=>['REJECTED','BLOCKED'].includes((h.decision||'').toUpperCase())).length;const exposure=state.positions.reduce((s,p)=>s+Number(p.sizeSol||p.entrySol||0),0);$('metric-wallets').textContent=Object.keys(wallets).length;$('metric-trusted').textContent=`${c.trusted} trusted`;$('metric-pending').textContent=`${c.pending} pending`;$('metric-positions').textContent=state.positions.length;$('metric-exposure').textContent=`${exposure.toFixed(2)} SOL tracked`;$('metric-today').textContent=todayTrades.length;$('metric-approved').textContent=`${copied} copied`;$('metric-blocked').textContent=`${blocked} blocked`;$('metric-ai').textContent=d.aiProviderName||'AI';const hasAI=!!settings.apiKeys?.[settings.aiProvider];$('metric-ai-key').textContent=hasAI?'API key ready':'No API key detected';$('ai-status').textContent=d.aiProviderName||'—';$('auto-state').textContent=state.automation.paused?'PAUSED':settings.autoExecute?'ON':'OFF';$('auto-state').className=state.automation.paused?'negative':settings.autoExecute?'positive':'';$('max-sol').textContent=`${Number(settings.maxSolGlobal||0).toFixed(2)} SOL`;$('trusted-configs').textContent=Object.keys(state.trustedConfigs||{}).length;const dailyAuto=Object.values(state.daily||{}).reduce((s,x)=>s+Number(x.trades||0),0);$('daily-auto').textContent=dailyAuto;const dot=$('helius-dot');dot.classList.toggle('live',!!state.ws.connected);$('helius-status').textContent=state.ws.connected?'Live':settings.heliusApiKey?'Connecting':'Offline';$('hero-state').textContent=state.ws.connected?'LIVE':'READY';$('hero-sub').textContent=state.ws.connected?'Helius stream connected':'Local core online';renderActivity(history);renderRisk(d);renderServices();renderTiers(wallets);renderDashboard49();}


function walletTier(w){return String(w?.tier||'pending').toLowerCase();}
function walletStats(w={}){const st=w.stats||{};return {trades:Number(st.totalTrades||0),wins:Number(st.wins||0),losses:Number(st.losses||0),pnl:Number(st.totalPnl||0),winRate:Number(st.winRate||0),avgPnl:Number(st.avgPnl||0)};}
function walletHistory(addr){return (state.data?.history||[]).filter(t=>t.walletAddress===addr).sort((a,b)=>Number(b.timestamp||b.savedAt||0)-Number(a.timestamp||a.savedAt||0));}
function walletPositionCount(addr){return (state.positions||[]).filter(p=>p.walletAddress===addr).length;}
function walletInitial(w,addr){const label=(w?.label||'').replace(/[^a-z0-9]/gi,'').trim();return (label.slice(0,2)||addr.slice(0,2)||'CG').toUpperCase();}
function fmtPnl(n){n=Number(n||0);return `${n>=0?'+':''}${n.toFixed(2)}`;}
function tierLabel(t){return ({trusted:'Trusted',pending:'Pending',ghost:'Ghost',paused:'Paused',blacklisted:'Blacklisted'})[t]||'Pending';}
function renderWalletSummary(wallets){const c=walletCounts(wallets),vals=Object.values(wallets||{}),pnl=vals.reduce((s,w)=>s+walletStats(w).pnl,0);$('wallet-summary').innerHTML=[['TOTAL WALLETS',vals.length,'All monitored wallets',''],['TRUSTED',c.trusted,'Eligible for trusted rules','trusted'],['PENDING',c.pending,'Manual review tier','pending'],['GHOST',c.ghost,'Paper qualification tier','ghost'],['PAUSED',c.paused,'Tracked without action',''],['COMBINED P&L',`${pnl>=0?'+':''}${pnl.toFixed(2)}`,'Saved wallet performance',pnl<0?'blacklisted':'trusted']].map(x=>`<div class="wallet-summary-card ${x[3]}"><span>${x[0]}</span><strong>${x[1]}</strong><small>${x[2]}</small></div>`).join('');}
function sortedWalletEntries(wallets){let rows=Object.entries(wallets||{});const q=walletUi.query.toLowerCase().trim();rows=rows.filter(([addr,w])=>(walletUi.tier==='all'||walletTier(w)===walletUi.tier)&&(!q||addr.toLowerCase().includes(q)||String(w.label||'').toLowerCase().includes(q)));rows.sort((a,b)=>{const [aa,wa]=a,[ab,wb]=b,sa=walletStats(wa),sb=walletStats(wb);if(walletUi.sort==='pnl')return sb.pnl-sa.pnl;if(walletUi.sort==='winrate')return sb.winRate-sa.winRate;if(walletUi.sort==='trades')return sb.trades-sa.trades;if(walletUi.sort==='name')return String(wa.label||aa).localeCompare(String(wb.label||ab));return Number(wb.addedAt||0)-Number(wa.addedAt||0);});return rows;}
function renderWalletList(){const wallets=state.data?.wallets||{},rows=sortedWalletEntries(wallets),box=$('wallet-list');if(!box)return;if(!rows.length){box.innerHTML='<div class="wallet-empty-list"><div><b>No wallets match this view</b><span>Add a wallet or change the current search/filter.</span></div></div>';return;}box.innerHTML=rows.map(([addr,w])=>{const st=walletStats(w),tier=walletTier(w),sel=walletUi.selected===addr?' selected':'';return `<div class="wallet-row${sel}" data-wallet="${esc(addr)}"><div class="wallet-avatar">${esc(walletInitial(w,addr))}</div><div class="wallet-main"><b>${esc(w.label||'Unnamed Wallet')}</b><small>${esc(shortAddr(addr))}</small></div><div class="wallet-stat"><span>WIN RATE</span><b>${st.winRate.toFixed(1)}%</b></div><div class="wallet-stat"><span>P&L</span><b class="${st.pnl>0?'positive':st.pnl<0?'negative':''}">${fmtPnl(st.pnl)}</b></div><span class="tier-pill ${tier}">${tierLabel(tier)}</span><span class="wallet-chevron">›</span></div>`;}).join('');}

function wallet51Fmt(v,suffix='',digits=1){
  if(v===null||v===undefined||!Number.isFinite(Number(v)))return '—';
  return `${Number(v).toFixed(digits)}${suffix}`;
}
function wallet51CheckLabel(k){return ({sample:'Verified sample',verified:'Source verification',winRate:'Win rate',roi:'ROI',profitFactor:'Profit factor',drawdown:'Max drawdown',hardBlocks:'Hard-block rate'})[k]||k;}
function wallet51CheckDetail(k,current,thresholds={}){
  const map={
    sample:`${Number(current?.completedTrades||0)} / ${Number(thresholds.minCompletedTrades||0)} closes`,
    verified:`${wallet51Fmt(current?.verifiedCoveragePct,'%',1)} / 100%`,
    winRate:`${wallet51Fmt(current?.winRatePct,'%',1)} / ${wallet51Fmt(thresholds.minWinRatePct,'%',1)}`,
    roi:`${wallet51Fmt(current?.roiPct,'%',1)} / ${wallet51Fmt(thresholds.minRoiPct,'%',1)}`,
    profitFactor:`${wallet51Fmt(current?.profitFactor,'',2)} / ${wallet51Fmt(thresholds.minProfitFactor,'',2)}`,
    drawdown:`${wallet51Fmt(current?.maxDrawdownPct,'%',1)} ≤ ${wallet51Fmt(thresholds.maxDrawdownPct,'%',1)}`,
    hardBlocks:`≤ ${wallet51Fmt(thresholds.maxHardBlockRatePct,'%',1)}`
  };return map[k]||'';
}
async function loadWalletIntelligence51(addr,{force=false}={}){
  if(!addr||(!force&&walletUi.intelligence[addr])||walletUi.loading.has(addr))return;
  walletUi.loading.add(addr);renderWalletDetail();
  try{
    const [analysis,coach,dynamic]=await Promise.all([
      window.cg.getAssistantWalletAnalysis?.(addr).catch(()=>null),
      window.cg.getAssistantShadowCoach?.(addr).catch(()=>null),
      window.cg.getDynamicQualification?.(addr).catch(()=>null)
    ]);
    walletUi.intelligence[addr]={analysis,coach,dynamic,loadedAt:Date.now()};
  }catch(e){walletUi.intelligence[addr]={error:e.message||String(e),loadedAt:Date.now()};}
  finally{walletUi.loading.delete(addr);if(walletUi.selected===addr)renderWalletDetail();}
}
function renderWalletDetail(){
  const box=$('wallet-detail');if(!box)return;const addr=walletUi.selected,w=state.data?.wallets?.[addr];
  if(!addr||!w){box.innerHTML='<div class="wallet-detail-empty"><span>◎</span><b>Select a wallet</b><small>Choose a wallet to inspect verified performance, Shadow qualification, risk history, discovery provenance and controls.</small></div>';return;}
  const basic=walletStats(w),tier=walletTier(w),hist=walletHistory(addr),positions=walletPositionCount(addr),last=hist[0],intel=walletUi.intelligence[addr],loading=walletUi.loading.has(addr);
  const a=intel?.analysis||{},coach=intel?.coach||{},dyn=intel?.dynamic||{},v=a.verified||{},q=a.qualification||{},risk=a.risk||{},disc=a.discovery||{},trend=a.trend||{};
  const qualified=!!coach?.qualification?.qualified||a.analystGrade==='QUALIFIED'||q.state==='QUALIFIED';
  const progress=Number(coach?.qualification?.progressPct??q.progressPct??0);
  const needs=coach?.qualification?.needs||[];
  const thresholds=q.thresholds||{},passed=new Set(q.passedChecks||[]),failed=new Set(q.failedChecks||[]);
  const checkKeys=['sample','verified','winRate','roi','profitFactor','drawdown','hardBlocks'];
  const dynState=dyn.state||q.state||a.shadow?.status||'NOT TESTING';
  const trustedButton=tier==='trusted'
    ? `<button class="wallet-action trust" data-wallet-action="trusted">⚙ Trusted Configuration</button>`
    : qualified
      ? `<button class="wallet-action trust" data-wallet-action="trusted">✓ Review Trusted Promotion</button>`
      : `<button class="wallet-action trust disabled" disabled title="Complete deterministic Shadow qualification first">⌛ Qualification Required</button>`;
  const requalify=['AUTO_PAUSED','REQUALIFYING','WARNING'].includes(String(dynState).toUpperCase())
    ? `<button class="wallet-action warning" data-wallet-action="requalify">↻ Requalify in Shadow</button>`:'';
  box.innerHTML=`
    <div class="wallet-profile-head wallet-profile-head51">
      <div class="wallet-profile-id"><div class="wallet-avatar">${esc(walletInitial(w,addr))}</div><div><h3>${esc(w.label||'Unnamed Wallet')}</h3><code>${esc(addr)}</code></div></div>
      <div class="wallet-profile-actions51"><button class="copy-address" data-copy-address="${esc(addr)}">COPY ADDRESS</button><button class="copy-address" data-wallet-refresh51="${esc(addr)}">↻ REFRESH EVIDENCE</button></div>
    </div>
    <div class="wallet-status-strip51">
      <div><span>TRUST TIER</span><b><span class="tier-pill ${tier}">${tierLabel(tier)}</span></b></div>
      <div><span>ANALYST GRADE</span><b class="${a.analystGrade==='QUALIFIED'?'positive':a.analystGrade==='DATA_QUALITY_BLOCK'?'negative':'warning'}">${esc(a.analystGrade||'LOADING')}</b></div>
      <div><span>DYNAMIC STATE</span><b class="${['LIVE_HEALTHY','QUALIFIED'].includes(dynState)?'positive':['AUTO_PAUSED'].includes(dynState)?'negative':'warning'}">${esc(String(dynState).replaceAll('_',' '))}</b></div>
      <div><span>SHADOW PROGRESS</span><b>${progress.toFixed(0)}%</b></div>
    </div>
    ${loading?'<div class="wallet-loading51">Loading verified qualification evidence…</div>':''}
    <div class="detail-section wallet-verification51">
      <div class="detail-section-head"><span>VERIFIED PERFORMANCE</span><span>Fully closed · source verified only</span></div>
      <div class="detail-stats detail-stats51">
        <div class="detail-stat"><span>VERIFIED CLOSES</span><strong>${v.completedTrades??0}</strong></div>
        <div class="detail-stat"><span>WIN RATE</span><strong>${wallet51Fmt(v.winRatePct,'%',1)}</strong></div>
        <div class="detail-stat"><span>ROI</span><strong class="${Number(v.roiPct||0)>0?'positive':Number(v.roiPct||0)<0?'negative':''}">${wallet51Fmt(v.roiPct,'%',1)}</strong></div>
        <div class="detail-stat"><span>PROFIT FACTOR</span><strong>${wallet51Fmt(v.profitFactor,'',2)}</strong></div>
        <div class="detail-stat"><span>MAX DRAWDOWN</span><strong>${wallet51Fmt(v.maxDrawdownPct,'%',1)}</strong></div>
        <div class="detail-stat"><span>VERIFIED COVERAGE</span><strong class="${Number(v.verifiedCoveragePct||0)>=100?'positive':'warning'}">${wallet51Fmt(v.verifiedCoveragePct,'%',1)}</strong></div>
      </div>
      <div class="wallet-accounting-note51">Open and partially realized Shadow lots are context only. They do not count as completed qualification outcomes.</div>
    </div>
    <div class="detail-section">
      <div class="detail-section-head"><span>DETERMINISTIC QUALIFICATION</span><span>${qualified?'ALL CHECKS PASS':`${needs.length||failed.size} requirement${(needs.length||failed.size)===1?'':'s'} remaining`}</span></div>
      <div class="qualification-progress51"><div><i style="width:${Math.max(0,Math.min(100,progress))}%"></i></div><b>${progress.toFixed(0)}%</b></div>
      <div class="qualification-checks51">${checkKeys.map(k=>{
        const ok=passed.has(k)||coach?.qualification?.checks?.[k]===true;
        const known=passed.has(k)||failed.has(k)||coach?.qualification?.checks?.[k]!==undefined;
        return `<div class="qualification-check51 ${ok?'pass':known?'fail':'unknown'}"><span>${ok?'✓':known?'×':'?'}</span><div><b>${wallet51CheckLabel(k)}</b><small>${esc(wallet51CheckDetail(k,v,thresholds)|| (known?(ok?'Requirement passed':'Requirement not met'):'No Shadow evidence yet'))}</small></div></div>`;
      }).join('')}</div>
      ${needs.length?`<div class="qualification-next51"><span>NEXT REQUIREMENT</span><b>${esc(needs[0].message||needs[0].check||'Continue verified Shadow testing')}</b></div>`:`<div class="qualification-next51 pass"><span>NEXT STEP</span><b>${qualified?'Qualification passes. Trusted promotion remains a separate explicit action.':'Start or continue Shadow testing.'}</b></div>`}
    </div>
    <div class="wallet-intel-grid51">
      <div class="detail-section">
        <div class="detail-section-head"><span>SHADOW / DYNAMIC HEALTH</span></div>
        <div class="wallet-kv51"><div><span>State</span><b>${esc(String(dynState).replaceAll('_',' '))}</b></div><div><span>Open lots</span><b>${Number(a.shadow?.openPositions||0)}</b></div><div><span>Partial lots</span><b>${Number(a.shadow?.partialRealizations||0)}</b></div><div><span>Recent trend</span><b class="${trend.direction==='IMPROVING'?'positive':trend.direction==='WEAKENING'?'negative':'warning'}">${esc(String(trend.direction||'INSUFFICIENT_HISTORY').replaceAll('_',' '))}</b></div></div>
        ${q.reason?`<div class="wallet-note">${esc(q.reason)}</div>`:''}
      </div>
      <div class="detail-section">
        <div class="detail-section-head"><span>RISK HISTORY</span><span>${Number(risk.total||0)} decisions</span></div>
        <div class="risk-counts51"><div><span>PASS</span><b class="positive">${Number(risk.counts?.PASS||0)}</b></div><div><span>CAUTION</span><b class="warning">${Number(risk.counts?.CAUTION||0)}</b></div><div><span>HARD BLOCK</span><b class="negative">${Number(risk.counts?.HARD_BLOCK||0)}</b></div></div>
        <div class="risk-signals51">${(risk.topSignals||[]).slice(0,4).map(x=>`<span>${esc(x.signal)} <b>${x.count}</b></span>`).join('')||'<small>No recorded deterministic risk signals.</small>'}</div>
      </div>
      <div class="detail-section">
        <div class="detail-section-head"><span>DISCOVERY PROVENANCE</span></div>
        ${a.discovery?`<div class="wallet-kv51"><div><span>Discovery score</span><b>${Number(disc.score||0)}/100</b></div><div><span>Gate</span><b>${esc(disc.gate||'UNKNOWN')}</b></div><div><span>Independent repeat</span><b>${Number(disc.historicalRepeat||0)}</b></div><div><span>Cluster penalty</span><b>${Number(disc.clusterPenalty||0)}</b></div></div>`:'<div class="wallet-note">No Phase 27 discovery provenance is attached to this wallet.</div>'}
      </div>
      <div class="detail-section">
        <div class="detail-section-head"><span>ROLLING QUALIFICATION</span></div>
        <div class="wallet-kv51"><div><span>Rolling sample</span><b>${q.rolling?.rollingSample??'—'}</b></div><div><span>Rolling win rate</span><b>${wallet51Fmt(q.rolling?.rollingWinRatePct,'%',1)}</b></div><div><span>Rolling ROI</span><b>${wallet51Fmt(q.rolling?.rollingRoiPct,'%',1)}</b></div><div><span>Loss streak</span><b>${q.rolling?.rollingConsecutiveLosses??'—'}</b></div></div>
      </div>
    </div>
    <div class="detail-section">
      <div class="detail-section-head"><span>WALLET CONTROLS</span><span>Promotion never bypasses deterministic qualification</span></div>
      <div class="wallet-actions wallet-actions51"><button class="wallet-action" data-wallet-action="rename">✎ Edit Label</button>${trustedButton}<button class="wallet-action ghost" data-wallet-action="ghost">◌ ${a.shadow?.status?'Restart / Continue Shadow':'Start Ghost Test'}</button>${requalify}<button class="wallet-action" data-wallet-action="pending">◌ Set Pending</button><button class="wallet-action pause" data-wallet-action="paused">Ⅱ Pause Wallet</button><button class="wallet-action blacklist" data-wallet-action="blacklisted">⊘ Blacklist</button><button class="wallet-action padre" data-wallet-action="padre">⬡ ${last?.tokenAddress?'Open Last Token':'Open Padre'}</button></div>
    </div>
    <div class="detail-section">
      <div class="detail-section-head"><span>RECENT OBSERVED TRADES</span><span>${hist.length} saved</span></div>
      ${hist.length?`<div class="wallet-history">${hist.slice(0,7).map(t=>`<div class="wallet-history-row"><span class="trade-action ${(t.action||'').toUpperCase()==='BUY'?'buy':(t.action||'').toUpperCase()==='SELL'?'sell':'neutral'}">${esc((t.action||'TRADE').toUpperCase())}</span><div><b>${esc(t.tokenSymbol?`$${t.tokenSymbol}`:(t.token||shortAddr(t.tokenAddress)))}</b><small>${fmtTime(t.timestamp||t.savedAt)} · ${esc((t.decision||'saved').toUpperCase())}</small></div><em>${Number(t.sizeSol||0).toFixed(3)} SOL</em></div>`).join('')}</div>`:'<div class="wallet-note">No saved trade history for this wallet yet.</div>'}
    </div>`;
  if(!intel&&!loading)loadWalletIntelligence51(addr);
}
function renderWallets(){if(!state.data)return;const wallets=state.data.wallets||{};renderWalletSummary(wallets);renderWalletList();renderWalletDetail();}
async function persistWallets(message){await window.cg.saveWallets(state.data.wallets||{});renderWallets();renderDashboard();toast(message);}
function showWalletModal({address='',label='',tier='pending',editing=false}={}){let modal=$('wallet-modal-backdrop');if(!modal){modal=document.createElement('div');modal.id='wallet-modal-backdrop';modal.className='modal-backdrop';document.body.appendChild(modal);}modal.innerHTML=`<div class="wallet-modal"><h3>${editing?'Edit Wallet':'Add Wallet'}</h3><p>${editing?'Update the display label for this wallet.':'Add a Solana wallet to CopyGuard monitoring. New wallets default to Pending unless you choose another tier.'}</p><form id="wallet-modal-form"><div class="form-row"><label>WALLET ADDRESS</label><input id="modal-wallet-address" value="${esc(address)}" ${editing?'disabled':''} required placeholder="Solana wallet address"></div><div class="form-row"><label>DISPLAY LABEL</label><input id="modal-wallet-label" value="${esc(label)}" maxlength="60" placeholder="Whale 01, Dev Wallet, Early Buyer…"></div>${editing?'':`<div class="form-row"><label>STARTING TIER</label><select id="modal-wallet-tier"><option value="pending">Pending</option><option value="paused">Paused</option><option value="trusted">Trusted</option><option value="blacklisted">Blacklisted</option></select></div>`}<div class="modal-actions"><button type="button" class="modal-cancel" id="wallet-modal-cancel">Cancel</button><button type="submit" class="modal-save">${editing?'Save Changes':'Add Wallet'}</button></div></form></div>`;modal.classList.add('show');$('wallet-modal-cancel').onclick=()=>modal.classList.remove('show');modal.addEventListener('click',e=>{if(e.target===modal)modal.classList.remove('show');},{once:true});$('wallet-modal-form').onsubmit=async e=>{e.preventDefault();const addr=editing?address:$('modal-wallet-address').value.trim(),name=$('modal-wallet-label').value.trim()||'Watched Wallet',newTier=editing?tier:$('modal-wallet-tier').value;if(!editing&&!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(addr)){toast('Enter a valid Solana wallet address');return;}if(!editing&&state.data.wallets[addr]){toast('That wallet is already being watched');return;}if(editing){state.data.wallets[addr].label=name;}else{state.data.wallets[addr]={address:addr,label:name,tier:newTier,addedAt:Date.now(),rules:{maxSol:0.5,buyPercent:100},stats:{totalTrades:0,wins:0,losses:0,totalPnl:0,winRate:0,avgPnl:0}};walletUi.selected=addr;}await persistWallets(editing?'Wallet label updated':'Wallet added to CopyGuard');modal.classList.remove('show');};}
async function handleWalletAction(action){const addr=walletUi.selected,w=state.data?.wallets?.[addr];if(!w)return;if(action==='rename'){showWalletModal({address:addr,label:w.label||'',tier:walletTier(w),editing:true});return;}
  if(action==='trusted'){
    const intel=walletUi.intelligence[addr]?.analysis,qualified=intel?.analystGrade==='QUALIFIED'||walletUi.intelligence[addr]?.coach?.qualification?.qualified;
    if(walletTier(w)!=='trusted'&&!qualified){toast('Deterministic Shadow qualification must pass before Trusted promotion review');return;}
    openTrustedConfigModal(addr,w);return;
  }
  if(action==='requalify'){const r=await window.cg.ghostRequalify?.(addr);if(r?.ok!==false){delete walletUi.intelligence[addr];await loadWalletIntelligence51(addr,{force:true});await load();toast('Wallet returned to Shadow requalification');}else toast(r?.reason||r?.error||'Could not start requalification');return;}
  if(action==='padre'){const last=walletHistory(addr).find(t=>t.tokenAddress);await window.openInPadre(last?.tokenAddress||'');return;}if(action==='ghost'){const r=await window.cg.ghostStart(addr,{});if(r?.ok){w.tier='ghost';await load();ghostUi.selected=addr;await refreshGhost16();toast('Ghost testing started');}else toast(r?.reason||'Could not start Ghost Mode');return;}if(['trusted','pending','paused','blacklisted'].includes(action)){w.tier=action;if(action!=='trusted'&&state.trustedConfigs?.[addr]){await window.cg.deleteTrustedConfig(addr);delete state.trustedConfigs[addr];}await persistWallets(`${w.label||shortAddr(addr)} set to ${tierLabel(action)}`);}}
function initWallets(){const search=$('wallet-search'),sort=$('wallet-sort'),filters=$('wallet-filters');search?.addEventListener('input',e=>{walletUi.query=e.target.value;renderWalletList();});sort?.addEventListener('change',e=>{walletUi.sort=e.target.value;renderWalletList();});filters?.addEventListener('click',e=>{const b=e.target.closest('[data-tier]');if(!b)return;walletUi.tier=b.dataset.tier;filters.querySelectorAll('.filter-btn').forEach(x=>x.classList.toggle('active',x===b));renderWalletList();});$('wallet-list')?.addEventListener('click',e=>{const row=e.target.closest('[data-wallet]');if(!row)return;walletUi.selected=row.dataset.wallet;renderWalletList();renderWalletDetail();loadWalletIntelligence51(walletUi.selected);});$('wallet-detail')?.addEventListener('click',async e=>{const refresh=e.target.closest('[data-wallet-refresh51]');if(refresh){delete walletUi.intelligence[refresh.dataset.walletRefresh51];await loadWalletIntelligence51(refresh.dataset.walletRefresh51,{force:true});toast('Wallet evidence refreshed');return;}const copy=e.target.closest('[data-copy-address]');if(copy){try{await navigator.clipboard.writeText(copy.dataset.copyAddress);toast('Wallet address copied');}catch{toast('Could not copy address');}return;}const a=e.target.closest('[data-wallet-action]');if(a)await handleWalletAction(a.dataset.walletAction);});$('add-wallet-btn')?.addEventListener('click',()=>showWalletModal());}



function tradeWallet(t){return state.data?.wallets?.[t.walletAddress]||{};}
function feedTrades(){
  const saved=[...(state.data?.history||[])];
  const ids=new Set(saved.map(t=>t.id).filter(Boolean));
  for(const t of feedUi.liveTrades.values()) if(!t.id||!ids.has(t.id)) saved.unshift(t);
  return saved;
}
function normalizedDecision(t){return String(t.decision||'').toUpperCase();}
function needsAction(t){const w=tradeWallet(t),d=normalizedDecision(t);return walletTier(w)==='pending'&&(!d||d==='PENDING');}
function calcTradeRisk(t){
  const a=t.riskAssessment;
  if(a&&Number.isFinite(Number(a.score))){return {score:Number(a.score),level:String(a.level||'LOW').toLowerCase(),reasons:(a.flags||[]).filter(f=>f.severity!=='SAFE').map(f=>f.message),assessment:a};}
  let score=18,reasons=[];const liq=Number(t.liquidity||0),fdv=Number(t.fdv||0),size=Number(t.sizeSol||0);
  if(t.bundleAlert?.detected){score+=35;reasons.push('Coordinated wallet activity');}if(t.tokenMeta?.freezeEnabled){score+=20;reasons.push('Freeze authority enabled');}if(t.tokenMeta?.mintEnabled){score+=18;reasons.push('Mint authority enabled');}if(liq>0&&liq<25000){score+=18;reasons.push('Low liquidity');}else if(liq>0&&liq<75000){score+=9;reasons.push('Thin liquidity');}if(fdv>0&&fdv>25000000){score+=8;reasons.push('High FDV');}if(size>=2){score+=8;reasons.push('Large copied size');}score=Math.max(0,Math.min(100,Math.round(score)));return {score,level:score>=70?'high':score>=40?'medium':'low',reasons,assessment:null};
}
function aiVerdict(t){const a=t.analysis||{};const rec=String(a.recommendation||a.decision||a.verdict||'').toUpperCase();const reason=a.reasoning||a.reason||a.summary||'';if(rec)return {label:rec,reason:reason||'AI analysis received for this trade.',confidence:Number(a.confidence||0),riskLevel:a.riskLevel||'',override:!!a.deterministicOverride};const hasKey=!!state.data?.settings?.apiKeys?.[state.data?.settings?.aiProvider];if(t.analysisError)return {label:'AI ERROR',reason:t.analysisError,confidence:0};return {label:hasKey?'READY':'NOT CONFIGURED',reason:hasKey?'Select ANALYZE to refresh the model assessment, or wait for live analysis.':'Deterministic CopyGuard risk scoring remains active without an AI key.',confidence:0};}
function componentBar(label,value){const n=Math.max(0,Math.min(100,Number(value||0)));return `<div class="risk-component"><div><span>${esc(label)}</span><b>${Math.round(n)}</b></div><i><em style="width:${n}%"></em></i></div>`;}
function renderRiskBreakdown(t,risk){const a=risk.assessment;if(!a)return '';const c=a.components||{};const hard=(a.hardBlocks||[]);const positives=(a.positive||[]);return `<details class="risk-details"><summary>Risk breakdown <span>${esc(a.recommendation||'')}</span></summary><div class="risk-detail-grid">${componentBar('TOKEN',c.tokenSafety)}${componentBar('MARKET',c.marketRisk)}${componentBar('WALLET',c.walletRisk)}${componentBar('COORDINATION',c.coordinationRisk)}${componentBar('EXPOSURE',c.exposureRisk)}</div>${hard.length?`<div class="hard-block">⛔ HARD BLOCK · ${esc(hard.join(' · '))}</div>`:''}${positives.length?`<div class="positive-signals">✓ ${esc(positives.join(' · '))}</div>`:''}</details>`;}
function fmtMoney(v){v=Number(v||0);if(!v)return '—';if(v>=1e9)return '$'+(v/1e9).toFixed(2)+'B';if(v>=1e6)return '$'+(v/1e6).toFixed(2)+'M';if(v>=1e3)return '$'+(v/1e3).toFixed(1)+'K';return '$'+v.toFixed(0);}
function feedFilterRows(){let rows=feedTrades();const q=feedUi.query.trim().toLowerCase();if(q)rows=rows.filter(t=>[t.token,t.tokenName,t.tokenSymbol,t.tokenAddress,t.walletAddress,t.walletLabel,t.sourceSignature,t.signature,t.sourceEventKey,tradeWallet(t).label].some(v=>String(v||'').toLowerCase().includes(q)));if(feedUi.filter==='pending')rows=rows.filter(needsAction);if(feedUi.filter==='buy')rows=rows.filter(t=>String(t.action).toUpperCase()==='BUY');if(feedUi.filter==='sell')rows=rows.filter(t=>String(t.action).toUpperCase()==='SELL');if(feedUi.filter==='risk')rows=rows.filter(t=>calcTradeRisk(t).score>=40);if(feedUi.filter==='decided')rows=rows.filter(t=>!!normalizedDecision(t));rows.sort((a,b)=>feedUi.sort==='oldest'?Number(a.timestamp||a.savedAt||0)-Number(b.timestamp||b.savedAt||0):feedUi.sort==='size'?Number(b.sizeSol||0)-Number(a.sizeSol||0):feedUi.sort==='risk'?calcTradeRisk(b).score-calcTradeRisk(a).score:Number(b.timestamp||b.savedAt||0)-Number(a.timestamp||a.savedAt||0));return rows;}

// ── PHASE 50 · Live Feed & Trade Review UI ────────────────
function feedEpochMs(v){
  const n=Number(v||0);if(!Number.isFinite(n)||n<=0)return null;return n<1e12?n*1000:n;
}
function feedDuration(ms){
  if(ms===null||ms===undefined||!Number.isFinite(Number(ms)))return 'UNKNOWN';
  const n=Math.max(0,Number(ms));if(n<1000)return `${Math.round(n)}ms`;if(n<60000)return `${(n/1000).toFixed(n<10000?1:0)}s`;if(n<3600000)return `${Math.round(n/60000)}m`;return `${(n/3600000).toFixed(1)}h`;
}
function feedSourceEvidence(t={}){
  const chainAt=feedEpochMs(t.timestamp||t.chainTimestamp||t.blockTimestamp||t.blockTime);
  const observedAt=feedEpochMs(t.observedAt||t.observation?.observedAt||t.ingestedAt||t.savedAt);
  const latencyMs=chainAt&&observedAt?Math.max(0,observedAt-chainAt):null;
  const ageMs=chainAt?Math.max(0,Date.now()-chainAt):null;
  const signature=t.sourceSignature||t.signature||t.txSignature||null;
  const recovered=!!(t.recovered||t.recovery||t.observation?.recovered||t.sourceMode==='RECOVERY'||t.observationSource==='POLL_RECOVERY');
  const latencyState=latencyMs===null?'unknown':latencyMs>45000?'late':latencyMs>15000?'warn':'good';
  const freshnessState=ageMs===null?'unknown':ageMs>60000?'stale':ageMs>30000?'warn':'fresh';
  return {chainAt,observedAt,latencyMs,ageMs,signature,recovered,latencyState,freshnessState};
}
function feedPriceEvidence(t={}){
  const executionUsd=t.executionPriceUsd??t.transactionPrice?.priceUsd??t.pricing?.executionPriceUsd??t.execution?.priceUsd??t.priceEvidence?.executionPriceUsd??null;
  const executionSol=t.executionPriceSol??t.transactionPrice?.priceSol??t.pricing?.executionPriceSol??t.execution?.priceSol??null;
  const executionSource=t.executionPriceSource||t.transactionPrice?.source||t.pricing?.executionSource||t.execution?.source||'UNKNOWN';
  const executionConfidence=t.executionPriceConfidence||t.transactionPrice?.confidence||t.pricing?.executionConfidence||t.execution?.confidence||'UNKNOWN';
  const market=t.marketSnapshot||t.market||{};
  const currentUsd=market.priceUsd??t.currentPriceUsd??t.priceUsd??null;
  const quoteAt=feedEpochMs(market.fetchedAt||market.quoteFetchedAt||t.quoteFetchedAt||t.marketFetchedAt);
  const quoteAgeMs=quoteAt?Math.max(0,Date.now()-quoteAt):null;
  const quality=market.quality||market.confidence||t.marketQuality||'UNKNOWN';
  const degraded=!!(market.degradedFallback||t.degradedMarketFallback);
  return {executionUsd,executionSol,executionSource,executionConfidence,currentUsd,quoteAt,quoteAgeMs,quality,degraded};
}
function feedExecutionEligibility(t,risk,source,price){
  const reasons=[];
  if((risk.assessment?.hardBlocks||[]).length)reasons.push('DETERMINISTIC HARD BLOCK');
  if(!source.signature)reasons.push('SOURCE SIGNATURE UNKNOWN');
  if(source.chainAt===null)reasons.push('CHAIN TIME UNKNOWN');
  if(source.latencyMs===null)reasons.push('OBSERVATION LATENCY UNKNOWN');
  else if(source.latencyMs>45000)reasons.push('OBSERVATION TOO LATE');
  if(source.ageMs!==null&&source.ageMs>60000)reasons.push('SIGNAL STALE');
  if(source.recovered)reasons.push('RECOVERED SIGNAL · OBSERVE ONLY');
  if(String(t.action||'').toUpperCase()==='BUY'){
    if(price.quoteAt===null)reasons.push('MARKET FRESHNESS UNKNOWN');
    else if(price.quoteAgeMs>120000)reasons.push('MARKET QUOTE STALE');
    if(price.degraded)reasons.push('DEGRADED MARKET FALLBACK');
  }
  if(String(t.action||'').toUpperCase()==='SELL')reasons.push('AUTOMATED SELL REQUIRES OWN-WALLET EVIDENCE');
  return {eligible:reasons.length===0,reasons};
}
function feedUsd(v){
  const n=Number(v);if(!Number.isFinite(n)||n<=0)return 'UNKNOWN';
  if(n<0.000001)return '$'+n.toExponential(2);if(n<0.01)return '$'+n.toFixed(8);if(n<1)return '$'+n.toFixed(6);return '$'+n.toLocaleString(undefined,{maximumFractionDigits:4});
}
function renderFeedEvidenceStrip50(t,risk){
  const s=feedSourceEvidence(t),p=feedPriceEvidence(t),elig=feedExecutionEligibility(t,risk,s,p);
  const latencyTone=s.latencyState==='good'?'good':s.latencyState==='late'?'bad':'warn';
  const ageTone=s.freshnessState==='fresh'?'good':s.freshnessState==='stale'?'bad':'warn';
  const marketTone=p.degraded||p.quoteAgeMs>120000?'bad':p.quoteAgeMs===null?'warn':'good';
  return `<div class="trade-evidence50">
    <div class="evidence-cell50"><span>CHAIN TIME</span><b>${s.chainAt?fmtTime(s.chainAt):'UNKNOWN'}</b><small class="${ageTone}">${s.ageMs===null?'age unknown':feedDuration(s.ageMs)+' old'}</small></div>
    <div class="evidence-cell50"><span>OBSERVED</span><b>${s.observedAt?fmtTime(s.observedAt):'UNKNOWN'}</b><small class="${latencyTone}">${s.latencyMs===null?'latency unknown':feedDuration(s.latencyMs)+' latency'}</small></div>
    <div class="evidence-cell50"><span>EXECUTION PRICE</span><b>${feedUsd(p.executionUsd)}</b><small>${esc(p.executionSource)} · ${esc(String(p.executionConfidence))}</small></div>
    <div class="evidence-cell50"><span>CURRENT PRICE</span><b>${feedUsd(p.currentUsd)}</b><small class="${marketTone}">${p.quoteAgeMs===null?'quote age unknown':feedDuration(p.quoteAgeMs)+' quote'} · ${esc(String(p.quality))}</small></div>
    <div class="evidence-cell50"><span>SOURCE TX</span><b>${s.signature?esc(shortAddr(s.signature)):'UNKNOWN'}</b><small class="${s.recovered?'warn':''}">${s.recovered?'recovery/poll evidence':'authoritative signature preferred'}</small></div>
    <div class="evidence-cell50 eligibility ${elig.eligible?'good':'bad'}"><span>AUTO ELIGIBILITY</span><b>${elig.eligible?'REVIEWABLE':'NOT ELIGIBLE'}</b><small>${elig.eligible?'No feed-level blocker detected':esc(elig.reasons.slice(0,2).join(' · '))}</small></div>
  </div>`;
}
function renderFeedDecisionLayer50(t,risk,ai){
  const hard=risk.assessment?.hardBlocks||[],unknowns=risk.assessment?.unknowns||[],cautions=risk.assessment?.cautions||[],deterministic=risk.assessment?.decision||risk.assessment?.recommendation||risk.level.toUpperCase();
  return `<div class="decision-layer50">
    <div class="decision-authority50 ${hard.length?'blocked':''}">
      <span>DETERMINISTIC AUTHORITY</span>
      <strong>${hard.length?'HARD BLOCK':esc(String(deterministic).toUpperCase())}</strong>
      <small>${hard.length?esc(hard.slice(0,2).join(' · ')):cautions.length?`${cautions.length} caution${cautions.length===1?'':'s'}`:unknowns.length?`${unknowns.length} unknown evidence field${unknowns.length===1?'':'s'}`:'No deterministic hard block in current record'}</small>
    </div>
    <div class="decision-ai50">
      <span>${esc(state.data?.aiProviderName||'AI')} · ADVISORY</span>
      <strong>${esc(ai.label)}${ai.confidence?` · ${ai.confidence}%`:''}</strong>
      <small>${esc(ai.reason||'No AI explanation available.')}</small>
    </div>
  </div>`;
}

function renderFeedSummary(){const all=feedTrades(),pending=all.filter(needsAction),today=all.filter(t=>dayKey(t.timestamp||t.savedAt)===new Date().toISOString().slice(0,10)),buys=today.filter(t=>String(t.action).toUpperCase()==='BUY').length,risky=all.filter(t=>calcTradeRisk(t).score>=70).length,approved=today.filter(t=>['APPROVED','AUTO'].includes(normalizedDecision(t))).length;$('feed-summary').innerHTML=[['TODAY',today.length,'observed wallet trades',''],['NEEDS ACTION',pending.length,'manual review queue','warn'],['BUYS TODAY',buys,'detected entries','good'],['PREPARED',approved,'manual copy preparations','good'],['HIGH RISK',risky,'deterministic/estimated flags','bad']].map(x=>`<div class="feed-summary-card ${x[3]}"><span>${x[0]}</span><strong>${x[1]}</strong><small>${x[2]}</small></div>`).join('');$('feed-queue-count').textContent=pending.length;}
function renderFeedCard(t){
  const w=tradeWallet(t),risk=calcTradeRisk(t),ai=aiVerdict(t),decision=normalizedDecision(t),action=String(t.action||'TRADE').toUpperCase(),canAct=needsAction(t),tier=walletTier(w);
  const token=t.tokenSymbol?`$${t.tokenSymbol}`:(t.tokenName||t.token||shortAddr(t.tokenAddress));
  const warning=[...(risk.reasons||[])];if(t.bundleAlert?.message&&!warning.includes(t.bundleAlert.message))warning.unshift(t.bundleAlert.message);
  const dcls=decision.includes('REJECT')||decision.includes('BLOCK')?'bad':decision.includes('APPROV')||decision.includes('AUTO')?'good':'wait';
  const blocked=!!risk.assessment?.hardBlocks?.length,source=feedSourceEvidence(t),pricing=feedPriceEvidence(t),elig=feedExecutionEligibility(t,risk,source,pricing);
  const riskSource=risk.assessment?'DETERMINISTIC':'LEGACY ESTIMATE';
  return `<article class="trade-card trade-card50 risk-${risk.level}${feedUi.newestId&&t.id===feedUi.newestId?' feed-new':''}" data-trade-id="${esc(t.id||'')}">
    <div class="trade-card-head trade-card-head50">
      <span class="trade-action ${action==='BUY'?'buy':action==='SELL'?'sell':'neutral'}">${esc(action)}</span>
      <div class="trade-token"><b>${esc(token)}</b><small>${esc(t.tokenAddress?shortAddr(t.tokenAddress):'Token address unavailable')}</small></div>
      <div class="trade-wallet"><b>${esc(w.label||t.walletLabel||shortAddr(t.walletAddress))}</b><small><span class="tier-pill ${tier}">${tierLabel(tier)}</span></small></div>
      <div class="feed-source-state50"><span>${riskSource}</span><b class="${blocked?'bad':risk.level==='low'?'good':'warn'}">${blocked?'BLOCKED':risk.score+'/100'}</b></div>
      <span class="trade-time">${fmtTime(t.timestamp||t.savedAt)}</span>
    </div>
    ${renderFeedEvidenceStrip50(t,risk)}
    <div class="trade-card-body trade-card-body50">
      <div class="trade-data"><span>SOURCE SIZE</span><strong>${Number(t.sizeSol||0).toFixed(3)} SOL</strong></div>
      <div class="trade-data"><span>LIQUIDITY</span><strong>${fmtMoney(t.liquidity??t.marketSnapshot?.liquidity??t.market?.liquidity)}</strong></div>
      <div class="trade-data"><span>FDV</span><strong>${fmtMoney(t.fdv??t.marketSnapshot?.fdv??t.market?.fdv)}</strong></div>
      <div class="trade-data"><span>WALLET WR</span><strong>${walletStats(w).winRate.toFixed(1)}%</strong></div>
      <div class="trade-data"><span>WALLET TRADES</span><strong>${walletStats(w).trades}</strong></div>
      <div class="trade-data"><span>SIGNAL STATE</span><strong class="${elig.eligible?'positive':'negative'}">${elig.eligible?'REVIEW':'OBSERVE'}</strong></div>
    </div>
    ${renderFeedDecisionLayer50(t,risk,ai)}
    ${renderRiskBreakdown(t,risk)}
    ${warning.length?`<div class="trade-warning">⚠ ${esc(warning.slice(0,3).join(' · '))}</div>`:''}
    ${!elig.eligible?`<div class="feed-safety-banner50"><b>NOT LIVE-ELIGIBLE</b><span>${esc(elig.reasons.slice(0,4).join(' · '))}</span></div>`:''}
    <div class="trade-card-actions trade-card-actions50">
      <button class="feed-action analyze" data-feed-action="analyze">◈ ANALYZE</button>
      ${canAct&&!blocked?`<button class="feed-action copy" data-feed-action="copy">✓ PREPARE COPY</button>`:''}
      ${canAct?`<button class="feed-action skip" data-feed-action="skip">× SKIP</button>`:''}
      <button class="feed-action research" data-feed-action="research">⌕ RESEARCH</button>
      ${t.tokenAddress?`<button class="feed-action padre" data-feed-action="padre">⬡ OPEN PADRE</button>`:''}
      <span class="trade-decision ${blocked?'bad':decision?dcls:'wait'}">${esc(blocked?'HARD BLOCK':decision||(canAct?'AWAITING REVIEW':'MONITORED'))}</span>
    </div>
  </article>`;
}
function renderFeedSide(){
  const all=feedTrades(),pending=all.filter(needsAction).slice(0,5),risks=all.map(t=>({t,r:calcTradeRisk(t)})).filter(x=>x.r.score>=40).sort((a,b)=>b.r.score-a.r.score).slice(0,5);
  $('feed-queue').innerHTML=pending.length?pending.map(t=>{const s=feedSourceEvidence(t);return `<div class="feed-queue-row"><span></span><div><b>${esc(t.tokenSymbol?`$${t.tokenSymbol}`:(t.token||shortAddr(t.tokenAddress)))}</b><small>${esc(tradeWallet(t).label||shortAddr(t.walletAddress))} · ${Number(t.sizeSol||0).toFixed(3)} SOL · ${s.latencyMs===null?'latency ?':feedDuration(s.latencyMs)}</small></div></div>`;}).join(''):'<div class="empty-state compact"><b>Queue clear</b><span>No pending wallet trades need a decision.</span></div>';
  $('feed-risk-signals').innerHTML=risks.length?risks.map(({t,r})=>`<div class="feed-risk-row"><span class="${r.level}"></span><div><b>${esc(t.tokenSymbol?`$${t.tokenSymbol}`:(t.token||shortAddr(t.tokenAddress)))} · ${r.score}/100</b><small>${esc(r.assessment?.hardBlocks?.[0]||r.reasons[0]||'Elevated deterministic risk')}</small></div></div>`).join(''):'<div class="empty-state compact"><b>No elevated flags</b><span>Current feed has no medium/high risk signals.</span></div>';
  const sourceRows=all.slice(0,30).map(feedSourceEvidence),knownLatency=sourceRows.filter(x=>x.latencyMs!==null),late=knownLatency.filter(x=>x.latencyMs>45000).length,recovered=sourceRows.filter(x=>x.recovered).length,withSig=sourceRows.filter(x=>x.signature).length,avg=knownLatency.length?knownLatency.reduce((n,x)=>n+x.latencyMs,0)/knownLatency.length:null;
  const box=$('feed-latency-summary');if(box)box.innerHTML=`<div><span>AVG OBSERVATION</span><b class="${avg!==null&&avg<=15000?'positive':avg!==null&&avg>45000?'negative':'warning'}">${avg===null?'UNKNOWN':feedDuration(avg)}</b></div><div><span>SIGNATURE COVERAGE</span><b>${sourceRows.length?Math.round(withSig/sourceRows.length*100):0}%</b></div><div><span>LATE &gt;45s</span><b class="${late?'negative':'positive'}">${late}</b></div><div><span>RECOVERED</span><b class="${recovered?'warning':''}">${recovered}</b></div>`;
}
function renderFeed(){if(!state.data||!$('trade-feed'))return;renderFeedSummary();const rows=feedFilterRows();$('trade-feed').innerHTML=rows.length?rows.map(renderFeedCard).join(''):'<div class="feed-empty"><div><b>No trades match this view</b><span>Live watched-wallet activity will appear here as CopyGuard receives it.</span></div></div>';renderFeedSide();const live=$('feed-live-label'),sub=$('feed-live-sub');if(live)live.textContent=state.paused?'PAUSED':state.ws.connected?'LIVE':'MONITORING';if(sub)sub.textContent=state.ws.connected?'Helius stream connected':state.data?.settings?.heliusApiKey?'Waiting for Helius connection':'Local history and queued trades available';}
function findFeedTrade(id){return feedTrades().find(t=>String(t.id||'')===String(id||''));}
async function handleFeedAction(btn){const card=btn.closest('[data-trade-id]'),t=findFeedTrade(card?.dataset.tradeId);if(!t)return;const action=btn.dataset.feedAction;if(action==='analyze'){btn.disabled=true;btn.textContent='ANALYZING…';const res=await window.cg.analyzeTrade(t);if(res?.trade){feedUi.liveTrades.set(res.trade.id||t.id,res.trade);renderFeed();toast(res.aiConfigured?'Risk + AI analysis refreshed':'Risk refreshed · AI key not configured');}else toast(res?.error||'Analysis failed');return;}if(action==='padre'){await window.openInPadre(t.tokenAddress||'');return;}if(action==='research'){sessionStorage.setItem('copyguard-research-token',t.tokenAddress||t.tokenSymbol||t.token||'');go('research');toast('Trade sent to Research workspace for Phase 7');return;}if(action==='skip'){btn.disabled=true;await window.cg.rejectTrade(t);feedUi.liveTrades.delete(t.id);await load();renderFeed();toast('Trade skipped and saved to history');return;}if(action==='copy'){btn.disabled=true;const res=await window.cg.approveTrade(t);if(!res?.ok){btn.disabled=false;toast(res?.error||'CopyGuard blocked this preparation');renderFeed();return;}feedUi.liveTrades.delete(t.id);await load();renderFeed();toast('Trade prepared — confirm it manually in Padre');if(t.tokenAddress)await window.openInPadre(t.tokenAddress);}}
function initFeed(){const search=$('feed-search'),sort=$('feed-sort'),filters=$('feed-filters');search?.addEventListener('input',e=>{feedUi.query=e.target.value;renderFeed();});sort?.addEventListener('change',e=>{feedUi.sort=e.target.value;renderFeed();});filters?.addEventListener('click',e=>{const b=e.target.closest('[data-feed-filter]');if(!b)return;feedUi.filter=b.dataset.feedFilter;filters.querySelectorAll('[data-feed-filter]').forEach(x=>x.classList.toggle('active',x===b));renderFeed();});$('trade-feed')?.addEventListener('click',e=>{const b=e.target.closest('[data-feed-action]');if(b)handleFeedAction(b);});}


function researchAge(h){if(h===null||h===undefined||!Number.isFinite(Number(h)))return '—';h=Number(h);if(h<1)return `${Math.max(1,Math.round(h*60))}m`;if(h<48)return `${h.toFixed(h<10?1:0)}h`;return `${Math.floor(h/24)}d`;}
function researchRisk(t){
  const a=t.riskAssessment;
  if(a&&Number.isFinite(Number(a.score))){
    const flags=(a.flags||[]).filter(f=>String(f.severity||'').toUpperCase()!=='SAFE').map(f=>({sev:String(f.severity||'medium').toLowerCase(),msg:f.message||f.code||'Risk signal'}));
    const safe=(a.positive||[]).map(String);
    return {score:Number(a.score),level:String(a.level||'MEDIUM').toLowerCase(),flags,safe,hardBlocks:a.hardBlocks||[],source:'risk-engine-v2'};
  }
  let score=0,flags=[],safe=[];const liq=Number(t.liquidity||0);
  if(t.freezeEnabled===true){score+=45;flags.push({sev:'high',msg:'Freeze authority active.'});}
  if(t.mintEnabled===true){score+=35;flags.push({sev:'high',msg:'Mint authority active.'});}
  if(liq>0&&liq<10000){score+=28;flags.push({sev:'high',msg:'Critically low liquidity.'});}
  score=Math.max(0,Math.min(100,Math.round(score)));
  return {score,level:score>=60?'high':score>=30?'medium':'low',flags,safe,hardBlocks:[],source:'fallback'};
}
function scoreResearchCandidates(tokens){
  return tokens.map(t=>{
    const risk=researchRisk(t), prov=t.provenance&&typeof t.provenance==='object'?t.provenance:{};
    const confidence=prov.available?(prov.likelyOriginal===true?2:prov.likelyOriginal===false?0:1):1;
    return {...t,risk,provenanceEvidence:prov,likelyOriginal:prov.likelyOriginal===true,_originalConfidence:confidence};
  }).sort((a,b)=>{
    if(a.exactMatch!==b.exactMatch)return a.exactMatch?-1:1;
    if(a._originalConfidence!==b._originalConfidence)return b._originalConfidence-a._originalConfidence;
    if(a.risk.score!==b.risk.score)return a.risk.score-b.risk.score;
    return Number(b.liquidity||0)-Number(a.liquidity||0);
  });
}

function research55Decision(t){
  const a=t?.riskAssessment||{},r=t?.risk||researchRisk(t||{});
  const hard=(a.hardBlocks||r.hardBlocks||[]).map(x=>typeof x==='string'?x:(x.message||x.code||'Deterministic hard block'));
  const caution=(a.cautions||[]).map(x=>typeof x==='string'?x:(x.message||x.code||'Caution'));
  const unknown=[];
  const e=t?.researchEvidence||{};
  if(t?.mintEnabled===null||t?.mintEnabled===undefined)unknown.push('Mint authority status unknown');
  if(t?.freezeEnabled===null||t?.freezeEnabled===undefined)unknown.push('Freeze authority status unknown');
  if(!e.holders?.ownerResolved?.available)unknown.push('Owner-resolved holder concentration unavailable');
  if(!e.origin?.creatorCandidate)unknown.push('Creator identity not proven');
  if(!e.creatorHistory?.funder?.address)unknown.push('Funder provenance not proven');
  if(!Number(e.coverage?.pct||0))unknown.push('Evidence coverage unavailable');
  const state=hard.length?'HARD_BLOCK':caution.length||r.level==='medium'||r.level==='high'?'CAUTION':'PASS';
  return {state,hard,caution,unknown};
}
function research55Freshness(t){
  const e=t?.researchEvidence||{},ts=Number(e.generatedAt||e.updatedAt||e.fetchedAt||t?.researchedAt||0);
  if(!ts)return {label:'FRESHNESS UNKNOWN',age:null};
  const age=Math.max(0,Date.now()-ts);return {label:age<120000?'FRESH':age<900000?'AGING':'STALE',age};
}
function renderResearchSummary(){
  const box=$('research-summary');if(!box)return;if(!researchUi.tokens.length){box.classList.remove('show');box.innerHTML='';return;}
  const hard=researchUi.tokens.filter(t=>research55Decision(t).state==='HARD_BLOCK').length,caution=researchUi.tokens.filter(t=>research55Decision(t).state==='CAUTION').length,exact=researchUi.tokens.find(t=>t.exactMatch),best=researchUi.tokens.find(t=>t.likelyOriginal)||researchUi.tokens[0];
  box.innerHTML=[
    ['CONTRACTS',researchUi.tokens.length,'Solana candidates returned'],
    ['EXACT MATCH',exact?'YES':'NO',exact?shortAddr(exact.address):'Ticker/name comparison'],
    ['HARD BLOCKED',hard,'Deterministic authority'],
    ['CAUTION',caution,'Requires review'],
    ['PROVENANCE LEAD',best?.symbol?`$${best.symbol}`:'—',best?.likelyOriginal?'Likely original evidence':'Best available candidate']
  ].map(x=>`<div class="research-summary-card"><span>${x[0]}</span><strong>${esc(String(x[1]))}</strong><small>${esc(x[2])}</small></div>`).join('');box.classList.add('show');
}
function renderResearchToken(t){
  const r=t.risk,d=research55Decision(t),f=research55Freshness(t),flags=[...r.flags.slice(0,2)];
  return `<article class="research-token research-token55 ${t.likelyOriginal?'likely':''} ${d.state==='HARD_BLOCK'?'danger':''} ${researchUi.selected===t.address?'selected':''}" data-research-address="${esc(t.address)}">
    <div class="research-token-top"><div class="research-token-name"><b>${esc(t.symbol?`$${t.symbol}`:t.name||'Unknown Token')}${t.exactMatch?'<span class="research-badge exact55">EXACT MINT</span>':t.likelyOriginal?'<span class="research-badge">PROVENANCE LEAD</span>':''}</b><small>${esc(shortAddr(t.address))} · ${esc(t.name||'Unnamed')}</small></div><div class="research-risk"><span>DETERMINISTIC</span><b class="${d.state==='HARD_BLOCK'?'high':d.state==='CAUTION'?'medium':'low'}">${esc(d.state.replace('_',' '))}</b></div><div class="research-token-dex">${esc(t.dex||'DEX')}</div></div>
    <div class="research-token-stats"><div class="research-token-stat"><span>LIQUIDITY</span><b>${fmtMoney(t.liquidity)}</b></div><div class="research-token-stat"><span>FDV</span><b>${fmtMoney(t.fdv)}</b></div><div class="research-token-stat"><span>24H VOLUME</span><b>${fmtMoney(t.volume24h)}</b></div><div class="research-token-stat"><span>AGE</span><b>${researchAge(t.ageHours)}</b></div><div class="research-token-stat"><span>EVIDENCE</span><b>${Number(t.researchEvidence?.coverage?.pct||0)}%</b></div></div>
    <div class="research-token-flags"><span class="research-flag ${d.state==='PASS'?'safe':d.state==='HARD_BLOCK'?'high':'medium'}">${esc(d.state.replace('_',' '))}</span><span class="research-flag">${esc(f.label)}</span>${flags.map(x=>`<span class="research-flag ${x.sev}">${esc(x.msg)}</span>`).join('')}</div>
  </article>`;
}
function selectedResearchToken(){return researchUi.tokens.find(t=>t.address===researchUi.selected)||null;}
function renderResearchAuthority55(){
  const box=$('research-authority55'),t=selectedResearchToken();if(!box)return;
  if(!t){box.innerHTML='<div class="empty-state compact"><b>No evidence loaded</b><span>Hard blocks, cautions and unknowns will appear here.</span></div>';return;}
  const d=research55Decision(t),f=research55Freshness(t);
  const groups=[['HARD BLOCKS',d.hard,'hard'],['CAUTIONS',d.caution,'caution'],['UNKNOWNS',d.unknown,'unknown']];
  box.innerHTML=`<div class="research-authority-state55 ${d.state.toLowerCase()}"><span>FINAL DETERMINISTIC STATE</span><b>${esc(d.state.replace('_',' '))}</b><small>Risk score ${Number(t.risk?.score||0)}/100 · ${esc(f.label)}</small></div>${groups.map(([name,items,cls])=>`<div class="research-authority-group55 ${cls}"><span>${name} · ${items.length}</span>${items.length?items.map(x=>`<p>${esc(x)}</p>`).join(''):'<small>None recorded.</small>'}</div>`).join('')}<div class="research-authority-note55">AI cannot change this deterministic state.</div>`;
}
function renderResearchDetail(){
  const box=$('research-detail'),t=selectedResearchToken();if(!box)return;
  if(!t){box.innerHTML='<div class="research-detail-empty"><span>◈</span><b>No token selected</b><small>Select a contract for the complete evidence dossier.</small></div>';renderResearchAuthority55();return;}
  const r=t.risk,e=t.researchEvidence||{},origin=e.origin||{},ch=e.creatorHistory||{},od=e.holders?.ownerResolved||{},eb=e.earlyBird||{},cov=e.coverage||{},d=research55Decision(t),fresh=research55Freshness(t);
  const restrictions=e.tokenProgram?.restrictions||[],creator=origin.creatorCandidate,hard=d.hard;
  box.innerHTML=`<div class="research-detail-head research-detail-head55"><div><span class="research-identity55">${t.exactMatch?'EXACT CONTRACT':t.likelyOriginal?'PROVENANCE LEAD':'CANDIDATE CONTRACT'}</span><h3>${esc(t.symbol?`$${t.symbol}`:t.name||'Token')}</h3><small>${esc(t.address)}</small></div><div class="research-detail-score"><span>RISK</span><b class="${r.level}">${r.score}</b><small>${esc(d.state.replace('_',' '))}</small></div></div>
  <div class="research-section55"><div class="panel-head"><div><span class="panel-kicker">MARKET STATE</span><h3>Current Quote Evidence</h3></div><span class="evidence-chip55">${esc(fresh.label)}</span></div><div class="research-facts research-facts55"><div class="research-fact"><span>PRICE</span><b>${t.priceUsd?'$'+Number(t.priceUsd).toPrecision(6):'UNKNOWN'}</b></div><div class="research-fact"><span>LIQUIDITY</span><b>${fmtMoney(t.liquidity)}</b></div><div class="research-fact"><span>FDV</span><b>${fmtMoney(t.fdv)}</b></div><div class="research-fact"><span>MARKET CAP</span><b>${fmtMoney(t.marketCap)}</b></div><div class="research-fact"><span>24H VOLUME</span><b>${fmtMoney(t.volume24h)}</b></div><div class="research-fact"><span>PAIR AGE</span><b>${researchAge(t.ageHours)}</b></div></div></div>
  <div class="research-section55"><div class="panel-head"><div><span class="panel-kicker">PHASE 25 · EVIDENCE PACKAGE V3</span><h3>Authority + Program Controls</h3></div><span class="evidence-chip55">${esc(cov.quality||'LOW')} ${Number(cov.pct||0)}%</span></div><div class="research-facts research-facts55"><div class="research-fact"><span>TOKEN PROGRAM</span><b>${esc(e.tokenProgram?.type||'UNKNOWN')}</b></div><div class="research-fact"><span>TOKEN-2022 FLAGS / RESTRICTIONS</span><b>${restrictions.length?esc(restrictions.join(', ')):'NONE OBSERVED'}</b></div><div class="research-fact"><span>MINT AUTHORITY</span><b class="${t.mintEnabled===true?'bad':t.mintEnabled===false?'good':'warn'}">${t.mintEnabled===null?'UNKNOWN':t.mintEnabled?'ACTIVE':'RENOUNCED'}</b></div><div class="research-fact"><span>FREEZE AUTHORITY</span><b class="${t.freezeEnabled===true?'bad':t.freezeEnabled===false?'good':'warn'}">${t.freezeEnabled===null?'UNKNOWN':t.freezeEnabled?'ACTIVE':'RENOUNCED'}</b></div></div></div>
  <div class="research-section55"><div class="panel-head"><div><span class="panel-kicker">HOLDERS + PROVENANCE</span><h3>Ownership Evidence</h3></div></div><div class="research-facts research-facts55"><div class="research-fact"><span>TOP OWNER</span><b>${od.available?Number(od.topOwnerPct||0).toFixed(2)+'%':'UNKNOWN'}</b></div><div class="research-fact"><span>TOP 10 OWNERS</span><b>${od.available?Number(od.top10OwnerPct||0).toFixed(2)+'%':'UNKNOWN'}</b></div><div class="research-fact"><span>CREATOR CANDIDATE</span><b>${creator?esc(shortAddr(creator)):'UNKNOWN'}</b></div><div class="research-fact"><span>CREATOR HOLDINGS</span><b>${e.creatorHoldings?.pct!=null?Number(e.creatorHoldings.pct).toFixed(2)+'%':'UNKNOWN'}</b></div><div class="research-fact"><span>RELATED LAUNCHES</span><b>${ch.relatedLaunchCount!=null?ch.relatedLaunchCount:'UNKNOWN'}</b></div><div class="research-fact"><span>FUNDER</span><b>${ch.funder?.address?esc(shortAddr(ch.funder.address)):'NOT PROVEN'}</b></div><div class="research-fact"><span>EARLY→TOP OVERLAP</span><b>${eb.available?Number(eb.earlyHolderOverlapPct||0).toFixed(1)+'%':'NO RECON'}</b></div><div class="research-fact"><span>PROVENANCE</span><b>${t.likelyOriginal?'LIKELY ORIGINAL':'UNPROVEN'}</b></div></div></div>
  ${hard.length?`<div class="research-hardblock55"><b>HARD BLOCK — REVIEW ONLY</b>${hard.map(x=>`<span>${esc(x)}</span>`).join('')}</div>`:''}
  ${(e.limitations||[]).length?`<div class="research-limitations research-limitations55"><b>EVIDENCE LIMITATIONS</b>${e.limitations.map(x=>`<small>• ${esc(x)}</small>`).join('')}</div>`:''}
  <div class="research-actions research-actions55"><button class="copy" data-research-action="copy">⧉ COPY CONTRACT</button><button class="watch" data-research-action="watch">☆ WATCH TOKEN</button><button class="padre" data-research-action="padre">⬡ REVIEW IN PADRE</button>${t.pairUrl?'<button data-research-action="dex">↗ DEXSCREENER</button>':''}</div>
  <div class="research-handoff55"><b>PADRE HANDOFF IS PRE-SUBMIT REVIEW ONLY</b><span>No trade is submitted or accounted from Research Center.</span></div>`;
  renderResearchAuthority55();
}

function renderResearchAI(){const box=$('research-ai');if(!box)return;const a=researchUi.ai;if(!a){const hasAI=!!state.data?.settings?.apiKeys?.[state.data?.settings?.aiProvider];box.innerHTML=`<div class="empty-state compact"><b>${hasAI?'Ready for comparison':'AI not configured'}</b><span>${hasAI?'Run a search to compare candidate contracts.':'CopyGuard deterministic research works without an AI key.'}</span></div>`;return;}if(a.loading){box.innerHTML='<div class="research-ai-card"><b>Analyzing candidate contracts…</b><p>AI is reviewing CopyGuard scores and market context.</p></div>';return;}if(a.error){box.innerHTML=`<div class="research-ai-card"><b>AI review unavailable</b><p>${esc(a.error)}</p></div>`;return;}const d=a.data||{},level=String(d.warningLevel||'CAUTION').toLowerCase();box.innerHTML=`<div class="research-ai-card"><span class="ai-level ${level}">${esc(d.warningLevel||'CAUTION')}</span><b>${esc(d.verdict||'Research review complete')}</b><p>${esc(d.recommendation||'Use CopyGuard risk checks and verify the exact contract before trading.')}</p>${(d.bulletPoints||[]).length?`<ul>${d.bulletPoints.map(x=>`<li>${esc(x)}</li>`).join('')}</ul>`:''}</div>`;}
function renderResearchWatchlist(){const box=$('research-watchlist'),count=$('research-watch-count');if(count)count.textContent=researchUi.watchlist.length;if(!box)return;box.innerHTML=researchUi.watchlist.length?researchUi.watchlist.map(t=>`<div class="research-watch-row" data-watch-address="${esc(t.address)}"><div><b>${esc(t.symbol?`$${t.symbol}`:t.name||'Saved token')}</b><small>${esc(shortAddr(t.address))}</small></div><button data-watch-action="open" title="Research">⌕</button><button data-watch-action="remove" title="Remove">×</button></div>`).join(''):'<div class="empty-state compact"><b>No saved tokens</b><span>Watch a research result to keep the contract here.</span></div>';}
function renderResearch(){if(!$('research-results'))return;renderResearchSummary();if(researchUi.loading){$('research-results').innerHTML='<div class="research-loading"><div><span></span>Searching Solana contracts…</div></div>';}else if(researchUi.tokens.length){$('research-results').innerHTML=researchUi.tokens.map(renderResearchToken).join('');}else{$('research-results').innerHTML='<div class="research-empty"><span>⌕</span><b>Investigate a token</b><small>Search above or send a token here from the Live Feed.</small></div>';}if($('research-count'))$('research-count').textContent=researchUi.tokens.length;renderResearchDetail();renderResearchAuthority55();renderResearchAI();renderResearchWatchlist();}
async function runResearch(query){query=String(query||$('research-query')?.value||'').trim();if(!query)return;researchUi.query=query;researchUi.loading=true;researchUi.tokens=[];researchUi.selected=null;researchUi.ai=null;if($('research-status-text'))$('research-status-text').textContent='Searching DexScreener + authority data…';const btn=$('research-search-btn');if(btn){btn.disabled=true;btn.textContent='SEARCHING…';}renderResearch();try{const res=await window.cg.researchSearch(query);if(res?.error)throw new Error(res.error);researchUi.tokens=scoreResearchCandidates(res.tokens||[]);researchUi.selected=researchUi.tokens[0]?.address||null;if($('research-status-text'))$('research-status-text').textContent=researchUi.tokens.length?`${researchUi.tokens.length} Solana contract${researchUi.tokens.length===1?'':'s'} compared`:'No Solana contracts found';if(researchUi.tokens.length){const hasAI=!!state.data?.settings?.apiKeys?.[state.data?.settings?.aiProvider];if(hasAI){researchUi.ai={loading:true};renderResearch();const payload={ticker:(researchUi.tokens[0].symbol||query).toUpperCase(),tokens:researchUi.tokens.map(t=>({symbol:t.symbol,address:t.address,score:Math.max(0,100-t.risk.score),liq:t.liquidity,vol:t.volume24h,ageH:t.ageHours,dex:t.dex,flags:t.risk.flags.map(f=>f.msg),strengths:t.risk.safe}))};window.cg.aiResearchSummary(payload).then(ai=>{researchUi.ai=ai?.error?{error:ai.error}:{data:ai?.data||ai};renderResearchAI();}).catch(e=>{researchUi.ai={error:e.message};renderResearchAI();});}}}catch(e){researchUi.ai=null;if($('research-status-text'))$('research-status-text').textContent='Search failed';$('research-results').innerHTML=`<div class="research-empty"><span>!</span><b>Research failed</b><small>${esc(e.message)}</small></div>`;toast(e.message);}finally{researchUi.loading=false;if(btn){btn.disabled=false;btn.textContent='SEARCH';}renderResearch();}}
async function handleResearchAction(action){const t=selectedResearchToken();if(!t)return;if(action==='copy'){try{await navigator.clipboard.writeText(t.address);toast('Contract address copied');}catch{toast(t.address);}return;}if(action==='watch'){const r=await window.cg.saveResearchWatch({address:t.address,symbol:t.symbol,name:t.name});if(r?.watchlist){researchUi.watchlist=r.watchlist;renderResearchWatchlist();toast('Token added to research watchlist');}return;}if(action==='padre'){const d=research55Decision(t);await window.openInPadre(t.address);toast(d.state==='HARD_BLOCK'?'Opened in Padre for review only — deterministic HARD BLOCK remains active':'Opened contract in Padre for manual pre-submit review');return;}if(action==='dex'&&t.pairUrl){await window.cg.openExternal(t.pairUrl);}}
async function initResearch(){try{researchUi.watchlist=await window.cg.getResearchWatchlist()||[];}catch{researchUi.watchlist=[];}renderResearch();$('research-form')?.addEventListener('submit',e=>{e.preventDefault();runResearch();});document.querySelectorAll('[data-rq]').forEach(b=>b.addEventListener('click',()=>{if($('research-query'))$('research-query').value=b.dataset.rq;runResearch(b.dataset.rq);}));$('research-results')?.addEventListener('click',e=>{const row=e.target.closest('[data-research-address]');if(!row)return;researchUi.selected=row.dataset.researchAddress;renderResearch();});$('research-detail')?.addEventListener('click',e=>{const b=e.target.closest('[data-research-action]');if(b)handleResearchAction(b.dataset.researchAction);});$('research-watchlist')?.addEventListener('click',async e=>{const b=e.target.closest('[data-watch-action]'),row=e.target.closest('[data-watch-address]');if(!b||!row)return;const addr=row.dataset.watchAddress;if(b.dataset.watchAction==='open'){if($('research-query'))$('research-query').value=addr;runResearch(addr);}else if(b.dataset.watchAction==='remove'){const r=await window.cg.removeResearchWatch(addr);researchUi.watchlist=r?.watchlist||researchUi.watchlist.filter(x=>x.address!==addr);renderResearchWatchlist();toast('Token removed from watchlist');}});}


function posToken(p){return p.tokenSymbol?`$${p.tokenSymbol}`:(p.token||shortAddr(p.tokenAddress));}
function posWallet(p){const w=state.data?.wallets?.[p.walletAddress]||{};return p.walletLabel||w.label||shortAddr(p.walletAddress);}
function fmtDuration(ms){ms=Math.max(0,Number(ms||0));const m=Math.floor(ms/60000);if(m<60)return `${m}m`;const h=Math.floor(m/60);if(h<48)return `${h}h ${m%60}m`;const d=Math.floor(h/24);return `${d}d ${h%24}h`;}
function openUnrealized(p){const q=state.positionQuotes?.[p.tokenAddress];const qty=Number(p.tokenAmount||0),entry=Number(p.entryPriceUsd||0),cur=Number(q?.priceUsd||0);if(!qty||!entry||!cur)return null;const entryUsd=qty*entry,currentUsd=qty*cur,pnlUsd=currentUsd-entryUsd;return {entryUsd,currentUsd,pnlUsd,pnlPct:entryUsd?100*pnlUsd/entryUsd:0,currentPrice:cur};}
function positionRows(){const q=positionUi.query.trim().toLowerCase();let rows=[];if(positionUi.tab==='open'||positionUi.tab==='all')rows.push(...(state.positions||[]).map(x=>({...x,_kind:'open'})));if(positionUi.tab==='closed'||positionUi.tab==='all')rows.push(...(state.closedPositions||[]).map(x=>({...x,_kind:'closed'})));if(q)rows=rows.filter(p=>[p.tokenSymbol,p.tokenName,p.token,p.tokenAddress,p.walletAddress,p.walletLabel,posWallet(p)].some(v=>String(v||'').toLowerCase().includes(q)));rows.sort((a,b)=>{if(positionUi.sort==='size')return Number(b.entrySol||0)-Number(a.entrySol||0);if(positionUi.sort==='pnl'){const pa=a._kind==='closed'?Number(a.pnl||0):(openUnrealized(a)?.pnlPct??-9999),pb=b._kind==='closed'?Number(b.pnl||0):(openUnrealized(b)?.pnlPct??-9999);return pb-pa;}if(positionUi.sort==='age'){const aa=a._kind==='closed'?Number(a.holdMs||0):Date.now()-Number(a.openedAt||0),bb=b._kind==='closed'?Number(b.holdMs||0):Date.now()-Number(b.openedAt||0);return bb-aa;}return Number((b.closedAt||b.openedAt)||0)-Number((a.closedAt||a.openedAt)||0);});return rows;}

// ── PHASE 52 · Positions & Portfolio Accounting UI ─────────
function position52Data(){return positionUi.accounting||{verifiedPerformance:{},markedPortfolio:{},trend:{},attribution:{},verifiedOutcomes:[],shadowLots:[],execution:{attempts:[],prepared:[]},operational:{open:[],closed:[]},counts:{}};}
function position52SigLink(sig){
  if(!sig)return '<span class="unknown52">UNKNOWN</span>';
  return `<a class="source-link52" href="#" data-source-signature="${esc(sig)}" title="${esc(sig)}">${esc(shortAddr(sig))} ↗</a>`;
}
function position52Rows(){
  const d=position52Data();let rows=[];
  if(positionUi.tab==='verified')rows=(d.verifiedOutcomes||[]).map(x=>({...x,_kind:'verified',_time:x.exit?.chainTimestamp||x.recordedAt||0,_size:Number(x.stakeSol||0),_pnl:Number(x.pnlSol||0)}));
  else if(positionUi.tab==='shadow')rows=(d.shadowLots||[]).map(x=>({...x,_kind:'shadow',_time:x.openedAt||0,_size:Number(x.originalStakeSol||0),_pnl:Number(x.unrealizedPnlSol||0)}));
  else if(positionUi.tab==='execution')rows=[
    ...(d.execution?.prepared||[]).map(x=>({...x,_kind:'prepared',_time:x.preparedAt||0,_size:Number(x.sizeSol||0),_pnl:0})),
    ...(d.execution?.attempts||[]).map(x=>({...x,_kind:'execution',_time:x.submittedAt||x.reservedAt||x.failedAt||x.blockedAt||0,_size:Number(x.sizeSol||0),_pnl:0}))
  ];
  else rows=[
    ...(d.operational?.open||[]).map(x=>({...x,_kind:'operational-open',_time:x.openedAt||x.timestamp||0,_size:Number(x.entrySol||x.sizeSol||0),_pnl:0})),
    ...(d.operational?.closed||[]).map(x=>({...x,_kind:'operational-closed',_time:x.closedAt||x.timestamp||0,_size:Number(x.entrySol||x.sizeSol||0),_pnl:Number(x.pnl||0)}))
  ];
  const q=positionUi.query.trim().toLowerCase();
  if(q)rows=rows.filter(x=>[x.id,x.walletAddress,x.walletLabel,x.tokenAddress,x.tokenSymbol,x.status,x.sourceSignature,x.entry?.signature,x.exit?.signature,x.classification,x.accountingClass].some(v=>String(v||'').toLowerCase().includes(q)));
  rows.sort((a,b)=>{
    if(positionUi.sort==='pnl')return Number(b._pnl||0)-Number(a._pnl||0);
    if(positionUi.sort==='size')return Number(b._size||0)-Number(a._size||0);
    if(positionUi.sort==='age')return Number(a._time||0)-Number(b._time||0);
    return Number(b._time||0)-Number(a._time||0);
  });return rows;
}
function position52Key(r){return `${r._kind}:${r.id||r.lotId||r.sourceEventKey||r._time}`;}
function position52StateLabel(r){
  if(r._kind==='verified')return 'VERIFIED';
  if(r._kind==='shadow')return Number(r.realizationCount||0)>0?'PARTIAL SHADOW':'OPEN SHADOW';
  if(r._kind==='prepared')return 'PREPARED';
  if(r._kind==='execution')return String(r.status||'UNKNOWN').replaceAll('_',' ');
  return r._kind==='operational-open'?'OPERATIONAL OPEN':'OPERATIONAL CLOSED';
}
function renderPositionSummary(){
  const d=position52Data(),v=d.verifiedPerformance||{},m=d.markedPortfolio||{},c=d.counts||{},t=d.trend||{};
  const realized=Number(v.realizedPnlSol||0),unreal=Number(m.unrealizedShadowPnlSol||0);
  $('positions-summary').innerHTML=[
    ['VERIFIED REALIZED',`${realized>=0?'+':''}${realized.toFixed(4)} SOL`,`${Number(v.completedOutcomes||0)} source-verified closes`,realized>=0?'good':'bad'],
    ['OPEN SHADOW',c.shadowOpenLots||0,`${Number(m.markedShadowEquitySol||0).toFixed(4)} SOL marked equity`,''],
    ['UNREALIZED SHADOW',`${unreal>=0?'+':''}${unreal.toFixed(4)} SOL`,'Current marks only',unreal>=0?'good':'bad'],
    ['MAX DRAWDOWN',`${Number(t.maxDrawdownPct||0).toFixed(2)}%`,String(t.direction||'INSUFFICIENT_HISTORY').replaceAll('_',' '),Number(t.maxDrawdownPct||0)>20?'bad':'warn'],
    ['EXECUTION RECORDS',Number(c.executionAttempts||0)+Number(c.prepared||0),`${c.prepared||0} prepared · ${c.executionAttempts||0} attempts`,'']
  ].map(x=>`<div class="positions-summary-card ${x[3]}"><span>${x[0]}</span><strong>${x[1]}</strong><small>${x[2]}</small></div>`).join('');
}
function renderPositionRow(r){
  const key=position52Key(r),sel=positionUi.selected===key,state=position52StateLabel(r),token=r.tokenSymbol?`$${r.tokenSymbol}`:shortAddr(r.tokenAddress||'');
  let value='—',sub='';
  if(r._kind==='verified'){value=`${Number(r.pnlSol||0)>=0?'+':''}${Number(r.pnlSol||0).toFixed(4)} SOL`;sub=`${Number(r.returnPct||0)>=0?'+':''}${Number(r.returnPct||0).toFixed(1)}%`;}
  else if(r._kind==='shadow'){value=`${Number(r.unrealizedPnlSol||0)>=0?'+':''}${Number(r.unrealizedPnlSol||0).toFixed(4)} SOL`;sub=`${Number(r.remainingStakeSol||0).toFixed(4)} remaining`;}
  else if(r._kind==='prepared'){value=`${Number(r.sizeSol||0).toFixed(4)} SOL`;sub='No accounting commit';}
  else {value=r.status||r.accountingClass||'UNVERIFIED';sub='Not verified realized P&L';}
  const tone=r._kind==='verified'?(Number(r.pnlSol||0)>=0?'good':'bad'):r._kind==='shadow'?(Number(r.unrealizedPnlSol||0)>=0?'good':'bad'):r._kind==='execution'&&String(r.status).includes('FAILED')?'bad':'neutral';
  return `<article class="position-row position-row52 ${sel?'selected':''}" data-position-key="${esc(key)}">
    <div class="position-status state52 ${r._kind}">${esc(state)}</div>
    <div class="position-main"><b>${esc(token||'Unknown token')}</b><small>${esc(shortAddr(r.tokenAddress||''))}</small></div>
    <div class="position-cell"><span>WALLET</span><b>${esc(r.walletLabel||state.data?.wallets?.[r.walletAddress]?.label||shortAddr(r.walletAddress||''))}</b></div>
    <div class="position-cell"><span>SIZE / STAKE</span><b>${Number(r._size||0).toFixed(4)} SOL</b></div>
    <div class="position-cell"><span>SOURCE</span><b>${r.sourceSignature||r.entry?.signature?'LINKED':'UNKNOWN'}</b></div>
    <div class="position-cell pnl"><span>ACCOUNTING VALUE</span><b class="${tone}">${esc(value)}</b><small>${esc(sub)}</small></div>
  </article>`;
}
function selectedPosition52(){if(!positionUi.selected)return null;return position52Rows().find(r=>position52Key(r)===positionUi.selected)||null;}
function renderPositionDetail(){
  const box=$('position-detail'),r=selectedPosition52();if(!box)return;
  if(!r){box.innerHTML='<div class="position-detail-empty"><span>↗</span><b>Select an accounting record</b><small>Inspect source transactions, prices, cost basis, partial exits, and whether the record is authoritative realized performance.</small></div>';return;}
  const wallet=r.walletLabel||state.data?.wallets?.[r.walletAddress]?.label||shortAddr(r.walletAddress||'');
  if(r._kind==='verified'){
    box.innerHTML=`<div class="position-detail-head"><div><span class="position-status verified">VERIFIED OUTCOME</span><h3>${esc(r.tokenSymbol?`$${r.tokenSymbol}`:shortAddr(r.tokenAddress))}</h3><small>${esc(r.tokenAddress||'')}</small></div><div class="position-big-pnl ${Number(r.pnlSol||0)>=0?'good':'bad'}"><span>REALIZED</span><b>${Number(r.pnlSol||0)>=0?'+':''}${Number(r.pnlSol||0).toFixed(4)} SOL</b></div></div>
    <div class="position-facts position-facts52"><div><span>ORIGINAL STAKE</span><b>${Number(r.stakeSol||0).toFixed(4)} SOL</b></div><div><span>RETURN</span><b>${Number(r.returnPct||0)>=0?'+':''}${Number(r.returnPct||0).toFixed(2)}%</b></div><div><span>CLASSIFICATION</span><b>${esc(r.classification||'UNKNOWN')}</b></div><div><span>HOLD</span><b>${fmtDuration(Number(r.holdMs||0))}</b></div><div><span>WALLET</span><b>${esc(wallet)}</b></div><div><span>DATA QUALITY</span><b class="good">${esc(r.dataQuality||'VERIFIED')}</b></div></div>
    <div class="source-pair52"><div><span>ENTRY TRANSACTION</span><b>${position52SigLink(r.entry?.signature)}</b><small>${r.entry?.chainTimestamp?new Date(r.entry.chainTimestamp).toLocaleString():'Chain time unknown'} · ${r.entry?.priceUsd?`$${Number(r.entry.priceUsd).toPrecision(6)}`:'price unknown'}</small></div><div><span>EXIT TRANSACTION</span><b>${position52SigLink(r.exit?.signature)}</b><small>${r.exit?.chainTimestamp?new Date(r.exit.chainTimestamp).toLocaleString():'Chain time unknown'} · ${r.exit?.priceUsd?`$${Number(r.exit.priceUsd).toPrecision(6)}`:'price unknown'}</small></div></div>
    <div class="accounting-authority52 good"><b>AUTHORITATIVE REALIZED RESULT</b><span>Fully closed + source verified. This record is eligible for qualification and learning.</span></div>`;
  }else if(r._kind==='shadow'){
    const partial=(r.realizations||[]).length;
    box.innerHTML=`<div class="position-detail-head"><div><span class="position-status open">OPEN SHADOW</span><h3>${esc(r.tokenSymbol?`$${r.tokenSymbol}`:shortAddr(r.tokenAddress))}</h3><small>${esc(r.tokenAddress||'')}</small></div><div class="position-big-pnl ${Number(r.unrealizedPnlSol||0)>=0?'good':'bad'}"><span>UNREALIZED MARK</span><b>${Number(r.unrealizedPnlSol||0)>=0?'+':''}${Number(r.unrealizedPnlSol||0).toFixed(4)} SOL</b></div></div>
    <div class="position-facts position-facts52"><div><span>ORIGINAL STAKE</span><b>${Number(r.originalStakeSol||0).toFixed(4)} SOL</b></div><div><span>REMAINING</span><b>${Number(r.remainingStakeSol||0).toFixed(4)} SOL</b></div><div><span>REALIZED SO FAR</span><b>${Number(r.realizedPnlSol||0)>=0?'+':''}${Number(r.realizedPnlSol||0).toFixed(4)} SOL</b></div><div><span>ENTRY PRICE</span><b>${r.entryPriceUsd?`$${Number(r.entryPriceUsd).toPrecision(6)}`:'UNKNOWN'}</b></div><div><span>PARTIAL EXITS</span><b>${partial}</b></div><div><span>ENTRY SOURCE</span><b>${position52SigLink(r.sourceSignature)}</b></div></div>
    ${partial?`<div class="realization-list52">${r.realizations.map((x,i)=>`<div><span>EXIT ${i+1}</span><b>${Number(x.closedStakeSol||0).toFixed(4)} SOL</b><em class="${Number(x.pnlSol||0)>=0?'good':'bad'}">${Number(x.pnlSol||0)>=0?'+':''}${Number(x.pnlSol||0).toFixed(4)} P&L</em><small>${position52SigLink(x.sourceSignature)}</small></div>`).join('')}</div>`:''}
    <div class="accounting-authority52 warn"><b>SIMULATED / MARKED CONTEXT</b><span>Open or partially realized Shadow lots do not count as completed qualification outcomes.</span></div>`;
  }else{
    const isPrepared=r._kind==='prepared',status=position52StateLabel(r);
    box.innerHTML=`<div class="position-detail-head"><div><span class="position-status ${isPrepared?'open':'closed'}">${esc(status)}</span><h3>${esc(r.tokenSymbol?`$${r.tokenSymbol}`:shortAddr(r.tokenAddress||''))}</h3><small>${esc(r.tokenAddress||'No token address')}</small></div></div>
    <div class="position-facts position-facts52"><div><span>WALLET</span><b>${esc(wallet||'UNKNOWN')}</b></div><div><span>ACTION</span><b>${esc(r.action||'UNKNOWN')}</b></div><div><span>SOURCE TX</span><b>${position52SigLink(r.sourceSignature)}</b></div><div><span>STATUS</span><b>${esc(status)}</b></div><div><span>ACCOUNTING COMMITTED</span><b class="bad">${r.accountingCommitted===true?'YES':'NO / UNVERIFIED'}</b></div><div><span>FAIL / BLOCK REASON</span><b>${esc(r.failureReason||(r.blockReasons||[]).join(' · ')||'—')}</b></div></div>
    <div class="accounting-authority52 bad"><b>NOT VERIFIED REALIZED PERFORMANCE</b><span>${isPrepared?'Prepared means Padre/manual review only. It is not a fill.':'Submitted/operational state is not settlement evidence and does not enter verified P&L.'}</span></div>`;
  }
  box.querySelectorAll('[data-source-signature]').forEach(a=>a.addEventListener('click',e=>{e.preventDefault();window.cg.openExternal?.(`https://solscan.io/tx/${a.dataset.sourceSignature}`);}));
}
function renderPositionPerformance(){
  const box=$('positions-performance'),d=position52Data(),v=d.verifiedPerformance||{},t=d.trend||{};
  if(!box)return;box.innerHTML=`<div class="performance-grid performance-grid52"><div><span>NET VERIFIED</span><b class="${Number(v.realizedPnlSol||0)>=0?'good':'bad'}">${Number(v.realizedPnlSol||0)>=0?'+':''}${Number(v.realizedPnlSol||0).toFixed(4)} SOL</b></div><div><span>WIN RATE</span><b>${Number(v.winRatePct||0).toFixed(1)}%</b></div><div><span>VERIFIED CLOSES</span><b>${Number(v.completedOutcomes||0)}</b></div><div><span>MAX DRAWDOWN</span><b>${Number(t.maxDrawdownPct||0).toFixed(2)}%</b></div><div><span>RECENT TREND</span><b>${esc(String(t.direction||'INSUFFICIENT_HISTORY').replaceAll('_',' '))}</b></div><div><span>UNREALIZED SHADOW</span><b>${Number(d.markedPortfolio?.unrealizedShadowPnlSol||0)>=0?'+':''}${Number(d.markedPortfolio?.unrealizedShadowPnlSol||0).toFixed(4)} SOL</b></div></div>`;
  const attr=$('positions-attribution52'),wallets=d.attribution?.topWallets||[],tokens=d.attribution?.topTokens||[];
  if(attr)attr.innerHTML=`<div class="attribution52"><div><span>TOP WALLETS</span>${wallets.slice(0,4).map((x,i)=>`<p><b>#${i+1} ${esc(x.label||shortAddr(x.walletAddress))}</b><em class="${Number(x.realizedPnlSol||0)>=0?'good':'bad'}">${Number(x.realizedPnlSol||0)>=0?'+':''}${Number(x.realizedPnlSol||0).toFixed(4)}</em></p>`).join('')||'<small>No verified attribution yet.</small>'}</div><div><span>TOP TOKENS</span>${tokens.slice(0,4).map((x,i)=>`<p><b>#${i+1} ${esc(x.symbol?`$${x.symbol}`:shortAddr(x.tokenAddress))}</b><em class="${Number(x.realizedPnlSol||0)>=0?'good':'bad'}">${Number(x.realizedPnlSol||0)>=0?'+':''}${Number(x.realizedPnlSol||0).toFixed(4)}</em></p>`).join('')||'<small>No verified attribution yet.</small>'}</div></div>`;
}
function renderPositions(){
  if(!$('positions-list'))return;renderPositionSummary();const rows=position52Rows(),titles={verified:'Verified Outcomes',shadow:'Open Shadow Lots',execution:'Execution State Ledger',operational:'Operational / Legacy Records'};
  $('positions-list').innerHTML=rows.length?rows.map(renderPositionRow).join(''):'<div class="positions-empty"><span>↗</span><b>No records in this accounting layer</b><small>CopyGuard keeps missing evidence empty rather than inventing accounting state.</small></div>';
  $('positions-count').textContent=rows.length;$('positions-book-title').textContent=titles[positionUi.tab]||'Accounting Ledger';
  if(positionUi.selected&&!rows.some(r=>position52Key(r)===positionUi.selected))positionUi.selected=null;
  renderPositionDetail();renderPositionPerformance();
}
async function refreshPositionQuotes(){
  positionUi.quotesLoading=true;
  try{positionUi.accounting=await window.cg.getPortfolioAccountingData?.();state.dashboardPortfolio=await window.cg.getAssistantPortfolioAnalysis?.().catch(()=>state.dashboardPortfolio);positionUi.lastQuoteAt=Date.now();toast('Portfolio accounting refreshed');}
  catch(e){toast('Could not refresh portfolio accounting');}
  finally{positionUi.quotesLoading=false;renderPositions();}
}
function exportPositionsCsv(){
  const rows=position52Rows();if(!rows.length){toast('No records in this accounting view');return;}
  const data=rows.map(r=>({layer:r._kind,state:position52StateLabel(r),wallet:r.walletAddress||'',token:r.tokenAddress||'',symbol:r.tokenSymbol||'',sizeSol:r._size||0,pnlSol:r._pnl||0,sourceSignature:r.sourceSignature||r.entry?.signature||'',exitSignature:r.exit?.signature||'',time:r._time||''}));
  const cols=Object.keys(data[0]),csv=[cols.join(','),...data.map(r=>cols.map(c=>`"${String(r[c]??'').replace(/"/g,'""')}"`).join(','))].join('\n'),blob=new Blob([csv],{type:'text/csv'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`copyguard-accounting-${positionUi.tab}-${new Date().toISOString().slice(0,10)}.csv`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);toast('Accounting CSV exported');
}

function ghostFmt(v,d=2){const n=Number(v||0);return Number.isFinite(n)?n.toFixed(d):'0.00';}

function ghost53State(g){return String(g.dynamicQualification?.state||g.status||'TESTING').toUpperCase();}
function ghostProfiles(){const all=Object.entries(ghostUi.data.wallets||{}),q=ghostUi.query.trim().toLowerCase();return all.filter(([a,g])=>{const w=state.data?.wallets?.[a]||{},status=ghost53State(g).toLowerCase(),base=String(g.status||'testing').toLowerCase();return (!q||[a,w.label,status,base].some(x=>String(x||'').toLowerCase().includes(q)))&&(ghostUi.filter==='all'||status===ghostUi.filter||base===ghostUi.filter||(ghostUi.filter==='qualified'&&g.qualification?.qualified&&!g.liveActivated)||(ghostUi.filter==='live'&&g.liveActivated));}).sort((a,b)=>Number(b[1].updatedAt||0)-Number(a[1].updatedAt||0));}
function ghostStatusClass(g){const s=ghost53State(g).toLowerCase();return g.liveActivated&&s==='live_healthy'?'live':g.qualification?.qualified&&!g.liveActivated?'qualified':s;}
function ghost53Progress(g){return Math.max(0,Math.min(100,Number(g.qualification?.progressPct||0)));}
function renderGhostSummary(){const gs=Object.values(ghostUi.data.wallets||{}),testing=gs.filter(g=>['TESTING','SHADOW TESTING'].includes(ghost53State(g))).length,qualified=gs.filter(g=>g.qualification?.qualified&&!g.liveActivated).length,live=gs.filter(g=>g.liveActivated&&ghost53State(g)==='LIVE_HEALTHY').length,attention=gs.filter(g=>['WARNING','AUTO_PAUSED','REQUALIFYING'].includes(ghost53State(g))).length,closed=gs.reduce((n,g)=>n+Number(g.qualification?.stats?.completedTrades||0),0),open=gs.reduce((n,g)=>n+Number(g.qualification?.stats?.openPositions||0),0);$('ghost16-summary').innerHTML=[['SHADOW WALLETS',gs.length,'Simulation profiles',''],['TESTING',testing,'Building verified sample','warn'],['QUALIFIED',qualified,'Every threshold passes','good'],['LIVE HEALTHY',live,'Promoted and monitored','good'],['NEEDS ATTENTION',attention,'Warning / paused / requalifying',attention?'bad':''],['VERIFIED CLOSES',closed,`${open} open Shadow lots`,'']].map(x=>`<div class="positions-summary-card ${x[3]}"><span>${x[0]}</span><strong>${x[1]}</strong><small>${x[2]}</small></div>`).join('');const b=$('ghost-nav-badge');if(b){b.textContent=qualified+attention;b.style.display=(qualified+attention)?'grid':'none';}}
function renderGhostList(){const rows=ghostProfiles(),box=$('ghost16-list');$('ghost16-count').textContent=rows.length;box.innerHTML=rows.length?rows.map(([a,g])=>{const s=g.qualification?.stats||{},w=state.data?.wallets?.[a]||{},sel=ghostUi.selected===a?' selected':'',state53=ghost53State(g),progress=ghost53Progress(g);return `<article class="ghost16-row ghost53-row${sel}" data-ghost-wallet="${esc(a)}"><div class="wallet-avatar">${esc(walletInitial(w,a))}</div><div class="ghost16-row-main"><b>${esc(w.label||'Unnamed Wallet')}</b><small>${esc(shortAddr(a))} · ${esc(state53.replaceAll('_',' '))}</small><div class="ghost53-mini-progress"><i style="width:${progress}%"></i></div></div><div><span>VERIFIED</span><b>${s.completedTrades||0}/${g.config?.minCompletedTrades||30}</b></div><div><span>WIN RATE</span><b class="${Number(s.winRatePct||0)>=Number(g.config?.minWinRatePct||65)?'good':''}">${ghostFmt(s.winRatePct,1)}%</b></div><div><span>ROI</span><b class="${Number(s.roiPct||0)>=0?'good':'bad'}">${Number(s.roiPct||0)>=0?'+':''}${ghostFmt(s.roiPct,1)}%</b></div><span class="ghost16-state ${ghostStatusClass(g)}">${esc(state53.replaceAll('_',' '))}</span></article>`;}).join(''):'<div class="positions-empty"><span>◌</span><b>No Shadow profiles</b><small>Start with a Pending or Paused wallet to begin simulated qualification.</small></div>';}
function ghostCheck(label,pass,value,target,unknown=false){return `<div class="ghost16-check ghost53-check ${unknown?'unknown':pass?'pass':'fail'}"><i>${unknown?'?':pass?'✓':'×'}</i><div><b>${label}</b><small>${value} · target ${target}</small></div></div>`;}
function ghost53Source(sig){return sig?`<button class="ghost53-source" data-g53-solscan="${esc(sig)}">${esc(shortAddr(sig))} ↗</button>`:'<span class="unknown52">UNKNOWN</span>';}
function renderGhostDetail(){const box=$('ghost16-detail'),a=ghostUi.selected,g=ghostUi.data.wallets?.[a],w=state.data?.wallets?.[a]||{};if(!g){box.innerHTML='<div class="wallet-detail-empty"><span>◌</span><b>Select a Shadow wallet</b><small>Inspect simulated lots, source evidence, exact qualification thresholds and dynamic health.</small></div>';return;}const q=g.qualification||{},s=q.stats||{},c=g.config||{},ch=q.checks||{},dq=g.dynamicQualification||{},dr=dq.rolling||{},state53=ghost53State(g),progress=ghost53Progress(g),outcomes=(ghostUi.data.verifiedOutcomes||[]).filter(o=>o.walletAddress===a).slice(0,12),lots=(g.positions||[]).slice().sort((x,y)=>Number(y.openedAt||0)-Number(x.openedAt||0)),attention=['WARNING','AUTO_PAUSED','REQUALIFYING'].includes(state53);box.innerHTML=`
<div class="ghost53-profile-head"><div class="wallet-profile-id"><div class="wallet-avatar">${esc(walletInitial(w,a))}</div><div><h3>${esc(w.label||'Unnamed Wallet')}</h3><code>${esc(a)}</code></div></div><div class="ghost53-profile-state"><span class="ghost16-state ${ghostStatusClass(g)}">${esc(state53.replaceAll('_',' '))}</span><small>${esc(dq.profile?.lastReason||'Building deterministic evidence')}</small></div></div>
<div class="ghost53-readiness ${q.qualified?'ready':attention?'attention':''}"><div><span>PROMOTION READINESS</span><strong>${q.qualified?'QUALIFICATION PASSES':attention?'REQUALIFICATION REQUIRED':'NOT READY'}</strong><small>${q.qualified?'Promotion remains a separate explicit action.':attention?'Live resume is never automatic. Return through Shadow evidence.':'Continue collecting fully closed source-verified outcomes.'}</small></div><div class="ghost53-ring"><b>${progress.toFixed(0)}%</b><span>QUALIFIED</span></div></div>
<div class="ghost16-performance ghost53-performance"><div><span>VERIFIED CLOSED P&L</span><b class="${Number(s.netPnlSol||0)>=0?'good':'bad'}">${Number(s.netPnlSol||0)>=0?'+':''}${ghostFmt(s.netPnlSol,4)} SOL</b></div><div><span>MARKED EQUITY</span><b>${ghostFmt(s.markedEquitySol??s.equitySol,4)} SOL</b></div><div><span>UNREALIZED</span><b class="${Number(s.unrealizedPnlSol||0)>=0?'good':'bad'}">${Number(s.unrealizedPnlSol||0)>=0?'+':''}${ghostFmt(s.unrealizedPnlSol||0,4)} SOL</b></div><div><span>WIN RATE</span><b>${ghostFmt(s.winRatePct,1)}%</b></div><div><span>PROFIT FACTOR</span><b>${Number(s.profitFactor)>=999?'∞':ghostFmt(s.profitFactor,2)}</b></div><div><span>MAX DRAWDOWN</span><b>${ghostFmt(s.maxDrawdownPct,1)}%</b></div></div>
<div class="detail-section ghost53-qualification"><div class="detail-section-head"><span>DETERMINISTIC QUALIFICATION</span><span>${s.completedTrades||0} fully closed · ${ghostFmt(s.verifiedCoveragePct||0,1)}% verified</span></div><div class="qualification-progress51"><div><i style="width:${progress}%"></i></div><b>${progress.toFixed(0)}%</b></div><div class="ghost16-checks ghost53-checks">${ghostCheck('Completed sample',ch.sample,`${s.completedTrades||0} outcomes`,`${c.minCompletedTrades||30}+`)}${ghostCheck('Source verification',ch.verified,`${ghostFmt(s.verifiedCoveragePct||0,1)}%`,`100%`)}${ghostCheck('Win rate',ch.winRate,`${ghostFmt(s.winRatePct,1)}%`,`${c.minWinRatePct||65}%+`)}${ghostCheck('Net ROI',ch.roi,`${ghostFmt(s.roiPct,1)}%`,`${c.minRoiPct||1}%+`)}${ghostCheck('Profit factor',ch.profitFactor,Number(s.profitFactor)>=999?'∞':ghostFmt(s.profitFactor,2),`${c.minProfitFactor||1.5}+`)}${ghostCheck('Drawdown',ch.drawdown,`${ghostFmt(s.maxDrawdownPct,1)}%`,`≤ ${c.maxDrawdownPct||15}%`)}${ghostCheck('Hard-block rate',ch.hardBlocks,`${ghostFmt(s.hardBlockRatePct,1)}%`,`≤ ${c.maxHardBlockRatePct||10}%`)}</div></div>
<div class="ghost53-two-col"><div class="detail-section"><div class="detail-section-head"><span>PHASE 23 DYNAMIC TRUST · DYNAMIC HEALTH</span><span>Rolling ${dr.rollingSample||0}/10</span></div><div class="wallet-kv51"><div><span>State</span><b>${esc(state53.replaceAll('_',' '))}</b></div><div><span>Rolling WR</span><b>${ghostFmt(dr.rollingWinRatePct||0,1)}%</b></div><div><span>Rolling ROI</span><b>${Number(dr.rollingRoiPct||0)>=0?'+':''}${ghostFmt(dr.rollingRoiPct||0,1)}%</b></div><div><span>Rolling PF</span><b>${Number(dr.rollingProfitFactor)>=999?'∞':ghostFmt(dr.rollingProfitFactor||0,2)}</b></div><div><span>Loss streak</span><b>${dr.rollingConsecutiveLosses||0}</b></div><div><span>Verified coverage</span><b>${ghostFmt(dr.rollingVerifiedCoveragePct||0,1)}%</b></div></div></div><div class="detail-section"><div class="detail-section-head"><span>OBSERVATION QUALITY</span></div><div class="wallet-kv51"><div><span>Observed TX</span><b>${Number(g.observedTradeTransactions||0)}</b></div><div><span>P95 latency</span><b>${ghostFmt((s.p95ObservationLatencyMs||0)/1000,1)}s</b></div><div><span>On-time events</span><b>${ghostFmt(s.onTimeObservationPct||0,1)}%</b></div><div><span>Last poll</span><b>${g.lastPollAt?fmtTime(g.lastPollAt):'WAITING'}</b></div><div><span>Open lots</span><b>${s.openPositions||0}</b></div><div><span>Partial exits</span><b>${s.partialRealizations||0}</b></div></div></div></div>
<div class="detail-section"><div class="detail-section-head"><span>OPEN SHADOW LOTS</span><span>${lots.length} lot${lots.length===1?'':'s'} · ${ghostFmt(s.remainingExposureSol||0,4)} SOL exposure</span></div><div class="ghost53-lots">${lots.length?lots.map(l=>{const partial=(l.realizations||[]).length;return `<div class="ghost53-lot"><div><b>${esc(l.tokenSymbol?`$${l.tokenSymbol}`:shortAddr(l.tokenAddress))}</b><small>${l.openedAt?fmtTime(l.openedAt):'entry time unknown'} · ${partial} partial exit${partial===1?'':'s'}</small></div><div><span>ORIGINAL</span><b>${ghostFmt(l.originalStakeSol??l.stakeSol,4)}</b></div><div><span>REMAINING</span><b>${ghostFmt(l.remainingStakeSol??l.stakeSol,4)}</b></div><div><span>REALIZED</span><b class="${Number(l.realizedPnlSol||0)>=0?'good':'bad'}">${Number(l.realizedPnlSol||0)>=0?'+':''}${ghostFmt(l.realizedPnlSol||0,4)}</b></div><div><span>UNREALIZED</span><b class="${Number(l.unrealizedPnlSol||0)>=0?'good':'bad'}">${Number(l.unrealizedPnlSol||0)>=0?'+':''}${ghostFmt(l.unrealizedPnlSol||0,4)}</b></div><div><span>ENTRY SOURCE</span>${ghost53Source(l.sourceSignature)}</div>${partial?`<div class="ghost53-realizations">${l.realizations.slice(-6).map((r,i)=>`<p><span>EXIT ${i+1}</span><b>${ghostFmt(r.closedStakeSol||0,4)} SOL</b><em class="${Number(r.pnlSol||0)>=0?'good':'bad'}">${Number(r.pnlSol||0)>=0?'+':''}${ghostFmt(r.pnlSol||0,4)} P&L</em>${ghost53Source(r.sourceSignature)}</p>`).join('')}</div>`:''}</div>`}).join(''):'<div class="empty-state compact"><b>No open Shadow lots</b><span>Observed BUY signals will create separate transaction-linked simulated lots.</span></div>'}</div></div>
<div class="detail-section"><div class="detail-section-head"><span>VERIFIED OUTCOME LEDGER</span><span>${outcomes.length} recent</span></div><div class="ghost53-outcomes">${outcomes.length?outcomes.map(o=>`<div><span class="ghost53-result ${String(o.classification).toLowerCase()}">${esc(o.classification)}</span><div><b>${esc(o.tokenSymbol?`$${o.tokenSymbol}`:shortAddr(o.tokenAddress))}</b><small>${o.sourceVerified?'SOURCE VERIFIED':'INCOMPLETE'} · ${fmtDuration(Number(o.holdMs||0))}</small></div><strong class="${Number(o.pnlSol||0)>=0?'good':'bad'}">${Number(o.pnlSol||0)>=0?'+':''}${ghostFmt(o.pnlSol||0,4)} SOL</strong><div class="ghost53-outcome-sources">${ghost53Source(o.entry?.signature)}<i>→</i>${ghost53Source(o.exit?.signature)}</div></div>`).join(''):'<div class="empty-state compact"><b>No verified closes yet</b><span>Only fully closed, source-linked outcomes appear here.</span></div>'}</div></div>
<div class="detail-section"><div class="detail-section-head"><span>SIMULATION RULES</span><span>Changing thresholds changes qualification requirements, not historical outcomes</span></div><div class="ghost16-form ghost53-form"><label>Shadow size (SOL)<input id="g16-size" type="number" step="0.01" value="${c.ghostSizeSol||.25}"></label><label>Buy slippage %<input id="g16-bslip" type="number" step="0.1" value="${c.buySlippagePct||.5}"></label><label>Sell slippage %<input id="g16-sslip" type="number" step="0.1" value="${c.sellSlippagePct||.5}"></label><label>Fee / side %<input id="g16-fee" type="number" step="0.05" value="${c.feePctPerSide||.25}"></label><label>Min verified closes<input id="g16-mintrades" type="number" value="${c.minCompletedTrades||30}"></label><label>Min win rate %<input id="g16-win" type="number" step="1" value="${c.minWinRatePct||65}"></label><label>Min ROI %<input id="g16-roi" type="number" step="0.5" value="${c.minRoiPct||1}"></label><label>Min profit factor<input id="g16-pf" type="number" step="0.1" value="${c.minProfitFactor||1.5}"></label><label>Max drawdown %<input id="g16-dd" type="number" step="1" value="${c.maxDrawdownPct||15}"></label><label>Max hard-block rate %<input id="g16-hard" type="number" step="1" value="${c.maxHardBlockRatePct||10}"></label><label>Future live size SOL<input id="g16-live-size" type="number" step="0.01" value="${c.liveSizeSol||.25}"></label><label class="ghost16-toggle"><input id="g16-ai" type="checkbox" ${c.analyzeWithAi!==false?'checked':''}><span>Analyze each Shadow transaction with selected AI</span></label><label class="ghost16-toggle"><input id="g16-ai-block" type="checkbox" ${c.aiMayBlockGhost?'checked':''}><span>Allow AI SKIP to block simulated BUY entries</span></label><label class="ghost16-toggle disabled"><input id="g16-auto-live" type="checkbox" disabled><span>Live promotion is explicit in Phase 53; automatic promotion is disabled in this UI.</span></label></div><div class="ghost16-actions"><button class="primary-action" data-g16-action="save">SAVE SHADOW RULES</button><button class="ghost" data-g16-action="market">↻ REFRESH MARKET MARKS</button>${q.qualified&&!g.liveActivated?'<button class="primary-action" data-g16-action="promote">REVIEW LIVE PROMOTION</button>':''}${attention||state53==='QUALIFIED'?'<button class="ghost warning" data-g16-action="requalify">↻ REQUALIFY IN SHADOW</button>':''}<button class="ghost" data-g16-action="reset">RESET SAMPLE</button><button class="danger" data-g16-action="stop">STOP SHADOW TEST</button></div></div>`;}
function renderGhostLedger(){const rows=ghostUi.data.ledger||[];$('ghost16-ledger-count').textContent=rows.length;$('ghost16-ledger').innerHTML=rows.length?rows.slice(0,100).map(x=>{const w=state.data?.wallets?.[x.walletAddress]||{},partial=String(x.action).includes('PARTIAL'),sell=String(x.action).includes('SELL');return `<div class="ghost16-ledger-row ghost53-ledger-row"><span class="trade-action ${String(x.action).includes('BUY')?'buy':sell?'sell':'neutral'}">${esc(x.action||'EVENT')}</span><div><b>${esc(x.tokenSymbol?`$${x.tokenSymbol}`:shortAddr(x.tokenAddress))}</b><small>${esc(w.label||shortAddr(x.walletAddress))} · CHAIN ${fmtTime(x.chainTimestamp||x.time)} · SEEN ${fmtTime(x.observedAt||x.loggedAt||x.time)}${partial?' · PARTIAL REALIZATION':''}</small></div><div class="ghost53-ledger-source">${ghost53Source(x.sourceSignature)}</div><em class="${Number(x.pnlSol)>=0?'good':'bad'}">${x.pnlSol==null?'':`${Number(x.pnlSol)>=0?'+':''}${ghostFmt(x.pnlSol,4)} SOL`}</em></div>`;}).join(''):'<div class="empty-state compact"><b>No Shadow actions yet</b><span>Observed BUY and SELL signals will build the simulation ledger.</span></div>';}
function renderGhostTransactions(){const el=$('ghost19-transactions'),count=$('ghost19-tx-count');if(!el)return;const rows=(ghostUi.data.transactions||[]).filter(t=>Object.values(t.events||{}).some(e=>ghostUi.data.wallets?.[e.walletAddress])).slice(0,100);if(count)count.textContent=rows.length;el.innerHTML=rows.length?rows.map(t=>{const linked=(t.shadowActionIds||[]).length,lat=(Number(t.firstObservedAt||0)&&Number(t.chainTimestamp||0))?Math.max(0,Number(t.firstObservedAt)-Number(t.chainTimestamp)):null;return `<div class="ghost16-ledger-row ghost53-ledger-row"><span class="trade-action neutral">TX</span><div><b>${esc(shortAddr(t.signature))} · ${linked} SHADOW LINK${linked===1?'':'S'}</b><small>CHAIN ${fmtTime(t.chainTimestamp)} · OBSERVED ${fmtTime(t.firstObservedAt)} · ${lat===null?'latency unknown':feedDuration(lat)} · ${esc((t.sources||[]).join(', '))}</small></div><button class="ghost" data-g19-solscan="${esc(t.signature)}">SOLSCAN</button></div>`}).join(''):'<div class="empty-state compact"><b>No source transactions yet</b><span>Every observed transaction will be timestamped and linked to its Shadow actions.</span></div>';}
function renderGhost16(){if(!$('ghost16-summary'))return;renderGhostSummary();renderGhostList();renderGhostDetail();renderGhostLedger();renderGhostTransactions();}
async function refreshGhost16(){try{ghostUi.data=await window.cg.getGhostData();renderGhost16();}catch(e){console.error(e);toast('Could not load Ghost Engine');}}
function showGhostStart(){const candidates=Object.entries(state.data?.wallets||{}).filter(([a,w])=>!ghostUi.data.wallets?.[a]&&['pending','paused'].includes(String(w.tier||'pending').toLowerCase()));if(!candidates.length){toast('No Pending/Paused wallets available to start Ghost testing');return;}const labels=candidates.map(([a,w],i)=>`${i+1}. ${w.label||shortAddr(a)} · ${shortAddr(a)}`).join('\n');const pick=prompt(`Choose wallet number to start Ghost Mode:\n\n${labels}`,'1');if(!pick)return;const row=candidates[Number(pick)-1];if(!row){toast('Invalid wallet selection');return;}window.cg.ghostStart(row[0],{}).then(async r=>{if(r?.ok){ghostUi.selected=row[0];await load();await refreshGhost16();toast('Ghost testing started — no real order will be placed');}else toast(r?.reason||'Could not start Ghost Mode');});}
function initGhost16(){$('ghost19-transactions')?.addEventListener('click',e=>{const b=e.target.closest('[data-g19-solscan]');if(b)window.cg.openExternal(`https://solscan.io/tx/${b.dataset.g19Solscan}`);});$('ghost16-search')?.addEventListener('input',e=>{ghostUi.query=e.target.value;renderGhost16();});$('ghost16-filter')?.addEventListener('change',e=>{ghostUi.filter=e.target.value;renderGhost16();});$('ghost16-add')?.addEventListener('click',showGhostStart);$('ghost16-list')?.addEventListener('click',e=>{const r=e.target.closest('[data-ghost-wallet]');if(r){ghostUi.selected=r.dataset.ghostWallet;renderGhost16();}});$('ghost16-detail')?.addEventListener('click',async e=>{const src=e.target.closest('[data-g53-solscan]');if(src){window.cg.openExternal(`https://solscan.io/tx/${src.dataset.g53Solscan}`);return;}const b=e.target.closest('[data-g16-action]'),a=ghostUi.selected;if(!b||!a)return;if(b.dataset.g16Action==='save'){const cfg={ghostSizeSol:Number($('g16-size').value),buySlippagePct:Number($('g16-bslip').value),sellSlippagePct:Number($('g16-sslip').value),feePctPerSide:Number($('g16-fee').value),minCompletedTrades:Number($('g16-mintrades').value),minWinRatePct:Number($('g16-win').value),minRoiPct:Number($('g16-roi').value),minProfitFactor:Number($('g16-pf').value),maxDrawdownPct:Number($('g16-dd').value),maxHardBlockRatePct:Number($('g16-hard').value),liveSizeSol:Number($('g16-live-size').value),analyzeWithAi:!!$('g16-ai').checked,aiMayBlockGhost:!!$('g16-ai-block').checked,autoActivateLive:false};await window.cg.ghostSaveConfig(a,cfg);await refreshGhost16();toast('Ghost rules saved');}if(b.dataset.g16Action==='promote'){if(!confirm('Activate LIVE copying for this qualified wallet? CopyGuard will create an enabled Trusted automation profile. Global automation and all risk gates still apply.'))return;const r=await window.cg.ghostPromoteLive(a);if(r?.ok){await load();await refreshGhost16();toast('Wallet promoted to live Trusted automation');}else toast(r?.reason||'Promotion blocked');}if(b.dataset.g16Action==='requalify'){const r=await window.cg.ghostRequalify(a);if(r?.ok){await load();await refreshGhost16();toast('Wallet returned to Shadow requalification');}else toast(r?.reason||'Could not start requalification');}if(b.dataset.g16Action==='reset'){if(confirm('Reset this wallet’s entire Ghost sample and start qualification from zero?')){await window.cg.ghostReset(a);await refreshGhost16();toast('Ghost sample reset');}}if(b.dataset.g16Action==='stop'){await window.cg.ghostStop(a);await load();await refreshGhost16();toast('Ghost test stopped; wallet returned to Pending');}if(b.dataset.g16Action==='market'){b.disabled=true;await window.cg.ghostRefreshMarket();await refreshGhost16();toast('Shadow positions marked to current market');}});window.cg.on('ghost-update',async()=>{await refreshGhost16();if(currentPage==='ghost')renderGhost16();});refreshGhost16();}

function initPositions(){
  $('positions-tabs')?.addEventListener('click',e=>{
    const b=e.target.closest('[data-pos-tab]'); if(!b)return;
    positionUi.tab=b.dataset.posTab;
    document.querySelectorAll('[data-pos-tab]').forEach(x=>x.classList.toggle('active',x===b));
    renderPositions();
  });
  $('positions-search')?.addEventListener('input',e=>{positionUi.query=e.target.value;renderPositions();});
  $('positions-sort')?.addEventListener('change',e=>{positionUi.sort=e.target.value;renderPositions();});
  $('positions-list')?.addEventListener('click',e=>{const sig=e.target.closest('[data-source-signature]');if(sig){e.preventDefault();window.cg.openExternal?.(`https://solscan.io/tx/${sig.dataset.sourceSignature}`);return;}const row=e.target.closest('[data-position-key]');if(row){positionUi.selected=row.dataset.positionKey;renderPositions();}});
  $('positions-refresh')?.addEventListener('click',refreshPositionQuotes);
  $('positions-export')?.addEventListener('click',exportPositionsCsv);
  $('position-detail')?.addEventListener('click',async e=>{
    const b=e.target.closest('[data-pos-action]'),p=selectedPosition52(); if(!b||!p)return;
    if(b.dataset.posAction==='copy'){
      try{await navigator.clipboard.writeText(p.tokenAddress);toast('Contract address copied');}catch{toast(p.tokenAddress);}
    }
    if(b.dataset.posAction==='padre') await window.openInPadre(p.tokenAddress);
    if(b.dataset.posAction==='research'){
      go('research'); if($('research-query'))$('research-query').value=p.tokenAddress; runResearch(p.tokenAddress);
    }
  });
}


function trustedWalletEntries(){return Object.entries(state.data?.wallets||{}).filter(([,w])=>walletTier(w)==='trusted').sort((a,b)=>(a[1].label||a[0]).localeCompare(b[1].label||b[0]));}
function automationConfig(addr){return state.trustedConfigs?.[addr]||null;}
function automationOpenCount(addr){return (state.positions||[]).filter(p=>p.walletAddress===addr).length;}
function automationDaily(addr){return state.daily?.[addr]||{trades:0,lossSol:0};}

function auto54Tone(v=''){
  const x=String(v||'').toUpperCase();
  if(['FULL','ONLINE','READY','LIVE','HEALTHY','QUALIFIED','ARMED','ENABLED','PASS'].some(k=>x.includes(k)))return 'positive';
  if(['PAUSED','FAILED','BLOCKED','CRITICAL','OFFLINE','AUTO_PAUSED','DEGRADED'].some(k=>x.includes(k)))return 'negative';
  return 'warning';
}
function auto54Set(id,text,cls=null){const el=$(id);if(!el)return;el.textContent=text;if(cls!==null)el.className=cls;}
async function loadAutomationQualification54(addr,{force=false}={}){
  if(!addr||(!force&&automationUi.qualification[addr])||automationUi.loading.has(addr))return;
  automationUi.loading.add(addr);renderAutomationConfig();
  try{automationUi.qualification[addr]=await window.cg.getDynamicQualification?.(addr);}
  catch(e){automationUi.qualification[addr]={state:'UNKNOWN',error:e.message||String(e)};}
  finally{automationUi.loading.delete(addr);if(automationUi.selected===addr)renderAutomationConfig();}
}
function renderAutomationSummary(){
  const box=$('automation-summary');if(!box)return;
  const trusted=trustedWalletEntries(),configured=trusted.filter(([a])=>automationConfig(a)),enabled=trusted.filter(([a])=>automationConfig(a)?.enabled!==false&&automationConfig(a));
  const today=Object.values(state.daily||{}).reduce((n,x)=>n+Number(x.trades||0),0),loss=Object.values(state.daily||{}).reduce((n,x)=>n+Number(x.lossSol||0),0);
  const a=state.automation||{},ex=state.executionSafety||{},attempts=ex.attempts||[],unverified=attempts.filter(x=>['RESERVED','SUBMITTED_UNVERIFIED','UNCERTAIN_AFTER_PAUSE'].includes(String(x.status))).length;
  box.innerHTML=[
    ['MASTER',a.paused?'PAUSED':a.enabled?'ARMED':'DISABLED',a.paused?'Emergency lock active':a.enabled?'Rules may execute after all gates pass':'Manual only',a.paused?'bad':a.enabled?'good':'warn'],
    ['ENABLED PROFILES',enabled.length,`${configured.length} configured / ${trusted.length} trusted`,''],
    ['TODAY AUTO TRADES',today,`${loss.toFixed(3)} SOL daily loss tracked`,loss>0?'warn':''],
    ['GLOBAL RISK CEILING',`${Number(a.maxAutomationRiskScore??45)}/100`,`${Number(a.maxSolGlobal||0).toFixed(2)} SOL max global size`,'warn'],
    ['UNVERIFIED ATTEMPTS',unverified,'Reserved/submitted/uncertain states',unverified?'warn':'good']
  ].map(x=>`<div class="automation-summary-card ${x[3]}"><span>${x[0]}</span><strong>${x[1]}</strong><small>${x[2]}</small></div>`).join('');
}
function renderAutomationMaster(){
  const a=state.automation||{},card=$('automation-master-card'),st=$('automation-master-state'),sub=$('automation-master-sub'),toggle=$('automation-toggle-enabled'),em=$('automation-emergency'),badge=$('automation-badge');
  if(!st)return;const mode=a.paused?'PAUSED':a.enabled?'ARMED':'DISABLED';
  st.textContent=mode;sub.textContent=a.paused?'Emergency pause blocks live automation':a.enabled?'Enabled profiles may execute only after every deterministic gate passes':'Trusted wallets remain manual';
  card?.classList.toggle('armed',!a.paused&&a.enabled);card?.classList.toggle('paused',!!a.paused);
  toggle.textContent=a.enabled?'Disable Auto Execute':'Enable Auto Execute';em.textContent=a.paused?'▶ Release Emergency Pause':'■ Emergency Pause';
  if(badge){badge.textContent=mode;badge.classList.toggle('armed',mode==='ARMED');badge.classList.toggle('paused',mode==='PAUSED');}
  const pm=$('monitor-label'),pd=$('monitor-dot');if(pm)pm.textContent=a.paused?'AUTOMATION PAUSED':'MONITORING';if(pd)pd.classList.toggle('paused',!!a.paused);
  const pb=$('pause-btn');if(pb){pb.textContent=a.paused?'▶ Release Emergency Pause':'■ Emergency Pause';pb.classList.toggle('paused',!!a.paused);}
}
function renderAutomationSafety54(){
  const h=state.data?.connectionHealth||{},sv=h.services||{},a=state.automation||{},ex=state.executionSafety||{};
  auto54Set('automation54-pause',a.paused?'ACTIVE':'RELEASED',a.paused?'negative':'positive');
  auto54Set('automation54-system-mode',h.mode||'STARTING',auto54Tone(h.mode));
  auto54Set('automation54-observation',sv.helius?.state||(state.ws.connected?'ONLINE':'UNKNOWN'),auto54Tone(sv.helius?.state||(state.ws.connected?'ONLINE':'UNKNOWN')));
  auto54Set('automation54-market',sv.dexscreener?.state||'UNKNOWN',auto54Tone(sv.dexscreener?.state));
  auto54Set('automation54-padre',sv.padre?.state||'UNKNOWN',auto54Tone(sv.padre?.state));
  auto54Set('automation54-exec-safety',ex.version?'ACTIVE':'READY',ex.version?'positive':'warning');
  auto54Set('automation54-global-status',a.paused?'PAUSED':a.enabled?'ARMED':'MANUAL',`status-chip49 ${a.paused?'negative':a.enabled?'positive':'warning'}`);
  const gates=$('automation-gates54');
  if(gates){
    const rows=[
      ['Emergency pause',!a.paused,a.paused?'Active — live execution blocked':'Released'],
      ['Global auto execute',!!a.enabled,a.enabled?'Armed':'Disabled / manual'],
      ['Connection mode',h.mode==='FULL',h.mode||'UNKNOWN'],
      ['Observation',String(sv.helius?.state||'').toUpperCase()==='ONLINE'||state.ws.connected,sv.helius?.state||(state.ws.connected?'ONLINE':'UNKNOWN')],
      ['Market pricing',String(sv.dexscreener?.state||'').toUpperCase()==='ONLINE'||String(sv.dexscreener?.state||'').toUpperCase()==='READY',sv.dexscreener?.state||'UNKNOWN'],
      ['Padre terminal',!['OFFLINE','ERROR','FAILED'].includes(String(sv.padre?.state||'').toUpperCase()),sv.padre?.state||'UNKNOWN'],
      ['Automated SELL',false,'Fail-closed until own-wallet holding/fill evidence exists']
    ];
    gates.innerHTML=rows.map(([n,ok,d])=>`<div class="automation-gate54 ${ok?'pass':'block'}"><i>${ok?'✓':'×'}</i><div><b>${n}</b><small>${esc(d)}</small></div></div>`).join('');
  }
  const exec=$('automation-execution54'),attempts=(ex.attempts||[]).slice(0,6);
  if(exec)exec.innerHTML=attempts.length?attempts.map(x=>`<div class="automation-exec-row54"><span class="${auto54Tone(x.status)}"></span><div><b>${esc(String(x.status||'UNKNOWN').replaceAll('_',' '))}</b><small>${esc((x.tokenSymbol?`$${x.tokenSymbol}`:shortAddr(x.tokenAddress||''))||'Unknown token')} · ${esc(shortAddr(x.walletAddress||''))}</small></div><em>${x.updatedAt||x.createdAt?fmtTime(x.updatedAt||x.createdAt):'—'}</em></div>`).join(''):'<div class="empty-state compact"><b>No execution attempts yet</b><span>Phase 32 states will appear here when automation reserves or submits an attempt.</span></div>';
}
function renderAutomationWalletList(){
  const box=$('automation-wallet-list');if(!box)return;const rows=trustedWalletEntries();$('automation-wallet-count').textContent=rows.length;
  if(!rows.length){box.innerHTML='<div class="automation-empty small"><span>◎</span><b>No trusted wallets yet</b><small>Wallets must complete deterministic Shadow qualification before Trusted promotion.</small></div>';return;}
  if(!automationUi.selected||!rows.some(([a])=>a===automationUi.selected))automationUi.selected=rows[0][0];
  box.innerHTML=rows.map(([addr,w])=>{const c=automationConfig(addr),ds=automationDaily(addr),sel=automationUi.selected===addr,q=automationUi.qualification[addr],qstate=q?.state||'UNKNOWN';const status=c?(c.enabled===false?'DISABLED':'ENABLED'):'MANUAL';return `<button class="automation-wallet-row automation-wallet-row54 ${sel?'selected':''}" data-auto-wallet="${esc(addr)}"><div class="wallet-avatar">${esc(walletInitial(w,addr))}</div><div><b>${esc(w.label||'Unnamed Wallet')}</b><small>${esc(shortAddr(addr))} · ${esc(String(qstate).replaceAll('_',' '))}</small></div><span class="auto-profile-state ${status.toLowerCase()}">${status}</span><em>${Number(ds.trades||0)} today</em></button>`;}).join('');
  if(automationUi.selected&&!automationUi.qualification[automationUi.selected]&&!automationUi.loading.has(automationUi.selected))loadAutomationQualification54(automationUi.selected);
}
function numInput(id,label,value,min='',max='',step='1',suffix=''){return `<label><span>${label}</span><div class="auto-input-wrap"><input id="${id}" type="number" value="${value??''}" ${min!==''?`min="${min}"`:''} ${max!==''?`max="${max}"`:''} step="${step}">${suffix?`<em>${suffix}</em>`:''}</div></label>`;}
function renderAutomationConfig(){
  const box=$('automation-config-panel'),addr=automationUi.selected,w=state.data?.wallets?.[addr];if(!box)return;
  if(!addr||!w){box.innerHTML='<div class="automation-empty"><span>⚡</span><b>Select a trusted wallet</b><small>Create or inspect its live automation profile.</small></div>';return;}
  const c={enabled:true,sizingMode:'fixed',fixedSol:.25,maxSolPerTrade:.5,maxDailyTrades:5,maxDailyLossSol:1,maxConcurrentPositions:3,maxRiskScore:45,minLiquidityUsd:25000,maxFdvUsd:0,requireAiApproval:false,aiMinConfidence:65,blockAiCaution:false,takeProfitPct:25,stopLossPct:12,trailingStopPct:0,balancePercent:5,kellyBankrollSol:10,kellyFraction:.25,kellyWinLossRatio:1.5,aiBaseSol:.5,...automationConfig(addr)};
  const ds=automationDaily(addr),open=automationOpenCount(addr),q=automationUi.qualification[addr]||{},qstate=q.state||'UNKNOWN',loading=automationUi.loading.has(addr);
  const qTone=auto54Tone(qstate),profileEffective=c.enabled!==false&&!state.automation.paused&&state.automation.enabled;
  box.innerHTML=`<div class="automation-config-head automation-config-head54"><div><span class="panel-kicker">TRUSTED WALLET PROFILE</span><h3>${esc(w.label||'Unnamed Wallet')}</h3><code>${esc(addr)}</code></div><label class="auto-switch"><input id="auto-enabled" type="checkbox" ${c.enabled!==false?'checked':''}><span></span><b>PROFILE ENABLED</b></label></div>
  <div class="automation-profile-health54">
    <div><span>DYNAMIC QUALIFICATION</span><b class="${qTone}">${loading?'LOADING':esc(String(qstate).replaceAll('_',' '))}</b><small>${esc(q.profile?.lastReason||(q.full?.qualified?'Qualification thresholds pass':'Qualification state required'))}</small></div>
    <div><span>EFFECTIVE EXECUTION</span><b class="${profileEffective?'positive':'warning'}">${profileEffective?'ARMED':'NOT ARMED'}</b><small>${state.automation.paused?'Emergency pause active':!state.automation.enabled?'Global auto execute disabled':c.enabled===false?'Profile disabled':'All system gates still apply'}</small></div>
    <div><span>TODAY</span><b>${Number(ds.trades||0)} trades</b><small>${Number(ds.lossSol||0).toFixed(3)} SOL loss tracked</small></div>
    <div><span>OPEN LOTS</span><b>${open}</b><small>Profile limit ${Number(c.maxConcurrentPositions||0)}</small></div>
  </div>
  <div class="automation-form-section"><h4>POSITION SIZING</h4><div class="automation-form-grid"><label><span>SIZING MODE</span><select id="auto-sizing-mode"><option value="fixed" ${c.sizingMode==='fixed'?'selected':''}>Fixed SOL</option><option value="percent_balance" ${c.sizingMode==='percent_balance'?'selected':''}>% Balance</option><option value="ai_weighted" ${c.sizingMode==='ai_weighted'?'selected':''}>AI Weighted</option><option value="kelly" ${c.sizingMode==='kelly'?'selected':''}>Fractional Kelly</option></select></label>${numInput('auto-fixed-sol','FIXED SOL',c.fixedSol,.01,100,.01,'SOL')}${numInput('auto-max-sol','MAX SOL / TRADE',c.maxSolPerTrade,.01,100,.01,'SOL')}${numInput('auto-balance-percent','BALANCE %',c.balancePercent,.1,100,.1,'%')}${numInput('auto-ai-base','AI BASE SOL',c.aiBaseSol,.01,100,.01,'SOL')}${numInput('auto-bankroll','REFERENCE BANKROLL',c.kellyBankrollSol,.01,100000,.01,'SOL')}</div></div>
  <div class="automation-form-section"><h4>RISK + DAILY LIMITS</h4><div class="automation-form-grid">${numInput('auto-risk','MAX RISK SCORE',c.maxRiskScore,0,100,1,'/100')}${numInput('auto-liquidity','MIN LIQUIDITY',c.minLiquidityUsd,0,1000000000,1000,'USD')}${numInput('auto-fdv','MAX FDV (0 = OFF)',c.maxFdvUsd,0,100000000000,10000,'USD')}${numInput('auto-daily-trades','MAX DAILY TRADES',c.maxDailyTrades,1,1000,1,'')}${numInput('auto-daily-loss','MAX DAILY LOSS',c.maxDailyLossSol,.01,1000,.01,'SOL')}${numInput('auto-concurrent','MAX OPEN POSITIONS',c.maxConcurrentPositions,1,100,1,'')}</div></div>
  <div class="automation-form-section"><h4>AI GATE</h4><div class="automation-checks"><label><input id="auto-require-ai" type="checkbox" ${c.requireAiApproval?'checked':''}><span>Require AI approval before automated execution</span></label><label><input id="auto-block-caution" type="checkbox" ${c.blockAiCaution?'checked':''}><span>Block AI CAUTION recommendations; allow COPY only</span></label></div><div class="automation-form-grid">${numInput('auto-ai-confidence','MIN AI CONFIDENCE',c.aiMinConfidence,0,100,1,'%')}</div><p class="automation-disclaimer">AI can add a gate, but it cannot waive deterministic Risk Engine or Phase 32 blocks.</p></div>
  <div class="automation-form-section"><h4>EXIT PROTECTION</h4><div class="automation-form-grid">${numInput('auto-tp','TAKE PROFIT',c.takeProfitPct,0,10000,.1,'%')}${numInput('auto-sl','STOP LOSS',c.stopLossPct,0,100,.1,'%')}${numInput('auto-trailing','TRAILING STOP (0 = OFF)',c.trailingStopPct,0,100,.1,'%')}</div><p class="automation-disclaimer">Protection settings are forwarded to the Padre bridge when supported. Third-party UI execution is never assumed successful without evidence.</p></div>
  <div class="automation-config-actions"><button class="primary-action" id="auto-save-profile">SAVE PROFILE</button><button class="ghost" id="auto-refresh-qualification54">↻ REFRESH QUALIFICATION</button><button class="ghost" id="auto-disable-profile">${automationConfig(addr)?'DELETE PROFILE':'KEEP MANUAL'}</button></div>`;
}
function renderAutomation(){
  renderAutomationMaster();renderAutomationSummary();renderAutomationWalletList();renderAutomationConfig();renderAutomationSafety54();
  const a=state.automation||{};if($('automation-global-max-sol'))$('automation-global-max-sol').value=Number(a.maxSolGlobal||2);if($('automation-global-risk'))$('automation-global-risk').value=Number(a.maxAutomationRiskScore??45);
}

function readNum(id,def=0){const n=Number($(id)?.value);return Number.isFinite(n)?n:def;}
async function saveAutomationProfile(){const addr=automationUi.selected;if(!addr)return;const cfg={enabled:!!$('auto-enabled')?.checked,sizingMode:$('auto-sizing-mode')?.value||'fixed',fixedSol:readNum('auto-fixed-sol',.25),maxSolPerTrade:readNum('auto-max-sol',.5),balancePercent:readNum('auto-balance-percent',5),aiBaseSol:readNum('auto-ai-base',.5),kellyBankrollSol:readNum('auto-bankroll',10),kellyFraction:.25,kellyWinLossRatio:1.5,maxRiskScore:readNum('auto-risk',45),minLiquidityUsd:readNum('auto-liquidity',25000),maxFdvUsd:readNum('auto-fdv',0),maxDailyTrades:readNum('auto-daily-trades',5),maxDailyLossSol:readNum('auto-daily-loss',1),maxConcurrentPositions:readNum('auto-concurrent',3),requireAiApproval:!!$('auto-require-ai')?.checked,blockAiCaution:!!$('auto-block-caution')?.checked,aiMinConfidence:readNum('auto-ai-confidence',65),takeProfitPct:readNum('auto-tp',25),stopLossPct:readNum('auto-sl',12),trailingStopPct:readNum('auto-trailing',0),updatedAt:Date.now()};await window.cg.saveTrustedConfig(addr,cfg);state.trustedConfigs[addr]=cfg;renderAutomation();renderDashboard();toast('Trusted wallet automation profile saved');}
async function setAutomationPatch(patch,msg){const r=await window.cg.setAutomationState(patch);if(r?.ok){state.automation={...state.automation,...r};if(state.data?.settings){state.data.settings.autoExecute=r.enabled;state.data.settings.automationPaused=r.paused;state.data.settings.maxSolGlobal=r.maxSolGlobal;state.data.settings.maxAutomationRiskScore=r.maxAutomationRiskScore;}renderAutomation();renderDashboard();toast(msg);}return r;}
function initAutomation(){$('automation-wallet-list')?.addEventListener('click',e=>{const b=e.target.closest('[data-auto-wallet]');if(!b)return;automationUi.selected=b.dataset.autoWallet;renderAutomation();loadAutomationQualification54(automationUi.selected);});$('automation-config-panel')?.addEventListener('click',async e=>{if(e.target.closest('#auto-save-profile'))await saveAutomationProfile();if(e.target.closest('#auto-refresh-qualification54')){const addr=automationUi.selected;if(addr){delete automationUi.qualification[addr];await loadAutomationQualification54(addr,{force:true});toast('Qualification evidence refreshed');}}if(e.target.closest('#auto-disable-profile')){const addr=automationUi.selected;if(!addr)return;await window.cg.deleteTrustedConfig(addr);delete state.trustedConfigs[addr];renderAutomation();renderDashboard();toast('Automation profile removed; wallet remains Trusted but manual');}});$('automation-toggle-enabled')?.addEventListener('click',()=>setAutomationPatch({enabled:!state.automation.enabled},state.automation.enabled?'Global auto execute disabled':'Global auto execute enabled'));$('automation-emergency')?.addEventListener('click',()=>setAutomationPatch({paused:!state.automation.paused},state.automation.paused?'Emergency pause released':'AUTOMATION EMERGENCY-PAUSED'));$('automation-save-global')?.addEventListener('click',()=>setAutomationPatch({maxSolGlobal:readNum('automation-global-max-sol',2),maxAutomationRiskScore:readNum('automation-global-risk',45)},'Global automation limits saved'));}



function scoreWallet(w={}){const st=w.stats||{};const wr=Math.max(0,Math.min(100,Number(st.winRate||0)));const trades=Math.max(0,Number(st.totalTrades||0));const pnl=Number(st.totalPnl||0);return Math.max(0,Math.min(100,Math.round(wr*.55+Math.min(25,trades*.8)+Math.max(-10,Math.min(20,pnl*2)))));}
const intelLegacyEvidenceLabels56=['REPEAT','GATE']; // PHASE 29 · CLOSED-LOOP LEARNING + DISCOVERY
function intelSignals(){
  const d=state.data||{},h=d.history||[],out=[];
  (d.healthAlerts||[]).filter(a=>!a.dismissed).forEach(a=>out.push({id:a.id||`health-${a.walletAddress}-${a.triggeredAt}`,type:'Wallet health',severity:String(a.severity||'warning').toLowerCase(),title:a.walletLabel||shortAddr(a.walletAddress),message:a.message||'Performance warning',time:a.triggeredAt||0,address:a.walletAddress,raw:a}));
  h.filter(x=>x.bundleAlert?.detected).slice(0,30).forEach(x=>out.push({id:`bundle-${x.id||x.sourceEventKey||x.timestamp}`,type:'Coordination',severity:String(x.bundleAlert.severity||'warning').toLowerCase(),title:x.tokenSymbol?`$${x.tokenSymbol}`:shortAddr(x.tokenAddress),message:x.bundleAlert.message||'Coordinated activity detected',time:x.timestamp||x.savedAt||0,address:x.walletAddress,tokenAddress:x.tokenAddress,raw:x}));
  h.filter(x=>x.riskAssessment?.hardBlock||x.riskAssessment?.hardBlocks?.length).slice(0,30).forEach(x=>out.push({id:`risk-${x.id||x.sourceEventKey||x.timestamp}`,type:'Hard block',severity:'critical',title:x.tokenSymbol?`$${x.tokenSymbol}`:shortAddr(x.tokenAddress),message:(x.riskAssessment.hardBlockReasons||x.riskAssessment.hardBlocks||[]).join(' · ')||'Deterministic safety block',time:x.timestamp||x.savedAt||0,address:x.walletAddress,tokenAddress:x.tokenAddress,raw:x}));
  return out.sort((a,b)=>b.time-a.time).slice(0,80);
}
function intelDiscoveryRows56(){return state.data?.discovery?.candidates||[];}
function intelCandidate56(addr){return intelDiscoveryRows56().find(x=>x.address===addr)||null;}
function intelGateTone56(g=''){const x=String(g).toUpperCase();return x==='SHADOW_READY'?'good':x==='WATCH'?'warn':x==='CLUSTER_REVIEW'?'bad':x==='ONE_HIT_WONDER'?'muted':'';}
function intelPct56(v){return Number.isFinite(Number(v))?`${Math.round(Number(v)*100)}%`:'—';}
function renderIntelSummary(){
  const d=state.data||{},st=d.discovery?.stats||{},alerts=(d.healthAlerts||[]).filter(x=>!x.dismissed),wl=d.intelligenceWatchlist||[],signals=intelSignals();
  $('intel-summary').innerHTML=[
    [st.candidates||0,'DISCOVERY CANDIDATES','All auditable Phase 27 records'],
    [st.shadowReady||0,'SHADOW READY','Repeatability gate passed'],
    [st.clustered||0,'CLUSTER REVIEW','Candidates with cluster penalty'],
    [st.rejectedOneHit||0,'ONE-HIT REJECTED','Insufficient repeatability'],
    [alerts.length+signals.filter(x=>x.type!=='Wallet health').length,'ACTIVE SIGNALS',`${alerts.length} health · ${wl.length} watched`]
  ].map(x=>`<div class="intel-stat"><span>${x[1]}</span><strong>${x[0]}</strong><small>${x[2]}</small></div>`).join('');
}
function intelDiscoveryList56(items){
  if(!items.length)return '<div class="intel-empty"><span>◇</span><b>No discovery candidates yet</b><small>Run Phase 27 discovery when Helius is configured. Candidates require independent early-token appearances before SHADOW_READY.</small></div>';
  return `<div class="intel-list intel-list56">${items.map(x=>{const selected=intelUi.selected===x.address&&intelUi.selectedKind==='discover',gate=String(x.gate||'UNKNOWN'),tone=intelGateTone56(gate),shadow=state.data?.ghostPerformance?.[x.address];return `<article class="intel-row intel-row56 ${selected?'selected':''}" data-intel-select="${esc(x.address)}" data-intel-kind="discover"><div class="intel-score ${tone}">${Math.round(Number(x.score||0))}</div><div class="intel-main"><b>${esc(x.shortAddress||shortAddr(x.address))}</b><small>${esc(shortAddr(x.address))}</small><p>${esc(x.sourceLabel||'Repeatability evidence available')}</p></div><div class="intel-metric"><span>REPEAT</span><b>${Number(x.historicalRepeat||x.independentTokens||0)}</b></div><div class="intel-metric"><span>AVG RANK</span><b>${x.avgRank!=null?Number(x.avgRank).toFixed(1):'—'}</b></div><div class="intel-gate56 ${tone}"><span>${esc(gate.replaceAll('_',' '))}</span><small>${Number(x.clusterPenalty||0)>0?`-${Number(x.clusterPenalty)} cluster`:'independence checked'}</small></div><div class="intel-actions">${shadow?`<button data-intel-shadow="${esc(x.address)}">SHADOW</button>`:gate!=='ONE_HIT_WONDER'?`<button class="primary" data-intel-watch="${esc(x.address)}">WATCH</button>`:''}<button data-intel-monitor="${esc(x.address)}">MONITOR</button></div></article>`;}).join('')}</div>`;
}
function intelGenericRows56(items,kind){
  if(!items.length)return `<div class="intel-empty"><span>${kind==='health'?'♡':kind==='signals'?'⌁':'◇'}</span><b>No ${kind==='health'?'active health alerts':kind==='watchlist'?'wallets under observation':'current signals'}</b><small>${kind==='health'?'Current monitored-wallet health has no active warnings.':kind==='watchlist'?'Watch a discovery candidate before deciding whether it belongs in monitored wallets.':'Coordination, hard-block and health events will appear here.'}</small></div>`;
  if(kind==='signals')return `<div class="intel-list intel-list56">${items.map(x=>`<article class="intel-row intel-row56 alert ${intelUi.selected===x.id&&intelUi.selectedKind==='signals'?'selected':''}" data-intel-select="${esc(x.id)}" data-intel-kind="signals"><div class="intel-score ${x.severity==='critical'?'bad':x.severity==='warning'?'warn':''}">${x.severity==='critical'?'!':'◇'}</div><div class="intel-main"><b>${esc(x.title)}</b><small>${esc(x.type)} · ${fmtTime(x.time)}</small><p>${esc(x.message)}</p></div><div><span class="signal-tag ${esc(x.severity)}">${esc(String(x.severity).toUpperCase())}</span></div><div class="intel-actions">${x.address?`<button data-intel-open-wallet="${esc(x.address)}">WALLET</button>`:''}${x.tokenAddress?`<button data-intel-token="${esc(x.tokenAddress)}">TOKEN</button>`:''}</div></article>`).join('')}</div>`;
  return `<div class="intel-list intel-list56">${items.map(x=>{const addr=x.address||x.walletAddress||'',w=state.data?.wallets?.[addr],label=x.walletLabel||w?.label||x.shortAddress||shortAddr(addr),selected=intelUi.selected===addr&&intelUi.selectedKind===kind;return `<article class="intel-row intel-row56 ${kind==='health'?'alert':''} ${selected?'selected':''}" data-intel-select="${esc(addr)}" data-intel-kind="${kind}"><div class="intel-score ${kind==='health'?(String(x.severity).toLowerCase()==='critical'?'bad':'warn'):''}">${kind==='health'?'!':'◇'}</div><div class="intel-main"><b>${esc(label)}</b><small>${esc(shortAddr(addr))}</small><p>${esc(kind==='health'?(x.message||'Wallet health warning'):(x.note||x.sourceLabel||'Candidate under observation'))}</p></div><div class="intel-metric"><span>WIN RATE</span><b>${Number(w?.stats?.winRate||x.rollingWinRate||0)?Number(w?.stats?.winRate||x.rollingWinRate||0).toFixed(0)+'%':'—'}</b></div><div class="intel-metric"><span>TRADES</span><b>${Number(w?.stats?.totalTrades||x.estimatedTrades||0)||'—'}</b></div><div class="intel-actions">${kind==='health'?`<button data-intel-open-wallet="${esc(addr)}">WALLET</button><button data-intel-dismiss-health="${esc(addr)}">DISMISS</button>`:`<button data-intel-monitor="${esc(addr)}">MONITOR</button><button data-intel-open-wallet="${esc(addr)}">WALLET</button><button class="danger" data-intel-unwatch="${esc(addr)}">REMOVE</button>`}</div></article>`}).join('')}</div>`;
}
function renderIntelDetail56(){
  const box=$('intel-detail56');if(!box)return;const d=state.data||{};
  if(!intelUi.selected){box.innerHTML='<div class="intel-detail-empty56"><span>◇</span><b>Select intelligence evidence</b><small>Inspect repeatability, clustering, source token appearances, health evidence, or risk signals.</small></div>';return;}
  if(intelUi.selectedKind==='discover'){
    const x=intelCandidate56(intelUi.selected);if(!x){intelUi.selected=null;renderIntelDetail56();return;}const evidence=x.evidence||[],shadow=d.ghostPerformance?.[x.address],gate=String(x.gate||'UNKNOWN'),tone=intelGateTone56(gate);
    box.innerHTML=`<div class="intel-detail-head56"><div><span>PHASE 27 CANDIDATE</span><h3>${esc(x.shortAddress||shortAddr(x.address))}</h3><code>${esc(x.address)}</code></div><div class="intel-detail-score56 ${tone}"><b>${Math.round(Number(x.score||0))}</b><span>${esc(gate.replaceAll('_',' '))}</span></div></div><div class="intel-evidence-grid56"><div><span>INDEPENDENT TOKENS</span><b>${Number(x.historicalRepeat||x.independentTokens||0)}</b></div><div><span>AVG ENTRY RANK</span><b>${x.avgRank!=null?Number(x.avgRank).toFixed(1):'—'}</b></div><div><span>TOP-10 RATE</span><b>${intelPct56(x.top10Rate)}</b></div><div><span>&lt;10 MIN RATE</span><b>${intelPct56(x.under10mRate)}</b></div><div><span>HIGH-CONFIDENCE</span><b>${intelPct56(x.highConfidenceRate)}</b></div><div><span>POSITIVE RUNS</span><b>${intelPct56(x.positiveRunRate)}</b></div><div><span>CLUSTER OVERLAP</span><b class="${Number(x.clusterPenalty||0)>0?'negative':''}">${intelPct56(x.clusterOverlap)}</b></div><div><span>CLUSTER PENALTY</span><b class="${Number(x.clusterPenalty||0)>0?'negative':''}">${Number(x.clusterPenalty||0)}</b></div></div>${x.strongestPeer?`<div class="intel-cluster56"><b>STRONGEST COHORT PEER</b><code>${esc(x.strongestPeer)}</code><span>Overlap is a coordination/correlation signal, not proof of common control.</span></div>`:''}<div class="intel-detail-section56"><div class="panel-head"><div><span class="panel-kicker">SOURCE EVIDENCE</span><h3>Independent Token Appearances</h3></div><span class="count-pill">${evidence.length}</span></div>${evidence.length?`<div class="intel-evidence-list56">${evidence.map((e,i)=>`<div><span>#${i+1}</span><div><b>${esc(e.symbol?`$${e.symbol}`:shortAddr(e.address))}</b><small>entry rank ${e.rank??'—'} · ${e.secondsAfterLaunch!=null?fmtDuration(Number(e.secondsAfterLaunch)*1000):'timing unknown'} · ${esc(e.reconstructionConfidence||'UNKNOWN')} confidence</small></div><em>${e.signature?`<button data-intel-signature="${esc(e.signature)}">TX ↗</button>`:'NO TX'}</em></div>`).join('')}</div>`:'<div class="empty-state compact"><b>No source appearances retained</b><span>The candidate record remains auditable through its gate metrics.</span></div>'}</div><div class="intel-routing56"><div><span>SHADOW STATUS</span><b>${shadow?esc(String(shadow.dynamicState||shadow.status||'TESTING').replaceAll('_',' ')):(x.shadowEligible?'ELIGIBLE / ROUTING DEPENDS ON PHASE 27':'NOT ROUTED')}</b></div><p>SHADOW_READY permits paper testing only. It never authorizes Trusted or live execution.</p></div><div class="intel-detail-actions56">${shadow?`<button class="primary-action" data-intel-shadow="${esc(x.address)}">OPEN SHADOW LAB</button>`:''}<button data-intel-watch="${esc(x.address)}">WATCH</button><button data-intel-monitor="${esc(x.address)}">MONITOR AS PENDING</button></div>`;
    return;
  }
  if(intelUi.selectedKind==='signals'){
    const x=intelSignals().find(s=>s.id===intelUi.selected);if(!x){intelUi.selected=null;renderIntelDetail56();return;}box.innerHTML=`<div class="intel-detail-head56"><div><span>${esc(x.type.toUpperCase())}</span><h3>${esc(x.title)}</h3><small>${fmtTime(x.time)}</small></div><span class="signal-tag ${esc(x.severity)}">${esc(x.severity.toUpperCase())}</span></div><div class="intel-signal-detail56"><p>${esc(x.message)}</p><div><span>WALLET</span><b>${x.address?esc(shortAddr(x.address)):'—'}</b></div><div><span>TOKEN</span><b>${x.tokenAddress?esc(shortAddr(x.tokenAddress)):'—'}</b></div></div><div class="intel-detail-actions56">${x.address?`<button data-intel-open-wallet="${esc(x.address)}">OPEN WALLET</button>`:''}${x.tokenAddress?`<button data-intel-token="${esc(x.tokenAddress)}">RESEARCH TOKEN</button>`:''}</div>`;return;
  }
  const arr=intelUi.selectedKind==='health'?(d.healthAlerts||[]):(d.intelligenceWatchlist||[]),x=arr.find(v=>(v.address||v.walletAddress)===intelUi.selected),addr=intelUi.selected,w=d.wallets?.[addr];
  box.innerHTML=`<div class="intel-detail-head56"><div><span>${intelUi.selectedKind==='health'?'WALLET HEALTH':'WATCHLIST EVIDENCE'}</span><h3>${esc(x?.walletLabel||w?.label||shortAddr(addr))}</h3><code>${esc(addr)}</code></div></div><div class="intel-signal-detail56"><p>${esc(x?.message||x?.note||x?.sourceLabel||'Wallet remains under observation.')}</p><div><span>WIN RATE</span><b>${Number(w?.stats?.winRate||0).toFixed(1)}%</b></div><div><span>TRADES</span><b>${Number(w?.stats?.totalTrades||0)}</b></div><div><span>TIER</span><b>${esc(String(w?.tier||'NOT MONITORED').toUpperCase())}</b></div></div><div class="intel-detail-actions56"><button data-intel-open-wallet="${esc(addr)}">OPEN WALLET</button>${!w?`<button data-intel-monitor="${esc(addr)}">MONITOR AS PENDING</button>`:''}</div>`;
}
function renderIntelSide(){
  const d=state.data||{},settings=d.settings||{},learn=d.learningEngine||{},ls=learn.summary||{},disc=d.discovery||{},st=disc.stats||{};
  $('intel-engine-status').innerHTML=[['Phase 28 specialized AI',!!settings.apiKeys?.[settings.aiProvider],settings.apiKeys?.[settings.aiProvider]?'Evidence-scoped specialist contracts':'AI key optional'],['Phase 29 closed-loop learning',true,`${Number(ls.linkedOutcomes||0)} verified links`],['Phase 27 repeatability discovery',!!settings.heliusApiKey,settings.heliusApiKey?(st.running?'Scan running':`${Number(st.runs||0)} completed scans`):'Helius API key required'],['Independent-token minimum',true,'3 appearances before repeatability gate'],['Cluster penalty',true,`${Number(st.clustered||0)} candidate${Number(st.clustered||0)===1?'':'s'} currently penalized`],['Shadow routing',true,`${Number(st.shadowReady||0)} SHADOW_READY · never direct Trusted`],['Wallet health',true,'5-minute rolling check'],['Phase 29 learning',true,`${Number(ls.linkedOutcomes||0)} verified links`]].map(x=>`<div class="intel-engine-row"><span class="${x[1]?'live':''}"></span><div><b>${x[0]}</b><small>${x[2]}</small></div></div>`).join('');
  const lb=$('intel-learning-status');if(lb){const proposals=learn.topProposals||[];lb.innerHTML=`<div class="intel-learning56"><div><span>VERIFIED LINKS</span><b>${Number(ls.linkedOutcomes||0)}</b></div><div><span>AI SCORED</span><b>${Number(ls.aiPredictionsScored||0)}</b></div><div><span>RISK SCORED</span><b>${Number(ls.riskDecisionsScored||0)}</b></div><div><span>PROPOSALS</span><b>${Number(learn.proposalCount||0)}</b></div></div>${proposals.slice(0,3).map(p=>`<div class="intel-top-row"><div><b>${esc(p.type||'LEARNING')}</b><small>${esc(p.signal||p.key||'Evidence review')} · ${Number(p.samples||0)} samples</small></div><strong>${p.accuracyPct!=null?Number(p.accuracyPct).toFixed(0)+'%':Number(p.avgReturnPct||0).toFixed(1)+'%'}</strong></div>`).join('')||'<div class="empty-state compact"><b>Learning baseline building</b><span>Proposals remain advisory and appear only after enough verified outcomes.</span></div>'}`;}
  const runs=$('intel-runs56'),rr=disc.recentRuns||[];if(runs)runs.innerHTML=rr.length?rr.slice(0,6).map(r=>`<div class="intel-run56"><div><b>${fmtTime(r.completedAt||r.startedAt)}</b><small>${Number(r.tokensAnalyzed||0)} tokens · ${Number(r.candidatesEvaluated||0)} candidates</small></div><span>${Number(r.shadowReady||0)} ready</span><em>${Number(r.autoRouted||0)} routed</em></div>`).join(''):'<div class="empty-state compact"><b>No discovery runs yet</b><span>Run Phase 27 discovery to build scan history.</span></div>';
}
function renderIntelligence(){
  if(!$('intel-content')||!state.data)return;renderIntelSummary();renderIntelSide();document.querySelectorAll('[data-intel-tab]').forEach(b=>b.classList.toggle('active',b.dataset.intelTab===intelUi.tab));const d=state.data;let items=[],title='',kick='';
  if(intelUi.tab==='discover'){items=intelDiscoveryRows56();title='Repeatability Candidates';kick='PHASE 27 · DISCOVERY EVIDENCE';}
  else if(intelUi.tab==='health'){items=(d.healthAlerts||[]).filter(x=>!x.dismissed).sort((a,b)=>(b.triggeredAt||0)-(a.triggeredAt||0));title='Wallet Health';kick='DEGRADATION MONITOR';}
  else if(intelUi.tab==='watchlist'){items=d.intelligenceWatchlist||[];title='Intelligence Watchlist';kick='UNDER OBSERVATION';}
  else{items=intelSignals();title='Signal Stream';kick='COORDINATION + DETERMINISTIC RISK';}
  $('intel-title').textContent=title;$('intel-kicker').textContent=kick;$('intel-count').textContent=items.length;$('intel-content').innerHTML=intelUi.tab==='discover'?intelDiscoveryList56(items):intelGenericRows56(items,intelUi.tab);renderIntelDetail56();
}
async function intelMonitor(addr){const d=state.data;if(!d||!addr)return;if(d.wallets[addr]){walletUi.selected=addr;go('wallets');toast('Wallet is already monitored');return;}const sug=(d.suggestions||[]).find(x=>x.address===addr)||(d.intelligenceWatchlist||[]).find(x=>x.address===addr)||intelCandidate56(addr)||{};d.wallets[addr]={label:sug.label||`Intel ${shortAddr(addr)}`,tier:'pending',addedAt:Date.now(),stats:{winRate:Number(sug.estimatedWinRate||0),totalTrades:Number(sug.estimatedTrades||0),totalPnl:Number(sug.totalPnlSol||0)},intelligenceSource:'phase56-review'};await window.cg.saveWallets(d.wallets);walletUi.selected=addr;renderIntelligence();renderLeaderboard();refreshRiskCenter();renderDashboard();toast('Added as Pending monitored wallet — not Trusted');}
function initIntelligence(){
  $('intel-tabs')?.addEventListener('click',e=>{const b=e.target.closest('[data-intel-tab]');if(!b)return;intelUi.tab=b.dataset.intelTab;intelUi.selected=null;intelUi.selectedKind=null;renderIntelligence();});
  $('intel-scan-now')?.addEventListener('click',async()=>{if(intelUi.scanning)return;intelUi.scanning=true;$('intel-scan-now').textContent='SCANNING…';const r=await window.cg.scanWalletsNow();toast(r?.ok?`Discovery scan complete · ${Number(r.shadowReady||0)} Shadow-ready`:(r?.reason||'Could not run discovery'));await load();intelUi.scanning=false;if($('intel-scan-now'))$('intel-scan-now').textContent='◇ Run Discovery Scan';});
  $('intel-health-now')?.addEventListener('click',async()=>{await window.cg.runHealthNow();await load();toast('Wallet health check complete');});
  const handler=async e=>{let b;if(b=e.target.closest('[data-intel-signature]')){await window.cg.openExternal(`https://solscan.io/tx/${b.dataset.intelSignature}`);return;}if(b=e.target.closest('[data-intel-token]')){go('research');if($('research-query'))$('research-query').value=b.dataset.intelToken;runResearch(b.dataset.intelToken);return;}if(b=e.target.closest('[data-intel-shadow]')){ghostUi.selected=b.dataset.intelShadow;go('ghost');refreshGhost16();return;}if(b=e.target.closest('[data-intel-watch]')){const addr=b.dataset.intelWatch,s=(state.data.suggestions||[]).find(x=>x.address===addr)||intelCandidate56(addr)||{address:addr};const r=await window.cg.intelWatchAdd(s);state.data.intelligenceWatchlist=r.watchlist||[];renderIntelligence();toast('Wallet added to intelligence watchlist');return;}if(b=e.target.closest('[data-intel-unwatch]')){const r=await window.cg.intelWatchRemove(b.dataset.intelUnwatch);state.data.intelligenceWatchlist=r.watchlist||[];renderIntelligence();toast('Removed from intelligence watchlist');return;}if(b=e.target.closest('[data-intel-monitor]')){await intelMonitor(b.dataset.intelMonitor);return;}if(b=e.target.closest('[data-intel-dismiss]')){await window.cg.dismissSug(b.dataset.intelDismiss);const s=(state.data.suggestions||[]).find(x=>x.address===b.dataset.intelDismiss);if(s)s.dismissed=true;renderIntelligence();return;}if(b=e.target.closest('[data-intel-dismiss-health]')){await window.cg.dismissHealth(b.dataset.intelDismissHealth);const a=(state.data.healthAlerts||[]).find(x=>x.walletAddress===b.dataset.intelDismissHealth&&!x.dismissed);if(a)a.dismissed=true;renderIntelligence();return;}if(b=e.target.closest('[data-intel-open-wallet]')){walletUi.selected=b.dataset.intelOpenWallet;go('wallets');return;}const row=e.target.closest('[data-intel-select]');if(row){intelUi.selected=row.dataset.intelSelect;intelUi.selectedKind=row.dataset.intelKind;renderIntelligence();}};
  $('intel-content')?.addEventListener('click',handler);$('intel-detail56')?.addEventListener('click',handler);
}
function leaderboardRows(){
  const rows=[...(leaderUi.data?.rows||[])],q=leaderUi.query.toLowerCase().trim();
  let out=rows.filter(x=>{const tier=x.tier||'pending',isGhost=!!x.shadow&&!x.shadow.liveActivated;if(leaderUi.tier==='ghost'&&!isGhost)return false;if(leaderUi.tier!=='all'&&leaderUi.tier!=='ghost'&&tier!==leaderUi.tier)return false;if(q&&!`${x.address} ${x.label||''} ${tier}`.toLowerCase().includes(q))return false;return true;});
  out.sort((a,b)=>{if(leaderUi.sort==='pnl')return Number(b.verified?.netPnlSol||0)-Number(a.verified?.netPnlSol||0);if(leaderUi.sort==='winrate')return Number(b.verified?.winRatePct||0)-Number(a.verified?.winRatePct||0);if(leaderUi.sort==='trades')return Number(b.verified?.completed||0)-Number(a.verified?.completed||0);if(leaderUi.sort==='repeatability')return Number(b.repeatability?.independentTokens||0)-Number(a.repeatability?.independentTokens||0);if(leaderUi.sort==='drawdown')return Number(a.verified?.maxDrawdownPct||999)-Number(b.verified?.maxDrawdownPct||999);return Number(b.score||0)-Number(a.score||0)||Number(b.verified?.netPnlSol||0)-Number(a.verified?.netPnlSol||0);});return out;
}
function leader63State(x){if(x.tier==='blacklisted')return'BLACKLISTED';if(x.tier==='trusted')return'TRUSTED';if(x.shadow?.liveActivated)return'LIVE';if(x.shadow?.qualified)return'QUALIFIED SHADOW';if(x.shadow)return String(x.shadow.dynamicState||x.shadow.status||'SHADOW');return String(x.tier||'PENDING').toUpperCase();}
function leader63Risk(x){const r=x.risk||{};if(Number(r.HARD_BLOCK||0)>0)return['HARD BLOCK','bad'];if(Number(r.CAUTION||0)>0)return['CAUTION','warn'];return[r.total?'PASS':'NO DATA',r.total?'good':''];}
function leader63Detail(){
  const box=$('leader63-detail');if(!box)return;const x=(leaderUi.data?.rows||[]).find(r=>r.address===leaderUi.selected);if(!x){box.innerHTML='<div class="position-detail-empty"><span>♛</span><b>Select a wallet</b><small>Inspect verified outcomes and qualification context.</small></div>';return;}
  const v=x.verified||{},s=x.shadow||{},rep=x.repeatability||{},risk=x.risk||{},rt=leader63Risk(x);
  box.innerHTML=`<div class="leader63-detail-head"><div><span class="tier-pill ${esc(x.tier||'pending')}">${esc(x.tier||'pending')}</span><h3>${esc(x.label||shortAddr(x.address))}</h3><code>${esc(x.address)}</code></div><div class="leader63-score"><strong>${Number(x.score||0)}</strong><span>/100</span></div></div><div class="leader63-truth"><b>VERIFIED PERFORMANCE ONLY</b><span>${Number(v.completed||0)} fully closed, source-verified outcomes drive realized ranking metrics.</span></div><div class="leader63-facts"><div><span>VERIFIED WIN RATE</span><b>${Number(v.winRatePct||0).toFixed(1)}%</b></div><div><span>VERIFIED P&amp;L</span><b class="${Number(v.netPnlSol||0)>0?'good':Number(v.netPnlSol||0)<0?'bad':''}">${Number(v.netPnlSol||0).toFixed(3)} SOL</b></div><div><span>PROFIT FACTOR</span><b>${v.profitFactor==null?'—':Number(v.profitFactor).toFixed(2)}</b></div><div><span>MAX DRAWDOWN</span><b>${Number(v.maxDrawdownPct||0).toFixed(1)}%</b></div><div><span>INDEPENDENT TOKENS</span><b>${Number(rep.independentTokens||0)}</b></div><div><span>AVG EARLY RANK</span><b>${rep.avgEntryRank==null?'—':'#'+Number(rep.avgEntryRank).toFixed(1)}</b></div></div><section class="leader63-section"><div class="panel-head"><div><span class="panel-kicker">SHADOW QUALIFICATION</span><h3>${s.status?esc(leader63State(x)):'No Shadow Profile'}</h3></div></div>${s.status?`<div class="leader63-progress"><i style="width:${Math.max(0,Math.min(100,Number(s.progressPct||0)))}%"></i></div><small>${Number(s.progressPct||0).toFixed(0)}% qualification progress · ${Number(s.openLots||0)} open lot(s) · ${s.qualified?'qualified evidence threshold met':'still testing'}</small>`:'<div class="leader63-empty">No Shadow qualification context.</div>'}</section><section class="leader63-section"><div class="panel-head"><div><span class="panel-kicker">DETERMINISTIC RISK CONTEXT</span><h3 class="${rt[1]}">${rt[0]}</h3></div></div><div class="leader63-risk-grid"><div><span>PASS</span><b>${Number(risk.PASS||0)}</b></div><div><span>CAUTION</span><b>${Number(risk.CAUTION||0)}</b></div><div><span>HARD BLOCK</span><b>${Number(risk.HARD_BLOCK||0)}</b></div></div><small>Ranking does not waive deterministic risk decisions.</small></section><section class="leader63-section"><div class="panel-head"><div><span class="panel-kicker">REPEATABILITY</span><h3>${Number(rep.independentTokens||0)} independent token appearances</h3></div></div><div class="leader63-repeat"><span>Discovery gate: <b>${esc(rep.discoveryGate||'—')}</b></span><span>Early Bird class: <b>${esc(rep.earlyBirdClass||'—')}</b></span></div></section><div class="leader63-actions"><button class="primary-action" data-leader-wallet="${esc(x.address)}">Open Wallet</button>${s.status?`<button class="ghost" data-leader-shadow="${esc(x.address)}">Open Shadow Lab</button>`:''}<button class="ghost" data-leader-solscan="${esc(x.address)}">Solscan ↗</button></div><div class="leader63-boundary"><b>RANKING ≠ TRUST</b><span>Leaderboard position cannot promote a wallet to Trusted and cannot authorize live execution. Qualification and explicit promotion remain separate.</span></div>`;
}
function renderLeaderboard(){
  if(!$('leader-list'))return;const rows=leaderboardRows(),all=leaderUi.data?.rows||[],verified=all.filter(x=>Number(x.verified?.completed||0)>0),trusted=all.filter(x=>x.tier==='trusted').length,qualified=all.filter(x=>x.shadow?.qualified&&!x.shadow?.liveActivated).length,best=rows[0];
  $('leader-summary').innerHTML=[[all.length,'MONITORED WALLETS','eligible for evidence view'],[verified.length,'WITH VERIFIED CLOSES','authoritative realized sample'],[qualified,'SHADOW QUALIFIED','still separate from Trusted'],[trusted,'TRUSTED','explicitly promoted profiles'],[best?best.score:0,'TOP EVIDENCE SCORE',best?.label||'No data']].map(x=>`<div class="leader-stat"><span>${x[1]}</span><strong>${x[0]}</strong><small>${esc(x[2])}</small></div>`).join('');
  if(leaderUi.selected&&!rows.some(x=>x.address===leaderUi.selected))leaderUi.selected=rows[0]?.address||null;if(!leaderUi.selected&&rows.length)leaderUi.selected=rows[0].address;
  $('leader-list').innerHTML=rows.length?rows.map((x,i)=>{const v=x.verified||{},rep=x.repeatability||{},rt=leader63Risk(x);return `<div class="leader-row leader63-row ${leaderUi.selected===x.address?'selected':''}" data-leader-select="${esc(x.address)}"><div class="leader-rank ${i<3?'top':''}">#${i+1}</div><div class="leader-wallet"><b>${esc(x.label||shortAddr(x.address))}</b><small>${esc(shortAddr(x.address))}</small></div><div class="leader-cell"><span>EVIDENCE SCORE</span><b>${Number(x.score||0)}</b></div><div class="leader-cell"><span>VERIFIED WR</span><b>${Number(v.winRatePct||0).toFixed(1)}%</b></div><div class="leader-cell"><span>VERIFIED CLOSES</span><b>${Number(v.completed||0)}</b></div><div class="leader-cell"><span>VERIFIED P&amp;L</span><b class="${Number(v.netPnlSol||0)>0?'good':Number(v.netPnlSol||0)<0?'bad':''}">${Number(v.netPnlSol||0).toFixed(3)} SOL</b></div><div class="leader-cell"><span>INDEPENDENT TOKENS</span><b>${Number(rep.independentTokens||0)}</b></div><div class="leader-cell"><span>RISK</span><b class="${rt[1]}">${rt[0]}</b></div><span class="tier-pill ${esc(x.tier||'pending')}">${esc(leader63State(x))}</span></div>`;}).join(''):'<div class="intel-empty"><span>♛</span><b>No wallets match</b><small>Adjust the filters or add monitored wallets.</small></div>';leader63Detail();
}
async function refreshLeaderboard63(){try{leaderUi.data=await window.cg.getLeaderboardEvidenceData();renderLeaderboard();}catch(e){console.error('[Leaderboard63]',e);toast('Could not load verified leaderboard evidence');}}
function initLeaderboard(){$('leader-search')?.addEventListener('input',e=>{leaderUi.query=e.target.value;renderLeaderboard();});$('leader-tier')?.addEventListener('change',e=>{leaderUi.tier=e.target.value;renderLeaderboard();});$('leader63-sort')?.addEventListener('change',e=>{leaderUi.sort=e.target.value;renderLeaderboard();});$('leader-refresh')?.addEventListener('click',async()=>{await refreshLeaderboard63();toast('Verified wallet evidence refreshed');});$('page-leaderboard')?.addEventListener('click',e=>{const row=e.target.closest('[data-leader-select]'),open=e.target.closest('[data-leader-wallet]'),shadow=e.target.closest('[data-leader-shadow]'),sol=e.target.closest('[data-leader-solscan]');if(open){walletUi.selected=open.dataset.leaderWallet;go('wallets');return;}if(shadow){ghostUi.selected=shadow.dataset.leaderShadow;go('ghost');refreshGhost16();return;}if(sol){window.cg.openExternal(`https://solscan.io/account/${sol.dataset.leaderSolscan}`);return;}if(row){leaderUi.selected=row.dataset.leaderSelect;renderLeaderboard();}});refreshLeaderboard63();}


function eb11Class(w){return w.classification||((w.suspicionLevel==='HIGH')?'ELITE':(w.suspicionLevel==='MEDIUM')?'STRONG':(w.suspicionLevel==='SPRAY')?'SPRAY':'NOTABLE');}
function eb11TimeAgo(ts){if(!ts)return 'Never';const d=Date.now()-Number(ts);if(d<60000)return 'just now';if(d<3600000)return `${Math.floor(d/60000)}m ago`;if(d<86400000)return `${Math.floor(d/3600000)}h ago`;return `${Math.floor(d/86400000)}d ago`;}
function eb11ClassLabel(c){return {ELITE:'Elite Early Bird',STRONG:'Strong Early Buyer',NOTABLE:'Notable',WATCH:'Watch',SPRAY:'Spray / Low Precision'}[c]||c;}
function eb11Wallets(){const q=earlyBirdUi.query.toLowerCase().trim(),cls=earlyBirdUi.classification;let arr=Object.values(earlyBirdUi.data.wallets||{}).filter(w=>{const c=eb11Class(w),watched=!!w.alreadyWatching||!!state.data?.wallets?.[w.address];if(earlyBirdUi.tab==='candidates'&&(w.dismissed||watched))return false;if(earlyBirdUi.tab==='watched'&&!watched)return false;if(earlyBirdUi.tab==='dismissed'&&!w.dismissed)return false;if(cls!=='all'&&c!==cls)return false;if(q){const hay=[w.address,w.shortAddress,c,...(w.earlyEntries||[]).map(e=>`${e.symbol||''} ${e.tokenAddress||''} ${e.signature||''}`)].join(' ').toLowerCase();if(!hay.includes(q))return false;}return true;});arr.sort((a,b)=>{if(earlyBirdUi.sort==='rank')return Number(a.avgEntryRank||99)-Number(b.avgEntryRank||99);if(earlyBirdUi.sort==='multiple')return Number(b.avgMultiple||0)-Number(a.avgMultiple||0);if(earlyBirdUi.sort==='consistency')return Number(b.consistency||0)-Number(a.consistency||0);if(earlyBirdUi.sort==='recent')return Number(b.lastUpdated||0)-Number(a.lastUpdated||0);return Number(b.score||0)-Number(a.score||0);});return arr;}
function eb11Summary(){const all=Object.values(earlyBirdUi.data.wallets||{}),active=all.filter(w=>!w.dismissed),elite=active.filter(w=>eb11Class(w)==='ELITE').length,strong=active.filter(w=>eb11Class(w)==='STRONG').length,watched=active.filter(w=>w.alreadyWatching||state.data?.wallets?.[w.address]).length,runs=earlyBirdUi.data.runs||[];const best=active.filter(w=>eb11Class(w)!=='SPRAY').sort((a,b)=>Number(b.score||0)-Number(a.score||0))[0];return [[elite,'ELITE',best?`Top score ${best.score}`:'85+ score'],[strong,'STRONG','70–84 score'],[watched,'MONITORED','Added as Pending+'],[runs.length,'RUNS ANALYZED',`${earlyBirdUi.data.reconstruction?.tokens||0} reconstructed histories`]];}
function renderEb11Progress(){const st=earlyBirdUi.data.scanState||{},dot=$('eb11-status-dot'),btn=$('eb11-scan'),wrap=$('eb11-progress-wrap');if(dot)dot.className=st.running?'running':st.stage==='error'||st.stage==='blocked'?'error':'ready';if($('eb11-status'))$('eb11-status').textContent=st.running?'SCANNING':st.stage==='error'?'ERROR':st.stage==='blocked'?'NEEDS HELIUS':'READY';if($('eb11-last-scan'))$('eb11-last-scan').textContent=st.lastCompletedAt?`Last scan ${eb11TimeAgo(st.lastCompletedAt)}`:'No completed scan yet';if($('eb11-progress-bar'))$('eb11-progress-bar').style.width=`${Math.max(0,Math.min(100,Number(st.progress||0)))}%`;if($('eb11-progress-text'))$('eb11-progress-text').textContent=st.message||'Ready';if(wrap)wrap.classList.toggle('active',!!st.running);if(btn){btn.disabled=!!st.running;btn.textContent=st.running?'SCANNING…':'✦ Scan Now';}}
function renderEb11RunsMini(){const box=$('eb11-run-strip');if(!box)return;const runs=(earlyBirdUi.data.runs||[]).slice(0,7);box.innerHTML=runs.length?runs.map(r=>`<button class="eb11-run-mini" data-eb-token="${esc(r.tokenAddress||'')}"><span>$${esc(r.symbol||'TOKEN')}</span><b>${Number(r.multiple||0).toFixed(1)}x</b><small>${eb11TimeAgo(r.analyzedAt)}</small></button>`).join(''):'<div class="intel-empty mini"><b>No qualifying runs yet</b><small>Run a scan after adding a Helius API key.</small></div>';}
function renderEb11History(){const box=$('eb11-history');if(!box)return;const h=(earlyBirdUi.data.scanHistory||[]).slice(0,5);box.innerHTML=h.length?h.map(x=>`<div class="eb11-history-row"><span>${new Date(x.completedAt||x.startedAt).toLocaleDateString()}</span><b>${Number(x.tokensAnalyzed||0)} runs</b><em>${Number(x.candidatesScored||0)} wallets</em></div>`).join(''):'<div class="intel-empty mini"><b>No scan ledger yet</b><small>Completed scans will be retained here.</small></div>';}
function eb11ScoreBars(w){const c=w.scoreComponents||{};const rows=[['Timing',c.timing,35],['Repeatability',c.repeatability,25],['Outcomes',c.outcomes,25],['Precision',c.precision,15]];return rows.map(([n,v,m])=>`<div class="eb11-score-row"><span>${n}</span><div><i style="width:${Math.max(0,Math.min(100,Number(v||0)/m*100))}%"></i></div><b>${Number(v||0)}/${m}</b></div>`).join('')+(Number(c.copycatPenalty||0)>0?`<div class="eb11-penalty">−${Number(c.copycatPenalty)} copycat penalty</div>`:'');}

function eb57EntryEvidence(e){
  const rank=Number(e.entryRank||0),sec=Number(e.secondsAfterLaunch),delay=Number.isFinite(sec)&&sec>=0?(sec<120?`${Math.round(sec)}s`:sec<7200?`${Math.round(sec/60)}m`:`${(sec/3600).toFixed(1)}h`):'UNKNOWN';
  const price=e.entryPriceUsd!=null?`$${Number(e.entryPriceUsd).toPrecision(6)}`:e.entryPriceSol!=null?`${Number(e.entryPriceSol).toPrecision(6)} SOL`:'UNKNOWN';
  return {rank,delay,price,confidence:e.reconstructionConfidence||'UNKNOWN',source:e.priceSource||'UNKNOWN',anchor:e.launchAnchorSource||'UNKNOWN',signature:e.signature||null,history:e.historyComplete===true?'COMPLETE':e.historyComplete===false?'PARTIAL':'UNKNOWN'};
}
function eb11Entry(e){const x=eb57EntryEvidence(e),multi=Number(e.priceMultiple||0);return `<div class="eb11-entry eb57-entry"><button data-eb-research="${esc(e.tokenAddress||'')}"><b>$${esc(e.symbol||shortAddr(e.tokenAddress||''))}</b><small>${esc(shortAddr(e.tokenAddress||''))}</small></button><span class="eb11-rank ${x.rank<=5?'hot':''}">#${x.rank||'—'}</span><strong>${multi.toFixed(1)}x observed</strong><em>${esc(x.delay)} after anchor · ${esc(x.confidence)}</em>${x.signature?`<button class="eb11-padre-small" data-eb-tx="${esc(x.signature)}">↗</button>`:''}</div>`;}
function eb11Card(w){
  const c=eb11Class(w),watched=!!w.alreadyWatching||!!state.data?.wallets?.[w.address],copy=w.copycatBehavior||{},selected=earlyBirdUi.selected===w.address,entries=w.earlyEntries||[],hi=Number(w.reconstructionHighConfidenceRate||0);
  return `<article class="eb11-card eb57-card ${c.toLowerCase()} ${selected?'selected':''}" data-eb-select="${esc(w.address)}"><div class="eb11-card-head"><div class="eb11-wallet-id"><span class="eb11-bird">✦</span><div><b>${esc(w.shortAddress||shortAddr(w.address))}</b><small>${esc(shortAddr(w.address))} · ${watched?'Shadow/monitored':'candidate'}</small></div></div><div class="eb11-score"><strong>${Number(w.score||0)}</strong><span>/100</span></div></div><div class="eb11-class-row"><span class="eb11-class ${c.toLowerCase()}">${esc(eb11ClassLabel(c))}</span><span class="eb11-precision ${copy.playsAll?'bad':copy.playsSome?'warn':'good'}">${copy.playsAll?'Spray detected':copy.playsSome?'Mixed precision':'Contract precision acceptable'}</span></div><div class="eb57-card-metrics"><div><span>INDEPENDENT RUNS</span><b>${Number(w.consistency||0)}</b></div><div><span>AVG ENTRY</span><b>#${Number(w.avgEntryRank||0).toFixed(1)}</b></div><div><span>AVG DELAY</span><b>${w.avgSecondsAfterLaunch==null?'UNKNOWN':Number(w.avgSecondsAfterLaunch)<120?Math.round(Number(w.avgSecondsAfterLaunch))+'s':Math.round(Number(w.avgSecondsAfterLaunch)/60)+'m'}</b></div><div><span>HIGH-CONF RECON</span><b>${(hi*100).toFixed(0)}%</b></div><div><span>OBSERVED RUN</span><b>${Number(w.avgMultiple||0).toFixed(1)}x</b></div><div><span>SOURCE EVENTS</span><b>${entries.filter(e=>e.signature).length}/${entries.length}</b></div></div><div class="eb57-card-foot"><span>${watched?'ROUTED TO SHADOW / MONITORING':'SELECT TO INSPECT'}</span><b>${eb11TimeAgo(w.lastUpdated)}</b></div></article>`;
}
function eb57Selected(){return earlyBirdUi.data?.wallets?.[earlyBirdUi.selected]||null;}
function renderEb57Inspector(){
  const box=$('eb57-inspector');if(!box)return;const w=eb57Selected();
  if(!w){box.innerHTML='<div class="position-detail-empty"><span>✦</span><b>Select an Early Bird candidate</b><small>Inspect source-level entry evidence after launch reconstruction.</small></div>';return;}
  const c=eb11Class(w),entries=(w.earlyEntries||[]),copy=w.copycatBehavior||{},ai=w.aiAssessment||{},watched=!!w.alreadyWatching||!!state.data?.wallets?.[w.address];
  box.innerHTML=`<div class="eb57-inspector-head"><div><span class="eb11-class ${c.toLowerCase()}">${esc(eb11ClassLabel(c))}</span><h3>${esc(w.shortAddress||shortAddr(w.address))}</h3><code>${esc(w.address)}</code></div><div class="eb11-score"><strong>${Number(w.score||0)}</strong><span>/100</span></div></div>
  <div class="eb57-route ${watched?'shadow':'candidate'}"><span>ROUTING STATE</span><b>${watched?'SHADOW / MONITORED':'CANDIDATE ONLY'}</b><small>${watched?'Paper-testing context; not Trusted authorization.':'No live execution authority.'}</small></div>
  <div class="eb11-scorebox eb57-scorebox"><span>SCORING EVIDENCE</span>${eb11ScoreBars(w)}</div>
  <div class="eb57-facts"><div><span>INDEPENDENT TOKENS</span><b>${Number(w.consistency||0)}</b></div><div><span>AVG ENTRY RANK</span><b>#${Number(w.avgEntryRank||0).toFixed(1)}</b></div><div><span>AVG LAUNCH DELAY</span><b>${w.avgSecondsAfterLaunch==null?'UNKNOWN':Math.round(Number(w.avgSecondsAfterLaunch))+'s'}</b></div><div><span>HIGH-CONF RECON</span><b>${(Number(w.reconstructionHighConfidenceRate||0)*100).toFixed(0)}%</b></div><div><span>AVG OBSERVED RUN</span><b>${Number(w.avgMultiple||0).toFixed(2)}x</b></div><div><span>CONTRACT PRECISION</span><b>${copy.playsAll?'LOW / SPRAY':copy.playsSome?'MIXED':'PRECISE / UNKNOWN'}</b></div></div>
  <div class="eb57-section"><div class="panel-head"><div><span class="panel-kicker">SOURCE EVIDENCE · RECONSTRUCTED EARLY ENTRIES</span><h3>Actual Buyers After Launch</h3></div><span class="count-pill">${entries.length}</span></div>${entries.length?entries.map((e,i)=>{const x=eb57EntryEvidence(e);return `<div class="eb57-evidence-row"><div class="eb57-evidence-token"><span>#${i+1}</span><button data-eb-research="${esc(e.tokenAddress||'')}"><b>$${esc(e.symbol||shortAddr(e.tokenAddress||''))}</b><small>${esc(e.tokenAddress||'')}</small></button></div><div><span>ENTRY</span><b>#${x.rank||'—'} · ${esc(x.delay)}</b><small>after ${esc(x.anchor)} anchor</small></div><div><span>HISTORICAL ENTRY PRICE</span><b>${esc(x.price)}</b><small>${esc(x.source)}</small></div><div><span>RECONSTRUCTION</span><b>${esc(x.confidence)}</b><small>history ${esc(x.history)}</small></div><div><span>OBSERVED RUN</span><b>${Number(e.priceMultiple||0).toFixed(2)}x</b><small>not historical peak proof</small></div><div class="eb57-evidence-actions">${x.signature?`<button data-eb-tx="${esc(x.signature)}">TX ↗</button>`:'<span>NO SIGNATURE</span>'}<button data-eb-research="${esc(e.tokenAddress||'')}">Research</button></div></div>`;}).join(''):'<div class="intel-empty mini"><small>No retained entry evidence.</small></div>'}</div>
  <div class="eb57-section"><div class="panel-head"><div><span class="panel-kicker">SPECIALIZED AI</span><h3>Early Bird Interpretation</h3></div></div>${ai&&Object.keys(ai).length?`<div class="eb57-ai"><div><span>RECOMMENDATION</span><b>${esc(ai.recommendation||ai.decision||'UNKNOWN')}</b></div><div><span>CONFIDENCE</span><b>${ai.confidence!=null?Number(ai.confidence)+'%':'UNKNOWN'}</b></div><p>${esc(ai.reasoning||ai.summary||ai.error||'No narrative returned.')}</p><small>AI cannot prove insider knowledge, profitability, or live eligibility.</small></div>`:'<div class="intel-empty mini"><small>No AI interpretation retained.</small></div>'}</div>
  <div class="eb57-actions">${c!=='SPRAY'&&!watched&&!w.dismissed?`<button class="primary-action" data-eb-watch="${esc(w.address)}">ROUTE TO SHADOW</button>`:''}${watched?`<button class="ghost" data-eb-open-wallet="${esc(w.address)}">Open Wallet</button>`:''}<button class="ghost" data-eb-solscan="${esc(w.address)}">Wallet on Solscan ↗</button>${w.dismissed?`<button class="ghost" data-eb-restore="${esc(w.address)}">Restore</button>`:`<button class="ghost" data-eb-dismiss="${esc(w.address)}">Dismiss</button>`}</div>
  <div class="eb57-boundary"><b>SHADOW ONLY</b><span>Early Bird evidence can create/route a Ghost wallet for paper qualification. It never promotes directly to Trusted or authorizes live execution.</span></div>`;
}
function renderEb57Reconstruction(){
  const box=$('eb57-reconstruction');if(!box)return;const d=earlyBirdUi.data||{},cfg=d.config||{},rec=d.reconstruction||{},wallets=Object.values(d.wallets||{}),entries=wallets.flatMap(w=>w.earlyEntries||[]);
  const high=entries.filter(e=>e.reconstructionConfidence==='HIGH').length,signed=entries.filter(e=>e.signature).length,priced=entries.filter(e=>e.entryPriceUsd!=null||e.entryPriceSol!=null).length;
  box.innerHTML=`<div class="eb57-engine-grid"><div><span>RECONSTRUCTED TOKENS</span><b>${Number(rec.tokens||0)}</b></div><div><span>RETAINED ENTRY EVENTS</span><b>${entries.length}</b></div><div><span>HIGH CONFIDENCE</span><b>${entries.length?Math.round(high/entries.length*100):0}%</b></div><div><span>SOURCE SIGNATURES</span><b>${signed}/${entries.length}</b></div><div><span>HISTORICAL ENTRY PRICE</span><b>${priced}/${entries.length}</b></div><div><span>HISTORY CAP</span><b>${Number(cfg.maxHistorySignatures||0).toLocaleString()}</b></div></div><div class="eb57-engine-note">Minimum repeat appearances: ${Number(cfg.minAppearances||0)} · Historical peak is not fabricated when unavailable.</div>`;
}
function renderEb11RunHistory(){const q=earlyBirdUi.query.toLowerCase().trim();const runs=(earlyBirdUi.data.runs||[]).filter(r=>!q||`${r.symbol||''} ${r.tokenAddress||''}`.toLowerCase().includes(q)).sort((a,b)=>Number(b.analyzedAt||0)-Number(a.analyzedAt||0));$('eb11-count').textContent=runs.length;$('eb11-kicker').textContent='TOKEN RECONSTRUCTION LEDGER';$('eb11-title').textContent='Observed Strong-Run Evidence';$('eb11-content').innerHTML=runs.length?`<div class="eb11-runs-table eb57-runs-table"><div class="eb11-runs-head"><span>TOKEN</span><span>OBSERVED RUN</span><span>LAUNCH ANCHOR</span><span>RECON</span><span>HISTORY</span><span></span></div>${runs.map(r=>`<div class="eb11-run-row"><div><b>$${esc(r.symbol||'TOKEN')}</b><small>${esc(shortAddr(r.tokenAddress||''))}</small></div><strong>${Number(r.multiple||0).toFixed(1)}x</strong><span>${esc(r.launchAnchorSource||'UNKNOWN')}</span><span>${esc(r.reconstructionConfidence||'UNKNOWN')}</span><em>${r.historyComplete===true?'COMPLETE':r.historyComplete===false?'PARTIAL':'UNKNOWN'} · ${Number(r.historySignatures||0)} sigs</em><div><button data-eb-research="${esc(r.tokenAddress||'')}">Research</button><button data-eb-padre="${esc(r.tokenAddress||'')}">⬡ Padre</button></div></div>`).join('')}</div>`:'<div class="intel-empty"><span>✦</span><b>No run history matches</b><small>Reconstructed strong-run evidence will appear here.</small></div>';renderEb57Inspector();}
function renderEarlyBird11(){
  if(!$('eb11-content'))return;
  $('eb11-summary').innerHTML=eb11Summary().map(x=>`<div class="eb11-stat"><span>${esc(x[1])}</span><strong>${x[0]}</strong><small>${esc(x[2])}</small></div>`).join('');
  document.querySelectorAll('[data-eb-tab]').forEach(b=>b.classList.toggle('active',b.dataset.ebTab===earlyBirdUi.tab));renderEb11Progress();renderEb11RunsMini();renderEb11History();renderEb57Reconstruction();
  if(earlyBirdUi.tab==='runs'){renderEb11RunHistory();return;}
  const rows=eb11Wallets(),meta=earlyBirdUi.tab==='watched'?['SHADOW / MONITORED','Early Birds Under Paper Qualification']:earlyBirdUi.tab==='dismissed'?['DISMISSED EVIDENCE','Dismissed Early Bird Records']:['CANDIDATE EVIDENCE','Repeat Early-Entry Wallets'];
  if(earlyBirdUi.selected&&!rows.some(w=>w.address===earlyBirdUi.selected))earlyBirdUi.selected=rows[0]?.address||null;if(!earlyBirdUi.selected&&rows.length)earlyBirdUi.selected=rows[0].address;
  $('eb11-kicker').textContent=meta[0];$('eb11-title').textContent=meta[1];$('eb11-count').textContent=rows.length;
  $('eb11-content').innerHTML=rows.length?`<div class="eb11-card-list eb57-card-list">${rows.map(eb11Card).join('')}</div>`:`<div class="intel-empty"><span>✦</span><b>No records in this view</b><small>Run the reconstruction engine or change the current filter.</small></div>`;
  renderEb57Inspector();
}

async function refreshEarlyBird11(){
  try {
    earlyBirdUi.data = await window.cg.getEarlyBirdData();
    renderEarlyBird11();
    // Seed the nav badge on initial load
    const wallets = earlyBirdUi.data?.wallets || {};
    const newHighCount = Object.values(wallets).filter(w => {
      const cls = eb11Class(w);
      const watched = !!w.alreadyWatching || !!state.data?.wallets?.[w.address];
      return !w.dismissed && !watched && (cls === 'ELITE' || cls === 'STRONG');
    }).length;
    const badge = $('eb-nav-badge');
    if (badge) {
      badge.textContent   = newHighCount;
      badge.style.display = newHighCount > 0 ? 'inline-flex' : 'none';
    }
  } catch(e) {
    console.error('[EarlyBird UI]', e);
    toast('Could not load Early Bird data');
  }
}
function initEarlyBird11(){$('eb11-tabs')?.addEventListener('click',e=>{const b=e.target.closest('[data-eb-tab]');if(!b)return;earlyBirdUi.tab=b.dataset.ebTab;renderEarlyBird11();});$('eb11-search')?.addEventListener('input',e=>{earlyBirdUi.query=e.target.value;renderEarlyBird11();});$('eb11-class')?.addEventListener('change',e=>{earlyBirdUi.classification=e.target.value;renderEarlyBird11();});$('eb11-sort')?.addEventListener('change',e=>{earlyBirdUi.sort=e.target.value;renderEarlyBird11();});$('eb11-scan')?.addEventListener('click',async()=>{const r=await window.cg.earlyBirdScanNow();if(!r?.ok&&r?.reason)toast(r.reason);await refreshEarlyBird11();});$('page-earlybird')?.addEventListener('click',async e=>{let b;if((b=e.target.closest('[data-eb-select]'))&&!e.target.closest('button')){earlyBirdUi.selected=b.dataset.ebSelect;renderEarlyBird11();}else if(b=e.target.closest('[data-eb-tx]')){window.cg.openExternal(`https://solscan.io/tx/${b.dataset.ebTx}`);}else if(b=e.target.closest('[data-eb-watch]')){const r=await window.cg.earlyBirdWatch(b.dataset.ebWatch);if(r?.ok){state.data.wallets[b.dataset.ebWatch]=r.wallet;toast('Early Bird added as Pending wallet');await refreshEarlyBird11();renderWallets();renderLeaderboard();renderDashboard();}else toast(r?.reason||'Could not add candidate');}else if(b=e.target.closest('[data-eb-dismiss]')){await window.cg.earlyBirdDismiss(b.dataset.ebDismiss);await refreshEarlyBird11();toast('Candidate dismissed');}else if(b=e.target.closest('[data-eb-restore]')){await window.cg.earlyBirdRestore(b.dataset.ebRestore);await refreshEarlyBird11();toast('Candidate restored');}else if(b=e.target.closest('[data-eb-solscan]'))window.cg.openExternal(`https://solscan.io/account/${b.dataset.ebSolscan}`);else if(b=e.target.closest('[data-eb-open-wallet]')){walletUi.selected=b.dataset.ebOpenWallet;go('wallets');}else if(b=e.target.closest('[data-eb-research]')){const mint=b.dataset.ebResearch;if(mint){sessionStorage.setItem('copyguard-research-token',mint);go('research');}}else if(b=e.target.closest('[data-eb-padre]')){if(b.dataset.ebPadre)window.openInPadre(b.dataset.ebPadre);}else if(b=e.target.closest('[data-eb-token]')){const mint=b.dataset.ebToken;if(mint){sessionStorage.setItem('copyguard-research-token',mint);go('research');}}});window.cg.on('earlybird-update', payload => {
  earlyBirdUi.data = { ...earlyBirdUi.data, ...payload };
  renderEarlyBird11();

  // Update nav badge — count new HIGH/ELITE candidates not yet dismissed or watched
  const wallets = payload.wallets || earlyBirdUi.data.wallets || {};
  const newHighCount = Object.values(wallets).filter(w => {
    const cls = eb11Class(w);
    const watched = !!w.alreadyWatching || !!state.data?.wallets?.[w.address];
    return !w.dismissed && !watched && (cls === 'ELITE' || cls === 'STRONG');
  }).length;
  const badge = $('eb-nav-badge');
  if (badge) {
    badge.textContent    = newHighCount;
    badge.style.display  = newHighCount > 0 ? 'inline-flex' : 'none';
  }

  // Keep dashboard promo/risk counts accurate after a scan surfaces new candidates
  renderDashboard();
});refreshEarlyBird11();}



function risk12Class(level='LOW'){return String(level||'LOW').toLowerCase();}
function risk58DecisionClass(d='PASS'){const x=String(d||'PASS').toUpperCase();return x==='HARD_BLOCK'?'critical':x==='CAUTION'?'medium':'low';}
function risk12Summary(){const d=riskUi.data||{},dc=d.decisionCounts||{};return [['Decisions',d.assessed||0,'persistent Risk Engine v3 decisions'],['Hard Blocks',dc.HARD_BLOCK||0,'deterministic execution stops'],['Cautions',dc.CAUTION||0,'review / risk ceiling'],['Pass',dc.PASS||0,'no deterministic block']];}
function risk12ComponentRows(a){const c=a?.components||{};const labels={tokenSafety:'Token control',marketRisk:'Market / liquidity',holderRisk:'Holder ownership',creatorRisk:'Creator / deployer',manipulationRisk:'Manipulation',coordinationRisk:'Coordination',walletRisk:'Wallet quality',provenanceRisk:'Provenance',exposureRisk:'Exposure'};return Object.entries(labels).map(([k,n])=>{const v=Math.min(100,Number(c[k]||0));return `<div class="risk12-component risk58-component"><span>${n}</span><div><i style="width:${v}%"></i></div><b>${v}</b></div>`;}).join('');}
function risk58EvidenceRows(items,type){
  const a=Array.isArray(items)?items:[];if(!a.length)return `<div class="risk58-empty-evidence">${type==='unknown'?'No unresolved evidence recorded.':type==='hard'?'No deterministic hard block recorded.':'No caution recorded.'}</div>`;
  return a.map((x,i)=>{const msg=typeof x==='string'?x:x.message||x.code||'Unknown evidence';const code=typeof x==='object'?x.code||'': '';return `<div class="risk58-evidence ${type}"><span>${type==='hard'?'STOP':type==='unknown'?'?':'!'}</span><div><b>${code?esc(String(code).replaceAll('_',' ')):type==='hard'?'DETERMINISTIC BLOCK':type==='unknown'?'UNKNOWN · EVIDENCE GAP':'CAUTION'}</b><small>${esc(msg)}</small></div></div>`;}).join('');
}
function risk58FlagRows(flags=[]){return flags.length?flags.map(f=>`<div class="risk58-flag ${risk12Class(f.severity)}"><div><span>${esc(f.category||'evidence')}</span><b>${esc(String(f.code||'FLAG').replaceAll('_',' '))}</b></div><p>${esc(f.message||'')}</p><strong>${f.hard?'HARD BLOCK':f.points?`+${Number(f.points)} pts`:esc(f.severity||'INFO')}</strong></div>`).join(''):'<div class="risk58-empty-evidence">No negative flags recorded.</div>';}
function renderRiskCenter(){
  const d=riskUi.data||{},filter=riskUi.filter;$('risk12-summary').innerHTML=risk12Summary().map(x=>`<div class="risk12-stat"><span>${x[0]}</span><strong>${x[1]}</strong><small>${x[2]}</small></div>`).join('');
  if($('risk12-helius'))$('risk12-helius').textContent=d.heliusReady?'Helius owner-resolution evidence enabled':'Helius key needed for full holder ownership evidence';
  const events=(d.events||[]).filter(e=>filter==='all'||String(e.level||'').toLowerCase()===filter);$('risk-nav-badge').textContent=(d.counts?.CRITICAL||0)+(d.counts?.HIGH||0);
  $('risk12-events').innerHTML=events.length?events.map(e=>`<article class="risk12-event risk58-event ${risk12Class(e.level)}"><div class="risk12-event-score"><strong>${Number(e.score||0)}</strong><span>/100</span></div><div class="risk12-event-main"><div><b>${esc(e.tokenSymbol?`$${e.tokenSymbol}`:shortAddr(e.tokenAddress))}</b><span class="risk12-level ${risk12Class(e.level)}">${esc(e.level||'RISK')}</span><span class="risk58-decision ${risk58DecisionClass(e.decision)}">${esc(e.decision||e.recommendation||'CAUTION')}</span></div><small>${esc(e.source||'risk')} · ${esc(e.walletAddress?shortAddr(e.walletAddress):'token assessment')} · ${eb11TimeAgo(e.time)}</small><p>${esc((e.hardBlocks?.[0]||e.cautions?.[0]||e.flags?.[0]?.message||'Elevated deterministic risk assessment'))}</p><div class="risk58-event-meta"><span>${(e.hardBlocks||[]).length} blocks</span><span>${(e.cautions||[]).length} cautions</span><span>${(e.unknowns||[]).length} unknowns</span></div></div><div class="risk12-event-actions"><button data-risk-rescan="${esc(e.tokenAddress||'')}">Inspect</button><button data-risk-research="${esc(e.tokenAddress||'')}">Research</button></div></article>`).join(''):'<div class="intel-empty"><span>◈</span><b>No elevated risk events</b><small>Elevated deterministic assessments are retained here as CopyGuard evaluates trades and manual scans.</small></div>';
  const flags=d.topFlags||[];$('risk12-top-flags').innerHTML=flags.length?flags.map(f=>`<div class="risk12-flag-row"><b>${esc(String(f.code||'').replaceAll('_',' '))}</b><span>${f.count}</span></div>`).join(''):'<div class="intel-empty mini"><small>No repeated risk signals yet.</small></div>';renderRiskScanResult();
}
function renderRiskScanResult(){
  const box=$('risk12-scan-result');if(!box)return;if(riskUi.loading){box.innerHTML='<div class="position-detail-empty"><span>◈</span><b>Building deterministic evidence package…</b><small>Checking market, authorities, Token-2022 controls, holder ownership, creator history, provenance, coordination and manipulation evidence.</small></div>';return;}
  const t=riskUi.scan;if(!t){box.innerHTML='<div class="position-detail-empty"><span>◈</span><b>No token scanned</b><small>Run a scan to inspect deterministic source evidence.</small></div>';return;}
  const a=t.riskAssessment||{},flags=a.flags||[],m=t.market||{},ev=t.researchEvidence||{},owner=ev.holders?.ownerResolved||{},auth=ev.authorities||{},tp=ev.tokenProgram||{},creator=ev.creatorHoldings||{},ch=ev.creatorHistory||{},prov=t.provenance||ev.provenance||{},coord=ev.coordination||{},hard=(a.hardBlocks||[]),cautions=a.cautions||[],unknowns=a.unknowns||[],decision=a.decision||'CAUTION',blocked=decision==='HARD_BLOCK'||hard.length>0,ai=riskUi.ai?.data||riskUi.ai||null;
  const authText=auth.known===false?'UNKNOWN':auth.mintEnabled===false&&auth.freezeEnabled===false?'RENOUNCED':auth.mintEnabled||auth.freezeEnabled?'ACTIVE CONTROL':'UNKNOWN';
  box.innerHTML=`<div class="risk58-investigation-head"><div><span class="panel-kicker">DETERMINISTIC FORENSIC RESULT</span><h2>${esc(t.tokenSymbol?`$${t.tokenSymbol}`:shortAddr(t.tokenAddress))}</h2><code>${esc(t.tokenAddress)}</code></div><div class="risk12-bigscore ${risk12Class(a.level)}"><strong>${Number(a.score||0)}</strong><span>${esc(a.level||'UNKNOWN')}</span></div></div>
  <div class="risk58-verdict ${risk58DecisionClass(decision)}"><div><span>AUTHORITATIVE DECISION</span><strong>${esc(decision)}</strong><small>${blocked?'Execution preparation is blocked by deterministic evidence.':decision==='CAUTION'?'Human review required; AI cannot upgrade this decision.':'No deterministic blocker detected by the current evidence package.'}</small></div><div><span>EVIDENCE CONFIDENCE</span><b>${Number(a.confidence||0)}%</b><small>${unknowns.length} unresolved field${unknowns.length===1?'':'s'}</small></div></div>
  <div class="risk58-source-facts"><div><span>LIQUIDITY</span><b>${m.liquidity?'$'+Math.round(m.liquidity).toLocaleString():'UNKNOWN'}</b></div><div><span>FDV</span><b>${m.fdv?'$'+Math.round(m.fdv).toLocaleString():'UNKNOWN'}</b></div><div><span>AUTHORITIES</span><b>${esc(authText)}</b></div><div><span>TOP OWNER</span><b>${owner.available?Number(owner.topOwnerPct||0).toFixed(1)+'%':'UNKNOWN'}</b></div><div><span>TOP 10 OWNERS</span><b>${owner.available?Number(owner.top10OwnerPct||0).toFixed(1)+'%':'UNKNOWN'}</b></div><div><span>CREATOR HOLDING</span><b>${creator.available?Number(creator.pct||0).toFixed(1)+'%':'UNKNOWN'}</b></div><div><span>RELATED LAUNCHES</span><b>${ch.relatedLaunchCount!=null?Number(ch.relatedLaunchCount):'UNKNOWN'}</b></div><div><span>SAME-TICKER ALTS</span><b>${prov.available?Number(prov.exactCopycats||0):'UNKNOWN'}</b></div><div><span>CLUSTER WALLETS</span><b>${Number(a.clusterEvidence?.walletCount||0)}</b></div><div><span>TOKEN-2022 RESTRICTIONS</span><b>${(tp.restrictions||[]).length}</b></div></div>
  <div class="risk58-columns"><section><div class="panel-head"><div><span class="panel-kicker">HARD SAFETY GATES</span><h3>Non-Overridable Blocks</h3></div><span class="count-pill">${hard.length}</span></div>${risk58EvidenceRows(hard,'hard')}</section><section><div class="panel-head"><div><span class="panel-kicker">REVIEW CEILING</span><h3>Cautions</h3></div><span class="count-pill">${cautions.length}</span></div>${risk58EvidenceRows(cautions,'caution')}</section><section><div class="panel-head"><div><span class="panel-kicker">EVIDENCE GAPS</span><h3>Unknowns</h3></div><span class="count-pill">${unknowns.length}</span></div>${risk58EvidenceRows(unknowns,'unknown')}</section></div>
  <div class="risk58-detail-grid"><section><div class="panel-head"><div><span class="panel-kicker">WEIGHTED FORENSICS</span><h3>Component Pressure</h3></div></div><div class="risk12-components">${risk12ComponentRows(a)}</div></section><section><div class="panel-head"><div><span class="panel-kicker">DETERMINISTIC FLAGS</span><h3>Evidence Trace</h3></div><span class="count-pill">${flags.length}</span></div><div class="risk58-flags">${risk58FlagRows(flags.filter(f=>f.severity!=='UNKNOWN'))}</div></section></div>
  <section class="risk58-ai-section"><div class="panel-head"><div><span class="panel-kicker">SPECIALIZED AI · SUBORDINATE</span><h3>Risk Investigation Explanation</h3></div>${riskUi.aiLoading?'<span class="status-chip49 warning">ANALYZING</span>':`<button class="ghost" data-risk-ai="${esc(t.tokenAddress)}">Explain with AI</button>`}</div>${ai?`<div class="risk58-ai"><div><span>AI RECOMMENDATION</span><b>${esc(ai.recommendation||ai.decision||'UNKNOWN')}</b></div><div><span>CONFIDENCE</span><b>${ai.confidence!=null?Number(ai.confidence)+'%':'UNKNOWN'}</b></div><p>${esc(ai.reasoning||ai.summary||ai.error||'No explanation returned.')}</p><small>AI explanation cannot clear, reduce, or override deterministic HARD_BLOCK / CAUTION state.</small></div>`:'<div class="risk58-ai-empty">Optional AI explanation uses the same bounded evidence package. Deterministic Risk Engine v3 remains final authority.</div>'}</section>
  <div class="risk58-actions"><button class="ghost" data-risk-research="${esc(t.tokenAddress)}">Open Research Evidence</button>${blocked?'<button class="risk58-disabled" disabled>⬡ PADRE BLOCKED BY RISK</button>':`<button class="primary-action" data-risk-padre="${esc(t.tokenAddress)}">⬡ Open Padre Review</button>`}</div>
  <div class="risk58-execution-boundary ${blocked?'blocked':''}"><b>${blocked?'HARD BLOCK ENFORCED':'SAFETY BOUNDARY ACTIVE'}</b><span>${blocked?'This contract cannot be handed off from Risk Center to Padre while deterministic hard-block evidence is present.':'Opening Padre is review/preparation context only; it does not submit a trade and does not bypass Phase 32 execution safety.'}</span></div>`;
}

async function refreshRiskCenter(){try{riskUi.data=await window.cg.getRiskCenterData();renderRiskCenter();}catch(e){console.error('[Risk Center]',e);toast('Could not load risk center');}}
function initRiskCenter(){$('risk12-filter')?.addEventListener('change',e=>{riskUi.filter=e.target.value;renderRiskCenter();});$('risk12-form')?.addEventListener('submit',async e=>{e.preventDefault();const mint=$('risk12-mint').value.trim();if(!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(mint)){toast('Enter a valid Solana mint address');return;}riskUi.loading=true;riskUi.ai=null;riskUi.aiLoading=false;renderRiskScanResult();try{riskUi.scan=await window.cg.riskScanToken(mint);toast(`Risk scan complete · ${riskUi.scan?.riskAssessment?.decision||'UNKNOWN'} · ${riskUi.scan?.riskAssessment?.score||0}/100`);}catch(err){toast('Risk scan failed');console.error(err);}riskUi.loading=false;await refreshRiskCenter();renderRiskScanResult();});$('risk12-clear')?.addEventListener('click',async()=>{await window.cg.riskClearEvents();await refreshRiskCenter();toast('Risk event ledger cleared');});$('page-risk')?.addEventListener('click',async e=>{const r=e.target.closest('[data-risk-research]'),p=e.target.closest('[data-risk-padre]'),s=e.target.closest('[data-risk-rescan]'),ai=e.target.closest('[data-risk-ai]');if(r?.dataset.riskResearch){sessionStorage.setItem('copyguard-research-token',r.dataset.riskResearch);go('research');}else if(s?.dataset.riskRescan){$('risk12-mint').value=s.dataset.riskRescan;riskUi.loading=true;riskUi.ai=null;renderRiskScanResult();try{riskUi.scan=await window.cg.riskScanToken(s.dataset.riskRescan);}finally{riskUi.loading=false;renderRiskScanResult();}}else if(ai?.dataset.riskAi){riskUi.aiLoading=true;renderRiskScanResult();try{riskUi.ai=await window.cg.aiRiskExplain(ai.dataset.riskAi);}catch(err){riskUi.ai={error:err.message};}riskUi.aiLoading=false;renderRiskScanResult();}else if(p?.dataset.riskPadre){if(riskUi.scan?.riskAssessment?.decision==='HARD_BLOCK'||riskUi.scan?.riskAssessment?.hardBlocks?.length){toast('Padre handoff blocked by deterministic risk');return;}await window.openInPadre(p.dataset.riskPadre);}});window.cg.on('risk-event',()=>refreshRiskCenter());refreshRiskCenter();}

function notify13Age(ts){const d=Date.now()-Number(ts||0),m=Math.floor(d/60000);if(m<1)return'now';if(m<60)return`${m}m ago`;const h=Math.floor(m/60);return h<24?`${h}h ago`:`${Math.floor(h/24)}d ago`;}
function events59Type(e){const t=String(e.type||'system').toLowerCase();if(t==='position'||t==='trade')return'execution';if(t==='health')return'shadow';return t;}
function notify13FilterEvents(){let a=[...(notifyUi.data.events||[])];if(notifyUi.filter==='unread')a=a.filter(x=>!x.read);else if(notifyUi.filter!=='all')a=a.filter(x=>events59Type(x)===notifyUi.filter);if(notifyUi.severity!=='all')a=a.filter(x=>String(x.severity||'INFO').toUpperCase()===notifyUi.severity);const q=notifyUi.query.trim().toLowerCase();return q?a.filter(x=>`${x.id} ${x.title} ${x.message} ${x.source} ${x.walletAddress||''} ${x.tokenAddress||''} ${x.signature||''} ${x.attemptId||''} ${x.status||''}`.toLowerCase().includes(q)):a;}
function events59Meaning(e){return({PREPARED:'Prepared only — no submission and no accounting commitment.',RESERVED:'Execution attempt reserved; settlement is not established.',SUBMITTED_UNVERIFIED:'Submission evidence exists; settlement remains unverified.',FAILED:'Execution failed; no successful settlement is assumed.',BLOCKED:'Deterministic safety prevented execution.',UNCERTAIN_AFTER_PAUSE:'Pause/submission race requires authoritative external verification.',RECOVERED:'Recovered/backfilled observation is not fresh live signal evidence.',HARD_BLOCK:'Deterministic risk hard block is authoritative.',CAUTION:'Deterministic caution requires review.'})[String(e.status||'').toUpperCase()]||'Operational evidence record only — not proof of settlement or verified realized performance.';}
function events59Inspector(){const b=$('events59-inspector'),e=(notifyUi.data.events||[]).find(x=>x.id===notifyUi.selected);if(!b)return;if(!e){b.innerHTML='<div class="position-detail-empty"><span>◎</span><b>Select an event</b><small>Inspect source-level operational evidence.</small></div>';return;}const meta=e.metadata&&typeof e.metadata==='object'?e.metadata:{},rows=Object.entries(meta).filter(([,v])=>v!=null&&typeof v!=='object').slice(0,14);b.innerHTML=`<div class="events59-inspector-head"><div><span class="notify13-chip ${String(e.severity||'info').toLowerCase()}">${esc(e.severity||'INFO')}</span><span class="notify13-chip">${esc(events59Type(e))}</span><h3>${esc(e.title)}</h3><small>${new Date(Number(e.time||0)).toLocaleString()} · ${esc(e.source||'CopyGuard')}</small></div><b>${esc(e.status||'RECORDED')}</b></div><p class="events59-message">${esc(e.message||'')}</p><div class="events59-identifiers">${[['EVENT ID',e.id],['WALLET',e.walletAddress],['TOKEN',e.tokenAddress],['SIGNATURE',e.signature],['ATTEMPT ID',e.attemptId],['STATUS',e.status||'RECORDED']].map(x=>`<div><span>${x[0]}</span><code>${esc(x[1]||'—')}</code></div>`).join('')}</div><div class="events59-semantics"><b>STATUS SEMANTICS</b><p>${esc(events59Meaning(e))}</p></div>${rows.length?`<section class="events59-meta">${rows.map(([k,v])=>`<div><span>${esc(k.replace(/([A-Z])/g,' $1').toUpperCase())}</span><b>${esc(String(v))}</b></div>`).join('')}</section>`:''}<div class="events59-actions">${e.signature?`<button class="ghost" data-event59-solscan="${esc(e.signature)}">Solscan TX ↗</button>`:''}${e.tokenAddress?`<button class="ghost" data-notify-action="research" data-token="${esc(e.tokenAddress)}">Research</button><button class="ghost" data-event59-risk="${esc(e.tokenAddress)}">Risk Center</button>`:''}${e.walletAddress?`<button class="ghost" data-event59-wallet="${esc(e.walletAddress)}">Wallets</button>`:''}</div><div class="events59-boundary"><b>EVIDENCE ONLY</b><span>This inspector cannot submit trades, promote wallets, override deterministic risk, change execution state, or create verified realized P&amp;L.</span></div>`;}
function events59Health(){const b=$('events59-health');if(!b)return;const d=notifyUi.data||{},h=d.connectionHealth||{},o=d.observation||{},i=d.integrity||{};b.innerHTML=`<div><span>SYSTEM MODE</span><b>${esc(h.mode||'UNKNOWN')}</b><small>${esc(h.reason||'No health evidence')}</small></div><div><span>OBSERVATION</span><b>${esc(o.websocketMode||'UNKNOWN')}</b><small>${Number(o.staleWallets||0)} stale streams</small></div><div><span>INTEGRITY</span><b>${esc(i.status||'UNKNOWN')}</b><small>${Number(i.issues||0)} issues</small></div><div><span>EVIDENCE EVENTS</span><b>${(d.events||[]).length}</b><small>unified read-only timeline</small></div>`;}
function renderNotifications13(){const d=notifyUi.data||{events:[]},ev=notify13FilterEvents(),all=d.events||[],unread=Number(d.unread||all.filter(x=>!x.read).length),crit=all.filter(x=>['HIGH','CRITICAL'].includes(x.severity)).length;$('notify13-summary').innerHTML=[['UNREAD',unread,'notification review'],['HIGH / CRITICAL',crit,'priority evidence'],['EXECUTION',all.filter(x=>events59Type(x)==='execution').length,'Phase 32 states'],['INTEGRITY',all.filter(x=>events59Type(x)==='integrity').length,'audit / recovery']].map(x=>`<article class="notify13-stat"><span>${x[0]}</span><strong>${x[1]}</strong><small>${x[2]}</small></article>`).join('');$('notify13-count').textContent=ev.length;const badge=$('notification-badge');if(badge){badge.textContent=unread;badge.style.display=unread?'grid':'none';}$('notify13-delivery').innerHTML='<div class="notify13-delivery-row"><div><b>Unified Evidence View</b><small>Read-only aggregation across operational ledgers.</small></div><strong>ON</strong></div><div class="notify13-delivery-row"><div><b>Phase 13 Ledger</b><small>Original notifications remain persistent.</small></div><strong>ON</strong></div>';$('notify13-events').innerHTML=ev.length?ev.map(e=>`<article class="notify13-event events59-event ${e.read?'':'unread'} ${notifyUi.selected===e.id?'selected':''}" data-notify-id="${esc(e.id)}"><i class="notify13-dot ${String(e.severity||'info').toLowerCase()}"></i><div class="notify13-maintext"><div><b>${esc(e.title)}</b><span class="notify13-chip ${String(e.severity||'info').toLowerCase()}">${esc(e.severity)}</span><span class="notify13-chip">${esc(events59Type(e))}</span>${e.status?`<span class="events59-status">${esc(e.status)}</span>`:''}</div><small>${esc(e.source||'CopyGuard')} · ${notify13Age(e.time)}${e.signature?' · tx '+esc(shortAddr(e.signature)):''}</small><p>${esc(e.message||'')}</p></div><div class="notify13-event-actions">${e.tokenAddress?`<button data-notify-action="research" data-token="${esc(e.tokenAddress)}">Research</button>`:''}${!e.read&&String(e.id).startsWith('evt-')?'<button data-notify-action="read">Read</button>':''}${!e.acknowledged&&String(e.id).startsWith('evt-')?'<button data-notify-action="ack">Ack</button>':''}</div></article>`).join(''):'<div class="intel-empty"><span>◎</span><b>No matching evidence</b><small>Change source, severity or search filters.</small></div>';events59Health();events59Inspector();}
async function refreshNotifications13(){try{notifyUi.data=window.cg.getSystemEvidenceEvents?await window.cg.getSystemEvidenceEvents(1200):await window.cg.getNotificationEvents();renderNotifications13();}catch(e){console.error('[Events59]',e);}}
function initNotifications13(){$('notify13-filters')?.addEventListener('click',e=>{const b=e.target.closest('[data-notify-filter]');if(!b)return;notifyUi.filter=b.dataset.notifyFilter;document.querySelectorAll('[data-notify-filter]').forEach(x=>x.classList.toggle('active',x===b));renderNotifications13();});$('events59-severity')?.addEventListener('change',e=>{notifyUi.severity=e.target.value;renderNotifications13();});$('notify13-search')?.addEventListener('input',e=>{notifyUi.query=e.target.value;renderNotifications13();});$('notify13-read-all')?.addEventListener('click',async()=>{await window.cg.notificationMarkAllRead();await refreshNotifications13();});$('notify13-clear')?.addEventListener('click',async()=>{await window.cg.notificationClearAcknowledged();await refreshNotifications13();});$('page-notifications')?.addEventListener('click',async e=>{const row=e.target.closest('[data-notify-id]'),a=e.target.closest('[data-notify-action]'),sol=e.target.closest('[data-event59-solscan]'),risk=e.target.closest('[data-event59-risk]'),wallet=e.target.closest('[data-event59-wallet]');if(sol){window.cg.openExternal(`https://solscan.io/tx/${sol.dataset.event59Solscan}`);return;}if(risk){$('risk12-mint')&&($('risk12-mint').value=risk.dataset.event59Risk);go('risk');return;}if(wallet){go('wallets');return;}if(a&&row){if(a.dataset.notifyAction==='read')await window.cg.notificationMarkRead(row.dataset.notifyId);if(a.dataset.notifyAction==='ack')await window.cg.notificationAck(row.dataset.notifyId);if(a.dataset.notifyAction==='research'){sessionStorage.setItem('copyguard-research-token',a.dataset.token);go('research');return;}await refreshNotifications13();return;}if(row){notifyUi.selected=row.dataset.notifyId;renderNotifications13();}});window.cg.on('notification-event',()=>refreshNotifications13());window.cg.on('connection-health',()=>refreshNotifications13());refreshNotifications13();}

function settings14SecretRow(kind,provider,label,status){const cfg=status?.configured,masked=status?.masked||'';const id=`s14-${kind}-${provider||'key'}`;return `<div class="settings14-field"><div class="field-copy"><b>${esc(label)}</b><small class="settings14-secret-state ${cfg?'':'off'}">${cfg?`Saved ${esc(masked)}`:'Not configured'}</small></div><div class="settings14-secret"><input id="${id}" type="password" autocomplete="new-password" placeholder="${cfg?'Leave blank to keep saved key':'Paste API key'}"></div><div><button class="settings14-mini-btn" data-test-kind="${kind}" ${provider?`data-test-provider="${provider}"`:''}>Test</button>${cfg?` <button class="settings14-mini-btn danger" data-clear-kind="${kind}" ${provider?`data-clear-provider="${provider}"`:''}>Clear</button>`:''}</div></div>`;}
function renderSettings62Health(){const d=settings14Ui.data||{},h=d.connectionHealth||{},sec=d.secretStatus||{},ig=d.integrity||{},ex=d.executionSafety||{},el=$('settings62-health');if(!el)return;const services=h.services||{};const cell=(label,value,tone='')=>`<div><span>${label}</span><b class="${tone}">${esc(String(value??'UNKNOWN'))}</b></div>`;el.innerHTML=cell('SYSTEM MODE',h.mode,h.mode==='FULL'?'good':'warn')+cell('SECRET STORAGE',sec.encrypted?'OS ENCRYPTED':'REVIEW',sec.encrypted?'good':'warn')+cell('HELIUS',services.helius?.state||'UNKNOWN',services.helius?.state==='ONLINE'?'good':'warn')+cell('MARKET',services.dexscreener?.state||'UNKNOWN',services.dexscreener?.state==='ONLINE'?'good':'warn')+cell('PADRE',services.padre?.state||'UNKNOWN',services.padre?.state==='ONLINE'?'good':'warn')+cell('INTEGRITY',ig.lastStatus||'UNKNOWN',ig.lastStatus==='PASS'?'good':'warn')+cell('EXEC ATTEMPTS',(ex.attempts||[]).length);}

function renderSettings14(){const d=settings14Ui.data;if(!d)return;const c=$('settings14-content'),s=d.settings||{},sec=d.secretStatus||{};const st=$('settings14-security-state'),sub=$('settings14-security-sub');if(st){st.textContent=sec.encrypted?'OS ENCRYPTION ACTIVE':'LOCAL FILE PROTECTION';st.classList.toggle('warn',!sec.encrypted);}if(sub)sub.textContent=sec.encrypted?'API secrets are encrypted with Electron safeStorage.':'OS secure encryption is unavailable; secret file permissions are restricted.';if(settings14Ui.tab==='connections'){c.innerHTML=`<div class="settings14-grid"><article class="settings14-card full"><div class="settings14-card-title"><div><span>NETWORK CONNECTIONS</span><h3>Data + AI Providers</h3></div><small>Saved keys are never shown again in full.</small></div>${settings14SecretRow('helius','', 'Helius API',sec.helius)}${settings14SecretRow('ai','anthropic','Claude / Anthropic',sec.ai?.anthropic)}${settings14SecretRow('ai','openai','OpenAI',sec.ai?.openai)}${settings14SecretRow('ai','gemini','Gemini',sec.ai?.gemini)}${settings14SecretRow('ai','xai','Grok / xAI',sec.ai?.xai)}${settings14SecretRow('ai','perplexity','Perplexity',sec.ai?.perplexity)}<div class="settings14-field"><div class="field-copy"><b>Active AI Provider</b><small>Used for trade second-opinion analysis.</small></div><select id="s14-ai-provider"><option value="anthropic">Claude</option><option value="openai">OpenAI</option><option value="gemini">Gemini</option><option value="xai">Grok</option><option value="perplexity">Perplexity</option></select><span></span></div><div class="settings14-actions"><button class="settings14-action primary" id="s14-save-connections">Save Connections</button></div></article><article class="settings14-card full"><div class="settings14-card-title"><div><span>PHASE 31 · CONNECTION HEALTH</span><h3>Degraded Mode Controller</h3></div><small>15-second service health evaluation</small></div>${(()=>{const h=d.connectionHealth||{},sv=h.services||{};const cell=(name,x={})=>`<div><span>${name}</span><b>${esc(String(x.state||'UNKNOWN'))}</b></div>`;return `<div class="settings14-data-stats">${cell('MODE',{state:h.mode})}${cell('HELIUS',sv.helius)}${cell('MARKET',sv.dexscreener)}${cell('PADRE',sv.padre)}${cell('AI',sv.ai)}<div><span>OBS LAG</span><b>${h.observationLagMs==null?'—':Math.round(h.observationLagMs/1000)+'s'}</b></div></div><div class="settings14-note"><b>${h.executionAllowed?'Execution services healthy.':'Live execution blocked.'}</b> ${esc(h.reason||'Health baseline building')}. AI is advisory and may be unavailable without disabling deterministic observation/risk logic.</div>`;})()}<div class="settings14-actions"><button class="settings14-action" id="s31-health-now">Check All Services Now</button></div></article><article class="settings14-card full"><div class="settings14-card-title"><div><span>PHASE 18 · HELIUS OBSERVATION</span><h3>Transaction Observation Health</h3></div><small>WebSocket + 20-second recovery poll</small></div>${(()=>{const o=d.observation||{};return `<div class="settings14-data-stats"><div><span>WATCHED</span><b>${o.watchedWallets||0}</b></div><div><span>INITIALIZED</span><b>${o.initializedWallets||0}</b></div><div><span>WS MODE</span><b>${esc(String(o.websocketMode||'off').toUpperCase())}</b></div><div><span>OBSERVED TX</span><b>${o.totalObservedTransactions||0}</b></div><div><span>TRADES</span><b>${o.totalObservedTrades||0}</b></div><div><span>STALE</span><b>${o.staleWallets||0}</b></div></div><div class="settings14-note"><b>Recovery guarantee:</b> every non-blacklisted wallet is re-read through Helius every 20 seconds. Signatures are persisted across restarts and missed pages are replayed oldest-to-newest.</div>`;})()}<div class="settings14-actions"><button class="settings14-action" id="s18-poll-now">Poll All Wallets Now</button></div></article></div>`;$('s14-ai-provider').value=s.aiProvider||'anthropic';}
else if(settings14Ui.tab==='risk'){c.innerHTML=`<div class="settings14-grid"><article class="settings14-card"><div class="settings14-card-title"><div><span>GLOBAL AUTOMATION</span><h3>Execution Defaults</h3></div></div><div class="settings14-field"><div class="field-copy"><b>Global Auto Execute</b><small>Master permission. Per-wallet profiles still required.</small></div><input id="s14-auto" type="checkbox" ${s.autoExecute?'checked':''}><span></span></div><div class="settings14-field"><div class="field-copy"><b>Max Global Size</b><small>Absolute SOL cap per automated trade.</small></div><input id="s14-maxsol" type="number" min="0.01" step="0.01" value="${Number(s.maxSolGlobal||2)}"><span>SOL</span></div><div class="settings14-field"><div class="field-copy"><b>Max Automation Risk</b><small>Trades above this 0–100 risk score are blocked.</small></div><input id="s14-maxrisk" type="number" min="0" max="100" value="${Number(s.maxAutomationRiskScore??45)}"><span>/100</span></div></article><article class="settings14-card"><div class="settings14-card-title"><div><span>WALLET GOVERNANCE</span><h3>Promotion + Health</h3></div></div><div class="settings14-field"><div class="field-copy"><b>Promotion Min Trades</b><small>Minimum observed sample before basic eligibility.</small></div><input id="s14-promotrades" type="number" min="1" value="${Number(s.promoMinTrades||5)}"><span>trades</span></div><div class="settings14-field"><div class="field-copy"><b>Promotion Min Win Rate</b><small>Basic promotion heuristic only; never auto-trusts.</small></div><input id="s14-promowr" type="number" min="0" max="100" value="${Number(s.promoMinWinrate||60)}"><span>%</span></div><div class="settings14-field"><div class="field-copy"><b>Auto Demote on Critical Health</b><small>Removes Trusted status when critical health logic fires.</small></div><input id="s14-demote" type="checkbox" ${s.autoDemote?'checked':''}><span></span></div></article><article class="settings14-card full"><div class="settings14-note"><b>Hard blocks remain mandatory.</b> These defaults can make automation stricter, but they cannot disable Phase 12 deterministic hard blocks such as active freeze/mint authority or severe manipulation signals.</div><div class="settings14-actions"><button class="settings14-action primary" id="s14-save-risk">Save Risk Defaults</button></div></article>${(()=>{const x=d.executionSafety||{},st=x.stats||{},lim=x.limits||{},rows=x.attempts||[];return `<article class="settings14-card full"><div class="settings14-card-title"><div><span>PHASE 32 · EXECUTION SAFETY</span><h3>One-Shot Live Execution Ledger</h3></div><small>FAIL CLOSED</small></div><div class="settings14-data-stats"><div><span>RESERVED</span><b>${st.reserved||0}</b></div><div><span>SUBMITTED</span><b>${st.submitted||0}</b></div><div><span>FAILED</span><b>${st.failed||0}</b></div><div><span>BLOCKED</span><b>${st.blocked||0}</b></div><div><span>MAX SIGNAL AGE</span><b>${Math.round(Number(lim.liveSignalMaxAgeMs||0)/1000)}s</b></div><div><span>MAX OBS LAG</span><b>${Math.round(Number(lim.maxObservationLatencyMs||0)/1000)}s</b></div></div><div class="settings14-note"><b>Prepared ≠ submitted ≠ chain-confirmed.</b> Manual COPY never writes live P&amp;L. Trusted automation reserves each source transaction exactly once, blocks stale/recovered signals, and records Padre DOM submission as <b>SUBMITTED_UNVERIFIED</b> rather than pretending blockchain settlement is proven.</div>${rows.slice(0,5).map(a=>`<div class="settings14-note"><b>${esc(a.status||'UNKNOWN')}</b> · ${esc(a.action||'')} ${esc(shortAddr(a.tokenAddress||''))} · ${esc(a.code||a.failureReason||a.reason||'source-event audit')}</div>`).join('')}</article>`;})()}</div>`;}
else if(settings14Ui.tab==='notifications'){const q=s.quietHours||{};c.innerHTML=`<div class="settings14-grid"><article class="settings14-card full"><div class="settings14-card-title"><div><span>DELIVERY</span><h3>Notification Preferences</h3></div></div><div class="settings14-field"><div class="field-copy"><b>Desktop Notifications</b><small>OS alerts for high-priority CopyGuard events.</small></div><input id="s14-notifications" type="checkbox" ${s.notifications?'checked':''}><span></span></div><div class="settings14-field"><div class="field-copy"><b>Sound Alerts</b><small>Reserved for supported system notification sounds.</small></div><input id="s14-sounds" type="checkbox" ${s.soundAlerts?'checked':''}><span></span></div><div class="settings14-field"><div class="field-copy"><b>Quiet Hours</b><small>Suppress desktop popups while keeping the event ledger active.</small></div><input id="s14-quiet" type="checkbox" ${q.enabled?'checked':''}><span></span></div><div class="settings14-field"><div class="field-copy"><b>Quiet Start</b></div><input id="s14-qstart" type="number" min="0" max="23" value="${Number(q.startHour??0)}"><span>hour</span></div><div class="settings14-field"><div class="field-copy"><b>Quiet End</b></div><input id="s14-qend" type="number" min="0" max="23" value="${Number(q.endHour??6)}"><span>hour</span></div><div class="settings14-actions"><button class="settings14-action primary" id="s14-save-notifications">Save Notification Settings</button></div></article></div>`;}
else{const n=d.counts||{},ig=d.integrity||{},issues=Array.isArray(ig.issues)?ig.issues:[];c.innerHTML=`<div class="settings14-grid"><article class="settings14-card"><div class="settings14-card-title"><div><span>BACKUP · SHA-256 CHECKSUM VERIFIED</span><h3>Backup & Restore</h3></div></div><div class="settings14-note">Backups include CopyGuard operational data and non-secret preferences. <b>API keys are intentionally excluded.</b> Phase 30 backups carry SHA-256 checksums and are staged before restore, so a damaged backup is rejected before live data is replaced.</div><div class="settings14-actions"><button class="settings14-action primary" id="s14-backup">Export Backup</button><button class="settings14-action" id="s14-restore">Restore Backup</button><button class="settings14-action" id="s14-export">Export Data</button></div></article><article class="settings14-card"><div class="settings14-card-title"><div><span>LOCAL STORAGE</span><h3>CopyGuard Data</h3></div><small>v${esc(d.appVersion||'')}</small></div><div class="settings14-data-stats"><div><span>WALLETS</span><b>${n.wallets||0}</b></div><div><span>TRADE HISTORY</span><b>${n.history||0}</b></div><div><span>OPEN POSITIONS</span><b>${n.openPositions||0}</b></div><div><span>CLOSED POSITIONS</span><b>${n.closedPositions||0}</b></div><div><span>RISK EVENTS</span><b>${n.riskEvents||0}</b></div><div><span>EVENTS</span><b>${n.notifications||0}</b></div></div><div class="settings14-actions"><button class="settings14-action" id="s14-folder">Open Data Folder</button><button class="settings14-action" id="s14-walkthrough">📖 Show Walkthrough</button></div></article><article class="settings14-card full"><div class="settings14-card-title"><div><span>PHASE 30 · DATA INTEGRITY</span><h3>Integrity & Recovery Engine</h3></div><small>${esc(String(ig.lastStatus||'UNKNOWN'))}</small></div><div class="settings14-data-stats"><div><span>STATUS</span><b>${esc(String(ig.lastStatus||'UNKNOWN'))}</b></div><div><span>ISSUES</span><b>${issues.length}</b></div><div><span>ERRORS</span><b>${issues.filter(x=>x.severity==='ERROR').length}</b></div><div><span>SAFE REPAIRS</span><b>${Array.isArray(ig.repairs)?ig.repairs.length:0}</b></div></div><div class="settings14-note"><b>No fabricated recovery:</b> damaged source links are quarantined from verified learning; only rebuildable indexes are repaired automatically. Corrupt JSON is quarantined and recovered from a last-known-good copy when available.</div>${issues.slice(0,5).map(x=>`<div class="settings14-note"><b>${esc(x.code)}</b> · ${esc(x.severity)} · ${esc(x.message)}</div>`).join('')}<div class="settings14-actions"><button class="settings14-action primary" id="s30-integrity-run">Run Integrity Audit</button></div></article><article class="settings14-card full settings14-danger"><div class="settings14-card-title"><div><span>RECOVERY / RESET</span><h3>Destructive Data Controls</h3></div></div><div class="settings14-note">Use scoped resets when possible. <b>Reset Everything</b> clears wallets, history, positions, intelligence, settings and stored API credentials. It requires typing <b>RESET EVERYTHING</b> exactly before the backend will accept the destructive request.</div><div class="settings14-actions"><button class="settings14-action warn" data-reset-scope="activity">Reset Activity</button><button class="settings14-action warn" data-reset-scope="intelligence">Reset Intelligence</button><button class="settings14-action warn" data-reset-scope="preferences">Reset Preferences</button><button class="settings14-action danger" data-reset-scope="all">Reset Everything</button></div></article></div>`;}}
async function refreshSettings14(){try{settings14Ui.data=await window.cg.getSettingsCenterData();renderSettings14();}catch(e){console.error('[Settings14]',e);toast('Could not load settings center');}}
async function settings14Save(payload,msg){const r=await window.cg.saveSettingsSecure(payload);if(!r?.ok){toast(r?.error||'Settings save failed');return;}if(state.data){state.data.settings=r.settings;state.data.secretStatus=r.secretStatus;}await refreshSettings14();renderDashboard();toast(msg||'Settings saved');}
function initSettings14(){$('settings14-tabs')?.addEventListener('click',e=>{const b=e.target.closest('[data-settings-tab]');if(!b)return;settings14Ui.tab=b.dataset.settingsTab;document.querySelectorAll('[data-settings-tab]').forEach(x=>x.classList.toggle('active',x===b));renderSettings14();});$('settings14-content')?.addEventListener('click',async e=>{const test=e.target.closest('[data-test-kind]');if(test){test.disabled=true;const r=await window.cg.testConnection(test.dataset.testKind,test.dataset.testProvider||null);test.disabled=false;toast(r?.message||'Connection test finished');return;}const clear=e.target.closest('[data-clear-kind]');if(clear){if(!confirm('Clear this saved API credential?'))return;await window.cg.clearSecret(clear.dataset.clearKind,clear.dataset.clearProvider||null);await refreshSettings14();toast('Credential cleared');return;}if(e.target.id==='s31-health-now'){e.target.disabled=true;try{const h=await window.cg.checkConnectionHealth();if(settings14Ui.data)settings14Ui.data.connectionHealth=h;renderSettings14();toast(`Connection mode · ${h?.mode||'UNKNOWN'}`);}catch(err){toast('Connection health check failed');}return;}if(e.target.id==='s18-poll-now'){e.target.disabled=true;try{const o=await window.cg.pollObservationNow();if(settings14Ui.data)settings14Ui.data.observation=o;renderSettings14();toast(`Helius observation poll complete · ${o?.totalObservedTransactions||0} observed transactions`);}catch(err){toast('Observation poll failed');}return;}if(e.target.id==='s14-save-connections'){const apiKeys={};for(const p of ['anthropic','openai','gemini','xai','perplexity']){const v=$(`s14-ai-${p}`)?.value.trim();apiKeys[p]=v||'__KEEP__';}await settings14Save({preferences:{aiProvider:$('s14-ai-provider').value},secrets:{heliusApiKey:$('s14-helius-key')?.value.trim()||'__KEEP__',apiKeys}},'Connections saved securely');return;}if(e.target.id==='s14-save-risk'){await settings14Save({preferences:{autoExecute:$('s14-auto').checked,maxSolGlobal:Number($('s14-maxsol').value||2),maxAutomationRiskScore:Number($('s14-maxrisk').value||45),promoMinTrades:Number($('s14-promotrades').value||5),promoMinWinrate:Number($('s14-promowr').value||60),autoDemote:$('s14-demote').checked}},'Risk defaults saved');return;}if(e.target.id==='s14-save-notifications'){await settings14Save({preferences:{notifications:$('s14-notifications').checked,soundAlerts:$('s14-sounds').checked,quietHours:{enabled:$('s14-quiet').checked,startHour:Number($('s14-qstart').value||0),endHour:Number($('s14-qend').value||6)}}},'Notification settings saved');return;}if(e.target.id==='s30-integrity-run'){e.target.disabled=true;try{await window.cg.runIntegrityAudit();await refreshSettings14();toast('Integrity audit complete');}catch(err){toast('Integrity audit failed');}return;}if(e.target.id==='s14-backup'){const r=await window.cg.exportBackup();if(r?.ok)toast('Backup exported · API keys excluded');return;}if(e.target.id==='s14-restore'){if(!confirm('Restore a CopyGuard backup? Current operational data will be replaced. Saved API keys on this computer will remain unchanged.'))return;const r=await window.cg.importBackup();if(r?.ok){toast('Backup restored');await load();await refreshSettings14();}return;}if(e.target.id==='s14-export'){const r=await window.cg.exportData();if(r?.ok)toast('CopyGuard data exported');return;}if(e.target.id==='s14-folder'){await window.cg.openDataFolder();return;}
    if(e.target.id==='s14-walkthrough'){window.showWalkthrough?.();return;}const reset=e.target.closest('[data-reset-scope]');if(reset){const scope=reset.dataset.resetScope,phrase=scope==='all'?'This clears ALL CopyGuard data AND saved API keys. Continue?':`Reset ${scope} data?`;if(!confirm(phrase))return;let confirmation='';if(scope==='all'){confirmation=prompt('Destructive reset protection\n\nType RESET EVERYTHING to permanently clear local CopyGuard data, settings and stored API credentials.');if(confirmation!=='RESET EVERYTHING'){toast('Reset cancelled · confirmation did not match');return;}}const r=await window.cg.resetData(scope,confirmation);if(r?.ok){toast(`${scope} reset complete`);await load();await refreshSettings14();}}});refreshSettings14();}

function getPadreBounds(){const host=$('padre-host');if(!host)return null;const r=host.getBoundingClientRect();return {x:Math.round(r.left),y:Math.round(r.top),width:Math.round(r.width),height:Math.round(r.height)};}
async function syncPadreView(){if(currentPage!=='padre')return;const bounds=getPadreBounds();if(!bounds||bounds.width<100||bounds.height<100)return;await window.cg.padreShow(bounds);$('padre-host')?.classList.add('ready');}
function padre61MintFromUrl(url=''){return (String(url).match(/\/token\/([1-9A-HJ-NP-Za-km-z]{32,44})/i)||[])[1]||null;}
function padre61Tone(v=''){const s=String(v).toUpperCase();return ['PASS','ONLINE','FULL','HEALTHY','COMPLETED_PRE_SUBMIT'].includes(s)?'good':['HARD_BLOCK','BLOCKED','FAILED','OFFLINE','DEGRADED','UNCERTAIN_AFTER_PAUSE'].includes(s)?'bad':'warn';}
function renderPadre61(){
 const w=padreState.workspace||{},mint=w.mint||padre61MintFromUrl(padreState.url),health=w.padre||{},obs=w.observation||{},risk=(w.risk||[])[0]||null;
 const bar=$('padre61-statebar');if(bar)bar.innerHTML=`<div><span>PADRE</span><b class="${padre61Tone(health.state)}">${esc(health.state||'UNKNOWN')}</b></div><div><span>SYSTEM MODE</span><b class="${padre61Tone(w.systemMode)}">${esc(w.systemMode||'UNKNOWN')}</b></div><div><span>EMERGENCY PAUSE</span><b class="${w.automationPaused?'bad':'good'}">${w.automationPaused?'ACTIVE':'CLEAR'}</b></div><div><span>OBSERVATION</span><b>${esc(obs.websocketMode||obs.mode||'UNKNOWN')}</b></div><div><span>FINAL SUBMIT</span><b class="warn">MANUAL / PADRE</b></div>`;
 const t=$('padre61-token');if(t)t.innerHTML=mint?`<div class="padre61-contract"><b>${esc(mint.slice(0,8))}…${esc(mint.slice(-6))}</b><code>${esc(mint)}</code><div><button class="ghost" data-p61-copy="${esc(mint)}">Copy Contract</button><button class="ghost" data-p61-research="${esc(mint)}">Research</button><button class="ghost" data-p61-risk="${esc(mint)}">Risk Center</button></div></div>`:'<div class="padre61-empty">No exact token contract detected in the current Padre URL.</div>';
 const rb=$('padre61-risk');if(rb)rb.innerHTML=risk?`<div class="padre61-risk ${padre61Tone(risk.decision)}"><b>${esc(risk.decision||'UNKNOWN')}</b><small>Score ${risk.score??'—'} · ${fmtTime(risk.checkedAt||risk.time)}</small>${risk.hardBlocks?.length?`<p>HARD BLOCK · ${esc(risk.hardBlocks.map(x=>typeof x==='string'?x:x.code||x.type).join(' · '))}</p>`:''}${risk.cautions?.length?`<p>CAUTION · ${esc(risk.cautions.map(x=>typeof x==='string'?x:x.code||x.type).join(' · '))}</p>`:''}<span>Deterministic state remains authoritative inside Padre.</span></div>`:'<div class="padre61-empty">No deterministic risk record linked to this contract yet.</div>';
 const sb=$('padre61-safety');if(sb)sb.innerHTML=`<div class="padre61-gate ${w.automationPaused?'bad':'good'}"><b>Emergency pause</b><span>${w.automationPaused?'ACTIVE · execution gated':'CLEAR'}</span></div><div class="padre61-gate ${w.systemMode==='FULL'?'good':'warn'}"><b>Connection mode</b><span>${esc(w.systemMode||'UNKNOWN')}</span></div><div class="padre61-gate"><b>Prepared state</b><span>Does not reserve or submit a Phase 32 attempt</span></div><div class="padre61-gate"><b>Assistant authority</b><span>Pre-submit governed actions only</span></div>`;
 const ab=$('padre61-attempts'),attempts=w.executionAttempts||[];if(ab)ab.innerHTML=attempts.length?attempts.slice(0,8).map(a=>`<div class="padre61-row"><div><b class="${padre61Tone(a.status)}">${esc(a.status)}</b><span>${esc(a.action||'TRADE')}</span></div><small>${esc(a.id||'')} · ${fmtTime(a.updatedAt||a.createdAt)}</small>${a.tokenAddress?`<code>${esc(a.tokenAddress.slice(0,8))}…</code>`:''}</div>`).join(''):'<div class="padre61-empty">No Phase 32 execution attempts.</div>';
 const gb=$('padre61-governed'),acts=w.governedActions||[];if(gb)gb.innerHTML=acts.length?acts.slice(0,6).map(a=>`<div class="padre61-row"><div><b class="${padre61Tone(a.status)}">${esc(a.status||'UNKNOWN')}</b><span>${esc(a.actionType||'ACTION')}</span></div><small>${a.tradeSubmitted?'TRADE SUBMITTED':'NO TRADE SUBMITTED'} · ${fmtTime(a.completedAt||a.createdAt)}</small></div>`).join(''):'<div class="padre61-empty">No recent assistant governed actions.</div>';
}
async function refreshPadre61(){try{padreState.workspace=await window.cg.getPadreWorkspaceContext();renderPadre61();}catch(e){console.error('[Padre61]',e);}}
function renderPadreState(s={}){padreState={...padreState,...s};const input=$('padre-address');if(input&&document.activeElement!==input&&padreState.url)input.value=padreState.url;const back=$('padre-back'),fwd=$('padre-forward');if(back)back.disabled=!padreState.canGoBack;if(fwd)fwd.disabled=!padreState.canGoForward;const dot=$('padre-status-dot'),txt=$('padre-status-text');if(dot)dot.className=padreState.error?'error':padreState.loading?'loading':'live';if(txt)txt.textContent=padreState.error?'ERROR':padreState.loading?'LOADING':'CONNECTED';renderPadre61();}
const ASSISTANT60_COMPAT='ASSISTANT FULL LOGIC AUDIT · Phase 26 deterministic risk + Phase 32 execution safety remain authoritative';
function assistantPermissionClass(p='READ'){return String(p).toLowerCase().replace('_','-');}
function assistant60Array(x){return Array.isArray(x)?x:Array.isArray(x?.items)?x.items:Array.isArray(x?.entries)?x.entries:[];}
function assistant60Health(){const b=$('assistant60-health');if(!b)return;const st=assistantUi.state||{},ctx=st.context||{},a=ctx.awareness||{},audit=assistantUi.audit||{};b.innerHTML=`<div><span>PROVIDER</span><b>${ctx.providerConfigured?String(ctx.provider||'AI').toUpperCase():'LOCAL FALLBACK'}</b><small>${ctx.providerConfigured?'configured':'deterministic fallback available'}</small></div><div><span>EVIDENCE</span><b>${a.sourceCount||0} SOURCES</b><small>read-only CopyGuard context</small></div><div><span>SYSTEM MODE</span><b>${esc(a.systemMode||'UNKNOWN')}</b><small>connection authority</small></div><div><span>LOGIC AUDIT</span><b class="${audit.result==='PASS'?'good':audit.result==='FAIL'?'bad':'warn'}">${esc(audit.result||audit.status||'UNKNOWN')}</b><small>${Number(audit.failures||audit.failCount||0)} failures</small></div>`;}
function assistant60MemoryMini(){const arr=assistant60Array(assistantUi.memory).filter(x=>!x.archivedAt).slice(0,4),b=$('assistant60-memory-mini'),c=$('assistant60-memory-count');if(c)c.textContent=assistant60Array(assistantUi.memory).filter(x=>!x.archivedAt).length;if(b)b.innerHTML=arr.length?arr.map(x=>`<div class="assistant60-mini"><b>${esc(x.type||'NOTE')}</b><span>${esc(x.title||x.content||x.text||'Context item')}</span><small>${x.stale?'STALE · ':''}${esc(x.authority||'CONTEXT_ONLY')}</small></div>`).join(''):'<div class="assistant60-empty">No active working memory.</div>';}
function assistant60ProposalCard(p){const prep=assistantUi.preparations[p.id];return `<article class="assistant60-proposal"><div class="assistant60-cardhead"><div><span>${esc(p.intent||'PREPARE')}</span><b>${esc(p.status||'UNKNOWN')}</b></div><small>${p.expiresAt?`expires ${fmtTime(p.expiresAt)}`:'bounded proposal'}</small></div><code>${esc(p.target?.tokenAddress||p.target?.walletAddress||'Target unresolved')}</code>${p.validation?.reasons?.length?`<div class="assistant60-block">BLOCKS · ${esc(p.validation.reasons.join(' · '))}</div>`:''}${p.validation?.warnings?.length?`<div class="assistant60-warn">WARNINGS · ${esc(p.validation.warnings.join(' · '))}</div>`:''}${p.status==='PENDING_CONFIRMATION'?`<div class="assistant36-actions"><button data-confirm-proposal="${esc(p.id)}" data-confirm-token="${esc(p.confirmationToken)}">Confirm proposal</button><button data-cancel-proposal="${esc(p.id)}">Cancel</button></div>`:''}${p.status==='CONFIRMED_NO_EXECUTION'?`<button class="ghost" data-a60-prepare="${esc(p.id)}">Build Safe Preparation</button>`:''}${prep?`<div class="assistant60-prep"><b>SAFE PREPARATION</b><span>${esc(prep.status||prep.decision||'READY FOR REVIEW')}</span><small>No execution attempt reserved.</small>${prep.allowed!==false?`<div><button class="ghost" data-a60-action="${esc(p.id)}" data-a60-type="OPEN_PADRE_TOKEN">Create Open-Padre Action</button></div>`:''}</div>`:''}<small class="assistant60-boundary">Confirmation never submits a live trade.</small></article>`;}
function renderAssistant60Ops(){const host=$('assistant60-ops-content');if(!host)return;document.querySelectorAll('[data-a60-tab]').forEach(x=>x.classList.toggle('active',x.dataset.a60Tab===assistantUi.tab));if(assistantUi.tab==='actions'){const props=(assistantUi.state?.proposals||[]).filter(p=>!assistantUi.state?.activeSessionId||p.sessionId===assistantUi.state.activeSessionId).slice(0,8),acts=assistant60Array(assistantUi.actions).slice(0,6);host.innerHTML=`<div class="assistant60-ophead"><span>PHASES 36 · 44 · 45</span><h3>Governed Actions</h3><p>Proposal → confirmation → Safe Preparation → governed action → second confirmation → fresh safety check → Padre pre-submit.</p></div>${props.length?props.map(assistant60ProposalCard).join(''):'<div class="assistant60-empty">No active proposals for this session.</div>'}<div class="assistant60-section-title">RECENT GOVERNED ACTIONS</div>${acts.length?acts.map(a=>`<div class="assistant60-action"><div><b>${esc(a.actionType||a.type||'ACTION')}</b><span>${esc(a.status||'UNKNOWN')}</span></div><small>${esc(a.target?.tokenAddress||a.tokenAddress||'')} · ${a.tradeSubmitted?'TRADE SUBMITTED':'NO TRADE SUBMITTED'}</small>${a.status==='PENDING_CONFIRMATION'&&a.confirmationToken?`<button data-a60-run="${esc(a.id)}" data-a60-token="${esc(a.confirmationToken)}">Second confirmation</button>`:''}</div>`).join(''):'<div class="assistant60-empty">No governed actions recorded.</div>'}<div class="assistant60-redline"><b>RED LINE</b><span>Assistant cannot final-submit · Assistant cannot final-submit, call live execution, promote Trusted wallets, change configuration, or override deterministic risk.</span></div>`;}
 else if(assistantUi.tab==='memory'){const mem=assistant60Array(assistantUi.memory);host.innerHTML=`<div class="assistant60-ophead"><span>PHASE 46 · CONTEXT ONLY</span><h3>Working Memory</h3><p>Decisions, investigations, watch items, notes and conclusions help continuity. Current authoritative ledgers always override memory.</p></div>${mem.length?mem.slice(0,30).map(m=>`<article class="assistant60-memory ${m.stale?'stale':''}"><div><b>${esc(m.type||'NOTE')}</b><span>${m.pinned?'PINNED · ':''}${m.stale?'STALE':'CURRENT'}</span></div><p>${esc(m.title||m.content||m.text||'')}</p><small>${esc(m.authority||'CONTEXT_ONLY')} · ${fmtTime(m.updatedAt||m.createdAt)}</small>${!m.archivedAt?`<button class="ghost" data-a60-archive="${esc(m.id)}">Archive</button>`:''}</article>`).join(''):'<div class="assistant60-empty">No memory records.</div>'}<div class="assistant60-redline"><b>MEMORY IS NON-AUTHORITATIVE</b><span>Risk, qualification, connection, integrity, blockchain and Phase 32 execution evidence override remembered context.</span></div>`;}
 else{const a=assistantUi.audit||{},checks=assistant60Array(a.checks||a.results);host.innerHTML=`<div class="assistant60-ophead"><span>PHASE 47 · FULL LOGIC AUDIT</span><h3>${esc(a.result||a.status||'UNKNOWN')}</h3><p>Runtime verification of permission, proposal, memory, governed-action and execution boundaries.</p></div><button class="ghost assistant60-run-audit" id="assistant60-run-audit">Run Full Audit</button><div class="assistant60-audit-summary"><div><span>PASS</span><b>${a.passes||a.passCount||checks.filter(x=>x.status==='PASS').length}</b></div><div><span>WARN</span><b>${a.warnings||a.warnCount||checks.filter(x=>x.status==='WARN').length}</b></div><div><span>FAIL</span><b>${a.failures||a.failCount||checks.filter(x=>x.status==='FAIL').length}</b></div></div>${checks.slice(0,30).map(x=>`<div class="assistant60-check ${String(x.status||'').toLowerCase()}"><b>${esc(x.status||'CHECK')}</b><span>${esc(x.name||x.check||x.message||'Logic boundary')}</span></div>`).join('')}<div class="assistant60-redline"><b>EXPECTED AUTHORITY</b><span>READ / ANALYZE / RECOMMEND allowed. PREPARE is governed. CONFIG and LIVE EXECUTION denied.</span></div>`;}}
function renderAssistant33(){const st=assistantUi.state||{},session=st.activeSession||null,list=$('assistant-session-list'),msgs=$('assistant-messages');if(!list||!msgs)return;const sessions=st.sessions||[];list.innerHTML=sessions.length?sessions.map(x=>`<button class="assistant33-session ${x.id===st.activeSessionId?'active':''}" data-assistant-session="${esc(x.id)}"><span>${esc(x.title||'Conversation')}</span><small>${x.messageCount||0} messages · ${fmtTime(x.updatedAt)}</small></button>`).join(''):'<div class="assistant33-empty-session">No conversations yet.</div>';$('assistant-title').textContent=session?.title||'New conversation';const ctx=st.context||{};$('assistant-provider').textContent=ctx.providerConfigured?`${String(ctx.provider||'AI').toUpperCase()} · READY`:'LOCAL FALLBACK';const aw=ctx.awareness||{},status=$('assistant-awareness-status');if(status)status.textContent=`PHASE 47 AUDIT · ${aw.sourceCount||0} READ-ONLY SOURCES · ${aw.systemMode||'UNKNOWN'} · INTEGRITY ${aw.integrity||'UNKNOWN'}`;const rows=session?.messages||[];msgs.innerHTML=rows.length?rows.map(m=>`<article class="assistant33-msg ${m.role==='user'?'user':'assistant'}"><div class="assistant33-msgmeta"><b>${m.role==='user'?'YOU':'COPYGUARD'}</b><span class="assistant33-perm ${assistantPermissionClass(m.permission)}">${esc(m.permission||'READ')}</span><time>${fmtTime(m.time)}</time></div><div class="assistant33-bubble">${esc(m.content||'').replace(/\n/g,'<br>')}</div>${m.role==='assistant'?`<small class="assistant33-audit">${m.actionExecuted?'ACTION EXECUTED':'NO ACTION EXECUTED'}${m.provider?` · ${esc(m.provider)}`:''}${m.route?` · ${esc(m.route.intent||m.route.key||'ROUTED')}`:''}${m.evidence?` · ${m.evidence.sourceCount||0} EVIDENCE SOURCES${m.evidence.contextTruncated?' · CONTEXT TRIMMED':''}`:''}</small>`:''}</article>`).join(''):`<div class="assistant33-welcome"><span>✦</span><h3>Governed operator ready</h3><p>Ask about wallets, tokens, transactions, risk, Shadow qualification, verified performance, Early Bird, discovery, learning, portfolio state, integrity, connection health or execution safety. Evidence is read-only; deterministic safety remains authoritative.</p></div>`;assistant60Health();assistant60MemoryMini();renderAssistant60Ops();requestAnimationFrame(()=>{msgs.scrollTop=msgs.scrollHeight;});}
async function refreshAssistant60Support(){const calls=[window.cg.getAssistantMemory?.(),window.cg.getAssistantGovernedActions?.(),window.cg.getAssistantLogicAudit?.()];const [m,a,l]=await Promise.all(calls.map(x=>Promise.resolve(x).catch(()=>null)));assistantUi.memory=m;assistantUi.actions=a;assistantUi.audit=l;}
async function refreshAssistant33(){try{assistantUi.state=await window.cg.getAssistantState();await refreshAssistant60Support();renderAssistant33();}catch(e){console.error('[Assistant60]',e);toast('Could not load AI Assistant');}}
async function assistantPreviewPermission(){const input=$('assistant-input'),box=$('assistant-permission-preview');if(!input||!box)return;const text=input.value.trim();if(!text){box.textContent='Requests are classified before they reach the model.';box.className='assistant33-permission-preview';return;}try{const d=await window.cg.checkAssistantPermission(text);assistantUi.permission=d;box.textContent=`${d.route?.intent||'GENERAL_READ'} · ${d.permission} · ${d.allowed?'ALLOWED':'BLOCKED'}${d.requiresConfirmation?' · CONFIRMATION BOUNDARY':''} · LIVE EXECUTION DENIED`;box.className=`assistant33-permission-preview ${assistantPermissionClass(d.permission)}`;}catch{}}
async function sendAssistant33(){const input=$('assistant-input'),btn=$('assistant-send');if(!input||assistantUi.sending)return;const text=input.value.trim();if(!text)return;assistantUi.sending=true;btn.disabled=true;btn.textContent='Thinking…';input.disabled=true;try{const r=await window.cg.sendAssistantMessage(assistantUi.state?.activeSessionId||null,text);if(r?.state)assistantUi.state=r.state;input.value='';await refreshAssistant60Support();renderAssistant33();assistantPreviewPermission();}catch(e){toast(e?.message||'Assistant request failed');}finally{assistantUi.sending=false;btn.disabled=false;btn.textContent='Send';input.disabled=false;input.focus();}}
function initAssistant33(){$('assistant-form')?.addEventListener('submit',e=>{e.preventDefault();sendAssistant33();});$('assistant-input')?.addEventListener('input',()=>{clearTimeout(assistantUi._previewTimer);assistantUi._previewTimer=setTimeout(assistantPreviewPermission,180);});$('assistant-input')?.addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();sendAssistant33();}});$('assistant-new')?.addEventListener('click',async()=>{const r=await window.cg.newAssistantSession();if(r?.state)assistantUi.state=r.state;renderAssistant33();$('assistant-input')?.focus();});$('assistant-session-list')?.addEventListener('click',async e=>{const b=e.target.closest('[data-assistant-session]');if(!b)return;const r=await window.cg.selectAssistantSession(b.dataset.assistantSession);if(r?.state)assistantUi.state=r.state;renderAssistant33();});$('assistant60-tabs')?.addEventListener('click',e=>{const b=e.target.closest('[data-a60-tab]');if(!b)return;assistantUi.tab=b.dataset.a60Tab;renderAssistant60Ops();});$('assistant60-ops-content')?.addEventListener('click',async e=>{try{const c=e.target.closest('[data-confirm-proposal]'),x=e.target.closest('[data-cancel-proposal]'),prep=e.target.closest('[data-a60-prepare]'),act=e.target.closest('[data-a60-action]'),run=e.target.closest('[data-a60-run]'),arch=e.target.closest('[data-a60-archive]');if(c)await window.cg.confirmAssistantProposal(c.dataset.confirmProposal,c.dataset.confirmToken);else if(x)await window.cg.cancelAssistantProposal(x.dataset.cancelProposal);else if(prep)assistantUi.preparations[prep.dataset.a60Prepare]=await window.cg.getAssistantSafePreparation(prep.dataset.a60Prepare);else if(act){await window.cg.createAssistantGovernedAction(act.dataset.a60Action,act.dataset.a60Type,{});toast('Governed action created — second confirmation still required');}else if(run){const r=await window.cg.runAssistantGovernedAction(run.dataset.a60Run,run.dataset.a60Token);toast(r?.tradeSubmitted?'Unexpected submission state — review immediately':'Pre-submit action completed — no trade submitted');}else if(arch)await window.cg.archiveAssistantMemory(arch.dataset.a60Archive);else if(e.target.id==='assistant60-run-audit'){assistantUi.audit=await window.cg.runAssistantFullLogicAudit();toast(`Assistant audit · ${assistantUi.audit?.result||assistantUi.audit?.status||'complete'}`);}await refreshAssistant33();}catch(err){toast(err?.message||'Governed assistant action failed');}});$('assistant-proposals')?.addEventListener('click',()=>{});window.cg.on('assistant-update',async()=>{if(currentPage==='assistant')await refreshAssistant33();});refreshAssistant33();}
async function initPadre(){try{const s=await window.cg.padreState();renderPadreState(s);await refreshPadre61();}catch(e){renderPadreState({error:e.message});}const form=$('padre-address-form');form?.addEventListener('submit',async e=>{e.preventDefault();const value=$('padre-address').value.trim();renderPadreState({loading:true,error:null});const r=await window.cg.padreNavigate(value);if(r?.url)$('padre-address').value=r.url;setTimeout(refreshPadre61,500);});$('padre-back')?.addEventListener('click',()=>window.cg.padreBack());$('padre-forward')?.addEventListener('click',()=>window.cg.padreForward());$('padre-reload')?.addEventListener('click',()=>window.cg.padreReload());$('padre-home')?.addEventListener('click',()=>window.cg.padreHome());$('padre-external')?.addEventListener('click',()=>window.cg.openExternal(padreState.url||'https://trade.padre.gg'));$('padre61-refresh')?.addEventListener('click',refreshPadre61);$('page-padre')?.addEventListener('click',e=>{const cp=e.target.closest('[data-p61-copy]'),r=e.target.closest('[data-p61-research]'),risk=e.target.closest('[data-p61-risk]');if(cp){navigator.clipboard.writeText(cp.dataset.p61Copy);toast('Contract copied');}else if(r){sessionStorage.setItem('copyguard-research-token',r.dataset.p61Research);go('research');}else if(risk){$('risk12-mint')&&($('risk12-mint').value=risk.dataset.p61Risk);go('risk');}});window.addEventListener('resize',()=>{if(currentPage==='padre')requestAnimationFrame(syncPadreView);});window.cg.on('padre-state',s=>{renderPadreState(s);refreshPadre61();});window.cg.on('padre-url-changed',url=>{renderPadreState({url});refreshPadre61();});window.cg.on('connection-health',()=>{if(currentPage==='padre')refreshPadre61();});}
window.openInPadre=async function(tokenAddress){go('padre');await new Promise(r=>requestAnimationFrame(r));await syncPadreView();if(tokenAddress){await window.cg.padreOpenToken(tokenAddress);renderPadreState({url:`https://trade.padre.gg/token/${tokenAddress}`});}await refreshPadre61();};

// ── PHASE 48 · UI Foundation & Navigation System ───────────
const UI48_PAGE_ORDER=['dashboard','feed','wallets','positions','ghost','automation','research','intelligence','earlybird','leaderboard','assistant','risk','notifications','padre','settings'];
let ui48PaletteIndex=0,ui48PaletteRows=[];
function ui48HealthClass(value=''){
  const v=String(value||'').toUpperCase();if(['OK','HEALTHY','PASS','ONLINE','LIVE','NORMAL'].some(x=>v.includes(x)))return 'ok';if(['FAIL','ERROR','OFFLINE','DEGRADED','CRITICAL','BLOCKED'].some(x=>v.includes(x)))return 'bad';return 'warn';
}
function renderGlobalHealth48(){
  const integrity=state.data?.integrity?.status||state.data?.integrityStatus||'UNKNOWN';
  const network=state.data?.connectionHealth?.mode||(state.ws?.connected?'ONLINE':'OFFLINE');
  const it=$('integrity-mini'),nt=$('connection-mini'),id=$('integrity-mini-dot'),nd=$('connection-mini-dot');
  if(it)it.textContent=String(integrity).replace(/_/g,' ');if(nt)nt.textContent=String(network).replace(/_/g,' ');
  if(id){id.className='';id.classList.add(ui48HealthClass(integrity));}
  if(nd){nd.className='';nd.classList.add(ui48HealthClass(network));}
}
function ui48WorkspaceRows(query=''){
  const q=String(query||'').trim().toLowerCase();
  return UI48_PAGE_ORDER.map((page,index)=>({page,index,title:TITLES[page],...(PAGE_META[page]||{})})).filter(x=>!q||`${x.title} ${x.group} ${x.context}`.toLowerCase().includes(q));
}
function renderCommandPalette48(query=''){
  const box=$('command-results');if(!box)return;ui48PaletteRows=ui48WorkspaceRows(query);ui48PaletteIndex=Math.max(0,Math.min(ui48PaletteIndex,ui48PaletteRows.length-1));
  if(!ui48PaletteRows.length){box.innerHTML='<div class="command-empty">No workspace matches that search.</div>';return;}
  box.innerHTML=ui48PaletteRows.map((x,i)=>`<button class="command-result ${i===ui48PaletteIndex?'selected':''}" data-command-page="${x.page}"><span>${x.icon||'•'}</span><div><b>${x.title}</b><small>${x.group} · ${x.context||''}</small></div><em>${x.phase||''}</em></button>`).join('');
  box.querySelectorAll('[data-command-page]').forEach(b=>b.addEventListener('click',()=>go(b.dataset.commandPage)));
  box.querySelector('.selected')?.scrollIntoView({block:'nearest'});
}
function openCommandPalette48(){
  const bg=$('command-palette-backdrop'),input=$('command-search');if(!bg)return;bg.classList.add('open');bg.setAttribute('aria-hidden','false');ui48PaletteIndex=0;if(input){input.value='';setTimeout(()=>input.focus(),0);}renderCommandPalette48('');
}
function closeCommandPalette48(){const bg=$('command-palette-backdrop');if(!bg)return;bg.classList.remove('open');bg.setAttribute('aria-hidden','true');}
function toggleSidebar48(){
  const shell=document.querySelector('.shell');if(!shell)return;const compact=!shell.classList.contains('compact-sidebar');shell.classList.toggle('compact-sidebar',compact);$('sidebar-density')?.setAttribute('aria-pressed',compact?'true':'false');try{localStorage.setItem('copyguard-sidebar-compact',compact?'1':'0');}catch{}
}

function ui64SetBusy(el,busy,label='Working…'){if(!el)return;if(busy){if(!el.dataset.ui64Label)el.dataset.ui64Label=el.textContent;el.setAttribute('aria-busy','true');el.disabled=true;if(label)el.textContent=label;}else{el.removeAttribute('aria-busy');el.disabled=false;if(el.dataset.ui64Label){el.textContent=el.dataset.ui64Label;delete el.dataset.ui64Label;}}}
function ui64EnhanceSemantics(){
  document.querySelectorAll('.page').forEach(p=>{p.setAttribute('role','region');p.setAttribute('aria-labelledby','page-title');});
  document.querySelectorAll('button:not([type])').forEach(b=>b.setAttribute('type','button'));
  document.querySelectorAll('input[placeholder],textarea[placeholder]').forEach(i=>{if(!i.getAttribute('aria-label'))i.setAttribute('aria-label',i.getAttribute('placeholder').replace(/…/g,'').trim());});
  document.querySelectorAll('select').forEach((s,i)=>{if(!s.getAttribute('aria-label'))s.setAttribute('aria-label',s.title||`Filter ${i+1}`);});
  document.querySelectorAll('[data-jump]').forEach(x=>x.setAttribute('aria-label',`Open ${x.dataset.jump} workspace`));
}
function ui64Init(){
  ui64EnhanceSemantics();
  const reduced=window.matchMedia?.('(prefers-reduced-motion: reduce)');
  document.documentElement.classList.toggle('reduce-motion',!!reduced?.matches);
  reduced?.addEventListener?.('change',e=>document.documentElement.classList.toggle('reduce-motion',e.matches));
  window.addEventListener('error',e=>{console.error('[UI64 error]',e.error||e.message);toast('A workspace error occurred. CopyGuard safety state was not changed.',{urgent:true,duration:5000});});
  window.addEventListener('unhandledrejection',e=>{console.error('[UI64 rejection]',e.reason);toast('An operation could not complete. No execution state was assumed.',{urgent:true,duration:5000});});
  document.addEventListener('keydown',e=>{
    if(e.key==='?'&&!e.ctrlKey&&!e.metaKey&&!e.altKey&&!['INPUT','TEXTAREA','SELECT'].includes(e.target?.tagName)){e.preventDefault();toast('Keyboard: Ctrl+K quick switch · 1–9 workspaces · Esc close · Tab navigate',{duration:5000});}
    if(e.key==='Escape'){document.activeElement?.blur?.();}
  });
  document.addEventListener('click',e=>{
    const b=e.target.closest('button');if(!b||b.disabled)return;
    b.classList.add('ui64-pressed');setTimeout(()=>b.classList.remove('ui64-pressed'),140);
  });
}
function initUi48(){
  try{const compact=localStorage.getItem('copyguard-sidebar-compact')==='1';document.querySelector('.shell')?.classList.toggle('compact-sidebar',compact);$('sidebar-density')?.setAttribute('aria-pressed',compact?'true':'false');}catch{}
  $('sidebar-density')?.addEventListener('click',toggleSidebar48);
  $('main-nav')?.addEventListener('keydown',e=>{const items=[...document.querySelectorAll('#main-nav .nav-item')],i=items.indexOf(document.activeElement);if(i<0)return;let n=null;if(e.key==='ArrowDown')n=(i+1)%items.length;else if(e.key==='ArrowUp')n=(i-1+items.length)%items.length;else if(e.key==='Home')n=0;else if(e.key==='End')n=items.length-1;if(n!==null){e.preventDefault();items[n].focus();}});
  $('quick-switch-btn')?.addEventListener('click',openCommandPalette48);
  $('command-palette-backdrop')?.addEventListener('mousedown',e=>{if(e.target===e.currentTarget)closeCommandPalette48();});
  $('command-search')?.addEventListener('input',e=>{ui48PaletteIndex=0;renderCommandPalette48(e.target.value);});
  $('command-search')?.addEventListener('keydown',e=>{if(e.key==='ArrowDown'){e.preventDefault();ui48PaletteIndex=Math.min(ui48PaletteRows.length-1,ui48PaletteIndex+1);renderCommandPalette48(e.currentTarget.value);}else if(e.key==='ArrowUp'){e.preventDefault();ui48PaletteIndex=Math.max(0,ui48PaletteIndex-1);renderCommandPalette48(e.currentTarget.value);}else if(e.key==='Enter'&&ui48PaletteRows[ui48PaletteIndex]){e.preventDefault();go(ui48PaletteRows[ui48PaletteIndex].page);}});
  document.addEventListener('keydown',e=>{
    const target=e.target;if(target&&['INPUT','TEXTAREA','SELECT'].includes(target.tagName)&&!(e.ctrlKey||e.metaKey))return;
    if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k'){e.preventDefault();document.getElementById('command-palette-backdrop')?.classList.contains('open')?closeCommandPalette48():openCommandPalette48();return;}
    if(e.key==='Escape'){closeCommandPalette48();return;}
    if(!e.ctrlKey&&!e.metaKey&&!e.altKey&&/^[1-9]$/.test(e.key)){const page=UI48_PAGE_ORDER[Number(e.key)-1];if(page)go(page);}
  });
  renderCommandPalette48('');
  renderGlobalHealth48();
}

async function load(){try{const [data,positions,closedPositions,ws,daily,trustedConfigs,automation,dashboardPortfolio,dashboardLogicAudit,portfolioAccounting,executionSafety,productionAudit]=await Promise.all([window.cg.getAllData(),window.cg.getOpenPositions(),window.cg.getClosedPositions(),window.cg.wsStatus(),window.cg.getDailyStats(),window.cg.getTrustedConfigsAll(),window.cg.getAutomationState(),window.cg.getAssistantPortfolioAnalysis?.().catch(()=>null),window.cg.getAssistantLogicAudit?.().catch(()=>null),window.cg.getPortfolioAccountingData?.().catch(()=>null),window.cg.getExecutionSafety?.(100).catch(()=>null),window.cg.getProductionIntegrationAudit?.().catch(()=>null)]);state={...state,data,positions:positions||[],closedPositions:closedPositions||[],ws:ws||{connected:false},daily:daily||{},trustedConfigs:trustedConfigs||{},automation:automation||state.automation,dashboardPortfolio:dashboardPortfolio||state.dashboardPortfolio,dashboardLogicAudit:dashboardLogicAudit||state.dashboardLogicAudit,executionSafety:executionSafety||state.executionSafety,productionAudit:productionAudit||state.productionAudit};positionUi.accounting=portfolioAccounting||positionUi.accounting;renderDashboard();renderWallets();renderFeed();renderResearch();renderPositions();renderAutomation();renderIntelligence();renderLeaderboard();refreshRiskCenter();refreshNotifications13();refreshGhost16();renderGlobalHealth48();}catch(e){console.error(e);toast('Could not load CopyGuard backend data');}}
async function setPaused(v){const btn=$('pause-btn');btn?.setAttribute('aria-busy','true');try{await setAutomationPatch({paused:!!v},v?'AUTOMATION EMERGENCY-PAUSED':'Emergency pause released');btn?.setAttribute('aria-pressed',v?'true':'false');}finally{btn?.removeAttribute('aria-busy');}}
window.addEventListener('DOMContentLoaded',async ()=>{ui64Init();initUi48();initPadre();initWallets();initFeed();initResearch();initPositions();initAutomation();initIntelligence();initRiskCenter();initNotifications13();initSettings14();initAssistant33();initGhost16();initEarlyBird11();initLeaderboard();$('main-nav').addEventListener('click',e=>{const b=e.target.closest('.nav-item');if(b)go(b.dataset.page);});document.querySelectorAll('[data-jump]').forEach(b=>b.addEventListener('click',()=>go(b.dataset.jump)));$('refresh-btn').addEventListener('click',async e=>{ui64SetBusy(e.currentTarget,true,'Refreshing…');try{await load();toast('Dashboard refreshed');}finally{ui64SetBusy(e.currentTarget,false);}});$('production-audit-run65')?.addEventListener('click',async e=>{ui64SetBusy(e.currentTarget,true,'Auditing…');try{const a=await refreshProductionAudit65();if(a)toast(`Production audit · ${a.status}`);}finally{ui64SetBusy(e.currentTarget,false);}});$('pause-btn').addEventListener('click',()=>setPaused(!state.automation.paused));window.cg.on('ws-status',({state:st,text})=>{state.ws={connected:st==='live'};$('helius-dot').classList.toggle('live',st==='live');$('helius-status').textContent=text||st;renderServices();renderFeed();renderGlobalHealth48();renderCommandState49();});window.cg.on('observation-health',o=>{if(settings14Ui.data)settings14Ui.data.observation=o;if(currentPage==='settings'&&settings14Ui.tab==='connections')renderSettings14();});window.cg.on('connection-health',h=>{if(state.data)state.data.connectionHealth=h;if(settings14Ui.data)settings14Ui.data.connectionHealth=h;if(currentPage==='settings'&&settings14Ui.tab==='connections')renderSettings14();renderServices();renderGlobalHealth48();renderCommandState49();const hero=$('hero-state'),sub=$('hero-sub');if(hero&&h.mode==='DEGRADED'){hero.textContent='DEGRADED';if(sub)sub.textContent=h.reason||'Execution-critical service unavailable';}});window.cg.on('trade',trade=>{feedUi.liveTrades.set(trade.id||String(Date.now()),trade);feedUi.newestId=trade.id||null;const badge=$('feed-badge');badge.style.display='grid';badge.textContent=(Number(badge.textContent)||0)+1;renderDashboard();renderFeed();toast(`${trade.action||'Trade'} detected · ${trade.token||trade.tokenSymbol||'token'}`);});window.cg.on('trade-update',trade=>{if(!state.data)return;const idx=(state.data.history||[]).findIndex(h=>h.id===trade.id);if(idx>=0)state.data.history[idx]=trade;if(trade.id)feedUi.liveTrades.set(trade.id,trade);renderDashboard();renderFeed();});window.cg.on('trade-blocked',({reason})=>{toast(reason||'Trade blocked');renderFeed();renderDashboard();});window.cg.on('health-alerts', alerts => {
  // Targeted: update health alerts in state, re-render affected panels only
  if (state.data && Array.isArray(alerts)) {
    state.data.healthAlerts = alerts;
  }
  renderDashboard();
  if (currentPage === 'intelligence') renderIntelligence();
});window.cg.on('suggestion', suggestion => {
  // Targeted: prepend to suggestions in state, re-render intel if open
  if (state.data && suggestion) {
    state.data.suggestions = state.data.suggestions || [];
    const exists = state.data.suggestions.some(s => s.address === suggestion.address);
    if (!exists) state.data.suggestions.unshift(suggestion);
  }
  renderDashboard();
  if (currentPage === 'intelligence') renderIntelligence();
});window.cg.on('wallet-stats-updated',({address,stats})=>{if(state.data?.wallets?.[address]&&stats){state.data.wallets[address].stats=stats;renderWalletList();renderWalletDetail();renderDashboard();renderLeaderboard();}checkAndRenderPromo();});window.cg.on('automation-state',a=>{state.automation={...state.automation,...a};renderAutomation();renderDashboard();});window.cg.on('pnl-closed', async closed => {
  // Targeted update — refresh only positions (not all data)
  try {
    const [positions, closedPositions] = await Promise.all([
      window.cg.getOpenPositions(),
      window.cg.getClosedPositions(),
    ]);
    state.positions       = positions       || [];
    state.closedPositions = closedPositions || [];
    // Also update the wallet stats in state if we have them
    if (closed?.walletAddress && state.data?.wallets?.[closed.walletAddress]) {
      const w = state.data.wallets[closed.walletAddress];
      if (closed.pnl !== undefined) {
        w.stats = w.stats || {};
        const won = Number(closed.pnl) > 0;
        w.stats.wins     = (w.stats.wins     || 0) + (won ? 1 : 0);
        w.stats.losses   = (w.stats.losses   || 0) + (won ? 0 : 1);
        w.stats.totalPnl = parseFloat(((w.stats.totalPnl || 0) + Number(closed.pnl)).toFixed(4));
        w.stats.winRate  = w.stats.totalTrades > 0
          ? (w.stats.wins / w.stats.totalTrades) * 100 : 0;
      }
    }
    renderPositions();
    renderDashboard();
    checkAndRenderPromo();
    toast('Position closed · P&L updated');
  } catch(e) {
    // Fallback to full reload if targeted update fails
    await load();
    toast('Position closed · P&L updated');
  }
});await load();});

// ════════════════════════════════════════════════════════════
//  TRUSTED CONFIG MODAL  (Phase 3)
// ════════════════════════════════════════════════════════════

let tcState = {
  addr:    null,
  wallet:  null,
  mode:    'fixed',
  pending: false,
};

// ── Open ──────────────────────────────────────────────────────
async function openTrustedConfigModal(addr, wallet) {
  tcState.addr   = addr;
  tcState.wallet = wallet;
  tcState.mode   = 'fixed';

  const backdrop = $('tc-backdrop');
  if (!backdrop) return;

  // Set wallet name
  const nameEl = $('tc-wallet-name');
  if (nameEl) nameEl.textContent = wallet.label || shortAddr(addr);

  // Load existing config if already trusted
  let existing = null;
  try { existing = await window.cg.getTrustedConfig(addr); } catch(e) {}

  // Populate form
  if (existing) {
    tcPopulate(existing, wallet);
  } else {
    tcDefaults(wallet);
  }

  backdrop.classList.add('show');
  updateKellyPreview();
}

function closeTrustedConfigModal() {
  $('tc-backdrop')?.classList.remove('show');
  tcState.addr   = null;
  tcState.wallet = null;
}

// ── Defaults ─────────────────────────────────────────────────
function tcDefaults(wallet) {
  tcSelectMode('fixed');
  tcSet('tc-fixed-sol',     '0.5');
  tcSet('tc-balance-pct',   '5');
  tcSet('tc-ai-base',       '0.5');
  tcSet('tc-ai-min-conf',   '60');
  tcSet('tc-kelly-bankroll', '10');
  tcSet('tc-kelly-ratio',    '1.5');
  tcSet('tc-kelly-frac',     '0.25');
  tcSet('tc-max-sol',        '2');
  tcSet('tc-max-trades',     '0');
  tcSet('tc-max-loss',       '0');
  tcSet('tc-max-pos',        '3');
  tcSet('tc-tp-pct',         '150');
  tcSet('tc-sl-pct',         '30');
  tcSetTog('tc-tp-tog',    false); $('tc-tp-row').style.display = 'none';
  tcSetTog('tc-sl-tog',    false); $('tc-sl-row').style.display = 'none';
  tcSetTog('tc-trail-tog', false);
  tcSetTog('tc-require-ai',false);
}

function tcPopulate(cfg, wallet) {
  tcSelectMode(cfg.sizingMode || 'fixed');
  tcSet('tc-fixed-sol',      cfg.fixedSol        || '0.5');
  tcSet('tc-balance-pct',    cfg.balancePercent   || '5');
  tcSet('tc-ai-base',        cfg.aiBaseSol        || '0.5');
  tcSet('tc-ai-min-conf',    cfg.aiMinConfidence  || '60');
  tcSet('tc-kelly-bankroll', cfg.kellyBankrollSol || '10');
  tcSet('tc-kelly-ratio',    cfg.kellyWinLossRatio|| '1.5');
  tcSet('tc-kelly-frac',     cfg.kellyFraction    || '0.25');
  tcSet('tc-max-sol',        cfg.maxSolPerTrade   || '2');
  tcSet('tc-max-trades',     cfg.maxDailyTrades   || '0');
  tcSet('tc-max-loss',       cfg.maxDailyLossSol  || '0');
  tcSet('tc-max-pos',        cfg.maxConcurrentPositions || '3');
  tcSet('tc-tp-pct',         cfg.takeProfitPct    || '150');
  tcSet('tc-sl-pct',         cfg.stopLossPct      || '30');
  const tpOn = Number(cfg.takeProfitPct || 0) > 0;
  const slOn = Number(cfg.stopLossPct   || 0) > 0;
  tcSetTog('tc-tp-tog',    tpOn);   $('tc-tp-row').style.display = tpOn ? 'block' : 'none';
  tcSetTog('tc-sl-tog',    slOn);   $('tc-sl-row').style.display = slOn ? 'block' : 'none';
  tcSetTog('tc-trail-tog', !!cfg.trailingStop);
  tcSetTog('tc-require-ai',!!cfg.requireAiApproval);
}

// ── Helpers ───────────────────────────────────────────────────
function tcSet(id, val) { const el = $(id); if (el) el.value = val; }
function tcSetTog(id, on) { const el = $(id); if (el) el.className = 'tc-tog ' + (on ? 'on' : 'off'); }
function tcIsTog(id) { return $$(id)?.className.includes('on') ?? false; }
function $$(id) { return document.getElementById(id); }

// ── Mode selector ─────────────────────────────────────────────
function tcSelectMode(mode) {
  tcState.mode = mode;
  document.querySelectorAll('.tc-mode').forEach(b => {
    b.classList.toggle('active', b.dataset.mode === mode);
  });
  ['fixed','percent_balance','ai_weighted','kelly'].forEach(m => {
    const el = $('tc-fields-' + m);
    if (el) el.style.display = m === mode ? 'flex' : 'none';
  });
  if (mode === 'kelly') updateKellyPreview();
}

// ── Kelly live preview ────────────────────────────────────────
function updateKellyPreview() {
  const el = $('tc-kelly-preview');
  if (!el) return;
  const w  = tcState.wallet;
  const p  = (w?.stats?.winRate || 55) / 100;
  const b  = parseFloat($('tc-kelly-ratio')?.value || 1.5);
  const fr = parseFloat($('tc-kelly-frac')?.value   || 0.25);
  const bk = parseFloat($('tc-kelly-bankroll')?.value || 10);
  const mx = parseFloat($('tc-max-sol')?.value || 2);
  const kf = Math.max(0, (p * b - (1 - p)) / b);
  const sz = Math.min(bk * kf * fr, mx).toFixed(3);
  const wr = ((w?.stats?.winRate) || 55).toFixed(0);
  el.textContent = `${wr}% WR on ${bk} SOL bankroll → Kelly: ${(kf*100).toFixed(1)}% × ${(fr*100).toFixed(0)}% fraction = ${sz} SOL per trade`;
}

// ── Save ──────────────────────────────────────────────────────
async function saveTrustedConfig() {
  if (!tcState.addr || tcState.pending) return;
  tcState.pending = true;
  try {
    const tpOn    = tcIsTog('tc-tp-tog');
    const slOn    = tcIsTog('tc-sl-tog');
    const trailOn = tcIsTog('tc-trail-tog');
    const aiReq   = tcIsTog('tc-require-ai');

    const config = {
      sizingMode:              tcState.mode,
      fixedSol:                parseFloat($('tc-fixed-sol').value)     || 0.5,
      balancePercent:          parseFloat($('tc-balance-pct').value)   || 5,
      aiBaseSol:               parseFloat($('tc-ai-base').value)       || 0.5,
      aiMinConfidence:         parseInt($('tc-ai-min-conf').value)     || 60,
      requireAiApproval:       aiReq,
      kellyBankrollSol:        parseFloat($('tc-kelly-bankroll').value)|| 10,
      kellyWinLossRatio:       parseFloat($('tc-kelly-ratio').value)   || 1.5,
      kellyFraction:           parseFloat($('tc-kelly-frac').value)    || 0.25,
      maxSolPerTrade:          parseFloat($('tc-max-sol').value)       || 2,
      takeProfitPct:           tpOn    ? (parseInt($('tc-tp-pct').value) || 150) : 0,
      stopLossPct:             slOn    ? (parseInt($('tc-sl-pct').value) || 30)  : 0,
      trailingStop:            trailOn,
      maxDailyTrades:          parseInt($('tc-max-trades').value)      || 0,
      maxDailyLossSol:         parseFloat($('tc-max-loss').value)      || 0,
      maxConcurrentPositions:  parseInt($('tc-max-pos').value)         || 3,
      configuredAt: Date.now(),
    };

    // Save config first
    await window.cg.saveTrustedConfig(tcState.addr, config);

    // Now promote the wallet
    const w = state.data.wallets[tcState.addr];
    if (w) w.tier = 'trusted';
    await window.cg.saveWallets(state.data.wallets);

    // Update local trusted configs cache
    if (!state.trustedConfigs) state.trustedConfigs = {};
    state.trustedConfigs[tcState.addr] = config;

    closeTrustedConfigModal();
    renderWallets();
    renderDashboard();
    toast(`${w?.label || shortAddr(tcState.addr)} promoted to Trusted ✓`);

  } catch(e) {
    toast('Could not save config: ' + e.message);
  } finally {
    tcState.pending = false;
  }
}

// ── Init modal event listeners ────────────────────────────────
function initTrustedConfigModal() {
  // Close on backdrop click or X button
  $('tc-backdrop')?.addEventListener('click', e => {
    if (e.target === $('tc-backdrop')) closeTrustedConfigModal();
  });
  $('tc-close')?.addEventListener('click', closeTrustedConfigModal);
  $('tc-cancel')?.addEventListener('click', closeTrustedConfigModal);
  $('tc-save')?.addEventListener('click', saveTrustedConfig);

  // Mode buttons
  $('tc-mode-grid')?.addEventListener('click', e => {
    const btn = e.target.closest('.tc-mode');
    if (btn) tcSelectMode(btn.dataset.mode);
  });

  // Toggle buttons (TP, SL, trailing, require-AI)
  $('tc-modal')?.addEventListener('click', e => {
    const tog = e.target.closest('.tc-tog');
    if (!tog) return;
    const isOn = tog.className.includes('on');
    tog.className = 'tc-tog ' + (isOn ? 'off' : 'on');
    // Reveal/hide linked section
    const reveals = tog.dataset.reveals;
    if (reveals) $(reveals).style.display = isOn ? 'none' : 'block';
    if (tog.id === 'tc-trail-tog') {
      // trailing only makes sense with SL on
    }
  });

  // Kelly preview on any input change inside modal
  $('tc-modal')?.addEventListener('input', e => {
    if (tcState.mode === 'kelly') updateKellyPreview();
  });

  // Close on Escape
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && $('tc-backdrop')?.classList.contains('show')) {
      closeTrustedConfigModal();
    }
  });
}

// Run init on DOMContentLoaded (wired at the bottom of the file)
document.addEventListener('DOMContentLoaded', initTrustedConfigModal);

// ════════════════════════════════════════════════════════════
//  PROMOTION BANNER ENGINE  (Phase 4)
//  When a Pending wallet hits promoMinTrades + promoMinWinrate,
//  a banner fires in the Feed and a compact alert appears in
//  the Dashboard risk panel. The wallet is NOT promoted until
//  the user clicks "Configure & Promote" and saves the modal.
// ════════════════════════════════════════════════════════════

// Track which wallets we've already bannered this session
// so we don't show the same banner repeatedly on every render.
const promoBanneredThisSession = new Set();

// ── Core eligibility check ─────────────────────────────────
function getEligibleWallets() {
  const wallets  = state.data?.wallets  || {};
  const settings = state.data?.settings || {};
  const minTrades = Number(settings.promoMinTrades  || 5);
  const minWR     = Number(settings.promoMinWinrate || 60);

  return Object.entries(wallets).filter(([addr, w]) => {
    if (walletTier(w) !== 'pending') return false;
    const st = walletStats(w);
    return st.trades >= minTrades && st.winRate >= minWR;
  });
}

// ── Full-width banner in the Feed page ────────────────────────
function renderPromoBanners() {
  const box = $('promo-banners');
  if (!box) return;

  const eligible = getEligibleWallets();
  if (!eligible.length) { box.innerHTML = ''; return; }

  // Only show wallets not dismissed this session
  const toShow = eligible.filter(([addr]) => !promoBanneredThisSession.has(addr + ':dismissed'));

  if (!toShow.length) { box.innerHTML = ''; return; }

  box.innerHTML = toShow.map(([addr, w]) => {
    const st  = walletStats(w);
    const name = esc(w.label || shortAddr(addr));
    return `
      <div class="promo-banner" id="promo-${esc(addr)}">
        <span class="promo-icon">🏆</span>
        <div class="promo-copy">
          <b>${name} is ready to be promoted</b>
          <small>
            This wallet meets the basic promotion heuristic and can be configured for
            autonomous copy trading. Set its sizing rules and risk limits before it goes live.
          </small>
        </div>
        <div class="promo-stats">
          <div class="promo-stat">
            <span>WIN RATE</span>
            <b>${st.winRate.toFixed(0)}%</b>
          </div>
          <div class="promo-stat">
            <span>TRADES</span>
            <b>${st.trades}</b>
          </div>
          <div class="promo-stat">
            <span>P&amp;L</span>
            <b style="color:${st.pnl >= 0 ? 'var(--green)' : 'var(--red)'}">
              ${fmtPnl(st.pnl)}
            </b>
          </div>
        </div>
        <div class="promo-actions">
          <button class="promo-btn"
            data-promo-action="promote" data-promo-addr="${esc(addr)}">
            ↑ Configure &amp; Promote
          </button>
          <button class="promo-dismiss"
            data-promo-action="dismiss" data-promo-addr="${esc(addr)}"
            title="Dismiss this banner">✕</button>
        </div>
      </div>`;
  }).join('');
}

// ── Compact alert strip in the Dashboard risk panel ───────────
function renderPromoAlertStrip() {
  const box = $('promo-alert-strip');
  if (!box) return;

  const eligible = getEligibleWallets()
    .filter(([addr]) => !promoBanneredThisSession.has(addr + ':dismissed'));

  if (!eligible.length) { box.innerHTML = ''; return; }

  box.innerHTML = eligible.map(([addr, w]) => {
    const st   = walletStats(w);
    const name = esc(w.label || shortAddr(addr));
    return `
      <div class="promo-alert">
        <span class="promo-alert-dot"></span>
        <div>
          <b>${name} ready to promote</b>
          <small>${st.winRate.toFixed(0)}% WR · ${st.trades} trades · ${fmtPnl(st.pnl)} SOL P&amp;L</small>
        </div>
        <button class="promo-alert-btn"
          data-promo-action="promote" data-promo-addr="${esc(addr)}">
          PROMOTE →
        </button>
      </div>`;
  }).join('');
}

// ── Handle banner clicks ───────────────────────────────────────
function handlePromoBannerClick(e) {
  const btn = e.target.closest('[data-promo-action]');
  if (!btn) return;

  const action = btn.dataset.promoAction;
  const addr   = btn.dataset.promoAddr;
  if (!addr) return;

  const w = state.data?.wallets?.[addr];
  if (!w) return;

  if (action === 'promote') {
    // Open the Phase 3 trusted config modal
    openTrustedConfigModal(addr, w);

  } else if (action === 'dismiss') {
    // Hide for this session — user can still promote from the Wallets tab
    promoBanneredThisSession.add(addr + ':dismissed');
    renderPromoBanners();
    renderPromoAlertStrip();
    toast(`Banner dismissed · ${w.label || shortAddr(addr)} can still be promoted from Wallets`);
  }
}

// ── Check + render promo state ─────────────────────────────────
function checkAndRenderPromo() {
  renderPromoBanners();
  renderPromoAlertStrip();

  // Update the risk count in the dashboard panel header to include promo alerts
  const eligible = getEligibleWallets()
    .filter(([addr]) => !promoBanneredThisSession.has(addr + ':dismissed'));
  const riskAlerts = (state.data?.healthAlerts || []).filter(x => !x.dismissed);
  const totalRisk  = riskAlerts.length + eligible.length;
  const riskCountEl = $('risk-count');
  if (riskCountEl) riskCountEl.textContent = totalRisk;
}

// ── Wire into existing render cycle ───────────────────────────
// Patch renderDashboard to include promo alerts
const _renderDashboardPrePromo = renderDashboard;
renderDashboard = function() {
  _renderDashboardPrePromo();
  checkAndRenderPromo();
};

// Patch renderFeed to show banners when feed page is active
const _renderFeedPrePromo = renderFeed;
if (typeof renderFeed === 'function') {
  renderFeed = function() {
    _renderFeedPrePromo();
    renderPromoBanners();
  };
}

// wallet-stats-updated: handled in DOMContentLoaded block (Phase 7 — targeted update)

// ── Register click handlers on page load ──────────────────────
document.addEventListener('DOMContentLoaded', () => {
  // Feed banners
  $('promo-banners')?.addEventListener('click', handlePromoBannerClick);
  // Dashboard risk panel alerts
  $('risk-list')?.parentElement?.addEventListener('click', handlePromoBannerClick);
  // Use delegation on the whole main content area so dashboard strip works too
  document.querySelector('.main')?.addEventListener('click', handlePromoBannerClick);
});

// ── After Phase 3 modal successfully promotes ─────────────────
// Patch saveTrustedConfig to clear the promo banner on success
const _saveTrustedConfigPrePromo = saveTrustedConfig;
saveTrustedConfig = async function() {
  const addr = tcState.addr;
  await _saveTrustedConfigPrePromo();
  // Clear any promo banner for this wallet
  if (addr) {
    promoBanneredThisSession.add(addr + ':dismissed');
    renderPromoBanners();
    renderPromoAlertStrip();
  }
};

// ════════════════════════════════════════════════════════════
//  FIRST LAUNCH WALKTHROUGH  (Phase 5)
// ════════════════════════════════════════════════════════════

const WT_TOTAL = 7;
let wtStep = 0;

// ── Boot check ────────────────────────────────────────────────
// Called after load() completes so we have settings available
async function initWalkthrough() {
  const seen = state.data?.settings?.walkthroughSeen;
  const shell = $('wt-shell');
  if (!shell) return;

  if (seen) {
    shell.classList.add('gone');  // never seen again automatically
    return;
  }

  // First launch — show welcome
  shell.style.display = 'flex';
  wtShowStep(0);
}

// ── Show a step ───────────────────────────────────────────────
function wtShowStep(n) {
  wtStep = Math.max(0, Math.min(n, WT_TOTAL));

  // Swap active step
  document.querySelectorAll('.wt-step').forEach(el => el.classList.remove('active'));
  $(`wt-${wtStep}`)?.classList.add('active');

  // Nav footer
  const nav = $('wt-nav');
  if (wtStep === 0) {
    nav?.classList.remove('show');
  } else {
    nav?.classList.add('show');
    const back = $('wt-back');
    const next = $('wt-next');
    if (back) back.disabled = wtStep === 1;
    if (next) next.textContent = wtStep === WT_TOTAL ? 'Finish →' : 'Next →';
    wtRenderDots();
  }
}

// ── Dot indicators ────────────────────────────────────────────
function wtRenderDots() {
  const box = $('wt-dots');
  if (!box) return;
  box.innerHTML = Array.from({ length: WT_TOTAL }, (_, i) => {
    const s = i + 1;
    return `<div class="wt-dot${s === wtStep ? ' active' : ''}" data-wt-dot="${s}"></div>`;
  }).join('');
}

// ── Finish / skip ─────────────────────────────────────────────
async function finishWalkthrough() {
  const shell = $('wt-shell');
  if (!shell) return;

  // Animate out
  shell.classList.add('hidden');
  setTimeout(() => shell.classList.add('gone'), 260);

  // Persist walkthroughSeen
  try {
    await window.cg.saveSettingsSecure({ preferences: { walkthroughSeen: true } });
    if (state.data?.settings) state.data.settings.walkthroughSeen = true;
  } catch(e) {
    // Fallback to plain save-settings if secure save unavailable
    try { await window.cg.saveSettings({ walkthroughSeen: true }); } catch {}
  }

  // If no Helius key yet, navigate to Settings → Connections
  const hasHelius = !!state.data?.settings?.heliusApiKey;
  if (!hasHelius) {
    go('settings');
    // Switch to connections tab
    const connTab = document.querySelector('[data-settings-tab="connections"]');
    if (connTab) { connTab.click(); }
    toast('Paste your Helius and AI keys to go live');
  }
}

// ── Checklist progress ────────────────────────────────────────
function wtUpdateProgress() {
  const boxes   = document.querySelectorAll('[data-wt-check]');
  const checked = [...boxes].filter(b => b.checked).length;
  const total   = boxes.length;
  const pct     = total ? Math.round((checked / total) * 100) : 0;

  const fill  = $('wt-progress-fill');
  const label = $('wt-progress-label');
  const done  = $('wt-done-note');
  if (fill)  fill.style.width  = pct + '%';
  if (label) label.textContent  = `${checked} / ${total} complete`;
  if (done)  done.style.display = checked === total ? 'flex' : 'none';
}

// ── Re-open from Settings ─────────────────────────────────────
window.showWalkthrough = function() {
  const shell = $('wt-shell');
  if (!shell) return;
  shell.classList.remove('gone', 'hidden');
  wtShowStep(1);  // start at step 1, skip welcome on re-open
};

// ── Init event listeners ──────────────────────────────────────
function initWalkthroughEvents() {
  // Welcome screen buttons
  $('wt-start')?.addEventListener('click', () => wtShowStep(1));
  $('wt-skip')?.addEventListener('click',  finishWalkthrough);

  // Nav buttons
  $('wt-back')?.addEventListener('click', () => wtShowStep(wtStep - 1));
  $('wt-next')?.addEventListener('click', () => {
    if (wtStep >= WT_TOTAL) finishWalkthrough();
    else wtShowStep(wtStep + 1);
  });

  // Dot navigation
  $('wt-dots')?.addEventListener('click', e => {
    const dot = e.target.closest('[data-wt-dot]');
    if (dot) wtShowStep(Number(dot.dataset.wtDot));
  });

  // Finish button on step 7
  $('wt-finish')?.addEventListener('click', finishWalkthrough);

  // Checklist progress
  $('wt-checklist')?.addEventListener('change', wtUpdateProgress);

  // External links
  $('wt-helius-link')?.addEventListener('click',
    () => window.cg.openExternal('https://helius.dev'));
  $('wt-helius-link-2')?.addEventListener('click',
    () => window.cg.openExternal('https://helius.dev'));
  $('wt-anthropic-link')?.addEventListener('click',
    () => window.cg.openExternal('https://console.anthropic.com'));

  // Keyboard nav
  document.addEventListener('keydown', e => {
    const shell = $('wt-shell');
    if (!shell || shell.classList.contains('gone')) return;

    if (e.key === 'ArrowRight' || e.key === 'Enter') {
      if (wtStep === 0) wtShowStep(1);
      else if (wtStep >= WT_TOTAL) finishWalkthrough();
      else wtShowStep(wtStep + 1);
    }
    if (e.key === 'ArrowLeft' && wtStep > 1) wtShowStep(wtStep - 1);
    if (e.key === 'Escape' && wtStep > 0)    finishWalkthrough();
  });
}

// ── Wire into app boot ────────────────────────────────────────
// Patch the existing DOMContentLoaded load() call to trigger walkthrough
// after data loads. We patch by replacing the load() at the end of
// DOMContentLoaded with a version that calls initWalkthrough after.
const _loadPreWt = load;
load = async function() {
  await _loadPreWt();
  await initWalkthrough();
};

// Register event listeners immediately on DOMContentLoaded
document.addEventListener('DOMContentLoaded', initWalkthroughEvents);

// ════════════════════════════════════════════════════════════
//  PHASE 6A — SOUND ALERTS
//  Web Audio API — no files, no external deps.
//  Respects soundAlerts setting + quiet hours.
// ════════════════════════════════════════════════════════════

let _audioCtx = null;
function _getCtx() {
  if (!_audioCtx) _audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  return _audioCtx;
}

function _isQuietHours() {
  const qh = state.data?.settings?.quietHours;
  if (!qh?.enabled) return false;
  const h = new Date().getHours();
  const s = Number(qh.startHour ?? 0);
  const e = Number(qh.endHour   ?? 6);
  return s <= e ? (h >= s && h < e) : (h >= s || h < e);
}

function _tone(freq, duration, type = 'sine', vol = 0.28) {
  if (!state.data?.settings?.soundAlerts) return;
  if (_isQuietHours()) return;
  try {
    const ctx  = _getCtx();
    const osc  = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = freq;
    osc.type            = type;
    gain.gain.setValueAtTime(vol, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + duration);
  } catch(e) {}
}

const sounds = {
  // New pending trade — attention-grabbing double ascending ping
  tradeAlert:  () => {
    _tone(880, 0.10);
    setTimeout(() => _tone(1100, 0.13), 120);
  },
  // Auto-executed — softer confirmation
  autoExecute: () => {
    _tone(660, 0.08, 'sine', 0.18);
    setTimeout(() => _tone(880, 0.10, 'sine', 0.18), 90);
  },
  // Trade approved by user — rising three-note
  approved:    () => {
    _tone(660, 0.07, 'sine', 0.2);
    setTimeout(() => _tone(880,  0.07, 'sine', 0.2), 75);
    setTimeout(() => _tone(1100, 0.10, 'sine', 0.2), 150);
  },
  // Trade rejected by user — short low pulse
  rejected:    () => {
    _tone(240, 0.12, 'square', 0.14);
  },
  // Health warning — low sawtooth
  healthWarn:  () => {
    _tone(340, 0.22, 'sawtooth', 0.14);
  },
  // Health critical — descending three-note alarm
  healthCrit:  () => {
    _tone(440, 0.14);
    setTimeout(() => _tone(330, 0.14), 150);
    setTimeout(() => _tone(220, 0.22), 300);
  },
  // Bundle/coordinated activity — dissonant warning chord
  bundle:      () => {
    _tone(440, 0.18, 'sawtooth', 0.14);
    setTimeout(() => _tone(554, 0.18, 'sawtooth', 0.10), 40);
  },
};

// ── Wire sounds to app events ────────────────────────────────

// New trade arrives in feed
window.cg.on('trade', trade => {
  const decision = String(trade.decision || '').toUpperCase();
  if (decision === 'AUTO') sounds.autoExecute();
  else sounds.tradeAlert();
});

// Bundle detected
window.cg.on('trade-blocked', ({ reason }) => {
  if (reason?.toLowerCase().includes('bundle') ||
      reason?.toLowerCase().includes('coordin')) {
    sounds.bundle();
  }
});

// Health alerts
window.cg.on('health-alerts', alerts => {
  if (!Array.isArray(alerts)) return;
  const active = alerts.filter(a => !a.dismissed);
  if (active.some(a => String(a.severity || '').toLowerCase() === 'critical')) {
    sounds.healthCrit();
  } else if (active.length) {
    sounds.healthWarn();
  }
});

// Bundle flag on trade update
window.cg.on('trade-update', trade => {
  if (trade.bundleAlert?.detected) sounds.bundle();
});

// Patch handleFeedAction to fire sounds on approve/reject
const _handleFeedActionPreSound = handleFeedAction;
handleFeedAction = async function(btn) {
  const action = btn.dataset.feedAction;
  if (action === 'copy')   sounds.approved();
  if (action === 'skip')   sounds.rejected();
  return _handleFeedActionPreSound(btn);
};


// ════════════════════════════════════════════════════════════
//  PHASE 6B — KEYBOARD SHORTCUTS
// ════════════════════════════════════════════════════════════

let ksOverlayOpen = false;

function ksIsTyping() {
  const tag = document.activeElement?.tagName?.toLowerCase() || '';
  return ['input','textarea','select'].includes(tag) ||
         document.activeElement?.isContentEditable;
}

function ksToast(msg, color) {
  let el = document.getElementById('ks-toast-el');
  if (!el) {
    el = document.createElement('div');
    el.id        = 'ks-toast-el';
    el.className = 'ks-toast';
    document.body.appendChild(el);
  }
  el.textContent   = msg;
  el.style.color        = color;
  el.style.borderColor  = color;
  el.classList.add('show');
  clearTimeout(el._t);
  el._t = setTimeout(() => el.classList.remove('show'), 1300);
}

function ksToggleHelp() {
  ksOverlayOpen = !ksOverlayOpen;
  $('ks-overlay')?.classList.toggle('show', ksOverlayOpen);
}

function ksHideHelp() {
  ksOverlayOpen = false;
  $('ks-overlay')?.classList.remove('show');
}

// ── Approve / reject top pending trade ───────────────────────
async function ksActOnTopPending(action) {
  // action: 'copy' | 'skip'
  const pending = feedTrades().filter(needsAction);
  if (!pending.length) {
    ksToast('No pending trades', 'var(--muted)');
    return;
  }
  const top  = pending[0];
  const card = document.querySelector(`[data-trade-id="${CSS.escape(top.id || '')}"]`);
  const btn  = card?.querySelector(`[data-feed-action="${action}"]`);
  if (btn && !btn.disabled) {
    btn.click();
    ksToast(
      action === 'copy' ? '✓ Copied' : '✕ Skipped',
      action === 'copy' ? 'var(--green)' : 'var(--red)'
    );
  } else {
    // Card not in DOM (different page) — execute directly
    if (action === 'copy') {
      sounds.approved();
      const res=await window.cg.approveTrade(top);
      if(!res?.ok){ksToast(res?.error||'CopyGuard blocked this preparation','var(--red)');return;}
      feedUi.liveTrades.delete(top.id);
      await load();
      renderFeed();
      ksToast('✓ Prepared · confirm in Padre', 'var(--green)');
    } else {
      sounds.rejected();
      await window.cg.rejectTrade(top);
      feedUi.liveTrades.delete(top.id);
      await load();
      renderFeed();
      ksToast('✕ Skipped', 'var(--red)');
    }
  }
}

// ── Navigation shortcuts ──────────────────────────────────────
const ksNavMap = {
  'f': 'feed',
  'w': 'wallets',
  'p': 'padre',
  'e': 'earlybird',
  'g': 'ghost',
  'l': 'leaderboard',
  'i': 'intelligence',
};

// ── Global keydown listener ───────────────────────────────────
document.addEventListener('keydown', async e => {
  // Never fire while the user is typing
  if (ksIsTyping()) return;

  // Modifiers = bail (allow browser/OS shortcuts)
  if (e.ctrlKey || e.metaKey || e.altKey) return;

  const key = e.key.toLowerCase();

  // Walkthrough is open — let its own handler run
  const wtShell = $('wt-shell');
  if (wtShell && !wtShell.classList.contains('gone')) return;

  switch (key) {
    case 'a':
      e.preventDefault();
      ksActOnTopPending('copy');
      break;

    case 'r':
      e.preventDefault();
      ksActOnTopPending('skip');
      break;

    case '/':
      e.preventDefault();
      go('research');
      // Focus search input after nav
      setTimeout(() => $('research-query')?.focus(), 120);
      break;

    case '?':
      e.preventDefault();
      ksToggleHelp();
      break;

    case 'escape':
      // Priority: close tc modal > close walkthrough > close ks overlay
      if ($('tc-backdrop')?.classList.contains('show')) {
        closeTrustedConfigModal();
      } else if (ksOverlayOpen) {
        ksHideHelp();
      }
      break;

    default:
      // Navigation shortcuts
      if (ksNavMap[key]) {
        e.preventDefault();
        go(ksNavMap[key]);
      }
      break;
  }
});

// ── Init shortcut overlay controls ───────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  $('ks-close')?.addEventListener('click', ksHideHelp);
  $('ks-overlay')?.addEventListener('click', e => {
    if (e.target === $('ks-overlay')) ksHideHelp();
  });

  // Show a subtle shortcut hint in the footer of the feed side
  const feedNote = document.querySelector('.feed-side .feed-note');
  if (feedNote) {
    const hint = document.createElement('div');
    hint.className = 'feed-side-card feed-note';
    hint.innerHTML = '<b>KEYBOARD SHORTCUTS</b><p>Press <kbd style="background:#0f1a25;border:1px solid #1f3248;border-radius:3px;padding:1px 4px;font-size:9px">?</kbd> for the shortcuts overlay. <kbd style="background:#0f1a25;border:1px solid #1f3248;border-radius:3px;padding:1px 4px;font-size:9px">A</kbd> approve · <kbd style="background:#0f1a25;border:1px solid #1f3248;border-radius:3px;padding:1px 4px;font-size:9px">R</kbd> reject · <kbd style="background:#0f1a25;border:1px solid #1f3248;border-radius:3px;padding:1px 4px;font-size:9px">F W P /</kbd> navigate.</p>';
    feedNote.after(hint);
  }
});

// ════════════════════════════════════════════════════════════
//  PHASE 8 — GHOST MODE DASHBOARD INTEGRATION
// ════════════════════════════════════════════════════════════

// ── Render ghost summary panel on Dashboard ───────────────────
function renderGhostDashPanel() {
  const gs = state.data?.ghostSummary;
  const gp = state.data?.ghostPerformance || {};

  // Update stat numbers
  const testing   = $('ghost-dash-testing');
  const qualified = $('ghost-dash-qualified');
  const live      = $('ghost-dash-live');
  const trades    = $('ghost-dash-trades');

  if (!gs) {
    if (testing)   testing.textContent   = '0';
    if (qualified) qualified.textContent = '0';
    if (live)      live.textContent      = '0';
    if (trades)    trades.textContent    = '0';
    return;
  }

  if (testing)   testing.textContent   = gs.testing;
  if (qualified) {
    qualified.textContent = gs.qualified;
    qualified.className   = gs.qualified > 0 ? 'positive' : '';
  }
  if (live) {
    live.textContent = gs.liveActivated;
    live.className   = gs.liveActivated > 0 ? 'positive' : '';
  }
  if (trades) trades.textContent = gs.totalSimulatedTrades;

  // Render the top candidates list
  const box = $('ghost-dash-candidates');
  if (!box) return;

  const wallets   = state.data?.wallets || {};
  const gpEntries = Object.entries(gp)
    .filter(([addr, g]) => g.status !== 'STOPPED' && wallets[addr])
    .sort((a, b) => {
      // Qualified first, then by progress
      const qa = a[1].qualified ? 1 : 0, qb = b[1].qualified ? 1 : 0;
      if (qb !== qa) return qb - qa;
      return Number(b[1].progressPct || 0) - Number(a[1].progressPct || 0);
    })
    .slice(0, 4);

  if (!gpEntries.length) {
    box.innerHTML = `<div style="font-size:10px;color:var(--muted);padding:6px 2px">
      No active ghost sessions · <a style="color:var(--purple);cursor:pointer" data-jump="ghost">Start one →</a>
    </div>`;
    return;
  }

  box.innerHTML = gpEntries.map(([addr, g]) => {
    const w      = wallets[addr] || {};
    const label  = esc(w.label || shortAddr(addr));
    const init   = walletInitial(w, addr);
    const pct    = Math.round(Number(g.progressPct || 0));
    const stateLabel = g.liveActivated ? 'LIVE' : g.qualified ? 'QUALIFIED' : 'TESTING';
    const stateCls   = g.liveActivated ? 'live' : g.qualified ? 'qualified' : 'testing';

    return `<div class="ghost-dash-row" style="cursor:pointer" data-jump="ghost">
      <div class="ghost-dash-avatar">${esc(init)}</div>
      <div>
        <b>${label}</b>
        <small>${
          Number(g.completedTrades||0) > 0
            ? `${g.completedTrades} completed · ${Number(g.winRatePct||0).toFixed(0)}% WR`
            : Number(g.openPositions||0) > 0
              ? `${g.openPositions} open position${g.openPositions>1?'s':''} · waiting for sell`
              : Number(g.totalSignals||0) > 0
                ? `${g.totalSignals} signal${g.totalSignals>1?'s':''} received · no price yet`
                : 'Waiting for trades…'
        }</small>
      </div>
      <span class="ghost-dash-prog">${pct}%</span>
      <span class="ghost-dash-state ${stateCls}">${stateLabel}</span>
    </div>`;
  }).join('');
}

// ── Patch renderDashboard to include ghost panel ──────────────
const _renderDashPreGhost = renderDashboard;
renderDashboard = function() {
  _renderDashPreGhost();
  renderGhostDashPanel();
};

// ── Surface ghost data in load() ─────────────────────────────
// ghost-update event from main — refresh ghost data in state
window.cg.on('ghost-update', async () => {
  // Targeted: refresh just ghost data + re-render affected components
  try {
    const data = await window.cg.getAllData();
    if (state.data) {
      state.data.ghostSummary     = data.ghostSummary;
      state.data.ghostPerformance = data.ghostPerformance;
    }
    renderGhostDashPanel();
    renderLeaderboard();
    renderDashboard();
    if (currentPage === 'ghost') refreshGhost16();
  } catch(e) {}
});
