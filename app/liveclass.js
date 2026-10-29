/* ================= HelixBoard — Live class (Windows app): Nearpod- and ClassPoint-style activities on students' phones =================
   One QR code (the class link). The teacher sends an activity — Draw it, Quick poll, Word cloud, Short answer, Photo or Collaborate board —
   and every phone switches to it. Answers arrive live in a split-screen gallery, each with the student's name: spotlight one, share it
   with every phone, award stars, put the whole gallery on the board, or export it. Raised hands, questions and "eyes on the board" too. */
(() => {
'use strict';
const { $, $$, esc, icon, set, toast, modal, SND, REDUCE } = window.HB;
const D = () => window.helixDesktop && window.helixDesktop.cl;
const snd = k => { try { SND[k] && SND[k](); } catch (e) {} };

const TYPES = {
  draw:  { name: 'Draw it', ic: 'pen-tool', tint: '#FF5FA2', desc: 'Every student draws on their own copy — all drawings side by side, by name. Great for diagrams, graphs and labelling.' },
  poll:  { name: 'Quick poll', ic: 'chart-column-big', tint: '#22D3EE', desc: 'Multiple choice, true/false or yes/no. Results build live; reveal the right answer when you are ready.' },
  word:  { name: 'Word cloud', ic: 'cloud', tint: '#B197FC', desc: 'Each student sends up to 3 words. The most common answers grow the biggest.' },
  text:  { name: 'Short answer', ic: 'message-square-text', tint: '#4ADE80', desc: 'Everyone types an answer. Read the whole class at once and spotlight the best ones.' },
  image: { name: 'Photo', ic: 'camera', tint: '#FFC928', desc: 'Students photograph their book, model or experiment — every photo in one gallery.' },
  notes: { name: 'Collaborate board', ic: 'sticky-note', tint: '#FF9F5A', desc: 'A shared wall of sticky notes: ideas, questions, examples from the whole class.' },
};
const NOTE_C = ['#FFE066', '#FFA8C5', '#A5D8FF', '#B2F2BB', '#FFC078', '#D0BFFF'];
const POLL_C = ['#FF5FA2', '#22D3EE', '#FFC928', '#4ADE80', '#B197FC', '#FF9F5A'];
const L = { el: null, act: null, list: new Map(), order: [], snap: null, cols: set.get('lcCols', 4), sort: set.get('lcSort', 'time'), shared: null, spot: null, bgUrl: null, bgImg: null, showNames: true, chip: null, clock: 0, raf: 0 };

/* ---------- styles ---------- */
const css = document.createElement('style'); css.textContent = `
#lcStage{position:fixed;inset:0;z-index:46;background:var(--bg);color:var(--ink);display:grid;grid-template-rows:auto minmax(0,1fr);grid-template-columns:minmax(0,1fr) 300px;font-family:var(--ui)}
#lcStage .lc-top{grid-column:1/-1;display:flex;align-items:center;gap:12px;padding:10px 16px;border-bottom:1px solid var(--line);background:linear-gradient(180deg,var(--panel2),var(--panel));min-height:62px}
#lcStage .lc-brand{display:flex;align-items:center;gap:10px;font:800 18px/1 var(--head);white-space:nowrap}
#lcStage .lc-brand .dot{width:10px;height:10px;border-radius:50%;background:#ff3b5c;box-shadow:0 0 0 0 rgba(255,59,92,.6);animation:lcPulse 1.6s infinite}
@keyframes lcPulse{0%{box-shadow:0 0 0 0 rgba(255,59,92,.55)}70%{box-shadow:0 0 0 10px rgba(255,59,92,0)}100%{box-shadow:0 0 0 0 rgba(255,59,92,0)}}
#lcStage .lc-join{display:flex;align-items:center;gap:10px;margin-inline-start:auto;background:var(--panel);border:1px solid var(--line);border-radius:14px;padding:5px 10px 5px 5px;cursor:pointer}
#lcStage .lc-join .qr{width:46px;height:46px;background:#fff;border-radius:8px;padding:3px}
#lcStage .lc-join .qr svg{width:100%;height:100%;display:block}
#lcStage .lc-join .pin{font:800 20px/1 var(--mono);letter-spacing:.08em;color:var(--accent)}
#lcStage .lc-join small{display:block;color:var(--muted);font-size:11px;max-width:220px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
#lcStage .lc-main{overflow:auto;padding:18px 22px 40px;min-width:0}
#lcStage .lc-side{border-inline-start:1px solid var(--line);background:var(--panel);overflow:auto;padding:14px;display:flex;flex-direction:column;gap:14px}
#lcStage h3{margin:0;font:700 12px/1 var(--ui);letter-spacing:.09em;text-transform:uppercase;color:var(--muted)}
#lcStage .lc-cards{display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:14px;margin-top:14px}
#lcStage .lc-card{position:relative;text-align:start;background:var(--panel);border:1px solid var(--line);border-radius:18px;padding:18px;color:inherit;font:inherit;cursor:pointer;display:flex;flex-direction:column;gap:10px;overflow:hidden;transition:transform .15s,border-color .15s,box-shadow .15s}
#lcStage .lc-card:hover,#lcStage .lc-card:focus-visible{transform:translateY(-2px);border-color:var(--tint);box-shadow:0 12px 30px -14px var(--tint);outline:none}
#lcStage .lc-card::before{content:"";position:absolute;inset:0 0 auto;height:4px;background:var(--tint)}
#lcStage .lc-card .ic{width:46px;height:46px;border-radius:14px;display:grid;place-items:center;background:color-mix(in srgb,var(--tint) 18%,transparent);color:var(--tint)}
#lcStage .lc-card .ic svg{width:24px;height:24px}
#lcStage .lc-card b{font:700 18px/1.2 var(--head)}
#lcStage .lc-card span{color:var(--muted);font-size:13.5px;line-height:1.45}
#lcStage .lc-hero{display:flex;align-items:flex-end;justify-content:space-between;gap:16px;flex-wrap:wrap}
#lcStage .lc-hero h1{margin:0;font:800 clamp(24px,2.6vw,34px)/1.1 var(--head)}
#lcStage .lc-hero p{margin:6px 0 0;color:var(--muted)}
#lcStage .lc-bar{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin:14px 0}
#lcStage .lc-type{display:inline-flex;align-items:center;gap:6px;padding:5px 11px;border-radius:999px;font-weight:700;font-size:13px;background:color-mix(in srgb,var(--tint) 18%,transparent);color:var(--tint)}
#lcStage .lc-type svg{width:15px;height:15px}
#lcStage .lc-prompt{font:700 clamp(20px,2vw,28px)/1.3 var(--head);margin:8px 0 2px;white-space:pre-wrap}
#lcStage .lc-count{font:800 15px var(--mono);color:var(--ink)}
#lcStage .lc-clock{font:800 15px var(--mono);color:var(--gold)}
#lcStage .lc-prog{height:6px;border-radius:3px;background:var(--panel2);overflow:hidden;flex:1;min-width:120px;max-width:260px}
#lcStage .lc-prog i{display:block;height:100%;background:linear-gradient(90deg,var(--accent),var(--cyan));transition:width .3s}
#lcStage .lc-grid{display:grid;gap:12px;grid-template-columns:repeat(var(--cols),minmax(0,1fr))}
#lcStage .lc-tile{position:relative;background:var(--panel);border:1px solid var(--line);border-radius:14px;overflow:hidden;cursor:zoom-in;display:flex;flex-direction:column;transition:border-color .15s,transform .15s}
#lcStage .lc-tile:hover{border-color:var(--accent)}
#lcStage .lc-tile.sh{border-color:var(--gold);box-shadow:0 0 0 2px var(--gold)}
#sheet .lc-mode{display:grid;grid-template-columns:1fr 1fr;gap:8px}#sheet .lc-mode button{display:flex;flex-direction:column;gap:3px;text-align:start;padding:10px 12px;border-radius:12px;border:2px solid var(--line);background:var(--panel2);color:var(--ink);cursor:pointer}#sheet .lc-mode button b{display:flex;align-items:center;gap:6px;font-size:14px}#sheet .lc-mode button span{font-size:12px;color:var(--muted);line-height:1.35}#sheet .lc-mode button.on{border-color:var(--accent);background:color-mix(in srgb,var(--accent) 12%,var(--panel2))}
#lcStage .lc-tile.fresh{animation:lcPop .6s ease-out}
@keyframes lcPop{0%{transform:scale(.94);box-shadow:0 0 0 3px var(--accent)}100%{transform:none}}
#lcStage .lc-pv{position:relative;background:#fff;aspect-ratio:var(--ar)}
#lcStage .lc-pv canvas,#lcStage .lc-pv img{position:absolute;inset:0;width:100%;height:100%}
#lcStage .lc-pv img{object-fit:contain}
#lcStage .lc-txt{padding:12px 14px;font-size:15.5px;line-height:1.45;white-space:pre-wrap;word-break:break-word;min-height:74px;flex:1}
#lcStage .lc-nm{display:flex;align-items:center;gap:7px;padding:7px 8px 7px 11px;font-weight:700;font-size:13px;border-top:1px solid var(--line);background:var(--panel2)}
#lcStage .lc-nm .who{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
#lcStage .lc-nm i{width:9px;height:9px;border-radius:50%;flex:none}
#lcStage .lc-star{border:0;background:none;color:var(--gold);font:800 13px var(--mono);cursor:pointer;display:inline-flex;align-items:center;gap:3px;padding:3px 6px;border-radius:8px}
#lcStage .lc-star:hover{background:color-mix(in srgb,var(--gold) 18%,transparent)}
#lcStage .lc-star svg{width:15px;height:15px}
#lcStage .lc-notes{columns:var(--cols) 220px;column-gap:12px}
#lcStage .lc-note{break-inside:avoid;margin:0 0 12px;border-radius:12px;padding:14px 14px 10px;color:#1E1419;font-weight:600;font-size:15.5px;line-height:1.4;box-shadow:0 8px 20px -12px rgba(0,0,0,.6);cursor:zoom-in;word-break:break-word}
#lcStage .lc-note small{display:block;margin-top:8px;font-size:11.5px;font-weight:700;opacity:.65}
#lcStage .lc-poll{display:flex;flex-direction:column;gap:12px;max-width:980px}
#lcStage .lc-opt{display:grid;grid-template-columns:44px minmax(0,1fr) 92px;align-items:center;gap:12px}
#lcStage .lc-opt .lt{width:44px;height:44px;border-radius:12px;display:grid;place-items:center;font:900 20px var(--head);color:#1E1419}
#lcStage .lc-opt .tr{position:relative;height:52px;border-radius:12px;background:var(--panel);border:1px solid var(--line);overflow:hidden}
#lcStage .lc-opt .tr i{position:absolute;inset:0 auto 0 0;border-radius:12px;opacity:.85;transition:width .5s cubic-bezier(.2,.8,.2,1)}
#lcStage .lc-opt .tr span{position:relative;display:flex;align-items:center;height:100%;padding:0 14px;font-weight:700;font-size:16px;color:var(--ink);text-shadow:0 1px 2px rgba(0,0,0,.35)}
#lcStage .lc-opt .n{font:800 18px var(--mono);text-align:end}
#lcStage .lc-opt.right .tr{box-shadow:0 0 0 3px var(--ok)}
#lcStage .lc-opt .who{grid-column:2/4;color:var(--muted);font-size:12.5px;margin-top:-6px}
#lcStage .lc-cloud{width:100%;background:var(--panel);border:1px solid var(--line);border-radius:18px;display:block}
#lcStage .lc-empty{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;color:var(--muted);text-align:center;padding:60px 20px;border:2px dashed var(--line);border-radius:18px}
#lcStage .lc-empty b{font:700 20px var(--head);color:var(--ink)}
#lcStage .lc-st{display:flex;align-items:center;gap:8px;padding:6px 8px;border-radius:10px;font-size:13.5px}
#lcStage .lc-st:hover{background:var(--panel2)}
#lcStage .lc-st .nmx{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-weight:600}
#lcStage .lc-st .ok{color:var(--ok)}#lcStage .lc-st .wait{color:var(--muted);opacity:.6}
#lcStage .lc-st.hand{background:color-mix(in srgb,var(--gold) 16%,transparent)}
#lcStage .lc-st button{border:0;background:none;color:inherit;cursor:pointer;padding:2px;border-radius:6px;display:inline-grid;place-items:center}
#lcStage .lc-st button svg{width:15px;height:15px}
#lcStage .lc-q{background:var(--panel2);border-radius:12px;padding:9px 11px;font-size:14px}
#lcStage .lc-q b{display:block;font-size:12px;color:var(--cyan)}
#lcStage .seg{display:inline-flex;border:1px solid var(--line);border-radius:10px;overflow:hidden}
#lcStage .seg button{border:0;background:var(--panel);color:var(--ink);padding:6px 10px;font:600 12.5px var(--ui);cursor:pointer}
#lcStage .seg button.on{background:var(--accent);color:var(--accent-ink)}
#lcSpot{position:fixed;inset:0;z-index:47;background:rgba(10,4,12,.86);backdrop-filter:blur(6px);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;padding:24px}
#lcSpot .box{max-width:min(1200px,94vw);max-height:76vh;display:flex;align-items:center;justify-content:center}
#lcSpot canvas,#lcSpot img{max-width:100%;max-height:76vh;border-radius:16px;background:#fff;box-shadow:0 30px 80px -20px rgba(0,0,0,.8)}
#lcSpot .txt{background:var(--panel);border:1px solid var(--line);border-radius:18px;padding:28px 34px;font:600 clamp(20px,2.4vw,34px)/1.4 var(--head);color:var(--ink);white-space:pre-wrap;max-width:1000px;max-height:70vh;overflow:auto}
#lcSpot .nm{font:800 22px var(--head);color:var(--ink)}
#lcSpot .row{display:flex;gap:8px;flex-wrap:wrap;justify-content:center}
#lcChip{position:fixed;right:30px;top:104px;z-index:35;display:flex;align-items:center;gap:4px;height:30px;padding:0 3px 0 10px;border-radius:999px;background:color-mix(in srgb,var(--panel) 86%,transparent);backdrop-filter:blur(8px);border:1px solid var(--line);box-shadow:0 8px 22px -10px rgba(0,0,0,.6);font-weight:700;font-size:12px;cursor:pointer;opacity:.9;transition:opacity .2s}
#lcChip:hover{opacity:1;border-color:var(--accent)}
#lcChip .dot{width:8px;height:8px;border-radius:50%;background:#ff3b5c;animation:lcPulse 1.6s infinite;flex:none}
#lcChip .tx{padding:0 4px;white-space:nowrap}
#lcChip button{height:24px;min-width:24px;padding:0 5px;border:0;border-radius:999px;background:transparent;color:var(--ink);display:grid;place-items:center;cursor:pointer}
#lcChip button:hover{background:var(--panel2)} #lcChip button.on{color:var(--gold)} #lcChip button svg{width:14px;height:14px}
#lcChip.min{width:30px;padding:0;justify-content:center} #lcChip.min>:not(.dot){display:none}
body.deckshow #lcChip,body.deckfull #lcChip,body:has(#vlStage:not([hidden])) #lcChip,body:has(#rpStage:not([hidden])) #lcChip,body:has(#clBigQr) #lcChip,body:has(#lcSpot) #lcChip{display:none}
@media (max-width:1000px){#lcStage{grid-template-columns:minmax(0,1fr)}#lcStage .lc-side{display:none}}
body.ar #lcStage,body.ar #lcSpot,body.ar #lcChip,body.ar #lcPick{direction:rtl}
.lc-react{position:fixed;bottom:20px;z-index:80;pointer-events:none;display:flex;flex-direction:column;align-items:center;gap:2px;opacity:0}
.lc-react .e{font-size:44px;line-height:1;filter:drop-shadow(0 6px 10px rgba(0,0,0,.35))}
.lc-react small{font:700 11px var(--ui);color:#fff;background:rgba(0,0,0,.55);padding:1px 7px;border-radius:999px;white-space:nowrap}
#lcPick{position:fixed;inset:0;z-index:70;background:rgba(10,4,12,.72);backdrop-filter:blur(6px);display:flex;align-items:center;justify-content:center}
#lcPick .pk-box{background:var(--panel);border:1px solid var(--line);border-radius:24px;padding:28px 40px;min-width:min(560px,90vw);text-align:center;box-shadow:0 30px 80px -20px rgba(0,0,0,.8)}
#lcPick .pk-lab{display:flex;align-items:center;justify-content:center;gap:8px;font:800 13px var(--ui);letter-spacing:.08em;text-transform:uppercase;color:var(--muted)}
#lcPick .pk-name{font:800 clamp(34px,6vw,72px)/1.2 var(--head);color:var(--ink);margin:18px 0;min-height:1.2em}
#lcPick .pk-name.win{animation:pkWin .6s ease-out}
@keyframes pkWin{0%{transform:scale(.7)}60%{transform:scale(1.15)}100%{transform:scale(1)}}
#lcPick .pk-btns{display:flex;gap:8px;justify-content:center;flex-wrap:wrap}
`;
document.head.appendChild(css);

function needApp() { modal.open('<h2>Live class</h2><p>Students scan one QR code and answer on their own phones: drawings, polls, word clouds, short answers, photos and sticky notes — all live on your screen with their names.</p><p>This needs the <b>HelixBoard Windows app</b>, which runs the class link on this computer.</p><div class="foot"><button class="btn primary" data-close>OK</button></div>'); }
const qrSvg = url => { try { const q = qrcode(0, 'M'); q.addData(url); q.make(); return q.createSvgTag({ cellSize: 3, margin: 1, scalable: true }); } catch (e) { return ''; } };
const players = () => ((L.snap || (window.HBCL && HBCL.snap)) || {}).players || [];
const nameOf = r => L.act && L.act.anon ? 'Student ' + (L.order.indexOf(r.pid) + 1) : r.name;
const starsOf = pid => { const p = players().find(x => x.pid === pid); return p ? p.stars : 0; };

/* ---------- open / close ---------- */
async function open(type) {
  if (!D()) return needApp();
  if (!window.HBCL) return;
  if (!HBCL.on) { await HBCL.start({ quiet: true }); if (!HBCL.on) return; }
  L.snap = HBCL.snap; build();
  const r = await D().cmd('responses'); if (r && r.id) load(r);
  render(); if (type && TYPES[type] && !L.act) setup(type);
}
function build() { if (L.el && L.el.isConnected) { L.el.hidden = false; hideChip(); return; }
  const el = document.createElement('div'); el.id = 'lcStage'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-label', 'Live class');
  el.innerHTML = '<div class="lc-top"><div class="lc-brand"><span class="dot"></span>Live class</div><div id="lcTopBtns" style="display:flex;gap:6px;flex-wrap:wrap"></div><div class="lc-join" id="lcJoin" title="Show the QR code big for the class"></div><button class="btn sm" id="lcHide">' + icon('presentation') + 'Back to board</button></div><div class="lc-main" id="lcMain"></div><div class="lc-side" id="lcSide"></div>';
  document.body.appendChild(el); L.el = el; hideChip();
  el.querySelector('#lcHide').onclick = hide; el.querySelector('#lcJoin').onclick = () => HBCL.bigQr();
  el.addEventListener('keydown', e => { if (e.key === 'Escape' && !$('#lcSpot')) { e.stopPropagation(); hide(); } });
  if (window.gsap && !REDUCE) gsap.from(el, { opacity: 0, y: 12, duration: 0.25, ease: 'power2.out' });
}
function hide() { if (L.el) L.el.hidden = true; closeSpot(); syncChip(); }
function closed() { if (L.act) record(); L.session = null; L.act = null; L.list.clear(); L.order = []; if (L.el) { L.el.remove(); L.el = null; } closeSpot(); hideChip(); }
/* a small pill while the dashboard is hidden: what is running, Eyes on board, end, minimise; it hides itself during slideshows, video lessons, reports and the big QR */
const locked = () => !!(L.snap && L.snap.lock);
function syncChip() { const want = window.HBCL && HBCL.on && (!L.el || L.el.hidden) && (L.act || locked()); if (!want) return hideChip(); if (!L.chip) showChip(); else chipText(); }
function showChip() { hideChip(); const c = document.createElement('div'); c.id = 'lcChip'; L.chip = c; c.classList.toggle('min', set.get('lcChipMin', false)); chipText();
  c.onclick = e => { const b = e.target.closest('button');
    if (c.classList.contains('min')) { c.classList.remove('min'); set.put('lcChipMin', false); return; }
    if (b && b.dataset.k === 'min') { c.classList.add('min'); set.put('lcChipMin', true); return; }
    if (b && b.dataset.k === 'lock') return toggleLock();
    if (b && b.dataset.k === 'end') return endSession();
    open(); };
  c.title = 'Live class — click to open'; document.body.appendChild(c); }
function chipText() { if (!L.chip) return; const t = L.act && TYPES[L.act.type], lk = locked();
  L.chip.innerHTML = '<span class="dot"></span><span class="tx">' + (t ? esc(t.name) + ' · ' + L.list.size + '/' + players().length : 'Live') + '</span><button data-k="lock" class="' + (lk ? 'on' : '') + '" title="' + (lk ? 'Unlock phones' : 'Eyes on board — pause every phone') + '">' + icon(lk ? 'lock' : 'eye') + '</button><button data-k="end" title="End live session">' + icon('power') + '</button><button data-k="min" title="Make smaller">' + icon('minus') + '</button>'; }
function toggleLock() { const lock = locked(); return D().cmd('lock', !lock).then(s => { L.snap = s; window.HBCL && HBCL.sync && HBCL.sync(s); if (L.el && !L.el.hidden) renderTop(); syncChip(); toast(!lock ? 'Phones paused — students see your board and “Eyes on the board”.' : 'Phones unlocked.'); }); }
/* End live session: saves the answers to Reports, closes the phones' link ("The live session has ended") and can open the report */
function endSession() { if (!window.HBCL || !HBCL.on) { toast('No live session is running.'); return; }
  const n = players().length;
  modal.open('<h2>' + icon('power') + ' End live session?</h2><p class="muted">' + (n ? n + ' student' + (n === 1 ? '' : 's') + ' will see “The live session has ended”. ' : '') + (L.act ? 'The current activity is saved to Reports first. ' : '') + 'To start again later, open Live class — students scan the new QR code.</p><div class="foot"><button class="btn" data-close>Cancel</button><button class="btn" id="lcEndOnly">End session</button><button class="btn primary" id="lcEndRep">' + icon('chart-column-big') + 'End and open report</button></div>');
  const go = async rep => { modal.close(); if (L.act) await endActivity(true, true); const sid = L.session && L.session.had ? L.session.id : null; window.HBA && HBA.log('live_end', { students: n });
    await HBCL.stop(); toast('Live session ended.'); if (rep && window.HBRP) HBRP.open(sid); };
  $('#lcEndOnly').onclick = () => go(false); $('#lcEndRep').onclick = () => go(true); }
function hideChip() { if (L.chip) { L.chip.remove(); L.chip = null; } }

/* ---------- emoji reactions float up from the bottom of the screen, over anything (slides, video, board) ---------- */
let reactN = 0;
function floatReact(d) { if (reactN > 24 || document.hidden) return; reactN++; const b = document.createElement('div'); b.className = 'lc-react';
  b.innerHTML = '<span class="e">' + esc(d.e) + '</span>' + (L.showNames ? '<small>' + esc(d.name) + '</small>' : ''); b.style.left = (6 + Math.random() * 18) + 'vw'; document.body.appendChild(b);
  const end = () => { b.remove(); reactN--; };
  if (!window.gsap || REDUCE) { setTimeout(end, 1800); return; }
  gsap.fromTo(b, { y: 0, opacity: 0, scale: 0.6 }, { y: -(window.innerHeight * (0.45 + Math.random() * 0.25)), opacity: 1, scale: 1, duration: 2.8, ease: 'sine.out', onComplete: end });
  gsap.to(b, { x: (Math.random() - 0.5) * 80, duration: 1.4, ease: 'sine.inOut', yoyo: true, repeat: 1 }); gsap.to(b, { opacity: 0, delay: 2, duration: 0.8 }); }
function toggleReact() { const on = !(L.snap && L.snap.reactOn !== false); D().cmd('options', { reactOn: on }).then(s => { L.snap = s; window.HBCL && HBCL.sync && HBCL.sync(s); renderTop(); toast(on ? 'Reactions on — students tap 😊 on their phone.' : 'Reactions off.'); }); }

/* ---------- random name picker (ClassPoint style): names spin, slow down and land on one student; nobody is picked twice until everyone has been ---------- */
function pickName() { const ps = players().filter(p => p.online); if (!ps.length) { toast('Nobody is connected yet.'); return; }
  L.picked = L.picked || new Set(); let pool = ps.filter(p => !L.picked.has(p.pid)); if (!pool.length) { L.picked.clear(); pool = ps; }
  const win = pool[Math.floor(Math.random() * pool.length)]; L.picked.add(win.pid);
  let o = $('#lcPick'); if (o) o.remove(); o = document.createElement('div'); o.id = 'lcPick';
  o.innerHTML = '<div class="pk-box"><div class="pk-lab">' + icon('dices') + ' Random pick</div><div class="pk-name" id="pkName"></div><div class="pk-btns" hidden><button class="btn" id="pkStar">' + icon('star') + 'Give a star</button><button class="btn" id="pkAgain">' + icon('shuffle') + 'Pick again</button><button class="btn primary" id="pkClose">Done</button></div></div>';
  document.body.appendChild(o); const nm = o.querySelector('#pkName'), btns = o.querySelector('.pk-btns');
  o.querySelector('#pkClose').onclick = () => o.remove(); o.onclick = e => { if (e.target === o) o.remove(); };
  o.querySelector('#pkAgain').onclick = pickName; o.querySelector('#pkStar').onclick = () => { o.remove(); award(win.pid); };
  const land = () => { nm.textContent = win.name; nm.style.color = win.color; nm.classList.add('win'); btns.hidden = false; snd('chime'); };
  if (REDUCE || ps.length === 1) return land();
  let k = 0, delay = 50; const spin = () => { nm.textContent = ps[k++ % ps.length].name; nm.style.color = ''; snd('tick'); delay *= 1.12; if (delay > 380) return land(); setTimeout(spin, delay); }; spin(); }

/* ---------- events from the class link ---------- */
function event(type, data, snap) { L.snap = snap;
  if (type === 'reaction') return floatReact(data);
  if (type === 'response' && L.act && data.actId === L.act.id) {
    const isNew = !L.list.has(data.pid);
    if (data.value == null) { L.list.delete(data.pid); L.order = L.order.filter(p => p !== data.pid); }
    else { L.list.set(data.pid, { pid: data.pid, name: data.name, color: data.color, value: data.value, at: data.at, late: !!data.auto }); if (isNew) { L.order.push(data.pid); if (L.list.size === 1 || L.list.size % 5 === 0) snd('pop'); } }
    schedule(isNew ? data.pid : null, data.pid); chipText(); return; }
  if (type === 'hand') { snd('chime'); if (!L.el || L.el.hidden) toast('✋ ' + esc(data.name) + ' raised a hand.'); }
  if (type === 'question') { snd('chime'); if (!L.el || L.el.hidden) toast('❓ ' + esc(data.name) + ' asked: ' + esc(data.q), 6000); }
  if (type === 'working') { if (L.el && !L.el.hidden) { renderSide(); renderHead(); } return; }
  if (type === 'act' && L.act) { D().cmd('responses').then(r => { if (r && r.id) { L.act.open = r.open; L.act.endsAt = r.endsAt; } renderHead(); }); }
  if (L.el && !L.el.hidden) { renderSide(); renderJoin(); renderHead(); renderTop(); } syncChip(); }
/* answers can arrive many times a second — redraw once per frame */
const pending = new Set(); let pendingFresh = new Set();
function schedule(fresh, pid) { pending.add(pid); if (fresh) pendingFresh.add(fresh); if (L.raf) return;
  L.raf = requestAnimationFrame(() => { L.raf = 0; const ids = [...pending], fr = pendingFresh; pending.clear(); pendingFresh = new Set(); if (!L.el || L.el.hidden) return;
    if (L.act && (L.act.type === 'poll' || L.act.type === 'word' || L.act.type === 'notes' || fr.size && L.sort !== 'time')) renderBody(); else ids.forEach(id => upsertTile(id, fr.has(id)));
    renderHead(); renderSide(); }); }

function load(r) { L.act = { id: r.id, type: r.type, prompt: r.prompt, options: r.options, open: r.open, endsAt: r.endsAt, anon: r.anon, once: r.once, auto: r.auto, reveal: r.reveal, ar: r.ar, hasBg: r.hasBg, correct: L.act && L.act.id === r.id ? L.act.correct : null };
  L.list.clear(); L.order = []; r.list.sort((a, b) => a.at - b.at).forEach(x => { L.list.set(x.pid, x); L.order.push(x.pid); }); }

/* ---------- drawing a student's ink (0..1 coordinates, width in thousandths of the width) ---------- */
function drawStroke(g, s, W, H) { const p = s.p; if (!p || p.length < 2) return; g.save(); g.globalCompositeOperation = s.e ? 'destination-out' : 'source-over'; g.strokeStyle = s.c; g.fillStyle = s.c; g.lineWidth = Math.max(1, s.w * W / 1000 * 2.2); g.lineCap = g.lineJoin = 'round'; g.beginPath(); g.moveTo(p[0] * W, p[1] * H);
  if (p.length === 2) { g.arc(p[0] * W, p[1] * H, g.lineWidth / 2, 0, Math.PI * 2); g.fill(); g.restore(); return; }
  for (let i = 2; i + 3 < p.length; i += 2) { const mx = (p[i] + p[i + 2]) / 2, my = (p[i + 1] + p[i + 3]) / 2; g.quadraticCurveTo(p[i] * W, p[i + 1] * H, mx * W, my * H); }
  g.lineTo(p[p.length - 2] * W, p[p.length - 1] * H); g.stroke(); g.restore(); }
function inkCanvas(strokes, W, H) { const c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d'); (strokes || []).forEach(s => drawStroke(g, s, W, H)); return c; }
function paintTile(cv, strokes) { const r = cv.getBoundingClientRect(); const W = Math.max(1, Math.round(r.width * devicePixelRatio)), H = Math.max(1, Math.round(r.height * devicePixelRatio)); if (cv.width !== W || cv.height !== H) { cv.width = W; cv.height = H; } const g = cv.getContext('2d'); g.clearRect(0, 0, W, H); (strokes || []).forEach(s => drawStroke(g, s, W, H)); }

/* ---------- rendering ---------- */
function render() { if (!L.el) return; renderJoin(); renderTop(); renderSide(); renderMain(); }
function renderJoin() { const j = L.el && L.el.querySelector('#lcJoin'); const ln = HBCL.links && HBCL.links(); if (!j || !ln) return; const key = ln.url + ln.pin + ((ln.tn || {}).state || ''); if (j.dataset.k === key) return; j.dataset.k = key;
  const tn = ln.tn || {}, st = tn.state === 'ready' ? '🌐 Any network + 📶 Wi-Fi' : tn.state === 'connecting' ? '📶 Wi-Fi ready · 🌐 opening…' : tn.state === 'failed' ? '📶 Same Wi-Fi only' : '📶 Same Wi-Fi';
  j.innerHTML = '<div class="qr">' + qrSvg(ln.url) + '</div><div><div class="pin">' + esc(ln.pin) + '</div><small>' + st + ' · tap for both QR codes</small></div>'; }
function renderTop() { const b = L.el.querySelector('#lcTopBtns'); const lock = L.snap && L.snap.lock;
  b.innerHTML = (L.act ? '<button class="btn sm" id="lcNew">' + icon('plus') + 'New activity</button>' : '') + '<button class="btn sm' + (lock ? ' primary' : '') + '" id="lcLock" title="Pause every phone so students look at the board">' + icon(lock ? 'lock-open' : 'lock') + (lock ? 'Unlock phones' : 'Eyes on board') + '</button><button class="btn sm" id="lcPickB" title="Pick a random student">' + icon('dices') + 'Pick</button><button class="btn sm' + (L.snap && L.snap.reactOn === false ? '' : ' primary') + '" id="lcReact" title="Students send emoji reactions that float up on your screen">' + icon('smile-plus') + 'Reactions</button><button class="btn sm" id="lcLb">' + icon('trophy') + 'Stars</button><button class="btn sm" id="lcRep">' + icon('chart-column-big') + 'Reports</button><button class="btn sm" id="lcEndS" style="color:var(--bad);border-color:color-mix(in srgb,var(--bad) 45%,var(--line))" title="Save the answers, close the phones’ link and finish the class">' + icon('power') + 'End session</button>';
  const n = b.querySelector('#lcNew'); if (n) n.onclick = () => endActivity(true);
  b.querySelector('#lcLock').onclick = toggleLock; b.querySelector('#lcPickB').onclick = pickName; b.querySelector('#lcReact').onclick = toggleReact; b.querySelector('#lcEndS').onclick = endSession;
  b.querySelector('#lcLb').onclick = leaderboard; b.querySelector('#lcRep').onclick = async () => { if (L.act) await record(); window.HBRP && HBRP.open(L.session && L.session.id); }; }
function renderMain() { const m = L.el.querySelector('#lcMain');
  if (!L.act) { m.innerHTML = '<div class="lc-hero"><div><h1>Choose a live activity</h1><p>It opens on every student’s phone at once. Answers arrive here live, with names.</p></div><div class="small muted">' + players().length + ' student' + (players().length === 1 ? '' : 's') + ' connected</div></div><div class="lc-cards">' +
    Object.entries(TYPES).map(([k, t]) => '<button class="lc-card" data-k="' + k + '" style="--tint:' + t.tint + '"><div class="ic">' + icon(t.ic) + '</div><b>' + esc(t.name) + '</b><span>' + esc(t.desc) + '</span></button>').join('') + '</div>' +
    '<div class="lc-cards" style="grid-template-columns:repeat(auto-fill,minmax(250px,1fr))"><button class="lc-card" id="lcBoardWrite" style="--tint:#22D3EE"><div class="ic">' + icon('monitor-smartphone') + '</div><b>Write on my board</b><span>Students see your board live and write on it together, each in their own colour.</span></button><button class="lc-card" id="lcVideo" style="--tint:#FF9F5A"><div class="ic">' + icon('clapperboard') + '</div><b>Video lesson</b><span>A video split into parts by your questions — it pauses, asks the phones, then plays on. Like Nearpod.</span></button><button class="lc-card" id="lcQuiz" style="--tint:#FFC928"><div class="ic">' + icon('trophy') + '</div><b>Phone quiz game</b><span>A timed quiz with points, a leaderboard and a podium — like Kahoot or Wayground.</span></button></div>';
    $$('.lc-card[data-k]', m).forEach(b => b.onclick = () => setup(b.dataset.k));
    m.querySelector('#lcBoardWrite').onclick = () => { hide(); HBCL.start(); };
    m.querySelector('#lcVideo').onclick = () => { hide(); window.HBVL && HBVL.open(); };
    m.querySelector('#lcQuiz').onclick = () => { hide(); window.HBL && HBL.phoneQuiz(); };
    if (window.gsap && !REDUCE) gsap.from($$('.lc-card', m), { y: 14, opacity: 0, duration: 0.3, stagger: 0.04, ease: 'power2.out' });
    return; }
  const t = TYPES[L.act.type], a = L.act;
  m.innerHTML = '<div style="--tint:' + t.tint + '"><span class="lc-type">' + icon(t.ic) + esc(t.name) + '</span>' + (a.anon ? ' <span class="st-tag">Names hidden</span>' : '') + '<div class="lc-prompt">' + esc(a.prompt || '') + '</div></div><div class="lc-bar" id="lcHead"></div><div class="lc-bar" id="lcTools"></div><div id="lcBody"></div>';
  renderHead(); renderTools(); renderBody(); }
function renderHead() { const h = L.el && L.el.querySelector('#lcHead'); if (!h || !L.act) return; const n = L.list.size, tot = Math.max(n, players().length);
  const wk = players().filter(p => p.working && !L.list.has(p.pid)).length;
  h.innerHTML = '<span class="lc-count">' + n + ' / ' + tot + '</span><span class="muted small">' + (L.act.once ? 'submitted' : 'answered') + (wk ? ' · ' + wk + ' working' : '') + '</span><span class="lc-prog"><i style="width:' + (tot ? n / tot * 100 : 0) + '%"></i></span><span class="lc-clock" id="lcClock"></span>' + (L.act.open ? '<span class="st-tag ok">● Open</span>' : '<span class="st-tag">Closed</span>') + '<span class="st-tag">' + (L.act.once ? '🔒 Submit once' : '📡 Live') + '</span>' + (L.act.open && L.act.endsAt ? '<button class="btn sm" id="lcPlus">' + icon('plus') + '1 min</button>' : '') + (!L.act.open ? '<button class="btn sm" id="lcPlus">' + icon('plus') + 'Reopen for 1 min</button>' : '');
  const pl = h.querySelector('#lcPlus'); if (pl) pl.onclick = () => D().cmd('actOptions', { extend: 60 }).then(r => { if (r) { L.act.open = r.open; L.act.endsAt = r.endsAt; } renderHead(); renderTools(); toast('One more minute — the phones show the new time.'); });
  clock(); }
function clock() { clearTimeout(L.clock); const c = L.el && L.el.querySelector('#lcClock'); if (!c || !L.act) return; if (!L.act.endsAt || !L.act.open) { c.textContent = ''; return; } const s = Math.max(0, Math.ceil((L.act.endsAt - Date.now()) / 1000)); c.textContent = '⏱ ' + Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); c.style.color = s <= 10 ? 'var(--bad)' : ''; if (s > 0) L.clock = setTimeout(clock, 500); }
function renderTools() { const b = L.el.querySelector('#lcTools'), a = L.act; if (!b) return; const grid = ['draw', 'image', 'text', 'notes'].includes(a.type);
  b.innerHTML = '<button class="btn sm' + (a.open ? '' : ' primary') + '" id="lcOpen">' + icon(a.open ? 'circle-stop' : 'play') + (a.open ? 'Close answers' : 'Reopen answers') + '</button>' +
    (a.type === 'poll' && a.correct != null ? '<button class="btn sm' + (a.reveal != null ? ' primary' : '') + '" id="lcReveal">' + icon('circle-check') + (a.reveal != null ? 'Hide answer' : 'Reveal answer') + '</button>' : '') +
    (a.type === 'poll' ? '<button class="btn sm" id="lcNames">' + icon(L.showNames ? 'eye-off' : 'eye') + (L.showNames ? 'Hide who voted' : 'Show who voted') + '</button>' : '') +
    '<button class="btn sm" id="lcAnon">' + icon(a.anon ? 'eye' : 'eye-off') + (a.anon ? 'Show names' : 'Hide names') + '</button>' +
    (grid ? '<span class="seg" title="How many answers side by side">' + [2, 3, 4, 5, 6].map(n => '<button data-c="' + n + '" class="' + (n === L.cols ? 'on' : '') + '">' + n + '</button>').join('') + '</span><span class="seg">' + [['time', 'First in'], ['name', 'A–Z']].map(([k, l]) => '<button data-s="' + k + '" class="' + (k === L.sort ? 'on' : '') + '">' + l + '</button>').join('') + '</span>' : '') +
    (L.shared ? '<button class="btn sm primary" id="lcUnshare">' + icon('megaphone') + 'Stop sharing</button>' : '') +
    '<span style="flex:1"></span>' + (L.cont ? '<button class="btn sm primary" id="lcCont">' + icon('play') + esc(L.cont.label || 'Continue') + '</button>' : '') + '<button class="btn sm" id="lcBoard">' + icon('image-down') + 'Put on board</button><button class="btn sm" id="lcCsv">' + icon('download') + 'Excel (.csv)</button><button class="btn sm" id="lcEnd">' + icon('x') + 'End</button>';
  const q = id => b.querySelector(id);
  q('#lcOpen').onclick = () => D().cmd('actOptions', { open: !a.open }).then(r => { if (r) { a.open = r.open; a.endsAt = r.endsAt; } renderTools(); renderHead(); toast(a.open ? 'Answers are open again.' : 'Answers closed — phones show their final answer.'); });
  const rv = q('#lcReveal'); if (rv) rv.onclick = () => D().cmd('actOptions', { reveal: a.reveal != null ? null : a.correct }).then(r => { a.reveal = r ? r.reveal : null; renderTools(); renderBody(); if (a.reveal != null) snd('fanfare'); });
  const nm = q('#lcNames'); if (nm) nm.onclick = () => { L.showNames = !L.showNames; renderTools(); renderBody(); };
  q('#lcAnon').onclick = () => D().cmd('actOptions', { anon: !a.anon }).then(r => { a.anon = r ? r.anon : !a.anon; renderMain(); });
  $$('[data-c]', b).forEach(x => x.onclick = () => { L.cols = +x.dataset.c; set.put('lcCols', L.cols); renderTools(); renderBody(); });
  $$('[data-s]', b).forEach(x => x.onclick = () => { L.sort = x.dataset.s; set.put('lcSort', L.sort); renderTools(); renderBody(); });
  const us = q('#lcUnshare'); if (us) us.onclick = () => share(null);
  const ct = q('#lcCont'); if (ct) ct.onclick = async () => { const c = L.cont; L.cont = null; await endActivity(true, true); hide(); c && c.onContinue && c.onContinue(); };
  q('#lcBoard').onclick = () => toBoard(); q('#lcCsv').onclick = csv; q('#lcEnd').onclick = () => endActivity(false); }
function sorted() { const ids = L.order.filter(p => L.list.has(p)); if (L.sort === 'name') ids.sort((x, y) => nameOf(L.list.get(x)).localeCompare(nameOf(L.list.get(y)))); return ids.map(p => L.list.get(p)); }
function renderBody() { const b = L.el && L.el.querySelector('#lcBody'); if (!b || !L.act) return; const a = L.act;
  if (!L.list.size) { b.innerHTML = '<div class="lc-empty">' + icon(TYPES[a.type].ic) + '<b>Waiting for answers…</b><span>Students see this activity on their phones now. Answers appear here the moment they are sent.</span></div>'; return; }
  if (a.type === 'poll') return pollView(b);
  if (a.type === 'word') return cloudView(b);
  if (a.type === 'notes') { b.innerHTML = '<div class="lc-notes" style="--cols:' + L.cols + '">' + sorted().map(r => r.value.map((n, i) => '<div class="lc-note" data-p="' + esc(r.pid) + '" data-i="' + i + '" style="background:' + NOTE_C[n.c] + '">' + esc(n.t) + '<small>' + esc(nameOf(r)) + '</small></div>').join('')).join('') + '</div>';
    $$('.lc-note', b).forEach(x => x.onclick = () => spotlight(x.dataset.p)); return; }
  b.innerHTML = '<div class="lc-grid" style="--cols:' + L.cols + ';--ar:' + a.ar + '"></div>'; const g = b.firstChild; sorted().forEach(r => g.appendChild(tile(r))); requestAnimationFrame(() => $$('canvas[data-p]', g).forEach(cv => paintTile(cv, (L.list.get(cv.dataset.p) || {}).value))); }
function tile(r) { const a = L.act, d = document.createElement('div'); d.className = 'lc-tile' + (L.shared === r.pid ? ' sh' : ''); d.dataset.p = r.pid;
  let pv = '';
  if (a.type === 'draw') pv = '<div class="lc-pv">' + (L.bgUrl ? '<img src="' + L.bgUrl + '" alt="">' : '') + '<canvas data-p="' + esc(r.pid) + '"></canvas></div>';
  else if (a.type === 'image') pv = '<div class="lc-pv" style="--ar:4/3;background:#111"><img src="' + esc(r.value) + '" alt=""></div>';
  else pv = '<div class="lc-txt">' + esc(r.value) + '</div>';
  d.innerHTML = pv + '<div class="lc-nm"><i style="background:' + esc(r.color) + '"></i><span class="who">' + esc(nameOf(r)) + (r.late ? ' <span title="Handed in automatically when time was up" style="color:var(--gold)">⏰</span>' : '') + '</span><button class="lc-star" title="Give a star">' + icon('star') + '<span>' + (starsOf(r.pid) || '') + '</span></button></div>';
  d.onclick = e => { if (e.target.closest('.lc-star')) { award(r.pid); return; } spotlight(r.pid); };
  return d; }
function upsertTile(pid, fresh) { const g = L.el && L.el.querySelector('.lc-grid'); if (!g) return renderBody(); const r = L.list.get(pid), old = g.querySelector('.lc-tile[data-p="' + CSS.escape(pid) + '"]');
  if (!r) { if (old) old.remove(); if (!L.list.size) renderBody(); return; }
  if (old && L.act.type === 'draw') { paintTile(old.querySelector('canvas'), r.value); if (L.spot === pid) spotlight(pid, true); return; }
  const t = tile(r); if (old) old.replaceWith(t); else { g.appendChild(t); if (fresh) t.classList.add('fresh'); }
  const cv = t.querySelector('canvas'); if (cv) requestAnimationFrame(() => paintTile(cv, r.value)); if (L.spot === pid) spotlight(pid, true); }
function pollView(b) { const a = L.act, counts = a.options.map(() => 0), who = a.options.map(() => []); L.list.forEach(r => { if (counts[r.value] != null) { counts[r.value]++; who[r.value].push(nameOf(r)); } });
  const tot = L.list.size || 1, max = Math.max(1, ...counts);
  b.innerHTML = '<div class="lc-poll">' + a.options.map((o, i) => '<div class="lc-opt' + (a.reveal === i ? ' right' : '') + '"><span class="lt" style="background:' + POLL_C[i] + '">' + 'ABCDEF'[i] + '</span><div class="tr"><i style="width:' + (counts[i] / max * 100) + '%;background:' + POLL_C[i] + '"></i><span>' + esc(o) + (a.reveal === i ? ' ✓' : '') + '</span></div><span class="n">' + counts[i] + ' · ' + Math.round(counts[i] / tot * 100) + '%</span>' + (L.showNames && !a.anon && who[i].length ? '<div class="who">' + who[i].map(esc).join(', ') + '</div>' : '') + '</div>').join('') + '</div>'; }

/* word cloud: words placed on a spiral, biggest first, without overlapping */
function cloudCanvas(W, H, dark) { const freq = new Map(), shown = new Map();
  L.list.forEach(r => (r.value || []).forEach(w => { const k = w.toLowerCase(); freq.set(k, (freq.get(k) || 0) + 1); if (!shown.has(k)) shown.set(k, w); }));
  const words = [...freq.entries()].sort((a, b) => b[1] - a[1]).slice(0, 80), max = words.length ? words[0][1] : 1;
  const c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d'); g.fillStyle = dark ? '#1C1220' : '#ffffff'; g.fillRect(0, 0, W, H);
  const boxes = [], cols = ['#FF5FA2', '#22D3EE', '#FFC928', '#4ADE80', '#B197FC', '#FF9F5A', '#F06595', '#4DABF7'];
  words.forEach(([k, n], i) => { const size = Math.round(Math.max(18, Math.min(H / 4.2, 18 + (H / 4.2 - 18) * Math.sqrt(n / max)))); g.font = '800 ' + size + 'px "Space Grotesk", "Segoe UI", sans-serif';
    const text = shown.get(k), tw = g.measureText(text).width, th = size * 0.95;
    for (let t = 0; t < 2400; t += 1) { const ang = t * 0.35, rad = 2.2 * t * 0.35, x = W / 2 + rad * Math.cos(ang) * 1.5 - tw / 2, y = H / 2 + rad * Math.sin(ang) - th / 2;
      if (x < 6 || y < 6 || x + tw > W - 6 || y + th > H - 6) { if (rad > Math.max(W, H)) break; continue; }
      const bx = { x: x - 4, y: y - 2, w: tw + 8, h: th + 4 }; if (boxes.some(o => bx.x < o.x + o.w && bx.x + bx.w > o.x && bx.y < o.y + o.h && bx.y + bx.h > o.y)) continue;
      boxes.push(bx); g.fillStyle = cols[i % cols.length]; g.textBaseline = 'top'; g.fillText(text, x, y + size * 0.02); if (n > 1) { g.font = '700 ' + Math.round(size * 0.32) + 'px "JetBrains Mono", monospace'; g.fillStyle = dark ? '#B9A5B6' : '#6C5864'; g.fillText('×' + n, x + tw + 2, y); } break; } });
  return c; }
function cloudView(b) { const W = Math.max(600, Math.min(1600, b.clientWidth || 1000)), H = Math.round(W * 0.5); const c = cloudCanvas(W * devicePixelRatio, H * devicePixelRatio, document.documentElement.dataset.ui !== 'light'); c.className = 'lc-cloud'; c.style.aspectRatio = W + '/' + H; b.replaceChildren(c);
  const all = sorted(); const list = document.createElement('div'); list.className = 'small muted'; list.style.marginTop = '10px'; list.innerHTML = all.map(r => '<b>' + esc(nameOf(r)) + '</b>: ' + r.value.map(esc).join(', ')).join(' · '); b.appendChild(list); }

/* ---------- side panel: who is here, who answered, hands and questions ---------- */
function renderSide() { const s = L.el && L.el.querySelector('#lcSide'); if (!s) return; const ps = players().slice().sort((a, b) => (b.hand ? 1 : 0) - (a.hand ? 1 : 0) || (b.hand - a.hand) || a.name.localeCompare(b.name)), qs = (L.snap && L.snap.questions) || [];
  const hands = ps.filter(p => p.hand).length;
  s.innerHTML = '<div style="display:flex;align-items:center;justify-content:space-between"><h3>Students · ' + ps.length + '</h3>' + (hands ? '<button class="btn sm" id="lcHands">' + icon('hand') + 'Lower ' + hands + '</button>' : '') + '</div><div>' +
    (ps.length ? ps.map(p => { const done = L.act && L.list.has(p.pid); return '<div class="lc-st' + (p.hand ? ' hand' : '') + '"><span style="width:9px;height:9px;border-radius:50%;background:' + esc(p.color) + ';opacity:' + (p.online ? 1 : .35) + '"></span><span class="nmx">' + esc(p.name) + '</span>' + (p.hand ? '<button data-lh="' + esc(p.pid) + '" title="Lower hand">✋</button>' : '') + (p.stars ? '<span style="color:var(--gold);font:800 12px var(--mono)">★' + p.stars + '</span>' : '') + '<button data-st="' + esc(p.pid) + '" title="Give a star">' + icon('star') + '</button>' + (L.act ? (done ? '<span class="ok" title="' + (L.act.once ? 'Submitted' : 'Answered') + '">' + icon('circle-check') + '</span>' : p.working ? '<span title="Working on it" style="color:var(--gold)">' + icon('pencil') + '</span>' : '<span class="wait" title="Not started">' + icon('clock') + '</span>') : '') + '</div>'; }).join('') : '<div class="small muted">Nobody has joined yet. Show the QR code (top right) — students scan it with their phone camera.</div>') + '</div>' +
    '<div style="display:flex;align-items:center;justify-content:space-between"><h3>Questions · ' + qs.length + '</h3>' + (qs.length ? '<button class="btn sm" id="lcClrQ">Clear</button>' : '') + '</div>' +
    (qs.length ? qs.slice().reverse().map(q => '<div class="lc-q"><b>' + esc(q.name) + '</b>' + esc(q.q) + '</div>').join('') : '<div class="small muted">Students tap <b>?</b> on their phone to ask you something privately.</div>');
  const lh = s.querySelector('#lcHands'); if (lh) lh.onclick = () => D().cmd('lowerHand', null).then(x => { L.snap = x; renderSide(); });
  $$('[data-lh]', s).forEach(b => b.onclick = () => D().cmd('lowerHand', b.dataset.lh).then(x => { L.snap = x; renderSide(); }));
  $$('[data-st]', s).forEach(b => b.onclick = () => award(b.dataset.st));
  const cq = s.querySelector('#lcClrQ'); if (cq) cq.onclick = () => D().cmd('clearQuestions').then(x => { L.snap = x; renderSide(); }); }

/* ---------- actions ---------- */
async function award(pid) { const s = await D().cmd('award', { pid, n: 1 }); if (s) L.snap = s; if (L.session && window.HBRP) HBRP.updateLive(sessionInfo()); snd('chime'); const p = players().find(x => x.pid === pid);
  if (p) toast('⭐ ' + esc(p.name) + ' — ' + p.stars + ' star' + (p.stars === 1 ? '' : 's'));
  $$('#lcStage .lc-tile[data-p="' + CSS.escape(pid) + '"] .lc-star span').forEach(x => x.textContent = p ? p.stars : ''); renderSide(); if (L.spot === pid) spotlight(pid, true); }
async function share(pid) { await D().cmd('share', pid); L.shared = pid; if (pid) { snd('pop'); toast('📣 Shared with every phone' + (L.act.anon ? ' (without the name).' : '.')); } renderTools(); $$('#lcStage .lc-tile').forEach(t => t.classList.toggle('sh', t.dataset.p === pid)); if (L.spot) spotlight(L.spot, true); }
/* ---------- Reports: every activity is saved with each student's answer (small pictures for drawings and photos) ---------- */
function thumbOf(r) { try { if (L.act.type === 'draw') return composite(r, 320).toDataURL('image/jpeg', 0.72); } catch (e) {} return null; }
function smallImg(src) { return new Promise(ok => { const im = new Image(); im.onload = () => { const k = Math.min(1, 320 / Math.max(im.width, im.height)), c = document.createElement('canvas'); c.width = Math.round(im.width * k); c.height = Math.round(im.height * k); c.getContext('2d').drawImage(im, 0, 0, c.width, c.height); ok(c.toDataURL('image/jpeg', 0.72)); }; im.onerror = () => ok(null); im.src = src; }); }
function sessionInfo() { const ps = players(); return Object.assign({}, L.session, { roster: ps.map(p => p.name), stars: Object.fromEntries(ps.filter(p => p.stars).map(p => [p.name, p.stars])) }); }
async function record() { const a = L.act; if (!a || !window.HBRP || !L.session) return; if (!L.list.size && !players().length) return; const info = sessionInfo();
  const responses = []; for (const r of sorted()) { const x = { name: r.name, at: r.at, late: !!r.late };
    if (a.type === 'draw') { x.value = null; x.thumb = thumbOf(r); } else if (a.type === 'image') { x.value = null; x.thumb = await smallImg(r.value); } else if (a.type === 'notes') x.value = (r.value || []).map(n => n.t); else x.value = r.value;
    responses.push(x); }
  L.session.had = true; try { await HBRP.addActivity(info, { id: a.id, type: a.type, prompt: a.prompt, options: a.options || [], correct: a.type === 'poll' && Number.isInteger(a.correct) ? a.correct : null, once: a.once !== false, secs: a.endsAt ? Math.round((a.endsAt - (a.started || Date.now())) / 1000) : 0, started: a.started || Date.now(), ended: Date.now(), responses }); } catch (e) { console.warn('report', e); } }
async function endActivity(thenNew, quiet) { if (!L.act) return; await record(); if (!quiet && L.cont) L.cont = null; if (L.list.size && !thenNew && !quiet && !confirm('End this activity? Put it on the board or export it first if you want to keep the answers.')) return;
  window.HBA && HBA.log('live_activity', { type: L.act.type, answers: L.list.size, students: players().length });
  await D().cmd('endActivity'); L.act = null; L.list.clear(); L.order = []; L.shared = null; if (L.bgUrl) { URL.revokeObjectURL(L.bgUrl); L.bgUrl = null; L.bgImg = null; } closeSpot(); if (!quiet) render(); }
/* other tools (video lessons) send a question to the phones and get a Continue button back */
async function run(cfg, cont) { await open(); if (!L.el) return false; if (L.act) await endActivity(true, true); L.cont = cont || null; await start(cfg); return true; }
const connected = () => players().filter(p => p.online).length;

/* ---------- starting an activity ---------- */
function setup(type) { const t = TYPES[type]; const timeOpts = [[0, 'No time limit'], [30, '30 seconds'], [60, '1 minute'], [90, '1½ minutes'], [120, '2 minutes'], [180, '3 minutes'], [300, '5 minutes'], [600, '10 minutes'], [900, '15 minutes'], [1200, '20 minutes'], [1800, '30 minutes']];
  const PRE = { abcd: ['A', 'B', 'C', 'D'], tf: ['True', 'False'], yn: ['Yes', 'No', 'Not sure'], agree: ['Strongly agree', 'Agree', 'Disagree', 'Strongly disagree'] };
  const hint = { draw: 'e.g. Draw and label a plant cell.', poll: 'e.g. Which organelle releases energy?', word: 'e.g. One word that describes photosynthesis.', text: 'e.g. Explain why enzymes stop working at high temperatures.', image: 'e.g. Photograph your completed results table.', notes: 'e.g. Post one example of an adaptation.' }[type];
  modal.open('<h2>' + icon(t.ic) + ' ' + esc(t.name) + '</h2><p class="muted" style="margin-top:-4px">' + esc(t.desc) + '</p>' +
    '<label class="small">Question or instruction</label><textarea id="lcP" class="inp" style="width:100%;height:70px;padding:10px;resize:vertical" maxlength="300" placeholder="' + esc(hint) + '"></textarea>' +
    (type === 'poll' ? '<div class="row" style="gap:6px;margin:10px 0 6px;flex-wrap:wrap"><span class="small">Answers:</span>' + [['abcd', 'A B C D'], ['tf', 'True / False'], ['yn', 'Yes / No / Not sure'], ['agree', 'Agree scale'], ['custom', 'Type my own']].map(([k, l]) => '<button class="btn sm" data-pre="' + k + '">' + l + '</button>').join('') + '</div><div id="lcOpts"></div>' : '') +
    (type === 'draw' ? '<div class="small" style="margin:10px 0 4px">Students draw on</div><div class="row" style="gap:6px;flex-wrap:wrap" id="lcBgs">' + [['blank', 'Blank page'], ['board', 'My board now'], ['grid', 'Grid paper'], ['lines', 'Lined paper'], ['axes', 'Graph axes']].map(([k, l], i) => '<button class="btn sm' + (i === 0 ? ' primary' : '') + '" data-bg="' + k + '">' + l + '</button>').join('') + '</div>' : '') +
    '<div class="small" style="margin:12px 0 4px">Answers</div><div class="lc-mode" id="lcMode"><button data-once="1"><b>' + icon('lock') + ' Submit once</b><span>Students press Submit; the answer then locks. Best for checking understanding.</span></button><button data-once="0"><b>' + icon('radio') + ' Live</b><span>Answers appear as students work and can change until time is up. Best for brainstorming.</span></button></div>' +
    '<div class="row" style="gap:10px;margin-top:12px;flex-wrap:wrap;align-items:center"><label class="small">Time limit <select class="sel" id="lcT">' + timeOpts.map(([v, l]) => '<option value="' + v + '"' + (v === set.get('lcSecs', type === 'draw' ? 180 : type === 'poll' ? 60 : 120) ? ' selected' : '') + '>' + l + '</option>').join('') + '</select></label><label class="small"><input type="checkbox" id="lcAuto"' + (set.get('lcAuto', true) ? ' checked' : '') + '> Hand in unsent work when time is up</label><label class="small"><input type="checkbox" id="lcA"> Hide names on my screen</label></div>' +
    '<div class="foot"><button class="btn" data-close>Cancel</button><button class="btn primary" id="lcGo">' + icon('radio') + 'Send to phones</button></div>', sh => {
    let bg = 'blank', opts = PRE.abcd.slice(), correct = null, once = set.get('lcOnce:' + type, type !== 'notes' && type !== 'word');
    const drawMode = () => $$('#lcMode button', sh).forEach(b => b.classList.toggle('on', (b.dataset.once === '1') === once)); drawMode();
    $$('#lcMode button', sh).forEach(b => b.onclick = () => { once = b.dataset.once === '1'; drawMode(); });
    const drawOpts = () => { const box = sh.querySelector('#lcOpts'); if (!box) return; box.innerHTML = opts.map((o, i) => '<div class="row" style="gap:6px;margin:4px 0"><span style="width:28px;height:28px;border-radius:8px;display:grid;place-items:center;font-weight:900;color:#1E1419;background:' + POLL_C[i] + '">' + 'ABCDEF'[i] + '</span><input class="inp" data-o="' + i + '" value="' + esc(o) + '" maxlength="80" style="flex:1;height:34px"><label class="small" title="Mark as the right answer"><input type="radio" name="lcC" data-c="' + i + '"' + (correct === i ? ' checked' : '') + '> right</label>' + (opts.length > 2 ? '<button class="ib" data-x="' + i + '" title="Remove">' + icon('x') + '</button>' : '') + '</div>').join('') + (opts.length < 6 ? '<button class="btn sm" id="lcAdd">' + icon('plus') + 'Add an answer</button>' : '') + '<div class="small muted" style="margin-top:4px">Tick “right” to reveal the answer later (optional).</div>';
      $$('[data-o]', box).forEach(x => x.oninput = () => { opts[+x.dataset.o] = x.value; });
      $$('[data-c]', box).forEach(x => x.onchange = () => { correct = +x.dataset.c; });
      $$('[data-x]', box).forEach(x => x.onclick = () => { opts.splice(+x.dataset.x, 1); if (correct != null && correct >= opts.length) correct = null; drawOpts(); });
      const ad = box.querySelector('#lcAdd'); if (ad) ad.onclick = () => { opts.push(''); drawOpts(); }; };
    drawOpts();
    $$('[data-pre]', sh).forEach(b => b.onclick = () => { opts = b.dataset.pre === 'custom' ? ['', ''] : PRE[b.dataset.pre].slice(); correct = null; drawOpts(); const f = sh.querySelector('[data-o]'); if (b.dataset.pre === 'custom' && f) f.focus(); });
    $$('[data-bg]', sh).forEach(b => b.onclick = () => { bg = b.dataset.bg; $$('[data-bg]', sh).forEach(x => x.classList.toggle('primary', x === b)); });
    const p = sh.querySelector('#lcP'); setTimeout(() => p.focus(), 50);
    sh.querySelector('#lcGo').onclick = async () => { const prompt = p.value.trim(); if (type === 'poll') { opts = opts.map(o => o.trim()); if (opts.some(o => !o)) { toast('Fill in every answer, or remove the empty ones.'); return; } }
      const secs = +sh.querySelector('#lcT').value, auto = sh.querySelector('#lcAuto').checked; set.put('lcSecs', secs); set.put('lcAuto', auto); set.put('lcOnce:' + type, once);
      const cfg = { type, prompt, secs, once, auto, anon: sh.querySelector('#lcA').checked, options: type === 'poll' ? opts : [], correct, bg };
      modal.close(); start(cfg); }; }); }
/* backgrounds for Draw it: the teacher's board, or clean paper */
function paperCanvas(kind) { const W = 1200, H = 900, c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, W, H);
  if (kind === 'grid') { g.strokeStyle = '#cfe0f5'; g.lineWidth = 1; for (let x = 0; x <= W; x += 30) { g.beginPath(); g.moveTo(x + 0.5, 0); g.lineTo(x + 0.5, H); g.stroke(); } for (let y = 0; y <= H; y += 30) { g.beginPath(); g.moveTo(0, y + 0.5); g.lineTo(W, y + 0.5); g.stroke(); } g.strokeStyle = '#a9c6ea'; for (let x = 0; x <= W; x += 150) { g.beginPath(); g.moveTo(x + 0.5, 0); g.lineTo(x + 0.5, H); g.stroke(); } for (let y = 0; y <= H; y += 150) { g.beginPath(); g.moveTo(0, y + 0.5); g.lineTo(W, y + 0.5); g.stroke(); } }
  if (kind === 'lines') { g.strokeStyle = '#bcd3ee'; g.lineWidth = 1.5; for (let y = 90; y < H; y += 54) { g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke(); } g.strokeStyle = '#f4a6b8'; g.beginPath(); g.moveTo(90, 0); g.lineTo(90, H); g.stroke(); }
  if (kind === 'axes') { g.strokeStyle = '#e4ecf6'; for (let x = 120; x <= W - 60; x += 45) { g.beginPath(); g.moveTo(x, 60); g.lineTo(x, H - 120); g.stroke(); } for (let y = H - 120; y >= 60; y -= 45) { g.beginPath(); g.moveTo(120, y); g.lineTo(W - 60, y); g.stroke(); }
    g.strokeStyle = '#1E1419'; g.lineWidth = 3; g.beginPath(); g.moveTo(120, 40); g.lineTo(120, H - 120); g.lineTo(W - 40, H - 120); g.stroke(); g.fillStyle = '#1E1419'; g.beginPath(); g.moveTo(120, 30); g.lineTo(110, 52); g.lineTo(130, 52); g.fill(); g.beginPath(); g.moveTo(W - 30, H - 120); g.lineTo(W - 52, H - 130); g.lineTo(W - 52, H - 110); g.fill(); }
  return c; }
async function start(cfg) {
  let src = null; if (cfg.type === 'draw') src = cfg.bgCanvas || (cfg.bg === 'board' ? HBCL.boardCanvas(1400) : cfg.bg && cfg.bg !== 'blank' ? paperCanvas(cfg.bg) : null);
  const ar = src ? src.width / src.height : 4 / 3; let bytes = null;
  if (src) { const blob = await new Promise(r => src.toBlob(r, 'image/jpeg', 0.85)); bytes = new Uint8Array(await blob.arrayBuffer()); if (L.bgUrl) URL.revokeObjectURL(L.bgUrl); L.bgUrl = URL.createObjectURL(blob); L.bgImg = await new Promise(r => { const im = new Image(); im.onload = () => r(im); im.onerror = () => r(null); im.src = L.bgUrl; }); }
  else { if (L.bgUrl) URL.revokeObjectURL(L.bgUrl); L.bgUrl = null; L.bgImg = null; }
  const r = await D().cmd('activity', { type: cfg.type, prompt: cfg.prompt, options: cfg.options, secs: cfg.secs, anon: cfg.anon, once: cfg.once !== false, auto: cfg.auto !== false, bg: bytes, ar });
  if (!r || r.error) { toast((r && r.error) || 'The activity could not start.'); return; }
  load(r); L.act.correct = cfg.type === 'poll' ? cfg.correct : null; L.act.started = Date.now(); L.shared = null; snd('whoosh'); render();
  if (!L.session) { const E = window.HBE, pg = E && E.page && E.page(); L.session = { id: 'l' + Date.now().toString(36), title: ((pg && pg.name && !/^Page \d+$/.test(pg.name)) ? pg.name : 'Live class') + ' · ' + new Date().toLocaleDateString([], { day: 'numeric', month: 'short' }), started: Date.now() }; }
  const n = players().length; toast(n ? 'Sent to ' + n + ' phone' + (n === 1 ? '' : 's') + ' — answers appear here live.' : 'Activity ready. Students who join now see it straight away.'); }

/* ---------- spotlight: one answer, big ---------- */
function spotlight(pid, refresh) { const r = L.list.get(pid); if (!r) return closeSpot(); if (refresh && !$('#lcSpot')) return; L.spot = pid;
  let o = $('#lcSpot'); if (!o) { o = document.createElement('div'); o.id = 'lcSpot'; document.body.appendChild(o); o.addEventListener('click', e => { if (e.target === o) closeSpot(); }); document.addEventListener('keydown', spotKeys, true); if (window.gsap && !REDUCE) gsap.from(o, { opacity: 0, duration: 0.18 }); }
  const ids = sorted().map(x => x.pid), i = ids.indexOf(pid), a = L.act;
  let view = '';
  if (a.type === 'draw') view = '<canvas id="lcSpCv"></canvas>'; else if (a.type === 'image') view = '<img src="' + esc(r.value) + '" alt="">';
  else if (a.type === 'notes') view = '<div style="display:flex;gap:14px;flex-wrap:wrap;justify-content:center">' + r.value.map(n => '<div class="txt" style="background:' + NOTE_C[n.c] + ';color:#1E1419;border:0">' + esc(n.t) + '</div>').join('') + '</div>';
  else if (a.type === 'word') view = '<div class="txt">' + r.value.map(esc).join(' · ') + '</div>'; else view = '<div class="txt">' + esc(r.value) + '</div>';
  o.innerHTML = '<div class="nm"><span style="color:' + esc(r.color) + '">●</span> ' + esc(nameOf(r)) + ' <span style="color:var(--gold);font:800 16px var(--mono)">' + (starsOf(pid) ? '★' + starsOf(pid) : '') + '</span></div><div class="box">' + view + '</div><div class="row"><button class="btn" id="spPrev"' + (i <= 0 ? ' disabled' : '') + '>' + icon('chevron-left') + '</button><button class="btn" id="spStar">' + icon('star') + 'Give a star</button><button class="btn' + (L.shared === pid ? ' primary' : '') + '" id="spShare">' + icon('megaphone') + (L.shared === pid ? 'Stop sharing' : 'Share with class') + '</button><button class="btn" id="spBoard">' + icon('image-down') + 'Put on board</button><button class="btn" id="spDel" title="Remove this answer — the student can then answer again">' + icon('trash-2') + 'Remove · let them redo</button><button class="btn" id="spNext"' + (i >= ids.length - 1 ? ' disabled' : '') + '>' + icon('chevron-right') + '</button><button class="btn" id="spX">Close ✕</button></div>';
  if (a.type === 'draw') { const cv = o.querySelector('#lcSpCv'), big = composite(r, 1400); cv.width = big.width; cv.height = big.height; cv.getContext('2d').drawImage(big, 0, 0); cv.style.aspectRatio = big.width + '/' + big.height; }
  const q = s => o.querySelector(s);
  q('#spPrev').onclick = () => i > 0 && spotlight(ids[i - 1]); q('#spNext').onclick = () => i < ids.length - 1 && spotlight(ids[i + 1]);
  q('#spStar').onclick = () => award(pid); q('#spShare').onclick = () => share(L.shared === pid ? null : pid); q('#spBoard').onclick = () => toBoard(pid); q('#spX').onclick = closeSpot;
  q('#spDel').onclick = async () => { await D().cmd('removeResponse', { pid }); L.list.delete(pid); L.order = L.order.filter(p => p !== pid); if (L.shared === pid) L.shared = null; closeSpot(); renderBody(); renderHead(); renderSide(); toast('Answer removed — that student can send a new one.'); }; }
function spotKeys(e) { if (!$('#lcSpot')) return; const ids = sorted().map(x => x.pid), i = ids.indexOf(L.spot);
  if (e.key === 'Escape') { e.stopPropagation(); e.preventDefault(); closeSpot(); } else if (e.key === 'ArrowRight' && i < ids.length - 1) { e.preventDefault(); spotlight(ids[i + 1]); } else if (e.key === 'ArrowLeft' && i > 0) { e.preventDefault(); spotlight(ids[i - 1]); } }
function closeSpot() { const o = $('#lcSpot'); if (o) o.remove(); L.spot = null; document.removeEventListener('keydown', spotKeys, true); }

/* ---------- pictures for the board ---------- */
function composite(r, W) { const ar = L.act.ar || 4 / 3, H = Math.round(W / ar), c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, W, H); if (L.bgImg) g.drawImage(L.bgImg, 0, 0, W, H); g.drawImage(inkCanvas(r.value, W, H), 0, 0); return c; }
const loadImg = src => new Promise(ok => { const im = new Image(); im.onload = () => ok(im); im.onerror = () => ok(null); im.src = src; });
function wrapText(g, text, x, y, maxW, lh, maxLines) { const words = String(text).split(/\s+/); let line = '', n = 0; for (const w of words) { const t = line ? line + ' ' + w : w; if (g.measureText(t).width > maxW && line) { g.fillText(line, x, y + n * lh); n++; line = w; if (n >= maxLines) return; } else line = t; } if (line && n < maxLines) g.fillText(line, x, y + n * lh); }
async function galleryCanvas(onlyPid) { const a = L.act, list = onlyPid ? [L.list.get(onlyPid)] : sorted(); if (!list.length || !list[0]) return null;
  if (a.type === 'word') return cloudCanvas(1600, 800, false);
  if (a.type === 'poll') { const W = 1400, rowH = 96, H = 120 + a.options.length * rowH, c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, W, H); g.fillStyle = '#1E1419'; g.font = '700 34px "Space Grotesk", sans-serif'; wrapText(g, a.prompt || 'Poll', 40, 56, W - 80, 40, 1);
    const counts = a.options.map(() => 0); L.list.forEach(r => { if (counts[r.value] != null) counts[r.value]++; }); const max = Math.max(1, ...counts), tot = L.list.size || 1;
    a.options.forEach((o, i) => { const y = 100 + i * rowH; g.fillStyle = POLL_C[i]; g.fillRect(40, y, 56, 56); g.fillStyle = '#1E1419'; g.font = '900 30px sans-serif'; g.fillText('ABCDEF'[i], 58, y + 39); g.fillStyle = '#f3eef3'; g.fillRect(116, y, W - 340, 56); g.fillStyle = POLL_C[i]; g.fillRect(116, y, (W - 340) * counts[i] / max, 56); if (a.reveal === i) { g.strokeStyle = '#2F9E44'; g.lineWidth = 5; g.strokeRect(116, y, W - 340, 56); }
      g.fillStyle = '#1E1419'; g.font = '700 26px "Segoe UI", sans-serif'; wrapText(g, o + (a.reveal === i ? ' ✓' : ''), 132, y + 37, W - 380, 30, 1); g.font = '800 26px monospace'; g.fillText(counts[i] + ' · ' + Math.round(counts[i] / tot * 100) + '%', W - 200, y + 37); });
    return c; }
  const n = list.length, cols = onlyPid ? 1 : Math.min(n, Math.max(1, L.cols)), rows = Math.ceil(n / cols), tileW = onlyPid ? 1200 : Math.round(2400 / cols), ar = a.type === 'draw' ? a.ar : a.type === 'image' ? 4 / 3 : 1.6, tileH = Math.round(tileW / ar), lab = 44, gap = 16;
  const W = cols * tileW + (cols + 1) * gap, H = rows * (tileH + lab) + (rows + 1) * gap, c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d'); g.fillStyle = '#F3EEF3'; g.fillRect(0, 0, W, H);
  for (let k = 0; k < n; k++) { const r = list[k], x = gap + (k % cols) * (tileW + gap), y = gap + Math.floor(k / cols) * (tileH + lab + gap); g.fillStyle = '#fff'; g.fillRect(x, y, tileW, tileH + lab);
    if (a.type === 'draw') g.drawImage(composite(r, tileW), x, y, tileW, tileH);
    else if (a.type === 'image') { const im = await loadImg(r.value); if (im) { const k2 = Math.min(tileW / im.width, tileH / im.height), w = im.width * k2, h = im.height * k2; g.fillStyle = '#111'; g.fillRect(x, y, tileW, tileH); g.drawImage(im, x + (tileW - w) / 2, y + (tileH - h) / 2, w, h); } }
    else if (a.type === 'notes') { r.value.forEach((nt, i) => { const nh = tileH / Math.max(1, r.value.length); g.fillStyle = NOTE_C[nt.c]; g.fillRect(x + 8, y + 8 + i * nh, tileW - 16, nh - 8); g.fillStyle = '#1E1419'; g.font = '600 ' + Math.round(Math.min(30, tileW / 20)) + 'px "Segoe UI", sans-serif'; wrapText(g, nt.t, x + 22, y + 44 + i * nh, tileW - 44, Math.round(Math.min(34, tileW / 17)), Math.max(1, Math.floor((nh - 30) / 34))); }); }
    else { g.fillStyle = '#1E1419'; const fs = Math.round(Math.min(34, tileW / 18)); g.font = '600 ' + fs + 'px "Segoe UI", sans-serif'; wrapText(g, r.value, x + 22, y + 22 + fs, tileW - 44, Math.round(fs * 1.3), Math.floor((tileH - 30) / (fs * 1.3))); }
    g.fillStyle = '#271A2C'; g.fillRect(x, y + tileH, tileW, lab); g.fillStyle = r.color; g.beginPath(); g.arc(x + 22, y + tileH + lab / 2, 7, 0, Math.PI * 2); g.fill(); g.fillStyle = '#F6ECF4'; g.font = '700 22px "Segoe UI", sans-serif'; g.fillText(nameOf(r), x + 38, y + tileH + 30); }
  return c; }
