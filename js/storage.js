import { firebaseConfig } from '../config/firebase-config.js';

const STORAGE_KEY = 'controlquest-state-v1';
let firebaseApi = null;
let currentUser = null;
let unsubscribe = null;

export function getFirebaseStatus(){
  return { enabled: Boolean(firebaseConfig.enabled), online: Boolean(firebaseApi && currentUser), user: currentUser };
}

export async function initFirebase(log){
  if(!firebaseConfig.enabled){ log?.('Firebase is disabled. Running in local demo mode.'); return null; }
  try{
    const appMod = await import('https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js');
    const authMod = await import('https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js');
    const dbMod = await import('https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js');
    const app = appMod.initializeApp(firebaseConfig);
    const auth = authMod.getAuth(app);
    const db = dbMod.getFirestore(app);
    firebaseApi = { app, auth, db, authMod, dbMod };
    authMod.onAuthStateChanged(auth, user => { currentUser = user; });
    log?.('Firebase initialized. Log in to sync.');
    return firebaseApi;
  }catch(error){ log?.(`Firebase failed to initialize: ${error.message}`); return null; }
}

export function loadLocal(defaultState){
  try{
    const raw = localStorage.getItem(STORAGE_KEY);
    if(!raw) return structuredClone(defaultState);
    return deepMerge(structuredClone(defaultState), JSON.parse(raw));
  }catch{
    return structuredClone(defaultState);
  }
}

export function saveLocal(state){
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export async function register(email,password,log){
  if(!firebaseApi) throw new Error('Firebase is not initialized.');
  const { auth, authMod } = firebaseApi;
  const credential = await authMod.createUserWithEmailAndPassword(auth,email,password);
  currentUser = credential.user;
  log?.(`Created account for ${credential.user.email}`);
  return credential.user;
}

export async function login(email,password,log){
  if(!firebaseApi) throw new Error('Firebase is not initialized.');
  const { auth, authMod } = firebaseApi;
  const credential = await authMod.signInWithEmailAndPassword(auth,email,password);
  currentUser = credential.user;
  log?.(`Logged in as ${credential.user.email}`);
  return credential.user;
}

export async function logout(log){
  if(!firebaseApi) return;
  await firebaseApi.authMod.signOut(firebaseApi.auth);
  currentUser = null;
  if(unsubscribe){ unsubscribe(); unsubscribe = null; }
  log?.('Logged out. Local mode remains available.');
}

export async function saveCloud(state,log){
  if(!firebaseApi || !currentUser) throw new Error('Log in before saving to Firebase.');
  const { db, dbMod } = firebaseApi;
  const guildId = state.settings.guildId || 'ty-comply';
  const activeName = state.currentPerson;
  const memberRef = dbMod.doc(db,'guilds',guildId,'members',currentUser.uid);
  const guildRef = dbMod.doc(db,'guilds',guildId);
  const sharedRef = dbMod.doc(db,'guilds',guildId,'shared','appState');
  await dbMod.setDoc(guildRef, {
    guildName: state.settings.guildName,
    guildId,
    memberEmails: [state.settings.bennettEmail, state.settings.tyEmail].filter(Boolean),
    updatedAt: new Date().toISOString()
  }, { merge:true });
  await dbMod.setDoc(memberRef, {
    uid: currentUser.uid,
    email: currentUser.email,
    displayName: activeName,
    profile: state.users[activeName],
    updatedAt: new Date().toISOString()
  }, { merge:true });
  await dbMod.setDoc(sharedRef, {
    settings: state.settings,
    sessions: state.sessions,
    qaeLogs: state.qaeLogs,
    errors: state.errors,
    flashcards: state.flashcards,
    homework: state.homework,
    pauseBlocks: state.pauseBlocks,
    roadmapStatus: state.roadmapStatus,
    checkins: state.checkins,
    liveNotes: state.liveNotes,
    updatedAt: new Date().toISOString()
  }, { merge:true });
  log?.('Saved user profile and shared study data to Firebase.');
}

export async function loadCloud(state,log){
  if(!firebaseApi || !currentUser) throw new Error('Log in before loading from Firebase.');
  const { db, dbMod } = firebaseApi;
  const guildId = state.settings.guildId || 'ty-comply';
  const sharedSnap = await dbMod.getDoc(dbMod.doc(db,'guilds',guildId,'shared','appState'));
  if(sharedSnap.exists()){
    const data = sharedSnap.data();
    Object.assign(state.settings, data.settings || {});
    state.sessions = data.sessions || [];
    state.qaeLogs = data.qaeLogs || [];
    state.errors = data.errors || [];
    state.flashcards = data.flashcards || [];
    state.homework = data.homework || [];
    state.pauseBlocks = data.pauseBlocks || [];
    state.roadmapStatus = data.roadmapStatus || {};
    state.checkins = data.checkins || {};
    state.liveNotes = data.liveNotes || '';
  }
  const members = await dbMod.getDocs(dbMod.collection(db,'guilds',guildId,'members'));
  members.forEach(docSnap => {
    const data = docSnap.data();
    if(data.displayName && data.profile){ state.users[data.displayName] = data.profile; }
  });
  log?.('Loaded shared guild data and member profiles from Firebase.');
  return state;
}

export function exportJson(state){
  const blob = new Blob([JSON.stringify(state,null,2)], { type:'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `controlquest-backup-${new Date().toISOString().slice(0,10)}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function importJson(file, defaultState){
  return new Promise((resolve,reject)=>{
    const reader = new FileReader();
    reader.onload = () => {
      try{ resolve(deepMerge(structuredClone(defaultState), JSON.parse(reader.result))); }
      catch(error){ reject(error); }
    };
    reader.onerror = reject;
    reader.readAsText(file);
  });
}

function deepMerge(target, source){
  if(!source || typeof source !== 'object') return target;
  for(const key of Object.keys(source)){
    if(Array.isArray(source[key])) target[key] = source[key];
    else if(source[key] && typeof source[key] === 'object') target[key] = deepMerge(target[key] || {}, source[key]);
    else target[key] = source[key];
  }
  return target;
}
