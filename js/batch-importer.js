import {auditIncomingQuestions} from './library-audit.js';
import { sha256Hex } from './runtime-crypto.js';
import { parseQaePaste } from './qae-parser.js';
import { LESSONS, cardLesson, matchLesson, lessonMatchDetails } from './lesson-catalog.js';
import { buildImportBundle, normalizeQuestion, scopeKey as importScopeKey } from './flashcard-engine.js';

export const BATCH_IMPORT_VERSION = 1;
export const BATCH_SOURCES = Object.freeze(['ISACA QAE Paste','Udemy supplemental','Other supplemental','Practice exam']);
export const BATCH_LIMITS = Object.freeze({
  maxFiles:100, maxFileBytes:12*1024*1024, maxTotalBytes:90*1024*1024,
  maxTextChars:2*1024*1024, maxTotalTextChars:12*1024*1024,
  maxQuestionsPerFile:3000, maxTotalQuestions:20000
});
const allowedScopes = new Set(['Guild','Personal','Public']);
const aborted = signal => !!signal?.aborted;
const checkAbort = signal => { if(aborted(signal)){const error=new Error('Import cancelled.');error.name='AbortError';throw error;} };
const normalize = value => normalizeQuestion(String(value||''));
const filenameTitle = name => String(name||'Untitled export').replace(/\.(docx|txt|md)$/i,'').trim() || 'Untitled export';
export const batchQuestionIdentity = question => JSON.stringify([
  normalize(question.question),Object.values(question.choices||{}).map(normalize).sort()
]);
const answerIdentity = question => normalize(question.choices?.[question.correctAnswer]||'');
// Some exports concatenate Domain1. Do not carry trailing personal result metadata into shared explanations.
const cleanJustification = value => String(value||'').split(/(?:^|\n)\s*(?:Domain\s*[1-5](?=\s|[A-Za-z])|Knowledge Statement|Task Statement|Your (?:answer|result)|Correct answer is|Incorrect\s*(?=\n|$)|Correct\s*(?=\n|$))/i)[0].trim();

const digest=sha256Hex;

function remapQuestion(question, representative){
  if(!representative)return {...question};
  const choices=representative.choices||{},oldChoices=question.choices||{};
  const targetLetter=letter=>Object.keys(choices).find(key=>normalize(choices[key])===normalize(oldChoices[letter]));
  const justifications={};
  for(const [letter,text] of Object.entries(question.justifications||{})){
    const mapped=letter==='_'?'_':targetLetter(letter);if(mapped)justifications[mapped]=text;
  }
  return {...question,sources:[...new Set([...(question.sources||[]),...(representative.scopeKey?[...(representative.sources||[]),representative.source].filter(Boolean):[])])],choices:{...choices},correctAnswer:targetLetter(question.correctAnswer)||question.correctAnswer,
    userAnswer:question.userAnswer?targetLetter(question.userAnswer)||question.userAnswer:null,
    justifications, fingerprint:representative.fingerprint||String(representative.id||'').replace(/^card_/, '')};
}

