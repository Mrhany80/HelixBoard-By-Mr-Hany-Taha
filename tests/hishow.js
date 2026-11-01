const { chromium } = require('playwright'); const fs = require('fs'); (async () => { const b = await chromium.launch(); const c = await b.newContext({ viewport: { width: 1400, height: 850 } }); await c.addInitScript(() => { localStorage['hb:accSkip'] = 'true'; }); const p = await c.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
 await p.goto('file:///home/user/helixboard/dist/index.html?nointro'); await p.waitForTimeout(1200);
 const b64 = fs.readFileSync(__dirname + '/anim.pptx').toString('base64'); await p.evaluate(b64 => HBIO.importPptx(new File([Uint8Array.from(atob(b64), c => c.charCodeAt(0))], 'a.pptx')), b64);
 await p.waitForSelector('#ppGo'); await p.click('#ppGo'); await p.waitForFunction(() => HBE.page().deck, null, { timeout: 120000 }); await p.waitForTimeout(500);
 await p.keyboard.press('F5'); await p.waitForTimeout(1200);
 const btns = await p.$$eval('#showCtl button', bs => bs.map((b, i) => i + ':' + (b.title || b.textContent).slice(0, 25))); console.log(btns.join(' | '));
 for (const [k, name] of [[3, 'pen button'], [4, 'highlighter button']]) { await p.evaluate(() => document.getElementById('showCtl').classList.remove('idle')); await (await p.$$('#showCtl button'))[k].click(); await p.waitForTimeout(200);
   const n0 = await p.evaluate(() => HBE.page().objs.length), T = await p.evaluate(() => JSON.stringify([HBI.T.tool, HBI.T.pen]));
   await p.mouse.move(600, 400); await p.mouse.down(); for (let i = 0; i < 15; i++) await p.mouse.move(600 + i * 15, 400 + i * 4); await p.mouse.up(); await p.waitForTimeout(300);
   console.log(name, T, '→ new objects:', await p.evaluate(n0 => JSON.stringify(HBE.page().objs.slice(n0).map(o => [o.t, o.pen, o.a, o.w, o.c, o.layer])), n0)); }
 await p.screenshot({ path: 'hishow.png' }); console.log('errs', errs); await b.close(); })();
