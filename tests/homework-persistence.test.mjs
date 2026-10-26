import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {profileStorageSnapshot,saveProfile,loadProfile,saveStudyReview,saveStudyAuditEvent,loadStudyLibrary,saveHomeworkRecord,saveStudyProgress,saveStudyImport} from '../js/firebase-service.js';
import {answerHomeworkQuiz,finalizeHomeworkQuiz} from '../js/homework-plan.js';
const store=new Map();globalThis.localStorage={getItem:key=>store.get(key)||null,setItem:(key,value)=>store.set(key,value),removeItem:key=>store.delete(key)};
const base={version:1,id:'quiz-one',uid:'a',weekId:'week-01',resetAt:null,startedAt:'2026-10-31T13:00:00.000Z',deadlineAt:'2026-10-31T13:08:00.000Z',dueAt:'2026-11-02T04:59:59.999Z',durationSeconds:480,status:'active',answers:{},questions:Array.from({length:5},(_,i)=>({id:`question-${i+1}`,cardId:`card-${i}`,scopeKey:'guild_g',lessonId:`d1-t0${i+1}`,question:'Question '+i,choices:{A:'Right',B:'Wrong'},correctAnswer:'A',justifications:{A:'A reason'}}))};
const hugeQuiz={...base,questions:Array.from({length:150},(_,i)=>({...base.questions[0],id:`q${i}`,question:'x'.repeat(5000)})),result:{correct:120,total:150,accuracy:80,items:Array.from({length:150},()=>({questionId:'x'.repeat(5000)}))}};
const huge={uid:'a',v3:{homework:{enrolledAt:base.startedAt,quizzes:Object.fromEntries(Array.from({length:12},(_,i)=>[`week-${i}`,hugeQuiz])),completions:Object.fromEntries(Array.from({length:60},(_,i)=>[`lesson-${i}`,{completedAt:base.startedAt,cardIdentities:Array(1000).fill('x'.repeat(100))}]))}}};
const original=structuredClone(huge),compact=profileStorageSnapshot(huge);assert.deepEqual(huge,original,'snapshot must never mutate hydrated session');assert.ok(JSON.stringify(compact).length<30000,'full-year question/evidence snapshots stay outside profile');assert.equal(compact.v3.homework.quizzes['week-0'].status,'active');assert.equal(compact.v3.homework.quizzes['week-0'].questions,undefined);assert.equal(compact.v3.homework.quizzes['week-0'].result.items,undefined);await saveProfile(huge);assert.deepEqual(await loadProfile('a'),compact);
const legacyCard={id:'legacy-qae',scope:'Personal',scopeKey:'personal_a',source:'ISACA QAE Paste',deckIds:['qae']};
await saveStudyImport({uid:'a',cards:[legacyCard]});await saveStudyImport({uid:'a',cards:[{...legacyCard,source:'Udemy supplemental',sources:['Udemy supplemental'],deckIds:['udemy']}]});const mergedCard=(await loadStudyLibrary('a')).cards[0];assert.equal(mergedCard.source,'ISACA QAE Paste');assert.deepEqual(mergedCard.sources,['ISACA QAE Paste','Udemy supplemental']);assert.deepEqual(mergedCard.deckIds,['qae','udemy']);
// Full log history survives beyond the former capped in-profile feed, while
// retries remain one record and another account never sees these events.
for(let i=0;i<1005;i++)await saveStudyReview('a',{id:`review-${i}`,reviewedAt:new Date(1700000000000+i*1000).toISOString(),correct:i%2===0});
await saveStudyReview('a',{id:'review-1004',reviewedAt:'2026-10-25T12:00:00Z',correct:true});assert.equal((await loadStudyLibrary('a')).reviews.length,1005);assert.equal((await loadStudyLibrary('b')).reviews.length,0);
await assert.rejects(saveStudyReview('a',{id:'foreign',uid:'b'}),/own account/);
await saveStudyAuditEvent('a',{id:'same-activity',type:'session-start',description:'A session'});await saveStudyAuditEvent('b',{id:'same-activity',type:'session-start',description:'B session'});await saveStudyAuditEvent('a',{id:'same-activity',type:'session-start',description:'A session'});
assert.equal((await loadStudyLibrary('a')).activityRecords.length,1);assert.equal((await loadStudyLibrary('b')).activityRecords[0].description,'B session');
let quiz=await saveHomeworkRecord('a','quiz','week-01',base);assert.equal(quiz._revision,1);assert.equal(base._revision,undefined,'service does not mutate input');assert.deepEqual(await saveHomeworkRecord('a','quiz','week-01',base),quiz,'lost-response retry is idempotent');
const left=answerHomeworkQuiz(quiz,'question-1','A',{now:'2026-10-31T13:01:00Z'}),right=answerHomeworkQuiz(quiz,'question-2','B',{now:'2026-10-31T13:01:02Z'});
const writes=await Promise.allSettled([saveHomeworkRecord('a','quiz','week-01',left),saveHomeworkRecord('a','quiz','week-01',right)]);assert.equal(writes.filter(r=>r.status==='fulfilled').length,1);assert.match(writes.find(r=>r.status==='rejected').reason.message,/another device/);
quiz=(await loadStudyLibrary('a')).homeworkQuizzes['week-01'];assert.equal(quiz._revision,2);assert.deepEqual(quiz.answers,left.answers);
await assert.rejects(saveHomeworkRecord('a','quiz','week-01',{...quiz,deadlineAt:'2026-10-31T15:00:00Z'}),/extra time/);
await assert.rejects(saveHomeworkRecord('a','quiz','week-01',{...quiz,questions:[{...quiz.questions[0],correctAnswer:'B'}]}),/replaced/);
await assert.rejects(saveHomeworkRecord('b','quiz','week-01',quiz),/another account/);
quiz=await saveHomeworkRecord('a','quiz','week-01',finalizeHomeworkQuiz(quiz,{now:'2026-10-31T13:02:00Z'}));assert.equal(quiz.status,'submitted');
await assert.rejects(saveHomeworkRecord('a','quiz','week-01',{...quiz,status:'active'}),/submitted/);
await assert.rejects(saveHomeworkRecord('a','quiz','week-01',{...quiz,answers:{}}),/submitted/);
const resetAt='2026-11-01T12:00:00.000Z',replacement={...base,id:'quiz-after-reset',resetAt,startedAt:'2026-11-01T12:01:00.000Z',deadlineAt:'2026-11-01T12:09:00.000Z'};
await assert.rejects(saveHomeworkRecord('a','quiz','week-01',replacement),/Reset the relevant/);
await saveStudyProgress('a',{id:'guild_g__card-0',uid:'a',cardId:'card-0',scopeKey:'guild_g',resetAt});const resetQuiz=await saveHomeworkRecord('a','quiz','week-01',replacement);assert.equal(resetQuiz._revision,4);assert.equal(resetQuiz.status,'active');assert.deepEqual(resetQuiz.answers,{});
let library=await loadStudyLibrary('a');assert.equal(library.homeworkQuizHistory.length,1);assert.deepEqual(library.quizArchive,library.homeworkQuizHistory);assert.equal(library.homeworkQuizHistory[0].status,'submitted');assert.equal(library.reviews.length,1005,'quiz archives are never counted as card reviews');assert.equal((await loadStudyLibrary('b')).homeworkQuizHistory.length,0);
await assert.rejects(saveHomeworkRecord('a','quiz','week-01',{...resetQuiz,id:'quiz-fake-new-reset'}),/Reset the relevant/);
// Exercise the real Firestore callback with a retrying in-memory adapter. The
// first callback is discarded just as Firestore discards a conflicted attempt.
const source=await readFile(new URL('../js/firebase-service.js',import.meta.url),'utf8');
const injected=source.replace("import { firebaseConfig } from '../config/firebase-config.js';","const firebaseConfig={enabled:false};")+'\nexport function __testCloud(adapter){ready=true;auth={currentUser:{uid:"a"}};db={};globalThis.window={__cqFirebase:{fsMod:adapter}};}';
const cloud=await import('data:text/javascript;base64,'+Buffer.from(injected).toString('base64'));
const docs=new Map(),ref=(...parts)=>parts.slice(1).join('/');let callbacks=0;
const adapter={doc:ref,collection:ref,getDocs:async path=>({docs:[...docs].filter(([key])=>key.startsWith(path+'/')&&key.split('/').length===path.split('/').length+1).map(([key,value])=>({id:key.split('/').at(-1),data:()=>structuredClone(value)}))}),runTransaction:async(db,callback)=>{let result;for(let pass=0;pass<2;pass++){callbacks++;const staged=[];result=await callback({get:async key=>({exists:()=>docs.has(key),data:()=>structuredClone(docs.get(key))}),set:(key,value)=>staged.push([key,structuredClone(value)])});if(pass===1)for(const [key,value] of staged)docs.set(key,value);}return result;}};
adapter.getDoc=async key=>({exists:()=>docs.has(key),data:()=>structuredClone(docs.get(key))});adapter.arrayUnion=(...values)=>({__union:values});adapter.writeBatch=()=>{const writes=[];return {set:(key,value)=>writes.push([key,value]),commit:async()=>{for(const [key,value] of writes){const old=docs.get(key)||{},merged={...old,...value};for(const [field,item] of Object.entries(value))if(item?.__union)merged[field]=[...new Set([...(old[field]||[]),...item.__union])];docs.set(key,merged);}}};};
cloud.__testCloud(adapter);
docs.set('users/a/studyCards/legacy-qae',{...legacyCard});await cloud.saveStudyImport({uid:'a',cards:[{...legacyCard,source:'Other supplemental',sources:['Other supplemental']}]});assert.equal(docs.get('users/a/studyCards/legacy-qae').source,'ISACA QAE Paste');assert.deepEqual(docs.get('users/a/studyCards/legacy-qae').sources,['ISACA QAE Paste','Other supplemental']);const cloudQuiz=await cloud.saveHomeworkRecord('a','quiz','week-01',base);assert.equal(callbacks,2);assert.equal(cloudQuiz._revision,1,'transaction retries do not mutate revision');
const cloudAnswer=await cloud.saveHomeworkRecord('a','quiz','week-01',answerHomeworkQuiz(cloudQuiz,'question-1','A',{now:'2026-10-31T13:01:00Z'}));assert.equal(cloudAnswer._revision,2);assert.equal(callbacks,4);
await assert.rejects(cloud.saveHomeworkRecord('b','quiz','week-01',{...base,uid:'b'}),/own account/);
await assert.rejects(cloud.saveStudyAuditEvent('b',{id:'foreign',type:'session-start'}),/own account/);
console.log('Homework persistence: compact snapshots, full owner-scoped review history, exact retries, concurrent quiz revisions, immutable submissions/timers, verified resets/archive and Firestore transaction retries passed.');
