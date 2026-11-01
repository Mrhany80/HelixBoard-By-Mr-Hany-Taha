const {_electron,chromium}=require('playwright');const S=process.argv[2];
(async()=>{const app=await _electron.launch({executablePath:'/home/user/helixboard/desktop/node_modules/electron/dist/electron',args:['--no-sandbox','/home/user/helixboard/desktop'],env:Object.assign({},process.env,{HB_CLOUDFLARED:process.env.HB_CLOUDFLARED||''})});
const w=await app.firstWindow();await w.waitForLoadState();await w.evaluate(()=>{localStorage['hb:accSkip']='true';localStorage['hb:askSession']='false';localStorage['hb:phonePace']='"teacher"'});await w.reload();const errs=[];w.on('pageerror',e=>errs.push('T:'+e.message));w.on('console',m=>{if(m.type()==='error'&&!/ERR_|Failed to load/.test(m.text()))errs.push('T:'+m.text())});
await w.waitForTimeout(2500);await w.evaluate(()=>{HB.modal.close();const i=document.querySelector('#intro');if(i){i.hidden=true;}});
await w.evaluate(()=>{localStorage['hb:quizSets']=JSON.stringify({'Cells':[{q:'Powerhouse of the cell?',o:['Nucleus','Mitochondrion','Ribosome','Vacuole'],a:1,ex:'Aerobic respiration.'},{q:'Plants make glucose by…',o:['Respiration','Photosynthesis'],a:1,ex:''},{q:'Favourite topic?',o:['Cells','Genes','Ecology'],a:-1,ex:''}]})});
await w.evaluate(()=>HBL.phoneQuiz());await w.waitForTimeout(1500);
const url=await w.evaluate(()=>document.querySelector('#pqB select')?.value||null);
const info=await w.evaluate(()=>helixDesktop.live.cmd('snapshot'));
await w.waitForTimeout(2500);const local=await w.evaluate(()=>{const t=document.querySelector('#pqB').innerText;return t});
console.log('lobby text:',local.split('\n').slice(0,4).join(' | '));
const lanUrl=await w.evaluate(()=>{const s=[...document.querySelectorAll('#pqB div')].find(d=>/^http/.test(d.textContent));return s&&s.textContent});
console.log('shown url',lanUrl);
const pin=await w.evaluate(()=>(document.querySelector('#pqB').innerText.match(/(?:Game|Class) PIN\s*(\d{6})/)||[])[1]);console.log('pin',pin,'tunnel',JSON.stringify((await w.evaluate(()=>helixDesktop.live.cmd('snapshot'))).tunnel));
await w.screenshot({path:S+'/pq_lobby.png'});
const port=process.env.VIA_PROXY?'9555':(await w.evaluate(()=>helixDesktop.cl.cmd('snapshot').then(s=>String(s.port))));const base='http://localhost:'+port+'/?pin='+pin;
const br=await chromium.launch();const phones=[];
for(const n of ['Sara','Omar','Lina']){const c=await br.newContext({viewport:{width:390,height:780},isMobile:true,hasTouch:true});const p=await c.newPage();p.on('pageerror',e=>errs.push(n+':'+e.message));await p.goto(base);await p.fill('input[placeholder="Your full name"]',(n)+' Test');await p.click('button.go');await p.waitForURL(/\/quiz\//,{timeout:15000});await p.waitForSelector('main h1',{timeout:15000});phones.push(p);}
await w.waitForTimeout(800);await phones[0].screenshot({path:S+'/pq_phone_lobby.png'});await w.screenshot({path:S+'/pq_lobby2.png'});
console.log('players',(await w.evaluate(()=>helixDesktop.live.cmd('snapshot'))).players.map(p=>p.name+(p.online?'':'(off)')).join(','));
await w.keyboard.press('Space');await w.waitForTimeout(700);await phones[1].screenshot({path:S+'/pq_phone_q.png'});
// answers: Sara right fast, Omar wrong, Lina right slow
await phones[0].click('.opt >> nth=1');await w.waitForTimeout(400);await phones[1].click('.opt >> nth=0');await w.waitForTimeout(900);await phones[2].click('.opt >> nth=1');
await w.waitForTimeout(1200);await w.screenshot({path:S+'/pq_reveal.png'});await phones[0].screenshot({path:S+'/pq_phone_reveal.png'});
let sn=await w.evaluate(()=>helixDesktop.live.cmd('snapshot'));console.log('after q1 phase',sn.phase,sn.players.map(p=>p.name+':'+p.score).join(' '));
await w.keyboard.press('Space');await w.waitForTimeout(500);await w.screenshot({path:S+'/pq_board.png'});
await w.keyboard.press('Space');await w.waitForTimeout(500);for(const p of phones)await p.click('.opt >> nth=1');await w.waitForTimeout(1200);
await w.keyboard.press('Space');await w.waitForTimeout(300);await w.keyboard.press('Space');await w.waitForTimeout(500);
for(const p of phones)await p.click('.opt >> nth=0');await w.waitForTimeout(1200);await w.keyboard.press('Space');await w.waitForTimeout(300);await w.keyboard.press('Space');await w.waitForTimeout(1200);
sn=await w.evaluate(()=>helixDesktop.live.cmd('snapshot'));console.log('final',sn.phase,sn.players.map(p=>p.name+':'+p.score).join(' '));
await w.screenshot({path:S+'/pq_end.png'});await phones[2].screenshot({path:S+'/pq_phone_end.png'});
// wrong pin + injection name
const r=await phones[0].evaluate(()=>fetch('/join',{method:'POST',body:JSON.stringify({pin:'000000',name:'x'})}).then(r=>r.status));console.log('wrong pin status',r);
const res=await w.evaluate(()=>helixDesktop.live.cmd('results'));console.log('csv rows',res.players.length,'q',res.questions.length);
await w.evaluate(()=>HBL.closeStage());await w.waitForTimeout(2500);
await phones[0].waitForURL(u=>!/\/quiz\//.test(String(u)),{timeout:15000});await phones[0].waitForLoadState();await phones[0].waitForTimeout(1500);const closed=await phones[0].evaluate(()=>document.body.innerText);console.log('phone after close (back in class):',/Activity|Board/.test(closed));
console.log('ERRORS',errs);await br.close();await app.close();})().catch(e=>{console.error('FAIL',e.message);process.exit(1)});
