# ControlQuest Studio v2.8

ControlQuest Studio v2.8 aligns the study workflow with the routine selected by the Guild:

- Monday: review the prior week, missed questions, and due adaptive cards.
- Tuesday through Friday: complete new ISACA QAE sets and import the results.
- Weekend Flex: complete one self-directed block on Saturday or Sunday. Studying on both days can earn two activity days, but skipping one weekend day does not break the streak.

## Major Updates

### Study Room And Study Plan
- Date-aware Study Room checklists for Monday recap, Tuesday–Friday new sets, and Weekend Flex.
- A single shared Weekend Flex requirement shown across Saturday and Sunday.
- Cleaner weekly roadmap cards with required-task progress.
- Optional reinforcement remains available without blocking completion of the core plan.

### Practice Import
- Paste or Word-document import with a question preview before saving.
- Word filenames automatically become the proposed session label.
- Imported questions continue to build the lesson deck, Master QAE Question Bank, Master Missed Questions deck, and adaptive review history.
- Long question and missed-question lists are constrained to scrollable workspaces.
- QAE trend visualization includes dates, percentages, and question-volume tooltips.

### Adaptive Study Tools
- Multiple-choice selection before revealing an adaptive flashcard.
- Again, Hard, Good, and Easy ratings with visual confidence faces.
- Same-session reappearance is described in cards rather than hours.
- Review progress saves after answer selection, reveal, and rating.
- Mastered cards remain accessible through Review Mastered Cards.
- Deck Library uses varied accents and a scrollable layout for large libraries.

### Guild Study
- Member answers remain private until all Guild members have locked an answer.
- Reveal becomes available only after everyone answers.
- Results and explanations appear simultaneously after reveal.
- Guild scores move members through an animated starship race.

### Games And Rewards
- Assurance Odyssey is a persistent space-adventure review campaign with saved progress.
- Confidence Climb, Missed Question Gauntlet, and 60-Second Audit Sprint remain available as overlays.
- Starships are available as unlockable/equippable reward items and appear in Guild races and Assurance Odyssey.

### Guild Branding
- Custom Guild images accept PNG, JPEG, or WebP files up to 10 MB.
- Images are resized and compressed in the browser before Firebase storage.
- Guild images use a centered contain layout so the complete image is shown instead of being cropped.

## Deployment

1. Back up the current GitHub repository.
2. Preserve the working `config/firebase-config.js` from the live site.
3. Replace the remaining repository files with the complete v2.8 package.
4. Restore the working `config/firebase-config.js`.
5. Publish the included `firebase.rules` only if they differ from the currently deployed study-library rules.
6. Commit and wait for GitHub Pages to finish deploying.
7. Hard refresh the website with `Ctrl + Shift + R`.

Do not mix individual JavaScript files from earlier releases with v2.8. The full package is designed and tested as one matching version.

## Important Data Notes

- Website code is stored on GitHub.
- User profiles, Guild state, study decks, cards, review progress, and review events are stored in Firebase.
- Replacing website files does not delete Firebase study history.
- Preserve `config/firebase-config.js` so the deployed app keeps its Firebase and Google Calendar configuration.

## Validation Performed

- JavaScript syntax validation for all modules.
- QAE parser and adaptive-library smoke tests.
- v2.8 feature-marker test.
- Full primary-view rendering smoke test in a browser-like DOM.
- Adaptive review interaction test: select answer, reveal, rate, and advance.
- Guild reveal interaction test: concealed answers before reveal and visible results afterward.
- Schedule test for Monday recap, Tuesday–Friday new sets, Weekend Flex, and non-breaking weekend gaps.

Live Firebase and Google Calendar behavior still must be confirmed after deployment because the test environment does not have access to the production Firebase project or OAuth consent session.
