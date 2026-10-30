/* ================= HelixBoard — reading worksheets for tests: PDF, Word, photos and scans, pasted text =================
   Turns a file into lines for the test reader (quizparse.js) and keeps the pictures that belong to the questions:
   - PDF: the text with its position and boldness; every figure, drawn shape, graph and diagram is found on the page (whatever is
     drawn there that is not text), cropped with its labels and put where it sits between the questions.
   - Word: text, lists, tables, bold/underlined options and pictures; charts and drawn shapes (arrows, boxes, labels on a picture,
     SmartArt) are drawn again as pictures in their place.
   - Photos and scanned pages: read with Tesseract (English/Arabic) and their figures found the same way.
   Each page is also kept as a picture, so the teacher can crop any figure by hand on the review screen. */
(() => {
'use strict';
const { need, toast } = window.HB;

/* ---------- equations and formulas: kept as exact pictures inside the text, as ⟦m:id⟧ (the test keeps the pictures in q.media) ---------- */
let MEDIA = {}, mseq = 0;
function token(src, w, h) { const id = (Date.now() % 1e7).toString(36) + (mseq++).toString(36); MEDIA[id] = { src, w: Math.round(w), h: Math.round(h) }; return '⟦m:' + id + '⟧'; }
const xe = t => String(t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
/* Word equations (OMML) → MathML, drawn by the browser exactly as Word lays them out */
function omml(n) {
  const all = e => e ? [...e.children].map(omml).join('') : '', ch = nm => child(n, nm), at = e => e && (e.getAttribute('m:val') || e.getAttribute('val') || e.getAttributeNS('*', 'val')), pr = nm => kid(ch(nm.replace(/Pr$/, '') + 'Pr') || n, nm);
  const row = e => '<mrow>' + all(e) + '</mrow>';
  switch (n.localName) {
    case 'r': { const t = kids(n, 't').map(x => x.textContent).join(''); const sty = kid(n, 'sty'), plain = (sty && /^(p|b)$/.test(at(sty))) || kid(n, 'nor'); if (plain) return '<mtext>' + xe(t) + '</mtext>';
      return (t.match(/\d+(?:[.,]\d+)*|[A-Za-z\u0370-\u03FF\u0600-\u06FF]|\s+|./gu) || []).map(k => /^\d/.test(k) ? '<mn>' + k + '</mn>' : /^\s+$/.test(k) ? '<mspace width="0.25em"/>' : /^[A-Za-z\u0370-\u03FF\u0600-\u06FF]$/.test(k) ? '<mi>' + xe(k) + '</mi>' : '<mo>' + xe(k) + '</mo>').join(''); }
    case 'f': { const ty = at(kid(ch('fPr'), 'type')); if (ty === 'lin') return '<mrow>' + all(ch('num')) + '<mo>/</mo>' + all(ch('den')) + '</mrow>'; return '<mfrac' + (ty === 'noBar' ? ' linethickness="0"' : '') + '>' + row(ch('num')) + row(ch('den')) + '</mfrac>'; }
    case 'sSup': return '<msup>' + row(ch('e')) + row(ch('sup')) + '</msup>';
    case 'sSub': return '<msub>' + row(ch('e')) + row(ch('sub')) + '</msub>';
    case 'sSubSup': return '<msubsup>' + row(ch('e')) + row(ch('sub')) + row(ch('sup')) + '</msubsup>';
    case 'sPre': return '<mmultiscripts>' + row(ch('e')) + '<mprescripts/>' + row(ch('sub')) + row(ch('sup')) + '</mmultiscripts>';
    case 'rad': { const hide = at(kid(ch('radPr'), 'degHide')), d = all(ch('deg')); return !d || (hide && hide !== '0' && hide !== 'off') ? '<msqrt>' + all(ch('e')) + '</msqrt>' : '<mroot>' + row(ch('e')) + '<mrow>' + d + '</mrow></mroot>'; }
    case 'd': { const p = ch('dPr'), g = (k, dflt) => { const e = p && child(p, k); return e ? at(e) || '' : dflt; }; const es = [...n.children].filter(c => c.localName === 'e').map(row);
      return '<mrow><mo>' + xe(g('begChr', '(')) + '</mo>' + es.join('<mo>' + xe(g('sepChr', '|')) + '</mo>') + '<mo>' + xe(g('endChr', ')')) + '</mo></mrow>'; }
    case 'nary': { const p = ch('naryPr'), c = p && child(p, 'chr') ? at(child(p, 'chr')) : '∫', ll = p && child(p, 'limLoc') ? at(child(p, 'limLoc')) : (c === '∫' ? 'subSup' : 'undOvr'), s1 = all(ch('sub')), s2 = all(ch('sup')), op = '<mo>' + xe(c) + '</mo>';
      return '<mrow>' + (s1 || s2 ? (ll === 'undOvr' ? '<munderover>' + op + '<mrow>' + s1 + '</mrow><mrow>' + s2 + '</mrow></munderover>' : '<msubsup>' + op + '<mrow>' + s1 + '</mrow><mrow>' + s2 + '</mrow></msubsup>') : op) + row(ch('e')) + '</mrow>'; }
    case 'acc': { const c = at(kid(ch('accPr'), 'chr')) || '\u0302'; return '<mover accent="true">' + row(ch('e')) + '<mo>' + xe(c) + '</mo></mover>'; }
    case 'bar': { const bot = at(kid(ch('barPr'), 'pos')) === 'bot'; return (bot ? '<munder>' : '<mover>') + row(ch('e')) + '<mo>' + (bot ? '_' : '‾') + '</mo>' + (bot ? '</munder>' : '</mover>'); }
    case 'groupChr': { const c = at(kid(ch('groupChrPr'), 'chr')) || '⏟', top = at(kid(ch('groupChrPr'), 'pos')) === 'top'; return (top ? '<mover>' : '<munder>') + row(ch('e')) + '<mo>' + xe(c) + '</mo>' + (top ? '</mover>' : '</munder>'); }
    case 'limLow': return '<munder>' + row(ch('e')) + row(ch('lim')) + '</munder>';
    case 'limUpp': return '<mover>' + row(ch('e')) + row(ch('lim')) + '</mover>';
    case 'func': return '<mrow>' + all(ch('fName')) + '<mo>&#x2061;</mo>' + all(ch('e')) + '</mrow>';
    case 'eqArr': return '<mtable>' + [...n.children].filter(c => c.localName === 'e').map(e => '<mtr><mtd>' + all(e) + '</mtd></mtr>').join('') + '</mtable>';
    case 'm': return '<mrow><mo>(</mo><mtable>' + [...n.children].filter(c => c.localName === 'mr').map(r => '<mtr>' + [...r.children].filter(c => c.localName === 'e').map(e => '<mtd>' + all(e) + '</mtd>').join('') + '</mtr>').join('') + '</mtable><mo>)</mo></mrow>';
    case 'borderBox': return '<menclose notation="box">' + row(ch('e')) + '</menclose>';
    case 'box': case 'phant': return row(ch('e'));
    case 'oMathPara': return [...n.children].filter(c => c.localName === 'oMath').map(all).join('<mspace width="1em"/>');
    default: if (/Pr$/.test(n.localName)) return ''; return all(n);
  }
}
const MATH_FONT = "'Cambria Math','STIX Two Math','Latin Modern Math','Times New Roman',serif";
async function mathPic(mml) {
  const m = '<math xmlns="http://www.w3.org/1998/Math/MathML" display="inline">' + mml + '</math>', css = 'font:22px ' + MATH_FONT + ';color:#111;white-space:nowrap;padding:3px 4px;display:inline-block;background:#fff';
  const div = document.createElement('div'); div.style.cssText = 'position:absolute;left:-9999px;top:0;' + css; div.innerHTML = m; document.body.appendChild(div); const w = Math.ceil(div.getBoundingClientRect().width) + 2, h = Math.ceil(div.getBoundingClientRect().height) + 2; div.remove();
  const k = 2, svg = '<svg xmlns="http://www.w3.org/2000/svg" width="' + w * k + '" height="' + h * k + '"><foreignObject width="' + w + '" height="' + h + '" transform="scale(' + k + ')"><div xmlns="http://www.w3.org/1999/xhtml" style="' + css + '">' + m + '</div></foreignObject></svg>';
  const img = new Image(); img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg); await img.decode();
  const c = document.createElement('canvas'); c.width = w * k; c.height = h * k; const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); g.drawImage(img, 0, 0);
  return token(c.toDataURL('image/png'), w * 0.8, h * 0.8); }

/* ---------- figures on a page picture: whatever is drawn that is not text ---------- */
function findFigures(cv, boxes, pxPerPt, lineOf) {
  const W = cv.width, H = cv.height, C = 4, gw = Math.ceil(W / C), gh = Math.ceil(H / C);
  const d = cv.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, W, H).data;
  let sum = 0, cnt = 0; for (let i = 0; i < d.length; i += 4 * 97) { sum += 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]; cnt++; }
  const bg = sum / cnt, dark = Math.min(215, bg - 45);
  const ink = new Uint8Array(gw * gh);
  for (let y = 0; y < H; y += 2) for (let x = 0; x < W; x += 2) { const i = (y * W + x) * 4, r = d[i], g = d[i + 1], b = d[i + 2], l = 0.299 * r + 0.587 * g + 0.114 * b, sat = Math.max(r, g, b) - Math.min(r, g, b);
    if (l < dark || (sat > 45 && l < 245)) ink[((y / C) | 0) * gw + ((x / C) | 0)] = 1; }
  /* text is not a figure */
  boxes.forEach(b => { const x0 = Math.max(0, ((b.box[0] - 1) / C) | 0), x1 = Math.min(gw - 1, ((b.box[2] + 1) / C) | 0), y0 = Math.max(0, ((b.box[1] - 1) / C) | 0), y1 = Math.min(gh - 1, ((b.box[3] + 1) / C) | 0);
    for (let y = y0; y <= y1; y++) ink.fill(0, y * gw + x0, y * gw + x1 + 1); });
  /* join the parts of one drawing (a gap of about 7 pt) */
  const R = Math.max(2, Math.round(7 * pxPerPt / C)), dil = new Uint8Array(gw * gh);
  const rowRun = new Uint8Array(gw * gh); for (let y = 0; y < gh; y++) { let last = -1e9; for (let x = 0; x < gw; x++) { if (ink[y * gw + x]) last = x; if (x - last <= R) rowRun[y * gw + x] = 1; } last = 1e9; for (let x = gw - 1; x >= 0; x--) { if (ink[y * gw + x]) last = x; if (last - x <= R) rowRun[y * gw + x] = 1; } }
  for (let x = 0; x < gw; x++) { let last = -1e9; for (let y = 0; y < gh; y++) { if (rowRun[y * gw + x]) last = y; if (y - last <= R) dil[y * gw + x] = 1; } last = 1e9; for (let y = gh - 1; y >= 0; y--) { if (rowRun[y * gw + x]) last = y; if (last - y <= R) dil[y * gw + x] = 1; } }
  const seen = new Uint8Array(gw * gh), out = [], stack = [];
  const comps = [];
  for (let s = 0; s < gw * gh; s++) { if (!dil[s] || seen[s]) continue; let x0 = 1e9, y0 = 1e9, x1 = -1, y1 = -1; stack.length = 0; stack.push(s); seen[s] = 1; const cells = [];
    while (stack.length) { const k = stack.pop(), x = k % gw, y = (k / gw) | 0; if (ink[k]) { cells.push(k); if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= gw || ny >= gh) continue; const j = ny * gw + nx; if (dil[j] && !seen[j]) { seen[j] = 1; stack.push(j); } } }
    if (cells.length >= 6 && x1 >= 0) comps.push({ x0, y0, x1, y1, cells }); }
  /* drawings side by side on one row (boxes joined by arrows, a food chain) are one figure */
  const gap = Math.round(26 * pxPerPt / C);
  for (let i = 0; i < comps.length; i++) for (let j = i + 1; j < comps.length; j++) { const a = comps[i], b = comps[j], ov = Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0), hx = Math.max(a.x0, b.x0) - Math.min(a.x1, b.x1);
    const big = (c => (c.y1 - c.y0) * C / pxPerPt >= 16); if (ov > 0.5 * Math.min(a.y1 - a.y0, b.y1 - b.y0) && hx < gap && big(a) && big(b)) { a.x0 = Math.min(a.x0, b.x0); a.y0 = Math.min(a.y0, b.y0); a.x1 = Math.max(a.x1, b.x1); a.y1 = Math.max(a.y1, b.y1); a.cells = a.cells.concat(b.cells); comps.splice(j, 1); j = i; } }
  const txtBoxes = boxes.filter(b => !b.tok);
  for (const { x0, y0, x1, y1, cells } of comps) { const n = cells.length;
    const bw = (x1 - x0 + 1) * C / pxPerPt, bh = (y1 - y0 + 1) * C / pxPerPt; if (bw < 4 || bh < 5 || (bh < 7 && bw > bh * 6)) continue;
    const cw = x1 - x0 + 1, ch = y1 - y0 + 1, box = [x0 * C, y0 * C, (x1 + 1) * C, (y1 + 1) * C];
    const inside = txtBoxes.filter(b => { const cx = (b.box[0] + b.box[2]) / 2, cy = (b.box[1] + b.box[3]) / 2; return cx > box[0] && cx < box[2] && cy > box[1] && cy < box[3]; });
    /* small drawings on a line of text — an equation, a formula or a symbol drawn as shapes — stay inline, exactly where they are */
    const beside = txtBoxes.some(b => b.box[3] > box[1] && b.box[1] < box[3] && (b.box[2] < box[0] || b.box[0] > box[2]));
    if (bw < 22 || bh < 16 || (bh <= 40 && bw <= 320 && beside && !inside.length)) { if (n >= 6) out.push({ box, n, inline: true, beside }); continue; }
    if (n < 25) continue;
    /* a frame drawn round some text (a box round a question or a word bank) is not a figure */
    let inner = 0; cells.forEach(k => { const x = k % gw, y = (k / gw) | 0; if (x > x0 + 3 && x < x1 - 3 && y > y0 + 3 && y < y1 - 3) inner++; });
    if (cw > 10 && ch > 10 && inner < n * 0.08) continue;
    /* a table: ink that is almost all full-width rows and full-height columns */
    const rows = new Map(), cols = new Map(); cells.forEach(k => { const x = k % gw, y = (k / gw) | 0; rows.set(y, (rows.get(y) || 0) + 1); cols.set(x, (cols.get(x) || 0) + 1); });
    let onGrid = 0; cells.forEach(k => { const x = k % gw, y = (k / gw) | 0; if (rows.get(y) > cw * 0.7 || cols.get(x) > ch * 0.7) onGrid++; });
    if (onGrid > n * 0.85 && n < cw * ch * 0.3 && (inside.length || cw > gw * 0.5)) continue;
    if (lineOf && inside.length) { const ls = lineOf(inside); if (ls.filter(t => /^\s*(?:[\(\[]?\d{1,3}\s*[.)\]\-:–]\s*\S|[\(\[]?[a-hA-Hأبجد]\s*[\)\].\-]\s*\S)/.test(t)).length >= 2) continue; }
    if (bw > 0.94 * W / pxPerPt && bh > 0.9 * H / pxPerPt) continue;
    out.push({ box, n, top: box[1] });
  }
  /* a small drawing that is not on a line of text belongs to the figure next to it (a label outside the picture), or is dropped */
  for (let i = out.length - 1; i >= 0; i--) { const f = out[i]; if (!f.inline || f.beside) continue; const m = 40 * pxPerPt;
    const fig = out.find(g => !g.inline && f.box[2] > g.box[0] - m && f.box[0] < g.box[2] + m && f.box[3] > g.box[1] - m && f.box[1] < g.box[3] + m);
    if (fig) { fig.box[0] = Math.min(fig.box[0], f.box[0]); fig.box[1] = Math.min(fig.box[1], f.box[1]); fig.box[2] = Math.max(fig.box[2], f.box[2]); fig.box[3] = Math.max(fig.box[3], f.box[3]); } out.splice(i, 1); }
  /* labels and axis titles next to a figure belong to it — never a question number or the words on its line */
  const qRows = boxes.filter(b => /^\s*\d{1,3}\s*[.)]\s*$/.test(b.s)).map(b => [b.box[1], b.box[3]]), onQRow = b => { const cy = (b.box[1] + b.box[3]) / 2; return qRows.some(([y0, y1]) => cy > y0 && cy < y1); };
  out.forEach(f => { if (f.inline) return; const m = 9 * pxPerPt; for (let pass = 0; pass < 2; pass++) boxes.forEach(b => { if (b.s.trim().length > 30 || onQRow(b)) return; const hit = b.box[2] > f.box[0] - m && b.box[0] < f.box[2] + m && b.box[3] > f.box[1] - m && b.box[1] < f.box[3] + m;
    if (hit && !/^\s*(?:\d{1,3}\s*[.)\-:–]\s*\S{2,}|[a-hA-H]\s*[).]\s+\S{2,})/.test(b.s)) { f.box[0] = Math.min(f.box[0], b.box[0]); f.box[1] = Math.min(f.box[1], b.box[1]); f.box[2] = Math.max(f.box[2], b.box[2]); f.box[3] = Math.max(f.box[3], b.box[3]); } }); });
  /* overlapping finds become one */
  for (let i = 0; i < out.length; i++) for (let j = i + 1; j < out.length; j++) { if (out[i].inline !== out[j].inline) continue; const a = out[i].box, b = out[j].box; if (a[0] < b[2] && b[0] < a[2] && a[1] < b[3] && b[1] < a[3]) { a[0] = Math.min(a[0], b[0]); a[1] = Math.min(a[1], b[1]); a[2] = Math.max(a[2], b[2]); a[3] = Math.max(a[3], b[3]); out.splice(j, 1); j = i; } }
  return out.map(f => { const p = f.inline ? 2 : 6, x0 = Math.max(0, f.box[0] - p), y0 = Math.max(0, f.box[1] - p), x1 = Math.min(W, f.box[2] + p), y1 = Math.min(H, f.box[3] + p); return { box: [x0, y0, x1, y1], top: f.top != null ? f.top : y0, inline: !!f.inline, img: crop(cv, x0, y0, x1 - x0, y1 - y0) }; });
}
function crop(cv, x, y, w, h, maxW) { maxW = maxW || 1100; const s = Math.min(1, maxW / w), c = document.createElement('canvas'); c.width = Math.max(1, Math.round(w * s)); c.height = Math.max(1, Math.round(h * s));
  const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); g.imageSmoothingQuality = 'high'; g.drawImage(cv, x, y, w, h, 0, 0, c.width, c.height);
  return c.width * c.height < 420000 ? c.toDataURL('image/png') : c.toDataURL('image/jpeg', 0.9); }
