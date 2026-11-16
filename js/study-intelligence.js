import { DOMAIN_TOPICS } from './content.js';
import { cardLesson, deckLesson } from './lesson-catalog.js';
import { cardMastery, hasUnresolvedMiss, isCardAvailable, isDue, isLearningCard, normalizeQuestion, progressKey } from './flashcard-engine.js';

export const MASTERY_DEFINITION = 'Mastered means at least 3 successful scheduled recalls, a review interval of at least 21 days, at least 80% recorded review accuracy, and 2 consecutive Good/Easy recalls. It describes your imported bank, not an exam-pass prediction.';
export const STUDY_PRESETS = Object.freeze([
  { id:'micro', label:'Quick review', minutes:3, questions:5 },
  { id:'focus', label:'Focused review', minutes:10, questions:15 },
  { id:'deep', label:'Extended review', minutes:20, questions:30 }
]);

export function studyIdentity(card) {
  return JSON.stringify([normalizeQuestion(card?.question),Object.values(card?.choices||{}).map(normalizeQuestion).sort()]);
}
const millis = value => Number.isFinite(Date.parse(value)) ? Date.parse(value) : 0;
const percent = (part,total) => total ? Math.round(part/total*100) : 0;
const sum = (items,key) => items.reduce((n,item)=>n+(Number(item[key])||0),0);
const clamp = (n,min,max) => Math.max(min,Math.min(max,n));
const dayFormatters = new Map();
function localDay(date, timezone='America/New_York') {
  try {
    if (!dayFormatters.has(timezone)) dayFormatters.set(timezone, new Intl.DateTimeFormat('en-CA',{timeZone:timezone,year:'numeric',month:'2-digit',day:'2-digit'}));
    return dayFormatters.get(timezone).format(new Date(date));
  }
  catch { return new Date(date).toISOString().slice(0,10); }
}
function domainFor(card,decks=[]) {
  const related=decks.filter(d=>d.scopeKey===card.scopeKey && card.deckIds?.includes(d.id) && !['master','missed'].includes(d.kind));
  const explicit=related.filter(d=>d.categoryOverride).map(d=>deckLesson(d)?.domainId||d.domainId).filter(id=>/^d[1-5]$/.test(id||''));
  if(explicit.length) return [...new Set(explicit)];
  const lesson=cardLesson(card);
  const value=(/^d[1-5]$/.test(lesson?.domainId||'')?lesson.domainId:null) || (Number(card.domainNumber)>=1&&Number(card.domainNumber)<=5?`d${Number(card.domainNumber)}`:null) || String(card.domain||'').match(/\bdomain\s*([1-5])\b/i)?.[1]?.replace(/^(\d)$/,'d$1');
  return /^d[1-5]$/.test(value||'') ? [value] : [];
}
function availableReviewEvents(reviews, uid) {
  const seen=new Set();
  return (reviews||[]).filter(event=>{
    if(uid&&event.uid&&event.uid!==uid)return false;
    const key=event.id||`${event.scopeKey}|${event.cardId}|${event.reviewedAt}|${event.sessionId}|${event.rating}`;
    if(seen.has(key))return false;seen.add(key);return true;
  });
}

