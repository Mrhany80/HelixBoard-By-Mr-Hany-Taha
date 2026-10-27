/* ================= HelixBoard — Timer tab: full-screen countdown, stopwatch, Think-Pair-Share and station sequences ================= */
(() => {
'use strict';
const { $, $$, esc, set, toast, SND, REDUCE, icon } = window.HB;
const PH = { think: '#4DABF7', pair: '#69DB7C', share: '#FFD43B', run: '#FF5FA2', warn: '#FFA94D', end: '#FF6B6B' };
const cfg = Object.assign({ full: false, dock: { x: null, y: 16, w: 380 }, mode: 'down', total: 300, alarm: 'chime', warn: true, label: '', tps: [60, 120, 120], tpsQ: 'What would happen to the rate of photosynthesis if the light intensity doubled?', seq: 'Station 1 — microscope | 5\nStation 2 — food tests | 5\nStation 3 — osmosis | 5\nClean up | 2' }, set.get('timerCfg', {}));
const st = { run: false, end: 0, left: cfg.total, el: null, chip: null, raf: 0, phases: null, pi: 0, swStart: 0, swAcc: 0, lastSec: -1 };
const save = () => set.put('timerCfg', cfg);
const fmt = s => { s = Math.max(0, Math.ceil(s)); const h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60), r = s % 60, z = n => String(n).padStart(2, '0'); return h ? h + ':' + z(m) + ':' + z(r) : z(m) + ':' + z(r); };
const fmtSW = ms => { const s = Math.floor(ms / 1000), z = n => String(n).padStart(2, '0'); return z(Math.floor(s / 60)) + ':' + z(s % 60) + '.' + Math.floor(ms % 1000 / 100); };

/* ---------- alarms (all synthesised) ---------- */
const ALARMS = { chime: () => SND.chime(), bell: () => { [0, 0.9, 1.8].forEach(d => [880, 1760, 2640].forEach((f, i) => SND.tone(f, 0, 1.6, 'sine', [0.07, 0.03, 0.015][i], d, 'alert'))); }, gong: () => { [110, 220, 331, 440].forEach((f, i) => SND.tone(f, f * 0.98, 3.5, 'sine', [0.12, 0.06, 0.04, 0.02][i], 0, 'alert')); }, fanfare: () => SND.fanfare(), soft: () => [523, 659].forEach((f, i) => SND.tone(f, 0, 0.8, 'sine', 0.05, i * 0.3, 'alert')), none: () => {} };
const phaseSound = () => { SND.tone(660, 0, 0.25, 'sine', 0.06, 0, 'alert'); SND.tone(990, 0, 0.45, 'sine', 0.05, 0.18, 'alert'); };

function css() { if ($('#timerCss')) return; const s = document.createElement('style'); s.id = 'timerCss'; s.textContent = `
#timerStage{position:fixed;inset:0;z-index:44;display:grid;grid-template-columns:minmax(0,1fr) 340px;background:radial-gradient(90% 80% at 40% 45%,#10223A,#05080F 70%);color:#EEF4FB}
#timerStage .tl{position:relative;display:grid;place-items:center;min-width:0;padding:16px}
#timerStage .ttop{position:absolute;left:18px;top:14px;display:flex;align-items:center;gap:10px;font:700 22px var(--head)}
#timerStage .tmodes{position:absolute;top:12px;left:50%;transform:translateX(-50%);display:flex;gap:4px;background:rgba(255,255,255,.06);padding:4px;border-radius:999px}
#timerStage .tmodes button{border:0;background:transparent;color:#C9D6E6;font:700 14px var(--ui);padding:8px 16px;border-radius:999px;cursor:pointer}
#timerStage .tmodes button[aria-pressed=true]{background:#EEF4FB;color:#0B1220}
#timerStage .tcenter{display:grid;justify-items:center;gap:10px;width:100%}
#timerStage .tq{max-width:min(1000px,90%);text-align:center;font:600 clamp(18px,2.4vw,30px)/1.35 var(--ui);color:#fff;min-height:1em}
#timerStage .tphase{font:800 clamp(28px,4vw,56px)/1 var(--head);letter-spacing:.02em}
#timerStage .tsub{font:500 clamp(14px,1.6vw,20px) var(--ui);color:#B8C7DA;margin-top:-4px}
#timerStage .tring{position:relative;width:min(56vh,46vw);aspect-ratio:1}
#timerStage .tring svg{width:100%;height:100%;transform:rotate(-90deg)}
#timerStage .tdig{position:absolute;inset:0;display:grid;place-items:center;font:800 clamp(48px,11vh,140px)/1 var(--mono);font-variant-numeric:tabular-nums;letter-spacing:-.02em}
#timerStage .tsteps{display:flex;gap:8px;flex-wrap:wrap;justify-content:center}
#timerStage .tsteps span{padding:6px 14px;border-radius:999px;border:1px solid rgba(255,255,255,.2);font:700 14px var(--ui);color:#B8C7DA}
#timerStage .tsteps span.on{color:#0B1220;border-color:transparent}
#timerStage .tsteps span.done{opacity:.45;text-decoration:line-through}
#timerStage .tctl{display:flex;gap:10px;flex-wrap:wrap;justify-content:center;align-items:center}
#timerStage .tbig{font:800 20px var(--head);padding:12px 38px;border-radius:999px;border:0;cursor:pointer;background:#FF5FA2;color:#24020F;box-shadow:0 10px 30px rgba(255,95,162,.35)}
#timerStage .tbtn{font:700 15px var(--ui);padding:10px 16px;border-radius:999px;border:1px solid rgba(255,255,255,.22);background:rgba(255,255,255,.06);color:#EEF4FB;cursor:pointer}
#timerStage .tbtn:hover{background:rgba(255,255,255,.14)}
#timerStage aside{background:rgba(8,14,26,.94);border-left:1px solid rgba(255,255,255,.12);padding:14px;display:flex;flex-direction:column;gap:10px;overflow:auto}
#timerStage aside .sel,#timerStage aside input,#timerStage aside textarea{background:#0E1A2C;color:#EEF4FB;border:1px solid rgba(255,255,255,.18);border-radius:8px;padding:6px 8px;font:500 14px var(--ui)}
#timerStage aside textarea{min-height:120px;resize:vertical}
#timerStage aside h4{margin:4px 0 0;font:700 13px var(--ui);color:#9FB3CC;letter-spacing:.06em;text-transform:uppercase}
#timerStage .tx-old{position:absolute;right:356px;top:12px;width:40px;height:40px;border-radius:12px;border:1px solid rgba(255,255,255,.2);background:rgba(0,0,0,.3);color:#fff;display:grid;place-items:center;cursor:pointer}
#timerStage.flash{animation:tflash .5s 6 alternate}
@keyframes tflash{to{background:#5A1020}}
.tchip{position:fixed;top:132px;right:24px;z-index:69;display:flex;align-items:center;gap:8px;padding:6px 14px;border-radius:999px;border:0;background:#0E1A2C;color:#EEF4FB;font:700 15px var(--mono);box-shadow:0 6px 20px rgba(0,0,0,.4);cursor:pointer}
.tchip i{width:10px;height:10px;border-radius:50%;display:block}
#timerStage.docked{position:absolute;inset:auto;left:var(--tx,auto);right:var(--tr,16px);top:var(--ty,16px);width:var(--tw,380px);display:block;border-radius:20px;background:rgba(10,18,32,.94);border:1px solid rgba(255,255,255,.14);box-shadow:0 18px 50px rgba(0,0,0,.45);z-index:8;touch-action:none;max-height:calc(100% - 32px);overflow:auto;scrollbar-width:thin}
#timerStage.docked .tl{display:block;padding:10px 14px 14px}
#timerStage.docked .ttop{position:static;font-size:16px;cursor:grab;padding:2px 96px 8px 0;user-select:none}
#timerStage.docked .tmodes{position:static;transform:none;margin:0 auto 10px;width:fit-content;flex-wrap:wrap;justify-content:center}
#timerStage.docked .tmodes button{font-size:12px;padding:6px 10px}
#timerStage.docked .tcenter{gap:6px}
#timerStage.docked .tq{font-size:calc(var(--tw,380px) * .045);max-width:100%}
#timerStage.docked .tphase{font-size:calc(var(--tw,380px) * .08)}
#timerStage.docked .tsub{font-size:13px}
#timerStage.docked .tring{width:calc(var(--tw,380px) - 120px)}
#timerStage.docked .tdig{font-size:calc(var(--tw,380px) * .14)}
#timerStage.docked .tsteps span{font-size:11px;padding:4px 9px}
#timerStage.docked .tctl{gap:6px}
#timerStage.docked .tbig{font-size:16px;padding:9px 24px}
#timerStage.docked .tbtn{font-size:12px;padding:7px 11px}
#timerStage.docked aside{display:none;border-left:0;border-top:1px solid rgba(255,255,255,.12);border-radius:0 0 20px 20px;max-height:none}
#timerStage.docked.showset aside{display:flex}
#timerStage.docked:not(.showset) #tPre{display:none}
#timerStage.docked .tphase{font-size:calc(var(--tw,380px) * .065)}
#timerStage .tacts{position:absolute;right:10px;top:10px;display:flex;gap:4px;z-index:2}
#timerStage .tacts button{width:34px;height:34px;border-radius:10px;border:1px solid rgba(255,255,255,.2);background:rgba(0,0,0,.3);color:#fff;display:grid;place-items:center;cursor:pointer;font:700 12px var(--ui)}
#timerStage .tacts svg.ic{width:17px;height:17px}
#timerStage:not(.docked) .tacts{right:356px;top:12px}
#timerStage:not(.docked) #tSet{display:none}
@media (max-width:860px){#timerStage:not(.docked) .tacts{right:12px}}
@media (max-width:860px){#timerStage{grid-template-columns:1fr;grid-template-rows:minmax(0,1fr) auto}#timerStage aside{max-height:40vh}#timerStage .tx{right:12px}.tchip{right:12px}}`; document.head.appendChild(s); }

/* ---------- phases: one list drives countdown, Think-Pair-Share and sequences ---------- */
function buildPhases() { if (cfg.mode === 'tps') return [['Think', 'on your own, silently', cfg.tps[0], PH.think], ['Pair', 'discuss with your partner', cfg.tps[1], PH.pair], ['Share', 'share your ideas with the class', cfg.tps[2], PH.share]];
  if (cfg.mode === 'seq') { const L = cfg.seq.split('\n').map(l => l.split('|')).filter(p => p[0].trim()).map((p, i) => [p[0].trim(), 'step ' + (i + 1), Math.max(5, Math.round((parseFloat(p[1]) || 1) * 60)), ['#4DABF7', '#69DB7C', '#FFD43B', '#B197FC', '#FFA94D', '#63E6BE'][i % 6]]); return L.length ? L : [['Step 1', '', 60, '#4DABF7']]; }
  return [[cfg.label || 'Time left', '', cfg.total, PH.run]]; }
function resetPhases() { st.run = false; st.phases = buildPhases(); st.pi = 0; st.left = st.phases[0][2]; st.swAcc = 0; st.laps = []; renderLaps(); st.lastSec = -1; paint(); chip(); }

function open(mode, full) { css(); if (mode) { cfg.mode = mode; save(); } if (full !== undefined) { cfg.full = !!full; save(); } if (st.el) { if (mode) { resetPhases(); syncSide(); } place(); return; }
  const el = document.createElement('div'); el.id = 'timerStage'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-label', 'Timer');
  el.innerHTML = '<div class="tl"><div class="ttop">' + icon('timer') + '<span>Timer</span></div><div class="tmodes">' + [['down', 'Countdown'], ['tps', 'Think · Pair · Share'], ['seq', 'Stations'], ['sw', 'Stopwatch']].map(([k, n]) => '<button data-m="' + k + '">' + n + '</button>').join('') + '</div>' +
    '<div class="tcenter"><div class="tq" id="tQ"></div><div class="tphase" id="tPh"></div><div class="tsub" id="tSub"></div><div class="tring"><svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="45" fill="none" stroke="rgba(255,255,255,.1)" stroke-width="6"/><circle id="tArc" cx="50" cy="50" r="45" fill="none" stroke="#FF5FA2" stroke-width="6" stroke-linecap="round" stroke-dasharray="282.74" stroke-dashoffset="0"/></svg><div class="tdig" id="tD">05:00</div></div><div class="tsteps" id="tSteps"></div>' +
    '<div class="tctl" id="tPre"></div><div class="tctl"><button class="tbtn" id="tM">−30 s</button><button class="tbig" id="tGo">Start</button><button class="tbtn" id="tP">+30 s</button><button class="tbtn" id="tR">' + icon('rotate-ccw') + ' Reset</button><button class="tbtn" id="tNext" title="Skip to the next step">Next ›</button><button class="tbtn" id="tLap2" title="Record a lap time">Lap</button></div></div></div>' +
    '<div class="tacts"><button id="tSet" title="Settings" aria-label="Timer settings">' + icon('settings') + '</button><button id="tSz" title="Size: small / medium / large" aria-label="Timer size">M</button><button id="tFull" title="Full screen / back into the board" aria-label="Full screen"></button><button id="tX" title="Close — the timer keeps running" aria-label="Close timer">' + icon('x') + '</button></div><aside id="tSide"></aside>';
  st.el = el; place();  if (window.gsap && !REDUCE) gsap.from(el, { opacity: 0, duration: 0.25 });
  $$('[data-m]', el).forEach(b => b.onclick = () => { const sw = () => { cfg.mode = b.dataset.m; save(); resetPhases(); syncSide(); }; if (st.run) window.HB.ask('Stop the running timer and switch?', 'Switch', sw); else sw(); });
  $('#tGo').onclick = toggle; $('#tR').onclick = resetPhases; $('#tM').onclick = () => adjust(-30); $('#tP').onclick = () => adjust(30); $('#tNext').onclick = next; $('#tLap2').onclick = lap; $('#tX').onclick = close; $('#tFull').onclick = () => { cfg.full = !cfg.full; save(); place(); }; $('#tSet').onclick = () => el.classList.toggle('showset'); $('#tSz').onclick = () => { const S = [300, 380, 520]; const i = (S.indexOf(cfg.dock.w) + 1) % S.length; cfg.dock.w = S[i]; save(); place(); }; drag(el);
  document.addEventListener('keydown', onKey, true); if (!st.phases) resetPhases(); syncSide(); paint(); loop(); }

/* the timer lives inside the board (a card you can drag and resize) or fills the screen */
function place() { const el = st.el; if (!el) return; const stage = $('#stage'); el.classList.toggle('docked', !cfg.full); const host = cfg.full ? document.body : stage; if (el.parentNode !== host) host.appendChild(el);
  el.style.setProperty('--tw', cfg.dock.w + 'px'); if (cfg.dock.x != null) { el.style.setProperty('--tx', cfg.dock.x + 'px'); el.style.setProperty('--tr', 'auto'); } else { el.style.removeProperty('--tx'); el.style.setProperty('--tr', '16px'); } el.style.setProperty('--ty', (cfg.dock.y || 16) + 'px');
  const f = $('#tFull', el); if (f) f.innerHTML = icon(cfg.full ? 'minimize-2' : 'maximize-2'); const z = $('#tSz', el); if (z) { z.textContent = { 300: 'S', 380: 'M', 520: 'L' }[cfg.dock.w] || 'M'; z.hidden = cfg.full; } el.tabIndex = -1; }
function drag(el) { const h = $('.ttop', el); let d = null; h.addEventListener('pointerdown', e => { if (cfg.full || e.target.closest('button')) return; const r = el.getBoundingClientRect(), sr = $('#stage').getBoundingClientRect(); d = { dx: e.clientX - r.left, dy: e.clientY - r.top, sr }; h.setPointerCapture(e.pointerId); h.style.cursor = 'grabbing'; e.stopPropagation(); });
  h.addEventListener('pointermove', e => { if (!d) return; const x = Math.max(0, Math.min(d.sr.width - el.offsetWidth, e.clientX - d.sr.left - d.dx)), y = Math.max(0, Math.min(d.sr.height - 60, e.clientY - d.sr.top - d.dy)); cfg.dock.x = Math.round(x); cfg.dock.y = Math.round(y); place(); });
  h.addEventListener('pointerup', () => { if (d) { d = null; h.style.cursor = ''; save(); } });
  el.addEventListener('pointerdown', e => e.stopPropagation()); el.addEventListener('wheel', e => e.stopPropagation()); /* drawing on the board never starts under the timer card */ }
function onKey(e) { if (!st.el) return; if (!cfg.full && !st.el.contains(document.activeElement) && !st.el.contains(e.target)) return; const tg = e.target.tagName; if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(); return; } if (tg === 'TEXTAREA' || tg === 'INPUT' || tg === 'SELECT') return; if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); toggle(); } if (e.key === 'r' || e.key === 'R') { e.stopPropagation(); resetPhases(); } }
function close() { if (!st.el) return; document.removeEventListener('keydown', onKey, true); const el = st.el; st.el = null; el.remove(); /* removed at once so a reopened screen never collides with the old one */ chip(); }

