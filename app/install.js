/* ================= HelixBoard — install as an app on tablets and computers ================= */
(() => {
'use strict';
const { toast, modal, icon } = window.HB;
let deferred = null;
addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferred = e; });
addEventListener('appinstalled', () => { deferred = null; toast('HelixBoard is installed — open it from your home screen or apps.'); });
const standalone = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone;
const ipad = () => /iPad|iPhone/.test(navigator.userAgent) || (/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1);
async function install() {
  if (window.helixDesktop) { toast('You are already using the HelixBoard Windows app.'); return; }
  if (standalone()) { toast('HelixBoard is already installed as an app on this device.'); return; }
  if (deferred) { deferred.prompt(); const r = await deferred.userChoice.catch(() => null); deferred = null; if (r && r.outcome === 'accepted') toast('Installing HelixBoard…'); return; }
  if (location.protocol === 'file:') { modal.open('<h2>Install HelixBoard</h2><p>Open HelixBoard from its website to install it on a tablet. On Windows, use the HelixBoard Windows app.</p><div class="foot"><button class="btn primary" data-close>OK</button></div>'); return; }
  modal.open('<h2>Install HelixBoard as an app</h2>' + (ipad()
    ? '<p><b>iPad / iPhone (Safari):</b></p><ol><li>Tap the <b>Share</b> button (the square with an arrow ↑) at the top of Safari.</li><li>Choose <b>Add to Home Screen</b>, then <b>Add</b>.</li><li>Open HelixBoard from its new icon — it runs full screen and works offline.</li></ol>'
    : '<p><b>Android tablet (Chrome):</b></p><ol><li>Tap the <b>⋮</b> menu at the top right of Chrome.</li><li>Choose <b>Install app</b> (or <b>Add to Home screen</b>).</li><li>Open HelixBoard from its new icon — it runs full screen and works offline.</li></ol><p><b>Windows / Mac (Chrome or Edge):</b> click the install icon at the right end of the address bar.</p>') +
    '<p class="small muted">Updates arrive by themselves: when a new version is ready, HelixBoard offers “Update now”.</p><div class="foot"><button class="btn primary" data-close>OK</button></div>');
}
/* Windows app: asks GitHub for a newer release. Web app: asks the website for a newer version (the "Update now" bar appears if there is one). */
async function checkUpdates() {
  if (window.helixDesktop && helixDesktop.checkUpdates) { helixDesktop.checkUpdates(); toast('Checking for updates…'); return; }
  try { const r = navigator.serviceWorker && await navigator.serviceWorker.getRegistration(); if (!r) { toast('Updates arrive by themselves when HelixBoard is opened from its website.'); return; }
    await r.update(); setTimeout(() => { if (!r.waiting && !r.installing) toast('HelixBoard is up to date.'); }, 2500); }
  catch (e) { toast('Could not check for updates — are you online?'); } }
window.HBInstall = { install, checkUpdates, get installed() { return !!standalone(); } };
})();
