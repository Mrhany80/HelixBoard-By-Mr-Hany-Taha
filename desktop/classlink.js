/* HelixBoard Class link: one QR code and PIN for the whole lesson. Students' phones and tablets get
   - the teacher's board live (a picture refreshed as it changes) and, when the teacher allows it, a pen to write on it (group work),
   - shared files: lesson recordings and homework,
   - homework they can do on the phone, with results going straight to the teacher.
   Phones use long-polling, which works on the same Wi-Fi and through the internet link (tunnel.js). */
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PAGE = path.join(__dirname, 'classlink-student.html');
const MAX_PLAYERS = 300;
const MAX_FILE = 1024 * 1024 * 1024;

class ClassLink {
  constructor(onEvent) { this.onEvent = onEvent; this.server = null; }

  async start(opts) {
    await this.stop();
    this.title = String((opts && opts.title) || 'Our class').slice(0, 80);
    this.lang = opts && opts.lang === 'ar' ? 'ar' : 'en';
    this.pin = String(crypto.randomInt(100000, 1000000));
    this.players = new Map(); this.badPins = new Map();
    this.board = null; this.boardVer = 0; this.boardOn = false; this.drawOn = false;
    this.files = []; this.homework = new Map(); this.ver = 0; this.tunnel = { state: 'off' }; this.closing = false;
    this.html = fs.readFileSync(PAGE, 'utf8');
    this.server = http.createServer((req, res) => this.handle(req, res).catch(e => { try { json(res, 500, { error: 'Server error' }); } catch (er) {} }));
    this.server.on('clientError', (e, sock) => { try { sock.end('HTTP/1.1 400 Bad Request\r\n\r\n'); } catch (er) {} });
    let port = 0;
    for (const p of [8330, 8331, 8332, 8333, 0]) {
      try { await new Promise((ok, bad) => { this.server.once('error', bad); this.server.listen(p, '0.0.0.0', () => { this.server.off('error', bad); ok(); }); }); port = this.server.address().port; break; } catch (e) { if (p === 0) throw e; }
    }
    this.port = port;
    this.ping = setInterval(() => this.players.forEach(pl => { if (pl.waiters.length && Date.now() - pl.waitSince > 20000) this.flush(pl); }), 5000);
    return { port, pin: this.pin };
  }
  async stop() {
    if (!this.server) return;
    clearInterval(this.ping);
    this.changed('closed');
    if (this.players.size) await new Promise(r => setTimeout(r, 1500));
    this.players.forEach(pl => this.flush(pl));
    const s = this.server; this.server = null;
    await new Promise(r => { s.close(() => r()); s.closeAllConnections && s.closeAllConnections(); setTimeout(r, 500); });
  }

  /* ---------- what the teacher sends ---------- */
  setBoard(jpeg, view) { this.board = jpeg; this.boardView = view; this.boardVer++; this.changed(); }
  setOptions(o) { if ('boardOn' in o) this.boardOn = !!o.boardOn; if ('drawOn' in o) this.drawOn = !!o.drawOn; if (o.title) this.title = String(o.title).slice(0, 80); this.changed(); }
  addFile(f) { const id = crypto.randomBytes(6).toString('hex'); this.files.unshift({ id, name: String(f.name).slice(0, 120), kind: f.kind || 'file', size: f.size || 0, path: f.path || null, data: f.data || null, type: f.type || 'application/octet-stream', at: Date.now() }); this.changed(); return id; }
  removeFile(id) { this.files = this.files.filter(f => f.id !== id); this.changed(); }
  addHomework(hw) { this.homework.set(hw.id, hw); this.changed(); }
  removeHomework(id) { this.homework.delete(id); this.changed(); }

