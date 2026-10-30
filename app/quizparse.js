/* ================= HelixBoard — worksheet → test (no AI) =================
   Reads the lines of a worksheet (from a PDF, a Word file, a photo or pasted text) and finds the questions, their options,
   blanks, matching columns, items to put in order, figures, marks, sections and the answer key — wherever the key is:
   a key page at the end ("Answer key: 1-B 2-C 3-True"), "Answer: B" under a question, or the right option marked in the
   document (✓, *, bold or underlined). English and Arabic.
   A line is { t: text, b: bold, u: underlined, cells: [..] } or a figure { img: dataURL, w, h }. */
(function (root) {
'use strict';
const AR_LET = { 'أ': 0, 'ا': 0, 'ب': 1, 'ج': 2, 'د': 3, 'ه': 4, 'هـ': 4, 'و': 5, 'ز': 6, 'ح': 7 };
const digits = s => String(s == null ? '' : s).replace(/[٠-٩۰-۹]/g, d => String(d.charCodeAt(0) & 15));
const letterIdx = l => { if (l == null) return -1; l = String(l).trim(); if (/^[a-h]$/i.test(l)) return l.toLowerCase().charCodeAt(0) - 97; return AR_LET[l] != null ? AR_LET[l] : -1; };
const BLANK = /_{3,}|\.{4,}|…{2,}/g;
const hasBlank = s => /_{3,}|\.{4,}|…{2,}/.test(s);

/* ---------- what a line is ---------- */
const KEY_HDR = /^\s*(?:answer\s*key|answer\s*sheet|answers|key\s*answers?|the\s*key|mark(?:ing)?\s*scheme|model\s*answers?|solutions?|correct\s*answers|الإجابات|الاجابات|مفتاح\s*الإجابة|مفتاح\s*الاجابة|نموذج\s*الإجابة|نموذج\s*الاجابة|الحل|الحلول|الإجابات\s*الصحيحة)\s*[:：\-–]?\s*/i;
const Q_PRE = /^\s*(?:Q(?:uestion)?|Ques\.?|س(?:ؤال)?)\s*\.?\s*(\d{1,3})\s*[.)\-:–]?\s*(.*)$/i;
const Q_NUM = /^\s*[\(\[]?(\d{1,3})\s*[.)\]\-:–]\s*(?![\d])(.*)$/;
const OPT_EN = /^\s*[\(\[]?\s*([a-hA-H])\s*[\)\].:\-–]\s*(.+)$/;
const OPT_AR = /^\s*[\(\[]?\s*(هـ|أ|ب|ج|د|ه|و|ز|ح)\s*[\)\]\-–.:]\s*(.+)$/;
const BULLET = /^\s*[•●▪◦‣\-–*]\s+(.+)$/;
const ANS_LINE = /^\s*(?:correct\s*answer|answer|ans|key|الإجابة\s*الصحيحة|الإجابة|الاجابة|الجواب|ج)\s*[:：\-–=]\s*(.+)$/i;
const EX_LINE = /^\s*(?:explanation|because|reason|feedback|why|التوضيح|التفسير|السبب|الشرح)\s*[:：\-–]\s*(.+)$/i;
const HINT_LINE = /^\s*(?:hint|clue|تلميح|مساعدة)\s*[:：\-–]\s*(.+)$/i;
const POINTS = /[\(\[]\s*(\d+(?:\.\d+)?)\s*(?:marks?|pts?|points?|درجات|درجة|د)\s*[\)\]]/i;
const JUNK = /^\s*(?:(?:page|صفحة)\s*)?\d+(?:\s*(?:of|\/|من)\s*\d+)?\s*$|^\s*(?:name|student(?:'s)?\s*name|class|date|grade|section|teacher|الاسم|اسم\s*الطالب|الصف|الفصل|التاريخ|الشعبة)\s*[:：].{0,80}$/i;
const RANGE = /(?:questions?|qs?\.?|الأسئلة|الاسئلة|للأسئلة|للاسئلة|السؤالين)\s*(?:من\s*)?(\d{1,3})\s*(?:-|–|to|إلى|الى|and|و|&)\s*(\d{1,3})/i;
const TF_WORDS = /^\s*\(?\s*(t|f|true|false|correct|incorrect|right|wrong|yes|no|صح|صحيح|صواب|خطأ|خطا|خاطئ|✓|✔|✗|✘|×)\s*\)?\s*[.!]?\s*$/i;
const tfVal = s => { const m = String(s).trim().match(TF_WORDS); if (!m) return null; return /^(t|true|correct|right|yes|صح|صحيح|صواب|✓|✔)$/i.test(m[1]); };
const SECTIONS = [
  ['tf', /true\s*(?:or|\/|and|&)\s*false|\bT\s*\/\s*F\b|correct\s*(?:or|\/)\s*incorrect|صح\s*(?:أو|او|أم|ام|\/|و)\s*(?:خطأ|خطا)|صواب\s*(?:أو|او|أم|ام|\/)\s*خطأ|علامة\s*\(?\s*[✓√]|ضع\s*علامة/i],
  ['multi', /(?:choose|select|circle|tick)\s*(?:all|two|three|the\s*two|the\s*three|more\s*than\s*one)|all\s*that\s*apply|اختر\s*(?:إجابتين|اجابتين|كل|جميع)/i],
  ['match', /\bmatch|connect\s*each|link\s*each|column\s*a\b|(?:^|\s)صل(?=\s|$)|وصل|اربط|توصيل|العمود\s*\(?أ/i],
  ['order', /\barrange|\bsequence|put\s*.{0,20}\s*in\s*(?:the\s*)?(?:right|correct)?\s*order|\border\s*(?:the|these)|رتب|ترتيب/i],
  ['blank', /fill\s*in|complete\s*(?:the|each|these)|\bblanks?\b|missing\s*words?|أكمل|اكمل|املأ|املا|الفراغ/i],
  ['mc', /choose|circle|select|multiple\s*choice|tick\s*the|best\s*answer|اختر|ضع\s*دائرة|اختيار\s*من\s*متعدد/i],
  ['num', /\bcalculate|\bcompute|work\s*out|\bsolve|احسب|أوجد\s*قيمة/i],
  ['long', /\bexplain|\bdescribe|\bdiscuss|\bjustify|\bcompare|\bessay|why\s|give\s*(?:a\s*)?reasons?|in\s*your\s*own\s*words|اشرح|فسر|فسّر|علل|علّل|وضح|وضّح|ناقش|قارن|بم\s*تفسر/i],
  ['short', /\bdefine|\bname\s|one\s*word|short\s*answer|scientific\s*term|give\s*(?:the\s*)?term|اكتب\s*المصطلح|المصطلح\s*العلمي|عرّف|عرف\s/i],
];
function sectionType(t) { for (const [k, re] of SECTIONS) if (re.test(t)) return k; return null; }
/* a heading: short, no question mark at the end of a numbered item, and either names a question type or looks like a title */
function isHeader(t, L) { if (t.length > 140) return false; if (/^\s*(?:part|section|unit|question|الجزء|القسم|السؤال)\s*(?:[A-Z\d٠-٩]|الأول|الثاني|الثالث|الرابع|الخامس)\b/i.test(t) && t.length < 120) return true;
  if (sectionType(t) && (t.length < 120) && !/\?\s*$/.test(t)) return true; if (L && L.b && t.length < 70 && !/[.?]$/.test(t)) return true; return false; }

function cleanOpt(s) { let t = String(s).trim(), mark = false;
  const re = [/^\s*[\[(]\s*[xX✓✔]\s*[\])]\s*/, /^\s*[✓✔☑✅]\s*/, /\s*[✓✔☑✅]\s*$/, /^\s*\*\s*/, /\s*\*\s*$/, /\s*[\(\[]\s*(?:correct|right|answer|ans|صحيح|صح|الإجابة)\s*[\)\]]\s*$/i, /\s*<-+\s*(?:correct|answer)?\s*$/i];
  re.forEach(r => { if (r.test(t)) { mark = true; t = t.replace(r, ''); } }); return { t: t.trim(), mark }; }
/* "a) cell  b) tissue  c) organ" (or أ) ب) ج)) on one line → options. Only when the letters run in order from a/أ */
function splitInline(t) {
  const run = re => { const ms = [...t.matchAll(re)].map(m => ({ index: m.index, len: m[0].length, l: m[1] || m[2] })); if (ms.length < 2) return null;
    const s = ms.findIndex(m => letterIdx(m.l) === 0); if (s < 0) return null; const r = [ms[s]];
    for (let i = s + 1; i < ms.length && letterIdx(ms[i].l) === r.length; i++) r.push(ms[i]); if (r.length < 2) return null;
    const stem = t.slice(0, r[0].index).trim(), opts = r.map((m, i) => t.slice(m.index + m.len, i + 1 < r.length ? r[i + 1].index : t.length).trim());
    return opts.some(o => !o) ? null : { stem, opts }; };
  return run(/(?:^|\s)[\(\[]?([a-hA-H])[\)\]]\s*|(?:^|\s{2,}|\t)([a-hA-H])\.\s+/g) || run(/(?:^|\s)[\(\[]?(هـ|أ|ب|ج|د|ه|و)\s*[\)\]\-]\s*/g);
}

/* ---------- the main pass ---------- */
function parse(lines, opt) {
  opt = opt || {};
  const Q = [], keyLines = [], shares = [], warnings = [];
  let note = '', cur = null, sec = { type: null, title: '' }, inKey = false, blk = 0, lastNum = 0, title = '', pending = [], range = null, lastWasOpt = false;
  const newQ = (num, text, L, pre) => {
    if (cur && cur.pre && !cur.opts.length && !cur.lines.length && (!cur.text || isHeader(cur.text)) && num === 1) { Q.pop(); sec = { type: sectionType(cur.text) || sec.type, title: cur.text }; }
    if (num != null) { if (num <= lastNum && !(cur && cur.match && cur.match.open)) blk++; lastNum = num; }
    cur = { num, blk, text: '', opts: [], marks: [], bold: [], under: [], lines: [], sec: sec.title, secType: sec.type, key: null, ex: '', hint: '', pts: null, img: null, pre: !!pre, cells: [] };
    if (pending.length) { cur.img = pending.shift(); pending = []; }
    Q.push(cur); if (note) { cur.text = note; note = ''; } setStem(text, L); lastWasOpt = false;
  };
  const setStem = (text, L) => {
    let t = String(text || '');
    const pm = t.match(POINTS); if (pm) { cur.pts = +pm[1]; t = t.replace(POINTS, ' '); }
    const am = t.match(/\s*[\(\[]\s*(?:ans(?:wer)?|key)\s*[:=]\s*([^)\]]+)[\)\]]\s*$/i); if (am) { cur.key = am[1].trim(); t = t.slice(0, am.index); }
    if (/\(\s*(?:T\s*\/\s*F|True\s*\/\s*False|صح\s*\/\s*خطأ)\s*\)/i.test(t)) { cur.tf = true; t = t.replace(/\(\s*(?:T\s*\/\s*F|True\s*\/\s*False|صح\s*\/\s*خطأ)\s*\)/ig, ' '); }
    if (/\(\s{1,}\)\s*$|\[\s{1,}\]\s*$/.test(t)) { cur.box = true; t = t.replace(/\s*(?:\(\s{1,}\)|\[\s{1,}\])\s*$/, ''); }
    /* "( ✓ )" or "(T)" written into the box at the end = the key of a true/false statement */
    const tm = t.match(/\(\s*(✓|✔|✗|×|T|F|صح|خطأ)\s*\)\s*$/i); if (tm && (sec.type === 'tf' || cur.tf)) { cur.key = tm[1]; t = t.slice(0, tm.index); }
    const sp = splitInline(t); if (sp && !hasBlank(sp.opts.join(' '))) { t = sp.stem; sp.opts.forEach(o => addOpt(o, L)); }
    cur.text = (cur.text ? cur.text + '\n' : '') + t.replace(/\s{3,}/g, '  ').trim();
  };
  const addOpt = (raw, L) => { const c = cleanOpt(raw); cur.opts.push(c.t); cur.marks.push(c.mark); cur.bold.push(!!(L && L.b)); cur.under.push(!!(L && L.u)); lastWasOpt = true; };

  for (const L of lines) {
    if (L.img) { if (inKey) continue; if (cur && !cur.img && !cur.opts.length && !(cur.match && cur.match.left.length) && cur.text && !cur.closed) cur.img = L.img; else pending.push(L.img);
      if (range) { shares.push({ img: L.img, blk: range.blk, from: range.from, to: range.to }); range = null; } continue; }
    let t = digits(String(L.t || '')).replace(/ /g, ' ').replace(/[ \t]+$/g, '').replace(/^\s+/, ''); if (!t.trim()) continue;
    if (JUNK.test(t)) continue;
    const km = t.match(KEY_HDR); if (km && (km[0].length >= t.length - 1 || /^\s*\d/.test(t.slice(km[0].length)))) { inKey = true; t = t.slice(km[0].length).trim(); if (!t) continue; }
    if (inKey) { keyLines.push(t); continue; }
    const rm = t.match(RANGE); if (rm) { range = { blk: Q.length ? blk + (Q_NUM.test(t) ? 0 : 0) : 0, from: +rm[1], to: +rm[2] }; if (pending.length) { shares.push({ img: pending[pending.length - 1], blk: range.blk, from: range.from, to: range.to }); range = null; } }
    /* matching: numbered left items and lettered right items, in two columns or one after the other */
    if (cur && cur.match && cur.match.open) { const M = cur.match;
      const cells = (L.cells && L.cells.length >= 2) ? L.cells.map(c => digits(c).trim()).filter(Boolean) : null;
      if (cells && cells.length >= 2) { const l = cells[0].replace(/^[\(\[]?\d{1,3}\s*[.)\]\-:–]\s*/, ''), r = cells[cells.length - 1].replace(/^[\(\[]?\s*(?:[a-hA-H]|هـ|أ|ب|ج|د|ه|و)\s*[\)\].:\-–]\s*/, '');
        if (/^\s*(?:column|العمود|القائمة)/i.test(cells[0])) continue; if (l) M.left.push(l); if (r) M.right.push(r); continue; }
      const nm = t.match(Q_NUM), lm = t.match(OPT_EN) || t.match(OPT_AR);
      const inl = t.match(/^\s*[\(\[]?(\d{1,3})\s*[.)\]\-:–]\s*(.+?)\s+[\(\[]?((?:[a-hA-H]|هـ|أ|ب|ج|د|ه|و))\s*[\)\].\-]\s+(.+)$/);
      const done = M.left.length >= 2 && M.right.length >= M.left.length;
      if (inl && !done) { M.left.push(inl[2].trim()); M.right.push(inl[4].trim()); continue; }
      if (nm && !done && +nm[1] === M.left.length + 1 && !(M.right.length && M.rightAfter)) { M.left.push(nm[2].trim()); continue; }
      if (lm && letterIdx(lm[1]) === M.right.length && !(isHeader(t, L) && !lm)) { M.right.push(lm[2].trim()); if (M.left.length) M.rightAfter = true; continue; }
      if (/^\s*(?:column|العمود|القائمة)/i.test(t)) continue;
      M.open = false;
    }
    const pre = t.match(Q_PRE), nm = !pre && t.match(Q_NUM);
    const om = t.match(OPT_EN) || t.match(OPT_AR);
    /* "a) cell  b) tissue  c) organ" on a line of its own */
    if (om && cur && !cur.closed && !cur.opts.length && letterIdx(om[1]) === 0) { const sp = splitInline(t); if (sp && !sp.stem && sp.opts.length >= 2) { sp.opts.forEach(o => addOpt(o, L)); continue; } }
    const isOpt = om && cur && !cur.closed && (letterIdx(om[1]) === cur.opts.length) && !(cur.opts.length === 0 && /^[A-H]$/.test(om[1]) && om[2].length > 160);
    if (isOpt) { addOpt(om[2], L); continue; }
    if (pre || nm) { const m = pre || nm, num = +m[1]; let text = m[2] || '';
      /* "1.5 cm" on its own is not question 1 */
      if (nm && /^\d/.test(t.trim()) && !text.trim() && cur && !pre) { cur.text += ' ' + t; continue; }
      if (cur && cur.pts == null && !text.trim() && !pre) { /* a lone number line (PDF numbering split from the text) */ }
      newQ(num, text, L, !!pre);
      const st = sectionType(cur.text);
      if ((sec.type === 'match' && !cur.text.trim()) || ((st === 'match') && !cur.opts.length)) cur.match = { left: [], right: [], open: true };
      continue; }
    const hm = t.match(ANS_LINE); if (hm && cur) { cur.key = hm[1].trim(); cur.closed = true; continue; }
    const em = t.match(EX_LINE); if (em && cur) { cur.ex = (cur.ex ? cur.ex + ' ' : '') + em[1].trim(); continue; }
    const hn = t.match(HINT_LINE); if (hn && cur) { cur.hint = hn[1].trim(); continue; }
    if (isHeader(t, L) && !(cur && !cur.text.trim())) {
      const ty = sectionType(t);
      if (!Q.length && !title && !ty) { title = t.trim(); continue; }
      sec = { type: ty, title: t.trim().replace(/\s*[:：]\s*$/, '') }; cur = null; lastWasOpt = false;
      if (ty === 'match') { newQ(null, sec.title, L); cur.match = { left: [], right: [], open: true }; cur.unnumbered = true; }
      continue; }
    const bm = t.match(BULLET); if (bm && (sec.type === 'tf' || sec.type === 'blank' || sec.type === 'short') && !(cur && cur.opts.length)) { newQ(null, bm[1], L); cur.unnumbered = true; continue; }
    if (!cur) { if (!Q.length && !title && t.length < 100) { title = t.trim(); continue; }
      if (sec.type && (sec.type === 'tf' || sec.type === 'blank') && (hasBlank(t) || /\(\s+\)\s*$/.test(t) || /[.!؟?]$/.test(t)) && t.length > 15) { newQ(null, t, L); cur.unnumbered = true; continue; }
      if (sec.title) sec.title += ' ' + t.trim(); continue; }
    if (cur.match && !cur.match.open && cur.match.left.length) { cur.closed = true; }
    /* the next line of the question (or of its last option) */
    const sentence = RANGE.test(t) || /^(?:use|look|study|read|refer|the\s+(?:diagram|graph|table|figure|picture)|استخدم|انظر|ادرس|اقرأ|من\s+الشكل)/i.test(t) || /^[A-Z\u0600-\u06FF].{24,}[.?؟:]$/.test(t);
    const instr = RANGE.test(t) || /^(?:use|look\s+at|study|read|refer|the\s+(?:diagram|graph|table|figure|picture|chart|map)\s+(?:below|shows|opposite)|استخدم|انظر|ادرس|اقرأ|من\s+الشكل|الشكل\s+(?:التالي|المقابل))/i.test(t);
    if ((cur.opts.length && sentence) || (instr && /[?؟.:)]\s*$/.test(cur.text.trim()))) { note = t.trim(); cur.closed = true; lastWasOpt = false; continue; }
    if (lastWasOpt && cur.opts.length && t.length < 120) cur.opts[cur.opts.length - 1] += ' ' + t.trim();
    else if (!cur.opts.length) setStem(t, L);
    else if (sec.type === 'tf' || sec.type === 'blank') { newQ(null, t, L); cur.unnumbered = true; }
  }
  /* unnumbered items get numbers after the numbered ones of their block, so the key can still find numbered ones */
  const keys = parseKey(keyLines, Q);
  const out = Q.map((q, i) => finish(q, keys.get(q) != null ? keys.get(q) : null, warnings)).filter(Boolean);
  shares.forEach(s => Q.forEach((q, i) => { if (q.num != null && q.num >= s.from && q.num <= s.to && q.blk === s.blk && out[i] && !out[i].img) out[i].img = s.img; }));
  if (pending.length && out.length && !out[out.length - 1].img) out[out.length - 1].img = pending[0];
  const st = { total: out.length, keyed: out.filter(q => q.a != null).length, types: {} }; out.forEach(q => { st.types[q.type] = (st.types[q.type] || 0) + 1; });
  st.figures = out.filter(q => q.img).length;
  return { title: title || opt.name || 'Test', questions: out, stats: st, warnings };
}

/* ---------- the key page ---------- */
function parseKey(lines, Q) {
  const map = new Map(); if (!lines.length) return map;
  const entries = []; let kblk = 0, last = 0, expect = null;
  const qAt = (b, n) => Q.find(q => q.blk === b && q.num === n) || Q.find(q => q.num === n && !map.has(q));
  const push = (n, raw) => { if (n <= last) kblk++; last = n; entries.push({ blk: kblk, num: n, raw: raw.trim() }); };
  for (let t of lines) { t = digits(t).trim(); if (!t) continue;
    /* "Section A: 1-B 2-C" / "السؤال الأول: ١- ب" — the heading starts a new block; "Question 3: B" is the answer to 3 */
    const hp = t.match(/^\s*(?:part|section|question|ques\.?|q|الجزء|القسم|السؤال)(?:\s*(\d{1,3})|\s*[A-Za-z]\b|\s+[\u0600-\u06FF]+)?\s*[:：\-–)]\s*(.*)$/i);
    if (hp) { const rest = hp[2].trim(); if (hp[1] && rest && !/^\d/.test(rest)) t = hp[1] + '. ' + rest; else { if (entries.length) { kblk++; last = 0; } if (!rest) continue; t = rest; } }
    /* "Match: 1-b 2-a 3-c" or "Order: B, C, A" for a section without a number */
    const sk = t.match(/^\s*(match(?:ing)?|matching\s*pairs|column\s*a|صل|وصل|التوصيل|الربط|order|arrange|sequence|رتب|الترتيب)(?=[\s:：\-–]|$)[^:：\d]*[:：\-–]?\s*(.*)$/i);
    if (sk) { const isM = !/order|arrange|sequence|رتب|الترتيب/i.test(sk[1]); const q = Q.find(q => !map.has(q) && (isM ? q.match : (q.secType === 'order')) && (q.num == null || isM)); if (q) { map.set(q, sk[2]); expect = null; if (!sk[2].trim()) expect = { set raw(v) { map.set(q, (map.get(q) || '') + v); }, get raw() { return ''; } }; continue; } }
    if (expect && /^(?:\s*\d{1,3}\s*[-–:→=.)]?\s*(?:[a-hA-H]|هـ|أ|ب|ج|د|ه|و)(?![\w\u0600-\u06FF])[,;\s]*)+$/.test(t)) { expect.raw += ' ' + t; continue; }
    expect = null;
    /* one entry per line, or several: "1-B 2-C 3-A", "1. True  2. False" */
    const lead = t.match(/^[\(\[]?(\d{1,3})(?:\s*[)\]\-:–=]\s*|\s*\.(?!\d)\s*|\s+)(.*)$/) || t.match(/^[\(\[]?(\d{1,3})()$/);
    if (!lead) { if (entries.length) entries[entries.length - 1].raw += ' ' + t; continue; }
    const n = +lead[1], tq = qAt(kblk + (n <= last ? 1 : 0), n);
    if (tq && (tq.match || tq.secType === 'match' || tq.secType === 'order')) { push(n, lead[2]); if (!lead[2].trim()) expect = entries[entries.length - 1]; continue; }
    const re = /(?:^|[\s,;|])[\(\[]?(\d{1,3})(?:\s*[)\]\-:–=]\s*|\s*\.(?!\d)\s*|\s+)(?=\S)/g; const ms = [...t.matchAll(re)];
    const parts = ms.map((m, i) => ({ n: +m[1], s: t.slice(m.index + m[0].length, i + 1 < ms.length ? ms[i + 1].index : t.length).replace(/^[\s,;|]+|[\s,;|]+$/g, '') }));
    const ascending = parts.every((p, i) => i === 0 || (p.n > parts[i - 1].n && p.n <= parts[i - 1].n + 10));
    if (parts.length >= 2 && ascending && parts.every(p => p.s && p.s.split(/\s+/).length <= 4)) parts.forEach(p => push(p.n, p.s));
    else push(n, lead[2]);
  }
  /* match entries to questions: by block and number; else in order when the counts agree; else by number */
  const Qs = Q.filter(q => !map.has(q)), numbered = Qs.filter(q => q.num != null);
  const all = entries.every(e => numbered.some(q => q.blk === e.blk && q.num === e.num));
  if (all) entries.forEach(e => { const q = numbered.find(q => q.blk === e.blk && q.num === e.num); if (q && !map.has(q)) map.set(q, e.raw); });
  else if (entries.length === Qs.length) entries.forEach((e, i) => map.set(Qs[i], e.raw));
  else if (entries.length === numbered.length) entries.forEach((e, i) => map.set(numbered[i], e.raw));
  else entries.forEach(e => { const q = numbered.find(q => q.num === e.num && !map.has(q)); if (q) map.set(q, e.raw); });
  return map;
}

/* ---------- each question: its type and its key ---------- */
const STOP = new Set('the a an and or of to in on at by for with from is are was were be been being it its this that these those as into than then them they their there which who whom what when where why how not no but if so such also can could may might will would should do does did has have had more most less very just only each other some any all both because about over under between during after before while our your his her ونحن في من على إلى الى عن مع أن ان كان كانت هو هي هذا هذه ذلك التي الذي الذين ما لا لم لن قد ثم أو او بين عند كل بعض أي اي حيث إذا اذا لأنها لانها لأن لان لأنه لانه تحت فوق ولا ولم وهو وهي وفي عندما حتى أيضا ايضا يتم تكون يكون اللازم كما لكي لذلك because therefore however would'.split(' '));
function keywords(s) { const seen = new Set(); return String(s).replace(/⟦m:[a-z0-9]+⟧/g, ' ').split(/[\s,;:.()\[\]،؛!?؟"'“”]+/).map(w => w.trim()).filter(w => { const n = w.toLowerCase(); if (!n || STOP.has(n) || seen.has(n)) return false; if (/^[؀-ۿ]+$/.test(n) ? n.length < 3 : n.length < 4) return /^\d+(\.\d+)?$/.test(n); seen.add(n); return true; }).map((w, i) => [w, i]).sort((x, y) => y[0].length - x[0].length || x[1] - y[1]).slice(0, 5).sort((x, y) => x[1] - y[1]).map(x => x[0]); }
const NUM_KEY = /^\s*[≈~]?\s*[-+]?\d[\d.,]*(?:\s*[×x*]\s*10\s*\^?\s*[-+]?\d+)?\s*([^\d\s].{0,14})?$/;
function lettersOf(raw, n) { const s = String(raw).trim().replace(/^(?:option|choice|الخيار)\s*/i, '');
  const m = s.match(/^[\(\[]?\s*((?:[a-hA-H]|هـ|أ|ب|ج|د|ه|و)(?:\s*[\)\]]?\s*(?:,|،|&|and|و|\+|\/|\s)\s*[\(\[]?\s*(?:[a-hA-H]|هـ|أ|ب|ج|د|ه|و))*)\s*[\)\]]?\s*(?:[.:\-–]\s*(.*))?$/);
  if (!m) return null; const ls = m[1].split(/[^a-hA-Hأبجدهـو]+/).filter(Boolean).map(letterIdx); if (!ls.length || ls.some(k => k < 0 || k >= n)) return null; return { idx: [...new Set(ls)], rest: m[2] || '' }; }
function finish(q, keyRaw, warnings) {
  const raw = keyRaw != null && keyRaw !== '' ? keyRaw : q.key; let text = q.text.trim();
  const out = { type: 'short', q: text, pts: q.pts || 1, a: null, ex: q.ex || '', hint: q.hint || '', img: q.img || null, sec: (q.sec || '').slice(0, 160), num: q.num };
  let exFromKey = '';
  /* matching */
  if (q.match && q.match.left.length >= 2 && q.match.right.length >= 2) {
    out.type = 'match'; out.left = q.match.left; out.right = q.match.right; out.q = text || q.sec || 'Match each item.';
    if (raw) { const pairs = [...digits(raw).matchAll(/(\d{1,2})\s*[-–:→=.)]?\s*[\(\[]?((?:[a-hA-H]|هـ|أ|ب|ج|د|ه|و))(?![\w\u0600-\u06FF])/g)];
      let a = null; if (pairs.length >= 2) { a = out.left.map(() => null); pairs.forEach(p => { const i = +p[1] - 1, r = letterIdx(p[2]); if (i >= 0 && i < a.length && r >= 0 && r < out.right.length) a[i] = r; }); }
      else { const ls = String(raw).split(/[^a-hA-Hأبجدهـو]+/).filter(Boolean).map(letterIdx); if (ls.length === out.left.length && ls.every(k => k >= 0 && k < out.right.length)) a = ls; }
      if (a && a.every(k => k != null)) out.a = a; }
    return out; }
  /* a matching section whose columns could not be read: collected, marked by the teacher */
  if (q.match && !q.opts.length) { if (!text) return null; out.type = 'long'; out.a = null; return out; }
  if (!text && !q.opts.length) return null;
  const opts = q.opts;
  /* options that are just True / False */
  if (opts.length === 2 && tfVal(opts[0]) != null && tfVal(opts[1]) != null && tfVal(opts[0]) !== tfVal(opts[1])) {
    out.type = 'tf'; const first = tfVal(opts[0]);
    if (raw) { const L = lettersOf(raw, 2); if (L && L.idx.length === 1) out.a = L.idx[0] === 0 ? first : !first; else { const v = tfVal(String(raw).split(/[\s,.:–-]+/)[0]); if (v != null) out.a = v; } }
    else { const mk = q.marks.indexOf(true); if (mk >= 0) out.a = mk === 0 ? first : !first; }
    return out; }
  if (opts.length >= 2) {
    const orderish = q.secType === 'order' || /\b(?:arrange|order|sequence)\b|رتب/i.test(text);
    if (orderish) { out.type = 'order'; out.o = opts.slice();
      if (raw) { let seq = null; const ls = String(raw).replace(/[→>–\-,،;\s]+/g, ' ').trim().split(' ');
        const asL = ls.map(letterIdx); if (asL.length === opts.length && asL.every(k => k >= 0) && new Set(asL).size === asL.length) seq = asL;
        const joined = String(raw).replace(/[^a-hA-H]/g, ''); if (!seq && joined.length === opts.length) { const s2 = [...joined].map(letterIdx); if (new Set(s2).size === s2.length && s2.every(k => k >= 0 && k < opts.length)) seq = s2; }
        const asN = ls.map(Number); if (!seq && asN.length === opts.length && asN.every(n => n >= 1 && n <= opts.length) && new Set(asN).size === asN.length) seq = asN.map(n => n - 1);
        if (seq) { out.o = seq.map(k => opts[k]); out.a = true; } }
      return out; }
    out.o = opts.slice();
    let idx = null;
    if (raw) { const L = lettersOf(raw, opts.length); if (L) { idx = L.idx; exFromKey = L.rest; } else { const k = opts.findIndex(o => same(o, raw)); if (k >= 0) idx = [k]; } }
    if (!idx) { const mk = q.marks.map((m, i) => m ? i : -1).filter(i => i >= 0); if (mk.length) idx = mk; }
    if (!idx) { const bo = q.bold.map((b, i) => b ? i : -1).filter(i => i >= 0); if (bo.length && bo.length < opts.length && !q.bold.every(Boolean)) idx = bo; }
    if (!idx) { const un = q.under.map((b, i) => b ? i : -1).filter(i => i >= 0); if (un.length && un.length < opts.length) idx = un; }
    const multi = (idx && idx.length > 1) || q.secType === 'multi' || /all\s*that\s*apply|choose\s*(?:two|three)|select\s*(?:two|three|all)|اختر\s*(?:إجابتين|اجابتين)/i.test(text);
    out.type = multi ? 'multi' : 'mc'; if (idx) out.a = multi ? idx.sort((a, b) => a - b) : idx[0];
    if (exFromKey && !out.ex) out.ex = exFromKey;
    return out; }
  /* blanks */
  const nb = (text.match(BLANK) || []).length;
  if (nb) { out.type = 'blank';
    if (raw) { let parts = String(raw).split(/\s*(?:[;|،؛]|\s[–-]\s|,\s+(?=\S))\s*/).map(s => s.replace(/^[\(\[]?\s*(?:\d{1,2}|[a-hA-H])\s*[\)\].]\s*/, '').trim()).filter(Boolean);
      if (nb === 1) parts = [String(raw).trim()]; if (parts.length >= nb) out.a = parts.slice(0, nb).map(p => p.split(/\s*\/\s*|\s+or\s+|\s+أو\s+/i).map(s => s.trim()).filter(Boolean)); }
    return out; }
  const kind = q.secType;
  const isTF = q.tf || kind === 'tf' || (q.box && !raw) || (raw && tfVal(String(raw).split(/[\s,.:–-]+/)[0]) != null && String(raw).trim().split(/\s+/).length <= 6 && (kind === 'tf' || q.box || tfVal(raw) != null));
  if (isTF && (!raw || tfVal(String(raw).split(/[\s,.:–-]+/)[0]) != null)) { out.type = 'tf';
    if (raw) { const parts = String(raw).split(/[\s,.:–-]+/); out.a = tfVal(parts[0]); const rest = String(raw).replace(/^\s*\S+\s*[,.:–-]?\s*/, ''); if (rest && !out.a && !out.ex) out.ex = rest; }
    return out; }
  if (raw) { const r = String(raw).trim();
    const nm = r.match(NUM_KEY);
    if (nm && (kind === 'num' || /calculate|how\s+(?:many|much|far|long|fast)|what\s+is\s+the\s+(?:value|mass|speed|number|volume|density|area)|احسب|كم/i.test(text) || !/[a-z؀-ۿ]{3,}/i.test(r.replace(nm[1] || '', '')))) {
      const unit = (nm[1] || '').trim(); const v = r.replace(/^[≈~]\s*/, '').replace(unit, '').trim();
      out.type = 'num'; out.a = { v: numVal(v), tol: '', unit }; if (!Number.isFinite(out.a.v)) { out.type = 'short'; out.a = [r]; } return out; }
    const wc = r.split(/\s+/).length;
    if (kind === 'long' || wc > 6) { out.type = 'long'; const km = r.match(/(?:key\s*words?|keywords|الكلمات\s*المفتاحية)\s*[:：]\s*(.+)$/i); out.a = { keys: km ? km[1].split(/\s*[,،;]\s*/).filter(Boolean) : keywords(r), text: km ? r.slice(0, km.index).trim() : r }; return out; }
    out.type = 'short'; out.a = r.split(/\s*\/\s*|\s+or\s+|\s+أو\s+|\s*[،;]\s*/i).map(s => s.trim()).filter(Boolean); return out; }
  out.type = kind === 'long' || /\b(?:explain|describe|discuss|why|compare|justify)\b|اشرح|فسر|علل|وضح|ناقش|قارن/i.test(text) ? 'long' : kind === 'num' ? 'num' : 'short';
  if (out.type === 'num') out.a = null;
  return out;
}
function numVal(s) { s = digits(s).replace(/\s/g, '').replace(/[×x*]10\^?([-+]?\d+)/i, 'e$1'); const fr = s.match(/^([-+]?\d+)\/(\d+)$/); if (fr) return +fr[1] / +fr[2]; return parseFloat(s.replace(/,(?=\d{3}\b)/g, '').replace(',', '.')); }
function same(a, b) { const n = s => digits(s).toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim(); return n(a) === n(b) && !!n(a); }

/* plain text (pasted, or from OCR) → lines */
function textLines(s) { return String(s || '').replace(/\r/g, '').split('\n').map(t => { const cells = t.includes('\t') ? t.split('\t').map(c => c.trim()).filter(Boolean) : null; return { t: t.replace(/\t+/g, '   '), cells: cells && cells.length >= 2 ? cells : null }; }); }

const P = { parse, textLines, parseKey, sectionType, splitInline, keywords, digits };
if (typeof module !== 'undefined' && module.exports) module.exports = P; else root.HBQP = P;
})(typeof window !== 'undefined' ? window : this);