// A question has one logical learning state even when it appears in a Guild,
// Personal, and Public deck. Keep its real storage key so existing history works.
export function uniqueStudyCards(cards=[], progressMap={}, reviews=[], options={}) {
  const groups=new Map(),events=availableReviewEvents(reviews,options.uid),decks=options.decks||[];
  const scopedEvents = new Map();
  const legacyEvents = new Map();
  for (const event of events) {
    const index = event.scopeKey ? scopedEvents : legacyEvents;
    const key = event.scopeKey ? `${event.scopeKey}__${event.cardId}` : event.cardId;
    if (!index.has(key)) index.set(key, []);
    index.get(key).push(event);
  }
  for(const card of cards||[]){
    if(!String(card?.question||'').trim())continue;
    const key=studyIdentity(card);if(!groups.has(key))groups.set(key,[]);groups.get(key).push(card);
  }
  const result=[];
  for(const [identity,aliases] of groups){
    const candidates=aliases.map(card=>{const saved=progressMap?.[progressKey(card)];return {card,progress:options.uid&&saved?.uid&&saved.uid!==options.uid?undefined:saved};});
    const resetAt=Math.max(0,...candidates.map(item=>millis(item.progress?.resetAt)));
    const ranked=candidates.filter(item=>!resetAt||Math.max(millis(item.progress?.resetAt),millis(item.progress?.lastReviewedAt))>=resetAt).sort((a,b)=>
      Number((b.progress?.repetitions||0)>0)-Number((a.progress?.repetitions||0)>0) ||
      millis(b.progress?.lastReviewedAt)-millis(a.progress?.lastReviewedAt) ||
      (b.progress?.repetitions||0)-(a.progress?.repetitions||0) || progressKey(a.card).localeCompare(progressKey(b.card)));
    const chosen=ranked[0];
    const matchingEvents = new Set(aliases.flatMap(card => [
      ...(scopedEvents.get(progressKey(card)) || []), ...(legacyEvents.get(card.id) || []),
    ]));
    const ownEvents = [...matchingEvents].filter(e=>!resetAt||millis(e.reviewedAt)>resetAt).sort((a,b)=>millis(b.reviewedAt)-millis(a.reviewedAt));
    let progress=chosen.progress?{...chosen.progress}:null;
    const latest=ownEvents[0];
    // Earlier releases let a wrong multiple-choice answer be rated Easy. Never
    // label that historical record mastered just because its interval grew.
    if(latest?.correct===false && millis(latest.reviewedAt)>=millis(progress?.lastReviewedAt)){
      progress={...(progress||{}),state:'relearning',lastRating:'Again',successfulRecallStreak:0,lastReviewedAt:latest.reviewedAt};
    }
    const domainIds=[...new Set(aliases.flatMap(c=>domainFor(c,decks)))].sort();
    const importedMiss=!resetAt&&aliases.some(c=>((progressMap?.[progressKey(c)]?.importedMiss===true&&(!options.uid||progressMap[progressKey(c)].uid===options.uid))||(c.wasCorrectAtImport===false && (!options.uid||c.ownerUid===options.uid||(!c.ownerUid&&c.scopeKey===`personal_${options.uid}`)))));
    const sourceImportedMiss=aliases.some(c=>c.wasCorrectAtImport===false);
    const representative={...chosen.card,wasCorrectAtImport:importedMiss?false:chosen.card.wasCorrectAtImport===true?true:undefined};
    const unresolvedMiss=hasUnresolvedMiss(representative,progress)||latest?.correct===false;
    result.push({...representative,studyIdentity:identity,aliases:aliases.map(c=>({id:c.id,scopeKey:c.scopeKey,scope:c.scope,deckIds:c.deckIds||[]})),
      effectiveProgress:progress,domainId:domainIds.length===1?domainIds[0]:null,domainIds,
      categorizationConflict:domainIds.length>1,importedMiss,sourceImportedMiss,unresolvedMiss,
      answerConflict:aliases.some(c=>c.answerConflict)||new Set(aliases.filter(c=>c.correctAnswer&&c.choices?.[c.correctAnswer]).map(c=>normalizeQuestion(c.choices[c.correctAnswer]))).size>1,reviewEvents:ownEvents});
  }
  return result.sort((a,b)=>a.studyIdentity.localeCompare(b.studyIdentity));
}

export function dailyReviewBudget(reviews, settings = {}, { uid, timezone, now = Date.now() } = {}) {
  const today = localDay(now, timezone);
  const events = availableReviewEvents(reviews, uid)
    .filter(event => millis(event.reviewedAt) && localDay(event.reviewedAt, timezone) === today);
  return {
    newCards: Math.max(0, (Number(settings.newCardsPerDay) || 20) - events.filter(event => event.wasNew).length),
    reviews: Math.max(0, (Number(settings.maxReviewsPerDay) || 100) - events.filter(event =>
      event.schedulerState ? event.schedulerState === 'review' : !event.wasNew).length),
  };
}

