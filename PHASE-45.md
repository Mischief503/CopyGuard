# Phase 45 — Governed Assistant Actions

CopyGuard v4.22.0 introduces the first narrowly permitted assistant actions.

Allowed governed actions:
- OPEN_PADRE_TOKEN — navigate the dedicated persistent Padre BrowserView to the reviewed token.
- POPULATE_PADRE_DRAFT — select BUY and populate an explicitly user-supplied positive SOL size.

The action chain is deliberately multi-stage:
PREPARE request → proposal → explicit proposal confirmation → Safe Preparation → governed-action record → second explicit confirmation → fresh deterministic safety re-check → pre-submit Padre action.

Every governed action expires after five minutes and is audited.

Hard boundaries remain absolute. The assistant cannot click Padre's final confirm/submit control, cannot call executeTrade, cannot reserve a Phase 32 execution attempt, cannot automate SELL drafts, cannot change configuration, cannot enable Trusted automation, cannot promote wallets, and cannot override deterministic risk.

Emergency pause, degraded connection mode, deterministic hard blocks, missing Padre, invalid sizing, or stale/invalid proposal state fail closed.

A completed Phase 45 action is recorded as COMPLETED_PRE_SUBMIT with tradeSubmitted=false and executionAttemptId=null.
