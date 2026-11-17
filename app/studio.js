/* ================= HelixBoard — Teach & Study studio: lesson plan + flow, live quiz, practice quiz, spaced flashcards, retrieval starter,
   show-me boards, confidence check, question stems, cold call, command words + answer frames, team points, focus timer, brain dump, progress =================
   Teachers and students write their own quiz and flashcard sets; a set can be exported as a .hbset file and imported on another computer. */
(() => {
'use strict';
const { $, $$, clamp, esc, icon, set, toast, modal, SND, floatPanel, REDUCE, uid } = window.HB;
const E = window.HBE, I = window.HBI;
const snd = k => { try { SND[k] && SND[k](); } catch (e) {} };
const LET = 'ABCDEF', OC = ['#FF5FA2', '#22D3EE', '#FFC928', '#4ADE80', '#B197FC', '#FF9F5A'];
const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const dayKey = (d = new Date()) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
const addDays = (n, d = new Date()) => { const x = new Date(d); x.setDate(x.getDate() + n); return dayKey(x); };
const fmt = s => { const neg = s < 0; s = Math.abs(Math.round(s)); return (neg ? '−' : '') + String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0'); };
const pct = (a, b) => b ? Math.round(a / b * 100) : 0;
const ink = () => E.isDark() ? '#F6ECF4' : '#1E1419';
const accent = () => E.isDark() ? '#FF5FA2' : '#B0124F';
const plural = (n, w) => n + ' ' + w + (n === 1 ? '' : 's');
/* usage for the account (no-op without an account) */
const track = (how, ...a) => { try { if (window.HBA) HBA[how](...a); } catch (e) {} };
/* a typed answer in the board's own dialog — window.prompt is blocked in kiosk browsers and the desktop app */
function askText(title, hint, def, cb) { modal.open('<h2>' + title + '</h2>' + (hint ? '<p class="small muted">' + hint + '</p>' : '') + '<input id="atV" class="inp" style="width:100%" value="' + esc(def || '') + '"><div class="foot"><button class="btn" data-close>Cancel</button><button class="btn primary" id="atOk">OK</button></div>', s => { const v = $('#atV', s), ok = () => { const x = v.value; modal.close(); cb(x); }; $('#atOk', s).onclick = ok; v.onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); ok(); } e.stopPropagation(); }; setTimeout(() => { v.focus(); v.select(); }, 40); }); }

/* ---------- styles ---------- */
const css = document.createElement('style'); css.id = 'studioCss'; css.textContent = `
#stStage{position:fixed;inset:0;z-index:45;background:radial-gradient(1200px 640px at 50% -12%,color-mix(in srgb,var(--accent) 16%,var(--bg)),var(--bg));color:var(--ink);display:flex;flex-direction:column;padding:58px clamp(16px,4vw,64px) 28px;overflow:auto}
#stStage .inp,.st-panel .inp{background:var(--panel);border:2px solid var(--line);border-radius:12px;color:var(--ink);padding:0 12px;height:38px}#stStage .inp:focus,.st-panel .inp:focus{outline:none;border-color:var(--accent)}
#stStage .st-x{position:absolute;top:14px;right:16px;z-index:2}
.st-top{display:flex;align-items:center;gap:10px;flex-wrap:wrap;font:600 15px var(--head);color:var(--muted);margin:0 auto 12px;width:100%;max-width:1300px}
.st-top .sp{flex:1}.st-top .sel{width:auto!important;height:32px}
.st-clock{font:700 28px var(--mono);color:var(--ink);min-width:90px;text-align:right}.st-clock.low{color:var(--bad)}
.st-q{font:700 clamp(24px,3.4vw,50px)/1.2 var(--head);text-align:center;margin:6px auto 22px;max-width:1300px;white-space:pre-wrap}
.st-opts{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,420px),1fr));gap:14px;max-width:1300px;width:100%;margin:0 auto}
.st-opt{position:relative;overflow:hidden;display:flex;align-items:center;gap:16px;padding:16px 18px;border-radius:18px;border:2px solid var(--line);background:var(--panel);font:600 clamp(17px,1.9vw,28px)/1.25 var(--head);text-align:left;color:var(--ink);cursor:pointer;min-height:90px;transition:opacity .25s,border-color .25s,box-shadow .25s}
.st-opt>*{position:relative}.st-opt .bar{position:absolute;left:0;top:0;bottom:0;width:0;background:color-mix(in srgb,var(--oc) 24%,transparent);transition:width .45s}
.st-opt .lt{flex:none;width:50px;height:50px;border-radius:14px;display:grid;place-items:center;font:800 24px var(--head);color:#1E1419;background:var(--oc)}
.st-opt .tx{flex:1}.st-opt .tl{display:flex;align-items:center;gap:8px;font:700 19px var(--mono);white-space:nowrap}
.st-opt .mi{display:inline-grid;place-items:center;width:30px;height:30px;border-radius:9px;background:var(--panel2);border:1px solid var(--line);font-size:18px}
.st-opt.right{border-color:var(--ok);box-shadow:0 0 0 4px color-mix(in srgb,var(--ok) 35%,transparent)}
.st-opt.dim{opacity:.42}.st-opt.bad{border-color:var(--bad);box-shadow:0 0 0 4px color-mix(in srgb,var(--bad) 30%,transparent);opacity:1}
.st-opt:disabled{cursor:default}
.st-ex{max-width:1100px;width:100%;margin:18px auto 0;padding:14px 18px;border-radius:14px;background:var(--panel2);border:1px solid var(--line);font-size:clamp(16px,1.6vw,22px);line-height:1.45}
.st-hint{text-align:center;color:var(--muted);font-size:13px;margin-top:14px}
.st-foot{display:flex;gap:10px;justify-content:center;flex-wrap:wrap;margin-top:20px}.st-foot .btn{font-size:16px;padding:10px 18px}
.st-big{font:800 clamp(40px,9vw,140px)/1.05 var(--head);text-align:center;margin:auto}
.st-card{perspective:1600px;width:min(900px,100%);height:min(440px,52vh);margin:6px auto;cursor:pointer}
.st-card .in{position:relative;width:100%;height:100%;transition:transform .6s cubic-bezier(.2,.7,.2,1);transform-style:preserve-3d}
.st-card.flip .in{transform:rotateY(180deg)}
.st-card .face{position:absolute;inset:0;backface-visibility:hidden;-webkit-backface-visibility:hidden;border-radius:24px;display:grid;place-items:center;padding:34px;text-align:center;background:var(--panel);border:2px solid var(--line);box-shadow:var(--shadow);font:700 clamp(24px,3.4vw,50px)/1.25 var(--head);overflow:auto}
.st-card .back{transform:rotateY(180deg);font-weight:500;font-size:clamp(19px,2.4vw,34px);border-color:color-mix(in srgb,var(--cyan) 50%,var(--line))}
.st-card .face small{position:absolute;top:14px;left:18px;font:700 12px var(--head);color:var(--muted);letter-spacing:.1em}
.st-list{max-width:1150px;margin:0 auto;width:100%;display:grid;gap:12px}
.st-row{background:var(--panel);border:1px solid var(--line);border-radius:14px;padding:14px 18px;font-size:clamp(16px,1.6vw,22px);line-height:1.4}
.st-row .ans{color:var(--ok);font-weight:700;margin-top:6px}
.st-meter{height:12px;border-radius:6px;background:var(--panel2);overflow:hidden;display:flex;margin-top:8px}.st-meter i{display:block;height:100%;transition:width .4s}
.st-tag{display:inline-block;padding:2px 10px;border-radius:999px;font:700 12px var(--head);background:var(--panel2);border:1px solid var(--line);margin-left:6px;vertical-align:middle}
.st-tag.bad{background:color-mix(in srgb,var(--bad) 18%,var(--panel));border-color:var(--bad)}.st-tag.ok{background:color-mix(in srgb,var(--ok) 18%,var(--panel));border-color:var(--ok)}
.st-rag{display:flex;gap:8px;flex-wrap:wrap;margin-top:8px}.st-rag button{min-width:120px;font-size:16px}
.st-ed textarea{width:100%;min-height:250px;font:13px/1.5 var(--mono);padding:10px;border-radius:10px;border:1px solid var(--line);background:var(--panel2);color:var(--ink);resize:vertical}
.st-ed .row{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin:8px 0}.st-ed input.inp{flex:1;min-width:160px}
.st-ed .fmt{font-size:12px;color:var(--muted);margin:6px 0}
.st-pick{display:grid;gap:8px;margin:10px 0}.st-pick button{justify-content:space-between;font-size:15px;padding:12px 14px}
.st-panel .chips{display:flex;gap:4px;flex-wrap:wrap;margin:6px 0}.st-panel .chips .btn{padding:4px 9px}
.st-panel .chips .btn.on{background:var(--accent);border-color:var(--accent);color:var(--accent-ink)}
.st-stem{display:flex;gap:6px;align-items:center;padding:7px 8px;border-radius:10px;border:1px solid var(--line);background:var(--panel2);margin:5px 0;font-size:14px;line-height:1.3}
.st-stem span{flex:1}.st-stem .ib{min-width:30px;height:30px}
.st-team{display:flex;align-items:center;gap:6px;margin:6px 0}.st-team i{width:14px;height:14px;border-radius:50%;flex:none}
.st-team input{flex:1;min-width:0;height:32px;border-radius:8px;border:1px solid var(--line);background:var(--panel2);color:var(--ink);padding:0 8px;font:600 14px var(--head)}
.st-team b{font:800 22px var(--mono);min-width:44px;text-align:right}.st-team .btn{padding:4px 8px}
.st-ring{display:block;margin:4px auto}
.pq-game{display:flex;flex-wrap:wrap;align-items:center;gap:8px;justify-content:center;margin:14px auto 0;padding:10px 14px;border:1px solid var(--line);border-radius:16px;background:var(--panel);max-width:1200px}
.pq-boss{display:flex;align-items:center;gap:14px;max-width:900px;width:100%;margin:0 auto 10px;padding:10px 16px;border-radius:18px;background:linear-gradient(90deg,rgba(182,43,217,.16),var(--panel));border:1px solid var(--line)}
.pq-boss .bs{width:70px;height:70px;flex:none}.pq-boss.big .bs{width:110px;height:110px}
.pq-boss .bn{display:flex;justify-content:space-between;font:700 16px var(--head);margin-bottom:6px}
.pq-boss .hp{height:16px;border-radius:9px;background:#3a1520;overflow:hidden}.pq-boss .hp i{display:block;height:100%;background:linear-gradient(90deg,#ff3b5c,#ff9f5a);transition:width .8s cubic-bezier(.2,.8,.2,1)}
.pq-teams{max-width:900px;width:100%;margin:6px auto 10px;display:grid;gap:8px}.pq-teams.slim{gap:4px;margin-top:14px}
.pq-teams .tr{display:grid;grid-template-columns:210px 1fr 70px;align-items:center;gap:12px;font:700 17px var(--head)}.pq-teams.slim .tr{font-size:14px}
.pq-teams .tn small{color:var(--muted);font-weight:600}.pq-teams .tk{height:22px;border-radius:11px;background:var(--panel2);overflow:hidden}.pq-teams.slim .tk{height:10px}.pq-teams .tk i{display:block;height:100%;border-radius:11px;transition:width .8s cubic-bezier(.2,.8,.2,1)}
.pq-teams b{font:800 18px var(--mono);text-align:right}
.pq-tug{display:flex;align-items:center;gap:14px;max-width:1000px;width:100%;margin:6px auto 12px;font:800 20px var(--head)}.pq-tug .rope{flex:1;position:relative;height:22px;border-radius:11px;background:#3BA7FF;overflow:visible}
.pq-tug .rope i{display:block;height:100%;border-radius:11px 0 0 11px;transition:width .8s}.pq-tug em{position:absolute;top:50%;transform:translate(-50%,-50%);font-size:30px;font-style:normal;transition:left .8s}
.pq-ghost{display:flex;gap:16px;flex-wrap:wrap;align-items:center;justify-content:center;max-width:900px;margin:10px auto 0;padding:10px 16px;border-radius:14px;border:1px dashed var(--line);font:600 16px var(--head)}
.st-podium{display:flex;align-items:flex-end;justify-content:center;gap:clamp(10px,3vw,40px);height:58vh;margin-top:auto}
.st-podium div{width:clamp(70px,12vw,180px);border-radius:16px 16px 0 0;display:flex;flex-direction:column;justify-content:flex-start;align-items:center;padding-top:12px;color:#1E1419;font:800 clamp(18px,2.4vw,34px) var(--head)}
.st-podium span{font:600 clamp(13px,1.4vw,20px) var(--head);margin-top:4px;text-align:center;padding:0 6px}
.st-week{display:flex;align-items:flex-end;gap:10px;height:150px;margin:8px 0}.st-week div{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;height:100%;font-size:12px;color:var(--muted)}
.st-week i{display:block;width:100%;border-radius:8px 8px 3px 3px;background:var(--cyan);min-height:3px;margin-bottom:4px}
.st-boxes{display:flex;gap:6px;margin-top:8px}.st-boxes div{flex:1;text-align:center;font-size:12px;color:var(--muted)}.st-boxes b{display:block;font:800 22px var(--mono);color:var(--ink)}
.st-dump{width:100%;max-width:1100px;margin:0 auto;min-height:44vh;font:20px/1.5 var(--head);padding:16px;border-radius:16px;border:2px solid var(--line);background:var(--panel);color:var(--ink);resize:vertical}
@media (max-width:820px){.pq-lobby{grid-template-columns:1fr!important}}
.st-kpi{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:12px;max-width:1150px;width:100%;margin:0 auto 12px}
.st-kpi div{background:var(--panel);border:1px solid var(--line);border-radius:14px;padding:14px 16px;font-size:13px;color:var(--muted)}.st-kpi b{display:block;font:800 34px var(--head);color:var(--ink)}
`; document.head.appendChild(css);

