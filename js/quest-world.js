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
    activeQuest:null,practiceCharge:0,seenEvents:[],lastFeedback:null};
  const world={...base,...clone(valid),resources:{...base.resources,...valid.resources},buildings:{...base.buildings,...valid.buildings},stats:{...base.stats,...valid.stats}};
  world.zone=WORLD_ZONES.some(z=>z.id===world.zone)?world.zone:'harbor';
  world.maxEnergy=integer(world.maxEnergy,12,18);world.energy=integer(world.energy,0,world.maxEnergy);
  world.chapter=integer(world.chapter,1);world.cycle=integer(world.cycle);world.studyTurns=integer(world.studyTurns);
  for(const name of Object.keys(base.resources))world.resources[name]=integer(world.resources[name]);
  for(const name of Object.keys(base.stats))world.stats[name]=integer(world.stats[name]);
  for(const name of Object.keys(base.buildings))world.buildings[name]=integer(world.buildings[name],0,WORLD_BUILDINGS[name].maxLevel);
  world.plots=base.plots.map((_,i)=>{const plot=valid.plots?.[i];return plot&&Number.isFinite(plot.readyAt)?{plantedAt:integer(plot.plantedAt),readyAt:integer(plot.readyAt)}:null;});
  world.seenEvents=Array.isArray(world.seenEvents)?world.seenEvents.filter(v=>typeof v==='string').slice(-2000):[];
  world.practiceCharge=integer(world.practiceCharge,0,2);
  if(world.activeQuest&&!questPatterns.some(p=>p.objective===world.activeQuest.objective))world.activeQuest=null;
  return world;
}
export function getQuestBoard(world) {
  const w=createWorld(world);
  return [0,1,2].map(offset=>{
    const pattern=questPatterns[(w.cycle+offset*2)%questPatterns.length];
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
  const world=createWorld(saved);
  const reject=(message,needsStudy=false)=>({world,changed:false,feedback:{tone:'hint',message},needsStudy});
  if(event.id&&world.seenEvents.includes(String(event.id)))return {...reject('That action is already saved.'),duplicate:true};
  const spend=amount=>world.energy>=amount;
  const costs=(resources={})=>Object.entries(resources).every(([key,n])=>world.resources[key]>=n);
  let feedback='',tone='success',reward=null;
  switch(event.type){
    case 'travel':{
      if(!WORLD_ZONES.some(z=>z.id===event.zone))return reject('Choose a place on the island.');
      if(world.zone===event.zone)return reject('You are already here.');
      world.zone=event.zone;feedback=`Arrived at ${WORLD_ZONES.find(z=>z.id===event.zone).name}.`;tone='arrival';break;
    }
    case 'study-answer':{
      if(!event.id)return reject('Study answers need a unique event ID to save safely.');
      if(typeof event.correct!=='boolean')return reject('A study answer needs a correct or incorrect result.');
      world.studyTurns++;world.stats.study++;
      if(event.correct===true){world.stats.correct++;world.energy=Math.min(world.maxEnergy,world.energy+3);world.practiceCharge=0;feedback='Good recall. +3 focus. Your garden grows one step.';tone='correct';}
      else{world.stats.incorrect++;world.practiceCharge++;if(world.practiceCharge>=3){world.practiceCharge=0;world.energy=Math.min(world.maxEnergy,world.energy+1);feedback='Keep practicing. +1 focus for working through three misses.';}else feedback=`A useful practice step. ${world.practiceCharge}/3 toward one focus. Your garden still grows.`;tone='practice';}
      break;
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
      const spec=WORLD_BUILDINGS[event.building];if(!spec)return reject('Choose a landmark to upgrade.');
      if(world.zone!==spec.zone)return reject(`Visit ${WORLD_ZONES.find(z=>z.id===spec.zone).name} to work on this landmark.`);
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
  world.lastFeedback={tone,message:feedback,id:String(event.id||`${event.type}-${world.studyTurns}-${world.stats.quests}`)};
  return {world:createWorld(world),changed:true,feedback:world.lastFeedback,reward,needsStudy:false};
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
  const zone=world.zone,night=zone==='observatory';
  const cropCount=world.plots.filter(Boolean).length;
  const beacon=world.buildings.beacon;
  return `<svg class="qw-island-svg" viewBox="0 0 760 430" role="img" aria-label="${escape(WORLD_ZONES.find(z=>z.id===zone).name)} island landscape"><defs><linearGradient id="qw-sky-${world.zone}" x2="0" y2="1"><stop stop-color="${night?'#343b73':'#b7e4e8'}"/><stop offset="1" stop-color="${night?'#7d81b2':'#e8edcc'}"/></linearGradient><linearGradient id="qw-water-${world.zone}" x2="0" y2="1"><stop stop-color="${night?'#6e86aa':'#83c6cf'}"/><stop offset="1" stop-color="${night?'#456689':'#56a1b5'}"/></linearGradient></defs><rect width="760" height="430" rx="30" fill="url(#qw-sky-${world.zone})"/>${night?'<g fill="#ffefd0"><circle cx="116" cy="62" r="2"/><circle cx="205" cy="38" r="3"/><circle cx="352" cy="73" r="2"/><circle cx="559" cy="35" r="2"/><circle cx="657" cy="90" r="3"/></g><circle cx="622" cy="56" r="27" fill="#f8e8c3"/><circle cx="632" cy="48" r="24" fill="#3f487e"/>':'<circle cx="610" cy="73" r="37" fill="#fff0bc"/><g class="qw-cloud" fill="#fff9e9" opacity=".8"><ellipse cx="137" cy="87" rx="50" ry="13"/><ellipse cx="115" cy="77" rx="26" ry="20"/><ellipse cx="150" cy="72" rx="28" ry="24"/></g><g class="qw-cloud qw-cloud-late" fill="#fff9e9" opacity=".6"><ellipse cx="481" cy="111" rx="50" ry="13"/><ellipse cx="460" cy="98" rx="26" ry="20"/></g>'}<path d="M0 215Q180 190 380 220T760 215v215H0Z" fill="url(#qw-water-${world.zone})"/><g class="qw-water-lines" fill="none" stroke="#d7eeeb" stroke-width="3" opacity=".4"><path d="M43 324h71m488-32h65M28 375h116m447 12h94M170 417h85m235-77h75"/></g><ellipse cx="380" cy="340" rx="264" ry="56" fill="#265d76" opacity=".16"/><path d="M131 276q247 123 500 0l-25 51q-221 109-450 0Z" fill="#a99284"/><path d="M156 309q224 105 450 0l-15 32q-212 89-418-3Z" fill="#877c7c"/><ellipse cx="380" cy="268" rx="250" ry="94" fill="${zone==='grove'?'#9fd1a0':'#afd3ab'}"/><path d="M171 270q95-81 218-33t175 51" fill="none" stroke="#e2d5ae" stroke-width="29" stroke-linecap="round"/><path d="M171 270q95-81 218-33t175 51" fill="none" stroke="#f0e5bf" stroke-width="20" stroke-linecap="round"/>${zone==='grove'?`${tree(208,211,.95)}${tree(284,175,.65)}${tree(571,250,.85)}<g transform="translate(363 260)"><path d="m-53 1 69-31 72 29-70 32Z" fill="#a47862"/><path d="m-38 0 54-22 54 22-53 23Z" fill="#805d51"/>${Array.from({length:Math.max(1,cropCount)},(_,i)=>`<g transform="translate(${i*27-18} ${i%2*9-2})"><path d="M0 0v-20m0 12q-18 0-14-13 16 0 14 13m0-5q14-13 19-1-5 12-19 1" fill="#b9e8b7" stroke="#548f75" stroke-width="2"/><circle cy="-17" r="7" fill="#f4bf6b"/></g>`).join('')}</g>${world.buildings.greenhouse?'<g transform="translate(435 203)"><path d="M0 40V0l35-27L70 0v40Z" fill="#dcf1df" stroke="#669888" stroke-width="5"/><path d="M35-27v67M0 0h70" stroke="#669888" stroke-width="4"/></g>':''}`:zone==='observatory'?`${tree(206,247,.8)}<g transform="translate(438 181)"><path d="M-57 79V0h114v79" fill="#e6dec9"/><path d="M-66 1a66 66 0 0 1 132 0Z" fill="#8b84b2"/><path d="M-37-23q32-41 65-4" fill="none" stroke="#bdb3d8" stroke-width="8"/><path d="M-50 79h100M-8 25h24v54H-8" fill="#7b7b9e"/><g transform="translate(4 -26) rotate(-25)"><path d="M-9-10h78v22H-9Z" fill="#d9bf80" stroke="#6a6987" stroke-width="5"/><ellipse cx="70" cy="1" rx="8" ry="13" fill="#9bd4e1" stroke="#6a6987" stroke-width="4"/></g></g><g fill="#f7dfa8" opacity=".9"><path d="m305 205 7 12 14 2-11 10 2 14-12-7-12 7 2-14-11-10 14-2Z"/><path d="m574 257 5 8 9 1-7 7 2 10-9-5-8 5 2-10-7-7 9-1Z"/></g>`:`${tree(210,233,.8)}<g transform="translate(448 142)"><path d="M-33 130-25 17h50l8 113Z" fill="#f1e9cc"/><path d="M-26 41h52l4 28h-60" fill="#e7a882"/><path d="M-25 17V-9h50v26" fill="#6a8492"/><path d="M-36-11 0-41l36 30Z" fill="#d79577"/><path d="M-10-4h20v20h-20" fill="${beacon?'#ffeb96':'#c5d4ce'}"/><path d="M-8 94h16v36H-8" fill="#798e98"/>${beacon?'<path class="qw-beacon-glow" d="M-11 1-166-30v63L-11 11m22-10 155-31v63L11 11" fill="#ffe4a5" opacity=".24"/>':''}</g><path d="m532 291 87 34v13l-87-31Z" fill="#b49b7b"/><path d="M550 306v34m25-24v34m25-24v27" stroke="#887b6c" stroke-width="7"/><g class="qw-boat" transform="translate(631 326)"><path d="M-40 0h81L24 20h-48Z" fill="#786985"/><path d="M0-69V0m0-61 31 46H0" fill="#f1e2b7" stroke="#8a7e85" stroke-width="4"/></g>`}<g transform="translate(285 267)"><ellipse cy="30" rx="27" ry="7" fill="#376e71" opacity=".18"/><path d="M-18-11-24-27-9-19H9l15-8-6 16c14 27-3 42-18 42s-32-15-18-42Z" fill="#68b1c8"/><ellipse cx="-9" cy="1" rx="12" ry="15" fill="#fff6dc"/><ellipse cx="9" cy="1" rx="12" ry="15" fill="#fff6dc"/><circle cx="-9" cy="2" r="4" fill="#30435b"/><circle cx="9" cy="2" r="4" fill="#30435b"/><path d="m-4 12 4 5 4-5" fill="#efb768"/></g></svg>`;
}
function actionButton(label,action,attributes='',disabled=false,secondary=false){return `<button type="button" class="qw-action ${secondary?'qw-action-secondary':''}" data-qw-action="${action}" ${attributes} ${disabled?'disabled':''}>${label}</button>`;}
function zoneActions(world){
  const specEntry=Object.entries(WORLD_BUILDINGS).find(([,b])=>b.zone===world.zone),[building,spec]=specEntry;
  const level=world.buildings[building];
  const upgrade=`<div class="qw-landmark"><div><span class="qw-micro">Island landmark · level ${level}/${spec.maxLevel}</span><h4>${spec.name}</h4><p>${level>=spec.maxLevel?'Fully restored. Your island keeps growing through quests.':`${spec.wood+level} timber · ${spec.crystal+Math.floor(level/2)} starlight · ${spec.energy} focus`}</p></div>${actionButton(level>=spec.maxLevel?'Restored':'Upgrade','build',`data-qw-building="${building}"`,level>=spec.maxLevel,true)}</div>`;
  if(world.zone==='grove')return `<div class="qw-garden" aria-label="Three garden plots">${world.plots.map((plot,i)=>{const ready=plot&&plot.readyAt<=world.studyTurns,remaining=plot?Math.max(0,plot.readyAt-world.studyTurns):0;return `<div class="qw-plot ${plot?'is-planted':''} ${ready?'is-ready':''}"><span class="qw-micro">Plot ${i+1}</span><span class="qw-sprout" aria-hidden="true">${icon(plot?'crops':'seeds')}</span><strong>${ready?'Ready to harvest':plot?`${remaining} answers to grow`:'A new beginning'}</strong>${plot?actionButton(ready?'Harvest · 1 focus':'Tend · 1 focus',ready?'harvest':'tend',`data-qw-plot="${i}"`):actionButton('Plant · 1 focus','plant',`data-qw-plot="${i}"`)}</div>`;}).join('')}</div><div class="qw-action-row">${actionButton(`${icon('wood')} Gather timber · 1 focus`,'gather','data-qw-resource="wood"',false,true)}</div>${upgrade}`;
  if(world.zone==='observatory')return `<div class="qw-zone-note"><div class="qw-zone-emblem">${icon('crystal')}</div><div><h4>Catch a little starlight</h4><p>The telescope’s lens collects a crystal with every focused expedition. Use them to restore landmarks and craft lanterns.</p></div></div><div class="qw-action-row">${actionButton(`${icon('crystal')} Collect starlight · 1 focus`,'gather','data-qw-resource="crystal"')}</div>${upgrade}`;
  return `<div class="qw-recipes"><div><span class="qw-zone-emblem">${icon('lanterns')}</span><h4>Make a lantern</h4><p>2 timber + 1 starlight + 2 focus</p>${actionButton('Craft lantern','craft','data-qw-recipe="lantern"')}</div><div><span class="qw-zone-emblem">${icon('seeds')}</span><h4>A fresh seed pouch</h4><p>2 glowfruit + 1 focus → 3 seeds</p>${actionButton('Craft seeds','craft','data-qw-recipe="seeds"',false,true)}</div></div>${upgrade}`;
}
export function renderQuestWorld(saved,options={}) {
  const world=createWorld(saved),zone=WORLD_ZONES.find(z=>z.id===world.zone),progress=questProgress(world),mode=options.mode==='coop'?'coop':'solo';
  const active=world.activeQuest;
  const playerNames=(options.playerNames||[]).filter(Boolean).slice(0,8);
  return `<section class="quest-world" aria-label="Study-powered island adventure"><div class="qw-heading"><div><span class="qw-micro">The Lantern Isles · Chapter ${world.chapter}</span><h2>A little study. A bigger world.</h2><p>Answer a question, earn focus, and make your next move.</p></div><div class="qw-mode-switch" role="group" aria-label="Island mode"><button type="button" data-qw-mode="solo" aria-pressed="${mode==='solo'}" class="${mode==='solo'?'is-active':''}">My island</button><button type="button" data-qw-mode="coop" aria-pressed="${mode==='coop'}" class="${mode==='coop'?'is-active':''}" ${options.coopDisabled?'disabled':''}>Guild island</button></div></div><div class="qw-layout"><div class="qw-main"><div class="qw-resource-strip" aria-label="Island resources">${['energy','seeds','wood','crystal','crops','lanterns','coins'].map(key=>`<div class="qw-resource qw-resource-${key}" title="${resourceNames[key]}">${icon(key)}<span><strong>${key==='energy'?`${world.energy}/${world.maxEnergy}`:world.resources[key]}</strong><small>${resourceNames[key]}</small></span></div>`).join('')}</div><div class="qw-map"><div class="qw-map-label"><span class="qw-map-pin">${icon('compass')}</span><div><h3>${zone.name}</h3><p>${zone.caption}</p></div></div>${islandArt(world)}<span class="qw-map-caption">${world.stats.quests} quests completed · ${world.studyTurns} study turns</span></div><nav class="qw-zone-tabs" aria-label="Travel around the island">${WORLD_ZONES.map(z=>`<button type="button" data-qw-action="travel" data-qw-zone="${z.id}" aria-current="${world.zone===z.id?'location':'false'}" class="${world.zone===z.id?'is-active':''}"><span class="qw-zone-dot" style="--zone-color:${z.color}"></span>${z.name.replace('Lantern ','').replace('Recall ','').replace('Starlight ','')}</button>`).join('')}</nav><div class="qw-feedback qw-feedback-${escape(world.lastFeedback?.tone||'hint')}" role="status" aria-live="polite"><span>${icon(world.lastFeedback?.tone==='quest'?'coins':'energy')}</span><p>${escape(options.feedback?.message||world.lastFeedback?.message||'Your first three focus are ready. Plant a seed or explore the island, then answer a question to keep going.')}</p></div><div class="qw-location-actions">${zoneActions(world)}</div></div><aside class="qw-sidebar">${renderPlayerCard({name:options.playerName||'Ollie’s companion',avatarHtml:options.avatarHtml,level:world.chapter,subtitle:mode==='coop'?'Building something together':'Your next adventure starts with one answer'})}${mode==='coop'?`<div class="qw-coop-note"><span class="qw-micro">Turn-based co-op</span><p>${playerNames.length?playerNames.map(escape).join(' · '):'Guild members share this island.'}</p><small>Every saved answer contributes to your shared world. Each member keeps their own study progress.</small></div>`:''}<div class="qw-next-answer"><span class="qw-micro">The next move is yours</span><h3>${world.energy<2?'A question unlocks more.':'Keep the island growing.'}</h3><p>Correct recall earns 3 focus. Every answer advances growing plants. No real-time waiting.</p><button type="button" class="qw-study-button" data-qw-study>${icon('energy')} Answer a question <span aria-hidden="true">→</span></button></div><div class="qw-quest-board"><div class="qw-section-heading"><span class="qw-micro">${active?'Current quest':'Choose a route'}</span><span>${icon('compass')}</span></div>${active?`<h3>${escape(active.title)}</h3><p>${escape(active.body)}</p><div class="qw-quest-meter" role="progressbar" aria-label="Quest progress" aria-valuemin="0" aria-valuemax="${progress.target}" aria-valuenow="${progress.done}"><span style="width:${progress.pct}%"></span></div><div class="qw-quest-count">${progress.done}/${progress.target} ${objectiveNames[active.objective]}<span>+${integer(active.reward,1,100)} coins</span></div>${actionButton(progress.complete?'Collect reward':'Keep exploring','claim-quest','',!progress.complete)}`:getQuestBoard(world).map(q=>`<button type="button" class="qw-quest-choice" data-qw-action="select-quest" data-qw-quest-id="${q.id}"><span>${escape(q.title)}</span><small>${q.target} ${objectiveNames[q.objective]} · +${q.reward} coins</small><span class="qw-quest-arrow" aria-hidden="true">↗</span></button>`).join('')}</div><div class="qw-story"><span class="qw-micro">From the island journal</span><p>${stories[(world.chapter-1)%stories.length]}</p></div></aside></div></section>`;
}
export function bindQuestWorld(root,callbacks={}) {
  const removers=[];
  const on=(element,event,handler)=>{element.addEventListener(event,handler);removers.push(()=>element.removeEventListener(event,handler));};
  root.querySelectorAll('[data-qw-action]').forEach(button=>on(button,'click',()=>{
    const data=button.dataset;
    const action={type:data.qwAction};
    for(const [key,dataKey] of [['zone','qwZone'],['questId','qwQuestId'],['resource','qwResource'],['building','qwBuilding'],['recipe','qwRecipe']])if(data[dataKey])action[key]=data[dataKey];
    if(data.qwPlot!==undefined)action.plot=Number(data.qwPlot);
    callbacks.onAction?.(action);
  }));
  root.querySelectorAll('[data-qw-study]').forEach(button=>on(button,'click',()=>callbacks.onStudy?.()));
  root.querySelectorAll('[data-qw-mode]').forEach(button=>on(button,'click',()=>callbacks.onMode?.(button.dataset.qwMode)));
  return ()=>removers.forEach(remove=>remove());
}
