import { fsrs, createEmptyCard, Rating, State, BasicLearningStepsStrategy, StrategyMode, ConvertStepUnitToMinutes } from './vendor/ts-fsrs/index.mjs';
import { randomId } from './runtime-crypto.js';
import { cardLesson, LESSONS } from './lesson-catalog.js';
// FSRS-6 scheduler supplied by MIT-licensed ts-fsrs 5.4.2.
// ControlQuest owns the review UI, history, study plan and conservative legacy migration.

const DAY = 86400000;
const MINUTE = 60000;

export const DEFAULT_REVIEW_SETTINGS = Object.freeze({
  newCardsPerDay: 20,
  maxReviewsPerDay: 100,
  desiredRetention: 0.90,
  learningStepsMinutes: [1, 10],
  relearningStepsMinutes: [10],
  maximumIntervalDays: 36500,
  leechAction: 'tag',
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

export function buildImportBundle({ questions, title, scope = 'Guild', uid, groupId, importedBy = '', source = 'ISACA QAE Paste', lessonId = '' }) {
  const cleanTitle = String(title || questions?.[0]?.sessionTitle || 'Imported QAE Session').trim();
  const key = scopeKey(scope, uid, groupId);
  const importSeed = stableHash((questions || []).map(q => q.fingerprint || cardFingerprint(q.question, q.choices)).sort().join('|'));
  const lessonDeckId = makeDeckId(cleanTitle, scope, uid, groupId, importSeed);
  const masterId = masterDeckId(scope, uid, groupId);
  const missedId = missedDeckId(scope, uid, groupId);
  const now = new Date().toISOString();
  const cardsById = new Map();
  const selectedLesson = LESSONS.find(l=>l.id===lessonId);

  for (const original of questions || []) {
    const inferredLesson=cardLesson(original);
    // A practice exam spans the five domains. Its deck label must never replace
    // each question's actual domain or knowledge-statement lesson metadata.
    const lesson=(selectedLesson?.domainId!=='practice'?selectedLesson:null) || (inferredLesson?.domainId!=='practice'?inferredLesson:null);
    const q={...original, ...(lesson?{lessonId:lesson.id,lessonTitle:lesson.title,domain:lesson.domain,domainNumber:Number(lesson.domainId.slice(1)),domainName:lesson.domainName}:{})};
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
      source: [...(q.sources||[]),source].includes('ISACA QAE Paste')?'ISACA QAE Paste':source,
      sources: [...new Set([...(q.sources||[]),source])],
      sourceQuestionId: q.id || null,
      sessionTitle: cleanTitle,
      questionNumber: q.number || null,
      question: q.question || '',
      choices: q.choices || {},
      correctAnswer: q.correctAnswer || '',
      userAnswerAtImport: q.userAnswer || null,
      wasCorrectAtImport: q.isCorrect,
      justifications: q.justifications || {},
      lessonId: q.lessonId || '',
      practiceExamId: selectedLesson?.domainId==='practice'?selectedLesson.id:'',
      lessonTitle: q.lessonTitle || '',
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
    contributors: importedBy ? [importedBy] : [],
    source,
    createdAt: now,
    updatedAt: now
  };
  const decks = [
    {
      ...deckBase,
      id: lessonDeckId,
      title: cleanTitle,
      description: `Imported question set with ${cards.length} unique questions and ${incorrect} missed questions.`,
      kind: 'lesson',
      ...(lessonId?{lessonId}:{}),
      lessonTitle: LESSONS.find(l=>l.id===lessonId)?.title || '',
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
    successfulRecallStreak: 0,
    validatedRecalls: 0,
    lastMissedAt: null,
    lastRating: null,
    lastReviewedAt: null,
    firstReviewedAt: null,
    updatedAt: new Date().toISOString()
  };
}

export function progressKey(card) {
  return `${card.scopeKey}__${card.id}`;
}

function clamp(value, min, max) { return Math.min(max, Math.max(min, value)); }
const states = { new:State.New, learning:State.Learning, review:State.Review, relearning:State.Relearning };
const stateNames = ['new','learning','review','relearning'];
export const REVIEW_RATINGS = Object.freeze([
  {rating:'Again', description:'Forgot or answered incorrectly', key:'1'},
  {rating:'Hard', description:'Correct, with serious difficulty', key:'2'},
  {rating:'Good', description:'Correct, with some effort', key:'3'},
  {rating:'Easy', description:'Correct, immediately and confidently', key:'4'}
]);
function scheduler(settings={}) {
  const steps=(value,fallback)=> (Array.isArray(value)&&value.length&&value.every(n=>Number.isFinite(n)&&n>0&&n<1440)?value:fallback).map(n=>`${n}m`);
  return fsrs({request_retention:clamp(Number(settings.desiredRetention)||0.9,0.7,0.97),
    maximum_interval:clamp(Math.round(Number(settings.maximumIntervalDays)||36500),1,36500),
    enable_fuzz:false,enable_short_term:true,
    learning_steps:steps(settings.learningStepsMinutes,DEFAULT_REVIEW_SETTINGS.learningStepsMinutes),
    relearning_steps:steps(settings.relearningStepsMinutes,DEFAULT_REVIEW_SETTINGS.relearningStepsMinutes)})
    .useStrategy(StrategyMode.LEARNING_STEPS,(params,state,index)=>{
      const info=BasicLearningStepsStrategy(params,state,index),list=state===State.Relearning||state===State.Review?params.relearning_steps:params.learning_steps;
      // Match Anki's Hard semantics after the first learning step: repeat that
      // step, rather than averaging the first two steps every time.
      if(index>0&&list[index]&&state!==State.Review)info[Rating.Hard]={scheduled_minutes:ConvertStepUnitToMinutes(list[index]),next_step:index};
      return info;
    });
}
function memoryCard(progress, now) {
  const p=progress||{}, saved=p.fsrs;
  if(saved&&Number.isFinite(saved.stability)&&saved.stability>=0&&Number.isFinite(saved.difficulty)&&Number.isFinite(Date.parse(saved.due))&&Number.isFinite(Date.parse(saved.last_review))) {
    return {...saved,due:new Date(saved.due),last_review:new Date(saved.last_review)};
  }
  const fresh=createEmptyCard(now);
  if(!(p.repetitions>0)) return fresh;
  // Preserve due dates until an actual review. Legacy ease is not a fitted FSRS
  // parameter; seed memory conservatively, and adapt from real future recalls.
  return {...fresh,due:Number.isFinite(Date.parse(p.dueAt))?new Date(p.dueAt):now,
    state:states[p.state]??State.New, stability:Math.max(0.1,Number(p.intervalDays)||1),difficulty:5,
    scheduled_days:Math.max(0,Number(p.intervalDays)||0),learning_steps:Math.max(0,Number(p.stepIndex)||0),
    reps:Math.max(0,Number(p.repetitions)||0),lapses:Math.max(0,Number(p.lapses)||0),
    last_review:Number.isFinite(Date.parse(p.lastReviewedAt))?new Date(p.lastReviewedAt):now};
}
function serializeMemory(card) {
  return {...card,due:card.due.toISOString(),...(card.last_review?{last_review:card.last_review.toISOString()}:{})};
}
export function isCardAvailable(progress, now=new Date()) {
  return !progress?.suspended && !(Number.isFinite(Date.parse(progress?.buriedUntil))&&Date.parse(progress.buriedUntil)>new Date(now).getTime());
}
export function setCardAvailability(progress, {suspended=progress?.suspended||false,buriedUntil=progress?.buriedUntil||null,now=new Date()}={}) {
  if(buriedUntil!==null&&!Number.isFinite(Date.parse(buriedUntil)))throw new TypeError('Bury-until date must be valid.');
  return {...progress,suspended:Boolean(suspended),buriedUntil,updatedAt:new Date(now).toISOString()};
}
export function resetCardProgress(card, progress, {uid=progress?.uid,now=new Date(),resetAccuracy=true}={}) {
  const at=new Date(now).toISOString(),fresh=defaultProgress(card,uid);
  // History remains in the review ledger. The cutoff marks the fresh learning epoch.
  return {...fresh,dueAt:at,updatedAt:at,resetAt:at,accuracyResetAt:resetAccuracy?at:progress?.accuracyResetAt||null,
    resetCount:(progress?.resetCount||0)+1,importedMiss:false,ignoreImportedMiss:true,
    ...(!resetAccuracy?{correctCount:progress?.correctCount||0,incorrectCount:progress?.incorrectCount||0,hardCount:progress?.hardCount||0,easyCount:progress?.easyCount||0}:{}),
    archivedProgress:progress?{repetitions:progress.repetitions||0,correctCount:progress.correctCount||0,incorrectCount:progress.incorrectCount||0,intervalDays:progress.intervalDays||0,lastReviewedAt:progress.lastReviewedAt||null}:null};
}
export function rateCard(card, existingProgress, rating, settings=DEFAULT_REVIEW_SETTINGS, reviewedAt=new Date()) {
  const normalizedRating=String(rating||'Good');
  if(!['Again','Hard','Good','Easy'].includes(normalizedRating))throw new TypeError('Choose Again, Hard, Good, or Easy.');
  const now=new Date(reviewedAt);if(!Number.isFinite(now.getTime()))throw new TypeError('Review date must be valid.');
  const p={...defaultProgress(card,existingProgress?.uid),...(existingProgress||{})};
  const wasReview=p.state==='review',success=normalizedRating!=='Again',strong=['Good','Easy'].includes(normalizedRating);
  const ahead=(p.repetitions||0)>0&&Number.isFinite(Date.parse(p.dueAt))&&now<new Date(p.dueAt);
  const result=scheduler(settings).next(memoryCard(existingProgress,now),now,Rating[normalizedRating]);
  p.repetitions=(Number(p.repetitions)||0)+1;
  p.correctCount=(Number(p.correctCount)||0)+(success?1:0);p.incorrectCount=(Number(p.incorrectCount)||0)+(success?0:1);
  p.hardCount=(Number(p.hardCount)||0)+(normalizedRating==='Hard'?1:0);p.easyCount=(Number(p.easyCount)||0)+(normalizedRating==='Easy'?1:0);
  p.answerStreak=success?(Number(p.answerStreak)||0)+1:0;
  p.successfulRecallStreak=strong?(Number(p.successfulRecallStreak)||0)+1:0;
  p.bestAnswerStreak=Math.max(Number(p.bestAnswerStreak)||0,p.answerStreak);
  p.validatedRecalls=(Number(p.validatedRecalls)||0)+(strong&&!ahead?1:0);
  if(!success)p.lastMissedAt=now.toISOString();
  p.lastRating=normalizedRating;p.lastReviewedAt=now.toISOString();p.firstReviewedAt||=p.lastReviewedAt;
  p.scheduler='FSRS-6 / ts-fsrs 5.4.2';
  if(!ahead||!success){
    p.fsrs=serializeMemory(result.card);p.state=stateNames[result.card.state];p.dueAt=result.card.due.toISOString();
    p.intervalDays=result.card.scheduled_days;p.stepIndex=result.card.learning_steps;
    p.lapses=(Number(existingProgress?.lapses)||0)+(!success&&wasReview?1:0);
  }
  // Extra correct practice records an attempt, but never pushes a future review
  // out or invents a scheduled recall. A forgotten answer still starts relearning.
  p.leech=(p.lapses||0)>=(Number(settings.leechThreshold)||DEFAULT_REVIEW_SETTINGS.leechThreshold);
  if(p.leech&&settings.leechAction==='suspend')p.suspended=true;
  p.updatedAt=now.toISOString();return p;
}
export function previewReviewIntervals(card,progress,settings=DEFAULT_REVIEW_SETTINGS,now=new Date()) {
  return REVIEW_RATINGS.map(item=>{const next=rateCard(card,progress,item.rating,settings,now),minutes=Math.max(1,Math.round((Date.parse(next.dueAt)-new Date(now).getTime())/MINUTE));
    return {...item,dueAt:next.dueAt,intervalDays:next.intervalDays,label:minutes<60?`${minutes}m`:minutes<1440?`${Math.round(minutes/60)}h`:`${Math.round(minutes/1440)}d`};});
}

export function isDue(progress, now = new Date()) {
  if (!progress) return true;
  if (!isCardAvailable(progress,now)) return false;
  const due=Date.parse(progress.dueAt);
  return !Number.isFinite(due) || due <= new Date(now).getTime();
}

export function cardMastery(progress) {
  if (!progress || progress.repetitions === 0) return 'New';
  if (progress.state === 'learning' || progress.state === 'relearning') return 'Learning';
  const total = (progress.correctCount || 0) + (progress.incorrectCount || 0);
  const accuracy = total ? (progress.correctCount || 0) / total : 0;
  const recalls=progress.validatedRecalls ?? 0;
  const successStreak=progress.successfulRecallStreak ?? progress.answerStreak ?? 0;
  if (progress.state==='review' && (progress.intervalDays||0)>=21 && accuracy>=0.8 && recalls>=3 && successStreak>=2 && ['Good','Easy'].includes(progress.lastRating)) return 'Mastered';
  return 'Reviewing';
}

export function hasUnresolvedMiss(card, progress, uid=progress?.uid) {
  const sourceMiss=!progress?.ignoreImportedMiss&&(progress?.importedMiss===true||(card?.wasCorrectAtImport===false&&(!uid||!card.ownerUid||card.ownerUid===uid)));
  const reviewedMiss = (progress?.resetAt ? Date.parse(progress.lastMissedAt)>Date.parse(progress.resetAt) : (progress?.incorrectCount || 0)>0) || progress?.lastRating==='Again';
  if (!sourceMiss && !reviewedMiss) return false;
  const recovered = (progress?.successfulRecallStreak ?? progress?.answerStreak ?? 0)>=2 && ['Good','Easy'].includes(progress?.lastRating);
  return !recovered;
}

export function buildStudyQueue(cards, progressMap, options = {}) {
  const now = options.now || new Date();
  const mode = options.mode || 'due';
  const limit = Math.max(1, options.limit || 20);
  const filtered = (cards || []).filter(card => {
    const p = progressMap?.[progressKey(card)];
    if (!options.includeUnavailable && !isCardAvailable(p,now)) return false;
    if (mode === 'leech') return p?.leech || (p?.lapses||0) >= (options.leechThreshold||8);
    if (mode === 'missed') return hasUnresolvedMiss(card,p,options.uid);
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
  weighted.sort((a, b) => (mode==='due'?Number(['learning','relearning'].includes(progressMap?.[progressKey(b.card)]?.state))-Number(['learning','relearning'].includes(progressMap?.[progressKey(a.card)]?.state)):0) || b.priority - a.priority || String(a.dueAt).localeCompare(String(b.dueAt)) || progressKey(a.card).localeCompare(progressKey(b.card)));
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
    id: randomId(),
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
  for (const deck of incoming?.decks || []) decks.set(`${deck.scopeKey}:${deck.id}`, { ...(decks.get(`${deck.scopeKey}:${deck.id}`) || {}), ...deck, contributors:[...new Set([...(decks.get(`${deck.scopeKey}:${deck.id}`)?.contributors||[]),...(deck.contributors||[])])] });
  for (const card of incoming?.cards || []) {
    const key = `${card.scopeKey}:${card.id}`;
    const old = cards.get(key) || {};
    cards.set(key, { ...old, ...card, deckIds: [...new Set([...(old.deckIds || []), ...(card.deckIds || [])])] });
  }
  return { ...(existing || {}), decks: [...decks.values()], cards: [...cards.values()] };
}
