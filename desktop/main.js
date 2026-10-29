/* HelixBoard for Windows — Electron shell around the single-file board (app/index.html) */
const { app, BrowserWindow, ipcMain, shell, dialog, Menu, screen, desktopCapturer, net } = require('electron');
const path = require('path');
const fs = require('fs');
const { LiveQuiz, lanAddresses } = require('./live');
const { ClassLink } = require('./classlink');
const { Tunnel } = require('./tunnel');
const { createUpdater } = require('./updater');

app.setAppUserModelId('com.ghis.helixboard');

const OPENABLE = /\.(helix|hbset|hbhw|hbres|pdf|docx|pptx|txt|md)$/i;
let win = null;
let rendererReady = false;
const pending = [];

/* only one HelixBoard window: opening a second copy (or double-clicking a .helix file) focuses the first */
if (!app.requestSingleInstanceLock()) { app.quit(); return; }
app.on('second-instance', (e, argv) => {
  argv.slice(1).filter(a => OPENABLE.test(a)).forEach(openPath);
  if (win) { if (win.isMinimized()) win.restore(); win.focus(); }
});

/* ---------- window position and size are remembered between sessions ---------- */
const stateFile = () => path.join(app.getPath('userData'), 'window.json');
function loadState() {
  try {
    const s = JSON.parse(fs.readFileSync(stateFile(), 'utf8'));
    const area = screen.getDisplayMatching(s.bounds).workArea;
    const visible = s.bounds.x < area.x + area.width && s.bounds.x + s.bounds.width > area.x && s.bounds.y < area.y + area.height && s.bounds.y + s.bounds.height > area.y;
    return visible ? s : { maximized: true };
  } catch (e) { return { maximized: true }; }
}
function saveState() {
  if (!win || win.isDestroyed()) return;
  try { fs.writeFileSync(stateFile(), JSON.stringify({ bounds: win.getNormalBounds(), maximized: win.isMaximized() })); } catch (e) {}
}

function createWindow() {
  const st = loadState();
  win = new BrowserWindow({
    ...(st.bounds || { width: 1366, height: 820 }),
    minWidth: 900, minHeight: 600,
    show: false,
    backgroundColor: '#120A14',
    title: 'HelixBoard By Mr. Hany Taha',
    icon: path.join(__dirname, 'build', 'icon.ico'),
    autoHideMenuBar: true,
    webPreferences: {
      autoplayPolicy: 'no-user-gesture-required',
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: true,
    },
  });
  Menu.setApplicationMenu(null);
  win.once('ready-to-show', () => { if (st.maximized) win.maximize(); win.show(); });
  ['resize', 'move', 'close'].forEach(ev => win.on(ev, saveState));
  win.on('closed', () => { win = null; rendererReady = false; });

  /* keyboard: F11 full screen, F12 developer tools (for reporting errors), Ctrl+R reload */
  win.webContents.on('before-input-event', (e, input) => {
    if (input.type !== 'keyDown') return;
    if (input.key === 'F11') { win.setFullScreen(!win.isFullScreen()); e.preventDefault(); }
    else if (input.key === 'F12') { win.webContents.toggleDevTools(); e.preventDefault(); }
    else if (input.control && !input.shift && input.key.toLowerCase() === 'r') { win.webContents.reload(); e.preventDefault(); }
  });

  /* links (Atlas apps, help pages) open in the normal browser; the board itself never navigates away */
  win.webContents.setWindowOpenHandler(({ url }) => { if (/^https?:/i.test(url)) shell.openExternal(url); return { action: 'deny' }; });
  win.webContents.on('will-navigate', (e, url) => { if (url !== win.webContents.getURL()) { e.preventDefault(); if (/^https?:/i.test(url)) shell.openExternal(url); } });

  /* exports (PNG, PDF, .helix, .hbset) get a proper Save As dialog that starts in Documents\HelixBoard */
  win.webContents.session.on('will-download', (e, item) => {
    const dir = path.join(app.getPath('documents'), 'HelixBoard');
    try { fs.mkdirSync(dir, { recursive: true }); } catch (er) {}
    item.setSaveDialogOptions({ title: 'Save from HelixBoard', defaultPath: path.join(dir, item.getFilename()) });
  });

  /* camera (document camera, photo → text) and microphone (noise meter, recording) are allowed; nothing else */
  win.webContents.session.setPermissionRequestHandler((wc, perm, cb) => cb(['media', 'fullscreen', 'clipboard-sanitized-write', 'clipboard-read', 'notifications'].includes(perm)));

  win.loadFile(path.join(__dirname, 'app', 'index.html'));
}

