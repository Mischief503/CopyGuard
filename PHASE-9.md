# CopyGuard Phase 9 — Trusted Wallet Automation

Version: 2.8.0

Phase 9 adds the dedicated Automation Control Center and hardens trusted-wallet execution.

## Added
- Dedicated Automation navigation page.
- Persistent global auto-execute enable/disable state.
- Persistent emergency automation pause that overrides all trusted-wallet profiles.
- Per-wallet enabled/disabled automation profiles.
- Sizing modes: fixed SOL, percent balance, AI weighted, fractional Kelly.
- Global and wallet-specific max SOL per trade.
- Max daily trades and max daily realized loss limits.
- Max concurrent positions limit.
- Maximum deterministic CopyGuard risk-score gate.
- Minimum liquidity and maximum FDV gates.
- Optional required AI approval, minimum AI confidence, and COPY-only mode.
- Take-profit, stop-loss, and trailing-stop profile fields.
- Daily automation stats surfaced in the control center.
- Trusted wallets without an enabled profile remain manual.

## Execution order
1. Wallet must be Trusted.
2. Global Auto Execute must be enabled.
3. Emergency Pause must be released.
4. Wallet must have an enabled automation profile.
5. CopyGuard deterministic hard blockers run.
6. Risk/liquidity/FDV limits run.
7. Daily/concurrent limits run.
8. Required AI gate runs when configured.
9. Position sizing is calculated and capped.
10. Trade is handed to the Padre execution bridge.

## Safety behavior
AI cannot override CopyGuard hard blocks. If AI approval is required and the configured provider has no usable API key, the automated trade is blocked. Emergency Pause persists across restarts.
