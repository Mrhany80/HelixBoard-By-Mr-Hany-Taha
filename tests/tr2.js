const {chromium}=require('playwright');const fs=require('fs');const S=process.argv[2];
(async()=>{const b=await chromium.launch();const c=await b.newContext({viewport:{width:1400,height:850},deviceScaleFactor:1});await c.addInitScript(()=>{localStorage['hb:accSkip']='true'});const p=await c.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
await p.goto('file:///home/user/helixboard/dist/index.html?nointro');await p.waitForTimeout(1500);
const b64=fs.readFileSync(S+'/trans.pptx').toString('base64');
await p.evaluate(b64=>{const u=Uint8Array.from(atob(b64),c=>c.charCodeAt(0));HBIO.importPptx(new File([u],'trans.pptx'));},b64);
await p.waitForSelector('#ppGo',{timeout:30000});console.log('options:',(await p.evaluate(()=>[...document.querySelectorAll('.pprow label')].map(l=>l.textContent.trim()).join(' | '))),'| quality:',await p.$eval('#ppQ',s=>s.value));
await p.click('#ppGo');await p.waitForFunction(()=>HBE.page().deck,null,{timeout:180000});await p.waitForTimeout(800);
const info=await p.evaluate(()=>{const d=HBE.page().deck;const im=HBE.page().objs.find(o=>o.t==='img');const a=new Image();return {trans:d.trans,tr:d.slides.slice(0,5).map(s=>s.tr&&(s.tr.k+':'+s.tr.dir+':'+s.tr.dur+':'+s.tr.adv)),len:(HBE.B&&HBE.B.assets[im.asset]||'').length}});console.log(JSON.stringify(info));
const dims=await p.evaluate(()=>new Promise(r=>{const im=HBE.page().objs.find(o=>o.t==='img');const a=new Image();a.onload=()=>r(a.width+'x'+a.height);a.src=HBE.B.assets[im.asset];}));console.log('slide image',dims);
await p.keyboard.press('F5');await p.waitForTimeout(1500);
for(let k=0;k<4;k++){await p.keyboard.press('ArrowRight');await p.waitForTimeout(150);const ov=await p.evaluate(()=>{const o=document.getElementById('dkTr');return o?{op:getComputedStyle(o).opacity,tf:o.style.transform,clip:o.style.clipPath,extra:document.querySelectorAll('#stage > div[style*="background:#000"], #dkTr ~ canvas').length}:null});console.log('→ slide',k+2,JSON.stringify(ov));await p.screenshot({path:S+'/tr2_'+k+'.png'});await p.waitForTimeout(1400);}
const before=await p.textContent('#shCnt');await p.waitForTimeout(3600);console.log('auto advance:',before,'→',await p.textContent('#shCnt'));
console.log('errs',errs);await b.close();})();
