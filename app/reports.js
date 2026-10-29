/* ================= HelixBoard — Reports: every Live class activity and phone quiz, saved and analysed =================
   Like the reports in Wayground/Quizizz (and a Power BI page): each lesson is saved automatically with every activity and every
   student's answer. The dashboard shows headline numbers, participation and accuracy charts, a colour-coded student grid,
   per-activity detail and who needs attention. Export: Excel workbook (several sheets), a tidy CSV for Power BI, a PDF report,
   or a .hbreport file to share. Everything stays on this computer (IndexedDB). */
(() => {
'use strict';
const { $, $$, esc, icon, set, toast, modal, IDB, SND, REDUCE } = window.HB;
const KEY = 'reports:index', RK = id => 'report:' + id;
const TYPE = { draw: ['pen-tool', 'Draw it'], poll: ['chart-column-big', 'Poll'], order: ['list-ordered', 'Put in order'], pin: ['map-pin', 'Tap the picture'], word: ['cloud', 'Word cloud'], text: ['message-square-text', 'Short answer'], image: ['camera', 'Photo'], notes: ['sticky-note', 'Collaborate'], quiz: ['trophy', 'Quiz question'] };
const POLL_C = ['#FF5FA2', '#22D3EE', '#FFC928', '#4ADE80', '#B197FC', '#FF9F5A'];
const R = { el: null, index: [], cur: null, tab: set.get('rpTab', 'overview'), q: '', sort: ['name', 1], live: null };
const pct = (a, b) => b ? Math.round(a / b * 100) : null;
const fmtD = t => new Date(t).toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
const fmtT = t => new Date(t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
const dur = ms => { const m = Math.round(ms / 60000); return m < 60 ? m + ' min' : Math.floor(m / 60) + ' h ' + (m % 60) + ' min'; };

/* ---------- storage ---------- */
async function loadIndex() { R.index = (await IDB.get(KEY)) || []; return R.index; }
async function saveSession(s) { await IDB.put(RK(s.id), s); const i = R.index.findIndex(x => x.id === s.id), meta = metaOf(s); if (i >= 0) R.index[i] = meta; else R.index.unshift(meta); R.index.sort((a, b) => b.started - a.started); await IDB.put(KEY, R.index); }
function metaOf(s) { const st = stats(s); return { id: s.id, kind: s.kind, title: s.title, started: s.started, ended: s.ended, students: st.students.length, activities: s.activities.length, participation: st.participation, accuracy: st.accuracy }; }
async function getSession(id) { return IDB.get(RK(id)); }
async function deleteSession(id) { await IDB.put(RK(id), null); R.index = R.index.filter(x => x.id !== id); await IDB.put(KEY, R.index); }

/* ---------- recording (called by Live class and the phone quiz) ---------- */
/* one Live class lesson = one report; activities are added as they finish */
async function addActivity(sessionInfo, act) { if (!index.ready) await index();
  let s = R.live && R.live.id === sessionInfo.id ? R.live : await getSession(sessionInfo.id);
  if (!s) s = { id: sessionInfo.id, kind: 'live', cls: sessionInfo.cls || '', title: sessionInfo.title || 'Live class', started: sessionInfo.started || Date.now(), ended: Date.now(), roster: [], stars: {}, activities: [] };
  s.ended = Date.now(); if (sessionInfo.cls) s.cls = sessionInfo.cls; if (sessionInfo.title) s.title = sessionInfo.title; (sessionInfo.roster || []).forEach(n => { if (!s.roster.includes(n)) s.roster.push(n); }); Object.assign(s.stars, sessionInfo.stars || {});
  const i = s.activities.findIndex(a => a.id === act.id); if (i >= 0) s.activities[i] = act; else s.activities.push(act);
  R.live = s; await saveSession(s); if (R.el && R.cur && R.cur.id === s.id) { R.cur = s; render(); } }
async function updateLive(sessionInfo) { if (!R.live || R.live.id !== sessionInfo.id) return; Object.assign(R.live.stars, sessionInfo.stars || {}); (sessionInfo.roster || []).forEach(n => { if (!R.live.roster.includes(n)) R.live.roster.push(n); }); R.live.ended = Date.now(); await saveSession(R.live); }
/* a phone quiz game becomes a report whose activities are its questions */
async function addQuiz(title, res) { if (!res || !res.players) return; if (!index.ready) await index();
  const id = 'q' + Date.now().toString(36), s = { id, kind: 'quiz', title: title || 'Phone quiz', started: Date.now() - 60000, ended: Date.now(), roster: res.players.map(p => p.name), stars: {}, scores: {}, activities: [] };
  res.players.forEach(p => { s.scores[p.name] = p.score; });
  if (window.HBX) s.cls = HBX.cur(); if (res.opts && res.opts.mode !== 'classic') s.mode = res.opts.mode; if (res.teams) s.teams = res.teams; if (res.boss) s.boss = { won: res.boss.hp <= 0, left: Math.round(res.boss.hp / res.boss.max * 100) };
  res.questions.forEach((q, k) => s.activities.push({ id: id + '-' + k, type: q.t === 'order' ? 'order' : 'poll', quiz: true, prompt: q.q, options: q.o, correct: q.t !== 'order' && q.a >= 0 ? q.a : null, graded: q.t === 'order' || undefined, once: true, started: s.started, ended: s.ended,
    responses: res.players.filter(p => p.ans[k] && p.ans[k].c !== -1).map(p => ({ name: p.name, value: p.ans[k].c, ms: p.ans[k].ms, ok: p.ans[k].ok, conf: p.ans[k].conf, team: p.team || undefined })) }));
  await saveSession(s); return s; }
async function index() { await loadIndex(); index.ready = true; }

/* ---------- analysis ---------- */
/* graded: a poll with a right answer, or an activity that marks each answer itself (put in order, tap the picture with a target) */
const gradable = a => (a.type === 'poll' && Number.isInteger(a.correct)) || !!a.graded;
const isRight = (a, r) => a.graded ? !!r.ok : r.value === a.correct;
function stats(s) {
  const names = new Set(s.roster || []); s.activities.forEach(a => a.responses.forEach(r => names.add(r.name)));
  const students = [...names].map(name => { let answered = 0, right = 0, graded = 0, late = 0; const cells = s.activities.map(a => { const r = a.responses.find(x => x.name === name); if (!r) return { st: 'miss' }; answered++; if (r.late) late++;
      if (gradable(a)) { graded++; const ok = isRight(a, r); if (ok) right++; return { st: ok ? 'ok' : 'bad', r }; } return { st: 'done', r }; });
    return { name, answered, right, graded, late, cells, participation: pct(answered, s.activities.length), accuracy: pct(right, graded), stars: (s.stars || {})[name] || 0, score: s.scores ? s.scores[name] || 0 : null }; });
  const acts = s.activities.map(a => { const n = a.responses.length, right = gradable(a) ? a.responses.filter(r => isRight(a, r)).length : null;
    return { a, n, participation: pct(n, students.length), accuracy: gradable(a) ? pct(right, n) : null, late: a.responses.filter(r => r.late).length }; });
  const totalAnswers = acts.reduce((x, y) => x + y.n, 0), possible = students.length * s.activities.length;
  const gr = acts.filter(x => x.accuracy != null && x.n), gRight = gr.reduce((x, y) => x + y.a.responses.filter(r => isRight(y.a, r)).length, 0), gN = gr.reduce((x, y) => x + y.n, 0);
  return { students, acts, participation: pct(totalAnswers, possible), accuracy: pct(gRight, gN), onTime: pct(totalAnswers - acts.reduce((x, y) => x + y.late, 0), totalAnswers), stars: Object.values(s.stars || {}).reduce((x, y) => x + y, 0) }; }

/* ---------- styles ---------- */
const css = document.createElement('style'); css.textContent = `
#rpStage{position:fixed;inset:0;z-index:48;background:var(--bg);color:var(--ink);display:grid;grid-template-rows:auto minmax(0,1fr);grid-template-columns:290px minmax(0,1fr);font-family:var(--ui)}
#rpStage .rp-top{grid-column:1/-1;display:flex;align-items:center;gap:10px;padding:10px 16px;border-bottom:1px solid var(--line);background:linear-gradient(180deg,color-mix(in srgb,var(--panel2) 70%,var(--panel)),var(--panel))}
#rpStage .rp-top .ttl{display:flex;align-items:center;gap:10px;font:800 19px var(--head)}
#rpStage .rp-top .ttl svg{color:var(--cyan)}
#rpStage .rp-side{border-inline-end:1px solid var(--line);background:var(--panel);overflow:auto;padding:12px;display:flex;flex-direction:column;gap:8px}
#rpStage .rp-side input{height:38px;border-radius:11px;border:1px solid var(--line);background:var(--panel2);color:var(--ink);padding:0 12px}
#rpStage .rp-day{font:700 11px var(--ui);letter-spacing:.09em;text-transform:uppercase;color:var(--muted);margin:10px 4px 2px}
#rpStage .rp-item{display:flex;flex-direction:column;gap:4px;text-align:start;padding:10px 12px;border-radius:13px;border:1px solid transparent;background:transparent;color:var(--ink);cursor:pointer}
#rpStage .rp-item:hover{background:var(--panel2)}
#rpStage .rp-item.on{background:var(--grad-soft);border-color:color-mix(in srgb,var(--accent) 45%,transparent)}
#rpStage .rp-item b{font-size:14px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
#rpStage .rp-item small{color:var(--muted);font-size:12px;display:flex;gap:8px;flex-wrap:wrap}
#rpStage .rp-main{overflow:auto;padding:20px 26px 50px;min-width:0}
#rpStage .rp-head{display:flex;align-items:flex-end;justify-content:space-between;gap:14px;flex-wrap:wrap}
#rpStage .rp-head h1{margin:0;font:800 clamp(22px,2.4vw,32px)/1.15 var(--head);outline:none;border-radius:8px}
#rpStage .rp-head h1:focus{box-shadow:0 0 0 2px var(--accent)}
#rpStage .rp-head .sub{color:var(--muted);font-size:13.5px;margin-top:6px}
#rpStage .rp-acts{display:flex;gap:6px;flex-wrap:wrap}
#rpStage .kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(128px,1fr));gap:12px;margin:18px 0}
#rpStage .kpi{background:var(--panel);border:1px solid var(--line);border-radius:16px;padding:14px 16px;position:relative;overflow:hidden}
#rpStage .kpi::after{content:"";position:absolute;inset:auto 0 0 0;height:3px;background:var(--k,var(--accent))}
#rpStage .kpi small{display:block;color:var(--muted);font-size:12px;font-weight:600;letter-spacing:.02em}
#rpStage .kpi b{display:block;font:800 30px/1.15 var(--head);margin-top:4px}
#rpStage .kpi span{font-size:12px;color:var(--muted)}
#rpStage .tabs{display:flex;gap:4px;border-bottom:1px solid var(--line);margin-bottom:16px}
#rpStage .tabs button{border:0;background:none;color:var(--muted);font:700 14px var(--ui);padding:10px 14px;cursor:pointer;border-bottom:3px solid transparent;margin-bottom:-1px}
#rpStage .tabs button.on{color:var(--ink);border-bottom-color:var(--accent)}
#rpStage .grid2{display:grid;grid-template-columns:repeat(auto-fit,minmax(380px,1fr));gap:14px}
#rpStage .card{background:var(--panel);border:1px solid var(--line);border-radius:16px;padding:16px 18px}
#rpStage .card h3{margin:0 0 12px;font:700 14px var(--ui);display:flex;align-items:center;gap:8px}
#rpStage .card h3 svg{width:17px;height:17px;color:var(--muted)}
#rpStage .hb{display:grid;grid-template-columns:minmax(0,190px) 1fr 52px;gap:10px;align-items:center;margin:7px 0;font-size:13px}
#rpStage .hb .l{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--muted)}
#rpStage .hb .t{height:12px;border-radius:6px;background:var(--panel2);overflow:hidden}
#rpStage .hb .t i{display:block;height:100%;border-radius:6px}
#rpStage .hb b{text-align:end;font:700 13px var(--mono)}
#rpStage .donut{display:flex;align-items:center;gap:18px;flex-wrap:wrap}
#rpStage .legend div{display:flex;align-items:center;gap:8px;font-size:13px;margin:5px 0}
#rpStage .legend i{width:12px;height:12px;border-radius:4px;display:inline-block}
#rpStage .who{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:7px 4px;border-bottom:1px solid var(--line);font-size:13.5px}
#rpStage .who:last-child{border-bottom:0}
#rpStage .pill{font:700 12px var(--mono);padding:2px 8px;border-radius:999px;background:var(--panel2)}
#rpStage table.st{border-collapse:separate;border-spacing:0;width:100%;font-size:13px}
#rpStage .tw{overflow:auto;border:1px solid var(--line);border-radius:14px;background:var(--panel)}
#rpStage table.st th{position:sticky;top:0;background:var(--panel2);font-weight:700;text-align:start;padding:9px 10px;white-space:nowrap;cursor:pointer;border-bottom:1px solid var(--line);z-index:1}
#rpStage table.st th.q{text-align:center;cursor:default;min-width:40px}
#rpStage table.st td{padding:7px 10px;border-bottom:1px solid var(--line);white-space:nowrap}
#rpStage table.st td.c{text-align:center;padding:4px}
#rpStage table.st tr:hover td{background:color-mix(in srgb,var(--panel2) 60%,transparent)}
#rpStage .cell{display:inline-grid;place-items:center;width:30px;height:26px;border-radius:7px;font-weight:800;font-size:13px}
#rpStage .c-ok{background:color-mix(in srgb,#2F9E44 75%,transparent);color:#fff}
#rpStage .c-bad{background:color-mix(in srgb,#E03131 75%,transparent);color:#fff}
#rpStage .c-done{background:color-mix(in srgb,#1971C2 60%,transparent);color:#fff}
#rpStage .c-miss{background:var(--panel2);color:var(--muted)}
#rpStage .acc{font:700 13px var(--mono);padding:2px 8px;border-radius:8px}
#rpStage .a-hi{background:color-mix(in srgb,#2F9E44 22%,transparent);color:var(--ok)}
#rpStage .a-md{background:color-mix(in srgb,#FFC928 22%,transparent);color:var(--gold)}
#rpStage .a-lo{background:color-mix(in srgb,#E03131 22%,transparent);color:var(--bad)}
#rpStage .acard{margin-bottom:14px}
#rpStage .acard .meta{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-bottom:10px}
#rpStage .acard .p{font:700 17px/1.35 var(--head);margin:0 0 12px}
#rpStage .thumbs{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:10px}
#rpStage .thumbs figure{margin:0;background:#fff;border-radius:10px;overflow:hidden;border:1px solid var(--line)}
#rpStage .thumbs img{display:block;width:100%;aspect-ratio:4/3;object-fit:contain;background:#fff}
#rpStage .thumbs figcaption{font-size:12px;font-weight:700;padding:5px 8px;background:var(--panel2);color:var(--ink)}
#rpStage .answers{display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:8px}
#rpStage .answers div{background:var(--panel2);border-radius:10px;padding:8px 10px;font-size:13.5px;white-space:pre-wrap}
#rpStage .answers b{display:block;font-size:12px;color:var(--cyan);margin-bottom:2px}
#rpStage .empty{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;text-align:center;color:var(--muted);height:100%;padding:40px}
#rpStage .empty b{font:800 24px var(--head);color:var(--ink)}
@media (max-width:900px){#rpStage{grid-template-columns:1fr}#rpStage .rp-side{display:none}}
body.ar #rpStage{direction:rtl}
@media print{
  body.rp-print > *:not(#rpStage){display:none!important}
  html.rp-print,body.rp-print{display:block!important;overflow:visible!important;background:#fff!important;height:auto!important}
  body.rp-print #rpStage{--panel:#fff;--panel2:#F4EEF3;--line:#E3D9E1;--ink:#1E1419;--muted:#6E5C6B}
  body.rp-print #rpStage{position:static!important;display:block!important;background:#fff!important;color:#1E1419!important}
  body.rp-print #rpStage .rp-top,body.rp-print #rpStage .rp-side,body.rp-print #rpStage .rp-acts,body.rp-print #rpStage .tabs{display:none!important}
  body.rp-print #rpStage .rp-main{overflow:visible!important;padding:12mm 12mm!important;background:#fff!important}
  @page{margin:0}
  body.rp-print #rpStage .card,body.rp-print #rpStage .kpi,body.rp-print #rpStage .tw{break-inside:avoid;background:#fff!important;border-color:#ddd!important}
  body.rp-print #rpStage .rp-sec{display:block!important;break-before:page}
  body.rp-print #rpStage .rp-sec:first-of-type{break-before:auto}
}
`;
document.head.appendChild(css);

/* ---------- the dashboard ---------- */
async function open(id) { await index(); build(); if (id) await select(id); else if (!R.cur && R.index[0]) await select(R.index[0].id); else render(); }
function build() { if (R.el && R.el.isConnected) { R.el.hidden = false; return; }
  const el = document.createElement('div'); el.id = 'rpStage'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-label', 'Reports');
  el.innerHTML = '<div class="rp-top"><div class="ttl">' + icon('chart-column-big') + 'Reports</div><span style="flex:1"></span><button class="btn sm" id="rpOpen">' + icon('file-input') + 'Open report file</button><button class="btn sm" id="rpX">' + icon('x') + 'Close</button></div><div class="rp-side" id="rpSide"></div><div class="rp-main" id="rpMain"></div>';
  document.body.appendChild(el); R.el = el;
  el.querySelector('#rpX').onclick = close; el.querySelector('#rpOpen').onclick = openFile;
  el.addEventListener('keydown', e => { if (e.key === 'Escape' && !e.target.closest('input,[contenteditable]')) { e.stopPropagation(); close(); } });
  el.addEventListener('dragover', e => e.preventDefault()); el.addEventListener('drop', e => { e.preventDefault(); const f = [...e.dataTransfer.files].find(x => /\.hbreport$/i.test(x.name)); if (f) readFile(f); });
  if (window.gsap && !REDUCE) gsap.from(el, { opacity: 0, y: 10, duration: 0.25 }); }
function close() { if (R.el) R.el.hidden = true; }
async function select(id) { R.cur = await getSession(id); if (!R.cur) { R.index = R.index.filter(x => x.id !== id); } render(); }

function render() { if (!R.el) return; renderSide(); renderMain(); }
function renderSide() { const s = R.el.querySelector('#rpSide'), q = R.q.toLowerCase(); let day = '', h = '<input id="rpQ" placeholder="Search lessons…" value="' + esc(R.q) + '">';
  const list = R.index.filter(x => !q || (x.title || '').toLowerCase().includes(q));
  if (!list.length) h += '<div class="muted small" style="padding:10px">' + (R.index.length ? 'Nothing matches.' : 'Reports appear here automatically after you run Live class activities or a phone quiz.') + '</div>';
  list.forEach(x => { const d = fmtD(x.started); if (d !== day) { day = d; h += '<div class="rp-day">' + esc(d) + '</div>'; }
    h += '<button class="rp-item' + (R.cur && R.cur.id === x.id ? ' on' : '') + '" data-id="' + esc(x.id) + '"><b>' + (x.kind === 'quiz' ? '🏆 ' : '📡 ') + esc(x.title) + '</b><small><span>' + fmtT(x.started) + '</span><span>👥 ' + x.students + '</span><span>📋 ' + x.activities + '</span>' + (x.accuracy != null ? '<span>✓ ' + x.accuracy + '%</span>' : '') + '</small></button>'; });
  s.innerHTML = h; const qi = s.querySelector('#rpQ'); qi.oninput = () => { R.q = qi.value; const pos = qi.selectionStart; renderSide(); const n = R.el.querySelector('#rpQ'); n.focus(); n.setSelectionRange(pos, pos); };
  $$('.rp-item', s).forEach(b => b.onclick = () => select(b.dataset.id)); }

function renderMain() { const m = R.el.querySelector('#rpMain'), s = R.cur;
  if (!s) { m.innerHTML = '<div class="empty">' + icon('chart-column-big') + '<b>No report selected</b><span>Every Live class activity and phone quiz is saved here automatically — with each student’s answers.</span></div>'; return; }
  const st = stats(s), gradableN = s.activities.filter(gradable).length;
  const kpi = (label, val, sub, color) => '<div class="kpi" style="--k:' + color + '"><small>' + label + '</small><b>' + val + '</b><span>' + (sub || '') + '</span></div>';
  m.innerHTML = '<div class="rp-head"><div><h1 id="rpTitle" contenteditable="true" spellcheck="false" title="Click to rename">' + esc(s.title) + '</h1><div class="sub">' + (s.kind === 'quiz' ? '🏆 Phone quiz' : '📡 Live class') + ' · ' + fmtD(s.started) + ' · ' + fmtT(s.started) + '–' + fmtT(s.ended) + ' · ' + dur(s.ended - s.started) + '</div></div>' +
    '<div class="rp-acts"><button class="btn sm primary" id="rpXlsx">' + icon('download') + 'Excel (.xlsx)</button><button class="btn sm" id="rpCsv">' + icon('table') + 'CSV for Power BI</button><button class="btn sm" id="rpPdf">' + icon('file-down') + 'PDF report</button><button class="btn sm" id="rpSave">' + icon('save') + 'Save report file</button><button class="btn sm" id="rpDel" title="Delete this report">' + icon('trash-2') + '</button></div></div>' +
    '<div class="kpis">' + kpi('Students', st.students.length, s.kind === 'quiz' ? 'played' : 'took part', '#22D3EE') + kpi(s.kind === 'quiz' ? 'Questions' : 'Activities', s.activities.length, gradableN ? gradableN + ' with a right answer' : '', '#B197FC') +
      kpi('Participation', st.participation == null ? '—' : st.participation + '%', 'answers given / possible', '#4ADE80') + kpi('Accuracy', st.accuracy == null ? '—' : st.accuracy + '%', st.accuracy == null ? 'no marked questions' : 'on marked questions', '#FF5FA2') +
      kpi('On time', st.onTime == null ? '—' : st.onTime + '%', 'before the time limit', '#FFC928') + (s.kind === 'quiz' ? kpi('Top score', Math.max(0, ...Object.values(s.scores || {})), (st.students.slice().sort((a, b) => b.score - a.score)[0] || {}).name || '', '#FF9F5A') : kpi('Stars', st.stars, 'awarded', '#FF9F5A')) + '</div>' +
    '<div class="tabs">' + [['overview', 'Overview'], ['students', 'Students'], ['activities', s.kind === 'quiz' ? 'Questions' : 'Activities']].map(([k, l]) => '<button data-t="' + k + '" class="' + (R.tab === k ? 'on' : '') + '">' + l + '</button>').join('') + '</div>' +
    '<div id="rpBody"></div>';
  const t = m.querySelector('#rpTitle'); t.onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); t.blur(); } }; t.onblur = async () => { const v = t.textContent.trim().slice(0, 80); if (v && v !== s.title) { s.title = v; await saveSession(s); renderSide(); toast('Renamed.'); } };
  $$('.tabs button', m).forEach(b => b.onclick = () => { R.tab = b.dataset.t; set.put('rpTab', R.tab); renderMain(); });
  m.querySelector('#rpXlsx').onclick = () => exportXlsx(s); m.querySelector('#rpCsv').onclick = () => exportCsv(s); m.querySelector('#rpPdf').onclick = () => exportPdf(s); m.querySelector('#rpSave').onclick = () => saveFile(s);
  m.querySelector('#rpDel').onclick = async () => { if (!confirm('Delete the report “' + s.title + '”? This cannot be undone.')) return; await deleteSession(s.id); R.cur = null; if (R.index[0]) await select(R.index[0].id); else render(); toast('Report deleted.'); };
  const body = m.querySelector('#rpBody');
  if (R.tab === 'students') body.innerHTML = studentsHTML(s, st); else if (R.tab === 'activities') body.innerHTML = activitiesHTML(s, st); else body.innerHTML = overviewHTML(s, st);
  $$('th[data-s]', body).forEach(th => th.onclick = () => { const k = th.dataset.s; R.sort = [k, R.sort[0] === k ? -R.sort[1] : (k === 'name' ? 1 : -1)]; renderMain(); });
  $$('[data-stu]', body).forEach(x => x.onclick = () => studentCard(s, st, x.dataset.stu));
  if (window.gsap && !REDUCE) gsap.from($$('.kpi,.card', m), { y: 8, opacity: 0, duration: 0.25, stagger: 0.02 }); }

