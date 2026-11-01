const {_electron,chromium}=require('playwright');const S=process.argv[2];const fs=require('fs');const log=(...a)=>console.log(...a);
const drop=S+'/fake-drop.txt';try{fs.unlinkSync(drop)}catch(e){}
(async()=>{const app=await _electron.launch({executablePath:'/home/user/helixboard/desktop/node_modules/electron/dist/electron',args:['--no-sandbox','/home/user/helixboard/desktop'],env:Object.assign({},process.env,{HB_CLOUDFLARED:S+'/fake-cloudflared',HB_TUNNEL_PING_ORIGIN:'http://127.0.0.1:9555',FAKE_DROP:drop,FAKE_REG_DELAY:'4000'})});
const w=await app.firstWindow();await w.waitForLoadState();await w.evaluate(()=>{localStorage['hb:accSkip']='true';localStorage['hb:askSession']='false';localStorage['hb:introEvery']='false';localStorage['hb:seenIntro']='true';localStorage['hb:phoneNet']='true'});await w.reload();const errs=[];w.on('pageerror',e=>errs.push('T:'+e.message));
await w.waitForTimeout(2500);await w.evaluate(()=>HB.modal.close());
const t0=Date.now();await w.evaluate(()=>HBCL.start());const seen=[];let last='';
for(let i=0;i<40;i++){const sn=await w.evaluate(()=>helixDesktop.cl.cmd('snapshot'));const k=sn.tunnel.state+'|'+(sn.tunnel.msg||sn.tunnel.url||sn.tunnel.error||'')+(sn.tunnel.checked===undefined?'':'|checked='+sn.tunnel.checked);if(k!==last){seen.push(((Date.now()-t0)/1000).toFixed(1)+'s '+k);last=k;}if(sn.tunnel.state==='ready')break;await w.waitForTimeout(300);}
log('timeline:\n  '+seen.join('\n  '));
log('panel codes:',(await w.$$('#clB .jc')).length,'qr svgs:',(await w.$$('#clB .jq svg')).length);await w.screenshot({path:S+'/link_panel.png'});
await w.click('#clBig');await w.waitForTimeout(500);log('big screen codes:',(await w.$$('#clBigQr .jc')).length,'titles:',(await w.$$eval('#clBigQr .jt',e=>e.map(x=>x.textContent))).join(' + '));await w.screenshot({path:S+'/link_big.png'});
const sn=await w.evaluate(()=>helixDesktop.cl.cmd('snapshot'));const info=await w.evaluate(()=>HBCL.links());
const br=await chromium.launch();const mk=async(n,base)=>{const c=await br.newContext({viewport:{width:390,height:780},isMobile:true});const p=await c.newPage();p.on('pageerror',e=>errs.push(n+':'+e.message));await p.goto(base+'/?pin='+sn.pin);await p.fill('input[placeholder="Your full name"]',(n)+' Test');await p.click('.go');await p.waitForTimeout(800);return p;};
const viaNet=await mk('Sara','http://127.0.0.1:9555');const viaWifi=await mk('Omar','http://127.0.0.1:'+sn.port);
log('joined:',(await w.evaluate(()=>helixDesktop.cl.cmd('snapshot'))).players.map(p=>p.name).join(','));
// the fake tunnel drops 8 s after it opened: the app should reopen it with a new address and new QR code
const t1=Date.now();let st2=[];last='';for(let i=0;i<60;i++){const s2=await w.evaluate(()=>helixDesktop.cl.cmd('snapshot'));const k=s2.tunnel.state+'|'+(s2.tunnel.msg||s2.tunnel.url||s2.tunnel.error||'');if(k!==last){st2.push(((Date.now()-t1)/1000).toFixed(1)+'s '+k);last=k;}if(s2.tunnel.state==='ready'&&/quiz-2/.test(s2.tunnel.url))break;await w.waitForTimeout(400);}
log('after drop:\n  '+st2.join('\n  '));
log('big screen shows new link:',await w.evaluate(()=>[...document.querySelectorAll('#clBigQr .ju')].map(x=>x.textContent).join(' + ')));
await viaWifi.waitForTimeout(1500);log('wifi phone still fine:',await viaWifi.evaluate(()=>getComputedStyle(document.getElementById('off')).display),'net phone banner:',await viaNet.evaluate(()=>{const o=document.getElementById('off');return getComputedStyle(o).display+' '+o.textContent}));
await w.screenshot({path:S+'/link_big2.png'});await w.keyboard.press('Escape');
// Live class chip
await w.evaluate(()=>HBLC.open());await w.waitForTimeout(800);log('live chip:',await w.textContent('#lcJoin small'));
log('ERRORS',errs);await br.close();await app.close();})().catch(e=>{console.log('FAIL',e.message.split('\n').slice(0,4).join(' | '));process.exit(1)});
