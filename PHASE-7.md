# CopyGuard v2.6.0 — Phase 7: Research Center

Phase 7 promotes token research from the legacy sidebar into a first-class CopyGuard workspace.

## Added
- Full Research Center page in the main application shell
- Search by Solana ticker, token name, or mint/contract address
- Main-process DexScreener research bridge with Solana-only deduplication
- Helius-backed mint/freeze authority inspection when a Helius key is configured
- Deterministic 0–100 CopyGuard token risk score independent of AI
- Market context: price, liquidity, FDV, market cap, volume, pair age, 24h change
- Heuristic likely-original ranking across same-name/ticker candidate contracts
- Explicit copycat warning language: likely/heuristic, never guaranteed provenance
- AI copycat comparison using the configured provider as a second opinion
- Persistent token research watchlist stored in research_watchlist.json
- Copy Contract, Watch Token, DexScreener, and Open in Padre actions
- Live Feed → Research handoff now automatically launches the selected token search

## Safety / architecture
CopyGuard deterministic checks remain authoritative. AI can explain or add caution but is not used to prove contract authenticity. Research does not execute trades. Padre remains the separate execution workspace.
