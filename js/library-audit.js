/** Read-only planning over the signed-in visitor's loaded library. No database reads or writes. */
import {normalizeQuestion} from './flashcard-engine.js';
import {LESSONS,lessonMatchDetails} from './lesson-catalog.js';
export const exactQuestionIdentity=card=>JSON.stringify([normalizeQuestion(card?.question||''),Object.values(card?.choices||{}).map(normalizeQuestion).sort()]);
const answer=card=>normalizeQuestion(card?.choices?.[card.correctAnswer]||'');
const ref=card=>({id:card.id||'',scopeKey:card.scopeKey||'',scope:card.scope||'',lessonId:card.lessonId||'',answer:answer(card)});
function questionIndex(cards){const index=new Map();for(const card of cards||[]){if(!String(card?.question||'').trim())continue;const key=exactQuestionIdentity(card);if(!index.has(key))index.set(key,[]);index.get(key).push(card);}return index;}
export function auditIncomingQuestions(questions=[],existingCards=[],priorQuestions=[]){
 const existing=questionIndex(existingCards),prior=questionIndex(priorQuestions),seen=new Map();
 const result={existingDuplicates:0,batchDuplicates:0,newQuestions:0,answerConflicts:0,matches:[]};
 for(const card of questions){const key=exactQuestionIdentity(card),correct=answer(card),old=existing.get(key)||[],batch=[...(prior.get(key)||[]),...(seen.get(key)||[])];
  const exact=old.filter(c=>answer(c)===correct&&!!correct),batchExact=batch.filter(c=>answer(c)===correct&&!!correct);
  const conflicts=[...old,...batch].filter(c=>c.answerConflict===true||(answer(c)&&correct&&answer(c)!==correct));
  if(exact.length)result.existingDuplicates++;else if(batchExact.length)result.batchDuplicates++;else if(!conflicts.length)result.newQuestions++;
  if(conflicts.length)result.answerConflicts++;
  if(exact.length||batchExact.length||conflicts.length)result.matches.push({question:card.question,existing:exact.map(ref),batch:batchExact.map(ref),conflicts:conflicts.map(ref)});
  if(!seen.has(key))seen.set(key,[]);seen.get(key).push(card);
 }
 return result;
}
const domainOf=card=>/^d[1-5]$/.test(card?.domainId||'')?card.domainId:Number(card?.domainNumber)>=1&&Number(card?.domainNumber)<=5?`d${Number(card.domainNumber)}`:String(card?.domain||'').match(/\bdomain\s*([1-5])\b/i)?.[1]?.replace(/^(\d)$/,'d$1')||'';
function candidates(text){const match=lessonMatchDetails(text);return match.lesson?[match.lesson]:match.candidates;}
function evidence(card){if(card.categoryOverride)return {lesson:LESSONS.find(l=>l.id===card.lessonId)||null,status:LESSONS.some(l=>l.id===card.lessonId)?'matched':'unmatched',manual:true};const explicit=LESSONS.find(l=>l.id===card.lessonId);if(explicit)return {lesson:explicit,status:'matched'};
 const found=[...new Map([card.knowledgeStatement,card.sessionTitle].flatMap(candidates).map(l=>[l.id,l])).values()],domain=domainOf(card);
 if(found.length!==1)return {status:found.length?'ambiguous':'unmatched'};
 if(domain&&domain!==found[0].domainId)return {status:'ambiguous',reason:'Question domain conflicts with lesson evidence.'};return {lesson:found[0],status:'matched'};
}
function writable(entry,{uid,groupId}){if(entry.community||entry.scope==='Public'||entry.scopeKey==='public')return false;if(entry.scope==='Guild'||entry.scopeKey?.startsWith('guild_'))return !!groupId&&entry.scopeKey===`guild_${groupId}`&&(!entry.groupId||entry.groupId===groupId);return !!uid&&entry.scopeKey===`personal_${uid}`&&(!entry.ownerUid||entry.ownerUid===uid);}
export function auditLibrary({decks=[],cards=[],uid='',groupId=null}={}){
 const index=questionIndex(cards),duplicateGroups=[];
 for(const [identity,group] of index){if(group.length<2)continue;const answers=new Set(group.map(answer).filter(Boolean));duplicateGroups.push({identity,question:group[0].question,count:group.length,extraCopies:group.length-1,answerConflict:answers.size>1||group.some(card=>card.answerConflict===true),cards:group.map(ref)});}
 const operations=[],rows=[],cardEvidence=new Map(cards.map(c=>[c,evidence(c)]));
 const deckEvidence=new Map();
 for(const deck of decks){if(['master','missed'].includes(deck.kind))continue;
  const own=cards.filter(c=>c.scopeKey===deck.scopeKey&&c.deckIds?.includes(deck.id)),known=own.map(c=>cardEvidence.get(c).lesson).filter(Boolean),ids=new Set(known.map(l=>l.id)),named=candidates(deck.title),explicit=LESSONS.find(l=>l.id===deck.lessonId);
  let lesson=null,status='unmatched',reason='No unique canonical lesson match.';
  if(deck.categoryOverride){lesson=explicit||null;status=lesson?'matched':'unmatched';reason='Explicit category choice preserved.';}
  else if(ids.size>1||new Set(own.map(domainOf).filter(Boolean)).size>1){status='mixed';reason='Questions span several canonical lessons; their own categories are preserved.';}
  else if(own.some(c=>cardEvidence.get(c).status==='ambiguous')){status='ambiguous';reason='Question metadata conflicts or has several matches.';}
  else if(known.length===own.length&&known.length){lesson=known[0];status='matched';reason='All question lesson metadata agrees.';}
  else if(ids.size===1&&named.length===1&&known[0].id!==named[0].id){status='ambiguous';reason='Deck title and question lesson evidence disagree.';}
  else if(named.length===1&&(!ids.size||known[0].id===named[0].id)){lesson=named[0];status='matched';reason='Canonical deck title or supported alternative.';}
  else if(named.length>1){status='ambiguous';reason='Title contains several lesson names.';}
  else if(explicit){lesson=explicit;status='matched';reason='Existing canonical category preserved.';}
  if(lesson&&deck.domainId&&deck.domainId!==lesson.domainId&&!deck.categoryOverride){lesson=null;status='ambiguous';reason='Deck domain conflicts with proposed lesson.';}
  deckEvidence.set(deck,{lesson,status});rows.push({kind:'deck',id:deck.id,scopeKey:deck.scopeKey,title:deck.title,status,lessonId:lesson?.id||'',reason});
  if(lesson&&!deck.categoryOverride&&writable(deck,{uid,groupId})&&(deck.lessonId!==lesson.id||deck.domainId!==lesson.domainId))operations.push({kind:'deck',id:deck.id,scopeKey:deck.scopeKey,scope:deck.scope,patch:{lessonId:lesson.id,lessonTitle:lesson.title,domainId:lesson.domainId},reason});
 }
 for(const card of cards){let {lesson,status}=cardEvidence.get(card);let reason='Canonical question metadata.';
  if(!lesson&&status!=='ambiguous'&&!card.categoryOverride){
   const linked=decks.filter(d=>d.scopeKey===card.scopeKey&&card.deckIds?.includes(d.id)&&!['master','missed'].includes(d.kind)).map(d=>deckEvidence.get(d)).filter(Boolean);
   const possible=[...new Map(linked.filter(d=>d.status==='matched'&&d.lesson).map(d=>[d.lesson.id,d.lesson])).values()];
   if(possible.length===1&&!linked.some(d=>['mixed','ambiguous'].includes(d.status))){lesson=possible[0];status='matched';reason='Unambiguous containing lesson deck.';}else if(possible.length>1)status='ambiguous';
  }
  if(lesson&&domainOf(card)&&domainOf(card)!==lesson.domainId){lesson=null;status='ambiguous';reason='Question domain conflicts with lesson evidence.';}
  rows.push({kind:'card',id:card.id,scopeKey:card.scopeKey,status,lessonId:lesson?.id||'',reason});
  if(lesson&&!card.categoryOverride&&writable(card,{uid,groupId})&&(card.lessonId!==lesson.id||card.domainId!==lesson.domainId))operations.push({kind:'card',id:card.id,scopeKey:card.scopeKey,scope:card.scope,patch:{lessonId:lesson.id,lessonTitle:lesson.title,domainId:lesson.domainId,domainNumber:Number(lesson.domainId.slice(1))},reason});
 }
 const categorization={operations,rows,...Object.fromEntries(['matched','ambiguous','unmatched','mixed'].map(status=>[status,rows.filter(r=>r.status===status).length]))};
 return {summary:{decks:decks.length,cards:cards.length,uniqueQuestions:index.size,duplicateGroups:duplicateGroups.length,extraCopies:duplicateGroups.reduce((n,g)=>n+g.extraCopies,0),answerConflicts:duplicateGroups.filter(g=>g.answerConflict).length,proposedCategories:operations.length},duplicateGroups,categorization,limitations:'Only the signed-in visitor’s loaded Personal, active Guild and Public library is audited. Other private accounts and unloaded Firebase records cannot be inspected. This plan does not delete or merge records.'};
}
