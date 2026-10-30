/* ================= HelixBoard — test dashboard: every answer, analysed (like a Power BI report for one test) =================
   Overview: key numbers, score distribution, accuracy by question and by type, performance bands and plain-language insights.
   Questions: item analysis (difficulty, discrimination, the most common wrong answer) with a drill-down for every question.
   Students: a heat map of every student against every question; open a paper to see it and change any mark.
   Live while the test runs; saved with the test afterwards; exported to Excel. */
(() => {
'use strict';
const { $, $$, esc, icon, toast, modal, REDUCE } = window.HB;
const D = () => window.helixDesktop && window.helixDesktop.cl;
const G = () => window.HBGrade;
const C = { blue: '#3987e5', good: '#0ca30c', warn: '#fab219', bad: '#d03b3b', none: '#8a8794' };
const band = p => p == null ? C.none : p >= 75 ? C.good : p >= 50 ? C.warn : C.bad;
const T = { el: null, test: null, run: null, live: false, tab: 'overview', qsel: 0, sort: 'score', filter: 'all' };

const css = document.createElement('style'); css.textContent = `
#tdStage{position:fixed;inset:0;z-index:49;background:var(--bg);color:var(--ink);display:flex;flex-direction:column;font-family:var(--ui)}
#tdStage .td-top{display:flex;align-items:center;gap:10px;padding:10px 16px;border-bottom:1px solid var(--line);background:linear-gradient(180deg,var(--panel2),var(--panel));flex-wrap:wrap}
#tdStage .td-top h2{margin:0;font:800 19px/1.15 var(--head);max-width:38vw;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
#tdStage .pill{display:inline-flex;align-items:center;gap:6px;padding:4px 11px;border-radius:999px;font-weight:800;font-size:12.5px}
#tdStage .pill.live{background:color-mix(in srgb,${C.good} 22%,transparent);color:#4ADE80} #tdStage .pill.live i{width:8px;height:8px;border-radius:50%;background:#4ADE80;animation:tdP 1.4s infinite}
#tdStage .pill.closed{background:var(--panel2);color:var(--muted)}
@keyframes tdP{50%{opacity:.3}}
#tdStage .td-tabs{display:flex;gap:4px;padding:8px 16px 0;border-bottom:1px solid var(--line);background:var(--panel)}
#tdStage .td-tabs button{border:0;background:transparent;color:var(--muted);font:700 14.5px var(--ui);padding:10px 16px;border-bottom:3px solid transparent;cursor:pointer;display:inline-flex;gap:8px;align-items:center}
#tdStage .td-tabs button svg{width:17px;height:17px} #tdStage .td-tabs button.on{color:var(--ink);border-bottom-color:var(--accent)}
#tdStage .td-body{flex:1;overflow:auto;padding:18px 20px 40px}
#tdStage .kpis{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:12px;margin-bottom:16px}
#tdStage .kpi{background:var(--panel);border:1px solid var(--line);border-radius:14px;padding:14px 16px}
#tdStage .kpi small{display:block;color:var(--muted);font-weight:700;font-size:12px;text-transform:uppercase;letter-spacing:.06em}
#tdStage .kpi b{display:block;font:800 30px/1.15 var(--head);margin-top:6px} #tdStage .kpi span{color:var(--muted);font-size:12.5px}
#tdStage .grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px} @media(max-width:1100px){#tdStage .grid{grid-template-columns:1fr}}
#tdStage .panel{background:var(--panel);border:1px solid var(--line);border-radius:16px;padding:14px 16px;min-width:0}
#tdStage .panel h3{margin:0 0 10px;font:700 14px/1.2 var(--ui);display:flex;align-items:center;gap:8px} #tdStage .panel h3 small{color:var(--muted);font-weight:500;margin-inline-start:auto}
#tdStage .panel.wide{grid-column:1/-1}
#tdStage svg.ch{width:100%;height:auto;display:block;overflow:visible}
#tdStage svg.ch text{fill:var(--muted);font:12px var(--ui)} #tdStage svg.ch .v{fill:var(--ink);font-weight:700}
#tdStage svg.ch .grid line{stroke:var(--line);stroke-width:1} #tdStage svg.ch .hit{fill:transparent;cursor:pointer}
#tdStage svg.ch .hit:hover + .mk,#tdStage svg.ch .mk.hl{filter:brightness(1.2)}
#tdStage .legend{display:flex;gap:14px;flex-wrap:wrap;font-size:12.5px;color:var(--muted);margin-top:8px} #tdStage .legend i{display:inline-block;width:11px;height:11px;border-radius:3px;margin-inline-end:5px;vertical-align:-1px}
#tdStage .ins{margin:0;padding:0;list-style:none} #tdStage .ins li{display:flex;gap:10px;padding:9px 0;border-top:1px solid var(--line);line-height:1.45} #tdStage .ins li:first-child{border-top:0}
#tdStage .ins li svg{width:18px;height:18px;flex:none;margin-top:2px}
#tdStage table.t{width:100%;border-collapse:collapse;font-size:13.5px} #tdStage table.t th{text-align:start;color:var(--muted);font-weight:700;font-size:12px;text-transform:uppercase;letter-spacing:.04em;padding:8px;border-bottom:1px solid var(--line);position:sticky;top:0;background:var(--panel);cursor:pointer;white-space:nowrap}
#tdStage table.t td{padding:8px;border-bottom:1px solid var(--line);vertical-align:middle} #tdStage table.t tr.sel td{background:color-mix(in srgb,var(--accent) 10%,transparent)} #tdStage table.t tbody tr{cursor:pointer} #tdStage table.t tbody tr:hover td{background:var(--panel2)}
#tdStage .bar{height:8px;border-radius:4px;background:var(--panel2);overflow:hidden;min-width:70px} #tdStage .bar i{display:block;height:100%;border-radius:4px}
#tdStage .hm{display:grid;gap:3px;align-items:center} #tdStage .hm .c{height:26px;border-radius:5px;display:grid;place-items:center;font-size:12px;font-weight:800;color:#fff;cursor:pointer}
#tdStage .hm .n{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;padding-inline-end:8px;font-weight:600;cursor:pointer} #tdStage .hm .h{font:700 11.5px var(--mono);color:var(--muted);text-align:center}
#tdStage .split{display:grid;grid-template-columns:minmax(0,1.25fr) minmax(0,1fr);gap:14px} @media(max-width:1100px){#tdStage .split{grid-template-columns:1fr}}
#tdStage .ans{display:flex;gap:10px;align-items:flex-start;padding:8px 0;border-top:1px solid var(--line)} #tdStage .ans:first-child{border-top:0} #tdStage .ans .w{flex:1;white-space:pre-wrap}
#tdStage .ans input{width:70px;background:var(--panel2);border:1px solid var(--line);border-radius:8px;color:var(--ink);padding:5px 7px;font:inherit}
#tdStage .tag{display:inline-block;padding:2px 8px;border-radius:999px;font-size:11.5px;font-weight:800}
#tdStage .prog{display:grid;grid-template-columns:minmax(120px,220px) 1fr 60px;gap:10px;align-items:center;font-size:13px;margin:5px 0}
#tdTip{position:fixed;z-index:60;pointer-events:none;background:var(--panel2);color:var(--ink);border:1px solid var(--line);border-radius:10px;padding:8px 11px;font:13px/1.4 var(--ui);box-shadow:0 10px 30px -10px rgba(0,0,0,.5);max-width:320px;white-space:pre-line}
`; document.head.appendChild(css);

/* ---------- numbers ---------- */
function stats() {
  const t = T.test, r = T.run, qs = t.questions, papers = (r.papers || []).filter(p => T.filter === 'all' || (T.filter === 'done' ? p.done : !p.done));
  const done = (r.papers || []).filter(p => p.done), pass = t.settings.pass != null ? t.settings.pass : 50;
  const marks = papers.map(p => Object.assign({}, p, { m: G().mark(t, qs.map((q, i) => p.ans[i]), qs.map((q, i) => (p.tries || {})[i] || 0), window.HBQB.overOf(r.over, p.pid)) }));
  const fin = marks.filter(p => p.done), pcts = fin.map(p => p.m.pct).sort((a, b) => a - b);
  const median = pcts.length ? (pcts.length % 2 ? pcts[(pcts.length - 1) / 2] : (pcts[pcts.length / 2 - 1] + pcts[pcts.length / 2]) / 2) : null;
  const sorted = fin.slice().sort((a, b) => b.m.pct - a.m.pct), k = Math.max(1, Math.round(sorted.length * 0.27)), top = sorted.slice(0, k), low = sorted.slice(-k);
  const items = qs.map((q, i) => { const per = fin.map(p => p.m.per[i]), scored = per.filter(x => !x.unscored);
    const mean = scored.length ? scored.reduce((s, x) => s + (x.score || 0), 0) / scored.length : null;
    const avg = a => { const v = a.map(p => p.m.per[i]).filter(x => !x.unscored); return v.length ? v.reduce((s, x) => s + (x.score || 0), 0) / v.length : 0; };
    const disc = sorted.length >= 4 && scored.length ? avg(top) - avg(low) : null;
    const counts = new Map(); fin.forEach(p => { const v = p.ans[i]; const key = v == null ? '—' : JSON.stringify(v); const e = counts.get(key) || { v, n: 0, names: [], ok: null }; e.n++; e.names.push(p.name); e.ok = p.m.per[i].ok; counts.set(key, e); });
    const wrong = [...counts.values()].filter(e => e.ok === false && e.v != null).sort((a, b) => b.n - a.n)[0] || null;
    const need = fin.filter(p => p.m.per[i].unscored && p.ans[i] != null).length;
    return { i, q, pct: mean == null ? null : Math.round(mean * 100), disc, wrong, counts, blank: fin.filter(p => p.ans[i] == null).length, need, unscored: scored.length === 0 && per.length > 0 }; });
  const types = {}; items.forEach(it => { if (it.pct == null) return; const e = types[it.q.type] || (types[it.q.type] = { s: 0, n: 0 }); e.s += it.pct; e.n++; });
  const avgMs = fin.length ? fin.reduce((s, p) => s + (p.ms || 0), 0) / fin.length : 0;
  return { marks, fin, done, pcts, median, items, types, avgMs, pass, avg: pcts.length ? pcts.reduce((a, b) => a + b, 0) / pcts.length : null, passN: pcts.filter(p => p >= pass).length, joined: (r.papers || []).length };
}
const mmss = ms => { const s = Math.round((ms || 0) / 1000); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
const TOKR = /⟦m:([a-z0-9]+)⟧/g;
const rich = (text, q) => esc(text == null ? '' : String(text)).replace(TOKR, (m, id) => { const md = q && q.media && q.media[id]; return md ? '<img class="eq" src="' + md.src + '" style="width:' + Math.min(md.w || 200, 320) + 'px" alt="">' : '▣'; });
const plain = s => String(s == null ? '' : s).replace(TOKR, '▣');
const r1 = v => v == null ? '—' : Math.round(v * 10) / 10;
function fmtAns(q, v) { if (v == null || v === '' || (Array.isArray(v) && !v.length)) return '—';
  switch (q.type) { case 'mc': return q.o[v] != null ? 'ABCDEFGH'[v] + '. ' + q.o[v] : '?'; case 'multi': return [].concat(v).map(k => 'ABCDEFGH'[k] + '. ' + q.o[k]).join(' · '); case 'tf': return v ? 'True' : 'False';
    case 'blank': return [].concat(v).join(' · '); case 'match': return q.left.map((l, k) => l + ' → ' + (v[k] != null ? q.right[v[k]] : '?')).join('\n'); case 'order': return v.map(k => q.o[k]).join(' → '); default: return String(v); } }

/* ---------- small SVG charts with a hover tooltip ---------- */
let tip = null; function tipOn(e, txt) { if (!tip) { tip = document.createElement('div'); tip.id = 'tdTip'; document.body.appendChild(tip); } tip.textContent = txt; tip.hidden = false; const w = tip.offsetWidth, h = tip.offsetHeight; tip.style.left = Math.min(innerWidth - w - 8, e.clientX + 14) + 'px'; tip.style.top = Math.max(8, e.clientY - h - 12) + 'px'; }
function tipOff() { if (tip) tip.hidden = true; }
function bindTips(root) { $$('[data-tip]', root).forEach(el => { el.onmousemove = e => tipOn(e, el.dataset.tip); el.onmouseleave = tipOff; }); }
/* vertical bars: [{label, v (0-100 or count), color, tip, click}] */
function vbars(data, opts) { opts = opts || {}; const W = opts.W || 640, H = opts.H || 230, L = 36, B = 30, top = 12, max = opts.max || Math.max(1, ...data.map(d => d.v || 0)), n = Math.max(1, data.length), bw = (W - L) / n, gap = Math.min(8, bw * 0.25);
  const ticks = opts.max === 100 ? [0, 25, 50, 75, 100] : [0, Math.ceil(max / 2), max]; const Y = v => top + (H - B - top) * (1 - v / max);
  let s = '<svg class="ch" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + esc(opts.label || 'chart') + '"><g class="grid">' + ticks.map(t => '<line x1="' + L + '" x2="' + W + '" y1="' + Y(t) + '" y2="' + Y(t) + '"/><text x="' + (L - 6) + '" y="' + (Y(t) + 4) + '" text-anchor="end">' + t + (opts.max === 100 ? '%' : '') + '</text>').join('') + '</g>';
  if (opts.line != null) s += '<line x1="' + L + '" x2="' + W + '" y1="' + Y(opts.line) + '" y2="' + Y(opts.line) + '" stroke="var(--ink)" stroke-dasharray="5 4" stroke-width="1.5" opacity=".6"/><text x="' + (L + 6) + '" y="' + (Y(opts.line) - 5) + '" text-anchor="start">' + esc(opts.lineLabel || '') + '</text>';
  data.forEach((d, i) => { const x = L + i * bw + gap / 2, w = Math.max(2, bw - gap), v = d.v || 0, y = Y(v), h = Math.max(v ? 3 : 0, H - B - y), rr = Math.min(4, w / 2, h);
    s += '<g data-tip="' + esc(d.tip || '') + '"' + (d.click != null ? ' data-k="' + d.click + '"' : '') + '><rect class="hit" x="' + (L + i * bw) + '" y="' + top + '" width="' + bw + '" height="' + (H - B - top) + '"/>' +
      (h ? '<path class="mk" fill="' + (d.color || C.blue) + '" d="M' + x + ',' + (H - B) + 'V' + (y + rr) + 'q0,-' + rr + ' ' + rr + ',-' + rr + 'H' + (x + w - rr) + 'q' + rr + ',0 ' + rr + ',' + rr + 'V' + (H - B) + 'Z"/>' : '') +
      (opts.values && v != null && bw > 22 ? '<text class="v" x="' + (x + w / 2) + '" y="' + (y - 5) + '" text-anchor="middle">' + (d.vl != null ? d.vl : v) + '</text>' : '') +
      (n <= 30 || i % Math.ceil(n / 30) === 0 ? '<text x="' + (x + w / 2) + '" y="' + (H - 10) + '" text-anchor="middle">' + esc(d.label) + '</text>' : '') + '</g>'; });
  return s + '</svg>'; }
/* horizontal bars with labels */
function hbars(data, opts) { opts = opts || {}; const max = opts.max || Math.max(1, ...data.map(d => d.v || 0));
  return '<div>' + data.map(d => '<div class="prog" data-tip="' + esc(d.tip || '') + '"' + (d.click != null ? ' data-k="' + d.click + '" style="cursor:pointer"' : '') + '><span dir="auto" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + (d.mark || '') + esc(d.label) + '</span><div class="bar" style="height:12px"><i style="width:' + ((d.v || 0) / max * 100) + '%;background:' + (d.color || C.blue) + '"></i></div><b style="text-align:end">' + (d.vl != null ? d.vl : d.v) + '</b></div>').join('') + '</div>'; }

/* ---------- the stage ---------- */
async function open(testId, runId, live) {
  const t = await window.HBQB.store.get(testId); if (!t) return toast('That test could not be found.');
  let r = live && window.HBQB.open && window.HBQB.open.id === runId ? await window.HBQB.sync() || window.HBQB.open : await window.HBQB.store.run(runId);
  if (!r) return toast('No results yet.'); T.test = t; T.run = r; T.live = !!(live && window.HBQB.open && window.HBQB.open.id === runId); T.qsel = 0;
  if (!T.el) { const el = document.createElement('div'); el.id = 'tdStage'; el.setAttribute('role', 'dialog'); document.body.appendChild(el); T.el = el;
    el.addEventListener('keydown', e => { if (e.key === 'Escape' && document.getElementById('modal').hidden) { e.stopPropagation(); close(); } });
    if (window.gsap && !REDUCE) gsap.from(el, { opacity: 0, y: 10, duration: 0.22 }); }
  draw();
}
function close() { if (T.el) T.el.remove(); T.el = null; tipOff(); }
function draw() { if (!T.el) return; const t = T.test, r = T.run, live = T.live && r.open;
  const runs = []; window.HBQB.store.index().then(ix => { const e = ix.find(x => x.id === t.id); const sel = T.el && T.el.querySelector('#tdRun'); if (sel && e && e.runs.length > 1) { sel.innerHTML = e.runs.map(x => '<option value="' + x.id + '"' + (x.id === r.id ? ' selected' : '') + '>' + new Date(x.at).toLocaleString([], { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) + (x.cls ? ' · ' + esc(x.cls) : '') + ' · ' + x.n + '</option>').join(''); sel.hidden = false; } });
  T.el.innerHTML = '<div class="td-top"><h2 dir="auto" title="' + esc(t.title) + '">' + esc(t.title) + '</h2>' + (live ? '<span class="pill live"><i></i>Live</span>' : T.live ? '<span class="pill closed">Closed</span>' : '<span class="pill closed">' + new Date(r.at).toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' }) + '</span>') +
    (r.cls ? '<span class="pill closed">' + esc(r.cls) + '</span>' : '') + '<select id="tdRun" hidden class="btn sm" title="Another time this test was given"></select><span style="flex:1"></span>' +
    (T.live ? (r.open ? '<button class="btn sm" id="tdQr">' + icon('qr-code') + 'Join code</button><button class="btn sm" id="tdClose" title="Stop answers: every phone hands in now">' + icon('lock') + 'Close test</button>' : '<button class="btn sm" id="tdReopen">' + icon('lock-open') + 'Reopen</button>') + '<button class="btn sm" id="tdFinish" title="Take the test off the phones; the results stay here">' + icon('square') + 'Finish</button>' : '') +
    '<button class="btn sm" id="tdXlsx">' + icon('sheet') + 'Excel</button><button class="btn sm" id="tdBack">' + icon('arrow-left') + 'Back</button></div>' +
    '<div class="td-tabs">' + [['overview', 'layout-dashboard', 'Overview'], ['questions', 'list-checks', 'Questions'], ['students', 'users', 'Students']].map(([k, ic, n]) => '<button data-t="' + k + '" class="' + (T.tab === k ? 'on' : '') + '">' + icon(ic) + n + '</button>').join('') +
    '<span style="flex:1"></span><select id="tdFilter" class="btn sm" style="margin:4px 0 8px"><option value="all">All students</option><option value="done"' + (T.filter === 'done' ? ' selected' : '') + '>Handed in</option><option value="working"' + (T.filter === 'working' ? ' selected' : '') + '>Still working</option></select></div><div class="td-body" id="tdB"></div>';
  const q = s => T.el.querySelector(s);
  $$('.td-tabs [data-t]', T.el).forEach(b => b.onclick = () => { T.tab = b.dataset.t; draw(); });
  q('#tdFilter').onchange = e => { T.filter = e.target.value; body(); };
  q('#tdBack').onclick = close; q('#tdXlsx').onclick = excel;
  q('#tdRun').onchange = async e => { const rr = await window.HBQB.store.run(e.target.value); if (rr) { T.run = rr; T.live = !!(window.HBQB.open && window.HBQB.open.id === rr.id); draw(); } };
  if (q('#tdQr')) q('#tdQr').onclick = () => window.HBCL && HBCL.bigQr();
  if (q('#tdClose')) q('#tdClose').onclick = async () => { if (!confirm('Close the test now? Every phone hands in what it has.')) return; await D().cmd('testOpen', false); const rr = await window.HBQB.sync(); if (rr) T.run = rr; toast('Test closed — every paper is marked.'); draw(); };
  if (q('#tdReopen')) q('#tdReopen').onclick = async () => { await D().cmd('testOpen', true); const rr = await window.HBQB.sync(); if (rr) T.run = rr; draw(); };
  if (q('#tdFinish')) q('#tdFinish').onclick = async () => { if (!confirm('Finish the test? It leaves the phones; the results stay saved here.')) return; await window.HBQB.stop(); T.live = false; T.run = await window.HBQB.store.run(T.run.id) || T.run; toast('Test finished — results saved.'); draw(); };
  body(); }
function body() { const B = T.el.querySelector('#tdB'), st = stats();
  if (!(T.run.papers || []).length) { B.innerHTML = '<div class="panel" style="text-align:center;padding:40px"><div style="font-size:42px">📱</div><h3 style="justify-content:center;font-size:18px">Waiting for students…</h3><p class="muted">Students in the class link move into the test by themselves. Results appear here the moment answers arrive.</p></div>'; return; }
  if (T.tab === 'overview') overview(B, st); else if (T.tab === 'questions') questions(B, st); else students(B, st);
  bindTips(B); }

function overview(B, st) {
  const t = T.test, qs = t.questions, working = st.marks.filter(p => !p.done);
  const kp = (l, v, sub) => '<div class="kpi"><small>' + l + '</small><b>' + v + '</b>' + (sub ? '<span>' + sub + '</span>' : '') + '</div>';
  const bins = Array.from({ length: 10 }, (_, i) => ({ label: i * 10 + '', v: 0, names: [] })); st.fin.forEach(p => { const k = Math.min(9, Math.floor(p.m.pct / 10)); bins[k].v++; bins[k].names.push(p.name); });
  const bandsN = [['Mastered (80%+)', p => p >= 80, C.good], ['Developing (50–79%)', p => p >= 50 && p < 80, C.warn], ['Needs support (under 50%)', p => p < 50, C.bad]].map(([l, f, c]) => { const ps = st.fin.filter(p => f(p.m.pct)); return { label: l, v: ps.length, color: c, tip: ps.map(p => p.name).join('\n') || 'Nobody' }; });
  const ins = insights(st);
  B.innerHTML = '<div class="kpis">' + kp('Handed in', st.fin.length + '<span style="font-size:18px;color:var(--muted)"> / ' + st.joined + '</span>', working.length ? working.length + ' still working' : 'everyone finished') + kp('Average', st.avg == null ? '—' : Math.round(st.avg) + '%', st.avg == null ? '' : r1(st.fin.reduce((s, p) => s + p.m.got, 0) / Math.max(1, st.fin.length)) + ' of ' + (st.fin[0] ? st.fin[0].m.max : qs.reduce((s, q) => s + (+q.pts || 1), 0)) + ' points') +
    kp('Median', st.median == null ? '—' : Math.round(st.median) + '%', 'half the class scored above') + kp('Highest', st.pcts.length ? Math.round(st.pcts[st.pcts.length - 1]) + '%' : '—', st.pcts.length ? 'lowest ' + Math.round(st.pcts[0]) + '%' : '') +
    kp('Passed', st.pcts.length ? Math.round(st.passN / st.pcts.length * 100) + '%' : '—', st.passN + ' of ' + st.pcts.length + ' at ' + st.pass + '% or more') + kp('Average time', st.fin.length ? mmss(st.avgMs) : '—', t.settings.time ? 'limit ' + t.settings.time + ' min' : 'no time limit') + '</div>' +
    (working.length ? '<div class="panel" style="margin-bottom:14px"><h3>' + icon('loader') + 'Still working <small>' + working.length + ' students</small></h3>' + hbars(working.sort((a, b) => Object.keys(b.ans).length - Object.keys(a.ans).length).slice(0, 40).map(p => { const n = Object.keys(p.ans).length; return { label: p.name, v: n, vl: n + '/' + qs.length, color: p.online === false ? C.none : C.blue, tip: p.name + ': ' + n + ' of ' + qs.length + ' answered' + (p.online === false ? ' (phone not connected)' : '') }; }), { max: qs.length }) + '</div>' : '') +
    '<div class="grid"><div class="panel"><h3>' + icon('chart-column') + 'Score distribution <small>students per 10% band</small></h3>' + vbars(bins.map(b => ({ label: b.label + '%', v: b.v, color: C.blue, tip: b.label + '–' + (+b.label + 9) + '%: ' + b.v + ' student' + (b.v === 1 ? '' : 's') + (b.names.length ? '\n' + b.names.join('\n') : '') })), { values: true, label: 'Score distribution' }) + '</div>' +
    '<div class="panel"><h3>' + icon('lightbulb') + 'Insights</h3><ul class="ins">' + ins.map(x => '<li>' + icon(x[0]) + '<span>' + x[1] + '</span></li>').join('') + '</ul></div>' +
    '<div class="panel wide"><h3>' + icon('chart-no-axes-column') + 'Accuracy by question <small>click a bar for the details</small></h3>' + vbars(st.items.map(it => ({ label: 'Q' + (it.i + 1), v: it.pct == null ? 0 : it.pct, vl: it.pct == null ? '✎' : it.pct, color: band(it.pct), click: it.i, tip: 'Q' + (it.i + 1) + ' · ' + window.HBQB.TYPE[it.q.type][0] + '\n' + it.q.q.slice(0, 120) + '\n' + (it.pct == null ? 'Marked by you' : it.pct + '% correct') + (it.wrong ? '\nMost common wrong answer: ' + fmtAns(it.q, it.wrong.v).slice(0, 60) + ' (' + it.wrong.n + ')' : '') })), { max: 100, values: true, line: st.pass, lineLabel: 'pass ' + st.pass + '%', label: 'Accuracy by question', W: 1280, H: 250 }) +
    '<div class="legend"><span><i style="background:' + C.good + '"></i>75%+ secure</span><span><i style="background:' + C.warn + '"></i>50–74% developing</span><span><i style="background:' + C.bad + '"></i>under 50% reteach</span><span><i style="background:' + C.none + '"></i>✎ marked by you</span></div></div>' +
    '<div class="panel"><h3>' + icon('shapes') + 'Accuracy by question type</h3>' + hbars(Object.entries(st.types).map(([k, e]) => { const v = Math.round(e.s / e.n); return { label: window.HBQB.TYPE[k][0] + ' (' + e.n + ')', v, vl: v + '%', color: band(v), tip: e.n + ' question' + (e.n === 1 ? '' : 's') + ', average ' + v + '% correct' }; }), { max: 100 }) + '</div>' +
    '<div class="panel"><h3>' + icon('users') + 'Performance bands</h3>' + hbars(bandsN, { max: Math.max(1, st.fin.length) }) + '</div></div>';
  $$('[data-k]', B).forEach(g => g.onclick = () => { T.tab = 'questions'; T.qsel = +g.dataset.k; draw(); });
}
function insights(st) {
  const out = [], it = st.items.filter(x => x.pct != null), qn = x => 'Q' + (x.i + 1);
  if (!st.fin.length) return [['hourglass', 'Insights appear when the first papers are handed in.']];
  out.push(['target', 'The class average is <b>' + Math.round(st.avg) + '%</b>; <b>' + st.passN + ' of ' + st.fin.length + '</b> reached the pass mark of ' + st.pass + '%.']);
  if (it.length) { const hard = it.slice().sort((a, b) => a.pct - b.pct)[0], easy = it.slice().sort((a, b) => b.pct - a.pct)[0];
    out.push(['flame', 'Hardest: <b>' + qn(hard) + '</b> (' + hard.pct + '% correct)' + (hard.wrong ? ' — ' + hard.wrong.n + ' chose <b dir="auto">' + esc(fmtAns(hard.q, hard.wrong.v).slice(0, 60)) + '</b>, a likely misconception.' : '.')]);
    if (easy !== hard) out.push(['sparkles', 'Easiest: <b>' + qn(easy) + '</b> (' + easy.pct + '% correct).']);
    const re = it.filter(x => x.pct < 50); if (re.length) out.push(['rotate-ccw', 'Reteach: <b>' + re.map(qn).join(', ') + '</b> — under half the class got ' + (re.length === 1 ? 'it' : 'them') + ' right.']); }
  const low = st.fin.filter(p => p.m.pct < 50); if (low.length) out.push(['life-buoy', 'Needs support: <b dir="auto">' + low.slice(0, 8).map(p => esc(p.name)).join(', ') + (low.length > 8 ? ' +' + (low.length - 8) : '') + '</b>.']);
  const poor = it.filter(x => x.disc != null && x.disc < 0.05 && st.fin.length >= 6); if (poor.length) out.push(['search-check', 'Check the wording or key of <b>' + poor.map(qn).join(', ') + '</b>: strong and weak students did equally well.']);
  const need = st.items.reduce((s, x) => s + x.need, 0); if (need) out.push(['pen-line', '<b>' + need + '</b> written answer' + (need === 1 ? '' : 's') + ' to mark — open Questions.']);
  return out;
}

function questions(B, st) {
  const sel = st.items[T.qsel] || st.items[0];
  B.innerHTML = '<div class="split"><div class="panel" style="overflow:auto;max-height:calc(100vh - 210px)"><table class="t"><thead><tr><th>#</th><th>Question</th><th>Correct</th><th title="How well the question separates strong from weak students (−1 to 1)">Discrim.</th><th>Most common wrong answer</th><th>Blank</th></tr></thead><tbody>' +
    st.items.map(it => '<tr data-i="' + it.i + '" class="' + (it.i === sel.i ? 'sel' : '') + '"><td><b>' + (it.i + 1) + '</b></td><td dir="auto" style="max-width:300px"><div style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + esc(plain(it.q.q)) + '</div><span class="small muted">' + window.HBQB.TYPE[it.q.type][0] + (it.q.img ? ' · figure' : '') + '</span></td>' +
      '<td style="min-width:120px">' + (it.pct == null ? '<span class="tag" style="background:var(--panel2)">' + (it.need ? it.need + ' to mark' : 'marked by you') + '</span>' : '<div style="display:flex;gap:8px;align-items:center"><div class="bar" style="flex:1"><i style="width:' + it.pct + '%;background:' + band(it.pct) + '"></i></div><b>' + it.pct + '%</b></div>') + '</td>' +
      '<td>' + (it.disc == null ? '—' : '<span class="tag" style="background:color-mix(in srgb,' + (it.disc >= 0.3 ? C.good : it.disc >= 0.1 ? C.warn : C.bad) + ' 25%,transparent)">' + it.disc.toFixed(2) + '</span>') + '</td>' +
      '<td dir="auto" style="max-width:220px"><div style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + (it.wrong ? esc(fmtAns(it.q, it.wrong.v)) + ' <span class="muted">(' + it.wrong.n + ')</span>' : '—') + '</div></td><td>' + (it.blank || '') + '</td></tr>').join('') + '</tbody></table></div><div class="panel" id="tdQ"></div></div>';
  $$('tbody tr', B).forEach(tr => tr.onclick = () => { T.qsel = +tr.dataset.i; questions(B, st); bindTips(B); });
  drill(B.querySelector('#tdQ'), sel, st);
}
function drill(P, it, st) {
  const q = it.q, key = G().keyText(q, 'en'), fin = st.fin;
  let h = '<h3>Q' + (it.i + 1) + ' · ' + window.HBQB.TYPE[q.type][0] + '<small>' + (q.pts || 1) + ' pt' + ((q.pts || 1) === 1 ? '' : 's') + '</small></h3><div dir="auto" style="font-weight:600;white-space:pre-wrap;margin-bottom:8px">' + rich(q.q, q) + '</div>' + (q.img ? '<img src="' + q.img + '" style="max-width:100%;max-height:200px;border-radius:10px;background:#fff;margin-bottom:8px">' : '') +
    (key ? '<div class="small" style="margin-bottom:10px">Answer: <b style="color:#4ADE80;white-space:pre-wrap" dir="auto">' + rich(key, q) + '</b></div>' : '');
  if (q.type === 'mc' || q.type === 'multi' || q.type === 'tf') { const opts = q.type === 'tf' ? [[true, 'True'], [false, 'False']] : q.o.map((o, k) => [k, 'ABCDEFGH'[k] + '. ' + o]);
    const keyIdx = q.type === 'tf' ? [q.a] : [].concat(q.a == null ? [] : q.a);
    h += '<h3 style="margin-top:6px">Answers chosen</h3>' + hbars(opts.map(([k, l]) => { const ps = fin.filter(p => q.type === 'multi' ? [].concat(p.ans[it.i] || []).includes(k) : p.ans[it.i] === k); const ok = keyIdx.includes(k);
      return { label: l, mark: ok ? '✓ ' : '', v: ps.length, color: ok ? C.good : C.blue, tip: ps.map(p => p.name).join('\n') || 'Nobody' }; }).concat([{ label: 'No answer', v: fin.filter(p => p.ans[it.i] == null).length, color: C.none }]), { max: Math.max(1, fin.length) }); }
  else if (q.type === 'short' || q.type === 'num' || q.type === 'blank') { const groups = new Map(); fin.forEach(p => { const v = p.ans[it.i]; const k = v == null ? '—' : G().norm([].concat(v).join(' · ')); const e = groups.get(k) || { label: v == null ? 'No answer' : fmtAns(q, v), n: 0, names: [], ok: p.m.per[it.i].ok }; e.n++; e.names.push(p.name); groups.set(k, e); });
    h += '<h3 style="margin-top:6px">Answers given</h3>' + hbars([...groups.values()].sort((a, b) => b.n - a.n).slice(0, 14).map(e => ({ label: e.label, mark: e.ok ? '✓ ' : '', v: e.n, color: e.ok ? C.good : e.label === 'No answer' ? C.none : C.bad, tip: e.names.join('\n') })), { max: Math.max(1, fin.length) }); }
  if (q.type === 'long' || it.unscored || q.type === 'short' || q.type === 'blank' || q.type === 'num') {
    h += '<h3 style="margin-top:14px">Mark the answers <small>type points to change a mark</small></h3>' + fin.filter(p => p.ans[it.i] != null).map(p => { const per = p.m.per[it.i];
      return '<div class="ans"><div class="w" dir="auto"><b>' + esc(p.name) + '</b><br>' + esc(fmtAns(q, p.ans[it.i])) + '</div><input type="number" min="0" max="' + (q.pts || 1) + '" step="0.5" data-pid="' + p.pid + '" value="' + (per.unscored ? '' : per.pts) + '" placeholder="✎" title="Points out of ' + (q.pts || 1) + '"></div>'; }).join('') || '<p class="muted">No answers yet.</p>'; }
  else if (q.type === 'match' || q.type === 'order') h += '<h3 style="margin-top:6px">Scores</h3>' + hbars(fin.map(p => ({ label: p.name, v: Math.round((p.m.per[it.i].score || 0) * 100), vl: Math.round((p.m.per[it.i].score || 0) * 100) + '%', color: band(Math.round((p.m.per[it.i].score || 0) * 100)), tip: fmtAns(q, p.ans[it.i]) })), { max: 100 });
  P.innerHTML = h; bindTips(P);
  $$('input[data-pid]', P).forEach(inp => inp.onchange = () => setMark(inp.dataset.pid, it.i, inp.value === '' ? null : Math.max(0, Math.min(+(q.pts || 1), +inp.value))));
}
async function setMark(pid, i, pts) { const r = T.run; r.over = r.over || {}; const k = pid + ':' + i; if (pts == null) delete r.over[k]; else r.over[k] = pts;
  if (T.live && window.HBQB.open && window.HBQB.open.id === r.id) { window.HBQB.open.over = r.over; try { await D().cmd('testOver', { pid, i, pts }); } catch (e) {} }
  await window.HBQB.store.saveRun(Object.assign(r, { papers: r.papers })); toast('Mark saved.', 1200); const B = T.el.querySelector('#tdB'); const st = stats(); if (T.tab === 'questions') { const P = B.querySelector('#tdQ'); drill(P, st.items[T.qsel], st); } else body(); }

function students(B, st) {
  const qs = T.test.questions, list = st.marks.slice().sort(T.sort === 'name' ? (a, b) => a.name.localeCompare(b.name) : (a, b) => (b.done - a.done) || (b.m.pct - a.m.pct));
  const cell = (p, i) => { const per = p.m.per[i], v = p.ans[i]; let c = C.none, s = ''; if (v == null) { c = 'var(--panel2)'; s = ''; } else if (per.unscored) { c = '#6b6880'; s = '✎'; } else if (per.ok) { c = C.good; s = '✓'; } else if (per.score > 0) { c = C.warn; s = '½'; } else { c = C.bad; s = '✗'; }
    return '<div class="c" style="background:' + c + '" data-tip="' + esc(p.name + ' · Q' + (i + 1) + '\n' + fmtAns(qs[i], v).slice(0, 120) + (per.unscored ? '\n(to mark)' : '\n' + per.pts + ' / ' + per.max)) + '" data-p="' + p.pid + '">' + s + '</div>'; };
  B.innerHTML = '<div class="panel" style="margin-bottom:14px;overflow:auto"><h3>' + icon('grid-3x3') + 'Every answer <small>✓ right · ½ partly · ✗ wrong · ✎ to mark · blank = not answered — click a name to open the paper</small></h3>' +
    '<div class="hm" style="grid-template-columns:minmax(140px,220px) 64px repeat(' + qs.length + ',minmax(26px,1fr))"><div class="h" style="text-align:start">Student</div><div class="h">Score</div>' + qs.map((q, i) => '<div class="h">' + (i + 1) + '</div>').join('') +
    list.map(p => '<div class="n" dir="auto" data-p="' + p.pid + '" title="' + esc(p.name) + '">' + (p.done ? '' : '⏳ ') + esc(p.name) + '</div><div class="c" style="background:' + (p.done ? band(p.m.pct) : 'var(--panel2)') + ';color:' + (p.done ? '#fff' : 'var(--muted)') + '" data-p="' + p.pid + '">' + (p.done ? Math.round(p.m.pct) + '%' : Object.keys(p.ans).length + '/' + qs.length) + '</div>' + qs.map((q, i) => cell(p, i)).join('')).join('') + '</div></div>' +
    '<div class="panel" style="overflow:auto"><table class="t"><thead><tr><th data-s="name">Student</th><th data-s="score">Score</th><th>Points</th><th>Time</th><th>Status</th></tr></thead><tbody>' +
    list.map(p => '<tr data-p="' + p.pid + '"><td dir="auto"><b>' + esc(p.name) + '</b></td><td style="min-width:140px"><div style="display:flex;gap:8px;align-items:center"><div class="bar" style="flex:1"><i style="width:' + p.m.pct + '%;background:' + band(p.m.pct) + '"></i></div><b>' + Math.round(p.m.pct) + '%</b></div></td><td>' + r1(p.m.got) + ' / ' + p.m.max + '</td><td>' + mmss(p.ms) + '</td><td>' + (p.done ? (p.m.pct >= st.pass ? '<span class="tag" style="background:color-mix(in srgb,' + C.good + ' 25%,transparent)">Passed</span>' : '<span class="tag" style="background:color-mix(in srgb,' + C.bad + ' 25%,transparent)">Below pass</span>') : '<span class="tag" style="background:var(--panel2)">Working · ' + Object.keys(p.ans).length + '/' + qs.length + '</span>') + '</td></tr>').join('') + '</tbody></table></div>';
  $$('[data-p]', B).forEach(el => el.onclick = () => paper(el.dataset.p));
  $$('th[data-s]', B).forEach(th => th.onclick = () => { T.sort = th.dataset.s; students(B, stats()); bindTips(B); });
}
function paper(pid) { const st = stats(), p = st.marks.find(x => x.pid === pid); if (!p) return; const qs = T.test.questions;
  modal.open('<h2 dir="auto">' + esc(p.name) + '</h2><p class="muted">' + (p.done ? Math.round(p.m.pct) + '% · ' + r1(p.m.got) + ' / ' + p.m.max + ' points · ' + mmss(p.ms) : 'Still working · ' + Object.keys(p.ans).length + ' of ' + qs.length + ' answered') + '</p><div style="max-height:62vh;overflow:auto">' +
    qs.map((q, i) => { const per = p.m.per[i]; const col = per.unscored ? '#6b6880' : per.ok ? C.good : per.score > 0 ? C.warn : C.bad;
      return '<div style="border-inline-start:4px solid ' + (p.ans[i] == null ? 'var(--line)' : col) + ';padding:8px 12px;margin:8px 0;background:var(--panel2);border-radius:10px"><div style="display:flex;gap:8px"><b>Q' + (i + 1) + '</b><span dir="auto" style="flex:1;white-space:pre-wrap">' + esc(q.q) + '</span><input type="number" min="0" max="' + (q.pts || 1) + '" step="0.5" data-i="' + i + '" value="' + (per.unscored ? '' : per.pts) + '" placeholder="✎" style="width:64px"> <span class="muted">/ ' + (q.pts || 1) + '</span></div>' +
        '<div dir="auto" style="margin-top:4px;white-space:pre-wrap">' + esc(fmtAns(q, p.ans[i])) + '</div>' + (!per.ok && q.a != null ? '<div class="small" dir="auto" style="color:#4ADE80;white-space:pre-wrap">✓ ' + esc(G().keyText(q, 'en')) + '</div>' : '') + '</div>'; }).join('') + '</div><div class="foot"><button class="btn primary" onclick="HB.modal.close()">Done</button></div>', sh => {
    $$('input[data-i]', sh).forEach(inp => inp.onchange = () => setMark(pid, +inp.dataset.i, inp.value === '' ? null : Math.max(0, Math.min(+(qs[+inp.dataset.i].pts || 1), +inp.value)))); }); }

/* ---------- Excel ---------- */
function excel() { const st = stats(), t = T.test, qs = t.questions;
  const summary = [['Test', t.title], ['Class', T.run.cls || ''], ['Date', new Date(T.run.at).toLocaleString()], ['Handed in', st.fin.length], ['Average %', st.avg == null ? '' : Math.round(st.avg * 10) / 10], ['Median %', st.median == null ? '' : st.median], ['Pass mark %', st.pass], ['Passed', st.passN], ['Average time (min)', Math.round(st.avgMs / 6000) / 10]];
  const studs = [['Student', 'Score %', 'Points', 'Out of', 'Time (min)', 'Status'].concat(qs.map((q, i) => 'Q' + (i + 1)))].concat(st.marks.map(p => [p.name, p.m.pct, p.m.got, p.m.max, Math.round((p.ms || 0) / 6000) / 10, p.done ? 'Handed in' : 'Working'].concat(qs.map((q, i) => p.m.per[i].unscored ? '' : p.m.per[i].pts))));
  const items = [['#', 'Question', 'Type', 'Points', 'Correct %', 'Discrimination', 'Most common wrong answer', 'Blank', 'Answer']].concat(st.items.map(it => [it.i + 1, it.q.q, window.HBQB.TYPE[it.q.type][0], +it.q.pts || 1, it.pct == null ? '' : it.pct, it.disc == null ? '' : Math.round(it.disc * 100) / 100, it.wrong ? fmtAns(it.q, it.wrong.v) : '', it.blank, G().keyText(it.q, 'en')]));
  const answers = [['Student'].concat(qs.map((q, i) => 'Q' + (i + 1)))].concat(st.marks.map(p => [p.name].concat(qs.map((q, i) => fmtAns(q, p.ans[i])))));
  let blob = window.HBRP && HBRP._xlsx([['Summary', summary], ['Students', studs], ['Questions', items], ['Answers', answers]]);
  Promise.resolve(blob).then(b => { if (!(b instanceof Blob)) b = new Blob([b], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = (t.title.replace(/[\\/:*?"<>|]+/g, '').slice(0, 60) || 'Test') + ' results.xlsx'; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 4000); toast('Results saved for Excel.'); }); }

function update(run) { if (!T.el || !T.run || run.id !== T.run.id) return; T.run = run; const ae = document.activeElement; if (ae && T.el.contains(ae) && ae.tagName === 'INPUT' && ae.type === 'number') return; if (!T.el.querySelector('#tdB')) return draw();
  const live = T.live && run.open, pill = T.el.querySelector('.pill'); if (pill && !live && pill.classList.contains('live')) return draw(); body(); }
window.HBTD = { open, close, update, get on() { return !!T.el; } };
})();
