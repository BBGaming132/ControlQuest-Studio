import {createExpedition,advanceExpedition} from './expedition-engine.js';
/** A persistent, study-powered, turn-based island. No timers or purchases. */
export const QUEST_WORLD_VERSION=1;
export const WORLD_ZONES=Object.freeze([
  {id:'harbor',name:'Lantern Harbor',caption:'Bring the lighthouse back to life.',color:'#ffa86b'},
  {id:'grove',name:'Recall Grove',caption:'Grow a little knowledge garden.',color:'#8de0b1'},
  {id:'observatory',name:'Starlight Observatory',caption:'Chart the next chapter.',color:'#baa6f9'}
]);
export const WORLD_BUILDINGS=Object.freeze({
  beacon:{name:'Harbor beacon',zone:'harbor',wood:4,crystal:2,energy:3,maxLevel:6},
  greenhouse:{name:'Grove greenhouse',zone:'grove',wood:3,crystal:1,energy:3,maxLevel:6},
  telescope:{name:'Star telescope',zone:'observatory',wood:3,crystal:3,energy:3,maxLevel:6}
});
const resourceNames={energy:'Focus',seeds:'Seeds',wood:'Timber',crystal:'Starlight',crops:'Glowfruit',lanterns:'Lanterns',coins:'Quest coins'};
const objectiveNames={study:'questions answered',correct:'correct answers',harvested:'harvests',gathered:'gathering trips',crafted:'lanterns crafted',built:'upgrades built'};
const stories=[
  'A faded chart washes into Lantern Harbor. Its ink returns whenever someone recalls what they have learned.',
  'The grove keeper has planted seeds from the old archive. Each careful answer helps their roots take hold.',
  'A distant owl signals from the observatory. The next constellation is hidden between the pages.',
  'Your lanterns have caught the attention of a passing skyship. Its crew leaves a new route on your map.',
  'The island is becoming a place worth returning to. There is always another garden, light, or story to restore.'
];
const questPatterns=[
  {title:'A light for the way home',body:'Recall a few ideas to relight the harbor path.',objective:'correct',target:3,zone:'harbor'},
  {title:'The keeper’s first harvest',body:'Plant glowseeds, answer questions while they grow, then harvest.',objective:'harvested',target:2,zone:'grove'},
  {title:'Footnotes in the stars',body:'Follow the clues one question at a time.',objective:'study',target:5,zone:'observatory'},
  {title:'A woodland supply run',body:'Gather materials for the island’s next chapter.',objective:'gathered',target:3,zone:'grove'},
  {title:'The lantern maker',body:'Turn timber and starlight into a little warmth.',objective:'crafted',target:1,zone:'harbor'},
  {title:'An island worth keeping',body:'Upgrade one landmark with study-earned materials.',objective:'built',target:1,zone:'observatory'}
];
const integer=(v,min=0,max=1e7)=>Math.max(min,Math.min(max,Math.floor(Number(v)||0)));
const clone=v=>JSON.parse(JSON.stringify(v));
const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

