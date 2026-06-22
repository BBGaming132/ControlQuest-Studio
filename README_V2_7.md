# ControlQuest Studio v2.7 — Adaptive Study Library

ControlQuest Studio v2.7 turns each imported ISACA QAE review session into a complete private or Guild study package.

## What An Import Creates Automatically

Every valid QAE paste creates or updates:

1. A lesson deck named from the Session Label.
2. The scope's Master QAE Question Bank.
3. The scope's Master Missed Questions deck.
4. A multiple-choice retake bank using the original choices and justifications.
5. Individual review progress for each user.
6. A QAE score log and missed-concept records.

The importer fingerprints each question. Re-importing the same question links it to the new lesson deck without duplicating it in the Master bank.

## Study Modes

- Smart Review: prioritizes due, overdue, lapsed, and imported-missed cards.
- Flashcards: flip the prompt, read the answer, then rate Again / Hard / Good / Easy.
- Quiz Mode: retake imported multiple-choice questions and review every answer justification.
- Guild Study: synchronize the same Guild question across members while recording each user's answer separately.
- Games: question-powered challenges based on the selected real deck.
- Analytics: due counts, review accuracy, lapses, mastery, daily activity, due forecast, and mode-level performance.

## Upgrade From v2.6

1. Back up your GitHub repository.
2. Download and unzip the v2.7 package.
3. Preserve your existing working file:

   `config/firebase-config.js`

4. Replace the remaining website files with the v2.7 files.
5. Confirm these new/updated files exist in the repository:

   - `js/flashcard-engine.js`
   - `js/qae-parser.js`
   - `js/content.js`
   - `js/firebase-service.js`
   - `js/app.js`
   - `css/styles.css`
   - `index.html`
   - `firebase.rules`

6. In Firebase Console, open Firestore Database → Rules.
7. Replace the existing rules with the contents of `firebase.rules` and click Publish.
8. Commit and deploy through GitHub Pages.
9. Hard refresh the live site with `Ctrl + Shift + R`.

## First Test

1. Log in.
2. Open Practice Log.
3. Enter a Session Label.
4. Leave Import Scope set to Guild if you want the deck shared with your active Guild.
5. Paste a completed QAE review dump.
6. Click Preview Parse Count.
7. Confirm the parsed/new/duplicate/missed counts.
8. Click Parse And Import QAE Paste.
9. Open Study Tools → Deck Library.
10. Confirm the lesson deck, Master QAE Question Bank, and Master Missed Questions deck appear.
11. Open Smart Review and answer one item.
12. Open Analytics and confirm the review is counted.

## Firestore Data Layout

Website code remains on GitHub Pages. Study data stays in Firestore.

Private user library:

- `users/{uid}/studyDecks/{deckId}`
- `users/{uid}/studyCards/{cardId}`
- `users/{uid}/studyProgress/{progressId}`
- `users/{uid}/studyReviews/{reviewId}`

Guild library:

- `groups/{groupId}/studyDecks/{deckId}`
- `groups/{groupId}/studyCards/{cardId}`

Public original-content library:

- `publicStudyDecks/{deckId}`
- `publicStudyCards/{cardId}`

Each user's adaptive progress remains private even when the question deck is shared with a Guild.

## Review Settings

Open Profile → Adaptive Review Settings to configure:

- New Cards Per Day
- Maximum Reviews Per Day
- Desired Retention Target
- Leech Warning Threshold
- Learning Steps
- Relearning Steps

## Content Boundary

ControlQuest can process QAE review text that the user personally provides for private or Guild review. The app blocks full QAE imports from being published to the Public library. Public decks should contain original study material only.

## Troubleshooting

### `qae-parser.js` 404

Confirm `js/qae-parser.js` exists at the repository root's `js` folder and can be opened directly from the GitHub Pages URL.

### Missing Export Error

Confirm the v2.7 `js/content.js`, `js/app.js`, and `js/flashcard-engine.js` were uploaded together. Mixed versions can create import/export errors.

### Firebase Permission Error

Publish the v2.7 `firebase.rules` file in Firestore Rules.

### Old Site Still Appears

Hard refresh with `Ctrl + Shift + R`, or clear the site's cached files.

### Import Parses Zero Questions

Paste from the QAE Review Answer page after the answer and justification are visible. Use Preview Parse Count before importing.
