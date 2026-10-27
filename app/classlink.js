/* ================= HelixBoard — Class link (Windows app): one QR code for students' phones — live board, group writing, shared files, homework ================= */
(() => {
'use strict';
const { $, $$, esc, icon, set, bus, toast, modal, SND, floatPanel, REDUCE } = window.HB;
const E = window.HBE;
const D = () => window.helixDesktop && window.helixDesktop.cl;
const snd = k => { try { SND[k] && SND[k](); } catch (e) {} };
const S = { on: false, info: null, snap: null, url: '', picked: false, dirty: true, last: 0, t: 0, busy: false, inkNote: 0 };

function needApp(what) { modal.open('<h2>' + what + '</h2><p>Students scan one QR code and see your board live on their phones or tablets, write on it for group work, download lesson videos and do homework — from the same Wi-Fi or from any network.</p><p>This needs the <b>HelixBoard Windows app</b>, which runs the class link on this computer (no accounts or website needed).</p><div class="foot"><button class="btn primary" data-close>OK</button></div>'); }

async function start() { if (!D()) return needApp('Class link'); if (S.on) return panel();
  toast('Starting the class link…');
  const r = await D().start({ title: (E.page().name || 'Our class'), lang: set.get('lang', 'en'), internet: set.get('phoneNet', true) });
  if (!r || r.error) { toast('The class link could not start: ' + esc((r && r.error) || 'unknown error'), 6000); return; }
  S.on = true; S.info = r; S.picked = false; D().onEvent(onEvent); window.HBA && HBA.log('class_link', {});
  await D().cmd('options', { boardOn: set.get('clBoard', true), drawOn: false });
  S.snap = await D().cmd('snapshot'); panel(); stream(); }
async function stop() { if (!S.on) return; S.on = false; clearInterval(S.t); await D().cmd('stop'); const f = window.HB.floats.classlink; if (f) f.destroy(); toast('Class link closed.'); }

function onEvent(type, data, snap) { S.snap = snap;
  if (type === 'stroke') return addInk(data);
  if (type === 'homework') { window.HBL && HBL.hwResult && HBL.hwResult(data.id, data.result); toast('📝 ' + esc(data.result.name) + ' handed in homework.'); return draw(); }
  draw(); }

/* ---------- students' ink lands on the board exactly where they drew it ---------- */
function addInk(d) { const v = d.view; if (!v || !d.pts.length) return; const P = [];
  d.pts.forEach(p => P.push(+((p[0] * v.w - v.x) / v.s).toFixed(1), +((p[1] * v.h - v.y) / v.s).toFixed(1), 0.5));
  E.add([{ t: 'stroke', pen: 'pen', c: d.color, w: Math.max(1.5, (d.width || 4) / v.s), a: 1, pts: P, tm: P.filter((_, i) => i % 3 === 0).map((_, i) => i * 8), sp: true, stu: d.name }]);
  S.dirty = true; if (Date.now() - S.inkNote > 8000) { S.inkNote = Date.now(); toast('✎ ' + esc(d.name) + ' is writing on the board.'); } }
function clearInk() { const objs = E.page().objs.filter(o => o.stu); if (!objs.length) { toast('No student ink on this page.'); return; } E.del(objs); toast('Removed ' + objs.length + ' student line' + (objs.length === 1 ? '' : 's') + ' (Undo brings them back).'); }

/* ---------- the board picture: what the teacher sees, refreshed whenever it changes ---------- */
['view', 'changed', 'page', 'stroke-added', 'selection', 'img-loaded'].forEach(ev => bus.on(ev, () => { S.dirty = true; }));
document.addEventListener('pointermove', e => { if (e.buttons && e.target.closest && e.target.closest('#stage')) S.dirty = true; }, true);
function stream() { clearInterval(S.t); S.t = setInterval(() => { if (!S.on || S.busy || !(S.snap && S.snap.boardOn)) return; if (!S.dirty && Date.now() - S.last < 5000) return; send(); }, 700); }
function send() { const cs = [document.getElementById('cvBg'), E.cvMain, E.cvLive], W = E.cvMain.width, H = E.cvMain.height; if (!W || !H) return; const k = Math.min(1, 1600 / W);
  const c = document.createElement('canvas'); c.width = Math.round(W * k); c.height = Math.round(H * k); const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); cs.forEach(x => x && g.drawImage(x, 0, 0, c.width, c.height));
  S.busy = true; S.dirty = false; S.last = Date.now();
  c.toBlob(b => { if (!b) { S.busy = false; return; } b.arrayBuffer().then(buf => D().cmd('board', { jpeg: new Uint8Array(buf), view: { s: E.V.s, x: E.V.x, y: E.V.y, w: E.SW, h: E.SH, ar: E.SW / E.SH } })).finally(() => { S.busy = false; }); }, 'image/jpeg', 0.78); }

/* ---------- the panel ---------- */
const qrSvg = (url, cell) => { const q = qrcode(0, 'M'); q.addData(url); q.make(); return q.createSvgTag({ cellSize: cell || 6, margin: 2, scalable: true }); };
function links() { const sn = S.snap || {}, tn = sn.tunnel || { state: 'off' }, urls = (tn.state === 'ready' ? [tn.url] : []).concat(S.info.urls || []); if (!urls.includes(S.url) || (tn.state === 'ready' && !S.picked)) S.url = urls[0] || ''; return { tn, urls, isNet: tn.state === 'ready' && S.url === tn.url }; }
function panel() { const f = floatPanel('classlink', 'Class link', '<div id="clB"></div>', { icon: 'monitor-smartphone', w: 360, onClose: () => { if (S.on) stop(); } }); S.panel = f; draw(); }
function draw() { const f = S.panel; if (!f || !f.body || !f.body.isConnected || !S.on) return; const sn = S.snap || { players: [], files: [] }, { tn, urls, isNet } = links(), net = set.get('phoneNet', true);
  const badge = isNet ? '<span class="st-tag ok">🌐 Any network</span>' : tn.state === 'connecting' && net ? '<span class="st-tag">📶 Wi-Fi for now · ' + esc(tn.msg || 'opening the internet link…') + '</span>' : '<span class="st-tag">📶 Same Wi-Fi only</span>' + (tn.state === 'failed' && net ? '<div class="small" style="color:var(--bad);margin-top:4px">' + esc(tn.error || '') + ' <button class="btn sm" id="clRetry">Try again</button></div>' : '');
  f.body.querySelector('#clB').innerHTML = '<div style="text-align:center">' + badge + '<div style="background:#fff;border-radius:12px;padding:6px;width:190px;margin:8px auto 4px;cursor:zoom-in" id="clQr" title="Show big for the class">' + (S.url ? qrSvg(S.url) : '') + '</div><div class="small mono" style="word-break:break-all">' + esc(S.url.replace(/\/\?pin=\d+$/, '')) + '</div><div>PIN <b style="font:800 22px var(--mono);color:var(--accent);letter-spacing:.08em">' + S.info.pin + '</b></div>' +
    (urls.length > 1 ? '<select class="sel" id="clU" style="margin-top:4px">' + urls.map(u => '<option value="' + esc(u) + '"' + (u === S.url ? ' selected' : '') + '>' + (u === tn.url ? '🌐 Internet link' : '📶 Wi-Fi ' + esc(u.replace(/^http:\/\/|:\d+\/.*$/g, ''))) + '</option>').join('') + '</select>' : '') + '</div>' +
    '<div class="row" style="gap:6px;margin:8px 0;flex-wrap:wrap"><label class="small"><input type="checkbox" id="clBoard"' + (sn.boardOn ? ' checked' : '') + '> Show my board</label><label class="small"><input type="checkbox" id="clDraw"' + (sn.drawOn ? ' checked' : '') + (sn.boardOn ? '' : ' disabled') + '> Let students write</label><label class="small"><input type="checkbox" id="clNet"' + (net ? ' checked' : '') + '> Any network</label></div>' +
    '<div class="small muted">' + sn.players.length + ' joined' + (sn.players.length ? ': ' + sn.players.slice(0, 40).map(p => '<span style="color:' + p.color + ';font-weight:700' + (p.online ? '' : ';opacity:.5') + '">' + esc(p.name) + '</span>').join(', ') : '') + '</div>' +
    '<div class="row" style="gap:6px;margin-top:8px;flex-wrap:wrap"><button class="btn sm" id="clInk">' + icon('eraser') + 'Clear student ink</button><button class="btn sm" id="clFile">' + icon('file-up') + 'Share a file</button><button class="btn sm" id="clHw">' + icon('notebook-pen') + 'Homework</button><button class="btn sm" id="clBig">' + icon('maximize-2') + 'Big QR</button></div>' +
    (sn.files.length ? '<div class="small" style="margin-top:8px"><b>Shared</b>' + sn.files.map(x => '<div class="st-stem" style="padding:4px 6px"><span>' + (x.kind === 'video' ? '🎬 ' : '📄 ') + esc(x.name) + '</span><button class="ib" data-rm="' + x.id + '" title="Stop sharing">' + icon('x') + '</button></div>').join('') + '</div>' : '') +
    '<div class="row" style="justify-content:flex-end;margin-top:8px"><button class="btn sm" id="clStop">' + icon('circle-stop') + 'Stop class link</button></div>';
  const b = f.body, q = id => b.querySelector(id);
  q('#clBoard').onchange = e => { set.put('clBoard', e.target.checked); S.dirty = true; D().cmd('options', { boardOn: e.target.checked, drawOn: e.target.checked && sn.drawOn }).then(s => { S.snap = s; draw(); }); };
  q('#clDraw').onchange = e => D().cmd('options', { drawOn: e.target.checked }).then(s => { S.snap = s; draw(); toast(e.target.checked ? 'Students can now write on your board from their phones — each in their own colour.' : 'Students can only watch now.'); });
  q('#clNet').onchange = e => { set.put('phoneNet', e.target.checked); if (e.target.checked && tn.state !== 'ready' && tn.state !== 'connecting') D().cmd('link'); draw(); };
  const u = q('#clU'); if (u) u.onchange = () => { S.url = u.value; S.picked = true; draw(); };
  const rt = q('#clRetry'); if (rt) rt.onclick = () => D().cmd('link');
  q('#clInk').onclick = clearInk; q('#clFile').onclick = pickFile; q('#clHw').onclick = () => window.HBL && HBL.homework(); q('#clBig').onclick = bigQr; q('#clQr').onclick = bigQr; q('#clStop').onclick = stop;
  $$('[data-rm]', b).forEach(x => x.onclick = () => D().cmd('removeFile', x.dataset.rm).then(s => { S.snap = s; draw(); })); }

function bigQr() { const { isNet } = links(); const o = document.createElement('div'); o.style.cssText = 'position:fixed;inset:0;z-index:55;background:var(--bg);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;cursor:pointer';
  o.innerHTML = '<div style="font:800 clamp(26px,4vw,52px) var(--head)">Scan to join the class</div><div style="background:#fff;border-radius:20px;padding:14px;width:min(62vh,80vw)">' + qrSvg(S.url, 10) + '</div><div style="font:700 18px var(--mono)">' + esc(S.url.replace(/\/\?pin=\d+$/, '')) + '</div><div style="font:600 22px var(--head)">PIN <b style="font:800 44px var(--mono);color:var(--accent);letter-spacing:.1em">' + S.info.pin + '</b></div><div class="muted">' + (isNet ? 'Mobile data or any Wi-Fi works.' : 'Join from the same Wi-Fi as this computer.') + ' · tap anywhere to close</div>';
  o.onclick = () => o.remove(); document.body.appendChild(o); if (window.gsap && !REDUCE) gsap.from(o, { opacity: 0, duration: 0.25 }); }

function pickFile() { const inp = document.createElement('input'); inp.type = 'file'; inp.onchange = async () => { const fl = inp.files[0]; if (!fl) return; if (fl.size > 300 * 1048576) { toast('That file is too large to share (over 300 MB).'); return; } const buf = new Uint8Array(await fl.arrayBuffer()); await shareFile({ name: fl.name, kind: /^video\//.test(fl.type) ? 'video' : 'file', data: buf, type: fl.type || 'application/octet-stream' }); }; inp.click(); }
async function shareFile(f) { if (!D()) return needApp('Share with the class'); if (!S.on) await start(); if (!S.on) return; await D().cmd('addFile', f); S.snap = await D().cmd('snapshot'); draw(); snd('pop'); toast('Shared with the class: ' + esc(f.name) + ' — students find it under Files.', 4200); }
async function shareHomework(hw) { if (!D()) return needApp('Homework on phones'); if (!S.on) await start(); if (!S.on) return; await D().cmd('addHomework', hw); S.snap = await D().cmd('snapshot'); draw(); toast('Homework shared — students open it under Homework on the class link.', 4200); }

window.HBCL = { start, stop, shareFile, shareHomework, clearInk, get on() { return S.on; }, get available() { return !!D(); } };
})();
