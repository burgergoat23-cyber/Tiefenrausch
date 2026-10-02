const {chromium}=(()=>{try{return require('playwright')}catch(e){return require('/opt/node-tools/node_modules/playwright')}})();
(async()=>{const b=await chromium.launch();
 for(const f of ['cur.html']){const p=await (await b.newContext({viewport:{width:800,height:560},deviceScaleFactor:2})).newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
  await p.goto('file://'+process.cwd()+'/'+f);await p.waitForTimeout(500);if(await p.isVisible('#bg'))await p.click('#bg');await p.waitForTimeout(300);
  // fremden Skriptfehler simulieren (wie Firebase auf gstatic.com)
  await p.evaluate(()=>{dispatchEvent(new ErrorEvent('error',{message:'Script error.',filename:''}));});
  await p.waitForTimeout(150);const shown=await p.evaluate(()=>errT);
  // eigenen Fehler anzeigen lassen (Banner), dann prüfen ob Bild noch voll ist
  await p.evaluate(()=>{errT='Testfehler';});await p.waitForTimeout(400);
  await p.screenshot({path:f+'-dpr.png'});
  const tf=await p.evaluate(()=>{const m=g.getTransform();return m.a;});
  console.log(f,'Script-error angezeigt:',JSON.stringify(shown),'Maßstab nach Fehler:',tf,'(soll 2)',errs);}
 await b.close();})();
