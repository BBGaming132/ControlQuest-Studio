import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { LESSONS } from '../js/lesson-catalog.js';
import { buildVoyageRounds, voyageCaptain, voyageReadiness } from '../js/guild-voyage.js';
import { reduceGuildSession } from '../js/guild-session.js';
import { renderVoyageLobby, renderVoyageSession } from '../js/guild-voyage-view.js';
import { loadGroup, mutateGuildSession, saveGroup } from '../js/firebase-service.js';

const completedAt = '2026-11-15T17:00:00.000Z';
const assignments = LESSONS.filter(lesson => lesson.domainId === 'd1')
  .map(lesson => ({ lessonId: lesson.id, completedAt }));
const complete = { assignments, confirmedLessonIds: assignments.map(lesson => lesson.lessonId) };
const incomplete = { assignments, confirmedLessonIds: complete.confirmedLessonIds.slice(1) };
const group = { id: 'g', members: { ty: { name: 'Ty', homework: complete }, a: { name: '<img src=bad>', homework: complete } } };
const oldGroup = { ...group, members: { ...group.members, a: { homework: { assignments } } } };
const pendingGroup = { ...group, members: { ...group.members, a: { homework: incomplete } } };
assert.equal(voyageReadiness(group.members, 'd1').unlocked, true);
assert.equal(voyageReadiness(pendingGroup.members, 'd1').unlocked, false);
assert.equal(voyageReadiness(oldGroup.members, 'd1').crew[1].needsSync, true);
assert.equal(voyageReadiness(group.members, 'd2').unlocked, false);

const card = (id, extra = {}) => ({ id, scope: 'Guild', scopeKey: 'guild_g', lessonId: assignments[0].lessonId,
  question: `How to audit control ${id}?`, choices: { A: 'Inspect the evidence', B: 'Assume the control works' },
  correctAnswer: 'A', ...extra });
const bank = [
  card('one'), card('two', { lessonId: assignments[1].lessonId }),
  card('private', { scope: 'Personal', scopeKey: 'personal_ty' }),
  card('other', { scopeKey: 'guild_other' }),
  card('disputed'), card('conflict', { question: 'How to audit control disputed?', correctAnswer: 'B' }),
];
const rounds = buildVoyageRounds(bank, [], 'd1', 'g', () => .75);
assert.deepEqual(rounds.map(item => item.id), ['one', 'two']);
const session = { id: 'trip', cardKeys: rounds.map(question => `${question.scopeKey}|${question.id}`), voyage: { domainId: 'd1', rounds } };
const launch = { type: 'start', uid: 'ty', session };
assert.throws(() => reduceGuildSession(null, launch, pendingGroup), /every Guild member/);
assert.throws(() => reduceGuildSession(null, { ...launch, uid: 'outsider' }, group), /current Guild members/);
let game = reduceGuildSession(null, launch, group);
const action = (type, uid, extra) => { game = reduceGuildSession(game, { type, uid, sessionId: game.id, index: game.index, ...extra }, group); };
action('join', 'a');
assert.equal(voyageCaptain(game), 'ty');
action('answer', 'ty', { answer: 'A', charge: true, at: completedAt });
assert.throws(() => action('reveal', 'a'), /each joined player/);
action('answer', 'a', { answer: 'A' });
action('reveal', 'ty', { correctAnswer: 'B' });
assert.equal(game.scores.ty, 210);
assert.equal(game.scores.a, 120);
assert.equal(game.voyage.crewGold, 7);
action('reveal', 'ty');
assert.equal(game.voyage.crewGold, 7);
action('next', 'a');
assert.equal(voyageCaptain(game), 'a');
assert.equal(game.voyage.history[0].responses.ty.at, completedAt);
assert.deepEqual(game.responses, {});
assert.throws(() => action('answer', 'ty', { answer: 'A', charge: true }), /already used Full Sail/);

const storage = new Map();
globalThis.localStorage = {
  getItem: key => storage.get(key) ?? null,
  setItem: (key, value) => storage.set(key, value),
};
await saveGroup({ ...group, studySession: game }, { includeLiveState: true });
await mutateGuildSession(group.id, { type: 'end', uid: 'ty', sessionId: game.id, index: game.index });
const restarted = await mutateGuildSession(group.id, { ...launch, session: { ...session, id: 'next-trip' } });
const persisted = await loadGroup(group.id);
assert.equal(restarted.commandVersion, 2);
assert.equal(persisted.recentVoyages[0].id, 'trip');
assert.equal(persisted.recentVoyages[0].voyage.history[0].responses.ty.at, completedAt);
await saveGroup({ ...persisted, recentVoyages: [] });
assert.equal((await loadGroup(group.id)).recentVoyages[0].id, 'trip');

const lobby = new JSDOM(renderVoyageLobby({ group: pendingGroup, cards: bank, decks: [] })).window.document;
assert.equal(lobby.querySelector('[data-pirate-launch]'), null);
const unlocked = new JSDOM(renderVoyageLobby({ group, cards: bank, decks: [] })).window.document;
assert.equal(unlocked.querySelector('[data-pirate-launch]').dataset.pirateLaunch, 'd1');
game.voyage.crewGold = '<img src=bad>';
const view = new JSDOM(renderVoyageSession({ session: game, group, uid: 'a', charge: true })).window.document;
assert.equal(view.querySelector('img'), null);
assert.equal(view.querySelector('#pirateFullSail').checked, true);
assert.equal(view.querySelector('#revealGuildAnswer').disabled, true);
assert.match(view.querySelector('.pirate-question__crew').textContent, /at the helm/);
console.log('Guild voyages: verified domain gate, shared questions, crew turns, wager, replay and safe interface passed.');
