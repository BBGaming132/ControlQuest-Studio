import assert from 'node:assert/strict';
import {createWorld,advanceWorld} from '../js/quest-world.js';
import {saveGroup,loadGroup,mutateGuildWorld} from '../js/firebase-service.js';
const balances=world=>assert.deepEqual(world.campaign.stores,{timber:world.resources.wood,crystal:world.resources.crystal,coins:world.resources.coins},'campaign and colony use the same resource balance');
let world=createWorld();balances(world);
for(let n=0;n<24;n++){const previous=structuredClone(world),result=advanceWorld(world,{type:'study-answer',id:`recall:${n}`,correct:n%5!==0});world=result.world;balances(world);assert.deepEqual(previous.stats.study,n);assert.equal(world.campaign.stats.answers,n+1);const retry=advanceWorld(world,{type:'study-answer',id:`recall:${n}`,correct:true});assert.equal(retry.duplicate,true);assert.deepEqual(retry.world,world,'retry cannot mint campaign and colony rewards twice');}
const manual=advanceWorld(world,{type:'gather',resource:'wood',sceneZone:'grove',id:'gather:once'});if(manual.changed)balances(manual.world);
const store=new Map();globalThis.localStorage={getItem:key=>store.get(key)||null,setItem:(key,value)=>store.set(key,value)};
await saveGroup({id:'shared-campaign',members:{one:{uid:'one'},two:{uid:'two'}}});
await Promise.all(['one','two','one','two'].map(uid=>mutateGuildWorld('shared-campaign',{type:'study-answer',id:`group-turn:${uid}`,correct:true})));
const shared=(await loadGroup('shared-campaign')).questWorld;
assert.equal(shared.stats.study,2);assert.equal(shared.campaign.stats.answers,2);assert.equal(shared.campaign.stats.gathered,1);assert.equal(shared.resources.wood,3);assert.equal(shared.resources.crystal,1);assert.equal(shared.resources.coins,4);balances(shared);
console.log('Campaign/world integration: one balance, correct/missed study turns, persistent route progress, concurrent Guild turns and repeat-safe rewards passed.');
