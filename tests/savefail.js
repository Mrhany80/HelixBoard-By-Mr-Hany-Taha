/* A failed autosave must show a message (it used to be only a console warning).  node savefail.js [tests-folder] */
const { chromium } = require('playwright'); const path = require('path');
const S = process.argv[2] || __dirname, URL = 'file://' + path.resolve(S, '..', 'dist', 'index.html') + '?nointro=1&accskip=1';
const VER = require('../desktop/package.json').version; const fails = [];
const ok = (n, c, i) => { console.log((c ? 'ok   ' : 'FAIL ') + n + (i !== undefined ? '  ' + JSON.stringify(i) : '')); if (!c) fails.push(n); };
(async () => {
  const b = await chromium.launch(); const c = await b.newContext({ viewport: { width: 1280, height: 800 } });
  await c.addInitScript(v => { localStorage['hb:accSkip'] = 'true'; localStorage['hb:seenIntro'] = 'true'; localStorage['hb:seenVer'] = '"' + v + '"'; }, VER);
  await c.route(/^https?:/, r => r.abort()); const p = await c.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto(URL); await p.waitForTimeout(1500);
  await p.evaluate(() => HB.IDB.put('board', { bad: () => 1 })); await p.waitForTimeout(300);
  ok('failed save shows a message', await p.evaluate(() => { const t = document.getElementById('toast'); return !t.hidden && /could not be saved|out of storage/.test(t.textContent); }));
  await p.evaluate(() => { document.getElementById('toast').hidden = true; HB.IDB.put('board', { bad: () => 1 }); }); await p.waitForTimeout(300);
  ok('message is limited to one per minute', await p.evaluate(() => document.getElementById('toast').hidden === true));
  ok('put reports failure and success', await p.evaluate(async () => (await HB.IDB.put('board', { bad: () => 1 })) === false && (await HB.IDB.put('kvtest2', { a: 1 })) === true));
  ok('a normal save still works', await p.evaluate(async () => { await HB.IDB.put('kvtest', { a: 1 }); return (await HB.IDB.get('kvtest')).a === 1; }));
  console.log('ERRORS', JSON.stringify(errs)); await b.close(); process.exit(fails.length || errs.length ? 1 : 0);
})();
