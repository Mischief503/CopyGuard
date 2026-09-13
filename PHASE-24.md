# Phase 24 — Early Bird Reconstruction Engine

Phase 24 reconstructs token history toward launch instead of treating a recent transaction window as the beginning of trading.

- Paginates Helius signature history (up to 2,500 signatures by default).
- Records whether history reached the chain-history end or was truncated.
- Uses DEX pair creation as the preferred launch/trading anchor, with oldest observed token transaction as fallback.
- Identifies buyers from actual inbound target-token transfers, never fee payer alone.
- Derives entry-price evidence from USDC/USDT, WSOL, or native SOL transaction flows when available.
- Stores buyer rank, source signature, entry timestamp, seconds after launch, and reconstruction confidence.
- Scores timing using both entry rank and clock time from launch.
- Strong repeat candidates continue into 30-outcome Shadow qualification; historical early behavior does not equal verified profitability.
- Background scheduler is lifecycle-managed and stopped on application quit.
- Reconstruction data is persisted in earlybird_reconstruction.json and included in backup/restore.
