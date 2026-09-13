# CopyGuard Phase 6 — AI Trade Analysis Engine

Version: 2.5.0

Phase 6 adds a layered trade-analysis system.

## Added
- Deterministic CopyGuard risk score (0-100) independent of AI availability.
- Five risk components: token safety, market/liquidity, wallet quality, coordination, and exposure.
- Explicit risk flags and positive signals.
- Hard-block conditions for critical token/control or coordination risks.
- AI second-opinion analysis with normalized COPY / CAUTION / SKIP output.
- AI confidence, risk level, reasoning and flags.
- Manual ANALYZE action on every trade card to refresh enrichment, risk and AI analysis.
- Expandable per-trade risk breakdown in the Live Feed.
- Trusted legacy auto-execution cannot override a Phase 6 deterministic hard block.
- Manual COPY remains prepare-only and still requires final confirmation inside Padre.

## Architecture rule
AI is advisory. CopyGuard deterministic safety rules are authoritative for hard blockers.

## Deferred
Phase 7 builds the dedicated Research Center. Phase 9 builds the explicit trusted-wallet automation controls and emergency execution kill switch.
