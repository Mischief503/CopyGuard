# Phase 23 — Dynamic Wallet Qualification Engine

CopyGuard now treats trust as a continuously verified state rather than permanent graduation.

- Initial promotion still requires the complete Phase 22 verified-outcome qualification gate.
- Promoted wallets keep passive Shadow simulation while live execution remains a separate route.
- A rolling 10-outcome window watches win rate, ROI, profit factor, consecutive losses, drawdown, and source-evidence coverage.
- Warning and severe bands use hysteresis: severe degradation must be confirmed twice before automatic pause.
- Auto-paused wallets have their Trusted automation profile disabled and cannot place automatic orders.
- Recovery requires three healthy evaluations and never silently resumes real trading; the wallet returns to Qualified and must be explicitly promoted again.
- Every trust-state transition is persisted in `wallet_qualification.json` with the metrics that caused it.
