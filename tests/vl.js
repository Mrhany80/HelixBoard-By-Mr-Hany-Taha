const {_electron,chromium}=require('playwright');const S=process.argv[2];const log=(...a)=>console.log(...a);
(async()=>{const app=await _electron.launch({executablePath:'/home/user/helixboard/desktop/node_modules/electron/dist/electron',args:['--no-sandbox','/home/user/helixboard/desktop'],env:Object.assign({},process.env,{HB_CLOUDFLARED:S+'/fake-cloudflared'})});
const w=await app.firstWindow();await w.waitForLoadState();await w.evaluate(()=>{localStorage['hb:accSkip']='true';localStorage['hb:askSession']='false';localStorage['hb:introEvery']='false';localStorage['hb:seenIntro']='true';Object.keys(localStorage).filter(k=>k.startsWith('hb:vl:')).forEach(k=>localStorage.removeItem(k));});await w.reload();const errs=[];w.on('pageerror',e=>errs.push('T:'+e.message));
await w.waitForTimeout(3000);await w.evaluate(()=>HB.modal.close());
// open from Study tab
await w.click('[data-st="study"]');await w.waitForTimeout(300);log('over:',await w.evaluate(()=>{const b=document.querySelector('.subchip[data-sub="live"]');const r=b.getBoundingClientRect();let e=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);const o=[];while(e&&o.length<4){o.push(e.id||e.className||e.tagName);e=e.parentElement}return o.join('<')}));await w.evaluate(()=>document.querySelector('.subchip[data-sub="live"]').click());await w.waitForTimeout(300);
const b64=require('fs').readFileSync(S+'/lesson_s.mp4').toString('base64');await w.evaluate(()=>{HTMLInputElement.prototype.click=function(){}});await w.evaluate(()=>document.querySelector('[data-id="lc_video"]').click());await w.waitForTimeout(500);await w.evaluate(b64=>{const u=Uint8Array.from(atob(b64),c=>c.charCodeAt(0));HBVL.load(new File([u],'Cells lesson.mp4',{type:'video/mp4'}));},b64);await w.waitForTimeout(2000);
log('stage:',!!(await w.$('#vlStage')),'duration:',await w.evaluate(()=>document.getElementById('vlV').duration));
// add a poll at 3s and a text question at 6s and a draw at 9s
const addQ=async(t,type,prompt,opts)=>{await w.evaluate(t=>{document.getElementById('vlV').currentTime=t},t);await w.waitForTimeout(400);await w.click('#vlAdd');await w.waitForTimeout(300);await w.click('#sheet [data-k="'+type+'"]');await w.fill('#vlqP',prompt);if(opts){for(let i=0;i<opts.length;i++)await w.fill('[data-o="'+i+'"]',opts[i]);await w.check('[data-c="1"]');}await w.click('#vlqOk');await w.waitForTimeout(300);};
await addQ(3,'poll','Which colour bar is on the left?',['Grey','White','Red','Blue']);await addQ(6,'text','What do you notice?');await addQ(9,'draw','Circle the moving parts');
log('questions:',(await w.$$('#vlStage .vl-q')).length,'markers:',(await w.$$('#vlStage .vl-tl .mk')).length);
await w.screenshot({path:S+'/vl_edit.png'});
// no phones: play from 1s, should stop at 3 and show on-screen card
await w.evaluate(()=>{const v=document.getElementById('vlV');v.currentTime=1;});await w.waitForTimeout(300);await w.click('#vlPlay');await w.waitForTimeout(3500);
log('paused at:',(await w.evaluate(()=>document.getElementById('vlV').currentTime)).toFixed(2),'card:',!!(await w.$('#vlQ')));
await w.click('#vlqReveal');await w.waitForTimeout(300);log('revealed right:',!!(await w.$('#vlQ .opt.right')));await w.screenshot({path:S+'/vl_card.png'});
await w.click('#vlqGo');await w.waitForTimeout(400);log('dbg',JSON.stringify(await w.evaluate(async()=>{const v=document.getElementById('vlV');let err=null;try{await v.play()}catch(e){err=e.message}return {paused:v.paused,t:v.currentTime,err,ready:v.readyState,ended:v.ended}})));log('playing again:',!(await w.evaluate(()=>document.getElementById('vlV').paused)));
await w.evaluate(()=>document.getElementById('vlV').pause());
// with phones
await w.evaluate(()=>HBCL.start({quiet:true}));await w.waitForTimeout(2500);const sn=await w.evaluate(()=>helixDesktop.cl.cmd('snapshot'));const base='http://localhost:'+sn.port+'/?pin='+sn.pin;
const br=await chromium.launch();const ph=[];for(const n of ['Sara','Omar','Lina']){const c=await br.newContext({viewport:{width:390,height:800},isMobile:true,hasTouch:true});const p=await c.newPage();p.on('pageerror',e=>errs.push(n+':'+e.message));await p.goto(base);await p.fill('input[placeholder="Your full name"]',(n)+' Test');await p.click('.go');ph.push(p);}
await w.waitForTimeout(4000);
await w.evaluate(()=>{const v=document.getElementById('vlV');v.currentTime=8;});await w.waitForTimeout(400);await w.click('#vlPlay');await w.waitForTimeout(2500);
log('dashboard after stop:',await w.evaluate(()=>{const s=document.getElementById('lcStage');return !!s&&!s.hidden}),'type:',await w.textContent('#lcStage .lc-type').catch(()=>'-'));
log('phone shows:',await ph[0].textContent('#actRoot .prompt').catch(()=>'-'),'bg frame:',!!(await ph[0].$('.pad img')));
for(const p of ph){const b=await p.$('.pad canvas');const r=await b.boundingBox();await p.mouse.move(r.x+50,r.y+50);await p.mouse.down();await p.mouse.move(r.x+200,r.y+120,{steps:6});await p.mouse.up();}
await w.waitForTimeout(1500);log('tiles:',(await w.$$('#lcStage .lc-tile')).length);await w.screenshot({path:S+'/vl_phones.png'});
await w.click('#lcCont');await w.waitForTimeout(800);log('continue -> playing:',!(await w.evaluate(()=>document.getElementById('vlV').paused)),'lc hidden:',await w.evaluate(()=>document.getElementById('lcStage').hidden),'phone:',await ph[0].textContent('#actRoot').catch(()=>'-'));
// save .hbvid
const [dl]=await Promise.all([w.waitForEvent('download',{timeout:3000}).catch(()=>null),w.click('#vlSave')]);log('save:',dl?dl.suggestedFilename():'(save dialog)');
log('ERRORS',errs);await br.close();await app.close();})().catch(e=>{console.log('FAIL',e.message.split('\n').slice(0,4).join(' | '));process.exit(1)});
