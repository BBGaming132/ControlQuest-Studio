# ControlQuest Studio v2.3

A streamlined, Firebase-backed CISA study platform with multi-user study guilds, live study rooms, adaptive roadmap, practice logging, flashcards, arcade games, rewards, avatar customization, notes, and calendar planning.

## Upgrade Notes

1. Back up your current GitHub repo.
2. Copy the v2.3 files into your repo.
3. Preserve your working `config/firebase-config.js` file.
4. Publish the updated Firebase rules if your current rules are older than v2.
5. Hard refresh your GitHub Pages site.

Do not overwrite your working Firebase config unless you are intentionally replacing your Firebase project values.

## Main UX Changes In v2.3

- Streamlined navigation from many tabs into ten clearer areas.
- Command Center now emphasizes Daily Quests, XP, Coins, recent activity, Group Pulse, and Catch-Up Compass.
- Help button now shows a page-specific guided tour.
- Onboarding now collects theme, timezone, exam date, start date, session time, session length, and QAE goal.
- Study Room has a live animated timer, persistent synced checklist, shared notes, homework builder, and session history.
- Study Plan now uses Sunday-Saturday weeks, week date ranges, styled pause block modal, visible pause blocks, bonus sessions, and expandable day details.
- Practice Log combines QAE Arena and Mistake Forge with validation, editing, deleting, and trend charts.
- Study Tools combines Memory Deck and Arcade with public starter decks, personal/guild deck creation, in-app card review, TSV export, Memory Match, Control Sorter, Best/First Blitz, and Avatar Sprint.
- Calendar now has clickable month view events, event editing/deleting, personal/guild/both scopes, ICS downloads, and lesson-plan generation.
- Rewards now combines XP activity, Audit Coins, Quest Shop, chests, level popups, confetti, and Avatar Closet.
- Notebook supports Personal, Guild, and Public scopes, editing, deleting, and markdown/Word-compatible exports.
- Profile adds reset testing stats with backup, onboarding redo, full tour, timezone support, and safer delete flow.

## Data Safety

GitHub stores only website code. Firebase stores user and guild data. Replacing website files will not overwrite Firestore data unless you change database rules or manually delete data.

