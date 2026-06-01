import { TOPICS, DOMAINS } from './content.js';
export function todayISO(){ return new Date().toISOString().slice(0,10); }
export function parseLocalDate(value){ if(!value) return null; const d = new Date(`${value}T12:00:00`); return isNaN(d) ? null : d; }
export function addDays(date, days){ const d = typeof date === 'string' ? parseLocalDate(date) : new Date(date); d.setDate(d.getDate()+days); return d.toISOString().slice(0,10); }
export function daysBetween(a,b){ const da=parseLocalDate(a), db=parseLocalDate(b); return Math.round((db-da)/86400000); }
export function formatDate(iso){ if(!iso) return ''; const d=parseLocalDate(iso); return d?.toLocaleDateString(undefined,{month:'short',day:'numeric',year:'numeric'}) || iso; }
export function formatShort(iso){ const d=parseLocalDate(iso); return d?.toLocaleDateString(undefined,{month:'short',day:'numeric'}) || iso; }
export function weekdayIndex(iso){ return parseLocalDate(iso).getDay(); }
export function isPaused(profile, iso){ return (profile?.studyPlan?.pauseBlocks||[]).some(b => iso >= b.start && iso <= b.end); }
export function pauseReason(profile, iso){ const b=(profile?.studyPlan?.pauseBlocks||[]).find(x=>iso>=x.start&&iso<=x.end); return b?.reason || 'Pause block'; }
export function isStudyDay(profile, iso){ const days = profile?.studyPlan?.sessionDays || [1,2,3,4,5]; return days.includes(weekdayIndex(iso)); }
export function dayKey(iso){ return iso; }

export function generateRoadmap(profile){
  const plan = profile?.studyPlan || {};
  const start = plan.startDate || todayISO();
  const exam = plan.examDate || addDays(start,90);
  const roadmap = [];
  let cursor = start, topicIdx = 0, safety=0;
  while(cursor <= exam && safety++ < 600){
    const isPause = isPaused(profile,cursor);
    const studyDay = isStudyDay(profile,cursor);
    const status = deriveDayStatus(profile,cursor);
    if(isPause){
      roadmap.push({ date:cursor, week:weekNumber(start,cursor), type:'pause', title:pauseReason(profile,cursor), domain:{id:'PAUSE',short:'Pause',color:'#94a3b8'}, topic:{title:pauseReason(profile,cursor),focus:'Protected break. No streak penalty.',tasks:['Rest or handle life without guilt.'],homework:[]}, status });
    } else if(studyDay){
      const topic = TOPICS[topicIdx % TOPICS.length];
      const domain = DOMAINS.find(d=>d.id===topic.domain) || {id:'MIX',short:'Mixed',color:'#8b5cf6'};
      roadmap.push({ date:cursor, week:weekNumber(start,cursor), type:'study', lessonNumber:topicIdx+1, domain, topic, status });
      topicIdx++;
    } else {
      const extra = (profile?.progress?.weekendLogs||[]).find(e=>e.date===cursor);
      if(extra){
        roadmap.push({ date:cursor, week:weekNumber(start,cursor), type:'extra', title:extra.title || 'Weekend bonus study', domain:{id:'EXTRA',short:'Extra',color:'#f59e0b'}, topic:{title:extra.title||'Weekend bonus study',focus:extra.description||'Optional momentum session.',tasks:extra.tasks||['Review weak areas','Do QAE practice','Log notes'],homework:[]}, status:'extra' });
      }
    }
    cursor = addDays(cursor,1);
  }
  return roadmap;
}

export function weekNumber(start, date){ return Math.floor(daysBetween(start,date)/7)+1; }
export function groupByWeek(roadmap){
  const weeks=[]; const map=new Map();
  roadmap.forEach(r=>{ if(!map.has(r.week)){ const obj={week:r.week, days:[], start:r.date, end:r.date}; map.set(r.week,obj); weeks.push(obj);} const w=map.get(r.week); w.days.push(r); w.start = w.start<r.date?w.start:r.date; w.end = w.end>r.date?w.end:r.date; });
  return weeks;
}

export function deriveDayStatus(profile, iso){
  if(isPaused(profile,iso)) return 'paused';
  const rec = profile?.progress?.dayCompletion?.[iso];
  if(rec?.status) return rec.status;
  if(iso < todayISO() && isStudyDay(profile,iso)) return 'missed';
  if(iso === todayISO()) return 'today';
  return 'open';
}

export function currentRoadmapDay(profile){
  const roadmap = generateRoadmap(profile);
  return roadmap.find(r=>r.date===todayISO() && r.type==='study') || roadmap.find(r=>r.date>=todayISO() && r.type==='study') || roadmap[0];
}

export function progressSummary(profile){
  const roadmap = generateRoadmap(profile).filter(r=>r.type==='study');
  const done = roadmap.filter(r=>['done','complete-late'].includes(deriveDayStatus(profile,r.date))).length;
  const missed = roadmap.filter(r=>deriveDayStatus(profile,r.date)==='missed').length;
  const today = todayISO();
  const expectedDone = roadmap.filter(r=>r.date < today).length;
  const behindDays = Math.max(0, expectedDone - done);
  const percent = roadmap.length ? Math.round(done / roadmap.length * 100) : 0;
  const daysLeft = Math.max(0, daysBetween(today, profile?.studyPlan?.examDate || today));
  return { done, missed, total:roadmap.length, expectedDone, behindDays, percent, daysLeft };
}
export function domainCompletion(profile){
  const roadmap = generateRoadmap(profile).filter(r=>r.type==='study');
  return DOMAINS.map(domain=>{ const days=roadmap.filter(r=>r.domain.id===domain.id); const done=days.filter(r=>['done','complete-late'].includes(deriveDayStatus(profile,r.date))).length; return {...domain, done, total:days.length, percent:days.length?Math.round(done/days.length*100):0}; });
}
export function catchUpPlan(profile){
  const roadmap = generateRoadmap(profile);
  return roadmap.filter(r=>r.type==='study' && deriveDayStatus(profile,r.date)==='missed').slice(0,8).map((r,idx)=>({ id:`catch-${r.date}`, title:`Catch-up ${idx+1}: ${r.topic.title}`, detail:`${r.domain.short}. Do a compressed review, 8 QAE questions, and one Mistake Forge or Memory Deck item.`, date:r.date, xp:60, coins:15 }));
}
export function adaptiveMessage(profile){ const s=progressSummary(profile); if(s.behindDays===0) return 'You are on pace. Stack small wins and protect the streak.'; if(s.behindDays<=2) return 'Slightly behind. Add one catch-up quest this week and keep going.'; if(s.behindDays<=5) return 'Behind, not broken. Use catch-up mode and consider one extra weekend session.'; return 'The plan needs to bend. Add pause blocks or push the exam date and let the roadmap recalculate.'; }

export function dailyCompletionPercent(profile, iso){
  const chall = profile?.progress?.dailyChallenges?.[iso] || {};
  const challengeDone = Object.values(chall).filter(x=>x?.done).length;
  const liveDone = profile?.progress?.dayCompletion?.[iso]?.liveChecklistDone || 0;
  return Math.min(100, Math.round(((challengeDone/3)*70) + Math.min(30,liveDone*10)));
}

export function buildIcsDate(date,time='07:00'){ return `${date.replaceAll('-','')}T${String(time).replace(':','')}00`; }
