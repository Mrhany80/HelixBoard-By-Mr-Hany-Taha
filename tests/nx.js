const {chromium}=require('playwright');const S=process.argv[2];
(async()=>{const b=await chromium.launch({args:['--use-fake-ui-for-media-stream','--use-fake-device-for-media-stream','--autoplay-policy=no-user-gesture-required']});const c=await b.newContext({viewport:{width:1280,height:800},acceptDownloads:true});await c.addInitScript(()=>{localStorage['hb:accSkip']='true'});const p=await c.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
await p.goto('file:///home/user/helixboard/dist/index.html?nointro');await p.waitForTimeout(1500);
await p.evaluate(()=>HBUI.addPage());await p.waitForTimeout(300);
await p.evaluate(()=>HBNX.record());await p.waitForTimeout(800);console.log('rec pill',await p.evaluate(()=>!!document.getElementById('anRec')));
const st=(x,y)=>({t:'stroke',pen:'pen',c:'#1971C2',w:4,a:1,pts:[x,y,.5,x+120,y+10,.5,x+240,y,.5]});
await p.evaluate(s=>HBE.add([s]),st(200,300));await p.waitForTimeout(1500);await p.evaluate(s=>HBE.add([s]),st(200,400));await p.waitForTimeout(1500);await p.evaluate(s=>HBE.add([s]),st(200,500));await p.waitForTimeout(800);
await p.evaluate(()=>HBNX.stopRec());await p.waitForTimeout(1500);console.log('recs',await p.evaluate(()=>JSON.stringify((HBE.page().recs||[]).map(r=>[r.name,r.t1-r.t0]))));
await p.evaluate(()=>HBNX.play());await p.waitForTimeout(700);
const hidden=()=>p.evaluate(()=>{let n=0;HBE.page().objs.filter(o=>o.t==='stroke').forEach(o=>{});return document.getElementById('anCur').textContent});
// seek to 0 and check filter hides strokes
await p.evaluate(()=>{const b=document.getElementById('anBar');b.value=0;b.dispatchEvent(new Event('input'))});
await p.screenshot({path:S+'/nx_t0.png'});
await p.click('#anPP');await p.waitForTimeout(2500);console.log('time after 2.5s',await hidden());await p.screenshot({path:S+'/nx_t2.png'});await p.click('#anPP');
// tap jump on 3rd stroke
await p.click('#anJ');const pos=await p.evaluate(()=>{const o=HBE.page().objs.filter(o=>o.t==='stroke')[2];const r=document.getElementById('cvLive').getBoundingClientRect();return [r.left+(o.pts[3])*HBE.V.s+HBE.V.x, r.top+(o.pts[4])*HBE.V.s+HBE.V.y]});
await p.evaluate(()=>{const b=document.getElementById('anRe');b.click()});// show all ink so the line is visible
await p.mouse.click(pos[0],pos[1]);await p.waitForTimeout(600);console.log('after tap jump time',await hidden());
await p.click('#anX');
// text & tags
await p.evaluate(()=>HBE.add([{t:'text',x:100,y:80,w:0,s:'Photosynthesis',size:48,b:true,font:'Lexend',c:'#000'},{t:'text',x:100,y:160,w:0,s:'Chlorophyll absorbs light energy',size:22,font:'Lexend',c:'#000'},{t:'text',x:60,y:160,w:0,s:'★',size:84,b:true,font:'Lexend',c:'#F59F00',stamp:1}]));
await p.evaluate(()=>HBNX.finder('find'));await p.fill('#nfQ','chloro');await p.waitForTimeout(300);console.log('search:',(await p.textContent('#nfR')).slice(0,120));
await p.click('.nf-tabs button[data-t="outline"]');await p.waitForTimeout(200);console.log('outline:',(await p.textContent('#nfR')).slice(0,160));
await p.click('.nf-tabs button[data-t="tags"]');await p.waitForTimeout(200);console.log('tags:',(await p.textContent('#nfR')).slice(0,160));
await p.click('.nf-it');await p.waitForTimeout(300);console.log('selected after click',await p.evaluate(()=>HBI.selObjs().length));
await p.evaluate(()=>HBNX.exportNotes());await p.waitForTimeout(300);const [dl]=await Promise.all([p.waitForEvent('download'),p.click('#exDoc')]);console.log('export',dl.suggestedFilename());
console.log('errs',errs);await b.close();})();
