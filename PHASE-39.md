# Phase 39 — Trade Decision Assistant

CopyGuard v4.16.0 adds an explainable Trade Decision Assistant for observed wallet signals.

The assistant correlates the Phase 19 source transaction/event, Phase 20 execution-price evidence and current market snapshot, Phase 37 wallet scorecard, Phase 38 token dossier, Phase 26 deterministic risk decision, and the matching Phase 28 Trade AI audit decision.

Trade decisions explicitly calculate signal age, observation latency, market age, pricing source/confidence, and live-safety blockers. Stale/recovered observations are not presented as live opportunities. BUY analysis requires fresh non-degraded market evidence for live eligibility. Automated SELL remains fail-closed without authoritative own-wallet holding/fill evidence.

Phase 28 Trade AI is advisory. Deterministic hard blocks and Phase 32 execution safety remain authoritative. Padre submission is never described as blockchain settlement.
