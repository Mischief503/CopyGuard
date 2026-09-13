# Phase 22 — Verified Outcome Engine

CopyGuard v3.9.0 makes Shadow qualification outcome-driven and auditable.

- Only fully closed lots with `completedOutcome:true` enter the outcome sample.
- Open positions and partial realized P&L remain portfolio information and cannot improve qualification ROI, win rate, profit factor, expectancy or drawdown.
- Every completed outcome is normalized into `verified_outcomes.json` with wallet, lot, token, entry/exit transaction signatures, chain timestamps, observation timestamps, simulated prices, stake, P&L, return and hold time.
- Source verification requires both entry and exit transaction linkage plus price evidence. Legacy/incomplete outcomes stay visible but fail the 100% evidence-coverage qualification check.
- Metrics include wins, losses, breakevens, win rate, decisive win rate, ROI, gross profit/loss, profit factor, expectancy, average winner/loser, payoff ratio, chronological max drawdown and win/loss streaks.
- Observation latency is measured on both entry and exit, with average, p50, p95, maximum, 20-second on-time rate and on-time-outcome P&L.
- Max drawdown is reconstructed chronologically from completed outcomes rather than mutable portfolio snapshots.
- Ghost sample reset removes that wallet's verified outcome records.
- Verified outcomes participate in backup/restore.

Qualification is now based on completed evidence, not approvals, partial exits, open-position markups or mutable estimates.