const pagePic = cv => crop(cv, 0, 0, cv.width, cv.height, 1400);
const isAr = s => (s.match(/[؀-ۿ]/g) || []).length > (s.match(/[A-Za-z]/g) || []).length;

/* text pieces with boxes → lines (top to bottom), with wide gaps kept as table cells */
const SUP = { '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹', '+': '⁺', '-': '⁻', '−': '⁻', '=': '⁼', '(': '⁽', ')': '⁾', 'n': 'ⁿ' };
const SUB = { '0': '₀', '1': '₁', '2': '₂', '3': '₃', '4': '₄', '5': '₅', '6': '₆', '7': '₇', '8': '₈', '9': '₉', '+': '₊', '-': '₋', '−': '₋', '=': '₌', '(': '₍', ')': '₎' };
/* pieces of one line → cells (wide gaps), in reading order */
function cellsOf(items, rtl) { const its = items.slice().sort((a, b) => rtl ? b.box[2] - a.box[2] : a.box[0] - b.box[0]), out = []; let cur = null, prev = null;
  its.forEach(it => { const fs = prev ? Math.max(6, Math.min(prev.h, it.h)) : 0, gap = prev ? (rtl ? prev.box[0] - it.box[2] : it.box[0] - prev.box[2]) : 0;
    if (!cur || gap > fs * 1.4) { cur = { x0: it.box[0], x1: it.box[2], parts: [] }; out.push(cur); }
    else if (gap > fs * 0.18 && !it.conv && !/\s$/.test(prev.s) && !/^\s/.test(it.s)) cur.parts.push(' ');
    cur.parts.push(it.s); cur.x0 = Math.min(cur.x0, it.box[0]); cur.x1 = Math.max(cur.x1, it.box[2]); prev = it; });
  return out.map(c => Object.assign(c, { t: c.parts.join('').replace(/\s+/g, ' ').trim() })).filter(c => c.t); }
