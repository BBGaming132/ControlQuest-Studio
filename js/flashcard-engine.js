// ControlQuest Adaptive Review Engine
// Inspired by proven spaced-repetition patterns (Again / Hard / Good / Easy),
// but intentionally implemented as a transparent ControlQuest scheduler rather than a clone of Anki/FSRS.

const DAY = 86400000;
const MINUTE = 60000;

export const DEFAULT_REVIEW_SETTINGS = Object.freeze({
  newCardsPerDay: 20,
  maxReviewsPerDay: 100,
  desiredRetention: 0.90,
  learningStepsMinutes: [1, 10, 1440],
  relearningStepsMinutes: [10, 1440],
  leechThreshold: 8
});

export function stableHash(value = '') {
  const text = String(value).normalize('NFKC').trim().toLowerCase();
  let h = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(36);
}

export function normalizeQuestion(value = '') {
  return String(value)
    .normalize('NFKC')
    .replace(/\s+/g, ' ')
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .trim()
    .toLowerCase();
}

export function cardFingerprint(question, choices = {}) {
  const orderedChoices = ['A', 'B', 'C', 'D']
    .map(letter => `${letter}:${normalizeQuestion(choices?.[letter] || '')}`)
    .join('|');
  return stableHash(`${normalizeQuestion(question)}|${orderedChoices}`);
}

export function scopeKey(scope, uid, groupId) {
  if (scope === 'Guild') return `guild_${groupId || 'none'}`;
  if (scope === 'Public') return 'public';
  return `personal_${uid || 'unknown'}`;
}

export function makeDeckId(title, scope, uid, groupId, suffix = '') {
  const key = scopeKey(scope, uid, groupId);
  const hash = stableHash(`${key}|${title}|${suffix}`);
  return `deck_${hash}`;
}

export function masterDeckId(scope, uid, groupId) {
  return makeDeckId('Master QAE Question Bank', scope, uid, groupId, 'master');
}

export function missedDeckId(scope, uid, groupId) {
  return makeDeckId('Master Missed Questions', scope, uid, groupId, 'missed');
}

export function buildImportBundle({ questions, title, scope = 'Guild', uid, groupId, importedBy = '', source = 'ISACA QAE Paste' }) {
  const cleanTitle = String(title || questions?.[0]?.sessionTitle || 'Imported QAE Session').trim();
  const key = scopeKey(scope, uid, groupId);
  const importSeed = stableHash((questions || []).map(q => q.fingerprint || cardFingerprint(q.question, q.choices)).sort().join('|'));
  const lessonDeckId = makeDeckId(cleanTitle, scope, uid, groupId, importSeed);
  const masterId = masterDeckId(scope, uid, groupId);
  const missedId = missedDeckId(scope, uid, groupId);
  const now = new Date().toISOString();
  const cardsById = new Map();

  for (const q of questions || []) {
    const fingerprint = q.fingerprint || cardFingerprint(q.question, q.choices);
    const id = `card_${fingerprint}`;
    const deckIds = [lessonDeckId, masterId];
    if (q.isCorrect === false) deckIds.push(missedId);
    const card = {
      id,
      fingerprint,
      scope,
      scopeKey: key,
      deckIds,
      source,
      sourceQuestionId: q.id || null,
      sessionTitle: cleanTitle,
      questionNumber: q.number || null,
      question: q.question || '',
      choices: q.choices || {},
      correctAnswer: q.correctAnswer || '',
      userAnswerAtImport: q.userAnswer || null,
      wasCorrectAtImport: q.isCorrect,
      justifications: q.justifications || {},
      domain: q.domain || '',
      domainNumber: q.domainNumber || null,
      domainName: q.domainName || '',
      knowledgeStatement: q.knowledgeStatement || '',
      taskStatement: q.taskStatement || '',
      difficulty: q.difficulty || '',
      timeSpent: q.timeSpent || '',
      tags: [q.domain, q.knowledgeStatement, q.sessionTitle].filter(Boolean),
      importedBy,
      ownerUid: uid,
      importedAt: q.importedAt || now,
      updatedAt: now
    };
    if (cardsById.has(id)) {
      const existing = cardsById.get(id);
      existing.deckIds = [...new Set([...existing.deckIds, ...deckIds])];
    } else {
      cardsById.set(id, card);
    }
  }

  const cards = [...cardsById.values()];
  const incorrect = cards.filter(card => card.wasCorrectAtImport === false).length;
  const sessionFingerprint = stableHash(cards.map(card => card.fingerprint).sort().join('|'));
  const deckBase = {
    scope,
    scopeKey: key,
    ownerUid: uid,
    groupId: scope === 'Guild' ? groupId : null,
    createdBy: importedBy,
    source,
    createdAt: now,
    updatedAt: now
  };
  const decks = [
    {
      ...deckBase,
      id: lessonDeckId,
      title: cleanTitle,
      description: `Imported QAE session with ${cards.length} unique questions and ${incorrect} missed questions.`,
      kind: 'lesson',
      sessionFingerprint,
      cardCount: cards.length,
      missedCount: incorrect
    },
    {
      ...deckBase,
      id: masterId,
      title: 'Master QAE Question Bank',
      description: 'Deduplicated master question bank for this scope. Every imported QAE question is added automatically.',
      kind: 'master',
      cardCount: 0,
      missedCount: 0
    },
    {
      ...deckBase,
      id: missedId,
      title: 'Master Missed Questions',
      description: 'Every imported question answered incorrectly is added automatically for targeted review.',
      kind: 'missed',
      cardCount: 0,
      missedCount: incorrect
    }
  ];
  return { decks, cards, lessonDeckId, masterDeckId: masterId, missedDeckId: missedId, sessionFingerprint, incorrect };
}

