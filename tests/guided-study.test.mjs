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
  const personal={kept:true};c.profile.v3.world=personal;c.profile.activeGroupId='guild-a';c.group={id:'guild-a',name:'Study Crew',members:{}};c.navigate('adventure');assert.ok($('.expedition-view'));assert.equal($('[data-qw-mode]'),null,'One island has no competing world toggle');assert.ok($('.expedition-view'));assert.equal(c.profile.v3.world,personal,'Joining a Guild preserves the personal island save');
  experience=await import('../js/experience.js?guided-reload');c.render();assert.ok($('#root').textContent.includes('Study Crew'),'The active Guild is the default island after reload');
  c.profile.activeGroupId='guild-b';c.group={id:'guild-b',name:'New Crew',members:{}};c.render();assert.ok($('.expedition-view'));assert.equal(c.profile.v3.world,personal);assert.equal(c.profile.v3.pocketSession?.groupId==='guild-a',false);
  console.log('Guided study: clear empty/start/resume actions, optional detail, filter recovery, private welcome, one active Guild island, automatic world routing and preserved personal saves passed');
}finally{dom.window.close();}
