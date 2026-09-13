# CopyGuard 2.1.0 — Phase 2: Control Center Dashboard

Phase 2 turns the Phase 1 shell into a live CopyGuard command center while preserving the existing backend engines.

## Added
- Full-width operational dashboard
- Live wallet-tier totals (trusted / pending / paused / blacklisted)
- Open-position count and tracked SOL exposure
- Today's trade activity, copied trades, and blocked/rejected counts
- AI provider and API-key readiness state
- Helius connection state
- Recent trade stream using persisted trade history
- Risk Watch panel using health alerts and bundle-detection data
- Core service health panel
- Wallet trust-distribution visualization
- Trusted automation status, global max size, configured trusted-wallet rules, and daily auto-trade count
- Live renderer refreshes for wallet stats, Helius status, trades, health alerts, and blocked trades
- Responsive navigation shell refinements
- Updated application version to 2.1.0 / Phase 2

## Intentionally deferred
The feature pages remain phase placeholders according to the approved 15-phase plan. Padre Terminal is still intentionally dormant until Phase 3, where it receives its dedicated embedded workspace.

## Validation
- renderer/app.js syntax checked with Node
- src/main.js syntax checked with Node
- src/preload.js syntax checked with Node
