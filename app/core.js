/* ================= HelixBoard — core: utilities, storage, icons, sound, loaders, safe maths ================= */
(() => {
'use strict';
const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v)), lerp = (a, b, t) => a + (b - a) * t;
const REDUCE = !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
const uid = () => Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4);
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const icon = (n, cls) => { const p = (window.ICONS || {})[n]; return '<svg class="ic ' + (cls || '') + '" viewBox="0 0 24 24" aria-hidden="true">' + (p || '<circle cx="12" cy="12" r="8"/>') + '</svg>'; };

/* ---------- small settings in localStorage; boards and images in IndexedDB ---------- */
const set = { get(k, d) { try { const v = localStorage.getItem('hb:' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } }, put(k, v) { try { localStorage.setItem('hb:' + k, JSON.stringify(v)); } catch (e) {} } };
const IDB = (() => { let dbp = null;
  const open = () => dbp || (dbp = new Promise((res, rej) => { if (!window.indexedDB) return rej(new Error('no idb')); const r = indexedDB.open('helixboard', 1); r.onupgradeneeded = () => { const d = r.result; d.createObjectStore('kv'); d.createObjectStore('versions', { keyPath: 'id', autoIncrement: true }); }; r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); }));
  const tx = async (store, mode, fn) => { const d = await open(); return new Promise((res, rej) => { const t = d.transaction(store, mode), s = t.objectStore(store); const out = fn(s); t.oncomplete = () => res(out instanceof IDBRequest ? out.result : out); t.onerror = () => rej(t.error); }); };
  return {
    get: k => tx('kv', 'readonly', s => s.get(k)).catch(() => undefined),
    put: (k, v) => tx('kv', 'readwrite', s => s.put(v, k)).catch(e => { console.warn('save failed', e); }),
    addVersion: async v => { try { await tx('versions', 'readwrite', s => s.add(v)); const all = await tx('versions', 'readonly', s => s.getAllKeys()); if (all.length > 20) await tx('versions', 'readwrite', s => { all.slice(0, all.length - 20).forEach(k => s.delete(k)); }); } catch (e) {} },
    versions: () => tx('versions', 'readonly', s => s.getAll()).catch(() => []),
    version: id => tx('versions', 'readonly', s => s.get(id)).catch(() => null) };
})();

/* ---------- tiny event bus ---------- */
const bus = { m: {}, on(e, f) { (this.m[e] = this.m[e] || []).push(f); }, emit(e, d) { (this.m[e] || []).forEach(f => { try { f(d); } catch (er) { console.error(er); } }); } };

/* ---------- toast, modal, floating panels ---------- */
let toastT = 0; const toast = (msg, ms) => { const t = $('#toast'); t.innerHTML = msg; t.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => t.hidden = true, ms || 2600); };
const modal = { open(html, onBind) { $('#sheet').innerHTML = '<button class="btn sm close" data-close>Close ✕</button>' + html; $('#modal').hidden = false; $$('#sheet [data-close]').forEach(b => b.onclick = () => modal.close()); onBind && onBind($('#sheet')); }, close() { $('#modal').hidden = true; /* cleared on the next tick so OK handlers can still read their fields after closing */ setTimeout(() => { if ($('#modal').hidden) $('#sheet').innerHTML = ''; }, 0); bus.emit('modal-close'); }, get isOpen() { return !$('#modal').hidden; } };
/* the board's own yes/no dialog — browser confirm() is silently blocked in many embedded viewers and kiosk browsers */
function ask(msg, ok, cb, title) { modal.open('<h2>' + (title || 'Are you sure?') + '</h2><p>' + msg + '</p><div class="foot"><button class="btn" id="askN">Cancel</button><button class="btn primary" id="askY">' + (ok || 'Yes') + '</button></div>', sh => { sh.querySelector('#askN').onclick = () => modal.close(); sh.querySelector('#askY').onclick = () => { modal.close(); cb(); }; setTimeout(() => sh.querySelector('#askY').focus(), 30); }); }
$('#modal').addEventListener('pointerdown', e => { if (e.target.id === 'modal') modal.close(); });
const floats = {};
function floatPanel(id, title, html, opts) { opts = opts || {}; const front = el => { Object.values(floats).forEach(f => { if (f.el !== el) f.el.style.zIndex = 30; }); el.style.zIndex = 40; };
  if (floats[id]) { floats[id].el.hidden = false; front(floats[id].el); return floats[id]; }
  const el = document.createElement('div'); el.className = 'float'; el.id = 'fl-' + id; el.innerHTML = '<div class="fh">' + (opts.icon ? icon(opts.icon) : '') + '<span>' + title + '</span><span class="sp"></span>' + (opts.extra || '') + '<button class="ib" data-x aria-label="Close" style="min-width:30px;height:30px">' + icon('x') + '</button></div><div class="fb">' + html + '</div>';
  const nOpen = Object.values(floats).filter(f => !f.el.hidden).length, cols = Math.max(1, Math.floor((innerWidth - 100) / 330)); el.style.left = (opts.x != null ? opts.x : Math.min(innerWidth - 340, 84 + (nOpen % cols) * 330)) + 'px'; el.style.top = (opts.y != null ? opts.y : 140 + Math.floor(nOpen / cols) * 36 + (nOpen % 2) * 12) + 'px'; if (opts.w) el.style.width = opts.w + 'px';
  $('#floats').appendChild(el); front(el); const h = el.querySelector('.fh'); let d = null;
  h.addEventListener('pointerdown', e => { if (e.target.closest('button,select,input')) return; d = { x: e.clientX - el.offsetLeft, y: e.clientY - el.offsetTop }; h.setPointerCapture(e.pointerId); });
  h.addEventListener('pointermove', e => { if (!d) return; el.style.left = clamp(e.clientX - d.x, 0, innerWidth - 80) + 'px'; el.style.top = clamp(e.clientY - d.y, 0, innerHeight - 40) + 'px'; });
  h.addEventListener('pointerup', () => d = null);
  el.addEventListener('pointerdown', () => { el.style.zIndex = 40; Object.values(floats).forEach(f => { if (f.el !== el) f.el.style.zIndex = 30; }); });
  const f = { el, body: el.querySelector('.fb'), close() { el.hidden = true; opts.onClose && opts.onClose(); }, destroy() { el.remove(); delete floats[id]; opts.onClose && opts.onClose(); } };
  el.querySelector('[data-x]').onclick = () => opts.keep ? f.close() : f.destroy(); floats[id] = f; if (window.gsap && !REDUCE) gsap.from(el, { scale: 0.92, opacity: 0, duration: 0.25, ease: 'power2.out' }); return f; }

