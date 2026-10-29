/* ================= HelixBoard — Concept maps, Miro style =================
   Nodes are rounded boxes on the board joined by smooth, colour-coded branches. Select a node and press Tab for a child, Enter for a
   sibling, Delete to remove the branch; double-click to type. A small bar above the selected node adds children, changes colour and
   shape, links two ideas with labelled arrows (cross-links), folds branches and switches layout (mind map, tree to the right, top-down).
   The map tidies itself after every change and a dragged node takes its branch with it. Everything is ordinary board objects,
   so Undo, saving, export and the slideshow all work. */
(() => {
'use strict';
const { $, $$, esc, icon, set, bus, toast, modal, uid, SND, REDUCE } = window.HB;
const E = window.HBE, I = window.HBI;
const PAL = ['#FF5FA2', '#22D3EE', '#F59F00', '#40C057', '#7950F2', '#FD7E14', '#15AABF', '#E64980'];
const GX = 64, GY = 26, DGX = 30, DGY = 72;
const P = () => E.page().objs;
const isNode = o => o && o.t === 'note' && o.nd && o.mm;
const nodes = mm => P().filter(o => isNode(o) && o.mm === mm);
const rootOf = mm => P().find(o => isNode(o) && o.mm === mm && o.root);
const kids = (n, all) => (all || nodes(n.mm)).filter(o => o.par === n.id).sort((a, b) => (a.ord || 0) - (b.ord || 0));
const tint = (hex, k) => { const n = parseInt(hex.slice(1), 16), r = n >> 16, g = (n >> 8) & 255, b = n & 255, m = v => Math.round(v + (255 - v) * k); return '#' + [m(r), m(g), m(b)].map(v => v.toString(16).padStart(2, '0')).join(''); };
const snd = k => { try { SND[k] && SND[k](); } catch (e) {} };

/* ---------- size a node to its text ---------- */
function fit(o) { const size = o.size || 22, L1 = E.textLayout({ s: o.s || 'Type…', size, font: o.font || 'Lexend', w: 0, b: o.root }); const max = o.root ? 380 : 320;
  let w = Math.max(o.root ? 170 : 110, Math.min(max, L1.w + 36)); const L = E.textLayout({ s: o.s || 'Type…', size, font: o.font || 'Lexend', w: w - 28, b: o.root });
  return { w, h: Math.max(o.root ? 70 : 50, L.h + (o.root ? 30 : 22)) }; }

/* ---------- layout: mind map (both sides), tree to the right, or top-down ---------- */
function layout(mm, anchor) { const all = nodes(mm), root = all.find(o => o.root); if (!root) return; const mode = root.lay || 'mind', vis = n => !n.col;
  const pos = new Map();
  if (mode === 'down') {
    const W = n => { const ks = vis(n) ? kids(n, all) : []; return Math.max(n.w, ks.reduce((a, k) => a + W(k), 0) + DGX * Math.max(0, ks.length - 1)); };
    const place = (n, cx, y) => { pos.set(n.id, [cx - n.w / 2, y]); const ks = vis(n) ? kids(n, all) : []; let x = cx - (ks.reduce((a, k) => a + W(k), 0) + DGX * Math.max(0, ks.length - 1)) / 2; ks.forEach(k => { const w = W(k); place(k, x + w / 2, y + n.h + DGY); x += w + DGX; }); };
    place(root, root.x + root.w / 2, root.y);
  } else {
    const H = n => { const ks = vis(n) ? kids(n, all) : []; return Math.max(n.h, ks.reduce((a, k) => a + H(k), 0) + GY * Math.max(0, ks.length - 1)); };
    const place = (n, side, edge, cy) => { pos.set(n.id, [side > 0 ? edge : edge - n.w, cy - n.h / 2]); const ks = vis(n) ? kids(n, all) : []; let y = cy - (ks.reduce((a, k) => a + H(k), 0) + GY * Math.max(0, ks.length - 1)) / 2;
      ks.forEach(k => { const h = H(k); place(k, side, side > 0 ? edge + n.w + GX : edge - n.w - GX, y + h / 2); y += h + GY; }); };
    pos.set(root.id, [root.x, root.y]); const rcy = root.y + root.h / 2;
    [1, -1].forEach(side => { const ks = kids(root, all).filter(k => mode === 'right' ? true : (k.side || 1) === side); if (mode === 'right' && side < 0) return;
      const tot = ks.reduce((a, k) => a + H(k), 0) + GY * Math.max(0, ks.length - 1); let y = rcy - tot / 2;
      ks.forEach(k => { const h = H(k); place(k, side, side > 0 ? root.x + root.w + GX * 1.4 : root.x - GX * 1.4, y + h / 2); y += h + GY; }); });
  }
  /* keep the anchor node (the one being worked on) still, so the map grows around the teacher's attention instead of jumping */
  let dx = 0, dy = 0; const an = anchor && pos.get(anchor.id); if (an) { dx = anchor.x - an[0]; dy = anchor.y - an[1]; }
  const hidden = new Set(); const hide = n => kids(n, all).forEach(k => { hidden.add(k.id); hide(k); }); all.filter(n => n.col).forEach(hide);
  E.tx(() => { all.forEach(n => { const p = pos.get(n.id); const off = hidden.has(n.id); if (!p && !off) return; const nx = p ? Math.round(p[0] + dx) : n.x, ny = p ? Math.round(p[1] + dy) : n.y, side = mode === 'right' || mode === 'down' ? 1 : n.side;
      if (n.x !== nx || n.y !== ny || !!n.off !== off || n.mx !== nx) E.mod(n, q => { q.x = nx; q.y = ny; q.mx = nx; q.my = ny; q.off = off || undefined; }); });
    P().filter(c => c.t === 'conn' && c.mm === mm).forEach(c => { const off = hidden.has(c.a) || hidden.has(c.b), cv = c.tree ? (mode === 'down' ? 2 : 1) : c.cv; if (!!c.off !== off || c.cv !== cv) E.mod(c, q => { q.off = off || undefined; if (q.tree) q.cv = cv; }); }); });
  E.dirty.all(); E.changed(); setTimeout(bar, 0); }

/* ---------- building ---------- */
function makeNode(mm, props) { const o = Object.assign({ id: uid(), t: 'note', nd: 1, mm, s: '', size: 22, font: 'Lexend', shape: 'round', c: '#FFFFFF', bc: '#7950F2', x: 0, y: 0, w: 140, h: 52 }, props); const f = fit(o); o.w = f.w; o.h = f.h; return o; }
function branch(mm, a, b, color) { return { id: uid(), t: 'conn', mm, tree: 1, cv: 1, k: 'line', a: a.id, b: b.id, c: color, w: 3 }; }
function newMap(title, children, lay) { const vr = E.viewRect(), mm = 'm' + uid(); const root = makeNode(mm, { root: true, s: title == null ? 'Main idea' : title, size: 30, c: '#2B1B3D', tc: '#FFFFFF', bc: '#2B1B3D', shape: 'pill', lay: lay || 'mind' });
  root.x = Math.round(vr[0] + vr[2] / 2 - root.w / 2); root.y = Math.round(vr[1] + vr[3] / 2 - root.h / 2); const objs = [root];
  const add = (parent, list, depth, color, sideOf) => list.forEach((it, i) => { const [text, sub] = Array.isArray(it) ? it : [it, []]; const col = depth === 1 ? PAL[i % PAL.length] : color;
    const n = makeNode(mm, { par: parent.id, ord: i, s: text, bc: col, c: depth === 1 ? tint(col, 0.82) : '#FFFFFF', size: depth === 1 ? 22 : 19, side: depth === 1 ? (lay === 'mind' || !lay ? (i % 2 ? -1 : 1) : 1) : sideOf });
    objs.push(n, branch(mm, parent, n, col)); add(n, sub || [], depth + 1, col, n.side); });
  add(root, children || [], 1, null, 1);
  E.tx(() => E.add(objs, 1)); layout(mm, root); I.select(root); snd('pop'); return root; }
/* a new idea: one Undo step removes it again; it is scrolled into view and opened for typing; left empty, it disappears */
function addChild(n, edit, forceSide) { n = E.byId(n.id) || n; const h0 = E.histLen(); const all = nodes(n.mm), ks = kids(n, all); let side = n.side || 1, color = n.bc;
  if (n.root) { const r = ks.filter(k => (k.side || 1) === 1).length, l = ks.length - r; side = (n.lay || 'mind') === 'mind' ? (forceSide || (r > l ? -1 : 1)) : 1; color = PAL[ks.length % PAL.length]; }
  const k = makeNode(n.mm, { par: n.id, ord: ks.length ? Math.max(...ks.map(x => x.ord || 0)) + 1 : 0, side, bc: color, c: n.root ? tint(color, 0.82) : '#FFFFFF', size: n.root ? 22 : 19, x: n.x + n.w + GX, y: n.y });
  E.tx(() => { if (n.col) E.mod(n, q => { delete q.col; }); E.add([k, branch(n.mm, n, k, color)], 1); layout(n.mm, n); }); after(k, edit, h0); return k; }
function addSibling(n) { n = E.byId(n.id) || n; const h0 = E.histLen(); if (n.root || !n.par) return addChild(n); const p = E.byId(n.par); if (!p) return; const all = nodes(n.mm), sib = kids(p, all), at = (n.ord || 0) + 0.5;
  const k = makeNode(n.mm, { par: p.id, ord: at, side: n.side, bc: n.bc, c: n.c, size: n.size, x: n.x, y: n.y + n.h + GY });
  E.tx(() => { E.add([k, branch(n.mm, p, k, n.bc)], 1); sib.concat([k]).sort((a, b) => (a.ord || 0) - (b.ord || 0)).forEach((s, i) => { if (s.ord !== i) E.mod(s, q => { q.ord = i; }); }); layout(n.mm, p); });
  after(k, true, h0); return k; }
const fresh = new Map();
function after(k, edit, h0) { fresh.set(k.id, h0); I.select(k); show(k); if (edit !== false) setTimeout(() => I.openEditor(E.byId(k.id) || k), 30); snd('pop'); }
/* pan just enough that the idea (and room to keep typing) is on screen */
function show(n) { const V = E.V, m = 70, x0 = n.x * V.s + V.x, y0 = n.y * V.s + V.y, x1 = (n.x + n.w) * V.s + V.x, y1 = (n.y + n.h) * V.s + V.y; let dx = 0, dy = 0;
  if (x0 < m + 40) dx = m + 40 - x0; else if (x1 > E.SW - m) dx = E.SW - m - x1; if (y0 < m + 40) dy = m + 40 - y0; else if (y1 > E.SH - m - 80) dy = E.SH - m - 80 - y1; if (dx || dy) E.setView(V.s, V.x + dx, V.y + dy); }
function descendants(n) { const all = nodes(n.mm), out = []; const walk = x => kids(x, all).forEach(k => { out.push(k); walk(k); }); walk(n); return out; }
function removeBranch(n, quiet) { if (n.root) { const all = nodes(n.mm), ids = new Set(all.map(x => x.id)); E.tx(() => E.del(P().filter(o => ids.has(o.id) || (o.t === 'conn' && o.mm === n.mm)))); I.clearSel(); toast('Concept map deleted (Undo brings it back).'); return; }
  const gone = [n].concat(descendants(n)), ids = new Set(gone.map(x => x.id)), p = E.byId(n.par);
  E.tx(() => E.del(P().filter(o => ids.has(o.id) || (o.t === 'conn' && (ids.has(o.a) || ids.has(o.b)))))); if (!quiet || !I.editing) I.clearSel(); if (p) { layout(p.mm, p); if (!quiet || !I.editing) I.select(p); } }
function recolor(n, col) { const list = [n].concat(descendants(n)); E.tx(() => { list.forEach((x, i) => E.mod(x, q => { q.bc = col; if (!q.root) q.c = x.par && E.byId(x.par) && E.byId(x.par).root ? tint(col, 0.82) : (i === 0 ? tint(col, 0.82) : '#FFFFFF'); }));
    const ids = new Set(list.map(x => x.id)); P().filter(c => c.t === 'conn' && c.tree && ids.has(c.b)).forEach(c => E.mod(c, q => { q.c = col; })); }); E.dirty.all(); E.changed(); }
function setShape(n, sh) { const list = I.selObjs().filter(isNode); E.tx(() => (list.length ? list : [n]).forEach(x => E.mod(x, q => { q.shape = sh; }))); E.dirty.all(); E.changed(); }
function toggleFold(n) { const d = descendants(n).length; if (!d && !n.col) { toast('This idea has no branches to fold.'); return; } E.mod(n, q => { if (q.col) delete q.col; else q.col = d; }); layout(n.mm, n); }
function setLayout(n, lay) { const root = rootOf(n.mm); if (!root) return; E.tx(() => { E.mod(root, q => { q.lay = lay; }); if (lay === 'mind') kids(root).forEach((k, i) => E.mod(k, q => { q.side = i % 2 ? -1 : 1; })); }); layout(n.mm, root); }
/* a cross-link: a labelled arrow between any two ideas — the heart of a concept map */
let linking = null;
function startLink(n) { linking = n; toast('Now tap the idea to link “' + esc((n.s || 'this idea').slice(0, 40)) + '” to. Esc cancels.', 5000); bar(); }
function finishLink(target) { const a = linking; linking = null; if (!a || !target || target.id === a.id) { bar(); return; }
  const lab = (window.prompt('Linking words (for example: produces, is part of, needs):', '') || '').trim().slice(0, 40);
  E.tx(() => E.add([{ id: uid(), t: 'conn', mm: a.mm, a: a.id, b: target.id, k: 'arrow', c: '#5C4A6B', w: 2.5, dash: 1, label: lab }], 1)); E.dirty.all(); E.changed(); I.select(a); snd('pop'); }
function fitView(n) { const all = nodes(n.mm).filter(x => !x.off); if (!all.length) return; let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9; all.forEach(o => { x0 = Math.min(x0, o.x); y0 = Math.min(y0, o.y); x1 = Math.max(x1, o.x + o.w); y1 = Math.max(y1, o.y + o.h); });
  const pad = 60, s = Math.min(3, (E.SW - pad * 2) / (x1 - x0), (E.SH - pad * 2 - 90) / (y1 - y0)); E.setView(s, E.SW / 2 - (x0 + x1) / 2 * s, (E.SH - 90) / 2 - (y0 + y1) / 2 * s + 10); }

/* ---------- the bar above the selected node ---------- */
const css = document.createElement('style'); css.textContent = `
#mmBar{position:fixed;z-index:31;display:flex;align-items:center;gap:2px;padding:4px;border-radius:14px;background:var(--glass);border:1px solid var(--line2,var(--line));box-shadow:var(--shadow);backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);white-space:nowrap}
#mmPlus button{position:fixed;z-index:30;width:28px;height:28px;margin:-14px 0 0 -14px;border-radius:50%;border:2px solid #fff;background:var(--bc);color:#fff;font:800 18px/1 var(--ui);display:grid;place-items:center;cursor:pointer;box-shadow:0 4px 12px rgba(0,0,0,.28);transition:transform .12s;padding:0}
#mmPlus button:hover{transform:scale(1.18)}#mmPlus button.sib{width:24px;height:24px;margin:-12px 0 0 -12px;font-size:15px;opacity:.9}
#mmBar button{display:inline-flex;align-items:center;gap:5px;height:32px;min-width:32px;padding:0 8px;border:0;border-radius:10px;background:transparent;color:var(--ink);font:600 12px var(--ui);cursor:pointer}
#mmBar button:hover{background:var(--panel3)}#mmBar button.on{background:var(--grad,var(--accent));color:#fff}
#mmBar svg.ic{width:16px;height:16px}#mmBar .sep{width:1px;height:20px;background:var(--line);margin:0 2px}
#mmBar .sw{width:18px;height:18px;border-radius:50%;border:2px solid #fff;box-shadow:0 0 0 1px var(--line)}
#mmPop{position:fixed;z-index:32;padding:8px;border-radius:14px;background:var(--panel);border:1px solid var(--line);box-shadow:var(--shadow);display:grid;gap:6px}
#mmPop .row{display:flex;gap:6px}#mmPop button{border:1px solid var(--line);background:var(--panel2);color:var(--ink);border-radius:9px;padding:6px 10px;font:600 12px var(--ui);cursor:pointer}
#mmPop .c{width:26px;height:26px;border-radius:50%;padding:0;border:2px solid #fff;box-shadow:0 0 0 1px var(--line)}`;
document.head.appendChild(css);
let barEl = null, popEl = null, lastBar = null;
function closePop() { if (popEl) { popEl.remove(); popEl = null; } }
function bar() { const sel = I.selObjs(), n = sel.length >= 1 && sel.every(isNode) ? sel[sel.length - 1] : null;
  if (!n || I.editing || document.body.classList.contains('deckshow') || document.body.classList.contains('presenting')) { if (barEl) { barEl.remove(); barEl = null; } if (plusEl) { plusEl.remove(); plusEl = null; } closePop(); return; }
  if (!barEl) { barEl = document.createElement('div'); barEl.id = 'mmBar'; document.body.appendChild(barEl); ['pointerdown', 'wheel'].forEach(ev => barEl.addEventListener(ev, e => e.stopPropagation())); }
  const root = rootOf(n.mm), lay = (root && root.lay) || 'mind', d = descendants(n).length;
  barEl.innerHTML = '<button data-a="child" title="Add a child idea (Tab)">' + icon('git-branch-plus') + 'Child</button><button data-a="sib" title="Add a sibling idea (Enter)">' + icon('plus') + 'Sibling</button><span class="sep"></span>' +
    '<button data-a="color" title="Branch colour"><span class="sw" style="background:' + esc(n.bc || '#7950F2') + '"></span></button><button data-a="shape" title="Shape">' + icon('square') + '</button><button data-a="link" class="' + (linking ? 'on' : '') + '" title="Link to another idea with linking words">' + icon('link') + 'Link</button>' +
    (d || n.col ? '<button data-a="fold" title="' + (n.col ? 'Show the branch' : 'Fold the branch') + '">' + icon(n.col ? 'unfold-horizontal' : 'fold-horizontal') + '</button>' : '') + '<span class="sep"></span>' +
    '<button data-a="layout" title="Layout">' + icon(lay === 'down' ? 'network' : 'list-tree') + '</button><button data-a="fit" title="Show the whole map">' + icon('maximize-2') + '</button><button data-a="del" title="Delete this idea and its branch (Delete)">' + icon('trash-2') + '</button>';
  if (n.id !== lastBar) { lastBar = n.id; if (!I.editing) { const before = E.V.y + ',' + E.V.x; show(n); if (before !== E.V.y + ',' + E.V.x) return; } }
  place(n); plus(n);
  $$('button', barEl).forEach(b => b.onclick = e => { e.stopPropagation(); const a = b.dataset.a; closePop();
    if (a === 'child') addChild(n); else if (a === 'sib') addSibling(n); else if (a === 'fold') toggleFold(n); else if (a === 'fit') fitView(n); else if (a === 'del') removeBranch(n); else if (a === 'link') { if (linking) { linking = null; bar(); } else startLink(n); }
    else pop(a, n, b); }); }
/* the bar goes above the idea, or below it, wherever it does not cover another idea (so a click always lands where it looks) */
function place(n) { const st = document.getElementById('stage').getBoundingClientRect(), bw = barEl.offsetWidth, bh = barEl.offsetHeight, V = E.V;
  const rectOf = o => [st.left + o.x * V.s + V.x, st.top + o.y * V.s + V.y, o.w * V.s, o.h * V.s], me = rectOf(n), gap = 14;
  const others = P().filter(o => isNode(o) && !o.off && o.id !== n.id).map(rectOf), hits = (x, y) => others.some(r => x < r[0] + r[2] && x + bw > r[0] && y < r[1] + r[3] && y + bh > r[1]);
  const cx = Math.max(st.left + 8, Math.min(st.right - bw - 8, me[0] + me[2] / 2 - bw / 2)), cands = [[cx, me[1] - bh - gap - 14], [cx, me[1] + me[3] + gap + 14], [me[0] + me[2] + 40, me[1] + me[3] / 2 - bh / 2], [me[0] - bw - 40, me[1] + me[3] / 2 - bh / 2]];
  const ok = ([x, y]) => x >= st.left + 4 && x + bw <= st.right - 4 && y >= st.top + 44 && y + bh <= st.bottom - 90 && !hits(x, y);
  const c = cands.find(ok) || [st.left + st.width / 2 - bw / 2, st.top + 52]; barEl.style.left = Math.round(c[0]) + 'px'; barEl.style.top = Math.round(c[1]) + 'px'; }
/* round + handles on the selected idea, like Miro: on the side where its branches grow (child) and below it (sibling) — easy to hit with a finger or pen */
let plusEl = null;
function plus(n) { if (!plusEl) { plusEl = document.createElement('div'); plusEl.id = 'mmPlus'; document.body.appendChild(plusEl); ['pointerdown', 'wheel'].forEach(ev => plusEl.addEventListener(ev, e => e.stopPropagation())); }
  const st = document.getElementById('stage').getBoundingClientRect(), V = E.V, x = st.left + n.x * V.s + V.x, y = st.top + n.y * V.s + V.y, w = n.w * V.s, h = n.h * V.s, root = rootOf(n.mm), lay = (root && root.lay) || 'mind', H = [];
  if (lay === 'down') { H.push(['c', x + w / 2, y + h + 18, 'Add a child idea below']); if (!n.root) H.push(['s', x + w + 18, y + h / 2, 'Add a sibling idea']); }
  else if (n.root) { H.push(['c', x + w + 18, y + h / 2, 'Add an idea on the right', 1]); if (lay === 'mind') H.push(['c', x - 18, y + h / 2, 'Add an idea on the left', -1]); }
  else { const sd = n.side || 1; H.push(['c', sd > 0 ? x + w + 18 : x - 18, y + h / 2, 'Add a child idea (Tab)']); H.push(['s', x + w / 2, y + h + 16, 'Add a sibling idea below (Enter)']); }
  plusEl.innerHTML = H.map(([k, hx, hy, t], i) => '<button data-i="' + i + '" class="' + (k === 's' ? 'sib' : '') + '" title="' + t + '" style="left:' + Math.round(hx) + 'px;top:' + Math.round(hy) + 'px;--bc:' + esc(n.bc || '#7950F2') + '">+</button>').join('');
  $$('button', plusEl).forEach(b => b.onclick = e => { e.stopPropagation(); const h = H[+b.dataset.i]; if (h[0] === 'c') addChild(n, true, h[4]); else addSibling(n); }); }
function pop(kind, n, btn) { closePop(); popEl = document.createElement('div'); popEl.id = 'mmPop'; const r = btn.getBoundingClientRect(); popEl.style.left = r.left + 'px'; popEl.style.top = (r.bottom + 6) + 'px';
  if (kind === 'color') popEl.innerHTML = '<div class="row">' + PAL.concat(['#495057', '#2B1B3D']).map(c => '<button class="c" data-c="' + c + '" style="background:' + c + '"></button>').join('') + '</div>';
  if (kind === 'shape') popEl.innerHTML = '<div class="row">' + [['round', 'Rounded'], ['pill', 'Pill'], ['rect', 'Box'], ['ellipse', 'Oval']].map(([k, l]) => '<button data-s="' + k + '">' + l + '</button>').join('') + '</div>';
  if (kind === 'layout') popEl.innerHTML = '<div class="row">' + [['mind', 'Mind map'], ['right', 'Tree →'], ['down', 'Top-down']].map(([k, l]) => '<button data-l="' + k + '">' + l + '</button>').join('') + '</div><div class="row"><button data-tidy="1">Tidy up</button></div>';
  document.body.appendChild(popEl); popEl.addEventListener('pointerdown', e => e.stopPropagation());
  $$('[data-c]', popEl).forEach(b => b.onclick = () => { recolor(n, b.dataset.c); closePop(); bar(); });
  $$('[data-s]', popEl).forEach(b => b.onclick = () => { setShape(n, b.dataset.s); closePop(); });
  $$('[data-l]', popEl).forEach(b => b.onclick = () => { setLayout(n, b.dataset.l); closePop(); });
  $$('[data-tidy]', popEl).forEach(b => b.onclick = () => { layout(n.mm, rootOf(n.mm)); closePop(); }); }
['selection', 'view', 'editing', 'page'].forEach(ev => bus.on(ev, () => setTimeout(bar, 0)));
document.addEventListener('pointerdown', e => { if (popEl && !e.target.closest('#mmPop,#mmBar')) closePop(); }, true);
bus.on('selection', objs => { if (linking && objs && objs.length === 1 && isNode(objs[0]) && objs[0].id !== linking.id) finishLink(objs[0]); });

/* a new idea left empty (Esc, or a click elsewhere before typing) is removed again */
let editingNode = null;
bus.on('editing', on => { if (on) { const ed = I.editing; editingNode = ed && isNode(ed.o) ? ed.o.id : null; return; } const id = editingNode; editingNode = null; if (!id) return;
  setTimeout(() => { const n = E.byId(id); if (!n || !fresh.has(id)) return; const h0 = fresh.get(id); fresh.delete(id);
    /* typed: adding it and typing in it are one Undo step. Left empty: it is removed and leaves nothing to undo */
    if ((n.s || '').trim() || n.root || kids(n).length) { E.squash(h0); return; } removeBranch(n, true); E.squash(h0, true); }, 20); });
/* after typing: the node grows to fit its words and the map tidies itself */
bus.on('text-done', o => { if (!isNode(o)) return; const f = fit(o); E.tx(() => { if (Math.abs(f.w - o.w) > 1 || Math.abs(f.h - o.h) > 1) { E.mod(o, q => { q.w = f.w; q.h = f.h; }); } layout(o.mm, o); }); });
/* dragging an idea takes its whole branch with it */
bus.on('moved', ev => { if (!ev || ev.mode !== 'move') return; const moved = (ev.objs || []).filter(isNode); if (!moved.length) return; const ids = new Set(ev.objs.map(o => o.id));
  E.tx(() => moved.forEach(n => { if (n.mx == null) return; const dx = n.x - n.mx, dy = n.y - n.my; if (!dx && !dy) return;
    descendants(n).forEach(k => { if (!ids.has(k.id)) E.mod(k, q => { q.x += dx; q.y += dy; q.mx = q.x; q.my = q.y; }); }); E.mod(n, q => { q.mx = q.x; q.my = q.y; });
    /* a first-level idea dragged across the centre changes side */
    const p = n.par && E.byId(n.par); if (p && p.root && (p.lay || 'mind') === 'mind') { const side = n.x + n.w / 2 >= p.x + p.w / 2 ? 1 : -1; if (side !== n.side) { E.mod(n, q => { q.side = side; }); descendants(n).forEach(k => E.mod(k, q => { q.side = side; })); } } }));
  E.dirty.all(); E.changed(); setTimeout(bar, 0); });

/* keys: Tab child, Enter sibling, Delete branch — while selected or while typing in a node */
document.addEventListener('keydown', e => { const ed = I.editing;
  if (linking && e.key === 'Escape') { linking = null; bar(); toast('Link cancelled.'); return; }
  if (ed && isNode(ed.o)) { const n = ed.o; if (e.key === 'Tab') { e.preventDefault(); e.stopPropagation(); I.commitEdit(); setTimeout(() => addChild(E.byId(n.id) || n), 10); } else if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); e.stopPropagation(); I.commitEdit(); setTimeout(() => addSibling(E.byId(n.id) || n), 10); } return; }
  if (ed || /INPUT|TEXTAREA|SELECT/.test(e.target.tagName) || e.target.isContentEditable) return;
  const sel = I.selObjs(); if (sel.length !== 1 || !isNode(sel[0])) return; const n = sel[0];
  if (e.key === 'Tab') { e.preventDefault(); e.stopPropagation(); addChild(n); }
  else if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); addSibling(n); }
  else if (/^Arrow/.test(e.key)) { const t = neighbour(n, e.key); if (t) { e.preventDefault(); e.stopPropagation(); I.select(t); show(t); } }
  else if (e.key === 'F2' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); I.openEditor(n); }
  else if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); e.stopPropagation(); removeBranch(n); } }, true);

