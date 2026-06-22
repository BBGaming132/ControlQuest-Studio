import { initFirebase, onAuth, signIn, createAccount, sendReset, signOutUser, loadProfile, saveProfile, backupProfile, deleteProfileData, createGroup, loadGroup, saveGroup, updateMemberSummary, subscribeGroup, publicSummary, isFirebaseReady, loadStudyLibrary, saveStudyImport, saveStudyDeck, saveStudyCard, saveStudyProgress, saveStudyReview, deleteStudyDeck } from './firebase-service.js';
import { RESOURCE_LINKS, TIMEZONES, DOMAIN_TOPICS, ISACA_STUDY_PLAN, CISA_RULES, DECISION_PROMPTS, HOMEWORK_SUGGESTIONS, DAILY_QUEST_TEMPLATES, SHOP_ITEMS, AVATAR_ITEMS, GAME_CATALOG } from './content.js';
import { parseQaePaste, missedConceptFromParsedQuestion } from './qae-parser.js';
import { DEFAULT_REVIEW_SETTINGS, buildImportBundle, buildStudyQueue, calculateLibraryStats, cardFingerprint, createReviewEvent, defaultProgress, formatCardBack, mergeUniqueLibrary, progressKey, rateCard, scopeKey, makeDeckId } from './flashcard-engine.js';
import { downloadIcs, canUseGoogleCalendar, connectGoogleCalendar, createGoogleEvent } from './calendar.js';

