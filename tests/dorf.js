// Update 12: Dorf als Hauptmenü (begehbar, Gebäude öffnen Modi/Shop/Event/Ranglisten/Bestiarium). Aufruf: node tests/dorf.js
// Andere Testprogramme sehen das alte Knopf-Menü; das Dorf nur mit #dorf in der Adresse.
const {chromium}=(()=>{try{return require('playwright')}catch(e){return require('/opt/node-tools/node_modules/playwright')}})();
const path=require('path');
const F='file://'+path.join(__dirname,'cur.html');
let fail=0;const ok=(c,m)=>{console.log((c?'  OK  ':'  FAIL ')+m);if(!c)fail++;};
const clock=d=>{const T=new Date(d).getTime(),D=Date;window.Date=class extends D{constructor(...a){super(...(a.length?a:[T]));}static now(){return T;}};};
(async()=>{const b=await chromium.launch();const errs=[];
 const grab=p=>p.evaluate(()=>{const L=[];const o=btn;btn=function(x,y,w,h,l){L.push(String(l));return o.apply(this,arguments);};try{draw();}finally{btn=o;}return L;});
 const press=(p,re)=>p.evaluate(src=>{const rx=new RegExp(src);let f=null;const o=btn;btn=function(x,y,w,h,l,fn){if(!f&&rx.test(String(l)))f=fn;return o.apply(this,arguments);};try{draw();}finally{btn=o;}if(f){f();return true;}return false;},re.source);
 // Mitte eines Gebäudes in Bildschirm-Pixeln (wie drawVillage)
 const spot=(p,k)=>p.evaluate(k=>{draw();let r=null;scaled(()=>{const q=uiOn?uiS:1,L=vLay(Math.max(TLY+4,SI.t/q+60)),B=L.B.find(x=>x.k===k);if(!B)return;const [x,y]=v2s(L,B.x,B.y-B.h*.4);r={x:x*q,y:y*q};});return r;},k);
 const walk=async(p,k)=>{const s=await spot(p,k);await p.mouse.click(s.x,s.y);for(let i=0;i<40&&await p.evaluate(()=>!shp&&!bk&&!vPanel);i++)await p.waitForTimeout(150);};
 for(const vp of [{width:820,height:1180},{width:390,height:844},{width:1180,height:820},{width:844,height:390}]){const tag=vp.width+'x'+vp.height;
  const ctx=await b.newContext({viewport:vp});await ctx.addInitScript(clock,'2026-10-20T12:00:00+02:00');const p=await ctx.newPage();p.on('pageerror',e=>errs.push(e.message));
  await p.goto(F+'#dorf');await p.waitForTimeout(800);
  ok(await p.evaluate(()=>vilOn()&&st==='ready'&&VL.x>0),tag+': Dorf statt Menü');
  ok(!(await grab(p)).includes('📖 Story-Modus (neu)'),tag+': keine alten Menü-Knöpfe');
  await p.screenshot({path:path.join(__dirname,'dorf_'+vp.width+'.png')});
  await walk(p,'shop');ok(await p.evaluate(()=>shp&&shp.tab===0),tag+': Held läuft zum Shop, Shop öffnet');
  await p.evaluate(()=>{shp=null;});await walk(p,'hw');ok(await p.evaluate(()=>shp&&shp.tab===4),tag+': Halloween-Haus öffnet das Event');
  await p.evaluate(()=>{shp=null;});await walk(p,'buch');ok(await p.evaluate(()=>bk&&bk.tab===0),tag+': Bibliothek öffnet das Bestiarium');
  await p.evaluate(()=>{bk=null;});await walk(p,'brett');ok(await p.evaluate(()=>bk&&bk.tab===3),tag+': Tafel öffnet die Ranglisten');
  await p.evaluate(()=>{bk=null;});await walk(p,'tor');const L=await grab(p);
  ok(await p.evaluate(()=>vPanel==='tor')&&L.includes('📖 Story-Modus (neu)')&&L.includes('♾ Endlos-Modus (neu)')&&L.includes('📅 Tageslauf'),tag+': Dungeon-Tor zeigt die Spielmodi '+JSON.stringify(L));
  await p.screenshot({path:path.join(__dirname,'dorf_tor_'+vp.width+'.png')});
  await press(p,/Endlos-Modus/);ok(await p.evaluate(()=>st==='play'&&mode==='endless'&&!vPanel),tag+': Endlos startet aus dem Tor');
  await p.evaluate(()=>{st='ready';ui=null;});
  // ☰-Menü
  await p.evaluate(()=>{draw();const q=uiOn?uiS:1;window.__m={x:SI.l/q+38,y:SI.t/q+80};});const m=await p.evaluate(()=>window.__m);
  const sc=vp.height<560?Math.max(.8,vp.height/560):1;await p.mouse.click(m.x*sc,m.y*sc);await p.waitForTimeout(100);
  const ML=await grab(p);ok(await p.evaluate(()=>vPanel==='menu')&&ML.includes('Anmelden')&&ML.includes('🚪 Beenden'),tag+': ☰ öffnet Anmelden/Beenden '+JSON.stringify(ML));
  await press(p,/^Zurück$/);ok(await p.evaluate(()=>!vPanel),tag+': Zurück schließt');
  // Laufen per Tastatur
  const x0=await p.evaluate(()=>VL.x);await p.keyboard.down('d');await p.waitForTimeout(500);await p.keyboard.up('d');ok(await p.evaluate(x=>VL.x>x+20,x0),tag+': Laufen mit WASD');
  await ctx.close();}
 // Englisch + nach dem Event kein Halloween-Haus
 {const ctx=await b.newContext({viewport:{width:820,height:1180}});await ctx.addInitScript(clock,'2026-12-01T12:00:00+01:00');const p=await ctx.newPage();p.on('pageerror',e=>errs.push(e.message));
  await p.goto(F+'#dorf');await p.waitForTimeout(800);ok(!(await spot(p,'hw'))&&(await spot(p,'shop')),'nach dem Event kein Halloween-Haus');
  await p.evaluate(()=>{window.__lscan=new Set();setLang('en');draw();vPanel='tor';draw();vPanel='menu';draw();vPanel=null;});
  const miss=await p.evaluate(()=>[...window.__lscan].filter(s=>/Dungeon|Shop|Bestiarium|Ranglisten|Tippe|Menü|Tageslauf|Halloween/.test(s)));
  ok(miss.filter(s=>!['Dungeon','⚔ Dungeon','🛒 Shop'].includes(s)).length===0,'Englisch vollständig '+JSON.stringify(miss));
  await p.screenshot({path:path.join(__dirname,'dorf_en.png')});await ctx.close();}
 ok(errs.length===0,'keine JS-Fehler '+errs.join(' | '));
 console.log(fail?'FEHLGESCHLAGEN ('+fail+')':'ALLE OK');await b.close();process.exit(fail?1:0);})();
