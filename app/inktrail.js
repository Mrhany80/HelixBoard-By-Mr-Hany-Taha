/* ================= HelixBoard — OS ink trail + ink latency meter =================
   Two things live here, both about how fast writing feels on a real smartboard.

   1. OS ink trail (the Ink API: navigator.ink).
      The board already takes pen samples the fast way: 'pointerrawupdate' with getCoalescedEvents()
      and getPredictedEvents() (input.js), painted on a 'desynchronized' canvas (engine.js). What is
      still left is the browser itself: every sample has to travel through the JavaScript event loop
      before any of it reaches the screen. The Ink API hands the *leading* piece of the stroke — the
      short tail between the last painted point and where the pen is right now — straight to the
      operating system's compositor, which draws it without waiting for JavaScript at all. This is
      the web form of the native Windows Ink path that desktop smartboard software rides on.
      The board keeps drawing the real stroke exactly as before; the trail only covers the gap.
      Chromium and Edge offer it today; where it is missing nothing changes and nothing breaks.

   2. Ink latency meter (Alt+L).
      tests/inkbench.js compares one build with another on a cloud machine with no graphics card. It
      cannot tell Mr Hany what the pen feels like on the panel in his classroom. This overlay measures
      that panel: pen samples per second, how long a sample waits for a frame, and how long a finished
      stroke takes to commit. Off by default and it costs nothing while it is off.
   ============================================================================== */
(() => {
'use strict';
const { $, set, bus, toast } = window.HB;
const E = window.HBE, INK = window.HB.ink;
const cv = E.cvLive;

/* ---------- 1. OS ink trail ---------- */

/* The trail is one flat colour at one width, so it is only offered for the pens that are already
   flat: pen, marker and highlighter. Chalk, pencil, glow, calligraphy and dashed all carry a texture,
   a shadow or a nib angle that a plain trail would not match, and a mismatched tail looks worse than
   no tail at all. */
const TRAIL_PENS = { pen: 1, marker: 1, hi: 1 };
const SUPPORTED = !!(navigator.ink && navigator.ink.requestPresenter);
let presenter = null, presenterAsked = false, presenterFailed = false;
const trailOn = () => SUPPORTED && !presenterFailed && set.get('inkTrail', true) !== false;

async function presenterFor() {
  if (presenter || presenterFailed) return presenter;
  if (presenterAsked) return null;                     /* a request is already in flight */
  presenterAsked = true;
  try { presenter = await navigator.ink.requestPresenter({ presentationArea: cv }); }
  catch (e) { presenterFailed = true; presenter = null; }
  return presenter;
}
if (SUPPORTED) presenterFor();                          /* warm it up so the first stroke is not the one that waits */

/* colour and width of the trail have to match what the board is about to paint, or the tail shows
   as a different line. Width is the stroke width in board units times the pen's own multiplier
   (HBE.PEN[].k), converted to screen pixels by the current zoom. */
function trailStyle(o) {
  const C = E.PEN[o.pen] || E.PEN.pen;
  const d = Math.max(1, o.w * (C.k || 1) * E.V.s);
  if (o.pen === 'hi') { const [r, g, b] = E.hexRgb(o.c); return { color: 'rgba(' + r + ',' + g + ',' + b + ',0.36)', diameter: d }; }
  return { color: o.c, diameter: d };
}

let live = null, style = null;                          /* the stroke being written, and its trail style */
bus.on('ink-start', o => {
  live = null; style = null;
  if (!o || o.t !== 'stroke' || !TRAIL_PENS[o.pen]) return;
  if (!trailOn()) return;
  live = o; style = trailStyle(o);
});
bus.on('ink-end', () => { live = null; style = null; });
/* zoom changes the trail width mid-stroke on a pinch, so the style is rebuilt when the view moves */
bus.on('view', () => { if (live) style = trailStyle(live); });

/* The point handed to the compositor must come from a trusted pointer event of the current frame.
   input.js registers its own 'pointerrawupdate' and 'pointermove' listeners first, so by the time
   these run the sample has already been added to the stroke and this only marks where the tail starts.
   Scripted events (tests/inkbench.js, tests/sweep.js) are not trusted and throw; one failure is
   enough to stop asking. */
function mark(e) {
  if (!live || !style || !presenter || !e.isTrusted) return;
  try { presenter.updateInkTrailStartPoint(e, style); }
  catch (err) { presenterFailed = true; presenter = null; }
}
cv.addEventListener('pointerrawupdate', mark);
cv.addEventListener('pointermove', mark);

/* ---------- 2. ink latency meter (Alt+L) ---------- */

let meterOn = false, box = null, raf = 0;
const S = { wait: [], frame: [], commit: [], samples: 0, since: 0, rate: 0, strokes: 0, lastFrame: 0 };
const pct = (a, q) => { if (!a.length) return 0; const s = a.slice().sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(s.length * q))]; };
const keep = (a, v) => { a.push(v); if (a.length > 240) a.shift(); };
const r1 = x => Math.round(x * 10) / 10;

/* how long a pen sample waited before a frame carried it to the screen: the honest input-to-paint
   number for this panel. Only measured while the meter is open, so it adds nothing when closed. */
