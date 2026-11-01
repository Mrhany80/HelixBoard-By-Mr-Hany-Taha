const {_electron,chromium}=require('playwright');const S=process.argv[2];const fs=require('fs');const log=(...a)=>console.log(...a);
(async()=>{const app=await _electron.launch({executablePath:'/home/user/helixboard/desktop/node_modules/electron/dist/electron',args:['--no-sandbox','/home/user/helixboard/desktop'],env:Object.assign({},process.env,{HB_CLOUDFLARED:S+'/fake-cloudflared',HB_TUNNEL_PING_ORIGIN:'http://127.0.0.1:9555'})});
const w=await app.firstWindow();await w.waitForLoadState();await w.evaluate(()=>{localStorage['hb:accSkip']='true';localStorage['hb:askSession']='false';localStorage['hb:introEvery']='false';localStorage['hb:seenIntro']='true';Object.keys(localStorage).filter(k=>/^hb:lc(Once|Secs|Auto)/.test(k)).forEach(k=>localStorage.removeItem(k))});await w.reload();const errs=[];w.on('pageerror',e=>errs.push('T:'+e.message));
await w.waitForTimeout(2500);await w.evaluate(async()=>{HB.modal.close();await HB.IDB.put('reports:index',[]);});await w.evaluate(()=>HBLC.open());await w.waitForTimeout(2500);
const sn=await w.evaluate(()=>helixDesktop.cl.cmd('snapshot'));const base='http://127.0.0.1:'+sn.port+'/?pin='+sn.pin;
const br=await chromium.launch();const ph=[];const N=['Sara','Omar','Lina','Yousef'];for(const n of N){const c=await br.newContext({viewport:{width:390,height:820},isMobile:true,hasTouch:true});const p=await c.newPage();p.on('pageerror',e=>errs.push(n+':'+e.message));await p.goto(base);await p.fill('input[placeholder="Your full name"]',(n)+' Test');await p.click('.go');ph.push(p);}
await w.waitForTimeout(1500);
const setup=async(type,prompt,opts)=>{await w.click('.lc-card[data-k="'+type+'"]');await w.waitForTimeout(300);await w.fill('#lcP',prompt);if(opts){for(const [i,v] of opts.entries())await w.fill('[data-o="'+i+'"]',v);await w.check('[data-c="1"]');}await w.click('#lcGo');await w.waitForTimeout(1200);};
// poll with a right answer: Sara ✓ Omar ✓ Lina ✗, Yousef no answer
await setup('poll','Which organelle releases energy?',['Nucleus','Mitochondrion','Ribosome','Vacuole']);
for(const [i,k] of [[0,1],[1,1],[2,0]]){await ph[i].click('.opt >> nth='+k);await ph[i].click('#actRoot .go');}
await w.waitForTimeout(600);await w.click('#lcStage .lc-star').catch(()=>{});
// second poll: Sara ✗ Omar ✓ Lina ✓ Yousef ✓
await w.click('#lcNew');await w.waitForTimeout(500);await setup('poll','Plants release…',['Nitrogen','Oxygen','Helium']);
for(const [i,k] of [[0,0],[1,1],[2,1],[3,1]]){await ph[i].click('.opt >> nth='+k);await ph[i].click('#actRoot .go');}
// drawing: Sara and Omar submit
await w.click('#lcNew');await w.waitForTimeout(500);await setup('draw','Draw a cell');
for(const i of [0,1]){const b=await ph[i].$('.pad canvas');const r=await b.boundingBox();await ph[i].mouse.move(r.x+40,r.y+40);await ph[i].mouse.down();await ph[i].mouse.move(r.x+220,r.y+140,{steps:6});await ph[i].mouse.up();await ph[i].click('#actRoot .go');}
// short answer: three answer
await w.click('#lcNew');await w.waitForTimeout(500);await setup('text','Explain respiration in one sentence');
for(const i of [0,1,3]){await ph[i].fill('#actRoot textarea','Glucose + oxygen gives energy ('+N[i]+')');await ph[i].click('#actRoot .go');}
await w.waitForTimeout(800);
// open reports from the dashboard
await w.click('#lcRep');await w.waitForTimeout(1500);
log('reports open:',!!(await w.$('#rpStage:not([hidden])')),'| list items:',(await w.$$('#rpStage .rp-item')).length);
log('KPIs:',(await w.$$eval('#rpStage .kpi',e=>e.map(x=>x.querySelector('small').textContent+'='+x.querySelector('b').textContent))).join(' | '));
await w.screenshot({path:S+'/rp_overview.png'});
await w.click('#rpStage .tabs [data-t="students"]');await w.waitForTimeout(400);
log('student rows:',await w.$$eval('#rpStage table.st tbody tr',e=>e.map(r=>[...r.cells].map(c=>c.textContent.trim()).join(' ')).join('\n   ')));
await w.screenshot({path:S+'/rp_students.png'});
await w.click('#rpStage .tabs [data-t="activities"]');await w.waitForTimeout(400);log('activity cards:',(await w.$$('#rpStage .acard')).length,'thumbs:',(await w.$$('#rpStage .thumbs img')).length);await w.screenshot({path:S+'/rp_acts.png'});
// a phone quiz report
await w.evaluate(()=>HBRP.addQuiz('Cells quiz',{questions:[{q:'Powerhouse?',o:['Nucleus','Mito'],a:1},{q:'Wall?',o:['Cellulose','Chitin'],a:0}],players:[{name:'Sara',score:1900,ans:[{c:1,ok:true,ms:3000},{c:0,ok:true,ms:4000}]},{name:'Omar',score:950,ans:[{c:1,ok:true,ms:5000},{c:1,ok:false,ms:6000}]}]}));
await w.evaluate(()=>HBRP.open());await w.waitForTimeout(800);log('list after quiz:',(await w.$$eval('#rpStage .rp-item b',e=>e.map(x=>x.textContent))).join(' | '));
// exports: build the workbook and CSV in the page and save them for checking
const xl=await w.evaluate(async()=>{const id=(await HB.IDB.get('reports:index')).find(x=>x.kind==='live').id;const s=await HB.IDB.get('report:'+id);let blob=null;const orig=URL.createObjectURL;URL.createObjectURL=b=>{blob=b;return orig(b)};document.querySelector('#rpStage .rp-item:not(.on)')&&0;await HBRP.open(id);document.getElementById('rpXlsx').click();URL.createObjectURL=orig;const buf=new Uint8Array(await blob.arrayBuffer());let s2='';for(let i=0;i<buf.length;i+=8192)s2+=String.fromCharCode.apply(null,buf.subarray(i,i+8192));return btoa(s2)});
fs.writeFileSync(S+'/rp.xlsx',Buffer.from(xl,'base64'));
const csv=await w.evaluate(async()=>{let blob=null;const orig=URL.createObjectURL;URL.createObjectURL=b=>{blob=b;return orig(b)};document.getElementById('rpCsv').click();URL.createObjectURL=orig;return await blob.text()});fs.writeFileSync(S+'/rp.csv',csv);log('csv lines:',csv.trim().split('\n').length,'| header:',csv.split('\n')[0].slice(1,120));
// PDF through Electron's printer, like the button does (without the save dialog)
await w.evaluate(()=>HBRP._printLayout());
const pdfLen=await app.evaluate(async({BrowserWindow})=>{const win=BrowserWindow.getAllWindows()[0];const pdf=await win.webContents.printToPDF({printBackground:true,landscape:true,pageSize:'A4',margins:{marginType:'none'}});return pdf.toString('base64')});fs.writeFileSync(S+'/rp.pdf',Buffer.from(pdfLen,'base64'));
await w.evaluate(()=>HBRP._endPrint());log('pdf bytes:',Buffer.from(pdfLen,'base64').length);
log('ERRORS',errs);await br.close();await app.close();})().catch(e=>{console.log('FAIL',e.message.split('\n').slice(0,4).join(' | '));process.exit(1)});
