import assert from 'node:assert/strict';
import { createBatchPlan, runBatchImport, createBatchCheckpoint, batchOperationId, batchQuestionIdentity, readBatchFile, inspectDocxArchive } from '../js/batch-importer.js';

function docxFixture({path='word/document.xml',declaredSize=null}={}){
  const parts=[],central=[];let offset=0;
  for(const name of ['[Content_Types].xml',path]){
    const entryName=Buffer.from(name),data=Buffer.from('<xml/>');
    const local=Buffer.alloc(30);local.writeUInt32LE(0x04034b50);local.writeUInt16LE(20,4);local.writeUInt32LE(data.length,18);local.writeUInt32LE(data.length,22);local.writeUInt16LE(entryName.length,26);
    parts.push(local,entryName,data);const head=Buffer.alloc(46);head.writeUInt32LE(0x02014b50);head.writeUInt16LE(20,4);head.writeUInt16LE(20,6);head.writeUInt32LE(data.length,20);head.writeUInt32LE(declaredSize??data.length,24);head.writeUInt16LE(entryName.length,28);head.writeUInt32LE(offset,42);central.push(head,entryName);offset+=local.length+entryName.length+data.length;
  }
  const directory=Buffer.concat(central),end=Buffer.alloc(22);end.writeUInt32LE(0x06054b50);end.writeUInt16LE(2,8);end.writeUInt16LE(2,10);end.writeUInt32LE(directory.length,12);end.writeUInt32LE(offset,16);const result=Buffer.concat([...parts,directory,end]);return result.buffer.slice(result.byteOffset,result.byteOffset+result.byteLength);
}

const sample=({number=1,total=1,question='Which approach is BEST?',reordered=false,correct='risk',domain=1,knowledge='Audit Project Management',missed=true}={})=>`Question ${number} of ${total}
Question
${question}
A. ${reordered?'Convenience':'Risk based'}
B. ${reordered?'Risk based':'Convenience'}
${correct==='risk'?(reordered?'B':'A'):(reordered?'A':'B')} is the correct answer.
Justification
A. ${reordered?'Convenience is not the priority.':'Prioritize risk.'}
B. ${reordered?'Prioritize risk.':'Convenience is not the priority.'}
Domain${domain} Example domain
Knowledge Statement1B1${knowledge}
Your result is ${missed?'incorrect':'correct'}.
Your answer is ${missed?(reordered?'A':'B'):(reordered?'B':'A')}.
Correct answer is ${correct==='risk'?(reordered?'B':'A'):(reordered?'A':'B')}.
`;
const file=(name,text)=>({name,size:new TextEncoder().encode(text).length,text:async()=>text});
const memoryStorage=()=>{const map=new Map();return {getItem:k=>map.get(k)||null,setItem:(k,v)=>map.set(k,v),removeItem:k=>map.delete(k)};};
const readFile=async f=>f.text();
const context={uid:'bennett',groupId:'study-guild',scope:'Guild',readFile};
const storage=memoryStorage();
const checkpoint=createBatchCheckpoint({...context,storage});

// A plan has no database side effects, matches lesson names, and preserves the filename deck title.
const plan=await createBatchPlan([file('Domain 1 - Audit Project Management.docx',sample()),file('Second copy.txt',sample())],context);
assert.equal(plan.items[0].title,'Domain 1 - Audit Project Management');
assert.equal(plan.items[0].lessonId,'d1-t05');
assert.equal(plan.items[0].status,'ready');
assert.equal(plan.items[1].include,false);
assert.equal(plan.items[1].status,'duplicate');
assert.equal(plan.summary.uniqueQuestions,1);
let saves=0;
let result=await runBatchImport(plan,{...context,checkpoint,importItem:async(item,{bundle,operationId})=>{saves++;assert.equal(bundle.cards.length,1);assert.ok(operationId);return {saved:true};}});
assert.equal(result.summary.completed,1);
assert.equal(saves,1);
await runBatchImport(plan,{...context,checkpoint,importItem:async()=>{saves++;}});
assert.equal(saves,1,'Successful rows must not run again');
const fresh=await createBatchPlan([file('Domain 1 - Audit Project Management.docx',sample())],context);
await runBatchImport(fresh,{...context,checkpoint:createBatchCheckpoint({...context,storage}),importItem:async()=>{saves++;}});
assert.equal(saves,1,'Success checkpoints survive rebuilding a preview');

