# Phase 31 — Connection Health & Degraded Mode

CopyGuard v4.8.0 adds explicit service-health state for Helius RPC/WebSocket, DexScreener market pricing, Padre execution, and the active AI provider.

Execution-critical outages move the system into `DEGRADED` mode and block live Padre execution/Trusted auto-copy. Observation recovery and deterministic risk logic continue where their required data remains available. AI is advisory and its failure does not erase deterministic decisions.

The controller tracks observation lag, market quote age, HTTP failures/rate limits, Padre load state, service latency, state transitions, and exposes manual health checks in Settings.
