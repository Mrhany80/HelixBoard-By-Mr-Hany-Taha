/* ================= HelixBoard — input: tools, pointer, selection, transforms, text editing ================= */
(() => {
'use strict';
const { $, $$, clamp, uid, set, bus, toast, SND, fontStack, loadFont, REDUCE } = window.HB;
const E = window.HBE; const { B, V, page, byId, add, del, mod, tx, toB, toS, bbox, dirty, liveDrawers, strokePath } = E;
const cv = E.cvLive, overlay = $('#overlay'), stage = $('#stage');

/* ---------- tool state ---------- */
/* the eraser removes writing only — never template boxes, slide pictures or the editable text of an opened PDF / PowerPoint */
const erasable = o => o.t === 'stroke' || (!o.tpl && !o.deckBase && !o.zone && ['shape', 'conn', 'pin', 'stamp'].includes(o.t));
const T = { tool: 'draw', pen: set.get('pen', 'pen'), color: set.get('color', '#1E1419'), size: set.get('size', 4), alpha: 1, shape: 'rect', sketchy: set.get('sketchy', false), fill: null, hatch: false, dash: false, font: set.get('font', 'Caveat'), fsize: set.get('fsize', 40), bold: false, italic: false, penOnly: set.get('penOnly', false), board: set.get('boardMode', false), eraser: 'stroke', snap: false, nib: 40, quick: set.get('quick', true), noteIdx: 0 };
/* cursors: a small glowing DNA helix; the tip shows the current ink colour */
const helixSVG = (tip, arrow) => '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32"><defs><filter id="g" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="1.3" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs><g filter="url(#g)" stroke-linecap="round" fill="none">' +
  (arrow ? '<path d="M4 3 L4 20 L8.5 15.8 L11.5 22.5 L14 21.4 L11 14.8 L17 14.6 Z" fill="#fff" stroke="#B0124F" stroke-width="1.4" stroke-linejoin="round"/><g transform="translate(14 8)">' : '<g transform="translate(9 2)">') +
  '<path d="M3 0 C3 6 15 6 15 12 S3 18 3 24" stroke="#FF4FA0" stroke-width="2.4"/><path d="M15 0 C15 6 3 6 3 12 S15 18 15 24" stroke="#22D3EE" stroke-width="2.4"/><path d="M5 3h8M9 6v0M5 9h8M5 15h8M5 21h8" stroke="#FFFFFF" stroke-width="1.2" opacity=".9"/></g>' +
  (arrow ? '' : '<circle cx="3.5" cy="28.5" r="2.6" fill="' + tip + '" stroke="#fff" stroke-width="1"/><path d="M3.5 28.5 L10 22" stroke="' + tip + '" stroke-width="1.6"/>') + '</g></svg>';
const curURL = (svg, x, y, fb) => 'url("data:image/svg+xml,' + encodeURIComponent(svg) + '") ' + x + ' ' + y + ', ' + fb;
let curCache = {};
function curFor(t) { if (set.get('helixCursor', true) === false) return { hand: 'grab', select: 'default', text: 'text', laser: 'none', erase: 'cell' }[t] || 'crosshair';
  if (t === 'hand') return 'grab'; if (t === 'text') return 'text'; if (t === 'laser') return 'none'; if (t === 'erase') return 'none';
  const arrow = t === 'select' || t === 'lasso'; const key = (arrow ? 'a' : 'p') + T.color; if (!curCache[key]) curCache[key] = arrow ? curURL(helixSVG(T.color, true), 4, 3, 'default') : curURL(helixSVG(T.color, false), 3, 29, 'crosshair'); return curCache[key]; }
const NOTE_COLORS = ['#FFF3BF', '#D3F9D8', '#D0EBFF', '#FFE3E3', '#E5DBFF'];
function setTool(t, sub) { if (editing) commitEdit(); T.tool = t; if (t === 'draw' && sub) { T.pen = sub; set.put('pen', sub); if (sub === 'hi' && /^#(1E1419|000000|FFFFFF)$/i.test(T.color)) { T._prev = T.color; T.color = T._auto = E.isDark(page()) ? '#FFE066' : '#FFD43B'; set.put('color', T.color); } }
  if (T._prev && !(t === 'draw' && T.pen === 'hi')) { if (T.color === T._auto) { T.color = T._prev; set.put('color', T.color); } T._prev = T._auto = null; } if (t === 'shape' && sub) T.shape = sub; if (t === 'erase' && sub) T.eraser = sub;
  cv.style.cursor = curFor(t); if (t !== 'select' && t !== 'lasso') clearSel(); dirty.live = true; bus.emit('tool', T); }
const setColor = c => { T.color = c; set.put('color', c); cv.style.cursor = curFor(T.tool); if (sel.size) mod(selObjs(), o => { if (o.t === 'note') return; if ('c' in o || o.t === 'stroke' || o.t === 'shape' || o.t === 'text' || o.t === 'pin' || o.t === 'conn') o.c = c; if (o.t === 'stamp') o.stroke = c; }); bus.emit('tool', T); };
const setSize = s => { T.size = clamp(s, 1, 60); set.put('size', T.size); if (sel.size) { const strokes = selObjs().filter(o => o.t === 'stroke' || o.t === 'shape' || o.t === 'conn'); if (strokes.length) mod(strokes, o => { if (o.t === 'shape') o.sw = T.size; else o.w = T.size; }); } bus.emit('tool', T); };

/* ---------- selection ---------- */
const sel = new Set();
const selObjs = () => page().objs.filter(o => sel.has(o.id));
const layerLocked = o => { const L = page().layers[o.layer == null ? 1 : o.layer]; return L && (L.lock || !L.show); };
function selBox() { let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9; selObjs().forEach(o => { const b = bbox(o); if (!b) return; x0 = Math.min(x0, b[0]); y0 = Math.min(y0, b[1]); x1 = Math.max(x1, b[0] + b[2]); y1 = Math.max(y1, b[1] + b[3]); }); return x0 > x1 ? null : [x0, y0, x1 - x0, y1 - y0]; }
function select(objs, addTo, only) { if (!addTo) sel.clear(); [].concat(objs).forEach(o => { if (!o) return; sel.add(o.id); if (o.g && !only && !page().objs.some(q => q.g === o.g && q.locked)) page().objs.forEach(q => { if (q.g === o.g) sel.add(q.id); }); }); dirty.live = true; bus.emit('selection', selObjs()); }
function clearSel() { if (!sel.size) return; sel.clear(); dirty.live = true; bus.emit('selection', []); }
bus.on('selection-clear', clearSel); bus.on('page', () => { sel.clear(); bus.emit('selection', []); });

/* ---------- hit testing ---------- */
const segD = (px, py, ax, ay, bx, by) => { const dx = bx - ax, dy = by - ay, l = dx * dx + dy * dy, t = l ? clamp(((px - ax) * dx + (py - ay) * dy) / l, 0, 1) : 0; return Math.hypot(px - ax - t * dx, py - ay - t * dy); };
function hitObj(o, x, y, tol) { if (o.off) return false; const b = bbox(o); if (!b || x < b[0] - tol || x > b[0] + b[2] + tol || y < b[1] - tol || y > b[1] + b[3] + tol) return false;
  if (o.t === 'stroke') { const P = o.pts, r = o.w * ((o.pen === 'hi') ? 2.2 : 0.8) + tol; if (P.length === 3) return Math.hypot(x - P[0], y - P[1]) < r; for (let i = 3; i < P.length; i += 3) if (segD(x, y, P[i - 3], P[i - 2], P[i], P[i + 1]) < r) return true; return false; }
  if (o.t === 'shape' && o.line) { const [x1, y1, x2, y2] = o.line; if (o.k === 'curve' && o.cp) { for (let t = 0; t < 1; t += 0.05) { const a = q(x1, o.cp[0], x2, t), b2 = q(y1, o.cp[1], y2, t), c = q(x1, o.cp[0], x2, t + 0.05), d = q(y1, o.cp[1], y2, t + 0.05); if (segD(x, y, a, b2, c, d) < (o.sw || 3) + tol) return true; } return false; } return segD(x, y, x1, y1, x2, y2) < (o.sw || 3) + tol + 4; }
  if (o.t === 'conn') { const p = E.connPts(o); return p && segD(x, y, p[0], p[1], p[2], p[3]) < 8 + tol; }
  if (o.t === 'pin') return Math.hypot(x - o.x, y - o.y) < 10 + tol || (x >= o.lx && x <= o.lx + (o.lw || 120) && y >= o.ly && y <= o.ly + 30);
  return true; }
const q = (a, c, b, t) => (1 - t) * (1 - t) * a + 2 * (1 - t) * t * c + t * t * b;
function hitTop(x, y, tol) { const P = page().objs; for (let L = 2; L >= 0; L--) for (let i = P.length - 1; i >= 0; i--) { const o = P[i]; if ((o.layer == null ? 1 : o.layer) !== L || o.locked || layerLocked(o)) continue; if (hitObj(o, x, y, tol)) return o; } return null; }

/* ---------- transforms (move / scale / rotate) ---------- */
function applyT(o, src, f) { /* f: {dx,dy} | {ax,ay,sx,sy} | {cx,cy,a} */
  const pt = (x, y) => { if (f.a != null) { const c = Math.cos(f.a), s = Math.sin(f.a), dx = x - f.cx, dy = y - f.cy; return [f.cx + dx * c - dy * s, f.cy + dx * s + dy * c]; } if (f.sx != null) return [f.ax + (x - f.ax) * f.sx, f.ay + (y - f.ay) * f.sy]; return [x + f.dx, y + f.dy]; };
  for (const k of Object.keys(o)) if (k[0] !== '_') delete o[k]; Object.assign(o, JSON.parse(JSON.stringify(src))); E.invalidate(o);
  if (o.t === 'stroke') { const P = o.pts; for (let i = 0; i < P.length; i += 3) { const r = pt(P[i], P[i + 1]); P[i] = r[0]; P[i + 1] = r[1]; } if (f.sx != null) o.w = Math.max(0.5, src.w * Math.sqrt(Math.abs(f.sx * f.sy))); return; }
  if (o.t === 'shape' && o.line) { const a = pt(o.line[0], o.line[1]), b = pt(o.line[2], o.line[3]); o.line = [a[0], a[1], b[0], b[1]]; if (o.cp) o.cp = pt(o.cp[0], o.cp[1]); return; }
  if (o.t === 'pin') { const a = pt(o.x, o.y), b = pt(o.lx, o.ly); o.x = a[0]; o.y = a[1]; o.lx = b[0]; o.ly = b[1]; return; }
  if (o.t === 'conn') return;
  if (o.t === 'scalebar' && o.img) return;
  if (o.t === 'scalebar') { const a = pt(o.x, o.y); o.x = a[0]; o.y = a[1]; if (f.sx != null) o.len = src.len * Math.abs(f.sx); return; }
  if (o.t === 'text') { const b = bbox(src); if (f.sx != null) { const a = pt(o.x, o.y); o.x = a[0]; o.y = a[1]; const k = Math.abs(f.sy) || 1; if (!f.smart) o.size = Math.max(6, src.size * k); if (o.w > 0) o.w = src.w * Math.abs(f.sx); } else if (f.a != null) { const cx = b[0] + b[2] / 2, cy = b[1] + b[3] / 2, c = pt(cx, cy); o.x += c[0] - cx; o.y += c[1] - cy; o.rot = (o.rot || 0) + f.a; } else { o.x += f.dx; o.y += f.dy; } return; }
  if (o.w != null) { if (f.sx != null) { const a = pt(o.x, o.y), b = pt(o.x + o.w, o.y + o.h); o.x = Math.min(a[0], b[0]); o.y = Math.min(a[1], b[1]); o.w = Math.max(4, Math.abs(b[0] - a[0])); o.h = Math.max(4, Math.abs(b[1] - a[1])); } else if (f.a != null) { const cx = o.x + o.w / 2, cy = o.y + o.h / 2, c = pt(cx, cy); o.x += c[0] - cx; o.y += c[1] - cy; o.rot = (o.rot || 0) + f.a; } else { o.x += f.dx; o.y += f.dy; } } }

/* ---------- pointer state ---------- */
const ptrs = new Map(); let activeId = null; let act = null, spaceDown = false, lastPenAt = 0, longT = 0;
const INK_TOOLS = ['draw', 'shape', 'text', 'note', 'magic', 'conn', 'pin'];
/* notebook pages: writing stays inside the page — points are kept within its edges */
const evPos = e => { const p = toB(e.clientX, e.clientY); if (B.mode === 'scroll' && INK_TOOLS.includes(T.tool)) { p[0] = clamp(p[0], 2, B.width - 2); p[1] = clamp(p[1], 2, page().H - 2); } return p; };
const outsidePage = e => { if (B.mode !== 'scroll' || !INK_TOOLS.includes(T.tool)) return false; const [x, y] = toB(e.clientX, e.clientY); return x < 0 || x > B.width || y < 0 || y > page().H; };
/* real pen pressure, lifted by the sensitivity curve so light strokes still show clearly */
const pressureOf = e => { if (!(e.pointerType === 'pen' && e.pressure > 0)) return 0.5; const k = E.SENS(); return Math.round(Math.max(k.floor, Math.min(1, Math.pow(e.pressure, k.gamma))) * 1000) / 1000; };
function startPan(e) { activeId = e.pointerId; act = { k: 'pan', sx: e.clientX, sy: e.clientY, vx: V.x, vy: V.y }; cv.style.cursor = 'grabbing'; }
function startPinch() { const [a, b] = [...ptrs.values()]; act = { k: 'pinch', d0: Math.hypot(a.x - b.x, a.y - b.y), m0: [(a.x + b.x) / 2, (a.y + b.y) / 2], s0: V.s, vx: V.x, vy: V.y }; }
cv.addEventListener('contextmenu', e => e.preventDefault());
/* the board area must never scroll as a web page (a long text box would push everything sideways); the canvas view does the moving */
stage.addEventListener('scroll', () => { if (stage.scrollLeft || stage.scrollTop) { stage.scrollLeft = 0; stage.scrollTop = 0; } });
cv.addEventListener('pointerdown', e => { e.preventDefault(); if (!editing) cv.focus({ preventScroll: true });
  /* smartboards often lose 'pointerup' (ghost or dropped touches); a new primary contact means nothing else is really down, so stale pointers can never block writing */
  if (e.isPrimary) { ptrs.clear(); if (act && (act.k === 'pinch' || act.k === 'pan')) act = null; }
  ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, t: e.pointerType }); try { cv.setPointerCapture(e.pointerId); } catch (er) {}
  if (e.pointerType === 'touch' && !seenTouch) firstTouch();
  if (T.board && e.pointerType === 'touch' && ptrs.size > 1) { ptrs.delete(e.pointerId); return; } /* smartboard mode: extra fingers, sleeves and palms are ignored */
  if (editing && !e.target.closest('#editor')) commitEdit();
  if (e.pointerType === 'pen') lastPenAt = Date.now();
  if (ptrs.size === 2 && [...ptrs.values()].every(p => p.t === 'touch')) { if (act && act.k === 'draw' && act.o.pts.length < 30) { act = null; SND.writeStop(); dirty.live = true; } startPinch(); return; }
  if (ptrs.size > 1) return;
  if (e.button === 2) { radial(e.clientX, e.clientY); return; }
  if (e.button === 1 || spaceDown || T.tool === 'hand' || (e.pointerType === 'touch' && (T.penOnly || (!T.board && Date.now() - lastPenAt < 2500)) && T.tool !== 'select')) { startPan(e); return; }
  if (e.pointerType === 'touch') { clearTimeout(longT); const sx = e.clientX, sy = e.clientY; longT = setTimeout(() => { const p = ptrs.get(e.pointerId); if (!p || p.moved) return; if (act && act.k === 'draw' && act.o.pts.length > 6) return; if (act && act.k === 'erase') return; act = null; live = null; SND.writeStop(); dirty.live = true; radial(sx, sy); }, T.board ? 1300 : 900); }
  if (outsidePage(e)) return; /* a pen touching outside the page does nothing */
  activeId = e.pointerId;
  const [x, y] = evPos(e); if (window.HBInst && HBInst.down(x, y, e)) { act = { k: 'inst' }; return; }
  const h = TOOLS[T.tool]; if (h && h.down) h.down(x, y, e); });
cv.addEventListener('pointermove', e => { const p = ptrs.get(e.pointerId); if (p) { if (!p.moved && p.sx != null && Math.hypot(e.clientX - p.sx, e.clientY - p.sy) > 8) { p.moved = true; clearTimeout(longT); } p.x = e.clientX; p.y = e.clientY; }
  if (act && act.k !== 'pinch' && activeId != null && e.pointerId !== activeId) return; /* only the contact that started the stroke can move it (palms and second fingers cannot scribble into it) */
  const [x, y] = evPos(e); cursor = [x, y, e.pointerType]; if (T.tool === 'erase' || T.tool === 'laser' || (window.HBR && HBR.loupeOn)) dirty.live = true;
  if (!act) { const h = TOOLS[T.tool]; if (h && h.hover) h.hover(x, y, e); return; }
  if (act.k === 'pan') { setViewKeep(V.s, act.vx + e.clientX - act.sx, act.vy + e.clientY - act.sy); return; }
  if (act.k === 'pinch') { if (ptrs.size < 2) return; const [a, b] = [...ptrs.values()], d = Math.hypot(a.x - b.x, a.y - b.y), m = [(a.x + b.x) / 2, (a.y + b.y) / 2], r = stage.getBoundingClientRect(); const s = clamp(act.s0 * d / act.d0, 0.1, 8); const mx = act.m0[0] - r.left, my = act.m0[1] - r.top; E.setView(s, mx - (mx - act.vx) * s / act.s0 + (m[0] - act.m0[0]), my - (my - act.vy) * s / act.s0 + (m[1] - act.m0[1])); return; }
  if (act.k === 'inst') { HBInst.move(x, y, e); return; }
  if (act.k === 'draw' && RAW && act.raw) { const pr = e.getPredictedEvents ? e.getPredictedEvents() : []; act.pred = pr.length ? evPos(pr[pr.length - 1]) : null; return; }
  const h = TOOLS[T.tool]; if (h && h.move) { if (act.k === 'draw') { const pr = e.getPredictedEvents ? e.getPredictedEvents() : []; act.pred = pr.length ? evPos(pr[pr.length - 1]) : null; } const evs = e.getCoalescedEvents ? e.getCoalescedEvents() : [e]; if (h.coalesce && evs.length > 1) evs.forEach(ev => h.move(...evPos(ev), ev)); else h.move(x, y, e); } });
/* ink uses 'pointerrawupdate' where the browser offers it: pen samples arrive as soon as the digitiser sends them instead of once per frame */
const RAW = 'onpointerrawupdate' in window;
if (RAW) cv.addEventListener('pointerrawupdate', e => { if (!act || act.k !== 'draw' || e.pointerId !== activeId) return; act.raw = true; const h = TOOLS[T.tool]; if (!h || !h.move) return;
  const evs = e.getCoalescedEvents ? e.getCoalescedEvents() : [e]; (evs.length ? evs : [e]).forEach(ev => h.move(...evPos(ev), ev)); });
const up = e => { clearTimeout(longT); ptrs.delete(e.pointerId); if (act && act.k !== 'pinch' && activeId != null && e.pointerId !== activeId) return; if (e.pointerId === activeId) activeId = null; if (!act) return; if (act.k === 'pan') { act = null; cv.style.cursor = T.tool === 'hand' ? 'grab' : ''; setTool(T.tool); return; } if (act.k === 'pinch') { if (!ptrs.size) act = null; return; } if (act.k === 'inst') { HBInst.up(e); act = null; return; } const h = TOOLS[T.tool]; if (h && h.up) h.up(...evPos(e), e); };
cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
cv.addEventListener('lostpointercapture', e => { if (ptrs.has(e.pointerId)) up(e); });
/* first touch on a large screen with no pen seen: switch on Smartboard mode once, and say so */
let seenTouch = false;
function firstTouch() { seenTouch = true; if (set.get('boardMode', null) !== null || lastPenAt) return; if (Math.max(screen.width, screen.height) >= 1600 || innerWidth >= 1600) { T.board = true; set.put('boardMode', true); toast('Smartboard mode is on: one finger writes, extra touches are ignored. Change it in Board → Input.'); window.HBUI && HBUI.refresh(); } }
cv.addEventListener('dblclick', e => { const [x, y] = evPos(e); const o = hitTop(x, y, 6 / V.s); if (window.HBN && T.tool === 'select' && HBN.dbl(x, y, o)) return; if (!o) return; if (o.t === 'text' || o.t === 'note') { openEditor(o); return; } if (o.t === 'pin') { openEditor(o); return; } if (o.t === 'wid') bus.emit('edit-widget', o); if (o.t === 'conn') { const l = prompt('Label for this arrow (leave empty for none):', o.label || ''); if (l != null) mod(o, q => q.label = l); } });
const setViewKeep = (s, x, y) => E.setView(s, x, y);
let cursor = null;
stage.addEventListener('wheel', e => { if (e.target.closest('#drawer,#dock,#mini,.float,#kbd')) return; e.preventDefault(); const r = stage.getBoundingClientRect(); if (e.ctrlKey || e.metaKey) { E.zoomAt(Math.exp(-e.deltaY * 0.0022), e.clientX - r.left, e.clientY - r.top); return; } /* lines (Firefox, some mouse drivers) and pages are turned into pixels; Shift turns the wheel sideways — Windows already reports that as deltaX */
  const k = e.deltaMode === 1 ? 40 : e.deltaMode === 2 ? E.SH * 0.9 : 1; let dx = e.deltaX * k, dy = e.deltaY * k; if (e.shiftKey && !dx) { dx = dy; dy = 0; } else if (e.shiftKey) dy = 0; E.scrollTo(V.x - dx, V.y - dy); }, { passive: false });

/* ---------- drawing ---------- */
let live = null; const dust = []; let still = null;
const TOOLS = {
  draw: { coalesce: true,
    down(x, y, e) { const sp = !(e.pointerType === 'pen' && e.pressure > 0 && e.pressure !== 0.5); live = { t: 'stroke', pen: T.pen, c: T.color, w: T.size * (T.pen === 'hi' ? 1 : 1), a: T.alpha, pts: [x, y, pressureOf(e)], tm: [0], sp, t0: performance.now(), _live: true }; if (T.board && e.pointerType === 'touch') live.sb = 1; if (T.pen === 'calli') live.ang = T.nib;
      if (window.HBInst) { const sn = HBInst.snapStart(x, y); if (sn) live.snap = sn; }
      act = { k: 'draw', o: live, last: [x, y, performance.now()], minMove: E.SENS().minMove }; SND.writeStart(T.pen === 'chalk' || E.THEMES[page().theme].chalk ? 'chalk' : null); still = { x, y, t: performance.now(), done: false }; dirty.live = true; },
    move(x, y, e) { if (!act || act.k !== 'draw') return; const o = act.o; if (o.snap) [x, y] = HBInst.snapPoint(o.snap, x, y); const n = o.pts.length; if (Math.hypot(x - o.pts[n - 3], y - o.pts[n - 2]) < (act.minMove || 0.6) / V.s) return; o.pts.push(Math.round(x * 10) / 10, Math.round(y * 10) / 10, pressureOf(e)); o.tm.push(Math.round(performance.now() - o.t0)); delete o._p; delete o._b;
      const now = performance.now(), dt = Math.max(1, now - act.last[2]), sp = Math.hypot(x - act.last[0], y - act.last[1]) * V.s / dt; SND.writeMove(sp, Math.atan2(y - act.last[1], x - act.last[0])); act.last = [x, y, now];
      if ((o.pen === 'chalk' || E.THEMES[page().theme].chalk) && Math.random() < 0.35) dust.push({ x, y, vx: (Math.random() - 0.5) * 0.4, vy: 0.3 + Math.random() * 0.6, t: now, c: o.c });
      if (Math.hypot(x - still.x, y - still.y) > 4 / V.s) { still.x = x; still.y = y; still.t = now; }
      if (o.preview) { o.preview = null; } dirty.live = true; },
    up() { if (!act || act.k !== 'draw') return; const o = act.o; act = null; SND.writeStop(); live = null; dirty.live = true;
      if (o.preview) { const s = o.preview; s.c = o.c; s.sw = Math.max(2, o.w * 0.8); add(s); return; }
      delete o.t0; delete o.snap; delete o.preview; delete o._live; delete o._lc; delete o._p; act && (act.pred = null); add(o); bus.emit('stroke-added', o); } },
  erase: { coalesce: true,
    down(x, y) { act = { k: 'erase', hits: new Set(), mods: new Map() }; this.move(x, y); SND.erase(); },
    move(x, y) { if (!act || act.k !== 'erase') return; const r = Math.max(8, T.size * 2.5) / Math.max(V.s, 0.3) * Math.max(V.s, 0.3) / V.s * 1;
      if (T.eraser === 'stroke') { page().objs.forEach(o => { if (!act.hits.has(o.id) && !o.locked && !layerLocked(o) && erasable(o) && hitObj(o, x, y, r)) { act.hits.add(o.id); E.hidden = new Set([...E.hidden, o.id]); if (Math.random() < 0.5) SND.erase(); } }); }
      else { page().objs.forEach(o => { if (o.t !== 'stroke' || o.locked || layerLocked(o)) return; const b = bbox(o); if (!b || x < b[0] - r || x > b[0] + b[2] + r || y < b[1] - r || y > b[1] + b[3] + r) return; const P = o.pts; let hit = false; for (let i = 0; i < P.length; i += 3) if (Math.hypot(P[i] - x, P[i + 1] - y) < r) { hit = true; break; } if (!hit) return; if (!act.mods.has(o.id)) act.mods.set(o.id, E.clean(o)); const keep = []; for (let i = 0; i < P.length; i += 3) keep.push(Math.hypot(P[i] - x, P[i + 1] - y) >= r); o._keep = (o._keep || keep.map(() => true)).map((v, i) => v && keep[i]); const np = [], nt = []; for (let i = 0, j = 0; i < P.length; i += 3, j++) if (o._keep[j]) { np.push(P[i], P[i + 1], P[i + 2]); nt.push(o.tm ? o.tm[j] : 0); } o.pts = np; o.tm = nt; o._keep = o._keep.filter(Boolean); delete o._p; delete o._b; if (!np.length) o.pts = []; }); dirty.main = true; } },
    up() { if (!act) return; const a = act; act = null; if (T.eraser === 'stroke') { const objs = page().objs.filter(o => a.hits.has(o.id)); E.hidden = new Set(); del(objs); return; }
      /* partial eraser: stroke pieces that were cut apart become separate strokes */
      if (!a.mods.size) return; const originals = []; a.mods.forEach((src, id) => originals.push(src)); const P = page().objs;
      const pieces = []; a.mods.forEach((src, id) => { const o = P.find(q => q.id === id); if (!o) return; const pts = o.pts; /* split where the gap from the original is large */ const segs = []; let cur = []; for (let i = 0; i < pts.length; i += 3) { if (cur.length && Math.hypot(pts[i] - cur[cur.length - 3], pts[i + 1] - cur[cur.length - 2]) > Math.max(6, o.w * 2)) { segs.push(cur); cur = []; } cur.push(pts[i], pts[i + 1], pts[i + 2]); } if (cur.length) segs.push(cur); segs.filter(s => s.length >= 6).forEach(s => pieces.push(Object.assign(E.clean(src), { id: uid(), pts: s, tm: s.filter((_, k) => k % 3 === 0).map((_, k) => k * 8) }))); });
      /* restore originals in place, then record delete + add as one undo step */
      a.mods.forEach((src, id) => { const k = P.findIndex(q => q.id === id); if (k >= 0) { P[k] = JSON.parse(JSON.stringify(src)); } });
      tx(() => { del(P.filter(o => a.mods.has(o.id))); if (pieces.length) add(pieces); }); } },
  laser: { down(x, y) { act = { k: 'laser' }; laserPts.push([x, y, performance.now(), 1]); }, move(x, y) { laserPts.push([x, y, performance.now(), act ? 1 : 0]); dirty.live = true; }, up() { act = null; }, hover(x, y) { laserPts.push([x, y, performance.now(), 0]); } },
  magic: { coalesce: true, down(x, y, e) { const o = { t: 'stroke', pen: 'glow', c: T.color, w: Math.max(3, T.size), pts: [x, y, 0.5], sp: true, born: performance.now() }; magic.push(o); act = { k: 'magic', o }; SND.writeStart(); },
    move(x, y) { if (!act) return; act.o.pts.push(x, y, 0.5); delete act.o._p; act.o.born = performance.now(); SND.writeMove(0.6); dirty.live = true; }, up() { act = null; SND.writeStop(); } },
  hand: { down(x, y, e) { startPan(e); } },
  text: { down(x, y) { const hit = hitTop(x, y, 4 / V.s); if (hit && hit.t === 'text') { openEditor(hit); return; } loadFont(T.font); const zp = window.HBN && HBN.textPlace(x, y); if (zp && zp.typed) return; if (zp && zp.block) { toast('Note templates are for handwriting — write in the boxes with the pen.'); setTool('draw', T.pen === 'hi' ? 'pen' : T.pen); return; } const o = Object.assign({ t: 'text', x, y: y - T.fsize * 0.6, w: 0, s: '', font: T.font, size: T.fsize, c: T.color, b: T.bold, i: T.italic }, zp || {}); openEditor(o, true); } },
  note: { down(x, y) { const o = { t: 'note', x: x - 160, y: y - 120, w: 320, h: 240, s: '', c: NOTE_COLORS[T.noteIdx++ % NOTE_COLORS.length], font: T.font, size: 30 }; SND.slap(); openEditor(o, true); } },
  shape: { down(x, y) { const lineKinds = ['line', 'arrow', 'darrow', 'curve', 'rev', 'vec']; const isLine = lineKinds.includes(T.shape); const o = isLine ? { t: 'shape', k: T.shape, line: [x, y, x, y], c: T.color, sw: T.size, sketchy: T.sketchy, dash: T.dash, seed: 1 + Math.floor(Math.random() * 9999) } : { t: 'shape', k: T.shape, x, y, w: 0, h: 0, c: T.color, sw: T.size, fill: T.fill, hatch: T.hatch, sketchy: T.sketchy, dash: T.dash, seed: 1 + Math.floor(Math.random() * 9999) };
      act = { k: 'shape', o, x0: x, y0: y, isLine }; live = o; },
    move(x, y, e) { if (!act) return; const o = act.o; if (act.isLine) { let x2 = x, y2 = y; if (e.shiftKey) { const a = Math.round(Math.atan2(y - act.y0, x - act.x0) / (Math.PI / 12)) * Math.PI / 12, d = Math.hypot(x - act.x0, y - act.y0); x2 = act.x0 + Math.cos(a) * d; y2 = act.y0 + Math.sin(a) * d; } o.line = [act.x0, act.y0, x2, y2]; if (o.k === 'curve') { const mx = (act.x0 + x2) / 2, my = (act.y0 + y2) / 2, nx = -(y2 - act.y0), ny = x2 - act.x0; o.cp = [mx + nx * 0.25, my + ny * 0.25]; } if (o.k === 'vec') o.vlabel = vecLabel(o.line); }
      else { let w = x - act.x0, h = y - act.y0; if (e.shiftKey) { const m = Math.max(Math.abs(w), Math.abs(h)); w = Math.sign(w || 1) * m; h = Math.sign(h || 1) * m; } o.x = Math.min(act.x0, act.x0 + w); o.y = Math.min(act.y0, act.y0 + h); o.w = Math.abs(w); o.h = Math.abs(h); } delete o._b; dirty.live = true; },
    up() { if (!act) return; const o = act.o; act = null; live = null; dirty.live = true; if (o.line) { if (Math.hypot(o.line[2] - o.line[0], o.line[3] - o.line[1]) < 6) return; } else { if (o.w < 6 || o.h < 6) return; } add(o); select(o); setTool('select'); select(o); } },
  conn: { down(x, y) { const a = hitTop(x, y, 6 / V.s); if (!a || a.t === 'stroke' || a.t === 'conn') { toast('Start the connector on a shape, text, stamp or note.'); return; } act = { k: 'conn', a, x, y }; live = { t: 'shape', k: 'arrow', line: [x, y, x, y], c: T.color, sw: T.size }; },
    move(x, y) { if (!act) return; live.line[2] = x; live.line[3] = y; delete live._b; dirty.live = true; },
    up(x, y) { if (!act) return; const a = act.a; act = null; live = null; dirty.live = true; const b = hitTop(x, y, 6 / V.s); if (!b || b === a || b.t === 'stroke' || b.t === 'conn') return; add({ t: 'conn', a: a.id, b: b.id, k: T.shape === 'line' ? 'line' : 'arrow', c: T.color, w: T.size }); } },
  pin: { down(x, y) { const n = page().objs.filter(o => o.t === 'pin').length + 1; act = { k: 'pin', o: { t: 'pin', x, y, lx: x + 60, ly: y - 50, n, s: '', c: T.color === '#1E1419' ? '#E03131' : T.color, quiz: false } }; live = act.o; },
    move(x, y) { if (!act) return; act.o.lx = x; act.o.ly = y - 15; delete act.o._b; dirty.live = true; },
    up() { if (!act) return; const o = act.o; act = null; live = null; if (Math.hypot(o.lx - o.x, o.ly + 15 - o.y) < 20) { o.lx = o.x + 60; o.ly = o.y - 50; } openEditor(o, true); } },
  select: { down(x, y, e) { const hb = handleAt(x, y); const sb = selBox();
      if (hb && sb) { const src = selObjs().map(o => [o, E.clean(o)]); act = { k: 'xf', mode: hb, sb, src, x0: x, y0: y }; return; }
      const o = hitTop(x, y, 5 / V.s) || (window.HBN && HBN.zoneHit(x, y));
      if (o) { const drill = sel.has(o.id) && !e.shiftKey ? o : null; if (!sel.has(o.id)) select(o, e.shiftKey); else if (e.shiftKey) { sel.delete(o.id); dirty.live = true; bus.emit('selection', selObjs()); return; } const src = selObjs().map(q => [q, E.clean(q)]); act = { k: 'xf', mode: 'move', sb: selBox(), src, x0: x, y0: y, moved: false, tap: o, drill }; return; }
      if (!e.shiftKey) clearSel(); act = { k: 'band', x0: x, y0: y, x, y }; },
    move(x, y, e) { if (!act) return; if (act.k === 'band') { act.x = x; act.y = y; dirty.live = true; return; } if (act.k === 'xf') xfMove(x, y, e); },
    up(x, y) { if (!act) return; const a = act; act = null; if (a.k === 'band') { const r = [Math.min(a.x0, a.x), Math.min(a.y0, a.y), Math.abs(a.x - a.x0), Math.abs(a.y - a.y0)]; if (r[2] > 3 || r[3] > 3) select(page().objs.filter(o => { const b = bbox(o); return b && !o.locked && !layerLocked(o) && b[0] >= r[0] && b[1] >= r[1] && b[0] + b[2] <= r[0] + r[2] && b[1] + b[3] <= r[1] + r[3]; }), true); dirty.live = true; return; }
      if (a.k === 'xf') { if (!a.moved) { if (a.tap) bus.emit('obj-tap', { o: a.tap, drill: a.drill, x, y }); const pin = a.src.length === 1 && a.src[0][0]; if (pin && pin.t === 'pin' && pin.quiz) { E.quizReveal.has(pin.id) ? E.quizReveal.delete(pin.id) : E.quizReveal.add(pin.id); dirty.main = true; SND.pop(); } return; } const items = a.src.map(([o, b]) => ({ id: o.id, a: b, b: E.clean(o) })); E.push({ k: 'mod', items }); E.grow(); bus.emit('moved', { objs: selObjs(), mode: a.mode }); bus.emit('selection', selObjs()); } } },
  lasso: { down(x, y) { act = { k: 'lasso', pts: [[x, y]] }; }, move(x, y) { if (!act) return; act.pts.push([x, y]); dirty.live = true; },
    up() { if (!act) return; const poly = act.pts; act = null; dirty.live = true; if (poly.length < 3) return; const inside = (x, y) => { let c = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const [xi, yi] = poly[i], [xj, yj] = poly[j]; if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) c = !c; } return c; };
      const got = page().objs.filter(o => { if (o.locked || layerLocked(o)) return false; if (o.t === 'stroke') { let n = 0, k = 0; for (let i = 0; i < o.pts.length; i += 3) { k++; if (inside(o.pts[i], o.pts[i + 1])) n++; } return n / k > 0.6; } const b = bbox(o); return b && inside(b[0] + b[2] / 2, b[1] + b[3] / 2); }); if (got.length) { select(got); setTool('select'); select(got); } } }
};
const vecLabel = l => { const unit = set.get('vecUnit', 'N'), scale = set.get('vecScale', 40); const d = Math.hypot(l[2] - l[0], l[3] - l[1]) / scale, ang = Math.round((-Math.atan2(l[3] - l[1], l[2] - l[0]) * 180 / Math.PI + 360) % 360); return (Math.round(d * 10) / 10) + ' ' + unit + ', ' + ang + '°'; };


