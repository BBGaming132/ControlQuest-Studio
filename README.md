# ControlQuest Studio v2.2

Gamified CISA study platform with Firebase Auth/Firestore sync, study guilds, live study room, adaptive roadmap, daily quests, XP/coins/chests, streak freezes, QAE logging, Mistake Forge, Memory Deck, Arcade, Calendar, Notebook, Shop, Avatar Closet, and safer profile reset/delete flows.

## Upgrade safely

1. Back up your current GitHub repo.
2. Copy this package into your repo.
3. Preserve your working `config/firebase-config.js` or re-paste your Firebase config and keep `enabled: true`.
4. Publish the included `firebase.rules` in Firestore Rules.
5. Commit and push to GitHub Pages.
6. Hard refresh the live site.

## Important

- GitHub stores code only.
- Firebase stores user data.
- Do not store proprietary/copyrighted exam questions in the public repo.
- The built-in practice prompts and starter flashcards are original study content.

## Major v2.2 additions

- Reset stats for testing with multiple warnings and backup
- Deeper onboarding with theme, exam date, session length, QAE goal
- Guided tour with feature explanations
- Activity log for XP/coin history
- XP popups, confetti, coins, treasure chests
- Automatic streak freeze logic
- Quest Shop
- Live Study Room checkbox persistence and larger controls
- Day-level roadmap with pause blocks and weekend bonus logs
- Physical month calendar with event creation
- Lesson + Homework page
- Notebook page
- Starter Memory Decks
- Expanded Arcade
- Mobile-friendly touch targets