export function defaultProgress(card, uid) {
  return {
    id: `${card.scopeKey}__${card.id}`,
    uid,
    cardId: card.id,
    scope: card.scope,
    scopeKey: card.scopeKey,
    state: 'new',
    dueAt: new Date().toISOString(),
    intervalDays: 0,
    ease: 2.5,
    stepIndex: 0,
    repetitions: 0,
    lapses: 0,
    correctCount: 0,
    incorrectCount: 0,
    hardCount: 0,
    easyCount: 0,
    answerStreak: 0,
    bestAnswerStreak: 0,
    lastRating: null,
    lastReviewedAt: null,
    firstReviewedAt: null,
    updatedAt: new Date().toISOString()
  };
}

export function progressKey(card) {
  return `${card.scopeKey}__${card.id}`;
}

function addMinutes(date, minutes) {
  return new Date(date.getTime() + minutes * MINUTE);
}
function addDays(date, days) {
  return new Date(date.getTime() + days * DAY);
}
function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export function rateCard(card, existingProgress, rating, settings = DEFAULT_REVIEW_SETTINGS, reviewedAt = new Date()) {
  const p = { ...defaultProgress(card, existingProgress?.uid), ...(existingProgress || {}) };
  const normalizedRating = String(rating || 'Good');
  const learningSteps = settings.learningStepsMinutes || DEFAULT_REVIEW_SETTINGS.learningStepsMinutes;
  const relearningSteps = settings.relearningStepsMinutes || DEFAULT_REVIEW_SETTINGS.relearningStepsMinutes;
  const wasReview = p.state === 'review';
  p.repetitions += 1;
  p.lastRating = normalizedRating;
  p.lastReviewedAt = reviewedAt.toISOString();
  p.firstReviewedAt ||= p.lastReviewedAt;

  if (normalizedRating === 'Again') {
    p.incorrectCount += 1;
    p.answerStreak = 0;
    p.lapses += wasReview ? 1 : 0;
    p.ease = clamp((p.ease || 2.5) - 0.2, 1.3, 3.2);
    p.state = wasReview ? 'relearning' : 'learning';
    p.stepIndex = 0;
    p.intervalDays = 0;
    p.dueAt = addMinutes(reviewedAt, (wasReview ? relearningSteps : learningSteps)[0] || 10).toISOString();
  } else if (normalizedRating === 'Hard') {
    p.correctCount += 1;
    p.hardCount += 1;
    p.answerStreak += 1;
    p.bestAnswerStreak = Math.max(p.bestAnswerStreak || 0, p.answerStreak);
    p.ease = clamp((p.ease || 2.5) - 0.05, 1.3, 3.2);
    if (p.state === 'new' || p.state === 'learning' || p.state === 'relearning') {
      p.state = 'learning';
      const step = learningSteps[Math.min(p.stepIndex || 0, learningSteps.length - 1)] || 10;
      p.dueAt = addMinutes(reviewedAt, Math.max(6, Math.round(step * 1.5))).toISOString();
    } else {
      p.state = 'review';
      p.intervalDays = Math.max(1, Math.round((p.intervalDays || 1) * 1.2));
      p.dueAt = addDays(reviewedAt, p.intervalDays).toISOString();
    }
  } else if (normalizedRating === 'Easy') {
    p.correctCount += 1;
    p.easyCount += 1;
    p.answerStreak += 1;
    p.bestAnswerStreak = Math.max(p.bestAnswerStreak || 0, p.answerStreak);
    p.ease = clamp((p.ease || 2.5) + 0.15, 1.3, 3.2);
    p.state = 'review';
    p.stepIndex = learningSteps.length;
    p.intervalDays = p.intervalDays > 0 ? Math.max(4, Math.round(p.intervalDays * p.ease * 1.3)) : 4;
    p.dueAt = addDays(reviewedAt, p.intervalDays).toISOString();
  } else {
    p.correctCount += 1;
    p.answerStreak += 1;
    p.bestAnswerStreak = Math.max(p.bestAnswerStreak || 0, p.answerStreak);
    if (p.state === 'new' || p.state === 'learning' || p.state === 'relearning') {
      p.stepIndex = (p.stepIndex || 0) + 1;
      if (p.stepIndex < learningSteps.length) {
        p.state = 'learning';
        p.dueAt = addMinutes(reviewedAt, learningSteps[p.stepIndex]).toISOString();
      } else {
        p.state = 'review';
        p.intervalDays = Math.max(1, p.intervalDays || 1);
        p.dueAt = addDays(reviewedAt, p.intervalDays).toISOString();
      }
    } else {
      p.state = 'review';
      p.intervalDays = Math.max(1, Math.round((p.intervalDays || 1) * (p.ease || 2.5)));
      p.dueAt = addDays(reviewedAt, p.intervalDays).toISOString();
    }
  }
  p.updatedAt = new Date().toISOString();
  return p;
}