/* ---------- selection transforms ---------- */
function handleAt(x, y) { const b = selBox(); if (!b) return null; const r = 9 / V.s, pts = handlePts(b); for (const [k, hx, hy] of pts) if (Math.abs(x - hx) < r && Math.abs(y - hy) < r) return k; return null; }
function handlePts(b) { const [x, y, w, h] = b, rot = [ 'rot', x + w / 2, y - 30 / V.s ]; return [['nw', x, y], ['n', x + w / 2, y], ['ne', x + w, y], ['e', x + w, y + h / 2], ['se', x + w, y + h], ['s', x + w / 2, y + h], ['sw', x, y + h], ['w', x, y + h / 2], rot]; }
function xfMove(x, y, e) { const a = act, b = a.sb; if (!b) return; a.moved = true; let f;
  if (a.mode === 'move') { let dx = x - a.x0, dy = y - a.y0; if (T.snap || e.altKey) { const nx = Math.round((b[0] + dx) / 20) * 20, ny = Math.round((b[1] + dy) / 20) * 20; dx = nx - b[0]; dy = ny - b[1]; }
    if (a.src.length === 1 && a.src[0][1].t === 'stamp' && window.HBStamps) { const sn = HBStamps.snap(a.src[0][1], dx, dy, page().objs); if (sn) { dx = sn[0]; dy = sn[1]; } } f = { dx, dy }; }
  else if (a.mode === 'rot') { const cx = b[0] + b[2] / 2, cy = b[1] + b[3] / 2; let ang = Math.atan2(y - cy, x - cx) - Math.atan2(a.y0 - cy, a.x0 - cx); if (e.shiftKey) ang = Math.round(ang / (Math.PI / 12)) * Math.PI / 12; f = { cx, cy, a: ang }; }
  else { const m = a.mode; let ax = m.includes('w') ? b[0] + b[2] : m.includes('e') ? b[0] : b[0] + b[2] / 2, ay = m.includes('n') ? b[1] + b[3] : m.includes('s') ? b[1] : b[1] + b[3] / 2; let sx = m.includes('e') ? (x - b[0]) / b[2] : m.includes('w') ? (b[0] + b[2] - x) / b[2] : 1, sy = m.includes('s') ? (y - b[1]) / b[3] : m.includes('n') ? (b[1] + b[3] - y) / b[3] : 1; sx = Math.max(0.05, sx); sy = Math.max(0.05, sy);
    const smart = a.src.length > 1 && a.src.some(([o]) => o.tpl) && a.src.every(([o]) => o.g && o.g === a.src[0][0].g); const keep = smart ? e.shiftKey : (a.src.some(([o]) => ['img', 'stamp', 'wid', 'text'].includes(o.t)) || e.shiftKey); if (keep && m.length === 2) { const k = Math.max(sx, sy); sx = sy = k; } if (m === 'n' || m === 's') { if (keep) sx = sy; else sx = 1; } if (m === 'e' || m === 'w') { if (keep) sy = sx; else sy = 1; } f = { ax, ay, sx, sy, smart }; }
  a.src.forEach(([o, src]) => applyT(o, src, f)); dirty.main = true; dirty.live = true; }
