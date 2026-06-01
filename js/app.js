import { domainPlan, dailyQuestTemplates, quizBank, resources, avatarItems } from './content.js';
import { initFirebase, loadLocal, saveLocal, register, login, logout, saveCloud, loadCloud, exportJson, importJson, getFirebaseStatus } from './storage.js';
import { awardXp, completeStudyDay, levelFromXp, useStreakFreeze, markExcused, createCatchUpQuest, unlockedItems, today, badgeCatalog } from './gamification.js';
import { generateRoadmap, domainCompletion } from './planner.js';
import { downloadIcs } from './calendar.js';

const defaultState = {
  currentPerson:'Bennett',
  settings:{
    appName:'ControlQuest Studio', guildName:'Ty & Comply Guild', guildId:'ty-comply', theme:'dark',
    startDate:'2026-06-01', examDate:'2026-09-18', sessionTime:'07:00', dailyQaeGoal:15,
    bennettEmail:'bennett.j.kawas@ey.com', tyEmail:'ty.reeves@ey.com'
  },
  users:{
    Bennett:{ displayName:'Bennett', xp:0, streak:0, streakFreezes:3, avatar:{color:'#73E0FF', accessory:'glasses'}, stats:{sessions:0,qae:0,qaeCorrect:0,errors:0,flashcards:0,homework:0,weekend:0}, badges:[], studyDates:[], excusedDates:[], activity:[] },
    Ty:{ displayName:'Ty', xp:0, streak:0, streakFreezes:3, avatar:{color:'#9D7CFF', accessory:'headphones'}, stats:{sessions:0,qae:0,qaeCorrect:0,errors:0,flashcards:0,homework:0,weekend:0}, badges:[], studyDates:[], excusedDates:[], activity:[] }
  },
  sessions:[], qaeLogs:[], errors:[], flashcards:[], homework:[], pauseBlocks:[], roadmapStatus:{}, checkins:{}, liveNotes:'', gameHistory:[]
};

let state = loadLocal(defaultState);
let activeView = 'dashboard';
let timer = { remaining:3600, interval:null };
let activeGame = 'blitz';
let currentGameQuestion = null;

const $ = selector => document.querySelector(selector);
const $$ = selector => [...document.querySelectorAll(selector)];

init();

async function init(){
  applyTheme();
  wireNav();
  wireActions();
  await initFirebase(syncLog);
  hydrateInputs();
  renderAll();
  setInterval(updateSyncCard, 3000);
}

function wireNav(){
  $$('.nav-link').forEach(btn => btn.addEventListener('click', () => showView(btn.dataset.view)));
  $$('.chip').forEach(btn => btn.addEventListener('click', () => { state.currentPerson = btn.dataset.person; saveAndRender(`${state.currentPerson} selected.`); }));
}

