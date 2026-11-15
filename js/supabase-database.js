const pageSize = 100;

function ref(path) {
  return { path, id: path.split('/').at(-1) };
}

function snapshot(row, reference) {
  return {
    ref: reference,
    id: reference.id,
    revision: row?.revision ?? null,
    exists: () => Boolean(row),
    data: () => row ? structuredClone(row.data) : undefined,
  };
}

function change(kind, reference, data) {
  return { kind, path: reference.path, data: data === undefined ? undefined : structuredClone(data) };
}

function dottedFields(fields) {
  const result = Object.create(null);
  for (const [key, value] of Object.entries(fields)) {
    const parts = key.split('.');
    let target = result;
    for (const part of parts.slice(0, -1)) target = target[part] ||= Object.create(null);
    target[parts.at(-1)] = value;
  }
  return result;
}

function matches(row, { field, operator, value }) {
  const candidate = field === '__name__' ? row.id : row.data()[field];
  switch (operator) {
    case '<': return candidate < value;
    case '>=': return candidate >= value;
    case '==': return candidate === value;
    case 'array-contains': return Array.isArray(candidate) && candidate.includes(value);
    default: throw new Error('Unsupported ControlQuest query.');
  }
}

// Preserve the document operations used by firebase-service so its domain
// reducers, cached reads and offline queues share one persistence path.
export function createSupabaseDatabase({ projectRef, publishableKey, auth, fetcher = fetch }) {
  if (!/^[a-z0-9]{20}$/.test(projectRef) || !publishableKey?.startsWith('sb_publishable_')) {
    throw new Error('ControlQuest Supabase configuration is incomplete.');
  }
  const endpoint = `https://${projectRef}.supabase.co/rest/v1/rpc`;
  const requireUser = () => {
    if (!auth.currentUser) throw Object.assign(new Error('Sign in to ControlQuest.'), { code: 'unauthenticated' });
    return auth.currentUser;
  };
  const checkUser = user => {
    if (auth.currentUser !== user) throw Object.assign(new Error('Your signed-in account changed.'), { code: 'unauthenticated' });
  };

  async function rpc(name, body, user = requireUser()) {
    checkUser(user);
    const token = await user.getIdToken();
    checkUser(user);
    const response = await fetcher(`${endpoint}/controlquest_${name}`, {
      method: 'POST',
      headers: { apikey: publishableKey, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      cache: 'no-store',
      redirect: 'error',
    });
    checkUser(user);
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      const code = error.code === '40001' || error.code === 'PT409' ? 'aborted'
        : error.code === 'PT423' ? 'busy'
        : error.code === '42501' ? 'permission-denied'
        : response.status === 401 ? 'unauthenticated'
        : response.status === 403 ? 'permission-denied'
        : response.status === 429 || response.status >= 502 ? 'unavailable'
        : error.code;
      throw Object.assign(new Error(error.message || `ControlQuest database request failed (${response.status}).`), { code });
    }
    return response.status === 204 ? undefined : response.json();
  }

  async function page(location, singleDocument, afterPath, user) {
    return rpc('read_rows', { location, single_document: singleDocument, after_path: afterPath }, user);
  }

  async function getDoc(reference, user = requireUser()) {
    const [row] = await page(reference.path, true, null, user);
    return snapshot(row, reference);
  }

  async function getDocs(reference, user = requireUser()) {
    const docs = [];
    let after = null;
    while (true) {
      const rows = await page(reference.path, false, after, user);
      for (const row of rows) {
        const record = snapshot(row, ref(row.path));
        if ((reference.filters || []).every(filter => matches(record, filter))) docs.push(record);
      }
      if (rows.length < pageSize) return { docs };
      after = rows.at(-1).path;
    }
  }

  const set = (reference, data, options) =>
    change(options?.mergeFields ? 'replaceFields' : options?.merge ? 'merge' : 'set', reference, data);
  const update = (reference, data) => change('update', reference, dottedFields(data));
  const remove = reference => change('delete', reference);
  async function commit(operations, expected, user = requireUser()) {
    for (let attempt = 0; ; attempt += 1) {
      try {
        return await rpc('write_batch', { operations, expected }, user);
      } catch (error) {
        if (error.code !== 'busy' || attempt === 3) throw error;
        await new Promise(resolve => setTimeout(resolve, 50 * (attempt + 1)));
      }
    }
  }

  function writer(operations) {
    return {
      set(reference, data, options) { operations.push(set(reference, data, options)); },
      update(reference, data) { operations.push(update(reference, data)); },
      delete(reference) { operations.push(remove(reference)); },
    };
  }

  function onSnapshot(reference, listener, onError = console.warn) {
    const user = requireUser();
    const isDocument = reference.path.split('/').length % 2 === 0;
    let last;
    let stopped = false;
    let timer;
    const poll = async () => {
      try {
        const revision = await rpc('location_revision', { location: reference.path, single_document: isDocument }, user);
        if (!stopped && revision !== last) {
          if (isDocument) {
            const value = await getDoc(reference, user);
            if (!stopped) listener(value);
          } else {
            listener();
          }
          last = revision;
        }
      } catch (error) {
        if (!stopped && auth.currentUser === user) onError(error);
      } finally {
        if (!stopped && auth.currentUser === user) timer = setTimeout(poll, isDocument ? 2500 : 30000);
      }
    };
    void poll();
    return () => { stopped = true; clearTimeout(timer); };
  }

  return {
    doc: (base, ...path) => ref([base?.path, ...path].filter(Boolean).join('/') + (path.length ? '' : `/${crypto.randomUUID()}`)),
    collection: (base, ...path) => ref([base?.path, ...path].filter(Boolean).join('/')),
    documentId: () => '__name__',
    where: (field, operator, value) => ({ field, operator, value }),
    query: (reference, ...filters) => ({ ...reference, filters }),
    arrayUnion: (...items) => ({ __cqArray: 'union', items }),
    arrayRemove: (...items) => ({ __cqArray: 'remove', items }),
    getDoc, getDocs, onSnapshot,
    setDoc: (...args) => commit([set(...args)], {}),
    updateDoc: (...args) => commit([update(...args)], {}),
    deleteDoc: reference => commit([remove(reference)], {}),
    joinGuild: (guild, invite, summary) => rpc('join_guild', { guild, invite, summary }),
    writeBatch() {
      const user = requireUser();
      const operations = [];
      return { ...writer(operations), commit: () => commit(operations, {}, user) };
    },
    async runTransaction(_database, task) {
      const user = requireUser();
      for (let attempt = 1; attempt <= 4; attempt += 1) {
        const operations = [];
        const expected = Object.create(null);
        const value = await task({
          ...writer(operations),
          async get(reference) {
            const read = await getDoc(reference, user);
            expected[reference.path] = read.revision;
            return read;
          },
        });
        try {
          await commit(operations, expected, user);
          return value;
        } catch (error) {
          if (error.code !== 'aborted' || attempt === 4) throw error;
        }
      }
    },
  };
}
