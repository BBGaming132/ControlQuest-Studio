# Domain, lesson and public community libraries

The catalog reuses the existing ISACA study plan: 60 lessons across five domains and three practice exams. Stable lesson IDs connect imports, filters and checklists.

## Find where the existing uploads left off

1. In Study Tools → Deck Library, select Guild and Domain 1, 2 or 3. The Guild checklist lists every lesson, matching decks, contributors and unique card counts. Choose Left to upload to see the gaps.
2. Use Match existing lesson categories to preview unambiguous matches from existing titles or question metadata. Mixed and unknown decks remain unchanged.
3. Select Needs categorizing to find decks without a canonical lesson link. Edit Categories changes the domain, lesson and searchable tags of an existing deck. The normal Edit dialog also includes these fields.
4. Use Sync existing lesson decks to Public to backfill all recognized cards. Repeating the sync updates the submitting member's entries rather than creating extra copies. Unmatched cards are counted so they can be categorized next.

A changed domain or lesson applies to the deck's questions and its public contributions. Source cards shared with master banks remain intact. Editing only a title or tags preserves per-question categories in a mixed deck. Clearing or correcting a category removes or moves that member's previous public submissions from that source; other members retain ownership of their submissions.

## Word imports

Selecting a file immediately fills Deck Name from its filename without the extension, retaining punctuation. Filename matching proposes a lesson, and parsed question metadata can supply a suggestion when every question maps to one lesson. The confirmation dialog allows correction. Mixed exports retain individual question categories. Domain conflicts are rejected.

Matched QAE lesson cards are shared to Public by default alongside the selected Personal or Guild import. The checkbox can be cleared. Public-only import is also available. Public data includes question text, choices, answers, explanations and attribution. Imported personal answers, results, scores and adaptive progress are not published. Share only content you are authorized to redistribute.

## Community decks and comparisons

Each lesson has one generated public deck combining submissions from all signed-in members. Question text and answer-choice text are normalized for whitespace and case; reordered choice letters do not create duplicates. Different question wording or a genuinely different set of choices remains distinct.

Compare Submissions shows the source uploads, contributors, answer choices and explanations beneath each unique question. Differing answers are flagged and excluded from automatically graded review, quizzes and games. Explanation differences remain visible. No member needs permission to overwrite another member's card: the combined decks are derived from individually owned contribution records.

Select Public community in the checklist to see uploaded lessons, remaining gaps, unique question counts and shared Done checkoffs. Uploaded means some matching cards exist, not that the entire lesson's QAE export has been verified. Done is a separate verification checkoff. Contributions and checkoffs refresh through Firebase subscriptions; Refresh Guild Library also refreshes the public library.

## Filters

Search, domain, lesson, scope, categorization, deck type and sort apply throughout Study Tools. Search includes title, description, tags, contributor names and supported lesson aliases. Domain and lesson filters constrain the actual cards used in review, flashcards, quizzes and games, including master banks and mixed decks. Existing shared Guild sessions retain their saved queue.

## Required deployment step

Deploy this branch's `firebase.rules` to the existing Firebase project before using community sharing. New collections:

- `publicLessonContributions/{submissionId}`: signed-in readers; only the submitting member may create, change or remove their contribution.
- `publicLessonStatus/{lessonId}`: signed-in readers and verification checkoffs attributed to the current member.

Existing Firebase configuration and private/Guild study data remain unchanged. If the rules have not been deployed, the app preserves its private/Guild library and displays a public-library error with retry guidance. Publishing can be retried after deployment.

## Validation

Run:

- `node tests/adaptive-library-smoke.mjs`
- `node tests/v28-feature-smoke.mjs`
- `node tests/lesson-library-smoke.mjs`
- `node tests/community-library-smoke.mjs`

DOM interaction checks cover filename/lesson autofill, category editing, public backfill, repeated sync, reclassification, public checkoffs, comparison controls and game queues. Live cross-account Firebase subscriptions, permission enforcement and visual browser layout still require deployment verification.