function wireActions(){
  $('#themeToggle').addEventListener('click', () => { state.settings.theme = state.settings.theme === 'dark' ? 'light' : 'dark'; saveAndRender('Theme updated.'); });
  $('#startSessionBtn').addEventListener('click', () => showView('studyroom'));
  $('#addQuickXPBtn').addEventListener('click', () => { awardXp(state,state.currentPerson,25,'Quick study win'); confetti(); saveAndRender('+25 XP quick win logged.'); });
  $('#rerollQuestBtn').addEventListener('click', () => { renderDailyQuests(true); toast('Bonus quest rerolled.'); });
  $('#completeSessionBtn').addEventListener('click', () => completeSession());
  $('#addHomeworkBtn').addEventListener('click', addHomework);
  $('#timerStart').addEventListener('click', startTimer);
  $('#timerPause').addEventListener('click', pauseTimer);
  $('#timerReset').addEventListener('click', resetTimer);
  $('#sessionNotes').addEventListener('input', e => { state.liveNotes = e.target.value; saveLocal(state); });
  $$('.checkin-card').forEach(btn => btn.addEventListener('click', () => checkIn(btn.dataset.checkin)));
  $$('[data-session-task]').forEach(cb => cb.addEventListener('change', () => { state.sessionChecklist = state.sessionChecklist || {}; state.sessionChecklist[cb.dataset.sessionTask] = cb.checked; saveLocal(state); renderSessionChecklist(); }));
  $('#logQaeBtn').addEventListener('click', logQae);
  $('#newGameBtn').addEventListener('click', renderGame);
  $$('.game-tab').forEach(btn => btn.addEventListener('click', () => { activeGame = btn.dataset.game; $$('.game-tab').forEach(b=>b.classList.remove('active')); btn.classList.add('active'); renderGame(); }));
  $('#generatePartnerQuestBtn').addEventListener('click', generatePartnerQuest);
  $('#addPauseBtn').addEventListener('click', addPauseBlock);
  $('#regenerateRoadmapBtn').addEventListener('click', () => { renderRoadmap(); toast('Roadmap recalculated.'); });
  $('#markMissedBtn').addEventListener('click', markMissedToday);
  $('#useFreezeBtn').addEventListener('click', () => { const ok = useStreakFreeze(state,state.currentPerson); saveAndRender(ok ? 'Streak freeze used.' : 'No streak freezes available.'); });
  $('#markExcusedBtn').addEventListener('click', () => { markExcused(state,state.currentPerson); saveAndRender('Today marked excused.'); });
  $('#addCatchupBtn').addEventListener('click', () => { createCatchUpQuest(state,state.currentPerson); saveAndRender('Catch-up quest added.'); });
  $('#downloadWeekdayIcsBtn').addEventListener('click', () => calendarDownload(true));
  $('#downloadExtraIcsBtn').addEventListener('click', () => calendarDownload(false));
  $('#registerBtn').addEventListener('click', async () => { try{ await register($('#authEmail').value,$('#authPassword').value,syncLog); updateSyncCard(); }catch(e){ syncLog(e.message); }});
  $('#loginBtn').addEventListener('click', async () => { try{ await login($('#authEmail').value,$('#authPassword').value,syncLog); updateSyncCard(); }catch(e){ syncLog(e.message); }});
  $('#logoutBtn').addEventListener('click', async () => { await logout(syncLog); updateSyncCard(); });
  $('#saveCloudBtn').addEventListener('click', async () => { try{ pullSettingsInputs(); await saveCloud(state,syncLog); toast('Saved to Firebase.'); }catch(e){ syncLog(e.message); }});
  $('#loadCloudBtn').addEventListener('click', async () => { try{ state = await loadCloud(state,syncLog); saveAndRender('Loaded from Firebase.'); }catch(e){ syncLog(e.message); }});
  $('#exportBackupBtn').addEventListener('click', () => exportJson(state));
  $('#importBackupInput').addEventListener('change', async e => { if(e.target.files[0]){ state = await importJson(e.target.files[0],defaultState); saveAndRender('Backup imported.'); } });
  ['startDateInput','examDateInput','sessionTimeInput','dailyQaeGoal','guildIdInput','bennettEmail','tyEmail'].forEach(id => $('#'+id).addEventListener('change', () => { pullSettingsInputs(); saveAndRender('Settings updated.'); }));
}

function showView(view){
  activeView = view;
  $$('.nav-link').forEach(btn => btn.classList.toggle('active', btn.dataset.view === view));
  $$('.view').forEach(el => el.classList.remove('active'));
  if(view === 'dashboard'){
    $('#dashboardView').classList.add('active'); $('#dashboardCards').classList.add('active'); $('#dashboardQuestPanel').classList.add('active');
  }else{ const el = $(`#${view}View`); if(el) el.classList.add('active'); }
  const titles = {dashboard:'Command Center',studyroom:'Live Study Room',roadmap:'Adaptive Roadmap',qae:'QAE Arena',games:'ControlQuest Arcade',avatar:'Avatar Closet',guild:'Buddy Guild',calendar:'Calendar Builder',resources:'Study Playbook',settings:'Settings & Sync'};
  $('#viewTitle').textContent = titles[view] || 'ControlQuest';
  renderAll();
}

