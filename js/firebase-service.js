import {packProfile,unpackProfile} from './profile-chunks.js';
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
  return snap.exists() ? unpackProfile(snap.data(),async id=>{const part=await fs().getDoc(fs().doc(db,'users',uid,'studyReviews',id));return part.exists()?part.data():null;}) : null;
}
export function profileStorageSnapshot(profile) {
  const homework=profile.v3?.homework;
  if(!homework)return profile;
  // Full question snapshots and evidence live in individual private documents.
  // A full twelve-week program must not grow the profile past Firestore's limit.
  const compact={...homework,quizzes:Object.fromEntries(Object.entries(homework.quizzes||{}).map(([id,q])=>[id,{id:q.id||id,weekId:q.weekId||id,uid:q.uid||profile.uid,status:q.status||null,resetAt:q.resetAt||null,startedAt:q.startedAt||null,deadlineAt:q.deadlineAt||null,dueAt:q.dueAt||null,submittedAt:q.submittedAt||null,result:q.result?Object.fromEntries(['correct','total','incorrect','unanswered','accuracy','timedOut','durationSeconds'].filter(key=>q.result[key]!==undefined).map(key=>[key,q.result[key]])):null,_revision:q._revision||0,storedSeparately:true}])),completions:Object.fromEntries(Object.entries(homework.completions||{}).map(([id,c])=>[id,{lessonId:id,completedAt:c.completedAt||null,resetAt:c.resetAt||null,storedSeparately:true}]))};
  return {...profile,v3:{...profile.v3,homework:compact}};
}
export async function saveProfile(profile) {
  const snapshot=profileStorageSnapshot(profile);
  if (!ready) return saveLocal({ profile:snapshot });
  try{
  const {root,chunks}=await packProfile(snapshot);
  // Never publish references until all immutable chunks are confirmed saved.
  for(let i=0;i<chunks.length;i+=20)await Promise.all(chunks.slice(i,i+20).map(chunk=>fs().setDoc(fs().doc(db,'users',profile.uid,'studyReviews',chunk.id),{...chunk,uid:profile.uid})));
  // Top-level replacement removes old nested payloads; recursive merge would
  // retain the oversized fields that this migration is intended to move.
  const payload=withStamp({...root,_profileChunks:root._profileChunks||null});
  await fs().setDoc(userRef(profile.uid),payload,{mergeFields:Object.keys(payload)});
  }catch(error){throw new Error(`Profile save (5.1.5): ${error.message}`,{cause:error});}
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
    homework: profile.v3?.homeworkSummary || null,
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
    return { decks: local.decks || [], cards: local.cards || [], progress: local.progress || {}, ...splitStudyRecords((local.reviews || []).filter(r=>!r.uid||r.uid===uid)) };
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
    ...splitStudyRecords(reviewDocs)
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
      const sources=[...new Set([...(old.sources||[]),old.source,...(c.sources||[]),c.source].filter(source=>typeof source==='string'&&source.trim()))];
      cardMap.set(key, { ...old, ...c, sources,source:sources.includes('ISACA QAE Paste')?'ISACA QAE Paste':c.source||old.source||'',deckIds: [...new Set([...(old.deckIds || []), ...(c.deckIds || [])])] });
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
  // Older imports kept only a single source string. Read that legacy value
  // before promotion into an append-only source list; arrayUnion preserves
  // concurrent contributors even if this device read an earlier version.
  for(let offset=0;offset<cards.length;offset+=100){
    const chunk=cards.slice(offset,offset+100);
    const previous=await Promise.all(chunk.map(card=>fs().getDoc(docRefFor(card.scope,uid,groupId,'card',card.id))));
    chunk.forEach((card,index)=>{
      const old=previous[index].exists()?previous[index].data():{},sources=[...new Set([...(old.sources||[]),old.source,...(card.sources||[]),card.source].filter(source=>typeof source==='string'&&source.trim()))];
      const ref=docRefFor(card.scope,uid,groupId,'card',card.id),{arrayUnion}=fs();
      operations.push(batch=>batch.set(ref,{...withStamp(card),source:sources.includes('ISACA QAE Paste')?'ISACA QAE Paste':card.source||old.source||'',sources:arrayUnion(...sources),deckIds:arrayUnion(...(card.deckIds||[]))},{merge:true}));
    });
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
  if(!uid||(review.uid&&review.uid!==uid)||(ready&&auth?.currentUser?.uid!==uid))throw new Error('Save reviews only to your own account.');
  review={...review,uid};
  if (!ready) {
    const local = loadLocalStudy();
    const reviews = [review, ...(local.reviews || []).filter(r=>!(r.id===review.id&&r.uid===uid))];
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

/** Patch only canonical category fields; do not rewrite question text or recall records. */
export async function saveCategoryPatch({uid,groupId,kind,id,scope,patch,expectedUpdatedAt}){
  if(!uid||!id||!['deck','card'].includes(kind)||!['Personal','Guild'].includes(scope))throw new Error('Choose a writable personal or Guild record.');
  if(scope==='Guild'&&!groupId)throw new Error('Your Guild changed. Audit the library again.');
  const {LESSONS}=await import('./lesson-catalog.js');
  const allowed=new Set(['lessonId','lessonTitle','domainId','domainNumber','domain','categoryOverride']);
  if(!patch||patch.categoryOverride===true||Object.keys(patch).some(key=>!allowed.has(key)))throw new Error('Only lesson and domain categories can be patched.');
  const lesson=LESSONS.find(l=>l.id===patch.lessonId);
  if(!lesson||patch.domainId!==lesson.domainId)throw new Error('Choose a verified canonical lesson and its domain.');
  const category={lessonId:lesson.id,lessonTitle:lesson.title,domainId:lesson.domainId,...(kind==='card'?{domainNumber:Number(lesson.domainId.slice(1)),domain:lesson.domain}:{})};
  const check=record=>{
    if(!record)throw new Error('The record was removed. Audit the library again.');
    if(record.categoryOverride)throw new Error('This category was edited manually. Keep it or review it in the deck editor.');
    if((record.updatedAt||null)!==(expectedUpdatedAt||null))throw new Error('This record changed. Refresh and audit it again.');
    if(scope==='Personal'&&record.ownerUid&&record.ownerUid!==uid)throw new Error('This record belongs to another account.');
  };
  if(!ready){
    const local=loadLocalStudy(),key=kind==='deck'?'decks':'cards',scopeKey=scope==='Guild'?`guild_${groupId}`:`personal_${uid}`;
    const index=(local[key]||[]).findIndex(record=>record.id===id&&record.scopeKey===scopeKey);
    const record=local[key]?.[index];check(record);local[key][index]=withStamp({...record,...category});saveLocalStudy(local);return local[key][index];
  }
  if(auth.currentUser?.uid!==uid)throw new Error('Your account changed. Audit the library again.');
  return fs().runTransaction(db,async transaction=>{
    const ref=docRefFor(scope,uid,groupId,kind,id),snapshot=await transaction.get(ref),record=snapshot.exists()?snapshot.data():null;check(record);
    const result=withStamp({...record,...category});transaction.update(ref,{...category,updatedAt:result.updatedAt});return result;
  });
}


function splitStudyRecords(records) {
  const reviews=[],activityRecords=[],homeworkQuizzes={},homeworkCompletions={},homeworkQuizHistory=[];
  for(const r of records){
    if(r.recordType==='profile-chunk')continue;
    if(r.recordType==='account-activity')activityRecords.push(r);
    else if(r.recordType==='homework-quiz')homeworkQuizzes[r.key]=r.value;
    else if(r.recordType==='homework-completion')homeworkCompletions[r.key]=r.value;
    else if(r.recordType==='homework-quiz-archive')homeworkQuizHistory.push(r.value);
    else reviews.push(r);
  }
  reviews.sort((a,b)=>String(b.reviewedAt||'').localeCompare(String(a.reviewedAt||'')));
  activityRecords.sort((a,b)=>String(b.occurredAt||'').localeCompare(String(a.occurredAt||'')));
  return {reviews,activityRecords,homeworkQuizzes,homeworkCompletions,homeworkQuizHistory,quizArchive:homeworkQuizHistory};
}
export async function saveStudyAuditEvent(uid,event) {
  if(!uid||!event?.id||!event?.type)throw new Error('An account and activity ID are required.');
  if(ready&&auth?.currentUser?.uid!==uid)throw new Error('Sign in to your own account.');
  const record={...event,uid,recordType:'account-activity',occurredAt:event.occurredAt||new Date().toISOString()};
  await saveStudyReview(uid,record);return record;
}
const homeworkWrites=new Map();
export async function saveHomeworkRecord(uid,kind,key,value) {
  if(!uid||!['quiz','completion'].includes(kind)||!/^[-a-zA-Z0-9_]+$/.test(key)||!value||typeof value!=='object')throw new Error('Invalid homework record.');
  if(ready&&auth?.currentUser?.uid!==uid)throw new Error('Sign in to your own account.');
  // Keep the caller's revision immutable: Firestore may rerun this callback.
  const incoming=structuredClone(value),id=`homework_${kind}_${key}`,lock=`${uid}:${id}`;
  if(kind==='quiz'&&(incoming.uid!==uid||incoming.weekId!==key||!incoming.id||!['active','submitted'].includes(incoming.status)))throw new Error('This quiz belongs to another account or week.');
  const comparable=quiz=>{const copy={...quiz};delete copy._revision;return JSON.stringify(copy);};
  const isReset=previous=>kind==='quiz'&&previous?.value&&incoming.id!==previous.value.id;
  const update=(previous,resetVerified=false)=>{
    let next=incoming;
    if(kind==='quiz'){
      const prior=previous?.value,revision=Number(prior?._revision)||0;
      if(prior&&comparable(prior)===comparable(incoming))return previous;
      const replacing=isReset(previous);
      if(replacing){
        if(!resetVerified||!(Date.parse(incoming.resetAt)>Date.parse(prior.startedAt))||!(Date.parse(incoming.startedAt)>=Date.parse(incoming.resetAt)))throw new Error('Reset the relevant flashcard memory before starting a new quiz attempt.');
        if(incoming.status!=='active')throw new Error('A reset quiz must start as a new active attempt.');
      }else{
        if(revision!==(Number(incoming._revision)||0))throw new Error('This quiz changed on another device. Reload to resume the latest answers.');
        if(prior?.status==='submitted'||prior?.result)throw new Error('A submitted quiz cannot be overwritten.');
        if(prior&&['id','weekId','uid','startedAt','deadlineAt','dueAt','durationSeconds','resetAt','questions'].some(field=>JSON.stringify(prior[field])!==JSON.stringify(incoming[field])))throw new Error('An active quiz cannot be restarted, replaced, or given extra time.');
      }
      next={...incoming,_revision:revision+1};
    }
    return {id,uid,recordType:`homework-${kind}`,key,value:next,updatedAt:new Date().toISOString()};
  };
  const archive=previous=>({...previous,id:`${id}_archive_${previous.value.id}_${previous.value._revision||0}`,recordType:'homework-quiz-archive'});
  if(!ready){
    const previous=homeworkWrites.get(lock)||Promise.resolve();
    const work=previous.catch(()=>{}).then(()=>{
      const local=loadLocalStudy(),saved=(local.reviews||[]).find(r=>r.id===id&&r.uid===uid);
      const profile=loadLocal()?.profile;
      const resetVerified=!!incoming.resetAt&&((profile?.uid===uid&&profile.v3?.homework?.resetAt===incoming.resetAt)||Object.values(local.progress||{}).some(p=>p.uid===uid&&p.resetAt===incoming.resetAt));
      const record=update(saved,resetVerified),history=isReset(saved)?[archive(saved)]:[];
      saveLocalStudy({...local,reviews:[record,...history,...(local.reviews||[]).filter(r=>!(r.id===id&&r.uid===uid))]});return record.value;
    });
    homeworkWrites.set(lock,work);try{return await work;}finally{if(homeworkWrites.get(lock)===work)homeworkWrites.delete(lock);}
  }
  const ref=docRefFor('Personal',uid,null,'review',id);
  // Resolve possible reset evidence, then reread the evidence document inside
  // the transaction so a concurrent device cannot invalidate that reset proof.
  let resetCandidates=null;
  return fs().runTransaction(db,async transaction=>{
    const snap=await transaction.get(ref),previous=snap.exists()?snap.data():null;
    let resetVerified=false;
    if(isReset(previous)&&incoming.resetAt){
      const profile=await transaction.get(userRef(uid));resetVerified=profile.exists()&&profile.data().v3?.homework?.resetAt===incoming.resetAt;
      if(!resetVerified&&!resetCandidates)resetCandidates=(await docsFromCollection(collectionRefFor('Personal',uid,null,'progress'))).filter(p=>p.resetAt===incoming.resetAt&&(!p.uid||p.uid===uid));
      if(!resetVerified)for(const candidate of resetCandidates){const proof=await transaction.get(docRefFor('Personal',uid,null,'progress',candidate.id));if(proof.exists()&&proof.data().resetAt===incoming.resetAt){resetVerified=true;break;}}
    }
    const record=update(previous,resetVerified);
    if(isReset(previous)){const old=archive(previous);transaction.set(docRefFor('Personal',uid,null,'review',old.id),old);}
    transaction.set(ref,record);return record.value;
  });
}