/* overview: participation and accuracy charts, accuracy bands, who needs attention */
const accClass = v => v == null ? '' : v >= 80 ? 'a-hi' : v >= 50 ? 'a-md' : 'a-lo';
const bar = (label, v, color, right) => '<div class="hb"><span class="l" title="' + esc(label) + '">' + esc(label) + '</span><span class="t"><i style="width:' + (v || 0) + '%;background:' + color + '"></i></span><b>' + (right != null ? right : v == null ? '—' : v + '%') + '</b></div>';
const short = (a, i) => (i + 1) + '. ' + (a.prompt || TYPE[a.type][1]);
function overviewHTML(s, st) {
  const part = st.acts.map((x, i) => bar(short(x.a, i), x.participation, 'linear-gradient(90deg,#4ADE80,#22D3EE)')).join('') || '<div class="muted small">No activities.</div>';
  const acc = st.acts.map((x, i) => [x, i]).filter(([x]) => x.accuracy != null).map(([x, i]) => bar(short(x.a, i), x.accuracy, x.accuracy >= 80 ? '#2F9E44' : x.accuracy >= 50 ? '#E8A400' : '#E03131')).join('');
  const withAcc = st.students.filter(x => x.accuracy != null), bands = [['80–100%', withAcc.filter(x => x.accuracy >= 80).length, '#2F9E44'], ['50–79%', withAcc.filter(x => x.accuracy >= 50 && x.accuracy < 80).length, '#E8A400'], ['Below 50%', withAcc.filter(x => x.accuracy < 50).length, '#E03131']];
  const need = st.students.slice().sort((a, b) => ((a.accuracy == null ? 101 : a.accuracy) - (b.accuracy == null ? 101 : b.accuracy)) || (a.participation - b.participation)).filter(x => (x.accuracy != null && x.accuracy < 60) || x.participation < 60).slice(0, 8);
  const top = st.students.slice().sort((a, b) => (s.kind === 'quiz' ? b.score - a.score : 0) || ((b.accuracy || 0) - (a.accuracy || 0)) || (b.participation - a.participation) || (b.stars - a.stars)).slice(0, 5);
  return '<div class="grid2"><div class="card"><h3>' + icon('users') + 'Participation by ' + (s.kind === 'quiz' ? 'question' : 'activity') + '</h3>' + part + '</div>' +
    '<div class="card"><h3>' + icon('circle-check') + 'Accuracy by question</h3>' + (acc || '<div class="muted small">No marked questions yet — give a poll a right answer to see accuracy.</div>') + '</div>' +
    '<div class="card"><h3>' + icon('chart-column-big') + 'Class accuracy</h3>' + (withAcc.length ? '<div class="donut">' + donut(bands) + '<div class="legend">' + bands.map(([l, n, c]) => '<div><i style="background:' + c + '"></i>' + l + ' · <b>' + n + '</b> student' + (n === 1 ? '' : 's') + '</div>').join('') + '</div></div>' : '<div class="muted small">Appears when a poll or quiz has a right answer.</div>') + '</div>' +
    '<div class="card"><h3>' + icon('triangle-alert') + 'Needs attention</h3>' + (need.length ? need.map(x => '<div class="who" data-stu="' + esc(x.name) + '" style="cursor:pointer"><span>' + esc(x.name) + '</span><span>' + (x.accuracy != null ? '<span class="acc ' + accClass(x.accuracy) + '">' + x.accuracy + '%</span> ' : '') + '<span class="pill">' + x.answered + '/' + s.activities.length + ' answered</span></span></div>').join('') : '<div class="muted small">Everyone answered and did well. 🎉</div>') + '</div>' +
    '<div class="card"><h3>' + icon('trophy') + (s.kind === 'quiz' ? 'Top scores' : 'Top students') + '</h3>' + top.map((x, i) => '<div class="who" data-stu="' + esc(x.name) + '" style="cursor:pointer"><span>' + ['🥇', '🥈', '🥉', '4.', '5.'][i] + ' ' + esc(x.name) + '</span><span>' + (s.kind === 'quiz' ? '<span class="pill">' + x.score + ' pts</span>' : (x.accuracy != null ? '<span class="acc ' + accClass(x.accuracy) + '">' + x.accuracy + '%</span> ' : '') + (x.stars ? '<span class="pill">★ ' + x.stars + '</span>' : '')) + '</span></div>').join('') + '</div></div>'; }
