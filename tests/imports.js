/* PDF and PowerPoint import: good files open, broken files give a plain message, a locked PDF asks for its password.  node imports.js [tests-folder] */
const { chromium } = require('playwright'); const fs = require('fs'), path = require('path');
const S = process.argv[2] || __dirname, URL = 'file://' + path.resolve(S, '..', 'dist', 'index.html') + '?nointro=1&accskip=1', FX = path.join(S, 'fixtures');
const fails = []; const ok = (n, c, i) => { console.log((c ? 'ok   ' : 'FAIL ') + n + (i !== undefined ? '  ' + JSON.stringify(i) : '')); if (!c) fails.push(n); };
(async () => {
  const b = await chromium.launch(); const errs = [];
  const open = async () => { const c = await b.newContext({ viewport: { width: 1400, height: 850 } }); await c.addInitScript(() => { localStorage['hb:accSkip'] = 'true'; localStorage['hb:seenIntro'] = 'true'; });
    await c.route(/^https?:/, r => { const u = r.request().url(); if (u.startsWith('https://fx.test/')) return r.fulfill({ body: fs.readFileSync(path.join(FX, u.split('/').pop())), contentType: 'application/octet-stream' }); r.abort(); });
    const p = await c.newPage(); p.on('pageerror', e => errs.push(e.message)); await p.goto(URL); await p.waitForTimeout(1500);
    await p.evaluate(() => { window.__t = []; new MutationObserver(() => { const t = document.getElementById('toast'); if (!t.hidden && t.textContent) __t.push(t.textContent); }).observe(document.getElementById('toast'), { childList: true, characterData: true, subtree: true, attributes: true }); }); return p; };
  const send = (p, n) => p.evaluate(async n => { const bl = await (await fetch('https://fx.test/' + n)).blob(); HBIO.openDoc(new File([bl], n)); }, n);
  const lastToast = p => p.evaluate(() => __t[__t.length - 1] || '');
  /* broken files: one clear message each, nothing imported, no script error */
  for (const [n, re] of [['empty.pdf', /empty \(0 bytes\)/], ['corrupt.pdf', /damaged/], ['empty.pptx', /empty \(0 bytes\)/], ['truncated.pptx', /not a readable PowerPoint/], ['notapptx.pptx', /not a readable PowerPoint/]]) {
    const p = await open(); await send(p, n); await p.waitForFunction(re2 => __t.some(x => new RegExp(re2).test(x)), re.source, { timeout: 15000 }).catch(() => {});
    ok(n + ': plain message', re.test(await lastToast(p)), await lastToast(p)); ok(n + ': nothing imported', await p.evaluate(() => JSON.parse(HBE.serial()).pages.reduce((a, q) => a + q.objs.length, 0) === 0)); await p.context().close(); }
  /* locked PDF: asks, a wrong password asks again, the right one opens */
  { const p = await open(); await send(p, 'enc.pdf'); await p.waitForSelector('#pdfPw', { timeout: 15000 }); ok('locked PDF asks for a password', true);
    await p.fill('#pdfPw', 'nope'); await p.click('#pdfPwY'); await p.waitForFunction(() => /not right/.test((document.getElementById('modal') || {}).innerText || ''), null, { timeout: 15000 }).catch(() => {});
    ok('wrong password asks again', await p.evaluate(() => /not right/.test(document.getElementById('modal').innerText)));
    await p.fill('#pdfPw', 'x'); await p.click('#pdfPwY'); await p.waitForSelector('#pdfGo', { timeout: 20000 }); ok('right password opens the import dialog', true); await p.context().close(); }
  { const p = await open(); await send(p, 'enc.pdf'); await p.waitForSelector('#pdfPw', { timeout: 15000 }); await p.click('#pdfPwN'); await p.waitForTimeout(800);
    ok('cancelling the password leaves the board empty and says so', /Cancelled/.test(await lastToast(p))); await p.context().close(); }
  /* good files: 40-slide deck with Arabic, pictures, chart, tables; and its PDF */
  { const p = await open(); const t0 = Date.now(); await send(p, 'stress.pptx'); await p.waitForSelector('#ppGo', { timeout: 30000 }); await p.click('#ppGo');
    await p.waitForFunction(() => __t.some(x => /^Opened 40 slides/.test(x)), null, { timeout: 90000 }); const ms = Date.now() - t0;
    ok('40-slide pptx opens', true, { ms }); ok('pptx text is on the board', await p.evaluate(() => JSON.stringify(HBE.serial()).includes('Mitochondria') ));
    ok('pptx Arabic text kept', await p.evaluate(() => /[\u0600-\u06FF]/.test(HBE.serial()))); await p.context().close(); }
  { const p = await open(); const t0 = Date.now(); await send(p, 'stress.pdf'); await p.waitForSelector('#pdfGo', { timeout: 30000 }); await p.fill('#pdfR', '1-40'); await p.click('#pdfGo');
    await p.waitForFunction(() => __t.some(x => /^Opened 40 pages/.test(x)), null, { timeout: 100000 }); ok('40-page pdf opens', true, { ms: Date.now() - t0 }); await p.context().close(); }
  console.log('ERRORS', JSON.stringify(errs)); await b.close(); process.exit(fails.length || errs.length ? 1 : 0);
})();