/* ---------- library loader (pinned versions; loaded the first time they are needed) ---------- */
const CDN = window.HB_CDN || 'https://cdn.jsdelivr.net/npm/';
const LIBS = { rough: ['roughjs@4.6.6/bundled/rough.js', 'rough'], smiles: ['smiles-drawer@2.4.1/dist/smiles-drawer.min.js', 'SmilesDrawer'], chart: ['chart.js@4.5.1/dist/chart.umd.min.js', 'Chart'], jspdf: ['jspdf@4.2.1/dist/jspdf.umd.min.js', 'jspdf'], tesseract: ['tesseract.js@7.0.0/dist/tesseract.min.js', 'Tesseract'], katex: ['katex@0.19.0/dist/katex.min.js', 'katex'], mammoth: ['mammoth@1.8.0/mammoth.browser.min.js', 'mammoth'], pptx: ['pptx-preview@1.0.7/dist/pptx-preview.umd.js', 'pptxPreview'] };
const loading = {}; const libURL = p => CDN + (window.HB_STRIPV ? p.replace(/@[\d.]+/, '') : p);
function need(name) { if (loading[name]) return loading[name]; const [path, glob] = LIBS[name];
  return loading[name] = new Promise((res, rej) => { if (window[glob]) return res(window[glob]); const s = document.createElement('script'); const emb = document.getElementById('hblib-' + name); s.src = emb ? URL.createObjectURL(new Blob([emb.textContent], { type: 'text/javascript' })) : libURL(path); const fail = () => { clearTimeout(to); loading[name] = null; rej(new Error('Could not load ' + name + ' — this part needs the internet the first time (the school network may be blocking cdn.jsdelivr.net).')); }; const to = setTimeout(fail, 20000); s.onload = () => { clearTimeout(to); window[glob] ? res(window[glob]) : rej(new Error(name + ' did not load')); }; s.onerror = fail; document.head.appendChild(s); }); }
const needESM = (spec) => Promise.race([import(/* @vite-ignore */ libURL(spec)), new Promise((_, rej) => setTimeout(() => rej(new Error('Could not load ' + spec.split('@')[0] + ' — this part needs the internet the first time (the school network may be blocking cdn.jsdelivr.net).')), 30000))]);

/* ---------- fonts: loaded only when chosen ---------- */
const FONTS = { 'Caveat': 'hand', 'Patrick Hand': 'hand', 'Kalam': 'hand', 'Gochi Hand': 'hand', 'Shadows Into Light': 'hand', 'Architects Daughter': 'hand', 'Permanent Marker': 'hand', 'Lexend': 'clean', 'Atkinson Hyperlegible': 'clean', 'Space Grotesk': 'clean', 'Fraunces': 'clean', 'JetBrains Mono': 'clean', 'Readex Pro': 'arabic', 'Noto Kufi Arabic': 'arabic', 'Cairo': 'arabic', 'Tajawal': 'arabic', 'Amiri': 'arabic', 'Aref Ruqaa': 'arabic', 'Marhey': 'arabic', 'Playpen Sans Arabic': 'arabic' };
const fontLoaded = { 'Caveat': true, 'Lexend': true, 'Space Grotesk': true, 'JetBrains Mono': true };
function loadFont(f, previewText) { if (!f || fontLoaded[f]) return Promise.resolve(); const id = 'gf-' + f.replace(/\s/g, '') + (previewText ? '-p' : '');
  if (!document.getElementById(id)) { const l = document.createElement('link'); l.id = id; l.rel = 'stylesheet'; l.href = 'https://fonts.googleapis.com/css2?family=' + f.replace(/ /g, '+') + (previewText ? '&text=' + encodeURIComponent(previewText) : ':wght@400;700') + '&display=swap'; document.head.appendChild(l); }
  if (previewText) return Promise.resolve();
  return (document.fonts ? document.fonts.load('24px "' + f + '"').then(() => { fontLoaded[f] = true; bus.emit('font-loaded', f); }) : Promise.resolve()).catch(() => {}); }
