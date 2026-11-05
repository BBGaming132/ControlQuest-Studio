# ControlQuest: staged Supabase migration framework

Prepared 2026-11-04. This is a migration design and offline validation tool, not an activated migration. No production export, Supabase project, schema, auth setting or application provider switch has been performed. Publish and verify the urgent offline recovery patch first. Keep all browser data and pending answers. A quota-blocked Firestore read is not an empty dataset and must never be exported as one.

## Recommended boundary

Move persistence to Postgres in stages while initially retaining Firebase Auth. This separates database reliability work from changing sign-in and identity. Supabase supports Firebase as a third-party auth provider; register the exact Firebase project, issue the required server-controlled `role: authenticated` claim while preserving existing claims, refresh tokens, and configure the client `accessToken` callback. A Firebase UID is an opaque string, not a Postgres UUID. Use text application user IDs and compare the trusted JWT `sub` to that ID; do not cast Firebase UIDs through `auth.uid()`.

If a later phase moves to Supabase Auth, create a private, unique `(issuer, subject) → application_user_id` identity map and link accounts through verified identity proof. Email similarity is not proof of ownership. Map every owner, membership, review, import, group host and pending-device record; don't regenerate study IDs or silently create a new user library. Firebase credential/session export and password compatibility require their own tested auth migration procedure. Retaining Firebase Auth does not require copying passwords.

Introduce a provider-neutral repository contract around the functions currently in `js/firebase-service.js`: profiles, scoped libraries, review commands, homework commands, guild commands and community contributions. Keep the local queue and cache above that boundary. Pin adapter/schema versions and choose one authoritative provider per account/migration epoch. Do not silently dual-write from the browser. Preserve the Firestore adapter until reconciliation and rollback are proven.

## Source inventory from this repository

| Source path or state | Meaning and proposed target |
| --- | --- |
| `users/{uid}` | Profile settings, statistics, v3 state and compact homework pointers → `profiles`, bounded preferences/state plus extracted event tables |
| `users/{uid}/studyDecks/{id}` | Personal decks → `decks` with owner and scope |
| `users/{uid}/studyCards/{id}` | Personal questions, alternatives, rationales and provenance → `cards`, deck membership junction |
| `users/{uid}/studyProgress/{id}` | Recall scheduling, suspension, reset and mastery → `card_progress`, keyed by user plus stable scoped card identity |
| `users/{uid}/studyReviews/{id}` | Mixed record types, not just reviews: review events, `profile-chunk`, `account-activity`, `homework-quiz`, `homework-quiz-archive`, `homework-completion` → separate typed tables |
| `groups/{id}` | Members/summaries, host/session and cooperative world state → `guilds`, `guild_members`, `guild_sessions`, `guild_world_state` |
| `groups/{id}/studyDecks`, `studyCards`, `studyReviews` | Guild content and any historical guild review documents → scoped tables; retain provenance and inventory legacy records even if not actively read |
| `publicStudyDecks`, `publicStudyCards` | Legacy public content → scoped content with owner-only mutation |
| `publicLessonContributions` | Owner-attributed public submissions; derived community decks are built on read → `community_contributions`, retain source IDs and fingerprint |
| `publicLessonStatus` | Shared lesson status → explicit status policy and audit events |
| `deletedProfiles/{uid}/backups/{id}` | Append-only deletion/manual backup records → restricted archive; not active account resurrection |
| `aiPracticeCatalog`, `aiPracticeQuota` | Conditional: only if the separate AI service was deployed. Server-only generated sets/quotas → server-owned tables. Source code presence does not establish production existence |
| Device review outboxes | `cq-review-outbox-{uid}-{group-or-solo}` includes original card/input, stable event ID, answer time and retry status → preserve locally and reconcile through review command |
| Device homework journal | `cq-homework-pending-{uid}` captures homework/streak intent → preserve and reconcile separately from reviews |
| Other local state | Account/Guild-scoped confirmed IndexedDB snapshots (or fallback cache), `cq-pocket-{uid}`, AI catalog copies and pending world events in `profile.v3.pendingWorld` → inventory per device; never treat a cache as a complete server backup |

This is an inventory of code paths, not a confirmed live collection count. An administrative, paginated enumeration must include subcollections under missing parent documents; a root-only export misses them. Export Firebase Auth identity metadata separately from database records. Preserve timestamps with timezone/precision, Firestore references, bytes and special values in a documented lossless JSON encoding before transformation.

## Profile hydration and source completeness

