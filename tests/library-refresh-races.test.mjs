import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
const source=await readFile(new URL('../js/app.js',import.meta.url),'utf8');
const refresh=source.slice(source.indexOf('let studyRefreshSequence='),source.indexOf('\nasync function migrateLegacyStudyLibrary'));
const community=source.slice(source.indexOf('async function refreshCommunityLibrary(){'),source.indexOf('\nasync function publishDeckToCommunity'));
const empty=()=>({decks:[],cards:[],reviews:[],progress:{},homeworkQuizzes:{},homeworkCompletions:{},activityRecords:[],homeworkQuizHistory:[]});
let resolveLoad,resolveCommunity,failSave=false;
const state={user:{uid:'a'},profile:{activeGroupId:'g'},library:empty()};
const context=vm.createContext({state,console:{error:()=>{}},loadStudyLibrary:()=>new Promise(r=>resolveLoad=r),loadCommunityLibrary:async()=>({contributions:[],statuses:{}}),aggregateCommunityLibrary:()=>({decks:[],cards:[]}),hydrateHomeworkRecords:()=>{},updateHomeworkSummary:()=>{},saveProfileDebounced:async()=>{if(failSave)throw Error('summary failed');},friendly:e=>e.message});
vm.runInContext(refresh+'\n'+community,context);
const start=()=>vm.runInContext('refreshStudyLibrary()',context);
// A request begun before a review must retain its library object and confirmed data.
const original=state.library;state.library.progress.card={id:'card',repetitions:0};
let pending=start();state.library.progress.card={id:'card',repetitions:1};state.library.reviews.push({id:'answer',correct:true});state.library.homeworkQuizzes.week={id:'quiz',_revision:2,answers:{q:'B'}};
resolveLoad({...empty(),progress:{card:{id:'card',repetitions:0}},homeworkQuizzes:{week:{id:'quiz',_revision:1,answers:{}}}});await pending;
assert.equal(state.library,original);assert.equal(state.library.progress.card.repetitions,1);assert.equal(state.library.reviews[0].id,'answer');assert.equal(state.library.homeworkQuizzes.week._revision,2);
// Failed trailing summary saves preserve successfully fetched questions.
failSave=true;pending=start();resolveLoad({...empty(),cards:[{id:'keep'}]});await pending;assert.equal(state.library.cards[0].id,'keep');assert.equal(state.library.error,'summary failed');failSave=false;
// Results from a different owner or Guild must never touch the active library.
pending=start();state.profile.activeGroupId='other';resolveLoad({...empty(),cards:[{id:'wrong-guild'}]});await pending;assert.equal(state.library.cards[0].id,'keep');
pending=start();state.profile={activeGroupId:'other'};resolveLoad({...empty(),cards:[{id:'wrong-account'}]});await pending;assert.equal(state.library.cards[0].id,'keep');
// A later refresh wins even when an older fetch completes last.
const first=start(),resolveFirst=resolveLoad;const second=start();resolveLoad({...empty(),cards:[{id:'newer'}]});await second;resolveFirst({...empty(),cards:[{id:'older'}]});await first;assert.equal(state.library.cards[0].id,'newer');
context.loadCommunityLibrary=()=>new Promise(r=>resolveCommunity=r);pending=vm.runInContext('refreshCommunityLibrary()',context);state.profile={activeGroupId:'third'};resolveCommunity({contributions:[{id:'old-user'}],statuses:{}});await pending;assert.equal(state.library.cards[0].id,'newer');
console.log('Library refresh races: review/quiz preservation, object identity, stale owner/Guild and stale request rejection, summary-failure retention pass.');
