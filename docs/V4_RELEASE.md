# ControlQuest 4.0 — study expeditions

## One study system, three experiences

Focus study presents the current question and explanation without forcing a game break. Expedition places the animated world beside the same question queue on desktop. Phones prioritize the question and offer an explicit world switch. Guild live uses the existing synchronized session, per-member answers, reveal gate and personal review adapter beside the shared expedition.

Choosing a different experience preserves the queue and revealed answer. After rating a card, the answer explanation remains visible until the learner acknowledges Next. Pending acknowledgments survive reloads and cannot grade twice. Incorrect multiple-choice answers always receive Again, regardless of the confidence button selected.

## A study-powered campaign

Each route follows gathering → construction → sailing → pirate defense → arrival. Correct recalls provide two work units; misses create bounded hull damage and repair work. Subsequent correct recalls repair setbacks and continue the assignment. Completed outposts and personal mastery are preserved. The campaign continues across named destinations and later charts.

The scene reflects actual saved mission work, ship condition, outposts, voyages and pirate health. Ship travel, resource trips, scaffolding, cannon fire, damage and repairs derive from persisted state. Map locations select the crew's assignment or open the next question. Clicking a location alone earns no resources or mission completion.

Campaign and colony use one timber/starlight/coin balance. Background farms and supplies remain compatible. Previously funded landmark projects can finish; fresh legacy projects only fund when explicitly selected, so they do not silently consume campaign supplies. Existing worlds receive an additive campaign state. Guild world mutations stay inside the existing Firestore transaction, with bounded duplicate-event protection. Focus study still advances the world in the background.

## Library Health and import comparison

Library → Library Health audits the signed-in visitor's loaded Personal, active Guild and Public cards. Exact normalized question text plus normalized choice text identifies groups across reordered options. Conflicting answer keys remain visible and excluded from unsafe automatic resolution. Shared copies across scopes may be intentional; no cards or review history are deleted.

The category planner uses canonical lesson IDs, titles and supported alternatives with question metadata. It preserves manually chosen categories, mixed domains and ambiguous evidence. Only supported writable Personal/active-Guild category patches can be applied. The app downloads a before-change snapshot and supports an audit report export. Patches update category fields only, with stale-write and ownership checks; concurrent edits require a fresh audit. Public and other private accounts are not rewritten.

Batch previews separately report new questions, existing duplicates, within-batch duplicates and conflicting keys before saving. Each file provides paged comparisons with existing question IDs, scopes, lessons and answer text. Flagged rows require confirmation; ordinary deduplication within stored scope is retained.

No live private database was accessed or globally cleaned during development. The audit operates on authenticated data available to the current visitor and does not claim coverage of unloaded records.

## Deployment and verification

The existing Firebase Auth/Firestore backend and GitHub Pages deployment remain. No backend migration or new collection is required. Existing public-deck privacy and Guild concurrency rules remain applicable.

Run npm test, npm run build and git diff --check. Tests cover campaign progression, wrong-answer repair, shared-wallet and concurrent-event idempotency, question acknowledgment/reload, experience switching, exact-duplicate previews, canonical categorization, stale-write protection and all prior import/SRS behavior. Browser QA uses the separate original-question demo; it does not change production user data. Real two-device authenticated Guild sessions remain a device validation step.
