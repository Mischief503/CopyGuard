# Phase 50 — Live Feed & Trade Review UI

CopyGuard v4.27.0 upgrades the Live Feed into a source-first trade review workspace without changing execution authority.

Each trade card now separates:
- blockchain/source transaction time;
- observation time and observation latency;
- signal age;
- source signature/recovery state;
- transaction execution-price evidence and its source/confidence;
- later/current market price and quote age/quality;
- deterministic risk authority;
- AI advice as a separate advisory layer;
- automated/live eligibility warnings;
- wallet/token/liquidity/FDV context.

The feed explicitly distinguishes transaction execution price from later market quotes. A missing execution price remains UNKNOWN rather than being backfilled from a current quote.

The UI mirrors Phase 32 safety semantics: source signature, chain time, observation latency, stale signals, recovered observations, stale/degraded BUY quotes, and automated SELL limitations are visible before review. These indicators are explanatory UI; the backend Phase 32 gates remain authoritative.

Manual COPY remains preparation-only. The action label is now PREPARE COPY and the execution-doctrine panel explicitly states that a prepared trade is not a fill, position, or realized P&L. Final Padre confirmation remains manual and blockchain settlement remains a separate state.

The right-side review rail now summarizes pending reviews, signature coverage, average observation latency, late signals, recovered signals, current risk flags, and execution doctrine.
