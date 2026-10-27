/* ================= HelixBoard — note-taking kit: text styles, smart lists, callout boxes, tables, dividers, highlighters, marking stamps,
   hide & reveal covers, frames (named areas you jump between), read aloud, notes → flashcards ================= */
(() => {
'use strict';
const { $, $$, esc, icon, set, toast, modal, SND, floatPanel, REDUCE, uid, clamp } = window.HB;
const E = window.HBE, I = window.HBI, T = I.T;
const snd = k => { try { SND[k] && SND[k](); } catch (e) {} };
const dark = () => E.isDark();
const ink = () => dark() ? '#F6ECF4' : '#1E1419';
const viewCentre = () => { const vr = E.viewRect(); return [vr[0] + vr[2] / 2, vr[1] + vr[3] / 2, vr]; };
const tint = (hex, k) => { const n = parseInt(hex.slice(1), 16), r = n >> 16, g = (n >> 8) & 255, b = n & 255, base = dark() ? [28, 18, 32] : [255, 255, 255]; return '#' + [r, g, b].map((v, i) => Math.round(base[i] + (v - base[i]) * k).toString(16).padStart(2, '0')).join(''); };
function place(objs) { E.add(objs); I.setTool('select'); I.select(objs); snd('pop'); return objs; }
const textH = o => E.textLayout(o).h;

/* ---------- text styles ---------- */
const STYLES = { title: [64, true, 'Title'], heading: [44, true, 'Heading'], sub: [32, true, 'Subheading'], body: [28, false, 'Body text'], small: [22, false, 'Small print'] };
function style(k) { const s = STYLES[k]; if (!s) return; T.fsize = s[0]; T.bold = s[1]; set.put('fsize', s[0]); const sel = I.selObjs().filter(o => o.t === 'text' || o.t === 'note');
  if (sel.length) { E.mod(sel, o => { o.size = s[0]; o.b = s[1]; E.invalidate && E.invalidate(o); }); toast(s[2] + ' applied'); } else { I.setTool('text'); toast(s[2] + ' — tap the board where the text should go.'); }
  window.HBUI && HBUI.refresh(); }

/* ---------- lists that keep going when you press Enter ---------- */
const LIST = { bullet: '•  ', number: '1. ', check: '☐  ', arrow: '→  ' };
function list(kind) { const [cx, cy, vr] = viewCentre(); const w = Math.min(900, vr[2] * 0.6); window.HB.loadFont(T.font);
  I.openEditor({ t: 'text', x: cx - w / 2, y: cy - 60, w, s: LIST[kind], font: T.font, size: T.fsize || 32, c: T.color, b: false }, true);
  toast(kind === 'check' ? 'Checklist — press Enter for the next item. Double-click ☐ later and change it to ☑ when done.' : 'Press Enter for the next point; Enter on an empty point ends the list.', 3600); }
document.addEventListener('keydown', e => { if (e.key !== 'Enter' || e.shiftKey || e.ctrlKey || e.metaKey) return; const ta = e.target; if (!ta || ta.tagName !== 'TEXTAREA' || !ta.closest('#editor')) return;
  const v = ta.value, pos = ta.selectionStart, ls = v.lastIndexOf('\n', pos - 1) + 1, line = v.slice(ls, pos); const m = line.match(/^(\s*)(•|☐|☑|→|-|\d+[.)])(\s+)/); if (!m) return;
  e.preventDefault(); e.stopPropagation();
  if (line.trim() === m[2]) { ta.value = v.slice(0, ls) + v.slice(pos); ta.selectionStart = ta.selectionEnd = ls; }
  else { let mark = m[2]; if (/^\d+/.test(mark)) mark = (parseInt(mark, 10) + 1) + mark.replace(/^\d+/, ''); if (mark === '☑') mark = '☐'; const ins = '\n' + m[1] + mark + m[3]; ta.value = v.slice(0, pos) + ins + v.slice(ta.selectionEnd); ta.selectionStart = ta.selectionEnd = pos + ins.length; }
  ta.dispatchEvent(new Event('input', { bubbles: true })); }, true);

/* ---------- callout boxes: a coloured box you type into (a one-zone smart template) ---------- */
const BOXES = { fact: ['Key fact', '#FFC928', 'lightbulb'], def: ['Definition', '#22D3EE', 'book-open'], remember: ['Remember', '#FF5FA2', 'brain'], example: ['Example', '#4ADE80', 'flask-conical'], mistake: ['Common mistake', '#FF6B6B', 'triangle-alert'], tip: ['Exam tip', '#FF9F5A', 'graduation-cap'], question: ['Question', '#B197FC', 'circle-help'], summary: ['Summary', '#38BDF8', 'list-checks'] };
function box(k) { const b = BOXES[k]; if (!b) return; const [cx, cy, vr] = viewCentre(), W = Math.round(Math.min(900, vr[2] * 0.62)), H = 230, x = Math.round(cx - W / 2), y = Math.round(cy - H / 2), g = uid();
  const col = dark() ? b[1] : shade(b[1], 0.72);
  const objs = [{ t: 'shape', k: 'round', x, y, w: W, h: H, c: b[1], sw: 3, fill: tint(b[1], 0.16), g, tpl: 1, zone: 1, typ: 1, in: [0.03, 0.27, 0.94, 0.68] },
    { t: 'shape', k: 'rect', x: x + 3, y: y + 14, w: 10, h: H - 28, c: b[1], sw: 1, fill: b[1], g, tpl: 1 },
    { t: 'text', x: x + 28, y: y + 14, w: 0, s: b[0].toUpperCase(), font: 'Lexend', size: 24, b: true, c: col, g, tpl: 1, ttl: 1 },
    { t: 'text', x: x + 28, y: y + 70, w: W - 60, s: 'Tap here with the Text tool (or double-click) to write…', font: 'Lexend', size: 24, i: true, c: dark() ? '#9C8A99' : '#8A7783', g, tpl: 1, ph: 1 }];
  place(objs); }
const shade = (hex, k) => { const n = parseInt(hex.slice(1), 16); return '#' + [n >> 16, (n >> 8) & 255, n & 255].map(v => Math.round(v * k).toString(16).padStart(2, '0')).join(''); };

/* ---------- tables: every cell is a zone you can tap and type into ---------- */
function table() { modal.open('<h2>Insert a table</h2><div class="row" style="gap:14px;flex-wrap:wrap;align-items:center"><label>Rows <input id="tbR" type="number" min="1" max="20" value="4" class="inp" style="width:80px"></label><label>Columns <input id="tbC" type="number" min="1" max="10" value="3" class="inp" style="width:80px"></label><label><input type="checkbox" id="tbH" checked> Header row</label></div><p class="small muted">Tap a cell with the Text tool (or double-click it) to type. Handwriting works inside the cells too.</p><div class="foot"><button class="btn" data-close>Cancel</button><button class="btn primary" id="tbGo">Insert</button></div>', s => {
  $('#tbGo', s).onclick = () => { const R = clamp(+$('#tbR', s).value || 4, 1, 20), C = clamp(+$('#tbC', s).value || 3, 1, 10), hdr = $('#tbH', s).checked; modal.close();
    const [cx, cy, vr] = viewCentre(), cw = Math.round(Math.min(260, vr[2] * 0.8 / C)), rh = 76, W = cw * C, H = rh * R, x0 = Math.round(cx - W / 2), y0 = Math.round(cy - H / 2), g = uid(), line = dark() ? '#7A6480' : '#9C8794', head = tint('#22D3EE', 0.3), objs = [];
    for (let r = 0; r < R; r++) for (let c = 0; c < C; c++) objs.push({ t: 'shape', k: 'rect', x: x0 + c * cw, y: y0 + r * rh, w: cw, h: rh, c: line, sw: 2, fill: hdr && r === 0 ? head : (dark() ? '#1C1220' : '#FFFFFF'), g, tpl: 1, zone: 1, typ: 1, in: [0.06, 0.12, 0.88, 0.8] });
    place(objs); toast('Table added — tap a cell with the Text tool to type.'); }; }); }

/* ---------- dividers and section headings ---------- */
function divider() { const [cx, cy, vr] = viewCentre(), w = Math.min(1400, vr[2] * 0.8); place([{ t: 'shape', k: 'line', line: [cx - w / 2, cy, cx + w / 2, cy], c: dark() ? '#7A6480' : '#B9A5B6', sw: 3, dash: true }]); }
function section() { askLine('New section', 'Section title', '', t => { if (!t.trim()) return; const [cx, cy, vr] = viewCentre(), w = Math.min(1400, vr[2] * 0.8), x = cx - w / 2, g = uid(); const tx = { t: 'text', x, y: cy - 40, w: 0, s: t.trim(), font: 'Lexend', size: 48, b: true, c: dark() ? '#FF5FA2' : '#B0124F', g }; const h = textH(tx); place([tx, { t: 'shape', k: 'line', line: [x, cy - 40 + h + 10, x + w, cy - 40 + h + 10], c: tx.c, sw: 4, g }]); }); }
function askLine(title, label, def, cb) { modal.open('<h2>' + esc(title) + '</h2><input id="nkV" class="inp" style="width:100%" placeholder="' + esc(label) + '" value="' + esc(def || '') + '"><div class="foot"><button class="btn" data-close>Cancel</button><button class="btn primary" id="nkOk">OK</button></div>', s => { const v = $('#nkV', s), ok = () => { const x = v.value; modal.close(); cb(x); }; $('#nkOk', s).onclick = ok; v.onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); ok(); } e.stopPropagation(); }; setTimeout(() => v.focus(), 40); }); }

