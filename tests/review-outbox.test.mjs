import assert from 'node:assert/strict';
import {createReviewOutbox} from '../js/review-outbox.js';
const memory=()=>{const data=new Map();return {getItem:k=>data.get(k)||null,setItem:(k,v)=>data.set(k,v)};};
const record=id=>({id,card:{id:'card-'+id},input:{eventId:id,rating:'Again'}});
const tick=()=>new Promise(resolve=>setTimeout(resolve,0));
{
 const storage=memory(),calls=[];let release;const gate=new Promise(r=>release=r);
 const box=createReviewOutbox({storage,key:'user',save:async e=>{calls.push(e.id);if(e.id==='a')await gate;}});
 box.enqueue(record('a'));box.enqueue(record('b'));box.enqueue(record('a'));
 assert.equal(JSON.parse(storage.getItem('user')).length,2,'The answer is durable before enqueue returns');
 await tick();assert.deepEqual(calls,['a'],'Network saves are serialized');
 const copy=box.list();copy[0].input.rating='Easy';assert.equal(box.list()[0].input.rating,'Again');
 release();await box.idle();assert.deepEqual(calls,['a','b']);assert.deepEqual(box.list(),[]);
 box.enqueue(record('a'));await box.idle();assert.deepEqual(calls,['a','b'],'Repeated IDs do not resave within the instance');
}
{
 const storage=memory(),calls=[];let fail=true;
 const box=createReviewOutbox({storage,key:'u',save:async e=>{calls.push(e.id);if(fail)throw new Error('Offline');}});
 box.enqueue(record('a'));box.enqueue(record('b'));await box.idle();
 assert.deepEqual(calls,['a']);assert.equal(box.list()[0].state,'failed');assert.equal(JSON.parse(storage.getItem('u'))[0].error,'Offline');
 const resumed=createReviewOutbox({storage,key:'u',save:async e=>calls.push('reload:'+e.id)});
 await resumed.idle();assert.deepEqual(calls,['a'],'Reload keeps failures paused');
 await resumed.retry();assert.deepEqual(calls,['a','reload:a','reload:b']);assert.deepEqual(resumed.list(),[]);
}
{
 const storage=memory();storage.setItem('u',JSON.stringify([{...record('a'),state:'pending'}]));const calls=[];
 const box=createReviewOutbox({storage,key:'u',save:async e=>calls.push(e.id)});await box.idle();assert.deepEqual(calls,['a'],'Pending writes resume after reload');
}
{
 const storage={getItem:()=>null,setItem:()=>{throw new Error('Storage full');}};let calls=0;
 const box=createReviewOutbox({storage,key:'u',save:async()=>calls++});assert.throws(()=>box.enqueue(record('a')),/Storage full/);await box.idle();assert.equal(calls,0);assert.deepEqual(box.list(),[]);
}
{
 const storage=memory();let calls=0,blockRemoval=false;const real=storage.setItem;
 storage.setItem=(k,v)=>{if(blockRemoval)throw new Error('Storage unavailable');real(k,v);};
 const box=createReviewOutbox({storage,key:'u',save:async()=>{calls++;blockRemoval=true;}});
 box.enqueue(record('a'));await box.idle();assert.equal(calls,1);assert.equal(box.list()[0].state,'failed');assert.equal(JSON.parse(storage.getItem('u'))[0].state,'pending','A removal failure cannot erase a receipt');
 blockRemoval=false;await box.retry();assert.equal(calls,2,'Retry uses the same remote idempotency key');
}
{
 const storage=memory(),calls=[];const box=createReviewOutbox({storage,key:'u',save:async e=>calls.push(e.id),onChange:()=>{throw new Error('Render failed');}});
 box.pause();box.enqueue(record('a'));await tick();assert.deepEqual(calls,[]);await box.resume();assert.deepEqual(calls,['a']);
 assert.throws(()=>createReviewOutbox({storage:{getItem:()=>'{broken'},key:'u',save:async()=>{}}));
}
{
 const storage=memory();const first=createReviewOutbox({storage,key:'u',save:async()=>{}}),second=createReviewOutbox({storage,key:'u',save:async()=>{}});
 first.pause();second.pause();first.enqueue(record('a'));
 assert.throws(()=>second.enqueue(record('b')),/Another tab/);
 assert.deepEqual(JSON.parse(storage.getItem('u')).map(e=>e.id),['a'],'A stale enqueue cannot overwrite another tab');
}
{
 const storage=memory();let release;const gate=new Promise(r=>release=r);
 const first=createReviewOutbox({storage,key:'u',save:async()=>gate});first.enqueue(record('a'));await tick();
 const second=createReviewOutbox({storage,key:'u',save:async()=>{}});second.pause();second.enqueue(record('b'));
 release();await first.idle();assert.equal(first.list()[0].state,'failed');assert.match(first.list()[0].error,/Another tab/);
 assert.deepEqual(JSON.parse(storage.getItem('u')).map(e=>e.id),['a','b'],'A stale success removal and failure marker cannot erase newer entries');
 assert.throws(()=>first.retry(),/Another tab/);
}
{
 const storage=memory(),calls=[];let box,added=false;
 box=createReviewOutbox({storage,key:'u',save:async e=>calls.push(e.id),onChange:entries=>{
   if(!entries.length&&!added){added=true;queueMicrotask(()=>box.enqueue(record('b')));}
 }});
 box.enqueue(record('a'));await box.idle();assert.deepEqual(calls,['a','b'],'Enqueue in drain/finally gap restarts draining');
}
console.log('Review outbox: durable enqueue, slow serialized saves, duplicate IDs, retry/reload, storage failures, stale-tab protection and drain restart passed.');
