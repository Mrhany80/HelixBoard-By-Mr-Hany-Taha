/* One join for the whole lesson: phones in the class link move into the phone quiz by themselves and come back after it;
   then 40 simulated phones answer at the same moment. */
const { _electron, chromium } = require('playwright'); const S = process.argv[2]; const log = (...a) => console.log(...a);
(async () => { const app = await _electron.launch({ executablePath: '/home/user/helixboard/desktop/node_modules/electron/dist/electron', args: ['--no-sandbox', '/home/user/helixboard/desktop'], env: Object.assign({}, process.env, { HB_CLOUDFLARED: S + '/fake-cloudflared', HB_TUNNEL_PING_ORIGIN: 'http://127.0.0.1:9555' }) });
  const w = await app.firstWindow(); await w.waitForLoadState(); await w.evaluate(() => { localStorage['hb:accSkip'] = 'true'; localStorage['hb:askSession'] = 'false'; localStorage['hb:phonePace'] = '"teacher"'; localStorage['hb:phoneOpts'] = JSON.stringify({ mode: 'classic', power: false, conf: false }); }); await w.reload(); await w.waitForLoadState();
  const errs = []; w.on('pageerror', e => errs.push('T:' + e.message)); await w.waitForTimeout(2500); await w.evaluate(() => HB.modal.close());
  await w.evaluate(() => { localStorage['hb:quizSets'] = JSON.stringify({ 'Cells': [{ q: 'Powerhouse?', o: ['Nucleus', 'Mitochondrion', 'Ribosome', 'Vacuole'], a: 1, ex: '' }, { q: 'Makes protein?', o: ['Ribosome', 'Vacuole'], a: 0, ex: '' }] }); });
  await w.evaluate(() => HBLC.open()); await w.waitForTimeout(2000); const sn = await w.evaluate(() => helixDesktop.cl.cmd('snapshot'));
  const base = 'http://127.0.0.1:' + sn.port; const br = await chromium.launch(); const P = [];
  for (const n of ['Sara Ali', 'Omar Hassan', 'Lina Adel']) { const c = await br.newContext({ viewport: { width: 390, height: 800 }, isMobile: true }); const p = await c.newPage(); p.on('pageerror', e => errs.push(n + ':' + e.message)); await p.goto(base + '/?pin=' + sn.pin); await p.fill('input[placeholder="Your full name"]', n); await p.click('.go'); P.push(p); }
  await w.waitForTimeout(1500); log('class link players:', (await w.evaluate(() => helixDesktop.cl.cmd('snapshot'))).players.length);
  /* the teacher starts the quiz: no new QR code, phones move by themselves */
  await w.evaluate(() => { HBLC.hide(); HBL.phoneQuiz('Cells'); }); await w.waitForTimeout(4000);
  log('quiz lobby:', (await w.evaluate(() => document.querySelector('#pqB').innerText)).replace(/\s+/g, ' ').slice(0, 260));
  log('phone urls:', P.map(p => p.url().replace(base, '').slice(0, 40)).join(' | '));
  log('phone 1 sees:', (await P[0].textContent('main')).replace(/\s+/g, ' ').slice(0, 80));
  await w.keyboard.press('Space'); await w.waitForTimeout(1200);
  for (const [i, p] of P.entries()) await p.click('.opt:nth-child(' + (i === 2 ? 1 : 2) + ')').catch(e => errs.push('click ' + i + ' ' + e.message.slice(0, 60)));
  await w.waitForTimeout(1500); log('after Q1:', (await w.evaluate(() => helixDesktop.live.cmd('snapshot'))).counts.join(','));
  /* 40 more phones over plain HTTP, all answering Q2 at the same moment */
  const http = async (path, body) => { const r = await fetch(base + path, body ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {}); return r.json(); };
  const qpin = (await w.evaluate(() => helixDesktop.live.cmd('snapshot'))) && (await P[0].evaluate(() => new URLSearchParams(location.search).get('pin')));
  const bots = []; for (let i = 0; i < 40; i++) { const j = await http('/quiz/join', { pin: qpin, name: 'Student Number' + String.fromCharCode(65 + (i % 26)) + ' Bot' + i }); bots.push(j.pid); }
  log('bots joined:', bots.filter(Boolean).length);
  await w.keyboard.press('Space'); await w.waitForTimeout(600); await w.keyboard.press('Space'); await w.waitForTimeout(1200); /* reveal → board → next question */
  const ph = (await w.evaluate(() => helixDesktop.live.cmd('snapshot'))); log('phase', ph.phase, 'qi', ph.qi);
  const t0 = Date.now(); const lat = await Promise.all(bots.map(async pid => { const a = Date.now(); await http('/quiz/answer', { pid, qi: ph.qi, c: Math.random() < 0.7 ? 0 : 1 }); return Date.now() - a; }));
  log('40 answers in', Date.now() - t0, 'ms; slowest', Math.max(...lat), 'ms; average', Math.round(lat.reduce((a, b) => a + b, 0) / lat.length), 'ms');
  await w.waitForTimeout(800); const s2 = await w.evaluate(() => helixDesktop.live.cmd('snapshot')); log('answered', s2.answered, 'of', s2.players.length);
  /* end the quiz and close it: the phones go back to the class by themselves */
  await w.evaluate(() => helixDesktop.live.cmd('end')); await w.waitForTimeout(1200); await w.evaluate(() => { const b = [...document.querySelectorAll('#pqB button')].find(b => b.textContent.trim() === 'Done'); b && b.click(); }); await w.waitForTimeout(6000);
  log('phones after the quiz:', P.map(p => p.url().replace(base, '').slice(0, 20)).join(' | '));
  log('phone 1 back in class:', (await P[0].textContent('body')).replace(/\s+/g, ' ').slice(0, 90));
  log('class link still has players:', (await w.evaluate(() => helixDesktop.cl.cmd('snapshot'))).players.length);
  log('errs', errs); await br.close(); await app.close(); })();
