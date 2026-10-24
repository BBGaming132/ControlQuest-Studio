import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { readFile } from 'node:fs/promises';
import { createBatchPlan, batchOperationId } from '../js/batch-importer.js';
import { buildImportBundle } from '../js/flashcard-engine.js';
import { loadStudyLibrary, saveStudyDeck } from '../js/firebase-service.js';
const dependency=name=>{
  const override=process.env[`CQ_${name.toUpperCase()}_PATH`];
  return override?pathToFileURL(override).href:name;
};
const { JSDOM }=await import(dependency('jsdom'));
const mammothModule=await import(dependency('mammoth'));
const mammoth=mammothModule.default||mammothModule;
const { renderExperience,bindExperience }=await import('../js/experience.js');

function crc32(bytes){let value=0xffffffff;for(const byte of bytes){value^=byte;for(let bit=0;bit<8;bit++)value=value&1?(value>>>1)^0xedb88320:value>>>1;}return(value^0xffffffff)>>>0;}
function zipStored(entries){
  const parts=[],central=[];let offset=0;
  for(const [name,text] of entries){
    const entryName=Buffer.from(name),data=Buffer.from(text),crc=crc32(data);
    const local=Buffer.alloc(30);local.writeUInt32LE(0x04034b50);local.writeUInt16LE(20,4);local.writeUInt32LE(crc,14);local.writeUInt32LE(data.length,18);local.writeUInt32LE(data.length,22);local.writeUInt16LE(entryName.length,26);
    parts.push(local,entryName,data);const head=Buffer.alloc(46);head.writeUInt32LE(0x02014b50);head.writeUInt16LE(20,4);head.writeUInt16LE(20,6);head.writeUInt32LE(crc,16);head.writeUInt32LE(data.length,20);head.writeUInt32LE(data.length,24);head.writeUInt16LE(entryName.length,28);head.writeUInt32LE(offset,42);central.push(head,entryName);offset+=local.length+entryName.length+data.length;
  }
  const directory=Buffer.concat(central),end=Buffer.alloc(22);end.writeUInt32LE(0x06054b50);end.writeUInt16LE(entries.length,8);end.writeUInt16LE(entries.length,10);end.writeUInt32LE(directory.length,12);end.writeUInt32LE(offset,16);return Buffer.concat([...parts,directory,end]);
}
const sample=({question='Which approach is BEST?',domain=1,knowledge='Audit Project Management'}={})=>`Question 1 of 1\nQuestion\n${question}\nA. Risk based\nB. Convenience\nA is the correct answer.\nJustification\nA. Prioritize risk.\nB. Convenience is not the priority.\nDomain${domain} Example domain\nKnowledge Statement1B1${knowledge}\nYour result is incorrect.\nYour answer is B.\nCorrect answer is A.`;
const wordFile=(text)=>zipStored([
  ['[Content_Types].xml','<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>'],
  ['word/document.xml','<?xml version="1.0"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>'+text.split('\n').map(line=>`<w:p><w:r><w:t>${line.replace(/&/g,'&amp;').replace(/</g,'&lt;')}</w:t></w:r></w:p>`).join('')+'</w:body></w:document>']
]);
const dom=new JSDOM('<main id="test-root"></main>',{url:'https://controlquest.test',pretendToBeVisual:true});
for(const key of ['window','document','localStorage','navigator','HTMLElement','FileReader'])Object.defineProperty(globalThis,key,{value:dom.window[key],configurable:true});
window.mammoth={extractRawText:({arrayBuffer},options)=>mammoth.extractRawText({buffer:Buffer.from(arrayBuffer)},options)};
const $=selector=>document.querySelector(selector),$$=selector=>[...document.querySelectorAll(selector)];
const change=(selector,value)=>{const element=$(selector);assert.ok(element,selector);if(element.type==='checkbox')element.checked=value;else element.value=value;element.dispatchEvent(new window.Event('change',{bubbles:true}));};
const waitUntil=async(predicate,label)=>{for(let attempt=0;attempt<300;attempt++){if(predicate())return;await new Promise(resolve=>setTimeout(resolve,5));}throw new Error(`Timed out: ${label}`);};
let calls=[],publicAttempts=0,failPublic=true,blockUntil=null,receipts=new Map();
const c={user:{uid:'bennett-ui'},group:{id:'guild-ui'},profile:{activeGroupId:'guild-ui',v3:{dailyGoal:20,studyMinutes:10,activity:[],lessonProgress:{}}},library:{cards:[],decks:[],progress:{},reviews:[]},navigate(){},toast(){},save:async()=>{},refresh:async()=>{},
  importBatch:async(item,{operationId,bundle})=>{
    calls.push({operationId,title:item.title,scope:item.scope,sharePublic:item.sharePublic,questionCount:bundle.cards.length});
    const receipt=receipts.get(operationId)||{privateSaved:false,publicSaved:false};receipts.set(operationId,receipt);
    // This reproduces the required root callback contract: persist each phase once, then retry only the unfinished phase.
    if(!receipt.privateSaved){receipt.privateSaved=true;receipt.privateWrites=(receipt.privateWrites||0)+1;}
    if(item.sharePublic&&!receipt.publicSaved){publicAttempts++;if(failPublic){failPublic=false;throw new Error('Public sync temporarily unavailable');}receipt.publicSaved=true;}
    if(blockUntil)await blockUntil;
    return {success:true};
  }};
