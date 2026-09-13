# Phase 52 — Positions & Portfolio Accounting UI

CopyGuard v4.29.0 turns Positions into a strict accounting workspace.

## Accounting layers
- **Verified Outcomes** — only fully closed, source-verified Shadow outcomes. This is the authoritative realized-performance layer used by qualification and learning.
- **Open Shadow** — simulated open/partially realized lots with original stake, remaining stake, realized-so-far, unrealized mark, cost basis, entry source, and partial realization history.
- **Execution States** — PREPARED and Phase 32 execution-attempt records including RESERVED, SUBMITTED_UNVERIFIED, FAILED, BLOCKED, and UNCERTAIN_AFTER_PAUSE states. These do not become realized P&L without independent settlement evidence.
- **Operational** — older/open/closed operational position records shown separately as unverified accounting context.

## UI
The workspace now shows verified realized P&L, verified close count, open Shadow exposure, unrealized Shadow P&L, marked equity, chronological max drawdown, recent trend, wallet/token attribution, source transaction signatures, entry/exit prices, partial exits, and state-specific authority banners.

Source signatures link to Solscan for inspection. Missing signatures remain UNKNOWN.

Manual PREPARED records explicitly show accountingCommitted=false. SUBMITTED_UNVERIFIED remains visibly distinct from settlement.

The UI is read-only with respect to accounting truth: it does not execute, settle, promote, or mutate performance records.
