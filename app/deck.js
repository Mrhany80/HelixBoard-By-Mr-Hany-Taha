/* ================= HelixBoard — Deck: a whole PDF or PowerPoint in one tab, with a slide panel, slide sorter and a PowerPoint-style slideshow ================= */
(() => {
'use strict';
const { $, $$, uid, toast, modal, SND, icon, bus, set, esc, clamp, need, REDUCE } = window.HB;
const E = window.HBE, I = window.HBI, B = E.B;
const P = () => E.page();
const isDeck = () => !!(P() && P().deck);
const GAP = 90, TOP = 60;
const pageW = () => B.mode === 'scroll' ? B.width : 1920;
function rects(p) { p = p || P(); const d = p.deck; let y = d.top || TOP; return d.slides.map(s => { const r = [d.x0, y, d.w, s.h]; y += s.h + (d.gap || GAP); return r; }); }
const totalH = p => { const R = rects(p), r = R[R.length - 1]; return r ? r[1] + r[3] + 600 : 2160; };
/* which slide each object belongs to: the slide whose band (including half the gap around it) holds its centre */
function slideOf(o, R) { const b = E.bbox(o); if (!b) return -1; const cy = b[1] + b[3] / 2, g = (P().deck.gap || GAP) / 2; for (let i = 0; i < R.length; i++) if (cy >= R[i][1] - g && cy <= R[i][1] + R[i][3] + g) return i; return -1; }
function buckets(p) { p = p || P(); const R = rects(p), out = R.map(() => []); p.objs.forEach(o => { if (o.t === 'conn') return; const i = slideOf(o, R); if (i >= 0) out[i].push(o); }); return out; }
function shift(o, dy) { if (o.t === 'stroke') { for (let i = 1; i < o.pts.length; i += 3) o.pts[i] += dy; return; } if (o.line) { o.line[1] += dy; o.line[3] += dy; if (o.cp) o.cp[1] += dy; return; } if (o.t === 'pin') { o.y += dy; o.ly += dy; return; } if (o.y != null) o.y += dy; }
/* every change to the slide list goes through here, so one Undo puts it all back */
function structural(fn) { const p = P(); const a = JSON.stringify(p.deck), h0 = p.H; E.tx(() => { fn(p); p.H = Math.max(2160, totalH(p)); E.push({ k: 'deck', pid: p.id, a, b: JSON.stringify(p.deck), H: [h0, p.H] }); }); E.dirty.all(); E.changed(); rebuild(); }

/* ---------- creating a deck page (used by the PDF and PowerPoint importers) ---------- */
function create(name, slides, opts) { opts = opts || {}; const W = pageW(), w = Math.min(W - 160, 1600), x0 = (W - w) / 2; const p = E.newPage('slate'); p.name = name.replace(/\.(pptx|pdf)$/i, '').slice(0, 40); p.deck = { w, x0, top: TOP, gap: GAP, slides: [], trans: 'fade', src: name, cur: 0 };
  let y = TOP; slides.forEach(sl => { const h = Math.round(w * sl.h / sl.w); p.deck.slides.push({ h }); if (sl.asset) p.objs.push({ id: uid(), ts: Date.now(), t: 'img', asset: sl.asset, x: x0, y, w, h, layer: 0, deckBase: 1, pdf: name });
    else p.objs.push({ id: uid(), ts: Date.now(), t: 'shape', k: 'rect', x: x0, y, w, h, c: '#CED4DA', sw: 2, fill: '#FFFFFF', layer: 0, deckBase: 1 });
    (sl.steps || []).forEach((a, k) => p.objs.push({ id: uid(), ts: Date.now(), t: 'img', asset: a, x: x0, y, w, h, layer: 0, deckBase: 1, step: k + 1, pdf: name }));
    (sl.texts || []).forEach(t => { const k = w / sl.w; const o = Object.assign({}, t, { id: uid(), ts: Date.now(), x: x0 + t.x * k, y: y + t.y * k, w: t.w ? t.w * k : 0, size: Math.max(10, Math.round(t.size * k)), layer: 1, deckBase: 1 }); p.objs.push(o); });
    y += h + GAP; });
  p.H = Math.max(2160, totalH(p)); B.pages.splice(B.cur + 1, 0, p); window.HBUI && HBUI.goPage(B.cur + 1); E.changed(); SND.page && SND.page(); setTimeout(() => goSlide(0, false), 60); return p; }

/* ---------- view ---------- */
let cur = 0, show = false, railW = 0;
let full = false; const barMin = () => document.body.classList.contains('deckbar-min');
const area = () => show ? { x: 0, y: 0, w: E.SW, h: E.SH } : full ? { x: 8, y: barMin() ? 40 : 52, w: E.SW - 40, h: E.SH - (barMin() ? 40 : 52) - 86 } : { x: railW + 10, y: barMin() ? 40 : 58, w: E.SW - railW - 50, h: E.SH - (barMin() ? 40 : 58) - 96 };
function fitTo(i) { const r = rects()[i]; if (!r) return null; const a = area(), pad = show ? 1 : 0.97; const s = Math.min(a.w * pad / r[2], a.h * pad / r[3]); return { s, x: a.x + (a.w - r[2] * s) / 2 - r[0] * s, y: a.y + (a.h - r[3] * s) / 2 - r[1] * s }; }
function goSlide(i, anim, how) { if (!isDeck()) return; const n = P().deck.slides.length; i = clamp(i, 0, n - 1); const t = fitTo(i); if (!t) return; const prev = cur; if (i !== cur) { step = wantStep != null ? wantStep : 0; E.dirty.all(); } wantStep = null; cur = i; P().deck.cur = i; how = how || (show ? P().deck.trans : 'push');
  const V = E.V, from = { s: V.s, x: V.x, y: V.y };
  if (!anim || REDUCE || !window.gsap || how === 'none') E.setView(t.s, t.x, t.y);
  else if (how === 'fade' || how === 'zoom' || how === 'slide' || how === 'wipe') morph(how, t, i < prev ? -1 : 1)
  else { gsap.to(from, { s: t.s, x: t.x, y: t.y, duration: Math.abs(prev - i) > 3 ? 0.35 : 0.5, ease: 'power3.inOut', onUpdate: () => E.setView(from.s, from.x, from.y) }); }
  updUI(); }
/* smooth transitions like PowerPoint: a picture of the old slide sits on top while the new one is drawn underneath, then it
   dissolves (Fade), pushes out sideways (Push), is wiped away (Wipe) or grows and fades as the new slide settles in (Zoom) — no dark flash */
let trEl = null;
function snapStage() { const cvs = ['#cvBg', '#cvMain', '#cvLive'].map(s => $(s)).filter(Boolean); if (!cvs.length) return null; const st = cvs[0].parentElement, r = st.getBoundingClientRect(), k = devicePixelRatio || 1;
  const c = document.createElement('canvas'); c.width = Math.max(1, Math.round(r.width * k)); c.height = Math.max(1, Math.round(r.height * k)); const g = c.getContext('2d');
  g.fillStyle = getComputedStyle(st).backgroundColor || '#000'; if (g.fillStyle !== 'rgba(0, 0, 0, 0)') g.fillRect(0, 0, c.width, c.height);
  cvs.forEach(cv => { const q = cv.getBoundingClientRect(); if (!q.width) return; try { g.drawImage(cv, (q.left - r.left) * k, (q.top - r.top) * k, q.width * k, q.height * k); } catch (e) {} });
  c.id = 'dkTr'; c.style.cssText = 'position:absolute;left:0;top:0;width:' + r.width + 'px;height:' + r.height + 'px;pointer-events:none;will-change:transform,opacity,clip-path;transform-origin:50% 50%';
  cvs[cvs.length - 1].after(c); return c; }
function morph(how, t, dir) { if (trEl) { gsap.killTweensOf(trEl); trEl.remove(); trEl = null; } const cvs = $$('#cvBg,#cvMain,#cvLive'); gsap.killTweensOf(cvs); gsap.set(cvs, { clearProps: 'transform,opacity' });
  const o = snapStage(); E.setView(t.s, t.x, t.y); if (!o) return; trEl = o; const done = () => { o.remove(); if (trEl === o) trEl = null; gsap.set(cvs, { clearProps: 'transform,opacity' }); };
  requestAnimationFrame(() => {
    if (how === 'fade') gsap.to(o, { opacity: 0, duration: 0.55, ease: 'power1.inOut', onComplete: done });
    else if (how === 'zoom') { gsap.to(o, { opacity: 0, scale: 1.12, duration: 0.5, ease: 'power2.in', onComplete: done }); gsap.fromTo(cvs, { scale: 0.94 }, { scale: 1, duration: 0.6, ease: 'power3.out', clearProps: 'transform' }); }
    else if (how === 'slide') { const w = o.clientWidth; gsap.to(o, { x: -dir * w, duration: 0.6, ease: 'power3.inOut', onComplete: done }); gsap.fromTo(cvs, { x: dir * w }, { x: 0, duration: 0.6, ease: 'power3.inOut', clearProps: 'transform' }); }
    else { const p = { v: 0 }; gsap.to(p, { v: 100, duration: 0.6, ease: 'power2.inOut', onUpdate: () => { o.style.clipPath = dir > 0 ? 'inset(0 0 0 ' + p.v + '%)' : 'inset(0 ' + p.v + '% 0 0)'; }, onComplete: done }); }
  }); }
/* PowerPoint click animations: each build step is a picture with a step number; in the slideshow they appear one click at a time */
let step = 0, wantStep = null;
const stepsOf = i => { const b = buckets()[i] || []; return b.reduce((m, o) => Math.max(m, o.step || 0), 0); };
E.setStepFilter(o => show && o.step > step);
function reveal() { const objs = (buckets()[cur] || []).filter(o => o.step === step); objs.forEach(o => { o._fa = 0; }); E.dirty.all();
  if (!window.gsap || REDUCE) { objs.forEach(o => { delete o._fa; }); E.dirty.all(); return; } const t = { v: 0 }; gsap.to(t, { v: 1, duration: 0.45, ease: 'power2.out', onUpdate: () => { objs.forEach(o => { o._fa = t.v; }); E.dirty.main = true; }, onComplete: () => { objs.forEach(o => { delete o._fa; }); E.dirty.all(); } }); }
const next = () => { if (!isDeck()) return; if (show && step < stepsOf(cur)) { step++; reveal(); SND.tick && SND.tick(); updShow(); return; } const sl = P().deck.slides; let i = cur + 1; while (show && i < sl.length && sl[i].hid) i++; if (i >= sl.length) { if (show) endCard(); return; } goSlide(i, true); SND.tick && SND.tick(); };
const prev = () => { if (!isDeck()) return; if (show && step > 0) { step--; E.dirty.all(); updShow(); return; } const sl = P().deck.slides; let i = cur - 1; while (show && i > 0 && sl[i].hid) i--; if (i < 0) return; wantStep = show ? stepsOf(i) : 0; goSlide(i, true); E.dirty.all(); };
/* follow the view when the teacher scrolls by hand */
bus.on('view', () => { if (!isDeck() || show) return; const vr = E.viewRect(), cy = vr[1] + vr[3] / 2, R = rects(); let best = cur, bd = 1e12; R.forEach((r, i) => { const d = Math.abs(r[1] + r[3] / 2 - cy); if (d < bd) { bd = d; best = i; } }); if (best !== cur) { cur = best; P().deck.cur = cur; updUI(); } });

/* ---------- slide panel, top bar ---------- */
let rail = null, bar = null, thumbs = [];
function css() { if ($('#deckCss')) return; const s = document.createElement('style'); s.id = 'deckCss'; s.textContent = `
#deckRail{position:absolute;left:0;top:0;bottom:64px;border-bottom-right-radius:14px;width:184px;z-index:7;background:linear-gradient(180deg,color-mix(in srgb,var(--panel) 96%,transparent),color-mix(in srgb,var(--panel) 90%,#000));border-right:1px solid var(--line);display:flex;flex-direction:column;box-shadow:6px 0 24px rgba(0,0,0,.18)}
#deckRail .dh{display:flex;align-items:center;gap:6px;padding:10px 10px 6px;font:800 12px var(--ui);letter-spacing:.06em;text-transform:uppercase;color:var(--muted)}
#deckRail .dh b{flex:1;color:var(--ink);text-transform:none;letter-spacing:0;font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#deckRail .dl{flex:1;overflow-y:auto;padding:4px 10px 10px 8px;scrollbar-width:thin;scrollbar-color:color-mix(in srgb,var(--accent) 70%,transparent) transparent}
#deckRail .th{position:relative;display:flex;gap:6px;align-items:flex-start;margin:0 0 10px;cursor:pointer}
#deckRail .th .no{width:18px;flex:none;font:700 11px var(--mono);color:var(--muted);text-align:right;padding-top:2px}
#deckRail .th canvas{width:136px;border-radius:6px;background:#fff;box-shadow:0 2px 8px rgba(0,0,0,.25);border:2px solid transparent;display:block}
#deckRail .th.on canvas{border-color:var(--accent);box-shadow:0 0 0 3px color-mix(in srgb,var(--accent) 35%,transparent),0 0 18px color-mix(in srgb,var(--accent) 55%,transparent)}
#deckRail .th.on .no{color:var(--accent)}
#deckRail .th.hid canvas{opacity:.38} #deckRail .th.hid .no::after{content:" ⊘";color:var(--bad)}
#deckRail .th.drop canvas{border-color:#22D3EE}
#deckRail .th .tools{position:absolute;right:2px;top:2px;display:none;gap:2px;background:rgba(15,8,20,.82);border-radius:7px;padding:2px}
#deckRail .th:hover .tools,#deckRail .th.on .tools{display:flex}
#deckRail .th .tools button{width:22px;height:22px;border:0;border-radius:5px;background:transparent;color:#fff;display:grid;place-items:center;cursor:pointer;padding:0}
#deckRail .th .tools button:hover{background:rgba(255,255,255,.18)} #deckRail .th .tools svg{width:13px;height:13px}
#deckRail .df{padding:8px 10px;border-top:1px solid var(--line);display:flex;gap:6px}
#deckRail .df button{flex:1}
#deckBar{position:absolute;left:calc(184px + (100% - 184px)/2);top:8px;transform:translateX(-50%);z-index:7;display:flex;align-items:center;gap:3px;padding:5px;border-radius:14px;background:linear-gradient(135deg,rgba(40,16,48,.95),rgba(22,10,30,.96));border:1px solid rgba(255,120,190,.4);box-shadow:0 10px 30px rgba(0,0,0,.35),0 0 22px rgba(255,80,160,.22);white-space:nowrap;max-width:calc(100% - 210px);overflow-x:auto;scrollbar-width:none}
#deckBar button{display:flex;align-items:center;gap:5px;border:0;background:transparent;color:#FBE9F3;font:600 12.5px var(--ui);padding:7px 9px;border-radius:10px;cursor:pointer}
#deckBar button:hover{background:rgba(255,255,255,.12)} #deckBar button.on{background:#FF4FA0;color:#fff} #deckBar button.go{background:linear-gradient(135deg,#FF4FA0,#B0124F);color:#fff;box-shadow:0 0 14px rgba(255,79,160,.5)}
#deckBar svg{width:16px;height:16px} #deckBar .sep{width:1px;height:22px;background:rgba(255,255,255,.18);margin:0 2px}
#deckBar input{width:42px;text-align:center;border:1px solid rgba(255,255,255,.25);background:rgba(255,255,255,.08);color:#fff;border-radius:8px;font:700 13px var(--mono);padding:5px 2px}
#deckBar .of{color:#FFC9DE;font:600 12px var(--mono);padding:0 4px}
#deckBar select{background:rgba(255,255,255,.08);color:#fff;border:1px solid rgba(255,255,255,.2);border-radius:8px;font:600 12px var(--ui);padding:5px}
#deckBar select option{color:#000}
body.deckfull #top,body.deckfull #sidetabs,body.deckfull #toolrow,body.deckfull #pagetabs,body.deckfull #deckRail,body.deckfull #drawerBtn{display:none!important}
body.deckfull #stage{position:fixed!important;inset:0!important;z-index:5}
body.deckfull #deckBar,body.deckbar-min.deckfull #deckPill{left:50%!important;max-width:calc(100% - 30px)}
body.deckfull #dock{left:50%!important}
body.deckbar-min #deckBar{display:none!important}
#deckPill{display:none;position:absolute;left:calc(184px + (100% - 184px)/2);top:6px;transform:translateX(-50%);z-index:8;align-items:center;gap:6px;padding:5px 14px;border-radius:999px;border:1px solid rgba(255,120,190,.5);background:linear-gradient(135deg,rgba(40,16,48,.92),rgba(22,10,30,.94));color:#FBE9F3;font:700 12px var(--ui);cursor:pointer;box-shadow:0 0 18px rgba(255,80,160,.35)}
#deckPill svg{width:15px;height:15px}
body.deckon.deckbar-min #deckPill{display:flex} body.deckrail-off #deckPill,body.deckfull #deckPill{left:50%}
body.deckshow #deckPill{display:none!important}
body.deckrail-off #deckRail{display:none} body.deckrail-off #deckBar{left:50%;max-width:calc(100% - 30px)}
/* slideshow */
body.deckshow #top,body.deckshow #sidetabs,body.deckshow #toolrow,body.deckshow #pagetabs,body.deckshow #dock,body.deckshow #dockShow,body.deckshow #mini,body.deckshow #vbar,body.deckshow #hbar,body.deckshow #deckRail,body.deckshow #deckBar,body.deckshow #drawer,body.deckshow #drawerBtn,body.deckshow #smartUI{display:none!important}
body.deckshow #stage{position:fixed!important;inset:0!important;z-index:60;background:#000}
#showCtl{position:fixed;left:16px;bottom:16px;z-index:70;display:flex;gap:3px;align-items:center;padding:5px;border-radius:14px;background:rgba(12,6,16,.78);border:1px solid rgba(255,255,255,.14);box-shadow:0 8px 26px rgba(0,0,0,.4);transition:opacity .35s,transform .35s;backdrop-filter:blur(8px)}
#showCtl.idle{opacity:0;transform:translateY(10px);pointer-events:none}
#showCtl button{border:0;background:transparent;color:#fff;width:36px;height:36px;border-radius:9px;display:grid;place-items:center;cursor:pointer;font:800 13px var(--ui)}
#showCtl button:hover{background:rgba(255,255,255,.14)} #showCtl button.on{background:#FF4FA0}
#showCtl svg{width:18px;height:18px} #showCtl .cnt{color:#fff;font:700 13px var(--mono);padding:0 8px;min-width:64px;text-align:center} #showCtl .clk{color:#FFC9DE;font:600 12px var(--mono);padding:0 8px;border-left:1px solid rgba(255,255,255,.18)} #showCtl .sep{width:1px;height:22px;background:rgba(255,255,255,.18);margin:0 3px}
#showBar{position:fixed;left:0;bottom:0;height:4px;z-index:71;background:linear-gradient(90deg,#FF4FA0,#22D3EE);box-shadow:0 0 10px #FF4FA0;transition:width .4s}
#showBlank{position:fixed;inset:0;z-index:80;display:grid;place-items:center;font:600 14px var(--ui);cursor:pointer}
#showEnd{position:fixed;inset:0;z-index:75;display:grid;place-items:center;background:#000;color:#bbb;font:600 18px var(--ui);text-align:center}
#showEnd b{display:block;color:#fff;font:800 30px var(--head);margin-bottom:8px}
`; document.head.appendChild(s); }
const bt = (ic, label, fn, title, cls) => { const b = document.createElement('button'); b.innerHTML = (ic ? icon(ic) : '') + (label ? '<span>' + label + '</span>' : ''); b.title = title || label || ''; if (cls) b.className = cls; b.onclick = e => { e.preventDefault(); fn(e); }; return b; };
const sep = () => { const d = document.createElement('i'); d.className = 'sep'; return d; };
function mount() { css(); const st = $('#stage'); if (!rail) { rail = document.createElement('div'); rail.id = 'deckRail'; st.appendChild(rail); ['pointerdown', 'wheel', 'dblclick'].forEach(ev => rail.addEventListener(ev, e => e.stopPropagation(), { passive: true })); }
  if (!bar) { bar = document.createElement('div'); bar.id = 'deckBar'; st.appendChild(bar); ['pointerdown', 'dblclick'].forEach(ev => bar.addEventListener(ev, e => e.stopPropagation())); } }
function rebuild() { mount(); const on = isDeck() && !show; document.body.classList.toggle('deckon', on); rail.hidden = bar.hidden = !on; railW = on && !full && !document.body.classList.contains('deckrail-off') ? 184 : 0; if (!on) return; const d = P().deck, n = d.slides.length; cur = clamp(d.cur || 0, 0, n - 1);
  rail.innerHTML = '<div class="dh">' + icon('presentation') + '<b title="' + esc(d.src || '') + '">' + esc(P().name || 'Deck') + '</b>' + n + '<button class="ib" id="dkClose" title="Hide the slide panel" style="width:26px;height:26px;min-width:0;padding:0">' + icon('panel-left') + '</button></div><div class="dl"></div><div class="df"><button class="btn sm" id="dkAdd">' + icon('plus') + 'Blank</button><button class="btn sm" id="dkSort">' + icon('layout-grid') + 'Sorter</button></div>';
  const L = $('.dl', rail); thumbs = d.slides.map((s, i) => { const t = document.createElement('div'); t.className = 'th' + (i === cur ? ' on' : '') + (s.hid ? ' hid' : ''); t.draggable = true; t.dataset.i = i; t.innerHTML = '<span class="no">' + (i + 1) + '</span><canvas></canvas><div class="tools"></div>';
    const tl = $('.tools', t); tl.append(bt('arrow-up', '', () => move(i, i - 1), 'Move up'), bt('arrow-down', '', () => move(i, i + 1), 'Move down'), bt('copy', '', () => dup(i), 'Duplicate'), bt(s.hid ? 'eye' : 'eye-off', '', () => hide(i), s.hid ? 'Show in slideshow' : 'Hide in slideshow'), bt('trash-2', '', () => del(i), 'Delete slide'));
    t.onclick = e => { if (e.target.closest('.tools')) return; goSlide(i, true); };
    t.ondragstart = e => { e.dataTransfer.setData('text/hb-slide', String(i)); e.dataTransfer.effectAllowed = 'move'; }; t.ondragover = e => { e.preventDefault(); t.classList.add('drop'); }; t.ondragleave = () => t.classList.remove('drop');
    t.ondrop = e => { e.preventDefault(); t.classList.remove('drop'); const from = +e.dataTransfer.getData('text/hb-slide'); if (!isNaN(from) && from !== i) move(from, i); };
    L.appendChild(t); return t; });
  $('#dkAdd', rail).onclick = () => addBlank(cur); $('#dkClose', rail).onclick = togglePanel; $('#dkSort', rail).onclick = sorter; drawThumbs(true); buildBar(); updUI(); }
function buildBar() { bar.innerHTML = ''; const d = P().deck, n = d.slides.length;
  const inp = document.createElement('input'); inp.id = 'dkNo'; inp.value = cur + 1; inp.title = 'Type a slide number and press Enter'; inp.onkeydown = e => { e.stopPropagation(); if (e.key === 'Enter') { goSlide((parseInt(inp.value, 10) || 1) - 1, true); inp.blur(); } };
  const of = document.createElement('span'); of.className = 'of'; of.id = 'dkOf'; of.textContent = '/ ' + n;
  const tr = document.createElement('select'); tr.title = 'Transition between slides in the slideshow'; [['fade', 'Fade'], ['slide', 'Push'], ['wipe', 'Wipe'], ['zoom', 'Zoom'], ['push', 'Glide'], ['none', 'None']].forEach(([v, l]) => { const o = document.createElement('option'); o.value = v; o.textContent = l; tr.appendChild(o); }); tr.value = d.trans || 'fade'; tr.onchange = () => { d.trans = tr.value; E.changed(); };
  bar.append(bt('panel-left', '', togglePanel, 'Show / hide the slide panel'), bt('folder-open', 'Open', () => window.HBIO && HBIO.openDocument(), 'Open another PDF, PowerPoint or Word file'), sep(), bt('chevron-left', '', prev, 'Previous slide (←, PageUp)'), inp, of, bt('chevron-right', '', next, 'Next slide (→, PageDown)'), sep(),
    bt('play', 'Slideshow', () => startShow(0), 'Start from the beginning (F5)', 'go'), bt('monitor-play', 'From here', () => startShow(cur), 'Start from this slide (Shift+F5)'), sep(),
    full ? bt('minimize-2', 'Exit full screen', exitFull, 'Leave full screen (Esc)', 'on') : bt('maximize', 'Full screen', enterFull, 'Full screen — keep writing, typing and editing on the slides'), bt('focus', '', () => goSlide(cur, true), 'Fit this slide to the screen'), bt(d.inkOff ? 'eye-off' : 'eye', '', toggleInk, d.inkOff ? 'Your writing is hidden — click to show it' : 'Hide your writing (clean slides)', d.inkOff ? 'on' : ''), bt('eraser', '', () => clearInk(cur), 'Clear your writing from this slide'), sep(),
    bt('file-plus', '', () => addBlank(cur), 'Insert a blank whiteboard slide after this one'), bt('copy', '', () => dup(cur), 'Duplicate this slide'), bt('layout-grid', '', sorter, 'Slide sorter — see all slides, drag to reorder'), tr, bt('file-down', 'Export', exportDeck, 'Save the deck with your writing as a PDF'), bt('chevrons-up', '', () => barToggle(true), 'Hide this bar (a small tab stays to bring it back)')); }
function updUI() { updPill(); if (!rail || !isDeck() || show) { updShow(); return; } thumbs.forEach((t, i) => t.classList.toggle('on', i === cur)); const t = thumbs[cur]; if (t) { const L = t.parentElement, r = t.offsetTop; if (r < L.scrollTop || r > L.scrollTop + L.clientHeight - 90) L.scrollTop = r - 40; } const inp = $('#dkNo'); if (inp && document.activeElement !== inp) inp.value = cur + 1; }
/* thumbnails show the slide with your ink on it */
let thT = 0, dirtyAll = true;
function drawThumbs(all) { if (!isDeck() || !thumbs.length) return; const p = P(), R = rects(p); const list = all ? R.map((_, i) => i) : [cur]; list.forEach(i => { const t = thumbs[i]; if (!t) return; const c = $('canvas', t), r = R[i], sc = 136 * 1.5 / r[2]; try { const img = E.renderToCanvas(p, r, sc, { bg: false, ink: true }); c.width = img.width; c.height = img.height; c.getContext('2d').drawImage(img, 0, 0); } catch (e) {} }); }
bus.on('changed', () => { if (!isDeck() || show) return; clearTimeout(thT); thT = setTimeout(() => { if (!isDeck() || show) return; if (thumbs.length !== P().deck.slides.length) rebuild(); else drawThumbs(thumbs.length <= 40); }, 450); });
bus.on('img-loaded', () => { if (isDeck()) { clearTimeout(thT); thT = setTimeout(() => drawThumbs(true), 300); } });
bus.on('page', () => { setTimeout(() => { rebuild(); if (isDeck()) goSlide(P().deck.cur || 0, false); }, 30); });
/* full-screen writing: the slide fills the screen, every writing tool stays available (pen tray, eraser, text, select) */
function enterFull() { if (!isDeck()) return; full = true; document.body.classList.add('deckfull'); const fs = document.documentElement.requestFullscreen ? document.documentElement.requestFullscreen().catch(() => {}) : Promise.resolve(); Promise.resolve(fs).then(() => setTimeout(() => { E.resize && E.resize(); rebuild(); goSlide(cur, false); E.dirty.all(); }, 180)); toast('Full screen: write, type and edit on the slides. Esc or “Exit full screen” to leave.'); SND.whoosh && SND.whoosh(); }
function exitFull() { if (!full) return; full = false; document.body.classList.remove('deckfull'); if (document.fullscreenElement && document.exitFullscreen) document.exitFullscreen().catch(() => {}); setTimeout(() => { E.resize && E.resize(); rebuild(); goSlide(cur, false); E.dirty.all(); }, 180); }
document.addEventListener('fullscreenchange', () => { if (full && !document.fullscreenElement) exitFull(); });
bus.on('page', () => { if (full && !isDeck()) exitFull(); });
/* the deck bar can shrink to a small tab */
function barToggle(on) { document.body.classList.toggle('deckbar-min', on); set.put('deckBarMin', on); let pill = document.getElementById('deckPill'); if (!pill) { pill = document.createElement('button'); pill.id = 'deckPill'; pill.title = 'Show the slide bar'; pill.onclick = () => barToggle(false); ['pointerdown', 'dblclick'].forEach(ev => pill.addEventListener(ev, e => e.stopPropagation())); $('#stage').appendChild(pill); } updPill(); goSlide(cur, true); }
function updPill() { const pill = document.getElementById('deckPill'); if (pill && isDeck()) pill.innerHTML = icon('chevrons-down') + '<span>Slide ' + (cur + 1) + ' / ' + P().deck.slides.length + '</span>'; }
if (set.get('deckBarMin', false)) setTimeout(() => barToggle(true), 500);
function togglePanel() { document.body.classList.toggle('deckrail-off'); set.put('deckRailOff', document.body.classList.contains('deckrail-off')); rebuild(); goSlide(cur, true); }
if (set.get('deckRailOff', false)) document.body.classList.add('deckrail-off');

/* ---------- slide operations ---------- */
function relayout(p, order, extraFor) { /* order: list of old indices (or {blank:h} / {dup:i}) describing the new slide list */
  const R = rects(p), B0 = buckets(p), old = p.deck.slides; const ns = [], moves = [], adds = [], dels = [];
  let y = p.deck.top || TOP; order.forEach(it => { if (typeof it === 'number') { const h = old[it].h; ns.push(Object.assign({}, old[it])); const dy = y - R[it][1]; if (dy) moves.push([B0[it], dy]); y += h + (p.deck.gap || GAP); }
    else if (it.blank) { ns.push({ h: it.blank }); adds.push({ id: uid(), ts: Date.now(), t: 'shape', k: 'rect', x: p.deck.x0, y, w: p.deck.w, h: it.blank, c: '#CED4DA', sw: 2, fill: '#FFFFFF', layer: 0, deckBase: 1 }); y += it.blank + (p.deck.gap || GAP); }
    else if (it.dup != null) { const h = old[it.dup].h; ns.push({ h }); const dy = y - R[it.dup][1]; B0[it.dup].forEach(o => { const c = JSON.parse(JSON.stringify(E.clean(o))); c.id = uid(); shift(c, dy); adds.push(c); }); y += h + (p.deck.gap || GAP); } });
  old.forEach((_, i) => { if (!order.includes(i)) dels.push(...B0[i]); });
  if (dels.length) E.del(dels); moves.forEach(([objs, dy]) => { if (objs.length) E.mod(objs, o => shift(o, dy)); }); if (adds.length) E.add(adds); p.deck.slides = ns; }
const idx = n => Array.from({ length: n }, (_, i) => i);
function move(a, b) { const n = P().deck.slides.length; if (b < 0 || b >= n || a === b) return; const o = idx(n); o.splice(a, 1); o.splice(b, 0, a); structural(p => relayout(p, o)); cur = b; P().deck.cur = b; goSlide(b, true); toast('Slide ' + (a + 1) + ' moved to position ' + (b + 1)); }
function dup(i) { const n = P().deck.slides.length, o = idx(n); o.splice(i + 1, 0, { dup: i }); structural(p => relayout(p, o)); goSlide(i + 1, true); toast('Slide duplicated'); }
function del(i) { const n = P().deck.slides.length; if (n < 2) { toast('A deck needs at least one slide.'); return; } window.HB.ask('Delete slide ' + (i + 1) + ' and the writing on it? You can undo this.', 'Delete slide', () => { const o = idx(n).filter(k => k !== i); structural(p => relayout(p, o)); goSlide(Math.min(i, n - 2), true); }, 'Delete this slide?'); }
function hide(i) { structural(p => { p.deck.slides[i].hid = !p.deck.slides[i].hid; }); toast(P().deck.slides[i].hid ? 'Slide ' + (i + 1) + ' will be skipped in the slideshow' : 'Slide ' + (i + 1) + ' is back in the slideshow'); }
function addBlank(i) { const n = P().deck.slides.length, o = idx(n), h = P().deck.slides[i] ? P().deck.slides[i].h : Math.round(P().deck.w * 9 / 16); o.splice(i + 1, 0, { blank: h }); structural(p => relayout(p, o)); goSlide(i + 1, true); toast('Whiteboard slide added — write on it, it stays in the deck.'); }
function clearInk(i) { const objs = buckets()[i].filter(o => !o.deckBase && (o.layer == null ? 1 : o.layer) >= 1); if (!objs.length) { toast('There is no writing on this slide.'); return; } E.del(objs); SND.pop(); toast('Cleared your writing on slide ' + (i + 1) + ' (Undo brings it back).'); }
function toggleInk() { const d = P().deck; d.inkOff = !d.inkOff; E.dirty.all(); E.changed(); buildBar(); updShowBtns(); toast(d.inkOff ? 'Your writing is hidden — clean slides.' : 'Your writing is visible again.'); }

/* ---------- slide sorter ---------- */
function sorter() { const p = P(), d = p.deck, R = rects(p); modal.open('<h2>Slide sorter</h2><p class="small muted">Drag a slide to a new place. Click a slide to open it. The eye hides a slide from the slideshow.</p><div id="srt" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(170px,1fr));gap:14px;max-height:62vh;overflow:auto;padding:4px"></div>', s => {
  const G = $('#srt', s); d.slides.forEach((sl, i) => { const c = document.createElement('div'); c.draggable = true; c.style.cssText = 'position:relative;cursor:pointer;border-radius:10px;padding:6px;background:var(--panel2,rgba(0,0,0,.06));border:2px solid ' + (i === cur ? 'var(--accent)' : 'transparent') + (sl.hid ? ';opacity:.45' : ''); const img = E.renderToCanvas(p, R[i], 170 * 1.4 / R[i][2], { bg: false, ink: true }); img.style.cssText = 'width:100%;border-radius:6px;background:#fff;display:block'; c.appendChild(img); const lb = document.createElement('div'); lb.style.cssText = 'display:flex;justify-content:space-between;align-items:center;font:700 12px var(--mono);margin-top:4px'; lb.innerHTML = '<span>' + (i + 1) + (sl.hid ? ' · hidden' : '') + '</span>'; const eb = bt(sl.hid ? 'eye' : 'eye-off', '', () => { modal.close(); hide(i); sorter(); }, 'Hide / show in slideshow', 'btn sm'); lb.appendChild(eb); c.appendChild(lb);
    c.onclick = e => { if (e.target.closest('button')) return; modal.close(); goSlide(i, true); };
    c.ondragstart = e => e.dataTransfer.setData('text/hb-slide', String(i)); c.ondragover = e => { e.preventDefault(); c.style.outline = '3px solid #22D3EE'; }; c.ondragleave = () => c.style.outline = '';
    c.ondrop = e => { e.preventDefault(); const from = +e.dataTransfer.getData('text/hb-slide'); modal.close(); if (!isNaN(from) && from !== i) move(from, i); sorter(); }; G.appendChild(c); }); }); }

/* ---------- export the deck with the writing on it ---------- */
function exportDeck() { const p = P(), d = p.deck; modal.open('<h2>Export deck as PDF</h2><div class="row" style="gap:12px;flex-wrap:wrap"><label><input type="radio" name="dkx" value="all" checked> All ' + d.slides.length + ' slides</label><label><input type="radio" name="dkx" value="ink"> Only slides I wrote on</label><label><input type="radio" name="dkx" value="show"> Slides in the slideshow (skip hidden)</label></div><p><label><input type="checkbox" id="dkxInk" checked> Include my writing</label></p><div class="foot"><button class="btn primary" id="dkxGo">' + icon('file-down') + ' Create PDF</button></div>', s => { $('#dkxGo', s).onclick = async () => { const mode = $('input[name=dkx]:checked', s).value, ink = $('#dkxInk', s).checked; modal.close(); let jsp; toast('Preparing PDF…'); try { jsp = await need('jspdf'); } catch (e) { toast(e.message); return; }
    const R = rects(p), Bk = buckets(p); const list = R.map((r, i) => i).filter(i => mode === 'all' || (mode === 'show' && !d.slides[i].hid) || (mode === 'ink' && Bk[i].some(o => !o.deckBase))); if (!list.length) { toast('No slides match.'); return; }
    const J = jsp.jsPDF; let doc = null; const was = d.inkOff; d.inkOff = !ink;
    for (const i of list) { const r = R[i], sc = Math.min(2, 1800 / r[2]); const c = E.renderToCanvas(p, r, sc, { bg: false, ink: ink }); const g2 = document.createElement('canvas'); g2.width = c.width; g2.height = c.height; const gx = g2.getContext('2d'); gx.fillStyle = '#fff'; gx.fillRect(0, 0, c.width, c.height); gx.drawImage(c, 0, 0); const w = r[2], h = r[3], ori = w >= h ? 'landscape' : 'portrait';
      if (!doc) doc = new J({ orientation: ori, unit: 'px', format: [w, h], hotfixes: ['px_scaling'] }); else doc.addPage([w, h], ori); doc.addImage(g2.toDataURL('image/jpeg', 0.9), 'JPEG', 0, 0, w, h); }
    d.inkOff = was; doc.save((p.name || 'Deck').replace(/[\\/:*?"<>|]+/g, '') + ' — annotated.pdf'); SND.done && SND.done(); toast('Saved ' + list.length + ' slide' + (list.length > 1 ? 's' : '') + ' as PDF.'); }; }); }

/* ---------- slideshow ---------- */
let ctl = null, pbar = null, idleT = 0, clockIv = 0, t0 = 0, savedTheme = null, savedTool = null, blank = null;
function startShow(i) { if (!isDeck()) return; show = true; step = 0; css(); const p = P(); savedTheme = p.theme; p.theme = 'black'; savedTool = [I.T.tool, I.T.pen]; document.body.classList.add('deckshow'); I.clearSel();
  const fs = document.documentElement.requestFullscreen ? document.documentElement.requestFullscreen().catch(() => {}) : Promise.resolve();
  ctl = document.createElement('div'); ctl.id = 'showCtl'; document.body.appendChild(ctl); pbar = document.createElement('div'); pbar.id = 'showBar'; document.body.appendChild(pbar);
  ctl.append(bt('chevron-left', '', prev, 'Previous (←)'), Object.assign(document.createElement('span'), { className: 'cnt', id: 'shCnt' }), bt('chevron-right', '', next, 'Next (→, Space, click)'), sep(),
    bt('mouse-pointer-2', '', () => tool('laser'), 'Laser pointer (L) — click to go forward'), bt('pen-line', '', () => tool('draw', 'pen'), 'Pen (P)'), bt('highlighter', '', () => tool('draw', 'hi'), 'Highlighter (H)'), bt('eraser', '', () => tool('erase'), 'Eraser (E)'), bt('trash-2', '', () => clearInk(cur), 'Clear writing on this slide'), bt('eye', '', toggleInk, 'Show / hide writing'), sep(),
    Object.assign(bt('', 'B', () => blankScreen('#000'), 'Black screen (B)'), {}), bt('', 'W', () => blankScreen('#fff'), 'White screen (W)'), bt('maximize', '', () => goSlide(cur, true, 'push'), 'Fit slide (after zooming)'), Object.assign(document.createElement('span'), { className: 'clk', id: 'shClk' }), bt('x', '', endShow, 'End slideshow (Esc)'));
  [...ctl.querySelectorAll('button')].forEach(b => { if (!b.innerHTML.includes('<svg') && b.textContent.length === 1) b.style.fontSize = '15px'; });
  ['pointerdown', 'pointerup', 'click', 'wheel'].forEach(ev => ctl.addEventListener(ev, e => e.stopPropagation()));
  tool('laser'); t0 = Date.now(); clockIv = setInterval(updClock, 1000); updClock(); poke();
  Promise.resolve(fs).then(() => setTimeout(() => { E.resize && E.resize(); goSlide(i, false); E.dirty.all(); }, 160)); SND.whoosh && SND.whoosh(); }
function endShow() { if (!show) return; show = false; const p = P(); if (savedTheme) p.theme = savedTheme; document.body.classList.remove('deckshow'); [ctl, pbar, blank, $('#showEnd')].forEach(x => x && x.remove()); ctl = pbar = blank = null; clearInterval(clockIv); if (document.fullscreenElement && document.exitFullscreen) document.exitFullscreen().catch(() => {}); if (savedTool) I.setTool(savedTool[0], savedTool[1]); setTimeout(() => { E.resize && E.resize(); E.dirty.all(); rebuild(); goSlide(cur, false); }, 160); }
function tool(t, pen) { I.setTool(t, pen); updShowBtns(); poke(); }
function updShowBtns() { if (!ctl) return; const bs = ctl.querySelectorAll('button'); const T = I.T; [[2, T.tool === 'laser'], [3, T.tool === 'draw' && T.pen !== 'hi'], [4, T.tool === 'draw' && T.pen === 'hi'], [5, T.tool === 'erase'], [7, isDeck() && P().deck.inkOff]].forEach(([k, on]) => bs[k] && bs[k].classList.toggle('on', !!on)); }
function updShow() { if (!show || !ctl || !isDeck()) return; const n = P().deck.slides.length; const c = $('#shCnt'), ns = stepsOf(cur); if (c) c.textContent = (cur + 1) + ' / ' + n + (ns ? ' · ✦ ' + step + '/' + ns : ''); if (pbar) pbar.style.width = ((cur + 1) / n * 100) + '%'; updShowBtns(); }
function updClock() { const c = $('#shClk'); if (!c) return; const s = Math.floor((Date.now() - t0) / 1000); c.textContent = '⏱ ' + String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0') + '  ·  ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); }
function poke() { if (!ctl) return; ctl.classList.remove('idle'); clearTimeout(idleT); idleT = setTimeout(() => ctl && ctl.classList.add('idle'), 2800); }
function blankScreen(col) { if (blank) { blank.remove(); blank = null; return; } blank = document.createElement('div'); blank.id = 'showBlank'; blank.style.background = col; blank.style.color = col === '#000' ? '#333' : '#ccc'; blank.textContent = 'Click or press any key to return'; blank.onclick = () => { blank.remove(); blank = null; }; document.body.appendChild(blank); }
function endCard() { if ($('#showEnd')) return; const e = document.createElement('div'); e.id = 'showEnd'; e.innerHTML = '<div><b>End of slideshow</b>Click or press Esc to exit · ← to go back</div>'; e.onclick = () => { e.remove(); endShow(); }; document.body.appendChild(e); }
document.addEventListener('pointermove', () => show && poke(), { passive: true });
/* click to go forward with the laser, like a presentation; right-click goes back */
let downAt = null;
document.addEventListener('pointerdown', e => { if (!show || e.target.closest('#showCtl')) return; downAt = [e.clientX, e.clientY, Date.now(), e.button]; }, true);
document.addEventListener('pointerup', e => { if (!show || !downAt || e.target.closest('#showCtl,#showEnd,#showBlank')) { downAt = null; return; } const [x, y, t, b] = downAt; downAt = null; if (I.T.tool !== 'laser' || Math.hypot(e.clientX - x, e.clientY - y) > 8 || Date.now() - t > 500) return; if (b === 2) prev(); else if (b === 0) next(); }, true);
document.addEventListener('contextmenu', e => { if (show) e.preventDefault(); }, true);
document.addEventListener('fullscreenchange', () => { if (show && !document.fullscreenElement) setTimeout(() => { if (show) { E.resize && E.resize(); goSlide(cur, false); } }, 120); });
/* keyboard: PowerPoint keys in the slideshow; PageUp/PageDown, arrows and F5 on a deck tab */
let typed = '';
document.addEventListener('keydown', e => { const tg = e.target.tagName; if (tg === 'INPUT' || tg === 'TEXTAREA' || tg === 'SELECT' || I.editing) return; if (!isDeck()) return; const k = e.key;
  if (k === 'F5') { e.preventDefault(); e.stopPropagation(); startShow(e.shiftKey ? cur : 0); return; }
  if (!show) { if (full && k === 'Escape') { e.preventDefault(); e.stopPropagation(); exitFull(); return; } if (I.selObjs().length) return; if (k === 'PageDown' || (k === 'ArrowRight' && !e.altKey) || (k === 'ArrowDown' && !e.altKey)) { e.preventDefault(); e.stopPropagation(); next(); } else if (k === 'PageUp' || (k === 'ArrowLeft' && !e.altKey) || (k === 'ArrowUp' && !e.altKey)) { e.preventDefault(); e.stopPropagation(); prev(); } else if (k === 'Home') { e.preventDefault(); e.stopPropagation(); goSlide(0, true); } else if (k === 'End') { e.preventDefault(); e.stopPropagation(); goSlide(P().deck.slides.length - 1, true); } return; }
  e.stopPropagation(); poke(); if ($('#showEnd') && k !== 'ArrowLeft' && k !== 'PageUp' && k !== 'Backspace') { e.preventDefault(); $('#showEnd').remove(); if (k === 'Escape') endShow(); return; }
  if (blank) { e.preventDefault(); blank.remove(); blank = null; return; }
  if (/^[0-9]$/.test(k)) { typed += k; return; } if (k === 'Enter' && typed) { e.preventDefault(); goSlide(parseInt(typed, 10) - 1, true); typed = ''; return; } typed = '';
  const map = { ArrowRight: next, ArrowDown: next, PageDown: next, ' ': next, Enter: next, n: next, N: next, ArrowLeft: prev, ArrowUp: prev, PageUp: prev, Backspace: prev, p: prev, Home: () => goSlide(0, true), End: () => goSlide(P().deck.slides.length - 1, true), Escape: endShow, b: () => blankScreen('#000'), B: () => blankScreen('#000'), '.': () => blankScreen('#000'), w: () => blankScreen('#fff'), W: () => blankScreen('#fff'), ',': () => blankScreen('#fff'), l: () => tool('laser'), L: () => tool('laser'), P: () => tool('draw', 'pen'), h: () => tool('draw', 'hi'), H: () => tool('draw', 'hi'), e: () => tool('erase'), E: () => tool('erase') };
  if (map[k]) { e.preventDefault(); map[k](); } }, true);

setTimeout(() => { rebuild(); if (isDeck()) goSlide(P().deck.cur || 0, false); }, 400); bus.on('board-loaded', () => setTimeout(rebuild, 50));
window.HBD = { enterFull, exitFull, get full() { return full; }, create, goSlide, next, prev, startShow, endShow, rects, buckets, move, dup, del, hide, addBlank, clearInk, toggleInk, sorter, exportDeck, get cur() { return cur; }, get show() { return show; }, isDeck };
})();

