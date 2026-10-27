import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';

const dom=new JSDOM('<main id="root"></main>',{url:'https://cq.test',pretendToBeVisual:true});
for(const name of ['window','document','localStorage','navigator'])Object.defineProperty(globalThis,name,{value:dom.window[name],configurable:true});
let experience=await import('../js/experience.js?responsive');
const $=selector=>document.querySelector(selector);
const tick=()=>new Promise(resolve=>setTimeout(resolve,15));
async function until(predicate,message){for(let i=0;i<50;i++){if(predicate())return;await tick();}assert.ok(predicate(),message);}
const cards=Array.from({length:2},(_,i)=>({id:`responsive${i}`,scopeKey:'personal_responsive',scope:'Personal',question:`Question ${i}`,choices:{A:'Correct text',B:'Wrong text'},correctAnswer:'A',justifications:{A:'Because evidence matters'},lessonId:'d1-t01',domainNumber:1,deckIds:[]}));
const calls=[];let completed=0;
const c={user:{uid:'responsive'},profile:{preferences:{},stats:{},v3:{homework:{startedAt:'2020-01-01T00:00:00Z'}}},library:{cards,decks:[],progress:{},reviews:[]},avatar:()=>'',toast:()=>{},saveQuiet:()=>{},save:async()=>{},navigate(){c.render();},render(){$('#root').innerHTML=experience.renderExperience('feed',c);experience.bindExperience('feed',c);},completeAssignment:async()=>{completed++;},review(card,input){return new Promise((resolve,reject)=>{calls.push({card,input,reject,resolve(){c.library.reviews.push({id:input.eventId,uid:c.user.uid,cardId:card.id,scopeKey:card.scopeKey,rating:input.rating,correct:input.selectedAnswer==='A',reviewedAt:input.reviewedAt||new Date().toISOString()});resolve();}});});}};
function answer(choice,rating){$(`[data-cq-choice="${choice}"]`).click();$('#cqReveal').click();if(rating)$(`[data-cq-rate="${rating}"]`).click();assert.ok($('#cqNextQuestion'),'Next appears synchronously after recording a rating');assert.equal($('#cqNextQuestion').disabled,false,'Slow network must not disable Next');}
try{
 experience.startLessonReview(c,'d1-t01');
 const first=$('#cqStudyCard h2').textContent;
 answer('B');
 assert.ok($('.cq-recall-result'),'Wrong answer retains its explanation');
 $('#cqNextQuestion').click();
 answer('A','Good');
 $('#cqNextQuestion').click();
 assert.equal($('#cqStudyCard h2').textContent,first,'Only the missed question returns even while Good is pending sync');
 assert.ok($('.cq-session-review'),'Extra questions have an orange review segment');
 assert.match($('.cq-session-current').textContent,/Review question/);
 assert.equal($('.cq-session-review').dataset.total,'1');
 answer('A','Good');
 $('#cqNextQuestion').click();
 assert.ok($('#cqCompleteLesson'),'Pending successful reviews can reach the lesson summary');
 assert.equal($('#cqCompleteLesson').disabled,true,'Completion waits for pending review sync');
 $('#cqCompleteLesson').click();assert.equal(completed,0);
 assert.ok($('[data-cq-sync]'),'Background syncing is visible');
 await until(()=>calls.length===1,'First save starts');
 assert.equal(calls[0].input.rating,'Again','Incorrect answers automatically record Again');
 const firstId=calls[0].input.eventId;
 calls[0].reject(new Error('Test connection unavailable'));
 await until(()=>$('#cqRetryReviews'),'Failed save exposes a retry control');
 assert.equal($('#cqCompleteLesson').disabled,true);
 // Simulate a fresh page module, preserving only the same persisted user state.
 experience=await import('../js/experience.js?responsive-reloaded');c.render();
 assert.ok($('#cqCompleteLesson'),'Reload resumes at the same lesson summary');
 assert.equal($('#cqCompleteLesson').disabled,true,'Reload cannot lose unsynced completion protection');
 await tick();
 if($('#cqRetryReviews'))$('#cqRetryReviews').click();
 await until(()=>calls.length>=2,'Reloaded pending reviews can retry');
 assert.equal(calls[1].input.eventId,firstId,'Retry preserves the review event ID');
 calls[1].resolve();
 await until(()=>calls.length>=3,'Second queued review begins');
 assert.equal(calls[2].input.rating,'Good');calls[2].resolve();
 await until(()=>calls.length>=4,'Third queued review begins');
 assert.equal(calls[3].input.rating,'Good');calls[3].resolve();
 await until(()=>$('#cqCompleteLesson')&&!$('#cqCompleteLesson').disabled,'Completion unlocks after all reviews save');
 assert.equal(new Set(calls.slice(1).map(call=>call.input.eventId)).size,3,'All distinct answers have unique stable IDs');
 $('#cqCompleteLesson').click();await tick();assert.equal(completed,1);
 console.log('Responsive lessons: immediate Next, auto Again, pending refill, orange reviews, durable retry and completion protection passed.');
}finally{dom.window.close();}
