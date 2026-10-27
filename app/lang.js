/* ================= HelixBoard — Arabic interface: every label, tooltip, message and dialog in Arabic, written right to left =================
   Works on the page as it appears (a MutationObserver), so no module needs to know about languages. The board's own content and
   anything people type are never translated. Switching back restores the English originals. */
(() => {
'use strict';
const { set, toast, icon } = window.HB;
const AR = window.HB_AR || {};
/* text with numbers in it is matched with the numbers taken out ("3 joined" → "{n} joined") and put back in order */
const NUM = /\d+(?:[.,:]\d+)*/g;
const PAT = {}; Object.keys(AR).forEach(k => { if (k.includes('{n}')) PAT[k] = AR[k]; });
const orig = new WeakMap(), origAttr = new WeakMap();
let on = set.get('lang', 'en') === 'ar', busy = false;

function tr(s) { const t = s.trim(); if (!t) return null; let a = AR[t];
  if (a == null && /\d/.test(t)) { const nums = t.match(NUM) || []; const key = t.replace(NUM, '{n}'); const p = PAT[key]; if (p != null) { let i = 0; a = p.replace(/\{n\}/g, () => nums[i++] != null ? nums[i - 1] : ''); } }
  if (a == null) return null; return s.replace(t, a); }
const SKIP = 'canvas,script,style,textarea,input,select option[data-raw],#editor,[data-noi18n],.ppsc,.st-dump,#hd,#me';
function walk(n) { if (!on) return;
  if (n.nodeType === 3) { const p = n.parentElement; if (!p || p.closest(SKIP)) return; const cur = n.nodeValue; if (!/[A-Za-z]/.test(cur)) return; const a = tr(cur); if (a != null && a !== cur) { if (!orig.has(n)) orig.set(n, cur); n.nodeValue = a; } return; }
  if (n.nodeType !== 1 || n.matches && n.matches('canvas,script,style,svg,#editor,[data-noi18n]')) return;
  ['title', 'placeholder', 'aria-label'].forEach(at => { const v = n.getAttribute(at); if (!v || !/[A-Za-z]/.test(v)) return; const a = tr(v); if (a != null && a !== v) { const m = origAttr.get(n) || {}; if (!(at in m)) m[at] = v; origAttr.set(n, m); n.setAttribute(at, a); } });
  for (const c of n.childNodes) walk(c); }
function restore(n) { if (n.nodeType === 3) { if (orig.has(n)) { n.nodeValue = orig.get(n); orig.delete(n); } return; } if (n.nodeType !== 1) return; const m = origAttr.get(n); if (m) { Object.entries(m).forEach(([k, v]) => n.setAttribute(k, v)); origAttr.delete(n); } n.childNodes.forEach(restore); }
const mo = new MutationObserver(ms => { if (!on || busy) return; busy = true; try { ms.forEach(m => { if (m.type === 'characterData') walk(m.target); else if (m.type === 'attributes') walk(m.target); else m.addedNodes.forEach(walk); }); } finally { busy = false; } });
mo.observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ['title', 'placeholder', 'aria-label'] });

const css = document.createElement('style'); css.textContent = `
body.ar #toolrow,body.ar #sheet,body.ar .float .fb,body.ar .float .fh,body.ar #stStage,body.ar #toast,body.ar #palette,body.ar #sidetabs span,body.ar #drawer,body.ar .glab,body.ar #presBar,body.ar #deckBar,body.ar .igate{direction:rtl;font-family:"Segoe UI",Tahoma,"Noto Kufi Arabic","Tajawal",var(--head),sans-serif}
body.ar #toolrow .grp,body.ar #sheet .row,body.ar #sheet .foot,body.ar .st-top,body.ar .st-foot,body.ar .st-row,body.ar .st-stem{direction:rtl}
body.ar .glab{letter-spacing:0}body.ar #sidetabs span{font-size:10.5px}body.ar .tb span{font-size:11.5px;line-height:1.25}
body.ar #toast{border-left:1px solid var(--line);border-right:4px solid var(--accent)}
body.ar .st-opt{text-align:right}body.ar .st-q,body.ar .st-big{font-family:"Segoe UI",Tahoma,"Noto Kufi Arabic",var(--head),sans-serif}
body.ar .mono,body.ar .st-clock,body.ar .big{direction:ltr}`;
document.head.appendChild(css);

function apply(v) { on = v; set.put('lang', v ? 'ar' : 'en'); document.body.classList.toggle('ar', v); document.documentElement.lang = v ? 'ar' : 'en';
  busy = true; try { if (v) walk(document.body); else restore(document.body); } finally { busy = false; }
  const b = document.getElementById('aLang'); if (b) b.title = v ? 'English' : 'العربية'; }
function toggle() { apply(!on); toast(on ? 'تم التبديل إلى الواجهة العربية' : 'Switched to English'); }

/* a language button in the top bar, next to the other app buttons */
{ const top = document.getElementById('aUndo'); if (top) { const b = document.createElement('button'); b.className = 'ib'; b.id = 'aLang'; b.setAttribute('aria-label', 'Language'); b.innerHTML = '<span style="font:800 13px/1 \'Segoe UI\',Tahoma,sans-serif">ع</span>'; b.title = on ? 'English' : 'العربية'; b.onclick = toggle; top.parentNode.insertBefore(b, top); } }
if (on) apply(true);
window.HBLang = { toggle, apply, get on() { return on; }, t: s => (on && tr(s)) || s };
})();