/** Check the ZIP directory before asking Mammoth to extract text from an uploaded Word file. */
export function inspectDocxArchive(buffer,{maxUncompressedBytes=32*1024*1024,maxArchiveEntries=2000,maxCompressionRatio=500}={}){
  const bytes=buffer instanceof ArrayBuffer?new Uint8Array(buffer):new Uint8Array(buffer.buffer,buffer.byteOffset,buffer.byteLength);
  if(bytes.byteLength<22)throw new Error('This is not a valid Word (.docx) archive.');
  const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);let end=-1;
  for(let offset=bytes.length-22;offset>=Math.max(0,bytes.length-65557);offset--)if(view.getUint32(offset,true)===0x06054b50&&offset+22+view.getUint16(offset+20,true)===bytes.length){end=offset;break;}
  if(end<0)throw new Error('The Word archive is incomplete or invalid. Export it again.');
  const count=view.getUint16(end+10,true),directorySize=view.getUint32(end+12,true),directoryOffset=view.getUint32(end+16,true);
  if(view.getUint16(end+4,true)||view.getUint16(end+6,true)||view.getUint16(end+8,true)!==count||count===65535||directoryOffset===0xffffffff||directorySize===0xffffffff)throw new Error('Split or ZIP64 Word archives are not supported.');
  if(count>maxArchiveEntries)throw new Error('This Word archive contains too many entries. Use a simpler text export.');
  if(directoryOffset+directorySize>end)throw new Error('The Word archive directory is invalid.');
  let cursor=directoryOffset,totalUncompressedBytes=0;const names=new Set();const decoder=new TextDecoder();
  for(let i=0;i<count;i++){
    if(cursor+46>directoryOffset+directorySize||view.getUint32(cursor,true)!==0x02014b50)throw new Error('The Word archive directory is invalid.');
    const flags=view.getUint16(cursor+8,true),method=view.getUint16(cursor+10,true),compressed=view.getUint32(cursor+20,true),uncompressed=view.getUint32(cursor+24,true);
    const nameLength=view.getUint16(cursor+28,true),extraLength=view.getUint16(cursor+30,true),commentLength=view.getUint16(cursor+32,true),localOffset=view.getUint32(cursor+42,true);
    const next=cursor+46+nameLength+extraLength+commentLength;
    if(next>directoryOffset+directorySize||localOffset+30>directoryOffset||view.getUint32(localOffset,true)!==0x04034b50)throw new Error('The Word archive contains an invalid entry.');
    const localNameLength=view.getUint16(localOffset+26,true),localExtraLength=view.getUint16(localOffset+28,true);
    if(localOffset+30+localNameLength+localExtraLength+compressed>directoryOffset)throw new Error('The Word archive contains an invalid compressed entry.');
    const name=decoder.decode(bytes.subarray(cursor+46,cursor+46+nameLength));
    if(!name||name.includes('\\')||name.startsWith('/')||name.split('/').includes('..')||/[\u0000-\u001f]/.test(name)||names.has(name))throw new Error('The Word archive contains unsafe or repeated paths.');
    if(flags&1||![0,8].includes(method))throw new Error('Encrypted or unsupported Word archives cannot be imported.');
    if(/(?:vbaProject\.bin|vbaData\.xml)$/i.test(name))throw new Error('Macro-enabled Word files cannot be imported. Save a standard .docx or text export.');
    if(uncompressed===0xffffffff||compressed===0xffffffff)throw new Error('ZIP64 Word entries are not supported.');
    totalUncompressedBytes+=uncompressed;
    if(totalUncompressedBytes>maxUncompressedBytes||(uncompressed>1024*1024&&uncompressed/Math.max(1,compressed)>maxCompressionRatio))throw new Error('This Word file expands beyond the safe import limit. Use a text export or split it.');
    names.add(name);cursor=next;
  }
  if(cursor!==directoryOffset+directorySize||!names.has('[Content_Types].xml')||!names.has('word/document.xml'))throw new Error('This file is not a standard Word .docx document.');
  return {entries:count,totalUncompressedBytes};
}

