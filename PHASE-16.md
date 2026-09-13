# Phase 16 — Ghost Trade Qualification Engine

CopyGuard 3.1.0 introduces a paper-copy qualification layer between Pending and Trusted.

## Core behavior
- Ghost Mode never sends an order to Padre.
- BUY signals open simulated lots at observed token price plus configured buy slippage.
- SELL signals close matching simulated lots at observed price minus sell slippage and simulated fees.
- Deterministic hard blocks can skip unsafe ghost entries when enabled.
- Results persist in `ghost_trades.json`.

## Qualification gates
Default gates are 30 completed trades, 65% win rate, positive ROI (1% default minimum), profit factor >= 1.5, max drawdown <= 15%, and hard-block rate <= 10%. All are configurable per wallet.

## Live transition
A qualified wallet can be explicitly promoted to Trusted automation. Optional auto-live is disabled by default and requires explicit per-wallet opt-in. Even after promotion, live execution still requires global automation enabled, emergency pause released, and all Phase 9/12 AI, risk, liquidity, daily-loss and position gates to pass.
