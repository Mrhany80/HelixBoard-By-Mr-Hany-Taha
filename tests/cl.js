const {_electron,chromium}=require('playwright');const S=process.argv[2];
(async()=>{const app=await _electron.launch({executablePath:'/home/user/helixboard/desktop/node_modules/electron/dist/electron',args:['--no-sandbox','/home/user/helixboard/desktop'],env:Object.assign({},process.env,{HB_CLOUDFLARED:S+'/fake-cloudflared'})});
const w=await app.firstWindow();await w.waitForLoadState();await w.evaluate(()=>{localStorage['hb:askSession']='false'});await w.reload();await w.waitForLoadState();await w.evaluate(()=>{localStorage['hb:accSkip']='true'});await w.reload();const errs=[];w.on('pageerror',e=>errs.push('T:'+e.message));w.on('console',m=>{if(m.type()==='error'&&!/ERR_|Failed to load/.test(m.text()))errs.push('T:'+m.text())});
await w.waitForTimeout(6000);await w.evaluate(()=>{HB.modal.close();});console.log('intro hidden',await w.evaluate(()=>document.querySelector('#intro').hidden));
await w.evaluate(()=>{localStorage['hb:quizSets']=JSON.stringify({'Cells':[{q:'Powerhouse?',o:['Nucleus','Mitochondrion','Ribosome'],a:1,ex:'Respiration'},{q:'Makes protein?',o:['Ribosome','Vacuole'],a:0,ex:''}]});const o={t:'text',x:200,y:200,w:0,s:'Teacher note',font:'Lexend',size:40,c:'#000'};HBE.add([o]);});
await w.evaluate(()=>HBCL.start());await w.waitForTimeout(3500);
const sn=await w.evaluate(()=>helixDesktop.cl.cmd('snapshot'));console.log('tunnel',sn.tunnel.state,'pin',sn.pin,'boardOn',sn.boardOn);await w.screenshot({path:S+'/cl_panel.png'});
const br=await chromium.launch();const ph=[];for(const n of ['Sara','Omar']){const c=await br.newContext({viewport:{width:390,height:780},isMobile:true,hasTouch:true,acceptDownloads:true});const p=await c.newPage();p.on('pageerror',e=>errs.push(n+':'+e.message));await p.goto('http://localhost:9555/?pin='+sn.pin);await p.fill('input[placeholder="Your full name"]',(n)+' Test');await p.click('.go');ph.push(p);}
await ph[0].waitForSelector('.boardwrap img',{timeout:10000});await ph[0].waitForTimeout(1500);
console.log('board img size',await ph[0].evaluate(()=>{const i=document.querySelector('.boardwrap img');return i.naturalWidth+'x'+i.naturalHeight}));await ph[0].screenshot({path:S+'/cl_phone_board.png'});
// allow writing
await w.check('#clDraw');await ph[0].waitForSelector('text=Write',{timeout:5000});await ph[0].click('text=Write');
const bb=await ph[0].$eval('.boardwrap canvas',c=>{const r=c.getBoundingClientRect();return [r.x,r.y,r.width,r.height]});
await ph[0].mouse.move(bb[0]+bb[2]*0.3,bb[1]+bb[3]*0.5);await ph[0].mouse.down();for(let i=0;i<15;i++)await ph[0].mouse.move(bb[0]+bb[2]*(0.3+i*0.02),bb[1]+bb[3]*(0.5+Math.sin(i/2)*0.05));await ph[0].mouse.up();
await w.waitForTimeout(1200);console.log('student strokes on board',await w.evaluate(()=>HBE.page().objs.filter(o=>o.stu).map(o=>o.stu+':'+o.pts.length/3).join(',')));
await w.waitForTimeout(1500);await w.screenshot({path:S+'/cl_teacher_ink.png'});
await w.click('#clInk');console.log('after clear',await w.evaluate(()=>HBE.page().objs.filter(o=>o.stu).length));
// share a file
await w.evaluate(()=>HBCL.shareFile({name:'Lesson 1.mp4',kind:'video',data:new Uint8Array([1,2,3,4,5]),type:'video/mp4'}));await ph[1].waitForTimeout(800);await ph[1].click('nav button:nth-child(3)');await ph[1].waitForTimeout(300);
const dl=ph[1].waitForEvent('download');await ph[1].click('a.file');const d=await dl;console.log('phone downloaded',d.suggestedFilename(),require('fs').statSync(await d.path()).size,'bytes');
// homework on phone
await w.evaluate(()=>{const id='hwtest';const A={};A[id]={id,title:'Cells HW',set:'Cells',cls:'9B',due:'2026-10-30',note:'',showAnswers:true,created:Date.now(),questions:JSON.parse(localStorage['hb:quizSets']).Cells,results:{}};localStorage['hb:hwAssign']=JSON.stringify(A);HBCL.shareHomework(A[id]);});
await ph[1].waitForTimeout(1000);await ph[1].click('nav button:nth-child(4)');await ph[1].click('text=Start');await ph[1].click('.opt >> nth=1');await ph[1].click('.opt >> nth=1');await ph[1].click('text=Submit');await ph[1].waitForTimeout(800);
console.log('phone after submit:',(await ph[1].innerText('main')).split('\n').slice(0,3).join(' | '));
await w.waitForTimeout(500);console.log('dashboard result',await w.evaluate(()=>JSON.stringify(Object.values(JSON.parse(localStorage['hb:hwAssign']).hwtest.results).map(r=>r.name+':'+r.ans.join('')+':'+r.via))));
await w.evaluate(()=>HBL.homework());await w.click('[data-dash="hwtest"]');await w.waitForTimeout(500);await w.screenshot({path:S+'/hw_dash.png'});await w.keyboard.press('Escape');
// stop
await w.evaluate(()=>HBCL.stop());await ph[0].waitForTimeout(2500);console.log('phone after stop:',(await ph[0].innerText('main')).split('\n')[0]);
console.log('ERRORS',errs);await br.close();await app.close();})().catch(e=>{console.error('FAIL',e.message);process.exit(1)});
