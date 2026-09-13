# CopyGuard v2.9.0 — Phase 10 Intelligence Center

Phase 10 promotes the preserved wallet intelligence engines into dedicated application workspaces.

## Added
- Intelligence Center with Discover, Health, Watchlist, and Signals tabs.
- Manual wallet discovery trigger using the existing Helius + DexScreener discovery engine.
- Manual wallet health check trigger and health-alert review/dismissal.
- Persistent intelligence watchlist stored in intelligence.json.
- Safe candidate promotion into Pending monitoring only; discoveries never become Trusted automatically.
- Signal stream combining wallet-health alerts, bundle/coordinated activity, and deterministic hard-block events.
- Intelligence source/status panel and top-wallet snapshot.
- Wallet Leaderboard ranked from locally stored win rate, trade count, and P&L data.
- Search/tier filtering and one-click wallet profile navigation from Leaderboard.

## Safety/interpretation
Discovery and leaderboard scores are heuristics based on available local/third-party data. They are not guarantees of profitability. Adding a discovery to monitored wallets always creates it as Pending.