function timeSample(e) {
  if (!meterOn || !e.isTrusted || !INK.down) return;
  S.samples++;
  const t = e.timeStamp;
  requestAnimationFrame(() => keep(S.wait, Math.max(0, performance.now() - t)));
}
cv.addEventListener('pointerrawupdate', timeSample);
cv.addEventListener('pointermove', timeSample);

let commitAt = 0;
bus.on('ink-end', () => { if (meterOn) commitAt = performance.now(); });
bus.on('stroke-added', () => { if (meterOn && commitAt) { keep(S.commit, performance.now() - commitAt); S.strokes++; commitAt = 0; } });

const LINES = () => [
  ['Pen samples', S.rate ? S.rate + '/s' : '—'],
  ['Sample → frame', S.wait.length ? r1(pct(S.wait, 0.5)) + ' / ' + r1(pct(S.wait, 0.95)) + ' ms' : '—'],
  ['Frame', S.frame.length ? r1(pct(S.frame, 0.5)) + ' / ' + r1(pct(S.frame, 0.95)) + ' ms' : '—'],
  ['Stroke commit', S.commit.length ? r1(pct(S.commit, 0.5)) + ' / ' + r1(pct(S.commit, 0.95)) + ' ms' : '—'],
  ['Strokes', String(S.strokes)],
  ['OS ink trail', !SUPPORTED ? 'not in this browser' : presenterFailed ? 'unavailable' : !trailOn() ? 'switched off' : presenter ? 'on' : 'starting…']
];

function tick(t) {
  if (!meterOn) return;
  if (S.lastFrame) keep(S.frame, t - S.lastFrame);
  S.lastFrame = t;
  if (t - S.since > 500) { S.rate = Math.round(S.samples * 1000 / (t - S.since)); S.samples = 0; S.since = t; }
  box.innerHTML = '<b>Ink latency <span>median / 95th</span></b>' +
    LINES().map(([k, v]) => '<i>' + k + '</i><u>' + v + '</u>').join('') +
    '<small>Write a few lines, then read the numbers. Alt+L closes this.</small>';
  raf = requestAnimationFrame(tick);
}

const CSS = '#inkmeter{position:fixed;right:14px;bottom:90px;z-index:70;min-width:230px;padding:12px 14px;border-radius:14px;' +
  'background:rgba(16,18,28,.92);color:#E9ECF5;font:12px/1.5 "JetBrains Mono",ui-monospace,monospace;' +
  'box-shadow:0 10px 30px rgba(0,0,0,.4);border:1px solid rgba(255,255,255,.14);pointer-events:none;display:grid;' +
  'grid-template-columns:auto auto;gap:2px 14px}' +
  '#inkmeter b{grid-column:1/3;display:flex;justify-content:space-between;align-items:baseline;margin-bottom:6px;' +
  'font:600 13px/1.3 inherit;letter-spacing:.02em}' +
  '#inkmeter b span{font-weight:400;font-size:10px;opacity:.6}' +
  '#inkmeter i{font-style:normal;opacity:.72}#inkmeter u{text-decoration:none;text-align:right;font-weight:600}' +
  '#inkmeter small{grid-column:1/3;margin-top:7px;font-size:10px;opacity:.55;line-height:1.4}';

function meter(on) {
  const want = on == null ? !meterOn : !!on;
  if (want === meterOn) return meterOn;
  meterOn = want;
  if (meterOn) {
    if (!$('#inkmeterCSS')) { const s = document.createElement('style'); s.id = 'inkmeterCSS'; s.textContent = CSS; document.head.appendChild(s); }
    box = document.createElement('div'); box.id = 'inkmeter'; document.body.appendChild(box);
    S.wait.length = S.frame.length = S.commit.length = 0; S.samples = 0; S.strokes = 0; S.since = performance.now(); S.lastFrame = 0; S.rate = 0;
    raf = requestAnimationFrame(tick);
  } else {
    cancelAnimationFrame(raf); if (box) box.remove(); box = null;
  }
  return meterOn;
}

window.addEventListener('keydown', e => {
  if (!e.altKey || e.ctrlKey || e.metaKey || (e.key !== 'l' && e.key !== 'L')) return;
  const tg = e.target.tagName;
  if (tg === 'TEXTAREA' || tg === 'INPUT' || tg === 'SELECT' || e.target.isContentEditable) return;
  e.preventDefault();
  toast(meter() ? 'Ink latency meter on: write a few lines and watch the numbers.' : 'Ink latency meter off.');
});

/* ---------- switch, for Board → Input ---------- */
function toggleTrail() {
  const on = !(set.get('inkTrail', true) !== false);
  set.put('inkTrail', on);
  if (on && !presenter && !presenterFailed) { presenterAsked = false; presenterFor(); }
  return on;
}

window.HBTrail = { get supported() { return SUPPORTED; }, get active() { return trailOn() && !!presenter; },
  get on() { return set.get('inkTrail', true) !== false; }, toggleTrail, meter, stats: () => JSON.parse(JSON.stringify({ wait: pct(S.wait, 0.95), frame: pct(S.frame, 0.95), commit: pct(S.commit, 0.95), strokes: S.strokes })) };
})();