function toLines(items, cv, pxPerPt) {
  const its = items.filter(it => it.s && it.s.trim()).map(it => Object.assign({}, it, { cy: (it.box[1] + it.box[3]) / 2, h: it.box[3] - it.box[1] })).sort((a, b) => a.cy - b.cy);
  if (!its.length) return [];
  /* lines: normal-size text first; small raised or lowered characters then join the line they overlap most */
  const hs = its.map(i => i.h).sort((a, b) => a - b), med = hs[hs.length >> 1], rows = [];
  const ov = (r, it) => Math.min(r.y1, it.box[3]) - Math.max(r.y0, it.box[1]);
  its.filter(i => i.tok || i.h >= med * 0.9).forEach(it => { const r = rows.find(r => ov(r, it) >= 0.3 * Math.min(it.h, r.y1 - r.y0)); if (r) { r.items.push(it); r.y0 = Math.min(r.y0, it.box[1]); r.y1 = Math.max(r.y1, it.box[3]); } else rows.push({ y0: it.box[1], y1: it.box[3], items: [it] }); });
  its.filter(i => !i.tok && i.h < med * 0.9).forEach(it => { let best = null, bo = 0; rows.forEach(r => { const o = ov(r, it); if (o > bo) { bo = o; best = r; } }); if (best && bo >= 0.3 * it.h) best.items.push(it); else rows.push({ y0: it.box[1], y1: it.box[3], items: [it] }); });
  rows.forEach(r => { r.cy = (r.y0 + r.y1) / 2; r.h = r.y1 - r.y0; }); rows.sort((a, b) => a.cy - b.cy);
  /* H₂O, NAD⁺, x²: small raised or lowered digits and signs become real sub/superscript characters (the line stays text) */
  rows.forEach(r => { const tx = r.items.filter(i => !i.tok); if (!tx.length) return; const H = Math.max(...tx.map(i => i.h)), core = tx.filter(i => i.h >= H * 0.88), mid = core.length ? core.reduce((s, i) => s + i.cy, 0) / core.length : r.cy;
    const small = tx.filter(i => i.h < H * 0.88 && Math.abs(i.cy - mid) > H * 0.14), stacked = i => small.some(j => j !== i && (j.cy < mid) !== (i.cy < mid) && Math.min(i.box[2], j.box[2]) - Math.max(i.box[0], j.box[0]) > Math.min(i.box[2] - i.box[0], j.box[2] - j.box[0]) * 0.4);
    tx.forEach(i => { if (i.h < H * 0.88 && Math.abs(i.cy - mid) > H * 0.14) { const t = i.s.trim(); /* one number right above another is a fraction, kept as a picture */ if (stacked(i)) { i.script = true; return; } if (/^[0-9+\-−=()n]{1,4}$/.test(t)) { const M = i.cy < mid ? SUP : SUB; if ([...t].every(c => M[c])) { i.s = [...t].map(c => M[c]).join(''); i.conv = true; return; } } i.script = true; } }); });
  /* a table row whose text wraps: the lines just above and below that sit only in its empty columns belong to it */
  for (let i = 0; i < rows.length; i++) { const R = rows[i], rtl = isAr(R.items.map(x => x.s).join('')), segs = cellsOf(R.items, rtl); if (segs.length < 2) continue;
    const fits = N => N && !N.taken && N.items.every(it => segs.every(sg => it.box[2] <= sg.x0 + 2 || it.box[0] >= sg.x1 - 2)) && Math.min(...N.items.map(x => x.box[0])) > Math.min(...segs.map(s => s.x1));
    const A = rows[i - 1], B = rows[i + 1];
    if (fits(A) && R.y0 - A.y1 < med * 0.8) { A.items.forEach(x => { x.band = 0; }); R.wrap = (R.wrap || []).concat(A.items); A.taken = true; }
    if (fits(B) && B.y0 - R.y1 < med * 0.8) { B.items.forEach(x => { x.band = 2; }); R.wrap = (R.wrap || []).concat(B.items); B.taken = true; } }
  const live = rows.filter(r => !r.taken);
  /* a line with an equation (math fonts, raised or lowered letters, √ ∑ ∫ …) is kept as an exact picture, after its number or letter */
  if (cv) { live.forEach(r => { if (r.wrap) return; r.math = r.items.some(i => !i.tok && (i.math || i.script)) || /[√∑∫∏∞∂≠≤≥≈∓∝]/.test(r.items.map(i => i.s).join('')); });
    for (let i = 0; i + 1 < live.length; i++) { const a = live[i], b = live[i + 1], c = live[i + 2], aB = Math.max(...a.items.map(x => x.box[3])), bT = Math.min(...b.items.map(x => x.box[1]));
      if (a.wrap || b.wrap) continue;
      /* the top or bottom of a fraction: a short, smaller line inside the width of the line next to it (the nearer one) */
      const short = r => r.items.every(x => x.s.trim().length <= 3) && r.items.map(x => x.s.trim()).join('').length <= 6, xr = r => [Math.min(...r.items.map(x => x.box[0])), Math.max(...r.items.map(x => x.box[2]))];
      const part = (p, o) => { const [p0, p1] = xr(p), [o0, o1] = xr(o); return short(p) && p0 > o0 + 4 && p1 < o1 + 2 && Math.max(...p.items.map(x => x.h)) < Math.max(...o.items.map(x => x.h)) * 0.92; };
      const nearerBelow = c && part(b, c) && (Math.min(...c.items.map(x => x.box[1])) - Math.max(...b.items.map(x => x.box[3]))) < bT - aB;
      if (!nearerBelow && ((((a.math || b.math) && (a.items.some(x => x.math) || b.items.some(x => x.math))) || part(a, b) || part(b, a)) && bT - aB < Math.min(a.h, b.h) * 0.45)) { a.items.push(...b.items); a.math = true; a.h = Math.max(a.h, b.h); live.splice(i + 1, 1); i--; } } }
  return live.map(r => { if (r.math && cv) return mathLine(r, cv, pxPerPt); const rtl = isAr(r.items.map(i => i.s).join(''));
    let cells = cellsOf(r.items, rtl).map(c => Object.assign(c, { band: 1 }));
    if (r.wrap) { [0, 2].forEach(bd => cellsOf(r.wrap.filter(x => x.band === bd), rtl).forEach(c => cells.push(Object.assign(c, { band: bd }))));
      const groups = []; cells.sort((a, b) => a.x0 - b.x0).forEach(c => { const g = groups.find(g => c.x0 < g.x1 - 2 && c.x1 > g.x0 + 2); if (g) { g.list.push(c); g.x0 = Math.min(g.x0, c.x0); g.x1 = Math.max(g.x1, c.x1); } else groups.push({ x0: c.x0, x1: c.x1, list: [c] }); });
      cells = groups.sort((a, b) => rtl ? b.x1 - a.x1 : a.x0 - b.x0).map(g => ({ t: g.list.sort((a, b) => a.band - b.band).map(c => c.t).join(' ') })); }
    const cs = cells.map(c => c.t).filter(Boolean), all = r.items.concat(r.wrap || []);
    return { t: cs.join('   '), cells: cs.length >= 2 ? cs : null, b: r.items.every(i => i.bold || !i.s.trim()), y: Math.min(...all.map(i => i.box[1])), y1: Math.max(...all.map(i => i.box[3])) }; });
}

function mathLine(r, cv, pxPerPt) { const rtl = isAr(r.items.map(i => i.s).join('')); const its = r.items.slice().sort((a, b) => rtl ? b.box[2] - a.box[2] : a.box[0] - b.box[0]);
  let lead = '', from = 0; const first = its[0], mk = first && first.s.match(/^\s*(?:(?:Q|Question|س)\s*)?(?:\d{1,3}\s*[.)\-:–]|[\(\[]?(?:[a-hA-H]|هـ|أ|ب|ج|د)\s*[\)\].\-]|[A-H](?=\s))\s*/);
  if (mk && !first.math) { lead = mk[0].trim() + ' '; const frac = mk[0].length / Math.max(1, first.s.length); if (frac >= 0.95) from = 1; else { const w = first.box[2] - first.box[0]; let cut = rtl ? first.box[2] - w * frac : first.box[0] + w * frac;
    /* cut in the white gap after the number or letter, never through a character */
    const y0 = Math.max(0, Math.floor(first.box[1])), hh = Math.max(1, Math.ceil(first.box[3] - first.box[1])), x0 = Math.max(0, Math.floor(first.box[0])), ww = Math.max(1, Math.ceil(w)), D = cv.getContext('2d', { willReadFrequently: true }).getImageData(x0, y0, ww, hh).data;
    const white = x => { const cx = Math.round(x - x0); if (cx < 0 || cx >= ww) return true; for (let y = 0; y < hh; y++) { const i = (y * ww + cx) * 4; if (D[i] + D[i + 1] + D[i + 2] < 600) return false; } return true; };
    const step = rtl ? 1 : -1; let k = 0; while (!white(cut) && k++ < w * 0.5) cut += step; first.cut = cut; } }
  const rest = its.slice(from); if (!rest.length) return { t: its.map(i => i.s).join(' ') };
  let x0 = Math.min(...rest.map(i => i.cut && !rtl ? i.cut : i.box[0])), x1 = Math.max(...rest.map(i => i.cut && rtl ? i.cut : i.box[2])), y0 = Math.min(...rest.map(i => i.box[1])), y1 = Math.max(...rest.map(i => i.box[3]));
  const pad = 3; x0 = Math.max(0, x0 - pad); y0 = Math.max(0, y0 - pad); x1 = Math.min(cv.width, x1 + pad); y1 = Math.min(cv.height, y1 + pad);
  const c = document.createElement('canvas'); c.width = Math.round(x1 - x0); c.height = Math.round(y1 - y0); const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); g.drawImage(cv, x0, y0, x1 - x0, y1 - y0, 0, 0, c.width, c.height);
  const k = 1.4 / pxPerPt, tk = token(c.toDataURL('image/png'), c.width * k, c.height * k);
  return { t: lead + tk, eq: true, y: y0, y1 }; }

