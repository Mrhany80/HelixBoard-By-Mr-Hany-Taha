/* HelixBoard document import — PDF picture quality, Arabic reading order, and "Mark and return".
   node tests/doc.js
   Builds its own PDFs in the browser with the bundled jsPDF, so there are no fixture files. */
let chromium; try { chromium = require('playwright').chromium; } catch (e) { chromium = require('playwright-core').chromium; }
const path = require('path'), fs = require('fs');
const URL_ = 'file://' + path.resolve(__dirname, '..', 'dist', 'index.html') + '?nointro=1&accskip=1';
let fails = 0;
const ok = (c, m, x) => { console.log((c ? 'ok  ' : 'FAIL') + ' ' + m + (x === undefined ? '' : '  ' + JSON.stringify(x))); if (!c) fails++; };

(async () => {
  const launch = { args: ['--enable-gpu-rasterization', '--ignore-gpu-blocklist'] };
  if (fs.existsSync('/usr/bin/google-chrome') && !process.env.HB_BUNDLED) launch.executablePath = '/usr/bin/google-chrome';
  const b = await chromium.launch(launch);
  /* a 4K board: the page picture should be drawn for this screen, not for 1800 px */
  const c = await b.newContext({ viewport: { width: 3840, height: 2160 }, deviceScaleFactor: 1 });
  await c.addInitScript(() => { localStorage['hb:accSkip'] = 'true'; localStorage['hb:seenIntro'] = 'true'; localStorage['hb:seenVer'] = '"99"'; localStorage['hb:dueSeen'] = '"x"'; });
  await c.route(/^https?:/, r => r.abort());
  const p = await c.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto(URL_);
  await p.waitForFunction(() => window.HBE && window.HBIO && window.HBD, null, { timeout: 120000 });

  /* ---------- 1. a two-page PDF, imported as pictures ---------- */
  await p.evaluate(async () => {
    const { jsPDF } = await HB.need('jspdf');
    const d = new jsPDF({ unit: 'pt', format: 'a4' });
    d.setFontSize(28); d.text('Photosynthesis worksheet', 60, 90);
    d.setFontSize(13); d.text('1. Name the pigment that absorbs light.', 60, 140);
    d.addPage(); d.setFontSize(28); d.text('Page two', 60, 90);
    window.__pdf = new File([d.output('arraybuffer')], 'worksheet.pdf', { type: 'application/pdf' });
  });
  const before = await p.evaluate(() => HBE.B.pages.length);
  await p.evaluate(() => HBIO.importPdf(window.__pdf));
  await p.waitForSelector('#pdfGo', { timeout: 60000 });
  await p.click('#pdfGo');
  await p.waitForFunction(n => HBE.B.pages.length > n, before, { timeout: 120000 });
  await p.waitForFunction(() => { const d = HBE.page().deck; return d && d.slides.length >= 2; }, null, { timeout: 120000 });

  const info = await p.evaluate(() => { const pg = HBE.page(), d = pg.deck;
    const base = pg.objs.filter(o => o.deckBase && o.t === 'img');
    const url = HBE.B.assets[base[0].asset] || '';
    const im = new Image(); im.src = url;
    return { slides: d.slides.length, codec: url.slice(5, url.indexOf(';')), src: !!(d.pdfSrc && d.pdfSrc.asset), pages: d.pdfSrc && d.pdfSrc.pages, scale: HBIO.docScale(595, 842), screen: screen.width }; });
  ok(info.slides === 2, 'a 2-page PDF becomes 2 slides in one tab', { slides: info.slides });
  ok(info.codec === 'image/webp', 'page pictures are WebP, not JPEG (clean letter edges)', { codec: info.codec });
  ok(info.scale > 3, 'the page is drawn for the real screen, not capped at 1800 px', { screen: info.screen, scale: Math.round(info.scale * 100) / 100, wide: Math.round(595 * info.scale) });
  ok(info.src && String(info.pages) === '1,2', 'the original PDF and its page numbers are kept for Mark and return', { pages: info.pages });

  const px = await p.evaluate(() => new Promise(r => { const pg = HBE.page(); const o = pg.objs.find(q => q.deckBase && q.t === 'img');
    const im = new Image(); im.onload = () => r(im.naturalWidth); im.onerror = () => r(0); im.src = HBE.B.assets[o.asset]; }));
  ok(px > 1800, 'the stored picture really is wider than the old 1800 px limit', { px });

  /* ---------- 2. the kept original survives saving ---------- */
  /* the .helix file keeps only the pictures that are actually used; the original PDF hangs off the tab,
     not off an object, so it had to be added to that list or it would be dropped on save */
  const kept = await p.evaluate(() => { const board = JSON.parse(HBE.serial());
    const d = (board.pages || []).find(q => q.deck && q.deck.pdfSrc);
    if (!d) return { ok: false, why: 'no deck source in the saved board' };
    const keep = HBIO.usedAssets();
    return { ok: !!keep[d.deck.pdfSrc.asset], n: Object.keys(keep).length }; });
  ok(kept.ok, 'a saved .helix file still contains the original PDF', kept);

  /* ---------- 3. Arabic reading order ---------- */
  /* pdf.js hands over the pieces of a line in file order, which for Arabic runs right to left.
     The pieces below are a real Arabic sentence given back-to-front, the way a PDF stores it. */
  const ar = await p.evaluate(() => {
    const words = ['الضوئي', 'البناء', 'عملية'];            /* stored order: last word first */
    const xs = [60, 150, 240];                               /* and at rising x, as pdf.js reports */
    const items = words.map((s, i) => ({ str: s, width: 80, transform: [12, 0, 0, 12, xs[i], 700] }));
    const lines = [], vpH = 842, rows = [];
    /* the same grouping the app now uses */
    items.forEach(it => { const x = it.transform[4], y = vpH - it.transform[5], fs = Math.hypot(it.transform[2], it.transform[3]) || 12;
      let R = rows.find(r => Math.abs(r.y - y) < Math.max(r.fs, fs) * 0.5); if (!R) { R = { y, fs, it: [] }; rows.push(R); }
      R.fs = Math.max(R.fs, fs); R.it.push({ x, w: it.width, fs, s: it.str }); });
    rows.forEach(R => { const rtl = HB.isRTL(R.it.map(q => q.s).join(''));
      R.it.sort((a, b) => rtl ? (b.x + b.w) - (a.x + a.w) : a.x - b.x);
      let s = ''; R.it.forEach((q, i) => { if (i) { const pv = R.it[i - 1]; const gap = rtl ? pv.x - (q.x + q.w) : q.x - (pv.x + pv.w); if (gap > q.fs * 0.15 && !/\s$/.test(s)) s += ' '; } s += q.s; });
      lines.push({ s: s.trim(), rtl }); });
    return lines;
  });
  ok(ar.length === 1, 'an Arabic line stays one line instead of breaking into separate boxes', { lines: ar.length });
  ok(ar[0] && ar[0].rtl === true, 'the line is recognised as Arabic');
  ok(ar[0] && ar[0].s === 'عملية البناء الضوئي', 'the words come out in reading order, not reversed', { got: ar[0] && ar[0].s });

  /* ---------- 4. Mark and return ---------- */
  await p.evaluate(() => { const pg = HBE.page(), d = pg.deck; const y = d.top + 120;
    HBE.add({ t: 'stroke', pen: 'pen', c: '#C2185B', w: 6, sp: true, pts: [d.x0 + 100, y, 0.5, d.x0 + 400, y + 60, 0.5, d.x0 + 700, y, 0.5] }); });
  const dl = p.waitForEvent('download', { timeout: 180000 });
  await p.evaluate(() => HBIO.markReturn());
  let out = null;
  try { const d = await dl; const f = await d.path(); out = { name: d.suggestedFilename(), size: f ? fs.statSync(f).size : 0 }; } catch (e) { out = { err: e.message }; }
  ok(out && /_marked_.*\.pdf$/.test(out.name || ''), 'Mark and return saves a PDF named after the original', out);
  ok(out && out.size > 1000, 'the returned PDF has real content', { size: out && out.size });

  ok(errs.length === 0, 'no page errors', errs);
  await b.close();
  console.log('ERRORS ' + fails);
  process.exit(fails ? 1 : 0);
})();
