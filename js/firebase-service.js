import { firebaseConfig } from '../config/firebase-config.js';

let app, auth, db, currentUnsub;
let ready = false;
let localKey = 'controlquest_v24_local_state';
let localStudyKey = 'controlquest_v27_study_library';

export async function initFirebase() {
  if (!firebaseConfig?.enabled) return { enabled: false, reason: 'Firebase Disabled' };
  try {
    const appMod = await import('https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js');
    const authMod = await import('https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js');
    const fsMod = await import('https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js');
    window.__cqFirebase = { appMod, authMod, fsMod };
    app = appMod.initializeApp(firebaseConfig);
    auth = authMod.getAuth(app);
    await authMod.setPersistence(auth, authMod.browserLocalPersistence);
    db = fsMod.getFirestore(app);
    ready = true;
    return { enabled: true };
  } catch (error) {
    console.error('Firebase Init Failed', error);
    return { enabled: false, reason: error.message };
  }
}

export function isFirebaseReady(){ return ready && auth && db; }
export function getAuthInstance(){ return auth; }

export function onAuth(callback) {
  if (!auth) { callback(null); return () => {}; }
  const { onAuthStateChanged } = window.__cqFirebase.authMod;
  return onAuthStateChanged(auth, callback);
}

export async function signIn(email, password) {
  const { signInWithEmailAndPassword } = window.__cqFirebase.authMod;
  return signInWithEmailAndPassword(auth, email, password);
}
export async function createAccount(email, password) {
  const { createUserWithEmailAndPassword } = window.__cqFirebase.authMod;
  return createUserWithEmailAndPassword(auth, email, password);
}
export async function sendReset(email) {
  const { sendPasswordResetEmail } = window.__cqFirebase.authMod;
  return sendPasswordResetEmail(auth, email);
}
export async function signOutUser() {
  if (!auth) return;
  const { signOut } = window.__cqFirebase.authMod;
  return signOut(auth);
}

function fs() { return window.__cqFirebase.fsMod; }
function userRef(uid){ return fs().doc(db, 'users', uid); }
function groupRef(groupId){ return fs().doc(db, 'groups', groupId); }

export async function loadProfile(uid) {
  if (!ready) return loadLocal()?.profile || null;
  const snap = await fs().getDoc(userRef(uid));
  return snap.exists() ? snap.data() : null;
}
export async function saveProfile(profile) {
  if (!ready) return saveLocal({ profile });
  await fs().setDoc(userRef(profile.uid), withStamp(profile), { merge: true });
}
export async function backupProfile(profile, reason='Manual Backup') {
  const backup = { profile, reason, createdAt: new Date().toISOString() };
  if (!ready) return saveLocal({ backup });
  const ref = fs().doc(fs().collection(db, 'deletedProfiles', profile.uid, 'backups'));
  await fs().setDoc(ref, backup);
}
export async function deleteProfileData(profile) {
  await backupProfile(profile, 'Profile Delete Backup');
  if (!ready) { localStorage.removeItem(localKey); return; }
  await fs().deleteDoc(userRef(profile.uid));
}