/* arrow keys walk the map: towards the branches, back to the parent, up and down through the siblings */
function neighbour(n, key) { const root = rootOf(n.mm), down = root && root.lay === 'down', all = nodes(n.mm).filter(o => !o.off), ks = kids(n, all), p = n.par && E.byId(n.par);
  const out = down ? 'ArrowDown' : (n.side || 1) > 0 ? 'ArrowRight' : 'ArrowLeft', back = down ? 'ArrowUp' : (n.side || 1) > 0 ? 'ArrowLeft' : 'ArrowRight', prevK = down ? 'ArrowLeft' : 'ArrowUp', nextK = down ? 'ArrowRight' : 'ArrowDown';
  if (n.root && !down) { const want = key === 'ArrowRight' ? 1 : key === 'ArrowLeft' ? -1 : 0; return want ? ks.find(k => (k.side || 1) === want) : null; }
  if (key === out) return ks[0] || null; if (key === back) return p || null;
  if (p && (key === prevK || key === nextK)) { const sib = kids(p, all).filter(k => p.root && !down ? (k.side || 1) === (n.side || 1) : true), i = sib.findIndex(k => k.id === n.id); return sib[i + (key === nextK ? 1 : -1)] || null; } return null; }

/* ---------- pen on a smartboard: a tap on an idea selects it, a double tap types in it, a drag moves its branch (no stray ink) ---------- */
let penTap = null;
document.addEventListener('pointerdown', e => { if (e.target.id !== 'cvLive' || e.button !== 0 || I.editing) return; const T = I.T; if (!T || !['draw', 'laser'].includes(T.tool)) return;
  const r = e.target.getBoundingClientRect(), V = E.V, x = (e.clientX - r.left - V.x) / V.s, y = (e.clientY - r.top - V.y) / V.s, n = P().filter(o => isNode(o) && !o.off).reverse().find(o => x >= o.x && x <= o.x + o.w && y >= o.y && y <= o.y + o.h); if (!n) return;
  e.stopImmediatePropagation(); e.preventDefault(); const dbl = penTap && penTap.id === n.id && Date.now() - penTap.t < 380; penTap = null;
  if (dbl) { I.openEditor(n); return; }
  const sx = e.clientX, sy = e.clientY, start = [n].concat(descendants(n)).map(o => [o, o.x, o.y]); let moved = false;
  const mv = ev => { const dx = (ev.clientX - sx) / V.s, dy = (ev.clientY - sy) / V.s; if (!moved && Math.hypot(ev.clientX - sx, ev.clientY - sy) < 8) return; moved = true; start.forEach(([o, ox, oy]) => { o.x = ox + dx; o.y = oy + dy; E.invalidate(o); }); E.dirty.all(); };
  const up = () => { removeEventListener('pointermove', mv, true); removeEventListener('pointerup', up, true); removeEventListener('pointercancel', up, true);
    if (!moved) { penTap = { id: n.id, t: Date.now() }; I.select(n); return; } const fx = n.x, fy = n.y; start.forEach(([o, ox, oy]) => { o.x = ox; o.y = oy; E.invalidate(o); }); E.tx(() => E.mod(n, q => { q.x = fx; q.y = fy; })); bus.emit('moved', { objs: [n], mode: 'move' }); I.select(n); };
  addEventListener('pointermove', mv, true); addEventListener('pointerup', up, true); addEventListener('pointercancel', up, true); }, true);

