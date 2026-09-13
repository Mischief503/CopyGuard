# Phase 21 — Shadow Portfolio Engine

CopyGuard v3.8.0 makes Shadow qualification portfolio-accounting aware.

- Every observed BUY creates a transaction-linked Shadow lot.
- Multiple buys of the same mint remain individually auditable lots.
- SELL transactions use the watched wallet's on-chain `tokenAmount / preTokenAmount` to derive the sold fraction.
- Partial sells close that fraction of every matching Shadow lot, realize proportional P&L, and preserve the remaining cost basis.
- A partial realization never increments the qualification sample. Only a fully closed lot becomes one completed outcome.
- Open-lot mark-to-market uses remaining stake, preventing previously sold exposure from continuing to generate unrealized P&L.
- Ghost statistics separate completed outcomes, partial realized P&L, unrealized P&L, remaining exposure, available cash, open tokens and partial realizations.
- Shadow BUYs are rejected when simulated cash is insufficient; the portfolio cannot spend more capital than it owns.
- Per-token portfolio aggregates expose remaining lots and weighted average entry price.
- Every realization keeps the Phase 19 transaction signature, blockchain timestamp and observation timestamp.

The result is a restart-persisted audit chain from real transaction -> Shadow lot -> partial realizations -> fully closed outcome.