c.render=()=>{$('#test-root').innerHTML=renderExperience('import',c);bindExperience('import',c);};
function chooseFiles(files){const input=$('#cqBatchFiles');Object.defineProperty(input,'files',{value:files,configurable:true});input.dispatchEvent(new window.Event('change',{bubbles:true}));}
try{
  c.render();change('#cqBatchPublic',false);c.render();assert.equal($('#cqBatchPublic').checked,false,'Sharing default survives rerenders');
  chooseFiles([
    new window.File([wordFile(sample())],'Domain 1 - Audit Project Management.docx'),
    new window.File([sample({question:'Unknown concept?',domain:2,knowledge:'Not a recognized lesson'})],'Unclear.txt')
  ]);
  await waitUntil(()=>$$('.cq-batch-row').length===2&&!$('#cqRunBatch').disabled,'batch preview');
  assert.equal($('[data-batch-title="0"]').value,'Domain 1 - Audit Project Management');
  assert.equal($('[data-batch-lesson="0"]').value,'d1-t05');
  assert.equal($('[data-batch-public="0"]').checked,false);
  assert.ok($('.cq-batch-summary').textContent.includes('2 selected files'));
  // A blocked row must show a reason, and per-file controls must offer an honest way to resolve it.
  change('[data-batch-public="1"]',true);change('[data-batch-confirm="1"]',true);
  $('#cqRunBatch').click();await waitUntil(()=>!$('#cqRunBatch').disabled,'first run');
  assert.ok($$('.cq-batch-row')[1].textContent.includes('Public sharing needs a recognized lesson'));
  assert.equal(calls.length,1);assert.equal(calls[0].sharePublic,false);
  change('[data-batch-public="1"]',false);change('[data-batch-scope="1"]','Personal');change('[data-batch-confirm="1"]',true);
  $('#cqRunBatch').click();await waitUntil(()=>!$('#cqRunBatch').disabled,'corrected retry');
  assert.equal(calls.length,2,'Previously saved row is skipped after retry');assert.equal(calls[1].scope,'Personal');
  $('#cqRunBatch').click();await waitUntil(()=>!$('#cqRunBatch').disabled,'completed retry');assert.equal(calls.length,2);
  // Changing metadata invalidates the previous checkpoint; partial public failure remains retryable.
  change('[data-batch-title="0"]','Changed deck title');change('[data-batch-public="0"]',true);change('[data-batch-confirm="0"]',true);
  $('#cqRunBatch').click();await waitUntil(()=>!$('#cqRunBatch').disabled,'public failure');
  assert.ok($$('.cq-batch-row')[0].textContent.includes('Public sync temporarily unavailable'));
  const changedOperation=calls.at(-1).operationId;assert.equal(receipts.get(changedOperation).privateWrites,1);
  $('#cqRunBatch').click();await waitUntil(()=>!$('#cqRunBatch').disabled,'public retry');
  assert.equal(publicAttempts,2);assert.equal(receipts.get(changedOperation).privateWrites,1);assert.equal(receipts.get(changedOperation).publicSaved,true);
  // Stop waits for in-flight persistence; later selected files remain available for retry.
  chooseFiles([new window.File([sample({question:'Cancel one?'})],'Cancel 1.txt'),new window.File([sample({question:'Cancel two?'})],'Cancel 2.txt')]);
  await waitUntil(()=>$$('.cq-batch-row').length===2&&!$('#cqRunBatch').disabled&&$('[data-batch-title="0"]').value==='Cancel 1','cancel preview');
  let release;blockUntil=new Promise(resolve=>{release=resolve;});$('#cqRunBatch').click();await waitUntil(()=>calls.at(-1)?.title==='Cancel 1','in flight');
  $('#cqCancelBatch').click();release();blockUntil=null;await waitUntil(()=>!$('#cqRunBatch').disabled,'cancelled');
  assert.ok($$('.cq-batch-row')[1].classList.contains('cancelled'));
  $('#cqRunBatch').click();await waitUntil(()=>!$('#cqRunBatch').disabled,'resume cancelled');
  assert.equal(calls.filter(call=>call.title==='Cancel 1').length,1);assert.equal(calls.filter(call=>call.title==='Cancel 2').length,1);
  // Corrupt archives are rejected before the extractor is called.
  chooseFiles([new window.File(['not a zip'],'Corrupt.docx')]);await waitUntil(()=>$$('.cq-batch-row').length===1&&!$('#cqRunBatch').disabled,'corrupt preview');
  assert.ok($('.cq-batch-row').textContent.includes('not a valid Word'));
  // A slow Word reader must not expose its old preview after an account switch.
  const originalWordReader=window.mammoth;let releaseRead,readStarted=false;
  const readGate=new Promise(resolve=>{releaseRead=resolve;});
  window.mammoth={extractRawText:async(...args)=>{readStarted=true;await readGate;return originalWordReader.extractRawText(...args);}};
  chooseFiles([new window.File([wordFile(sample())],'Private previous user.docx')]);
  await waitUntil(()=>readStarted,'slow Word reader');
  c.user={uid:'other-ui'};c.group=null;c.profile={activeGroupId:null,v3:{dailyGoal:20,studyMinutes:10,activity:[],lessonProgress:{}}};c.render();
  releaseRead();await new Promise(resolve=>setTimeout(resolve,35));
  assert.equal($$('.cq-batch-row').length,0,'Old-user preview is discarded after sign-in changes');
  assert.equal($('#cqBatchScope').value,'Personal');window.mammoth=originalWordReader;
  // Exercise the real app callback, including a reload after private persistence and before public completion.
  const appUrl=new URL('../js/app.js',import.meta.url);
  const source=(await readFile(appUrl,'utf8')).replace(/from ['"]\.\/([^'"]+)['"]/g,(_,relative)=>`from '${new URL(relative,appUrl).href}'`).replace(/\ninit\(\);/,'\n')+'\nexport {state,defaultProfile,saveExperienceBatch};';
  const createdIntervals=[],originalInterval=globalThis.setInterval;let actual;
  globalThis.setInterval=(...args)=>{const handle=originalInterval(...args);createdIntervals.push(handle);return handle;};
  try{actual=await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);}
  finally{globalThis.setInterval=originalInterval;createdIntervals.forEach(clearInterval);}
  const actualStore=new Map();let privateWrites=0,publicFailures=1;
  const actualStorage={getItem:key=>actualStore.get(key)||null,setItem:(key,value)=>{
    const data=JSON.parse(value);
    if(key==='controlquest_v27_study_library'){
      if(data.publicContributions?.length&&publicFailures-->0)throw new Error('Injected public storage failure');
      if(!data.publicContributions)privateWrites++;
    }
    actualStore.set(key,value);
  },removeItem:key=>actualStore.delete(key)};
  Object.defineProperty(globalThis,'localStorage',{value:actualStorage,configurable:true});
  actual.state.user={uid:'actual-import',email:'actual@example.com'};actual.state.profile=actual.defaultProfile(actual.state.user);actual.state.profile.v3={importReceipts:{}};
  actual.state.library={cards:[],decks:[],progress:{},reviews:[]};actual.state.group=null;
  const actualPlan=await createBatchPlan([{name:'Actual.txt',size:sample().length,text:async()=>sample()}],{uid:'actual-import',groupId:null,scope:'Personal'});
  const actualItem=actualPlan.items[0],operationId=await batchOperationId(actualItem,{uid:'actual-import',groupId:null});
  const makeBundle=(item)=>buildImportBundle({questions:item.questions,title:item.title,lessonId:item.lessonId,scope:item.scope,uid:'actual-import',groupId:null,importedBy:'Bennett'});
  await assert.rejects(actual.saveExperienceBatch(actualItem,{operationId,bundle:makeBundle(actualItem)}),/Injected public/);
  assert.equal(privateWrites,1);assert.equal(actual.state.profile.v3.importReceipts[operationId].privateSaved,true);
  actual.state.profile=JSON.parse(actualStore.get('controlquest_v24_local_state')).profile;
  actual.state.library=await loadStudyLibrary('actual-import');
  await actual.saveExperienceBatch(actualItem,{operationId,bundle:makeBundle(actualItem)});
  assert.equal(privateWrites,1,'Real callback must not repeat the private save after a partial public failure and reload');
  assert.equal(actual.state.profile.v3.importReceipts[operationId].complete,true);
  const actualSaved=JSON.parse(actualStore.get('controlquest_v27_study_library'));
  assert.equal(actualSaved.cards.length,1);assert.equal(actualSaved.publicContributions.length,1);
  const originalDeck=actualSaved.decks.find(deck=>deck.kind==='lesson');
  await saveStudyDeck({uid:'actual-import',deck:{...originalDeck,categoryOverride:true,domainId:'d1'}});
  const mixed={...actualItem,lessonId:'',sharePublic:false};
  const mixedOperation=await batchOperationId(mixed,{uid:'actual-import',groupId:null});
  await actual.saveExperienceBatch(mixed,{operationId:mixedOperation,bundle:makeBundle(mixed)});
  const updatedDeck=JSON.parse(actualStore.get('controlquest_v27_study_library')).decks.find(deck=>deck.id===originalDeck.id);
  assert.equal(updatedDeck.lessonId,'');assert.equal(updatedDeck.categoryOverride,false,'Mixed imports clear prior deck-level category overrides');
  const otherOwnerBundle=makeBundle(actualItem);otherOwnerBundle.decks.forEach(deck=>deck.ownerUid='other-user');
  await assert.rejects(actual.saveExperienceBatch(actualItem,{operationId:'other-user-operation',bundle:otherOwnerBundle}),/account or Guild changed/);

  console.log('V3 batch UI: real DOCX extraction, editable destinations/sharing, visible errors, summaries, retries, partial-public callback contract, real callback reload receipts and cancellation passed.');
}finally{dom.window.close();}