function nudge(dx, dy) { if (!sel.size) return; mod(selObjs(), o => applyT(o, E.clean(o), { dx, dy })); }

/* ---------- text editor overlay ---------- */
let editing = null;
function openEditor(o, isNew) { if (editing) commitEdit(); const ta = document.createElement('textarea'); ta.id = 'editor'; ta.setAttribute('dir', 'auto'); ta.spellcheck = true; overlay.appendChild(ta); editing = { o, isNew, ta, before: isNew ? null : E.clean(o) };
  const field = o.t === 'pin' ? 's' : 's'; ta.value = o[field] || ''; E.hidden = new Set([o.id || '__new']); place(); const foc = () => { ta.focus({ preventScroll: true }); ta.setSelectionRange(ta.value.length, ta.value.length); }; foc(); setTimeout(foc, 0);
  ta.addEventListener('input', () => { place(); }); ta.addEventListener('keydown', e => { if (e.key === 'Escape') { e.preventDefault(); commitEdit(); } e.stopPropagation(); }); ta.addEventListener('blur', () => setTimeout(() => { if (editing && editing.ta === ta && document.activeElement !== ta && !document.activeElement.closest('#kbd,#toolrow,.varpop')) commitEdit(); }, 150)); bus.emit('editing', true); }
function place() { if (!editing) return; const { o, ta } = editing; const s = V.s; let x, y, w, fs, font = fontStack(o.font || T.font);
  if (o.t === 'note' && o.nd) { const lines = Math.max(1, (ta.value || ' ').split('\n').length); fs = (o.size || 22) * s; const [sx, sy] = toS(o.x + 10, o.y + o.h / 2); x = sx; y = sy - lines * fs * 0.65 - 4; w = (o.w - 20) * s; ta.style.height = (lines * fs * 1.3 + 8) + 'px'; ta.style.background = o.c || '#fff'; ta.style.color = '#1E1419'; font = fontStack(o.font || 'Lexend'); Object.assign(ta.style, { left: x + 'px', top: y + 'px', width: w + 'px', fontSize: fs + 'px', fontFamily: font, fontWeight: o.root ? 700 : 400, fontStyle: 'normal', textAlign: 'center' }); return; }
  if (o.t === 'note') { const [sx, sy] = toS(o.x + 16, o.y + 24); x = sx; y = sy; w = (o.w - 32) * s; fs = (o.size || 30) * s; ta.style.height = ((o.h - 40) * s) + 'px'; ta.style.background = o.c; ta.style.color = '#1E1419'; }
  else if (o.t === 'pin') { const [sx, sy] = toS(o.lx + 30, o.ly); x = sx; y = sy; w = 220; fs = 17 * s; ta.style.background = 'rgba(255,255,255,.95)'; ta.style.color = '#1E1419'; font = 'Lexend, sans-serif'; ta.style.height = (34 * s) + 'px'; }
  else { const [sx, sy] = toS(o.x, o.y); x = sx; y = sy; fs = o.size * s; ta.style.color = o.c; ta.style.background = E.isDark() ? 'rgba(0,0,0,.25)' : 'rgba(255,255,255,.55)'; const mc = document.createElement('canvas').getContext('2d'); mc.font = (o.b ? '700 ' : '') + fs + 'px ' + font; const lines = (ta.value || ' ').split('\n'); const mw = Math.max(...lines.map(l => mc.measureText(l + 'M').width)); w = o.w > 0 ? o.w * s : Math.max(120, mw + 16); ta.style.height = Math.max(fs * 1.4, lines.length * fs * 1.3 + 8) + 'px'; }
  Object.assign(ta.style, { left: x + 'px', top: y + 'px', width: w + 'px', fontSize: fs + 'px', fontFamily: font, fontWeight: o.b ? 700 : 400, fontStyle: o.i ? 'italic' : 'normal', textAlign: o.align || 'start' }); }
