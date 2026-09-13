# Phase 33 — AI Assistant Foundation & Architecture

CopyGuard v4.10.0 introduces the governed AI Assistant foundation.

## Architecture

- Persistent `assistant_state.json` session/message/audit ledger.
- Active AI provider routing through CopyGuard's existing provider abstraction.
- Local deterministic fallback when the configured provider is unavailable.
- Dedicated Electron IPC/preload bridge and Assistant workspace.
- Bounded session/message/audit retention.

## Permission model

- `READ` — allowed.
- `ANALYZE` — allowed.
- `RECOMMEND` — allowed.
- `PREPARE` — proposal boundary only; no state mutation in Phase 33.
- `CHANGE_CONFIG` — denied in Phase 33.
- `LIVE_EXECUTION` — denied from assistant chat.

The permission classifier runs before provider invocation. Model output cannot elevate its authority. The Phase 33 assistant section contains no direct `executeTrade`, `autoExecuteTrade`, Trusted-config mutator, or automation-state mutator path.

## Scope boundary

Phase 33 intentionally exposes only a small foundation context (app version, connection mode, automation pause state, and high-level counts). Phase 34 will add structured system awareness. Phase 35 will add the advanced natural-language command router.

## Safety

Assistant statements never constitute execution evidence. Phase 32's persistent one-shot execution ledger, degraded-mode checks, hard risk blocks, freshness gates, and Padre safeguards remain authoritative.
