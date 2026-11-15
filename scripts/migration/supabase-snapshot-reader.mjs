import { splitStudyRecords } from '../../js/firebase-service.js';

const pageSize = 100;
const clause = (column, operator, value) => {
  const escaped = value.replaceAll('\\', '\\\\').replaceAll('"', '\\"');
  return `${column}.${operator}."${escaped}"`;
};

// Keep the reader bound to one Firebase session throughout a paginated read.
export function createSupabaseSnapshotReader({ projectRef, publishableKey, auth }) {
  if (!/^[a-z0-9]{20}$/.test(projectRef) || !publishableKey?.startsWith('sb_publishable_')) {
    throw new Error('Select a Supabase project and its publishable key.');
  }
  const endpoint = `https://${projectRef}.supabase.co/rest/v1/controlquest_documents`;
  const user = auth.currentUser;
  if (!user) throw new Error('Sign in to preview your migrated data.');
  const ownCollection = `users/${user.uid}`;

  async function fetchRows(filters) {
    if (auth.currentUser !== user) throw new Error('Your signed-in account changed.');
    const token = await user.getIdToken();
    if (auth.currentUser !== user) throw new Error('Your signed-in account changed.');
    const query = new URLSearchParams({ select: 'path,data', ...filters });
    const response = await fetch(`${endpoint}?${query}`, {
      headers: { apikey: publishableKey, Authorization: `Bearer ${token}` },
      redirect: 'error',
      cache: 'no-store',
    });
    if (!response.ok) throw new Error(`Supabase snapshot read failed (HTTP ${response.status}).`);
    const rows = await response.json();
    if (!Array.isArray(rows)) throw new Error('Supabase returned an invalid snapshot response.');
    if (auth.currentUser !== user) throw new Error('Your signed-in account changed.');
    return rows;
  }

  async function loadDocument(path) {
    const [row] = await fetchRows({ and: `(${clause('path', 'eq', path)})`, limit: '1' });
    return row?.data ?? null;
  }

  async function loadCollection(path) {
    const records = [];
    let after;
    while (true) {
      const conditions = [clause('collection_path', 'eq', path)];
      if (after) conditions.push(clause('path', 'gt', after));
      const page = await fetchRows({
        and: `(${conditions.join(',')})`,
        order: 'path.asc',
        limit: String(pageSize),
      });
      for (const row of page) records.push({ id: row.path.split('/').at(-1), ...row.data });
      if (page.length < pageSize) return records;
      after = page.at(-1).path;
    }
  }

  return {
    loadProfile: () => loadDocument(ownCollection),
    loadGroup: groupId => groupId ? loadDocument(`groups/${groupId}`) : Promise.resolve(null),
    async loadStudyLibrary(groupId) {
      const scopes = [ownCollection];
      if (groupId) scopes.push(`groups/${groupId}`);
      const [deckCollections, cardCollections, progress, reviews] = await Promise.all([
        Promise.all([...scopes.map(scope => `${scope}/studyDecks`), 'publicStudyDecks'].map(loadCollection)),
        Promise.all([...scopes.map(scope => `${scope}/studyCards`), 'publicStudyCards'].map(loadCollection)),
        loadCollection(`${ownCollection}/studyProgress`),
        loadCollection(`${ownCollection}/studyReviews`),
      ]);
      return {
        decks: deckCollections.flat(),
        cards: cardCollections.flat(),
        progress: Object.fromEntries(progress.map(record => [record.id, record])),
        ...splitStudyRecords(reviews),
      };
    },
    async loadCommunityLibrary() {
      const [contributions, statuses] = await Promise.all([
        loadCollection('publicLessonContributions'),
        loadCollection('publicLessonStatus'),
      ]);
      return { contributions, statuses: Object.fromEntries(statuses.map(record => [record.id, record])) };
    },
  };
}
