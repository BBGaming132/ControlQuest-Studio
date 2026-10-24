import assert from 'node:assert/strict';
import { LESSONS } from '../js/lesson-catalog.js';
import { CISA_MICROLESSONS, CISA_DOMAIN_WEIGHTS, CISA_EXAM_BLUEPRINT, LEARNING_SOURCES, AI_LEARNING_OPTIONS, getMicroLesson, microLessonsForDomain, microLessonSpeechText } from '../js/cisa-learning.js';

const syllabus=LESSONS.filter(l=>/^d[1-5]-/.test(l.id));
assert.equal(CISA_MICROLESSONS.length,60,'Every existing non-practice lesson has original learning content');
assert.deepEqual(new Set(CISA_MICROLESSONS.map(l=>l.id)),new Set(syllabus.map(l=>l.id)));
assert.equal(Object.values(CISA_DOMAIN_WEIGHTS).reduce((a,b)=>a+b,0),100);
assert.deepEqual(Object.values(CISA_DOMAIN_WEIGHTS),[18,18,12,26,26]);
assert.equal(CISA_EXAM_BLUEPRINT.questionCount,150);
assert.equal(new Set(CISA_MICROLESSONS.map(l=>l.concept)).size,60,'Concepts are topic-specific');
assert.equal(new Set(CISA_MICROLESSONS.map(l=>l.scenario)).size,60,'Scenarios are distinct');
assert.equal(new Set(CISA_MICROLESSONS.map(l=>l.checkpoint.question)).size,60,'Checkpoint prompts are distinct');
const sourceIds=new Set(LEARNING_SOURCES.map(s=>s.id));
const letters=new Set();
for(const lesson of CISA_MICROLESSONS){
  assert.equal(lesson.original,true);assert.equal(lesson.official,false);
  assert.ok(lesson.title&&lesson.domainId&&lesson.domain);
  for(const key of ['concept','scenario','trap','retrievalPrompt'])assert.ok(lesson[key].trim().length>25,`${lesson.id}: ${key}`);
  assert.ok(lesson.concept.length>150,`${lesson.id}: useful teaching point`);
  assert.ok(lesson.sourceIds.every(id=>sourceIds.has(id)));
  const checkpoint=lesson.checkpoint;
  assert.deepEqual(Object.keys(checkpoint.choices),['A','B','C','D']);
  assert.equal(new Set(Object.values(checkpoint.choices)).size,4);
  assert.ok(checkpoint.choices[checkpoint.correctAnswer]);letters.add(checkpoint.correctAnswer);
  assert.ok(checkpoint.rationale.length>60);
  assert.equal(getMicroLesson(lesson.id),lesson);
  const speech=microLessonSpeechText(lesson.id);
  assert.ok(speech.includes(lesson.concept)&&speech.includes(lesson.retrievalPrompt));
  assert.ok(!speech.includes(checkpoint.rationale),'Audio prompt does not reveal checkpoint rationale');
}
assert.equal(letters.size,4,'Correct choice is distributed across all four positions');
assert.deepEqual(['d1','d2','d3','d4','d5'].map(id=>microLessonsForDomain(id).length),[10,11,8,16,15]);
assert.equal(getMicroLesson('unknown'),null);assert.equal(microLessonSpeechText('unknown'),'');
assert.equal(microLessonsForDomain('').length,60);
assert.ok(AI_LEARNING_OPTIONS.some(o=>o.id==='ollama'&&o.endpoint==='http://localhost:11434/api/chat'));
assert.ok(AI_LEARNING_OPTIONS.some(o=>o.id==='webllm'));
assert.ok(LEARNING_SOURCES.every(s=>s.url.startsWith('https://')));
console.log('CISA micro-learning tests passed: 60 mapped topics, 60 distinct original scenarios/checkpoints, source linkage, blueprint weights and audio prompts.');
