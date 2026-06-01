# ControlQuest Studio

ControlQuest Studio is a free, GitHub Pages + Firebase web app built for Bennett and Ty's CISA prep rhythm.

## What it includes

- Polished gamified dashboard
- Light and dark mode
- Ollie the Audit Owl mascot and avatar closet
- XP, levels, streaks, streak freezes, badges, and unlockable gear
- Live 7-8 AM study room
- Dynamic roadmap that recalculates around exam date and pause blocks
- Buddy progress comparison for Bennett and Ty
- QAE tracker, error log foundation, homework quests, and mini games
- Calendar .ics builder for Outlook/EY calendars
- Firebase email/password login and Firestore live sync
- Local demo mode if Firebase is disabled

## Quick setup

1. Create a GitHub repository.
2. Upload everything in this folder.
3. Make sure `index.html` is in the root.
4. Enable GitHub Pages from the repository Settings > Pages screen.
5. Create a free Firebase project using the Spark plan.
6. Enable Authentication > Email/Password.
7. Enable Firestore Database.
8. Paste your Firebase web app config into `config/firebase-config.js` and set `enabled: true`.
9. Paste `firebase.rules` into Firestore Rules and publish.
10. Visit the GitHub Pages URL, create accounts, and start syncing.

## Safe update rule

Do not store progress in GitHub files. GitHub should store code only. Firebase stores Bennett/Ty progress separately in Firestore documents.
