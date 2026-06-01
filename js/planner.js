import { TOPICS, DOMAINS, DEFAULT_SESSION_FLOW } from './content.js';

export const MS_PER_DAY = 86400000;

export function todayISO(){
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0,10);
}

export function addDays(dateISO, days){
  const d = new Date(`${dateISO}T12:00:00`);
  d.setDate(d.getDate() + days);
  return toISO(d);
}

export function toISO(date){
  const d = new Date(date);
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0,10);
}

export function formatDate(dateISO, opts={}){
  if(!dateISO) return 'Not set';
  return new Date(`${dateISO}T12:00:00`).toLocaleDateString(undefined, { month:'short', day:'numeric', year: opts.year ? 'numeric' : undefined, weekday: opts.weekday ? 'short' : undefined });
}

export function daysBetween(startISO,endISO){
  const a = new Date(`${startISO}T00:00:00`);
  const b = new Date(`${endISO}T00:00:00`);
  return Math.ceil((b - a) / MS_PER_DAY);
}

export function isWeekday(dateISO){
  const day = new Date(`${dateISO}T12:00:00`).getDay();
  return day >= 1 && day <= 5;
}

export function isPaused(dateISO, pauseBlocks=[]){
  return pauseBlocks.some(p => dateISO >= p.start && dateISO <= p.end);
}

export function getStudyDates(profile){
  const start = profile?.studyPlan?.startDate || todayISO();
  const exam = profile?.studyPlan?.examDate || addDays(start, 110);
  const pauseBlocks = profile?.studyPlan?.pauseBlocks || [];
  const sessionDays = profile?.studyPlan?.sessionDays || [1,2,3,4,5];
  const dates = [];
  let cursor = start;
  let guard = 0;
  while(cursor <= exam && guard < 650){
    const dow = new Date(`${cursor}T12:00:00`).getDay();
    if(sessionDays.includes(dow) && !isPaused(cursor)) dates.push(cursor);
    cursor = addDays(cursor,1);
    guard += 1;
  }
  return dates;
}

export function generateRoadmap(profile){
  const dates = getStudyDates(profile);
  const statuses = profile?.progress?.roadmapStatus || {};
  const weightedTopics = buildWeightedTopicQueue(dates.length);
  const roadmap = dates.map((date, index) => {
    const topic = weightedTopics[index] || TOPICS[index % TOPICS.length];
    const activeWeek = Math.floor(index / 5) + 1;
    const dayInWeek = (index % 5) + 1;
    const domain = DOMAINS.find(d => d.id === topic.domain) || { id:'MIX', name:'Mixed Review', short:'Mixed', weight:0, color:'#8b95aa' };
    const status = statuses[date]?.status || (date < todayISO() ? 'open-past' : 'planned');
    return {
      id: date,
      date,
      index:index+1,
      activeWeek,
      dayInWeek,
      topic,
      domain,
      status,
      checklist: buildDayChecklist(topic, profile, date),
      sessionFlow: buildSessionFlow(topic, profile)
    };
  });
  return roadmap;
}

function buildWeightedTopicQueue(length){
  if(length <= 0) return [];
  const base = [];
  const domains = { D1:18, D2:18, D3:12, D4:26, D5:26 };
  const domainTopics = Object.fromEntries(Object.keys(domains).map(d => [d, TOPICS.filter(t => t.domain === d)]));
  Object.entries(domains).forEach(([domain, weight]) => {
    const count = Math.max(1, Math.round(length * weight / 100));
    for(let i=0;i<count;i++) base.push(domainTopics[domain][i % domainTopics[domain].length]);
  });
  // Insert mixed review days near the end and after every few weeks.
  const mixed = TOPICS.filter(t => t.domain === 'MIX');
  for(let i=14; i<base.length; i+=15){ base.splice(i,0,mixed[(i/15)%mixed.length|0]); }
  while(base.length < length){ base.push(mixed[base.length % mixed.length]); }
  return base.slice(0,length);
}

