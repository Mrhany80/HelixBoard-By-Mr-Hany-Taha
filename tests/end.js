const {_electron,chromium}=require('playwright');const S=process.argv[2];const log=(...a)=>console.log(...a);
(async()=>{const app=await _electron.launch({executablePath:'/home/user/helixboard/desktop/node_modules/electron/dist/electron',args:['--no-sandbox','/home/user/helixboard/desktop'],env:Object.assign({},process.env,{HB_CLOUDFLARED:S+'/fake-cloudflared',HB_TUNNEL_PING_ORIGIN:'http://127.0.0.1:9555'})});
const w=await app.firstWindow();await w.waitForLoadState();await w.evaluate(()=>{localStorage['hb:accSkip']='true';localStorage['hb:askSession']='false';localStorage['hb:introEvery']='false';localStorage['hb:seenIntro']='true'});await w.reload();const errs=[];w.on('pageerror',e=>errs.push('T:'+e.message));w.on('console',m=>{if(m.type()==='error')errs.push('TC:'+m.text())});
await w.waitForTimeout(2500);await w.evaluate(()=>HB.modal.close());
// turn board sharing OFF in settings to test lock-with-board
await w.evaluate(()=>localStorage['hb:clBoard']='false');
await w.evaluate(()=>HBLC.open());await w.waitForTimeout(2000);
const sn=await w.evaluate(()=>helixDesktop.cl.cmd('snapshot'));log('boardOn at start',sn.boardOn);
const br=await chromium.launch();const c=await br.newContext({viewport:{width:390,height:800},isMobile:true});const p=await c.newPage();p.on('pageerror',e=>errs.push('P:'+e.message));await p.goto('http://127.0.0.1:'+sn.port+'/?pin='+sn.pin);await p.fill('input[placeholder="Your full name"]',('Sara')+' Test');await p.click('.go');
const c2=await br.newContext({viewport:{width:390,height:800},isMobile:true});const p2=await c2.newPage();await p2.goto('http://127.0.0.1:'+sn.port+'/?pin='+sn.pin);await p2.fill('input[placeholder="Your full name"]',('Omar')+' Test');await p2.click('.go');await w.waitForTimeout(1500);
await w.click('#lcLock');await w.waitForTimeout(2500);
log('locked phone: overlay',await p.evaluate(()=>getComputedStyle(lockv).display),'board img shown',await p.evaluate(()=>!locki.hidden&&locki.naturalWidth>0),'text',await p.textContent('#lockp'));
await p.screenshot({path:S+'/lock_board.png'});
await w.click('#lcLock');await w.waitForTimeout(1200);log('unlocked; boardOn restored:',(await w.evaluate(()=>helixDesktop.cl.cmd('snapshot'))).boardOn);
// chip with lock only
await w.click('#lcLock');await w.waitForTimeout(600);await w.click('#lcHide');await w.waitForTimeout(400);
log('chip (lock only):',await w.evaluate(()=>{const c=document.getElementById('lcChip');return c&&{t:c.textContent,h:c.offsetHeight,w:c.offsetWidth}}));
await w.click('#lcChip button[data-k="lock"]');await w.waitForTimeout(800);log('chip after unlock (no activity):',await w.evaluate(()=>!!document.getElementById('lcChip')),'phone overlay',await p.evaluate(()=>getComputedStyle(lockv).display));
// start activity, hide, chip
await w.evaluate(()=>HBLC.open('poll'));await w.waitForTimeout(500);await w.fill('#lcP','Q?');await w.click('[data-pre="abcd"]');await w.click('#lcGo');await w.waitForTimeout(800);await w.click('#lcHide');await w.waitForTimeout(400);
log('chip:',await w.evaluate(()=>{const c=document.getElementById('lcChip');return c&&{t:c.textContent,h:c.offsetHeight,w:c.offsetWidth,vis:getComputedStyle(c).display}}));
await w.screenshot({path:S+'/chip.png',clip:{x:300,y:40,width:700,height:60}});
await w.evaluate(()=>{const d=document.createElement('div');d.id='rpStage';document.body.appendChild(d)});log('chip display with reports open:',await w.evaluate(()=>getComputedStyle(lcChip).display));await w.evaluate(()=>rpStage.remove());
await w.evaluate(()=>document.body.classList.add('deckshow'));log('chip display in slideshow:',await w.evaluate(()=>getComputedStyle(lcChip).display));await w.evaluate(()=>document.body.classList.remove('deckshow'));
await w.click('#lcChip button[data-k="min"]');await w.waitForTimeout(200);log('min chip width',await w.evaluate(()=>lcChip.offsetWidth));await w.click('#lcChip');await w.waitForTimeout(200);log('expanded width',await w.evaluate(()=>lcChip.offsetWidth));
// reactions
await p.click('#reactB');await p.click('#tray button:nth-child(1)');await p2.click('#reactB');await p2.click('#tray button:nth-child(2)');await w.waitForTimeout(500);log('floating reactions:',await w.evaluate(()=>document.querySelectorAll('.lc-react').length));
await w.screenshot({path:S+'/react.png'});
await p.click('#tray button:nth-child(3)');await w.waitForTimeout(200);
// pick
await w.evaluate(()=>HBLC.pick());await w.waitForTimeout(3500);log('picked:',await w.textContent('#pkName'),'buttons visible',await w.evaluate(()=>!document.querySelector('#lcPick .pk-btns').hidden));await w.screenshot({path:S+'/pick.png'});
await w.click('#pkStar');await w.waitForTimeout(600);
// reactions off
await w.evaluate(()=>HBLC.open());await w.waitForTimeout(500);await w.click('#lcReact');await w.waitForTimeout(1500);log('phone react button hidden after off:',await p.evaluate(()=>reactB.hidden));
// answer then end session
await p.click('.opt');await p.click('text=Submit').catch(()=>{});await w.waitForTimeout(800);
await w.click('#lcEndS');await w.waitForTimeout(400);await w.click('#lcEndRep');await w.waitForTimeout(4000);
log('class link on:',await w.evaluate(()=>HBCL.on),'reports open:',await w.evaluate(()=>HBRP.on),'phone:',(await p.textContent('#app').catch(()=>p.textContent('body'))).slice(0,80));
await w.screenshot({path:S+'/end_rep.png'});
log('errs',errs);await br.close();await app.close();})();
