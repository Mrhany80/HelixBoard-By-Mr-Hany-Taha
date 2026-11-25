/* HelixBoard opened PDF: fits the full screen, zooms by buttons / wheel / two-finger pinch (also in smartboard mode).
   node tests/deckzoom.js   (SHOTS=/dir saves screenshots) */
let chromium; try { chromium = require('playwright').chromium; } catch (e) { chromium = require('playwright-core').chromium; }
const path = require('path'), fs = require('fs');
const URL_ = 'file://' + path.resolve(__dirname, '..', 'dist', 'index.html') + '?nointro=1&accskip=1';
let fails = 0;
const ok = (c, m, x) => { console.log((c ? 'ok  ' : 'FAIL') + ' ' + m + (x === undefined ? '' : '  ' + JSON.stringify(x))); if (!c) fails++; };
const shot = (p, n) => process.env.SHOTS ? p.screenshot({ path: path.join(process.env.SHOTS, n + '.png') }) : null;
(async () => {
  const launch = { args: ['--ignore-gpu-blocklist'] };
  if (fs.existsSync('/usr/bin/google-chrome') && !process.env.HB_BUNDLED) launch.executablePath = '/usr/bin/google-chrome';
  const b = await chromium.launch(launch);
  const c = await b.newContext({ viewport: { width: 1366, height: 768 }, deviceScaleFactor: 1, hasTouch: true });
  await c.addInitScript(() => { localStorage['hb:accSkip'] = 'true'; localStorage['hb:seenIntro'] = 'true'; localStorage['hb:seenVer'] = '"99"'; localStorage['hb:dueSeen'] = '"x"'; });
  await c.route(/^https?:/, r => r.abort());
  const p = await c.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto(URL_);
  await p.waitForFunction(() => window.HBE && window.HBIO && window.HBD, null, { timeout: 120000 });
  await p.evaluate(async () => { const { jsPDF } = await HB.need('jspdf'); const d = new jsPDF({ unit: 'pt', format: 'a4' });
    for (let i = 1; i <= 3; i++) { if (i > 1) d.addPage(); d.setFontSize(28); d.text('Worksheet page ' + i, 60, 90); d.rect(30, 30, 535, 782); }
    window.__pdf = new File([d.output('arraybuffer')], 'ws.pdf', { type: 'application/pdf' }); });
  const n0 = await p.evaluate(() => HBE.B.pages.length);
  await p.evaluate(() => HBIO.importPdf(window.__pdf)); await p.waitForSelector('#pdfGo', { timeout: 60000 }); await p.click('#pdfGo');
  await p.waitForFunction(n => HBE.B.pages.length > n && HBE.page().deck && HBE.page().deck.slides.length >= 3, n0, { timeout: 120000 });
  await p.waitForTimeout(800);
  const geo = () => p.evaluate(() => { const V = HBE.V, d = HBE.page().deck, r = HBD.rects()[HBD.cur]; return { x: r[0] * V.s + V.x, y: r[1] * V.s + V.y, w: r[2] * V.s, h: r[3] * V.s, s: V.s, SW: HBE.SW, SH: HBE.SH }; });
  /* 1. full screen: the whole page, tall as the screen */
  await p.evaluate(() => HBD.enterFull()); await p.waitForTimeout(1500);
  let g = await geo();
  ok(g.h >= g.SH * 0.97 && g.h <= g.SH, 'full screen: the page is as tall as the screen (no empty bands)', { h: Math.round(g.h), SH: g.SH });
  ok(g.y >= 0 && g.y + g.h <= g.SH && g.x >= 0 && g.x + g.w <= g.SW, 'the whole page is on screen', g);
  await p.waitForTimeout(4500); await shot(p, 'full-fit');
  const fit = g.s;
  /* 2. buttons */
  await p.click('#dzIn'); await p.waitForTimeout(150); g = await geo();
  ok(g.s > fit * 1.2, 'Zoom in button enlarges the page', { ratio: g.s / fit });
  ok((await p.textContent('#dzPct')).trim() === '125%', 'percent shows 125%', await p.textContent('#dzPct'));
  await p.click('#dzOut'); await p.click('#dzOut'); await p.waitForTimeout(150); g = await geo();
  ok(g.s < fit, 'Zoom out button shrinks the page', { ratio: g.s / fit });
  await p.click('#dzFit'); await p.waitForTimeout(800); g = await geo();
  ok(Math.abs(g.s - fit) < 0.01, 'Fit returns the whole page to the screen', { ratio: g.s / fit });
  await p.click('#dzW'); await p.waitForTimeout(150); g = await geo();
  ok(g.w >= g.SW * 0.97 && g.w <= g.SW, 'Width makes the page as wide as the screen', { w: Math.round(g.w), SW: g.SW });
  await p.click('#dzFit'); await p.waitForTimeout(800);
  /* 3. Ctrl + wheel (trackpad pinch) */
  await p.mouse.move(683, 384); await p.keyboard.down('Control'); await p.mouse.wheel(0, -300); await p.keyboard.up('Control'); await p.waitForTimeout(150); g = await geo();
  ok(g.s > fit * 1.3, 'Ctrl+wheel (trackpad pinch) zooms in', { ratio: g.s / fit });
  await p.click('#dzFit'); await p.waitForTimeout(800);
  /* 4. real two-finger touch pinch, in smartboard mode too */
  const cdp = await c.newCDPSession(p);
  const touch = async (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts.map((q, i) => ({ x: q[0], y: q[1], id: i + 1, radiusX: 8, radiusY: 8 })) });
  const hasT0 = await p.evaluate(() => !!(window.HBI && HBI.T));
  for (const board of [false, true]) {
    await p.evaluate(b2 => { const T = window.HBI && HBI.T; if (T) T.board = b2; }, board);
    const hasT = await p.evaluate(() => !!(window.HBI && HBI.T));
    if (!hasT) { ok(true, 'smartboard flag not reachable from the test, skipped ' + board); continue; }
    await p.click('#dzFit'); await p.waitForTimeout(800); const f0 = (await geo()).s;
    await touch('touchStart', [[640, 384]]); await touch('touchStart', [[640, 384], [720, 384]]);
    for (let k = 1; k <= 10; k++) await touch('touchMove', [[640 - k * 8, 384], [720 + k * 8, 384]]);
    await touch('touchEnd', []); await p.waitForTimeout(200); g = await geo();
    ok(g.s > f0 * 1.8, 'two-finger pinch out zooms in (smartboard mode ' + (board ? 'on' : 'off') + ')', { ratio: Math.round(g.s / f0 * 100) / 100 });
    await touch('touchStart', [[500, 384], [800, 384]]);
    for (let k = 1; k <= 10; k++) await touch('touchMove', [[500 + k * 8, 384], [800 - k * 8, 384]]);
    await touch('touchEnd', []); await p.waitForTimeout(200); const g2 = await geo();
    ok(g2.s < g.s * 0.75, 'two-finger pinch in zooms out', { ratio: Math.round(g2.s / g.s * 100) / 100 });
  }
  if (hasT0) { await p.click('#dzFit'); await p.waitForTimeout(800); await touch('touchStart', [[640, 384], [720, 384]]); for (let k = 1; k <= 4; k++) await touch('touchMove', [[640 - k * 8, 384], [720 + k * 8, 384]]); await touch('touchEnd', []); await p.waitForTimeout(300); await shot(p, 'pinch-zoomed'); }
  /* a big palm contact next to a finger is still ignored in smartboard mode */
  const hasT = await p.evaluate(() => !!(window.HBI && HBI.T));
  if (hasT) { await p.evaluate(() => { HBI.T.board = true; }); await p.click('#dzFit'); await p.waitForTimeout(800); const f0 = (await geo()).s;
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 640, y: 384, id: 1, radiusX: 8, radiusY: 8 }, { x: 760, y: 384, id: 2, radiusX: 90, radiusY: 90 }] });
    for (let k = 1; k <= 6; k++) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 640 - k * 8, y: 384, id: 1, radiusX: 8, radiusY: 8 }, { x: 760 + k * 8, y: 384, id: 2, radiusX: 90, radiusY: 90 }] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await p.waitForTimeout(200);
    ok(Math.abs((await geo()).s - f0) < 0.001, 'smartboard mode: a palm-size contact does not zoom', {}); }
  /* 5. leaving full screen puts the slide bar back */
  await p.evaluate(() => HBD.exitFull()); await p.waitForTimeout(900);
  ok(await p.evaluate(() => !document.body.classList.contains('deckbar-min')), 'exiting full screen restores the slide bar');
  ok(errs.length === 0, 'no page errors', errs);
  await b.close(); console.log('ERRORS ' + fails); process.exit(fails ? 1 : 0);
})();
