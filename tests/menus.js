/* HelixBoard menus and toolbars — are the controls actually reachable?
   node tests/menus.js
   Opens every bar, panel and menu and checks each control for four faults:
     clipped   — scrolled or cut off outside its bar, so it cannot be seen or pressed
     tiny      — smaller than 40 px, too small for a finger on a smartboard
     unnamed   — no text and no title, so nothing explains it and a screen reader says nothing
     empty     — no text and no icon drawn: an invisible button holding space */
let chromium; try { chromium = require('playwright').chromium; } catch (e) { chromium = require('playwright-core').chromium; }
const path = require('path'), fs = require('fs');
const URL_ = 'file://' + path.resolve(__dirname, '..', 'dist', 'index.html') + '?nointro=1&accskip=1';
const SIZES = [[3840, 2160], [1920, 1080], [1366, 768]];
let fails = 0;



(async () => {
  const launch = { args: ['--enable-gpu-rasterization', '--ignore-gpu-blocklist'] };
  if (fs.existsSync('/usr/bin/google-chrome') && !process.env.HB_BUNDLED) launch.executablePath = '/usr/bin/google-chrome';
  const b = await chromium.launch(launch);
  for (const [W, H] of SIZES) {
    const c = await b.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1, hasTouch: true });
    await c.addInitScript(() => { localStorage['hb:accSkip'] = 'true'; localStorage['hb:seenIntro'] = 'true'; localStorage['hb:seenVer'] = '"99"'; localStorage['hb:dueSeen'] = '"x"'; });
    await c.route(/^https?:/, r => r.abort());
    const p = await c.newPage();
    await p.goto(URL_);
    await p.waitForFunction(() => window.HBE && window.HBD && window.HBUI, null, { timeout: 120000 });

    /* a deck, so the slide bar is on screen with every control it can show */
    await p.evaluate(async () => {
      const { jsPDF } = await HB.need('jspdf');
      const d = new jsPDF({ unit: 'pt', format: 'a4' });
      d.text('Year-End evaluation', 60, 90); d.addPage(); d.text('Page two', 60, 90);
      HBD.create('Year-End Final Evaluation Form 2024-2025.pdf',
        [{ asset: null, w: 595, h: 842 }, { asset: null, w: 595, h: 842 }]);
    });
    await p.waitForTimeout(900);

    const bars = ['#deckBar', '#deckRail', '#toolrow', '#dock', '#top', '#sidetabs', '#pagetabs', '#mini', '#deckPill'];
    const found = await p.evaluate(sels => {
      const out = [];
      for (const sel of sels) {
        const box = document.querySelector(sel);
        if (!box || box.hidden || !box.getClientRects().length) continue;
        const br = box.getBoundingClientRect();
        const sc = box.scrollWidth > box.clientWidth + 2;
        for (const el of box.querySelectorAll('button,select,input,a[role=button]')) {
          if (!el.getClientRects().length) continue;
          const r = el.getBoundingClientRect();
          const cs = getComputedStyle(el);
          /* a control hidden on purpose inside a label that is itself the target (the colour picker's
             <input type=color>) is not a fault — the label is what the finger presses */
          if (+cs.opacity === 0 || r.width <= 2 || r.height <= 2) continue;
          const txt = (el.textContent || '').trim();
          const name = txt || el.title || el.getAttribute('aria-label') || '';
          /* a colour swatch draws itself with a background, not an icon — still visible */
          const painted = (cs.backgroundImage && cs.backgroundImage !== 'none') ||
            !/^rgba\(0, 0, 0, 0\)$|^transparent$/.test(cs.backgroundColor);
          const hasIcon = !!el.querySelector('svg,img') || el.tagName === 'SELECT' || el.tagName === 'INPUT' || painted;
          const clipped = r.right > br.right + 1 || r.left < br.left - 1 || r.width === 0;
          /* the x that closes a page tab is deliberately small; see design.css */
          const exempt = sel === '#pagetabs' && /close/i.test((el.title || '') + ' ' + (el.getAttribute('aria-label') || ''));
          const tiny = !exempt && Math.min(r.width, r.height) < 40 && Math.min(r.width, r.height) > 0;
          if (clipped || tiny || !name || (!txt && !hasIcon)) out.push({ bar: sel, scrolls: sc,
            what: name || el.id || String(el.className) || el.tagName, clipped, tiny,
            size: Math.round(r.width) + 'x' + Math.round(r.height),
            unnamed: !name, empty: !txt && !hasIcon });
        }
      }
      return out;
    }, bars);
    const byBar = {};
    found.forEach(f => { (byBar[f.bar] = byBar[f.bar] || []).push(f); });
    console.log('--- ' + W + 'x' + H + ' ---');
    if (!found.length) console.log('ok   every control in every bar is reachable, named and at least 40 px');
    for (const bar of Object.keys(byBar)) {
      const g = byBar[bar];
      const cl = g.filter(x => x.clipped), ty = g.filter(x => x.tiny && !x.clipped), un = g.filter(x => x.unnamed), em = g.filter(x => x.empty);
      if (cl.length) { fails++; console.log('FAIL ' + bar + ': ' + cl.length + ' control(s) cut off / unreachable' + (g[0].scrolls ? ' (the bar scrolls sideways with no visible scrollbar)' : '') + '  ' + JSON.stringify(cl.map(x => x.what))); }
      if (ty.length) { fails++; console.log('FAIL ' + bar + ': ' + ty.length + ' control(s) under 40 px  ' + JSON.stringify(ty.map(x => x.what + ' ' + x.size))); }
      if (un.length) { fails++; console.log('FAIL ' + bar + ': ' + un.length + ' control(s) with no name or title  ' + JSON.stringify(un.map(x => x.what))); }
      if (em.length) { fails++; console.log('FAIL ' + bar + ': ' + em.length + ' control(s) drawing nothing at all  ' + JSON.stringify(em.map(x => x.what))); }
    }
    await c.close();
  }
  await b.close();
  console.log('ERRORS ' + fails);
  process.exit(fails ? 1 : 0);
})();
