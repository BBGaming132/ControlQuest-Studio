# Firestore Schema

## users/{uid}
Private to the signed-in user.

```js
{
  uid,
  email,
  displayName,
  activeGroupId,
  groups: [],
  avatar: { baseColor, cape, glasses, accessory, mood },
  studyPlan: {
    examDate,
    startDate,
    dailyQaeGoal,
    sessionTime,
    sessionDuration,
    sessionDays,
    pauseBlocks: []
  },
  progress: {
    roadmapStatus: {},
    dailyChallenges: {},
    qaeLogs: [],
    mistakes: [],
    flashcards: [],
    homework: [],
    calendarEvents: []
  },
  stats: { xp, streak, bestStreak, streakFreezes, totalSessions, totalQae, totalMistakes, totalFlashcards, arcadeWins },
  badges: [],
  preferences: { theme, timezone, tutorialSeen },
  onboarding: { completed, step }
}
```

## groups/{groupId}
Readable to signed-in users so invite-code joining can work without a server. Do not store sensitive private notes here.

```js
{
  id,
  name,
  joinCode,
  createdBy,
  memberIds: { uid: true },
  memberSummaries: {
    uid: { displayName, email, avatar, xp, level, streak, progressPercent, behindDays, totalQae, totalMistakes, lastActive }
  },
  schedule: { days, time, duration, label },
  liveSession: { date, title, active, startedAt, accumulatedSeconds, durationMinutes, checklist, checkins, notes },
  sharedCalendar: []
}
```

## deletedProfiles/{uid}/backups/{backupId}
Created before profile deletion.

```js
{
  profile: { ...full user profile at deletion time },
  archivedAt,
  reason
}
```