function summarizeCards(cards,now){
  const stats={suspended:0,buried:0,leeches:0,total:cards.length,unseen:0,new:0,learning:0,reviewing:0,mastered:0,remaining:0,due:0,dueReviews:0,missed:0,importedMisses:0,sourceImportedMisses:0,reviewMisses:0,correct:0,incorrect:0,reviews:0,accuracy:null,masteryPct:0,answerConflicts:0};
  for(const card of cards){
    const p=card.effectiveProgress,mastery=cardMastery(p),unseen=!p||!(p.repetitions>0);
    if(p?.suspended)stats.suspended++;else if(!isCardAvailable(p,now))stats.buried++;
    if(p?.leech||(p?.lapses||0)>=8)stats.leeches++;
    if(unseen){stats.unseen++;stats.new++;}
    else if(mastery==='Learning')stats.learning++;
    else if(mastery==='Mastered'&&!card.answerConflict)stats.mastered++;
    else stats.reviewing++;
    if(isDue(p,now)&&!card.answerConflict){stats.due++;if(!unseen)stats.dueReviews++;}
    if(card.unresolvedMiss)stats.missed++;
    if(card.importedMiss)stats.importedMisses++;
    if(card.sourceImportedMiss)stats.sourceImportedMisses++;
    if((p?.incorrectCount||0)>0||card.reviewEvents.some(e=>e.correct===false))stats.reviewMisses++;
    if(card.answerConflict)stats.answerConflicts++;
    stats.correct+=Number(p?.correctCount)||0;stats.incorrect+=Number(p?.incorrectCount)||0;stats.reviews+=Number(p?.repetitions)||0;
  }
  stats.remaining=stats.total-stats.mastered;
  stats.accuracy=stats.correct+stats.incorrect?percent(stats.correct,stats.correct+stats.incorrect):null;
  stats.masteryPct=percent(stats.mastered,stats.total);
  return stats;
}

export function buildDomainAnalytics(cards=[],progressMap={},reviews=[],options={}) {
  const now=new Date(options.now||Date.now());
  const unique=uniqueStudyCards(cards,progressMap,reviews,options);
  const domains=DOMAIN_TOPICS.map(domain=>{
    const selected=unique.filter(card=>card.domainId===domain.id),stats=summarizeCards(selected,now);
    const supplied=options.expectedTotals?.[domain.id],expected=Number(supplied);
    const expectedTotal=supplied!==null&&supplied!==undefined&&Number.isFinite(expected)&&expected>=0?expected:null;
    const lessonIds=new Set();
    for(const card of selected){
      for(const alias of card.aliases){const original=cards.find(c=>c.id===alias.id&&c.scopeKey===alias.scopeKey);const lesson=cardLesson(original||{});if(lesson?.domainId===domain.id)lessonIds.add(lesson.id);}
      for(const deck of options.decks||[]){if(card.aliases.some(c=>c.scopeKey===deck.scopeKey&&c.deckIds.includes(deck.id))&&deckLesson(deck)?.domainId===domain.id)lessonIds.add(deckLesson(deck).id);}
    }
    const examWeight=Number(options.examWeights?.[domain.id]??domain.weight);
    return {id:domain.id,domain:domain.domain,name:domain.name,color:domain.color,examWeight,weight:examWeight,...stats,
      expectedTotal,missingUploads:expectedTotal===null?null:Math.max(0,expectedTotal-stats.total),
      lessonCount:domain.topics.length,lessonsUploaded:lessonIds.size,coverage:percent(lessonIds.size,domain.topics.length),cards:selected};
  });
  const unassigned=unique.filter(c=>!c.domainId);
  const totals=summarizeCards(unique,now);
  const day=localDay(now,options.timezone);
  const todayEvents=availableReviewEvents(reviews,options.uid).filter(e=>millis(e.reviewedAt)>0&&localDay(e.reviewedAt,options.timezone)===day);
  const reviewedToday=new Set(unique.filter(c=>c.reviewEvents.some(e=>millis(e.reviewedAt)>0&&localDay(e.reviewedAt,options.timezone)===day)).map(c=>c.studyIdentity)).size;
  const weightedMastery=domains.reduce((n,d)=>n+d.masteryPct*d.examWeight/100,0);
  return {domains,totals:{...totals,reviewedToday,reviewActionsToday:todayEvents.length,weightedMastery:Math.round(weightedMastery)},
    unassigned:unassigned.length,unassignedCards:unassigned,categorizationConflicts:unassigned.filter(c=>c.categorizationConflict).length,
    logicalCards:unique,rawCount:cards.length,duplicateCopies:Math.max(0,cards.length-unique.length),masteryDefinition:MASTERY_DEFINITION,
    coverageNote:'Counts refer to unique questions in your imported library. Missing uploads are unknown until you provide expected question totals.',asOf:now.toISOString()};
}

