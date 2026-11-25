/* comments on objects: add, show a bubble, edit, delete, survive save/undo, hidden when presenting.  node comments.js */
const { chromium } = require('playwright'); const path = require('path');
const URL = 'file://' + path.resolve(__dirname, '..', 'dist', 'index.html') + '?nointro=1&accskip=1'; const VER = require('../desktop/package.json').version; const fails = [];
const ok = (n, c, i) => { console.log((c ? 'ok   ' : 'FAIL ') + n + (i !== undefined ? '  ' + JSON.stringify(i) : '')); if (!c) fails.push(n); };
(async () => {
  const b = await chromium.launch(); const c = await b.newContext({ viewport: { width: 1600, height: 900 } });
  await c.addInitScript(v => { localStorage['hb:accSkip'] = 'true'; localStorage['hb:seenIntro'] = 'true'; localStorage['hb:seenVer'] = '"' + v + '"'; }, VER);
  await c.route(/^https?:/, r => r.abort()); const p = await c.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto(URL); await p.waitForTimeout(1500);
  await p.evaluate(() => { HBE.add([{ id: 'cm1', t: 'text', x: 400, y: 300, s: 'Cell membrane', size: 40, font: 'Lexend', c: '#000000' }], 1); HBI.setTool('select'); HBI.select(HBE.page().objs.find(o => o.id === 'cm1')); });
  await p.waitForTimeout(500);
  ok('Comment button is on the selection bar', await p.evaluate(() => { const b = document.querySelector('#selbar [data-sb="cm"]'); return !!b && !b.hidden && b.getBoundingClientRect().height >= 40; }));
  await p.click('#selbar [data-sb="cm"]'); await p.waitForSelector('#cmT', { timeout: 3000 });
  await p.fill('#cmT', 'Ask <img src=x onerror=window.__x=1> why it is fluid'); await p.click('#cmS'); await p.waitForTimeout(500);
  ok('comment is stored on the object', await p.evaluate(() => (HBE.page().objs.find(o => o.id === 'cm1').cm || '').includes('why it is fluid')));
  ok('a bubble marks the object', (await p.$$('#cmLayer button')).length === 1);
  ok('markup in a comment is not run', await p.evaluate(() => !window.__x && !document.querySelector('#cmLayer img')));
  await p.click('#cmLayer button'); await p.waitForSelector('#cmT'); ok('clicking the bubble opens the comment', (await p.inputValue('#cmT')).includes('fluid'));
  await p.fill('#cmT', 'Short'); await p.click('#cmS'); await p.waitForTimeout(300); ok('edit saved', await p.evaluate(() => HBE.page().objs.find(o => o.id === 'cm1').cm === 'Short'));
  ok('comment travels in the saved board data', await p.evaluate(() => JSON.stringify(HBE.B).includes('"cm":"Short"')));
  await p.evaluate(() => HBUI.present(true)); await p.waitForTimeout(300); ok('bubbles hidden while presenting', (await p.$$('#cmLayer button')).length === 0);
  await p.evaluate(() => HBUI.present(false)); await p.waitForTimeout(300);
  await p.click('#cmLayer button'); await p.waitForSelector('#cmD'); await p.click('#cmD'); await p.waitForTimeout(400);
  ok('delete removes the comment and the bubble', await p.evaluate(() => !HBE.page().objs.find(o => o.id === 'cm1').cm) && (await p.$$('#cmLayer button')).length === 0);
  ok('no page errors', errs.length === 0, errs); await b.close(); console.log('FAILS', fails.length); process.exit(fails.length ? 1 : 0);
})();
