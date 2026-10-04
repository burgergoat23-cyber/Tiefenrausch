// Dorf-Steuerung (◀ ▶ halten, Aktion per Taste, Dorfkarte), Betreten-Szene (Tür → Innenraum → Menü → wieder heraus), Skin-Effekte.
// Aufruf: node tests/steuerung.js
const {chromium}=(()=>{try{return require('playwright')}catch(e){return require('/opt/node-tools/node_modules/playwright')}})();
const path=require('path');
const F='file://'+path.join(__dirname,'cur.html');
let fail=0;const ok=(c,m)=>{console.log((c?'  OK  ':'  FAIL ')+m);if(!c)fail++;};
const clock=d=>{const T=new Date(d).getTime(),D=Date;window.Date=class extends D{constructor(...a){super(...(a.length?a:[T]));}static now(){return T;}};};
(async()=>{const b=await chromium.launch();const errs=[];
 for(const vp of [{width:820,height:1180},{width:844,height:390}]){const tag=vp.width+'x'+vp.height;
  const ctx=await b.newContext({viewport:vp,hasTouch:true,isMobile:true});await ctx.addInitScript(clock,'2026-10-20T12:00:00+02:00');const p=await ctx.newPage();p.on('pageerror',e=>errs.push(e.message));
  await p.goto(F+'#dorf');await p.waitForTimeout(900);await p.evaluate(()=>{meta.nws=99;});await p.waitForTimeout(200);
  // ▶ gedrückt halten
  const r=await p.evaluate(()=>{draw();return VL.ctl&&{x:VL.ctl.r.x+VL.ctl.r.w/2,y:VL.ctl.r.y+VL.ctl.r.h/2,x0:VL.x};});
  ok(!!r,tag+': Touch-Knöpfe ◀ ▶ sind da');
  if(r){await p.mouse.move(r.x,r.y);await p.mouse.down();await p.waitForTimeout(700);await p.mouse.up();const x1=await p.evaluate(()=>VL.x);ok(x1>r.x0+60,tag+': ▶ gedrückt halten läuft nach rechts ('+Math.round(x1-r.x0)+')');}
  // Dorfkarte: Symbol antippen → Held läuft hin
  const m=await p.evaluate(()=>{draw();const L=vLay(),k=uiOn?uiS:1,b=L.B.find(q=>q.k==='buch'),mx0=SI.l/k+16,mw=W-SI.r/k-16-mx0,my=H-SI.b/k-8-24;return{x:(mx0+b.x/L.WW*mw)*k,y:(my+11)*k,bx:b.x};});
  await p.mouse.click(m.x,m.y);await p.waitForTimeout(150);ok(await p.evaluate(bx=>VL.tx===bx||Math.abs(VL.x-bx)<5,m.bx),tag+': Dorfkarte antippen → Held läuft zur Bibliothek');
  // Enter startet im Dorf kein Spiel mehr; E vor der Tür betritt das Gebäude (Szene)
  await p.evaluate(()=>{const b=vBld().B.find(q=>q.k==='shop');VL.x=b.x;VL.cam=-1;VL.tx=null;});await p.waitForTimeout(100);
  await p.keyboard.press('Enter');await p.waitForTimeout(200);const s0=await p.evaluate(()=>({st,sc:VL.sc&&VL.sc.k}));
  ok(s0.st==='ready'&&s0.sc==='shop',tag+': Enter vor dem Laden startet die Betreten-Szene (kein Spielstart) '+JSON.stringify(s0));
  await p.waitForTimeout(1000);const s1=await p.evaluate(()=>({ph:VL.sc&&VL.sc.ph,shp:!!shp}));ok(s1.ph===1&&!s1.shp,tag+': Innenraum mit Begrüßung, Menü noch zu '+JSON.stringify(s1));
  for(let i=0;i<50&&!(await p.evaluate(()=>!!shp));i++)await p.waitForTimeout(100);ok(await p.evaluate(()=>shp&&shp.tab===0&&VL.sc&&VL.sc.ph===2),tag+': danach öffnet der Shop');
  await p.evaluate(()=>{shp=null;});await p.waitForTimeout(150);ok(await p.evaluate(()=>VL.sc&&VL.sc.ph===3),tag+': Shop zu → Held kommt wieder heraus');
  await p.waitForTimeout(800);ok(await p.evaluate(()=>!VL.sc),tag+': Szene beendet');
  // Antippen überspringt die Szene
  await p.evaluate(()=>{const b=vBld().B.find(q=>q.k==='buch');VL.x=b.x;VL.cam=-1;vEnter('buch');});await p.waitForTimeout(250);
  await p.mouse.click(vp.width/2,vp.height/2);await p.waitForTimeout(150);ok(await p.evaluate(()=>bk&&bk.tab===0),tag+': Antippen überspringt → Bestiarium offen');
  await p.evaluate(()=>{bk=null;});await p.waitForTimeout(800);
  // Portal: Tunnel, dann Spielmodi
  await p.evaluate(()=>{const b=vBld().B.find(q=>q.k==='tor');VL.x=b.x;VL.cam=-1;vEnter('tor');});for(let i=0;i<40&&!(await p.evaluate(()=>vPanel==='tor'));i++)await p.waitForTimeout(100);
  ok(await p.evaluate(()=>vPanel==='tor'),tag+': Dungeon-Tor: Portal-Szene, dann Spielmodi');
  await p.screenshot({path:path.join(__dirname,'steuerung_'+vp.width+'.png')});await p.evaluate(()=>{vPanel=null;});await ctx.close();}
 // Skin-Effekte: alle Skins in der Vorschau zeichnen (Dorf, Dungeon, Shop) ohne Fehler
 {const ctx=await b.newContext({viewport:{width:1180,height:820}});const p=await ctx.newPage();p.on('pageerror',e=>errs.push(e.message));await p.goto(F);await p.waitForTimeout(700);
  const k=await p.evaluate(()=>{const fa=SKA.filter(s=>s.fx).length,fw=SKW.filter(s=>s.fx).length;newGame(undefined,'endless');for(let a=0;a<SKA.length;a++){SKO={a,w:a%SKW.length};for(let i=0;i<3;i++){tm+=.3;draw();heroPrev(200,200,1.5,a,a%SKW.length);wepPrev(300,200,1.4,a%SKW.length);}}SKO=null;return{fa,fw,n:SKA.length,m:SKW.length};});
  ok(k.fa===k.n-1&&k.fw===k.m-1,'jeder Skin außer Standard hat einen eigenen Effekt '+JSON.stringify(k));await ctx.close();}
 ok(errs.length===0,'keine JS-Fehler '+errs.join(' | '));
 console.log(fail?'FEHLGESCHLAGEN ('+fail+')':'ALLE OK');await b.close();process.exit(fail?1:0);})();
