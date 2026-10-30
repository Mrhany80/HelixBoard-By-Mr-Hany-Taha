/* ================= HelixBoard — Tests (Live class): a worksheet becomes an online test, marked automatically =================
   1. Details and settings first (test name, class, language, feedback, time, shuffling, what students see afterwards).
   2. Upload the worksheet — PDF, Word, photos of the book, or pasted text. quizimport.js reads it, quizparse.js finds the
      questions, the answer key and the figures. No AI and no internet (except Tesseract the first time for photos).
   3. A Forms-style review (optional): every question as a card; change anything, crop a figure from the page.
   4. Start: the whole paper opens on every phone in the class link; each answer is marked on this computer as it arrives;
      the dashboard (testdash.js) shows the results live. */
(() => {
'use strict';
const { $, $$, esc, icon, set, toast, modal, IDB, REDUCE } = window.HB;
const D = () => window.helixDesktop && window.helixDesktop.cl;
const G = () => window.HBGrade;
const TYPE = { mc: ['Multiple choice', 'circle-dot', '#3987e5'], multi: ['Several answers', 'list-checks', '#6250d6'], tf: ['True / False', 'toggle-left', '#1baf7a'], short: ['Short answer', 'text-cursor-input', '#eb6834'],
  num: ['Number', 'calculator', '#c98500'], blank: ['Fill in the blanks', 'brackets', '#d55181'], match: ['Matching', 'git-compare-arrows', '#199e70'], order: ['Put in order', 'list-ordered', '#9085e9'], long: ['Written answer', 'align-left', '#e66767'] };
const DEF_SET = { feedback: 'instant', retry: true, retryShare: 0.5, time: 0, shuffleQ: false, shuffleO: true, showScore: true, showKey: true, nav: true, strict: false, pass: 50, pts: 1 };
const S = { el: null, test: null, pages: [], step: 'details', open: null };
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
/* equations and pasted pictures live inside the text as ⟦m:id⟧, their pictures in q.media */
const TOK = /⟦m:([a-z0-9]+)⟧/g;
function rich(text, q) { return esc(text == null ? '' : String(text)).replace(TOK, (m, id) => { const md = q && q.media && q.media[id]; return md ? '<img class="eq" src="' + md.src + '" style="width:' + (md.w || 'auto') + 'px" alt="">' : '▣'; }); }
function attachMedia(q, pool) { const ids = [...JSON.stringify([q.q, q.o, q.left, q.right, q.a, q.ex, q.hint]).matchAll(TOK)].map(m => m[1]); const md = Object.assign({}, q.media || {}); ids.forEach(id => { if (pool && pool[id]) md[id] = pool[id]; });
  Object.keys(md).forEach(id => { if (!ids.includes(id)) delete md[id]; }); if (Object.keys(md).length) q.media = md; else delete q.media; return q; }
function picFrom(file, maxW) { return new Promise((ok, bad) => { const img = new Image(); img.onload = () => { const s = Math.min(1, (maxW || 1100) / img.naturalWidth), c = document.createElement('canvas'); c.width = Math.round(img.naturalWidth * s); c.height = Math.round(img.naturalHeight * s); const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); g.drawImage(img, 0, 0, c.width, c.height);
  ok({ src: c.width * c.height < 420000 ? c.toDataURL('image/png') : c.toDataURL('image/jpeg', 0.92), w: c.width, h: c.height }); URL.revokeObjectURL(img.src); }; img.onerror = () => bad(new Error('That picture could not be read.')); img.src = URL.createObjectURL(file); }); }
const clipImage = e => { const it = [...((e.clipboardData && e.clipboardData.items) || [])].find(i => i.kind === 'file' && /^image\//.test(i.type)); return it ? it.getAsFile() : null; };

/* ---------- storage: tests and their runs live in IndexedDB (pictures make them too big for settings) ---------- */
const store = {
  async index() { return (await IDB.get('tests:index')) || []; },
  async get(id) { return IDB.get('test:' + id); },
  async save(t) { t.updated = Date.now(); await IDB.put('test:' + t.id, t); const ix = await store.index(), e = { id: t.id, title: t.title, cls: t.cls || '', n: t.questions.length, lang: t.lang, updated: t.updated, runs: (ix.find(x => x.id === t.id) || {}).runs || [] };
    await IDB.put('tests:index', [e].concat(ix.filter(x => x.id !== t.id))); },
  async remove(id) { const ix = await store.index(), e = ix.find(x => x.id === id); await IDB.put('tests:index', ix.filter(x => x.id !== id)); await IDB.put('test:' + id, null); if (e) for (const r of e.runs || []) await IDB.put('testrun:' + r.id, null); },
  async run(id) { return IDB.get('testrun:' + id); },
  async saveRun(r) { await IDB.put('testrun:' + r.id, r); const ix = await store.index(), e = ix.find(x => x.id === r.testId); if (!e) return; const done = (r.papers || []).filter(p => p.done);
    const sum = { id: r.id, at: r.at, cls: r.cls || '', n: done.length, avg: done.length ? Math.round(done.reduce((s, p) => s + (p.pct || 0), 0) / done.length) : null };
    e.runs = [sum].concat((e.runs || []).filter(x => x.id !== r.id)).slice(0, 30); await IDB.put('tests:index', ix); },
};

/* ---------- styles ---------- */
const css = document.createElement('style'); css.textContent = `
#qbStage{position:fixed;inset:0;z-index:48;background:var(--bg);color:var(--ink);display:flex;flex-direction:column;font-family:var(--ui)}
#qbStage .qb-top{display:flex;align-items:center;gap:12px;padding:10px 16px;border-bottom:1px solid var(--line);background:linear-gradient(180deg,var(--panel2),var(--panel));min-height:60px}
#qbStage .qb-top h2{margin:0;font:800 19px/1.1 var(--head);display:flex;align-items:center;gap:10px}
#qbStage .qb-top h2 svg{width:22px;height:22px;color:var(--accent)}
#qbStage .qb-steps{display:flex;gap:6px;margin-inline-start:18px}
#qbStage .qb-steps span{padding:5px 12px;border-radius:999px;font-weight:700;font-size:13px;color:var(--muted);border:1px solid var(--line)}
#qbStage .qb-steps span.on{background:var(--accent);color:#1b0610;border-color:var(--accent)}
#qbStage .qb-steps span.ok{color:var(--ok,#4ADE80);border-color:color-mix(in srgb,var(--ok,#4ADE80) 50%,transparent)}
#qbStage .qb-body{flex:1;overflow:auto;padding:22px 22px 80px}
#qbStage .qb-wrap{max-width:900px;margin:0 auto}
#qbStage .qb-card{background:var(--panel);border:1px solid var(--line);border-radius:16px;padding:18px 20px;margin-bottom:14px}
#qbStage .qb-card.hero{border-top:6px solid var(--accent)}
#qbStage .qb-card h3{margin:0 0 12px;font:700 13px/1 var(--ui);letter-spacing:.08em;text-transform:uppercase;color:var(--muted)}
#qbStage label.f{display:block;margin:10px 0}
#qbStage label.f > span{display:block;font-weight:600;font-size:13.5px;margin-bottom:5px;color:var(--muted)}
#qbStage input[type=text],#qbStage input[type=number],#qbStage textarea,#qbStage select{width:100%;background:var(--panel2);border:1px solid var(--line);border-radius:10px;color:var(--ink);font:inherit;font-size:15px;padding:9px 11px}
#qbStage textarea{min-height:64px;resize:vertical}
#qbStage .grid2{display:grid;grid-template-columns:1fr 1fr;gap:12px} @media(max-width:760px){#qbStage .grid2{grid-template-columns:1fr}}
#qbStage .tog{display:flex;align-items:flex-start;gap:10px;padding:9px 0;border-top:1px solid var(--line);cursor:pointer}
#qbStage .tog:first-of-type{border-top:0}
#qbStage .tog input{width:20px;height:20px;margin-top:2px;accent-color:var(--accent);flex:none}
#qbStage .tog b{display:block;font-size:14.5px} #qbStage .tog small{color:var(--muted)}
#qbStage .seg{display:flex;flex-wrap:wrap;gap:8px}
#qbStage .seg button{flex:1;min-width:180px;text-align:start;background:var(--panel2);border:2px solid var(--line);border-radius:12px;padding:10px 12px;color:inherit;font:inherit;cursor:pointer}
#qbStage .seg button b{display:block} #qbStage .seg button small{color:var(--muted)}
#qbStage .seg button.on{border-color:var(--accent);background:color-mix(in srgb,var(--accent) 12%,var(--panel2))}
#qbStage .drop{border:2px dashed var(--line);border-radius:18px;padding:34px 20px;text-align:center;cursor:pointer;transition:border-color .15s,background .15s}
#qbStage .drop:hover,#qbStage .drop.over{border-color:var(--accent);background:color-mix(in srgb,var(--accent) 8%,transparent)}
#qbStage .drop svg{width:44px;height:44px;color:var(--accent)} #qbStage .drop b{display:block;font:700 19px var(--head);margin:8px 0 4px}
#qbStage .fmt{display:flex;justify-content:center;gap:8px;flex-wrap:wrap;margin-top:10px} #qbStage .fmt span{background:var(--panel2);border-radius:999px;padding:3px 10px;font-size:12.5px;font-weight:700;color:var(--muted)}
#qbStage .meter{height:8px;border-radius:4px;background:var(--panel2);overflow:hidden;margin:12px 0 6px} #qbStage .meter i{display:block;height:100%;width:0;background:linear-gradient(90deg,var(--accent),var(--cyan,#22D3EE));transition:width .2s}
#qbStage .sum{display:flex;flex-wrap:wrap;gap:8px;margin-top:10px}
#qbStage .chip{display:inline-flex;align-items:center;gap:6px;padding:4px 10px;border-radius:999px;font-weight:700;font-size:12.5px;background:color-mix(in srgb,var(--t) 16%,transparent);color:var(--t)}
#qbStage .chip svg{width:14px;height:14px}
#qbStage .q{position:relative;background:var(--panel);border:1px solid var(--line);border-radius:16px;padding:16px 18px 14px;margin-bottom:12px;border-inline-start:5px solid var(--t)}
#qbStage .q.warn{box-shadow:0 0 0 2px color-mix(in srgb,#fab219 55%,transparent)}
#qbStage .q .hd{display:flex;align-items:center;gap:8px;margin-bottom:8px;flex-wrap:wrap}
#qbStage .q .no{font:800 14px var(--mono);background:var(--panel2);border-radius:8px;padding:2px 8px}
#qbStage .q .pts{margin-inline-start:auto;color:var(--muted);font-weight:700;font-size:13px}
#qbStage .q .tx{font-size:16.5px;font-weight:600;white-space:pre-wrap;line-height:1.45}
#qbStage .q .sec{font-size:12px;color:var(--muted);font-weight:700;text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px}
#qbStage img.eq,#tdStage img.eq{vertical-align:middle;max-width:100%;height:auto;background:#fff;border-radius:4px;margin:1px 2px}
#qbStage .q:focus{outline:2px solid var(--accent);outline-offset:2px}
#qbStage .q img.fig{max-width:min(100%,420px);max-height:260px;display:block;margin:10px 0;border-radius:10px;background:#fff;border:1px solid var(--line)}
#qbStage .q ul{list-style:none;margin:8px 0 0;padding:0} #qbStage .q li{padding:5px 10px;border-radius:9px;margin:3px 0;background:var(--panel2);display:flex;gap:8px}
#qbStage .q li.ok{background:color-mix(in srgb,#0ca30c 22%,var(--panel2));font-weight:700} #qbStage .q li.ok::after{content:"✓";margin-inline-start:auto;color:#4ADE80}
#qbStage .q .qkey{margin-top:8px;font-size:14px} #qbStage .q .qkey b{color:#4ADE80} #qbStage .q .nokey{margin-top:8px;color:#fab219;font-weight:600;font-size:13.5px}
#qbStage .q .ex{margin-top:6px;color:var(--muted);font-size:13.5px;white-space:pre-wrap}
#qbStage .q .act{display:flex;gap:6px;margin-top:10px;flex-wrap:wrap}
#qbStage .q .ed{margin-top:12px;padding-top:12px;border-top:1px dashed var(--line)}
#qbStage .orow{display:flex;gap:8px;align-items:center;margin:6px 0} #qbStage .orow input[type=text]{flex:1} #qbStage .orow input[type=radio],#qbStage .orow input[type=checkbox]{width:20px;height:20px;accent-color:#0ca30c}
#qbStage .lib{display:grid;grid-template-columns:repeat(auto-fill,minmax(290px,1fr));gap:14px}
#qbStage .foot{position:sticky;bottom:0;display:flex;gap:10px;justify-content:flex-end;padding:12px 0;background:linear-gradient(transparent,var(--bg) 30%)}
.qb-crop{position:relative;display:inline-block;cursor:crosshair;user-select:none;max-width:100%}
.qb-crop img{max-width:100%;max-height:70vh;display:block}
.qb-crop i{position:absolute;border:2px solid var(--accent);background:color-mix(in srgb,var(--accent) 18%,transparent);pointer-events:none}
.lc-tabs{display:flex;gap:6px;margin-bottom:16px;background:var(--panel);border:1px solid var(--line);border-radius:14px;padding:5px;width:max-content;max-width:100%}
.lc-tabs button{display:inline-flex;align-items:center;gap:8px;border:0;background:transparent;color:var(--muted);font:700 15px var(--ui);padding:9px 16px;border-radius:10px;cursor:pointer}
.lc-tabs button svg{width:18px;height:18px} .lc-tabs button.on{background:var(--accent);color:#1b0610}
.qb-lib .tcard{position:relative;background:var(--panel);border:1px solid var(--line);border-radius:18px;padding:16px;display:flex;flex-direction:column;gap:8px;overflow:hidden}
.qb-lib .tcard::before{content:"";position:absolute;inset:0 0 auto;height:4px;background:linear-gradient(90deg,#6250d6,#e87ba4)}
.qb-lib .tcard b{font:700 17px/1.25 var(--head)} .qb-lib .tcard .m{color:var(--muted);font-size:13px}
.qb-lib .tcard .row{display:flex;gap:6px;flex-wrap:wrap;margin-top:auto}
.qb-lib .live{display:flex;align-items:center;gap:12px;padding:12px 16px;border-radius:14px;background:color-mix(in srgb,#0ca30c 16%,var(--panel));border:1px solid color-mix(in srgb,#0ca30c 50%,transparent);margin-bottom:14px}
.qb-lib .newbig{display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:14px;margin:14px 0 22px}
`; document.head.appendChild(css);

/* ---------- the Tests tab inside Live class ---------- */
async function renderLib(m) {
  const ix = await store.index(), run = S.open;
  m.innerHTML = '<div class="qb-lib"><div class="lc-hero"><div><h1>Tests</h1><p>Turn a worksheet, a PDF or a Word file into an online test — questions, figures and the answer key are found for you, every paper is marked the moment it is handed in.</p></div></div>' +
    (run ? '<div class="live"><span style="width:10px;height:10px;border-radius:50%;background:#4ADE80;flex:none"></span><b style="flex:1">' + esc(run.title) + ' is running on the phones</b><button class="btn primary" id="qbDash">' + icon('chart-column-big') + 'Open dashboard</button></div>' : '') +
    '<div class="newbig"><button class="lc-card" id="qbNew" style="--tint:#6250d6"><div class="ic">' + icon('file-up') + '</div><b>New test from a worksheet</b><span>PDF, Word, photos of a book page or pasted text. Works in English and Arabic, with no AI and no internet.</span></button>' +
    '<button class="lc-card" id="qbBlank" style="--tint:#1baf7a"><div class="ic">' + icon('file-plus-2') + '</div><b>Blank test</b><span>Type the questions yourself, like Microsoft Forms: nine question types, points, explanations and hints.</span></button></div>' +
    (ix.length ? '<h3 style="margin:0 0 10px">Your tests</h3><div class="lib" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(290px,1fr));gap:14px">' + ix.map(t => { const r = (t.runs || [])[0];
      return '<div class="tcard" data-id="' + t.id + '"><b dir="auto">' + esc(t.title) + '</b><div class="m">' + t.n + ' questions' + (t.cls ? ' · ' + esc(t.cls) : '') + (t.lang === 'ar' ? ' · العربية' : '') + '</div>' +
        (r ? '<div class="m">Last given ' + new Date(r.at).toLocaleDateString([], { day: 'numeric', month: 'short' }) + ' · ' + r.n + ' handed in' + (r.avg != null ? ' · average ' + r.avg + '%' : '') + '</div>' : '<div class="m">Not given yet</div>') +
        '<div class="row"><button class="btn sm primary" data-a="start">' + icon('play') + 'Start</button><button class="btn sm" data-a="edit">' + icon('pencil') + 'Edit</button>' + (r ? '<button class="btn sm" data-a="dash">' + icon('chart-column-big') + 'Results</button>' : '') + '<button class="btn sm" data-a="dup" title="Duplicate">' + icon('copy') + '</button><button class="btn sm" data-a="del" title="Delete">' + icon('trash-2') + '</button></div></div>'; }).join('') + '</div>'
      : '<p class="muted">Your tests will appear here.</p>') + '</div>';
  m.querySelector('#qbNew').onclick = () => wizard();
  m.querySelector('#qbBlank').onclick = () => wizard(null, true);
  const db = m.querySelector('#qbDash'); if (db) db.onclick = () => window.HBTD && HBTD.open(run.testId, run.id, true);
  $$('.tcard', m).forEach(c => c.onclick = async e => { const b = e.target.closest('button'); if (!b) return; const id = c.dataset.id, a = b.dataset.a;
    if (a === 'start') return start(id);
    if (a === 'edit') { const t = await store.get(id); if (t) wizard(t); }
    if (a === 'dash') { const e2 = (await store.index()).find(x => x.id === id); if (e2 && e2.runs && e2.runs[0]) window.HBTD && HBTD.open(id, e2.runs[0].id, S.open && S.open.id === e2.runs[0].id); }
    if (a === 'dup') { const t = await store.get(id); if (t) { const c2 = JSON.parse(JSON.stringify(t)); c2.id = uid(); c2.title = t.title + ' (copy)'; await store.save(c2); renderLib(m); } }
    if (a === 'del') { if (confirm('Delete this test and its results?')) { await store.remove(id); renderLib(m); toast('Test deleted.'); } } });
  if (window.gsap && !REDUCE) gsap.from($$('.lc-card,.tcard', m), { y: 12, opacity: 0, duration: 0.28, stagger: 0.03, ease: 'power2.out' });
}

/* ---------- the wizard ---------- */
function stage(title) {
  if (S.el) S.el.remove(); const el = document.createElement('div'); el.id = 'qbStage'; el.setAttribute('role', 'dialog');
  el.innerHTML = '<div class="qb-top"><h2>' + icon('file-check-2') + '<span>' + esc(title) + '</span></h2><div class="qb-steps" id="qbSteps"></div><span style="flex:1"></span><button class="btn sm" id="qbClose">' + icon('x') + 'Close</button></div><div class="qb-body"><div class="qb-wrap" id="qbW"></div></div>';
  document.body.appendChild(el); S.el = el; el.querySelector('#qbClose').onclick = close;
  el.addEventListener('keydown', e => { if (e.key === 'Escape' && document.getElementById('modal').hidden) { e.stopPropagation(); close(); } });
  if (window.gsap && !REDUCE) gsap.from(el, { opacity: 0, y: 10, duration: 0.22 });
  return el.querySelector('#qbW');
}
function close() { if (S.dirty && !confirm('Close without saving this test?')) return; if (S.el) S.el.remove(); S.el = null; S.dirty = false; refreshLib(); }
function steps(cur) { const st = [['details', '1 · Details & settings'], ['source', '2 · Worksheet'], ['review', '3 · Review']], i = st.findIndex(s => s[0] === cur);
  S.el.querySelector('#qbSteps').innerHTML = st.map((s, k) => '<span class="' + (k === i ? 'on' : k < i ? 'ok' : '') + '">' + s[1] + '</span>').join(''); }
function wizard(test, blank) {
  S.test = test ? JSON.parse(JSON.stringify(test)) : { id: uid(), title: '', cls: window.HBX ? HBX.cur() : '', lang: set.get('lang', 'en') === 'ar' ? 'ar' : 'en', settings: Object.assign({}, DEF_SET, set.get('testDefaults', {})), questions: [], created: Date.now() };
  S.pages = []; S.blank = !!blank; S.dirty = !test; stage(test ? 'Edit test' : 'New test'); details(!!test);
}
function details(editing) {
  steps('details'); const t = S.test, s = t.settings, W = S.el.querySelector('#qbW');
  const tog = (k, title, sub) => '<label class="tog"><input type="checkbox" data-s="' + k + '"' + (s[k] ? ' checked' : '') + '><span><b>' + title + '</b><small>' + sub + '</small></span></label>';
  W.innerHTML = '<div class="qb-card hero"><h3>Test details</h3><label class="f"><span>Test name</span><input type="text" id="qbT" dir="auto" maxlength="90" placeholder="e.g. Cells — unit test" value="' + esc(t.title) + '"></label>' +
    '<div class="grid2"><label class="f"><span>Class</span><select id="qbC">' + (window.HBX ? HBX.classOptions(t.cls) : '<option value="">No class</option>') + '</select></label>' +
    '<label class="f"><span>Language on the phones</span><select id="qbL"><option value="en"' + (t.lang !== 'ar' ? ' selected' : '') + '>English</option><option value="ar"' + (t.lang === 'ar' ? ' selected' : '') + '>العربية (Arabic)</option></select></label></div></div>' +
    '<div class="qb-card"><h3>Feedback</h3><div class="seg" id="qbFb">' + [['instant', 'Straight away', 'After each question: right or wrong, the right answer and why. Best for practice.'], ['end', 'After handing in', 'Students see their score and corrections when they finish. A normal test.'], ['none', 'Not on the phone', 'An exam: nothing is shown; you share results later.']].map(([k, b, sm]) => '<button data-k="' + k + '" class="' + (s.feedback === k ? 'on' : '') + '"><b>' + b + '</b><small>' + sm + '</small></button>').join('') + '</div>' +
    '<div id="qbRetry" style="margin-top:10px">' + tog('retry', 'A second try with a hint', 'A wrong first answer shows the hint and allows one more try (half the points).') + '</div></div>' +
    '<div class="qb-card"><h3>Settings</h3><div class="grid2"><label class="f"><span>Time limit (minutes, 0 = none)</span><input type="number" min="0" max="300" id="qbTime" value="' + (s.time || 0) + '"></label><label class="f"><span>Pass mark (%)</span><input type="number" min="0" max="100" id="qbPass" value="' + (s.pass != null ? s.pass : 50) + '"></label></div>' +
    tog('shuffleQ', 'Shuffle the question order', 'Every student gets the questions in a different order.') + tog('shuffleO', 'Shuffle the options', 'Choices, matching columns and items to order appear in a different order on each phone.') +
    tog('nav', 'Students can go back', 'Move between questions freely before handing in.') + tog('showScore', 'Show the score after handing in', 'The percentage and points for each question.') +
    tog('showKey', 'Show the right answers after handing in', 'A corrected copy with the explanations from the key.') + tog('forgive', 'Forgive small spelling mistakes', 'In typed answers: "photosynthsis" counts as "photosynthesis". Letter forms and accents never matter.') + '</div>' +
    '<div class="foot">' + (editing ? '<button class="btn" id="qbToRev">' + icon('list') + 'Questions</button>' : '') + '<button class="btn primary" id="qbNext">' + (editing ? 'Save' : 'Next: the worksheet') + icon('arrow-right') + '</button></div>';
  W.querySelector('[data-s="forgive"]').checked = !s.strict;
  const fbSeg = W.querySelector('#qbFb'), retryBox = W.querySelector('#qbRetry'); const syncFb = () => { retryBox.hidden = s.feedback !== 'instant'; }; syncFb();
  fbSeg.onclick = e => { const b = e.target.closest('button'); if (!b) return; s.feedback = b.dataset.k; $$('button', fbSeg).forEach(x => x.classList.toggle('on', x === b)); syncFb(); };
  if (window.HBX) HBX.bindClassSelect(W.querySelector('#qbC'));
  const collect = () => { t.title = W.querySelector('#qbT').value.trim(); t.cls = W.querySelector('#qbC').value === '__new' ? '' : W.querySelector('#qbC').value; t.lang = W.querySelector('#qbL').value;
    s.time = Math.max(0, Math.min(300, +W.querySelector('#qbTime').value || 0)); s.pass = Math.max(0, Math.min(100, +W.querySelector('#qbPass').value || 0));
    $$('[data-s]', W).forEach(c => { if (c.dataset.s === 'forgive') s.strict = !c.checked; else s[c.dataset.s] = c.checked; });
    set.put('testDefaults', { feedback: s.feedback, retry: s.retry, shuffleQ: s.shuffleQ, shuffleO: s.shuffleO, nav: s.nav, showScore: s.showScore, showKey: s.showKey, strict: s.strict, pass: s.pass }); };
  W.querySelector('#qbNext').onclick = async () => { collect(); if (!t.title && !editing && !S.blank) { /* the worksheet's own title is used */ }
    if (editing) { if (!t.title) t.title = 'Test'; await save(); return review(); }
    if (S.blank) { if (!t.title) t.title = 'Test'; t.questions.push(blankQ('mc')); S.dirty = true; return review(); }
    source(); };
  const tr = W.querySelector('#qbToRev'); if (tr) tr.onclick = () => { collect(); review(); };
  setTimeout(() => W.querySelector('#qbT').focus(), 60);
}
function source() {
  steps('source'); const W = S.el.querySelector('#qbW');
  W.innerHTML = '<div class="qb-card hero"><h3>The worksheet</h3><div class="drop" id="qbDrop" tabindex="0">' + icon('file-up') + '<b>Drop the worksheet here, or click to choose</b><span class="muted">Questions, options, blanks, matching, figures, graphs, shapes and the answer key are found automatically.</span><div class="fmt"><span>PDF</span><span>Word .docx</span><span>Photos / scans</span><span>.txt</span></div></div>' +
    '<div id="qbProg" hidden><div class="meter"><i id="qbBar"></i></div><div class="small muted" id="qbMsg"></div></div></div>' +
    '<div class="qb-card"><h3>Or paste the questions</h3><textarea id="qbPaste" dir="auto" style="min-height:170px" placeholder="1. Which organelle releases energy?\na) Nucleus\nb) Mitochondrion\nc) Ribosome\n\n2. The ______ controls the cell.\n\nAnswer key\n1. B\n2. nucleus"></textarea><div class="foot" style="position:static;padding-bottom:0"><button class="btn primary" id="qbUsePaste">' + icon('wand-sparkles') + 'Make the test</button></div></div>' +
    '<div class="qb-card"><h3>How to get the best result</h3><ul class="small muted" style="margin:0;padding-inline-start:18px;line-height:1.7"><li>Put the answer key at the end under a heading like <b>Answer key</b> or <b>الإجابات</b> — "1-B 2-C 3-True 4. nucleus" — or write <b>Answer: B</b> under a question, or mark the right option with ✓, * or bold.</li><li>Number the questions (1. 2. 3. or ١- ٢-) and letter the options (a) b) c) or أ) ب) ج)).</li><li>Headings such as <b>True or False</b>, <b>Fill in the blanks</b>, <b>Match</b>, <b>Arrange</b>, <b>Explain</b> tell the reader the question type.</li><li>"Use the graph to answer questions 3–5" puts the graph on all three questions.</li></ul></div>' +
    '<div class="foot"><button class="btn" id="qbBack">' + icon('arrow-left') + 'Back</button></div>';
  const drop = W.querySelector('#qbDrop');
  const pick = () => { const inp = document.createElement('input'); inp.type = 'file'; inp.multiple = true; inp.accept = '.pdf,.docx,.doc,.txt,image/*,application/pdf'; inp.onchange = () => inp.files.length && importFiles([...inp.files]); inp.click(); };
  drop.onclick = pick; drop.onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(); } };
  drop.ondragover = e => { e.preventDefault(); drop.classList.add('over'); }; drop.ondragleave = () => drop.classList.remove('over');
  drop.ondrop = e => { e.preventDefault(); drop.classList.remove('over'); if (e.dataTransfer.files.length) importFiles([...e.dataTransfer.files]); };
  S.media = S.media || {}; const pasteBox = W.querySelector('#qbPaste');
  pasteBox.addEventListener('paste', async e => { const f = clipImage(e); if (!f) return; e.preventDefault(); const p = await picFrom(f); const tk = window.HBQI.token(p.src, Math.min(p.w, 560), Math.min(p.w, 560) * p.h / p.w); Object.assign(S.media, window.HBQI.media); const a = pasteBox.selectionStart, b = pasteBox.selectionEnd; pasteBox.value = pasteBox.value.slice(0, a) + tk + pasteBox.value.slice(b); pasteBox.selectionStart = pasteBox.selectionEnd = a + tk.length; toast('Picture pasted — it stays exactly as it is.'); });
  W.querySelector('#qbUsePaste').onclick = () => { const s = pasteBox.value; if (!s.trim()) return toast('Paste the questions first.'); build(window.HBQP.textLines(s), 'Pasted questions', []); };
  W.querySelector('#qbBack').onclick = () => details(false);
}
async function importFiles(files) {
  const W = S.el.querySelector('#qbW'), pr = W.querySelector('#qbProg'), bar = W.querySelector('#qbBar'), msg = W.querySelector('#qbMsg'); pr.hidden = false;
  const prog = (t, f) => { msg.textContent = t; if (f != null) bar.style.width = Math.round(f * 100) + '%'; };
  try { const r = await window.HBQI.read(files, prog, S.test.lang); S.media = r.media || {}; prog('Finding the questions…', 1); build(r.lines, files[0].name.replace(/\.[^.]+$/, ''), r.pages); }
  catch (e) { console.warn(e); pr.hidden = false; msg.innerHTML = '<span style="color:var(--bad,#FF6B6B)">' + esc(e.message || String(e)) + '</span>'; }
}
function build(lines, name, pages) {
  const r = window.HBQP.parse(lines, { name }), pool = S.media || {};
  if (!r.questions.length) { toast('No questions were found. Number the questions (1. 2. 3.) and try again, or paste them.', 6000); return; }
  const t = S.test; if (!t.title) t.title = r.title && r.title !== 'Test' ? r.title.slice(0, 90) : name;
  t.questions = t.questions.concat(r.questions.map(q => attachMedia(normal(Object.assign({}, q, { pts: q.pts || t.settings.pts || 1 })), pool)));
  t.src = { name, at: Date.now() }; S.pages = pages || []; S.stats = r.stats; S.dirty = true; review();
}
/* matching is kept as pairs in order (right[i] belongs to left[i]); extra right items are distractors */
function normal(q) { q.id = q.id || uid();
  if (q.type === 'match' && Array.isArray(q.a) && q.a.every(k => k != null)) { const used = new Set(q.a); q.right = q.a.map(k => q.right[k]).concat(q.right.filter((_, k) => !used.has(k))); q.a = q.left.map((_, i) => i); }
  return q; }
function blankQ(type) { const q = { id: uid(), type, q: '', pts: (S.test && S.test.settings.pts) || 1, ex: '', hint: '', img: null, a: null };
  if (type === 'mc' || type === 'multi') { q.o = ['', '', '', '']; q.a = type === 'mc' ? 0 : [0]; } if (type === 'tf') q.a = true; if (type === 'short') q.a = ['']; if (type === 'num') q.a = { v: 0, tol: '', unit: '' };
  if (type === 'blank') { q.q = 'The ______ is …'; q.a = [['']]; } if (type === 'match') { q.left = ['', '']; q.right = ['', '']; q.a = [0, 1]; } if (type === 'order') { q.o = ['', '', '']; q.a = true; } if (type === 'long') q.a = { keys: [], text: '' };
  return q; }

/* ---------- review: Forms-style cards ---------- */
function review() {
  steps('review'); const t = S.test, W = S.el.querySelector('#qbW'), qs = t.questions;
  const keyed = qs.filter(q => G().grade(q, '__probe__') !== null || q.a != null).length, noKey = qs.filter(q => q.a == null || (q.type === 'long' && !(q.a.keys || []).length)).length;
  const types = {}; qs.forEach(q => { types[q.type] = (types[q.type] || 0) + 1; }); const figs = qs.filter(q => q.img).length, pts = qs.reduce((s, q) => s + (+q.pts || 1), 0);
  W.innerHTML = '<div class="qb-card hero"><div style="display:flex;gap:12px;align-items:flex-start;flex-wrap:wrap"><div style="flex:1;min-width:240px"><input type="text" id="qbTitle" dir="auto" value="' + esc(t.title) + '" style="font:800 22px var(--head);background:transparent;border:0;border-bottom:2px solid var(--line);border-radius:0;padding:4px 0"><div class="small muted" style="margin-top:6px">' + qs.length + ' questions · ' + pts + ' points' + (t.cls ? ' · ' + esc(t.cls) : '') + (t.settings.time ? ' · ' + t.settings.time + ' min' : '') + ' · ' + (t.settings.feedback === 'instant' ? 'feedback straight away' : t.settings.feedback === 'end' ? 'feedback after handing in' : 'no feedback on phones') + '</div></div>' +
    '<button class="btn" id="qbSet">' + icon('settings-2') + 'Settings</button></div>' +
    '<div class="sum">' + Object.entries(types).map(([k, n]) => '<span class="chip" style="--t:' + TYPE[k][2] + '">' + icon(TYPE[k][1]) + n + ' ' + TYPE[k][0] + '</span>').join('') + (figs ? '<span class="chip" style="--t:#3987e5">' + icon('image') + figs + ' with figures</span>' : '') + '</div>' +
    (noKey ? '<p style="margin:12px 0 0;color:#fab219;font-weight:600">' + icon('triangle-alert') + ' ' + noKey + ' question' + (noKey === 1 ? ' has' : 's have') + ' no answer in the key. Students can still answer; you mark ' + (noKey === 1 ? 'it' : 'them') + ' on the dashboard — or add the answer below.</p>' : '<p style="margin:12px 0 0;color:#4ADE80;font-weight:600">' + icon('circle-check') + ' Every question has an answer — the whole test is marked automatically.</p>') + '</div>' +
    '<div id="qbList"></div><div class="qb-card" style="display:flex;gap:8px;flex-wrap:wrap;align-items:center"><b style="margin-inline-end:6px">Add a question</b>' + Object.entries(TYPE).map(([k, v]) => '<button class="btn sm" data-add="' + k + '">' + icon(v[1]) + v[0] + '</button>').join('') + '</div>' +
    '<div class="foot"><button class="btn" id="qbMore">' + icon('file-up') + 'Add from another file</button><button class="btn" id="qbSave">' + icon('save') + 'Save</button><button class="btn primary" id="qbGo">' + icon('play') + 'Save and start on the phones</button></div>';
  const list = W.querySelector('#qbList'); qs.forEach((q, i) => list.appendChild(card(q, i)));
  W.querySelector('#qbTitle').oninput = e => { t.title = e.target.value; S.dirty = true; };
  W.querySelector('#qbSet').onclick = () => details(true);
  $$('[data-add]', W).forEach(b => b.onclick = () => { const q = blankQ(b.dataset.add); qs.push(q); S.dirty = true; review(); const c = list.lastElementChild; edit(q, c, true); c.scrollIntoView({ block: 'center', behavior: 'smooth' }); });
  W.querySelector('#qbMore').onclick = () => source();
  W.querySelector('#qbSave').onclick = async () => { await save(); toast('Test saved.'); };
  W.querySelector('#qbGo').onclick = async () => { await save(); const id = t.id; if (S.el) S.el.remove(); S.el = null; start(id); };
}
function card(q, i) {
  const c = document.createElement('div'), T = TYPE[q.type] || TYPE.short, qs = S.test.questions; c.className = 'q'; c.tabIndex = 0; c.title = 'Click, then Ctrl+V to paste a figure or equation'; c.style.setProperty('--t', T[2]);
  c.dataset.id = q.id; const nk = q.a == null || (q.type === 'long' && !(q.a.keys || []).length); if (nk) c.classList.add('warn');
  let body = '';
  if (q.type === 'mc' || q.type === 'multi') body = '<ul>' + q.o.map((o, k) => '<li class="' + ([].concat(q.a == null ? [] : q.a).includes(k) ? 'ok' : '') + '" dir="auto"><b>' + 'ABCDEFGH'[k] + '</b>' + rich(o, q) + '</li>').join('') + '</ul>';
  else if (q.type === 'match') body = '<ul>' + q.left.map((l, k) => '<li dir="auto">' + rich(l, q) + ' <b style="color:var(--muted)">→</b> ' + rich(q.a && q.a[k] != null ? q.right[q.a[k]] : '?', q) + '</li>').join('') + (q.right.length > q.left.length ? '<li class="muted">Extra choices: ' + esc(q.right.slice(q.left.length).join(', ')) + '</li>' : '') + '</ul>';
  else if (q.type === 'order') body = '<ul>' + q.o.map((o, k) => '<li dir="auto"><b>' + (k + 1) + '</b>' + rich(o, q) + '</li>').join('') + '</ul>';
  const key = G().keyText(q, S.test.lang);
  c.innerHTML = (q.sec ? '<div class="sec" dir="auto">' + esc(q.sec) + '</div>' : '') + '<div class="hd"><span class="no">' + (i + 1) + '</span><span class="chip" style="--t:' + T[2] + '">' + icon(T[1]) + T[0] + '</span><span class="pts">' + (q.pts || 1) + ' pt' + ((q.pts || 1) === 1 ? '' : 's') + '</span></div>' +
    '<div class="tx" dir="auto">' + (q.q ? rich(q.q, q) : '(no question text)') + '</div>' + (q.img ? '<img class="fig" src="' + q.img + '" alt="">' : '') + body +
    (nk ? '<div class="nokey">' + icon('triangle-alert') + ' No answer in the key — you will mark it, or click Edit to add it.</div>' : !/mc|multi|match|order/.test(q.type) ? '<div class="qkey" dir="auto">Answer: <b>' + rich(key, q) + '</b>' + (q.type === 'long' ? ' <span class="muted">(key words: ' + esc((q.a.keys || []).join(', ')) + ')</span>' : '') + '</div>' : '') +
    (q.ex ? '<div class="ex" dir="auto">📘 ' + rich(q.ex, q) + '</div>' : '') + (q.hint ? '<div class="ex" dir="auto">💡 ' + esc(q.hint) + '</div>' : '') +
    '<div class="act"><button class="btn sm" data-a="edit">' + icon('pencil') + 'Edit</button><button class="btn sm" data-a="pic">' + icon('image') + (q.img ? 'Change figure' : 'Add figure') + '</button>' + (q.img ? '<button class="btn sm" data-a="nopic">' + icon('image-off') + '</button>' : '') +
    '<button class="btn sm" data-a="up" title="Move up"' + (i === 0 ? ' disabled' : '') + '>' + icon('arrow-up') + '</button><button class="btn sm" data-a="down" title="Move down"' + (i === qs.length - 1 ? ' disabled' : '') + '>' + icon('arrow-down') + '</button><button class="btn sm" data-a="dup" title="Duplicate">' + icon('copy') + '</button><button class="btn sm" data-a="del" title="Delete">' + icon('trash-2') + '</button></div>';
  c.onclick = e => { const b = e.target.closest('button[data-a]'); if (!b) return; const a = b.dataset.a, k = qs.indexOf(q); S.dirty = true;
    if (a === 'edit') return edit(q, c);
    if (a === 'pic') return figure(q);
    if (a === 'nopic') q.img = null;
    if (a === 'up' && k > 0) [qs[k - 1], qs[k]] = [qs[k], qs[k - 1]];
    if (a === 'down' && k < qs.length - 1) [qs[k + 1], qs[k]] = [qs[k], qs[k + 1]];
    if (a === 'dup') qs.splice(k + 1, 0, Object.assign(JSON.parse(JSON.stringify(q)), { id: uid() }));
    if (a === 'del') { if (!confirm('Delete question ' + (k + 1) + '?')) return; qs.splice(k, 1); }
    review(); };
  return c;
}
/* the editor for one question */
function edit(q, c, fresh) {
  if (c.querySelector('.ed')) return; const ed = document.createElement('div'); ed.className = 'ed';
  const opts = (list, multi) => list.map((o, k) => '<div class="orow"><input type="' + (multi ? 'checkbox' : 'radio') + '" name="ok' + q.id + '" data-ok="' + k + '"' + ([].concat(q.a == null ? [] : q.a).includes(k) ? ' checked' : '') + ' title="Right answer"><input type="text" data-o="' + k + '" dir="auto" value="' + esc(o) + '" placeholder="Option ' + 'ABCDEFGH'[k] + '"><button class="btn sm" data-rm="' + k + '">' + icon('x') + '</button></div>').join('');
  const typeSel = '<select data-f="type">' + Object.entries(TYPE).map(([k, v]) => '<option value="' + k + '"' + (k === q.type ? ' selected' : '') + '>' + v[0] + '</option>').join('') + '</select>';
  let spec = '';
  if (q.type === 'mc' || q.type === 'multi') spec = '<span class="small muted">Tick the right answer' + (q.type === 'multi' ? 's' : '') + '.</span><div id="eo">' + opts(q.o, q.type === 'multi') + '</div><button class="btn sm" data-addo>' + icon('plus') + 'Option</button>';
  if (q.type === 'tf') spec = '<div class="seg"><button data-tf="1" class="' + (q.a === true ? 'on' : '') + '"><b>True</b></button><button data-tf="0" class="' + (q.a === false ? 'on' : '') + '"><b>False</b></button></div>';
  if (q.type === 'short') spec = '<label class="f"><span>Accepted answers (one per line)</span><textarea data-f="acc" dir="auto">' + esc([].concat(q.a || []).join('\n')) + '</textarea></label>';
  if (q.type === 'num') spec = '<div class="grid2"><label class="f"><span>Answer</span><input type="text" data-f="nv" value="' + esc(q.a ? q.a.v : '') + '"></label><label class="f"><span>Unit (optional)</span><input type="text" data-f="nu" value="' + esc(q.a ? q.a.unit : '') + '"></label></div><label class="f"><span>Allowed difference (empty = about 1%)</span><input type="text" data-f="nt" value="' + esc(q.a && q.a.tol !== '' ? q.a.tol : '') + '"></label>';
  if (q.type === 'blank') { const n = Math.max(1, (q.q.match(/_{3,}|\.{4,}|…{2,}/g) || []).length); spec = '<span class="small muted">Write ______ in the question for each blank. Accepted answers for each blank (use / between alternatives):</span>' + Array.from({ length: n }, (_, k) => '<div class="orow"><b>' + (k + 1) + '</b><input type="text" data-bl="' + k + '" dir="auto" value="' + esc(((q.a || [])[k] || []).join(' / ')) + '"></div>').join(''); }
  if (q.type === 'match') spec = '<span class="small muted">Each row is a pair. Extra choices (distractors) go in the last box, one per line.</span>' + q.left.map((l, k) => '<div class="orow"><input type="text" data-ml="' + k + '" dir="auto" value="' + esc(l) + '"><b>→</b><input type="text" data-mr="' + k + '" dir="auto" value="' + esc(q.right[q.a && q.a[k] != null ? q.a[k] : k] || '') + '"><button class="btn sm" data-mrm="' + k + '">' + icon('x') + '</button></div>').join('') + '<button class="btn sm" data-addm>' + icon('plus') + 'Pair</button><label class="f"><span>Extra choices</span><textarea data-f="mx" dir="auto">' + esc(q.right.filter((_, k) => !(q.a || []).includes(k)).join('\n')) + '</textarea></label>';
  if (q.type === 'order') spec = '<span class="small muted">Write the items in the RIGHT order — phones shuffle them.</span><div id="eo">' + q.o.map((o, k) => '<div class="orow"><b>' + (k + 1) + '</b><input type="text" data-oo="' + k + '" dir="auto" value="' + esc(o) + '"><button class="btn sm" data-rm="' + k + '">' + icon('x') + '</button></div>').join('') + '</div><button class="btn sm" data-addo>' + icon('plus') + 'Item</button>';
  if (q.type === 'long') spec = '<label class="f"><span>Model answer</span><textarea data-f="lt" dir="auto">' + esc(q.a ? q.a.text || '' : '') + '</textarea></label><label class="f"><span>Key words (comma between) — the answer scores by how many it contains; you can change any mark on the dashboard</span><input type="text" data-f="lk" dir="auto" value="' + esc(q.a ? (q.a.keys || []).join(', ') : '') + '"></label>';
  ed.innerHTML = '<div class="grid2"><label class="f"><span>Type</span>' + typeSel + '</label><label class="f"><span>Points</span><input type="number" min="0.5" step="0.5" data-f="pts" value="' + (q.pts || 1) + '"></label></div>' +
    '<label class="f"><span>Question</span><textarea data-f="q" dir="auto">' + esc(q.q) + '</textarea></label>' + spec +
    '<div class="grid2"><label class="f"><span>Explanation (shown after answering)</span><textarea data-f="ex" dir="auto">' + esc(q.ex || '') + '</textarea></label><label class="f"><span>Hint (for the second try)</span><textarea data-f="hint" dir="auto">' + esc(q.hint || '') + '</textarea></label></div>' +
    '<div class="foot" style="position:static;padding:4px 0 0"><button class="btn primary" data-done>' + icon('check') + 'Done</button></div>';
  ed.insertAdjacentHTML('afterbegin', '<p class="small muted" style="margin:0 0 6px">Copy a figure, drawing or equation (from Word, a PDF or the snipping tool) and press <b>Ctrl+V</b> in any box — it is placed there exactly as it is.</p><div class="qprev" dir="auto" style="display:none;margin:4px 0 8px;padding:8px 10px;border-radius:10px;background:var(--panel2)"></div>');
  c.appendChild(ed); c.querySelector('.act').hidden = true; const f = n => ed.querySelector('[data-f="' + n + '"]');
  const prev = () => { const pv = ed.querySelector('.qprev'), qt = f('q').value; pv.style.display = /⟦m:/.test(qt) ? '' : 'none'; pv.innerHTML = rich(qt, q); };
  ed.addEventListener('paste', async e => { const file = clipImage(e); if (!file) return; e.preventDefault(); e.stopPropagation(); const p = await picFrom(file); const box = e.target.closest('textarea,input[type=text]');
    if (box) { const tk = window.HBQI.token(p.src, Math.min(p.w, 560), Math.min(p.w, 560) * p.h / p.w), id = tk.slice(3, -1); q.media = Object.assign({}, q.media, { [id]: window.HBQI.media[id] }); const a = box.selectionStart, b = box.selectionEnd; box.value = box.value.slice(0, a) + tk + box.value.slice(b); box.selectionStart = box.selectionEnd = a + tk.length; read(); prev(); toast('Pasted exactly as it is.'); }
    else { q.img = p.src; S.dirty = true; ed.remove(); review(); toast('Figure pasted.'); } });
  setTimeout(prev, 0);
  const read = () => { q.q = f('q').value; q.pts = Math.max(0.5, +f('pts').value || 1); q.ex = f('ex').value.trim(); q.hint = f('hint').value.trim();
    if (q.type === 'mc' || q.type === 'multi') { q.o = $$('[data-o]', ed).map(i => i.value); const ok = $$('[data-ok]', ed).filter(i => i.checked).map(i => +i.dataset.ok); q.a = q.type === 'mc' ? (ok.length ? ok[0] : null) : (ok.length ? ok : null); }
    if (q.type === 'short') { const a = f('acc').value.split('\n').map(s => s.trim()).filter(Boolean); q.a = a.length ? a : null; }
    if (q.type === 'num') { const v = parseFloat(G().num(f('nv').value)); q.a = Number.isFinite(v) ? { v, unit: f('nu').value.trim(), tol: f('nt').value.trim() === '' ? '' : Math.abs(parseFloat(f('nt').value)) } : null; }
    if (q.type === 'blank') { const a = $$('[data-bl]', ed).map(i => i.value.split('/').map(s => s.trim()).filter(Boolean)); q.a = a.length && a.every(x => x.length) ? a : null; }
    if (q.type === 'match') { const L = $$('[data-ml]', ed).map(i => i.value.trim()), R = $$('[data-mr]', ed).map(i => i.value.trim()), X = f('mx').value.split('\n').map(s => s.trim()).filter(Boolean); q.left = L; q.right = R.concat(X); q.a = L.map((_, k) => k); }
    if (q.type === 'order') { q.o = $$('[data-oo]', ed).map(i => i.value); q.a = true; }
    if (q.type === 'long') { const keys = f('lk').value.split(/[,،]/).map(s => s.trim()).filter(Boolean); const text = f('lt').value.trim(); q.a = keys.length || text ? { keys: keys.length ? keys : window.HBQP.keywords(text), text } : null; }
    attachMedia(q); S.dirty = true; };
  ed.oninput = () => { try { read(); prev(); } catch (e) {} };
  ed.onchange = e => { if (e.target.dataset.f === 'type') { read(); const nt = e.target.value; Object.assign(q, convert(q, nt)); review(); const cc = $$('#qbList .q')[S.test.questions.indexOf(q)]; cc && edit(q, cc); } else read(); };
  ed.onclick = e => { const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.tf != null) { q.a = b.dataset.tf === '1'; $$('[data-tf]', ed).forEach(x => x.classList.toggle('on', x === b)); S.dirty = true; return; }
    if (b.hasAttribute('data-done')) { read(); review(); return; }
    read();
    if (b.dataset.rm != null) { q.o.splice(+b.dataset.rm, 1); if (q.type === 'mc' && q.a != null) q.a = q.a === +b.dataset.rm ? null : q.a > +b.dataset.rm ? q.a - 1 : q.a; if (q.type === 'multi' && q.a) q.a = q.a.filter(k => k !== +b.dataset.rm).map(k => k > +b.dataset.rm ? k - 1 : k); }
    else if (b.hasAttribute('data-addo')) q.o.push('');
    else if (b.dataset.mrm != null) { const k = +b.dataset.mrm; q.left.splice(k, 1); q.right.splice(k, 1); q.a = q.left.map((_, j) => j); }
    else if (b.hasAttribute('data-addm')) { q.left.push(''); q.right.splice(q.left.length - 1, 0, ''); q.a = q.left.map((_, j) => j); }
    else return;
    ed.remove(); c.querySelector('.act').hidden = false; edit(q, c); };
  if (fresh) setTimeout(() => f('q').focus(), 50);
}
function convert(q, type) { const n = blankQ(type); n.id = q.id; n.q = q.q; n.pts = q.pts; n.ex = q.ex; n.hint = q.hint; n.img = q.img; n.sec = q.sec;
  if ((type === 'mc' || type === 'multi' || type === 'order') && q.o) n.o = q.o.slice();
  if (type === 'mc' && q.type === 'multi' && q.a) n.a = q.a[0]; if (type === 'multi' && q.type === 'mc' && q.a != null) n.a = [q.a];
  if (type === 'short' && q.type === 'long' && q.a) n.a = [q.a.text]; if (type === 'long' && q.type === 'short' && q.a) n.a = { keys: window.HBQP.keywords(q.a[0] || ''), text: q.a[0] || '' };
  return n; }

