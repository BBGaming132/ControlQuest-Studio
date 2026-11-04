import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';

const dom=new JSDOM('<main id="root"></main>',{url:'https://cq.test',pretendToBeVisual:true});
for(const name of ['window','document','localStorage','navigator'])Object.defineProperty(globalThis,name,{value:dom.window[name],configurable:true});
window.matchMedia=()=>({matches:true});
let experience=await import('../js/experience.js?sync-stability');
const $=selector=>document.querySelector(selector);
const tick=()=>new Promise(resolve=>setTimeout(resolve,15));
async function until(predicate,message){for(let i=0;i<50;i++){if(predicate())return;await tick();}assert.ok(predicate(),message);}
const cards=Array.from({length:2},(_,i)=>({id:`responsive${i}`,scopeKey:'personal_responsive',scope:'Personal',question:`Question ${i}`,choices:{A:'Correct text',B:'Wrong text'},correctAnswer:'A',justifications:{A:'Because evidence matters'},lessonId:'d1-t01',domainNumber:1,deckIds:[]}));
const calls=[];let completed=0;
const c={user:{uid:'responsive'},profile:{preferences:{},stats:{},v3:{homework:{startedAt:'2020-01-01T00:00:00Z'}}},library:{cards,decks:[],progress:{},reviews:[]},avatar:()=>'',toast:()=>{},saveQuiet:()=>{},save:async()=>{},navigate(){c.render();},render(){$('#root').innerHTML=experience.renderExperience('feed',c);experience.bindExperience('feed',c);},completeAssignment:async()=>{completed++;},review(card,input){return new Promise((resolve,reject)=>{calls.push({card,input,reject,resolve(){c.library.reviews.push({id:input.eventId,uid:c.user.uid,cardId:card.id,scopeKey:card.scopeKey,rating:input.rating,correct:input.selectedAnswer==='A',reviewedAt:input.reviewedAt||new Date().toISOString()});resolve();}});});}};
function answer(choice,rating){$(`[data-cq-choice="${choice}"]`).click();$('[data-cq-mobile-reveal]').click();if(rating)$(`[data-cq-mobile-rate="${rating}"]`).click();assert.ok($('#cqNextQuestion'),'Next appears synchronously after recording a rating');assert.equal($('#cqNextQuestion').disabled,false,'Slow network must not disable Next');}
try{
 experience.startLessonReview(c,'d1-t01');
 answer('A','Good');
 await until(()=>calls.length===1,'Save starts');
 $('[data-cq-mobile-next]').click();
 answer('A','Good');
 const card=$('#cqStudyCard'),details=$('.cq-answer-explanation'),next=$('[data-cq-mobile-next]');
 details.open=true;next.focus();
 calls[0].reject(new Error('Document is too large'));
 await until(()=>$('#cqRetryReviews'),'Retry appears in the compact sync row');
 assert.equal($('#cqStudyCard'),card,'A background sync failure never replaces the current question');
 assert.equal($('.cq-answer-explanation'),details);assert.equal(details.open,true,'An expanded explanation stays open');
 assert.equal(document.activeElement,next,'Sync errors preserve keyboard focus');
 $('#cqRetryReviews').click();
 await until(()=>calls.length===2,'Retry starts');
 calls[1].resolve();
 await until(()=>calls.length===3,'Next queued answer starts');
 assert.equal($('#cqStudyCard'),card,'A successful background acknowledgment never replaces the question');
 calls[2].resolve();
 await until(()=>/All answers synced/.test($('[data-cq-sync]').textContent),'Sync status updates without rerender');
 assert.equal($('#cqStudyCard'),card);assert.equal(details.open,true);assert.equal(document.activeElement,next);
 assert.match($('.cq-feedback-ack [role="status"]').textContent,/Review synced/);
 console.log('Sync stability: DOM identity, explanation state, focus, retry and acknowledgment preserved.');
}finally{dom.window.close();}