bus.on('view', place);
function commitEdit() { if (!editing) return; const { o, isNew, ta, before } = editing; editing = null; const v = ta.value; ta.remove(); E.hidden = new Set(); bus.emit('editing', false);
  if (isNew) { if (!v.trim() && o.t !== 'note') return; o.s = v; E.invalidate(o); add(o); if (o.t === 'text' || o.t === 'note') { select(o, false, !!o.g); } }
  else { if (v === (o.s || '')) { dirty.main = true; return; } mod(o, q => { q.s = v; }); }
  bus.emit('text-done', o); }
const insertText = (s) => { if (!editing) return false; const ta = editing.ta, a = ta.selectionStart, b = ta.selectionEnd; ta.value = ta.value.slice(0, a) + s + ta.value.slice(b); ta.selectionStart = ta.selectionEnd = a + s.length; place(); ta.focus(); return true; };
const transformSelection = fn => { if (!editing) return false; const ta = editing.ta, a = ta.selectionStart, b = ta.selectionEnd; if (a === b) return false; const t = fn(ta.value.slice(a, b)); ta.value = ta.value.slice(0, a) + t + ta.value.slice(b); ta.selectionStart = a; ta.selectionEnd = a + t.length; place(); ta.focus(); return true; };

/* ---------- live layer: in-progress strokes, selection, laser, magic ink, dust ---------- */
const laserPts = [], magic = [];
liveDrawers.push({ active: () => laserPts.length > 0 || magic.length > 0 || dust.length > 0 || (act && act.k === 'draw' && still && !still.done) || T.tool === 'erase', draw(g) { const now = performance.now(), s = V.s, p = page();
  if (live) { if (live.t === 'stroke') { if (act && act.k === 'draw' && T.quick && window.HBR && still && !still.done && live.pts.length > 24 && now - still.t > 520) { still.done = true; const r = HBR.recognize(E.ptsOf(live)); if (r) { live.preview = r; SND.pop(); } } if (live.preview) { const pv = live.preview; pv.c = live.c; pv.sw = Math.max(2, live.w * 0.8); E.drawObj(g, pv, p); } else { delete live._p; E.drawObj(g, live, p); /* predicted tip: a short line to where the pen is about to be, so ink keeps up with fast writing */ const P = live.pts, n = P.length; if (act && act.pred && n >= 6 && !['hi', 'dash', 'calli'].includes(live.pen)) { const q = act.pred, lx = P[n - 3], ly = P[n - 2], d = Math.hypot(q[0] - lx, q[1] - ly); if (d > 0.5 && d < 60 / s) { g.save(); g.globalAlpha = live.a == null ? 1 : live.a; g.strokeStyle = live.c; g.lineCap = 'round'; g.lineWidth = live.w * ((E.PEN || {})[live.pen] || { k: 1 }).k; g.beginPath(); g.moveTo(lx, ly); g.lineTo(q[0], q[1]); g.stroke(); g.restore(); } } } } else E.drawObj(g, live, p); }
  for (let i = dust.length - 1; i >= 0; i--) { const d = dust[i], age = (now - d.t) / 700; if (age > 1) { dust.splice(i, 1); continue; } g.fillStyle = d.c; g.globalAlpha = (1 - age) * 0.5; g.fillRect(d.x + d.vx * age * 30, d.y + d.vy * age * 40, 1.6 / s, 1.6 / s); } g.globalAlpha = 1;
  for (let i = magic.length - 1; i >= 0; i--) { const m = magic[i], age = (now - m.born) / 1000; if (age > 3 && !(act && act.o === m)) { const f = 1 - (age - 3) / 0.8; if (f <= 0) { magic.splice(i, 1); continue; } g.globalAlpha = f; } E.drawObj(g, m, p); g.globalAlpha = 1; }
  while (laserPts.length && now - laserPts[0][2] > 750) laserPts.shift(); if (laserPts.length > 1) { g.lineCap = 'round'; g.lineJoin = 'round'; for (let i = 1; i < laserPts.length; i++) { const a = laserPts[i - 1], b = laserPts[i], f = 1 - (now - b[2]) / 750; g.strokeStyle = 'rgba(255,40,60,' + (f * 0.9) + ')'; g.lineWidth = (3 + f * 7) / s; g.shadowColor = '#ff2040'; g.shadowBlur = 14; g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.stroke(); } g.shadowBlur = 0; }
  if (T.tool === 'laser' && cursor) { g.fillStyle = '#ff2b45'; g.shadowColor = '#ff2b45'; g.shadowBlur = 18; g.beginPath(); g.arc(cursor[0], cursor[1], 7 / s, 0, 7); g.fill(); g.shadowBlur = 0; }
  if (T.tool === 'erase' && cursor && cursor[2] !== 'touch') { const r = Math.max(8, T.size * 2.5) / V.s; g.strokeStyle = 'rgba(255,95,162,.9)'; g.lineWidth = 1.5 / s; g.setLineDash([4 / s, 3 / s]); g.beginPath(); g.arc(cursor[0], cursor[1], r, 0, 7); g.stroke(); g.setLineDash([]); }
  if (act && act.k === 'band') { g.strokeStyle = '#22D3EE'; g.fillStyle = 'rgba(34,211,238,.08)'; g.lineWidth = 1.5 / s; g.setLineDash([6 / s, 4 / s]); const r = [Math.min(act.x0, act.x), Math.min(act.y0, act.y), Math.abs(act.x - act.x0), Math.abs(act.y - act.y0)]; g.fillRect(...r); g.strokeRect(...r); g.setLineDash([]); }
  if (act && act.k === 'lasso') { g.strokeStyle = '#22D3EE'; g.fillStyle = 'rgba(34,211,238,.08)'; g.lineWidth = 1.5 / s; g.setLineDash([6 / s, 4 / s]); g.beginPath(); act.pts.forEach((q, i) => i ? g.lineTo(q[0], q[1]) : g.moveTo(q[0], q[1])); g.closePath(); g.fill(); g.stroke(); g.setLineDash([]); }
  const b = selBox(); if (b && T.tool === 'select') { g.strokeStyle = '#22D3EE'; g.lineWidth = 1.6 / s; g.setLineDash([7 / s, 5 / s]); g.strokeRect(b[0] - 4 / s, b[1] - 4 / s, b[2] + 8 / s, b[3] + 8 / s); g.setLineDash([]); const hs = 6 / s; handlePts(b).forEach(([k, x, y]) => { g.fillStyle = k === 'rot' ? '#FF5FA2' : '#fff'; g.strokeStyle = '#22D3EE'; g.lineWidth = 1.6 / s; g.beginPath(); if (k === 'rot') g.arc(x, y, hs * 1.15, 0, 7); else g.rect(x - hs, y - hs, hs * 2, hs * 2); g.fill(); g.stroke(); }); g.beginPath(); g.moveTo(b[0] + b[2] / 2, b[1]); g.lineTo(b[0] + b[2] / 2, b[1] - 30 / s + 7 / s); g.stroke(); }
} });

