const {chromium}=(()=>{try{return require('playwright')}catch(e){return require('/opt/node-tools/node_modules/playwright')}})();
(async()=>{const b=await chromium.launch();for(const [w,h] of [[375,667],[1024,768]]){const p=await (await b.newContext({viewport:{width:w,height:h},deviceScaleFactor:2,hasTouch:true})).newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
 await p.goto('file://'+process.cwd()+'/cur.html');await p.waitForTimeout(500);await p.screenshot({path:'title_'+w+'.png'});
 const r=await p.evaluate(()=>{const bt=btns.find(b=>{try{return 1}catch(e){}});return null;});
 // Knopf "Ranglisten" antippen: in btns suchen über Klickfläche ist schwer -> Funktion direkt prüfen
 await p.evaluate(()=>{for(const b of btns){const s=b.fn.toString();if(s.includes('topLoad(1)')&&s.includes('lt:1')){b.fn();break;}}});await p.waitForTimeout(400);
 console.log(w,JSON.stringify(await p.evaluate(()=>bk)),errs);await p.screenshot({path:'rl_'+w+'.png'});}await b.close();})();
