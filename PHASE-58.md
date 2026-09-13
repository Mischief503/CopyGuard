# Phase 58 — Risk Forensics UI

CopyGuard v4.35.0 turns Risk Center into the forensic view of deterministic Risk Engine v3.

## Decision authority
- PASS, CAUTION and HARD_BLOCK are visually distinct.
- HARD_BLOCK remains non-overridable and prevents Risk Center Padre handoff.
- AI explanation is subordinate and cannot clear or reduce deterministic state.
- UNKNOWN evidence remains explicitly unresolved.

## Forensic evidence
The scan inspector exposes current market evidence, authority state, Token-2022 restrictions, resolved holder ownership, creator holdings/history, provenance, coordination context, component pressure, deterministic flags, cautions, hard blocks and unknowns.

## Safety boundary
Risk Center may open Research evidence. Padre handoff is review/preparation only when permitted. HARD_BLOCK prevents that handoff. No final submit, execution reservation, Trusted promotion or risk override was added.
