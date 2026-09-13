# Phase 30 — Data Integrity & Recovery Engine

CopyGuard v4.7.0 hardens persistent state against interrupted writes, corrupt JSON, inconsistent indexes, broken verified-outcome source links, stale learning links and damaged backups.

## Guarantees

- JSON state writes are staged to a temporary file, serialized/parsed before replacement, and retain a last-known-good `.bak` copy.
- Corrupt primary JSON is quarantined with a timestamped `.corrupt-*` suffix. If the `.bak` copy parses, it is restored automatically.
- The integrity audit rebuilds only safe derived indexes. It does not invent transaction evidence, P&L, signatures, lots, or outcomes.
- Verified outcomes with missing source transactions or invalid P&L are marked `INTEGRITY_QUARANTINED`, `sourceVerified=false`, and therefore excluded from Phase 29 verified learning.
- Backup schema v2 includes a SHA-256 manifest for every operational data file.
- Restore validates every checksum, stages every JSON file, and aborts before touching live data if validation fails.
- Before replacement, existing valid files are retained as `.pre-restore.bak` recovery copies.
- Integrity state is persisted in `data_integrity.json`, included in backups, available through IPC, and shown in Settings > Data.
