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

 console.log('JS-Fehler:',errs.length?errs.slice(0,6):'keine');if(errs.length)fail++;
 console.log(fail?fail+' FEHLGESCHLAGEN':'ALLE TESTS BESTANDEN');await b.close();process.exit(fail?1:0);})();
