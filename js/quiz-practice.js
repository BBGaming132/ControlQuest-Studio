import {studyIdentity} from './study-intelligence.js';
// Follow-up work is derived from immutable quiz submissions and saved reviews.
// No duplicated question bank or ever-growing task list is stored on the profile.
export function quizPracticePlan(homework={},reviews=[],{uid,now=Date.now(),weekId,cards=[]}={}){
 const time=new Date(now).getTime(),reset=Date.parse(homework.resetAt)||0,misses=new Map();
 for(const quiz of Object.values(homework.quizzes||{})){
  if(quiz.status!=='submitted'||(weekId&&quiz.weekId!==weekId)||(uid&&quiz.uid&&quiz.uid!==uid)||Date.parse(quiz.startedAt)<reset||Date.parse(quiz.submittedAt)>time)continue;
  for(const q of quiz.questions||[]){
   const item=quiz.result?.items?.find(i=>i.questionId===q.id);
   const answer=item?item.answer:quiz.answers?.[q.id]?.answer;
   if(answer===q.correctAnswer)continue;
   const identity=q.identity||`${q.scopeKey}|${q.cardId}`;
   const prior=misses.get(identity);
   if(prior&&Date.parse(prior.missedAt)>=Date.parse(quiz.submittedAt))continue;
   misses.set(identity,{...q,identity,weekId:quiz.weekId,quizId:quiz.id,missedAt:quiz.submittedAt,selectedAnswer:answer||null});
  }
 }
 const identities=new Map(cards.map(card=>[`${card.scopeKey}|${card.id}`,studyIdentity(card)]));
 const pending=[],cleared=[];
 for(const item of misses.values()){
  const latest=reviews.filter(r=>(!uid||r.uid===uid)&&((r.studyIdentity&&r.studyIdentity===item.identity)||identities.get(`${r.scopeKey}|${r.cardId}`)===item.identity||(r.cardId===item.cardId&&r.scopeKey===item.scopeKey)||(item.aliases||[]).some(a=>a.id===r.cardId&&a.scopeKey===r.scopeKey))&&Date.parse(r.reviewedAt)>Date.parse(item.missedAt)&&Date.parse(r.reviewedAt)<=time).sort((a,b)=>Date.parse(b.reviewedAt)-Date.parse(a.reviewedAt))[0];
  (latest?.correct===true&&['Good','Easy'].includes(latest.rating)?cleared:pending).push(item);
 }
 pending.sort((a,b)=>Date.parse(a.missedAt)-Date.parse(b.missedAt));
 return {pending,cleared,total:misses.size,practiceCount:pending.length?Math.min(15,Math.max(10,pending.length*2)):0,lessonIds:[...new Set(pending.map(q=>q.lessonId).filter(Boolean))]};
}