/* ---------- files opened from Explorer (double-click, "Open with", drag onto the icon) ---------- */
function openPath(p) {
  let data;
  try { data = fs.readFileSync(p); } catch (e) { dialog.showErrorBox('HelixBoard', 'Could not open ' + p + '\n' + e.message); return; }
  const msg = { name: path.basename(p), data: new Uint8Array(data.buffer, data.byteOffset, data.byteLength) };
  if (win && rendererReady) win.webContents.send('open-file', msg); else pending.push(msg);
}
ipcMain.on('renderer-ready', e => {
  if (!win || e.sender !== win.webContents) return;
  rendererReady = true;
  while (pending.length) win.webContents.send('open-file', pending.shift());
});

/* ---------- prompt(): Electron has none, so the board's few prompts get a small native-looking dialog ---------- */
ipcMain.on('prompt-sync', (e, message, value) => {
  const parent = BrowserWindow.fromWebContents(e.sender);
  const pw = new BrowserWindow({
    parent, modal: true, width: 460, height: 210, resizable: false, minimizable: false, maximizable: false,
    show: false, title: 'HelixBoard', backgroundColor: '#1C1220', autoHideMenuBar: true,
    icon: path.join(__dirname, 'build', 'icon.ico'),
    webPreferences: { preload: path.join(__dirname, 'prompt-preload.js'), contextIsolation: true, sandbox: true },
  });
  let answered = false;
  const finish = v => { if (answered) return; answered = true; e.returnValue = v; if (!pw.isDestroyed()) pw.destroy(); };
  const onDone = (ev, v) => { if (ev.sender === pw.webContents) { ipcMain.removeListener('prompt-done', onDone); finish(v); } };
  ipcMain.on('prompt-done', onDone);
  pw.on('closed', () => { ipcMain.removeListener('prompt-done', onDone); finish(null); });
  pw.loadFile(path.join(__dirname, 'prompt.html'), { query: { m: message || '', v: value || '' } });
  pw.once('ready-to-show', () => pw.show());
});

/* ---------- screen capture and "annotate screen" (write over any program, then send it to the board) ---------- */
const wait = ms => new Promise(r => setTimeout(r, ms));
async function captureScreen(bounds) {
  const d = screen.getDisplayMatching(bounds), sf = d.scaleFactor || 1;
  const srcs = await desktopCapturer.getSources({ types: ['screen'], thumbnailSize: { width: Math.round(d.size.width * sf), height: Math.round(d.size.height * sf) } });
  const src = srcs.find(x => String(x.display_id) === String(d.id)) || srcs[0];
  return src && !src.thumbnail.isEmpty() ? src.thumbnail.toDataURL() : null;
}
ipcMain.handle('screen:capture', async e => {
  if (!win || e.sender !== win.webContents) return null;
  const b = win.getBounds(); win.minimize(); await wait(500);
  let url = null; try { url = await captureScreen(b); } catch (er) { console.error(er); }
  win.restore(); win.focus(); return url;
});
let overlayWin = null;
ipcMain.on('overlay:open', e => {
  if (!win || e.sender !== win.webContents || overlayWin) return;
  const d = screen.getDisplayMatching(win.getBounds());
  overlayWin = new BrowserWindow({ ...d.bounds, transparent: true, frame: false, resizable: false, movable: false, alwaysOnTop: true, hasShadow: false, fullscreenable: false, backgroundColor: '#00000000', title: 'HelixBoard — annotate screen', icon: path.join(__dirname, 'build', 'icon.ico'),
    webPreferences: { preload: path.join(__dirname, 'overlay-preload.js'), contextIsolation: true, sandbox: true } });
  overlayWin.setAlwaysOnTop(true, 'screen-saver');
  overlayWin.loadFile(path.join(__dirname, 'overlay.html'));
  overlayWin.on('closed', () => { overlayWin = null; if (win) { win.restore(); win.focus(); } });
  win.minimize();
});
const fromOverlay = e => overlayWin && e.sender === overlayWin.webContents;
ipcMain.on('overlay:through', (e, on) => { if (fromOverlay(e)) overlayWin.setIgnoreMouseEvents(!!on, { forward: true }); });
ipcMain.on('overlay:close', e => { if (fromOverlay(e)) overlayWin.close(); });
ipcMain.handle('overlay:snap', async e => {
  if (!fromOverlay(e)) return false;
  let url = null; try { url = await captureScreen(overlayWin.getBounds()); } catch (er) { console.error(er); }
  if (url && win) win.webContents.send('insert-image', url);
  return !!url;
});

