const {_electron,chromium}=require('playwright');const S=process.argv[2];const log=(...a)=>console.log(...a);
(async()=>{const app=await _electron.launch({executablePath:'/home/user/helixboard/desktop/node_modules/electron/dist/electron',args:['--no-sandbox','/home/user/helixboard/desktop'],env:Object.assign({},process.env,{HB_CLOUDFLARED:S+'/fake-cloudflared',HB_TUNNEL_PING_ORIGIN:'http://127.0.0.1:9555'})});
const w=await app.firstWindow();await w.waitForLoadState();await w.evaluate(()=>{localStorage['hb:accSkip']='true';localStorage['hb:askSession']='false';localStorage['hb:introEvery']='false';localStorage['hb:seenIntro']='true';Object.keys(localStorage).filter(k=>/^hb:lc(Once|Secs|Auto)/.test(k)).forEach(k=>localStorage.removeItem(k))});await w.reload();const errs=[];w.on('pageerror',e=>errs.push('T:'+e.message));
await w.waitForTimeout(2500);await w.evaluate(()=>HB.modal.close());await w.evaluate(()=>HBLC.open());await w.waitForTimeout(2500);
const sn=await w.evaluate(()=>helixDesktop.cl.cmd('snapshot'));const base='http://127.0.0.1:'+sn.port+'/?pin='+sn.pin;
const br=await chromium.launch();const ph=[];for(const n of ['Sara','Omar','Lina']){const c=await br.newContext({viewport:{width:390,height:820},isMobile:true,hasTouch:true});const p=await c.newPage();p.on('pageerror',e=>errs.push(n+':'+e.message));await p.goto(base);await p.fill('input[placeholder="Your full name"]',(n)+' Test');await p.click('.go');ph.push(p);}
await w.waitForTimeout(1500);
const setup=async(type,prompt,mode,secs)=>{await w.click('.lc-card[data-k="'+type+'"]');await w.waitForTimeout(300);await w.fill('#lcP',prompt);if(mode)await w.click('#lcMode [data-once="'+mode+'"]');if(secs!=null)await w.selectOption('#lcT',String(secs));await w.click('#lcGo');await w.waitForTimeout(1200);};
const draw=async p=>{const b=await p.$('.pad canvas');const r=await b.boundingBox();await p.mouse.move(r.x+40,r.y+40);await p.mouse.down();await p.mouse.move(r.x+200,r.y+120,{steps:6});await p.mouse.up();await p.waitForTimeout(200);};
// 1. Draw it — submit once (default), 3 minutes
await setup('draw','Draw a cell',null,null);
log('default mode tag:',await w.textContent('#lcHead'));
for(const p of ph)await draw(p);await w.waitForTimeout(1200);
log('tiles before submit:',(await w.$$('#lcStage .lc-tile')).length,'| working icons:',(await w.$$('#lcStage .lc-st [title="Working on it"]')).length,'| head:',(await w.textContent('#lcHead')).replace(/\s+/g,' '));
await ph[0].click('#actRoot .go');await w.waitForTimeout(1000);
log('tiles after Sara submits:',(await w.$$('#lcStage .lc-tile')).length,'| Sara phone:',(await ph[0].textContent('#actRoot')).match(/✓ Submitted|Waiting[^.]*/g),'| still has pen tools:',!!(await ph[0].$('#actRoot .tools')));
const again=await ph[0].evaluate(async()=>{const q=new URLSearchParams(location.search);const k=Object.keys(localStorage).find(x=>x.startsWith('hbcl:'));const pid=JSON.parse(localStorage[k]).pid;const st=await fetch('/poll?pid='+pid+'&v=0').then(r=>r.json());const r=await fetch('/answer?pid='+pid,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:st.act.id,value:[{c:'#000000',w:3,p:[0.1,0.1,0.2,0.2]}]})});return r.status+' '+(await r.json()).error});
log('second answer from Sara:',again);
await ph[0].screenshot({path:S+'/once_phone_submitted.png'});await w.screenshot({path:S+'/once_draw.png'});
// 2. Short answer — 30 s limit, drafts handed in automatically
await w.click('#lcNew');await w.waitForTimeout(500);await setup('text','Why do leaves change colour?','1',30);
await ph[0].fill('#actRoot textarea','Chlorophyll breaks down (Sara)');await ph[1].fill('#actRoot textarea','Less sunlight (Omar, not submitted)');await ph[0].click('#actRoot .go');
await w.waitForTimeout(1000);log('submitted so far:',(await w.$$('#lcStage .lc-tile')).length,'phone clock:',await ph[1].textContent('#clock'));
await ph[2].waitForTimeout(27500);await ph[1].screenshot({path:S+'/once_phone_hurry.png'});await w.waitForTimeout(5000);
log('after time is up — tiles:',(await w.$$('#lcStage .lc-tile')).length,'| auto-marked:',(await w.$$('#lcStage .lc-tile .who span[title^="Handed"]')).length,'| Omar phone:',(await ph[1].textContent('#actRoot')).includes('Submitted'),'| Lina phone:',(await ph[2].textContent('#actRoot')).match(/Time is up[^.]*/));
await ph[2].evaluate(()=>{});const late=await ph[2].evaluate(async()=>{const k=Object.keys(localStorage).find(x=>x.startsWith('hbcl:'));const pid=JSON.parse(localStorage[k]).pid;const st=await fetch('/poll?pid='+pid+'&v=0').then(r=>r.json());const r=await fetch('/answer?pid='+pid,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:st.act.id,value:'late answer'})});return r.status+' '+(await r.json()).error});
log('late answer from Lina:',late);
await w.click('#lcPlus');await w.waitForTimeout(1500);log('after +1 min, Lina can answer:',!!(await ph[2].$('#actRoot textarea')),'clock:',await ph[2].textContent('#clock'));
await ph[2].fill('#actRoot textarea','Anthocyanins (Lina)');await ph[2].click('#actRoot .go');await w.waitForTimeout(800);log('tiles now:',(await w.$$('#lcStage .lc-tile')).length);
await w.screenshot({path:S+'/once_text.png'});
// 3. Poll — submit once with reveal
await w.click('#lcNew');await w.waitForTimeout(500);await w.click('.lc-card[data-k="poll"]');await w.waitForTimeout(300);await w.fill('#lcP','Which gas do plants release?');for(const [i,v] of ['Oxygen','Carbon dioxide','Nitrogen','Hydrogen'].entries())await w.fill('[data-o="'+i+'"]',v);await w.check('[data-c="0"]');await w.click('#lcGo');await w.waitForTimeout(1200);
await ph[0].click('.opt >> nth=1');await ph[0].click('.opt >> nth=0');await w.waitForTimeout(500);log('poll before submit:',await w.$$eval('#lcStage .lc-opt .n',e=>e.map(x=>x.textContent).join(' | ')).catch(()=>'(empty)'));
for(const [i,k] of [[0,0],[1,1],[2,0]]){await ph[i].click('.opt >> nth='+k);await ph[i].click('#actRoot .go');}
await w.waitForTimeout(800);log('poll after submit:',await w.$$eval('#lcStage .lc-opt .n',e=>e.map(x=>x.textContent).join(' | ')));
await w.click('#lcReveal');await w.waitForTimeout(800);log('reveal on phones:',await ph[0].textContent('#actRoot b'),'/',await ph[1].textContent('#actRoot b'));
// 4. Word cloud stays Live by default
await w.click('#lcNew');await w.waitForTimeout(500);await setup('word','One word for energy',null,null);log('word default:',(await w.textContent('#lcHead')).includes('Live'));
await ph[0].fill('#actRoot input','ATP');await ph[0].press('#actRoot input','Enter');await w.waitForTimeout(800);log('live word arrived without Submit:',!!(await w.$('#lcStage .lc-cloud')));
// 5. Notes, submit once: posts can't be taken back
await w.click('#lcNew');await w.waitForTimeout(500);await setup('notes','Name an adaptation','1',null);
await ph[0].fill('#actRoot textarea','Thick fur');await ph[0].click('#actRoot .go');await w.waitForTimeout(500);await ph[0].fill('#actRoot textarea','Webbed feet');await ph[0].click('#actRoot .go');await w.waitForTimeout(800);
log('notes on board:',(await w.$$('#lcStage .lc-note')).length,'| delete buttons on phone:',(await ph[0].$$('.note button')).length);
log('ERRORS',errs);await br.close();await app.close();})().catch(e=>{console.log('FAIL',e.message.split('\n').slice(0,4).join(' | '));process.exit(1)});