function syncSide() { const el = st.el; if (!el) return; $$('[data-m]', el).forEach(b => b.setAttribute('aria-pressed', b.dataset.m === cfg.mode)); const side = $('#tSide'); const presets = cfg.mode === 'down' ? [30, 60, 120, 180, 300, 600, 900, 1200, 1800] : [];
  $('#tPre').innerHTML = presets.map(s => '<button class="tbtn" data-s="' + s + '">' + (s < 60 ? s + ' s' : s / 60 + ' min') + '</button>').join(''); $$('[data-s]', el).forEach(b => b.onclick = () => { cfg.total = +b.dataset.s; save(); resetPhases(); });
  ['tM', 'tP'].forEach(id => $('#' + id).hidden = cfg.mode === 'sw'); $('#tNext').hidden = !(cfg.mode === 'tps' || cfg.mode === 'seq'); $('#tLap2').hidden = cfg.mode !== 'sw';
  let h = '';
  if (cfg.mode === 'down') h += '<h4>Countdown</h4><label class="small">Label shown on screen <input id="tLab" value="' + esc(cfg.label) + '" placeholder="e.g. Lab clean-up"></label><label class="small">Exact time (min : s) <span class="row" style="gap:6px"><input id="tMin" type="number" min="0" max="180" value="' + Math.floor(cfg.total / 60) + '" style="width:80px"> : <input id="tSec" type="number" min="0" max="59" value="' + cfg.total % 60 + '" style="width:80px"></span></label>';
  if (cfg.mode === 'tps') h += '<h4>Think · Pair · Share</h4><label class="small">Question shown above the timer<textarea id="tTq" style="min-height:80px">' + esc(cfg.tpsQ) + '</textarea></label>' + ['Think', 'Pair', 'Share'].map((n, i) => '<label class="small">' + n + ' (seconds) <input type="number" data-tps="' + i + '" min="10" max="1800" step="10" value="' + cfg.tps[i] + '" style="width:100px"></label>').join('') + '<div class="row" style="gap:4px;flex-wrap:wrap"><button class="tbtn" data-tp="30,60,60">Quick 2.5 min</button><button class="tbtn" data-tp="60,120,120">Standard 5 min</button><button class="tbtn" data-tp="120,180,180">Deep 8 min</button></div><button class="tbtn" id="tSheet">' + icon('columns-2') + ' Put a T-P-S sheet on the board</button>';
  if (cfg.mode === 'seq') h += '<h4>Stations / steps</h4><p class="small" style="color:#9FB3CC;margin:0">One step per line: name | minutes</p><textarea id="tSeq">' + esc(cfg.seq) + '</textarea>';
  if (cfg.mode === 'sw') h += '<h4>Stopwatch</h4><p class="small" style="color:#9FB3CC">Counts up — good for timing experiments or reaction tests. Laps are listed below.</p><div id="tLaps" class="small" style="font-family:var(--mono);line-height:1.7"></div><button class="tbtn" id="tLap">Lap</button>';
  h += '<h4>When time is up</h4><select class="sel" id="tAl">' + [['chime', 'Chime'], ['bell', 'School bell'], ['gong', 'Gong'], ['fanfare', 'Fanfare'], ['soft', 'Soft tone'], ['none', 'No sound']].map(([k, n]) => '<option value="' + k + '"' + (cfg.alarm === k ? ' selected' : '') + '>' + n + '</option>').join('') + '</select><button class="tbtn" id="tTest">▶ Test sound</button><label class="small"><input type="checkbox" id="tWarn"' + (cfg.warn ? ' checked' : '') + '> Tick in the last 10 seconds</label><p class="small" style="color:#9FB3CC;margin:0">Space = start / pause · R = reset · Esc = close (the timer keeps running in a small chip at the top).</p>';
  side.innerHTML = h;
  const on = (id, ev, f) => { const x = $('#' + id); if (x) x[ev] = f; };
  on('tLab', 'oninput', e => { cfg.label = e.target.value; save(); if (!st.run) { st.phases = buildPhases(); paint(); } });
  const exact = () => { const m = +$('#tMin').value || 0, s = +$('#tSec').value || 0; cfg.total = Math.max(5, Math.min(10800, m * 60 + s)); save(); resetPhases(); }; on('tMin', 'onchange', exact); on('tSec', 'onchange', exact);
  on('tTq', 'oninput', e => { cfg.tpsQ = e.target.value; save(); paint(); });
  $$('[data-tps]', side).forEach(x => x.onchange = () => { cfg.tps[+x.dataset.tps] = Math.max(10, +x.value || 60); save(); if (!st.run) resetPhases(); });
  $$('[data-tp]', side).forEach(b => b.onclick = () => { cfg.tps = b.dataset.tp.split(',').map(Number); save(); resetPhases(); syncSide(); });
  on('tSheet', 'onclick', () => { close(); window.HBS.template('tps'); });
  on('tSeq', 'oninput', e => { cfg.seq = e.target.value; save(); if (!st.run) resetPhases(); });
  on('tLap', 'onclick', lap); renderLaps();
  on('tAl', 'onchange', e => { cfg.alarm = e.target.value; save(); }); on('tTest', 'onclick', () => { SND.unlock(); ALARMS[cfg.alarm](); }); on('tWarn', 'onchange', e => { cfg.warn = e.target.checked; save(); }); }

