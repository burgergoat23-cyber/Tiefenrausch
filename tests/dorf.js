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
 const spot=(p,k,go)=>p.evaluate(([k,go])=>{if(go){const b=vBld().B.find(q=>q.k===k);if(b){VL.x=b.x-120;VL.cam=-1;VL.tx=null;}}draw();let r=null;scaled(()=>{r=vSpot(k);});return r;},[k,go]);
 const walk=async(p,k)=>{const s=await spot(p,k,1);await p.mouse.click(s.x,s.y);for(let i=0;i<60&&await p.evaluate(()=>!shp&&!bk&&!vPanel);i++)await p.waitForTimeout(150);};
 for(const vp of [{width:820,height:1180},{width:390,height:844},{width:1180,height:820},{width:844,height:390}]){const tag=vp.width+'x'+vp.height;
  const ctx=await b.newContext({viewport:vp});await ctx.addInitScript(clock,'2026-10-20T12:00:00+02:00');const p=await ctx.newPage();p.on('pageerror',e=>errs.push(e.message));
  await p.goto(F+'#dorf');await p.waitForTimeout(800);
  ok(await p.evaluate(()=>vilOn()&&st==='ready'&&VL.x>0),tag+': Dorf statt Menü');await p.waitForTimeout(600);
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
  // Dorfbewohner: laufen, plaudern, ansprechbar
  const nn=await p.evaluate(async()=>{const r={n:VN.length};const w=VN.find(n=>n.id==='post'),x0=w.x;await new Promise(f=>setTimeout(f,2500));r.walk=Math.abs(w.x-x0)>5||w.wait>0;
   r.bub=VN.some(n=>n.bub);const h=VN.find(n=>n.id==='haendler');VL.x=h.x-40;VL.cam=-1;vTalkTo(h);r.talk=!!vTalk&&vTalk.n===h;return r;});
  ok(nn.n>=12&&nn.walk&&nn.bub&&nn.talk,tag+': Dorfbewohner laufen, plaudern und sind ansprechbar '+JSON.stringify(nn));
  let TL=await grab(p);ok(TL.includes('Weiter ▶')&&TL.includes('Tschüss'),tag+': Gesprächsfenster mit Weiter/Tschüss');
  await p.screenshot({path:path.join(__dirname,'dorf_npc_'+vp.width+'.png')});
  await press(p,/^Weiter/);ok(await p.evaluate(()=>vTalk&&vTalk.i===1),tag+': Weiter blättert');
  await press(p,/^Tschüss/);ok(await p.evaluate(()=>!vTalk),tag+': Tschüss beendet das Gespräch');
  // Antippen eines entfernten Bewohners: Held läuft hin, dann Gespräch
  await p.evaluate(()=>{const n=VN.find(n=>n.id==='bgm');VL.x=n.x-170;VL.cam=-1;});const np=await p.evaluate(()=>{draw();let r=null;scaled(()=>{const L=vLay(),n=VN.find(n=>n.id==='bgm'),q=uiOn?uiS:1;r={x:vX(L,n.x)*q,y:vY(L,VGY+30+n.d)*q-8};});return r;});
  await p.mouse.click(np.x,np.y);for(let i=0;i<40&&await p.evaluate(()=>!vTalk);i++)await p.waitForTimeout(100);ok(await p.evaluate(()=>vTalk&&vTalk.n.id==='bgm'),tag+': Bewohner antippen → hinlaufen → reden');
  await p.evaluate(()=>{vTalk=null;});
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
  await p.goto(F+'#dorf');await p.waitForTimeout(800);ok(!(await spot(p,'hw'))&&!!(await spot(p,'shop')),'nach dem Event kein Halloween-Haus');
  await p.evaluate(()=>{window.__lscan=new Set();setLang('en');draw();vPanel='tor';draw();vPanel='menu';draw();vPanel=null;});
  await p.evaluate(()=>{for(const n of VN){vTalk={n,i:0};for(let i=0;i<n.l.length;i++){vTalk.i=i;draw();}n.bub={s:'',t:0};}vTalk=null;for(const k in VCHAT)for(const[w,t]of VCHAT[k]){const n=VN.find(q=>q.id===w);if(n){n.bub={s:t,t:1};VL.x=n.x;VL.cam=-1;draw();}}});
  const miss=await p.evaluate(()=>{const V=Object.values(LANGS.en.d).concat(Object.values(LANGS.en.x||{}));return[...window.__lscan].filter(s=>/[a-zäöüß]{3}/.test(s)&&!/^(Shop|Dungeon|⚔ Dungeon|🛒 Shop|Halloween|Tiefenrausch|🌐 English)$/.test(s)&&!V.some(v=>typeof v==='string'&&v.includes(s.trim())));});
  ok(miss.filter(s=>!['Dungeon','⚔ Dungeon','🛒 Shop'].includes(s)).length===0,'Englisch vollständig '+JSON.stringify(miss));
  await p.screenshot({path:path.join(__dirname,'dorf_en.png')});await ctx.close();}
 ok(errs.length===0,'keine JS-Fehler '+errs.join(' | '));
 console.log(fail?'FEHLGESCHLAGEN ('+fail+')':'ALLE OK');await b.close();process.exit(fail?1:0);})();
