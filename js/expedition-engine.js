/** Pure study-powered campaign. Call study-answer only after saving the learner's real review.
 * The enclosing world transaction owns authentication, the shared resource balance and concurrency.
 * Replay protection retains the latest 512 command IDs; the world adapter has its own receipt window.
 */
export const EXPEDITION_SCHEMA_VERSION=1;
export const EXPEDITION_JOBS=Object.freeze({
  gather:{title:'Supply the expedition',target:3,description:'Your next recalls send the crew for timber and starlight.'},
  build:{title:'Raise an island outpost',target:4,description:'Recall to build. An outpost uses two timber and one starlight.'},
  sail:{title:'Sail to the next island',target:6,description:'Your recalls fill the sails and carry the crew across the chart.'},
  defend:{title:'Defend the expedition',target:4,description:'Use what you know to repel the pirates and secure your arrival.'}
});
const jobs=['gather','build','sail','defend'];
const destinations=['Cloudcap Cay','Coral Lantern Atoll','Moonwake Harbor','Skyglass Isle','Tideflower Keys','Stormbell Ridge','Sunward Anchorage','Starlit Reach'];
const own=(object,key)=>typeof key==='string'&&Object.hasOwn(object,key);
const integer=(value,min=0,max=10000000)=>{const n=Number(value);return Number.isFinite(n)?Math.max(min,Math.min(max,Math.floor(n))):min;};
const cleanId=value=>typeof value==='string'&&value.trim().length>0&&value.length<=250&&!['__proto__','prototype','constructor'].includes(value);
const statKeys=['answers','correct','incorrect','arrivals','victories','builds','gathered','voyages','repairs'];
const text=(value,max=350)=>typeof value==='string'?value.slice(0,max):'';
const copy=value=>JSON.parse(JSON.stringify(value));
export function createExpedition(saved={}){
  const source=saved&&typeof saved==='object'&&!Array.isArray(saved)?saved:{};
  if(Number(source.schemaVersion)>EXPEDITION_SCHEMA_VERSION)throw new Error('This expedition was saved by a newer version. Reload the latest app before playing.');
  const valid=source.schemaVersion===1?source:{};
  const routeIndex=integer(valid.routeIndex),legIndex=integer(valid.legIndex,0,3);
  const state={schemaVersion:1,chapter:1+Math.floor(routeIndex/4),routeIndex,legIndex,activeJob:own(EXPEDITION_JOBS,valid.activeJob)?valid.activeJob:jobs[legIndex],
    power:['balanced','shields','engines','weapons'].includes(valid.power)?valid.power:'balanced',routeChoice:['charted','hazard'].includes(valid.routeChoice)?valid.routeChoice:'charted',
    work:Object.fromEntries(jobs.map(job=>[job,integer(valid.work?.[job],0,EXPEDITION_JOBS[job].target)])),
    stores:{timber:integer(valid.stores?.timber),crystal:integer(valid.stores?.crystal),coins:integer(valid.stores?.coins)},
    fleet:{hull:valid.fleet?.hull===undefined?100:integer(valid.fleet.hull,40,100),maxHull:100,guard:integer(valid.fleet?.guard,0,10),buildings:integer(valid.fleet?.buildings)},
    repairs:integer(valid.repairs,0,6),stats:Object.fromEntries(statKeys.map(key=>[key,integer(valid.stats?.[key])])),
    receipts:Array.isArray(valid.receipts)?[...new Set(valid.receipts.filter(cleanId))].slice(-512):[],
    log:Array.isArray(valid.log)?valid.log.filter(entry=>entry&&typeof entry.message==='string').slice(-12).map(entry=>({message:text(entry.message),tone:text(entry.tone,20)||'info',turn:integer(entry.turn)})):[],
    lastFeedback:null,
    legacyMilestones:integer(valid.legacyMilestones??source.summits)
  };
  if(valid.lastFeedback&&typeof valid.lastFeedback.message==='string')state.lastFeedback={message:text(valid.lastFeedback.message),tone:text(valid.lastFeedback.tone,20)||'info'};
  return state;
}
export function expeditionSummary(saved){
  const e=createExpedition(saved),job=e.activeJob,spec=EXPEDITION_JOBS[job],required=jobs[e.legIndex];
  const blocked=job==='build'&&(e.stores.timber<2||e.stores.crystal<1);
  return {
    chapter:e.chapter,route:{name:`The ${['Lantern','Coral','Cloud','Starlight'][e.chapter%4]} Passage`,destination:destinations[e.routeIndex%destinations.length],index:e.routeIndex,chart:1+Math.floor(e.routeIndex/destinations.length),leg:e.legIndex+1,legs:4},
    objective:{job,title:spec.title,description:spec.description,progress:e.work[job],target:spec.target,pct:Math.round(e.work[job]/spec.target*100),blocked,requiredJob:required},
    nextObjective:blocked?'Gather two timber and one starlight, then finish the outpost.':e.repairs?`Repair ${e.repairs} ${e.repairs===1?'setback':'setbacks'} while recalling the next questions.`:spec.description,
    ship:{...e.fleet},enemy:{active:e.legIndex===3,hp:e.legIndex===3?Math.max(0,4-e.work.defend)*10:0,maxHp:40,name:'The Fogbound Corsairs'},
    repairs:e.repairs,stores:{...e.stores},needsQuestion:true,availableJobs:jobs.filter(value=>(value!=='defend'||e.legIndex===3)&&(value!=='sail'||e.legIndex===2)),
    explanation:'Choose what your crew is working on, then answer a study question. Correct recalls do two work; repairs use one. Misses delay the expedition, and later correct recalls repair it. Completed outposts and your card mastery stay safe.'
  };
}
export function advanceExpedition(saved,event={}){
  const expedition=createExpedition(saved),before=copy(expedition);
  const reject=message=>({expedition:before,changed:false,feedback:{tone:'hint',message},deltas:[],needsQuestion:false,nextObjective:expeditionSummary(before).nextObjective});
  if(!cleanId(event.id))return reject('A saved expedition command needs a unique event ID.');
  if(expedition.receipts.includes(event.id))return {...reject('That expedition turn is already saved.'),duplicate:true};
  let message='',tone='progress';
  if(event.type==='tactic'){
    if(!['power','routeChoice'].includes(event.setting))return reject('Choose a ship system or route.');
    const allowed=event.setting==='power'?['balanced','shields','engines','weapons']:['charted','hazard'];
    if(!allowed.includes(event.value))return reject('Choose an available tactical option.');
    if(event.setting==='routeChoice'&&(expedition.legIndex!==0||expedition.work.gather>0))return reject('Choose your route before beginning its supply stage.');
    if(expedition[event.setting]===event.value)return reject('This order is already active.');
    expedition[event.setting]=event.value;message=event.setting==='power'?`Power routed to ${event.value}. The next saved recall advances the ship.`:`Route chosen: ${event.value==='hazard'?'Storm passage: greater damage, double victory coins':'Charted waters: standard risk and rewards'}.`;
  }else if(event.type==='assign'){
    if(!own(EXPEDITION_JOBS,event.job))return reject('Choose gathering, construction, sailing or defense.');
    if(event.job==='sail'&&expedition.legIndex!==2)return reject('Gather supplies and raise the route outpost before setting sail.');
    if(event.job==='defend'&&expedition.legIndex!==3)return reject('There are no pirates here. Finish the route preparations and sail to their waters first.');
    if(expedition.activeJob===event.job)return reject('Your crew is already assigned here. Answer a question to advance their work.');
    expedition.activeJob=event.job;message=`Crew assigned: ${EXPEDITION_JOBS[event.job].title}. Answer the next study question to begin.`;
  }else if(event.type==='study-answer'){
    if(typeof event.correct!=='boolean')return reject('Save a correct or incorrect study result before advancing the expedition.');
    expedition.stats.answers++;
    if(!event.correct){
      expedition.stats.incorrect++;expedition.repairs=Math.min(6,expedition.repairs+1);
      const damage=Math.max(1,8-expedition.fleet.guard+(expedition.routeChoice==='hazard'?4:0)-(expedition.power==='shields'?5:0));const oldHull=expedition.fleet.hull;
      expedition.fleet.hull=Math.max(40,oldHull-damage);
      message=`A rough current delayed the crew${expedition.fleet.hull<oldHull?`: hull −${oldHull-expedition.fleet.hull}`:''}. Read the explanation; your next correct recalls repair the setback. Your completed outposts stay safe.`;tone='setback';
    }else{
      expedition.stats.correct++;
      const repairing=expedition.repairs>0;
      if(repairing){expedition.repairs--;expedition.stats.repairs++;expedition.fleet.hull=Math.min(100,expedition.fleet.hull+10);}
      const job=expedition.activeJob,spec=EXPEDITION_JOBS[job],work=repairing?1:expedition.power==='engines'&&job==='sail'||expedition.power==='weapons'&&job==='defend'?3:expedition.power==='shields'?1:2;
      expedition.work[job]=Math.min(spec.target,expedition.work[job]+work);
      const notes=[repairing?'A correct recall repaired one setback and advanced the crew.':`Correct recall: your crew advanced ${work} work with ${expedition.power} power.`];
      if(expedition.work[job]>=spec.target){
        if(job==='build'&&(expedition.stores.timber<2||expedition.stores.crystal<1)){
          notes.push('The foundation is ready. Gather two timber and one starlight to finish it.');expedition.activeJob='gather';
        }else{
          finishJob(expedition,job,notes);
          // A gathered delivery can finish a previously prepared foundation in this same verified turn.
          if(job==='gather'&&expedition.work.build>=EXPEDITION_JOBS.build.target&&expedition.stores.timber>=2&&expedition.stores.crystal>=1)finishJob(expedition,'build',notes);
        }
      }
      message=notes.join(' ');tone=expedition.stats.arrivals>before.stats.arrivals?'arrival':expedition.stats.builds>before.stats.builds?'build':repairing?'repair':'progress';
    }
  }else return reject('Choose a crew job or save a study answer.');
  expedition.receipts=[...expedition.receipts,event.id].slice(-512);
  expedition.lastFeedback={tone,message};
  expedition.log=[...expedition.log,{tone,message,turn:expedition.stats.answers}].slice(-12);
  const normalized=createExpedition(expedition);
  const deltas=[...Object.keys(normalized.stores).map(key=>({key,amount:normalized.stores[key]-before.stores[key]})),{key:'hull',amount:normalized.fleet.hull-before.fleet.hull},{key:'outposts',amount:normalized.fleet.buildings-before.fleet.buildings},{key:'repairs',amount:normalized.repairs-before.repairs},{key:'arrivals',amount:normalized.stats.arrivals-before.stats.arrivals}].filter(delta=>delta.amount!==0);
  return {expedition:normalized,changed:true,feedback:normalized.lastFeedback,deltas,needsQuestion:true,nextObjective:expeditionSummary(normalized).nextObjective};
}
function finishJob(e,job,notes){
  e.work[job]=0;
  if(job==='gather'){e.stores.timber+=3;e.stores.crystal++;e.stats.gathered++;notes.push('Crew returned with 3 timber and 1 starlight.');}
  if(job==='build'){e.stores.timber-=2;e.stores.crystal--;e.fleet.buildings++;e.fleet.guard=Math.min(10,e.fleet.guard+1);e.fleet.hull=Math.min(100,e.fleet.hull+10);e.stats.builds++;notes.push(`Outpost ${e.fleet.buildings} built. A permanent shelter and stronger guard join the expedition.`);}
  if(job==='sail'){e.stats.voyages++;notes.push('Your ship crossed the passage.');}
  if(job==='defend'){e.stats.victories++;e.stats.arrivals++;const reward=(12+Math.min(20,e.chapter))*(e.routeChoice==='hazard'?2:1);e.stores.coins+=reward;notes.push(`Pirates repelled. ${destinations[e.routeIndex%destinations.length]} secured! +${reward} island coins. A new route is charted.`);}
  if(job===jobs[e.legIndex]){
    e.legIndex++;
    if(e.legIndex>3){e.legIndex=0;e.routeIndex++;e.chapter=1+Math.floor(e.routeIndex/4);}
  }
  e.activeJob=jobs[e.legIndex];
}
