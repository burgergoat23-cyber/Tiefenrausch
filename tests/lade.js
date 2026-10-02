// Ladebildschirm beim Start: erscheint mit #lade (Tests überspringen ihn sonst), sperrt Eingaben, zeigt alle Szenen ohne Fehler und endet nach ~7 s.
const {chromium}=(()=>{try{return require('playwright')}catch(e){return require('/opt/node-tools/node_modules/playwright')}})();
let fail=0;const ok=(c,m)=>{console.log((c?'  OK  ':'  FAIL ')+m);if(!c)fail++;};
(async()=>{const b=await chromium.launch();const errs=[];
 for(const [w,h] of [[820,1180],[844,390]]){const p=await (await b.newContext({viewport:{width:w,height:h}})).newPage();p.on('pageerror',e=>errs.push(e.message));
  await p.goto('file://'+process.cwd()+'/cur.html#lade');await p.waitForTimeout(600);
  const a=await p.evaluate(()=>{const o={t:loadT,n:LSC.length};let e='';for(let i=0;i<LSC.length;i++)for(let j=0;j<TIPS.length;j++){LDS.sc=LSC[i];LDS.tip=TIPS[j];try{draw();}catch(x){e=x.message;}}o.e=e||errT;return o;});
  ok(a.t>5&&a.t<=7,w+'x'+h+': Ladebildschirm läuft beim Start ('+a.t.toFixed(1)+' s übrig)');ok(!a.e,'alle '+a.n+' Szenen und Tipps zeichnen ohne Fehler '+(a.e||''));
  await p.mouse.click(w/2,h/2);await p.keyboard.press('Enter');
  ok(await p.evaluate(()=>st==='ready'&&loadT>0),'Tippen/Enter starten während des Ladens kein Spiel');
  await p.waitForTimeout(7000);const c=await p.evaluate(()=>({t:loadT,st}));ok(c.t===0&&c.st==='ready','nach ~7 s erscheint das Titelbild');}
 const p=await (await b.newContext()).newPage();await p.goto('file://'+process.cwd()+'/cur.html');await p.waitForTimeout(300);
 ok(await p.evaluate(()=>loadT===0),'ohne #lade (Testprogramme) wird er übersprungen');
 ok(errs.length===0,'keine JS-Fehler '+errs.join(' | '));
 console.log(fail?'FEHLGESCHLAGEN ('+fail+')':'BESTANDEN');await b.close();process.exit(fail?1:0);})();
