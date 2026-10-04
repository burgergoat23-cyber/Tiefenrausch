// Sprechen: Text erscheint Buchstabe für Buchstabe, Mund bewegt sich, Retro-Stimme (Töne) – im Dorf und im Dungeon. Dazu Retro-Pixel-Bild und Wind.
// Aufruf: node tests/sprechen.js
const {chromium}=(()=>{try{return require('playwright')}catch(e){return require('/opt/node-tools/node_modules/playwright')}})();
const path=require('path');
const F='file://'+path.join(__dirname,'cur.html');
let fail=0;const ok=(c,m)=>{console.log((c?'  OK  ':'  FAIL ')+m);if(!c)fail++;};
(async()=>{const b=await chromium.launch();const errs=[];
 const ctx=await b.newContext({viewport:{width:1180,height:820}});const p=await ctx.newPage();p.on('pageerror',e=>errs.push(e.message));
 await p.goto(F+'#dorf');await p.waitForTimeout(900);
 // Töne zählen (ohne echten Ton)
 await p.evaluate(()=>{window.__tones=0;tone=function(){window.__tones++;};cfg.snd=1;au();});
 const r=await p.evaluate(async()=>{const o={};const n=VN.find(q=>q.id==='haendler');VL.x=n.x-40;VL.cam=-1;vTalkTo(n);draw();
  o.speak0=vSpeaking(n);o.part=vTyped(vTalk.t0)<LTR(n.l[0]).length;await new Promise(f=>setTimeout(f,700));draw();o.tones=window.__tones;
  // Antippen der Textfläche zeigt den Satz sofort ganz
  const bt=btns.find(q=>q.h>40&&q.w>200&&!q.label);if(bt)bt.fn();draw();o.full=vTyped(vTalk.t0)>=LTR(n.l[0]).length;o.speak1=vSpeaking(n);vTalk=null;return o;});
 ok(r.speak0&&r.part,'Dorf: Text erscheint Buchstabe für Buchstabe, Mund bewegt sich '+JSON.stringify(r));
 ok(r.tones>3,'Dorf: Retro-Stimme spielt Töne beim Sprechen ('+r.tones+')');
 ok(r.full&&!r.speak1,'Dorf: Antippen zeigt den ganzen Satz, danach Mund zu');
 const rv=await p.evaluate(()=>{draw();return{c:!!VRC,w:VRC&&VRC.width,W:innerWidth,g:[0,13.5,15,16].map(t=>{const t0=tm;tm=t;const v=vGust();tm=t0;return+v.toFixed(2);})};});
 ok(rv.c&&rv.w<rv.W,'Retro-Pixel: Szene wird kleiner gezeichnet und vergrößert '+JSON.stringify(rv));
 ok(rv.g[0]===0&&Math.max(...rv.g)>.5,'Wind: Böen kommen und gehen '+JSON.stringify(rv.g));
 const off=await p.evaluate(()=>{cfg.retro=0;VRC.width=1;draw();const same=VRC.width===1;cfg.retro=1;return same;});
 ok(off,'Retro-Pixel lässt sich ausschalten (cfg.retro=0)');
 // Dungeon: Begrüßung beim Herankommen, Gespräch mit Porträt und Schreibmaschine
 await p.goto(F);await p.waitForTimeout(700);
 await p.evaluate(()=>{window.__tones=0;tone=function(){window.__tones++;};cfg.snd=1;au();newGame(undefined,'story');});await p.waitForTimeout(500);
 const d=await p.evaluate(async()=>{ui=null;const o={};const n={t:'h',x:me.x+400,y:me.y,seen:1};npcs.push(n);draw();o.noGreetFar=!n.say;n.x=me.x+60;draw();o.greet=!!(n.say&&n.say.s);
  await new Promise(f=>setTimeout(f,600));draw();o.tones=window.__tones;
  ui={type:'npc',id:'h',n,t0:vNow(),vc:0};draw();o.part=vTyped(ui.t0)<10;const L=[];const ob=btn;btn=function(x,y,w,h,l){L.push(String(l));return ob.apply(this,arguments);};try{draw();}finally{btn=ob;}o.btn=L.includes('Annehmen');
  ui.t0=-1e9;draw();ui=null;
  // Dorfbewohner im Dungeon (Story): Porträt + Rettung bleibt
  const v={t:'d',vi:3,x:me.x+40,y:me.y,seen:1};npcs.push(v);ui={type:'npc',id:'d',n:v,t0:vNow(),vc:0};const L2=[];btn=function(x,y,w,h,l){L2.push(String(l));return ob.apply(this,arguments);};try{draw();}finally{btn=ob;}o.rescue=L2.includes('Lauf ins Dorf, ich halte sie auf!');ui=null;return o;});
 ok(d.noGreetFar&&d.greet,'Dungeon: Figur begrüßt den Helden beim Herankommen '+JSON.stringify(d));
 ok(d.tones>2,'Dungeon: Begrüßung mit Retro-Stimme ('+d.tones+')');
 ok(d.part&&d.btn&&d.rescue,'Dungeon: Gespräch mit Porträt und Schreibmaschine, Knöpfe wie vorher');
 // Englisch: Begrüßungen übersetzt
 const en=await p.evaluate(()=>{setLang('en');const r=Object.values(NPCHI).filter(s=>LTR(s)===s);setLang('de');return r;});
 ok(en.length===0,'Englisch: Begrüßungen übersetzt '+JSON.stringify(en));
 ok(errs.length===0,'keine JS-Fehler '+errs.join(' | '));
 console.log(fail?'FEHLGESCHLAGEN ('+fail+')':'ALLE OK');await b.close();process.exit(fail?1:0);})();
