// A retry must send the same operation ID and payload kept by its offline queue.
export function createSupabaseStudyWritePreview({ projectRef, publishableKey, auth }) {
  const user = auth.currentUser;
  if (!user) throw new Error('Sign in before saving.');
  if (!/^[a-z0-9]{20}$/.test(projectRef) || !publishableKey?.startsWith('sb_publishable_')) {
    throw new Error('Select a Supabase project and its publishable key.');
  }

  async function call(method, body) {
    if (auth.currentUser !== user) throw new Error('Your signed-in account changed.');
    const token = await user.getIdToken();
    if (auth.currentUser !== user) throw new Error('Your signed-in account changed.');
    const response = await fetch(`https://${projectRef}.supabase.co/rest/v1/rpc/${method}`, {
      method: 'POST',
      headers: {
        apikey: publishableKey,
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      cache: 'no-store',
      redirect: 'error',
    });
    const result = await response.json();
    if (auth.currentUser !== user) throw new Error('Your signed-in account changed.');
    if (!response.ok) {
      const error = new Error(result.message || `Supabase study request failed (HTTP ${response.status}).`);
      error.code = result.code;
      throw error;
    }
    return result;
  }

  return {
    loadRecord: (collection, id) => call('controlquest_preview_load_study_record', { bucket: collection, doc_id: id }),
    async save(operationId, changes) {
      const receipt = await call('controlquest_preview_save_study', { operation_id: operationId, changes });
      if (receipt?.operationId !== operationId || !['saved', 'already_saved'].includes(receipt.status)) {
        throw new Error('Supabase did not confirm this save.');
      }
      return receipt;
    },
  };
}
