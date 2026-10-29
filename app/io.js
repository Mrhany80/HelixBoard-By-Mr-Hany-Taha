/* ================= HelixBoard — files, import, export, versions, replay, recording ================= */
(() => {
'use strict';
const { $, $$, clamp, esc, set, IDB, bus, toast, modal, SND, floatPanel, need, needESM, CDN, REDUCE } = window.HB;
const E = window.HBE, I = window.HBI, B = E.B;
const libURL = p => CDN + (window.HB_STRIPV ? p.replace(/@[\d.]+/, '') : p);
const PDFJS = 'pdfjs-dist@6.4.299/build/';
const stamp = () => { const d = new Date(), z = n => String(n).padStart(2, '0'); return d.getFullYear() + '-' + z(d.getMonth() + 1) + '-' + z(d.getDate()) + '_' + z(d.getHours()) + z(d.getMinutes()); };
const safeName = () => (B.title || 'HelixBoard').replace(/[\\/:*?"<>|]+/g, '').trim().slice(0, 60) || 'HelixBoard';
function download(blob, name) { name = String(name).replace(/[\u2010-\u2015]/g, '-').replace(/[\u2018\u2019]/g, "'").replace(/[\u201C\u201D]/g, ''); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 4000); }
function pick(accept, multiple) { return new Promise(res => { const inp = document.createElement('input'); inp.type = 'file'; inp.accept = accept; inp.multiple = !!multiple; inp.style.display = 'none'; inp.onchange = () => { res([...inp.files]); inp.remove(); }; document.body.appendChild(inp); inp.click(); }); }
const refreshUI = () => { window.HBUI && HBUI.refresh(); };

/* ---------- images ---------- */
async function pickImage() { const fs = await pick('image/*', true); fs.forEach((f, i) => setTimeout(() => I.readImage(f), i * 120)); }

/* ---------- document camera ---------- */
let camStream = null, camFacing = set.get('camFacing', 'environment');
async function camera() {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) { toast('This browser cannot use a camera here. Open HelixBoard over https or from a local file.'); return; }
  const f = floatPanel('camera', 'Document camera', '<div style="position:relative;background:#000;border-radius:10px;overflow:hidden;aspect-ratio:4/3"><video id="camV" playsinline muted autoplay style="width:100%;height:100%;object-fit:contain"></video><div id="camFlash" style="position:absolute;inset:0;background:#fff;opacity:0;pointer-events:none"></div></div><div class="row" style="gap:6px;margin-top:8px;flex-wrap:wrap"><button class="btn primary" id="camShot">' + window.HB.icon('camera') + ' Capture to board</button><button class="btn sm" id="camFlip">Switch camera</button><label class="small"><input type="checkbox" id="camMirror"> Mirror</label><label class="small"><input type="checkbox" id="camBg"> Place behind ink</label></div><p class="small muted" style="margin:6px 0 0">Point the camera at a worksheet, a specimen or a student\'s book. Each capture lands on the board as an image you can draw over.</p>', { icon: 'camera', w: 440, onClose: stopCam });
  const v = $('#camV', f.el);
  const start = async () => { stopCam(); try { camStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: camFacing, width: { ideal: 1920 }, height: { ideal: 1080 } }, audio: false }); v.srcObject = camStream; await v.play().catch(() => {}); } catch (e) { toast('Camera not available: ' + (e.name === 'NotAllowedError' ? 'permission was refused.' : e.message)); } };
  $('#camFlip', f.el).onclick = () => { camFacing = camFacing === 'environment' ? 'user' : 'environment'; set.put('camFacing', camFacing); start(); };
  $('#camMirror', f.el).onchange = e => { v.style.transform = e.target.checked ? 'scaleX(-1)' : ''; };
  $('#camShot', f.el).onclick = () => { if (!v.videoWidth) { toast('Waiting for the camera…'); return; } const c = document.createElement('canvas'); c.width = v.videoWidth; c.height = v.videoHeight; const g = c.getContext('2d'); if ($('#camMirror', f.el).checked) { g.translate(c.width, 0); g.scale(-1, 1); } g.drawImage(v, 0, 0); const src = c.toDataURL('image/jpeg', 0.88);
    SND.burst(0.08, 0.25, 2500, 1); SND.tone(1200, 600, 0.06, 'square', 0.04); if (window.gsap && !REDUCE) gsap.fromTo($('#camFlash', f.el), { opacity: 0.9 }, { opacity: 0, duration: 0.4 });
    if ($('#camBg', f.el).checked) placeAsset(src, c.width, c.height, 0); else I.insertImage(src); };
  start(); }
function stopCam() { if (camStream) { camStream.getTracks().forEach(t => t.stop()); camStream = null; } }
/* put an image on a given layer, fitted to the visible area */
function placeAsset(src, w, h, layer) { const id = 'a' + window.HB.uid(); B.assets[id] = src; const vr = E.viewRect(); const max = Math.min(vr[2] * 0.8, B.mode === 'scroll' ? B.width - 80 : 1600); if (w > max) { h *= max / w; w = max; } I.insertObj({ t: 'img', asset: id, w, h, x: vr[0] + (vr[2] - w) / 2, y: vr[1] + 40 }, { layer, noSelect: layer === 0 }); }

/* ---------- PDF pages → board pages ---------- */
let pdfLib = null;
/* pdf.js 6 uses Map.getOrInsertComputed (2026 JavaScript); older browsers get a tiny polyfill, in the page and in the worker */
const POLY = "for (const C of [Map, WeakMap]) { const P = C.prototype; if (!P.getOrInsert) P.getOrInsert = function (k, v) { if (!this.has(k)) this.set(k, v); return this.get(k); }; if (!P.getOrInsertComputed) P.getOrInsertComputed = function (k, f) { if (!this.has(k)) this.set(k, f(k)); return this.get(k); }; }";
async function loadPdf() { if (pdfLib) return pdfLib; (0, eval)(POLY); const eM = document.getElementById('hblib-pdfjs'), eW = document.getElementById('hblib-pdfworker'); if (eM && eW) { const blob = t => URL.createObjectURL(new Blob([t], { type: 'text/javascript' })); const m = await import(blob(eM.textContent)); m.GlobalWorkerOptions.workerSrc = blob(POLY + ';\n' + eW.textContent); /* opened straight from disk (file://) Chrome refuses module workers from blob: URLs and pdf.js falls back to the slow main thread — run the worker as a classic script instead */ if (location.protocol === 'file:') { try { m.GlobalWorkerOptions.workerPort = new Worker(blob(POLY + ';\n' + eW.textContent.replace(/export\s*\{\s*WorkerMessageHandler\s*\};?/, 'globalThis.pdfjsWorker = { WorkerMessageHandler };').replace(/import\.meta\.url/g, 'self.location.href'))); } catch (e) { console.warn(e); } } return pdfLib = m; } const m = await needESM(PDFJS + 'pdf.min.mjs'); const wurl = new URL(libURL(PDFJS + 'pdf.worker.min.mjs'), location.href).href; m.GlobalWorkerOptions.workerSrc = URL.createObjectURL(new Blob([POLY + ';\nawait import(' + JSON.stringify(wurl) + ');'], { type: 'text/javascript' })); return pdfLib = m; }
async function pickPdf() { const fs = await pick('application/pdf'); if (fs[0]) importPdf(fs[0]); }
const parseRange = (s, n) => { const out = new Set(); String(s || '').split(/[,،\s]+/).filter(Boolean).forEach(part => { const m = part.match(/^(\d+)(?:[-–](\d+))?$/); if (!m) return; let a = +m[1], b = m[2] ? +m[2] : a; if (a > b) [a, b] = [b, a]; for (let i = Math.max(1, a); i <= Math.min(n, b); i++) out.add(i); }); return [...out].sort((a, b) => a - b); };
async function importPdf(file) {
  let lib; toast('Opening ' + file.name + '…');
  try { lib = await loadPdf(); } catch (e) { toast('Could not load the PDF reader — check the internet connection.'); console.warn(e); return; }
  let doc; try { doc = await lib.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise; } catch (e) { toast('That PDF could not be opened (' + e.message + ').'); return; }
  const n = doc.numPages;
  modal.open('<h2>Import PDF pages</h2><p><b>' + esc(file.name) + '</b> has ' + n + ' page' + (n > 1 ? 's' : '') + '. Each PDF page becomes a new board page, placed on the locked background layer so your ink never moves it.</p><label>Pages <input id="pdfR" class="inp" value="' + (n <= 20 ? '1-' + n : '1-20') + '" style="width:160px"></label> <span class="small muted">e.g. 1-5, 8, 10-12</span><div class="row" style="gap:14px;flex-wrap:wrap;margin:10px 0"><label><input type="radio" name="pdfM" value="pic" checked> <b>Original look</b> — pages as pictures, write on top</label><label><input type="radio" name="pdfM" value="txt"> <b>Editable text</b> — rebuild the words as text boxes you can change</label></div><p class="small muted">Large PDFs: about 20 pages at a time keeps the board fast. Editable text works best for typed PDFs; scanned pages have no text to rebuild.</p><div class="foot"><button class="btn primary" id="pdfGo">Import</button></div>', s => { $('#pdfGo', s).onclick = () => { const pages = parseRange($('#pdfR', s).value, n), mode = $('input[name=pdfM]:checked', s).value; modal.close(); if (!pages.length) { toast('No valid pages chosen.'); return; } if (mode === 'txt') pdfEditable(doc, pages, file.name); else renderPdf(doc, pages, file.name); }; }); }
