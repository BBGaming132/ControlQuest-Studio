import assert from 'node:assert/strict';
import {saveCategoryPatch,loadStudyLibrary,saveStudyImport} from '../js/firebase-service.js';
import {auditLibrary} from '../js/library-audit.js';
const store=new Map();globalThis.localStorage={getItem:key=>store.get(key)||null,setItem:(key,value)=>store.set(key,value)};
const deck={id:'lesson',scope:'Personal',scopeKey:'personal_u',ownerUid:'u',title:'Audit Project Management'};
const card={id:'one',scope:'Personal',scopeKey:'personal_u',ownerUid:'u',question:'Which approach?',choices:{A:'Risk',B:'Convenience'},correctAnswer:'A',justifications:{A:'Consider risk first.'},deckIds:['lesson'],domainNumber:1,knowledgeStatement:'Audit Project Management'};
await saveStudyImport({uid:'u',decks:[deck],cards:[card]});
let library=await loadStudyLibrary('u');const before=structuredClone(library);const plan=auditLibrary({...library,uid:'u'});assert.equal(plan.categorization.operations.length,2);
for(const op of plan.categorization.operations){const source=(op.kind==='deck'?library.decks:library.cards).find(r=>r.id===op.id);await saveCategoryPatch({uid:'u',...op,expectedUpdatedAt:source.updatedAt});}
library=await loadStudyLibrary('u');assert.equal(library.decks[0].lessonId,'d1-t05');assert.equal(library.cards[0].domainId,'d1');assert.equal(library.cards[0].question,before.cards[0].question);assert.deepEqual(library.cards[0].choices,before.cards[0].choices);assert.equal(library.cards[0].correctAnswer,before.cards[0].correctAnswer);assert.deepEqual(library.cards[0].justifications,before.cards[0].justifications);assert.deepEqual(library.progress,before.progress);assert.deepEqual(library.reviews,before.reviews);
const args={uid:'u',kind:'card',id:'one',scope:'Personal',patch:{lessonId:'d1-t05',domainId:'d1'},expectedUpdatedAt:library.cards[0].updatedAt};
await assert.rejects(saveCategoryPatch({...args,expectedUpdatedAt:'stale'}),/changed/);
await assert.rejects(saveCategoryPatch({...args,patch:{...args.patch,question:'Rewritten'}}),/Only lesson/);
await assert.rejects(saveCategoryPatch({...args,patch:{lessonId:'made-up',domainId:'d1'}}),/canonical/);
await assert.rejects(saveCategoryPatch({...args,patch:{lessonId:'d1-t05',domainId:'d2'}}),/canonical/);
await assert.rejects(saveCategoryPatch({...args,scope:'Public'}),/writable/);
await assert.rejects(saveCategoryPatch({...args,uid:'another'}),/removed|another account/);
await saveStudyImport({uid:'u',decks:[{...deck,categoryOverride:true}],cards:[]});library=await loadStudyLibrary('u');await assert.rejects(saveCategoryPatch({...args,kind:'deck',id:'lesson',expectedUpdatedAt:library.decks[0].updatedAt}),/manually/);
console.log('Category persistence: audit patches apply canonical fields only, retain questions/recall, reject stale writes, manual categories, other owners and Public edits passed.');
