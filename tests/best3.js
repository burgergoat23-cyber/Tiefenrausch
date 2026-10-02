const {chromium}=(()=>{try{return require('playwright')}catch(e){return require('/opt/node-tools/node_modules/playwright')}})();
(async()=>{const b=await chromium.launch();const p=await (await b.newContext({viewport:{width:1000,height:700},deviceScaleFactor:2})).newPage();
 await p.goto('file://'+process.cwd()+'/'+(process.env.F||'cur.html'));await p.waitForTimeout(400);
 const r=await p.evaluate(()=>{const errs={};let n=0;
  for(const played of [0,1]){if(played){newGame(undefined,'endless');}
  for(const kk of [[300,224,212,147,138,4,3,0,0,0,0,0],[1,1,1,1,1,1,1,1,1,1,1,1],[0,0,0,0,0,0,0,0,0,0,0,0]]){meta.k=kk;
   for(const tab of [0,1,2]){for(let pg=0;pg<2;pg++){bk={tab,pg};st='ready';
    for(let i=0;i<120;i++){tm=i*0.173;n++;try{draw();}catch(e){const k=e.message+' | '+(e.stack||'').split('\n').slice(1,3).join(' ');errs[k]=(errs[k]||0)+1;}}}}}}
  // nach einem erzwungenen Fehler mit offenem Zuschnitt: nächstes Bild wieder normal?
  bk={tab:0,pg:0};g.save();g.beginPath();g.rect(0,0,10,10);g.clip();g.scale(.1,.1);draw();const t=g.getTransform();
  return {bilder:n,errs,nachFehlerMassstab:t.a};});
 console.log(JSON.stringify(r,null,1));await p.screenshot({path:'best_after.png'});await b.close();})();