export function isDue(progress, now = new Date()) {
  if (!progress) return true;
  return !progress.dueAt || new Date(progress.dueAt) <= now;
}

export function cardMastery(progress) {
  if (!progress || progress.repetitions === 0) return 'New';
  if (progress.state === 'learning' || progress.state === 'relearning') return 'Learning';
  const total = (progress.correctCount || 0) + (progress.incorrectCount || 0);
  const accuracy = total ? (progress.correctCount || 0) / total : 0;
  if ((progress.intervalDays || 0) >= 21 && accuracy >= 0.8) return 'Mastered';
  return 'Reviewing';
}

export function buildStudyQueue(cards, progressMap, options = {}) {
  const now = options.now || new Date();
  const mode = options.mode || 'due';
  const limit = Math.max(1, options.limit || 20);
  const filtered = (cards || []).filter(card => {
    const p = progressMap?.[progressKey(card)];
    if (mode === 'missed') return card.wasCorrectAtImport === false || (p?.incorrectCount || 0) > 0;
    if (mode === 'new') return !p || p.repetitions === 0;
    if (mode === 'mastered') return cardMastery(p) === 'Mastered';
    if (mode === 'all') return true;
    return isDue(p, now);
  });
  const weighted = filtered.map(card => {
    const p = progressMap?.[progressKey(card)];
    let priority = 0;
    if (!p || p.repetitions === 0) priority += 30;
    if (card.wasCorrectAtImport === false) priority += 25;
    priority += (p?.lapses || 0) * 10;
    priority += (p?.incorrectCount || 0) * 4;
    if (p?.dueAt) priority += Math.max(0, Math.floor((now - new Date(p.dueAt)) / DAY));
    return { card, priority, dueAt: p?.dueAt || '1970-01-01' };
  });
  weighted.sort((a, b) => b.priority - a.priority || String(a.dueAt).localeCompare(String(b.dueAt)) || Math.random() - 0.5);
  if (mode === 'due') {
    const reviewItems = weighted.filter(item => {
      const p = progressMap?.[progressKey(item.card)];
      return p && (p.repetitions || 0) > 0;
    });
    const newItems = weighted.filter(item => {
      const p = progressMap?.[progressKey(item.card)];
      return !p || (p.repetitions || 0) === 0;
    });
    const reviewSelection = reviewItems.slice(0, limit);
    const remainingSlots = Math.max(0, limit - reviewSelection.length);
    const allowedNew = Math.min(options.newLimit ?? remainingSlots, remainingSlots);
    return [...reviewSelection, ...newItems.slice(0, allowedNew)].map(item => item.card);
  }
  return weighted.slice(0, limit).map(item => item.card);
}

