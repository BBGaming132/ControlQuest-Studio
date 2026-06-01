import { initFirebase, register, login, logout, sendPasswordReset, loadProfile, saveProfile, subscribeProfile, createGroup, joinGroup, subscribeGroup, saveGroup, updateMemberSummary, leaveGroup, archiveAndDeleteProfile, exportProfileBackup, firebaseEnabled } from './firebase-service.js';
import { defaultProfile, defaultGroup, emptyLiveSession, awardXp, completeDailyChallenge, updateStreak, useStreakFreeze, levelFromXp, dailyChallenges, renderAvatar, isAvatarItemUnlocked } from './gamification.js';
import { DOMAINS, AVATAR_ITEMS, BADGES, GAME_QUESTIONS } from './content.js';
import { todayISO, formatDate, addDays, generateRoadmap, currentRoadmapDay, progressSummary, domainCompletion, catchUpPlan, adaptiveMessage } from './planner.js';
import { downloadIcs, recurrenceRuleForDays } from './calendar.js';

const $ = (sel, root=document) => root.querySelector(sel);
const $$ = (sel, root=document) => [...root.querySelectorAll(sel)];

const state = {
  firebaseStatus:'Starting...',
  user:null,
  profile:null,
  group:null,
  activeView:'dashboard',
  saving:false,
  tutorialStep:0,
  timerTick:null,
  activeGame:null,
  pendingProfileSave:null
};

const app = $('#app');

init();

async function init(){
  renderBoot('Connecting to Firebase...');
  await initFirebase(handleAuthChange, msg => { state.firebaseStatus = msg; });
  if(!firebaseEnabled()) renderFirebaseSetup();
  window.addEventListener('resize', () => document.body.classList.toggle('mobile-size', window.innerWidth < 760));
}

async function handleAuthChange(user){
  state.user = user;
  if(!user){
    stopTimerTick();
    state.profile = null; state.group = null;
    renderLogin();
    return;
  }
  renderBoot('Loading your profile...');
  try{
    state.profile = await loadProfile(user.uid);
    state.profile.uid = user.uid;
    state.profile.email = user.email || state.profile.email;
    applyTheme();
    subscribeProfile(user.uid, profile => {
      state.profile = profile;
      applyTheme();
      if(profile.activeGroupId) attachGroup(profile.activeGroupId);
      renderApp();
    });
    if(state.profile.activeGroupId) attachGroup(state.profile.activeGroupId);
    renderApp();
    if(!state.profile.onboarding?.completed) showTutorial();
  }catch(error){
    toast(error.message, 'error');
    renderLogin();
  }
}

function attachGroup(groupId){
  if(state.group?.id === groupId && state.groupAttached) return;
  state.groupAttached = groupId;
  subscribeGroup(groupId, group => {
    state.group = group;
    renderApp();
  });
}

function renderBoot(message){
  app.className = 'boot-screen';
  app.innerHTML = `<div class="boot-card float-in"><img src="assets/mascots/ollie.svg" alt="Ollie the Audit Owl"><h1>ControlQuest Studio</h1><p>${escapeHtml(message)}</p></div>`;
}

function renderFirebaseSetup(){
  app.className = 'auth-shell';
  app.innerHTML = `<section class="auth-card wide float-in">
    <div class="auth-visual"><img src="assets/mascots/ollie.svg" alt="Ollie mascot"><h1>Almost ready.</h1><p>Firebase is not enabled in <code>config/firebase-config.js</code>. Paste your web app config and set <code>enabled: true</code>.</p></div>
    <div class="auth-form"><h2>Setup checklist</h2><ol class="setup-list"><li>Open <code>config/firebase-config.js</code>.</li><li>Paste the Firebase web config values.</li><li>Change <code>enabled</code> from <code>false</code> to <code>true</code>.</li><li>Enable Email/Password Auth.</li><li>Create Firestore and publish <code>firebase.rules</code>.</li><li>Refresh this page.</li></ol></div>
  </section>`;
}

function renderLogin(){
  app.className = 'auth-shell';
  app.innerHTML = `<section class="auth-card float-in">
    <div class="auth-visual">
      <img src="assets/mascots/ollie.svg" alt="Ollie the Audit Owl">
      <p class="eyebrow">Gamified CISA prep</p>
      <h1>ControlQuest Studio</h1>
      <p>Build your streak, run live study rooms, join a study guild, and turn QAE practice into a game loop you actually want to come back to.</p>
      <div class="mini-proof"><span>Live sync</span><span>Study groups</span><span>Adaptive roadmap</span><span>Daily quests</span></div>
    </div>
    <div class="auth-form">
      <div class="tab-row" role="tablist"><button class="tab active" data-auth-tab="login">Log in</button><button class="tab" data-auth-tab="create">Create account</button></div>
      <form id="loginForm" class="auth-tab active">
        <h2>Welcome back</h2>
        <label>Email<input type="email" id="loginEmail" autocomplete="email" required></label>
        <label>Password<input type="password" id="loginPassword" autocomplete="current-password" required></label>
        <button class="primary-button full" type="submit">Log in</button>
        <button class="text-button" type="button" id="resetPasswordBtn">Send password reset</button>
        <p class="helper">Your browser will keep you signed in unless you log out or clear site data.</p>
      </form>
      <form id="createForm" class="auth-tab">
        <h2>Create your quest profile</h2>
        <label>Display name<input type="text" id="createName" placeholder="Example: Bennett" required></label>
        <label>Email<input type="email" id="createEmail" autocomplete="email" required></label>
        <label>Password<input type="password" id="createPassword" autocomplete="new-password" minlength="6" required></label>
        <button class="primary-button full" type="submit">Create account</button>
        <p class="helper">This creates a Firebase Auth account and your private profile document.</p>
      </form>
    </div>
  </section>`;
  $$('[data-auth-tab]').forEach(btn => btn.addEventListener('click', () => switchAuthTab(btn.dataset.authTab)));
  $('#loginForm').addEventListener('submit', async e => { e.preventDefault(); await doLogin(); });
  $('#createForm').addEventListener('submit', async e => { e.preventDefault(); await doCreateAccount(); });
  $('#resetPasswordBtn').addEventListener('click', async () => {
    const email = $('#loginEmail').value.trim();
    if(!email) return toast('Enter your email first.', 'warn');
    try{ await sendPasswordReset(email); toast('Password reset email sent.'); }catch(error){ toast(error.message, 'error'); }
  });
}

function switchAuthTab(tab){
  $$('[data-auth-tab]').forEach(b => b.classList.toggle('active', b.dataset.authTab === tab));
  $$('.auth-tab').forEach(el => el.classList.toggle('active', el.id.startsWith(tab)));
}

async function doLogin(){
  try{
    await login($('#loginEmail').value.trim(), $('#loginPassword').value);
    toast('Logged in. Loading your quest...');
  }catch(error){ toast(friendlyFirebaseError(error), 'error'); }
}
async function doCreateAccount(){
  try{
    await register($('#createEmail').value.trim(), $('#createPassword').value, $('#createName').value.trim());
    toast('Account created. Welcome to ControlQuest.');
  }catch(error){ toast(friendlyFirebaseError(error), 'error'); }
}