/* ---------- radial menu (right-click or long-press) ---------- */
function radial(cx, cy) { const R = $('#radial'); const pal = E.PALETTE[E.isDark() ? 'dark' : 'light']; const tools = [['draw', 'pen-line', 'pen'], ['draw', 'highlighter', 'hi'], ['erase', 'eraser'], ['select', 'mouse-pointer-2'], ['laser', 'locate-fixed'], ['undo', 'undo-2']];
  R.style.left = clamp(cx, 130, innerWidth - 130) + 'px'; R.style.top = clamp(cy, 130, innerHeight - 200) + 'px'; let h = '<button class="rc" data-x="1" aria-label="Close">' + T.size + 'px</button>';
  pal.forEach((c, i) => { const a = -Math.PI / 2 + i * Math.PI * 2 / pal.length; h += '<button class="rb" data-c="' + c + '" style="background:' + c + ';transform:translate(' + (Math.cos(a) * 98).toFixed(0) + 'px,' + (Math.sin(a) * 98).toFixed(0) + 'px)" aria-label="Colour ' + c + '"></button>'; });
  tools.forEach((t, i) => { const a = -Math.PI / 2 + Math.PI / 6 + i * Math.PI * 2 / tools.length; h += '<button class="rb" data-t="' + t[0] + '" data-s="' + (t[2] || '') + '" style="transform:translate(' + (Math.cos(a) * 52).toFixed(0) + 'px,' + (Math.sin(a) * 52).toFixed(0) + 'px);width:40px;height:40px;margin:-20px">' + window.HB.icon(t[1]) + '</button>'; });
  const SZ = [2, 4, 8, 14, 24, 40]; h += '<div class="rsz" aria-label="Pen size">' + SZ.map(z => '<button data-z="' + z + '" class="' + (T.size === z ? 'on' : '') + '" title="' + z + ' px"><i style="width:' + Math.min(26, z * 0.65 + 3) + 'px;height:' + Math.min(26, z * 0.65 + 3) + 'px;background:' + T.color + '"></i></button>').join('') + '<input type="range" min="1" max="60" value="' + T.size + '" aria-label="Pen size"><b>' + T.size + '</b></div>';
  R.innerHTML = h; R.hidden = false; SND.pop();
  { const rz = $('#radial .rsz'), rg = $('input', rz), lb = $('b', rz); const upd = z => { setSize(z); rg.value = T.size; lb.textContent = T.size; $('#radial [data-x]').textContent = T.size + 'px'; $$('[data-z]', rz).forEach(b => b.classList.toggle('on', +b.dataset.z === T.size)); };
    $$('[data-z]', rz).forEach(b => b.onclick = () => upd(+b.dataset.z)); rg.oninput = () => upd(+rg.value); } if (window.gsap && !REDUCE) gsap.from('#radial .rb', { scale: 0, duration: 0.25, stagger: 0.015, ease: 'back.out(1.4)' });
  const close = () => { R.hidden = true; document.removeEventListener('pointerdown', outside, true); }; const outside = e => { if (!e.target.closest('#radial')) close(); };
  setTimeout(() => document.addEventListener('pointerdown', outside, true), 0);
  $$('#radial [data-c]').forEach(b => b.onclick = () => { setColor(b.dataset.c); close(); }); $$('#radial [data-t]').forEach(b => b.onclick = () => { if (b.dataset.t === 'undo') E.undo(); else setTool(b.dataset.t, b.dataset.s || undefined); close(); }); $('#radial [data-x]').onclick = close; }