export async function readBatchFile(file,{signal,maxTextChars=BATCH_LIMITS.maxTextChars,mammoth=globalThis.window?.mammoth}={}){
  checkAbort(signal);
  const extension=String(file?.name||'').toLowerCase().match(/\.(docx|txt|md)$/)?.[1];
  if(!extension)throw new Error('Use Word (.docx), plain text (.txt), or Markdown (.md) exports.');
  let text;
  if(extension==='docx'){
    if(!mammoth?.extractRawText)throw new Error('The Word reader is unavailable. Refresh or use a text export.');
    const arrayBuffer=typeof file.arrayBuffer==='function'?await file.arrayBuffer():await readerValue(file,'arrayBuffer',signal);
    checkAbort(signal);inspectDocxArchive(arrayBuffer);const result=await mammoth.extractRawText({arrayBuffer},{externalFileAccess:false});text=result?.value||'';
  }else text=typeof file.text==='function'?await file.text():await readerValue(file,'text',signal);
  checkAbort(signal);
  if(String(text).length>maxTextChars)throw new Error('The extracted file text exceeds this batch’s per-file limit. Split the export into smaller files.');
  return String(text);
}
function readerValue(file,kind,signal){
  return new Promise((resolve,reject)=>{
    if(typeof FileReader==='undefined')return reject(new Error('The browser file reader is unavailable.'));
    const reader=new FileReader();
    const stop=()=>reader.abort();
    const cleanup=()=>signal?.removeEventListener('abort',stop);
    reader.onload=()=>{cleanup();resolve(reader.result);};reader.onerror=()=>{cleanup();reject(new Error('Could not read this file.'));};
    reader.onabort=()=>{cleanup();const error=new Error('Import cancelled.');error.name='AbortError';reject(error);};
    signal?.addEventListener('abort',stop,{once:true});
    if(kind==='arrayBuffer')reader.readAsArrayBuffer(file);else reader.readAsText(file);
  });
}

function summarize(items){
  const included=items.filter(item=>item.include!==false);
  return {files:items.length,included:included.length,parsed:items.filter(item=>item.questions?.length).length,
    questions:included.reduce((sum,item)=>sum+(item.questions?.length||0),0),
    uniqueQuestions:new Set(included.flatMap(item=>(item.questions||[]).map(batchQuestionIdentity))).size,
    duplicateFiles:items.filter(item=>item.duplicateOf).length,
    existingDuplicates:included.reduce((n,item)=>n+(item.importAudit?.existingDuplicates||0),0),
    batchDuplicates:included.reduce((n,item)=>n+(item.importAudit?.batchDuplicates||0)+(item.duplicateQuestions||0),0),
    newQuestions:included.reduce((n,item)=>n+(item.importAudit?.newQuestions||0),0),
    answerConflicts:included.reduce((n,item)=>n+(item.importAudit?.answerConflicts||0),0),
    reviewRequired:included.filter(item=>item.requiresReview&&!item.confirmed).length,
    failed:items.filter(item=>item.status==='failed').length,completed:items.filter(item=>item.status==='complete').length,
    skipped:items.filter(item=>item.status==='skipped').length,cancelled:items.filter(item=>item.status==='cancelled').length};
}
export function summarizeBatchPlan(plan){return summarize(plan?.items||[]);}

