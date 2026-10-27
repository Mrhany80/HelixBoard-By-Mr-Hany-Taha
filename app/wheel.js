/* ================= HelixBoard — Wheel of Names (full-screen spinner with saved class lists) ================= */
(() => {
'use strict';
const { $, $$, esc, set, bus, toast, SND, isRTL, REDUCE, icon } = window.HB;
const I = window.HBI;
const COLORS = ['#FF6B6B', '#4DABF7', '#69DB7C', '#FFD43B', '#B197FC', '#FFA94D', '#63E6BE', '#F783AC', '#74C0FC', '#A9E34B'];
const DEFAULT = ['Ahmed', 'Omar', 'Yousef', 'Khalid', 'Faisal', 'Abdullah', 'Saud', 'Hamza', 'Ali', 'Fahad', 'Majed', 'Turki'];
const PRESETS = { 'Numbers 1–30': Array.from({ length: 30 }, (_, i) => String(i + 1)), 'Groups 1–6': ['Group 1', 'Group 2', 'Group 3', 'Group 4', 'Group 5', 'Group 6'], 'Biology review': ['Name an organelle and its job', 'Define osmosis', 'What does ATP stand for?', 'Mitosis or meiosis?', 'One function of the liver', 'Word equation for respiration', 'What is a gene?', 'Producer, consumer or decomposer?', 'Why do enzymes denature?', 'Name a part of the flower'] };
const st = { lists: set.get('wheelLists', null), cur: set.get('wheelCur', 'My class'), opts: Object.assign({ remove: true, time: 6, confetti: true }, set.get('wheelOpts', {})), removed: [], hist: [], ang: 0, spinning: false, el: null, raf: 0, idle: 0, flap: 0 };
if (!st.lists) { st.lists = { 'My class': set.get('names', DEFAULT).slice() }; }
if (!st.lists[st.cur]) st.cur = Object.keys(st.lists)[0];
const save = () => { set.put('wheelLists', st.lists); set.put('wheelCur', st.cur); set.put('wheelOpts', st.opts); set.put('names', st.lists[st.cur]); };
const active = () => (st.lists[st.cur] || []).filter(n => !st.removed.includes(n));

function css() { if ($('#wheelCss')) return; const s = document.createElement('style'); s.id = 'wheelCss'; s.textContent = `
#wheelStage{position:fixed;inset:0;z-index:44;display:grid;grid-template-columns:minmax(0,1fr) 340px;background:radial-gradient(90% 80% at 40% 50%,#2A1030,#0B0510 70%);color:#F6ECF4}
#wheelStage .wl{position:relative;display:grid;place-items:center;min-width:0;padding:16px}
#wheelStage canvas.wc{max-width:100%;max-height:calc(100vh - 150px);aspect-ratio:1;cursor:pointer;touch-action:none}
#wheelStage .wtop{position:absolute;left:18px;top:14px;display:flex;align-items:center;gap:10px;font:700 22px var(--head)}
#wheelStage .wtop small{font:500 13px var(--ui);color:#cdb8c8}
#wheelStage .wspin{position:absolute;left:50%;bottom:22px;transform:translateX(-50%);font:800 22px var(--head);padding:12px 44px;border-radius:999px;border:0;background:#FF5FA2;color:#24020F;box-shadow:0 10px 30px rgba(255,95,162,.45);cursor:pointer}
#wheelStage .wspin:disabled{opacity:.5}
#wheelStage aside{background:rgba(20,10,24,.92);border-left:1px solid rgba(255,255,255,.12);padding:14px;display:flex;flex-direction:column;gap:10px;overflow:auto}
#wheelStage aside textarea{flex:1;min-height:180px;resize:none;background:#140A18;color:#F6ECF4;border:1px solid rgba(255,255,255,.18);border-radius:10px;padding:10px;font:500 15px/1.5 var(--ui)}
#wheelStage aside select,#wheelStage aside .btn{background:#2A1A30;color:#F6ECF4;border:1px solid rgba(255,255,255,.18)}
#wheelStage .whist{font-size:13px;color:#cdb8c8;max-height:120px;overflow:auto}
#wheelStage .wx{position:absolute;right:356px;top:12px;width:40px;height:40px;border-radius:12px;border:1px solid rgba(255,255,255,.2);background:rgba(0,0,0,.3);color:#fff;display:grid;place-items:center;cursor:pointer}
#wheelStage .wwin{position:absolute;inset:0;display:grid;place-items:center;pointer-events:none}
#wheelStage .wcard{pointer-events:auto;min-width:min(520px,80%);padding:26px 30px;border-radius:24px;background:#fff;color:#1E1419;text-align:center;box-shadow:0 30px 80px rgba(0,0,0,.6)}
#wheelStage .wcard .wn{font:800 clamp(34px,6vw,72px)/1.1 var(--head);margin:8px 0 16px;word-break:break-word}
#wheelStage .wcard .row{justify-content:center;gap:8px;flex-wrap:wrap}
#wheelStage .wcard .btn{background:#F1E9DF;color:#1E1419;border:1px solid #D9CFC4;font-weight:700}
#wheelStage .wcard .btn.primary{background:#FF5FA2;color:#24020F;border-color:#FF5FA2}
#wheelStage canvas.wconf{position:absolute;inset:0;width:100%;height:100%;pointer-events:none}
@media (max-width:860px){#wheelStage{grid-template-columns:1fr;grid-template-rows:minmax(0,1fr) auto}#wheelStage aside{max-height:42vh}#wheelStage .wx{right:12px}}`; document.head.appendChild(s); }

function open(spinNow) { css(); if (st.el) { if (spinNow) spin(); return; } const el = document.createElement('div'); el.id = 'wheelStage'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-label', 'Wheel of names');
  el.innerHTML = '<div class="wl"><div class="wtop">' + icon('ferris-wheel') + '<span>Wheel of Names</span><small id="wCount"></small></div><canvas class="wc" id="wC"></canvas><canvas class="wconf" id="wConf"></canvas><button class="wspin" id="wSpin">SPIN</button><div class="wwin" id="wWin" hidden></div></div><button class="wx" id="wX" title="Close (Esc)" aria-label="Close wheel">' + icon('x') + '</button>' +
    '<aside><div class="row" style="gap:6px"><select class="sel" id="wList" style="flex:1"></select><button class="btn sm" id="wNew" title="New list">' + icon('plus') + '</button><button class="btn sm" id="wRen" title="Rename list">' + icon('pencil') + '</button><button class="btn sm" id="wDel" title="Delete list">' + icon('trash-2') + '</button></div>' +
    '<div class="row" style="gap:4px;flex-wrap:wrap">' + Object.keys(PRESETS).map(k => '<button class="btn sm" data-pre="' + esc(k) + '">' + esc(k) + '</button>').join('') + '</div>' +
    '<label class="small" for="wNames">Names — one per line (Arabic works too)</label><textarea id="wNames" spellcheck="false"></textarea>' +
    '<div class="row" style="gap:4px;flex-wrap:wrap"><button class="btn sm" id="wShuf">' + icon('shuffle') + ' Shuffle</button><button class="btn sm" id="wSort">A→Z</button><button class="btn sm" id="wReset">' + icon('rotate-ccw') + ' Bring back removed</button></div>' +
    '<label class="small"><input type="checkbox" id="wRm"> Remove the winner after each spin</label><label class="small"><input type="checkbox" id="wConfOn"> Confetti</label><label class="small">Spin time <select class="sel" id="wTime"><option value="3">Short (3 s)</option><option value="6">Normal (6 s)</option><option value="10">Long (10 s)</option></select></label>' +
    '<b class="small">Winners this lesson</b><div class="whist" id="wHist">—</div><p class="small" style="color:#cdb8c8;margin:0">Space or click the wheel to spin · Esc to close · lists are saved in this browser.</p></aside>';
  document.body.appendChild(el); st.el = el; if (window.gsap && !REDUCE) gsap.from(el, { opacity: 0, duration: 0.25 });
  $('#wX').onclick = close; $('#wSpin').onclick = spin; $('#wC').onclick = spin;
  $('#wList').onchange = e => { st.cur = e.target.value; st.removed = []; save(); sync(); };
  $('#wNew').onclick = () => { const n = prompt('Name for the new list (e.g. 10A Biology):', ''); if (!n || !n.trim()) return; const k = n.trim().slice(0, 40); if (!st.lists[k]) st.lists[k] = []; st.cur = k; st.removed = []; save(); sync(); setTimeout(() => $('#wNames').focus(), 50); };
  $('#wRen').onclick = () => { const n = prompt('Rename this list:', st.cur); if (!n || !n.trim() || n.trim() === st.cur) return; const k = n.trim().slice(0, 40); st.lists[k] = st.lists[st.cur]; delete st.lists[st.cur]; st.cur = k; save(); sync(); };
  $('#wDel').onclick = () => { if (Object.keys(st.lists).length < 2) { toast('Keep at least one list — clear the names instead.'); return; } window.HB.ask('Delete the list “' + window.HB.esc(st.cur) + '”?', 'Delete', () => { delete st.lists[st.cur]; st.cur = Object.keys(st.lists)[0]; st.removed = []; save(); sync(); }); };
  $$('[data-pre]', el).forEach(b => b.onclick = () => { const k = b.dataset.pre; st.lists[k] = PRESETS[k].slice(); st.cur = k; st.removed = []; save(); sync(); });
  $('#wNames').oninput = e => { st.lists[st.cur] = e.target.value.split(/\n|,|،/).map(s => s.trim()).filter(Boolean).slice(0, 200); st.removed = st.removed.filter(n => st.lists[st.cur].includes(n)); save(); draw(); count(); };
  $('#wNames').onkeydown = e => e.stopPropagation();
  $('#wShuf').onclick = () => { st.lists[st.cur].sort(() => Math.random() - 0.5); save(); sync(); SND.whoosh(); };
  $('#wSort').onclick = () => { st.lists[st.cur].sort((a, b) => a.localeCompare(b, ['en', 'ar'])); save(); sync(); };
  $('#wReset').onclick = () => { st.removed = []; sync(); toast('Everyone is back on the wheel.'); };
  $('#wRm').checked = st.opts.remove; $('#wRm').onchange = e => { st.opts.remove = e.target.checked; save(); };
  $('#wConfOn').checked = st.opts.confetti; $('#wConfOn').onchange = e => { st.opts.confetti = e.target.checked; save(); };
  $('#wTime').value = String(st.opts.time); $('#wTime').onchange = e => { st.opts.time = +e.target.value; save(); };
  document.addEventListener('keydown', onKey, true); window.addEventListener('resize', size); size(); sync(); idleLoop(); if (spinNow) setTimeout(spin, 350); }
function onKey(e) { if (!st.el) return; const tg = e.target.tagName; if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); if (!$('#wWin').hidden) hideWin(); else close(); return; } if (tg === 'TEXTAREA' || tg === 'INPUT' || tg === 'SELECT') return; if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); if (!$('#wWin').hidden) hideWin(); else spin(); } }
function close() { if (!st.el) return; cancelAnimationFrame(st.raf); cancelAnimationFrame(st.idle); document.removeEventListener('keydown', onKey, true); window.removeEventListener('resize', size); const el = st.el; st.el = null; st.spinning = false; el.remove(); /* removed at once so a reopened screen never collides with the old one */ }
function size() { const c = $('#wC'); if (!c) return; const box = c.parentElement.getBoundingClientRect(); const s = Math.max(240, Math.min(box.width - 32, box.height - 150)); const d = Math.min(2, devicePixelRatio || 1); c.width = c.height = Math.round(s * d); c.style.width = c.style.height = s + 'px'; const cf = $('#wConf'); cf.width = box.width * d; cf.height = box.height * d; draw(); }
function sync() { const sel = $('#wList'); if (!sel) return; sel.innerHTML = Object.keys(st.lists).map(k => '<option' + (k === st.cur ? ' selected' : '') + '>' + esc(k) + '</option>').join(''); $('#wNames').value = (st.lists[st.cur] || []).join('\n'); count(); hist(); draw(); }
function count() { const a = active().length, t = (st.lists[st.cur] || []).length; $('#wCount').textContent = '· ' + st.cur + ' · ' + a + (a !== t ? ' of ' + t : '') + ' on the wheel'; $('#wSpin').disabled = a < 1; }
function hist() { const h = $('#wHist'); if (h) h.innerHTML = st.hist.length ? st.hist.map((n, i) => (st.hist.length - i) + '. ' + esc(n)).join('<br>') : '—'; }

