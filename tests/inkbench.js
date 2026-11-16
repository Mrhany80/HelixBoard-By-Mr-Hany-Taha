/* HelixBoard ink benchmark — how fast is writing on a full board, on a slow smartboard PC?
   node inkbench.js [tests-folder] [--json out.json] [--seconds 20]
   Scenario: 3840x2160 screen, CPU slowed 4x, a board holding 2,000 strokes and 10 slide-size pictures,
   then scripted handwriting (pen samples every 8 ms, a short gap between strokes, a longer pause every 8 strokes).
   Prints one line per measurement and the targets. Numbers from headless Chromium compare builds with each other;
   they are not the touch delay of a real smartboard. */
let chromium; try { chromium = require('playwright').chromium; } catch (e) { chromium = require('playwright-core').chromium; }
const path = require('path'), fs = require('fs');
const args = process.argv.slice(2), opt = n => { const i = args.indexOf('--' + n); return i >= 0 ? args[i + 1] : null; };
const S = args[0] && !args[0].startsWith('--') ? args[0] : __dirname;
const SECONDS = +(opt('seconds') || 20), STROKES = +(opt('strokes') || 2000), PICS = +(opt('pics') || 10), THROTTLE = +(opt('throttle') || 4);
const URL = 'file://' + path.resolve(S, '..', 'dist', 'index.html') + '?nointro=1&accskip=1';
const TARGET = { commit: 4, frame: 8, task: 50, first: 2000 };
const pct = (a, q) => { if (!a.length) return 0; const s = a.slice().sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(s.length * q))]; };
const r1 = x => Math.round(x * 10) / 10;

