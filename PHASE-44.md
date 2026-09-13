# Phase 44 — Safe Action Preparation

CopyGuard v4.21.0 expands the Phase 36 proposal boundary into structured, reviewable action preparation.

A PREPARE request can now produce a Safe Preparation object containing the target token, deterministic risk verdict, hard blocks/cautions/unknowns, current market/liquidity context, explicit sizing review fields, TP/SL review fields, warnings, and a review checklist.

Phase 44 deliberately does not choose a trade size or TP/SL automatically. Those values remain explicit user/governed-action inputs.

Deterministic hard blocks make a preparation BLOCKED. Degraded-mode and integrity conditions remain visible as warnings. UNKNOWN evidence stays unknown.

Padre preparation is data-only in this phase: the assistant cannot open Padre, populate its DOM, click submit, or execute a trade. It also cannot change configuration, Trusted state, qualification, or risk rules.

Confirmed Phase 36 proposals now advance only to READY_FOR_SAFE_PREPARATION, not execution.