async function renderPdf(doc, pages, name) { const out = [];
  for (let k = 0; k < pages.length; k++) { toast('Reading page ' + pages[k] + ' (' + (k + 1) + ' of ' + pages.length + ')…');
    try { const pg = await doc.getPage(pages[k]); const vp0 = pg.getViewport({ scale: 1 }); const sc = Math.min(3, 1800 / vp0.width); const vp = pg.getViewport({ scale: sc });
      const c = document.createElement('canvas'); c.width = Math.round(vp.width); c.height = Math.round(vp.height); const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height);
      await pg.render({ canvasContext: g, canvas: c, viewport: vp }).promise; const id = 'a' + window.HB.uid(); B.assets[id] = c.toDataURL('image/jpeg', 0.86); out.push({ asset: id, w: c.width, h: c.height }); pg.cleanup && pg.cleanup();
    } catch (e) { console.warn(e); toast('Page ' + pages[k] + ' failed: ' + e.message); } }
  if (out.length) { window.HBA && HBA.log('import', { type: 'pdf', pages: out.length }); window.HBD.create(name, out); toast('Opened ' + out.length + ' page' + (out.length > 1 ? 's' : '') + ' of ' + name + ' in one tab — use the slide panel, arrows or F5 for the slideshow.'); } }
bus.on('import-pdf', f => importPdf(f));

/* ---------- Documents: open PDF / Word / text, write and edit on them, save and export ---------- */
const uidH = () => window.HB.uid();
const pageW = () => B.mode === 'scroll' ? B.width : 1920;
const fitH = (np, y) => { np.H = Math.max(1080 * 2, Math.ceil((y + 240) / 1080) * 1080); };
async function openDocument() { const fs = await pick('.pdf,.docx,.pptx,.txt,.md,application/vnd.openxmlformats-officedocument.presentationml.presentation,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain'); if (fs[0]) openDoc(fs[0]); }
function openDoc(file) { const ext = (file.name.split('.').pop() || '').toLowerCase();
  if (ext === 'pdf' || file.type === 'application/pdf') return importPdf(file);
  if (ext === 'docx') return importDocx(file);
  if (ext === 'pptx') return importPptx(file);
  if (ext === 'ppt') { toast('Old .ppt files cannot be read in the browser — open it in PowerPoint and “Save as” .pptx, then try again.'); return; }
  if (ext === 'doc') { toast('Old .doc files cannot be read in the browser — open it in Word and “Save as” .docx, then try again.'); return; }
  if (ext === 'txt' || ext === 'md' || file.type.startsWith('text/')) return file.text().then(t => buildEditable(blocksFromText(t), file.name));
  toast('HelixBoard opens PDF, Word (.docx), PowerPoint (.pptx) and text files.'); }
bus.on('open-doc', f => openDoc(f));

