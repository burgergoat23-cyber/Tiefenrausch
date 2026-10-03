// CrazyGames-Version: baut die Datei, ersetzt das SDK durch eine Attrappe und prüft Ablauf + Oberfläche.
// Aufruf: node tests/crazy.js   (aus dem Repo-Ordner)
const {chromium}=(()=>{try{return require('playwright')}catch(e){return require('/opt/node-tools/node_modules/playwright')}})();
const {execSync}=require('child_process'),path=require('path'),os=require('os'),fs=require('fs');
const out=fs.mkdtempSync(path.join(os.tmpdir(),'cg-'));execSync('python3 '+path.join(__dirname,'..','tools','build_crazygames.py')+' '+out);
let fail=0;const ok=(c,m)=>{console.log((c?'  OK  ':'  FAIL ')+m);if(!c)fail++;};
const MOCK=`window.CrazyGames={SDK:{init:()=>Promise.resolve(),environment:'crazygames',game:{
  loadingStart:()=>window.__cg.push('loadingStart'),loadingStop:()=>window.__cg.push('loadingStop'),
  gameplayStart:()=>window.__cg.push('gameplayStart'),gameplayStop:()=>window.__cg.push('gameplayStop'),happytime:()=>window.__cg.push('happytime')}}};window.__cg=[];`;
(async()=>{const b=await chromium.launch();const errs=[];
 for(const [w,h] of [[820,1180],[844,390],[1280,720]]){
  const ctx=await b.newContext({viewport:{width:w,height:h}});
  await ctx.route('https://sdk.crazygames.com/**',r=>r.fulfill({status:200,contentType:'text/javascript',body:MOCK}));
  const p=await ctx.newPage();p.on('pageerror',e=>errs.push(e.message));
  await p.goto('file://'+out+'/index.html#lade');await p.waitForTimeout(800);
  const a=await p.evaluate(()=>({CG,FB_ON,guest,lg:document.getElementById('lg').style.display,bo:document.getElementById('bo').style.display,load:loadT>0}));
  ok(a.CG&&!a.FB_ON&&a.guest,w+'x'+h+': CrazyGames-Modus, keine eigene Anmeldung, Gast');
  ok(a.lg!=='block'&&a.bo!=='block','kein Anmeldefenster, kein Fremd-Link');
  await p.waitForTimeout(4500);
  const t=await p.evaluate(()=>{draw();return{labels:btns.length,cg:window.__cg.slice(),koop:0}});
  const txt=await p.evaluate(()=>{const L=[];const o=CanvasRenderingContext2D.prototype.fillText;CanvasRenderingContext2D.prototype.fillText=function(s,...r){L.push(String(s));return o.call(this,s,...r);};draw();CanvasRenderingContext2D.prototype.fillText=o;return L.join('|');});
  ok(!/Koop|Co-op|Rangliste|Ranking|Anmelden|Log in|Beenden|Quit/.test(txt),'Titel ohne Koop/Ranglisten/Anmelden/Beenden');
  ok(t.cg[0]==='loadingStart'&&t.cg.includes('loadingStop'),'SDK: loadingStart -> loadingStop');
  await p.evaluate(()=>{newGame(undefined,'endless');});await p.waitForTimeout(300);
  await p.evaluate(()=>{ui={type:'menu'};});await p.waitForTimeout(200);
  await p.evaluate(()=>{ui=null;fl=3;gen();me.inv=999;const e=en.find(x=>x.boss);e.hp=1;me.x=e.x-20;me.y=e.y;me.fx=1;me.fy=0;});
  for(let i=0;i<20;i++){await p.evaluate(()=>{const e=en.find(x=>x.boss);if(e){e.hp=0;me.atk=0;try{heroAttack();}catch(x){} }});await p.waitForTimeout(60);}
  const c=await p.evaluate(()=>window.__cg.slice());
  ok(c.includes('gameplayStart')&&c.includes('gameplayStop'),'SDK: gameplayStart/Stop beim Spielen und im Pausemenü');
  ok(c.filter(x=>x==='gameplayStart').length>=2,'gameplayStart nach dem Pausemenü erneut');
  console.log('   Aufrufe:',c.join(', '));
  await p.screenshot({path:path.join(out,'cg_'+w+'.png')});await ctx.close();}
 // ohne SDK (z. B. blockiert): Spiel läuft trotzdem
 const ctx=await b.newContext();await ctx.route('https://sdk.crazygames.com/**',r=>r.abort());const p=await ctx.newPage();p.on('pageerror',e=>errs.push('ohneSDK: '+e.message));
 await p.goto('file://'+out+'/index.html');await p.waitForTimeout(600);await p.evaluate(()=>{newGame(undefined,'story');for(let i=0;i<30;i++){update(.016);draw();}});
 ok(await p.evaluate(()=>st==='play'),'ohne SDK spielbar');
 ok(errs.length===0,'keine JS-Fehler '+errs.join(' | '));console.log('Bilder in',out);
 console.log(fail?'FEHLGESCHLAGEN ('+fail+')':'BESTANDEN');await b.close();process.exit(fail?1:0);})();