/* ---------- drawing ---------- */
function draw() { const c = $('#wC'); if (!c) return; const g = c.getContext('2d'), S = c.width, R = S / 2 - S * 0.05, list = active(), n = Math.max(1, list.length); g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, S, S); g.save(); g.translate(S / 2, S / 2);
  g.beginPath(); g.arc(0, 0, R + S * 0.025, 0, Math.PI * 2); g.fillStyle = '#1E1419'; g.fill(); g.lineWidth = S * 0.008; g.strokeStyle = '#FFD43B'; g.stroke();
  if (!list.length) { g.fillStyle = '#F6ECF4'; g.font = '700 ' + S * 0.04 + 'px Lexend, sans-serif'; g.textAlign = 'center'; g.fillText('Add names on the right →', 0, 0); g.restore(); return; }
  const step = Math.PI * 2 / n, fs = Math.max(10, Math.min(S * 0.055, (R * step) * 0.55, S * 1.1 / Math.max(6, Math.max(...list.map(s => s.length)) + 4)));
  list.forEach((nm, i) => { const a0 = st.ang + i * step, a1 = a0 + step; g.beginPath(); g.moveTo(0, 0); g.arc(0, 0, R, a0, a1); g.closePath(); g.fillStyle = COLORS[(n % COLORS.length === 1 && i === n - 1) ? 2 : i % COLORS.length]; g.fill(); g.strokeStyle = 'rgba(255,255,255,.85)'; g.lineWidth = S * 0.004; g.stroke();
    g.save(); g.rotate(a0 + step / 2); g.fillStyle = '#1E1419'; g.font = '700 ' + fs + 'px Lexend, Tajawal, sans-serif'; g.textBaseline = 'middle'; const rtl = isRTL(nm); g.direction = rtl ? 'rtl' : 'ltr'; g.textAlign = 'right'; /* canvas 'right' is absolute, so Arabic names also end at the rim */ let s = nm; while (g.measureText(s).width > R * 0.78 && s.length > 3) s = s.slice(0, -2) + '…'; g.fillText(s, R - S * 0.03, 0); g.restore(); });
  g.beginPath(); g.arc(0, 0, R * 0.13, 0, Math.PI * 2); g.fillStyle = '#fff'; g.fill(); g.lineWidth = S * 0.01; g.strokeStyle = '#1E1419'; g.stroke(); g.restore();
  /* pointer at the right; it flicks when it passes a peg */
  g.save(); g.translate(S - S * 0.035, S / 2); g.rotate(-st.flap); g.beginPath(); g.moveTo(-S * 0.075, 0); g.lineTo(S * 0.02, -S * 0.04); g.lineTo(S * 0.02, S * 0.04); g.closePath(); g.fillStyle = '#E03131'; g.fill(); g.lineWidth = S * 0.006; g.strokeStyle = '#fff'; g.stroke(); g.restore(); }
