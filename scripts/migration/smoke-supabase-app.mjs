// Uses a disposable Firebase account and synthetic app records only.
// Remove its study records and Guild administratively after the smoke test.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { firebaseConfig } from '../../config/firebase-config.js';
import { createSupabaseDatabase } from '../../js/supabase-database.js';
import { LESSONS } from '../../js/lesson-catalog.js';
import { reduceGuildSession } from '../../js/guild-session.js';

async function firebase(action, body) {
  const response = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:${action}?key=${firebaseConfig.apiKey}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error(`Firebase ${action} returned HTTP ${response.status}`);
  return response.json();
}

const marker = `cq-smoke-${randomUUID()}`;
const account = await firebase('signUp', {
  email: `${marker}@example.com`, password: randomUUID(), returnSecureToken: true,
});
console.log('Temporary database fixture:', marker);
const uid = account.localId;
const auth = { currentUser: { uid, getIdToken: async () => account.idToken } };
const store = createSupabaseDatabase({ ...firebaseConfig.supabase, auth });
const profile = store.doc({}, 'users', uid);
const group = store.doc({}, 'groups', marker);
const review = store.doc(profile, 'studyReviews', 'review_test');
const homework = store.doc(profile, 'studyReviews', 'homework_completion_d1-t01');
const progress = store.doc(profile, 'studyProgress', 'card-test');
const card = store.doc(group, 'studyCards', 'card-test');

async function exerciseGuildTurns() {
  const crewmate = await firebase('signUp', {
    email: `${marker}-crew@example.com`, password: randomUUID(), returnSecureToken: true,
  });
  try {
    const secondUid = crewmate.localId;
    const second = createSupabaseDatabase({ ...firebaseConfig.supabase,
      auth: { currentUser: { uid: secondUid, getIdToken: async () => crewmate.idToken } } });
    const confirmedLessonIds = LESSONS.filter(lesson => lesson.domainId === 'd1').map(lesson => lesson.id);
    const homework = { confirmedLessonIds, assignments: confirmedLessonIds.map(lessonId => ({
      lessonId, completedAt: '2026-11-15T20:00:00.000Z',
    })) };
    await second.joinGuild(marker, 'SMOKE', { uid: secondUid, name: 'Test crew' });
    await store.updateDoc(group, { [`members.${uid}.homework`]: homework });
    const rounds = ['first', 'second'].map(id => ({
      id, scope: 'Public', scopeKey: 'public', lessonId: 'd1-t01', domainId: 'd1',
      question: 'Which option is the example test answer?', choices: { A: 'First', B: 'Second' }, correctAnswer: 'A',
    }));
    const session = { id: marker, cardKeys: rounds.map(round => `public|${round.id}`), voyage: { domainId: 'd1', rounds } };
    const command = (backend, userId, type, fields = {}) => backend.runTransaction({}, async transaction => {
      const savedGroup = (await transaction.get(group)).data();
      const studySession = reduceGuildSession(savedGroup.studySession, {
        type, uid: userId, sessionId: marker, ...fields,
      }, savedGroup);
      transaction.update(group, { studySession });
      return studySession;
    });
    await assert.rejects(() => command(store, uid, 'start', { session }), /every Guild member/);
    await second.updateDoc(group, { [`members.${secondUid}.homework`]: homework });
    await command(store, uid, 'start', { session });
    await command(second, secondUid, 'join');
    await assert.rejects(() => command(store, uid, 'reveal', { index: 0 }), /each joined player/);
    await Promise.all([
      command(store, uid, 'answer', { answer: 'A', index: 0 }),
      command(second, secondUid, 'answer', { answer: 'A', index: 0 }),
    ]);
    await Promise.all([
      command(store, uid, 'reveal', { index: 0 }),
      command(second, secondUid, 'reveal', { index: 0 }),
    ]);
    const saved = (await second.getDoc(group)).data().studySession;
    assert.equal(saved.voyage.crewGold, 7);
    assert.equal(Object.keys(saved.voyage.history).length, 1);
    assert.equal(saved.scores[uid], 120);
    assert.equal(saved.scores[secondUid], 120);
    assert.equal((await command(store, uid, 'next', { index: 0 })).voyage.captainUid, secondUid);
    console.log('Two Firebase identities passed a hosted Guild voyage, including the unlock gate, concurrent answers, once-only scoring and captain rotation.');
  } finally {
    await firebase('delete', { idToken: crewmate.idToken });
  }
}

try {
  assert.equal((await store.getDoc(profile)).exists(), false);
  assert.ok((await store.getDocs(store.collection({}, 'publicLessonContributions'))).docs.length >= 740);
  await store.setDoc(profile, { uid, smokeMarker: marker, v3: { previous: true } });
  await store.setDoc(profile, { v3: { current: true } }, { mergeFields: ['v3'] });
  assert.deepEqual((await store.getDoc(profile)).data().v3, { current: true });
  await store.setDoc(group, { id: marker, ownerUid: uid, code: 'SMOKE', members: { [uid]: { uid } } });
  await store.setDoc(card, { id: card.id, deckIds: ['a'] });
  await store.setDoc(card, { deckIds: store.arrayUnion('a', 'b') }, { merge: true });
  await store.updateDoc(card, { deckIds: store.arrayRemove('a') });
  assert.deepEqual((await store.getDoc(card)).data().deckIds, ['b']);
  await store.updateDoc(group, { 'lessonStatus.d1-t01': { completed: true } });
  assert.equal((await store.getDoc(group)).data().lessonStatus['d1-t01'].completed, true);
  const batch = store.writeBatch();
  batch.set(progress, { uid, id: progress.id, repetitions: 1 });
  batch.set(review, { uid, id: review.id, rating: 'Good' });
  await batch.commit();
  const complete = { uid, id: homework.id, recordType: 'homework-completion', key: 'd1-t01', value: { lessonId: 'd1-t01' } };
  await store.runTransaction({}, async tx => {
    assert.equal((await tx.get(homework)).exists(), false);
    tx.set(homework, complete);
  });
  assert.deepEqual((await store.getDoc(homework)).data(), complete);
  const increment = () => store.runTransaction({}, async tx => {
    const before = (await tx.get(progress)).data().repetitions;
    tx.update(progress, { repetitions: before + 1 });
  });
  const rounds = process.argv.includes('--stress') ? 8 : 1;
  const writers = rounds > 1 ? 3 : 2;
  for (let round = 0; round < rounds; round += 1) {
    await Promise.all(Array.from({ length: writers }, increment));
  }
  assert.equal((await store.getDoc(progress)).data().repetitions, 1 + rounds * writers);
  await assert.rejects(() => store.setDoc(store.doc({}, 'users', 'different-user'), { uid: 'different-user' }), {
    code: 'permission-denied',
  });
  if (process.argv.includes('--voyage')) await exerciseGuildTurns();
  console.log(`Hosted Supabase application adapter passed with a regular Firebase login and ${rounds * writers} concurrent-program updates.`);
} finally {
  await firebase('delete', { idToken: account.idToken });
  console.log('Temporary Firebase account removed.');
}
