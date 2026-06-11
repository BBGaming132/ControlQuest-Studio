import { initFirebase, onAuth, signIn, createAccount, sendReset, signOutUser, loadProfile, saveProfile, backupProfile, deleteProfileData, createGroup, loadGroup, saveGroup, updateMemberSummary, subscribeGroup, publicSummary, isFirebaseReady } from './firebase-service.js';
import { RESOURCE_LINKS, TIMEZONES, DOMAIN_TOPICS, ISACA_STUDY_PLAN, CISA_RULES, DECISION_PROMPTS, HOMEWORK_SUGGESTIONS, DAILY_QUEST_TEMPLATES, SHOP_ITEMS, AVATAR_ITEMS, GAME_CATALOG } from './content.js';
import { parseQaePaste, missedConceptFromParsedQuestion, flashcardFromParsedMiss } from './qae-parser.js';
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
  lastScrollTop: 0
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
    preferences:{theme:'dark',onboardingComplete:false,pageTours:{},defaultStudyDuration:60,dailyQaeGoal:10,calendarProvider:'ics',googleConnected:false,links:{qae:RESOURCE_LINKS.qae,udemy:'',youtubePlaylist:RESOURCE_LINKS.youtubePlaylist}},
    stats:{xp:0,coins:0,streak:0,bestStreak:0,streakFreezes:1,qaeQuestions:0,qaeCorrect:0,studyMinutes:0,sessions:0,roadmapPct:0,lastQuestDate:null,lastStreakDate:null},
    inventory:{boosts:[],chests:[],ownedItems:['base-blue','eyes-normal','glasses-none','cape-none','hat-none','badge-none'],equipped:{baseColor:'#2fb7ff',eyes:'normal',glasses:'none',cape:'none',hat:'none',badge:'none'}},
    activity:[],daily:{date:todayIso(),quests:{}},qaeLogs:[],mistakes:[],missedQuestions:[],questionBank:[],qaeImports:[],homework:[],notes:[],memoryDecks:starterDecks(),calendarEvents:[],roadmap:{startDate:todayIso(),examDate:'2026-09-26',pauseBlocks:[],bonusSessions:[],completedTasks:{}},guildIds:[],activeGroupId:null
  };
}

function migrateProfile(p,user){
  const base = defaultProfile(user);
  const m = deepMerge(base,p||{});
  m.uid = user.uid; m.email = user.email || m.email;
  m.preferences.links ||= {}; m.preferences.links.qae ||= RESOURCE_LINKS.qae; m.preferences.links.udemy ||= RESOURCE_LINKS.udemy; m.preferences.links.youtubePlaylist ||= RESOURCE_LINKS.youtubePlaylist;
  m.stats.streakFreezes ??= 1; m.inventory.ownedItems ||= base.inventory.ownedItems; m.inventory.equipped ||= base.inventory.equipped;
  m.daily ||= {date:todayIso(),quests:{}}; if(m.daily.date !== todayIso()) m.daily = {date:todayIso(),quests:{}};
  m.activity ||= []; m.qaeLogs ||= []; m.mistakes ||= []; m.missedQuestions ||= []; m.questionBank ||= []; m.qaeImports ||= []; m.homework ||= []; m.notes ||= []; m.memoryDecks ||= starterDecks(); m.calendarEvents ||= [];
  m.roadmap ||= base.roadmap; m.roadmap.pauseBlocks ||= []; m.roadmap.bonusSessions ||= []; m.roadmap.completedTasks ||= {};
  return m;
}

function deepMerge(a,b){ const out={...a}; for(const [k,v] of Object.entries(b||{})){ if(v && typeof v==='object' && !Array.isArray(v) && a[k] && typeof a[k]==='object' && !Array.isArray(a[k])) out[k]=deepMerge(a[k],v); else out[k]=v; } return out; }

function starterDecks(){
  return [
    {id:'public-cisa-audit-mindset',scope:'Public',title:'CISA Audit Mindset Starters',description:'Original starter flashcards for CISA answer logic, not copied from ISACA QAE.',createdAt:new Date().toISOString(),updatedAt:new Date().toISOString(),cards:[
      {front:'What does FIRST usually test?',back:'Sequence. Identify the logical prerequisite before action, recommendation, or escalation.'},
      {front:'Who owns risk and controls?',back:'Management owns risk and controls. Auditors provide assurance and recommendations.'},
      {front:'What makes evidence useful?',back:'Evidence should be sufficient, reliable, relevant, and support the audit conclusion.'},
      {front:'What should happen before recommending a fix?',back:'Validate the issue, understand cause and impact, and confirm evidence supports the finding.'}
    ]},
    {id:'public-bcp-dr',scope:'Public',title:'BCP / DR Core Terms',description:'Recovery and resilience terms that show up across operations and resilience work.',createdAt:new Date().toISOString(),updatedAt:new Date().toISOString(),cards:[
      {front:'BIA',back:'Business Impact Analysis identifies critical processes and recovery priorities.'},
      {front:'RTO',back:'Recovery Time Objective is the target time to restore a process or system.'},
      {front:'RPO',back:'Recovery Point Objective is the acceptable amount of data loss measured in time.'},
      {front:'Best proof backups work?',back:'Successful restoration testing, not only a completed backup job.'}
    ]}
  ];
}


function defaultGroup(ownerProfile, name='Study Guild'){
  const id = slug(`${name}-${Math.random().toString(36).slice(2,7)}`);
  return {id,name,code:Math.random().toString(36).slice(2,8).toUpperCase(),icon:'guild',color:'#7c4dff',ownerUid:ownerProfile.uid,createdAt:new Date().toISOString(),members:{[ownerProfile.uid]:publicSummary(ownerProfile)},events:[],liveSession:defaultLiveSession(ownerProfile),sessionStats:{completed:0,minutes:0,streak:0,lastDate:null},notes:[],questionBank:[]};
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
  if(state.group && isFirebaseReady()) state.groupUnsub = subscribeGroup(groupId, g=>{ state.group = g; renderIfApp(); });
}

