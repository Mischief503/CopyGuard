# Phase 17 — Intelligence Logic Completion

Version: 3.4.0

Phase 17 converts remaining intelligence screens from partial heuristics into evidence-backed pipelines.

## Completed
- Wallet Discovery now has a live DexScreener candidate source and Helius-backed buyer reconstruction.
- Discovery no longer invents win rate/P&L from SOL balance direction. Unknown performance remains unknown until Shadow-tested.
- Wallet Health uses realized P&L or completed Shadow outcomes only; APPROVED/AUTO decisions are never counted as wins.
- Early Bird paginates up to 1,500 token signatures by default instead of reading only the latest 50.
- Early buyer identity comes from actual inbound transfers of the target mint, not fee payer alone.
- Early Bird run multiples are explicitly labeled as DEX-window estimates rather than historical launch-to-peak proof.
- STRONG/ELITE Early Bird candidates automatically enter the 30-completed-outcome Shadow qualification pipeline.
- Early Bird candidates receive a specialized AI assessment constrained to observed evidence; the model may recommend Shadow testing, watching, or rejection but cannot claim insider knowledge.
- Token Research now attaches authority, holder concentration, provenance and deterministic Risk Engine v2 evidence to each contract.
- Research AI receives a specialized structured evidence contract and cannot override deterministic hard blocks.

## Evidence policy
CopyGuard distinguishes observed facts, deterministic calculations, heuristics and AI interpretation. Historical-looking metrics are not presented as verified profitability unless they come from realized or Shadow-realized outcomes.
