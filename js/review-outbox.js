// Review IDs must also be idempotent at the remote save boundary: a browser can
// close after the server commits but before it removes the local receipt.
export function createReviewOutbox({storage,key,save,onChange=()=>{},stallAfterMs=30000}){
  if(!storage||typeof key!=='string'||!key||typeof save!=='function')throw new Error('Review storage is unavailable.');
  const clone=value=>JSON.parse(JSON.stringify(value));
  const read=storage.getItem(key);
  let lastStored=read;
  let entries=read?JSON.parse(read):[];
  if(!Array.isArray(entries)||entries.some(e=>!e||typeof e.id!=='string'||!e.id||!e.card||!e.input||!['pending','failed'].includes(e.state))||new Set(entries.map(e=>e.id)).size!==entries.length)throw new Error('Saved review queue is invalid. Keep this browser’s data and retry.');
  let running=null,paused=false,stalled=false;
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
  const fail=(id,error)=>{
    const next=entries.map(e=>e.id===id?{...e,state:'failed',error:error?.message||String(error)}:e);
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
  function start(){
    if(!running&&!paused&&entries.length&&entries[0].state!=='failed'){
      running=Promise.resolve().then(drain).finally(()=>{running=null;return start();});
    }
    return running||Promise.resolve();
  }
  function enqueue(value){
    const record=clone({id:value?.id,card:value?.card,input:value?.input,state:'pending'});
    if(typeof record.id!=='string'||!record.id||!record.card||!record.input)throw new Error('A review needs an ID, question, and answer.');
    const existing=entries.find(e=>e.id===record.id)||completed.get(record.id);
    if(existing)return clone(existing);
    commit([...entries,record]);
    notify();start();
    return clone(record);
  }
  function retry(){
    commit(entries.map(({error,...entry})=>({...entry,state:'pending'})));
    paused=false;notify();return start();
  }
  // Pausing prevents an old account/Guild queue from starting further writes.
  // An already-started save still owns its context checks and may finish.
  function pause(){paused=true;}
  function resume(){paused=false;return start();}
  start();
  return {enqueue,list,retry,pause,resume,isStalled:()=>stalled,idle:()=>running||Promise.resolve()};
}