function renderApp(){
  if(!state.profile) return;
  const p = state.profile;
  const summary = progressSummary(p);
  const lvl = levelFromXp(p.stats.xp || 0);
  app.className = 'app-shell';
  app.innerHTML = `
    <aside class="sidebar">
      <div class="brand"><img src="assets/icons/logo-mark.svg" alt="ControlQuest logo"><div><p class="eyebrow">ControlQuest</p><h1>Studio</h1></div></div>
      <button class="mobile-close" id="closeNavBtn" type="button">Close</button>
      <nav class="nav-list">
        ${navButton('dashboard','Command Center','dashboard')}
        ${navButton('live','Live Study Room','live')}
        ${navButton('roadmap','Roadmap','roadmap')}
        ${navButton('guild','Study Guild','guild')}
        ${navButton('calendar','Calendar','calendar')}
        ${navButton('qae','QAE Arena','qae')}
        ${navButton('mistakes','Mistake Forge','forge')}
        ${navButton('flashcards','Memory Deck','cards')}
        ${navButton('games','Arcade','arcade')}
        ${navButton('avatar','Avatar Closet','avatar')}
        ${navButton('profile','Profile + Settings','settings')}
      </nav>
      <div class="side-player">${renderAvatar(p,'small')}<div><strong>${escapeHtml(p.displayName)}</strong><span>Level ${lvl.level} · ${p.stats.streak || 0}-day streak</span></div></div>
    </aside>
    <main class="main">
      <header class="topbar">
        <button class="hamburger" id="openNavBtn" type="button">${icon('menu')}</button>
        <div><p class="eyebrow">${state.group ? escapeHtml(state.group.name) : 'Solo quest mode'}</p><h2>${viewTitle(state.activeView)}</h2></div>
        <div class="top-actions"><button class="ghost-button" id="themeToggle">${icon(p.preferences.theme === 'light' ? 'moon' : 'sun')}<span>${p.preferences.theme === 'light' ? 'Dark' : 'Light'}</span></button><button class="ghost-button" id="logoutBtn">${icon('logout')}<span>Log out</span></button></div>
      </header>
      <section class="status-strip">
        <div><span>${summary.daysLeft}</span><small>days to exam</small></div>
        <div><span>${summary.percent}%</span><small>roadmap</small></div>
        <div><span>${p.stats.streak || 0}</span><small>streak</small></div>
        <div><span>${p.stats.streakFreezes || 0}</span><small>freezes</small></div>
        <div><span>${p.stats.totalQae || 0}</span><small>QAE logged</small></div>
      </section>
      <div id="viewMount"></div>
    </main>
  `;
  bindShell();
  renderView();
}

function navButton(view,label,iconName){
  return `<button class="nav-btn ${state.activeView===view?'active':''}" data-view="${view}">${icon(iconName)}<span>${label}</span></button>`;
}
function viewTitle(view){
  const map = { dashboard:'Command Center', live:'Live Study Room', roadmap:'Adaptive Roadmap', guild:'Study Guild', calendar:'Calendar Builder', qae:'QAE Arena', mistakes:'Mistake Forge', flashcards:'Memory Deck', games:'ControlQuest Arcade', avatar:'Avatar Closet', profile:'Profile + Settings' };
  return map[view] || 'ControlQuest Studio';
}
function bindShell(){
  $$('.nav-btn').forEach(btn => btn.addEventListener('click', () => { state.activeView = btn.dataset.view; document.body.classList.remove('nav-open'); renderApp(); }));
  $('#themeToggle').addEventListener('click', async () => { state.profile.preferences.theme = state.profile.preferences.theme === 'light' ? 'dark' : 'light'; await saveProfileDebounced(true); applyTheme(); renderApp(); });
  $('#logoutBtn').addEventListener('click', async () => { await logout(); toast('Logged out.'); });
  $('#openNavBtn')?.addEventListener('click', () => document.body.classList.add('nav-open'));
  $('#closeNavBtn')?.addEventListener('click', () => document.body.classList.remove('nav-open'));
}

function renderView(){
  const mount = $('#viewMount');
  const renderers = { dashboard:renderDashboard, live:renderLiveRoom, roadmap:renderRoadmap, guild:renderGuild, calendar:renderCalendar, qae:renderQae, mistakes:renderMistakes, flashcards:renderFlashcards, games:renderGames, avatar:renderAvatarCloset, profile:renderProfile };
  mount.innerHTML = renderers[state.activeView]?.() || renderDashboard();
  bindView();
  startTimerTick();
}

function renderDashboard(){
  const p = state.profile;
  const roadmapDay = currentRoadmapDay(p);
  const summary = progressSummary(p);
  const lvl = levelFromXp(p.stats.xp || 0);
  const challenges = dailyChallenges(p);
  const doneMap = p.progress.dailyChallenges[todayISO()] || {};
  return `<div class="dashboard-grid">
    <section class="hero panel glow-card">
      <div class="hero-copy"><p class="eyebrow">Today’s audit quest</p><h2>${roadmapDay ? escapeHtml(roadmapDay.topic.title) : 'Set your exam date to build the roadmap'}</h2><p>${roadmapDay ? escapeHtml(roadmapDay.topic.focus) : 'Your adaptive roadmap will build itself around your personal exam date.'}</p><div class="hero-actions"><button class="primary-button" data-action="go-live">Open Live Study Room</button><button class="secondary-button" data-action="go-roadmap">View Roadmap</button></div></div>
      <div class="hero-avatar">${renderAvatar(p,'large')}<div class="speech">${escapeHtml(adaptiveMessage(p))}</div></div>
    </section>
    <section class="panel level-panel"><div class="section-head"><div><p class="eyebrow">Level ${lvl.level}</p><h3>${p.stats.xp || 0} XP</h3></div>${icon('level')}</div><div class="progress"><span style="width:${lvl.progress}%"></span></div><p class="helper">${lvl.progress}% toward Level ${lvl.level+1}</p></section>
    <section class="panel streak-panel"><div class="section-head"><div><p class="eyebrow">Streak engine</p><h3>${p.stats.streak || 0} days</h3></div>${icon('flame')}</div><p>${p.stats.streakFreezes || 0} streak freezes available.</p><button class="secondary-button small" data-action="use-freeze">Use streak freeze</button></section>
    <section class="panel"><div class="section-head"><div><p class="eyebrow">Exam countdown</p><h3>${summary.daysLeft} days</h3></div>${icon('calendar')}</div><p>Your personal exam date is ${formatDate(p.studyPlan.examDate,{year:true})}.</p><div class="progress"><span style="width:${summary.percent}%"></span></div></section>
    <section class="panel wide"><div class="section-head"><div><p class="eyebrow">Daily challenges</p><h3>Complete 3 bonus quests today</h3></div>${icon('spark')}</div><div class="quest-grid">${challenges.map(ch => challengeCard(ch, doneMap[ch.key]?.done)).join('')}</div></section>
    <section class="panel"><div class="section-head"><div><p class="eyebrow">Catch-up compass</p><h3>${summary.behindDays} days behind</h3></div>${icon('compass')}</div>${catchUpPlan(p).slice(0,3).map(c=>`<p class="mini-line">${escapeHtml(c.title)}</p>`).join('') || '<p class="helper">No catch-up needed right now.</p>'}</section>
    <section class="panel"><div class="section-head"><div><p class="eyebrow">Group pulse</p><h3>${state.group ? escapeHtml(state.group.name) : 'No group yet'}</h3></div>${icon('group')}</div>${renderGroupPulse()}</section>
  </div>`;
}

function challengeCard(ch, done){
  return `<article class="quest-card ${done?'done':''}"><div class="quest-icon">${icon(ch.type === 'qae' ? 'target' : ch.type === 'mistake' ? 'forge' : ch.type === 'flashcards' ? 'cards' : 'spark')}</div><h4>${escapeHtml(ch.title)}</h4><p>${escapeHtml(ch.description)}</p><strong>+${ch.xp} XP</strong>${done ? '<span class="done-pill">Complete</span>' : `<button class="primary-button small" data-complete-challenge="${ch.key}">Complete</button>`}</article>`;
}

function renderGroupPulse(){
  if(!state.group) return '<p class="helper">Create or join a study group to see buddy progress.</p><button class="secondary-button small" data-action="go-guild">Join group</button>';
  const members = Object.values(state.group.memberSummaries || {});
  return `<div class="member-stack">${members.map(m => `<div class="member-mini"><span>${escapeHtml(m.displayName)}</span><strong>${m.progressPercent || 0}%</strong><em>${m.behindDays || 0} behind</em></div>`).join('')}</div>`;
}