(async () => {
  const launch = { args: ['--enable-gpu-rasterization', '--ignore-gpu-blocklist'] }; if (fs.existsSync('/usr/bin/google-chrome') && !process.env.HB_BUNDLED) launch.executablePath = '/usr/bin/google-chrome';
  const b = await chromium.launch(launch);
  const [VW, VH] = (opt('screen') || '3840x2160').split('x').map(Number); const c = await b.newContext({ viewport: { width: VW, height: VH }, deviceScaleFactor: 1 });
  await c.addInitScript(() => { localStorage['hb:accSkip'] = 'true'; localStorage['hb:seenIntro'] = 'true'; localStorage['hb:seenVer'] = '"99"'; localStorage['hb:dueSeen'] = '"x"';
    /* time every animation-frame callback and every long task */
    const raf = window.requestAnimationFrame.bind(window); window.__f = []; window.__lt = []; window.__rec = false;
    window.requestAnimationFrame = cb => raf(t => { const a = performance.now(); try { cb(t); } finally { if (window.__rec) window.__f.push([a, performance.now() - a]); } });
    try { new PerformanceObserver(l => l.getEntries().forEach(e => { if (window.__rec) window.__lt.push([e.startTime, e.duration]); })).observe({ entryTypes: ['longtask'] }); } catch (e) {} });
  await c.route(/^https?:/, r => r.abort());
  const p = await c.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  const cdp = await c.newCDPSession(p); await cdp.send('Emulation.setCPUThrottlingRate', { rate: THROTTLE });

  /* 1. launch to first ink: page load until a pen stroke is on the board */
  const t0 = Date.now(); await p.goto(URL); await p.waitForFunction(() => window.HBE && window.HBI && document.getElementById('cvLive'), null, { timeout: 120000 });
  await p.evaluate(async () => { const cv = document.getElementById('cvLive'), ev = (t, x, y) => cv.dispatchEvent(new PointerEvent(t, { pointerId: 7, pointerType: 'pen', isPrimary: true, clientX: x, clientY: y, pressure: 0.4, buttons: t === 'pointerup' ? 0 : 1, button: 0, bubbles: true, cancelable: true }));
    HBI.setTool('draw', 'pen'); for (let k = 0; k < 200 && !HBE.page().objs.length; k++) { ev('pointerdown', 900, 900); for (let i = 1; i < 8; i++) ev('pointermove', 900 + i * 9, 900 + i * 4); ev('pointerup', 970, 930); await new Promise(r => setTimeout(r, 25)); } });
  await p.waitForFunction(() => HBE.page().objs.length > 0, null, { timeout: 120000 }); const first = Date.now() - t0;

  /* 2. a full board: strokes all over the page, and slide-size pictures */
  const seeded = await p.evaluate(async ({ STROKES, PICS }) => { const E = HBE, pg = E.page(); E.del(pg.objs.slice());
    let s = 7; const R = () => (s = (s * 16807) % 2147483647) / 2147483647; const cols = ['#1E1419', '#C2185B', '#1565C0', '#2E7D32'];
    const objs = []; for (let i = 0; i < STROKES; i++) { const x0 = 60 + R() * 1750, y0 = 60 + R() * 2040, pts = []; let x = x0, y = y0; for (let k = 0; k < 34; k++) { x += 2 + R() * 4; y += Math.sin(k / 3 + i) * 3; pts.push(Math.round(x * 10) / 10, Math.round(y * 10) / 10, 0.5); } objs.push({ t: 'stroke', pen: 'pen', c: cols[i % 4], w: 4, sp: true, pts }); }
    for (let i = 0; i < PICS; i++) { const cvs = document.createElement('canvas'); cvs.width = 1280; cvs.height = 720; const g = cvs.getContext('2d'); const im = g.createImageData(1280, 720); for (let k = 0; k < im.data.length; k += 4) { const v = (k / 4 % 1280) / 5 + R() * 60; im.data[k] = v; im.data[k + 1] = 120 + R() * 50; im.data[k + 2] = 255 - v; im.data[k + 3] = 255; } g.putImageData(im, 0, 0); const id = 'bench' + i; E.B.assets[id] = cvs.toDataURL('image/jpeg', 0.9); objs.push({ t: 'img', asset: id, x: 100 + (i % 5) * 340, y: 2300 + Math.floor(i / 5) * 220, w: 320, h: 180 }); }
    E.add(objs); await E.saveNow(); return { objs: E.page().objs.length, assetsMB: Math.round(Object.values(E.B.assets).reduce((a, v) => a + v.length, 0) / 1e5) / 10 }; }, { STROKES, PICS });
  await p.waitForTimeout(2500);

  /* 3. handwriting (--profile lists where the time goes) */
  const tr = []; if (opt('trace')) { cdp.on('Tracing.dataCollected', d => tr.push(...d.value)); await cdp.send('Tracing.start', { categories: 'devtools.timeline,disabled-by-default-devtools.timeline', transferMode: 'ReportEvents' }); }
  if (args.includes('--profile')) { await cdp.send('Profiler.enable'); await cdp.send('Profiler.setSamplingInterval', { interval: 500 }); await cdp.send('Profiler.start'); }
  const res = await p.evaluate(async ({ SECONDS }) => { const cv = document.getElementById('cvLive'), sleep = ms => new Promise(r => setTimeout(r, ms)); const moves = [], ups = [], upAt = [];
    const ev = (t, x, y) => { const e = new PointerEvent(t, { pointerId: 7, pointerType: 'pen', isPrimary: true, clientX: x, clientY: y, pressure: 0.35 + Math.random() * 0.3, buttons: t === 'pointerup' ? 0 : 1, button: 0, bubbles: true, cancelable: true }); const a = performance.now(); cv.dispatchEvent(e); return performance.now() - a; };
    HBI.setTool('draw', 'pen'); window.__f.length = 0; window.__lt.length = 0; window.__rec = true; const start = performance.now(); let n = 0, col = 0, row = 0;
    while (performance.now() - start < SECONDS * 1000) { const x0 = 300 + col * 70, y0 = 400 + row * 120; ev('pointerdown', x0, y0); for (let i = 1; i <= 26; i++) { await sleep(8); moves.push(ev('pointermove', x0 + i * 2.2 + Math.sin(i / 2) * 6, y0 + Math.cos(i / 3) * 34)); }
      upAt.push(performance.now()); ups.push(ev('pointerup', x0 + 58, y0)); n++; col++; if (col > 44) { col = 0; row++; } await sleep(n % 8 === 0 ? 1100 : 140); }
    await sleep(1500); window.__rec = false; const end = performance.now();
    /* a stroke's commit = the pointer-up handler + the frame that paints it onto the board */
    const commits = upAt.map((t, i) => { const f = window.__f.filter(x => x[0] >= t && x[0] < t + 60).slice(0, 2); return ups[i] + (f.length ? Math.max(...f.map(x => x[1])) : 0); });
    return { strokes: n, moves, commits, frames: window.__f.filter(x => x[0] >= start && x[0] <= end).map(x => x[1]), taskAt: window.__lt.map(x => { const u = upAt.filter(t => t <= x[0]).pop(); return [Math.round(x[0] - start), Math.round(x[1]), u == null ? -1 : Math.round(x[0] - u)]; }), tasks: window.__lt.map(x => x[1]), total: HBE.page().objs.length }; }, { SECONDS });
  if (args.includes('--profile')) { const { profile } = await cdp.send('Profiler.stop'); if (opt('profile-out')) fs.writeFileSync(opt('profile-out'), JSON.stringify(profile)); const self = {}, dt = profile.timeDeltas, byId = {}; profile.nodes.forEach(n => byId[n.id] = n);
    profile.samples.forEach((id, i) => { const f = byId[id].callFrame, k = (f.functionName || '(anonymous)') + ' :' + f.lineNumber; self[k] = (self[k] || 0) + (dt[i] || 0) / 1000; });
    console.log('where the time goes (self time, ms):'); Object.entries(self).sort((a, b) => b[1] - a[1]).slice(0, 22).forEach(([k, v]) => console.log('  ' + String(Math.round(v)).padStart(7) + '  ' + k)); }
  if (opt('trace')) { const done = new Promise(r => cdp.once('Tracing.tracingComplete', r)); await cdp.send('Tracing.end'); await done; fs.writeFileSync(opt('trace'), JSON.stringify(tr)); }
  const hbErr = await p.evaluate(() => window.__hbErr || []);
  await b.close();

  const out = { scenario: { screen: VW + 'x' + VH, cpuThrottle: THROTTLE, strokesOnBoard: STROKES, pictures: PICS, assetsMB: seeded.assetsMB, seconds: SECONDS, strokesWritten: res.strokes },
    firstInkMs: first, commitMs: { median: r1(pct(res.commits, 0.5)), p95: r1(pct(res.commits, 0.95)), max: r1(Math.max(0, ...res.commits)) },
    frameMs: { median: r1(pct(res.frames, 0.5)), p95: r1(pct(res.frames, 0.95)), max: r1(Math.max(0, ...res.frames)) },
    penSampleMs: { median: r1(pct(res.moves, 0.5)), p95: r1(pct(res.moves, 0.95)), max: r1(Math.max(0, ...res.moves)) },
    longTasks: { count: res.tasks.length, longestMs: r1(Math.max(0, ...res.tasks)), totalMs: r1(res.tasks.reduce((a, x) => a + x, 0)) }, errors: errs.concat(hbErr) };
  const row = (name, v, target) => console.log((v <= target ? 'ok   ' : 'OVER ') + name.padEnd(34) + String(v).padStart(8) + ' ms   target ' + target);
  console.log('board: ' + seeded.objs + ' objects, ' + seeded.assetsMB + ' MB of pictures; wrote ' + res.strokes + ' strokes in ' + SECONDS + ' s; CPU ' + THROTTLE + 'x slower');
  row('launch to first ink', out.firstInkMs, TARGET.first); row('stroke commit (95th percentile)', out.commitMs.p95, TARGET.commit); row('frame while writing (95th pct)', out.frameMs.p95, TARGET.frame); row('longest main-thread task', out.longTasks.longestMs, TARGET.task);
  console.log('     stroke commit median ' + out.commitMs.median + ' max ' + out.commitMs.max + ' | frame median ' + out.frameMs.median + ' max ' + out.frameMs.max + ' | pen sample p95 ' + out.penSampleMs.p95 + ' | long tasks ' + out.longTasks.count + ' (' + out.longTasks.totalMs + ' ms in all)');
  if (args.includes('--tasks')) console.log('long tasks [ms into the run, length, ms after the last pen-up]: ' + JSON.stringify(res.taskAt));
  if (opt('json')) fs.writeFileSync(opt('json'), JSON.stringify(out, null, 1));
  console.log('ERRORS ' + JSON.stringify(out.errors));
})().catch(e => { console.error('Error: ' + e.message); process.exit(1); });
