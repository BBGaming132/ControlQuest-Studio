# ControlQuest Studio v2.4

ControlQuest Studio is a Firebase-backed CISA study companion for individuals and study groups. It is designed to supplement ISACA QAE and study materials instead of replacing them.

## Upgrade Notes

1. Copy the contents of this folder to your GitHub Pages repository.
2. Preserve your working `config/firebase-config.js` if you already connected Firebase.
3. Replace your Firestore rules with `firebase.rules` if you are upgrading from an older version.
4. Hard refresh the site after deployment.

## Important Integrations

- Google Calendar direct event creation requires an OAuth Web Client ID in `config/firebase-config.js` and the Google Calendar API enabled.
- Apple Calendar/iCalendar support is handled through `.ics` downloads/imports in this browser-only version.
- Goodnotes is linked through a Goodnotes Web share link.
- Quizlet is linked and tracked; the site does not depend on a Quizlet API.

## Core Tabs

- Command Center: daily overview, KPIs, Daily Quests, Guild snapshot, Catch-Up Compass.
- Study Room: synced session timer, linked session flow, homework builder, Guild notes.
- Study Plan: adaptive roadmap with pause blocks, bonus sessions, and daily tasks.
- Practice Log: QAE result logging, trend chart, Mistake Review.
- Study Tools: ISACA/Quizlet/Goodnotes links, Quizlet practice tracker, Arcade games.
- Guild: members, metrics, invite code, shared events.
- Calendar: month calendar, event creation/editing, ICS export, optional Google Calendar connection.
- Notebook: personal/guild/public notes and exports.
- Rewards: XP, Audit Coins, chests, boosts, shop, avatar closet.
- Profile: preferences, timezone, onboarding, links, reset/delete tools.
