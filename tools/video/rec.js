// Werbevideos für Tiefenrausch: spielt das Spiel Bild für Bild mit Autopilot ab, nimmt Bild + Ton (Spielmusik/Geräusche) auf
// und baut mit ffmpeg ein MP4.   Aufruf:  node tools/video/rec.js <plan> [de|en] [Zielordner]
//   plan = shorts (1080x1920, ~30 s) | lang (1920x1080, ~2,5 min)
// Zeit ist simuliert (performance.now / requestAnimationFrame), Ton über OfflineAudioContext im Gleichschritt → flüssig und synchron.
const {chromium}=(()=>{try{return require('playwright')}catch(e){return require('/opt/node-tools/node_modules/playwright')}})();
const fs=require('fs'),path=require('path'),{execSync}=require('child_process');
const PLAN=process.argv[2]||'shorts',LANG=process.argv[3]||'de',ROOT=path.join(__dirname,'..','..');
const OUT=process.argv[4]||path.join(ROOT,'promo');const FPS=30;
const P=require('./plans.js')[PLAN];if(!P)throw new Error('Unbekannter Plan '+PLAN);
const scenes=P.scenes(LANG),tmp=fs.mkdtempSync(path.join(require('os').tmpdir(),'vid-'));
// KI-Sprecher: Sätze vorab erzeugen, Szenen mindestens so lang wie ihr Satz (+ Luft)
const VO_IN=.15,NOVO=!!process.env.NOVO;   // NOVO=1: gleicher Schnitt (Szenenlängen nach Sprechertext), aber ohne Stimme – z. B. für eigene Stimme in CapCut
{const L=scenes.map(s=>s.vo||'');fs.writeFileSync(path.join(tmp,'vo.json'),JSON.stringify(L));
  const d=JSON.parse(execSync(`python3 ${path.join(__dirname,'tts.py')} ${LANG} ${tmp} ${path.join(tmp,'vo.json')}`).toString().trim().split('\n').pop());
  scenes.forEach((s,i)=>{s.voDur=d[i];if(d[i])s.sec=Math.max(s.sec,Math.ceil((d[i]+VO_IN+.45)*FPS)/FPS);});}
const DUR=scenes.reduce((a,s)=>a+s.sec+(s.pre||0)/FPS,0)+1;

