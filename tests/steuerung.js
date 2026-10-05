// Dorf-Steuerung (◀ ▶ halten, Aktion per Taste, Dorfkarte), Betreten-Szene (Tür → Innenraum → Menü → wieder heraus), Skin-Effekte.
// Aufruf: node tests/steuerung.js
const {chromium}=(()=>{try{return require('playwright')}catch(e){return require('/opt/node-tools/node_modules/playwright')}})();
const path=require('path');
const F='file://'+path.join(__dirname,'cur.html');
let fail=0;const ok=(c,m)=>{console.log((c?'  OK  ':'  FAIL ')+m);if(!c)fail++;};
// warten, bis eine Bedingung im Spiel stimmt (robust, auch wenn der Rechner langsam ist)
const until=async(p,fn,ms,arg)=>{for(let t=0;t<ms;t+=100){if(await p.evaluate(fn,arg))return true;await new Promise(f=>setTimeout(f,100));}return await p.evaluate(fn,arg);};
const clock=d=>{const T=new Date(d).getTime(),D=Date;window.Date=class extends D{constructor(...a){super(...(a.length?a:[T]));}static now(){return T;}};};
(async()=>{const b=await chromium.launch();const errs=[];
 for(const vp of [{width:820,height:1180},{width:844,height:390}]){const tag=vp.width+'x'+vp.height;
  const ctx=await b.newContext({viewport:vp,hasTouch:true,isMobile:true});await ctx.addInitScript(clock,'2026-10-20T12:00:00+02:00');const p=await ctx.newPage();p.on('pageerror',e=>errs.push(e.message));
  await p.goto(F+'#dorf');await p.waitForTimeout(900);await p.evaluate(()=>{meta.nws=99;});await p.waitForTimeout(200);
  // ▶ gedrückt halten
  const r=await p.evaluate(()=>{draw();return VL.ctl&&{x:VL.ctl.r.x+VL.ctl.r.w/2,y:VL.ctl.r.y+VL.ctl.r.h/2,x0:VL.x};});
  ok(!!r,tag+': Touch-Knöpfe ◀ ▶ sind da');
  if(r){await p.mouse.move(r.x,r.y);await p.mouse.down();const mv=await until(p,x0=>VL.x>x0+60,4000,r.x0);await p.mouse.up();ok(mv,tag+': ▶ gedrückt halten läuft nach rechts');}
  // Dorfkarte: Symbol antippen → Held läuft hin
  const m=await p.evaluate(()=>{draw();const L=vLay(),k=uiOn?uiS:1,b=L.B.find(q=>q.k==='buch'),mx0=SI.l/k+16,mw=W-SI.r/k-16-mx0,my=H-SI.b/k-8-24;return{x:(mx0+b.x/L.WW*mw)*k,y:(my+11)*k,bx:b.x};});
  await p.mouse.click(m.x,m.y);ok(await until(p,bx=>VL.tx===bx||Math.abs(VL.x-bx)<5,2000,m.bx),tag+': Dorfkarte antippen → Held läuft zur Bibliothek');
  // Enter startet im Dorf kein Spiel mehr; E vor der Tür betritt das Gebäude (Szene)
  await p.evaluate(()=>{const b=vBld().B.find(q=>q.k==='shop');VL.x=b.x;VL.cam=-1;VL.tx=null;});await p.waitForTimeout(100);
  await p.keyboard.press('Enter');await until(p,()=>!!VL.sc,2000);const s0=await p.evaluate(()=>({st,sc:VL.sc&&VL.sc.k}));
  ok(s0.st==='ready'&&s0.sc==='shop',tag+': Enter vor dem Laden startet die Betreten-Szene (kein Spielstart) '+JSON.stringify(s0));
  await until(p,()=>VL.sc&&VL.sc.ph>=1,5000);const s1=await p.evaluate(()=>({ph:VL.sc&&VL.sc.ph,shp:!!shp}));ok(s1.ph===1&&!s1.shp,tag+': Innenraum mit Begrüßung, Menü noch zu '+JSON.stringify(s1));
  for(let i=0;i<50&&!(await p.evaluate(()=>!!shp));i++)await p.waitForTimeout(100);ok(await p.evaluate(()=>shp&&shp.tab===0&&VL.sc&&VL.sc.ph===2),tag+': danach öffnet der Shop');
  await p.evaluate(()=>{shp=null;});ok(await until(p,()=>VL.sc&&VL.sc.ph===3,2000),tag+': Shop zu → Held kommt wieder heraus');
  ok(await until(p,()=>!VL.sc,4000),tag+': Szene beendet');
  // Antippen überspringt die Szene
  await p.evaluate(()=>{const b=vBld().B.find(q=>q.k==='buch');VL.x=b.x;VL.cam=-1;vEnter('buch');});await p.waitForTimeout(250);
  await p.mouse.click(vp.width/2,vp.height/2);ok(await until(p,()=>bk&&bk.tab===0,1500),tag+': Antippen überspringt → Bestiarium offen');
  await p.evaluate(()=>{bk=null;});await until(p,()=>!VL.sc,4000);
  // Portal: Tunnel, dann Spielmodi
  await p.evaluate(()=>{const b=vBld().B.find(q=>q.k==='tor');VL.x=b.x;VL.cam=-1;vEnter('tor');});await until(p,()=>vPanel==='tor',8000);
  ok(await p.evaluate(()=>vPanel==='tor'),tag+': Dungeon-Tor: Portal-Szene, dann Spielmodi');
  await p.screenshot({path:path.join(__dirname,'steuerung_'+vp.width+'.png')});await p.evaluate(()=>{vPanel=null;});await ctx.close();}
 // Skin-Effekte: alle Skins in der Vorschau zeichnen (Dorf, Dungeon, Shop) ohne Fehler
 {const ctx=await b.newContext({viewport:{width:1180,height:820}});const p=await ctx.newPage();p.on('pageerror',e=>errs.push(e.message));await p.goto(F);await p.waitForTimeout(700);
  const k=await p.evaluate(()=>{const fa=SKA.filter(s=>s.fx).length,fw=SKW.filter(s=>s.fx).length;newGame(undefined,'endless');for(let a=0;a<SKA.length;a++){SKO={a,w:a%SKW.length};for(let i=0;i<3;i++){tm+=.3;draw();heroPrev(200,200,1.5,a,a%SKW.length);wepPrev(300,200,1.4,a%SKW.length);}}SKO=null;return{fa,fw,n:SKA.length,m:SKW.length};});
  ok(k.fa===k.n-1&&k.fw===k.m-1,'jeder Skin außer Standard hat einen eigenen Effekt '+JSON.stringify(k));
  // Kreisblende beim Betreten: innen bleibt das Bild sichtbar, nur außen wird es dunkel (früher war alles schwarz)
  const ir=await p.evaluate(()=>{const c=document.createElement('canvas');c.width=W;c.height=H;const g0=g;g=c.getContext('2d');try{g.fillStyle='#fff';g.fillRect(0,0,W,H);vIris(W/2,H/2,Math.min(W,H)/4);const px=(x,y)=>g.getImageData(x,y,1,1).data[0];return{mid:px(W/2,H/2),ecke:px(3,3)};}finally{g=g0;}});
  ok(ir.mid===255&&ir.ecke<20,'Kreisblende: Mitte sichtbar, Rand dunkel '+JSON.stringify(ir));await ctx.close();}
 ok(errs.length===0,'keine JS-Fehler '+errs.join(' | '));
 console.log(fail?'FEHLGESCHLAGEN ('+fail+')':'ALLE OK');await b.close();process.exit(fail?1:0);})();