const fontStack = f => '"' + f + '",' + (FONTS[f] === 'arabic' ? '"Noto Kufi Arabic","Segoe UI",Tahoma,sans-serif' : FONTS[f] === 'hand' ? '"Caveat","Comic Sans MS",cursive' : 'system-ui,sans-serif');

/* ---------- Unicode sub/superscripts (keeps text plain and exportable) ---------- */
const SUB = { '0': '₀', '1': '₁', '2': '₂', '3': '₃', '4': '₄', '5': '₅', '6': '₆', '7': '₇', '8': '₈', '9': '₉', '+': '₊', '-': '₋', '=': '₌', '(': '₍', ')': '₎', 'a': 'ₐ', 'e': 'ₑ', 'o': 'ₒ', 'x': 'ₓ', 'h': 'ₕ', 'k': 'ₖ', 'l': 'ₗ', 'm': 'ₘ', 'n': 'ₙ', 'p': 'ₚ', 's': 'ₛ', 't': 'ₜ', 'i': 'ᵢ', 'r': 'ᵣ', 'u': 'ᵤ', 'v': 'ᵥ' };
const SUP = { '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹', '+': '⁺', '-': '⁻', '=': '⁼', '(': '⁽', ')': '⁾', 'n': 'ⁿ', 'i': 'ⁱ', 'a': 'ᵃ', 'b': 'ᵇ', 'c': 'ᶜ', 'd': 'ᵈ', 'e': 'ᵉ', 'h': 'ʰ', 'H': 'ᴴ', 'A': 'ᴬ', 'B': 'ᴮ', 'D': 'ᴰ', 'G': 'ᴳ', 'R': 'ᴿ', 'T': 'ᵀ', 'k': 'ᵏ', 'm': 'ᵐ', 'o': 'ᵒ', 'p': 'ᵖ', 'r': 'ʳ', 's': 'ˢ', 't': 'ᵗ', 'x': 'ˣ', 'y': 'ʸ' };
const toSub = s => [...s].map(c => SUB[c] || c).join(''), toSup = s => [...s].map(c => SUP[c] || c).join('');
const RSUB = Object.fromEntries(Object.entries(SUB).map(([a, b]) => [b, a])), RSUP = Object.fromEntries(Object.entries(SUP).map(([a, b]) => [b, a]));
const unSubSup = s => [...s].map(c => RSUB[c] || RSUP[c] || c).join('');

/* ---------- bidi: isolate LTR runs (numbers, Latin, formulas) inside Arabic paragraphs ---------- */
const RTL_RE = /[֐-ࣿיִ-﷿ﹰ-﻿]/;
const isRTL = s => { for (const ch of s) { if (RTL_RE.test(ch)) return true; if (/[A-Za-z]/.test(ch)) return false; } return false; };
const isolate = s => isRTL(s) ? s.replace(/([A-Za-z0-9⁰-₟°±²³¹.,:;%+\-–—×÷=→⇌↑↓()[\]/^°µ ]*[A-Za-z0-9⁰-₟][A-Za-z0-9⁰-₟°²³¹.,:;%+\-–—×÷=→⇌↑↓()[\]/^°µ ]*)/g, m => { const t = m.replace(/^\s+|\s+$/g, ''); if (!t) return m; const a = m.indexOf(t); return m.slice(0, a) + '⁦' + t + '⁩' + m.slice(a + t.length); }) : s;

