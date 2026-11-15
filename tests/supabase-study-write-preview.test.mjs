import assert from 'node:assert/strict';
import { createSupabaseStudyWritePreview } from '../scripts/migration/supabase-study-write-preview.mjs';

const auth = { currentUser: { async getIdToken() { return 'test-token'; } } };
const preview = createSupabaseStudyWritePreview({
  auth, projectRef: 'testprojectreference', publishableKey: 'sb_publishable_test',
});
const changes = [{ collection: 'studyProgress', id: 'card', expected: null, data: { id: 'card' } }];
const fetchBefore = globalThis.fetch;
const attempts = [];

try {
  globalThis.fetch = async (url, options) => {
    assert.match(url, /rpc\/controlquest_preview_save_study$/);
    assert.equal(options.headers.Authorization, 'Bearer test-token');
    attempts.push(JSON.parse(options.body));
    if (attempts.length === 1) throw new TypeError('Response lost');
    return Response.json({ operationId: 'stable-id', status: 'already_saved' });
  };
  await assert.rejects(() => preview.save('stable-id', changes), /Response lost/);
  assert.equal((await preview.save('stable-id', changes)).status, 'already_saved');
  assert.deepEqual(attempts[0], attempts[1]);

  globalThis.fetch = async () => Response.json({ operationId: 'different-id', status: 'saved' });
  await assert.rejects(() => preview.save('stable-id', changes), /did not confirm/);
  globalThis.fetch = async () => Response.json({ code: '40001', message: 'Reload before retrying.' }, { status: 500 });
  await assert.rejects(() => preview.save('stable-id', changes), { code: '40001' });

  auth.currentUser = null;
  await assert.rejects(() => preview.loadRecord('studyProgress', 'card'), /account changed/);
} finally {
  globalThis.fetch = fetchBefore;
}
console.log('Supabase write preview: exact retries, receipts, stale-write conflicts and account changes passed.');
