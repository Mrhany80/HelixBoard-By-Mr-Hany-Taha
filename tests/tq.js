/* Tests: a PDF worksheet → online test → three phones take it → the dashboard. */
const { _electron, chromium } = require('playwright'); const S = process.argv[2] || __dirname; const log = (...a) => console.log(...a);
(async () => { const app = await _electron.launch({ executablePath: '/home/user/helixboard/desktop/node_modules/electron/dist/electron', args: ['--no-sandbox', '/home/user/helixboard/desktop'], env: Object.assign({}, process.env, { HB_CLOUDFLARED: S + '/fake-cloudflared', HB_TUNNEL_PING_ORIGIN: 'http://127.0.0.1:9555' }) });
  const w = await app.firstWindow(); await w.waitForLoadState(); await w.evaluate(() => { localStorage['hb:accSkip'] = 'true'; localStorage['hb:askSession'] = 'false'; }); await w.reload(); await w.waitForLoadState();
  const errs = []; w.on('pageerror', e => errs.push('T:' + e.message)); await w.waitForTimeout(2500); await w.evaluate(() => HB.modal.close());
  await w.evaluate(() => HBLC.open()); await w.waitForTimeout(2000);
  await w.click('.lc-tabs [data-tab="tests"]'); await w.waitForTimeout(600); await w.screenshot({ path: S + '/' + (process.env.TQ_PRE || 'tq') + '_1_tab.png' });
  await w.click('#qbNew'); await w.waitForTimeout(500); await w.fill('#qbT', ''); await w.screenshot({ path: S + '/' + (process.env.TQ_PRE || 'tq') + '_2_details.png' });
  await w.click('#qbNext'); await w.waitForTimeout(400);
  const [fc] = await Promise.all([w.waitForEvent('filechooser'), w.click('#qbDrop')]); await fc.setFiles(S + '/qb/' + (process.env.TQ_FILE || 'ws.pdf'));
  await w.waitForSelector('#qbList .q', { timeout: 30000 }); await w.waitForTimeout(500); await w.screenshot({ path: S + '/' + (process.env.TQ_PRE || 'tq') + '_3_review.png' });
  log('review:', (await w.evaluate(() => document.querySelector('#qbW .qb-card').innerText)).replace(/\s+/g, ' ').slice(0, 200));
  log('cards:', await w.evaluate(() => document.querySelectorAll('#qbList .q').length), 'figures:', await w.evaluate(() => document.querySelectorAll('#qbList img.fig').length));
  /* edit one question to check the editor */
  await w.evaluate(() => document.querySelector('#qbList .q [data-a="edit"]').click()); await w.waitForTimeout(300); await w.screenshot({ path: S + '/' + (process.env.TQ_PRE || 'tq') + '_4_edit.png' }); await w.evaluate(() => document.querySelector('#qbList .q [data-done]').click());
  await w.click('#qbGo'); await w.waitForTimeout(2500);
  const sn = await w.evaluate(() => helixDesktop.cl.cmd('snapshot')); const base = 'http://127.0.0.1:' + sn.port; log('dashboard open:', await w.evaluate(() => HBTD.on));
  const br = await chromium.launch(); const P = [];
  for (const n of ['Sara Ali', 'Omar Hassan', 'Lina Adel']) { const c = await br.newContext({ viewport: { width: 390, height: 820 }, isMobile: true }); const p = await c.newPage(); p.on('pageerror', e => errs.push(n + ':' + e.message)); await p.goto(base + '/?pin=' + sn.pin); await p.fill('input[placeholder="Your full name"]', n); await p.click('.go'); P.push(p); }
  for (const p of P) await p.waitForURL(/\/test\//, { timeout: 15000 }).catch(e => errs.push('no redirect'));
  await P[0].waitForSelector('.go'); await P[0].screenshot({ path: S + '/' + (process.env.TQ_PRE || 'tq') + '_5_phone_start.png' });
  /* every phone answers every question (Sara answers well, the others guess) */
  async function take(p, k, shots) { await p.click('.hero .go').catch(() => {}); for (let step = 0; step < 30; step++) { await p.waitForTimeout(250);
      const h = await p.evaluate(() => { const c = document.querySelector('main .card'); return c ? c.innerText : ''; }); if (/Handed in|Your score/.test(h)) break;
      const kind = await p.evaluate(() => document.querySelector('.blanks') ? 'blank' : document.querySelector('.match') ? 'match' : document.querySelector('.ord') ? 'order' : document.querySelector('.opt') ? 'opt' : document.querySelector('textarea.t') ? 'long' : document.querySelector('input.t') ? 'text' : 'none');
      const q = await p.evaluate(() => (document.querySelector('main h2') || {}).innerText || '');
      if (kind === 'opt') { const opts = await p.$$('.opt:not([disabled])'); const want = k === 0 ? await p.evaluate(q => /labelled X/.test(q) ? 'Chloroplast' : /energy/.test(q) ? 'Mitochondrion' : /All cells/.test(q) ? 'False' : /cell wall/.test(q) ? 'True' : '', q) : ''; let done = false;
        if (want) for (const o of opts) if ((await o.innerText()).includes(want)) { await o.click(); done = true; break; } if (!done && opts.length) await opts[(k + step) % opts.length].click(); }
      if (kind === 'text') await p.fill('input.t', k === 0 ? (/temperature/.test(q) ? '50' : 'grass') : k === 1 ? '30' : 'rabbit');
      if (kind === 'long') await p.fill('textarea.t', k === 0 ? 'The rate increases quickly and then levels off at a maximum' : 'it goes up');
      if (kind === 'blank') await p.fill('.blanks input', k === 2 ? 'nucleus' : 'chloroplasts');
      if (kind === 'match') { const sels = await p.$$('select'); for (const [i, s] of sels.entries()) { const want = k === 0 ? ['Controls the cell', 'Makes proteins', 'Photosynthesis'][i] : null; const vals = await s.$$eval('option', os => os.map(o => [o.value, o.textContent])); const v = want ? vals.find(x => x[1].includes(want)) : vals[1 + ((i + k) % (vals.length - 1))]; await s.selectOption(v[0]); } }
      if (kind === 'order') await p.click('.go.alt:has-text("Done")').catch(() => {});
      if (shots && step === 0) await p.screenshot({ path: S + '/' + (process.env.TQ_PRE || 'tq') + '_6_phone_q1.png' });
      const btn = await p.$('.foot .grow'); const label = btn ? await btn.innerText() : ''; await btn.click(); await p.waitForTimeout(350);
      if (shots && step === 0) await p.screenshot({ path: S + '/' + (process.env.TQ_PRE || 'tq') + '_7_phone_feedback.png' });
      if (/Check/.test(label)) { const fb = await p.$('.fb.retry'); if (fb && /Try once more/.test(await fb.innerText())) { await p.click('.foot .grow'); await p.waitForTimeout(300); } const nb = await p.$('.foot .grow'); const l2 = nb ? await nb.innerText() : ''; if (/Hand in/.test(l2)) { await nb.click(); await p.waitForTimeout(300); await p.click('.modal .go.ok'); break; } if (nb) await nb.click(); }
      if (/Hand in/.test(label)) { await p.waitForTimeout(200); await p.click('.modal .go.ok'); break; } } await p.waitForTimeout(800); }
  await take(P[0], 0, true); await P[0].screenshot({ path: S + '/' + (process.env.TQ_PRE || 'tq') + '_8_phone_result.png', fullPage: true });
  log('Sara result:', (await P[0].textContent('main')).replace(/\s+/g, ' ').slice(0, 140));
  await take(P[1], 1); await take(P[2], 2);
  await w.waitForTimeout(1500);
  const st = await w.evaluate(() => [...document.querySelectorAll('#tdStage .kpi')].map(k => k.innerText.replace(/\s+/g, ' ')).join(' | ')); log('KPIs:', st);
  await w.screenshot({ path: S + '/' + (process.env.TQ_PRE || 'tq') + '_9_dash.png' });
  await w.click('#tdStage .td-tabs [data-t="questions"]'); await w.waitForTimeout(500); await w.screenshot({ path: S + '/' + (process.env.TQ_PRE || 'tq') + '_10_questions.png' });
  /* the written answer: the teacher gives 2 of 2 points to Omar */
  await w.evaluate(() => { const rows = [...document.querySelectorAll('#tdStage tbody tr')]; const r = rows.find(r => /Describe/.test(r.innerText)); r && r.click(); }); await w.waitForTimeout(400);
  const inp = await w.$('#tdQ input[data-pid]'); if (inp) { await inp.fill('1'); await inp.dispatchEvent('change'); } await w.waitForTimeout(600);
  await w.click('#tdStage .td-tabs [data-t="students"]'); await w.waitForTimeout(500); await w.screenshot({ path: S + '/' + (process.env.TQ_PRE || 'tq') + '_11_students.png' });
  log('students:', (await w.evaluate(() => [...document.querySelectorAll('#tdStage table.t tbody tr')].map(r => r.innerText.replace(/\s+/g, ' ')).join(' || '))).slice(0, 300));
  /* close the test: phones see it closed */
  w.on('dialog', d => d.accept()); await w.click('#tdFinish'); await w.waitForTimeout(2000);
  log('saved run:', await w.evaluate(async () => { const ix = await HBQB.store.index(); return JSON.stringify(ix[0].runs[0]); }));
  log('ERRORS', errs); await br.close(); await app.close(); })().catch(e => { console.log('FAIL', e.message); process.exit(1); });