/* ---------- clipboard, duplicate, group, z-order ---------- */
let clip = null;
const copySel = () => { if (!sel.size) return; clip = selObjs().map(E.clean); toast('Copied ' + clip.length + ' item' + (clip.length > 1 ? 's' : '')); };
function pasteClip(off) { if (!clip) return; const gmap = {}; const objs = clip.map(o => { const n = JSON.parse(JSON.stringify(o)); n.id = uid(); n.ts = Date.now(); if (n.g) n.g = gmap[n.g] || (gmap[n.g] = uid()); applyT(n, E.clean(n), { dx: off || 30, dy: off || 30 }); return n; }); add(objs); select(objs); setTool('select'); select(objs); }
const duplicate = () => { copySel(); pasteClip(30); };
const group = () => { if (sel.size < 2) return; const g = uid(); mod(selObjs(), o => o.g = g); toast('Grouped'); };
const ungroup = () => { mod(selObjs().filter(o => o.g), o => delete o.g); toast('Ungrouped'); };
function zorder(dir) { if (!sel.size) return; const P = page().objs.slice(), s = P.filter(o => sel.has(o.id)), r = P.filter(o => !sel.has(o.id)); E.reorder((dir > 0 ? r.concat(s) : s.concat(r)).map(o => o.id)); }
function align(how) { const objs = selObjs(); if (objs.length < 2) return; const b = selBox(); mod(objs, o => { const ob = bbox(E.clean(o)) || bbox(o); let dx = 0, dy = 0; if (how === 'l') dx = b[0] - ob[0]; if (how === 'r') dx = b[0] + b[2] - ob[0] - ob[2]; if (how === 'c') dx = b[0] + b[2] / 2 - ob[0] - ob[2] / 2; if (how === 't') dy = b[1] - ob[1]; if (how === 'b') dy = b[1] + b[3] - ob[1] - ob[3]; if (how === 'm') dy = b[1] + b[3] / 2 - ob[1] - ob[3] / 2; applyT(o, E.clean(o), { dx, dy }); });
  if (how === 'dh' || how === 'dv') { const list = objs.map(o => [o, bbox(o)]).sort((p, q) => how === 'dh' ? p[1][0] - q[1][0] : p[1][1] - q[1][1]); const tot = list.reduce((a, [, bb]) => a + (how === 'dh' ? bb[2] : bb[3]), 0), gap = ((how === 'dh' ? b[2] : b[3]) - tot) / (list.length - 1); let pos = how === 'dh' ? b[0] : b[1]; mod(list.map(l => l[0]), o => { const bb = bbox(o); const d = pos - (how === 'dh' ? bb[0] : bb[1]); applyT(o, E.clean(o), how === 'dh' ? { dx: d, dy: 0 } : { dx: 0, dy: d }); pos += (how === 'dh' ? bb[2] : bb[3]) + gap; }); } }