function idleLoop() { let last = performance.now(); const f = now => { if (!st.el) return; if (!st.spinning && $('#wWin').hidden) { st.ang += (now - last) * 0.00008; draw(); } last = now; st.idle = requestAnimationFrame(f); }; st.idle = requestAnimationFrame(f); }
const idxAt = (ang, n) => Math.floor((((-ang) % (Math.PI * 2)) + Math.PI * 4) % (Math.PI * 2) / (Math.PI * 2 / n)) % n;

/* ---------- spinning ---------- */
function spin() { if (!st.el || st.spinning) return; if (!$('#wWin').hidden) hideWin(); const list = active(); if (!list.length) return; SND.unlock(); st.spinning = true; $('#wSpin').disabled = true; const n = list.length, step = Math.PI * 2 / n, win = Math.floor(Math.random() * n);
  /* choose the end angle so the winner's segment stops under the pointer (angle 0), a little off-centre so it looks natural */
  const off = (0.15 + Math.random() * 0.7) * step; let target = -(win * step + off); const turns = 4 + Math.round(st.opts.time * 0.8) + Math.random() * 2; while (target > st.ang - turns * Math.PI * 2) target -= Math.PI * 2;
  const a0 = st.ang, dur = st.opts.time * 1000, t0 = performance.now(); let lastI = idxAt(a0, n);
  const ease = t => 1 - Math.pow(1 - t, 4);
  const f = now => { if (!st.el) return; const t = Math.min(1, (now - t0) / dur); st.ang = a0 + (target - a0) * ease(t); const i = idxAt(st.ang, n); if (i !== lastI) { lastI = i; st.flap = 0.45; const v = 1 - t; SND.tone(900 + v * 900, 0, 0.03, 'triangle', 0.035 + v * 0.03); SND.burst(0.012, 0.08, 3800, 5); } st.flap *= 0.82; draw(); if (t < 1) st.raf = requestAnimationFrame(f); else { st.flap = 0; draw(); done(list[idxAt(st.ang, n)]); } };
  st.raf = requestAnimationFrame(f); SND.whoosh(); }
