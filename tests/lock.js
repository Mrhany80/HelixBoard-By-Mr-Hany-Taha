/* locked items must always have a way back.  node lock.js */
const { chromium } = require('playwright'); const path = require('path');
const URL = 'file://' + path.resolve(__dirname, '..', 'dist', 'index.html') + '?nointro=1&accskip=1'; const VER = require('../desktop/package.json').version; const fails = [];
const ok = (n, c, i) => { console.log((c ? 'ok   ' : 'FAIL ') + n + (i !== undefined ? '  ' + JSON.stringify(i) : '')); if (!c) fails.push(n); };
(async () => {
  const b = await chromium.launch(); const c = await b.newContext({ viewport: { width: 1600, height: 900 } });
  await c.addInitScript(v => { localStorage['hb:accSkip'] = 'true'; localStorage['hb:seenIntro'] = 'true'; localStorage['hb:seenVer'] = '"' + v + '"'; }, VER);
  await c.route(/^https?:/, r => r.abort()); const p = await c.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto(URL); await p.waitForTimeout(1500);
  await p.keyboard.press('p'); await p.mouse.move(700, 400); await p.mouse.down(); for (let i = 0; i < 20; i++) await p.mouse.move(700 + i * 8, 400 + Math.sin(i / 3) * 40); await p.mouse.up(); await p.waitForTimeout(300);
  await p.keyboard.press('v'); await p.mouse.move(600, 300); await p.mouse.down(); await p.mouse.move(1000, 500, { steps: 6 }); await p.mouse.up(); await p.waitForTimeout(400);
  await p.evaluate(() => { document.getElementById('drawer').classList.remove('closed'); });
  await p.evaluate(() => { const t = [...document.querySelectorAll('#drawer [data-dt], #drawer .tab, #drawer button')].find(x => /propert/i.test(x.textContent + (x.title || ''))); if (t) t.click(); });
  await p.waitForTimeout(400);
  const lockBtn = await p.$('#dbody [data-x="lock"]'); ok('Lock button is in Properties', !!lockBtn);
  if (lockBtn) { await lockBtn.click(); await p.waitForTimeout(400); }
  ok('the item is locked', await p.evaluate(() => HBE.page().objs.some(o => o.locked)));
  await p.keyboard.press('Escape'); await p.waitForTimeout(300);
  const un = await p.$('#pUnlock'); ok('an Unlock button is offered with nothing selected', !!un);
  if (un) { await un.click(); await p.waitForTimeout(300); }
  ok('everything is unlocked again', await p.evaluate(() => !HBE.page().objs.some(o => o.locked)));
  ok('no page errors', errs.length === 0, errs); await b.close(); console.log('FAILS', fails.length); process.exit(fails.length ? 1 : 0);
})();
