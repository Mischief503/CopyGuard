# CopyGuard v4.2.0 — Phase 25: Token Research Engine

Phase 25 upgrades Research into a persistent deterministic evidence package before AI review.

## Evidence package v3
- SPL Token vs Token-2022 program identification from mint account ownership
- parsed Token-2022 extension/restriction evidence (transfer fees, default frozen state, non-transferable, permanent delegate, transfer hook, confidential transfer when exposed by RPC)
- mint/freeze authority evidence
- mint-origin reconstruction and creator-candidate evidence
- largest token accounts resolved to wallet owners
- creator holdings among the resolved top-owner sample
- bounded creator history inspection for proven initializeMint/initializeMint2 activity
- first observed creator funding relationship in the sampled history
- same-ticker lineage/provenance
- current liquidity/FDV evidence with explicit historical-liquidity limitation
- Early Bird buyer-to-current-top-holder overlap
- local watched-wallet coordination evidence
- evidence coverage/quality and explicit limitations

AI receives the structured evidence only. Missing evidence remains UNKNOWN/UNAVAILABLE and is never converted into a safety claim.
