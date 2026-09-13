# CopyGuard v2.10.0 — Phase 11 Early Bird Engine

Phase 11 promotes Early Bird from the legacy sidebar prototype into a full CopyGuard intelligence workspace.

## Added

- Dedicated full-width Early Bird page with Candidates, Monitored, Run History and Dismissed views.
- Live scan status and progress updates from the Electron backend.
- Persistent scan ledger in `earlybird_scan_history.json`.
- Persistent qualifying token-run history in `earlybird_runs.json`.
- Repeat early-entry candidate history in `earlybird.json`.
- New 100-point behavioral scoring model:
  - Timing: 35 points
  - Repeatability: 25 points
  - Post-entry outcomes: 25 points
  - Contract precision: 15 points
- Copycat/spray behavior can apply an additional score penalty.
- Clear candidate classes: Elite Early Bird, Strong Early Buyer, Notable, Watch, and Spray / Low Precision.
- Search, classification filters and sorting by score, entry rank, run multiple, consistency or recency.
- Per-candidate score explanations and retained early-entry evidence.
- Add-to-monitoring workflow that always enters the wallet as Pending, never Trusted.
- Dismiss and restore candidate workflow.
- Direct handoffs from observed tokens to Research or Padre Terminal.
- Solscan wallet inspection shortcut.
- Early Bird monitoring state stays synchronized if a wallet is added elsewhere in CopyGuard.

## Safety / interpretation

Early-entry behavior is treated as observable trading behavior only. CopyGuard does not claim it proves inside information and does not treat an Early Bird score as a guarantee of future performance.

## Requirements

A Helius API key is required to run the discovery scan. DexScreener public market data is used to locate recent strong-run candidates and compare same-ticker contracts.