export async function createGroup(group) {
  if (!ready) { const local = loadLocal() || {}; local.group = group; saveLocal(local); return group; }
  await fs().setDoc(groupRef(group.id), withStamp(group));
  return group;
}
export async function loadGroup(groupId) {
  if (!groupId) return null;
  if (!ready) return loadLocal()?.group || null;
  const snap = await fs().getDoc(groupRef(groupId));
  return snap.exists() ? snap.data() : null;
}
export async function saveGroup(group,{includeLiveState=false}={}) {
  if(!group?.id)return;
  const snapshot={...group};
  // Live question and island state are owned by command transactions. A stale
  // settings/import/member snapshot must never roll back another player's turn.
  if(!includeLiveState){delete snapshot.studySession;delete snapshot.questWorld;}
  if(!ready){const local=loadLocal()||{};local.group={...(local.group?.id===group.id?local.group:{}),...snapshot};saveLocal(local);return;}
  await fs().setDoc(groupRef(group.id),withStamp(snapshot),{merge:true});
}
export async function updateMemberSummary(groupId,profile){
  if(!groupId||!profile)return;
  if(!ready){const group=await loadGroup(groupId);if(!group)return;group.members ||= {};group.members[profile.uid]=publicSummary(profile);await saveGroup(group);return;}
  await fs().setDoc(groupRef(groupId),withStamp({members:{[profile.uid]:publicSummary(profile)}}),{merge:true});
}
export function publicSummary(profile) {
  return {
    uid: profile.uid,
    name: profile.displayName || profile.email?.split('@')[0] || 'Study Buddy',
    email: profile.email || '',
    avatar: profile.inventory?.equipped || profile.avatar || {},
    level: getLevel(profile.stats?.xp || 0),
    xp: profile.stats?.xp || 0,
    coins: profile.stats?.coins || 0,
    streak: profile.stats?.streak || 0,
    qaeQuestions: profile.stats?.qaeQuestions || 0,
    qaeAccuracy: profile.stats?.qaeQuestions ? Math.round((profile.stats.qaeCorrect || 0) / profile.stats.qaeQuestions * 100) : 0,
    roadmapPct: profile.stats?.roadmapPct || 0,
    minutes: profile.stats?.studyMinutes || 0,
    timezone: profile.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone,
    updatedAt: new Date().toISOString()
  };
}
export function subscribeGroup(groupId, callback) {
  if (currentUnsub) { currentUnsub(); currentUnsub = null; }
  if (!ready || !groupId) return () => {};
  currentUnsub = fs().onSnapshot(groupRef(groupId), snap => callback(snap.exists() ? snap.data() : null));
  return currentUnsub;
}

export function withStamp(obj){ return { ...obj, updatedAt: new Date().toISOString() }; }
export function getLevel(xp){ return Math.max(1, Math.floor(Math.sqrt(Math.max(0,xp)/100)) + 1); }



function collectionRefFor(scope, uid, groupId, kind) {
  const plural = kind === 'deck' ? 'studyDecks' : kind === 'card' ? 'studyCards' : kind === 'progress' ? 'studyProgress' : 'studyReviews';
  if (scope === 'Guild') return fs().collection(db, 'groups', groupId, plural);
  if (scope === 'Public') return fs().collection(db, kind === 'deck' ? 'publicStudyDecks' : 'publicStudyCards');
  return fs().collection(db, 'users', uid, plural);
}
function docRefFor(scope, uid, groupId, kind, id) {
  if (scope === 'Guild') return fs().doc(db, 'groups', groupId, kind === 'deck' ? 'studyDecks' : 'studyCards', id);
  if (scope === 'Public') return fs().doc(db, kind === 'deck' ? 'publicStudyDecks' : 'publicStudyCards', id);
  if (kind === 'progress') return fs().doc(db, 'users', uid, 'studyProgress', id);
  if (kind === 'review') return fs().doc(db, 'users', uid, 'studyReviews', id);
  return fs().doc(db, 'users', uid, kind === 'deck' ? 'studyDecks' : 'studyCards', id);
}

function loadLocalStudy(){ try { return JSON.parse(localStorage.getItem(localStudyKey) || '{}'); } catch { return {}; } }
function saveLocalStudy(data){ localStorage.setItem(localStudyKey, JSON.stringify(data)); return data; }

