export function nextPacificReset(now=Date.now()){
 const date=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Los_Angeles',year:'numeric',month:'2-digit',day:'2-digit'});
 const today=date.format(new Date(now));let low=Number(now),high=low+27*60*60*1000;
 while(high-low>1000){const mid=Math.floor((high+low)/2);if(date.format(new Date(mid))===today)low=mid;else high=mid;}
 return new Date(Math.ceil(high/1000)*1000+60000).toISOString();
}
const quotaError=error=>/resource-exhausted/.test(error?.code||'')||/resource-exhausted|quota.*exceed|exceed.*quota/i.test(error?.message||String(error));
// Review IDs must also be idempotent at the remote save boundary: a browser can
// close after the server commits but before it removes the local receipt.
export function createReviewOutbox({storage,key,save,onChange=()=>{},stallAfterMs=30000,now=()=>Date.now()}){
  if(!storage||typeof key!=='string'||!key||typeof save!=='function')throw new Error('Review storage is unavailable.');
  const clone=value=>JSON.parse(JSON.stringify(value));
  const read=storage.getItem(key);
  let lastStored=read;
  let entries=read?JSON.parse(read):[];
  if(!Array.isArray(entries)||entries.some(e=>!e||typeof e.id!=='string'||!e.id||!e.card||!e.input||!['pending','failed'].includes(e.state))||new Set(entries.map(e=>e.id)).size!==entries.length)throw new Error('Saved review queue is invalid. Keep this browser’s data and retry.');
  let running=null,paused=false,stalled=false,retryTimer;
  const completed=new Map();
  const list=()=>clone(entries);
  const notify=()=>{try{onChange(list());}catch{/* Rendering cannot discard a saved answer. */}};
  const commit=next=>{
    // Do not let a stale tab overwrite answers added by another tab. Web
    // Storage has no atomic compare-and-swap; truly simultaneous writers can
    // still race, so one active study tab remains the supported model.
    if(storage.getItem(key)!==lastStored)throw new Error('Another tab changed the saved answer queue. Reload this tab before continuing.');
    const raw=JSON.stringify(next);storage.setItem(key,raw);lastStored=raw;entries=next;
  };
  // Older builds kept quota failures indefinitely without a retry date. Probe
  // once on upgrade: their failure may predate today's reset. The durable
  // pending state preserves every answer; a fresh quota response sets cooldown.
  if(entries.some(e=>e.state==='failed'&&!e.retryAt&&quotaError(e.error))){
    commit(entries.map(e=>e.state==='failed'&&!e.retryAt&&quotaError(e.error)?{...e,state:'pending',quotaPaused:false}:e));
  }
  const fail=(id,error)=>{
    const next=entries.map(e=>e.id===id?{...e,state:'failed',error:error?.message||String(error),...(quotaError(error)?{retryAt:nextPacificReset(now()),quotaPaused:true}:{})}:e);
    // If local storage itself failed, the old durable pending record survives
    // for a reload. Keep the failure visible in this tab and stop retrying.
    try{commit(next);}catch{entries=next;}
    notify();
  };
  async function drain(){
    while(!paused&&entries.length){
      const entry=entries[0];
      if(entry.state==='failed')break;
      let watchdog;
      try{
        stalled=false;
        watchdog=setTimeout(()=>{stalled=true;notify();},stallAfterMs);
        watchdog.unref?.();
        await save(clone(entry));
        clearTimeout(watchdog);stalled=false;
        commit(entries.filter(e=>e.id!==entry.id));
        completed.set(entry.id,entry);
        notify();
      }catch(error){clearTimeout(watchdog);stalled=false;fail(entry.id,error);break;}
    }
  }
  function scheduleRetry(){
    clearTimeout(retryTimer);retryTimer=null;
    const first=entries[0];if(paused||!first?.retryAt)return;
    const delay=Date.parse(first.retryAt)-now();
    retryTimer=setTimeout(()=>{retryTimer=null;retry().catch(()=>{});},Math.max(0,Math.min(delay,2147483647)));retryTimer.unref?.();
  }
  function start(){
    scheduleRetry();
    if(!running&&!paused&&entries.length&&entries[0].state!=='failed'){
      running=Promise.resolve().then(drain).finally(()=>{running=null;return start();});
    }
    return running||Promise.resolve();
  }
  function enqueue(value){
    const record=clone({id:value?.id,card:value?.card,input:{...value?.input,reviewedAt:value?.input?.reviewedAt||new Date(now()).toISOString()},state:'pending'});
    if(!value?.input||typeof record.id!=='string'||!record.id||!record.card||!record.input)throw new Error('A review needs an ID, question, and answer.');
    const existing=entries.find(e=>e.id===record.id)||completed.get(record.id);
    if(existing)return clone(existing);
    commit([...entries,record]);
    notify();start();
    return clone(record);
  }
  function retry(){
    if(entries[0]?.retryAt&&Date.parse(entries[0].retryAt)>now()){scheduleRetry();notify();return Promise.resolve();}
    commit(entries.map(({error,retryAt,quotaPaused,...entry})=>({...entry,state:'pending'})));
    paused=false;notify();return start();
  }
  // Pausing prevents an old account/Guild queue from starting further writes.
  // An already-started save still owns its context checks and may finish.
  function pause(){paused=true;clearTimeout(retryTimer);}
  function resume(){paused=false;return start();}
  start();
  return {enqueue,list,retry,pause,resume,isStalled:()=>stalled,idle:()=>running||Promise.resolve()};
}
