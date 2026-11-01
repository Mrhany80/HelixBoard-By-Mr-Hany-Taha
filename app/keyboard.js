/* ================= HelixBoard — Science Keys: a full touch keyboard for the board (v2.7.0) =================
   Big keys for a smartboard (three sizes, all at least 48 px), a full English layout (numbers row, Tab, Caps, both Shifts,
   arrows, Delete) and the Windows Arabic layout with its Shift layer (حركات، إ أ آ، لا لإ لأ لآ), plus science layers:
   symbols, sub/superscripts, Greek, units, chemistry and biology. Long-press a key for its variants (2 → ² ₂, e → ε).
   It types into the box that has the cursor — a text box on the board or any field in a panel — and never steals focus.
   Drag it by its bar; double-click the bar to dock it again. A keystroke HUD can show physical key presses. */
(() => {
'use strict';
const { $, $$, clamp, esc, set, toast, SND, loadFont, REDUCE } = window.HB;
const E = window.HBE, I = window.HBI;
/* a key: l = label, v = what it types (or {cmd}), s = with Shift, w = width in key units, c = class */
const K = (l, o) => Object.assign({ l, v: l }, o || {});
const C = (l, v, w, c) => ({ l, v, w: w || 1, c: 'fn ' + (c || '') });
const BS = C('⌫', '{bs}', 1.6), TAB = C('Tab ⇥', '{tab}', 1.5), CAPS = C('Caps', '{caps}', 1.8), ENT = C('Enter ↵', '{en}', 2.1, 'acc'), SHL = C('⇧ Shift', '{sh}', 2.3), SHR = C('⇧', '{sh}', 1.6), DEL = C('Del', '{del}', 1.1);
const pairs = (a, b) => a.map((c, i) => K(c, { s: b[i] }));
const row = (s, shifted) => [...s].map((c, i) => K(c, shifted ? { s: [...shifted][i] } : null));
/* the last row is the same everywhere: switch layer, language, space, arrows */
const bottom = (lang) => [C('?123', '{L:sym}', 1.4), C(lang === 'ar' ? 'ABC' : 'عربي', lang === 'ar' ? '{L:abc}' : '{L:ar}', 1.4, 'lang'), C('🧪', '{L:sci}', 1.1), K(' ', { v: ' ', w: 5.6, c: 'space', l: '' }), C('←', '{lf}'), C('↑', '{up}'), C('↓', '{dn}'), C('→', '{rt}')];
const sciRow = rows => rows.concat([[C('ABC', '{L:abc}', 1.4), C('عربي', '{L:ar}', 1.4, 'lang'), K(' ', { v: ' ', w: 5, c: 'space', l: '' }), C('←', '{lf}'), C('→', '{rt}'), BS, ENT]]);
const LAYOUTS = {
  abc: { name: 'ABC', rows: [
    row('`1234567890-=', '~!@#$%^&*()_+').concat([BS]),
    [TAB].concat(row('qwertyuiop[]\\', 'QWERTYUIOP{}|')),
    [CAPS].concat(row("asdfghjkl;'", 'ASDFGHJKL:"'), [ENT]),
    [SHL].concat(row('zxcvbnm,./', 'ZXCVBNM<>?'), [SHR]),
    bottom('en')] },
  /* Windows Arabic (101) with its Shift layer */
  ar: { name: 'عربي', ar: true, rows: [
    row('ذ١٢٣٤٥٦٧٨٩٠-=', 'ّ!@#$%^&*)(_+').concat([BS]),
    [TAB].concat(pairs(['ض', 'ص', 'ث', 'ق', 'ف', 'غ', 'ع', 'ه', 'خ', 'ح', 'ج', 'د'], ['\u064E', '\u064B', '\u064F', '\u064C', 'لإ', 'إ', '‘', '÷', '×', '؛', '<', '>'])),
    [CAPS].concat(pairs(['ش', 'س', 'ي', 'ب', 'ل', 'ا', 'ت', 'ن', 'م', 'ك', 'ط'], ['\u0650', '\u064D', ']', '[', 'لأ', 'أ', 'ـ', '،', '/', ':', '"']), [ENT]),
    [SHL].concat([K('ئ', { s: '~' }), K('ء', { s: 'ْ' }), K('ؤ', { s: '}' }), K('ر', { s: '{' }), K('لا', { s: 'لآ' }), K('ى', { s: 'آ' }), K('ة', { s: '’' }), K('و', { s: ',' }), K('ز', { s: '.' }), K('ظ', { s: '؟' })], [SHR]),
    bottom('ar')] },
  sym: { name: '123 ±', rows: sciRow([row('1234567890'), row('+−×÷=±≈≠<>'), row('≤≥∝∞°%‰√∑∫'), row('→⇌←↑↓⇒∴∵…·'), row('()[]{}/|•✓')]) },
  sub: { name: 'x² x₂', rows: sciRow([row('⁰¹²³⁴⁵⁶⁷⁸⁹'), row('₀₁₂₃₄₅₆₇₈₉'), [K('⁺'), K('⁻'), K('₊'), K('₋'), K('⁽'), K('⁾'), K('₍'), K('₎'), K('ⁿ'), K('ˣ')], [K('x²'), K('x³'), K('cm²'), K('cm³'), K('dm³'), K('m s⁻¹', { w: 1.6 }), K('m s⁻²', { w: 1.6 })]]) },
  greek: { name: 'αβγ', rows: sciRow([row('αβγδεζηθικ'), row('λμνξοπρστυ'), row('φχψωΓΔΘΛΞΠ'), row('ΣΦΨΩ∂∇ℓħ')]) },
  units: { name: 'Units', rows: sciRow([[K('µm'), K('nm'), K('mm'), K('cm'), K('m'), K('km'), K('mL'), K('L')], [K('mg'), K('g'), K('kg'), K('cm³'), K('dm³'), K('m³'), K('°C'), K('K')], [K('J'), K('kJ'), K('W'), K('N'), K('Pa'), K('kPa'), K('V'), K('A')], [K('mol'), K('mol dm⁻³', { w: 2 }), K('s'), K('min'), K('h'), K('Ω'), K('Hz')]]) },
  chem: { name: 'Chem', rows: sciRow([[K('H₂O'), K('CO₂'), K('O₂'), K('N₂'), K('H₂'), K('NH₃'), K('CH₄'), K('NaCl')], [K('C₆H₁₂O₆', { w: 1.8 }), K('C₂H₅OH', { w: 1.6 }), K('HCl'), K('NaOH'), K('H₂SO₄', { w: 1.4 }), K('CaCO₃', { w: 1.4 })], [K('H'), K('C'), K('N'), K('O'), K('P'), K('S'), K('Na'), K('K'), K('Mg'), K('Ca'), K('Cl'), K('Fe')], [K('(s)'), K('(l)'), K('(g)'), K('(aq)'), K('→'), K('⇌'), K('+'), K('Δ'), K('e⁻'), K('H⁺'), K('OH⁻')]]) },
  bio: { name: 'Bio', rows: sciRow([[K('ATP'), K('ADP'), K('Pᵢ'), K('NAD⁺'), K('NADH'), K('FADH₂'), K('NADP⁺'), K('NADPH')], [K('DNA'), K('RNA'), K('mRNA'), K('tRNA'), K('A'), K('T'), K('G'), K('C'), K('U')], [K('glucose', { w: 1.5 }), K('enzyme', { w: 1.5 }), K('mitochondrion', { w: 2.4 }), K('chloroplast', { w: 2 }), K('nucleus', { w: 1.5 })], [K('♂'), K('♀'), K('×'), K('→'), K('Aa'), K('aa'), K('AA'), K('XY'), K('XX')]]) },
};
LAYOUTS.sci = LAYOUTS.chem;
const VARS = { '2': ['²', '₂', '½'], '3': ['³', '₃', '⅓'], '1': ['¹', '₁'], '4': ['⁴', '₄', '¼'], '5': ['⁵', '₅'], '6': ['⁶', '₆'], '0': ['⁰', '₀', '°'], '+': ['⁺', '₊', '±'], '-': ['⁻', '−', '–', '₋'], 'e': ['ε', 'é', 'è', 'ē'], 'a': ['α', 'á', 'à', 'â'], 'b': ['β'], 'd': ['δ', 'Δ'], 'l': ['λ'], 'm': ['µ'], 'p': ['π'], 's': ['σ', 'Σ'], 'o': ['°', 'ω', 'Ω', 'ö'], 'x': ['×'], 't': ['θ', 'τ'], 'r': ['ρ'], '.': ['·', '…'], '/': ['÷'], '=': ['≈', '≠', '≡'], '<': ['≤'], '>': ['≥', '→'], 'ا': ['أ', 'إ', 'آ', 'ٱ'], 'ي': ['ى', 'ئ'], 'و': ['ؤ'], 'ه': ['ة'] };

const css = document.createElement('style'); css.textContent = `
#kbd.k2{position:fixed;left:50%;bottom:84px;transform:translateX(-50%);z-index:20;padding:10px 12px 12px;border-radius:22px;width:min(var(--kw),calc(100vw - 24px));
  background:linear-gradient(180deg,color-mix(in srgb,var(--panel2) 92%,transparent),color-mix(in srgb,var(--panel) 96%,transparent));backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);
  border:1px solid color-mix(in srgb,var(--accent) 22%,var(--line));box-shadow:0 24px 60px -18px rgba(0,0,0,.65),inset 0 1px 0 rgba(255,255,255,.06);user-select:none;-webkit-user-select:none;touch-action:none}
#kbd.k2.s{--kh:50px;--kf:19px;--kw:880px} #kbd.k2.m{--kh:60px;--kf:22px;--kw:1060px} #kbd.k2.l{--kh:72px;--kf:26px;--kw:1260px}
#kbd.k2 .kbar{display:flex;align-items:center;gap:6px;margin:0 2px 10px;cursor:grab;min-height:40px}
#kbd.k2 .grip{width:42px;height:6px;border-radius:3px;background:var(--line);margin-inline-end:6px}
#kbd.k2 .klay{display:flex;gap:4px;flex:1;overflow-x:auto;scrollbar-width:none}
#kbd.k2 .klay button,#kbd.k2 .ktool{min-height:40px;padding:0 14px;border-radius:12px;border:1px solid var(--line);background:var(--panel2);color:var(--muted);font:700 14px var(--ui);cursor:pointer;white-space:nowrap}
#kbd.k2 .klay button[aria-pressed=true]{background:var(--accent);color:#1b0610;border-color:var(--accent)}
#kbd.k2 .ktool{padding:0 11px;color:var(--ink)} #kbd.k2 .ktool[aria-pressed=true]{color:var(--accent);border-color:var(--accent)}
#kbd.k2 .rows{display:grid;gap:7px}
#kbd.k2 .r{display:flex;gap:7px;width:100%;justify-content:stretch}
#kbd.k2 .key{flex:var(--w,1) 1 0;min-width:0;max-width:none;width:auto;margin:0;white-space:nowrap;height:var(--kh);border-radius:13px;border:1px solid rgba(255,255,255,.07);position:relative;overflow:hidden;cursor:pointer;
  background:linear-gradient(180deg,color-mix(in srgb,var(--ink) 9%,var(--panel2)),var(--panel2));color:var(--ink);font:600 var(--kf)/1 var(--ui);
  box-shadow:0 3px 0 rgba(0,0,0,.35),0 4px 10px -4px rgba(0,0,0,.4);transition:transform .06s,box-shadow .06s,background .15s;display:flex;align-items:center;justify-content:center;padding:0 4px}
#kbd.k2 .key.ar{font-family:'Noto Kufi Arabic',var(--ui);font-size:calc(var(--kf) * 1.05)}
#kbd.k2 .key .alt{position:absolute;top:5px;inset-inline-start:8px;font-size:calc(var(--kf) * .5);color:var(--muted);font-weight:600}
#kbd.k2 .key.fn{background:linear-gradient(180deg,color-mix(in srgb,var(--ink) 4%,var(--panel)),var(--panel));color:var(--muted);font-size:calc(var(--kf) * .68);font-weight:700}
#kbd.k2 .key.acc{background:linear-gradient(180deg,color-mix(in srgb,var(--accent) 88%,#fff),var(--accent));color:#1b0610;border-color:transparent}
#kbd.k2 .key.lang{color:var(--cyan,#22D3EE)}
#kbd.k2 .key.space{background:linear-gradient(180deg,color-mix(in srgb,var(--ink) 12%,var(--panel2)),var(--panel2))}
#kbd.k2 .key[aria-pressed=true]{background:color-mix(in srgb,var(--accent) 30%,var(--panel2));color:var(--ink);box-shadow:0 0 0 2px var(--accent),0 3px 0 rgba(0,0,0,.35)}
#kbd.k2 .key.down,#kbd.k2 .key:active{transform:translateY(3px);box-shadow:0 0 0 rgba(0,0,0,.35),0 0 18px -2px color-mix(in srgb,var(--accent) 60%,transparent)}
#kbd.k2 .key .rip{position:absolute;border-radius:50%;background:color-mix(in srgb,var(--accent) 45%,transparent);transform:translate(-50%,-50%);pointer-events:none}
#kbd.k2 .key.long::after{content:"";position:absolute;bottom:6px;inset-inline-end:7px;width:5px;height:5px;border-radius:50%;background:var(--muted);opacity:.6}
body.kbd-on #dock{opacity:.35}
.varpop.k2v{position:fixed;z-index:61;display:flex;gap:6px;padding:8px;border-radius:16px;background:var(--panel);border:1px solid var(--accent);box-shadow:0 18px 40px -12px rgba(0,0,0,.6)}
.varpop.k2v .key{width:62px;height:62px;border-radius:12px;border:1px solid var(--line);background:var(--panel2);color:var(--ink);font:600 26px var(--ui);cursor:pointer}
.varpop.k2v .key:hover{background:var(--accent);color:#1b0610}
@media (max-width:760px){#kbd.k2{--kh:46px;--kf:17px;bottom:8px} #kbd.k2 .r{gap:4px} #kbd.k2 .rows{gap:5px}}
`; document.head.appendChild(css);

const kbd = $('#kbd'); kbd.classList.add('k2');
let lay = set.get('kbdLay', 'abc'), size = set.get('kbdSize2', 'l'), shift = false, caps = false, hud = set.get('hud2', false), lastShift = 0;
if (!LAYOUTS[lay]) lay = 'abc';
/* where the typing goes: the board's text box, or the last field the teacher tapped in a panel */
let field = null;
document.addEventListener('focusin', e => { const t = e.target; if (t && (t.matches('input[type=text],input[type=search],input[type=number],input:not([type]),textarea') || t.isContentEditable) && !kbd.contains(t)) field = t; });
const upper = () => shift !== caps;

function build() { const L = LAYOUTS[lay]; kbd.className = 'k2 ' + size; kbd.dir = 'ltr';
  kbd.innerHTML = '<div class="kbar" id="kbBar"><span class="grip"></span><div class="klay">' + ['abc', 'ar', 'sym', 'sub', 'greek', 'units', 'chem', 'bio'].map(k => '<button data-l="' + k + '" aria-pressed="' + (k === lay || (lay === 'sci' && k === 'chem')) + '"' + (LAYOUTS[k].ar ? ' style="font-family:\'Noto Kufi Arabic\',var(--ui)"' : '') + '>' + LAYOUTS[k].name + '</button>').join('') + '</div>' +
    '<button class="ktool" id="kbSz" title="Key size">' + { s: 'S', m: 'M', l: 'L' }[size] + '</button><button class="ktool" id="kbHud" aria-pressed="' + hud + '" title="Show physical key presses">HUD</button><button class="ktool" id="kbX" title="Close (K)">✕</button></div><div class="rows">' +
    L.rows.map(r => '<div class="r">' + r.map(k => { const up = upper(), sh = k.s != null && (L.ar ? shift : up), lab = k.v === '{sh}' || k.v === '{caps}' ? k.l : sh ? k.s : (up && /^[a-z]$/.test(k.l) ? k.l.toUpperCase() : k.l);
      const pressed = (k.v === '{sh}' && shift) || (k.v === '{caps}' && caps); const alt = k.s != null && !sh && !/^[a-zA-Z]$/.test(k.l) ? '<span class="alt">' + esc(k.s) + '</span>' : '';
      return '<button class="key ' + (k.c || '') + (L.ar && !/fn/.test(k.c || '') ? ' ar' : '') + (VARS[k.l] ? ' long' : '') + '" style="--w:' + (k.w || 1) + '" data-i="' + esc(k.v) + '" data-s="' + esc(k.s != null ? k.s : '') + '" data-k="' + esc(k.l) + '"' + (pressed ? ' aria-pressed="true"' : '') + '>' + alt + esc(lab) + '</button>'; }).join('') + '</div>').join('') + '</div>';
  $$('#kbd [data-l]').forEach(b => b.onclick = () => go(b.dataset.l));
  $('#kbX').onclick = () => toggle(false);
  $('#kbSz').onclick = () => { size = { s: 'm', m: 'l', l: 's' }[size]; set.put('kbdSize2', size); build(); };
  $('#kbHud').onclick = () => { hud = !hud; set.put('hud2', hud); $('#hud').hidden = !hud; build(); toast(hud ? 'Keystroke HUD on: physical keys you press appear bottom-left.' : 'Keystroke HUD off'); };
  $$('#kbd .key').forEach(b => { let lt = 0, lp = false;
    b.addEventListener('pointerdown', e => { e.preventDefault(); lp = false; ripple(b, e); b.classList.add('down'); clearTimeout(lt); const base = b.dataset.k.toLowerCase(); if (VARS[base] || VARS[b.dataset.k]) lt = setTimeout(() => { lp = true; variants(b, VARS[b.dataset.k] || VARS[base]); }, 430); });
    b.addEventListener('pointerup', () => { clearTimeout(lt); b.classList.remove('down'); if (!lp) hit(b); });
    b.addEventListener('pointerleave', () => { clearTimeout(lt); b.classList.remove('down'); }); });
  dragBar(); }
function go(l) { lay = l; if (l !== 'sci') set.put('kbdLay', l); if (LAYOUTS[l].ar) loadFont('Noto Kufi Arabic'); shift = false; build(); SND.zip && SND.zip(); }
function ripple(b, e) { if (REDUCE || !window.gsap) return; const r = b.getBoundingClientRect(), s = document.createElement('span'); s.className = 'rip'; s.style.left = (e.clientX - r.left) + 'px'; s.style.top = (e.clientY - r.top) + 'px'; s.style.width = s.style.height = '8px'; b.appendChild(s); gsap.to(s, { width: 160, height: 160, opacity: 0, duration: 0.45, ease: 'power2.out', onComplete: () => s.remove() }); }
function variants(b, list) { document.querySelectorAll('.varpop.k2v').forEach(x => x.remove()); const p = document.createElement('div'); p.className = 'varpop k2v'; const r = b.getBoundingClientRect(); p.innerHTML = list.map(v => '<button class="key" data-v="' + esc(v) + '">' + esc(v) + '</button>').join(''); document.body.appendChild(p);
  p.style.left = clamp(r.left + r.width / 2 - p.offsetWidth / 2, 6, innerWidth - p.offsetWidth - 6) + 'px'; p.style.top = Math.max(6, r.top - p.offsetHeight - 10) + 'px'; if (window.gsap && !REDUCE) gsap.from(p, { y: 10, opacity: 0, duration: 0.18 });
  $$('.key', p).forEach(k => k.onpointerup = () => { type(k.dataset.v); p.remove(); }); setTimeout(() => document.addEventListener('pointerdown', function c(e) { if (!p.contains(e.target)) { p.remove(); document.removeEventListener('pointerdown', c, true); } }, true), 0); }

/* ---------- typing ---------- */
const target = () => { if (I.editing && I.editing.ta) return I.editing.ta; if (field && field.isConnected && document.activeElement === field) return field; if (field && field.isConnected && field.offsetParent && !field.disabled) return field; return null; };
function ensureEditor() { if (I.editing) return; const vr = E.viewRect(); loadFont(I.T.font); I.openEditor({ t: 'text', x: vr[0] + vr[2] * 0.25, y: vr[1] + vr[3] * (kbd.hidden ? 0.3 : 0.1), w: 0, s: '', font: I.T.font, size: I.T.fsize, c: I.T.color }, true); }
function put(t) { let el = target(); if (!el) { ensureEditor(); if (I.editing && t) { I.insertText(t); return; } el = target(); } if (!el) return;
  if (el === (I.editing && I.editing.ta)) { I.insertText(t); return; }
  if (el.isContentEditable) { el.focus(); document.execCommand('insertText', false, t); return; }
  el.focus(); const a = el.selectionStart != null ? el.selectionStart : el.value.length, z = el.selectionEnd != null ? el.selectionEnd : a; el.setRangeText(t, a, z, 'end'); el.dispatchEvent(new Event('input', { bubbles: true })); }
function edit(fn) { const el = target(); if (!el || el.isContentEditable) return null; const a = el.selectionStart, z = el.selectionEnd, r = fn(el, a, z); el.dispatchEvent(new Event('input', { bubbles: true })); el.focus(); return r; }
function type(t) { SND.key && SND.key(t === '\n' ? 'Enter' : t === ' ' ? ' ' : 'x'); put(t); }
function hit(b) { const v = b.dataset.i;
  if (v === '{sh}') { const now = Date.now(); if (now - lastShift < 350) { caps = !caps; shift = false; } else shift = !shift; lastShift = now; build(); return; }
  if (v === '{caps}') { caps = !caps; shift = false; build(); return; }
  if (/^\{L:/.test(v)) return go(v.slice(3, -1));
  SND.key && SND.key('x');
  if (v === '{bs}') { edit((el, a, z) => { if (a === z && a > 0) el.setRangeText('', a - 1, z, 'end'); else el.setRangeText('', a, z, 'end'); return 1; }); return; }
  if (v === '{del}') { edit((el, a, z) => el.setRangeText('', a, a === z ? Math.min(el.value.length, z + 1) : z, 'end')); return; }
  if (v === '{lf}' || v === '{rt}') { edit((el, a) => { const p = clamp(a + (v === '{lf}' ? -1 : 1), 0, el.value.length); el.selectionStart = el.selectionEnd = p; }); return; }
  if (v === '{up}' || v === '{dn}') { edit((el, a) => { const s = el.value, ls = s.lastIndexOf('\n', a - 1) + 1, col = a - ls;
    if (v === '{up}') { if (ls === 0) { el.selectionStart = el.selectionEnd = 0; return; } const ps = s.lastIndexOf('\n', ls - 2) + 1; el.selectionStart = el.selectionEnd = Math.min(ps + col, ls - 1); }
    else { const ne = s.indexOf('\n', a); if (ne < 0) { el.selectionStart = el.selectionEnd = s.length; return; } const ne2 = s.indexOf('\n', ne + 1); el.selectionStart = el.selectionEnd = Math.min(ne + 1 + col, ne2 < 0 ? s.length : ne2); } }); return; }
  if (v === '{tab}') { put('\t'); return; }
  if (v === '{en}') { const el = target(); if (el && el.tagName === 'INPUT') { el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); return; } type('\n'); return; }
  const L = LAYOUTS[lay]; let t = b.dataset.s && (L.ar ? shift : upper()) ? b.dataset.s : v; if (!L.ar && upper() && /^[a-z]$/.test(t)) t = t.toUpperCase();
  type(t); if (shift) { shift = false; build(); } }
function dragBar() { const bar = $('#kbBar'); let d = null;
  bar.onpointerdown = e => { if (e.target.closest('button')) return; const r = kbd.getBoundingClientRect(); d = { x: e.clientX - r.left, y: e.clientY - r.top }; bar.setPointerCapture(e.pointerId); bar.style.cursor = 'grabbing'; };
  bar.onpointermove = e => { if (!d) return; kbd.style.transform = 'none'; kbd.style.left = clamp(e.clientX - d.x, 0, innerWidth - 220) + 'px'; kbd.style.top = clamp(e.clientY - d.y, 0, innerHeight - 120) + 'px'; kbd.style.bottom = 'auto'; };
  bar.onpointerup = () => { if (d) set.put('kbdPos', [kbd.style.left, kbd.style.top]); d = null; bar.style.cursor = ''; };
  bar.ondblclick = () => { dock(); set.put('kbdPos', null); }; }
function dock() { kbd.style.transform = ''; kbd.style.left = ''; kbd.style.top = ''; kbd.style.bottom = ''; }
function toggle(on) { const show = on == null ? kbd.hidden : on; kbd.hidden = !show; document.body.classList.toggle('kbd-on', show);
  if (show) { build(); const p = set.get('kbdPos', null); if (p) { kbd.style.transform = 'none'; kbd.style.left = p[0]; kbd.style.top = p[1]; kbd.style.bottom = 'auto'; } else dock();
    if (LAYOUTS[lay].ar) loadFont('Noto Kufi Arabic'); if (window.gsap && !REDUCE) gsap.from('#kbd', { y: 40, opacity: 0, duration: 0.28, ease: 'power3.out' }); } }

/* physical keyboard: light up the matching key and feed the HUD */
const NAMES = { ' ': 'Space', 'ArrowLeft': '←', 'ArrowRight': '→', 'ArrowUp': '↑', 'ArrowDown': '↓', 'Escape': 'Esc', 'Backspace': '⌫', 'Enter': '↵', 'Control': 'Ctrl', 'Meta': '⌘', 'Shift': '⇧', 'Alt': 'Alt', 'Tab': 'Tab', 'Delete': 'Del' };
document.addEventListener('keydown', e => {
  if (!kbd.hidden) { const k = e.key.length === 1 ? e.key.toLowerCase() : null, b = k && $$('#kbd .key').find(x => x.dataset.k.toLowerCase() === k); if (b) { b.classList.add('down'); setTimeout(() => b.classList.remove('down'), 120); } }
  if (hud) { const H = $('#hud'); H.hidden = false; if (['Control', 'Shift', 'Alt', 'Meta'].includes(e.key)) return; const mods = [e.ctrlKey && 'Ctrl', e.metaKey && '⌘', e.altKey && 'Alt', e.shiftKey && e.key.length > 1 && '⇧'].filter(Boolean); const lab = (NAMES[e.key] || (e.key.length === 1 ? e.key.toUpperCase() : e.key));
    const c = document.createElement('div'); c.className = 'kcap'; c.textContent = mods.concat([lab]).join(' + '); H.appendChild(c); while (H.children.length > 5) H.firstChild.remove(); setTimeout(() => { if (window.gsap && !REDUCE) gsap.to(c, { opacity: 0, y: -10, duration: 0.4, onComplete: () => c.remove() }); else c.remove(); }, 1400); }
  const tg = e.target.tagName; if (tg === 'TEXTAREA' || tg === 'INPUT' || tg === 'SELECT' || e.target.isContentEditable) return; if ((e.key === 'k' || e.key === 'K') && !e.ctrlKey && !e.metaKey && !e.shiftKey && !e.altKey) toggle(); });
$('#hud').hidden = !hud;
window.HBK = { toggle, LAYOUTS, get layout() { return lay; } };
})();