function renderLiveRoom(){
  const p = state.profile;
  const group = state.group;
  const day = currentRoadmapDay(p);
  if(!group) return `<section class="panel empty-state"><img src="assets/mascots/ollie.svg" alt="Ollie"><h2>Join a study group to use live sync.</h2><p>The Live Study Room syncs timer, checklist, notes, and check-ins across every member in the same group.</p><button class="primary-button" data-action="go-guild">Create or join a group</button></section>`;
  const live = normalizedLiveSession(group, p);
  return `<section class="panel live-room">
    <div class="live-hero"><div><p class="eyebrow">Live Study Room</p><h2>${escapeHtml(live.title || 'Study Session')}</h2><p>${escapeHtml(day?.topic?.title || 'Today’s topic')}</p></div><div class="timer-orb"><span id="liveTimer">${timerText(live)}</span><small>${live.active ? 'Live now' : 'Ready'}</small></div></div>
    <div class="live-controls"><button class="primary-button" data-live="start">Start / Resume</button><button class="secondary-button" data-live="pause">Pause</button><button class="secondary-button" data-live="reset">Reset</button><button class="secondary-button" data-live="complete">Complete session</button></div>
    <div class="live-grid">
      <div class="panel nested"><div class="section-head"><h3>Group check-in</h3>${icon('check')}</div><div class="checkin-grid">${Object.entries(group.memberSummaries || {}).map(([uid,m]) => `<button class="check-card ${live.checkins?.[uid]?'checked':''}" data-checkin="${uid}"><span>${escapeHtml(m.displayName)}</span><strong>${live.checkins?.[uid] ? 'Checked in' : 'Not yet'}</strong></button>`).join('')}</div></div>
      <div class="panel nested"><div class="section-head"><h3>Shared session flow</h3>${icon('list')}</div><div class="session-list">${(day?.sessionFlow || []).map(step => `<label class="session-step"><input type="checkbox" data-live-task="${step.id}" ${live.checklist?.[step.id]?'checked':''}><span><strong>${escapeHtml(step.label)}</strong><em>${step.minutes} min · ${escapeHtml(step.prompt)}</em></span></label>`).join('')}</div></div>
      <div class="panel nested"><div class="section-head"><h3>Today’s plan</h3>${icon('map')}</div>${(day?.checklist || []).map(t => `<p class="task-line"><strong>${escapeHtml(t.label)}</strong><span>${escapeHtml(t.detail)}</span></p>`).join('')}</div>
      <div class="panel nested"><div class="section-head"><h3>Shared notes + homework</h3>${icon('notes')}</div><textarea id="liveNotes" placeholder="Topic, QAE misses, CISA rules, tomorrow’s start point...">${escapeHtml(live.notes || '')}</textarea><div class="inline-form"><input id="homeworkInput" placeholder="Add after-session homework"><button class="secondary-button" data-action="add-homework">Add</button></div></div>
    </div>
  </section>`;
}

function renderRoadmap(){
  const p = state.profile;
  const roadmap = generateRoadmap(p);
  const domains = domainCompletion(p);
  const weeks = groupBy(roadmap, r => r.activeWeek);
  return `<section class="panel"><div class="section-head"><div><p class="eyebrow">Adaptive personal roadmap</p><h2>Your plan bends without breaking</h2><p class="helper">Exam date and pause blocks are personal to you, not the whole group.</p></div>${icon('roadmap')}</div>
    <div class="settings-grid"><label>Start date<input type="date" id="startDate" value="${p.studyPlan.startDate}"></label><label>Exam date<input type="date" id="examDate" value="${p.studyPlan.examDate}"></label><label>QAE/day<input type="number" min="1" max="75" id="qaeGoal" value="${p.studyPlan.dailyQaeGoal || 10}"></label><label>Session duration<input type="number" min="15" max="180" id="sessionDuration" value="${p.studyPlan.sessionDuration || 60}"></label></div>
    <div class="domain-grid">${domains.map(d => `<div class="domain-card"><span style="--d:${d.color}">${d.id}</span><strong>${d.percent}%</strong><p>${escapeHtml(d.short)}</p><div class="progress"><i style="width:${d.percent}%;background:${d.color}"></i></div></div>`).join('')}</div>
    <div class="button-row"><button class="secondary-button" data-action="add-pause">Add pause block</button><button class="secondary-button" data-action="mark-today-missed">Mark today missed</button><button class="primary-button" data-action="save-plan">Save plan changes</button></div>
    <div class="roadmap-weeks">${Object.entries(weeks).map(([week,items]) => `<details class="week-card" ${items.some(i=>i.date>=todayISO())?'open':''}><summary><span>Week ${week}</span><strong>${items.filter(i => i.status==='done').length}/${items.length} days complete</strong></summary><div class="week-days">${items.map(dayCard).join('')}</div></details>`).join('')}</div>
  </section>`;
}

function dayCard(r){
  const status = state.profile.progress.roadmapStatus?.[r.date]?.status || r.status;
  return `<article class="day-card ${status}"><div><p class="eyebrow">${formatDate(r.date,{weekday:true})} · ${r.domain.id}</p><h4>${escapeHtml(r.topic.title)}</h4><p>${escapeHtml(r.topic.focus)}</p></div><div class="task-chips">${r.topic.tasks.slice(0,3).map(t=>`<span>${escapeHtml(t)}</span>`).join('')}</div><div class="button-row"><button class="secondary-button small" data-day-status="done" data-day="${r.date}">Done</button><button class="secondary-button small" data-day-status="missed" data-day="${r.date}">Missed</button><button class="secondary-button small" data-open-day="${r.date}">Open</button></div></article>`;
}

function renderGuild(){
  const p = state.profile;
  const group = state.group;
  return `<div class="guild-layout"><section class="panel"><div class="section-head"><div><p class="eyebrow">Study groups</p><h2>${group ? escapeHtml(group.name) : 'Create or join a guild'}</h2><p class="helper">Groups show high-level progress only. Private mistake logs, flashcards, and personal settings stay in each user profile.</p></div>${icon('group')}</div>
    ${group ? renderActiveGroup(group) : '<p class="empty-line">No active group yet. Create one or join with a group ID and invite code.</p>'}
  </section><section class="panel"><h3>Create a study group</h3><div class="inline-stack"><label>Group name<input id="newGroupName" placeholder="Example: Ty & Comply Guild"></label><button class="primary-button" data-action="create-group">Create group</button></div><hr><h3>Join a study group</h3><div class="inline-stack"><label>Group ID<input id="joinGroupId" placeholder="group-id"></label><label>Invite code<input id="joinGroupCode" placeholder="ABC123"></label><button class="secondary-button" data-action="join-group">Join group</button></div></section></div>`;
}

function renderActiveGroup(group){
  const members = Object.values(group.memberSummaries || {});
  return `<div class="invite-card"><div><p class="eyebrow">Invite details</p><h3>${escapeHtml(group.id)}</h3><p>Invite code: <strong>${escapeHtml(group.joinCode)}</strong></p></div><button class="secondary-button" data-action="copy-invite">Copy invite</button></div>
  <div class="guild-members">${members.map(m => `<article class="guild-member"><div class="tiny-avatar">${renderMiniAvatar(m.avatar)}</div><div><h4>${escapeHtml(m.displayName)}</h4><p>Level ${m.level || 1} · ${m.streak || 0}-day streak · ${m.totalQae || 0} QAE</p><div class="progress"><span style="width:${m.progressPercent || 0}%"></span></div><small>${m.progressPercent || 0}% roadmap · ${m.behindDays || 0} days behind</small></div></article>`).join('')}</div>
  <div class="catchup-box"><h3>Buddy catch-up ideas</h3>${members.sort((a,b)=>(b.behindDays||0)-(a.behindDays||0)).slice(0,3).map(m => `<p><strong>${escapeHtml(m.displayName)}</strong>: ${catchupAdvice(m.behindDays || 0)}</p>`).join('')}</div>
  <div class="button-row"><button class="secondary-button" data-action="sync-summary">Sync my summary</button><button class="danger-button" data-action="leave-group">Leave group</button></div>`;
}