/* ---------- running ---------- */
st.laps = [];
function lap() { const ms = st.swAcc + (st.run ? Date.now() - st.swStart : 0); if (!ms) return; st.laps.unshift(ms); SND.tick(); renderLaps(); }
function renderLaps() { const el2 = $('#tLaps'); if (el2) el2.innerHTML = st.laps.map((ms, i) => 'Lap ' + (st.laps.length - i) + ' — ' + fmtSW(ms)).join('<br>'); }
function toggle() { SND.unlock(); if (cfg.mode === 'sw') { if (st.run) { st.swAcc += Date.now() - st.swStart; st.run = false; } else { st.swStart = Date.now(); st.run = true; } paint(); chip(); return; }
  if (st.run) { st.left = Math.max(0, (st.end - Date.now()) / 1000); st.run = false; } else { if (st.left <= 0) resetPhases(); st.end = Date.now() + st.left * 1000; st.run = true; SND.pop(); if (st.el) st.el.classList.remove('flash'); } paint(); chip(); }
function adjust(d) { if (cfg.mode === 'sw') return; if (st.run) st.end += d * 1000; else st.left = Math.max(0, st.left + d); const ph = st.phases[st.pi]; ph[2] = Math.max(ph[2], st.run ? (st.end - Date.now()) / 1000 : st.left); paint(); }
function next() { if (st.pi >= st.phases.length - 1) { finish(); return; } st.pi++; st.left = st.phases[st.pi][2]; st.end = Date.now() + st.left * 1000; st.lastSec = -1; phaseSound(); paint(); chip(); }
function finish() { st.run = false; st.left = 0; ALARMS[cfg.alarm](); if (st.el) { st.el.classList.remove('flash'); void st.el.offsetWidth; st.el.classList.add('flash'); } else toast('⏰ Time is up!'); st.pi = st.phases.length - 1; paint(); chip(); }
function loop() { cancelAnimationFrame(st.raf); const f = () => { if (st.run && cfg.mode !== 'sw') { const left = (st.end - Date.now()) / 1000; const sec = Math.ceil(left); if (cfg.warn && sec <= 10 && sec > 0 && sec !== st.lastSec) SND.tick(); st.lastSec = sec; if (left <= 0) { if (st.pi < st.phases.length - 1) next(); else finish(); } else st.left = left; }
    paint(); chipText(); st.raf = requestAnimationFrame(f); }; st.raf = requestAnimationFrame(f); }
