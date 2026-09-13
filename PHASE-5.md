# CopyGuard 2.4.0 — Phase 5: Live Trade Command Feed

Phase 5 adds the dedicated watched-wallet trade command center.

## Added
- Full Live Feed workspace wired to live `trade` / `trade-update` backend events and saved history
- Trade cards with wallet tier, token, size, liquidity, FDV, time and wallet performance
- CopyGuard preliminary risk score with bundle, authority, liquidity, FDV and size signals
- AI guidance display using the existing analysis payload and configured provider state
- Search, filter and sort controls
- Needs Action queue for Pending-wallet trades
- Risk Signals side panel
- COPY, SKIP, RESEARCH and OPEN IN PADRE actions
- Live feed badge and live-stream state
- Dashboard remains synchronized with feed decisions

## Execution boundary
A manual COPY action records the approval and opens the token in Padre, but does not click Padre's final buy/sell confirmation. The user confirms the trade in Padre. Trusted-wallet automation remains isolated for the later automation/risk phase.

## Deferred
- Full multi-factor AI scoring model: Phase 6
- Dedicated Research results UI: Phase 7
- Position lifecycle UI: Phase 8
- Trusted automation and hard kill switch: Phase 9
