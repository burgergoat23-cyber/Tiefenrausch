// Werbevideos für Tiefenrausch: spielt das Spiel Bild für Bild mit Autopilot ab, nimmt Bild + Ton (Spielmusik/Geräusche) auf
// und baut mit ffmpeg ein MP4.   Aufruf:  node tools/video/rec.js <plan> [de|en] [Zielordner]
//   plan = shorts (1080x1920, ~30 s) | lang (1920x1080, ~2,5 min)
// Zeit ist simuliert (performance.now / requestAnimationFrame), Ton über OfflineAudioContext im Gleichschritt → flüssig und synchron.
const {chromium}=(()=>{try{return require('playwright')}catch(e){return require('/opt/node-tools/node_modules/playwright')}})();
const fs=require('fs'),path=require('path'),{execSync}=require('child_process');
const PLAN=process.argv[2]||'shorts',LANG=process.argv[3]||'de',ROOT=path.join(__dirname,'..','..');
const OUT=process.argv[4]||path.join(ROOT,'promo');const FPS=30;
const P=require('./plans.js')[PLAN];if(!P)throw new Error('Unbekannter Plan '+PLAN);
const scenes=P.scenes(LANG),DUR=scenes.reduce((a,s)=>a+s.sec,0)+1;
const tmp=fs.mkdtempSync(path.join(require('os').tmpdir(),'vid-'));

function lufsGain(inp){const o=execSync(`ffmpeg -hide_banner -nostats ${inp} -af ebur128=framelog=quiet -f null - 2>&1`).toString();
  const m=/I:\s+(-?[\d.]+) LUFS/.exec(o.split('Summary')[1]||'');const I=m?+m[1]:-30;return Math.max(0,Math.min(24,-14-I)).toFixed(1);}