function renderAll(){
  applyTheme(); hydrateInputs(); updateSyncCard(); renderTop(); renderDashboard(); renderSessionRoom(); renderRoadmap(); renderQae(); renderGame(); renderAvatar(); renderGuild(); renderResources(); renderHomework(); renderGameHistory();
}

function renderTop(){
  $('#todayLabel').textContent = new Date().toLocaleDateString(undefined,{weekday:'long',month:'long',day:'numeric'});
  $$('.chip').forEach(btn => btn.classList.toggle('active', btn.dataset.person === state.currentPerson));
}

function renderDashboard(){
  const user = state.users[state.currentPerson];
  const partnerName = state.currentPerson === 'Bennett' ? 'Ty' : 'Bennett';
  const partner = state.users[partnerName];
  const daysLeft = Math.max(0, Math.ceil((new Date(state.settings.examDate) - new Date(today())) / 86400000));
  const roadmap = generateRoadmap(state);
  const currentIndex = roadmap.findIndex(r => r.date >= today());
  const activeWeek = currentIndex >= 0 ? roadmap[currentIndex].activeWeek : Math.max(...roadmap.map(r=>r.activeWeek),1);
  $('#daysLeft').textContent = daysLeft;
  $('#activeWeek').textContent = activeWeek;
  $('#teamXP').textContent = (state.users.Bennett.xp || 0) + (state.users.Ty.xp || 0);
  $('#currentStreak').textContent = `${user.streak || 0} days`;
  $('#streakProgress').style.width = `${Math.min(100,(user.streak || 0)/5*100)}%`;
  $('#freezeText').textContent = `${user.streakFreezes || 0} streak freezes ready`;
  const level = levelFromXp(user.xp || 0);
  $('#levelText').textContent = `Level ${level.level}`;
  $('#levelProgress').style.width = `${level.progress}%`;
  $('#xpText').textContent = `${user.xp || 0} XP earned · ${level.nextFloor - (user.xp || 0)} XP to next level`;
  const gap = (user.xp || 0) - (partner.xp || 0);
  $('#buddyGap').textContent = gap === 0 ? 'Even' : gap > 0 ? `+${gap} XP` : `${Math.abs(gap)} XP behind`;
  $('#buddyProgress').style.width = `${Math.max(5,Math.min(95,50 + gap/20))}%`;
  $('#buddyGapText').textContent = gap >= 0 ? `${state.currentPerson} is on track. Keep Ty & Comply moving.` : `${state.currentPerson} needs a catch-up quest to close the gap.`;
  $('#ollieTip').textContent = getOllieTip(user);
  renderDailyQuests(false);
}

function getOllieTip(user){
  const tips = [
    'For FIRST questions, think sequence before solution.',
    'Auditors evaluate. Management owns remediation.',
    'QAE misses are treasure maps, not failures.',
    'A streak freeze protects momentum, not excuses.',
    'Draw the process before memorizing the definition.'
  ];
  if((user.streak||0) >= 5) return 'Five-day streak energy. Keep the audit owl airborne.';
  return tips[(new Date().getDate() + (user.xp||0)) % tips.length];
}

function renderDailyQuests(reroll){
  const grid = $('#dailyQuestGrid'); if(!grid) return;
  let quests = [...dailyQuestTemplates];
  if(reroll) quests.sort(()=>Math.random()-.5);
  quests = quests.slice(0,4);
  grid.innerHTML = quests.map(q => `<article class="quest-card"><h4>${q.title}</h4><p>${q.detail}</p><span class="quest-reward">+${q.xp} XP</span><button class="secondary-button small" data-quest-xp="${q.xp}" data-quest-title="${q.title}">Claim</button></article>`).join('');
  $$('[data-quest-xp]').forEach(btn => btn.addEventListener('click', () => { awardXp(state,state.currentPerson,Number(btn.dataset.questXp),btn.dataset.questTitle); confetti(); saveAndRender(`${btn.dataset.questTitle} claimed.`); }));
}