/* ---------- highlighters in the classic study colours ---------- */
const HI = { yellow: '#FFE066', green: '#8CE99A', pink: '#FCC2D7', blue: '#A5D8FF', orange: '#FFC078' };
function highlighter(c) { I.setTool('draw', 'hi'); I.setColor(HI[c] || HI.yellow); window.HBUI && HBUI.refresh(); }

/* ---------- marking stamps: pick one, tap the board to place it, Esc to stop ---------- */
const STAMPS = { tick: ['✓', '#2F9E44'], cross: ['✗', '#E03131'], star: ['★', '#F59F00'], ask: ['?', '#1C7ED6'], bang: ['!', '#E8590C'], thumb: ['👍', null], good: ['Good work!', '#2F9E44'], check: ['Check this', '#E8590C'], seeme: ['See me', '#7048E8'] };
let stampOn = null;
function stamp(k) { stampOn = k; document.body.classList.add('nk-stamp'); toast('Tap the board to place “' + STAMPS[k][0] + '”. Press Esc or pick another tool to stop.', 3200); }
const stopStamp = () => { stampOn = null; document.body.classList.remove('nk-stamp'); };
/* ---------- hide & reveal covers ---------- */
function cover() { const sel = I.selObjs().filter(o => !o.cover); if (!sel.length) { I.setTool('select'); toast('Select what should be hidden first (an answer, a label, a picture), then press Hide & reveal again.', 4200); return; }
  const out = []; sel.forEach(o => { const b = E.bbox(o); if (!b) return; const g = uid(), pad = 8, x = b[0] - pad, y = b[1] - pad, w = b[2] + pad * 2, h = b[3] + pad * 2; out.push({ t: 'shape', k: 'round', x, y, w, h, c: '#B197FC', sw: 3, fill: dark() ? '#3B2A52' : '#E5DBFF', cover: 1, g }, { t: 'text', x: x + w / 2 - Math.min(w, 220) / 2, y: y + h / 2 - 16, w: Math.min(w, 220), s: h > 44 ? '? tap to reveal' : '?', align: 'center', font: 'Lexend', size: Math.max(14, Math.min(26, h * 0.45)), b: true, c: dark() ? '#E5DBFF' : '#5F3DC4', cover: 1, g }); });
  place(out); toast('Hidden. In any tool except Select, tap a cover to reveal what is underneath (Undo brings it back).', 4200); }
