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
  const wifi = n => /wi-?fi|wlan|wireless/i.test(n) ? 1 : 0;
  return out.sort((a, b) => (virt(a.name) - virt(b.name)) || (b.priv - a.priv) || (wifi(b.name) - wifi(a.name))).map(a => a.address);
}

class LiveQuiz {
  constructor(onUpdate) { this.onUpdate = onUpdate; this.server = null; this.on = false; this.attached = false; }

  /* attached: the quiz runs inside the class link (one QR code for the whole lesson); its pages live under /quiz/ there */
  async start(quiz, opts) {
    opts = opts || {};
    await this.stop();
    if (!quiz || !Array.isArray(quiz.questions) || !quiz.questions.length) throw new Error('This set has no questions.');
    this.title = String(quiz.title || 'Quiz').slice(0, 80);
    this.qs = quiz.questions.slice(0, 100).map(q => { const o = (q.o || []).slice(0, q.t === 'order' ? 8 : 6).map(x => String(x).slice(0, 200)), x = { q: String(q.q || '').slice(0, 600), o, a: Number.isInteger(q.a) ? q.a : -1, ex: String(q.ex || '').slice(0, 400) };
      /* "put in order": the options are written in the right order; every phone shows the same shuffle */
      if (q.t === 'order') { x.t = 'order'; x.a = -1; x.sh = shuffled(o.length); } return x; });
    /* game options (chosen in the lobby): mode classic | teams | boss, number of teams, power-ups, confidence */
    this.opts = { mode: 'classic', teams: 2, power: false, conf: false }; this.boss = null;
    this.pin = String(crypto.randomInt(100000, 1000000));
    this.badPins = new Map(); this.tunnel = { state: 'off' };
    this.players = new Map();
    this.phase = 'lobby'; this.qi = -1; this.limit = 0; this.t0 = 0; this.last = null;
    this.html = fs.readFileSync(PAGE, 'utf8'); this.lang = quiz.lang === 'ar' ? 'ar' : 'en';
    if (opts.attached) { this.attached = true; this.on = true; this.port = opts.port; this.ping = setInterval(() => this.players.forEach(pl => { if (pl.waiters.length && Date.now() - pl.waitSince > 20000) this.flush(pl); }), 5000); return { port: opts.port, pin: this.pin, attached: true, urls: [], local: '' }; }
    this.attached = false;
    this.server = http.createServer((req, res) => this.handle(req, res));
    this.server.on('clientError', (e, sock) => { try { sock.end('HTTP/1.1 400 Bad Request\r\n\r\n'); } catch (er) {} });
    let port = 0;
    for (const p of [8320, 8321, 8322, 8323, 8324, 0]) {
      try { await new Promise((ok, bad) => { this.server.once('error', bad); this.server.listen(p, '0.0.0.0', () => { this.server.off('error', bad); ok(); }); }); port = this.server.address().port; break; } catch (e) { if (p === 0) throw e; }
    }
    this.port = port; this.on = true;
    /* a waiting phone gets an empty answer every 20 s, so proxies and tunnels never drop the request */
    this.ping = setInterval(() => this.players.forEach(pl => { if (pl.waiters.length && Date.now() - pl.waitSince > 20000) this.flush(pl); }), 5000);
    const addrs = lanAddresses();
    return { port, pin: this.pin, urls: addrs.map(a => 'http://' + a + ':' + port + '/?pin=' + this.pin), local: 'http://localhost:' + port + '/?pin=' + this.pin };
  }

  async stop() {
    if (!this.on) return; this.on = false;
    clearInterval(this.ping); clearTimeout(this.timer);
    this.broadcast({ v: 'closed' });
    /* give phones that are between two requests a moment to collect the 'finished' message */
    if (this.players.size) await new Promise(r => setTimeout(r, 1500));
    this.players.forEach(pl => this.flush(pl));
    if (this.attached || !this.server) { this.attached = false; return; }
    const s = this.server; this.server = null;
    await new Promise(r => { s.close(() => r()); s.closeAllConnections && s.closeAllConnections(); setTimeout(r, 500); });
  }

