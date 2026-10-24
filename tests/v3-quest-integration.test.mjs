import assert from 'node:assert/strict';
import {reduceGuildSession as session} from '../js/guild-session.js';
import {createWorld,advanceWorld,questProgress} from '../js/quest-world.js';

for(const bad of [null,{}, {id:'x',cardKeys:[]},{id:'',cardKeys:['one']},{id:'x',cardKeys:[null]}])assert.throws(()=>session(null,{type:'start',uid:'a',session:bad}));
assert.throws(()=>session(null,{type:'start',uid:'',session:{id:'s',cardKeys:['one']}}));
let s=session(null,{type:'start',uid:'bennett',session:{id:'guild-1',cardKeys:['one','two']}});
s=session(s,{type:'join',uid:'ty',sessionId:s.id});
const before=structuredClone(s);
s=session(s,{type:'answer',uid:'bennett',sessionId:s.id,index:0,answer:'A'});
assert.deepEqual(before.responses,{},'A submitted answer must not mutate a prior transaction snapshot.');
assert.throws(()=>session(s,{type:'reveal',uid:'bennett',sessionId:s.id,index:0,correctAnswer:'A'}));
s=session(s,{type:'answer',uid:'ty',sessionId:s.id,index:0,answer:'B'});
s=session(s,{type:'reveal',uid:'bennett',sessionId:s.id,index:0,correctAnswer:'A'});
assert.equal(s.responses.bennett.correct,true);assert.equal(s.responses.ty.correct,false);
let world=createWorld();
// Each participant's review can retry its own stable event ID without awarding
// study turns or focus twice, even if two clients both observe the reveal.
for(const uid of ['bennett','ty','bennett','ty']){
 const result=advanceWorld(world,{type:'study-answer',id:`${s.id}:${s.index}:${uid}`,correct:s.responses[uid].correct});
 world=result.world;
}
assert.equal(world.stats.study,2);assert.equal(world.stats.correct,1);assert.equal(world.stats.incorrect,1);assert.equal(world.energy,6);
const scored=session(s,{type:'reveal',uid:'ty',sessionId:s.id,index:0,correctAnswer:'A'});assert.equal(scored.scores.bennett,120);
s=session(s,{type:'join',uid:'late-player',sessionId:s.id});assert.deepEqual(s.pendingParticipants,['late-player']);assert.equal(s.participants.includes('late-player'),false);
assert.throws(()=>session(s,{type:'answer',uid:'late-player',sessionId:s.id,index:0,answer:'A'}));
s=session(s,{type:'next',uid:'ty',sessionId:s.id,index:0});assert.equal(s.index,1);assert.equal(s.participants.includes('late-player'),true);assert.deepEqual(s.pendingParticipants,[]);assert.deepEqual(s.responses,{});
assert.throws(()=>session(s,{type:'answer',uid:'bennett',sessionId:s.id,index:0,answer:'A'}));
const legacy={id:'legacy',active:true,hostUid:'bennett',index:0,cardKeys:['one'],responses:{ty:{answer:'A'}},scores:{}};
const normalized=session(legacy,{type:'join',uid:'third',sessionId:'legacy'});assert.deepEqual(normalized.participants,['bennett','ty','third']);
assert.equal(legacy.participants,undefined);
let leaving=session(null,{type:'start',uid:'host',session:{id:'leaving',cardKeys:['one','two']}});
leaving=session(leaving,{type:'answer',uid:'host',sessionId:'leaving',answer:'A'});leaving=session(leaving,{type:'reveal',uid:'host',sessionId:'leaving',correctAnswer:'A'});leaving=session(leaving,{type:'join',uid:'next',sessionId:'leaving'});leaving=session(leaving,{type:'leave',uid:'host',sessionId:'leaving'});assert.deepEqual(leaving.participants,['next']);assert.equal(leaving.index,1);assert.equal(leaving.active,true);
assert.equal(questProgress(world).complete,false);
console.log('V3 quest/Guild integration: stable per-member rewards, concurrent reveal retries, late joins, legacy participants and stale commands passed.');
