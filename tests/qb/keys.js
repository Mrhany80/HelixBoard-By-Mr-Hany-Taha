const P = require('/home/user/helixboard/app/quizparse.js');
const Q = `Cells Quiz
1. Which organelle releases energy?
a) Nucleus
b) Mitochondrion
c) Ribosome
2. Which controls the cell?
a) Nucleus
b) Vacuole
c) Wall
3. Plant cells have a cell wall. (True / False)
4. The ________ makes proteins.
`;
const keys = {
  'heading "Answer Key"': 'Answer Key\n1. B\n2. A\n3. True\n4. ribosome',
  'ANSWER KEY caps + title': 'ANSWER KEY – Cells Quiz\n1. B 2. A 3. True 4. ribosome',
  'Answers: on one line': 'Answers: 1-b, 2-a, 3-T, 4-ribosome',
  'no heading, list at end': '1. B\n2. A\n3. True\n4. ribosome',
  'grid: numbers row / letters row': 'Answer key\n1 2 3 4\nB A T ribosome',
  'table cells Q | Answer': 'Answer key\nQuestion\tAnswer\n1\tB\n2\tA\n3\tTrue\n4\tribosome',
  'Q1: B style': 'Answer key\nQ1: B\nQ2: A\nQ3: True\nQ4: ribosome',
  '1. (b) style': 'Answer key\n1. (b)\n2. (a)\n3. T\n4. ribosome',
  'option text instead of letter': 'Answer key\n1. Mitochondrion\n2. Nucleus\n3. True\n4. ribosome',
  'Arabic heading': 'الإجابات\n1- ب\n2- أ\n3- صح\n4- ribosome',
  'Key heading "Key:"': 'Key:\n1. B\n2. A\n3. True\n4. ribosome',
  'Mark scheme with marks': 'Mark scheme\n1 B (1)\n2 A (1)\n3 True (1)\n4 ribosome (1)',
  'Answers on new page, page header repeated': 'Cells Quiz\nAnswers\n1. B\n2. A\n3. True\n4. ribosome',
};
for (const [k, v] of Object.entries(keys)) { const r = P.parse(P.textLines(Q + v)); const a = r.questions.map(q => JSON.stringify(q.a)).join(' '); const ok = r.questions.length === 4 && r.stats.keyed === 4 && /^1 0 true \[\["ribosome"\]\]$/.test(a);
  console.log((ok ? 'ok  ' : 'BAD ') + k.padEnd(42) + ' n=' + r.questions.length + ' keyed=' + r.stats.keyed + ' | ' + a.slice(0, 70)); }
