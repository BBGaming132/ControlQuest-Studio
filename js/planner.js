import { TOPICS, DOMAINS } from './content.js';

export function todayISO(profile=null){
  const tz = profile?.preferences?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/New_York';
  const parts = new Intl.DateTimeFormat('en-CA',{timeZone:tz,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());
  const obj = Object.fromEntries(parts.map(p=>[p.type,p.value]));
  return `${obj.year}-${obj.month}-${obj.day}`;
}
export function parseLocalDate(value){ if(!value) return null; const d = new Date(`${value}T12:00:00`); return isNaN(d) ? null : d; }
export function addDays(date, days){ const d = typeof date === 'string' ? parseLocalDate(date) : new Date(date); d.setDate(d.getDate()+days); return d.toISOString().slice(0,10); }
export function daysBetween(a,b){ const da=parseLocalDate(a), db=parseLocalDate(b); return Math.round((db-da)/86400000); }
export function formatDate(iso){ if(!iso) return ''; const d=parseLocalDate(iso); return d?.toLocaleDateString(undefined,{month:'short',day:'numeric',year:'numeric'}) || iso; }
export function formatShort(iso){ const d=parseLocalDate(iso); return d?.toLocaleDateString(undefined,{month:'short',day:'numeric'}) || iso; }
export function monthDayYear(iso){ const d=parseLocalDate(iso); return d?.toLocaleDateString(undefined,{month:'2-digit',day:'2-digit',year:'numeric'}) || iso; }
export function weekdayIndex(iso){ return parseLocalDate(iso).getDay(); }
export function weekStartSunday(iso){ const d=parseLocalDate(iso); d.setDate(d.getDate()-d.getDay()); return d.toISOString().slice(0,10); }
export function weekEndSaturday(iso){ return addDays(weekStartSunday(iso),6); }
export function isPaused(profile, iso){ return (profile?.studyPlan?.pauseBlocks||[]).some(b => iso >= b.start && iso <= b.end); }
export function pauseReason(profile, iso){ const b=(profile?.studyPlan?.pauseBlocks||[]).find(x=>iso>=x.start&&iso<=x.end); return b?.reason || 'Pause Block'; }
export function isStudyDay(profile, iso){ const days = profile?.studyPlan?.sessionDays || [1,2,3,4,5]; return days.includes(weekdayIndex(iso)); }
export function dayKey(iso){ return iso; }

export function generateRoadmap(profile){
  const plan = profile?.studyPlan || {};
  const start = weekStartSunday(plan.startDate || todayISO(profile));
  const exam = plan.examDate || addDays(start,90);
  const end = weekEndSaturday(exam);
  const roadmap = [];
  let cursor = start, topicIdx = 0, safety=0;
  while(cursor <= end && safety++ < 800){
    const paused = isPaused(profile,cursor);
    const studyDay = isStudyDay(profile,cursor);
    const status = deriveDayStatus(profile,cursor);
    const events = getEventsForDate(profile,cursor);
    if(paused){
      roadmap.push({ date:cursor, week:weekNumber(start,cursor), type:'pause', events, title:pauseReason(profile,cursor), domain:{id:'PAUSE',short:'Pause',color:'#94a3b8',icon:'pause'}, topic:{title:pauseReason(profile,cursor),focus:'Protected break. No streak penalty.',tasks:['Rest, travel, client work, or life admin without guilt.'],homework:[]}, status });
    } else if(studyDay){
      const topic = TOPICS[topicIdx % TOPICS.length];
      const domain = DOMAINS.find(d=>d.id===topic.domain) || DOMAINS[0];
      roadmap.push({ date:cursor, week:weekNumber(start,cursor), type:'study', events, lessonNumber:topicIdx+1, domain, topic, status });
      topicIdx++;
    } else if(events.length){
      const e = events[0];
      const topic = extraTopic(e);
      roadmap.push({ date:cursor, week:weekNumber(start,cursor), type:'extra', events, title:e.title || 'Bonus Study Session', domain:{id:'EXTRA',short:'Extra',color:'#f59e0b',icon:'bonus'}, topic, status:deriveDayStatus(profile,cursor) || 'extra' });
    } else {
      roadmap.push({ date:cursor, week:weekNumber(start,cursor), type:'rest', events, domain:{id:'REST',short:'Rest',color:'#64748b',icon:'rest'}, topic:{title:'Rest / Optional Review',focus:'No required session. Use this if you want bonus momentum.',tasks:[],homework:[]}, status:'rest' });
    }
    cursor = addDays(cursor,1);
  }
  return roadmap;
}

function extraTopic(event){
  return { title:event.title || 'Bonus Study Session', focus:event.description || 'Optional extra work to reduce future load.', tasks:event.lessonTasks || ['Review weakest domain from QAE trend.', 'Complete a 15-question QAE block.', 'Update Mistake Forge and Memory Deck.'], homework:['Create one takeaway note.', 'Pick one mini-review for tomorrow.'] };
}
export function getEventsForDate(profile, iso){ return (profile?.progress?.calendarEvents||[]).filter(e=>e.date===iso || (e.start||'').slice(0,10)===iso); }
export function weekNumber(start, date){ return Math.floor(daysBetween(start,date)/7)+1; }
export function groupByWeek(roadmap){
  const weeks=[]; const map=new Map();
  roadmap.forEach(r=>{ if(!map.has(r.week)){ const obj={week:r.week, days:[], start:weekStartSunday(r.date), end:weekEndSaturday(r.date)}; map.set(r.week,obj); weeks.push(obj);} map.get(r.week).days.push(r); });
  return weeks;
}
export function deriveDayStatus(profile, iso){
  if(isPaused(profile,iso)) return 'Paused';
  const rec = profile?.progress?.dayCompletion?.[iso];
  if(rec?.status) return titleStatus(rec.status);
  if(iso < todayISO(profile) && isStudyDay(profile,iso)) return 'Missed';
  if(iso === todayISO(profile)) return 'Today';
  return 'Open';
}
function titleStatus(s='Open'){ return String(s).split(/[-_\s]+/).map(w=>w? w[0].toUpperCase()+w.slice(1).toLowerCase():w).join(' '); }
export function currentRoadmapDay(profile){ const t=todayISO(profile); const roadmap=generateRoadmap(profile); return roadmap.find(r=>r.date===t && (r.type==='study'||r.type==='extra')) || roadmap.find(r=>r.date>=t && r.type==='study') || roadmap[0]; }
export function progressSummary(profile){
  const roadmap = generateRoadmap(profile).filter(r=>r.type==='study');
  const done = roadmap.filter(r=>['Complete','Complete Late','Done'].includes(deriveDayStatus(profile,r.date))).length;
  const missed = roadmap.filter(r=>deriveDayStatus(profile,r.date)==='Missed').length;
  const today = todayISO(profile);
  const expectedDone = roadmap.filter(r=>r.date < today).length;
  const behindDays = Math.max(0, expectedDone - done);
  const percent = roadmap.length ? Math.round(done / roadmap.length * 100) : 0;
  const daysLeft = Math.max(0, daysBetween(today, profile?.studyPlan?.examDate || today));
  return { done, missed, total:roadmap.length, expectedDone, behindDays, percent, daysLeft };
}
export function domainCompletion(profile){
  const roadmap = generateRoadmap(profile).filter(r=>r.type==='study');
  return DOMAINS.filter(d=>d.id!=='MIX').map(domain=>{ const days=roadmap.filter(r=>r.domain.id===domain.id); const done=days.filter(r=>['Complete','Complete Late','Done'].includes(deriveDayStatus(profile,r.date))).length; return {...domain, done, total:days.length, percent:days.length?Math.round(done/days.length*100):0}; });
}
export function catchUpPlan(profile){
  const roadmap = generateRoadmap(profile);
  const overdueHomework=(profile.progress?.homework||[]).filter(h=>!h.complete && h.dueDate && h.dueDate < todayISO(profile)).slice(0,4).map((h,idx)=>({ id:`homework-${h.id}`, title:`Overdue Homework: ${h.title}`, detail:h.detail||'Complete this overdue homework item.', date:h.dueDate, xp:Math.max(10,Math.round((h.xp||30)*.7)), coins:Math.max(3,Math.round((h.coins||8)*.7)) }));
  const missed=roadmap.filter(r=>r.type==='study' && deriveDayStatus(profile,r.date)==='Missed').slice(0,5).map((r,idx)=>({ id:`catch-${r.date}`, title:`Catch-Up ${idx+1}: ${r.topic.title}`, detail:`${r.domain.short}. Do a compressed review, 8 QAE questions, and one Mistake Forge or Memory Deck item.`, date:r.date, xp:60, coins:15 }));
  return [...overdueHomework,...missed].slice(0,8);
}
export function adaptiveMessage(profile){ const s=progressSummary(profile); if(s.behindDays===0) return 'You Are On Pace. Stack Small Wins And Protect The Streak.'; if(s.behindDays<=2) return 'Slightly Behind. Add One Catch-Up Quest This Week And Keep Going.'; if(s.behindDays<=5) return 'Behind, Not Broken. Use Catch-Up Mode And Consider One Extra Weekend Session.'; return 'The Plan Needs To Bend. Add Pause Blocks Or Push The Exam Date And Recalculate.'; }
export function dailyCompletionPercent(profile, iso){ const chall=profile?.progress?.dailyChallenges?.[iso]||{}; const challengeDone=Object.values(chall).filter(x=>x?.done).length; const rec=profile?.progress?.dayCompletion?.[iso]||{}; const lesson=rec.lessonComplete?1:0; const homework=rec.homeworkChecked?1:0; return Math.min(100, Math.round((Math.min(3,challengeDone)/3)*60 + lesson*30 + homework*10)); }
export function buildIcsDate(date,time='07:00'){ return `${date.replaceAll('-','')}T${String(time).replace(':','')}00`; }
