# Phase 51 — Wallet Management & Qualification UI

CopyGuard v4.28.0 upgrades Wallet Management into a verified qualification console.

Each selected wallet now shows:
- current trust tier;
- Wallet Analyst grade;
- dynamic qualification state;
- deterministic Shadow qualification progress;
- source-verified completed outcomes;
- verified win rate, ROI, profit factor, max drawdown, and verification coverage;
- each deterministic qualification requirement as pass/fail/unknown;
- the exact next unmet qualification requirement;
- Shadow open/partial-lot context;
- rolling qualification health and loss streak;
- deterministic risk decision history and top recurring risk signals;
- Phase 27 discovery provenance, repeat count, gate, and cluster penalty;
- recent observed wallet activity.

The previous simplistic 20-trades/60%-win-rate promotion hint is removed from the wallet detail. Trusted promotion review now requires deterministic Shadow qualification in the UI. Qualified status does not auto-promote or enable Trusted execution.

Dynamic WARNING, AUTO_PAUSED, and REQUALIFYING wallets receive an explicit Requalify in Shadow control. Requalification never silently resumes live execution.

Open and partially realized Shadow lots remain context only. They are never shown as completed qualification outcomes.

The UI reuses the existing Wallet Analyst, Shadow Coach, and Dynamic Qualification backend contracts instead of introducing duplicate qualification logic.
