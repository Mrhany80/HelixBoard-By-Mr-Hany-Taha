/* HelixBoard Class link: one QR code and PIN for the whole lesson. Students' phones and tablets get
   - the teacher's board live (a picture refreshed as it changes) and, when the teacher allows it, a pen to write on it (group work),
   - shared files: lesson recordings and homework,
   - homework they can do on the phone, with results going straight to the teacher.
   - live activities like Nearpod and ClassPoint: Draw It (every student's drawing side by side, by name), polls, word clouds,
     short answers, photos and a collaborate board — plus stars, raised hands and questions.
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
    this.files = []; this.homework = new Map(); this.ver = 0; this.act = null; this.shared = null; this.lock = false; this.questions = []; this.tunnel = { state: 'off' }; this.closing = false;
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
    clearInterval(this.ping); clearTimeout(this.actTimer);
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

  /* ---------- live activities ---------- */
  setActivity(a) {
    const type = ACT_TYPES.includes(a && a.type) ? a.type : null; if (!type) return null;
    const options = type === 'poll' ? (Array.isArray(a.options) ? a.options : []).slice(0, 6).map(o => String(o || '').slice(0, 80)) : [];
    if (type === 'poll' && options.length < 2) return null;
    const secs = Math.max(0, Math.min(3600, +a.secs || 0));
    /* once: each student submits one final answer, which then locks (Nearpod/ClassPoint style); otherwise answers are live and can change.
       auto: when time is up (or the teacher closes answers), phones hand in unsent work by themselves during a short grace period */
    this.act = { id: crypto.randomBytes(5).toString('hex'), type, prompt: String(a.prompt || '').slice(0, 300), options, bg: a.bg ? Buffer.from(a.bg) : null, ar: Math.max(0.3, Math.min(4, +a.ar || 4 / 3)),
      open: true, endsAt: secs ? Date.now() + secs * 1000 : 0, anon: !!a.anon, once: a.once !== false, auto: a.auto !== false, closedAt: 0, responses: new Map(), started: Date.now() };
    this.shared = null; this.players.forEach(pl => { pl.working = 0; }); this.armTimer();
    this.changed(); return this.act.id;
  }
  armTimer() { clearTimeout(this.actTimer); const a = this.act; if (!a || !a.open || !a.endsAt) return;
    this.actTimer = setTimeout(() => { if (this.act === a && a.open) this.closeAnswers(); }, Math.max(0, a.endsAt - Date.now()) + 250); }
  closeAnswers() { const a = this.act; if (!a) return; a.open = false; a.closedAt = Date.now(); clearTimeout(this.actTimer); this.emit('act'); this.changed(); }
  actOptions(o) { const a = this.act; if (!a) return;
    if ('open' in o) { if (o.open) { a.open = true; a.closedAt = 0; a.endsAt = 0; clearTimeout(this.actTimer); } else if (a.open) { this.closeAnswers(); return; } }
    /* the teacher gives more time: from now if time had run out, otherwise on top of what is left */
    if ('extend' in o) { const s = Math.max(10, Math.min(1800, +o.extend || 60)) * 1000; a.endsAt = (a.open && a.endsAt ? Math.max(a.endsAt, Date.now()) : Date.now()) + s; a.open = true; a.closedAt = 0; this.armTimer(); }
    if ('anon' in o) a.anon = !!o.anon;
    if ('reveal' in o) a.reveal = Number.isInteger(o.reveal) ? o.reveal : null;
    this.changed(); }
  endActivity() { clearTimeout(this.actTimer); this.act = null; this.shared = null; this.changed(); }
  /* the teacher shows one student's answer on every phone (or stops showing it) */
  share(pid) { const a = this.act, r = a && pid ? a.responses.get(pid) : null; const pl = pid && this.players.get(pid);
    this.shared = r && pl ? { type: a.type, name: a.anon ? 'A classmate' : pl.name, value: r.value, ar: a.ar, bg: !!a.bg, actId: a.id } : null; this.changed(); }
  removeResponse(pid, idx) { const a = this.act, r = a && a.responses.get(pid); if (!r) return;
    if (a.type === 'notes' && Number.isInteger(idx)) { r.value.splice(idx, 1); if (!r.value.length) a.responses.delete(pid); } else a.responses.delete(pid);
    if (this.shared && this.shared.actId === a.id) this.shared = null; const pl = this.players.get(pid); if (pl) this.flush(pl); this.changed(); }
  award(pid, n) { const pl = this.players.get(pid); if (!pl) return; pl.stars = Math.max(0, (pl.stars || 0) + (Number.isInteger(n) ? n : 1)); this.changed(); }
  setLock(v) { this.lock = !!v; this.changed(); }
  lowerHand(pid) { if (pid) { const pl = this.players.get(pid); if (pl) pl.hand = 0; } else this.players.forEach(pl => { pl.hand = 0; }); this.changed(); }
  clearQuestions() { this.questions = []; this.emit('status'); }
  responses() { const a = this.act; if (!a) return null;
    return { id: a.id, type: a.type, prompt: a.prompt, options: a.options, open: a.open, endsAt: a.endsAt, anon: a.anon, once: a.once, auto: a.auto, reveal: a.reveal == null ? null : a.reveal, ar: a.ar, hasBg: !!a.bg,
      list: [...a.responses.entries()].map(([pid, r]) => { const pl = this.players.get(pid); return { pid, name: pl ? pl.name : '?', color: pl ? pl.color : '#888', value: r.value, at: r.at, n: r.n, late: !!r.late }; }) }; }

  /* ---------- HTTP ---------- */
  async handle(req, res) {
    const url = new URL(req.url, 'http://x');
    res.setHeader('Cache-Control', 'no-store'); res.setHeader('X-Content-Type-Options', 'nosniff');
    /* health check for the internet link (the app checks the whole path before showing the QR code) */
    if (req.method === 'GET' && url.pathname === '/hb-ping') { res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }); return res.end(JSON.stringify({ app: 'helixboard', pin: this.pin.length })); }
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
    if (req.method === 'GET' && url.pathname === '/actbg.jpg') { const a = this.act; if (!a || !a.bg) { res.writeHead(404); return res.end(); } res.writeHead(200, { 'Content-Type': 'image/jpeg', 'Content-Length': a.bg.length }); return res.end(a.bg); }
    if (req.method === 'POST' && url.pathname === '/answer') return this.body(req, res, d => this.answer(pl, d, res), 3 * 1024 * 1024);
    if (req.method === 'POST' && url.pathname === '/working') return this.working(pl, res);
    if (req.method === 'POST' && url.pathname === '/hand') return this.body(req, res, d => this.hand(pl, d, res), 4096);
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
    this.players.set(id, { id, name, color: COLORS[this.players.size % COLORS.length], waiters: [], waitSince: 0, seen: Date.now(), ver: 0, strokes: [], stars: 0, hand: 0, posts: [] });
    this.emit('players');
    json(res, 200, { pid: id, name, color: this.players.get(id).color });
  }
  state(pl) {
    return { v: this.server && !this.closing ? 'live' : 'closed', ver: this.ver, title: this.title, name: pl.name, color: pl.color,
      board: this.boardOn && this.board ? { ver: this.boardVer, ar: this.boardView ? this.boardView.ar : 1.6 } : null, draw: this.boardOn && this.drawOn,
      files: this.files.map(f => ({ id: f.id, name: f.name, kind: f.kind, size: f.size })),
      homework: [...this.homework.values()].map(h => ({ id: h.id, title: h.title, due: h.due, n: h.questions.length, done: !!(h.results && h.results[pl.id]) })),
      act: this.actState(pl), shared: this.shared, stars: pl.stars || 0, hand: !!pl.hand, lock: this.lock };
  }
  actState(pl) { const a = this.act; if (!a) return null; const r = a.responses.get(pl.id);
    return { id: a.id, type: a.type, prompt: a.prompt, options: a.options, open: a.open, left: a.endsAt ? Math.max(0, a.endsAt - Date.now()) : 0, bg: !!a.bg, ar: a.ar, once: a.once, auto: a.auto, grace: !a.open && a.auto && a.closedAt ? Math.max(0, 6000 - (Date.now() - a.closedAt)) : 0,
      reveal: a.type === 'poll' && a.reveal != null ? a.reveal : null, mine: r ? r.value : null }; }
  /* a student's answer to the live activity — checked by type, then passed to the teacher's screen */
  answer(pl, d, res) {
    const a = this.act; if (!a || String(d.id || '') !== a.id) return json(res, 409, { error: 'That activity has finished.' });
    const now = Date.now(), old = a.responses.get(pl.id);
    /* after the deadline only the automatic hand-in of unsent work is accepted, for a few seconds */
    const grace = !a.open && a.auto && d.auto && a.closedAt && now - a.closedAt < 6000 && !old;
    if (!a.open && !grace) return json(res, 403, { error: 'Time is up — answers are closed.' });
    if (a.once && old && a.type !== 'notes') return json(res, 409, { error: 'You have already submitted.', mine: old.value });
    pl.posts = pl.posts.filter(t => now - t < 10000); if (pl.posts.length >= 40) return json(res, 429, { error: 'Slow down a little.' }); pl.posts.push(now);
    const v = cleanAnswer(a, d.value, old); if (v === undefined) return json(res, 400, { error: 'That answer could not be read.' });
    /* collaborate board in submit-once mode: notes can be added, never edited or taken back */
    if (a.once && a.type === 'notes' && old && (v === null || old.value.some((n, i) => !v[i] || v[i].t !== n.t))) return json(res, 409, { error: 'Posted notes cannot be changed.', mine: old.value });
    if (a.once && v === null) return json(res, 400, { error: 'Your answer is empty.' });
    if (v === null) a.responses.delete(pl.id); else a.responses.set(pl.id, { value: v, at: now, n: old ? old.n + 1 : 1, late: !!(grace || d.auto) });
    pl.working = 0;
    if (this.shared && this.shared.actId === a.id && this.shared.name === pl.name && v) { this.shared.value = v; this.changed(); }
    this.emit('response', { actId: a.id, pid: pl.id, name: pl.name, color: pl.color, type: a.type, value: v, at: now, auto: !!(grace || d.auto) });
    json(res, 200, { ok: true, mine: v });
  }
  /* "working on it": a phone says so while a student draws or types, so the teacher sees who is busy and who has not started */
  working(pl, res) { const a = this.act; if (a && a.open && !a.responses.has(pl.id)) { const was = pl.working && Date.now() - pl.working < 15000; pl.working = Date.now(); if (!was) this.emit('working', { pid: pl.id }); } json(res, 200, { ok: true }); }
  hand(pl, d, res) {
    const q = String(d.q || '').replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, 200);
    if (q) { if (this.questions.filter(x => x.pid === pl.id && Date.now() - x.at < 60000).length >= 3) return json(res, 429, { error: 'Wait a minute before asking again.' }); this.questions.push({ pid: pl.id, name: pl.name, q, at: Date.now() }); if (this.questions.length > 200) this.questions.shift(); }
    else pl.hand = d.up ? Date.now() : 0;
    this.emit(q ? 'question' : 'hand', { name: pl.name, q }); this.changed();
    json(res, 200, { ok: true });
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

  snapshot() { return { pin: this.pin, port: this.port, tunnel: this.tunnel, boardOn: this.boardOn, drawOn: this.drawOn, files: this.files.map(f => ({ id: f.id, name: f.name, kind: f.kind, size: f.size })), homework: [...this.homework.keys()], players: [...this.players.values()].map(p => ({ pid: p.id, name: p.name, color: p.color, stars: p.stars || 0, hand: p.hand || 0, working: !!(p.working && Date.now() - p.working < 15000), online: p.waiters.length > 0 || Date.now() - p.seen < 30000 })),
    act: this.act ? { id: this.act.id, type: this.act.type, open: this.act.open, count: this.act.responses.size, endsAt: this.act.endsAt, once: this.act.once } : null, lock: this.lock, questions: this.questions.slice(-50) }; }
  emit(type, data) { this.onEvent && this.onEvent(type, data, this.snapshot()); }
  update() { this.emit('status'); }
}

