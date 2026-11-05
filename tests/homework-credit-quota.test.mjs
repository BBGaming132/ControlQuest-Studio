import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
const source=await readFile(new URL('../js/app.js',import.meta.url),'utf8');
const fn=source.slice(source.indexOf('async function persistHomework(next){'),source.indexOf('\nasync function recordAccountActivity'));
let failRecord=false,profileCalls=[],warnings=[];
const state={user:{uid:'a'},profile:{v3:{homework:{enrolledAt:'today',quizzes:{},completions:{}}}},library:{homeworkQuizzes:{},homeworkCompletions:{}}};
const context=vm.createContext({state,homeworkSaving:false,console:{warn:()=>{}},updateHomeworkSummary:()=>{},toast:message=>warnings.push(message),saveHomeworkRecord:async(uid,kind,key,value)=>{if(failRecord)throw Error('Quota exceeded.');return {...value};},saveProfileDebounced:async immediate=>{profileCalls.push(immediate);if(immediate)throw Error('Quota exceeded.');}});
vm.runInContext(fn,context);
const save=next=>{context.next=next;return vm.runInContext('persistHomework(next)',context);};
const completion={lessonId:'lesson',completedAt:'today',cardIdentities:['q']};
await save({...state.profile.v3.homework,completions:{lesson:completion}});
assert.equal(state.profile.v3.homework.completions.lesson.completedAt,'today');assert.deepEqual(profileCalls,[undefined],'Saved credit never waits for redundant profile summary writes');
// A failed authoritative completion remains a real error; it cannot grant credit.
failRecord=true;await assert.rejects(save({...state.profile.v3.homework,completions:{...state.profile.v3.homework.completions,other:{...completion,lessonId:'other'}}}),/Quota exceeded/);assert.equal(state.profile.v3.homework.completions.other,undefined);
// First enrollment can also persist a completion before its profile metadata fails.
failRecord=false;await save({...state.profile.v3.homework,enrolledAt:'new',completions:{...state.profile.v3.homework.completions,third:{...completion,lessonId:'third'}}});assert.ok(state.profile.v3.homework.completions.third);assert.equal(warnings.length,1);
// Metadata-only changes still need their authoritative profile save.
await assert.rejects(save({...state.profile.v3.homework,enrolledAt:'unsaved'}),/Quota exceeded/);
console.log('Credit quota: confirmed lesson credit survives ancillary failure; failed completion and metadata-only writes reject.');
