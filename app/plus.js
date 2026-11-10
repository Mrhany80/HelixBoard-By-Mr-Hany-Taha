/* ================= HelixBoard 2.8 — learning tools =================
   One research-backed tool for each tab, all built on what is already on the board:
   Draw      Ghost trace          redraw a model drawing from memory, then check it against the original
   Shapes    Live measure         real lengths, angles and areas from a scale you set
   Text      Cloze                turn key words of any text into blanks that open on a tap
   Notes     Notes → quiz         "term - definition" notes become a multiple-choice quiz set
   Insert    Before / after       compare two pictures with a slider
   Science   Mini-labs            predict → observe → explain with three simulations
   Teach     Lesson runway        the lesson flow as a strip across the top of the board (see studio.js)
   Study     Due today            every flashcard that is due, from all decks, mixed (see studio.js)
   Collab.   Fair talk            who has spoken, and who has not yet
   Page      Lesson recap         one page that gathers the headings, key ideas and questions of the lesson */
(() => {
'use strict';
const { $, $$, clamp, esc, icon, set, bus, toast, modal, floatPanel, uid, SND, REDUCE } = window.HB;
const E = window.HBE, I = window.HBI; const { B, V, page } = E; const T = I.T;
const snd = k => { try { SND[k] && SND[k](); } catch (e) {} };
const dark = () => E.isDark();
const ink = () => dark() ? '#F6ECF4' : '#1E1419';
const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const repaint = () => { E.dirty.all(); };
const stageEl = document.getElementById('stage');
/* the small panels open at the right of the board, clear of the tool panel */
const side = w => { const n = Object.values(window.HB.floats || {}).filter(f => f.el && !f.el.hidden).length; return { x: Math.max(8, innerWidth - w - 28 - (n % 3) * 46), y: 150 + (n % 4) * 64 }; };

const css = document.createElement('style'); css.textContent = `
.px-row{display:flex;gap:6px;flex-wrap:wrap;align-items:center;margin-top:8px}
.px-seg{display:flex;gap:4px;flex-wrap:wrap}.px-seg .btn.on{background:var(--accent);border-color:var(--accent);color:var(--accent-ink)}
.px-hint{font-size:12.5px;color:var(--muted);line-height:1.45;margin-top:8px}
.px-words{display:flex;flex-wrap:wrap;gap:6px;max-height:300px;overflow:auto;padding:10px;border:1px solid var(--line);border-radius:12px;background:var(--panel2);user-select:none}
.px-w{border:1px solid var(--line2);background:var(--panel);color:var(--ink);border-radius:8px;padding:6px 9px;font:600 15px var(--ui);cursor:pointer;min-height:34px}
.px-w.on{background:var(--accent);border-color:var(--accent);color:var(--accent-ink);text-decoration:line-through}
#pxOver{position:fixed;inset:0;z-index:70;background:var(--bg);color:var(--ink);display:flex;flex-direction:column}
#pxOver .po-top{display:flex;align-items:center;gap:10px;padding:10px 16px;border-bottom:1px solid var(--line);background:var(--panel);flex-wrap:wrap}
#pxOver .po-top h2{font:700 19px var(--head);margin:0}
#pxOver .po-top .sp{flex:1}
#pxOver .po-body{flex:1;min-height:0;display:flex;gap:16px;padding:16px;overflow:auto}
.cmp-box{position:relative;margin:auto;max-width:100%;max-height:100%;touch-action:none;user-select:none;border-radius:12px;overflow:hidden;box-shadow:var(--shadow);background:#fff}
.cmp-box img{display:block;max-width:min(92vw,1500px);max-height:calc(100vh - 170px);pointer-events:none}
.cmp-box img.top{position:absolute;inset:0;width:100%;height:100%;object-fit:fill}
.cmp-bar{position:absolute;top:0;bottom:0;width:4px;margin-left:-2px;background:#fff;box-shadow:0 0 0 1px rgba(0,0,0,.4);cursor:ew-resize}
.cmp-bar::after{content:"◂ ▸";position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);background:#fff;color:#111;font:700 13px var(--ui);padding:8px 7px;border-radius:999px;white-space:nowrap;box-shadow:0 2px 10px rgba(0,0,0,.4)}
.cmp-tag{position:absolute;top:10px;background:rgba(0,0,0,.66);color:#fff;font:700 13px var(--ui);padding:5px 10px;border-radius:8px}
.lab-side{width:330px;flex:none;display:flex;flex-direction:column;gap:10px}
.lab-card{background:var(--panel);border:1px solid var(--line);border-radius:14px;padding:12px 14px}
.lab-card h3{margin:0 0 6px;font:700 13px var(--head);letter-spacing:.06em;text-transform:uppercase;color:var(--muted)}
.lab-card label{display:block;font-size:13px;margin-top:8px}
.lab-card input[type=range]{width:100%;accent-color:var(--accent)}
.lab-card select{width:100%;height:36px;border-radius:10px;background:var(--panel2);color:var(--ink);border:1px solid var(--line2);padding:0 8px}
.lab-main{flex:1;min-width:0;display:flex;flex-direction:column;gap:10px}
.lab-main canvas{width:100%;flex:1;min-height:300px;border-radius:14px;background:#fff;border:1px solid var(--line)}
.lab-step{display:flex;gap:6px}.lab-step span{flex:1;text-align:center;padding:7px 4px;border-radius:10px;background:var(--panel2);font:700 12.5px var(--ui);color:var(--muted)}
.lab-step span.on{background:var(--accent);color:var(--accent-ink)}.lab-step span.done{color:var(--ink)}
.lab-opt{display:block;width:100%;text-align:start;margin-top:6px;white-space:normal;height:auto;padding:8px 10px;line-height:1.3}
.lab-opt.on{background:var(--accent);border-color:var(--accent);color:var(--accent-ink)}
.lab-opt.right{box-shadow:inset 0 0 0 2px #2F9E44}.lab-opt.wrong{box-shadow:inset 0 0 0 2px #E03131}
@media (max-width:860px){#pxOver .po-body{flex-direction:column}.lab-side{width:auto}}
.ft-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(104px,1fr));gap:6px;max-height:330px;overflow:auto;margin-top:8px}
.ft-n{border:1px solid var(--line);border-radius:10px;padding:7px 6px;min-height:46px;background:var(--panel2);color:var(--ink);font:600 13px var(--ui);cursor:pointer;display:flex;flex-direction:column;align-items:center;gap:2px}
.ft-n b{font:800 15px var(--head)}.ft-n.c0 b{color:var(--muted)}
.ft-n.c1{background:color-mix(in srgb,#4ADE80 16%,var(--panel2))}.ft-n.c2{background:color-mix(in srgb,#4ADE80 32%,var(--panel2))}.ft-n.c3{background:color-mix(in srgb,#FFC928 38%,var(--panel2))}
.ft-n.pick{outline:3px solid var(--accent);outline-offset:1px}
#runway{position:absolute;left:50%;top:58px;transform:translateX(-50%);z-index:5;display:flex;gap:3px;width:min(760px,calc(100% - 420px));min-width:260px;padding:5px;border-radius:12px;background:var(--glass);border:1px solid var(--line2);backdrop-filter:blur(10px);box-shadow:var(--shadow)}
#runway button{position:relative;overflow:hidden;border:0;border-radius:8px;background:var(--panel2);color:var(--muted);font:700 11.5px var(--ui);height:28px;padding:0 6px;min-width:26px;white-space:nowrap;text-overflow:ellipsis;cursor:pointer}
#runway button i{position:absolute;left:0;top:0;bottom:0;background:color-mix(in srgb,var(--accent) 45%,transparent);pointer-events:none}
#runway button span{position:relative}
#runway button.on{color:var(--ink);box-shadow:inset 0 0 0 1.5px var(--accent)}#runway button.done{color:var(--ink);background:color-mix(in srgb,#4ADE80 22%,var(--panel2))}#runway button.over i{background:color-mix(in srgb,#FF6B6B 55%,transparent)}
@media (max-width:860px){#runway{width:calc(100% - 20px)}}
`; document.head.appendChild(css);

/* a full-screen layer for the slider and the mini-labs; Esc closes it */
let over = null;
function overlay(title, bodyHtml, onClose) { closeOver(); const el = document.createElement('div'); el.id = 'pxOver'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-label', title);
  el.innerHTML = '<div class="po-top"><h2>' + esc(title) + '</h2><span class="sp"></span><span id="poActs" class="px-seg"></span><button class="btn" id="poX">' + icon('x') + 'Close</button></div><div class="po-body">' + bodyHtml + '</div>';
  document.body.appendChild(el); const key = e => { if (e.key === 'Escape') { e.stopPropagation(); closeOver(); } }; window.addEventListener('keydown', key, true);
  over = { el, off() { window.removeEventListener('keydown', key, true); onClose && onClose(); } }; $('#poX', el).onclick = closeOver; return el; }
function closeOver() { if (!over) return; const o = over; over = null; o.el.remove(); o.off(); }

/* =====================================================================================================
   1. DRAW — Ghost trace
   The selected drawing becomes the model. Trace it while it is faint, hide it and redraw it from memory,
   then check: the model comes back in green underneath your own ink. */
const ghosts = p => (p || page()).objs.filter(o => o.gh);
function ghostMode(m) { const p = page(); p.ghost = m; repaint(); E.changed(); ghostPanel(); snd(m === 'show' ? 'chime' : 'pop'); }
function ghost() { const sel = I.selObjs().filter(o => !o.gh);
  if (!sel.length && !ghosts().length) { I.setTool('select'); toast('Select the drawing to practise first (Select tool, drag a box around it), then press Ghost trace again.', 4600); return; }
  if (sel.length) { const p = page(); I.clearSel(); E.mod(sel, o => { o.gh = 1; o.ghl = o.locked ? 1 : 0; o.locked = true; }); p.ghost = 'faint'; p.ghostT = Date.now(); p.ghostN = 0; I.setTool('draw', T.pen || 'pen'); repaint(); E.changed(); }
  ghostPanel(); }
function ghostPanel() { const p = page(), m = p.ghost || 'faint';
  const f = floatPanel('ghost', 'Ghost trace', '<div class="st-panel"><div class="px-seg" id="ghM"></div><div class="px-hint" id="ghH"></div><div class="px-row"><button class="btn sm" id="ghC">' + icon('eraser') + 'Clear my attempt</button><button class="btn sm" id="ghF">' + icon('check') + 'Finish</button></div></div>', Object.assign({ icon: 'scan-eye', w: 330 }, side(330)));
  const b = f.body, STEPS = [['faint', '1 · Trace', 'Draw over the pale copy. Say each part out loud as you draw it.'], ['hide', '2 · From memory', 'The model is hidden. Redraw it and label it without looking.'], ['show', '3 · Check', 'The model is back in green under your ink. Circle what you missed, then try again from memory.']];
  $('#ghM', b).innerHTML = STEPS.map(s => '<button class="btn sm' + (s[0] === m ? ' on' : '') + '" data-m="' + s[0] + '">' + s[1] + '</button>').join('');
  $('#ghH', b).textContent = STEPS.find(s => s[0] === m)[2] + (p.ghostN ? ' Attempts so far: ' + p.ghostN + '.' : '');
  $$('[data-m]', b).forEach(x => x.onclick = () => { if (x.dataset.m === 'show' && page().ghost === 'hide') page().ghostN = (page().ghostN || 0) + 1; ghostMode(x.dataset.m); });
  $('#ghC', b).onclick = () => { const p = page(), mine = p.objs.filter(o => !o.gh && o.t === 'stroke' && (o.ts || 0) >= (p.ghostT || 0)); if (!mine.length) { toast('Nothing to clear yet.'); return; } E.del(mine); p.ghostT = Date.now(); repaint(); };
  $('#ghF', b).onclick = () => { const p = page(), gs = ghosts(p); if (gs.length) E.mod(gs, o => { o.locked = !!o.ghl; delete o.gh; delete o.ghl; }); delete p.ghost; delete p.ghostT; delete p.ghostN; repaint(); E.changed(); f.destroy ? f.destroy() : (f.el.hidden = true); toast('Ghost trace finished — the drawing is back to normal.'); }; }

/* =====================================================================================================
   2. SHAPES — Live measure
   Lengths, angles and areas appear beside lines and shapes and follow them while they are moved or resized.
   The scale is set from one object whose real size is known (a scale bar, a ruler in a photo, a cell). */
const M = { on: false };
const scaleOf = p => (p || page()).sc || { k: 1, u: 'px' };
const fmt = v => { const a = Math.abs(v); return a >= 1000 ? Math.round(v).toLocaleString('en') : a >= 100 ? v.toFixed(0) : a >= 10 ? v.toFixed(1) : a >= 1 ? v.toFixed(2) : v.toPrecision(2); };
const LINES = ['line', 'arrow', 'darrow', 'curve', 'rev', 'vec'];
function measureOf(o) { const sc = scaleOf(), u = sc.u, k = sc.k;
  if (o.t === 'shape' && o.line) { const [x1, y1, x2, y2] = o.line, len = Math.hypot(x2 - x1, y2 - y1); if (len < 4) return null; let ang = Math.atan2(-(y2 - y1), x2 - x1) * 180 / Math.PI; if (ang < 0) ang += 180; if (ang >= 179.95) ang = 0; return { len, s: fmt(len / k) + ' ' + u + '  ∠ ' + ang.toFixed(0) + '°', x: (x1 + x2) / 2, y: (y1 + y2) / 2 }; }
  if (o.t === 'stroke') { const P = E.ptsOf(o); let len = 0; for (let i = 1; i < P.length; i++) len += Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1]); const b = E.bbox(o); if (!b || len < 4) return null; return { len, s: 'path ' + fmt(len / k) + ' ' + u, x: b[0] + b[2] / 2, y: b[1] }; }
  if (o.w == null || o.h == null) return null; const w = Math.abs(o.w), h = Math.abs(o.h); if (w < 4 || h < 4) return null; let area = w * h, tag = '';
  if (o.t === 'shape') { if (o.k === 'ellipse') { area = Math.PI * w * h / 4; tag = w === h ? 'd ' : ''; } else if (o.k === 'tri' || o.k === 'rtri') area = w * h / 2; else if (!['rect', 'round'].includes(o.k)) area = 0; }
  else area = 0;
  return { len: w, s: tag + fmt(w / k) + ' × ' + fmt(h / k) + ' ' + u + (area ? '   A = ' + fmt(area / (k * k)) + ' ' + u + '²' : ''), x: o.x + o.w / 2, y: Math.min(o.y, o.y + o.h) }; }