/* ---------- full-screen stage shared by every presenting tool ---------- */
let stageEl = null, stageKey = null, stageOff = null;
function stage(html, onKey, onClose) { closeStage();
  const el = document.createElement('div'); el.id = 'stStage'; el.innerHTML = '<button class="btn sm st-x" data-sx>Close ✕</button>' + html; document.body.appendChild(el); stageEl = el; stageOff = onClose || null;
  /* window capture runs before the board's own shortcuts, so keys pressed on the stage never draw, switch tools or change pages */
  stageKey = e => { if (modal.isOpen || e.ctrlKey || e.metaKey || e.altKey) return; const tg = e.target.tagName; if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); closeStage(); return; } if (tg === 'INPUT' || tg === 'TEXTAREA' || tg === 'SELECT') { e.stopPropagation(); return; } e.stopPropagation(); if (onKey && onKey(e) !== false) e.preventDefault(); };
  window.addEventListener('keydown', stageKey, true); el.querySelector('[data-sx]').onclick = closeStage;
  if (window.gsap && !REDUCE) gsap.from(el, { opacity: 0, duration: 0.25 }); return el; }
function closeStage() { if (!stageEl) return; stageEl.remove(); stageEl = null; window.removeEventListener('keydown', stageKey, true); const f = stageOff; stageOff = null; if (f) f(); }

function confetti(host) { host = host || stageEl || document.body; const c = document.createElement('canvas'); c.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:46'; c.width = innerWidth; c.height = innerHeight; host.appendChild(c); if (REDUCE) { setTimeout(() => c.remove(), 50); return; }
  const g = c.getContext('2d'), P = Array.from({ length: 170 }, () => ({ x: innerWidth / 2 + (Math.random() - 0.5) * 300, y: innerHeight * 0.35, vx: (Math.random() - 0.5) * 16, vy: -Math.random() * 15 - 4, r: Math.random() * Math.PI, vr: (Math.random() - 0.5) * 0.3, c: OC[Math.floor(Math.random() * OC.length)], s: 6 + Math.random() * 8 })); const t0 = performance.now();
  const step = now => { g.clearRect(0, 0, c.width, c.height); P.forEach(p => { p.vy += 0.4; p.vx *= 0.99; p.x += p.vx; p.y += p.vy; p.r += p.vr; g.save(); g.translate(p.x, p.y); g.rotate(p.r); g.fillStyle = p.c; g.fillRect(-p.s / 2, -p.s / 4, p.s, p.s / 2); g.restore(); }); if (now - t0 < 3200 && c.isConnected) requestAnimationFrame(step); else c.remove(); }; requestAnimationFrame(step); }

/* ---------- putting things on the board ---------- */
function boardText(s, extra) { const vr = E.viewRect(); I.insertObj(Object.assign({ t: 'text', s, font: 'Lexend', size: 30, c: ink(), w: Math.round(Math.min(1100, vr[2] * 0.7)) }, extra || {})); }
/* a grouped card: rounded frame with a title and labelled sections; empty sections become boxes to write in */
function boardCard(title, sections, opts) { opts = opts || {}; const vr = E.viewRect(), W = opts.w || 1000, pad = 36, cols = opts.cols || 1, gap = 20, colW = (W - pad * 2 - gap * (cols - 1)) / cols;
  const x0 = Math.round(vr[0] + vr[2] / 2 - W / 2), y0 = Math.round(vr[1] + Math.max(30, vr[3] * 0.08)), g = uid(), objs = [], dark = E.isDark();
  const T = (s, x, y, w, size, b, c) => { const o = { t: 'text', x, y, w, s, font: 'Lexend', size, b: !!b, c: c || ink(), g }; objs.push(o); return E.textLayout(o).h; };
  let y = y0 + pad; y += T(title, x0 + pad, y, W - pad * 2, 44, true, accent()) + 18;
  let rowTop = y, rowH = 0;
  sections.forEach((sec, i) => { const col = i % cols; if (col === 0 && i) { y = rowTop + rowH + gap; rowTop = y; rowH = 0; } const x = x0 + pad + col * (colW + gap); let yy = rowTop;
    yy += T(sec.h, x, yy, colW, 28, true, dark ? '#22D3EE' : '#0B7F96') + 8;
    if (sec.lines && sec.lines.length) yy += T(sec.lines.join('\n'), x, yy, colW, 26) + 6;
    if (sec.box) { objs.push({ t: 'shape', k: 'rect', x, y: yy, w: colW, h: sec.box, c: dark ? '#5A4460' : '#CBB8C4', sw: 2, dash: true, g }); yy += sec.box + 6; }
    rowH = Math.max(rowH, yy - rowTop); });
  const H = rowTop + rowH + pad - y0;
  objs.unshift({ t: 'shape', k: 'rect', x: x0, y: y0, w: W, h: H, c: accent(), sw: 3, fill: dark ? '#1C1220' : '#FFFFFF', g });
  E.add(objs); I.setTool('select'); I.select(objs); snd('pop'); return objs; }

/* ---------- sets: quizzes and flashcards, written by the teacher or the student ---------- */
const Q_HELP = 'One question per block with a blank line between questions. Options start with A) B) C) … — put * after the right one. Leave out the * to run a class poll. Start a question with “Order:” and write the items in the right order for a put-in-order question. An optional line starting “Why:” is shown after the answer.';
const C_HELP = 'One card per line: <b>term - definition</b> (also works with “term: definition” or a tab between them).';
const Q_PH = '1. Your question here?\nA) first option\nB) the right option *\nC) another option\nD) another option\nWhy: a short explanation shown after the answer.\n\n2. Next question…';
const C_PH = 'term - what it means\nanother term - its definition';
const sets = { get: kind => set.get(kind === 'quiz' ? 'quizSets' : 'cardSets', {}), put: (kind, v) => set.put(kind === 'quiz' ? 'quizSets' : 'cardSets', v) };
function parseQuiz(txt) { const out = [];
  String(txt || '').replace(/\r/g, '').split(/\n\s*\n/).forEach(block => { const q = { q: '', o: [], a: -1, ex: '' };
    /* "Order: …" (or "Put in order: …") — the options are written in the right order and students arrange them */
    block = block.replace(/^\s*(?:\d+\s*[.)]\s*)?(?:put in order|order)\s*[:\-–]\s*/i, m => { q.t = 'order'; return ''; });
    block.split('\n').map(s => s.trim()).filter(Boolean).forEach(l => { let m;
      if (q.q && (m = l.match(/^([A-Fa-f])\s*[).:\]]\s*(.+)$/))) { let s = m[2]; if (/\s*\*\s*$/.test(s)) { s = s.replace(/\s*\*\s*$/, ''); q.a = q.o.length; } q.o.push(s); }
      else if ((m = l.match(/^(why|explanation|because)\s*[:\-–]\s*(.+)$/i))) q.ex = (q.ex ? q.ex + ' ' : '') + m[2];
      else if ((m = l.match(/^(answer|ans)\s*[:\-–]\s*([A-Fa-f])\b/i))) q.a = LET.indexOf(m[2].toUpperCase());
      else if (!q.o.length) q.q += (q.q ? '\n' : '') + l.replace(/^(q(uestion)?\s*\d*\s*[:.)\-]|\d+\s*[.)])\s*/i, '');
      else q.ex = (q.ex ? q.ex + ' ' : '') + l; });
    if (q.t === 'order') { q.a = -1; q.o = q.o.slice(0, 8); }
    if (q.q && q.o.length >= 2) { if (q.a >= q.o.length) q.a = -1; out.push(q); } });
  return out; }
const quizText = qs => qs.map((q, i) => (i + 1) + '. ' + (q.t === 'order' ? 'Order: ' : '') + q.q + '\n' + q.o.map((o, k) => LET[k] + ') ' + o + (k === q.a ? ' *' : '')).join('\n') + (q.ex ? '\nWhy: ' + q.ex : '')).join('\n\n');
function parseCards(txt) { return String(txt || '').replace(/\r/g, '').split('\n').map(l => l.trim()).filter(Boolean).map(l => { const m = l.match(/^(.+?)\s*(?:\t|\s[-–—]\s|:\s|\s=\s)\s*(.+)$/); return m ? [m[1].trim(), m[2].trim()] : null; }).filter(Boolean); }
const cardText = cs => cs.map(c => c[0] + ' - ' + c[1]).join('\n');
const uniqName = (obj, n) => { if (!obj[n]) return n; let i = 2; while (obj[n + ' (' + i + ')']) i++; return n + ' (' + i + ')'; };

