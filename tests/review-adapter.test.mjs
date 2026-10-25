import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
import { defaultProgress,rateCard,progressKey,createReviewEvent,DEFAULT_REVIEW_SETTINGS } from '../js/flashcard-engine.js';
import { uniqueStudyCards,studyIdentity } from '../js/study-intelligence.js';
import { createWorld,advanceWorld } from '../js/quest-world.js';
import { randomId,sha256Hex } from '../js/runtime-crypto.js';
import { appendActivityEvent } from '../js/activity-bridge.js';

const source=await readFile(new URL('../js/app.js',import.meta.url),'utf8');
const rewardSource=source.slice(source.indexOf('async function rewardExperience('),source.indexOf('async function saveExperienceWorldAction('));
const legacySource=source.slice(source.indexOf('async function applyCardRating('),source.indexOf('function renderStudySessionComplete('));
function fixture({profile,library,store}={}){
  const first={id:'one',scope:'Personal',scopeKey:'personal_u',question:'Which method is best?',choices:{A:'Risk based',B:'Convenient'},correctAnswer:'A',domainNumber:1,ownerUid:'u',deckIds:['lesson']};
  const alias={...first,id:'shared',scope:'Public',scopeKey:'public',choices:{A:'Convenient',B:'Risk based'},correctAnswer:'B'};
  const state={user:{uid:'u'},group:null,profile:profile||{uid:'u',activeGroupId:null,preferences:{studySettings:DEFAULT_REVIEW_SETTINGS},stats:{xp:0,coins:0},studyHistory:{reviews:0,correct:0,incorrect:0},v3:{activity:[]}},library:library||{cards:[first,alias],decks:[],progress:{},reviews:[]}};
  const data=store||{progress:{},reviews:{},profile:null,profileCalls:0,progressCalls:0};
  const hooks={failProfileAt:0,failProgressAt:0,onProfile:null,onProgress:null,onGuild:null};
  const guildCalls=[];
  const context=vm.createContext({state,crypto:globalThis.crypto,TextEncoder,Date,Uint8Array,Object,Math,Number,String,Error,
    defaultProgress,rateCard,progressKey,createReviewEvent,DEFAULT_REVIEW_SETTINGS,uniqueStudyCards,studyIdentity,createWorld,advanceWorld,appendActivityEvent,randomId,sha256Hex,
    currentStudyCard:()=>state.library.cards[0],reviewGapForRating:()=>0,friendly:e=>e.message,renderApp(){},persistActiveStudySession(){state.profile.activeStudySession={...state.studySession};},saveProfileDebounced:async()=>{data.profile=structuredClone(state.profile);},window:{dispatchEvent(){}},CustomEvent:class{constructor(type,options){this.type=type;this.detail=options.detail;}},toast(){},
    saveProfile:async p=>{data.profileCalls++;await hooks.onProfile?.(p,data.profileCalls);if(data.profileCalls===hooks.failProfileAt)throw new Error('profile unavailable');data.profile=structuredClone(p);},
    updateMemberSummary:async()=>{},
    saveStudyProgress:async(uid,p)=>{data.progressCalls++;await hooks.onProgress?.(uid,p,data.progressCalls);if(data.progressCalls===hooks.failProgressAt)throw new Error('progress unavailable');assert.equal(uid,'u');data.progress[p.id]=structuredClone(p);},
    saveStudyReview:async(uid,e)=>{assert.equal(uid,'u');data.reviews[e.id]=structuredClone(e);},
    mutateGuildWorld:async(id,event)=>{guildCalls.push({id,event});await hooks.onGuild?.(id,event);return advanceWorld(createWorld(state.group?.questWorld),event);},
    award:({xp,coins})=>{state.profile.stats.xp+=xp;state.profile.stats.coins+=coins;}
  });
  vm.runInContext(rewardSource+'\n'+legacySource+'\nglobalThis.review=saveExperienceReview;globalThis.legacy=applyCardRating;',context);
  return {state,data,hooks,guildCalls,review:context.review,legacy:context.legacy,first,alias};
}
const args={rating:'Easy',selectedAnswer:'B',eventId:'run:1:0'};
const f=fixture();await f.review(f.first,args);
assert.equal(f.state.library.progress[progressKey(f.first)].lastRating,'Again','incorrect answers cannot be rated Easy');
assert.equal(f.state.library.progress[progressKey(f.first)].incorrectCount,1);
assert.equal(f.state.library.progress[progressKey(f.alias)].cardId,'shared');
assert.equal(f.state.library.progress[progressKey(f.alias)].uid,'u');
assert.equal(f.state.profile.stats.xp,2);assert.equal(f.state.profile.studyHistory.reviews,1);
const storedEvent=Object.values(f.data.reviews)[0];
assert.equal(storedEvent.correct,false);assert.equal(storedEvent.reviewedAt,f.state.library.progress[progressKey(f.first)].lastReviewedAt);
assert.ok(/^review_[a-f0-9]{64}$/.test(storedEvent.id));
await f.review(f.first,args);
assert.equal(f.state.profile.studyHistory.reviews,1);assert.equal(f.state.profile.stats.xp,2);assert.equal(Object.keys(f.data.reviews).length,1);
await assert.rejects(f.review({...f.first,question:'A different question'},args),/different question/);
await assert.rejects(f.review(f.first,{...args,eventId:''}),/valid review event/);
await assert.rejects(f.review(f.first,{...args,eventId:'no-choice',selectedAnswer:'Z'}),/available answer/);