function renderCalendar(){
  const p = state.profile, g = state.group;
  const days = p.studyPlan.sessionDays || [1,2,3,4,5];
  return `<section class="panel"><div class="section-head"><div><p class="eyebrow">Personal + group calendar</p><h2>Build study sessions without locking yourself in</h2></div>${icon('calendar')}</div>
    <div class="calendar-grid"><div class="panel nested"><h3>Personal study calendar</h3><label>Time<input type="time" id="personalTime" value="${p.studyPlan.sessionTime || '07:00'}"></label><label>Duration minutes<input type="number" id="personalDuration" value="${p.studyPlan.sessionDuration || 60}"></label><div class="days-picker">${weekdayPicker(days,'personalDay')}</div><button class="primary-button full" data-action="download-personal-ics">Download recurring personal .ics</button></div>
    <div class="panel nested"><h3>Group shared calendar</h3>${g ? `<label>Group time<input type="time" id="groupTime" value="${g.schedule?.time || '07:00'}"></label><label>Duration minutes<input type="number" id="groupDuration" value="${g.schedule?.duration || 60}"></label><div class="days-picker">${weekdayPicker(g.schedule?.days || [1,2,3,4,5],'groupDay')}</div><button class="primary-button full" data-action="save-group-schedule">Save group schedule</button><button class="secondary-button full" data-action="download-group-ics">Download group .ics</button>` : '<p class="helper">Join a group to manage shared sessions.</p>'}</div>
    <div class="panel nested"><h3>Extra session</h3><label>Title<input id="extraTitle" value="Weekend QAE Power Hour"></label><label>Date<input type="date" id="extraDate" value="${todayISO()}"></label><label>Time<input type="time" id="extraTime" value="10:00"></label><label>Minutes<input type="number" id="extraDuration" value="60"></label><button class="secondary-button full" data-action="download-extra-ics">Download one-off .ics</button></div></div>
  </section>`;
}
function weekdayPicker(selected,name){
  const labels = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  return labels.map((l,i)=>`<label class="day-pill"><input type="checkbox" name="${name}" value="${i}" ${selected.includes(i)?'checked':''}>${l}</label>`).join('');
}

function renderQae(){
  const logs = state.profile.progress.qaeLogs || [];
  const byDomain = DOMAINS.map(d => {
    const arr = logs.filter(l => l.domain === d.id);
    const correct = arr.reduce((a,l)=>a+(Number(l.correct)||0),0), total = arr.reduce((a,l)=>a+(Number(l.total)||0),0);
    return { ...d, total, correct, pct: total ? Math.round(correct/total*100) : 0 };
  });
  return `<section class="panel"><div class="section-head"><div><p class="eyebrow">QAE Arena</p><h2>Practice like it is a scoreboard</h2></div>${icon('target')}</div>
    <div class="settings-grid compact"><label>Domain<select id="qaeDomain">${DOMAINS.map(d=>`<option value="${d.id}">${d.id} · ${d.short}</option>`).join('')}<option value="MIX">MIX · Mixed</option></select></label><label>Correct<input type="number" id="qaeCorrect" min="0" value="8"></label><label>Total<input type="number" id="qaeTotal" min="1" value="10"></label><label>Notes<input id="qaeNotes" placeholder="Trap or theme"></label></div><button class="primary-button" data-action="log-qae">Log QAE round</button>
    <div class="domain-grid">${byDomain.map(d => `<div class="domain-card"><span style="--d:${d.color}">${d.id}</span><strong>${d.pct}%</strong><p>${d.total} questions</p><div class="progress"><i style="width:${d.pct}%;background:${d.color}"></i></div></div>`).join('')}</div>
    <div class="log-list">${logs.slice(0,12).map(l=>`<div class="log-row"><span>${formatDate(l.date)}</span><strong>${l.domain}</strong><em>${l.correct}/${l.total}</em><p>${escapeHtml(l.notes || '')}</p></div>`).join('') || '<p class="helper">No QAE rounds logged yet.</p>'}</div>
  </section>`;
}

function renderMistakes(){
  const mistakes = state.profile.progress.mistakes || [];
  return `<section class="panel"><div class="section-head"><div><p class="eyebrow">Mistake Forge</p><h2>Turn wrong answers into rules</h2></div>${icon('forge')}</div>
    <div class="settings-grid"><label>Domain<select id="mistakeDomain">${DOMAINS.map(d=>`<option value="${d.id}">${d.id} · ${d.short}</option>`).join('')}<option value="MIX">MIX</option></select></label><label>Trap<input id="mistakeTrap" placeholder="Example: jumped to remediation too early"></label><label>Correct CISA logic<textarea id="mistakeLogic" placeholder="The auditor should first determine cause and impact..."></textarea></label><label>Retest date<input type="date" id="mistakeRetest" value="${addDays(todayISO(),7)}"></label></div><button class="primary-button" data-action="add-mistake">Forge mistake lesson</button>
    <div class="card-list">${mistakes.slice(0,20).map(m=>`<article class="memory-card"><p class="eyebrow">${m.domain} · retest ${formatDate(m.retestDate)}</p><h4>${escapeHtml(m.trap)}</h4><p>${escapeHtml(m.logic)}</p><button class="secondary-button small" data-mark-retested="${m.id}">Mark reviewed</button></article>`).join('') || '<p class="helper">No mistakes forged yet.</p>'}</div>
  </section>`;
}

function renderFlashcards(){
  const cards = state.profile.progress.flashcards || [];
  return `<section class="panel"><div class="section-head"><div><p class="eyebrow">Memory Deck</p><h2>Quizlet-ready cards</h2></div>${icon('cards')}</div>
    <div class="settings-grid"><label>Front<input id="cardFront" placeholder="What does RPO mean?"></label><label>Back<textarea id="cardBack" placeholder="The acceptable amount of data loss measured in time."></textarea></label><label>Domain<select id="cardDomain">${DOMAINS.map(d=>`<option value="${d.id}">${d.id}</option>`).join('')}<option value="MIX">MIX</option></select></label></div><button class="primary-button" data-action="add-card">Add flashcard</button><button class="secondary-button" data-action="export-quizlet">Export Quizlet TSV</button>
    <div class="card-list flip-list">${cards.slice(0,24).map(c=>`<article class="flip-card" data-flip><div class="front"><p class="eyebrow">${c.domain}</p><h4>${escapeHtml(c.front)}</h4></div><div class="back"><p>${escapeHtml(c.back)}</p></div></article>`).join('') || '<p class="helper">No flashcards yet.</p>'}</div>
  </section>`;
}

function renderGames(){
  const q = state.activeGame || GAME_QUESTIONS.filter(x=>x.mode==='bestFirst')[Math.floor(Math.random()*5)];
  state.activeGame = q;
  const terms = GAME_QUESTIONS.filter(x=>x.mode==='termMatch').slice(0,5);
  return `<div class="games-grid"><section class="panel game-panel"><div class="section-head"><div><p class="eyebrow">Best / First Blitz</p><h2>Think like ISACA</h2></div>${icon('arcade')}</div><p class="game-prompt">${escapeHtml(q.prompt)}</p><div class="choice-grid">${q.choices.map((c,i)=>`<button class="choice" data-game-choice="${i}">${escapeHtml(c)}</button>`).join('')}</div><p class="helper" id="gameWhy"></p></section>
  <section class="panel"><h3>Term Match warm-up</h3>${terms.map(t => `<details class="term-card"><summary>${escapeHtml(t.term)}</summary><p>${escapeHtml(t.definition)}</p><button class="secondary-button small" data-term-xp="${t.term}">I knew this</button></details>`).join('')}</section>
  <section class="panel"><h3>Weekend boost ideas</h3><p>Complete one extra QAE block, one visual map, or one teach-back recording on the weekend to earn bonus XP without messing up the weekday plan.</p><button class="primary-button" data-action="weekend-boost">Log weekend boost</button></section></div>`;
}

