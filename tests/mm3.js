const {chromium}=require('playwright');const S=process.argv[2];
(async()=>{const b=await chromium.launch();const c=await b.newContext({viewport:{width:1366,height:768},hasTouch:true});await c.addInitScript(()=>{localStorage['hb:accSkip']='true'});const p=await c.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
await p.goto('file:///home/user/helixboard/dist/index.html?nointro');await p.waitForTimeout(1500);await p.evaluate(()=>HBUI.addPage());
const tree=()=>p.evaluate(()=>{const all=HBE.page().objs.filter(o=>o.nd);const r=all.find(o=>o.root);const t=n=>(n.s||'∅')+(all.some(k=>k.par===n.id)?'['+all.filter(k=>k.par===n.id).sort((a,b)=>a.ord-b.ord).map(t).join(',')+']':'');return r?t(r):'none'});
const overl=()=>p.evaluate(()=>{const a=HBE.page().objs.filter(o=>o.nd&&!o.off);let n=0;for(let i=0;i<a.length;i++)for(let j=i+1;j<a.length;j++){const A=a[i],B=a[j];if(A.x<B.x+B.w&&A.x+A.w>B.x&&A.y<B.y+B.h&&A.y+A.h>B.y)n++;}return n});
const at=s=>p.evaluate(s=>{const o=HBE.page().objs.find(o=>o.nd&&o.s===s);const r=document.getElementById('cvLive').getBoundingClientRect();const [x,y]=HBE.toS(o.x+o.w/2,o.y+o.h/2);return [r.left+x,r.top+y]},s);
const barCovers=()=>p.evaluate(()=>{const b=document.getElementById('mmBar');if(!b)return 'no bar';const r=b.getBoundingClientRect();const st=document.getElementById('stage').getBoundingClientRect();return HBE.page().objs.filter(o=>o.nd&&!o.off).filter(o=>{const x=st.left+o.x*HBE.V.s+HBE.V.x,y=st.top+o.y*HBE.V.s+HBE.V.y,w=o.w*HBE.V.s,h=o.h*HBE.V.s;return r.left<x+w&&r.right>x&&r.top<y+h&&r.bottom>y}).map(o=>o.s).join()||'none'});
// keyboard flow
await p.evaluate(()=>HBMM.open());await p.waitForTimeout(300);await p.click('[data-t="Blank map"]');await p.waitForTimeout(500);
await p.keyboard.type('Cells');await p.keyboard.press('Tab');await p.waitForTimeout(250);await p.keyboard.type('Organelles');await p.keyboard.press('Enter');await p.waitForTimeout(250);await p.keyboard.type('Membrane');await p.keyboard.press('Tab');await p.waitForTimeout(250);await p.keyboard.type('Phospholipid');await p.keyboard.press('Escape');await p.waitForTimeout(400);
console.log('1 keyboard:',await tree(),'| overlaps',await overl(),'| bar covers',await barCovers());
// mouse: click Organelles (bar of Phospholipid must not cover it)
await p.evaluate(()=>HBI.setTool('select'));let q=await at('Organelles');await p.mouse.click(q[0],q[1]);await p.waitForTimeout(300);
console.log('2 clicked Organelles → selected:',await p.evaluate(()=>HBI.selObjs().map(o=>o.s).join()),'| bar covers',await barCovers());
await p.click('#mmPlus button:not(.sib)');await p.waitForTimeout(300);await p.keyboard.type('Nucleus');await p.keyboard.press('Enter');await p.waitForTimeout(250);await p.keyboard.type('Ribosome');await p.keyboard.press('Escape');await p.waitForTimeout(300);
console.log('  before click: sel',await p.evaluate(()=>HBI.selObjs().map(o=>o.s).join()),'editing',await p.evaluate(()=>!!HBI.editing));q=await at('Nucleus');console.log('  under Nucleus:',await p.evaluate(([x,y])=>{const el=document.elementFromPoint(x,y);return (el.closest('[id]')||{}).id+' '+el.tagName+' '+(el.title||'')},q));await p.mouse.click(q[0],q[1]);await p.waitForTimeout(250);console.log('  after click sel',await p.evaluate(()=>HBI.selObjs().map(o=>o.s).join()));await p.click('#mmBar [data-a="child"]');await p.waitForTimeout(250);await p.keyboard.type('DNA');await p.keyboard.press('Tab');await p.waitForTimeout(250);await p.keyboard.type('Genes');await p.keyboard.press('Escape');await p.waitForTimeout(300);
console.log('3 plus+bar:',await tree(),'| overlaps',await overl());
// root left-side plus
q=await at('Cells');await p.mouse.click(q[0],q[1]);await p.waitForTimeout(250);const hs=await p.$$('#mmPlus button');console.log('root handles',hs.length);await hs[1].click();await p.waitForTimeout(250);await p.keyboard.type('Tissues');await p.keyboard.press('Escape');await p.waitForTimeout(300);
console.log('4 left side:',await p.evaluate(()=>{const o=HBE.page().objs.find(o=>o.nd&&o.s==='Tissues');return o&&o.side}),'overlaps',await overl());
// empty new node removed
q=await at('Tissues');await p.mouse.click(q[0],q[1]);await p.waitForTimeout(200);await p.keyboard.press('Tab');await p.waitForTimeout(300);await p.keyboard.press('Escape');await p.waitForTimeout(300);
console.log('5 empty child after Esc removed:',!(await tree()).includes('∅'),await tree());
// undo once removes a typed child
const before=await tree();q=await at('Tissues');await p.mouse.click(q[0],q[1]);await p.waitForTimeout(200);await p.keyboard.press('Tab');await p.waitForTimeout(300);await p.keyboard.type('Epithelial');await p.keyboard.press('Escape');await p.waitForTimeout(300);
await p.evaluate(()=>HBE.undo());await p.waitForTimeout(200);const mid=await tree();await p.evaluate(()=>HBE.undo());await p.waitForTimeout(200);console.log('6 undo: after 1 →',mid===before?'child gone':'text undone: '+mid,'| after 2 →',(await tree())===before?'child gone':await tree());
await p.evaluate(()=>HBE.redo());await p.evaluate(()=>HBE.redo());
// arrows
q=await at('Organelles');await p.mouse.click(q[0],q[1]);await p.waitForTimeout(200);await p.keyboard.press('ArrowRight');const r1=await p.evaluate(()=>HBI.selObjs()[0].s);await p.keyboard.press('ArrowDown');const r2=await p.evaluate(()=>HBI.selObjs()[0].s);await p.keyboard.press('ArrowLeft');const r3=await p.evaluate(()=>HBI.selObjs()[0].s);
console.log('7 arrows: right→',r1,' down→',r2,' left→',r3);
// pen tool: tap selects, double tap edits, drag moves branch, no ink
await p.evaluate(()=>{HBI.clearSel();HBI.setTool('draw')});const n0=await p.evaluate(()=>HBE.page().objs.filter(o=>o.t==='stroke').length);q=await at('Membrane');
await p.mouse.click(q[0],q[1]);await p.waitForTimeout(600);console.log('8 pen tap → selected',await p.evaluate(()=>HBI.selObjs().map(o=>o.s).join()),'bar',await p.evaluate(()=>!!document.getElementById('mmBar')),'strokes added',await p.evaluate(n=>HBE.page().objs.filter(o=>o.t==='stroke').length-n,n0));
const kidBefore=await p.evaluate(()=>{const o=HBE.page().objs.find(o=>o.nd&&o.s==='Phospholipid');return [o.x,o.y]});
await p.mouse.move(q[0],q[1]);await p.mouse.down();await p.mouse.move(q[0]+60,q[1]+90,{steps:6});await p.mouse.up();await p.waitForTimeout(300);
const kidAfter=await p.evaluate(()=>{const o=HBE.page().objs.find(o=>o.nd&&o.s==='Phospholipid');return [o.x,o.y]});console.log('9 pen drag moves branch: child delta',Math.round(kidAfter[0]-kidBefore[0]),Math.round(kidAfter[1]-kidBefore[1]),'strokes',await p.evaluate(n=>HBE.page().objs.filter(o=>o.t==='stroke').length-n,n0));
q=await at('Membrane');await p.mouse.click(q[0],q[1]);await p.waitForTimeout(100);await p.mouse.click(q[0],q[1]);await p.waitForTimeout(300);console.log('10 pen double tap edits:',await p.evaluate(()=>!!HBI.editing));await p.keyboard.press('Escape');
// pen still draws on empty board
const ep=await p.evaluate(()=>{const st=document.getElementById('stage').getBoundingClientRect();return [st.left+st.width*0.5,st.top+70]});console.log('  draw at',ep.map(Math.round),await p.evaluate(([x,y])=>{const e=document.elementFromPoint(x,y);return e.id||e.tagName},ep));await p.mouse.move(ep[0],ep[1]);await p.mouse.down();await p.mouse.move(ep[0]+90,ep[1]+20,{steps:5});await p.mouse.up();await p.waitForTimeout(200);console.log('11 pen on empty space still writes:',await p.evaluate(n=>HBE.page().objs.filter(o=>o.t==='stroke').length-n,n0));
// down layout + plus
await p.evaluate(()=>{HBI.setTool('select');HBI.select(HBE.page().objs.find(o=>o.root))});await p.waitForTimeout(200);await p.click('#mmBar [data-a="layout"]');await p.click('[data-l="down"]');await p.waitForTimeout(300);console.log('12 down overlaps',await overl());
await p.screenshot({path:S+'/mm3.png'});
q=await at('Genes');await p.mouse.click(q[0],q[1]);await p.waitForTimeout(300);await p.screenshot({path:S+'/mm3_sel.png'});
console.log('errs',errs);await b.close();})();
