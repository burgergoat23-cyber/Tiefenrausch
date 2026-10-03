// Langes Video „Endlos-Modus bis Ebene 100“ – ehrlicher Autopilot (ai.js, ohne Unverwundbarkeit).
// Jede Ebene wird kurz gezeigt (Bosse bis zum Sieg), der Rest der Ebene läuft stumm im Schnelldurchlauf (nicht im Video).
// Ergebnis: Rohvideo (ohne Schrift) + Ereignisliste. Danach baut long_mix.js daraus die deutsche und englische Fassung.
// Aufruf: node tools/video/long.js [Zielordner] [Ziel-Ebene=100]
const {chromium}=(()=>{try{return require('playwright')}catch(e){return require('/opt/node-tools/node_modules/playwright')}})();
const fs=require('fs'),path=require('path'),{execSync}=require('child_process');
const ROOT=path.join(__dirname,'..','..'),OUT=process.argv[2]||path.join(ROOT,'promo'),GOAL=+(process.argv[3]||100),MODE=process.argv[4]||'endless',FPS=30,SR=32000,CHUNK=60;
const NAME=MODE==='story'?'story_komplett':MODE==='bosse'?'bosse':'endlos100',NORM=MODE==='story'?600:120;   // Story: 20 s je Ebene, Endlos: 4 s
const tmp=fs.mkdtempSync(path.join(require('os').tmpdir(),'long-'));
function init(cfg){
  let now=0,raf=null,OFF=null,real=null,rendering=null,k=0;
  const mk=()=>{OFF=new OfflineAudioContext(2,Math.ceil(cfg.chunk*cfg.sr)+cfg.sr,cfg.sr);real=OFF.resume.bind(OFF);OFF.resume=()=>Promise.resolve();rendering=null;k=0;};mk();
  performance.now=()=>now;window.requestAnimationFrame=cb=>{raf=cb;return 1;};
  window.AudioContext=function(){return OFF;};window.webkitAudioContext=window.AudioContext;
  const tq=i=>Math.ceil(i*cfg.sr/cfg.fps/128)*128/cfg.sr;
  try{localStorage.setItem('dg_cfg',JSON.stringify({lang:'de',snd:1,mus:1,fog:1,shake:1,glow:1,joy:1,ctrl:0,hand:0}));}catch(e){}
  window.__V={
    async step(){k++;const p=OFF.suspend(tq(k));if(!rendering)rendering=OFF.startRendering();else real();await p;now+=1000/cfg.fps;if(raf){const f=raf;raf=null;f(now);}},
    fast(){now+=1000/cfg.fps;if(raf){const f=raf;raf=null;f(now);}},            // ohne Ton/Bild weiter
    frames:()=>k,
    async cut(){                                                                 // Ton-Stück abschließen, neues beginnen
      if(!rendering){return 0;}const n=Math.round(k*cfg.sr/cfg.fps);real();const b=await rendering;const L=b.getChannelData(0),R=b.getChannelData(1),o=new Int16Array(n*2);
      for(let i=0;i<n;i++){o[2*i]=Math.max(-1,Math.min(1,L[i]||0))*32767;o[2*i+1]=Math.max(-1,Math.min(1,R[i]||0))*32767;}
      window.__pcm=new Uint8Array(o.buffer);mk();try{AC=null;musOn=undefined;sndOn=undefined;au();}catch(e){}return window.__pcm.length;},
    chunk(i,sz){const a=window.__pcm.subarray(i,i+sz);let s='';for(let j=0;j<a.length;j+=8192)s+=String.fromCharCode.apply(null,a.subarray(j,j+8192));return btoa(s);}};
}
(async()=>{
  const b=await chromium.launch();const ctx=await b.newContext({viewport:{width:960,height:540},deviceScaleFactor:4/3});
  await ctx.addInitScript(init,{fps:FPS,sr:SR,chunk:CHUNK});
  const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
  const URL='https://burgergoat23-cyber.github.io/Tiefenrausch/',HTML=fs.readFileSync(path.join(ROOT,'index.html'));
  await ctx.route('**/*',r=>{const u=r.request().url();if(u.startsWith(URL))r.fulfill({contentType:'text/html',body:HTML});else r.abort();});
  await p.goto(URL);await p.evaluate(require('./ai.js'));
  await p.evaluate(m=>{window.MODE_=m;},MODE);
  await p.evaluate(()=>{guest=true;VAP.god=0;try{au();}catch(e){}newGame(undefined,MODE_==='bosse'?'endless':MODE_);
    window.FL=document.createElement('canvas');FL.style.cssText='position:fixed;left:0;top:0;width:100vw;height:100vh;pointer-events:none;z-index:50';document.body.appendChild(FL);
    FL.width=innerWidth*devicePixelRatio;FL.height=innerHeight*devicePixelRatio;window.FLX=FL.getContext('2d');
    window.__flash=i=>{FLX.clearRect(0,0,FL.width,FL.height);if(i<8){FLX.fillStyle='rgba(255,246,220,'+(.6*(1-i/8))+')';FLX.fillRect(0,0,FL.width,FL.height);}};});
  const raw=fs.openSync(path.join(tmp,'a.raw'),'w');let fr=0,inChunk=0;const ev=[];
  const state=()=>p.evaluate(()=>({rv:(me.rv||[]).length,fl,st,boss:(en.find(e=>e.boss)||null)&&bossTitle(en.find(e=>e.boss)),bossAlive:en.some(e=>e.boss),w:WP[me.w.i].n,wt:me.w.t,hp:me.hp,mx:me.mx,deaths:VAP.deaths,pots:me.pots.heal}));
  async function flushAudio(){const n=await p.evaluate(()=>__V.cut());for(let i=0;i<n;i+=4e6)fs.writeSync(raw,Buffer.from(await p.evaluate(([i])=>__V.chunk(i,4e6),[i]),'base64'));inChunk=0;}
  async function shot(fi){await p.evaluate(async i=>{VAP.tick();await __V.step();__flash(i);},fi);
    await p.screenshot({path:path.join(tmp,'f'+String(fr++).padStart(6,'0')+'.jpg'),type:'jpeg',quality:88});if(++inChunk>=CHUNK*FPS)await flushAudio();}
  let lastW='',lastT=-1,overShown=0;const t0=Date.now();
  // Modus „bosse“: jeder Boss nacheinander (Grundbosse Ebene 3–21, Varianten-Bosse 24–39, Endboss Vorath in der Story),
  // ebenengerechte Ausrüstung, ehrlicher Kampf bis zum Sieg (bei Niederlage: Kampf neu)
  if(MODE==='bosse'){const L=[[3,'endless'],[6,'endless'],[9,'endless'],[12,'endless'],[15,'endless'],[18,'endless'],[21,'endless'],[24,'endless'],[27,'endless'],[30,'endless'],[33,'endless'],[36,'endless'],[39,'endless'],[15,'story']];
    const setup=(f,m)=>p.evaluate(([f,m])=>{newGame(undefined,m);fl=f;gen();const t=Math.min(5,1+Math.floor(f/8)),a=Math.min(4,Math.floor(f/8));
      me.w=mkW(24,t);me.mx=Math.min(12,5+Math.floor(f/3));me.hp=me.mx;me.pots.heal=5;me.pots.rage=2;me.arm=[{s:0,t:a},{s:1,t:a},{s:2,t:a}];ui=null;
      VAP.lfl=fl;VAP.cur=null;VAP.ot=null;VAP.toBoss();},[f,m]);
    for(const [f,m] of L){await setup(f,m);const s=await state();ev.push({t:fr/FPS,k:'ebene',fl:f,boss:s.boss,deaths:s.deaths});
      let after=-1;for(let i=0;i<2700;i++){await shot(i);if(i%10)continue;const q=await p.evaluate(()=>({st,b:en.some(e=>e.boss)}));
        if(q.st==='over'){ev.push({t:fr/FPS,k:'tod'});for(let j=0;j<60;j++)await shot(99);await setup(f,m);await p.evaluate(()=>{VAP.deaths++;});continue;}
        if(!q.b&&after<0)after=i;if(after>=0&&i-after>60)break;}
      console.log('Boss',s.boss,'fertig · Video',(fr/FPS/60).toFixed(1),'min');}}
  while(MODE!=='bosse'){
    const s=await state();if(s.fl>GOAL||s.st==='end')break;
    if(s.w!==lastW||s.wt!==lastT){if(lastW)ev.push({t:fr/FPS,k:'waffe',w:s.w,wt:s.wt});lastW=s.w;lastT=s.wt;}
    ev.push({t:fr/FPS,k:'ebene',fl:s.fl,boss:s.boss,deaths:s.deaths,hp:s.hp,mx:s.mx});
    // Aufnahme: normale Ebene 4 s, Boss-Ebene bis zum Sieg (+1,5 s, höchstens 20 s); bricht ab, wenn die Ebene wechselt
    const f0=s.fl,max=s.bossAlive?Math.max(600,NORM):NORM;let rv0=s.rv;let i=0,after=-1;
    for(;i<max;i++){await shot(i);
      if(i%10===0){const q=await p.evaluate(()=>({fl,st,b:en.some(e=>e.boss),rv:(me.rv||[]).length}));if(q.rv>rv0){ev.push({t:fr/FPS,k:'gerettet',n:q.rv});rv0=q.rv;}
        if(q.st==='over'){ev.push({t:fr/FPS,k:'tod'});for(let j=0;j<75;j++)await shot(99);await p.evaluate(()=>VAP.revive());break;}
        if(q.st==='end')break;if(q.fl!==f0)break;if(s.bossAlive&&!q.b&&after<0)after=i;if(after>=0&&i-after>45)break;}}
    // Rest der Ebene stumm im Schnelldurchlauf
    const r=await p.evaluate(f0=>{const keep=cfg.snd;cfg.snd=0;let n=0,d=0;while(fl===f0&&st!=='end'&&n<30*60*20){VAP.tick();__V.fast();n++;if(st==='over'){d++;VAP.revive();}}cfg.snd=keep;return{n,d,fl,st};},f0);
    if(r.d)ev.push({t:fr/FPS,k:'tod',n:r.d});
    if(r.fl===f0&&r.st!=='end'){console.log('hängt auf Ebene',f0,'– Abbruch');break;}
    if(f0%5===0)console.log(`Ebene ${f0} · Video ${(fr/FPS/60).toFixed(1)} min · ${((Date.now()-t0)/60000).toFixed(0)} min Laufzeit · Tode ${s.deaths}`);
  }
  {const e0=(await state()).st==='end';for(let j=0;j<(e0?240:90);j++)await shot(99);}ev.push({t:fr/FPS,k:'ende',fl:(await state()).fl,deaths:(await state()).deaths});
  await flushAudio();fs.closeSync(raw);await b.close();
  fs.mkdirSync(OUT,{recursive:true});const base=path.join(OUT,NAME);
  execSync(`ffmpeg -y -loglevel error -framerate ${FPS} -i ${tmp}/f%06d.jpg -f s16le -ar ${SR} -ac 2 -i ${tmp}/a.raw -c:v libx264 -preset medium -crf 23 -pix_fmt yuv420p -c:a pcm_s16le -shortest ${base}_roh.mkv`);
  fs.writeFileSync(base+'_ereignisse.json',JSON.stringify({dur:fr/FPS,ev},null,1));fs.rmSync(tmp,{recursive:true,force:true});
  console.log('fertig:',base+'_roh.mkv',(fr/FPS/60).toFixed(1)+' min',errs.length?'JS-Fehler: '+errs.slice(0,3).join(' | '):'');
})();
