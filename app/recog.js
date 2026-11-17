/* ================= HelixBoard — recognition: smart shapes, tidy-up, ink → text, photo → text, loupe ================= */
(() => {
'use strict';
const { $, $$, clamp, esc, set, bus, toast, modal, SND, uid, need, needESM } = window.HB;
const E = window.HBE, I = window.HBI;

/* ---------- geometry helpers ---------- */
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const pathLen = P => { let L = 0; for (let i = 1; i < P.length; i++) L += dist(P[i - 1], P[i]); return L; };
function rdp(P, eps) { if (P.length < 3) return P.slice(); let dmax = 0, idx = 0; const a = P[0], b = P[P.length - 1]; for (let i = 1; i < P.length - 1; i++) { const d = segDist(P[i], a, b); if (d > dmax) { dmax = d; idx = i; } } if (dmax > eps) { const l = rdp(P.slice(0, idx + 1), eps), r = rdp(P.slice(idx), eps); return l.slice(0, -1).concat(r); } return [a, b]; }
const segDist = (p, a, b) => { const dx = b[0] - a[0], dy = b[1] - a[1], l = dx * dx + dy * dy, t = l ? clamp(((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / l, 0, 1) : 0; return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy); };
const angleAt = (a, b, c) => { const v1 = [a[0] - b[0], a[1] - b[1]], v2 = [c[0] - b[0], c[1] - b[1]]; return Math.acos(clamp((v1[0] * v2[0] + v1[1] * v2[1]) / (Math.hypot(...v1) * Math.hypot(...v2) || 1), -1, 1)); };
function bboxP(P) { let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9; P.forEach(p => { x0 = Math.min(x0, p[0]); y0 = Math.min(y0, p[1]); x1 = Math.max(x1, p[0]); y1 = Math.max(y1, p[1]); }); return [x0, y0, x1 - x0, y1 - y0]; }

/* ---------- smart shape recognition (one stroke → clean shape) ---------- */
function recognize(P0) { const P = P0.map(p => [p[0], p[1]]); if (P.length < 6) return null; const L = pathLen(P), chord = dist(P[0], P[P.length - 1]), b = bboxP(P), diag = Math.hypot(b[2], b[3]); if (diag < 18) return null;
  /* straight line */
  if (chord / L > 0.94) return { t: 'shape', k: 'line', line: [P[0][0], P[0][1], P[P.length - 1][0], P[P.length - 1][1]], seed: 3 };
  const closed = chord < Math.max(24, diag * 0.2);
  if (closed) { const C = P.concat([P[0]]); const V = rdp(C, diag * 0.075); let n = V.length - 1; /* merge near-collinear vertices */ const keep = []; for (let i = 0; i < n; i++) { const a = V[(i - 1 + n) % n], c = V[(i + 1) % n]; if (angleAt(a, V[i], c) < Math.PI * 0.86) keep.push(V[i]); } n = keep.length;
    /* circularity: compare spread of radius */ const cx = b[0] + b[2] / 2, cy = b[1] + b[3] / 2; const rs = P.map(p => Math.hypot((p[0] - cx) / (b[2] / 2 || 1), (p[1] - cy) / (b[3] / 2 || 1))); const mean = rs.reduce((a, r) => a + r, 0) / rs.length, sd = Math.sqrt(rs.reduce((a, r) => a + (r - mean) ** 2, 0) / rs.length);
    if (n === 3) return { t: 'shape', k: 'tri', x: b[0], y: b[1], w: b[2], h: b[3], _pts: keep, seed: 3, ...triFix(keep, b) };
    if (n === 4 && sd > 0.07) return quadFix(keep, b);
    if (n >= 8 && n <= 12) { const rr = keep.map(p => Math.hypot(p[0] - cx, p[1] - cy)); const alt = rr.every((r, i) => (r > rr[(i + 1) % n]) !== (r > rr[(i - 1 + n) % n]) || true); const big = rr.filter(r => r > (Math.max(...rr) + Math.min(...rr)) / 2).length; if (Math.min(...rr) < Math.max(...rr) * 0.62 && big >= 4 && big <= 6) return { t: 'shape', k: 'star', x: b[0], y: b[1], w: Math.max(b[2], b[3]), h: Math.max(b[2], b[3]), seed: 3 }; }
    if (sd < 0.14 || n > 6) { const sq = Math.abs(b[2] - b[3]) < Math.max(b[2], b[3]) * 0.16; const w = sq ? (b[2] + b[3]) / 2 : b[2], h = sq ? w : b[3]; return { t: 'shape', k: 'ellipse', x: cx - w / 2, y: cy - h / 2, w, h, seed: 3 }; }
    if (n === 5 || n === 6) return { t: 'shape', k: 'poly', n, x: b[0], y: b[1], w: b[2], h: b[3], seed: 3 };
    if (n === 4) return quadFix(keep, b); return null; }
  /* open strokes: arrows and ticks */
  const V = rdp(P, diag * 0.08);
  if (V.length >= 3) { let maxI = 0, maxL = 0; for (let i = 1; i < V.length; i++) { const l = dist(V[i - 1], V[i]); if (l > maxL) { maxL = l; maxI = i; } } const rest = pathLen(V.slice(maxI));
    if (maxI === 1 && rest < maxL * 0.75 && rest > maxL * 0.08) { const tip = V[1], s0 = V[0]; const a2 = angleAt(s0, tip, V[2]); if (a2 < Math.PI * 0.42 || V.length > 3) return { t: 'shape', k: 'arrow', line: [s0[0], s0[1], tip[0], tip[1]], seed: 3 }; }
    if (V.length === 3) { const l1 = dist(V[0], V[1]), l2 = dist(V[1], V[2]); if (l2 > l1 * 1.3 && V[1][1] > V[0][1] && V[2][1] < V[1][1] && V[1][0] > V[0][0] && V[2][0] > V[1][0]) return { t: 'stroke', pen: 'pen', pts: [V[0][0], V[0][1], 0.5, V[1][0], V[1][1], 0.5, V[2][0], V[2][1], 0.5], tm: [0, 100, 200], w: 6, sp: true, tick: true }; } }
  return null; }
function triFix(k, b) { /* right triangle if one angle ≈ 90° with axis-aligned legs */ for (let i = 0; i < 3; i++) { const a = angleAt(k[(i + 2) % 3], k[i], k[(i + 1) % 3]); if (Math.abs(a - Math.PI / 2) < 0.22) return { k: 'rtri' }; } return {}; }
function quadFix(k, b) { const e = (i) => Math.atan2(k[(i + 1) % 4][1] - k[i][1], k[(i + 1) % 4][0] - k[i][0]); const a0 = e(0), aligned = [0, 1, 2, 3].every(i => { const a = ((e(i) % (Math.PI / 2)) + Math.PI / 2) % (Math.PI / 2); return a < 0.22 || a > Math.PI / 2 - 0.22; });
  if (aligned) return { t: 'shape', k: 'rect', x: b[0], y: b[1], w: b[2], h: b[3], seed: 3 }; const cx = k.reduce((s, p) => s + p[0], 0) / 4, cy = k.reduce((s, p) => s + p[1], 0) / 4, w = (dist(k[0], k[1]) + dist(k[2], k[3])) / 2, h = (dist(k[1], k[2]) + dist(k[3], k[0])) / 2; return { t: 'shape', k: 'rect', x: cx - w / 2, y: cy - h / 2, w, h, rot: a0, seed: 3 }; }
function convertShapes() { const strokes = I.selObjs().filter(o => o.t === 'stroke'); if (!strokes.length) { toast('Select some ink first (Lasso or Select), then press Ink → shapes.'); return; } const out = [], gone = []; strokes.forEach(o => { const r = recognize(E.ptsOf(o)); if (r) { r.c = o.c; r.sw = Math.max(2, o.w * 0.8); if (r.t === 'stroke') r.w = o.w; delete r._pts; out.push(r); gone.push(o); } }); if (!out.length) { toast('No clean shapes recognised in that ink.'); return; } E.tx(() => { E.del(gone); E.add(out); }); I.select(out); SND.pop(); toast(out.length + ' shape' + (out.length > 1 ? 's' : '') + ' recognised'); }
function straighten() { const strokes = I.selObjs().filter(o => o.t === 'stroke'); if (!strokes.length) { toast('Select ink to straighten.'); return; } const lines = [], gone = [], mods = []; strokes.forEach(o => { const P = E.ptsOf(o); const L = pathLen(P), ch = dist(P[0], P[P.length - 1]); if (ch / L > 0.85) { lines.push({ t: 'shape', k: 'line', line: [P[0][0], P[0][1], P[P.length - 1][0], P[P.length - 1][1]], c: o.c, sw: Math.max(2, o.w * 0.8) }); gone.push(o); } else mods.push(o); }); E.tx(() => { if (gone.length) { E.del(gone); E.add(lines); } if (mods.length) E.mod(mods, o => { const b = bboxP(E.ptsOf(o)); const V = rdp(E.ptsOf(o), Math.hypot(b[2], b[3]) * 0.04); o.pts = V.flatMap(p => [p[0], p[1], 0.5]); o.tm = V.map((_, i) => i * 60); o.sp = true; }); }); SND.pop(); }
function smooth() { const strokes = I.selObjs().filter(o => o.t === 'stroke'); if (!strokes.length) { toast('Select ink to smooth.'); return; } E.mod(strokes, o => { let P = E.ptsOf(o); for (let it = 0; it < 2; it++) { const Q = [P[0]]; for (let i = 0; i < P.length - 1; i++) { const a = P[i], b = P[i + 1]; Q.push([a[0] * 0.75 + b[0] * 0.25, a[1] * 0.75 + b[1] * 0.25, a[2]], [a[0] * 0.25 + b[0] * 0.75, a[1] * 0.25 + b[1] * 0.75, b[2]]); } Q.push(P[P.length - 1]); P = Q; } o.pts = P.flat(); o.tm = P.map((_, i) => i * 8); }); SND.pop(); }

function info() { modal.open('<h2>What recognition can do</h2><table class="t"><tr><th>Feature</th><th>How it works</th><th>Good to know</th></tr><tr><td><b>Ink → shapes</b> and <b>QuickShape</b></td><td>Instant, offline, built into HelixBoard</td><td>Lines, arrows, circles, ellipses, triangles, rectangles, pentagons, hexagons, stars and ticks. Hold the pen still at the end of a stroke for QuickShape.</td></tr><tr><td><b>Tidy</b></td><td>Offline</td><td>Straighten, smooth, align and spread selected items.</td></tr><tr><td><b>Ink → text</b></td><td>Your browser’s built-in recogniser when it has one (mainly Chromebooks); otherwise the free TrOCR model</td><td>TrOCR downloads once (about 64 MB) and then works offline. Best on neat English print, one line at a time. Cursive is less accurate.</td></tr><tr><td><b>Photo → text</b></td><td>Tesseract.js, English and Arabic</td><td>For printed worksheets and book pages. Needs internet the first time.</td></tr><tr><td colspan="3"><b>Not reliable in a browser today:</b> Arabic handwriting and handwritten chemical formulas. Use the Science Keys keyboard (عربي, Chemistry, Sub/Super) and the equation editor instead. HelixBoard always shows recognised text for you to check before it is placed.</td></tr></table>'); }

/* ---------- loupe (magnifier) ---------- */
let loupeOn = false, mouse = null; const stage = $('#stage');
stage.addEventListener('pointermove', e => { if (!loupeOn) return; const r = stage.getBoundingClientRect(); mouse = [e.clientX - r.left, e.clientY - r.top]; E.dirty.live = true; });
function loupe() { loupeOn = !loupeOn; E.dirty.live = true; toast(loupeOn ? 'Loupe on: move over the board to magnify (×3).' : 'Loupe off'); window.HBUI && HBUI.refresh(); }
E.liveDrawers.push({ active: () => loupeOn, draw(g) { if (!loupeOn || !mouse) return; const D = E.DPR, R = 110, z = 3; g.setTransform(D, 0, 0, D, 0, 0); g.save(); g.beginPath(); g.arc(mouse[0], mouse[1], R, 0, 7); g.clip(); const sx = (mouse[0] - R / z) * D, sy = (mouse[1] - R / z) * D, sw = 2 * R / z * D; ['#cvBg', '#cvMain'].forEach(s => g.drawImage($(s), sx, sy, sw, sw, mouse[0] - R, mouse[1] - R, 2 * R, 2 * R)); g.restore(); g.strokeStyle = '#22D3EE'; g.lineWidth = 4; g.beginPath(); g.arc(mouse[0], mouse[1], R, 0, 7); g.stroke(); g.strokeStyle = 'rgba(0,0,0,.4)'; g.lineWidth = 1; g.beginPath(); g.arc(mouse[0], mouse[1], R + 3, 0, 7); g.stroke(); } });

window.HBR = { recognize, convertShapes, straighten, smooth, info, loupe, get loupeOn() { return loupeOn; } };
})();

