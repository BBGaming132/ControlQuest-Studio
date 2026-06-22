import { parseQaePaste } from '../js/qae-parser.js';
import { buildImportBundle, mergeUniqueLibrary, defaultProgress, rateCard, buildStudyQueue } from '../js/flashcard-engine.js';

const sample = `Question 1 of 2
Question
Which approach is BEST?
A. A.First answer
B. B.Second answer
C. C.Third answer
D. D.Fourth answer
B is the correct answer.
Justification
A. Not best.
B. Best because risk is prioritized.
C. Not first.
D. Not sufficient.
Domain1 Information System Auditing Process
Knowledge Statement1B1Audit Project Management
Task Statement2Conduct audits in accordance with IS audit standards
Incorrect
Your result is incorrect.
Your answer is A.
Correct answer is B.

Question 2 of 2
Question
What is PRIMARY?
A. A.Alpha
B. B.Beta
C. C.Gamma
D. D.Delta
C is the correct answer.
Justification
A. No.
B. No.
C. Yes.
D. No.
Domain1 Information System Auditing Process
Knowledge Statement1A1IS Audit Standards
Task Statement1Plan an audit
Correct
Your result is correct.
Your answer is C.
Correct answer is C.`;

const parsed = parseQaePaste(sample);
if (parsed.questions.length !== 2) throw new Error('Expected two parsed questions.');
const bundle = buildImportBundle({ questions: parsed.questions, title: 'Smoke Test', scope: 'Guild', uid: 'user', groupId: 'guild', importedBy: 'Tester' });
if (bundle.decks.length !== 3) throw new Error('Expected lesson/master/missed decks.');
if (bundle.cards.length !== 2 || bundle.incorrect !== 1) throw new Error('Unexpected card or miss count.');
const merged = mergeUniqueLibrary({ decks: bundle.decks, cards: bundle.cards }, bundle);
if (merged.cards.length !== 2) throw new Error('Question dedupe failed.');
const card = bundle.cards[0];
const progress = rateCard(card, defaultProgress(card, 'user'), 'Again');
if (progress.incorrectCount !== 1) throw new Error('Adaptive rating failed.');
if (!buildStudyQueue(bundle.cards, { [`${card.scopeKey}__${card.id}`]: progress }, { mode: 'missed', limit: 20 }).length) throw new Error('Missed queue failed.');
console.log('ControlQuest v2.7 adaptive library smoke test passed.');
