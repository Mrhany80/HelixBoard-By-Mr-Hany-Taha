const { chromium } = require('playwright'); const fs = require('fs'); const S = __dirname;
(async () => { const b = await chromium.launch(); const c = await b.newContext({ viewport: { width: 1400, height: 850 } }); await c.addInitScript(() => { localStorage['hb:accSkip'] = 'true'; }); const p = await c.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push('c:' + m.text().slice(0, 150)); });
await p.goto('file:///home/user/helixboard/dist/index.html?nointro'); await p.waitForTimeout(1500);
const b64 = fs.readFileSync(S + '/anim.pptx').toString('base64'); await p.evaluate(b64 => HBIO.importPptx(new File([Uint8Array.from(atob(b64), c => c.charCodeAt(0))], 'a.pptx')), b64);
await p.waitForSelector('#ppGo'); await p.click('#ppGo'); await p.waitForFunction(() => HBE.page().deck, null, { timeout: 120000 }); await p.waitForTimeout(500);
const cdp = await c.newCDPSession(p);
const probe = async label => { const t = Date.now(); const r = await Promise.race([p.evaluate(() => new Promise(ok => requestAnimationFrame(() => ok('frame')))), new Promise(ok => setTimeout(() => ok('NO FRAME 5s'), 5000))]); console.log(label, r, Date.now() - t, 'ms'); };
for (const mode of ['board', 'show']) { if (mode === 'show') { await p.keyboard.press('F5'); await p.waitForTimeout(1200); await p.keyboard.press('ArrowRight'); }
  await cdp.send('Page.setWebLifecycleState', { state: 'frozen' }); await p.waitForTimeout(3000); await cdp.send('Page.setWebLifecycleState', { state: 'active' });
  await p.evaluate(() => { Object.defineProperty(document, 'hidden', { value: false, configurable: true }); document.dispatchEvent(new Event('visibilitychange')); window.dispatchEvent(new Event('focus')); });
  await probe(mode + ' after background:'); const t = Date.now(); await p.keyboard.press('ArrowRight'); await probe(mode + ' key after:'); }
await p.keyboard.press('Escape'); await p.keyboard.press('Escape'); await p.waitForTimeout(400);
console.log('after show: deckshow class', await p.evaluate(() => document.body.className), 'showCtl', !!(await p.$('#showCtl')));
for (const pen of ['pen', 'hi']) { await p.evaluate(pen => HBI.setTool('draw', pen), pen); const n0 = await p.evaluate(() => HBE.page().objs.length);
  await p.mouse.move(800, 560); await p.mouse.down(); for (let i = 0; i < 15; i++) await p.mouse.move(800 + i * 12, 560 + i * 3); await p.mouse.up(); await p.waitForTimeout(300);
  console.log(pen, await p.evaluate(n0 => JSON.stringify(HBE.page().objs.slice(n0).map(x => [x.t, x.pen])), n0), 'top element:', await p.evaluate(() => { const e = document.elementFromPoint(560, 520); return e && (e.id || e.className || e.tagName); })); }
console.log('errs', errs); await b.close(); })().catch(e => { console.log('FAIL', e.message); process.exit(1); });
