const {_electron,chromium}=require('playwright');const S=process.argv[2];const log=(...a)=>console.log(...a);
(async()=>{const app=await _electron.launch({executablePath:'/home/user/helixboard/desktop/node_modules/electron/dist/electron',args:['--no-sandbox','/home/user/helixboard/desktop'],env:Object.assign({},process.env,{HB_CLOUDFLARED:S+'/fake-cloudflared',HB_TUNNEL_PING_ORIGIN:'http://127.0.0.1:9555'})});
const w=await app.firstWindow();await w.waitForLoadState();await w.evaluate(()=>{localStorage['hb:accSkip']='true';localStorage['hb:askSession']='false';localStorage['hb:phonePace']='"teacher"';localStorage['hb:introEvery']='false';localStorage['hb:seenIntro']='true';localStorage.removeItem('hb:quizGhosts');localStorage['hb:phoneOpts']=JSON.stringify({mode:'teams',teams:2,power:true,conf:true});localStorage['hb:phoneGhost']='"last"'});await w.reload();const errs=[];w.on('pageerror',e=>errs.push('T:'+e.message));
await w.waitForTimeout(2500);await w.evaluate(()=>HB.modal.close());
await w.evaluate(()=>{localStorage['hb:quizSets']=JSON.stringify({'Cells':HBL._parse ? [] : []})});
const txt='1. Powerhouse of the cell?\nA) Nucleus\nB) Mitochondrion *\nC) Ribosome\nD) Vacuole\n\n2. Plants make glucose by?\nA) Respiration\nB) Photosynthesis *\nC) Digestion\n\n3. Which is a gas?\nA) Water\nB) Oxygen *\nC) Salt\nD) Sugar\n\nOrder: Stages of mitosis\nA) Prophase\nB) Metaphase\nC) Anaphase\nD) Telophase\nWhy: PMAT';
// save through the editor
await w.evaluate(()=>HBL.editQuiz());await w.waitForTimeout(500);await w.fill('#seName','Cells');await w.fill('#seText',txt);await w.click('#seSave');await w.waitForTimeout(300);await w.evaluate(()=>HB.modal.close());
log('parsed set:',await w.evaluate(()=>JSON.parse(localStorage['hb:quizSets']).Cells.map(q=>(q.t||'mcq')+':'+q.o.length).join(',')));
const ph=()=>w.evaluate(()=>helixDesktop.live.cmd('snapshot').then(s=>s&&s.phase));
async function game(names,plan,label){
 await w.evaluate(()=>HBL.phoneQuiz('Cells'));await w.waitForTimeout(2500);
 const pin=await w.evaluate(()=>(document.querySelector('#pqB').innerText.match(/(?:Game|Class) PIN\s*(\d{6})/)||[])[1]);
 const br=await chromium.launch();const P={};
 for(const n of names){const c=await br.newContext({viewport:{width:390,height:800},isMobile:true,hasTouch:true});const p=await c.newPage();p.on('pageerror',e=>errs.push(n+':'+e.message));await p.goto('http://127.0.0.1:'+(await w.evaluate(()=>helixDesktop.cl.cmd('snapshot').then(s=>s.port)))+'/?pin='+pin);await p.fill('input[placeholder="Your full name"]',(n)+' Test');await p.click('.go');P[n]=p;}
 await w.waitForTimeout(1500);log(label,'lobby phone:',(await P[names[0]].textContent('main')).slice(0,90));
 await w.screenshot({path:S+'/gm_lobby_'+label+'.png'});
 await w.keyboard.press('Space');await w.waitForTimeout(1200);
 for(let qi=0;qi<4;qi++){ for(const n of names){const act=plan[qi][n];if(!act)continue;const p=P[n];
   if(act.power){act.power=await p.textContent('.pw');await p.click('.pw');await p.waitForTimeout(700);log(label,'Q'+(qi+1),n,'used',act.power,'visible options',await p.evaluate(()=>[...document.querySelectorAll('.opt')].filter(b=>b.style.visibility!=='hidden').length));}
   if(act.order){await p.evaluate(()=>{});const items=await p.$$eval('.it .tx',e=>e.map(x=>x.textContent));const want=['Prophase','Metaphase','Anaphase','Telophase'];
     for(let i=0;i<want.length;i++){let cur=await p.$$eval('.it .tx',e=>e.map(x=>x.textContent));let j=cur.indexOf(want[i]);while(j>i){await p.click('.it:nth-child('+(j+1)+') button:has-text("▲")');j--;}}
     await p.click('text=Submit my order');} else await p.click('.opt:nth-child('+(act.c+1)+')');
   await p.waitForTimeout(250);if(act.conf!=null){await p.click('.conf button:nth-child('+(act.conf+1)+')');}
   await p.waitForTimeout(250);}
  await w.waitForTimeout(900);if((await ph())==='question'){await w.keyboard.press('Space');}await w.waitForTimeout(1200);
  const rv=await w.evaluate(()=>document.querySelector('#pqB').innerText.replace(/\n+/g,' | '));log(label,'Q'+(qi+1),'reveal:',rv.slice(0,330));
  if(qi===0||qi===3)await w.screenshot({path:S+'/gm_rev'+qi+'_'+label+'.png'});
  log(label,'  phone '+names[0]+':',(await P[names[0]].textContent('main')).replace(/\s+/g,' ').slice(0,120));
  await w.keyboard.press('Space');await w.waitForTimeout(900);if(qi===1){await w.screenshot({path:S+'/gm_board_'+label+'.png'});log(label,'board:',(await w.evaluate(()=>document.querySelector('#pqB').innerText.replace(/\n+/g,' | '))).slice(0,200));}
  await w.keyboard.press('Space');await w.waitForTimeout(1200);log(label,'  now phase',await ph());}
 log(label,'end:',(await w.evaluate(()=>document.querySelector('#pqB').innerText.replace(/\n+/g,' | '))).slice(0,300));await w.screenshot({path:S+'/gm_end_'+label+'.png'});
 log(label,'phone end:',(await P[names[1]].textContent('main')).replace(/\s+/g,' ').slice(0,140));
 await w.waitForTimeout(800);await w.evaluate(()=>{const b=[...document.querySelectorAll('#pqB button')].find(b=>b.textContent.trim()==='Done');b&&b.click()});await w.waitForTimeout(2500);await br.close();}
await game(['Sara','Omar','Lina'],[
 {Sara:{c:1,conf:2},Omar:{c:0,conf:2},Lina:{c:1,conf:1}},
 {Sara:{c:1,conf:1},Omar:{c:1,conf:0},Lina:{c:0,conf:1}},
 {Sara:{power:'any',c:1,conf:2},Omar:{c:1,conf:1}},
 {Sara:{order:1,conf:2},Lina:{order:1,conf:1}}],'teams');
await w.evaluate(()=>{localStorage['hb:phoneOpts']=JSON.stringify({mode:'boss',teams:2,power:false,conf:false})});
await game(['Ali','Mona'],[{Ali:{c:1},Mona:{c:1}},{Ali:{c:1},Mona:{c:0}},{Ali:{c:0},Mona:{c:0}},{Ali:{order:1}}],'boss');
log('ghost runs',await w.evaluate(()=>JSON.stringify(JSON.parse(localStorage['hb:quizGhosts']).Cells.map(r=>r.avg))));
log('report modes',await w.evaluate(async()=>{await new Promise(r=>setTimeout(r,500));const ix=await HB.IDB.get('reports:index');return ix.slice(0,2).map(x=>x.title+':'+x.accuracy).join(' ; ')}));
log('errs',errs);await app.close();})();
