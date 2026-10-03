// Schnelle Simulation ohne Bild/Ton: wie weit kommt der ehrliche Autopilot (ohne Unverwundbarkeit)?
// Aufruf: node tools/video/sim.js [endless|story] [Ziel-Ebene=100] [max. Spielminuten=90]
const {chromium}=(()=>{try{return require('playwright')}catch(e){return require('/opt/node-tools/node_modules/playwright')}})();
const fs=require('fs'),path=require('path');
const MODE=process.argv[2]||'endless',GOAL=+(process.argv[3]||100),MAXMIN=+(process.argv[4]||90),ROOT=path.join(__dirname,'..','..');
(async()=>{const b=await chromium.launch();const p=await b.newPage({viewport:{width:960,height:540}});const errs=[];p.on('pageerror',e=>errs.push(e.message));
  if(process.env.SND)await p.addInitScript(()=>{window.__SND=1;});
  await p.addInitScript(()=>{let now=0,raf=null;performance.now=()=>now;window.requestAnimationFrame=cb=>{raf=cb;return 1;};
    window.__run=n=>{for(let i=0;i<n;i++){now+=1000/30;if(raf){const f=raf;raf=null;f(now);}}};
    try{localStorage.setItem('dg_cfg',JSON.stringify(window.__SND?{snd:1,mus:1}:{snd:0,mus:0}));}catch(e){}});
  const URL='https://burgergoat23-cyber.github.io/Tiefenrausch/',HTML=fs.readFileSync(path.join(ROOT,'index.html'));
  await p.route('**/*',r=>{const u=r.request().url();if(u.startsWith(URL))r.fulfill({contentType:'text/html',body:HTML});else r.abort();});
  await p.goto(URL);await p.evaluate(require('./ai.js'));
  await p.evaluate(m=>{guest=true;VAP.god=0;newGame(undefined,m);},MODE);
  if(process.env.SEED)await p.evaluate(x=>{Math.random=(()=>{let a=x;return()=>{a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};})();},+process.env.SEED);
  // draw() abschalten spart Zeit (nur Spiellogik)
  if(!process.env.DRAW)await p.evaluate(()=>{window.draw=()=>{};});
  let t=0,lastFl=0,flT=0;const log=[];
  while(t<MAXMIN*60*30){
    const s=await p.evaluate(()=>{let r=null;for(let i=0;i<300;i++){VAP.tick();__run(1);if(st==='over'){r='tot';VAP.revive();}else if(st==='end'){r='ende';break;}}
      return{fl,hp:me.hp,mx:me.mx,pots:me.pots.heal,gold,w:WP[me.w.i].n+'/'+TN[me.w.t],deaths:VAP.deaths,st,r,arm:me.arm.map(a=>a?a.t:-1).join('')};});
    t+=300;
    if(s.fl!==lastFl){log.push(`Ebene ${s.fl} nach ${(t/30/60).toFixed(1)} min · Tode ${s.deaths} · ${s.hp}/${s.mx}♥ · ${s.pots} Heiltr. · ${s.w} · Rüstung ${s.arm}`);console.log(log[log.length-1]);lastFl=s.fl;flT=t;}
    if(t-flT>30*60*4){console.log('hängt auf Ebene',s.fl);for(let k=0;k<12;k++){console.log(await p.evaluate(()=>{const bs=en.filter(e=>e.boss).map(e=>[e.x|0,e.y|0,e.hp]);VAP.tick();const r=JSON.stringify({me:[me.x|0,me.y|0,me.hp],ui:ui&&ui.type,keys:[keys.w,keys.a,keys.s,keys.d],en:en.length,near:en.map(e=>Math.hypot(e.x-me.x,e.y-me.y)|0).sort((a,b)=>a-b).slice(0,3),bs,stairs:[stairs.x|0,stairs.y|0],ch:ch.filter(c=>!c.o).length,it:it.map(i=>i.t).join(','),zp:zp.length,eb:eb.length,dash:dashCd,dbg:VAP.dbg});__run(1);return r;}));}break;}
    if(s.fl>=GOAL||s.r==='ende'||s.st==='end'){console.log('ZIEL erreicht',s.fl,s.st);break;}
  }
  console.log('Fehler:',errs.slice(0,3));await b.close();})();
