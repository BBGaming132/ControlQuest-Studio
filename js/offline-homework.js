export function streakSnapshot(stats={}){return Object.fromEntries(['streak','bestStreak','lastStreakDate','streakFreezes'].filter(key=>Object.hasOwn(stats,key)).map(key=>[key,stats[key]]));}
// Owner-scoped completion intent. Never equates local durability with cloud acknowledgment.
export function homeworkJournal(storage,uid){
 if(!uid)throw new Error('Sign in before saving lesson credit.');
 const key=`cq-homework-pending-${uid}`;
 const read=()=>{const raw=storage.getItem(key);if(!raw)return null;const value=JSON.parse(raw);if(value.uid!==uid||!value.homework||!value.savedAt)throw new Error('Saved lesson credit is invalid. Keep browser data.');return value;};
 return {read,save(homework,streak){const value={uid,homework:structuredClone({...homework,quizzes:undefined}),streak:streakSnapshot(streak||{}),savedAt:new Date().toISOString()};storage.setItem(key,JSON.stringify(value));return value;},clear(expected){if(storage.getItem(key)===JSON.stringify(expected))storage.removeItem(key);}};
}
export function pendingReviewEvents(storage,uid,groupId){
 const raw=storage.getItem(`cq-review-outbox-${uid}-${groupId||'solo'}`);if(!raw)return [];
 const entries=JSON.parse(raw);if(!Array.isArray(entries))throw new Error('Saved answers are invalid. Keep browser data.');
 return entries.filter(e=>e.card&&e.input).map(e=>({id:e.id,uid,cardId:e.card.id,scopeKey:e.card.scopeKey,studyIdentity:e.card.studyIdentity,rating:e.input.rating,correct:!Object.keys(e.card.choices||{}).length?e.input.rating!=='Again':e.input.selectedAnswer===e.card.correctAnswer,reviewedAt:e.input.reviewedAt||e.createdAt||new Date().toISOString(),pendingLocal:true}));
}

export function mergePendingHomework(current,pending){
 if((current.resetAt||null)!==(pending.resetAt||null))throw new Error('Study memory changed since offline completion. Keep the saved local work and review the reset before syncing.');
 return {...current,version:pending.version||current.version,enrolledAt:current.enrolledAt||pending.enrolledAt,completions:{...(pending.completions||{}),...(current.completions||{})}};
}