/* blocks are the common shape both Word and text become: {k:'h1'..'h6'|'p'|'li'|'img'|'table'|'gap', s, b, i, n, depth, src, html} */
function blocksFromText(t) { return t.replace(/\r/g, '').split(/\n{2,}/).map(par => { const m = par.match(/^(#{1,6})\s+(.*)/s); return m ? { k: 'h' + m[1].length, s: m[2].trim() } : par.trim() ? { k: 'p', s: par.trim() } : { k: 'gap' }; }); }
function blocksFromHtml(html) { const d = new DOMParser().parseFromString('<body>' + html + '</body>', 'text/html'), out = [];
  const txt = el => el.textContent.replace(/\s+/g, ' ').trim();
  const allBold = el => { const t = txt(el); if (!t) return false; let b = ''; el.querySelectorAll('strong,b').forEach(x => b += x.textContent); return b.replace(/\s+/g, ' ').trim().length >= t.length * 0.9; };
  const walk = (el, depth) => { [...el.children].forEach(c => { const tag = c.tagName.toLowerCase();
    if (/^h[1-6]$/.test(tag)) out.push({ k: tag, s: txt(c) });
    else if (tag === 'p') { c.querySelectorAll('img').forEach(im => out.push({ k: 'img', src: im.src })); const s = txt(c); out.push(s ? { k: 'p', s, b: allBold(c) } : { k: 'gap' }); }
    else if (tag === 'ul' || tag === 'ol') { let n = 0; [...c.children].forEach(li => { if (li.tagName !== 'LI') return; n++; const own = li.cloneNode(true); own.querySelectorAll('ul,ol').forEach(x => x.remove()); out.push({ k: 'li', s: txt(own), n: tag === 'ol' ? n : 0, depth }); li.querySelectorAll(':scope > ul, :scope > ol').forEach(sub => walk({ children: [sub] }, depth + 1)); }); }
    else if (tag === 'table') out.push({ k: 'table', html: c.outerHTML });
    else if (tag === 'img') out.push({ k: 'img', src: c.src });
    else walk(c, depth); }); };
  walk(d.body, 0); return out; }

async function importDocx(file) { let mm; toast('Opening ' + file.name + '…');
  try { mm = await need('mammoth'); } catch (e) { toast(e.message); return; }
  let html; try { html = (await mm.convertToHtml({ arrayBuffer: await file.arrayBuffer() }, { styleMap: ["p[style-name='Title'] => h1:fresh", "p[style-name='Subtitle'] => h2:fresh"] })).value.replace(/<(p|li|h[1-6]|td|th)(?=[\s>])/g, '<$1 dir="auto"'); } catch (e) { toast('That Word file could not be read (' + e.message + ').'); return; }
  if (!html.trim()) { toast('That Word file looks empty.'); return; }
  modal.open('<h2>Open Word document</h2><p><b>' + esc(file.name) + '</b></p><div class="docopt"><button class="btn primary" id="dxEd">' + window.HB.icon('file-pen-line') + ' Editable text</button><span class="small muted">Every heading, paragraph and bullet becomes a text box. Double-click any of them to change the words; drag to move. Tables and pictures come in as images.</span></div><div class="docopt"><button class="btn" id="dxPic">' + window.HB.icon('file-type') + ' Original look</button><span class="small muted">A4 pages as pictures on the locked background layer — best for worksheets. Write, highlight and add text boxes on top.</span></div>', s => {
    $('#dxEd', s).onclick = () => { modal.close(); buildEditable(blocksFromHtml(html), file.name); };
    $('#dxPic', s).onclick = () => { modal.close(); docxPictures(html, file.name); }; }); }

/* Word/text → editable text boxes on one new board page */
async function buildEditable(blocks, name) { if (!blocks.length) { toast('Nothing to import.'); return; }
  const W = pageW(), mx = 90, cw = W - mx * 2, np = E.newPage(E.page().theme); np.name = name.replace(/\.[^.]+$/, '').slice(0, 40); let y = 96;
  const SZ = { h1: 58, h2: 46, h3: 38, h4: 32, h5: 30, h6: 28 }; const ink = E.isDark(np) ? '#F4EEF2' : '#1E1419';
  const text = (s, o) => { const rtl = window.HB.isRTL(s); const t = Object.assign({ id: uidH(), ts: Date.now(), t: 'text', x: mx, y, w: cw, s, font: rtl ? 'Tajawal' : 'Lexend', size: 28, c: ink, layer: 1, doc: name }, o); window.HB.loadFont(t.font); np.objs.push(t); y += E.textLayout(t).h; return t; };
  for (const bl of blocks) {
    if (bl.k === 'gap') { y += 16; continue; }
    if (SZ[bl.k]) { y += bl.k === 'h1' ? 18 : 12; text(bl.s, { size: SZ[bl.k], b: true, c: bl.k === 'h1' ? (E.isDark(np) ? '#FFC9DE' : '#8E1F4F') : ink }); y += 14; continue; }
    if (bl.k === 'p') { text(bl.s, { b: !!bl.b }); y += 16; continue; }
    if (bl.k === 'li') { const ind = 34 + (bl.depth || 0) * 40, rtl = window.HB.isRTL(bl.s); const t = text((bl.n ? bl.n + '. ' : '• ') + bl.s, { x: rtl ? mx : mx + ind, w: cw - ind }); y += 8; continue; }
    if (bl.k === 'img' || bl.k === 'table') { try { const im = bl.k === 'img' ? await loadImg(bl.src) : await htmlToCanvas(bl.html, Math.round(cw / 1.8)); const src = bl.k === 'img' ? bl.src : im.toDataURL('image/png'); const nw = im.naturalWidth || im.width, nh = im.naturalHeight || im.height; let w = bl.k === 'img' ? Math.min(cw, nw) : cw, h = w * nh / nw; const id = 'a' + uidH(); B.assets[id] = src; np.objs.push({ id: uidH(), ts: Date.now(), t: 'img', asset: id, x: mx, y, w, h, layer: 1, doc: name }); y += h + 20; } catch (e) { console.warn(e); } } }
  fitH(np, y); B.pages.splice(B.cur + 1, 0, np); window.HBUI && HBUI.goPage(B.cur + 1); E.changed(); SND.page();
  toast('Opened ' + name + ' as editable text — double-click any paragraph to change it.'); }
const loadImg = src => new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = rej; im.src = src; });

/* HTML → picture, through an SVG foreignObject (no extra library, works offline once the document is read) */
const DOC_CSS = 'font-family:Calibri,Carlito,"Segoe UI",Tahoma,Arial,sans-serif;font-size:15px;line-height:1.5;color:#111;background:#fff;';
const INNER_CSS = 'h1{font-size:28px;margin:.4em 0}h2{font-size:22px;margin:.5em 0}h3{font-size:18px;margin:.5em 0}p{margin:0 0 .6em}img{max-width:100%;height:auto}table{border-collapse:collapse;width:100%;margin:.4em 0}td,th{border:1px solid #888;padding:4px 7px;vertical-align:top}ul,ol{margin:.2em 0 .7em;padding-inline-start:1.6em}';
function xhtml(el) { return new XMLSerializer().serializeToString(el); }
async function svgToCanvas(inner, w, h, scale) { const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="' + w + '" height="' + h + '"><foreignObject x="0" y="0" width="100%" height="100%">' + inner + '</foreignObject></svg>';
  const im = await loadImg('data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg)); const c = document.createElement('canvas'); c.width = Math.ceil(w * scale); c.height = Math.ceil(h * scale); const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); g.scale(scale, scale); g.drawImage(im, 0, 0); return c; }
function stageDiv(w) { const box = document.createElement('div'); box.style.cssText = 'position:fixed;left:-20000px;top:0;width:' + w + 'px;' + DOC_CSS; box.setAttribute('dir', 'auto'); const st = document.createElement('style'); st.textContent = INNER_CSS.replace(/(^|\})([^{]+)\{/g, (m, a, sel) => a + sel.split(',').map(x => '.hbdoc ' + x).join(',') + '{'); box.className = 'hbdoc'; document.body.append(st, box); return { box, done: () => { box.remove(); st.remove(); } }; }
async function htmlToCanvas(html, w) { const { box, done } = stageDiv(w); box.innerHTML = html; await Promise.all([...box.querySelectorAll('img')].map(im => im.complete ? 0 : new Promise(r => { im.onload = im.onerror = r; }))); const h = Math.ceil(box.scrollHeight) + 4;
  const wrap = document.createElement('div'); wrap.setAttribute('xmlns', 'http://www.w3.org/1999/xhtml'); wrap.style.cssText = 'width:' + w + 'px;' + DOC_CSS; wrap.innerHTML = '<style>' + INNER_CSS + '</style>' + html; done(); return svgToCanvas(xhtml(wrap), w, h, 2); }

/* Word → A4 pages as pictures. Pages break between paragraphs, never through a line. */
async function docxPictures(html, name) { const A4W = 794, A4H = 1123, PAD = 64, room = A4H - PAD * 2; toast('Laying out ' + name + '…');
  const { box, done } = stageDiv(A4W - PAD * 2); box.innerHTML = html; await Promise.all([...box.querySelectorAll('img')].map(im => im.complete ? 0 : new Promise(r => { im.onload = im.onerror = r; })));
  const kids = [...box.children], groups = []; let cur = [], top = 0;
  kids.forEach(k => { const r0 = k.offsetTop, r1 = r0 + k.offsetHeight; if (cur.length && r1 - top > room) { groups.push(cur); cur = []; top = r0; } if (!cur.length) top = r0; cur.push(k.outerHTML); });
  if (cur.length) groups.push(cur); done();
  const theme = E.page().theme, W = pageW(); let k = 0;
  for (const gr of groups) { toast('Page ' + (k + 1) + ' of ' + groups.length + '…');
    const inner = document.createElement('div'); inner.setAttribute('xmlns', 'http://www.w3.org/1999/xhtml'); inner.style.cssText = 'box-sizing:border-box;width:' + A4W + 'px;min-height:' + A4H + 'px;padding:' + PAD + 'px;' + DOC_CSS; inner.setAttribute('dir', 'auto'); inner.innerHTML = '<style>' + INNER_CSS + '</style>' + gr.join('');
    const probe = stageDiv(A4W); probe.box.style.padding = '0'; probe.box.appendChild(inner.cloneNode(true)); const h = Math.max(A4H, probe.box.scrollHeight); probe.done();
    try { const c = await svgToCanvas(xhtml(inner), A4W, h, 2); imagePage(c, name + ' p.' + (k + 1), theme, W, k); } catch (e) { console.warn(e); toast('Page ' + (k + 1) + ' failed: ' + e.message); } k++; }
  window.HBUI && HBUI.goPage(B.cur + 1); SND.page(); E.changed(); toast('Opened ' + groups.length + ' page' + (groups.length > 1 ? 's' : '') + ' of ' + name + '. Write on them freely — they sit on the locked background layer.'); }
function imagePage(c, label, theme, W, k) { const id = 'a' + uidH(); B.assets[id] = c.toDataURL('image/jpeg', 0.9); const w = Math.min(W - 120, 1400), h = w * c.height / c.width; const np = E.newPage(theme); np.name = label.slice(0, 40); fitH(np, h + 60);
  np.objs.push({ id: uidH(), ts: Date.now(), t: 'img', asset: id, x: (W - w) / 2, y: 70, w, h, layer: 0, pdf: label }); B.pages.splice(B.cur + 1 + k, 0, np); }

/* PowerPoint → board pages. Slides are drawn by pptx-preview, then each one becomes a page: either an exact picture,
   or the same picture without its words plus every paragraph rebuilt as a text box you can edit. */
/* PowerPoint: a slide picker with live thumbnails, a progress screen with a preview of each slide, HD option, optional slideshow start */
const PPCSS = '.ppgrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:10px;max-height:min(44vh,420px);overflow:auto;padding:4px;margin:8px 0}' +
  '.ppth{position:relative;padding:0;border-radius:10px;border:2px solid var(--line);background:#fff;overflow:hidden;cursor:pointer;transition:opacity .2s,border-color .2s,transform .15s}.ppth:hover{transform:translateY(-2px)}' +
  '.ppth.on{border-color:var(--accent);box-shadow:0 0 0 2px color-mix(in srgb,var(--accent) 35%,transparent)}.ppth:not(.on){opacity:.35}.ppth .ppsc{pointer-events:none;overflow:hidden}' +
  '.ppth .ppn{position:absolute;left:5px;top:5px;z-index:2;min-width:22px;height:22px;border-radius:7px;background:var(--accent);color:var(--accent-ink);font:700 12px var(--head);display:grid;place-items:center;padding:0 5px}.ppth:not(.on) .ppn{background:#888}' +
  '.ppmodes{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin:6px 0}.ppm{display:flex;gap:8px;align-items:flex-start;padding:10px 12px;border:2px solid var(--line);border-radius:12px;cursor:pointer;font-size:13px;line-height:1.35}.ppm:has(input:checked){border-color:var(--accent);background:color-mix(in srgb,var(--accent) 10%,var(--panel))}.ppm b{display:block;font-size:14px;margin-bottom:2px}' +
  '.pprow{display:flex;gap:14px;flex-wrap:wrap;align-items:center;font-size:13px;margin:6px 0}#ppProg .pv{display:grid;place-items:center;height:min(40vh,320px);background:var(--panel2);border-radius:12px;overflow:hidden;margin:10px 0}#ppProg .pv img{max-width:100%;max-height:100%;box-shadow:var(--shadow);transition:opacity .25s}' +
  '#ppProg .bar{height:10px;border-radius:5px;background:var(--panel2);overflow:hidden}#ppProg .bar i{display:block;height:100%;width:0;background:var(--accent);transition:width .3s}@media (max-width:640px){.ppmodes{grid-template-columns:1fr}}';
/* pptx-preview draws tables with no style at all; a table that carries no fills or borders of its own gets PowerPoint's default look */
function fixTables(root) { root.querySelectorAll('table').forEach(tb => { const cells = [...tb.querySelectorAll('td,th')]; if (!cells.length || cells.some(td => /background|border/i.test(td.getAttribute('style') || ''))) return;
  [...tb.rows].forEach((tr, i) => [...tr.cells].forEach(td => { td.style.border = '1px solid #FFFFFF'; td.style.background = i === 0 ? '#4472C4' : i % 2 ? '#CFD5EA' : '#E9EBF5'; if (i === 0) td.querySelectorAll('span').forEach(sp => { sp.style.color = '#FFFFFF'; sp.style.fontWeight = '700'; }); })); }); }
/* ---------- PowerPoint click animations ----------
   The slide XML says which shapes (or which bullet points) appear or disappear on each click. Each click becomes one picture of the slide
   with the not-yet-shown parts hidden; the slideshow reveals them one click at a time. A tiny zip reader is enough to get at the XML. */
async function unzip(buf) { const dv = new DataView(buf), u8 = new Uint8Array(buf), td = new TextDecoder(); let e = buf.byteLength - 22; while (e >= 0 && dv.getUint32(e, true) !== 0x06054b50) e--; if (e < 0) throw new Error('not a zip file');
  const n = dv.getUint16(e + 10, true), files = new Map(); let q = dv.getUint32(e + 16, true);
  for (let i = 0; i < n; i++) { if (dv.getUint32(q, true) !== 0x02014b50) break; const nl = dv.getUint16(q + 28, true), xl = dv.getUint16(q + 30, true), cl = dv.getUint16(q + 32, true); files.set(td.decode(u8.subarray(q + 46, q + 46 + nl)), { method: dv.getUint16(q + 10, true), size: dv.getUint32(q + 20, true), off: dv.getUint32(q + 42, true) }); q += 46 + nl + xl + cl; }
  return { async text(name) { const f = files.get(name); if (!f) return null; const st = f.off + 30 + dv.getUint16(f.off + 26, true) + dv.getUint16(f.off + 28, true), data = u8.subarray(st, st + f.size);
    if (f.method === 0) return td.decode(data); return new Response(new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).text(); } }; }
const TOPS = ['p:sp', 'p:pic', 'p:grpSp', 'p:graphicFrame', 'p:cxnSp'];
/* each slide's own transition (<p:transition>): the kind, its direction, its speed and any automatic advance — played in the slideshow */
const TR_KIND = { fade: 'fade', push: 'slide', wipe: 'wipe', cover: 'cover', pull: 'uncover', split: 'split', zoom: 'zoom', newsflash: 'zoom', cut: 'none', circle: 'circle', diamond: 'circle', plus: 'circle', wheel: 'circle', wedge: 'circle',
  blinds: 'fade', checker: 'fade', comb: 'fade', randomBar: 'fade', strips: 'wipe', dissolve: 'fade', random: 'fade', morph: 'fade', flythrough: 'zoom', gallery: 'slide', conveyor: 'slide', pan: 'slide', ferris: 'slide', switch: 'slide', flip: 'slide', reveal: 'uncover', curtains: 'split', doors: 'split', window: 'split', prism: 'slide', vortex: 'zoom', ripple: 'circle', glitter: 'fade', honeycomb: 'fade', shred: 'fade', warp: 'zoom', flash: 'fadeblack', airplane: 'uncover', origami: 'uncover', crush: 'zoom', peelOff: 'uncover', pageCurlSingle: 'uncover', pageCurlDouble: 'uncover', fallOver: 'uncover', drape: 'uncover', wind: 'uncover', prestige: 'uncover', fracture: 'fade' };
function slideTrans(doc) { if (!doc) return null; const t = doc.getElementsByTagName('p:transition')[0]; if (!t) return null;
  const fx = [...t.children].find(c => !/^p:(sndAc|extLst)$/.test(c.tagName)), name = fx ? fx.tagName.replace(/^[^:]+:/, '') : 'cut';
  let k = TR_KIND[name] || 'fade'; if (k === 'fade' && fx && fx.getAttribute('thruBlk') === '1') k = 'fadeblack';
  const durA = +t.getAttribute('p14:dur'), spd = t.getAttribute('spd'), dur = durA > 0 ? durA / 1000 : spd === 'fast' ? 0.5 : spd === 'slow' ? 1 : 0.75;
  const dir = fx && (fx.getAttribute('dir') || '') || '', adv = +t.getAttribute('advTm') || 0;
  return { k, dir: /^(l|r|u|d|lu|ru|ld|rd|in|out|horz|vert)$/.test(dir) ? dir : '', dur: Math.max(0.2, Math.min(3, dur)), adv: adv > 0 ? adv : 0, click: t.getAttribute('advClick') !== '0' }; }
function slideAnim(doc) { if (!doc) return null; const tree = doc.getElementsByTagName('p:spTree')[0], seq = [...doc.getElementsByTagName('p:cTn')].find(c => c.getAttribute('nodeType') === 'mainSeq'); if (!tree || !seq) return null;
  const top = [...tree.children].filter(c => TOPS.includes(c.tagName)), where = {}; top.forEach((c, i) => [...c.getElementsByTagName('p:cNvPr')].forEach(nv => { where[nv.getAttribute('id')] = i; }));
  const lst = [...seq.children].find(c => c.tagName === 'p:childTnLst'); if (!lst) return null; const groups = [];
  [...lst.children].filter(c => c.tagName === 'p:par').forEach(par => { const ct = par.getElementsByTagName('p:cTn')[0], cond = ct && ct.getElementsByTagName('p:cond')[0], click = !cond || cond.getAttribute('delay') === 'indefinite';
    const effs = [...par.getElementsByTagName('p:cTn')].filter(c => c.getAttribute('presetClass')).map(c => { const tg = c.getElementsByTagName('p:spTgt')[0]; if (!tg) return null; const i = where[tg.getAttribute('spid')]; if (i == null) return null; const pr = tg.getElementsByTagName('p:pRg')[0]; return { cls: c.getAttribute('presetClass'), i, st: pr ? +pr.getAttribute('st') : null, end: pr ? +pr.getAttribute('end') : null }; }).filter(Boolean);
    if (click || !groups.length) groups.push({ click, effs }); else groups[groups.length - 1].effs.push(...effs); });
  const keys = f => f.st == null ? [String(f.i)] : Array.from({ length: Math.max(0, f.end - f.st) + 1 }, (_, k) => f.i + ':' + (f.st + k));
  const hidden = new Set(), seen = new Set(); groups.forEach(gr => gr.effs.forEach(f => keys(f).forEach(k => { if (seen.has(k)) return; seen.add(k); if (f.cls === 'entr') hidden.add(k); })));
  const apply = gr => gr.effs.forEach(f => keys(f).forEach(k => { if (f.cls === 'entr') hidden.delete(k); else if (f.cls === 'exit') hidden.add(k); }));
  let gi = 0; if (groups[0] && !groups[0].click) { apply(groups[0]); gi = 1; }
  const states = [[...hidden]]; for (; gi < groups.length; gi++) { apply(groups[gi]); const s = [...hidden]; if (s.join() !== states[states.length - 1].join()) states.push(s); }
  return states.length > 1 ? { n: top.length, states } : null; }
async function pptAnims(buf) { try { const z = await unzip(buf), P = new DOMParser(), xml = async n => { const t = await z.text(n); return t ? P.parseFromString(t, 'application/xml') : null; };
    const pres = await xml('ppt/presentation.xml'), rels = await xml('ppt/_rels/presentation.xml.rels'); if (!pres || !rels) return [];
    const rmap = {}; [...rels.getElementsByTagName('Relationship')].forEach(r => { rmap[r.getAttribute('Id')] = r.getAttribute('Target'); });
    const out = []; out.trans = []; for (const sid of pres.getElementsByTagName('p:sldId')) { const t = (rmap[sid.getAttribute('r:id')] || '').replace(/^\/?ppt\//, ''), d = await xml('ppt/' + t); out.push(slideAnim(d)); out.trans.push(slideTrans(d)); } return out; }
  catch (e) { console.warn('HelixBoard: animations not read', e); return []; } }
/* one picture per click: shapes or bullet points that are not showing yet are hidden (they still take their space, as in PowerPoint) */
function stepClone(sl, an, hidden) { const c = sl.cloneNode(true), wrap = c.querySelector('.slide-wrapper'); if (!wrap) return null; const kids = [...wrap.children]; if (kids.length !== an.n) return null;
  hidden.forEach(k => { const [i, para] = k.split(':'), el = kids[+i]; if (!el) return; if (para == null) el.style.visibility = 'hidden'; else { const ps = el.querySelectorAll('.text-wrapper p'); if (ps[+para]) ps[+para].style.visibility = 'hidden'; } }); return c; }
async function importPptx(file) { let lib; toast('Opening ' + file.name + '…');
  if (!document.getElementById('ppCss')) { const st = document.createElement('style'); st.id = 'ppCss'; st.textContent = PPCSS; document.head.appendChild(st); }
  try { lib = await need('pptx'); } catch (e) { toast(e.message); return; }
  const host = document.createElement('div'); host.style.cssText = 'position:fixed;left:-30000px;top:0;width:960px;'; document.body.appendChild(host);
  let slides, anims = []; try { const buf = await file.arrayBuffer(); anims = await pptAnims(buf.slice(0)); const pv = lib.init(host, { width: 960, height: 540, mode: 'list' }); await pv.preview(buf); await new Promise(r => setTimeout(r, 400)); await Promise.all([...host.querySelectorAll('img')].map(im => im.complete ? 0 : new Promise(r => { im.onload = im.onerror = r; }))); fixTables(host); slides = [...host.querySelectorAll('.pptx-preview-slide-wrapper')]; } catch (e) { host.remove(); toast('That PowerPoint could not be read (' + e.message + ').'); return; }
  if (!slides.length) { host.remove(); toast('No slides found in that file.'); return; } const n = slides.length; if (anims.length !== n) anims = []; const nAnim = anims.filter(Boolean).length, trans = anims.trans || [], nTr = trans.filter(x => x && x.k !== 'none').length; setTimeout(() => host.isConnected && host.remove(), 600000);
  const picked = new Set(slides.map((_, i) => i + 1).slice(0, 60));
  modal.open('<h2>Open PowerPoint</h2><p class="small muted" style="margin:0"><b>' + esc(file.name) + '</b> · ' + n + ' slide' + (n > 1 ? 's' : '') + ' · tap a slide to leave it out</p>' +
    '<div class="pprow"><button class="btn sm" id="ppAll">Select all</button><button class="btn sm" id="ppNone">Select none</button><span class="muted" id="ppCnt"></span></div><div class="ppgrid" id="ppG"></div>' +
    '<div class="ppmodes"><label class="ppm"><input type="radio" name="ppM" value="edit" checked><span><b>' + window.HB.icon('file-pen-line') + ' Editable slides</b>The design stays as the background; every title and bullet becomes a text box you can retype, move or delete.</span></label><label class="ppm"><input type="radio" name="ppM" value="pic"><span><b>' + window.HB.icon('presentation') + ' Exact look</b>Each slide as one picture on the locked background layer — write and highlight on top while you teach.</span></label></div>' +
    '<div class="pprow">' + (nAnim ? '<label><input type="checkbox" id="ppAnim"' + (set.get('pptAnim', true) ? ' checked' : '') + '> Play animations (' + nAnim + ' slide' + (nAnim === 1 ? '' : 's') + ') — click by click in the slideshow</label>' : '') + (nTr ? '<label><input type="checkbox" id="ppTr"' + (set.get('pptTrans', true) ? ' checked' : '') + '> Use the PowerPoint slide transitions (' + nTr + ' slide' + (nTr === 1 ? '' : 's') + ')</label>' : '') + '<label>Quality <select class="sel" id="ppQ" style="width:auto"><option value="2">Standard (Full HD)</option><option value="3">High (2.8K)</option><option value="4">Premium (4K, like PowerPoint)</option></select></label><label><input type="checkbox" id="ppShow"' + (set.get('pptShow', false) ? ' checked' : '') + '> Start the slideshow when ready</label></div>' +
    '<p class="small muted" style="margin:4px 0 0">Fonts that are not on this computer are replaced with similar ones. Click animations (appear, disappear, bullet by bullet) play as fades; motion paths and videos are not included. Animated slides open as pictures so their steps line up.</p><div class="foot"><button class="btn primary" id="ppGo"></button></div>', s => {
    const tt = document.getElementById('toast'); if (tt) tt.hidden = true;
    const G = $('#ppG', s), sw = slides[0].offsetWidth || 960, sh = slides[0].offsetHeight || 540, tw = 150, k = tw / sw;
    slides.forEach((sl, i) => { const b = document.createElement('button'); b.className = 'ppth' + (picked.has(i + 1) ? ' on' : ''); b.dataset.i = i + 1; b.title = 'Slide ' + (i + 1); b.innerHTML = '<span class="ppn">' + (i + 1) + '</span><div class="ppsc" style="width:100%;aspect-ratio:' + sw + '/' + sh + '"></div>'; const c = sl.cloneNode(true); c.style.cssText += ';transform:scale(' + k + ');transform-origin:0 0;margin:0'; b.querySelector('.ppsc').appendChild(c); G.appendChild(b);
      /* thumbnails stretch with the grid, so the scale follows the real width */
      requestAnimationFrame(() => { const w = b.clientWidth; if (w) c.style.transform = 'scale(' + (w / sw) + ')'; }); });
    const upd = () => { $$('.ppth', s).forEach(b => b.classList.toggle('on', picked.has(+b.dataset.i))); $('#ppCnt', s).textContent = picked.size + ' of ' + n + ' chosen'; const g = $('#ppGo', s); g.disabled = !picked.size; g.innerHTML = window.HB.icon('file-input') + ' Import ' + picked.size + ' slide' + (picked.size === 1 ? '' : 's'); };
    G.onclick = e => { const b = e.target.closest('.ppth'); if (!b) return; const i = +b.dataset.i; picked.has(i) ? picked.delete(i) : picked.add(i); upd(); };
    $('#ppAll', s).onclick = () => { slides.forEach((_, i) => picked.add(i + 1)); upd(); }; $('#ppNone', s).onclick = () => { picked.clear(); upd(); };
    $('#ppGo', s).onclick = () => { const edit = $('input[name=ppM]:checked', s).value === 'edit', q = +$('#ppQ', s).value, hd = q >= 3, show = $('#ppShow', s).checked; set.put('pptQ', q); const trb = $('#ppTr', s), useTr = !!(trb && trb.checked); if (trb) set.put('pptTrans', useTr); set.put('pptShow', show); const an = $('#ppAnim', s), useAnim = !!(an && an.checked); if (an) set.put('pptAnim', useAnim); const pages = [...picked].sort((a, b) => a - b); modal.close(); setTimeout(() => slidesToPages(slides, pages, file.name, edit, { hd, q, show, anims: useAnim ? anims : [], trans: useTr ? trans : [] }).finally(() => host.remove()), 20); };
    $('#ppQ', s).value = String(set.get('pptQ', 4)); upd(); }); }
/* slides are drawn at up to 4K (3840 × 2160) with high-quality JPEG, so text and pictures stay crisp on big boards and projectors */
async function slidesToPages(slides, pages, name, edit, opts) { opts = opts || {}; const out = []; const scale = opts.q || (opts.hd ? 3 : 2), qual = scale >= 4 ? 0.95 : scale >= 3 ? 0.93 : 0.9;
  modal.open('<div id="ppProg"><h2>Importing ' + esc(name) + '</h2><div class="pv"><img id="ppImg" alt=""></div><div class="bar"><i id="ppBar"></i></div><p class="small muted" id="ppTxt" style="margin:8px 0 0">Preparing…</p><div class="foot"><button class="btn" data-close>Cancel</button></div></div>');
  const live = () => !!document.getElementById('ppProg');
  for (let k = 0; k < pages.length; k++) { if (!live()) { toast('Import cancelled.'); return; } const pn = pages[k], sl = slides[pn - 1]; $('#ppTxt').textContent = 'Slide ' + pn + ' — ' + (k + 1) + ' of ' + pages.length;
    try { const sw = sl.offsetWidth || 960, sh = sl.offsetHeight || 540; const texts = [], an = opts.anims && opts.anims[pn - 1];
      if (an && stepClone(sl, an, [])) { const ids = []; for (const st of an.states) { const cl = stepClone(sl, an, st); cl.setAttribute('xmlns', 'http://www.w3.org/1999/xhtml'); cl.style.margin = '0'; const cv = await svgToCanvas(xhtml(cl), sw, sh, scale); const url = cv.toDataURL('image/jpeg', qual), id = 'a' + uidH(); B.assets[id] = url; ids.push(id); if (live()) $('#ppImg').src = url; }
        out.push({ asset: ids[0], w: sw, h: sh, texts: [], steps: ids.slice(1), tr: opts.trans && opts.trans[pn - 1] || null }); if (live()) $('#ppBar').style.width = ((k + 1) / pages.length * 100) + '%'; await new Promise(r => requestAnimationFrame(r)); continue; }
      if (edit) { const r0 = sl.getBoundingClientRect(); sl.querySelectorAll('.text-wrapper p').forEach(p => { if (p.closest('table')) return; const t = p.innerText.replace(/ /g, ' ').replace(/\s+$/, ''); if (!t.trim()) return; const r = p.getBoundingClientRect(); const sp = p.querySelector('span') || p; const cs = getComputedStyle(sp), pcs = getComputedStyle(p); const size = parseFloat(cs.fontSize) || 18, rtl = window.HB.isRTL(t); const o = { t: 'text', x: r.left - r0.left, y: r.top - r0.top - size * 0.12, w: Math.max(30, r.width + 4), s: t, size, font: rtl ? 'Tajawal' : 'Lexend', c: rgbHex(cs.color), b: +cs.fontWeight >= 600 || cs.fontWeight === 'bold', i: cs.fontStyle === 'italic', doc: name }; if (pcs.textAlign === 'center') o.align = 'center'; else if (pcs.textAlign === 'right' || pcs.textAlign === 'end') o.align = 'right'; window.HB.loadFont(o.font); texts.push(o); }); }
      const clone = sl.cloneNode(true); clone.setAttribute('xmlns', 'http://www.w3.org/1999/xhtml'); clone.style.margin = '0'; if (edit) clone.querySelectorAll('.text-wrapper').forEach(t => { if (!t.closest('table')) t.style.visibility = 'hidden'; });
      const c = await svgToCanvas(xhtml(clone), sw, sh, scale); const url = c.toDataURL('image/jpeg', qual); const id = 'a' + uidH(); B.assets[id] = url; out.push({ asset: id, w: sw, h: sh, texts, tr: opts.trans && opts.trans[pn - 1] || null });
      if (live()) { $('#ppImg').src = url; $('#ppBar').style.width = ((k + 1) / pages.length * 100) + '%'; }
    } catch (e) { console.warn(e); toast('Slide ' + pn + ' failed: ' + e.message); }
    await new Promise(r => requestAnimationFrame(r)); }
  if (!live()) { toast('Import cancelled.'); return; } modal.close();
  if (out.length) { window.HBA && HBA.log('import', { type: 'pptx', pages: out.length }); window.HBD.create(name, out); SND.done && SND.done(); toast('Opened ' + out.length + ' slide' + (out.length > 1 ? 's' : '') + ' in one tab' + (edit ? ' — double-click any text to change it.' : '.') + (opts.show ? '' : ' Press F5 for the slideshow.'), 4200); if (opts.show) setTimeout(() => window.HBD.startShow(0), 400); } }
const rgbHex = c => { const m = String(c).match(/\d+(\.\d+)?/g); if (!m || m.length < 3) return '#1E1419'; return '#' + m.slice(0, 3).map(v => (+v | 0).toString(16).padStart(2, '0')).join(''); };

/* PDF → editable text: rebuilds each page's text as text boxes at the same places */
async function pdfEditable(doc, pages, name) { const out = [];
  for (const pn of pages) { toast('Reading text on page ' + pn + '…');
    try { const pg = await doc.getPage(pn); const vp = pg.getViewport({ scale: 1 }); const tc = await pg.getTextContent(); const lines = [];
      tc.items.forEach(it => { if (!it.str || !it.str.trim()) return; const x = it.transform[4], y = vp.height - it.transform[5], fs = Math.hypot(it.transform[2], it.transform[3]) || 12; let L = lines.find(l => Math.abs(l.y - y) < fs * 0.45 && x - l.x2 < fs * 2.5 && x >= l.x - 2); if (L) { L.s += (x - L.x2 > fs * 0.15 && !/\s$/.test(L.s) ? ' ' : '') + it.str; L.x2 = x + it.width; } else lines.push({ x, x2: x + it.width, y, fs, s: it.str }); });
      const texts = lines.map(l => { const rtl = window.HB.isRTL(l.s); const o = { t: 'text', x: l.x, y: l.y - l.fs, w: 0, s: l.s.trim(), font: rtl ? 'Tajawal' : 'Lexend', size: Math.max(5, l.fs), c: '#1E1419', doc: name }; window.HB.loadFont(o.font); return o; });
      out.push({ w: vp.width, h: vp.height, texts }); pg.cleanup && pg.cleanup();
    } catch (e) { console.warn(e); toast('Page ' + pn + ' failed: ' + e.message); } }
  if (out.length) { window.HBD.create(name, out); toast('Rebuilt the text of ' + out.length + ' page' + (out.length > 1 ? 's' : '') + ' in one tab — double-click any line to edit it. Pictures in the PDF are not included in this mode.'); } }
/* ---------- .helix files ---------- */
function usedAssets() { const used = {}; B.pages.forEach(p => p.objs.forEach(o => { if (o.asset && B.assets[o.asset]) used[o.asset] = B.assets[o.asset]; if (o.t === 'scalebar' && o.img) { const im = p.objs.find(q => q.id === o.img); if (im && im.asset) used[im.asset] = B.assets[im.asset]; } })); return used; }
function saveFile() { const data = { app: 'HelixBoard', format: 1, saved: new Date().toISOString(), board: JSON.parse(E.serial()), assets: usedAssets() };
  download(new Blob([JSON.stringify(data)], { type: 'application/json' }), safeName() + '_' + stamp() + '.helix'); SND.done && SND.done(); toast('Saved ' + safeName() + '.helix to your downloads'); }
async function openFile() { const fs = await pick('.helix,application/json'); if (fs[0]) readHelix(fs[0]); }
async function readHelix(file) { let d; try { d = JSON.parse(await file.text()); } catch (e) { toast('That file is not a HelixBoard board.'); return; }
  const board = d.board || (d.pages ? d : null); if (!board || !Array.isArray(board.pages)) { toast('That file is not a HelixBoard board.'); return; }
  const n = board.pages.length, name = board.title || file.name.replace(/\.helix$/i, '');
  modal.open('<h2>Open “' + esc(name) + '”</h2><p>This file has <b>' + n + ' page' + (n > 1 ? 's' : '') + '</b>.</p><div class="row" style="gap:8px;flex-wrap:wrap"><button class="btn primary" id="ohTabs">' + window.HB.icon('plus') + ' Add as new tabs</button><button class="btn" id="ohRep">Replace this board</button></div><p class="small muted">Add as new tabs keeps everything you have and puts the file\'s pages after your current tabs. Replace saves your current board as a version first.</p>', s => {
    $('#ohTabs', s).onclick = async () => { modal.close(); Object.assign(B.assets, d.assets || {}); const first = B.pages.length; board.pages.forEach((p, k) => { const np = Object.assign(E.newPage(p.theme), p, { id: window.HB.uid() }); if (!np.name) np.name = (n > 1 ? name + ' ' + (k + 1) : name).slice(0, 40); B.pages.push(np); }); await E.saveNow(); window.HBUI && HBUI.goPage(first); SND.page(); toast('Added ' + n + ' tab' + (n > 1 ? 's' : '') + ' from ' + name); };
    $('#ohRep', s).onclick = async () => { modal.close(); await snapshot('Before opening ' + file.name); E.loadBoard(board, Object.assign({}, d.assets || {})); await E.saveNow(); window.HBUI && (HBUI.buildRow(), HBUI.renderDrawer()); SND.page(); toast('Opened ' + name); }; }); }
bus.on('open-file', f => readHelix(f));
async function snapshot(label) { try { await IDB.addVersion({ ts: Date.now(), title: label || B.title, n: B.pages.reduce((a, p) => a + p.objs.length, 0), data: E.serial() }); } catch (e) {} }

/* ---------- PNG / PDF export ---------- */
function renderPageImage(p, maxPx) { const r = E.pageRect(p); let sc = 2; const area = r[2] * r[3]; if (area * sc * sc > maxPx) sc = Math.sqrt(maxPx / area); return E.renderToCanvas(p, r, sc, { all: false }); }
function exportPNG() { window.HBA && HBA.log('export', { type: 'png' }); const p = E.page(); toast('Rendering PNG…'); setTimeout(() => { const c = renderPageImage(p, 36e6); c.toBlob(b => { if (!b) { toast('The page was too large to export as one image — try PDF.'); return; } download(b, safeName() + '_page' + (B.cur + 1) + '_' + stamp() + '.png'); SND.done && SND.done(); toast('PNG saved (' + c.width + ' × ' + c.height + ' px)'); }, 'image/png'); }, 30); }
function exportPDF() { modal.open('<h2>Export PDF</h2><p>Long notebook pages are cut into 16:9 slides so every part is readable when printed or projected.</p><div class="row" style="gap:8px;flex-wrap:wrap"><label><input type="radio" name="pdfW" value="cur" checked> This page</label><label><input type="radio" name="pdfW" value="all"> All ' + B.pages.length + ' pages</label></div><p><label><input type="checkbox" id="pdfBg" checked> Include the background theme</label><br><label><input type="checkbox" id="pdfNum" checked> Number the slides and add the board title</label></p><div class="foot"><button class="btn primary" id="pdfX">Create PDF</button></div>', s => { $('#pdfX', s).onclick = () => { const all = $('input[name=pdfW]:checked', s).value === 'all', bg = $('#pdfBg', s).checked, num = $('#pdfNum', s).checked; modal.close(); makePDF(all ? B.pages : [E.page()], bg, num); }; }); }
async function makePDF(pages, bg, num) { window.HBA && HBA.log('export', { type: 'pdf', pages: pages.length }); let jsp; toast('Preparing PDF…'); try { jsp = await need('jspdf'); } catch (e) { toast(e.message); return; }
  const { jsPDF } = jsp; let pdf = null, count = 0; const slides = [];
  pages.forEach(p => { const r = E.pageRect(p); if (B.mode === 'scroll') { const sh = Math.round(r[2] * 9 / 16); for (let y = 0; y < r[3] - 20; y += sh) slides.push([p, [0, y, r[2], sh]]); } else slides.push([p, r]); });
  for (let i = 0; i < slides.length; i++) { const [p, r] = slides[i]; const sc = Math.min(1.5, 2400 / r[2]); const c = E.renderToCanvas(p, r, sc, { bg });
    if (!bg) { const w = document.createElement('canvas'); w.width = c.width; w.height = c.height; const g = w.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, w.width, w.height); g.drawImage(c, 0, 0); c.getContext('2d').drawImage(w, 0, 0); }
    const pw = r[2] * 0.5, ph = r[3] * 0.5, orient = pw >= ph ? 'landscape' : 'portrait';
    if (!pdf) pdf = new jsPDF({ orientation: orient, unit: 'pt', format: [pw, ph], compress: true }); else pdf.addPage([pw, ph], orient);
    pdf.addImage(c.toDataURL('image/jpeg', 0.9), 'JPEG', 0, 0, pw, ph, undefined, 'FAST');
    if (num) { pdf.setFontSize(9); pdf.setTextColor(140); pdf.text((B.title || 'HelixBoard') + '  ·  ' + (i + 1) + ' / ' + slides.length, 14, ph - 10); }
    count++; if (i % 3 === 2) { toast('PDF: slide ' + (i + 1) + ' of ' + slides.length); await new Promise(r => setTimeout(r, 0)); } }
  if (!pdf) { toast('Nothing to export yet.'); return; }
  pdf.setProperties({ title: B.title || 'HelixBoard', creator: 'HelixBoard — designed by Mr. Hany Taha' });
  download(pdf.output('blob'), safeName() + '_' + stamp() + '.pdf'); SND.done && SND.done(); toast('PDF saved — ' + count + ' slide' + (count > 1 ? 's' : '')); }

/* ---------- versions ---------- */
async function versions() { const vs = (await IDB.versions()).sort((a, b) => b.ts - a.ts);
  const when = ts => { const d = new Date(ts), m = Math.round((Date.now() - ts) / 60000); return (m < 1 ? 'just now' : m < 60 ? m + ' min ago' : m < 1440 ? Math.round(m / 60) + ' h ago' : d.toLocaleDateString()) + ' · ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); };
  modal.open('<h2>Versions</h2><p class="small muted">HelixBoard keeps a snapshot every 3 minutes while you work, plus one before opening a file, starting a new board or restoring. The last 20 are kept in this browser.</p>' + (vs.length ? '<div class="vlist">' + vs.map((v, i) => '<div class="row" style="justify-content:space-between;gap:10px;padding:8px 10px;border-radius:10px;background:var(--panel2);margin:6px 0"><div><b>' + esc(v.title || 'Untitled') + '</b><div class="small muted">' + when(v.ts) + ' · ' + (v.n || 0) + ' items</div></div><button class="btn sm" data-v="' + i + '">Restore</button></div>').join('') + '</div>' : '<p>No versions yet — keep working and they appear automatically.</p>') + '<div class="foot"><button class="btn" id="verNow">Save a version now</button></div>', s => {
    $$('[data-v]', s).forEach(b => b.onclick = async () => { const v = vs[+b.dataset.v]; await snapshot('Before restoring'); E.loadBoard(v.data); await E.saveNow(); modal.close(); window.HBUI && (HBUI.buildRow(), HBUI.renderDrawer()); SND.page(); toast('Version restored. The board you had is saved as “Before restoring”.'); });
    $('#verNow', s).onclick = async () => { await snapshot(B.title); toast('Version saved'); modal.close(); versions(); }; }); }

/* ---------- new board ---------- */
function newBoard() { modal.open('<h2>Start a new board?</h2><p>The current board is kept as a version, so you can bring it back from <b>Versions</b>.</p><label>Title <input id="nbT" class="inp" value="" placeholder="e.g. Grade 10 · Photosynthesis" style="width:280px"></label><div class="foot"><button class="btn primary" id="nbGo">New board</button></div>', s => { setTimeout(() => $('#nbT', s).focus(), 30); const go = async () => { await snapshot(B.title || 'Previous board'); const t = $('#nbT', s).value.trim() || 'Untitled board'; modal.close(); E.loadBoard({ title: t, width: B.width, mode: B.mode, pages: [] }, {}); E.quizReveal.clear(); await E.saveNow(); window.HBUI && (HBUI.buildRow(), HBUI.renderDrawer()); SND.page(); toast('New board: ' + t); }; $('#nbGo', s).onclick = go; $('#nbT', s).onkeydown = e => { if (e.key === 'Enter') go(); }; }); }

/* ---------- replay: a time-lapse of how the page was built ---------- */
const RP = { on: false, play: false, speed: set.get('replaySpeed', 2), t: 0, last: 0, plan: [], total: 0, cur: null, raf: 0, panel: null };
function buildPlan(p) { const objs = p.objs.filter(o => (o.layer == null ? 1 : o.layer) !== 0).slice().sort((a, b) => (a.ts || 0) - (b.ts || 0)); let t = 0, prevEnd = null; const plan = [];
  objs.forEach(o => { const dur = o.t === 'stroke' && o.tm && o.tm.length ? clamp(o.tm[o.tm.length - 1], 120, 5000) : 260; const gap = prevEnd == null ? 300 : clamp((o.ts || 0) - prevEnd, 60, 700); t += gap; plan.push({ o, t0: t, t1: t + dur }); t += dur; prevEnd = (o.ts || 0) + dur; }); return { plan, total: t + 400 }; }
const replayDrawer = { active: () => RP.on, draw(g) { const c = RP.cur; if (!c) return; const o = c.o; if (o.t !== 'stroke') { g.globalAlpha = clamp((RP.t - c.t0) / (c.t1 - c.t0), 0.05, 1); E.drawObj(g, o, E.page()); return; }
    const tm = o.tm || [], el = RP.t - c.t0; let k = tm.length ? tm.findIndex(v => v > el) : Math.floor(o.pts.length / 3 * (el / (c.t1 - c.t0))); if (k < 0) k = o.pts.length / 3; k = Math.max(2, k); const part = Object.assign({}, o, { pts: o.pts.slice(0, k * 3), tm: tm.slice(0, k), id: o.id + '~' }); for (const key in part) if (key[0] === '_') delete part[key]; E.drawObj(g, part, E.page());
    const n = part.pts.length; RP.tip = [part.pts[n - 3], part.pts[n - 2]]; } };
E.liveDrawers.push(replayDrawer);
function replay() { if (RP.on) { stopReplay(); return; } const p = E.page(); const { plan, total } = buildPlan(p); if (!plan.length) { toast('Nothing to replay on this page yet — draw something first.'); return; }
  RP.on = true; RP.play = true; RP.plan = plan; RP.total = total; RP.t = 0; RP.last = performance.now(); RP.cur = null; RP.idx = 0; E.hidden = new Set(plan.map(x => x.o.id)); if (I.clearSel) I.clearSel();
  RP.panel = floatPanel('replay', 'Replay', '<div class="row" style="gap:6px;align-items:center"><button class="btn primary" id="rpPlay" style="min-width:86px">Pause</button><button class="btn sm" id="rpRe">Restart</button><select id="rpSp" class="inp" style="width:auto">' + [1, 2, 4, 8].map(s => '<option value="' + s + '"' + (s == RP.speed ? ' selected' : '') + '>' + s + '×</option>').join('') + '</select><button class="btn sm" id="rpEnd">Finish</button></div><input type="range" id="rpBar" min="0" max="1000" value="0" style="width:100%;margin-top:8px"><div class="small muted" id="rpInfo"></div><p class="small muted" style="margin:4px 0 0">Watch how the page was built, stroke by stroke. Tip: press <b>Record</b> first to save the replay as a video.</p>', { icon: 'play', w: 360, x: 84, y: 140, onClose: stopReplay });
  const el = RP.panel.el; $('#rpPlay', el).onclick = () => { RP.play = !RP.play; if (RP.play && RP.t >= RP.total) seek(0); RP.last = performance.now(); $('#rpPlay', el).textContent = RP.play ? 'Pause' : 'Play'; if (!RP.play) SND.writeStop(); };
  $('#rpRe', el).onclick = () => { seek(0); RP.play = true; $('#rpPlay', el).textContent = 'Pause'; }; $('#rpSp', el).onchange = e => { RP.speed = +e.target.value; set.put('replaySpeed', RP.speed); };
  $('#rpEnd', el).onclick = () => RP.panel.close(); $('#rpBar', el).oninput = e => { seek(+e.target.value / 1000 * RP.total); };
  cancelAnimationFrame(RP.raf); RP.raf = requestAnimationFrame(stepReplay); SND.whoosh && SND.whoosh(); }
function seek(t) { RP.t = clamp(t, 0, RP.total); const hide = new Set(); RP.cur = null; RP.plan.forEach(x => { if (x.t1 > RP.t) hide.add(x.o.id); if (x.t0 <= RP.t && x.t1 > RP.t) RP.cur = x; }); E.hidden = hide; E.dirty.live = true; SND.writeStop(); RP.wasWriting = false; }
function stepReplay(now) { if (!RP.on) return; const dt = Math.min(100, now - RP.last); RP.last = now;
  if (RP.play) { const prevT = RP.t; RP.t = Math.min(RP.total, RP.t + dt * RP.speed); let changed = false; const hide = E.hidden; RP.cur = null;
    for (const x of RP.plan) { if (x.t1 <= RP.t && hide.has(x.o.id)) { hide.delete(x.o.id); changed = true; if (x.o.t !== 'stroke') SND.pop(); } if (x.t0 <= RP.t && x.t1 > RP.t) RP.cur = x; }
    if (changed) E.hidden = hide; E.dirty.live = true;
    const writing = RP.cur && RP.cur.o.t === 'stroke'; if (writing && !RP.wasWriting) SND.writeStart(RP.cur.o.pen); if (!writing && RP.wasWriting) SND.writeStop(); if (writing) { const tip = RP.tip; if (tip && RP.ptip) { const sp = Math.hypot(tip[0] - RP.ptip[0], tip[1] - RP.ptip[1]) / Math.max(1, dt) * Math.min(RP.speed, 3) * 0.6; SND.writeMove(sp, Math.atan2(tip[1] - RP.ptip[1], tip[0] - RP.ptip[0])); } RP.ptip = tip; } RP.wasWriting = writing;
    if (RP.t >= RP.total) { RP.play = false; SND.writeStop(); RP.wasWriting = false; SND.chime && SND.chime(); const b = RP.panel && $('#rpPlay', RP.panel.el); if (b) b.textContent = 'Play'; } }
  const el = RP.panel && RP.panel.el; if (el) { $('#rpBar', el).value = Math.round(RP.t / RP.total * 1000); const done = RP.plan.filter(x => x.t1 <= RP.t).length; $('#rpInfo', el).textContent = done + ' / ' + RP.plan.length + ' items · ' + (RP.t / 1000).toFixed(1) + ' s of ' + (RP.total / 1000).toFixed(1) + ' s (real time)'; }
  RP.raf = requestAnimationFrame(stepReplay); }
function stopReplay() { if (!RP.on) return; RP.on = false; cancelAnimationFrame(RP.raf); SND.writeStop(); RP.cur = null; E.hidden = new Set(); E.dirty.all(); if (RP.panel && !RP.panel.el.hidden) { const p = RP.panel; RP.panel = null; p.close(); } }
$('#stage').addEventListener('pointerdown', e => { if (RP.on && e.target.closest('canvas')) { stopReplay(); toast('Replay closed — back to editing.'); } }, true);
bus.on('page', () => { if (RP.on) stopReplay(); });

/* ---------- lesson recording: board + board sounds + optional microphone → .webm ---------- */
const REC = { mr: null, chunks: [], comp: null, raf: 0, t0: 0, chip: null, mic: null, ac: null, tick: 0, cam: null, dur: 0, paused: false };
function record() { if (REC.mr) { stopRecord(); return; }
  if (!window.MediaRecorder || !HTMLCanvasElement.prototype.captureStream) { toast('This browser cannot record the board. Try Chrome, Edge or Firefox.'); return; }
  modal.open('<h2>Record the lesson</h2><p>Records the board as a video — your ink, replay, laser and instruments — with your voice, ready to share with students who missed the lesson. Saved as MP4 where possible (plays on phones, WhatsApp and Teams). Floating panels and the on-screen keyboard are not in the video.</p><p><label><input type="checkbox" id="recMic" checked> Include my voice (microphone)</label><br><label><input type="checkbox" id="recCam"> Show my camera in a corner bubble</label><br><label><input type="checkbox" id="recSnd" checked> Include writing and tool sounds</label></p><p class="small muted">Stop with the Record button again or the red chip at the top.</p><div class="foot"><button class="btn primary" id="recGo">' + window.HB.icon('video') + ' Start recording</button></div>', s => { $('#recGo', s).onclick = () => { const mic = $('#recMic', s).checked, snd = $('#recSnd', s).checked, cam = $('#recCam', s).checked; modal.close(); startRecord(mic, snd, cam); }; }); }
async function startRecord(withMic, withSnd, withCam) {
  let camV = null; if (withCam) { try { REC.cam = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 } }); camV = document.createElement('video'); camV.muted = true; camV.playsInline = true; camV.srcObject = REC.cam; await camV.play().catch(() => {}); } catch (e) { toast('Camera not available — recording without the bubble.'); } }
  const src = [$('#cvBg'), E.cvMain, E.cvLive]; const W0 = E.cvMain.width, H0 = E.cvMain.height; const k = Math.min(1, 1920 / W0); const comp = document.createElement('canvas'); comp.width = Math.round(W0 * k / 2) * 2; comp.height = Math.round(H0 * k / 2) * 2; const g = comp.getContext('2d'); REC.comp = comp;
  const paint = () => { g.drawImage(src[0], 0, 0, comp.width, comp.height); g.drawImage(src[1], 0, 0, comp.width, comp.height); g.drawImage(src[2], 0, 0, comp.width, comp.height);
    /* the teacher's face in a round bubble, bottom-right */ if (camV && camV.videoWidth) { const r = Math.round(comp.height * 0.13), cx = comp.width - r - 24, cy = comp.height - r - 24, vw = camV.videoWidth, vh = camV.videoHeight, sz = Math.min(vw, vh); g.save(); g.beginPath(); g.arc(cx, cy, r, 0, 7); g.closePath(); g.clip(); g.drawImage(camV, (vw - sz) / 2, (vh - sz) / 2, sz, sz, cx - r, cy - r, r * 2, r * 2); g.restore(); g.beginPath(); g.arc(cx, cy, r, 0, 7); g.lineWidth = 5; g.strokeStyle = '#FF5FA2'; g.stroke(); }
    REC.raf = requestAnimationFrame(paint); }; paint();
  const vstream = comp.captureStream(30); const tracks = [...vstream.getVideoTracks()];
  try { const AC = window.AudioContext || window.webkitAudioContext; const ac = new AC(); const dest = ac.createMediaStreamDestination(); let any = false;
    if (withSnd) { SND.unlock(); const s = SND.stream(); if (s && s.getAudioTracks().length) { ac.createMediaStreamSource(s).connect(dest); any = true; } }
    if (withMic) { try { REC.mic = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } }); ac.createMediaStreamSource(REC.mic).connect(dest); any = true; } catch (e) { toast('Microphone not available — recording without your voice.'); } }
    if (any) tracks.push(...dest.stream.getAudioTracks()); REC.ac = ac; } catch (e) { console.warn(e); }
  const types = ['video/mp4;codecs=avc1.42E01F,mp4a.40.2', 'video/mp4;codecs=avc1,mp4a.40.2', 'video/mp4', 'video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm']; const type = types.find(t => MediaRecorder.isTypeSupported(t)) || '';
  let mr; try { mr = new MediaRecorder(new MediaStream(tracks), type ? { mimeType: type, videoBitsPerSecond: 6e6 } : undefined); } catch (e) { toast('Recording could not start: ' + e.message); cleanupRec(); return; }
  REC.chunks = []; mr.ondataavailable = e => { if (e.data && e.data.size) REC.chunks.push(e.data); };
  mr.onstop = () => { const blob = new Blob(REC.chunks, { type: (mr.mimeType || 'video/webm').split(';')[0] }); const ext = /mp4/.test(blob.type) ? 'mp4' : 'webm', name = safeName() + '_lesson_' + stamp() + '.' + ext, dur = fmtT(REC.dur / 1000); cleanupRec(); if (blob.size <= 1000) { toast('The recording was empty.'); return; } savedRecording(blob, name, dur); };
  mr.start(1000); REC.mr = mr; REC.t0 = Date.now(); REC.dur = 0; REC.paused = false;
  const chip = document.createElement('button'); chip.className = 'recchip'; chip.setAttribute('aria-label', 'Stop recording'); chip.style.cssText = 'position:fixed;top:10px;left:50%;transform:translateX(-50%);z-index:70;display:flex;align-items:center;gap:8px;padding:6px 14px;border-radius:999px;border:0;background:#C81E4A;color:#fff;font:600 14px var(--ui);box-shadow:0 6px 20px rgba(200,30,74,.45);cursor:pointer';
  chip.innerHTML = '<i style="width:10px;height:10px;border-radius:50%;background:#fff;display:block"></i><span>REC 00:00</span><span data-p style="padding:2px 8px;border-radius:999px;background:rgba(255,255,255,.22)">⏸ Pause</span><span data-s style="padding:2px 8px;border-radius:999px;background:rgba(255,255,255,.22)">■ Stop</span>'; chip.onclick = e => { if (e.target.closest('[data-p]')) { togglePause(); return; } stopRecord(); }; document.body.appendChild(chip); REC.chip = chip;
  if (window.gsap && !REDUCE) gsap.to(chip.firstChild, { opacity: 0.25, repeat: -1, yoyo: true, duration: 0.6 });
  let lastT = Date.now(); REC.tick = setInterval(() => { const n = Date.now(); if (!REC.paused) REC.dur += n - lastT; lastT = n; chip.children[1].textContent = (REC.paused ? 'PAUSED ' : 'REC ') + fmtT(REC.dur / 1000); }, 250);
  SND.chime && SND.chime(); refreshUI(); }
const fmtT = s => { s = Math.round(s); return String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0'); };
function stopRecord() { if (!REC.mr) return; try { REC.mr.stop(); } catch (e) { cleanupRec(); } REC.mr = null; refreshUI(); }
function togglePause() { const mr = REC.mr; if (!mr) return; if (mr.state === 'recording') { mr.pause(); REC.paused = true; } else if (mr.state === 'paused') { mr.resume(); REC.paused = false; } const p = REC.chip && REC.chip.querySelector('[data-p]'); if (p) p.textContent = REC.paused ? '▶ Resume' : '⏸ Pause'; REC.chip.style.background = REC.paused ? '#7A5A68' : '#C81E4A'; }
/* the finished video: saved in Documents\HelixBoard\Recordings in the Windows app (with Share with the class), downloaded in a browser */
async function savedRecording(blob, name, dur) { const D = window.helixDesktop, mb = (blob.size / 1048576).toFixed(1) + ' MB'; window.HBA && HBA.log('record', { dur, mb: +(blob.size / 1048576).toFixed(1) });
  if (!D || !D.saveRecording) { download(blob, name); toast('Recording saved (' + mb + ', ' + dur + ')'); return; }
  let file = null; try { file = await D.saveRecording(name, new Uint8Array(await blob.arrayBuffer())); } catch (e) { console.warn(e); }
  if (!file) { download(blob, name); return; }
  modal.open('<h2>Lesson video saved</h2><p><b>' + esc(name) + '</b> · ' + dur + ' · ' + mb + '</p><p class="small muted">In Documents › HelixBoard › Recordings. Share it with students who missed the lesson — on the class link they can watch or download it on their phones.</p><div class="foot"><button class="btn" id="rvShow">' + window.HB.icon('folder-open') + ' Show in folder</button><button class="btn primary" id="rvShare">' + window.HB.icon('monitor-smartphone') + ' Share with the class</button></div>', s => {
    $('#rvShow', s).onclick = () => D.showFile(file); $('#rvShare', s).onclick = () => { modal.close(); window.HBCL && HBCL.shareFile({ name, kind: 'video', path: file, type: blob.type }); }; }); }
function cleanupRec() { cancelAnimationFrame(REC.raf); if (REC.cam) { REC.cam.getTracks().forEach(t => t.stop()); REC.cam = null; } clearInterval(REC.tick); if (REC.chip) { REC.chip.remove(); REC.chip = null; } if (REC.mic) { REC.mic.getTracks().forEach(t => t.stop()); REC.mic = null; } if (REC.ac) { try { REC.ac.close(); } catch (e) {} REC.ac = null; } REC.mr = null; refreshUI(); }

/* ---------- shortcuts + commands ---------- */
document.addEventListener('keydown', e => { if (!(e.ctrlKey || e.metaKey) || e.altKey) return; const k = e.key.toLowerCase(); const tg = e.target.tagName; if (k === 's') { e.preventDefault(); if (e.shiftKey) exportPDF(); else saveFile(); } else if (k === 'o' && tg !== 'TEXTAREA' && tg !== 'INPUT') { e.preventDefault(); openFile(); } else if (k === 'e' && e.shiftKey) { e.preventDefault(); exportPNG(); } });
setTimeout(() => { if (!window.HBUI || !HBUI.cmd) return; [['Save board file (.helix)', saveFile, 'download keep ctrl+s', 'save'], ['Open board file', openFile, 'load .helix', 'folder-open'], ['Export page as PNG', exportPNG, 'image picture', 'image-down'], ['Export PDF', exportPDF, 'print slides', 'file-down'], ['Versions', versions, 'history undo restore backup', 'history'], ['New board', newBoard, 'clear blank start', 'square-pen'], ['Replay this page', replay, 'time-lapse playback', 'play'], ['Record lesson video', record, 'screen capture webm', 'video'], ['Import PDF pages', pickPdf, 'worksheet slides', 'file-text'], ['Insert image', pickImage, 'photo picture', 'image'], ['Document camera', camera, 'webcam visualiser', 'camera']].forEach(([n, run, kw, ic]) => HBUI.cmd({ n, k: 'Board', kw, ic, run })); }, 0);

window.HBIO = { pickImage, camera, pickPdf, importPdf, openDocument, openDoc, importDocx, importPptx, saveFile, openFile, readHelix, exportPNG, exportPDF, makePDF, versions, newBoard, replay, stopReplay, record, stopRecord, snapshot, get recording() { return !!REC.mr; }, get replaying() { return RP.on; } };
})();