function download(name, text, type) { name = String(name).replace(/[\u2010-\u2015]/g, '-').replace(/[\u2018\u2019]/g, "'").replace(/[\u201C\u201D]/g, ''); const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type: type || 'application/json' })); a.download = name; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000); }
function exportSet(kind, name) { const all = sets.get(kind); if (!all[name]) { toast('Choose a set first.'); return; }
  const data = { app: 'HelixBoard', type: 'sets', version: 1, quiz: {}, cards: {} }; data[kind === 'quiz' ? 'quiz' : 'cards'][name] = all[name];
  download(name.replace(/[\\/:*?"<>|]+/g, '_') + '.hbset', JSON.stringify(data, null, 1)); toast('Saved “' + esc(name) + '.hbset” — share the file; others open it with <b>Import set</b>.', 4200); }
function importSets(done) { const inp = document.createElement('input'); inp.type = 'file'; inp.accept = '.hbset,.json,.txt'; inp.multiple = true; inp.onchange = () => importFiles(inp.files, done); inp.click(); }
async function importFiles(files, done) { let nq = 0, nc = 0; for (const f of files) { let txt; try { txt = await f.text(); } catch (e) { continue; } const base = f.name.replace(/\.[^.]+$/, '');
      let d = null; try { d = JSON.parse(txt); } catch (e) {}
      const Q = sets.get('quiz'), C = sets.get('cards');
      if (d && d.type === 'sets') { Object.entries(d.quiz || {}).forEach(([k, v]) => { if (Array.isArray(v) && v.length) { Q[uniqName(Q, k)] = v; nq++; } }); Object.entries(d.cards || {}).forEach(([k, v]) => { if (Array.isArray(v) && v.length) { C[uniqName(C, k)] = v; nc++; } }); }
      else if (!d) { const qs = parseQuiz(txt); if (qs.length) { Q[uniqName(Q, base)] = qs; nq++; } else { const cs = parseCards(txt); if (cs.length) { C[uniqName(C, base)] = cs; nc++; } } }
      sets.put('quiz', Q); sets.put('cards', C); }
    if (!nq && !nc) toast('No quiz or flashcard sets were found in that file.'); else { snd('good'); toast('Imported ' + [nq ? plural(nq, 'quiz set') : '', nc ? plural(nc, 'flashcard set') : ''].filter(Boolean).join(' and ') + '.'); }
  done && done(); }

/* the set editor: one place to write, rename, delete, import and share sets */
function editor(kind, opts) { opts = opts || {}; const Q = kind === 'quiz', all = sets.get(kind); let cur = opts.name && all[opts.name] ? opts.name : (all[set.get(kind + 'Cur', '')] ? set.get(kind + 'Cur', '') : Object.keys(all)[0] || '');
  const go = Q ? [['stGoP', 'presentation', 'Present to class', presentQuiz], ['stGoS', 'graduation-cap', 'Practise myself', practise]] : [['stGoP', 'presentation', 'Present', n => flashcards(n, true)], ['stGoS', 'layers', 'Study (spaced)', n => flashcards(n, false)]];
  modal.open('<div class="st-ed"><h2>' + (Q ? 'Quiz sets' : 'Flashcard sets') + '</h2><div class="row"><select id="seSel" class="sel" style="flex:1;min-width:180px"></select><button class="btn" id="seImp">' + icon('file-input') + 'Import set</button><button class="btn" id="seExp">' + icon('file-output') + 'Share / export</button><button class="btn" id="seDel">' + icon('trash-2') + 'Delete</button></div>' +
    '<div class="row"><input id="seName" class="inp" placeholder="Set name, e.g. ' + (Q ? 'Cells — quick check' : 'Cell biology key words') + '"' + '>' + (Q ? '' : '<button class="btn" id="seRoots">' + icon('book-open-text') + 'From roots dictionary</button>') + '</div>' +
    '<textarea id="seText" spellcheck="true" placeholder="' + esc(Q ? Q_PH : C_PH) + '"></textarea><div class="fmt">' + (Q ? Q_HELP : C_HELP) + ' <b id="seN"></b></div>' +
    '<div class="foot"><button class="btn" id="seSave">' + icon('save') + 'Save</button>' + go.map(g => '<button class="btn primary" id="' + g[0] + '">' + icon(g[1]) + g[2] + '</button>').join('') + '</div></div>', s => {
    const sel = $('#seSel', s), nm = $('#seName', s), ta = $('#seText', s);
    const count = () => { const n = (Q ? parseQuiz(ta.value) : parseCards(ta.value)).length; $('#seN', s).textContent = n ? '✓ ' + plural(n, Q ? 'question' : 'card') + ' found.' : ''; };
    const fill = () => { Object.assign(all, sets.get(kind)); sel.innerHTML = '<option value="">＋ New set…</option>' + Object.keys(all).sort().map(k => '<option value="' + esc(k) + '"' + (k === cur ? ' selected' : '') + '>' + esc(k) + ' (' + all[k].length + ')</option>').join(''); nm.value = cur; ta.value = cur && all[cur] ? (Q ? quizText(all[cur]) : cardText(all[cur])) : ''; count(); };
    const save = quiet => { const name = nm.value.trim(), items = Q ? parseQuiz(ta.value) : parseCards(ta.value);
      if (!name) { toast('Give the set a name first.'); nm.focus(); return null; } if (!items.length) { toast(Q ? 'No questions found — check the format under the box.' : 'No cards found — write “term - definition” on each line.'); return null; }
      if (cur && cur !== name) delete all[cur]; all[name] = items; cur = name; sets.put(kind, all); set.put(kind + 'Cur', name); if (!quiet) toast('Saved “' + esc(name) + '” — ' + plural(items.length, Q ? 'question' : 'card') + '.'); fill(); return name; };
    ta.oninput = count; sel.onchange = () => { cur = sel.value; fill(); if (!cur) nm.focus(); };
    $('#seSave', s).onclick = () => save();
    go.forEach(g => $('#' + g[0], s).onclick = () => { const n = save(true); if (n) { modal.close(); setTimeout(() => g[3](n), 30); } });
    $('#seDel', s).onclick = () => { if (!cur) return; const n = cur; window.HB.ask('Delete the set “' + esc(n) + '”? This cannot be undone.', 'Delete', () => { const a = sets.get(kind); delete a[n]; sets.put(kind, a); if (!Q) { const p = set.get('cardProg', {}); delete p[n]; set.put('cardProg', p); } toast('Deleted “' + esc(n) + '”'); editor(kind); }); };
    $('#seExp', s).onclick = () => { if (cur && !save(true)) return; exportSet(kind, cur); };
    $('#seImp', s).onclick = () => importSets(() => fill());
    const rb = $('#seRoots', s); if (rb) rb.onclick = () => rootsDeck();
    fill(); if (!cur) setTimeout(() => nm.focus(), 50); }); }

/* choose a set before presenting; with no sets yet, open the editor */
function chooseSet(kind, title, go, filter) { const all = sets.get(kind); const names = Object.keys(all).filter(k => !filter || filter(all[k])).sort();
  if (!names.length) { toast(kind === 'quiz' ? 'Write your first quiz set — it only takes a minute.' : 'Write your first flashcard set — one card per line.', 3600); editor(kind); return; }
  if (names.length === 1) { go(names[0]); return; }
  const info = k => kind === 'cards' ? dueCount(k) + ' due · ' + plural(all[k].length, 'card') : plural(all[k].length, 'question');
  modal.open('<h2>' + title + '</h2><div class="st-pick">' + names.map(k => '<button class="btn" data-n="' + esc(k) + '"><b>' + esc(k) + '</b><span class="muted small">' + info(k) + '</span></button>').join('') + '</div><div class="foot"><button class="btn" id="spEd">' + icon('pencil') + 'Edit sets</button></div>', s => {
    $$('[data-n]', s).forEach(b => b.onclick = () => { modal.close(); set.put(kind + 'Cur', b.dataset.n); setTimeout(() => go(b.dataset.n), 30); }); $('#spEd', s).onclick = () => editor(kind); }); }

/* ---------- live class quiz: show the question, count hands per option, reveal, results ---------- */
function presentQuiz(name) { if (!name) return chooseSet('quiz', 'Present a quiz', presentQuiz);
  const qs = sets.get('quiz')[name]; if (!qs || !qs.length) return editor('quiz', { name });
  track('log', 'live_quiz', { questions: qs.length });
  const st = { i: 0, tal: qs.map(q => q.o.map(() => 0)), rev: qs.map(() => false), secs: set.get('quizSecs', 0), left: 0, t: 0, results: false, cards: qs.map(() => null) };
  /* paper answer cards: the camera reads every card; the counts fill in and each student's answer is kept for Reports */
  const scanCards = () => { const q = qs[st.i]; if (q.t === 'order' || !window.HBPC) return; if (q.o.length > 4) { toast('Paper cards have four answers (A–D) — this question has more.'); return; } stopT();
    HBPC.scan({ title: (st.i + 1) + '. ' + q.q, options: q.o, correct: q.a >= 0 ? q.a : null, onDone: m => { if (!m.size) return; st.cards[st.i] = m; const t = q.o.map(() => 0); m.forEach(a => { if (a < t.length) t[a]++; }); st.tal[st.i] = t; snd('pop'); draw(); saveCards(); } }); };
  const saveCards = () => { if (!window.HBRP || !st.cards.some(Boolean)) return; const names = new Map(); st.cards.forEach(m => m && m.forEach((a, id) => names.set(id, HBPC.nameOf(id))));
    const res = { title: name, questions: qs.map(q => ({ q: q.q, o: q.o, a: q.a, t: q.t || null })), players: [...names.entries()].map(([id, nm]) => ({ name: nm, score: 0, ans: qs.map((q, k) => { const m = st.cards[k]; if (!m || !m.has(id)) return null; const c = m.get(id); return { c, ok: q.a >= 0 ? c === q.a : null, ms: 0 }; }) })) };
    res.players.forEach(p => { p.score = p.ans.filter(a => a && a.ok).length * 1000; }); st.repId = st.repId || null;
    HBRP.addQuiz(name + ' · paper cards', res).then(s => { if (s && st.repId && st.repId !== s.id && HBRP.remove) HBRP.remove(st.repId); if (s) st.repId = s.id; }).catch(() => {}); };
  const el = stage('<div class="st-top"><span id="qzN"></span><span class="sp"></span><label>Timer <select id="qzT" class="sel">' + [0, 10, 20, 30, 45, 60, 90, 120].map(s => '<option value="' + s + '"' + (s === st.secs ? ' selected' : '') + '>' + (s ? s + ' s' : 'Off') + '</option>').join('') + '</select></label><span class="st-clock" id="qzC"></span></div><div id="qzBody" style="display:flex;flex-direction:column"></div>', key, () => clearInterval(st.t));
  const body = $('#qzBody', el);
  const stopT = () => { clearInterval(st.t); st.t = 0; $('#qzC', el).textContent = ''; };
  const startT = () => { stopT(); if (!st.secs || st.rev[st.i]) return; st.left = st.secs; const c = $('#qzC', el); const tick = () => { c.textContent = fmt(st.left); c.classList.toggle('low', st.left <= 5); if (st.left <= 0) { stopT(); snd('chime'); reveal(true); return; } if (st.left <= 5) snd('tick'); st.left--; }; tick(); st.t = setInterval(tick, 1000); };
  /* "put in order" without phones: show the items mixed up, the class discusses, Reveal shows the right order */
  const mix = qs.map(q => q.t === 'order' ? shuffle(q.o.map((_, k) => k)) : null);
  const drawOrder = q => { const rv = st.rev[st.i]; $('#qzN', el).textContent = name + ' · Question ' + (st.i + 1) + ' of ' + qs.length;
    body.innerHTML = '<div class="st-q">' + esc(q.q) + '</div><div class="st-list" style="max-width:900px">' + (rv ? q.o.map((_, k) => k) : mix[st.i]).map((k, i) => '<div class="st-row" style="display:flex;gap:12px;align-items:center;font-size:clamp(18px,1.9vw,28px);font-weight:700">' + (rv ? '<b style="width:34px;height:34px;border-radius:10px;background:var(--ok);color:#10230f;display:grid;place-items:center">' + (i + 1) + '</b>' : '') + esc(q.o[k]) + '</div>').join('') + '</div>' + (rv && q.ex ? '<div class="st-ex">' + esc(q.ex) + '</div>' : '') +
      '<div class="st-hint">Students discuss the order · Space reveals · ← → move between questions</div><div class="st-foot"><button class="btn" id="qzP">' + icon('chevron-left') + 'Back</button><button class="btn primary" id="qzR">' + icon(rv ? 'eye-off' : 'eye') + (rv ? 'Hide order' : 'Reveal the order') + '</button><button class="btn" id="qzX">' + (st.i === qs.length - 1 ? 'Results' : 'Next') + icon('chevron-right') + '</button></div>';
    $('#qzP', body).onclick = () => move(-1); $('#qzX', body).onclick = () => move(1); $('#qzR', body).onclick = () => reveal(!st.rev[st.i]); };
  const draw = () => { if (st.results) return results(); if (qs[st.i].t === 'order') return drawOrder(qs[st.i]); const q = qs[st.i], t = st.tal[st.i], tot = t.reduce((a, b) => a + b, 0), rv = st.rev[st.i];
    $('#qzN', el).textContent = name + ' · Question ' + (st.i + 1) + ' of ' + qs.length + (tot ? ' · ' + plural(tot, 'answer') : '');
    body.innerHTML = '<div class="st-q">' + esc(q.q) + '</div><div class="st-opts">' + q.o.map((o, k) => '<button class="st-opt' + (rv && q.a >= 0 ? (k === q.a ? ' right' : ' dim') : '') + '" data-k="' + k + '" style="--oc:' + OC[k] + '"><i class="bar" style="width:' + (rv || tot ? pct(t[k], tot) : 0) + '%"></i><span class="lt">' + LET[k] + '</span><span class="tx">' + esc(o) + '</span><span class="tl">' + (t[k] ? t[k] + ' · ' + pct(t[k], tot) + '%<span class="mi" data-m="' + k + '" title="Take one away">−</span>' : '') + '</span></button>').join('') + '</div>' +
      (rv ? '<div class="st-ex">' + (q.a >= 0 ? '<b>Answer ' + LET[q.a] + ':</b> ' + esc(q.o[q.a]) + (tot ? ' — ' + t[q.a] + ' of ' + tot + ' (' + pct(t[q.a], tot) + '%) chose it.' : '') : '<b>Class poll</b> — no single right answer. ' + (tot ? 'Most chose ' + LET[t.indexOf(Math.max(...t))] + '.' : '')) + (q.ex ? '<br>' + esc(q.ex) : '') + '</div>' : '') +
      '<div class="st-hint">Tap an option (or press 1–6 / A–F) once for every hand raised — or scan the paper cards · Space reveals · ← → move between questions</div><div class="st-foot"><button class="btn" id="qzP">' + icon('chevron-left') + 'Back</button>' + (window.HBPC && q.o.length <= 4 ? '<button class="btn" id="qzScan">' + icon('scan-line') + (st.cards[st.i] ? 'Scan again (' + st.cards[st.i].size + ')' : 'Scan cards') + '</button>' : '') + '<button class="btn primary" id="qzR">' + icon(rv ? 'eye-off' : 'eye') + (rv ? 'Hide answer' : 'Reveal answer') + '</button><button class="btn" id="qzX">' + (st.i === qs.length - 1 ? 'Results' : 'Next') + icon('chevron-right') + '</button></div>';
    $$('.st-opt', body).forEach(b => b.onclick = e => { const m = e.target.closest('[data-m]'); tally(+(m ? m.dataset.m : b.dataset.k), m ? -1 : 1); });
    $('#qzP', body).onclick = () => move(-1); $('#qzX', body).onclick = () => move(1); $('#qzR', body).onclick = () => reveal(!st.rev[st.i]); const sc = $('#qzScan', body); if (sc) sc.onclick = scanCards; };
  const tally = (k, d) => { const t = st.tal[st.i]; if (k < 0 || k >= t.length) return; t[k] = Math.max(0, t[k] + d); if (d > 0) snd('pop'); draw(); };
  const reveal = on => { st.rev[st.i] = on; if (on) { stopT(); const q = qs[st.i], t = st.tal[st.i], tot = t.reduce((a, b) => a + b, 0); if (q.a >= 0) { snd('good'); if (tot && t[q.a] / tot >= 0.8) confetti(); } } draw(); };
  const move = d => { if (st.results) { st.results = false; st.i = qs.length - 1; draw(); return; } const n = st.i + d; if (n >= qs.length) { stopT(); st.results = true; snd('fanfare'); draw(); return; } if (n < 0) return; st.i = n; snd('page'); draw(); startT(); };
  const results = () => { const rows = qs.map((q, i) => { const t = st.tal[i], tot = t.reduce((a, b) => a + b, 0), p = q.a >= 0 && tot ? pct(t[q.a], tot) : null; return { q, tot, p }; }); const scored = rows.filter(r => r.p != null), avg = scored.length ? Math.round(scored.reduce((a, r) => a + r.p, 0) / scored.length) : null;
    $('#qzN', el).textContent = name + ' · Results';
    body.innerHTML = '<div class="st-q">' + (avg == null ? 'Results' : 'Class average: ' + avg + '% correct') + '</div><div class="st-list">' + rows.map((r, i) => '<div class="st-row"><b>' + (i + 1) + '.</b> ' + esc(r.q.q) + (r.p == null ? '<span class="st-tag">' + (r.q.a < 0 ? 'poll' : 'no answers counted') + '</span>' : r.p < 60 ? '<span class="st-tag bad">re-teach · ' + r.p + '%</span>' : '<span class="st-tag ok">' + r.p + '%</span>') + (r.p != null ? '<div class="st-meter"><i style="width:' + r.p + '%;background:' + (r.p < 60 ? 'var(--bad)' : r.p < 80 ? 'var(--gold)' : 'var(--ok)') + '"></i></div>' : '') + '</div>').join('') + '</div>' +
      '<div class="st-foot"><button class="btn" id="qzB">' + icon('chevron-left') + 'Back to questions</button><button class="btn" id="qzA">' + icon('rotate-ccw') + 'Run again</button><button class="btn primary" id="qzI">' + icon('clipboard-list') + 'Put results on the board</button></div>';
    $('#qzB', body).onclick = () => { st.results = false; st.i = 0; draw(); }; $('#qzA', body).onclick = () => { st.tal = qs.map(q => q.o.map(() => 0)); st.rev = qs.map(() => false); st.results = false; st.i = 0; draw(); startT(); };
    $('#qzI', body).onclick = () => { closeStage(); boardText('Quiz: ' + name + (avg == null ? '' : ' — class average ' + avg + '%') + '\n' + rows.map((r, i) => (i + 1) + '. ' + r.q.q.replace(/\n/g, ' ') + ' — ' + (r.p == null ? '—' : r.p + '%' + (r.p < 60 ? '  ⟵ re-teach' : ''))).join('\n'), { size: 26 }); }; };
  function key(e) { const k = e.key.toLowerCase(); if (st.results) { if (k === 'arrowleft') move(-1); return; } if (/^[1-6]$/.test(k)) tally(+k - 1, 1); else if (/^[a-f]$/.test(k)) tally(LET.indexOf(k.toUpperCase()), 1); else if (k === ' ' || k === 'enter') reveal(!st.rev[st.i]); else if (k === 'arrowright' || k === 'pagedown') move(1); else if (k === 'arrowleft' || k === 'pageup') move(-1); else return false; }
  $('#qzT', el).onchange = e => { st.secs = +e.target.value; set.put('quizSecs', st.secs); startT(); };
  draw(); startT(); }

const TEAM_C = ['#FF5F7E', '#3BA7FF', '#4ADE80', '#FFC928'];
const ghostLabel = (r, avg) => (r.cls || 'Ghost') + ' · ' + new Date(r.at).toLocaleDateString([], { day: 'numeric', month: 'short' }) + (avg ? ' · ' + r.avg + '%' : '');
/* the class boss: a virus that shrinks, dims and frowns less as it loses health */
function bossSvg(f) { f = Math.max(0, Math.min(1, f)); const r = 26 + 20 * f, c = f > 0.5 ? '#B62BD9' : f > 0.2 ? '#E0435A' : '#7A6F80', sp = [];
  for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2, x1 = 60 + Math.cos(a) * r, y1 = 60 + Math.sin(a) * r, x2 = 60 + Math.cos(a) * (r + 12), y2 = 60 + Math.sin(a) * (r + 12); sp.push('<line x1="' + x1.toFixed(1) + '" y1="' + y1.toFixed(1) + '" x2="' + x2.toFixed(1) + '" y2="' + y2.toFixed(1) + '" stroke="' + c + '" stroke-width="4" stroke-linecap="round"/><circle cx="' + x2.toFixed(1) + '" cy="' + y2.toFixed(1) + '" r="4.5" fill="' + c + '"/>'); }
  const eye = (x) => f <= 0 ? '<path d="M' + (x - 5) + ' 52l10 8M' + (x + 5) + ' 52l-10 8" stroke="#fff" stroke-width="3"/>' : '<circle cx="' + x + '" cy="56" r="6" fill="#fff"/><circle cx="' + x + '" cy="57" r="3" fill="#1E1419"/>';
  return '<svg viewBox="0 0 120 120" width="100%" height="100%">' + sp.join('') + '<circle cx="60" cy="60" r="' + r.toFixed(1) + '" fill="' + c + '"/><circle cx="48" cy="72" r="5" fill="rgba(255,255,255,.18)"/><circle cx="75" cy="44" r="7" fill="rgba(255,255,255,.12)"/>' + eye(50) + eye(70) +
    '<path d="M48 ' + (74 + 4 * f) + ' Q60 ' + (66 + 14 * (1 - f)) + ' 72 ' + (74 + 4 * f) + '" stroke="#fff" stroke-width="3" fill="none" stroke-linecap="round"/></svg>'; }

/* ---------- practice quiz for students: answer, instant feedback, score, mistakes saved for later ---------- */
const MIST = '⟲ My mistakes';
function practise(name, list) { if (!name) return chooseSet('quiz', 'Practice quiz', practise, qs => qs.some(q => q.a >= 0));
  const src = list || (sets.get('quiz')[name] || []); const pool = shuffle(src.filter(q => q.a >= 0)).map(q => { const order = shuffle(q.o.map((_, k) => k)); return { q: q.q, o: order.map(k => q.o[k]), a: order.indexOf(q.a), ex: q.ex, orig: q }; });
  if (!pool.length) { toast('That set has no questions with a marked answer (*) to practise.'); return; }
  const st = { i: 0, score: 0, picked: -1, wrong: [] };
  const el = stage('<div class="st-top"><span id="prN"></span><span class="sp"></span><span id="prS" style="font:700 18px var(--mono);color:var(--ink)"></span></div><div id="prBody" style="display:flex;flex-direction:column"></div>', key);
  const body = $('#prBody', el);
  const draw = () => { if (st.i >= pool.length) return done(); const q = pool[st.i], an = st.picked >= 0;
    $('#prN', el).textContent = (list ? MIST : name) + ' · ' + (st.i + 1) + ' / ' + pool.length; $('#prS', el).textContent = '✓ ' + st.score;
    body.innerHTML = '<div class="st-meter" style="max-width:1300px;width:100%;margin:0 auto 14px"><i style="width:' + pct(st.i, pool.length) + '%;background:var(--accent)"></i></div><div class="st-q">' + esc(q.q) + '</div><div class="st-opts">' + q.o.map((o, k) => '<button class="st-opt' + (an ? (k === q.a ? ' right' : k === st.picked ? ' bad' : ' dim') : '') + '" data-k="' + k + '" style="--oc:' + OC[k] + '"' + (an ? ' disabled' : '') + '><span class="lt">' + LET[k] + '</span><span class="tx">' + esc(o) + '</span>' + (an && k === q.a ? '<span class="tl">✓</span>' : an && k === st.picked ? '<span class="tl">✗</span>' : '') + '</button>').join('') + '</div>' +
      (an ? '<div class="st-ex">' + (st.picked === q.a ? '<b style="color:var(--ok)">Correct!</b> ' : '<b style="color:var(--bad)">Not quite.</b> The answer is <b>' + LET[q.a] + ') ' + esc(q.o[q.a]) + '</b>. ') + (q.ex ? esc(q.ex) : '') + '</div><div class="st-foot"><button class="btn primary" id="prX">' + (st.i === pool.length - 1 ? 'See my score' : 'Next question') + icon('chevron-right') + '</button></div>' : '<div class="st-hint">Choose an answer — tap it or press 1–' + q.o.length + '</div>');
    $$('.st-opt', body).forEach(b => b.onclick = () => pick(+b.dataset.k)); const x = $('#prX', body); if (x) { x.onclick = next; x.focus(); } };
  const pick = k => { const q = pool[st.i]; if (st.picked >= 0 || k < 0 || k >= q.o.length) return; st.picked = k; if (k === q.a) { st.score++; snd('good'); } else { st.wrong.push(q.orig); snd('bad'); } draw(); };
  const next = () => { if (st.picked < 0) return; st.i++; st.picked = -1; draw(); };
  const done = () => { const p = pct(st.score, pool.length); logQuiz(list ? MIST : name, st.score, pool.length);
    const M = set.get('mistakes', []); const key = q => q.q + '|' + q.o.join('|'); const right = new Set(pool.filter((q, i) => !st.wrong.includes(q.orig)).map(q => key(q.orig)));
    const keep = M.filter(q => !right.has(key(q))); st.wrong.forEach(q => { if (!keep.some(m => key(m) === key(q))) keep.push(q); }); set.put('mistakes', keep.slice(-200));
    if (p >= 80) { snd('fanfare'); confetti(); } else snd('chime');
    $('#prN', el).textContent = (list ? MIST : name) + ' · Finished'; body.innerHTML = '<div class="st-big" style="margin:10px auto 4px">' + p + '%</div><div class="st-q" style="font-size:clamp(20px,2.4vw,32px)">' + st.score + ' of ' + pool.length + ' correct — ' + (p >= 90 ? 'outstanding!' : p >= 75 ? 'great work!' : p >= 50 ? 'good effort — review the ones you missed.' : 'keep going — practise the mistakes below, then try again.') + '</div>' +
      (st.wrong.length ? '<div class="st-list">' + st.wrong.map(q => '<div class="st-row">' + esc(q.q) + '<div class="ans">✓ ' + esc(q.o[q.a]) + '</div>' + (q.ex ? '<div class="small muted">' + esc(q.ex) + '</div>' : '') + '</div>').join('') + '</div>' : '') +
      '<div class="st-foot">' + (st.wrong.length ? '<button class="btn primary" id="prM">' + icon('rotate-ccw') + 'Practise these ' + st.wrong.length + ' again</button>' : '') + '<button class="btn" id="prA">' + icon('shuffle') + 'Whole set again</button><button class="btn" id="prD">Done</button></div>';
    const m = $('#prM', body); if (m) m.onclick = () => practise(name, st.wrong.slice()); $('#prA', body).onclick = () => practise(name, list); $('#prD', body).onclick = closeStage; };
  function key(e) { const k = e.key; if (/^[1-6]$/.test(k)) pick(+k - 1); else if (/^[a-fA-F]$/.test(k)) pick(LET.indexOf(k.toUpperCase())); else if ((k === 'Enter' || k === ' ' || k === 'ArrowRight') && st.picked >= 0) next(); else return false; }
  draw(); }
function mistakes() { const M = set.get('mistakes', []); if (!M.length) { toast('No saved mistakes — questions you get wrong in a practice quiz appear here so you can retry them.', 4200); return; } practise(MIST, M.slice()); }

/* ---------- flashcards with spaced repetition (Leitner boxes) ---------- */
const GAPS = [0, 1, 2, 4, 8, 16];
const prog = () => set.get('cardProg', {});
const dueCount = name => { const cs = sets.get('cards')[name] || [], p = prog()[name] || {}, t = dayKey(); return cs.filter(c => !p[c[0]] || p[c[0]].d <= t).length; };
/* "Due today" (2.8): every due card from every deck in one mixed session — mixing topics (interleaving) makes recall harder and longer-lasting */
const DUE = '★ Due today';
const dueAll = () => { const all = sets.get('cards'), p = prog(), t = dayKey(), out = []; Object.keys(all).forEach(n => (all[n] || []).forEach(c => { const q = (p[n] || {})[c[0]]; if (!q || q.d <= t) out.push([c[0], c[1], n]); })); return out; };
const dueTotal = () => dueAll().length;
function dueToday() { if (!Object.keys(sets.get('cards')).length) { toast('No flashcard decks yet — make one in Study → My flashcards, or from your notes with Notes → Make flashcards.', 5200); return; } flashcards(DUE, false); }
function flashcards(name, present) { if (!name) return chooseSet('cards', present ? 'Present flashcards' : 'Study flashcards', n => flashcards(n, present));
  const multi = name === DUE, cards = multi ? (present ? [].concat(...Object.entries(sets.get('cards')).map(([n, cs]) => cs.map(c => [c[0], c[1], n]))) : dueAll()) : sets.get('cards')[name]; if (!multi && (!cards || !cards.length)) return editor('cards', { name });
  const P = prog(); P[name] = P[name] || {}; const t = dayKey(); const dk = c => multi ? c[2] : name; if (multi) cards.forEach(c => { P[c[2]] = P[c[2]] || {}; });
  let queue = present ? shuffle(cards) : shuffle(cards.filter(c => !P[dk(c)][c[0]] || P[dk(c)][c[0]].d <= t));
  if (multi && !queue.length) { modal.open('<h2>All caught up!</h2><p>No flashcards are due today in any deck. Come back tomorrow — spacing the practice out is what makes it stick.</p><div class="foot"><button class="btn primary" data-close>OK</button></div>'); return; }
  if (!queue.length) { modal.open('<h2>All caught up!</h2><p>No cards in <b>' + esc(name) + '</b> are due today. Spaced practice works best when you come back tomorrow — but you can still review them all now.</p><div class="foot"><button class="btn" data-close>Later</button><button class="btn primary" id="fcAll">Review all ' + cards.length + ' cards</button></div>', s => { $('#fcAll', s).onclick = () => { modal.close(); flashcards(name, true); }; }); return; }
  const st = { flip: false, swap: set.get('cardSwap', false), seen: 0, known: 0, total: queue.length };
  const el = stage('<div class="st-top"><span id="fcN"></span><span class="sp"></span><label class="small"><input type="checkbox" id="fcSw"' + (st.swap ? ' checked' : '') + '> show definition first</label><button class="btn sm" id="fcSh">' + icon('shuffle') + 'Shuffle</button></div><div id="fcBody" style="display:flex;flex-direction:column"></div>', key, () => { if (!present) logActive(); });
  const body = $('#fcBody', el);
  const draw = () => { if (!queue.length) return done(); const c = queue[0], f = st.swap ? [c[1], c[0]] : c;
    $('#fcN', el).textContent = name + ' · ' + plural(queue.length, 'card') + ' left' + (present ? '' : ' · ' + st.known + ' learned this session');
    body.innerHTML = '<div class="st-card' + (st.flip ? ' flip' : '') + '" id="fcC"><div class="in"><div class="face"><small>' + (st.swap ? 'DEFINITION' : 'TERM') + (multi ? ' · ' + esc(c[2]) : '') + '</small>' + esc(f[0]) + '</div><div class="face back"><small>' + (st.swap ? 'TERM' : 'DEFINITION') + '</small>' + esc(f[1]) + '</div></div></div>' +
      '<div class="st-foot">' + (!st.flip ? '<button class="btn primary" id="fcF">' + icon('repeat') + 'Flip card (Space)</button>' : present ? '<button class="btn" id="fcF">' + icon('repeat') + 'Flip back</button><button class="btn primary" id="fc3">Next card' + icon('chevron-right') + '</button>' : '<button class="btn" id="fc1" style="border-color:var(--bad)">1 · Again</button><button class="btn" id="fc2" style="border-color:var(--gold)">2 · Hard</button><button class="btn primary" id="fc3">3 · Got it</button>') + '</div><div class="st-hint">' + (st.flip ? (present ? 'Space flips · → next card' : 'Be honest — “Again” brings the card back in a moment; “Got it” spaces it out to days later.') : 'Say the answer out loud or in your head first, then flip.') + '</div>';
    $('#fcC', body).onclick = flip; const b = id => $('#' + id, body); if (b('fcF')) b('fcF').onclick = flip; if (b('fc1')) b('fc1').onclick = () => rate(1); if (b('fc2')) b('fc2').onclick = () => rate(2); if (b('fc3')) b('fc3').onclick = () => rate(3); };
  const flip = () => { if (!queue.length) return; st.flip = !st.flip; snd('whoosh'); const c = $('#fcC', body); if (c) c.classList.toggle('flip', st.flip); setTimeout(draw, REDUCE ? 0 : 280); };
  const rate = r => { if (!st.flip || !queue.length) return; const c = queue.shift(); st.flip = false; st.seen++;
    if (present) { st.known++; draw(); return; }
    const p = P[dk(c)][c[0]] || { b: 0 }; if (r === 1) { p.b = 1; p.d = t; queue.splice(Math.min(3, queue.length), 0, c); snd('bad'); } else if (r === 2) { p.b = Math.max(1, p.b); p.d = addDays(1); snd('pop'); } else { p.b = Math.min(5, (p.b || 0) + 1); p.d = addDays(GAPS[p.b]); st.known++; snd('good'); }
    P[dk(c)][c[0]] = p; if (multi) delete P[DUE]; set.put('cardProg', P); draw(); };
  const done = () => { snd('fanfare'); confetti(); const bx = multi ? [] : boxes(name); if (!present) track('result', 'flashcards', name, st.known, st.seen);
    body.innerHTML = '<div class="st-big" style="margin:20px auto 6px">' + icon('party-popper') + '</div><div class="st-q">' + (present ? 'That’s every card!' : 'Session complete — ' + plural(st.known, 'card') + ' learned.') + '</div>' + (present || multi ? '' : '<div class="st-row" style="max-width:700px;margin:0 auto;width:100%">How well you know <b>' + esc(name) + '</b><div class="st-boxes">' + bx.map((n, i) => '<div><b>' + n + '</b>' + ['new', 'box 1', 'box 2', 'box 3', 'box 4', 'mastered'][i] + '</div>').join('') + '</div><div class="small muted" style="margin-top:8px">Cards move up a box each time you know them and come back after 1, 2, 4, 8 then 16 days.</div></div>') +
      '<div class="st-foot"><button class="btn" id="fcAg">' + icon('rotate-ccw') + 'Go through all cards again</button><button class="btn primary" id="fcD">Done</button></div>'; $('#fcN', el).textContent = name; $('#fcAg', body).onclick = () => flashcards(name, true); $('#fcD', body).onclick = closeStage; };
  function key(e) { const k = e.key; if (k === ' ' || k === 'Enter') flip(); else if (st.flip && (k === '1' || k === '2' || k === '3')) rate(+k); else if (st.flip && present && k === 'ArrowRight') rate(3); else return false; }
  $('#fcSw', el).onchange = e => { st.swap = e.target.checked; set.put('cardSwap', st.swap); st.flip = false; draw(); };
  $('#fcSh', el).onclick = () => { queue = shuffle(queue); st.flip = false; draw(); };
  draw(); }
const boxes = name => { const cs = sets.get('cards')[name] || [], p = prog()[name] || {}, out = [0, 0, 0, 0, 0, 0]; cs.forEach(c => out[p[c[0]] ? Math.min(5, p[c[0]].b) : 0]++); return out; };
function rootsDeck() { const R = window.HBRD && HBRD.ROOTS; if (!R) { toast('The roots dictionary is still loading — try again in a moment.'); return; }
  modal.open('<h2>Flashcards from the roots dictionary</h2><p>Make a deck of word roots, prefixes and suffixes — knowing them unlocks thousands of science words.</p><div class="st-pick">' + [['bio', 'Biology'], ['chem', 'Chemistry'], ['phys', 'Physics'], ['med', 'Medical'], ['', 'Everything']].map(f => '<button class="btn" data-f="' + f[0] + '"><b>' + f[1] + ' roots</b><span class="muted small">' + R.filter(r => !f[0] || (r.f || []).includes(f[0])).length + ' cards</span></button>').join('') + '</div>', s => {
    $$('[data-f]', s).forEach(b => b.onclick = () => { const f = b.dataset.f, cs = R.filter(r => !f || (r.f || []).includes(f)).map(r => [r.p, r.m + ' — e.g. ' + (r.e || []).slice(0, 3).join(', ')]); const all = sets.get('cards'), n = 'Roots — ' + b.querySelector('b').textContent.replace(' roots', ''); all[n] = cs; sets.put('cards', all); set.put('cardsCur', n); modal.close(); toast('Made the deck “' + n + '” — ' + plural(cs.length, 'card') + '.'); setTimeout(() => flashcards(n, false), 40); }); }); }

/* ---------- retrieval starter: a few mixed questions from earlier sets, answers revealed together ---------- */
function retrieval() { const Q = sets.get('quiz'), C = sets.get('cards'); const pool = [];
  Object.entries(Q).forEach(([n, qs]) => qs.forEach(q => { if (q.a >= 0) pool.push({ s: n, q: q.q, a: q.o[q.a] }); }));
  Object.entries(C).forEach(([n, cs]) => cs.forEach(c => pool.push(Math.random() < 0.5 ? { s: n, q: 'What is meant by “' + c[0] + '”?', a: c[1] } : { s: n, q: 'Which word means: ' + c[1] + '?', a: c[0] })));
  if (pool.length < 3) { toast('Retrieval starter mixes questions from your quiz and flashcard sets — make a set first.', 4000); editor('quiz'); return; }
  const srcs = [...new Set(pool.map(p => p.s))]; const st = { n: set.get('retrN', 5), src: '', rev: false, list: [] };
  const pickL = () => { const p = pool.filter(x => !st.src || x.s === st.src); st.list = shuffle(p).slice(0, st.n); st.rev = false; };
  const el = stage('<div class="st-top"><span>Retrieval starter</span><span class="sp"></span><select id="rtS" class="sel"><option value="">All sets</option>' + srcs.map(s => '<option>' + esc(s) + '</option>').join('') + '</select><select id="rtN" class="sel">' + [3, 5, 6, 8, 10].map(n => '<option' + (n === st.n ? ' selected' : '') + '>' + n + '</option>').join('') + '</select></div><div id="rtBody"></div>', e => { if (e.key === ' ' || e.key === 'Enter') { st.rev = !st.rev; draw(); } else if (e.key.toLowerCase() === 'n') { pickL(); draw(); } else return false; });
  const draw = () => { $('#rtBody', el).innerHTML = '<div class="st-q" style="font-size:clamp(22px,2.6vw,38px)">Write your answers — no notes!</div><div class="st-list">' + st.list.map((x, i) => '<div class="st-row"><b>' + (i + 1) + '.</b> ' + esc(x.q) + (st.rev ? '<div class="ans">✓ ' + esc(x.a) + '</div>' : '') + '</div>').join('') + '</div><div class="st-foot"><button class="btn" id="rtNew">' + icon('shuffle') + 'New questions (N)</button><button class="btn primary" id="rtRev">' + icon(st.rev ? 'eye-off' : 'eye') + (st.rev ? 'Hide answers' : 'Reveal answers') + ' (Space)</button><button class="btn" id="rtT">' + icon('timer') + 'Timer</button></div>';
    $('#rtNew', el).onclick = () => { pickL(); draw(); }; $('#rtRev', el).onclick = () => { st.rev = !st.rev; if (st.rev) snd('chime'); draw(); }; $('#rtT', el).onclick = () => window.HBC && HBC.timer(); };
  $('#rtS', el).onchange = e => { st.src = e.target.value; pickL(); draw(); }; $('#rtN', el).onchange = e => { st.n = +e.target.value; set.put('retrN', st.n); pickL(); draw(); };
  pickL(); draw(); }

/* ---------- show-me boards: everyone writes, then a 3-2-1 reveal ---------- */
function showMe() { const el = stage('<div class="st-top"><span>Show-me boards</span></div><input id="smQ" class="inp" placeholder="Type the question (optional)…" style="max-width:1100px;width:100%;margin:0 auto;font:600 22px var(--head);height:54px"><div class="st-big" id="smB" style="font-size:clamp(34px,6vw,96px)">Write your answer</div><div class="st-foot"><button class="btn primary" id="smGo">' + icon('hand') + '3 · 2 · 1 — Show me! (Space)</button><button class="btn" id="smR">' + icon('rotate-ccw') + 'Boards down</button></div>', e => { if (e.key === ' ' || e.key === 'Enter') go(); else return false; });
  let tm = 0; const B = $('#smB', el); const go = () => { clearTimeout(tm); let n = 3; const step = () => { if (!stageEl) return; if (n > 0) { B.textContent = n; snd('tick'); if (window.gsap && !REDUCE) gsap.fromTo(B, { scale: 1.5, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.35 }); n--; tm = setTimeout(step, 850); } else { B.textContent = 'Show me!'; snd('chime'); if (window.gsap && !REDUCE) gsap.fromTo(B, { scale: 0.6 }, { scale: 1, duration: 0.5, ease: 'back.out(2)' }); } }; step(); };
  $('#smGo', el).onclick = go; $('#smR', el).onclick = () => { clearTimeout(tm); B.textContent = 'Write your answer'; }; $('#smQ', el).onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); e.target.blur(); } }; }

