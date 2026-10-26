import { ISACA_STUDY_PLAN } from './content.js';

const alternatives = {
  'd1-t01':['IS Audit Standards and Ethics','Audit Standards, Guidelines and Ethics'],
  'd2-t03':['IT Policies, Standards, Procedures and Practices'],
  'd3-t08':['Post Implementation Review','Post-implementation Review'],
  'd4-t05':['End User Computing and Shadow IT'],
  'd4-t12':['BIA'], 'd4-t15':['Business Continuity Planning','BCP'],
  'd4-t16':['Disaster Recovery Planning','DRP'],
  'd5-t03':['Identity & Access Management','IAM'],
  'd5-t04':['Network and Endpoint Security'], 'd5-t05':['DLP'],
  'd5-t07':['PKI'], 'd5-t09':['Mobile Wireless and IoT Devices']
};
export const LESSONS = ISACA_STUDY_PLAN.flatMap(d => d.topics.map(t => ({
  ...t, domainId:d.id, domain:d.domain, domainName:d.name,
  aliases:[t.title.replace(/\band\b/g,'&'), ...(alternatives[t.id]||[])]
})));
export const normalizeLessonName = value => String(value||'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase()
  .replace(/&/g,' and ').replace(/post[ -]?implementation/g,'postimplementation')
  .replace(/end[ -]?point/g,'endpoint').replace(/[^a-z0-9]+/g,' ').trim();
// A filename may contain a date/export suffix. Only small spelling errors in a full
// distinctive title are accepted; short acronyms and partial titles stay exact-only.
const matchText=value=>normalizeLessonName(String(value||'').replace(/\.(docx|txt|md)$/i,''))
  .replace(/^\d+[a-z]\d+\s*/,'');
const filenameText=value=>matchText(value)
  .replace(/^(?:(?:isaca|qae|export|domain\s*[1-5])\s*)+/,'')
  .replace(/\s+(?:qae|export|questions|flashcards|copy)(?:\s+\d+)?$/,'')
  .replace(/\s+\d{4}\s+\d{1,2}\s+\d{1,2}$/,'').trim();
function spellingDistance(a,b){
  if(Math.abs(a.length-b.length)>4)return 99;
  let previous=Array.from({length:b.length+1},(_,i)=>i),before=null;
  for(let i=1;i<=a.length;i++){
    const row=[i];for(let j=1;j<=b.length;j++){
      row[j]=Math.min(row[j-1]+1,previous[j]+1,previous[j-1]+(a[i-1]===b[j-1]?0:1));
      if(i>1&&j>1&&a[i-1]===b[j-2]&&a[i-2]===b[j-1])row[j]=Math.min(row[j],before[j-2]+1);
    }before=previous;previous=row;
  }return previous[b.length];
}
export function lessonMatchDetails(value, domainId='') {
  const text=matchText(value),embeddedDomain=text.match(/\bdomain\s*([1-5])\b/)?.[1],scope=domainId||(embeddedDomain?`d${embeddedDomain}`:'');
  if(domainId&&embeddedDomain&&domainId!==`d${embeddedDomain}`)return {lesson:null,candidates:[],method:'conflict',confidence:0};
  const pool=LESSONS.filter(l=>!scope||l.domainId===scope);
  if(!text)return {lesson:null,candidates:[],method:'none',confidence:0};
  const exact=pool.filter(l=>[l.id,l.title,...l.aliases].some(name=>{
    const n=normalizeLessonName(name);return text===n||(n.length>12&&(` ${text} `).includes(` ${n} `));
  }));
  if(exact.length)return {lesson:exact.length===1?exact[0]:null,candidates:exact,method:exact.length===1?'exact':'ambiguous',confidence:exact.length===1?1:0};
  const clean=filenameText(value);
  if(clean.length<12||clean.split(' ').length<2)return {lesson:null,candidates:[],method:'none',confidence:0};
  const scored=pool.map(lesson=>({lesson,score:Math.max(...[lesson.title,...lesson.aliases].map(name=>{
    const n=normalizeLessonName(name);if(n.length<12)return 0;
    const distance=spellingDistance(clean,n),limit=Math.min(3,Math.max(1,Math.floor(n.length*.06)));
    return distance<=limit?1-distance/Math.max(n.length,clean.length):0;
  }))})).filter(row=>row.score>=.94).sort((a,b)=>b.score-a.score);
  const confident=scored.length===1||(scored.length>1&&scored[0].score-scored[1].score>=.04);
  return {lesson:confident?scored[0]?.lesson||null:null,candidates:scored.map(row=>row.lesson),method:scored.length?(confident?'spelling':'ambiguous'):'none',confidence:confident?scored[0]?.score||0:0};
}
export function matchLesson(value, domainId='') { return lessonMatchDetails(value,domainId).lesson; }
export function cardLesson(card) {
  if(card.categoryOverride)return LESSONS.find(l=>l.id===card.lessonId)||null;
  return LESSONS.find(l=>l.id===card.lessonId) || matchLesson(card.knowledgeStatement, card.domainNumber?`d${card.domainNumber}`:'') || matchLesson(card.sessionTitle);
}
export function deckLesson(deck) {
  if(Object.hasOwn(deck,'lessonId'))return LESSONS.find(l=>l.id===deck.lessonId)||null;
  return (!['master','missed'].includes(deck.kind)?matchLesson(deck.title):null);
}
export function filterDeckCards(cards, filters={}) {
  return cards.filter(c=>{
    const lesson=cardLesson(c);
    const domainId=lesson?.domainId || (c.domainNumber?`d${c.domainNumber}`:String(c.domain||'').match(/Domain\s*(\d)/i)?.[1]?.replace(/^(\d)$/,'d$1'));
    return (!filters.domain||domainId===filters.domain) && (!filters.lesson||lesson?.id===filters.lesson);
  });
}
export function filterDecks(decks, cards, filters={}) {
  const result=decks.filter(d=>{
    const lesson=deckLesson(d);
    const own=cards.filter(c=>c.scopeKey===d.scopeKey&&c.deckIds?.includes(d.id));
    const effective=own.map(c=>d.categoryOverride?{...c,lessonId:d.lessonId||'',knowledgeStatement:'',sessionTitle:'',domainNumber:/^d[1-5]$/.test(d.domainId||'')?Number(d.domainId.slice(1)):null,domain:''}:cardLesson(c)?c:{...c,lessonId:lesson?.id||'',domainNumber:/^d[1-5]$/.test(d.domainId||'')?Number(d.domainId.slice(1)):c.domainNumber});
    const matching=filterDeckCards(effective,filters);
    const text=normalizeLessonName([d.title,d.description,d.createdBy,...(d.contributors||[]),...(d.tags||[]),lesson?.title,...(lesson?.aliases||[])].join(' '));
    return (!filters.category||(filters.category==='unlinked'?!lesson&&!['master','missed'].includes(d.kind):!!lesson)) && (!filters.scope||filters.scope==='All'||d.scope===filters.scope) && (!filters.kind||d.kind===filters.kind) &&
      (!filters.search||text.includes(normalizeLessonName(filters.search))) &&
      ((!filters.domain&&!filters.lesson)||matching.length>0||((!filters.domain||(lesson?.domainId||d.domainId)===filters.domain)&&(!filters.lesson||lesson?.id===filters.lesson)));
  });
  if(filters.sort==='title')result.sort((a,b)=>a.title.localeCompare(b.title));
  if(filters.sort==='domain')result.sort((a,b)=>(deckLesson(a)?.id||'z').localeCompare(deckLesson(b)?.id||'z')||a.title.localeCompare(b.title));
  return result;
}

export function inferDeckLesson(deck,cards=[]){
  if(deck.categoryOverride)return deckLesson(deck);
  const named=deckLesson(deck);if(named)return named;
  const own=cards.filter(c=>c.scopeKey===deck.scopeKey&&c.deckIds?.includes(deck.id));
  const lessons=own.map(cardLesson);
  if(!lessons.length||lessons.some(l=>!l))return null;
  const ids=new Set(lessons.map(l=>l.id));return ids.size===1?lessons[0]:null;
}