function revealAll() { const cs = E.page().objs.filter(o => o.cover); if (!cs.length) { toast('No covers on this page.'); return; } E.del(cs); snd('chime'); }
/* one capture listener places stamps and opens covers before the drawing tools see the tap */
const stageEl = document.getElementById('stage');
stageEl && stageEl.addEventListener('pointerdown', e => { if (e.button !== 0 || e.target.closest('#editor,.float,#dock,#mini,#drawer,#zoomBox,#vbar,#hbar')) return; const [x, y] = E.toB(e.clientX, e.clientY);
  if (stampOn) { e.stopPropagation(); e.preventDefault(); const s = STAMPS[stampOn], big = s[0].length <= 2, o = { t: 'text', x, y, w: 0, s: s[0], font: 'Lexend', size: big ? 84 : 40, b: true, c: s[1] || ink(), stamp: 1 }; const L = E.textLayout(o); o.x -= L.w / 2; o.y -= L.h / 2; E.add([o]); snd('pop'); return; }
  if (T.tool === 'select' || T.tool === 'lasso') return;
  const hit = E.page().objs.slice().reverse().find(o => o.cover && (() => { const b = E.bbox(o); return b && x >= b[0] && x <= b[0] + b[2] && y >= b[1] && y <= b[1] + b[3]; })());
  if (hit) { e.stopPropagation(); e.preventDefault(); E.del(E.page().objs.filter(o => o.g === hit.g && o.cover)); snd('chime'); } }, true);
