import assert from 'node:assert/strict';
import { createSupabaseSnapshotReader } from '../scripts/migration/supabase-snapshot-reader.mjs';

const user = { uid: 'preview-user', getIdToken: async () => 'firebase-test-token' };
const auth = { currentUser: user };
const publishableKey = 'sb_publishable_test';
const projectRef = 'testprojectreference';
const ownPath = 'users/preview-user';
const cardPath = 'groups/test-guild/studyCards';
const cards = Array.from({ length: 101 }, (_, index) => ({
  path: `${cardPath}/card:${String(index).padStart(3, '0')}`,
  data: { question: `Question ${index}` },
}));
const originalFetch = globalThis.fetch;

try {
  const cardQueries = [];
  globalThis.fetch = async (address, options) => {
    const url = new URL(address);
    assert.equal(url.hostname, `${projectRef}.supabase.co`);
    assert.equal(options.headers.apikey, publishableKey);
    assert.equal(options.headers.Authorization, 'Bearer firebase-test-token');
    const query = url.searchParams.get('and');
    if (query === `(path.eq."${ownPath}")`) return Response.json([{ data: { uid: user.uid } }]);
    if (query === `(collection_path.eq."${ownPath}/studyReviews")`) {
      return Response.json([
        { path: `${ownPath}/studyReviews/ordinary`, data: { reviewedAt: '2026-11-15' } },
        { path: `${ownPath}/studyReviews/quiz`, data: { recordType: 'homework-quiz', key: 'week-1', value: { status: 'submitted' } } },
      ]);
    }
    if (query.includes(cardPath)) {
      cardQueries.push(query);
      return Response.json(query.includes('path.gt.') ? cards.slice(100) : cards.slice(0, 100));
    }
    return Response.json([]);
  };

  const reader = createSupabaseSnapshotReader({ projectRef, publishableKey, auth });
  assert.deepEqual(await reader.loadProfile(), { uid: user.uid });
  const library = await reader.loadStudyLibrary('test-guild');
  assert.equal(library.cards.length, 101);
  assert.equal(library.cards.at(-1).id, 'card:100');
  assert.equal(cardQueries.length, 2);
  assert.equal(cardQueries[1], `(collection_path.eq."${cardPath}",path.gt."${cardPath}/card:099")`);
  assert.deepEqual(library.homeworkQuizzes['week-1'], { status: 'submitted' });
  assert.equal(library.reviews.length, 1);

  auth.currentUser = null;
  await assert.rejects(() => reader.loadProfile(), /account changed/);
  auth.currentUser = user;
  globalThis.fetch = async () => new Response(null, { status: 401 });
  await assert.rejects(() => reader.loadProfile(), /HTTP 401/);
} finally {
  globalThis.fetch = originalFetch;
}

console.log('Supabase snapshot reader: pagination, scope, homework, and session checks passed.');