/* ---------- safe expression parser (no eval): used by the calculator and the graph plotter ---------- */
const MathP = (() => {
  const FN = { sin: 1, cos: 1, tan: 1, asin: 1, acos: 1, atan: 1, sinh: 1, cosh: 1, tanh: 1, ln: 1, log: 1, log2: 1, exp: 1, sqrt: 1, cbrt: 1, abs: 1, floor: 1, ceil: 1, round: 1, fact: 1, sign: 1 };
  const CONST = { pi: Math.PI, 'π': Math.PI, e: Math.E };
  function tokenize(s) { s = s.replace(/×/g, '*').replace(/÷/g, '/').replace(/−/g, '-').replace(/√/g, 'sqrt').replace(/∛/g, 'cbrt').replace(/π/g, ' pi ').replace(/²/g, '^2').replace(/³/g, '^3').replace(/\*\*/g, '^');
    const t = []; let i = 0; while (i < s.length) { const c = s[i];
      if (/\s/.test(c)) { i++; continue; }
      if (/[0-9.]/.test(c)) { let j = i; while (j < s.length && /[0-9.]/.test(s[j])) j++; if (s[j] === 'E' || (s[j] === 'e' && /[0-9+\-]/.test(s[j + 1] || '') && !/[a-z]/i.test(s[j + 1] || ''))) { let k = j + 1; if (s[k] === '+' || s[k] === '-') k++; if (/[0-9]/.test(s[k] || '')) { j = k; while (j < s.length && /[0-9]/.test(s[j])) j++; } } t.push({ k: 'n', v: parseFloat(s.slice(i, j)) }); i = j; continue; }
      if (/[a-zA-Z_]/.test(c)) { let j = i; while (j < s.length && /[a-zA-Z_0-9]/.test(s[j])) j++; t.push({ k: 'id', v: s.slice(i, j) }); i = j; continue; }
      if ('+-*/^(),!%'.includes(c)) { t.push({ k: 'op', v: c }); i++; continue; }
      throw new Error('Unexpected “' + c + '”'); }
    /* implicit multiplication: 2x, 2(…), )(…), x(…) → insert * */
    const out = []; for (let k = 0; k < t.length; k++) { const a = out[out.length - 1], b = t[k]; if (a && ((a.k === 'n' || (a.k === 'id' && !FN[a.v]) || (a.k === 'op' && (a.v === ')' || a.v === '!' || a.v === '%'))) && (b.k === 'n' || b.k === 'id' || (b.k === 'op' && b.v === '(')))) out.push({ k: 'op', v: '*' }); out.push(b); } return out; }
  function parse(src) { const t = tokenize(src); let p = 0; const peek = () => t[p], eat = v => { const x = t[p]; if (!x || (v && x.v !== v)) throw new Error(v ? 'Expected “' + v + '”' : 'Unexpected end'); p++; return x; };
    const expr = () => { let n = term(); while (peek() && (peek().v === '+' || peek().v === '-')) { const o = eat().v; n = { o, a: n, b: term() }; } return n; };
    const term = () => { let n = unary(); while (peek() && (peek().v === '*' || peek().v === '/')) { const o = eat().v; n = { o, a: n, b: unary() }; } return n; };
    const unary = () => { if (peek() && peek().v === '-') { eat(); return { o: 'neg', a: unary() }; } if (peek() && peek().v === '+') { eat(); return unary(); } return power(); };
    const power = () => { const b = postfix(); if (peek() && peek().v === '^') { eat(); return { o: '^', a: b, b: unary() }; } return b; };
    const postfix = () => { let n = atom(); while (peek() && (peek().v === '!' || peek().v === '%')) { const o = eat().v; n = { o: o === '!' ? 'fact' : 'pct', a: n }; } return n; };
    const atom = () => { const x = peek(); if (!x) throw new Error('Unexpected end');
      if (x.k === 'n') { p++; return { n: x.v }; }
      if (x.k === 'op' && x.v === '(') { eat('('); const n = expr(); eat(')'); return n; }
      if (x.k === 'id') { p++; if (FN[x.v]) { if (peek() && peek().v === '(') { eat('('); const a = expr(); eat(')'); return { f: x.v, a }; } return { f: x.v, a: power() }; } return { id: x.v }; }
      throw new Error('Unexpected “' + x.v + '”'); };
    const n = expr(); if (p < t.length) throw new Error('Unexpected “' + t[p].v + '”'); return n; }
  const fact = n => { if (n < 0 || !Number.isInteger(n)) { return gamma(n + 1); } if (n > 170) return Infinity; let r = 1; for (let i = 2; i <= n; i++) r *= i; return r; };
  const gamma = z => { if (z < 0.5) return Math.PI / (Math.sin(Math.PI * z) * gamma(1 - z)); z -= 1; const g = 7, c = [0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313, -176.61502916214059, 12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7]; let x = c[0]; for (let i = 1; i < g + 2; i++) x += c[i] / (z + i); const t = z + g + 0.5; return Math.sqrt(2 * Math.PI) * Math.pow(t, z + 0.5) * Math.exp(-t) * x; };
  function ev(n, env) { if ('n' in n) return n.n; if ('id' in n) { if (n.id in env) return env[n.id]; if (n.id in CONST) return CONST[n.id]; throw new Error('Unknown name “' + n.id + '”'); }
    const deg = env.__deg; const tr = v => deg ? v * Math.PI / 180 : v, itr = v => deg ? v * 180 / Math.PI : v;
    if (n.f) { const a = ev(n.a, env); switch (n.f) { case 'sin': return Math.sin(tr(a)); case 'cos': return Math.cos(tr(a)); case 'tan': return Math.tan(tr(a)); case 'asin': return itr(Math.asin(a)); case 'acos': return itr(Math.acos(a)); case 'atan': return itr(Math.atan(a)); case 'sinh': return Math.sinh(a); case 'cosh': return Math.cosh(a); case 'tanh': return Math.tanh(a); case 'ln': return Math.log(a); case 'log': return Math.log10(a); case 'log2': return Math.log2(a); case 'exp': return Math.exp(a); case 'sqrt': return Math.sqrt(a); case 'cbrt': return Math.cbrt(a); case 'abs': return Math.abs(a); case 'floor': return Math.floor(a); case 'ceil': return Math.ceil(a); case 'round': return Math.round(a); case 'fact': return fact(a); case 'sign': return Math.sign(a); } }
    const a = ev(n.a, env); switch (n.o) { case 'neg': return -a; case 'fact': return fact(a); case 'pct': return a / 100; }
    const b = ev(n.b, env); switch (n.o) { case '+': return a + b; case '-': return a - b; case '*': return a * b; case '/': return a / b; case '^': return Math.pow(a, b); }
    throw new Error('Bad expression'); }
  const compile = src => { const ast = parse(src); return env => ev(ast, env || {}); };
  return { parse, compile, eval: (src, env) => ev(parse(src), env || {}), fact };
})();
const fmtNum = (v, sig) => { if (!isFinite(v)) return isNaN(v) ? 'Error' : (v > 0 ? '∞' : '−∞'); if (v === 0) return '0'; const a = Math.abs(v); if (a >= 1e10 || a < 1e-6) { const s = v.toExponential((sig || 10) - 1).replace(/\.?0+e/, 'e'); const [m, e] = s.split('e'); return m + ' × 10' + toSup(String(+e)); } return String(+v.toPrecision(sig || 12)); };

