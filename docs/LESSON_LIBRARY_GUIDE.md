# Domain and lesson library

The catalog reuses Bennett's existing ISACA study plan: 60 lessons across five domains plus three practice exams. Canonical IDs remain stable even when a filename uses alternate wording.

## Importing QAE exports

Load a Word or text export in Practice Log. The confirmation shows the proposed canonical lesson and the individual question matches. Confirm or correct the lesson selection; leave Mixed / Unassigned for exports containing multiple lessons. Domain conflicts are rejected. Unknown names are left unassigned rather than guessed. Original source text and question fingerprints remain intact.

Deck Library includes Link Lesson for correcting existing imported or original decks. Older decks can infer their link from recognized titles, and questions can infer theirs from Knowledge Statement metadata. An explicit deck link supplies a lesson only to cards without a recognized individual lesson.

## Finding and playing cards

Study Tools has search, domain, lesson, library scope, deck type, and sort controls. The same controls apply in Games, Smart Review, Flashcards, Quiz, and Guild Study. Domain and lesson filters restrict actual card queues, including cards in master and mixed decks. Search matches deck titles, descriptions, canonical lesson names, supported alternatives, and the displayed uploader. Changing filters clears the current individual study session; existing shared Guild sessions retain their saved queue.

## Guild checklist

Deck Library and Guild show every catalog lesson, its alternatives, uploaded decks and contributors. Filter by left to upload, uploaded, done, or left to complete. Uploaded means at least one matching deck has been imported; it does not certify that all QAE questions for that lesson were exported. Members can independently check Done after verifying the lesson. Checkoffs persist on the Guild and sync via the existing subscription. Each checkoff writes only its own lesson field to avoid overwriting simultaneous checkoffs.

New imports preserve contributor names when the same deck is imported again. Historical decks can only display the uploader metadata already stored.

## Verification

Run `node tests/adaptive-library-smoke.mjs`, `node tests/v28-feature-smoke.mjs`, and `node tests/lesson-library-smoke.mjs`. No Firebase rules or configuration changes are required. Verify cross-account checkoff synchronization against the live Firebase project after deployment.
