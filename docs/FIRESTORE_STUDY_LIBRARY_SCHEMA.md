# Firestore Study Library Schema

## Deck Document

Important fields:

- `id`
- `title`
- `description`
- `scope`: Personal, Guild, or Public
- `scopeKey`
- `kind`: lesson, master, missed, or custom
- `ownerUid`
- `groupId`
- `sessionFingerprint`
- `createdAt`
- `updatedAt`

## Card Document

Important fields:

- `id`
- `fingerprint`
- `deckIds[]`
- `question`
- `choices.A-D`
- `correctAnswer`
- `justifications.A-D`
- `userAnswerAtImport`
- `wasCorrectAtImport`
- `domain`
- `knowledgeStatement`
- `taskStatement`
- `difficulty`
- `timeSpent`
- `source`
- `scope`
- `scopeKey`

## Progress Document

Stored privately under the user:

- `cardId`
- `state`: new, learning, relearning, or review
- `dueAt`
- `intervalDays`
- `ease`
- `repetitions`
- `lapses`
- `correctCount`
- `incorrectCount`
- `answerStreak`
- `bestAnswerStreak`
- `lastRating`
- `lastReviewedAt`

## Review Event

- `cardId`
- `deckId`
- `mode`
- `rating`
- `correct`
- `responseTimeMs`
- `wasNew`
- `sessionId`
- `groupId`
- `reviewedAt`
