/* 3.3.0 merged tools: each new button opens a panel; every old tool id still opens its own thing, is still searchable and is not left on the ribbon.  node merge.js */
const { chromium } = require('playwright'); const path = require('path');
const URL = 'file://' + path.resolve(__dirname, '..', 'dist', 'index.html') + '?nointro=1&accskip=1';
const VER = require('../desktop/package.json').version; const fails = [];
const ok = (n, c, i) => { console.log((c ? 'ok   ' : 'FAIL ') + n + (i !== undefined ? '  ' + JSON.stringify(i) : '')); if (!c) fails.push(n); };
(async () => {
  const b = await chromium.launch(); const c = await b.newContext({ viewport: { width: 1600, height: 900 } });
  await c.addInitScript(v => { localStorage['hb:accSkip'] = 'true'; localStorage['hb:seenIntro'] = 'true'; localStorage['hb:seenVer'] = '"' + v + '"'; localStorage['hb:simple'] = 'false'; }, VER);
  await c.route(/^https?:/, r => r.abort()); const p = await c.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto(URL); await p.waitForTimeout(1500);
  const menus = ['m_timer', 'm_pick', 'm_cards', 'm_quiz', 'm_tmpl', 'm_hi', 'm_marks', 'm_export', 'm_settings'];
  for (const m of menus) {
    const tab = await p.evaluate(m => { const t = HBUI.TABS.find(t => t.groups.some(g => g.items.some(i => i.id === m))); return t && t.id; }, m);
    ok(m + ' is on the ribbon', !!tab, tab); if (!tab) continue;
    for (let round = 0; round < 2; round++) {
      await p.evaluate(t => document.querySelector('[data-t="' + t + '"]').dispatchEvent(new MouseEvent('click', { bubbles: true })), tab); await p.waitForTimeout(150);
      await p.evaluate(() => { document.querySelectorAll('#toolrow .subchip[data-sub="all"]').forEach(b => b.click()); });
      await p.evaluate(m => document.querySelector('#toolrow [data-id="' + m + '"]').click(), m); await p.waitForTimeout(150);
      const n = await p.evaluate(() => document.querySelectorAll('#sheet [data-mi]').length);
      ok(m + ' opens a panel with choices', n > 0, n);
      if (round === 0) { const first = await p.evaluate(() => { const b = document.querySelector('#sheet [data-mi]'); const id = b.dataset.mi; b.click(); return id; }); await p.waitForTimeout(300);
        ok(m + ': choice "' + first + '" runs without error', errs.length === 0, errs); await p.evaluate(() => { try { HB.modal.close(); } catch (e) {} Object.values(HB.floats || {}).forEach(f => { try { f.destroy(); } catch (e) {} }); document.querySelectorAll('.wfull,#showEnd,#showBlank,#stStage').forEach(x => x.remove()); }); }
      else await p.evaluate(() => HB.modal.close());
    }
  }
  const gone = ['t_open', 't_5', 'w_open', 'minipick', 'sp_cards', 'lq_pres', 'n_cornell', 'nk_hi_pink', 'nk_st_tick', 'png', 'pdfx', 'touchtest', 'bul'];
  const left = await p.evaluate(g => { const on = new Set(); HBUI.TABS.forEach(t => t.groups.forEach(x => x.items.forEach(i => on.add(i.id)))); return g.filter(i => on.has(i)); }, gone);
  ok('old tools are off the ribbon', left.length === 0, left);
  /* aliases: the old ids still resolve (saved docks) and Ctrl+K still finds them */
  const al = await p.evaluate(g => g.filter(i => !(HBUI.ALL && HBUI.ALL[i])), gone); ok('old ids still resolve for saved docks', al.length === 0, al);
  for (const q of ['Board timer', 'Cold call', 'Cornell', 'Touch test']) {
    await p.evaluate(() => HBUI.palette()); await p.keyboard.type(q); await p.waitForTimeout(200);
    const hit = await p.evaluate(() => document.querySelectorAll('#palList [role=option]').length); ok('Ctrl+K finds "' + q + '"', hit > 0, hit); await p.keyboard.press('Escape'); await p.waitForTimeout(250);
  }
  ok('no page errors', errs.length === 0, errs); await b.close(); console.log('FAILS', fails.length); process.exit(fails.length ? 1 : 0);
})();
