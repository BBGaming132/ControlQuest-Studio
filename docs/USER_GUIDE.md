# ControlQuest Studio v2 User Guide

## 1. Log in or create an account

The site now starts with a full login page. Use Email/Password login through Firebase Authentication. If someone else wants to use the site, they can create their own account from the login page.

## 2. Create or join a study group

Open **Study Guild**.

To create a group:
1. Enter a group name.
2. Click **Create group**.
3. Share the group ID and invite code with your study buddy.

To join a group:
1. Enter the group ID.
2. Enter the invite code.
3. Click **Join group**.

Your private profile data remains private. Group members see only high-level summaries: level, streak, roadmap percent, QAE total, and behind-days.

## 3. Use the Command Center

The dashboard shows:
- Today’s roadmap topic
- Personal exam countdown
- Personal roadmap progress
- Streak and streak freezes
- Three daily challenges
- Catch-up suggestions
- Study group pulse

Daily challenges are separate from meetings. You can earn XP by doing QAE practice, teach-backs, Mistake Forge entries, visual maps, flashcards, accountability pings, or arcade rounds.

## 4. Run a live study session

Open **Live Study Room** after joining a study group.

The live room syncs:
- Timer start/pause/reset
- Group check-ins
- Session checklist
- Shared notes
- Completion status

The timer and checklist update through Firestore, so both screens stay aligned.

## 5. Adjust your personal roadmap

Open **Roadmap**.

Your exam date is personal. Changing it only updates your profile, not your study buddy’s. The roadmap recalculates around:
- Start date
- Exam date
- QAE goal
- Session duration
- Pause blocks
- Missed days

Each roadmap day has its own topic, tasks, and session plan. Mark days **Done** or **Missed**. If you fall behind, the dashboard suggests catch-up quests.

## 6. Use the Calendar Builder

Open **Calendar**.

You can create:
- Personal recurring study blocks
- Group recurring study sessions
- One-off extra study sessions

The site downloads `.ics` calendar files that can be imported into Outlook.

## 7. Track QAE progress

Open **QAE Arena**.

Log:
- Domain
- Correct answers
- Total questions
- Notes/trap

The site tracks domain accuracy and awards XP.

## 8. Use Mistake Forge

Open **Mistake Forge**.

Each wrong or guessed question should become a lesson:
- Domain
- Trap
- Correct CISA logic
- Retest date

This is how you stop repeating the same mistakes.

## 9. Build flashcards

Open **Memory Deck**.

Create cards and export them as a Quizlet TSV file.

## 10. Play Arcade games

Open **Arcade**.

Mini-games reinforce CISA answer logic and terminology. Correct answers award XP.

## 11. Customize your avatar

Open **Avatar Closet**.

Change colors and unlock gear based on:
- XP level
- Streak length
- QAE logs
- Mistake Forge progress
- Perfect weeks

## 12. Delete profile safely

Open **Profile + Settings**.

The delete flow requires multiple confirmations. Before deletion, the site writes a backup to:

`deletedProfiles/{uid}/backups/{timestamp}`

You can optionally delete your Firebase Auth account too, but Firebase requires recent reauthentication for security-sensitive actions.
