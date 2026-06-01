# ControlQuest Studio User Guide

## Brand

Recommended site name: ControlQuest Studio.

Team/guild name: Ty & Comply Guild.

Mascot: Ollie the Audit Owl.

Tagline: Master the audit mindset one quest at a time.

## Core loop

Every weekday morning, use the Live Study Room from 7:00-8:00 AM:

1. Check in.
2. Run the timer.
3. Complete the six-part session checklist.
4. Watch/listen to the topic.
5. Draw the concept.
6. Answer QAE questions.
7. Log the lesson learned.
8. Assign after-session homework.

## Gamification

ControlQuest awards XP for helpful study actions:

- Session completion: 100 XP
- Weekend bonus session: 120 XP
- QAE practice: 4 XP per question plus a bonus for strong scores
- Mini game correct answer: 35 XP
- Mini game attempt: 8 XP
- Homework quest: 35-90 XP
- Daily quest: varies by task
- Check-in: 15 XP

Levels are calculated from XP. Avatar gear unlocks as XP and streaks increase.

## Streaks and streak freezes

Streaks count completed weekday sessions. Weekends do not break the streak. Pause blocks and excused dates do not break the streak. Streak freezes can protect a missed weekday.

## Adaptive roadmap

The roadmap is generated from the start date, exam date, weekday study schedule, pause blocks, and CISA domain weighting. If you push the exam back, the roadmap automatically creates more active study days and redistributes topics.

## Buddy Guild

The Buddy Guild compares Bennett and Ty by XP, streak, QAE volume, and accuracy. If one person falls behind, generate a catch-up quest rather than treating the gap as failure.

## Firebase sync

Each person creates a Firebase Auth account. Progress is stored in Firestore:

- Individual user profile: `guilds/{guildId}/members/{uid}`
- Shared study data: `guilds/{guildId}/shared/appState`

## Calendar Builder

The Calendar Builder creates Outlook-friendly .ics files. Download the weekday recurring file, open it in Outlook, review, and send it to Bennett and Ty.
