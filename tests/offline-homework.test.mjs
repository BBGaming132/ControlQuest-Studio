import assert from 'node:assert/strict';
import {homeworkJournal,pendingReviewEvents,mergePendingHomework,streakSnapshot} from '../js/offline-homework.js';
const map=new Map(),storage={getItem:k=>map.get(k)||null,setItem:(k,v)=>map.set(k,v),removeItem:k=>map.delete(k)};
const journal=homeworkJournal(storage,'a'),work={completions:{lesson:{completedAt:'2026-11-04T12:00:00Z'}}};
const first=journal.save(work,{lastStreakDate:'2026-11-04',streak:7});
assert.deepEqual(journal.read().homework,work);assert.equal(homeworkJournal(storage,'b').read(),null);
journal.save({...work,enrolledAt:'later'},{});journal.clear(first);assert.ok(journal.read());
const last=journal.read();journal.clear(last);assert.equal(journal.read(),null);
storage.setItem('cq-review-outbox-a-solo',JSON.stringify([{id:'x',card:{id:'c',scopeKey:'personal_a',choices:{A:'yes',B:'no'},correctAnswer:'A'},input:{selectedAnswer:'A',rating:'Good',reviewedAt:'2026-11-04T12:00:00Z'}}]));
assert.equal(pendingReviewEvents(storage,'a',null)[0].reviewedAt,'2026-11-04T12:00:00Z');
assert.equal(pendingReviewEvents(storage,'b',null).length,0);
assert.throws(()=>homeworkJournal({...storage,setItem(){throw Error('full');}},'a').save(work,{}),/full/);
console.log('Offline homework: durable owner isolation, original dates, compare-before-clear and storage failures pass.');

const merged=mergePendingHomework({quizzes:{week:{answer:'new'}},completions:{server:{completedAt:'new'}}},{quizzes:{week:{answer:'old'}},completions:{local:{completedAt:'original'}}});
assert.equal(merged.quizzes.week.answer,'new');assert.equal(merged.completions.local.completedAt,'original');assert.equal(merged.completions.server.completedAt,'new');
assert.throws(()=>mergePendingHomework({resetAt:'new'},{resetAt:'old'}),/Study memory changed/);
const safe=journal.save({quizzes:{huge:'not journaled'},completions:{}},{});assert.equal(journal.read().homework.quizzes,undefined);

const stats={xp:400,coins:200,qaeQuestions:30,streak:2,bestStreak:5,lastStreakDate:'2026-11-03',streakFreezes:1};
journal.save({}, {...stats,streak:3,lastStreakDate:'2026-11-04'});
assert.equal(journal.read().streak.xp,undefined);assert.equal(journal.read().streak.coins,undefined);
// Legacy entries may contain entire stats; restore must still whitelist.
Object.assign(stats,streakSnapshot({xp:1,coins:0,qaeQuestions:0,streak:3,bestStreak:5,lastStreakDate:'2026-11-04',streakFreezes:1}));
assert.equal(stats.xp,400);assert.equal(stats.coins,200);assert.equal(stats.qaeQuestions,30);assert.equal(stats.streak,3);
