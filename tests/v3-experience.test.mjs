import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {renderExperience,bindExperience,EXPERIENCE_VIEWS} from '../js/experience.js';
import {CISA_MICROLESSONS} from '../js/cisa-learning.js';
import {createWorld,advanceWorld} from '../js/quest-world.js';

const dom=new JSDOM('<main id="test-root"></main>',{url:'https://controlquest.test',pretendToBeVisual:true});
for(const name of ['window','document','localStorage','HTMLElement','navigator'])Object.defineProperty(globalThis,name,{value:dom.window[name],configurable:true});
const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
function context(uid,options={}){
  const cards=[
    {id:'audit',scopeKey:`personal_${uid}`,scope:'Personal',ownerUid:uid,deckIds:['d1'],question:'Which audit evidence is BEST?',choices:{A:'Independent confirmation',B:'Convenience'},correctAnswer:'A',justifications:{A:'Independent evidence is more reliable.',B:'Convenience does not establish reliability.'},domainNumber:1,lessonId:'d1-t07',wasCorrectAtImport:false},
    {id:'security',scopeKey:`personal_${uid}`,scope:'Personal',ownerUid:uid,deckIds:['d5'],question:'Who approves access?',choices:{A:'The auditor',B:'The data owner'},correctAnswer:'B',justifications:{B:'Management retains access accountability.'},domainNumber:5,lessonId:'d5-t03'},
    {id:'reclassified',scopeKey:`personal_${uid}`,scope:'Personal',ownerUid:uid,deckIds:['corrected'],question:'A recategorized question',choices:{A:'First',B:'Second'},correctAnswer:'A',justifications:{A:'First is the source key.'},domainNumber:1,lessonId:'d1-t01'}
  ];
  let view='command';
  const c={user:{uid},profile:{uid,displayName:'Bennett <img src=x onerror=alert(1)>',timezone:'America/New_York',stats:{xp:12,coins:4,streak:2},v3:{dailyGoal:20,studyMinutes:options.minutes||10,activity:[],lessonProgress:{}}},group:null,
    library:{cards:options.empty?[]:cards,decks:[{id:'d1',scopeKey:`personal_${uid}`,kind:'lesson',lessonId:'d1-t07'},{id:'d5',scopeKey:`personal_${uid}`,kind:'lesson',lessonId:'d5-t03'},{id:'corrected',scopeKey:`personal_${uid}`,kind:'lesson',lessonId:'d3-t01',domainId:'d3',categoryOverride:true}],progress:{},reviews:[]},level:2,
    avatar:()=>'<svg role="img" aria-label="Ollie" viewBox="0 0 10 10"><circle r="4" cx="5" cy="5"/></svg>',
    toasts:[],reviews:[],completed:[],actions:[],save:async()=>{},refresh:async()=>{},download:()=>{},importBatch:async()=>{},
    toast:(...args)=>c.toasts.push(args),navigate:next=>{view=next;c.render();},render:()=>{const root=$('#test-root');root.innerHTML=renderExperience(view,c);bindExperience(view,c);},
    review:async(card,review)=>{if(c.failReview)throw new Error('Simulated save failure');c.reviews.push({card,...review});},
    completeLesson:async lesson=>{const id=lesson.lessonId||lesson.id;if(!c.profile.v3.lessonProgress[id]){c.completed.push(id);c.profile.v3.lessonProgress[id]='saved';}},
    worldAction:async(event,mode)=>{c.actions.push({event,mode});c.profile.v3.world=advanceWorld(createWorld(c.profile.v3.world),{...event,id:'action-'+c.actions.length}).world;}
  };
  return c;
}
const change=(selector,value,type='change')=>{const e=$(selector);assert.ok(e,selector);e.value=value;e.dispatchEvent(new window.Event(type,{bubbles:true}));};
const drag=(target,from,to)=>{for(const [type,pos] of [['pointerdown',from],['pointerup',to]]){const event=new window.MouseEvent(type,{bubbles:true,clientX:pos[0],clientY:pos[1]});Object.defineProperties(event,{pointerType:{value:'touch'},pointerId:{value:1}});target.dispatchEvent(event);}};
const click=async selector=>{const e=$(selector);assert.ok(e,selector);if(e.onclick)await e.onclick(new window.MouseEvent('click'));else{e.click();await new Promise(r=>setTimeout(r,0));}};
const c=context('qa-user');
try{
  for(const view of EXPERIENCE_VIEWS){c.navigate(view);assert.ok($('.cq-experience'));assert.ok($('.cq-page-head h1')||$('.island-play'));assert.ok(!$('#test-root').textContent.includes('undefined'),`${view} renders undefined content`);}
  c.navigate('command');assert.equal($$('.cq-domain-tile').length,5);assert.equal($$('.cq-welcome img').length,0);
  // Domain selection uses the corrected category, not the old source domain.
  await click('[data-cq-domain="d1"]');assert.equal($('.cq-study-card h2').textContent,'Which audit evidence is BEST?');
  assert.equal($('#cqReveal').disabled,true);await click('[data-cq-choice="B"]');assert.equal($('#cqReveal').disabled,false);await click('#cqReveal');
  assert.ok($('.cq-recall-result').textContent.includes('Independent confirmation'));
  assert.ok($('#test-root').textContent.includes('scheduled as Again'));
  $('#cqListenAnswer').click();assert.ok(c.toasts.some(t=>t[0].includes('Spoken audio')));
  $('#cqCoach').click();assert.ok($('.cq-settings')===null); // Context routes to the preferences view through the host.
  c.navigate('feed');
  c.failReview=true;await click('[data-cq-rate="Easy"]');assert.equal(c.reviews.length,0);assert.ok(c.toasts.some(t=>t[0].includes('Simulated save failure')));assert.ok($('.cq-study-card'));
  c.failReview=false;await click('[data-cq-rate="Easy"]');assert.equal(c.reviews.length,1);assert.equal(c.reviews[0].selectedAnswer,'B');assert.equal(c.reviews[0].card.id,'audit');
  c.navigate('command');await click('[data-cq-domain="d3"]');assert.equal($('.cq-study-card h2').textContent,'A recategorized question');
  drag($('.cq-study-card h2'),[100,100],[210,102]);assert.equal($('.cq-recall-result'),null,'A swipe cannot bypass answer selection');
  await click('[data-cq-choice="A"]');drag($('.cq-study-card h2'),[100,100],[110,230]);assert.equal($('.cq-recall-result'),null,'Vertical reading scroll must not reveal');
  drag($('[data-cq-choice="A"]'),[100,100],[210,102]);assert.equal($('.cq-recall-result'),null,'Controls must not trigger swipe actions');
  drag($('.cq-study-card h2'),[100,100],[210,102]);assert.ok($('.cq-recall-result'),'Right swipe reveals selected answer');
  drag($('.cq-study-card h2'),[210,102],[100,100]);await new Promise(r=>setTimeout(r,0));assert.equal(c.reviews.length,2);assert.equal(c.reviews[1].rating,'Good');
  assert.ok($('.cq-feed-interlude'),'A saved answer opens the playable island turn');await click('#cqNextQuestion');assert.equal(c.reviews.length,2,'Continuing from island must not save another review');assert.ok($('.cq-feed-empty'));

  // The visible filtered lesson owns narration and answer-checking, too.
  c.navigate('learn');change('#cqLessonDomain','');change('#cqLessonSearch','Postimplementation','input');
  const target=CISA_MICROLESSONS.find(l=>l.id==='d3-t08');assert.equal($('.cq-lesson-reader h2').textContent,target.title);
  const spoken=[];globalThis.SpeechSynthesisUtterance=class{constructor(text){this.text=text;}};Object.defineProperty(window,'speechSynthesis',{value:{cancel(){},speak(u){spoken.push(u.text);}},configurable:true});
  $('#cqListenLesson').click();assert.ok(spoken[0].includes(target.concept));assert.ok(!spoken[0].includes(target.checkpoint.rationale));
  const wrong=Object.keys(target.checkpoint.choices).find(k=>k!==target.checkpoint.correctAnswer);await click(`[data-cq-lesson-choice="${wrong}"]`);assert.equal($('.cq-lesson-reader h2').textContent,target.title);await click('#cqCheckLesson');assert.equal(c.completed.length,0);
  await click(`[data-cq-lesson-choice="${target.checkpoint.correctAnswer}"]`);await click('#cqCheckLesson');assert.deepEqual(c.completed,['d3-t08']);assert.ok($('.cq-recall-result').textContent.includes(target.checkpoint.rationale));
  change('#cqLessonSearch','NoSuchConcept-123456','input');assert.ok($('#cqLessonSearch'),'Empty search must preserve controls');assert.ok($('#cqClearLessonSearch'));await click('#cqClearLessonSearch');assert.equal($$('[data-cq-lesson]').length,60);
  // A new member must not inherit a private selection, revealed answer or study duration.
  change('#cqLessonSearch','Postimplementation','input');await click(`[data-cq-lesson-choice="${target.checkpoint.correctAnswer}"]`);
  const other=context('second-user',{empty:true,minutes:5});other.navigate('learn');assert.equal($('#cqLessonSearch').value,'');assert.equal($$('[data-cq-lesson]').length,60);assert.equal($('.cq-recall-result'),null);assert.equal($('[data-cq-lesson-choice].chosen'),null);
  other.navigate('command');assert.equal($('#cqMinutes').value,'5');assert.equal($('.cq-start').dataset.cqNav,'import','An empty library must lead to import instead of a zero-question study round');
  other.navigate('feed');assert.equal($('[data-cq-start="recommended"]'),null);assert.ok($('[data-cq-nav="import"]'));assert.equal($('.cq-study-card'),null);assert.ok($('#test-root').textContent.includes('import your QAE files'));
  other.navigate('adventure');assert.ok($('.island-play'));assert.equal($('[data-qw-mode]'),null,'The island has no competing personal/Guild mode selectors');
  // A delayed save from a signed-out member must not advance the next member's UI.
  const pending=context('pending-member');let resolveReview;pending.review=()=>new Promise(resolve=>{resolveReview=resolve;});pending.navigate('command');await click('[data-cq-domain="d5"]');await click('[data-cq-choice="B"]');await click('#cqReveal');
  const oldSave=$('[data-cq-rate="Good"]').onclick();const nextMember=context('new-member',{empty:true});nextMember.navigate('feed');resolveReview();await oldSave;assert.equal($('.cq-study-card'),null);assert.equal($('.cq-feed-interlude'),null);assert.ok($('#test-root').textContent.includes('Add your questions to begin.'));
  console.log('V3 experience: all views, feed save/error/interlude flow, safe swipe controls, corrected-domain queue, lesson filtering/audio/checkpoint consistency, empty recovery, and member/async state isolation passed.');
}finally{window.speechSynthesis?.cancel();dom.window.close();}