function done(name) { st.spinning = false; st.hist.unshift(name); hist(); SND.fanfare(); if (st.opts.confetti && !REDUCE) confetti();
  const w = $('#wWin'); w.hidden = false; w.innerHTML = '<div class="wcard"><div class="small" style="font-weight:700;color:#B0124F;letter-spacing:.12em">THE WHEEL CHOSE</div><div class="wn" dir="auto">' + esc(name) + '</div><div class="row"><button class="btn primary" id="wwRm">Remove & spin again</button><button class="btn" id="wwKeep">Keep on wheel</button><button class="btn" id="wwBoard">Put on board</button></div></div>';
  if (window.gsap && !REDUCE) gsap.from('#wWin .wcard', { scale: 0.6, opacity: 0, duration: 0.45, ease: 'back.out(1.8)' });
  const rm = () => { if (!st.removed.includes(name)) st.removed.push(name); if (!active().length) { st.removed = []; toast('Everyone has had a turn — the wheel is full again.'); } };
  $('#wwRm').onclick = () => { rm(); hideWin(); count(); draw(); setTimeout(spin, 250); };
  $('#wwKeep').onclick = () => { hideWin(); };
  $('#wwBoard').onclick = () => { if (st.opts.remove) rm(); hideWin(); close(); I.insertObj({ t: 'text', s: '★ ' + name, font: 'Space Grotesk', size: 54, c: I.T.color, b: true, w: 0 }); };
  w.dataset.name = name; }
