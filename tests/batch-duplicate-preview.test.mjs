import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {renderExperience,bindExperience} from '../js/experience.js';
const dom=new JSDOM('<main id="root"></main>',{url:'https://controlquest.test'});for(const k of ['window','document','localStorage','navigator','FileReader'])Object.defineProperty(globalThis,k,{value:dom.window[k],configurable:true});
const $=selector=>document.querySelector(selector),question=n=>`Which evidence number ${n} is BEST?`;
const cards=Array.from({length:13},(_,i)=>({id:`existing-${i+1}`,scope:'Personal',scopeKey:'personal_audit-user',question:question(i+1),choices:{A:'Independent confirmation',B:'Assumption'},correctAnswer:'A',lessonId:'d1-t05',deckIds:[]}));
const text=cards.map((c,i)=>`Question ${i+1} of 13\nQuestion\n${c.question}\nA. Independent confirmation\nB. Assumption\nA is the correct answer.\nJustification\nA. Evidence is reliable.\nB. Assumptions are not evidence.\nDomain1 Audit\nKnowledge Statement1B1Audit Project Management\nYour result is incorrect.\nYour answer is B.\nCorrect answer is A.`).join('\n\n');
const c={user:{uid:'audit-user'},profile:{activeGroupId:null,v3:{}},group:null,library:{cards,decks:[],progress:{},reviews:[]},save:async()=>{},toast:()=>{},navigate:()=>{},render(){document.querySelector('#root').innerHTML=renderExperience('import',c);bindExperience('import',c);}};
try{
 c.render();Object.defineProperty($('#cqBatchFiles'),'files',{value:[new window.File([text],'Audit Project Management.txt')]});$('#cqBatchFiles').dispatchEvent(new window.Event('change',{bubbles:true}));
 for(let i=0;i<300&&!$('.cq-import-audit');i++)await new Promise(r=>setTimeout(r,5));
 assert.ok($('.cq-import-audit'));assert.match($('.cq-batch-summary').textContent,/13 already uploaded/);assert.match($('.cq-import-audit').textContent,/13 already uploaded/);
 assert.match($('.cq-import-audit').textContent,/existing-1/);assert.equal($('.cq-import-audit').textContent.includes('existing-13'),false,'Large comparison lists are paged');
 $('[data-cq-audit-page="0:1"]').click();assert.equal($('.cq-import-audit').open,true);assert.match($('.cq-import-audit').textContent,/existing-13/);assert.match($('.cq-import-audit').textContent,/personal_audit-user/);assert.match($('.cq-import-audit').textContent,/independent confirmation/);
 assert.ok($('#cqRunBatch'),'Comparison leaves the reviewable import controls available');
 console.log('Batch duplicate preview: existing-question counts, exact IDs/scopes/answer comparison and paged review before import passed.');
}finally{dom.window.close();}
