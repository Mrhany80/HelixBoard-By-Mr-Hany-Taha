/* Tests in Arabic: pasted worksheet, a picture pasted onto a question (Ctrl+V), one phone takes it in Arabic */
const { _electron, chromium } = require('playwright'); const S = process.argv[2] || __dirname; const log = (...a) => console.log(...a); const fs = require('fs');
(async () => { const app = await _electron.launch({ executablePath: '/home/user/helixboard/desktop/node_modules/electron/dist/electron', args: ['--no-sandbox', '/home/user/helixboard/desktop'], env: Object.assign({}, process.env, { HB_CLOUDFLARED: S + '/fake-cloudflared', HB_TUNNEL_PING_ORIGIN: 'http://127.0.0.1:9555' }) });
  const w = await app.firstWindow(); await w.waitForLoadState(); await w.evaluate(() => { localStorage['hb:accSkip'] = 'true'; localStorage['hb:askSession'] = 'false'; }); await w.reload(); await w.waitForLoadState();
  const errs = []; w.on('pageerror', e => errs.push('T:' + e.message)); w.on('dialog', d => d.accept()); await w.waitForTimeout(2500); await w.evaluate(() => HB.modal.close());
  await w.evaluate(() => { HB.set.put('lcTab', 'tests'); HBLC.open(); }); await w.waitForTimeout(1800);
  await w.click('#qbNew'); await w.waitForTimeout(300); await w.fill('#qbT', 'اختبار الخلية'); await w.selectOption('#qbL', 'ar'); await w.click('#qbNext'); await w.waitForTimeout(300);
  await w.fill('#qbPaste', fs.readFileSync(S + '/qb/ws_ar.txt', 'utf8')); await w.click('#qbUsePaste'); await w.waitForSelector('#qbList .q'); await w.waitForTimeout(300);
  log('questions:', await w.evaluate(() => document.querySelectorAll('#qbList .q').length));
  /* Ctrl+V of a picture on question 1 */
  const png = fs.readFileSync(S + '/qb/cell.png').toString('base64');
  await w.evaluate(async b64 => { const bin = Uint8Array.from(atob(b64), c => c.charCodeAt(0)); const f = new File([bin], 'clip.png', { type: 'image/png' }); const dt = new DataTransfer(); dt.items.add(f);
    const c = document.querySelector('#qbList .q'); c.focus(); document.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true })); }, png); await w.waitForTimeout(800);
  log('figure pasted on Q1:', await w.evaluate(() => !!document.querySelector('#qbList .q img.fig')));
  /* and an equation pasted inside the question text while editing Q2 */
  await w.evaluate(() => document.querySelectorAll('#qbList .q [data-a="edit"]')[1].click()); await w.waitForTimeout(300);
  await w.evaluate(async b64 => { const bin = Uint8Array.from(atob(b64), c => c.charCodeAt(0)); const f = new File([bin], 'eq.png', { type: 'image/png' }); const dt = new DataTransfer(); dt.items.add(f);
    const ta = document.querySelectorAll('#qbList .q')[1].querySelector('textarea[data-f="q"]'); ta.focus(); ta.selectionStart = ta.selectionEnd = ta.value.length; ta.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true })); }, png); await w.waitForTimeout(600);
  log('inline picture in Q2 text:', await w.evaluate(() => /⟦m:/.test(document.querySelectorAll('#qbList .q')[1].querySelector('textarea[data-f="q"]').value)));
  await w.evaluate(() => document.querySelectorAll('#qbList .q')[1].querySelector('[data-done]').click()); await w.waitForTimeout(300);
  await w.screenshot({ path: S + '/tqar_review.png' });
  await w.click('#qbGo'); await w.waitForTimeout(2500);
  const sn = await w.evaluate(() => helixDesktop.cl.cmd('snapshot')); const base = 'http://127.0.0.1:' + sn.port;
  const br = await chromium.launch(); const c = await br.newContext({ viewport: { width: 390, height: 820 }, isMobile: true }); const p = await c.newPage(); p.on('pageerror', e => errs.push('P:' + e.message));
  await p.goto(base + '/?pin=' + sn.pin); await p.fill('input[placeholder]', 'سارة علي'); await p.click('.go'); await p.waitForURL(/\/test\//, { timeout: 15000 }); await p.waitForTimeout(800);
  log('phone dir:', await p.evaluate(() => document.documentElement.dir), '| start button:', await p.textContent('.hero .go'));
  await p.click('.hero .go'); await p.waitForTimeout(400); await p.screenshot({ path: S + '/tqar_phone_q1.png' });
  await p.click('.opt:has-text("الميتوكوندريا")'); await p.click('.foot .grow'); await p.waitForTimeout(500);
  log('feedback:', (await p.textContent('.fb')).replace(/\s+/g, ' ').slice(0, 60)); await p.screenshot({ path: S + '/tqar_phone_fb.png' });
  await p.click('.foot .grow'); await p.waitForTimeout(300); log('Q2 has inline picture:', await p.evaluate(() => !!document.querySelector('main h2 img.eq')));
  log('ERRORS', errs); await br.close(); await app.close(); })().catch(e => { console.log('FAIL', e.message); process.exit(1); });