/* ---------- starting a map: blank, from a template, or from an outline ---------- */
const TEMPLATES = {
  'Blank map': ['', [], 'mind'],
  'Cellular respiration': ['Cellular respiration', [['Where', ['Cytoplasm', 'Mitochondria']], ['Needs', ['Glucose', 'Oxygen']], ['Produces', ['ATP', 'CO₂', 'Water']], ['Stages', ['Glycolysis', 'Krebs cycle', 'Electron transport chain']]], 'mind'],
  'Photosynthesis': ['Photosynthesis', [['Inputs', ['Light', 'CO₂', 'Water']], ['Outputs', ['Glucose', 'Oxygen']], ['Where', ['Chloroplast', 'Chlorophyll']], ['Limiting factors', ['Light intensity', 'CO₂ level', 'Temperature']]], 'mind'],
  'Ecosystem': ['Ecosystem', [['Producers', ['Plants', 'Algae']], ['Consumers', ['Herbivores', 'Carnivores', 'Omnivores']], ['Decomposers', ['Fungi', 'Bacteria']], ['Abiotic factors', ['Light', 'Water', 'Temperature']]], 'mind'],
  'Classification tree': ['Living things', [['Animals', ['Vertebrates', 'Invertebrates']], ['Plants', ['Flowering', 'Non-flowering']], ['Fungi'], ['Microorganisms', ['Bacteria', 'Protists']]], 'down'],
  'Cause and effect': ['Topic', [['Causes', ['Cause 1', 'Cause 2']], ['Effects', ['Effect 1', 'Effect 2']]], 'right'] };