const deleteSel = () => { if (!sel.size) return; del(selObjs()); clearSel(); };
function insertObj(o, opts) { opts = opts || {}; const vr = E.viewRect(); if (o.x == null) { o.x = vr[0] + vr[2] / 2 - (o.w || 200) / 2 + (Math.random() - 0.5) * 60; o.y = vr[1] + vr[3] / 2 - (o.h || 200) / 2 + (Math.random() - 0.5) * 40; } if (B.mode === 'scroll') { o.x = clamp(o.x, 10, B.width - (o.w || 100) - 10); o.y = Math.max(10, o.y); } add(o, opts.layer); if (!opts.noSelect) { setTool('select'); select(o); } SND.pop(); return o; }

/* ---------- keyboard shortcuts ---------- */
document.addEventListener('keydown', e => { const tg = e.target.tagName; if (tg === 'TEXTAREA' || tg === 'INPUT' || tg === 'SELECT' || e.target.isContentEditable) return; if (window.HB.modal.isOpen) { if (e.key === 'Escape') window.HB.modal.close(); return; }
  const k = e.key, ctl = e.ctrlKey || e.metaKey;
  if (k === ' ') { spaceDown = true; cv.style.cursor = 'grab'; e.preventDefault(); return; }
  if (ctl && k.toLowerCase() === 'z') { e.preventDefault(); e.shiftKey ? E.redo() : E.undo(); return; } if (ctl && k.toLowerCase() === 'y') { e.preventDefault(); E.redo(); return; }
  if (ctl && k.toLowerCase() === 'c') { copySel(); return; } if (ctl && k.toLowerCase() === 'x') { copySel(); deleteSel(); return; } if (ctl && k.toLowerCase() === 'v') { if (clip) { e.preventDefault(); pasteClip(30); } return; }
  if (ctl && k.toLowerCase() === 'd') { e.preventDefault(); duplicate(); return; } if (ctl && k.toLowerCase() === 'a') { e.preventDefault(); setTool('select'); select(page().objs.filter(o => !o.locked && !layerLocked(o))); return; } if (ctl && k.toLowerCase() === 'g') { e.preventDefault(); e.shiftKey ? ungroup() : group(); return; }
  if (ctl) return;
  if (k === 'Delete' || k === 'Backspace') { deleteSel(); return; } if (k === 'Escape') { clearSel(); if (editing) commitEdit(); return; }
  if (k.startsWith('Arrow') && sel.size) { e.preventDefault(); const st = e.shiftKey ? 20 : 2; nudge(k === 'ArrowLeft' ? -st : k === 'ArrowRight' ? st : 0, k === 'ArrowUp' ? -st : k === 'ArrowDown' ? st : 0); return; }
  const map = { p: ['draw', 'pen'], h: ['draw', 'hi'], e: ['erase'], v: ['select'], t: ['text'], l: ['laser'], n: ['note'] }; const m = map[k.toLowerCase()]; if (m && !e.shiftKey) { setTool(m[0], m[1]); return; }
  if (k.toLowerCase() === 's' && !e.shiftKey) { const order = ['rect', 'ellipse', 'tri', 'arrow', 'line']; const i = order.indexOf(T.shape); setTool('shape', T.tool === 'shape' ? order[(i + 1) % order.length] : T.shape); return; }
  if (k === '[') setSize(T.size - 1); if (k === ']') setSize(T.size + 1);
  if (/^[1-8]$/.test(k)) { setColor(E.PALETTE[E.isDark() ? 'dark' : 'light'][+k - 1]); }
  if (k.toLowerCase() === 'm' && !e.shiftKey) { SND.muted = !SND.muted; toast(SND.muted ? 'Sound off' : 'Sound on'); } });