function lufs(inp){const o=execSync(`ffmpeg -hide_banner -nostats ${inp} -af ebur128=framelog=quiet -f null - 2>&1`).toString();
  const m=/I:\s+(-?[\d.]+) LUFS/.exec(o.split('Summary')[1]||'');return m?+m[1]:-70;}
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
      now+=1000/cfg.fps*(window.__slow||1);if(raf){const f=raf;raf=null;f(now);}},
    async finish(){realResume();const b=await rendering;const n=b.length,L=b.getChannelData(0),R=b.getChannelData(1),o=new Int16Array(n*2);
      for(let i=0;i<n;i++){o[2*i]=Math.max(-1,Math.min(1,L[i]))*32767;o[2*i+1]=Math.max(-1,Math.min(1,R[i]))*32767;}
      window.__pcm=new Uint8Array(o.buffer);return window.__pcm.length;},
    chunk(i,sz){const a=window.__pcm.subarray(i,i+sz);let s='';for(let j=0;j<a.length;j+=8192)s+=String.fromCharCode.apply(null,a.subarray(j,j+8192));return btoa(s);}};
}
// --- Autopilot + Untertitel (im Spiel) ---
const HELP=require('./ai.js')+`
window.CAP=null;
// Effekt-Ebene über dem Spiel (wird nicht mitgezoomt): Untertitel, Übergangsblitz
window.OC=document.createElement('canvas');OC.style.cssText='position:fixed;left:0;top:0;width:100vw;height:100vh;pointer-events:none;z-index:50';document.body.appendChild(OC);
OC.width=innerWidth*devicePixelRatio;OC.height=innerHeight*devicePixelRatio;window.OX=OC.getContext('2d');
window.FXS=function(i,n,z,fl,bf){const k=n>1?i/(n-1):1,e=k*k*(3-2*k);let zz=1+(z-1)*e,sx=0,sy=0,ca=0,fa=0,gl=0;
  // Takt-Effekte (Edits): Zoom-Schlag, Wackeln, Farbverschiebung, Blitz auf der Eins, Glitch jeden 8. Schlag
  if(bf&&bf.t>=bf.intro){const q=(bf.t-bf.intro)/bf.beat,bn=Math.floor(q+1e-6),bp=(q-bn)*bf.beat;zz*=1+.13*Math.exp(-bp*9);
    const sh=Math.exp(-bp*13)*16;sx=(Math.random()-.5)*sh;sy=(Math.random()-.5)*sh;ca=Math.exp(-bp*9);if(bn%4===0)fa=.22*Math.exp(-bp*20);if(bn%8===7&&bp<.12)gl=1;}
  OX.setTransform(1,0,0,1,0,0);OX.clearRect(0,0,OC.width,OC.height);
  if(zz>1.001||bf){const w=cv.width/zz,h=cv.height/zz,ox=(cv.width-w)/2-sx,oy=(cv.height-h)/2-sy;OX.imageSmoothingQuality='high';OX.drawImage(cv,ox,oy,w,h,0,0,OC.width,OC.height);   // Heranzoomen: Ausschnitt des Spielbilds
    if(ca>.05){const d=Math.round(ca*6*devicePixelRatio);OX.globalAlpha=.16*ca;
      OX.filter='grayscale(1) sepia(1) saturate(8) hue-rotate(-40deg)';OX.drawImage(cv,ox,oy,w,h,d,0,OC.width,OC.height);
      OX.filter='grayscale(1) sepia(1) saturate(8) hue-rotate(160deg)';OX.drawImage(cv,ox,oy,w,h,-d,0,OC.width,OC.height);
      OX.filter='none';OX.globalAlpha=1;OX.globalCompositeOperation='source-over';}
    if(gl){for(let j=0;j<7;j++){const y=Math.random()*OC.height,hh=(8+Math.random()*40)*devicePixelRatio,dx=(Math.random()-.5)*60*devicePixelRatio;OX.drawImage(OC,0,y,OC.width,hh,dx,y,OC.width,hh);}}}
  OX.setTransform(devicePixelRatio,0,0,devicePixelRatio,0,0);
  if(fa>.02){OX.fillStyle='rgba(255,255,255,'+fa+')';OX.fillRect(0,0,innerWidth,innerHeight);}
  if(fl&&i<9){OX.fillStyle='rgba(255,246,220,'+(.7*(1-i/9))+')';OX.fillRect(0,0,innerWidth,innerHeight);}};
window.capDraw=function(){const c=CAP;if(!c)return;c.t=(c.t||0)+1/30;const a=Math.min(1,c.t*5,Math.max(0,(c.len-c.t)*4));if(a<=0)return;
  const g=OX,W=innerWidth,H=innerHeight;g.save();g.globalAlpha=a;const L=W>H,big=Math.min(L?40:30,W/(L?24:14.5))*(c.hook?1.45:1),y0=H*(c.y||(L?.80:.15));
  {const q=Math.max(0,1-c.t/.22),sc=1+.28*q*q;g.translate(W/2,y0);g.scale(sc,sc);g.translate(-W/2,-y0);}
  g.font='700 '+big+'px '+FD;const lines=[];{let cur='';for(const w of c.a.split(' ')){const t=cur?cur+' '+w:w;if(cur&&g.measureText(t).width>W*.84){lines.push(cur);cur=w;}else cur=t;}if(cur)lines.push(cur);}const h=lines.length*big*1.18+(c.b?big*.95:0)+big*.7;
  const gr=g.createLinearGradient(0,y0-h*.62,0,y0+h*.62);gr.addColorStop(0,'rgba(8,5,12,0)');gr.addColorStop(.25,'rgba(8,5,12,.78)');gr.addColorStop(.75,'rgba(8,5,12,.78)');gr.addColorStop(1,'rgba(8,5,12,0)');
  g.fillStyle=gr;g.fillRect(0,y0-h*.62,W,h*1.24);let y=y0-h/2+big*.95;g.textAlign='center';
  for(const l of lines){g.font='700 '+big+'px '+FD;g.lineWidth=big*.16;g.strokeStyle='rgba(0,0,0,.85)';g.strokeText(l,W/2,y);g.fillStyle=c.col||'#ffd98a';g.fillText(l,W/2,y);y+=big*1.18;}
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
  for(const [si,sc] of scenes.entries()){
    if(sc.setup)await p.evaluate(sc.setup);
    await p.evaluate(c=>{CAP=c?{a:c[0],b:c[1]||'',len:c[2],y:c[3],hook:c[4],col:c[5]}:null;},sc.cap?[sc.cap[0],sc.cap[1],sc.capLen||(sc.voDur?Math.min(sc.sec,sc.voDur+1.4):sc.sec),sc.cy||0,sc.hook||0,sc.capCol||'']:null);
    await p.evaluate(v=>{window.__slow=v;},sc.slow||1);
    for(let k=0;k<(sc.pre||0);k++)await p.evaluate(async()=>{VAP.tick();await __V.step();});   // Vorlauf (nicht im Video): Szene kommt in Gang
    if(sc.after)await p.evaluate(sc.after);
    const n=Math.round(sc.sec*FPS);sc.t0=fr/FPS;
    for(let i=0;i<n;i++){
      await p.evaluate(async([e,i,n,z,f,bf,rp])=>{try{if(e)(0,eval)(e);}catch(x){}if(rp)window.__slow=rp[0]+(rp[1]-rp[0])*(n>1?i/(n-1):1);VAP.tick();await __V.step();try{FXS(i,n,z,f,bf);capDraw();}catch(x){}},[sc.each||'',i,n,sc.zoom||1,sc.flash!==false&&si>0,P.beatfx?{t:fr/FPS,beat:60/(P.bpm||120),intro:scenes[0].sec}:null,sc.ramp||null]);
      await p.screenshot({path:path.join(tmp,'f'+String(fr++).padStart(5,'0')+'.jpg'),type:'jpeg',quality:92});
      if(fr%150===0)console.log('  Bild',fr,'/',total);
      if(process.env.DBG2&&fr%10===0)console.log(fr,await p.evaluate(()=>JSON.stringify({st,bk:!!bk,ui:ui&&ui.type,cvT:cv.style.transform,W,H,ld:loadT,fade:fadeT,err:typeof errT!=='undefined'?errT:''})));
      if(process.env.DBG&&fr%30===0)console.log(await p.evaluate(()=>{let er='';try{VAP.tick();}catch(x){er=x.message;}const ds=(st!=="play"?[]:en).map(e=>Math.hypot(e.x-me.x,e.y-me.y)|0).sort((a,b)=>a-b).slice(0,3);return JSON.stringify({er,ds,st2:st==="play"?[stairs.x|0,stairs.y|0]:0,chs:st==="play"?ch.filter(c=>!c.o).length:0,wig:VAP.wig,st,ui:ui&&ui.type,x:me&&me.x|0,y:me&&me.y|0,k:[keys.w,keys.a,keys.s,keys.d],kv:kv(),en:en&&en.length,ctrl:cfg.ctrl,joy:!!joy});}));
    }
  }
  const n=await p.evaluate(()=>__V.finish());const parts=[];
  for(let i=0;i<n;i+=4e6)parts.push(Buffer.from(await p.evaluate(([i])=>__V.chunk(i,4e6),[i]),'base64'));
  const pcm=Buffer.concat(parts);fs.writeFileSync(path.join(tmp,'a.raw'),pcm);
  await b.close();
  const name=P.file(LANG).replace('.mp4',NOVO?'_ohne_stimme.mp4':'.mp4'),out=path.join(OUT,name);fs.mkdirSync(OUT,{recursive:true});
  // Ton mischen: Spiel leiser (-27 LUFS), Sprecher vorn (-17 LUFS), Spiel duckt sich unter die Stimme; danach gesamt auf ~-14 LUFS
  const RAW=`-f s16le -ar 48000 -ac 2 -i ${tmp}/a.raw`,vos=scenes.map((s,i)=>s.voDur&&!NOVO?{f:path.join(tmp,'vo_'+i+'.wav'),t:s.t0+VO_IN}:null).filter(Boolean);
  const gG=Math.max(-10,Math.min(24,(NOVO?-16:-27)-lufs(RAW))).toFixed(1);let fc=`[1:a]volume=${gG}dB[g];`,ins='';
  if(vos.length){const iv=lufs(`-i ${vos[0].f}`),gV=Math.max(-10,Math.min(24,-17-iv)).toFixed(1);
    vos.forEach((v,k)=>{ins+=` -i ${v.f}`;const ms=Math.round(v.t*1000);fc+=`[${k+2}:a]aresample=48000,aformat=channel_layouts=stereo,highpass=f=90,acompressor=threshold=-20dB:ratio=3:attack=5:release=80,volume=${gV}dB,adelay=${ms}|${ms}[v${k}];`;});
    fc+=vos.map((v,k)=>`[v${k}]`).join('')+`amix=inputs=${vos.length}:normalize=0:dropout_transition=0,apad[vo];[vo]asplit[vo1][vo2];[g][vo1]sidechaincompress=threshold=0.02:ratio=5:attack=20:release=400[dk];[dk][vo2]amix=inputs=2:normalize=0:duration=first[mx]`;}
  else fc+='[g]anull[mx]';
  if(P.music==='keine')execSync(`ffmpeg -y -loglevel error -f s16le -ar 48000 -ac 2 -i ${tmp}/a.raw -t ${(fr/FPS).toFixed(3)} ${tmp}/mix.wav`);   // nur Spielton (Trend-Sound kommt in der App dazu)
  else if(P.music==='phonk')execSync(`python3 ${path.join(__dirname,'phonk.py')} ${tmp}/mix.wav ${(fr/FPS).toFixed(3)} ${scenes[0].sec} ${P.bpm||120}`);
  else if(P.music)execSync(`python3 ${path.join(__dirname,'musik.py')} ${tmp}/mix.wav ${(fr/FPS).toFixed(3)} ${scenes[0].sec}`);   // eigene Musik statt Spielton
  else execSync(`ffmpeg -y -loglevel error -f lavfi -i anullsrc=r=48000:cl=stereo ${RAW}${ins} -filter_complex "${fc}" -map "[mx]" -t ${(fr/FPS).toFixed(3)} ${tmp}/mix.wav`);
  const gain=lufsGain(`-i ${tmp}/mix.wav`);
  const T=fr/FPS,VF=[P.vf,P.fade?`fade=t=in:st=0:d=${P.fade},fade=t=out:st=${(T-P.fade*1.5).toFixed(2)}:d=${(P.fade*1.5).toFixed(2)}`:''].filter(Boolean).join(',');
  execSync(`ffmpeg -y -loglevel error -framerate ${FPS} -i ${tmp}/f%05d.jpg -i ${tmp}/mix.wav `+(VF?`-vf "${VF}" `:'')+
    `-af "afade=t=in:d=0.3,afade=t=out:st=${(fr/FPS-1.2).toFixed(2)}:d=1.2,volume=${gain}dB,alimiter=limit=0.89:level=false" `+
    `-c:v libx264 -preset slow -crf 22 -pix_fmt yuv420p -c:a aac -b:a 192k -movflags +faststart -shortest ${out}`);
  if(!process.env.KEEP)fs.rmSync(tmp,{recursive:true,force:true});else console.log('tmp',tmp);
  if(NOVO)fs.writeFileSync(out.replace('.mp4','_sprechtext.txt'),scenes.filter(s=>s.vo).map(s=>`${(s.t0+VO_IN).toFixed(1).replace('.',',')} s  ${s.vo}`).join('\n')+'\n');
  console.log('fertig:',out,(fs.statSync(out).size/1e6).toFixed(1)+' MB,',(fr/FPS).toFixed(1)+' s',errs.length?'JS-Fehler: '+errs.join(' | '):'');
})();
