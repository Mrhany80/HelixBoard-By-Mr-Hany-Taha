const {_electron,chromium}=require('playwright');const S=process.argv[2];const fs=require('fs');
const log=(...a)=>console.log(...a);
(async()=>{const app=await _electron.launch({executablePath:'/home/user/helixboard/desktop/node_modules/electron/dist/electron',args:['--no-sandbox','/home/user/helixboard/desktop'],env:Object.assign({},process.env,{HB_CLOUDFLARED:S+'/fake-cloudflared'})});
const w=await app.firstWindow();await w.waitForLoadState();await w.evaluate(()=>{localStorage['hb:accSkip']='true';localStorage['hb:askSession']='false';localStorage['hb:sub:study']='"all"';localStorage['hb:introEvery']='false';['draw','poll','word','text','image','notes'].forEach(k=>localStorage['hb:lcOnce:'+k]='false')});await w.reload();const errs=[];w.on('pageerror',e=>errs.push('T:'+e.message));w.on('console',m=>{if(m.type()==='error'&&!/ERR_|Failed to load/.test(m.text()))errs.push('T:'+m.text())});
await w.waitForTimeout(4000);await w.evaluate(()=>HB.modal.close());
// open from the Study tab
await w.evaluate(()=>{const b=document.querySelector('[data-id="lc_open"]');if(b&&b.offsetWidth)return;const t=document.querySelector('[data-st="study"]');t&&t.click();});await w.waitForTimeout(500);
await w.click('[data-id="lc_open"]');await w.waitForTimeout(2500);
log('stage open:',!!(await w.$('#lcStage')),'cards:',(await w.$$('#lcStage .lc-card')).length);
await w.screenshot({path:S+'/lc_launch.png'});
const sn=await w.evaluate(()=>helixDesktop.cl.cmd('snapshot'));const base='http://localhost:'+sn.port+'/?pin='+sn.pin;
const br=await chromium.launch();const ph=[];const names=['Sara','Omar','Lina','Yousef','Maryam','Adam'];
for(const n of names){const c=await br.newContext({viewport:{width:390,height:800},isMobile:true,hasTouch:true});const p=await c.newPage();p.on('pageerror',e=>errs.push(n+':'+e.message));await p.goto(base);await p.fill('input[placeholder="Your full name"]',(n)+' Test');await p.click('.go');ph.push(p);}
await w.waitForTimeout(1500);log('side students:',(await w.$$('#lcStage .lc-st')).length);
// ---- Draw it on grid paper
await w.click('.lc-card[data-k="draw"]');await w.waitForTimeout(400);await w.fill('#lcP','Draw and label a plant cell');await w.click('[data-bg="grid"]');await w.click('#lcGo');await w.waitForTimeout(1500);
log('phone tab:',await ph[0].evaluate(()=>document.querySelector('nav .on').textContent),'pad:',!!(await ph[0].$('.pad canvas')),'bg img:',!!(await ph[0].$('.pad img')));
for(let i=0;i<ph.length;i++){const p=ph[i];const b=await p.$('.pad canvas');const r=await b.boundingBox();await p.mouse.move(r.x+30+i*10,r.y+40);await p.mouse.down();for(let k=0;k<20;k++)await p.mouse.move(r.x+30+k*12,r.y+40+Math.sin(k/3)*30+i*15);await p.mouse.up();await p.waitForTimeout(80);
 if(i%2===0){await p.click('.sw[aria-label="#E03131"]');await p.mouse.move(r.x+60,r.y+150);await p.mouse.down();await p.mouse.move(r.x+250,r.y+200,{steps:8});await p.mouse.up();}}
await w.waitForTimeout(1500);
log('tiles:',(await w.$$('#lcStage .lc-tile')).length,'count:',await w.textContent('#lcHead .lc-count'));
log('phone status:',await ph[0].textContent('#actRoot .ok'));
await w.screenshot({path:S+'/lc_draw.png'});
await w.click('.lc-seg button[data-c="3"]').catch(()=>{});await w.click('#lcTools [data-c="3"]');await w.waitForTimeout(300);await w.screenshot({path:S+'/lc_draw3.png'});
// star + spotlight + share
await w.click('#lcStage .lc-tile .lc-star');await w.waitForTimeout(400);log('phone0 stars:',await ph[0].textContent('#stars'),'/',await ph[1].textContent('#stars'));
await w.click('#lcStage .lc-tile .lc-pv');await w.waitForTimeout(500);log('spot:',!!(await w.$('#lcSpot canvas')));await w.screenshot({path:S+'/lc_spot.png'});
await w.click('#spShare');await w.waitForTimeout(1200);log('shared on phone:',await ph[3].textContent('.shared .who'));await ph[3].screenshot({path:S+'/lc_phone_shared.png'});
await w.click('#spX');
// put gallery on board
const before=await w.evaluate(()=>HBE.page().objs.length);await w.click('#lcBoard');await w.waitForTimeout(1500);log('board objs +',await w.evaluate(()=>HBE.page().objs.length)-before,'stage hidden:',await w.evaluate(()=>document.getElementById('lcStage').hidden),'chip:',!!(await w.$('#lcChip')));
await w.screenshot({path:S+'/lc_board.png'});
await w.click('#lcChip');await w.waitForTimeout(500);
// ---- poll with correct answer
w.on('dialog',d=>d.accept());
await w.click('#lcNew');await w.waitForTimeout(500);await w.click('.lc-card[data-k="poll"]');await w.waitForTimeout(300);await w.fill('#lcP','Which organelle releases energy?');await w.fill('[data-o="0"]','Nucleus');await w.fill('[data-o="1"]','Mitochondrion');await w.fill('[data-o="2"]','Ribosome');await w.fill('[data-o="3"]','Vacuole');await w.check('[data-c="1"]');await w.click('#lcGo');await w.waitForTimeout(1200);
for(let i=0;i<ph.length;i++){await ph[i].click('.opt >> nth='+[1,1,0,1,2,1][i]);}
await w.waitForTimeout(1200);log('poll counts:',(await w.$$eval('#lcStage .lc-opt .n',e=>e.map(x=>x.textContent))).join(' | '));
await w.click('#lcReveal');await w.waitForTimeout(1200);log('phone reveal:',await ph[0].textContent('#actRoot .ok, #actRoot b'),'/',await ph[2].textContent('#actRoot b'));
await w.screenshot({path:S+'/lc_poll.png'});
// ---- word cloud
await w.click('#lcNew');await w.waitForTimeout(500);await w.click('.lc-card[data-k="word"]');await w.waitForTimeout(300);await w.fill('#lcP','One word for photosynthesis');await w.click('#lcGo');await w.waitForTimeout(1000);
const W=[['light','glucose'],['light','chlorophyll','oxygen'],['glucose'],['light','energy'],['chlorophyll'],['sun','light']];
for(let i=0;i<ph.length;i++)for(const x of W[i]){await ph[i].fill('#actRoot input',x);await ph[i].press('#actRoot input','Enter');await ph[i].waitForTimeout(120);}
await w.waitForTimeout(1200);await w.screenshot({path:S+'/lc_cloud.png'});log('cloud canvas:',!!(await w.$('#lcStage .lc-cloud')));
// ---- short answer + hide names
await w.click('#lcNew');await w.waitForTimeout(500);await w.click('.lc-card[data-k="text"]');await w.waitForTimeout(300);await w.fill('#lcP','Why do enzymes denature?');await w.selectOption('#lcT','60');await w.click('#lcGo');await w.waitForTimeout(1000);
log('phone clock:',await ph[0].textContent('#clock'));
for(let i=0;i<4;i++){await ph[i].fill('#actRoot textarea','The active site changes shape at high temperature, answer '+i);await ph[i].click('#actRoot .go');}
await w.waitForTimeout(1000);log('text tiles:',(await w.$$('#lcStage .lc-tile')).length);await w.click('#lcAnon');await w.waitForTimeout(500);log('anon names:',(await w.$$eval('#lcStage .lc-tile .who',e=>e.map(x=>x.textContent))).join(','));
await w.screenshot({path:S+'/lc_text.png'});
// ---- collaborate notes
await w.click('#lcNew');await w.waitForTimeout(500);await w.click('.lc-card[data-k="notes"]');await w.waitForTimeout(300);await w.fill('#lcP','Post an adaptation example');await w.click('#lcGo');await w.waitForTimeout(1000);
for(let i=0;i<ph.length;i++){await ph[i].fill('#actRoot textarea','Camels store fat in humps ('+names[i]+')');await ph[i].click('#actRoot .sw >> nth='+(i%6));await ph[i].click('#actRoot .go');await ph[i].waitForTimeout(100);}
await ph[0].fill('#actRoot textarea','Cacti have spines');await ph[0].click('#actRoot .go');
await w.waitForTimeout(1200);log('notes:',(await w.$$('#lcStage .lc-note')).length);await w.screenshot({path:S+'/lc_notes.png'});
// ---- photo
await w.click('#lcNew');await w.waitForTimeout(500);await w.click('.lc-card[data-k="image"]');await w.waitForTimeout(300);await w.fill('#lcP','Photo of your results table');await w.click('#lcGo');await w.waitForTimeout(1000);
for(let i=0;i<2;i++){const [fc]=await Promise.all([ph[i].waitForEvent('filechooser'),ph[i].click('#actRoot .btn >> nth=1')]);await fc.setFiles(S+'/dl_win.png');}
await w.waitForTimeout(2500);log('photo tiles:',(await w.$$('#lcStage .lc-tile img')).length);await w.screenshot({path:S+'/lc_photo.png'});
// ---- hands, question, lock
await ph[4].click('#handB');await ph[5].click('#askB');await ph[5].fill('#askQ','Will this be on the test?');await ph[5].click('#askGo');await w.waitForTimeout(1000);
log('hand rows:',(await w.$$('#lcStage .lc-st.hand')).length,'questions:',(await w.$$('#lcStage .lc-q')).length);
await w.click('#lcLock');await w.waitForTimeout(1000);log('phone locked:',await ph[1].evaluate(()=>getComputedStyle(document.getElementById('lockv')).display));await ph[1].screenshot({path:S+'/lc_phone_lock.png'});await w.click('#lcLock');
await w.click('#lcLb');await w.waitForTimeout(400);await w.screenshot({path:S+'/lc_stars.png'});await w.evaluate(()=>HB.modal.close());
// csv
const [dl]=await Promise.all([w.waitForEvent('download').catch(()=>null),w.click('#lcCsv')]);log('csv:',dl?dl.suggestedFilename():'none');
// end
await w.click('#lcEnd');await w.waitForTimeout(800);log('ended, cards back:',(await w.$$('#lcStage .lc-card')).length,'phone:',await ph[0].textContent('#actRoot'));
await ph[2].screenshot({path:S+'/lc_phone_end.png'});
log('ERRORS',errs);await br.close();await app.close();})().catch(e=>{console.log('FAIL',e.message.split('\n').slice(0,3).join(' '));process.exit(1)});