const reorder=fixture();await reorder.review(reorder.alias,{rating:'Good',selectedAnswer:'B',eventId:'reordered:0'});
assert.equal(reorder.state.library.progress[progressKey(reorder.first)].correctCount,1);
assert.equal(reorder.state.library.progress[progressKey(reorder.alias)].correctCount,1);
assert.equal(reorder.state.profile.studyHistory.correct,1,'letters are checked against the card actually displayed');
const foreign=fixture();foreign.state.library.progress[progressKey(foreign.first)]={...defaultProgress(foreign.first,'another'),repetitions:90,correctCount:90,state:'review'};
await foreign.review(foreign.first,{rating:'Good',selectedAnswer:'A',eventId:'owner:0'});
assert.equal(foreign.state.library.progress[progressKey(foreign.first)].repetitions,1,'another owner\'s progress is not inherited');

const failing=fixture();failing.hooks.failProfileAt=2;
await assert.rejects(failing.review(failing.first,{rating:'Good',selectedAnswer:'A',eventId:'retry:0'}),/profile unavailable/);
assert.equal(failing.state.profile.studyHistory.reviews,1);
await failing.review(failing.first,{rating:'Good',selectedAnswer:'A',eventId:'retry:0'});
assert.equal(failing.state.profile.studyHistory.reviews,1);assert.equal(failing.state.profile.stats.xp,4);
assert.equal(failing.data.profile.v3.reviewReceipts['retry:0'].complete,true,'retry persists the final receipt after a profile error');

const initialFailure=fixture();initialFailure.hooks.failProfileAt=1;
await assert.rejects(initialFailure.review(initialFailure.first,{rating:'Good',selectedAnswer:'A',eventId:'intent:0'}),/profile unavailable/);
assert.equal(initialFailure.data.progressCalls,0,'do not write progress before persisting a retryable intent');
await initialFailure.review(initialFailure.first,{rating:'Good',selectedAnswer:'A',eventId:'intent:0'});
assert.equal(initialFailure.state.profile.studyHistory.reviews,1);

const partial=fixture();partial.hooks.failProgressAt=2;
await assert.rejects(partial.review(partial.first,{rating:'Good',selectedAnswer:'A',eventId:'reload:0'}),/progress unavailable/);
assert.ok(partial.data.profile.v3.reviewReceipts['reload:0'].updates.length,'exact pending updates are saved before writing progress');
const reloaded=fixture({profile:structuredClone(partial.data.profile),library:{cards:[partial.first,partial.alias],decks:[],progress:structuredClone(partial.data.progress),reviews:Object.values(partial.data.reviews)},store:partial.data});
await reloaded.review(reloaded.first,{rating:'Good',selectedAnswer:'A',eventId:'reload:0'});
assert.equal(reloaded.state.library.progress[progressKey(reloaded.first)].repetitions,1,'partial-write reload must replay instead of incrementing twice');
assert.equal(reloaded.state.library.progress[progressKey(reloaded.alias)].repetitions,1);
assert.equal(reloaded.state.profile.studyHistory.reviews,1);assert.equal(Object.keys(reloaded.data.reviews).length,1);
assert.equal(reloaded.state.profile.v3.world.stats.study,1);

const bounded=fixture();bounded.state.profile.v3.reviewReceipts={};
for(let i=0;i<1100;i++)bounded.state.profile.v3.reviewReceipts[`old:${i}`]=i%2?{complete:true,savedAt:new Date(Date.UTC(2025,0,1,0,i)).toISOString(),cardIdentity:'older'}:new Date(Date.UTC(2025,0,1,0,i)).toISOString();
bounded.state.profile.v3.reviewReceipts['pending:older']={event:{id:'still-writing'},updates:[],reviewSaved:false};
bounded.state.profile.v3.reviewReceipts['pending:reward']={event:{id:'reward-waiting'},updates:[],reviewSaved:true,historyRecorded:false};
await bounded.review(bounded.first,{rating:'Good',selectedAnswer:'A',eventId:'current:bounded'});
const retained=bounded.state.profile.v3.reviewReceipts;
assert.equal(Object.values(retained).filter(value=>typeof value==='string'||value?.complete).length,500,'completed retry receipts stay bounded');
assert.ok(retained['pending:older']);assert.ok(retained['pending:reward']);assert.equal(retained['current:bounded'].complete,true);
const xpBeforeRetry=bounded.state.profile.stats.xp;
await bounded.review(bounded.first,{rating:'Good',selectedAnswer:'A',eventId:'current:bounded'});
assert.equal(bounded.state.profile.stats.xp,xpBeforeRetry,'the most recent completed review retains retry protection');
assert.equal(Object.keys(bounded.data.profile.v3.reviewReceipts).length,502);

