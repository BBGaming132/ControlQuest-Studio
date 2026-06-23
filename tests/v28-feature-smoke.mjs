import fs from 'node:fs';
import assert from 'node:assert/strict';
import { parseQaePaste } from '../js/qae-parser.js';
import { AVATAR_ITEMS, DAILY_QUEST_TEMPLATES, GAME_CATALOG } from '../js/content.js';

const sample = `Question 1 of 2\n\nQuestion\n\nWhich control is BEST?\n\nA. A.Preventive\n\nB. B.Detective\n\nC. C.Corrective\n\nD. D.Directive\n\nA is the correct answer.\n\nJustification\n\nA. Prevents the event.\nB. Detects later.\nC. Corrects later.\nD. Provides direction.\n\nDomain1 Information System Auditing Process\nKnowledge Statement1A3Risk-Based Audit Planning\nTask Statement2Conduct audits\n\nCorrect\nYour result is correct.\nYour answer is A.\nCorrect answer is A.\n\nQuestion 2 of 2\n\nQuestion\n\nWhat should the auditor do FIRST?\n\nA. A.Report externally\n\nB. B.Gather facts\n\nC. C.Stop the audit\n\nD. D.Ignore the issue\n\nB is the correct answer.\n\nJustification\nA. Not first.\nB. Understand the facts first.\nC. Not appropriate.\nD. Not appropriate.\n\nDomain1 Information System Auditing Process\nKnowledge Statement1A1IS Audit Standards\nTask Statement2Conduct audits\n\nIncorrect\nYour result is incorrect.\nYour answer is A.\nCorrect answer is B.`;
const parsed = parseQaePaste(sample);
assert.equal(parsed.questions.length, 2, `Expected 2 parsed questions, got ${parsed.questions.length}`);
assert.equal(parsed.questions[1].correctAnswer, 'B');
assert.ok(DAILY_QUEST_TEMPLATES.some(q => /Monday/i.test(q.details)), 'Daily quests should mention Monday recap');
assert.ok(AVATAR_ITEMS.filter(i => i.type === 'ship').length >= 4, 'Expected at least four starships');
assert.ok(GAME_CATALOG.some(g => g.id === 'spaceQuest'), 'Assurance Odyssey should exist');
const app = fs.readFileSync(new URL('../js/app.js', import.meta.url), 'utf8');
for (const token of ['Weekend Flex Block','Guild Starship Race','Assurance Odyssey','Reveal Answers','compressGuildImage','Review Mastered Cards']) {
  assert.ok(app.includes(token), `Missing feature marker: ${token}`);
}
console.log('ControlQuest v2.8 feature smoke test passed.');