function renderAvatarCloset(){
  const p = state.profile;
  const a = p.avatar;
  return `<section class="panel"><div class="section-head"><div><p class="eyebrow">Avatar Closet</p><h2>Make your audit buddy yours</h2></div>${renderAvatar(p,'medium')}</div>
    <h3>Base color</h3><div class="color-row">${AVATAR_ITEMS.baseColors.map(c=>`<button class="color-swatch ${a.baseColor===c?'active':''}" style="background:${c}" data-avatar-color="${c}"></button>`).join('')}</div>
    ${avatarItemSection('capes','cape')}${avatarItemSection('glasses','glasses')}${avatarItemSection('accessories','accessory')}
  </section>`;
}
function avatarItemSection(type, prop){
  const p = state.profile;
  return `<h3>${type[0].toUpperCase()+type.slice(1)}</h3><div class="closet-grid">${AVATAR_ITEMS[type].map(item => { const unlocked = isAvatarItemUnlocked(p,type,item.id); return `<button class="closet-item ${p.avatar[prop]===item.id?'active':''} ${unlocked?'':'locked'}" data-avatar-prop="${prop}" data-avatar-value="${item.id}" ${unlocked?'':'disabled'}><strong>${escapeHtml(item.name)}</strong><span>${unlocked?'Unlocked':`Unlock: ${item.unlock}`}</span></button>`; }).join('')}</div>`;
}

function renderProfile(){
  const p = state.profile;
  return `<div class="profile-grid"><section class="panel"><div class="section-head"><div><p class="eyebrow">Profile</p><h2>${escapeHtml(p.displayName)}</h2></div>${renderAvatar(p,'small')}</div><label>Display name<input id="displayName" value="${escapeAttr(p.displayName)}"></label><label>Timezone<input id="timezone" value="${escapeAttr(p.preferences.timezone || '')}"></label><button class="primary-button" data-action="save-profile">Save profile</button><button class="secondary-button" data-action="show-tutorial">Replay tutorial</button><button class="secondary-button" data-action="export-backup">Export my profile JSON</button></section>
  <section class="panel"><h3>Danger zone</h3><p class="helper">Deleting your profile first creates a backup under <code>deletedProfiles/{your uid}/backups</code>. This protects you from accidental deletion.</p><button class="danger-button" data-action="delete-profile">Delete profile</button></section>
  <section class="panel"><h3>How this site stores data</h3><p>Your private roadmap, QAE logs, mistakes, flashcards, exam date, streak, avatar, and settings live in your private user profile. Study groups only store high-level member summaries and live session data.</p></section></div>`;
}

function bindView(){
  $$('[data-action]').forEach(btn => btn.addEventListener('click', () => handleAction(btn.dataset.action, btn)));
  $$('[data-complete-challenge]').forEach(btn => btn.addEventListener('click', () => completeChallenge(btn.dataset.completeChallenge)));
  $$('[data-live]').forEach(btn => btn.addEventListener('click', () => handleLive(btn.dataset.live)));
  $$('[data-live-task]').forEach(cb => cb.addEventListener('change', () => updateLiveTask(cb.dataset.liveTask, cb.checked)));
  $$('[data-checkin]').forEach(btn => btn.addEventListener('click', () => liveCheckin(btn.dataset.checkin)));
  $('#liveNotes')?.addEventListener('change', async e => { state.group.liveSession.notes = e.target.value; await saveGroup(state.group); });
  $$('[data-day-status]').forEach(btn => btn.addEventListener('click', () => markRoadmapDay(btn.dataset.day, btn.dataset.dayStatus)));
  $$('[data-open-day]').forEach(btn => btn.addEventListener('click', () => openDayModal(btn.dataset.openDay)));
  $$('[data-mark-retested]').forEach(btn => btn.addEventListener('click', () => markMistakeRetested(btn.dataset.markRetested)));
  $$('[data-flip]').forEach(card => card.addEventListener('click', () => card.classList.toggle('flipped')));
  $$('[data-game-choice]').forEach(btn => btn.addEventListener('click', () => answerGame(Number(btn.dataset.gameChoice))));
  $$('[data-term-xp]').forEach(btn => btn.addEventListener('click', () => { awardXp(state.profile, 10, `Term reviewed: ${btn.dataset.termXp}`); saveProfileDebounced(true); toast('+10 XP. Term reviewed.'); }));
  $$('[data-avatar-color]').forEach(btn => btn.addEventListener('click', () => { state.profile.avatar.baseColor = btn.dataset.avatarColor; saveProfileDebounced(true); renderApp(); }));
  $$('[data-avatar-prop]').forEach(btn => btn.addEventListener('click', () => { state.profile.avatar[btn.dataset.avatarProp] = btn.dataset.avatarValue; awardXp(state.profile, 5, 'Avatar customized'); saveProfileDebounced(true); renderApp(); }));
}

async function handleAction(action){
  try{
    if(action === 'go-live') { state.activeView='live'; renderApp(); }
    if(action === 'go-roadmap') { state.activeView='roadmap'; renderApp(); }
    if(action === 'go-guild') { state.activeView='guild'; renderApp(); }
    if(action === 'use-freeze') { if(useStreakFreeze(state.profile)) { await saveProfileNow(); toast('Streak freeze used. No shame. Keep moving.'); } else toast('No streak freezes available.', 'warn'); }
    if(action === 'save-plan') await savePlanInputs();
    if(action === 'add-pause') await addPauseBlock();
    if(action === 'mark-today-missed') await markRoadmapDay(todayISO(),'missed');
    if(action === 'create-group') await createStudyGroup();
    if(action === 'join-group') await joinStudyGroup();
    if(action === 'copy-invite') copyInvite();
    if(action === 'sync-summary') { await syncSummary(); toast('Your high-level group summary is synced.'); }
    if(action === 'leave-group') await doLeaveGroup();
    if(action === 'download-personal-ics') downloadPersonalIcs();
    if(action === 'save-group-schedule') await saveGroupSchedule();
    if(action === 'download-group-ics') downloadGroupIcs();
    if(action === 'download-extra-ics') downloadExtraIcs();
    if(action === 'log-qae') await logQae();
    if(action === 'add-mistake') await addMistake();
    if(action === 'add-card') await addFlashcard();
    if(action === 'export-quizlet') exportQuizlet();
    if(action === 'weekend-boost') { awardXp(state.profile, 75, 'Weekend boost completed'); updateStreak(state.profile); await saveProfileNow(); toast('Weekend boost logged. +75 XP.'); }
    if(action === 'save-profile') await saveProfileSettings();
    if(action === 'show-tutorial') showTutorial(true);
    if(action === 'export-backup') exportProfileBackup(state.profile);
    if(action === 'delete-profile') showDeleteProfileModal();
    if(action === 'add-homework') await addHomework();
  }catch(error){ toast(error.message, 'error'); }
}

async function completeChallenge(key){
  const ch = dailyChallenges(state.profile).find(c=>c.key===key);
  if(!ch) return;
  const evidence = prompt(`${ch.title}\n\n${ch.description}\n\nWhat did you complete?`, '');
  if(evidence === null) return;
  if(completeDailyChallenge(state.profile,ch,evidence)){
    await saveProfileNow();
    toast(`${ch.title} complete. +${ch.xp} XP.`);
    renderApp();
  } else toast('Already completed today.');
}

