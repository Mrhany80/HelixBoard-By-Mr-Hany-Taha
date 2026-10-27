/* Internet link for the phone quiz: a free Cloudflare "quick tunnel" (https://<random>.trycloudflare.com, no account needed) forwards to the quiz
   server on this computer, so students can join from any network — mobile data, home Wi-Fi, another school network.
   cloudflared is Cloudflare's own tunnel program. It is downloaded once from Cloudflare's official GitHub release and is only kept if Windows
   confirms a valid Cloudflare, Inc. code signature or its SHA-256 matches the checksum in that release's notes. */
const { spawn, execFile } = require('child_process');
const fs = require('fs');
const path = require('path');

const ASSET = 'cloudflared-windows-amd64.exe';
const RELEASE = 'https://api.github.com/repos/cloudflare/cloudflared/releases/latest';
const DOWNLOAD = 'https://github.com/cloudflare/cloudflared/releases/latest/download/' + ASSET;
const URL_RE = /https:\/\/[a-z0-9-]+\.trycloudflare\.com/i;

/* Windows checks the Authenticode signature; anything not validly signed by Cloudflare is deleted and never run */
function verifySignature(file) {
  return new Promise(resolve => {
    if (process.platform !== 'win32') return resolve(false);
    const ps = "$s = Get-AuthenticodeSignature -LiteralPath $env:HB_FILE; [Console]::Out.Write($s.Status.ToString() + '|' + $s.SignerCertificate.Subject)";
    execFile('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', ps], { env: Object.assign({}, process.env, { HB_FILE: file }), windowsHide: true, timeout: 30000 }, (err, out) => {
      if (err) return resolve(false);
      const [status, subject] = String(out).split('|');
      resolve(status === 'Valid' && /O=Cloudflare,? Inc/i.test(subject || ''));
    });
  });
}

async function ensureCloudflared(dir, netFetch, onStatus) {
  /* for testing on other systems a cloudflared program can be named explicitly */
  if (process.env.HB_CLOUDFLARED) return process.env.HB_CLOUDFLARED;
  if (process.platform !== 'win32') throw new Error('The internet link is available in the Windows app.');
  const bin = path.join(dir, 'cloudflared.exe'), okFile = bin + '.ok';
  if (fs.existsSync(bin) && fs.existsSync(okFile) && fs.readFileSync(okFile, 'utf8') === sha256(fs.readFileSync(bin))) return bin;
  onStatus('Downloading Cloudflare’s free tunnel tool (one time, about 60 MB)…');
  /* the release notes list a SHA-256 for every file; the download must match it, or carry Cloudflare's own code signature */
  const rel = await netFetch(RELEASE).then(r => r.ok ? r.json() : null).catch(() => null);
  const asset = rel && (rel.assets || []).find(a => a.name === ASSET);
  const res = await netFetch(asset ? asset.browser_download_url : DOWNLOAD);
  if (!res.ok) throw new Error('Could not download the tunnel tool (HTTP ' + res.status + ').');
  const buf = Buffer.from(await res.arrayBuffer()), sum = sha256(buf);
  const listed = rel && new RegExp(ASSET.replace(/[.-]/g, '\\$&') + '\\s*:?\\s*([a-f0-9]{64})', 'i').exec(rel.body || '');
  const part = bin + '.part'; fs.writeFileSync(part, buf);
  onStatus('Checking the tunnel tool…');
  const signed = await verifySignature(part), sumOk = !!(listed && listed[1].toLowerCase() === sum);
  if (!signed && !sumOk) { try { fs.unlinkSync(part); } catch (e) {} throw new Error('The downloaded tunnel tool could not be verified (no Cloudflare signature and no matching checksum), so it was deleted and not used.'); }
  fs.renameSync(part, bin); fs.writeFileSync(okFile, sum);
  return bin;
}
const sha256 = b => require('crypto').createHash('sha256').update(b).digest('hex');

function startTunnel(bin, port) {
  return new Promise((resolve, reject) => {
    const proc = spawn(bin, ['tunnel', '--no-autoupdate', '--url', 'http://127.0.0.1:' + port], { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    let done = false, log = '';
    const finish = (err, url) => { if (done) return; done = true; clearTimeout(to); if (err) { try { proc.kill(); } catch (e) {} reject(err); } else resolve({ url, proc }); };
    const read = buf => { const t = String(buf); log = (log + t).slice(-4000); const m = t.match(URL_RE) || log.match(URL_RE); if (m) finish(null, m[0]); };
    proc.stdout.on('data', read); proc.stderr.on('data', read);
    proc.on('error', e => finish(new Error('The tunnel tool could not start: ' + e.message)));
    proc.on('exit', code => finish(new Error('The internet link closed (' + code + '). ' + (/(429|Too Many Requests)/.test(log) ? 'Cloudflare is busy — try again in a minute.' : 'The school network may be blocking it.'))));
    const to = setTimeout(() => finish(new Error('The internet link did not open in time — the network may be blocking Cloudflare.')), 45000);
  });
}

class Tunnel {
  constructor(dir, netFetch) { this.dir = dir; this.netFetch = netFetch; this.proc = null; }
  async open(port, onStatus) {
    this.close();
    const bin = await ensureCloudflared(this.dir, this.netFetch, onStatus);
    onStatus('Opening the internet link…');
    const { url, proc } = await startTunnel(bin, port);
    this.proc = proc;
    proc.on('exit', () => { if (this.proc === proc) { this.proc = null; this.onDrop && this.onDrop(); } });
    return url;
  }
  close() { const p = this.proc; this.proc = null; if (p) { try { p.kill(); } catch (e) {} } }
}

module.exports = { Tunnel, verifySignature };
