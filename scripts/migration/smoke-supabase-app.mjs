// Uses a disposable Firebase account and synthetic app records only.
// Remove its study records and Guild administratively after the smoke test.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { firebaseConfig } from '../../config/firebase-config.js';
import { createSupabaseDatabase } from '../../js/supabase-database.js';

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
  await Promise.all([increment(), increment()]);
  assert.equal((await store.getDoc(progress)).data().repetitions, 3);
  await assert.rejects(() => store.setDoc(store.doc({}, 'users', 'different-user'), { uid: 'different-user' }), {
    code: 'permission-denied',
  });
  console.log('Hosted Supabase application adapter passed with a regular Firebase login.');
} finally {
  await firebase('delete', { idToken: account.idToken });
  console.log('Temporary Firebase account removed.');
}
