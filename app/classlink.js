/* ================= HelixBoard — Class link (Windows app): one QR code for students' phones — live board, group writing, shared files, homework ================= */
(() => {
'use strict';
const { $, $$, esc, icon, set, bus, toast, modal, SND, floatPanel, REDUCE } = window.HB;
const E = window.HBE;
const D = () => window.helixDesktop && window.helixDesktop.cl;
const snd = k => { try { SND[k] && SND[k](); } catch (e) {} };
const S = { on: false, info: null, snap: null, url: '', picked: false, dirty: true, last: 0, t: 0, busy: false, inkNote: 0 };

function needApp(what) { modal.open('<h2>' + what + '</h2><p>Students scan one QR code and see your board live on their phones or tablets, write on it for group work, download lesson videos and do homework — from the same Wi-Fi or from any network.</p><p>This needs the <b>HelixBoard Windows app</b>, which runs the class link on this computer (no accounts or website needed).</p><div class="foot"><button class="btn primary" data-close>OK</button></div>'); }

async function start(opts) { opts = opts || {}; if (!D()) return needApp('Class link'); if (S.on) return opts.quiet ? null : panel();
  toast('Starting the class link…');
  const r = await D().start({ title: (E.page().name || 'Our class'), lang: set.get('lang', 'en'), internet: set.get('phoneNet', true) });
  if (!r || r.error) { toast('The class link could not start: ' + esc((r && r.error) || 'unknown error'), 6000); return; }
  S.on = true; S.info = r; S.picked = false; D().onEvent(onEvent); window.HBA && HBA.log('class_link', {});
  await D().cmd('options', { boardOn: set.get('clBoard', true), drawOn: false });
  S.snap = await D().cmd('snapshot'); if (!opts.quiet) panel(); stream(); }
async function stop() { if (!S.on) return; S.on = false; clearInterval(S.t); await D().cmd('stop'); window.HBLC && HBLC.closed(); const f = window.HB.floats.classlink; if (f) f.destroy(); toast('Class link closed.'); }

function onEvent(type, data, snap) { S.snap = snap; drawBig(); if (window.HBLC) HBLC.event(type, data, snap);
  if (type === 'response' || type === 'hand' || type === 'question' || type === 'reaction') return;
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
/* the board as a picture (white behind it), for phones and for Draw-it backgrounds */
function boardCanvas(maxW) { const cs = [document.getElementById('cvBg'), E.cvMain, E.cvLive], W = E.cvMain.width, H = E.cvMain.height; if (!W || !H) return null; const k = Math.min(1, (maxW || 1600) / W);
  const c = document.createElement('canvas'); c.width = Math.round(W * k); c.height = Math.round(H * k); const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); cs.forEach(x => x && g.drawImage(x, 0, 0, c.width, c.height)); return c; }
function send() { const cs = [document.getElementById('cvBg'), E.cvMain, E.cvLive], W = E.cvMain.width, H = E.cvMain.height; if (!W || !H) return; const k = Math.min(1, 1600 / W);
  const c = document.createElement('canvas'); c.width = Math.round(W * k); c.height = Math.round(H * k); const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); cs.forEach(x => x && g.drawImage(x, 0, 0, c.width, c.height));
  S.busy = true; S.dirty = false; S.last = Date.now();
  c.toBlob(b => { if (!b) { S.busy = false; return; } b.arrayBuffer().then(buf => D().cmd('board', { jpeg: new Uint8Array(buf), view: { s: E.V.s, x: E.V.x, y: E.V.y, w: E.SW, h: E.SH, ar: E.SW / E.SH } })).finally(() => { S.busy = false; }); }, 'image/jpeg', 0.78); }

/* ---------- the panel ---------- */
const qrSvg = (url, cell) => { const q = qrcode(0, 'M'); q.addData(url); q.make(); return q.createSvgTag({ cellSize: cell || 6, margin: 2, scalable: true }); };
function links() { const sn = S.snap || {}, tn = sn.tunnel || { state: 'off' }, urls = (tn.state === 'ready' ? [tn.url] : []).concat(S.info.urls || []); if (!urls.includes(S.url) || (tn.state === 'ready' && !S.picked)) S.url = urls[0] || ''; return { tn, urls, isNet: tn.state === 'ready' && S.url === tn.url }; }
function panel() { const f = floatPanel('classlink', 'Class link', '<div id="clB"></div>', { icon: 'monitor-smartphone', w: 360, onClose: () => { if (S.on) stop(); } }); S.panel = f; draw(); }
function draw() { const f = S.panel; if (!f || !f.body || !f.body.isConnected || !S.on) return; const sn = S.snap || { players: [], files: [] }, { tn, urls, isNet } = links(), net = set.get('phoneNet', true);
  f.body.querySelector('#clB').innerHTML = '<div id="clQr" title="Show big for the class" style="cursor:zoom-in">' + HBJoin.html({ tn, lan: S.info.urls || [], lanPick: S.lanPick, net, qw: 140, cell: 4, small: true }) + '</div><div style="text-align:center;margin-top:6px">PIN <b style="font:800 22px var(--mono);color:var(--accent);letter-spacing:.08em">' + S.info.pin + '</b></div>' +
    '<div class="row" style="gap:6px;margin:8px 0;flex-wrap:wrap"><label class="small"><input type="checkbox" id="clBoard"' + (sn.boardOn ? ' checked' : '') + '> Show my board</label><label class="small"><input type="checkbox" id="clDraw"' + (sn.drawOn ? ' checked' : '') + (sn.boardOn ? '' : ' disabled') + '> Let students write</label><label class="small"><input type="checkbox" id="clNet"' + (net ? ' checked' : '') + '> Any network</label></div>' +
    '<div class="small muted">' + sn.players.length + ' joined' + (sn.players.length ? ': ' + sn.players.slice(0, 40).map(p => '<span style="color:' + p.color + ';font-weight:700' + (p.online ? '' : ';opacity:.5') + '">' + esc(p.name) + '</span>').join(', ') : '') + '</div>' +
    '<div class="row" style="gap:6px;margin-top:8px;flex-wrap:wrap"><button class="btn sm" id="clInk">' + icon('eraser') + 'Clear student ink</button><button class="btn sm" id="clFile">' + icon('file-up') + 'Share a file</button><button class="btn sm" id="clHw">' + icon('notebook-pen') + 'Homework</button><button class="btn sm" id="clBig">' + icon('maximize-2') + 'Big QR</button></div>' +
    (sn.files.length ? '<div class="small" style="margin-top:8px"><b>Shared</b>' + sn.files.map(x => '<div class="st-stem" style="padding:4px 6px"><span>' + (x.kind === 'video' ? '🎬 ' : '📄 ') + esc(x.name) + '</span><button class="ib" data-rm="' + x.id + '" title="Stop sharing">' + icon('x') + '</button></div>').join('') + '</div>' : '') +
    '<div class="row" style="justify-content:flex-end;margin-top:8px"><button class="btn sm" id="clStop">' + icon('circle-stop') + 'Stop class link</button></div>';
  const b = f.body, q = id => b.querySelector(id);
  q('#clBoard').onchange = e => { set.put('clBoard', e.target.checked); S.dirty = true; D().cmd('options', { boardOn: e.target.checked, drawOn: e.target.checked && sn.drawOn }).then(s => { S.snap = s; draw(); }); };
  q('#clDraw').onchange = e => D().cmd('options', { drawOn: e.target.checked }).then(s => { S.snap = s; draw(); toast(e.target.checked ? 'Students can now write on your board from their phones — each in their own colour.' : 'Students can only watch now.'); });
  q('#clNet').onchange = e => { set.put('phoneNet', e.target.checked); if (e.target.checked && tn.state !== 'ready' && tn.state !== 'connecting') D().cmd('link'); draw(); };
  bindJoin(b);
  q('#clInk').onclick = clearInk; q('#clFile').onclick = pickFile; q('#clHw').onclick = () => window.HBL && HBL.homework(); q('#clBig').onclick = bigQr; q('#clQr').onclick = e => { if (!e.target.closest('select,button')) bigQr(); }; q('#clStop').onclick = stop;
  $$('[data-rm]', b).forEach(x => x.onclick = () => D().cmd('removeFile', x.dataset.rm).then(s => { S.snap = s; draw(); })); }

function bindJoin(root) { $$('[data-jretry]', root).forEach(b => b.onclick = e => { e.stopPropagation(); D().cmd('link'); }); $$('[data-jlan]', root).forEach(x => { x.onclick = e => e.stopPropagation(); x.onchange = () => { S.lanPick = x.value; draw(); drawBig(); }; }); }
function drawBig() { const o = document.getElementById('clBigQr'); if (!o || !S.on) { if (o) o.remove(); return; } const sn = S.snap || {}, net = set.get('phoneNet', true);
  o.innerHTML = '<div style="font:800 clamp(26px,3.6vw,48px) var(--head)">Scan to join the class</div><div style="width:min(1100px,94vw)">' + HBJoin.html({ tn: sn.tunnel, lan: S.info.urls || [], lanPick: S.lanPick, net, qw: 'min(52vh,40vw)', cell: 10 }) + '</div><div style="font:600 22px var(--head)">PIN <b style="font:800 44px var(--mono);color:var(--accent);letter-spacing:.1em">' + S.info.pin + '</b></div><div class="muted">Use either code — whichever works on your phone · tap the background or press Esc to close</div>';
  bindJoin(o); }
function bigQr() { if (!S.on) return; let o = document.getElementById('clBigQr'); if (o) return; o = document.createElement('div'); o.id = 'clBigQr'; o.style.cssText = 'position:fixed;inset:0;z-index:55;background:var(--bg);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:16px;padding:20px;overflow:auto';
  const close = () => { o.remove(); document.removeEventListener('keydown', key, true); }, key = e => { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(); } };
  o.onclick = e => { if (!e.target.closest('.jc')) close(); }; document.addEventListener('keydown', key, true); document.body.appendChild(o); drawBig(); if (window.gsap && !REDUCE) gsap.from(o, { opacity: 0, duration: 0.25 }); }