/* ---------- PDF ---------- */
async function fromPdf(file, prog) {
  const lib = await window.HBIO.loadPdf();
  const doc = await lib.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
  const n = Math.min(doc.numPages, 40), pages = [], perPage = [], scans = [];
  for (let p = 1; p <= n; p++) { prog && prog('Reading page ' + p + ' of ' + n + '…', p / n);
    const pg = await doc.getPage(p), vp0 = pg.getViewport({ scale: 1 }), S = Math.min(2.4, 1500 / vp0.width), vp = pg.getViewport({ scale: S });
    const cv = document.createElement('canvas'); cv.width = Math.round(vp.width); cv.height = Math.round(vp.height); const g = cv.getContext('2d', { willReadFrequently: true }); g.fillStyle = '#fff'; g.fillRect(0, 0, cv.width, cv.height);
    await pg.render({ canvasContext: g, canvas: cv, viewport: vp }).promise;
    const tc = await pg.getTextContent();
    const items = tc.items.filter(it => it.str != null && it.transform).map(it => { const [a, b, c, d, e, f] = it.transform; const fs = Math.hypot(c, d) || Math.hypot(a, b) || 10;
      const M = vp.transform, pt = (x, y) => [M[0] * x + M[2] * y + M[4], M[1] * x + M[3] * y + M[5]], la = Math.hypot(a, b) || 1, lu = Math.hypot(c, d) || 1, ux = a / la, uy = b / la, vx = c / lu, vy = d / lu, w = it.width || fs * it.str.length * 0.5;
      /* the four corners of the text along its own baseline (rotated axis labels too) */
      const cs = [[0, -0.22], [w, -0.22], [w, 0.85], [0, 0.85]].map(([s2, h2]) => pt(e + ux * s2 + vx * h2 * fs, f + uy * s2 + vy * h2 * fs)), xs = cs.map(q => q[0]), ys = cs.map(q => q[1]), r = [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
      let bold = false, math = false; try { const fo = pg.commonObjs.has(it.fontName) && pg.commonObjs.get(it.fontName); bold = !!fo && (/bold|black|heavy|semibold|demi/i.test(fo.name || '') || !!fo.bold); math = !!fo && /math|cmmi|cmsy|cmex|msam|msbm|mt\s?extra|euclid|stix|symbol/i.test(fo.name || '') && !/^[\s•·\uf0b7\uf0a7\u25aa\u25cf\-–→←↔⇌⇒⟶×÷±°−+=<>≤≥≈≠∆Δπμαβγθλσω′″]*$/.test(it.str); } catch (er) {}
      return { s: it.str, box: [Math.min(r[0], r[2]), Math.min(r[1], r[3]), Math.max(r[0], r[2]), Math.max(r[1], r[3])], bold, math }; });
    const chars = items.reduce((s, i) => s + i.s.trim().length, 0);
    pages.push({ img: pagePic(cv), w: cv.width, h: cv.height });
    if (chars < 25) { scans.push({ p, cv }); perPage.push(null); continue; }
    perPage.push(pageLines(cv, items, S));
    pg.cleanup && pg.cleanup();
  }
  /* pages without a text layer are scans: read them */
  if (scans.length) { const o = await ocrCanvases(scans.map(s => s.cv), prog); scans.forEach((s, k) => { perPage[s.p - 1] = o[k]; }); }
  return { lines: dropRepeats(perPage.filter(Boolean)), pages };
}
function pageLines(cv, items, pxPerPt) {
  const figs = findFigures(cv, items, pxPerPt, ins => toLines(ins).map(l => l.t));
  const keep = items.filter(it => { const cx = (it.box[0] + it.box[2]) / 2, cy = (it.box[1] + it.box[3]) / 2; return !figs.some(f => cx > f.box[0] && cx < f.box[2] && cy > f.box[1] && cy < f.box[3]); });
  /* inline drawings become pictures inside their line of text */
  figs.filter(f => f.inline).forEach(f => { const w = f.box[2] - f.box[0], h = f.box[3] - f.box[1], k = 1.4 / pxPerPt, rowH = keep.filter(b => b.box[3] > f.box[1] && b.box[1] < f.box[3]).map(b => b.box[3] - b.box[1]);
    const box = rowH.length ? [f.box[0], (f.box[1] + f.box[3]) / 2 - Math.min(...rowH) / 2, f.box[2], (f.box[1] + f.box[3]) / 2 + Math.min(...rowH) / 2] : f.box;
    keep.push({ s: ' ' + token(f.img, w * k, h * k) + ' ', box, tok: true }); });
  const lines = toLines(keep, cv, pxPerPt); figs.filter(f => !f.inline).forEach(f => lines.push({ img: f.img, y: f.top, fig: true })); lines.sort((a, b) => a.y - b.y);
  return lines;
}
/* the same header or footer on every page is not part of any question */
function dropRepeats(pages) { if (pages.length < 2) return pages.flat(); const count = new Map(); pages.forEach(ls => new Set(ls.filter(l => l.t).map(l => l.t.replace(/\d+/g, '#'))).forEach(k => count.set(k, (count.get(k) || 0) + 1)));
  const need = Math.max(2, Math.ceil(pages.length * 0.6)); return pages.flatMap(ls => ls.filter(l => !l.t || count.get(l.t.replace(/\d+/g, '#')) < need)); }

/* ---------- photos and scans (Tesseract, the first time it downloads the reader) ---------- */
let ocrLang = 'eng+ara';
async function ocrCanvases(cvs, prog) {
  const T = await need('tesseract'); prog && prog('Loading the text reader (first time needs internet)…', 0);
  const w = await T.createWorker(ocrLang.split('+'), 1, { logger: m => { if (m.status && prog) prog(m.status.replace(/^\w/, c => c.toUpperCase()) + '…', m.progress || 0); } });
  const out = [];
  try { for (const [k, cv] of cvs.entries()) { prog && prog('Reading page ' + (k + 1) + ' of ' + cvs.length + '…', k / cvs.length);
    const r = await w.recognize(cv, {}, { blocks: true, text: true }); const items = [];
    (r.data.blocks || []).forEach(b => (b.paragraphs || []).forEach(p => (p.lines || []).forEach(l => (l.words || []).forEach(wd => { if (wd.text && wd.confidence > 25) items.push({ s: wd.text + ' ', box: [wd.bbox.x0, wd.bbox.y0, wd.bbox.x1, wd.bbox.y1], bold: !!wd.is_bold }); }))));
    if (!items.length && r.data.text) { out.push(window.HBQP.textLines(r.data.text)); continue; }
    out.push(pageLines(cv, items, cv.width / 595)); } }
  finally { await w.terminate(); }
  return out;
}
async function fromImages(files, prog) {
  const cvs = [], pages = [];
  for (const f of files) { const img = await new Promise((ok, bad) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => bad(new Error('That picture could not be opened.')); i.src = URL.createObjectURL(f); });
    const s = Math.min(1, 2400 / Math.max(img.naturalWidth, img.naturalHeight)), cv = document.createElement('canvas'); cv.width = Math.round(img.naturalWidth * s); cv.height = Math.round(img.naturalHeight * s);
    const g = cv.getContext('2d', { willReadFrequently: true }); g.drawImage(img, 0, 0, cv.width, cv.height); cvs.push(cv); pages.push({ img: pagePic(cv), w: cv.width, h: cv.height }); }
  const per = await ocrCanvases(cvs, prog); return { lines: per.flat(), pages };
}

/* ---------- Word ---------- */
async function unzip(buf) {
  const u8 = new Uint8Array(buf), dv = new DataView(buf); let e = u8.length - 22; while (e >= 0 && dv.getUint32(e, true) !== 0x06054b50) e--; if (e < 0) throw new Error('This is not a Word file.');
  const n = dv.getUint16(e + 10, true); let p = dv.getUint32(e + 16, true); const files = new Map(), dec = new TextDecoder();
  for (let i = 0; i < n; i++) { const method = dv.getUint16(p + 10, true), csize = dv.getUint32(p + 20, true), nl = dv.getUint16(p + 28, true), xl = dv.getUint16(p + 30, true), cl = dv.getUint16(p + 32, true), lo = dv.getUint32(p + 42, true);
    files.set(dec.decode(u8.subarray(p + 46, p + 46 + nl)), { method, csize, lo }); p += 46 + nl + xl + cl; }
  const read = async name => { const f = files.get(name); if (!f) return null; const a = f.lo + 30 + dv.getUint16(f.lo + 26, true) + dv.getUint16(f.lo + 28, true), data = u8.subarray(a, a + f.csize);
    if (f.method === 0) return data.slice(); return new Uint8Array(await new Response(new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).arrayBuffer()); };
  return { names: [...files.keys()], read, text: async nm => { const b = await read(nm); return b ? dec.decode(b) : null; } };
}
let CRC = null; const crc32 = b => { if (!CRC) { CRC = new Uint32Array(256); for (let i = 0; i < 256; i++) { let c = i; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; CRC[i] = c >>> 0; } } let c = 0xFFFFFFFF; for (let i = 0; i < b.length; i++) c = CRC[(c ^ b[i]) & 255] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; };
function zip(entries) { const enc = new TextEncoder(), parts = [], cen = []; let off = 0;
  entries.forEach(({ name, data }) => { const nb = enc.encode(name), crc = crc32(data), h = new DataView(new ArrayBuffer(30));
    h.setUint32(0, 0x04034b50, true); h.setUint16(4, 20, true); h.setUint32(14, crc, true); h.setUint32(18, data.length, true); h.setUint32(22, data.length, true); h.setUint16(26, nb.length, true);
    const c = new DataView(new ArrayBuffer(46)); c.setUint32(0, 0x02014b50, true); c.setUint16(4, 20, true); c.setUint16(6, 20, true); c.setUint32(16, crc, true); c.setUint32(20, data.length, true); c.setUint32(24, data.length, true); c.setUint16(28, nb.length, true); c.setUint32(42, off, true);
    parts.push(new Uint8Array(h.buffer), nb, data); cen.push(new Uint8Array(c.buffer), nb); off += 30 + nb.length + data.length; });
  const cs = cen.reduce((s, a) => s + a.length, 0), end = new DataView(new ArrayBuffer(22)); end.setUint32(0, 0x06054b50, true); end.setUint16(8, entries.length, true); end.setUint16(10, entries.length, true); end.setUint32(12, cs, true); end.setUint32(16, off, true);
  return new Blob([...parts, ...cen, new Uint8Array(end.buffer)]).arrayBuffer(); }