async function savePlanInputs(){
  state.profile.studyPlan.startDate = $('#startDate').value;
  state.profile.studyPlan.examDate = $('#examDate').value;
  state.profile.studyPlan.dailyQaeGoal = Number($('#qaeGoal').value || 10);
  state.profile.studyPlan.sessionDuration = Number($('#sessionDuration').value || 60);
  await saveProfileNow();
  toast('Personal roadmap recalculated.');
  renderApp();
}
async function addPauseBlock(){
  const start = prompt('Pause start date (YYYY-MM-DD):', todayISO()); if(!start) return;
  const end = prompt('Pause end date (YYYY-MM-DD):', start); if(!end) return;
  const reason = prompt('Reason for pause:', 'Travel / client work / PTO') || 'Pause block';
  state.profile.studyPlan.pauseBlocks = state.profile.studyPlan.pauseBlocks || [];
  state.profile.studyPlan.pauseBlocks.push({ id:crypto.randomUUID(), start, end, reason });
  await saveProfileNow();
  toast('Pause block added. Roadmap now skips those days.');
}
async function markRoadmapDay(date,status){
  const day = generateRoadmap(state.profile).find(r=>r.date===date);
  state.profile.progress.roadmapStatus[date] = { status, domain:day?.domain?.id || 'MIX', topic:day?.topic?.title || '', updatedAt:new Date().toISOString() };
  if(status === 'done'){
    awardXp(state.profile, 80, `Roadmap day complete: ${day?.topic?.title || date}`);
    updateStreak(state.profile, date);
  }
  await saveProfileNow();
  toast(`Roadmap day marked ${status}.`);
  renderApp();
}

function openDayModal(date){
  const day = generateRoadmap(state.profile).find(r=>r.date===date);
  if(!day) return;
  showModal(`<div class="modal-card big"><button class="modal-close" data-close-modal>×</button><p class="eyebrow">${formatDate(date,{weekday:true,year:true})} · ${day.domain.id}</p><h2>${escapeHtml(day.topic.title)}</h2><p>${escapeHtml(day.topic.focus)}</p><h3>Session plan</h3>${day.sessionFlow.map(s=>`<p class="task-line"><strong>${escapeHtml(s.label)} · ${s.minutes} min</strong><span>${escapeHtml(s.prompt)}</span></p>`).join('')}<h3>Day tasks</h3>${day.checklist.map(t=>`<p class="task-line"><strong>${escapeHtml(t.label)}</strong><span>${escapeHtml(t.detail)}</span></p>`).join('')}<button class="primary-button" data-day-status="done" data-day="${date}">Mark day complete</button></div>`);
  bindView();
}

async function createStudyGroup(){
  const name = $('#newGroupName').value.trim() || 'CISA Study Guild';
  const group = defaultGroup(state.user.uid, state.profile, name);
  await createGroup(group);
  state.profile.groups = [...new Set([...(state.profile.groups || []), group.id])];
  state.profile.activeGroupId = group.id;
  await saveProfileNow();
  attachGroup(group.id);
  toast('Study group created. Share the group ID and invite code.');
}
async function joinStudyGroup(){
  const id = $('#joinGroupId').value.trim();
  const code = $('#joinGroupCode').value.trim();
  if(!id || !code) return toast('Enter both group ID and invite code.', 'warn');
  const group = await joinGroup(id, code, state.profile);
  state.profile.groups = [...new Set([...(state.profile.groups || []), id])];
  state.profile.activeGroupId = id;
  await saveProfileNow();
  attachGroup(id);
  toast(`Joined ${group.name}.`);
}
function copyInvite(){
  const g = state.group;
  const text = `Join my ControlQuest study group\nGroup ID: ${g.id}\nInvite code: ${g.joinCode}`;
  navigator.clipboard?.writeText(text);
  toast('Invite copied.');
}
async function syncSummary(){ await updateMemberSummary(state.group.id, state.profile); }
async function doLeaveGroup(){
  if(!confirm('Leave this study group? Your personal profile and progress will stay intact.')) return;
  await leaveGroup(state.group.id, state.profile);
  state.profile.groups = (state.profile.groups || []).filter(g=>g!==state.group.id);
  state.profile.activeGroupId = state.profile.groups[0] || null;
  await saveProfileNow();
  state.group = null;
  toast('Left group.');
}

