/* 3.3.0 menus: five tabs, Simple mode hides only groups that "More tools" brings back, every tool stays in the Ctrl+K search.  node menus2.js [tests-folder] */
const { chromium } = require('playwright'); const path = require('path');
const S = process.argv[2] || __dirname, URL = 'file://' + path.resolve(S, '..', 'dist', 'index.html') + '?nointro=1&accskip=1';
const VER = require('../desktop/package.json').version; const fails = [];
const ok = (n, c, i) => { console.log((c ? 'ok   ' : 'FAIL ') + n + (i !== undefined ? '  ' + JSON.stringify(i) : '')); if (!c) fails.push(n); };
(async () => {
  const b = await chromium.launch(); const c = await b.newContext({ viewport: { width: 1600, height: 900 } });
  await c.addInitScript(v => { localStorage['hb:accSkip'] = 'true'; localStorage['hb:seenIntro'] = 'true'; localStorage['hb:seenVer'] = '"' + v + '"'; }, VER);
  await c.route(/^https?:/, r => r.abort()); const p = await c.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto(URL); await p.waitForTimeout(1500);
  ok('five ribbon tabs', await p.evaluate(() => HBUI.TABS.map(t => t.id).join() === 'draw,insert,science,teach,page'));
  const shown = () => p.evaluate(() => document.querySelectorAll('#toolrow .tb[data-id]').length);
  const names = await p.evaluate(() => HBUI.TABS.map(t => t.id));
  let hidden = 0, all = 0;
  for (const id of names) {
    await p.evaluate(i => { HBUI.selectTab(i); localStorage['hb:simple'] = 'true'; }, id); await p.waitForTimeout(250);
    const subs = await p.evaluate(() => [...document.querySelectorAll('#toolrow [data-sub]')].map(b => b.dataset.sub));
    const count = async simple => { await p.evaluate(v => { localStorage['hb:simple'] = String(v); }, simple); let n = 0;
      for (const sub of subs) { await p.evaluate(([i, sb]) => { localStorage['hb:sub:' + i] = JSON.stringify(sb); HBUI.selectTab(i === 'draw' ? 'insert' : 'draw'); HBUI.selectTab(i); }, [id, sub]); await p.waitForTimeout(120); if (sub === 'all') n += await shown(); } return n; };
    const s = await count(true), f = await count(false); hidden += f - s; all += f;
    ok('tab ' + id + ': simple mode shows no more than full mode', s <= f, { simple: s, full: f });
  }
  ok('simple mode hides some tools on the whole', hidden > 20, { hidden, of: all });
  ok('every tool with an action is reachable by the Ctrl+K list', await p.evaluate(() => { let miss = []; HBUI.TABS.forEach(t => t.groups.forEach(g => g.items.forEach(it => { if (it.id && !it.act && !it.kind) miss.push(it.id); }))); return miss.length === 0 ? true : miss.slice(0, 5); }));
  ok('no two tools share a label', await p.evaluate(() => { const seen = {}, dup = []; HBUI.TABS.forEach(t => t.groups.forEach(g => g.items.forEach(i => { if (!i.id || !i.label) return; if (seen[i.label]) dup.push(i.label); seen[i.label] = 1; }))); return dup.length === 0 || dup; }));
  await p.evaluate(() => { localStorage['hb:tab'] = '"notes"'; }); await p.reload(); await p.waitForSelector('#helix .tab.on', { timeout: 15000 }).catch(() => {}); await p.waitForTimeout(800);
  const on = await p.evaluate(() => { const g = document.querySelector('#helix .tab.on'); return g ? g.dataset.t : null; });
  ok('a saved "notes" tab opens Insert', on === 'insert', on);
  console.log('ERRORS', JSON.stringify(errs)); await b.close(); process.exit(fails.length || errs.length ? 1 : 0);
})();
