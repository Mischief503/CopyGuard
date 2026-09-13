# Phase 54 — Automation Control Center UI

CopyGuard v4.31.0 redesigns Trusted automation as the live-control workspace while preserving all Phase 32 execution authority and safety behavior.

The Automation workspace now centers on:
- master execution state and emergency pause;
- system mode, Helius observation, market-pricing, Padre, and Phase 32 safety status;
- enabled/configured Trusted profiles;
- daily automated trade and loss usage;
- global SOL and risk ceilings;
- recent Phase 32 execution states;
- system eligibility gates;
- per-wallet dynamic qualification state;
- effective armed/not-armed status;
- position sizing mode and wallet-specific maximum size;
- daily trade/loss and concurrent-position caps;
- minimum liquidity and optional maximum FDV;
- optional AI approval/confidence gates;
- take-profit, stop-loss, and trailing-stop configuration.

Deterministic Risk Engine and Phase 32 execution-safety gates remain authoritative. AI can add an extra gate but cannot waive a deterministic block. Recovered or stale signals remain observation-only. Automated SELL remains fail-closed until authoritative own-wallet holding/fill evidence exists.

Emergency pause is visually elevated and remains the highest-priority operator control. A Trusted wallet without an enabled automation profile stays manual.

No new execution authority was added in Phase 54.
