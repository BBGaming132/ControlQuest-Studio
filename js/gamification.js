import { badgeCatalog, avatarItems } from './content.js';

export function levelFromXp(xp){
  const level = Math.floor(Math.sqrt((xp || 0) / 120)) + 1;
  const currentFloor = 120 * Math.pow(level - 1, 2);
  const nextFloor = 120 * Math.pow(level, 2);
  const progress = Math.max(0, Math.min(100, ((xp - currentFloor) / (nextFloor - currentFloor)) * 100));
  return { level, progress, nextFloor, currentFloor };
}

export function awardXp(state, person, amount, reason){
  const user = state.users[person];
  user.xp = (user.xp || 0) + amount;
  user.activity = user.activity || [];
  user.activity.unshift({ date: today(), amount, reason });
  user.activity = user.activity.slice(0, 50);
  evaluateBadges(state, person);
  return user.xp;
}

export function completeStudyDay(state, person, source='session'){
  const user = state.users[person];
  const d = today();
  user.studyDates = user.studyDates || [];
  if(!user.studyDates.includes(d)) user.studyDates.push(d);
  user.lastStudyDate = d;
  user.stats.sessions = (user.stats.sessions || 0) + 1;
  recalcStreak(state, person);
  awardXp(state, person, source === 'weekend' ? 120 : 100, source === 'weekend' ? 'Weekend bonus session' : 'Completed 7 AM session');
}

export function recalcStreak(state, person){
  const user = state.users[person];
  const studied = new Set(user.studyDates || []);
  const excused = new Set(user.excusedDates || []);
  let cursor = new Date(today() + 'T12:00:00');
  let streak = 0;
  for(let i=0;i<180;i++){
    const iso = isoDate(cursor);
    const day = cursor.getDay();
    const isWeekend = day === 0 || day === 6;
    const paused = isPaused(state, iso);
    if(isWeekend || paused || excused.has(iso)){ cursor.setDate(cursor.getDate()-1); continue; }
    if(studied.has(iso)){ streak++; cursor.setDate(cursor.getDate()-1); continue; }
    break;
  }
  user.streak = streak;
  evaluateBadges(state, person);
  return streak;
}

export function useStreakFreeze(state, person, date=today()){
  const user = state.users[person];
  if((user.streakFreezes || 0) <= 0) return false;
  user.streakFreezes -= 1;
  user.excusedDates = user.excusedDates || [];
  if(!user.excusedDates.includes(date)) user.excusedDates.push(date);
  awardXp(state, person, 10, 'Protected streak with freeze');
  recalcStreak(state, person);
  return true;
}

export function markExcused(state, person, date=today()){
  const user = state.users[person];
  user.excusedDates = user.excusedDates || [];
  if(!user.excusedDates.includes(date)) user.excusedDates.push(date);
  recalcStreak(state, person);
}

export function evaluateBadges(state, person){
  const user = state.users[person];
  user.badges = user.badges || [];
  const add = id => { if(!user.badges.includes(id)) user.badges.push(id); };
  add('first-login');
  if((user.streak || 0) >= 3) add('three-streak');
  if((user.stats.qae || 0) >= 100) add('qae-100');
  if((user.stats.errors || 0) >= 25) add('error-25');
  if((user.stats.weekend || 0) >= 1) add('weekend-warrior');
  return user.badges;
}

export function unlockedItems(user){
  return avatarItems.map(item => ({
    ...item,
    unlocked: item.cost === 0 || (user.xp || 0) >= item.cost || (item.id === 'crown' && (user.streak || 0) >= 5)
  }));
}

export function createCatchUpQuest(state, laggingPerson){
  const user = state.users[laggingPerson];
  const partner = laggingPerson === 'Bennett' ? 'Ty' : 'Bennett';
  const xpGap = Math.max(0, (state.users[partner].xp || 0) - (user.xp || 0));
  const qaeGap = Math.max(0, (state.users[partner].stats.qae || 0) - (user.stats.qae || 0));
  const quest = {
    id: crypto.randomUUID(),
    date: today(),
    owner: laggingPerson,
    title: xpGap > 250 ? 'Catch-Up Combo Quest' : 'Light Catch-Up Quest',
    detail: `Do ${Math.max(15, Math.min(40, Math.ceil(qaeGap / 2) || 20))} QAE questions, log two misses, and teach back one concept.`,
    reward: xpGap > 250 ? 180 : 100,
    status: 'open'
  };
  state.homework.unshift(quest);
  return quest;
}

export function isPaused(state, iso){
  return (state.pauseBlocks || []).some(block => iso >= block.start && iso <= block.end);
}

export function today(){ return new Date().toISOString().slice(0,10); }
export function isoDate(date){ return date.toISOString().slice(0,10); }

export { badgeCatalog };
