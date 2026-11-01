const { _electron } = require('playwright'); const fs = require('fs'); const S = __dirname; const log = (...a) => console.log(...a);
(async () => { const app = await _electron.launch({ executablePath: '/home/user/helixboard/desktop/node_modules/electron/dist/electron', args: ['--no-sandbox', '/home/user/helixboard/desktop'], env: Object.assign({}, process.env, { HB_CLOUDFLARED: S + '/fake-cloudflared', HB_TUNNEL_PING_ORIGIN: 'http://127.0.0.1:9555' }) });
  const w = await app.firstWindow(); await w.waitForLoadState(); await w.evaluate(() => { localStorage['hb:accSkip'] = 'true'; localStorage['hb:askSession'] = 'false'; }); await w.reload(); await w.waitForLoadState();
  const errs = []; w.on('pageerror', e => errs.push(e.message)); w.on('console', m => { if (m.type() === 'error') errs.push('c:' + m.text().slice(0, 160)); }); await w.waitForTimeout(2500); await w.evaluate(() => HB.modal.close());
  const b64 = fs.readFileSync(S + '/anim.pptx').toString('base64'); await w.evaluate(b64 => HBIO.importPptx(new File([Uint8Array.from(atob(b64), c => c.charCodeAt(0))], 'a.pptx')), b64);
  await w.waitForSelector('#ppGo'); await w.click('#ppGo'); await w.waitForFunction(() => HBE.page().deck, null, { timeout: 120000 }); await w.waitForTimeout(500);
  await w.evaluate(async () => { await HBCL.start({ quiet: true }); await helixDesktop.cl.cmd('options', { boardOn: true }); }); await w.waitForTimeout(1500);
  await w.keyboard.press('F5'); await w.waitForTimeout(1500);
  const alive = async label => { const t = Date.now(); const r = await Promise.race([w.evaluate(() => new Promise(ok => requestAnimationFrame(() => setTimeout(() => ok('ok'), 0)))), new Promise(ok => setTimeout(() => ok('FROZEN'), 8000))]); const c = await Promise.race([w.evaluate(() => (document.getElementById('shCnt') || {}).textContent), new Promise(ok => setTimeout(() => ok('?'), 3000))]); log(label, r, (Date.now() - t) + 'ms', 'counter', c); };
  await alive('before:');
  for (const how of ['minimize', 'blur']) {
    if (how === 'minimize') await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].minimize()); else await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].blur());
    await new Promise(r => setTimeout(r, 20000));
    await app.evaluate(({ BrowserWindow }) => { const x = BrowserWindow.getAllWindows()[0]; x.restore(); x.show(); x.focus(); });
    await w.waitForTimeout(800); await alive('after ' + how + ' 20 s:');
    await w.keyboard.press('ArrowRight'); await w.waitForTimeout(400); await alive('  then a key:'); }
  /* pen down on a slide, then the window is left without lifting the pen */
  await w.keyboard.press('Escape'); await w.waitForTimeout(400); await w.keyboard.press('Escape'); await w.waitForTimeout(400);
  await w.evaluate(() => HBI.setTool('draw', 'pen')); const n0 = await w.evaluate(() => HBE.page().objs.length);
  await w.mouse.move(800, 560); await w.mouse.down(); await w.mouse.move(850, 570);
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].minimize()); await new Promise(r => setTimeout(r, 4000));
  await app.evaluate(({ BrowserWindow }) => { const x = BrowserWindow.getAllWindows()[0]; x.restore(); x.focus(); }); await w.waitForTimeout(600);
  await w.mouse.up(); await w.waitForTimeout(300); const n1 = await w.evaluate(() => HBE.page().objs.length);
  await w.mouse.move(800, 620); await w.mouse.down(); for (let i = 0; i < 10; i++) await w.mouse.move(800 + i * 15, 620 + i * 2); await w.mouse.up(); await w.waitForTimeout(400);
  log('pen after leaving mid-stroke: interrupted stroke', n1 - n0, '| new stroke drawn after return', await w.evaluate(() => HBE.page().objs.length) - n1);
  await alive('after mid-stroke leave:');
  log('board pictures sent:', await w.evaluate(async () => (await helixDesktop.cl.cmd('snapshot')).boardOn));
  log('errs', errs); await app.close(); })().catch(e => { console.log('FAIL', e.message); process.exit(1); });
