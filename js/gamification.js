import { DAILY_CHALLENGE_BANK, BADGES, AVATAR_ITEMS, SHOP_ITEMS } from './content.js';
import { todayISO, addDays, isStudyDay, isPaused } from './planner.js';

export function levelFromXp(xp=0){
  const level = Math.floor(Math.sqrt(Math.max(0,xp)/120))+1;
  const currentFloor = 120*Math.pow(level-1,2);
  const nextFloor = 120*Math.pow(level,2);
  return { level, progress:Math.max(0,Math.min(100,Math.round(((xp-currentFloor)/Math.max(1,nextFloor-currentFloor))*100))), nextXp:nextFloor };
}
export function defaultProfile(email=''){
  const name=email?email.split('@')[0].split(/[._-]/).filter(Boolean).map(w=>w[0]?.toUpperCase()+w.slice(1)).join(' '):'New Auditor';
  const today=todayISO();
  return { uid:null,email,displayName:name||'New Auditor',createdAt:new Date().toISOString(),updatedAt:new Date().toISOString(), onboarding:{completed:false,step:0,answers:{}}, activeGroupId:null, groups:[],
    avatar:{baseColor:'#7c4dff',cape:'none',glasses:'round',accessory:'clipboard',mood:'focused',owned:['#7c4dff','#00a7ff','none','round','clipboard','focused']},
    studyPlan:{ examDate:'2026-09-18', startDate:today, dailyQaeGoal:10, sessionTime:'07:00', sessionDuration:60, sessionDays:[1,2,3,4,5], pauseBlocks:[] },
    progress:{ roadmapStatus:{}, dayCompletion:{}, dailyChallenges:{}, qaeLogs:[], mistakes:[], flashcards:[], decks:[], homework:[], calendarEvents:[], notes:[], xpLog:[], chests:[], purchases:[], weekendLogs:[] },
    stats:{ xp:0, coins:0, streak:0, bestStreak:0, streakFreezes:2, lastStreakDate:null, totalSessions:0, totalQae:0, totalMistakes:0, totalFlashcards:0, arcadeWins:0, perfectWeeks:0, currentXpBoost:null },
    badges:['first_login'], preferences:{ theme:'dark', reduceMotion:false, tutorialSeen:false, onboardingTourSeen:false, timezone:Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/New_York' }
  };
}
export function defaultGroup(createdByUid, profile, name='New Study Guild'){
  const id=slugify(`${name}-${shortId()}`), joinCode=makeJoinCode();
  return { id,name,joinCode,createdBy:createdByUid,createdAt:new Date().toISOString(),updatedAt:new Date().toISOString(), memberIds:{[createdByUid]:true}, memberSummaries:{[createdByUid]:memberSummary(profile)}, schedule:{days:[1,2,3,4,5],time:profile.studyPlan?.sessionTime||'07:00',duration:profile.studyPlan?.sessionDuration||60,label:'Weekday Lock-In'}, liveSession:emptyLiveSession(profile), sharedCalendar:[], groupQuests:[], settings:{visibility:'invite-code',friendlyName:'Study Guild'} };
}
export function emptyLiveSession(profile={studyPlan:{}}){ return { date:todayISO(), title:'Live Study Session', active:false, startedAt:null, pausedAt:null, accumulatedSeconds:0, durationMinutes:profile.studyPlan?.sessionDuration||60, checklist:{}, checkins:{}, notes:'', topicOverride:'', planId:null, updatedAt:new Date().toISOString() }; }
export function memberSummary(profile){ const lvl=levelFromXp(profile.stats?.xp||0); const total=Object.keys(profile.progress?.dayCompletion||{}).length; return { uid:profile.uid||null,email:profile.email||'',displayName:profile.displayName||'Study Buddy',avatar:profile.avatar||{}, xp:profile.stats?.xp||0, coins:profile.stats?.coins||0, level:lvl.level, streak:profile.stats?.streak||0,bestStreak:profile.stats?.bestStreak||0,totalQae:profile.stats?.totalQae||0,totalMistakes:profile.stats?.totalMistakes||0, completedDays:total,lastActive:new Date().toISOString() }; }

export function award(profile,{xp=0,coins=0,reason='Quest reward',source='manual',meta={}}={}){
  const boost = activeBoost(profile);
  const realXp = Math.round(xp * boost);
  profile.stats.xp=(profile.stats.xp||0)+realXp;
  profile.stats.coins=(profile.stats.coins||0)+coins;
  profile.progress.xpLog=profile.progress.xpLog||[];
  profile.progress.xpLog.unshift({id:crypto.randomUUID(),xp:realXp,baseXp:xp,coins,reason,source,boost,meta,at:new Date().toISOString()});
  profile.progress.xpLog=profile.progress.xpLog.slice(0,500);
  updateBadges(profile);
  return {xp:realXp,coins,boost};
}
export function awardXp(profile, amount, reason='Quest complete'){ return award(profile,{xp:amount,reason}); }
export function activeBoost(profile){ const b=profile.stats?.currentXpBoost; if(!b || !b.endsAt) return 1; return new Date(b.endsAt)>new Date() ? (b.multiplier||1) : 1; }
export function completeDailyChallenge(profile, challenge, evidence=''){
  const today=todayISO(); profile.progress.dailyChallenges[today]=profile.progress.dailyChallenges[today]||{};
  if(profile.progress.dailyChallenges[today][challenge.key]?.done) return false;
  profile.progress.dailyChallenges[today][challenge.key]={done:true,evidence,completedAt:new Date().toISOString(),xp:challenge.xp,coins:challenge.coins};
  award(profile,{xp:challenge.xp,coins:challenge.coins||0,reason:`Daily challenge: ${challenge.title}`,source:'daily-challenge',meta:{challengeKey:challenge.key,evidence}});
  maybeAwardChest(profile,'bronze',`Chest earned from ${challenge.title}`);
  evaluateDailyCompletion(profile,today);
  return true;
}
export function evaluateDailyCompletion(profile,date=todayISO()){
  const done=Object.values(profile.progress.dailyChallenges?.[date]||{}).filter(x=>x?.done).length;
  profile.progress.dayCompletion=profile.progress.dayCompletion||{};
  const rec=profile.progress.dayCompletion[date]||{};
  if(done>=3){
    const late = date < todayISO();
    rec.status = late ? 'complete-late':'done';
    rec.completedAt = rec.completedAt || new Date().toISOString();
    rec.dailyChallengesDone = done;
    profile.progress.dayCompletion[date]=rec;
    updateStreak(profile,date);
  }
}
export function updateStreak(profile,date=todayISO()){
  const last=profile.stats.lastStreakDate;
  if(last===date) return;
  if(!last){ profile.stats.streak=1; }
  else {
    const diff=Math.round((new Date(`${date}T12:00:00`)-new Date(`${last}T12:00:00`))/86400000);
    if(diff===1) profile.stats.streak=(profile.stats.streak||0)+1;
    else if(diff>1){
      const protectedDays=[]; let lost=false;
      for(let i=1;i<diff;i++){ const d=addDays(last,i); if(!isStudyDay(profile,d)||isPaused(profile,d)) continue; if((profile.stats.streakFreezes||0)>0){profile.stats.streakFreezes-=1; protectedDays.push(d);} else {lost=true;break;} }
      profile.progress.streakFreezeLog=profile.progress.streakFreezeLog||[];
      protectedDays.forEach(d=>profile.progress.streakFreezeLog.unshift({id:crypto.randomUUID(),date:d,reason:'Auto-used for missed scheduled study day',at:new Date().toISOString()}));
      profile.stats.streak = lost ? 1 : (profile.stats.streak||0)+1;
    }
  }
  profile.stats.lastStreakDate=date;
  profile.stats.bestStreak=Math.max(profile.stats.bestStreak||0,profile.stats.streak||0);
  if(profile.stats.streak>0 && profile.stats.streak%7===0){ profile.stats.streakFreezes=(profile.stats.streakFreezes||0)+1; award(profile,{xp:25,coins:25,reason:'7-day streak bonus',source:'streak'}); }
  updateBadges(profile);
}
export function maybeAwardChest(profile,type='bronze',reason='Quest chest'){ profile.progress.chests=profile.progress.chests||[]; const chance= type==='gold'?0.8:type==='silver'?0.6:0.35; if(Math.random()<chance){ profile.progress.chests.unshift({id:crypto.randomUUID(),type,reason,opened:false,at:new Date().toISOString()}); return true;} return false; }
export function openChest(profile,chestId){ const chest=(profile.progress.chests||[]).find(c=>c.id===chestId); if(!chest || chest.opened) return null; const ranges={bronze:[20,60,10,25],silver:[60,140,25,55],gold:[140,280,60,120]}; const r=ranges[chest.type]||ranges.bronze; const xp=randomInt(r[0],r[1]), coins=randomInt(r[2],r[3]); chest.opened=true; chest.openedAt=new Date().toISOString(); chest.reward={xp,coins}; award(profile,{xp,coins,reason:`Opened ${chest.type} chest`,source:'chest'}); return chest.reward; }
export function buyShopItem(profile,itemId){ const item=SHOP_ITEMS.find(i=>i.id===itemId); if(!item) throw new Error('Shop item not found.'); if((profile.stats.coins||0)<item.cost) throw new Error('Not enough coins yet.'); profile.stats.coins-=item.cost; profile.progress.purchases=profile.progress.purchases||[]; profile.progress.purchases.unshift({id:crypto.randomUUID(),itemId,at:new Date().toISOString(),cost:item.cost}); if(item.type==='streakFreeze') profile.stats.streakFreezes=(profile.stats.streakFreezes||0)+1; if(item.type==='xpBoost') profile.stats.currentXpBoost={multiplier:item.multiplier,endsAt:new Date(Date.now()+item.minutes*60000).toISOString()}; if(item.type==='chest') profile.progress.chests.unshift({id:crypto.randomUUID(),type:item.chest,reason:'Purchased in shop',opened:false,at:new Date().toISOString()}); profile.badges=[...new Set([...(profile.badges||[]),'shopper'])]; return item; }
export function resetProfileForTesting(profile){ const backup=structuredClone(profile); const fresh=defaultProfile(profile.email); fresh.uid=profile.uid; fresh.displayName=profile.displayName; fresh.avatar=profile.avatar; fresh.groups=profile.groups||[]; fresh.activeGroupId=profile.activeGroupId||null; fresh.preferences={...fresh.preferences,...profile.preferences}; fresh.progress.resetBackups=[...(profile.progress?.resetBackups||[]),{id:crypto.randomUUID(),at:new Date().toISOString(),backup}]; return fresh; }
export function dailyChallenges(profile,date=todayISO()){ const seed=[...date].reduce((a,c)=>a+c.charCodeAt(0),0)+(profile.displayName||'').length; const copy=[...DAILY_CHALLENGE_BANK]; const selected=[]; for(let i=0;i<3;i++){ const idx=(seed+i*7)%copy.length; selected.push(copy.splice(idx%copy.length,1)[0]); } return selected; }
export function isAvatarItemUnlocked(profile,type,id){
  const item=AVATAR_ITEMS[type]?.find(x=>x.id===id);
  if(!item) return false;
  profile.avatar.owned=profile.avatar.owned||[];
  if(profile.avatar.owned.includes(id)) return true;
  const lvl=levelFromXp(profile.stats?.xp||0).level;
  const streak=profile.stats?.streak||0;
  const qae=profile.progress?.qaeLogs?.length||0;
  const mistakes=profile.stats?.totalMistakes||0;
  const arcade=profile.stats?.arcadeWins||0;
  const unlock=String(item.unlock||'Start').toLowerCase();
  if(unlock.includes('start')) return true;
  const levelMatch=unlock.match(/level\s*(\d+)/); if(levelMatch && lvl>=Number(levelMatch[1])) return true;
  const streakMatch=unlock.match(/(\d+)[-\s]*day\s*streak/); if(streakMatch && streak>=Number(streakMatch[1])) return true;
  if(unlock.includes('qae') && qae>=5) return true;
  if(unlock.includes('mistake') && mistakes>=10) return true;
  if(unlock.includes('perfect') && (profile.stats.perfectWeeks||0)>0) return true;
  if(unlock.includes('arcade') && arcade>=5) return true;
  return false;
}
export function buyAvatarItem(profile,type,id){ const item=AVATAR_ITEMS[type]?.find(x=>x.id===id); if(!item) throw new Error('Avatar item not found.'); if(isAvatarItemUnlocked(profile,type,id)){ profile.avatar[type]=id; if(!profile.avatar.owned.includes(id)) profile.avatar.owned.push(id); return item; } if((profile.stats.coins||0)<(item.cost||0)) throw new Error('Not enough coins to buy this yet.'); profile.stats.coins-=item.cost||0; profile.avatar.owned=profile.avatar.owned||[]; profile.avatar.owned.push(id); profile.avatar[type]=id; award(profile,{xp:15,coins:0,reason:`Purchased avatar item: ${item.label}`,source:'avatar'}); return item; }
export function updateBadges(profile){ const badges=new Set(profile.badges||[]); if((profile.stats.totalSessions||0)>=1) badges.add('first_session'); if((profile.stats.streak||0)>=3) badges.add('three_day_streak'); if((profile.stats.streak||0)>=7) badges.add('seven_day_streak'); if((profile.stats.totalQae||0)>=100) badges.add('qae_100'); if((profile.stats.totalMistakes||0)>=10) badges.add('mistake_10'); if((profile.progress.notes||[]).length>=10) badges.add('notetaker'); if((profile.stats.arcadeWins||0)>=5) badges.add('arcade_5'); profile.badges=[...badges]; }
export function renderAvatar(profile,size='normal'){
  const a=profile.avatar||{}, color=a.baseColor||'#7c4dff', cape=a.cape||'none', glasses=a.glasses||'round', accessory=a.accessory||'clipboard', mood=a.mood||'focused';
  const smile=mood==='happy'?'M66 111c13 12 35 12 48 0':mood==='locked-in'?'M70 112h40':mood==='victory'?'M64 109c15 17 38 17 53 0':'M67 112c12 10 34 10 46 0';
  const capeColor=cape==='gold-cape'?'#ffd166':cape==='night-cape'?'#1b2552':cape==='emerald-cape'?'#18c29c':'#00a7ff';
  const capePath=cape==='none'?'':`<path d="M42 70 C20 86 18 112 35 132 C52 115 73 112 90 132 C107 112 128 115 145 132 C162 112 160 86 138 70 Z" fill="${capeColor}" opacity=".82"/><path d="M47 72 C65 82 115 82 133 72" stroke="#fff" stroke-width="5" opacity=".45" fill="none"/>`;
  const glassEl=glasses==='visor'?`<rect x="45" y="54" width="70" height="22" rx="11" fill="#10182d" opacity=".92"/><circle cx="62" cy="65" r="4" fill="#77f7d2"/><circle cx="98" cy="65" r="4" fill="#77f7d2"/>`:glasses==='stars'?`<path d="M58 48l4 9 10 1-8 6 3 10-9-5-9 5 3-10-8-6 10-1 4-9Zm44 0l4 9 10 1-8 6 3 10-9-5-9 5 3-10-8-6 10-1 4-9Z" fill="#ffd166"/>`:glasses==='audit-shades'?`<path d="M43 55h38l-6 23H49l-6-23Zm56 0h38l-6 23h-26l-6-23Z" fill="#111827"/><path d="M80 61h19" stroke="#111827" stroke-width="5"/>`:`<circle cx="62" cy="64" r="19" fill="none" stroke="#14213d" stroke-width="5"/><circle cx="98" cy="64" r="19" fill="none" stroke="#14213d" stroke-width="5"/><path d="M81 64h-2" stroke="#14213d" stroke-width="5"/>`;
  const acc=accessory==='coffee'?`<rect x="116" y="96" width="20" height="22" rx="5" fill="#fff"/><path d="M136 101c10 1 10 12 0 13" fill="none" stroke="#fff" stroke-width="5"/><path d="M120 93c0-8 8-8 8-16" stroke="#fff" stroke-width="4" stroke-linecap="round" opacity=".75"/>`:accessory==='shield'?`<path d="M126 92l19 7v18c0 13-8 23-19 29-11-6-19-16-19-29V99l19-7Z" fill="#18c29c" stroke="#fff" stroke-width="4"/>`:accessory==='crown'?`<path d="M52 35l13-14 15 17 17-17 14 14v15H52V35Z" fill="#ffd166" stroke="#fff" stroke-width="4"/>`:accessory==='rocket'?`<path d="M126 91c12-15 25-21 31-19-1 15-9 27-22 37l-10-3-3-10Z" fill="#fff"/><path d="M135 109l-10 18" stroke="#ff9f1c" stroke-width="6" stroke-linecap="round"/><circle cx="143" cy="85" r="5" fill="#00a7ff"/>`:`<rect x="114" y="94" width="27" height="36" rx="5" fill="#fff"/><path d="M120 104h14M120 114h14" stroke="#7c4dff" stroke-width="3" stroke-linecap="round"/>`;
  return `<svg class="avatar-svg ${size}" viewBox="0 0 180 180" aria-label="User avatar" role="img"><defs><filter id="avShadow" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy="10" stdDeviation="8" flood-color="#111827" flood-opacity=".22"/></filter></defs>${capePath}<circle cx="90" cy="90" r="72" fill="${color}" filter="url(#avShadow)"/><path d="M42 88c-15-8-23-23-21-41 22 4 39 18 44 42-8 5-16 4-23-1ZM138 88c15-8 23-23 21-41-22 4-39 18-44 42 8 5 16 4 23-1Z" fill="#fff" opacity=".22"/><ellipse cx="62" cy="65" rx="26" ry="28" fill="#fff"/><ellipse cx="98" cy="65" rx="26" ry="28" fill="#fff"/><circle cx="62" cy="67" r="10" fill="#16213e"/><circle cx="98" cy="67" r="10" fill="#16213e"/><circle cx="58" cy="62" r="3" fill="#fff"/><circle cx="94" cy="62" r="3" fill="#fff"/>${glassEl}<path d="M84 87h12l-6 10-6-10Z" fill="#ffb347"/><path d="${smile}" fill="none" stroke="#fff" stroke-width="6" stroke-linecap="round" opacity=".9"/>${acc}</svg>`;
}
function randomInt(a,b){return Math.floor(Math.random()*(b-a+1))+a;} export function slugify(text){ return String(text).toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,'').slice(0,48)||`group-${shortId()}`; } function makeJoinCode(){ const chars='ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; let out=''; for(let i=0;i<6;i++) out+=chars[Math.floor(Math.random()*chars.length)]; return out; } function shortId(){ return Math.random().toString(36).slice(2,8); }
