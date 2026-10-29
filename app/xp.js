/* ================= HelixBoard — Classes, Class XP and Redemption =================
   Classes: the teacher names the class (2B, Grade 9 Biology…) and the lesson when a live session starts; the names go on the
   phones, into Reports and onto quiz ghosts. Class XP (ClassPoint-style): every answer, right answer, star and lesson attended
   earns XP across the whole term, read from the saved reports — students level up from Cell to Biosphere and earn badges.
   Redemption (Quizizz-style): the questions a class got wrong in recent lessons come back as a ready-made quiz. */
(() => {
'use strict';
const { $, $$, esc, icon, set, toast, modal, IDB, SND, REDUCE } = window.HB;
const snd = k => { try { SND[k] && SND[k](); } catch (e) {} };

/* ---------- classes and the current session name ---------- */
const S = { lesson: '', named: false, el: null, cls: null };
const list = () => set.get('classes', []);
const cur = () => set.get('curClass', '');
function setCur(n) { n = String(n || '').trim().slice(0, 40); if (n && !list().includes(n)) set.put('classes', list().concat(n).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))); set.put('curClass', n); }
const pageName = () => { const E = window.HBE, pg = E && E.page && E.page(); return pg && pg.name && !/^Page \d+$/.test(pg.name) ? pg.name : ''; };
const lesson = () => S.lesson || pageName() || 'Lesson';
const title = () => (cur() ? cur() + ' · ' : '') + lesson();
function classOptions(sel) { const L = list(); return '<option value="">No class</option>' + L.map(n => '<option' + (n === sel ? ' selected' : '') + '>' + esc(n) + '</option>').join('') + '<option value="__new">＋ New class…</option>'; }
/* a select that adds a new class when "New class…" is chosen */
function bindClassSelect(selEl, onPick) { selEl.onchange = () => { if (selEl.value !== '__new') { setCur(selEl.value); onPick && onPick(selEl.value); return; }
  const n = (prompt('Name of the new class (for example 2B or Grade 9 Biology):') || '').trim(); if (n) { setCur(n); selEl.innerHTML = classOptions(n); onPick && onPick(n); } else selEl.innerHTML = classOptions(cur()); }; }
/* asked once when a live session starts: which class, which lesson — phones show it and Reports keep it */
function askSession() { return new Promise(done => {
  modal.open('<h2>' + icon('radio') + ' Start a live session</h2><p class="muted" style="margin-top:-4px">Students see this name on their phones; reports and Class XP are kept per class.</p>' +
    '<label class="small">Class</label><select class="sel" id="xsCls" style="width:100%">' + classOptions(cur()) + '</select>' +
    '<label class="small" style="display:block;margin-top:10px">Lesson or session name</label><input class="inp" id="xsLes" maxlength="60" style="width:100%" placeholder="e.g. Photosynthesis — light reactions" value="' + esc(S.lesson || pageName()) + '">' +
    '<div class="small muted" style="margin-top:8px">' + icon('user') + ' Students must type their <b>full name</b> (first and last) to join.</div><label class="small" style="display:block;margin-top:6px"><input type="checkbox" id="xsAsk"' + (set.get('askSession', true) ? ' checked' : '') + '> Ask me every time a live session starts</label>' +
    '<div class="foot"><button class="btn" data-close>Cancel</button><button class="btn primary" id="xsGo">' + icon('radio') + 'Start</button></div>', sh => {
    bindClassSelect(sh.querySelector('#xsCls')); const les = sh.querySelector('#xsLes'); setTimeout(() => les.focus(), 50);
    const go = () => { set.put('askSession', sh.querySelector('#xsAsk').checked); S.lesson = les.value.trim().slice(0, 60); S.named = true; modal.close(); done(true); };
    sh.querySelector('#xsGo').onclick = go; les.onkeydown = e => { if (e.key === 'Enter') go(); };
    const x = sh.querySelector('[data-close]'); if (x) x.addEventListener('click', () => done(false)); });
  /* closing the dialog any other way counts as cancel */
  const t = setInterval(() => { if (!document.querySelector('#xsGo')) { clearInterval(t); if (!S.named) done(false); } }, 300); }); }
async function ensureSession() { if (S.named) return true; if (set.get('askSession', true) === false) { S.named = true; return true; } return askSession(); }
function rename() { S.named = false; return askSession().then(ok => { if (ok && window.helixDesktop && helixDesktop.cl && window.HBCL && HBCL.on) helixDesktop.cl.cmd('options', { title: title() }); return ok; }); }

