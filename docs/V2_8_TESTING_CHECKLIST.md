# ControlQuest Studio v2.8 Deployment Testing Checklist

## Startup
- [ ] Login page loads without console errors.
- [ ] Firebase shows connected.
- [ ] Existing profile, Guild, decks, and review history load.
- [ ] Original two-eye owl logo appears in the loading screen and navigation.

## Schedule
- [ ] Monday Study Room checklist is recap-focused.
- [ ] Tuesday–Friday checklists emphasize a new QAE set.
- [ ] Saturday and Sunday display Weekend Flex.
- [ ] Activity on either weekend day satisfies the shared weekend requirement.
- [ ] Missing one weekend day does not consume a Streak Freeze or break the streak.

## Practice Import
- [ ] Word import proposes the filename as Session Label.
- [ ] Paste and Word imports show a preview before saving.
- [ ] Import creates/updates the lesson deck, Master Bank, and Missed deck.
- [ ] Reimporting the same questions does not duplicate Master Bank cards.
- [ ] Missed Question Bank and Imported Question Bank scroll instead of expanding indefinitely.

## Adaptive Review
- [ ] Answer choices can be selected without revealing the answer.
- [ ] Reveal is disabled until an option is selected.
- [ ] Reveal shows the correct answer and all available justifications.
- [ ] Again/Hard/Good/Easy advances the session and saves progress.
- [ ] Again and Hard cards reappear later in the current queue.
- [ ] Refreshing mid-session restores the saved session.
- [ ] Review Mastered Cards opens previously completed cards.

## Guild Study
- [ ] Each member can change an answer before reveal.
- [ ] Members see only “Answer Locked In,” not another member’s choice.
- [ ] Reveal remains disabled until all members answer.
- [ ] Reveal shows every member’s answer and correctness.
- [ ] Starship positions update after scoring.

## Games And Rewards
- [ ] Every game opens in an overlay.
- [ ] 60-Second Audit Sprint timer counts down.
- [ ] Missed Question Gauntlet displays and removes hearts.
- [ ] Confidence Climb moves the avatar.
- [ ] Assurance Odyssey saves progress after each question.
- [ ] Purchased/equipped starships appear in Rewards and Guild Study.

## Guild Image
- [ ] Image up to 10 MB can be selected.
- [ ] The app compresses it before saving.
- [ ] The full image is visible in Command Center, sidebar, and Guild page.

## Responsive Layout
- [ ] Desktop layout has no overlapping controls.
- [ ] Tablet layout stacks cleanly.
- [ ] Mobile layout keeps modals, question choices, and game overlays inside the viewport.