export function calculateLibraryStats(cards, progressMap, reviews = [], deckId = null, settings = DEFAULT_REVIEW_SETTINGS) {
  const selected = deckId ? (cards || []).filter(card => card.deckIds?.includes(deckId)) : (cards || []);
  const now = new Date();
  const stats = { total: selected.length, new: 0, learning: 0, reviewing: 0, mastered: 0, due: 0, correct: 0, incorrect: 0, accuracy: 0, reviews: 0, lapses: 0, leeches: 0 };
  for (const card of selected) {
    const p = progressMap?.[progressKey(card)];
    const mastery = cardMastery(p);
    if (mastery === 'New') stats.new += 1;
    if (mastery === 'Learning') stats.learning += 1;
    if (mastery === 'Reviewing') stats.reviewing += 1;
    if (mastery === 'Mastered') stats.mastered += 1;
    if (isDue(p, now)) stats.due += 1;
    stats.correct += p?.correctCount || 0;
    stats.incorrect += p?.incorrectCount || 0;
    stats.reviews += p?.repetitions || 0;
    stats.lapses += p?.lapses || 0;
    if ((p?.lapses || 0) >= (settings.leechThreshold || DEFAULT_REVIEW_SETTINGS.leechThreshold)) stats.leeches += 1;
  }
  const answers = stats.correct + stats.incorrect;
  stats.accuracy = answers ? Math.round((stats.correct / answers) * 100) : 0;
  stats.retention = stats.total ? Math.round(((stats.mastered + stats.reviewing * 0.6 + stats.learning * 0.25) / stats.total) * 100) : 0;
  stats.recentReviews = (reviews || []).filter(review => !deckId || review.deckId === deckId);
  return stats;
}

export function createReviewEvent({ uid, card, deckId, mode, rating, correct, responseTimeMs, sessionId = null, groupId = null, wasNew = false }) {
  return {
    id: crypto.randomUUID(),
    uid,
    cardId: card.id,
    scopeKey: card.scopeKey,
    deckId,
    mode,
    rating,
    correct,
    responseTimeMs: Math.max(0, Number(responseTimeMs || 0)),
    sessionId,
    groupId,
    wasNew: Boolean(wasNew),
    reviewedAt: new Date().toISOString()
  };
}

export function answerJustification(card, letter) {
  return card.justifications?.[letter] || card.justifications?._ || '';
}

export function formatCardBack(card) {
  const correctText = card.choices?.[card.correctAnswer] || '';
  const why = answerJustification(card, card.correctAnswer);
  return {
    answerLine: `${card.correctAnswer}${correctText ? `. ${correctText}` : ''}`,
    explanation: why || 'Review the official explanation for the CISA logic behind this answer.'
  };
}

export function mergeUniqueLibrary(existing, incoming) {
  const decks = new Map((existing?.decks || []).map(deck => [`${deck.scopeKey}:${deck.id}`, deck]));
  const cards = new Map((existing?.cards || []).map(card => [`${card.scopeKey}:${card.id}`, card]));
  for (const deck of incoming?.decks || []) decks.set(`${deck.scopeKey}:${deck.id}`, { ...(decks.get(`${deck.scopeKey}:${deck.id}`) || {}), ...deck });
  for (const card of incoming?.cards || []) {
    const key = `${card.scopeKey}:${card.id}`;
    const old = cards.get(key) || {};
    cards.set(key, { ...old, ...card, deckIds: [...new Set([...(old.deckIds || []), ...(card.deckIds || [])])] });
  }
  return { ...(existing || {}), decks: [...decks.values()], cards: [...cards.values()] };
}
