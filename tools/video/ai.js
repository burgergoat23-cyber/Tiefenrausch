// Autopilot für Videos und Simulation (läuft im Spiel-Kontext). VAP.god=1: Held unverwundbar (nur für kurze Werbeclips),
// VAP.god=0: spielt ehrlich – weicht Warnkreisen/Geschossen aus (Dash), trinkt Heiltränke, kauft beim Händler, hebt bessere Ausrüstung auf.
// Achtung: das Spiel hat selbst eine globale Variable AP – deshalb VAP.
module.exports=`
window.VAP={stuck:0,lx:0,ly:0,wig:0,wx:0,wy:0,on:1,god:1,lfl:-1,deaths:0,cur:null,curT:0,ign:new Map(),fr:0,skip:new WeakSet(),at:0};
VAP.path=function(tx,ty){const sx=Math.floor(me.x/T),sy=Math.floor(me.y/T),gx=Math.floor(tx/T),gy=Math.floor(ty/T);
  if(sx===gx&&sy===gy)return null;const prev=new Int32Array(N*N).fill(-1),q=[sy*N+sx];prev[sy*N+sx]=sy*N+sx;
  for(let h=0;h<q.length;h++){const c=q[h],x=c%N,y=(c/N)|0;if(x===gx&&y===gy)break;
    for(const[dx,dy]of[[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]]){const nx=x+dx,ny=y+dy;if(nx<0||ny<0||nx>=N||ny>=N||map[ny][nx]===1)continue;
      if(dx&&dy&&(map[y][nx]===1||map[ny][x]===1))continue;const ni=ny*N+nx;if(prev[ni]>=0)continue;prev[ni]=c;q.push(ni);}}
  let c=gy*N+gx;if(prev[c]<0)return null;let nx=c;while(prev[c]!==sy*N+sx&&prev[c]!==c){nx=c;c=prev[c];}nx=c;return{x:(nx%N+.5)*T,y:(((nx/N)|0)+.5)*T};};
VAP.go=function(x,y,away,abs){let dx=x-me.x,dy=y-me.y;if(away){dx=-dx;dy=-dy;}const m=Math.hypot(dx,dy)||1;
  if(abs){if(Math.abs(dx)>3)keys[dx>0?'d':'a']=1;if(Math.abs(dy)>3)keys[dy>0?'s':'w']=1;return;}   // Wegpunkt genau anlaufen (keine Ecken)
  if(Math.abs(dx)/m>.38)keys[dx>0?'d':'a']=1;if(Math.abs(dy)/m>.38)keys[dy>0?'s':'w']=1;};
VAP.danger=function(){let fx=0,fy=0,h=0;
  for(const z of zp){const d=Math.hypot(me.x-z.x,me.y-z.y),R=z.r+18;if(d<R){const k=(R-d)/R+.6;fx+=(me.x-z.x)/(d||1)*k;fy+=(me.y-z.y)/(d||1)*k;h=Math.max(h,z.t<.5?2:1);}}
  for(const b of eb){const rx=me.x-b.x,ry=me.y-b.y,d=Math.hypot(rx,ry);if(d>110)continue;const sp=Math.hypot(b.vx,b.vy)||1;if((rx*b.vx+ry*b.vy)/sp<=0)continue;
    const perp=Math.abs(rx*b.vy-ry*b.vx)/sp;if(perp>(b.r||6)+16)continue;const px=-b.vy/sp,py=b.vx/sp,s=(rx*px+ry*py)>=0?1:-1;fx+=px*s*1.6;fy+=py*s*1.6;h=Math.max(h,d<60?2:1);}
  return h?{x:fx,y:fy,h}:null;};
VAP.buy=function(o){if(!o||o.s||gold<o.p||(o.cap&&me.mx>=HPMAX))return 0;gold-=o.p;o.f();if(o.one)o.s=1;else o.p=Math.round(o.p*o.g);return 1;};
VAP.shopping=function(){if(!shop||!shop.length)return;const F=n=>shop.find(o=>o.n.startsWith(n));
  for(let i=0;i<2&&me.pots.heal<2;i++)if(!VAP.buy(F('Heiltrank')))break;
  // Waffen/Rüstung beim Händler: nur wenn deutlich besser (Name → Waffe/Rüstung, Stufe aus der Klammer)
  const TI={'(Selten)':2,'(Episch)':3,'(Legendär)':4};
  for(const o of shop){if(o.s||!o.one||gold<o.p)continue;const tk=Object.keys(TI).find(k=>o.n.endsWith(k));if(!tk)continue;const t=TI[tk];
    const wi=WP.findIndex(w=>o.n===w.n+' '+tk);if(wi>=0){if(wsc({i:wi,t,a:[]})>wsc(me.w)*1.2)VAP.buy(o);continue;}
    const ai=ARN.findIndex(n=>o.n===n+' '+tk);if(ai>=0){const c=me.arm[ai];if(!c||t>c.t)VAP.buy(o);}}
  if(me.w2&&wsc(me.w2)>wsc(me.w)){const x=me.w;me.w=me.w2;me.w2=x;}   // stärkere Waffe in die Hand
  if(me.mx<HPMAX)VAP.buy(F('Herz'));VAP.buy(F('Schleifstein'));
  for(let i=0;i<4&&me.pots.heal<6;i++)if(!VAP.buy(F('Heiltrank')))break;
  if(me.pots.rage<2)VAP.buy(F('Wuttrank'));};
VAP.better=function(i){if(i.d)return 0;if(i.t==='weapon'&&i.w)return wsc(i.w)>wsc(me.w)*1.12;if(i.t==='armor'&&i.ar){const c=me.arm[i.ar.s];return !c||i.ar.t>c.t;}return 0;};
VAP.tick=function(){keys.w=keys.a=keys.s=keys.d=0;if(st!=='play'||!VAP.on)return;
  if(VAP.god){if(me.hp<Math.max(2,me.mx*.5))me.hp=me.mx;}
  if(ui){if(ui.type==='story'){ui.tt=(ui.tt||0)+1;if(ui.tt>75){const d=ui.done;ui=null;if(d)d();}}
    else if(ui.type==='npc'&&ui.n&&ui.n.t==='d'){ui.tt=(ui.tt||0)+1;if(ui.tt>70){const n=ui.n;ui=null;rescueVillager(n);}}   // Dorfbewohner: Gespräch kurz zeigen, dann retten
    else ui=null;return;}
  if(!VAP.god){
    if(VAP.lfl!==fl){VAP.lfl=fl;VAP.shopping();}
    if(me.hp<=Math.max(1,Math.ceil(me.mx*.4))&&me.pots.heal>0&&me.hp<me.mx)usePot('heal');
    const bs=en.find(e=>e.boss&&Math.hypot(e.x-me.x,e.y-me.y)<320);if(bs&&me.rage<=0&&me.pots.rage>0)usePot('rage');
    const dg=VAP.danger();if(dg&&(dg.h===2||me.hp<me.mx*.6)){VAP.go(me.x+dg.x*100,me.y+dg.y*100);if(dg.h===2&&dashCd<=0)dash();return;}   // bei vollem Leben nur akute Gefahr meiden, sonst angreifen
    const nb=nearAny();if(nb&&VAP.better(nb)){interact();}
  }
  const P=WP[me.w.i];let tg=null,rng=0,bd=1e9;VAP.fr++;
  // Zielsperre: aktuelles Ziel behalten (kein Hin-und-her an der Reichweitengrenze); unerreichbare Gegner eine Weile ignorieren
  if(VAP.cur&&(!en.includes(VAP.cur)||VAP.cur.hp<=0))VAP.cur=null;
  if(VAP.cur&&!VAP.cur.boss&&++VAP.curT>240){VAP.ign.set(VAP.cur,VAP.fr+1800);VAP.cur=null;}   // Boss nie ignorieren (Treppe bleibt sonst zu)
  if(VAP.cur){tg=VAP.cur;bd=Math.hypot(tg.x-me.x,tg.y-me.y);if(!VAP.god&&!tg.boss){if(los(me.x,me.y,tg.x,tg.y))VAP.nl=0;else if(++VAP.nl>45)bd=1e9;}if(bd>620){if(!VAP.cur.boss)VAP.ign.set(VAP.cur,VAP.fr+1800);VAP.cur=null;tg=null;bd=1e9;}}
  {const B=en.find(e=>e.boss);if(B&&!VAP.god&&tg!==B&&Math.hypot(B.x-me.x,B.y-me.y)<650&&!(tg&&Math.hypot(tg.x-me.x,tg.y-me.y)<55)){tg=B;VAP.cur=B;VAP.curT=0;bd=Math.hypot(B.x-me.x,B.y-me.y);}}   // Boss-Ebene: Boss zuerst (Diener ruft er immer neu)
  if(!tg){for(const e of en){if((VAP.ign.get(e)||0)>VAP.fr)continue;const d=Math.hypot(e.x-me.x,e.y-me.y);if(d<bd&&(VAP.god?d<520:(d<300&&los(me.x,me.y,e.x,e.y)))||e.boss&&d<bd){bd=d;tg=e;}}if(tg){VAP.cur=tg;VAP.curT=0;VAP.nl=0;}}   // ehrlich: nur sichtbare Gegner jagen, sonst weiter zur Treppe
  if(!VAP.god&&(!tg||bd>160))for(const i of it){if(!VAP.better(i)||VAP.skip.has(i))continue;const d=Math.hypot(i.x-me.x,i.y-me.y);if(d<380&&d<bd){bd=d;tg=i;tg._g=1;}}
  if(tg&&tg.hp)rng=Math.max(34,Math.min(P.rng*.75,P.proj?200:P.rng*.7));
  else if(!tg){const o=VAP.ot,ok=o&&(o===stairs||(ch.includes(o)&&!o.o)||it.includes(o))&&++VAP.otT<300;   // Sachziel behalten, bis erreicht
    const vil=(npcs||[]).find(n=>n.t==='d'&&!VAP.skip.has(n));
    if(vil){if(vil!==VAP.vt){VAP.vt=vil;VAP.vd=1e9;VAP.vn=0;}const d=Math.hypot(vil.x-me.x,vil.y-me.y);if(d<VAP.vd-2){VAP.vd=d;VAP.vn=0;}else if(++VAP.vn>120){VAP.skip.add(vil);}}   // unerreichbarer Dorfbewohner → weiter
    if(vil){tg=vil;if(Math.hypot(vil.x-me.x,vil.y-me.y)<60){interact();return;}}else if(ok){tg=o;}else{if(o&&o!==stairs&&VAP.otT>=300)VAP.skip.add(o);VAP.ot=null;
      for(const c of ch)if(!c.o&&!VAP.skip.has(c)){const d=Math.hypot(c.x-me.x,c.y-me.y);if(d<bd){bd=d;tg=c;}}
      for(const i of it){if(i.t==='weapon'&&!(i.w&&i.w.t>=7)||i.t==='armor'||VAP.skip.has(i)||(me.pots[i.t]>=9))continue;const d=Math.hypot(i.x-me.x,i.y-me.y);if(d<bd&&d<300){bd=d;tg=i;}}
      if(!tg){tg=stairs;}if(tg!==o||!o){VAP.ot=tg;VAP.otT=0;}else{VAP.ot=null;}}
    rng=4;}else rng=4;
  if(VAP.wig>0){VAP.wig--;keys[VAP.wx>0?'d':'a']=1;keys[VAP.wy>0?'s':'w']=1;return;}
  const dd=Math.hypot(tg.x-me.x,tg.y-me.y),see=los(me.x,me.y,tg.x,tg.y);
  if(!VAP.god&&tg.hp&&P.proj&&see&&dd<120){VAP.go(tg.x,tg.y,1);return;}          // Fernkampf: Abstand halten
  if(!VAP.god&&!tg.hp&&tg!==stairs){if(tg!==VAP.pt){VAP.pt=tg;VAP.pd=dd;VAP.pn=0;}else if(dd<VAP.pd-2){VAP.pd=dd;VAP.pn=0;}else if(++VAP.pn>45){VAP.skip.add(tg);VAP.ot=null;VAP.pt=null;}}   // kommt nicht näher → liegen lassen
  if(!tg.hp&&tg!==stairs&&dd<16){if(++VAP.at>20){VAP.skip.add(tg);VAP.ot=null;VAP.at=0;}}else VAP.at=0;   // erreicht, aber nicht aufhebbar → liegen lassen
  if(dd<=rng&&(!tg.hp||see))return;
  const n=(see&&dd<160)?tg:(VAP.path(tg.x,tg.y)||tg);VAP.go(n.x,n.y,0,n!==tg);VAP.dbg=[tg.t||(tg.hp?'en':tg===stairs?'stairs':'ch'),tg.x|0,tg.y|0,n.x|0,n.y|0,dd|0,see];
  if(Math.hypot(me.x-VAP.lx,me.y-VAP.ly)<.6){if(++VAP.stuck>20){VAP.stuck=0;VAP.wig=12;VAP.wx=Math.random()-.5;VAP.wy=Math.random()-.5;}}else VAP.stuck=0;VAP.lx=me.x;VAP.ly=me.y;};
VAP.toBoss=function(){const b=en.find(e=>e.boss);if(!b)return;for(const r of[150,120,190,90])for(let a=0;a<8;a++){const x=b.x+Math.cos(a*Math.PI/4)*r,y=b.y+Math.sin(a*Math.PI/4)*r;
  if(!hit(x,y,12)&&los(x,y,b.x,b.y)){me.x=x;me.y=y;const ci=Math.floor(x/T),cj=Math.floor(y/T);for(let i=-7;i<=7;i++)for(let j=-7;j<=7;j++){const X=ci+i,Y=cj+j;if(X>=0&&Y>=0&&X<N&&Y<N)vis[Y*N+X]=1;}return;}}};
// nach dem Tod: wie im Spiel „Fortsetzen“ vom letzten Speicherstand (Ebenenanfang)
VAP.revive=function(){VAP.deaths++;const sv=saves[mode==='story'?'story':'endless'];if(sv)newGame(sv);else newGame(undefined,mode);VAP.lfl=-1;};
`;
