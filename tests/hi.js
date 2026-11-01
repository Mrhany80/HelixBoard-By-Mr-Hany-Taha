const { chromium } = require('playwright'); (async () => { const b = await chromium.launch(); const c = await b.newContext({ viewport: { width: 1400, height: 850 } }); await c.addInitScript(() => { localStorage['hb:accSkip'] = 'true'; }); const p = await c.newPage(); const errs=[]; p.on('pageerror', e => errs.push(e.message));
await p.goto('file:///home/user/helixboard/' + (process.argv[2] || 'dist') + '/index.html?nointro'); await p.waitForTimeout(1500);
for (const pen of ['pen', 'hi', 'marker']) { await p.evaluate(pen => HBI.setTool('draw', pen), pen); const n0 = await p.evaluate(() => HBE.page().objs.length);
  await p.mouse.move(500, 400); await p.mouse.down(); for (let i = 0; i < 15; i++) await p.mouse.move(500 + i * 12, 400 + i * 3); await p.mouse.up(); await p.waitForTimeout(300);
  console.log(pen, await p.evaluate(n0 => JSON.stringify(HBE.page().objs.slice(n0).map(x => [x.t, x.pen])), n0), JSON.stringify(await p.evaluate(() => [HBI.T.tool, HBI.T.pen]))); }
console.log(errs); await b.close(); })();
