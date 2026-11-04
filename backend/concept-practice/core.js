import {createHash} from 'node:crypto';
export function normalizeRequest(body){
 if(body?.version!==1||typeof body.lessonId!=='string'||!/^[a-zA-Z0-9_-]{1,100}$/.test(body.lessonId)||!Number.isInteger(body.count)||body.count<10||body.count>15)throw new Error('Invalid practice request');
 if(!Array.isArray(body.concepts)||body.concepts.length<1||body.concepts.length>15||body.concepts.some(x=>typeof x!=='string'||!x.trim()||x.length>500))throw new Error('Invalid concepts');
 return {version:1,lessonId:body.lessonId,count:body.count,concepts:[...new Set(body.concepts.map(x=>x.trim()))].sort()};
}
export function catalogKey(request,model){return createHash('sha256').update(JSON.stringify({schema:1,model,...request})).digest('hex');}
const string={type:'string'};
const four={type:'object',additionalProperties:false,properties:{A:string,B:string,C:string,D:string},required:['A','B','C','D']};
export function practiceSchema(count){return {type:'object',additionalProperties:false,properties:{questions:{type:'array',minItems:count,maxItems:count,items:{type:'object',additionalProperties:false,properties:{question:string,concept:string,choices:four,correctAnswer:{type:'string',enum:['A','B','C','D']},justifications:four},required:['question','concept','choices','correctAnswer','justifications']}}},required:['questions']};}
export function validateGenerated(body,count){
 if(!Array.isArray(body?.questions)||body.questions.length!==count)throw new Error('Wrong question count');
 const seen=new Set();
 for(const q of body.questions){
  if(!q||typeof q.question!=='string'||!q.question.trim()||q.question.length>2000||typeof q.concept!=='string'||!q.concept.trim()||q.concept.length>160||!['A','B','C','D'].includes(q.correctAnswer))throw new Error('Invalid generated question');
  for(const field of ['choices','justifications'])if(!q[field]||Object.keys(q[field]).sort().join('')!=='ABCD'||Object.values(q[field]).some(x=>typeof x!=='string'||!x.trim()||x.length>(field==='choices'?800:2000)))throw new Error('Invalid choices or explanations');
  if(new Set(Object.values(q.choices).map(x=>x.trim().toLowerCase())).size!==4)throw new Error('Repeated choice');
  const key=q.question.toLowerCase().replace(/\W/g,'');if(seen.has(key))throw new Error('Repeated question');seen.add(key);
 }
 if(Buffer.byteLength(JSON.stringify(body))>140000)throw new Error('Generated set too large');
 return body;
}
