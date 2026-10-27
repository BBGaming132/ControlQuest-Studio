import { LESSONS, cardLesson, deckLesson } from './lesson-catalog.js';
import { uniqueStudyCards, studyIdentity } from './study-intelligence.js';
import { cardMastery, stableHash } from './flashcard-engine.js';

export const HOMEWORK_CONFIG = Object.freeze({
  version: 1, startDate: '2026-10-26', timezone: 'America/New_York',
  secondsPerQuestion: 96, quizQuestions: 25, recallGapMinutes: 0,
  assignmentPoints: 20, lateAssignmentPoints: 10, quizPoints: 30, lateQuizPoints: 15, missedDeadlinePenalty: 5
});
export const HOMEWORK_READINESS_DEFINITION = 'Clear each question with a correct Good or Easy recall. Again and Hard return during this lesson, without a waiting period. Saved assignment completion stays complete during later retention reviews.';
const DAY = 86400000;
const validTime = value => value!==null&&value!==undefined&&value!==''&&Number.isFinite(new Date(value).getTime());
const stamp = value => { const d = new Date(value ?? Date.now()); if (!Number.isFinite(d.getTime())) throw new TypeError('A valid date is required.'); return d.toISOString(); };
const dateAdd = (day, n) => new Date(Date.parse(`${day}T12:00:00Z`) + n * DAY).toISOString().slice(0,10);
function calendarDay(value, timezone) {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone:timezone, year:'numeric', month:'2-digit', day:'2-digit' }).formatToParts(new Date(value));
  const p = Object.fromEntries(parts.map(x => [x.type,x.value])); return `${p.year}-${p.month}-${p.day}`;
}
// Convert a local wall-clock instant without assuming a permanent UTC offset.
// All deadlines fall outside DST's ambiguous/nonexistent early morning hours.
function zonedInstant(day, timezone, end = false) {
  const [y,m,d] = day.split('-').map(Number);
  const wanted = Date.UTC(y,m-1,d,end?23:0,end?59:0,end?59:0,end?999:0);
  let candidate = wanted;
  const fmt = new Intl.DateTimeFormat('en-US',{timeZone:timezone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'});
  for(let i=0;i<4;i++) {
    const p=Object.fromEntries(fmt.formatToParts(new Date(candidate)).map(x=>[x.type,x.value]));
    const actual=Date.UTC(+p.year,+p.month-1,+p.day,+p.hour,+p.minute,+p.second,end?999:0);
    const change=wanted-actual; candidate+=change; if(change===0)break;
  }
  return new Date(candidate).toISOString();
}
export function buildHomeworkSchedule(options = {}) {
  const startDate=options.startDate||HOMEWORK_CONFIG.startDate, timezone=options.timezone||HOMEWORK_CONFIG.timezone;
  if(!/^\d{4}-\d{2}-\d{2}$/.test(startDate)||!validTime(`${startDate}T12:00:00Z`)||new Date(`${startDate}T12:00:00Z`).toISOString().slice(0,10)!==startDate)throw new TypeError('Use a valid YYYY-MM-DD start date.');
  new Intl.DateTimeFormat('en-US',{timeZone:timezone});
  if(new Date(`${startDate}T12:00:00Z`).getUTCDay()!==1)throw new TypeError('The homework schedule must start on a Monday.');
  const lessons=LESSONS.filter(l=>/^d[1-5]$/.test(l.domainId));
  const assignments=lessons.map((l,index)=>{
    const week=Math.floor(index/5),scheduledDate=dateAdd(startDate,week*7+index%5);
    return {id:l.id,lessonId:l.id,title:l.title,domainId:l.domainId,domainName:l.domainName,index,weekId:`week-${String(week+1).padStart(2,'0')}`,scheduledDate,dueAt:zonedInstant(scheduledDate,timezone,true)};
  });
  const weeks=Array.from({length:Math.ceil(assignments.length/5)},(_,i)=>{
    const id=`week-${String(i+1).padStart(2,'0')}`,start=dateAdd(startDate,i*7),end=dateAdd(start,6);
    return {id,number:i+1,lessonIds:assignments.filter(a=>a.weekId===id).map(a=>a.lessonId),startDate:start,endDate:end,dueAt:zonedInstant(end,timezone,true)};
  });
  return {version:HOMEWORK_CONFIG.version,startDate,endDate:assignments.at(-1)?.scheduledDate,finalQuizDate:weeks.at(-1)?.endDate,timezone,assignments,weeks};
}
function isSupplemental(card) {
  if(card.homeworkExcluded===true)return true;
  const sources=[card.source,card.sourceType,...(Array.isArray(card.sources)?card.sources:[])].filter(Boolean);
  if(sources.some(source=>/\bQAE\b/i.test(source)))return false;
  return sources.some(source=>/\budemy\b|\bsupplemental\b/i.test(source));
}
function lessonFor(card, decks) {
  const related=decks.filter(d=>d.scopeKey===card.scopeKey&&card.deckIds?.includes(d.id)&&!['master','missed'].includes(d.kind));
  const overridden=related.filter(d=>d.categoryOverride);
  if(overridden.length){const ids=[...new Set(overridden.map(d=>deckLesson(d)?.id).filter(Boolean))];return ids.length===1?ids[0]:null;}
  return cardLesson(card)?.id||[...new Set(related.map(d=>deckLesson(d)?.id).filter(Boolean))].filter((_,i,a)=>a.length===1)[0]||null;
}
function cardReadiness(card, startAt, resetAt, now) {
  const p=card.effectiveProgress;
  const epoch=Math.max(Date.parse(startAt)||0,Date.parse(resetAt)||0,Date.parse(p?.resetAt)||0);
  const events=[...(card.reviewEvents||[])].filter(e=>Date.parse(e.reviewedAt)>=epoch&&Date.parse(e.reviewedAt)<=now).sort((a,b)=>Date.parse(a.reviewedAt)-Date.parse(b.reviewedAt));
  let first=null,latest=null,count=0,completedAt=null;
  for(const e of events){
    const time=Date.parse(e.reviewedAt);
    if(e.correct===false||e.rating==='Again'){first=null;latest=null;count=0;completedAt=null;continue;}
    if(e.correct!==true||!['Good','Easy'].includes(e.rating)){first=null;latest=null;count=0;completedAt=null;continue;}
    if(first===null){first=time;count=2;completedAt=new Date(time).toISOString();}
    else if(time-first>=HOMEWORK_CONFIG.recallGapMinutes*60000){count++;completedAt=new Date(time).toISOString();}
    latest=time;
  }
  const ready=Boolean(!card.answerConflict&&card.correctAnswer&&card.choices?.[card.correctAnswer]&&count>=2);
  return {ready,recalls:Math.min(2,count),completedAt:ready?completedAt:null,nextEligibleAt:!ready&&first!==null?new Date(first+HOMEWORK_CONFIG.recallGapMinutes*60000).toISOString():null,lastRecallAt:latest===null?null:new Date(latest).toISOString()};
}
export function buildHomeworkPlan(options = {}) {
  const {cards=[],progressMap={},reviews=[],state={},uid,decks=[]}=options;
  const now=Date.parse(stamp(options.now)),schedule=buildHomeworkSchedule(options),today=calendarDay(now,schedule.timezone);
  const startAt=validTime(state.startedAt)?state.startedAt:zonedInstant(schedule.startDate,schedule.timezone);
  const resetAt=options.resetAt||state.resetAt||null;
  const logical=uniqueStudyCards(cards,progressMap,reviews,{uid,decks});
  const originals=new Map(cards.map(c=>[`${c.scopeKey}__${c.id}`,c]));
  const lessonCards=new Map();
  for(const card of logical){
    const aliases=card.aliases.map(a=>originals.get(`${a.scopeKey}__${a.id}`)).filter(Boolean).filter(c=>!isSupplemental(c));
    const ids=[...new Set(aliases.map(c=>lessonFor(c,decks)).filter(Boolean))];
    if(ids.length!==1)continue;
    const lessonId=ids[0], item={...card,lessonId,homeworkReadiness:cardReadiness(card,startAt,resetAt,now)};
    if(!lessonCards.has(lessonId))lessonCards.set(lessonId,[]);lessonCards.get(lessonId).push(item);
  }
  let previousMissing=null;
  const assignments=schedule.assignments.map(a=>{
    const selected=lessonCards.get(a.lessonId)||[],identities=selected.map(c=>c.studyIdentity).sort(),saved=state.completions?.[a.lessonId];
    const readyCount=selected.filter(c=>c.homeworkReadiness.ready).length,ready=selected.length>0&&readyCount===selected.length;
    const savedEpoch=Math.max(Date.parse(resetAt)||0,...selected.map(c=>Date.parse(c.effectiveProgress?.resetAt)||0));
    const covered=saved?.cardIdentities&&identities.every(id=>saved.cardIdentities.includes(id));
    const epochMatches=(saved?.resetAt||null)===(resetAt||null);
    const completedAt=selected.length>0&&!selected.some(c=>c.answerConflict)&&covered&&epochMatches&&validTime(saved?.completedAt)&&Date.parse(saved.completedAt)>=savedEpoch&&Date.parse(saved.completedAt)<=now?saved.completedAt:null;
    const late=now>Date.parse(a.dueAt),onTime=completedAt?Date.parse(completedAt)<=Date.parse(a.dueAt):false;
    const status=completedAt?(onTime?'complete':'late-complete'):!selected.length?'missing':ready?'ready':late?'overdue':a.scheduledDate===today?'today':'upcoming';
    const blockedBy=previousMissing;
    if(!completedAt&&!previousMissing)previousMissing=a.lessonId;
    return {...a,cards:selected,total:selected.length,readyCount,masteredCount:selected.filter(c=>cardMastery(c.effectiveProgress)==='Mastered'&&!c.answerConflict).length,readinessPct:selected.length?Math.round(readyCount/selected.length*100):0,ready,completedAt,status,overdue:!completedAt&&late,onTime,blockedBy,canComplete:ready&&!blockedBy&&!completedAt,coverageChanged:Boolean(saved&&!completedAt),answerConflicts:selected.filter(c=>c.answerConflict).length};
  });
  const weeks=schedule.weeks.map(w=>{
    const items=assignments.filter(a=>a.weekId===w.id),completedLessons=items.filter(a=>a.completedAt).length,unlocked=completedLessons===w.lessonIds.length;
    const stored=state.quizzes?.[w.id],quiz=stored&&(!uid||!stored.uid||stored.uid===uid)&&Date.parse(stored.startedAt)>=Math.max(Date.parse(resetAt)||0,...items.flatMap(a=>a.cards.map(c=>Date.parse(c.effectiveProgress?.resetAt)||0)))?stored:null;
    const finished=quiz?.status==='submitted',late=now>Date.parse(w.dueAt),quizStatus=finished?'complete':!unlocked?'locked':quiz?.status==='active'?'in-progress':late?'overdue':'available';
    return {...w,completedLessons,unlocked,quiz,quizStatus,overdue:!finished&&late};
  });
  const assignmentEarned=assignments.reduce((n,a)=>n+(a.completedAt?(a.onTime?HOMEWORK_CONFIG.assignmentPoints:HOMEWORK_CONFIG.lateAssignmentPoints):0),0);
  const quizEarned=weeks.reduce((n,w)=>n+(w.quiz?.status==='submitted'?(Date.parse(w.quiz.submittedAt)<=Date.parse(w.dueAt)?HOMEWORK_CONFIG.quizPoints:HOMEWORK_CONFIG.lateQuizPoints):0),0);
  const enrolledAt=validTime(state.enrolledAt)?state.enrolledAt:null;
  const accountable=dueAt=>enrolledAt&&Date.parse(dueAt)>=Date.parse(enrolledAt);
  const lateAssignments=assignments.filter(a=>accountable(a.dueAt)&&(a.completedAt?Date.parse(a.completedAt):now)>Date.parse(a.dueAt)).length;
  const lateQuizzes=weeks.filter(w=>accountable(w.dueAt)&&(w.quiz?.status==='submitted'?Date.parse(w.quiz.submittedAt):now)>Date.parse(w.dueAt)).length;
  const penalties=(lateAssignments+lateQuizzes)*HOMEWORK_CONFIG.missedDeadlinePenalty;
  const currentWeek=weeks.find(w=>w.startDate<=today&&w.endDate>=today)|| (today<schedule.startDate?weeks[0]:weeks.at(-1));
  return {...schedule,assignments,weeks,today,asOf:new Date(now).toISOString(),uid:uid||null,enrolledAt,nextAssignment:assignments.find(a=>!a.completedAt)||null,currentWeek,completedCount:assignments.filter(a=>a.completedAt).length,overdueCount:assignments.filter(a=>a.overdue).length,readyCount:assignments.filter(a=>a.canComplete).length,points:{earned:assignmentEarned+quizEarned,penalties,total:assignmentEarned+quizEarned-penalties,lateAssignments,lateQuizzes,onTimeAssignments:assignments.filter(a=>a.completedAt&&a.onTime).length},readinessDefinition:HOMEWORK_READINESS_DEFINITION,resetAt,startedAt:startAt};
}
export function recordHomeworkCompletion(state={},plan,lessonId,now=plan?.asOf) {
  const assignment=plan?.assignments?.find(a=>a.lessonId===lessonId);
  if(!assignment)throw new Error('Choose a lesson in this homework plan.');
  if(assignment.completedAt)return structuredClone(state);
  if(!assignment.canComplete)throw new Error(assignment.blockedBy?'Complete the earlier lesson first.':assignment.total?'Clear every question with a correct Good or Easy recall.':'Import this lesson’s QAE questions first.');
  const completedAt=stamp(now);
  if(Date.parse(completedAt)<Date.parse(plan.asOf))throw new Error('Completion cannot be backdated before the verified plan.');
  return {...structuredClone(state),version:1,enrolledAt:state.enrolledAt||completedAt,startedAt:state.startedAt||plan.startedAt,completions:{...structuredClone(state.completions||{}),[lessonId]:{lessonId,completedAt,cardIdentities:assignment.cards.map(c=>c.studyIdentity).sort(),resetAt:plan.resetAt||null}}};
}
function quizQuestion(card,lessonId) {
  const identity=card.studyIdentity||studyIdentity(card);
  return {id:`question-${stableHash(identity)}`,identity,cardId:card.id,scopeKey:card.scopeKey,lessonId,question:card.question,choices:structuredClone(card.choices),correctAnswer:card.correctAnswer,justifications:structuredClone(card.justifications||{}),explanation:card.explanation||''};
}
export function createHomeworkQuiz(plan,weekId,options={}) {
  const week=plan?.weeks?.find(w=>w.id===weekId);
  if(!week?.unlocked)throw new Error('Complete all five assigned lessons to unlock this quiz.');
  if(week.quiz)return structuredClone(week.quiz);
  const startedAt=stamp(options.now??plan.asOf),uid=options.uid||plan.uid||'personal';
  const lessons=plan.assignments.filter(a=>a.weekId===weekId),banks=lessons.map(a=>a.cards.filter(c=>!c.answerConflict&&c.correctAnswer&&c.choices?.[c.correctAnswer]).map(c=>quizQuestion(c,a.lessonId)));
  if(banks.some(b=>!b.length))throw new Error('Each assigned lesson needs questions with verified answer keys.');
  const resetEpoch=Math.max(Date.parse(plan.resetAt)||0,...lessons.flatMap(a=>a.cards.map(c=>Date.parse(c.effectiveProgress?.resetAt)||0)));
  const resetAt=resetEpoch?new Date(resetEpoch).toISOString():null;
  const seed=`${uid}|${plan.startDate}|${weekId}|${resetAt||''}`;
  for(const bank of banks)bank.sort((a,b)=>stableHash(`${seed}|${a.identity}`).localeCompare(stableHash(`${seed}|${b.identity}`))||a.identity.localeCompare(b.identity));
  const limit=Math.max(lessons.length,Math.min(150,Math.floor(Number(options.questionCount)||HOMEWORK_CONFIG.quizQuestions)));
  const questions=[],seen=new Set();
  while(questions.length<limit&&banks.some(b=>b.length))for(const bank of banks){
    const q=bank.shift();if(q&&!seen.has(q.identity)&&questions.length<limit){seen.add(q.identity);questions.push(q);}
  }
  if(questions.length<lessons.length)throw new Error('This quiz needs a unique question from every lesson.');
  questions.forEach((q,index)=>{q.id=`question-${index+1}`;});
  const durationSeconds=questions.length*HOMEWORK_CONFIG.secondsPerQuestion;
  return {version:1,id:`quiz-${stableHash(seed)}`,weekId,uid,resetAt,startedAt,deadlineAt:new Date(Date.parse(startedAt)+durationSeconds*1000).toISOString(),dueAt:week.dueAt,durationSeconds,questions,answers:{},status:'active'};
}
export function quizTimeRemaining(quiz,now=Date.now()) { return quiz?.status==='active'?Math.max(0,Math.ceil((Date.parse(quiz.deadlineAt)-Date.parse(stamp(now)))/1000)):0; }
export function answerHomeworkQuiz(quiz,questionId,answer,options={}) {
  if(quiz?.status!=='active')return structuredClone(quiz);
  const now=stamp(options.now);
  if(Date.parse(now)<Date.parse(quiz.startedAt))throw new Error('The quiz clock cannot move before its start.');
  if(quizTimeRemaining(quiz,now)===0)return finalizeHomeworkQuiz(quiz,{now});
  const question=quiz.questions.find(q=>q.id===questionId);
  if(!question||!Object.hasOwn(question.choices,answer))throw new Error('Choose a valid answer for this quiz question.');
  return {...structuredClone(quiz),answers:{...quiz.answers,[questionId]:{answer,answeredAt:now}}};
}
export function finalizeHomeworkQuiz(quiz,options={}) {
  if(quiz?.status==='submitted')return structuredClone(quiz);
  if(quiz?.status!=='active')throw new Error('Start a quiz before submitting it.');
  const now=stamp(options.now);
  if(Date.parse(now)<Date.parse(quiz.startedAt))throw new Error('The quiz clock cannot move before its start.');
  const timedOut=Date.parse(now)>=Date.parse(quiz.deadlineAt),submittedAt=timedOut?quiz.deadlineAt:now;
  const items=quiz.questions.map(q=>{
    const saved=quiz.answers?.[q.id],answer=saved&&Date.parse(saved.answeredAt)<Date.parse(quiz.deadlineAt)&&Date.parse(saved.answeredAt)>=Date.parse(quiz.startedAt)?saved.answer:null;
    return {questionId:q.id,cardId:q.cardId,scopeKey:q.scopeKey,lessonId:q.lessonId,answer,correctAnswer:q.correctAnswer,correct:answer===q.correctAnswer,unanswered:!answer};
  });
  const correct=items.filter(i=>i.correct).length;
  return {...structuredClone(quiz),status:'submitted',submittedAt,result:{correct,total:items.length,incorrect:items.length-correct,unanswered:items.filter(i=>i.unanswered).length,accuracy:items.length?Math.round(correct/items.length*100):0,timedOut,durationSeconds:Math.max(0,Math.round((Date.parse(submittedAt)-Date.parse(quiz.startedAt))/1000)),items}};
}
export function recordHomeworkQuiz(state={},quiz) {
  if(!quiz?.weekId||!['active','submitted'].includes(quiz.status))throw new Error('A valid quiz is required.');
  const prior=state.quizzes?.[quiz.weekId];
  const existing=prior&&Date.parse(prior.startedAt)>=Math.max(Date.parse(state.resetAt)||0,Date.parse(quiz.resetAt)||0)?prior:null;
  if(existing?.status==='submitted')return structuredClone(state);
  if(existing&&(existing.id!==quiz.id||existing.startedAt!==quiz.startedAt||existing.deadlineAt!==quiz.deadlineAt))throw new Error('An active quiz cannot be restarted or given extra time.');
  return {...structuredClone(state),version:1,enrolledAt:state.enrolledAt||quiz.startedAt,quizzes:{...structuredClone(state.quizzes||{}),[quiz.weekId]:structuredClone(quiz)}};
}

export function enrollHomework(state={}, now=Date.now()) {
  if(validTime(state.enrolledAt))return structuredClone(state);
  return {...structuredClone(state),version:1,enrolledAt:stamp(now)};
}
// Guild snapshots contain accountability counts only, never question content,
// answers, private decks, or individual review history.
export function buildHomeworkPublicSummary(plan,state={}) {
  return refreshHomeworkPublicSummary({version:1,startDate:plan.startDate,timezone:plan.timezone,enrolledAt:state.enrolledAt||plan.enrolledAt||null,updatedAt:plan.asOf,
    assignments:plan.assignments.map(a=>({lessonId:a.lessonId,title:a.title,dueAt:a.dueAt,completedAt:a.completedAt,total:a.total,readyCount:a.readyCount})),
    weeks:plan.weeks.map(w=>({id:w.id,dueAt:w.dueAt,submittedAt:w.quiz?.status==='submitted'?w.quiz.submittedAt:null}))},plan.asOf);
}
export function refreshHomeworkPublicSummary(summary,now=Date.now()) {
  const time=Date.parse(stamp(now)),assignments=summary?.assignments||[],weeks=summary?.weeks||[];
  const enrolledAt=validTime(summary?.enrolledAt)?summary.enrolledAt:null;
  const onTime=a=>validTime(a.completedAt)&&Date.parse(a.completedAt)<=Date.parse(a.dueAt);
  const late=a=>validTime(a.completedAt)&&Date.parse(a.completedAt)>Date.parse(a.dueAt);
  const accountable=due=>enrolledAt&&Date.parse(due)>=Date.parse(enrolledAt);
  const overdueCount=assignments.filter(a=>!a.completedAt&&time>Date.parse(a.dueAt)).length;
  const lateAssignments=assignments.filter(a=>accountable(a.dueAt)&&(a.completedAt?Date.parse(a.completedAt):time)>Date.parse(a.dueAt)).length;
  const lateQuizzes=weeks.filter(w=>accountable(w.dueAt)&&(w.submittedAt?Date.parse(w.submittedAt):time)>Date.parse(w.dueAt)).length;
  const earned=assignments.reduce((n,a)=>n+(onTime(a)?HOMEWORK_CONFIG.assignmentPoints:late(a)?HOMEWORK_CONFIG.lateAssignmentPoints:0),0)+weeks.reduce((n,w)=>n+(w.submittedAt?(Date.parse(w.submittedAt)<=Date.parse(w.dueAt)?HOMEWORK_CONFIG.quizPoints:HOMEWORK_CONFIG.lateQuizPoints):0),0);
  const penalties=(lateAssignments+lateQuizzes)*HOMEWORK_CONFIG.missedDeadlinePenalty,next=assignments.find(a=>!a.completedAt);
  return {...structuredClone(summary),enrolledAt,asOf:new Date(time).toISOString(),completedCount:assignments.filter(a=>a.completedAt).length,quizCount:weeks.filter(w=>w.submittedAt).length,overdueCount,onTimeCount:assignments.filter(onTime).length,lateCount:assignments.filter(late).length,
    points:{earned,penalties,total:earned-penalties,lateAssignments,lateQuizzes},nextLesson:next?{id:next.lessonId,title:next.title,readinessPct:next.total?Math.round(next.readyCount/next.total*100):0}:null};
}
