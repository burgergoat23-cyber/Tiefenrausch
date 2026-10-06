// Tester-Schwarm: viele Computer-Spieler (Skript-Bots, keine KI) spielen das Spiel je ca. 60 Minuten Spielzeit im simulierten Browser
// und prüfen dabei Fehler und Regeln (Invarianten). Zeit läuft simuliert (schneller als echt), gezeichnet wird nur jedes n-te Bild.
// Aufruf: node tests/swarm.js --n 1000 --workers 4 --min 60 [--out Ordner] [--seed 1] [--only Regex] [--idx 2,25] [--draw 30] [--resume] [--report]
// Matrix je Lauf: Gerät (PC/iPad/Handy, hoch/quer) × Sprache × Modus (Endlos/Story/Tageslauf/Halloween) × Spielstil × Zufalls-Seed.
// Spielstile: pilot = ehrlicher Autopilot (+ kurze Menü-Ausflüge), gott = Autopilot unverwundbar (tiefe Ebenen),
//             affe = drückt zufällige sichtbare Knöpfe und Tasten überall, dorf = Dorf, Häuser, Gespräche, Shop, dann Spiel.
// Ergebnis: <out>/runs.jsonl (eine Zeile je Lauf) und <out>/report.md (Fehler gruppiert, mit Lauf-Nummer zum Nachstellen).
const {chromium}=(()=>{try{return require('playwright')}catch(e){return require('/opt/node-tools/node_modules/playwright')}})();
const fs=require('fs'),path=require('path'),{fork}=require('child_process');
const A=process.argv.slice(2),arg=(k,d)=>{const i=A.indexOf('--'+k);return i>=0?A[i+1]:d;};
const N=+arg('n',100),WORK=+arg('workers',4),MIN=+arg('min',60),SEED=+arg('seed',1),ONLY=arg('only',''),DRAWN=+arg('draw',150),
  OUT=arg('out',path.join(__dirname,'swarm_out')),WID=arg('worker',null),IDX=arg('idx','')?arg('idx','').split(',').map(Number):null;   // --idx 2,25: nur diese Läufe (zum Nachstellen)
const GAME=fs.readFileSync((()=>{const i=process.argv.indexOf('--game');return i>=0?process.argv[i+1]:path.join(__dirname,'cur.html');})()),AI=require('../tools/video/ai.js'),URL='https://burgergoat23-cyber.github.io/Tiefenrausch/';
const DEV=[['pc',1280,800,0],['pc',1024,640,0],['ipad',820,1180,1],['ipad',1180,820,1],['handy',390,844,1],['handy',844,390,1]];
const MODES=['endless','story','daily','hw','endless','story'],STY=['pilot','gott','affe','dorf','pilot','gott'];
function cfgOf(i){const h=(i*2654435761+SEED*97)>>>0;const d=DEV[i%DEV.length],m=MODES[Math.floor(i/6)%MODES.length],s=STY[Math.floor(i/36)%STY.length];
  return{i,dev:d[0],w:d[1],h:d[2],touch:!!d[3],lang:(i%2)?'en':'de',mode:m,style:s,seed:h||1};}