/** Parse sequentially. No writes occur until the user reviews and runs the returned plan. */
export async function createBatchPlan(files, options={}){
  const limits={...BATCH_LIMITS,...options.limits};
  const input=Array.from(files||[]);
  if(!input.length)throw new Error('Select at least one Word or text export.');
  if(input.length>limits.maxFiles)throw new Error(`Select at most ${limits.maxFiles} files per batch.`);
  const totalBytes=input.reduce((sum,file)=>sum+Math.max(0,Number(file.size)||0),0);
  if(totalBytes>limits.maxTotalBytes)throw new Error('This batch exceeds the total file-size limit. Use smaller batches.');
  const scope=options.scope||'Guild';if(!allowedScopes.has(scope))throw new Error('Invalid import scope.');
  const source=options.source||BATCH_SOURCES[0];if(!BATCH_SOURCES.includes(source))throw new Error('Choose a recognized question source.');
  const items=input.map((file,index)=>({id:`file_${index}`,fileName:String(file.name||`Export ${index+1}.txt`),
    title:filenameTitle(file.name),lessonId:'',scope,source,sharePublic:options.sharePublic!==false,
    include:true,confirmed:false,status:'pending',questions:[],warnings:[],errors:[],requiresReview:false,
    size:Math.max(0,Number(file.size)||0),sourceIndex:index}));
  const plan={version:BATCH_IMPORT_VERSION,id:'',uid:options.uid||'',groupId:options.groupId||null,items,limits,
    createdAt:new Date().toISOString(),cancelled:false,running:false,summary:summarize(items)};
  const seenFiles=new Map(),representatives=new Map(),answerSources=new Map(),priorQuestions=[];
  for(const card of options.existingCards||[]){
    if(!card.question||!card.correctAnswer)continue;
    const key=`${batchQuestionIdentity(card)}|${answerIdentity(card)}`;
    if(!representatives.has(key))representatives.set(key,card);
    if(card.scopeKey&&!representatives.has(`${card.scopeKey}|${key}`))representatives.set(`${card.scopeKey}|${key}`,card);
  }
  let totalText=0,totalQuestions=0;
  for(let index=0;index<items.length;index++){
    const item=items[index],file=input[index];
    if(aborted(options.signal)){plan.cancelled=true;item.status='cancelled';continue;}
    item.status='reading';options.onProgress?.({phase:'reading',index,total:items.length,item,plan});
    try{
      if(item.size>limits.maxFileBytes)throw new Error('This file exceeds the per-file limit. Split the export into smaller files.');
      if(!/\.(docx|txt|md)$/i.test(item.fileName))throw new Error('Unsupported file type. Use .docx, .txt, or .md.');
      const result=await (options.readFile||readBatchFile)(file,{signal:options.signal,maxTextChars:limits.maxTextChars});
      checkAbort(options.signal);const text=typeof result==='string'?result:String(result?.value??result?.text??'');
      if(text.length>limits.maxTextChars)throw new Error('The extracted text exceeds the per-file limit.');
      if(totalText+text.length>limits.maxTotalTextChars)throw new Error('This batch exceeds the extracted-text limit. Use smaller batches.');
      totalText+=text.length;item.fileDigest=await digest(text.normalize('NFKC').replace(/\r\n/g,'\n'));
      if(seenFiles.has(item.fileDigest)){
        item.duplicateOf=seenFiles.get(item.fileDigest);const original=items.find(row=>row.id===item.duplicateOf);
        item.questions=original?.questions||[];item.lessonId=original?.lessonId||'';item.unmatchedQuestions=original?.unmatchedQuestions||0;
        item.importAudit=auditIncomingQuestions(item.questions,options.existingCards||[],priorQuestions);item.include=false;item.status='duplicate';item.requiresReview=true;
        item.warnings.push('Identical file content is already in this batch. It is excluded by default. Confirm it only if you deliberately want a second deck or destination.');continue;
      }
      seenFiles.set(item.fileDigest,item.id);
      const parsed=parseQaePaste(text);item.warnings.push(...(parsed.warnings||[]));
      if(Array.isArray(result?.warnings))item.warnings.push(...result.warnings.map(String));
      if(!parsed.questions.length)throw new Error('No complete questions were parsed. Check that the export includes answer choices and correct answers.');
      if(parsed.questions.length>limits.maxQuestionsPerFile)throw new Error('This file contains too many questions. Split it into smaller exports.');
      if(totalQuestions+parsed.questions.length>limits.maxTotalQuestions)throw new Error('This batch contains too many questions. Use smaller batches.');
      totalQuestions+=parsed.questions.length;
      const unique=new Map();
      for(const original of parsed.questions){
        checkAbort(options.signal);
        const identity=batchQuestionIdentity(original),answer=answerIdentity(original),key=`${identity}|${answer}`;
        if(!answer)throw new Error('A correct-answer letter does not match its answer choices. Review this export.');
        const safe={...original,justifications:Object.fromEntries(Object.entries(original.justifications||{}).map(([letter,text])=>[letter,cleanJustification(text)]))};
        const destination=importScopeKey(item.scope,options.uid,options.groupId);
        const existing=representatives.get(`${destination}|${key}`)||representatives.get(key);let question=remapQuestion(safe,existing);
        if(!existing)question.fingerprint=`batch_${await digest(key)}`;
        if(!representatives.has(key))representatives.set(key,question);
        if(!representatives.has(`${destination}|${key}`))representatives.set(`${destination}|${key}`,question);
        question.batchIdentity=identity;
        if(unique.has(key)){
          item.duplicateQuestions=(item.duplicateQuestions||0)+1;
          // A miss must not disappear when the same export also contains a later correct occurrence.
          if(question.isCorrect===false&&unique.get(key).isCorrect!==false)unique.set(key,question);
        }else unique.set(key,question);
        const source=answerSources.get(identity)||new Map();
        source.set(answer,[...(source.get(answer)||[]),item]);answerSources.set(identity,source);
      }
      item.questions=[...unique.values()];
      item.importAudit=auditIncomingQuestions(item.questions,options.existingCards||[],priorQuestions);
      if(item.importAudit.existingDuplicates)item.warnings.push(`${item.importAudit.existingDuplicates} exact questions already exist in your loaded library (including other scopes). Their existing question IDs are reused when saving to the same destination; no extra learning credit comes from uploading again.`);
      if(item.importAudit.batchDuplicates)item.warnings.push(`${item.importAudit.batchDuplicates} exact questions also appear in earlier files in this batch. Shared-bank duplicates are linked rather than additional unique questions.`);
      if(item.importAudit.answerConflicts)item.warnings.push(`${item.importAudit.answerConflicts} questions match existing question text and choices but have conflicting correct-answer keys. Variants are retained for review; they are not silently merged.`);
      priorQuestions.push(...item.questions);
      const nameMatch=lessonMatchDetails(item.title),named=nameMatch.lesson,detected=item.questions.map(cardLesson),detectedIds=new Set(detected.filter(Boolean).map(l=>l.id));
      const unanimous=detected.length&&detected.every(Boolean)&&detectedIds.size===1?detected[0]:null;
      item.lessonId=(named?.domainId==='practice'?named:detectedIds.size>1?null:unanimous||named)?.id||'';
      if(detectedIds.size>1&&named?.domainId!=='practice')item.warnings.push('Question metadata spans several lessons. Keep Mixed / Unassigned to preserve each question’s category, or verify a deliberate reassignment.');
      item.lessonMatch={method:nameMatch.method,confidence:nameMatch.confidence,candidates:nameMatch.candidates.map(l=>({id:l.id,title:l.title}))};
      if(nameMatch.method==='spelling')item.warnings.push(`The filename has a close spelling match to “${named.title}”. Verify the proposed lesson before importing.`);
      if(nameMatch.method==='ambiguous')item.warnings.push('The filename could refer to several lessons. Choose the intended lesson or review this as a mixed export.');
      if(item.duplicateQuestions)item.warnings.push(`${item.duplicateQuestions} duplicate questions within this file were combined.`);
      item.unmatchedQuestions=item.questions.filter(q=>!cardLesson(q)).length;
      if(!item.lessonId&&item.unmatchedQuestions)item.warnings.push(`${item.unmatchedQuestions} questions have no recognized lesson. Choose a lesson or explicitly review this mixed export.`);
      if(named&&unanimous&&named.id!==unanimous.id)item.warnings.push('The filename and question metadata suggest different lessons. The question metadata is proposed; verify the lesson.');
      const totals=new Set(item.questions.map(q=>q.totalInSet).filter(Boolean));
      if(totals.size===1&&item.questions.length<[...totals][0])item.warnings.push(`Parsed ${item.questions.length} unique questions; the export reports ${[...totals][0]} items. Check for missing or repeated blocks.`);
      item.requiresReview=item.warnings.length>0||(!item.lessonId&&item.unmatchedQuestions>0);
      item.status=item.requiresReview?'review':'ready';
    }catch(error){
      item.error=String(error?.message||error);item.status=error?.name==='AbortError'?'cancelled':'failed';
      if(item.status==='cancelled')plan.cancelled=true;
    }finally{plan.summary=summarize(items);options.onProgress?.({phase:'parsed',index,total:items.length,item,plan});}
  }
  for(const answers of answerSources.values())if(answers.size>1){
    for(const item of new Set([...answers.values()].flat())){
      item.warnings.push('Different correct answers were found for the same question. Answer variants are retained; review them before importing.');
      item.requiresReview=true;if(['ready','review'].includes(item.status))item.status='review';
    }
  }
  plan.id=await digest(JSON.stringify(items.map(item=>[item.fileDigest||item.fileName,item.title])));
  plan.summary=summarize(items);return plan;
}

