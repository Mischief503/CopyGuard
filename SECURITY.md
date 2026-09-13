# Security Policy

## Secrets

CopyGuard stores Helius and AI API credentials outside normal `settings.json`.
On supported systems Electron `safeStorage` is used to encrypt the local secret
payload. Backups and normal data exports intentionally exclude API credentials.

Never commit API keys, wallet seed phrases, private keys, authentication cookies,
or exported browser/session data to this repository.

## Trading safety

CopyGuard starts with global automation disabled and the emergency automation
pause enabled. A wallet being marked Trusted does not by itself enable automated
execution. Automated execution additionally requires an enabled per-wallet
profile and must pass deterministic risk gates.

Padre is a third-party service. CopyGuard does not control Padre's availability,
markup, authentication, or trading behavior. Re-test execution behavior after
any Padre UI change before relying on automation.

## Reporting a vulnerability

If this repository is made public, report security issues privately to the
repository owner rather than opening an issue that contains exploitable details
or secrets.
