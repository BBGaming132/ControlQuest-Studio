// Portable, idempotent activity events. No question text, credentials, or paid content.
export function appendActivityEvent(journal,event){
  if(!event?.id||!event.type)throw new Error('Activity needs an ID and type.');
  if((journal||[]).some(e=>e.id===event.id))return journal;
  return [...(journal||[]),{schemaVersion:1,source:'controlquest',...event}].slice(-500);
}
export function exportActivityJournal(events,uid){
  return {schemaVersion:1,source:'controlquest',subject:uid,exportedAt:new Date().toISOString(),events:(events||[]).slice(-500),retention:'Most recent 500 activity events; lifetime learning totals remain in progress records.',integration:{target:'Everstead',status:'adapter-ready',note:'Import by event ID. A receiving API must verify events before minting shared currency.'}};
}
