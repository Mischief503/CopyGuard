# Phase 12 — Risk & Anti-Manipulation Engine

CopyGuard v2.11.0 centralizes deterministic protection into Risk Engine v2.

## Added
- Dedicated Risk Center page and persistent risk-event ledger.
- 0–100 risk score with token control, market/liquidity, holder concentration, wallet quality, coordination, provenance, and exposure components.
- Hard deterministic overrides for active freeze authority, active mint authority, critically low liquidity, liquidity/FDV trap conditions, extreme holder concentration, and severe watched-wallet clustering.
- Helius holder concentration analysis using token largest-account and supply RPC data when configured.
- Same-ticker copycat/provenance heuristics using current DexScreener candidates.
- Abnormal 1h/24h momentum and buy/sell imbalance signals.
- Local wallet-cluster and repeated-cohort evidence from CopyGuard trade history.
- Manual exact-mint risk scanner with Research and Padre handoffs.
- Elevated risk events persist in risk_events.json.

## Safety model
AI remains advisory. A deterministic hard block forces SKIP and cannot be overridden by AI or Trusted-wallet status.