function donut(parts) { const tot = parts.reduce((a, p) => a + p[1], 0) || 1, R0 = 52, r = 34; let a0 = -Math.PI / 2, d = '';
  parts.forEach(([, n, c]) => { if (!n) return; const a1 = a0 + n / tot * Math.PI * 2, big = a1 - a0 > Math.PI ? 1 : 0, p = (rr, a) => (60 + rr * Math.cos(a)).toFixed(2) + ' ' + (60 + rr * Math.sin(a)).toFixed(2);
    d += n === tot ? '<circle cx="60" cy="60" r="' + (R0 + r) / 2 + '" fill="none" stroke="' + c + '" stroke-width="' + (R0 - r) + '"/>' : '<path d="M' + p(R0, a0) + ' A' + R0 + ' ' + R0 + ' 0 ' + big + ' 1 ' + p(R0, a1) + ' L' + p(r, a1) + ' A' + r + ' ' + r + ' 0 ' + big + ' 0 ' + p(r, a0) + 'Z" fill="' + c + '"/>'; a0 = a1; });
  return '<svg viewBox="0 0 120 120" width="150" height="150">' + d + '</svg>'; }
/* the student grid: one row per student, one coloured cell per activity (Wayground-style) */
function studentsHTML(s, st) { const [k, dir] = R.sort; const rows = st.students.slice().sort((a, b) => { const va = a[k], vb = b[k]; if (k === 'name') return dir * va.localeCompare(vb); return dir * ((va == null ? -1 : va) - (vb == null ? -1 : vb)); });
  const sym = { ok: '✓', bad: '✗', done: '●', miss: '—' }, arrow = key => R.sort[0] === key ? (R.sort[1] > 0 ? ' ▲' : ' ▼') : '';
  return '<div class="small muted" style="margin-bottom:8px">✓ right · ✗ wrong · ● answered · — no answer · ⏰ handed in at time-up · click a name for all their answers</div><div class="tw"><table class="st"><thead><tr><th data-s="name">Student' + arrow('name') + '</th>' + (s.kind === 'quiz' ? '<th data-s="score">Score' + arrow('score') + '</th>' : '') + '<th data-s="participation">Participation' + arrow('participation') + '</th><th data-s="accuracy">Accuracy' + arrow('accuracy') + '</th>' + (s.kind === 'quiz' ? '' : '<th data-s="stars">Stars' + arrow('stars') + '</th>') +
    s.activities.map((a, i) => '<th class="q" title="' + esc(short(a, i)) + '">' + (i + 1) + '</th>').join('') + '</tr></thead><tbody>' +
    rows.map(x => '<tr><td><a href="#" data-stu="' + esc(x.name) + '" style="color:var(--ink);font-weight:700;text-decoration:none">' + esc(x.name) + '</a></td>' + (s.kind === 'quiz' ? '<td><b>' + x.score + '</b></td>' : '') + '<td>' + x.answered + '/' + s.activities.length + ' · ' + (x.participation == null ? '—' : x.participation + '%') + '</td><td>' + (x.accuracy == null ? '—' : '<span class="acc ' + accClass(x.accuracy) + '">' + x.accuracy + '%</span>') + '</td>' + (s.kind === 'quiz' ? '' : '<td>' + (x.stars ? '★ ' + x.stars : '') + '</td>') +
      x.cells.map((c, i) => '<td class="c"><span class="cell c-' + c.st + '" title="' + esc(short(s.activities[i], i)) + (c.r ? ' — ' + esc(answerText(s.activities[i], c.r)) : '') + '">' + sym[c.st] + (c.r && c.r.late ? '<small style="font-size:9px">⏰</small>' : '') + '</span></td>').join('') + '</tr>').join('') + '</tbody></table></div>'; }
