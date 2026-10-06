// Update 11: Marken, Aufgaben, Skin-Shop (Avatar/Waffe), Glücksrad, Halloween-Event (Pass, Dungeon, Menü).
// Aufruf: node tests/u11.js   (nutzt tests/cur.html, wird von run.sh angelegt). Bilder: tests/u11_*.png
const {chromium}=(()=>{try{return require('playwright')}catch(e){return require('/opt/node-tools/node_modules/playwright')}})();
const path=require('path');
const F='file://'+path.join(__dirname,'cur.html');
let fail=0;const ok=(c,m)=>{console.log((c?'  OK  ':'  FAIL ')+m);if(!c)fail++;};
const DAY='2026-10-20T12:00:00+02:00';   // mitten im Halloween-Event
(async()=>{const b=await chromium.launch();const errs=[];
 // Knöpfe eines Bildes einsammeln (Beschriftung + Aktion)
 const grab=p=>p.evaluate(()=>{const L=[];const o=btn;btn=function(x,y,w,h,l,fn){L.push(String(l));return o.apply(this,arguments);};try{draw();}finally{btn=o;}return L;});
 const press=(p,re)=>p.evaluate(src=>{const rx=new RegExp(src);let f=null;const o=btn;btn=function(x,y,w,h,l,fn){if(!f&&rx.test(String(l)))f=fn;return o.apply(this,arguments);};try{draw();}finally{btn=o;}if(f){f();return true;}return false;},re.source);
 const open=async(vp,day)=>{const ctx=await b.newContext({viewport:vp});await ctx.addInitScript(d=>{const T=new Date(d).getTime(),D=Date;window.Date=class extends D{constructor(...a){super(...(a.length?a:[T]));}static now(){return T;}};},day||DAY);
  const p=await ctx.newPage();p.on('pageerror',e=>errs.push(e.message));await p.goto(F);await p.waitForTimeout(700);return {ctx,p};};
 for(const vp of [{width:820,height:1180},{width:390,height:844},{width:844,height:390}]){
  const {ctx,p}=await open(vp),tag=vp.width+'x'+vp.height;
  const L=await grab(p);ok(L.includes('🛒 Shop & Aufgaben')&&L.includes('🎃 Halloween-Event'),tag+': Menü hat Shop- und Event-Knopf '+JSON.stringify(L));
  ok(await p.evaluate(()=>hwOn()),tag+': Halloween-Event aktiv (20.10.)');
  await p.screenshot({path:path.join(__dirname,'u11_menu_'+vp.width+'.png')});
  // Shop: Marken geben, Skin kaufen und ausrüsten
  await p.evaluate(()=>{meta.tk={e:5000,s:0};shopOpen(0);shp.sel=6;});
  ok(await press(p,/^Kaufen/),tag+': Kaufen-Knopf');
  ok(await p.evaluate(()=>meta.own.a.includes(6)&&meta.sk.a===6&&tkBal()===5000-RAR[SKA[6].r].p),tag+': Avatar-Skin gekauft, ausgerüstet, Marken abgezogen');
  await p.evaluate(()=>draw());await p.screenshot({path:path.join(__dirname,'u11_shop_'+vp.width+'.png')});
  await p.evaluate(()=>{shp.tab=1;shp.sel=6;});ok(await press(p,/^Kaufen/)&&await p.evaluate(()=>meta.sk.w===6),tag+': Waffen-Skin gekauft');
  await p.evaluate(()=>{shp.sel=0;});ok(await press(p,/^Ausrüsten/)&&await p.evaluate(()=>meta.sk.w===0),tag+': Standard-Waffe wieder ausrüsten');
  await p.evaluate(()=>{meta.sk.w=6;draw();});await p.screenshot({path:path.join(__dirname,'u11_waffen_'+vp.width+'.png')});
  // nicht genug Marken
  await p.evaluate(()=>{meta.tk={e:10,s:0};shp.tab=0;shp.sel=5;});await press(p,/^Kaufen/);ok(await p.evaluate(()=>!meta.own.a.includes(5)&&/Nicht genug/.test(shp.msg)),tag+': ohne genug Marken kein Kauf');
  ok(await p.evaluate(()=>{shp.sel=10;draw();return !meta.own.a.includes(10);})&&!(await grab(p)).some(l=>/^Kaufen/.test(l)),tag+': exklusiver Pass-Skin nicht kaufbar');
  // Glücksrad: 1× gratis, dann 100 Marken
  await p.evaluate(()=>{shp.tab=2;shp.msg='';meta.wh={d:'',n:0};meta.tk={e:1000,s:0};});
  ok((await grab(p)).some(l=>/Gratis drehen/.test(l)),tag+': Gratis-Dreh angeboten');
  const before=await p.evaluate(()=>({b:tkBal(),a:meta.own.a.length,w:meta.own.w.length}));
  await press(p,/Gratis drehen/);await p.waitForTimeout(3400);for(let i=0;i<3;i++)await p.evaluate(()=>draw());
  const aft=await p.evaluate(()=>({b:tkBal(),a:meta.own.a.length,w:meta.own.w.length,m:shp.msg,free:whFree()}));
  ok(!aft.free&&(aft.b>before.b||aft.a>before.a||aft.w>before.w)&&aft.m,tag+': Gratis-Dreh gibt etwas '+JSON.stringify(aft));
  await p.screenshot({path:path.join(__dirname,'u11_rad_'+vp.width+'.png')});
  ok((await grab(p)).some(l=>/Drehen: 100/.test(l)),tag+': danach kostet ein Dreh 100 Marken');
  const b2=await p.evaluate(()=>meta.tk.s);await press(p,/Drehen: 100/);ok(await p.evaluate(b=>meta.tk.s===b+100&&shp.wh&&shp.wh.t<1,b2),tag+': bezahlter Dreh zieht 100 ab');
  // Aufgaben
  await p.evaluate(()=>{shp.tab=3;draw();});await p.screenshot({path:path.join(__dirname,'u11_aufgaben_'+vp.width+'.png')});
  await p.evaluate(()=>{shp.tab=4;draw();});await p.screenshot({path:path.join(__dirname,'u11_event_'+vp.width+'.png')});
  ok((await grab(p)).includes('🎃 Halloween-Dungeon starten'),tag+': Event-Fenster mit Dungeon-Knopf');
  await press(p,/^Zurück$/);ok(await p.evaluate(()=>shp===null),tag+': Zurück schließt den Shop');
  // Held mit Skin im Spiel + Halloween-Dungeon
  await p.evaluate(()=>{meta.sk={a:9,w:9};meta.own.a.push(9);meta.own.w.push(9);shopOpen(4);});await press(p,/Halloween-Dungeon starten/);
  ok(await p.evaluate(()=>st==='play'&&mode==='hw'&&WD.ti===4),tag+': Halloween-Dungeon läuft mit eigenem Look');
  for(let i=0;i<30;i++)await p.evaluate(()=>{update(.016);draw();});
  await p.evaluate(()=>{me.swg=null;heroAttack();for(let i=0;i<6;i++){update(.016);draw();}});
  await p.screenshot({path:path.join(__dirname,'u11_dungeon_'+vp.width+'.png')});
  await ctx.close();}
 // Logik: Aufgaben, Meilensteine, Pass, Speichern, Zusammenführen
 {const {ctx,p}=await open({width:820,height:1180});
  const r=await p.evaluate(()=>{meta.tk={e:0,s:0};const ds=qdToday(),out={n:ds.length};
   for(const q of ds){if(q.k==='floor')tqa('floor',q.n);else if(q.k==='share'){shCnt=0;u11Share();}else tqa(q.k,q.n);}
   out.done=ds.every(q=>meta.qd.c[q.id]);out.tk=tkBal();out.sum=ds.reduce((a,q)=>a+q.r,0);return out;});
  ok(r.n===3&&r.done&&r.tk>=r.sum,'3 Tagesaufgaben, alle erledigt → Marken gutgeschrieben '+JSON.stringify(r));
  ok(await p.evaluate(()=>{const a=qdToday().map(q=>q.id).join();return a===qdToday().map(q=>q.id).join();}),'Tagesaufgaben stehen für den Tag fest');
  ok(await p.evaluate(()=>{best=30;meta.qm={};const t0=tkBal();u11Check();return meta.qm.m10&&meta.qm.m25&&!meta.qm.m50&&tkBal()===t0+80+150;}),'Meilensteine (Ebene 10/25) einmalig belohnt');
  ok(await p.evaluate(()=>{const t0=tkBal();u11Check();return tkBal()===t0;}),'Meilenstein nicht doppelt');
  const pass=await p.evaluate(()=>{meta.hw={xp:0,cl:[],q:{},c:{},dy:[]};hwStart();const s0=JSON.stringify(saves);for(let i=0;i<10;i++)tqa('kill',1);tqa('boss',1);const c=run.candy;hwXp(2000);fl=4;saveGame();return{c,xp:meta.hw.xp,cl:meta.hw.cl.length,ex:meta.own.a.includes(10),gw:meta.own.w.includes(8),saved:JSON.stringify(saves)!==s0};});
  ok(pass.c===6&&pass.cl===10&&pass.ex&&pass.gw,'Bonbons zählen, Pass vergibt alle 10 Stufen inkl. exklusivem Skin '+JSON.stringify(pass));
  ok(!pass.saved,'Halloween-Lauf wird nicht gespeichert');
  ok(await p.evaluate(()=>{const ok1=!(best>30&&false);return meta.hw.q.hwd>=1&&meta.hw.c.h1;}),'Event-Aufgabe „Betritt den Dungeon“ erledigt');
  // Halloween-Gegner: im Halloween-Dungeon nur Halloween-Gegner/-Bosse, sonst nie
  const hg=await p.evaluate(()=>{const r={};newGame(undefined,'hw');let all=[];for(const f of[1,2,3,5,6,9,12]){fl=f;gen();all=all.concat(en);}
   r.hwOnly=all.every(e=>e.v!=null&&VAR[e.v].hw);r.boss=[3,6,9].map(f=>{fl=f;gen();const b=en.find(e=>e.boss);return b&&VAR[b.v].n;});
   const m=mkEn({x:me.x,y:me.y},0,me.x,me.y);r.minion=m.v!=null&&VAR[m.v].hw;
   newGame(undefined,'endless');all=[];for(const f of[1,5,20,40,80]){fl=f;gen();all=all.concat(en);}r.endNo=all.every(e=>e.v==null||!VAR[e.v].hw);
   r.book=VNORM.concat(VBOSS).every(i=>!VAR[i].hw);r.ev=hwOn();return r;});
  ok(hg.hwOnly&&hg.minion&&hg.endNo&&hg.book&&hg.boss.join()==='Kürbiskönig,Hexenkönigin,Kopfloser Reiter','Halloween-Dungeon: nur Halloween-Gegner und -Bosse, Endlos/Bestiarium unverändert '+JSON.stringify(hg));
  ok(await p.evaluate(()=>{const d0=Date;const t=k=>{window.Date=class extends d0{constructor(...a){super(...(a.length?a:[k]));}static now(){return new d0(k).getTime();}};const r=hwOn();window.Date=d0;return r;};return t('2026-11-02T20:00:00+01:00')&&!t('2026-11-03T08:00:00+01:00');}),'Event endet nach dem 2. November');
  // Zusammenführen: Maximum/Vereinigung
  ok(await p.evaluate(()=>{const e=meta.tk.e,s=meta.tk.s;u11Merge({tk:{e:e+500,s:s},own:{a:[0,3],w:[0,2]},hw:{xp:1,cl:[],q:{},c:{},dy:[]}});return meta.tk.e===e+500&&meta.own.a.includes(3)&&meta.own.w.includes(2)&&meta.hw.xp>=1000;}),'Cloud-Zusammenführung (Maximum + Vereinigung)');
  await p.evaluate(()=>{saveMeta();});await p.reload();await p.waitForTimeout(700);
  ok(await p.evaluate(()=>meta.own.a.includes(10)&&meta.own.a.includes(3)&&tkBal()>0&&meta.hw.cl.length===10),'Skins/Marken/Pass bleiben nach Neuladen erhalten');
  // Englisch
  await p.evaluate(()=>{window.__lscan=new Set();setLang('en');shopOpen(0);for(const t of[0,1,2,3,4]){shp.tab=t;shp.sel=1;draw();}shp=null;draw();});
  const miss=await p.evaluate(()=>[...window.__lscan].filter(s=>/Marken|Shop|Skin|Aufgabe|Glücksrad|Halloween|Event|Pass|Kaufen|Ausrüst|Besitzt|Chancen|Meilenstein|Bonbon|Stufe|Heute|Tippe|teilen|Dreh/.test(s)));
  const same=new Set(['Shop','🎃 Event','Skin','Halloween']);const miss2=miss.filter(t=>!same.has(t)&&!/^\+\d+ Pass$/.test(t));
  ok(miss2.length===0&&await p.evaluate(()=>LTR('Zurück')!=='Zurück'),'Englisch: keine fehlenden Texte '+JSON.stringify(miss2.slice(0,20)));
  await p.evaluate(()=>{shopOpen(4);draw();});await p.screenshot({path:path.join(__dirname,'u11_event_en.png')});
  await ctx.close();}
 // „Was ist neu?“-Fenster: einmal pro Spieler
 {const ctx=await b.newContext({viewport:{width:390,height:844}});await ctx.addInitScript(d=>{const T=new Date(d).getTime(),D=Date;window.Date=class extends D{constructor(...a){super(...(a.length?a:[T]));}static now(){return T;}};},DAY);
  const p=await ctx.newPage();p.on('pageerror',e=>errs.push(e.message));await p.goto(F+'#neu');await p.waitForTimeout(700);
  let L=await grab(p);ok(L.includes('Los geht’s!')&&L.includes('🎃 Zum Halloween-Event')&&await p.evaluate(()=>{draw();return btns.length===2;}),'Neu-Fenster erscheint und sperrt das Menü '+JSON.stringify(L));
  await p.screenshot({path:path.join(__dirname,'u11_neu_390.png')});
  await press(p,/^Los geht/);L=await grab(p);ok(L.includes('📖 Story-Modus (neu)')&&!L.includes('Los geht’s!'),'nach „Los geht’s“ normales Menü');
  await p.reload();await p.waitForTimeout(700);ok(!(await grab(p)).includes('Los geht’s!')&&await p.evaluate(()=>meta.nws===NEWS.v),'nach Neuladen nicht noch einmal (auch im Konto-Speicher gemerkt)');
  await p.evaluate(()=>{try{localStorage.removeItem('dg_news');}catch(e){}meta.nws=0;u11Merge({nws:NEWS.v});});ok(!(await grab(p)).includes('Los geht’s!'),'auf anderem Gerät: Konto-Stand reicht');
  await ctx.close();}
 // Nach dem Event: kein Event-Knopf, Event-Skins nicht im Shop
 {const {ctx,p}=await open({width:820,height:1180},'2026-12-01T12:00:00+01:00');
  const L=await grab(p);ok(!L.includes('🎃 Halloween-Event')&&L.includes('🛒 Shop & Aufgaben'),'nach dem Event kein Event-Knopf');
  await p.evaluate(()=>{shopOpen(0);draw();});ok(!(await grab(p)).includes('🎃 Event'),'nach dem Event kein Event-Reiter');await ctx.close();}
 ok(errs.length===0,'keine JS-Fehler '+errs.join(' | '));
 console.log(fail?'FEHLGESCHLAGEN ('+fail+')':'ALLE OK');await b.close();process.exit(fail?1:0);})();
