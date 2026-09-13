# CopyGuard Phase 13 — Notifications + Event Center

Phase 13 adds a persistent, auditable event system across CopyGuard.

## Added
- Dedicated Events navigation page and unread badge.
- Persistent `notification_events.json` ledger (up to 1,200 recent events).
- Event categories for trades, risk, automation, positions, health, intelligence, Early Bird, and connections.
- INFO / SUCCESS / WATCH / WARNING / HIGH / CRITICAL severities.
- Read and acknowledge workflow, mark-all-read, and clear-acknowledged controls.
- Search and category filters.
- Direct Research and Padre handoffs from token-related events.
- OS desktop notifications for high/critical events when notifications are enabled and quiet hours allow them.
- Event recording remains active even when desktop popups are disabled.

Phase 14 will rebuild Settings, credential/security handling, backup/restore, and persistence controls.
