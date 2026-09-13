# Phase 29 — Closed-Loop Learning Engine

Version: 4.6.0

## Objective

Close the evidence loop between what CopyGuard predicted or flagged and what later happened in fully source-verified Shadow outcomes. No external model is retrained and no deterministic threshold is silently changed.

## Contracts

- Only `sourceVerified === true` completed outcomes enter the learning dataset.
- Exact entry transaction signature is the strongest correlation key; wallet/token/time matching is secondary.
- Specialized AI decisions are scored by task, recommendation and provider.
- Deterministic Risk Engine flags are correlated with verified P&L/return outcomes.
- Breakeven and neutral recommendations are retained but excluded from directional accuracy.
- A minimum of 10 verified samples is required before a tuning proposal is emitted.
- Proposals are advisory-only and never mutate hard blocks, qualification thresholds, Trusted state, or live execution.
- Learning data persists in `closed_loop_learning.json` and participates in backup/restore.

## Outputs

The engine maintains linked outcome records, per-task accuracy, recommendation calibration, provider/task statistics, risk-signal performance and advisory proposals such as `STRENGTHEN_SIGNAL`, `REVIEW_FALSE_POSITIVE`, and `AI_CALIBRATION_REVIEW`.
