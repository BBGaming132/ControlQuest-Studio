// Deterministic ISACA QAE paste parser for ControlQuest Studio.
// This intentionally uses regex + validation, not AI. It supports the common paste styles from ISACA Perform/QAE review screens.

const LETTERS = ['A','B','C','D'];
const clean = value => String(value || '')
  .replace(/\r/g, '')
  .replace(/[ \t]+\n/g, '\n')
  .replace(/\n{3,}/g, '\n\n')
  .trim();

function uniqSorted(values){ return [...new Set(values)].sort((a,b)=>a-b); }
function hashText(text){
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h += (h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24); }
  return (h >>> 0).toString(36);
}
function normalizeKnowledge(value){
  const v = clean(value).replace(/\s+–\s+/, ' - ');
  return v.replace(/^(\d[A-Z]\d)([^\s-])/, '$1 $2');
}
function normalizeTask(value){ return clean(value).replace(/^(\d+)([^\s])/, '$1 $2'); }

export function parseQaePaste(rawText, opts = {}){
  const text = clean(rawText);
  const warnings = [];
  if (!text) return { questions: [], warnings: ['No text was provided.'] };

  const marker = /(?:^|\n)(?=(?:(.{1,90}?:)\s*)?Question\s+\d+(?:\s+of\s+\d+)?\b|\d+\s+of\s+\d+\s*\n\s*Question\b)/g;
  const starts = [];
  let m;
  while ((m = marker.exec(text)) !== null) {
    starts.push(m.index + (text[m.index] === '\n' ? 1 : 0));
    if (marker.lastIndex === m.index) marker.lastIndex++;
  }
  const uniqueStarts = uniqSorted(starts);
  if (!uniqueStarts.length) warnings.push('No numbered Question markers were found. Paste from the QAE review screen after the answers are visible.');

  const blocks = uniqueStarts.map((start, i) => text.slice(start, uniqueStarts[i + 1] || text.length).trim()).filter(Boolean);
  const questions = blocks.map((block, index) => parseBlock(block, index + 1)).filter(q => {
    const valid = q.question && q.correctAnswer && Object.keys(q.choices).length >= 2;
    if (!valid) warnings.push(`Skipped a block near item ${index + 1} because the parser could not identify the question, answer choices, and correct answer.`);
    return valid;
  });

  const inferredTotals = [...new Set(questions.map(q => q.totalInSet).filter(Boolean))];
  if (inferredTotals.length > 1) warnings.push('This paste appears to include multiple sessions or mixed totals. The app imported them together, but you may want to import sessions separately for cleaner logging.');
  return { questions, warnings };
}

