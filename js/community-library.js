import { cleanSharedExplanation } from './qae-parser.js';
import { sha256Hex } from './runtime-crypto.js';
import { LESSONS, cardLesson, deckLesson } from './lesson-catalog.js';

export const normalizeCommunityText = value => String(value||'').normalize('NFKC').toLowerCase().replace(/\s+/g,' ').trim();
// Compare answer text, not option letters: QAE exports can reorder the choices.
export function communityQuestionKey(card) {
  return JSON.stringify([normalizeCommunityText(card.question),Object.values(card.choices||{}).map(normalizeCommunityText).sort()]);
}
const digest=sha256Hex;

export async function buildPublicContributions({deck,cards,uid,name}) {
  const fallback=deckLesson(deck);
  const contributions=new Map();
  for(const card of [...cards].sort((a,b)=>String(a.updatedAt||a.importedAt||'').localeCompare(String(b.updatedAt||b.importedAt||'')))){
    const lesson=deck.categoryOverride?fallback:cardLesson(card)||fallback;
    if(!lesson||!card.question?.trim())continue;
    const identity=communityQuestionKey(card);
    const fingerprint=await digest(identity);
    const sourceKey=`${deck.scopeKey}|${deck.id}`;
    // Reclassifying the source updates the same submission instead of leaving a copy in the old lesson.
    const id=await digest(`${uid}|${sourceKey}|${fingerprint}`);
    contributions.set(id,{id,ownerUid:uid,contributorName:name||'Member',sourceKey,sourceTitle:deck.title,
      sourceUploader:deck.createdBy||name||'Member',lessonId:lesson.id,fingerprint,identity,
      question:card.question,choices:card.choices||{},correctAnswer:card.correctAnswer||'',justifications:Object.fromEntries(Object.entries(card.justifications||{}).map(([key,value])=>[key,cleanSharedExplanation(value)])),
      source:card.source||'Study contribution',updatedAt:new Date().toISOString()});
  }
  return [...contributions.values()];
}
export function aggregateCommunityLibrary(contributions=[],statuses={}) {
  const groups=new Map();
  for(const original of [...contributions].sort((a,b)=>a.id.localeCompare(b.id))){
    const item={...original,justifications:Object.fromEntries(Object.entries(original.justifications||{}).map(([key,value])=>[key,cleanSharedExplanation(value)]))};
    const lesson=LESSONS.find(l=>l.id===item.lessonId);if(!lesson||!item.question)continue;
    const identity=communityQuestionKey(item);const key=JSON.stringify([lesson.id,identity]);
    if(!groups.has(key))groups.set(key,{lesson,items:[]});
    groups.get(key).items.push(item);
  }
  const cards=[],decks=new Map();
  for(const {lesson,items} of groups.values()){
    const first=items[0],deckId=`community_${lesson.id}`;
    const variants=items.map(c=>({id:c.id,contributorName:c.contributorName,sourceTitle:c.sourceTitle,
      sourceUploader:c.sourceUploader,question:c.question,choices:c.choices,correctAnswer:c.correctAnswer,justifications:c.justifications}));
    const answers=new Set(items.map(c=>normalizeCommunityText(c.choices?.[c.correctAnswer]||c.justifications?._||'')));
    const explanations=new Set(items.map(c=>JSON.stringify(Object.entries(c.choices||{}).map(([letter,text])=>[normalizeCommunityText(text),normalizeCommunityText(c.justifications?.[letter])]).sort((a,b)=>a[0].localeCompare(b[0])))));
    cards.push({id:`community_${lesson.id}_${first.fingerprint}`,scope:'Public',scopeKey:'public',deckIds:[deckId],
      question:first.question,choices:first.choices,correctAnswer:first.correctAnswer,justifications:first.justifications,
      lessonId:lesson.id,lessonTitle:lesson.title,domain:lesson.domain,domainNumber:lesson.domainId==='practice'?null:Number(lesson.domainId.slice(1)),
      source:'Community lesson',contributors:[...new Set(items.map(c=>c.contributorName))],variants,
      submissionCount:items.length,answerConflict:answers.size>1,explanationDifferences:explanations.size>1});
    if(!decks.has(deckId))decks.set(deckId,{id:deckId,title:`${lesson.domain} · ${lesson.title}`,scope:'Public',scopeKey:'public',
      kind:'lesson',community:true,lessonId:lesson.id,lessonTitle:lesson.title,createdBy:'Community',contributors:[],cardCount:0,submissionCount:0,
      description:'Combined community submissions. Duplicate questions appear once; differing answers and explanations can be compared.'});
    const deck=decks.get(deckId);deck.cardCount++;deck.submissionCount+=items.length;
    deck.contributors=[...new Set([...deck.contributors,...items.map(c=>c.contributorName)])];
  }
  return {decks:[...decks.values()],cards,publicLessonStatus:statuses};
}
