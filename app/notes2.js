/* ================= HelixBoard — expert note-taking =================
   Audio notes (like Notability): record the lesson while you write; play it back and the ink reappears exactly when it was
   written, or tap any line of ink to hear what was being said at that moment. Find in notes (like OneNote): search every page,
   an outline of sections and headings, and every tag (✓ ✗ ★ ? !) in one list. Export the notes as a Word document or Markdown. */
(() => {
'use strict';
const { $, $$, esc, icon, set, toast, modal, IDB, SND, floatPanel, bus } = window.HB;
const E = window.HBE, I = window.HBI;
const snd = k => { try { SND[k] && SND[k](); } catch (e) {} };
const fmt = s => { s = Math.max(0, Math.round(s)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };

/* ---------- recording ---------- */
const A = { rec: null, chunks: [], t0: 0, stream: null, pill: null, tick: 0, player: null, audio: null, cur: null, replay: true, jump: false, raf: 0 };
async function record() { if (A.rec) return stopRec();
  let stream; try { stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } }); } catch (e) { toast('The microphone could not start: ' + esc(e.message || e.name), 5000); return; }
  const type = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg'].find(t => window.MediaRecorder && MediaRecorder.isTypeSupported(t)) || '';
  A.stream = stream; A.chunks = []; A.rec = new MediaRecorder(stream, type ? { mimeType: type, audioBitsPerSecond: 48000 } : undefined); A.t0 = Date.now(); A.page = E.page().id;
  A.rec.ondataavailable = e => { if (e.data && e.data.size) A.chunks.push(e.data); }; A.rec.onstop = saveRec; A.rec.start(1000);
  const p = document.createElement('div'); p.id = 'anRec'; p.innerHTML = '<span class="dot"></span><b>REC</b><span id="anT">0:00</span><button title="Pause">' + icon('pause') + '</button><button title="Stop and save">' + icon('square') + '</button>'; document.body.appendChild(p); A.pill = p;
  const [pb, sb] = p.querySelectorAll('button'); pb.onclick = () => { if (A.rec.state === 'recording') { A.rec.pause(); A.pausedAt = Date.now(); p.classList.add('paused'); pb.innerHTML = icon('play'); } else { A.rec.resume(); A.pauseMs = (A.pauseMs || 0) + Date.now() - A.pausedAt; p.classList.remove('paused'); pb.innerHTML = icon('pause'); } }; sb.onclick = stopRec;
  A.pauseMs = 0; A.tick = setInterval(() => { const t = $('#anT'); if (t && A.rec && A.rec.state === 'recording') t.textContent = fmt((Date.now() - A.t0 - A.pauseMs) / 1000); }, 500);
  toast('Recording the lesson — write as usual. Everything you write is linked to this moment of the recording.', 4200); snd('pop'); }
function stopRec() { if (!A.rec) return; clearInterval(A.tick); if (A.rec.state !== 'inactive') A.rec.stop(); A.stream.getTracks().forEach(t => t.stop()); if (A.pill) A.pill.remove(); A.pill = null; }
async function saveRec() { const rec = A.rec; A.rec = null; const blob = new Blob(A.chunks, { type: rec.mimeType || 'audio/webm' }); A.chunks = []; if (!blob.size) return;
  const id = 'r' + Date.now().toString(36), t1 = Date.now(), p = E.B.pages.find(x => x.id === A.page) || E.page(), n = (p.recs || []).length + 1;
  await IDB.put('audio:' + id, blob); p.recs = (p.recs || []).concat({ id, t0: A.t0, t1, pause: A.pauseMs || 0, name: 'Recording ' + n + ' · ' + new Date(A.t0).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }); E.changed();
  toast('Saved the recording with your notes — Notes → Play recordings to hear it with your ink.', 4200); snd('done'); }