function renderSessionRoom(){
  $('#sessionNotes').value = state.liveNotes || '';
  const todays = state.checkins[today()] || {};
  $('#bennettCheckin').textContent = todays.Bennett ? 'Checked in' : 'Not checked in';
  $('#tyCheckin').textContent = todays.Ty ? 'Checked in' : 'Not checked in';
  $$('.checkin-card').forEach(card => card.classList.toggle('checked', Boolean(todays[card.dataset.checkin])));
  renderSessionChecklist(); renderHomework(); updateTimerDisplay();
}

function renderSessionChecklist(){
  $$('[data-session-task]').forEach(cb => { cb.checked = Boolean(state.sessionChecklist?.[cb.dataset.sessionTask]); });
}

function checkIn(person){
  state.checkins[today()] = state.checkins[today()] || {};
  state.checkins[today()][person] = new Date().toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'});
  awardXp(state,person,15,'Checked in for live study room');
  saveAndRender(`${person} checked in.`);
}

function completeSession(){
  completeStudyDay(state,state.currentPerson);
  state.roadmapStatus[today()] = { status:'done', updatedAt:new Date().toISOString(), person:state.currentPerson };
  state.sessionChecklist = {};
  confetti(); saveAndRender('Session complete. Ollie is proud.');
}

function addHomework(){
  const title = $('#homeworkTitle').value.trim(); if(!title) return toast('Add a homework title first.');
  const effort = $('#homeworkEffort').value;
  const reward = effort === 'heavy' ? 90 : effort === 'medium' ? 60 : 35;
  state.homework.unshift({ id:crypto.randomUUID(), date:today(), owner:$('#homeworkOwner').value, title, detail:`${effort} effort after-session quest`, reward, status:'open' });
  $('#homeworkTitle').value = ''; saveAndRender('Homework quest added.');
}

function renderHomework(){
  const list = $('#homeworkList'); if(!list) return;
  const open = state.homework.filter(h => h.status !== 'done').slice(0,8);
  list.innerHTML = open.length ? open.map(h => `<article class="homework-card"><h4>${h.title}</h4><p class="helper">Owner: ${h.owner} · ${h.detail}</p><span class="quest-reward">+${h.reward} XP</span><button class="secondary-button small" data-homework-done="${h.id}">Complete</button></article>`).join('') : '<p class="helper">No homework quests yet.</p>';
  $$('[data-homework-done]').forEach(btn => btn.addEventListener('click', () => {
    const h = state.homework.find(x=>x.id===btn.dataset.homeworkDone); if(!h) return;
    h.status = 'done'; h.completedAt = new Date().toISOString();
    const owner = h.owner === 'Both' ? state.currentPerson : h.owner;
    state.users[owner].stats.homework = (state.users[owner].stats.homework || 0) + 1;
    awardXp(state,owner,h.reward,`Homework: ${h.title}`); confetti(); saveAndRender('Homework completed.');
  }));
}

function startTimer(){ if(timer.interval) return; timer.interval = setInterval(()=>{ timer.remaining = Math.max(0,timer.remaining-1); updateTimerDisplay(); if(timer.remaining===0){ pauseTimer(); toast('Study room timer complete.'); }},1000); }
function pauseTimer(){ clearInterval(timer.interval); timer.interval = null; }
function resetTimer(){ pauseTimer(); timer.remaining = 3600; updateTimerDisplay(); }
function updateTimerDisplay(){ const m = Math.floor(timer.remaining/60), s = timer.remaining%60; $('#timerDisplay').textContent = `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`; }

