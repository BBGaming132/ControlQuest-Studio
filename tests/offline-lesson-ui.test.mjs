import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';

const dom=new JSDOM('<main id="root"></main>',{url:'https://cq.test',pretendToBeVisual:true});
for(const name of ['window','document','localStorage','navigator'])Object.defineProperty(globalThis,name,{value:dom.window[name],configurable:true});
window.matchMedia=()=>({matches:true});
let experience=await import('../js/experience.js?offline-credit');
const $=selector=>document.querySelector(selector);
const tick=()=>new Promise(resolve=>setTimeout(resolve,15));
async function until(predicate,message){for(let i=0;i<50;i++){if(predicate())return;await tick();}assert.ok(predicate(),message);}
const cards=Array.from({length:2},(_,i)=>({id:`responsive${i}`,scopeKey:'personal_responsive',scope:'Personal',question:`Question ${i}`,choices:{A:'Correct text',B:'Wrong text'},correctAnswer:'A',justifications:{A:'Because evidence matters'},lessonId:'d1-t01',domainNumber:1,deckIds:[]}));
const calls=[];let completed=0;
const c={user:{uid:'responsive'},profile:{preferences:{},stats:{},v3:{homework:{startedAt:'2020-01-01T00:00:00Z'}}},library:{cards,decks:[],progress:{},reviews:[]},avatar:()=>'',toast:()=>{},saveQuiet:()=>{},save:async()=>{},navigate(){c.render();},render(){$('#root').innerHTML=experience.renderExperience('feed',c);experience.bindExperience('feed',c);},completeAssignment:async()=>{completed++;},review(card,input){return new Promise((resolve,reject)=>{calls.push({card,input,reject,resolve(){c.library.reviews.push({id:input.eventId,uid:c.user.uid,cardId:card.id,scopeKey:card.scopeKey,rating:input.rating,correct:input.selectedAnswer==='A',reviewedAt:input.reviewedAt||new Date().toISOString()});resolve();}});});}};
function answer(choice,rating){$(`[data-cq-choice="${choice}"]`).click();$('[data-cq-mobile-reveal]').click();if(rating)$(`[data-cq-mobile-rate="${rating}"]`).click();assert.ok($('#cqNextQuestion'),'Next appears synchronously after recording a rating');assert.equal($('#cqNextQuestion').disabled,false,'Slow network must not disable Next');}
try{
 let received;c.pendingHomework=()=>[];c.completeAssignment=async(id,assignment)=>{received={id,assignment};};
 experience.startLessonReview(c,'d1-t01');
 answer('A','Good');$('[data-cq-mobile-next]').click();
 answer('A','Good');$('[data-cq-mobile-next]').click();
 assert.equal($('#cqCompleteLesson').disabled,false,'Durable offline completion is available with answers awaiting cloud');
 assert.match($('#cqCompleteLesson').textContent,/on this device/);
 $('#cqCompleteLesson').click();await tick();
 assert.equal(received.id,'d1-t01');assert.equal(received.assignment.readyCount,2);
 assert.ok($('[data-cq-sync]'),'Unconfirmed reviews remain visible');
 assert.doesNotMatch($('[data-cq-sync]').textContent,/All answers synced/);
 const queued=JSON.parse(localStorage.getItem('cq-review-outbox-responsive-solo'));
 assert.equal(queued.length,2);assert.ok(queued.every(entry=>Number.isFinite(Date.parse(entry.input.reviewedAt))));
 console.log('Offline lesson UI: enabled local credit, pending readiness, original answer time and honest unsynced notice passed.');
}finally{dom.window.close();}