// ---------- im Spiel: Prüf-Werkzeuge ----------
const HARNESS=`(()=>{if(window.SW)return;const fin=x=>typeof x==='number'&&isFinite(x);
 window.SW={errs:[],seen:{},err(w,e){const m=w+': '+(e&&e.message||e);if(SW.seen[m])return;SW.seen[m]=1;SW.errs.push(m+' @ '+String(e&&e.stack||'').split('\\n').slice(1,3).join(' | ').replace(/https?:[^ )]*/g,'').slice(0,200));}};
 for(const f of ['update','metaTick','u11Draw','musicTick','vScene','vUI','drawHUD','drawUI','drawTitle','drawShopScreen','drawBookScreen','guestUpdate','heroAttack','interact'])
  if(typeof window[f]==='function'){const F=window[f];window[f]=function(){try{return F.apply(this,arguments);}catch(e){SW.err(f,e);throw e;}};}
 const D=window.draw;let dc=0;SW.drawNow=function(){try{D();}catch(e){SW.err('draw',e);}};window.draw=function(){if(++dc%SW.DRAWN)return;try{return D.apply(this,arguments);}catch(e){SW.err('draw',e);throw e;}};
 SW.check=function(){const v=[];
  if(st==='play'||st==='over'){if(!fin(me.x)||!fin(me.y))v.push('Held-Position NaN');if(!fin(me.hp)||me.hp<0||me.hp>me.mx+1e-6)v.push('Held-Leben '+me.hp+'/'+me.mx);if(me.mx>HPMAX)v.push('Herzen über Maximum '+me.mx);
   if(me.hp>0&&typeof hit==='function'&&fin(me.x)&&hit(me.x,me.y,2))v.push('Held steckt in der Wand (Ebene '+fl+', '+mode+')');
   if(!fin(gold)||gold<0)v.push('Gold '+gold);if(!(fl>=1))v.push('Ebene '+fl);
   for(const e of en){if(!fin(e.x)||!fin(e.y)||!fin(e.hp)){v.push('Gegner NaN'+(e.boss?' (Boss)':''));break;}}if(en.length>400)v.push('sehr viele Gegner '+en.length);
   for(const[n,a]of[['pt',pt],['fx',fx],['eb',eb],['pb',pb],['it',it],['vf',typeof vf!=='undefined'?vf:[]]])if(a&&a.length>4000)v.push('Liste '+n+' wächst: '+a.length);
   for(const k in me.pots)if(!fin(me.pots[k])||me.pots[k]<0)v.push('Trank '+k+' '+me.pots[k]);}
  const tk=meta.tk;if(tk&&(!fin(tk.e)||!fin(tk.s)||tk.s>tk.e))v.push('Marken '+JSON.stringify(tk));
  if(meta.hw&&!fin(meta.hw.xp))v.push('Pass-Punkte '+meta.hw.xp);
  if(typeof errT==='string'&&errT)v.push('Fehlerleiste: '+errT);
  return v;};
 SW.diag=function(){const r={fl,mode,st,ui:ui&&ui.type,ctrl:cfg.ctrl,me:[me.x|0,me.y|0,me.hp,me.mx],en:en.length,boss:en.filter(e=>e.boss).map(e=>[e.x|0,e.y|0,e.hp|0]),dbg:typeof VAP!=='undefined'&&VAP.dbg?String(VAP.dbg):''};
  try{if(typeof stairs!=='undefined'&&stairs&&map){const tx=Math.floor(stairs.x/T),ty=Math.floor(stairs.y/T),hx=Math.floor(me.x/T),hy=Math.floor(me.y/T);r.stairs=Object.assign({},stairs);const rows=[];
   for(let y=Math.max(0,Math.min(ty,hy)-3);y<=Math.min(N-1,Math.max(ty,hy)+3);y++){let q='';for(let x=Math.max(0,Math.min(tx,hx)-4);x<=Math.min(N-1,Math.max(tx,hx)+4);x++)q+=(x===tx&&y===ty)?'S':(x===hx&&y===hy)?'H':(map[y][x]===1?'#':'.');rows.push(q);}r.karte=rows;}}catch(e){r.diagErr=e.message;}
  return r;};
 SW.probe=function(){const out={},x0=me.x,y0=me.y,on=VAP.on;VAP.on=0;
  try{for(const k of['w','a','s','d']){me.x=x0;me.y=y0;for(const q of['w','a','s','d'])keys[q]=0;for(let i=0;i<20;i++){keys[k]=1;__run(1);}keys[k]=0;out[k]=[Math.round(me.x-x0),Math.round(me.y-y0)];}}
  finally{VAP.on=on;me.x=x0;me.y=y0;}
  {const B=en.find(e=>e.boss);if(B)out.boss={k:B.k,v:B.v,x:B.x|0,y:B.y|0,hp:B.hp,mx:B.mx,wandMitte:!!wall(B.x,B.y),sicht:los(me.x,me.y,B.x,B.y),d:Math.hypot(B.x-me.x,B.y-me.y)|0,
    rest:Object.keys(B).filter(k=>!['x','y','hp','mx','id','k','cd','t2','ph','kx','ky','fl','age','s','dx','dy','boss'].includes(k)).map(k=>k+'='+(typeof B[k]==='number'?+B[k].toFixed(2):JSON.stringify(B[k]))).join(' ')};
   const P=WP[me.w.i];out.waffe={i:me.w.i,t:me.w.t,rng:P.rng,proj:!!P.proj,arc:P.arc,atk:+(+me.atk||0).toFixed(2)};}
  out.wand=!!hit(me.x,me.y,2);out.vap={cur:VAP.cur?(VAP.cur.boss?'boss':'gegner'):null,ot:VAP.ot===stairs?'treppe':VAP.ot?(VAP.ot.t||'ding'):null,wig:VAP.wig|0,god:VAP.god|0,pn:VAP.pn|0,at:VAP.at|0};
  out.st={dashT:typeof dashT!=='undefined'?+dashT.toFixed(2):null,slow:me.slow||0,ui:ui&&ui.type,kx:me.kx|0,ky:me.ky|0};
  if(SW.TRACE){out.trace=[];const H0=window.hurt;window.hurt=function(d){const ne=en.reduce((b,e)=>{const q=Math.hypot(e.x-me.x,e.y-me.y);return q<b[0]?[q,e]:b;},[1e9,null]);
     out.trace.push('  HURT d='+d+' hp='+me.hp+'/'+me.mx+' inv='+(+me.inv||0).toFixed(2)+' nahGegner='+(ne[1]?(ne[1].boss?'BOSS':'k'+ne[1].k)+'@'+(ne[0]|0):'-')+' zonen='+zp.length+' kugeln='+eb.filter(b=>Math.hypot(b.x-me.x,b.y-me.y)<30).length+' fallen='+(typeof tr!=='undefined'?tr.filter(t=>Math.hypot(t.x-me.x,t.y-me.y)<20).length:'?'));return H0.apply(this,arguments);};
    try{for(let i=0;i<(SW.TRACE>1?SW.TRACE:40);i++){if(st==='over'){out.trace.push('  TOT → fortsetzen');VAP.revive();out.trace.push('  neu: '+[me.x|0,me.y|0,me.hp,me.mx].join(' '));}VAP.tick();if(i%5===0||SW.TRACE<=1)out.trace.push([i,me.x|0,me.y|0,me.hp,['w','a','s','d'].filter(k=>keys[k]).join(''),String(VAP.dbg||'').slice(0,40),VAP.cur?(VAP.cur.x|0)+','+(VAP.cur.y|0):'-',(()=>{const B=en.find(e=>e.boss);return B?'boss hp='+B.hp+' sicht='+los(me.x,me.y,B.x,B.y)+' atk='+(+me.atk||0).toFixed(2):'';})()].join(' '));__run(1);}}finally{window.hurt=H0;}}
  return out;};
 // zufälligen sichtbaren Knopf drücken (Trefferliste btns wird beim Zeichnen gebaut)
 SW.press=function(skip){SW.drawNow();const L=(btns||[]).filter(b=>b&&b.fn&&b.w>4&&b.h>4&&!(skip&&skip.test(String(b.label||''))));if(!L.length)return'';const b=L[Math.floor(Math.random()*L.length)];
  try{b.fn();}catch(e){SW.err('Knopf '+(b.label||'?'),e);}return String(b.label||'');};
})();`;

