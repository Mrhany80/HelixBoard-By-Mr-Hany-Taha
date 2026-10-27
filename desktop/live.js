/* HelixBoard phone quiz: a small web server on the teacher's computer. Students scan the QR code, type their name and answer on their phones —
   on the same Wi-Fi, or from any network through an internet link (see tunnel.js). Phones use long-polling (one open request each), which works
   through tunnels and school proxies alike. The answers stay on the teacher's computer; students never receive the right answer before it is revealed. */
const http = require('http');
const os = require('os');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const MAX_PLAYERS = 300;
const PAGE = path.join(__dirname, 'live-student.html');

function lanAddresses() {
  const out = [];
  Object.entries(os.networkInterfaces()).forEach(([name, list]) => (list || []).forEach(a => {
    if (a.family !== 'IPv4' && a.family !== 4) return;
    if (a.internal || a.address.startsWith('169.254.')) return;
    const priv = /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(a.address);
    out.push({ address: a.address, name, priv });
  }));
  /* private Wi-Fi/Ethernet addresses first; virtual adapters (VirtualBox, Hyper-V, VPN) last */
  const virt = n => /virtual|vbox|vmware|hyper-v|vethernet|docker|wsl|tailscale|zerotier|loopback/i.test(n);
  return out.sort((a, b) => (virt(a.name) - virt(b.name)) || (b.priv - a.priv)).map(a => a.address);
}

class LiveQuiz {
  constructor(onUpdate) { this.onUpdate = onUpdate; this.server = null; }

  async start(quiz) {
    await this.stop();
    if (!quiz || !Array.isArray(quiz.questions) || !quiz.questions.length) throw new Error('This set has no questions.');
    this.title = String(quiz.title || 'Quiz').slice(0, 80);
    this.qs = quiz.questions.slice(0, 100).map(q => ({ q: String(q.q || '').slice(0, 600), o: (q.o || []).slice(0, 6).map(x => String(x).slice(0, 200)), a: Number.isInteger(q.a) ? q.a : -1, ex: String(q.ex || '').slice(0, 400) }));
    this.pin = String(crypto.randomInt(100000, 1000000));
    this.badPins = new Map(); this.tunnel = { state: 'off' };
    this.players = new Map();
    this.phase = 'lobby'; this.qi = -1; this.limit = 0; this.t0 = 0; this.last = null;
    this.html = fs.readFileSync(PAGE, 'utf8');
    this.server = http.createServer((req, res) => this.handle(req, res));
    this.server.on('clientError', (e, sock) => { try { sock.end('HTTP/1.1 400 Bad Request\r\n\r\n'); } catch (er) {} });
    let port = 0;
    for (const p of [8320, 8321, 8322, 8323, 8324, 0]) {
      try { await new Promise((ok, bad) => { this.server.once('error', bad); this.server.listen(p, '0.0.0.0', () => { this.server.off('error', bad); ok(); }); }); port = this.server.address().port; break; } catch (e) { if (p === 0) throw e; }
    }
    this.port = port;
    /* a waiting phone gets an empty answer every 20 s, so proxies and tunnels never drop the request */
    this.ping = setInterval(() => this.players.forEach(pl => { if (pl.waiters.length && Date.now() - pl.waitSince > 20000) this.flush(pl); }), 5000);
    const addrs = lanAddresses();
    return { port, pin: this.pin, urls: addrs.map(a => 'http://' + a + ':' + port + '/?pin=' + this.pin), local: 'http://localhost:' + port + '/?pin=' + this.pin };
  }

  async stop() {
    if (!this.server) return;
    clearInterval(this.ping); clearTimeout(this.timer);
    this.broadcast({ v: 'closed' });
    /* give phones that are between two requests a moment to collect the 'finished' message */
    if (this.players.size) await new Promise(r => setTimeout(r, 1500));
    this.players.forEach(pl => this.flush(pl));
    const s = this.server; this.server = null;
    await new Promise(r => { s.close(() => r()); s.closeAllConnections && s.closeAllConnections(); setTimeout(r, 500); });
  }