/* ---------- phone quiz server (classroom Wi-Fi) ---------- */
const live = new LiveQuiz(snap => { if (win && !win.isDestroyed()) win.webContents.send('live:update', snap); });
/* the internet link: students on any network join through a public https address that forwards here.
   Shared by the phone quiz and the class link: the address is shown only once it really works, and a dropped link reopens by itself
   (up to 4 times in 10 minutes) with a new QR code; the same-Wi-Fi addresses always work alongside it. */
function linkKeeper(srv, getTunnel) {
  let drops = [];
  const open = async () => {
    if (!srv.server) return; const t = getTunnel();
    t.onDrop = () => { if (!srv.server) return; drops = drops.filter(x => Date.now() - x < 600000); drops.push(Date.now());
      if (drops.length <= 4) { srv.tunnel = { state: 'connecting', msg: 'The internet link dropped — reopening it (scan the new QR code)…' }; srv.update(); setTimeout(open, 1500); }
      else { srv.tunnel = { state: 'failed', error: 'The internet link keeps dropping on this network. Phones on the same Wi-Fi can still join.' }; srv.update(); } };
    const status = msg => { if (srv.server) { srv.tunnel = { state: 'connecting', msg }; srv.update(); } };
    status('Opening the internet link…');
    try { const r = await t.open(srv.port, status); if (srv.server) { srv.tunnel = { state: 'ready', url: r.url + '/?pin=' + srv.pin, checked: r.checked }; srv.update(); } else t.close(); }
    catch (er) { if (er.message === 'cancelled') return; if (srv.server) { srv.tunnel = { state: 'failed', error: er.message + ' Phones on the same Wi-Fi can still join.' }; srv.update(); } }
  };
  return open;
}
let tunnel = null;
const openLink = linkKeeper(live, () => (tunnel = tunnel || new Tunnel(app.getPath('userData'), (url, o) => net.fetch(url, o))));
ipcMain.handle('live:start', async (e, quiz) => {
  try { const info = await live.start(quiz); if (quiz.internet !== false) openLink(); return info; }
  catch (er) { return { error: er.code === 'EADDRINUSE' ? 'The quiz port is busy — close other quiz windows and try again.' : er.message }; }
});
ipcMain.handle('live:cmd', (e, cmd, arg) => {
  if (cmd === 'question') live.question(arg.qi, arg.secs, arg.pace);
  else if (cmd === 'opts') live.setOpts(arg);
  else if (cmd === 'reveal') live.reveal();
  else if (cmd === 'board') live.board();
  else if (cmd === 'end') live.end();
  else if (cmd === 'results') return live.results();
  else if (cmd === 'link') { openLink(); }
  else if (cmd === 'stop') return live.stop().then(() => { if (tunnel) tunnel.close(); return true; });
  return live.server ? live.snapshot() : null;
});
/* ---------- Class link: live board, student pens, shared files and homework for phones ---------- */
const cl = new ClassLink((type, data, snap) => { if (win && !win.isDestroyed()) win.webContents.send('cl:event', type, data, snap); });
let clTunnel = null;
const openClLink = linkKeeper(cl, () => (clTunnel = clTunnel || new Tunnel(app.getPath('userData'), (url, o) => net.fetch(url, o))));
const fromMain = e => win && e.sender === win.webContents;
ipcMain.handle('cl:start', async (e, opts) => {
  if (!fromMain(e)) return null;
  try { const r = await cl.start(opts || {}); if (!opts || opts.internet !== false) openClLink(); return Object.assign(r, { urls: lanAddresses().map(a => 'http://' + a + ':' + r.port + '/?pin=' + r.pin) }); }
  catch (er) { return { error: er.message }; }
});
ipcMain.handle('cl:cmd', async (e, cmd, a) => {
  if (!fromMain(e) || !cl.server) return null;
  if (cmd === 'board') cl.setBoard(Buffer.from(a.jpeg), a.view);
  else if (cmd === 'options') cl.setOptions(a);
  else if (cmd === 'addFile') { if (a.path && !fs.existsSync(a.path)) return null; return cl.addFile({ name: a.name, kind: a.kind, path: a.path, data: a.data ? Buffer.from(a.data) : null, type: a.type, size: a.size || (a.data ? a.data.byteLength : fs.statSync(a.path).size) }); }
  else if (cmd === 'removeFile') cl.removeFile(a);
  else if (cmd === 'addHomework') cl.addHomework(a);
  else if (cmd === 'removeHomework') cl.removeHomework(a);
  else if (cmd === 'activity') { const id = cl.setActivity(a && a.bg ? Object.assign({}, a, { bg: Buffer.from(a.bg) }) : a); return id ? cl.responses() : { error: 'That activity could not start.' }; }
  else if (cmd === 'actOptions') { cl.actOptions(a || {}); return cl.responses(); }
  else if (cmd === 'endActivity') cl.endActivity();
  else if (cmd === 'responses') return cl.responses();
  else if (cmd === 'share') cl.share(a || null);
  else if (cmd === 'removeResponse') cl.removeResponse(a && a.pid, a && a.idx);
  else if (cmd === 'award') cl.award(a && a.pid, a && a.n);
  else if (cmd === 'lock') cl.setLock(a);
  else if (cmd === 'xp') cl.setXp(a);
  else if (cmd === 'lowerHand') cl.lowerHand(a || null);
  else if (cmd === 'clearQuestions') cl.clearQuestions();
  else if (cmd === 'link') openClLink();
  else if (cmd === 'stop') { await cl.stop(); if (clTunnel) clTunnel.close(); return true; }
  return cl.snapshot();
});
/* Reports → PDF: the page switches to its print layout, Chromium prints it, the teacher picks where to save */
ipcMain.handle('report:pdf', async (e, name) => {
  if (!fromMain(e)) return null;
  const r = await dialog.showSaveDialog(win, { title: 'Save the report as PDF', defaultPath: path.join(app.getPath('documents'), String(name || 'HelixBoard report.pdf').replace(/[\\/:*?"<>|]+/g, '-')), filters: [{ name: 'PDF', extensions: ['pdf'] }] });
  if (r.canceled || !r.filePath) return { ok: false };
  const pdf = await win.webContents.printToPDF({ printBackground: true, landscape: true, pageSize: 'A4', margins: { marginType: 'none' } });
  fs.writeFileSync(r.filePath, pdf); shell.showItemInFolder(r.filePath); return { ok: true, file: r.filePath };
});
/* school Wi-Fi is often a "Public" network, and the first-run firewall question only allows "Private" ones, so phones on the Wi-Fi are
   silently blocked. This adds one inbound rule for HelixBoard itself (all network types), after the usual Windows administrator prompt. */
ipcMain.handle('fw:allow', async e => {
  if (!fromMain(e) || process.platform !== 'win32') return { ok: false, error: 'Only needed on Windows.' };
  /* the elevated command is passed base64-encoded, so no path or quote can break it; one rule for this program, one for the class ports
     (the portable copy runs from a temporary folder, so the port rule is what keeps it working) */
  const exe = process.execPath.replace(/[`$"]/g, '`$&');
  const inner = 'netsh advfirewall firewall delete rule name="HelixBoard phones" | Out-Null\r\n' +
    'netsh advfirewall firewall add rule name="HelixBoard phones" dir=in action=allow program="' + exe + '" enable=yes profile=any | Out-Null\r\n' +
    'netsh advfirewall firewall add rule name="HelixBoard phones" dir=in action=allow protocol=TCP localport=8320-8333 enable=yes profile=any | Out-Null';
  const b64 = Buffer.from(inner, 'utf16le').toString('base64');
  const cmd = "Start-Process -FilePath powershell.exe -Verb RunAs -Wait -WindowStyle Hidden -ArgumentList '-NoProfile','-EncodedCommand','" + b64 + "'";
  return new Promise(resolve => require('child_process').execFile('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', cmd], { windowsHide: true, timeout: 120000 },
    err => resolve(err ? { ok: false, error: /cancel|1223/i.test(String(err.message)) ? 'Windows did not get permission (the prompt was cancelled).' : 'Windows could not add the rule: ' + err.message } : { ok: true })));
});
/* lesson recordings are written to Documents\HelixBoard\Recordings, so they can be shared without copying them through memory again */
ipcMain.handle('rec:save', async (e, name, bytes) => {
  if (!fromMain(e)) return null;
  const dir = path.join(app.getPath('documents'), 'HelixBoard', 'Recordings'); fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, String(name).replace(/[\\/:*?"<>|]+/g, '_'));
  fs.writeFileSync(file, Buffer.from(bytes)); return file;
});
ipcMain.on('show-file', (e, file) => { if (fromMain(e) && typeof file === 'string' && fs.existsSync(file)) shell.showItemInFolder(file); });

app.on('before-quit', () => { if (tunnel) tunnel.close(); if (clTunnel) clTunnel.close(); live.stop(); cl.stop(); });

app.whenReady().then(() => {
  createWindow();
  const updater = createUpdater(() => win, url => net.fetch(url));
  ipcMain.on('update:check', e => { if (fromMain(e)) updater.check(true); });
  process.argv.slice(1).filter(a => OPENABLE.test(a)).forEach(openPath);
});
app.on('open-file', (e, p) => { e.preventDefault(); openPath(p); });
app.on('window-all-closed', () => app.quit());
