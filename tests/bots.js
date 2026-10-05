// Ranglisten-Bots: nur auf der GitHub-Seite, klar gekennzeichnet (🤖, „Bot“), ohne Platz-Nummer; nicht auf itch.io, CrazyGames oder als Datei.
// Aufruf: node tests/bots.js
const {chromium}=(()=>{try{return require('playwright')}catch(e){return require('/opt/node-tools/node_modules/playwright')}})();
const fs=require('fs'),path=require('path');
const GAME=fs.readFileSync(path.join(__dirname,'cur.html'));
let fail=0;const ok=(c,m)=>{console.log((c?'  OK  ':'  FAIL ')+m);if(!c)fail++;};
const clock=d=>{const T=new Date(d).getTime(),D=Date;window.Date=class extends D{constructor(...a){super(...(a.length?a:[T]));}static now(){return T;}};};
(async()=>{const b=await chromium.launch();const errs=[];
 async function open(url,cg){const ctx=await b.newContext({viewport:{width:1180,height:820}});await ctx.addInitScript(clock,'2026-10-10T12:00:00+02:00');
  if(cg)await ctx.addInitScript(()=>{window.TR_CG=1;});
  if(url.startsWith('https:'))await ctx.route('**/*',r=>{const u=r.request().url();if(u===url||u.startsWith(url+'#'))r.fulfill({contentType:'text/html',body:GAME});else r.abort();});
  const p=await ctx.newPage();p.on('pageerror',e=>errs.push(e.message));await p.goto(url);await p.waitForTimeout(800);return {p,ctx};}
 // Rangliste zeichnen und alle Texte mitschreiben (lt 0 = Heute, 1 = Bestenliste)
 const liste=(p,lt)=>p.evaluate(lt=>{guest=true;meta.nws=99;st='ready';ui=null;shp=null;vPanel=null;
   lb={st:'ok',rows:[{u:'Anna',s:900,fl:8},{u:'Ben',s:120,fl:2}],t:Date.now()+9e9,d:dayKey(),rank:0};tp={st:'ok',rows:[{u:'Anna',fl:20},{u:'Ben',fl:2}],t:Date.now()+9e9};
   bk={tab:3,pg:0,lt};const L=[],of=CanvasRenderingContext2D.prototype.fillText;CanvasRenderingContext2D.prototype.fillText=function(t,...a){L.push(LTR(String(t)));return of.call(this,t,...a);};   // so, wie es auf dem Bildschirm steht (übersetzt)
   try{draw();}finally{CanvasRenderingContext2D.prototype.fillText=of;}bk=null;return L;},lt);
 // 1) GitHub-Seite: Bots sichtbar und gekennzeichnet
 {const {p,ctx}=await open('https://burgergoat23-cyber.github.io/Tiefenrausch/');
  const r=await p.evaluate(()=>({on:BOT_ON,top:botRows('top'),day:botRows('day'),k:dayKey()}));
  ok(r.on&&r.top.length===3&&r.day.length===3,'GitHub-Seite: 3 Bots in Bestenliste und Tageslauf '+JSON.stringify(r.day));
  ok(r.day.every(x=>x.u.startsWith('Bot ')&&x.bot&&x.s>0&&x.fl>0),'Bots heißen „Bot …“ und haben echte Werte');
  const L=await liste(p,0);const bots=L.filter(t=>t==='🤖').length,nums=L.filter(t=>/^\d+\.$/.test(t));
  ok(bots===3&&L.includes('Bot Bruno')&&L.includes('Bot Kuno'),'Tagesliste zeigt die 3 Bots mit 🤖 ('+bots+')');
  ok(nums.join(' ')==='1. 2.','echte Spieler behalten ihre Plätze 1. und 2. (Bots ohne Nummer): '+nums.join(' '));
  ok(L.some(t=>t.includes('= Bot (Computer-Spieler)')),'Hinweis „🤖 = Bot (Computer-Spieler)“ steht unter der Liste');
  const T=await liste(p,1);ok(T.filter(t=>t==='🤖').length===3&&T.filter(t=>/^\d+\.$/.test(t)).join(' ')==='1. 2.','Bestenliste: 3 Bots, echte Plätze 1. und 2.');
  await p.evaluate(()=>setLang('en'));const E=await liste(p,0);ok(E.some(t=>t.includes('= bot (computer player)')),'Hinweis auf Englisch');await p.evaluate(()=>setLang('de'));
  // ohne Tabellen-Eintrag für den Tag: keine Tages-Bots, Bestenliste bleibt
  ok(await p.evaluate(()=>{const k=dayKey,o=BOTD;dayKey=()=>'2030-01-01';const n=botRows('day').length;dayKey=k;return n===0&&botRows('top').length===3;}),'Tag ohne Messwerte: keine Tages-Bots');
  await ctx.close();}
 // 2) itch.io, CrazyGames, Datei: keine Bots
 for(const [name,url,cg] of [['itch.io','https://html.itch.zone/html/12345/index.html',0],['CrazyGames','https://burgergoat23-cyber.github.io/Tiefenrausch/',1],['Datei','file://'+path.join(__dirname,'cur.html'),0]]){
  const {p,ctx}=await open(url,cg);const r=await p.evaluate(()=>({on:BOT_ON,n:botRows('top').length+botRows('day').length}));
  ok(!r.on&&r.n===0,name+': keine Bots '+JSON.stringify(r));
  if(name!=='CrazyGames'){const L=await liste(p,0);ok(!L.includes('🤖')&&L.filter(t=>/^\d+\.$/.test(t)).join(' ')==='1. 2.',name+': Rangliste wie vorher, ohne Bots');}
  await ctx.close();}
 ok(errs.length===0,'keine JS-Fehler '+errs.join(' | '));
 console.log(fail?'FEHLGESCHLAGEN ('+fail+')':'ALLE OK');await b.close();process.exit(fail?1:0);})();
