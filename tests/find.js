/* find on the board: typed text and sticky notes, every page, Arabic too.  node find.js */
const { chromium } = require('playwright'); const path = require('path');
const URL = 'file://' + path.resolve(__dirname, '..', 'dist', 'index.html') + '?nointro=1&accskip=1'; const VER = require('../desktop/package.json').version; const fails = [];
const ok = (n, c, i) => { console.log((c ? 'ok   ' : 'FAIL ') + n + (i !== undefined ? '  ' + JSON.stringify(i) : '')); if (!c) fails.push(n); };
(async () => {
  const b = await chromium.launch(); const c = await b.newContext({ viewport: { width: 1600, height: 900 } });
  await c.addInitScript(v => { localStorage['hb:accSkip'] = 'true'; localStorage['hb:seenIntro'] = 'true'; localStorage['hb:seenVer'] = '"' + v + '"'; }, VER);
  await c.route(/^https?:/, r => r.abort()); const p = await c.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto(URL); await p.waitForTimeout(1500);
  await p.evaluate(() => { HBE.add([{ id: 'ft1', t: 'text', x: 200, y: 200, s: 'Mitochondria make ATP', size: 30, font: 'Lexend', c: '#000000' }], 1); HBUI.addPage(); HBE.add([{ id: 'ft2', t: 'note', x: 300, y: 300, w: 320, h: 240, s: 'Photosynthesis <b>x</b> and الخلية', c: '#FFE066', font: 'Lexend', size: 30 }], 1); HBUI.goPage(0); });
  await p.waitForTimeout(300);
  await p.keyboard.press('Control+f'); await p.waitForSelector('#fbq', { timeout: 3000 }).catch(() => {}); ok('Ctrl+F opens Find', !!(await p.$('#fbq')));
  await p.fill('#fbq', 'photosyn'); await p.waitForTimeout(200);
  const n = await p.$$eval('#fbl [data-i]', e => e.length); ok('finds a note on another page', n === 1, n);
  ok('the result is shown as text, not as markup', await p.evaluate(() => !document.querySelector('#fbl b') && document.getElementById('fbl').textContent.includes('<b>x</b>')));
  await p.click('#fbl [data-i]'); await p.waitForTimeout(400);
  ok('click jumps to page 2 and selects it', await p.evaluate(() => HBE.B.cur === 1 && HBI.selObjs().length === 1 && HBI.selObjs()[0].id === 'ft2'));
  await p.keyboard.press('Control+f'); await p.waitForSelector('#fbq'); await p.fill('#fbq', 'الخلية'); await p.waitForTimeout(200);
  ok('finds Arabic text', (await p.$$eval('#fbl [data-i]', e => e.length)) === 1);
  await p.fill('#fbq', 'zzzz'); await p.waitForTimeout(200); ok('no match says so', (await p.textContent('#fbl')).includes('No match'));
  await p.fill('#fbq', 'MITO'); await p.waitForTimeout(200); await p.press('#fbq', 'Enter'); await p.waitForTimeout(400);
  ok('Enter opens the first match (case ignored)', await p.evaluate(() => HBE.B.cur === 0 && HBI.selObjs()[0] && HBI.selObjs()[0].id === 'ft1'));
  ok('no page errors', errs.length === 0, errs); await b.close(); console.log('FAILS', fails.length); process.exit(fails.length ? 1 : 0);
})();