/* ---------- answers are checked strictly: right shape, right size, nothing that could break the teacher's screen ---------- */
const ACT_TYPES = ['draw', 'poll', 'word', 'text', 'image', 'notes'];
const HEX = /^#[0-9a-f]{6}$/i;
const cleanText = (s, n) => String(s == null ? '' : s).replace(/[\u0000-\u0008\u000b-\u001f]/g, '').trim().slice(0, n);
function cleanAnswer(a, v, old) {
  if (v === null) return null;
  switch (a.type) {
    case 'poll': return Number.isInteger(v) && v >= 0 && v < a.options.length ? v : undefined;
    case 'text': { const t = cleanText(v, 500); return t || null; }
    case 'word': { const list = (Array.isArray(v) ? v : [v]).slice(0, 3).map(w => cleanText(w, 30).replace(/\s+/g, ' ')).filter(Boolean); return list.length ? list : null; }
    case 'image': return typeof v === 'string' && /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(v) && v.length < 2.8e6 ? v : undefined;
    case 'notes': { if (!Array.isArray(v)) return undefined; const list = v.slice(0, 6).map(n => ({ t: cleanText(n && n.t, 200), c: Math.max(0, Math.min(5, (n && n.c) | 0)) })).filter(n => n.t); return list.length ? list : null; }
    case 'draw': { if (!Array.isArray(v)) return undefined; let total = 0; const out = [];
      for (const s of v.slice(0, 400)) { if (!s || !Array.isArray(s.p)) continue; const pts = [];
        for (let i = 0; i + 1 < s.p.length && pts.length < 2400; i += 2) { const x = +s.p[i], y = +s.p[i + 1]; if (Number.isFinite(x) && Number.isFinite(y)) pts.push(Math.max(0, Math.min(1, x)), Math.max(0, Math.min(1, y))); }
        total += pts.length; if (total > 60000) break; if (pts.length) out.push({ c: HEX.test(s.c || '') ? s.c : '#111111', w: Math.max(0.5, Math.min(40, +s.w || 3)), e: s.e ? 1 : 0, p: pts.map(n => Math.round(n * 10000) / 10000) }); }
      return out.length ? out : null; }
  }
  return undefined;
}

/* phones never receive the answer key unless the teacher chose to show answers after submitting */
function studentCopy(hw) { return { id: hw.id, title: hw.title, due: hw.due, note: hw.note || '', questions: hw.questions.map(q => ({ q: q.q, o: q.o })) }; }
function clientIp(req) { return String(req.headers['cf-connecting-ip'] || (req.headers['x-forwarded-for'] || '').split(',')[0] || req.socket.remoteAddress || '').trim(); }
function json(res, code, obj) { res.writeHead(code, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(obj)); }
function escapeHtml(s) { return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]); }

module.exports = { ClassLink };
