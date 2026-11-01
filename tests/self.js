const {_electron,chromium}=require('playwright');const S=process.argv[2];
(async()=>{const app=await _electron.launch({executablePath:'/home/user/helixboard/desktop/node_modules/electron/dist/electron',args:['--no-sandbox','/home/user/helixboard/desktop'],env:Object.assign({},process.env,{HB_CLOUDFLARED:S+'/fake-cloudflared'})});
const w=await app.firstWindow();await w.waitForLoadState();await w.evaluate(()=>{localStorage['hb:askSession']='false'});await w.reload();await w.waitForLoadState();await w.evaluate(()=>{localStorage['hb:accSkip']='true'});await w.reload();const errs=[];w.on('pageerror',e=>errs.push('T:'+e.message));await w.waitForTimeout(6000);
await w.evaluate(()=>{localStorage['hb:quizSets']=JSON.stringify({'Cells':[{q:'Powerhouse?',o:['Nucleus','Mitochondrion','Ribosome'],a:1,ex:'Respiration'},{q:'Makes protein?',o:['Ribosome','Vacuole'],a:0,ex:''},{q:'Plant wall?',o:['Cellulose','Chitin'],a:0,ex:''}]});localStorage['hb:phonePace']=JSON.stringify('student');});
await w.evaluate(()=>HBL.phoneQuiz());await w.waitForTimeout(3500);const pin=await w.evaluate(()=>(document.querySelector('#pqB').innerText.match(/(?:Game|Class) PIN\s*(\d{6})/)||[])[1]);
const br=await chromium.launch();const ph=[];for(const n of ['Sara','Omar','Lina']){const c=await br.newContext({viewport:{width:390,height:780},isMobile:true});const p=await c.newPage();p.on('pageerror',e=>errs.push(n+':'+e.message));await p.goto('http://127.0.0.1:'+(await w.evaluate(()=>helixDesktop.cl.cmd('snapshot').then(s=>s.port)))+'/?pin='+pin);await p.fill('input[placeholder="Your full name"]',(n)+' Test');await p.click('button.go');ph.push(p);}
await w.waitForTimeout(800);await w.keyboard.press('Space');await w.waitForTimeout(800);
// Sara: all right quickly; Omar: 1 right then stops; Lina: wrong, right, right
const ans={0:[1,0,0],1:[1],2:[0,0,0]};
for(const [k,list] of Object.entries(ans)){const p=ph[k];for(const a of list){await p.click('.opt >> nth='+a);await p.waitForSelector('button.go');if(k==0&&a===1)await p.screenshot({path:S+'/self_fb.png'});await p.click('button.go');await p.waitForTimeout(300);}}
await w.waitForTimeout(800);await w.screenshot({path:S+'/self_teacher.png'});
const sn=await w.evaluate(()=>helixDesktop.live.cmd('snapshot'));console.log('phase',sn.phase,sn.players.map(p=>p.name+' '+p.done+'/'+sn.total+' ✓'+p.correct+' '+p.score).join(' | '));
console.log('Sara phone:',(await ph[0].innerText('main')).split('\n').slice(0,3).join(' | '));
await w.click('#pqEnd');await w.waitForTimeout(500);await w.click('#askY').catch(()=>{});await w.waitForTimeout(1200);
console.log('after end phase',(await w.evaluate(()=>helixDesktop.live.cmd('snapshot'))).phase,'| Omar phone:',(await ph[1].innerText('main')).split('\n').slice(0,2).join(' | '));
await w.screenshot({path:S+'/self_end.png'});console.log('ERRORS',errs);await br.close();await app.close();})().catch(e=>{console.error('FAIL',e.message);process.exit(1)});
