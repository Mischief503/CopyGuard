# Phase 41 — Risk Investigation Assistant

CopyGuard v4.18.0 adds a forensic Risk Investigation Assistant over the deterministic Phase 26 Risk Engine.

The investigator traces each current risk flag back to its CopyGuard evidence source, including token authorities, Token-2022 restrictions, liquidity/FDV, turnover, price movement, resolved holder concentration, creator-candidate concentration and launch history, creator funding relationships, and Early Bird/holder overlap.

Hard blocks, cautions, unknowns, risk components, source transaction links, recent risk-decision history, and score/decision changes are presented separately.

Semantics remain conservative:
- a hard block is execution-governing and cannot be waived by the assistant or AI;
- a caution is a risk signal, not proof of manipulation;
- wash-like turnover is not proof of wash trading;
- creator identity remains a candidate unless proven;
- UNKNOWN remains unavailable evidence and is never converted into a safe finding.

The assistant cannot clear a hard block, change risk thresholds, alter configuration, or execute trades.