function renderRoadmap(){
  const bars = $('#domainBars'); if(!bars) return;
  const completion = domainCompletion(state);
  bars.innerHTML = completion.map(d => `<div class="domain-card"><h4>${d.id}</h4><p>${d.short} · ${d.weight}% exam weight</p><div class="progress-track"><span style="width:${d.percent}%; background:${d.color}"></span></div><p class="helper">${d.done}/${d.total} planned sessions complete</p></div>`).join('');
  const roadmap = generateRoadmap(state).slice(0,90);
  $('#roadmapList').innerHTML = roadmap.map(r => `<div class="roadmap-item ${r.status}"><div><span class="domain-pill">Week ${r.activeWeek}.${r.dayInWeek}</span><p class="helper">${r.date}</p></div><div><h4>${r.topic}</h4><p class="helper">${r.domain} · ${r.short}</p></div><div class="button-row"><button class="secondary-button small" data-roadmap-status="done" data-roadmap-date="${r.date}">Done</button><button class="secondary-button small" data-roadmap-status="missed" data-roadmap-date="${r.date}">Miss</button></div></div>`).join('');
  $$('[data-roadmap-status]').forEach(btn => btn.addEventListener('click', () => { state.roadmapStatus[btn.dataset.roadmapDate] = { status:btn.dataset.roadmapStatus, updatedAt:new Date().toISOString() }; saveAndRender(`Roadmap day marked ${btn.dataset.roadmapStatus}.`); }));
}

function addPauseBlock(){
  const start = prompt('Pause start date (YYYY-MM-DD):', today()); if(!start) return;
  const end = prompt('Pause end date (YYYY-MM-DD):', start); if(!end) return;
  state.pauseBlocks.push({ id:crypto.randomUUID(), start, end, reason:'Manual pause block' });
  saveAndRender('Pause block added. Roadmap now skips those weekdays.');
}

function markMissedToday(){
  state.roadmapStatus[today()] = { status:'missed', updatedAt:new Date().toISOString(), person:state.currentPerson };
  createCatchUpQuest(state,state.currentPerson);
  saveAndRender('Today marked missed. Catch-up quest created so this does not become discouraging.');
}

function logQae(){
  const total = Number($('#qaeTotal').value); const correct = Number($('#qaeCorrect').value);
  if(!total || correct < 0 || correct > total) return toast('Enter a valid QAE total and correct count.');
  const domain = $('#qaeDomain').value; const lesson = $('#qaeLesson').value.trim();
  const log = { id:crypto.randomUUID(), date:today(), person:state.currentPerson, domain,total,correct,lesson, score:Math.round(correct/total*100) };
  state.qaeLogs.unshift(log);
  const u = state.users[state.currentPerson]; u.stats.qae = (u.stats.qae||0)+total; u.stats.qaeCorrect = (u.stats.qaeCorrect||0)+correct;
  awardXp(state,state.currentPerson,total*4 + (log.score>=80?30:0),`QAE set: ${domain}`);
  $('#qaeTotal').value=''; $('#qaeCorrect').value=''; $('#qaeLesson').value='';
  confetti(); saveAndRender('QAE set logged.');
}

function renderQae(){
  const summary = $('#arenaSummary'); if(!summary) return;
  summary.innerHTML = ['Bennett','Ty'].map(name => {
    const u = state.users[name]; const acc = u.stats.qae ? Math.round((u.stats.qaeCorrect||0)/(u.stats.qae||1)*100) : 0;
    return `<div class="score-card"><h4>${name}</h4><p class="helper">${u.stats.qae||0} QAE questions logged</p><div class="progress-track"><span style="width:${acc}%"></span></div><p class="helper">${acc}% accuracy</p></div>`;
  }).join('');
  $('#qaeTable').innerHTML = state.qaeLogs.slice(0,30).map(l => `<tr><td>${l.date}</td><td>${l.person}</td><td>${l.domain}</td><td>${l.correct}/${l.total} · ${l.score}%</td><td>${l.lesson || 'No lesson logged'}</td></tr>`).join('');
}

