// Funde aus der Code-Prüfung und dem Tester-Schwarm (Oktober 2026) – jeder Fund bekommt hier einen Test.
// Aufruf: node tests/pruefung.js   (nutzt tests/cur.html, wird von run.sh angelegt)
const {chromium}=(()=>{try{return require('playwright')}catch(e){return require('/opt/node-tools/node_modules/playwright')}})();
const path=require('path');
const F='file://'+path.join(__dirname,'cur.html');
let fail=0;const ok=(c,m)=>{console.log((c?'  OK  ':'  FAIL ')+m);if(!c)fail++;};
const DAY='2026-10-20T12:00:00+02:00';   // mitten im Halloween-Event
(async()=>{const b=await chromium.launch();const errs=[];
 const ctx=await b.newContext({viewport:{width:1024,height:700}});
 await ctx.addInitScript(d=>{const T=new Date(d).getTime(),D=Date;window.Date=class extends D{constructor(...a){super(...(a.length?a:[T]));}static now(){return T;}};},DAY);
 const p=await ctx.newPage();p.on('pageerror',e=>errs.push(e.message));await p.goto(F);await p.waitForTimeout(700);
 // Knopf im aktuellen Bild drücken (Beschriftung per RegExp)
 const press=re=>p.evaluate(src=>{const rx=new RegExp(src);let f=null;const o=btn;btn=function(x,y,w,h,l,fn){if(!f&&rx.test(String(l)))f=fn;return o.apply(this,arguments);};try{draw();}finally{btn=o;}if(f){f();return true;}return false;},re.source);

 // 1) Weiterspielen nach dem Tod: beim Tod wird neu gespeichert (Leben ≤ 0) → „fortsetzen“ startet die Ebene mit vollen Herzen,
 //    auch wenn vorher mitten in der Ebene mit 1 Herz gespeichert wurde (Trank, Händler …)
 await p.evaluate(()=>{newGame(undefined,'endless');fl=5;me.mx=10;me.hp=1;me.inv=0;saveGame();hurt(3);});
 ok(await p.evaluate(()=>st==='over'&&saves.endless.hp<=0),'Tod speichert den Stand neu (Leben ≤ 0)');
 ok(await press(/fortsetzen/),'Knopf „Ebene 5 fortsetzen“ vorhanden');
 const r1=await p.evaluate(()=>({st,fl,hp:me.hp,mx:me.mx}));
 ok(r1.st==='play'&&r1.fl===5&&r1.hp===10,'nach dem Tod weiter mit vollen Herzen '+JSON.stringify(r1));

 // 2) Boss-Helfer: höchstens 8 gerufene Helfer, auch wenn man lange weit weg bleibt (vorher über 400)
 const r2=await p.evaluate(()=>{const out={};for(const k of[6,9,11]){newGame(undefined,'endless');fl=12;gen();en=en.filter(e=>!e.boss);const n0=en.length;const B=mkB(k,me.x+900,me.y);en.push(B);
   for(let i=0;i<3000;i++){B.cd=9;bossAI(B,900,0,900,.1);}   // 300 s Spielzeit, Spieler 900 px entfernt
   out[k]={sum:minions(),neu:en.length-n0-1};}return out;});
 ok(Object.values(r2).every(v=>v.sum<=8&&v.neu<=8),'Boss ruft höchstens 8 Helfer '+JSON.stringify(r2));

 // 3) Halloween-Pass dauert länger: 1 Bonbon je 10 Gegner, 5 je Boss, Event-Aufgaben zusammen 410
 const r3=await p.evaluate(()=>{meta.hw={xp:0,cl:[],q:{},c:{},dy:[]};hwStart();const x0=meta.hw.xp;
   for(let i=0;i<9;i++)tqa('kill',1);const c9=run.candy;tqa('kill',1);const c10=run.candy;tqa('boss',1);
   return{c9,c10,c:run.candy,xp:meta.hw.xp-x0,evq:EVQ.reduce((a,q)=>a+q.r,0)};});
 ok(r3.c9===0&&r3.c10===1&&r3.c===6,'Bonbons: 10 Gegner = 1, Boss = 5 '+JSON.stringify(r3));
 ok(r3.evq===410,'Event-Aufgaben zusammen 410 Bonbons (vorher 1230) '+r3.evq);
 ok(await p.evaluate(()=>{const h=meta.hw;h.xp=950;h.cl=[0,1,2,3,4,5,6,7,8];hwXp(60);return h.cl.length===10&&meta.own.a.includes(10);}),'Pass vergibt weiter alle 10 Stufen inkl. exklusivem Skin');
 ok(await p.evaluate(()=>{setLang('en');const t=LTR('1 🍬 je 10 Gegner · 5 🍬 je Boss');setLang('de');return t==='1 🍬 per 10 enemies · 5 🍬 per boss';}),'Hinweis zu den Bonbons auf Englisch übersetzt');

 // 4) Glücksrad: Gewinn sofort gutgeschrieben, Anzeige erst am Ende; Laden während der Animation verlassen → nichts verloren
 const r4=await p.evaluate(()=>{u11Fix();meta.tk.e+=1000;meta.wh={d:dayKey(),n:1};st='ready';ui=null;shopOpen(0);shp.tab=2;const R=Math.random;Math.random=()=>0;
   const e0=meta.tk.e,s0=meta.tk.s;try{whSpin();}finally{Math.random=R;}const mid={e:meta.tk.e-e0,s:meta.tk.s-s0,msg:shp.msg};
   shp.wh.st=performance.now()-4000;draw();const end=shp.msg;shp=null;return{mid,end};});
 ok(r4.mid.s===100&&r4.mid.e===25&&r4.mid.msg==='','Glücksrad: 100 bezahlt, Gewinn (25) sofort gutgeschrieben, noch nicht verraten '+JSON.stringify(r4.mid));
 ok(/25 Marken/.test(r4.end),'Glücksrad: am Ende der Animation wird der Gewinn angezeigt: '+r4.end);

 // 5) Tages-Rangliste: ein einziger Abruf für Top 10 und eigenen Platz (Firebase-Lesungen sparen)
 const r5=await p.evaluate(async()=>{const k=dayKey();let gets=0;const docs=[];for(let i=0;i<25;i++)docs.push({data:()=>({d:k,s:1000-i*10,u:'p'+i})});
   const D={collection:()=>({where:()=>({orderBy:()=>({get:async()=>{gets++;return{docs};}})})})};const L0=window.lbDb,g0=gName;window.lbDb=async()=>D;gName='tester';meta.dbest={d:k,s:905};lb.st='';lb.t=0;
   try{await lbLoad(1);}finally{window.lbDb=L0;gName=g0;}return{gets,n:lb.rows.length,top:lb.rows[0].s,rank:lb.rank,st:lb.st};});
 ok(r5.gets===1&&r5.n===10&&r5.top===1000&&r5.rank===11&&r5.st==='ok','Rangliste: 1 Abruf, Top 10, eigener Platz berechnet '+JSON.stringify(r5));

 // 6) Abmelden: offene Cloud-Daten werden vorher hochgeladen, Rekord-Ebene des Kontos bleibt nicht am Gerät hängen
 const r6=await p.evaluate(async()=>{let w=null;acct={u:'tester',ref:{set:o=>{w=JSON.parse(JSON.stringify(o));return Promise.resolve();}},salt:'s',hash:'h',cr:5};
   meta.tk.e+=7;const e=meta.tk.e;best=42;try{localStorage.setItem('dg_best','42');}catch(x){}mcT=setTimeout(()=>{},60000);logout();await new Promise(r=>setTimeout(r,50));
   return{hoch:!!w&&w.meta.tk.e===e&&w.cr===5,best,ls:localStorage.getItem('dg_best'),acct:!!acct};});
 ok(r6.hoch&&r6.best===1&&r6.ls===null&&!r6.acct,'Abmelden lädt offene Daten hoch und setzt den Rekord zurück '+JSON.stringify(r6));

 // 7) Reservierte Namen: Registrieren wird sofort abgelehnt (vorher wurde erst das Firebase-Konto angelegt)
 const r7=await p.evaluate(async()=>{let m='',fs=0;const L=lgMsg,F=window.fbSign;lgMsg=t=>{m=t;};window.fbSign=async()=>{fs++;return null;};
   try{Q('un').value='admin';Q('pw').value='geheim1';await doAuth0(true);}finally{lgMsg=L;window.fbSign=F;}return{m,fs};});
 ok(/reserviert/.test(r7.m)&&r7.fs===0,'Name „admin“ wird ohne Firebase-Anmeldung abgelehnt '+JSON.stringify(r7));

 // 8) Datum (Berlin) mit festem Formatierer
 ok(await p.evaluate(()=>dayKey()==='2026-10-20'&&dayKey()===dayKey()),'dayKey liefert den Berliner Tag');

 // 9) Koop: Lauf, der als Koop begann, überschreibt nie den echten Endlos-Spielstand (auch nicht, wenn der Partner weg ist)
 const r9=await p.evaluate(()=>{newGame(undefined,'endless');fl=40;saveGame();const solo=saves.endless.fl;
   newGame(undefined,'endless');CO.on=true;coRun=1;CO.on=false;fl=5;saveGame();const nach=saves.endless.fl;   // Partner weg → allein weiter
   newGame(undefined,'endless');fl=6;saveGame();return{solo,nach,neu:saves.endless.fl};});
 ok(r9.solo===40&&r9.nach===40&&r9.neu===6,'Koop-Lauf überschreibt den Endlos-Spielstand nicht '+JSON.stringify(r9));

 // 10) Enter auf dem Game-Over-Bildschirm im Koop beendet die Verbindung (vorher blieb der Gast in einer eingefrorenen Welt)
 const r10=await p.evaluate(()=>{let n=0;const E=coopEnd;coopEnd=()=>{n++;CO.on=false;};CO.on=true;st='over';endAsk=1;
   try{dispatchEvent(new KeyboardEvent('keydown',{key:'Enter'}));dispatchEvent(new KeyboardEvent('keyup',{key:'Enter'}));}finally{coopEnd=E;CO.on=false;}return{n,st,endAsk};});
 ok(r10.n===1&&r10.st==='ready'&&r10.endAsk===0,'Enter nach Koop-Game-Over beendet Koop '+JSON.stringify(r10));

 // 11) Koop-Gast: Dash nur mit Abklingzeit (Shift halten = vorher dauerhaft unverwundbar beim Gastgeber)
 const r11=await p.evaluate(()=>{newGame(undefined,'endless');let n=0;const S=coSend;coSend=o=>{if(o&&o.c==='dash')n++;};CO.on=true;CO.role='guest';dashCd=0;ui=null;
   try{for(let i=0;i<10;i++)dash();}finally{coSend=S;CO.on=false;CO.role=null;}
   return{n};});
 ok(r11.n===1,'Gast-Dash: 10× gedrückt → 1 Befehl an den Gastgeber '+JSON.stringify(r11));

 // 12) Händler: Preise/Einzelstücke bleiben nach „Hauptmenü + Fortsetzen“ (vorher wieder Grundpreis)
 const r12=await p.evaluate(()=>{newGame(undefined,'endless');fl=5;gen();const i=shop.findIndex(o=>/Schleifstein/.test(o.n)),j=shop.findIndex(o=>o.one);
   const p0=shop[i].p;shop[i].p=Math.round(shop[i].p*shop[i].g);shop[i].p=Math.round(shop[i].p*shop[i].g);const p2=shop[i].p;shop[j].s=1;saveGame();
   newGame(saves.endless);return{i,j,p0,p2,p:shop[i].p,s:shop[j].s};});
 ok(r12.i>=0&&r12.p2>r12.p0&&r12.p===r12.p2&&r12.s===1,'Händler-Preise und Einzelstücke bleiben nach Fortsetzen '+JSON.stringify(r12));

 // 13) Story-Ebene 15: „Boss besiegt“ wird nicht gespeichert (sonst nach Neuladen kein Ende, Treppe zu Ebene 16)
 ok(await p.evaluate(()=>{newGame(undefined,'story');fl=15;bkf=15;saveGame();const a=saves.story.bk;fl=14;bkf=14;saveGame();return a===0&&saves.story.bk===14;}),'Story: Endboss-Sieg wird nicht als „besiegt“ gespeichert, andere Bosse schon');

 // 14) Tageslauf: Boss-Truhe gibt allen dieselbe Beute, egal wo der Boss starb
 const r14=await p.evaluate(()=>{const loot=(x,y)=>{newGame(undefined,'endless');mode='daily';dKey=dayKey();dSeed=daySeed(dKey);fl=6;const n0=it.length;openChest({x,y,o:0,boss:1});
   const L=it.slice(n0).map(i=>i.t+':'+(i.w?i.w.i+'/'+i.w.t+'/'+(i.w.a||[]).join('.'):'')+(i.ar?'A'+i.ar.s+'/'+i.ar.t:''));mode='endless';return L.sort().join(',');};
   return{a:loot(200,300),b:loot(900,1400)};});
 ok(r14.a===r14.b&&r14.a.length>0,'Tageslauf: Boss-Truhe überall gleich '+JSON.stringify(r14).slice(0,160));

 // 15) Geteilte Mini-Gegner sind nie Elite
 ok(await p.evaluate(()=>{const R=Math.random;Math.random=()=>0;const n0=en.length;try{varSplit({x:me.x,y:me.y,v:0,mx:20});}finally{Math.random=R;}const m=en.slice(n0);en.length=n0;return m.length===2&&m.every(x=>!x.el);}),'geteilte Mini-Gegner sind keine Elite');

 // 16) Anmeldefenster: Enter auf einem Knopf startet keinen Lauf dahinter
 const r16=await p.evaluate(()=>{st='ready';const L=Q('lg'),d0=L.style.display;L.style.display='block';const B=L.querySelector('button')||document.body;
   try{B.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true}));B.dispatchEvent(new KeyboardEvent('keyup',{key:'Enter',bubbles:true}));}finally{L.style.display=d0;}return{st,tag:B.tagName};});
 ok(r16.st==='ready'&&r16.tag==='BUTTON','Enter auf Knopf im Anmeldefenster startet keinen Lauf '+JSON.stringify(r16));

 console.log('JS-Fehler:',errs.length?errs.slice(0,6):'keine');if(errs.length)fail++;
 console.log(fail?fail+' FEHLGESCHLAGEN':'ALLE TESTS BESTANDEN');await b.close();process.exit(fail?1:0);})();
