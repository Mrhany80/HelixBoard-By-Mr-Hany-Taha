/* ================= HelixBoard — opening sequence (≈3 s, skippable) ================= */
(() => {
'use strict';
const { $, set, SND, REDUCE } = window.HB;
function helixSVG() { const W = 520, cy = 100, A = 52, x0 = 40, x1 = 480, turns = 2.25; const pt = (x, ph) => cy + A * Math.sin((x - x0) / (x1 - x0) * turns * 2 * Math.PI + ph);
  const strand = ph => { let d = ''; for (let x = x0; x <= x1; x += 4) d += (x === x0 ? 'M' : 'L') + x + ' ' + pt(x, ph).toFixed(1); return d; };
  const cols = ['#FF5FA2', '#22D3EE', '#FFC928', '#4ADE80']; let rungs = ''; let i = 0; for (let x = x0 + 14; x < x1 - 6; x += 22, i++) { const a = pt(x, 0), b = pt(x, Math.PI); if (Math.abs(a - b) < 14) continue; rungs += '<line class="rung" x1="' + x + '" y1="' + a.toFixed(1) + '" x2="' + x + '" y2="' + b.toFixed(1) + '" stroke="' + cols[i % 4] + '" stroke-width="5" stroke-linecap="round" opacity="0"/>'; }
  return '<svg viewBox="0 0 ' + W + ' 200" aria-hidden="true"><defs><filter id="ig" x="-20%" y="-50%" width="140%" height="200%"><feGaussianBlur stdDeviation="3" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs><g filter="url(#ig)">' + rungs + '<path id="isA" d="' + strand(0) + '" fill="none" stroke="#FF5FA2" stroke-width="7" stroke-linecap="round"/><path id="isB" d="' + strand(Math.PI) + '" fill="none" stroke="#22D3EE" stroke-width="7" stroke-linecap="round"/></g>' +
    '<g id="iPen" opacity="0"><g transform="rotate(35)"><rect x="-5" y="-64" width="10" height="50" rx="3" fill="#F6ECF4"/><rect x="-5" y="-70" width="10" height="9" rx="2" fill="#FF5FA2"/><path d="M-5 -14 L5 -14 L0 0 Z" fill="#E8C9A0"/><path d="M-1.6 -4.6 L1.6 -4.6 L0 0 Z" fill="#2A0E22"/></g></g></svg>'; }
let running = false;
function play(force) { const el = $('#intro'); if (!el || running) return; if (!force && set.get('seenIntro', false)) return; running = true;
  el.innerHTML = '<button class="btn sm skip" id="iSkip">Skip ›</button><div style="display:grid;justify-items:center;gap:4px">' + helixSVG() + '<div class="t1">HelixBoard</div><div class="t1b" style="font:800 clamp(22px,3.2vw,40px)/1.1 var(--head);color:#FF5FA2;letter-spacing:.01em;opacity:0">By Mr. Hany Taha</div><div class="t2">the Science Slate</div></div>'; el.hidden = false; el.style.opacity = 1;
  const A = $('#isA', el), Bs = $('#isB', el), pen = $('#iPen', el), la = A.getTotalLength(), lb = Bs.getTotalLength();
  [[A, la], [Bs, lb]].forEach(([p, l]) => { p.style.strokeDasharray = l; p.style.strokeDashoffset = l; });
  let done = false; const finish = () => { if (done) return; done = true; SND.writeStop(); set.put('seenIntro', true); document.removeEventListener('keydown', onKey, true); const end = () => { el.hidden = true; el.innerHTML = ''; running = false; }; if (window.gsap && !REDUCE) { gsap.killTweensOf(el); gsap.to(el, { opacity: 0, duration: 0.45, ease: 'power2.in', onComplete: end }); setTimeout(() => { if (running) end(); }, 900); } else end(); };
  /* whatever happens (a hidden window pauses animations), the titles never stay longer than 9 seconds */
  setTimeout(finish, 9000);
  const onKey = e => { e.preventDefault(); e.stopPropagation(); finish(); }; document.addEventListener('keydown', onKey, true); $('#iSkip', el).onclick = finish; el.onclick = e => { if (e.target === el) finish(); };
  if (!window.gsap || REDUCE) { [A, Bs].forEach(p => p.style.strokeDashoffset = 0); el.querySelectorAll('.rung').forEach(r => r.setAttribute('opacity', 1)); el.querySelector('.t1').style.opacity = 1; el.querySelector('.t1b').style.opacity = 1; el.querySelector('.t2').style.opacity = 1; setTimeout(finish, 1600); return; }
  [A, Bs].forEach(p => p.style.visibility = 'hidden');
  const run = () => { SND.startup(); [A, Bs].forEach(p => p.style.visibility = '');
  const tl = gsap.timeline({ onComplete: () => setTimeout(finish, 650) }); const st = { a: 0, b: 0 }; let last = null;
  const follow = (path, len, k) => { const p = path.getPointAtLength(len * k); pen.setAttribute('transform', 'translate(' + p.x + ' ' + p.y + ')'); if (last) { const sp = Math.hypot(p.x - last.x, p.y - last.y) / 6; void (Math.min(1.6, sp), Math.atan2(p.y - last.y, p.x - last.x)); } last = p; };
  tl.set(pen, { opacity: 1 })
    .to(st, { a: 1, duration: 1.0, ease: 'power1.inOut', onUpdate: () => { A.style.strokeDashoffset = la * (1 - st.a); follow(A, la, st.a); } })
    .add(() => { last = null; })
    .to(st, { b: 1, duration: 0.85, ease: 'power1.inOut', onUpdate: () => { Bs.style.strokeDashoffset = lb * (1 - st.b); follow(Bs, lb, st.b); } })
    .to(pen, { opacity: 0, y: -20, duration: 0.25 })
    .to(el.querySelectorAll('.rung'), { opacity: 1, duration: 0.2, stagger: 0.025 }, '<')
    .fromTo(el.querySelector('.t1'), { opacity: 0, y: 14, letterSpacing: '0.2em' }, { opacity: 1, y: 0, letterSpacing: '-0.01em', duration: 0.55, ease: 'power3.out' }, '-=0.25')
    .fromTo(el.querySelector('.t1b'), { opacity: 0, y: 10, scale: 0.94 }, { opacity: 1, y: 0, scale: 1, duration: 0.45, ease: 'back.out(2)' }, '-=0.2')
    .fromTo(el.querySelector('.t2'), { opacity: 0, y: 8 }, { opacity: 1, y: 0, duration: 0.4 }, '-=0.2'); };
  /* browsers only allow sound after a tap, so on first launch the intro waits for one */
  /* the Windows app may play sound without a tap, so it never needs the start button */
  if (window.helixDesktop) { try { SND.unlock(); } catch (e) {} run(); return; }
  if (SND.state === 'running' || set.get('seenIntro', false)) { run(); return; }
  const gate = document.createElement('button'); gate.className = 'igate'; gate.innerHTML = '<span>▶</span> Tap to start'; gate.style.cssText = 'position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);z-index:3;display:flex;align-items:center;gap:12px;padding:16px 34px;border-radius:999px;border:1px solid rgba(255,255,255,.25);background:rgba(255,95,162,.92);color:#24020F;font:800 22px var(--head);cursor:pointer;box-shadow:0 12px 40px rgba(255,95,162,.45)';
  el.appendChild(gate); if (window.gsap && !REDUCE) gsap.fromTo(gate, { scale: 0.96 }, { scale: 1.04, repeat: -1, yoyo: true, duration: 0.8, ease: 'sine.inOut' });
  gate.onclick = e => { e.stopPropagation(); SND.unlock(); gsap.killTweensOf(gate); gate.remove(); setTimeout(run, 60); }; }
window.HBIntro = { play };
})();

