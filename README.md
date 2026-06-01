# ControlQuest Studio v2

ControlQuest Studio is a Firebase-backed, GitHub Pages-friendly CISA study platform with login, private profiles, study groups, live shared sessions, adaptive roadmaps, QAE tracking, daily challenges, XP, streaks, avatar customization, calendars, mini-games, flashcards, and mistake logging.

## Important upgrade note

If you already connected Firebase, keep your existing file:

```txt
config/firebase-config.js
```

When uploading this v2 package, replace the website files but preserve your real Firebase config values. The included config file is a placeholder.

## Folder structure

```txt
index.html
assets/
css/styles.css
js/
config/firebase-config.js
firebase.rules
docs/
README.md
```

## Fast setup

1. Upload the contents of this folder to your GitHub Pages repo root.
2. Copy your real Firebase config values into `config/firebase-config.js` and set `enabled: true`.
3. In Firebase Authentication, enable Email/Password.
4. In Firestore, paste `firebase.rules` into the Rules tab and publish.
5. Open the GitHub Pages URL.
6. Log in or create an account.
7. Create a study group or join one by group ID + invite code.

## Data model

- `/users/{uid}` stores private user data: exam date, roadmap, QAE logs, mistakes, flashcards, avatar, streak, XP, preferences.
- `/groups/{groupId}` stores group-level data: member summaries, invite code, live session, shared schedule, shared calendar.
- `/deletedProfiles/{uid}/backups/{backupId}` stores a backup before a profile is deleted.

## No npm required

This is a static HTML/CSS/JavaScript app. Firebase is loaded through browser module imports from Google CDN. Do not run `npm install firebase` unless you decide to convert the project to a build-tool app later.