export function createWorld(saved={}) {
  const source=saved?.questWorld||saved?.world||saved;
  const valid=source?.version===QUEST_WORLD_VERSION?source:{};
  const base={version:1,zone:'harbor',chapter:1,cycle:0,studyTurns:0,energy:3,maxEnergy:12,
    resources:{seeds:3,wood:0,crystal:0,crops:0,lanterns:0,coins:0},
    buildings:{beacon:0,greenhouse:0,telescope:0},plots:[null,null,null],
    stats:{study:0,correct:0,incorrect:0,harvested:0,gathered:0,crafted:0,built:0,quests:0},
    activeQuest:null,practiceCharge:0,seenEvents:[],lastFeedback:null,
    workshop:{progress:0,ready:0,collected:0},settlement:{expansions:0,deliveries:0},journal:[],
    automation:{enabled:true},project:{building:'beacon',progress:0,target:3,funded:false},expedition:{steps:0,summits:0}};
  const world={...base,...clone(valid),resources:{...base.resources,...valid.resources},buildings:{...base.buildings,...valid.buildings},stats:{...base.stats,...valid.stats}};
  world.zone=WORLD_ZONES.some(z=>z.id===world.zone)?world.zone:'harbor';
  world.maxEnergy=integer(world.maxEnergy,12,18);world.energy=integer(world.energy,0,world.maxEnergy);
  world.chapter=integer(world.chapter,1);world.cycle=integer(world.cycle);world.studyTurns=integer(world.studyTurns);
  for(const name of Object.keys(base.resources))world.resources[name]=integer(world.resources[name]);
  for(const name of Object.keys(base.stats))world.stats[name]=integer(world.stats[name]);
  for(const name of Object.keys(base.buildings))world.buildings[name]=integer(world.buildings[name],0,WORLD_BUILDINGS[name].maxLevel);
  world.plots=base.plots.map((_,i)=>{const plot=valid.plots?.[i];return plot&&Number.isFinite(plot.readyAt)?{plantedAt:integer(plot.plantedAt),readyAt:integer(plot.readyAt),...(plot.automatic===true?{automatic:true}:{})}:null;});
  world.seenEvents=Array.isArray(world.seenEvents)?world.seenEvents.filter(v=>typeof v==='string').slice(-2000):[];
  world.practiceCharge=integer(world.practiceCharge,0,2);
  world.workshop={progress:integer(valid.workshop?.progress,0,2),ready:integer(valid.workshop?.ready,0,50),collected:integer(valid.workshop?.collected)};
  world.automation={enabled:valid.automation?.enabled!==false};
  const project=valid.project,building=Object.hasOwn(WORLD_BUILDINGS,project?.building)?project.building:'beacon';
  world.project={building,progress:integer(project?.progress,0,2),target:3,funded:project?.funded===true,manuallySelected:project?.manuallySelected===true};
  if(world.project.funded&&world.buildings[building]>=WORLD_BUILDINGS[building].maxLevel)world.project.funded=false;
  world.expedition={steps:integer(valid.expedition?.steps),summits:integer(valid.expedition?.summits)};
  world.campaign=createExpedition(valid.campaign);
  world.campaign.stores={timber:world.resources.wood,crystal:world.resources.crystal,coins:world.resources.coins};
  world.settlement={expansions:integer(valid.settlement?.expansions),deliveries:integer(valid.settlement?.deliveries)};
  world.journal=Array.isArray(valid.journal)?valid.journal.filter(entry=>entry&&typeof entry.message==='string').slice(-8).map(entry=>({message:entry.message.slice(0,300),turn:integer(entry.turn),tone:String(entry.tone||'success').slice(0,20)})):[];
  if(world.activeQuest&&!questPatterns.some(p=>p.objective===world.activeQuest.objective))world.activeQuest=null;
  return world;
}
export function getQuestBoard(world) {
  const w=createWorld(world);
  return [0,1,2].map(offset=>{
    let pattern=questPatterns[(w.cycle+offset*2)%questPatterns.length];
    if(pattern.objective==='built'&&Object.entries(WORLD_BUILDINGS).every(([key,spec])=>w.buildings[key]>=spec.maxLevel))pattern=questPatterns[2];
    const target=pattern.target+(['study','correct','gathered'].includes(pattern.objective)?Math.min(4,Math.floor(w.cycle/6)):0);
    return {...pattern,id:`chapter-${w.cycle}-${offset}`,target,reward:8+Math.min(12,w.chapter)};
  });
}
export function questProgress(world) {
  const quest=world?.activeQuest;
  if(!quest)return {done:0,target:0,pct:0,complete:false};
  const target=integer(quest.target,1,100);
  const done=Math.max(0,integer(world.stats?.[quest.objective])-integer(quest.baseline));
  return {done:Math.min(done,target),target,pct:Math.min(100,Math.round(done/target*100)),complete:done>=target};
}
export function advanceWorld(saved,event={}) {
  const world=createWorld(saved),before=clone(world);
  const reject=(message,needsStudy=false)=>({world:before,changed:false,feedback:{tone:'hint',message},needsStudy});
  if(event.id&&world.seenEvents.includes(String(event.id)))return {...reject('That action is already saved.'),duplicate:true};
  if(event.sceneZone!==undefined){if(!WORLD_ZONES.some(z=>z.id===event.sceneZone))return reject('Choose a valid place on the island.');world.zone=event.sceneZone;}
  const spend=amount=>world.energy>=amount;
  const costs=(resources={})=>Object.entries(resources).every(([key,n])=>world.resources[key]>=n);
  let feedback='',tone='success',reward=null;
  switch(event.type){
    case 'campaign-tactic':{
      const result=advanceExpedition(world.campaign,{...event,type:'tactic'});if(!result.changed)return reject(result.feedback.message);world.campaign=result.expedition;feedback=result.feedback.message;tone=result.feedback.tone;break;
    }
    case 'campaign-assign':
    case 'campaign-job':{
      const result=advanceExpedition(world.campaign,{type:'assign',id:event.id,job:event.job});
      if(!result.changed)return reject(result.feedback.message);
      world.campaign=result.expedition;feedback=result.feedback.message;tone=result.feedback.tone;break;
    }
    case 'travel':{
      if(!WORLD_ZONES.some(z=>z.id===event.zone))return reject('Choose a place on the island.');
      if(world.zone===event.zone)return reject('You are already here.');
      world.zone=event.zone;feedback=`Arrived at ${WORLD_ZONES.find(z=>z.id===event.zone).name}.`;tone='arrival';break;
    }
    case 'study-answer':{
      if(!event.id)return reject('Study answers need a unique event ID to save safely.');
      if(typeof event.correct!=='boolean')return reject('A study answer needs a correct or incorrect result.');
      world.studyTurns++;world.stats.study++;
      world.workshop.progress++;
      if(world.workshop.progress>=3){world.workshop.progress=0;world.workshop.ready=Math.min(50,world.workshop.ready+1);}
      if(event.correct===true){world.stats.correct++;world.energy=Math.min(world.maxEnergy,world.energy+3);world.practiceCharge=0;feedback=`Good recall. +${world.energy-before.energy} focus.`;tone='correct';}
      else{world.stats.incorrect++;world.practiceCharge++;if(world.practiceCharge>=3){world.practiceCharge=0;world.energy=Math.min(world.maxEnergy,world.energy+1);feedback='A useful repair. +1 focus for three practice steps.';}else feedback=`A useful repair. ${world.practiceCharge}/3 toward one focus.`;tone='practice';}
      if(world.automation.enabled){
        const results=advanceCrew(world,event.correct);
        feedback+=' '+results.join(' ');
      }else if(world.workshop.ready>before.workshop.ready)feedback+=' A supply crate is ready to collect!';
      const result=advanceExpedition({...world.campaign,stores:{timber:world.resources.wood,crystal:world.resources.crystal,coins:world.resources.coins}},event);
      if(result.changed){world.campaign=result.expedition;world.resources.wood=result.expedition.stores.timber;world.resources.crystal=result.expedition.stores.crystal;world.resources.coins=result.expedition.stores.coins;feedback+=' '+result.feedback.message;if(!event.correct)tone='setback';}
      break;
    }
    case 'plan-build':{
      if(!Object.hasOwn(WORLD_BUILDINGS,event.building))return reject('Choose a landmark on the island.');
      if(world.project.funded)return reject('Your crew is already building. Answer questions to finish this project before choosing another.');
      if(world.buildings[event.building]>=WORLD_BUILDINGS[event.building].maxLevel)return reject('That landmark is fully restored. Choose another project.');
      world.project={building:event.building,progress:0,target:3,funded:false,manuallySelected:true};
      world.automation.enabled=true;feedback=`Crew assigned to ${WORLD_BUILDINGS[event.building].name}. Your saved answers bring supplies and build it.`;tone='build';break;
    }
    case 'set-automation':{
      if(typeof event.enabled!=='boolean')return reject('Choose whether your island crew works automatically.');
      world.automation.enabled=event.enabled;feedback=event.enabled?'Island crew ready: answers now collect supplies, tend crops and build your chosen project.':'Automatic crew paused. Your colony is safe; manual actions remain available.';break;
    }
    case 'collect-output':{
      if(!world.workshop.ready)return reject(`Answer ${3-world.workshop.progress} more questions to finish the next supply crate.`,true);
      const count=world.workshop.ready;
      world.resources.wood+=count*(1+Math.floor(world.buildings.beacon/2));
      world.resources.crystal+=count*(1+Math.floor(world.buildings.telescope/2));
      world.resources.seeds+=count;world.workshop.collected+=count;world.workshop.ready=0;
      feedback=`Crew delivery collected: ${count} supply ${count===1?'crate':'crates'}. Upgraded landmarks improve future deliveries.`;tone='harvest';break;
    }
    case 'deliver':{
      if(world.zone!=='harbor')return reject('Visit Lantern Harbor to load the skyship.');
      if(!spend(2))return reject('A skyship delivery needs two focus. Answer a question first.',true);
      if(!costs({crops:2,lanterns:1}))return reject('Grow two glowfruit and craft one lantern for the skyship.');
      world.energy-=2;world.resources.crops-=2;world.resources.lanterns--;
      const coins=18+Math.min(12,world.settlement.deliveries);
      world.resources.coins+=coins;world.resources.seeds+=2;world.settlement.deliveries++;
      feedback=`Skyship delivery ${world.settlement.deliveries} complete! +${coins} quest coins and two seeds. A fresh order is waiting.`;tone='quest';break;
    }
    case 'expand':{
      const coins=20+Math.min(80,world.settlement.expansions*10);
      if(!spend(3))return reject('An island expansion needs three focus. Answer a question first.',true);
      if(!costs({coins,wood:4,crystal:2}))return reject(`Save ${coins} quest coins, four timber and two starlight to build a new neighborhood.`);
      world.energy-=3;world.resources.coins-=coins;world.resources.wood-=4;world.resources.crystal-=2;world.settlement.expansions++;
      feedback=`Neighborhood ${world.settlement.expansions} founded. A new home joins the colony! Deliveries and quests keep new neighborhoods coming.`;tone='build';break;
    }
    case 'select-quest':{
      if(world.activeQuest)return reject('Finish the current quest before choosing another.');
      const quest=getQuestBoard(world).find(q=>q.id===event.questId);
      if(!quest)return reject('That quest has changed. Choose one from the board.');
      world.activeQuest={...quest,baseline:world.stats[quest.objective]||0};world.zone=quest.zone;feedback=`Quest accepted: ${quest.title}.`;break;
    }
    case 'plant':{
      const plot=event.plot;if(!Number.isInteger(plot)||plot<0||plot>2)return reject('Choose one of the three garden plots.');
      if(world.zone!=='grove')return reject('Visit Recall Grove to tend your garden.');
      if(world.plots[plot])return reject('There is already a plant in this plot.');
      if(!world.resources.seeds)return reject('Craft a seed pouch from glowfruit to plant again.');
      if(!spend(1))return reject('Answer a question to earn focus for planting.',true);
      world.energy--;world.resources.seeds--;world.plots[plot]={plantedAt:world.studyTurns,readyAt:world.studyTurns+3};feedback='Glowseed planted. Three study answers until harvest.';tone='plant';break;
    }
    case 'tend':{
      const plot=world.plots[event.plot];if(world.zone!=='grove'||!plot)return reject('Choose a planted plot in Recall Grove.');
      if(plot.readyAt<=world.studyTurns)return reject('This glowfruit is ready to harvest.');
      if(!spend(1))return reject('Answer a question to earn focus for tending.',true);
      world.energy--;plot.readyAt=Math.max(world.studyTurns,plot.readyAt-1);feedback='A careful watering brings harvest one answer closer.';tone='plant';break;
    }
    case 'harvest':{
      const plot=world.plots[event.plot];if(world.zone!=='grove'||!plot)return reject('Choose a planted plot in Recall Grove.');
      if(plot.readyAt>world.studyTurns)return reject(`Answer ${plot.readyAt-world.studyTurns} more questions, or tend the plot.`,true);
      if(!spend(1))return reject('One focus is needed to harvest. Answer a question first.',true);
      world.energy--;world.resources.crops+=2+Math.min(2,world.buildings.greenhouse);world.resources.seeds++;world.plots[event.plot]=null;world.stats.harvested++;feedback='Harvest! Glowfruit collected and one seed saved for next time.';tone='harvest';break;
    }
    case 'gather':{
      const resource=event.resource;
      if(!['wood','crystal'].includes(resource))return reject('Choose timber or starlight.');
      const zone=resource==='wood'?'grove':'observatory';if(world.zone!==zone)return reject(`Visit ${WORLD_ZONES.find(z=>z.id===zone).name} to gather ${resourceNames[resource].toLowerCase()}.`);
      if(!spend(1))return reject('A gathering trip needs one focus. Answer a question first.',true);
      world.energy--;world.resources[resource]+=resource==='wood'?2:1;world.stats.gathered++;feedback=resource==='wood'?'Found two pieces of fallen timber.':'A little starlight, carefully bottled.';tone='gather';break;
    }
    case 'build':{
      const spec=Object.hasOwn(WORLD_BUILDINGS,event.building)?WORLD_BUILDINGS[event.building]:null;if(!spec)return reject('Choose a landmark to upgrade.');
      if(world.zone!==spec.zone)return reject(`Visit ${WORLD_ZONES.find(z=>z.id===spec.zone).name} to work on this landmark.`);
      if(world.project.funded&&world.project.building===event.building)return reject('Your crew is already building this landmark. Answer questions to finish it.');
      const level=world.buildings[event.building];if(level>=spec.maxLevel)return reject('This landmark is fully restored. Other quests keep the adventure going.');
      const wood=spec.wood+level,crystal=spec.crystal+Math.floor(level/2);
      if(!spend(spec.energy))return reject('Answer a few questions to power this upgrade.',true);
      if(!costs({wood,crystal}))return reject(`You need ${wood} timber and ${crystal} starlight for this upgrade.`);
      world.energy-=spec.energy;world.resources.wood-=wood;world.resources.crystal-=crystal;world.buildings[event.building]++;world.stats.built++;
      feedback=`${spec.name} restored to level ${level+1}. The island is a little brighter.`;tone='build';break;
    }
    case 'craft':{
      if(world.zone!=='harbor')return reject('Crafting happens at Lantern Harbor.');
      if(event.recipe==='seeds'){
        if(!spend(1))return reject('Answer a question to earn focus for crafting.',true);
        if(!costs({crops:2}))return reject('Harvest two glowfruit to craft a seed pouch.');
        world.energy--;world.resources.crops-=2;world.resources.seeds+=3;feedback='A seed pouch: three more beginnings.';
      }else if(event.recipe==='lantern'){
        if(!spend(2))return reject('Crafting a lantern needs two focus. Answer a question first.',true);
        if(!costs({wood:2,crystal:1}))return reject('A lantern needs two timber and one starlight.');
        world.energy-=2;world.resources.wood-=2;world.resources.crystal--;world.resources.lanterns++;world.stats.crafted++;feedback='Lantern crafted. A new glow joins the harbor.';
      }else return reject('Choose a recipe from the workshop.');
      tone='craft';break;
    }
    case 'claim-quest':{
      if(!world.activeQuest||!questProgress(world).complete)return reject('Complete the current quest before collecting its reward.');
      const quest=world.activeQuest;const coins=integer(quest.reward,1,100);
      world.resources.coins+=coins;world.resources.seeds++;world.stats.quests++;world.cycle++;world.chapter=1+Math.floor(world.stats.quests/3);world.activeQuest=null;
      reward={coins,seeds:1};feedback=`Quest complete. +${coins} quest coins and a glowseed. A new set of routes is ready.`;tone='quest';break;
    }
    case 'reset-feedback':world.lastFeedback=null;return {world,changed:true,feedback:null};
    default:return reject('Choose an island action or answer a study question.');
  }
  if(event.id)world.seenEvents=[...world.seenEvents,String(event.id)].slice(-2000);
  const deltas=['energy',...Object.keys(world.resources)].map(key=>({key,amount:(key==='energy'?world.energy:world.resources[key])-(key==='energy'?before.energy:before.resources[key])})).filter(delta=>delta.amount!==0);
  world.lastFeedback={tone,message:feedback,id:String(event.id||`${event.type}-${world.studyTurns}-${world.stats.quests}`),action:event.type,deltas};
  world.journal=[...world.journal,{message:feedback,turn:world.studyTurns,tone}].slice(-8);
  return {world:createWorld(world),changed:true,feedback:world.lastFeedback,reward,needsStudy:false,consequences:colonyEconomySummary(world)};
}

