# Phase 36 — Assistant Action Proposal & Confirmation Engine

CopyGuard v4.13.0 adds a persistent, deterministic proposal layer for assistant PREPARE requests.

Phase 36 supports Padre preparation proposals only. A proposal records the routed intent, target, evidence validation, warnings, blocks, expiry, confirmation token, and audit history. Proposals expire after ten minutes.

A deterministic risk hard block prevents a proposal from becoming pending. Missing token identity also blocks it. Degraded/integrity states are surfaced as warnings.

Confirmation changes the proposal to CONFIRMED_NO_EXECUTION only. It never calls Padre DOM submission, executeTrade, Trusted automation, or live accounting. This preserves the Phase 32 execution boundary while creating the confirmation architecture needed for later governed actions.