function normalizedLiveSession(group, profile){
  if(!group.liveSession || group.liveSession.date !== todayISO()){
    group.liveSession = emptyLiveSession();
    group.liveSession.durationMinutes = group.schedule?.duration || profile.studyPlan.sessionDuration || 60;
    group.liveSession.title = group.schedule?.label || 'Live Study Session';
  }
  return group.liveSession;
}
async function handleLive(action){
  const live = normalizedLiveSession(state.group, state.profile);
  if(action === 'start'){
    if(!live.active){ live.active = true; live.startedAt = new Date().toISOString(); live.pausedAt = null; }
  }
  if(action === 'pause'){
    if(live.active){ live.accumulatedSeconds = elapsedSeconds(live); live.active = false; live.pausedAt = new Date().toISOString(); }
  }
  if(action === 'reset'){
    if(!confirm('Reset the shared live timer and checklist for everyone in this group?')) return;
    state.group.liveSession = emptyLiveSession();
    state.group.liveSession.durationMinutes = state.group.schedule?.duration || state.profile.studyPlan.sessionDuration || 60;
  }
  if(action === 'complete'){
    live.active = false; live.accumulatedSeconds = live.durationMinutes * 60;
    state.group.liveSession = live;
    state.profile.stats.totalSessions = (state.profile.stats.totalSessions || 0) + 1;
    awardXp(state.profile, 120, 'Live group session completed'); updateStreak(state.profile);
    await saveProfileNow();
  }
  state.group.liveSession.updatedAt = new Date().toISOString();
  await saveGroup(state.group);
  renderApp();
}
async function updateLiveTask(id, checked){
  const live = normalizedLiveSession(state.group, state.profile);
  live.checklist[id] = checked;
  live.updatedAt = new Date().toISOString();
  if(checked){ awardXp(state.profile, 8, `Live checklist: ${id}`); await saveProfileNow(); }
  await saveGroup(state.group);
}
async function liveCheckin(uid){
  const live = normalizedLiveSession(state.group, state.profile);
  if(uid !== state.user.uid && !confirm('Check in this person? Usually each person should check themselves in.')) return;
  live.checkins[uid] = !live.checkins[uid];
  if(live.checkins[uid] && uid === state.user.uid){ awardXp(state.profile, 15, 'Live room check-in'); updateStreak(state.profile); await saveProfileNow(); }
  await saveGroup(state.group);
}
async function addHomework(){
  const value = $('#homeworkInput').value.trim(); if(!value) return;
  state.profile.progress.homework.unshift({ id:crypto.randomUUID(), title:value, date:todayISO(), status:'open', source:'live-room' });
  awardXp(state.profile, 10, 'Homework planned');
  await saveProfileNow();
  $('#homeworkInput').value = '';
  toast('Homework added to your profile.');
}
function elapsedSeconds(live){
  const base = live.accumulatedSeconds || 0;
  if(!live.active || !live.startedAt) return base;
  return base + Math.floor((Date.now() - new Date(live.startedAt).getTime()) / 1000);
}
function timerText(live){
  const duration = (live.durationMinutes || 60) * 60;
  const remaining = Math.max(0, duration - elapsedSeconds(live));
  const m = Math.floor(remaining / 60), s = remaining % 60;
  return `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
}
function startTimerTick(){
  if(state.timerTick) return;
  state.timerTick = setInterval(() => { const el = $('#liveTimer'); if(el && state.group?.liveSession) el.textContent = timerText(state.group.liveSession); }, 1000);
}
function stopTimerTick(){ if(state.timerTick){ clearInterval(state.timerTick); state.timerTick = null; } }

function selectedDays(name){ return $$(`input[name="${name}"]:checked`).map(x=>Number(x.value)); }
function downloadPersonalIcs(){
  const time = $('#personalTime').value, duration = Number($('#personalDuration').value || 60), days = selectedDays('personalDay');
  downloadIcs({ title:'ControlQuest Personal CISA Study', description:'Personal ControlQuest CISA study block.', startDate:state.profile.studyPlan.startDate, time, durationMinutes:duration, recurrence:recurrenceRuleForDays(days,state.profile.studyPlan.examDate), attendees:[state.profile.email] });
}
async function saveGroupSchedule(){
  state.group.schedule.time = $('#groupTime').value;
  state.group.schedule.duration = Number($('#groupDuration').value || 60);
  state.group.schedule.days = selectedDays('groupDay');
  await saveGroup(state.group);
  toast('Group schedule saved.');
}
function downloadGroupIcs(){
  const g = state.group;
  const emails = Object.values(g.memberSummaries || {}).map(m=>m.email).filter(Boolean);
  downloadIcs({ title:`${g.name} Study Session`, description:'Shared ControlQuest CISA study session.', startDate:state.profile.studyPlan.startDate, time:g.schedule.time, durationMinutes:g.schedule.duration, recurrence:recurrenceRuleForDays(g.schedule.days,state.profile.studyPlan.examDate), attendees:emails });
}
function downloadExtraIcs(){
  downloadIcs({ title:$('#extraTitle').value, description:'Extra ControlQuest study session.', startDate:$('#extraDate').value, time:$('#extraTime').value, durationMinutes:Number($('#extraDuration').value || 60), attendees:[state.profile.email] });
}

async function logQae(){
  const total = Number($('#qaeTotal').value || 0), correct = Number($('#qaeCorrect').value || 0);
  if(!total || correct > total) return toast('Enter a valid QAE score.', 'warn');
  const log = { id:crypto.randomUUID(), date:todayISO(), domain:$('#qaeDomain').value, correct, total, notes:$('#qaeNotes').value.trim() };
  state.profile.progress.qaeLogs.unshift(log);
  state.profile.stats.totalQae = (state.profile.stats.totalQae || 0) + total;
  awardXp(state.profile, Math.max(20, Math.round(total * 4 + correct)), `QAE round: ${correct}/${total}`); updateStreak(state.profile);
  await saveProfileNow(); toast('QAE round logged.'); renderApp();
}
async function addMistake(){
  const trap = $('#mistakeTrap').value.trim(), logic = $('#mistakeLogic').value.trim(); if(!trap || !logic) return toast('Add both the trap and the correct CISA logic.', 'warn');
  state.profile.progress.mistakes.unshift({ id:crypto.randomUUID(), date:todayISO(), domain:$('#mistakeDomain').value, trap, logic, retestDate:$('#mistakeRetest').value, reviewed:false });
  state.profile.stats.totalMistakes = (state.profile.stats.totalMistakes || 0) + 1;
  awardXp(state.profile, 55, 'Mistake lesson forged'); updateStreak(state.profile);
  await saveProfileNow(); toast('Mistake forged.'); renderApp();
}
async function markMistakeRetested(id){
  const m = state.profile.progress.mistakes.find(x=>x.id===id); if(!m) return;
  m.reviewed = true; m.reviewedAt = new Date().toISOString(); awardXp(state.profile, 20, 'Mistake retested'); await saveProfileNow(); renderApp();
}
async function addFlashcard(){
  const front = $('#cardFront').value.trim(), back = $('#cardBack').value.trim(); if(!front || !back) return toast('Add both front and back.', 'warn');
  state.profile.progress.flashcards.unshift({ id:crypto.randomUUID(), date:todayISO(), domain:$('#cardDomain').value, front, back });
  state.profile.stats.totalFlashcards = (state.profile.stats.totalFlashcards || 0) + 1;
  awardXp(state.profile, 25, 'Flashcard created'); await saveProfileNow(); toast('Flashcard added.'); renderApp();
}
function exportQuizlet(){
  const rows = (state.profile.progress.flashcards || []).map(c => `${c.front.replace(/\t/g,' ')}\t${c.back.replace(/\t/g,' ')}`).join('\n');
  const blob = new Blob([rows], {type:'text/tab-separated-values'}); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href=url; a.download='controlquest-quizlet.tsv'; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
}
function answerGame(choice){
  const q = state.activeGame;
  const ok = choice === q.answer;
  $$('.choice').forEach((b,i)=>b.classList.toggle(i===q.answer?'correct':'wrong', i===choice || i===q.answer));
  $('#gameWhy').textContent = `${ok ? 'Correct.' : 'Not quite.'} ${q.why}`;
  if(ok){ awardXp(state.profile, 35, 'Arcade answer correct'); state.profile.stats.arcadeWins = (state.profile.stats.arcadeWins || 0) + 1; saveProfileDebounced(true); }
  setTimeout(() => { state.activeGame = null; renderApp(); }, 2600);
}

async function saveProfileSettings(){
  state.profile.displayName = $('#displayName').value.trim() || state.profile.displayName;
  state.profile.preferences.timezone = $('#timezone').value.trim() || state.profile.preferences.timezone;
  await saveProfileNow(); toast('Profile saved.'); renderApp();
}
function showDeleteProfileModal(){
  showModal(`<div class="modal-card"><button class="modal-close" data-close-modal>×</button><p class="eyebrow">Danger zone</p><h2>Delete profile</h2><p>This will create a backup in Firestore first, then remove your ControlQuest profile data and group membership summaries. Type <strong>DELETE MY PROFILE</strong> to continue.</p><input id="deletePhrase" placeholder="DELETE MY PROFILE"><label class="check-row"><input type="checkbox" id="deleteAuthToo"> Also delete my Firebase Auth login</label><label>Password required only if deleting Auth login<input type="password" id="deletePassword"></label><button class="danger-button full" id="confirmDelete1">Continue deletion</button></div>`);
  $('#confirmDelete1').addEventListener('click', () => {
    if($('#deletePhrase').value !== 'DELETE MY PROFILE') return toast('Phrase did not match.', 'warn');
    if(!confirm('Second check: this removes your active profile after making a backup. Continue?')) return;
    if(!confirm('Final check: are you absolutely sure?')) return;
    archiveAndDeleteProfile(state.profile, $('#deletePassword').value, $('#deleteAuthToo').checked).then(id => { toast(`Profile archived and deleted. Backup: ${id}`); closeModal(); }).catch(err => toast(err.message, 'error'));
  });
}

function showTutorial(force=false){
  if(!force && state.profile?.onboarding?.completed) return;
  const steps = [
    ['Welcome to ControlQuest', 'This is your CISA study operating system. Your private profile stores your roadmap, exam date, streak, QAE logs, mistakes, flashcards, and avatar.'],
    ['Join a study guild', 'Use Study Guild to create or join a group. The group only shows high-level summaries, so buddies can see pace without seeing private notes.'],
    ['Run the Live Study Room', 'The Live Study Room syncs the timer, checklist, check-ins, and shared notes across everyone in the group in real time.'],
    ['Follow your adaptive roadmap', 'Your exam date is personal. If you push the exam back or add a pause block, your roadmap recalculates without affecting anyone else.'],
    ['Use the game loop', 'Complete daily challenges, QAE rounds, Mistake Forge entries, flashcards, and arcade games to earn XP, badges, streak freezes, and avatar gear.']
  ];
  state.tutorialStep = 0;
  const draw = () => {
    const [title, text] = steps[state.tutorialStep];
    showModal(`<div class="modal-card tutorial"><img src="assets/mascots/ollie.svg" alt="Ollie"><p class="eyebrow">Step ${state.tutorialStep+1} of ${steps.length}</p><h2>${title}</h2><p>${text}</p><div class="button-row"><button class="secondary-button" id="tutorialSkip">Skip</button><button class="primary-button" id="tutorialNext">${state.tutorialStep === steps.length-1 ? 'Start questing' : 'Next'}</button></div></div>`);
    $('#tutorialSkip').addEventListener('click', completeTutorial);
    $('#tutorialNext').addEventListener('click', () => { if(state.tutorialStep < steps.length-1){ state.tutorialStep += 1; draw(); } else completeTutorial(); });
  };
  draw();
}
async function completeTutorial(){ state.profile.onboarding.completed = true; state.profile.preferences.tutorialSeen = true; await saveProfileNow(); closeModal(); }

async function saveProfileDebounced(immediate=false){
  if(immediate) return saveProfileNow();
  clearTimeout(state.pendingProfileSave);
  state.pendingProfileSave = setTimeout(saveProfileNow, 600);
}
async function saveProfileNow(){
  state.profile.updatedAt = new Date().toISOString();
  await saveProfile(state.profile);
  if(state.profile.activeGroupId) await updateMemberSummary(state.profile.activeGroupId, state.profile).catch(()=>{});
}
function applyTheme(){ document.body.className = `${state.profile?.preferences?.theme === 'light' ? 'theme-light' : 'theme-dark'}${document.body.classList.contains('nav-open') ? ' nav-open' : ''}`; }

function showModal(html){
  closeModal();
  const wrap = document.createElement('div'); wrap.className = 'modal-layer'; wrap.innerHTML = html; document.body.appendChild(wrap);
  $$('[data-close-modal]', wrap).forEach(b => b.addEventListener('click', closeModal));
  wrap.addEventListener('click', e => { if(e.target === wrap) closeModal(); });
}
function closeModal(){ $('.modal-layer')?.remove(); }
function toast(message,type='ok'){
  const layer = $('#toastLayer'); const el = document.createElement('div'); el.className = `toast ${type}`; el.textContent = message; layer.appendChild(el); setTimeout(()=>el.remove(), 4200);
}
function friendlyFirebaseError(error){
  const msg = error?.code || error?.message || String(error);
  if(msg.includes('auth/invalid-credential')) return 'That email/password combination did not work.';
  if(msg.includes('auth/email-already-in-use')) return 'That email already has an account. Try logging in.';
  if(msg.includes('auth/weak-password')) return 'Use a password with at least 6 characters.';
  if(msg.includes('permission')) return 'Firebase permissions blocked this action. Check Firestore rules.';
  return msg;
}
function groupBy(arr, fn){ return arr.reduce((a,x)=>{ const k=fn(x); (a[k]=a[k]||[]).push(x); return a; },{}); }
function catchupAdvice(days){ if(days<=0) return 'On pace. Keep the normal rhythm.'; if(days<=2) return 'Do one 25-minute catch-up quest or add 5 QAE questions to tomorrow.'; if(days<=5) return 'Use two compressed catch-up blocks and skip perfection.'; return 'Add a pause block or push the exam date so the plan resets realistically.'; }
function renderMiniAvatar(avatar){ return renderAvatar({ avatar, stats:{xp:0,streak:0}, progress:{qaeLogs:[]}}, 'tiny'); }
function icon(name){
  const paths = {
    dashboard:'M4 13h7V4H4v9Zm9 7h7V4h-7v16ZM4 20h7v-5H4v5Z', live:'M12 3a9 9 0 1 0 9 9h-3a6 6 0 1 1-6-6V3Zm1 4h-2v6l5 3 1-2-4-2V7Z', roadmap:'M4 6l5-2 6 2 5-2v14l-5 2-6-2-5 2V6Zm5 0v10m6-8v10', group:'M8 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm8-1a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM2 20c1-4 4-6 6-6s5 2 6 6H2Zm11 0c.5-2 2-4 4-4 1.7 0 3.3 1.2 4 4h-8Z', calendar:'M7 2h2v3H7V2Zm8 0h2v3h-2V2ZM4 5h16v15H4V5Zm2 6h12V8H6v3Z', qae:'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm0 4a6 6 0 0 1 6 6h-4a2 2 0 1 0-2 2v4a6 6 0 0 1 0-12Z', target:'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm0 3a7 7 0 1 1 0 14 7 7 0 0 1 0-14Zm0 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z', forge:'M4 18h16v3H4v-3Zm3-2 6-12 4 6-4 2 4 4H7Z', cards:'M5 3h10a2 2 0 0 1 2 2v14H5V3Zm3 4h6M8 11h6M19 7h2v14H9v-2h10V7Z', arcade:'M5 8h14l2 9a3 3 0 0 1-5 2l-2-2h-4l-2 2a3 3 0 0 1-5-2l2-9Zm3 4h2v-2H8v2Zm1 3h2v-2H9v2Zm6-3h2v-2h-2v2Zm3 3h2v-2h-2v2Z', avatar:'M12 12a5 5 0 1 0 0-10 5 5 0 0 0 0 10ZM3 22c1-5 5-8 9-8s8 3 9 8H3Z', settings:'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Zm9 4-2 1 1 2-2 3-2-1-2 1-1 2H9l-1-2-2-1-2 1-2-3 1-2-2-1V9l2-1-1-2 2-3 2 1 2-1 1-2h4l1 2 2 1 2-1 2 3-1 2 2 1v3Z', menu:'M3 6h18v2H3V6Zm0 5h18v2H3v-2Zm0 5h18v2H3v-2Z', logout:'M10 4H4v16h6v-2H6V6h4V4Zm5 3 5 5-5 5v-3H9v-4h6V7Z', sun:'M12 4V1m0 22v-3M4 12H1m22 0h-3M5 5 3 3m8 8 3 3m0-14-3 3M8 16l-3 3M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z', moon:'M21 14a8 8 0 0 1-11-11 9 9 0 1 0 11 11Z', flame:'M13 2s3 5-1 8c3-1 5-3 5-3 2 3 3 6 1 10-2 4-7 6-11 3-4-3-3-8 0-11 0 3 2 5 4 5-2-5 2-12 2-12Z', level:'M12 2l3 6 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1 3-6Z', spark:'M12 2l2 7 7 3-7 3-2 7-2-7-7-3 7-3 2-7Z', compass:'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm4 6-2 6-6 2 2-6 6-2Z', check:'M20 6 9 17l-5-5 2-2 3 3 9-9 2 2Z', list:'M4 6h2v2H4V6Zm4 0h12v2H8V6Zm-4 5h2v2H4v-2Zm4 0h12v2H8v-2Zm-4 5h2v2H4v-2Zm4 0h12v2H8v-2Z', notes:'M5 3h11l3 3v15H5V3Zm10 1v4h4M8 11h8M8 15h8', "badge-rocket":'M12 2c4 2 6 6 5 11l4 4-4 1-1 4-4-4c-5 1-9-1-11-5 4 0 7-3 7-7 1-2 2-3 4-4Z', "badge-sun":'M12 4V1m0 22v-3M4 12H1m22 0h-3M12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10Z', "badge-shield":'M12 2l8 3v6c0 5-3 9-8 11-5-2-8-6-8-11V5l8-3Z', "badge-target":'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm0 5a5 5 0 1 1 0 10 5 5 0 0 1 0-10Z', "badge-forge":'M4 19h16v3H4v-3Zm4-2 5-12 5 12H8Z', "badge-scroll":'M6 4h11a3 3 0 0 1 0 6H9v10H6V4Zm11 0a3 3 0 0 0 0 6', "badge-star":'M12 2l3 7 7 1-5 5 1 7-6-4-6 4 1-7-5-5 7-1 3-7'
  };
  return `<svg class="ui-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="${paths[name] || paths.spark}"/></svg>`;
}
function escapeHtml(str){ return String(str ?? '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c])); }
function escapeAttr(str){ return escapeHtml(str).replace(/`/g,'&#96;'); }
