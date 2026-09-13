# Phase 15 — Production Build + Integration Hardening

Version: **3.0.0 production candidate**

Phase 15 closes the original 15-phase CopyGuard rebuild and converts the project into a GitHub-ready source repository.

## Production fixes

- Fixed Phase 14 credential migration so masked values from public settings can never overwrite encrypted credentials after restart.
- Public settings persistence now excludes `apiKeys` and `heliusApiKey` completely.
- Backups exclude both raw credentials and masked credential metadata.
- Backup restore explicitly ignores credential fields and preserves the machine's existing encrypted secrets.
- Legacy divider persistence no longer serializes the entire in-memory settings object.
- Padre permission requests are restricted to Padre origins and a small allowlist rather than automatically approving every permission.
- Removed obsolete split-screen/sidebar renderer artifacts from the production package.

## GitHub / build readiness

- Promoted version to 3.0.0.
- Added `README.md`, `LICENSE`, `SECURITY.md`, `CONTRIBUTING.md`, `CHANGELOG.md`, `.gitignore`, and `.gitattributes`.
- Added `scripts/validate.js` and wired it to `npm test` and every installer build command.
- Added GitHub Actions CI validation.
- Added a Windows installer build workflow for manual runs and version tags.
- Added deterministic installer artifact naming.

## Production posture

CopyGuard ships with automation disabled and emergency-pause protection enabled by default. Manual Copy actions prepare/open trades in Padre for user confirmation. Automated trusted-wallet execution remains explicitly opt-in and protected by per-wallet profiles plus deterministic hard-block gates.

## Validation target

A Phase 15 build is accepted only when the static production validator passes, the Electron/preload/renderer JavaScript parses successfully, all preload IPC calls have matching main-process handlers, all primary workspaces exist, legacy split-screen files are absent, and the final ZIP passes archive-integrity testing.