document.addEventListener('keyup', e => { if (e.key === ' ' && spaceDown) { spaceDown = false; if (!editing) setTool(T.tool); } }); /* only end a space-pan that really started — typing a space in a text box must never close it */

/* ---------- paste and drop: images, PDFs, boards ---------- */
function readImage(file, at) { const r = new FileReader(); r.onload = () => insertImage(r.result, at); r.readAsDataURL(file); }
function insertImage(src, at) { const im = new Image(); im.onload = () => { const id = 'a' + uid(); E.B.assets[id] = downscale(im, src); const vr = E.viewRect(); let w = im.naturalWidth, h = im.naturalHeight; const max = Math.min(vr[2] * 0.6, 900); if (w > max) { h *= max / w; w = max; } const o = { t: 'img', asset: id, w, h }; if (at) { o.x = at[0] - w / 2; o.y = at[1] - h / 2; } insertObj(o); }; im.src = src; }
const downscale = (im, src) => { const M = 2400; if (im.naturalWidth <= M && im.naturalHeight <= M) return src; const k = M / Math.max(im.naturalWidth, im.naturalHeight), c = document.createElement('canvas'); c.width = Math.round(im.naturalWidth * k); c.height = Math.round(im.naturalHeight * k); c.getContext('2d').drawImage(im, 0, 0, c.width, c.height); return c.toDataURL('image/jpeg', 0.88); };
document.addEventListener('paste', e => { const tg = e.target.tagName; if (tg === 'TEXTAREA' || tg === 'INPUT') return; const items = [...(e.clipboardData || {}).items || []]; const img = items.find(i => i.type.startsWith('image/')); if (img) { e.preventDefault(); readImage(img.getAsFile()); return; } const txt = e.clipboardData.getData('text/plain'); if (txt && !clip) { e.preventDefault(); insertObj({ t: 'text', s: txt, font: T.font, size: T.fsize, c: T.color, w: 0 }); } });
stage.addEventListener('dragover', e => { e.preventDefault(); }); stage.addEventListener('drop', e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (!f) return; const at = toB(e.clientX, e.clientY); if (f.type.startsWith('image/')) readImage(f, at); else if (f.type === 'application/pdf' || /\.pdf$/i.test(f.name)) bus.emit('import-pdf', f); else if (/\.hbset$/i.test(f.name)) { if (window.HBL) window.HBL.importFiles([f]); } else if (/\.hbhw$/i.test(f.name)) { if (window.HBL) window.HBL.importHomework([...e.dataTransfer.files]); } else if (/\.hbres$/i.test(f.name)) { if (window.HBL) window.HBL.importResults([...e.dataTransfer.files]); } else if (/\.helix$|\.json$/i.test(f.name)) bus.emit('open-file', f); else if (/\.(docx?|pptx?|txt|md)$/i.test(f.name)) bus.emit('open-doc', f); });

window.HBI = { radial, T, sel, setTool, setColor, setSize, select, clearSel, selObjs, selBox, hitTop, openEditor, commitEdit, insertText, transformSelection, get editing() { return editing; }, insertObj, insertImage, readImage, copySel, pasteClip, duplicate, group, ungroup, zorder, align, deleteSel, applyT, NOTE_COLORS, laserPts, layerLocked, vecLabel };
})();