function pickFile() { const inp = document.createElement('input'); inp.type = 'file'; inp.onchange = async () => { const fl = inp.files[0]; if (!fl) return; if (fl.size > 300 * 1048576) { toast('That file is too large to share (over 300 MB).'); return; } const buf = new Uint8Array(await fl.arrayBuffer()); await shareFile({ name: fl.name, kind: /^video\//.test(fl.type) ? 'video' : 'file', data: buf, type: fl.type || 'application/octet-stream' }); }; inp.click(); }
async function shareFile(f) { if (!D()) return needApp('Share with the class'); if (!S.on) await start(); if (!S.on) return; await D().cmd('addFile', f); S.snap = await D().cmd('snapshot'); draw(); snd('pop'); toast('Shared with the class: ' + esc(f.name) + ' — students find it under Files.', 4200); }
async function shareHomework(hw) { if (!D()) return needApp('Homework on phones'); if (!S.on) await start(); if (!S.on) return; await D().cmd('addHomework', hw); S.snap = await D().cmd('snapshot'); draw(); toast('Homework shared — students open it under Homework on the class link.', 4200); }

/* ---------- two ways in, side by side: the internet link (any network) and this computer's Wi-Fi address ----------
   Used by the class link, Live class and the phone quiz, so students always have a QR code that works. */
const HBJoin = {
  css: (() => { const st = document.createElement('style'); st.textContent = `.jn{display:grid;grid-template-columns:repeat(auto-fit,minmax(var(--jmin,200px),1fr));gap:14px;align-items:start}
.jn.sm{gap:8px}.jn.sm .jc{padding:8px;border-radius:14px;gap:4px}.jn.sm .jt{font-size:13px}.jn.sm .js{display:none}.jn.sm .jq{padding:5px;border-radius:10px}.jn.sm .ju{font-size:10.5px}.jn.sm .jw{font-size:11.5px;padding:8px}
.jn .jc{background:var(--panel2);border:1px solid var(--line);border-radius:18px;padding:12px;text-align:center;display:flex;flex-direction:column;gap:6px;align-items:center}
.jn .jc.main{border-color:color-mix(in srgb,var(--ok) 55%,var(--line));box-shadow:0 0 0 1px color-mix(in srgb,var(--ok) 30%,transparent)}
.jn .jt{font:800 15px var(--head)}.jn .js{font-size:12.5px;color:var(--muted);line-height:1.35}
.jn .jq{background:#fff;border-radius:14px;padding:8px;width:100%;max-width:var(--qw,260px)}.jn .jq svg{display:block;width:100%;height:auto}
.jn .ju{font:700 12px var(--mono);word-break:break-all;color:var(--ink)}
.jn .jw{width:100%;max-width:var(--qw,260px);aspect-ratio:1;border-radius:14px;border:2px dashed var(--line);display:grid;place-items:center;color:var(--muted);font-size:13px;padding:14px}
.jn .jw.bad{border-color:color-mix(in srgb,var(--bad) 60%,var(--line));color:var(--bad)}
.jn .spin{width:28px;height:28px;border-radius:50%;border:3px solid var(--line);border-top-color:var(--accent);animation:jnspin 1s linear infinite;margin:0 auto 8px}
@keyframes jnspin{to{transform:rotate(360deg)}}
.jn .warn{font-size:12px;color:var(--warn)}`; document.head.appendChild(st); return 1; })(),
  qr(url, cell) { try { const q = qrcode(0, 'M'); q.addData(url); q.make(); return q.createSvgTag({ cellSize: cell || 6, margin: 2, scalable: true }); } catch (e) { return ''; } },
  /* o: { tn, lan: [urls], lanPick, net (internet wanted), qw (QR width px), cell } */
  html(o) { const tn = o.tn || { state: 'off' }, lan = o.lan || [], wifi = o.lanPick && lan.includes(o.lanPick) ? o.lanPick : lan[0], host = u => u.replace(/\/\?pin=\d+$/, '').replace(/^https?:\/\//, '');
    let a = '';
    if (o.net !== false) {
      if (tn.state === 'ready') a = '<div class="jc main"><div class="jt">🌐 Any network</div><div class="js">Mobile data, home Wi-Fi or any school network</div><div class="jq">' + this.qr(tn.url, o.cell) + '</div><div class="ju">' + esc(host(tn.url)) + '</div>' + (tn.checked === false ? '<div class="warn">This computer could not test the link. If phones show an error, use the Wi-Fi code.</div>' : '') + '</div>';
      else if (tn.state === 'failed') a = '<div class="jc"><div class="jt">🌐 Any network</div><div class="jw bad"><div>' + esc(tn.error || 'The internet link could not open.') + '<br><button class="btn sm" data-jretry style="margin-top:8px">' + icon('refresh-cw') + 'Try again</button></div></div></div>';
      else a = '<div class="jc"><div class="jt">🌐 Any network</div><div class="jw"><div><div class="spin"></div>' + esc(tn.msg || 'Opening the internet link…') + '<br><small>The code appears here once it works — use the Wi-Fi code meanwhile.</small></div></div></div>';
    }
    const b = wifi ? '<div class="jc' + (tn.state === 'ready' ? '' : ' main') + '"><div class="jt">📶 Same Wi-Fi</div><div class="js">Phones on the same Wi-Fi as this computer</div><div class="jq">' + this.qr(wifi, o.cell) + '</div><div class="ju">' + esc(host(wifi)) + '</div>' + (lan.length > 1 ? '<select class="sel" data-jlan style="max-width:100%">' + lan.map(u => '<option value="' + esc(u) + '"' + (u === wifi ? ' selected' : '') + '>' + esc(host(u)) + '</option>').join('') + '</select>' : '') + (window.helixDesktop && helixDesktop.allowFirewall ? '<a href="#" data-jfw style="font-size:12px;color:var(--cyan)">Phones can’t connect on Wi-Fi?</a>' : '') + '</div>'
      : '<div class="jc"><div class="jt">📶 Same Wi-Fi</div><div class="jw bad">This computer is not connected to a Wi-Fi or network.</div></div>';
    return '<div class="jn' + (o.small ? ' sm' : '') + '" style="--qw:' + (typeof o.qw === 'number' ? o.qw + 'px' : o.qw || '260px') + (o.small ? ';--jmin:130px' : '') + '">' + a + b + '</div>'; },
  /* the address shown first when only one fits */
  best(o) { const tn = o.tn || {}; return tn.state === 'ready' && o.net !== false ? tn.url : (o.lanPick && (o.lan || []).includes(o.lanPick) ? o.lanPick : (o.lan || [])[0] || ''); }
};
window.HBJoin = HBJoin;
/* "Phones can't connect on Wi-Fi?" — explains the usual causes and lets Windows allow HelixBoard on every network type */
document.addEventListener('click', e => { const a = e.target.closest && e.target.closest('[data-jfw]'); if (!a) return; e.preventDefault(); e.stopPropagation(); const big = document.getElementById('clBigQr'); if (big) big.remove();
  modal.open('<h2>' + icon('monitor-smartphone') + ' Phones can’t connect on Wi-Fi?</h2><ol style="line-height:1.6;padding-inline-start:20px;margin:6px 0 10px"><li><b>Windows Firewall</b> — school Wi-Fi is often a “Public” network, and Windows only allowed HelixBoard on “Private” ones. Press the button below once; Windows asks for permission.</li><li><b>Same Wi-Fi</b> — the phone must be on the same Wi-Fi as this computer, not on mobile data or a guest network.</li><li><b>The Wi-Fi keeps devices apart</b> — many school and guest networks block phones from reaching computers. Then use the <b>🌐 Any network</b> code instead (mobile data always works).</li></ol><div class="foot"><button class="btn" data-close>Close</button><button class="btn primary" id="fwGo">' + icon('lock-open') + 'Allow HelixBoard on all networks</button></div>', sh => {
    sh.querySelector('#fwGo').onclick = async () => { const b = sh.querySelector('#fwGo'); b.disabled = true; b.textContent = 'Waiting for Windows…'; const r = await helixDesktop.allowFirewall(); modal.close(); toast(r && r.ok ? '✓ Done — phones on this Wi-Fi can now reach HelixBoard. Ask them to scan the 📶 code again.' : (r && r.error) || 'Windows could not add the rule.', 6000); }; }); }, true);
window.HBCL = { start, stop, sync: snap => { S.snap = snap; S.dirty = true; draw(); }, shareFile, shareHomework, clearInk, bigQr, boardCanvas, links: () => { if (!S.on) return null; const l = links(); return Object.assign({ pin: S.info.pin, url: S.url }, l); }, get snap() { return S.snap; }, get on() { return S.on; }, get available() { return !!D(); } };
})();
