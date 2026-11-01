const { chromium } = require('playwright'); const fs = require('fs'); (async () => { const b = await chromium.launch();
for (const variant of ['import only', 'show + esc', 'show + freeze + esc']) { const c = await b.newContext({ viewport: { width: 1400, height: 850 } }); await c.addInitScript(() => { localStorage['hb:accSkip'] = 'true'; }); const p = await c.newPage();
 await p.goto('file:///tmp/claude-0/-home-user/2478066f-6dfe-5ece-b807-bbb8f3fcb761/scratchpad/o261/dist/index.html?nointro'); await p.waitForTimeout(1200);
 const b64 = fs.readFileSync(__dirname + '/anim.pptx').toString('base64'); await p.evaluate(b64 => HBIO.importPptx(new File([Uint8Array.from(atob(b64), c => c.charCodeAt(0))], 'a.pptx')), b64);
 await p.waitForSelector('#ppGo'); await p.click('#ppGo'); await p.waitForFunction(() => HBE.page().deck, null, { timeout: 120000 }); await p.waitForTimeout(500);
 if (variant !== 'import only') { await p.keyboard.press('F5'); await p.waitForTimeout(1000); if (variant.includes('freeze')) { const cdp = await c.newCDPSession(p); await cdp.send('Page.setWebLifecycleState', { state: 'frozen' }); await p.waitForTimeout(2000); await cdp.send('Page.setWebLifecycleState', { state: 'active' }); } await p.keyboard.press('Escape'); await p.waitForTimeout(300); await p.keyboard.press('Escape'); await p.waitForTimeout(300); }
 await p.evaluate(() => HBI.setTool('draw', 'hi')); const n0 = await p.evaluate(() => HBE.page().objs.length);
 await p.mouse.move(500, 500); await p.mouse.down(); for (let i = 0; i < 15; i++) await p.mouse.move(500 + i * 12, 500 + i * 3); await p.mouse.up(); await p.waitForTimeout(300);
 console.log(variant.padEnd(22), await p.evaluate(n0 => HBE.page().objs.length - n0, n0), 'new | inkOff', await p.evaluate(() => HBE.page().deck && HBE.page().deck.inkOff), '| T', await p.evaluate(() => JSON.stringify([HBI.T.tool, HBI.T.pen]))); await c.close(); }
await b.close(); })();