function renderGame(){
  const card = $('#gameCard'); if(!card) return;
  if(!currentGameQuestion || Math.random() > .7) currentGameQuestion = pickGame(activeGame);
  if(activeGame === 'blitz'){
    card.innerHTML = `<p class="eyebrow">Best/First Blitz</p><h3>${currentGameQuestion.q}</h3><div class="answer-grid">${currentGameQuestion.choices.map((c,i)=>`<button class="answer-btn" data-answer="${i}">${c}</button>`).join('')}</div><p class="helper" id="gameWhy"></p>`;
  } else if(activeGame === 'terms'){
    card.innerHTML = `<p class="eyebrow">Term Match</p><h3>${currentGameQuestion.prompt}</h3><div class="answer-grid">${currentGameQuestion.options.map(c=>`<button class="answer-btn" data-answer="${c}">${c}</button>`).join('')}</div><p class="helper" id="gameWhy"></p>`;
  } else {
    card.innerHTML = `<p class="eyebrow">Control Sorter</p><h3>${currentGameQuestion.q}</h3><div class="answer-grid">${['Preventive','Detective','Corrective'].map(c=>`<button class="answer-btn" data-answer="${c}">${c}</button>`).join('')}</div><p class="helper" id="gameWhy"></p>`;
  }
  $$('[data-answer]').forEach(btn => btn.addEventListener('click', () => answerGame(btn)));
}

function pickGame(type){ const bank = quizBank[type]; return bank[Math.floor(Math.random()*bank.length)]; }
function answerGame(btn){
  const answer = btn.dataset.answer; let correct = false; let why = '';
  if(activeGame === 'blitz'){ correct = Number(answer) === currentGameQuestion.answer; why = currentGameQuestion.why; }
  if(activeGame === 'terms'){ correct = answer === currentGameQuestion.answer; why = `Correct answer: ${currentGameQuestion.answer}.`; }
  if(activeGame === 'controls'){ correct = answer === currentGameQuestion.answer; why = currentGameQuestion.why; }
  btn.classList.add(correct ? 'correct' : 'wrong');
  $('#gameWhy').textContent = correct ? `Correct. ${why}` : `Not quite. ${why}`;
  const xp = correct ? 35 : 8;
  awardXp(state,state.currentPerson,xp,`${activeGame} arcade ${correct?'win':'attempt'}`);
  state.gameHistory.unshift({date:today(), person:state.currentPerson, game:activeGame, correct, xp});
  state.gameHistory = state.gameHistory.slice(0,40);
  saveLocal(state); renderDashboard(); renderGameHistory(); if(correct) confetti(18);
  setTimeout(()=>{ currentGameQuestion = pickGame(activeGame); renderGame(); }, correct ? 1600 : 2600);
}

function renderGameHistory(){ const el = $('#gameHistory'); if(!el) return; const wins = state.gameHistory.filter(g=>g.correct).length; el.textContent = `${state.gameHistory.length} arcade attempts · ${wins} correct · arcade XP helps unlock avatar gear.`; }

function renderAvatar(){
  const user = state.users[state.currentPerson]; const preview = $('#avatarPreview'); if(!preview) return;
  preview.innerHTML = `${avatarSvg(user.avatar)}<h3>${state.currentPerson}'s Ollie</h3><p class="helper">${user.xp||0} XP · ${user.streak||0}-day streak</p>`;
  $('#closetGrid').innerHTML = unlockedItems(user).map(item => `<article class="closet-card ${item.unlocked?'':'locked'}"><h4>${item.name}</h4><p>${item.unlock}</p><span class="price-pill">${item.cost} XP</span><button class="secondary-button small" data-equip="${item.accessory}" ${item.unlocked?'':'disabled'}>${item.unlocked?'Equip':'Locked'}</button></article>`).join('');
  $$('[data-equip]').forEach(btn => btn.addEventListener('click', () => { user.avatar.accessory = btn.dataset.equip; saveAndRender('Avatar updated.'); }));
}