function answerText(a, r) { const v = r.value; const cf = r.conf != null ? ' (' + ['guessing', 'think so', 'sure'][r.conf] + ')' : '';
  if (a.type === 'order') return (Array.isArray(v) ? v.map((k, i) => (i + 1) + '. ' + (a.options[k] || '?')).join('  ') : '') + cf;
  if (a.type === 'pin') return Array.isArray(v) ? 'tapped at ' + Math.round(v[0] * 100) + '%, ' + Math.round(v[1] * 100) + '%' + (a.graded ? (r.ok ? ' (on target)' : ' (off target)') : '') : '';
  if (a.type === 'poll' && cf) return v == null ? '' : 'ABCDEF'[v] + ') ' + (a.options[v] || '') + cf;
  if (a.type === 'poll') return v == null ? '' : 'ABCDEF'[v] + ') ' + (a.options[v] || ''); if (a.type === 'word') return (v || []).join(', '); if (a.type === 'notes') return (v || []).join(' | '); if (a.type === 'draw') return '(drawing)'; if (a.type === 'image') return '(photo)'; return String(v == null ? '' : v); }
/* per activity: what the class answered */
function activitiesHTML(s, st) { return st.acts.map((x, i) => { const a = x.a, ty = TYPE[a.type] || TYPE.poll; let body = '';
    if (a.type === 'poll') { const counts = a.options.map((_, k) => a.responses.filter(r => r.value === k).length), mx = Math.max(1, ...counts); body = a.options.map((o, k) => bar(('ABCDEF'[k]) + ') ' + o + (a.correct === k ? ' ✓' : ''), Math.round(counts[k] / mx * 100), a.correct === k ? '#2F9E44' : POLL_C[k], counts[k] + ' · ' + (pct(counts[k], x.n) || 0) + '%')).join(''); }
    else if (a.type === 'word') { const f = new Map(); a.responses.forEach(r => (r.value || []).forEach(w => { const k = w.toLowerCase(); f.set(k, (f.get(k) || 0) + 1); })); const top = [...f.entries()].sort((p, q) => q[1] - p[1]).slice(0, 12), mx = top.length ? top[0][1] : 1; body = top.map(([w, n]) => bar(w, Math.round(n / mx * 100), '#B197FC', n)).join('') || '<div class="muted small">No words.</div>'; }
    else if (a.type === 'order') { body = a.options.map((o, k) => { const n = a.responses.filter(r => Array.isArray(r.value) && r.value[k] === k).length; return bar((k + 1) + '. ' + o, pct(n, x.n) || 0, '#2F9E44', (pct(n, x.n) || 0) + '% placed it here'); }).join(''); }
    else if (a.type === 'pin') body = (a.thumb ? '<div style="position:relative;max-width:520px"><img src="' + a.thumb + '" style="width:100%;border-radius:10px;display:block;background:#fff">' + a.responses.filter(r => Array.isArray(r.value)).map(r => '<span title="' + esc(r.name) + '" style="position:absolute;left:' + (r.value[0] * 100) + '%;top:' + (r.value[1] * 100) + '%;width:12px;height:12px;margin:-6px 0 0 -6px;border-radius:50%;background:' + (a.graded ? (r.ok ? '#2F9E44' : '#E03131') : '#FF5FA2') + ';border:2px solid #fff"></span>').join('') + '</div>' : '') + '<div class="answers">' + a.responses.map(r => '<div><b>' + esc(r.name) + '</b>' + esc(answerText(a, r)) + '</div>').join('') + '</div>';
    else if (a.type === 'draw' || a.type === 'image') body = '<div class="thumbs">' + a.responses.map(r => '<figure>' + (r.thumb ? '<img src="' + r.thumb + '" alt="">' : '<div style="aspect-ratio:4/3;display:grid;place-items:center;color:#888">—</div>') + '<figcaption>' + esc(r.name) + (r.late ? ' ⏰' : '') + '</figcaption></figure>').join('') + '</div>';
    else body = '<div class="answers">' + a.responses.map(r => '<div><b>' + esc(r.name) + (r.late ? ' ⏰' : '') + '</b>' + esc(answerText(a, r)) + '</div>').join('') + '</div>';
    if (!x.n) body = '<div class="muted small">No answers.</div>';
    const missing = st.students.filter(stu => !a.responses.some(r => r.name === stu.name)).map(stu => stu.name);
    return '<div class="card acard"><div class="meta"><span class="pill">' + (i + 1) + '</span><span class="pill">' + icon(ty[0]).replace('<svg', '<svg style="width:13px;height:13px;vertical-align:-2px"') + ' ' + (a.quiz ? 'Quiz question' : ty[1]) + '</span><span class="pill">' + x.n + '/' + st.students.length + ' answered</span>' + (x.accuracy != null ? '<span class="acc ' + accClass(x.accuracy) + '">' + x.accuracy + '% right</span>' : '') + (x.late ? '<span class="pill">⏰ ' + x.late + ' at time-up</span>' : '') + (a.once === false ? '<span class="pill">📡 Live</span>' : '') + '</div><div class="p">' + esc(a.prompt || ty[1]) + '</div>' + body +
      (missing.length ? '<div class="small muted" style="margin-top:10px">No answer: ' + missing.map(esc).join(', ') + '</div>' : '') + '</div>'; }).join('') || '<div class="muted">No activities in this report.</div>'; }
