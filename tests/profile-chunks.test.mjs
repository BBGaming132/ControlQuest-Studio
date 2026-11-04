import assert from 'node:assert/strict';
import {packProfile,unpackProfile} from '../js/profile-chunks.js';
const profile={uid:'test',v3:{reviewReceipts:{pending:{event:{id:'retain'},updates:[]}},history:'😀資料'.repeat(150000)},stats:{xp:20},questionBank:['x'.repeat(80000)]};
const {root,chunks}=await packProfile(profile);
assert.ok(JSON.stringify(root).length<24000);assert.equal(root.v3,null);assert.equal(root._profileChunks.version,1);assert.ok(chunks.every(c=>new TextEncoder().encode(JSON.stringify(c)).length<300000));
const map=new Map(chunks.map(c=>[c.id,c]));assert.deepEqual(await unpackProfile(root,id=>map.get(id)),profile);
assert.deepEqual(await packProfile(profile),{root,chunks},'Retries use identical chunk IDs');
await assert.rejects(unpackProfile(root,()=>null),/could not be loaded/);
assert.deepEqual(await unpackProfile({uid:'legacy'},()=>{throw Error();}),{uid:'legacy'});
assert.equal(profile.v3.reviewReceipts.pending.event.id,'retain');
console.log('Oversized profile roundtrip, Unicode, stable retry IDs, missing-chunk protection and legacy reads pass.');

const revised=await packProfile({...profile,v3:{...profile.v3,reviewReceipts:{pending:{event:{id:'next'}}}}});
assert.ok(revised.chunks.filter(c=>!map.has(c.id)).length<=1,'Small session changes reuse leading immutable history chunks');
const legacyData=JSON.stringify(profile.v3),legacyRoot={uid:'legacy',v3:null,_profileChunks:{version:1,fields:{v3:['old']}}};
assert.deepEqual((await unpackProfile(legacyRoot,()=>({recordType:'profile-chunk',data:legacyData}))).v3,profile.v3,'Existing version-one chunks are readable');
await assert.rejects(unpackProfile({_profileChunks:{version:1,fields:{constructor:['bad']}}},()=>null),/Invalid profile field/);