const measured = () => { const sel = I.selObjs(); const list = sel.length ? sel : page().objs.filter(o => o.t === 'shape' && !o.tpl && !o.cover && !o.gh).slice(-80); return list.map(o => [o, measureOf(o)]).filter(x => x[1]); };
E.liveDrawers.push({ active: () => M.on, draw(g) { if (!M.on) return; const s = V.s, fs = 13 / s; g.font = '700 ' + fs + 'px Lexend, "Segoe UI", Arial, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  measured().forEach(([o, m]) => { const w = g.measureText(m.s).width + 12 / s, h = 20 / s, x = m.x - w / 2, y = m.y - h - 8 / s; g.fillStyle = 'rgba(20,12,24,.86)'; g.beginPath(); if (g.roundRect) g.roundRect(x, y, w, h, 6 / s); else g.rect(x, y, w, h); g.fill(); g.fillStyle = '#FFF'; g.fillText(m.s, m.x, y + h / 2 + 0.5 / s); }); } });
function measure() { M.on = true; E.dirty.live = true; const sc = scaleOf();
  const f = floatPanel('measure', 'Live measure', '<div class="st-panel"><div id="msS" style="font:700 15px var(--head)"></div><div class="px-hint">Draw or select a line or shape — its size shows beside it and follows as you resize. Nothing selected: every shape on the page is measured.</div>' +
    '<div class="px-row"><input class="inp" id="msV" type="number" step="any" min="0" placeholder="real length" style="width:112px" aria-label="Real length of the selected object"><select class="inp" id="msU" aria-label="Unit">' + ['nm', 'µm', 'mm', 'cm', 'm', 'km', 'units'].map(u => '<option' + (u === (sc.u === 'px' ? 'cm' : sc.u) ? ' selected' : '') + '>' + u + '</option>').join('') + '</select><button class="btn sm primary" id="msSet">Set scale</button></div>' +
    '<div class="px-hint">To set the scale: select one object whose real size you know (a scale bar, a ruler in the photo), type its real length and press Set scale.</div>' +
    '<div class="px-row"><button class="btn sm" id="msAdd">' + icon('plus') + 'Write sizes on the board</button><button class="btn sm" id="msR">Reset scale</button></div></div>', { icon: 'ruler', w: 350, x: side(350).x, y: side(350).y, onClose: () => { M.on = false; E.dirty.live = true; window.HBUI && HBUI.refresh && HBUI.refresh(); } });
  const b = f.body, show = () => { const s = scaleOf(); $('#msS', b).textContent = s.u === 'px' ? 'No scale yet — sizes are in screen pixels.' : 'Scale: 100 px on the board = ' + fmt(100 / s.k) + ' ' + s.u; };
  $('#msSet', b).onclick = () => { const sel = I.selObjs(), v = parseFloat($('#msV', b).value); if (sel.length !== 1) { toast('Select exactly one object whose real size you know.'); return; } if (!(v > 0)) { toast('Type its real length first.'); $('#msV', b).focus(); return; } const m = measureOf(sel[0]); if (!m) { toast('That object is too small to measure.'); return; } page().sc = { k: m.len / v, u: $('#msU', b).value }; E.changed(); E.dirty.live = true; show(); snd('chime'); };
  $('#msR', b).onclick = () => { delete page().sc; E.changed(); E.dirty.live = true; show(); };
  $('#msAdd', b).onclick = () => { const ms = measured(); if (!ms.length) { toast('Nothing to measure on this page yet.'); return; } E.add(ms.map(([o, m]) => ({ t: 'text', x: m.x - 110, y: m.y - 44, w: 220, align: 'center', s: m.s.replace(/\s{2,}/g, ' · '), font: 'Lexend', size: 20, b: true, c: ink(), ms: 1 }))); snd('pop'); toast('Sizes written on the board as text you can move.'); };
  show(); window.HBUI && HBUI.refresh && HBUI.refresh(); }
bus.on('page', () => { if (M.on) E.dirty.live = true; });

/* =====================================================================================================
   3. TEXT — Cloze
   Key words of a text box become blanks. A tap on the text (any tool except Select) opens the next blank. */
const tokens = s => String(s).split(/(\s+)/);
const isWord = t => /[\p{L}\p{N}]/u.test(t);
function clozeText(cz) { const tk = tokens(cz.s); let wi = -1; return tk.map(t => { if (!isWord(t)) return t; wi++; if (!cz.hide.includes(wi) || cz.open.includes(wi)) return t; const m = t.match(/^([^\p{L}\p{N}]*)(.*?)([^\p{L}\p{N}]*)$/u); return m[1] + '_'.repeat(clamp(Math.round([...m[2]].length * 1.2), 5, 16)) + m[3]; }).join(''); }
const clozeLeft = o => o.cz.hide.filter(i => !o.cz.open.includes(i));
function clozeStep(o, all) { const left = clozeLeft(o).sort((a, b) => a - b); if (!left.length) return false; E.mod([o], x => { x.cz.open = all ? x.cz.hide.slice() : x.cz.open.concat(left[0]); x.s = clozeText(x.cz); delete x._lay; delete x._b; }); snd(clozeLeft(o).length ? 'pop' : 'chime'); return true; }
function cloze() { const o = I.selObjs().find(x => x.t === 'text' && x.s && !x.ph && !x.cover);
  if (!o) { const any = page().objs.find(x => x.cz); if (any) { clozePanel(); return; } I.setTool('select'); toast('Select a text box first, then press Cloze to choose the words to hide.', 4200); return; }
  const src = o.cz ? o.cz.s : o.s, tk = tokens(src), words = tk.filter(isWord); if (words.length < 3) { toast('That text is too short for a cloze — it needs at least three words.'); return; }
  const picked = new Set(o.cz ? o.cz.hide : []);
  modal.open('<h2>' + icon('text-cursor-input') + 'Cloze — choose the words to hide</h2><p class="small muted">Tap the key words. Hide the ideas you want students to recall, not the small linking words.</p><div class="px-words" id="czW" dir="auto"></div>' +
    '<div class="px-row"><button class="btn sm" id="czA">' + icon('sparkles') + 'Suggest key words</button><button class="btn sm" id="czN">Clear</button><span class="small muted" id="czC"></span></div>' +
    '<div class="foot"><button class="btn" data-close>Cancel</button>' + (o.cz ? '<button class="btn" id="czOff">Back to normal text</button>' : '') + '<button class="btn primary" id="czGo">Make cloze</button></div>', s => {
    const draw = () => { $('#czW', s).innerHTML = words.map((w, i) => '<button class="px-w' + (picked.has(i) ? ' on' : '') + '" data-i="' + i + '" aria-pressed="' + picked.has(i) + '" data-noi18n>' + esc(w) + '</button>').join(''); $$('[data-i]', s).forEach(x => x.onclick = () => { const i = +x.dataset.i; picked.has(i) ? picked.delete(i) : picked.add(i); draw(); }); $('#czC', s).textContent = picked.size + ' of ' + words.length + ' words hidden'; };
    /* suggestion: the longest distinct words, about one in five, never two in a row */
    $('#czA', s).onclick = () => { picked.clear(); const rank = words.map((w, i) => [i, [...w.replace(/[^\p{L}\p{N}]/gu, '')].length + (/\d/.test(w) ? 3 : 0) + (/^[A-Z]/.test(w) && i ? 1 : 0)]).filter(x => x[1] >= 5).sort((a, b) => b[1] - a[1]); const want = clamp(Math.round(words.length / 5), 1, 12); for (const [i] of rank) { if (picked.size >= want) break; if (!picked.has(i - 1) && !picked.has(i + 1)) picked.add(i); } draw(); };
    $('#czN', s).onclick = () => { picked.clear(); draw(); };
    if ($('#czOff', s)) $('#czOff', s).onclick = () => { E.mod([o], x => { x.s = x.cz.s; delete x.cz; delete x._lay; delete x._b; }); modal.close(); repaint(); };
    $('#czGo', s).onclick = () => { if (!picked.size) { toast('Tap at least one word to hide.'); return; } E.mod([o], x => { x.cz = { s: src, hide: [...picked].sort((a, b) => a - b), open: [] }; x.s = clozeText(x.cz); delete x._lay; delete x._b; }); modal.close(); I.clearSel(); repaint(); clozePanel(); toast('Cloze ready. With any tool except Select, tap the text to open the next blank.', 4600); };
    draw(); }); }
function clozePanel() { const f = floatPanel('cloze', 'Cloze', '<div class="st-panel"><div class="px-hint" style="margin-top:0">Ask the class for the missing word first, then tap the text to check.</div><div class="px-row"><button class="btn sm primary" id="czNx">Open next blank</button><button class="btn sm" id="czAll">Open all</button><button class="btn sm" id="czRe">Hide again</button></div><div class="px-row"><button class="btn sm" id="czBank">' + icon('list') + 'Word bank</button><button class="btn sm" id="czEd">Change words</button></div></div>', Object.assign({ icon: 'text-cursor-input', w: 330 }, side(330)));
  const b = f.body, all = () => page().objs.filter(o => o.cz), cur = () => I.selObjs().find(o => o.cz) || all().find(o => clozeLeft(o).length) || all()[0];
  const need = () => { const o = cur(); if (!o) toast('No cloze on this page — select a text box and press Cloze.'); return o; };
  $('#czNx', b).onclick = () => { const o = need(); if (o && !clozeStep(o)) toast('Every blank is open.'); };
  $('#czAll', b).onclick = () => { const os = all().filter(o => clozeLeft(o).length); if (!os.length) { toast('Every blank is open.'); return; } os.forEach(o => clozeStep(o, true)); };
  $('#czRe', b).onclick = () => { const os = all().filter(o => o.cz.open.length); if (!os.length) return; E.mod(os, x => { x.cz.open = []; x.s = clozeText(x.cz); delete x._lay; delete x._b; }); snd('pop'); };
  $('#czBank', b).onclick = () => { const o = need(); if (!o) return; const ws = tokens(o.cz.s).filter(isWord), bank = shuffle(o.cz.hide.map(i => ws[i].replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, ''))), bb = E.bbox(o); E.add([{ t: 'text', x: bb[0], y: bb[1] + bb[3] + 24, w: Math.max(320, bb[2]), s: 'Word bank:  ' + bank.join('   ·   '), font: 'Lexend', size: Math.max(18, Math.round(o.size * 0.7)), b: true, c: dark() ? '#B197FC' : '#5F3DC4' }]); snd('pop'); };
  $('#czEd', b).onclick = () => { const o = need(); if (!o) return; I.setTool('select'); I.select(o); cloze(); }; }
/* a tap on a cloze text opens its next blank, before the drawing tools see the tap */
stageEl && stageEl.addEventListener('pointerdown', e => { if (e.button !== 0 || T.tool === 'select' || T.tool === 'lasso' || T.tool === 'text' || T.tool === 'erase' || e.target.closest('#editor,.float,#dock,#mini,#drawer,#zoomBox,#vbar,#hbar,#runway')) return; const p = page(); if (!p.objs.some(o => o.cz)) return;
  const [x, y] = E.toB(e.clientX, e.clientY), hit = p.objs.slice().reverse().find(o => { if (!o.cz || !clozeLeft(o).length) return false; const b = E.bbox(o); return b && x >= b[0] && x <= b[0] + b[2] && y >= b[1] && y <= b[1] + b[3]; });
  if (hit) { e.stopPropagation(); e.preventDefault(); clozeStep(hit); } }, true);

/* =====================================================================================================
   4. NOTES — Notes → quiz
   Lines written as "term - definition" become a multiple-choice set; the wrong answers come from the other terms. */
function pairsFrom(objs) { const txt = objs.filter(o => (o.t === 'text' || o.t === 'note') && o.s && !o.ph && !o.cover && !o.ms).map(o => o.cz ? o.cz.s : o.s).join('\n'); const seen = new Set();
  return (window.HBL ? HBL.parseCards(txt) : []).map(c => [c[0].replace(/^[•☐☑→\d.)\s]+/, '').trim(), c[1]]).filter(c => c[0] && c[1] && c[0].length <= 80 && !seen.has(c[0].toLowerCase()) && seen.add(c[0].toLowerCase())); }
function buildQuiz(pairs) { return shuffle(pairs).map((c, n) => { const others = shuffle(pairs.filter(x => x !== c)).slice(0, 3), rev = n % 2 === 1;
  const opts = shuffle([c].concat(others)); return rev ? { q: 'What does “' + c[0] + '” mean?', o: opts.map(x => x[1]), a: opts.indexOf(c), ex: c[0] + ' — ' + c[1] } : { q: 'Which term matches: ' + c[1], o: opts.map(x => x[0]), a: opts.indexOf(c), ex: c[0] + ' — ' + c[1] }; }); }
function notesQuiz() { const sel = I.selObjs(); let pairs = pairsFrom(sel.length ? sel : page().objs), where = sel.length ? 'the selection' : 'this page';
  if (pairs.length < 3 && !sel.length) { pairs = pairsFrom([].concat(...B.pages.map(p => p.objs))); where = 'the whole board'; }
  if (pairs.length < 3) { toast('A quiz needs at least three lines written as “term - definition” (found ' + pairs.length + '). Example:  Osmosis - movement of water across a membrane.', 6000); return; }
  modal.open('<h2>' + icon('list-checks') + 'Notes → quiz</h2><p><b>' + pairs.length + '</b> <span>term–definition pairs found in ' + where + '.</span> <span>Each one becomes a multiple-choice question; the wrong answers are the other terms, so every option is a real idea from the lesson.</span></p>' +
    '<div class="prop"><label>Quiz set name <input type="text" id="nqN" value="' + esc('Notes quiz — ' + new Date().toLocaleDateString()) + '"></label></div><div class="px-words" style="max-height:170px" dir="auto">' + pairs.slice(0, 40).map(c => '<span class="px-w" data-noi18n style="cursor:default">' + esc(c[0]) + '</span>').join('') + '</div>' +
    '<div class="foot"><button class="btn" data-close>Cancel</button><button class="btn" id="nqS">Save the set</button><button class="btn primary" id="nqP">Save and practise now</button></div>', s => {
    const save = () => { const n = $('#nqN', s).value.trim() || 'Notes quiz', all = set.get('quizSets', {}); all[n] = buildQuiz(pairs); set.put('quizSets', all); return n; };
    $('#nqS', s).onclick = () => { const n = save(); modal.close(); toast('Saved “' + esc(n) + '” — ' + pairs.length + ' questions. Find it in Teach → Live quiz or Study → Practice quiz.', 5200); };
    $('#nqP', s).onclick = () => { const n = save(); modal.close(); window.HBL && setTimeout(() => HBL.practise(n), 40); }; }); }

/* =====================================================================================================
   5. INSERT — Before / after slider */
function compare() { const ims = I.selObjs().filter(o => o.t === 'img' && B.assets[o.asset]);
  if (ims.length !== 2) { I.setTool('select'); toast('Select exactly two pictures on the board (hold Shift and click both), then press Before / after.', 5000); return; }
  ims.sort((a, b) => a.x - b.x || a.y - b.y); let a = B.assets[ims[0].asset], b = B.assets[ims[1].asset], pos = 50, fade = false;
  const el = overlay('Before / after', '<div class="cmp-box" id="cmpB"><img id="cmpA" alt="Before picture"><img class="top" id="cmpT" alt="After picture"><span class="cmp-tag" style="left:10px">Before</span><span class="cmp-tag" style="right:10px">After</span><div class="cmp-bar" id="cmpBar" role="slider" tabindex="0" aria-label="Before and after slider" aria-valuemin="0" aria-valuemax="100"></div></div>');
  $('#poActs', el).innerHTML = '<button class="btn sm" id="cmpSw">' + icon('repeat') + 'Swap</button><button class="btn sm" id="cmpF">Slide / fade</button>';
  const box = $('#cmpB', el), top = $('#cmpT', el), bar = $('#cmpBar', el);
  const draw = () => { $('#cmpA', el).src = a; top.src = b; if (fade) { top.style.clipPath = 'none'; top.style.opacity = pos / 100; } else { top.style.opacity = 1; top.style.clipPath = 'inset(0 0 0 ' + pos + '%)'; } bar.style.left = pos + '%'; bar.setAttribute('aria-valuenow', Math.round(pos)); };
  const at = e => { const r = box.getBoundingClientRect(); pos = clamp((e.clientX - r.left) / r.width * 100, 0, 100); draw(); };
  box.addEventListener('pointerdown', e => { box.setPointerCapture(e.pointerId); at(e); }); box.addEventListener('pointermove', e => { if (e.buttons || e.pointerType === 'touch') at(e); });
  bar.addEventListener('keydown', e => { if (e.key === 'ArrowLeft') pos = clamp(pos - 2, 0, 100); else if (e.key === 'ArrowRight') pos = clamp(pos + 2, 0, 100); else return; e.preventDefault(); draw(); });
  $('#cmpSw', el).onclick = () => { [a, b] = [b, a]; draw(); }; $('#cmpF', el).onclick = () => { fade = !fade; draw(); }; draw(); bar.focus(); }

/* =====================================================================================================
   6. SCIENCE — Mini-labs: predict → observe → explain
   Students commit to a prediction, collect noisy data one trial at a time, and only then see the model line. */
const noise = a => (Math.random() + Math.random() + Math.random() - 1.5) / 1.5 * a;
const ENZ = { amylase: ['Salivary amylase', 37, 7], pepsin: ['Pepsin (stomach)', 37, 2], trypsin: ['Trypsin (small intestine)', 37, 8], taq: ['Taq polymerase (hot-spring bacterium)', 72, 8.5] };
const LABS = {
  enzyme: { title: 'Enzyme activity', mode: 'points', min: 5,
    controls: [{ id: 'enz', t: 'select', label: 'Enzyme', opts: Object.keys(ENZ).map(k => [k, ENZ[k][0]]) }, { id: 'var', t: 'select', label: 'Change', opts: [['T', 'Temperature'], ['pH', 'pH']] }, { id: 'x', t: 'range', label: v => v.var === 'pH' ? 'pH' : 'Temperature (°C)', min: v => v.var === 'pH' ? 1 : 0, max: v => v.var === 'pH' ? 12 : 90, step: v => v.var === 'pH' ? 0.5 : 5, def: v => v.var === 'pH' ? 4 : 20 }],
    axis: v => v.var === 'pH' ? { x: 'pH', xmin: 1, xmax: 12, y: 'Rate of reaction (% of maximum)', ymin: 0, ymax: 110 } : { x: 'Temperature (°C)', xmin: 0, xmax: 90, y: 'Rate of reaction (% of maximum)', ymin: 0, ymax: 110 },
    model(v, x) { const e = ENZ[v.enz]; if (v.var === 'pH') return 100 * Math.exp(-Math.pow((x - e[2]) / 1.5, 2)); const d = x - e[1]; return d <= 0 ? 100 * Math.pow(2, d / 10) : 100 * Math.max(0, 1 - Math.pow(d / 14, 2)); },
    noise: 5, key: v => v.enz + v.var,
    predict: v => v.var === 'pH' ? { q: 'As the pH moves away from the enzyme’s best pH, on either side, the rate will…', o: ['fall on both sides', 'keep rising', 'stay the same', 'fall on the acid side only'], a: 0 } : { q: 'As the temperature rises from 0 °C to 90 °C, the rate of reaction will…', o: ['rise slowly, then fall sharply after a peak', 'keep rising all the way', 'stay the same', 'fall steadily'], a: 0 },
    explain: v => v.var === 'pH' ? 'Away from the optimum pH the charges on the active site change, the substrate fits less well, and far from it the enzyme is denatured.' : 'Up to the optimum, more kinetic energy gives more enzyme–substrate collisions. Above it the active site changes shape (denatures), so the rate drops quickly.',
    frames: ['The rate was highest at …', 'Below this the rate was lower because …', 'Above this the rate fell because …'] },
  osmosis: { title: 'Osmosis in a cell', mode: 'points', min: 5,
    controls: [{ id: 'cell', t: 'select', label: 'Cell', opts: [['plant', 'Plant cell (potato)'], ['animal', 'Animal cell (red blood cell)']] }, { id: 'x', t: 'range', label: () => 'Sugar concentration outside (mol/dm³)', min: () => 0, max: () => 1, step: () => 0.1, def: () => 0.6 }],
    axis: () => ({ x: 'Sugar concentration (mol/dm³)', xmin: 0, xmax: 1, y: 'Change in mass (%)', ymin: -30, ymax: 30 }),
    model: (v, x) => (v.cell === 'plant' ? 22 : 28) * Math.tanh((0.3 - x) * 3.4), noise: 1.6, key: v => v.cell, visual: true,
    predict: () => ({ q: 'A cell is placed in a sugar solution more concentrated than its own contents. It will…', o: ['lose mass — water leaves by osmosis', 'gain mass — water enters by osmosis', 'not change', 'gain mass — sugar enters'], a: 0 }),
    explain: v => 'Water moves by osmosis from the more dilute solution to the more concentrated one through the partially permeable membrane. Where the line crosses 0 % (about 0.3 mol/dm³) the solution has the same concentration as the cell. ' + (v.cell === 'plant' ? 'A plant cell becomes turgid in dilute solution and plasmolysed in concentrated solution; the cell wall stops it bursting.' : 'An animal cell has no cell wall: it bursts in very dilute solution and shrinks (crenates) in concentrated solution.'),
    frames: ['In dilute solution the cell … because …', 'In concentrated solution the cell … because …', 'The cell’s own concentration is about … because …'] },
  predprey: { title: 'Predator and prey', mode: 'series', min: 2,
    controls: [{ id: 'a', t: 'range', label: () => 'Prey birth rate', min: () => 0.4, max: () => 1.6, step: () => 0.1, def: () => 1 }, { id: 'b', t: 'range', label: () => 'Hunting success of predators', min: () => 0.01, max: () => 0.04, step: () => 0.005, def: () => 0.02 }, { id: 'g', t: 'range', label: () => 'Predator death rate', min: () => 0.4, max: () => 1.6, step: () => 0.1, def: () => 1 }],
    axis: () => ({ x: 'Time (years)', xmin: 0, xmax: 30, y: 'Population', ymin: 0, ymax: 260 }),
    series(v) { let x = 120, y = 30; const dt = 0.01, c = 0.01, out = [[], []], f = (x, y) => [v.a * x - v.b * x * y, c * x * y - v.g * y]; for (let t = 0; t <= 30 + 1e-9; t += dt) { if (Math.round(t / dt) % 10 === 0) { out[0].push([t, x]); out[1].push([t, y]); } const k1 = f(x, y), k2 = f(x + k1[0] * dt / 2, y + k1[1] * dt / 2), k3 = f(x + k2[0] * dt / 2, y + k2[1] * dt / 2), k4 = f(x + k3[0] * dt, y + k3[1] * dt); x = Math.max(0, x + dt / 6 * (k1[0] + 2 * k2[0] + 2 * k3[0] + k4[0])); y = Math.max(0, y + dt / 6 * (k1[1] + 2 * k2[1] + 2 * k3[1] + k4[1])); } return out; },
    names: ['Prey (hares)', 'Predators (lynx)'],
    predict: () => ({ q: 'When the prey population reaches a peak, the predator population will peak…', o: ['a little later', 'at exactly the same time', 'a little earlier', 'never — it stays level'], a: 0 }),
    explain: () => 'More prey means more food, so more predators survive and breed — but only after a delay, so the predator peak comes later. More predators then eat more prey, the prey fall, the predators starve and fall, and the cycle starts again.',
    frames: ['When the prey increase, the predators … because …', 'The predator peak comes later because …', 'When I raised … the cycles became …'] } };

function lab(kind) { const L = LABS[kind]; if (!L) return; const v = {}, st = { step: 0, pick: -1, data: {}, runs: [], shown: false };
  L.controls.forEach(c => { if (c.t === 'select') v[c.id] = c.opts[0][0]; }); L.controls.forEach(c => { if (c.t === 'range') v[c.id] = c.def(v); });
  const el = overlay('Mini-lab · ' + L.title, '<div class="lab-side"><div class="lab-step" id="lbSt"></div><div class="lab-card" id="lbP"></div><div class="lab-card" id="lbC"></div><div class="lab-card" id="lbE" hidden></div></div><div class="lab-main"><canvas id="lbCv" aria-label="Graph of the results"></canvas><div class="px-row" style="margin:0"><button class="btn primary" id="lbRun"></button><button class="btn" id="lbAuto"></button><button class="btn" id="lbClr">Clear results</button><span class="sp" style="flex:1"></span><button class="btn" id="lbAdd">' + icon('plus') + 'Add graph to the board</button></div></div>');
  const cv = $('#lbCv', el), key = () => L.key ? L.key(v) : 'k', pts = () => st.data[key()] || (st.data[key()] = []);
  const enough = () => L.mode === 'series' ? st.runs.length >= L.min : pts().length >= L.min;
  const steps = () => { $('#lbSt', el).innerHTML = ['1 Predict', '2 Observe', '3 Explain'].map((s, i) => '<span class="' + (i === st.step ? 'on' : i < st.step ? 'done' : '') + '">' + s + '</span>').join(''); };
  const predict = () => { const P = L.predict(v), box = $('#lbP', el), locked = st.step > 0; box.innerHTML = '<h3>Predict first</h3><div style="font-weight:600">' + esc(P.q) + '</div>' + P.o.map((o, i) => '<button class="btn lab-opt' + (i === st.pick ? ' on' : '') + (st.shown && i === P.a ? ' right' : st.shown && i === st.pick ? ' wrong' : '') + '" data-o="' + i + '"' + (locked ? ' disabled' : '') + '>' + esc(o) + '</button>').join('') + (locked ? '' : '<div class="px-hint">Choose before you run anything — a wrong prediction you then test is remembered better than a right answer you are told.</div>');
    $$('[data-o]', box).forEach(b => b.onclick = () => { st.pick = +b.dataset.o; st.step = 1; snd('pop'); refresh(); }); };
  const controls = () => { const box = $('#lbC', el); box.innerHTML = '<h3>Change one thing</h3>' + L.controls.map(c => c.t === 'select' ? '<label>' + c.label + '<select data-c="' + c.id + '">' + c.opts.map(o => '<option value="' + o[0] + '"' + (v[c.id] === o[0] ? ' selected' : '') + '>' + esc(o[1]) + '</option>').join('') + '</select></label>' : '<label><span>' + esc(c.label(v)) + '</span>: <b data-v="' + c.id + '">' + v[c.id] + '</b><input type="range" data-c="' + c.id + '" min="' + c.min(v) + '" max="' + c.max(v) + '" step="' + c.step(v) + '" value="' + v[c.id] + '"></label>').join('');
    $$('[data-c]', box).forEach(inp => { const c = L.controls.find(x => x.id === inp.dataset.c); inp[c.t === 'select' ? 'onchange' : 'oninput'] = () => { if (c.t === 'select') { v[c.id] = inp.value; L.controls.forEach(r => { if (r.t === 'range') v[r.id] = r.def(v); }); if (st.step < 2) { st.shown = false; } controls(); if (st.step === 0) predict(); } else { v[c.id] = +inp.value; $('[data-v="' + c.id + '"]', box).textContent = v[c.id]; } draw(); btns(); }; }); };
  const btns = () => { const run = $('#lbRun', el), auto = $('#lbAuto', el); run.disabled = auto.disabled = st.step === 0; run.innerHTML = icon('play') + (L.mode === 'series' ? 'Run 30 years' : 'Run a trial at this value'); auto.textContent = L.mode === 'series' ? 'Compare with the last run' : 'Run the whole range'; auto.hidden = L.mode === 'series';
    const e = $('#lbE', el); e.hidden = st.step === 0; if (st.step === 0) return; if (!st.shown) { e.innerHTML = '<h3>Explain</h3>' + (enough() ? '<button class="btn primary" id="lbShow" style="width:100%">Show the pattern and check my prediction</button>' : '<div class="px-hint" style="margin:0">' + (L.mode === 'series' ? 'Run it at least ' + L.min + ' times with different settings.' : 'Collect at least ' + L.min + ' results across the range (' + pts().length + ' so far). Repeat a value to see how reliable it is.') + '</div>'); if ($('#lbShow', e)) $('#lbShow', e).onclick = () => { st.shown = true; st.step = 2; snd('chime'); refresh(); }; }
    else { const P = L.predict(v), ok = st.pick === P.a; e.innerHTML = '<h3>Explain</h3><div style="font-weight:700;color:' + (ok ? '#2F9E44' : '#E8590C') + '">' + (ok ? 'Your prediction matched the results.' : 'The results did not match your prediction — that is how scientists learn.') + '</div><div class="px-hint" style="color:var(--ink)">' + esc(L.explain(v)) + '</div><button class="btn" id="lbFr" style="width:100%;margin-top:8px">' + icon('pencil') + 'Put sentence starters on the board</button>'; $('#lbFr', e).onclick = () => { closeOver(); I.insertObj({ t: 'text', s: L.title + ' — explain the results\n' + L.frames.map(f => '•  ' + f).join('\n'), font: 'Lexend', size: 28, c: ink(), w: 900 }); }; } };
  /* ---- graph ---- */
  function draw(target) { const c = target || cv, dpr = target ? 1 : Math.min(2, window.devicePixelRatio || 1); if (!target) { const r = cv.getBoundingClientRect(); cv.width = Math.max(300, r.width) * dpr; cv.height = Math.max(240, r.height) * dpr; }
    const g = c.getContext('2d'), W = c.width / dpr, H = c.height / dpr, A = L.axis(v), vis = L.visual && !target ? Math.min(250, W * 0.3) : 0, m = { l: 66, r: 20 + vis, t: 44, b: 54 }, pw = W - m.l - m.r, ph = H - m.t - m.b;
    const X = x => m.l + (x - A.xmin) / (A.xmax - A.xmin) * pw, Y = y => m.t + ph - (clamp(y, A.ymin, A.ymax) - A.ymin) / (A.ymax - A.ymin) * ph;
    g.setTransform(dpr, 0, 0, dpr, 0, 0); g.fillStyle = '#fff'; g.fillRect(0, 0, W, H); g.font = '700 16px Lexend, Arial, sans-serif'; g.fillStyle = '#1E1419'; g.textAlign = 'left'; g.textBaseline = 'alphabetic';
    g.fillText(L.title + (L.key && kind === 'enzyme' ? ' — ' + ENZ[v.enz][0] : kind === 'osmosis' ? ' — ' + (v.cell === 'plant' ? 'plant cell' : 'animal cell') : ''), m.l, 26);
    g.strokeStyle = '#E3DAE0'; g.lineWidth = 1; g.font = '12px Lexend, Arial, sans-serif'; g.fillStyle = '#5E4F5A';
    for (let i = 0; i <= 5; i++) { const xv = A.xmin + (A.xmax - A.xmin) * i / 5, yv = A.ymin + (A.ymax - A.ymin) * i / 5; g.beginPath(); g.moveTo(X(xv), m.t); g.lineTo(X(xv), m.t + ph); g.moveTo(m.l, Y(yv)); g.lineTo(m.l + pw, Y(yv)); g.stroke(); g.textAlign = 'center'; g.fillText(+xv.toFixed(2), X(xv), m.t + ph + 18); g.textAlign = 'right'; g.fillText(Math.round(yv), m.l - 8, Y(yv) + 4); }
    g.strokeStyle = '#1E1419'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(m.l, m.t); g.lineTo(m.l, m.t + ph); g.lineTo(m.l + pw, m.t + ph); g.stroke(); if (A.ymin < 0) { g.beginPath(); g.moveTo(m.l, Y(0)); g.lineTo(m.l + pw, Y(0)); g.stroke(); }
    g.fillStyle = '#1E1419'; g.font = '600 13px Lexend, Arial, sans-serif'; g.textAlign = 'center'; g.fillText(A.x, m.l + pw / 2, H - 12); g.save(); g.translate(18, m.t + ph / 2); g.rotate(-Math.PI / 2); g.fillText(A.y, 0, 0); g.restore();
    if (L.mode === 'series') { const cols = ['#0B7285', '#D6336C']; st.runs.slice(-2).forEach((run, ri, arr) => { const last = ri === arr.length - 1; run.s.forEach((ser, k) => { g.strokeStyle = cols[k]; g.lineWidth = last ? 2.6 : 1.4; g.setLineDash(last ? [] : [6, 5]); g.globalAlpha = last ? 1 : 0.55; g.beginPath(); const n = last && run.n != null ? run.n : ser.length; ser.slice(0, n).forEach((p, i) => i ? g.lineTo(X(p[0]), Y(p[1])) : g.moveTo(X(p[0]), Y(p[1]))); g.stroke(); }); }); g.setLineDash([]); g.globalAlpha = 1;
      L.names.forEach((nm, k) => { g.fillStyle = cols[k]; g.fillRect(m.l + pw - 170, m.t + 6 + k * 20, 22, 4); g.textAlign = 'left'; g.font = '600 12.5px Lexend, Arial, sans-serif'; g.fillText(nm, m.l + pw - 142, m.t + 12 + k * 20); }); if (!st.runs.length) { g.fillStyle = '#8A7783'; g.textAlign = 'center'; g.font = '600 15px Lexend, Arial, sans-serif'; g.fillText(st.step ? 'Press “Run 30 years”.' : 'Make your prediction to begin.', m.l + pw / 2, m.t + ph / 2); } }
    else { if (st.shown) { g.strokeStyle = '#7048E8'; g.lineWidth = 2.5; g.beginPath(); for (let i = 0; i <= 200; i++) { const xv = A.xmin + (A.xmax - A.xmin) * i / 200, px = X(xv), py = Y(L.model(v, xv)); i ? g.lineTo(px, py) : g.moveTo(px, py); } g.stroke(); }
      pts().forEach(p => { g.fillStyle = '#D6336C'; g.strokeStyle = '#fff'; g.lineWidth = 1.5; g.beginPath(); g.arc(X(p[0]), Y(p[1]), 5.5, 0, 7); g.fill(); g.stroke(); });
      if (!target && st.step) { g.strokeStyle = 'rgba(214,51,108,.5)'; g.setLineDash([4, 4]); g.lineWidth = 1.5; g.beginPath(); g.moveTo(X(v.x), m.t); g.lineTo(X(v.x), m.t + ph); g.stroke(); g.setLineDash([]); }
      if (!pts().length) { g.fillStyle = '#8A7783'; g.textAlign = 'center'; g.font = '600 15px Lexend, Arial, sans-serif'; g.fillText(st.step ? 'Move the slider and run a trial.' : 'Make your prediction to begin.', m.l + pw / 2, m.t + ph / 2 - (A.ymin < 0 ? 40 : 0)); } }
    if (vis) drawCell(g, W - vis + 6, m.t, vis - 22, ph, v); }
  /* the cell picture beside the osmosis graph: its size follows the model at the slider value */
  function drawCell(g, x, y, w, h, v) { const d = L.model(v, v.x) / 100, cx = x + w / 2, cy = y + h / 2 - 10, R = Math.min(w, h * 0.7) / 2 - 6; g.save(); g.textAlign = 'center'; g.font = '700 13px Lexend, Arial, sans-serif'; let state;
    if (v.cell === 'plant') { const bw = R * 1.7, bh = R * 1.9; g.fillStyle = '#EAF7E3'; g.strokeStyle = '#2B8A3E'; g.lineWidth = 5; g.beginPath(); g.rect(cx - bw / 2, cy - bh / 2, bw, bh); g.fill(); g.stroke(); const k = clamp(1 + d * 1.6, 0.5, 1), pw = (bw - 8) * k, phh = (bh - 8) * k; g.fillStyle = '#B2F2BB'; g.strokeStyle = '#37B24D'; g.lineWidth = 2; g.beginPath(); if (g.roundRect) g.roundRect(cx - pw / 2, cy - phh / 2, pw, phh, 12 * (1.4 - k)); else g.rect(cx - pw / 2, cy - phh / 2, pw, phh); g.fill(); g.stroke(); g.fillStyle = '#A5D8FF'; g.beginPath(); g.ellipse(cx, cy, pw * 0.3, phh * 0.33, 0, 0, 7); g.fill(); state = d > 0.06 ? 'Turgid' : d > -0.04 ? 'Flaccid' : 'Plasmolysed'; }
    else { const k = clamp(1 + d * 1.5, 0.55, 1.45), burst = v.x <= 0.05; if (burst) { g.fillStyle = '#FFA8A8'; for (let i = 0; i < 9; i++) { const a = i * 0.7; g.beginPath(); g.arc(cx + Math.cos(a) * R * 0.9, cy + Math.sin(a) * R * 0.7, R * 0.13, 0, 7); g.fill(); } state = 'Burst (lysis)'; } else { g.fillStyle = '#FF8787'; g.strokeStyle = '#C92A2A'; g.lineWidth = 3; g.beginPath(); const n = 40, rr = R * 0.62 * k; for (let i = 0; i <= n; i++) { const a = i / n * Math.PI * 2, sp = d < -0.05 ? 1 + Math.sin(a * 9) * Math.min(0.2, -d * 0.9) : 1; const px = cx + Math.cos(a) * rr * sp, py = cy + Math.sin(a) * rr * sp; i ? g.lineTo(px, py) : g.moveTo(px, py); } g.closePath(); g.fill(); g.stroke(); state = d > 0.05 ? 'Swollen' : d > -0.05 ? 'Normal' : 'Shrunk (crenated)'; } }
    g.fillStyle = '#1E1419'; g.fillText(state, cx, y + h - 6); const dir = d > 0.02 ? 'Water moves in' : d < -0.02 ? 'Water moves out' : 'No net movement'; g.fillStyle = '#1971C2'; g.font = '600 12px Lexend, Arial, sans-serif'; g.fillText(dir, cx, y + 12); g.restore(); }
  const refresh = () => { steps(); predict(); controls(); btns(); draw(); };
  $('#lbRun', el).onclick = () => { if (L.mode === 'series') { const run = { s: L.series(v), n: 0 }; st.runs.push(run); const total = run.s[0].length, go = () => { if (!over || over.el !== el) return; run.n = Math.min(total, run.n + (REDUCE ? total : 6)); draw(); if (run.n < total) requestAnimationFrame(go); else { run.n = null; btns(); } }; go(); } else { pts().push([v.x, L.model(v, v.x) + noise(L.noise)]); snd('pop'); draw(); btns(); } };
  $('#lbAuto', el).onclick = () => { const c = L.controls.find(x => x.id === 'x'); const lo = c.min(v), hi = c.max(v), n = 9; for (let i = 0; i <= n; i++) { const xv = lo + (hi - lo) * i / n; pts().push([+xv.toFixed(2), L.model(v, xv) + noise(L.noise)]); } snd('pop'); draw(); btns(); };
  $('#lbClr', el).onclick = () => { st.data[key()] = []; st.runs = []; if (st.step === 2) { st.step = 1; st.shown = false; } refresh(); };
  $('#lbAdd', el).onclick = () => { const c = document.createElement('canvas'); c.width = 1100; c.height = 640; draw(c); const url = c.toDataURL('image/png'); closeOver(); I.insertImage(url); toast('Graph added to the board.'); };
  const ro = window.ResizeObserver ? new ResizeObserver(() => draw()) : null; ro && ro.observe(cv); const off0 = over.off; over.off = () => { ro && ro.disconnect(); off0(); };
  refresh(); }
function labs() { modal.open('<h2>' + icon('activity') + 'Mini-labs</h2><p><span>Each lab runs as predict → observe → explain.</span> <span>Commit to a prediction, collect the results, then see the pattern and explain it.</span></p><div class="st-pick" style="display:grid;gap:8px">' + [['enzyme', 'thermometer', 'Enzyme activity', 'Rate against temperature or pH, for four enzymes'], ['osmosis', 'flask-conical', 'Osmosis in a cell', 'Change in mass against sugar concentration, plant and animal cells'], ['predprey', 'chart-line', 'Predator and prey', 'Population cycles over 30 years']].map(x => '<button class="btn" data-l="' + x[0] + '" style="justify-content:flex-start;height:auto;padding:12px;gap:12px;text-align:start">' + icon(x[1]) + '<span><b>' + x[2] + '</b><br><span class="small muted">' + x[3] + '</span></span></button>').join('') + '</div>', s => { $$('[data-l]', s).forEach(b => b.onclick = () => { modal.close(); lab(b.dataset.l); }); }); }

/* =====================================================================================================
   7. TEACH — Lesson runway: the lesson flow (studio.js) drawn as a strip across the top of the board */
let runwayEl = null;
bus.on('flow', FL => { if (!FL || set.get('runway', true) === false) { if (runwayEl) { runwayEl.remove(); runwayEl = null; } return; }
  if (!runwayEl) { runwayEl = document.createElement('div'); runwayEl.id = 'runway'; runwayEl.setAttribute('role', 'group'); runwayEl.setAttribute('aria-label', 'Lesson runway'); stageEl.appendChild(runwayEl); }
  const sig = FL.ph.map(p => p.join('|')).join(';'); if (runwayEl.dataset.sig !== sig) { runwayEl.dataset.sig = sig; runwayEl.innerHTML = FL.ph.map((p, i) => '<button data-i="' + i + '" style="flex:' + Math.max(1, p[1]) + ' 1 0" title="' + esc(p[0]) + ' · ' + p[1] + ' min"><i></i><span data-noi18n>' + esc(p[0]) + '</span></button>').join(''); $$('button', runwayEl).forEach(b => b.onclick = () => FL.go && FL.go(+b.dataset.i)); }
  $$('button', runwayEl).forEach((b, i) => { const p = FL.ph[i], frac = i < FL.i ? 1 : i > FL.i ? 0 : clamp(FL.used / (p[1] * 60), 0, 1); b.className = (i === FL.i ? 'on' : i < FL.i ? 'done' : '') + (i === FL.i && FL.used > p[1] * 60 ? ' over' : ''); b.firstChild.style.width = (i < FL.i ? 0 : frac * 100) + '%'; }); });

/* =====================================================================================================
   9. COLLABORATE — Fair talk: tap a name each time that student contributes */
const dayKey = () => { const d = new Date(); return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate(); };
const classNames = () => { const L = set.get('wheelLists', null), cur = set.get('wheelCur', ''); const n = set.get('coldNames', null) || (L && L[cur]) || set.get('names', []); return (n || []).map(x => typeof x === 'string' ? x : x && x.name).filter(Boolean); };
function fairTalk() { let D = set.get('fairTalk', null); if (!D || D.day !== dayKey()) D = { day: dayKey(), c: {} }; let picked = '';
  const f = floatPanel('fairtalk', 'Fair talk', '<div class="st-panel"><div id="ftS" style="font:700 15px var(--head)"></div><div class="st-meter"><i id="ftBar" style="background:#4ADE80"></i></div><div class="ft-grid" id="ftG"></div><div class="px-row"><button class="btn sm primary" id="ftP">' + icon('shuffle') + 'Pick a quiet voice</button><button class="btn sm" id="ftU">Undo</button><button class="btn sm" id="ftN">Names</button><button class="btn sm" id="ftR">New lesson</button></div><div class="px-hint">Tap a name each time that student answers or asks. “Pick a quiet voice” chooses from those who have spoken least.</div></div>', Object.assign({ icon: 'scale', w: 400 }, side(400)));
  const b = f.body, last = []; const save = () => set.put('fairTalk', D);
  const draw = () => { const ns = classNames(); if (!ns.length) { $('#ftG', b).innerHTML = '<div class="px-hint" style="grid-column:1/-1">Add your class names first (Names).</div>'; $('#ftS', b).textContent = 'No class list yet'; $('#ftBar', b).style.width = '0%'; return; }
    const spoke = ns.filter(n => D.c[n]).length; $('#ftS', b).textContent = spoke + ' of ' + ns.length + ' students have spoken'; $('#ftBar', b).style.width = spoke / ns.length * 100 + '%';
    $('#ftG', b).innerHTML = ns.map((n, i) => '<button class="ft-n c' + Math.min(3, D.c[n] || 0) + (n === picked ? ' pick' : '') + '" data-n="' + i + '" aria-label="' + esc(n) + ', ' + (D.c[n] || 0) + ' contributions"><span data-noi18n>' + esc(n) + '</span><b>' + (D.c[n] || 0) + '</b></button>').join('');
    $$('[data-n]', b).forEach(x => x.onclick = () => { const n = ns[+x.dataset.n]; D.c[n] = (D.c[n] || 0) + 1; last.push(n); if (n === picked) picked = ''; save(); snd('pop'); draw(); }); };
  $('#ftP', b).onclick = () => { const ns = classNames(); if (!ns.length) { toast('Add your class names first.'); return; } const min = Math.min(...ns.map(n => D.c[n] || 0)), pool = ns.filter(n => (D.c[n] || 0) === min && n !== picked); picked = (pool.length ? pool : ns)[Math.floor(Math.random() * (pool.length || ns.length))]; snd('chime'); draw(); const el = $('.ft-n.pick', b); el && el.scrollIntoView({ block: 'nearest' }); toast('Next voice: <b>' + esc(picked) + '</b>', 3500); };
  $('#ftU', b).onclick = () => { const n = last.pop(); if (!n) return; D.c[n] = Math.max(0, (D.c[n] || 0) - 1); save(); draw(); };
  $('#ftR', b).onclick = () => { D = { day: dayKey(), c: {} }; picked = ''; last.length = 0; save(); draw(); };
  $('#ftN', b).onclick = () => { modal.open('<h2>Class names</h2><p class="small muted">One name per line, or separated by commas. The same list is used by Cold call.</p><textarea id="ftT" style="width:100%;min-height:220px" dir="auto">' + esc(classNames().join('\n')) + '</textarea><div class="foot"><button class="btn" data-close>Cancel</button><button class="btn primary" id="ftOk">Save</button></div>', s => { $('#ftOk', s).onclick = () => { const nn = $('#ftT', s).value.split(/[\n,،]+/).map(x => x.trim()).filter(Boolean); set.put('coldNames', nn.length ? nn : null); modal.close(); draw(); }; }); };
  draw(); }

/* =====================================================================================================
   10. PAGE — Lesson recap: a new last page with what was covered, the key ideas and questions to answer */
function recap() { const textOf = o => (o.cz ? o.cz.s : o.s || '').trim(), heads = [], ideas = [], qs = [], seen = new Set(); const add = (arr, s, max) => { s = s.replace(/\s+/g, ' ').trim(); const k = s.toLowerCase(); if (!s || seen.has(k) || s.length > max) return; seen.add(k); arr.push(s); };
  B.pages.forEach(p => { if (p.recap) return; const os = p.objs.filter(o => (o.t === 'text' || o.t === 'note') && !o.ph && !o.stamp && !o.cover && !o.ms && !o.ttl && textOf(o)).sort((a, b) => a.y - b.y || a.x - b.x);
    os.forEach(o => { const s = textOf(o), first = s.split('\n')[0]; if (o.t === 'text' && (o.size >= 34 || o.b && o.size >= 26) && first.length <= 90) add(heads, first, 90);
      s.split('\n').forEach(l => { l = l.replace(/^[•☐☑→\d.)\s]+/, '').trim(); if (/[?؟]$/.test(l)) add(qs, l, 160); else if (/^(.+?)\s(?:[-–—]|=)\s(.+)$/.test(l) || /^[^:]{2,40}:\s.+/.test(l)) add(ideas, l, 170); }); });
    /* the note boxes (Key fact, Definition, Remember, Summary…) are grouped: their title names the kind */
    const byG = {}; p.objs.forEach(o => { if (o.g && o.tpl && o.t === 'text') (byG[o.g] = byG[o.g] || []).push(o); }); Object.values(byG).forEach(g => { const t = g.find(o => o.ttl); if (!t) return; const kind = textOf(t); const body = p.objs.filter(o => o.g === t.g && o.t === 'text' && !o.ttl && !o.ph && textOf(o)).concat(p.objs.filter(o => o.zid === t.g && o.t === 'text' && textOf(o))).map(textOf).join(' '); if (!body) return; if (/question/i.test(kind)) add(qs, body, 200); else add(ideas, kind.charAt(0) + kind.slice(1).toLowerCase() + ': ' + body, 220); }); });
  if (!heads.length && !ideas.length && !qs.length) { toast('Nothing to recap yet — add headings (Text → Title or Heading), key-fact boxes or “term - definition” lines first.', 5600); return; }
  const auto = !qs.length; if (auto) { const top = heads.slice(0, 3); (top.length ? top : ['today’s lesson']).forEach((h, i) => qs.push(['Explain ' + h + ' in your own words.', 'Give one example of ' + h + '.', 'What is one thing about ' + h + ' you are still unsure of?'][i % 3])); }
  const np = E.newPage(page().theme); np.name = 'Lesson recap'; np.recap = 1; B.pages.push(np); window.HBUI ? HBUI.goPage(B.pages.length - 1) : (B.cur = B.pages.length - 1);
  const col = dark() ? '#FFFFFF' : '#1E1419', acc = dark() ? '#B197FC' : '#5F3DC4', W = Math.min(1500, (B.mode === 'scroll' ? B.width : 1700) - 160), x0 = 80; let y = 150; const out = [];
  const put = (s, size, o) => { const t = Object.assign({ t: 'text', x: x0, y, w: W, s, font: 'Lexend', size, c: col }, o || {}); out.push(t); y += E.textLayout(Object.assign({}, t)).h + (o && o.gap != null ? o.gap : 18); };
  put('Lesson recap' + (B.title && B.title !== 'Untitled board' ? ' — ' + B.title : ''), 54, { b: true, gap: 6 }); put(new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }), 22, { c: acc, gap: 34 });
  if (heads.length) { put('What we covered', 32, { b: true, c: acc, gap: 10 }); put(heads.slice(0, 14).map(h => '•  ' + h).join('\n'), 26, { gap: 34 }); }
  if (ideas.length) { put('Key ideas', 32, { b: true, c: acc, gap: 10 }); put(ideas.slice(0, 12).map(h => '•  ' + h).join('\n'), 24, { gap: 34 }); }
  put(auto ? 'Check yourself' : 'Questions to answer', 32, { b: true, c: acc, gap: 10 }); put(qs.slice(0, 8).map((q, i) => (i + 1) + '.  ' + q).join('\n'), 26, { gap: 34 });
  put('Before you leave', 32, { b: true, c: acc, gap: 10 }); put('3 things I learned …\n2 things I found interesting …\n1 question I still have …', 26);
  E.add(out); np.H = Math.max(np.H || 0, y + 200); I.clearSel(); repaint(); E.changed(); snd('chime');
  toast('Recap page added at the end. <b>Page → PDF</b> prints it as a handout; edit any line first.', 6000); }

/* due flashcards: one gentle reminder a day, when the app opens */
setTimeout(() => { try { if (!window.HBL || !HBL.dueTotal || set.get('dueSeen', '') === dayKey()) return; const n = HBL.dueTotal(); if (n > 0) { set.put('dueSeen', dayKey()); toast(icon('repeat') + ' <b>' + n + '</b> flashcard' + (n === 1 ? ' is' : 's are') + ' due today — Study → Due today.', 6000); } } catch (e) {} }, 9000);

window.HBP = { ghost, ghostMode, measure, measureOf, get measuring() { return M.on; }, cloze, clozePanel, clozeStep, clozeText, notesQuiz, buildQuiz, pairsFrom, compare, labs, lab, LABS, fairTalk, recap, closeOver };
})();
