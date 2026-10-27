(() => {
/* one setting makes the bottom tool bar, the full-screen panel and the slide bar bigger for smartboards: 100% → 125% → 150% → 175% */
const { set, toast, SND } = window.HB; const STEPS = [1, 1.25, 1.5, 1.75];
const st = document.createElement('style'); st.id = 'tbSizeCss'; document.head.appendChild(st);
function apply(z) { st.textContent = z === 1 ? '' : '#dock,#fsBar,#deckBar,#deckPill,#fsPill,#dockShow{zoom:' + z + '}'; }
let z = set.get('tbSize', 1); if (!STEPS.includes(z)) z = 1; apply(z);
function cycle() { z = STEPS[(STEPS.indexOf(z) + 1) % STEPS.length]; set.put('tbSize', z); apply(z); SND.pop && SND.pop(); toast('Tool buttons: ' + Math.round(z * 100) + '%'); }
window.HBTB = { cycle, set: v => { z = v; set.put('tbSize', v); apply(v); }, get size() { return z; } };
})();
