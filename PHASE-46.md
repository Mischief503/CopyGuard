# Phase 46 — Assistant Memory & Project Context

CopyGuard v4.23.0 adds persistent, bounded assistant working memory inside assistant_state.json.

Memory types:
- DECISION
- INVESTIGATION
- WATCH_ITEM
- WORKING_NOTE
- CONCLUSION

Each memory stores timestamps, entities, source references, confidence, session linkage, pin state, and explicit CONTEXT_ONLY authority. Relevant memories are retrieved by entity/text relevance and recency, with pinned items receiving priority.

Memory freshness is visible. Items older than seven days are marked stale, but age alone does not delete them.

Critical precedence rule: memory is never evidence authority. Current CopyGuard ledgers, blockchain evidence, deterministic risk, qualification lifecycle, connection health, integrity state, and Phase 32 execution safety always override remembered context.

Memory cannot authorize actions, change settings, enable Trusted, promote wallets, alter risk, or prove missing facts.

Create, update, archive, list, and query-context IPC/preload contracts are included. Memory is persisted with the existing assistant state and therefore inherits the existing backup/integrity coverage.
