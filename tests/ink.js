/* v3.0.0 — the ink path: a finished stroke is painted straight onto the board, saving waits for a pause, nothing is lost.
   node ink.js [tests-folder]   — prints one line per check, then "ERRORS n". */
let chromium; try { chromium = require('playwright').chromium; } catch (e) { chromium = require('playwright-core').chromium; }
const path = require('path');
const S = process.argv[2] || __dirname, URL = 'file://' + path.resolve(S, '..', 'dist', 'index.html') + '?nointro=1&accskip=1';
const fails = []; const ok = (name, cond, info) => { console.log((cond ? 'ok   ' : 'FAIL ') + name + (info !== undefined ? '  ' + JSON.stringify(info) : '')); if (!cond) fails.push(name); };
(async () => {
  const b = await chromium.launch(); const c = await b.newContext({ viewport: { width: 1600, height: 900 } });
  await c.addInitScript(() => { localStorage['hb:accSkip'] = 'true'; localStorage['hb:seenVer'] = '"99"'; localStorage['hb:seenIntro'] = 'true'; localStorage['hb:dueSeen'] = '"x"'; });
  await c.route(/^https?:/, r => r.abort()); const p = await c.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message + ' | ' + String(e.stack).split('\n').slice(1, 4).join(' ').slice(0, 300)));
  await p.goto(URL); await p.waitForFunction(() => window.HBE && window.HBI); await p.waitForTimeout(1200);
  ok('app starts with no module errors', await p.evaluate(() => !(window.__hbErr || []).length), await p.evaluate(() => window.__hbErr || []));

  /* the pen: pointer events on the board, as a smartboard pen sends them */
  await p.evaluate(() => { const cv = document.getElementById('cvLive'); window.pen = (t, x, y, type) => cv.dispatchEvent(new PointerEvent(t, { pointerId: 5, pointerType: type || 'pen', isPrimary: true, clientX: x, clientY: y, pressure: 0.5, buttons: t === 'pointerup' ? 0 : 1, button: 0, bubbles: true, cancelable: true }));
    window.write = (x0, y0, type) => { pen('pointerdown', x0, y0, type); for (let i = 1; i <= 30; i++) pen('pointermove', x0 + i * 6, y0 + Math.sin(i / 3) * 30, type); pen('pointerup', x0 + 180, y0, type); };
    window.shot = () => { const c = HBE.cvMain; return c.getContext('2d').getImageData(0, 0, c.width, c.height).data; };
    window.diff = (a, b) => { let n = 0; for (let i = 0; i < a.length; i += 4) if (Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2]) + Math.abs(a[i + 3] - b[i + 3]) > 24) n++; return n; };
    window.frames = n => new Promise(r => { const f = () => (n-- > 0 ? requestAnimationFrame(f) : r()); f(); }); });

  /* 1. fast commit paints exactly what a full redraw paints, for every pen */
  const PENS = ['pen', 'pencil', 'marker', 'chalk', 'glow', 'dash', 'calli', 'hi'];
  for (let k = 0; k < PENS.length; k++) { const pen = PENS[k];
    const r = await p.evaluate(async ({ pen, k }) => { HBI.setTool('draw', pen); await frames(3); HBE.dirty.main = false; const n0 = HBE.page().objs.length; write(300 + (k % 2) * 420, 190 + Math.floor(k / 2) * 110);
      const fast = HBE.dirty.main === false; const a = shot(); HBE.dirty.main = true; await frames(3); const b = shot(); return { added: HBE.page().objs.length - n0, fast, differ: diff(a, b), ink: diff(b, new Uint8ClampedArray(b.length)) }; }, { pen, k });
    ok('pen "' + pen + '": painted at once, same picture as a full redraw', r.added === 1 && r.fast && r.differ <= 40 && r.ink > 200, r); }
  /* 2. the fast path steps aside when it would be wrong */
  ok('a stroke under a highlighter line gets a full redraw (layers stay in order)', await p.evaluate(async () => { HBE.add([{ t: 'stroke', pen: 'hi', c: '#FFEB3B', w: 30, pts: [200, 700, 0.5, 900, 700, 0.5] }]); await frames(3); HBI.setTool('draw', 'pen'); HBE.dirty.main = false; const r = document.getElementById('stage').getBoundingClientRect(), S = (x, y) => { const q = HBE.toS(x, y); return [q[0] + r.left, q[1] + r.top]; }; pen('pointerdown', ...S(300, 650)); for (let i = 1; i < 20; i++) pen('pointermove', ...S(300 + i * 10, 650 + i * 5)); pen('pointerup', ...S(500, 750)); return HBE.dirty.main === true; }));
  ok('undo and redo still redraw the page', await p.evaluate(async () => { await frames(3); const n = HBE.page().objs.length; HBE.undo(); const a = HBE.dirty.main && HBE.page().objs.length === n - 1; await frames(3); HBE.redo(); return a && HBE.dirty.main && HBE.page().objs.length === n; }));
  await p.waitForTimeout(2700); /* a finger straight after the pen is taken for a resting palm */
  ok('finger writing (smartboard) is painted at once too', await p.evaluate(async () => { await frames(3); HBE.dirty.main = false; const n = HBE.page().objs.length; HBI.setTool('draw', 'pen'); write(900, 200, 'touch'); return HBE.page().objs.length === n + 1 && HBE.dirty.main === false; }));

  /* 3. the saved copy is the same as the old stringify-parse-stringify copy */
  ok('saved file text is identical to the 2.8 format', await p.evaluate(() => { const B = HBE.B; HBE.add([{ t: 'text', s: 'Mitosis نص عربي', x: 100, y: 100, w: 300, h: 60, _tmp: 1, runs: [{ a: 1, _x: 2 }, { b: [1, 2, { c: 3, _d: 4 }] }], u: undefined, n: null }]);
    const old = JSON.stringify({ v: B.v, title: B.title, width: B.width, mode: B.mode, cur: B.cur, pages: B.pages.map(p => ({ id: p.id, name: p.name || undefined, mod: p.mod || undefined, theme: p.theme, contrast: p.contrast, H: p.H, layers: p.layers, deck: p.deck || undefined, ghost: p.ghost || undefined, sc: p.sc || undefined, objs: p.objs.map(HBE.clean) })) }); return old === HBE.serial() && !/"_/.test(HBE.serial()); }));

  /* 4. saving: not while the pen is busy, soon after it rests, at once when the app is left */
  const saves = await p.evaluate(async () => { let n = 0; HB.bus.on('saved', () => n++); await HBE.saveNow(); n = 0; const sleep = ms => new Promise(r => setTimeout(r, ms));
    const t0 = performance.now(); while (performance.now() - t0 < 4000) { write(300 + Math.random() * 600, 300 + Math.random() * 300); await sleep(250); } const during = n; await sleep(4500); return { during, after: n }; });
  ok('no save while writing without a pause', saves.during === 0, saves); ok('one save once the pen rests', saves.after === 1, saves);
  const n1 = await p.evaluate(() => { write(500, 500); document.dispatchEvent(new Event('visibilitychange')); window.dispatchEvent(new Event('pagehide')); return HBE.page().objs.length; });
  await p.waitForTimeout(700); await p.reload(); await p.waitForFunction(() => window.HBE && window.HBI); await p.waitForTimeout(1500);
  ok('a stroke written just before closing is there after reopening', await p.evaluate(() => HBE.page().objs.length) === n1, n1);

  /* 5. side work waits for the pen */
  ok('HB.later holds work back while the pen is down and runs it afterwards', await p.evaluate(async () => { let ran = 0; const f = HB.later(() => ran++, 50); HB.ink.down = true; HB.ink.at = performance.now(); f(); await new Promise(r => setTimeout(r, 600)); const held = ran === 0; HB.ink.down = false; HB.ink.at = performance.now() - 5000; await new Promise(r => setTimeout(r, 700)); return held && ran === 1; }));
  ok('a lost pointer-up cannot hold work back for ever', await p.evaluate(() => { HB.ink.down = true; HB.ink.at = performance.now() - 6000; const r = !HB.ink.busy(); HB.ink.down = false; return r; }));
  ok('no panel on the board blurs what is behind it; no endless animation', await p.evaluate(() => ['#dock', '#drawer', '#scrollBtns', '#mini'].every(s => { const e = document.querySelector(s); return !e || getComputedStyle(e).backdropFilter === 'none'; }) && document.getAnimations().filter(a => a.playState === 'running' && a.effect && a.effect.getComputedTiming().iterations === Infinity).length === 0));
  ok('no page errors', errs.length === 0, errs);
  await b.close(); console.log('ERRORS ' + fails.length + (fails.length ? ' ' + JSON.stringify(fails) : '')); process.exit(fails.length ? 1 : 0);
})().catch(e => { console.error('Error: ' + e.message); process.exit(1); });
