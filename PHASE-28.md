# Phase 28 — Specialized AI Engine

Version: 4.5.0

Phase 28 separates AI into six evidence-scoped advisory tasks: Trade Analysis, Wallet Qualification, Early Bird, Token Research, Risk Explanation, and Wallet Discovery. Deterministic hard blocks and lifecycle rules remain authoritative. AI cannot promote wallets, re-enable live execution, or override a hard block. All AI decisions are persisted in `ai_decisions.json` with task, provider, subject, deterministic context, recommendation, confidence, override flag, and error state.

## Safety architecture

- Structured evidence envelope version 4.
- Explicit task-specific JSON schemas.
- UNKNOWN/UNAVAILABLE evidence must remain unknown.
- Risk Explanation is forced to echo the deterministic Risk Engine v3 decision.
- Discovery is capped at SHADOW_REVIEW.
- Early Bird is capped at SHADOW_TEST.
- Wallet Qualification cannot promote or enable Trusted execution.
- Trade AI remains advisory and hard blocks force SKIP.
