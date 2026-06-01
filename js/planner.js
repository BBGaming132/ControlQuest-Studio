import { domainPlan } from './content.js';
import { isPaused, isoDate } from './gamification.js';

export function getStudyDays(state){
  const start = new Date(`${state.settings.startDate}T12:00:00`);
  const end = new Date(`${state.settings.examDate}T12:00:00`);
  const days = [];
  for(const d = new Date(start); d <= end; d.setDate(d.getDate()+1)){
    const day = d.getDay();
    const iso = isoDate(d);
    if(day !== 0 && day !== 6 && !isPaused(state, iso)) days.push(iso);
  }
  return days;
}

export function generateRoadmap(state){
  const days = getStudyDays(state);
  const weightedTopics = [];
  domainPlan.forEach(domain => {
    const topicPool = [...domain.topics];
    const count = Math.max(domain.topics.length, Math.round(days.length * (domain.weight / 100)));
    for(let i=0;i<count;i++){
      weightedTopics.push({ domain: domain.id, short: domain.short, topic: topicPool[i % topicPool.length], weight: domain.weight });
    }
  });
  const roadmap = days.map((date,index)=>{
    const item = weightedTopics[index % weightedTopics.length];
    return {
      id: `${date}-${index}`,
      date,
      activeWeek: Math.floor(index / 5) + 1,
      dayInWeek: (index % 5) + 1,
      domain: item.domain,
      short: item.short,
      topic: item.topic,
      status: state.roadmapStatus?.[date]?.status || 'open'
    };
  });
  return roadmap;
}

export function domainCompletion(state){
  const roadmap = generateRoadmap(state);
  return domainPlan.map(domain => {
    const items = roadmap.filter(r => r.domain === domain.id);
    const done = items.filter(r => state.roadmapStatus?.[r.date]?.status === 'done').length;
    return { ...domain, total: items.length, done, percent: items.length ? Math.round(done/items.length*100) : 0 };
  });
}
