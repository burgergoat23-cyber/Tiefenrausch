// Messläufe für die Ranglisten-Bots: der ehrliche Autopilot (ai.js, ohne Unverwundbarkeit) spielt bis zum ersten Tod.
// Stufe 2 = schwer (alles), 1 = mittel (sieht Warnkreise/Geschosse nicht), 0 = leicht (dazu keine Tränke). Eigene Schwächen: HC=dash,gefahr,traenke,laden
// Aufruf: node tools/video/botsim.js endless <stufe>            → Ebene beim ersten Tod (höchstens 100)
//         node tools/video/botsim.js daily <stufe> <JJJJ-MM-TT>  → Punkte und Ebene im Tageslauf dieses Tages
// Ausgabe: eine JSON-Zeile {mode,lvl,day,fl,s,kills,bosses,min}
const {chromium}=(()=>{try{return require('playwright')}catch(e){return require('/opt/node-tools/node_modules/playwright')}})();
const fs=require('fs'),path=require('path');
const MODE=process.argv[2]||'endless',LVL=+(process.argv[3]||2),DAY=process.argv[4]||'',CAP=+(process.env.CAP||100),MAXMIN=+(process.env.MAXMIN||40),ROOT=path.join(__dirname,'..','..');
(async()=>{const b=await chromium.launch();const p=await b.newPage({viewport:{width:960,height:540}});const errs=[];p.on('pageerror',e=>errs.push(e.message));
  await p.addInitScript(day=>{let now=0,raf=null;performance.now=()=>now;window.requestAnimationFrame=cb=>{raf=cb;return 1;};
    window.__run=n=>{for(let i=0;i<n;i++){now+=1000/30;if(raf){const f=raf;raf=null;f(now);}}};
    if(day){const T=new Date(day+'T12:00:00+02:00').getTime(),D=Date;window.Date=class extends D{constructor(...a){super(...(a.length?a:[T]));}static now(){return T;}};}
    try{localStorage.setItem('dg_cfg',JSON.stringify({snd:0,mus:0}));}catch(e){}},DAY);
  const URL='https://burgergoat23-cyber.github.io/Tiefenrausch/',HTML=fs.readFileSync(path.join(ROOT,'index.html'));
  await p.route('**/*',r=>{const u=r.request().url();if(u.startsWith(URL))r.fulfill({contentType:'text/html',body:HTML});else r.abort();});
  await p.goto(URL);await p.evaluate(require('./ai.js'));if(process.env.HC!=null)await p.evaluate(h=>{window.__HC=h;},process.env.HC);
  if(process.env.SEED)await p.evaluate(x=>{Math.random=(()=>{let a=x;return()=>{a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};})();},+process.env.SEED);   // wiederholbar
  await p.evaluate(([m,l])=>{guest=true;VAP.god=0;window.draw=()=>{};
    const H=(window.__HC!=null?window.__HC:['','gefahr','gefahr,traenke'][2-l]).split(',');   // Schwächen je Stufe
    if(H.includes('dash'))window.dash=()=>{};                   // kein Ausweichen per Dash
    if(H.includes('gefahr'))VAP.danger=()=>null;                // sieht Warnkreise und Geschosse nicht
    if(H.includes('traenke'))window.usePot=()=>{};              // trinkt keine Tränke
    if(H.includes('laden'))VAP.shopping=()=>{};                 // kauft nichts beim Händler
    newGame(undefined,m);},[MODE,LVL]);
  let t=0,r=null;
  while(t<MAXMIN*60*30){
    r=await p.evaluate(cap=>{for(let i=0;i<300;i++){VAP.tick();__run(1);if(st==='over'||fl>=cap)break;}
      return{st,fl,kills:run.kills,bosses:run.bosses,s:run.score||dScore()};},CAP);
    t+=300;if(r.st==='over'||r.fl>=CAP)break;}
  console.log(JSON.stringify({mode:MODE,lvl:LVL,day:DAY,fl:Math.min(r.fl,CAP),s:r.s,kills:r.kills,bosses:r.bosses,min:+(t/30/60).toFixed(1),over:r.st==='over',err:errs.slice(0,2)}));
  await b.close();})();