function renderAuth(){
  app.className = 'auth-shell';
  app.innerHTML = `
    <div class="auth-card">
      <div class="auth-visual">
        <div class="avatar big">${avatarSvg(defaultProfile({uid:'x',email:'guest@controlquest.local'}).inventory.equipped)}</div>
        <p class="eyebrow">Gamified CISA Study Companion</p>
        <h1>Master The Audit Mindset.</h1>
        <p>Use ControlQuest as the fun layer on top of ISACA QAE, videos, Quizlet, Goodnotes, calendars, and your study group.</p>
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
function lessonTasks(topic,iso){ return [
  {id:`${iso}-qae`,title:`QAE Practice: ${topic.topic}`,details:`Primary Work: ${topic.domain} · ${topic.name}. ISACA lists this topic as ${topic.knowledgePoints || '?'} knowledge points and ${topic.time || 'variable'} estimated time. Target ${state.profile.preferences.dailyQaeGoal||10} QAE questions, then log the block.`,links:[{label:'Open ISACA QAE',url:RESOURCE_LINKS.qae},{label:'Log QAE Results',go:'practice'}]},
  {id:`${iso}-import`,title:'Import / Capture QAE Results',details:'Paste the QAE review dump into the importer so missed concepts, score tracking, and flashcard opportunities are created automatically.',links:[{label:'Open QAE Importer',go:'practice'}]},
  {id:`${iso}-missed`,title:'Missed-Question Review',details:'Review every incorrect item as a concept summary, correct CISA logic, and trap to avoid. This is required because it creates your long-term review bank.',links:[{label:'Open Missed Question Bank',go:'practice'},{label:'Open Study Tools',go:'tools'}]},
  {id:`${iso}-flash`,title:'Flashcard / Game Reinforcement',details:'Add missed concepts to a deck or play a missed-question game using your review bank.',links:[{label:'Open Study Tools',go:'tools'}]},
  {id:`${iso}-optional-udemy`,title:`Optional Udemy Lesson: ${topic.topic}`,details:'Use Udemy only when the QAE explanation is not enough and you need a teaching pass. Not required for day completion.',optional:true,links:topic.links}
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
  const bankCount=(state.profile.questionBank||[]).length;
  return `<div class="grid">
    <div class="panel" data-tour="qae-summary"><div class="section-head"><div><p class="eyebrow">Practice Log</p><h3>QAE Summary</h3><p class="helper">Use ISACA QAE for official practice. ControlQuest tracks your results, imports your review paste, and turns misses into study work.</p></div><button class="secondary-button small" data-url="${RESOURCE_LINKS.qae}">Open ISACA QAE</button></div>
      <div class="practice-summary"><div class="soft"><span class="app-icon qae">${svgIcon('qae')}</span><h3>${total}</h3><p class="helper">Total Questions Logged</p></div><div class="soft"><div class="donut" style="--pct:${acc}%"><span>${acc}%</span></div><p class="helper">Accuracy</p></div><div class="soft"><span class="app-icon target">${svgIcon('target')}</span><h3>${missCount}</h3><p class="helper">Missed Concepts To Review</p></div><div class="soft"><span class="app-icon cards">${svgIcon('cards')}</span><h3>${bankCount}</h3><p class="helper">Imported Review Items</p></div></div>
    </div>
    <div class="panel span-12"><div class="section-head"><div><p class="eyebrow">QAE Paste Importer</p><h3>Paste Your ISACA Review Dump</h3><p class="helper">Paste the QAE review text after a session. The deterministic parser reads question number, choices, correct answer, your answer, result, domain, knowledge statement, task statement, time, and difficulty. This is for your private/Guild review workflow; do not publish proprietary QAE text publicly.</p></div></div>
      <div class="form-grid"><label><span class="label-title">Import Scope</span><select id="qaeImportScope"><option value="Personal">Personal Only</option><option value="Guild">Guild Shared Review Bank</option></select></label><label><span class="label-title">Session Label</span><input id="qaeImportLabel" placeholder="Morning QAE With Ty, Domain 1 Audit Project Management"></label><label><span class="label-title">Upload Text File Optional</span><input id="qaeImportFile" type="file" accept=".txt,.md,text/plain"></label></div>
      <textarea id="qaeImportText" style="min-height:260px" placeholder="Paste the full QAE review output here, including Question, A-D choices, correct answer, justification, Domain, Knowledge Statement, Task Statement, and your result..."></textarea>
      <div class="button-row"><button class="primary-button" id="parseQaePaste">Parse And Import QAE Paste</button><button class="secondary-button" id="previewQaePaste">Preview Parse Count</button><button class="ghost-button" id="clearQaePaste">Clear Paste Box</button></div>
      <p class="helper">Tip: For Word docs, copy/paste the text into this box or save/export as .txt first. Browser-only GitHub Pages cannot reliably parse .docx without adding a large third-party parser library.</p>
    </div>
    <div class="panel"><h3>Log A QAE Practice Block Manually</h3><p class="helper">Use this when you only want to log score totals instead of importing the full review paste.</p><div class="form-grid"><label><span class="label-title">Domain</span><select id="qaeDomain">${ISACA_STUDY_PLAN.filter(d=>d.id!=='practice').map(d=>`<option value="${d.id}">${d.domain}: ${d.name}</option>`).join('')}</select></label><label><span class="label-title">Topic</span><select id="qaeTopic"></select></label><label><span class="label-title">Questions</span><input id="qaeTotal" type="number" min="1" max="150" value="10"></label><label><span class="label-title">Correct</span><input id="qaeCorrect" type="number" min="0" max="150" value="0"></label></div><label><span class="label-title">Notes</span><textarea id="qaeNotes" placeholder="Score context, domain focus, traps, or what you want to review later..."></textarea></label><button class="primary-button" id="addQae">Save QAE Log</button></div>
    <div class="panel"><div class="section-head"><div><p class="eyebrow">Missed Question Bank</p><h3>Capture Missed Concepts</h3><p class="helper">Misses imported from QAE paste appear here automatically. You can also add your own manually.</p></div></div>${missedQuestionForm()}<div class="log-table">${(state.profile.missedQuestions||[]).length?state.profile.missedQuestions.map(missedQuestionRow).join(''):'<div class="empty">No missed concepts captured yet.</div>'}</div></div>
    <div class="panel"><div class="section-head"><div><p class="eyebrow">Imported Question Bank</p><h3>Recent Imported Review Items</h3><p class="helper">Shows recent imported QAE review items for private study tracking. Use full question text only in private/Guild scope.</p></div></div><div class="log-table">${questionBankRows()}</div></div>
    <div class="panel"><div class="section-head"><div><p class="eyebrow">QAE Trend</p><h3>Accuracy Over Time</h3></div></div><svg class="trend" id="qaeTrend" viewBox="0 0 600 160" preserveAspectRatio="none">${trendSvg()}</svg></div>
    <div class="panel"><h3>QAE Logs</h3><div class="log-table">${state.profile.qaeLogs.length?state.profile.qaeLogs.map(qaeLogRow).join(''):'<div class="empty">No QAE logs yet.</div>'}</div></div>
  </div>`; }
function bindPractice(){ const d=$('#qaeDomain'); if(d){d.onchange=fillTopicSelect;fillTopicSelect();} $('#addQae')?.addEventListener('click',addQaeLog); $('#addMissedQuestion')?.addEventListener('click',addMissedQuestion); $('#parseQaePaste')?.addEventListener('click',()=>importQaePaste(false)); $('#previewQaePaste')?.addEventListener('click',()=>importQaePaste(true)); $('#clearQaePaste')?.addEventListener('click',()=>{$('#qaeImportText').value='';}); $('#qaeImportFile')?.addEventListener('change',readQaeTextFile); $$('[data-edit-qae]').forEach(b=>b.onclick=()=>editQae(b.dataset.editQae)); $$('[data-delete-qae]').forEach(b=>b.onclick=()=>deleteQae(b.dataset.deleteQae)); $$('[data-review-missed]').forEach(b=>b.onclick=()=>reviewMissed(b.dataset.reviewMissed)); $$('[data-edit-missed]').forEach(b=>b.onclick=()=>editMissed(b.dataset.editMissed)); $$('[data-delete-missed]').forEach(b=>b.onclick=()=>deleteMissed(b.dataset.deleteMissed)); $$('[data-card-missed]').forEach(b=>b.onclick=()=>addMissedToDeck(b.dataset.cardMissed)); }
function missedQuestionForm(){ return `<div class="soft"><div class="form-grid"><label><span class="label-title">Domain</span><select id="missDomain">${DOMAIN_TOPICS.map(d=>`<option>${d.domain}: ${d.name}</option>`).join('')}</select></label><label><span class="label-title">Topic</span><input id="missTopic" placeholder="Topic Or Concept"></label></div><textarea id="missSummary" placeholder="Short summary in your own words: what was the concept, trap, or CISA logic?"></textarea><textarea id="missRule" placeholder="Reusable CISA rule / flashcard answer..."></textarea><button class="primary-button small" id="addMissedQuestion">Add Missed Concept</button></div>`; }
function addMissedQuestion(){ const topic=$('#missTopic').value.trim(); const summary=$('#missSummary').value.trim(); if(!topic || !summary) return toast('Add a topic and short summary.','error'); state.profile.missedQuestions.unshift({id:crypto.randomUUID(),date:todayIso(),domain:$('#missDomain').value,topic,summary,rule:$('#missRule').value.trim(),reviewed:false,createdAt:new Date().toISOString()}); award({xp:12,coins:5,reason:'Missed Concept Captured',type:'Missed Question'}); saveProfileDebounced(); renderApp(); }
function missedQuestionRow(m){ return `<div class="log-row"><div><strong>${esc(m.topic)}</strong><p class="helper">${esc(m.domain)} · ${m.reviewed?'Reviewed':'Needs Review'} · ${fmtDate(m.date)}</p><p>${esc(m.summary||'')}</p>${m.rule?`<p class="helper"><strong>Rule:</strong> ${esc(m.rule)}</p>`:''}</div><div class="button-row"><button class="secondary-button small" data-review-missed="${m.id}">${m.reviewed?'Unreview':'Mark Reviewed'}</button><button class="secondary-button small" data-card-missed="${m.id}">Add To Flashcards</button><button class="secondary-button small" data-edit-missed="${m.id}">Edit</button><button class="danger-button small" data-delete-missed="${m.id}">Delete</button></div></div>`; }
function reviewMissed(id){ const m=state.profile.missedQuestions.find(x=>x.id===id); if(!m)return; m.reviewed=!m.reviewed; if(m.reviewed) award({xp:8,coins:3,reason:'Missed Concept Reviewed',type:'Missed Question'}); saveProfileDebounced(); renderApp(); }
function editMissed(id){ const m=state.profile.missedQuestions.find(x=>x.id===id); if(!m)return; modal('Edit Missed Concept',`<input id="editMissTopic" value="${escAttr(m.topic)}"><textarea id="editMissSummary">${esc(m.summary||'')}</textarea><textarea id="editMissRule">${esc(m.rule||'')}</textarea>`,()=>{m.topic=$('#editMissTopic').value.trim();m.summary=$('#editMissSummary').value.trim();m.rule=$('#editMissRule').value.trim();m.updatedAt=new Date().toISOString();saveProfileDebounced();renderApp();},'Save Changes'); }
function deleteMissed(id){ confirmModal('Delete Missed Concept','Delete this missed concept from your review bank?',()=>{state.profile.missedQuestions=state.profile.missedQuestions.filter(x=>x.id!==id);saveProfileDebounced();renderApp();}); }
function importMissedLines(){ const text=$('#missImport').value.trim(); if(!text)return toast('Paste lines to import first.','error'); const lines=text.split(/\n+/).map(x=>x.trim()).filter(Boolean).slice(0,80); for(const line of lines){ const parts=line.split('|').map(x=>x.trim()); state.profile.missedQuestions.unshift({id:crypto.randomUUID(),date:todayIso(),domain:parts[0]||'Unassigned Domain',topic:parts[1]||'Imported Missed Concept',summary:parts[2]||line,rule:(parts[3]||'').replace(/^Rule:\s*/i,''),reviewed:false,createdAt:new Date().toISOString(),source:'Import'}); } award({xp:Math.min(80,lines.length*4),coins:Math.min(30,lines.length*2),reason:`Imported ${lines.length} Missed Concepts`,type:'Import'}); saveProfileDebounced(); renderApp(); }
function questionBankRows(){
  const list=(state.profile.questionBank||[]).slice(0,12);
  if(!list.length) return '<div class="empty">No imported QAE review items yet. Paste a QAE review dump above to build your private review bank.</div>';
  return list.map(q=>`<div class="log-row"><div><strong>${esc(q.knowledgeStatement || q.sessionTitle || q.domain || 'Imported QAE Item')}</strong><p class="helper">${esc(q.domain || 'Unassigned Domain')} · Question ${q.number || '?'} · ${q.result || 'Imported'} · Correct ${q.correctAnswer || '?'}${q.userAnswer?` · Your Answer ${q.userAnswer}`:''}</p><p>${esc((q.question||'').slice(0,220))}${(q.question||'').length>220?'...':''}</p></div><div class="button-row"><button class="secondary-button small" data-card-missed="${escAttr(q.sourceMissedId || '')}" ${q.sourceMissedId?'':'disabled'}>Flashcard</button></div></div>`).join('');
}
function readQaeTextFile(){
  const file=$('#qaeImportFile')?.files?.[0]; if(!file) return;
  const reader=new FileReader();
  reader.onload=()=>{ $('#qaeImportText').value=String(reader.result||''); toast(`Loaded ${file.name}.`); };
  reader.onerror=()=>toast('Could not read that file. Try copying and pasting the text instead.','error');
  reader.readAsText(file);
}
async function importQaePaste(previewOnly=false){
  const text=$('#qaeImportText')?.value || '';
  const label=$('#qaeImportLabel')?.value?.trim() || 'Imported QAE Session';
  const scope=$('#qaeImportScope')?.value || 'Personal';
  const parsed=parseQaePaste(text);
  const questions=parsed.questions || [];
  if(!questions.length) return toast(`No QAE questions were parsed. ${parsed.warnings?.[0]||''}`,'error');
  const correct=questions.filter(q=>q.isCorrect===true).length;
  const missed=questions.filter(q=>q.isCorrect===false);
  const domains=[...new Set(questions.map(q=>q.domain).filter(Boolean))].join(', ') || 'Imported QAE';
  if(previewOnly){
    modal('QAE Parse Preview',`<div class="soft"><h3>${questions.length} Questions Found</h3><p class="helper">${correct} Correct · ${missed.length} Missed · ${esc(domains)}</p>${parsed.warnings?.length?`<p class="helper danger-text">${esc(parsed.warnings.join(' '))}</p>`:''}</div><div class="log-table">${questions.slice(0,5).map(q=>`<div class="log-row"><div><strong>Question ${q.number || '?'}</strong><p class="helper">${esc(q.knowledgeStatement || q.domain || '')}</p><p>${esc((q.question||'').slice(0,180))}${(q.question||'').length>180?'...':''}</p></div><span class="bubble ${q.isCorrect?'good':'warn'}">${q.result || 'Parsed'}</span></div>`).join('')}</div>`,()=>{},'Close');
    return;
  }
  await confirmModal('Import QAE Review Dump',`Import ${questions.length} parsed questions from this paste? This will add one QAE log, store the parsed review items in your ${scope} question bank, and create missed-concept review items for the ${missed.length} incorrect answers.`, async()=>{
    state.profile.questionBank ||= [];
    state.profile.qaeImports ||= [];
    const existing=new Set(state.profile.questionBank.map(q=>q.fingerprint));
    const newQuestions=questions.filter(q=>!existing.has(q.fingerprint));
    const importedAt=new Date().toISOString();
    const importId=crypto.randomUUID();
    const misses=[];
    for(const q of newQuestions){
      const stored={...q,importId,scope,sessionLabel:label,importedAt};
      if(q.isCorrect===false){ const miss=missedConceptFromParsedQuestion(q); stored.sourceMissedId=miss.id; misses.push(miss); }
      state.profile.questionBank.unshift(stored);
    }
    state.profile.missedQuestions.unshift(...misses);
    state.profile.qaeImports.unshift({id:importId,label,scope,date:todayIso(),createdAt:importedAt,total:questions.length,correct,missed:missed.length,domains,warnings:parsed.warnings||[]});
    state.profile.qaeLogs.unshift({id:crypto.randomUUID(),date:todayIso(),domain:domains,domainId:'imported',topic:label,total:questions.length,correct,notes:`Imported from QAE paste. ${missed.length} missed concepts created.`,createdAt:importedAt,source:'QAE Paste Import'});
    state.profile.stats.qaeQuestions=(state.profile.stats.qaeQuestions||0)+questions.length;
    state.profile.stats.qaeCorrect=(state.profile.stats.qaeCorrect||0)+correct;
    if(scope==='Guild' && state.group){ state.group.questionBank ||= []; const gExisting=new Set(state.group.questionBank.map(q=>q.fingerprint)); state.group.questionBank.unshift(...newQuestions.filter(q=>!gExisting.has(q.fingerprint)).map(q=>({id:q.id,fingerprint:q.fingerprint,sessionLabel:label,domain:q.domain,knowledgeStatement:q.knowledgeStatement,number:q.number,result:q.result,correctAnswer:q.correctAnswer,userAnswer:q.userAnswer,importedAt,importedBy:state.profile.uid}))); await saveGroup(state.group); }
    ensureImportedMissDeck(misses, questions);
    award({xp:Math.min(180, 25 + questions.length*2 + missed.length*3),coins:Math.min(80, 10 + questions.length + missed.length*2),reason:`Imported ${questions.length} QAE Items`,type:'QAE Import'});
    await saveProfileDebounced(true);
    $('#qaeImportText').value='';
    showCelebration('QAE Import Complete',`${questions.length} items imported · ${missed.length} misses added for review.`);
    renderApp();
  });
}
function ensureImportedMissDeck(misses, allQuestions){
  if(!misses.length) return;
  state.profile.memoryDecks ||= [];
  let deck=state.profile.memoryDecks.find(d=>d.id==='personal-imported-qae-misses');
  if(!deck){ deck={id:'personal-imported-qae-misses',scope:'Personal',title:'Imported QAE Misses',description:'Auto-created flashcards from missed QAE imports. Edit these into your own words as you review.',createdAt:new Date().toISOString(),updatedAt:new Date().toISOString(),cards:[]}; state.profile.memoryDecks.unshift(deck); }
  const byMiss=new Map(misses.map(m=>[m.sourceQuestionId,m]));
  const existing=new Set((deck.cards||[]).map(c=>c.sourceQuestionId));
  for(const q of allQuestions.filter(q=>q.isCorrect===false && !existing.has(q.id))){ const card=flashcardFromParsedMiss(q); deck.cards.push(card); }
  deck.updatedAt=new Date().toISOString();
}

function addMissedToDeck(id){ const m=state.profile.missedQuestions.find(x=>x.id===id); if(!m)return; const decks=state.profile.memoryDecks||[]; const opts=decks.map(d=>`<option value="${d.id}">${esc(d.title)} (${d.scope})</option>`).join(''); modal('Add To Flashcards',`<label><span class="label-title">Deck</span><select id="targetDeck">${opts}</select></label><p class="helper">Front: ${esc(m.topic)}</p><p class="helper">Back: ${esc(m.rule||m.summary)}</p>`,()=>{const deck=decks.find(d=>d.id===$('#targetDeck').value); if(!deck)return; deck.cards ||= []; deck.cards.push({front:m.topic,back:m.rule||m.summary,sourceMissedId:m.id}); deck.updatedAt=new Date().toISOString(); award({xp:6,coins:2,reason:'Missed Concept Added To Flashcards',type:'Flashcards'}); saveProfileDebounced(); renderApp();},'Add Card'); }
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

function renderTools(){
  return `<div class="grid">
    <div class="panel" data-tour="tool-integrations"><div class="section-head"><div><p class="eyebrow">Study Tool Hub</p><h3>Official Practice + ControlQuest Reinforcement</h3><p class="helper">Use ISACA QAE and Udemy for official learning. Use ControlQuest for flashcards, missed-question review, games, Guild accountability, and rewards.</p></div></div>
      <div class="grid three">
        ${integrationCard('ISACA Learning / QAE','Official QAE and learning system. Use this for real practice, then log results here.','qae',RESOURCE_LINKS.qae,'Open ISACA')}
        ${integrationCard('Udemy Course','Optional teaching layer for topics that need explanation before or after QAE.','cards',state.profile.preferences.links.udemy||RESOURCE_LINKS.udemy,'Open Udemy')}
        ${integrationCard('Extra Resources','Supplemental articles, outline document, and video playlist for slower review days.','notebook',RESOURCE_LINKS.isacaOutline,'Open Outline')}
      </div>
    </div>
    <div class="panel" data-tour="memory-decks"><div class="section-head"><div><p class="eyebrow">Memory Decks</p><h3>Build Flashcards In ControlQuest</h3><p class="helper">Create Personal, Guild, or Public decks. Missed concepts can be sent here from Practice Log.</p></div><button class="primary-button small" id="newDeckBtn">Create New Deck</button></div><div class="deck-grid">${(state.profile.memoryDecks||[]).map(deckCard).join('')||'<div class="empty">No decks yet.</div>'}</div>${renderDeckStudy()}</div>
    <div class="panel" data-tour="arcade"><div class="section-head"><div><p class="eyebrow">ControlQuest Arcade</p><h3>Original Games For Audit Judgment</h3><p class="helper">Games use original prompts and your missed-concept bank. They are not trying to clone ISACA QAE.</p></div></div><div class="grid three">${GAME_CATALOG.map(gameCard).join('')}</div><div id="gameArena" style="margin-top:16px">${renderGameArena()}</div></div>
  </div>`;
}
function integrationCard(title,details,iconName,url,label){ return `<div class="integration-card"><span class="app-icon ${iconName}">${svgIcon(iconName)}</span><div><strong>${title}</strong><p class="helper">${details}</p></div><button class="secondary-button small" data-url="${url}">${label}</button></div>`; }
function gameCard(g){ return `<div class="game-card"><span class="app-icon ${g.icon}">${svgIcon(g.icon)}</span><h4>${g.title}</h4><p class="helper">${g.details}</p><div class="metric-row"><span class="bubble good">+${g.xp} XP</span><span class="bubble warn">+${g.coins} Coins</span></div><button class="primary-button small" data-start-game="${g.id}">Play</button></div>`; }
function renderGameArena(){ if(!state.gameState)return `<div class="empty">Pick a game above to start a quick challenge.</div>`; const g=state.gameState; if(g.type==='avatarSprint') return renderAvatarSprint(); if(g.type==='missedSprint') return renderMissedSprint(); if(g.type==='ruleRelay') return renderRuleRelay(); if(g.type==='riskRank') return renderRiskRank(); if(g.type==='sequence') return renderSequenceGame(); if(g.type==='controlMatch') return renderControlMatch(); if(g.type==='duel') return renderDecisionDuel(); return ''; }
function deckCard(d){ const selected=state.selectedDeckId===d.id; return `<div class="deck-card ${selected?'selected':''}"><span class="app-icon cards">${svgIcon('cards')}</span><h4>${esc(d.title)}</h4><p class="helper">${esc(d.scope||'Personal')} · ${(d.cards||[]).length} Cards</p><p class="helper">${esc(d.description||'')}</p><div class="button-row"><button class="secondary-button small" data-study-deck="${d.id}">Study</button><button class="secondary-button small" data-edit-deck="${d.id}">Edit</button><button class="secondary-button small" data-export-deck="${d.id}">Export TSV</button></div></div>`; }
function renderDeckStudy(){ const d=(state.profile.memoryDecks||[]).find(x=>x.id===state.selectedDeckId); if(!d)return '<div class="empty" style="margin-top:14px">Choose a deck to study.</div>'; const cards=d.cards||[]; const idx=state.deckIndex||0; const card=cards[idx]; if(!card)return `<div class="soft" style="margin-top:14px"><h3>${esc(d.title)}</h3><p class="helper">This deck has no cards yet. Add cards through Edit or from Missed Question Bank.</p></div>`; const flipped=!!state.deckFlipped; return `<div class="flash-study" style="margin-top:16px"><div class="flash-card ${flipped?'flipped':''}" data-flip-card><small>${idx+1} / ${cards.length}</small><h2>${esc(flipped?card.back:card.front)}</h2><p class="helper">Click card to flip.</p></div><div class="button-row"><button class="secondary-button" id="prevCard">Previous</button><button class="primary-button" id="flipCard">Flip</button><button class="secondary-button" id="nextCard">Next</button><button class="primary-button" id="completeFlashRound">Complete Flashcard Round</button></div></div>`; }
function bindTools(){ $('#newDeckBtn')?.addEventListener('click',()=>deckModal()); $$('[data-study-deck]').forEach(b=>b.onclick=()=>{state.selectedDeckId=b.dataset.studyDeck; state.deckIndex=0; state.deckFlipped=false; renderApp();}); $$('[data-edit-deck]').forEach(b=>b.onclick=()=>deckModal(b.dataset.editDeck)); $$('[data-export-deck]').forEach(b=>b.onclick=()=>exportDeck(b.dataset.exportDeck)); $('#flipCard')?.addEventListener('click',()=>{state.deckFlipped=!state.deckFlipped;renderApp();}); $('[data-flip-card]')?.addEventListener('click',()=>{state.deckFlipped=!state.deckFlipped;renderApp();}); $('#prevCard')?.addEventListener('click',()=>{const d=(state.profile.memoryDecks||[]).find(x=>x.id===state.selectedDeckId); state.deckIndex=Math.max(0,(state.deckIndex||0)-1); state.deckFlipped=false; renderApp();}); $('#nextCard')?.addEventListener('click',()=>{const d=(state.profile.memoryDecks||[]).find(x=>x.id===state.selectedDeckId); state.deckIndex=Math.min(((d?.cards||[]).length-1), (state.deckIndex||0)+1); state.deckFlipped=false; renderApp();}); $('#completeFlashRound')?.addEventListener('click',()=>{award({xp:25,coins:10,reason:'Flashcard Round Complete',type:'Flashcards'}); saveProfileDebounced(); renderApp();}); $$('[data-start-game]').forEach(b=>b.onclick=()=>startGame(b.dataset.startGame)); $$('[data-game-answer]').forEach(b=>b.onclick=()=>gameAnswer(Number(b.dataset.gameAnswer))); $('#riskSubmit')?.addEventListener('click',submitRiskRank); $('#seqSubmit')?.addEventListener('click',submitSequence); $('#matchSubmit')?.addEventListener('click',submitControlMatch); $('#relaySubmit')?.addEventListener('click',()=>{const v=$('#relayRule').value.trim(); if(v.length<25)return toast('Write a fuller rule first.','error'); state.profile.missedQuestions.unshift({id:crypto.randomUUID(),date:todayIso(),domain:'Rule Relay',topic:'Self-Written CISA Rule',summary:v,rule:v,reviewed:false,createdAt:new Date().toISOString(),source:'Arcade'}); finishGame('ruleRelay');}); }
function deckModal(id=null){ const d=(state.profile.memoryDecks||[]).find(x=>x.id===id)||{id:crypto.randomUUID(),scope:'Personal',title:'',description:'',cards:[]}; const cardsText=(d.cards||[]).map(c=>`${c.front}\t${c.back}`).join('\n'); modal(id?'Edit Memory Deck':'Create Memory Deck',`<div class="form-grid"><label><span class="label-title">Deck Title</span><input id="deckTitle" value="${escAttr(d.title)}"></label><label><span class="label-title">Scope</span><select id="deckScope"><option ${d.scope==='Personal'?'selected':''}>Personal</option><option ${d.scope==='Guild'?'selected':''}>Guild</option><option ${d.scope==='Public'?'selected':''}>Public</option></select></label></div><textarea id="deckDesc" placeholder="Description">${esc(d.description||'')}</textarea><p class="helper">Add one card per line using: Front[TAB]Back</p><textarea id="deckCards" style="min-height:220px" placeholder="Term\tDefinition">${esc(cardsText)}</textarea>`,()=>{const title=$('#deckTitle').value.trim(); if(!title)return toast('Deck title is required.','error'); d.title=title; d.scope=$('#deckScope').value; d.description=$('#deckDesc').value.trim(); d.cards=$('#deckCards').value.split(/\n+/).map(line=>line.split('\t')).filter(x=>x[0]&&x[1]).map(x=>({front:x[0].trim(),back:x.slice(1).join('\t').trim()})); d.updatedAt=new Date().toISOString(); if(!id){d.createdAt=new Date().toISOString(); state.profile.memoryDecks.unshift(d);} saveProfileDebounced(); renderApp();}, id?'Save Deck':'Create Deck'); }
function exportDeck(id){ const d=(state.profile.memoryDecks||[]).find(x=>x.id===id); if(!d)return; downloadText(`${safeFile(d.title)}.tsv`,(d.cards||[]).map(c=>`${c.front}\t${c.back}`).join('\n'),'text/tab-separated-values'); }
function startGame(id){ state.gameState={type:id,round:0,score:0,startedAt:Date.now(),prompt:pickGamePrompt(id)}; renderApp(); }
function pickGamePrompt(id){ if(id==='missedSprint'){ const m=pick((state.profile.missedQuestions||[]).length?state.profile.missedQuestions:[]); if(m) return {q:`What is the best CISA rule for: ${m.topic}?`,choices:[m.rule||m.summary,'Ignore it until reporting','Ask IT to fix it immediately','Choose the easiest control to test'],answer:0,why:m.rule||m.summary}; } return pick(DECISION_PROMPTS); }
function renderAvatarSprint(){ const p=state.gameState.prompt; return `<div class="soft"><h3>Avatar Sprint</h3><p class="helper">Answer correctly to move your avatar forward. This is great for Guild race nights.</p><div style="height:70px;background:linear-gradient(90deg,rgba(124,77,255,.2),rgba(0,194,255,.2));border-radius:20px;position:relative;overflow:hidden"><div class="avatar tiny" style="position:absolute;left:${Math.min(84,state.gameState.score*12)}%;top:8px">${avatarSvg(state.profile.inventory.equipped)}</div></div><h4>${esc(p.q)}</h4><div class="grid two">${p.choices.map((c,i)=>`<button class="secondary-button" data-game-answer="${i}">${esc(c)}</button>`).join('')}</div></div>`; }
function renderDecisionDuel(){ const p=state.gameState.prompt; return `<div class="soft"><h3>Decision Duel</h3><p class="helper">Pick the CISA-best answer. The why matters more than memorization.</p><h4>${esc(p.q)}</h4><div class="grid two">${p.choices.map((c,i)=>`<button class="secondary-button" data-game-answer="${i}">${esc(c)}</button>`).join('')}</div></div>`; }
function renderMissedSprint(){ const p=state.gameState.prompt; return `<div class="soft game-pop"><h3>Missed-Question Sprint</h3><p class="helper">Uses your missed-concept bank. Answer correctly to move Ollie down the track.</p><div class="race-track"><div class="avatar tiny" style="left:${Math.min(85,state.gameState.score*17)}%">${avatarSvg(state.profile.inventory.equipped)}</div></div><h4>${esc(p.q)}</h4><div class="grid two">${p.choices.map((c,i)=>`<button class="secondary-button" data-game-answer="${i}">${esc(c)}</button>`).join('')}</div></div>`; }
function renderRuleRelay(){ return `<div class="soft game-pop"><h3>Rule Relay</h3><p class="helper">Write one reusable CISA rule from memory, then give yourself credit if it is strong enough to teach Ty.</p><textarea id="relayRule" placeholder="Example: Risk-based audit planning prioritizes greatest business risk, not convenience."></textarea><button class="primary-button" id="relaySubmit">Submit Rule</button></div>`; }
function gameAnswer(i){ const p=state.gameState.prompt; if(i===p.answer){ state.gameState.score++; toast(`Correct: ${p.why}`); if(state.gameState.score>=5) finishGame(state.gameState.type); else { state.gameState.prompt=pick(DECISION_PROMPTS); renderApp(); } } else { toast(`Not quite. ${p.why}`,'error'); state.gameState.prompt=pick(DECISION_PROMPTS); renderApp(); } }
function renderRiskRank(){ const items=['Data center outage during payroll','Missing password policy typo','Privileged account not reviewed','Unapproved production change']; return `<div class="soft"><h3>Risk Rank Rally</h3><p class="helper">Type 1-4 beside each item. 1 is highest business risk.</p>${items.map((x,i)=>`<label><span>${x}</span><input data-risk-rank="${i}" type="number" min="1" max="4"></label>`).join('')}<button class="primary-button" id="riskSubmit">Submit Ranking</button></div>`; }
function submitRiskRank(){ finishGame('riskRank'); }
function renderSequenceGame(){ const items=['Report And Follow Up','Collect Evidence','Plan Based On Risk','Perform Testing']; return `<div class="soft"><h3>Audit Sequence Builder</h3><p class="helper">Order the audit activities from first to last.</p>${items.map((x,i)=>`<label><span>${x}</span><input data-seq="${i}" type="number" min="1" max="4"></label>`).join('')}<button class="primary-button" id="seqSubmit">Submit Sequence</button></div>`; }
function submitSequence(){ finishGame('sequence'); }
function renderControlMatch(){ const risks=['Excessive Access','Data Loss','Unapproved Change']; const controls=['Periodic Access Review','Backups + Restore Tests','Change Approval And Testing']; return `<div class="soft"><h3>Control Match Arena</h3><p class="helper">Match each risk to the best control.</p>${risks.map((r,i)=>`<label><span>${r}</span><select data-match="${i}">${controls.map(c=>`<option>${c}</option>`).join('')}</select></label>`).join('')}<button class="primary-button" id="matchSubmit">Submit Matches</button></div>`; }
function submitControlMatch(){ finishGame('controlMatch'); }
function finishGame(id){ const game=GAME_CATALOG.find(g=>g.id===id); award({xp:game?.xp||20,coins:game?.coins||8,reason:`Arcade Complete: ${game?.title||'Game'}`,type:'Arcade'}); maybeAddChest('bronze',.12); state.gameState=null; saveProfileDebounced(); showCelebration('Arcade Round Complete',`You earned XP and Audit Coins for practicing audit judgment.`); renderApp(); }

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
function noteEditor(n){ return `<div class="editor-box"><div class="form-grid"><input id="noteTitle" value="${escAttr(n.title)}"><select id="noteScope"><option ${n.scope==='Personal'?'selected':''}>Personal</option><option ${n.scope==='Guild'?'selected':''}>Guild</option><option ${n.scope==='Public'?'selected':''}>Public</option></select></div><textarea id="noteBody">${esc(n.body||'')}</textarea><div class="button-row"><button class="primary-button" id="saveNote">Save Note</button>${state.profile.preferences.links.goodnotes?`<button class="secondary-button" data-url="${state.profile.preferences.links.goodnotes}">Open Goodnotes Notebook</button>`:''}</div><div class="markdown-preview">${markdownPreview(n.body||'')}</div></div>`; }
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

function renderProfile(){ return `<div class="grid"><div class="panel"><div class="section-head"><div><p class="eyebrow">Profile And Preferences</p><h3>Customize Your Setup</h3></div></div><div class="form-grid"><label><span class="label-title">Display Name</span><input id="displayName" value="${escAttr(state.profile.displayName)}"></label><label><span class="label-title">Timezone</span><select id="timezoneSelect">${TIMEZONES.map(t=>`<option value="${t}" ${t===state.profile.timezone?'selected':''}>${t}</option>`).join('')}</select></label><label><span class="label-title">Theme</span><select id="prefTheme"><option value="dark" ${state.profile.preferences.theme==='dark'?'selected':''}>Dark</option><option value="light" ${state.profile.preferences.theme==='light'?'selected':''}>Light</option></select></label><label><span class="label-title">Default Study Duration</span><input id="prefDuration" type="number" min="5" max="240" value="${state.profile.preferences.defaultStudyDuration||60}"></label></div><button class="primary-button" id="saveProfile">Save Profile</button></div>
    <div class="panel"><p class="eyebrow">External Tool Links</p><div class="form-grid"><label><span class="label-title">ISACA QAE / Learning Link</span><input id="linkQae" value="${escAttr(state.profile.preferences.links.qae||RESOURCE_LINKS.qae)}"></label><label><span class="label-title">Udemy Course Link</span><input id="linkUdemy" value="${escAttr(state.profile.preferences.links.udemy||RESOURCE_LINKS.udemy)}"></label><label><span class="label-title">Extra YouTube Resource Link</span><input id="linkYoutube" value="${escAttr(state.profile.preferences.links.youtubePlaylist||RESOURCE_LINKS.youtubePlaylist)}"></label></div><button class="primary-button" id="saveLinks">Save Links</button></div>
    <div class="panel"><p class="eyebrow">Help And Onboarding</p><div class="button-row"><button class="secondary-button" id="redoOnboarding">Redo Onboarding Setup</button><button class="secondary-button" id="fullTour">Run Full Site Tour</button><button class="secondary-button" id="resetPageTours">Reset Page Help Tours</button></div></div>
    <div class="panel"><p class="eyebrow danger-text">Testing And Account Safety</p><div class="grid two"><div class="confirm-box"><h3>Reset Testing Stats</h3><p class="helper">Creates a backup, then resets XP, coins, activity, QAE logs, homework, roadmap progress, and rewards inventory. Your account and settings stay.</p><button class="danger-button" id="resetStats">Reset Stats</button></div><div class="confirm-box"><h3>Delete Profile Data</h3><p class="helper">Creates a backup under deletedProfiles, then deletes your ControlQuest profile document. Your Firebase Auth account may still exist.</p><button class="danger-button" id="deleteProfile">Delete Profile Data</button></div></div></div></div>`; }
function bindProfile(){ $('#saveProfile')?.addEventListener('click',()=>{const dur=Number($('#prefDuration').value); if(!dur||dur<5||dur>240)return toast('Duration must be 5 to 240 minutes.','error'); state.profile.displayName=$('#displayName').value.trim()||state.profile.displayName; state.profile.timezone=$('#timezoneSelect').value; state.profile.preferences.theme=$('#prefTheme').value; state.profile.preferences.defaultStudyDuration=dur; applyTheme(); saveProfileDebounced(); renderApp();}); $('#saveLinks')?.addEventListener('click',()=>{state.profile.preferences.links.qae=$('#linkQae').value.trim()||RESOURCE_LINKS.qae; state.profile.preferences.links.udemy=$('#linkUdemy').value.trim(); state.profile.preferences.links.youtubePlaylist=$('#linkYoutube').value.trim()||RESOURCE_LINKS.youtubePlaylist; saveProfileDebounced(); toast('Links saved.');}); $('#redoOnboarding')?.addEventListener('click',()=>showOnboarding()); $('#fullTour')?.addEventListener('click',()=>startFullTour()); $('#resetPageTours')?.addEventListener('click',()=>{state.profile.preferences.pageTours={};saveProfileDebounced();toast('Page tours reset.');}); $('#resetStats')?.addEventListener('click',()=>resetStatsFlow()); $('#deleteProfile')?.addEventListener('click',()=>deleteProfileFlow()); }

function bindView(){
  ({command:bindCommand,room:bindRoom,plan:bindPlan,practice:bindPractice,tools:bindTools,guild:bindGuild,calendar:bindCalendar,notebook:bindNotebook,rewards:bindRewards,profile:bindProfile}[state.activeView]||(()=>{}))();
}

function showOnboarding(){
  const p=state.profile;
  modal('Welcome To ControlQuest Studio', `<p class="helper">Let’s set up your personal CISA study companion. These choices are private to your profile and will not change your Guild members’ settings.</p>
    <div class="form-grid"><label><span class="label-title">Display Name</span><input id="obName" value="${escAttr(p.displayName)}"></label><label><span class="label-title">Theme Preference</span><select id="obTheme"><option value="dark" ${p.preferences.theme==='dark'?'selected':''}>Dark</option><option value="light" ${p.preferences.theme==='light'?'selected':''}>Light</option></select></label><label><span class="label-title">Timezone</span><select id="obTimezone">${TIMEZONES.map(t=>`<option value="${t}" ${t===p.timezone?'selected':''}>${t}</option>`).join('')}</select></label><label><span class="label-title">Start Date</span><input id="obStart" type="date" value="${p.roadmap.startDate||todayIso()}"></label><label><span class="label-title">Target Exam Date</span><input id="obExam" type="date" value="${p.roadmap.examDate||'2026-09-26'}"></label><label><span class="label-title">Default Session Length</span><input id="obDuration" type="number" min="5" max="240" value="${p.preferences.defaultStudyDuration||60}"></label><label><span class="label-title">Daily QAE Goal</span><input id="obGoal" type="number" min="1" max="150" value="${p.preferences.dailyQaeGoal||10}"></label><label><span class="label-title">Calendar Preference</span><select id="obCalendar"><option value="ics">ICS Download / Invite Files</option><option value="google">Google Calendar OAuth</option><option value="apple">Apple / iCalendar Import</option></select></label></div>
    <label><span class="label-title">Udemy Course Link</span><input id="obUdemy" placeholder="Optional Udemy course link" value="${escAttr(p.preferences.links.udemy||'')}"></label>`, async()=>{
      const start=$('#obStart').value, exam=$('#obExam').value, dur=Number($('#obDuration').value), goal=Number($('#obGoal').value);
      if(!start||!exam||parseLocal(start)>parseLocal(exam))return toast('Start Date must be on or before Target Exam Date.','error');
      if(!dur||dur<5||dur>240)return toast('Session length must be 5 to 240 minutes.','error');
      if(!goal||goal<1||goal>150)return toast('Daily QAE Goal must be 1 to 150.','error');
      p.displayName=$('#obName').value.trim()||p.displayName; p.preferences.theme=$('#obTheme').value; p.timezone=$('#obTimezone').value; p.roadmap.startDate=start; p.roadmap.examDate=exam; p.preferences.defaultStudyDuration=dur; p.preferences.dailyQaeGoal=goal; p.preferences.calendarProvider=$('#obCalendar').value; p.preferences.links.udemy=$('#obUdemy').value.trim(); p.preferences.onboardingComplete=true; p.preferences.pageTours ||= {}; await saveProfileDebounced(true); applyTheme(); renderApp(); setTimeout(()=>startTour('command',true),400);
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
  tools:[['tool-integrations','Tool Hub','ControlQuest links to ISACA, Quizlet, and Goodnotes instead of reinventing tools that already work well.'],['arcade','Arcade','Use original games that focus on audit judgment, risk ranking, and CISA-style decision logic.']],
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
function showCelebration(title,msg){ confetti(55); modal(title,`<div class="level-pop"><div class="avatar small">${avatarSvg(state.profile.inventory.equipped)}</div><h3>${esc(msg)}</h3></div>`,()=>{},'Celebrate'); }
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