/* ---------- confidence check: red / amber / green hands against each success criterion ---------- */
function confidence() { const L = lesson(); const rows = (L.criteria.length ? L.criteria : ['Today’s learning']).map(t => ({ t, v: [0, 0, 0] }));
  const C = ['var(--bad)', 'var(--gold)', 'var(--ok)'], N = ['Not yet', 'Getting there', 'Got it'];
  const el = stage('<div class="st-top"><span>Confidence check</span><span class="sp"></span><span class="small">Count hands for each colour — tap again for each hand</span></div><div class="st-q" style="font-size:clamp(22px,2.6vw,40px)">How confident do you feel?</div><div class="st-list" id="cfL"></div><div class="st-foot"><button class="btn" id="cfAdd">' + icon('plus') + 'Add a statement</button><button class="btn primary" id="cfI">' + icon('clipboard-list') + 'Put summary on the board</button></div>');
  const draw = () => { $('#cfL', el).innerHTML = rows.map((r, i) => { const tot = r.v[0] + r.v[1] + r.v[2]; return '<div class="st-row"><b>' + esc(r.t) + '</b>' + (tot ? '<span class="st-tag">' + plural(tot, 'answer') + '</span>' : '') + '<div class="st-rag">' + r.v.map((n, k) => '<button class="btn" data-r="' + i + '" data-k="' + k + '" style="border-color:' + C[k] + '">' + N[k] + ' · <b>' + n + '</b></button>').join('') + '</div>' + (tot ? '<div class="st-meter">' + r.v.map((n, k) => '<i style="width:' + pct(n, tot) + '%;background:' + C[k] + '"></i>').join('') + '</div>' : '') + '</div>'; }).join('');
    $$('[data-r]', el).forEach(b => { b.onclick = () => { rows[+b.dataset.r].v[+b.dataset.k]++; snd('pop'); draw(); }; b.oncontextmenu = e => { e.preventDefault(); const r = rows[+b.dataset.r]; r.v[+b.dataset.k] = Math.max(0, r.v[+b.dataset.k] - 1); draw(); }; }); };
  $('#cfAdd', el).onclick = () => askText('Add a statement', 'e.g. I can explain how enzymes work', 'I can ', t => { if (t.trim()) { rows.push({ t: t.trim(), v: [0, 0, 0] }); draw(); } });
  $('#cfI', el).onclick = () => { closeStage(); boardText('Confidence check\n' + rows.map(r => { const tot = r.v[0] + r.v[1] + r.v[2]; return '• ' + r.t + (tot ? ' — 🟢 ' + pct(r.v[2], tot) + '%  🟠 ' + pct(r.v[1], tot) + '%  🔴 ' + pct(r.v[0], tot) + '%' : ''); }).join('\n'), { size: 26 }); };
  draw(); }