function avatarSvg(avatar){
  const acc = avatar?.accessory || 'none';
  const glasses = acc === 'glasses' ? '<rect x="74" y="113" width="50" height="34" rx="14" fill="none" stroke="#10213D" stroke-width="7"/><rect x="156" y="113" width="50" height="34" rx="14" fill="none" stroke="#10213D" stroke-width="7"/><path d="M124 130h32" stroke="#10213D" stroke-width="7"/>' : '';
  const cape = acc === 'cape' ? '<path d="M77 195C45 248 45 309 87 356c18-39 50-58 93-58s76 19 94 58c42-47 42-108 10-161Z" fill="#FF7C9B" opacity=".85"/>' : '';
  const headphones = acc === 'headphones' ? '<path d="M68 125c0-54 45-92 92-92s92 38 92 92" fill="none" stroke="#FFE66D" stroke-width="12"/><rect x="52" y="124" width="30" height="58" rx="12" fill="#FFE66D"/><rect x="238" y="124" width="30" height="58" rx="12" fill="#FFE66D"/>' : '';
  const crown = acc === 'crown' ? '<path d="M96 63 120 29l36 34 36-34 24 34v34H96Z" fill="#FFE66D" stroke="#FFBD2F" stroke-width="5"/>' : '';
  const shield = acc === 'shield' ? '<path d="M232 225 278 207l46 18v38c0 34-19 58-46 73-27-15-46-39-46-73Z" fill="#62F0A4" stroke="#0B7A48" stroke-width="5"/><path d="m258 268 15 16 31-39" fill="none" stroke="#10213D" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/>' : '';
  return `<svg viewBox="0 0 320 380" aria-label="custom avatar">${cape}<path d="M68 150c0-67 41-112 92-112s92 45 92 112v75c0 60-41 102-92 102s-92-42-92-102v-75Z" fill="${avatar?.color || '#73E0FF'}"/><path d="m80 100-50-62 90 25M240 100l50-62-90 25" fill="${avatar?.color || '#73E0FF'}"/><ellipse cx="160" cy="224" rx="61" ry="74" fill="#F8FBFF"/><circle cx="124" cy="145" r="38" fill="#fff"/><circle cx="196" cy="145" r="38" fill="#fff"/><circle cx="128" cy="148" r="14" fill="#10213D"/><circle cx="192" cy="148" r="14" fill="#10213D"/><path d="M160 166 137 202h46Z" fill="#FFE66D"/><path d="M113 274c29 25 65 25 94 0" stroke="#10213D" stroke-width="10" stroke-linecap="round" fill="none"/>${glasses}${headphones}${crown}${shield}</svg>`;
}

function renderGuild(){
  const el = $('#guildScoreboard'); if(!el) return;
  el.innerHTML = ['Bennett','Ty'].map(name => { const u=state.users[name]; const level=levelFromXp(u.xp||0); const acc = u.stats.qae ? Math.round((u.stats.qaeCorrect||0)/u.stats.qae*100) : 0; return `<div class="score-card"><h4>${name}</h4>${avatarSvg(u.avatar)}<p class="helper">Level ${level.level} · ${u.xp||0} XP · ${u.streak||0}-day streak</p><div class="progress-track"><span style="width:${level.progress}%"></span></div><p class="helper">${u.stats.qae||0} QAE · ${acc}% accuracy · ${u.streakFreezes||0} freezes</p></div>`; }).join('');
  $('#catchupQuestGrid').innerHTML = state.homework.filter(h=>h.status!=='done').slice(0,6).map(h=>`<article class="quest-card"><h4>${h.title}</h4><p>${h.detail}</p><p class="helper">Owner: ${h.owner}</p><span class="quest-reward">+${h.reward} XP</span></article>`).join('');
}

