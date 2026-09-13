# Phase 19 — Transaction Interpretation Engine

Version: **3.6.0**

Phase 19 makes every on-chain transaction a timestamped, persistent parent record and links every Shadow action back to it.

## Idempotency contract

- Solana signature is the unique parent transaction ID.
- Child interpreted event key is `signature + wallet + token + BUY/SELL`.
- Both blockchain `blockTime` and CopyGuard `observedAt` are persisted.
- Shadow actions persist `sourceTransactionId`, `sourceSignature`, `sourceEventKey`, `chainTimestamp`, and `observedAt`.
- Before creating a fake trade, CopyGuard checks both transaction-ledger state and the Ghost ledger for an existing source event.
- WebSocket, 20-second polling, recovery replay, and restart therefore converge on one Shadow action rather than duplicating it.
- One parent transaction may still contain multiple legitimate token legs; child event keys keep those distinct.

The source Transaction Log is visible in Ghost Mode and links signatures to Solscan for inspection.