/* ---------- lesson plan, objectives card and the lesson flow timer ---------- */
const DEF_PHASES = [['Do now', 5], ['Starter', 5], ['Teach', 15], ['Practice', 15], ['Check', 5], ['Plenary', 5]];
const lesson = () => Object.assign({ title: '', objectives: [], criteria: [], words: [], phases: DEF_PHASES }, set.get('lessonPlan', {}));
function plan() { const L = lesson(); const lines = a => a.join('\n');
  modal.open('<div class="st-ed"><h2>Lesson plan</h2><div class="row"><input id="lpT" class="inp" placeholder="Lesson title, e.g. Enzymes and temperature" value="' + esc(L.title) + '"></div>' +
    '<div class="row" style="align-items:flex-start"><label style="flex:1;min-width:240px"><b>Learning objectives</b> <span class="small muted">one per line</span><textarea id="lpO" style="min-height:110px" placeholder="To describe…\nTo explain…">' + esc(lines(L.objectives)) + '</textarea></label><label style="flex:1;min-width:240px"><b>Success criteria</b> <span class="small muted">one per line</span><textarea id="lpC" style="min-height:110px" placeholder="I can…\nI can…">' + esc(lines(L.criteria)) + '</textarea></label></div>' +
    '<div class="row" style="align-items:flex-start"><label style="flex:1;min-width:240px"><b>Key words</b> <span class="small muted">separated by commas</span><textarea id="lpW" style="min-height:70px">' + esc(L.words.join(', ')) + '</textarea></label><label style="flex:1;min-width:240px"><b>Lesson flow</b> <span class="small muted">phase | minutes</span><textarea id="lpP" style="min-height:70px">' + esc(L.phases.map(p => p[0] + ' | ' + p[1]).join('\n')) + '</textarea></label></div>' +
    '<div class="fmt" id="lpSum"></div><div class="foot"><button class="btn" id="lpS">' + icon('save') + 'Save</button><button class="btn" id="lpB">' + icon('target') + 'Objectives on the board</button><button class="btn primary" id="lpF">' + icon('play') + 'Start lesson flow</button></div></div>', s => {
    const read = () => { const sp = v => v.split('\n').map(x => x.trim()).filter(Boolean); const ph = sp($('#lpP', s).value).map(l => { const m = l.match(/^(.*?)\s*[|,–-]\s*(\d+(?:\.\d+)?)\s*(m|min|mins|minutes)?$/i); return m ? [m[1].trim() || 'Phase', +m[2]] : [l, 5]; }).filter(p => p[1] > 0);
      return { title: $('#lpT', s).value.trim(), objectives: sp($('#lpO', s).value), criteria: sp($('#lpC', s).value), words: $('#lpW', s).value.split(/[,\n،]+/).map(x => x.trim()).filter(Boolean), phases: ph.length ? ph : DEF_PHASES }; };
    const sum = () => { const p = read().phases; $('#lpSum', s).textContent = plural(p.length, 'phase') + ' · ' + p.reduce((a, x) => a + x[1], 0) + ' minutes in total'; };
    $('#lpP', s).oninput = sum; sum();
    const save = () => { const v = read(); set.put('lessonPlan', v); return v; };
    $('#lpS', s).onclick = () => { save(); toast('Lesson plan saved.'); }; $('#lpB', s).onclick = () => { save(); modal.close(); objectivesCard(); }; $('#lpF', s).onclick = () => { save(); modal.close(); flow(true); }; }); }
