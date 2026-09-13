# CopyGuard v2.7.0 — Phase 8: Positions + P&L Center

Phase 8 turns the existing position tracker into a full portfolio workspace.

## Added
- Dedicated Positions + P&L page with Open, Closed, and All Activity views.
- Search and sorting by recency, size, hold duration, and performance.
- Persistent closed-position ledger (`closed_positions.json`) for new closes.
- Richer position lots: token quantity, token symbol/name, entry price snapshot, wallet attribution, decision source, and TP/SL metadata when available.
- Current-market quote refresh through DexScreener for up to 30 open token mints at a time.
- Unrealized USD P&L only when reliable entry-price/quantity data exists; legacy positions show unavailable rather than fabricated values.
- Realized SOL P&L, closed-lot win rate, average hold time, best/worst lot, and portfolio summaries.
- Position detail panel with Copy Contract, Research, and Open in Padre handoffs.
- CSV export for open and closed position records.
- Live refresh when a position closes.

## Compatibility
Existing `positions.json`, wallets, settings, history, research, Padre session, and prior Phase 1–7 data remain compatible. Older position lots may not contain token quantity or entry-price snapshots, so unrealized market P&L is intentionally not estimated for those lots.