/* ---------- playback: ink appears in step with the recording; tap ink to jump ---------- */
function recsOf(p) { return ((p || E.page()).recs || []).slice(); }
async function play(id) { const recs = recsOf(); if (!recs.length) { toast('No recordings on this page yet — Notes → Record lesson audio.'); return; }
  const r = recs.find(x => x.id === id) || recs[recs.length - 1], blob = await IDB.get('audio:' + r.id); if (!blob) { toast('That recording is no longer on this computer.'); return; }
  closePlayer(); A.cur = r; const url = URL.createObjectURL(blob), au = new Audio(url); A.audio = au; A.url = url;
  const el = document.createElement('div'); el.id = 'anPlay';
  el.innerHTML = '<button id="anPP" class="pp" title="Play / pause (Space)">' + icon('play') + '</button><select class="sel" id="anSel" title="Recordings on this page">' + recs.map(x => '<option value="' + x.id + '"' + (x.id === r.id ? ' selected' : '') + '>' + esc(x.name) + '</option>').join('') + '</select><span id="anCur">0:00</span><input type="range" id="anBar" min="0" max="1000" value="0"><span id="anDur">' + fmt((r.t1 - r.t0 - (r.pause || 0)) / 1000) + '</span>' +
    '<select class="sel" id="anSp" title="Speed">' + [0.75, 1, 1.25, 1.5, 2].map(v => '<option value="' + v + '"' + (v === 1 ? ' selected' : '') + '>' + v + '×</option>').join('') + '</select><button id="anRe" class="tg' + (A.replay ? ' on' : '') + '" title="Show the ink as it was written">' + icon('pen-line') + 'Replay ink</button><button id="anJ" class="tg' + (A.jump ? ' on' : '') + '" title="Tap any line of ink to hear what was said then">' + icon('mouse-pointer-click') + 'Tap ink to jump</button><button id="anDl" title="Save the audio file">' + icon('download') + '</button><button id="anDel" title="Delete this recording">' + icon('trash-2') + '</button><button id="anX" title="Close">' + icon('x') + '</button>';
  document.body.appendChild(el); A.player = el; const q = s => el.querySelector(s), bar = q('#anBar');
  const total = () => isFinite(au.duration) && au.duration > 0 ? au.duration : (r.t1 - r.t0 - (r.pause || 0)) / 1000;
  /* the ink filter: inside this recording's time window, hide what was written after the playback point */
  const filt = () => { if (!A.replay || !A.cur) { E.setViewFilter(null); return; } const cut = r.t0 + au.currentTime * 1000 + (r.pause && au.currentTime * 1000 > 0 ? 0 : 0); E.setViewFilter(o => o.ts > r.t0 && o.ts <= r.t1 + 2000 && o.ts > cut); };
  const upd = () => { q('#anCur').textContent = fmt(au.currentTime); bar.value = Math.round(au.currentTime / total() * 1000) || 0; filt(); };
  const loop = () => { upd(); if (!au.paused) A.raf = setTimeout(loop, 120); };
  q('#anPP').onclick = () => { if (au.paused) { au.play(); q('#anPP').innerHTML = icon('pause'); loop(); } else { au.pause(); q('#anPP').innerHTML = icon('play'); } };
  au.onended = () => { q('#anPP').innerHTML = icon('play'); upd(); E.setViewFilter(null); };
  bar.oninput = () => { au.currentTime = bar.value / 1000 * total(); upd(); };
  q('#anSp').onchange = e => { au.playbackRate = +e.target.value; };
  q('#anSel').onchange = e => play(e.target.value);
  q('#anRe').onclick = e => { A.replay = !A.replay; e.currentTarget.classList.toggle('on', A.replay); filt(); };
  q('#anJ').onclick = e => { A.jump = !A.jump; e.currentTarget.classList.toggle('on', A.jump); if (A.jump) toast('Tap any writing from this recording to hear that moment.'); };
  q('#anDl').onclick = () => { const a = document.createElement('a'); a.href = url; a.download = r.name.replace(/[\\/:*?"<>|]+/g, '-') + '.webm'; a.click(); };
  q('#anDel').onclick = () => window.HB.ask('Delete “' + esc(r.name) + '”? Your writing stays.', 'Delete', async () => { const p = E.page(); p.recs = (p.recs || []).filter(x => x.id !== r.id); await IDB.put('audio:' + r.id, null); E.changed(); closePlayer(); toast('Recording deleted.'); });
  q('#anX').onclick = closePlayer; upd(); }
function closePlayer() { clearTimeout(A.raf); if (A.audio) { A.audio.pause(); A.audio = null; } if (A.url) URL.revokeObjectURL(A.url); A.url = null; if (A.player) A.player.remove(); A.player = null; A.cur = null; E.setViewFilter(null); }
/* tap ink → jump the recording to a moment just before that line was written */
document.addEventListener('pointerdown', e => { if (!A.player || !A.jump || !A.cur || !A.audio || e.target.id !== 'cvLive') return; const r = e.target.getBoundingClientRect(), V = E.V;
  const x = (e.clientX - r.left - V.x) / V.s, y = (e.clientY - r.top - V.y) / V.s, o = I.hitTop(x, y, 10 / V.s), rc = A.cur;
  if (!o || !(o.ts > rc.t0 && o.ts <= rc.t1 + 2000)) { toast('That was not written during this recording.'); e.stopPropagation(); e.preventDefault(); return; }
  e.stopPropagation(); e.preventDefault(); A.audio.currentTime = Math.max(0, (o.ts - rc.t0) / 1000 - 3); if (A.audio.paused) A.player.querySelector('#anPP').click(); else { A.player.querySelector('#anBar').dispatchEvent(new Event('input')); } }, true);
bus.on('page', () => { if (A.player) closePlayer(); });

/* ---------- find, outline and tags across every page ---------- */
const textOf = o => typeof o.s === 'string' ? o.s : typeof o.label === 'string' ? o.label : '';
function goTo(pi, o) { const B = E.B; if (B.cur !== pi) window.HBUI.goPage(pi); setTimeout(() => { const V = E.V, b = E.bbox ? E.bbox(o) : [o.x, o.y, o.w || 0, o.h || 0], cx = b[0] + b[2] / 2, cy = b[1] + b[3] / 2; E.setView(V.s, E.SW / 2 - cx * V.s, E.SH / 3 - cy * V.s); try { I.select([o]); } catch (e) {} E.dirty.all(); }, 60); }
function finder(tab) { const f = floatPanel('notesfind', 'Find in notes', '<div class="nf-tabs"><button data-t="find">' + icon('search') + 'Search</button><button data-t="outline">' + icon('list-tree') + 'Outline</button><button data-t="tags">' + icon('bookmark') + 'Tags</button></div><input class="inp" id="nfQ" placeholder="Search every page…" style="width:100%;margin:8px 0"><div id="nfR" class="nf-r"></div>', { icon: 'search', w: 380 });
  const body = f.body, q = body.querySelector('#nfQ'), out = body.querySelector('#nfR'); let cur = tab || 'find';
  const pages = () => E.B.pages.map((p, pi) => ({ p, pi, name: p.name || 'Page ' + (pi + 1) }));
  const row = (pi, o, html) => '<button class="nf-it" data-p="' + pi + '" data-o="' + esc(o.id) + '">' + html + '</button>';
  const draw = () => { $$('.nf-tabs button', body).forEach(b => b.classList.toggle('on', b.dataset.t === cur)); q.hidden = cur !== 'find'; let h = '';
    if (cur === 'find') { const s = q.value.trim().toLowerCase(); if (s.length < 2) { out.innerHTML = '<div class="small muted">Type two letters or more. Searches typed text, sticky notes, mind maps and handwriting you converted to text, on every page.</div>'; return; }
      let n = 0; pages().forEach(({ p, pi, name }) => { const hits = p.objs.filter(o => textOf(o).toLowerCase().includes(s)); if (!hits.length) return; n += hits.length;
        h += '<div class="nf-pg">' + esc(name) + ' <span>' + hits.length + '</span></div>' + hits.slice(0, 30).map(o => { const t = textOf(o).replace(/\s+/g, ' '), i = t.toLowerCase().indexOf(s), a = Math.max(0, i - 40); return row(pi, o, (a ? '…' : '') + esc(t.slice(a, i)) + '<mark>' + esc(t.slice(i, i + s.length)) + '</mark>' + esc(t.slice(i + s.length, i + s.length + 60))); }).join(''); });
      out.innerHTML = h || '<div class="small muted">Nothing found for “' + esc(q.value) + '”.</div>'; }
    else if (cur === 'outline') { pages().forEach(({ p, pi, name }) => { const hs = p.objs.filter(o => o.t === 'text' && !o.stamp && textOf(o).trim() && (o.size >= 34 || o.b && o.size >= 26)).sort((a, b) => a.y - b.y || a.x - b.x), maps = p.objs.filter(o => o.nd && o.root);
        h += '<button class="nf-pg nf-go" data-p="' + pi + '">' + esc(name) + (p.recs && p.recs.length ? ' 🎙' + p.recs.length : '') + (p.deck ? ' · ' + p.deck.slides.length + ' slides' : '') + '</button>' + hs.concat(maps).slice(0, 40).map(o => row(pi, o, (o.nd ? '🧠 ' : o.size >= 44 ? '' : '&nbsp;&nbsp;· ') + esc(textOf(o).split('\n')[0].slice(0, 80)))).join(''); }); out.innerHTML = h; }
    else { const tags = {}; pages().forEach(({ p, pi, name }) => p.objs.filter(o => o.stamp || o.t === 'stamp').forEach(o => { const k = o.stamp ? textOf(o) : o.k; (tags[k] = tags[k] || []).push([pi, o, name]); }));
      const ks = Object.keys(tags); out.innerHTML = ks.length ? ks.map(k => '<div class="nf-pg">' + esc(k) + ' <span>' + tags[k].length + '</span></div>' + tags[k].map(([pi, o, name]) => { const near = E.B.pages[pi].objs.filter(x => x !== o && x.t === 'text' && !x.stamp && Math.abs(x.y - o.y) < 120).sort((a, b) => Math.abs(a.y - o.y) - Math.abs(b.y - o.y))[0]; return row(pi, o, esc(name) + (near ? ' — ' + esc(textOf(near).replace(/\s+/g, ' ').slice(0, 60)) : '')); }).join('')).join('') : '<div class="small muted">No tags yet. Notes → MARK puts ✓ ✗ ★ ? and more on the board; they are all listed here.</div>'; }
    $$('.nf-it', out).forEach(b => b.onclick = () => { const pi = +b.dataset.p, o = E.B.pages[pi].objs.find(x => x.id === b.dataset.o); if (o) goTo(pi, o); });
    $$('.nf-go', out).forEach(b => b.onclick = () => window.HBUI.goPage(+b.dataset.p)); };
  $$('.nf-tabs button', body).forEach(b => b.onclick = () => { cur = b.dataset.t; draw(); }); q.oninput = draw; draw(); if (cur === 'find') setTimeout(() => q.focus(), 50); }

/* ---------- export the notes as text (reading order: top to bottom, left to right) ---------- */
function collect(all) { const out = []; E.B.pages.forEach((p, pi) => { if (!all && pi !== E.B.cur) return; const items = p.objs.filter(o => textOf(o).trim()).sort((a, b) => Math.abs(a.y - b.y) < 20 ? a.x - b.x : a.y - b.y);
  out.push({ name: p.name || 'Page ' + (pi + 1), items: items.map(o => ({ s: textOf(o), h: o.t === 'text' && !o.stamp && (o.size >= 44 ? 2 : o.size >= 30 && o.b ? 3 : 0), tag: !!o.stamp })) , ink: p.objs.filter(o => o.t === 'stroke').length }); }); return out; }
function exportNotes() { modal.open('<h2>' + icon('file-down') + ' Export notes</h2><p class="muted" style="margin-top:-4px">Typed text, sticky notes, mind maps and tags, in reading order. Turn handwriting into text first (Draw → Ink to text) to include it.</p><div class="row" style="gap:10px;margin:6px 0"><label><input type="radio" name="exW" value="cur" checked> This page</label><label><input type="radio" name="exW" value="all"> All ' + E.B.pages.length + ' pages</label></div><div class="foot"><button class="btn" data-close>Cancel</button><button class="btn" id="exMd">' + icon('file-text') + 'Markdown (.md)</button><button class="btn primary" id="exDoc">' + icon('file-type') + 'Word (.doc)</button></div>', s => {
  const go = kind => { const all = s.querySelector('input[name=exW]:checked').value === 'all', data = collect(all), title = (E.B.title || 'HelixBoard notes'); modal.close(); let blob, ext;
    if (kind === 'md') { const md = ['# ' + title, ''].concat(...data.map(pg => ['## ' + pg.name, ''].concat(pg.items.map(it => it.h ? '#'.repeat(it.h + 1) + ' ' + it.s.split('\n')[0] : it.tag ? '> ' + it.s : it.s.replace(/\n/g, '  \n') + '\n'), pg.ink && !pg.items.length ? ['_(handwritten page — ' + pg.ink + ' lines of ink)_', ''] : []))).join('\n'); blob = new Blob([md], { type: 'text/markdown' }); ext = '.md'; }
    else { const h = '<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word"><head><meta charset="utf-8"><title>' + esc(title) + '</title><style>body{font-family:Calibri,Arial,sans-serif;font-size:12pt}h1{color:#B0124F}h2{color:#7048E8;border-bottom:1px solid #ddd}.tag{color:#E8590C;font-weight:bold}</style></head><body><h1>' + esc(title) + '</h1>' +
        data.map(pg => '<h2>' + esc(pg.name) + '</h2>' + pg.items.map(it => it.h ? '<h' + (it.h + 1) + '>' + esc(it.s.split('\n')[0]) + '</h' + (it.h + 1) + '>' : it.tag ? '<p class="tag">' + esc(it.s) + '</p>' : '<p>' + esc(it.s).replace(/\n/g, '<br>') + '</p>').join('') + (pg.ink && !pg.items.length ? '<p><i>(handwritten page — ' + pg.ink + ' lines of ink)</i></p>' : '')).join('') + '</body></html>';
      blob = new Blob(['﻿' + h], { type: 'application/msword' }); ext = '.doc'; }
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = title.replace(/[\\/:*?"<>|]+/g, '-') + ext; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); snd('done'); toast('Saved the notes as ' + (ext === '.md' ? 'Markdown' : 'a Word document') + '.'); };
  s.querySelector('#exMd').onclick = () => go('md'); s.querySelector('#exDoc').onclick = () => go('doc'); }); }

/* ---------- a date-and-time stamp at the top of the view ---------- */
function dateStamp() { const vr = E.viewRect(), d = new Date(), s = d.toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) + ' · ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  E.add([{ t: 'text', x: vr[0] + 40 / E.V.s, y: vr[1] + 40 / E.V.s, w: 0, s, font: 'Lexend', size: Math.round(26 / Math.max(0.4, E.V.s)), c: '#7048E8', b: true }]); snd('pop'); }

const css = document.createElement('style'); css.textContent = `
#anRec{position:fixed;left:50%;transform:translateX(-50%);top:62px;z-index:45;display:flex;align-items:center;gap:8px;height:34px;padding:0 6px 0 12px;border-radius:999px;background:#2b0c16;color:#fff;border:1px solid #ff3b5c;box-shadow:0 10px 26px -10px rgba(0,0,0,.6);font:700 13px var(--ui)}
#anRec .dot{width:10px;height:10px;border-radius:50%;background:#ff3b5c;animation:lcPulse 1.4s infinite}#anRec.paused .dot{animation:none;opacity:.4}#anRec span{font-family:var(--mono)}
#anRec button,#anPlay button{height:26px;min-width:26px;border:0;border-radius:999px;background:rgba(255,255,255,.12);color:inherit;display:inline-flex;align-items:center;gap:5px;padding:0 8px;cursor:pointer;font:700 12px var(--ui)}#anRec svg,#anPlay svg{width:14px;height:14px}
#anPlay{position:fixed;left:50%;transform:translateX(-50%);bottom:100px;z-index:45;display:flex;align-items:center;gap:8px;padding:8px 10px;border-radius:16px;background:var(--panel);border:1px solid var(--line);box-shadow:0 14px 36px -12px rgba(0,0,0,.55);color:var(--ink);font:600 13px var(--ui);max-width:calc(100vw - 24px);flex-wrap:wrap}
#anPlay button{background:var(--panel2)}#anPlay button.on{background:var(--accent);color:var(--accent-ink,#fff)}#anPlay .pp{width:38px;height:38px;background:var(--grad);color:#fff}#anPlay input[type=range]{width:min(260px,30vw)}#anPlay span{font-family:var(--mono);font-size:12px}#anPlay select{height:28px;width:auto;max-width:170px}
.nf-tabs{display:flex;gap:4px}.nf-tabs button{flex:1;height:30px;border:1px solid var(--line);border-radius:9px;background:var(--panel2);color:var(--ink);font:700 12px var(--ui);display:inline-flex;align-items:center;justify-content:center;gap:5px;cursor:pointer}.nf-tabs button.on{background:var(--accent);color:#fff;border-color:transparent}.nf-tabs svg{width:14px;height:14px}
.nf-r{max-height:52vh;overflow:auto;display:flex;flex-direction:column;gap:2px}.nf-pg{font:800 12px var(--ui);color:var(--muted);text-transform:uppercase;letter-spacing:.05em;margin:8px 0 2px;text-align:left;background:none;border:0;padding:0;cursor:default}.nf-pg span{color:var(--accent)}button.nf-go{cursor:pointer}
.nf-it{text-align:left;border:0;background:transparent;color:var(--ink);padding:6px 8px;border-radius:8px;font:500 13px/1.35 var(--ui);cursor:pointer}.nf-it:hover{background:var(--panel2)}.nf-it mark{background:#FFE066;color:#1E1419;border-radius:3px}
`; document.head.appendChild(css);
addEventListener('keydown', e => { if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === 'f' && !e.target.closest('input,textarea,[contenteditable]')) { e.preventDefault(); finder('find'); } });

window.HBNX = { record, stopRec, play, closePlayer, finder, exportNotes, dateStamp, get recording() { return !!A.rec; } };
})();