function studentCard(s, st, name) { const x = st.students.find(y => y.name === name); if (!x) return;
  modal.open('<h2>' + icon('user') + ' ' + esc(name) + '</h2><div class="row" style="gap:8px;flex-wrap:wrap;margin-bottom:10px"><span class="st-tag">' + x.answered + '/' + s.activities.length + ' answered</span>' + (x.accuracy != null ? '<span class="st-tag">' + x.accuracy + '% right</span>' : '') + (x.stars ? '<span class="st-tag">★ ' + x.stars + '</span>' : '') + (s.kind === 'quiz' ? '<span class="st-tag">' + x.score + ' points</span>' : '') + '</div>' +
    s.activities.map((a, i) => { const c = x.cells[i]; return '<div style="display:flex;gap:10px;align-items:flex-start;padding:8px 0;border-bottom:1px solid var(--line)"><span style="width:26px;font-weight:800;color:var(--muted)">' + (i + 1) + '</span><div style="flex:1;min-width:0"><div style="font-weight:700">' + esc(a.prompt || TYPE[a.type][1]) + '</div><div style="margin-top:3px;color:' + (c.st === 'ok' ? 'var(--ok)' : c.st === 'bad' ? 'var(--bad)' : 'var(--muted)') + '">' + (c.r ? (c.st === 'ok' ? '✓ ' : c.st === 'bad' ? '✗ ' : '') + esc(answerText(a, c.r)) + (c.r.late ? ' ⏰' : '') : 'No answer') + (c.st === 'bad' && Number.isInteger(a.correct) ? ' <span class="muted">· right: ' + esc('ABCDEF'[a.correct] + ') ' + a.options[a.correct]) + '</span>' : '') + '</div>' + (c.r && c.r.thumb ? '<img src="' + c.r.thumb + '" style="max-width:220px;border-radius:8px;margin-top:6px;background:#fff">' : '') + '</div></div>'; }).join('') + '<div class="foot"><button class="btn primary" data-close>Close</button></div>'); }

