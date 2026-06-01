import { firebaseConfig } from '../config/firebase-config.js';
import { defaultProfile, memberSummary } from './gamification.js';

let api = null;
let currentUser = null;
let unsubUser = null;
let unsubGroup = null;

export function firebaseEnabled(){ return Boolean(firebaseConfig.enabled); }
export function getCurrentUser(){ return currentUser; }

export async function initFirebase(onAuthChanged, onStatus){
  if(!firebaseConfig.enabled){ onStatus?.('Firebase is not enabled. Paste config/firebase-config.js values first.'); return null; }
  try{
    const appMod = await import('https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js');
    const authMod = await import('https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js');
    const dbMod = await import('https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js');
    const app = appMod.initializeApp(firebaseConfig);
    const auth = authMod.getAuth(app);
    const db = dbMod.getFirestore(app);
    api = { app, auth, db, authMod, dbMod };
    authMod.onAuthStateChanged(auth, async user => {
      currentUser = user;
      onAuthChanged?.(user);
    });
    onStatus?.('Firebase ready. Login is available.');
    return api;
  }catch(error){ onStatus?.(`Firebase failed: ${error.message}`); return null; }
}

export async function register(email,password,displayName){
  requireApi();
  const { auth, authMod } = api;
  if(authMod.browserLocalPersistence){
    await authMod.setPersistence(auth, authMod.browserLocalPersistence);
  }
  const cred = await authMod.createUserWithEmailAndPassword(auth,email,password);
  currentUser = cred.user;
  const profile = defaultProfile(email);
  profile.uid = cred.user.uid;
  profile.displayName = displayName || profile.displayName;
  await saveProfile(profile);
  return { user:cred.user, profile };
}

export async function login(email,password){
  requireApi();
  const { auth, authMod } = api;
  if(authMod.browserLocalPersistence){
    await authMod.setPersistence(auth, authMod.browserLocalPersistence);
  }
  const cred = await authMod.signInWithEmailAndPassword(auth,email,password);
  currentUser = cred.user;
  return cred.user;
}

export async function logout(){
  if(!api) return;
  stopUserListener();
  stopGroupListener();
  await api.authMod.signOut(api.auth);
  currentUser = null;
}

export async function sendPasswordReset(email){
  requireApi();
  await api.authMod.sendPasswordResetEmail(api.auth,email);
}

export async function loadProfile(uid=currentUser?.uid){
  requireApi();
  if(!uid) throw new Error('No user is logged in.');
  const ref = api.dbMod.doc(api.db,'users',uid);
  const snap = await api.dbMod.getDoc(ref);
  if(!snap.exists()){
    const profile = defaultProfile(currentUser?.email || '');
    profile.uid = uid;
    await saveProfile(profile);
    return profile;
  }
  return normalizeProfile(snap.data(), uid);
}

export async function saveProfile(profile){
  requireApi();
  if(!currentUser?.uid) throw new Error('Log in first.');
  const now = new Date().toISOString();
  const clean = structuredClone(profile);
  clean.uid = currentUser.uid;
  clean.email = currentUser.email || clean.email;
  clean.updatedAt = now;
  await api.dbMod.setDoc(api.dbMod.doc(api.db,'users',currentUser.uid), clean, { merge:true });
}

export function subscribeProfile(uid, callback){
  requireApi();
  stopUserListener();
  const ref = api.dbMod.doc(api.db,'users',uid);
  unsubUser = api.dbMod.onSnapshot(ref, snap => {
    if(snap.exists()) callback(normalizeProfile(snap.data(), uid));
  });
  return unsubUser;
}

export function stopUserListener(){ if(unsubUser){ unsubUser(); unsubUser = null; } }
export function stopGroupListener(){ if(unsubGroup){ unsubGroup(); unsubGroup = null; } }

export async function createGroup(group){
  requireApi();
  const ref = api.dbMod.doc(api.db,'groups',group.id);
  await api.dbMod.setDoc(ref, group, { merge:false });
  return group;
}

export async function joinGroup(groupId, joinCode, profile){
  requireApi();
  const ref = api.dbMod.doc(api.db,'groups',groupId);
  const snap = await api.dbMod.getDoc(ref);
  if(!snap.exists()) throw new Error('No study group found with that group ID.');
  const group = snap.data();
  if(String(group.joinCode || '').trim().toUpperCase() !== String(joinCode || '').trim().toUpperCase()){
    throw new Error('That join code did not match this study group.');
  }
  group.memberIds = group.memberIds || {};
  group.memberIds[profile.uid] = true;
  group.memberSummaries = group.memberSummaries || {};
  group.memberSummaries[profile.uid] = memberSummary(profile);
  group.updatedAt = new Date().toISOString();
  await api.dbMod.setDoc(ref, group, { merge:true });
  return group;
}

