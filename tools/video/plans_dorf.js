// Edits zu Update 12/13 (Dorf, Innenräume, Skins, Vorher/Nachher) – hochkant 1080x1920, Schnitte auf 80 BPM (ein Schlag = 0,75 s).
// Aufnahme ohne Musik (nur Spielgeräusche): node tools/video/rec.js edit_dorf  → promo/edit_dorf_ohne_musik.mp4
// KI-Musik danach drunterlegen: python3 tools/video/musik_mix.py <video> <musik.wav> <ab-Sekunde> <ziel.mp4>  (ab = M0 im Plan)
// Alles im Bild gibt es wirklich im Spiel; das Dorf wird ohne Knöpfe gezeigt (window.__clean), damit es wie ein Film wirkt.
const B=60/80;
const INIT=`if(!window.__cl){window.__cl=1;
 const U=vUI;vUI=function(){if(!window.__clean)return U();if(VL.sc&&VL.sc.ph<2)return;if(vPanel)vPanelDraw();else if(vTalk)vTalkDraw();};
 const TL=titleLogo,DG=document.createElement('canvas').getContext('2d');titleLogo=function(a,b,c){if(window.__clean!==1)return TL(a,b,c);const g0=g;g=DG;try{return TL(a,b,c);}finally{g=g0;}};
 const VI=vInterior;vInterior=function(L,s){if(!window.__clean||s.ph!==1)return VI(L,s);s.ph=2;try{return VI(L,s);}finally{s.ph=1;}};
 const SM=vScMenu;vScMenu=function(){if(!window.__nomenu)SM();};}
 cfg.mus=0;meta.nws=99;u11Fix();VAP.god=1;window.__f=0;window.__nomenu=0;`;   // __clean: 1 = ohne Knöpfe/Logo, 2 = nur Logo; __nomenu: Szene bleibt im Innenraum/Tunnel
const X=k=>typeof k==='number'?String(k):`vBld().B.find(q=>q.k==='${k}').x`;
// Dorf-Einstellung: Held bei Gebäude/Position k (+dx), Blick F, optional Böe (tm), Logo sichtbar (logo), Laufen (walk: 1 rechts, -1 links)
const V=(k,o)=>{o=o||{};return `${INIT}history.replaceState(null,'','#dorf');st='ready';ui=null;bk=null;shp=null;CO.lob=null;vPanel=null;vTalk=null;VL.sc=null;
 window.__clean=${o.logo?2:1};if(!VN||VN.ev!==hwOn()){const L=vLay();vNpcInit(L);VN.ev=hwOn();vAnimInit(L);}VL.x=${X(k)}+${o.dx||0};VL.cam=-1;VL.tx=null;VL.go=null;VL.F=${o.F||1};VL.hold=0;keys.arrowleft=0;keys.arrowright=0;
 ${o.tm!=null?`tm=${o.tm};`:''}${o.walk?`keys.${o.walk>0?'arrowright':'arrowleft'}=1;`:''}`;};
const SAY=(id,i)=>`{const n=VN.find(q=>q.id==='${id}');if(n){n.bub={s:n.l[${i||0}],t:3.1,t0:vNow(),vc:0};}}`;
// direkt im Innenraum (Begrüßung tippt, Stimme läuft); hält Phase 1, bis die Szene vorbei ist
const IN=k=>V(k)+`vScStart('${k}');VL.sc.ph=1;VL.sc.t=0;VL.sc.vo={t0:vNow()+.2,vc:0};window.__nomenu=1;`,
  TUN=V('tor')+"vScStart('tor');VL.sc.ph=1;VL.sc.t=0;window.__nomenu=1;";
