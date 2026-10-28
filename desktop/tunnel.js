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
/* cloudflared prints the address before the link is connected; phones that scan too early get an error (and may remember it for minutes),
   so the address is only shown once Cloudflare reports a registered connection AND the new name answers on the public internet */
const READY_RE = /Registered tunnel connection|Connection [0-9a-f-]+ registered/i;
const sleep = ms => new Promise(r => setTimeout(r, ms));

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

function startTunnel(bin, port, home) {
  return new Promise((resolve, reject) => {
    /* http2 runs over the normal HTTPS port (443) that school firewalls allow; the default (QUIC over UDP) is often blocked.
       A private home folder means a cloudflared config file left on this PC by other software can never break the quick tunnel. */
    const proc = spawn(bin, ['tunnel', '--no-autoupdate', '--protocol', 'http2', '--edge-ip-version', 'auto', '--url', 'http://127.0.0.1:' + port],
      { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'], env: Object.assign({}, process.env, { USERPROFILE: home, HOME: home }) });
    let done = false, log = '', url = null;
    const finish = (err, u) => { if (done) return; done = true; clearTimeout(to); if (err) { try { proc.kill(); } catch (e) {} reject(err); } else resolve({ url: u, proc }); };
    const read = buf => { log = (log + String(buf)).slice(-8000); if (!url) { const m = log.match(URL_RE); if (m) url = m[0]; } if (url && READY_RE.test(log)) finish(null, url); };
    proc.stdout.on('data', read); proc.stderr.on('data', read);
    proc.on('error', e => finish(new Error('The tunnel tool could not start: ' + e.message)));
    proc.on('exit', code => finish(new Error(/(429|Too Many Requests)/.test(log) ? 'Cloudflare is busy right now.' : 'The internet link closed (' + code + ') — the network may be blocking Cloudflare.')));
    const to = setTimeout(() => finish(new Error(url ? 'Cloudflare gave an address but the link did not connect — this network may block it.' : 'The internet link did not open in time — the network may be blocking Cloudflare.')), 60000);
  });
}
/* waits until the new address exists in public DNS (asked over HTTPS, so this PC's own DNS cache never stores a "not found"),
   then checks the whole path: Cloudflare → tunnel → this app. Returns true when a phone would see the class page. */
async function reachable(url, netFetch, onStatus) {
  const host = new URL(url).hostname, t0 = Date.now();
  if (!process.env.HB_CLOUDFLARED) {
    onStatus('Waiting for the internet address to go live…');
    while (Date.now() - t0 < 45000) {
      try { const r = await netFetch('https://cloudflare-dns.com/dns-query?name=' + encodeURIComponent(host) + '&type=A', { headers: { accept: 'application/dns-json' } }); const j = await r.json(); if (j && j.Status === 0 && (j.Answer || []).length) break; } catch (e) {}
      await sleep(1500);
    }
    await sleep(1500);
  }
  onStatus('Checking the internet link…');
  for (let i = 0; i < 5; i++) {
    try { const r = await netFetch((process.env.HB_TUNNEL_PING_ORIGIN || url) + '/hb-ping?t=' + Date.now()); if (r.ok) { const j = await r.json(); if (j && j.app === 'helixboard') return true; } } catch (e) {}
    await sleep(2000);
  }
  return false;
}

class Tunnel {
  constructor(dir, netFetch) { this.dir = dir; this.netFetch = netFetch; this.proc = null; this.gen = 0; }
  /* resolves { url, checked }: checked is false when this PC could not reach the link (phones on other networks may still) */
  async open(port, onStatus) {
    this.close(); const gen = ++this.gen;
    const bin = await ensureCloudflared(this.dir, this.netFetch, onStatus);
    const home = path.join(this.dir, 'cf-home'); try { fs.mkdirSync(home, { recursive: true }); } catch (e) {}
    let last = null;
    for (let attempt = 1; attempt <= 3; attempt++) {
      if (gen !== this.gen) throw new Error('cancelled');
      onStatus(attempt === 1 ? 'Opening the internet link…' : 'Trying again (' + attempt + ' of 3)…');
      try {
        const { url, proc } = await startTunnel(bin, port, home);
        if (gen !== this.gen) { try { proc.kill(); } catch (e) {} throw new Error('cancelled'); }
        this.proc = proc; proc.on('exit', () => { if (this.proc === proc) { this.proc = null; this.onDrop && this.onDrop(); } });
        const ok = await reachable(url, this.netFetch, onStatus);
        if (gen !== this.gen) throw new Error('cancelled');
        if (ok || attempt === 3) return { url, checked: ok };
        last = new Error('The internet link opened but did not answer.'); this.close(); this.gen = gen;
      } catch (e) { if (e.message === 'cancelled') throw e; last = e; }
      await sleep(attempt * 4000);
    }
    throw last || new Error('The internet link could not open.');
  }
  close() { this.gen++; const p = this.proc; this.proc = null; if (p) { try { p.kill(); } catch (e) {} } }
}

module.exports = { Tunnel, verifySignature };