function buildDayChecklist(topic, profile, date){
  const qaeGoal = profile?.studyPlan?.dailyQaeGoal || 10;
  return [
    { id:'warmup', label:'Warm-up recall', detail:'Say yesterday’s concept, one CISA rule, and one question you still have.', xp:10 },
    { id:'learn', label:`Learn: ${topic.title}`, detail:topic.focus, xp:20 },
    { id:'visual', label:'Create a visual map', detail:'Draw the concept as a flow, ladder, timeline, or control stack.', xp:25 },
    { id:'qae', label:`Answer ${qaeGoal} QAE questions`, detail:'Log score and explain misses out loud.', xp:30 },
    { id:'forge', label:'Forge at least one mistake/flashcard', detail:'Turn a miss or guess into a CISA rule.', xp:25 },
    { id:'close', label:'Plan after-session homework', detail:'Pick one tiny offline task so studying does not end at 8:00.', xp:10 }
  ];
}

function buildSessionFlow(topic, profile){
  const duration = profile?.studyPlan?.sessionDuration || 60;
  if(duration === 60) return DEFAULT_SESSION_FLOW.map(s => ({...s}));
  const scale = duration / 60;
  return DEFAULT_SESSION_FLOW.map(s => ({ ...s, minutes: Math.max(1, Math.round(s.minutes * scale)) }));
}

export function currentRoadmapDay(profile){
  const roadmap = generateRoadmap(profile);
  const today = todayISO();
  return roadmap.find(r => r.date === today) || roadmap.find(r => r.status !== 'done') || roadmap[roadmap.length-1];
}

export function progressSummary(profile){
  const roadmap = generateRoadmap(profile);
  const done = roadmap.filter(r => r.status === 'done' || profile?.progress?.roadmapStatus?.[r.date]?.status === 'done').length;
  const missed = roadmap.filter(r => profile?.progress?.roadmapStatus?.[r.date]?.status === 'missed').length;
  const todayIndex = roadmap.findIndex(r => r.date >= todayISO());
  const expectedDone = todayIndex < 0 ? roadmap.length : Math.max(0, todayIndex);
  const behindDays = Math.max(0, expectedDone - done);
  const percent = roadmap.length ? Math.round(done / roadmap.length * 100) : 0;
  const daysLeft = Math.max(0, daysBetween(todayISO(), profile?.studyPlan?.examDate || todayISO()));
  return { done, missed, total: roadmap.length, expectedDone, behindDays, percent, daysLeft };
}

export function domainCompletion(profile){
  const roadmap = generateRoadmap(profile);
  const statuses = profile?.progress?.roadmapStatus || {};
  return DOMAINS.map(domain => {
    const domainDays = roadmap.filter(r => r.domain.id === domain.id);
    const done = domainDays.filter(r => statuses[r.date]?.status === 'done').length;
    const total = domainDays.length;
    return { ...domain, done, total, percent: total ? Math.round(done / total * 100) : 0 };
  });
}

export function catchUpPlan(profile){
  const roadmap = generateRoadmap(profile);
  const today = todayISO();
  const missed = roadmap.filter(r => r.date < today && (r.status === 'open-past' || r.status === 'missed'));
  return missed.slice(0,7).map((r, idx) => ({
    id:`catch-${r.date}`,
    title:`Catch-up ${idx+1}: ${r.topic.title}`,
    detail:`${r.domain.short}. Do a compressed 25-minute review, 8 QAE questions, and one mistake/flashcard.`,
    date:r.date,
    xp:80
  }));
}

export function adaptiveMessage(profile){
  const s = progressSummary(profile);
  if(s.behindDays === 0) return 'You are on pace. Keep stacking small wins.';
  if(s.behindDays <= 2) return 'You are only a little behind. Use one catch-up quest and keep the streak alive.';
  if(s.behindDays <= 5) return 'You are behind, but not in trouble. Switch to catch-up mode for two sessions and skip perfection.';
  return 'Life happened. Recalculate your roadmap or add a pause block; the plan is built to bend, not break.';
}