function itemIssues(item,groupId){
  const errors=[];const lesson=LESSONS.find(l=>l.id===item.lessonId);
  if(!item.title?.trim())errors.push('Give this file a deck name.');
  if(!allowedScopes.has(item.scope))errors.push('Choose a valid import scope.');
  if(!BATCH_SOURCES.includes(item.source||BATCH_SOURCES[0]))errors.push('Choose a recognized question source.');
  if(item.scope==='Guild'&&!groupId)errors.push('Join a Guild or choose Personal scope.');
  if(item.lessonId&&!lesson)errors.push('Choose a recognized lesson.');
  if(!item.questions?.length)errors.push(item.error||'No parsed questions are available.');
  if(lesson&&lesson.domainId!=='practice'&&item.questions.some(q=>q.domainNumber&&`d${q.domainNumber}`!==lesson.domainId))errors.push('The selected lesson conflicts with the question domains. Choose Mixed / Unassigned or the correct lesson.');
  if(item.requiresReview&&!item.confirmed)errors.push('Review this file’s warnings and confirm it before importing.');
  if((item.scope==='Public'||item.sharePublic)&&!lesson&&item.questions?.some(q=>!cardLesson(q)))errors.push('Public sharing needs a recognized lesson for every question. Categorize the file or disable Public sharing.');
  return errors;
}
export async function batchOperationId(item,{uid,groupId}={}){
  return digest(JSON.stringify({version:BATCH_IMPORT_VERSION,uid,groupId:groupId||null,
    ...((item.source&&item.source!==BATCH_SOURCES[0])?{source:item.source}:{}),file:item.fileDigest,title:String(item.title||'').trim(),lessonId:item.lessonId||'',scope:item.scope,sharePublic:!!item.sharePublic}));
}

