const {chromium}=(()=>{try{return require('playwright')}catch(e){return require('/opt/node-tools/node_modules/playwright')}})();
let fail=0;const ok=(c,m)=>{console.log((c?'  OK  ':'  FAIL ')+m);if(!c)fail++;};
(async()=>{const b=await chromium.launch();const p=await (await b.newContext({viewport:{width:900,height:800}})).newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
 await p.goto('file://'+process.cwd()+'/cur.html');await p.waitForTimeout(400);
 const r=await p.evaluate(async()=>{const o={};newGame(undefined,'endless');
  // 1) alle Waffen zeichnen + damit kämpfen
  o.nWaffen=WP.length;o.neu=WP.slice(26).map((w,i)=>w.n+(w.g?' (Göttlich)':w.u?' (Mythisch)':''));
  let drawErr=[];for(let i=0;i<WP.length;i++){try{me.w=mkW(i,WP[i].u?5:4);ui={type:'inv',tab:0};drawUI();ui=null;
     en=[mkE(0,me.x+40,me.y)];en[0].hp=999;for(let k=0;k<40;k++)update(.05);draw();}catch(e){drawErr.push(WP[i].n+': '+e.message);}}
  o.drawErr=drawErr;o.goettlichStufe=mkW(DIVI[0]).t+' '+TN[mkW(DIVI[0]).t];
  // 2) Lebensgrenze
  me.mx=11;me.hp=11;gold=99999;shop=mkShop();const heart=shop.find(x=>x.cap);
  ui={type:'shop'};drawUI();let hb=btns.find(()=>1);
  heart.f();o.mxNachKauf=me.mx;ui={type:'shop'};drawUI();ui=null;
  const items=shop.filter(x=>x.cap);o.herzAnzeigeMax=me.mx>=HPMAX;
  fl=2;me.x=stairs.x;me.y=stairs.y;en=en.filter(e=>!e.boss);update(.016);o.mxNachTreppeEbene3=me.mx;
  newGame({...JSON.parse(JSON.stringify(saves.endless||{fl:5,gold:1,mx:20,hp:20,w:{i:0,t:0}})),mx:20,hp:20,fl:5});o.altesSpiel20Herzen=me.mx;
  // 3) Heiltrank
  me.hp=1;me.pots.heal=1;usePot('heal');o.heiltrank='1 -> '+me.hp+' (von '+me.mx+')';
  // 4) Wut-Phase
  fl=3;gen();const boss=en.find(e=>e.boss);me.inv=99;boss.hp=Math.floor(boss.mx*.49);let shots=0;for(let k=0;k<200;k++){const n0=eb.length;update(.05);shots+=Math.max(0,eb.length-n0);me.hp=me.mx;}
  o.wut=!!boss.rg;o.bossSchuesseIn10s=shots;
  // 5) Göttliche Waffe speichern/laden
  me.w=mkW(DIVI[1]);fl=22;saveGame();newGame(saves.endless);o.gespeicherteWaffe=WP[me.w.i].n+' t'+me.w.t;
  // 6) Händler auf Ebene 1 ohne Legendär, Ebene 10 mit
  fl=1;o.haendlerE1=mkShop().some(x=>/Legendär/.test(x.n));fl=10;o.haendlerE10=mkShop().some(x=>/Legendär/.test(x.n));
  return o;});
 console.log(JSON.stringify(r,null,1));
 ok(r.drawErr.length===0,'alle '+r.nWaffen+' Waffen zeichnen & kämpfen ohne Fehler');
 ok(r.mxNachKauf===12&&r.herzAnzeigeMax,'Herz kaufen bis 12, dann Maximum');ok(r.mxNachTreppeEbene3===12,'Treppe über 12 gibt kein Herz');
 ok(r.altesSpiel20Herzen===12,'alter Spielstand mit 20 Herzen wird auf 12 begrenzt');ok(r.heiltrank.startsWith('1 -> 5'),'Heiltrank +4');
 ok(r.wut&&r.bossSchuesseIn10s>10,'Boss wird wütend und schießt');ok(/t6$/.test(r.gespeicherteWaffe),'Göttliche Waffe übersteht Speichern/Laden');
 ok(!r.haendlerE1&&r.haendlerE10,'Legendär beim Händler erst ab Ebene 9');
 // Screenshot: Sammlung + Waffenkarte göttlich
 await p.evaluate(()=>{st='play';me.w=mkW(DIVI[0]);me.w2=mkW(UNIQ[5]);ui={type:'inv',tab:0};});await p.waitForTimeout(300);await p.screenshot({path:'inv.png'});
 console.log('JS-Fehler:',errs.length?errs:'keine');console.log(fail?fail+' FEHLGESCHLAGEN':'ALLE OK');await b.close();})();
