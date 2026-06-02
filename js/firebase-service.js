import { firebaseConfig } from '../config/firebase-config.js';

let app, auth, db, currentUnsub;
let ready = false;
const localKey = 'controlquest_v24_local_state';

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
export async function saveGroup(group) {
  if (!group?.id) return;
  if (!ready) { const local = loadLocal() || {}; local.group = group; saveLocal(local); return; }
  await fs().setDoc(groupRef(group.id), withStamp(group), { merge: true });
}
export async function updateMemberSummary(groupId, profile) {
  if (!groupId || !profile) return;
  const group = await loadGroup(groupId);
  if (!group) return;
  group.members ||= {};
  group.members[profile.uid] = publicSummary(profile);
  await saveGroup(group);
}
export function publicSummary(profile) {
  return {
    uid: profile.uid,
    name: profile.displayName || profile.email?.split('@')[0] || 'Study Buddy',
    email: profile.email || '',
    avatar: profile.avatar || {},
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

function loadLocal() { try { return JSON.parse(localStorage.getItem(localKey) || '{}'); } catch { return {}; } }
function saveLocal(partial) { const merged = { ...loadLocal(), ...partial, updatedAt: new Date().toISOString() }; localStorage.setItem(localKey, JSON.stringify(merged)); return merged; }