/** Checkpoints contain only successful operation IDs, not QAE question text. */
export function createBatchCheckpoint(options={}){
  const {uid,groupId=null}=options;
  let storage=options.storage;
  if(!Object.hasOwn(options,'storage')){try{storage=globalThis.localStorage;}catch{storage=null;}}
  if(!uid)throw new Error('A signed-in user is required for batch checkpoints.');
  const key=`controlquest_batch_v${BATCH_IMPORT_VERSION}:${encodeURIComponent(uid)}:${encodeURIComponent(groupId||'personal')}`;
  let data={version:BATCH_IMPORT_VERSION,uid,groupId:groupId||null,completed:{}};
  let persistent=!!storage,lastError=null;
  try{
    const saved=JSON.parse(storage?.getItem(key)||'null');
    if(saved?.version===BATCH_IMPORT_VERSION&&saved.uid===uid&&(saved.groupId||null)===(groupId||null)&&saved.completed&&typeof saved.completed==='object')data=saved;
  }catch(error){persistent=false;lastError=String(error?.message||error);}
  return {key,uid,groupId:groupId||null,get persistent(){return persistent;},get lastError(){return lastError;},
    has:operationId=>!!data.completed[operationId],
    get:operationId=>data.completed[operationId]||null,
    markSuccess(operationId,metadata={}){
      data.completed[operationId]={completedAt:new Date().toISOString(),fileName:String(metadata.fileName||''),questionCount:Number(metadata.questionCount)||0};
      try{if(storage){storage.setItem(key,JSON.stringify(data));persistent=true;}else persistent=false;}
      catch(error){persistent=false;lastError=String(error?.message||error);}
      return persistent;
    },
    clear(){data={version:BATCH_IMPORT_VERSION,uid,groupId:groupId||null,completed:{}};try{storage?.removeItem?.(key);}catch(error){lastError=String(error?.message||error);persistent=false;}},
    snapshot:()=>JSON.parse(JSON.stringify(data))};
}