/** A saved answer is one crew turn. No wall-clock timers or browser-authored currency outside this island. */
function advanceCrew(w,correct){
  const notes=[];
  const coins=correct?2:1;w.resources.coins+=coins;notes.push(`+${coins} island coins.`);
  if(w.workshop.ready){
    const count=w.workshop.ready;w.resources.wood+=count*(1+Math.floor(w.buildings.beacon/2));w.resources.crystal+=count*(1+Math.floor(w.buildings.telescope/2));w.resources.seeds+=count;w.workshop.collected+=count;w.workshop.ready=0;
    notes.push(`Crew banked ${count} supply ${count===1?'crate':'crates'}: timber, starlight and seeds.`);
  }
  let harvests=0,planted=0;
  for(let i=0;i<w.plots.length;i++){
    const plot=w.plots[i];
    if(plot?.automatic&&plot.readyAt<=w.studyTurns){w.resources.crops+=2+Math.min(2,w.buildings.greenhouse);w.resources.seeds++;w.stats.harvested++;w.plots[i]=null;harvests++;}
    if(!w.plots[i]&&w.resources.seeds>0){w.resources.seeds--;w.plots[i]={plantedAt:w.studyTurns,readyAt:w.studyTurns+3,automatic:true};planted++;}
  }
  if(harvests)notes.push(`Crew harvested ${harvests} garden ${harvests===1?'plot':'plots'} and replanted.`);
  else if(planted)notes.push(`Crew planted ${planted} garden ${planted===1?'plot':'plots'}.`);
  const project=w.project,spec=WORLD_BUILDINGS[project.building],level=w.buildings[project.building];
  if(level<spec.maxLevel){
    const timber=spec.wood+level,starlight=spec.crystal+Math.floor(level/2);
    if(project.manuallySelected&&!project.funded&&w.resources.wood>=timber&&w.resources.crystal>=starlight&&w.energy>=spec.energy){
      w.resources.wood-=timber;w.resources.crystal-=starlight;w.energy-=spec.energy;project.funded=true;notes.push(`Construction started: ${spec.name}.`);
    }
    if(project.funded){
      project.progress++;
      if(project.progress>=project.target){
        w.buildings[project.building]++;w.stats.built++;notes.push(`${spec.name} built to level ${w.buildings[project.building]}!`);
        const keys=Object.keys(WORLD_BUILDINGS),next=keys.find(key=>w.buildings[key]<WORLD_BUILDINGS[key].maxLevel&&key!==project.building)||keys.find(key=>w.buildings[key]<WORLD_BUILDINGS[key].maxLevel)||project.building;
        w.project={building:next,progress:0,target:3,funded:false};
      }else notes.push(`Construction ${project.progress}/${project.target}.`);
    }
  }
  if(correct){
    w.expedition.steps++;
    if(w.expedition.steps%12===0){w.expedition.summits++;w.resources.coins+=12;w.settlement.expansions++;notes.push(`Summit ${w.expedition.summits} reached! +12 island coins; a new hillside home opens.`);}
    else if(w.expedition.steps%3===0)notes.push(`Mountain trail checkpoint ${w.expedition.steps%12}/12 reached.`);
  }
  return notes;
}
export function getExpedition(saved){
  const w=createWorld(saved),step=w.expedition.steps%12;
  return {name:['Cloudcap Trail','Moonrise Ridge','Skyglass Summit'][w.expedition.summits%3],steps:step,target:12,summits:w.expedition.summits,checkpoint:Math.floor(step/3),pct:Math.round(step/12*100),nextReward:'12 island coins and a hillside home',description:'Correct saved recalls move your explorer up the mountain. Misses still grow your crops and supply the crew.'};
}
export function colonyEconomySummary(saved){
  const w=createWorld(saved),p=w.project,spec=WORLD_BUILDINGS[p.building],level=w.buildings[p.building];
  return {automatic:w.automation.enabled,nextSupplyIn:3-w.workshop.progress,supplyCratesBanked:w.workshop.collected,project:{...p,name:spec.name,level,nextLevel:Math.min(spec.maxLevel,level+1),maxed:level>=spec.maxLevel,required:{wood:spec.wood+level,crystal:spec.crystal+Math.floor(level/2),energy:spec.energy}},expedition:getExpedition(w),lastChanges:w.lastFeedback?.deltas||[],explanation:'Each saved answer earns island coins and advances crops. Every three answers your crew banks supplies. Funded projects build over three answers. Correct recalls climb the mountain.'};
}

