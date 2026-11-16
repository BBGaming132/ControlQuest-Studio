import assert from 'node:assert/strict';
import { prepareSupabaseProfilePatch, reconcileReviewProgress } from '../js/firebase-service.js';
import { createReviewOutbox } from '../js/review-outbox.js';

const first = '2026-11-15T19:00:00Z';
const second = '2026-11-15T19:10:00Z';
const receipt = { id: 'old-answer', uid: 'test-learner', reviewedAt: first };
const alias = { id: 'p-b', cardId: 'b', scope: 'Guild', scopeKey: 'guild_test' };
const computed = [{ id: 'p-a', cardId: 'a' }, alias];
const current = {
  id: 'p-a', cardId: 'a', repetitions: 3, lastReviewedAt: second, lastReviewEventId: 'newer-answer',
  dueAt: '2026-11-18T19:10:00Z',
};
const reschedule = value => ({ ...value, repetitions: value.repetitions + 1 });
const merged = reconcileReviewProgress(computed, [current, null], receipt, reschedule);
assert.equal(merged[0].repetitions, 4);
assert.equal(merged[1].lastReviewEventId, 'newer-answer');
assert.equal(merged[1].dueAt, current.dueAt);
assert.equal(merged[1].cardId, 'b');
assert.equal(merged[1].scopeKey, 'guild_test');
assert.deepEqual(reconcileReviewProgress(computed, [{ ...current, resetAt: second }, null], receipt, reschedule), [null, null]);
assert.equal(reconcileReviewProgress(computed, [{ ...current, lastReviewEventId: receipt.id }, null], receipt, reschedule)[0], null);
const reset = { resetAt: '2026-11-15T19:05:00Z', id: 'p-b', cardId: 'b' };
assert.deepEqual(reconcileReviewProgress(computed, [current, reset], receipt, reschedule), [null, null]);
assert.equal(reconcileReviewProgress(computed, [{ ...current, lastReviewEventId: receipt.id }, null], receipt, reschedule)[1].repetitions, 3);

const initial = { uid: 'test-learner', v3: { world: 1 }, stats: { xp: 10 }, theme: 'dark' };
const baseline = { local: initial, remote: initial };
const anotherDevice = { ...initial, theme: 'light' };
const ownSave = { ...initial, stats: { xp: 12 } };
assert.deepEqual(prepareSupabaseProfilePatch(baseline, anotherDevice, ownSave), { stats: { xp: 12 } });
assert.throws(() => prepareSupabaseProfilePatch(baseline, { ...initial, stats: { xp: 11 } }, ownSave), /changed on another device/);
assert.deepEqual(prepareSupabaseProfilePatch(baseline, { ...anotherDevice, stats: { xp: 12 } }, ownSave), {});
assert.deepEqual(prepareSupabaseProfilePatch({ local: null, remote: null }, null, initial), initial);

const store = new Map();
const requests = [];
const queue = createReviewOutbox({
  storage: { getItem: key => store.get(key) ?? null, setItem: (key, value) => store.set(key, value) },
  key: 'safe-retry',
  async save(entry) {
    requests.push(entry);
    if (requests.length === 1) throw Object.assign(new Error('Connection lost'), { code: 'unavailable' });
  },
});
queue.enqueue({ id: 'old-answer', card: { id: 'a' }, input: { rating: 'Again', reviewedAt: first } });
await queue.idle();
assert.equal(queue.list()[0].state, 'failed');
assert.ok(queue.list()[0].retryAt, 'Network errors schedule a future retry');
await queue.retry();
assert.deepEqual(queue.list(), []);
assert.equal(requests.length, 2);
assert.equal(requests[1].id, requests[0].id);
assert.deepEqual(requests[1].input, requests[0].input);
console.log('Supabase review sync: concurrent schedule reconciliation, reset protection, and reconnect retries passed.');