const W_NS = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
const kids = (el, name) => el ? [...el.getElementsByTagNameNS('*', name)] : [];
const kid = (el, name) => kids(el, name)[0] || null;
const child = (el, name) => el ? [...el.children].find(c => c.localName === name) || null : null;
const SCHEME = { accent1: '#4472C4', accent2: '#ED7D31', accent3: '#A5A5A5', accent4: '#FFC000', accent5: '#5B9BD5', accent6: '#70AD47', tx1: '#000000', dk1: '#000000', bg1: '#FFFFFF', lt1: '#FFFFFF', tx2: '#44546A', dk2: '#44546A', bg2: '#E7E6E6', lt2: '#E7E6E6', hlink: '#0563C1' };
function colorOf(el) { if (!el) return null; const s = child(el, 'srgbClr'), sc = child(el, 'schemeClr'), sys = child(el, 'sysClr'); let c = s ? '#' + s.getAttribute('val') : sc ? SCHEME[sc.getAttribute('val')] || '#4472C4' : sys ? '#' + (sys.getAttribute('lastClr') || '000000') : null;
  const mod = s || sc; if (c && mod) { const lm = child(mod, 'lumMod'), lo = child(mod, 'lumOff'), sh = child(mod, 'shade'), ti = child(mod, 'tint'); let [r, g, b] = [1, 3, 5].map(i => parseInt(c.slice(i, i + 2), 16));
    const f = (m, o) => { r = Math.min(255, r * m + 255 * o); g = Math.min(255, g * m + 255 * o); b = Math.min(255, b * m + 255 * o); };
    if (lm) f(+lm.getAttribute('val') / 1e5, lo ? +lo.getAttribute('val') / 1e5 : 0); if (sh) f(+sh.getAttribute('val') / 1e5, 0); if (ti) { const t = +ti.getAttribute('val') / 1e5; f(t, 1 - t); }
    c = '#' + [r, g, b].map(v => Math.round(v).toString(16).padStart(2, '0')).join(''); } return c; }
const PAL = ['#4472C4', '#ED7D31', '#A5A5A5', '#FFC000', '#5B9BD5', '#70AD47', '#264478', '#9E480E'];

/* a Word chart, drawn again */
function drawChart(xml) {
  const d = new DOMParser().parseFromString(xml, 'application/xml'), plot = kid(d, 'plotArea'); if (!plot) return null;
  const chartEl = [...plot.children].find(c => /Chart$/.test(c.localName)); if (!chartEl) return null;
  const kind = chartEl.localName.replace(/3D/, ''), txt = el => el ? kids(el, 't').map(t => t.textContent).join('') || kids(el, 'v').map(v => v.textContent).join(' ') : '';
  const title = txt(child(kid(d, 'chart'), 'title')), bar = /bar/i.test(kind), horiz = bar && (kid(chartEl, 'barDir') || { getAttribute: () => 'col' }).getAttribute('val') === 'bar';
  const pts = el => { const o = []; kids(el, 'pt').forEach(p => { o[+p.getAttribute('idx')] = (kid(p, 'v') || {}).textContent; }); return o; };
  const sers = kids(chartEl, 'ser').map((s, i) => ({ name: txt(child(s, 'tx')) || 'Series ' + (i + 1), cat: pts(child(s, 'cat') || child(s, 'xVal')), val: pts(child(s, 'val') || child(s, 'yVal')).map(Number), col: colorOf(kid(child(s, 'spPr'), 'solidFill')) || PAL[i % PAL.length], pc: kids(s, 'dPt').map(dp => [+(kid(dp, 'idx') || { getAttribute: () => 0 }).getAttribute('val'), colorOf(kid(dp, 'solidFill'))]) }));
  if (!sers.length) return null;
  const axT = n => { const a = kid(plot, n); return a ? txt(child(a, 'title')) : ''; };
  const cv = document.createElement('canvas'), Wd = 1000, Ht = 620; cv.width = Wd; cv.height = Ht; const g = cv.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, Wd, Ht);
  g.font = '600 26px Segoe UI, Arial'; g.fillStyle = '#222'; g.textAlign = 'center'; if (title) g.fillText(title, Wd / 2, 40);
  const cats = sers[0].cat.length ? sers[0].cat : sers[0].val.map((_, i) => String(i + 1));
  if (/pie|doughnut/i.test(kind)) { const s = sers[0], tot = s.val.reduce((a, b) => a + (b || 0), 0) || 1; let a0 = -Math.PI / 2; const cx = 360, cy = 340, r = 220;
    s.val.forEach((v, i) => { const a1 = a0 + (v || 0) / tot * Math.PI * 2; g.beginPath(); g.moveTo(cx, cy); g.arc(cx, cy, r, a0, a1); g.closePath(); g.fillStyle = (s.pc.find(p => p[0] === i) || [])[1] || PAL[i % PAL.length]; g.fill(); g.strokeStyle = '#fff'; g.lineWidth = 3; g.stroke();
      const am = (a0 + a1) / 2; g.fillStyle = '#fff'; g.font = '700 20px Segoe UI, Arial'; if (v / tot > 0.04) g.fillText(Math.round(v / tot * 100) + '%', cx + Math.cos(am) * r * 0.65, cy + Math.sin(am) * r * 0.65 + 7); a0 = a1; });
    if (/doughnut/i.test(kind)) { g.beginPath(); g.arc(cx, cy, r * 0.5, 0, 7); g.fillStyle = '#fff'; g.fill(); }
    g.textAlign = 'left'; g.font = '20px Segoe UI, Arial'; cats.forEach((c, i) => { g.fillStyle = (s.pc.find(p => p[0] === i) || [])[1] || PAL[i % PAL.length]; g.fillRect(640, 150 + i * 36, 22, 22); g.fillStyle = '#222'; g.fillText(String(c).slice(0, 26), 672, 168 + i * 36); });
    return cv.toDataURL('image/png'); }
  const L = 110, T = title ? 70 : 30, Rr = Wd - 40, Bm = Ht - 110, scatter = /scatter/i.test(kind);
  const all = sers.flatMap(s => s.val).filter(Number.isFinite); let lo = Math.min(0, ...all), hi = Math.max(...all, 1);
  const step = (() => { const raw = (hi - lo) / 6, p = Math.pow(10, Math.floor(Math.log10(raw))); return [1, 2, 2.5, 5, 10].map(m => m * p).find(s => s >= raw); })(); lo = Math.floor(lo / step) * step; hi = Math.ceil(hi / step) * step;
  const xs = scatter ? sers.flatMap(s => s.cat.map(Number)).filter(Number.isFinite) : []; const xlo = xs.length ? Math.min(...xs) : 0, xhi = xs.length ? Math.max(...xs) : 1;
  const Y = v => Bm - (v - lo) / (hi - lo) * (Bm - T), X = v => L + (v - xlo) / ((xhi - xlo) || 1) * (Rr - L);
  g.strokeStyle = '#ddd'; g.lineWidth = 1; g.font = '18px Segoe UI, Arial'; g.fillStyle = '#444';
  if (!horiz) for (let v = lo; v <= hi + 1e-9; v += step) { g.beginPath(); g.moveTo(L, Y(v)); g.lineTo(Rr, Y(v)); g.stroke(); g.textAlign = 'right'; g.fillText(+v.toFixed(6), L - 10, Y(v) + 6); }
  g.strokeStyle = '#333'; g.lineWidth = 2; g.beginPath(); g.moveTo(L, T); g.lineTo(L, Bm); g.lineTo(Rr, Bm); g.stroke();
  const n = cats.length, bw = (Rr - L) / Math.max(1, n);
  if (horiz) { const bh = (Bm - T) / Math.max(1, n), XV = v => L + (v - lo) / (hi - lo) * (Rr - L);
    for (let v = lo; v <= hi + 1e-9; v += step) { g.strokeStyle = '#ddd'; g.lineWidth = 1; g.beginPath(); g.moveTo(XV(v), T); g.lineTo(XV(v), Bm); g.stroke(); g.fillStyle = '#444'; g.textAlign = 'center'; g.fillText(+v.toFixed(6), XV(v), Bm + 24); }
    cats.forEach((c, i) => { sers.forEach((s, k) => { const w = bh * 0.7 / sers.length; g.fillStyle = s.col; g.fillRect(XV(Math.min(0, s.val[i] || 0)), T + i * bh + bh * 0.15 + k * w, Math.abs(XV(s.val[i] || 0) - XV(0)), w); }); g.fillStyle = '#333'; g.textAlign = 'right'; g.fillText(String(c).slice(0, 12), L - 8, T + i * bh + bh / 2 + 6); }); }
  else if (bar) cats.forEach((c, i) => { sers.forEach((s, k) => { const w = bw * 0.7 / sers.length, x = L + i * bw + bw * 0.15 + k * w, v = s.val[i] || 0; g.fillStyle = (s.pc.find(p => p[0] === i) || [])[1] || s.col; g.fillRect(x, Math.min(Y(v), Y(0)), w - 2, Math.abs(Y(v) - Y(0))); }); g.fillStyle = '#333'; g.textAlign = 'center'; g.fillText(String(c).slice(0, 14), L + i * bw + bw / 2, Bm + 26); });
  else { if (!scatter) cats.forEach((c, i) => { g.fillStyle = '#333'; g.textAlign = 'center'; g.fillText(String(c).slice(0, 14), L + i * bw + bw / 2, Bm + 26); });
    else for (let k = 0; k <= 6; k++) { const v = xlo + (xhi - xlo) * k / 6; g.fillStyle = '#444'; g.textAlign = 'center'; g.fillText(+v.toPrecision(4), X(v), Bm + 26); }
    sers.forEach(s => { const P = s.val.map((v, i) => [scatter ? X(+s.cat[i]) : L + i * bw + bw / 2, Y(v)]).filter(p => Number.isFinite(p[0]) && Number.isFinite(p[1]));
      g.strokeStyle = s.col; g.lineWidth = 4; if (!scatter || kid(chartEl, 'scatterStyle') && /line/i.test(kid(chartEl, 'scatterStyle').getAttribute('val'))) { g.beginPath(); P.forEach((p, i) => i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])); if (/area/i.test(kind)) { g.lineTo(P[P.length - 1][0], Bm); g.lineTo(P[0][0], Bm); g.fillStyle = s.col + '88'; g.fill(); } g.stroke(); }
      g.fillStyle = s.col; P.forEach(p => { g.beginPath(); g.arc(p[0], p[1], 6, 0, 7); g.fill(); }); }); }
  g.fillStyle = '#222'; g.font = '600 20px Segoe UI, Arial'; g.textAlign = 'center'; const xt = axT(horiz ? 'valAx' : scatter ? 'valAx' : 'catAx'), yt = axT(horiz ? 'catAx' : 'valAx');
  if (xt) g.fillText(xt, (L + Rr) / 2, Ht - 40); if (yt && !scatter) { g.save(); g.translate(30, (T + Bm) / 2); g.rotate(-Math.PI / 2); g.fillText(yt, 0, 0); g.restore(); }
  if (scatter) { const ax = kids(plot, 'valAx'); const t1 = ax[0] ? txt(child(ax[0], 'title')) : '', t2 = ax[1] ? txt(child(ax[1], 'title')) : ''; g.fillText(t1, (L + Rr) / 2, Ht - 40); if (t2) { g.save(); g.translate(30, (T + Bm) / 2); g.rotate(-Math.PI / 2); g.fillText(t2, 0, 0); g.restore(); } }
  if (sers.length > 1) { g.font = '18px Segoe UI, Arial'; g.textAlign = 'left'; let x = L; sers.forEach(s => { g.fillStyle = s.col; g.fillRect(x, Ht - 26, 18, 18); g.fillStyle = '#222'; g.fillText(s.name.slice(0, 20), x + 24, Ht - 11); x += 40 + g.measureText(s.name.slice(0, 20)).width; }); }
  return cv.toDataURL('image/png');
}

