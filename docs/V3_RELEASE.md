# ControlQuest 3.0 — the study adventure rebuild

## Start here

The main page is now Today. Pick a 3-, 5-, 10- or 20-minute Pocket Quest, or jump straight to Batch Import, Mastery Atlas, Concept Trails, or My Adventure. Existing decks, study history, Guilds and Firebase configuration are retained.

A no-account demo is available through Explore the island on the login screen, or `?demo=1`. It contains 60 original concept questions and a separate browser-local save. It does not use or modify production Firebase data.

## Bring in all the exports

Batch Import accepts up to 100 Word/text/Markdown files, 12 MB per file and 90 MB total, with additional extracted-text, ZIP-expansion and question caps. The Word reader validates archives and extracts text only. Each filename becomes a deck name. Review proposed lessons, edit destinations/sharing per row and explicitly confirm flagged mappings.

Imports run sequentially with per-file progress, cancellation, failed-row retry and checkpoints isolated by account/Guild. Successful private writes survive a subsequent public-sharing failure, so a retry does not create an extra private import. Changing an import's category deliberately creates a new operation and resets stale category overrides. Conflicting answer variants are flagged rather than silently overwritten. Mixed practice exams preserve the original domains of their questions.

The existing Deck Library still edits categories and shows Guild/Public upload coverage. Unknown official QAE bank totals are not invented: uploaded counts describe the available library, and upload completeness is separate from mastery.

## Understand the study engine

Mastery Atlas counts unique questions across Personal, Guild and Public copies, even with reordered answer letters. It separates unseen, learning, remaining-to-master, due scheduled reviews and unresolved misses for each domain. Other members' imported misses are not treated as your personal failures.

A wrong multiple-choice answer is scheduled Again even if Easy is selected. Again/Hard cards can return once within the Pocket Quest after several other cards. Mastery requires repeated successful scheduled recalls, a review interval of at least 21 days, at least 80% recorded accuracy and two consecutive Good/Easy recalls. Practicing early does not inflate the scheduled interval. This is a transparent spaced-repetition scheduler; it is not Anki's FSRS implementation and its mastery percentage is not an exam-pass prediction.

Daily recommendations are deterministic and available without AI: repair unresolved misses, review due cards, then introduce unseen questions, using domain weights and current mastery to break ties. The daily goal counts distinct questions practiced that day. Pocket queues, selected answers and reveal state resume on the same account; private progress synchronizes through the existing Firebase user collections.

## Study while playing

Pocket Quest presents one touch-friendly question at a time. Answer, reveal, read the rationale and rate recall. The review is saved before a playable island turn appears. Choose a planting, harvesting, gathering, crafting or building action, then continue studying. Just study for this round skips interludes without changing the saved review. Horizontal swipe and keyboard shortcuts supplement explicit answer/rating controls and do not hijack vertical scrolling.

The Lantern Isles is a persistent, turn-based solo/cooperative world with three illustrated zones, growing plants, resource recipes, landmarks, chapter progression and rotating quests. Correct recalls earn focus; working through mistakes still advances growing plants and earns occasional practice focus. No real-time crop waits or purchases. Island quest coins are separate from profile Audit Coins.

Guild island actions apply to the latest shared state through Firestore transactions. Live question sessions use explicit joined participants rather than every offline member. Answers remain visually concealed until joined players submit; late arrivals join the next question, and players can leave a round. Scores/rewards are retry-safe. This is cooperative study plus a persistent island, not a full MMO or a server-authoritative competitive economy. As in the original app, the browser is not an anti-cheat boundary.

## Concepts, audio and optional AI

Concept Trails contains 60 original short lessons aligned to the existing domain topics: explanation, workplace scenario, CISA trap, retrieval prompt and original checkpoint. Browser speech reads the lesson without revealing the checkpoint answer. These are introductory study aids, not a complete official CISA course. Primary learning references and verified exam weights are in CISA_SOURCES.md.

Recommendations need no model. The optional coach can use desktop Ollama on localhost with a downloaded open-weight model, or an explicitly downloaded WebLLM Qwen2.5 model on a compatible WebGPU device. The browser option uses pinned WebLLM 0.2.85 and a verified model ID; its catalog reports about 1 GB of required GPU memory plus model downloads. Actual availability depends on device/browser resources. No model inference or download was performed in release QA. Local-model setup, allowed origins, model license and hardware requirements still apply. Imported answer rationales remain authoritative over AI explanations.

## Wayforge bridge

Preferences exports the most recent 500 question-free activity events with stable IDs. The browser also emits `controlquest:activity` events. Lifetime study totals remain in progress records. This is a receiving-adapter contract, not a completed external connection: no Wayforge API exists in the supplied project context. A future server must verify events and enforce idempotency before adding shared currency. Todoist remains authoritative for the separate task system; ControlQuest makes no task/calendar changes.

## Hosting and deployment

GitHub Pages remains sufficient for this static build and Firebase collaboration. Keep `config/firebase-config.js`. The existing `firebase.rules` from the previous public-library release must already be deployed for community sharing. This release adds no new Firebase collections: island state is on the existing Guild document; personal preferences/review receipts are on the existing user document; card progress/review events retain their existing subcollections.

For local verification use Node 22+:

```
npm ci
npm test
npm run build
```

The source root remains the GitHub Pages entry point. `dist/` is an equivalent static output for another host such as Vercel; migrating hosting is not required. Development dependencies do not run in the deployed app.

The recent activity journal and completed retry receipts are bounded. Pending review intents survive retries; retrying writes replays the saved update rather than incrementing again. Source data and historical progress are not reset. Cross-account live Firebase traffic, production concurrency, browser audio on every device and local AI inference still need signed-in/device-specific validation.

## Verified in this release

Node suites cover parsing/privacy boundaries, real DOCX extraction and archive rejection, batch preview/resume/cancellation, partial import recovery, lesson mappings, domain analytics, scheduler transitions, alias deduplication, wrong-answer grading, retry-safe receipts, account isolation, bounded persistence, legacy sessions, multiplayer command concurrency, island economics and every new experience view.

A real browser preview verified the desktop dashboard, selecting/revealing/rating an incorrect answer, the saved island turn, zone navigation, planting/crafting controls, the 390px mobile dashboard/adventure and bottom navigation. The responsive preview does not replace a real iPhone accessibility/audio/performance test. No production accounts or QAE exports were accessed in QA.