/* a figure for a question: crop it from the worksheet page, or choose a picture */
function figure(q) {
  const pages = S.pages || []; S.figQ = q;
  modal.open('<h2>Figure for this question</h2>' + ('<p class="small muted">Or copy the figure, drawing or equation anywhere (Word, PDF, the snipping tool) and press <b>Ctrl+V</b> here — it is used exactly as it is.</p>') + (pages.length ? '<p class="small muted">Drag over the figure, graph or shape on the page. Page: <select id="fgP">' + pages.map((p, k) => '<option value="' + k + '">' + (k + 1) + '</option>').join('') + '</select></p><div style="max-height:72vh;overflow:auto;text-align:center"><div class="qb-crop" id="fgC"><img id="fgI" src="' + pages[0].img + '" alt=""><i hidden></i></div></div>' : '<p class="muted">Choose a picture from this computer (a photo, a scan or a screenshot of the figure).</p>') +
    '<div class="foot"><button class="btn" id="fgFile">' + icon('image-plus') + 'Choose a picture…</button>' + (pages.length ? '<button class="btn primary" id="fgOk" disabled>' + icon('crop') + 'Use the selection</button>' : '') + '</div>', () => {
    const file = $('#fgFile'); file.onclick = () => { const inp = document.createElement('input'); inp.type = 'file'; inp.accept = 'image/*'; inp.onchange = () => { const f = inp.files[0]; if (!f) return; const img = new Image(); img.onload = () => { const cv = document.createElement('canvas'); cv.width = img.naturalWidth; cv.height = img.naturalHeight; cv.getContext('2d').drawImage(img, 0, 0); q.img = window.HBQI.crop(cv, 0, 0, cv.width, cv.height); modal.close(); S.dirty = true; review(); }; img.src = URL.createObjectURL(f); }; inp.click(); };
    if (!pages.length) return;
    const box = $('#fgC'), im = $('#fgI'), r = box.querySelector('i'); let sel = null, p0 = null;
    $('#fgP').onchange = e => { im.src = pages[+e.target.value].img; r.hidden = true; sel = null; $('#fgOk').disabled = true; };
    box.onpointerdown = e => { const b = im.getBoundingClientRect(); p0 = [e.clientX - b.left, e.clientY - b.top]; box.setPointerCapture(e.pointerId); r.hidden = false; };
    box.onpointermove = e => { if (!p0) return; const b = im.getBoundingClientRect(), x = Math.max(0, Math.min(b.width, e.clientX - b.left)), y = Math.max(0, Math.min(b.height, e.clientY - b.top));
      sel = [Math.min(p0[0], x), Math.min(p0[1], y), Math.abs(x - p0[0]), Math.abs(y - p0[1])]; Object.assign(r.style, { left: sel[0] + 'px', top: sel[1] + 'px', width: sel[2] + 'px', height: sel[3] + 'px' }); };
    box.onpointerup = () => { p0 = null; $('#fgOk').disabled = !(sel && sel[2] > 8 && sel[3] > 8); };
    $('#fgOk').onclick = () => { const b = im.getBoundingClientRect(), k = im.naturalWidth / b.width, cv = document.createElement('canvas'); cv.width = im.naturalWidth; cv.height = im.naturalHeight; cv.getContext('2d').drawImage(im, 0, 0);
      q.img = window.HBQI.crop(cv, sel[0] * k, sel[1] * k, sel[2] * k, sel[3] * k); modal.close(); S.dirty = true; review(); };
  });
}
/* Ctrl+V on a question card (or in the figure window) puts the copied picture in as its figure, unchanged */
document.addEventListener('paste', async e => { if (!S.el || !S.test) return; if (e.target.closest && e.target.closest('textarea,input')) return; const file = clipImage(e); if (!file) return;
  const fig = document.getElementById('fgFile') && S.figQ, c = document.activeElement && document.activeElement.closest && document.activeElement.closest('#qbList .q'), q = fig || (c && S.test.questions.find(x => x.id === c.dataset.id)); if (!q) return;
  e.preventDefault(); const p = await picFrom(file); q.img = p.src; S.dirty = true; if (fig) modal.close(); review(); toast('Figure pasted into question ' + (S.test.questions.indexOf(q) + 1) + '.'); });