export function subscribeGroup(groupId, callback){
  requireApi();
  stopGroupListener();
  if(!groupId) return null;
  const ref = api.dbMod.doc(api.db,'groups',groupId);
  unsubGroup = api.dbMod.onSnapshot(ref, snap => {
    callback(snap.exists() ? { id:snap.id, ...snap.data() } : null);
  });
  return unsubGroup;
}

export async function saveGroup(group){
  requireApi();
  if(!group?.id) throw new Error('No active group to save.');
  group.updatedAt = new Date().toISOString();
  await api.dbMod.setDoc(api.dbMod.doc(api.db,'groups',group.id), group, { merge:true });
}

export async function updateMemberSummary(groupId, profile){
  requireApi();
  if(!groupId || !profile?.uid) return;
  const path = `memberSummaries.${profile.uid}`;
  const memberPath = `memberIds.${profile.uid}`;
  await api.dbMod.updateDoc(api.dbMod.doc(api.db,'groups',groupId), {
    [path]: memberSummary(profile),
    [memberPath]: true,
    updatedAt:new Date().toISOString()
  });
}

export async function leaveGroup(groupId, profile){
  requireApi();
  const group = await getGroup(groupId);
  if(!group) return;
  delete group.memberIds?.[profile.uid];
  delete group.memberSummaries?.[profile.uid];
  await saveGroup(group);
}

export async function getGroup(groupId){
  requireApi();
  const snap = await api.dbMod.getDoc(api.dbMod.doc(api.db,'groups',groupId));
  return snap.exists() ? { id:snap.id, ...snap.data() } : null;
}

export async function archiveAndDeleteProfile(profile, password='', deleteAuth=false){
  requireApi();
  if(!currentUser?.uid || currentUser.uid !== profile.uid) throw new Error('You can only delete your own profile.');
  const backupId = new Date().toISOString().replace(/[:.]/g,'-');
  await api.dbMod.setDoc(api.dbMod.doc(api.db,'deletedProfiles',profile.uid,'backups',backupId), {
    profile: structuredClone(profile),
    archivedAt:new Date().toISOString(),
    reason:'User-requested profile deletion from ControlQuest Studio'
  });
  for(const gid of profile.groups || []){
    const group = await getGroup(gid).catch(()=>null);
    if(group){
      delete group.memberIds?.[profile.uid];
      delete group.memberSummaries?.[profile.uid];
      await saveGroup(group);
    }
  }
  await api.dbMod.deleteDoc(api.dbMod.doc(api.db,'users',profile.uid));
  if(deleteAuth){
    if(!password) throw new Error('Enter your password to delete the Firebase Auth account. Profile data backup has already been created.');
    const credential = api.authMod.EmailAuthProvider.credential(currentUser.email, password);
    await api.authMod.reauthenticateWithCredential(currentUser, credential);
    await api.authMod.deleteUser(currentUser);
    currentUser = null;
  }
  return backupId;
}

export async function exportProfileBackup(profile){
  const blob = new Blob([JSON.stringify(profile,null,2)], {type:'application/json'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `controlquest-profile-${profile.displayName.replace(/[^a-z0-9]+/gi,'-')}-${new Date().toISOString().slice(0,10)}.json`;
  document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
}

function normalizeProfile(data, uid){
  const merged = deepMerge(defaultProfile(data?.email || currentUser?.email || ''), data || {});
  merged.uid = uid;
  merged.groups = Array.isArray(merged.groups) ? merged.groups : [];
  merged.progress = merged.progress || {};
  merged.progress.roadmapStatus = merged.progress.roadmapStatus || {};
  merged.progress.dailyChallenges = merged.progress.dailyChallenges || {};
  merged.progress.qaeLogs = merged.progress.qaeLogs || [];
  merged.progress.mistakes = merged.progress.mistakes || [];
  merged.progress.flashcards = merged.progress.flashcards || [];
  merged.progress.homework = merged.progress.homework || [];
  merged.stats = merged.stats || {};
  return merged;
}

function deepMerge(target, source){
  for(const key of Object.keys(source || {})){
    if(Array.isArray(source[key])) target[key] = source[key];
    else if(source[key] && typeof source[key] === 'object') target[key] = deepMerge(target[key] || {}, source[key]);
    else target[key] = source[key];
  }
  return target;
}

function requireApi(){ if(!api) throw new Error('Firebase is not initialized. Check config/firebase-config.js.'); }
