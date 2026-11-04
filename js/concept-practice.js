import {sha256Hex} from './runtime-crypto.js';
const clean=(v,max=2000)=>typeof v==='string'?v.trim().slice(0,max):'';
export function practiceCount(misses){return Math.min(15,Math.max(10,Math.ceil(Number(misses)||0)));}
export function validatePracticeSet(value,{lessonId,count=10}={}){
 if(!value||!Array.isArray(value.questions)||value.questions.length!==count)throw new Error(`The generator must return exactly ${count} questions.`);
 const seen=new Set();
 const questions=value.questions.map((q,i)=>{
  const question=clean(q.question),concept=clean(q.concept,160),choices=q.choices,answer=q.correctAnswer;
  if(!question||!concept||!choices||Object.keys(choices).sort().join('')!=='ABCD'||!['A','B','C','D'].includes(answer))throw new Error(`Generated question ${i+1} is incomplete.`);
  const options=Object.fromEntries(Object.entries(choices).map(([k,v])=>[k,clean(v,800)]));
  if(Object.values(options).some(x=>!x)||new Set(Object.values(options).map(x=>x.toLowerCase())).size!==4)throw new Error('Generated choices must be distinct.');
  const identity=question.toLowerCase().replace(/\W/g,'');if(seen.has(identity))throw new Error('The generator repeated a question.');seen.add(identity);
  const justifications=Object.fromEntries(['A','B','C','D'].map(k=>[k,clean(q.justifications?.[k])]));
  if(Object.values(justifications).some(x=>!x))throw new Error('Every choice needs an explanation of why it is stronger or weaker.');
  return {question,concept,choices:options,correctAnswer:answer,justifications,lessonId,source:'AI-generated concept practice',homeworkExcluded:true,aiGenerated:true,reviewStatus:'unverified',domainNumber:Number(lessonId?.match(/^d(\d)/)?.[1])||null};
 });
 return {questions,disclaimer:'AI-generated practice, not official ISACA questions. Check uncertain explanations against your course material.'};
}
export function generationEndpoint(raw){
 let url;try{url=new URL(raw);}catch{throw new Error('Enter the HTTPS address of your secured practice service.');}
 if(url.protocol!=='https:'||url.username||url.password||url.search||url.hash)throw new Error('Use an HTTPS endpoint without credentials or query parameters.');
 return url.href;
}
export async function requestConceptPractice({endpoint,getToken,lessonId,concepts,missCount,signal,fetcher=fetch}){
 const url=generationEndpoint(endpoint),count=practiceCount(missCount);
 const topics=[...new Set((concepts||[]).map(x=>clean(x,500)).filter(Boolean))].slice(0,15);
 if(!topics.length)throw new Error('Choose the concepts from your missed questions first.');
 if(typeof getToken!=='function')throw new Error('Sign in before requesting concept practice.');
 const token=await getToken();if(!token)throw new Error('Sign in before requesting concept practice.');
 const controller=new AbortController(),abort=()=>controller.abort();signal?.addEventListener('abort',abort,{once:true});if(signal?.aborted)abort();
 const timeout=setTimeout(abort,60000);
 try{
 const response=await fetcher(url,{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`},body:JSON.stringify({version:1,lessonId,concepts:topics,count,requestKey:await sha256Hex(JSON.stringify({lessonId,concepts:topics.slice().sort(),count}))}),signal:controller.signal});
 if(!response.ok)throw new Error(`Practice service returned ${response.status}. Your lesson progress is unchanged.`);
 const text=await response.text();if(text.length>150000)throw new Error('Practice service returned too much data.');
 const body=JSON.parse(text);if(!clean(body.catalogId,200))throw new Error('The service did not confirm a saved catalog entry.');
 const set=validatePracticeSet(body,{lessonId,count});
 return {...set,catalogId:clean(body.catalogId,200),generatedAt:new Date().toISOString(),model:clean(body.model,100),reused:body.reused===true};
 }finally{clearTimeout(timeout);signal?.removeEventListener('abort',abort);}
}
export async function catalogPracticeSet(set,{storage=localStorage,uid}={}){
 if(!uid)throw new Error('A signed-in account is required.');
 const id=await sha256Hex(JSON.stringify(set.questions));
 const entry={...set,id,uid};storage.setItem(`cq-ai-catalog-${uid}-${id}`,JSON.stringify(entry));return entry;
}
export function practiceCards(set,uid){return set.questions.map((q,i)=>({...q,id:`ai_${set.id}_${i}`,scope:'Personal',scopeKey:`personal_${uid}`,ownerUid:uid,deckIds:[],catalogId:set.catalogId,aiModel:set.model,aiGeneratedAt:set.generatedAt}));}
const esc=v=>String(v||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function renderPracticeSetup(endpoint=''){
 return `<section class="panel"><h3>Concept practice service</h3><p>Generate 10–15 new scenarios around missed concepts. Every choice includes an explanation. Generated sets are labeled as AI practice and saved for reuse.</p><label>Secured service URL<input id="cqPracticeEndpoint" type="url" inputmode="url" style="font-size:16px;width:100%" value="${esc(endpoint)}" placeholder="https://your-service.example/practice"></label><button id="cqSavePracticeEndpoint" class="secondary-button">Save practice service</button><p>Use only your own trusted service: it receives your sign-in token and selected concepts. Your provider API key belongs in the service’s secret settings, never in this public website. ${endpoint?'Service configured; availability is checked when you generate a set.':'AI generation is not connected yet. Regular lessons and missed-question practice work without it.'}</p><p><a href="https://github.com/BBGaming132/ControlQuest-Studio/blob/main/docs/AI_CONCEPT_PRACTICE.md" target="_blank" rel="noopener noreferrer">Open the step-by-step AI setup guide</a></p></section>`;
}
export function bindPracticeSetup({root=document,save,toast}){root.querySelector('#cqSavePracticeEndpoint')?.addEventListener('click',async()=>{try{const raw=root.querySelector('#cqPracticeEndpoint').value.trim();await save(raw?generationEndpoint(raw):'');toast('Practice service settings saved.');}catch(error){toast(error.message,'error');}});}