function hideWin() { const w = $('#wWin'); if (!w || w.hidden) return; if (st.opts.remove && w.dataset.name && !st.removed.includes(w.dataset.name) && w.dataset.keep !== '1') { /* default after closing: follow the "remove winner" option */ st.removed.push(w.dataset.name); if (!active().length) st.removed = []; } w.hidden = true; w.innerHTML = ''; delete w.dataset.name; $('#wSpin').disabled = active().length < 1; count(); draw(); }
function confetti() { const c = $('#wConf'); if (!c) return; const g = c.getContext('2d'), W = c.width, H = c.height; const P = Array.from({ length: 160 }, () => ({ x: W / 2 + (Math.random() - 0.5) * W * 0.2, y: H * 0.45, vx: (Math.random() - 0.5) * W * 0.018, vy: -Math.random() * H * 0.025 - H * 0.006, r: 4 + Math.random() * 7, c: COLORS[Math.floor(Math.random() * COLORS.length)], a: Math.random() * 6, va: (Math.random() - 0.5) * 0.4 })); const t0 = performance.now();
  const f = now => { g.clearRect(0, 0, W, H); const t = now - t0; P.forEach(p => { p.vy += H * 0.0007; p.vx *= 0.99; p.x += p.vx; p.y += p.vy; p.a += p.va; g.save(); g.translate(p.x, p.y); g.rotate(p.a); g.fillStyle = p.c; g.globalAlpha = Math.max(0, 1 - t / 2800); g.fillRect(-p.r, -p.r / 2, p.r * 2, p.r); g.restore(); }); if (t < 2800 && st.el) requestAnimationFrame(f); else g.clearRect(0, 0, W, H); }; requestAnimationFrame(f); }

/* keep the "Keep on wheel" button honest even when the remove option is on */
document.addEventListener('click', e => { if (e.target && e.target.id === 'wwKeep') { const w = $('#wWin'); if (w) w.dataset.keep = '1'; } }, true);
function editNames() { open(); setTimeout(() => { const t = $('#wNames'); if (t) { t.focus(); t.select(); } }, 80); }
function preset(k) { st.lists[k] = PRESETS[k].slice(); st.cur = k; st.removed = []; save(); open(); sync(); }
function newList() { open(); setTimeout(() => $('#wNew') && $('#wNew').click(), 60); }
setTimeout(() => { if (!window.HBUI || !HBUI.cmd) return; [['Wheel of names', () => open(), 'random picker spin student'], ['Spin the wheel', () => open(true), 'random pick name'], ['Edit wheel names', editNames, 'class list students']].forEach(([n, run, kw]) => HBUI.cmd({ n, k: 'Wheel', kw, ic: 'ferris-wheel', run })); }, 0);
window.HBW = { open, close, spin: () => open(true), editNames, preset, newList, get removeOn() { return st.opts.remove; }, toggleRemove() { st.opts.remove = !st.opts.remove; save(); toast(st.opts.remove ? 'Winners will be removed after each spin.' : 'Winners stay on the wheel.'); }, resetRemoved() { st.removed = []; toast('Everyone is back on the wheel.'); if (st.el) sync(); }, get st() { return st; } };
})();