/* ---------- Web Audio sound engine: everything synthesised, nothing downloaded ---------- */
const SND = (() => {
  /* All sounds are synthesised. Graph: sources → category gain → master → compressor → speakers (+ recorder tap + level meter). */
  let ac = null, master = null, comp = null, an = null, noiseBuf = null, grainBuf = null, recDest = null; let vol = set.get('vol', 0.6), muted = set.get('mute', false), pack = set.get('pack', 'pencil');
  const cats = Object.assign({ write: true, ui: true, alert: true }, set.get('sndCats', {}));
  const build = () => { ac = new (window.AudioContext || window.webkitAudioContext)({ latencyHint: 'interactive' }); master = ac.createGain(); master.gain.value = muted ? 0 : vol; comp = ac.createDynamicsCompressor(); comp.threshold.value = -16; comp.knee.value = 10; comp.ratio.value = 4; comp.attack.value = 0.003; comp.release.value = 0.15; an = ac.createAnalyser(); an.fftSize = 1024; master.connect(comp); comp.connect(ac.destination); comp.connect(an);
    /* pink noise (Paul Kellet filter): warmer than white noise, closer to graphite on paper */
    const n = ac.sampleRate * 3; noiseBuf = ac.createBuffer(1, n, ac.sampleRate); const d = noiseBuf.getChannelData(0); let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0; for (let i = 0; i < n; i++) { const w = Math.random() * 2 - 1; b0 = 0.99886 * b0 + w * 0.0555179; b1 = 0.99332 * b1 + w * 0.0750759; b2 = 0.969 * b2 + w * 0.153852; b3 = 0.8665 * b3 + w * 0.3104856; b4 = 0.55 * b4 + w * 0.5329522; b5 = -0.7616 * b5 - w * 0.016898; d[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11; b6 = w * 0.115926; }
    /* paper "grain": a slowly varying random envelope, so the scratch flutters like real paper texture */
    const m = ac.sampleRate * 2; grainBuf = ac.createBuffer(1, m, ac.sampleRate); const q = grainBuf.getChannelData(0); let cur = 0.7, tgt = 0.7, k = 0; for (let i = 0; i < m; i++) { if (--k <= 0) { k = Math.round(ac.sampleRate * (0.006 + Math.random() * 0.02)); tgt = 0.35 + Math.random() * 0.65 + (Math.random() < 0.06 ? 0.6 : 0); } cur += (tgt - cur) * 0.004; q[i] = cur; } };
  const ctx = () => { try { if (!ac) build(); if (ac.state === 'suspended') ac.resume().catch(() => {}); } catch (e) { return null; } return ac; };
  /* Browsers only allow audio after a real gesture. On touch screens and smartboards 'pointerdown' does not count, so listen to every gesture type, every time, until audio is running. */
  const wake = () => { const c = ctx(); if (c && c.state === 'running') ['pointerup', 'touchend', 'click', 'keydown'].forEach(t => window.removeEventListener(t, wake, true)); };
  ['pointerup', 'touchend', 'click', 'keydown'].forEach(t => window.addEventListener(t, wake, true)); document.addEventListener('visibilitychange', () => { if (!document.hidden && ac && ac.state !== 'running') ac.resume().catch(() => {}); });
  const live = () => !!ac && ac.state === 'running' && !muted;
  const ok = cat => live() && cats[cat] !== false;
  const out = cat => master; /* single bus; category on/off is checked when a sound starts */
  const tone = (f0, f1, dur, type, v, delay, cat) => { if (!ok(cat || 'ui')) return; const c = ac, t = c.currentTime + (delay || 0), o = c.createOscillator(), g = c.createGain(); o.type = type || 'sine'; o.frequency.setValueAtTime(f0, t); if (f1) o.frequency.exponentialRampToValueAtTime(f1, t + dur); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v || 0.1, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur); o.connect(g); g.connect(out()); o.start(t); o.stop(t + dur + 0.05); };
  const burst = (dur, v, f, q, delay, cat, type) => { if (!ok(cat || 'ui')) return; const c = ac, t = c.currentTime + (delay || 0), s = c.createBufferSource(); s.buffer = noiseBuf; const fl = c.createBiquadFilter(); fl.type = type || 'bandpass'; fl.frequency.value = f || 1200; fl.Q.value = q || 1; const g = c.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v || 0.1, t + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, t + dur); s.connect(fl); fl.connect(g); g.connect(out()); s.start(t, Math.random() * 2); s.stop(t + dur + 0.03); };
  /* ---------- writing sounds ----------
     Real pen-on-paper sound is a fast train of tiny scratches, not a steady hiss. Each pack is pre-rendered once into a short
     "friction texture" made of thousands of filtered micro-grains (size, colour and density differ per tool), then played at a
     speed and loudness that follow the pen. Result: textured scratching that stops the moment the pen stops. */
  const PACK = {
    pencil:   { rate: 1100, len: [0.0006, 0.0022], f: 3600, q: 0.9, bed: 0.06, grit: 0.02, v: 0.95, hp: 900, lp: 8000 },
    chalk:    { rate: 520,  len: [0.0015, 0.0055], f: 1700, q: 0.7, bed: 0.10, grit: 0.10, v: 0.6, hp: 350, lp: 5200, skip: 1 },
    marker:   { rate: 260,  len: [0.004, 0.011],   f: 1150, q: 0.8, bed: 0.30, grit: 0,    v: 0.42, hp: 250, lp: 3800, squeak: 1 },
    ballpoint:{ rate: 650,  len: [0.0008, 0.0025], f: 2300, q: 1.0, bed: 0.16, grit: 0.01, v: 0.8, hp: 300, lp: 6000, roll: 1 },
    fountain: { rate: 1400, len: [0.0004, 0.0014], f: 5200, q: 1.3, bed: 0.03, grit: 0.03, v: 1.0, hp: 1600, lp: 11000 },
    silent: null };
  const texCache = {};
  /* simple biquad band-pass applied in JS while rendering */
  function bandpass(d, sr, f, q) { const w = 2 * Math.PI * f / sr, al = Math.sin(w) / (2 * q), b0 = al, b2 = -al, a0 = 1 + al, a1 = -2 * Math.cos(w), a2 = 1 - al; let x1 = 0, x2 = 0, y1 = 0, y2 = 0; for (let n = 0; n < d.length; n++) { const x = d[n], y = (b0 * x + b2 * x2 - a1 * y1 - a2 * y2) / a0; x2 = x1; x1 = x; y2 = y1; y1 = y; d[n] = y; } }
  function texture(kind) { if (texCache[kind]) return texCache[kind]; const P = PACK[kind], sr = ac.sampleRate, N = Math.round(sr * 2.4), d = new Float32Array(N); let seed = 1234567 + kind.length * 7919; const R = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    /* grains */ let t = 0; while (t < N) { t += Math.max(1, Math.round(-Math.log(1 - R()) * sr / P.rate)); const L = Math.round(sr * (P.len[0] + R() * (P.len[1] - P.len[0]))), amp = 0.3 + R() * 0.7 * (R() < 0.08 ? 2.2 : 1); for (let k = 0; k < L && t + k < N; k++) { const env = Math.exp(-5 * k / L) * (k < 8 ? k / 8 : 1); d[t + k] += (R() * 2 - 1) * amp * env; } }
    /* chalk "skips": short gritty bursts as the stick catches the board */ if (P.skip) for (let b = 0; b < 26; b++) { const st0 = Math.floor(R() * (N - sr * 0.03)), L = Math.round(sr * (0.006 + R() * 0.02)); for (let k = 0; k < L; k++) d[st0 + k] += (R() * 2 - 1) * 1.6 * Math.sin(Math.PI * k / L) * (R() < 0.5 ? 1 : 0.3); }
    bandpass(d, sr, P.f, P.q); bandpass(d, sr, P.f * 1.05, P.q * 1.2);
    /* soft bed of paper friction + a low roll for ballpoints */ let lp = 0, lp2 = 0; for (let n = 0; n < N; n++) { const w = R() * 2 - 1; lp += (w - lp) * 0.08; lp2 += (w - lp2) * 0.012; d[n] += lp * P.bed * 3 + (P.roll ? lp2 * 0.9 : 0) + (R() < P.grit * 0.02 ? (R() * 2 - 1) * 0.8 : 0); }
    let mx = 0; for (let n = 0; n < N; n++) mx = Math.max(mx, Math.abs(d[n])); for (let n = 0; n < N; n++) d[n] /= (mx || 1);
    /* cross-fade the ends so the loop is seamless */ const F = Math.round(sr * 0.05); for (let k = 0; k < F; k++) { const a = k / F; d[k] = d[k] * a + d[N - F + k] * (1 - a); } const out = d.subarray(0, N - F);
    const buf = ac.createBuffer(1, out.length, sr); buf.copyToChannel(out, 0); return texCache[kind] = buf; }
  let wr = null, pend = null;
  const writeStart = kind => { writeStop(); ctx(); if (ac && ac.state !== 'running' && !muted) { pend = { kind }; ac.resume().then(() => { if (pend && pend.kind === kind) { pend = null; writeStart(kind); } }).catch(() => {}); return; } if (!ok('write')) return;
    const name = kind === 'chalk' ? 'chalk' : (PACK[kind] ? kind : pack); const P = PACK[name]; if (!P) return; const c = ac, t = c.currentTime;
    const s = c.createBufferSource(); s.buffer = texture(name); s.loop = true; const hp = c.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = P.hp; hp.Q.value = 0.5; const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = P.lp; lp.Q.value = 0.4;
    const env = c.createGain(); env.gain.value = 0; s.connect(hp); hp.connect(lp); lp.connect(env); env.connect(out()); s.start(t, Math.random() * 2); wr = { s, env, lp, P, name, lastDir: null, last: 0 };
    tone(P.f * 0.6, 0, 0.012, 'triangle', 0.008 * P.v, 0, 'write'); /* the soft tap as the tip touches down */ };
  const writeMove = (speed, dir) => { if (!wr || !ac) return; const c = ac, t = c.currentTime, P = wr.P, sp = Math.max(0, speed || 0);
    const target = Math.pow(clamp(sp / 1.3, 0, 1), 0.6) * P.v * 0.5; const g = wr.env.gain; g.cancelScheduledValues(t); g.setTargetAtTime(target, t, 0.015); g.setTargetAtTime(0, t + 0.06, 0.03);
    wr.s.playbackRate.setTargetAtTime(clamp(0.7 + sp * 0.45, 0.6, 1.5), t, 0.04); wr.lp.frequency.setTargetAtTime(P.lp * clamp(0.75 + sp * 0.2, 0.75, 1.15), t, 0.05);
    if (P.squeak && dir != null && wr.lastDir != null && sp > 0.4) { let d = Math.abs(dir - wr.lastDir); if (d > Math.PI) d = 2 * Math.PI - d; if (d > 1.6 && t - wr.last > 0.2) { const f = 1400 + Math.random() * 500; tone(f, f * 1.18, 0.07, 'sine', 0.012, 0, 'write'); wr.last = t; } } wr.lastDir = dir; };
  const writeStop = () => { pend = null; if (!wr) return; const w = wr; wr = null; try { const t = ac.currentTime; w.env.gain.cancelScheduledValues(t); w.env.gain.setTargetAtTime(0, t, 0.02); w.s.stop(t + 0.15); } catch (e) {} };
  /* ---------- start-up sound: an original warm "boot" chime — slow pad swell, shimmering bell arpeggio, deep reverb ---------- */
  let verb = null;
  const reverb = () => { if (verb) return verb; const c = ac, L = Math.round(c.sampleRate * 3.2), ir = c.createBuffer(2, L, c.sampleRate); for (let ch = 0; ch < 2; ch++) { const d = ir.getChannelData(ch); for (let n = 0; n < L; n++) d[n] = (Math.random() * 2 - 1) * Math.pow(1 - n / L, 3.2); } const cv = c.createConvolver(); cv.buffer = ir; const wet = c.createGain(); wet.gain.value = 0.55; cv.connect(wet); wet.connect(master); return verb = cv; };
  const startup = () => { const c = ctx(); if (!c || muted || cats.alert === false) return false; if (c.state !== 'running') { c.resume().then(() => { if (c.state === 'running') startup(); }).catch(() => {}); return false; } const t0 = c.currentTime + 0.05, rv = reverb(); const bus = c.createGain(); bus.gain.value = 0.9; bus.connect(master); bus.connect(rv);
    /* pad: detuned saw voices through an opening low-pass — Cmaj9 rising to Fmaj7(#11) to C */ const pad = (freqs, at, dur, peak) => { const lpf = c.createBiquadFilter(); lpf.type = 'lowpass'; lpf.Q.value = 0.7; lpf.frequency.setValueAtTime(300, at); lpf.frequency.exponentialRampToValueAtTime(2600, at + dur * 0.55); lpf.frequency.exponentialRampToValueAtTime(900, at + dur); const g = c.createGain(); g.gain.setValueAtTime(0.0001, at); g.gain.exponentialRampToValueAtTime(peak, at + dur * 0.35); g.gain.exponentialRampToValueAtTime(0.0001, at + dur); lpf.connect(g); g.connect(bus);
      freqs.forEach(f => [-7, 0, 7].forEach(dt => { const o = c.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f; o.detune.value = dt; const og = c.createGain(); og.gain.value = 0.05; o.connect(og); og.connect(lpf); o.start(at); o.stop(at + dur + 0.1); })); };
    pad([130.81, 196.0, 246.94, 293.66, 329.63], t0, 2.6, 0.32); pad([174.61, 220.0, 261.63, 329.63, 493.88], t0 + 1.25, 2.4, 0.26); pad([130.81, 196.0, 261.63, 329.63, 392.0], t0 + 2.35, 3.2, 0.3);
    /* bell arpeggio: sine + inharmonic partial, like glass */ const bell = (f, at, v) => [[1, 1], [2.76, 0.35], [5.4, 0.12]].forEach(([m, a]) => { const o = c.createOscillator(); o.type = 'sine'; o.frequency.value = f * m; const g = c.createGain(); g.gain.setValueAtTime(0.0001, at); g.gain.exponentialRampToValueAtTime(v * a, at + 0.008); g.gain.exponentialRampToValueAtTime(0.0001, at + 1.8 / m + 0.4); o.connect(g); g.connect(bus); o.start(at); o.stop(at + 2.6); });
    [523.25, 659.25, 783.99, 987.77, 1174.66, 1318.51].forEach((f, k) => bell(f, t0 + 0.35 + k * 0.17, 0.07)); [1046.5, 1567.98, 2093.0].forEach((f, k) => bell(f, t0 + 2.45 + k * 0.09, 0.05));
    /* low "thrum" for body */ const sub = c.createOscillator(); sub.type = 'sine'; sub.frequency.value = 65.41; const sg = c.createGain(); sg.gain.setValueAtTime(0.0001, t0); sg.gain.exponentialRampToValueAtTime(0.14, t0 + 0.8); sg.gain.exponentialRampToValueAtTime(0.0001, t0 + 5); sub.connect(sg); sg.connect(bus); sub.start(t0); sub.stop(t0 + 5.2);
    /* airy shimmer */ const ns = c.createBufferSource(); ns.buffer = noiseBuf; const hpn = c.createBiquadFilter(); hpn.type = 'highpass'; hpn.frequency.value = 6000; const ng = c.createGain(); ng.gain.setValueAtTime(0.0001, t0); ng.gain.exponentialRampToValueAtTime(0.04, t0 + 2.4); ng.gain.exponentialRampToValueAtTime(0.0001, t0 + 4.6); ns.connect(hpn); hpn.connect(ng); ng.connect(rv); ns.start(t0); ns.stop(t0 + 4.8);
    return true; };
  const level = () => { if (!an) return 0; const a = new Float32Array(an.fftSize); an.getFloatTimeDomainData(a); let s = 0; for (const v of a) s += v * v; return Math.sqrt(s / a.length); };
  const api = { unlock: () => ctx(), wake, startup, writeStart, writeMove, writeStop, tone, burst, level, PACKS: Object.keys(PACK), texture: k => (ctx(), texture(k)),
    get state() { return ac ? ac.state : 'not started'; },
    get vol() { return vol; }, set vol(v) { vol = v; set.put('vol', v); if (master) master.gain.setTargetAtTime(muted ? 0 : v, ac.currentTime, 0.02); },
    get muted() { return muted; }, set muted(m) { muted = m; set.put('mute', m); if (m) writeStop(); if (master) master.gain.setTargetAtTime(m ? 0 : vol, ac.currentTime, 0.02); bus.emit('sound', m); },
    get pack() { return pack; }, set pack(p) { pack = p; set.put('pack', p); },
    cat(k, on) { if (on === undefined) return cats[k] !== false; cats[k] = !!on; set.put('sndCats', cats); if (k === 'write' && !on) writeStop(); },
    stream() { const c = ctx(); if (!c) return null; if (!recDest) { recDest = c.createMediaStreamDestination(); comp.connect(recDest); } return recDest.stream; },
    /* interface sounds: short, soft and low enough not to tire a class */
    erase: () => burst(0.12, 0.09, 700, 0.7, 0, 'write'),
    key: k => { const r = Math.random(); if (k === ' ') { burst(0.04, 0.12, 420, 1.1); tone(140, 90, 0.05, 'sine', 0.06); } else if (k === 'Enter') { burst(0.035, 0.1, 1000, 1.8); tone(1320, 0, 0.18, 'sine', 0.035, 0.02); } else if (k === 'Backspace') { burst(0.03, 0.1, 1500, 2.5); } else { burst(0.018, 0.1 + r * 0.04, 2200 + r * 1200, 2.5); tone(700 + r * 200, 0, 0.025, 'triangle', 0.012); } },
    zip: () => { burst(0.09, 0.05, 2400, 1.6); tone(620, 1100, 0.09, 'sine', 0.025); },
    pop: () => { tone(380, 760, 0.07, 'sine', 0.09); burst(0.025, 0.04, 2200, 2); },
    slap: () => { burst(0.05, 0.14, 650, 0.7); tone(170, 95, 0.07, 'sine', 0.07); },
    page: () => { burst(0.28, 0.07, 1600, 0.5); burst(0.12, 0.05, 3400, 0.9, 0.12); },
    tick: () => { burst(0.01, 0.12, 3600, 5); tone(2400, 0, 0.012, 'square', 0.01); },
    whoosh: () => burst(0.35, 0.06, 900, 0.5),
    chime: () => [784, 988, 1175, 1568].forEach((f, i) => tone(f, 0, 0.9, 'sine', 0.06, i * 0.13, 'alert')),
    good: () => [660, 880].forEach((f, i) => tone(f, 0, 0.25, 'sine', 0.06, i * 0.09, 'alert')),
    bad: () => tone(240, 150, 0.28, 'triangle', 0.06, 0, 'alert'),
    done: () => [523, 659, 784, 1047].forEach((f, i) => tone(f, 0, 0.6, 'sine', 0.055, i * 0.11, 'alert')),
    fanfare: () => { [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, 0, 0.5, 'triangle', 0.05, i * 0.09, 'alert')); [1047, 1319, 1568].forEach(f => tone(f, 0, 1.2, 'sine', 0.035, 0.5, 'alert')); } };
  return api;
})();

window.HB = { ask, $, $$, clamp, lerp, REDUCE, uid, esc, icon, set, IDB, bus, toast, modal, floatPanel, floats, need, needESM, CDN, FONTS, loadFont, fontStack, fontLoaded, toSub, toSup, unSubSup, SUB, SUP, isRTL, isolate, MathP, fmtNum, SND };
})();

