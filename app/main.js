/* ================= HelixBoard — start-up: restore the last board, start drawing ================= */
(async () => {
'use strict';
const { IDB, bus, toast, set } = window.HB; const E = window.HBE;
E.resize();
try { const s = await IDB.get('board'); if (s) { const a = (await IDB.get('assets')) || {}; E.loadBoard(s, a); } else { E.fitWidth(true); } } catch (e) { E.fitWidth(true); }
requestAnimationFrame(E.drawFrame);
const q = new URLSearchParams(location.search); if (q.get('theme') && E.THEMES[q.get('theme')]) window.HBUI.setTheme(q.get('theme'));
/* the opening titles play at every start (short, skippable; can be turned off in Page → Start) */
if (!q.has('nointro') && (!set.get('seenIntro', false) || set.get('introEvery', true))) { setTimeout(() => window.HBIntro && HBIntro.play(true), 60); }
/* moving the window between the laptop screen and the smartboard can change the pixel ratio: re-size the canvases so ink stays sharp and touch lines up */
const watchDPR = () => { try { const mq = matchMedia('(resolution: ' + devicePixelRatio + 'dppx)'); mq.addEventListener('change', () => { E.resize(); watchDPR(); }, { once: true }); } catch (e) {} }; watchDPR();
bus.emit('ready');
/* tablets and browsers: works offline and updates itself (service worker); not used inside the Windows app or from a local file */
if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol) && !window.helixDesktop) {
  navigator.serviceWorker.register('sw.js').then(reg => {
    const offer = w => { if (!w || document.getElementById('hbUpd')) return; const b = document.createElement('div'); b.id = 'hbUpd'; b.style.cssText = 'position:fixed;left:50%;bottom:16px;transform:translateX(-50%);z-index:70;display:flex;gap:10px;align-items:center;padding:10px 12px 10px 16px;border-radius:14px;background:var(--panel);border:1px solid var(--line);box-shadow:var(--shadow);font:600 14px var(--head)';
      b.innerHTML = '<span>A new version of HelixBoard is ready.</span><button class="btn primary" id="hbUpdGo">Update now</button><button class="btn" id="hbUpdNo">Later</button>'; document.body.appendChild(b);
      b.querySelector('#hbUpdGo').onclick = () => { w.postMessage('skip-waiting'); }; b.querySelector('#hbUpdNo').onclick = () => b.remove(); };
    if (reg.waiting && navigator.serviceWorker.controller) offer(reg.waiting);
    reg.addEventListener('updatefound', () => { const w = reg.installing; w && w.addEventListener('statechange', () => { if (w.state === 'installed' && navigator.serviceWorker.controller) offer(w); }); });
    setInterval(() => reg.update().catch(() => {}), 30 * 60e3);
  }).catch(e => console.warn('Offline support unavailable:', e));
  let reloading = false; navigator.serviceWorker.addEventListener('controllerchange', () => { if (reloading) return; reloading = true; location.reload(); });
}
/* Windows desktop app (Electron): files opened from Explorer, and a working prompt() */
if (window.helixDesktop) { const D = window.helixDesktop; window.prompt = (m, d) => D.prompt(String(m == null ? '' : m), String(d == null ? '' : d));
  D.onOpenFile(({ name, data }) => { const f = new File([data], name), ext = (name.split('.').pop() || '').toLowerCase();
    if (ext === 'helix') window.HBIO.readHelix(f); else if (ext === 'hbset') window.HBL.importFiles([f]); else if (ext === 'hbhw') window.HBL.importHomework([f]); else if (ext === 'hbres') window.HBL.importResults([f]); else window.HBIO.openDoc(f); }); if (D.onInsertImage) D.onInsertImage(url => { window.HBI.insertImage(url); toast('Screen picture added to the board.'); }); D.ready(); }
/* after an update: a short "What's new" card, once (not on a first install) */
{ const ver = window.HBA && HBA.version, seen = set.get('seenVer', ''); if (ver && seen !== ver) { if (!set.get('seenIntro', false) && !seen) set.put('seenVer', ver); else {
  const show = () => { if (document.getElementById('intro') && !document.getElementById('intro').hidden) return setTimeout(show, 800); set.put('seenVer', ver); const { modal, icon } = window.HB;
    const items = [['brain-circuit', 'Concept maps that just work', 'Notes → Concept map. Round + handles add branches and sub-branches; pen taps select, drags move a branch.', () => window.HBMM && HBMM.open()],
      ['radio', 'One join for the whole lesson', 'Students scan once: the phone quiz now runs inside the class, and phones move into it by themselves.', () => window.HBLC && HBLC.open()],
      ['trophy', 'Quiz games', 'Teams, boss battle, power-ups, “How sure?” and a ghost race — in the phone quiz lobby.', () => window.HBL && HBL.phoneQuiz()],
      ['scan-line', 'Paper answer cards', 'No phones? Students hold up printed cards and your webcam reads the room.', () => window.HBPC && HBPC.menu()],
      ['presentation', 'PowerPoint like Office', 'Each slide’s own transition, 4K slides that stay light on memory, and live questions on slides.', null],
      ['mic', 'Expert notes', 'Record the lesson with your ink, find anything on any page (Ctrl+F), export to Word.', () => window.HBNX && HBNX.finder('find')]];
    modal.open('<h2>' + icon('sparkles') + ' What’s new in HelixBoard ' + ver + '</h2><div style="display:grid;gap:8px">' + items.map((it, i) => '<button class="btn" data-wn="' + i + '" style="height:auto;justify-content:flex-start;text-align:left;padding:10px 12px;gap:12px">' + icon(it[0]) + '<span><b>' + it[1] + '</b><br><span class="small muted">' + it[2] + '</span></span></button>').join('') + '</div><div class="foot"><button class="btn primary" data-close>Start teaching</button></div>', sh => {
      sh.querySelectorAll('[data-wn]').forEach(b => b.onclick = () => { const f = items[+b.dataset.wn][3]; modal.close(); if (f) setTimeout(f, 60); }); }); };
  setTimeout(show, 1500); } } }
if (window.__hbErr && window.__hbErr.length) setTimeout(() => toast('Part of HelixBoard could not start (' + window.__hbErr.join('; ') + '). Everything else works — please send a screenshot of this message.'), 800);
})();