document.addEventListener('keydown', e => { if (e.key === 'Escape' && stampOn) { stopStamp(); toast('Stamps off'); } }, true);
document.addEventListener('click', e => { if (stampOn && e.target.closest('#toolrow [data-id], #dock [data-id], #sidetabs')) { const b = e.target.closest('[data-id]'); if (!b || !/^nk_st_/.test(b.dataset.id)) stopStamp(); } }, true);

/* ---------- frames (as on Miro): named areas of the board you can jump between and step through ---------- */
const frames = () => E.page().objs.filter(o => o.frame && o.t === 'shape').sort((a, b) => (a.fi || 0) - (b.fi || 0) || (a.ts || 0) - (b.ts || 0));
function addFrame(name) { const vr = E.viewRect(), inset = 0.05, x = vr[0] + vr[2] * inset, y = vr[1] + vr[3] * inset, w = vr[2] * (1 - inset * 2), h = vr[3] * (1 - inset * 2), g = uid(), n = frames().length + 1, col = '#8C7BFF';
  const nm = name || 'Frame ' + n; const r = { t: 'shape', k: 'rect', x, y, w, h, c: col, sw: 3 / Math.max(0.3, E.V.s), dash: true, frame: nm, fi: n, g, layer: 0 };
  const lb = { t: 'text', x, y: y - 40 / Math.max(0.3, E.V.s), w: 0, s: '▣ ' + nm, font: 'Lexend', size: Math.round(26 / Math.max(0.3, E.V.s)), b: true, c: col, frameLabel: 1, g, layer: 0 };
  E.add([r, lb]); snd('pop'); return r; }
