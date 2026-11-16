import { LESSONS, cardLesson, deckLesson } from './lesson-catalog.js';

export const VOYAGE_PORTS = [
  { id: 'd1', name: 'Audit Anchorage', specialty: 'Information Systems Auditing' },
  { id: 'd2', name: 'Council Cay', specialty: 'IT Governance and Management' },
  { id: 'd3', name: 'Shipwright’s Reef', specialty: 'Systems Acquisition and Development' },
  { id: 'd4', name: 'Stormwatch Strait', specialty: 'Operations and Business Resilience' },
  { id: 'd5', name: 'The Iron Vault', specialty: 'Protection of Information Assets' },
];

const letters = ['A', 'B', 'C', 'D'];
const lessonIdsFor = domainId => LESSONS.filter(lesson => lesson.domainId === domainId).map(lesson => lesson.id);
const validCompletion = value => typeof value === 'string' && Number.isFinite(Date.parse(value));
const normalizedText = value => value.trim().toLowerCase().replace(/\s+/g, ' ');

export function voyageReadiness(members, domainId) {
  const lessons = lessonIdsFor(domainId);
  const crew = Object.entries(members || {}).map(([uid, member]) => {
    const confirmed = member?.homework?.confirmedLessonIds;
    const assignments = member?.homework?.assignments;
    const verified = new Set(Array.isArray(confirmed) ? confirmed : []);
    const completed = new Set((Array.isArray(assignments) ? assignments : [])
      .filter(item => verified.has(item?.lessonId) && validCompletion(item?.completedAt)).map(item => item.lessonId));
    const done = lessons.filter(id => completed.has(id)).length;
    return {
      uid, name: member?.name || 'Guild member', done,
      needsSync: !Array.isArray(confirmed),
      complete: lessons.length > 0 && done === lessons.length,
    };
  });
  return {
    crew, lessonCount: lessons.length,
    readyCount: crew.filter(member => member.complete).length,
    unlocked: crew.length > 0 && crew.every(member => member.complete),
  };
}

function voyageLesson(card, decks) {
  const related = decks.filter(deck => deck.scopeKey === card.scopeKey && card.deckIds?.includes(deck.id));
  const overrides = [...new Set(related.filter(deck => deck.categoryOverride).map(deck => deckLesson(deck)?.id).filter(Boolean))];
  if (overrides.length > 1) return null;
  if (overrides.length === 1) return LESSONS.find(lesson => lesson.id === overrides[0]);
  const identified = cardLesson(card);
  if (identified) return identified;
  const linked = [...new Set(related.map(deck => deckLesson(deck)?.id).filter(Boolean))];
  return linked.length === 1 ? LESSONS.find(lesson => lesson.id === linked[0]) : null;
}

function shuffle(items, random) {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const other = Math.floor(random() * (i + 1));
    [result[i], result[other]] = [result[other], result[i]];
  }
  return result;
}

export function buildVoyageRounds(cards, decks, domainId, groupId, random = Math.random) {
  const buckets = new Map();
  const answers = new Map();
  const conflicts = new Set();
  // Prefer the Guild's copy when the same question also exists in the public library.
  const shared = [...cards].sort((a, b) => Number(b.scope === 'Guild') - Number(a.scope === 'Guild'));
  for (const card of shared) {
    if (!(card.scope === 'Public' || (card.scope === 'Guild' && card.scopeKey === `guild_${groupId}`))) continue;
    if (!card.id || !card.scopeKey || !card.question?.trim() || card.answerConflict || card.homeworkExcluded) continue;
    const lesson = voyageLesson(card, decks);
    const choices = Object.fromEntries(letters.filter(letter => typeof card.choices?.[letter] === 'string' && card.choices[letter].trim())
      .map(letter => [letter, card.choices[letter]]));
    if (lesson?.domainId !== domainId || !Object.hasOwn(choices, card.correctAnswer) || Object.keys(choices).length < 2) continue;
    const dedupKey = [normalizedText(card.question), ...Object.values(choices).map(normalizedText).sort()].join('\n');
    const answer = normalizedText(choices[card.correctAnswer]);
    if (answers.has(dedupKey)) {
      if (answers.get(dedupKey) !== answer) conflicts.add(dedupKey);
      continue;
    }
    answers.set(dedupKey, answer);
    const snapshot = {
      id: card.id, scope: card.scope, scopeKey: card.scopeKey, deckIds: card.deckIds || [],
      lessonId: lesson.id, domainId, domain: lesson.domain, question: card.question, choices,
      correctAnswer: card.correctAnswer, justifications: card.justifications || {},
    };
    if (card.fingerprint) snapshot.fingerprint = card.fingerprint;
    if (!buckets.has(lesson.id)) buckets.set(lesson.id, []);
    buckets.get(lesson.id).push({ dedupKey, snapshot });
  }
  const groups = shuffle([...buckets.values()], random)
    .map(items => shuffle(items.filter(item => !conflicts.has(item.dedupKey)).map(item => item.snapshot), random));
  const rounds = [];
  // Work across the whole domain before taking another question from a lesson.
  for (let index = 0; rounds.length < 12 && groups.some(items => items.length > index); index++) {
    for (const items of groups) {
      if (items[index]) rounds.push(items[index]);
      if (rounds.length === 12) break;
    }
  }
  return rounds;
}

export function validateVoyageStart(session, { id: groupId, members }) {
  const { domainId, rounds } = session.voyage;
  if (!voyageReadiness(members, domainId).unlocked) {
    throw new Error('This voyage unlocks when every Guild member has completed the domain.');
  }
  if (!Array.isArray(rounds) || rounds.length !== session.cardKeys.length || rounds.length > 12
      || rounds.some((card, index) => !card || card.domainId !== domainId
        || !(card.scope === 'Public' || (card.scope === 'Guild' && card.scopeKey === `guild_${groupId}`))
        || `${card.scopeKey}|${card.id}` !== session.cardKeys[index]
        || !letters.includes(card.correctAnswer) || !card.choices?.[card.correctAnswer])) {
    throw new Error('The route needs a valid set of shared questions.');
  }
  return { domainId, rounds: structuredClone(rounds), history: {}, fullSailUsed: {}, crewGold: 0 };
}

export function voyageCaptain(session) {
  const crew = session.participants || [];
  return crew.includes(session.voyage?.captainUid) ? session.voyage.captainUid : crew.length ? crew[session.index % crew.length] : null;
}

export function scoreVoyageRound(voyage, responses, crew, index, at, captain) {
  const correctCount = crew.filter(uid => responses[uid]?.correct).length;
  const gold = correctCount * 2 + (responses[captain]?.correct ? 1 : 0)
    + (correctCount > 1 && correctCount === crew.length ? crew.length : 0);
  voyage.crewGold += gold;
  voyage.history[index] = { responses: structuredClone(responses), gold, revealedAt: at || null };
}
