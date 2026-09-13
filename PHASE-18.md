# Phase 18 — Unified Helius Observation Engine

Version: **3.5.0**

## Goal

Make on-chain observation reliable enough that every CopyGuard subsystem consumes the same transaction truth. Phase 18 does not attempt to fully classify every complex Solana transaction; that belongs to Phase 19. It guarantees ingestion, recovery, deduplication, ordering, and health visibility.

## Logic

1. Attempt Helius Enhanced WebSocket `transactionSubscribe` on Atlas for low-latency full transactions.
2. If the enhanced subscription is rejected or not confirmed, switch to standard Helius WebSocket `logsSubscribe`.
3. Independently poll every non-blacklisted watched wallet every 20 seconds with `getSignaturesForAddress`.
4. Persist wallet cursors and processed signatures to `helius_observation.json`.
5. On a gap, page up to ten 100-signature pages and recover unseen transactions oldest-to-newest.
6. Fetch complete transactions with `getTransaction`.
7. Convert a detected swap into the common observed-trade shape and send it through one `ingestObservedTrade()` gate.
8. Mark the signature before asynchronous enrichment/risk/AI work to prevent WebSocket/poll races from double-entering the pipeline.
9. Continue observation for Pending, Ghost, Trusted, Paused and other monitored tiers except Blacklisted. Ghost qualification still requires 30 completed fake outcomes.
10. Expose health telemetry and manual polling from Settings.

## Recovery Rules

- Existing monitored wallets with no Phase-18 cursor baseline at the current latest signature. Historical activity is not replayed into live execution.
- An active Ghost profile may recover transactions only from its own test start time forward.
- A transaction that fails to fetch is not marked seen, so a later poll can retry it.
- A successfully fetched non-trade transaction is marked seen to avoid endless refetching.
- Downstream pipeline failures remain logged and are not automatically replayed as duplicate execution attempts.

## Persistence

`helius_observation.json` stores per-wallet initialization state, latest signature/slot, up to 5,000 recent signatures, counts, timestamps, errors, and a bounded observation event ledger. It is included in portable CopyGuard backup/restore.

## Security / Execution Boundary

Observation never directly calls Padre. It only produces evidence for `processTrade()`. Existing Risk Engine, Shadow routing, automation gates, and Padre execution boundaries remain downstream.