// Changing destination/category/title/sharing is a deliberate new operation, not a resume skip.
const originalId=await batchOperationId(fresh.items[0],context);
for(const change of [{scope:'Personal'},{lessonId:'d1-t06'},{title:'New title'},{sharePublic:false}])assert.notEqual(await batchOperationId({...fresh.items[0],...change},context),originalId);
await assert.rejects(runBatchImport(fresh,{...context,uid:'other',checkpoint,importItem:async()=>{}}),/another signed-in user/);
await assert.rejects(runBatchImport(fresh,{...context,groupId:'another-guild',checkpoint,importItem:async()=>{}}),/Guild changed/);
await assert.rejects(runBatchImport(fresh,{...context,checkpoint:createBatchCheckpoint({uid:'other',storage}),importItem:async()=>{}}),/another user or Guild/);

// Logical deduplication survives reordered options and maps selected/correct letters back accurately.
const reordered=await createBatchPlan([file('A.txt',sample()),file('B.txt',sample({reordered:true}))],context);
assert.equal(reordered.items[0].questions[0].fingerprint,reordered.items[1].questions[0].fingerprint);
assert.equal(reordered.items[1].questions[0].correctAnswer,'A');
assert.equal(reordered.items[1].questions[0].userAnswer,'B');
assert.equal(reordered.items[1].questions[0].justifications.A,'Prioritize risk.');
const oneAtATime=await createBatchPlan([file('Only.txt',sample({reordered:true}))],context);
assert.equal(oneAtATime.items[0].questions[0].fingerprint,reordered.items[0].questions[0].fingerprint);
const legacy={...reordered.items[0].questions[0],id:'card_legacy',fingerprint:'legacy'};
const legacyPlan=await createBatchPlan([file('Legacy.txt',sample({reordered:true}))],{...context,existingCards:[legacy]});
assert.equal(legacyPlan.items[0].questions[0].fingerprint,'legacy');
assert.equal(legacyPlan.items[0].questions[0].correctAnswer,'A');
const scoped=await createBatchPlan([file('Scoped.txt',sample())],{...context,existingCards:[{...legacy,scopeKey:'personal_bennett',fingerprint:'personal-id'},{...legacy,scopeKey:'guild_study-guild',fingerprint:'guild-id'}]});
assert.equal(scoped.items[0].questions[0].fingerprint,'guild-id');
assert.equal(batchQuestionIdentity(legacyPlan.items[0].questions[0]),batchQuestionIdentity(legacy));

// A conflicting answer must be retained, flagged and explicitly confirmed, never silently collapsed.
const conflicting=await createBatchPlan([file('Answers.txt',sample()+sample({number:2,correct:'convenience'}))],context);
assert.equal(conflicting.items[0].questions.length,2);
assert.equal(conflicting.items[0].requiresReview,true);
let blockedSaves=0;
await runBatchImport(conflicting,{...context,checkpoint:createBatchCheckpoint({...context,storage:memoryStorage()}),importItem:async()=>{blockedSaves++;}});
assert.equal(blockedSaves,0);assert.equal(conflicting.items[0].status,'blocked');
conflicting.items[0].confirmed=true;
await runBatchImport(conflicting,{...context,checkpoint:createBatchCheckpoint({...context,storage:memoryStorage()}),importItem:async()=>{blockedSaves++;}});
assert.equal(blockedSaves,1);

// Per-file failures do not prevent later files; retries run failed rows but skip saved ones.
const recover=await createBatchPlan([file('First.txt',sample()),file('Second.txt',sample({question:'Another approach?'}))],context);
let attempts=[];let fail=true;const recoverCheckpoint=createBatchCheckpoint({...context,storage:memoryStorage()});
const save=async item=>{attempts.push(item.id);if(item.id==='file_0'&&fail)throw new Error('Temporary offline failure');};
result=await runBatchImport(recover,{...context,checkpoint:recoverCheckpoint,importItem:save});
assert.equal(result.summary.failed,1);assert.equal(result.summary.completed,1);
fail=false;await runBatchImport(recover,{...context,checkpoint:recoverCheckpoint,importItem:save});
assert.deepEqual(attempts,['file_0','file_1','file_0']);