function objectivesCard() { const L = lesson(); if (!L.objectives.length && !L.criteria.length) { toast('Write the objectives in the lesson plan first.'); plan(); return; }
  const secs = []; if (L.objectives.length) secs.push({ h: 'Learning objectives', lines: L.objectives.map(o => '•  ' + o) }); if (L.criteria.length) secs.push({ h: 'Success criteria', lines: L.criteria.map(c => '☐  ' + c) }); if (L.words.length) secs.push({ h: 'Key words', lines: [L.words.join('  ·  ')] });
  boardCard(L.title || 'Today’s lesson', secs); }
let FL = null;
function flow(restart) { const L = lesson(); if (restart) track('log', 'lesson_flow', { phases: L.phases.length }); if (!FL || restart) { if (FL) clearInterval(FL.t); FL = { ph: L.phases, i: 0, used: 0, run: !!restart, t: 0, start: restart ? Date.now() : 0, last: Date.now() }; }
  const f = floatPanel('flow', 'Lesson flow' + (L.title ? ' · ' + esc(L.title) : ''), '<div class="st-panel"><div id="lfName" style="font:800 22px var(--head);text-align:center"></div><div class="big" id="lfT" style="font-size:46px"></div><div class="st-meter"><i id="lfBar" style="background:var(--accent)"></i></div><div class="chips" id="lfChips" style="justify-content:center;margin-top:8px"></div><div class="row" style="justify-content:center;gap:6px;margin-top:6px"><button class="btn sm" id="lfP">‹</button><button class="btn primary" id="lfGo"></button><button class="btn sm" id="lfX">Next ›</button><button class="btn sm" id="lfM">+1 min</button></div><div class="row" style="justify-content:center;gap:14px;margin-top:8px"><label class="small"><input type="checkbox" id="lfAuto"> Next phase by itself</label><label class="small"><input type="checkbox" id="lfStrip"> Runway on the board</label></div><div class="small muted" id="lfAll" style="text-align:center;margin-top:6px"></div></div>', { icon: 'milestone', w: 340, onClose: () => { if (FL) clearInterval(FL.t); FL = null; HB.bus.emit('flow', null); } });
  const body = f.body;
  const tick = () => { const now = Date.now(); if (FL.run) FL.used += (now - FL.last) / 1000; FL.last = now; const p = FL.ph[FL.i], left = p[1] * 60 - FL.used;
    if (FL.run && left <= 0 && !FL.rang && set.get('flowAuto', false) && FL.i < FL.ph.length - 1) { snd('chime'); toast('⏰ Next: <b>' + esc(FL.ph[FL.i + 1][0]) + '</b>', 4000); go(FL.i + 1); return; }
    if (FL.run && left <= 0 && !FL.rang) { FL.rang = true; snd('chime'); toast(FL.i < FL.ph.length - 1 ? '⏰ ' + esc(p[0]) + ' is over — next: <b>' + esc(FL.ph[FL.i + 1][0]) + '</b>' : '⏰ Lesson time is up.', 5000); }
    HB.bus.emit('flow', FL); const lt = $('#lfT', body); if (!lt) return; lt.textContent = fmt(left); lt.style.color = left < 0 ? 'var(--bad)' : left < 60 ? 'var(--gold)' : ''; $('#lfName', body).textContent = (FL.i + 1) + '. ' + p[0]; $('#lfBar', body).style.width = clamp(FL.used / (p[1] * 60) * 100, 0, 100) + '%';
    const total = FL.ph.reduce((a, x) => a + x[1], 0); $('#lfAll', body).textContent = 'Lesson ' + total + ' min' + (FL.start ? ' · started ' + Math.floor((now - FL.start) / 60000) + ' min ago' : ''); $('#lfGo', body).textContent = FL.run ? 'Pause' : (FL.used ? 'Resume' : 'Start'); };
  const chips = () => { $('#lfChips', body).innerHTML = FL.ph.map((p, i) => '<button class="btn sm' + (i === FL.i ? ' on' : '') + '" data-i="' + i + '" title="' + p[1] + ' min">' + esc(p[0]) + '</button>').join(''); $$('[data-i]', body).forEach(b => b.onclick = () => go(+b.dataset.i)); };
  const go = i => { FL.i = clamp(i, 0, FL.ph.length - 1); FL.used = 0; FL.rang = false; snd('page'); chips(); tick(); };
  $('#lfGo', body).onclick = () => { FL.run = !FL.run; FL.last = Date.now(); if (FL.run && !FL.start) FL.start = Date.now(); tick(); }; $('#lfX', body).onclick = () => go(FL.i + 1); $('#lfP', body).onclick = () => go(FL.i - 1); $('#lfM', body).onclick = () => { FL.ph = FL.ph.map((p, i) => i === FL.i ? [p[0], p[1] + 1] : p); FL.rang = false; chips(); tick(); };
  FL.go = go; $('#lfAuto', body).checked = set.get('flowAuto', false); $('#lfAuto', body).onchange = e => set.put('flowAuto', e.target.checked); $('#lfStrip', body).checked = set.get('runway', true) !== false; $('#lfStrip', body).onchange = e => { set.put('runway', e.target.checked); tick(); };
  clearInterval(FL.t); FL.t = setInterval(tick, 500); chips(); tick(); }