const switching=fixture();const newProfile={uid:'other',stats:{xp:0,coins:0},v3:{activity:[]}};
switching.hooks.onProfile=async()=>{switching.state.user={uid:'other'};switching.state.profile=newProfile;switching.state.library={cards:[],progress:{},reviews:[]};};
await assert.rejects(switching.review(switching.first,{rating:'Good',selectedAnswer:'A',eventId:'switch:0'}),/Account changed/);
assert.equal(newProfile.stats.xp,0);assert.equal(newProfile.v3.activity.length,0);assert.equal(switching.data.progressCalls,0);

const midWrite=fixture();const nextProfile={uid:'new',stats:{xp:0,coins:0},v3:{activity:[]}};
midWrite.hooks.onProgress=async()=>{midWrite.state.user={uid:'new'};midWrite.state.profile=nextProfile;midWrite.state.library={cards:[],progress:{},reviews:[]};};
await assert.rejects(midWrite.review(midWrite.first,{rating:'Good',selectedAnswer:'A',eventId:'mid-write:0'}),/Account changed/);
assert.equal(nextProfile.stats.xp,0);assert.deepEqual(midWrite.state.library.progress,{});

const concurrent=fixture();let release;const hold=new Promise(resolve=>release=resolve);
concurrent.hooks.onProfile=async()=>hold;
const pending=concurrent.review(concurrent.first,{rating:'Good',selectedAnswer:'A',eventId:'same:0'});
await assert.rejects(concurrent.review(concurrent.first,{rating:'Good',selectedAnswer:'A',eventId:'same:0'}),/still saving/);
release();await pending;assert.equal(concurrent.state.profile.studyHistory.reviews,1);
const legacy=fixture();legacy.state.studySession={id:'legacy-session',queue:['personal_u|one'],index:0,selectedAnswer:'A',answerSubmitted:true,ratings:{},correct:0,incorrect:0,mode:'review'};
let releaseLegacy;const holdLegacy=new Promise(resolve=>releaseLegacy=resolve);legacy.hooks.onProfile=async()=>holdLegacy;
const firstClick=legacy.legacy('Good');await legacy.legacy('Good');releaseLegacy();await firstClick;
assert.equal(legacy.state.profile.studyHistory.reviews,1);assert.equal(legacy.state.studySession.index,1,'a double click advances the legacy queue once');
assert.equal(legacy.state.profile.activeStudySession.ratingBusy,undefined,'transient locks must not survive a session restore');
console.log('Review adapters: wrong-answer grading, reordered aliases, personal isolation, deterministic IDs, partial-write reload/retry and account-switch guards passed.');

// All review entry points use the one active island, including legacy arcade calls.
const sharedReview=fixture();sharedReview.state.group={id:'crew-a',questWorld:createWorld()};sharedReview.state.profile.activeGroupId='crew-a';
await sharedReview.review(sharedReview.first,{rating:'Good',selectedAnswer:'A',eventId:'guild-default',mode:'arcade',worldMode:'solo'});
assert.equal(sharedReview.guildCalls.length,1);assert.equal(sharedReview.guildCalls[0].id,'crew-a');assert.equal(sharedReview.state.group.questWorld.stats.study,1);
assert.equal(sharedReview.state.profile.v3.world,undefined,'Guild review does not also mint personal island resources');
await sharedReview.review(sharedReview.first,{rating:'Good',selectedAnswer:'A',eventId:'guild-default'});assert.equal(sharedReview.guildCalls.length,1,'repeat review cannot double the shared economy');
const pendingGuild=fixture();pendingGuild.state.group={id:'original',questWorld:createWorld()};pendingGuild.state.profile.activeGroupId='original';pendingGuild.hooks.failProgressAt=2;
await assert.rejects(pendingGuild.review(pendingGuild.first,{rating:'Good',selectedAnswer:'A',eventId:'keep-destination'}),/progress unavailable/);
pendingGuild.state.group={id:'other',questWorld:createWorld()};pendingGuild.state.profile.activeGroupId='other';
await assert.rejects(pendingGuild.review(pendingGuild.first,{rating:'Good',selectedAnswer:'A',eventId:'keep-destination'}),/original Guild|pending review/);assert.equal(pendingGuild.guildCalls.length,0,'retry in another Guild cannot retarget the reward');
console.log('One-island review routing: arcade defaults, preserved personal archive, exactly-once Guild rewards and pending destination isolation passed.');
