/* Bubble-sheet exam: build from a PDF, key pasted, two phones (one goes offline and reloads), results, key never sent */
const { _electron, chromium } = require('playwright'); const S = process.argv[2] || __dirname; const log = (...a) => console.log(...a);
(async () => { const app = await _electron.launch({ executablePath: '/home/user/helixboard/desktop/node_modules/electron/dist/electron', args: ['--no-sandbox', '/home/user/helixboard/desktop'], env: Object.assign({}, process.env, { HB_CLOUDFLARED: S + '/fake-cloudflared', HB_TUNNEL_PING_ORIGIN: 'http://127.0.0.1:9555' }) });
  const w = await app.firstWindow(); await w.waitForLoadState(); await w.evaluate(() => { localStorage['hb:accSkip'] = 'true'; localStorage['hb:askSession'] = 'false'; }); await w.reload(); await w.waitForLoadState();
  const errs = []; w.on('pageerror', e => errs.push('T:' + e.message)); await w.waitForTimeout(2500); await w.evaluate(() => HB.modal.close());
  await w.evaluate(() => { HB.set.put('lcTab', 'tests'); HBLC.open(); }); await w.waitForTimeout(1500); await w.click('#qbSheet'); await w.waitForTimeout(400);
  await w.fill('#sxN', '10'); await w.dispatchEvent('#sxN', 'change'); await w.fill('#sxR', '9-10 TF'); await w.dispatchEvent('#sxR', 'change'); await w.fill('#sxNeg', '0.25'); await w.dispatchEvent('#sxNeg', 'change'); await w.waitForTimeout(200);
  const [fc] = await Promise.all([w.waitForEvent('filechooser'), w.click('#sxDrop')]); await fc.setFiles(S + '/qb/g10.pdf'); await w.waitForSelector('#sxStage .thumbs img', { timeout: 60000 });
  await w.fill('#sxT', 'G10 Midterm (sheet)'); await w.dispatchEvent('#sxT', 'change'); await w.fill('#sxPaste', '1A 2C 3B 4D 5A 6B 7C 8D 9T 10F'); await w.click('#sxUsePaste'); await w.waitForTimeout(300);
  log('pages:', await w.evaluate(() => document.querySelectorAll('#sxStage .thumbs img').length), '| key complete:', /complete/.test(await w.textContent('#sxStage .card:nth-child(3) h3')));
  await w.screenshot({ path: S + '/sx_builder.png' });
  await w.click('#sxGo'); await w.waitForTimeout(3000);
  const sn = await w.evaluate(() => helixDesktop.cl.cmd('snapshot')), base = 'http://127.0.0.1:' + sn.port; const br = await chromium.launch(); const P = [], bodies = [];
  for (const [n, vp] of [['Sara Ali', { width: 1280, height: 800 }], ['Omar Hassan', { width: 360, height: 760 }]]) { const c = await br.newContext({ viewport: vp }); const p = await c.newPage(); p.on('pageerror', e => errs.push(n + ':' + e.message)); p.on('response', async r => { if (/\/t\/(paper|ans|submit)/.test(r.url())) { try { bodies.push(await r.text()); } catch (e) {} } });
    await p.goto(base + '/?pin=' + sn.pin); await p.fill('input[placeholder]', n); await p.click('.go'); await p.waitForURL(/\/exam\//, { timeout: 15000 }); await p.waitForSelector('.bub'); P.push({ p, c }); }
  const key = ['A', 'C', 'B', 'D', 'A', 'B', 'C', 'D', 'T', 'F'];
  const answer = async (p, i, l) => { const bs = await p.$$('#r' + i + ' .bub'); for (const b of bs) if ((await b.innerText()).trim() === l) { await b.click(); return; } };
  for (let i = 0; i < 10; i++) await answer(P[0].p, i, key[i]);
  await P[0].p.screenshot({ path: S + '/sx_phone_wide.png' });
  /* Omar: 5 answers, then the network drops, 3 more answers offline, reload, nothing lost */
  for (let i = 0; i < 5; i++) await answer(P[1].p, i, i < 3 ? key[i] : 'A'); await P[1].p.waitForTimeout(800);
  await P[1].c.setOffline(true); for (let i = 5; i < 8; i++) await answer(P[1].p, i, key[i]); await P[1].p.waitForTimeout(1500);
  await P[1].c.setOffline(false); await P[1].p.reload(); await P[1].p.waitForSelector('.bub'); await P[1].p.waitForTimeout(6500);
  log('Omar after offline + reload, answered:', await P[1].p.evaluate(() => document.querySelectorAll('.bub.on').length), '/ 8');
  await P[1].p.screenshot({ path: S + '/sx_phone_small.png' });
  /* integrity: Omar leaves the page once */
  await P[1].p.evaluate(() => { Object.defineProperty(document, 'hidden', { value: true, configurable: true }); document.dispatchEvent(new Event('visibilitychange')); }); await P[1].p.waitForTimeout(500);
  for (const { p } of P) { await p.click('#hand2'); await p.waitForTimeout(300); await p.click('.modal .go:not(.alt)'); await p.waitForTimeout(1200); }
  log('Sara sees:', (await P[0].p.textContent('#sheet')).replace(/\s+/g, ' ').slice(0, 60)); log('Omar sees:', (await P[1].p.textContent('#sheet')).replace(/\s+/g, ' ').slice(0, 60));
  await w.waitForTimeout(1500); const k = await w.evaluate(() => [...document.querySelectorAll('#tdStage .kpi')].map(x => x.innerText.replace(/\s+/g, ' ')).join(' | ')); log('KPIs:', k);
  await w.click('#tdStage .td-tabs [data-t="students"]'); await w.waitForTimeout(400); log('students:', (await w.evaluate(() => [...document.querySelectorAll('#tdStage table.t tbody tr')].map(r => r.innerText.replace(/\s+/g, ' ')).join(' || '))));
  await w.screenshot({ path: S + '/sx_dash.png' });
  /* the key never reaches a phone: no response before submit carries "a": */
  const leak = bodies.filter(b => /"a"\s*:/.test(b)); log('responses checked:', bodies.length, '| with a key field:', leak.length);
  log('ERRORS', errs); await br.close(); await app.close(); })().catch(e => { console.log('FAIL', e.message); process.exit(1); });
