/** Personal, review-first task handoff. No tokens, network writes, or game credits. */
export const DEFAULT_EVERSTEAD_URL='https://everstead-seven.vercel.app/';
export const CONTROLQUEST_STUDY_URL='https://bbgaming132.github.io/ControlQuest-Studio/';
const bounded=(value,fallback,min,max)=>Number.isFinite(Number(value))?Math.max(min,Math.min(max,Math.round(Number(value)))):fallback;

/** Accept only a real Todoist task link, never a credential-bearing arbitrary URL. */
export function normalizeTodoistTaskUrl(value){
  if(!String(value||'').trim())return '';
  let url;try{url=new URL(String(value).trim());}catch{throw new Error('Paste a Todoist task link, or leave it blank.');}
  if(url.protocol!=='https:'||url.username||url.password||url.port||!['app.todoist.com','todoist.com','www.todoist.com'].includes(url.hostname))throw new Error('Use an HTTPS task link from Todoist.');
  const task=url.pathname.match(/^\/app\/task\/([A-Za-z0-9_-]+)\/?$/);
  if(task)return `https://app.todoist.com/app/task/${task[1]}`;
  if(url.pathname==='/showTask'&&/^[A-Za-z0-9_-]+$/.test(url.searchParams.get('id')||''))return `https://todoist.com/showTask?id=${encodeURIComponent(url.searchParams.get('id'))}`;
  throw new Error('Use a link to one Todoist task, not a project or inbox.');
}

/** The optional destination is account-private. Never embed an auth token in it. */
export function normalizeEversteadUrl(value){
  if(!String(value||'').trim())return DEFAULT_EVERSTEAD_URL;
  let url;try{url=new URL(String(value).trim());}catch{throw new Error('Use an HTTPS Everstead app address.');}
  if(url.protocol!=='https:'||url.username||url.password||url.search||url.hash)throw new Error('Use an HTTPS Everstead address without credentials or query parameters.');
  return url.href;
}

/** Only summary counts cross the handoff; question text and names stay in ControlQuest. */
export function buildStudyMission(plan={},options={}){
  const minutes=bounded(plan.minutes,10,1,60);
  const questions=bounded(plan.questionCount??plan.targetQuestions,Math.round(minutes*1.5),1,100);
  const due=options.recurring===true?'every day':options.due==='today'?'today':'';
  const title=`Study CISA: ${questions} questions (${minutes} minutes)`;
  const description=`Open ControlQuest, start the recommended session, read each explanation, then rate your recall.\n${CONTROLQUEST_STUDY_URL}\nComplete this task in Todoist after studying. If you use Everstead, sync Todoist there for its verified task rewards. ControlQuest does not create Everstead credits.`;
  return Object.freeze({title,description,minutes,questions,due,recurring:options.recurring===true,status:'draft',requiresReview:true});
}

/** Official URL schemes open a prefilled add view; the user must press Add in Todoist. */
export function todoistMissionLinks(mission){
  if(!mission||typeof mission.title!=='string'||!mission.title.trim())throw new Error('Build a study mission first.');
  const title=mission.title.slice(0,500),description=String(mission.description||'').slice(0,2000);
  const due=['today','every day'].includes(mission.due)?mission.due:'';
  const mobile='todoist://addtask?content='+encodeURIComponent(title)+(due?'&date='+encodeURIComponent(due):'');
  // Desktop quick add supports content/description. Natural-language dates belong in content.
  const desktop='todoist://openquickadd?content='+encodeURIComponent(title+(due?' '+due:''))+'&description='+encodeURIComponent(description);
  return Object.freeze({mobile,desktop,web:'https://app.todoist.com/app/today',copyText:title+(due?' '+due:'')+'\n'+description});
}
