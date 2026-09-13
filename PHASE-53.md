# Phase 53 — Ghost / Shadow Qualification UI

CopyGuard v4.30.0 redesigns Ghost Mode into the dedicated Shadow qualification laboratory.

The workspace now centers the deterministic lifecycle: Pending → Shadow Testing → Qualified → Live Healthy, with Warning, Auto-Paused, and Requalifying states clearly called out as requiring new Shadow evidence before any later manual promotion.

Each Shadow wallet now shows:
- verified closed P&L, marked equity, unrealized P&L, win rate, profit factor, and max drawdown;
- exact deterministic qualification checks and progress;
- rolling dynamic health and loss streak;
- observation quality and Helius polling state;
- lot-level original stake, remaining stake, realized-so-far, unrealized mark, entry source, and partial exit history;
- source-linked verified outcomes with entry and exit transactions;
- explicit promotion readiness and requalification controls;
- simulation settings and market mark refresh.

Only fully closed source-verified outcomes count toward qualification. Open or partially realized Shadow lots remain contextual simulation data.

Phase 53 disables automatic live promotion in the UI. Qualification passing exposes a separate Review Live Promotion action; Warning/Auto-Paused/Requalifying states can explicitly return to Shadow.

The simulation ledger and source-transaction log remain visible side by side, with Solscan links for source signatures.
