import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';

const dom=new JSDOM('<main id="root"></main>',{url:'https://cq.test',pretendToBeVisual:true});
for(const name of ['window','document','localStorage','navigator'])Object.defineProperty(globalThis,name,{value:dom.window[name],configurable:true});
window.matchMedia=()=>({matches:true});
let experience=await import('../js/experience.js?practice-flow');
const $=selector=>document.querySelector(selector);
const tick=()=>new Promise(resolve=>setTimeout(resolve,15));
async function until(predicate,message){for(let i=0;i<50;i++){if(predicate())return;await tick();}assert.ok(predicate(),message);}
const cards=Array.from({length:2},(_,i)=>({id:`responsive${i}`,scopeKey:'personal_responsive',scope:'Personal',question:`Question ${i}`,choices:{A:'Correct text',B:'Wrong text'},correctAnswer:'A',justifications:{A:'Because evidence matters'},lessonId:'d1-t01',domainNumber:1,deckIds:[]}));
const calls=[];let completed=0;
const c={user:{uid:'responsive'},profile:{preferences:{},stats:{},v3:{homework:{startedAt:'2020-01-01T00:00:00Z'}}},library:{cards,decks:[],progress:{},reviews:[]},avatar:()=>'',toast:()=>{},saveQuiet:()=>{},save:async()=>{},navigate(){c.render();},render(){$('#root').innerHTML=experience.renderExperience('feed',c);experience.bindExperience('feed',c);},completeAssignment:async()=>{completed++;},review(card,input){return new Promise((resolve,reject)=>{calls.push({card,input,reject,resolve(){c.library.reviews.push({id:input.eventId,uid:c.user.uid,cardId:card.id,scopeKey:card.scopeKey,rating:input.rating,correct:input.selectedAnswer==='A',reviewedAt:input.reviewedAt||new Date().toISOString()});resolve();}});});}};
function answer(choice,rating){$(`[data-cq-choice="${choice}"]`).click();$('[data-cq-mobile-reveal]').click();if(rating)$(`[data-cq-mobile-rate="${rating}"]`).click();assert.ok($('#cqNextQuestion'),'Next appears synchronously after recording a rating');assert.equal($('#cqNextQuestion').disabled,false,'Slow network must not disable Next');}
try{
 // A quiz miss is eligible even if the earlier lesson was already cleared.
 experience.startQuizPractice(c,'week01',{pending:[{weekId:'week01',identity:'missing-alias',cardId:cards[1].id,scopeKey:cards[1].scopeKey},{weekId:'week02',cardId:cards[0].id,scopeKey:cards[0].scopeKey}]});
 assert.equal($('#cqStudyCard h2').textContent,cards[1].question);
 assert.match($('.cq-card-meta').textContent,/1 \/ 1/);
 answer('A','Good');
 let release,requested;
 c.generatePractice=(card,count)=>{requested={card,count};return new Promise(resolve=>release=resolve);};
 localStorage.setItem(`cqPracticeEndpoint:${c.user.uid}`,'https://practice.example/generate');
 const current=$('#cqStudyCard');
 $('#cqGeneratePractice').click();
 assert.equal($('#cqGeneratePractice').disabled,true);
 assert.equal(requested.card.id,cards[1].id);
 const generated=Array.from({length:10},(_,i)=>({...cards[0],id:`ai_${i}`,aiGenerated:true,homeworkExcluded:true,question:`New concept ${i}`}));
 c.library.cards.push(...generated);release(generated);
 await until(()=>!$('#cqGeneratePractice').disabled,'Generation finishes');
 assert.equal($('#cqStudyCard'),current,'Generation completion preserves the active question DOM');
 assert.equal($('.cq-session-review').dataset.total,'10');
 $('[data-cq-mobile-next]').click();
 assert.match($('#cqStudyCard h2').textContent,/New concept/);
 assert.match($('.cq-ai-label').textContent,/Unverified/);
 console.log('Practice flow: targeted quiz misses, week isolation, generated append, progress, stable UI and labeling passed.');
}finally{dom.window.close();}
