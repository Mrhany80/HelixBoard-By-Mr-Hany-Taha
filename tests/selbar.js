/* 3.3.0 contextual bar: appears next to a selection, duplicates / deletes, stays out of the way when nothing is selected.  node selbar.js */
const { chromium } = require('playwright'); const path = require('path');
const URL = 'file://' + path.resolve(__dirname, '..', 'dist', 'index.html') + '?nointro=1&accskip=1'; const VER = require('../desktop/package.json').version; const fails = [];
const ok = (n, c, i) => { console.log((c ? 'ok   ' : 'FAIL ') + n + (i !== undefined ? '  ' + JSON.stringify(i) : '')); if (!c) fails.push(n); };
(async () => {
  const b = await chromium.launch(); const c = await b.newContext({ viewport: { width: 1600, height: 900 } });
  await c.addInitScript(v => { localStorage['hb:accSkip'] = 'true'; localStorage['hb:seenIntro'] = 'true'; localStorage['hb:seenVer'] = '"' + v + '"'; }, VER);
  await c.route(/^https?:/, r => r.abort()); const p = await c.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto(URL); await p.waitForTimeout(1500);
  const vis = () => p.evaluate(() => { const s = document.getElementById('selbar'); return !!s && !s.hidden && s.getBoundingClientRect().width > 0; });
  const n = () => p.evaluate(() => HBE.page().objs.length);
  ok('hidden with nothing selected', !(await vis()));
  await p.keyboard.press('p'); await p.mouse.move(700, 400); await p.mouse.down(); for (let i = 0; i < 20; i++) await p.mouse.move(700 + i * 8, 400 + Math.sin(i / 3) * 40); await p.mouse.up(); await p.waitForTimeout(300);
  ok('still hidden while drawing', !(await vis())); const n0 = await n(); ok('a stroke was drawn', n0 >= 1, n0);
  await p.keyboard.press('v'); await p.mouse.move(600, 300); await p.mouse.down(); await p.mouse.move(1000, 500, { steps: 6 }); await p.mouse.up(); await p.waitForTimeout(400);
  await p.waitForFunction(() => { const s = document.getElementById('selbar'); return s && !s.hidden; }, null, { timeout: 600 }).catch(() => {}); ok('bar appears for the selection', await vis());
  const box = await p.evaluate(() => { const r = document.getElementById('selbar').getBoundingClientRect(); return [r.left, r.top, r.width, r.height]; }); ok('bar is on screen and finger sized', box[0] >= 0 && box[1] >= 0 && box[3] >= 44, box);
  await p.screenshot({path:'/downloads/selbar.png'}); await p.click('#selbar [data-sb="dup"]'); await p.waitForTimeout(300); ok('Duplicate adds a copy', (await n()) === n0 + 1, await n());
  await p.click('#selbar [data-sb="del"]'); await p.waitForTimeout(300); ok('Delete removes the selection', (await n()) < n0 + 1, await n());
  ok('no page errors', errs.length === 0, errs); await b.close(); console.log('FAILS', fails.length); process.exit(fails.length ? 1 : 0);
})();
