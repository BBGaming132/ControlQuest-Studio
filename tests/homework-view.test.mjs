import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {LESSONS} from '../js/lesson-catalog.js';
import {buildHomeworkPlan,recordHomeworkCompletion,enrollHomework,createHomeworkQuiz,recordHomeworkQuiz,answerHomeworkQuiz,finalizeHomeworkQuiz} from '../js/homework-plan.js';
import {renderHomework,bindHomework,renderHomeworkQuiz,bindHomeworkQuiz} from '../js/homework-view.js';
const dom=new JSDOM('<main id="root"></main>',{url:'https://controlquest.test',pretendToBeVisual:true});
const root=dom.window.document.querySelector('#root');
const flush=()=>new Promise(resolve=>setTimeout(resolve,0));
const cards=LESSONS.slice(0,5).map((lesson,i)=>({id:`q-${i}`,scopeKey:'personal_learner',lessonId:lesson.id,question:`Question ${i} <script>bad()</script>`,choices:{A:'Independent evidence',B:'Guessing'},correctAnswer:'A',justifications:{A:'The explanation belongs after submission.'}}));
const reviews=cards.flatMap(card=>['2026-10-26T13:00:00Z','2026-10-26T13:11:00Z'].map((reviewedAt,i)=>({id:`${card.id}-${i}`,uid:'learner',scopeKey:card.scopeKey,cardId:card.id,reviewedAt,rating:'Good',correct:true})));
let time='2026-10-26T14:00:00Z',cleanup=()=>{},page='home',quizIndex=undefined,saveCount=0,fail=false,lastStudy=null;
const c={uid:'learner',cards,reviews,decks:[],homework:{},now:()=>time,onSaveHomework:async value=>{saveCount++;if(fail)throw Error('Save failed');return {...value,_server:'accepted'};},onStudyLesson:id=>{lastStudy=id;},onFreeStudy:()=>{page='free';},onNavigate:()=>{page='home';draw();},onOpenQuiz:()=>{page='quiz';draw();},onQuizIndex:index=>{quizIndex=index;},onRender:()=>draw(),guildSummaries:[{displayName:'<img src=x onerror=alert(1)>',completedCount:2,onTimeCount:1,overdueCount:1,points:{total:25},updatedAt:time}]};
function draw(){cleanup();c.plan=buildHomeworkPlan({...c,state:c.homework,now:time});c.quizIndex=quizIndex;root.innerHTML=page==='quiz'?renderHomeworkQuiz(c,'week-01'):renderHomework(c);cleanup=page==='quiz'?bindHomeworkQuiz(root,c,'week-01'):bindHomework(root,c);}
try{
 draw();assert.equal(root.querySelectorAll('[data-hw-row]').length,60);assert.equal(root.querySelectorAll('.hw-week-group').length,12);assert.ok(root.querySelector('[data-hw-enroll]'));assert.equal(root.querySelector('img'),null,'Member names are text, not markup');assert.ok(root.textContent.includes('25'),'Engine-shaped Guild points render');
 const filter=root.querySelector('[data-hw-domain-filter]');filter.value='d3';filter.dispatchEvent(new dom.window.Event('change'));assert.equal([...root.querySelectorAll('[data-hw-row]')].filter(n=>!n.hidden).length,8);
 fail=true;root.querySelector('[data-hw-enroll]').click();await flush();assert.equal(c.homework.enrolledAt,undefined);assert.ok(root.querySelector('[data-hw-message]').textContent.includes('Save failed'));
 fail=false;root.querySelector('[data-hw-enroll]').click();await flush();assert.ok(c.homework.enrolledAt);assert.equal(c.homework._server,'accepted','Server-returned state is authoritative');assert.equal(root.querySelector('[data-hw-enroll]'),null);
 root.querySelector('[data-hw-complete]').click();await flush();assert.ok(c.homework.completions['d1-t01']);assert.equal(buildHomeworkPlan({...c,state:c.homework,now:time}).nextAssignment.lessonId,'d1-t02');
 for(const card of cards.slice(1)){const plan=buildHomeworkPlan({...c,state:c.homework,now:time});c.homework=recordHomeworkCompletion(c.homework,plan,card.lessonId,time);}
 draw();root.querySelector('[data-hw-quiz="week-01"]').click();assert.ok(root.querySelector('[data-hw-start-quiz]'));assert.ok(root.textContent.includes('96 seconds'));
 fail=true;root.querySelector('[data-hw-start-quiz]').click();await flush();assert.equal(c.homework.quizzes,undefined,'A failed start save does not launch a timer');
 fail=false;root.querySelector('[data-hw-start-quiz]').click();await flush();assert.equal(c.homework.quizzes['week-01'].questions.length,5);assert.equal(c.homework.quizzes['week-01'].durationSeconds,480);assert.ok(root.querySelector('[data-hw-timer]'));assert.equal(root.querySelector('script'),null);assert.equal(root.textContent.includes('The explanation belongs after submission.'),false,'No rationale leak during timed attempt');
 const deadline=c.homework.quizzes['week-01'].deadlineAt;
 root.querySelector('[data-hw-answer="A"]').click();await flush();assert.equal(c.homework.quizzes['week-01'].answers['question-1'].answer,'A');assert.equal(root.querySelector('[data-hw-answer="A"]').getAttribute('aria-pressed'),'true','Saved selection stays visible until explicit navigation');
 quizIndex=0;draw();assert.equal(root.querySelector('[data-hw-answer="A"]').getAttribute('aria-pressed'),'true','Saved answer objects render selected on revisit');
 assert.equal(c.homework.quizzes['week-01'].deadlineAt,deadline,'Reload/rerender never resets clock');
 root.querySelector('[data-hw-submit-quiz]').click();await flush();assert.equal(c.homework.quizzes['week-01'].status,'submitted');assert.equal(c.homework.quizzes['week-01'].result.correct,1);assert.ok(root.textContent.includes('1 of 5 correct.'));assert.ok(root.textContent.includes('The explanation belongs after submission.'));assert.equal(root.querySelector('[data-hw-timer]'),null);
 // Expiration finalizes an existing fixed-deadline attempt on re-entry.
 c.homework={...c.homework,quizzes:{}};const plan=buildHomeworkPlan({...c,state:c.homework,now:time});let quiz=createHomeworkQuiz(plan,'week-01',{uid:'learner',now:time});c.homework=recordHomeworkQuiz(c.homework,quiz);time='2026-10-26T14:09:00Z';draw();await flush();assert.equal(c.homework.quizzes['week-01'].status,'submitted');assert.equal(c.homework.quizzes['week-01'].submittedAt,quiz.deadlineAt);assert.equal(c.homework.quizzes['week-01'].result.unanswered,5);
 // Reset invalidates the plan's attempt even when the archived raw quiz remains saved.
 c.homework={...c.homework,resetAt:'2026-10-26T14:10:00Z'};time='2026-10-26T14:11:00Z';draw();assert.ok(root.querySelector('[data-hw-start-quiz]'));assert.equal(root.querySelector('[data-hw-start-quiz]').disabled,true);assert.equal(root.textContent.includes('0 of 5 correct.'),false,'An archived pre-reset quiz cannot resurface as the current attempt');
 const old=root.querySelector('[data-hw-home]');cleanup();page='quiz';old.click();assert.equal(page,'quiz','Cleanup removes navigation handlers');
 console.log('Homework UI: enrollment, 60 lesson filtering, real Guild counts, save failures, durable answer selection, fixed timers, timeout recovery and escaped content pass.');
}finally{cleanup();dom.window.close();}
