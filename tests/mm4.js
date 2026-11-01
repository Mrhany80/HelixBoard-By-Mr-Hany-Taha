/* Concept map: professional names, and a branch dragged onto another idea re-attaches there (one Undo step) */
const { chromium } = require('playwright'); const S = process.argv[2] || __dirname; const log = (...a) => console.log(...a);
(async () => { const b = await chromium.launch(); const c = await b.newContext({ viewport: { width: 1600, height: 900 } }); await c.addInitScript(() => { localStorage['hb:accSkip'] = 'true'; }); const p = await c.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('file:///home/user/helixboard/dist/index.html?nointro'); await p.waitForTimeout(1500);
  await p.evaluate(() => HBMM.open()); await p.waitForTimeout(300); await p.click('#sheet [data-t="Cellular respiration"]'); await p.waitForTimeout(700);
  const node = s => p.evaluate(s => { const n = HBE.page().objs.find(o => o.nd && o.s === s); return n && { id: n.id, par: n.par, x: n.x, y: n.y, w: n.w, h: n.h }; }, s);
  const scr = async n => p.evaluate(n => { const st = document.getElementById('stage').getBoundingClientRect(), V = HBE.V; return [st.left + (n.x + n.w / 2) * V.s + V.x, st.top + (n.y + n.h / 2) * V.s + V.y]; }, n);
  const glu = await node('Glucose'), prod = await node('Produces'), needs = await node('Needs');
  await p.evaluate(id => HBI.select(HBE.byId(id)), glu.id); await p.waitForTimeout(300);
  log('bar:', (await p.evaluate(() => document.querySelector('#mmBar').innerText)).replace(/\s+/g, ' ').slice(0, 80));
  const root = await p.evaluate(() => HBE.page().objs.find(o => o.nd && o.root).id); await p.evaluate(id => HBI.select(HBE.byId(id)), root); await p.waitForTimeout(200);
  log('root bar:', (await p.evaluate(() => document.querySelector('#mmBar').innerText)).replace(/\s+/g, ' ').slice(0, 60));
  await p.evaluate(() => HBI.setTool ? HBI.setTool('select') : (window.HBUI && HBUI.tool && HBUI.tool('select'))); await p.keyboard.press('Escape');
  const h0 = await p.evaluate(() => HBE.histLen());
  const [sx, sy] = await scr(glu), [tx, ty] = await scr(prod);
  await p.mouse.move(sx, sy); await p.mouse.down(); for (let i = 1; i <= 12; i++) { await p.mouse.move(sx + (tx - sx) * i / 12, sy + (ty - sy) * i / 12); await p.waitForTimeout(20); }
  const hl = await p.evaluate(() => !!document.getElementById('mmDrop')); await p.screenshot({ path: S + '/mm4_drag.png' }); await p.mouse.up(); await p.waitForTimeout(500);
  const g2 = await node('Glucose'); log('highlight while dragging:', hl, '| Glucose parent: was Needs', glu.par === needs.id, '→ now Produces', g2.par === prod.id);
  log('undo steps added:', (await p.evaluate(() => HBE.histLen())) - h0);
  await p.screenshot({ path: S + '/mm4_after.png' });
  await p.keyboard.press('Control+z'); await p.waitForTimeout(400); log('after one Undo, parent back to Needs:', (await node('Glucose')).par === needs.id);
  log('errs', errs); await b.close(); })().catch(e => { console.log('FAIL', e.message); process.exit(1); });