function paint() { if (!st.el || !st.phases) return; const ph = st.phases[st.pi]; const col = cfg.mode === 'sw' ? '#63E6BE' : (st.left <= 10 && st.run && cfg.mode === 'down') ? PH.end : ph[3];
  if (cfg.mode === 'sw') { const ms = st.swAcc + (st.run ? Date.now() - st.swStart : 0); $('#tD').textContent = fmtSW(ms); $('#tArc').style.strokeDashoffset = 282.74 * (1 - (ms / 60000 % 1)); $('#tPh').textContent = 'Stopwatch'; $('#tSub').textContent = st.run ? 'running' : ms ? 'paused' : 'ready'; $('#tQ').textContent = ''; $('#tSteps').innerHTML = st.laps.slice(0, 6).map((ms, i) => '<span>Lap ' + (st.laps.length - i) + ' · ' + fmtSW(ms) + '</span>').join(''); }
  else { $('#tD').textContent = fmt(st.left); $('#tArc').style.strokeDashoffset = 282.74 * (1 - st.left / Math.max(1, ph[2])); $('#tPh').textContent = ph[0]; $('#tPh').style.color = col; $('#tSub').textContent = st.left <= 0 ? 'Time is up!' : ph[1]; $('#tQ').textContent = cfg.mode === 'tps' ? cfg.tpsQ : '';
    $('#tSteps').innerHTML = st.phases.length > 1 ? st.phases.map((p, i) => '<span class="' + (i === st.pi ? 'on' : i < st.pi ? 'done' : '') + '" style="' + (i === st.pi ? 'background:' + p[3] : '') + '">' + esc(p[0]) + ' · ' + fmt(p[2]) + '</span>').join('') : ''; }
  $('#tArc').setAttribute('stroke', col); $('#tD').style.color = st.left <= 10 && st.run && cfg.mode === 'down' ? PH.end : '#EEF4FB'; $('#tGo').textContent = st.run ? 'Pause' : (cfg.mode !== 'sw' && st.left <= 0 ? 'Restart' : 'Start'); }
