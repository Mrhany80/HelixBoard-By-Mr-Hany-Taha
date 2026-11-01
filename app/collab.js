/* ================= HelixBoard — Collaborate: group-work structures on the board (v2.7.0) =================
   Ten classroom structures (Think-Pair-Share, Jigsaw, Placemat, Gallery walk, Carousel, Numbered heads, Four corners,
   Fishbowl, Six thinking hats, Group roles). Each one places a ready layout on the board and runs its phases with a timer bar
   along the top ("Think 1:00 → Pair 2:00 → Share 2:00"). Groups come from the class list the Wheel of Names uses.
   Everything placed is ordinary board objects (one Undo removes a whole layout); the live sticky wall is the Live class
   "Collaborate" activity, opened from here so it has one home. */
(() => {
'use strict';
const { $, $$, esc, icon, set, toast, modal, uid, SND } = window.HB;
const E = window.HBE, I = window.HBI;
const snd = k => { try { SND[k] && SND[k](); } catch (e) {} };
const tint = (hex, k) => { const n = parseInt(hex.slice(1), 16), r = n >> 16, g = (n >> 8) & 255, b = n & 255, m = v => Math.round(v + (255 - v) * k); return '#' + [m(r), m(g), m(b)].map(v => v.toString(16).padStart(2, '0')).join(''); };
const COL = ['#FF5FA2', '#22D3EE', '#F59F00', '#40C057', '#7950F2', '#FD7E14', '#15AABF', '#E64980'];
const STICKY = ['#FFF3A3', '#FFD6E7', '#C9F2FF', '#D3F9D8', '#E5DBFF', '#FFE8CC'];
const ink = () => E.isDark() ? '#F1E9F5' : '#2B1B3D';
const names = () => (set.get('names', []) || []).map(s => String(s).trim()).filter(Boolean);
const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const groupsOf = (list, size) => { const n = Math.max(1, Math.round(list.length / size)), out = Array.from({ length: n }, () => []); shuffle(list).forEach((s, i) => out[i % n].push(s)); return out; };
const mmss = s => Math.floor(s / 60) + ':' + String(Math.max(0, s % 60)).padStart(2, '0');

/* ---------- building blocks (board units) ---------- */
function area(w, h) { const vr = E.viewRect(), W = Math.min(w, vr[2] * 0.92), k = W / w, H = h * k; return { x: vr[0] + (vr[2] - W) / 2, y: vr[1] + Math.max(40, (vr[3] - H) / 2), k }; }
const frame = (g, x, y, w, h, col, title, sub) => { const o = [{ id: uid(), ts: Date.now(), t: 'shape', k: 'round', x, y, w, h, c: col, sw: 4, fill: tint(col, E.isDark() ? 0.25 : 0.88), layer: 1, g, co: 1 }];
  if (title) o.push({ id: uid(), ts: Date.now(), t: 'text', x: x + 22, y: y + 16, w: w - 44, s: title, font: 'Lexend', size: 28, b: true, c: E.isDark() ? '#FFFFFF' : col, layer: 1, g, co: 1 });
  if (sub) o.push({ id: uid(), ts: Date.now(), t: 'text', x: x + 22, y: y + 58, w: w - 44, s: sub, font: 'Lexend', size: 19, c: ink(), layer: 1, g, co: 1 }); return o; };
const sticky = (x, y, w, h, s, c, size) => ({ id: uid(), ts: Date.now(), t: 'note', x, y, w, h, c: c || STICKY[0], s, size: size || 24, font: 'Lexend', co: 1 });
const label = (g, x, y, w, s, size, col, b) => ({ id: uid(), ts: Date.now(), t: 'text', x, y, w, s, font: 'Lexend', size: size || 24, b: !!b, c: col || ink(), layer: 1, g, co: 1 });
function place(objs, fmt) { E.tx(() => E.add(objs, 1)); E.dirty.all(); E.changed(); snd('pop');
  const xs = objs.map(o => [o.x, o.y, o.x + (o.w || 0), o.y + (o.h || 0)]), x0 = Math.min(...xs.map(a => a[0])), y0 = Math.min(...xs.map(a => a[1])), x1 = Math.max(...xs.map(a => a[2])), y1 = Math.max(...xs.map(a => a[3]));
  const pad = 70, s = Math.min(1.6, (E.SW - pad * 2) / (x1 - x0), (E.SH - pad * 2 - 110) / (y1 - y0)); E.setView(s, E.SW / 2 - (x0 + x1) / 2 * s, (E.SH - 110) / 2 - (y0 + y1) / 2 * s + 30);
  return objs; }

/* ---------- the ten structures ---------- */
const F = {
  tps: { name: 'Think–Pair–Share', ic: 'users', phases: [['Think', 60], ['Pair', 120], ['Share', 120]], build(g) { const a = area(1500, 760), k = a.k, o = [];
    o.push(sticky(a.x, a.y, 1500 * k, 110 * k, 'Question: write it here…', STICKY[0], 30));
    [['1 · Think', 'On your own, in silence. Jot down your ideas.', COL[1]], ['2 · Pair', 'Compare with your partner. Agree on the best answer.', COL[0]], ['3 · Share', 'Tell the class. Build on other pairs.', COL[3]]].forEach((c, i) => o.push(...frame(g, a.x + i * 510 * k, a.y + 140 * k, 480 * k, 620 * k, c[2], c[0], c[1]))); return o; } },
  jigsaw: { name: 'Jigsaw', ic: 'puzzle', phases: [['Home groups meet', 120], ['Expert groups learn', 300], ['Back home: teach', 300], ['Check together', 120]], ask: 'topics',
    build(g, opt) { const T = opt.topics, L = names(), a = area(1600, 900), k = a.k, o = [], n = T.length, w = (1600 - (n - 1) * 24) / n;
      T.forEach((t, i) => o.push(...frame(g, a.x + i * (w + 24) * k, a.y, w * k, 300 * k, COL[i % COL.length], 'Expert ' + String.fromCharCode(65 + i), t)));
      const homes = L.length >= n ? groupsOf(L, n) : Array.from({ length: 6 }, (_, i) => Array.from({ length: n }, (_, j) => 'Seat ' + (j + 1)));
      const cw = Math.min(250, (1600 - (homes.length - 1) * 20) / homes.length);
      homes.forEach((m, i) => o.push(sticky(a.x + i * (cw + 20) * k, a.y + 340 * k, cw * k, Math.max(200, 60 + m.length * 34) * k, 'Home group ' + (i + 1) + '\n' + m.map((s, j) => s + ' → ' + String.fromCharCode(65 + j % n)).join('\n'), STICKY[i % STICKY.length], 20)));
      return o; } },
  placemat: { name: 'Placemat', ic: 'layout-grid', phases: [['Write alone', 120], ['Read round the mat', 180], ['Agree in the centre', 120]], build(g) { const a = area(1200, 900), k = a.k, o = [], W = 1200 * k, H = 900 * k;
    [[0, 0], [1, 0], [0, 1], [1, 1]].forEach(([c, r], i) => o.push(...frame(g, a.x + c * W / 2, a.y + r * H / 2, W / 2 - 8 * k, H / 2 - 8 * k, COL[i], 'Person ' + (i + 1))));
    o.push(...frame(g, a.x + W / 2 - 230 * k, a.y + H / 2 - 150 * k, 460 * k, 300 * k, '#2B1B3D', 'Group consensus', 'What do we all agree on?')); return o; } },
  gallery: { name: 'Gallery walk', ic: 'images', phases: null, ask: 'stations', build(g, opt) { const n = opt.n, a = area(1600, 960), k = a.k, o = [], cols = n <= 4 ? n : Math.ceil(n / 2), rows = Math.ceil(n / cols), w = (1600 - (cols - 1) * 24) / cols, h = (960 - (rows - 1) * 24) / rows;
    for (let i = 0; i < n; i++) { const x = a.x + (i % cols) * (w + 24) * k, y = a.y + Math.floor(i / cols) * (h + 24) * k; o.push(...frame(g, x, y, w * k, h * k, COL[i % COL.length], 'Station ' + (i + 1), 'Look, then leave one sticky: ✓ agree · ? question · + add')); }
    return o; }, phasesFor: opt => Array.from({ length: opt.n }, (_, i) => ['Station rotation ' + (i + 1) + '/' + opt.n, 90]).concat([['Back to your own station', 120]]) },
  carousel: { name: 'Carousel stations', ic: 'refresh-cw', phases: null, ask: 'stations', build(g, opt) { const n = opt.n, a = area(1600, 960), k = a.k, o = [], cols = n <= 4 ? n : Math.ceil(n / 2), rows = Math.ceil(n / cols), w = (1600 - (cols - 1) * 24) / cols, h = (960 - (rows - 1) * 24) / rows;
    for (let i = 0; i < n; i++) { const x = a.x + (i % cols) * (w + 24) * k, y = a.y + Math.floor(i / cols) * (h + 24) * k; o.push(...frame(g, x, y, w * k, h * k, COL[i % COL.length], 'Question ' + (i + 1), 'Read what the last group wrote, then add to it in a new colour.')); }
    return o; }, phasesFor: opt => Array.from({ length: opt.n }, (_, i) => ['Rotation ' + (i + 1) + '/' + opt.n, 120]) },
  heads: { name: 'Numbered heads together', ic: 'hash', phases: [['Heads together', 120], ['Number answers', 45]], extra: ['Pick a number', () => pickNumber()], build(g) { const a = area(1500, 760), k = a.k, o = [];
    o.push(...frame(g, a.x, a.y, 1500 * k, 260 * k, COL[4], 'Question', 'Everyone in the group must be able to answer. Then a number is picked.'));
    for (let i = 0; i < 4; i++) o.push(sticky(a.x + i * 380 * k, a.y + 300 * k, 350 * k, 220 * k, String(i + 1) + '\n\nEach person takes a number', STICKY[i], 30)); return o; } },
  corners: { name: 'Four corners', ic: 'move-diagonal', phases: [['Think', 30], ['Move to a corner', 30], ['Discuss in corners', 120], ['Share reasons', 120]], build(g) { const a = area(1500, 900), k = a.k, o = [], W = 1500 * k, H = 900 * k, w = 460 * k, h = 300 * k;
    [['Strongly agree', COL[3]], ['Agree', COL[1]], ['Disagree', COL[2]], ['Strongly disagree', COL[0]]].forEach((c, i) => o.push(...frame(g, a.x + (i % 2) * (W - w), a.y + Math.floor(i / 2) * (H - h), w, h, c[1], c[0], 'Count: ___   Best reason:')));
    o.push(sticky(a.x + W / 2 - 260 * k, a.y + H / 2 - 110 * k, 520 * k, 220 * k, 'Statement: write it here…', STICKY[0], 28)); return o; } },
  fishbowl: { name: 'Fishbowl', ic: 'circle-dot', phases: [['Round 1: inner circle talks', 300], ['Swap places', 30], ['Round 2: inner circle talks', 300], ['Debrief', 120]], build(g) { const a = area(1400, 900), k = a.k, o = [], cx = a.x + 700 * k, cy = a.y + 450 * k;
    o.push({ id: uid(), ts: Date.now(), t: 'shape', k: 'ellipse', x: cx - 650 * k, y: cy - 420 * k, w: 1300 * k, h: 840 * k, c: COL[1], sw: 4, fill: tint(COL[1], 0.9), layer: 1, g, co: 1 });
    o.push({ id: uid(), ts: Date.now(), t: 'shape', k: 'ellipse', x: cx - 330 * k, y: cy - 210 * k, w: 660 * k, h: 420 * k, c: COL[0], sw: 4, fill: tint(COL[0], 0.85), layer: 1, g, co: 1 });
    o.push(label(g, cx - 260 * k, cy - 40 * k, 520 * k, 'Inner circle: discuss', 32 * k, COL[0], true), label(g, cx - 560 * k, cy - 380 * k, 600 * k, 'Outer circle: listen and take notes', 26 * k, COL[1], true));
    o.push(sticky(a.x + 1420 * k, a.y, 360 * k, 300 * k, 'Observers note:\n• a strong point\n• a question\n• who built on whom', STICKY[2], 22)); return o; } },
  hats: { name: 'Six thinking hats', ic: 'graduation-cap', phases: [['White: facts', 90], ['Red: feelings', 60], ['Black: cautions', 90], ['Yellow: benefits', 90], ['Green: new ideas', 120], ['Blue: decide', 90]], build(g) { const a = area(1560, 860), k = a.k, o = [], w = 500, h = 410;
    [['White hat · Facts', 'What do we know? What do we need to find out?', '#868E96'], ['Red hat · Feelings', 'Gut reactions, no reasons needed.', '#E03131'], ['Black hat · Cautions', 'Risks, problems, what could go wrong.', '#212529'], ['Yellow hat · Benefits', 'Why it could work. The best case.', '#F59F00'], ['Green hat · New ideas', 'Alternatives, creative possibilities.', '#2F9E44'], ['Blue hat · Process', 'Summary, decision, next steps.', '#1971C2']]
      .forEach((c, i) => o.push(...frame(g, a.x + (i % 3) * (w + 30) * k, a.y + Math.floor(i / 3) * (h + 30) * k, w * k, h * k, c[2], c[0], c[1]))); return o; } },
  roles: { name: 'Group roles', ic: 'id-card', phases: null, ask: 'size', build(g, opt) { const R = [['Leader', 'Keeps everyone on task'], ['Recorder', 'Writes the group’s answers'], ['Timekeeper', 'Watches the clock'], ['Presenter', 'Reports to the class'], ['Skeptic', 'Asks “How do we know?”'], ['Encourager', 'Makes sure everyone speaks']].slice(0, opt.size);
    const L = names(), a = area(1600, 900), k = a.k, o = [];
    if (L.length >= 2) { const G = groupsOf(L, opt.size), cw = Math.min(300, (1600 - (Math.min(G.length, 5) - 1) * 20) / Math.min(G.length, 5));
      G.forEach((m, i) => { const r = shuffle(R); o.push(sticky(a.x + (i % 5) * (cw + 20) * k, a.y + Math.floor(i / 5) * 330 * k, cw * k, 300 * k, 'Group ' + (i + 1) + '\n' + m.map((s, j) => s + ': ' + (r[j % r.length][0])).join('\n'), STICKY[i % STICKY.length], 20)); }); }
    else R.forEach((r, i) => o.push(sticky(a.x + (i % 3) * 520 * k, a.y + Math.floor(i / 3) * 300 * k, 490 * k, 270 * k, r[0] + '\n' + r[1], STICKY[i % STICKY.length], 30)));
    return o; } }
};

/* ---------- options asked before placing ---------- */
function options(id, cb) { const f = F[id];
  if (!f.ask) return cb({});
  const body = f.ask === 'topics' ? '<p>One expert topic per line (2–6). Each home group sends one member to each expert group.</p><textarea id="coT" rows="5" style="width:100%">Topic A\nTopic B\nTopic C\nTopic D</textarea>'
    : f.ask === 'stations' ? '<p>How many stations?</p><input id="coN" type="number" min="2" max="10" value="' + Math.max(2, Math.min(8, Math.round(names().length / 4) || 6)) + '" style="width:90px">'
    : '<p>People per group (2–6). Roles are shared out at random' + (names().length ? ' using your class list (' + names().length + ' names).' : '; add names in the Wheel of Names to fill the cards.') + '</p><input id="coS" type="number" min="2" max="6" value="4" style="width:90px">';
  modal.open('<h2>' + esc(f.name) + '</h2>' + body + '<div class="foot"><button class="btn" id="coX">Cancel</button><button class="btn primary" id="coGo">Place on the board</button></div>', sh => {
    sh.querySelector('#coX').onclick = () => modal.close();
    sh.querySelector('#coGo').onclick = () => { let o = {};
      if (f.ask === 'topics') { const t = sh.querySelector('#coT').value.split('\n').map(s => s.trim()).filter(Boolean).slice(0, 6); if (t.length < 2) { toast('Write at least two topics.'); return; } o.topics = t; }
      else if (f.ask === 'stations') o.n = Math.max(2, Math.min(10, +sh.querySelector('#coN').value || 6));
      else o.size = Math.max(2, Math.min(6, +sh.querySelector('#coS').value || 4));
      modal.close(); cb(o); }; }); }
/* each structure gets a page of its own (unless this one is still empty), so layouts never pile up on each other */
function freshPage(name) { const busy = E.page().objs.some(o => !o.off); if (busy && window.HBUI && HBUI.addPage) HBUI.addPage(); try { E.page().name = String(name).slice(0, 40); window.HBUI && HBUI.refresh && HBUI.refresh(); } catch (e) {} }
function start(id) { const f = F[id]; if (!f) return; options(id, opt => { freshPage(f.name); const g = uid(); place(f.build(g, opt), id); const ph = f.phasesFor ? f.phasesFor(opt) : f.phases; if (ph) run(f.name, ph, f.extra); else stop(); }); }

/* ---------- the phase bar ---------- */
const st = { el: null, name: '', ph: [], i: 0, left: 0, on: false, iv: 0, extra: null };
const css = document.createElement('style'); css.textContent = `
#coBar{position:fixed;left:50%;top:60px;transform:translateX(-50%);z-index:58;display:flex;align-items:center;gap:6px;padding:6px 8px;border-radius:16px;background:var(--glass);border:1px solid color-mix(in srgb,var(--accent) 45%,var(--line));box-shadow:var(--shadow);font:600 14px var(--ui);color:var(--ink);max-width:calc(100vw - 32px);flex-wrap:wrap;justify-content:center}
#coBar b{font:800 15px var(--ui);margin:0 4px}#coBar .ph{padding:5px 10px;border-radius:999px;background:var(--panel2);opacity:.65;white-space:nowrap}#coBar .ph.on{opacity:1;background:var(--accent);color:#fff}#coBar .ph.dn{opacity:.4;text-decoration:line-through}
#coBar .clk{font:800 22px var(--mono);min-width:72px;text-align:center}#coBar button{min-width:44px;height:44px;border-radius:12px;border:0;background:var(--panel2);color:var(--ink);display:grid;place-items:center;cursor:pointer;padding:0 10px;font:700 13px var(--ui)}
#coBar button:hover{background:color-mix(in srgb,var(--accent) 25%,var(--panel2))}#coBar svg{width:20px;height:20px}#coBar.end .clk{color:#E03131;animation:coP .6s ease-in-out 3}@keyframes coP{50%{transform:scale(1.25)}}
#coNum{position:fixed;inset:0;z-index:80;display:grid;place-items:center;background:rgba(10,4,16,.72);color:#fff;font:900 min(42vw,420px)/1 var(--ui);cursor:pointer}
body.deckshow #coBar{display:none}`; document.head.appendChild(css);
function run(name, phases, extra) { stop(); st.name = name; st.ph = phases; st.i = 0; st.left = phases[0][1]; st.on = true; st.extra = extra || null; st.el = document.createElement('div'); st.el.id = 'coBar'; document.body.appendChild(st.el);
  /* sits just under the page tabs, so they stay clickable */
  const pt = document.getElementById('pagetabs'), b = pt && pt.getBoundingClientRect(); if (b && b.height) st.el.style.top = Math.round(b.bottom + 8) + 'px';
  ['pointerdown', 'wheel'].forEach(ev => st.el.addEventListener(ev, e => e.stopPropagation())); st.iv = setInterval(tick, 1000); draw(); snd('chime'); }
function draw() { if (!st.el) return; st.el.classList.remove('end');
  st.el.innerHTML = '<b>' + esc(st.name) + '</b>' + st.ph.map((p, i) => '<span class="ph' + (i === st.i ? ' on' : i < st.i ? ' dn' : '') + '">' + esc(p[0]) + ' ' + mmss(p[1]) + '</span>').join('') +
    '<span class="clk">' + mmss(st.left) + '</span><button data-a="pp" title="' + (st.on ? 'Pause' : 'Start') + '">' + icon(st.on ? 'pause' : 'play') + '</button><button data-a="m" title="One more minute">+1</button><button data-a="nx" title="Next phase">' + icon('skip-forward') + '</button>' +
    (st.extra ? '<button data-a="ex">' + esc(st.extra[0]) + '</button>' : '') + '<button data-a="x" title="Close the timer">' + icon('x') + '</button>';
  $$('button', st.el).forEach(b => b.onclick = () => { const a = b.dataset.a; if (a === 'pp') { st.on = !st.on; draw(); } else if (a === 'm') { st.left += 60; draw(); } else if (a === 'nx') next(); else if (a === 'ex') st.extra[1](); else stop(); }); }
function tick() { if (!st.on || !st.el) return; st.left--; if (st.left <= 0) { snd('chime'); if (st.i < st.ph.length - 1) { next(); toast('Next: ' + st.ph[st.i][0]); } else { st.left = 0; st.on = false; draw(); st.el.classList.add('end'); toast(st.name + ' finished.'); } return; }
  const c = $('.clk', st.el); if (c) c.textContent = mmss(st.left); }
function next() { if (st.i >= st.ph.length - 1) { stop(); return; } st.i++; st.left = st.ph[st.i][1]; st.on = true; draw(); }
function stop() { clearInterval(st.iv); if (st.el) st.el.remove(); st.el = null; st.on = false; }
function pickNumber() { const n = 1 + Math.floor(Math.random() * 4), d = document.createElement('div'); d.id = 'coNum'; d.textContent = n; d.title = 'Tap to close'; d.onclick = () => d.remove(); document.body.appendChild(d); snd('done'); setTimeout(() => d.remove(), 4000); return n; }

/* ---------- group tools ---------- */
function groupCards() { const L = names(); if (L.length < 2) { toast('Add your class names in the Wheel of Names first (Teach → Pick).'); return; }
  modal.open('<h2>Groups on the board</h2><p>' + L.length + ' names from your class list. People per group:</p><input id="coGS" type="number" min="2" max="8" value="4" style="width:90px"><div class="foot"><button class="btn" id="coX">Cancel</button><button class="btn primary" id="coGo">Make groups</button></div>', sh => {
    sh.querySelector('#coX').onclick = () => modal.close();
    sh.querySelector('#coGo').onclick = () => { const s = Math.max(2, Math.min(8, +sh.querySelector('#coGS').value || 4)); modal.close(); const G = groupsOf(L, s), a = area(1600, 900), k = a.k, cw = Math.min(300, (1600 - (Math.min(G.length, 5) - 1) * 20) / Math.min(G.length, 5));
      place(G.map((m, i) => sticky(a.x + (i % 5) * (cw + 20) * k, a.y + Math.floor(i / 5) * 330 * k, cw * k, 300 * k, 'Group ' + (i + 1) + '\n' + m.join('\n'), STICKY[i % STICKY.length], 22))); toast(G.length + ' groups placed. Drag names between cards to adjust.'); }; }); }
function pickGroup() { const n = E.page().objs.filter(o => o.t === 'note' && o.co && /^Group \d+/.test(o.s || '')); if (!n.length) { toast('Place groups on the board first.'); return; } const o = n[Math.floor(Math.random() * n.length)]; I.select([o]); snd('done'); toast((o.s || '').split('\n')[0] + ' is picked!'); }
function cluster() { const vr = E.viewRect(), w = 520, h = 420, g = uid(); place(frame(g, vr[0] + vr[2] / 2 - w / 2, vr[1] + vr[3] / 2 - h / 2, w, h, COL[Math.floor(Math.random() * COL.length)], 'Cluster name', 'Drag related stickies in here.')); }
function dots() { const vr = E.viewRect(), o = [], x0 = vr[0] + vr[2] / 2 - 300, y0 = vr[1] + 60; ['#E03131', '#1971C2', '#2F9E44'].forEach((c, r) => { for (let i = 0; i < 10; i++) o.push({ id: uid(), ts: Date.now(), t: 'shape', k: 'ellipse', x: x0 + i * 60, y: y0 + r * 60, w: 40, h: 40, c, sw: 2, fill: c, layer: 1, co: 1, vote: 1 }); });
  o.push(label(null, x0, y0 - 46, 640, 'Dot vote: drag up to 3 dots onto the ideas you like best', 22, ink(), true)); place(o); }
function liveWall() { if (window.HBLC && HBLC.open) HBLC.open('notes'); else toast('The live sticky wall needs Live class (Windows app).'); }

window.HBCO = { start, F, run, stop, next, pickNumber, groupCards, pickGroup, cluster, dots, liveWall, get state() { return st; } };
})();
