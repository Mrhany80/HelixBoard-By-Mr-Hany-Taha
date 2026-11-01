const {chromium}=require('playwright');const fs=require('fs');const S=process.argv[2];
(async()=>{const b=await chromium.launch();const c=await b.newContext({viewport:{width:1400,height:850}});await c.addInitScript(()=>{localStorage['hb:accSkip']='true'});const p=await c.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
await p.goto('file:///home/user/helixboard/dist/index.html?nointro');await p.waitForTimeout(1500);
const b64=fs.readFileSync(S+'/anim.pptx').toString('base64');
await p.evaluate(b64=>{const u=Uint8Array.from(atob(b64),c=>c.charCodeAt(0));HBIO.importPptx(new File([u],'anim.pptx'));},b64);
await p.waitForSelector('#ppGo',{timeout:20000});console.log('anim option:',await p.textContent('label:has(#ppAnim)').catch(()=>'none'));
await p.click('#ppGo');await p.waitForFunction(()=>HBE.page().deck,null,{timeout:120000});await p.waitForTimeout(800);
const info=await p.evaluate(()=>{const o=HBE.page().objs;return {imgs:o.filter(x=>x.t==='img').length,steps:o.filter(x=>x.step).map(x=>x.step)}});console.log('objects',JSON.stringify(info));
await p.keyboard.press('F5');await p.waitForTimeout(1500);
for(let k=0;k<7;k++){await p.screenshot({path:S+'/an_'+k+'.png'});console.log('step',k,await p.textContent('#shCnt'));await p.keyboard.press('ArrowRight');await p.waitForTimeout(700);}
await p.keyboard.press('ArrowLeft');await p.waitForTimeout(600);console.log('back:',await p.textContent('#shCnt'));
console.log('errs',errs);await b.close();})();
