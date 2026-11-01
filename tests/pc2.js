const {chromium}=require('playwright');const S=process.argv[2];
(async()=>{const b=await chromium.launch({args:['--use-fake-ui-for-media-stream','--use-fake-device-for-media-stream','--use-file-for-fake-video-capture='+S+'/cards.y4m']});const c=await b.newContext({viewport:{width:1280,height:800}});await c.addInitScript(()=>{localStorage['hb:accSkip']='true';localStorage['hb:cardRoster:*']=JSON.stringify(['Sara Ali','Omar Hassan','Lina Adel','Youssef Nabil','Mona Samir'])});const p=await c.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
await p.goto('file:///home/user/helixboard/dist/index.html?nointro');await p.waitForTimeout(1500);
await p.evaluate(()=>{localStorage['hb:quizSets']=JSON.stringify({'Cells':[{q:'Powerhouse?',o:['Nucleus','Mitochondrion','Ribosome','Vacuole'],a:1,ex:''}]})});
await p.evaluate(()=>HBL.presentQuiz('Cells'));await p.waitForTimeout(800);await p.click('#qzScan');await p.waitForTimeout(3000);
console.log('scanner:',(await p.textContent('#pcScan .side')).replace(/\s+/g,' ').slice(0,200));await p.screenshot({path:S+'/pc_live.png'});
await p.click('#pcDone');await p.waitForTimeout(800);console.log('quiz after scan:',(await p.textContent('#qzBody')).replace(/\s+/g,' ').slice(0,200));
const rep=await p.evaluate(async()=>{await new Promise(r=>setTimeout(r,500));const ix=await HB.IDB.get('reports:index');return ix.slice(0,1).map(x=>x.title+' students '+x.students+' acc '+x.accuracy)});console.log('report',rep);
console.log('errs',errs);await b.close();})();
