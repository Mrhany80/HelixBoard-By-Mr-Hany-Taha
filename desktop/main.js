/* HelixBoard for Windows — Electron shell around the single-file board (app/index.html) */
const { app, BrowserWindow, ipcMain, shell, dialog, Menu, screen, desktopCapturer, net } = require('electron');
const path = require('path');
const fs = require('fs');
const { createUpdater } = require('./updater');

app.setAppUserModelId('com.ghis.helixboard');

const OPENABLE = /\.(helix|hbset|pdf|docx|pptx|txt|md)$/i;
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
/* automated tests run each check in a fresh, empty profile */
if (process.env.HB_USER_DATA) app.setPath('userData', process.env.HB_USER_DATA);
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

  win.loadFile(path.join(__dirname, 'app', 'index.html'), process.env.HB_USER_DATA ? { query: { nointro: '1', accskip: '1' } } : undefined);
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

ipcMain.on('show-file', (e, file) => { if (fromMain(e) && typeof file === 'string' && fs.existsSync(file)) shell.showItemInFolder(file); });

app.whenReady().then(() => {
  createWindow();
  const updater = createUpdater(() => win, url => net.fetch(url));
  ipcMain.on('update:check', e => { if (fromMain(e)) updater.check(true); });
  process.argv.slice(1).filter(a => OPENABLE.test(a)).forEach(openPath);
});
app.on('open-file', (e, p) => { e.preventDefault(); openPath(p); });
app.on('window-all-closed', () => app.quit());