`js/profile-chunks.js` writes content-addressed chunks in each user's `studyReviews` collection and puts ordered references in `_profileChunks.fields`. The record marker is `profile-chunk`; the document ID is `profile_chunk_` plus SHA-256 of the string payload. Read every referenced chunk, verify its hash and owner, concatenate in reference order and parse JSON. Only then transform the hydrated profile. Missing, malformed or unsupported chunks stop migration for that user. Never substitute `{}` or null. Preserve the original root and raw chunks in immutable backup for forensic restoration; orphan chunks are not reviews and should not be imported into the review timeline.

`profileStorageSnapshot` deliberately compacts quiz/completion data. Hydrating chunks alone does not restore full homework: fetch the separate `homework-*` documents and archived attempts, validate owner/key/revision and merge through the same domain rules as the current application. Preserve fixed quiz questions, answer-choice identity/order, timer start/deadline, submission evidence, reset boundaries and archived attempts. Validate lesson and streak totals against hydrated source and device journals, not only top-level profile summary counters.

## Target integrity and authorization design

Keep stable scoped card IDs as source keys and use explicit uniqueness constraints. A review command should atomically insert a `(application_user_id, event_id)` receipt, update the appropriate progress row and apply rewards/lesson evidence once. A duplicate with the identical canonical payload returns the existing receipt; a duplicate ID with a different payload is a conflict. Preserve reset epochs and reviewed timestamps; late offline answers must not undo a newer reset. Quiz submissions require compare-and-swap revision checks and immutable submitted attempts. World rewards and guild commands need their own idempotency IDs and transactions.

Enable RLS on every exposed table and grant only the needed API operations. Private schema staging, identity maps, backups, quota and AI mutation paths must not become browser APIs. Publishable browser keys are acceptable with tested RLS; service-role/secret keys belong only on trusted servers. Views need invoker security or restricted grants; don't use privileged functions to conceal a missing policy. An UPDATE requires a SELECT policy as well as ownership in both USING and WITH CHECK.

| Data | Authorization requirement |
| --- | --- |
| Profile, progress, reviews, homework and activity | Current verified principal owns the row; cannot transfer ownership on update |
| Personal cards/decks | Owner only, including deck membership relations |
| Guild content/session/world | Current membership from a server-controlled membership table; role/host-specific mutations, removal effective immediately |
| Public contribution | Signed-in read, owner-only mutation with immutable owner and allowed fields |
| Shared lesson status | Define explicitly whether member edits are intended; retain attributed audit history |
| AI catalog | Authorized read through service; server-only generation, validation, quota and mutation |
| Backup/staging/identity map | Administrative access only; no browser enumeration |

Current `firebase.rules` grants broad signed-in access to groups and guild subcollections. Do not reproduce that access as `TO authenticated` alone. Derive and validate membership from actual group records, distinguish owners/moderators/members, quarantine ambiguous memberships and test removed users. Do not trust user-editable metadata for roles. With Firebase tokens, restrict issuer/audience to the configured project; hosted integration verifies registered projects, and self-hosting needs explicit equivalent protections.

## Cutover sequence and gates

1. **Recovery first.** Verify phone reload/offline use and durable pending answers in the urgent release. Keep one active study tab per device while the existing localStorage queue is used. No quota-pressure export or repeated full scans now.
2. **Staging and budget.** Select region/plan and project, pin client/CLI versions and lockfiles, establish spending alerts, restore destination and access model. Create isolated staging schema via reviewed migrations; run advisors and tenant-isolation tests before any real import.
3. **Backup after reads recover.** Export all source documents/subcollections and identity metadata using bounded pages/retries with a manifest, captured interval, per-collection/per-user counts and canonical hashes. Mark partial exports incomplete. Keep an encrypted immutable raw copy outside the target database. Device exports are separate, owner-scoped and must include all relevant Guild queues. Never include provider secrets or session tokens in migration artifacts.
4. **Transform in staging.** Hydrate chunks and homework, validate references, normalize tables, preserve original source paths and import-batch IDs. Use resumable upserts with immutable source hashes. Rerunning a batch must not duplicate reviews or alter submitted quizzes. Reconcile counts and hashes, active/deleted records, lesson completion, streak dates, reset epochs, group membership and generated practice.
5. **Shadow verification.** Firestore remains authoritative. Compare read results for a small cohort; don't enable browser dual writes. Test simultaneous tabs, repeated event delivery, account/Guild switches, network loss after commit, delayed old-device events and stale cache recovery.
6. **Controlled cutover.** Establish a migration epoch/watermark and briefly pause cloud mutations while permitting local queue capture. Drain reachable queues into the authoritative source or route them through an audited import command that retains original IDs. Capture final server deltas with a verified no-write window or change log, reconcile, then switch the cohort to the target. Unknown/offline devices mean pending work is not globally zero. Keep a compatibility intake/reconciliation route for them and track unresolved devices. Old clients must be rejected or routed safely; a static frontend flag alone cannot fence old Firestore writers.
7. **Acknowledge and monitor.** Remove a local event only after the new authoritative server returns the matching committed receipt. Preserve per-provider delivery status and original payload. Confirm mobile lesson completion after refresh and on a second device, counts and receipts match, and errors/latency are within the agreed limits. Expand cohorts only after clean reconciliation.
8. **Retire later.** Keep raw backups, mappings and the previous adapter for a defined recovery window. Remove legacy writes only after cutover fencing is effective. Retire Firebase Auth, if desired, as a separately tested project.

