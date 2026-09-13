# Phase 26 — Manipulation & Risk Engine

CopyGuard v4.3.0 turns the Phase 25 token evidence package into deterministic execution policy.

## Decision contract

Every assessment returns exactly one primary decision: `PASS`, `CAUTION`, or `HARD_BLOCK`. AI remains advisory and cannot override a deterministic hard block. Unknown evidence lowers confidence and is never converted into a safety claim.

## Evidence-backed signals

- active mint/freeze authority hard blocks
- Token-2022 non-transferable/default-frozen hard blocks
- permanent delegate, transfer hook, transfer fee and confidential-transfer cautions
- resolved top-owner concentration and creator concentration
- repeat creator launches and proven funder relationships
- Early Bird / major-holder overlap as sniper-concentration evidence
- watched-wallet clusters and repeated cohorts
- liquidity/FDV traps, extreme turnover and abnormal price movement
- copycat/provenance evidence
- explicit unknown state for un-reconstructed historical liquidity behavior

## Persistent audit

`risk_decisions.json` stores the deterministic decision, score, confidence, hard blocks, cautions, unknowns, source signature/event key and component scores. It participates in backup/restore.

## Execution safety

Shadow and live trade paths continue to consume `riskAssessment.hardBlocks`. Live automation also honors the configured maximum risk score. Thus deterministic policy is enforced before AI can authorize execution.