async function save() { const t = S.test; if (!t.title.trim()) t.title = 'Test'; await store.save(t); S.dirty = false; }

/* ---------- give the test ---------- */
async function start(id) {
  const t = await store.get(id); if (!t) return toast('That test could not be found.');
  if (!D()) return modal.open('<h2>Tests on phones</h2><p>Tests run on students\' phones through the class link. This needs the <b>HelixBoard Windows app</b>.</p><div class="foot"><button class="btn primary" onclick="HB.modal.close()">OK</button></div>');
  if (!window.HBCL.on) { await HBCL.start({ quiet: true }); if (!HBCL.on) return; }
  if (S.open && S.open.testId !== id) { if (!confirm('Another test is running. Close it and start this one?')) return; await stop(); }
  const def = { id: t.id, title: t.title, lang: t.lang, settings: t.settings, questions: t.questions.map(q => { const c = Object.assign({}, q); delete c.id; delete c.num; return c; }) };
  const ok = await D().cmd('testStart', def); if (!ok) return toast('The test could not start.');
  const run = { id: uid(), testId: t.id, title: t.title, cls: t.cls || (window.HBX ? HBX.cur() : ''), at: Date.now(), papers: [], over: {}, open: true };
  S.open = run; await store.saveRun(run); refreshLib(); window.HBLC && HBLC.hide && HBLC.hide();
  toast('“' + t.title + '” is open on every phone in the class link.', 4200);
  window.HBTD && HBTD.open(t.id, run.id, true);
}
async function stop() { if (!S.open) return; try { await D().cmd('testOpen', false); await sync(); await D().cmd('testEnd'); } catch (e) {} S.open.open = false; S.open.closedAt = Date.now(); await store.saveRun(S.open); S.open = null; refreshLib(); }
/* copy the server's papers into the saved run */
async function sync() { if (!S.open || !D()) return null; const r = await D().cmd('testResults'); if (!r || r.id !== S.open.testId) return null; const t = await store.get(S.open.testId);
  S.open.papers = r.papers.map(p => { const m = t ? G().mark(t, t.questions.map((q, i) => p.ans[i]), t.questions.map((q, i) => p.tries[i] || 0), overOf(S.open.over, p.pid)) : p.mark; return Object.assign({}, p, { pct: m.pct, got: m.got, max: m.max, per: m.per }); });
  S.open.open = r.open; await store.saveRun(S.open); return S.open; }
const overOf = (over, pid) => { const o = {}; Object.keys(over || {}).forEach(k => { const [p, i] = k.split(':'); if (p === pid) o[i] = over[k]; }); return o; };
let syncT = 0; function event(d) { clearTimeout(syncT); syncT = setTimeout(async () => { const r = await sync(); if (r && window.HBTD) HBTD.update(r); if (d && d.kind === 'done' && d.name) toast('✅ ' + esc(d.name) + ' handed in the test.', 2600); }, 250); }
let libEl = null; function refreshLib() { if (libEl && libEl.isConnected) renderLib(libEl); }

window.HBQB = { renderLib: m => { libEl = m; return renderLib(m); }, wizard, start, stop, sync, event, store, overOf, TYPE, get open() { return S.open; }, setOpen(r) { S.open = r; } };
})();