function icon(name){
  const paths={energy:'M13 2 4 13h7l-1 9 10-13h-8l1-7Z',seeds:'M12 21v-8M12 14C4 15 2 8 3 4c7-1 10 3 9 10Zm0-3c0-5 4-8 9-7 1 6-3 9-9 9',wood:'m5 17 10-10m-9 4 7 7M4 16l4 4L21 7l-4-4L4 16Z',crystal:'m12 2 8 7-3 12H7L4 9l8-7Zm-8 7h16M12 2 8 9l4 12 4-12-4-7',crops:'M8 6c-7 4-5 14 4 15 9-1 11-11 4-15-2 2-6 2-8 0Zm4 1V2m0 4c1-4 5-4 7-3',lanterns:'M8 7h8l3 13H5L8 7Zm1-1V4a3 3 0 0 1 6 0v2m-3 6v5',coins:'M20 12a8 8 0 1 1-16 0 8 8 0 0 1 16 0Zm-8-4v8m3-6c-4-3-7 2-3 2s2 5-2 2',compass:'m15 9-2 4-4 2 2-4 4-2Zm6 3a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z'};
  return `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="${paths[name]||paths.compass}"/></svg>`;
}
function defaultOwl(){return `<svg viewBox="0 0 140 150" role="img" aria-label="Ollie the audit owl"><path d="M28 105c-22 19-7 36 5 28l25-17h30l25 17c17 9 23-12 4-28" fill="#7581ef"/><path d="M35 40 26 15l29 15h30l29-15-9 25c27 19 22 83-35 87-57-4-62-68-35-87Z" fill="#74c8e7"/><ellipse cx="49" cy="63" rx="26" ry="29" fill="#fffaf0"/><ellipse cx="91" cy="63" rx="26" ry="29" fill="#fffaf0"/><circle cx="49" cy="64" r="9" fill="#243650"/><circle cx="91" cy="64" r="9" fill="#243650"/><circle cx="46" cy="60" r="3" fill="white"/><circle cx="88" cy="60" r="3" fill="white"/><path d="m63 86 7 10 7-10" fill="#efac63"/><path d="M55 109q15 12 30 0" fill="none" stroke="white" stroke-width="5" stroke-linecap="round"/></svg>`;}
export function renderPlayerCard({name='Explorer',avatarHtml='',level=1,subtitle='A little wiser every turn',compact=false}={}){
  return `<div class="qw-player-card ${compact?'qw-player-compact':''}"><div class="qw-player-portrait">${avatarHtml||defaultOwl()}<span class="qw-player-level">${integer(level,1)}</span></div><div><span class="qw-micro">Island explorer</span><h3>${escape(name)}</h3><p>${escape(subtitle)}</p></div></div>`;
}
function tree(x,y,size=1){return `<g transform="translate(${x} ${y}) scale(${size})"><ellipse cy="38" rx="29" ry="9" fill="#2d5c5a" opacity=".15"/><path d="M-5 7h10v34H-5z" fill="#927464"/><path d="M0-57C-40-35-51 5-25 11c-6 28 54 37 57 10 27 3 24-33 3-40C32-46 15-62 0-57Z" fill="#72ba99"/><path d="M0-42C-29-22-36 3-17 8c-6 11 25 18 31 6 23 0 19-25 5-33 0-18-9-28-19-23Z" fill="#a5d9ad"/><path d="M-9-6 10-21M-5 18 14 3" stroke="#539584" stroke-width="3" stroke-linecap="round"/></g>`;}
function islandArt(world){
  const zone=world.zone,night=zone==='observatory',level=world.buildings[Object.keys(WORLD_BUILDINGS).find(key=>WORLD_BUILDINGS[key].zone===zone)];
  const workers=2+Math.min(4,world.settlement.expansions+Math.floor(world.stats.quests/3));
  const cottages=1+Math.min(4,world.settlement.expansions);
  const cottage=(x,y,i)=>`<g transform="translate(${x} ${y})"><ellipse cy="29" rx="30" ry="10" fill="#386c67" opacity=".17"/><path d="M-22 27V-7h44v34Z" fill="${['#f5dcb5','#c9dfdc','#e4cfed','#f3c4a3','#d7dfb2'][i]}"/><path d="m-31-7 31-27 31 27Z" fill="${['#ca847b','#698ea2','#8c82b1','#c49365','#789a85'][i]}"/><path d="M-6 27V7h12v20" fill="#72758a"/><path d="M-16 0h8v9h-8m24-9h8v9H8" fill="#fff1b1"/></g>`;
  const worker=(i)=>`<g transform="translate(${225+i*58} ${282+(i%2)*17})"><g class="qw-worker" style="animation-delay:-${i*.7}s"><ellipse cy="17" rx="11" ry="4" fill="#2b6263" opacity=".19"/><path d="M-7 6-9 15m16-9 2 9" stroke="#596a84" stroke-width="5" stroke-linecap="round"/><path d="M-8 3q8-7 16 0l3 8H-11Z" fill="${['#f8b68a','#b7b7f2','#83c5c2'][i%3]}"/><circle cy="-5" r="8" fill="#f2d6ba"/><path d="M-11-6q2-16 15-9l7 9Z" fill="#767da2"/><path d="M-7 3-13 8m20-5 8 5" stroke="#f2d6ba" stroke-width="4" stroke-linecap="round"/></g></g>`;
  const crops=world.plots.map((plot,i)=>{const remain=plot?Math.max(0,plot.readyAt-world.studyTurns):3,ready=plot&&remain===0,size=plot?Math.min(1.2,.35+(3-remain)*.28):0;return `<g transform="translate(${340+(i%2)*42} ${271+Math.floor(i/2)*25})"><path d="m-21 0 21-9 21 9-21 10Z" fill="#936b5d"/>${plot?`<g transform="scale(${size})"><path d="M0 0v-30m0 13q-21-4-15-17 16-1 15 17m0-8q16-17 23-3-4 16-23 3" fill="#b6df9c" stroke="#588776" stroke-width="3"/>${ready?'<g fill="#ffcf77"><circle cy="-28" r="8"/><circle cx="-10" cy="-17" r="6"/><circle cx="9" cy="-13" r="6"/></g>':''}</g>`:''}</g>`;}).join('');
  const sparks=Array.from({length:Math.min(8,world.resources.lanterns)},(_,i)=>`<g transform="translate(${180+i*48} ${321+(i%2)*8})"><path d="M0 0v-22" stroke="#7f7d89" stroke-width="3"/><rect x="-5" y="-25" width="10" height="12" rx="3" fill="#ffe3a1"/><circle cy="-19" r="11" fill="#ffe9aa" opacity=".2"/></g>`).join('');
  const stock=zone==='grove'?Array.from({length:Math.min(6,world.resources.wood)},(_,i)=>`<rect x="${478+i%3*10}" y="${282-Math.floor(i/3)*8}" width="27" height="7" rx="3" fill="#a88167"/>`).join(''):zone==='observatory'?Array.from({length:Math.min(6,world.resources.crystal)},(_,i)=>`<path d="m${300+i%3*16} ${280-Math.floor(i/3)*13} 6-14 8 9-4 12Z" fill="#b1dcef" stroke="#819cc0" stroke-width="2"/>`).join(''):'';
  const progress=world.workshop.progress;
  return `<svg class="qw-island-svg" viewBox="0 0 760 430" role="img" aria-label="${escape(WORLD_ZONES.find(z=>z.id===zone).name)}: landmark level ${level}, ${cottages} visible homes, ${world.workshop.ready} supply crates ready"><defs><linearGradient id="qw-sky-${zone}" x2="0" y2="1"><stop stop-color="${night?'#343b73':'#b7e4e8'}"/><stop offset="1" stop-color="${night?'#7d81b2':'#e8edcc'}"/></linearGradient><linearGradient id="qw-water-${zone}" x2="0" y2="1"><stop stop-color="${night?'#6e86aa':'#83c6cf'}"/><stop offset="1" stop-color="${night?'#456689':'#56a1b5'}"/></linearGradient></defs><rect width="760" height="430" rx="30" fill="url(#qw-sky-${zone})"/>${night?'<g fill="#ffefd0"><circle cx="116" cy="62" r="2"/><circle cx="205" cy="38" r="3"/><circle cx="352" cy="73" r="2"/><circle cx="559" cy="35" r="2"/><circle cx="657" cy="90" r="3"/></g><circle cx="622" cy="56" r="27" fill="#f8e8c3"/><circle cx="632" cy="48" r="24" fill="#3f487e"/>':'<circle cx="610" cy="73" r="37" fill="#fff0bc"/><g class="qw-cloud" fill="#fff9e9" opacity=".8"><ellipse cx="137" cy="87" rx="50" ry="13"/><ellipse cx="115" cy="77" rx="26" ry="20"/><ellipse cx="150" cy="72" rx="28" ry="24"/></g><g class="qw-cloud qw-cloud-late" fill="#fff9e9" opacity=".6"><ellipse cx="481" cy="111" rx="50" ry="13"/><ellipse cx="460" cy="98" rx="26" ry="20"/></g>'}<path d="M0 215Q180 190 380 220T760 215v215H0Z" fill="url(#qw-water-${zone})"/><g class="qw-water-lines" fill="none" stroke="#d7eeeb" stroke-width="3" opacity=".4"><path d="M43 324h71m488-32h65M28 375h116m447 12h94M170 417h85m235-77h75"/></g><ellipse cx="380" cy="340" rx="264" ry="56" fill="#265d76" opacity=".16"/><path d="M131 276q247 123 500 0l-25 51q-221 109-450 0Z" fill="#a99284"/><path d="M156 309q224 105 450 0l-15 32q-212 89-418-3Z" fill="#877c7c"/><ellipse cx="380" cy="268" rx="250" ry="94" fill="${zone==='grove'?'#9fd1a0':'#afd3ab'}"/><path d="M171 270q95-81 218-33t175 51" fill="none" stroke="#e2d5ae" stroke-width="29" stroke-linecap="round"/><path d="M171 270q95-81 218-33t175 51" fill="none" stroke="#f0e5bf" stroke-width="20" stroke-linecap="round"/>${tree(174,230,.68)}${tree(572,245,.72)}${zone==='grove'?`${tree(250,183,.65)}${crops}${level?`<g transform="translate(450 194)"><path d="M0 44V0l35-27L70 0v44Z" fill="#dcf1df" stroke="#669888" stroke-width="5"/><path d="M35-27v71M0 0h70" stroke="#669888" stroke-width="4"/>${Array.from({length:level},(_,i)=>`<rect x="${5+i*9}" y="28" width="5" height="11" fill="#87b590"/>`).join('')}</g>`:''}`:zone==='observatory'?`<g transform="translate(442 185)"><path d="M-57 79V0h114v79" fill="#e6dec9"/><path d="M-66 1a66 66 0 0 1 132 0Z" fill="#8b84b2"/><path d="M-37-23q32-41 65-4" fill="none" stroke="#bdb3d8" stroke-width="8"/><path d="M-8 25h24v54H-8" fill="#7b7b9e"/><g class="qw-machinery"><g transform="translate(4 -26) rotate(-25)"><path d="M-9-10h78v22H-9Z" fill="#d9bf80" stroke="#6a6987" stroke-width="5"/><ellipse cx="70" cy="1" rx="8" ry="13" fill="#9bd4e1" stroke="#6a6987" stroke-width="4"/></g></g>${Array.from({length:level},(_,i)=>`<circle cx="${-42+i*17}" cy="57" r="5" fill="#e8dba7"/>`).join('')}</g>`:`<g transform="translate(448 142)"><path d="M-33 130-25 17h50l8 113Z" fill="#f1e9cc"/><path d="M-26 41h52l4 28h-60" fill="#e7a882"/><path d="M-25 17V-9h50v26" fill="#6a8492"/><path d="M-36-11 0-41l36 30Z" fill="#d79577"/><path d="M-10-4h20v20h-20" fill="${level?'#ffeb96':'#c5d4ce'}"/><path d="M-8 94h16v36H-8" fill="#798e98"/>${level?'<path class="qw-beacon-glow" d="M-11 1-166-30v63L-11 11m22-10 155-31v63L11 11" fill="#ffe4a5" opacity=".24"/>':''}${Array.from({length:level},(_,i)=>`<path d="M-25 ${31+i*12}h50" stroke="#dfaa77" stroke-width="3"/>`).join('')}</g><path d="m532 291 87 34v13l-87-31Z" fill="#b49b7b"/><g class="qw-boat" transform="translate(631 326)"><path d="M-40 0h81L24 20h-48Z" fill="#786985"/><path d="M0-69V0m0-61 31 46H0" fill="#f1e2b7" stroke="#8a7e85" stroke-width="4"/></g>`}${Array.from({length:cottages},(_,i)=>cottage(210+i%3*63,208+Math.floor(i/3)*52,i)).join('')}${stock}${sparks}${Array.from({length:workers},(_,i)=>worker(i)).join('')}<g transform="translate(540 276)"><path d="M-24 19V-8h48v27Z" fill="#c8b995"/><path d="m-28-8 28-15 28 15Z" fill="#798f9a"/><g class="qw-machinery"><circle cy="2" r="13" fill="#719a9c" stroke="#f4e4b4" stroke-width="4"/><path d="M0-7v18M-9 2H9" stroke="#f4e4b4" stroke-width="3"/></g>${world.workshop.ready?'<g class="qw-action-spark"><rect x="20" y="0" width="24" height="22" rx="3" fill="#f5cf81" stroke="#a9855d" stroke-width="3"/><path d="M32 0v22m-12-11h24" stroke="#a9855d" stroke-width="2"/></g>':''}<g fill="#ffe3a1">${Array.from({length:progress},(_,i)=>`<circle cx="${-8+i*16}" cy="30" r="4"/>`).join('')}</g></g></svg>`;
}
function actionButton(label,action,attributes='',disabled=false,secondary=false){return `<button type="button" class="qw-action ${secondary?'qw-action-secondary':''}" data-qw-action="${action}" ${attributes} ${disabled?'disabled':''}>${label}</button>`;}
function zoneActions(world){
  const specEntry=Object.entries(WORLD_BUILDINGS).find(([,b])=>b.zone===world.zone),[building,spec]=specEntry;
  const level=world.buildings[building];
  const upgrade=`<div class="qw-landmark"><div><span class="qw-micro">Island landmark · level ${level}/${spec.maxLevel}</span><h4>${spec.name}</h4><p>${level>=spec.maxLevel?'Fully restored. Your island keeps growing through quests.':`${spec.wood+level} timber · ${spec.crystal+Math.floor(level/2)} starlight · ${spec.energy} focus`}</p></div>${actionButton(level>=spec.maxLevel?'Restored':'Upgrade','build',`data-qw-building="${building}"`,level>=spec.maxLevel,true)}</div>`;
  if(world.zone==='grove')return `<div class="qw-garden" aria-label="Three garden plots">${world.plots.map((plot,i)=>{const ready=plot&&plot.readyAt<=world.studyTurns,remaining=plot?Math.max(0,plot.readyAt-world.studyTurns):0;return `<div class="qw-plot ${plot?'is-planted':''} ${ready?'is-ready':''}"><span class="qw-micro">Plot ${i+1}</span><span class="qw-sprout" aria-hidden="true">${icon(plot?'crops':'seeds')}</span><strong>${ready?'Ready to harvest':plot?`${remaining} answers to grow`:'A new beginning'}</strong>${plot?actionButton(ready?'Harvest · 1 focus':'Tend · 1 focus',ready?'harvest':'tend',`data-qw-plot="${i}"`):actionButton('Plant · 1 focus','plant',`data-qw-plot="${i}"`)}</div>`;}).join('')}</div><div class="qw-action-row">${actionButton(`${icon('wood')} Gather timber · 1 focus`,'gather','data-qw-resource="wood"',false,true)}</div>${upgrade}`;
  if(world.zone==='observatory')return `<div class="qw-zone-note"><div class="qw-zone-emblem">${icon('crystal')}</div><div><h4>Catch a little starlight</h4><p>The telescope’s lens collects a crystal with every focused expedition. Use them to restore landmarks and craft lanterns.</p></div></div><div class="qw-action-row">${actionButton(`${icon('crystal')} Collect starlight · 1 focus`,'gather','data-qw-resource="crystal"')}</div>${upgrade}`;
  return `<div class="qw-contract"><span class="qw-micro">Skyship order ${world.settlement.deliveries+1}</span><h4>A lantern for a neighboring island</h4><p>2 glowfruit · 1 lantern · 2 focus → ${18+Math.min(12,world.settlement.deliveries)} quest coins + 2 seeds</p>${actionButton('Send skyship delivery','deliver')}</div><div class="qw-recipes"><div><span class="qw-zone-emblem">${icon('lanterns')}</span><h4>Make a lantern</h4><p>2 timber + 1 starlight + 2 focus</p>${actionButton('Craft lantern','craft','data-qw-recipe="lantern"')}</div><div><span class="qw-zone-emblem">${icon('seeds')}</span><h4>A fresh seed pouch</h4><p>2 glowfruit + 1 focus → 3 seeds</p>${actionButton('Craft seeds','craft','data-qw-recipe="seeds"',false,true)}</div></div>${upgrade}`;
}
/** One concrete next move, derived only from the saved colony state. */
export function nextWorldStep(saved){
  const w=createWorld(saved),progress=questProgress(w);
  const step=(title,body,action)=>({title,body,action});
  const travel=(zone,title,body)=>step(title,body,{type:'travel',zone});
  const study=()=>step('Answer a question','Earn focus, grow your garden, and advance the crew’s next supply crate.',{type:'study'});
  if(progress.complete)return step('Collect your mission reward','Your goal is complete. Claim it to open the next chapter.',{type:'claim-quest'});
  if(w.workshop.ready)return step('Your crew has a delivery','Collect the supplies your study turns produced. No focus cost.',{type:'collect-output'});
  if(w.energy<1)return study();
  const quest=w.activeQuest;
  if(!quest){
    const cost=20+Math.min(80,w.settlement.expansions*10);
    if(w.energy>=3&&w.resources.coins>=cost&&w.resources.wood>=4&&w.resources.crystal>=2)return step('Build a new neighborhood','Your colony has the supplies. Add a new home to the world.',{type:'expand'});
    return step('Choose your next mission','Start with a short goal. The guide will show you each next move.',{type:'select-quest',questId:getQuestBoard(w)[0].id});
  }
  if(['study','correct'].includes(quest.objective))return study();
  if(quest.objective==='harvested'){
    if(w.zone!=='grove')return travel('grove','Visit your garden','Plant, grow, and harvest glowfruit in Recall Grove.');
    const ready=w.plots.findIndex(plot=>plot&&plot.readyAt<=w.studyTurns);
    if(ready>=0)return step('Harvest a glowing crop','Collect glowfruit and save one seed for next time.',{type:'harvest',plot:ready});
    const empty=w.plots.findIndex(plot=>!plot);
    if(empty>=0&&w.resources.seeds)return step('Plant a glowseed','Three study answers will bring this crop to harvest.',{type:'plant',plot:empty});
    return study();
  }
  if(quest.objective==='gathered')return w.zone==='grove'?step('Gather timber','One focus brings two timber for your next build.',{type:'gather',resource:'wood'}):travel('grove','Follow the woodland path','Gather building supplies in Recall Grove.');
  let target=null;
  if(quest.objective==='built'){
    const entry=Object.entries(WORLD_BUILDINGS).find(([key,spec])=>w.buildings[key]<spec.maxLevel);
    if(entry){const [building,spec]=entry,level=w.buildings[building];target={wood:spec.wood+level,crystal:spec.crystal+Math.floor(level/2),energy:spec.energy,zone:spec.zone,action:{type:'build',building},title:`Upgrade the ${spec.name.toLowerCase()}`};}
  }else if(quest.objective==='crafted')target={wood:2,crystal:1,energy:2,zone:'harbor',action:{type:'craft',recipe:'lantern'},title:'Craft a lantern'};
  if(target){
    if(w.resources.wood<target.wood)return w.zone==='grove'?step('Gather the missing timber',`You have ${w.resources.wood}/${target.wood} timber for this mission.`,{type:'gather',resource:'wood'}):travel('grove','Collect timber first',`You need ${target.wood-w.resources.wood} more timber. Follow the guide to the grove.`);
    if(w.resources.crystal<target.crystal)return w.zone==='observatory'?step('Collect the missing starlight',`You have ${w.resources.crystal}/${target.crystal} starlight for this mission.`,{type:'gather',resource:'crystal'}):travel('observatory','Find some starlight',`You need ${target.crystal-w.resources.crystal} more starlight. Visit the observatory.`);
    if(w.energy<target.energy)return study();
    if(w.zone!==target.zone)return travel(target.zone,'Bring the supplies home','Everything is ready. Travel to your mission’s workshop.');
    return step(target.title,'All the supplies are ready. Watch your colony change.',target.action);
  }
  return study();
}
function stepButton(step){
  if(step.action.type==='study')return `<button type="button" class="qw-study-button" data-qw-study>${escape(step.title)} <span aria-hidden="true">→</span></button>`;
  const attr=Object.entries(step.action).filter(([key])=>key!=='type').map(([key,value])=>`data-qw-${key==='questId'?'quest-id':key}="${escape(value)}"`).join(' ');
  return actionButton(`${escape(step.title)} →`,step.action.type,attr);
}
function colonyOutput(world){
  const ready=world.workshop.ready,progress=world.workshop.progress;
  return `<div class="qw-output"><span class="qw-micro">Your crew works while you learn</span><h3>${ready?`${ready} supply ${ready===1?'crate':'crates'} ready`:`Next supply crate · ${progress}/3 answers`}</h3><p>Every three saved answers produce timber, starlight and a seed. Landmarks improve the yield. Time away never harms your colony.</p><div class="qw-quest-meter" role="progressbar" aria-label="Supply crate progress" aria-valuemin="0" aria-valuemax="3" aria-valuenow="${progress}"><span style="width:${progress/3*100}%"></span></div>${ready?actionButton('Collect crew supplies','collect-output'):''}</div>`;
}
export function renderQuestWorld(saved,options={}) {
  const world=createWorld(saved),zone=WORLD_ZONES.find(z=>z.id===world.zone),progress=questProgress(world),mode=options.mode==='coop'?'coop':'solo';
  const active=world.activeQuest,feedback=options.feedback||world.lastFeedback;
  const playerNames=(options.playerNames||[]).filter(Boolean).slice(0,8);
  const step=options.needsStudy?{title:'Answer a question',body:'A little recall earns focus for your next colony action.',action:{type:'study'}}:nextWorldStep(world);
  const deltaMarkup=Array.isArray(feedback?.deltas)?feedback.deltas.filter(delta=>resourceNames[delta.key]&&Number.isFinite(delta.amount)).map(delta=>`<span class="qw-delta ${delta.amount<0?'is-spent':''}">${delta.amount>0?'+':''}${delta.amount} ${resourceNames[delta.key]}</span>`).join(''):'';
  const ownership=mode==='coop'?`Shared with ${escape(options.guildName||'your Guild')}. Actions here change the Guild colony. Your card mastery stays personal.`:'Saved to your account. Actions here change your own colony; the Guild colony has its own supplies and buildings.';
  return `<section class="quest-world" aria-label="Study-powered island adventure"><div class="qw-heading"><div><span class="qw-micro">The Lantern Isles · Chapter ${world.chapter}</span><h2>${mode==='coop'?'Our Guild colony':'Your little colony'}</h2><p>Learn a little. Build something that lasts.</p></div><div class="qw-mode-switch" role="group" aria-label="Island mode"><button type="button" data-qw-mode="solo" aria-pressed="${mode==='solo'}" class="${mode==='solo'?'is-active':''}">My colony</button><button type="button" data-qw-mode="coop" aria-pressed="${mode==='coop'}" class="${mode==='coop'?'is-active':''}" ${options.coopDisabled?'disabled':''}>Guild colony</button></div></div><p class="qw-ownership">${ownership}</p><div class="qw-guide"><div><span class="qw-micro">Your next move</span><h3>${escape(step.title)}</h3><p>${escape(step.body)}</p></div>${stepButton(step)}</div><div class="qw-layout"><div class="qw-main"><div class="qw-resource-strip" aria-label="Island resources">${['energy','seeds','wood','crystal','crops','lanterns','coins'].map(key=>`<div class="qw-resource qw-resource-${key}" title="${resourceNames[key]}">${icon(key)}<span><strong>${key==='energy'?`${world.energy}/${world.maxEnergy}`:world.resources[key]}</strong><small>${resourceNames[key]}</small></span></div>`).join('')}</div><div class="qw-map"><div class="qw-map-label"><span class="qw-map-pin">${icon('compass')}</span><div><h3>${zone.name}</h3><p>${zone.caption}</p></div></div>${islandArt(world)}<span class="qw-map-caption">${world.stats.quests} missions · ${world.settlement.expansions} neighborhoods founded · ${world.studyTurns} study turns</span></div><nav class="qw-zone-tabs" aria-label="Travel around the island">${WORLD_ZONES.map(z=>`<button type="button" data-qw-action="travel" data-qw-zone="${z.id}" aria-current="${world.zone===z.id?'location':'false'}" class="${world.zone===z.id?'is-active':''}"><span class="qw-zone-dot" style="--zone-color:${z.color}"></span>${z.name.replace('Lantern ','').replace('Recall ','').replace('Starlight ','')}</button>`).join('')}</nav><div class="qw-feedback qw-feedback-${escape(feedback?.tone||'hint')}" role="status" aria-live="polite"><span>${icon(feedback?.tone==='quest'?'coins':'energy')}</span><div><p>${escape(feedback?.message||'Your first three focus are ready. Follow the next-move guide to begin.')}</p>${deltaMarkup?`<div class="qw-deltas">${deltaMarkup}</div>`:''}</div></div><div class="qw-colony-status"><span><strong>${world.workshop.collected}</strong> crates collected</span><span><strong>${world.settlement.deliveries}</strong> skyship orders</span><span><strong>${Object.values(world.buildings).reduce((sum,level)=>sum+level,0)}</strong> landmark upgrades</span></div><div class="qw-location-actions">${zoneActions(world)}</div><details class="qw-journal"><summary>Colony journal · recent changes</summary><ol>${world.journal.length?world.journal.slice().reverse().map(entry=>`<li><small>Study turn ${entry.turn}</small><p>${escape(entry.message)}</p></li>`).join(''):'<li>Your first chapter is waiting. Each action appears here when saved.</li>'}</ol></details></div><aside class="qw-sidebar">${renderPlayerCard({name:options.playerName||'Explorer',avatarHtml:options.avatarHtml,level:world.chapter,subtitle:mode==='coop'?'Building something together':'A little wiser every turn'})}${mode==='coop'?`<div class="qw-coop-note"><span class="qw-micro">Turn-based co-op</span><p>${playerNames.length?playerNames.map(escape).join(' · '):'Guild members share this island.'}</p><small>Every saved answer contributes to your shared world. Each member keeps their own study progress.</small></div>`:''}${colonyOutput(world)}<div class="qw-next-answer"><span class="qw-micro">Study powers the colony</span><p>Correct recall earns up to 3 focus. Every answer grows plants and advances supplies, including mistakes you learn from.</p><button type="button" class="qw-study-button" data-qw-study>${icon('energy')} Answer a question <span aria-hidden="true">→</span></button></div><div class="qw-quest-board"><div class="qw-section-heading"><span class="qw-micro">${active?'Current mission':'Choose a mission'}</span><span>${icon('compass')}</span></div>${active?`<h3>${escape(active.title)}</h3><p>${escape(active.body)}</p><div class="qw-quest-meter" role="progressbar" aria-label="Quest progress" aria-valuemin="0" aria-valuemax="${progress.target}" aria-valuenow="${progress.done}"><span style="width:${progress.pct}%"></span></div><div class="qw-quest-count">${progress.done}/${progress.target} ${objectiveNames[active.objective]}<span>+${integer(active.reward,1,100)} coins</span></div>${actionButton(progress.complete?'Collect reward':'Mission in progress','claim-quest','',!progress.complete)}`:getQuestBoard(world).map(q=>`<button type="button" class="qw-quest-choice" data-qw-action="select-quest" data-qw-quest-id="${q.id}"><span>${escape(q.title)}</span><small>${q.target} ${objectiveNames[q.objective]} · +${q.reward} coins</small><span class="qw-quest-arrow" aria-hidden="true">↗</span></button>`).join('')}</div><div class="qw-contract"><span class="qw-micro">Keep the colony growing</span><h3>Neighborhood ${world.settlement.expansions+1}</h3><p>${20+Math.min(80,world.settlement.expansions*10)} quest coins · 4 timber · 2 starlight · 3 focus</p>${actionButton('Found a neighborhood','expand','',false,true)}<small>New homes appear on your island. Deliveries and missions make the next expansion possible.</small></div><div class="qw-story"><span class="qw-micro">From the island journal</span><p>${stories[(world.chapter-1)%stories.length]}</p></div></aside></div></section>`;
}
export function bindQuestWorld(root,callbacks={}) {
  if(!root)return ()=>{};
  const removers=[];let pending=false;
  const on=(element,event,handler)=>{element.addEventListener(event,handler);removers.push(()=>element.removeEventListener(event,handler));};
  root.querySelectorAll('[data-qw-action]').forEach(button=>on(button,'click',async()=>{
    if(pending)return;
    const data=button.dataset,action={type:data.qwAction};
    for(const [key,dataKey] of [['zone','qwZone'],['questId','qwQuestId'],['resource','qwResource'],['building','qwBuilding'],['recipe','qwRecipe']])if(data[dataKey])action[key]=data[dataKey];
    if(data.qwPlot!==undefined)action.plot=Number(data.qwPlot);
    pending=true;root.setAttribute('aria-busy','true');
    const controls=[...root.querySelectorAll('[data-qw-action],[data-qw-mode]')].map(control=>({control,disabled:control.disabled}));controls.forEach(({control})=>control.disabled=true);
    try{await callbacks.onAction?.(action);}catch(error){if(callbacks.onError)callbacks.onError(error);else{const status=root.querySelector('[role="status"] p');if(status)status.textContent=error?.message||'This action could not be saved. Try again.';}}
    finally{pending=false;root.removeAttribute('aria-busy');controls.forEach(({control,disabled})=>control.disabled=disabled);}
  }));
  root.querySelectorAll('[data-qw-study]').forEach(button=>on(button,'click',()=>{if(!pending)callbacks.onStudy?.();}));
  root.querySelectorAll('[data-qw-mode]').forEach(button=>on(button,'click',()=>{if(!pending)callbacks.onMode?.(button.dataset.qwMode);}));
  return ()=>removers.forEach(remove=>remove());
}
