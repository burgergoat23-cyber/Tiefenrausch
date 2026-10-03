// Teilen-Knopf nach dem Tageslauf, Koop-Einladung per Link, Link-Vorschau (og:image).
// Aufruf: node tests/teilen.js   (nutzt tests/cur.html, wird von run.sh angelegt)
const {chromium}=(()=>{try{return require('playwright')}catch(e){return require('/opt/node-tools/node_modules/playwright')}})();
const path=require('path'),fs=require('fs');
const F='file://'+path.join(__dirname,'cur.html');
let fail=0;const ok=(c,m)=>{console.log((c?'  OK  ':'  FAIL ')+m);if(!c)fail++;};
(async()=>{const b=await chromium.launch();const errs=[];
 const html=fs.readFileSync(path.join(__dirname,'cur.html'),'utf8');
 ok(/property="og:image" content="https:\/\/burgergoat23-cyber\.github\.io\/Tiefenrausch\/promo\/og\.jpg"/.test(html)&&fs.existsSync(path.join(__dirname,'..','promo','og.jpg')),'Link-Vorschaubild eingetragen und vorhanden');
 const labels=p=>p.evaluate(()=>{const L=[];const o=btn;btn=function(x,y,w,h,l){L.push(l);return o.apply(this,arguments);};try{draw();}finally{btn=o;}return L;});
 for(const vp of [{width:820,height:1180},{width:844,height:390},{width:390,height:844}]){
  const ctx=await b.newContext({viewport:vp});
  await ctx.addInitScript(()=>{window.__sh=[];Object.defineProperty(navigator,'share',{value:o=>{window.__sh.push(o);return Promise.resolve();},configurable:true});});
  const p=await ctx.newPage();p.on('pageerror',e=>errs.push(e.message));await p.goto(F);await p.waitForTimeout(600);
  await p.evaluate(()=>{meta.dplay=null;newGame(undefined,'daily');for(let i=0;i<2;i++){en=en.filter(e=>!e.boss);me.x=stairs.x;me.y=stairs.y;update(.016);}me.hp=0;});
  for(let i=0;i<120&&await p.evaluate(()=>st!=='over');i++)await p.evaluate(()=>{try{update(.05);}catch(e){}});
  if(await p.evaluate(()=>st!=='over'))await p.evaluate(()=>{dailyEnd();st='over';});
  const L=await labels(p);ok(L.includes('📤 Ergebnis teilen'),vp.width+'x'+vp.height+': Teilen-Knopf nach dem Tageslauf '+JSON.stringify(L));
  await p.evaluate(()=>shareRun());await p.waitForTimeout(100);
  const sh=await p.evaluate(()=>window.__sh[0]);ok(sh&&/Tageslauf/.test(sh.text)&&/\d+ Punkte/.test(sh.text)&&sh.url==='https://burgergoat23-cyber.github.io/Tiefenrausch/','Systemmenü bekommt Text + Link '+JSON.stringify(sh));
  await p.screenshot({path:path.join(__dirname,'teilen_'+vp.width+'.png')});
  // ohne Systemmenü: Zwischenablage
  await p.evaluate(()=>{Object.defineProperty(navigator,'share',{value:undefined,configurable:true});window.__cb='';Object.defineProperty(navigator,'clipboard',{value:{writeText:t=>{window.__cb=t;return Promise.resolve();}},configurable:true});shareRun();});
  await p.waitForTimeout(100);const cb=await p.evaluate(()=>({t:window.__cb,s:run.sub}));ok(/Punkte.*github\.io/.test(cb.t)&&/kopiert/.test(cb.s),'ohne Systemmenü in die Zwischenablage '+JSON.stringify(cb));
  // Endlos: kein Teilen-Knopf
  await p.evaluate(()=>{newGame(undefined,'endless');st='over';});ok(!(await labels(p)).includes('📤 Ergebnis teilen'),'kein Teilen-Knopf im Endlos-Modus');
  await ctx.close();}
 console.log('Koop-Einladung');
 {const ctx=await b.newContext({viewport:{width:820,height:1180}});const p=await ctx.newPage();p.on('pageerror',e=>errs.push(e.message));
  await p.goto(F+'#koop=ab12');await p.waitForTimeout(800);
  ok(await p.evaluate(()=>coInv===null&&CO.lob&&CO.lob.st==='menu'&&!/koop=/.test(location.hash)),'Einladungs-Link öffnet die Koop-Lobby (Gast: Hinweis zum Anmelden), Adresse aufgeräumt');
  // Einladen-Knopf in der echten Lobby prüft fb/coop_t.js (braucht Konto + Firebase)
  await p.evaluate(()=>{CO.lob={st:'host',code:'AB12'};});
  await p.evaluate(()=>{window.__s=null;Object.defineProperty(navigator,'share',{value:o=>{window.__s=o;return Promise.resolve();},configurable:true});coShare(CO.lob);});await p.waitForTimeout(100);
  const s=await p.evaluate(()=>({o:window.__s,inv:CO.lob.inv}));ok(s.o&&s.o.url==='https://burgergoat23-cyber.github.io/Tiefenrausch/#koop=AB12'&&/AB12/.test(s.o.text)&&/geteilt/.test(s.inv),'Einladung enthält Link mit Raum-Code '+JSON.stringify(s));
  await p.screenshot({path:path.join(__dirname,'teilen_lobby.png')});await ctx.close();}
 ok(errs.length===0,'keine JS-Fehler '+errs.join(' | '));
 console.log(fail?'FEHLGESCHLAGEN ('+fail+')':'ALLE OK');await b.close();process.exit(fail?1:0);})();