/* indented lines (spaces, tabs or "-") become a map: the first line is the centre */
function fromOutline(text) { const lines = text.split(/\r?\n/).filter(l => l.trim()); if (!lines.length) return null; const lvl = l => { const m = l.match(/^(\s*)([-*•–]\s*)?/); return Math.floor(m[1].replace(/\t/g, '  ').length / 2) + (m[2] ? 0 : 0); };
  const clean = l => l.trim().replace(/^[-*•–]\s*/, ''); const root = [clean(lines[0]), []], stack = [[-1, root]];
  lines.slice(1).forEach(l => { const d = lvl(l), item = [clean(l), []]; while (stack.length > 1 && stack[stack.length - 1][0] >= d) stack.pop(); stack[stack.length - 1][1][1].push(item); stack.push([d, item]); });
  return root; }
function open() { modal.open('<h2>' + icon('brain-circuit') + ' Concept map</h2><p class="small muted" style="margin-top:-4px">Select an idea and press <b>Tab</b> for a child, <b>Enter</b> for a sibling, <b>Delete</b> to remove a branch. Double-click to type. Use <b>Link</b> to join any two ideas with linking words.</p>' +
    '<div class="grid3">' + Object.keys(TEMPLATES).map(k => '<button class="btn" data-t="' + esc(k) + '" style="justify-content:center;padding:14px">' + esc(k) + '</button>').join('') + '</div>' +
    '<h3>Or paste an outline</h3><textarea id="mmO" placeholder="Enzymes\n  Structure\n    Active site\n  Factors\n    Temperature\n    pH" style="height:120px"></textarea><div class="foot"><button class="btn" data-close>Cancel</button><button class="btn primary" id="mmGo">' + icon('git-branch-plus') + 'Make map from outline</button></div>', sh => {
    $$('[data-t]', sh).forEach(b => b.onclick = () => { const [t, c, l] = TEMPLATES[b.dataset.t]; modal.close(); const r = newMap(t, c, l); if (b.dataset.t === 'Blank map') setTimeout(() => I.openEditor(r), 60); });
    sh.querySelector('#mmGo').onclick = () => { const o = fromOutline(sh.querySelector('#mmO').value); if (!o) { toast('Type or paste an outline first.'); return; } modal.close(); newMap(o[0], o[1], 'mind'); }; }); }

window.HBMM = { open, newMap, addChild, addSibling, layout, fromOutline, isNode };
})();