  /* ---------- HTTP ---------- */
  handle(req, res) {
    const url = new URL(req.url, 'http://x');
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    if (req.method === 'GET' && (url.pathname === '/' || url.pathname === '/index.html')) {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Content-Security-Policy': "default-src 'self'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; img-src 'self' data:" });
      return res.end(this.html.split('__TITLE__').join(escapeHtml(this.title)));
    }
    if (req.method === 'GET' && url.pathname === '/poll') return this.poll(url, res);
    if (req.method === 'POST' && (url.pathname === '/join' || url.pathname === '/answer' || url.pathname === '/next')) return this.body(req, res, d => url.pathname === '/join' ? this.join(d, res, req) : url.pathname === '/next' ? this.next(d, res) : this.answer(d, res));
    res.writeHead(404, { 'Content-Type': 'text/plain' }); res.end('Not found');
  }
  body(req, res, fn) {
    let raw = '', big = false;
    req.on('data', c => { raw += c; if (raw.length > 4096) { big = true; req.destroy(); } });
    req.on('end', () => { if (big) return; let d; try { d = JSON.parse(raw || '{}'); } catch (e) { return json(res, 400, { error: 'Bad request' }); } fn(d); });
  }
  join(d, res, req) {
    /* the link can be public, so wrong PINs are limited: 15 tries per device per 10 minutes */
    const ip = clientIp(req), b = this.badPins.get(ip) || { n: 0, t: Date.now() }; if (Date.now() - b.t > 600000) { b.n = 0; b.t = Date.now(); }
    if (b.n >= 15) return json(res, 429, { error: 'Too many wrong PINs — wait a few minutes.' });
    if (String(d.pin || '').replace(/\D/g, '') !== this.pin) { b.n++; this.badPins.set(ip, b); return json(res, 403, { error: 'That game PIN is not right — check the board.' }); }
    const old = d.pid && this.players.get(String(d.pid));
    if (old) return json(res, 200, { pid: old.id, name: old.name });
    if (this.players.size >= MAX_PLAYERS) return json(res, 403, { error: 'The game is full.' });
    let name = String(d.name || '').replace(/[\u0000-\u001f<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, 24);
    if (!name) return json(res, 400, { error: 'Type your name first.' });
    const taken = new Set([...this.players.values()].map(p => p.name.toLowerCase()));
    if (taken.has(name.toLowerCase())) { let i = 2; while (taken.has((name + ' ' + i).toLowerCase())) i++; name = name + ' ' + i; }
    const id = crypto.randomBytes(9).toString('base64url');
    this.players.set(id, { id, name, score: 0, streak: 0, ans: {}, joined: Date.now(), ver: 0, view: null, waiters: [], waitSince: 0, seen: Date.now() });
    this.send(this.players.get(id), this.viewFor(this.players.get(id)));
    this.update();
    json(res, 200, { pid: id, name });
  }
  /* long-poll: answers at once if the phone is behind, otherwise holds the request until something changes (or 20 s pass) */
  poll(url, res) {
    const pl = this.players.get(url.searchParams.get('pid') || '');
    if (!pl) return json(res, 403, { error: 'gone' });
    pl.seen = Date.now();
    const v = +url.searchParams.get('v') || 0;
    if (v < pl.ver) return json(res, 200, { ver: pl.ver, data: pl.view });
    if (pl.waiters.length > 2) this.flush(pl);
    pl.waiters.push(res); pl.waitSince = Date.now();
    res.on('close', () => { pl.waiters = pl.waiters.filter(r => r !== res); this.update(); });
    this.update();
  }
  answer(d, res) {
    const pl = this.players.get(String(d.pid || ''));
    if (!pl) return json(res, 403, { error: 'Join the game first.' });
    if (this.phase === 'self') return this.selfAnswer(pl, d, res);
    if (this.phase !== 'question' || d.qi !== this.qi) return json(res, 409, { error: 'Too late — that question has closed.' });
    if (pl.ans[this.qi]) return json(res, 200, { ok: true });
    const q = this.qs[this.qi], c = Number(d.c);
    if (!Number.isInteger(c) || c < 0 || c >= q.o.length) return json(res, 400, { error: 'Bad answer' });
    pl.ans[this.qi] = { c, ms: Date.now() - this.t0 };
    json(res, 200, { ok: true });
    this.update();
    if ([...this.players.values()].every(p => p.ans[this.qi])) { clearTimeout(this.timer); this.timer = setTimeout(() => this.reveal(), 600); }
  }

  /* ---------- student-paced: everyone works through the questions at their own speed, with feedback after each one ---------- */
  selfStart(secs) { clearTimeout(this.timer); this.phase = 'self'; this.limit = Math.max(0, Math.min(600, secs | 0)); this.t0 = Date.now(); this.players.forEach(pl => { pl.qi = 0; pl.qt0 = Date.now(); pl.fb = null; }); this.broadcastViews(); this.update(); }
  selfAnswer(pl, d, res) {
    if (pl.qi == null) { pl.qi = 0; pl.qt0 = Date.now(); }
    if (d.qi !== pl.qi || pl.qi >= this.qs.length || pl.ans[pl.qi]) return json(res, 200, { ok: true });
    const q = this.qs[pl.qi], c = Number(d.c);
    if (!Number.isInteger(c) || c < -1 || c >= q.o.length) return json(res, 400, { error: 'Bad answer' });
    const ms = Date.now() - pl.qt0, lim = (this.limit || 30) * 1000, ok = c >= 0 && q.a >= 0 && c === q.a;
    pl.streak = ok ? pl.streak + 1 : (q.a < 0 ? pl.streak : 0);
    const pts = ok ? 500 + Math.round(500 * Math.max(0, 1 - ms / lim)) + Math.min(300, 100 * (pl.streak - 1)) : 0;
    pl.score += pts; pl.ans[pl.qi] = { c, ms, ok: q.a < 0 ? null : ok, pts }; pl.fb = { ok: q.a < 0 ? null : ok, pts, streak: pl.streak };
    this.rank(); json(res, 200, { ok: true }); this.send(pl, this.viewFor(pl)); this.update();
  }
  next(d, res) {
    const pl = this.players.get(String(d.pid || '')); if (!pl) return json(res, 403, { error: 'Join the game first.' });
    if (this.phase === 'self' && pl.qi < this.qs.length && pl.ans[pl.qi]) { pl.qi++; pl.qt0 = Date.now(); pl.fb = null; this.send(pl, this.viewFor(pl)); this.update(); }
    json(res, 200, { ok: true });
  }

  /* ---------- game flow (driven by the teacher) ---------- */
  question(qi, secs, pace) {
    if (!this.server || qi < 0 || qi >= this.qs.length) return;
    if (pace === 'student') return this.selfStart(secs);
    clearTimeout(this.timer);
    this.qi = qi; this.phase = 'question'; this.limit = Math.max(0, Math.min(600, secs | 0)); this.t0 = Date.now();
    if (this.limit) this.timer = setTimeout(() => this.reveal(), this.limit * 1000 + 400);
    this.broadcastViews(); this.update();
  }
  reveal() {
    if (this.phase !== 'question') return;
    clearTimeout(this.timer);
    const q = this.qs[this.qi], lim = (this.limit || 20) * 1000;
    this.players.forEach(pl => {
      const a = pl.ans[this.qi];
      if (!a) { pl.streak = 0; pl.last = { pts: 0, ok: false, none: true }; return; }
      if (q.a < 0) { pl.last = { pts: 0, ok: null }; return; }
      const ok = a.c === q.a;
      pl.streak = ok ? pl.streak + 1 : 0;
      const pts = ok ? 500 + Math.round(500 * Math.max(0, 1 - a.ms / lim)) + Math.min(300, 100 * (pl.streak - 1)) : 0;
      pl.score += pts; a.ok = ok; a.pts = pts; pl.last = { pts, ok, streak: pl.streak };
    });
    this.phase = 'reveal'; this.rank();
    this.broadcastViews(); this.update();
  }
  board() { if (this.phase === 'reveal') { this.phase = 'board'; this.broadcastViews(); this.update(); } }
  end() { clearTimeout(this.timer); this.phase = 'end'; this.rank(); this.broadcastViews(); this.update(); }
  rank() { const L = [...this.players.values()].sort((a, b) => b.score - a.score); L.forEach((p, i) => { p.prevRank = p.rankNow; p.rankNow = i + 1; }); }

  viewFor(pl) {
    const base = { title: this.title, name: pl.name, score: pl.score, total: this.qs.length };
    if (this.phase === 'lobby') return Object.assign(base, { v: 'lobby', players: this.players.size });
    if (this.phase === 'self') {
      if (pl.qi == null) { pl.qi = 0; pl.qt0 = Date.now(); }
      if (pl.qi >= this.qs.length) return Object.assign(base, { v: 'selfdone', rank: pl.rankNow, players: this.players.size, correct: Object.values(pl.ans).filter(a => a.ok).length });
      const q = this.qs[pl.qi];
      if (pl.fb) return Object.assign(base, { v: 'selfres', qi: pl.qi, q: q.q, o: q.o, a: q.a, ex: q.ex, mine: pl.ans[pl.qi] ? pl.ans[pl.qi].c : null, last: pl.fb, rank: pl.rankNow, players: this.players.size, isLast: pl.qi === this.qs.length - 1 });
      return Object.assign(base, { v: 'question', self: true, qi: pl.qi, q: q.q, o: q.o, limit: this.limit, left: this.limit ? Math.max(0, this.limit - (Date.now() - pl.qt0) / 1000) : 0, answered: null });
    }
    const q = this.qs[this.qi];
    if (this.phase === 'question') return Object.assign(base, { v: 'question', qi: this.qi, q: q.q, o: q.o, limit: this.limit, left: this.limit ? Math.max(0, this.limit - (Date.now() - this.t0) / 1000) : 0, answered: pl.ans[this.qi] ? pl.ans[this.qi].c : null });
    if (this.phase === 'reveal' || this.phase === 'board') return Object.assign(base, { v: 'reveal', qi: this.qi, q: q.q, o: q.o, a: q.a, ex: q.ex, mine: pl.ans[this.qi] ? pl.ans[this.qi].c : null, last: pl.last || null, rank: pl.rankNow, players: this.players.size });
    return Object.assign(base, { v: 'end', rank: pl.rankNow, players: this.players.size });
  }
  send(pl, data) { pl.ver++; pl.view = data; this.flush(pl); }
  flush(pl) { const w = pl.waiters; pl.waiters = []; w.forEach(res => { if (!res.writableEnded) json(res, 200, { ver: pl.ver, data: pl.view }); }); }
  broadcastViews() { this.players.forEach(pl => this.send(pl, this.viewFor(pl))); }
  broadcast(d) { this.players.forEach(pl => this.send(pl, d)); }

  /* what the teacher's board needs to draw */
  snapshot() {
    const q = this.qs[this.qi] || null, P = [...this.players.values()];
    const counts = q ? q.o.map((_, k) => P.filter(p => p.ans[this.qi] && p.ans[this.qi].c === k).length) : [];
    return {
      phase: this.phase, qi: this.qi, limit: this.limit, t0: this.t0, total: this.qs.length,
      tunnel: this.tunnel,
      players: P.map(p => ({ name: p.name, score: p.score, online: p.waiters.length > 0 || Date.now() - p.seen < 30000, answered: !!(q && p.ans[this.qi]), done: Object.keys(p.ans).length, correct: Object.values(p.ans).filter(a => a.ok).length, rank: p.rankNow || 0, prev: p.prevRank || 0, last: p.last || null })),
      answered: q ? P.filter(p => p.ans[this.qi]).length : 0, counts,
    };
  }
  results() {
    return { title: this.title, questions: this.qs.map(q => ({ q: q.q, o: q.o, a: q.a })), players: [...this.players.values()].sort((a, b) => b.score - a.score).map(p => ({ name: p.name, score: p.score, ans: this.qs.map((_, i) => p.ans[i] ? { c: p.ans[i].c, ok: p.ans[i].ok, ms: p.ans[i].ms } : null) })) };
  }
  update() { clearTimeout(this.upT); this.upT = setTimeout(() => this.onUpdate && this.onUpdate(this.snapshot()), 80); }
}

function clientIp(req) { return String(req.headers['cf-connecting-ip'] || (req.headers['x-forwarded-for'] || '').split(',')[0] || req.socket.remoteAddress || '').trim(); }
function json(res, code, obj) { res.writeHead(code, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(obj)); }
function escapeHtml(s) { return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]); }

module.exports = { LiveQuiz, lanAddresses };
