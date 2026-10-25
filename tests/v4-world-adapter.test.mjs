import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {createWorld,advanceWorld} from '../js/quest-world.js';

const source=await readFile(new URL('../js/app.js',import.meta.url),'utf8');
const adapter=source.slice(source.indexOf('let experienceWorldLock='),source.indexOf('async function saveExperienceBatch('));
const deferred=()=>{let resolve;const promise=new Promise(r=>{resolve=r;});return {promise,resolve};};
function fixture({guild=false}={}){
 const profile={uid:'user-a',activeGroupId:guild?'guild-a':null,v3:{world:createWorld(),pendingWorld:[]}};
 const state={user:{uid:'user-a'},profile,group:guild?{id:'guild-a',questWorld:createWorld()}:null};
 const hooks={beforeSave:null,beforeGuild:null,failSave:false};
 const calls={saves:[],guild:[],toasts:[]};
 let serial=0;
 const context=vm.createContext({experienceReviewLock:false,state,createWorld,advanceWorld,randomId:()=>`move-${++serial}`,Error,
  saveProfile:async p=>{calls.saves.push(p);await hooks.beforeSave?.(p);if(hooks.failSave)throw Error('save unavailable');},
  mutateGuildWorld:async(id,event)=>{calls.guild.push({id,event});await hooks.beforeGuild?.(id,event);return advanceWorld(createWorld(state.group?.id===id?state.group.questWorld:undefined),event);},
  toast:message=>calls.toasts.push(message)
 });
 const review=source.slice(source.indexOf('async function saveExperienceReview('),source.indexOf('let experienceWorldLock='));
 vm.runInContext(adapter+'\n'+review+'\nglobalThis.move=saveExperienceWorldAction;globalThis.review=saveExperienceReview;',context);
 return {state,profile,hooks,calls,move:context.move,review:context.review,context};
}
const basic=fixture();
const result=await basic.move({type:'travel',zone:'grove',id:'travel'});
assert.equal(result.changed,true);assert.equal(basic.profile.v3.world.zone,'grove');
assert.equal(basic.calls.saves.length,1);assert.strictEqual(basic.calls.saves[0],basic.profile);
const repeat=await basic.move({type:'travel',zone:'grove',id:'travel'});
assert.equal(repeat.duplicate,true);assert.equal(basic.calls.saves.length,1,'retry of a stable ID cannot spend or save a second move');
const rejected=await basic.move({type:'build',building:'greenhouse',id:'too-soon'});
assert.equal(rejected.changed,false);assert.equal(basic.calls.saves.length,1,'unaffordable action does not write a new world');
assert.ok(rejected.feedback.message.length>10,'rejected actions return usable inline feedback');

const failure=fixture(),previous=failure.profile.v3.world;failure.hooks.failSave=true;
await assert.rejects(failure.move({type:'travel',zone:'grove'}),/save unavailable/);
assert.strictEqual(failure.profile.v3.world,previous,'failed local persistence must roll back optimistic action');
failure.hooks.failSave=false;await failure.move({type:'travel',zone:'grove'});
assert.equal(failure.profile.v3.world.zone,'grove','save failure releases the click lock');

const concurrent=fixture(),hold=deferred();concurrent.hooks.beforeSave=()=>hold.promise;
const first=concurrent.move({type:'travel',zone:'grove'});
await assert.rejects(concurrent.move({type:'travel',zone:'observatory'}),/still saving/);
await assert.rejects(concurrent.review(null,{}),/island move is still saving/);
hold.resolve();await first;assert.equal(concurrent.profile.v3.world.zone,'grove');assert.equal(concurrent.calls.saves.length,1);

const shared=fixture({guild:true});await shared.move({type:'travel',zone:'grove'},'solo');assert.equal(shared.state.group.questWorld.zone,'grove','a legacy solo argument cannot bypass the one active Guild island');assert.equal(shared.profile.v3.world.zone,'harbor','personal archive is preserved');

const reviewInFlight=fixture();reviewInFlight.context.experienceReviewLock=true;
await assert.rejects(reviewInFlight.move({type:'travel',zone:'grove'}),/saving|finish/i);
assert.equal(reviewInFlight.calls.saves.length,0);reviewInFlight.context.experienceReviewLock=false;
await reviewInFlight.move({type:'travel',zone:'grove'});assert.equal(reviewInFlight.profile.v3.world.zone,'grove');

// An independent newer state must survive rollback of an older failed write.
const newer=fixture();newer.hooks.failSave=true;let newerState;
newer.hooks.beforeSave=()=>{newerState=advanceWorld(newer.profile.v3.world,{id:'newer-study-event',type:'study-answer',correct:true}).world;newer.profile.v3.world=newerState;};
await assert.rejects(newer.move({type:'travel',zone:'grove'}),/save unavailable/);
assert.strictEqual(newer.profile.v3.world,newerState);assert.equal(newer.profile.v3.world.stats.study,1,'older failed move cannot erase a newer study reward');

const switched=fixture(),nextProfile={uid:'user-b',activeGroupId:'guild-b',v3:{world:createWorld()}};
switched.hooks.beforeSave=()=>{switched.state.user={uid:'user-b'};switched.state.profile=nextProfile;};
await assert.rejects(switched.move({type:'travel',zone:'grove'}),/account or Guild changed/i);
assert.equal(nextProfile.v3.world.zone,'harbor','old account completion cannot mutate the newly signed-in account');assert.equal(switched.calls.toasts.length,0);

const changedGuild=fixture({guild:true}),otherGuild={id:'guild-b',questWorld:createWorld()};
changedGuild.hooks.beforeGuild=()=>{changedGuild.state.group=otherGuild;changedGuild.profile.activeGroupId='guild-b';};
await assert.rejects(changedGuild.move({type:'travel',zone:'grove'},'coop'),/account or Guild changed/i);
assert.equal(otherGuild.questWorld.zone,'harbor');assert.equal(changedGuild.calls.saves.length,0);

// Firestore replaces snapshots on every notification, including the move's own write.
// A refreshed object for the same Guild is not an account or Guild switch.
const refreshed=fixture({guild:true});let replacement;
refreshed.hooks.beforeGuild=()=>{replacement={id:'guild-a',questWorld:createWorld()};refreshed.state.group=replacement;};
const refreshedResult=await refreshed.move({type:'travel',zone:'grove'},'coop');
assert.equal(refreshedResult.changed,true);assert.equal(refreshed.state.group.questWorld.zone,'grove');
assert.strictEqual(refreshed.state.group,replacement,'apply to the current same-ID snapshot, not a detached captured object');

const replay=fixture({guild:true});replay.profile.v3.pendingWorld=[{id:'reward-a',type:'study-answer',correct:true,groupId:'guild-a'},{id:'reward-b',type:'study-answer',correct:true,groupId:'guild-b'}];
await replay.move({type:'travel',zone:'grove'},'coop');
assert.deepEqual(replay.calls.guild.map(c=>c.id),['guild-a','guild-a']);
assert.equal(replay.profile.v3.pendingWorld.length,1);assert.equal(replay.profile.v3.pendingWorld[0].groupId,'guild-b');
assert.equal(replay.state.group.questWorld.stats.study,1);
console.log('World adapter: save rollback, stable retry, concurrent input, account/Guild isolation, refreshed snapshots and scoped pending rewards passed.');
