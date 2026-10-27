(() => {
'use strict';
/* full-screen writing for any page (PDF decks, slides, Word pages, plain boards) with screen-size (zoom) and pen controls always in reach */
const { $, $$, icon, set, bus, toast, SND, clamp } = window.HB;
const E = window.HBE, I = window.HBI;
let own = false, bar = null;
const isFull = () => document.body.classList.contains('deckfull');
const deck = () => window.HBD && HBD.isDeck && HBD.isDeck();
function enter() { if (isFull()) return; if (deck() && HBD.enterFull) { HBD.enterFull(); return; } own = true; document.body.classList.add('deckfull'); const fs = document.documentElement.requestFullscreen ? document.documentElement.requestFullscreen().catch(() => {}) : Promise.resolve(); Promise.resolve(fs).then(() => setTimeout(() => { E.resize && E.resize(); E.dirty.all(); }, 180)); toast('Full screen — zoom and pen controls are on the left. Esc to leave.'); SND.whoosh && SND.whoosh(); }
function exit() { if (!isFull()) return; if (!own && window.HBD && HBD.exitFull) { HBD.exitFull(); return; } own = false; document.body.classList.remove('deckfull'); if (document.fullscreenElement && document.exitFullscreen) document.exitFullscreen().catch(() => {}); setTimeout(() => { E.resize && E.resize(); E.dirty.all(); }, 180); }
document.addEventListener('fullscreenchange', () => { if (own && !document.fullscreenElement) exit(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape' && own && isFull() && !I.editing) { e.preventDefault(); exit(); } }, true);
bus.on('page', () => { if (own && isFull()) setTimeout(() => { E.resize && E.resize(); }, 50); });
/* the side panel */
const css = `#fsBar{position:absolute;left:10px;top:54px;z-index:9;display:none;flex-direction:column;align-items:center;gap:3px;padding:6px;border-radius:16px;background:linear-gradient(180deg,rgba(40,16,48,.94),rgba(22,10,30,.96));border:1px solid rgba(255,120,190,.45);box-shadow:0 12px 30px rgba(0,0,0,.35),0 0 24px rgba(255,80,160,.28);max-height:calc(100% - 54px - 84px);overflow-y:auto;scrollbar-width:none;color:#FBE9F3}
body.deckfull #fsBar{display:flex} body.deckshow #fsBar{display:none!important}
#fsBar button{width:40px;height:36px;border:0;border-radius:10px;background:transparent;color:#FBE9F3;display:grid;place-items:center;cursor:pointer;font:800 11px var(--ui);padding:0}
#fsBar button:hover{background:rgba(255,255,255,.13)} #fsBar button.on{background:#FF4FA0;color:#fff;box-shadow:0 0 12px #FF4FA0}
#fsBar svg{width:18px;height:18px} #fsBar .zp{font:700 11px var(--mono);color:#FFC9DE;padding:2px 0}
#fsBar .sep{width:28px;height:1px;background:rgba(255,255,255,.2);margin:3px 0}
#fsBar .sz i{display:block;border-radius:50%;background:#fff;box-shadow:0 0 6px rgba(255,255,255,.5)}
#fsBar .cl{display:grid;grid-template-columns:1fr 1fr;gap:4px;padding:2px}
#fsBar .cl button{width:18px;height:18px;border-radius:50%;border:2px solid rgba(255,255,255,.25);padding:0}
#fsBar .cl button.on{border-color:#fff;box-shadow:0 0 0 2px #FF4FA0,0 0 10px currentColor}
#fsBar input[type=range]{writing-mode:vertical-lr;direction:rtl;width:22px;height:90px;accent-color:#FF4FA0;margin:2px 0}
#fsBar .lbl{font:700 9px var(--ui);color:#C9A8BC;letter-spacing:.04em;text-transform:uppercase}
#aFull svg{filter:drop-shadow(0 0 4px rgba(255,79,160,.6))}
body.fsmin #fsBar{display:none!important}
#fsPill{display:none;position:absolute;left:0;top:50%;transform:translateY(-50%);z-index:9;width:26px;height:64px;border:1px solid rgba(255,120,190,.5);border-left:0;border-radius:0 14px 14px 0;background:linear-gradient(180deg,rgba(40,16,48,.94),rgba(22,10,30,.96));color:#FBE9F3;cursor:pointer;flex-direction:column;align-items:center;justify-content:center;gap:6px;padding:0;box-shadow:0 0 18px rgba(255,80,160,.35)}
#fsPill svg{width:16px;height:16px} #fsPill i{width:10px;height:10px;border-radius:50%;box-shadow:0 0 0 1.5px #fff,0 0 8px currentColor}
body.deckfull.fsmin #fsPill{display:flex} body.deckshow #fsPill{display:none!important}`;
const st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
const SIZES = [2, 4, 8, 14, 24], COLS = ['#1E1419', '#FFFFFF', '#E03131', '#F76707', '#FFD43B', '#2B8A3E', '#1C7ED6', '#7048E8', '#E64980', '#22D3EE'];
const b = (ic, title, fn, txt) => { const x = document.createElement('button'); x.innerHTML = ic ? icon(ic) : txt; x.title = title; x.onclick = e => { e.preventDefault(); fn(); upd(); }; return x; };
const sep = () => { const d = document.createElement('i'); d.className = 'sep'; return d; };
const centre = () => [E.SW / 2, E.SH / 2];
function zoom(k) { const [x, y] = centre(); E.zoomAt(k, x, y); }
function fit() { if (deck()) HBD.goSlide(HBD.cur, true); else E.fitPage(); }
function fitW() { if (deck()) { const r = HBD.rects()[HBD.cur]; if (!r) return; const s = (E.SW - 140) / r[2]; E.setView(s, (E.SW - r[2] * s) / 2 - r[0] * s, 50 - r[1] * s); } else E.fitWidth(false); }
function actual() { const [x, y] = centre(); E.zoomAt(1 / E.V.s, x, y); }
function build() { bar = document.createElement('div'); bar.id = 'fsBar'; ['pointerdown', 'dblclick', 'wheel'].forEach(ev => bar.addEventListener(ev, e => e.stopPropagation(), { passive: ev === 'wheel' }));
  const zp = document.createElement('div'); zp.className = 'zp'; zp.id = 'fsZp';
  bar.append(b('minimize-2', 'Leave full screen (Esc)', exit), b('chevron-left', 'Hide this panel (a small tab stays on the left)', () => collapse(true)), b('a-arrow-up', 'Bigger / smaller tool buttons', () => window.HBTB && HBTB.cycle()), sep(), Object.assign(document.createElement('div'), { className: 'lbl', textContent: 'Zoom' }), b('zoom-in', 'Zoom in (bigger)', () => zoom(1.2)), zp, b('zoom-out', 'Zoom out (smaller)', () => zoom(1 / 1.2)), b('focus', 'Fit the whole page / slide', fit), b('', 'Fit the width', fitW, '↔'), b('', 'Real size 100%', actual, '1:1'), sep(),
    Object.assign(document.createElement('div'), { className: 'lbl', textContent: 'Pen' }), b('pen-line', 'Pen', () => I.setTool('draw', 'pen')), b('highlighter', 'Highlighter', () => I.setTool('draw', 'hi')), b('eraser', 'Eraser', () => I.setTool('erase')), b('mouse-pointer-2', 'Select / move', () => I.setTool('select')), b('type', 'Type text', () => I.setTool('text')), sep());
  SIZES.forEach(z => { const x = b('', 'Thickness ' + z + ' px', () => I.setSize(z), '<i style="width:' + (z * 0.6 + 3) + 'px;height:' + (z * 0.6 + 3) + 'px"></i>'); x.className = 'sz'; x.dataset.z = z; bar.appendChild(x); });
  const rg = document.createElement('input'); rg.type = 'range'; rg.min = 1; rg.max = 60; rg.title = 'Thickness'; rg.oninput = () => { I.setSize(+rg.value); upd(); }; bar.appendChild(rg);
  const cl = document.createElement('div'); cl.className = 'cl'; COLS.forEach(c => { const x = document.createElement('button'); x.style.background = c; x.style.color = c; x.title = c; x.dataset.c = c; x.onclick = () => { I.setColor(c); if (I.T.tool !== 'draw') I.setTool('draw', I.T.pen === 'hi' ? 'hi' : 'pen'); upd(); }; cl.appendChild(x); }); bar.append(sep(), cl, sep(), b('undo-2', 'Undo', () => E.undo()));
  $('#stage').appendChild(bar);
  const pill = document.createElement('button'); pill.id = 'fsPill'; pill.title = 'Show the zoom and pen panel'; pill.innerHTML = icon('chevron-right') + '<i style="background:' + I.T.color + '"></i>'; pill.onclick = () => collapse(false); ['pointerdown', 'dblclick'].forEach(ev => pill.addEventListener(ev, e => e.stopPropagation())); $('#stage').appendChild(pill);
  if (set.get('fsBarMin', false)) document.body.classList.add('fsmin'); upd(); }
function collapse(on) { document.body.classList.toggle('fsmin', on); set.put('fsBarMin', on); SND.pop && SND.pop(); }
function upd() { const pi = document.querySelector('#fsPill i'); if (pi) pi.style.background = I.T.color; if (!bar) return; const zp = $('#fsZp'); if (zp) zp.textContent = Math.round(E.V.s * 100) + '%'; const T = I.T; $$('#fsBar .sz').forEach(x => x.classList.toggle('on', +x.dataset.z === T.size)); const rg = $('#fsBar input[type=range]'); if (rg && document.activeElement !== rg) rg.value = T.size; $$('#fsBar .cl button').forEach(x => x.classList.toggle('on', x.dataset.c.toLowerCase() === String(T.color).toLowerCase()));
  const tools = [['Pen', T.tool === 'draw' && T.pen !== 'hi'], ['Highlighter', T.tool === 'draw' && T.pen === 'hi'], ['Eraser', T.tool === 'erase'], ['Select / move', T.tool === 'select'], ['Type text', T.tool === 'text']]; tools.forEach(([t, on]) => { const x = [...bar.querySelectorAll('button')].find(q => q.title === t); if (x) x.classList.toggle('on', on); }); }
bus.on('view', upd); bus.on('tool', upd);
/* a Full screen button in the header for every page */
function headerBtn() { const acts = $('#top .acts'), pres = $('#aPresent'); if (!acts || $('#aFull')) return; const x = document.createElement('button'); x.className = 'ib'; x.id = 'aFull'; x.title = 'Full screen — write, zoom and edit (Esc to leave)'; x.setAttribute('aria-label', 'Full screen'); x.innerHTML = icon('maximize'); x.onclick = enter; acts.insertBefore(x, pres || null); }
setTimeout(() => { build(); headerBtn(); }, 0);
window.HBF = { enter, exit, get on() { return isFull(); } };
})();
