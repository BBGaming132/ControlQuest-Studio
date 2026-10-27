# ControlQuest 5.1.1

Next appears and is enabled immediately after automatic Again or a manual recall rating. Answers are first stored in a local durable queue, then synced serially using the existing idempotent review receipts. Network and game reward latency no longer gate question navigation. Failed sync stays visible with Retry; reload retains pending answers. Lesson credit waits until sync completes. Storage write failure keeps the current question retryable instead of claiming success.

Lesson progress now separates the initial purple segment from appended orange review segments, with text counts and accessible descriptions. Queue metadata survives reload and older queues infer their original boundary. Pending answers inform lesson refill, so a slow save does not reintroduce a cleared question.

Validation: all 46 test suites pass; static build and diff checks pass. Added delayed-save, automatic Again, queue refill, retry/reload, completion gating, storage failure, stale-tab protection, and progress tests. Browser demo smoke check covered wrong-answer Next and orange review counts. Real authenticated multi-device latency was not exercised.

Use one active study tab for an account. Stale storage changes are detected before writing, but localStorage does not provide an atomic cross-tab compare-and-swap. Keep browser data while any answers are awaiting sync. Existing profile and review receipt persistence remains authoritative; no database migration is needed.