/* small chip so a running timer stays visible after closing the big screen */
function chip() { const need = !st.el && st.run; if (need && !st.chip) { const c = document.createElement('button'); c.className = 'tchip'; c.title = 'Open the timer'; c.onclick = () => open(); document.body.appendChild(c); st.chip = c; } if (!need && st.chip) { st.chip.remove(); st.chip = null; } chipText(); if (st.run && !st.raf) loop(); }
function chipText() { if (!st.chip || !st.phases) return; const ph = st.phases[st.pi]; st.chip.innerHTML = '<i style="background:' + (cfg.mode === 'sw' ? '#63E6BE' : ph[3]) + '"></i>' + (cfg.mode === 'sw' ? fmtSW(st.swAcc + Date.now() - st.swStart) : esc(ph[0]) + ' ' + fmt(st.left)); if (!st.run && st.chip) chip(); }

function quick(sec) { cfg.mode = 'down'; cfg.total = sec; save(); open(); resetPhases(); syncSide(); toggle(); }
setTimeout(() => { if (!window.HBUI || !HBUI.cmd) return; [['Timer', () => open(), 'countdown clock'], ['Think-Pair-Share timer', () => open('tps'), 'tps discussion routine'], ['Station rotation timer', () => open('seq'), 'stations sequence carousel'], ['Stopwatch', () => open('sw'), 'count up experiment']].forEach(([n, run, kw]) => HBUI.cmd({ n, k: 'Timer', kw, ic: 'timer', run })); }, 0);
window.HBT = { open, close, quick, full: () => open(null, true), tps: () => open('tps'), stations: () => open('seq'), stopwatch: () => open('sw'), toggle, get running() { return st.run; }, get st() { return st; }, cfg };
})();

