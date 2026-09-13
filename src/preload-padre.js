'use strict';
// ══════════════════════════════════════════════════════════════
//  CopyGuard — Padre Terminal Preload
//  Runs inside the Padre BrowserView's renderer process.
//
//  Responsibilities:
//   1. Report DOM-ready and page-load status back to main
//   2. Confirm trade execution scripts succeeded or failed
//   3. Expose a minimal window.__cg bridge so injected scripts
//      can report results without needing Node access
//   4. Block all navigation away from padre.gg domains
//
//  Security contract:
//   • contextIsolation: true  — this world is isolated from
//     Padre's own JavaScript. window.__cg is not visible to
//     Padre's page scripts.
//   • No Node.js APIs exposed
//   • ipcRenderer used only for sending TO main, never
//     exposing receive channels that Padre could exploit
// ══════════════════════════════════════════════════════════════

const { contextBridge, ipcRenderer } = require('electron');

// ── Expose a minimal one-way bridge to main process ────────────
// Injected scripts (executeTrade, setPadreTPSL) use these to
// report back without needing any Node.js access themselves.
contextBridge.exposeInMainWorld('__cg', {
  // Report a trade execution result back to CopyGuard
  tradeResult: (result) => {
    ipcRenderer.send('padre-trade-result', result);
  },
  // Report a TP/SL injection result
  tpslResult: (result) => {
    ipcRenderer.send('padre-tpsl-result', result);
  },
  // Report any error that happened during script injection
  reportError: (context, message) => {
    ipcRenderer.send('padre-script-error', { context, message, url: location.href });
  },
  // Let main know the Padre DOM is interactive and ready
  domReady: () => {
    ipcRenderer.send('padre-dom-ready', { url: location.href, ts: Date.now() });
  },
});

// ── Signal DOM ready to main ────────────────────────────────────
// executeTrade navigates then waits 3s — this lets main know
// the page is actually interactive before injection runs.
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    ipcRenderer.send('padre-dom-ready', { url: location.href, ts: Date.now() });
  });
} else {
  // Already loaded (e.g. SPA navigation)
  ipcRenderer.send('padre-dom-ready', { url: location.href, ts: Date.now() });
}

// ── Block navigation away from padre.gg ────────────────────────
// Belt-and-suspenders alongside normalizePadreUrl in main.
// If somehow a link gets clicked that would leave padre.gg,
// we stop it here before it loads.
window.addEventListener('click', (e) => {
  const a = e.target.closest('a[href]');
  if (!a) return;
  const href = a.getAttribute('href') || '';
  if (!href || href.startsWith('#') || href.startsWith('/')) return;
  try {
    const url = new URL(href, location.href);
    const host = url.hostname;
    if (host !== 'trade.padre.gg' && !host.endsWith('.padre.gg')) {
      e.preventDefault();
      e.stopPropagation();
      // Send to main to open in the system browser instead
      ipcRenderer.send('padre-external-link', url.toString());
    }
  } catch { /* malformed href — ignore */ }
}, true);
