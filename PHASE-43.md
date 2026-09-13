# Phase 43 — Portfolio & Performance Assistant

CopyGuard v4.20.0 adds a read-only Portfolio & Performance Assistant.

It unifies source-verified completed Shadow outcomes with current open Shadow marks while keeping those two accounting states separate. Realized P&L is calculated only from fully closed, source-verified outcomes. Open lots contribute remaining stake, marked equity and unrealized P&L but never count as completed outcomes.

The assistant also computes chronological drawdown, recent-vs-prior performance direction, wallet-level P&L attribution, token-level P&L attribution, strongest and weakest contributors, and total open Shadow exposure.

Operational/open-position ledgers are reported separately from verified Shadow performance and are never silently merged into verified returns.

The assistant is read-only. It cannot close positions, execute trades, alter sizing, promote wallets, or mutate accounting.
