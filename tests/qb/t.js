const P = require('/home/user/helixboard/app/quizparse.js'), G = require('/home/user/helixboard/desktop/testgrade.js'), fs = require('fs');
const r = P.parse(P.textLines(fs.readFileSync(process.argv[2], 'utf8')));
console.log('TITLE', r.title, JSON.stringify(r.stats));
r.questions.forEach((q, i) => console.log(i + 1, q.type, '|', q.q.slice(0, 50).replace(/\n/g, ' / '), '| o:', JSON.stringify(q.o || q.left || ''), q.right ? JSON.stringify(q.right) : '', '| a:', JSON.stringify(q.a), q.pts !== 1 ? 'pts' + q.pts : '', q.sec ? '[' + q.sec.slice(0, 25) + ']' : '', q.ex ? 'ex:' + q.ex.slice(0, 30) : ''));