export function buildDailyPlan(cards=[],progressMap={},reviews=[],options={}) {
  const now=new Date(options.now||Date.now()),minutes=clamp(Math.round(Number(options.minutes)||10),1,60);
  const target=clamp(Math.round(Number(options.targetQuestions)||Math.round(minutes*1.5)),1,100);
  const analytics=buildDomainAnalytics(cards,progressMap,reviews,{...options,now});
  const dailyGoal=clamp(Math.round(Number(options.dailyGoal)||20),1,200);
  const completed=analytics.totals.reviewedToday,remainingGoal=Math.max(0,dailyGoal-completed);
  const priorities=analytics.domains.map(d=>({...d,priority:Number(((d.dueReviews*4+d.missed*5+d.unseen+1)*(d.examWeight/100)*(1+(100-d.masteryPct)/100)).toFixed(3))})).filter(d=>d.total).sort((a,b)=>b.priority-a.priority||a.id.localeCompare(b.id));
  const weightMap=new Map(priorities.map(d=>[d.id,d.priority]));
  const available=analytics.logicalCards.filter(c=>!c.answerConflict&&isCardAvailable(c.effectiveProgress,now)&&(!options.domainId||c.domainId===options.domainId));
  const limits = options.reviewSettings ? dailyReviewBudget(reviews, options.reviewSettings, {...options,now}) : null;
  const candidates=available.map(card=>{
    const p=card.effectiveProgress,due=isDue(p,now),unseen=!p||!(p.repetitions>0);
    const learning=isLearningCard(p);
    const overdue=p?.dueAt?Math.max(0,(now-new Date(p.dueAt))/86400000):0;
    const score=(due&&learning?3000:0)+(card.unresolvedMiss?1000:0)+(due&&!unseen?700:0)+(unseen?300:0)+(weightMap.get(card.domainId)||0)+Math.min(60,overdue);
    return {card,score,unseen,due,learning,category:card.unresolvedMiss?'missed':due&&!unseen?'due':unseen?'new':'practice'};
  }).filter(item=>limits?(item.unseen||item.due):(!item.learning||item.due))
    .sort((a,b)=>b.score-a.score||a.card.studyIdentity.localeCompare(b.card.studyIdentity));
  const selected=[];
  for(const item of candidates){
    if(selected.length>=target)break;
    if(limits&&item.unseen){
      if(!limits.newCards)continue;
      limits.newCards--;
    }else if(limits&&!item.learning){
      if(!limits.reviews)continue;
      limits.reviews--;
    }
    selected.push(item);
  }
  const counts={missed:0,due:0,new:0,practice:0};selected.forEach(item=>counts[item.category]++);
  const steps=[
    ...(counts.missed?[{id:'repair',mode:'missed',label:'Repair missed concepts',count:counts.missed,reason:'Return to unresolved imported misses and failed personal recalls before adding more material.'}]:[]),
    ...(counts.due?[{id:'recall',mode:'due',label:'Review scheduled cards',count:counts.due,reason:'Spacing works by retrieving material when the review is due.'}]:[]),
    ...(counts.new?[{id:'discover',mode:'new',label:'Learn unseen questions',count:counts.new,reason:'Introduce a manageable slice from the imported bank.'}]:[]),
    ...(counts.practice?[{id:'reinforce',mode:'all',label:'Optional confidence practice',count:counts.practice,reason:'Your due queue is clear. Extra practice does not extend intervals ahead of schedule.'}]:[])
  ];
  return {minutes,targetQuestions:target,availableQuestions:available.length,questionCount:selected.length,dailyGoal,completedToday:completed,remainingGoal,
    goalComplete:remainingGoal===0,domainPriorities:priorities.map(d=>({id:d.id,domain:d.domain,name:d.name,examWeight:d.examWeight,priority:d.priority,missed:d.missed,due:d.dueReviews,remaining:d.remaining})),
    cards:selected.map(item=>item.card),steps,analytics,
    headline:selected.length?`${selected.length} questions · about ${minutes} minutes`:'Import a question set to start your study plan',
    rationale:'Learning steps that are ready come first, followed by missed and due reviews and new questions. Domain exam weights and your remaining mastery help order those cards.',
    recommendationType:'Local rules-based study coach',notExamPrediction:true};
}