// --- läuft im Spiel, bevor dessen Skript startet ---
function init(cfg){
  let now=0,raf=null;const SR=48000;
  performance.now=()=>now;window.requestAnimationFrame=cb=>{raf=cb;return 1;};
  const OFF=new OfflineAudioContext(2,Math.ceil(cfg.dur*SR),SR),realResume=OFF.resume.bind(OFF);
  OFF.resume=()=>Promise.resolve();   // das Spiel darf die Uhr nicht selbst weiterlaufen lassen
  window.AudioContext=function(){return OFF;};window.webkitAudioContext=window.AudioContext;
  let k=0,rendering=null;const tq=i=>Math.ceil(i*SR/cfg.fps/128)*128/SR;
  try{localStorage.setItem('dg_cfg',JSON.stringify({lang:cfg.lang,snd:1,mus:1,fog:1,shake:1,glow:1,joy:1,ctrl:0,hand:0}));}catch(e){}
  window.__V={OFF,
    async step(){                       // ein Bild: Ton bis zum nächsten Zeitpunkt rechnen, dann Spiel 1/30 s weiter
      k++;const p=OFF.suspend(tq(k));if(!rendering)rendering=OFF.startRendering();else realResume();await p;
      now+=1000/cfg.fps;if(raf){const f=raf;raf=null;f(now);}},
    async finish(){realResume();const b=await rendering;const n=b.length,L=b.getChannelData(0),R=b.getChannelData(1),o=new Int16Array(n*2);
      for(let i=0;i<n;i++){o[2*i]=Math.max(-1,Math.min(1,L[i]))*32767;o[2*i+1]=Math.max(-1,Math.min(1,R[i]))*32767;}
      window.__pcm=new Uint8Array(o.buffer);return window.__pcm.length;},
    chunk(i,sz){const a=window.__pcm.subarray(i,i+sz);let s='';for(let j=0;j<a.length;j+=8192)s+=String.fromCharCode.apply(null,a.subarray(j,j+8192));return btoa(s);}};
}
// --- Autopilot + Untertitel (im Spiel) ---
const HELP=`
window.VAP={stuck:0,lx:0,ly:0,wig:0,wx:0,wy:0,on:1,god:1};
VAP.path=function(tx,ty){const sx=Math.floor(me.x/T),sy=Math.floor(me.y/T),gx=Math.floor(tx/T),gy=Math.floor(ty/T);
  if(sx===gx&&sy===gy)return null;const prev=new Int32Array(N*N).fill(-1),q=[sy*N+sx];prev[sy*N+sx]=sy*N+sx;
  for(let h=0;h<q.length;h++){const c=q[h],x=c%N,y=(c/N)|0;if(x===gx&&y===gy)break;
    for(const[dx,dy]of[[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]]){const nx=x+dx,ny=y+dy;if(nx<0||ny<0||nx>=N||ny>=N||map[ny][nx]===1)continue;
      if(dx&&dy&&(map[y][nx]===1||map[ny][x]===1))continue;const ni=ny*N+nx;if(prev[ni]>=0)continue;prev[ni]=c;q.push(ni);}}
  let c=gy*N+gx;if(prev[c]<0)return null;let nx=c;while(prev[c]!==sy*N+sx&&prev[c]!==c){nx=c;c=prev[c];}nx=c;return{x:(nx%N+.5)*T,y:(((nx/N)|0)+.5)*T};};
VAP.tick=function(){keys.w=keys.a=keys.s=keys.d=0;if(st!=='play'||!VAP.on)return;
  if(VAP.god){if(me.hp<Math.max(2,me.mx*.5))me.hp=me.mx;}
  if(ui){if(ui.type==='story'){ui.tt=(ui.tt||0)+1;if(ui.tt>75){const d=ui.done;ui=null;if(d)d();}}else ui=null;return;}
  const P=WP[me.w.i];let tg=null,rng=0,bd=1e9;
  for(const e of en){const d=Math.hypot(e.x-me.x,e.y-me.y);if(d<bd&&(d<520||e.boss)){bd=d;tg=e;}}
  if(tg)rng=Math.max(34,Math.min(P.rng*.75,P.proj?200:P.rng*.7));
  else{for(const c of ch)if(!c.o){const d=Math.hypot(c.x-me.x,c.y-me.y);if(d<bd){bd=d;tg=c;}}
    for(const i of it){const d=Math.hypot(i.x-me.x,i.y-me.y);if(d<bd&&d<300){bd=d;tg=i;}}
    if(!tg){tg=stairs;}rng=4;}
  if(VAP.wig>0){VAP.wig--;keys[VAP.wx>0?'d':'a']=1;keys[VAP.wy>0?'s':'w']=1;return;}
  const dd=Math.hypot(tg.x-me.x,tg.y-me.y);if(dd<=rng&&(!tg.hp||los(me.x,me.y,tg.x,tg.y)))return;
  const n=(los(me.x,me.y,tg.x,tg.y)&&dd<160)?tg:(VAP.path(tg.x,tg.y)||tg);let dx=n.x-me.x,dy=n.y-me.y;
  if(Math.abs(dx)>6)keys[dx>0?'d':'a']=1;if(Math.abs(dy)>6)keys[dy>0?'s':'w']=1;
  if(Math.hypot(me.x-VAP.lx,me.y-VAP.ly)<.6){if(++VAP.stuck>20){VAP.stuck=0;VAP.wig=12;VAP.wx=Math.random()-.5;VAP.wy=Math.random()-.5;}}else VAP.stuck=0;VAP.lx=me.x;VAP.ly=me.y;};
VAP.toBoss=function(){const b=en.find(e=>e.boss);if(!b)return;for(const r of[150,120,190,90])for(let a=0;a<8;a++){const x=b.x+Math.cos(a*Math.PI/4)*r,y=b.y+Math.sin(a*Math.PI/4)*r;
  if(!hit(x,y,12)&&los(x,y,b.x,b.y)){me.x=x;me.y=y;const ci=Math.floor(x/T),cj=Math.floor(y/T);for(let i=-7;i<=7;i++)for(let j=-7;j<=7;j++){const X=ci+i,Y=cj+j;if(X>=0&&Y>=0&&X<N&&Y<N)vis[Y*N+X]=1;}return;}}};
window.CAP=null;
window.capDraw=function(){const c=CAP;if(!c)return;c.t=(c.t||0)+1/30;const a=Math.min(1,c.t*3,Math.max(0,(c.len-c.t)*3));if(a<=0)return;
  resetTf();g.save();g.globalAlpha=a;const L=W>H,big=Math.min(L?40:30,W/(L?24:14.5)),y0=H*(c.y||(L?.80:.15));
  g.font='700 '+big+'px '+FD;const lines=[];{let cur='';for(const w of c.a.split(' ')){const t=cur?cur+' '+w:w;if(cur&&g.measureText(t).width>W*.84){lines.push(cur);cur=w;}else cur=t;}if(cur)lines.push(cur);}const h=lines.length*big*1.18+(c.b?big*.95:0)+big*.7;
  const gr=g.createLinearGradient(0,y0-h*.62,0,y0+h*.62);gr.addColorStop(0,'rgba(8,5,12,0)');gr.addColorStop(.25,'rgba(8,5,12,.78)');gr.addColorStop(.75,'rgba(8,5,12,.78)');gr.addColorStop(1,'rgba(8,5,12,0)');
  g.fillStyle=gr;g.fillRect(0,y0-h*.62,W,h*1.24);let y=y0-h/2+big*.95;g.textAlign='center';
  for(const l of lines){g.font='700 '+big+'px '+FD;g.lineWidth=big*.16;g.strokeStyle='rgba(0,0,0,.85)';g.strokeText(l,W/2,y);g.fillStyle='#ffd98a';g.fillText(l,W/2,y);y+=big*1.18;}
  if(c.b){const sm=big*.58;g.font='600 '+sm+'px '+FN;g.lineWidth=sm*.18;g.strokeText(c.b,W/2,y+sm*.2);g.fillStyle='#f4efe6';g.fillText(c.b,W/2,y+sm*.2);}
  g.restore();};
`;
(async()=>{
  const b=await chromium.launch({args:['--autoplay-policy=no-user-gesture-required']});
  const ctx=await b.newContext({viewport:P.view,deviceScaleFactor:P.dpr});
  await ctx.addInitScript(init,{dur:DUR,fps:FPS,lang:LANG});
  const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
  // unter der echten Adresse laden (Ranglisten-Knöpfe sichtbar), aber ohne Netz: Datei kommt von der Festplatte
  const URL='https://burgergoat23-cyber.github.io/Tiefenrausch/',HTML=fs.readFileSync(path.join(ROOT,'index.html'));
  await ctx.route('**/*',r=>{const u=r.request().url();if(u.startsWith(URL))r.fulfill({contentType:'text/html',body:HTML});else r.abort();});
  await p.goto(URL+(P.hash||''));
  await p.evaluate(HELP);await p.evaluate(()=>{guest=true;try{au();}catch(e){}});
  let fr=0;const total=scenes.reduce((a,s)=>a+Math.round(s.sec*FPS),0);
  for(const sc of scenes){
    if(sc.setup)await p.evaluate(sc.setup);
    await p.evaluate(c=>{CAP=c?{a:c[0],b:c[1]||'',len:c[2],y:c[3]}:null;},sc.cap?[sc.cap[0],sc.cap[1],sc.capLen||sc.sec,sc.cy||0]:null);
    const n=Math.round(sc.sec*FPS);
    for(let i=0;i<n;i++){
      await p.evaluate(async e=>{try{if(e)(0,eval)(e);}catch(x){}VAP.tick();await __V.step();try{capDraw();}catch(x){}},sc.each||'');
      await p.screenshot({path:path.join(tmp,'f'+String(fr++).padStart(5,'0')+'.jpg'),type:'jpeg',quality:92});
      if(fr%150===0)console.log('  Bild',fr,'/',total);
      if(process.env.DBG&&fr%30===0)console.log(await p.evaluate(()=>{let er='';try{VAP.tick();}catch(x){er=x.message;}const ds=(st!=="play"?[]:en).map(e=>Math.hypot(e.x-me.x,e.y-me.y)|0).sort((a,b)=>a-b).slice(0,3);return JSON.stringify({er,ds,st2:st==="play"?[stairs.x|0,stairs.y|0]:0,chs:st==="play"?ch.filter(c=>!c.o).length:0,wig:VAP.wig,st,ui:ui&&ui.type,x:me&&me.x|0,y:me&&me.y|0,k:[keys.w,keys.a,keys.s,keys.d],kv:kv(),en:en&&en.length,ctrl:cfg.ctrl,joy:!!joy});}));
    }
  }
  const n=await p.evaluate(()=>__V.finish());const parts=[];
  for(let i=0;i<n;i+=4e6)parts.push(Buffer.from(await p.evaluate(([i])=>__V.chunk(i,4e6),[i]),'base64'));
  const pcm=Buffer.concat(parts);fs.writeFileSync(path.join(tmp,'a.raw'),pcm);
  await b.close();
  const name=P.file(LANG),out=path.join(OUT,name);fs.mkdirSync(OUT,{recursive:true});
  // Lautheit messen und auf ~-14 LUFS (YouTube) bringen, Spitzen mit Limiter abfangen
  const gain=lufsGain(`-f s16le -ar 48000 -ac 2 -i ${tmp}/a.raw`);
  execSync(`ffmpeg -y -loglevel error -framerate ${FPS} -i ${tmp}/f%05d.jpg -f s16le -ar 48000 -ac 2 -i ${tmp}/a.raw `+
    `-af "afade=t=in:d=0.4,afade=t=out:st=${(fr/FPS-1.2).toFixed(2)}:d=1.2,volume=${gain}dB,alimiter=limit=0.89:level=false" `+
    `-c:v libx264 -preset slow -crf 19 -pix_fmt yuv420p -c:a aac -b:a 192k -movflags +faststart -shortest ${out}`);
  fs.rmSync(tmp,{recursive:true,force:true});
  console.log('fertig:',out,(fs.statSync(out).size/1e6).toFixed(1)+' MB,',(fr/FPS).toFixed(1)+' s',errs.length?'JS-Fehler: '+errs.join(' | '):'');
})();
