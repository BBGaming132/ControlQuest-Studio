// Shuffle presentation only; canonical answer keys remain attached to their text.
export function shuffle(items,random=Math.random){const out=[...items];for(let i=out.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[out[i],out[j]]=[out[j],out[i]];}return out;}
export function choiceOrder(card,random=Math.random){const keys=Object.keys(card.choices||{});return /\b(all|none) of the above\b|\b[A-D] and [A-D]\b/i.test(Object.values(card.choices||{}).join(' '))?keys:shuffle(keys,random);}
export function clockLabel(ms){const seconds=Math.max(0,Math.floor((Number(ms)||0)/1000));return `${Math.floor(seconds/60)}:${String(seconds%60).padStart(2,'0')}`;}

// Older saved queues have no boundary metadata. Their first repeated card marks
// the first review pass; each original pass contains unique study identities.
export function inferInitialCount(queue=[]){
 const seen=new Set();
 for(let i=0;i<queue.length;i++){
  const card=queue[i];const key=typeof card==='string'?card:card.studyIdentity||`${card.scopeKey}|${card.id}`;
  if(seen.has(key))return i;
  seen.add(key);
 }
 return queue.length;
}
export function sessionProgress({total=0,initialCount=total,index=0,answered=false}={}){
 const count=value=>Math.max(0,Math.floor(Number(value)||0));
 total=count(total);initialCount=Math.min(total,count(initialCount));
 const completed=Math.min(total,count(index)+(answered?1:0));
 const initialDone=Math.min(initialCount,completed),reviewTotal=total-initialCount,reviewDone=Math.max(0,completed-initialCount);
 return {total,initialCount,completed,initialDone,reviewTotal,reviewDone,remaining:total-completed,currentType:index>=total?'complete':index>=initialCount?'review':'lesson'};
}
export function renderSessionProgress(options){
 const p=sessionProgress(options);
 const segment=(type,total,done)=>total?`<span class="cq-session-segment cq-session-${type}" style="flex-grow:${total}" data-total="${total}" data-completed="${done}"><i style="width:${done/total*100}%"></i></span>`:'';
 const caption=`Lesson ${p.initialDone} of ${p.initialCount}; review ${p.reviewDone} of ${p.reviewTotal}; ${p.remaining} questions remaining in this queue`;
 return `<div class="cq-session-progress"><div class="cq-session-track" role="progressbar" aria-label="Lesson and review questions" aria-valuemin="0" aria-valuemax="${Math.max(1,p.total)}" aria-valuenow="${p.completed}" aria-valuetext="${caption}">${segment('lesson',p.initialCount,p.initialDone)}${segment('review',p.reviewTotal,p.reviewDone)}</div><div class="cq-session-legend"><span class="cq-session-lesson-label">Lesson ${p.initialDone} / ${p.initialCount}</span><span class="cq-session-review-label">Review ${p.reviewDone} / ${p.reviewTotal}</span><span class="cq-session-current">${p.currentType==='complete'?'Queue complete':p.currentType==='review'?'Review question':'Lesson question'}</span></div></div>`;
}
