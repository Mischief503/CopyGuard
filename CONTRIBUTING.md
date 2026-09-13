# Contributing

1. Use Node.js 20 or newer.
2. Run `npm install`.
3. Run `npm test` before opening a pull request.
4. Keep `contextIsolation: true` and `nodeIntegration: false` for renderer views.
5. Do not expose saved API keys through preload IPC or renderer state.
6. Any change to automated execution must preserve the global emergency pause,
   per-wallet enable gate, and deterministic hard-block checks.
7. Never commit local CopyGuard user data or credentials.
