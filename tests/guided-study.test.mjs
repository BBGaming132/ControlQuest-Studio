import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
const dom=new JSDOM('<main id="root"></main>',{url:'https://controlquest.test'});
for(const key of ['window','document','localStorage','navigator'])Object.defineProperty(globalThis,key,{value:dom.window[key],configurable:true});
let experience=await import('../js/experience.js?guided-test');
const $=s=>document.querySelector(s),tick=()=>new Promise(resolve=>setTimeout(resolve,0));
function context(uid,cards=[]){
  let view='command';
  const c={user:{uid},profile:{displayName:'Private Person',timezone:'America/New_York',activeGroupId:null,stats:{xp:0,coins:0,streak:0},v3:{dailyGoal:20,studyMinutes:5}},library:{cards,decks:[],reviews:[],progress:{}},group:null,level:1,avatar:()=>'<svg></svg>',save:async()=>{},saveQuiet:()=>{},toast:()=>{},worldAction:async()=>{},completeLesson:async()=>{},review:async()=>{},navigate:next=>{view=next;c.render();},render:()=>{$('#root').innerHTML=experience.renderExperience(view,c);experience.bindExperience(view,c);}};return c;
}
const cards=[1,5].map(n=>({id:'card-'+n,scopeKey:'personal_learner',scope:'Personal',ownerUid:'learner',question:'Question '+n,domainNumber:n,choices:{A:'Evidence',B:'Guess'},correctAnswer:'A',deckIds:[]}));
try{
  const empty=context('empty');empty.render();assert.equal($('.cq-next-step .primary-button').dataset.cqNav,'import');assert.equal($('[data-cq-start="recommended"]'),null,'Empty libraries must not offer a zero-card session');assert.ok($('.cq-guide-path'));assert.equal($('.cq-progress-disclosure').open,false,'Detailed domain counts stay available without overwhelming the entry');
  const c=context('learner',cards);c.render();assert.equal($('.cq-next-step .primary-button').dataset.cqStart,'recommended');assert.ok(!$('#root').textContent.includes('Private Person'),'The public-facing welcome uses generic copy');assert.equal(document.querySelectorAll('.cq-next-step .primary-button').length,1);
  $('[data-cq-domain="d2"]').click();assert.ok($('#root').textContent.includes('No questions match this selection.'));c.navigate('command');$('[data-cq-start="recommended"]').click();assert.ok($('.cq-study-card'));assert.equal(c.profile.v3.pocketSession.domain,'','The daily recommendation clears a previous empty domain filter');assert.equal(c.profile.v3.pocketSession.queue.length,2);
  const run=c.profile.v3.pocketSession.run;c.navigate('command');assert.equal($('.cq-start').dataset.cqNav,'feed','An unfinished round has one resume action');$('.cq-start').click();assert.equal(c.profile.v3.pocketSession.run,run,'Resume must not rebuild the queue');assert.equal($('.cq-study-settings').open,false,'Active-question filters remain optional');
  c.profile.activeGroupId='guild-a';c.group={id:'guild-a',name:'Study Crew',members:{}};c.navigate('adventure');$('[data-qw-mode="coop"]').click();await tick();assert.equal(c.profile.v3.preferredWorldMode,'coop');assert.equal(c.profile.v3.preferredWorldGroupId,'guild-a');
  experience=await import('../js/experience.js?guided-reload');c.render();assert.equal($('[data-qw-mode="coop"]').getAttribute('aria-pressed'),'true','Selected world is restored for the same account and Guild');
  let resolveAction,calls=0;c.worldAction=()=>{calls++;return new Promise(resolve=>{resolveAction=resolve;});};const button=$('[data-qw-action="travel"]:not(.is-active)');button.click();button.dispatchEvent(new window.MouseEvent('click',{bubbles:true}));assert.equal(calls,1,'A pending action cannot be double submitted');resolveAction({changed:false,feedback:{tone:'hint',message:'Answer one question to earn more focus.'},needsStudy:true});await tick();assert.ok($('#root').textContent.includes('Answer one question to earn more focus.'),'Rejected action guidance remains visible');
  c.profile.activeGroupId='guild-b';c.group={id:'guild-b',name:'New Crew',members:{}};c.render();assert.equal($('[data-qw-mode="solo"]').getAttribute('aria-pressed'),'true','Changing Guild does not silently act on another shared colony');
  console.log('Guided study: clear empty/start/resume actions, optional detail, filter recovery, private welcome, selected-world persistence, duplicate-action guard and visible rejected-action feedback passed');
}finally{dom.window.close();}
