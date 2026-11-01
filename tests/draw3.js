const { chromium } = require('playwright'); const fs = require('fs'); (async () => { const b = await chromium.launch(); const c = await b.newContext({ viewport: { width: 1400, height: 850 } }); await c.addInitScript(() => { localStorage['hb:accSkip'] = 'true'; }); const p = await c.newPage(); p.on('console', m => console.log('LOG', m.text().slice(0, 200)));
 await p.goto('file:///home/user/helixboard/dist/index.html?nointro'); await p.waitForTimeout(1200);
 const b64 = fs.readFileSync(__dirname + '/anim.pptx').toString('base64'); await p.evaluate(b64 => HBIO.importPptx(new File([Uint8Array.from(atob(b64), c => c.charCodeAt(0))], 'a.pptx')), b64);
 await p.waitForSelector('#ppGo'); await p.click('#ppGo'); await p.waitForFunction(() => HBE.page().deck, null, { timeout: 120000 }); await p.waitForTimeout(800);
 await p.evaluate(() => { HBI.setTool('draw', 'hi'); const cv = document.getElementById('cvLive'); ['pointerdown', 'pointermove', 'pointerup'].forEach(t => cv.addEventListener(t, e => { if (t !== 'pointermove') console.log(t, e.pointerType, e.button, e.defaultPrevented); })); window.__tot = () => HBE.B.pages.reduce((s, pg) => s + pg.objs.length, 0); console.log('pages', HBE.B.pages.length, 'tot', __tot(), 'cur objs', HBE.page().objs.length); });
 await p.screenshot({ path: 'd3a.png' });
 await p.mouse.move(500, 500); await p.mouse.down(); for (let i = 0; i < 15; i++) await p.mouse.move(500 + i * 12, 500 + i * 3); await p.mouse.up(); await p.waitForTimeout(400);
 await p.evaluate(() => console.log('after tot', __tot(), 'cur', HBE.page().objs.length, 'modal', !document.getElementById('modal').hidden, document.getElementById('sheet').innerText.slice(0, 80)));
 await p.screenshot({ path: 'd3b.png' }); await b.close(); })();