/* ---------- exports ---------- */
function rows(s) { const st = stats(s), out = [];
  s.activities.forEach((a, i) => st.students.forEach(stu => { const r = a.responses.find(x => x.name === stu.name);
    out.push({ Session: s.title, Date: new Date(s.started).toISOString().slice(0, 10), Kind: s.kind === 'quiz' ? 'Phone quiz' : 'Live class', 'Activity #': i + 1, 'Activity type': a.quiz ? 'Quiz question' : TYPE[a.type][1], Prompt: a.prompt || '', Student: stu.name, Answered: r ? 'Yes' : 'No', Answer: r ? answerText(a, r) : '', Correct: gradable(a) && r ? (isRight(a, r) ? 'Yes' : 'No') : '', Confidence: r && r.conf != null ? ['Guessing', 'Think so', 'Sure'][r.conf] : '', Team: r && r.team ? r.team : '', 'Handed in at time-up': r && r.late ? 'Yes' : '', 'Answer time': r && r.at ? new Date(r.at).toLocaleTimeString() : (r && r.ms ? (r.ms / 1000).toFixed(1) + ' s' : '') }); }));
  return out; }
const fileBase = s => (s.title + ' ' + new Date(s.started).toISOString().slice(0, 10)).replace(/[\\/:*?"<>|]+/g, '-');
function download(name, data, type) { const a = document.createElement('a'); a.href = URL.createObjectURL(data instanceof Blob ? data : new Blob([data], { type })); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 5000); }
/* one tidy table (one row per student per activity) — the shape Power BI and Excel pivot tables like best */
function exportCsv(s) { const rs = rows(s); if (!rs.length) { toast('Nothing to export yet.'); return; } const cols = Object.keys(rs[0]), cell = v => '"' + String(v).replace(/"/g, '""') + '"';
  download(fileBase(s) + ' - data.csv', '﻿' + [cols.map(cell).join(',')].concat(rs.map(r => cols.map(c => cell(r[c])).join(','))).join('\r\n'), 'text/csv'); SND.done && SND.done(); toast('Saved the data table — open it in Power BI (Get data → Text/CSV) or Excel.'); }
/* a real .xlsx workbook (Summary, Students, Activities, Responses), written with a tiny zip writer — no library needed */
function exportXlsx(s) { const st = stats(s);
  const summary = [['HelixBoard report', s.title], ['Kind', s.kind === 'quiz' ? 'Phone quiz' : 'Live class'], ['Date', fmtD(s.started)], ['Time', fmtT(s.started) + ' – ' + fmtT(s.ended)], ['Students', st.students.length], [s.kind === 'quiz' ? 'Questions' : 'Activities', s.activities.length], ['Participation %', st.participation == null ? '' : st.participation], ['Accuracy %', st.accuracy == null ? '' : st.accuracy], ['On time %', st.onTime == null ? '' : st.onTime], ['Stars awarded', st.stars]];
  const students = [['Student'].concat(s.kind === 'quiz' ? ['Score'] : [], ['Answered', 'Participation %', 'Accuracy %', 'Stars', 'Handed in at time-up'], s.activities.map((a, i) => 'A' + (i + 1)))].concat(st.students.map(x => [x.name].concat(s.kind === 'quiz' ? [x.score] : [], [x.answered, x.participation == null ? '' : x.participation, x.accuracy == null ? '' : x.accuracy, x.stars, x.late], x.cells.map((c, i) => c.r ? (c.st === 'ok' ? '✓ ' : c.st === 'bad' ? '✗ ' : '') + answerText(s.activities[i], c.r) : ''))));
  const acts = [['#', 'Type', 'Prompt', 'Answered', 'Participation %', 'Accuracy %', 'Right answer', 'Handed in at time-up', 'Mode']].concat(st.acts.map((x, i) => [i + 1, x.a.quiz ? 'Quiz question' : TYPE[x.a.type][1], x.a.prompt || '', x.n, x.participation == null ? '' : x.participation, x.accuracy == null ? '' : x.accuracy, gradable(x.a) ? (x.a.type === 'order' ? x.a.options.join(' → ') : Number.isInteger(x.a.correct) ? 'ABCDEF'[x.a.correct] + ') ' + x.a.options[x.a.correct] : 'target area') : '', x.late, x.a.once === false ? 'Live' : 'Submit once']));
  const rs = rows(s), cols = rs.length ? Object.keys(rs[0]) : [], resp = [cols].concat(rs.map(r => cols.map(c => r[c])));
  download(fileBase(s) + '.xlsx', xlsx([['Summary', summary], ['Students', students], ['Activities', acts], ['Responses', resp]]));
  SND.done && SND.done(); toast('Saved an Excel workbook with 4 sheets: Summary, Students, Activities and Responses.'); }
function printLayout(s) { document.body.classList.add('rp-print'); document.documentElement.classList.add('rp-print'); const body = R.el.querySelector('#rpBody'), st = stats(s); body.innerHTML = '<div class="rp-sec">' + overviewHTML(s, st) + '</div><div class="rp-sec"><h2 style="font:800 20px var(--head)">Students</h2>' + studentsHTML(s, st) + '</div><div class="rp-sec"><h2 style="font:800 20px var(--head)">' + (s.kind === 'quiz' ? 'Questions' : 'Activities') + '</h2>' + activitiesHTML(s, st) + '</div>'; }
/* the PDF holds every view one after another */
async function exportPdf(s) { const was = R.tab; printLayout(s);
  try { if (window.helixDesktop && helixDesktop.printPdf) { const r = await helixDesktop.printPdf(fileBase(s) + '.pdf'); if (r && r.ok) toast('Saved the PDF report.'); else if (r && r.error) toast(r.error); } else window.print(); }
  finally { document.body.classList.remove('rp-print'); document.documentElement.classList.remove('rp-print'); R.tab = was; renderMain(); } }
function saveFile(s) { download(fileBase(s) + '.hbreport', JSON.stringify({ app: 'HelixBoard', kind: 'report', report: s }), 'application/json'); toast('Saved the report file — a colleague can open it in HelixBoard → Reports.'); }
function openFile() { const inp = document.createElement('input'); inp.type = 'file'; inp.accept = '.hbreport,application/json'; inp.onchange = () => inp.files[0] && readFile(inp.files[0]); inp.click(); }
async function readFile(f) { let d; try { d = JSON.parse(await f.text()); } catch (e) { toast('That is not a report file.'); return; } const s = d && d.kind === 'report' && d.report; if (!s || !Array.isArray(s.activities)) { toast('That is not a report file.'); return; }
  s.id = 'f' + Date.now().toString(36); s.title = String(s.title || 'Imported report').slice(0, 80); s.roster = Array.isArray(s.roster) ? s.roster.map(String) : []; s.stars = s.stars || {};
  s.activities = s.activities.filter(a => a && TYPE[a.type] && Array.isArray(a.responses)).map(a => Object.assign(a, { responses: a.responses.filter(r => r && typeof r.name === 'string').map(r => Object.assign(r, { thumb: typeof r.thumb === 'string' && /^data:image\/(jpeg|png|webp);base64,/.test(r.thumb) ? r.thumb : null })) }));
  await saveSession(s); await select(s.id); toast('Opened “' + esc(s.title) + '”.'); }

/* ---------- a minimal .xlsx writer: SpreadsheetML in a zip with stored (uncompressed) entries ---------- */
const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return b => { let c = 0xFFFFFFFF; for (let i = 0; i < b.length; i++) c = t[(c ^ b[i]) & 0xFF] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }; })();
function zip(files) { const enc = new TextEncoder(), parts = [], cdir = []; let off = 0;
  files.forEach(([name, text]) => { const nb = enc.encode(name), data = enc.encode(text), crc = CRC(data), h = new DataView(new ArrayBuffer(30));
    h.setUint32(0, 0x04034b50, true); h.setUint16(4, 20, true); h.setUint16(6, 0x0800, true); h.setUint16(8, 0, true); h.setUint32(14, crc, true); h.setUint32(18, data.length, true); h.setUint32(22, data.length, true); h.setUint16(26, nb.length, true);
    parts.push(new Uint8Array(h.buffer), nb, data);
    const c = new DataView(new ArrayBuffer(46)); c.setUint32(0, 0x02014b50, true); c.setUint16(4, 20, true); c.setUint16(6, 20, true); c.setUint16(8, 0x0800, true); c.setUint32(16, crc, true); c.setUint32(20, data.length, true); c.setUint32(24, data.length, true); c.setUint16(28, nb.length, true); c.setUint32(42, off, true);
    cdir.push(new Uint8Array(c.buffer), nb); off += 30 + nb.length + data.length; });
  const size = cdir.reduce((a, b) => a + b.length, 0), e = new DataView(new ArrayBuffer(22)); e.setUint32(0, 0x06054b50, true); e.setUint16(8, files.length, true); e.setUint16(10, files.length, true); e.setUint32(12, size, true); e.setUint32(16, off, true);
  return new Blob(parts.concat(cdir, [new Uint8Array(e.buffer)]), { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }); }
