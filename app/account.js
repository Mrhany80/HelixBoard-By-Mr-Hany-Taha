/* ================= HelixBoard — accounts (Supabase): sign in with a username, usage and quiz results, admin page =================
   Everyone signs in with a username and password (students need no email). The board keeps working without an account or without internet:
   events wait in a queue and are sent when the connection is back. What is stored: name, username, role, school, grade, which tools are used,
   and quiz / flashcard / homework scores. Row-level security in the database lets people see only their own data; the admin sees everything. */
(() => {
'use strict';
const { $, $$, esc, icon, set, bus, toast, modal, SND, REDUCE } = window.HB;
const CFG = { url: 'https://ddmofmdaqvgtsceqfumh.supabase.co', key: 'sb_publishable_pjz6Af0luicBPQH2xmNu1g_eBilq9lE', domain: 'users.helixboard.app', version: '2.3.1' };
const snd = k => { try { SND[k] && SND[k](); } catch (e) {} };
const S = { sb: null, user: null, profile: null, queue: set.get('accQueue', []), flushing: false, tools: {}, lastAct: Date.now() };
const platform = () => window.helixDesktop ? 'windows-app' : /iPad|Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1 ? 'ipad' : /Android/.test(navigator.userAgent) ? 'android' : /iPhone/.test(navigator.userAgent) ? 'iphone' : 'browser';
const standalone = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone;
const emailOf = u => u.toLowerCase() + '@' + CFG.domain;
const cleanUser = u => String(u || '').trim().toLowerCase();
const okUser = u => /^[a-z0-9._-]{3,24}$/.test(u);

function client() { if (S.sb) return S.sb; if (!window.supabase || !window.supabase.createClient) return null;
  S.sb = window.supabase.createClient(CFG.url, CFG.key, { auth: { persistSession: true, autoRefreshToken: true, storageKey: 'hb-auth', detectSessionInUrl: false } }); return S.sb; }

/* ---------- start: restore the session, otherwise welcome screen (after the intro) ---------- */
async function boot() { const sb = client(); if (!sb) return;
  sb.auth.onAuthStateChange((ev, session) => { S.user = session ? session.user : null; if (ev === 'SIGNED_OUT') { S.profile = null; chip(); } });
  let session = null; try { session = (await sb.auth.getSession()).data.session; } catch (e) {}
  if (session) { S.user = session.user; await loadProfile(); chip(); started(); return; }
  chip(); if (!set.get('accSkip', false)) whenIntroDone(() => welcome()); }
function whenIntroDone(fn) { const i = document.getElementById('intro'); if (!i || i.hidden) return setTimeout(fn, 300); const t = setInterval(() => { if (i.hidden) { clearInterval(t); setTimeout(fn, 300); } }, 300); }
async function loadProfile() { try { const { data } = await client().from('profiles').select('*').eq('id', S.user.id).maybeSingle(); S.profile = data || null; } catch (e) {} return S.profile; }
function started() { log('open', { platform: platform(), standalone: !!standalone() }); touch(); flush(); }
async function touch() { if (!S.user) return; try { await client().rpc('touch', { p_platform: platform(), p_version: CFG.version }); } catch (e) {} }
setInterval(() => { if (S.user && Date.now() - S.lastAct < 5 * 60e3) { touch(); sendTools(); flush(); } }, 5 * 60e3);
['pointerdown', 'keydown'].forEach(ev => addEventListener(ev, () => { S.lastAct = Date.now(); }, { passive: true, capture: true }));
addEventListener('online', () => flush());

/* ---------- usage: events and results wait in a queue until they can be sent ---------- */
function log(kind, detail) { if (!S.user) return; S.queue.push({ t: 'a', kind, detail: detail || {}, at: new Date().toISOString() }); save(); flush(); }
function result(mode, setName, score, total, detail) { if (!S.user) return; S.queue.push({ t: 'q', mode, set_name: String(setName || '').slice(0, 120), score: Math.max(0, score | 0), total: Math.max(score | 0, total | 0), detail: detail || {}, at: new Date().toISOString() }); save(); flush(); }
const save = () => { S.queue = S.queue.slice(-500); set.put('accQueue', S.queue); };
async function flush() { const sb = client(); if (!sb || !S.user || S.flushing || !S.queue.length || !navigator.onLine) return; S.flushing = true;
  try { const batch = S.queue.slice(0, 50), acts = batch.filter(x => x.t === 'a').map(x => ({ user_id: S.user.id, kind: x.kind, detail: Object.assign({}, x.detail, { at: x.at }) })), res = batch.filter(x => x.t === 'q').map(x => ({ user_id: S.user.id, mode: x.mode, set_name: x.set_name, score: x.score, total: x.total, detail: Object.assign({}, x.detail, { at: x.at }) }));
    if (acts.length) { const r = await sb.from('activity').insert(acts); if (r.error) throw r.error; }
    if (res.length) { const r = await sb.from('quiz_results').insert(res); if (r.error) throw r.error; }
    S.queue = S.queue.slice(batch.length); save(); } catch (e) { console.warn('HelixBoard sync later:', e && e.message); } finally { S.flushing = false; } if (S.queue.length && S.user) setTimeout(flush, 2000); }
/* which tools are used: counted on this device, sent every few minutes as one event */
document.addEventListener('click', e => { const b = e.target.closest && e.target.closest('#toolrow [data-id], #dock [data-id]'); if (b) S.tools[b.dataset.id] = (S.tools[b.dataset.id] || 0) + 1; }, true);
function sendTools() { const t = S.tools; if (!Object.keys(t).length) return; S.tools = {}; log('tools', t); }
addEventListener('pagehide', () => { sendTools(); save(); });

/* ---------- the welcome screen: sign in or create an account ---------- */
const CSS = `#accOv{position:fixed;inset:0;z-index:58;background:radial-gradient(1100px 600px at 50% -10%,color-mix(in srgb,var(--accent) 18%,var(--bg)),var(--bg));display:flex;align-items:center;justify-content:center;padding:16px;overflow:auto}
#accOv .box{width:min(460px,100%);background:var(--panel);border:1px solid var(--line);border-radius:22px;box-shadow:var(--shadow);padding:22px 22px 18px}
#accOv h1{font:800 26px var(--head);margin:6px 0 2px;text-align:center}#accOv .sub{text-align:center;color:var(--muted);margin-bottom:14px;font-size:14px}
#accOv .tabs{display:flex;gap:6px;margin-bottom:12px}#accOv .tabs button{flex:1;height:40px;border-radius:12px;border:1px solid var(--line);background:var(--panel2);color:var(--ink);font:700 14px var(--head);cursor:pointer}
#accOv .tabs button.on{background:var(--accent);border-color:var(--accent);color:var(--accent-ink)}
#accOv label{display:block;font-size:13px;color:var(--muted);margin:8px 0 3px}#accOv input,#accOv select{width:100%;height:44px;border-radius:12px;border:2px solid var(--line);background:var(--panel2);color:var(--ink);font:600 16px var(--head);padding:0 12px}
#accOv input:focus,#accOv select:focus{outline:none;border-color:var(--accent)}#accOv .go{width:100%;height:48px;margin-top:14px;border:0;border-radius:14px;background:var(--accent);color:var(--accent-ink);font:800 17px var(--head);cursor:pointer}
#accOv .go:disabled{opacity:.55}#accOv .err{color:var(--bad);min-height:20px;font-size:13.5px;margin-top:8px}#accOv .hint{font-size:12px;color:var(--muted);margin-top:4px}
#accOv .role{display:grid;grid-template-columns:1fr 1fr;gap:8px}#accOv .role button{height:58px;border-radius:14px;border:2px solid var(--line);background:var(--panel2);color:var(--ink);font:700 15px var(--head);cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px}
#accOv .role button.on{border-color:var(--accent);background:color-mix(in srgb,var(--accent) 14%,var(--panel2))}
#accOv .skip{display:block;margin:14px auto 0;background:none;border:0;color:var(--muted);text-decoration:underline;cursor:pointer;font-size:13.5px}
#accOv .privacy{font-size:12px;color:var(--muted);margin-top:10px;line-height:1.45}#accOv .ok{color:var(--ok)}
#aAcct{min-width:auto;padding:0 10px 0 6px;gap:6px;display:inline-flex;align-items:center}#aAcct i{width:26px;height:26px;border-radius:50%;display:grid;place-items:center;font:800 12px var(--head);font-style:normal;background:var(--accent);color:var(--accent-ink)}
#aAcct span{font:700 12.5px var(--head);max-width:110px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
@media (max-width:900px){#aAcct span{display:none}}
.adm table{border-collapse:collapse;width:100%;font-size:14px}.adm th{position:sticky;top:0;background:var(--panel);text-align:left;padding:8px;cursor:pointer;white-space:nowrap;font:700 12.5px var(--head);color:var(--muted)}
.adm td{padding:8px;border-top:1px solid var(--line);white-space:nowrap}.adm tr.u:hover td{background:var(--panel2);cursor:pointer}.adm .wrap{max-height:56vh;overflow:auto;border:1px solid var(--line);border-radius:14px;max-width:1300px;width:100%;margin:0 auto}
.adm .bars div{display:flex;align-items:center;gap:10px;margin:4px 0;font-size:13.5px}.adm .bars b{width:170px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-weight:600}.adm .bars i{display:block;height:12px;border-radius:6px;background:var(--cyan)}
.adm .tools{display:flex;gap:8px;flex-wrap:wrap;align-items:center;max-width:1300px;width:100%;margin:0 auto 10px}.adm .tools input,.adm .tools select{height:38px;border-radius:10px;border:1px solid var(--line);background:var(--panel2);color:var(--ink);padding:0 10px;font:600 14px var(--head)}`;
const st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);

function welcome(tab) { if (!client()) { toast('Accounts need the internet the first time.'); return; } closeWelcome();
  const ov = document.createElement('div'); ov.id = 'accOv'; document.body.appendChild(ov);
  let mode = tab || 'in', role = 'student';
  const draw = () => {
    ov.innerHTML = '<div class="box"><div style="text-align:center">' + logo() + '</div><h1>' + (mode === 'in' ? 'Welcome back' : 'Create your account') + '</h1><div class="sub">HelixBoard By Mr. Hany Taha</div>' +
      '<div class="tabs"><button data-m="in" class="' + (mode === 'in' ? 'on' : '') + '">Sign in</button><button data-m="up" class="' + (mode === 'up' ? 'on' : '') + '">Create account</button></div>' +
      (mode === 'in' ? '<label>Username</label><input id="aU" autocomplete="username" autocapitalize="none" spellcheck="false"><label>Password</label><input id="aP" type="password" autocomplete="current-password"><button class="go" id="aGo">Sign in</button><div class="err" id="aE"></div><div class="hint">Forgot your password? Ask your teacher or the HelixBoard admin to set a new one.</div>'
        : '<label>I am a</label><div class="role"><button data-r="student" class="' + (role === 'student' ? 'on' : '') + '">' + icon('graduation-cap') + 'Student</button><button data-r="teacher" class="' + (role === 'teacher' ? 'on' : '') + '">' + icon('presentation') + 'Teacher</button></div>' +
          '<label>Your name</label><input id="aN" maxlength="60" autocomplete="name" placeholder="' + (role === 'teacher' ? 'e.g. Mr. Ahmed Ali' : 'First and last name') + '">' +
          '<label>Username</label><input id="aU" maxlength="24" autocomplete="username" autocapitalize="none" spellcheck="false" placeholder="letters, numbers . _ -"><div class="hint" id="aUh">3–24 characters: a–z, 0–9, dot, dash or underscore.</div>' +
          '<label>Password</label><input id="aP" type="password" autocomplete="new-password" placeholder="at least 6 characters"><label>Password again</label><input id="aP2" type="password" autocomplete="new-password">' +
          '<label>School</label><input id="aS" maxlength="80" list="aSL" value="' + esc(set.get('accSchool', '')) + '"><datalist id="aSL"><option>Green Hills International School</option></datalist>' +
          (role === 'student' ? '<label>Grade / class</label><input id="aG" maxlength="30" placeholder="e.g. Grade 9 · 9B">' : '<label>Contact email (optional)</label><input id="aM" type="email" maxlength="120" autocomplete="email">') +
          '<button class="go" id="aGo">Create account</button><div class="err" id="aE"></div><div class="privacy">HelixBoard stores your name, username, school and ' + (role === 'student' ? 'grade' : 'contact email') + ', which tools you use and your quiz, flashcard and homework scores, so you can see your progress and the HelixBoard admin can see how the app is used. Students: use HelixBoard with your school’s permission.</div>') +
      '<button class="skip" id="aSkip">Continue without an account</button></div>';
    $$('[data-m]', ov).forEach(b => b.onclick = () => { mode = b.dataset.m; draw(); });
    $$('[data-r]', ov).forEach(b => b.onclick = () => { role = b.dataset.r; const keep = { n: ($('#aN', ov) || {}).value, u: ($('#aU', ov) || {}).value }; draw(); if (keep.n) $('#aN', ov).value = keep.n; if (keep.u) $('#aU', ov).value = keep.u; });
    $('#aSkip', ov).onclick = () => { set.put('accSkip', true); closeWelcome(); toast('You can sign in any time from the account button at the top.', 4000); };
    $('#aGo', ov).onclick = () => mode === 'in' ? signIn() : signUp(role);
    ov.querySelectorAll('input').forEach(i => i.onkeydown = e => { if (e.key === 'Enter') $('#aGo', ov).click(); e.stopPropagation(); });
    const u = $('#aU', ov); if (mode === 'up') { let t = 0; u.oninput = () => { clearTimeout(t); const v = cleanUser(u.value), h = $('#aUh', ov); if (!okUser(v)) { h.className = 'hint'; h.textContent = '3–24 characters: a–z, 0–9, dot, dash or underscore.'; return; } t = setTimeout(async () => { try { const { data } = await client().rpc('username_available', { p_username: v }); h.className = 'hint ' + (data ? 'ok' : ''); h.style.color = data ? '' : 'var(--bad)'; h.textContent = data ? '✓ “' + v + '” is free' : '“' + v + '” is taken — try another'; } catch (e) {} }, 400); }; }
    setTimeout(() => { const f = document.activeElement; if (f && f !== document.body && ov.contains(f) && /INPUT|TEXTAREA|SELECT/.test(f.tagName)) return; (mode === 'in' ? u : $('#aN', ov)).focus(); }, 60); };
  draw(); if (window.gsap && !REDUCE) gsap.from(ov.firstChild, { y: 20, opacity: 0, duration: 0.35 }); }
const closeWelcome = () => { const o = document.getElementById('accOv'); if (o) o.remove(); };
const logo = () => '<svg viewBox="0 0 256 256" width="64" height="64" aria-hidden="true"><rect x="8" y="8" width="240" height="240" rx="56" fill="#1C1220"/><g stroke-linecap="round" stroke-width="10"><line x1="98" y1="60" x2="158" y2="60" stroke="#FFC928"/><line x1="94" y1="128" x2="162" y2="128" stroke="#FFC928"/><line x1="98" y1="196" x2="158" y2="196" stroke="#FFC928"/></g><path d="M78 36c0 64 100 64 100 92s-100 28-100 92" fill="none" stroke="#FF5FA2" stroke-width="16" stroke-linecap="round"/><path d="M178 36c0 64-100 64-100 92s100 28 100 92" fill="none" stroke="#22D3EE" stroke-width="16" stroke-linecap="round"/></svg>';
const friendly = e => { const m = String((e && (e.message || e.error_description)) || e || ''); if (/Invalid login/i.test(m)) return 'That username and password do not match.'; if (/already registered|already exists|duplicate/i.test(m)) return 'That username is already taken.'; if (/rate limit|too many/i.test(m)) return 'Too many tries — wait a minute and try again.'; if (/Failed to fetch|NetworkError|network/i.test(m)) return 'No connection to the HelixBoard server — check the internet.'; if (/Email not confirmed/i.test(m)) return 'This account is not active yet — ask the admin.'; return m || 'Something went wrong — try again.'; };
async function signIn() { const ov = $('#accOv'), u = cleanUser($('#aU', ov).value), p = $('#aP', ov).value, err = $('#aE', ov), go = $('#aGo', ov);
  if (!okUser(u) || !p) { err.textContent = 'Type your username and password.'; return; }
  go.disabled = true; err.textContent = '';
  try { const { data, error } = await client().auth.signInWithPassword({ email: emailOf(u), password: p }); if (error) throw error; S.user = data.user; set.put('accEver', true); set.put('accSkip', false); await loadProfile(); closeWelcome(); chip(); started(); snd('chime'); toast('Welcome back, ' + esc((S.profile && S.profile.display_name) || u) + '!'); }
  catch (e) { err.textContent = friendly(e); go.disabled = false; } }
async function signUp(role) { const ov = $('#accOv'), v = id => ($('#' + id, ov) || { value: '' }).value.trim(), err = $('#aE', ov), go = $('#aGo', ov);
  const name = v('aN'), u = cleanUser(v('aU')), p = $('#aP', ov).value, p2 = $('#aP2', ov).value, school = v('aS'), grade = v('aG'), mail = v('aM');
  if (!name) return err.textContent = 'Type your name.'; if (!okUser(u)) return err.textContent = 'Choose a username of 3–24 characters (a–z, 0–9, dot, dash, underscore).';
  if (p.length < 6) return err.textContent = 'The password needs at least 6 characters.'; if (p !== p2) return err.textContent = 'The two passwords are different.'; if (!school) return err.textContent = 'Type your school.';
  go.disabled = true; err.textContent = '';
  try { const { data: free } = await client().rpc('username_available', { p_username: u }); if (free === false) throw new Error('already exists');
    const { data, error } = await client().auth.signUp({ email: emailOf(u), password: p, options: { data: { username: u, display_name: name, role, school, grade: role === 'student' ? grade : '', contact_email: role === 'teacher' ? mail : '', platform: platform(), app_version: CFG.version } } });
    if (error) throw error; if (!data.session) throw new Error('Email not confirmed');
    S.user = data.user; set.put('accEver', true); set.put('accSkip', false); set.put('accSchool', school); await loadProfile(); closeWelcome(); chip(); started(); snd('fanfare'); toast('Account created — welcome, ' + esc(name) + '!', 4000); }
  catch (e) { err.textContent = friendly(e); go.disabled = false; } }

/* ---------- the account button in the top bar ---------- */
function chip() { let b = document.getElementById('aAcct'); if (!b) { const top = document.getElementById('aUndo'); if (!top) return; b = document.createElement('button'); b.className = 'ib'; b.id = 'aAcct'; b.onclick = menu; top.parentNode.insertBefore(b, top); }
  const P = S.profile; if (P) { b.innerHTML = '<i>' + esc(initials(P.display_name)) + '</i><span>' + esc(P.display_name.split(' ')[0]) + '</span>'; b.title = P.display_name + ' · ' + P.role; } else { b.innerHTML = icon('users') + '<span>Sign in</span>'; b.title = 'Sign in or create an account'; } }
const initials = n => String(n || '?').split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join('');
function menu() { if (!S.user) return welcome('in'); const P = S.profile || {};
  modal.open('<h2>' + esc(P.display_name || 'My account') + '</h2><p class="muted" style="margin-top:-6px">@' + esc(P.username || '') + ' · ' + esc(P.role || '') + (P.school ? ' · ' + esc(P.school) : '') + (P.grade ? ' · ' + esc(P.grade) : '') + '</p>' +
    '<p class="small muted">' + (S.queue.length ? S.queue.length + ' item(s) waiting to sync — they are sent when the internet is available.' : '✓ Everything is synced.') + '</p>' +
    '<div class="foot" style="flex-wrap:wrap"><button class="btn" id="amEd">' + icon('pencil') + 'Edit my details</button>' + (P.role === 'admin' ? '<button class="btn primary" id="amAdm">' + icon('chart-line') + 'Admin page</button>' : '') + '<button class="btn" id="amOut">' + icon('x') + 'Sign out</button></div>', s => {
    $('#amOut', s).onclick = async () => { sendTools(); await flush(); try { await client().auth.signOut(); } catch (e) {} S.user = null; S.profile = null; set.put('accSkip', false); modal.close(); chip(); toast('Signed out.'); welcome('in'); };
    $('#amEd', s).onclick = editProfile; const a = $('#amAdm', s); if (a) a.onclick = () => { modal.close(); admin(); }; }); }
function editProfile() { const P = S.profile || {};
  modal.open('<h2>My details</h2><div class="st-ed"><label class="small">Name<input class="inp" id="epN" style="width:100%" maxlength="60" value="' + esc(P.display_name || '') + '"></label><label class="small">School<input class="inp" id="epS" style="width:100%" maxlength="80" value="' + esc(P.school || '') + '"></label>' + (P.role === 'student' ? '<label class="small">Grade / class<input class="inp" id="epG" style="width:100%" maxlength="30" value="' + esc(P.grade || '') + '"></label>' : '<label class="small">Contact email<input class="inp" id="epM" style="width:100%" maxlength="120" value="' + esc(P.contact_email || '') + '"></label>') + '</div><div class="foot"><button class="btn" data-close>Cancel</button><button class="btn primary" id="epGo">Save</button></div>', s => {
    $('#epGo', s).onclick = async () => { const up = { display_name: $('#epN', s).value.trim() || P.display_name, school: $('#epS', s).value.trim() || null }; if ($('#epG', s)) up.grade = $('#epG', s).value.trim() || null; if ($('#epM', s)) up.contact_email = $('#epM', s).value.trim() || null;
      const { error } = await client().from('profiles').update(up).eq('id', S.user.id); if (error) { toast(esc(friendly(error))); return; } await loadProfile(); chip(); modal.close(); toast('Saved.'); }; }); }

/* ---------- the admin page: every user, last active, school, usage and quiz results ---------- */
const ago = t => { if (!t) return '—'; const s = (Date.now() - new Date(t)) / 1000; return s < 90 ? 'just now' : s < 3600 ? Math.round(s / 60) + ' min ago' : s < 86400 ? Math.round(s / 3600) + ' h ago' : s < 86400 * 30 ? Math.round(s / 86400) + ' days ago' : new Date(t).toLocaleDateString(); };
const FEATURE = { open: 'App opened', tools: 'Tools used', quiz: 'Practice quiz', cards: 'Flashcards', focus: 'Focus timer', homework: 'Homework handed in', phone_quiz: 'Phone quiz hosted', class_link: 'Class link', record: 'Lesson recorded', import: 'File imported', export: 'Board exported', lesson_flow: 'Lesson flow', live_quiz: 'Live quiz' };
async function admin() { if (!S.profile || S.profile.role !== 'admin') { toast('The admin page is only for the HelixBoard admin.'); return; }
  const ov = document.createElement('div'); ov.id = 'stStage'; ov.className = 'adm'; ov.innerHTML = '<button class="btn sm st-x" id="adX">Close ✕</button><div class="st-q" style="margin-top:0">HelixBoard admin</div><div id="adB" class="muted" style="text-align:center">Loading…</div>'; document.body.appendChild(ov);
  const close = () => { ov.remove(); removeEventListener('keydown', key, true); }; const key = e => { if (e.key === 'Escape' && !modal.isOpen) { e.stopPropagation(); close(); } }; addEventListener('keydown', key, true); $('#adX', ov).onclick = close;
  const sb = client(); let users = [], usage = [];
  try { const a = await sb.rpc('admin_users'); if (a.error) throw a.error; users = a.data || []; const b = await sb.rpc('admin_usage', { p_days: 30 }); usage = b.data || []; } catch (e) { $('#adB', ov).textContent = friendly(e); return; }
  const st2 = { q: '', role: '', school: '', sort: 'last_active', dir: -1 }, day = 864e5, now = Date.now();
  const schools = [...new Set(users.map(u => u.school).filter(Boolean))].sort();
  const toolUse = {}; // which tool buttons are used most (from 'tools' events) — loaded on demand
  const draw = () => { const U = users.filter(u => (!st2.role || u.role === st2.role) && (!st2.school || u.school === st2.school) && (!st2.q || (u.display_name + ' ' + u.username + ' ' + (u.school || '') + ' ' + (u.grade || '')).toLowerCase().includes(st2.q))).sort((a, b) => { const x = a[st2.sort], y = b[st2.sort]; return (x == null) - (y == null) || (x > y ? 1 : x < y ? -1 : 0) * st2.dir; });
    const kpi = (n, l) => '<div><b>' + n + '</b>' + l + '</div>', active = d => users.filter(u => now - new Date(u.last_active) < d).length, maxU = Math.max(1, ...usage.map(x => +x.events));
    $('#adB', ov).outerHTML = '<div id="adB"><div class="st-kpi">' + kpi(users.length, 'accounts') + kpi(users.filter(u => u.role === 'teacher').length, 'teachers') + kpi(users.filter(u => u.role === 'student').length, 'students') + kpi(active(day), 'active today') + kpi(active(7 * day), 'active this week') + kpi(users.reduce((a, u) => a + +u.quizzes, 0), 'quiz results') + '</div>' +
      '<div class="st-row" style="max-width:1300px;margin:0 auto 12px;width:100%"><b>Most used — last 30 days</b><div class="bars">' + (usage.length ? usage.map(x => '<div><b>' + esc(FEATURE[x.kind] || x.kind) + '</b><i style="width:' + Math.max(2, x.events / maxU * 60) + '%"></i><span class="small muted">' + x.events + ' times · ' + x.people + ' people</span></div>').join('') : '<div class="muted small">No activity yet.</div>') + '</div></div>' +
      '<div class="tools"><input id="adQ" placeholder="Search name, username, school, grade…" style="flex:1;min-width:200px" value="' + esc(st2.q) + '"><select id="adR"><option value="">All roles</option>' + ['student', 'teacher', 'admin'].map(r => '<option' + (r === st2.role ? ' selected' : '') + '>' + r + '</option>').join('') + '</select><select id="adS"><option value="">All schools</option>' + schools.map(s => '<option' + (s === st2.school ? ' selected' : '') + '>' + esc(s) + '</option>').join('') + '</select><button class="btn sm" id="adCsv">' + icon('download') + 'Excel (.csv)</button><button class="btn sm" id="adRe">' + icon('refresh-cw') + 'Refresh</button><span class="small muted">' + U.length + ' shown</span></div>' +
      '<div class="wrap"><table><thead><tr>' + [['display_name', 'Name'], ['username', 'Username'], ['role', 'Role'], ['school', 'School'], ['grade', 'Grade'], ['last_active', 'Last active'], ['sessions', 'Sessions'], ['events_7d', 'Actions (7 days)'], ['quizzes', 'Quizzes'], ['avg_pct', 'Average'], ['platform', 'Device'], ['created_at', 'Joined']].map(([k, l]) => '<th data-k="' + k + '">' + l + (st2.sort === k ? (st2.dir > 0 ? ' ▲' : ' ▼') : '') + '</th>').join('') + '</tr></thead><tbody>' +
      U.map(u => '<tr class="u" data-id="' + u.id + '"><td><b>' + esc(u.display_name) + '</b></td><td class="mono small">@' + esc(u.username) + '</td><td><span class="st-tag' + (u.role === 'admin' ? ' bad' : u.role === 'teacher' ? ' ok' : '') + '">' + u.role + '</span></td><td>' + esc(u.school || '—') + '</td><td>' + esc(u.grade || '—') + '</td><td>' + ago(u.last_active) + '</td><td>' + u.sessions + '</td><td>' + u.events_7d + '</td><td>' + u.quizzes + '</td><td>' + (u.avg_pct == null ? '—' : u.avg_pct + '%') + '</td><td class="small">' + esc(u.platform || '—') + '</td><td class="small">' + new Date(u.created_at).toLocaleDateString() + '</td></tr>').join('') + '</tbody></table></div></div>';
    const q = $('#adQ', ov); q.oninput = () => { st2.q = q.value.toLowerCase(); const pos = q.selectionStart; draw(); const q2 = $('#adQ', ov); q2.focus(); q2.setSelectionRange(pos, pos); };
    $('#adR', ov).onchange = e => { st2.role = e.target.value; draw(); }; $('#adS', ov).onchange = e => { st2.school = e.target.value; draw(); };
    $$('th[data-k]', ov).forEach(th => th.onclick = () => { if (st2.sort === th.dataset.k) st2.dir *= -1; else { st2.sort = th.dataset.k; st2.dir = /name|username|role|school|grade|platform/.test(th.dataset.k) ? 1 : -1; } draw(); });
    $$('tr.u', ov).forEach(tr => tr.onclick = () => person(users.find(u => u.id === tr.dataset.id)));
    $('#adRe', ov).onclick = () => { close(); admin(); };
    $('#adCsv', ov).onclick = () => { const c = v => '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"'; const rows = [['Name', 'Username', 'Role', 'School', 'Grade', 'Contact email', 'Last active', 'Sessions', 'Actions (7 days)', 'Quizzes', 'Average %', 'Last quiz', 'Device', 'Version', 'Joined']].concat(U.map(u => [u.display_name, u.username, u.role, u.school, u.grade, u.contact_email, new Date(u.last_active).toLocaleString(), u.sessions, u.events_7d, u.quizzes, u.avg_pct, u.last_quiz ? new Date(u.last_quiz).toLocaleString() : '', u.platform, u.app_version, new Date(u.created_at).toLocaleString()]));
      const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob(['﻿' + rows.map(r => r.map(c).join(',')).join('\r\n')], { type: 'text/csv' })); a.download = 'HelixBoard users ' + new Date().toISOString().slice(0, 10) + '.csv'; document.body.appendChild(a); a.click(); setTimeout(() => a.remove(), 500); }; };
  /* one person: details, recent activity and quiz results; change role, set a new password */
  async function person(u) { if (!u) return;
    modal.open('<h2>' + esc(u.display_name) + '</h2><p class="muted" style="margin-top:-6px">@' + esc(u.username) + ' · ' + esc(u.school || 'no school') + (u.grade ? ' · ' + esc(u.grade) : '') + (u.contact_email ? ' · ' + esc(u.contact_email) : '') + '<br>Joined ' + new Date(u.created_at).toLocaleDateString() + ' · last active ' + ago(u.last_active) + ' · ' + esc(u.platform || '') + ' ' + esc(u.app_version || '') + '</p><div id="apB" class="small muted">Loading…</div>' +
      '<div class="row" style="gap:8px;flex-wrap:wrap;margin-top:12px;align-items:center"><label class="small">Role <select class="sel" id="apR" style="width:auto">' + ['student', 'teacher', 'admin'].map(r => '<option' + (r === u.role ? ' selected' : '') + '>' + r + '</option>').join('') + '</select></label><button class="btn sm" id="apPw">' + icon('lock') + 'Set a new password</button></div>', async s => {
      $('#apR', s).onchange = async e => { const r = e.target.value; if (u.id === S.user.id && r !== 'admin') { toast('You cannot remove your own admin role here.'); e.target.value = u.role; return; } const { error } = await sb.rpc('admin_set_role', { p_user: u.id, p_role: r }); if (error) { toast(esc(friendly(error))); return; } u.role = r; draw(); toast(esc(u.display_name) + ' is now ' + r + '.'); };
      $('#apPw', s).onclick = () => { const pw = Math.random().toString(36).slice(2, 6) + Math.floor(1000 + Math.random() * 9000); window.HB.ask('Give <b>' + esc(u.display_name) + '</b> the new password <b class="mono">' + pw + '</b>? Tell them to remember it.', 'Set password', async () => { const { error } = await sb.rpc('admin_set_password', { p_user: u.id, p_password: pw }); if (error) toast(esc(friendly(error))); else toast('New password for @' + esc(u.username) + ': <b class="mono">' + pw + '</b>', 12000); }); };
      const [acts, res] = await Promise.all([sb.from('activity').select('kind,detail,created_at').eq('user_id', u.id).order('created_at', { ascending: false }).limit(60), sb.from('quiz_results').select('mode,set_name,score,total,created_at').eq('user_id', u.id).order('created_at', { ascending: false }).limit(60)]);
      const box = $('#apB', s); if (!box) return;
      const R = res.data || [], A = (acts.data || []).filter(a => a.kind !== 'tools');
      box.outerHTML = '<div class="row" style="gap:14px;align-items:flex-start;flex-wrap:wrap"><div style="flex:1;min-width:260px"><b>Quiz results</b>' + (R.length ? '<div style="max-height:300px;overflow:auto">' + R.map(r => '<div class="st-stem" style="font-size:13px"><span>' + esc(r.set_name) + ' <span class="small muted">' + r.mode + ' · ' + ago(r.created_at) + '</span></span><b>' + r.score + '/' + r.total + '</b><em class="st-tag ' + (r.total && r.score / r.total >= 0.7 ? 'ok' : 'bad') + '" style="font-style:normal">' + (r.total ? Math.round(r.score / r.total * 100) : 0) + '%</em></div>').join('') + '</div>' : '<div class="small muted">None yet.</div>') + '</div>' +
        '<div style="flex:1;min-width:220px"><b>Recent activity</b>' + (A.length ? '<div style="max-height:300px;overflow:auto">' + A.map(a => '<div class="small" style="padding:4px 0;border-bottom:1px solid var(--line)">' + esc(FEATURE[a.kind] || a.kind) + ' <span class="muted">· ' + ago(a.created_at) + '</span></div>').join('') + '</div>' : '<div class="small muted">None yet.</div>') + '</div></div>'; }); }
  draw(); }

window.HBA = { boot, welcome, menu, admin, log, result, flush, get user() { return S.user; }, get profile() { return S.profile; }, get signedIn() { return !!S.user; }, get isAdmin() { return !!(S.profile && S.profile.role === 'admin'); } };
setTimeout(boot, 0);
})();
