/* v2.8.0 — the ten learning tools (app/plus.js), the offline libraries and the tablet / phone layout.
   node plus.js [tests-folder]   — prints one line per check, then "ERRORS n". */
const { chromium } = require('playwright'); const path = require('path');
const S = process.argv[2] || __dirname, URL = 'file://' + path.resolve(S, '..', 'dist', 'index.html') + '?nointro=1&accskip=1';
const fails = []; const ok = (name, cond, info) => { console.log((cond ? 'ok   ' : 'FAIL ') + name + (info !== undefined ? '  ' + JSON.stringify(info) : '')); if (!cond) fails.push(name); };
const PNG = (col) => `(() => { const c = document.createElement('canvas'); c.width = 320; c.height = 200; const g = c.getContext('2d'); g.fillStyle = '${col}'; g.fillRect(0, 0, 320, 200); g.fillStyle = '#fff'; g.fillRect(40, 40, 80, 80); return c.toDataURL(); })()`;
(async () => {
  const b = await chromium.launch();
  const open = async (vp, extra) => { const c = await b.newContext(Object.assign({ viewport: vp }, extra || {})); await c.addInitScript(() => { localStorage['hb:accSkip'] = 'true'; localStorage['hb:seenVer'] = '"2.8.0"'; localStorage['hb:seenIntro'] = 'true'; localStorage['hb:dueSeen'] = '"x"'; });
    /* no network at all: everything below has to work behind a school firewall */
    await c.route(/^https?:/, r => r.abort()); const p = await c.newPage(); p.errs = []; p.on('pageerror', e => p.errs.push(e.message)); await p.goto(URL); await p.waitForTimeout(1600); return p; };
  const p = await open({ width: 1600, height: 900 });
  ok('app starts, plus.js loaded', await p.evaluate(() => !!window.HBP && !(window.__hbErr || []).length));
  ok('every new button is in a tab', await p.evaluate(() => ['p_ghost', 'p_measure', 'p_cloze', 'p_nquiz', 'p_compare', 'p_labs', 'p_lab_enz', 'p_lab_osm', 'p_lab_pp', 'sp_due', 'p_fair', 'p_recap'].every(id => HBUI.ALL[id] && HBUI.TABS.some(t => t.groups.some(g => g.items.some(i => i.id === id))))));
  ok('no two tools share a label', await p.evaluate(() => { const seen = {}, dup = []; HBUI.TABS.forEach(t => t.groups.forEach(g => g.items.forEach(i => { if (!i.id || !i.label) return; if (seen[i.label] && seen[i.label] !== i.id) dup.push(i.label); seen[i.label] = i.id; }))); return dup; }).then(d => d.length === 0));

  /* ---- 1 ghost trace ---- */
  const inkAt = () => p.evaluate(() => { const c = HBE.cvMain, g = c.getContext('2d'), [sx, sy] = HBE.toS(400, 500), d = HBE.DPR, r = c.getBoundingClientRect(); const im = g.getImageData(Math.round((sx - 40) * d), Math.round((sy - 50) * d), Math.round((520 * HBE.V.s + 80) * d), Math.round(100 * d)).data; let dark = 0, green = 0; for (let i = 0; i < im.length; i += 4) { if (im[i + 3] > 150 && im[i] < 90 && im[i + 1] < 90 && im[i + 2] < 90) dark++; if (im[i + 3] > 40 && im[i + 1] > im[i] + 40 && im[i + 1] > im[i + 2] + 15) green++; } return { dark, green }; });
  await p.evaluate(() => { const pts = []; for (let i = 0; i <= 50; i++) pts.push(400 + i * 10, 500 + Math.sin(i / 4) * 12, 0.5); const o = HBE.add([{ t: 'stroke', pen: 'marker', c: '#000000', w: 14, pts }]); HBI.setTool('select'); HBI.select(o); });
  await p.waitForTimeout(300); const full = await inkAt();
  await p.evaluate(() => HBP.ghost()); await p.waitForTimeout(300); const faint = await inkAt();
  ok('ghost: model fades to a pale copy', full.dark > 200 && faint.dark < full.dark * 0.1, { full: full.dark, faint: faint.dark });
  ok('ghost: model is locked, pen selected', await p.evaluate(() => HBE.page().objs[0].gh === 1 && HBE.page().objs[0].locked === true && HBI.T.tool === 'draw'));
  await p.evaluate(() => HBP.ghostMode('hide')); await p.waitForTimeout(300); const hid = await inkAt();
  ok('ghost: from memory hides the model', hid.dark === 0 && hid.green === 0, hid);
  await p.evaluate(() => HBP.ghostMode('show')); await p.waitForTimeout(300); const shown = await inkAt();
  ok('ghost: check shows the model in green', shown.green > 150, shown);
  const rt = await p.evaluate(() => { const s = JSON.parse(HBE.serial()); return s.pages[0].ghost + '/' + s.pages[0].objs[0].gh; });
  ok('ghost: saved in the .helix file', rt === 'show/1', rt);
  await p.click('#ghF'); await p.waitForTimeout(200);
  ok('ghost: finish puts the drawing back', await p.evaluate(() => { const o = HBE.page().objs[0]; return !o.gh && !o.locked && !HBE.page().ghost; }));
  await p.evaluate(() => HBE.del(HBE.page().objs.slice()));

  /* ---- 2 live measure ---- */
  await p.evaluate(() => { const o = HBE.add([{ t: 'shape', k: 'line', line: [300, 400, 600, 400], c: '#000', sw: 4 }, { t: 'shape', k: 'rect', x: 300, y: 500, w: 200, h: 100, c: '#000', sw: 3 }]); HBI.setTool('select'); HBI.select(o[0]); HBP.measure(); });
  ok('measure: pixels before a scale is set', await p.evaluate(() => HBP.measureOf(HBE.page().objs[0]).s) === '300 px  ∠ 0°');
  await p.fill('#msV', '3'); await p.selectOption('#msU', 'cm'); await p.click('#msSet');
  const ms = await p.evaluate(() => HBE.page().objs.map(o => HBP.measureOf(o).s));
  ok('measure: line length from the scale', ms[0] === '3.00 cm  ∠ 0°', ms[0]);
  ok('measure: rectangle sides and area', ms[1] === '2.00 × 1.00 cm   A = 2.00 cm²', ms[1]);
  await p.evaluate(() => HBI.clearSel()); await p.click('#msAdd');
  ok('measure: sizes written on the board', await p.evaluate(() => HBE.page().objs.filter(o => o.ms).length) === 2);
  await p.click('#fl-measure [data-x]'); ok('measure: closing the panel switches it off', await p.evaluate(() => !HBP.measuring));
  await p.evaluate(() => HBE.del(HBE.page().objs.slice()));

  /* ---- 3 cloze ---- */
  const SRC = 'Osmosis is the movement of water molecules across a partially permeable membrane.';
  await p.evaluate(s => { const o = HBI.insertObj({ t: 'text', x: 300, y: 300, w: 900, s, font: 'Lexend', size: 32, c: '#000' }); HBI.select(o); HBP.cloze(); }, SRC);
  await p.click('#czA'); const nPick = await p.$$eval('.px-w.on', e => e.length); await p.click('#czGo'); await p.waitForTimeout(200);
  const cz1 = await p.evaluate(() => HBE.page().objs[0].s);
  ok('cloze: suggested words become blanks', nPick >= 2 && /_{5,}/.test(cz1) && cz1 !== SRC, { nPick, cz1 });
  await p.evaluate(() => HBI.setTool('draw', 'pen')); const box = await p.evaluate(() => { const b = HBE.bbox(HBE.page().objs[0]), q = HBE.toS(b[0] + 40, b[1] + 20), r = HBE.cvMain.getBoundingClientRect(); return [q[0] + r.left, q[1] + r.top]; });
  const before = await p.evaluate(() => HBE.page().objs.length); await p.mouse.click(box[0], box[1]); await p.waitForTimeout(200);
  ok('cloze: a tap opens one blank and draws nothing', await p.evaluate(() => HBE.page().objs[0].cz.open.length) === 1 && await p.evaluate(() => HBE.page().objs.length) === before);
  await p.click('#czAll'); ok('cloze: open all gives the original text', await p.evaluate(() => HBE.page().objs[0].s) === SRC);
  await p.click('#czRe'); await p.click('#czBank'); ok('cloze: hide again + word bank', await p.evaluate(n => /_{5,}/.test(HBE.page().objs[0].s) && HBE.page().objs[1].s.split('·').length === n, nPick));
  await p.evaluate(() => HBE.del(HBE.page().objs.slice())); await p.click('#fl-cloze [data-x]');

  /* ---- 4 notes → quiz ---- */
  await p.evaluate(() => { HBI.insertObj({ t: 'text', x: 300, y: 300, w: 900, s: 'Osmosis - movement of water across a membrane\nDiffusion - movement of particles down a concentration gradient\nActive transport - movement against a gradient using energy\nTurgid - swollen with water\nPlasmolysed - membrane pulled away from the wall', font: 'Lexend', size: 26, c: '#000' }); HBI.clearSel(); HBP.notesQuiz(); });
  await p.fill('#nqN', 'T quiz'); await p.click('#nqS');
  const qz = await p.evaluate(() => JSON.parse(localStorage['hb:quizSets'])['T quiz']);
  ok('notes → quiz: five questions, four real options, right answer marked', qz.length === 5 && qz.every(q => q.o.length === 4 && new Set(q.o).size === 4 && q.a >= 0 && q.ex.includes(q.o[q.a])), qz.length);

  /* ---- 10 recap (uses the notes above) ---- */
  await p.evaluate(() => { HBI.insertObj({ t: 'text', x: 300, y: 120, w: 0, s: 'Transport in cells', font: 'Lexend', size: 48, b: true, c: '#000' }); HBI.clearSel(); HBP.recap(); }); await p.waitForTimeout(400);
  const rc = await p.evaluate(() => ({ n: HBE.B.pages.length, name: HBE.page().name, txt: HBE.page().objs.map(o => o.s).join('\n') }));
  ok('recap: a new last page with headings, key ideas and questions', rc.n === 2 && rc.name === 'Lesson recap' && rc.txt.includes('Transport in cells') && rc.txt.includes('Osmosis - movement') && rc.txt.includes('Check yourself'), rc.n);
  await p.evaluate(() => { HBUI.goPage(0); HBE.del(HBE.page().objs.slice()); });

  /* ---- 5 before / after ---- */
  await p.evaluate(async ([a, c]) => { HBI.insertImage(a); HBI.insertImage(c); await new Promise(r => setTimeout(r, 500)); HBI.setTool('select'); HBI.select(HBE.page().objs.filter(o => o.t === 'img')); HBP.compare(); }, [await p.evaluate(PNG('#c92a2a')), await p.evaluate(PNG('#1971c2'))]);
  await p.waitForSelector('#cmpB'); const r = await p.$eval('#cmpB', e => { const b = e.getBoundingClientRect(); return [b.left, b.top, b.width, b.height]; });
  await p.mouse.move(r[0] + r[2] * 0.25, r[1] + r[3] / 2); await p.mouse.down(); await p.mouse.move(r[0] + r[2] * 0.25 + 2, r[1] + r[3] / 2); await p.mouse.up();
  ok('before / after: the slider follows the pointer', Math.abs(parseFloat(await p.$eval('#cmpBar', e => e.style.left)) - 25) < 2);
  await p.keyboard.press('Escape'); ok('before / after: Esc closes it', !(await p.$('#pxOver')));
  await p.evaluate(() => HBE.del(HBE.page().objs.slice()));

  /* ---- 6 mini-labs ---- */
  for (const k of ['enzyme', 'osmosis']) { await p.evaluate(k => HBP.lab(k), k); ok(k + ': nothing runs before a prediction', await p.$eval('#lbRun', e => e.disabled)); await p.click('[data-o="1"]'); await p.click('#lbRun'); ok(k + ': the pattern stays hidden until enough results', !(await p.$('#lbShow')));
    await p.click('#lbAuto'); await p.click('#lbShow'); ok(k + ': a wrong prediction is marked and explained', await p.$eval('#lbP', e => !!e.querySelector('.right') && !!e.querySelector('.wrong')) && (await p.$eval('#lbE', e => e.textContent.length)) > 120);
    await p.click('#lbAdd'); await p.waitForTimeout(600); ok(k + ': the graph lands on the board', await p.evaluate(() => HBE.page().objs.filter(o => o.t === 'img').length) === 1 && !(await p.$('#pxOver'))); await p.evaluate(() => HBE.del(HBE.page().objs.slice())); }
  await p.evaluate(() => HBP.lab('predprey')); await p.click('[data-o="0"]'); await p.click('#lbRun'); await p.waitForTimeout(1500); await p.fill('[data-c="a"]', '1.4'); await p.click('#lbRun'); await p.waitForTimeout(1500); await p.click('#lbShow');
  ok('predator–prey: right prediction confirmed after two runs', (await p.$eval('#lbE', e => e.textContent)).includes('matched'));
  const lag = await p.evaluate(() => { const s = HBP.LABS.predprey.series({ a: 1, b: 0.02, g: 1 }), pk = (a, from) => { for (let i = 1; i < a.length - 1; i++) if (a[i][0] > from && a[i][1] > a[i - 1][1] && a[i][1] >= a[i + 1][1]) return a[i][0]; return -1; }, prey = pk(s[0], 0.5); return pk(s[1], prey) - prey; });
  ok('predator–prey: the predator peak comes after the prey peak', lag > 0.2 && lag < 4, lag); await p.keyboard.press('Escape');
  const enz = await p.evaluate(() => { const m = HBP.LABS.enzyme.model; return [m({ enz: 'amylase', var: 'T' }, 37), m({ enz: 'amylase', var: 'T' }, 27), m({ enz: 'amylase', var: 'T' }, 60), m({ enz: 'pepsin', var: 'pH' }, 2), m({ enz: 'pepsin', var: 'pH' }, 7)].map(Math.round); });
  ok('enzyme model: optimum 37 °C, half at 27 °C, denatured at 60 °C, pepsin best at pH 2', enz[0] === 100 && enz[1] === 50 && enz[2] === 0 && enz[3] === 100 && enz[4] < 5, enz);

  /* ---- 7 lesson runway ---- */
  await p.evaluate(() => { localStorage['hb:lessonPlan'] = JSON.stringify({ title: 'Osmosis', objectives: [], criteria: [], words: [], phases: [['Starter', 5], ['Teach', 15], ['Practise', 15], ['Exit ticket', 5]] }); HBL.flow(true); }); await p.waitForTimeout(700);
  ok('runway: one block per phase, sized by its minutes', await p.$$eval('#runway button', e => e.map(x => x.style.flexGrow).join()) === '5,15,15,5');
  await p.click('#runway button[data-i="2"]'); await p.waitForTimeout(600); ok('runway: a tap jumps to that phase', (await p.$eval('#lfName', e => e.textContent)) === '3. Practise' && await p.$eval('#runway button[data-i="2"]', e => e.classList.contains('on')));
  await p.click('#fl-flow [data-x]'); await p.waitForTimeout(200); ok('runway: gone when the lesson flow closes', !(await p.$('#runway')));

  /* ---- 8 due today ---- */
  await p.evaluate(() => { localStorage['hb:cardSets'] = JSON.stringify({ Cells: [['Nucleus', 'controls the cell'], ['Ribosome', 'makes protein']], Enzymes: [['Substrate', 'what an enzyme acts on']] }); localStorage['hb:cardProg'] = JSON.stringify({ Cells: { Nucleus: { b: 3, d: '2999-01-01' } } }); });
  ok('due today: counts due cards across every deck', await p.evaluate(() => HBL.dueTotal()) === 2);
  await p.evaluate(() => HBL.dueToday()); await p.waitForTimeout(300); await p.keyboard.press(' '); await p.waitForTimeout(450); await p.keyboard.press('3'); await p.waitForTimeout(200);
  const pr = await p.evaluate(() => JSON.parse(localStorage['hb:cardProg']));
  ok('due today: progress is saved in the card’s own deck', !pr['★ Due today'] && ((pr.Cells.Ribosome && pr.Cells.Ribosome.b === 1) || (pr.Enzymes && pr.Enzymes.Substrate && pr.Enzymes.Substrate.b === 1)) && pr.Cells.Nucleus.b === 3, pr);
  await p.keyboard.press('Escape'); await p.evaluate(() => HBL.closeStage && HBL.closeStage());

  /* ---- 9 fair talk ---- */
  await p.evaluate(() => { localStorage['hb:coldNames'] = JSON.stringify(['Omar', 'Yousef', 'Khalid', 'Faisal']); localStorage.removeItem('hb:fairTalk'); HBP.fairTalk(); });
  await p.click('.ft-n[data-n="0"]'); await p.click('.ft-n[data-n="0"]'); await p.click('.ft-n[data-n="1"]');
  ok('fair talk: counts and the class meter', (await p.$eval('#ftS', e => e.textContent)) === '2 of 4 students have spoken');
  const picks = new Set(); for (let i = 0; i < 12; i++) { await p.click('#ftP'); picks.add(await p.$eval('.ft-n.pick span', e => e.textContent)); }
  ok('fair talk: only students who have not spoken are picked', [...picks].every(n => n === 'Khalid' || n === 'Faisal') && picks.size === 2, [...picks]);
  await p.click('#fl-fairtalk [data-x]');

  /* ---- offline libraries ---- */
  const libs = await p.evaluate(async () => { const out = {}; for (const n of ['rough', 'chart', 'smiles', 'katex']) { try { await HB.need(n); out[n] = true; } catch (e) { out[n] = e.message; } } return out; });
  ok('offline: sketchy shapes, charts, molecules and equations load with no internet', Object.values(libs).every(v => v === true), libs);
  await p.evaluate(() => HBS.latex && HBS.latex()); await p.waitForTimeout(300); const hasLx = await p.$('#sheet input, #sheet textarea');
  if (hasLx) { await p.evaluate(() => { const b = [...document.querySelectorAll('#sheet .foot .btn.primary, #sheet .btn.primary')].pop(); b && b.click(); }); await p.waitForTimeout(2500); ok('offline: a LaTeX equation is placed on the board', await p.evaluate(() => HBE.page().objs.length) >= 1); }
  ok('no script errors on the desktop run', p.errs.length === 0, p.errs);

  /* ---- tablet and phone layout ---- */
  for (const [nm, vp] of [['tablet 768', { width: 768, height: 1024 }], ['phone 390', { width: 390, height: 844 }]]) { const q = await open(vp, { hasTouch: true, isMobile: true });
    const m = await q.evaluate(() => { const r = id => document.getElementById(id).getBoundingClientRect(); const t = r('toolrow'), d = r('dock'); return { iw: innerWidth, sw: document.documentElement.scrollWidth, tool: Math.round(t.width), toolH: Math.round(t.height), dockL: Math.round(d.left), dockR: Math.round(d.right), acts: Math.round(document.querySelector('#top .acts').getBoundingClientRect().right) }; });
    ok(nm + ': the page is as wide as the screen', m.iw === vp.width && m.sw <= vp.width, m); ok(nm + ': the tool row spans the screen and scrolls sideways', m.tool === vp.width && m.toolH < 110, m); ok(nm + ': the dock and the top buttons stay on screen', m.dockL >= 0 && m.dockR <= vp.width && m.acts <= vp.width, m);
    await q.screenshot({ path: S + '/plus_' + vp.width + '.png' }); ok(nm + ': no script errors', q.errs.length === 0, q.errs); await q.context().close(); }
  await p.screenshot({ path: S + '/plus_desktop.png' });
  console.log('ERRORS ' + fails.length + (fails.length ? ' — ' + fails.join(' | ') : '')); await b.close(); process.exit(fails.length ? 1 : 0);
})().catch(e => { console.log('FAIL', e.message); console.log('ERRORS 1'); process.exit(1); });
