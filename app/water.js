/* ================= HelixBoard — Water: friendly hydration reminders for the teacher (and class water breaks) ================= */
(() => {
'use strict';
const { $, $$, set, toast, SND, REDUCE, icon } = window.HB;
const today = () => new Date().toISOString().slice(0, 10);
const st = Object.assign({ on: false, every: 45, goal: 8 }, set.get('waterCfg', {}));
let log = set.get('waterLog', { d: today(), n: 0 }); if (log.d !== today()) log = { d: today(), n: 0 };
let due = Date.now() + st.every * 60000, snoozeTo = 0, card = null;
const save = () => { set.put('waterCfg', st); set.put('waterLog', log); };
const FACTS = ['Your brain is about 75% water — a sip helps you think clearly.', 'Even 2% dehydration can reduce focus and memory.', 'Water carries oxygen and glucose to every cell in your body.', 'Your kidneys filter about 180 litres of blood plasma every day.', 'Saliva, blood and the fluid in your eyes are all mostly water.', 'Teaching is talking — your vocal cords need water to vibrate well.', 'Water helps regulate body temperature through sweating.', 'Osmosis in action: your cells need water to stay turgid and working.'];
const drop = () => { SND.tone(1250, 420, 0.13, 'sine', 0.09, 0, 'alert'); SND.tone(1900, 900, 0.06, 'sine', 0.04, 0.05, 'alert'); SND.tone(700, 1100, 0.18, 'sine', 0.035, 0.16, 'alert'); };
const yay = () => [784, 988, 1319].forEach((f, i) => SND.tone(f, 0, 0.35, 'sine', 0.05, i * 0.08, 'alert'));

function css() { if ($('#waterCss')) return; const s = document.createElement('style'); s.id = 'waterCss'; s.textContent = `
.wcard{position:fixed;right:44px;top:132px;z-index:66;width:min(460px,92vw);display:grid;grid-template-columns:112px 1fr;gap:16px;align-items:center;padding:18px 20px;border-radius:24px;background:linear-gradient(135deg,rgba(14,58,96,.96),rgba(10,32,58,.97));color:#EAF6FF;border:1px solid rgba(116,192,252,.45);box-shadow:0 20px 60px rgba(0,40,90,.55),0 0 0 6px rgba(77,171,247,.12),0 0 40px rgba(77,171,247,.35)}
.wcard h3{margin:0 0 4px;font:800 22px var(--head);color:#fff}
.wcard p{margin:0 0 12px;font:500 14px/1.45 var(--ui);color:#C5E3FF}
.wcard .wb{display:flex;gap:6px;flex-wrap:wrap}
.wcard button{border:0;border-radius:999px;padding:9px 16px;font:700 14px var(--ui);cursor:pointer}
.wcard .w1{background:#4DABF7;color:#06223C;box-shadow:0 6px 18px rgba(77,171,247,.5)}
.wcard .w2{background:rgba(255,255,255,.12);color:#EAF6FF}
.wcard .wglass{width:112px;height:140px}
.wcard .wcount{font:700 12px var(--ui);color:#9FD3FF;margin-top:6px}
.wfull{position:fixed;inset:0;z-index:66;display:grid;place-items:center;background:radial-gradient(80% 70% at 50% 40%,#0E3A60,#041322 75%);color:#EAF6FF;text-align:center}
.wfull h1{font:800 clamp(40px,7vw,90px)/1 var(--head);margin:10px 0}
.wfull .wt{font:800 clamp(60px,12vw,150px)/1 var(--mono);color:#74C0FC;text-shadow:0 0 40px rgba(116,192,252,.6)}
.wglasses{display:flex;gap:3px;align-items:flex-end}
.wglasses i{display:block;width:11px;height:18px;border:2px solid #4DABF7;border-top:0;border-radius:0 0 4px 4px;position:relative;overflow:hidden}
.wglasses i.f::after{content:"";position:absolute;left:0;right:0;bottom:0;height:75%;background:#4DABF7}
`; document.head.appendChild(s); }
/* an animated glass of water: waves move, bubbles rise, the level shows today's progress */
function glassSVG(level) { const y = 128 - Math.min(1, level) * 96; return '<svg class="wglass" viewBox="0 0 112 140" aria-hidden="true"><defs><clipPath id="wgc"><path d="M18 14 L94 14 L84 130 Q83 136 76 136 L36 136 Q29 136 28 130 Z"/></clipPath><linearGradient id="wgw" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#74C0FC"/><stop offset="1" stop-color="#1C7ED6"/></linearGradient></defs>' +
  '<g clip-path="url(#wgc)"><rect x="0" y="0" width="112" height="140" fill="rgba(255,255,255,.06)"/><g class="wwave"><path d="M-112 ' + y + ' q14 -8 28 0 t28 0 t28 0 t28 0 t28 0 t28 0 t28 0 t28 0 V140 H-112 Z" fill="url(#wgw)" opacity=".95"><animateTransform attributeName="transform" type="translate" from="0 0" to="56 0" dur="2.4s" repeatCount="indefinite"/></path><path d="M-112 ' + (y + 5) + ' q14 -6 28 0 t28 0 t28 0 t28 0 t28 0 t28 0 t28 0 t28 0 V140 H-112 Z" fill="#1971C2" opacity=".55"><animateTransform attributeName="transform" type="translate" from="56 0" to="0 0" dur="3.1s" repeatCount="indefinite"/></path></g>' +
  [24, 48, 70].map((x, i) => '<circle cx="' + (x + 6) + '" cy="130" r="' + (2 + i) + '" fill="rgba(255,255,255,.7)"><animate attributeName="cy" from="132" to="' + (y + 6) + '" dur="' + (2 + i * 0.7) + 's" repeatCount="indefinite"/><animate attributeName="opacity" values="0;.9;0" dur="' + (2 + i * 0.7) + 's" repeatCount="indefinite"/></circle>').join('') + '</g>' +
  '<path d="M18 14 L94 14 L84 130 Q83 136 76 136 L36 136 Q29 136 28 130 Z" fill="none" stroke="#D0EBFF" stroke-width="3" stroke-linejoin="round"/><path d="M26 22 L32 120" stroke="rgba(255,255,255,.35)" stroke-width="4" stroke-linecap="round"/></svg>'; }
function close() { if (card) { const c = card; card = null; if (window.gsap && !REDUCE) gsap.to(c, { y: -30, opacity: 0, duration: 0.25, onComplete: () => c.remove() }); else c.remove(); } }
function remind(manual) { css(); close(); drop(); const fact = FACTS[Math.floor(Math.random() * FACTS.length)];
  card = document.createElement('div'); card.className = 'wcard'; card.setAttribute('role', 'alert');
  card.innerHTML = '<div>' + glassSVG((log.n + 0.5) / st.goal) + '<div class="wcount">' + log.n + ' / ' + st.goal + ' glasses today</div></div><div><h3>Time for a sip of water 💧</h3><p>' + fact + '</p><div class="wb"><button class="w1" id="wDrank">✓ I drank a glass</button><button class="w2" id="wSnooze">Snooze 5 min</button><button class="w2" id="wLater">Later</button></div></div>';
  document.body.appendChild(card); if (window.gsap && !REDUCE) gsap.from(card, { y: -40, opacity: 0, scale: 0.95, duration: 0.45, ease: 'back.out(1.6)' });
  $('#wDrank', card).onclick = () => { drank(); close(); }; $('#wSnooze', card).onclick = () => { snoozeTo = Date.now() + 5 * 60000; close(); toast('Snoozed — I will remind you in 5 minutes.'); }; $('#wLater', card).onclick = () => { due = Date.now() + st.every * 60000; close(); };
  if (!manual) due = Date.now() + st.every * 60000; }
function drank() { if (log.d !== today()) log = { d: today(), n: 0 }; log.n++; save(); yay(); due = Date.now() + st.every * 60000; snoozeTo = 0; toast(log.n >= st.goal ? '🎉 ' + log.n + ' glasses — daily goal reached!' : '💧 ' + log.n + ' of ' + st.goal + ' glasses today'); window.HBUI && HBUI.buildRow(); }
function toggle() { st.on = !st.on; due = Date.now() + st.every * 60000; save(); toast(st.on ? '💧 Water reminders on — every ' + st.every + ' minutes.' : 'Water reminders off.'); window.HBUI && HBUI.refresh(); }
function every(m) { st.every = m; st.on = true; due = Date.now() + m * 60000; save(); toast('💧 I will remind you every ' + m + ' minutes.'); window.HBUI && HBUI.refresh(); }
function reset() { log = { d: today(), n: 0 }; save(); window.HBUI && HBUI.buildRow(); toast('Today\'s count reset.'); }
/* a one-minute water break for the whole class */
function classBreak() { css(); drop(); const el = document.createElement('div'); el.className = 'wfull'; let left = 60;
  el.innerHTML = '<div>' + glassSVG(0.85).replace('class="wglass"', 'class="wglass" style="width:180px;height:225px"') + '<h1>Water break 💧</h1><div class="wt" id="wbT">01:00</div><p style="font:500 18px var(--ui);color:#C5E3FF">' + FACTS[Math.floor(Math.random() * FACTS.length)] + '</p><button class="btn" id="wbX" style="margin-top:14px">Back to the lesson</button></div>';
  document.body.appendChild(el); const esc = e => { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); end(); } }; const end = () => { clearInterval(iv); el.remove(); document.removeEventListener('keydown', esc, true); }; document.addEventListener('keydown', esc, true); $('#wbX', el).onclick = end; const iv = setInterval(() => { left--; const t = $('#wbT', el); if (t) t.textContent = '00:' + String(Math.max(0, left)).padStart(2, '0'); if (left <= 0) { end(); SND.chime(); } }, 1000); }
setInterval(() => { if (!st.on || card) return; const now = Date.now(); if (snoozeTo && now >= snoozeTo) { snoozeTo = 0; remind(); return; } if (!snoozeTo && now >= due) remind(); }, 15000);
const glasses = () => '<div class="wglasses" title="' + log.n + ' of ' + st.goal + ' glasses today">' + Array.from({ length: st.goal }, (_, i) => '<i class="' + (i < log.n ? 'f' : '') + '"></i>').join('') + '</div><b style="font:700 12px var(--ui);margin-left:6px">' + log.n + '/' + st.goal + '</b>';
window.HBH = { remind: () => remind(true), drank, toggle, every, reset, classBreak, glasses, get on() { return st.on; }, get every_() { return st.every; }, st };
})();