const $ = (sel, root=document) => root.querySelector(sel);
const $$ = (sel, root=document) => Array.from(root.querySelectorAll(sel));
const app = $('#app');
const todayIso = () => new Date().toISOString().slice(0,10);
function localDateForProfileSafe(profile){ try{ const tz=profile?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/New_York'; return new Intl.DateTimeFormat('en-CA',{timeZone:tz,year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date()); }catch{return todayIso();} }

const state = {
  firebase: { enabled:false },
  user: null,
  profile: null,
  group: null,
  activeView: 'command',
  activeAuthTab: 'login',
  currentMonth: new Date(),
  expandedWeeks: new Set(),
  expandedDays: new Set(),
  timerInterval: null,
  clockInterval: null,
  groupUnsub: null,
  tour: null,
  selectedNoteId: null,
  selectedDeckId: null,
  gameState: null,
  previewAvatar: null,
  lastScrollTop: 0,
  library: { decks: [], cards: [], progress: {}, reviews: [], loaded: false },
  toolsTab: 'library',
  libraryScopeFilter: 'All',
  studySession: null,
  deckIndex: 0,
  deckFlipped: false,
  quizSelection: null,
  quizRevealed: false,
  reviewStartedAt: null
};

const NAV = [
  ['command','Command Center','home'],
  ['room','Study Room','timer'],
  ['plan','Study Plan','roadmap'],
  ['practice','Practice Log','qae'],
  ['tools','Study Tools','arcade'],
  ['guild','Guild','guild'],
  ['calendar','Calendar','calendar'],
  ['notebook','Notebook','notebook'],
  ['rewards','Rewards','coin'],
  ['profile','Profile','target']
];

init();

async function init(){
  try {
    state.firebase = await withTimeout(initFirebase(), 8000, { enabled:false, reason:'Firebase startup timed out. Check network access to gstatic.com or Firebase config.' });
    onAuth(async user => {
      try {
        state.user = user;
        if (!user) { state.profile = null; state.group = null; renderAuth(); return; }
        let profile = await loadProfile(user.uid);
        if (!profile) profile = defaultProfile(user);
        profile = migrateProfile(profile, user);
        state.profile = profile;
        applyTheme();
        await saveProfileDebounced(true);
        if (profile.activeGroupId) await loadActiveGroup(profile.activeGroupId);
        await refreshStudyLibrary();
        await migrateLegacyStudyLibrary();
        startClock();
        renderApp();
        if (!profile.preferences?.onboardingComplete) setTimeout(()=>showOnboarding(), 500);
        else if (!profile.preferences?.pageTours?.command) setTimeout(()=>startTour('command', true), 500);
      } catch (error) {
        console.error('ControlQuest Auth/Profile Startup Failed', error);
        renderBootFallback('Profile Startup Failed', friendly(error));
      }
    });
  } catch (error) {
    console.error('ControlQuest Startup Failed', error);
    renderBootFallback('ControlQuest Startup Failed', friendly(error));
  }
}

function withTimeout(promise, ms, fallback){
  return Promise.race([promise, new Promise(resolve => setTimeout(() => resolve(fallback), ms))]);
}

function renderBootFallback(title, message){
  app.className = 'auth-shell';
  app.innerHTML = `<div class="auth-card"><div class="auth-visual"><img src="assets/icons/logo-mark.svg" alt="ControlQuest Studio Logo" style="width:92px;height:92px;border-radius:26px"><p class="eyebrow">Startup Diagnostic</p><h1>${esc(title)}</h1><p>${esc(message || 'The app could not finish loading.')}</p></div><div class="auth-form"><h2>What To Check</h2><p class="helper">Open DevTools → Console and look for the first red error. Also confirm these URLs work on your GitHub Pages site: <code>/js/app.js</code>, <code>/js/firebase-service.js</code>, <code>/config/firebase-config.js</code>, and <code>/css/styles.css</code>.</p><button class="primary-button" onclick="location.reload()">Reload Site</button></div></div>`;
}

function defaultProfile(user){
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/New_York';
  return {
    uid:user.uid,email:user.email||'',displayName:user.email?.split('@')[0] || 'Study Buddy',createdAt:new Date().toISOString(),timezone:tz,
    preferences:{theme:'dark',onboardingComplete:false,pageTours:{},defaultStudyDuration:60,dailyQaeGoal:10,calendarProvider:'ics',googleConnected:false,links:{qae:RESOURCE_LINKS.qae,udemy:'',youtubePlaylist:RESOURCE_LINKS.youtubePlaylist},studySettings:{...DEFAULT_REVIEW_SETTINGS}},
    stats:{xp:0,coins:0,streak:0,bestStreak:0,streakFreezes:1,qaeQuestions:0,qaeCorrect:0,studyMinutes:0,sessions:0,roadmapPct:0,lastQuestDate:null,lastStreakDate:null},
    inventory:{boosts:[],chests:[],ownedItems:['base-blue','eyes-normal','glasses-none','cape-none','hat-none','badge-none'],equipped:{baseColor:'#2fb7ff',eyes:'normal',glasses:'none',cape:'none',hat:'none',badge:'none'}},
    activity:[],daily:{date:todayIso(),quests:{}},qaeLogs:[],mistakes:[],missedQuestions:[],questionBank:[],qaeImports:[],homework:[],notes:[],memoryDecks:[],calendarEvents:[],studyHistory:{sessions:0,reviews:0,correct:0,incorrect:0},roadmap:{startDate:todayIso(),examDate:'2026-09-26',pauseBlocks:[],bonusSessions:[],completedTasks:{}},guildIds:[],activeGroupId:null
  };
}

function migrateProfile(p,user){
  const base = defaultProfile(user);
  const m = deepMerge(base,p||{});
  m.uid = user.uid; m.email = user.email || m.email;
  m.preferences.links ||= {}; m.preferences.links.qae ||= RESOURCE_LINKS.qae; m.preferences.links.udemy ||= RESOURCE_LINKS.udemy; m.preferences.links.youtubePlaylist ||= RESOURCE_LINKS.youtubePlaylist; m.preferences.studySettings=deepMerge(DEFAULT_REVIEW_SETTINGS,m.preferences.studySettings||{});
  m.stats.streakFreezes ??= 1; m.inventory.ownedItems ||= base.inventory.ownedItems; m.inventory.equipped ||= base.inventory.equipped;
  m.daily ||= {date:todayIso(),quests:{}}; if(m.daily.date !== todayIso()) m.daily = {date:todayIso(),quests:{}};
  m.activity ||= []; m.qaeLogs ||= []; m.mistakes ||= []; m.missedQuestions ||= []; m.questionBank ||= []; m.qaeImports ||= []; m.homework ||= []; m.notes ||= []; m.memoryDecks ||= []; m.memoryDecks=(m.memoryDecks||[]).filter(d=>!['public-cisa-audit-mindset','public-bcp-dr'].includes(d.id)); m.calendarEvents ||= []; m.studyHistory ||= {sessions:0,reviews:0,correct:0,incorrect:0};
  m.roadmap ||= base.roadmap; m.roadmap.pauseBlocks ||= []; m.roadmap.bonusSessions ||= []; m.roadmap.completedTasks ||= {};
  return m;
}

function deepMerge(a,b){ const out={...a}; for(const [k,v] of Object.entries(b||{})){ if(v && typeof v==='object' && !Array.isArray(v) && a[k] && typeof a[k]==='object' && !Array.isArray(a[k])) out[k]=deepMerge(a[k],v); else out[k]=v; } return out; }

function starterDecks(){ return []; }


function defaultGroup(ownerProfile, name='Study Guild'){
  const id = slug(`${name}-${Math.random().toString(36).slice(2,7)}`);
  return {id,name,code:Math.random().toString(36).slice(2,8).toUpperCase(),icon:'guild',color:'#7c4dff',ownerUid:ownerProfile.uid,createdAt:new Date().toISOString(),members:{[ownerProfile.uid]:publicSummary(ownerProfile)},events:[],liveSession:defaultLiveSession(ownerProfile),sessionStats:{completed:0,minutes:0,streak:0,lastDate:null},notes:[],questionBank:[],studySession:null};
}
function defaultLiveSession(profile){ return {title:'Morning Study Session',sessionDate:localDateForProfileSafe(profile),durationMinutes:profile?.preferences?.defaultStudyDuration||60,active:false,startedAt:null,accumulatedSeconds:0,completed:false,flow:dailySessionFlow(localDateForProfileSafe(profile)),checked:{},sharedNotes:'',updatedAt:new Date().toISOString()}; }
function dailySessionFlow(date=todayIso()){ const plan=todayPlanDay(); const topic=plan?.topic||'Today’s QAE Focus'; return [
  {id:`${date}-warmup`,title:'5-Minute Recall Warm-Up',details:'Say what you remember from yesterday, then name one QAE trap or missed concept.',links:[{label:'Open Notebook',go:'notebook'}]},
  {id:`${date}-qae`,title:'Live ISACA QAE Practice',details:'Run the official ISACA QAE together. Log the block afterward instead of recreating ISACA practice inside ControlQuest.',links:[{label:'Open ISACA QAE',url:RESOURCE_LINKS.qae},{label:'Log QAE Results',go:'practice'}]},
  {id:`${date}-misses`,title:'Capture Missed Questions As Concepts',details:'For misses, record a short concept summary, the correct CISA logic, and why the wrong answer was tempting. Do not paste proprietary full question text into shared/public areas.',links:[{label:'Open Missed Question Bank',go:'practice'}]},
  {id:`${date}-udemy`,title:'Optional Udemy Segment',details:`If today needs more teaching, watch or review the Udemy segment connected to ${topic}.`,links:[{label:'Open Udemy Link',url:RESOURCE_LINKS.udemy},{label:'Open Notebook',go:'notebook'}]},
  {id:`${date}-assign`,title:'Assign Homework And Flashcards',details:'Pick homework, add missed concepts to flashcards, and agree on what must be done before the next session.',links:[{label:'Open Study Tools',go:'tools'}]}
]; }

async function loadActiveGroup(groupId){
  if(state.groupUnsub) state.groupUnsub();
  state.group = await loadGroup(groupId);
  if(state.group && isFirebaseReady()) state.groupUnsub = subscribeGroup(groupId, g=>{ const previousLibraryVersion=state.group?.studyLibraryUpdatedAt; state.group = g; if(g?.studyLibraryUpdatedAt && g.studyLibraryUpdatedAt!==previousLibraryVersion) refreshStudyLibrary().then(()=>renderIfApp()); else renderIfApp(); });
}

async function refreshStudyLibrary(){
  if(!state.user) return;
  try{ const loaded=await loadStudyLibrary(state.user.uid,state.profile?.activeGroupId||null); state.library={...loaded,loaded:true}; }
  catch(error){ console.error('Study Library Load Failed',error); state.library={decks:[],cards:[],progress:{},reviews:[],loaded:true,error:friendly(error)}; }
}

async function migrateLegacyStudyLibrary(){
  if(!state.user || !state.library.loaded || state.profile.preferences?.legacyStudyMigrated) return;
  const legacyDecks=(state.profile.memoryDecks||[]).filter(d=>d.cards?.length);
  const legacyQuestions=(state.profile.questionBank||[]).filter(q=>q.question&&q.correctAnswer);
  if(!legacyDecks.length&&!legacyQuestions.length){ state.profile.preferences.legacyStudyMigrated=true; await saveProfileDebounced(true); return; }
  for(const old of legacyDecks){
    const scope=old.scope==='Guild'&&state.profile.activeGroupId?'Guild':'Personal';
    const key=scopeKey(scope,state.user.uid,state.profile.activeGroupId);
    const deck={id:makeDeckId(old.title,scope,state.user.uid,state.profile.activeGroupId,'legacy'),title:old.title,description:old.description||'Migrated legacy deck',scope,scopeKey:key,ownerUid:state.user.uid,groupId:scope==='Guild'?state.profile.activeGroupId:null,kind:'custom',createdAt:old.createdAt||new Date().toISOString(),updatedAt:new Date().toISOString()};
    const cards=(old.cards||[]).map(c=>{const fp=cardFingerprint(c.front||'',{});return{id:`card_${fp}`,fingerprint:fp,scope,scopeKey:key,deckIds:[deck.id],source:'Legacy Deck Migration',question:c.front||'',choices:{},correctAnswer:'',justifications:{_:(c.back||'')},tags:[old.title],ownerUid:state.user.uid,importedAt:new Date().toISOString(),updatedAt:new Date().toISOString()};});
    await saveStudyImport({uid:state.user.uid,groupId:state.profile.activeGroupId,decks:[deck],cards});
  }
  if(legacyQuestions.length){
    const normalized=legacyQuestions.map(q=>({...q,choices:q.choices||{},justifications:q.justifications||{},isCorrect:q.isCorrect??(q.result==='Correct'),fingerprint:q.fingerprint||cardFingerprint(q.question,q.choices)}));
    const scope=state.profile.activeGroupId&&legacyQuestions.some(q=>q.scope==='Guild')?'Guild':'Personal';
    const bundle=buildImportBundle({questions:normalized,title:'Migrated QAE Question Bank',scope,uid:state.user.uid,groupId:state.profile.activeGroupId,importedBy:state.profile.displayName,source:'Legacy QAE Migration'});
    await saveStudyImport({uid:state.user.uid,groupId:state.profile.activeGroupId,decks:bundle.decks,cards:bundle.cards});
  }
  state.profile.preferences.legacyStudyMigrated=true; state.profile.memoryDecks=[]; state.profile.questionBank=[]; await saveProfileDebounced(true); await refreshStudyLibrary();
}

function renderAuth(){
  app.className = 'auth-shell';
  app.innerHTML = `
    <div class="auth-card">
      <div class="auth-visual">
        <div class="avatar big">${avatarSvg(defaultProfile({uid:'x',email:'guest@controlquest.local'}).inventory.equipped)}</div>
        <p class="eyebrow">Gamified CISA Study Companion</p>
        <h1>Master The Audit Mindset.</h1>
        <p>Use ControlQuest as the adaptive, gamified layer on top of ISACA QAE, your course lessons, calendars, and your study Guild.</p>
        <div class="proof-row"><span>Firebase Sync</span><span>Guild Study Rooms</span><span>Daily Quests</span><span>XP + Audit Coins</span></div>
      </div>
      <div class="auth-form">
        <div class="auth-tabs"><button class="${state.activeAuthTab==='login'?'active':''}" data-auth-tab="login">Log In</button><button class="${state.activeAuthTab==='create'?'active':''}" data-auth-tab="create">Create Account</button></div>
        ${!state.firebase.enabled ? `<div class="soft"><strong>Firebase Is Not Connected.</strong><p class="helper">${esc(state.firebase.reason || 'Paste your Firebase values into config/firebase-config.js and set enabled: true.')}</p></div>` : ''}
        <form id="loginForm" class="auth-panel ${state.activeAuthTab==='login'?'active':''}">
          <h2>Welcome Back</h2><p class="helper">Log in with your Firebase Authentication email and password.</p>
          <label><span>Email</span><input type="email" id="loginEmail" autocomplete="email" required></label>
          <label><span>Password</span><input type="password" id="loginPassword" autocomplete="current-password" required></label>
          <div class="button-row"><button class="primary-button" type="submit">Log In</button><button class="text-button" type="button" id="resetPasswordBtn">Reset Password</button></div>
        </form>
        <form id="createForm" class="auth-panel ${state.activeAuthTab==='create'?'active':''}">
          <h2>Create Your Account</h2><p class="helper">This creates a Firebase Authentication account and then walks you through onboarding.</p>
          <label><span>Email</span><input type="email" id="createEmail" autocomplete="email" required></label>
          <label><span>Password</span><input type="password" id="createPassword" autocomplete="new-password" minlength="6" required></label>
          <button class="primary-button full" type="submit">Create Account</button>
        </form>
      </div>
    </div>`;
  $$('[data-auth-tab]').forEach(b=>b.onclick=()=>{state.activeAuthTab=b.dataset.authTab;renderAuth();});
  $('#loginForm')?.addEventListener('submit',async e=>{e.preventDefault(); if(!state.firebase?.enabled){return toast('Firebase is disabled. Your config/firebase-config.js file was likely overwritten. Restore your real Firebase config and set enabled: true.','error');} try{await signIn($('#loginEmail').value.trim(),$('#loginPassword').value);}catch(err){toast(friendly(err),'error');}});
  $('#createForm')?.addEventListener('submit',async e=>{e.preventDefault(); if(!state.firebase?.enabled){return toast('Firebase is disabled. Your config/firebase-config.js file was likely overwritten. Restore your real Firebase config and set enabled: true.','error');} try{await createAccount($('#createEmail').value.trim(),$('#createPassword').value);}catch(err){toast(friendly(err),'error');}});
  $('#resetPasswordBtn')?.addEventListener('click',async()=>{const email=$('#loginEmail').value.trim(); if(!email)return toast('Enter your email first.','error'); if(!state.firebase?.enabled){return toast('Firebase is disabled. Restore config/firebase-config.js before using password reset.','error');} try{await sendReset(email);toast('Password reset email sent.');}catch(err){toast(friendly(err),'error');}});
}

function renderApp(){
  if(!state.profile) return renderAuth();
  applyTheme();
  const top = getTopbar();
  app.className='app-shell';
  app.innerHTML = `
    <aside class="sidebar" id="sidebar">
      <button class="icon-button mobile-close" id="closeMenu">Close</button>
      <div class="brand"><img src="assets/icons/logo-mark.svg" alt=""><h1>ControlQuest</h1></div>
      <nav class="nav-list">${NAV.map(([id,label,iconName])=>`<button class="nav-btn ${state.activeView===id?'active':''}" data-view="${id}"><span class="app-icon ${iconName}">${svgIcon(iconName)}</span><span>${label}</span></button>`).join('')}</nav>
      <div class="side-player"><div class="avatar tiny">${avatarSvg(state.profile.inventory.equipped)}</div><div><strong>${esc(state.profile.displayName)}</strong><span>Level ${levelInfo().level} · ${state.profile.stats.streak} Day Streak</span></div></div>
    </aside>
    <main class="main">
      <div class="topbar">
        <div class="button-row"><button class="icon-button hamburger" id="openMenu">Menu</button><h2>${pageTitle()}</h2></div>
        <div class="top-actions">${top}</div>
      </div>
      ${renderStatusStrip()}
      <section id="viewRoot">${renderView()}</section>
    </main>`;
  bindCommon();
  bindView();
  startTimerTicker();
}
function renderIfApp(){ if(state.user && state.profile) renderApp(); }

function getTopbar(){
  const boost = activeBoost();
  return `${boost?`<div class="boost-chip" id="boostChip"><strong>${boost.multiplier}x XP Boost</strong><small>${boostRemainingText(boost)}</small></div>`:''}
  <div class="clock-chip"><strong id="topClock">${formatTimeNow()}</strong><small>${state.profile.timezone}</small></div>
  <div class="theme-control"><span>Theme</span><select id="themeSelect"><option value="dark" ${state.profile.preferences.theme==='dark'?'selected':''}>Dark</option><option value="light" ${state.profile.preferences.theme==='light'?'selected':''}>Light</option></select></div>
  <button class="secondary-button small" id="helpBtn">Help</button><button class="ghost-button small" id="logoutBtn">Log Out</button>`;
}
function pageTitle(){ return NAV.find(n=>n[0]===state.activeView)?.[1] || 'ControlQuest'; }
function renderStatusStrip(){
  const lvl = levelInfo(); const acc = qaeAccuracy(); const daily = dailyQuestCount();
  const tiles = [
    ['xp',`${state.profile.stats.xp||0}`,'Total XP'],['coin',`${state.profile.stats.coins||0}`,'Audit Coins'],['streak',`${state.profile.stats.streak||0}`,'Day Streak'],['qae',`${acc}%`,'QAE Accuracy'],['roadmap',`${Math.round(state.profile.stats.roadmapPct||0)}%`,'Roadmap']
  ];
  return `<div class="status-strip" data-tour="kpis">${tiles.map(([iconName,val,label])=>`<div class="stat-tile"><span class="app-icon ${iconName}">${svgIcon(iconName)}</span><div><span>${val}</span><small>${label}</small></div></div>`).join('')}</div>`;
}
function bindCommon(){
  $$('.nav-btn').forEach(b=>b.onclick=()=>{state.lastScrollTop=$('#sidebar .nav-list')?.scrollTop||0;state.activeView=b.dataset.view;renderApp();requestAnimationFrame(()=>{const nav=$('#sidebar .nav-list'); if(nav)nav.scrollTop=state.lastScrollTop;});});
  $('#themeSelect')?.addEventListener('change',e=>{state.profile.preferences.theme=e.target.value;applyTheme();saveProfileDebounced();});
  $('#helpBtn')?.addEventListener('click',()=>startTour(state.activeView,false));
  $('#logoutBtn')?.addEventListener('click',()=>signOutUser());
  $('#openMenu')?.addEventListener('click',()=>$('#sidebar')?.classList.add('open'));
  $('#closeMenu')?.addEventListener('click',()=>$('#sidebar')?.classList.remove('open'));
  $$('[data-go]').forEach(b=>b.onclick=()=>{state.activeView=b.dataset.go;renderApp();});
  $$('[data-url]').forEach(b=>b.onclick=()=>window.open(b.dataset.url,'_blank','noopener'));
}

function renderView(){
  const views = {command:renderCommand,room:renderRoom,plan:renderPlan,practice:renderPractice,tools:renderTools,guild:renderGuild,calendar:renderCalendar,notebook:renderNotebook,rewards:renderRewards,profile:renderProfile};
  return (views[state.activeView]||renderCommand)();
}

function renderCommand(){
  const lvl=levelInfo(), pct=Math.round(lvl.progress*100), recent=(state.profile.activity||[]).slice(0,5), daily=dailyQuestCount();
  return `<div class="dashboard-grid">
    <div class="panel hero span-8" data-tour="hero">
      <div><p class="eyebrow">Today’s Mission</p><h2>${missionTitle()}</h2><p>${missionCopy()}</p><div class="hero-actions"><button class="primary-button" data-go="room">Open Study Room</button><button class="secondary-button" data-go="plan">View Study Plan</button><button class="ghost-button" data-url="${RESOURCE_LINKS.qae}">Open ISACA QAE</button></div></div>
      <div class="hero-avatar"><div class="avatar big">${avatarSvg(state.profile.inventory.equipped)}</div><div class="speech">${dailyMotivation()}</div></div>
    </div>
    <div class="panel span-4" data-tour="progress-engine">
      <div class="section-head"><div><p class="eyebrow">Progress Engine</p><h3>Level ${lvl.level}</h3></div><span class="app-icon xp">${svgIcon('xp')}</span></div>
      <p class="helper">${state.profile.stats.xp} Total XP · ${lvl.current} / ${lvl.next} XP Toward Level ${lvl.level+1}</p>
      <div class="progress"><span style="width:${pct}%"></span></div>
      <div class="button-row"><span class="bubble">${pct}% To Next Level</span><span class="bubble warn">${state.profile.stats.coins||0} Audit Coins</span></div>
      <hr style="border-color:var(--line);margin:16px 0">
      <div class="section-head"><h3>Recent Activity</h3><button class="text-button small" data-go="rewards">Full Activity</button></div>
      <div class="recent-list compact">${recent.length?recent.map(activityItem).join(''):'<div class="empty">No XP activity yet. Complete a quest to start the log.</div>'}</div>
    </div>
    <div class="panel span-12 daily-panel" data-tour="daily-quests">
      <div class="section-head"><div><p class="eyebrow">Daily Quests</p><h3>Complete 3 Quests To Protect Today’s Streak</h3><p class="helper">Daily Quests are the only thing that moves your normal weekday streak. Study sessions, homework, and games still earn XP and Audit Coins.</p></div><span class="bubble ${daily>=3?'good':'warn'}">${Math.min(3,daily)} / 3 Complete</span></div>
      <div class="daily-quests">${DAILY_QUEST_TEMPLATES.map(q=>questCard(q)).join('')}</div>
    </div>
    <div class="panel span-6" data-tour="guild-snapshot">
      <div class="section-head"><div><p class="eyebrow">Guild Snapshot</p><h3>${esc(state.group?.name||'No Study Guild Yet')}</h3></div><button class="secondary-button small" data-go="guild">Open Guild</button></div>
      ${renderGuildMini()}
    </div>
    <div class="panel span-6" data-tour="catch-up">
      <div class="section-head"><div><p class="eyebrow">Catch-Up Compass</p><h3>What Needs Attention</h3></div><span class="app-icon roadmap">${svgIcon('roadmap')}</span></div>
      ${renderCatchup()}
    </div>
  </div>`;
}
function todayPlanDay(){
  try {
    const weeks = buildRoadmap();
    const days = weeks.flatMap(w => w.days || []).filter(d => d && Array.isArray(d.tasks) && d.tasks.length && d.status !== 'Paused');
    const today = localDateForProfile();
    return days.find(d => d.iso === today) || days.find(d => d.iso >= today && !dayComplete(d)) || days.find(d => !dayComplete(d)) || days[0] || null;
  } catch (error) {
    console.warn('Unable to resolve today plan day', error);
    return null;
  }
}
function missionTitle(){ const d=todayPlanDay(); return d?.topic ? `Lock In: ${d.topic}` : 'Start Strong Today'; }
function missionCopy(){ return 'Use the Study Room for your live session, then finish Daily Quests and Homework to keep progress honest without faking it.'; }
function dailyMotivation(){ const opts=['Small wins compound.','Think like an auditor.','Evidence beats vibes.','Risk drives the plan.','Control the moment.']; return opts[new Date().getDate()%opts.length]; }
function questCard(q){ const done=!!state.profile.daily.quests[q.id]; return `<div class="quest-card ${done?'complete':''}"><span class="app-icon ${q.icon}">${svgIcon(q.icon)}</span><h4>${q.title}</h4><p>${q.details}</p><strong>+${q.xp} XP · +${q.coins} Coins</strong><div class="button-row"><button class="${done?'secondary-button':'primary-button'} small" data-quest="${q.id}" ${done?'disabled':''}>${done?'Complete':'Mark Complete'}</button></div></div>`; }
function bindCommand(){ $$('[data-quest]').forEach(b=>b.onclick=()=>completeDailyQuest(b.dataset.quest)); }
function completeDailyQuest(id){ if(state.profile.daily.quests[id]) return; const q=DAILY_QUEST_TEMPLATES.find(x=>x.id===id); state.profile.daily.quests[id]=new Date().toISOString(); award({xp:q.xp,coins:q.coins,reason:q.title,type:'Daily Quest'}); if(dailyQuestCount()>=3) updateStreakForToday(); saveProfileDebounced(); renderApp(); }
function dailyQuestCount(){ return Math.min(3,Object.keys(state.profile.daily?.quests||{}).length); }
function updateStreakForToday(){ const stats=state.profile.stats; const today=localDateForProfile(); if(stats.lastStreakDate===today) return; const y=shiftDate(today,-1); if(stats.lastStreakDate===y) stats.streak=(stats.streak||0)+1; else stats.streak=1; stats.bestStreak=Math.max(stats.bestStreak||0,stats.streak); stats.lastStreakDate=today; awardRawActivity({xp:0,coins:0,reason:`${stats.streak} Day Streak Protected`,type:'Streak'}); }
function renderGuildMini(){ const members=Object.values(state.group?.members||{}); if(!state.group)return `<div class="empty"><p>Create or join a Study Guild to compare high-level progress with study buddies.</p><button class="primary-button small" data-go="guild">Set Up Guild</button></div>`; return `<div class="grid">${members.map(m=>`<div class="member-card"><div class="button-row"><div class="avatar tiny">${avatarSvg(m.avatar||{})}</div><div><strong>${esc(m.name)}</strong><div class="metric-row"><span class="bubble">Level ${m.level||1}</span><span class="bubble good">${m.streak||0} Day Streak</span><span class="bubble">${m.qaeAccuracy||0}% QAE</span></div></div></div></div>`).join('')}</div>`; }
function renderCatchup(){ const overdue=state.profile.homework.filter(h=>!h.complete && h.dueDate && h.dueDate<todayIso()); const missed=computeMissedDays(); if(!overdue.length && !missed.length) return `<div class="soft"><strong>You Are Current.</strong><p class="helper">No overdue homework or missed study days are showing right now.</p></div>`; return `<div class="grid">${overdue.map(h=>`<div class="soft"><strong>Overdue Homework: ${esc(h.title)}</strong><p class="helper">Due ${fmtDate(h.dueDate)} · Complete this before adding new stretch work.</p><button class="primary-button small" data-go="room">Open Homework</button></div>`).join('')}${missed.map(d=>`<div class="soft"><strong>Missed Day: ${fmtDate(d)}</strong><p class="helper">Complete late tasks for partial XP and coins. Your streak only stays safe if a pause block or streak freeze applies.</p><button class="secondary-button small" data-go="plan">Open Study Plan</button></div>`).join('')}</div>`; }
function computeMissedDays(){ return []; }

function renderRoom(){
  const s = state.group?.liveSession || defaultLiveSession(state.profile);
  const elapsed=timerSeconds(s), total=(s.durationMinutes||60)*60, remaining=Math.max(0,total-elapsed), pct=Math.min(100,Math.round(elapsed/Math.max(1,total)*100));
  return `<div class="grid two">
    <div class="panel timer-panel" data-tour="room-timer">
      <p class="eyebrow">Live Synced Session</p><h3>${esc(s.title||'Study Session')}</h3>
      <div class="timer-orb" id="timerOrb" style="--timer-progress:${pct}%"><div class="timer-inner"><strong id="timerText">${fmtTime(remaining)}</strong><span>${pct}% Complete</span></div></div>
      <div class="timer-bar"><span id="timerBar" style="width:${pct}%"></span></div>
      <div class="form-grid" style="margin-top:14px"><label><span class="label-title">Session Title</span><input id="sessionTitle" value="${escAttr(s.title||'Morning Study Session')}"></label><label><span class="label-title">Duration In Minutes</span><input id="sessionDuration" type="number" min="5" max="240" value="${s.durationMinutes||60}"></label></div>
      <div class="button-row" style="justify-content:center;margin-top:14px"><button class="primary-button" id="timerToggle">${s.active?'Pause Timer':'Start Timer'}</button><button class="secondary-button" id="timerReset">Reset Timer</button><button class="ghost-button" id="saveSessionSettings">Save Settings</button><button class="primary-button" id="completeSession">Complete Session</button></div>
    </div>
    <div class="panel" data-tour="session-flow">
      <div class="section-head"><div><p class="eyebrow">Shared Session Flow</p><h3>Today’s Checklist</h3><p class="helper">These items sync for the active Guild session. Use them as the structure for your 7–8 AM block.</p></div></div>
      <div class="flow-list">${(s.flow||dailySessionFlow()).map(item=>flowItem(item,s.checked?.[item.id])).join('')}</div>
    </div>
    <div class="panel span-12">
      <div class="section-head"><div><p class="eyebrow">QAE Study Loop</p><h3>Practice → Import → Review → Reinforce</h3><p class="helper">Use the official QAE during the live hour, then import the review dump once. ControlQuest automatically builds the lesson deck, Master QAE Question Bank, Master Missed Questions, flashcard queue, and retake quiz.</p></div><span class="bubble good">${calculateLibraryStats(state.library.cards,state.library.progress,state.library.reviews).due} Cards Due</span></div>
      <div class="button-row"><button class="primary-button" data-url="${RESOURCE_LINKS.qae}">Open ISACA QAE</button><button class="secondary-button" data-go="practice">Import Today’s QAE Session</button><button class="secondary-button" data-open-study-tools="review">Open Smart Review</button><button class="secondary-button" data-open-study-tools="quiz">Retake Questions</button><button class="ghost-button" data-open-study-tools="guild-study">Start Guild Review</button></div>
    </div>
    <div class="panel span-12" data-tour="homework-builder">
      <div class="section-head"><div><p class="eyebrow">Homework Builder</p><h3>Pick Work For Later</h3><p class="helper">Select homework, add custom work, and it will show up with due dates and links.</p></div></div>
      <div class="homework-picker">${rotateHomework().map(homeworkOption).join('')}</div>
      <div class="selected-homework">${renderHomeworkList()}</div>
      <div class="soft"><h4>Add Custom Homework</h4><div class="form-grid"><input id="customHwTitle" placeholder="Custom Homework Title"><input id="customHwDue" type="date" value="${shiftDate(todayIso(),1)}"></div><textarea id="customHwDetails" placeholder="Details, links, or proof you want to capture..."></textarea><button class="secondary-button small" id="addCustomHomework">Add Custom Homework</button></div>
    </div>
    <div class="panel span-12" data-tour="shared-notes">
      <div class="section-head"><div><p class="eyebrow">Guild Session Notes</p><h3>Shared Notes For This Session</h3><p class="helper">These notes sync in the Study Room and can be saved into the Guild Notebook.</p></div></div>
      <textarea id="sharedNotes" placeholder="Add shared notes, CISA rules, QAE traps, or follow-up questions...">${esc(s.sharedNotes||'')}</textarea>
      <div class="button-row"><button class="primary-button" id="saveSharedNotes">Save Shared Notes</button><button class="secondary-button" id="sendToNotebook">Save To Guild Notebook</button></div>
    </div>
  </div>`;
}
function flowItem(item,done){ return `<div class="flow-item ${done?'complete':''}"><input type="checkbox" data-flow="${item.id}" ${done?'checked':''}><div><h4>${esc(item.title)}</h4><p class="helper">${esc(item.details)}</p><div class="flow-links">${(item.links||[]).map(linkButton).join('')}</div></div><span class="bubble">${done?'Complete':'Open'}</span></div>`; }
function linkButton(l){ if(l.go) return `<button class="secondary-button small" data-go="${l.go}">${esc(l.label)}</button>`; return `<button class="secondary-button small" data-url="${l.url}">${esc(l.label)}</button>`; }
function rotateHomework(){ const start = new Date().getDate()%HOMEWORK_SUGGESTIONS.length; return [...HOMEWORK_SUGGESTIONS.slice(start),...HOMEWORK_SUGGESTIONS.slice(0,start)].slice(0,6); }
function homeworkOption(h){ return `<div class="homework-card"><div class="tagline"><span class="bubble">${h.type}</span><span class="bubble good">+${h.xp} XP</span><span class="bubble warn">+${h.coins} Coins</span></div><h4>${h.title}</h4><p class="helper">${h.details}</p><div class="button-row"><button class="primary-button small" data-hw-option="${h.id}">Select Homework</button>${(h.links||[]).map(linkButton).join('')}</div></div>`; }
function renderHomeworkList(){ const list=state.profile.homework.filter(h=>!h.complete).slice(0,10); return list.length?`<h3>Selected Homework</h3>${list.map(h=>`<div class="homework-card"><div class="section-head"><div><h4>${esc(h.title)}</h4><p class="helper">Due ${fmtDate(h.dueDate)} · ${esc(h.details||'')}</p><div class="flow-links">${(h.links||[]).map(linkButton).join('')}</div></div><button class="primary-button small" data-complete-hw="${h.id}">Mark Complete</button></div></div>`).join('')}`:'<div class="empty">No active homework. Pick a suggestion above or add custom homework.</div>'; }
function bindRoom(){
  $('#timerToggle')?.addEventListener('click',toggleTimer); $('#timerReset')?.addEventListener('click',resetTimer); $('#completeSession')?.addEventListener('click',completeSession);
  $('#saveSessionSettings')?.addEventListener('click',saveSessionSettings);
  $$('[data-flow]').forEach(cb=>cb.onchange=()=>toggleFlow(cb.dataset.flow,cb.checked));
  $$('[data-hw-option]').forEach(b=>b.onclick=()=>addHomework(b.dataset.hwOption));
  $$('[data-complete-hw]').forEach(b=>b.onclick=()=>completeHomework(b.dataset.completeHw));
  $('#addCustomHomework')?.addEventListener('click',()=>addCustomHomework());
  $('#saveSharedNotes')?.addEventListener('click',()=>saveSharedNotes(false));
  $('#sendToNotebook')?.addEventListener('click',()=>saveSharedNotes(true));
  $$('[data-open-study-tools]').forEach(b=>b.onclick=()=>{state.toolsTab=b.dataset.openStudyTools;state.activeView='tools';renderApp();});
}
async function ensureGroupForRoom(){ if(!state.group){ const g=defaultGroup(state.profile,'My Study Guild'); state.group=g; state.profile.activeGroupId=g.id; state.profile.guildIds=[...new Set([...(state.profile.guildIds||[]),g.id])]; await createGroup(g); await saveProfileDebounced(true); } const today=localDateForProfile(); state.group.liveSession ||= defaultLiveSession(state.profile); const s=state.group.liveSession; if(!s.sessionDate || s.sessionDate!==today){ const keepTitle=s.title||'Morning Study Session'; const keepDuration=(Number(s.durationMinutes)>=5?Number(s.durationMinutes):(state.profile.preferences.defaultStudyDuration||60)); state.group.liveSession={...defaultLiveSession(state.profile),title:keepTitle,durationMinutes:keepDuration,sessionDate:today}; await saveGroup(state.group); } else if(!Number(s.durationMinutes) || Number(s.durationMinutes)<5){ s.durationMinutes=state.profile.preferences.defaultStudyDuration||60; await saveGroup(state.group); } }
async function saveSessionSettings(){ await ensureGroupForRoom(); const dur=Number($('#sessionDuration').value); if(!dur||dur<5||dur>240)return toast('Duration must be between 5 and 240 minutes.','error'); state.group.liveSession.title=$('#sessionTitle').value.trim()||'Study Session'; state.group.liveSession.durationMinutes=dur; state.group.liveSession.updatedAt=new Date().toISOString(); await saveGroup(state.group); toast('Session settings saved.'); renderApp(); }
async function toggleTimer(){ await ensureGroupForRoom(); const s=state.group.liveSession; const inputDur=Number($('#sessionDuration')?.value); if(inputDur>=5 && inputDur<=240) s.durationMinutes=inputDur; s.title=$('#sessionTitle')?.value.trim()||s.title||'Study Session'; if(s.active){ s.accumulatedSeconds=timerSeconds(s); s.active=false; s.startedAt=null; } else { s.active=true; s.startedAt=new Date().toISOString(); } s.updatedAt=new Date().toISOString(); await saveGroup(state.group); renderApp(); }
async function resetTimer(){ await ensureGroupForRoom(); await confirmModal('Reset Timer','This resets the active Study Room timer for the Guild. Continue?', async()=>{ state.group.liveSession.active=false; state.group.liveSession.startedAt=null; state.group.liveSession.accumulatedSeconds=0; await saveGroup(state.group); renderApp(); }); }
async function completeSession(){ await ensureGroupForRoom(); const s=state.group.liveSession; const mins=Math.round(timerSeconds(s)/60); const pct=Math.min(1, timerSeconds(s)/((s.durationMinutes||60)*60)); const earnedXp=Math.round(50*pct), earnedCoins=Math.round(20*pct); award({xp:earnedXp,coins:earnedCoins,reason:`Completed ${s.title}`,type:'Study Session'}); state.profile.stats.sessions=(state.profile.stats.sessions||0)+1; state.profile.stats.studyMinutes=(state.profile.stats.studyMinutes||0)+mins; state.group.sessionStats ||= {completed:0,minutes:0,streak:0}; state.group.sessionStats.completed+=1; state.group.sessionStats.minutes+=mins; state.group.sessionStats.lastDate=todayIso(); state.group.liveSession=defaultLiveSession(state.profile); await saveAll({group:true}); showCelebration('Study Session Complete',`You logged ${mins} minutes and earned ${earnedXp} XP.`); renderApp(); }
async function toggleFlow(id,checked){ await ensureGroupForRoom(); state.group.liveSession.checked ||= {}; state.group.liveSession.checked[id]=checked; state.group.liveSession.updatedAt=new Date().toISOString(); await saveGroup(state.group); }
function addHomework(id){ const h=HOMEWORK_SUGGESTIONS.find(x=>x.id===id); if(!h) return; if(state.profile.homework.some(x=>!x.complete && x.sourceTemplate===id)) return toast('That homework is already selected.','error'); state.profile.homework.unshift({id:crypto.randomUUID(),sourceTemplate:id,title:h.title,details:h.details,type:h.type,xp:h.xp,coins:h.coins,links:h.links,dueDate:shiftDate(todayIso(),1),createdAt:new Date().toISOString(),complete:false,source:'Study Room'}); awardRawActivity({xp:0,coins:0,reason:`Homework Selected: ${h.title}`,type:'Homework'}); saveProfileDebounced(); renderApp(); }
function addCustomHomework(){ const title=$('#customHwTitle').value.trim(); if(!title)return toast('Add a custom homework title.','error'); state.profile.homework.unshift({id:crypto.randomUUID(),title,details:$('#customHwDetails').value.trim(),type:'Custom',xp:20,coins:8,links:[],dueDate:$('#customHwDue').value||shiftDate(todayIso(),1),createdAt:new Date().toISOString(),complete:false,source:'Custom'}); saveProfileDebounced(); renderApp(); }
function completeHomework(id){ const h=state.profile.homework.find(x=>x.id===id); if(!h)return; h.complete=true; h.completedAt=new Date().toISOString(); award({xp:h.xp||20,coins:h.coins||8,reason:`Homework Complete: ${h.title}`,type:'Homework'}); saveProfileDebounced(); renderApp(); }
async function saveSharedNotes(toNotebook){ await ensureGroupForRoom(); const val=$('#sharedNotes').value.trim(); state.group.liveSession.sharedNotes=val; if(toNotebook && val){ state.profile.notes.unshift({id:crypto.randomUUID(),scope:'Guild',title:`Session Notes - ${fmtDate(todayIso())}`,body:val,createdAt:new Date().toISOString(),updatedAt:new Date().toISOString(),source:'Study Room'}); state.group.notes ||= []; state.group.notes.unshift({id:crypto.randomUUID(),author:state.profile.displayName,title:`Session Notes - ${fmtDate(todayIso())}`,body:val,createdAt:new Date().toISOString(),source:'Study Room'}); award({xp:10,coins:4,reason:'Saved Guild Session Notes',type:'Notes'}); }
  await saveAll({group:true}); toast(toNotebook?'Saved to Guild Notebook.':'Shared notes saved.'); }

function renderPlan(){
  const rp=state.profile.roadmap; const weeks=buildRoadmap();
  return `<div class="grid">
    <div class="panel" data-tour="plan-controls"><div class="section-head"><div><p class="eyebrow">Adaptive Study Plan</p><h3>Personal Roadmap</h3><p class="helper">Changing the start date, exam date, pause blocks, or bonus sessions recalculates the day-by-day plan.</p></div></div>
      <div class="plan-controls"><label><span class="label-title">Start Date</span><input id="planStart" type="date" value="${rp.startDate}"></label><label><span class="label-title">Exam Date</span><input id="planExam" type="date" value="${rp.examDate}"></label><label><span class="label-title">Daily QAE Goal</span><input id="dailyGoal" type="number" min="1" max="150" value="${state.profile.preferences.dailyQaeGoal||10}"></label><div style="align-self:end" class="button-row"><button class="primary-button" id="recalcPlan">Recalculate Plan</button><button class="secondary-button" id="addPause">Add Pause / Rest Day</button><button class="secondary-button" id="addBonus">Add Bonus Session</button></div></div>
      <div class="soft"><strong>${weeks.length} Weeks Planned</strong><div class="progress"><span style="width:${Math.round(state.profile.stats.roadmapPct||0)}%"></span></div><p class="helper">Roadmap completion comes from checking off lesson tasks inside each day card.</p></div>
    </div>
    <div class="grid">${weeks.map(weekCard).join('')}</div>
  </div>`;
}
function flatStudyTopics(){
  return ISACA_STUDY_PLAN.flatMap(d => d.topics.map((t, i) => ({
    domain: d.domain,
    name: d.name,
    domainId: d.id,
    topicId: t.id,
    topicIndex: i,
    topic: t.title,
    knowledgePoints: t.knowledgePoints,
    time: t.time,
    links: topicLinks(t)
  })));
}
function buildRoadmap(){
  const start=parseLocal(state.profile.roadmap.startDate), exam=parseLocal(state.profile.roadmap.examDate); if(!start||!exam||start>exam)return [];
  const weekStart=startOfWeek(start); const allTopics=flatStudyTopics();
  const days=[]; let cursor=new Date(weekStart); let topicIdx=0; while(cursor<=exam){ const iso=dateIso(cursor), dow=cursor.getDay(); const paused=findPause(iso); const bonus=findBonus(iso); let tasks=[]; let status='Rest'; if(paused){ status='Paused'; tasks=[{id:`pause-${iso}`,title:`Pause Block: ${paused.reason||'Rest Day'}`,details:'This day is protected and will not hurt your streak.',links:[]}]; }
    else if(dow>=1 && dow<=5 && cursor>=start){ status='Open'; const topic=allTopics[topicIdx%allTopics.length]; topicIdx++; tasks=lessonTasks(topic,iso); }
    if(bonus){ status = status==='Rest'?'Bonus':status; tasks.push(...bonusTasks(bonus,iso)); }
    days.push({iso,dow,status,tasks}); cursor.setDate(cursor.getDate()+1); }
  const weeks=[]; for(let i=0;i<days.length;i+=7){ const ds=days.slice(i,i+7); weeks.push({index:weeks.length+1,start:ds[0].iso,end:ds[ds.length-1].iso,days:ds}); }
  updateRoadmapPct(days); return weeks;
}
function lessonTasks(topic,iso){ const due=calculateLibraryStats(state.library.cards,state.library.progress,state.library.reviews).due; return [
  {id:`${iso}-qae`,title:`Official QAE Practice: ${topic.topic}`,details:`Primary work: complete roughly ${state.profile.preferences.dailyQaeGoal||10} official QAE questions for ${topic.domain} · ${topic.name}.`,links:[{label:'Open ISACA QAE',url:RESOURCE_LINKS.qae},{label:'Open Study Room',go:'room'}]},
  {id:`${iso}-import`,title:'Build Today’s Study Package',details:'Paste or upload the QAE review output once. ControlQuest automatically creates the lesson deck, deduplicates the Master QAE bank, records misses, and generates quiz/flashcard content.',links:[{label:'Open QAE Importer',go:'practice'}]},
  {id:`${iso}-review`,title:`Adaptive Review (${due} Currently Due)`,details:'Complete a Smart Review round from the Master Missed Questions or today’s lesson deck. Ratings determine the next due date for every card.',links:[{label:'Open Smart Review',go:'tools'}]},
  {id:`${iso}-retake`,title:'Retake Or Guild Reinforcement',details:'Retake missed questions in Quiz Mode, run a synchronized Guild review, or play a question-powered game.',links:[{label:'Open Study Tools',go:'tools'}]},
  {id:`${iso}-optional-udemy`,title:`Optional Teaching Pass: ${topic.topic}`,details:'Use Udemy only when the QAE explanation is not enough and you need a full lesson. This remains optional and does not block day completion.',optional:true,links:topic.links}
]; }
function bonusTasks(b,iso){ return [{id:`${iso}-bonus-${b.id}`,title:`Bonus Session: ${b.title}`,details:b.description||'Extra study block. Use this to pull future work forward or reinforce weak areas.',links:[{label:'Open Study Room',go:'room'},{label:'Open ISACA QAE',url:RESOURCE_LINKS.qae}]}]; }
function topicLinks(t){ const title = typeof t === 'string' ? t : t.title; const links=[{label:'Open ISACA QAE',url:RESOURCE_LINKS.qae},{label:'Open Outline Doc',url:RESOURCE_LINKS.isacaOutline}]; if(state.profile?.preferences?.links?.udemy || RESOURCE_LINKS.udemy) links.push({label:'Open Udemy Course',url:state.profile?.preferences?.links?.udemy||RESOURCE_LINKS.udemy}); links.push({label:'Extra YouTube Resource',url:RESOURCE_LINKS.youtubePlaylist}); return links; }
function weekCard(w){ const open=state.expandedWeeks.has(w.index); return `<div class="week-card" style="border-top:5px solid ${weekColor(w.index)}"><div class="week-head" data-week="${w.index}"><div><h3>Week ${w.index} · ${fmtDate(w.start)} – ${fmtDate(w.end)}</h3><p class="helper">${w.days.filter(d=>d.tasks.length).length} active days · ${w.days.filter(d=>d.status==='Paused').length} pause days</p></div><span class="app-icon roadmap">${svgIcon('roadmap')}</span><span class="chev">⌄</span></div>${open?`<div class="week-body">${w.days.map(dayCard).join('')}</div>`:''}</div>`; }
function dayCard(d){ const open=state.expandedDays.has(d.iso); const complete=dayComplete(d); const status=complete?'Complete':d.status; return `<div class="day-card ${open?'open':''}"><div class="day-head" data-day="${d.iso}"><div><span class="date">${fmtDate(d.iso)}</span><span class="bubble ${status==='Complete'?'good':status==='Paused'?'warn':''}">${status}</span></div><span class="chev">⌄</span></div><div class="day-body"><div class="task-list">${d.tasks.length?d.tasks.map(t=>taskItem(t)).join(''):'<div class="empty">Rest Day. No required tasks.</div>'}</div></div></div>`; }
function taskItem(t){ const done=!!state.profile.roadmap.completedTasks[t.id]; return `<div class="task-item"><input type="checkbox" data-task="${t.id}" ${done?'checked':''}><div><h4>${esc(t.title)}</h4><p class="helper">${esc(t.details)}</p><div class="task-actions">${(t.links||[]).map(linkButton).join('')}</div></div></div>`; }
function bindPlan(){
  $('#recalcPlan')?.addEventListener('click',()=>{ const s=$('#planStart').value,e=$('#planExam').value,g=Number($('#dailyGoal').value); if(!s||!e||parseLocal(s)>parseLocal(e))return toast('Start Date must be on or before Exam Date.','error'); if(!g||g<1||g>150)return toast('Daily QAE Goal must be between 1 and 150.','error'); state.profile.roadmap.startDate=s; state.profile.roadmap.examDate=e; state.profile.preferences.dailyQaeGoal=g; saveProfileDebounced(); renderApp(); toast('Study Plan recalculated.'); });
  $('#addPause')?.addEventListener('click',()=>pauseModal()); $('#addBonus')?.addEventListener('click',()=>bonusModal());
  $$('[data-week]').forEach(el=>el.onclick=()=>{toggleSet(state.expandedWeeks,Number(el.dataset.week));renderApp();});
  $$('[data-day]').forEach(el=>el.onclick=()=>{toggleSet(state.expandedDays,el.dataset.day);renderApp();});
  $$('[data-task]').forEach(cb=>cb.onchange=()=>toggleTask(cb.dataset.task,cb.checked));
  $$('[data-delete-pause]').forEach(b=>b.onclick=()=>{state.profile.roadmap.pauseBlocks=state.profile.roadmap.pauseBlocks.filter(p=>p.id!==b.dataset.deletePause);saveProfileDebounced();renderApp();});
}
function toggleTask(id,checked){ state.profile.roadmap.completedTasks[id]=checked?new Date().toISOString():null; if(!checked) delete state.profile.roadmap.completedTasks[id]; award({xp: checked?8:0, coins: checked?3:0, reason: checked?'Roadmap Task Complete':'Roadmap Task Updated', type:'Roadmap'}); saveProfileDebounced(); renderApp(); }
function pauseModal(){ modal('Add Pause / Rest Day',`<div class="form-grid"><label><span class="label-title">Start Date</span><input id="pauseStart" type="date" value="${todayIso()}"></label><label><span class="label-title">End Date</span><input id="pauseEnd" type="date" value="${todayIso()}"></label></div><label><span class="label-title">Reason</span><input id="pauseReason" placeholder="Vacation, client travel, PTO, etc."></label>`,()=>{ const s=$('#pauseStart').value,e=$('#pauseEnd').value; if(!s||!e||parseLocal(s)>parseLocal(e))return toast('Pause date range is invalid.','error'); state.profile.roadmap.pauseBlocks.push({id:crypto.randomUUID(),start:s,end:e,reason:$('#pauseReason').value.trim()||'Rest Day'}); saveProfileDebounced(); renderApp(); },'Add Pause'); }
function bonusModal(){ modal('Add Bonus Study Session',`<div class="form-grid"><label><span class="label-title">Date</span><input id="bonusDate" type="date" value="${todayIso()}"></label><label><span class="label-title">Minutes</span><input id="bonusMinutes" type="number" min="15" max="300" value="60"></label></div><label><span class="label-title">Session Title</span><input id="bonusTitle" placeholder="Weekend QAE Sprint"></label><label><span class="label-title">Description</span><textarea id="bonusDesc" placeholder="What will you cover?"></textarea></label>`,()=>{ const d=$('#bonusDate').value, mins=Number($('#bonusMinutes').value); if(!d||!mins||mins<15||mins>300)return toast('Bonus session needs a valid date and minutes.','error'); state.profile.roadmap.bonusSessions.push({id:crypto.randomUUID(),date:d,title:$('#bonusTitle').value.trim()||'Bonus Study Session',description:$('#bonusDesc').value.trim(),minutes:mins}); saveProfileDebounced(); renderApp(); },'Add Session'); }
function updateRoadmapPct(days){ const tasks=days.flatMap(d=>d.tasks).filter(t=>!t.id.startsWith('pause')); const done=tasks.filter(t=>state.profile.roadmap.completedTasks[t.id]).length; state.profile.stats.roadmapPct=tasks.length?Math.round(done/tasks.length*100):0; }
function dayComplete(d){ const required=d.tasks.filter(t=>!t.id.startsWith('pause') && !t.optional); return required.length>0 && required.every(t=>state.profile.roadmap.completedTasks[t.id]); }
function findPause(iso){ return state.profile.roadmap.pauseBlocks.find(p=>iso>=p.start && iso<=p.end); } function findBonus(iso){ return state.profile.roadmap.bonusSessions.find(b=>b.date===iso); }
function weekColor(i){ const colors=['#7c4dff','#00c2ff','#18c29c','#ffd166','#ff7ad9','#ff5c8a','#8fd3ff','#a78bfa','#fb923c','#34d399','#60a5fa','#f472b6']; return colors[(i-1)%colors.length]; }

function renderPractice(){ const total=state.profile.stats.qaeQuestions||0, correct=state.profile.stats.qaeCorrect||0, acc=qaeAccuracy();
  const missCount=(state.profile.missedQuestions||[]).filter(m=>!m.reviewed).length;
  const bankCount=(state.library.cards||[]).length;
  return `<div class="grid">
    <div class="panel" data-tour="qae-summary"><div class="section-head"><div><p class="eyebrow">Practice Log</p><h3>QAE Summary</h3><p class="helper">Use ISACA QAE for official practice. ControlQuest tracks your results, imports your review paste, and turns misses into study work.</p></div><button class="secondary-button small" data-url="${RESOURCE_LINKS.qae}">Open ISACA QAE</button></div>
      <div class="practice-summary"><div class="soft"><span class="app-icon qae">${svgIcon('qae')}</span><h3>${total}</h3><p class="helper">Total Questions Logged</p></div><div class="soft"><div class="donut" style="--pct:${acc}%"><span>${acc}%</span></div><p class="helper">Accuracy</p></div><div class="soft"><span class="app-icon target">${svgIcon('target')}</span><h3>${missCount}</h3><p class="helper">Missed Concepts To Review</p></div><div class="soft"><span class="app-icon cards">${svgIcon('cards')}</span><h3>${bankCount}</h3><p class="helper">Imported Review Items</p></div></div>
    </div>
    <div class="panel span-12"><div class="section-head"><div><p class="eyebrow">QAE Paste Importer</p><h3>Paste Your ISACA Review Dump</h3><p class="helper">Paste the QAE review text after a session. The deterministic parser reads question number, choices, correct answer, your answer, result, domain, knowledge statement, task statement, time, and difficulty. This is for your private/Guild review workflow; do not publish proprietary QAE text publicly.</p></div></div>
      <div class="form-grid"><label><span class="label-title">Import Scope</span><select id="qaeImportScope"><option value="Guild" ${state.profile.activeGroupId?'selected':''}>Guild Shared Library</option><option value="Personal" ${!state.profile.activeGroupId?'selected':''}>Personal Library</option><option value="Public">Public Library (Original Content Only)</option></select></label><label><span class="label-title">Session Label</span><input id="qaeImportLabel" placeholder="Morning QAE With Ty, Domain 1 Audit Project Management"></label><label><span class="label-title">Upload Text File Optional</span><input id="qaeImportFile" type="file" accept=".txt,.md,.docx,text/plain,application/vnd.openxmlformats-officedocument.wordprocessingml.document"></label></div>
      <textarea id="qaeImportText" style="min-height:260px" placeholder="Paste the full QAE review output here, including Question, A-D choices, correct answer, justification, Domain, Knowledge Statement, Task Statement, and your result..."></textarea>
      <div class="button-row"><button class="primary-button" id="parseQaePaste">Parse And Import QAE Paste</button><button class="secondary-button" id="previewQaePaste">Preview Parse Count</button><button class="ghost-button" id="clearQaePaste">Clear Paste Box</button></div>
      <p class="helper">Word, text, and Markdown files are supported. Every valid question is automatically added to a lesson deck, the scope’s Master QAE Question Bank, and the Master Missed Questions deck when answered incorrectly.</p>
    </div>
    <div class="panel"><h3>Log A QAE Practice Block Manually</h3><p class="helper">Use this when you only want to log score totals instead of importing the full review paste.</p><div class="form-grid"><label><span class="label-title">Domain</span><select id="qaeDomain">${ISACA_STUDY_PLAN.filter(d=>d.id!=='practice').map(d=>`<option value="${d.id}">${d.domain}: ${d.name}</option>`).join('')}</select></label><label><span class="label-title">Topic</span><select id="qaeTopic"></select></label><label><span class="label-title">Questions</span><input id="qaeTotal" type="number" min="1" max="150" value="10"></label><label><span class="label-title">Correct</span><input id="qaeCorrect" type="number" min="0" max="150" value="0"></label></div><label><span class="label-title">Notes</span><textarea id="qaeNotes" placeholder="Score context, domain focus, traps, or what you want to review later..."></textarea></label><button class="primary-button" id="addQae">Save QAE Log</button></div>
    <div class="panel"><div class="section-head"><div><p class="eyebrow">Missed Question Bank</p><h3>Capture Missed Concepts</h3><p class="helper">Misses imported from QAE paste appear here automatically. You can also add your own manually.</p></div></div>${missedQuestionForm()}<div class="log-table">${(state.profile.missedQuestions||[]).length?state.profile.missedQuestions.map(missedQuestionRow).join(''):'<div class="empty">No missed concepts captured yet.</div>'}</div></div>
    <div class="panel"><div class="section-head"><div><p class="eyebrow">Imported Question Bank</p><h3>Recent Imported Review Items</h3><p class="helper">Shows recent imported QAE review items for private study tracking. Use full question text only in private/Guild scope.</p></div></div><div class="log-table">${questionBankRows()}</div></div>
    <div class="panel"><div class="section-head"><div><p class="eyebrow">QAE Trend</p><h3>Accuracy Over Time</h3></div></div><svg class="trend" id="qaeTrend" viewBox="0 0 600 160" preserveAspectRatio="none">${trendSvg()}</svg></div>
    <div class="panel"><h3>QAE Logs</h3><div class="log-table">${state.profile.qaeLogs.length?state.profile.qaeLogs.map(qaeLogRow).join(''):'<div class="empty">No QAE logs yet.</div>'}</div></div>
  </div>`; }
function bindPractice(){ const d=$('#qaeDomain'); if(d){d.onchange=fillTopicSelect;fillTopicSelect();} $('#addQae')?.addEventListener('click',addQaeLog); $('#addMissedQuestion')?.addEventListener('click',addMissedQuestion); $('#parseQaePaste')?.addEventListener('click',()=>importQaePaste(false)); $('#previewQaePaste')?.addEventListener('click',()=>importQaePaste(true)); $('#clearQaePaste')?.addEventListener('click',()=>{$('#qaeImportText').value='';}); $('#qaeImportFile')?.addEventListener('change',readQaeTextFile); $$('[data-edit-qae]').forEach(b=>b.onclick=()=>editQae(b.dataset.editQae)); $$('[data-delete-qae]').forEach(b=>b.onclick=()=>deleteQae(b.dataset.deleteQae)); $$('[data-review-missed]').forEach(b=>b.onclick=()=>reviewMissed(b.dataset.reviewMissed)); $$('[data-edit-missed]').forEach(b=>b.onclick=()=>editMissed(b.dataset.editMissed)); $$('[data-delete-missed]').forEach(b=>b.onclick=()=>deleteMissed(b.dataset.deleteMissed)); $$('[data-card-missed]').forEach(b=>b.onclick=()=>addMissedToDeck(b.dataset.cardMissed)); $$('[data-open-card-deck]').forEach(b=>b.onclick=()=>{state.selectedDeckId=b.dataset.openCardDeck;state.toolsTab='review';state.activeView='tools';renderApp();}); }
function missedQuestionForm(){ return `<div class="soft"><div class="form-grid"><label><span class="label-title">Domain</span><select id="missDomain">${DOMAIN_TOPICS.map(d=>`<option>${d.domain}: ${d.name}</option>`).join('')}</select></label><label><span class="label-title">Topic</span><input id="missTopic" placeholder="Topic Or Concept"></label></div><textarea id="missSummary" placeholder="Short summary in your own words: what was the concept, trap, or CISA logic?"></textarea><textarea id="missRule" placeholder="Reusable CISA rule / flashcard answer..."></textarea><button class="primary-button small" id="addMissedQuestion">Add Missed Concept</button></div>`; }
function addMissedQuestion(){ const topic=$('#missTopic').value.trim(); const summary=$('#missSummary').value.trim(); if(!topic || !summary) return toast('Add a topic and short summary.','error'); state.profile.missedQuestions.unshift({id:crypto.randomUUID(),date:todayIso(),domain:$('#missDomain').value,topic,summary,rule:$('#missRule').value.trim(),reviewed:false,createdAt:new Date().toISOString()}); award({xp:12,coins:5,reason:'Missed Concept Captured',type:'Missed Question'}); saveProfileDebounced(); renderApp(); }
function missedQuestionRow(m){ return `<div class="log-row"><div><strong>${esc(m.topic)}</strong><p class="helper">${esc(m.domain)} · ${m.reviewed?'Reviewed':'Needs Review'} · ${fmtDate(m.date)}</p><p>${esc(m.summary||'')}</p>${m.rule?`<p class="helper"><strong>Rule:</strong> ${esc(m.rule)}</p>`:''}</div><div class="button-row"><button class="secondary-button small" data-review-missed="${m.id}">${m.reviewed?'Unreview':'Mark Reviewed'}</button><button class="secondary-button small" data-card-missed="${m.id}">Add To Flashcards</button><button class="secondary-button small" data-edit-missed="${m.id}">Edit</button><button class="danger-button small" data-delete-missed="${m.id}">Delete</button></div></div>`; }
function reviewMissed(id){ const m=state.profile.missedQuestions.find(x=>x.id===id); if(!m)return; m.reviewed=!m.reviewed; if(m.reviewed) award({xp:8,coins:3,reason:'Missed Concept Reviewed',type:'Missed Question'}); saveProfileDebounced(); renderApp(); }
function editMissed(id){ const m=state.profile.missedQuestions.find(x=>x.id===id); if(!m)return; modal('Edit Missed Concept',`<input id="editMissTopic" value="${escAttr(m.topic)}"><textarea id="editMissSummary">${esc(m.summary||'')}</textarea><textarea id="editMissRule">${esc(m.rule||'')}</textarea>`,()=>{m.topic=$('#editMissTopic').value.trim();m.summary=$('#editMissSummary').value.trim();m.rule=$('#editMissRule').value.trim();m.updatedAt=new Date().toISOString();saveProfileDebounced();renderApp();},'Save Changes'); }
function deleteMissed(id){ confirmModal('Delete Missed Concept','Delete this missed concept from your review bank?',()=>{state.profile.missedQuestions=state.profile.missedQuestions.filter(x=>x.id!==id);saveProfileDebounced();renderApp();}); }
function importMissedLines(){ const text=$('#missImport').value.trim(); if(!text)return toast('Paste lines to import first.','error'); const lines=text.split(/\n+/).map(x=>x.trim()).filter(Boolean).slice(0,80); for(const line of lines){ const parts=line.split('|').map(x=>x.trim()); state.profile.missedQuestions.unshift({id:crypto.randomUUID(),date:todayIso(),domain:parts[0]||'Unassigned Domain',topic:parts[1]||'Imported Missed Concept',summary:parts[2]||line,rule:(parts[3]||'').replace(/^Rule:\s*/i,''),reviewed:false,createdAt:new Date().toISOString(),source:'Import'}); } award({xp:Math.min(80,lines.length*4),coins:Math.min(30,lines.length*2),reason:`Imported ${lines.length} Missed Concepts`,type:'Import'}); saveProfileDebounced(); renderApp(); }
function questionBankRows(){
  const list=[...(state.library.cards||[])].sort((a,b)=>String(b.importedAt||'').localeCompare(String(a.importedAt||''))).slice(0,12);
  if(!list.length) return '<div class="empty">No imported QAE review items yet. Paste a QAE review dump above to build your adaptive study library.</div>';
  return list.map(q=>`<div class="log-row"><div><strong>${esc(q.knowledgeStatement || q.sessionTitle || q.domain || 'Imported QAE Item')}</strong><p class="helper">${esc(q.scope||'Personal')} · ${esc(q.domain || 'Unassigned Domain')} · Question ${q.questionNumber || '?'} · Correct ${q.correctAnswer || '?'}${q.userAnswerAtImport?` · Imported Answer ${q.userAnswerAtImport}`:''}</p><p>${esc((q.question||'').slice(0,220))}${(q.question||'').length>220?'...':''}</p></div><div class="button-row"><button class="secondary-button small" data-open-card-deck="${q.deckIds?.[0]||''}">Study Deck</button></div></div>`).join('');
}
function readQaeTextFile(){
  const file=$('#qaeImportFile')?.files?.[0]; if(!file) return;
  const applyText=text=>{ $('#qaeImportText').value=String(text||''); toast(`Loaded ${file.name}.`); };
  if(file.name.toLowerCase().endsWith('.docx')){
    if(!window.mammoth) return toast('The Word import helper did not load. Paste the text directly or refresh and try again.','error');
    const reader=new FileReader();
    reader.onload=async()=>{ try{ const result=await window.mammoth.extractRawText({arrayBuffer:reader.result}); applyText(result.value); }catch(error){toast(`Could not read Word file: ${friendly(error)}`,'error');} };
    reader.onerror=()=>toast('Could not read that Word file.','error');
    reader.readAsArrayBuffer(file);
  }else{
    const reader=new FileReader();
    reader.onload=()=>applyText(reader.result);
    reader.onerror=()=>toast('Could not read that file. Try copying and pasting the text instead.','error');
    reader.readAsText(file);
  }
}
async function importQaePaste(previewOnly=false){
  const text=$('#qaeImportText')?.value || '';
  const label=$('#qaeImportLabel')?.value?.trim() || 'Imported QAE Session';
  const scope=$('#qaeImportScope')?.value || (state.profile.activeGroupId?'Guild':'Personal');
  if(scope==='Guild'&&!state.profile.activeGroupId) return toast('Join or create a Guild before importing into Guild scope.','error');
  if(scope==='Public') return toast('Full ISACA QAE question imports cannot be published publicly. Choose Guild or Personal. Public decks are reserved for original study content.','error');
  const parsed=parseQaePaste(text);
  const questions=parsed.questions || [];
  if(!questions.length) return toast(`No QAE questions were parsed. ${parsed.warnings?.[0]||''}`,'error');
  const bundle=buildImportBundle({questions,title:label,scope,uid:state.user.uid,groupId:state.profile.activeGroupId,importedBy:state.profile.displayName});
  const existingKeys=new Set((state.library.cards||[]).map(card=>`${card.scopeKey}:${card.id}`));
  const uniqueNew=bundle.cards.filter(card=>!existingKeys.has(`${card.scopeKey}:${card.id}`));
  const duplicates=bundle.cards.length-uniqueNew.length;
  const correct=questions.filter(q=>q.isCorrect===true).length;
  const missed=questions.filter(q=>q.isCorrect===false);
  const domains=[...new Set(questions.map(q=>q.domain).filter(Boolean))].join(', ') || 'Imported QAE';
  if(previewOnly){
    modal('QAE Import Preview',`<div class="practice-summary"><div class="soft"><h3>${questions.length}</h3><p class="helper">Questions Parsed</p></div><div class="soft"><h3>${uniqueNew.length}</h3><p class="helper">New Unique Questions</p></div><div class="soft"><h3>${duplicates}</h3><p class="helper">Duplicates Skipped In Master Bank</p></div><div class="soft"><h3>${missed.length}</h3><p class="helper">Added To Missed Deck</p></div></div><div class="soft"><strong>Automatic Outputs</strong><p class="helper">1. Lesson Deck: ${esc(label)}<br>2. Master QAE Question Bank<br>3. Master Missed Questions<br>4. Multiple-Choice Quiz Bank<br>5. Individual Adaptive Review Progress</p>${parsed.warnings?.length?`<p class="helper danger-text">${esc(parsed.warnings.join(' '))}</p>`:''}</div>`,()=>{},'Close');
    return;
  }
  const duplicateSession=(state.profile.qaeImports||[]).some(item=>item.sessionFingerprint===bundle.sessionFingerprint&&item.scope===scope);
  await confirmModal('Build Complete Study Package',`Import ${questions.length} questions into ${scope} scope? ControlQuest will build the lesson deck, deduplicate into the Master QAE Question Bank, add misses to the Master Missed Questions deck, and make every item available for flashcards and multiple-choice review. ${duplicates?`${duplicates} existing master questions will be linked without being duplicated.`:''}`, async()=>{
    await saveStudyImport({uid:state.user.uid,groupId:state.profile.activeGroupId,decks:bundle.decks,cards:bundle.cards});
    state.library=mergeUniqueLibrary(state.library,bundle);
    if(scope==='Guild'&&state.group){state.group.studyLibraryUpdatedAt=new Date().toISOString();await saveGroup(state.group);}
    const importedAt=new Date().toISOString();
    const importId=crypto.randomUUID();
    if(!duplicateSession){
      const misses=questions.filter(q=>q.isCorrect===false).map(missedConceptFromParsedQuestion);
      state.profile.missedQuestions.unshift(...misses);
      state.profile.qaeLogs.unshift({id:crypto.randomUUID(),date:todayIso(),domain:domains,domainId:'imported',topic:label,total:questions.length,correct,notes:`Imported QAE study package. ${bundle.incorrect} questions added to the missed deck.`,createdAt:importedAt,source:'QAE Study Package Import'});
      state.profile.stats.qaeQuestions=(state.profile.stats.qaeQuestions||0)+questions.length;
      state.profile.stats.qaeCorrect=(state.profile.stats.qaeCorrect||0)+correct;
    }
    state.profile.qaeImports.unshift({id:importId,label,scope,date:todayIso(),createdAt:importedAt,total:questions.length,correct,missed:missed.length,domains,warnings:parsed.warnings||[],sessionFingerprint:bundle.sessionFingerprint,lessonDeckId:bundle.lessonDeckId,duplicateSession});
    award({xp:duplicateSession?10:Math.min(200,30+questions.length*2+missed.length*3),coins:duplicateSession?3:Math.min(90,12+questions.length+missed.length*2),reason:duplicateSession?`Re-linked Existing QAE Session: ${label}`:`Built QAE Study Package: ${label}`,type:'QAE Import'});
    await saveProfileDebounced(true);
    $('#qaeImportText').value='';
    state.selectedDeckId=bundle.lessonDeckId;
    showCelebration('Study Package Ready',`${questions.length} questions are ready in Flashcards, Quiz Mode, Smart Review, and your Master Banks.`,()=>{state.activeView='tools';state.toolsTab='library';renderApp();},'Open Study Package');
    renderApp();
  });
}

function addMissedToDeck(id){
  const miss=state.profile.missedQuestions.find(x=>x.id===id); if(!miss)return;
  const decks=(state.library.decks||[]).filter(d=>d.scope!=='Public');
  const opts=decks.map(d=>`<option value="${d.scopeKey}|${d.id}">${esc(d.title)} (${d.scope})</option>`).join('');
  modal('Add Missed Concept To Deck',`<label><span class="label-title">Deck</span><select id="targetDeck">${opts}</select></label><p class="helper">This creates an original concept card from your summary. Imported QAE questions are already added automatically.</p>`,async()=>{
    const [key,deckId]=$('#targetDeck').value.split('|'); const deck=decks.find(d=>d.scopeKey===key&&d.id===deckId); if(!deck)return;
    const fp=cardFingerprint(miss.topic||miss.summary,{});
    const card={id:`card_${fp}`,fingerprint:fp,scope:deck.scope,scopeKey:deck.scopeKey,deckIds:[deck.id],source:'Missed Concept',question:miss.topic||miss.summary,choices:{},correctAnswer:'',justifications:{_:miss.rule||miss.summary},domain:miss.domain||'',knowledgeStatement:miss.topic||'',tags:[miss.domain,miss.topic].filter(Boolean),ownerUid:state.user.uid,importedAt:new Date().toISOString(),updatedAt:new Date().toISOString()};
    await saveStudyCard({uid:state.user.uid,groupId:state.profile.activeGroupId,card});
    state.library=mergeUniqueLibrary(state.library,{cards:[card],decks:[]});
    award({xp:6,coins:2,reason:'Missed Concept Added To Study Library',type:'Flashcards'}); await saveProfileDebounced(true); renderApp();
  },'Add Card');
}

function fillTopicSelect(){ const d=ISACA_STUDY_PLAN.find(x=>x.id===$('#qaeDomain').value) || DOMAIN_TOPICS.find(x=>x.id===$('#qaeDomain').value); $('#qaeTopic').innerHTML=(d?.topics||[]).map(t=>`<option>${escAttr(t.title || t)}</option>`).join(''); }
function addQaeLog(){ const total=Number($('#qaeTotal').value), correct=Number($('#qaeCorrect').value); if(!total||total<1||total>150)return toast('Questions must be between 1 and 150.','error'); if(correct<0||correct>total)return toast('Correct answers cannot exceed total questions.','error'); const d=DOMAIN_TOPICS.find(x=>x.id===$('#qaeDomain').value); const log={id:crypto.randomUUID(),date:todayIso(),domain:d?.name||'',domainId:d?.id||'',topic:$('#qaeTopic').value,total,correct,notes:$('#qaeNotes').value.trim(),createdAt:new Date().toISOString()}; state.profile.qaeLogs.unshift(log); state.profile.stats.qaeQuestions=(state.profile.stats.qaeQuestions||0)+total; state.profile.stats.qaeCorrect=(state.profile.stats.qaeCorrect||0)+correct; const acc=correct/total; award({xp:Math.round(20+total*1.2+acc*20),coins:Math.round(8+total*.45+acc*8),reason:`QAE Log: ${correct}/${total}`,type:'QAE'}); saveProfileDebounced(); renderApp(); }
function qaeLogRow(l){ const acc=Math.round(l.correct/l.total*100); return `<div class="log-row"><div><strong>${esc(l.domain)}</strong><p class="helper">${fmtDate(l.date)} · ${esc(l.topic)} · ${l.correct}/${l.total} (${acc}%)</p><p>${esc(l.notes||'')}</p></div><div class="button-row"><button class="secondary-button small" data-edit-qae="${l.id}">Edit</button><button class="danger-button small" data-delete-qae="${l.id}">Delete</button></div></div>`; }
function editQae(id){ const l=state.profile.qaeLogs.find(x=>x.id===id); if(!l)return; modal('Edit QAE Log',`<div class="form-grid"><input id="editQaeTotal" type="number" min="1" max="150" value="${l.total}"><input id="editQaeCorrect" type="number" min="0" max="150" value="${l.correct}"></div><textarea id="editQaeNotes">${esc(l.notes||'')}</textarea>`,()=>{const t=Number($('#editQaeTotal').value),c=Number($('#editQaeCorrect').value); if(!t||c<0||c>t)return toast('Invalid QAE values.','error'); recalcQaeStats(-l.total,-l.correct); l.total=t;l.correct=c;l.notes=$('#editQaeNotes').value.trim();recalcQaeStats(t,c);saveProfileDebounced();renderApp();},'Save Changes'); }
function deleteQae(id){ const l=state.profile.qaeLogs.find(x=>x.id===id); if(!l)return; confirmModal('Delete QAE Log','Delete this QAE log and remove it from totals?',()=>{state.profile.qaeLogs=state.profile.qaeLogs.filter(x=>x.id!==id);recalcQaeStats(-l.total,-l.correct);saveProfileDebounced();renderApp();}); }
function recalcQaeStats(t,c){ state.profile.stats.qaeQuestions=Math.max(0,(state.profile.stats.qaeQuestions||0)+t); state.profile.stats.qaeCorrect=Math.max(0,(state.profile.stats.qaeCorrect||0)+c); }
function trendSvg(){ const logs=[...state.profile.qaeLogs].reverse().slice(-20); if(!logs.length)return `<text x="300" y="84" text-anchor="middle" fill="currentColor">No QAE Logs Yet</text>`; const pts=logs.map((l,i)=>[i/(logs.length-1||1)*560+20,140-(l.correct/l.total)*110]); const poly=pts.map(p=>p.join(',')).join(' '); return `<polyline points="${poly}" fill="none" stroke="url(#g)" stroke-width="5"/><defs><linearGradient id="g"><stop stop-color="#7c4dff"/><stop offset="1" stop-color="#00c2ff"/></linearGradient></defs>${pts.map(p=>`<circle cx="${p[0]}" cy="${p[1]}" r="5" fill="#00c2ff"/>`).join('')}`; }
function mistakeForm(){return `<div class="soft"><div class="form-grid"><input id="mistakeTopic" placeholder="Topic / Rule"><select id="mistakeDomain">${DOMAIN_TOPICS.map(d=>`<option>${d.domain}: ${d.name}</option>`).join('')}</select></div><textarea id="mistakeWhy" placeholder="What did you pick, why was it wrong, and what is the reusable CISA logic?"></textarea><button class="primary-button small" id="addMistake">Add Mistake Rule</button></div>`;}
function addMistake(){ const topic=$('#mistakeTopic').value.trim(); if(!topic)return toast('Add a mistake topic.','error'); state.profile.mistakes.unshift({id:crypto.randomUUID(),date:todayIso(),topic,domain:$('#mistakeDomain').value,why:$('#mistakeWhy').value.trim(),reviewed:false}); award({xp:12,coins:5,reason:'Mistake Rule Added',type:'Mistake'}); saveProfileDebounced(); renderApp(); }
function mistakeRow(m){return `<div class="log-row"><div><strong>${esc(m.topic)}</strong><p class="helper">${esc(m.domain)} · ${m.reviewed?'Reviewed':'Needs Review'}</p><p>${esc(m.why||'')}</p></div><div class="button-row"><button class="secondary-button small" data-review-mistake="${m.id}">${m.reviewed?'Unreview':'Reviewed'}</button><button class="secondary-button small" data-edit-mistake="${m.id}">Edit</button><button class="danger-button small" data-delete-mistake="${m.id}">Delete</button></div></div>`;}
function reviewMistake(id){ const m=state.profile.mistakes.find(x=>x.id===id); if(!m)return; m.reviewed=!m.reviewed; if(m.reviewed)award({xp:8,coins:3,reason:'Mistake Reviewed',type:'Mistake'}); saveProfileDebounced(); renderApp(); }
function editMistake(id){ const m=state.profile.mistakes.find(x=>x.id===id); if(!m)return; modal('Edit Mistake Rule',`<input id="editMistakeTopic" value="${escAttr(m.topic)}"><textarea id="editMistakeWhy">${esc(m.why||'')}</textarea>`,()=>{m.topic=$('#editMistakeTopic').value.trim();m.why=$('#editMistakeWhy').value.trim();saveProfileDebounced();renderApp();},'Save Changes'); }
function deleteMistake(id){ confirmModal('Delete Mistake','Delete this mistake review item?',()=>{state.profile.mistakes=state.profile.mistakes.filter(x=>x.id!==id);saveProfileDebounced();renderApp();}); }

function libraryDecks(){
  return [...(state.library.decks||[])].sort((a,b)=>{
    const order={master:0,missed:1,lesson:2,custom:3};
    return (order[a.kind]??9)-(order[b.kind]??9) || String(b.updatedAt||'').localeCompare(String(a.updatedAt||''));
  });
}
function libraryCardsForDeck(deck){ return (state.library.cards||[]).filter(c=>c.scopeKey===deck.scopeKey&&(c.deckIds||[]).includes(deck.id)); }
function libraryCardKey(card){ return `${card.scopeKey}|${card.id}`; }
function libraryCardFromKey(key){ const [scopeKeyValue,id]=String(key||'').split('|'); return (state.library.cards||[]).find(c=>c.scopeKey===scopeKeyValue&&c.id===id); }
function selectedLibraryDeck(){ return libraryDecks().find(d=>d.id===state.selectedDeckId) || libraryDecks()[0] || null; }
function currentStudyCard(){ const key=state.studySession?.queue?.[state.studySession.index||0]; return libraryCardFromKey(key); }
function currentDeckStats(deck){ const settings=state.profile?.preferences?.studySettings||DEFAULT_REVIEW_SETTINGS; return deck?calculateLibraryStats(state.library.cards,state.library.progress,state.library.reviews,deck.id,settings):calculateLibraryStats(state.library.cards,state.library.progress,state.library.reviews,null,settings); }
function newCardsIntroducedToday(){ const iso=localDateForProfileSafe(state.profile); return (state.library.reviews||[]).filter(r=>r.wasNew&&formatIsoInTimezone(r.reviewedAt,state.profile.timezone)===iso).length; }
function formatIsoInTimezone(value,timezone){ try{return new Intl.DateTimeFormat('en-CA',{timeZone:timezone||state.profile?.timezone||'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(value));}catch{return String(value||'').slice(0,10);} }
function scopeBadge(scope){ return `<span class="bubble ${scope==='Guild'?'good':scope==='Public'?'warn':''}">${esc(scope||'Personal')}</span>`; }

function renderTools(){
  const allStats=calculateLibraryStats(state.library.cards,state.library.progress,state.library.reviews,null,state.profile.preferences.studySettings||DEFAULT_REVIEW_SETTINGS);
  const tabs=[['library','Deck Library'],['review','Smart Review'],['flashcards','Flashcards'],['quiz','Quiz Mode'],['guild-study','Guild Study'],['games','Games'],['analytics','Analytics']];
  return `<div class="grid">
    <div class="panel span-12" data-tour="memory-decks">
      <div class="section-head"><div><p class="eyebrow">Study Tools</p><h3>ControlQuest Learning Library</h3><p class="helper">Every QAE import becomes a lesson deck, joins the deduplicated Master QAE Question Bank, and sends misses to the Master Missed Questions deck. Your review history is tracked separately for each user.</p></div><div class="button-row"><button class="secondary-button small" id="refreshStudyLibrary">Refresh Guild Library</button><button class="primary-button small" id="newDeckBtn">Create Original Deck</button></div></div>
      <div class="practice-summary compact-summary"><div class="soft"><h3>${allStats.total}</h3><p class="helper">Unique Questions</p></div><div class="soft"><h3>${allStats.due}</h3><p class="helper">Due Now</p></div><div class="soft"><h3>${allStats.mastered}</h3><p class="helper">Mastered</p></div><div class="soft"><h3>${allStats.accuracy}%</h3><p class="helper">Review Accuracy</p></div></div>
      <div class="tool-tabs">${tabs.map(([id,label])=>`<button class="${state.toolsTab===id?'active':''}" data-tools-tab="${id}">${label}</button>`).join('')}</div>
    </div>
    <div class="panel span-12">${renderToolsTab()}</div>
  </div>`;
}
function renderToolsTab(){
  if(state.toolsTab==='review') return renderSmartReviewTab();
  if(state.toolsTab==='flashcards') return renderFlashcardsTab();
  if(state.toolsTab==='quiz') return renderQuizTab();
  if(state.toolsTab==='guild-study') return renderGuildStudyTab();
  if(state.toolsTab==='games') return renderStudyGamesTab();
  if(state.toolsTab==='analytics') return renderStudyAnalyticsTab();
  return renderDeckLibraryTab();
}
function renderDeckLibraryTab(){
  const scopes=['All','Guild','Personal','Public'];
  const decks=libraryDecks().filter(d=>state.libraryScopeFilter==='All'||d.scope===state.libraryScopeFilter);
  return `<div class="section-head"><div><p class="eyebrow">Deck Library</p><h3>Your Imported And Original Decks</h3><p class="helper">Imported QAE decks contain the original multiple-choice question, all answer choices, the correct answer, and every available justification.</p></div><select id="libraryScopeFilter">${scopes.map(s=>`<option ${state.libraryScopeFilter===s?'selected':''}>${s}</option>`).join('')}</select></div>
    ${decks.length?`<div class="deck-grid advanced-decks">${decks.map(renderLibraryDeckCard).join('')}</div>`:`<div class="empty"><h3>No Study Decks Yet</h3><p>Open Practice Log and import your first QAE review dump. ControlQuest will build everything automatically.</p><button class="primary-button" data-go="practice">Open QAE Importer</button></div>`}`;
}
function renderLibraryDeckCard(deck){
  const stats=currentDeckStats(deck); const cards=libraryCardsForDeck(deck);
  return `<div class="deck-card advanced ${state.selectedDeckId===deck.id?'selected':''}">
    <div class="section-head"><span class="app-icon cards">${svgIcon('cards')}</span>${scopeBadge(deck.scope)}</div>
    <h4>${esc(deck.title)}</h4><p class="helper">${esc(deck.description||'')}</p>
    <div class="deck-stat-grid"><span><strong>${cards.length}</strong><small>Cards</small></span><span><strong>${stats.due}</strong><small>Due</small></span><span><strong>${stats.mastered}</strong><small>Mastered</small></span><span><strong>${stats.accuracy}%</strong><small>Accuracy</small></span></div>
    <div class="button-row wrap"><button class="primary-button small" data-open-deck="${deck.id}" data-open-mode="review">Smart Review</button><button class="secondary-button small" data-open-deck="${deck.id}" data-open-mode="quiz">Quiz</button><button class="secondary-button small" data-open-deck="${deck.id}" data-open-mode="flashcards">Flashcards</button><button class="ghost-button small" data-add-card="${deck.id}">Add Card</button><button class="ghost-button small" data-export-library-deck="${deck.id}">Export</button>${!['master','missed'].includes(deck.kind)?`<button class="ghost-button small" data-edit-library-deck="${deck.id}">Edit</button><button class="danger-button small" data-delete-library-deck="${deck.id}">Delete</button>`:''}</div>
  </div>`;
}
function renderSmartReviewTab(){
  const deck=selectedLibraryDeck(); if(!deck)return renderNoDeckCta(); const cards=libraryCardsForDeck(deck); const stats=currentDeckStats(deck);
  const settings=state.profile.preferences.studySettings||DEFAULT_REVIEW_SETTINGS; const introduced=newCardsIntroducedToday(); const newRemaining=Math.max(0,(settings.newCardsPerDay||20)-introduced);
  return `<div class="section-head"><div><p class="eyebrow">Adaptive Review</p><h3>${esc(deck.title)}</h3><p class="helper">Due and difficult cards are prioritized. Rate recall with Again, Hard, Good, or Easy so each question receives an individual next-review date.</p></div>${deckPicker('review')}</div>
    <div class="practice-summary"><div class="soft"><h3>${stats.due}</h3><p class="helper">Due Now</p></div><div class="soft"><h3>${newRemaining}</h3><p class="helper">New Cards Remaining Today</p></div><div class="soft"><h3>${stats.learning}</h3><p class="helper">Learning</p></div><div class="soft"><h3>${stats.mastered}</h3><p class="helper">Mastered</p></div><div class="soft"><h3>${stats.leeches||0}</h3><p class="helper">High-Lapse Cards</p></div></div>
    ${state.studySession?.mode==='review'?renderStudyRunner():`<div class="grid three"><button class="study-mode-card" data-start-study="due"><span class="app-icon target">${svgIcon('target')}</span><strong>Study Due Cards</strong><small>Prioritizes overdue, lapsed, and imported misses.</small></button><button class="study-mode-card" data-start-study="missed"><span class="app-icon qae">${svgIcon('qae')}</span><strong>Missed Questions Only</strong><small>Targets import misses and cards failed during review.</small></button><button class="study-mode-card" data-start-study="new"><span class="app-icon cards">${svgIcon('cards')}</span><strong>Learn New Cards</strong><small>Introduces unseen questions up to your daily limit.</small></button></div>`}`;
}
function renderFlashcardsTab(){
  const deck=selectedLibraryDeck(); if(!deck)return renderNoDeckCta();
  return `<div class="section-head"><div><p class="eyebrow">Flashcards</p><h3>${esc(deck.title)}</h3><p class="helper">Flip the card, read the correct answer and explanation, then honestly rate how well you recalled it. Ratings drive the adaptive schedule.</p></div>${deckPicker('flashcards')}</div>${state.studySession?.mode==='flashcards'?renderStudyRunner():`<div class="empty"><button class="primary-button" data-start-flashcards>Start Flashcard Session</button></div>`}`;
}
function renderQuizTab(){
  const deck=selectedLibraryDeck(); if(!deck)return renderNoDeckCta(); const eligible=libraryCardsForDeck(deck).filter(c=>c.correctAnswer&&Object.keys(c.choices||{}).length>=2).length;
  return `<div class="section-head"><div><p class="eyebrow">Multiple-Choice Quiz</p><h3>${esc(deck.title)}</h3><p class="helper">Retake the imported question exactly as a multiple-choice review. After answering, ControlQuest reveals the correct choice and the justification for every option.</p></div>${deckPicker('quiz')}</div><div class="soft"><strong>${eligible} Multiple-Choice Questions Available</strong><p class="helper">Choose a targeted mode or take the full lesson again.</p></div>${state.studySession?.mode==='quiz'?renderStudyRunner():`<div class="grid three"><button class="study-mode-card" data-start-quiz="missed"><span class="app-icon qae">${svgIcon('qae')}</span><strong>Retake Missed Questions</strong><small>Focuses on incorrect imports and later lapses.</small></button><button class="study-mode-card" data-start-quiz="due"><span class="app-icon target">${svgIcon('target')}</span><strong>Due Quiz</strong><small>Uses the adaptive review queue.</small></button><button class="study-mode-card" data-start-quiz="all"><span class="app-icon cards">${svgIcon('cards')}</span><strong>Full Lesson Quiz</strong><small>Shuffles all multiple-choice questions in this deck.</small></button></div>`}`;
}
function renderNoDeckCta(){ return `<div class="empty"><h3>No Deck Selected</h3><p>Import a QAE session or choose a deck from Deck Library.</p><div class="button-row"><button class="primary-button" data-tools-tab="library">Open Deck Library</button><button class="secondary-button" data-go="practice">Import QAE Session</button></div></div>`; }
function deckPicker(mode){ const decks=libraryDecks(); return `<label class="compact-picker"><span class="label-title">Deck</span><select data-deck-picker="${mode}">${decks.map(d=>`<option value="${d.id}" ${d.id===selectedLibraryDeck()?.id?'selected':''}>${esc(d.title)} · ${esc(d.scope)}</option>`).join('')}</select></label>`; }

function startStudySession(mode, queueMode='due'){
  const deck=selectedLibraryDeck(); if(!deck)return toast('Choose a deck first.','error');
  let cards=libraryCardsForDeck(deck);
  if(mode==='quiz') cards=cards.filter(c=>c.correctAnswer&&Object.keys(c.choices||{}).length>=2);
  const settings=state.profile.preferences.studySettings||DEFAULT_REVIEW_SETTINGS;
  const remainingNew=Math.max(0,(settings.newCardsPerDay||20)-newCardsIntroducedToday());
  if(queueMode==='new'&&remainingNew<=0)return toast('You have reached today’s New Cards limit. Change it in Profile or continue with Due/Missed review.','error');
  const dailyLimit=queueMode==='new'?remainingNew:(settings.maxReviewsPerDay||100);
  const limit=mode==='quiz'?Math.min(50,cards.length):Math.min(dailyLimit,cards.length);
  let queue=buildStudyQueue(cards,state.library.progress,{mode:queueMode,limit,newLimit:remainingNew});
  if(!queue.length&&queueMode==='due') queue=buildStudyQueue(cards,state.library.progress,{mode:'all',limit:Math.min(20,limit)});
  if(!queue.length)return toast('No cards are available for this mode.','error');
  state.studySession={id:crypto.randomUUID(),mode,queueMode,deckId:deck.id,deckScopeKey:deck.scopeKey,queue:queue.map(libraryCardKey),index:0,correct:0,incorrect:0,ratings:{Again:0,Hard:0,Good:0,Easy:0},startedAt:new Date().toISOString(),answerSubmitted:false,selectedAnswer:null,revealed:false};
  state.reviewStartedAt=Date.now(); state.deckFlipped=false; state.quizSelection=null; state.quizRevealed=false; renderApp();
}
function renderStudyRunner(){
  const session=state.studySession; const deck=libraryDecks().find(d=>d.id===session.deckId); const card=currentStudyCard();
  if(!card)return renderStudySessionComplete();
  const p=state.library.progress[progressKey(card)]; const mastery=p?`${p.state} · ${p.intervalDays||0} Day Interval`:'New Card'; const progressPct=Math.round(((session.index||0)/Math.max(1,session.queue.length))*100);
  return `<div class="study-runner"><div class="study-runner-head"><div><span class="bubble">${session.index+1} / ${session.queue.length}</span><span class="bubble good">${session.correct} Correct</span><span class="bubble warn">${session.incorrect} Missed</span><span class="bubble">${esc(mastery)}</span></div><button class="ghost-button small" id="endStudySession">End Session</button></div><div class="progress"><span style="width:${progressPct}%"></span></div>${session.mode==='quiz'?renderQuizQuestion(card):renderAdaptiveFlashcard(card)}<div class="study-source"><span>${esc(card.domain||'Imported QAE')}</span><span>${esc(card.knowledgeStatement||card.sessionTitle||'')}</span></div></div>`;
}
function renderAdaptiveFlashcard(card){
  const back=formatCardBack(card); const flipped=state.deckFlipped;
  return `<button class="adaptive-flashcard ${flipped?'is-flipped':''}" id="adaptiveFlashcard"><div class="card-face"><small>${flipped?'Answer And Explanation':'Question'}</small>${flipped?`<h3>${esc(back.answerLine)}</h3><p>${esc(back.explanation)}</p>${renderAllJustifications(card)}`:`<h2>${esc(card.question)}</h2>${renderChoicesReadOnly(card)}`}<span class="flip-hint">${flipped?'Rate your recall below':'Click to reveal answer'}</span></div></button>${flipped?ratingButtons():''}`;
}
function renderQuizQuestion(card){
  const submitted=state.studySession.answerSubmitted; const selected=state.studySession.selectedAnswer; const isCorrect=selected===card.correctAnswer;
  return `<div class="quiz-card"><p class="eyebrow">Choose The Best Answer</p><h2>${esc(card.question)}</h2><div class="quiz-options">${Object.entries(card.choices||{}).map(([letter,text])=>`<button class="quiz-option ${selected===letter?'selected':''} ${submitted&&letter===card.correctAnswer?'correct':''} ${submitted&&selected===letter&&letter!==card.correctAnswer?'incorrect':''}" data-quiz-choice="${letter}" ${submitted?'disabled':''}><strong>${letter}</strong><span>${esc(text)}</span></button>`).join('')}</div>${!submitted?`<button class="primary-button" id="submitQuizAnswer" ${!selected?'disabled':''}>Submit Answer</button>`:`<div class="answer-panel ${isCorrect?'success':'error'}"><h3>${isCorrect?'Correct':'Review This One Again'}</h3><p><strong>Correct Answer: ${card.correctAnswer}. ${esc(card.choices?.[card.correctAnswer]||'')}</strong></p>${renderAllJustifications(card)}</div>${ratingButtons(isCorrect?'Good':'Again')}`}</div>`;
}
function renderChoicesReadOnly(card){ const entries=Object.entries(card.choices||{}); return entries.length?`<div class="read-only-choices">${entries.map(([l,t])=>`<div><strong>${l}</strong><span>${esc(t)}</span></div>`).join('')}</div>`:''; }
function renderAllJustifications(card){ const entries=Object.entries(card.justifications||{}).filter(([k])=>k!=='_'); if(!entries.length)return `<p class="helper">${esc(card.justifications?._||'No detailed justification was included in the import.')}</p>`; return `<details class="justification-details" open><summary>Why Each Option Is Right Or Wrong</summary>${entries.map(([letter,text])=>`<div class="justification-row ${letter===card.correctAnswer?'correct':''}"><strong>${letter}</strong><p>${esc(text)}</p></div>`).join('')}</details>`; }
function ratingButtons(recommended=''){ return `<div class="rating-panel"><p class="helper">How well did you recall this?</p><div class="rating-grid">${[['Again','< 10 Min'],['Hard','Soon'],['Good','Normal'],['Easy','Longer']].map(([rating,hint])=>`<button class="rating-button ${rating.toLowerCase()} ${recommended===rating?'recommended':''}" data-rate-card="${rating}"><strong>${rating}</strong><small>${hint}</small></button>`).join('')}</div></div>`; }
async function applyCardRating(rating){
  const session=state.studySession, card=currentStudyCard(); if(!session||!card)return;
  const key=progressKey(card); const old=state.library.progress[key]||defaultProgress(card,state.user.uid); const next=rateCard(card,old,rating,state.profile.preferences.studySettings||DEFAULT_REVIEW_SETTINGS);
  const correct=rating!=='Again'; const event=createReviewEvent({uid:state.user.uid,card,deckId:session.deckId,mode:session.mode,rating,correct,responseTimeMs:Date.now()-(state.reviewStartedAt||Date.now()),sessionId:session.id,groupId:state.profile.activeGroupId,wasNew:!(old.repetitions||0)});
  state.library.progress[key]=next; state.library.reviews.unshift(event); state.library.reviews=state.library.reviews.slice(0,1000);
  await Promise.all([saveStudyProgress(state.user.uid,next),saveStudyReview(state.user.uid,event)]);
  session.ratings[rating]=(session.ratings[rating]||0)+1; if(correct)session.correct++;else session.incorrect++;
  state.profile.studyHistory.reviews=(state.profile.studyHistory.reviews||0)+1; state.profile.studyHistory.correct=(state.profile.studyHistory.correct||0)+(correct?1:0); state.profile.studyHistory.incorrect=(state.profile.studyHistory.incorrect||0)+(correct?0:1);
  award({xp:correct?4:2,coins:correct?2:1,reason:`Study Review: ${rating}`,type:'Flashcards'});
  session.index++; session.answerSubmitted=false;session.selectedAnswer=null;state.deckFlipped=false;state.quizSelection=null;state.quizRevealed=false;state.reviewStartedAt=Date.now(); await saveProfileDebounced(true); renderApp();
}
function renderStudySessionComplete(){ const s=state.studySession; const total=(s.correct||0)+(s.incorrect||0); const pct=total?Math.round(s.correct/total*100):0; return `<div class="study-complete"><span class="app-icon xp">${svgIcon('xp')}</span><h2>Review Session Complete</h2><div class="practice-summary"><div class="soft"><h3>${total}</h3><p class="helper">Cards Reviewed</p></div><div class="soft"><h3>${pct}%</h3><p class="helper">Recall Accuracy</p></div><div class="soft"><h3>${s.ratings?.Again||0}</h3><p class="helper">Again</p></div><div class="soft"><h3>${s.ratings?.Easy||0}</h3><p class="helper">Easy</p></div></div><button class="primary-button" id="finishStudySession">Return To Deck</button></div>`; }

function renderGuildStudyTab(){
  if(!state.group)return `<div class="empty"><h3>Join A Study Guild First</h3><p>Guild Study synchronizes the same question, member answers, reveal state, and score board across every member’s screen.</p><button class="primary-button" data-go="guild">Open Guild</button></div>`;
  const guildDecks=libraryDecks().filter(d=>d.scope==='Guild'); const gs=state.group.studySession;
  if(!guildDecks.length)return `<div class="empty"><h3>No Guild Decks Yet</h3><p>Import a QAE session with Guild scope. Guild is the default import option.</p><button class="primary-button" data-go="practice">Import Guild QAE Session</button></div>`;
  if(!gs?.active)return `<div class="section-head"><div><p class="eyebrow">Live Guild Review</p><h3>Start A Synchronized Question Session</h3><p class="helper">Every member sees the same question. Each answer is tracked individually, then the group reveals the explanation together.</p></div></div><label><span class="label-title">Guild Deck</span><select id="guildStudyDeck">${guildDecks.map(d=>`<option value="${d.id}">${esc(d.title)}</option>`).join('')}</select></label><div class="button-row"><button class="primary-button" id="startGuildQuiz">Start Guild Quiz</button><button class="secondary-button" id="startGuildMissed">Start Missed-Question Review</button></div>`;
  return renderGuildStudySession(gs);
}
function renderGuildStudySession(gs){
  const card=libraryCardFromKey(gs.cardKeys?.[gs.index||0]); if(!card)return `<div class="empty"><h3>Guild Session Complete</h3><button class="primary-button" id="endGuildStudy">Close Session</button></div>`;
  const response=gs.responses?.[state.user.uid]; const members=Object.values(state.group.members||{}); const scores=gs.scores||{};
  return `<div class="guild-study-live"><div class="section-head"><div><p class="eyebrow">Live Guild Session</p><h3>${esc(gs.title||'Guild Review')}</h3></div><div class="button-row"><span class="bubble">${(gs.index||0)+1} / ${gs.cardKeys.length}</span><button class="danger-button small" id="endGuildStudy">End</button></div></div><h2>${esc(card.question)}</h2><div class="quiz-options">${Object.entries(card.choices||{}).map(([letter,text])=>`<button class="quiz-option ${response?.answer===letter?'selected':''} ${gs.revealed&&letter===card.correctAnswer?'correct':''}" data-guild-answer="${letter}" ${response||gs.revealed?'disabled':''}><strong>${letter}</strong><span>${esc(text)}</span></button>`).join('')}</div><div class="guild-response-grid">${members.map(m=>`<div class="member-response"><strong>${esc(m.name)}</strong><span class="bubble ${gs.responses?.[m.uid]?.correct?'good':gs.responses?.[m.uid]?'warn':''}">${gs.responses?.[m.uid]?`${gs.responses[m.uid].answer} · ${gs.responses[m.uid].correct?'Correct':'Missed'}`:'Thinking...'}</span><small>${scores[m.uid]||0} Points</small></div>`).join('')}</div>${gs.revealed?`<div class="answer-panel success"><h3>${card.correctAnswer}. ${esc(card.choices?.[card.correctAnswer]||'')}</h3>${renderAllJustifications(card)}</div><button class="primary-button" id="nextGuildQuestion">Next Question</button>`:`<button class="secondary-button" id="revealGuildAnswer">Reveal Answer</button>`}</div>`;
}

function renderStudyGamesTab(){
  const deck=selectedLibraryDeck(); if(!deck)return renderNoDeckCta();
  const games=[
    ['missed-gauntlet','Missed Question Gauntlet','Three lives. Answer as many missed questions as possible before elimination.','qae'],
    ['confidence-climb','Confidence Climb','Correct answers move Ollie up the mountain; lapses slide the marker down.','target'],
    ['speed-audit','60-Second Audit Sprint','Answer quickly from your imported question bank and build an answer streak.','timer'],
    ['guild-race','Guild Question Race','Launch a synchronized Guild round where correct answers add points to each member.','guild']
  ];
  return `<div class="section-head"><div><p class="eyebrow">Question-Powered Games</p><h3>Games Built From Your Real Imported Library</h3><p class="helper">No filler prompts. Every round draws from the selected deck, its missed questions, or the Guild master bank.</p></div>${deckPicker('games')}</div><div class="grid two">${games.map(([id,title,desc,icon])=>`<div class="game-card"><span class="app-icon ${icon}">${svgIcon(icon)}</span><h4>${title}</h4><p class="helper">${desc}</p><button class="primary-button small" data-library-game="${id}">Play</button></div>`).join('')}</div>${renderLibraryGameArena()}`;
}
function startLibraryGame(type){
  if(type==='guild-race'){ state.toolsTab='guild-study';renderApp();return; }
  const deck=selectedLibraryDeck(); let cards=libraryCardsForDeck(deck).filter(c=>c.correctAnswer&&Object.keys(c.choices||{}).length>=2); if(type==='missed-gauntlet')cards=cards.filter(c=>c.wasCorrectAtImport===false||(state.library.progress[progressKey(c)]?.incorrectCount||0)>0);
  if(!cards.length)return toast('This deck does not have eligible multiple-choice cards for that game.','error');
  const shuffled=[...cards].sort(()=>Math.random()-.5).slice(0,30); state.gameState={type,deckId:deck.id,queue:shuffled.map(libraryCardKey),index:0,score:0,lives:3,streak:0,bestStreak:0,startedAt:Date.now(),selected:null,submitted:false}; renderApp();
}
function renderLibraryGameArena(){ const g=state.gameState; if(!g)return `<div class="empty" style="margin-top:16px">Choose a game to open the game arena.</div>`; const card=libraryCardFromKey(g.queue[g.index]); if(!card)return renderLibraryGameComplete(g); const timeLeft=g.type==='speed-audit'?Math.max(0,60-Math.floor((Date.now()-g.startedAt)/1000)):null; return `<div class="game-arena"><div class="section-head"><div><span class="bubble good">Score ${g.score}</span><span class="bubble">Streak ${g.streak}</span>${g.type==='missed-gauntlet'?`<span class="bubble warn">Lives ${g.lives}</span>`:''}${timeLeft!==null?`<span class="bubble">${timeLeft}s</span>`:''}</div><button class="ghost-button small" id="quitLibraryGame">Quit</button></div><h2>${esc(card.question)}</h2><div class="quiz-options">${Object.entries(card.choices||{}).map(([l,t])=>`<button class="quiz-option ${g.selected===l?'selected':''}" data-library-game-answer="${l}"><strong>${l}</strong><span>${esc(t)}</span></button>`).join('')}</div></div>`; }
function answerLibraryGame(letter){ const g=state.gameState,card=libraryCardFromKey(g.queue[g.index]); if(!g||!card)return; const correct=letter===card.correctAnswer; if(correct){g.score+=100+g.streak*15;g.streak++;g.bestStreak=Math.max(g.bestStreak,g.streak);}else{g.streak=0;if(g.type==='missed-gauntlet')g.lives--;} g.index++; if((g.type==='missed-gauntlet'&&g.lives<=0)||(g.type==='speed-audit'&&Date.now()-g.startedAt>=60000))g.index=g.queue.length; renderApp(); }
function renderLibraryGameComplete(g){ return `<div class="study-complete"><span class="app-icon arcade">${svgIcon('arcade')}</span><h2>Game Complete</h2><div class="practice-summary"><div class="soft"><h3>${g.score}</h3><p class="helper">Score</p></div><div class="soft"><h3>${g.bestStreak}</h3><p class="helper">Best Answer Streak</p></div><div class="soft"><h3>${g.index}</h3><p class="helper">Questions Attempted</p></div></div><button class="primary-button" id="finishLibraryGame">Collect Rewards</button></div>`; }
function finishLibraryGame(){ const g=state.gameState;if(!g)return;const xp=Math.min(80,15+Math.round(g.score/100));const coins=Math.min(35,5+Math.round(g.score/300));award({xp,coins,reason:`Question Game Complete: ${titleCase(g.type)}`,type:'Arcade'});state.gameState=null;saveProfileDebounced();showCelebration('Game Rewards Collected',`+${xp} XP · +${coins} Audit Coins`);renderApp(); }

function renderStudyAnalyticsTab(){
  const stats=calculateLibraryStats(state.library.cards,state.library.progress,state.library.reviews,null,state.profile.preferences.studySettings||DEFAULT_REVIEW_SETTINGS); const last7=reviewCountsLastDays(7); const max=Math.max(1,...last7.map(x=>x.count));
  const desired=Math.round((state.profile.preferences.studySettings?.desiredRetention||.9)*100); const modes=reviewModeSummary(); const forecast=dueForecast(7); const forecastMax=Math.max(1,...forecast.map(x=>x.count));
  return `<div class="section-head"><div><p class="eyebrow">Learning Analytics</p><h3>Your Adaptive Review Trajectory</h3><p class="helper">Progress is based on actual answers and review ratings, not simply opening a deck. Your current desired retention target is ${desired}%.</p></div></div>
    <div class="practice-summary"><div class="soft"><h3>${stats.reviews}</h3><p class="helper">Lifetime Reviews</p></div><div class="soft"><h3>${stats.accuracy}%</h3><p class="helper">Answer Accuracy</p></div><div class="soft"><h3>${stats.lapses}</h3><p class="helper">Lapses</p></div><div class="soft"><h3>${stats.leeches||0}</h3><p class="helper">High-Lapse Cards</p></div><div class="soft"><h3>${stats.retention}%</h3><p class="helper">Estimated Library Progress</p></div></div>
    <div class="grid two"><div class="analytics-chart"><h4>Reviews In The Last 7 Days</h4><div class="bar-chart">${last7.map(d=>`<div class="bar-column"><span style="height:${Math.max(4,d.count/max*140)}px"></span><strong>${d.count}</strong><small>${d.label}</small></div>`).join('')}</div></div><div class="analytics-chart"><h4>Due Forecast</h4><div class="bar-chart">${forecast.map(d=>`<div class="bar-column"><span style="height:${Math.max(4,d.count/forecastMax*140)}px"></span><strong>${d.count}</strong><small>${d.label}</small></div>`).join('')}</div></div></div>
    <div class="grid two"><div><h3>Study Mode Performance</h3><div class="log-table">${modes.length?modes.map(m=>`<div class="log-row"><div><strong>${esc(m.label)}</strong><p class="helper">${m.total} Answers · ${m.accuracy}% Accuracy</p></div><div class="metric-row"><span class="bubble good">${m.correct} Correct</span><span class="bubble warn">${m.incorrect} Missed</span></div></div>`).join(''):'<div class="empty">No review-mode history yet.</div>'}</div></div><div><h3>Deck Performance</h3><div class="log-table">${libraryDecks().map(d=>{const st=currentDeckStats(d);return `<div class="log-row"><div><strong>${esc(d.title)}</strong><p class="helper">${esc(d.scope)} · ${libraryCardsForDeck(d).length} Cards</p></div><div class="metric-row"><span class="bubble">${st.due} Due</span><span class="bubble good">${st.mastered} Mastered</span><span class="bubble warn">${st.accuracy}% Accuracy</span></div></div>`;}).join('')||'<div class="empty">No deck analytics yet.</div>'}</div></div></div>`;
}
function reviewModeSummary(){
  const map=new Map(); for(const r of state.library.reviews||[]){const key=r.mode||'review';const row=map.get(key)||{mode:key,correct:0,incorrect:0,total:0};row.total++;if(r.correct)row.correct++;else row.incorrect++;map.set(key,row);}return [...map.values()].map(row=>({...row,label:titleCase(String(row.mode).replace(/-/g,' ')),accuracy:row.total?Math.round(row.correct/row.total*100):0})).sort((a,b)=>b.total-a.total);
}
function dueForecast(days){
  const out=[]; for(let i=0;i<days;i++){const d=new Date();d.setHours(0,0,0,0);d.setDate(d.getDate()+i);const next=new Date(d);next.setDate(next.getDate()+1);const count=(state.library.cards||[]).filter(card=>{const p=state.library.progress[progressKey(card)];if(!p||!p.dueAt)return i===0;const due=new Date(p.dueAt);return due>=d&&due<next;}).length;out.push({label:i===0?'Today':new Intl.DateTimeFormat('en-US',{weekday:'short'}).format(d),count});}return out;
}

function reviewCountsLastDays(days){ const out=[]; for(let i=days-1;i>=0;i--){const d=new Date();d.setDate(d.getDate()-i);const iso=d.toISOString().slice(0,10);out.push({iso,label:new Intl.DateTimeFormat('en-US',{weekday:'short'}).format(d),count:(state.library.reviews||[]).filter(r=>String(r.reviewedAt||'').slice(0,10)===iso).length});}return out; }

function bindTools(){
  $$('[data-tools-tab]').forEach(b=>b.onclick=()=>{state.toolsTab=b.dataset.toolsTab;state.studySession=null;state.gameState=null;renderApp();});
  $('#refreshStudyLibrary')?.addEventListener('click',async()=>{await refreshStudyLibrary();toast('Study library refreshed.');renderApp();});
  $('#newDeckBtn')?.addEventListener('click',()=>libraryDeckModal());
  $('#libraryScopeFilter')?.addEventListener('change',e=>{state.libraryScopeFilter=e.target.value;renderApp();});
  $$('[data-open-deck]').forEach(b=>b.onclick=()=>{state.selectedDeckId=b.dataset.openDeck;state.toolsTab=b.dataset.openMode||'review';state.studySession=null;renderApp();});
  $$('[data-deck-picker]').forEach(s=>s.onchange=()=>{state.selectedDeckId=s.value;state.studySession=null;renderApp();});
  $$('[data-add-card]').forEach(b=>b.onclick=()=>libraryCardModal(b.dataset.addCard));
  $$('[data-edit-library-deck]').forEach(b=>b.onclick=()=>libraryDeckModal(b.dataset.editLibraryDeck));
  $$('[data-delete-library-deck]').forEach(b=>b.onclick=()=>deleteLibraryDeckFlow(b.dataset.deleteLibraryDeck));
  $$('[data-export-library-deck]').forEach(b=>b.onclick=()=>exportLibraryDeck(b.dataset.exportLibraryDeck));
  $$('[data-start-study]').forEach(b=>b.onclick=()=>startStudySession('review',b.dataset.startStudy));
  $('[data-start-flashcards]')?.addEventListener('click',()=>startStudySession('flashcards','all'));
  $$('[data-start-quiz]').forEach(b=>b.onclick=()=>startStudySession('quiz',b.dataset.startQuiz));
  $('#adaptiveFlashcard')?.addEventListener('click',()=>{state.deckFlipped=!state.deckFlipped;renderApp();});
  $$('[data-quiz-choice]').forEach(b=>b.onclick=()=>{if(!state.studySession.answerSubmitted){state.studySession.selectedAnswer=b.dataset.quizChoice;renderApp();}});
  $('#submitQuizAnswer')?.addEventListener('click',()=>{if(!state.studySession.selectedAnswer)return;const card=currentStudyCard();state.studySession.answerSubmitted=true;state.quizRevealed=true;renderApp();});
  $$('[data-rate-card]').forEach(b=>b.onclick=()=>applyCardRating(b.dataset.rateCard));
  $('#endStudySession')?.addEventListener('click',()=>{state.studySession=null;renderApp();});
  $('#finishStudySession')?.addEventListener('click',()=>{const s=state.studySession;const reviewed=(s.correct||0)+(s.incorrect||0);if(reviewed){state.profile.studyHistory.sessions=(state.profile.studyHistory.sessions||0)+1;award({xp:Math.min(40,10+reviewed),coins:Math.min(18,4+Math.floor(reviewed/2)),reason:`Adaptive Study Session: ${reviewed} Cards`,type:'Flashcards'});saveProfileDebounced();}state.studySession=null;renderApp();});
  $('#startGuildQuiz')?.addEventListener('click',()=>startGuildStudy(false)); $('#startGuildMissed')?.addEventListener('click',()=>startGuildStudy(true));
  $$('[data-guild-answer]').forEach(b=>b.onclick=()=>submitGuildAnswer(b.dataset.guildAnswer)); $('#revealGuildAnswer')?.addEventListener('click',revealGuildAnswer); $('#nextGuildQuestion')?.addEventListener('click',nextGuildQuestion); $('#endGuildStudy')?.addEventListener('click',endGuildStudy);
  $$('[data-library-game]').forEach(b=>b.onclick=()=>startLibraryGame(b.dataset.libraryGame)); $$('[data-library-game-answer]').forEach(b=>b.onclick=()=>answerLibraryGame(b.dataset.libraryGameAnswer)); $('#quitLibraryGame')?.addEventListener('click',()=>{state.gameState=null;renderApp();}); $('#finishLibraryGame')?.addEventListener('click',finishLibraryGame);
}
async function libraryDeckModal(id=null){
  const current=libraryDecks().find(d=>d.id===id); const defaultScope=state.profile.activeGroupId?'Guild':'Personal';
  modal(current?'Edit Deck':'Create Original Deck',`<div class="form-grid"><label><span class="label-title">Deck Title</span><input id="libraryDeckTitle" value="${escAttr(current?.title||'')}"></label><label><span class="label-title">Scope</span><select id="libraryDeckScope" ${current?'disabled':''}><option ${((current?.scope||defaultScope)==='Guild')?'selected':''}>Guild</option><option ${((current?.scope||defaultScope)==='Personal')?'selected':''}>Personal</option><option ${current?.scope==='Public'?'selected':''}>Public</option></select></label></div><label><span class="label-title">Description</span><textarea id="libraryDeckDescription">${esc(current?.description||'')}</textarea></label><label><span class="label-title">Optional Bulk Cards</span><textarea id="libraryDeckBulk" placeholder="Question[TAB]Answer — one card per line"></textarea></label><p class="helper">Public is for original material only. Do not publish paid QAE question text.</p>`,async()=>{const title=$('#libraryDeckTitle').value.trim();if(!title)return toast('Deck title is required.','error');const scope=current?.scope||$('#libraryDeckScope').value;if(scope==='Guild'&&!state.profile.activeGroupId)return toast('Join a Guild first.','error');const key=scopeKey(scope,state.user.uid,state.profile.activeGroupId);const deck=current?{...current,title,description:$('#libraryDeckDescription').value.trim(),updatedAt:new Date().toISOString()}:{id:makeDeckId(title,scope,state.user.uid,state.profile.activeGroupId,crypto.randomUUID()),title,description:$('#libraryDeckDescription').value.trim(),scope,scopeKey:key,ownerUid:state.user.uid,groupId:scope==='Guild'?state.profile.activeGroupId:null,createdBy:state.profile.displayName,kind:'custom',createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()};const cards=$('#libraryDeckBulk').value.split(/\n+/).map(line=>line.split('\t')).filter(parts=>parts[0]?.trim()&&parts[1]?.trim()).map(parts=>{const question=parts[0].trim(),answer=parts.slice(1).join('\t').trim(),fp=cardFingerprint(question,{});return{id:`card_${fp}`,fingerprint:fp,scope,scopeKey:key,deckIds:[deck.id],source:'Original Deck',question,choices:{},correctAnswer:'',justifications:{_:answer},tags:[title],ownerUid:state.user.uid,importedAt:new Date().toISOString(),updatedAt:new Date().toISOString()};});await saveStudyImport({uid:state.user.uid,groupId:state.profile.activeGroupId,decks:[deck],cards});state.library=mergeUniqueLibrary(state.library,{decks:[deck],cards});state.selectedDeckId=deck.id;renderApp();},current?'Save Deck':'Create Deck');
}
function libraryCardModal(deckId){ const deck=libraryDecks().find(d=>d.id===deckId);if(!deck)return;modal('Add Original Study Card',`<label><span class="label-title">Question / Prompt</span><textarea id="newCardQuestion"></textarea></label><div class="form-grid"><input id="newCardA" placeholder="A. Optional choice"><input id="newCardB" placeholder="B. Optional choice"><input id="newCardC" placeholder="C. Optional choice"><input id="newCardD" placeholder="D. Optional choice"><label><span class="label-title">Correct Choice</span><select id="newCardCorrect"><option value="">Simple Flashcard</option><option>A</option><option>B</option><option>C</option><option>D</option></select></label></div><label><span class="label-title">Answer / Explanation</span><textarea id="newCardExplanation"></textarea></label>`,async()=>{const question=$('#newCardQuestion').value.trim(),explanation=$('#newCardExplanation').value.trim();if(!question||!explanation)return toast('Question and explanation are required.','error');const choices={};['A','B','C','D'].forEach(l=>{const v=$(`#newCard${l}`).value.trim();if(v)choices[l]=v;});const correct=$('#newCardCorrect').value;if(correct&&!choices[correct])return toast('The selected correct choice needs text.','error');const fp=cardFingerprint(question,choices);const card={id:`card_${fp}`,fingerprint:fp,scope:deck.scope,scopeKey:deck.scopeKey,deckIds:[deck.id],source:'Original Card',question,choices,correctAnswer:correct,justifications:correct?{[correct]:explanation}:{_:explanation},tags:[deck.title],ownerUid:state.user.uid,importedAt:new Date().toISOString(),updatedAt:new Date().toISOString()};await saveStudyCard({uid:state.user.uid,groupId:state.profile.activeGroupId,card});state.library=mergeUniqueLibrary(state.library,{cards:[card],decks:[]});renderApp();},'Add Card'); }
async function deleteLibraryDeckFlow(id){ const deck=libraryDecks().find(d=>d.id===id);if(!deck)return;await confirmModal('Delete Deck',`Delete “${esc(deck.title)}”? Cards shared with a Master deck remain in the Master bank.`,async()=>{await deleteStudyDeck({uid:state.user.uid,groupId:state.profile.activeGroupId,deck});state.library.decks=state.library.decks.filter(d=>!(d.id===deck.id&&d.scopeKey===deck.scopeKey));state.library.cards=state.library.cards.map(c=>c.scopeKey===deck.scopeKey?{...c,deckIds:(c.deckIds||[]).filter(x=>x!==deck.id)}:c);if(state.selectedDeckId===deck.id)state.selectedDeckId=null;renderApp();}); }
function exportLibraryDeck(id){ const deck=libraryDecks().find(d=>d.id===id);if(!deck)return;const rows=libraryCardsForDeck(deck).map(c=>[c.question,c.correctAnswer,c.choices?.[c.correctAnswer]||'',c.justifications?.[c.correctAnswer]||c.justifications?._||'',c.domain,c.knowledgeStatement].map(v=>String(v||'').replace(/\t/g,' ')).join('\t'));downloadText(`${safeFile(deck.title)}.tsv`,`Question\tCorrect Letter\tCorrect Answer\tExplanation\tDomain\tKnowledge Statement\n${rows.join('\n')}`,'text/tab-separated-values'); }
async function startGuildStudy(missedOnly){ const deck=libraryDecks().find(d=>d.id===$('#guildStudyDeck').value);if(!deck)return;let cards=libraryCardsForDeck(deck).filter(c=>c.correctAnswer&&Object.keys(c.choices||{}).length>=2);if(missedOnly)cards=cards.filter(c=>c.wasCorrectAtImport===false);cards=[...cards].sort(()=>Math.random()-.5).slice(0,30);if(!cards.length)return toast('No eligible questions in that Guild deck.','error');state.group.studySession={id:crypto.randomUUID(),active:true,title:missedOnly?'Guild Missed-Question Review':'Guild Question Review',deckId:deck.id,scopeKey:deck.scopeKey,cardKeys:cards.map(libraryCardKey),index:0,responses:{},scores:{},revealed:false,hostUid:state.user.uid,startedAt:new Date().toISOString()};await saveGroup(state.group);renderApp(); }
async function submitGuildAnswer(letter){ const gs=state.group?.studySession,card=libraryCardFromKey(gs?.cardKeys?.[gs.index]);if(!gs||!card||gs.responses?.[state.user.uid])return;gs.responses||={};gs.scores||={};const correct=letter===card.correctAnswer;gs.responses[state.user.uid]={answer:letter,correct,at:new Date().toISOString()};gs.scores[state.user.uid]=(gs.scores[state.user.uid]||0)+(correct?100:0);const old=state.library.progress[progressKey(card)]||defaultProgress(card,state.user.uid);const next=rateCard(card,old,correct?'Good':'Again',state.profile.preferences.studySettings||DEFAULT_REVIEW_SETTINGS);state.library.progress[progressKey(card)]=next;const event=createReviewEvent({uid:state.user.uid,card,deckId:gs.deckId,mode:'guild-quiz',rating:correct?'Good':'Again',correct,responseTimeMs:0,sessionId:gs.id,groupId:state.profile.activeGroupId,wasNew:!(old.repetitions||0)});state.library.reviews.unshift(event);await Promise.all([saveStudyProgress(state.user.uid,next),saveStudyReview(state.user.uid,event),saveGroup(state.group)]);renderApp(); }
async function revealGuildAnswer(){if(!state.group?.studySession)return;state.group.studySession.revealed=true;await saveGroup(state.group);renderApp();}
async function nextGuildQuestion(){const gs=state.group?.studySession;if(!gs)return;gs.index++;gs.responses={};gs.revealed=false;await saveGroup(state.group);renderApp();}
async function endGuildStudy(){if(!state.group?.studySession)return;state.group.studySession.active=false;state.group.studySession.endedAt=new Date().toISOString();await saveGroup(state.group);renderApp();}

function renderGuild(){
  return `<div class="grid">
    <div class="panel" data-tour="guild-home"><div class="section-head"><div><p class="eyebrow">Study Guild</p><h3>${esc(state.group?.name||'Join Or Create A Guild')}</h3><p class="helper">Guilds show high-level progress only: level, streak, QAE totals, study minutes, and shared sessions.</p></div></div>${state.group?guildDetails():guildSetup()}</div>
    ${state.group?`<div class="panel"><div class="section-head"><div><p class="eyebrow">Guild Calendar Glance</p><h3>Upcoming Shared Events</h3></div><button class="secondary-button small" data-go="calendar">Open Full Calendar</button></div>${guildEventsMini()}</div><div class="panel"><p class="eyebrow">Guild Session Metrics</p><div class="grid four"><div class="soft"><h3>${state.group.sessionStats?.completed||0}</h3><p class="helper">Completed Sessions</p></div><div class="soft"><h3>${state.group.sessionStats?.minutes||0}</h3><p class="helper">Guild Minutes</p></div><div class="soft"><h3>${state.group.sessionStats?.streak||0}</h3><p class="helper">Session Streak</p></div><div class="soft"><h3>${Object.keys(state.group.members||{}).length}</h3><p class="helper">Members</p></div></div></div>`:''}
  </div>`;
}
function guildSetup(){ return `<div class="grid two"><div class="soft"><h3>Create A Guild</h3><input id="newGuildName" placeholder="Guild Name"><button class="primary-button" id="createGuild">Create Guild</button></div><div class="soft"><h3>Join A Guild</h3><input id="joinGuildId" placeholder="Guild ID"><input id="joinGuildCode" placeholder="Invite Code"><button class="secondary-button" id="joinGuild">Join Guild</button></div></div>`; }
function guildDetails(){ const members=Object.values(state.group.members||{}); return `<div class="soft"><div class="form-grid"><label><span class="label-title">Guild Name</span><input id="guildName" value="${escAttr(state.group.name)}"></label><label><span class="label-title">Guild Icon</span><select id="guildIcon"><option value="guild">Guild Shield</option><option value="qae">QAE Check</option><option value="streak">Streak Flame</option><option value="target">Target</option></select></label><label><span class="label-title">Guild Color</span><input id="guildColor" type="color" value="${state.group.color||'#7c4dff'}"></label></div><div class="button-row"><button class="primary-button small" id="saveGuildSettings">Save Guild</button><span class="bubble">ID: ${state.group.id}</span><span class="bubble">Invite Code: ${state.group.code}</span></div></div><h3>Member Overview</h3><div class="grid three">${members.map(m=>`<div class="member-card"><div class="button-row"><div class="avatar small">${avatarSvg(m.avatar||{})}</div><div><h4>${esc(m.name)}</h4><div class="metric-row"><span class="bubble">Level ${m.level||1}</span><span class="bubble good">${m.streak||0} Day Streak</span><span class="bubble">${m.qaeQuestions||0} Questions</span><span class="bubble">${m.minutes||0} Minutes</span></div></div></div></div>`).join('')}</div>`; }
function guildEventsMini(){ const events=allEvents().filter(e=>e.scope!=='Personal' && new Date(e.end)>=new Date()).sort((a,b)=>new Date(a.start)-new Date(b.start)).slice(0,5); return events.length?`<div class="grid">${events.map(e=>`<div class="event-card"><strong>${esc(e.title)}</strong><p class="helper">${fmtDateTime(e.start)} · ${esc(e.scope)}</p></div>`).join('')}</div>`:'<div class="empty">No upcoming Guild events yet.</div>'; }
function bindGuild(){ $('#createGuild')?.addEventListener('click',async()=>{const name=$('#newGuildName').value.trim()||'Study Guild'; const g=defaultGroup(state.profile,name); state.group=g; state.profile.activeGroupId=g.id; state.profile.guildIds=[...new Set([...(state.profile.guildIds||[]),g.id])]; await createGroup(g); await saveProfileDebounced(true); renderApp();}); $('#joinGuild')?.addEventListener('click',async()=>{const id=$('#joinGuildId').value.trim(); const code=$('#joinGuildCode').value.trim().toUpperCase(); const g=await loadGroup(id); if(!g||g.code!==code)return toast('Guild ID or invite code is invalid.','error'); state.group=g; state.group.members ||= {}; state.group.members[state.profile.uid]=publicSummary(state.profile); state.profile.activeGroupId=id; state.profile.guildIds=[...new Set([...(state.profile.guildIds||[]),id])]; await saveAll({group:true}); await loadActiveGroup(id); renderApp();}); $('#saveGuildSettings')?.addEventListener('click',async()=>{state.group.name=$('#guildName').value.trim()||state.group.name; state.group.icon=$('#guildIcon').value; state.group.color=$('#guildColor').value; await saveGroup(state.group); toast('Guild saved.'); renderApp();}); }

function renderCalendar(){
  const date=new Date(state.currentMonth); date.setDate(1); const year=date.getFullYear(), month=date.getMonth(); const first=startOfWeek(date); const days=[]; let cur=new Date(first); for(let i=0;i<42;i++){days.push(new Date(cur));cur.setDate(cur.getDate()+1);} const labels=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  return `<div class="grid"><div class="panel" data-tour="calendar"><div class="calendar-toolbar"><div><p class="eyebrow">Calendar</p><h3>${date.toLocaleString('en-US',{month:'long',year:'numeric'})}</h3><p class="helper">Create Personal, Guild, or Both events. Use Google Calendar connection when configured, or download .ics invites.</p></div><div class="button-row"><button class="secondary-button small" id="prevMonth">Previous</button><button class="secondary-button small" id="nextMonth">Next</button><button class="primary-button small" id="newEvent">Create Event</button></div></div><div class="calendar-grid">${labels.map(l=>`<div class="calendar-label">${l}</div>`).join('')}${days.map(d=>calendarDay(d,month)).join('')}</div></div><div class="panel"><div class="section-head"><div><p class="eyebrow">Calendar Integrations</p><h3>Connect Or Export</h3></div></div><div class="grid two"><div class="soft"><h4>Google Calendar</h4><p class="helper">Optional direct event creation requires a Google OAuth client ID in config. Otherwise use ICS downloads.</p><button class="secondary-button" id="connectGoogleCal">Connect Google Calendar</button></div><div class="soft"><h4>Apple / iCalendar</h4><p class="helper">For Apple Calendar, use the ICS download/import workflow or a shared calendar subscription. Browser-only CalDAV is not reliable without a server.</p><button class="secondary-button" id="downloadUpcomingIcs">Download Upcoming ICS</button></div></div></div></div>`;
}
function calendarDay(d,month){ const iso=dateIso(d), events=allEvents().filter(e=>e.start.slice(0,10)===iso); const other=d.getMonth()!==month; return `<div class="calendar-day ${other?'other':''} ${iso===todayIso()?'today':''}" data-date="${iso}"><strong>${d.getDate()}</strong>${events.map(e=>`<button class="cal-event ${String(e.scope||'Personal').toLowerCase()}" data-event="${e.id}">${esc(e.title)}</button>`).join('')}</div>`; }
function bindCalendar(){ $('#prevMonth')?.addEventListener('click',()=>{state.currentMonth.setMonth(state.currentMonth.getMonth()-1);renderApp();}); $('#nextMonth')?.addEventListener('click',()=>{state.currentMonth.setMonth(state.currentMonth.getMonth()+1);renderApp();}); $('#newEvent')?.addEventListener('click',()=>eventModal()); $$('[data-date]').forEach(d=>d.ondblclick=()=>eventModal({start:d.dataset.date+'T07:00',end:d.dataset.date+'T08:00'})); $$('[data-event]').forEach(b=>b.onclick=()=>eventModal(allEvents().find(e=>e.id===b.dataset.event))); $('#connectGoogleCal')?.addEventListener('click',async()=>{try{await connectGoogleCalendar();toast('Google Calendar connected for this browser session.');}catch(e){toast(friendly(e),'error');}}); $('#downloadUpcomingIcs')?.addEventListener('click',()=>{const e=allEvents().find(x=>new Date(x.end)>=new Date()); if(!e)return toast('No upcoming events to download.','error'); downloadIcs(e,groupEmails());}); }
function eventModal(event={}){ const isEdit=!!event.id; modal(isEdit?'Edit Calendar Event':'Create Calendar Event',`<div class="form-grid"><label><span class="label-title">Title</span><input id="evTitle" value="${escAttr(event.title||'CISA Study Session')}"></label><label><span class="label-title">Scope</span><select id="evScope"><option ${event.scope==='Personal'?'selected':''}>Personal</option><option ${event.scope==='Guild'?'selected':''}>Guild</option><option ${event.scope==='Both'?'selected':''}>Both</option></select></label><label><span class="label-title">Start</span><input id="evStart" type="datetime-local" value="${toLocalInput(event.start||todayIso()+'T07:00')}"></label><label><span class="label-title">End</span><input id="evEnd" type="datetime-local" value="${toLocalInput(event.end||todayIso()+'T08:00')}"></label><label><span class="label-title">Recurrence</span><select id="evRecurrence"><option value="">Does Not Repeat</option><option value="RRULE:FREQ=DAILY">Daily</option><option value="RRULE:FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR">Weekdays</option><option value="RRULE:FREQ=WEEKLY">Weekly</option></select></label><label><span class="label-title">Plan Me A Session</span><select id="evPlan"><option value="no">No</option><option value="yes" ${event.planGenerated?'selected':''}>Yes</option></select></label></div><label><span class="label-title">Description</span><textarea id="evDesc">${esc(event.description||'')}</textarea></label>`,async()=>{ const title=$('#evTitle').value.trim(); const start=$('#evStart').value,end=$('#evEnd').value; if(!title||!start||!end||new Date(start)>=new Date(end))return toast('Add a valid title, start, and end time.','error'); const ev={...event,id:event.id||crypto.randomUUID(),title,scope:$('#evScope').value,start:new Date(start).toISOString(),end:new Date(end).toISOString(),description:$('#evDesc').value.trim(),rrule:$('#evRecurrence').value,planGenerated:$('#evPlan').value==='yes'}; upsertEvent(ev); if(ev.planGenerated) addBonusFromEvent(ev); await saveAll({group:true}); renderApp(); },isEdit?'Save Event':'Create Event', isEdit?`<button class="danger-button" data-delete-modal-event="${event.id}">Delete</button><button class="secondary-button" data-ics-modal-event="${event.id}">Download ICS</button><button class="secondary-button" data-google-modal-event="${event.id}">Send To Google</button>`:''); setTimeout(()=>{$('[data-delete-modal-event]')?.addEventListener('click',()=>{deleteEvent(event.id);$('.modal-backdrop')?.remove();renderApp();}); $('[data-ics-modal-event]')?.addEventListener('click',()=>downloadIcs(event,groupEmails())); $('[data-google-modal-event]')?.addEventListener('click',async()=>{try{await createGoogleEvent(event,groupEmails());toast('Sent to Google Calendar.');}catch(e){toast(friendly(e),'error');}});},0); }
function allEvents(){ return [...(state.profile.calendarEvents||[]),...(state.group?.events||[])]; }
function upsertEvent(ev){ if(ev.scope==='Personal'){ state.profile.calendarEvents=upsert(state.profile.calendarEvents,ev); } else if(ev.scope==='Guild'){ ensureGroupLocal(); state.group.events=upsert(state.group.events,ev); } else { state.profile.calendarEvents=upsert(state.profile.calendarEvents,{...ev,scope:'Personal'}); ensureGroupLocal(); state.group.events=upsert(state.group.events,{...ev,scope:'Guild'}); } }
function deleteEvent(id){ state.profile.calendarEvents=(state.profile.calendarEvents||[]).filter(e=>e.id!==id); if(state.group) state.group.events=(state.group.events||[]).filter(e=>e.id!==id); saveAll({group:true}); }
function addBonusFromEvent(ev){ const date=ev.start.slice(0,10); state.profile.roadmap.bonusSessions.push({id:ev.id,date,title:ev.title,description:ev.description,minutes:Math.round((new Date(ev.end)-new Date(ev.start))/60000)}); }
function groupEmails(){ return Object.values(state.group?.members||{}).map(m=>m.email).filter(Boolean); }

function renderNotebook(){ const notes=filteredNotes(); const selected=state.profile.notes.find(n=>n.id===state.selectedNoteId)||notes[0]; if(selected) state.selectedNoteId=selected.id;
  return `<div class="notes-layout"><div class="panel"><div class="section-head"><div><p class="eyebrow">Notebook</p><h3>Notes Library</h3></div><button class="primary-button small" id="newNote">New Note</button></div><div class="button-row"><button class="secondary-button small" data-note-filter="Personal">Personal</button><button class="secondary-button small" data-note-filter="Guild">Guild</button><button class="secondary-button small" data-note-filter="Public">Public</button></div><div class="note-list">${notes.length?notes.map(n=>`<button class="note-card ${n.id===state.selectedNoteId?'active':''}" data-note="${n.id}"><h4>${esc(n.title)}</h4><p class="helper">${esc(n.scope)} · ${fmtDate(n.updatedAt||n.createdAt)}</p></button>`).join(''):'<div class="empty">No notes yet.</div>'}</div></div><div class="panel"><div class="section-head"><div><p class="eyebrow">Editor</p><h3>${selected?esc(selected.title):'No Note Selected'}</h3></div><div class="button-row">${selected?'<button class="secondary-button small" id="exportDoc">Export Word-Compatible .doc</button><button class="secondary-button small" id="exportMd">Export Markdown</button><button class="danger-button small" id="deleteNote">Delete</button>':''}</div></div>${selected?noteEditor(selected):'<div class="empty">Create a note to start writing.</div>'}</div></div>`; }
function filteredNotes(){ return state.profile.notes || []; }
function noteEditor(n){ return `<div class="editor-box"><div class="form-grid"><input id="noteTitle" value="${escAttr(n.title)}"><select id="noteScope"><option ${n.scope==='Personal'?'selected':''}>Personal</option><option ${n.scope==='Guild'?'selected':''}>Guild</option><option ${n.scope==='Public'?'selected':''}>Public</option></select></div><textarea id="noteBody">${esc(n.body||'')}</textarea><div class="button-row"><button class="primary-button" id="saveNote">Save Note</button></div><div class="markdown-preview">${markdownPreview(n.body||'')}</div></div>`; }
function bindNotebook(){ $('#newNote')?.addEventListener('click',()=>{ const n={id:crypto.randomUUID(),title:'Untitled Note',scope:'Personal',body:'',createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()}; state.profile.notes.unshift(n); state.selectedNoteId=n.id; saveProfileDebounced(); renderApp(); }); $$('[data-note]').forEach(b=>b.onclick=()=>{state.selectedNoteId=b.dataset.note;renderApp();}); $('#saveNote')?.addEventListener('click',()=>{const n=state.profile.notes.find(x=>x.id===state.selectedNoteId); if(!n)return; n.title=$('#noteTitle').value.trim()||'Untitled Note'; n.scope=$('#noteScope').value; n.body=$('#noteBody').value; n.updatedAt=new Date().toISOString(); if(n.scope==='Guild'&&state.group){state.group.notes ||= []; state.group.notes=upsert(state.group.notes,{id:n.id,title:n.title,body:n.body,author:state.profile.displayName,createdAt:n.createdAt,updatedAt:n.updatedAt,scope:'Guild'});} award({xp:5,coins:2,reason:'Note Saved',type:'Notebook'}); saveAll({group:true}); renderApp();}); $('#deleteNote')?.addEventListener('click',()=>confirmModal('Delete Note','Delete this note?',()=>{state.profile.notes=state.profile.notes.filter(n=>n.id!==state.selectedNoteId); state.selectedNoteId=null;saveProfileDebounced();renderApp();})); $('#exportMd')?.addEventListener('click',()=>exportNote('md')); $('#exportDoc')?.addEventListener('click',()=>exportNote('doc')); }
function exportNote(type){ const n=state.profile.notes.find(x=>x.id===state.selectedNoteId); if(!n)return; const text=`# ${n.title}\n\n${n.body||''}`; downloadText(`${safeFile(n.title)}.${type==='doc'?'doc':'md'}`, type==='doc'?`<html><body><h1>${esc(n.title)}</h1><pre>${esc(n.body||'')}</pre></body></html>`:text, type==='doc'?'application/msword':'text/markdown'); }

function renderRewards(){ const lvl=levelInfo(); return `<div class="grid"><div class="panel"><div class="section-head"><div><p class="eyebrow">Rewards</p><h3>XP, Audit Coins, Inventory, And Avatar</h3></div></div><div class="grid three"><div class="soft"><h3>${state.profile.stats.xp}</h3><p class="helper">Total XP · Level ${lvl.level}</p></div><div class="soft"><h3>${state.profile.stats.coins}</h3><p class="helper">Audit Coins Available</p></div><div class="soft"><h3>${state.profile.inventory.chests.filter(c=>!c.opened).length}</h3><p class="helper">Unopened Chests</p></div></div></div>
    <div class="panel"><div class="section-head"><div><p class="eyebrow">Activity History</p><h3>What Earned Rewards</h3></div></div><div class="activity-list">${state.profile.activity.length?state.profile.activity.map(activityItem).join(''):'<div class="empty">No activity yet.</div>'}</div></div>
    <div class="panel"><div class="section-head"><div><p class="eyebrow">Inventory</p><h3>Chests, Boosts, And Streak Freezes</h3></div></div><div class="grid three">${inventoryCards()}</div></div>
    <div class="panel"><div class="section-head"><div><p class="eyebrow">Quest Shop</p><h3>Spend Audit Coins</h3></div></div><div class="grid three">${SHOP_ITEMS.map(shopItem).join('')}</div></div>
    <div class="panel"><div class="section-head"><div><p class="eyebrow">Avatar Closet</p><h3>Customize Your Owl</h3></div></div><div class="grid two"><div class="avatar-preview-card"><div class="avatar-stage"><div class="avatar big">${avatarSvg(state.previewAvatar||state.profile.inventory.equipped)}</div></div><p class="helper">Preview items before buying. Equip owned items anytime.</p></div><div class="closet-grid">${AVATAR_ITEMS.map(avatarItem).join('')}</div></div></div>
  </div>`; }
function inventoryCards(){ const chests=state.profile.inventory.chests.filter(c=>!c.opened).map(c=>`<div class="shop-card"><span class="app-icon chest-${c.type}">${svgIcon(`chest-${c.type}`)}</span><h4>${titleCase(c.type)} Chest</h4><p class="helper">Earned From: ${esc(c.reason||'Reward')}</p><button class="primary-button small" data-open-chest="${c.id}">Open Chest</button></div>`).join(''); const boosts=state.profile.inventory.boosts.filter(b=>!b.used).map(b=>`<div class="shop-card"><span class="app-icon boost">${svgIcon('boost')}</span><h4>${b.multiplier}x XP Boost</h4><p class="helper">${b.durationMinutes} Minutes</p><button class="primary-button small" data-use-boost="${b.id}">Activate Boost</button></div>`).join(''); return `${chests}${boosts}<div class="shop-card"><span class="app-icon freeze">${svgIcon('freeze')}</span><h4>Streak Freezes</h4><p class="helper">Used automatically on eligible missed weekdays.</p><span class="bubble">${state.profile.stats.streakFreezes||0} Available</span></div>`; }
function shopItem(i){ return `<div class="shop-card"><span class="app-icon ${i.icon}">${svgIcon(i.icon)}</span><h4>${i.title}</h4><p class="helper">${i.details}</p><div class="button-row"><span class="shop-price">${i.cost} Coins</span><button class="primary-button small" data-buy="${i.id}">Buy</button></div></div>`; }
function avatarItem(i){ const owned=state.profile.inventory.ownedItems.includes(i.id); const equipped=isEquipped(i); const locked=levelInfo().level<i.unlockLevel; return `<div class="shop-card"><div class="item-preview"><div class="avatar small">${avatarSvg(previewEquip(i))}</div></div><h4>${i.title}</h4><p class="helper">${titleCase(i.type)} · Level ${i.unlockLevel}${i.cost?` · ${i.cost} Coins`:''}</p><div class="button-row"><button class="secondary-button small" data-preview-avatar="${i.id}">Preview</button>${owned?`<button class="${equipped?'secondary-button':'primary-button'} small" data-equip-avatar="${i.id}" ${equipped?'disabled':''}>${equipped?'Equipped':'Equip'}</button>`:`<button class="primary-button small" data-buy-avatar="${i.id}" ${locked?'disabled':''}>${locked?'Locked':'Buy'}</button>`}</div></div>`; }
function bindRewards(){ $$('[data-buy]').forEach(b=>b.onclick=()=>buyShop(b.dataset.buy)); $$('[data-open-chest]').forEach(b=>b.onclick=()=>openChest(b.dataset.openChest)); $$('[data-use-boost]').forEach(b=>b.onclick=()=>activateBoost(b.dataset.useBoost)); $$('[data-preview-avatar]').forEach(b=>b.onclick=()=>{const i=AVATAR_ITEMS.find(x=>x.id===b.dataset.previewAvatar); state.previewAvatar=previewEquip(i); renderApp();}); $$('[data-equip-avatar]').forEach(b=>b.onclick=()=>equipAvatar(b.dataset.equipAvatar)); $$('[data-buy-avatar]').forEach(b=>b.onclick=()=>buyAvatar(b.dataset.buyAvatar)); }
function buyShop(id){ const i=SHOP_ITEMS.find(x=>x.id===id); if(!i)return; if(state.profile.stats.coins<i.cost)return toast('Not enough Audit Coins.','error'); confirmModal(`Buy ${i.title}`,`Spend ${i.cost} Audit Coins?`,()=>{state.profile.stats.coins-=i.cost; if(i.kind==='consumable')state.profile.stats.streakFreezes=(state.profile.stats.streakFreezes||0)+1; if(i.kind==='boost')state.profile.inventory.boosts.unshift({id:crypto.randomUUID(),multiplier:i.multiplier,durationMinutes:i.durationMinutes,used:false,reason:'Shop Purchase'}); if(i.kind==='chest')state.profile.inventory.chests.unshift({id:crypto.randomUUID(),type:i.chestType,opened:false,reason:'Shop Purchase'}); awardRawActivity({xp:0,coins:-i.cost,reason:`Purchased ${i.title}`,type:'Shop'}); saveProfileDebounced(); renderApp();},'Buy'); }
function openChest(id){ const c=state.profile.inventory.chests.find(x=>x.id===id); if(!c)return; const ranges={bronze:[20,60],silver:[55,120],gold:[110,240]}; const [min,max]=ranges[c.type]||ranges.bronze; const coins=rand(min,max), xp=rand(Math.round(min/2),Math.round(max/2)); c.opened=true;c.openedAt=new Date().toISOString(); award({xp,coins,reason:`Opened ${titleCase(c.type)} Chest`,type:'Chest'}); showChestModal(c.type,xp,coins); saveProfileDebounced(); renderApp(); }
function activateBoost(id){ const b=state.profile.inventory.boosts.find(x=>x.id===id); if(!b)return; b.used=true; b.activatedAt=new Date().toISOString(); b.endsAt=new Date(Date.now()+b.durationMinutes*60000).toISOString(); state.profile.activeBoost={...b}; showBoostModal(b); saveProfileDebounced(); renderApp(); }
function buyAvatar(id){ const i=AVATAR_ITEMS.find(x=>x.id===id); if(!i)return; if(levelInfo().level<i.unlockLevel)return toast('This item is still locked.','error'); if(state.profile.stats.coins<i.cost)return toast('Not enough Audit Coins.','error'); confirmModal(`Buy ${i.title}`,`Spend ${i.cost} Audit Coins?`,()=>{state.profile.stats.coins-=i.cost; state.profile.inventory.ownedItems.push(i.id); equipItem(i); awardRawActivity({xp:0,coins:-i.cost,reason:`Purchased Avatar Item: ${i.title}`,type:'Avatar'}); saveProfileDebounced(); renderApp();},'Buy And Equip'); }
function equipAvatar(id){ const i=AVATAR_ITEMS.find(x=>x.id===id); if(i){equipItem(i);saveProfileDebounced();renderApp();} }
function equipItem(i){ state.profile.inventory.equipped ||= {}; if(i.type==='baseColor') state.profile.inventory.equipped.baseColor=i.value; else state.profile.inventory.equipped[i.type]=i.value; state.previewAvatar=null; }
function previewEquip(i){ const base={...state.profile.inventory.equipped}; if(i.type==='baseColor') base.baseColor=i.value; else base[i.type]=i.value; return base; }
function isEquipped(i){ const eq=state.profile.inventory.equipped||{}; return i.type==='baseColor'?eq.baseColor===i.value:eq[i.type]===i.value; }
function showChestModal(type,xp,coins){ modal(`${titleCase(type)} Chest Opened`, `<div class="chest-open"><div class="chest-anim"><div class="glow"></div><div class="lid"></div><div class="base"></div></div><h3>+${xp} XP · +${coins} Audit Coins</h3></div>`,()=>{},'Awesome'); }
function showBoostModal(b){ modal('XP Boost Activated',`<div class="center"><div class="boost-anim">⚡</div><h3>${b.multiplier}x XP For ${b.durationMinutes} Minutes</h3></div>`,()=>{},'Let’s Go'); }

function renderProfile(){
  const settings=deepMerge(DEFAULT_REVIEW_SETTINGS,state.profile.preferences.studySettings||{});
  return `<div class="grid">
    <div class="panel" data-tour="profile-basics"><div class="section-head"><div><p class="eyebrow">Profile And Preferences</p><h3>Customize Your Setup</h3><p class="helper">These settings belong only to your account. Your Guild members can use different dates, timezones, themes, and review limits.</p></div></div><div class="form-grid"><label><span class="label-title">Display Name</span><input id="displayName" value="${escAttr(state.profile.displayName)}"></label><label><span class="label-title">Timezone</span><select id="timezoneSelect">${TIMEZONES.map(t=>`<option value="${t}" ${t===state.profile.timezone?'selected':''}>${t}</option>`).join('')}</select></label><label><span class="label-title">Theme</span><select id="prefTheme"><option value="dark" ${state.profile.preferences.theme==='dark'?'selected':''}>Dark</option><option value="light" ${state.profile.preferences.theme==='light'?'selected':''}>Light</option></select></label><label><span class="label-title">Default Study Duration</span><input id="prefDuration" type="number" min="5" max="240" value="${state.profile.preferences.defaultStudyDuration||60}"></label></div><button class="primary-button" id="saveProfile">Save Profile</button></div>
    <div class="panel" data-tour="review-settings"><div class="section-head"><div><p class="eyebrow">Adaptive Review Settings</p><h3>Control Your Daily Review Load</h3><p class="helper">ControlQuest uses a transparent Again / Hard / Good / Easy schedule. These limits decide how many new and due cards appear each day; they do not erase any cards.</p></div></div><div class="form-grid"><label><span class="label-title">New Cards Per Day</span><input id="studyNewCards" type="number" min="1" max="100" value="${settings.newCardsPerDay}"></label><label><span class="label-title">Maximum Reviews Per Day</span><input id="studyMaxReviews" type="number" min="5" max="500" value="${settings.maxReviewsPerDay}"></label><label><span class="label-title">Desired Retention</span><input id="studyRetention" type="number" min="75" max="99" value="${Math.round((settings.desiredRetention||.9)*100)}"><small class="helper">75%–99%; used as a planning target in analytics.</small></label><label><span class="label-title">Leech Warning Threshold</span><input id="studyLeech" type="number" min="3" max="30" value="${settings.leechThreshold||8}"><small class="helper">Cards missed this many times are flagged for special review.</small></label><label><span class="label-title">Learning Steps In Minutes</span><input id="studyLearningSteps" value="${escAttr((settings.learningStepsMinutes||[]).join(', '))}"><small class="helper">Example: 1, 10, 1440</small></label><label><span class="label-title">Relearning Steps In Minutes</span><input id="studyRelearningSteps" value="${escAttr((settings.relearningStepsMinutes||[]).join(', '))}"><small class="helper">Example: 10, 1440</small></label></div><button class="primary-button" id="saveReviewSettings">Save Review Settings</button></div>
    <div class="panel" data-tour="resource-links"><p class="eyebrow">External Tool Links</p><div class="form-grid"><label><span class="label-title">ISACA QAE / Learning Link</span><input id="linkQae" value="${escAttr(state.profile.preferences.links.qae||RESOURCE_LINKS.qae)}"></label><label><span class="label-title">Udemy Course Link</span><input id="linkUdemy" value="${escAttr(state.profile.preferences.links.udemy||RESOURCE_LINKS.udemy)}"></label><label><span class="label-title">Extra YouTube Resource Link</span><input id="linkYoutube" value="${escAttr(state.profile.preferences.links.youtubePlaylist||RESOURCE_LINKS.youtubePlaylist)}"></label></div><button class="primary-button" id="saveLinks">Save Links</button></div>
    <div class="panel" data-tour="profile-help"><p class="eyebrow">Help And Onboarding</p><div class="button-row wrap"><button class="secondary-button" id="redoOnboarding">Redo Onboarding Setup</button><button class="secondary-button" id="fullTour">Run Full Site Tour</button><button class="secondary-button" id="resetPageTours">Reset Page Help Tours</button></div></div>
    <div class="panel" data-tour="account-safety"><p class="eyebrow danger-text">Testing And Account Safety</p><div class="grid two"><div class="confirm-box"><h3>Reset Testing Stats</h3><p class="helper">Creates a backup, then resets XP, coins, activity, QAE logs, homework, roadmap progress, and rewards inventory. Your account, Study Library, and settings remain.</p><button class="danger-button" id="resetStats">Reset Stats</button></div><div class="confirm-box"><h3>Delete Profile Data</h3><p class="helper">Creates a backup under deletedProfiles, then deletes your ControlQuest profile document. Your Firebase Auth account may still exist.</p><button class="danger-button" id="deleteProfile">Delete Profile Data</button></div></div></div></div>`;
}
function parseMinuteSteps(value,label){
  const values=String(value||'').split(',').map(v=>Number(v.trim())).filter(Number.isFinite);
  if(!values.length||values.some(v=>v<1||v>43200)) throw new Error(`${label} must be comma-separated minutes between 1 and 43,200.`);
  return [...new Set(values.map(Math.round))];
}
function bindProfile(){
  $('#saveProfile')?.addEventListener('click',()=>{const dur=Number($('#prefDuration').value); if(!dur||dur<5||dur>240)return toast('Duration must be 5 to 240 minutes.','error'); state.profile.displayName=$('#displayName').value.trim()||state.profile.displayName; state.profile.timezone=$('#timezoneSelect').value; state.profile.preferences.theme=$('#prefTheme').value; state.profile.preferences.defaultStudyDuration=dur; applyTheme(); saveProfileDebounced(); renderApp();});
  $('#saveReviewSettings')?.addEventListener('click',()=>{try{const newCards=Number($('#studyNewCards').value),maxReviews=Number($('#studyMaxReviews').value),retention=Number($('#studyRetention').value),leech=Number($('#studyLeech').value);if(!Number.isInteger(newCards)||newCards<1||newCards>100)return toast('New Cards Per Day must be 1 to 100.','error');if(!Number.isInteger(maxReviews)||maxReviews<5||maxReviews>500)return toast('Maximum Reviews Per Day must be 5 to 500.','error');if(!Number.isFinite(retention)||retention<75||retention>99)return toast('Desired Retention must be 75% to 99%.','error');if(!Number.isInteger(leech)||leech<3||leech>30)return toast('Leech Warning Threshold must be 3 to 30.','error');state.profile.preferences.studySettings={...state.profile.preferences.studySettings,newCardsPerDay:newCards,maxReviewsPerDay:maxReviews,desiredRetention:retention/100,leechThreshold:leech,learningStepsMinutes:parseMinuteSteps($('#studyLearningSteps').value,'Learning Steps'),relearningStepsMinutes:parseMinuteSteps($('#studyRelearningSteps').value,'Relearning Steps')};saveProfileDebounced();toast('Adaptive Review settings saved.');renderApp();}catch(error){toast(error.message,'error');}});
  $('#saveLinks')?.addEventListener('click',()=>{state.profile.preferences.links.qae=$('#linkQae').value.trim()||RESOURCE_LINKS.qae; state.profile.preferences.links.udemy=$('#linkUdemy').value.trim(); state.profile.preferences.links.youtubePlaylist=$('#linkYoutube').value.trim()||RESOURCE_LINKS.youtubePlaylist; saveProfileDebounced(); toast('Links saved.');});
  $('#redoOnboarding')?.addEventListener('click',()=>showOnboarding()); $('#fullTour')?.addEventListener('click',()=>startFullTour()); $('#resetPageTours')?.addEventListener('click',()=>{state.profile.preferences.pageTours={};saveProfileDebounced();toast('Page tours reset.');}); $('#resetStats')?.addEventListener('click',()=>resetStatsFlow()); $('#deleteProfile')?.addEventListener('click',()=>deleteProfileFlow());
}

function bindView(){
  ({command:bindCommand,room:bindRoom,plan:bindPlan,practice:bindPractice,tools:bindTools,guild:bindGuild,calendar:bindCalendar,notebook:bindNotebook,rewards:bindRewards,profile:bindProfile}[state.activeView]||(()=>{}))();
}

function showOnboarding(){
  const p=state.profile; const settings=deepMerge(DEFAULT_REVIEW_SETTINGS,p.preferences.studySettings||{});
  modal('Welcome To ControlQuest Studio', `<div class="onboarding-intro"><div class="avatar small">${avatarSvg(p.inventory.equipped)}</div><div><p class="helper">Set up your personal CISA study system. These choices are private to your account and can be changed later in Profile.</p><strong>After setup, a responsive tour will highlight the exact buttons and sections you need.</strong></div></div>
    <h3>1. Account And Appearance</h3><div class="form-grid"><label><span class="label-title">Display Name</span><input id="obName" value="${escAttr(p.displayName)}"></label><label><span class="label-title">Theme Preference</span><select id="obTheme"><option value="dark" ${p.preferences.theme==='dark'?'selected':''}>Dark</option><option value="light" ${p.preferences.theme==='light'?'selected':''}>Light</option></select></label><label><span class="label-title">Timezone</span><select id="obTimezone">${TIMEZONES.map(t=>`<option value="${t}" ${t===p.timezone?'selected':''}>${t}</option>`).join('')}</select></label></div>
    <h3>2. Exam And Study Rhythm</h3><div class="form-grid"><label><span class="label-title">Start Date</span><input id="obStart" type="date" value="${p.roadmap.startDate||todayIso()}"></label><label><span class="label-title">Target Exam Date</span><input id="obExam" type="date" value="${p.roadmap.examDate||'2026-09-26'}"></label><label><span class="label-title">Default Session Length</span><input id="obDuration" type="number" min="5" max="240" value="${p.preferences.defaultStudyDuration||60}"></label><label><span class="label-title">Daily QAE Goal</span><input id="obGoal" type="number" min="1" max="150" value="${p.preferences.dailyQaeGoal||10}"></label><label><span class="label-title">Calendar Preference</span><select id="obCalendar"><option value="ics" ${p.preferences.calendarProvider==='ics'?'selected':''}>ICS Download / Invite Files</option><option value="google" ${p.preferences.calendarProvider==='google'?'selected':''}>Google Calendar OAuth</option><option value="apple" ${p.preferences.calendarProvider==='apple'?'selected':''}>Apple / iCalendar Import</option></select></label></div>
    <h3>3. Adaptive Review Load</h3><div class="form-grid"><label><span class="label-title">New Cards Per Day</span><input id="obNewCards" type="number" min="1" max="100" value="${settings.newCardsPerDay}"></label><label><span class="label-title">Maximum Reviews Per Day</span><input id="obMaxReviews" type="number" min="5" max="500" value="${settings.maxReviewsPerDay}"></label><label><span class="label-title">Desired Retention</span><input id="obRetention" type="number" min="75" max="99" value="${Math.round((settings.desiredRetention||.9)*100)}"></label></div>
    <h3>4. Optional Course Link</h3><label><span class="label-title">Udemy Course Link</span><input id="obUdemy" placeholder="Optional Udemy course link" value="${escAttr(p.preferences.links.udemy||'')}"></label>`, async()=>{
      const start=$('#obStart').value, exam=$('#obExam').value, dur=Number($('#obDuration').value), goal=Number($('#obGoal').value),newCards=Number($('#obNewCards').value),maxReviews=Number($('#obMaxReviews').value),retention=Number($('#obRetention').value);
      if(!start||!exam||parseLocal(start)>parseLocal(exam))return toast('Start Date must be on or before Target Exam Date.','error');
      if(!dur||dur<5||dur>240)return toast('Session length must be 5 to 240 minutes.','error');
      if(!goal||goal<1||goal>150)return toast('Daily QAE Goal must be 1 to 150.','error');
      if(!Number.isInteger(newCards)||newCards<1||newCards>100)return toast('New Cards Per Day must be 1 to 100.','error');
      if(!Number.isInteger(maxReviews)||maxReviews<5||maxReviews>500)return toast('Maximum Reviews Per Day must be 5 to 500.','error');
      if(!Number.isFinite(retention)||retention<75||retention>99)return toast('Desired Retention must be 75% to 99%.','error');
      p.displayName=$('#obName').value.trim()||p.displayName; p.preferences.theme=$('#obTheme').value; p.timezone=$('#obTimezone').value; p.roadmap.startDate=start; p.roadmap.examDate=exam; p.preferences.defaultStudyDuration=dur; p.preferences.dailyQaeGoal=goal; p.preferences.calendarProvider=$('#obCalendar').value; p.preferences.links.udemy=$('#obUdemy').value.trim(); p.preferences.studySettings={...settings,newCardsPerDay:newCards,maxReviewsPerDay:maxReviews,desiredRetention:retention/100}; p.preferences.onboardingComplete=true; p.preferences.pageTours ||= {}; await saveProfileDebounced(true); applyTheme(); renderApp(); setTimeout(()=>startTour('command',true),400);
    }, 'Start My Quest');
}

function startFullTour(){ const pages=['command','room','plan','practice','tools','guild','calendar','notebook','rewards','profile']; let idx=0; const next=()=>{ if(idx>=pages.length){toast('Full tour complete.');return;} state.activeView=pages[idx++]; renderApp(); setTimeout(()=>startTour(state.activeView,false,next),300);}; next(); }
function startTour(page,markComplete=false,after=null){ cleanupTour(); const steps=tourSteps(page); let idx=0; const show=()=>{ cleanupTour(); if(idx>=steps.length){ if(markComplete){ state.profile.preferences.pageTours ||= {}; state.profile.preferences.pageTours[page]=true; saveProfileDebounced(); } if(after) after(); return; } const step=steps[idx++]; const el=document.querySelector(`[data-tour="${step.target}"]`) || document.querySelector(step.selector||'body'); if(!el){show();return;} el.scrollIntoView({block:'center',inline:'center',behavior:'smooth'}); setTimeout(()=>positionTour(el,step,idx,steps.length,show,after),260);}; show(); state.tour={page,show}; window.addEventListener('resize',tourResize,{once:true}); }
function tourResize(){ if(state.tour) setTimeout(()=>startTour(state.tour.page,false),150); }
function positionTour(el,step,idx,total,next,after){ const r=el.getBoundingClientRect(); const hi=document.createElement('div'); hi.className='tour-highlight'; const pad=8; hi.style.left=`${Math.max(8,r.left-pad)}px`; hi.style.top=`${Math.max(8,r.top-pad)}px`; hi.style.width=`${Math.min(innerWidth-16,r.width+pad*2)}px`; hi.style.height=`${Math.min(innerHeight-16,r.height+pad*2)}px`; const card=document.createElement('div'); card.className='tour-card'; const width=Math.min(390,innerWidth-32); let left=Math.min(innerWidth-width-16,Math.max(16,r.left)); let top=(r.bottom+16<innerHeight-190)?r.bottom+16:r.top-210; top=Math.min(innerHeight-190,Math.max(16,top)); card.style.left=`${left}px`; card.style.top=`${top}px`; card.innerHTML=`<p class="eyebrow">${pageTitle()} Help</p><h3>${idx} / ${total}: ${esc(step.title)}</h3><p>${esc(step.text)}</p><div class="button-row spaced"><button class="text-button tour-skip" data-tour-close>Close</button><button class="primary-button" data-tour-next>${idx===total?'Finish':'Next'}</button></div>`; document.body.append(hi,card); $('[data-tour-close]',card).onclick=()=>{cleanupTour(); if(after)after();}; $('[data-tour-next]',card).onclick=next; }
function cleanupTour(){ $$('.tour-highlight,.tour-card').forEach(x=>x.remove()); }
function tourSteps(page){ const map={
  command:[['hero','Today’s Mission','Start here each day. This card points you to the right next action without forcing you to hunt through tabs.'],['kpis','KPI Strip','These are your top learning metrics: XP, Audit Coins, Streak, QAE Accuracy, and Roadmap progress.'],['daily-quests','Daily Quests','Complete all three Daily Quests to protect your weekday streak. These are intentionally harder to fake out.'],['progress-engine','Progress Engine','See XP progress, total XP, next level requirements, and recent reward activity.'],['guild-snapshot','Guild Snapshot','This shows high-level Guild progress only, not everyone’s private notes.'],['catch-up','Catch-Up Compass','Overdue homework and missed work show up here so you know exactly how to recover.']],
  room:[['room-timer','Live Timer','Start, pause, reset, and complete a synced Guild study session. Completing less time earns fewer rewards.'],['session-flow','Session Flow','Use these linked checkpoints to run your 7–8 AM meeting. The links jump to ISACA, videos, notes, or other pages.'],['homework-builder','Homework Builder','Pick suggested homework or add custom homework. Selected homework carries due dates and reward values.'],['shared-notes','Guild Session Notes','Shared notes can be saved into the Guild Notebook so both partners can find them later.']],
  plan:[['plan-controls','Adaptive Controls','Start date, exam date, pause blocks, and bonus sessions recalculate the plan.'],['calendar','Calendar Days','Open weeks and days to see lesson tasks, links, and task completion checkboxes.']],
  practice:[['qae-summary','QAE Summary','Log official ISACA QAE results here after practicing on ISACA. This adds trends and rewards.']],
  tools:[['memory-decks','Learning Library','This is the home for every imported lesson deck, your Master QAE Question Bank, and your Master Missed Questions deck. Choose a tab to study by adaptive review, flashcard, quiz, Guild, game, or analytics mode.'],['memory-decks','Automatic Deck Creation','Every valid QAE import creates its own lesson deck and links each unique question into the appropriate Master decks automatically. Duplicate questions are not duplicated in the Master bank.'],['memory-decks','Adaptive Review','Again, Hard, Good, and Easy ratings schedule each card independently. Missed, overdue, and lapsed questions return sooner.'],['memory-decks','Guild Study','Guild mode shows the same question to every connected member while keeping each person’s answer and review history separate.'],['memory-decks','Analytics','Analytics count actual reviews, accuracy, lapses, due cards, and mastery instead of awarding progress simply for opening a deck.']],
  guild:[['guild-home','Guild Home','Create or join Guilds and compare high-level progress with study buddies.']],
  calendar:[['calendar','Calendar','Create Personal, Guild, or Both events. You can export ICS or connect Google Calendar if configured.']],
  notebook:[['calendar','Notebook','Save Personal, Guild, or Public notes. Study Room shared notes flow here.']],
  rewards:[['calendar','Rewards','Use Audit Coins, open chests, activate boosts, and customize your avatar.']],
  profile:[['calendar','Profile','Manage preferences, timezone, external links, onboarding, and safe reset/delete options.']]
}; return (map[page]||map.command).map(([target,title,text])=>({target,title,text})); }

function award({xp=0,coins=0,reason='Reward',type='Activity'}={}){ const boost=activeBoost(); if(boost && xp>0) xp=Math.round(xp*boost.multiplier); const before=levelInfo().level; state.profile.stats.xp=(state.profile.stats.xp||0)+xp; state.profile.stats.coins=(state.profile.stats.coins||0)+coins; awardRawActivity({xp,coins,reason,type}); const after=levelInfo().level; showXpPop(xp,coins,reason); if(after>before){ unlockForLevel(after); showCelebration(`Level ${after} Reached`, `You unlocked new rewards. Check Rewards for avatar items and inventory.`); } }
function awardRawActivity({xp=0,coins=0,reason='Activity',type='Activity'}={}){ state.profile.activity ||= []; state.profile.activity.unshift({id:crypto.randomUUID(),date:new Date().toISOString(),type,reason,xp,coins,level:levelInfo().level}); state.profile.activity=state.profile.activity.slice(0,200); }
function unlockForLevel(level){ if(level%3===0) state.profile.inventory.chests.unshift({id:crypto.randomUUID(),type:level>=6?'silver':'bronze',opened:false,reason:`Level ${level} Reward`}); if(level%4===0) state.profile.inventory.boosts.unshift({id:crypto.randomUUID(),multiplier:1.5,durationMinutes:30,used:false,reason:`Level ${level} Reward`}); }
function maybeAddChest(type='bronze',chance=.1){ if(Math.random()<chance) state.profile.inventory.chests.unshift({id:crypto.randomUUID(),type,opened:false,reason:'Bonus Drop'}); }
function activeBoost(){ const b=state.profile?.activeBoost; if(!b || !b.endsAt) return null; if(new Date(b.endsAt)<=new Date()){ state.profile.activeBoost=null; saveProfileDebounced(); return null; } return b; }
function boostRemainingText(b){ const ms=new Date(b.endsAt)-new Date(); const mins=Math.max(0,Math.ceil(ms/60000)); return `${mins} Min Left`; }
function activityItem(a){ const iconName=a.type==='QAE'?'qae':a.type==='Chest'?'chest-gold':a.type==='Shop'?'coin':a.type==='Streak'?'streak':a.type==='Notebook'?'notebook':a.type==='Arcade'?'arcade':'xp'; return `<div class="activity-item"><span class="app-icon ${iconName}">${svgIcon(iconName)}</span><div><strong>${esc(a.reason||'Activity')}</strong><small>${titleCase(a.type||'Activity')} · ${fmtDateTime(a.date)}</small></div><div class="gain">${a.xp?`+${a.xp} XP`:''}${a.coins?` ${a.coins>0?'+':''}${a.coins} Coins`:''}</div></div>`; }
function showXpPop(xp,coins,reason){ if(!xp && !coins)return; const el=document.createElement('div'); el.className='xp-pop'; el.innerHTML=`${xp?`+${xp} XP`:''}${xp&&coins?' · ':''}${coins?`${coins>0?'+':''}${coins} Coins`:''}<br><small>${esc(reason)}</small>`; document.body.appendChild(el); confetti(16); setTimeout(()=>el.remove(),1900); }
function showCelebration(title,msg,onConfirm=()=>{},confirmLabel='Celebrate'){ confetti(55); modal(title,`<div class="level-pop"><div class="avatar small">${avatarSvg(state.profile.inventory.equipped)}</div><h3>${esc(msg)}</h3></div>`,onConfirm,confirmLabel); }
function confetti(n=24){ for(let i=0;i<n;i++){const el=document.createElement('i'); el.className='confetti'; el.style.left=Math.random()*100+'vw'; el.style.background=`hsl(${Math.random()*360},80%,60%)`; el.style.animationDelay=Math.random()*.25+'s'; document.body.appendChild(el); setTimeout(()=>el.remove(),1800);} }

async function saveAll({group=false}={}){ await saveProfileDebounced(true); if(state.profile?.activeGroupId) await updateMemberSummary(state.profile.activeGroupId,state.profile); if(group && state.group) await saveGroup(state.group); }
let saveTimer; async function saveProfileDebounced(immediate=false){ if(!state.profile)return; if(immediate){ await saveProfile(state.profile); if(state.profile.activeGroupId) await updateMemberSummary(state.profile.activeGroupId,state.profile); return; } clearTimeout(saveTimer); saveTimer=setTimeout(async()=>{await saveProfile(state.profile); if(state.profile.activeGroupId) await updateMemberSummary(state.profile.activeGroupId,state.profile);},450); }

async function resetStatsFlow(){
  await confirmModal('Reset Testing Stats','This creates a backup before reset. Continue?',async()=>{
    await confirmModal('Confirm Reset Again','This will clear XP, coins, activity, QAE logs, homework, roadmap progress, rewards, and inventory. Type RESET on the next screen if you still want this.',async()=>{
      modal('Final Reset Confirmation',`<div class="confirm-box"><p>Type <strong>RESET</strong> to reset testing stats.</p><input id="resetWord" placeholder="RESET"></div>`,async()=>{ if($('#resetWord').value!=='RESET')return toast('Reset cancelled. Type RESET exactly.','error'); await backupProfile(state.profile,'Stats Reset Backup'); const keep={uid:state.profile.uid,email:state.profile.email,displayName:state.profile.displayName,timezone:state.profile.timezone,preferences:state.profile.preferences,guildIds:state.profile.guildIds,activeGroupId:state.profile.activeGroupId,createdAt:state.profile.createdAt}; state.profile=deepMerge(defaultProfile(state.user),keep); state.profile.preferences.onboardingComplete=true; await saveProfileDebounced(true); renderApp(); toast('Testing stats reset with backup created.');},'Reset Stats');
    });
  });
}
async function deleteProfileFlow(){
  await confirmModal('Delete Profile Data','This creates a backup first, then deletes your ControlQuest profile data. Continue?',async()=>{
    modal('Final Delete Confirmation',`<div class="confirm-box"><p>Type <strong>DELETE MY PROFILE</strong> to delete profile data.</p><input id="deleteWord" placeholder="DELETE MY PROFILE"></div>`,async()=>{ if($('#deleteWord').value!=='DELETE MY PROFILE')return toast('Delete cancelled.','error'); await deleteProfileData(state.profile); await signOutUser();},'Delete Profile');
  });
}

function avatarSvg(eq={}){
  const color=eq.baseColor||'#2fb7ff', cape=eq.cape||'none', glasses=eq.glasses||'round', eyes=eq.eyes||'normal', hat=eq.hat||'none', badge=eq.badge||'none';
  const mood = eyes==='star'?'victory':eyes==='focus'?'locked-in':'focused';
  const smile=mood==='victory'?'M64 109c15 17 38 17 53 0':mood==='locked-in'?'M70 112h40':'M67 112c12 10 34 10 46 0';
  const capeColor=cape==='gold'?'#ffd166':cape==='night'?'#1b2552':cape==='emerald'?'#18c29c':cape==='blue'?'#00a7ff':'transparent';
  const capePath=cape==='none'?'':`<path d="M42 70 C20 86 18 112 35 132 C52 115 73 112 90 132 C107 112 128 115 145 132 C162 112 160 86 138 70 Z" fill="${capeColor}" opacity=".86"/><path d="M47 72 C65 82 115 82 133 72" stroke="#fff" stroke-width="5" opacity=".45" fill="none"/>`;
  const eyeEl=eyes==='star'?`<path d="M58 48l4 9 10 1-8 6 3 10-9-5-9 5 3-10-8-6 10-1 4-9Zm44 0l4 9 10 1-8 6 3 10-9-5-9 5 3-10-8-6 10-1 4-9Z" fill="#ffd166"/>`:eyes==='focus'?`<path d="M50 64h24M86 64h24" stroke="#14213d" stroke-width="8" stroke-linecap="round"/>`:`<circle cx="62" cy="67" r="10" fill="#16213e"/><circle cx="98" cy="67" r="10" fill="#16213e"/><circle cx="58" cy="62" r="3" fill="#fff"/><circle cx="94" cy="62" r="3" fill="#fff"/>`;
  const glassEl=glasses==='shield'?`<path d="M43 55h38l-6 23H49l-6-23Zm56 0h38l-6 23h-26l-6-23Z" fill="#111827" opacity=".92"/><path d="M80 61h19" stroke="#111827" stroke-width="5"/>`:glasses==='round'?`<circle cx="62" cy="64" r="19" fill="none" stroke="#14213d" stroke-width="5"/><circle cx="98" cy="64" r="19" fill="none" stroke="#14213d" stroke-width="5"/><path d="M81 64h-2" stroke="#14213d" stroke-width="5"/>`:'';
  const hatEl=hat==='crown'?`<path d="M52 35l13-14 15 17 17-17 14 14v15H52V35Z" fill="#ffd166" stroke="#fff" stroke-width="4"/>`:hat==='grad'?`<path d="M48 37l42-18 42 18-42 18Z" fill="#14213d"/><path d="M68 50h44v16c-11 8-33 8-44 0Z" fill="#14213d"/><path d="M132 37v27" stroke="#ffd166" stroke-width="5"/>`:hat==='headset'?`<path d="M45 70c0-32 20-49 45-49s45 17 45 49" fill="none" stroke="#14213d" stroke-width="8" stroke-linecap="round"/><rect x="36" y="70" width="18" height="28" rx="8" fill="#14213d"/><rect x="126" y="70" width="18" height="28" rx="8" fill="#14213d"/>`:'';
  const badgeEl=badge==='cisa'?`<circle cx="126" cy="114" r="15" fill="#ffd166" stroke="#fff" stroke-width="4"/><text x="126" y="119" text-anchor="middle" font-size="13" font-weight="900" fill="#14213d">C</text>`:badge==='fire'?`<path d="M126 132c9-3 13-9 13-17 0-8-6-13-10-18 1 8-4 10-8 15-1-4-3-6-6-8 1 6-5 10-5 17 1 8 7 12 16 11Z" fill="#ff5c8a" stroke="#fff" stroke-width="3"/>`:badge==='coffee'?`<rect x="115" y="98" width="20" height="22" rx="5" fill="#fff"/><path d="M135 103c10 1 10 12 0 13" fill="none" stroke="#fff" stroke-width="5"/><path d="M120 95c0-8 8-8 8-16" stroke="#fff" stroke-width="4" stroke-linecap="round" opacity=".75"/>`:'';
  return `<svg class="avatar-svg" viewBox="0 0 180 180" aria-label="User avatar" role="img"><defs><filter id="avShadow" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy="10" stdDeviation="8" flood-color="#111827" flood-opacity=".22"/></filter></defs>${capePath}<circle cx="90" cy="90" r="72" fill="${color}" filter="url(#avShadow)"/><path d="M42 88c-15-8-23-23-21-41 22 4 39 18 44 42-8 5-16 4-23-1ZM138 88c15-8 23-23 21-41-22 4-39 18-44 42 8 5 16 4 23-1Z" fill="#fff" opacity=".22"/><ellipse cx="62" cy="65" rx="26" ry="28" fill="#fff"/><ellipse cx="98" cy="65" rx="26" ry="28" fill="#fff"/>${eyeEl}${glassEl}<path d="M84 87h12l-6 10-6-10Z" fill="#ffb347"/><path d="${smile}" fill="none" stroke="#fff" stroke-width="6" stroke-linecap="round" opacity=".9"/>${hatEl}${badgeEl}</svg>`;
}
function eyeSvg(eyes){ if(eyes==='star')return `<path d="M76 64l4 8 9 1-7 6 2 9-8-5-8 5 2-9-7-6 9-1z" fill="#14213d"/><path d="M124 64l4 8 9 1-7 6 2 9-8-5-8 5 2-9-7-6 9-1z" fill="#14213d"/>`; if(eyes==='focus')return `<path d="M66 72h20M114 72h20" stroke="#14213d" stroke-width="9" stroke-linecap="round"/>`; return `<circle cx="76" cy="76" r="8" fill="#14213d"/><circle cx="124" cy="76" r="8" fill="#14213d"/>`; }
function glassesSvg(g){ if(g==='round')return `<circle cx="76" cy="76" r="18" fill="none" stroke="#14213d" stroke-width="5"/><circle cx="124" cy="76" r="18" fill="none" stroke="#14213d" stroke-width="5"/><path d="M94 76h12" stroke="#14213d" stroke-width="5"/>`; if(g==='shield')return `<path d="M56 60h40l-8 34H64zM104 60h40l-8 34h-24z" fill="rgba(20,33,61,.35)" stroke="#14213d" stroke-width="4"/><path d="M96 72h8" stroke="#14213d" stroke-width="5"/>`; return ''; }
function hatSvg(h){ if(h==='grad')return `<path d="M52 42l48-22 48 22-48 20z" fill="#14213d"/><path d="M77 57h46v20c-12 8-34 8-46 0z" fill="#14213d"/><path d="M148 42v28" stroke="#ffd166" stroke-width="5"/><circle cx="148" cy="73" r="5" fill="#ffd166"/>`; if(h==='crown')return `<path d="M60 48l18-24 22 24 22-24 18 24v18H60z" fill="#ffd166" stroke="#ff8c2a" stroke-width="4"/>`; return ''; }
function badgeSvg(b){ if(b==='cisa')return `<circle cx="140" cy="124" r="16" fill="#ffd166" stroke="#fff" stroke-width="4"/><text x="140" y="129" text-anchor="middle" font-size="13" font-weight="900" fill="#14213d">C</text>`; if(b==='fire')return `<path d="M140 140c10-3 15-10 14-19 0-8-6-13-10-18 1 8-4 10-8 15-1-4-3-6-6-8 1 6-5 10-5 17 1 8 7 13 15 13Z" fill="#ff5c8a" stroke="#fff" stroke-width="3"/>`; return ''; }

function svgIcon(name){ const p={home:'<path d="M10 31L32 12l22 19v23H39V39H25v15H10z" fill="white"/>',timer:'<circle cx="32" cy="34" r="20" fill="none" stroke="white" stroke-width="6"/><path d="M32 34V22M32 34l9 6M24 8h16" stroke="white" stroke-width="6" stroke-linecap="round"/>',roadmap:'<path d="M13 14h38v9H13zm0 14h28v9H13zm0 14h38v9H13z" fill="white"/>',qae:'<circle cx="32" cy="32" r="24" fill="none" stroke="white" stroke-width="6"/><path d="M23 32l6 6 13-15" stroke="white" stroke-width="6" fill="none" stroke-linecap="round"/>',arcade:'<rect x="12" y="22" width="40" height="28" rx="10" fill="white"/><path d="M22 36h12M28 30v12" stroke="#7c4dff" stroke-width="5" stroke-linecap="round"/><circle cx="42" cy="34" r="3" fill="#7c4dff"/><circle cx="48" cy="40" r="3" fill="#7c4dff"/>',guild:'<path d="M32 9l22 13v22L32 56 10 44V22z" fill="white"/><circle cx="32" cy="29" r="8" fill="#7c4dff"/><path d="M20 44c5-10 19-10 24 0" fill="#7c4dff"/>',calendar:'<rect x="12" y="16" width="40" height="36" rx="5" fill="white"/><path d="M12 26h40" stroke="#7c4dff" stroke-width="5"/><path d="M22 10v12M42 10v12" stroke="white" stroke-width="5" stroke-linecap="round"/>',notebook:'<rect x="16" y="10" width="36" height="44" rx="5" fill="white"/><path d="M24 22h18M24 32h18M24 42h10" stroke="#7c4dff" stroke-width="5" stroke-linecap="round"/>',coin:'<circle cx="32" cy="32" r="24" fill="white"/><path d="M24 26c2-5 14-5 16 0 2 6-16 4-14 11 2 6 15 5 17-1M32 17v30" stroke="#ff9f1c" stroke-width="5" stroke-linecap="round" fill="none"/>',streak:'<path d="M34 58c12-3 19-12 19-24 0-13-9-21-15-28 1 13-6 15-12 24-1-6-4-10-8-13 0 7-7 13-7 23 0 11 10 19 23 18Z" fill="white"/>',freeze:'<path d="M32 8v48M12 20l40 24M52 20L12 44M20 12l24 40M44 12L20 52" stroke="white" stroke-width="5" stroke-linecap="round"/>',target:'<circle cx="32" cy="32" r="24" fill="none" stroke="white" stroke-width="5"/><circle cx="32" cy="32" r="12" fill="none" stroke="white" stroke-width="5"/><circle cx="32" cy="32" r="4" fill="white"/>',xp:'<path d="M32 6l8 17h18L44 35l5 19-17-10-17 10 5-19L6 23h18z" fill="white"/>',cards:'<rect x="14" y="18" width="28" height="34" rx="5" fill="white"/><rect x="24" y="12" width="28" height="34" rx="5" fill="white" opacity=".7"/>','chest-bronze':'<rect x="10" y="24" width="44" height="28" rx="6" fill="white"/><path d="M14 24c1-9 8-14 18-14s17 5 18 14" fill="none" stroke="white" stroke-width="6"/><rect x="27" y="30" width="10" height="12" rx="2" fill="#cd7f32"/>','chest-silver':'<rect x="10" y="24" width="44" height="28" rx="6" fill="white"/><path d="M14 24c1-9 8-14 18-14s17 5 18 14" fill="none" stroke="white" stroke-width="6"/><rect x="27" y="30" width="10" height="12" rx="2" fill="#9aa6b2"/>','chest-gold':'<rect x="10" y="24" width="44" height="28" rx="6" fill="white"/><path d="M14 24c1-9 8-14 18-14s17 5 18 14" fill="none" stroke="white" stroke-width="6"/><rect x="27" y="30" width="10" height="12" rx="2" fill="#ffd166"/>',boost:'<path d="M34 6L12 36h17l-4 22 27-34H36z" fill="white"/>',audit:'<rect x="14" y="10" width="36" height="44" rx="6" fill="white"/><path d="M23 24h18M23 34h18M23 44h10" stroke="#7c4dff" stroke-width="5" stroke-linecap="round"/>'}; return `<svg viewBox="0 0 64 64" aria-hidden="true">${p[name]||p.xp}</svg>`; }

function startClock(){ clearInterval(state.clockInterval); state.clockInterval=setInterval(()=>{ const el=$('#topClock'); if(el)el.textContent=formatTimeNow(); const b=$('#boostChip small'); if(b&&activeBoost()) b.textContent=boostRemainingText(activeBoost()); },1000); }
function startTimerTicker(){ clearInterval(state.timerInterval); state.timerInterval=setInterval(()=>{ const s=state.group?.liveSession; if(!s)return; const elapsed=timerSeconds(s), total=(s.durationMinutes||60)*60, rem=Math.max(0,total-elapsed), pct=Math.min(100,Math.round(elapsed/Math.max(1,total)*100)); const t=$('#timerText'), o=$('#timerOrb'), bar=$('#timerBar'); if(t)t.textContent=fmtTime(rem); if(o)o.style.setProperty('--timer-progress',pct+'%'); if(bar)bar.style.width=pct+'%'; },1000); }
function timerSeconds(s){ if(!s)return 0; let sec=s.accumulatedSeconds||0; if(s.active&&s.startedAt)sec+=Math.floor((Date.now()-new Date(s.startedAt).getTime())/1000); return sec; }
function fmtTime(sec){ const m=Math.floor(sec/60),s=sec%60; return `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`; }
function formatTimeNow(){ try{return new Intl.DateTimeFormat('en-US',{hour:'numeric',minute:'2-digit',second:'2-digit',timeZone:state.profile?.timezone}).format(new Date());}catch{return new Date().toLocaleTimeString();} }
function localDateForProfile(){ try{ const fmt=new Intl.DateTimeFormat('en-CA',{timeZone:state.profile.timezone,year:'numeric',month:'2-digit',day:'2-digit'}); return fmt.format(new Date()); }catch{return todayIso();} }
function levelInfo(){ const xp=state.profile?.stats?.xp||0; const level=Math.max(1,Math.floor(Math.sqrt(xp/100))+1); const prev=(level-1)**2*100, next=level**2*100; return {level,current:xp-prev,next:next-prev,progress:(xp-prev)/(next-prev)}; }
function qaeAccuracy(){ const t=state.profile?.stats?.qaeQuestions||0; return t?Math.round((state.profile.stats.qaeCorrect||0)/t*100):0; }
function titleCase(s=''){ return String(s).replace(/[-_]/g,' ').replace(/\b\w/g,c=>c.toUpperCase()); }
function esc(s=''){ return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); } function escAttr(s=''){return esc(s);}
function friendly(e){ return e?.message || String(e); }
function pick(a){ return a[Math.floor(Math.random()*a.length)]; } function rand(min,max){return Math.floor(Math.random()*(max-min+1))+min;} function slug(s){return String(s).toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,50);} function safeFile(s){return String(s).replace(/[^a-z0-9-_]+/gi,'_').slice(0,60)||'note';}
function parseLocal(iso){ if(!iso)return null; const [y,m,d]=iso.slice(0,10).split('-').map(Number); return new Date(y,m-1,d); }
function dateIso(d){ return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; }
function startOfWeek(d){ const x=new Date(d); x.setDate(x.getDate()-x.getDay()); x.setHours(0,0,0,0); return x; }
function shiftDate(iso,n){ const d=parseLocal(iso); d.setDate(d.getDate()+n); return dateIso(d); }
function fmtDate(iso){ if(!iso)return ''; const d=typeof iso==='string'?parseLocal(iso.slice(0,10)):iso; return new Intl.DateTimeFormat('en-US',{month:'short',day:'numeric',year:'numeric'}).format(d); }
function fmtDateTime(iso){ if(!iso)return ''; return new Intl.DateTimeFormat('en-US',{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}).format(new Date(iso)); }
function toLocalInput(iso){ if(!iso)return ''; const d=new Date(iso); const off=d.getTimezoneOffset(); return new Date(d.getTime()-off*60000).toISOString().slice(0,16); }
function upsert(arr=[],item){ const i=arr.findIndex(x=>x.id===item.id); if(i>=0) arr[i]=item; else arr.unshift(item); return arr; }
function toggleSet(set,val){ set.has(val)?set.delete(val):set.add(val); }
function ensureGroupLocal(){ if(!state.group) state.group=defaultGroup(state.profile,'My Study Guild'); }
function markdownPreview(text){ return esc(text).replace(/^# (.*)$/gm,'<h2>$1</h2>').replace(/\n/g,'<br>'); }
function downloadText(filename,text,type='text/plain'){ const blob=new Blob([text],{type}); const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download=filename; a.click(); URL.revokeObjectURL(url); }
function modal(title,body,onOk,ok='Save',extra=''){ const wrap=document.createElement('div'); wrap.className='modal-backdrop'; wrap.innerHTML=`<div class="modal-card"><h2>${esc(title)}</h2>${body}<div class="button-row spaced" style="margin-top:16px"><div class="button-row">${extra}</div><div class="button-row"><button class="secondary-button" data-cancel>Cancel</button><button class="primary-button" data-ok>${ok}</button></div></div></div>`; document.body.append(wrap); $('[data-cancel]',wrap).onclick=()=>wrap.remove(); $('[data-ok]',wrap).onclick=async()=>{ await onOk?.(); wrap.remove();}; }
function confirmModal(title,message,onOk,ok='Continue'){ return new Promise(resolve=>{ modal(title,`<div class="confirm-box"><p>${message}</p></div>`,async()=>{ await onOk?.(); resolve(true); },ok); }); }
function toast(message,type='success'){ let layer=$('#toastLayer'); if(!layer){layer=document.createElement('div');layer.id='toastLayer';layer.className='toast-layer';document.body.appendChild(layer);} const el=document.createElement('div');el.className=`toast ${type}`;el.textContent=message;layer.appendChild(el);setTimeout(()=>el.remove(),3900); }
function applyTheme(){ document.documentElement.dataset.theme=state.profile?.preferences?.theme || 'dark'; }

// Event delegation after each render. This avoids missing dynamically-created buttons.
const originalRenderView = renderView;
setInterval(()=>{ const boost=activeBoost(); const chip=$('#boostChip small'); if(chip&&boost)chip.textContent=boostRemainingText(boost); },30000);