/** The caller performs persistence. Its importItem must be idempotent for operationId. */
export async function runBatchImport(plan,options={}){
  if(!plan?.items||!Array.isArray(plan.items))throw new Error('Create a batch preview first.');
  if(plan.running)throw new Error('This batch is already running.');
  const uid=options.uid||plan.uid,groupId=options.groupId??plan.groupId??null;
  if(!uid)throw new Error('Sign in before importing a batch.');
  if(plan.uid&&plan.uid!==uid)throw new Error('This batch belongs to another signed-in user. Create a new preview.');
  if((plan.groupId||null)!==(groupId||null))throw new Error('The active Guild changed. Create a new preview for this Guild.');
  if(typeof options.importItem!=='function')throw new Error('An import callback is required.');
  const checkpoint=options.checkpoint||createBatchCheckpoint({uid,groupId});
  if(checkpoint.uid!==uid||(checkpoint.groupId||null)!==(groupId||null))throw new Error('The checkpoint belongs to another user or Guild.');
  plan.running=true;plan.cancelled=false;
  const results=[];
  try{
    for(let index=0;index<plan.items.length;index++){
      const item=plan.items[index];
      if(item.include===false){results.push({id:item.id,status:'excluded'});continue;}
      if(aborted(options.signal)){plan.cancelled=true;item.status='cancelled';results.push({id:item.id,status:'cancelled'});continue;}
      const operationId=await batchOperationId(item,{uid,groupId});
      if(checkpoint.has(operationId)||item.completedOperationId===operationId){
        item.status='skipped';item.skipReason='Already imported for this user and Guild.';results.push({id:item.id,status:'skipped',operationId});
        options.onProgress?.({phase:'skipped',index,total:plan.items.length,item,plan});continue;
      }
      const errors=itemIssues(item,groupId);item.errors=errors;
      if(errors.length){item.status='blocked';results.push({id:item.id,status:'blocked',errors});options.onProgress?.({phase:'blocked',index,total:plan.items.length,item,plan});continue;}
      item.status='importing';item.error=null;options.onProgress?.({phase:'importing',index,total:plan.items.length,item,plan});
      try{
        const bundle=buildImportBundle({questions:item.questions,title:item.title.trim(),lessonId:item.lessonId||'',scope:item.scope,uid,groupId,importedBy:options.importedBy||'',source:item.source||BATCH_SOURCES[0]});
        const result=await options.importItem(item,{operationId,bundle,signal:options.signal});
        if(result===false||result?.success===false)throw new Error(result?.error||'The import was not saved.');
        checkpoint.markSuccess(operationId,{fileName:item.fileName,questionCount:item.questions.length});
        item.completedOperationId=operationId;item.status='complete';item.result=result??null;
        if(!checkpoint.persistent)item.warnings.push('Resume progress could not be saved on this device. Keep this preview open; server writes must remain idempotent.');
        results.push({id:item.id,status:'complete',operationId,result});
      }catch(error){
        item.status=error?.name==='AbortError'?'cancelled':'failed';item.error=String(error?.message||error);
        if(item.status==='cancelled')plan.cancelled=true;
        results.push({id:item.id,status:item.status,operationId,error:item.error});
      }
      plan.summary=summarize(plan.items);options.onProgress?.({phase:item.status,index,total:plan.items.length,item,plan});
    }
  }finally{plan.running=false;plan.summary=summarize(plan.items);}
  return {plan,results,summary:plan.summary,cancelled:plan.cancelled,checkpointPersistent:checkpoint.persistent};
}
