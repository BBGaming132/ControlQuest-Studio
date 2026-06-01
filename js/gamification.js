import { DAILY_CHALLENGE_BANK, BADGES, AVATAR_ITEMS } from './content.js';
import { todayISO, progressSummary } from './planner.js';

export function levelFromXp(xp=0){
  const level = Math.floor(Math.sqrt(Math.max(0,xp) / 120)) + 1;
  const currentFloor = 120 * Math.pow(level-1,2);
  const nextFloor = 120 * Math.pow(level,2);
  const progress = Math.round(((xp - currentFloor) / Math.max(1,nextFloor-currentFloor)) * 100);
  return { level, progress: Math.max(0, Math.min(100, progress)), nextXp: nextFloor };
}

export function defaultProfile(email=''){
  const name = email ? email.split('@')[0].split(/[._-]/).filter(Boolean).map(w => w[0]?.toUpperCase()+w.slice(1)).join(' ') : 'New Auditor';
  const today = todayISO();
  return {
    uid:null,
    email,
    displayName:name || 'New Auditor',
    createdAt:new Date().toISOString(),
    updatedAt:new Date().toISOString(),
    onboarding:{ completed:false, step:0 },
    activeGroupId:null,
    groups:[],
    avatar:{ baseColor:'#7c4dff', cape:'none', glasses:'round', accessory:'clipboard', mood:'focused' },
    studyPlan:{
      examDate:'2026-09-18',
      startDate:today,
      dailyQaeGoal:10,
      sessionTime:'07:00',
      sessionDuration:60,
      sessionDays:[1,2,3,4,5],
      pauseBlocks:[]
    },
    progress:{ roadmapStatus:{}, dailyChallenges:{}, completedChallengeIds:{}, qaeLogs:[], mistakes:[], flashcards:[], homework:[], calendarEvents:[] },
    stats:{ xp:0, streak:0, bestStreak:0, streakFreezes:2, lastStreakDate:null, totalSessions:0, totalQae:0, totalMistakes:0, totalFlashcards:0, arcadeWins:0, perfectWeeks:0 },
    badges:['first_login'],
    preferences:{ theme:'dark', reduceMotion:false, tutorialSeen:false, timezone:Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/New_York' }
  };
}

export function defaultGroup(createdByUid, createdByProfile, name='New Study Guild'){
  const id = slugify(`${name}-${shortId()}`);
  const joinCode = makeJoinCode();
  return {
    id,
    name,
    joinCode,
    createdBy:createdByUid,
    createdAt:new Date().toISOString(),
    updatedAt:new Date().toISOString(),
    memberIds:{ [createdByUid]:true },
    memberSummaries:{ [createdByUid]: memberSummary(createdByProfile) },
    schedule:{ days:[1,2,3,4,5], time:'07:00', duration:60, label:'Weekday Lock-In' },
    liveSession:emptyLiveSession(),
    sharedCalendar:[],
    groupQuests:[],
    settings:{ visibility:'invite-code', friendlyName:'Study Guild' }
  };
}

export function emptyLiveSession(){
  return {
    date:todayISO(),
    title:'Live Study Session',
    active:false,
    startedAt:null,
    pausedAt:null,
    accumulatedSeconds:0,
    durationMinutes:60,
    checklist:{},
    checkins:{},
    notes:'',
    topicOverride:'',
    updatedAt:new Date().toISOString()
  };
}

export function memberSummary(profile){
  const p = progressSummary(profile);
  const level = levelFromXp(profile.stats?.xp || 0).level;
  return {
    uid:profile.uid || null,
    email:profile.email || '',
    displayName:profile.displayName || 'Study Buddy',
    avatar:profile.avatar || {},
    xp:profile.stats?.xp || 0,
    level,
    streak:profile.stats?.streak || 0,
    bestStreak:profile.stats?.bestStreak || 0,
    progressPercent:p.percent,
    roadmapDone:p.done,
    roadmapTotal:p.total,
    behindDays:p.behindDays,
    totalQae:profile.stats?.totalQae || 0,
    totalMistakes:profile.stats?.totalMistakes || 0,
    lastActive: new Date().toISOString()
  };
}

export function awardXp(profile, amount, reason='Quest complete'){
  profile.stats.xp = (profile.stats.xp || 0) + amount;
  profile.progress.xpLog = profile.progress.xpLog || [];
  profile.progress.xpLog.unshift({ id:crypto.randomUUID(), amount, reason, at:new Date().toISOString() });
  profile.progress.xpLog = profile.progress.xpLog.slice(0,100);
  updateBadges(profile);
}

export function completeDailyChallenge(profile, challenge, evidence=''){
  const today = todayISO();
  const key = `${today}:${challenge.key}`;
  profile.progress.dailyChallenges[today] = profile.progress.dailyChallenges[today] || {};
  if(profile.progress.dailyChallenges[today][challenge.key]?.done) return false;
  profile.progress.dailyChallenges[today][challenge.key] = { done:true, evidence, completedAt:new Date().toISOString(), xp:challenge.xp };
  awardXp(profile, challenge.xp, `Daily challenge: ${challenge.title}`);
  updateStreak(profile, today);
  return true;
}

export function updateStreak(profile, date=todayISO()){
  const last = profile.stats.lastStreakDate;
  if(last === date) return;
  if(!last){ profile.stats.streak = 1; }
  else {
    const diff = Math.round((new Date(`${date}T12:00:00`) - new Date(`${last}T12:00:00`)) / 86400000);
    if(diff === 1) profile.stats.streak = (profile.stats.streak || 0) + 1;
    else if(diff > 1){
      if((profile.stats.streakFreezes || 0) > 0){
        profile.stats.streakFreezes -= 1;
        profile.stats.streak = Math.max(1, profile.stats.streak || 1);
      } else profile.stats.streak = 1;
    }
  }
  profile.stats.lastStreakDate = date;
  profile.stats.bestStreak = Math.max(profile.stats.bestStreak || 0, profile.stats.streak || 0);
  if(profile.stats.streak > 0 && profile.stats.streak % 7 === 0) profile.stats.streakFreezes = (profile.stats.streakFreezes || 0) + 1;
  updateBadges(profile);
}

export function useStreakFreeze(profile){
  if((profile.stats.streakFreezes || 0) <= 0) return false;
  profile.stats.streakFreezes -= 1;
  awardXp(profile, 5, 'Used a streak freeze responsibly');
  return true;
}

export function updateBadges(profile){
  const badges = new Set(profile.badges || []);
  if((profile.stats.totalSessions || 0) >= 1) badges.add('first_session');
  if((profile.stats.streak || 0) >= 3) badges.add('three_day_streak');
  if((profile.stats.streak || 0) >= 7) badges.add('seven_day_streak');
  if((profile.stats.totalQae || 0) >= 100) badges.add('qae_100');
  if((profile.stats.totalMistakes || 0) >= 10) badges.add('mistake_10');
  if(Object.values(profile.progress.roadmapStatus || {}).some(s => s.domain === 'D1' && s.status === 'done')) badges.add('domain_1_done');
  profile.badges = [...badges];
}

export function dailyChallenges(profile, date=todayISO()){
  const seed = [...date].reduce((a,c)=>a+c.charCodeAt(0),0) + (profile.displayName || '').length;
  const copy = [...DAILY_CHALLENGE_BANK];
  const selected = [];
  for(let i=0;i<3;i++){
    const idx = (seed + i*7) % copy.length;
    selected.push(copy.splice(idx % copy.length,1)[0]);
  }
  return selected;
}

export function isAvatarItemUnlocked(profile, type, id){
  const level = levelFromXp(profile.stats?.xp || 0).level;
  const streak = profile.stats?.streak || 0;
  const qaeLogs = profile.progress?.qaeLogs?.length || 0;
  const mistakes = profile.stats?.totalMistakes || 0;
  const item = AVATAR_ITEMS[type]?.find(x => x.id === id);
  if(!item) return false;
  const unlock = item.unlock || 'Start';
  if(unlock === 'Start') return true;
  if(unlock.includes('Level 2')) return level >= 2;
  if(unlock.includes('Level 5')) return level >= 5;
  if(unlock.includes('Level 8')) return level >= 8;
  if(unlock.includes('7-day')) return streak >= 7;
  if(unlock.includes('3-day')) return streak >= 3;
  if(unlock.includes('5 QAE')) return qaeLogs >= 5;
  if(unlock.includes('10 mistakes')) return mistakes >= 10;
  if(unlock.includes('Perfect')) return (profile.stats.perfectWeeks || 0) > 0;
  return false;
}

export function renderAvatar(profile, size='normal'){
  const a = profile.avatar || {};
  const color = a.baseColor || '#7c4dff';
  const cape = a.cape || 'none';
  const glasses = a.glasses || 'round';
  const accessory = a.accessory || 'clipboard';
  const capePath = cape === 'none' ? '' : `<path d="M42 70 C20 86 18 112 35 128 C52 112 73 111 90 128 C107 111 128 112 145 128 C162 112 160 86 138 70 Z" fill="${cape === 'gold-cape' ? '#ffd166' : cape === 'night-cape' ? '#1b2552' : '#00a7ff'}" opacity=".78"/>`;
  const glassEl = glasses === 'visor' ? `<rect x="45" y="54" width="70" height="22" rx="11" fill="#10182d" opacity=".9"/><circle cx="62" cy="65" r="4" fill="#77f7d2"/><circle cx="98" cy="65" r="4" fill="#77f7d2"/>` : glasses === 'stars' ? `<path d="M58 48l4 9 10 1-8 6 3 10-9-5-9 5 3-10-8-6 10-1 4-9Zm44 0l4 9 10 1-8 6 3 10-9-5-9 5 3-10-8-6 10-1 4-9Z" fill="#ffd166"/>` : `<circle cx="62" cy="64" r="19" fill="none" stroke="#14213d" stroke-width="5"/><circle cx="98" cy="64" r="19" fill="none" stroke="#14213d" stroke-width="5"/><path d="M81 64h-2" stroke="#14213d" stroke-width="5"/>`;
  const accessoryEl = accessory === 'coffee' ? `<rect x="116" y="96" width="20" height="22" rx="5" fill="#fff"/><path d="M136 101c10 1 10 12 0 13" fill="none" stroke="#fff" stroke-width="5"/><path d="M120 93c0-8 8-8 8-16" stroke="#fff" stroke-width="4" stroke-linecap="round" opacity=".75"/>` : accessory === 'shield' ? `<path d="M126 92l19 7v18c0 13-8 23-19 29-11-6-19-16-19-29V99l19-7Z" fill="#18c29c" stroke="#fff" stroke-width="4"/>` : accessory === 'crown' ? `<path d="M52 35l13-14 15 17 17-17 14 14v15H52V35Z" fill="#ffd166" stroke="#fff" stroke-width="4"/>` : `<rect x="114" y="94" width="27" height="36" rx="5" fill="#fff"/><path d="M120 104h14M120 114h14" stroke="#7c4dff" stroke-width="3" stroke-linecap="round"/>`;
  return `<svg class="avatar-svg ${size}" viewBox="0 0 180 180" aria-label="User avatar" role="img">
    <defs><filter id="avShadow" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy="10" stdDeviation="8" flood-color="#111827" flood-opacity=".22"/></filter></defs>
    ${capePath}
    <circle cx="90" cy="90" r="72" fill="${color}" filter="url(#avShadow)"/>
    <path d="M42 88c-15-8-23-23-21-41 22 4 39 18 44 42-8 5-16 4-23-1ZM138 88c15-8 23-23 21-41-22 4-39 18-44 42 8 5 16 4 23-1Z" fill="#fff" opacity=".22"/>
    <ellipse cx="62" cy="65" rx="26" ry="28" fill="#fff"/><ellipse cx="98" cy="65" rx="26" ry="28" fill="#fff"/>
    <circle cx="62" cy="67" r="10" fill="#16213e"/><circle cx="98" cy="67" r="10" fill="#16213e"/>
    <circle cx="58" cy="62" r="3" fill="#fff"/><circle cx="94" cy="62" r="3" fill="#fff"/>
    ${glassEl}
    <path d="M84 87h12l-6 10-6-10Z" fill="#ffb347"/>
    <path d="M67 112c12 10 34 10 46 0" fill="none" stroke="#fff" stroke-width="6" stroke-linecap="round" opacity=".9"/>
    ${accessoryEl}
  </svg>`;
}

export function slugify(text){
  return String(text).toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,'').slice(0,48) || `group-${shortId()}`;
}

function makeJoinCode(){
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let out = '';
  for(let i=0;i<6;i++) out += chars[Math.floor(Math.random()*chars.length)];
  return out;
}
function shortId(){ return Math.random().toString(36).slice(2,8); }