  /* ---------- HTTP ---------- */
  handle(req, res) {
    const url = new URL(req.url, 'http://x');
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    /* health check for the internet link (the app checks the whole path before showing the QR code) */
    if (req.method === 'GET' && url.pathname === '/hb-ping') { res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }); return res.end(JSON.stringify({ app: 'helixboard', pin: this.pin.length })); }
    if (req.method === 'GET' && (url.pathname === '/' || url.pathname === '/index.html')) {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Content-Security-Policy': "default-src 'self'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; img-src 'self' data:" });
      return res.end(this.html.split('__TITLE__').join(escapeHtml(this.title)).split('__LANG__').join(this.lang || 'en'));
    }
    if (req.method === 'GET' && url.pathname === '/poll') return this.poll(url, res);
    if (req.method === 'POST' && (url.pathname === '/join' || url.pathname === '/answer' || url.pathname === '/next' || url.pathname === '/power')) return this.body(req, res, d => url.pathname === '/join' ? this.join(d, res, req) : url.pathname === '/next' ? this.next(d, res) : url.pathname === '/power' ? this.power(d, res) : this.answer(d, res));
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
    let name = String(d.name || '').replace(/[\u0000-\u001f<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, 40);
    if (!name) return json(res, 400, { error: 'Type your name first.' });
    if (String(name).split(' ').filter(w => w.replace(/[^\p{L}]/gu, '').length >= 2).length < 2) return json(res, 400, { error: 'Please write your full name — first name and last name.' });
    const taken = new Set([...this.players.values()].map(p => p.name.toLowerCase()));
    if (taken.has(name.toLowerCase())) { let i = 2; while (taken.has((name + ' ' + i).toLowerCase())) i++; name = name + ' ' + i; }
    const id = crypto.randomBytes(9).toString('base64url');
    this.players.set(id, { id, name, score: 0, streak: 0, ans: {}, joined: Date.now(), ver: 0, view: null, waiters: [], waitSince: 0, seen: Date.now(), team: this.smallestTeam(), pw: [], use: {} });
    if (this.boss) this.boss.max += this.bossPer(), this.boss.hp += this.bossPer();
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
    const q = this.qs[this.qi], c = this.choice(q, d.c);
    if (c == null || c === -1) return json(res, 400, { error: 'Bad answer' });
    pl.ans[this.qi] = { c, ms: Date.now() - this.t0, conf: this.confOf(d) };
    json(res, 200, { ok: true });
    this.update();
    if ([...this.players.values()].every(p => p.ans[this.qi])) { clearTimeout(this.timer); this.timer = setTimeout(() => this.reveal(), 600); }
  }

  /* ---------- student-paced: everyone works through the questions at their own speed, with feedback after each one ---------- */
  selfStart(secs) { clearTimeout(this.timer); this.bossStart(); this.phase = 'self'; this.limit = Math.max(0, Math.min(600, secs | 0)); this.t0 = Date.now(); this.players.forEach(pl => { pl.qi = 0; pl.qt0 = Date.now(); pl.fb = null; }); this.broadcastViews(); this.update(); }
  selfAnswer(pl, d, res) {
    if (pl.qi == null) { pl.qi = 0; pl.qt0 = Date.now(); }
    if (d.qi !== pl.qi || pl.qi >= this.qs.length || pl.ans[pl.qi]) return json(res, 200, { ok: true });
    const q = this.qs[pl.qi], c = this.choice(q, d.c);
    if (c == null) return json(res, 400, { error: 'Bad answer' });
    const a = pl.ans[pl.qi] = { c, ms: Date.now() - pl.qt0, conf: this.confOf(d) };
    pl.fb = this.score(pl, q, pl.qi, a, (this.limit || 30) * 1000);
    if (this.boss) this.bossHit(pl.fb.pts, false);
    this.rank(); json(res, 200, { ok: true }); this.send(pl, this.viewFor(pl)); this.update();
  }
  next(d, res) {
    const pl = this.players.get(String(d.pid || '')); if (!pl) return json(res, 403, { error: 'Join the game first.' });
    if (this.phase === 'self' && pl.qi < this.qs.length && pl.ans[pl.qi]) { pl.qi++; pl.qt0 = Date.now(); pl.fb = null; this.send(pl, this.viewFor(pl)); this.update(); }
    json(res, 200, { ok: true });
  }

  /* ---------- game flow (driven by the teacher) ---------- */
  question(qi, secs, pace) {
    if (!this.on || qi < 0 || qi >= this.qs.length) return;
    if (pace === 'student') return this.selfStart(secs);
    clearTimeout(this.timer); this.bossStart();
    this.qi = qi; this.phase = 'question'; this.limit = Math.max(0, Math.min(600, secs | 0)); this.t0 = Date.now();
    if (this.limit) this.timer = setTimeout(() => this.reveal(), this.limit * 1000 + 400);
    this.broadcastViews(); this.update();
  }
  reveal() {
    if (this.phase !== 'question') return;
    clearTimeout(this.timer);
    const q = this.qs[this.qi], lim = (this.limit || 20) * 1000; let dmg = 0;
    this.players.forEach(pl => {
      const a = pl.ans[this.qi];
      if (!a) { if (!(pl.use[this.qi] === 'shield')) pl.streak = 0; pl.last = { pts: 0, ok: false, none: true }; return; }
      pl.last = this.score(pl, q, this.qi, a, lim); dmg += pl.last.pts;
    });
    if (this.boss) this.bossHit(dmg, true);
    this.phase = 'reveal'; this.rank();
    this.broadcastViews(); this.update();
  }
  board() { if (this.phase === 'reveal') { this.phase = 'board'; this.broadcastViews(); this.update(); } }
  end() { clearTimeout(this.timer); this.phase = 'end'; this.rank(); this.broadcastViews(); this.update(); }
  /* ---------- scoring shared by teacher-led and student-paced games ---------- */
  scored(q) { return q.t === 'order' || q.a >= 0; }
  /* an answer: an option number, or for "put in order" the list of original item numbers in the student's order */
  choice(q, v) { if (q.t === 'order') { if (!Array.isArray(v) || v.length !== q.o.length) return null; const n = v.map(Number); return n.every(Number.isInteger) && new Set(n).size === n.length && n.every(k => k >= 0 && k < q.o.length) ? n : null; }
    const c = Number(v); return Number.isInteger(c) && c >= -1 && c < q.o.length ? c : null; }
  confOf(d) { return this.opts.conf && [0, 1, 2].includes(d.conf) ? d.conf : null; }
  isRight(q, c) { return q.t === 'order' ? Array.isArray(c) && c.every((k, i) => k === i) : c >= 0 && c === q.a; }
  score(pl, q, qi, a, lim) {
    if (!this.scored(q)) { a.ok = null; a.pts = 0; return { pts: 0, ok: null }; }
    const use = pl.use[qi], ok = a.c !== -1 && this.isRight(q, a.c);
    pl.streak = ok ? pl.streak + 1 : use === 'shield' ? pl.streak : 0;
    const ms = use === 'freeze' ? 0 : a.ms; let pts = ok ? 500 + Math.round(500 * Math.max(0, 1 - ms / lim)) + Math.min(300, 100 * (pl.streak - 1)) : 0;
    /* confidence: sure and right earns more, a guess earns less; sure but wrong costs a little */
    if (a.conf != null) pts = ok ? Math.round(pts * [0.75, 1, 1.25][a.conf]) : a.conf === 2 ? -150 : 0;
    if (ok && use === 'double') pts *= 2;
    pts = Math.max(-pl.score, pts); pl.score += pts; a.ok = ok; a.pts = pts;
    /* power-ups: every second answer in a row earns one (up to three kept) */
    let got = null; if (this.opts.power && ok && pl.streak % 2 === 0 && pl.pw.length < 3) { got = POWERS[Math.floor(Math.random() * POWERS.length)]; pl.pw.push(got); }
    return { pts, ok, streak: pl.streak, conf: a.conf, use: use || null, got }; }
  power(d, res) { const pl = this.players.get(String(d.pid || '')); if (!pl) return json(res, 403, { error: 'Join the game first.' });
    const self = this.phase === 'self', qi = self ? pl.qi : this.qi, q = this.qs[qi], k = String(d.k || '');
    if (!this.opts.power || !q || (!self && this.phase !== 'question') || d.qi !== qi || pl.ans[qi] || pl.use[qi]) return json(res, 409, { error: 'Not now.' });
    const i = pl.pw.indexOf(k); if (i < 0) return json(res, 400, { error: 'You do not have that power-up.' });
    let hide = null; if (k === 'fifty') { if (q.t === 'order' || q.a < 0 || q.o.length < 3) return json(res, 400, { error: '50/50 does not work on this question.' });
      const wrong = q.o.map((_, j) => j).filter(j => j !== q.a); hide = shuffledArr(wrong).slice(0, Math.min(2, q.o.length - 2)); }
    pl.pw.splice(i, 1); pl.use[qi] = k; if (hide) pl.hide = { qi, hide }; json(res, 200, { ok: true, hide }); this.send(pl, this.viewFor(pl)); this.update(); }

  /* ---------- lobby options; teams; the class boss ---------- */
  setOpts(o) { if (!o || this.phase !== 'lobby') return; const m = ['classic', 'teams', 'boss'].includes(o.mode) ? o.mode : this.opts.mode;
    this.opts = { mode: m, teams: Math.max(2, Math.min(4, +o.teams || this.opts.teams)), power: 'power' in o ? !!o.power : this.opts.power, conf: 'conf' in o ? !!o.conf : this.opts.conf };
    let i = 0; [...this.players.values()].sort((a, b) => a.joined - b.joined).forEach(pl => { pl.team = i++ % this.opts.teams; });
    this.broadcastViews(); this.update(); }
  smallestTeam() { const n = Array(this.opts ? this.opts.teams : 2).fill(0); this.players.forEach(p => { if (p.team < n.length) n[p.team]++; }); return n.indexOf(Math.min(...n)); }
  teamScores() { if (this.opts.mode !== 'teams') return null; return TEAMS.slice(0, this.opts.teams).map((t, k) => { const P = [...this.players.values()].filter(p => p.team === k);
    return { name: t.name, color: t.color, emoji: t.emoji, n: P.length, score: P.length ? Math.round(P.reduce((a, p) => a + p.score, 0) / P.length) : 0 }; }); }
  bossPer() { return Math.round(this.qs.filter(q => this.scored(q)).length * 560); }
  bossStart() { if (this.opts.mode !== 'boss' || this.boss) return; const max = Math.max(1000, this.bossPer() * Math.max(1, this.players.size)); this.boss = { max, hp: max, hit: 0, heal: 0, n: 0 }; }
  /* the class damages the boss with every point it scores; a question most of the class missed lets it heal */
  bossHit(dmg, teacherLed) { const b = this.boss; if (!b) return; b.n++; b.hit = Math.max(0, dmg); b.hp = Math.max(0, b.hp - b.hit); b.heal = 0;
    if (teacherLed) { const q = this.qs[this.qi], A = [...this.players.values()].map(p => p.ans[this.qi]).filter(Boolean); if (this.scored(q) && this.players.size && A.filter(a => a.ok).length / this.players.size < 0.5 && b.hp > 0) { b.heal = Math.round(b.max * 0.08); b.hp = Math.min(b.max, b.hp + b.heal); } } }
  rank() { const L = [...this.players.values()].sort((a, b) => b.score - a.score); L.forEach((p, i) => { p.prevRank = p.rankNow; p.rankNow = i + 1; }); }

  viewFor(pl) {
    const T = this.opts.mode === 'teams' ? TEAMS[pl.team] : null;
    const base = { title: this.title, name: pl.name, score: pl.score, total: this.qs.length, team: T ? { name: T.name, color: T.color, emoji: T.emoji } : null, pw: this.opts.power ? pl.pw.slice() : null, conf: this.opts.conf, mode: this.opts.mode,
      boss: this.boss ? { hp: this.boss.hp, max: this.boss.max } : null };
    const qv = (q, qi) => ({ qi, q: q.q, o: q.t === 'order' ? q.sh.map(k => q.o[k]) : q.o, oi: q.t === 'order' ? q.sh : null, t: q.t || null, used: pl.use[qi] || null, hide: pl.hide && pl.hide.qi === qi ? pl.hide.hide : null });
    const rv = (q, qi) => ({ a: q.a, order: q.t === 'order' ? q.o : null, mine: pl.ans[qi] ? pl.ans[qi].c : null });
    if (this.phase === 'lobby') return Object.assign(base, { v: 'lobby', players: this.players.size });
    if (this.phase === 'self') {
      if (pl.qi == null) { pl.qi = 0; pl.qt0 = Date.now(); }
      if (pl.qi >= this.qs.length) return Object.assign(base, { v: 'selfdone', rank: pl.rankNow, players: this.players.size, correct: Object.values(pl.ans).filter(a => a.ok).length });
      const q = this.qs[pl.qi];
      if (pl.fb) return Object.assign(base, qv(q, pl.qi), rv(q, pl.qi), { v: 'selfres', ex: q.ex, last: pl.fb, rank: pl.rankNow, players: this.players.size, isLast: pl.qi === this.qs.length - 1 });
      return Object.assign(base, qv(q, pl.qi), { v: 'question', self: true, limit: this.limit, left: this.limit ? Math.max(0, this.limit - (Date.now() - pl.qt0) / 1000) : 0, answered: null });
    }
    const q = this.qs[this.qi];
    if (this.phase === 'question') return Object.assign(base, qv(q, this.qi), { v: 'question', limit: this.limit, left: this.limit ? Math.max(0, this.limit - (Date.now() - this.t0) / 1000) : 0, answered: pl.ans[this.qi] ? pl.ans[this.qi].c : null });
    if (this.phase === 'reveal' || this.phase === 'board') return Object.assign(base, qv(q, this.qi), rv(q, this.qi), { v: 'reveal', ex: q.ex, last: pl.last || null, rank: pl.rankNow, players: this.players.size });
    const ts = this.teamScores(), tr = ts && T ? ts.slice().sort((a, b) => b.score - a.score).findIndex(t => t.name === T.name) + 1 : 0;
    return Object.assign(base, { v: 'end', rank: pl.rankNow, players: this.players.size, teamRank: tr, won: this.boss ? this.boss.hp <= 0 : null });
  }
  send(pl, data) { pl.ver++; pl.view = data; this.flush(pl); }
  flush(pl) { const w = pl.waiters; pl.waiters = []; w.forEach(res => { if (!res.writableEnded) json(res, 200, { ver: pl.ver, data: pl.view }); }); }
  broadcastViews() { this.players.forEach(pl => this.send(pl, this.viewFor(pl))); }
  broadcast(d) { this.players.forEach(pl => this.send(pl, d)); }

  /* what the teacher's board needs to draw */
  snapshot() {
    const q = this.qs[this.qi] || null, P = [...this.players.values()];
    const counts = !q ? [] : q.t === 'order' ? [P.filter(p => p.ans[this.qi] && this.isRight(q, p.ans[this.qi].c)).length, P.filter(p => p.ans[this.qi] && !this.isRight(q, p.ans[this.qi].c)).length] : q.o.map((_, k) => P.filter(p => p.ans[this.qi] && p.ans[this.qi].c === k).length);
    /* for "put in order": how many placed each item in its right position */
    const place = q && q.t === 'order' ? q.o.map((_, k) => P.filter(p => p.ans[this.qi] && p.ans[this.qi].c[k] === k).length) : null;
    const A = q ? P.map(p => [p, p.ans[this.qi]]).filter(x => x[1]) : [];
    const conf = this.opts.conf && q ? { sure: A.filter(x => x[1].conf === 2).length, think: A.filter(x => x[1].conf === 1).length, guess: A.filter(x => x[1].conf === 0).length,
      sureWrong: this.phase === 'question' ? [] : A.filter(x => x[1].conf === 2 && x[1].ok === false).map(x => x[0].name) } : null;
    return {
      phase: this.phase, qi: this.qi, limit: this.limit, t0: this.t0, total: this.qs.length,
      tunnel: this.tunnel,
      players: P.map(p => ({ name: p.name, score: p.score, team: p.team, pw: p.pw.length, online: p.waiters.length > 0 || Date.now() - p.seen < 30000, answered: !!(q && p.ans[this.qi]), done: Object.keys(p.ans).length, correct: Object.values(p.ans).filter(a => a.ok).length, rank: p.rankNow || 0, prev: p.prevRank || 0, last: p.last || null })),
      answered: q ? P.filter(p => p.ans[this.qi]).length : 0, counts, place, conf, order: q && q.t === 'order' ? q.sh : null, opts: this.opts, teams: this.teamScores(), boss: this.boss,
    };
  }
  results() {
    return { title: this.title, opts: this.opts, teams: this.teamScores(), boss: this.boss, questions: this.qs.map(q => ({ q: q.q, o: q.o, a: q.a, t: q.t || null })), players: [...this.players.values()].sort((a, b) => b.score - a.score).map(p => ({ name: p.name, score: p.score, team: this.opts.mode === 'teams' ? TEAMS[p.team].name : null, ans: this.qs.map((_, i) => p.ans[i] ? { c: p.ans[i].c, ok: p.ans[i].ok, ms: p.ans[i].ms, conf: p.ans[i].conf } : null) })) };
  }
  update() { clearTimeout(this.upT); this.upT = setTimeout(() => this.onUpdate && this.onUpdate(this.snapshot()), 80); }
}

const POWERS = ['double', 'fifty', 'freeze', 'shield'];
const TEAMS = [{ name: 'Red Cells', color: '#FF5F7E', emoji: '🔴' }, { name: 'Blue Neurons', color: '#3BA7FF', emoji: '🔵' }, { name: 'Green Leaves', color: '#4ADE80', emoji: '🟢' }, { name: 'Gold Enzymes', color: '#FFC928', emoji: '🟡' }];
function shuffledArr(a) { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = crypto.randomInt(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; }
function shuffled(n) { const id = [...Array(n).keys()]; for (let t = 0; t < 6; t++) { const s = shuffledArr(id); if (n < 2 || s.some((k, i) => k !== i)) return s; } return id.slice().reverse(); }
function clientIp(req) { return String(req.headers['cf-connecting-ip'] || (req.headers['x-forwarded-for'] || '').split(',')[0] || req.socket.remoteAddress || '').trim(); }
function json(res, code, obj) { res.writeHead(code, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(obj)); }
function escapeHtml(s) { return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]); }

module.exports = { LiveQuiz, lanAddresses };
