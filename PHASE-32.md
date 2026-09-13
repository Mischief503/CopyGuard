# Phase 32 — Execution Safety & Full Logic Audit

CopyGuard v4.9.0 closes the logic build with fail-closed execution semantics.

## Execution state model
- `PREPARED`: manual COPY only; user must confirm in Padre. No live position, P&L, win/loss, or execution-success accounting is created.
- `RESERVED`: Trusted automation has persistently claimed one authoritative source event before touching Padre.
- `SUBMITTED_UNVERIFIED`: Padre DOM reported a submit/confirm click. This is not represented as blockchain settlement.
- `FAILED` / `BLOCKED`: submission failed or a deterministic safety gate prevented it.

## One-shot source execution
Trusted automation is keyed by the Phase 19 source transaction event. A source event that already has any execution state is never automatically re-submitted after reconnect or restart.

## Stale/recovery protection
Live automation requires a source signature, chain timestamp, observation timestamp, signal age <= 60 seconds, observation latency <= 45 seconds, and for BUYs a token-specific market quote <= 120 seconds old that is not a degraded cache fallback.

## Padre fail-closed automation
Token address, action, size, tab, amount field, amount acceptance, and a distinct enabled submit/confirm control are all required. Missing DOM controls abort the attempt.

## Emergency pause race guard
The main process rechecks the pause immediately before dispatch and injects a pause flag into Padre. The in-page automation rechecks that flag after navigation, after tab selection, after amount entry, and immediately before the final click.

## Accounting boundary
CopyGuard does not claim blockchain confirmation from a Padre DOM click. The execution ledger is an audit record of intent/submission state; verified on-chain evidence must come from blockchain observation.
