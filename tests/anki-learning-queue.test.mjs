import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { nextLearningReview, resumeLearningReview } from '../js/study-session.js';
import { progressKey, rateCard } from '../js/flashcard-engine.js';
import { buildDailyPlan } from '../js/study-intelligence.js';

const start = Date.parse('2026-11-08T15:00:00Z');
const iso = offset => new Date(start + offset).toISOString();
const queue = ['answered', 'unseen', 'answered'];
const delayed = { answered: iso(60_000) };
assert.equal(resumeLearningReview(queue, 1, delayed, key => key, start + 59_999), false);
assert.equal(nextLearningReview(delayed).dueAt, iso(60_000));
assert.equal(resumeLearningReview(queue, 1, delayed, key => key, start + 60_000), true);
assert.deepEqual(queue, ['answered', 'answered', 'unseen'], 'Reinsert a due learning card without duplicating unread entries');
assert.deepEqual(delayed, {});

const card = { id: 'q', scope: 'Personal', scopeKey: 'personal_anki', question: 'Which evidence is independently verified?', choices: { A: 'A confirmation', B: 'An assumption' }, correctAnswer: 'A', deckIds: [] };
const learning = rateCard(card, null, 'Again', undefined, iso(0));
const matureCard = { ...card, id: 'r', question: 'Which control prevents conflicts?' };
const unseenCard = { ...card, id: 'n', question: 'How do you verify a sample?' };
const mature = { state: 'review', repetitions: 1, dueAt: iso(0) };
const ledger = [{ id: 'intro', wasNew: true, reviewedAt: iso(0) }, { id: 'review', wasNew: false, schedulerState: 'review', reviewedAt: iso(0) }];
const budget = { newCardsPerDay: 1, maxReviewsPerDay: 1 };
const plan = now => buildDailyPlan([card, matureCard, unseenCard], { [progressKey(card)]: learning, [progressKey(matureCard)]: mature }, ledger, { now, reviewSettings: budget });
assert.deepEqual(plan(start).cards, [], 'Capped new and mature reviews do not pull unfinished learning forward');
assert.deepEqual(plan(start + 60_000).cards.map(item => item.id), ['q'], 'Ready learning continues after the daily limits');

const dom = new JSDOM('<main id="root"></main>', { url: 'https://cq.test', pretendToBeVisual: true });
for (const key of ['window', 'document', 'localStorage', 'navigator']) Object.defineProperty(globalThis, key, { value: dom.window[key], configurable: true });
let experience = await import('../js/experience.js?anki');
const $ = selector => document.querySelector(selector);
const calls = [];
const context = {
  user: { uid: 'anki' }, profile: { stats: {}, preferences: {}, v3: {} },
  library: { cards: [card], decks: [], progress: {}, reviews: [] },
  avatar: () => '', toast: () => {}, saveQuiet: () => {},
  navigate: () => context.render(),
  render() { $('#root').innerHTML = experience.renderExperience('feed', context); experience.bindExperience('feed', context); },
  async review(item, input) {
    calls.push(input);
    context.library.progress[progressKey(item)] = rateCard(item, context.library.progress[progressKey(item)], input.rating, undefined, input.reviewedAt);
  },
};

try {
  experience.startFreeReview(context, 'new');
  $('[data-cq-choice="B"]').click(); $('#cqReveal').click(); $('#cqNextQuestion').click();
  assert.ok($('#cqLearningWait'), 'A wrong answer waits when there are no other cards');
  assert.equal($('#cqStudyCard'), null, 'The same answer is not drilled immediately');
  await new Promise(resolve => setTimeout(resolve, 10));
  assert.equal(calls.length, 1);
  assert.equal(calls[0].rating, 'Again');
  experience = await import('../js/experience.js?anki-reload');
  context.render();
  assert.ok($('#cqLearningWait'), 'Reload restores the countdown from the saved session');
  const stored = context.profile.v3.pocketSession;
  stored.delayedReviews[Object.keys(stored.delayedReviews)[0]] = new Date(Date.now() - 1).toISOString();
  localStorage.setItem('cq-pocket-anki', JSON.stringify(stored));
  experience = await import('../js/experience.js?anki-due');
  context.render();
  assert.ok($('#cqStudyCard'), 'Reload after the due time resumes the same learning question');
  assert.equal(context.profile.v3.pocketSession.index, 1);
  assert.equal(context.profile.v3.pocketSession.queue.length, 2);
  assert.equal(calls.length, 1, 'Resuming does not save the previous answer again');
} finally {
  dom.window.close();
}
console.log('Anki-style scheduling: time-based learning, daily limits, chronological queueing, and reload passed.');