/* ---------- XP from the saved reports ---------- */
const LEVELS = [[0, 'Cell', '🦠'], [100, 'Tissue', '🧫'], [250, 'Organ', '🫀'], [450, 'Organ system', '🫁'], [700, 'Organism', '🧍'], [1000, 'Population', '👥'], [1400, 'Community', '🏘️'], [1900, 'Ecosystem', '🌳'], [2500, 'Biosphere', '🌍']];
const levelOf = xp => { let i = 0; while (i + 1 < LEVELS.length && xp >= LEVELS[i + 1][0]) i++; return i; };
const BADGES = { roll: ['🔥', 'On a roll', 'Took part in the last 5 lessons'], sharp: ['🎯', 'Sharpshooter', '90% or more right (10+ marked answers)'], stars: ['⭐', 'Star collector', '10 or more stars'], improved: ['📈', 'Most improved', 'Biggest rise in accuracy in the latest lessons'], ontime: ['⏱', 'Always on time', '15+ answers, none handed in late'], perfect: ['💯', 'Perfect lesson', 'Every marked answer right in a lesson'], voice: ['🙋', 'Every voice', 'Answered everything in the last 3 lessons'] };
const key = n => String(n || '').trim().toLowerCase();
const gradable = a => (a.type === 'poll' && Number.isInteger(a.correct)) || !!a.graded;
const right = (a, r) => a.graded ? !!r.ok : r.value === a.correct;
async function sessions(cls) { const ix = (await IDB.get('reports:index')) || []; const out = [];
  for (const m of ix) { const s = await IDB.get('report:' + m.id); if (s && (!cls || s.cls === cls)) out.push(s); } return out.sort((a, b) => a.started - b.started); }
async function compute(cls) { const ss = await sessions(cls), P = new Map();
  const get = n => { const k = key(n); if (!P.has(k)) P.set(k, { name: String(n).trim(), xp: 0, answers: 0, graded: 0, right: 0, stars: 0, late: 0, attended: [], per: [] }); return P.get(k); };
  ss.forEach((s, si) => { const here = new Set(); (s.roster || []).forEach(n => here.add(key(n))); s.activities.forEach(a => a.responses.forEach(r => here.add(key(r.name))));
    here.forEach(k => { const p = P.get(k) || get((s.roster || []).find(n => key(n) === k) || k); p.xp += 5; p.attended.push(si); });
    const per = new Map();
    s.activities.forEach(a => a.responses.forEach(r => { const p = get(r.name); p.answers++; p.xp += 10; if (r.late) p.late++;
      const pp = per.get(key(r.name)) || { g: 0, ok: 0, n: 0 }; pp.n++; if (gradable(a)) { p.graded++; pp.g++; if (right(a, r)) { p.right++; pp.ok++; p.xp += 15; } } per.set(key(r.name), pp); }));
    Object.entries(s.stars || {}).forEach(([n, v]) => { const p = get(n); p.stars += v; p.xp += 20 * v; });
    if (s.scores) Object.entries(s.scores).forEach(([n, v]) => { get(n).xp += Math.round(v / 200); });
    per.forEach((v, k) => { const p = P.get(k); if (p) p.per.push({ si, g: v.g, ok: v.ok, n: v.n, acts: s.activities.length }); }); });
  const N = ss.length, people = [...P.values()];
  people.forEach(p => { p.lv = levelOf(p.xp); p.acc = p.graded ? Math.round(p.right / p.graded * 100) : null; const b = [];
    if (N >= 5 && [1, 2, 3, 4, 5].every(d => p.attended.includes(N - d))) b.push('roll');
    if (p.graded >= 10 && p.acc >= 90) b.push('sharp'); if (p.stars >= 10) b.push('stars'); if (p.answers >= 15 && !p.late) b.push('ontime');
    if (p.per.some(x => x.g >= 3 && x.ok === x.g)) b.push('perfect');
    if (N >= 3 && [1, 2, 3].every(d => { const x = p.per.find(y => y.si === N - d); return x && x.n >= x.acts; })) b.push('voice');
    p.badges = b; });
  /* most improved: accuracy in the latest 3 lessons against the lessons before, at least +15 points */
  let best = null; people.forEach(p => { const rec = p.per.filter(x => x.si >= N - 3 && x.g), old = p.per.filter(x => x.si < N - 3 && x.g); if (rec.length < 1 || old.length < 1) return;
    const acc = L => L.reduce((a, x) => a + x.ok, 0) / Math.max(1, L.reduce((a, x) => a + x.g, 0)); const d = acc(rec) - acc(old); if (d >= 0.15 && (!best || d > best.d)) best = { p, d }; });
  if (best) best.p.badges.push('improved');
  return { people: people.sort((a, b) => b.xp - a.xp), sessions: N }; }
