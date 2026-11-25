/* quiz question types: multiple choice, pick-all, type-the-answer (Arabic too), order; parse, round trip, practise, present.  node quiztypes.js */
const { chromium } = require('playwright'); const path = require('path');
const URL = 'file://' + path.resolve(__dirname, '..', 'dist', 'index.html') + '?nointro=1&accskip=1'; const VER = require('../desktop/package.json').version; const fails = [];
const ok = (n, c, i) => { console.log((c ? 'ok   ' : 'FAIL ') + n + (i !== undefined ? '  ' + JSON.stringify(i) : '')); if (!c) fails.push(n); };
const TXT = `1. Which organelle makes ATP?
A) Nucleus
B) Mitochondrion *
C) Ribosome
Why: Cellular respiration.

2. Which are plant cell parts?
A) Cell wall *
B) Centriole
C) Chloroplast *
D) Lysosome

Type: What is the powerhouse of the cell?
Answer: Mitochondria | mitochondrion | the mitochondrion

Type: ما هي وحدة البناء في الكائن الحي؟
Answer: الخلية

Order: Put in order
A) Prophase
B) Metaphase
C) Anaphase

4. Pick two
A) one
B) two
C) three
Answer: A, C`;
(async () => {
  const b = await chromium.launch(); const c = await b.newContext({ viewport: { width: 1600, height: 900 } });
  await c.addInitScript(v => { localStorage['hb:accSkip'] = 'true'; localStorage['hb:seenIntro'] = 'true'; localStorage['hb:seenVer'] = '"' + v + '"'; }, VER);
  await c.route(/^https?:/, r => r.abort()); const p = await c.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto(URL); await p.waitForTimeout(1500);
  const qs = await p.evaluate(t => HBL.parseQuiz(t), TXT);
  ok('parses 6 questions', qs.length === 6, qs.length);
  ok('single answer unchanged', qs[0].a === 1 && !qs[0].m && qs[0].ex === 'Cellular respiration.');
  ok('two stars make a pick-all question', JSON.stringify(qs[1].m) === '[0,2]' && qs[1].a === 0);
  ok('type question keeps every accepted answer', qs[2].t === 'type' && qs[2].o.length === 3 && qs[2].o[0] === 'Mitochondria');
  ok('Arabic type question', qs[3].t === 'type' && qs[3].o[0] === 'الخلية');
  ok('order question unchanged', qs[4].t === 'order' && qs[4].o.length === 3);
  ok('"Answer: A, C" makes a pick-all question', JSON.stringify(qs[5].m) === '[0,2]');
  const back = await p.evaluate(t => { const q = HBL.parseQuiz(t); return HBL.parseQuiz(HBL.quizText(q)); }, TXT);
  ok('text round trip keeps types and answers', JSON.stringify(back.map(q => [q.t || '', q.a, q.m || null, q.o.length])) === JSON.stringify(qs.map(q => [q.t || '', q.a, q.m || null, q.o.length])));
  /* practise: type + multi */
  await p.evaluate(t => { HBL.saveQuiz('QT', HBL.parseQuiz(t).filter(q => q.t === 'type' || q.m)); }, TXT);
  await p.evaluate(() => HBL.practise('QT')); await p.waitForSelector('#stStage .st-q', { timeout: 5000 });
  const seen = []; let guard = 0;
  while (guard++ < 8) {
    const done = await p.$('#prD'); if (done) break;
    const typ = await p.$('#prT'); const q = await p.textContent('#stStage .st-q');
    if (typ) { seen.push('type'); await p.fill('#prT', /ما هي/.test(q) ? 'الْخَلِيَّةُ' : 'THE Mitochondrion!'); await p.press('#prT', 'Enter'); }
    else { seen.push('multi'); const n = await p.$$eval('#stStage .st-opt', e => e.map(x => x.textContent)); const want = /plant/.test(q) ? ['Cell wall', 'Chloroplast'] : ['one', 'three']; for (let i = 0; i < n.length; i++) if (want.some(w => n[i].includes(w))) await p.locator('#stStage .st-opt').nth(i).click(); await p.click('#prC'); }
    await p.waitForSelector('#prX', { timeout: 3000 }); const res = await p.textContent('#stStage .st-ex'); if (!/Correct/.test(res)) ok('answer accepted: ' + q.slice(0, 20), false, res);
    await p.click('#prX'); await p.waitForTimeout(150);
  }
  ok('practise ran type and pick-all questions', seen.includes('type') && seen.includes('multi'), seen);
  ok('score screen shows 100%', (await p.textContent('#stStage')).includes('100%'));
  /* wrong answers are explained */
  await p.evaluate(() => HBL.closeStage()); await p.evaluate(() => HBL.practise('QT')); await p.waitForSelector('#stStage .st-q');
  const first = await p.$('#prT'); if (first) { await p.fill('#prT', 'zzz'); await p.press('#prT', 'Enter'); } else { await (await p.$$('#stStage .st-opt'))[3].click(); await p.click('#prC'); }
  await p.waitForSelector('#prX'); ok('a wrong answer shows the right one', /Not quite/.test(await p.textContent('#stStage .st-ex')));
  await p.evaluate(() => HBL.closeStage());
  /* present mode */
  await p.evaluate(() => HBL.presentQuiz('QT')); await p.waitForSelector('#qzBody', { timeout: 5000 }); let sawType = false, sawMulti = false;
  for (let i = 0; i < 4; i++) { const t = await p.textContent('#qzBody'); if (await p.$('#qzBody .st-opt')) { sawMulti = true; await p.click('#qzR'); await p.waitForTimeout(100); const nr = await p.$$eval('#qzBody .st-opt.right', e => e.length); ok('present: all correct options are marked', nr === 2, nr); } else if (/Reveal the answer/.test(t)) { sawType = true; await p.click('#qzR'); await p.waitForTimeout(100); ok('present: typed question reveals the answer', /Answer:/.test(await p.textContent('#qzBody'))); } await p.click('#qzX'); await p.waitForTimeout(100); }
  ok('present showed both kinds', sawType && sawMulti);
  /* real key presses must reach the answer box (and not draw or switch tools) */
  await p.evaluate(() => HBL.practise('QT')); await p.waitForSelector('#stStage .st-q'); if (await p.$('#prT')) { await p.click('#prT'); await p.keyboard.type('pen test'); ok('typing reaches the answer box', (await p.inputValue('#prT')) === 'pen test'); } else ok('typing reaches the answer box (skipped, first was multi)', true);
  await p.evaluate(() => HBL.closeStage());
  ok('no page errors', errs.length === 0, errs); await b.close(); console.log('FAILS', fails.length); process.exit(fails.length ? 1 : 0);
})();