function xlsx(sheets) { const x = v => String(v).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '');
  const col = i => { let s = ''; i++; while (i) { const m = (i - 1) % 26; s = String.fromCharCode(65 + m) + s; i = Math.floor((i - 1) / 26); } return s; };
  const sheetXml = data => '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><cols><col min="1" max="1" width="26" customWidth="1"/><col min="2" max="60" width="16" customWidth="1"/></cols><sheetData>' +
    data.map((r, ri) => '<row r="' + (ri + 1) + '">' + r.map((v, ci) => { const ref = col(ci) + (ri + 1), st = ri === 0 ? ' s="1"' : ''; return typeof v === 'number' && isFinite(v) ? '<c r="' + ref + '"' + st + '><v>' + v + '</v></c>' : v === '' || v == null ? '' : '<c r="' + ref + '" t="inlineStr"' + st + '><is><t xml:space="preserve">' + x(v) + '</t></is></c>'; }).join('') + '</row>').join('') + '</sheetData>' + (data.length > 1 && data[0].length > 1 ? '<autoFilter ref="A1:' + col(data[0].length - 1) + data.length + '"/>' : '') + '</worksheet>';
  const files = [['[Content_Types].xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' + sheets.map((_, i) => '<Override PartName="/xl/worksheets/sheet' + (i + 1) + '.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>').join('') + '</Types>'],
    ['_rels/.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>'],
    ['xl/workbook.xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>' + sheets.map(([n], i) => '<sheet name="' + x(n) + '" sheetId="' + (i + 1) + '" r:id="rId' + (i + 1) + '"/>').join('') + '</sheets></workbook>'],
    ['xl/_rels/workbook.xml.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' + sheets.map((_, i) => '<Relationship Id="rId' + (i + 1) + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet' + (i + 1) + '.xml"/>').join('') + '<Relationship Id="rId' + (sheets.length + 1) + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>'],
    ['xl/styles.xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF8B3FD9"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="1"><border/></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>']];
  sheets.forEach(([, data], i) => files.push(['xl/worksheets/sheet' + (i + 1) + '.xml', sheetXml(data)]));
  return zip(files); }

window.HBRP = { open, close, addActivity, updateLive, addQuiz, stats, remove: id => deleteSession(id), _xlsx: xlsx, _printLayout: () => R.cur && printLayout(R.cur), _endPrint: () => { document.body.classList.remove('rp-print'); document.documentElement.classList.remove('rp-print'); renderMain(); }, get on() { return !!(R.el && !R.el.hidden); } };
})();
