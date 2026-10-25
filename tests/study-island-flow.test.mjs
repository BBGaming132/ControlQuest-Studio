import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {createWorld,advanceWorld} from '../js/quest-world.js';
const dom=new JSDOM('<main id="root"></main>',{url:'https://study.test',pretendToBeVisual:true});
for(const key of ['window','document','localStorage','navigator'])Object.defineProperty(globalThis,key,{value:dom.window[key],configurable:true});
const experience=await import('../js/experience.js?island-flow');
const $=s=>document.querySelector(s),tick=()=>new Promise(r=>setTimeout(r,0));let view='command',calls=[];
const personal=createWorld();personal.resources.wood=42;
const c={user:{uid:'learner'},profile:{uid:'learner',activeGroupId:'crew-a',stats:{xp:0,streak:0},v3:{world:personal,dailyGoal:20,studyMinutes:5}},group:{id:'crew-a',name:'Lighthouse Crew',questWorld:createWorld(),members:{}},library:{cards:[1,2,3].map(n=>({id:'q'+n,scopeKey:'personal_learner',question:'Recall '+n,choices:{A:'Evidence',B:'Assumption'},correctAnswer:'A',domainNumber:1,deckIds:[]})),decks:[],reviews:[],progress:{}},level:1,avatar:()=>'<svg></svg>',save:async()=>{},saveQuiet:()=>{},toast:()=>{},getWorld:()=>c.group?.questWorld||c.profile.v3.world,navigate:v=>{view=v;c.render();},render:()=>{$('#root').innerHTML=experience.renderExperience(view,c);experience.bindExperience(view,c);},worldAction:async event=>advanceWorld(c.getWorld(),{...event,id:'world-action'}),review:async(card,input)=>{calls.push(input);c.group={...c.group,questWorld:advanceWorld(c.group.questWorld,{type:'study-answer',id:input.eventId,correct:input.selectedAnswer===card.correctAnswer}).world};}};
try{
 c.render();$('[data-cq-start="recommended"]').click();const run=c.profile.v3.pocketSession.run;
 $('[data-cq-choice="A"]').click();$('#cqReveal').click();await $('[data-cq-rate="Good"]').onclick();
 assert.equal(calls[0].worldMode,'coop','The active Guild is the only study island destination');
 assert.equal(c.group.questWorld.stats.study,1);assert.equal(c.profile.v3.world.resources.wood,42,'Personal save stays preserved');
 assert.match($('.cq-reward-burst').textContent,/\+2 quest coins/,'Reward receipt shows actual engine result');
 assert.equal($('.island-play'),null,'Focus mode does not force gameplay');$('[data-cq-experience="expedition"]').click();assert.ok($('.expedition-view'));assert.equal($('[data-qw-mode]'),null);
 $('#cqNextQuestion').click();assert.ok($('#cqStudyCard'));assert.equal(c.profile.v3.pocketSession.run,run,'Returning to a question does not rebuild the queue');assert.equal(c.profile.v3.pocketSession.index,1);
 c.navigate('adventure');assert.ok($('.expedition-view'),'The shared expedition remains available beside the same question queue');
 c.navigate('feed');$('[data-cq-choice="A"]').click();$('#cqReveal').click();let finish;c.review=()=>new Promise(r=>{finish=r;});const saving=$('[data-cq-rate="Good"]').onclick();
 c.profile.activeGroupId='crew-b';c.group={id:'crew-b',name:'New Crew',questWorld:createWorld(),members:{}};c.navigate('feed');finish();await saving;assert.equal($('.cq-feed-interlude'),null,'A previous Guild save cannot open a turn in the new Guild');
 console.log('Study island flow: one Guild destination, real reward receipts, preserved personal world, scene inspection, queue resume and Guild-switch isolation passed.');
}finally{dom.window.close();}