async function toBoard(pid) { const c = await galleryCanvas(pid); if (!c) { toast('There is nothing to put on the board yet.'); return; }
  const url = c.toDataURL(c.width * c.height > 6e6 ? 'image/jpeg' : 'image/png', 0.9); closeSpot(); hide(); window.HBI.insertImage(url); snd('pop'); toast('Added to the board — it is a picture you can move, resize and write on.'); }
function csv() { const a = L.act; const rows = [['Name', 'Answer', 'Time', 'Stars']];
  sorted().forEach(r => { let v = r.value; if (a.type === 'poll') v = 'ABCDEF'[v] + ') ' + a.options[v]; else if (a.type === 'word') v = v.join(', '); else if (a.type === 'notes') v = v.map(n => n.t).join(' | '); else if (a.type === 'draw') v = '(drawing — ' + v.length + ' lines)'; else if (a.type === 'image') v = '(photo)';
    rows.push([r.name, String(v), new Date(r.at).toLocaleTimeString(), starsOf(r.pid)]); });
  players().filter(p => !L.list.has(p.pid)).forEach(p => rows.push([p.name, '(no answer)', '', p.stars]));
  const text = '﻿' + rows.map(r => r.map(x => '"' + String(x).replace(/"/g, '""') + '"').join(',')).join('\r\n'); const b = new Blob([text], { type: 'text/csv' }), aEl = document.createElement('a'); aEl.href = URL.createObjectURL(b); aEl.download = (TYPES[a.type].name + ' ' + new Date().toLocaleDateString()).replace(/[\\/:*?"<>|]+/g, '-') + '.csv'; aEl.click(); setTimeout(() => URL.revokeObjectURL(aEl.href), 4000); }

/* ---------- stars leaderboard (ClassPoint-style) ---------- */
function leaderboard() { const ps = players().slice().sort((a, b) => b.stars - a.stars || a.name.localeCompare(b.name)); const top = ps.filter(p => p.stars > 0);
  const medal = ['🥇', '🥈', '🥉'];
  modal.open('<h2>' + icon('trophy') + ' Stars</h2>' + (top.length ? '<div style="display:flex;justify-content:center;align-items:flex-end;gap:14px;margin:10px 0 18px">' + [1, 0, 2].filter(i => top[i]).map(i => '<div style="text-align:center"><div style="font-size:30px">' + medal[i] + '</div><div style="font:800 16px var(--head)">' + esc(top[i].name) + '</div><div style="width:110px;height:' + [120, 90, 70][i] + 'px;border-radius:12px 12px 0 0;background:linear-gradient(180deg,' + ['#FFC928', '#C9D6E3', '#E8A87C'][i] + ',transparent);display:grid;place-items:center;font:900 26px var(--mono);color:#1E1419">★' + top[i].stars + '</div></div>').join('') + '</div>' : '<p class="muted">No stars yet — tap ⭐ on any answer or next to a name to award one.</p>') +
    '<div style="max-height:40vh;overflow:auto">' + ps.map((p, i) => '<div class="st-stem" style="padding:6px 8px"><span><b style="display:inline-block;width:28px">' + (i + 1) + '</b>' + esc(p.name) + '</span><b style="color:var(--gold)">★ ' + p.stars + '</b></div>').join('') + '</div><div class="foot"><button class="btn primary" data-close>Close</button></div>'); }

/* the Live class button in the top bar (red dot while an activity is running) */
{ const top = document.getElementById('aUndo'); if (top) { const b = document.createElement('button'); b.id = 'aLive'; b.title = 'Live class: polls, drawings, word clouds and more on students’ phones'; b.innerHTML = icon('radio') + '<span class="lbl">Live class</span><span class="dot"></span>'; b.onclick = () => open(); const sep = document.createElement('span'); sep.className = 'sep'; top.parentNode.insertBefore(b, top.parentNode.firstChild); top.parentNode.insertBefore(sep, b.nextSibling); } }
setInterval(() => { const b = document.getElementById('aLive'); if (b) b.classList.toggle('on', !!L.act); }, 1000);
addEventListener('beforeunload', () => { if (L.act) record(); });
window.HBLC = { open, event, closed, hide, setup, run, endSession, pick: () => window.HBCL && HBCL.on ? pickName() : toast('Start Live class first — students join with the QR code.'), get active() { return !!L.act; }, get students() { return window.HBCL && HBCL.on ? connected() : 0; } };
})();