function goFrame(f, quick) { if (!f) return; const pad = 0.04, s = clamp(Math.min(E.SW / (f.w * (1 + pad * 2)), E.SH / (f.h * (1 + pad * 2))), 0.1, 8), tx = E.SW / 2 - (f.x + f.w / 2) * s, ty = E.SH / 2 - (f.y + f.h / 2) * s, V = E.V;
  if (quick || REDUCE) { E.setView(s, tx, ty); return; } const s0 = V.s, x0 = V.x, y0 = V.y, t0 = performance.now(); const step = now => { const t = Math.min(1, (now - t0) / 420), k = 1 - Math.pow(1 - t, 3); E.setView(s0 + (s - s0) * k, x0 + (tx - x0) * k, y0 + (ty - y0) * k); if (t < 1) requestAnimationFrame(step); }; requestAnimationFrame(step); snd('whoosh'); }
let fCur = -1;
function frameNav() { const f = floatPanel('frames', 'Frames', '<div class="small muted">Name areas of the board, then jump between them — or step through them like slides.</div><div id="frL" style="max-height:300px;overflow:auto;margin:8px 0"></div><div class="row" style="gap:6px;flex-wrap:wrap"><button class="btn sm primary" id="frAdd">' + icon('plus') + 'Frame this view</button><button class="btn sm" id="frP">‹ Prev</button><button class="btn sm" id="frN">Next ›</button></div>', { icon: 'square-dashed-mouse-pointer', w: 330 }); const b = f.body;
  const draw = () => { const F = frames(); $('#frL', b).innerHTML = F.length ? F.map((o, i) => '<div class="st-stem' + (i === fCur ? '" style="border-color:var(--accent)' : '') + '"><span>' + (i + 1) + '. ' + esc(o.frame) + '</span><button class="ib" data-go="' + i + '" title="Go to this frame">' + icon('locate-fixed') + '</button><button class="ib" data-rn="' + i + '" title="Rename">' + icon('pencil') + '</button><button class="ib" data-rm="' + i + '" title="Delete frame">' + icon('trash-2') + '</button></div>').join('') : '<div class="small muted" style="padding:10px 0">No frames on this page yet. Move to an area of the board and press “Frame this view”.</div>';
    $$('[data-go]', b).forEach(x => x.onclick = () => { fCur = +x.dataset.go; goFrame(frames()[fCur]); draw(); });
    $$('[data-rn]', b).forEach(x => x.onclick = () => { const o = frames()[+x.dataset.rn]; askLine('Rename frame', 'Frame name', o.frame, v => { if (!v.trim()) return; const lb = E.page().objs.find(q => q.g === o.g && q.frameLabel); E.mod([o].concat(lb ? [lb] : []), q => { if (q.frame) q.frame = v.trim(); else q.s = '▣ ' + v.trim(); }); draw(); }); });
    $$('[data-rm]', b).forEach(x => x.onclick = () => { const o = frames()[+x.dataset.rm]; E.del(E.page().objs.filter(q => q.g === o.g)); draw(); }); };
  const step = d => { const F = frames(); if (!F.length) { toast('No frames yet.'); return; } fCur = (fCur + d + F.length) % F.length; goFrame(F[fCur]); draw(); };
  $('#frAdd', b).onclick = () => askLine('New frame', 'Frame name, e.g. Starter', 'Frame ' + (frames().length + 1), v => { addFrame(v.trim() || null); fCur = frames().length - 1; draw(); });
  $('#frP', b).onclick = () => step(-1); $('#frN', b).onclick = () => step(1); draw(); }