function parseBlock(block, fallbackNumber){
  const titleMatch = block.match(/^(.{1,90}?):\s*Question\s+(\d+)(?:\s+of\s+(\d+))?/i);
  const simpleMatch = block.match(/^Question\s+(\d+)(?:\s+of\s+(\d+))?/i);
  const firstStyleMatch = block.match(/^(\d+)\s+of\s+(\d+)\s*\n\s*Question/i);
  const sessionTitle = titleMatch ? clean(titleMatch[1]) : '';
  const number = Number(titleMatch?.[2] || simpleMatch?.[1] || firstStyleMatch?.[1] || fallbackNumber);
  const totalInSet = Number(titleMatch?.[3] || simpleMatch?.[2] || firstStyleMatch?.[2] || 0) || null;

  let body = block;
  if (titleMatch) body = body.slice(titleMatch[0].length).trim();
  else if (simpleMatch) body = body.slice(simpleMatch[0].length).trim();
  else if (firstStyleMatch) body = body.slice(firstStyleMatch[0].length).trim();

  const questionHeading = body.search(/(?:^|\n)Question\s*\n/i);
  if (questionHeading >= 0) body = body.slice(questionHeading).replace(/^(?:\n)?Question\s*\n/i, '').trim();

  const correctByPhrase = body.match(/\n\s*([A-D])\s+is the correct answer\./i);
  const correctByResult = body.match(/Correct answer is\s*([A-D])/i);
  const correctAnswer = (correctByPhrase?.[1] || correctByResult?.[1] || '').toUpperCase();
  const beforeCorrect = correctByPhrase ? body.slice(0, correctByPhrase.index).trim() : body;

  const firstChoice = beforeCorrect.search(/(?:^|\n)\s*A\.\s*(?:A\.)?/);
  const question = firstChoice >= 0 ? clean(beforeCorrect.slice(0, firstChoice)) : clean(beforeCorrect);
  const choices = {};
  const choiceRegex = /(?:^|\n)\s*([A-D])\.\s*(?:[A-D]\.)?\s*([\s\S]*?)(?=(?:\n\s*[A-D]\.\s*(?:[A-D]\.)?)|$)/g;
  let cm;
  while ((cm = choiceRegex.exec(beforeCorrect)) !== null) {
    const letter = cm[1].toUpperCase();
    const value = clean(cm[2]);
    if (LETTERS.includes(letter) && value) choices[letter] = value;
  }

  const justifications = {};
  const justMatch = body.match(/Justification\s*([\s\S]*?)(?:\n\s*Domain\b|\nDomain\s*\n|\n\s*Incorrect|\n\s*Correct|$)/i);
  const justText = clean(justMatch?.[1] || '');
  if (justText) {
    const positions = [];
    const rx = /(?:^|\n)\s*([A-D])\.\s*/g;
    let jm;
    while ((jm = rx.exec(justText)) !== null) positions.push({letter: jm[1].toUpperCase(), start: jm.index, textStart: rx.lastIndex});
    positions.forEach((pos, i) => {
      const end = positions[i + 1]?.start ?? justText.length;
      justifications[pos.letter] = clean(justText.slice(pos.textStart, end));
    });
    if (!Object.keys(justifications).length) justifications._ = justText;
  }

  const domainMatch = body.match(/Domain\s*\n?\s*(\d+)\s*([^\n]+)/i) || body.match(/Domain(\d+)\s*([^\n]+)/i);
  const domainNumber = domainMatch ? Number(domainMatch[1]) : null;
  const domainName = clean(domainMatch?.[2] || '');
  const knowledgeStatement = normalizeKnowledge((body.match(/Knowledge Statement\s*\n?\s*([^\n]+)/i) || [])[1] || '');
  const taskStatement = normalizeTask((body.match(/Task Statement\s*\n?\s*([^\n]+)/i) || [])[1] || '');
  const userAnswer = ((body.match(/Your answer is\s*([A-D])/i) || [])[1] || '').toUpperCase() || null;
  const resultWord = (body.match(/Your result is\s*(correct|incorrect)/i) || [])[1];
  const result = resultWord ? resultWord[0].toUpperCase() + resultWord.slice(1).toLowerCase() : (userAnswer && correctAnswer ? (userAnswer === correctAnswer ? 'Correct' : 'Incorrect') : '');
  const timeSpent = clean((body.match(/Time Spent:\s*\n?\s*([^\n]+)/i) || [])[1] || '');
  const difficulty = clean((body.match(/Difficulty Level:\s*\n?\s*([^\n]+)/i) || [])[1] || '');

  const fingerprint = hashText(`${question}|${Object.values(choices).join('|')}|${correctAnswer}`.toLowerCase());
  return {
    id: `qae-${fingerprint}`,
    importedAt: new Date().toISOString(),
    source: 'ISACA QAE Paste',
    sessionTitle,
    number,
    totalInSet,
    question,
    choices,
    correctAnswer,
    userAnswer,
    result,
    isCorrect: result ? result === 'Correct' : (userAnswer ? userAnswer === correctAnswer : null),
    justifications,
    domainNumber,
    domainName,
    domain: domainNumber ? `Domain ${domainNumber}: ${domainName}` : '',
    knowledgeStatement,
    taskStatement,
    timeSpent,
    difficulty,
    fingerprint
  };
}

export function missedConceptFromParsedQuestion(q){
  const topic = q.knowledgeStatement || q.sessionTitle || q.domain || 'Imported QAE Miss';
  const trap = q.userAnswer && q.correctAnswer ? `Picked ${q.userAnswer}; correct answer was ${q.correctAnswer}.` : 'Imported as a missed review item.';
  const correctWhy = q.justifications?.[q.correctAnswer] || q.justifications?._ || '';
  const shortStem = q.question.length > 220 ? `${q.question.slice(0, 220)}...` : q.question;
  return {
    id: crypto.randomUUID(),
    date: new Date().toISOString().slice(0, 10),
    domain: q.domain || 'Imported QAE',
    topic,
    summary: `${trap} ${shortStem}`.trim(),
    rule: correctWhy || `Review why ${q.correctAnswer} is the best CISA answer for this item.`,
    reviewed: false,
    createdAt: new Date().toISOString(),
    source: 'QAE Paste Import',
    sourceQuestionId: q.id
  };
}

export function flashcardFromParsedMiss(q){
  const back = q.justifications?.[q.correctAnswer] || `Correct answer: ${q.correctAnswer}. Review the CISA logic for this item.`;
  return {
    front: `${q.knowledgeStatement || q.domain || 'QAE Miss'} — What is the CISA logic?`,
    back,
    sourceQuestionId: q.id
  };
}
