/* v3.0.0 — bug sweep in the browser: every tab, every filter, every tool button, tapped as a finger would, at two screen sizes.
   node sweep.js [tests-folder]   — page errors and console errors are listed per tool; then "ERRORS n". */
let chromium; try { chromium = require('playwright').chromium; } catch (e) { chromium = require('playwright-core').chromium; }
const path = require('path');
const S = process.argv[2] || __dirname, URL = 'file://' + path.resolve(S, '..', 'dist', 'index.html') + '?nointro=1&accskip=1';
/* buttons that open a file chooser, another window, the camera or the sign-in page */
const SKIP = /^(newb|about|acct|updates|introPlay|nk_scr|nk_ann|docO|doc|open|img|cam|bg_img|pickImage|save|docS|pdfx|png|docI|docP|vers|present|t_full|langAr|fs_|lset|ss_imp|installApp)/;
(async () => {
  const b = await chromium.launch(); const all = []; let total = 0;
  for (const vp of [{ width: 3840, height: 2160 }, { width: 1366, height: 768 }]) {
    const c = await b.newContext({ viewport: vp, hasTouch: true }); await c.addInitScript(() => { localStorage['hb:accSkip'] = 'true'; localStorage['hb:seenVer'] = '"99"'; localStorage['hb:seenIntro'] = 'true'; localStorage['hb:dueSeen'] = '"x"'; });
    await c.route(/^https?:/, r => r.abort()); const p = await c.newPage(); let cur = 'boot'; const errs = [], size = vp.width + 'x' + vp.height;
    p.on('pageerror', e => errs.push('[' + cur + '] ' + e.message + ' @ ' + String(e.stack || '').split('\n')[1])); p.on('console', m => { if (m.type() === 'error' && !/ERR_|Failed to load|net::/.test(m.text())) errs.push('[' + cur + '] console: ' + m.text()); });
    await p.goto(URL); await p.waitForFunction(() => window.HBE && window.HBUI); await p.waitForTimeout(1500);
    const start = await p.evaluate(() => window.__hbErr || []); start.forEach(e => errs.push('[boot] module: ' + e));
    await p.evaluate(() => { HB.modal.close(); window.confirm = () => false; window.alert = () => {}; window.prompt = () => null; });
    await p.waitForTimeout(600); const md = await p.evaluate(() => { const m = document.getElementById('modal'); return m && !m.hidden ? m.innerText.slice(0, 200) : ''; }); if (md) { console.log('a dialog is open at start: ' + md.replace(/\n/g, ' | ')); await p.evaluate(() => HB.modal.close()); }
    const tabs = await p.$$eval('#sidetabs [data-st]', e => e.map(x => x.dataset.st)); let n = 0; const small = [];
    for (const t of tabs) { await p.tap('[data-st="' + t + '"]'); await p.waitForTimeout(200);
      const subs = await p.$$eval('#toolrow .subchip', e => e.map(x => x.dataset.sub));
      for (const s of (subs.length ? subs : ['-'])) { if (s !== '-') { await p.tap('.subchip[data-sub="' + s + '"]'); await p.waitForTimeout(150); }
        const btns = await p.$$eval('#toolrow .tb[data-id]', e => e.map(x => { const r = x.getBoundingClientRect(); return { id: x.dataset.id, w: Math.round(r.width), h: Math.round(r.height) }; }));
        for (const { id, w, h } of btns) { if (SKIP.test(id)) continue; cur = size + ' ' + t + '/' + id; n++; if (Math.min(w, h) < 40 && !small.includes(id)) small.push(id + ' ' + w + 'x' + h);
          try { await p.tap('#toolrow .tb[data-id="' + id + '"]', { timeout: 6000 }); } catch (e) { const why = await p.evaluate(id => { const x = document.querySelector('#toolrow .tb[data-id="' + id + '"]'); if (!x) return 'button gone'; const r = x.getBoundingClientRect(); let e = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2); const o = []; while (e && o.length < 3) { o.push(e.id || String(e.className).slice(0, 30) || e.tagName); e = e.parentElement; } return 'covered by ' + o.join(' < ') + (document.getElementById('modal').hidden ? '' : ' | dialog: ' + document.getElementById('sheet').innerText.slice(0, 80).replace(/\n/g, ' ')); }, id); errs.push('[' + cur + '] could not tap — ' + why); }
          await p.waitForTimeout(160);
          await p.evaluate(() => { try { HB.modal.close(); } catch (e) {} document.querySelectorAll('#stStage .st-x,[data-sx]').forEach(x => x.click()); Object.values(HB.floats || {}).forEach(f => { try { f.destroy(); } catch (e) {} }); document.querySelectorAll('.wfull,#showEnd,#showBlank').forEach(x => x.remove()); });
          await p.keyboard.press('Escape'); await p.waitForFunction(() => document.getElementById('modal').hidden, null, { timeout: 4000 }).catch(() => {}); await p.waitForTimeout(40);
          if (!(await p.$('#toolrow'))) errs.push('[' + cur + '] the tool row disappeared'); } } }
    /* after all that: the pen still writes */
    cur = size + ' write'; const wrote = await p.evaluate(() => { HBI.setTool('draw', 'pen'); const cv = document.getElementById('cvLive'), n0 = HBE.page().objs.length, r = cv.getBoundingClientRect(), x0 = r.left + r.width / 2, y0 = r.top + r.height / 2;
      const ev = (t, x, y) => cv.dispatchEvent(new PointerEvent(t, { pointerId: 9, pointerType: 'pen', isPrimary: true, clientX: x, clientY: y, pressure: 0.5, buttons: t === 'pointerup' ? 0 : 1, bubbles: true, cancelable: true }));
      ev('pointerdown', x0, y0); for (let i = 1; i < 20; i++) ev('pointermove', x0 + i * 5, y0 + i * 2); ev('pointerup', x0 + 100, y0 + 40); return HBE.page().objs.length - n0; });
    if (wrote !== 1) errs.push('[' + cur + '] the pen did not write after the sweep — ' + await p.evaluate(() => JSON.stringify({ tool: HBI.T.tool, modal: !document.getElementById('modal').hidden, editing: !!HBI.editing, body: document.body.className, top: (() => { const cv = document.getElementById('cvLive'), r = cv.getBoundingClientRect(); const e = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return e && (e.id || e.className); })() })));
    console.log(size + ': tapped ' + n + ' tool buttons in ' + tabs.length + ' tabs; errors ' + errs.length + '; buttons under 40 px: ' + (small.length ? small.join(', ') : 'none'));
    total += n; all.push(...errs); await c.close(); }
  await b.close(); const U = {}; all.forEach(e => { const k = e.replace(/^\[[^\]]*\] /, ''); (U[k] = U[k] || []).push(e.match(/^\[([^\]]*)\]/)[1]); });
  Object.entries(U).forEach(([k, v]) => console.log('  ' + v.length + 'x ' + k.slice(0, 220) + '  <= ' + [...new Set(v)].slice(0, 5).join(', ')));
  console.log('ERRORS ' + all.length); process.exit(all.length ? 1 : 0);
})().catch(e => { console.error('Error: ' + e.message); process.exit(1); });