/* ---------- questioning: Bloom's stems, cold call, command words with answer frames ---------- */
const BLOOM = [
  ['Remember', '#B197FC', ['What do we mean by ___?', 'Define ___.', 'Name the parts of ___.', 'List three facts about ___.', 'Where would you find ___?', 'Label a diagram of ___.']],
  ['Understand', '#38BDF8', ['Describe ___ in your own words.', 'Explain how ___ works.', 'Summarise ___ in one sentence.', 'What is the difference between ___ and …?', 'What is the main idea of ___?', 'Give an example of ___.']],
  ['Apply', '#4ADE80', ['How could ___ be used in real life?', 'Predict what would happen to ___ if …', 'Use ___ to solve this problem.', 'Calculate ___ using the data.', 'Which law or rule explains ___?', 'Where else have you seen ___?']],
  ['Analyse', '#FFC928', ['Compare ___ with …', 'What evidence supports ___?', 'What pattern do you see in the data about ___?', 'How are the parts of ___ related?', 'What are the variables in an experiment on ___?', 'What is the cause and what is the effect in ___?']],
  ['Evaluate', '#FF9F5A', ['How far do you agree with this claim about ___? Give reasons.', 'What are the strengths and limitations of ___?', 'How reliable is the evidence for ___?', 'Which method is best for ___, and why?', 'What would you change to improve ___?', 'Justify your view on ___.']],
  ['Create', '#FF5FA2', ['Design an experiment to test ___.', 'Write a hypothesis about ___.', 'Build a model that shows ___.', 'What would happen if ___ did not exist?', 'Invent an analogy for ___.', 'Plan a poster that teaches ___.']]];
function stems() { const f = floatPanel('stems', 'Question stems', '<div class="st-panel"><input id="qsT" class="inp" placeholder="Topic, e.g. osmosis" style="width:100%" value="' + esc(set.get('stemTopic', '')) + '"><div class="chips" id="qsL"></div><div id="qsList" style="max-height:330px;overflow:auto"></div><div class="row" style="gap:6px;margin-top:6px"><button class="btn sm" id="qsR">' + icon('dice-5') + 'Random question</button><button class="btn sm" id="qsC">' + icon('users') + 'Cold call</button></div></div>', { icon: 'message-circle-question', w: 430 });
  const body = f.body; let lv = set.get('stemLevel', 0);
  const fillT = s => { const t = $('#qsT', body).value.trim(); return s.replace('___', t || 'this'); };
  const draw = () => { $('#qsL', body).innerHTML = BLOOM.map((b, i) => '<button class="btn sm' + (i === lv ? ' on' : '') + '" data-l="' + i + '" style="border-color:' + b[1] + '">' + b[0] + '</button>').join('');
    $('#qsList', body).innerHTML = BLOOM[lv][2].map((s, i) => '<div class="st-stem"><span>' + esc(fillT(s)) + '</span><button class="ib" data-sh="' + i + '" title="Show full screen">' + icon('maximize-2') + '</button><button class="ib" data-bd="' + i + '" title="Add to the board">' + icon('plus') + '</button></div>').join('');
    $$('[data-l]', body).forEach(b => b.onclick = () => { lv = +b.dataset.l; set.put('stemLevel', lv); draw(); });
    $$('[data-sh]', body).forEach(b => b.onclick = () => bigQ(fillT(BLOOM[lv][2][+b.dataset.sh]), BLOOM[lv][0], BLOOM[lv][1]));
    $$('[data-bd]', body).forEach(b => b.onclick = () => boardText(fillT(BLOOM[lv][2][+b.dataset.bd]), { size: 36, b: true, w: 0 })); };
  $('#qsT', body).oninput = e => { set.put('stemTopic', e.target.value); draw(); };
  $('#qsR', body).onclick = () => { const l = Math.floor(Math.random() * 6), s = BLOOM[l][2]; bigQ(fillT(s[Math.floor(Math.random() * s.length)]), BLOOM[l][0], BLOOM[l][1]); };
  $('#qsC', body).onclick = coldCall; draw(); }
