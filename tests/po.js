const {_electron,chromium}=require('playwright');const S=process.argv[2];const log=(...a)=>console.log(...a);
(async()=>{const app=await _electron.launch({executablePath:'/home/user/helixboard/desktop/node_modules/electron/dist/electron',args:['--no-sandbox','/home/user/helixboard/desktop'],env:Object.assign({},process.env,{HB_CLOUDFLARED:S+'/fake-cloudflared',HB_TUNNEL_PING_ORIGIN:'http://127.0.0.1:9555'})});
const w=await app.firstWindow();await w.waitForLoadState();await w.evaluate(()=>{localStorage['hb:askSession']='false'});await w.reload();await w.waitForLoadState();const errs=[];w.on('pageerror',e=>errs.push('T:'+e.message));
await w.waitForTimeout(2500);await w.evaluate(()=>HB.modal.close());
await w.evaluate(()=>HBE.add([{t:'shape',k:'ellipse',x:200,y:150,w:400,h:250,c:'#2b8a3e',fill:'#b2f2bb',w2:3}]));
await w.evaluate(()=>HBLC.open());await w.waitForTimeout(2000);
const sn=await w.evaluate(()=>helixDesktop.cl.cmd('snapshot'));const br=await chromium.launch();const P=[];
for(const n of ['Sara Ali','Omar Hassan','Lina Adel']){const c=await br.newContext({viewport:{width:390,height:800},isMobile:true,hasTouch:true});const p=await c.newPage();p.on('pageerror',e=>errs.push(n+':'+e.message));await p.goto('http://127.0.0.1:'+sn.port+'/?pin='+sn.pin);await p.fill('input[placeholder="Your full name"]',(n)+' Test');await p.click('.go');P.push(p);}
await w.waitForTimeout(1500);
// ORDER
await w.click('.lc-card[data-k="order"]');await w.waitForTimeout(300);await w.fill('#lcP','Order the stages of mitosis');await w.fill('#lcItems','Prophase\nMetaphase\nAnaphase\nTelophase');await w.click('#lcGo');await w.waitForTimeout(1500);
const want=['Prophase','Metaphase','Anaphase','Telophase'];
for(const [i,p] of P.entries()){ const txt=await p.$$eval('.ordit span',e=>e.map(x=>x.textContent)); if(i<2){for(let k=0;k<4;k++){let cur=await p.$$eval('.ordit span',e=>e.map(x=>x.textContent));let j=cur.indexOf(want[k]);while(j>k){await p.click('.ordit:nth-child('+(j+1)+') button:has-text("▲")');j--;}}} else {await p.click('.ordit:nth-child(1) button:has-text("▼")');}
  await p.click('button.go:has-text("Submit")');await p.waitForTimeout(300);}
await w.waitForTimeout(1200);log('order view:',(await w.textContent('#lcBody')).slice(0,250));
await w.click('#lcReveal2');await w.waitForTimeout(1200);log('phone after reveal:',(await P[0].textContent('#actRoot')).slice(0,150),'|',(await P[2].textContent('#actRoot')).slice(-60));
await w.screenshot({path:S+'/po_order.png'});await P[2].screenshot({path:S+'/po_order_phone.png'});
await w.click('#lcNew');await w.waitForTimeout(600);
// PIN
await w.click('.lc-card[data-k="pin"]');await w.waitForTimeout(300);await w.fill('#lcP','Tap the leaf');await w.click('#lcGo');await w.waitForTimeout(2000);
for(const [i,p] of P.entries()){const box=await p.$('.pad');const bb=await box.boundingBox();await p.mouse.click(bb.x+bb.width*(0.3+i*0.05),bb.y+bb.height*(0.4+i*0.03));await p.waitForTimeout(200);await p.click('button.go:has-text("Submit")');await p.waitForTimeout(300);}
await w.waitForTimeout(1200);log('pin info:',await w.textContent('#lcBody'));
await w.click('#lcMark');await w.waitForTimeout(300);const cv=await w.$('#lcBody canvas');const cb=await cv.boundingBox();await cv.click({position:{x:cb.width*0.32,y:cb.height*0.42}});await w.waitForTimeout(800);
log('after target:',await w.textContent('#lcBody'));await w.click('#lcReveal2');await w.waitForTimeout(1200);log('phone pin result:',(await P[0].textContent('#actRoot')).slice(-40));
await w.screenshot({path:S+'/po_pin.png'});await P[0].screenshot({path:S+'/po_pin_phone.png'});
await w.click('[data-pv="dots"]');await w.waitForTimeout(400);await w.screenshot({path:S+'/po_pin_dots.png'});
await w.click('#lcEnd');await w.waitForTimeout(800);
const rep=await w.evaluate(async()=>{const ix=await HB.IDB.get('reports:index');const s=await HB.IDB.get('report:'+ix[0].id);return s.activities.slice(-2).map(a=>a.type+':'+a.graded+':'+a.responses.map(r=>r.ok).join('/'))+' acc '+ix[0].accuracy});log('report:',rep);
log('errs',errs);await br.close();await app.close();})();