/* what the phones show next to each name */
async function phoneLevels(cls) { const { people } = await compute(cls === undefined ? cur() : cls); const m = {}; people.forEach(p => { m[key(p.name)] = { l: p.lv + 1, t: LEVELS[p.lv][1], e: LEVELS[p.lv][2] }; }); return m; }

/* ---------- the Class XP screen ---------- */
const css = document.createElement('style'); css.textContent = `
#xpStage{position:fixed;inset:0;z-index:48;background:var(--bg);color:var(--ink);display:flex;flex-direction:column;font-family:var(--ui)}
#xpStage .xp-top{display:flex;align-items:center;gap:10px;flex-wrap:wrap;padding:10px 16px;border-bottom:1px solid var(--line);background:var(--panel)}
#xpStage .xp-top .ttl{font:800 19px var(--head);display:flex;align-items:center;gap:8px;margin-right:6px}
#xpStage .xp-body{flex:1;overflow:auto;padding:18px clamp(14px,3vw,40px) 40px}
#xpStage .xp-lv{display:flex;gap:6px;flex-wrap:wrap;margin:0 0 16px}#xpStage .xp-lv span{padding:4px 10px;border-radius:999px;background:var(--panel);border:1px solid var(--line);font-size:12px;color:var(--muted)}
#xpStage .xp-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:12px}
#xpStage .xp-card{display:grid;grid-template-columns:44px 52px 1fr;gap:10px;align-items:center;padding:12px 14px;border-radius:16px;background:var(--panel);border:1px solid var(--line)}
#xpStage .xp-card.top{border-color:var(--gold);box-shadow:0 0 0 1px var(--gold) inset}
#xpStage .xp-rk{font:800 22px var(--mono);color:var(--muted);text-align:center}
#xpStage .xp-av{width:52px;height:52px;border-radius:14px;display:grid;place-items:center;font-size:28px;background:var(--panel2)}
#xpStage .xp-nm{font:800 16px var(--head);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#xpStage .xp-sub{font-size:12px;color:var(--muted);margin:2px 0 6px}
#xpStage .xp-bar{height:8px;border-radius:4px;background:var(--panel2);overflow:hidden}#xpStage .xp-bar i{display:block;height:100%;background:linear-gradient(90deg,var(--accent),var(--cyan))}
#xpStage .xp-bd{display:flex;gap:4px;flex-wrap:wrap;margin-top:6px}#xpStage .xp-bd span{font-size:16px;cursor:default}
#xpStage .xp-up{margin:0 0 16px;padding:12px 16px;border-radius:16px;background:linear-gradient(90deg,color-mix(in srgb,var(--gold) 22%,var(--panel)),var(--panel));border:1px solid var(--gold);font:700 15px var(--head)}
#xpStage .xp-empty{max-width:560px;margin:60px auto;text-align:center;color:var(--muted)}
body.ar #xpStage{direction:rtl}
`; document.head.appendChild(css);
async function open(cls) { if (cls !== undefined) S.cls = cls; if (S.cls == null) S.cls = cur();
  if (!S.el) { const el = document.createElement('div'); el.id = 'xpStage'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-label', 'Class XP'); document.body.appendChild(el); S.el = el;
    el.addEventListener('keydown', e => { if (e.key === 'Escape') { e.stopPropagation(); close(); } }); }
  S.el.hidden = false; S.el.innerHTML = '<div class="xp-top"><span class="ttl">' + icon('badge-check') + 'Class XP</span><select class="sel" id="xpCls" style="width:auto">' + classOptions(S.cls).replace('<option value="">No class</option>', '<option value="">All classes</option>') + '</select><span style="flex:1"></span><button class="btn sm" id="xpRed">' + icon('rotate-ccw') + 'Redemption quiz</button><button class="btn sm" id="xpBoard">' + icon('image-down') + 'Top 10 on the board</button><button class="btn sm" id="xpCsv">' + icon('download') + 'Excel (.csv)</button><button class="btn sm" id="xpX">Close ✕</button></div><div class="xp-body" id="xpBody"><div class="xp-empty">Adding up the XP…</div></div>';
  const sel = S.el.querySelector('#xpCls'); bindClassSelect(sel, n => { S.cls = n; open(); }); sel.addEventListener('change', () => { if (sel.value !== '__new') { S.cls = sel.value; open(); } });
  S.el.querySelector('#xpX').onclick = close; S.el.querySelector('#xpRed').onclick = () => redemption(S.cls);
  const data = await compute(S.cls); S.data = data; render(data);
  S.el.querySelector('#xpCsv').onclick = () => exportCsv(data); S.el.querySelector('#xpBoard').onclick = () => toBoard(data); }