  /* ---------- HTTP ---------- */
  async handle(req, res) {
    const url = new URL(req.url, 'http://x');
    res.setHeader('Cache-Control', 'no-store'); res.setHeader('X-Content-Type-Options', 'nosniff');
    if (req.method === 'GET' && (url.pathname === '/' || url.pathname === '/index.html')) {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Content-Security-Policy': "default-src 'self'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; img-src 'self' blob: data:; media-src 'self'" });
      return res.end(this.html.split('__TITLE__').join(escapeHtml(this.title)).split('__LANG__').join(this.lang));
    }
    if (req.method === 'POST' && url.pathname === '/join') return this.body(req, res, d => this.join(d, res, req));
    const pl = this.players.get(url.searchParams.get('pid') || '');
    if (!pl) return json(res, 403, { error: 'gone' });
    pl.seen = Date.now();
    if (req.method === 'GET' && url.pathname === '/poll') return this.poll(pl, url, res);
    if (req.method === 'GET' && url.pathname === '/board.jpg') { if (!this.boardOn || !this.board) { res.writeHead(404); return res.end(); } res.writeHead(200, { 'Content-Type': 'image/jpeg', 'Content-Length': this.board.length }); return res.end(this.board); }
    if (req.method === 'GET' && url.pathname === '/file') return this.sendFile(url.searchParams.get('id'), res);
    if (req.method === 'GET' && url.pathname === '/hw') { const hw = this.homework.get(url.searchParams.get('id')); if (!hw) return json(res, 404, { error: 'Not found' }); return json(res, 200, studentCopy(hw)); }
    if (req.method === 'POST' && url.pathname === '/stroke') return this.body(req, res, d => this.stroke(pl, d, res), 64 * 1024);
    if (req.method === 'POST' && url.pathname === '/hwsubmit') return this.body(req, res, d => this.hwSubmit(pl, d, res), 64 * 1024);
    res.writeHead(404, { 'Content-Type': 'text/plain' }); res.end('Not found');
  }
  body(req, res, fn, limit) {
    let raw = '', big = false; limit = limit || 4096;
    req.on('data', c => { raw += c; if (raw.length > limit) { big = true; req.destroy(); } });
    req.on('end', () => { if (big) return; let d; try { d = JSON.parse(raw || '{}'); } catch (e) { return json(res, 400, { error: 'Bad request' }); } fn(d); });
  }
  join(d, res, req) {
    const ip = clientIp(req), b = this.badPins.get(ip) || { n: 0, t: Date.now() }; if (Date.now() - b.t > 600000) { b.n = 0; b.t = Date.now(); }
    if (b.n >= 15) return json(res, 429, { error: 'Too many wrong PINs — wait a few minutes.' });
    if (String(d.pin || '').replace(/\D/g, '') !== this.pin) { b.n++; this.badPins.set(ip, b); return json(res, 403, { error: 'That PIN is not right — check the board.' }); }
    const old = d.pid && this.players.get(String(d.pid));
    if (old) return json(res, 200, { pid: old.id, name: old.name, color: old.color });
    if (this.players.size >= MAX_PLAYERS) return json(res, 403, { error: 'The class is full.' });
    let name = String(d.name || '').replace(/[\u0000-\u001f<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, 24);
    if (!name) return json(res, 400, { error: 'Type your name first.' });
    const taken = new Set([...this.players.values()].map(p => p.name.toLowerCase()));
    if (taken.has(name.toLowerCase())) { let i = 2; while (taken.has((name + ' ' + i).toLowerCase())) i++; name = name + ' ' + i; }
    const COLORS = ['#E03131', '#1971C2', '#2F9E44', '#E8590C', '#9C36B5', '#0C8599', '#C2255C', '#5F3DC4', '#66A80F', '#D9480F'];
    const id = crypto.randomBytes(9).toString('base64url');
    this.players.set(id, { id, name, color: COLORS[this.players.size % COLORS.length], waiters: [], waitSince: 0, seen: Date.now(), ver: 0, strokes: [] });
    this.emit('players');
    json(res, 200, { pid: id, name, color: this.players.get(id).color });
  }
  state(pl) {
    return { v: this.server && !this.closing ? 'live' : 'closed', ver: this.ver, title: this.title, name: pl.name, color: pl.color,
      board: this.boardOn && this.board ? { ver: this.boardVer, ar: this.boardView ? this.boardView.ar : 1.6 } : null, draw: this.boardOn && this.drawOn,
      files: this.files.map(f => ({ id: f.id, name: f.name, kind: f.kind, size: f.size })),
      homework: [...this.homework.values()].map(h => ({ id: h.id, title: h.title, due: h.due, n: h.questions.length, done: !!(h.results && h.results[pl.id]) })) };
  }
  poll(pl, url, res) {
    const v = +url.searchParams.get('v') || 0;
    if (v < this.ver || !this.server || this.closing) return json(res, 200, this.state(pl));
    if (pl.waiters.length > 2) this.flush(pl);
    pl.waiters.push(res); pl.waitSince = Date.now();
    res.on('close', () => { pl.waiters = pl.waiters.filter(r => r !== res); });
  }
  flush(pl) { const w = pl.waiters; pl.waiters = []; w.forEach(res => { if (!res.writableEnded) json(res, 200, this.state(pl)); }); }
  changed(v) { this.ver++; if (v === 'closed') this.closing = true; this.players.forEach(pl => this.flush(pl)); }
  sendFile(id, res) {
    const f = this.files.find(x => x.id === id); if (!f) { res.writeHead(404); return res.end(); }
    const headers = { 'Content-Type': f.type, 'Content-Disposition': "attachment; filename*=UTF-8''" + encodeURIComponent(f.name) };
    if (f.data) { headers['Content-Length'] = f.data.length; res.writeHead(200, headers); return res.end(f.data); }
    fs.stat(f.path, (err, st) => { if (err || st.size > MAX_FILE) { res.writeHead(404); return res.end(); } headers['Content-Length'] = st.size; res.writeHead(200, headers); fs.createReadStream(f.path).pipe(res); });
  }
  /* a student's pen line, in 0..1 coordinates of the board picture they saw */
  stroke(pl, d, res) {
    if (!this.boardOn || !this.drawOn) return json(res, 403, { error: 'Writing is off.' });
    const now = Date.now(); pl.strokes = pl.strokes.filter(t => now - t < 10000);
    if (pl.strokes.length >= 30) return json(res, 429, { error: 'Slow down a little.' });
    const pts = Array.isArray(d.pts) ? d.pts.slice(0, 800).filter(p => Array.isArray(p) && p.length === 2 && p.every(n => Number.isFinite(n) && n >= -0.05 && n <= 1.05)) : [];
    if (!pts.length) return json(res, 400, { error: 'Empty line' });
    pl.strokes.push(now);
    const color = /^#[0-9a-f]{6}$/i.test(d.c || '') ? d.c : pl.color, width = Math.max(1, Math.min(30, +d.w || 4));
    this.emit('stroke', { name: pl.name, color, width, pts, view: this.boardView });
    json(res, 200, { ok: true });
  }
  hwSubmit(pl, d, res) {
    const hw = this.homework.get(String(d.id || '')); if (!hw) return json(res, 404, { error: 'This homework is no longer shared.' });
    const ans = Array.isArray(d.ans) ? d.ans.slice(0, hw.questions.length).map(a => Number.isInteger(a) ? a : null) : [];
    const result = { name: pl.name, ans, ms: Math.max(0, Math.min(36e5 * 24, +d.ms || 0)), at: Date.now(), via: 'link' };
    hw.results = hw.results || {}; hw.results[pl.id] = result;
    this.emit('homework', { id: hw.id, result });
    this.changed();
    const key = hw.questions.map(q => q.a);
    json(res, 200, { ok: true, score: ans.filter((a, i) => key[i] >= 0 && a === key[i]).length, total: key.filter(a => a >= 0).length, key: hw.showAnswers ? key : null });
  }

  snapshot() { return { pin: this.pin, port: this.port, tunnel: this.tunnel, boardOn: this.boardOn, drawOn: this.drawOn, files: this.files.map(f => ({ id: f.id, name: f.name, kind: f.kind, size: f.size })), homework: [...this.homework.keys()], players: [...this.players.values()].map(p => ({ name: p.name, color: p.color, online: p.waiters.length > 0 || Date.now() - p.seen < 30000 })) }; }
  emit(type, data) { this.onEvent && this.onEvent(type, data, this.snapshot()); }
  update() { this.emit('status'); }
}

/* phones never receive the answer key unless the teacher chose to show answers after submitting */
function studentCopy(hw) { return { id: hw.id, title: hw.title, due: hw.due, note: hw.note || '', questions: hw.questions.map(q => ({ q: q.q, o: q.o })) }; }
function clientIp(req) { return String(req.headers['cf-connecting-ip'] || (req.headers['x-forwarded-for'] || '').split(',')[0] || req.socket.remoteAddress || '').trim(); }
function json(res, code, obj) { res.writeHead(code, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(obj)); }
function escapeHtml(s) { return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]); }

module.exports = { ClassLink };
