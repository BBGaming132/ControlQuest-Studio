# ControlQuest Firestore Schema

The GitHub repository stores only the website code. Study progress is stored in Firebase so updating the site code does not overwrite study data.

## Collections

- `guilds/{guildId}`
  - `guildName`
  - `guildId`
  - `memberEmails`
  - `updatedAt`

- `guilds/{guildId}/members/{uid}`
  - `uid`
  - `email`
  - `displayName`
  - `profile`
    - `xp`
    - `streak`
    - `streakFreezes`
    - `avatar`
    - `stats`
    - `badges`
    - `studyDates`
    - `excusedDates`
  - `updatedAt`

- `guilds/{guildId}/shared/appState`
  - `settings`
  - `sessions`
  - `qaeLogs`
  - `errors`
  - `flashcards`
  - `homework`
  - `pauseBlocks`
  - `roadmapStatus`
  - `checkins`
  - `liveNotes`
  - `updatedAt`

## Update safety

Code updates happen in GitHub. Study data remains in Firestore. Before a big site update, export a JSON backup from Settings & Sync.
