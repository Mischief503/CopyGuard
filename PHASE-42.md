# Phase 42 — Closed-Loop Learning Assistant

CopyGuard v4.19.0 adds a read-only Closed-Loop Learning Assistant over the Phase 29 verified-outcome correlation engine.

The assistant explains:
- how many source-verified completed outcomes exist and how many link to AI/risk decisions;
- AI predictions scored against verified outcomes;
- risk decisions scored against verified outcomes;
- calibration by provider/task and by recommendation bucket;
- recurring low-accuracy recommendation patterns;
- risk signals with adequately sampled positive/negative outcome associations;
- under-sampled buckets that are not ready for conclusions;
- evidence-backed improvement proposals.

Learning remains local correlation/calibration. It does not retrain external providers, change thresholds, change deterministic risk rules, change Trusted state, or execute trades.

Every proposal is ADVISORY_ONLY, requires human review, and is never auto-applied. Correlation is descriptive evidence rather than causal proof, and the minimum review sample remains the Phase 29 LEARNING_MIN_SAMPLE.
