# Phase 62 — Settings & Security Control Center

CopyGuard v4.39.0 finishes the production Settings workspace around security, connections, execution defaults, notifications, integrity and recovery.

The top health rail surfaces system mode, OS-backed secret storage state, Helius, market, Padre, integrity and execution-ledger context. Credentials remain write-only from the UI and are excluded from portable backups.

Backup policy is explicit: SHA-256 manifest verification, transactional restore, and API-secret exclusion. Integrity continues to quarantine corrupt data and only auto-repair rebuildable indexes.

Reset Everything is now protected at both renderer and main-process boundaries by the exact typed phrase `RESET EVERYTHING`. Risk/automation preferences can make execution stricter but cannot waive deterministic hard blocks, degraded-mode gating, or Phase 32 execution safety.