/* Word shapes (boxes, arrows, lines, text labels, pictures in a group, SmartArt drawings), drawn again */
const EMU = 12700;
function collectShapes(root, media, base) {
  const out = [];
  const walk = (el, tf) => { for (const c of el.children) { const ln = c.localName;
    if (ln === 'grpSp' || ln === 'wgp') { const gp = child(c, 'grpSpPr'), x = gp && kid(gp, 'xfrm'); let t = tf;
      if (x) { const off = child(x, 'off'), ext = child(x, 'ext'), co = child(x, 'chOff'), ce = child(x, 'chExt'); if (off && ext && co && ce) { const sx = (+ext.getAttribute('cx') || 1) / (+ce.getAttribute('cx') || 1), sy = (+ext.getAttribute('cy') || 1) / (+ce.getAttribute('cy') || 1), ox = +off.getAttribute('x'), oy = +off.getAttribute('y'), cx = +co.getAttribute('x'), cy = +co.getAttribute('y');
        t = p => tf([ox + (p[0] - cx) * sx, oy + (p[1] - cy) * sy]).concat([]); t.s = [(tf.s || [1, 1])[0] * sx, (tf.s || [1, 1])[1] * sy]; } }
      walk(c, t); continue; }
    if (ln === 'wsp' || ln === 'sp' || ln === 'pic' || ln === 'cxnSp') { const sp = child(c, 'spPr'), x = sp && kid(sp, 'xfrm'); if (!x) { walk(c, tf); continue; } const off = child(x, 'off'), ext = child(x, 'ext'); if (!off || !ext) continue;
      const p0 = tf([+off.getAttribute('x'), +off.getAttribute('y')]), s = tf.s || [1, 1];
      const o = { x: p0[0], y: p0[1], w: +ext.getAttribute('cx') * s[0], h: +ext.getAttribute('cy') * s[1], rot: (+x.getAttribute('rot') || 0) / 60000, fh: x.getAttribute('flipH') === '1', fv: x.getAttribute('flipV') === '1' };
      const pg = kid(sp, 'prstGeom'); o.geom = ln === 'pic' ? 'pic' : pg ? pg.getAttribute('prst') : 'rect';
      const st = child(c, 'style'), nf = child(sp, 'noFill'), sf = child(sp, 'solidFill'), lnEl = child(sp, 'ln');
      o.fill = nf ? null : sf ? colorOf(sf) : st && child(st, 'fillRef') && +child(st, 'fillRef').getAttribute('idx') > 0 ? colorOf(child(st, 'fillRef')) : (ln === 'pic' || /line|Connector/i.test(o.geom) ? null : (st ? '#4472C4' : null));
      o.line = lnEl && child(lnEl, 'noFill') ? null : lnEl && child(lnEl, 'solidFill') ? colorOf(child(lnEl, 'solidFill')) : st && child(st, 'lnRef') ? colorOf(child(st, 'lnRef')) || '#2F528F' : (ln === 'pic' ? null : '#2F528F');
      o.lw = lnEl && lnEl.getAttribute('w') ? Math.max(0.75, +lnEl.getAttribute('w') / EMU) : 1.2;
      o.head = lnEl && child(lnEl, 'headEnd') && child(lnEl, 'headEnd').getAttribute('type') !== 'none'; o.tail = lnEl && child(lnEl, 'tailEnd') && child(lnEl, 'tailEnd').getAttribute('type') !== 'none';
      if (ln === 'pic') { const bl = kid(c, 'blip'), rid = bl && (bl.getAttribute('r:embed') || bl.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'embed')); o.src = rid && media(rid); }
      const paras = kids(c, 'txbxContent').length ? kids(kid(c, 'txbxContent'), 'p') : kids(child(c, 'txBody') || c, 'p');
      o.text = paras.map(p => kids(p, 't').map(t => t.textContent).join('')).join('\n').trim();
      const wv = el => el.getAttribute('w:val') || el.getAttribute('val'), sz = kid(c, 'sz') || kid(c, 'rPr'); o.fs = sz ? (sz.localName === 'sz' ? (+wv(sz) || 22) / 2 : (+sz.getAttribute('sz') || 1100) / 100) : 11;
      const tc = kid(c, 'color'); o.tc = tc && wv(tc) && wv(tc) !== 'auto' ? '#' + wv(tc) : (o.fill && o.fill !== '#FFFFFF' && st ? '#FFFFFF' : '#111111');
      const tsf = kid(child(c, 'txBody'), 'solidFill'); if (tsf) o.tc = colorOf(tsf) || o.tc;
      out.push(o); } } };
  const id = p => p; id.s = [1, 1]; walk(root, base || id); return out;
}
async function drawShapes(shapes) {
  if (!shapes.length) return null; let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  shapes.forEach(s => { x0 = Math.min(x0, s.x); y0 = Math.min(y0, s.y); x1 = Math.max(x1, s.x + s.w); y1 = Math.max(y1, s.y + s.h); });
  const pad = 8 * EMU, Wd = x1 - x0 + pad * 2, Ht = y1 - y0 + pad * 2; if (Wd <= 0 || Ht <= 0) return null;
  const k = Math.min(1100 / Wd, 900 / Ht, 3.2 / EMU), cv = document.createElement('canvas'); cv.width = Math.max(40, Math.round(Wd * k)); cv.height = Math.max(30, Math.round(Ht * k));
  const g = cv.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, cv.width, cv.height); const pt = k * EMU;
  const imgs = await Promise.all(shapes.map(s => s.src ? new Promise(ok => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => ok(null); i.src = s.src; }) : null));
  shapes.forEach((s, i) => { const X = (s.x - x0 + pad) * k, Y = (s.y - y0 + pad) * k, w = s.w * k, h = s.h * k; g.save(); g.translate(X + w / 2, Y + h / 2); if (s.rot) g.rotate(s.rot * Math.PI / 180); g.scale(s.fh ? -1 : 1, s.fv ? -1 : 1); g.translate(-w / 2, -h / 2);
    g.lineWidth = Math.max(1, s.lw * pt); g.strokeStyle = s.line || 'transparent'; g.fillStyle = s.fill || 'transparent'; g.lineJoin = 'round';
    const P = pts => { g.beginPath(); pts.forEach((p, j) => j ? g.lineTo(p[0] * w, p[1] * h) : g.moveTo(p[0] * w, p[1] * h)); g.closePath(); };
    const arrowHead = (ax, ay, bx, by) => { const a = Math.atan2(by - ay, bx - ax), L = Math.max(10, g.lineWidth * 4); g.beginPath(); g.moveTo(bx, by); g.lineTo(bx - L * Math.cos(a - 0.45), by - L * Math.sin(a - 0.45)); g.lineTo(bx - L * Math.cos(a + 0.45), by - L * Math.sin(a + 0.45)); g.closePath(); g.fillStyle = s.line || '#2F528F'; g.fill(); };
    const geo = s.geom || 'rect', G = geo.toLowerCase();
    if (geo === 'pic') { if (imgs[i]) g.drawImage(imgs[i], 0, 0, w, h); }
    else if (/line|connector/i.test(geo)) { g.beginPath(); g.moveTo(0, 0); if (/bent/i.test(geo)) { g.lineTo(w / 2, 0); g.lineTo(w / 2, h); } g.lineTo(w, h); g.strokeStyle = s.line || '#2F528F'; g.stroke(); if (s.tail) arrowHead(/bent/i.test(geo) ? w / 2 : 0, /bent/i.test(geo) ? h : 0, w, h); if (s.head) arrowHead(/bent/i.test(geo) ? w / 2 : w, 0, 0, 0); }
    else { if (/ellipse|oval|flowchartconnector|donut|cloud|heart|sun|moon|smiley|pie|chord/.test(G)) { g.beginPath(); g.ellipse(w / 2, h / 2, w / 2, h / 2, 0, 0, 7); }
      else if (/roundrect|terminator|snip|plaque/.test(G)) { const r = Math.min(w, h) * (G.includes('terminator') ? 0.5 : 0.17); g.beginPath(); g.roundRect ? g.roundRect(0, 0, w, h, r) : g.rect(0, 0, w, h); }
      else if (G === 'triangle' || G === 'flowchartextract') P([[0.5, 0], [1, 1], [0, 1]]); else if (G === 'rttriangle') P([[0, 0], [1, 1], [0, 1]]);
      else if (/diamond|decision/.test(G)) P([[0.5, 0], [1, 0.5], [0.5, 1], [0, 0.5]]); else if (/parallelogram|inputoutput|data$/.test(G)) P([[0.25, 0], [1, 0], [0.75, 1], [0, 1]]);
      else if (G === 'trapezoid') P([[0.2, 0], [0.8, 0], [1, 1], [0, 1]]); else if (G === 'hexagon') P([[0.25, 0], [0.75, 0], [1, 0.5], [0.75, 1], [0.25, 1], [0, 0.5]]);
      else if (G === 'pentagon' || G === 'homeplate') P([[0, 0], [0.8, 0], [1, 0.5], [0.8, 1], [0, 1]]); else if (G === 'chevron') P([[0, 0], [0.75, 0], [1, 0.5], [0.75, 1], [0, 1], [0.25, 0.5]]);
      else if (G === 'octagon') P([[0.3, 0], [0.7, 0], [1, 0.3], [1, 0.7], [0.7, 1], [0.3, 1], [0, 0.7], [0, 0.3]]);
      else if (/^star/.test(G)) { const n = parseInt(G.slice(4)) || 5, pts = []; for (let j = 0; j < n * 2; j++) { const a = -Math.PI / 2 + j * Math.PI / n, r = j % 2 ? 0.4 : 1; pts.push([0.5 + Math.cos(a) * r / 2, 0.5 + Math.sin(a) * r / 2]); } P(pts); }
      else if (G === 'rightarrow' || G === 'striped rightarrow' || G === 'notchedrightarrow') P([[0, 0.25], [0.65, 0.25], [0.65, 0], [1, 0.5], [0.65, 1], [0.65, 0.75], [0, 0.75]]);
      else if (G === 'leftarrow') P([[1, 0.25], [0.35, 0.25], [0.35, 0], [0, 0.5], [0.35, 1], [0.35, 0.75], [1, 0.75]]);
      else if (G === 'uparrow') P([[0.25, 1], [0.25, 0.35], [0, 0.35], [0.5, 0], [1, 0.35], [0.75, 0.35], [0.75, 1]]);
      else if (G === 'downarrow') P([[0.25, 0], [0.25, 0.65], [0, 0.65], [0.5, 1], [1, 0.65], [0.75, 0.65], [0.75, 0]]);
      else if (G === 'leftrightarrow') P([[0, 0.5], [0.25, 0], [0.25, 0.25], [0.75, 0.25], [0.75, 0], [1, 0.5], [0.75, 1], [0.75, 0.75], [0.25, 0.75], [0.25, 1]]);
      else if (G === 'plus' || G === 'mathplus' || G === 'cross') P([[0.35, 0], [0.65, 0], [0.65, 0.35], [1, 0.35], [1, 0.65], [0.65, 0.65], [0.65, 1], [0.35, 1], [0.35, 0.65], [0, 0.65], [0, 0.35], [0.35, 0.35]]);
      else if (G === 'can') { g.beginPath(); g.ellipse(w / 2, h * 0.1, w / 2, h * 0.1, 0, Math.PI, 0); g.lineTo(w, h * 0.9); g.ellipse(w / 2, h * 0.9, w / 2, h * 0.1, 0, 0, Math.PI); g.closePath(); }
      else { g.beginPath(); g.rect(0, 0, w, h); }
      if (s.fill) g.fill(); if (s.line) g.stroke(); }
    if (s.text) { g.setTransform(1, 0, 0, 1, 0, 0); g.translate(X + w / 2, Y + h / 2); if (s.rot) g.rotate(s.rot * Math.PI / 180);
      const fs = Math.max(9, s.fs * pt), lines = []; g.font = '600 ' + fs + 'px Segoe UI, Arial'; g.fillStyle = s.tc; g.textAlign = 'center'; g.textBaseline = 'middle'; g.direction = isAr(s.text) ? 'rtl' : 'ltr';
      s.text.split('\n').forEach(par => { let line = ''; par.split(/\s+/).forEach(wd => { const t2 = line ? line + ' ' + wd : wd; if (g.measureText(t2).width > Math.max(w - 8, fs * 3) && line) { lines.push(line); line = wd; } else line = t2; }); lines.push(line); });
      lines.forEach((l, j) => g.fillText(l, 0, (j - (lines.length - 1) / 2) * fs * 1.2)); }
    g.restore(); });
  return cv.toDataURL('image/png');
}

