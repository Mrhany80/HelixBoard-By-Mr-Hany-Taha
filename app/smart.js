/* ================= HelixBoard — Smart templates: zones you type, write and drop notes into; frames that move, resize, grow, add parts, convert and export ================= */
(() => {
'use strict';
const { $, $$, uid, toast, modal, SND, icon, bus, set, esc, REDUCE } = window.HB;
const E = window.HBE, I = window.HBI, B = E.B, S = window.HBS;
const P = () => E.page().objs;
const members = g => P().filter(o => o.g === g);
const smartG = g => !!g && P().some(o => o.g === g && o.tpl && o.zone);
const bb = o => E.bbox(o);
const ctr = o => { const b = bb(o); return b ? [b[0] + b[2] / 2, b[1] + b[3] / 2] : [0, 0]; };
const inZone = (z, x, y) => { if (z.k === 'ellipse') { const rx = z.w / 2, ry = z.h / 2, dx = (x - z.x - rx) / rx, dy = (y - z.y - ry) / ry; return dx * dx + dy * dy <= 1; } return x >= z.x && x <= z.x + z.w && y >= z.y && y <= z.y + z.h; };
const area = z => z.w * z.h * (z.k === 'ellipse' ? 0.785 : 1);
/* the smallest zone under a point; locked zones are included only when asked */
function zoneAt(x, y, opt) { opt = opt || {}; let best = null; for (const o of P()) { if (!o.zone || o.off || (o.locked && !opt.locked) || (opt.g && o.g !== opt.g)) continue; if (inZone(o, x, y) && (!best || area(o) < area(best))) best = o; } return best; }
const anchor = o => (o.t === 'text' || o.t === 'note') && o.x != null ? [o.x + 8, o.y + 8] : ctr(o);
const zoneOfObj = o => { const c = anchor(o); return zoneAt(c[0], c[1], { locked: true, g: o.g }); };
const inner = z => z.in ? { x: z.x + z.w * z.in[0], y: z.y + z.h * z.in[1], w: z.w * z.in[2], h: z.h * z.in[3] } : z.k === 'ellipse' ? { x: z.x + z.w * 0.16, y: z.y + z.h * 0.22, w: z.w * 0.68, h: z.h * 0.56 } : { x: z.x + 18, y: z.y + 14, w: z.w - 36, h: z.h - 28 };
/* everything a person added inside a zone (not the template's own pieces) */
const contentOf = z => members(z.g).filter(o => !o.tpl && o.t !== 'conn' && zoneOfObj(o) === z);
const ownOf = z => members(z.g).filter(o => o.tpl && !o.zone && o.t !== 'conn' && zoneOfObj(o) === z);
function nextY(z) { const r = inner(z); let y = r.y; ownOf(z).forEach(o => { if (o.ph || o.t !== 'text' || o.ttl) return; const b = bb(o); y = Math.max(y, b[1] + b[3] + 6); }); contentOf(z).forEach(o => { const b = bb(o); if (b) y = Math.max(y, b[1] + b[3] + 8); }); return y; }

/* ---------- placeholders hide as soon as a zone has something in it, and come back when it is cleared ---------- */
function refreshPH() { let ch = false; const P0 = P(); const gs = new Set(P0.filter(o => o.tpl && o.zone).map(o => o.g)); gs.forEach(g => { const zs = members(g).filter(o => o.zone); const used = new Set(); members(g).forEach(o => { if (o.tpl || o.t === 'conn') return; const z = zoneOfObj(o); if (z) used.add(z.id); }); members(g).forEach(o => { if (!o.ph) return; const z = zoneOfObj(Object.assign({}, o, { off: 0 })); const want = z && used.has(z.id) ? 1 : 0; if ((o.off || 0) !== want) { if (want) o.off = 1; else delete o.off; ch = true; } }); });
  if (ch) { E.dirty.main = true; } }
let phT = 0; const phSoon = () => { clearTimeout(phT); phT = setTimeout(() => { refreshPH(); place(); }, 30); };
bus.on('changed', phSoon); bus.on('page', phSoon); bus.on('board-loaded', phSoon);

/* ---------- anything drawn, typed, pasted or dropped inside a zone joins that template ---------- */
E.addHooks.push(o => { if (o.g || o.tpl || o.t === 'conn' || o.layer === 0) return; if (!['stroke', 'text', 'note', 'img', 'stamp', 'shape', 'wid', 'pin'].includes(o.t)) return; const c = anchor(o); const z = zoneAt(c[0], c[1], { locked: true }); if (z) o.g = z.g; });

/* ---------- growing: a zone stretches to fit what is in it, and the rest of the template makes room ---------- */
const TOL = 12;
function reflow(z, dw, dh, live) { if (!dw && !dh) return; const g = z.g, zr = z.x + z.w, zb = z.y + z.h; const ins = new Set([...contentOf(z), ...ownOf(z)].map(o => o.id)); const all = members(g).filter(o => o.t !== 'conn');
  const fn = o => { if (o === z) { o.w += dw; o.h += dh; return; } if (ins.has(o.id)) { if (o.t === 'text' && o.w > 0) o.w += dw; return; }
    if (o.t === 'shape' && o.line) { const L = o.line; [0, 2].forEach(k => { if (L[k + 1] >= zb - TOL) L[k + 1] += dh; if (L[k] >= zr - TOL) L[k] += dw; }); return; }
    const b = bb(o); if (!b) return; const top = b[1], bot = b[1] + b[3], lef = b[0], rig = b[0] + b[2];
    let mx = 0, my = 0; if (top >= zb - TOL) my = dh; if (lef >= zr - TOL) mx = dw;
    if (o.t === 'stroke') { if (mx || my) for (let i = 0; i < o.pts.length; i += 3) { o.pts[i] += mx; o.pts[i + 1] += my; } return; }
    if (o.x != null) { o.x += mx; o.y += my; }
    if (o.t === 'shape' && o.h != null) { const holdsZ = lef <= z.x + 2 && rig >= zr - 2 && top <= z.y + 2; if (!my && bot >= zb - TOL && (Math.abs(bot - zb) <= TOL || holdsZ)) o.h += dh; if (!mx && rig >= zr - TOL && (Math.abs(rig - zr) <= TOL || (top <= z.y + 2 && bot >= zb - 2 && lef <= z.x + 2))) o.w += dw; } };
  if (live) { all.forEach(o => { fn(o); E.invalidate(o); }); } else E.mod(all, fn); E.grow && E.grow(); E.dirty.main = true; }
function fit(z) { if (!z) return; const cs = contentOf(z); if (!cs.length) return; let bot = 0; cs.forEach(o => { const b = bb(o); if (b) bot = Math.max(bot, b[1] + b[3]); }); const need = bot + (z.k === 'ellipse' ? z.h * 0.18 : 18) - (z.y + z.h); if (need > 2) { reflow(z, 0, Math.ceil(need)); SND.tone && SND.tone(660, 880, 0.06, 'sine', 0.025, 0, 'ui'); } }

/* typing position for the Text tool and taps */
function textPlace(x, y) { const z = zoneAt(x, y, { locked: true }); if (!z) return null; active = z; if (z.typ) { typeIn(z); return { typed: true }; } return { block: true }; } /* typeable zones (tables, callout boxes) take typing; the other note templates are for handwriting */ /* handwriting only inside note templates */
function typeIn(z) { if (!z) return; active = z; const r = inner(z); window.HB.loadFont(I.T.font); I.openEditor({ t: 'text', x: r.x, y: nextY(z), w: Math.max(80, r.w), s: '', font: I.T.font, size: set.get('tplFs', 28), c: I.T.color, b: I.T.bold, i: I.T.italic }, true); place(); }
function zoneHit(x, y) { const z = zoneAt(x, y); return z && !z.locked ? z : null; }
function dbl(x, y, o) { if (o && !o.ph && !o.zone && o.t !== 'shape') return false; const z = zoneAt(x, y, { locked: true }); if (z && z.typ) typeIn(z); return !!z; }

bus.on('obj-tap', ({ o, drill, x, y }) => { if (!o || !smartG(o.g) || I.editing) return; const z = zoneAt(x, y, { g: o.g, locked: true }); if (z) active = z;
  if ((o.zone || o.ph) && z) { place(); return; } /* tapping a box selects the template; answers are handwritten */
  if (drill) { if (!o.tpl || (o.t === 'text' && !o.ttl)) { I.select(o, false, true); } } place(); });
bus.on('text-done', o => { if (!o || !o.g || !smartG(o.g)) return; const z = zoneOfObj(o); if (o.t === 'note' && z) arrange(z); fit(z); phSoon(); });
bus.on('stroke-added', o => { if (o && o.g && smartG(o.g)) { setTimeout(() => fit(zoneOfObj(o)), 0); } });
bus.on('moved', ({ objs, mode }) => { if (mode !== 'move' || !objs.length) return; const g0 = objs[0].g; if (g0 && smartG(g0) && objs.every(o => o.g === g0) && objs.length === members(g0).length) return; /* whole template moved */
  objs.forEach(o => { if (o.tpl) return; const c = anchor(o); const z = zoneAt(c[0], c[1], { locked: true }); if (z) { o.g = z.g; if (o.t === 'note') arrange(z); else fit(z); } else if (o.g && smartG(o.g)) delete o.g; }); phSoon(); });

/* sticky notes dropped into a zone line up neatly */
function arrange(z) { const notes = contentOf(z).filter(o => o.t === 'note').sort((a, b) => a.y - b.y || a.x - b.x); if (!notes.length) return; const r = inner(z); let top = r.y; ownOf(z).forEach(o => { if (o.t === 'text' && !o.ph) { const b = bb(o); top = Math.max(top, b[1] + b[3] + 8); } }); let x = r.x, y = top, rowH = 0; const gap = 14;
  E.mod(notes, n => { if (x > r.x && x + n.w > r.x + r.w) { x = r.x; y += rowH + gap; rowH = 0; } n.x = x; n.y = y; x += n.w + gap; rowH = Math.max(rowH, n.h); }); fit(z); }

/* ---------- the floating bar and zone chip ---------- */
let active = null, ui = null, bar = null, chip = null, grip = null, lockChip = null;
function css() { if ($('#smartCss')) return; const s = document.createElement('style'); s.id = 'smartCss'; s.textContent = `
#smartUI{position:absolute;inset:0;pointer-events:none;z-index:6}
#smartUI .sbar{position:absolute;display:flex;gap:3px;align-items:center;padding:5px;border-radius:14px;background:linear-gradient(135deg,rgba(40,16,48,.94),rgba(22,10,30,.96));border:1px solid rgba(255,120,190,.4);box-shadow:0 10px 30px rgba(0,0,0,.35),0 0 22px rgba(255,80,160,.25);pointer-events:auto;white-space:nowrap;transform:translate(-50%,-100%)}
#smartUI .sbar button{display:flex;align-items:center;gap:5px;border:0;background:transparent;color:#FBE9F3;font:600 12.5px var(--ui);padding:7px 9px;border-radius:10px;cursor:pointer}
#smartUI .sbar button:hover{background:rgba(255,255,255,.12)} #smartUI .sbar button svg{width:16px;height:16px} #smartUI .sbar .sep{width:1px;height:22px;background:rgba(255,255,255,.18);margin:0 2px}
#smartUI .sbar button.on{background:#FF4FA0;color:#fff}
#smartUI .zchip{position:absolute;display:flex;gap:2px;padding:3px;border-radius:11px;background:rgba(20,10,28,.86);border:1px solid rgba(116,192,252,.5);box-shadow:0 0 16px rgba(77,171,247,.35);pointer-events:auto;transform:translate(-100%,0)}
#smartUI .zchip button{border:0;background:transparent;color:#EAF6FF;width:30px;height:30px;border-radius:8px;display:grid;place-items:center;cursor:pointer} #smartUI .zchip button:hover{background:rgba(255,255,255,.14)} #smartUI .zchip svg{width:16px;height:16px}
#smartUI .zgrip{position:absolute;width:26px;height:26px;margin:-13px 0 0 -13px;border-radius:50%;background:#4DABF7;border:3px solid #fff;box-shadow:0 0 0 4px rgba(77,171,247,.35),0 4px 12px rgba(0,0,0,.3);pointer-events:auto;cursor:nwse-resize;touch-action:none}
#smartUI .zghost{position:absolute;border:2px dashed #4DABF7;border-radius:12px;background:rgba(77,171,247,.08);pointer-events:none}
#smartUI .zact{position:absolute;border:2px solid rgba(77,171,247,.75);border-radius:12px;box-shadow:0 0 0 4px rgba(77,171,247,.15);pointer-events:none}
.spot{position:fixed;left:50%;top:70px;transform:translateX(-50%);z-index:70;display:flex;gap:6px;align-items:center;padding:8px 10px;border-radius:999px;background:linear-gradient(135deg,#2A0F33,#14081C);color:#fff;border:1px solid rgba(255,120,190,.5);box-shadow:0 0 30px rgba(255,80,160,.35)}
.spot b{font:800 20px var(--mono);min-width:70px;text-align:center;color:#FFC9DE}.spot button{border:0;border-radius:999px;padding:7px 12px;font:700 13px var(--ui);cursor:pointer;background:rgba(255,255,255,.12);color:#fff}.spot button.p{background:#FF4FA0}
`; document.head.appendChild(s); }
function mk() { if (ui) return; css(); const st = $('#stage'); ui = document.createElement('div'); ui.id = 'smartUI'; st.appendChild(ui);
  bar = document.createElement('div'); bar.className = 'sbar'; bar.hidden = true; ui.appendChild(bar);
  chip = document.createElement('div'); chip.className = 'zchip'; chip.hidden = true; ui.appendChild(chip);
  grip = document.createElement('div'); grip.className = 'zgrip'; grip.hidden = true; grip.title = 'Drag to resize this box'; ui.appendChild(grip);
  const act = document.createElement('div'); act.className = 'zact'; act.hidden = true; ui.appendChild(act); ui._act = act;
  [bar, chip, grip].forEach(el => ['pointerdown', 'pointerup', 'click', 'dblclick'].forEach(ev => el.addEventListener(ev, e => e.stopPropagation())));
  gripDrag(); }
const btn = (ic, label, fn, cls) => { const b = document.createElement('button'); b.innerHTML = icon(ic) + (label ? '<span>' + label + '</span>' : ''); b.title = label || ''; if (cls) b.className = cls; b.onclick = e => { e.preventDefault(); fn(e); }; return b; };
const sep = () => { const d = document.createElement('i'); d.className = 'sep'; return d; };
function selG() { const s = I.selObjs(); if (!s.length) return null; const g = s[0].g; if (!g || !smartG(g)) return null; if (!s.every(o => o.g === g)) return null; if (s.length < members(g).filter(o => !o.locked).length) return null; return g; }
const toScr = (x, y) => E.toS(x, y);
function place() { mk(); const g = selG(); if (!g || I.editing) { bar.hidden = chip.hidden = grip.hidden = ui._act.hidden = true; return; }
  const b = I.selBox(); if (!b) return; const [sx, sy] = toScr(b[0] + b[2] / 2, b[1]); const keyT = members(g).find(o => o.tpl).tpl; const locked = members(g).some(o => o.locked);
  if (bar._g !== g || bar._k !== keyT + locked) { bar._g = g; bar._k = keyT + locked; bar.innerHTML = ''; const fam = family(keyT);
    bar.append(btn('plus', 'Add part', () => addPart(g)), btn('palette', 'Colours', () => recolour(g)), sep(), btn('maximize', 'Fit screen', () => fitScreen(g, 'fit')), btn('maximize-2', 'Fill screen', () => fitScreen(g, 'fill')), btn('pen-line', 'Write', () => { I.clearSel(); I.setTool('draw', I.T.pen === 'hi' ? 'pen' : I.T.pen); }), sep(), btn('focus', 'Spotlight', () => spotlight(active && active.g === g ? active : null, g)), sep());
    if (fam) bar.append(btn('repeat', 'Convert', () => convertMenu(g, keyT, fam)));
    bar.append(btn('list-tree', 'Export', () => exportAnswers(g)), btn('copy-plus', 'Blank copy', () => blankCopy(g)), btn('eraser', 'Clear', () => clearAnswers(g)), sep(), btn(locked ? 'lock-open' : 'lock', locked ? 'Unlock' : 'Lock', () => toggleLock(g))); }
  bar.hidden = false; bar.style.left = Math.max(200, Math.min(E.SW - 200, sx)) + 'px'; const sy2 = toScr(0, b[1] + b[3])[1]; if (sy - 14 > 110) { bar.style.top = (sy - 14) + 'px'; bar.style.transform = ''; } else if (sy2 + 70 < E.SH - 100) { bar.style.top = (sy2 + 14) + 'px'; bar.style.transform = 'translate(-50%,0)'; } else { bar.style.top = '64px'; bar.style.transform = 'translate(-50%,0)'; }
  const z = active && active.g === g && P().includes(active) ? active : null;
  if (!z) { chip.hidden = grip.hidden = ui._act.hidden = true; return; }
  const [x1, y1] = toScr(z.x, z.y), [x2, y2] = toScr(z.x + z.w, z.y + z.h);
  const A = ui._act; A.hidden = false; A.style.left = x1 + 'px'; A.style.top = y1 + 'px'; A.style.width = (x2 - x1) + 'px'; A.style.height = (y2 - y1) + 'px'; A.style.borderRadius = z.k === 'ellipse' ? '50%' : '12px';
  if (chip._z !== z.id) { chip._z = z.id; chip.innerHTML = ''; chip.append(btn('pen-line', '', () => { I.clearSel(); I.setTool('draw', I.T.pen === 'hi' ? 'pen' : I.T.pen); }), btn('focus', '', () => spotlight(z, g)), btn('trash-2', '', () => removePart(z))); [...chip.children].forEach((c, i) => c.title = ['Write in this box with the pen', 'Spotlight this box', 'Remove this part'][i]); }
  chip.hidden = false; chip.style.left = (x2 - 6) + 'px'; chip.style.top = (y1 + 6) + 'px';
  grip.hidden = !!z.locked; grip.style.left = x2 + 'px'; grip.style.top = y2 + 'px'; grip._z = z; }
['selection', 'selection-clear', 'view', 'page', 'editing'].forEach(ev => bus.on(ev, () => requestAnimationFrame(place)));
bus.on('changed', () => requestAnimationFrame(place));
/* hovering a zone of the selected template makes it the active one */
setTimeout(() => { const st = $('#stage'); if (!st) return; mk();
  st.addEventListener('pointermove', e => { if (e.buttons || I.T.tool !== 'select') return; const g = selG(); if (!g) return; const p = E.toB(e.clientX, e.clientY); const z = zoneAt(p[0], p[1], { g, locked: true }); if (z && z !== active) { active = z; place(); } });
  st.addEventListener('pointerdown', e => { if (e.target.closest && e.target.closest('#smartUI')) return; bar.hidden = chip.hidden = grip.hidden = true; if (lockChip) { lockChip.remove(); lockChip = null; } }, true);
  st.addEventListener('pointerup', e => { if (e.target.closest && e.target.closest('#smartUI')) return; setTimeout(() => { place(); if (I.T.tool !== 'select' || I.selObjs().length) return; const r = st.getBoundingClientRect(), p = E.toB(e.clientX, e.clientY); const z = zoneAt(p[0], p[1], { locked: true }); if (z && z.locked) showLockChip(z, e.clientX - r.left, e.clientY - r.top); }, 30); }, true); }, 0);
function showLockChip(z, x, y) { if (lockChip) lockChip.remove(); lockChip = document.createElement('div'); lockChip.className = 'sbar'; lockChip.style.left = x + 'px'; lockChip.style.top = (y - 10) + 'px'; lockChip.append(btn('lock', 'Locked template', () => {}), btn('type', 'Type here', () => { lockChip.remove(); lockChip = null; typeIn(z); }), btn('lock-open', 'Unlock', () => { lockChip.remove(); lockChip = null; toggleLock(z.g); I.select(members(z.g)); })); ['pointerdown', 'pointerup', 'click'].forEach(ev => lockChip.addEventListener(ev, e => e.stopPropagation())); ui.appendChild(lockChip); }

/* drag the round handle to make one box bigger; the template makes room */
function gripDrag() { let st = null, ghost = null;
  grip.addEventListener('pointerdown', e => { const z = grip._z; if (!z) return; e.preventDefault(); grip.setPointerCapture(e.pointerId); st = { z, x0: e.clientX, y0: e.clientY }; ghost = document.createElement('div'); ghost.className = 'zghost'; ui.appendChild(ghost); upd(e); });
  const upd = e => { if (!st) return; const z = st.z, s = E.V.s; const dw = (e.clientX - st.x0) / s, dh = (e.clientY - st.y0) / s; st.dw = Math.max(-z.w + 120, dw); st.dh = Math.max(-z.h + 60, dh); const [x1, y1] = toScr(z.x, z.y); ghost.style.left = x1 + 'px'; ghost.style.top = y1 + 'px'; ghost.style.width = (z.w + st.dw) * s + 'px'; ghost.style.height = (z.h + st.dh) * s + 'px'; grip.style.left = (x1 + (z.w + st.dw) * s) + 'px'; grip.style.top = (y1 + (z.h + st.dh) * s) + 'px'; };
  grip.addEventListener('pointermove', upd);
  const end = () => { if (!st) return; const { z, dw, dh } = st; st = null; ghost && ghost.remove(); ghost = null; if (Math.abs(dw || 0) > 2 || Math.abs(dh || 0) > 2) { E.tx(() => reflow(z, Math.round(dw || 0), Math.round(dh || 0))); E.changed(); SND.pop(); } place(); };
  grip.addEventListener('pointerup', end); grip.addEventListener('pointercancel', end); }

/* ---------- actions ---------- */
/* text size for a template: changes every answer (and the size used for new typing) */
function textSize(g, dir) { const txt = members(g).filter(o => o.t === 'text' && !o.tpl); const cur = set.get('tplFs', 28); const steps = [16, 20, 24, 28, 34, 40, 48, 60, 72]; let i = steps.findIndex(v => v >= cur); if (i < 0) i = steps.length - 1; const nv = steps[Math.max(0, Math.min(steps.length - 1, i + dir))]; set.put('tplFs', nv);
  if (txt.length) { E.mod(txt, o => { o.size = Math.max(10, Math.round(o.size * nv / cur)); }); members(g).filter(o => o.zone).forEach(z => fit(z)); } toast('Text size ' + nv + ' px' + (txt.length ? ' — answers resized' : ' — for new typing')); SND.pop(); }
function stickyIn(z) { active = z; const r = inner(z); const cols = ['#FFF3BF', '#D3F9D8', '#D0EBFF', '#FFDEEB', '#E5DBFF']; const n = contentOf(z).filter(o => o.t === 'note').length; I.openEditor({ t: 'note', x: r.x, y: nextY(z), w: Math.min(230, r.w), h: 170, s: '', c: cols[n % cols.length], font: 'Caveat', size: 30 }, true); }
function inkText(g, z) { const strokes = members(g).filter(o => o.t === 'stroke' && !o.tpl && (!z || zoneOfObj(o) === z)); if (!strokes.length) { toast(z ? 'Write in this box with the pen first.' : 'Write in the template with the pen first.'); return; } I.setTool('select'); I.select(strokes, false, true); if (window.HBR) HBR.inkToText(); }
function clearAnswers(g) { const c = members(g).filter(o => !o.tpl && o.t !== 'conn'); if (!c.length) { toast('Nothing to clear yet.'); return; } modal.open('<h2>Clear all answers?</h2><p>Removes the ' + c.length + ' thing' + (c.length > 1 ? 's' : '') + ' written, typed or stuck in this template. The template itself stays. You can undo this.</p><div class="foot"><button class="btn" id="caN">Cancel</button><button class="btn primary" id="caY">Clear answers</button></div>', s => { $('#caN', s).onclick = () => modal.close(); $('#caY', s).onclick = () => { modal.close(); E.del(c); I.select(members(g)); SND.pop(); toast('Cleared — ready for the next class.'); }; }); }
function toggleLock(g) { const own = members(g).filter(o => o.tpl); const on = !own.some(o => o.locked); E.mod(own, o => { if (on) o.locked = true; else delete o.locked; }); if (on) { I.clearSel(); toast('Template locked: students can write and type in it, but it will not move.'); } else { I.select(members(g)); toast('Template unlocked.'); } bar._k = null; place(); }
const THEMES = [['Pastel', (z, i) => ({ fill: E.isDark() ? 'rgba(255,255,255,.06)' : ['#D0EBFF', '#D3F9D8', '#FFF3BF', '#FFE3E3', '#E5DBFF', '#FFE8CC', '#C3FAE8', '#FFDEEB'][i % 8], c: E.isDark() ? '#FFFFFF' : '#1E1419' })],
  ['Bold', (z, i) => { const c = ['#1C7ED6', '#2B8A3E', '#E67700', '#E03131', '#7048E8', '#E8590C', '#0C8599', '#C2255C'][i % 8]; return { fill: c + '22', c }; }],
  ['Clean', () => ({ fill: null, c: E.isDark() ? '#FFFFFF' : '#1E1419' })],
  ['Glow', (z, i) => { const c = ['#4DABF7', '#69DB7C', '#FFD43B', '#FF8787', '#B197FC', '#FFA94D', '#38D9A9', '#F783AC'][i % 8]; return { fill: 'rgba(20,10,30,.55)', c }; }]];
function recolour(g) { const zs = members(g).filter(o => o.zone && !o.vz && o.t === 'shape').sort((a, b) => a.zi - b.zi); if (!zs.length) { toast('This template has no coloured boxes.'); return; } const k = ((members(g)[0].th || 0) + 1) % THEMES.length; const [name, f] = THEMES[k]; E.tx(() => { E.mod(zs, (z) => { const v = f(z, zs.indexOf(z)); z.fill = v.fill; z.c = v.c; }); E.mod(members(g)[0], o => o.th = k); }); toast('Colours: ' + name); SND.pop(); }

/* add a part: copies the last repeating part (stage, branch, bubble, row…) and wires it in */
const RADIAL = { bubble: 1, mindmap: 1, cycle: 1 };
function addPart(g) { const M = members(g), key = M.find(o => o.tpl).tpl; const us = [...new Set(M.filter(o => o.pu).map(o => o.pu))].sort((a, b) => a - b);
  if (!us.length) { const zs = M.filter(o => o.zone).sort((a, b) => a.zi - b.zi); const z = zs[zs.length - 1]; if (!z) return; toast('This template has fixed parts — drag the round handle on a box to make it bigger.'); active = z; place(); return; }
  const lu = us[us.length - 1], pu = us.length > 1 ? us[us.length - 2] : null; const last = M.filter(o => o.pu === lu && o.t !== 'conn'), prev = pu ? M.filter(o => o.pu === pu && o.t !== 'conn') : null;
  const zl = last.filter(o => o.zone).sort((a, b) => a.zi - b.zi)[0], zp = prev && prev.filter(o => o.zone).sort((a, b) => a.zi - b.zi)[0];
  let dx = 0, dy = 0; if (zl && zp) { dx = zl.x - zp.x; dy = zl.y - zp.y; } if (!dx && !dy) { const b = groupBox(last); dy = b[3] + 24; }
  const nu = lu + 1 + Math.max(0, ...M.map(o => o.pu || 0)) - lu, zi0 = Math.max(0, ...M.map(o => o.zi || 0)) + 1, map = {}; let zk = 0;
  const clones = last.map(o => { const c = JSON.parse(JSON.stringify(E.clean(o))); c.id = uid(); map[o.id] = c.id; c.pu = nu; delete c.off; delete c.locked; if (c.zone) c.zi = zi0 + zk++; if (c.t === 'text' && !c.ph && /\d+/.test(c.s)) c.s = c.s.replace(/(\d+)(?!.*\d)/, m => String(+m + 1)); move(c, dx, dy); return c; });
  const conns = M.filter(o => o.t === 'conn'), inU = (id, u) => M.some(o => o.id === id && o.pu === u), extra = [];
  const zNew = clones.find(c => c.zone), zLast = zl;
  conns.forEach(c => { const a = M.find(o => o.id === c.a), b = M.find(o => o.id === c.b); if (!a || !b) return;
    if (pu && a.pu === pu && b.pu === lu) extra.push(Object.assign({}, E.clean(c), { id: uid(), a: map[b.id] ? b.id : b.id, b: map[b.id] }));
    else if (!a.pu && b.pu === lu) extra.push(Object.assign({}, E.clean(c), { id: uid(), b: map[b.id] }));
    else if (a.pu === lu && !b.pu) extra.push(Object.assign({}, E.clean(c), { id: uid(), a: map[a.id] })); });
  E.tx(() => { if (key === 'cycle') { const wrap = conns.find(c => inU(c.a, lu) && inU(c.b, us[0])); if (wrap) E.mod(wrap, w => w.a = zNew.id); }
    clones.forEach(c => c.g = g); E.add(clones.concat(extra), 1);
    if (RADIAL[key]) relayout(g, key); else makeRoom(g, clones); });
  active = P().find(o => o.id === (zNew && zNew.id)) || active; I.select(members(g)); SND.pop(); toast('Part added — tap it to type.'); }
function move(o, dx, dy) { if (o.t === 'stroke') { for (let i = 0; i < o.pts.length; i += 3) { o.pts[i] += dx; o.pts[i + 1] += dy; } return; } if (o.line) { o.line[0] += dx; o.line[2] += dx; o.line[1] += dy; o.line[3] += dy; return; } if (o.x != null) { o.x += dx; o.y += dy; } }
/* fit a template to the visible board: 'fit' keeps its shape, 'fill' stretches it to use the whole screen */
function fitScreen(g, mode, quiet) { const M = members(g).filter(o => o.t !== 'conn'); if (!M.length) return; const vr = E.viewRect(), s = E.V.s; const ml = 50 / s, mr = 60 / s, mt = (B.mode === 'scroll' ? 110 : 90) / s, mb = 120 / s;
  const T = [vr[0] + ml, vr[1] + mt, Math.max(200, vr[2] - ml - mr), Math.max(200, vr[3] - mt - mb)]; if (B.mode === 'scroll') { T[0] = Math.max(T[0], 40); T[2] = Math.min(T[2], B.width - 80 - (T[0] - 40)); }
  const bb = groupBox(M); if (!bb[2] || !bb[3]) return; let sx = T[2] / bb[2], sy = T[3] / bb[3]; if (mode === 'fit') { sx = sy = Math.min(sx, sy); } const k = Math.min(sx, sy);
  const ox = T[0] + (T[2] - bb[2] * sx) / 2, oy = T[1] + (mode === 'fit' ? 0 : (T[3] - bb[3] * sy) / 2); const X = x => ox + (x - bb[0]) * sx, Y = y => oy + (y - bb[1]) * sy;
  E.mod(M, o => { if (o.t === 'stroke') { for (let i = 0; i < o.pts.length; i += 3) { o.pts[i] = X(o.pts[i]); o.pts[i + 1] = Y(o.pts[i + 1]); } o.w = Math.max(0.5, o.w * Math.sqrt(sx * sy)); return; }
    if (o.line) { o.line = [X(o.line[0]), Y(o.line[1]), X(o.line[2]), Y(o.line[3])]; if (o.cp) o.cp = [X(o.cp[0]), Y(o.cp[1])]; if (o.sw) o.sw = Math.max(1, o.sw * Math.sqrt(k)); return; }
    if (o.t === 'pin') { o.x = X(o.x); o.y = Y(o.y); o.lx = X(o.lx); o.ly = Y(o.ly); return; }
    if (o.t === 'text') { o.x = X(o.x); o.y = Y(o.y); if (o.w > 0) o.w *= sx; o.size = Math.max(10, o.size * k); return; }
    if (o.x != null) { o.x = X(o.x); o.y = Y(o.y); if (o.w != null) o.w *= sx; if (o.h != null) o.h *= sy; if (o.sw) o.sw = Math.max(1, o.sw * Math.sqrt(k)); } });
  E.grow && E.grow(); E.dirty.main = true; place(); if (!quiet) { SND.pop(); toast(mode === 'fit' ? 'Template fitted to the screen.' : 'Template stretched to fill the screen.'); } }
function groupBox(objs) { let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9; objs.forEach(o => { const b = o.t === 'conn' ? null : (E.invalidate(o), bb(o)); if (!b) return; x0 = Math.min(x0, b[0]); y0 = Math.min(y0, b[1]); x1 = Math.max(x1, b[0] + b[2]); y1 = Math.max(y1, b[1] + b[3]); }); return [x0, y0, x1 - x0, y1 - y0]; }
/* if a new part lands on top of other parts, push them down */
function makeRoom(g, clones) { const nb = groupBox(clones), ids = new Set(clones.map(c => c.id)); const hit = members(g).filter(o => !ids.has(o.id) && o.t !== 'conn' && !o.ttl && (() => { const b = bb(o); return b && b[0] < nb[0] + nb[2] - 4 && b[0] + b[2] > nb[0] + 4 && b[1] < nb[1] + nb[3] - 4 && b[1] + b[3] > nb[1] + 4 && !(b[0] <= nb[0] && b[0] + b[2] >= nb[0] + nb[2] && b[1] <= nb[1] && b[1] + b[3] >= nb[1] + nb[3]); })());
  if (!hit.length) return; const top = Math.min(...hit.map(o => bb(o)[1])); const d = nb[1] + nb[3] + 24 - top; const below = members(g).filter(o => !ids.has(o.id) && o.t !== 'conn' && bb(o) && bb(o)[1] >= top - 2); E.mod(below, o => move(o, 0, d)); }
/* bubble map, mind map and cycle: spread all parts evenly around the centre again */
function relayout(g, key) { const M = members(g), us = [...new Set(M.filter(o => o.pu).map(o => o.pu))].sort((a, b) => a - b), n = us.length; const hub = M.find(o => o.role === 'hub');
  const units = us.map(u => M.filter(o => o.pu === u && o.t !== 'conn')); const cs = units.map(objs => { const z = objs.find(o => o.zone) || objs[0]; return [z.x + z.w / 2, z.y + z.h / 2]; });
  const c = hub ? [hub.x + hub.w / 2, hub.y + hub.h / 2] : (() => { const all = M.filter(o => o.t === 'text' && !o.pu && !o.ttl)[0]; if (all) { const b = bb(all); return [b[0] + b[2] / 2, b[1] + b[3] / 2]; } return [cs.reduce((a, p) => a + p[0], 0) / n, cs.reduce((a, p) => a + p[1], 0) / n]; })();
  let rx = 0, ry = 0; cs.forEach(p => { rx = Math.max(rx, Math.abs(p[0] - c[0])); ry = Math.max(ry, Math.abs(p[1] - c[1])); }); rx = Math.max(rx, 260) * (n > 8 ? 1.12 : 1); ry = Math.max(ry, 200) * (n > 8 ? 1.12 : 1);
  const off = key === 'mindmap' ? Math.PI / n : 0; const all = []; const moves = new Map();
  units.forEach((objs, i) => { const a = -Math.PI / 2 + off + i * 2 * Math.PI / n; const tx = c[0] + Math.cos(a) * rx, ty = c[1] + Math.sin(a) * ry; const d = [tx - cs[i][0], ty - cs[i][1]]; objs.forEach(o => { all.push(o); moves.set(o.id, d); }); });
  E.mod(all, o => { const d = moves.get(o.id); move(o, d[0], d[1]); }); }
function removePart(z) { const g = z.g, M = members(g), key = M.find(o => o.tpl).tpl; const gone = z.pu ? M.filter(o => o.pu === z.pu) : [z, ...ownOf(z)]; const content = gone.filter(o => o.zone).flatMap(zz => contentOf(zz)); const ids = new Set(gone.map(o => o.id));
  if (gone.filter(o => o.zone).length >= M.filter(o => o.zone).length) { toast('That is the last part — use Delete to remove the whole template.'); return; }
  const doIt = () => { E.tx(() => { const conns = M.filter(o => o.t === 'conn' && (ids.has(o.a) || ids.has(o.b))); if (key === 'cycle') { const inC = conns.find(c => ids.has(c.b)), outC = conns.find(c => ids.has(c.a)); if (inC && outC) { E.mod(inC, c => c.b = outC.b); conns.splice(conns.indexOf(inC), 1); } } E.del([...gone, ...content, ...conns]); if (RADIAL[key]) relayout(g, key); }); active = null; I.select(members(g)); SND.pop(); };
  if (content.length) modal.open('<h2>Remove this part?</h2><p>It has ' + content.length + ' answer' + (content.length > 1 ? 's' : '') + ' in it, which will be removed too. You can undo this.</p><div class="foot"><button class="btn" id="rpN">Cancel</button><button class="btn primary" id="rpY">Remove</button></div>', s => { $('#rpN', s).onclick = () => modal.close(); $('#rpY', s).onclick = () => { modal.close(); doIt(); }; }); else doIt(); }

/* ---------- spotlight one box full screen, with an optional timer ---------- */
let spot = null;
function spotlight(z, g) { const b = z ? [z.x, z.y, z.w, z.h] : groupBox(members(g)); const V = E.V, from = { s: V.s, x: V.x, y: V.y }; const s = Math.min(E.SW * 0.86 / b[2], (E.SH - 120) * 0.84 / b[3], 4); const to = { s, x: E.SW / 2 - (b[0] + b[2] / 2) * s, y: (E.SH + 60) / 2 - (b[1] + b[3] / 2) * s };
  const go = (a, c, done) => { if (window.gsap && !REDUCE) { const o = Object.assign({}, a); gsap.to(o, Object.assign({}, c, { duration: 0.6, ease: 'power3.inOut', onUpdate: () => E.setView(o.s, o.x, o.y), onComplete: done })); } else { E.setView(c.s, c.x, c.y); done && done(); } };
  if (spot) spot.end(true); I.clearSel(); go(from, to); SND.page && SND.page();
  const el = document.createElement('div'); el.className = 'spot'; el.innerHTML = '<span style="font:700 13px var(--ui);padding:0 6px">' + icon('focus') + ' Spotlight</span><button data-m="1">1 min</button><button data-m="2">2 min</button><button data-m="3">3 min</button><b id="spT">--:--</b><button class="p" id="spX">← Back</button>'; document.body.appendChild(el);
  let iv = 0; const end = quick => { clearInterval(iv); el.remove(); spot = null; if (!quick) go({ s: E.V.s, x: E.V.x, y: E.V.y }, from); };
  $$('[data-m]', el).forEach(bn => bn.onclick = () => { clearInterval(iv); let left = +bn.dataset.m * 60; const T = $('#spT', el); const tick = () => { T.textContent = String(Math.floor(left / 60)).padStart(2, '0') + ':' + String(left % 60).padStart(2, '0'); if (left <= 0) { clearInterval(iv); SND.chime && SND.chime(); T.textContent = 'Time!'; } left--; }; tick(); iv = setInterval(tick, 1000); });
  $('#spX', el).onclick = () => end(); spot = { end }; }
document.addEventListener('keydown', e => { if (e.key === 'Escape' && spot) spot.end(); });

/* ---------- convert between templates, keeping the answers ---------- */
const FAM = { two: ['tchart', 'compare', 'venn', 'doublebubble'], three: ['kwl', 'poe', 'stw', 'tps'] };
const family = k => Object.values(FAM).find(f => f.includes(k)) || null;
const ROLEMAP = { ta: 'a', tb: 'b', q: 'c1' };
function convertMenu(g, key, fam) { const NN = S.NOTES; modal.open('<h2>Convert template</h2><p>Your answers move into the new layout. Example: list ideas in a T-chart, then turn it into a Venn diagram to sort what is shared.</p><div class="lib">' + fam.filter(k => k !== key).map(k => '<button data-cv="' + k + '" style="padding:14px 6px">' + icon(NN[k][2]) + '<span>' + NN[k][0] + '</span></button>').join('') + '</div>', s => { $$('[data-cv]', s).forEach(b => b.onclick = () => { modal.close(); convert(g, b.dataset.cv); }); }); }
function convert(g, k2) { const M = members(g), box = groupBox(M); const items = {}; M.filter(o => o.zone && o.role).sort((a, b) => a.zi - b.zi).forEach(z => { (items[z.role] = items[z.role] || []).push(...contentOf(z).sort((a, b) => bb(a)[1] - bb(b)[1])); });
  let created; E.tx(() => { created = S.makeTpl(S.NOTES[k2][3], k2, { x: box[0], y: box[1] + 4, W: box[2] }); if (!created) return; const g2 = created[0].g; const zs = created.filter(o => o.zone && o.role); const byRole = r => zs.filter(z => z.role === r);
    const rr = {}; Object.entries(items).forEach(([r, list]) => { let tgt = byRole(r); let pre = ''; if (!tgt.length && ROLEMAP[r]) tgt = byRole(ROLEMAP[r]); if (!tgt.length && r === 'both') { tgt = byRole('a'); pre = '(both) '; } if (!tgt.length && r === 'q') { tgt = byRole('c1'); pre = 'Q: '; } if (!tgt.length) tgt = [zs[0]]; list.forEach(o => { const z = tgt[(rr[r] = (rr[r] || 0) + 1) % tgt.length]; placeInto(o, z, pre, g2); }); });
    E.del(M.filter(o => o.tpl)); });
  if (created) { refreshPH(); created.filter(o => o.zone).forEach(z => fit(P().find(q => q.id === z.id))); I.select(members(created[0].g)); SND.pop(); toast('Converted to ' + S.NOTES[k2][0] + ' — answers moved across.'); } }
function placeInto(o, z, pre, g2) { const r = inner(z), y = nextY(z), b = bb(o); E.mod(o, q => { q.g = g2; if (q.t === 'text') { q.x = r.x; q.y = y; q.w = Math.max(80, r.w); if (r.w < 480) q.size = Math.min(q.size, 26); if (pre && !q.s.startsWith(pre)) q.s = pre + q.s; } else if (q.t === 'stroke') { const k = b[2] > r.w ? r.w / b[2] : 1; for (let i = 0; i < q.pts.length; i += 3) { q.pts[i] = r.x + (q.pts[i] - b[0]) * k; q.pts[i + 1] = y + (q.pts[i + 1] - b[1]) * k; } } else if (q.x != null) { q.x = r.x; q.y = y; if (q.w > r.w && q.h) { q.h *= r.w / q.w; q.w = r.w; } } }); }

/* ---------- export the answers as an outline ---------- */
function exportAnswers(g) { const M = members(g), key = M.find(o => o.tpl).tpl, title = (M.find(o => o.ttl) || {}).s || (S.NOTES[key] || [key])[0]; const lines = ['# ' + title, ''];
  M.filter(o => o.zone).sort((a, b) => a.zi - b.zi).forEach(z => { const head = ownOf(z).filter(o => o.t === 'text' && !o.ph).sort((a, b) => a.y - b.y)[0]; const cs = contentOf(z).sort((a, b) => bb(a)[1] - bb(b)[1]); if (!cs.length && !head) return; lines.push('## ' + (head ? head.s.replace(/\n/g, ' ') : 'Box ' + (z.zi + 1))); if (!cs.length) lines.push('- (empty)'); cs.forEach(o => lines.push('- ' + (o.t === 'text' || o.t === 'note' ? (o.s || '').trim().replace(/\n+/g, ' / ') : o.t === 'stroke' ? '(handwriting)' : '(' + o.t + ')'))); lines.push(''); });
  const txt = lines.join('\n').trim(); const hw = M.some(o => o.t === 'stroke' && !o.tpl);
  modal.open('<h2>Export answers</h2><textarea class="inp" id="exT" dir="auto" style="width:100%;height:280px;font:14px/1.5 var(--mono)">' + esc(txt) + '</textarea>' + (hw ? '<p class="small muted">Handwriting shows as “(handwriting)”. Use Ink → text first to turn it into words.</p>' : '') + '<div class="foot"><button class="btn" id="exC">' + icon('copy') + ' Copy</button><button class="btn" id="exD">' + icon('download') + ' Download .txt</button><button class="btn primary" id="exP">' + icon('file-plus') + ' Put on a new page</button></div>', s => {
    $('#exC', s).onclick = () => { navigator.clipboard && navigator.clipboard.writeText($('#exT', s).value).then(() => toast('Copied'), () => toast('Copy was blocked by the browser')); };
    $('#exD', s).onclick = () => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([$('#exT', s).value], { type: 'text/plain' })); a.download = title.replace(/[\\/:*?"<>|_]+/g, ' ').trim().slice(0, 50) + '.txt'; a.click(); };
    $('#exP', s).onclick = () => { const v = $('#exT', s).value; modal.close(); const np = E.newPage(E.page().theme); np.name = ('Answers — ' + title).slice(0, 40); const W = B.mode === 'scroll' ? B.width : 1920, ink = E.isDark(np) ? '#F4EEF2' : '#1E1419'; let y = 90; v.split('\n').forEach(l => { if (!l.trim()) { y += 14; return; } const h1 = l.startsWith('# '), h2 = l.startsWith('## '); const o = { id: uid(), ts: Date.now(), t: 'text', x: h2 || h1 ? 90 : 130, y, w: W - 240, s: l.replace(/^#+\s*/, ''), font: window.HB.isRTL(l) ? 'Tajawal' : 'Lexend', size: h1 ? 44 : h2 ? 32 : 26, b: h1 || h2, c: h1 ? '#B0124F' : ink, layer: 1 }; np.objs.push(o); y += E.textLayout(o).h + (h2 ? 8 : 6); }); np.H = Math.max(2160, Math.ceil((y + 300) / 1080) * 1080); B.pages.splice(B.cur + 1, 0, np); window.HBUI && HBUI.goPage(B.cur + 1); E.changed(); SND.page(); }; }); }

function blankCopy(g) { const M = members(g), key = M.find(o => o.tpl).tpl, box = groupBox(M); if (!S.NOTES[key]) return; const at = B.mode === 'scroll' ? { x: box[0], y: box[1] + box[3] + 120, W: box[2] } : { x: box[0] + box[2] + 140, y: box[1] + 4, W: box[2] }; const c = S.makeTpl(S.NOTES[key][3], key, at); if (c) { I.select(c); SND.pop(); toast('Blank copy placed ' + (B.mode === 'scroll' ? 'below.' : 'to the right.')); } }

window.HBN = { fitScreen, zoneAt, zoneHit, textPlace, dbl, typeIn, addPart, removePart, fit, reflow, convert, exportAnswers, spotlight, recolour, toggleLock, clearAnswers, blankCopy, refreshPH, contentOf, get active() { return active; }, set active(z) { active = z; place(); } };
})();