function close() { if (S.el) { S.el.remove(); S.el = null; } }
function render(d) { const b = S.el && S.el.querySelector('#xpBody'); if (!b) return;
  if (!d.people.length) { b.innerHTML = '<div class="xp-empty"><div style="font-size:48px">🧬</div><h2>No XP yet' + (S.cls ? ' for ' + esc(S.cls) : '') + '</h2><p>Run a Live class or a phone quiz with this class. Every answer (+10), right answer (+15), star (+20) and lesson attended (+5) adds XP. Students level up from Cell to Biosphere.</p></div>'; return; }
  const seenKey = 'xpSeen:' + (S.cls || '*'), seen = set.get(seenKey, {}), ups = d.people.filter(p => seen[key(p.name)] != null && p.lv > seen[key(p.name)]);
  const now = {}; d.people.forEach(p => { now[key(p.name)] = p.lv; }); set.put(seenKey, now);
  b.innerHTML = (ups.length ? '<div class="xp-up">🎉 Level up! ' + ups.map(p => esc(p.name) + ' → ' + LEVELS[p.lv][2] + ' ' + LEVELS[p.lv][1]).join(' · ') + '</div>' : '') +
    '<div class="xp-lv">' + LEVELS.map(l => '<span>' + l[2] + ' ' + l[1] + ' · ' + l[0] + ' XP</span>').join('') + '</div><div class="small muted" style="margin:-8px 0 14px">' + d.sessions + ' lesson' + (d.sessions === 1 ? '' : 's') + (S.cls ? ' with ' + esc(S.cls) : '') + ' · ' + Object.values(BADGES).map(x => x[0] + ' ' + x[1]).join(' · ') + '</div>' +
    '<div class="xp-grid">' + d.people.map((p, i) => { const L0 = LEVELS[p.lv], L1 = LEVELS[p.lv + 1], f = L1 ? (p.xp - L0[0]) / (L1[0] - L0[0]) : 1;
      return '<div class="xp-card' + (i < 3 ? ' top' : '') + '"><div class="xp-rk">' + (i < 3 ? ['🥇', '🥈', '🥉'][i] : i + 1) + '</div><div class="xp-av" title="' + esc(L0[1]) + '">' + L0[2] + '</div><div style="min-width:0"><div class="xp-nm">' + esc(p.name) + '</div><div class="xp-sub">Level ' + (p.lv + 1) + ' · ' + L0[1] + ' · <b style="color:var(--ink)">' + p.xp + ' XP</b>' + (L1 ? ' · ' + (L1[0] - p.xp) + ' to ' + L1[1] : ' · top level!') + (p.acc != null ? ' · ' + p.acc + '% right' : '') + '</div><div class="xp-bar"><i style="width:' + Math.round(f * 100) + '%"></i></div>' +
        (p.badges.length ? '<div class="xp-bd">' + p.badges.map(k => '<span title="' + esc(BADGES[k][1] + ' — ' + BADGES[k][2]) + '">' + BADGES[k][0] + '</span>').join('') + '</div>' : '') + '</div></div>'; }).join('') + '</div>';
  if (ups.length) { snd('fanfare'); window.HBL && HBL.confetti && HBL.confetti(); }
  if (window.gsap && !REDUCE) gsap.from($$('.xp-card', b), { y: 10, opacity: 0, duration: 0.25, stagger: 0.02 }); }
