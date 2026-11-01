/* B1: write and type on slides with click animations, then advance 20 times with the pen on, keys, ▶, laser click,
   something selected and the text box left open — every advance must move the step, fast, without errors */
const { chromium } = require('playwright'); const fs = require('fs'); const S = process.argv[2] || __dirname; const log = (...a) => console.log(...a);
(async () => { const b = await chromium.launch(); const c = await b.newContext({ viewport: { width: 1400, height: 850 } }); await c.addInitScript(() => { localStorage['hb:accSkip'] = 'true'; }); const p = await c.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('file:///home/user/helixboard/dist/index.html?nointro'); await p.waitForTimeout(1500);
  const b64 = fs.readFileSync(S + '/anim.pptx').toString('base64'); await p.evaluate(b64 => { const u = Uint8Array.from(atob(b64), c => c.charCodeAt(0)); HBIO.importPptx(new File([u], 'anim.pptx')); }, b64);
  await p.waitForSelector('#ppGo', { timeout: 20000 }); await p.click('#ppGo'); await p.waitForFunction(() => HBE.page().deck, null, { timeout: 120000 }); await p.waitForTimeout(800);
  /* 400 ink strokes and 20 text boxes over the slides, then leave a text box open and something selected */
  await p.evaluate(() => { const st = HBE.page().objs.find(o => o.step) || HBE.page().objs[0], objs = []; const x0 = st.x, y0 = st.y;
    for (let k = 0; k < 400; k++) { const pts = []; for (let j = 0; j < 30; j++) pts.push(x0 + (k % 20) * 30 + j * 3, y0 + Math.floor(k / 20) * 25 + Math.sin(j) * 8, 0.5); objs.push({ id: HB.uid(), t: 'stroke', pen: 'pen', c: '#e03131', w: 4, a: 1, pts }); }
    for (let k = 0; k < 20; k++) objs.push({ id: HB.uid(), t: 'text', x: x0 + 40, y: y0 + k * 30, w: 0, s: 'Note ' + k, font: 'Lexend', size: 22, c: '#1971c2' });
    HBE.tx(() => HBE.add(objs, 1)); HBI.setTool('pen'); });
  await p.keyboard.press('F5'); await p.waitForTimeout(1500);
  /* measure inside the page: key or click → the step counter changes */
  await p.evaluate(() => { window.__lat = []; let t = 0; const mark = () => { t = performance.now(); }; document.addEventListener('keydown', mark, true); document.addEventListener('pointerdown', mark, true);
    new MutationObserver(() => { if (t) { window.__lat.push(Math.round(performance.now() - t)); t = 0; } }).observe(document.body, { subtree: true, characterData: true, childList: true }); });
  const cnt = () => p.textContent('#shCnt'); const ctlNext = async () => { const bs = await p.$$('#showCtl button'); for (const x of bs) { const t = ((await x.getAttribute('title')) || '') + (await x.innerText()); if (/next|▶|→/i.test(t)) return x; } return null; };
  const moves = [['ArrowRight'], ['Space'], ['PageDown'], ['Enter'], ['btn'], ['ArrowRight', 'select'], ['PageDown', 'editor'], ['ArrowRight'], ['laser'], ['Space']];
  let ok = 0, n = 0; const times = [];
  const restart = async () => { if (await p.$('#shCnt')) { await p.keyboard.press('Escape'); await p.waitForTimeout(300); if (await p.$('#shCnt')) { await p.keyboard.press('Escape'); await p.waitForTimeout(300); } } await p.evaluate(() => HBI.setTool('pen')); await p.keyboard.press('F5'); await p.waitForTimeout(900); };
  const atEnd = async () => !(await p.$('#shCnt')) || await p.evaluate(() => { const L = window.__hbDeckLog || []; return false; });
  let seq = [];
  for (let r = 0; r < 2; r++) for (const [how, state] of moves) { n++; if (!(await p.$('#shCnt'))) await restart(); let before = await cnt();
    if (state === 'select') await p.evaluate(() => HBI.select(HBE.page().objs.filter(o => o.t === 'text').pop()));
    if (state === 'editor') await p.evaluate(() => { const o = HBE.page().objs.filter(o => o.t === 'text').pop(); HBI.openEditor(o); });
    const t0 = Date.now();
    if (how === 'btn') { const x = await ctlNext(); if (x) await x.click(); }
    else if (how === 'laser') { await p.evaluate(() => HBI.setTool('laser')); await p.mouse.click(700, 420); await p.evaluate(() => HBI.setTool('pen')); }
    else await p.keyboard.press(how === 'Space' ? ' ' : how);
    let after = before; while (Date.now() - t0 < 1500) { after = await p.$('#shCnt') ? await cnt() : 'ended'; if (after !== before) break; await p.waitForTimeout(10); }
    const ms = Date.now() - t0; const moved = after !== before || !(await p.$('#shCnt'));
    if (!moved) { /* the end of the deck: start again and try the same input */ await restart(); before = await cnt(); const t1 = Date.now();
      if (state === 'editor') await p.evaluate(() => { const o = HBE.page().objs.filter(o => o.t === 'text').pop(); HBI.openEditor(o); });
      if (how === 'btn') { const x = await ctlNext(); if (x) await x.click(); } else if (how === 'laser') { await p.evaluate(() => HBI.setTool('laser')); await p.mouse.click(700, 420); await p.evaluate(() => HBI.setTool('pen')); } else await p.keyboard.press(how === 'Space' ? ' ' : how);
      while (Date.now() - t1 < 1500) { after = await p.$('#shCnt') ? await cnt() : 'ended'; if (after !== before) break; await p.waitForTimeout(10); }
      if (after !== before) { ok++; times.push(Date.now() - t1); } else log('  did not move:', how, state || '', before); }
    else { times.push(ms); ok++; } seq.push(before + '→' + after);
    await p.waitForTimeout(80); }
  log('sequence:', seq.join(' ')); log('advances that moved:', ok, '/', n, '| slowest', Math.max(...times), 'ms | average', Math.round(times.reduce((a, b) => a + b, 0) / times.length), 'ms');
  log('in-page response (ms):', await p.evaluate(() => JSON.stringify(window.__lat.slice(0, 40))));
  log('deck log entries:', await p.evaluate(() => (window.__hbDeckLog || []).length));
  log('errs', errs); await b.close(); })().catch(e => { console.log('FAIL', e.message); process.exit(1); });