async function runOne(browser,c){
  const ctx=await browser.newContext({viewport:{width:c.w,height:c.h},hasTouch:c.touch,isMobile:c.touch&&c.dev==='handy',deviceScaleFactor:1});
  ctx.on('page',p=>{if(p.url()!=='about:blank'&&!p.url().startsWith(URL))p.close().catch(()=>{});});   // Fremd-Links (window.open) schließen
  await ctx.route('**/*',r=>{const u=r.request().url();if(u.startsWith(URL))r.fulfill({contentType:'text/html',body:GAME});else r.abort();});
  await ctx.addInitScript(o=>{let now=0,raf=null;performance.now=()=>now;window.requestAnimationFrame=cb=>{raf=cb;return 1;};
    window.__run=n=>{for(let i=0;i<n;i++){now+=1000/30;if(raf){const f=raf;raf=null;f(now);}}};
    let a=o.seed>>>0;Math.random=()=>{a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};
    try{localStorage.setItem('dg_cfg',JSON.stringify({lang:o.lang,snd:0,mus:0,ctrl:o.touch?2:0}));}catch(e){}window.prompt=()=>null;window.confirm=()=>true;window.alert=()=>{};},c);
  const p=await ctx.newPage();const errs=[];
  p.on('pageerror',e=>errs.push('Seitenfehler: '+e.message));
  p.on('console',m=>{if(m.type()==='error'){const t=m.text();if(!/Failed to load resource|net::ERR|firebase|gstatic|ERR_FAILED|Firestore|auth\//i.test(t))errs.push('Konsole: '+t.slice(0,200));}});
  const t0=Date.now(),R={i:c.i,cfg:c,maxfl:0,deaths:0,ends:0,viol:{},stuck:[],xp:[],ms:0};
  try{
    await p.goto(URL+'#dorf');await p.evaluate(()=>__run(5));
    await p.evaluate(AI);await p.evaluate(HARNESS);await p.evaluate(([d,t])=>{SW.DRAWN=d;SW.TRACE=t;guest=true;meta.nws=99;try{u11Fix();}catch(e){}},[DRAWN,A.includes('--trace')?(+arg('trace',1)||1):0]);
    // Anfang: ein bisschen Dorf (alle Stile), Stil „dorf“ deutlich länger
    const villMin=c.style==='dorf'?6:c.style==='affe'?2:0.5;
    await p.evaluate(([n,sty])=>{const B=()=>vBld().B.filter(b=>b.n);let k=0;
      for(let f=0;f<n;f++){if(f%45===0){const r=Math.random();
          if(VL.sc&&VL.sc.ph>=2){shp=null;bk=null;vPanel=null;}
          else if(vPanel||shp||bk||vTalk){if(Math.random()<.5)SW.press();else{shp=null;bk=null;vPanel=null;vTalk=null;}}
          else if(r<.3){const b=B()[Math.floor(Math.random()*B().length)];if(b)vEnter(b.k);}
          else if(r<.45&&VN&&VN.length){const v=VN[Math.floor(Math.random()*VN.length)];VL.x=v.x-50;VL.cam=-1;vTalkTo(v);}
          else if(r<.6)VL.tx=60+Math.random()*(vLay().WW-120);
          else if(r<.75&&sty!=='pilot')SW.press();
          else if(r<.8)setLang(Math.random()<.5?'de':'en');}
        __run(1);if(st!=='ready')break;}},[Math.round(villMin*60*30),c.style]);
    await p.evaluate(()=>{shp=null;bk=null;vPanel=null;vTalk=null;VL.sc=null;});
    // Spiel starten
    const start=m=>`(()=>{st='ready';ui=null;if('${m}'==='hw'&&hwOn())hwStart();else newGame(undefined,'${m}'==='hw'?'endless':'${m}');VAP.god=${c.style==='gott'?1:0};ui=null;})()`;
    await p.evaluate(start(c.mode));
    const FR=MIN*60*30,CH=300;let lastFl=0,flT=0;R.snaps=[];
    const snap=async w=>{try{const d=await p.evaluate(w=>{SW.drawNow();const r=SW.diag();if(w==='haengt')try{r.probe=SW.probe();}catch(e){r.probe=String(e);}return r;},w);const f='lauf'+c.i+'_'+w+'_'+R.snaps.length+'.png';fs.mkdirSync(path.join(OUT,'bilder'),{recursive:true});
      await p.screenshot({path:path.join(OUT,'bilder',f)});R.snaps.push({w,bild:f,d});}catch(e){}};
    for(let f=0;f<FR;f+=CH){
      const s=await p.evaluate(([CH,sty,mode,f])=>{let deaths=0,ends=0;
        for(let i=0;i<CH;i++){
          if(sty==='affe'){if(i%15===0){const r=Math.random();if(r<.35)SW.press();else if(r<.5){keys[['w','a','s','d','arrowleft','arrowright'][Math.floor(Math.random()*6)]]=1;}
              else if(r<.6)dash();else if(r<.7)usePot(['heal','rage','swift'][Math.floor(Math.random()*3)]);else if(r<.78)ui=ui?null:{type:Math.random()<.5?'menu':'inv'};else if(r<.85)interact();else if(r<.88)swapSlots();
              else if(r<.9&&st==='ready'){newGame(undefined,['endless','story','daily'][Math.floor(Math.random()*3)]);}}
            if(st==='play'&&!ui&&i%60<40)VAP.tick();}
          else{VAP.tick();
            if(sty==='pilot'&&(f+i)%3600===1800){const c0=cfg.ctrl;ui={type:Math.random()<.5?'menu':'inv'};SW.press(/Beenden|Verlassen|Hauptmenü|Neu|Abmelden|Quit|Leave|Main menu|New/);ui=null;cfg.ctrl=c0;}   // Steuerung zurück: der Autopilot „drückt“ keine echten Tasten
            if((f+i)%2700===900&&st==='play'&&Math.random()<.5){usePot('heal');swapSlots();}}
          __run(1);
          if(st==='over'){deaths++;if(SW.dfl===fl)SW.dn++;else{SW.dfl=fl;SW.dn=1;}if(sty==='affe'||mode==='daily'||mode==='hw'){if(mode==='hw'&&hwOn())hwStart();else newGame(undefined,mode==='daily'?'endless':mode==='hw'?'endless':mode);}else if(SW.dn>=5){SW.dn=0;SW.neu=(SW.neu||0)+1;newGame(undefined,mode);}else VAP.revive();VAP.god=sty==='gott'?1:0;ui=null;}
          else if(st==='end'){ends++;newGame(undefined,'endless');ui=null;}
          else if(st==='bye'||st==='ready'){if(sty!=='affe'||Math.random()<.02){st='ready';shp=null;bk=null;vPanel=null;newGame(undefined,mode==='hw'||mode==='daily'?'endless':mode);ui=null;}}
          if(ui&&ui.type==='story'&&Math.random()<.05){const d=ui.done;ui=null;if(d)d();}}
        return{fl,st,deaths,ends,v:SW.check(),xp:meta.hw?meta.hw.xp:0,dbg:VAP.dbg?String(VAP.dbg).slice(0,80):''};},[CH,c.style,c.mode,f]);
      R.deaths+=s.deaths;R.ends+=s.ends;R.maxfl=Math.max(R.maxfl,s.fl);
      for(const v of s.v){if(!R.viol[v]){R.viol[v]={n:0,min:+(f/1800).toFixed(1)};if(Object.keys(R.viol).length<=3)await snap('regel');}R.viol[v].n++;}
      if(f%1800===0)R.xp.push(s.xp);
      if(s.fl!==lastFl){lastFl=s.fl;flT=f;}else if((c.style==='pilot'||c.style==='gott')&&s.st==='play'&&f-flT>30*60*10&&!R.stuck.length){R.stuck.push({fl:s.fl,min:+(f/1800).toFixed(1),dbg:s.dbg});await snap('haengt');}
    }
    const fin=await p.evaluate(()=>({errs:SW.errs.slice(0,20),kills:typeof KT==='function'?KT():0,bosses:typeof BKT==='function'?BKT():0,tk:meta.tk,hw:meta.hw&&{xp:meta.hw.xp,cl:meta.hw.cl.length},maxfl:meta.maxfl,neu:SW.neu||0}));
    Object.assign(R,{gameErrs:fin.errs,kills:fin.kills,bosses:fin.bosses,tk:fin.tk,hw:fin.hw,metaMaxfl:fin.maxfl,neuStart:fin.neu});
  }catch(e){R.crash=String(e.message||e).slice(0,300);}
  R.pageErrs=[...new Set(errs)].slice(0,20);R.ms=Date.now()-t0;
  await ctx.close().catch(()=>{});return R;}

async function worker(k){const b=await chromium.launch();const out=fs.openSync(path.join(OUT,'runs.jsonl'),'a');
  const fertig=new Set();try{for(const l of fs.readFileSync(path.join(OUT,'runs.jsonl'),'utf8').split('\n'))if(l)fertig.add(JSON.parse(l).i);}catch(e){}   // --resume: schon gelaufene überspringen
  for(let i=k;i<N;i+=WORK){if(fertig.has(i)||IDX&&!IDX.includes(i))continue;const c=cfgOf(i);if(ONLY&&!new RegExp(ONLY).test(c.dev+' '+c.mode+' '+c.style+' '+c.lang))continue;
    const R=await runOne(b,c);fs.writeSync(out,JSON.stringify(R)+'\n');}
  await b.close();}

function report(){const L=fs.readFileSync(path.join(OUT,'runs.jsonl'),'utf8').trim().split('\n').filter(Boolean).map(l=>JSON.parse(l));
  const grp={},add=(k,r,extra)=>{(grp[k]=grp[k]||{n:0,runs:[],ex:extra});grp[k].n++;if(grp[k].runs.length<5)grp[k].runs.push(r.i);};
  for(const r of L){for(const e of r.pageErrs||[])add('JS: '+e.replace(/\d+/g,'#'),r);for(const e of r.gameErrs||[])add('Spiel: '+e.replace(/ @ .*/,'').replace(/\d+/g,'#'),r,e);
    for(const v in r.viol||{})add('Regel: '+v.replace(/\d+(\.\d+)?/g,'#'),r);for(const s of r.stuck||[])add('Hängt fest auf einer Ebene (über 10 min)',r,JSON.stringify(s));if(r.crash)add('Lauf abgebrochen: '+r.crash.replace(/\d+/g,'#'),r);}
  const by=k=>{const o={};for(const r of L){const x=r.cfg[k];o[x]=(o[x]||0)+1;}return Object.entries(o).map(([a,b])=>a+' '+b).join(', ');};
  const hw=L.filter(r=>r.cfg.mode==='hw'&&r.cfg.style==='pilot'&&r.xp&&r.xp.length);
  const avg=a=>a.length?a.reduce((x,y)=>x+y,0)/a.length:0;
  const xpAt=m=>Math.round(avg(hw.map(r=>r.xp[Math.min(m,r.xp.length-1)]||0)));
  let md=`# Tester-Schwarm – ${new Date().toISOString().slice(0,16)}\n\nLäufe: ${L.length} × ${MIN} min Spielzeit = ${Math.round(L.length*MIN/60)} Spielstunden · Dauer gesamt ${Math.round(L.reduce((a,r)=>a+r.ms,0)/1000/60/WORK)} min (${WORK} parallel)\n\n`;
  md+=`Geräte: ${by('dev')}\n\nModi: ${by('mode')}\n\nSpielstile: ${by('style')}\n\nSprachen: ${by('lang')}\n\n`;
  md+=`Tiefste Ebene: ${Math.max(...L.map(r=>r.maxfl||0))} · Tode gesamt: ${L.reduce((a,r)=>a+(r.deaths||0),0)} · Story beendet: ${L.reduce((a,r)=>a+(r.ends||0),0)}×\n\n`;
  {const t={};for(const r of L){const k=r.cfg.style+' / '+r.cfg.mode;const o=t[k]=t[k]||{n:0,fl:0,tod:0,neu:0,h:0,k:0};o.n++;o.fl+=r.maxfl||0;o.tod+=r.deaths||0;o.neu+=r.neuStart||0;o.h+=(r.stuck||[]).length?1:0;o.k+=r.kills||0;}
   md+='| Spielstil / Modus | Läufe | Ø tiefste Ebene | Ø Gegner besiegt | Tode | Neustarts (5 Tode) | hängt |\n|---|---|---|---|---|---|---|\n'+Object.keys(t).sort().map(k=>{const o=t[k];return `| ${k} | ${o.n} | ${(o.fl/o.n).toFixed(1)} | ${Math.round(o.k/o.n)} | ${o.tod} | ${o.neu} | ${o.h} |`;}).join('\n')+'\n\n';}
  if(hw.length)md+=`Halloween-Pass (ehrlicher Autopilot, ${hw.length} Läufe): Punkte nach 15 min ≈ ${xpAt(15)}, 30 min ≈ ${xpAt(30)}, 60 min ≈ ${xpAt(60)}\n\n`;
  const ks=Object.keys(grp).sort((a,b)=>grp[b].n-grp[a].n);
  md+=`## Funde (${ks.length})\n\n`+(ks.length?ks.map(k=>`- **${grp[k].n}×** ${k}  · Läufe ${grp[k].runs.join(', ')}${grp[k].ex?'\n  - Beispiel: '+String(grp[k].ex).slice(0,300):''}`).join('\n'):'Keine.')+'\n';
  fs.writeFileSync(path.join(OUT,'report.md'),md);console.log(md);}

(async()=>{
  if(WID!=null){await worker(+WID);return;}
  fs.mkdirSync(OUT,{recursive:true});if(A.includes('--report')){report();return;}
  if(!A.includes('--resume'))try{fs.unlinkSync(path.join(OUT,'runs.jsonl'));}catch(e){}
  console.log(`Schwarm: ${N} Läufe × ${MIN} min, ${WORK} parallel → ${OUT}`);
  const t0=Date.now(),kids=[];for(let k=0;k<WORK;k++)kids.push(new Promise(res=>{const ch=fork(__filename,[...A,'--worker',String(k)]);ch.on('exit',res);}));
  const tick=setInterval(()=>{let n=0;try{n=fs.readFileSync(path.join(OUT,'runs.jsonl'),'utf8').split('\n').filter(Boolean).length;}catch(e){}console.log(`  ${n}/${N} Läufe fertig (${Math.round((Date.now()-t0)/60000)} min)`);},60000);
  await Promise.all(kids);clearInterval(tick);report();})();