// Cancel between files: in-flight success is checkpointed, later rows remain resumable.
const cancel=await createBatchPlan([file('First.txt',sample()),file('Second.txt',sample({question:'Another?'}))],context);
const controller=new AbortController();const cancelCheckpoint=createBatchCheckpoint({...context,storage:memoryStorage()});
let completed=0;
result=await runBatchImport(cancel,{...context,checkpoint:cancelCheckpoint,signal:controller.signal,importItem:async()=>{completed++;controller.abort();}});
assert.equal(result.cancelled,true);assert.equal(completed,1);assert.equal(cancel.items[1].status,'cancelled');
await runBatchImport(cancel,{...context,checkpoint:cancelCheckpoint,importItem:async()=>{completed++;}});
assert.equal(completed,2);

// Unknown public destinations are blocked even when warnings are acknowledged.
const unknown=await createBatchPlan([file('Unclear.txt',sample({knowledge:'Unrecognized thing',domain:2}))],context);
unknown.items[0].confirmed=true;let unknownSaves=0;
await runBatchImport(unknown,{...context,checkpoint:createBatchCheckpoint({...context,storage:memoryStorage()}),importItem:async()=>{unknownSaves++;}});
assert.equal(unknownSaves,0);
unknown.items[0].sharePublic=false;
await runBatchImport(unknown,{...context,checkpoint:createBatchCheckpoint({...context,storage:memoryStorage()}),importItem:async()=>{unknownSaves++;}});
assert.equal(unknownSaves,1);
unknown.items[0].scope='Guild';unknown.items[0].lessonId='d1-t05';
await runBatchImport(unknown,{...context,checkpoint:createBatchCheckpoint({...context,storage:memoryStorage()}),importItem:async()=>{unknownSaves++;}});
assert.equal(unknownSaves,1,'A domain conflict cannot be overridden by blanket confirmation');

// Limits and invalid exports fail safely; Word reading uses the provided Word helper.
await assert.rejects(createBatchPlan([],context),/at least one/);
await assert.rejects(createBatchPlan([file('A.txt',sample()),file('B.txt',sample())],{...context,limits:{maxFiles:1}}),/at most/);
await assert.rejects(createBatchPlan([file('A.txt',sample())],{...context,limits:{maxTotalBytes:1}}),/total file-size/);
const invalid=await createBatchPlan([file('Bad.exe',sample()),file('Broken.txt','not a QAE export')],context);
assert.deepEqual(invalid.items.map(i=>i.status),['failed','failed']);
const hugeText=await createBatchPlan([file('Large.txt','hello')],{...context,limits:{maxTextChars:2}});assert.equal(hugeText.items[0].status,'failed');
assert.equal(await readBatchFile({name:'example.docx',arrayBuffer:async()=>docxFixture()},{mammoth:{extractRawText:async()=>({value:'Word text'})}}),'Word text');
assert.equal(inspectDocxArchive(docxFixture()).entries,2);
assert.throws(()=>inspectDocxArchive(docxFixture({path:'../word/document.xml'})),/unsafe/);
assert.throws(()=>inspectDocxArchive(docxFixture({declaredSize:40*1024*1024})),/safe import limit/);
assert.throws(()=>inspectDocxArchive(new ArrayBuffer(3)),/not a valid Word/);
assert.throws(()=>inspectDocxArchive(docxFixture({path:'word/vbaProject.bin'})),/Macro-enabled/);
await assert.rejects(readBatchFile({name:'example.docx',arrayBuffer:async()=>new ArrayBuffer(1)},{mammoth:null}),/Word reader/);
const unavailable=createBatchCheckpoint({...context,storage:{getItem:()=>null,setItem:()=>{throw new Error('Quota');}}});
unavailable.markSuccess('operation');assert.equal(unavailable.persistent,false);assert.equal(unavailable.has('operation'),true);
console.log('Batch import: preview, filename matching, legacy/reordered dedup, warnings, limits, user isolation, retry, resume and cancellation passed.');
