/* ================= HelixBoard — Bubble-sheet exam (v2.7.0): the document as it is + a bubble sheet, like ZipGrade =================
   Settings first (title, class, time, how many questions and their answer types by range, points, negative marking, pass mark,
   what students see afterwards, sheet direction and letters). Then the document — a PDF, a Word file (made into a PDF on this
   computer so every phone sees the same pages) or photos — and the answer key: tap the bubbles, paste "1A 2C 3B", upload a key
   file (the worksheet key reader), or let it find the key at the end of the document. It runs through the same class link,
   marking and dashboard as Tests; the key never leaves this computer. A printable bubble sheet is made from the same settings. */
(() => {
'use strict';
const { $, $$, esc, icon, set, toast, modal } = window.HB;
const D = () => window.helixDesktop;
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const AR_LET = ['أ', 'ب', 'ج', 'د', 'هـ', 'و'], LET = 'ABCDEF';
const S = { el: null, t: null };

/* "1-20 A-D, 21-25 TF, 26-30 A-E" → one type per question */
function ranges(text, n, dflt) { const types = Array.from({ length: n }, () => dflt);
  String(text || '').split(/[,;\n،]+/).forEach(part => { const m = part.trim().match(/^(\d+)\s*[-–to]+\s*(\d+)\s*(.*)$/i) || part.trim().match(/^(\d+)()\s*(.*)$/); if (!m) return; const a = +m[1], b = +(m[2] || m[1]), ty = typeOf(m[3]); if (!ty) return; for (let i = Math.max(1, a); i <= Math.min(n, b); i++) types[i - 1] = ty; });
  return types; }
function typeOf(s) { s = String(s || '').toUpperCase().replace(/\s+/g, ''); if (/^(TF|T\/F|TRUE\/?FALSE|صح\/?خطأ)$/.test(s)) return 'tf'; const m = s.match(/^A[-–]?([B-F])$/); return m ? 'ab' + 'ABCDEF'.indexOf(m[1]) : null; }
const optsOf = ty => ty === 'tf' ? null : LET.slice(0, (+ty.slice(2)) + 1).split('');
/* a key value from text: "B", "b)", "ب", "True", "T", "صح" */
function keyVal(ty, raw) { const s = String(raw == null ? '' : raw).trim(); if (!s) return null;
  if (ty === 'tf') { if (/^(t|true|صح|ص|صواب|✓)\b/i.test(s)) return true; if (/^(f|false|خطأ|خ|✗)\b/i.test(s)) return false; return null; }
  const m = s.match(/^[\(\[]?\s*([A-Fa-f]|هـ|أ|ب|ج|د|ه|و)(?![A-Za-z])/); if (!m) return null; let k = /[a-f]/i.test(m[1]) ? m[1].toUpperCase().charCodeAt(0) - 65 : AR_LET.indexOf(m[1] === 'ه' ? 'هـ' : m[1]);
  return k >= 0 && k < optsOf(ty).length ? k : null; }
/* "1A 2C 3B", "1-a, 2-c", "1. B 2. True", or just "ACBD…" */
function parsePaste(text, types) { const out = types.map(() => null), s = String(text || '');
  const ms = [...s.matchAll(/(\d{1,3})\s*[-.):=]?\s*(true|false|صح|خطأ|[A-Fa-fTF]|هـ|أ|ب|ج|د)(?![A-Za-z])/gi)];
  if (ms.length) ms.forEach(m => { const i = +m[1] - 1; if (i >= 0 && i < types.length) out[i] = keyVal(types[i], m[2]); });
  else [...s.replace(/[^A-Fa-fTFأبجد]/g, '')].forEach((c, i) => { if (i < types.length) out[i] = keyVal(types[i], c); });
  return out; }
/* a key file or the end of the document → values, through the worksheet key reader */
function keyFromLines(lines, types, needHeading) { const txt = l => l.cells && l.cells.length >= 2 ? l.cells.join('\t') : (l.t || '');
  const from = lines.findIndex(l => l.t && /^\s*(?:answer\s*key|answers?\b|key\b|mark\s*scheme|الإجابات|الاجابات|مفتاح\s*الإجابة)/i.test(l.t));
  if (needHeading && from < 0) return null; const L = (from >= 0 ? lines.slice(from + 1) : lines).filter(l => l.t).map(txt);
  const Q = types.map((_, i) => ({ num: i + 1, blk: 0, opts: [], text: '' })), map = window.HBQP.parseKey(L, Q);
  const out = Q.map((q, i) => keyVal(types[i], map.get(q))); return out.some(v => v != null) ? out : null; }

/* ---------- the document → page pictures ---------- */
async function pdfPages(buf, prog) { const lib = await window.HBIO.loadPdf(), doc = await lib.getDocument({ data: new Uint8Array(buf) }).promise, out = [], n = Math.min(doc.numPages, 40);
  for (let p = 1; p <= n; p++) { prog && prog('Page ' + p + ' of ' + n + '…'); const pg = await doc.getPage(p), v0 = pg.getViewport({ scale: 1 }), vp = pg.getViewport({ scale: Math.min(2.2, 1400 / v0.width) }), c = document.createElement('canvas');
    c.width = Math.round(vp.width); c.height = Math.round(vp.height); const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); await pg.render({ canvasContext: g, canvas: c, viewport: vp }).promise; out.push(c.toDataURL('image/jpeg', 0.86)); pg.cleanup && pg.cleanup(); }
  return out; }
async function readDoc(files, prog) { const f = files[0], name = (f.name || '').toLowerCase();
  if (/\.pdf$/.test(name) || f.type === 'application/pdf') return { pages: await pdfPages(await f.arrayBuffer(), prog), lines: (await window.HBQI.read([f], null, 'en').catch(() => ({ lines: [] }))).lines };
  if (/\.docx$/.test(name)) { if (!D() || !D().docPdf) throw new Error('Word files need the Windows app. Save the file as PDF and choose that instead.');
    prog && prog('Making the Word file into pages…'); const mm = await window.HB.need('mammoth'); const html = (await mm.convertToHtml({ arrayBuffer: await f.arrayBuffer() })).value;
    const pdf = await D().docPdf('<!doctype html><meta charset="utf-8"><style>body{font:12pt Calibri,Arial,sans-serif;margin:0} img{max-width:100%} table{border-collapse:collapse} td,th{border:1px solid #999;padding:4px 6px}</style><body dir="auto">' + html + '</body>');
    return { pages: await pdfPages(pdf.buffer ? pdf.buffer.slice(pdf.byteOffset, pdf.byteOffset + pdf.byteLength) : pdf, prog), lines: (await window.HBQI.read([f], null, 'en').catch(() => ({ lines: [] }))).lines }; }
  if (files.every(x => /^image\//.test(x.type))) { const pages = []; for (const x of files) pages.push(await new Promise(ok => { const r = new FileReader(); r.onload = () => ok(r.result); r.readAsDataURL(x); })); return { pages, lines: [] }; }
  throw new Error('Choose a PDF, a Word (.docx) file or photos of the pages.'); }

/* ---------- the builder ---------- */
const css = document.createElement('style'); css.textContent = `
#sxStage{position:fixed;inset:0;z-index:48;background:var(--bg);color:var(--ink);display:flex;flex-direction:column;font-family:var(--ui)}
#sxStage .top{display:flex;align-items:center;gap:10px;padding:10px 16px;border-bottom:1px solid var(--line);background:linear-gradient(180deg,var(--panel2),var(--panel));min-height:60px}
#sxStage .top h2{margin:0;font:800 19px var(--head);display:flex;gap:10px;align-items:center;flex:1} #sxStage .top h2 svg{color:var(--accent)}
#sxStage .body{flex:1;overflow:auto;padding:20px 20px 90px} #sxStage .wrap{max-width:980px;margin:0 auto}
#sxStage .card{background:var(--panel);border:1px solid var(--line);border-radius:16px;padding:16px 18px;margin-bottom:14px}
#sxStage h3{margin:0 0 10px;font:700 13px var(--ui);letter-spacing:.08em;text-transform:uppercase;color:var(--muted)}
#sxStage .g{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:12px}
#sxStage label{display:block;font-size:13.5px;font-weight:600;color:var(--muted)} #sxStage label>*{margin-top:5px}
#sxStage input,#sxStage select,#sxStage textarea{width:100%;background:var(--panel2);border:1px solid var(--line);border-radius:10px;color:var(--ink);font:inherit;font-size:15px;padding:9px 11px}
#sxStage .drop{border:2px dashed var(--line);border-radius:16px;padding:22px;text-align:center;cursor:pointer} #sxStage .drop:hover{border-color:var(--accent)}
#sxStage .thumbs{display:flex;gap:8px;overflow-x:auto;margin-top:10px} #sxStage .thumbs img{height:120px;border-radius:6px;background:#fff;border:1px solid var(--line)}
#sxStage .kg{display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:4px 16px}
#sxStage .kr{display:flex;align-items:center;gap:6px;padding:3px 0} #sxStage .kr b{width:32px;text-align:end;font:800 14px var(--mono);color:var(--muted)}
#sxStage .kb{width:40px;height:40px;border-radius:50%;border:2px solid var(--line);background:var(--panel2);color:var(--muted);font:700 15px var(--ui);cursor:pointer}
#sxStage .kb.on{background:#1F9A56;border-color:#1F9A56;color:#fff}
#sxStage .kr.miss b{color:#fab219}
#sxStage .foot{position:fixed;left:0;right:0;bottom:0;display:flex;gap:10px;justify-content:center;padding:12px;background:linear-gradient(transparent,var(--bg) 35%)}
`; document.head.appendChild(css);

function open(t) {
  S.t = t ? JSON.parse(JSON.stringify(t)) : { id: uid(), kind: 'sheet', title: '', cls: window.HBX ? HBX.cur() : '', lang: set.get('lang', 'en') === 'ar' ? 'ar' : 'en', doc: [], questions: [],
    settings: Object.assign({ feedback: 'end', retry: false, shuffleQ: false, shuffleO: false, nav: true, strict: true, time: 40, pass: 50, show: 'score', dir: 'ltr', letters: 'en', n: 20, ranges: '', dflt: 'ab3', pts: 1, neg: 0 }, set.get('sheetDefaults', {})), key: [] };
  if (S.el) S.el.remove(); const el = document.createElement('div'); el.id = 'sxStage'; document.body.appendChild(el); S.el = el; draw(); }
function types() { const s = S.t.settings; return ranges(s.ranges, s.n, s.dflt); }
function draw() {
  const t = S.t, s = t.settings, ty = types(); while (t.key.length < s.n) t.key.push(null); t.key.length = s.n;
  const missing = t.key.filter((v, i) => v == null).length;
  S.el.innerHTML = '<div class="top"><h2>' + icon('scan-line') + 'Bubble-sheet exam</h2><button class="btn sm" id="sxPrint">' + icon('printer') + 'Print bubble sheet</button><button class="btn sm" id="sxClose">' + icon('x') + 'Close</button></div><div class="body"><div class="wrap">' +
    '<div class="card"><h3>1 · Exam and settings</h3><div class="g">' +
    '<label>Exam name<input id="sxT" dir="auto" maxlength="90" value="' + esc(t.title) + '" placeholder="e.g. Biology midterm"></label>' +
    '<label>Class<select id="sxC">' + (window.HBX ? HBX.classOptions(t.cls) : '<option value="">No class</option>') + '</select></label>' +
    '<label>Time (minutes, 0 = none)<input id="sxTime" type="number" min="0" max="300" value="' + s.time + '"></label>' +
    '<label>Number of questions<input id="sxN" type="number" min="1" max="100" value="' + s.n + '"></label>' +
    '<label>Answer type<select id="sxDf">' + [['ab3', 'A–D'], ['ab4', 'A–E'], ['ab2', 'A–C'], ['ab1', 'A–B'], ['tf', 'True / False']].map(([v, l]) => '<option value="' + v + '"' + (s.dflt === v ? ' selected' : '') + '>' + l + '</option>').join('') + '</select></label>' +
    '<label>Different types by range<input id="sxR" value="' + esc(s.ranges) + '" placeholder="e.g. 21-25 TF, 26-30 A-E"></label>' +
    '<label>Points per question<input id="sxP" type="number" min="0.5" step="0.5" value="' + s.pts + '"></label>' +
    '<label>Minus for a wrong answer<input id="sxNeg" type="number" min="0" step="0.25" value="' + s.neg + '"></label>' +
    '<label>Pass mark (%)<input id="sxPass" type="number" min="0" max="100" value="' + s.pass + '"></label>' +
    '<label>After handing in, students see<select id="sxShow">' + [['none', 'Nothing'], ['score', 'Their score'], ['key', 'Score and right answers']].map(([v, l]) => '<option value="' + v + '"' + (s.show === v ? ' selected' : '') + '>' + l + '</option>').join('') + '</select></label>' +
    '<label>Sheet direction<select id="sxDir"><option value="ltr"' + (s.dir === 'ltr' ? ' selected' : '') + '>Left to right</option><option value="rtl"' + (s.dir === 'rtl' ? ' selected' : '') + '>Right to left (Arabic)</option></select></label>' +
    '<label>Letters and numbers<select id="sxLet"><option value="en"' + (s.letters === 'en' ? ' selected' : '') + '>A B C D · 1 2 3</option><option value="ar"' + (s.letters === 'ar' ? ' selected' : '') + '>أ ب ج د · ١ ٢ ٣</option></select></label>' +
    '<label>Phone language<select id="sxL"><option value="en"' + (t.lang !== 'ar' ? ' selected' : '') + '>English</option><option value="ar"' + (t.lang === 'ar' ? ' selected' : '') + '>العربية</option></select></label></div>' +
    '<p class="small muted" style="margin:10px 0 0">Students answer on their phones through the class link; your HelixBoard must stay open while the exam runs. Leaving the page or full screen is recorded for you.</p></div>' +
    '<div class="card"><h3>2 · The exam document (shown to students exactly as it is)</h3><div class="drop" id="sxDrop">' + icon('file-up') + '<div><b>Drop the PDF, Word file or photos of the pages</b></div><div class="small muted" id="sxMsg">' + (t.doc.length ? t.doc.length + ' page' + (t.doc.length === 1 ? '' : 's') + ' ready — drop another file to replace' : 'Optional: without a document students see only the bubble sheet.') + '</div></div>' +
    (t.doc.length ? '<div class="thumbs">' + t.doc.slice(0, 12).map(p => '<img src="' + p + '" alt="">').join('') + '</div>' : '') + '</div>' +
    '<div class="card"><h3>3 · Answer key ' + (missing ? '<span style="color:#fab219">· ' + missing + ' missing</span>' : '<span style="color:#4ADE80">· complete</span>') + '</h3>' +
    '<div class="g" style="margin-bottom:12px"><label>Paste the key<textarea id="sxPaste" rows="2" placeholder="1A 2C 3B 4D …  or  ACBD…"></textarea></label><div style="display:flex;flex-direction:column;gap:8px;justify-content:flex-end"><button class="btn" id="sxUsePaste">' + icon('clipboard-paste') + 'Use the pasted key</button><button class="btn" id="sxKeyFile">' + icon('file-key') + 'Upload an answer-key file</button></div></div>' +
    '<div class="kg">' + ty.map((tp, i) => { const o = tp === 'tf' ? [[true, 'T'], [false, 'F']] : optsOf(tp).map((l, k) => [k, s.letters === 'ar' ? AR_LET[k] : l]);
      return '<div class="kr' + (t.key[i] == null ? ' miss' : '') + '"><b>' + (i + 1) + '</b>' + o.map(([v, l]) => '<button class="kb' + (t.key[i] === v ? ' on' : '') + '" data-q="' + i + '" data-v="' + v + '">' + l + '</button>').join('') + '</div>'; }).join('') + '</div></div>' +
    '</div></div><div class="foot"><button class="btn" id="sxSave">' + icon('save') + 'Save</button><button class="btn primary" id="sxGo">' + icon('play') + 'Save and start on the phones</button></div>';
  const q = sel => S.el.querySelector(sel);
  q('#sxClose').onclick = () => { S.el.remove(); S.el = null; };
  if (window.HBX) HBX.bindClassSelect(q('#sxC'));
  const read = () => { t.title = q('#sxT').value.trim(); t.cls = q('#sxC').value === '__new' ? '' : q('#sxC').value; t.lang = q('#sxL').value;
    Object.assign(s, { time: Math.max(0, +q('#sxTime').value || 0), n: Math.max(1, Math.min(100, +q('#sxN').value || 1)), dflt: q('#sxDf').value, ranges: q('#sxR').value.trim(), pts: Math.max(0.5, +q('#sxP').value || 1), neg: Math.max(0, +q('#sxNeg').value || 0), pass: Math.max(0, Math.min(100, +q('#sxPass').value || 0)), show: q('#sxShow').value, dir: q('#sxDir').value, letters: q('#sxLet').value });
    s.showScore = s.show !== 'none'; s.showKey = s.show === 'key'; };
  $$('#sxStage .card:first-child input, #sxStage .card:first-child select').forEach(x => x.onchange = () => { read(); draw(); });
  $$('#sxStage .kb').forEach(b => b.onclick = () => { read(); const i = +b.dataset.q, v = b.dataset.v === 'true' ? true : b.dataset.v === 'false' ? false : +b.dataset.v; t.key[i] = t.key[i] === v ? null : v; draw(); });
  q('#sxUsePaste').onclick = () => { read(); const k = parsePaste(q('#sxPaste').value, types()), n = k.filter(v => v != null).length; if (!n) return toast('No answers found — write them like 1A 2C 3B.'); k.forEach((v, i) => { if (v != null) t.key[i] = v; }); toast(n + ' answers set.'); draw(); };
  const pick = (accept, multi) => new Promise(ok => { const inp = document.createElement('input'); inp.type = 'file'; inp.accept = accept; inp.multiple = !!multi; inp.onchange = () => ok([...inp.files]); inp.click(); });
  q('#sxKeyFile').onclick = async () => { read(); const fs = await pick('.pdf,.docx,.txt,image/*'); if (!fs.length) return; toast('Reading the key…');
    try { const r = await window.HBQI.read(fs, null, t.lang); const k = keyFromLines(r.lines, types(), false); if (!k) return toast('No answers were found in that file.'); let n = 0; k.forEach((v, i) => { if (v != null) { t.key[i] = v; n++; } }); toast(n + ' answers read from the key file.'); draw(); } catch (e) { toast(e.message); } };
  const drop = q('#sxDrop'), load = async fs => { if (!fs.length) return; read(); const msg = q('#sxMsg');
    try { const r = await readDoc(fs, m => { msg.textContent = m; }); t.doc = r.pages; if (!t.title) t.title = fs[0].name.replace(/\.[^.]+$/, '').slice(0, 90);
      const k = r.lines && r.lines.length ? keyFromLines(r.lines, types(), true) : null; if (k && t.key.every(v => v == null)) { k.forEach((v, i) => { t.key[i] = v; }); toast('The answer key at the end of the document was read — check it below.', 4200); }
      draw(); } catch (e) { msg.innerHTML = '<span style="color:var(--bad,#FF6B6B)">' + esc(e.message || String(e)) + '</span>'; } };
  drop.onclick = async () => load(await pick('.pdf,.docx,image/*', true));
  drop.ondragover = e => e.preventDefault(); drop.ondrop = e => { e.preventDefault(); load([...e.dataTransfer.files]); };
  q('#sxPrint').onclick = () => { read(); printSheet(); };
  q('#sxSave').onclick = async () => { read(); await save(); toast('Exam saved in Live class → Tests.'); };
  q('#sxGo').onclick = async () => { read(); if (t.key.some(v => v == null)) return toast('Some questions have no answer in the key yet.'); await save(); S.el.remove(); S.el = null; window.HBQB.start(t.id); };
}
async function save() { const t = S.t, s = t.settings, ty = types(); if (!t.title) t.title = 'Exam';
  set.put('sheetDefaults', { time: s.time, pass: s.pass, show: s.show, dir: s.dir, letters: s.letters, dflt: s.dflt, pts: s.pts, neg: s.neg });
  t.questions = ty.map((tp, i) => tp === 'tf' ? { type: 'tf', q: 'Question ' + (i + 1), a: t.key[i] == null ? null : !!t.key[i], pts: s.pts } : { type: 'mc', q: 'Question ' + (i + 1), o: optsOf(tp).map((l, k) => s.letters === 'ar' ? AR_LET[k] : l), a: t.key[i], pts: s.pts });
  s.feedback = 'end'; await window.HBQB.store.save(t); }

/* ---------- a printable bubble sheet (A4), from the same settings ---------- */
function printSheet() { const t = S.t, s = t.settings, ty = types(), rtl = s.dir === 'rtl', ar = s.letters === 'ar', num = n => ar ? String(n).replace(/\d/g, d => '٠١٢٣٤٥٦٧٨٩'[d]) : n;
  const cols = s.n <= 25 ? 1 : s.n <= 50 ? 2 : s.n <= 75 ? 3 : 4, per = Math.ceil(s.n / cols);
  const row = i => { const tp = ty[i], o = tp === 'tf' ? (ar ? ['ص', 'خ'] : ['T', 'F']) : optsOf(tp).map((l, k) => ar ? AR_LET[k] : l); return '<div class="r"><b>' + num(i + 1) + '</b>' + o.map(l => '<i>' + l + '</i>').join('') + '</div>'; };
  const id = Array.from({ length: 4 }, (_, c) => '<div class="idc">' + Array.from({ length: 10 }, (_, d) => '<i>' + num(d) + '</i>').join('') + '</div>').join('');
  const html = '<!doctype html><html dir="' + (rtl ? 'rtl' : 'ltr') + '"><head><meta charset="utf-8"><title>' + esc(t.title || 'Bubble sheet') + '</title><style>@page{size:A4;margin:12mm} body{font:11pt "Segoe UI",Arial,sans-serif;margin:0;color:#111} .f{position:fixed;width:9mm;height:9mm;background:#000} .f.a{top:0;left:0}.f.b{top:0;right:0}.f.c{bottom:0;left:0}.f.d{bottom:0;right:0}' +
    'h1{font-size:16pt;margin:0 14mm 4mm;text-align:center} .meta{display:flex;gap:8mm;margin:0 14mm 4mm;font-size:11pt} .meta span{flex:1;border-bottom:1px solid #333;padding-bottom:2mm} .ids{display:flex;gap:3mm;justify-content:center;margin-bottom:5mm} .idc{display:flex;flex-direction:column;gap:1mm} .idc i,.r i{display:inline-grid;place-items:center;width:6.5mm;height:6.5mm;border:1.3px solid #222;border-radius:50%;font-style:normal;font-size:8pt;margin:0 .8mm}' +
    '.cols{display:grid;grid-template-columns:repeat(' + cols + ',1fr);gap:4mm 6mm;margin:0 12mm} .r{display:flex;align-items:center;height:8.6mm} .r b{width:9mm;text-align:end;margin-inline-end:2mm;font-size:10pt} .code{position:fixed;bottom:2mm;left:0;right:0;text-align:center;font:9pt monospace;color:#555}</style></head><body>' +
    '<div class="f a"></div><div class="f b"></div><div class="f c"></div><div class="f d"></div><h1>' + esc(t.title || 'Exam') + '</h1><div class="meta"><span>' + (ar ? 'الاسم:' : 'Name:') + '</span><span>' + (ar ? 'الصف:' : 'Class:') + ' ' + esc(t.cls || '') + '</span><span>' + (ar ? 'التاريخ:' : 'Date:') + '</span></div>' +
    '<div style="text-align:center;font-size:9pt;margin-bottom:1mm">' + (ar ? 'رقم الطالب' : 'Student ID') + '</div><div class="ids">' + id + '</div>' +
    '<div class="cols">' + Array.from({ length: cols }, (_, c) => '<div>' + Array.from({ length: per }, (_, r) => c * per + r).filter(i => i < s.n).map(row).join('') + '</div>').join('') + '</div><div class="code">HB-' + esc(t.id) + ' · ' + s.n + 'Q</div></body></html>';
  const fr = document.createElement('iframe'); fr.style.cssText = 'position:fixed;width:0;height:0;border:0;left:-9999px'; document.body.appendChild(fr); fr.srcdoc = html;
  fr.onload = () => { try { fr.contentWindow.focus(); fr.contentWindow.print(); } catch (e) { toast('Printing is not available here.'); } setTimeout(() => fr.remove(), 60000); }; }

window.HBSX = { open, ranges, parsePaste, keyFromLines, keyVal, printSheet };
})();
