# CopyGuard Phase 14 — Settings, Security & Persistence

Phase 14 replaces the Settings placeholder with a production-oriented Settings Center.

## Added
- Connections page for Helius and five supported AI providers.
- API secrets stored separately from normal settings and encrypted with Electron safeStorage when OS encryption is available.
- One-time migration of legacy plaintext keys from settings.json into the secure secrets store.
- Renderer receives only masked credential status, never saved raw API keys.
- Connection-test controls for Helius and AI providers.
- Global risk and automation defaults.
- Notification and quiet-hours controls.
- JSON backup/export and restore workflows.
- Backups intentionally exclude API credentials; restore preserves machine-local secrets.
- Local data inventory and direct data-folder access.
- Scoped reset controls for activity, intelligence, preferences, or the entire CopyGuard data store.
- Reset Everything also clears stored credentials.

## Security boundary
Phase 14 improves local credential storage, but no desktop application can protect secrets from an already-compromised operating-system account. CopyGuard does not expose saved key values back to the renderer after persistence.
