# Phase 20 — Market & Pricing Engine

CopyGuard v3.7.0 establishes a strict separation between **execution pricing** and **current market pricing**.

## Execution price hierarchy
1. Transaction stablecoin flow (USDC/USDT) — HIGH confidence.
2. Transaction WSOL flow — HIGH confidence.
3. Fee-adjusted native SOL wallet balance flow — MEDIUM confidence.
4. Current DexScreener quote fallback — LOW confidence and explicitly marked as a fallback.

Every Shadow entry carries its source transaction signature/timestamps from Phase 19 plus pricing source, pricing confidence, observation latency, and the market snapshot identifier available at processing time.

## Current market marks
DexScreener quotes are cached for 15 seconds and stored in `market_price_ledger.json`. Open Shadow positions are marked every 30 seconds. The Ghost workspace exposes marked equity and unrealized P&L, with a manual market refresh button.

## Safety invariant
A later market quote never silently replaces a known transaction-derived execution price. Current quotes are for risk context and mark-to-market; source transaction pricing remains immutable for the simulated fill.