/* Word's automatic numbering ("1." for questions, "a)" for options) is written into the text, exactly as Word shows it */
const ABJAD = ['أ', 'ب', 'ج', 'د', 'هـ', 'و', 'ز', 'ح', 'ط', 'ي'], ALPHA_AR = ['أ', 'ب', 'ت', 'ث', 'ج', 'ح', 'خ', 'د', 'ذ', 'ر'];
const roman = n => { let s = ''; [[1000, 'm'], [900, 'cm'], [500, 'd'], [400, 'cd'], [100, 'c'], [90, 'xc'], [50, 'l'], [40, 'xl'], [10, 'x'], [9, 'ix'], [5, 'v'], [4, 'iv'], [1, 'i']].forEach(([v, r]) => { while (n >= v) { s += r; n -= v; } }); return s; };
function fmtNum(n, f) { switch (f) { case 'lowerLetter': return String.fromCharCode(96 + ((n - 1) % 26) + 1); case 'upperLetter': return String.fromCharCode(64 + ((n - 1) % 26) + 1); case 'lowerRoman': return roman(n); case 'upperRoman': return roman(n).toUpperCase();
  case 'arabicAbjad': return ABJAD[(n - 1) % ABJAD.length]; case 'arabicAlpha': return ALPHA_AR[(n - 1) % ALPHA_AR.length]; case 'hindiNumbers': case 'arabicIndic': return String(n).replace(/\d/g, d => '٠١٢٣٤٥٦٧٨٩'[d]); case 'bullet': return '•'; case 'none': return ''; default: return String(n); } }
async function numberLists(doc, z) {
  const nx = await z.text('word/numbering.xml'); if (!nx) return false; const nd = new DOMParser().parseFromString(nx, 'application/xml'), sx = await z.text('word/styles.xml'), sd = sx ? new DOMParser().parseFromString(sx, 'application/xml') : null;
  const A = n => n.getAttribute('w:val') ?? n.getAttributeNS(W_NS, 'val');
  const abs = new Map(); kids(nd, 'abstractNum').forEach(a => { const lv = {}; kids(a, 'lvl').forEach(l => { const k = +l.getAttribute('w:ilvl'); lv[k] = { start: +(A(kid(l, 'start') || { getAttribute: () => 1, getAttributeNS: () => 1 }) || 1), fmt: kid(l, 'numFmt') ? A(kid(l, 'numFmt')) : 'decimal', text: kid(l, 'lvlText') ? A(kid(l, 'lvlText')) : '%' + (k + 1) + '.' }; }); abs.set(a.getAttribute('w:abstractNumId'), lv); });
  const nums = new Map(); kids(nd, 'num').forEach(n => { const an = kid(n, 'abstractNumId'); nums.set(n.getAttribute('w:numId'), { abs: an ? A(an) : null, starts: Object.fromEntries(kids(n, 'lvlOverride').map(o => [+o.getAttribute('w:ilvl'), kid(o, 'startOverride') ? +A(kid(o, 'startOverride')) : null])) }); });
  const styleNum = new Map(); if (sd) kids(sd, 'style').forEach(st => { const np = kid(child(st, 'pPr'), 'numPr'); if (np) styleNum.set(st.getAttribute('w:styleId'), { id: kid(np, 'numId') ? A(kid(np, 'numId')) : null, lvl: kid(np, 'ilvl') ? +A(kid(np, 'ilvl')) : 0 }); });
  const count = new Map(); let any = false;
  for (const p of [...doc.getElementsByTagNameNS(W_NS, 'p')]) { const pPr = child(p, 'pPr'); if (!pPr) continue; let np = child(pPr, 'numPr'), id = null, lvl = 0;
    if (np) { id = kid(np, 'numId') ? A(kid(np, 'numId')) : null; lvl = kid(np, 'ilvl') ? +A(kid(np, 'ilvl')) : 0; }
    if (!id) { const ps = child(pPr, 'pStyle'), sn = ps && styleNum.get(A(ps)); if (sn) { id = sn.id; if (!np) lvl = sn.lvl; } }
    if (!id || id === '0') continue; const num = nums.get(id); if (!num) continue; const L = abs.get(num.abs); if (!L || !L[lvl]) continue;
    /* Word counts per abstract list, so a list interrupted by a picture or a paragraph carries on */
    const key = num.abs, c = count.get(key) || []; for (let k = 0; k <= 8; k++) if (c[k] == null && L[k]) c[k] = (num.starts[k] != null ? num.starts[k] : L[k].start) - 1;
    c[lvl] = (c[lvl] || 0) + 1; for (let k = lvl + 1; k <= 8; k++) if (L[k]) c[k] = (num.starts[k] != null ? num.starts[k] : L[k].start) - 1; count.set(key, c);
    const label = L[lvl].fmt === 'bullet' ? '•' : L[lvl].text.replace(/%(\d)/g, (_, d) => L[+d - 1] ? fmtNum(c[+d - 1] || 1, L[+d - 1].fmt) : '');
    if (!label.trim()) continue;
    const r = doc.createElementNS(W_NS, 'w:r'), t = doc.createElementNS(W_NS, 'w:t'); t.setAttributeNS('http://www.w3.org/XML/1998/namespace', 'xml:space', 'preserve'); t.textContent = label + ' '; r.appendChild(t);
    const firstRun = [...p.children].find(x => x.localName === 'r'); const rp = firstRun && child(firstRun, 'rPr'); if (rp) r.insertBefore(rp.cloneNode(true), t);
    pPr.nextSibling ? p.insertBefore(r, pPr.nextSibling) : p.appendChild(r);
    if (np) pPr.removeChild(np); const nn = doc.createElementNS(W_NS, 'w:numPr'), ni = doc.createElementNS(W_NS, 'w:numId'); ni.setAttributeNS(W_NS, 'w:val', '0'); nn.appendChild(ni); pPr.appendChild(nn); any = true; }
  return any;
}

