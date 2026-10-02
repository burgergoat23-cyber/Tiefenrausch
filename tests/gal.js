// Galerie: fotografiert alle wichtigen Bildschirme in mehreren Größen.  Aufruf:  node tests/gal.js <Ordner> [Präfix]
// Vergleich vorher/nachher bei Optik-Änderungen. Bilder landen als <Präfix>_<Größe>_<Bildschirm>.png im Ordner.
const {chromium}=(()=>{try{return require('playwright')}catch(e){return require('/opt/node-tools/node_modules/playwright')}})();
const path=require('path'),out=process.argv[2]||'.',pre=process.argv[3]||'g',file='file://'+path.resolve(__dirname,'..','index.html');
const VIEWS={ipad:[820,1180],handyq:[844,390],handy:[390,844],pc:[1280,800]};
const SHOTS={
 title:`st='ready';bk=null;ui=null;`,
 hud:`newGame(undefined,'endless');me.inv=999;seenTouch=true;me.pots.heal=3;me.pots.rage=1;me.pots.swift=0;me.w2=mkW(3,4);say('Willkommen in der Tiefe!');`,
 boss:`newGame(undefined,'endless');fl=3;gen();me.inv=999;seenTouch=true;me.pots.heal=2;qst=newQuest();qst.p=1;const b=en.find(e=>e.boss);if(b){me.x=b.x-90;me.y=b.y;}`,
 menu:`ui={type:'menu'};`,
 inv0:`me.w2=mkW(5,3);me.arm[0]={t:3,s:0};ui={type:'inv',tab:0};`,
 inv1:`me.pots.heal=3;me.pots.rage=2;ui={type:'inv',tab:1};`,
 shop:`gold=500;shop=mkShop();ui={type:'shop'};`,
 quest:`qst=null;qoff=null;ui={type:'quest'};`,
 story:`ui={type:'story',t:STORY[1][0],l:STORY[1].slice(1)};`,
 ask:`askLeave();`,
 book:`ui={type:'book',tab:0,pg:0};`,
 over:`ui=null;st='over';`,
 lobby:`ui=null;st='ready';bk=null;CO.lob={st:'menu'};`,
 rang:`CO.lob=null;bk={tab:3,pg:0,lt:1};`,
 laden:`bk=null;loadT=4;`,
};
(async()=>{const b=await chromium.launch();const errs=[];
 for(const [vn,[w,h]] of Object.entries(VIEWS)){
  const p=await (await b.newContext({viewport:{width:w,height:h},deviceScaleFactor:1})).newPage();p.on('pageerror',e=>errs.push(vn+': '+e.message));
  await p.goto(file);await p.waitForTimeout(500);await p.evaluate(()=>{guest=true;try{meta.k[0]=3;meta.k[5]=1;meta.k[1]=2;}catch(e){}});
  for(const [sn,code] of Object.entries(SHOTS)){
   await p.evaluate(c=>{errT='';try{eval(c);}catch(e){window.__ge=(window.__ge||'')+e.message;}},code);await p.waitForTimeout(sn==='hud'||sn==='boss'?700:350);
   await p.screenshot({path:path.join(out,`${pre}_${vn}_${sn}.png`)});const e1=await p.evaluate(()=>errT);if(e1)errs.push(vn+' '+sn+': '+e1);}
  const e2=await p.evaluate(()=>(window.__ge||'')+' '+(errT||''));if(e2.trim())errs.push(vn+': '+e2);}
 console.log(errs.length?'Fehler: '+errs.join(' | '):'keine Fehler');await b.close();})();
