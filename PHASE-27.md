# Phase 27 — Wallet Discovery Engine

CopyGuard 4.4.0 replaces the two-launch discovery shortcut with persistent repeatability-first discovery.

- Persistent `wallet_discovery.json` evidence ledger.
- Requires at least 3 independent token appearances before a candidate can clear the one-hit gate.
- Scores rank, seconds-from-launch, reconstruction confidence, repeatability and observed token opportunity.
- Detects high-overlap wallet cohorts and applies a cluster penalty instead of treating coordinated wallets as independent evidence.
- One-hit wonders remain recorded for audit but are not surfaced as actionable suggestions.
- `SHADOW_READY` means discovery evidence is strong enough for Shadow review; it never means Trusted.
- Discovery and health timers are owned by the Electron lifecycle and stop on quit.
- Discovery ledger participates in backup/restore.
- Up to 5 strongest unclustered `SHADOW_READY` candidates per scan auto-route into 30-outcome Ghost testing.
