/* ================= HelixBoard — Paper answer cards (like Plickers) =================
   For classes without phones: every student gets a printed card with a square code. To answer, they turn the card so their
   letter (A, B, C or D) is at the top and hold it up; the teacher's camera reads the whole room in a few seconds. Each code
   is unique to one card number, and the way it is turned gives the answer. Everything runs on this computer: no internet. */
(() => {
'use strict';
const { $, $$, esc, icon, set, toast, modal, SND, need } = window.HB;
const snd = k => { try { SND[k] && SND[k](); } catch (e) {} };
const LET = 'ABCD', COL = ['#FF5FA2', '#22D3EE', '#FFC928', '#4ADE80'];

/* ---------- the codes: 5×5 bits inside a black border (7×7 cells). Each code looks different in all four turns and from every other code ---------- */
const pop = x => { let n = 0; while (x) { x &= x - 1; n++; } return n; };
const rot = b => { let o = 0; for (let i = 0; i < 5; i++) for (let j = 0; j < 5; j++) if (b >> (24 - ((4 - j) * 5 + i)) & 1) o |= 1 << (24 - (i * 5 + j)); return o; };
const rots = b => { const r = [b]; for (let k = 1; k < 4; k++) r.push(rot(r[k - 1])); return r; };
const CODES = (() => { const out = [], all = []; let s = 0x2545F491;
  for (let t = 0; t < 400000 && out.length < 100; t++) { s = (Math.imul(s, 1103515245) + 12345) >>> 0; const b = (s >>> 3) & 0x1FFFFFF, n = pop(b); if (n < 9 || n > 16) continue;
    const R = rots(b); let ok = true; for (let i = 0; i < 4 && ok; i++) for (let j = i + 1; j < 4; j++) if (pop(R[i] ^ R[j]) < 7) { ok = false; break; }
    if (ok) for (const r of R) { if (all.some(x => pop(x ^ r) < 6)) { ok = false; break; } }
    if (ok) { out.push(R); all.push(...R); } }
  return out; })();
const MAX = CODES.length;
const cellOn = (id, i, j) => i === 0 || j === 0 || i === 6 || j === 6 || !!(CODES[id][0] >> (24 - ((i - 1) * 5 + (j - 1))) & 1);

/* ---------- the roster: card number → name, kept per class ---------- */
const rkey = () => 'cardRoster:' + (window.HBX ? HBX.cur() || '*' : '*');
const roster = () => set.get(rkey(), []);
const nameOf = id => roster()[id] || 'Card ' + (id + 1);

/* ---------- reading a camera frame ---------- */
function detect(im) { const W = im.width, H = im.height, d = im.data, N = W * H, g = new Uint8Array(N), I = new Uint32Array((W + 1) * (H + 1));
  for (let i = 0, p = 0; i < N; i++, p += 4) g[i] = (d[p] * 77 + d[p + 1] * 150 + d[p + 2] * 29) >> 8;
  for (let y = 0; y < H; y++) { let row = 0; for (let x = 0; x < W; x++) { row += g[y * W + x]; I[(y + 1) * (W + 1) + x + 1] = I[y * (W + 1) + x + 1] + row; } }
  /* dark against the local average, so uneven classroom light does not matter */
  const r = Math.max(8, Math.round(Math.min(W, H) / 16)), bin = new Uint8Array(N);
  for (let y = 0; y < H; y++) { const y0 = Math.max(0, y - r), y1 = Math.min(H, y + r + 1); for (let x = 0; x < W; x++) { const x0 = Math.max(0, x - r), x1 = Math.min(W, x + r + 1);
    const sum = I[y1 * (W + 1) + x1] - I[y0 * (W + 1) + x1] - I[y1 * (W + 1) + x0] + I[y0 * (W + 1) + x0]; bin[y * W + x] = g[y * W + x] * (x1 - x0) * (y1 - y0) < (sum * 0.86) ? 1 : 0; } }
  const lab = new Int32Array(N), stack = new Int32Array(N), found = new Map(), minA = N * 0.0008, maxA = N * 0.4; let L = 0;
  for (let s = 0; s < N; s++) { if (!bin[s] || lab[s]) continue; L++; let sp = 0, n = 0; stack[sp++] = s; lab[s] = L; const pts = [];
    while (sp) { const q = stack[--sp]; n++; if (n % 2 === 0 || n < 400) pts.push(q); const x = q % W, y = (q - x) / W;
      if (x > 0 && bin[q - 1] && !lab[q - 1]) { lab[q - 1] = L; stack[sp++] = q - 1; } if (x < W - 1 && bin[q + 1] && !lab[q + 1]) { lab[q + 1] = L; stack[sp++] = q + 1; }
      if (y > 0 && bin[q - W] && !lab[q - W]) { lab[q - W] = L; stack[sp++] = q - W; } if (y < H - 1 && bin[q + W] && !lab[q + W]) { lab[q + W] = L; stack[sp++] = q + W; } }
    if (n < minA || n > maxA) continue; const q = quad(pts, W); if (!q) continue; const hit = read(bin, W, H, q); if (hit && !found.has(hit.id)) found.set(hit.id, hit); }
  return [...found.values()]; }
/* the four corners of a blob: farthest point, the point farthest from it, then the farthest on each side of that diagonal */
function quad(pts, W) { let cx = 0, cy = 0; const P = pts.map(q => { const x = q % W, y = (q - x) / W; cx += x; cy += y; return [x, y]; }); cx /= P.length; cy /= P.length;
  const far = (from, f) => { let b = null, bd = -1; for (const p of P) { const v = f(p, from); if (v > bd) { bd = v; b = p; } } return [b, bd]; };
  const d2 = (p, q) => (p[0] - q[0]) ** 2 + (p[1] - q[1]) ** 2, [a] = far([cx, cy], d2), [b] = far(a, d2);
  const side = p => (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]); const [c, cd] = far(null, p => side(p)), [e, ed] = far(null, p => -side(p));
  if (!c || !e || cd <= 0 || ed <= 0) return null; const Q = [a, c, b, e].sort((p, q) => Math.atan2(p[1] - cy, p[0] - cx) - Math.atan2(q[1] - cy, q[0] - cx));
  const len = Q.map((p, i) => Math.sqrt(d2(p, Q[(i + 1) % 4]))), mn = Math.min(...len), mx = Math.max(...len); if (mn < 14 || mx / mn > 2.6) return null;
  return Q; }
/* unit square → the corners (a projective map), so tilted cards read correctly */
function homog(Q) { const [[x0, y0], [x1, y1], [x2, y2], [x3, y3]] = Q, dx1 = x1 - x2, dx2 = x3 - x2, dy1 = y1 - y2, dy2 = y3 - y2, sx = x0 - x1 + x2 - x3, sy = y0 - y1 + y2 - y3, den = dx1 * dy2 - dx2 * dy1;
  const g = (sx * dy2 - dx2 * sy) / den, h = (dx1 * sy - sx * dy1) / den, a = x1 - x0 + g * x1, b = x3 - x0 + h * x3, d = y1 - y0 + g * y1, e = y3 - y0 + h * y3;
  return (u, v) => { const w = g * u + h * v + 1; return [(a * u + b * v + x0) / w, (d * u + e * v + y0) / w]; }; }
function read(bin, W, H, Q) { const map = homog(Q), M = []; let bad = 0;
  for (let i = 0; i < 7; i++) { M.push([]); for (let j = 0; j < 7; j++) { let on = 0, n = 0; for (const di of [-0.22, 0, 0.22]) for (const dj of [-0.22, 0, 0.22]) { const [x, y] = map((j + 0.5 + dj) / 7, (i + 0.5 + di) / 7), xi = Math.round(x), yi = Math.round(y); if (xi < 0 || yi < 0 || xi >= W || yi >= H) return null; on += bin[yi * W + xi]; n++; }
    const v = on / n > 0.5; M[i].push(v); if ((i === 0 || j === 0 || i === 6 || j === 6) && !v) bad++; } }
  if (bad > 3) return null; let bits = 0; for (let i = 1; i < 6; i++) for (let j = 1; j < 6; j++) if (M[i][j]) bits |= 1 << (24 - ((i - 1) * 5 + (j - 1)));
  let best = null, bd = 3; CODES.forEach((R, id) => R.forEach((c, r) => { const dd = pop(c ^ bits); if (dd < bd) { bd = dd; best = { id, r }; } })); if (!best) return null;
  /* which side of the card points up in the picture: the letter printed on that side is the answer */
  const mid = [[0.5, 0], [1, 0.5], [0.5, 1], [0, 0.5]].map(([u, v]) => map(u, v)), c = map(0.5, 0.5);
  let up = 0, uy = Infinity; for (let k = 0; k < 4; k++) { const s = mid[(best.r + k) % 4], vy = (s[1] - c[1]) / Math.hypot(s[0] - c[0], s[1] - c[1]); if (vy < uy) { uy = vy; up = k; } }
  return { id: best.id, ans: up, quad: Q }; }

/* ---------- printing the cards (2 per A4 page) ---------- */
function drawCard(g, x, y, u, id, name) { g.fillStyle = '#000'; for (let i = 0; i < 7; i++) for (let j = 0; j < 7; j++) if (cellOn(id, i, j)) g.fillRect(x + j * u, y + i * u, u + 0.5, u + 0.5);
  g.font = '700 ' + Math.round(u * 0.9) + 'px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  [[x + 3.5 * u, y - 0.8 * u, 0], [x + 7.8 * u, y + 3.5 * u, Math.PI / 2], [x + 3.5 * u, y + 7.8 * u, Math.PI], [x - 0.8 * u, y + 3.5 * u, -Math.PI / 2]].forEach(([tx, ty, a], k) => { g.save(); g.translate(tx, ty); g.rotate(a); g.fillText(LET[k], 0, 0); g.restore(); });
  g.font = '600 ' + Math.round(u * 0.4) + 'px sans-serif'; g.textAlign = 'left'; g.fillText((id + 1) + (name ? ' · ' + name : ''), x - 1.4 * u, y - 1.4 * u); }
async function printCards() { const names = roster(), n = Math.max(names.length, set.get('cardCount', 30)); let jsp; try { jsp = await need('jspdf'); } catch (e) { toast(e.message); return; }
  const { jsPDF } = jsp, pdf = new jsPDF({ unit: 'mm', format: 'a4' }), u = 11;
  for (let k = 0; k < Math.min(n, MAX); k++) { if (k && k % 2 === 0) pdf.addPage(); const oy = (k % 2) * 148.5, x = (210 - 7 * u) / 2, y = oy + (148.5 - 7 * u) / 2 + 2;
    for (let i = 0; i < 7; i++) for (let j = 0; j < 7; j++) if (cellOn(k, i, j)) pdf.rect(x + j * u, y + i * u, u + 0.05, u + 0.05, 'F');
    pdf.setFontSize(22); pdf.text('A', x + 3.5 * u, y - 5, { align: 'center' }); pdf.text('B', x + 7 * u + 7, y + 3.5 * u, { angle: -90 }); pdf.text('C', x + 3.5 * u, y + 7 * u + 10, { align: 'center', angle: 180 }); pdf.text('D', x - 7, y + 3.5 * u, { angle: 90 });
    pdf.setFontSize(11); pdf.text('Card ' + (k + 1) + (names[k] ? ' · ' + names[k] : ''), 14, oy + 12); pdf.setFontSize(8); pdf.setTextColor(120); pdf.text('Turn the card so your answer is at the top, then hold it up — HelixBoard', 14, oy + 141); pdf.setTextColor(0);
    if (k % 2 === 0) { pdf.setDrawColor(200); pdf.setLineDashPattern([2, 2], 0); pdf.line(0, 148.5, 210, 148.5); pdf.setLineDashPattern([], 0); } }
  const blob = pdf.output('blob'), a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'HelixBoard answer cards' + (window.HBX && HBX.cur() ? ' - ' + HBX.cur() : '') + '.pdf'; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  toast('Saved the answer cards as a PDF — print one card per student (2 per page).'); snd('done'); }

/* ---------- the scanner ---------- */
const css = document.createElement('style'); css.textContent = `
#pcScan{position:fixed;inset:0;z-index:80;background:#0b0710;color:#fff;display:grid;grid-template-columns:minmax(0,1fr) 340px;font-family:var(--ui)}
#pcScan .cam{position:relative;display:flex;align-items:center;justify-content:center;overflow:hidden;background:#000}
#pcScan video,#pcScan canvas.ov{position:absolute;max-width:100%;max-height:100%}
#pcScan .side{display:flex;flex-direction:column;gap:10px;padding:16px;background:#160f1c;border-left:1px solid #2c2033;overflow:auto}
#pcScan h2{margin:0;font:800 20px var(--head)}#pcScan .q{font:600 15px var(--ui);color:#d9c9d6}
#pcScan .big{font:800 44px var(--mono)}#pcScan .bars div{display:grid;grid-template-columns:28px 1fr 50px;align-items:center;gap:8px;margin:4px 0;font-weight:800}
#pcScan .bars i{display:block;height:18px;border-radius:9px}#pcScan .names{display:flex;flex-wrap:wrap;gap:4px}#pcScan .names span{padding:2px 8px;border-radius:999px;font-size:12px;background:#2a1f30}
#pcScan .names span.ok{background:#1f5133}#pcScan .row{display:flex;gap:6px;flex-wrap:wrap}
#pcScan .hint{position:absolute;left:16px;top:16px;padding:8px 12px;border-radius:12px;background:rgba(0,0,0,.6);font-weight:700}
`; document.head.appendChild(css);
/* opts: { title, options (labels for A–D), correct, onDone(Map card → answer index) } */
async function scan(opts) { opts = opts || {}; const res = new Map(); let stream = null, raf = 0, hideNames = false, reveal = false;
  const el = document.createElement('div'); el.id = 'pcScan'; el.innerHTML = '<div class="cam"><video playsinline muted></video><canvas class="ov"></canvas><div class="hint">Students hold up their cards — move the camera slowly across the room</div></div><div class="side"><h2>' + icon('scan-line') + ' Scanning cards</h2><div class="q">' + esc(opts.title || 'Quick check — A, B, C or D') + '</div><div><span class="big" id="pcN">0</span> <span id="pcOf"></span></div><div class="bars" id="pcBars"></div><div class="small" style="color:#b9a5b6">Answered</div><div class="names" id="pcNames"></div><div class="row" style="margin-top:auto"><button class="btn sm" id="pcHide">Hide names</button><button class="btn sm" id="pcRev"' + (Number.isInteger(opts.correct) ? '' : ' hidden') + '>Reveal answer</button><button class="btn sm" id="pcClear">Start again</button><button class="btn sm primary" id="pcDone">Done</button></div></div>';
  document.body.appendChild(el); const v = el.querySelector('video'), ov = el.querySelector('canvas'), g = ov.getContext('2d'), work = document.createElement('canvas'), wg = work.getContext('2d', { willReadFrequently: true });
  const n = roster().length; el.querySelector('#pcOf').textContent = n ? 'of ' + n : 'cards';
  const render = () => { const counts = [0, 0, 0, 0]; res.forEach(a => counts[a]++); const tot = res.size || 1; el.querySelector('#pcN').textContent = res.size;
    el.querySelector('#pcBars').innerHTML = LET.split('').map((L, k) => '<div><span style="color:' + COL[k] + '">' + L + (reveal && opts.correct === k ? ' ✓' : '') + '</span><i style="width:' + (counts[k] / tot * 100) + '%;background:' + COL[k] + '"></i><span>' + counts[k] + '</span></div>').join('') + (opts.options ? '<div class="small" style="color:#b9a5b6;display:block">' + opts.options.slice(0, 4).map((o, k) => LET[k] + ') ' + esc(o)).join('<br>') + '</div>' : '');
    el.querySelector('#pcNames').innerHTML = [...res.entries()].sort((a, b) => a[0] - b[0]).map(([id, a]) => '<span class="' + (reveal && opts.correct === a ? 'ok' : '') + '">' + (hideNames ? '#' + (id + 1) : esc(nameOf(id))) + (reveal || hideNames ? '' : '') + '</span>').join(''); };
  const stop = () => { cancelAnimationFrame(raf); if (stream) stream.getTracks().forEach(t => t.stop()); el.remove(); };
  el.querySelector('#pcHide').onclick = e => { hideNames = !hideNames; e.target.textContent = hideNames ? 'Show names' : 'Hide names'; render(); };
  el.querySelector('#pcRev').onclick = () => { reveal = !reveal; render(); if (reveal) snd('good'); };
  el.querySelector('#pcClear').onclick = () => { res.clear(); render(); };
  el.querySelector('#pcDone').onclick = () => { stop(); opts.onDone && opts.onDone(new Map(res)); };
  el.addEventListener('keydown', e => { if (e.key === 'Escape') el.querySelector('#pcDone').click(); }); render();
  try { stream = await navigator.mediaDevices.getUserMedia({ video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'environment' }, audio: false }); } catch (e) { toast('The camera could not start: ' + esc(e.message || e.name) + '. Connect a webcam (or a phone camera app) and try again.', 6000); return; }
  v.srcObject = stream; await v.play().catch(() => {});
  let last = 0; const loop = t => { raf = requestAnimationFrame(loop); if (!v.videoWidth || t - last < 110) return; last = t;
    const k = Math.min(1, 800 / v.videoWidth), W = Math.round(v.videoWidth * k), H = Math.round(v.videoHeight * k); if (work.width !== W) { work.width = W; work.height = H; }
    wg.drawImage(v, 0, 0, W, H); const hits = detect(wg.getImageData(0, 0, W, H)), box = v.getBoundingClientRect(), cam = el.querySelector('.cam').getBoundingClientRect();
    ov.width = box.width; ov.height = box.height; ov.style.left = (box.left - cam.left) + 'px'; ov.style.top = (box.top - cam.top) + 'px'; g.clearRect(0, 0, ov.width, ov.height); const sx = box.width / W, sy = box.height / H;
    let changed = false; hits.forEach(h => { if (n && h.id >= n) return; if (res.get(h.id) !== h.ans) { res.set(h.id, h.ans); changed = true; }
      g.strokeStyle = COL[h.ans]; g.lineWidth = 4; g.beginPath(); h.quad.forEach(([x, y], i) => i ? g.lineTo(x * sx, y * sy) : g.moveTo(x * sx, y * sy)); g.closePath(); g.stroke();
      const cx = h.quad.reduce((a, p) => a + p[0], 0) / 4 * sx, cy = h.quad.reduce((a, p) => a + p[1], 0) / 4 * sy; g.fillStyle = 'rgba(0,0,0,.65)'; g.fillRect(cx - 50, cy - 16, 100, 32); g.fillStyle = '#fff'; g.font = '800 16px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(LET[h.ans] + ' · ' + (hideNames ? '#' + (h.id + 1) : nameOf(h.id)).slice(0, 12), cx, cy); });
    if (changed) { snd('pop'); render(); } };
  raf = requestAnimationFrame(loop); }

/* ---------- the roster and the menu ---------- */
function editRoster() { const cls = window.HBX ? HBX.cur() : '';
  modal.open('<h2>' + icon('users-round') + ' Card owners' + (cls ? ' · ' + esc(cls) : '') + '</h2><p class="muted" style="margin-top:-4px">One name per line — line 1 gets card 1, line 2 card 2… (up to ' + MAX + '). Keep the same cards all year.</p><textarea id="pcR" class="inp" style="width:100%;height:240px;padding:10px">' + esc(roster().join('\n')) + '</textarea><div class="foot"><button class="btn" data-close>Cancel</button><button class="btn" id="pcFill">' + icon('users-round') + 'Names from Class XP</button><button class="btn primary" id="pcSave">Save</button></div>', s => {
    s.querySelector('#pcSave').onclick = () => { const L = s.querySelector('#pcR').value.split('\n').map(x => x.trim()).filter(Boolean).slice(0, MAX); set.put(rkey(), L); set.put('cardCount', Math.max(L.length, 1)); modal.close(); toast('Saved ' + L.length + ' card owners.'); };
    s.querySelector('#pcFill').onclick = async () => { if (!window.HBX) return; const { people } = await HBX.compute(HBX.cur()); const ta = s.querySelector('#pcR'), have = new Set(ta.value.split('\n').map(x => x.trim().toLowerCase()).filter(Boolean)); const add = people.map(p => p.name).filter(n => !have.has(n.toLowerCase())).sort((a, b) => a.localeCompare(b)); ta.value = (ta.value.trim() ? ta.value.trim() + '\n' : '') + add.join('\n'); }; }); }
function menu() { const n = roster().length;
  modal.open('<h2>' + icon('scan-line') + ' Paper answer cards</h2><p>No phones needed: each student holds up a printed card turned to their answer — A, B, C or D at the top — and your webcam reads the whole class at once (like Plickers).</p><div class="small muted" style="margin-bottom:10px">' + (n ? n + ' card owners saved' : 'No names yet — cards will show numbers') + (window.HBX && HBX.cur() ? ' for ' + esc(HBX.cur()) : '') + '.</div>' +
    '<div class="row" style="gap:8px;flex-wrap:wrap"><button class="btn" id="pcRo">' + icon('users-round') + 'Card owners</button><button class="btn" id="pcPr">' + icon('printer') + 'Print cards (PDF)</button><button class="btn primary" id="pcSc">' + icon('scan-line') + 'Quick scan A B C D</button></div><p class="small muted" style="margin-top:12px">To scan a quiz question by question, open <b>Live quiz</b> (Study → Quiz sets → Present) and press <b>Scan cards</b>.</p><div class="foot"><button class="btn" data-close>Close</button></div>', s => {
    s.querySelector('#pcRo').onclick = () => { modal.close(); setTimeout(editRoster, 30); }; s.querySelector('#pcPr').onclick = () => { modal.close(); printCards(); };
    s.querySelector('#pcSc').onclick = () => { modal.close(); scan({ title: 'Quick check — A, B, C or D', onDone: m => { if (m.size) toast('Scanned ' + m.size + ' card' + (m.size === 1 ? '' : 's') + '.'); } }); }; }); }

window.HBPC = { menu, scan, printCards, editRoster, detect, drawCard, nameOf, roster, MAX, CODES };
})();
