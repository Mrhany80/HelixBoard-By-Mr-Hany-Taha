const {chromium}=require('playwright');const S=process.argv[2];const log=(...a)=>console.log(...a);
(async()=>{const b=await chromium.launch();const c=await b.newContext({viewport:{width:1600,height:900}});await c.addInitScript(()=>{localStorage['hb:accSkip']='true'});const p=await c.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));p.on('dialog',d=>d.accept('produces'));
await p.goto('file:///home/user/helixboard/dist/index.html?nointro');await p.waitForTimeout(1500);
await p.evaluate(()=>HBMM.open());await p.waitForTimeout(300);await p.click('#sheet [data-t="Cellular respiration"]');await p.waitForTimeout(600);
const cnt=()=>p.evaluate(()=>({nodes:HBE.page().objs.filter(o=>o.nd).length,branches:HBE.page().objs.filter(o=>o.t==='conn'&&o.tree).length,links:HBE.page().objs.filter(o=>o.t==='conn'&&o.mm&&!o.tree).length,hidden:HBE.page().objs.filter(o=>o.nd&&o.off).length}));
log('template:',JSON.stringify(await cnt()),'bar:',!!(await p.$('#mmBar')));
await p.screenshot({path:S+'/mm_1.png'});
// select "Produces" node and press Tab, type
const id=await p.evaluate(()=>{const n=HBE.page().objs.find(o=>o.nd&&o.s==='Produces');HBI.select(n);return n.id});await p.waitForTimeout(200);
await p.keyboard.press('Tab');await p.waitForTimeout(200);await p.keyboard.type('Heat energy');await p.keyboard.press('Enter');await p.waitForTimeout(200);await p.keyboard.type('NADH');await p.keyboard.press('Escape');await p.waitForTimeout(300);
log('after Tab+Enter:',JSON.stringify(await cnt()),'texts under Produces:',await p.evaluate(id=>HBE.page().objs.filter(o=>o.nd&&o.par===id).map(o=>o.s).join(','),id));
// overlaps?
log('overlaps:',await p.evaluate(()=>{const n=HBE.page().objs.filter(o=>o.nd&&!o.off);let k=0;for(let i=0;i<n.length;i++)for(let j=i+1;j<n.length;j++){const a=n[i],b=n[j];if(a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y)k++;}return k}));
// fold
await p.evaluate(id=>HBI.select(HBE.byId(id)),id);await p.waitForTimeout(200);await p.click('#mmBar [data-a="fold"]');await p.waitForTimeout(300);log('folded:',JSON.stringify(await cnt()));await p.click('#mmBar [data-a="fold"]');await p.waitForTimeout(300);
// link Needs -> ATP
await p.evaluate(()=>HBI.select(HBE.page().objs.find(o=>o.nd&&o.s==='Glucose')));await p.waitForTimeout(150);await p.click('#mmBar [data-a="link"]');await p.evaluate(()=>HBI.select(HBE.page().objs.find(o=>o.nd&&o.s==='ATP')));await p.waitForTimeout(300);await p.fill('#mmLinkW','produces');await p.click('#mmLinkY');await p.waitForTimeout(300);log('links:',JSON.stringify(await cnt()));
// drag a level-1 node: its branch should follow
const before=await p.evaluate(id=>{const n=HBE.byId(id);const k=HBE.page().objs.find(o=>o.par===id);return [n.x,n.y,k.x,k.y]},id);
await p.evaluate(()=>HBI.setTool('select'));await p.evaluate(id=>HBI.select(HBE.byId(id)),id);const [sx,sy]=await p.evaluate(id=>{const n=HBE.byId(id);const r=document.getElementById('stage').getBoundingClientRect();const s=HBE.toS(n.x+n.w/2,n.y+n.h/2);return [r.left+s[0],r.top+s[1]]},id);
await p.mouse.move(sx,sy);await p.mouse.down();await p.mouse.move(sx+60,sy+90,{steps:6});await p.mouse.up();await p.waitForTimeout(300);
const after=await p.evaluate(id=>{const n=HBE.byId(id);const k=HBE.page().objs.find(o=>o.par===id);return [n.x,n.y,k.x,k.y]},id);
log('drag parent delta',after[0]-before[0],after[1]-before[1],'child delta',after[2]-before[2],after[3]-before[3]);
await p.screenshot({path:S+'/mm_2.png'});
// layout down + undo
await p.click('#mmBar [data-a="layout"]');await p.click('#mmPop [data-l="down"]');await p.waitForTimeout(400);await p.evaluate(()=>{const n=HBE.page().objs.find(o=>o.root);HBI.select(n)});await p.click('#mmBar [data-a="fit"]');await p.waitForTimeout(300);await p.screenshot({path:S+'/mm_down.png'});
// outline
await p.evaluate(()=>HBMM.open());await p.fill('#mmO','Enzymes\n  Structure\n    Active site\n    Substrate\n  Factors\n    Temperature\n    pH');await p.click('#mmGo');await p.waitForTimeout(400);
log('outline maps:',await p.evaluate(()=>new Set(HBE.page().objs.filter(o=>o.nd).map(o=>o.mm)).size));
log('errs',errs);await b.close();})();
