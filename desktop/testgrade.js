/* ================= HelixBoard — test marking (shared by the Windows app and the class link server) =================
   One question format for every test, whether it was imported from a worksheet or typed in:
     mc     { o:[...], a: index }                     multi  { o:[...], a:[indexes] }          tf    { a: true|false }
     short  { a:[accepted answers] }                  num    { a:{ v, tol, unit } }            blank { a:[[accepted for blank 1], ...] }
     match  { left:[...], right:[...], a:[right index for each left item] }                  order { o:[items in the right order] }
     long   { a:{ keys:[key words], text: model answer } }
   a === null → the question has no key: the answer is collected but not scored (the teacher marks it on the dashboard).
   Answers always use the original indexes, whatever order the phone showed them in. */
(function (root) {
'use strict';
const TYPES = ['mc', 'multi', 'tf', 'short', 'num', 'blank', 'match', 'order', 'long'];
const TASHKEEL = /[ؐ-ًؚ-ٰٟۖ-ۭـ]/g;
const AR_DIG = /[٠-٩۰-۹]/g;
function digits(s) { return String(s == null ? '' : s).replace(AR_DIG, d => String(d.charCodeAt(0) & 15)); }
/* the same answer written differently should count: case, accents, Arabic letter forms, punctuation, extra spaces, a leading "the"/"ال" */
function norm(s) {
  return digits(s).normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(TASHKEEL, '')
    .replace(/[أإآٱ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي').replace(/ؤ/g, 'و').replace(/ئ/g, 'ي')
    .replace(/[^\p{L}\p{N}.\-+ ]/gu, ' ').replace(/\s+/g, ' ').trim().replace(/^(the|a|an) /, '');
}
function lev(a, b) { if (a === b) return 0; const m = a.length, n = b.length; if (!m || !n) return m + n; let p = [...Array(n + 1).keys()];
  for (let i = 1; i <= m; i++) { const c = [i]; for (let j = 1; j <= n; j++) c[j] = Math.min(p[j] + 1, c[j - 1] + 1, p[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)); p = c; } return p[n]; }
/* small spelling slips are forgiven on longer words (one letter from 5 letters, two from 9) */
function same(x, y, strict) { const a = norm(x), b = norm(y); if (!a || !b) return false; if (a === b) return true;
  const strip = s => s.replace(/^ال/, '').replace(/ /g, ''); if (strip(a) === strip(b)) return true;
  if (strict) return false; const L = Math.min(a.length, b.length); const allow = L >= 9 ? 2 : L >= 5 ? 1 : 0; return allow > 0 && lev(a, b) <= allow; }
/* a typed answer against one accepted answer: the same words, or the number of "2 carbons" / "36 ATP" on its own */
function okText(v, k, strict) { if (same(v, k, strict)) return true; const m = norm(k).match(/^([-+]?\d+(?:\.\d+)?)\s+([\p{L} ]{2,20})$/u), a = norm(v).match(/^([-+]?\d+(?:\.\d+)?)(?:\s+(.*))?$/);
  return !!(m && a && +m[1] === +a[1] && (!a[2] || same(a[2], m[2], strict) || m[2].startsWith(a[2]))); }
/* "9.8", "9,8", "9.8 m/s²", "1/2", "3×10^8", "3e8" */
function num(s) { s = digits(s).replace(/[٫]/g, '.').replace(/[٬\s]/g, '').replace(/[×x*]10\^?([-+]?\d+)/i, 'e$1');
  const fr = s.match(/^([-+]?\d+)\/(\d+)/); if (fr) return +fr[1] / +fr[2];
  const m = s.replace(/,(?=\d{3}\b)/g, '').replace(',', '.').match(/^[-+]?(\d+\.?\d*|\.\d+)(e[-+]?\d+)?/i); return m ? parseFloat(m[0]) : NaN; }
function tolOf(a) { if (a.tol != null && a.tol !== '') return Math.abs(+a.tol); const s = String(a.v); const d = (s.split('.')[1] || '').length; return Math.max(Math.abs(+a.v) * 0.01, d ? 0.5 * Math.pow(10, -d) : 0); }
function words(s) { return norm(s).split(' ').filter(Boolean); }

/* score: 0..1 (partial credit where it makes sense). ok: fully right. null when the question cannot be marked automatically */
function grade(q, v, opt) {
  opt = opt || {}; const a = q.a;
  if (a == null || a === '' || (Array.isArray(a) && !a.length)) return null;
  if (v == null || v === '' || (Array.isArray(v) && !v.length)) return { score: 0, ok: false, blank: true };
  let s = 0;
  switch (q.type) {
    case 'mc': s = +v === +a ? 1 : 0; break;
    case 'tf': s = (v === true || v === 'true' || v === 1) === !!a ? 1 : 0; break;
    case 'multi': { const key = new Set(a.map(Number)), got = new Set([].concat(v).map(Number)); let r = 0, w = 0; got.forEach(k => key.has(k) ? r++ : w++);
      s = Math.max(0, (r - w) / key.size); break; }
    case 'short': s = [].concat(a).some(k => okText(v, k, opt.strict)) ? 1 : 0; break;
    case 'num': { const x = num(v); s = Number.isFinite(x) && Math.abs(x - +a.v) <= tolOf(a) + 1e-12 ? 1 : 0; break; }
    case 'blank': { const vs = [].concat(v); let r = 0; a.forEach((acc, i) => { if ([].concat(acc).some(k => okText(vs[i], k, opt.strict) || (Number.isFinite(num(k)) && /^[-+.\d\s,]+$/.test(digits(k)) && Math.abs(num(vs[i]) - num(k)) < 1e-9))) r++; }); s = r / a.length; break; }
    case 'match': { const vs = [].concat(v); let r = 0; a.forEach((k, i) => { if (vs[i] != null && +vs[i] === +k) r++; }); s = r / a.length; break; }
    case 'order': { const vs = [].concat(v).map(Number), n = (q.o || []).length; let r = 0; for (let i = 0; i < n; i++) if (vs[i] === i) r++; s = n ? r / n : 0; break; }
    case 'long': { const keys = (a.keys || []).filter(Boolean); if (!keys.length) return null; const got = ' ' + words(v).join(' ') + ' ';
      const hit = keys.filter(k => { const kw = words(k).join(' '); if (!kw) return false; if (got.includes(' ' + kw + ' ') || got.includes(' ' + kw)) return true; return words(v).some(w => same(w, kw)); }).length;
      s = Math.min(1, hit / Math.max(1, Math.ceil(keys.length * (opt.keyShare || 0.6)))); break; }
    default: return null;
  }
  s = Math.round(s * 1000) / 1000;
  return { score: s, ok: s >= 0.999 };
}

/* the right answer, written out for students and teachers */
function keyText(q, lang) {
  const a = q.a, L = (q.o || []), T = lang === 'ar' ? ['صح', 'خطأ'] : ['True', 'False'];
  if (a == null) return '';
  switch (q.type) {
    case 'mc': return L[a] != null ? L[a] : '';
    case 'multi': return a.map(i => L[i]).join(' · ');
    case 'tf': return a ? T[0] : T[1];
    case 'short': return [].concat(a)[0] || '';
    case 'num': return a.v + (a.unit ? ' ' + a.unit : '');
    case 'blank': return a.map(x => [].concat(x)[0]).join(' · ');
    case 'match': return (q.left || []).map((l, i) => l + ' → ' + ((q.right || [])[a[i]] || '?')).join('\n');
    case 'order': return L.join(' → ');
    case 'long': return a.text || (a.keys || []).join(', ');
  }
  return '';
}

/* a seeded shuffle, so a student sees the same order after a refresh */
function rng(seed) { let h = 2166136261; for (const c of String(seed)) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return () => { h ^= h << 13; h ^= h >>> 17; h ^= h << 5; return ((h >>> 0) % 1e6) / 1e6; }; }
function shuffled(n, r) { const id = [...Array(n).keys()]; for (let i = n - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [id[i], id[j]] = [id[j], id[i]]; } if (n > 1 && id.every((k, i) => k === i)) id.reverse(); return id; }

/* what a phone receives: no keys. perm = the order to show things in (original indexes) */
function studentCopy(t, seed) {
  const r = rng(seed || 'x'), S = t.settings || {};
  let order = [...Array(t.questions.length).keys()]; if (S.shuffleQ) order = shuffled(order.length, r);
  return { id: t.id, title: t.title, lang: t.lang || 'en', settings: { feedback: S.feedback || 'instant', retry: !!S.retry, time: S.time || 0, showKey: S.showKey !== false, showScore: S.showScore !== false, nav: S.nav !== false },
    order, questions: t.questions.map(q => { const c = { type: q.type, q: q.q, pts: q.pts || 1, img: q.img || null, sec: q.sec || '' };
      if (q.type === 'mc' || q.type === 'multi') { c.o = q.o; c.perm = S.shuffleO ? shuffled(q.o.length, r) : [...q.o.keys()]; }
      if (q.type === 'order') { c.o = q.o; c.perm = shuffled(q.o.length, r); }
      if (q.type === 'match') { c.left = q.left; c.right = q.right; c.perm = shuffled(q.right.length, r); }
      if (q.type === 'blank') c.n = (q.a && q.a.length) || Math.max(1, (String(q.q).match(/_{3,}|\.{4,}|…{2,}/g) || []).length);
      if (q.type === 'num') c.unit = (q.a && q.a.unit) || '';
      if (q.type === 'tf') c.o = null;
      if (q.hint) c.hasHint = true;
      if (q.media) c.media = q.media;
      return c; }) };
}

/* answers from a phone are checked for shape before they are stored */
function cleanValue(q, v) {
  if (v == null) return null; const T = s => String(s == null ? '' : s).replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, 2000);
  switch (q.type) {
    case 'mc': return Number.isInteger(v) && v >= 0 && v < q.o.length ? v : undefined;
    case 'multi': return Array.isArray(v) && v.every(k => Number.isInteger(k) && k >= 0 && k < q.o.length) ? [...new Set(v)].sort((a, b) => a - b) : undefined;
    case 'tf': return typeof v === 'boolean' ? v : undefined;
    case 'short': case 'num': case 'long': { const s = T(v); return s || null; }
    case 'blank': return Array.isArray(v) ? v.slice(0, 30).map(x => T(x).slice(0, 200)) : undefined;
    case 'match': return Array.isArray(v) && v.length === q.left.length && v.every(k => k == null || (Number.isInteger(k) && k >= 0 && k < q.right.length)) ? v : undefined;
    case 'order': { if (!Array.isArray(v) || v.length !== q.o.length) return undefined; return v.every(k => Number.isInteger(k) && k >= 0 && k < q.o.length) && new Set(v).size === v.length ? v : undefined; }
  }
  return undefined;
}

/* a student's whole paper: points per question and the total. over = the teacher's own marks for a question (long answers) */
function mark(t, ans, tries, over) {
  const S = t.settings || {}; let got = 0, max = 0; const per = t.questions.map((q, i) => {
    const pts = +q.pts || 1; const o = over && over[i] != null ? +over[i] : null;
    const g = grade(q, ans[i], { strict: S.strict });
    if (o != null) { max += pts; got += Math.min(pts, Math.max(0, o)); return { pts: Math.min(pts, Math.max(0, o)), max: pts, ok: o >= pts, score: o / pts, manual: true }; }
    if (!g) return { pts: 0, max: 0, ok: null, score: null, unscored: true };
    let p = g.score * pts; if (tries && tries[i] > 1 && S.retry) p *= g.ok ? (S.retryShare != null ? S.retryShare : 0.5) : 1;
    max += pts; got += p; return { pts: Math.round(p * 100) / 100, max: pts, ok: g.ok, score: g.score, blank: !!g.blank };
  });
  return { per, got: Math.round(got * 100) / 100, max, pct: max ? Math.round(got / max * 1000) / 10 : 0 };
}

const G = { TYPES, norm, same, num, grade, keyText, studentCopy, cleanValue, mark, rng, shuffled, words, digits };
if (typeof module !== 'undefined' && module.exports) module.exports = G; else root.HBGrade = G;
})(typeof window !== 'undefined' ? window : this);