/* a mark in the text where a chart or drawing was, so it lands between the right lines */
const MARK = n => '⟦HBFIG' + n + '⟧';
async function prepDocx(buf) {
  const z = await unzip(buf), xml = await z.text('word/document.xml'); if (!xml) throw new Error('This Word file has no document inside.');
  const doc = new DOMParser().parseFromString(xml, 'application/xml'), rels = new DOMParser().parseFromString((await z.text('word/_rels/document.xml.rels')) || '<Relationships/>', 'application/xml');
  const target = id => { const r = [...rels.getElementsByTagName('Relationship')].find(r => r.getAttribute('Id') === id); if (!r) return null; const t = r.getAttribute('Target'); return t.startsWith('/') ? t.slice(1) : 'word/' + t.replace(/^\.\//, ''); };
  const mediaCache = new Map(), mediaUrls = new Map();
  const ridOf = el => el && (el.getAttribute('r:id') || el.getAttribute('r:embed') || el.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'id') || el.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'embed'));
  const figs = []; let changed = false;
  /* pictures inside drawn groups need their bytes up front */
  for (const bl of [...doc.getElementsByTagNameNS('*', 'blip')]) { const rid = ridOf(bl), t = rid && target(rid); if (t && !mediaCache.has(rid)) { const b = await z.read(t); if (b) { const ext = t.split('.').pop().toLowerCase(), type = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', bmp: 'image/bmp', webp: 'image/webp', svg: 'image/svg+xml' }[ext]; if (type) mediaUrls.set(rid, URL.createObjectURL(new Blob([b], { type }))); } mediaCache.set(rid, 1); } }
  const media = rid => mediaUrls.get(rid) || null;
  const replace = (node, n) => { const t = doc.createElementNS(W_NS, 'w:t'); t.setAttributeNS('http://www.w3.org/XML/1998/namespace', 'xml:space', 'preserve'); t.textContent = ' ' + MARK(n) + ' '; node.parentNode.replaceChild(t, node); changed = true; };
  const drawings = [...doc.getElementsByTagNameNS(W_NS, 'drawing')];
  const done = new Set();
  /* floating drawings in one paragraph (a picture with text-box labels and arrows on it) are drawn together */
  const byPara = new Map(); drawings.forEach(dw => { if (!child(dw, 'anchor')) return; let p = dw.parentNode; while (p && p.localName !== 'p') p = p.parentNode; if (!p) return; if (!byPara.has(p)) byPara.set(p, []); byPara.get(p).push(dw); });
  for (const [, list] of byPara) { if (list.length < 2) continue; const hasShape = list.some(dw => kid(dw, 'wsp') || kid(dw, 'wgp') || kid(dw, 'cxnSp')); if (!hasShape) continue;
    const shapes = []; list.forEach(dw => { const an = child(dw, 'anchor'), ph = kid(an, 'positionH'), pv = kid(an, 'positionV'), ox = +((ph && kid(ph, 'posOffset') || {}).textContent || 0), oy = +((pv && kid(pv, 'posOffset') || {}).textContent || 0), ext = child(an, 'extent');
      const gd = kid(an, 'graphicData'); if (!gd) return; const base = p => [ox + p[0], oy + p[1]]; base.s = [1, 1];
      const inner = collectShapes(gd, media, base); if (inner.length === 1 && ext) { inner[0].w = +ext.getAttribute('cx'); inner[0].h = +ext.getAttribute('cy'); inner[0].x = ox; inner[0].y = oy; } shapes.push(...inner); });
    const img = await drawShapes(shapes).catch(() => null); if (!img) continue; const n = figs.push(img) - 1;
    list.forEach((dw, k) => { const outer = dw.parentNode && dw.parentNode.localName === 'Choice' ? dw.parentNode.parentNode : dw; if (k === 0) replace(outer, n); else { outer.parentNode && outer.parentNode.removeChild(outer); changed = true; } done.add(dw); }); }
  for (const dw of drawings) { if (done.has(dw) || !dw.parentNode) continue;
    const gd = kid(dw, 'graphicData'); if (!gd) continue; const uri = gd.getAttribute('uri') || '';
    let img = null;
    if (/chart/.test(uri)) { const c = kid(gd, 'chart'), t = c && target(ridOf(c)); const cx = t && await z.text(t); if (cx) img = drawChart(cx); }
    else if (/diagram/.test(uri)) { const ri = kid(gd, 'relIds'), dm = ri && target(ri.getAttribute('r:dm') || ri.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'dm'));
      const dx = dm && await z.text(dm), rid = dx && (dx.match(/dataModelExt[^>]*relId="([^"]+)"/) || [])[1], dp = rid && target(rid), dd = dp && await z.text(dp);
      if (dd) { const dDoc = new DOMParser().parseFromString(dd, 'application/xml'); const tree = kid(dDoc, 'spTree'); if (tree) img = await drawShapes(collectShapes(tree, media)); } }
    else if (kid(gd, 'wsp') || kid(gd, 'wgp')) { const shapes = collectShapes(gd, media); const words = shapes.reduce((s, x) => s + (x.text || '').length, 0);
      /* one big text box full of questions stays text */
      if (shapes.length === 1 && words > 100) continue; const ext = kid(dw, 'extent'); if (shapes.length === 1 && ext) { shapes[0].w = +ext.getAttribute('cx'); shapes[0].h = +ext.getAttribute('cy'); }
      img = await drawShapes(shapes).catch(() => null); }
    if (!img) continue; const n = figs.push(img) - 1, outer = dw.parentNode.localName === 'Choice' ? dw.parentNode.parentNode : dw; replace(outer, n); }
  mediaUrls.forEach(u => setTimeout(() => URL.revokeObjectURL(u), 60000));
  const numbered = await numberLists(doc, z); if (numbered) changed = true;
  /* equations: drawn exactly, then put back in the text where they were */
  const maths = [...doc.getElementsByTagNameNS('*', 'oMathPara'), ...doc.getElementsByTagNameNS('*', 'oMath')].filter(m => { let p = m.parentNode; while (p) { if (p.localName === 'oMath' || p.localName === 'oMathPara') return false; p = p.parentNode; } return true; });
  for (const m of maths) { let tk = ''; try { tk = await mathPic(omml(m)); } catch (e) { console.warn(e); tk = m.textContent; }
    const r = doc.createElementNS(W_NS, 'w:r'), t = doc.createElementNS(W_NS, 'w:t'); t.setAttributeNS('http://www.w3.org/XML/1998/namespace', 'xml:space', 'preserve'); t.textContent = ' ' + tk + ' '; r.appendChild(t); m.parentNode.replaceChild(r, m); changed = true; }
  if (!changed) return { buf, figs };
  const entries = []; for (const nm of z.names) { if (nm.endsWith('/')) continue; entries.push({ name: nm, data: nm === 'word/document.xml' ? new TextEncoder().encode(new XMLSerializer().serializeToString(doc)) : await z.read(nm) }); }
  return { buf: await zip(entries), figs, numbered };
}
async function fromDocx(file, prog) {
  prog && prog('Opening the Word file…', 0.1); const mm = await need('mammoth');
  let pre; try { pre = await prepDocx(await file.arrayBuffer()); } catch (e) { console.warn(e); pre = { buf: await file.arrayBuffer(), figs: [] }; }
  prog && prog('Reading the questions…', 0.5);
  const html = (await mm.convertToHtml({ arrayBuffer: pre.buf }, { styleMap: ['u => u'] })).value;
  const d = new DOMParser().parseFromString('<div>' + html + '</div>', 'text/html'), lines = [];
  const emit = (el, prefix) => {
    const parts = []; let buf = ''; const walkInline = n => { n.childNodes.forEach(c => { if (c.nodeType === 3) buf += c.textContent; else if (c.nodeName === 'IMG') { parts.push({ t: buf }); buf = ''; parts.push({ img: c.getAttribute('src') }); } else if (c.nodeName === 'BR') buf += ' '; else walkInline(c); }); };
    walkInline(el); parts.push({ t: buf });
    const txt = el.textContent.replace(/\s+/g, ' ').trim(), strong = [...el.querySelectorAll('strong,b')].map(s => s.textContent).join('').replace(/\s+/g, ' ').trim(), und = [...el.querySelectorAll('u')].map(s => s.textContent).join('').replace(/\s+/g, ' ').trim();
    const b = !!txt && strong.length >= txt.replace(/^[\(\[]?\s*[a-hA-Hأبجد\d]{1,3}\s*[.)\]\-:]\s*/, '').length * 0.9, u = !!txt && und.length >= txt.replace(/^[\(\[]?\s*[a-hA-Hأبجد\d]{1,3}\s*[.)\]\-:]\s*/, '').length * 0.9;
    let first = true; parts.forEach(p => { if (p.img) { if (/^data:image\/(png|jpe?g|gif|webp|bmp|svg)/.test(p.img)) lines.push({ img: p.img }); return; }
      p.t.split(/(⟦HBFIG\d+⟧)/).forEach(s => { const m = s.match(/⟦HBFIG(\d+)⟧/); if (m) { if (pre.figs[+m[1]]) lines.push({ img: pre.figs[+m[1]] }); return; } if (!s.trim()) return; lines.push({ t: (first && prefix ? prefix : '') + s.trim(), b, u }); first = false; }); });
  };
  const walk = (node, depth, counters) => { [...node.children].forEach(c => { const tag = c.tagName.toLowerCase();
    if (/^(p|h[1-6])$/.test(tag)) emit(c, '');
    else if (tag === 'ol' || tag === 'ul') { let i = 0; [...c.children].forEach(li => { if (li.tagName !== 'LI') return; i++;
        const own = li.cloneNode(true); own.querySelectorAll('ol,ul').forEach(x => x.remove());
        const prefix = pre.numbered ? '' : tag === 'ol' ? (depth === 0 ? i + '. ' : String.fromCharCode(96 + i) + ') ') : (depth > 0 ? String.fromCharCode(96 + i) + ') ' : '• ');
        emit(own, prefix); [...li.children].filter(x => /^(OL|UL)$/.test(x.tagName)).forEach(x => walk({ children: [x] }, depth + 1)); }); }
    else if (tag === 'table') { [...c.querySelectorAll('tr')].forEach(tr => { const cells = [...tr.children].map(td => td.textContent.replace(/\s+/g, ' ').trim()); const imgs = [...tr.querySelectorAll('img')];
        imgs.forEach(im => lines.push({ img: im.getAttribute('src') })); const cs = cells.filter(Boolean); if (cs.length === 1) { const one = [...tr.children].find(td => td.textContent.trim()); one && walk(one, depth); } else if (cs.length) lines.push({ t: cs.join('   '), cells: cs, b: !!tr.querySelector('strong') && tr.querySelector('strong').textContent.length > cs.join('').length * 0.9 }); }); }
    else if (tag === 'img') lines.push({ img: c.getAttribute('src') });
    else walk(c, depth); }); };
  walk(d.body.firstChild, 0);
  return { lines, pages: [] };
}

/* ---------- any file ---------- */
async function read(files, prog, lang) { MEDIA = {}; const r = await readAny(files, prog, lang); r.media = MEDIA; return r; }
async function readAny(files, prog, lang) {
  ocrLang = lang === 'ar' ? 'ara+eng' : lang === 'en' ? 'eng' : 'eng+ara';
  files = [].concat(files); const f = files[0], name = (f.name || '').toLowerCase();
  if (/\.pdf$/.test(name) || f.type === 'application/pdf') return fromPdf(f, prog);
  if (/\.docx$/.test(name)) return fromDocx(f, prog);
  if (/\.(txt|csv|md)$/.test(name) || /^text\//.test(f.type)) return { lines: window.HBQP.textLines(await f.text()), pages: [] };
  if (/^image\//.test(f.type) || /\.(png|jpe?g|webp|bmp|gif)$/.test(name)) return fromImages(files.filter(x => /^image\//.test(x.type) || /\.(png|jpe?g|webp|bmp|gif)$/i.test(x.name)), prog);
  if (/\.doc$/.test(name)) throw new Error('Old .doc files cannot be read. In Word choose File → Save As → Word Document (.docx), or save as PDF.');
  throw new Error('Choose a PDF, a Word (.docx) file, a photo of the page, or a text file.');
}
window.HBQI = { read, token, mathPic, omml, get media() { return MEDIA; }, findFigures, toLines, drawChart, drawShapes, collectShapes, unzip, zip, crop, prepDocx };
})();