/* ---------- read aloud (as in Immersive Reader): selected text, or every text on the page ---------- */
function readAloud() { if (!window.speechSynthesis) { toast('Read aloud is not available in this browser.'); return; } if (speechSynthesis.speaking) { speechSynthesis.cancel(); toast('Stopped reading.'); return; }
  let src = I.selObjs().filter(o => (o.t === 'text' || o.t === 'note') && o.s); if (!src.length) src = E.page().objs.filter(o => (o.t === 'text' || o.t === 'note') && o.s && !o.ph && !o.cover).sort((a, b) => a.y - b.y || a.x - b.x);
  const txt = src.map(o => o.s).join('.\n').replace(/[•☐☑→▣]/g, ' ').trim(); if (!txt) { toast('There is no typed text to read. Handwriting can be turned into text first (Draw → Ink → text).', 4000); return; }
  const u = new SpeechSynthesisUtterance(txt), ar = window.HB.isRTL(txt); u.lang = ar ? 'ar-SA' : 'en-GB'; u.rate = set.get('readRate', 0.95); const v = speechSynthesis.getVoices().find(x => x.lang && x.lang.toLowerCase().startsWith(ar ? 'ar' : 'en')); if (v) u.voice = v;
  speechSynthesis.speak(u); toast('Reading aloud — press Read aloud again to stop.'); }

/* ---------- selected notes → a flashcard set ---------- */
function toCards() { const sel = I.selObjs().filter(o => (o.t === 'text' || o.t === 'note') && o.s && !o.ph); if (!sel.length) { I.setTool('select'); toast('Select the notes first — lines written as “term - definition” become cards; otherwise each note’s first line becomes the front.', 4600); return; }
  let cards = window.HBL.parseCards(sel.map(o => o.s).join('\n')); if (!cards.length) cards = sel.map(o => { const L = o.s.split('\n').map(x => x.replace(/^[•☐☑→\d.)\s]+/, '').trim()).filter(Boolean); return L.length > 1 ? [L[0], L.slice(1).join(' ')] : null; }).filter(Boolean);
  if (!cards.length) { toast('No cards found — write each line as “term - definition”.'); return; }
  askLine('Make flashcards', 'Set name', 'My notes — ' + new Date().toLocaleDateString(), n => { n = n.trim() || 'My notes'; window.HBL.saveCards(n, cards); toast('Made “' + esc(n) + '” — ' + cards.length + ' card' + (cards.length === 1 ? '' : 's') + '. Study it from the Study tab.', 4200); window.HBL.openCards(n); }); }

/* ---------- screen capture and annotate-over-everything ---------- */
async function screenCapture() { const D = window.helixDesktop; if (D && D.capture) { toast('Capturing the screen…'); const url = await D.capture(); if (url) { I.insertImage(url); toast('Screen picture added — write on it or crop it.'); } else toast('The screen could not be captured.'); return; }
  if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) { toast('Screen capture is not available in this browser.'); return; }
  let stream; try { stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false }); } catch (e) { toast('Screen capture was cancelled.'); return; }
  const v = document.createElement('video'); v.srcObject = stream; v.muted = true; await v.play().catch(() => {}); await new Promise(r => setTimeout(r, 300));
  const c = document.createElement('canvas'); c.width = v.videoWidth; c.height = v.videoHeight; c.getContext('2d').drawImage(v, 0, 0); stream.getTracks().forEach(t => t.stop());
  I.insertImage(c.toDataURL('image/png')); toast('Screen picture added to the board.'); }
function annotateScreen() { const D = window.helixDesktop; if (D && D.annotate) { D.annotate(); return; } modal.open('<h2>Annotate screen</h2><p>Write over any program — a video, a website, PowerPoint — then send a picture of it to the board.</p><p>This needs the <b>HelixBoard Windows app</b>. In the browser you can use <b>Screen capture</b> and write on the picture instead.</p><div class="foot"><button class="btn" data-close>OK</button><button class="btn primary" id="anCap">Screen capture</button></div>', s => { $('#anCap', s).onclick = () => { modal.close(); screenCapture(); }; }); }

const st = document.createElement('style'); st.textContent = 'body.nk-stamp #stage canvas{cursor:copy!important}'; document.head.appendChild(st);
window.HBNK = { screenCapture, annotateScreen, style, list, box, table, divider, section, highlighter, stamp, cover, revealAll, frameNav, addFrame, goFrame, readAloud, toCards, BOXES, STAMPS };
})();