function bigQ(q, tag, col) { const el = stage('<div class="st-top"><span class="st-tag" style="border-color:' + col + ';font-size:14px">' + esc(tag) + '</span></div><div class="st-big" style="font-size:clamp(30px,5vw,80px);max-width:1300px">' + esc(q) + '</div><div class="st-foot"><button class="btn" id="bqT">' + icon('hourglass') + 'Think time</button><button class="btn" id="bqC">' + icon('users') + 'Cold call</button><button class="btn primary" id="bqB">' + icon('plus') + 'Add to the board</button></div>'); $('#bqT', el).onclick = () => window.HBC && HBC.think(); $('#bqC', el).onclick = coldCall; $('#bqB', el).onclick = () => { closeStage(); boardText(q, { size: 36, b: true, w: 0 }); }; }
let callBag = [];
function classNames() { const L = set.get('wheelLists', null), cur = set.get('wheelCur', ''); const n = set.get('coldNames', null) || (L && L[cur]) || set.get('names', []); return (n || []).map(x => typeof x === 'string' ? x : x && x.name).filter(Boolean); }
function coldCall() { const f = floatPanel('cold', 'Cold call', '<div class="big" id="ccN" style="font:800 34px var(--head);min-height:52px;display:grid;place-items:center">—</div><div class="small muted" id="ccL" style="text-align:center"></div><div class="row" style="justify-content:center;gap:6px;margin-top:8px"><button class="btn primary" id="ccGo">' + icon('shuffle') + 'Pick a student</button><button class="btn sm" id="ccE">Names</button></div>', { icon: 'users', w: 300 }); const b = f.body;
  const left = () => { $('#ccL', b).textContent = callBag.length ? callBag.length + ' still to be asked' : 'Everyone gets a turn before names repeat.'; };
  $('#ccGo', b).onclick = () => { const all = classNames(); if (!all.length) { toast('Add your class names first.'); $('#ccE', b).click(); return; } if (!callBag.length || callBag.some(n => !all.includes(n))) callBag = shuffle(all); const n = callBag.pop(); const el = $('#ccN', b); let k = 0; const roll = setInterval(() => { el.textContent = all[Math.floor(Math.random() * all.length)]; snd('tick'); if (++k > 9) { clearInterval(roll); el.textContent = n; snd('chime'); if (window.gsap && !REDUCE) gsap.from(el, { scale: 0.5, duration: 0.4, ease: 'back.out(2)' }); left(); } }, REDUCE ? 1 : 70); };
  $('#ccE', b).onclick = () => askText('Class names for cold call', 'Separate the names with commas.', classNames().join(', '), v => { const nn = v.split(/[\n,،]+/).map(s => s.trim()).filter(Boolean); set.put('coldNames', nn.length ? nn : null); callBag = []; left(); }); left(); }
const CMD = [
  ['Analyse', 'examine in detail to show meaning, identify elements and the relationships between them', ['Identify the parts / features', 'How the parts are linked', 'What this shows (conclusion)']],
  ['Calculate', 'work out from given facts, figures or information', ['Formula (with symbols)', 'Substitute the values', 'Working', 'Answer + unit + significant figures']],
  ['Compare', 'identify and comment on similarities and/or differences', ['Similarity — both …', 'Difference — whereas …', 'Difference — however …']],
  ['Contrast', 'identify and comment on differences', ['Difference 1 — X …, whereas Y …', 'Difference 2 — X …, whereas Y …']],
  ['Define', 'give the precise meaning', ['Key word', 'Precise meaning (use the key terms)']],
  ['Describe', 'state the points of a topic; give characteristics and main features', ['Main feature / trend', 'Detail + data (quote numbers with units)', 'Any exception / anomaly']],
  ['Discuss', 'write about issue(s) or topic(s) in depth in a structured way', ['Point for', 'Point against', 'Conclusion']],
  ['Evaluate', 'judge or calculate the quality, importance, amount or value of something', ['Strengths', 'Weaknesses / limitations', 'Judgement — overall …, because …']],
  ['Explain', 'set out purposes or reasons; make the relationships between things clear; say why and/or how, with evidence', ['Point — what happens', 'Because — the science reason', 'This means — the consequence / link']],
  ['Give', 'produce an answer from a given source or from memory', ['Answer']],
  ['Identify', 'name, select or recognise', ['Answer (name it precisely)']],
  ['Justify', 'support a case with evidence or argument', ['Claim', 'Evidence (data / observation)', 'Reasoning — this supports the claim because …']],
  ['Outline', 'set out the main points', ['Point 1', 'Point 2', 'Point 3']],
  ['Predict', 'suggest what may happen based on the information available', ['Prediction', 'Reason from the data or science']],
  ['Sketch', 'make a simple freehand drawing showing the key features, taking care over proportions', ['Labelled axes / outline', 'Key features + labels']],
  ['State', 'express in clear terms', ['Answer (short and precise)']],
  ['Suggest', 'apply your knowledge to a new situation where there is more than one valid answer', ['Idea', 'Science reason it could work']]];
function commandWords(insertOnly) { const f = floatPanel('cmdw', 'Command words', '<div class="st-panel"><div class="small muted">What the exam question is really asking — tap a word, then add an answer frame for students to write in.</div><div class="chips" id="cwL"></div><div id="cwD" class="st-row" style="font-size:15px;margin-top:6px"></div><div class="row" style="gap:6px;margin-top:8px"><button class="btn sm" id="cwB">' + icon('plus') + 'Definition on board</button><button class="btn sm primary" id="cwF">' + icon('layout-grid') + 'Answer frame</button></div></div>', { icon: 'spell-check', w: 440 }); const b = f.body; let cur = set.get('cmdCur', 8);
  const draw = () => { $('#cwL', b).innerHTML = CMD.map((c, i) => '<button class="btn sm' + (i === cur ? ' on' : '') + '" data-i="' + i + '">' + c[0] + '</button>').join(''); const c = CMD[cur]; $('#cwD', b).innerHTML = '<b>' + c[0] + '</b> — ' + esc(c[1]) + '<div class="small muted" style="margin-top:6px">Answer structure: ' + c[2].map(esc).join(' → ') + '</div>'; $$('[data-i]', b).forEach(x => x.onclick = () => { cur = +x.dataset.i; set.put('cmdCur', cur); draw(); }); };
  $('#cwB', b).onclick = () => { const c = CMD[cur]; boardText(c[0] + ' — ' + c[1], { size: 30 }); }; $('#cwF', b).onclick = () => answerFrame(CMD[cur]); draw(); }
function answerFrame(c) { askText('Answer frame — ' + c[0], 'Type the exam question (optional).', '', q => boardCard(c[0] + (q ? ': ' + q : ' — answer frame'), [{ h: 'What “' + c[0].toLowerCase() + '” means', lines: [c[1]] }].concat(c[2].map(s => ({ h: s, box: 110 }))), { w: 1100 })); }

/* ---------- team points ---------- */
const DEF_TEAMS = [['Team 1', '#FF5FA2'], ['Team 2', '#22D3EE'], ['Team 3', '#FFC928'], ['Team 4', '#4ADE80']].map(t => ({ n: t[0], c: t[1], s: 0 }));
function teams() { const T = set.get('teams', null) || DEF_TEAMS.map(t => Object.assign({}, t)); const save = () => set.put('teams', T);
  const f = floatPanel('teams', 'Team points', '<div id="tpL"></div><div class="row" style="gap:6px;margin-top:8px;flex-wrap:wrap"><button class="btn sm" id="tpA">' + icon('plus') + 'Team</button><button class="btn sm" id="tpR">' + icon('rotate-ccw') + 'Reset scores</button><button class="btn sm primary" id="tpW">' + icon('trophy') + 'Winners</button></div>', { icon: 'trophy', w: 380 }); const b = f.body;
  const draw = () => { const top = Math.max(...T.map(t => t.s)); $('#tpL', b).innerHTML = T.map((t, i) => '<div class="st-team"><i style="background:' + t.c + '"></i><input value="' + esc(t.n) + '" data-n="' + i + '"><b id="tpS' + i + '">' + t.s + '</b>' + (top > 0 && t.s === top ? '<span title="In the lead">👑</span>' : '') + '<button class="btn" data-d="' + i + '|-1">−1</button><button class="btn" data-d="' + i + '|1">+1</button><button class="btn" data-d="' + i + '|5">+5</button>' + (T.length > 2 ? '<button class="ib" data-x="' + i + '" title="Remove team" style="min-width:26px;height:26px">' + icon('x') + '</button>' : '') + '</div>').join('');
    $$('[data-n]', b).forEach(x => x.onchange = () => { T[+x.dataset.n].n = x.value.trim() || 'Team'; save(); });
    $$('[data-d]', b).forEach(x => x.onclick = () => { const [i, d] = x.dataset.d.split('|').map(Number); T[i].s = Math.max(0, T[i].s + d); save(); snd(d > 0 ? 'good' : 'pop'); draw(); const s = $('#tpS' + i, b); if (s && window.gsap && !REDUCE) gsap.fromTo(s, { scale: d > 0 ? 1.7 : 0.7 }, { scale: 1, duration: 0.4, ease: 'back.out(3)' }); });
    $$('[data-x]', b).forEach(x => x.onclick = () => { T.splice(+x.dataset.x, 1); save(); draw(); }); };
  $('#tpA', b).onclick = () => { if (T.length >= 8) return; const c = ['#FF5FA2', '#22D3EE', '#FFC928', '#4ADE80', '#B197FC', '#FF9F5A', '#38BDF8', '#F472B6']; T.push({ n: 'Team ' + (T.length + 1), c: c[T.length % 8], s: 0 }); save(); draw(); };
  $('#tpR', b).onclick = () => window.HB.ask('Set every team back to 0 points?', 'Reset', () => { T.forEach(t => t.s = 0); save(); draw(); });
  $('#tpW', b).onclick = () => winners(T); draw(); }
function winners(T) { T = (T || set.get('teams', DEF_TEAMS)).slice().sort((a, b) => b.s - a.s); const max = Math.max(1, ...T.map(t => t.s));
  const el = stage('<div class="st-q">' + (T[0].s ? '🏆 ' + esc(T[0].n) + ' wins!' : 'No points yet') + '</div><div class="st-podium">' + T.map((t, i) => '<div style="background:' + t.c + ';height:calc(120px + (100% - 120px) * ' + (t.s / max).toFixed(3) + ')"><span>' + (i < 3 && t.s ? ['🥇', '🥈', '🥉'][i] : '') + '</span>' + t.s + '<span>' + esc(t.n) + '</span></div>').join('') + '</div>');
  if (window.gsap && !REDUCE) gsap.from($$('.st-podium div', el), { height: 0, duration: 0.9, stagger: 0.12, ease: 'power3.out' }); if (T[0].s) { snd('fanfare'); setTimeout(() => confetti(), 500); } }

/* ---------- study log (practice quiz results) ---------- */
const log = () => Object.assign({ min: {}, act: {}, quiz: [] }, set.get('studyLog', {}));
function logActive() { const L = log(), d = dayKey(); L.act[d] = (L.act[d] || 0) + 1; set.put('studyLog', L); }
function logMinutes(m) { const L = log(), d = dayKey(); L.min[d] = (L.min[d] || 0) + m; L.act[d] = (L.act[d] || 0) + 1; set.put('studyLog', L); }
function logQuiz(n, s, t) { track('result', 'practice', n, s, t); const L = log(); L.quiz.push({ n, s, t, d: dayKey() }); L.quiz = L.quiz.slice(-60); L.act[dayKey()] = (L.act[dayKey()] || 0) + 1; set.put('studyLog', L); }
window.HBL = { confetti: () => confetti(), plan, objectivesCard, flow, editQuiz: () => editor('quiz'), editCards: () => editor('cards'), presentQuiz: n => presentQuiz(typeof n === 'string' ? n : undefined), practise: n => practise(typeof n === 'string' ? n : undefined), mistakes, flashcards: () => flashcards(null, false), dueToday, dueTotal, presentCards: () => flashcards(null, true), rootsDeck, retrieval, showMe, confidence, stems, coldCall, commandWords, teams, winners: () => winners(), importSets: () => importSets(), importFiles, saveCards: (n, cs) => { const all = sets.get('cards'); all[n] = cs; sets.put('cards', all); set.put('cardsCur', n); }, openCards: n => flashcards(n, false), closeStage, parseQuiz, parseCards, get stageOpen() { return !!stageEl; } };
})();