async function docsFromCollection(ref) {
  const snap = await fs().getDocs(ref);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function loadStudyLibrary(uid, groupId = null) {
  if (!ready) {
    const local = loadLocalStudy();
    return { decks: local.decks || [], cards: local.cards || [], progress: local.progress || {}, reviews: local.reviews || [] };
  }
  const deckPromises = [docsFromCollection(collectionRefFor('Personal', uid, null, 'deck'))];
  const cardPromises = [docsFromCollection(collectionRefFor('Personal', uid, null, 'card'))];
  if (groupId) {
    deckPromises.push(docsFromCollection(collectionRefFor('Guild', uid, groupId, 'deck')));
    cardPromises.push(docsFromCollection(collectionRefFor('Guild', uid, groupId, 'card')));
  }
  deckPromises.push(docsFromCollection(collectionRefFor('Public', uid, null, 'deck')));
  cardPromises.push(docsFromCollection(collectionRefFor('Public', uid, null, 'card')));
  const [deckGroups, cardGroups, progressDocs, reviewDocs] = await Promise.all([
    Promise.all(deckPromises),
    Promise.all(cardPromises),
    docsFromCollection(collectionRefFor('Personal', uid, null, 'progress')),
    docsFromCollection(collectionRefFor('Personal', uid, null, 'review'))
  ]);
  return {
    decks: deckGroups.flat(),
    cards: cardGroups.flat(),
    progress: Object.fromEntries(progressDocs.map(p => [p.id, p])),
    reviews: reviewDocs.sort((a,b)=>String(b.reviewedAt||'').localeCompare(String(a.reviewedAt||''))).slice(0, 1000)
  };
}

async function commitBatchOperations(operations) {
  if (!operations.length) return;
  const chunks = [];
  for (let i = 0; i < operations.length; i += 350) chunks.push(operations.slice(i, i + 350));
  for (const chunk of chunks) {
    const batch = fs().writeBatch(db);
    for (const operation of chunk) operation(batch);
    await batch.commit();
  }
}

export async function saveStudyImport({ uid, groupId, decks = [], cards = [] }) {
  if (!ready) {
    const local = loadLocalStudy();
    const deckMap = new Map((local.decks || []).map(d => [`${d.scopeKey}:${d.id}`, d]));
    const cardMap = new Map((local.cards || []).map(c => [`${c.scopeKey}:${c.id}`, c]));
    decks.forEach(d => deckMap.set(`${d.scopeKey}:${d.id}`, { ...(deckMap.get(`${d.scopeKey}:${d.id}`) || {}), ...d, contributors:[...new Set([...(deckMap.get(`${d.scopeKey}:${d.id}`)?.contributors||[]),...(d.contributors||[])])] }));
    cards.forEach(c => {
      const key = `${c.scopeKey}:${c.id}`;
      const old = cardMap.get(key) || {};
      cardMap.set(key, { ...old, ...c, deckIds: [...new Set([...(old.deckIds || []), ...(c.deckIds || [])])] });
    });
    const progress={...(local.progress||{})};for(const c of cards.filter(c=>c.wasCorrectAtImport===false)){const id=`${c.scopeKey}__${c.id}`;progress[id]={...(progress[id]||{}),id,uid,cardId:c.id,scope:c.scope,scopeKey:c.scopeKey,importedMiss:true};}
    saveLocalStudy({ ...local, decks: [...deckMap.values()], cards: [...cardMap.values()],progress });
    return;
  }
  const operations = [];
  for (const deck of decks) {
    const ref = docRefFor(deck.scope, uid, groupId, 'deck', deck.id);
    operations.push(batch => batch.set(ref, { ...withStamp(deck), contributors:fs().arrayUnion(...(deck.contributors||[])) }, { merge: true }));
  }
  for (const card of cards) {
    const ref = docRefFor(card.scope, uid, groupId, 'card', card.id);
    const { arrayUnion } = fs();
    operations.push(batch => batch.set(ref, { ...withStamp(card), deckIds: arrayUnion(...(card.deckIds || [])) }, { merge: true }));
  }
  for(const card of cards.filter(c=>c.wasCorrectAtImport===false)){const id=`${card.scopeKey}__${card.id}`;operations.push(batch=>batch.set(docRefFor('Personal',uid,null,'progress',id),{id,uid,cardId:card.id,scope:card.scope,scopeKey:card.scopeKey,importedMiss:true},{merge:true}));}
  await commitBatchOperations(operations);
}

export async function saveStudyDeck({ uid, groupId, deck }) {
  if (!deck) return;
  if (!ready) {
    const local = loadLocalStudy();
    const decks = local.decks || [];
    const idx = decks.findIndex(d => d.scopeKey === deck.scopeKey && d.id === deck.id);
    if (idx >= 0) decks[idx] = { ...decks[idx], ...deck }; else decks.unshift(deck);
    saveLocalStudy({ ...local, decks });
    return;
  }
  await fs().setDoc(docRefFor(deck.scope, uid, groupId, 'deck', deck.id), withStamp(deck), { merge: true });
}

export async function saveStudyCard({ uid, groupId, card }) {
  if (!card) return;
  if (!ready) {
    const local = loadLocalStudy();
    const cards = local.cards || [];
    const idx = cards.findIndex(c => c.scopeKey === card.scopeKey && c.id === card.id);
    if (idx >= 0) cards[idx] = { ...cards[idx], ...card }; else cards.unshift(card);
    saveLocalStudy({ ...local, cards });
    return;
  }
  await fs().setDoc(docRefFor(card.scope, uid, groupId, 'card', card.id), withStamp(card), { merge: true });
}

export async function saveStudyProgress(uid, progress) {
  if (!progress?.id) return;
  if (!ready) {
    const local = loadLocalStudy();
    const map = local.progress || {};
    map[progress.id] = progress;
    saveLocalStudy({ ...local, progress: map });
    return;
  }
  await fs().setDoc(docRefFor('Personal', uid, null, 'progress', progress.id), withStamp(progress), { merge: true });
}

export async function saveStudyReview(uid, review) {
  if (!review?.id) return;
  if (!ready) {
    const local = loadLocalStudy();
    const reviews = [review, ...(local.reviews || [])].slice(0, 2000);
    saveLocalStudy({ ...local, reviews });
    return;
  }
  await fs().setDoc(docRefFor('Personal', uid, null, 'review', review.id), review);
}

export async function deleteStudyDeck({ uid, groupId, deck }) {
  if (!deck) return;
  if (!ready) {
    const local = loadLocalStudy();
    const decks = (local.decks || []).filter(d => !(d.scopeKey === deck.scopeKey && d.id === deck.id));
    const cards = (local.cards || []).map(c => c.scopeKey === deck.scopeKey ? { ...c, deckIds: (c.deckIds || []).filter(id => id !== deck.id) } : c);
    saveLocalStudy({ ...local, decks, cards });
    return;
  }
  await fs().deleteDoc(docRefFor(deck.scope, uid, groupId, 'deck', deck.id));
  const cardCollection = collectionRefFor(deck.scope, uid, groupId, 'card');
  const q = fs().query(cardCollection, fs().where('deckIds', 'array-contains', deck.id));
  const snap = await fs().getDocs(q);
  const operations = snap.docs.map(docSnap => batch => batch.update(docSnap.ref, { deckIds: fs().arrayRemove(deck.id) }));
  await commitBatchOperations(operations);
}

function loadLocal() { try { return JSON.parse(localStorage.getItem(localKey) || '{}'); } catch { return {}; } }
function saveLocal(partial) { const merged = { ...loadLocal(), ...partial, updatedAt: new Date().toISOString() }; localStorage.setItem(localKey, JSON.stringify(merged)); return merged; }

// Write only the selected lesson so simultaneous Guild checkoffs do not overwrite each other.
export async function saveGuildLessonStatus(groupId, lessonId, status) {
  if (!groupId || !/^((d[1-5]-t\d{2})|(pe-[1-3]))$/.test(lessonId)) throw new Error('Invalid lesson');
  if (!ready) {
    const local=loadLocal()||{};
    if(local.group?.id!==groupId) throw new Error('Guild is not available locally');
    local.group.lessonStatus ||= {}; local.group.lessonStatus[lessonId]=status; saveLocal(local); return;
  }
  await fs().updateDoc(groupRef(groupId), { [`lessonStatus.${lessonId}`]:status });
}

export async function loadCommunityLibrary() {
  if(!ready){const local=loadLocalStudy();return {contributions:local.publicContributions||[],statuses:local.publicLessonStatus||{}};}
  const [contributions,statuses]=await Promise.all([
    docsFromCollection(fs().collection(db,'publicLessonContributions')),
    docsFromCollection(fs().collection(db,'publicLessonStatus'))
  ]);
  return {contributions,statuses:Object.fromEntries(statuses.map(s=>[s.id,s]))};
}
export async function savePublicContributions(uid, contributions, sourceKey=null) {
  if(contributions.some(c=>c.ownerUid!==uid))throw new Error('You can only save your own submissions.');
  if(!ready){
    const local=loadLocalStudy();const map=new Map((local.publicContributions||[]).filter(c=>!(sourceKey&&c.ownerUid===uid&&c.sourceKey===sourceKey)).map(c=>[c.id,c]));
    contributions.forEach(c=>map.set(c.id,c));saveLocalStudy({...local,publicContributions:[...map.values()]});return;
  }
  const stale=sourceKey?(await docsFromCollection(fs().query(fs().collection(db,'publicLessonContributions'),fs().where('ownerUid','==',uid)))).filter(c=>c.sourceKey===sourceKey&&!contributions.some(n=>n.id===c.id)):[];
  await commitBatchOperations([...stale.map(c=>batch=>batch.delete(fs().doc(db,'publicLessonContributions',c.id))),...contributions.map(c=>batch=>batch.set(fs().doc(db,'publicLessonContributions',c.id),c))]);
}
export async function savePublicLessonStatus(uid,lessonId,status) {
  if(!/^((d[1-5]-t\d{2})|(pe-[1-3]))$/.test(lessonId))throw new Error('Invalid lesson');
  const value={completed:!!status.completed,updatedBy:uid,updatedByName:status.updatedByName||'Member',updatedAt:new Date().toISOString()};
  if(!ready){const local=loadLocalStudy();local.publicLessonStatus ||= {};local.publicLessonStatus[lessonId]=value;saveLocalStudy(local);return;}
  await fs().setDoc(fs().doc(db,'publicLessonStatus',lessonId),value);
}
export function subscribeCommunityLibrary(onChange,onError) {
  if(!ready)return ()=>{};
  const unsubscribers=['publicLessonContributions','publicLessonStatus'].map(name=>fs().onSnapshot(fs().collection(db,name),onChange,onError));
  return ()=>unsubscribers.forEach(stop=>stop());
}

// Atomic reducers prevent one player's answer from replacing a teammate's update.
export async function mutateGuildSession(groupId,command){
  const {reduceGuildSession}=await import('./guild-session.js');
  if(!ready)return serializeLocalGuild(groupId,async()=>{const group=await loadGroup(groupId);if(!group)throw new Error('Guild not found');group.studySession=reduceGuildSession(group.studySession,command);await saveGroup(group,{includeLiveState:true});return group.studySession;});
  return fs().runTransaction(db,async transaction=>{const ref=groupRef(groupId),snapshot=await transaction.get(ref);if(!snapshot.exists())throw new Error('Guild not found');const next=reduceGuildSession(snapshot.data().studySession,command);transaction.update(ref,{studySession:next});return next;});
}
export async function mutateGuildWorld(groupId,event){
  const {createWorld,advanceWorld}=await import('./quest-world.js');
  if(!ready)return serializeLocalGuild(groupId,async()=>{const group=await loadGroup(groupId);if(!group)throw new Error('Guild not found');const result=advanceWorld(createWorld(group.questWorld),event);group.questWorld=result.world;if(result.changed)await saveGroup(group,{includeLiveState:true});return result;});
  return fs().runTransaction(db,async transaction=>{const ref=groupRef(groupId),snapshot=await transaction.get(ref);if(!snapshot.exists())throw new Error('Guild not found');const result=advanceWorld(createWorld(snapshot.data().questWorld),event);if(result.changed)transaction.update(ref,{questWorld:result.world});return result;});
}

export function enableDemoStorage(){ready=false;localKey='controlquest_demo_v3_profile';localStudyKey='controlquest_demo_v3_study';}

const localGuildQueues=new Map();
async function serializeLocalGuild(id,action){const next=(localGuildQueues.get(id)||Promise.resolve()).catch(()=>{}).then(action);localGuildQueues.set(id,next);try{return await next;}finally{if(localGuildQueues.get(id)===next)localGuildQueues.delete(id);}}