Pending events cannot simply be copied as already-completed review rows: their progress, homework and rewards may be only partly committed. Reconcile receipt stages from `saveExperienceReview` and homework/world commands, then replay missing stages transactionally. Preserve original event ID/UID/Guild/reset context. Server confirmation takes precedence over device retry state.

## Backup, restore and rollback

Before cutover, restore the raw backup into an isolated environment and demonstrate hydration plus representative mobile account access. Target database backups and point-in-time recovery depend on the selected plan; Storage object contents need a separate backup strategy. Export policy/grants, schema version, function code, identity mapping and storage metadata as well as rows.

Rollback before target writes is a provider switch back to the unchanged source. After target writes, first stop new target mutations, retain pending-device data, export/replay the target-only event delta to Firestore using the same IDs and domain rules, reconcile totals, then route back. Never restore an old database snapshot over acknowledged new answers. If Firestore remains quota-blocked, an immediate switch back cannot safely complete: keep local capture/target read access and communicate delayed cloud reconciliation. A rollback drill must include a review committed on the server but unacknowledged on the phone.

## Local validator provided

`node scripts/migration/validate-export.mjs export.json` is offline and read-only. Input format:

```json
{
  "format": "controlquest-migration-v1",
  "capturedAt": "2026-11-05T00:00:00Z",
  "complete": false,
  "documents": [{"path": "users/example", "data": {"uid": "example"}}],
  "pending": [{"uid": "example", "id": "original-event-id", "payload": {"rating": "Again"}}]
}
```

It rejects unknown/duplicate paths, ownership mismatches, invalid chunk hashes/references, missing referenced homework records and conflicting pending payloads. It reports collection counts, hydrated profile hashes, a deterministic raw-document manifest hash, and unresolved pending-event counts. It never approves cutover, proves full export completeness, uploads anything, or changes either database. No production data is included. The current adapter-specific export must convert Firestore values into the documented envelope; this tool is not a Firestore native-export reader or a general referential-integrity verifier.

Run `node tests/migration-export.test.mjs`. Fixtures cover reordered manifests, Unicode chunks, missing/corrupt chunks, missing homework, owner mismatch, duplicate document paths and conflicting pending event payloads. A staging migration additionally needs real SQL policy/transaction tests and restored data comparisons; these have not been run because no target schema is being created in this phase.

## Costs and current documentation

Supabase is not quota-free. Size expected profile/card/event volume, retention, indexes, compute, database/storage growth, egress, connection pooling, Realtime subscriptions, Edge Functions and third-party-auth MAUs. Keep bounded reads and event writes, cache stable content, paginate libraries, and measure operation counts per answer. Moving providers without fixing repeated full-profile writes or reload loops would preserve the underlying cost/performance problem. Confirm the selected plan's backup retention, limits and spend behavior in its dashboard rather than promising a monthly price before usage is measured.

Documentation checked 2026-11-05: [Firebase third-party Auth](https://supabase.com/docs/guides/auth/third-party/firebase-auth), [RLS](https://supabase.com/docs/guides/database/postgres/row-level-security), [backups](https://supabase.com/docs/guides/platform/backups), [third-party MAU usage](https://supabase.com/docs/guides/platform/manage-your-usage/monthly-active-users-third-party), [changelog](https://supabase.com/changelog). The Markdown changelog endpoint could not be read by this environment; the HTML changelog was checked instead. Its current CLI v3 breaking change alters default targets and hosted mutation confirmation. Inspect `supabase --version` and command `--help`, pin the toolchain, and explicitly select staging/production targets; do not reuse older deployment flags blindly.