function generatePartnerQuest(){
  const lagging = (state.users.Bennett.xp||0) <= (state.users.Ty.xp||0) ? 'Bennett' : 'Ty';
  createCatchUpQuest(state,lagging); saveAndRender(`Support quest generated for ${lagging}.`);
}

function renderResources(){
  const grid = $('#resourceGrid'); if(!grid) return;
  grid.innerHTML = resources.map(r=>`<article class="resource-card"><h4>${r.title}</h4><p>${r.detail}</p></article>`).join('');
}

function calendarDownload(recurring){
  downloadIcs({ title:$('#calendarTitle').value, startDate:$('#calendarStart').value || today(), endDate:$('#calendarEnd').value || state.settings.examDate, startTime:$('#calendarTime').value || '07:00', duration:$('#calendarDuration').value || 60, location:$('#calendarLocation').value, attendees:[state.settings.bennettEmail,state.settings.tyEmail], recurring });
}

function hydrateInputs(){
  $('#startDateInput').value = state.settings.startDate;
  $('#examDateInput').value = state.settings.examDate;
  $('#sessionTimeInput').value = state.settings.sessionTime || '07:00';
  $('#dailyQaeGoal').value = state.settings.dailyQaeGoal;
  $('#guildIdInput').value = state.settings.guildId;
  $('#bennettEmail').value = state.settings.bennettEmail;
  $('#tyEmail').value = state.settings.tyEmail;
  $('#calendarStart').value = state.settings.startDate;
  $('#calendarEnd').value = state.settings.examDate;
  $('#calendarTime').value = state.settings.sessionTime || '07:00';
}
function pullSettingsInputs(){
  state.settings.startDate = $('#startDateInput').value || state.settings.startDate;
  state.settings.examDate = $('#examDateInput').value || state.settings.examDate;
  state.settings.sessionTime = $('#sessionTimeInput').value || '07:00';
  state.settings.dailyQaeGoal = Number($('#dailyQaeGoal').value || 15);
  state.settings.guildId = $('#guildIdInput').value || 'ty-comply';
  state.settings.bennettEmail = $('#bennettEmail').value || 'bennett.j.kawas@ey.com';
  state.settings.tyEmail = $('#tyEmail').value || 'ty.reeves@ey.com';
}

function applyTheme(){
  document.body.classList.toggle('theme-dark', state.settings.theme !== 'light');
  document.body.classList.toggle('theme-light', state.settings.theme === 'light');
  $('#themeText').textContent = state.settings.theme === 'light' ? 'Light' : 'Dark';
}
function updateSyncCard(){
  const status = getFirebaseStatus(); const card = $('#syncCard');
  card.classList.toggle('online', status.online);
  card.querySelector('.sync-title').textContent = status.online ? 'Firebase online' : status.enabled ? 'Firebase ready' : 'Local mode';
  card.querySelector('.sync-subtitle').textContent = status.online ? (status.user?.email || 'Signed in') : status.enabled ? 'Log in to sync live.' : 'Enable Firebase config to sync.';
}
function syncLog(message){ $('#syncLog').textContent = `[${new Date().toLocaleTimeString()}] ${message}`; }
function saveAndRender(message){ saveLocal(state); renderAll(); toast(message); }
function toast(message){ const el=$('#toast'); el.textContent=message; el.classList.add('show'); clearTimeout(toast._t); toast._t=setTimeout(()=>el.classList.remove('show'),2600); }
function confetti(count=36){ for(let i=0;i<count;i++){ const c=document.createElement('span'); c.className='confetti'; c.style.left=Math.random()*100+'vw'; c.style.background=['#73E0FF','#9D7CFF','#FFE66D','#62F0A4','#FF7C9B'][Math.floor(Math.random()*5)]; c.style.animationDelay=(Math.random()*.4)+'s'; document.body.appendChild(c); setTimeout(()=>c.remove(),2200); } }