const SK=(a,w)=>`meta.sk={a:${a},w:${w}};if(!meta.own.a.includes(${a}))meta.own.a.push(${a});if(!meta.own.w.includes(${w}))meta.own.w.push(${w});`;
const RC=['#cfd3e6','#5cb8ff','#c77dff','#ffb347','#ff5df0'];   // Seltenheits-Farben wie im Shop (RAR)
const END={sec:2*B,setup:V('platz',{logo:1,dx:-40,tm:14.6}),zoom:1.06,flash:false};
const E={
  // 1) Das Dorf lebt: ruhiger Anfang am Brunnen, ab dem Beat Kamerafahrten an den Häusern vorbei, Gespräch, Portal
  edit_dorf:{M0:9,scenes:()=>[
    {sec:4*B,setup:V('platz',{dx:-70,tm:13.6})+SAY('barde'),each:"if(++window.__f===38)"+SAY('baeuerin'),cap:['Mein Spiel hat jetzt ein Dorf 🏘️'],hook:1,cy:.17,zoom:1.12,slow:.8,flash:false},
    {sec:2*B,setup:V('buch',{dx:-170,walk:1,tm:14.2}),slow:.6,zoom:1.08},
    {sec:2*B,setup:V('shop',{dx:-150,walk:1})+SAY('haendler'),slow:.6,zoom:1.1},
    {sec:2*B,setup:V('haus2',{dx:-150,walk:1,tm:14.4})+SAY('baecker'),slow:.6,zoom:1.08},
    {sec:2*B,setup:V('hw',{dx:-170,walk:1})+SAY('hexe'),slow:.6,zoom:1.1},
    {sec:2*B,setup:V(560,{dx:-90,walk:1})+SAY('post'),slow:.6,zoom:1.12},   // Postbote: „Post für dich! … Ach nein, doch nicht.“
    {sec:2*B,setup:V('brett',{dx:-160,walk:1,tm:14.2})+SAY('bgm'),slow:.6,zoom:1.08},
    {sec:2*B,setup:V('tor',{dx:-4})+"window.__nomenu=1;vEnter('tor');",zoom:1.15},
    END]},
  // 2) Hinter jeder Tür: Laden-Tür geht im Takt auf, dann Innenräume mit Begrüßung
  edit_innen:{M0:21,scenes:()=>[
    {sec:4*B,setup:V('shop',{dx:-8,F:1})+SAY('haendler',1)+'window.__nomenu=1;',each:"if(++window.__f===64)vEnter('shop');",cap:['Was ist hinter der Tür? 🚪'],hook:1,cy:.17,zoom:1.15,flash:false},
    {sec:4*B,zoom:1.08,flash:false},   // weiter im Laden (Begrüßung tippt)
    {sec:4*B,setup:IN('buch'),zoom:1.08},
    {sec:4*B,setup:IN('brett'),zoom:1.08},
    {sec:2*B,setup:IN('hw'),zoom:1.1},
    {sec:2*B,setup:TUN,zoom:1.2}]},
  // 3) Skins: ein Skin pro Schlag (Bossfeld, Held kämpft), Name in Seltenheits-Farbe; Schluss: Shop mit glänzenden Karten
  edit_skins:{M0:33,scenes:()=>{const a=[{sec:4*B,setup:V('platz',{dx:-40,tm:14})+SK(0,0),cap:['Welcher Skin ist der beste? 👇'],hook:1,cy:.17,zoom:1.45,zc:[.5,.74],flash:false}];
    const L=[[1,1,'Waldläufer'],[2,3,'Frostwächter'],[3,2,'Glutritter'],[4,4,'Schattenklinge'],[7,8,'Skelettritter'],[8,7,'Kürbiskopf'],[5,5,'Goldener Paladin'],[9,9,'Hexenmeister'],[6,6,'Sternenwanderer'],[10,8,'Geisterwächter']];
    const P=[['buch',-60],['shop',-110],['haus2',-90],['brett',-70],['haus1',0],['hw',-50],['brett',250],['haus1',150],['tor',-150],['tor',0]];   // Plätze ohne Dorfbewohner davor
    L.forEach(([s,w,n],i)=>{const r=[0,1,1,2,2,2,3,3,4,4][i],last=i>=8;   // Held groß im Dorf, Kamera auf ihn gezoomt; Vorlauf, damit die Effekte schon da sind
      a.push({sec:(last?2:1)*B,setup:V(P[i][0],{dx:P[i][1],F:i%2?-1:1,tm:14+i*.25})+SK(s,w),pre:24,cap:[n],capCol:RC[r],hook:last?1:0,z0:1.62,zoom:last?1.85:1.72,zc:[.5,.76]});});
    a.push({sec:4*B,setup:V('platz',{dx:-40})+SK(10,8)+"shopOpen(0);",zoom:1.05,flash:false});return a;}},
  // 4) Vorher/Nachher: altes Menü (Update 11) → Dorf (Update 13) genau auf dem Beat
  edit_glowup:{M0:43.5,scenes:()=>[
    {sec:6*B,setup:INIT+"history.replaceState(null,'','#alt');window.__clean=0;st='ready';ui=null;bk=null;shp=null;CO.lob=null;vPanel=null;vTalk=null;VL.sc=null;",cap:['Update 11'],capCol:'#cfd3e6',cy:.88,zoom:1.06,flash:false},
    {sec:2*B,setup:V('platz',{dx:-70,tm:14.2})+SAY('barde'),cap:['Update 13 🔥'],hook:1,cy:.17,zoom:1.15},
    {sec:2*B,setup:V('platz',{dx:-20,F:-1})+SAY('kind2'),zoom:1.3,zc:[.5,.7]},   // Kind Lotte: „Hast du schon den Geist im Halloween-Haus gesehen?“
    {sec:2*B,setup:IN('shop'),zoom:1.08},
    {sec:2*B,setup:V('tor',{dx:-150,tm:14.3})+SK(6,6),pre:24,z0:1.62,zoom:1.78,zc:[.5,.76]},   // Skin „Sternenwanderer“ groß
    {sec:2*B,setup:V('hw',{dx:-170,walk:1,tm:14.4})+SAY('hexe'),slow:.6,zoom:1.1},
    {sec:2*B,setup:IN('buch'),zoom:1.08},
    {sec:2*B,setup:TUN,zoom:1.2},
    END]}};
for(const k in E){const f=E[k].scenes;E[k].scenes=l=>f(l).map((s,i)=>Object.assign({flash:i===1},s,i===1?{}:{flash:false}));}
for(const k in E)module.exports[k]={view:{width:432,height:768},dpr:2.5,hash:'#dorf',file:()=>`${k}_ohne_musik.mp4`,music:'keine',bpm:80,beatfx:1,beatk:k==='edit_skins'?.8:.45,beatn:2,fade:.3,M0:E[k].M0,
  vf:'eq=contrast=1.05:saturation=1.12,vignette=PI/5',scenes:E[k].scenes};
