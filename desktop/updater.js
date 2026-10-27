/* Automatic updates for the Windows app: a few seconds after start (and every 6 hours) HelixBoard reads latest.json from the
   newest GitHub release. If that version is newer it asks "Update now?", downloads the Setup .exe, checks its SHA-256 against
   latest.json and starts it; the installer replaces the old version and reopens HelixBoard. The portable copy opens the download page. */
const { app, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const REPO = 'Mrhany80/HelixBoard-By-Mr-Hany-Taha';
const LATEST = 'https://github.com/' + REPO + '/releases/latest/download/latest.json';
const PAGE = 'https://github.com/' + REPO + '/releases/latest';

const newer = (a, b) => { const x = a.split('.').map(Number), y = b.split('.').map(Number);
  for (let i = 0; i < 3; i++) { if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) > (y[i] || 0); } return false; };

function createUpdater(getWin, fetch) {
  const skipFile = path.join(app.getPath('userData'), 'update-skip.txt');
  let busy = false;

  async function check(manual) {
    if (busy || !app.isPackaged && !process.env.HB_UPDATE_TEST) return; busy = true;
    try {
      const r = await fetch(LATEST + '?t=' + Date.now()); if (!r.ok) throw new Error('HTTP ' + r.status);
      const info = await r.json();
      if (!/^\d+\.\d+\.\d+$/.test(info.version || '') || !newer(info.version, app.getVersion())) { if (manual) dialog.showMessageBox(getWin(), { message: 'HelixBoard is up to date (' + app.getVersion() + ').' }); return; }
      let skipped = ''; try { skipped = fs.readFileSync(skipFile, 'utf8').trim(); } catch (e) {}
      if (!manual && skipped === info.version) return;
      const portable = !!process.env.PORTABLE_EXECUTABLE_FILE;
      const { response } = await dialog.showMessageBox(getWin(), { type: 'info', title: 'HelixBoard update',
        message: 'A new version of HelixBoard is ready: ' + info.version, detail: (info.notes ? info.notes + '\n\n' : '') + (portable ? 'The download page will open.' : 'HelixBoard will download it, close and reopen updated. Your boards are kept.'),
        buttons: ['Update now', 'Later', 'Skip this version'], defaultId: 0, cancelId: 1 });
      if (response === 2) { fs.writeFileSync(skipFile, info.version); return; }
      if (response !== 0) return;
      if (portable || !info.setup || !/^[0-9a-f]{64}$/i.test(info.sha256 || '')) { shell.openExternal(PAGE); return; }
      const w = getWin(); if (w) w.setProgressBar(2);
      const res = await fetch('https://github.com/' + REPO + '/releases/download/v' + info.version + '/' + encodeURIComponent(info.setup));
      if (!res.ok) throw new Error('download HTTP ' + res.status);
      const buf = Buffer.from(await res.arrayBuffer());
      if (w) w.setProgressBar(-1);
      if (crypto.createHash('sha256').update(buf).digest('hex') !== info.sha256.toLowerCase()) throw new Error('the download did not match its checksum');
      const file = path.join(app.getPath('temp'), 'HelixBoard-Setup-' + info.version + '.exe');
      fs.writeFileSync(file, buf);
      const err = await shell.openPath(file); if (err) throw new Error(err);
      setTimeout(() => app.quit(), 1500);
    } catch (e) {
      const w = getWin(); if (w) w.setProgressBar(-1);
      if (manual) dialog.showMessageBox(getWin(), { type: 'warning', message: 'Could not check for updates.', detail: String(e.message || e) });
    } finally { busy = false; }
  }
  setTimeout(() => check(false), 8000);
  setInterval(() => check(false), 6 * 3600 * 1000);
  return { check };
}
module.exports = { createUpdater, newer };
