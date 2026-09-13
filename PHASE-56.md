# Phase 56 — Intelligence Operations UI

CopyGuard v4.33.0 redesigns Intelligence Center as an auditable operations workspace built on Phase 27 discovery, wallet health, deterministic risk signals, Shadow routing, and Phase 29 learning evidence.

## Discovery evidence
The workspace now reads the actual Phase 27 candidate ledger, including score, gate, independent-token repeatability, average early-entry rank, top-10 rate, under-10-minute rate, reconstruction confidence, positive-run rate, cluster overlap, cluster penalty, strongest peer, source appearances, and recent discovery runs.

ONE_HIT_WONDER, CLUSTER_REVIEW, WATCH, and SHADOW_READY remain visible rather than being collapsed into a single heuristic score. SHADOW_READY means paper-testing eligibility only; it never means Trusted.

## Investigation workflow
Selecting a discovery record exposes the exact independent token appearances and source transaction signatures. Source transactions can be inspected on Solscan. Candidates already routed to Shadow can jump directly to the Shadow Lab. Other candidates may be placed on the intelligence watchlist or added as Pending monitored wallets. No Intelligence action promotes a wallet directly to Trusted.

Health alerts and signal-stream events now have a detail inspector and can hand off to Wallet Management or Token Research. Coordination/cluster overlap remains correlation evidence and is not presented as proof of common control.

## Learning and engine status
The side rail exposes Phase 27 scan history, Shadow-ready/routed counts, cluster counts, one-hit rejection, and Phase 29 verified-link / AI-scored / risk-scored / proposal statistics. Learning proposals remain advisory only.
