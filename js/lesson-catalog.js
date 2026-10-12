import { ISACA_STUDY_PLAN } from './content.js';

const alternatives = {
  'd1-t01':['IS Audit Standards and Ethics','Audit Standards, Guidelines and Ethics'],
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
export const normalizeLessonName = value => String(value||'').toLowerCase()
  .replace(/&/g,' and ').replace(/post[ -]?implementation/g,'postimplementation')
  .replace(/end[ -]?point/g,'endpoint').replace(/[^a-z0-9]+/g,' ').trim();
export function matchLesson(value, domainId='') {
  const text=normalizeLessonName(value).replace(/^\d+[a-z]\d+\s*/,'');
  const candidates=LESSONS.filter(l=>!domainId||l.domainId===domainId).filter(l=>
    [l.id,l.title,...l.aliases].some(name=>{
      const n=normalizeLessonName(name);
      return text===n || (n.length>12 && (` ${text} `).includes(` ${n} `));
    }));
  return candidates.length===1?candidates[0]:null;
}
export function cardLesson(card) {
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