function exportCsv(d) { const rows = [['Rank', 'Name', 'XP', 'Level', 'Level name', 'Answers', 'Accuracy %', 'Stars', 'Lessons', 'Badges']].concat(d.people.map((p, i) => [i + 1, p.name, p.xp, p.lv + 1, LEVELS[p.lv][1], p.answers, p.acc == null ? '' : p.acc, p.stars, p.attended.length, p.badges.map(k => BADGES[k][1]).join('; ')]));
  const text = '﻿' + rows.map(r => r.map(x => '"' + String(x).replace(/"/g, '""') + '"').join(',')).join('\r\n'), a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type: 'text/csv' })); a.download = 'Class XP' + (S.cls ? ' - ' + S.cls.replace(/[\\/:*?"<>|]+/g, '-') : '') + '.csv'; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); }
function toBoard(d) { const top = d.people.slice(0, 10); if (!top.length) { toast('No XP yet.'); return; } const W = 1400, rowH = 74, H = 130 + top.length * rowH, c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d');
  g.fillStyle = '#fff'; g.fillRect(0, 0, W, H); g.fillStyle = '#1E1419'; g.font = '800 40px "Space Grotesk", sans-serif'; g.fillText('🏆 Class XP' + (S.cls ? ' — ' + S.cls : ''), 40, 64);
  top.forEach((p, i) => { const y = 100 + i * rowH, L0 = LEVELS[p.lv], L1 = LEVELS[p.lv + 1], f = L1 ? (p.xp - L0[0]) / (L1[0] - L0[0]) : 1; g.fillStyle = i < 3 ? '#FFF4CC' : '#F6F1F6'; g.fillRect(30, y, W - 60, rowH - 10);
    g.fillStyle = '#1E1419'; g.font = '800 30px monospace'; g.fillText(String(i + 1), 50, y + 44); g.font = '34px sans-serif'; g.fillText(L0[2], 110, y + 46); g.font = '700 28px "Segoe UI", sans-serif'; g.fillText(p.name + '  ' + p.badges.map(k => BADGES[k][0]).join(''), 170, y + 34);
    g.font = '600 18px "Segoe UI", sans-serif'; g.fillStyle = '#6C5864'; g.fillText('Level ' + (p.lv + 1) + ' · ' + L0[1], 170, y + 56); g.fillStyle = '#E9DFE9'; g.fillRect(760, y + 22, 420, 18); g.fillStyle = '#FF5FA2'; g.fillRect(760, y + 22, 420 * f, 18); g.fillStyle = '#1E1419'; g.font = '800 26px monospace'; g.fillText(p.xp + ' XP', 1200, y + 42); });
  close(); window.HBI.insertImage(c.toDataURL('image/png')); toast('Class XP added to the board.'); }

/* ---------- redemption: the questions the class got wrong come back ---------- */
async function redemption(cls) { if (cls === undefined) cls = cur(); const ss = (await sessions(cls)).slice(-3), seen = new Set(), qs = [];
  ss.forEach(s => s.activities.forEach(a => { if (!gradable(a) || !a.responses.length || seen.has(a.prompt)) return; const acc = a.responses.filter(r => right(a, r)).length / a.responses.length; if (acc >= 0.6) return;
    if (a.type === 'poll' && a.options && a.options.length >= 2) { seen.add(a.prompt); qs.push({ q: a.prompt || 'Question', o: a.options.slice(0, 6), a: a.correct, ex: '' }); }
    else if (a.type === 'order' && a.options && a.options.length >= 2) { seen.add(a.prompt); qs.push({ q: a.prompt || 'Put in order', o: a.options.slice(0, 6), a: -1, ex: '', t: 'order' }); } }));
  if (!qs.length) { toast(ss.length ? '🎉 No missed questions in the last ' + ss.length + ' lesson' + (ss.length === 1 ? '' : 's') + (cls ? ' with ' + esc(cls) : '') + ' — nothing to redeem!' : 'No lessons saved yet' + (cls ? ' for ' + esc(cls) : '') + '.', 4200); return; }
  const name = '⟲ Redemption' + (cls ? ' · ' + cls : '') + ' · ' + new Date().toLocaleDateString([], { day: 'numeric', month: 'short' }), all = set.get('quizSets', {}); all[name] = qs; set.put('quizSets', all);
  modal.open('<h2>' + icon('rotate-ccw') + ' Redemption quiz</h2><p>' + qs.length + ' question' + (qs.length === 1 ? '' : 's') + ' the class got wrong (under 60% right) in the last ' + ss.length + ' lesson' + (ss.length === 1 ? '' : 's') + (cls ? ' with <b>' + esc(cls) + '</b>' : '') + '. Saved as the quiz set “' + esc(name) + '”.</p><div class="small muted" style="max-height:30vh;overflow:auto">' + qs.map((q, i) => (i + 1) + '. ' + esc(q.q)).join('<br>') + '</div>' +
    '<div class="foot"><button class="btn" data-close>Later</button><button class="btn" id="rdL">' + icon('presentation') + 'Live quiz (hands)</button><button class="btn primary" id="rdP">' + icon('smartphone') + 'Phone quiz</button></div>', sh => {
    sh.querySelector('#rdL').onclick = () => { modal.close(); close(); HBL.presentQuiz(name); }; sh.querySelector('#rdP').onclick = () => { modal.close(); close(); HBL.phoneQuiz(name); }; }); }

window.HBX = { cur, list, setCur, title, lesson, ensureSession, askSession, rename, classOptions, bindClassSelect, compute, phoneLevels, open, close, redemption, LEVELS, get named() { return S.named; }, reset() { S.named = false; S.lesson = ''; }, setSession(c, l) { if (c != null) setCur(c); S.lesson = l || ''; S.named = true; } };
})();
