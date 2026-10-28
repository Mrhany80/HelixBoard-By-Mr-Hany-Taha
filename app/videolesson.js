/* ================= HelixBoard — Video lessons (Nearpod-style): a video split into parts by questions =================
   Open a video, pause wherever you like and add a question (quick poll, short answer, word cloud, or Draw it on the paused frame).
   In class the video stops by itself at each question: with phones connected the question goes to every phone through Live class and
   answers arrive live; without phones it shows big on the screen. "Continue video" plays on to the next part.
   Questions are remembered for that video on this computer and can be saved as a .hbvid file to share or reuse. */
(() => {
'use strict';
const { $, $$, esc, icon, set, toast, modal, SND, REDUCE } = window.HB;
const snd = k => { try { SND[k] && SND[k](); } catch (e) {} };
const KINDS = { poll: ['chart-column-big', 'Quick poll', '#22D3EE'], text: ['message-square-text', 'Short answer', '#4ADE80'], word: ['cloud', 'Word cloud', '#B197FC'], draw: ['pen-tool', 'Draw it', '#FF5FA2'] };
const POLL_C = ['#FF5FA2', '#22D3EE', '#FFC928', '#4ADE80', '#B197FC', '#FF9F5A'];
const V = { el: null, video: null, file: null, url: null, key: '', qs: [], mode: 'teach', done: new Set(), last: 0, raf: 0, phones: set.get('vlPhones', true), qOpen: null };
const fmt = t => { t = Math.max(0, Math.floor(t || 0)); const h = Math.floor(t / 3600), m = Math.floor(t / 60) % 60, s = t % 60; return (h ? h + ':' + String(m).padStart(2, '0') : m) + ':' + String(s).padStart(2, '0'); };

const css = document.createElement('style'); css.textContent = `
#vlStage{position:fixed;inset:0;z-index:44;background:var(--bg);color:var(--ink);display:grid;grid-template-rows:auto minmax(0,1fr);grid-template-columns:minmax(0,1fr) 330px;font-family:var(--ui)}
#vlStage .vl-top{grid-column:1/-1;display:flex;align-items:center;gap:10px;padding:10px 16px;border-bottom:1px solid var(--line);background:linear-gradient(180deg,color-mix(in srgb,var(--panel2) 70%,var(--panel)),var(--panel))}
#vlStage .vl-top .ttl{display:flex;align-items:center;gap:10px;font:800 18px var(--head);min-width:0}
#vlStage .vl-top .ttl small{font:500 13px var(--ui);color:var(--muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:36vw}
#vlStage .vl-main{display:flex;flex-direction:column;min-height:0;padding:16px 18px;gap:12px}
#vlStage .vl-player{position:relative;flex:1;min-height:0;background:#000;border-radius:18px;overflow:hidden;display:grid;place-items:center;box-shadow:var(--shadow)}
#vlStage video{max-width:100%;max-height:100%;width:100%;height:100%;object-fit:contain;background:#000}
#vlStage .vl-ctl{display:flex;align-items:center;gap:10px}
#vlStage .vl-ctl .play{width:46px;height:46px;border-radius:50%;border:0;background:var(--grad);color:#fff;display:grid;place-items:center;cursor:pointer;flex:none;box-shadow:0 6px 18px -6px rgba(255,95,162,.7)}
#vlStage .vl-ctl .play svg{width:22px;height:22px}
#vlStage .vl-time{font:700 13px var(--mono);color:var(--muted);white-space:nowrap;min-width:110px}
#vlStage .vl-tl{position:relative;flex:1;height:34px;cursor:pointer;display:flex;align-items:center}
#vlStage .vl-tl .rail{position:absolute;left:0;right:0;height:8px;border-radius:4px;background:var(--panel3);overflow:hidden}
#vlStage .vl-tl .rail i{display:block;height:100%;width:0;background:var(--grad)}
#vlStage .vl-tl .mk{position:absolute;top:50%;width:18px;height:18px;margin:-9px 0 0 -9px;border-radius:50%;border:3px solid var(--bg);box-shadow:0 0 0 2px currentColor;background:currentColor;cursor:pointer;transition:transform .12s}
#vlStage .vl-tl .mk:hover{transform:scale(1.25)}
#vlStage .vl-tl .mk.done{opacity:.45}
#vlStage .vl-side{border-inline-start:1px solid var(--line);background:var(--panel);overflow:auto;padding:14px;display:flex;flex-direction:column;gap:12px}
#vlStage h3{margin:0;font:700 12px/1 var(--ui);letter-spacing:.09em;text-transform:uppercase;color:var(--muted)}
#vlStage .vl-q{display:flex;gap:10px;align-items:flex-start;padding:10px;border-radius:14px;background:var(--panel2);border:1px solid var(--line);cursor:pointer}
#vlStage .vl-q:hover{border-color:var(--line2)}
#vlStage .vl-q .ic{width:34px;height:34px;border-radius:10px;display:grid;place-items:center;flex:none;background:color-mix(in srgb,var(--tint) 20%,transparent);color:var(--tint)}
#vlStage .vl-q .ic svg{width:18px;height:18px}
#vlStage .vl-q b{display:block;font:700 12px var(--mono);color:var(--tint)}
#vlStage .vl-q span{font-size:13.5px;line-height:1.35;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
#vlStage .vl-q .x{margin-inline-start:auto;display:flex;gap:2px}
#vlStage .vl-q .x button{border:0;background:none;color:var(--muted);cursor:pointer;padding:3px;border-radius:7px;display:grid;place-items:center}
#vlStage .vl-q .x button:hover{color:var(--ink);background:var(--panel3)}
#vlStage .vl-q .x svg{width:15px;height:15px}
#vlStage .vl-q.done{opacity:.55}
#vlStage .vl-part{font-size:11.5px;color:var(--muted);padding:0 4px}
#vlStage .vl-empty{color:var(--muted);font-size:13.5px;line-height:1.5;padding:14px;border:2px dashed var(--line);border-radius:14px;text-align:center}
#vlStage .vl-drop{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;color:var(--muted);text-align:center;padding:40px}
#vlStage .vl-drop b{font:800 26px var(--head);color:var(--ink)}
#vlQ{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(8,3,12,.72);backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);padding:24px;z-index:2}
#vlQ .card{width:min(900px,100%);background:var(--panel);border:1px solid var(--line2);border-radius:22px;padding:26px 28px;box-shadow:var(--shadow)}
#vlQ .kind{display:inline-flex;align-items:center;gap:6px;padding:5px 11px;border-radius:999px;font-weight:700;font-size:13px;background:color-mix(in srgb,var(--tint) 18%,transparent);color:var(--tint)}
#vlQ .kind svg{width:15px;height:15px}
#vlQ h2{font:800 clamp(22px,2.6vw,34px)/1.25 var(--head);margin:12px 0 16px}
#vlQ .opts{display:grid;grid-template-columns:1fr 1fr;gap:10px}
#vlQ .opt{display:flex;align-items:center;gap:12px;padding:14px;border-radius:14px;background:var(--panel2);border:2px solid var(--line);font:700 18px var(--ui)}
#vlQ .opt .lt{width:38px;height:38px;border-radius:10px;display:grid;place-items:center;color:#1E1419;font:900 18px var(--head);flex:none}
#vlQ .opt.right{border-color:var(--ok);box-shadow:0 0 0 3px color-mix(in srgb,var(--ok) 35%,transparent)}
#vlQ .row{display:flex;gap:8px;justify-content:flex-end;margin-top:18px;flex-wrap:wrap}
@media (max-width:1000px){#vlStage{grid-template-columns:minmax(0,1fr)}#vlStage .vl-side{display:none}}
#vlStage .seg{display:inline-flex;border:1px solid var(--line);border-radius:10px;overflow:hidden}#vlStage .seg button{border:0;background:var(--panel);color:var(--ink);padding:6px 12px;font:600 12.5px var(--ui);cursor:pointer}#vlStage .seg button.on{background:var(--grad);color:#fff}
body.ar #vlStage,body.ar #vlQ{direction:rtl}
`;
document.head.appendChild(css);

/* ---------- open ---------- */
function open() { build(); if (!V.video) pick(); }
function pick() { const inp = document.createElement('input'); inp.type = 'file'; inp.accept = 'video/*,.mp4,.webm,.mov,.m4v,.ogv'; inp.onchange = () => { const f = inp.files[0]; if (f) load(f); }; inp.click(); }
function load(f) { build(); if (V.url) URL.revokeObjectURL(V.url); V.file = f; V.url = URL.createObjectURL(f); V.key = 'vl:' + f.name + '|' + f.size; V.qs = (set.get(V.key, null) || []).slice(); V.done.clear(); V.last = 0; closeQ();
  render(); const v = V.video; v.src = V.url; v.load(); v.onloadedmetadata = () => { renderCtl(); if (!V.qs.length) toast('Pause anywhere and press “Add question here” — the video will stop there in class.', 5200); };
  v.onerror = () => toast('This video format cannot be played. MP4 (H.264) and WebM work best.', 6000);
  window.HBA && HBA.log('video_lesson', { questions: V.qs.length }); }
function build() { if (V.el && V.el.isConnected) { V.el.hidden = false; return; }
  const el = document.createElement('div'); el.id = 'vlStage'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-label', 'Video lesson');
  el.innerHTML = '<div class="vl-top"><div class="ttl">' + icon('clapperboard') + 'Video lesson <small id="vlName"></small></div><span style="flex:1"></span><span class="seg" id="vlMode"></span><button class="btn sm" id="vlOpen">' + icon('folder-open') + 'Open video</button><button class="btn sm" id="vlSave">' + icon('download') + 'Save questions</button><button class="btn sm" id="vlLoad">' + icon('file-input') + 'Load questions</button><button class="btn sm" id="vlX">' + icon('presentation') + 'Back to board</button></div>' +
    '<div class="vl-main"><div class="vl-player" id="vlPlayer"><video id="vlV" preload="auto" playsinline></video></div><div class="vl-ctl"><button class="play" id="vlPlay" aria-label="Play or pause"></button><span class="vl-time" id="vlTime">0:00 / 0:00</span><div class="vl-tl" id="vlTl"><div class="rail"><i id="vlProg"></i></div></div><select class="sel" id="vlRate" title="Speed" style="width:auto"><option value="0.75">0.75×</option><option value="1" selected>1×</option><option value="1.25">1.25×</option><option value="1.5">1.5×</option></select></div></div><div class="vl-side" id="vlSide"></div>';
  document.body.appendChild(el); V.el = el; V.video = el.querySelector('#vlV');
  const v = V.video, q = s => el.querySelector(s);
  q('#vlX').onclick = close; q('#vlOpen').onclick = pick; q('#vlSave').onclick = saveFile; q('#vlLoad').onclick = loadFile;
  q('#vlPlay').onclick = toggle; v.onclick = toggle; q('#vlRate').onchange = e => { v.playbackRate = +e.target.value; };
  v.onplay = v.onpause = () => { renderCtl(); if (!v.paused) loop(); };
  v.onseeked = () => { const t = v.currentTime; V.qs.forEach((x, i) => { if (x.t > t + 0.05) V.done.delete(i); }); V.last = t; renderCtl(); renderSide(); };
  v.ontimeupdate = () => renderCtl(true);
  v.onended = () => { renderCtl(); toast('End of the video lesson. 🎬'); };
  const tl = q('#vlTl'); tl.onpointerdown = e => { if (e.target.classList.contains('mk')) return; const r = tl.getBoundingClientRect(), seek = ev => { if (v.duration) v.currentTime = Math.max(0, Math.min(1, (ev.clientX - r.left) / r.width)) * v.duration; }; seek(e); tl.setPointerCapture(e.pointerId); tl.onpointermove = seek; tl.onpointerup = () => { tl.onpointermove = null; }; };
  el.addEventListener('dragover', e => e.preventDefault()); el.addEventListener('drop', e => { e.preventDefault(); const f = [...e.dataTransfer.files].find(x => /^video\//.test(x.type) || /\.(mp4|webm|mov|m4v|ogv)$/i.test(x.name)); if (f) load(f); const h = [...e.dataTransfer.files].find(x => /\.hbvid$/i.test(x.name)); if (h) readHbvid(h); });
  el.addEventListener('keydown', e => { if (e.target.closest('input,textarea,select')) return; if (e.key === ' ' || e.key === 'k') { e.preventDefault(); toggle(); } else if (e.key === 'ArrowRight') { v.currentTime += 5; } else if (e.key === 'ArrowLeft') { v.currentTime -= 5; } else if (e.key === 'Escape' && !$('#lcStage:not([hidden])')) { e.stopPropagation(); close(); } });
  el.tabIndex = -1; el.focus();
  if (window.gsap && !REDUCE) gsap.from(el, { opacity: 0, y: 10, duration: 0.25 });
  render(); }
function close() { if (V.video) V.video.pause(); if (V.el) V.el.hidden = true; }
function toggle() { const v = V.video; if (!v || !v.src) return pick(); if (V.qOpen != null) return; if (v.paused) v.play().catch(() => {}); else v.pause(); }

/* ---------- the video stops at each question (checked every frame, so it never skips one) ---------- */
function loop() { cancelAnimationFrame(V.raf); const v = V.video; if (!v || v.paused) return; const t = v.currentTime;
  if (V.mode === 'teach') { const i = V.qs.findIndex((x, k) => !V.done.has(k) && x.t > V.last - 0.01 && x.t <= t + 0.04); if (i >= 0) { v.pause(); v.currentTime = V.qs[i].t; V.done.add(i); V.last = t; ask(i); return; } }
  V.last = t; V.raf = requestAnimationFrame(loop); }
async function ask(i) { const q = V.qs[i]; snd('chime'); renderSide();
  const phones = V.phones && window.HBLC && window.HBCL && HBCL.available && HBCL.on && HBLC.students > 0;
  if (phones) { let bgCanvas = null; if (q.type === 'draw') bgCanvas = frameCanvas(); const ok = await HBLC.run({ type: q.type, prompt: q.prompt, options: q.options || [], secs: q.secs || 0, anon: false, correct: q.correct == null ? null : q.correct, bgCanvas }, { label: 'Continue video', onContinue: () => resume() });
    if (ok) return; }
  showQ(i); }
function resume() { closeQ(); if (V.el) { V.el.hidden = false; V.el.focus(); } const v = V.video; if (v) v.play().catch(() => {}); }
function frameCanvas() { const v = V.video; if (!v || !v.videoWidth) return null; const k = Math.min(1, 1400 / v.videoWidth), c = document.createElement('canvas'); c.width = Math.round(v.videoWidth * k); c.height = Math.round(v.videoHeight * k); c.getContext('2d').drawImage(v, 0, 0, c.width, c.height); return c; }
/* without phones: the question is shown big over the paused video */
function showQ(i) { closeQ(); const q = V.qs[i], k = KINDS[q.type], box = document.createElement('div'); box.id = 'vlQ'; V.qOpen = i;
  const opts = q.type === 'poll' ? '<div class="opts">' + q.options.map((o, j) => '<div class="opt" data-j="' + j + '"><span class="lt" style="background:' + POLL_C[j] + '">' + 'ABCDEF'[j] + '</span>' + esc(o) + '</div>').join('') + '</div>' : '<p class="muted" style="font-size:16px;margin:0">' + ({ text: 'Discuss with your partner, then share your answer.', word: 'Think of one word — we will share a few aloud.', draw: 'Sketch your answer in your book.' }[q.type]) + '</p>';
  box.innerHTML = '<div class="card" style="--tint:' + k[2] + '"><span class="kind">' + icon(k[0]) + esc(k[1]) + ' · ' + fmt(q.t) + '</span><h2>' + esc(q.prompt || 'Question') + '</h2>' + opts + '<div class="row">' + (window.HBLC && window.helixDesktop ? '<button class="btn" id="vlqPhones">' + icon('monitor-smartphone') + 'Send to phones</button>' : '') + (q.type === 'poll' && q.correct != null ? '<button class="btn" id="vlqReveal">' + icon('circle-check') + 'Reveal answer</button>' : '') + '<button class="btn primary" id="vlqGo">' + icon('play') + 'Continue video</button></div></div>';
  $('#vlPlayer').appendChild(box); if (window.gsap && !REDUCE) gsap.from(box.firstChild, { y: 20, opacity: 0, duration: 0.3, ease: 'back.out(1.6)' });
  box.querySelector('#vlqGo').onclick = resume;
  const rv = box.querySelector('#vlqReveal'); if (rv) rv.onclick = () => { const el = box.querySelector('.opt[data-j="' + q.correct + '"]'); if (el) el.classList.add('right'); snd('fanfare'); rv.remove(); };
  const ph = box.querySelector('#vlqPhones'); if (ph) ph.onclick = async () => { closeQ(); const ok = await HBLC.run({ type: q.type, prompt: q.prompt, options: q.options || [], secs: q.secs || 0, correct: q.correct == null ? null : q.correct, bgCanvas: q.type === 'draw' ? frameCanvas() : null }, { label: 'Continue video', onContinue: () => resume() }); if (!ok) showQ(i); }; }
function closeQ() { const b = $('#vlQ'); if (b) b.remove(); V.qOpen = null; }

/* ---------- adding and editing questions ---------- */
function edit(i) { const v = V.video; if (v) v.pause(); const isNew = i == null, q = isNew ? { t: v ? v.currentTime : 0, type: 'poll', prompt: '', options: ['A', 'B', 'C', 'D'], correct: null, secs: 0 } : JSON.parse(JSON.stringify(V.qs[i]));
  const PRE = { abcd: ['A', 'B', 'C', 'D'], tf: ['True', 'False'], yn: ['Yes', 'No', 'Not sure'] };
  modal.open('<h2>' + icon('clapperboard') + (isNew ? ' Question at ' : ' Edit question at ') + '<span id="vlqT">' + fmt(q.t) + '</span></h2><div class="row" style="gap:6px;flex-wrap:wrap;margin-bottom:10px">' + Object.entries(KINDS).map(([k, x]) => '<button class="btn sm" data-k="' + k + '">' + icon(x[0]) + x[1] + '</button>').join('') + '</div>' +
    '<label class="small">Question</label><textarea id="vlqP" class="inp" maxlength="300" style="width:100%;height:70px;padding:10px;resize:vertical" placeholder="e.g. What did the narrator say happens to the light energy?"></textarea><div id="vlqO"></div>' +
    '<div class="row" style="gap:10px;margin-top:10px;flex-wrap:wrap;align-items:center"><label class="small">Answer time on phones <select class="sel" id="vlqS">' + [[0, 'No limit'], [30, '30 s'], [60, '1 min'], [120, '2 min'], [300, '5 min']].map(([s, l]) => '<option value="' + s + '"' + (s === (q.secs || 0) ? ' selected' : '') + '>' + l + '</option>').join('') + '</select></label><label class="small">Stop at <input class="inp" id="vlqAt" value="' + fmt(q.t) + '" style="width:90px;height:32px"></label></div>' +
    '<div class="foot">' + (isNew ? '' : '<button class="btn" id="vlqDel">' + icon('trash-2') + 'Delete</button><span style="flex:1"></span>') + '<button class="btn" data-close>Cancel</button><button class="btn primary" id="vlqOk">' + icon('check') + 'Save question</button></div>', sh => {
    const p = sh.querySelector('#vlqP'); p.value = q.prompt || '';
    const drawKind = () => { $$('[data-k]', sh).forEach(b => b.classList.toggle('primary', b.dataset.k === q.type)); const box = sh.querySelector('#vlqO');
      if (q.type !== 'poll') { box.innerHTML = '<p class="small muted" style="margin:8px 0 0">' + ({ text: 'Every student types an answer.', word: 'Every student sends up to 3 words — they become a word cloud.', draw: 'Students draw on top of the paused video frame.' }[q.type]) + '</p>'; return; }
      box.innerHTML = '<div class="row" style="gap:6px;margin:10px 0 6px;flex-wrap:wrap"><span class="small">Answers:</span>' + [['abcd', 'A B C D'], ['tf', 'True / False'], ['yn', 'Yes / No / Not sure']].map(([k, l]) => '<button class="btn sm" data-pre="' + k + '">' + l + '</button>').join('') + '</div>' + q.options.map((o, j) => '<div class="row" style="gap:6px;margin:4px 0"><span style="width:28px;height:28px;border-radius:8px;display:grid;place-items:center;font-weight:900;color:#1E1419;background:' + POLL_C[j] + '">' + 'ABCDEF'[j] + '</span><input class="inp" data-o="' + j + '" value="' + esc(o) + '" maxlength="80" style="flex:1;height:34px"><label class="small"><input type="radio" name="vlC" data-c="' + j + '"' + (q.correct === j ? ' checked' : '') + '> right</label>' + (q.options.length > 2 ? '<button class="ib" data-x="' + j + '">' + icon('x') + '</button>' : '') + '</div>').join('') + (q.options.length < 6 ? '<button class="btn sm" id="vlqAdd">' + icon('plus') + 'Add an answer</button>' : '');
      $$('[data-o]', box).forEach(x => x.oninput = () => { q.options[+x.dataset.o] = x.value; }); $$('[data-c]', box).forEach(x => x.onchange = () => { q.correct = +x.dataset.c; });
      $$('[data-x]', box).forEach(x => x.onclick = () => { q.options.splice(+x.dataset.x, 1); if (q.correct != null && q.correct >= q.options.length) q.correct = null; drawKind(); });
      $$('[data-pre]', box).forEach(x => x.onclick = () => { q.options = PRE[x.dataset.pre].slice(); q.correct = null; drawKind(); });
      const ad = box.querySelector('#vlqAdd'); if (ad) ad.onclick = () => { q.options.push(''); drawKind(); }; };
    $$('[data-k]', sh).forEach(b => b.onclick = () => { q.type = b.dataset.k; if (q.type === 'poll' && (!q.options || q.options.length < 2)) q.options = ['A', 'B', 'C', 'D']; drawKind(); }); drawKind(); setTimeout(() => p.focus(), 50);
    const del = sh.querySelector('#vlqDel'); if (del) del.onclick = () => { V.qs.splice(i, 1); persist(); modal.close(); render(); };
    sh.querySelector('#vlqOk').onclick = () => { q.prompt = p.value.trim(); if (!q.prompt) { toast('Type the question first.'); return; } if (q.type === 'poll') { q.options = q.options.map(o => String(o).trim()); if (q.options.some(o => !o)) { toast('Fill in every answer, or remove the empty ones.'); return; } } else { delete q.options; q.correct = null; }
      q.secs = +sh.querySelector('#vlqS').value; const at = parseTime(sh.querySelector('#vlqAt').value); if (at != null) q.t = Math.max(0, Math.min(V.video && V.video.duration || at, at));
      if (isNew) V.qs.push(q); else V.qs[i] = q; V.qs.sort((a, b) => a.t - b.t); V.done.clear(); V.last = V.video ? V.video.currentTime - 0.01 : 0; persist(); modal.close(); render(); snd('pop'); toast('Question saved — the video stops at ' + fmt(q.t) + '.'); }; }); }
const parseTime = s => { const m = String(s).trim().match(/^(?:(\d+):)?(\d+):(\d{1,2})(?:\.\d+)?$|^(\d+(?:\.\d+)?)$/); if (!m) return null; if (m[4] != null) return +m[4]; return (+(m[1] || 0)) * 3600 + (+m[2]) * 60 + (+m[3]); };
function persist() { if (V.key) set.put(V.key, V.qs); }

/* ---------- .hbvid files: the questions for a video, to reuse or share with a colleague ---------- */
function saveFile() { if (!V.qs.length) { toast('Add a question first.'); return; } const data = { app: 'HelixBoard', kind: 'video-lesson', video: V.file ? V.file.name : '', size: V.file ? V.file.size : 0, questions: V.qs };
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 1)], { type: 'application/json' })); a.download = ((V.file ? V.file.name.replace(/\.[^.]+$/, '') : 'Video lesson') + ' - questions.hbvid').replace(/[\\/:*?"<>|]+/g, '_'); a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); toast('Saved the questions. Open the same video, then “Load questions”.'); }
function loadFile() { const inp = document.createElement('input'); inp.type = 'file'; inp.accept = '.hbvid,application/json'; inp.onchange = () => inp.files[0] && readHbvid(inp.files[0]); inp.click(); }
async function readHbvid(f) { let d; try { d = JSON.parse(await f.text()); } catch (e) { toast('That is not a video lesson file.'); return; } if (!d || d.kind !== 'video-lesson' || !Array.isArray(d.questions)) { toast('That is not a video lesson file.'); return; }
  V.qs = d.questions.filter(q => q && KINDS[q.type] && Number.isFinite(+q.t)).map(q => ({ t: +q.t, type: q.type, prompt: String(q.prompt || '').slice(0, 300), options: q.type === 'poll' ? (q.options || []).slice(0, 6).map(o => String(o).slice(0, 80)) : undefined, correct: Number.isInteger(q.correct) ? q.correct : null, secs: +q.secs || 0 })).sort((a, b) => a.t - b.t);
  persist(); V.done.clear(); render(); toast('Loaded ' + V.qs.length + ' question' + (V.qs.length === 1 ? '' : 's') + (d.video && V.file && d.video !== V.file.name ? ' (they were made for “' + esc(d.video) + '”).' : '.')); }

/* ---------- drawing the screen ---------- */
function render() { if (!V.el) return; V.el.querySelector('#vlName').textContent = V.file ? V.file.name : '';
  const m = V.el.querySelector('#vlMode'); m.innerHTML = [['teach', 'Teach'], ['edit', 'Edit']].map(([k, l]) => '<button data-m="' + k + '" class="' + (V.mode === k ? 'on' : '') + '" title="' + (k === 'teach' ? 'The video stops at every question' : 'Play freely while you add questions') + '">' + l + '</button>').join('');
  $$('[data-m]', m).forEach(b => b.onclick = () => { V.mode = b.dataset.m; V.done.clear(); V.last = V.video ? V.video.currentTime - 0.01 : 0; render(); });
  if (!V.video.src) { const p = V.el.querySelector('#vlPlayer'); if (!p.querySelector('.vl-drop')) { const d = document.createElement('div'); d.className = 'vl-drop'; d.style.cssText = 'position:absolute;inset:0;background:var(--panel)'; d.innerHTML = icon('clapperboard') + '<b>Open a video</b><span>Drop an MP4 or WebM here, or choose one. Then pause anywhere and add questions — the video stops there in class.</span><button class="btn primary">' + icon('folder-open') + 'Choose a video</button>'; d.querySelector('button').onclick = pick; p.appendChild(d); } }
  else { const d = V.el.querySelector('.vl-drop'); if (d) d.remove(); }
  renderCtl(); renderSide(); }
function renderCtl(light) { if (!V.el) return; const v = V.video, d = v.duration || 0, t = v.currentTime || 0;
  V.el.querySelector('#vlTime').textContent = fmt(t) + ' / ' + fmt(d); V.el.querySelector('#vlProg').style.width = (d ? t / d * 100 : 0) + '%';
  if (light) return; V.el.querySelector('#vlPlay').innerHTML = icon(v.paused ? 'play' : 'pause');
  const tl = V.el.querySelector('#vlTl'); $$('.mk', tl).forEach(x => x.remove());
  if (d) V.qs.forEach((q, i) => { const mk = document.createElement('span'); mk.className = 'mk' + (V.done.has(i) ? ' done' : ''); mk.style.left = (q.t / d * 100) + '%'; mk.style.color = KINDS[q.type][2]; mk.title = fmt(q.t) + ' · ' + KINDS[q.type][1] + ': ' + q.prompt; mk.onpointerdown = e => e.stopPropagation(); mk.onclick = () => { v.currentTime = Math.max(0, q.t - 0.05); }; tl.appendChild(mk); }); }
function renderSide() { if (!V.el) return; const s = V.el.querySelector('#vlSide'), v = V.video, d = v.duration || 0;
  const lc = !!(window.HBLC && window.helixDesktop), n = window.HBLC ? HBLC.students : 0;
  let h = '<button class="btn primary" id="vlAdd" style="justify-content:center;padding:10px">' + icon('plus') + 'Add question here · ' + fmt(v.currentTime) + '</button>';
  if (lc) h += '<label class="small" style="display:flex;gap:8px;align-items:center"><input type="checkbox" id="vlPh"' + (V.phones ? ' checked' : '') + '> Send questions to phones (Live class)' + '</label><div class="small muted" style="margin-top:-6px">' + (n ? '📱 ' + n + ' phone' + (n === 1 ? '' : 's') + ' connected' : 'No phones yet — <a href="#" id="vlJoin" style="color:var(--cyan)">show the QR code</a>. Without phones the question shows on the screen.') + '</div>';
  h += '<h3>Parts · ' + (V.qs.length + 1) + '</h3>';
  if (!V.qs.length) h += '<div class="vl-empty">No questions yet.<br>Play the video, pause where students should think, then press <b>Add question here</b>.</div>';
  else { let from = 0; V.qs.forEach((q, i) => { const k = KINDS[q.type]; h += '<div class="vl-part">Part ' + (i + 1) + ' · ' + fmt(from) + '–' + fmt(q.t) + '</div><div class="vl-q' + (V.done.has(i) ? ' done' : '') + '" data-i="' + i + '" style="--tint:' + k[2] + '"><span class="ic">' + icon(k[0]) + '</span><div style="min-width:0"><b>' + fmt(q.t) + ' · ' + k[1] + '</b><span>' + esc(q.prompt) + '</span></div><div class="x"><button data-ed="' + i + '" title="Edit">' + icon('pencil') + '</button><button data-go="' + i + '" title="Ask it now">' + icon('play') + '</button></div></div>'; from = q.t; }); h += '<div class="vl-part">Part ' + (V.qs.length + 1) + ' · ' + fmt(from) + '–' + fmt(d) + ' (to the end)</div>'; }
  h += '<div class="small muted" style="margin-top:auto;line-height:1.5">Space plays and pauses · ← → jump 5 seconds · questions are remembered for this video on this computer.</div>';
  s.innerHTML = h;
  s.querySelector('#vlAdd').onclick = () => { if (!V.video.src) return pick(); edit(null); };
  const ph = s.querySelector('#vlPh'); if (ph) ph.onchange = () => { V.phones = ph.checked; set.put('vlPhones', V.phones); if (V.phones && window.HBCL && !HBCL.on) HBCL.start({ quiet: true }).then(renderSide); };
  const j = s.querySelector('#vlJoin'); if (j) j.onclick = async e => { e.preventDefault(); if (!HBCL.on) await HBCL.start({ quiet: true }); if (HBCL.on) HBCL.bigQr(); renderSide(); };
  $$('.vl-q', s).forEach(x => x.onclick = e => { if (e.target.closest('[data-ed],[data-go]')) return; v.currentTime = Math.max(0, V.qs[+x.dataset.i].t - 3); });
  $$('[data-ed]', s).forEach(b => b.onclick = () => edit(+b.dataset.ed));
  $$('[data-go]', s).forEach(b => b.onclick = () => { const i = +b.dataset.go; v.pause(); v.currentTime = V.qs[i].t; V.done.add(i); ask(i); }); }
let lastN = -1; setInterval(() => { if (!V.el || V.el.hidden || !window.HBLC) return; const n = HBLC.students; if (n !== lastN) { lastN = n; renderSide(); } }, 3000);

window.HBVL = { open, load, close, get on() { return !!(V.el && !V.el.hidden); } };
})();
