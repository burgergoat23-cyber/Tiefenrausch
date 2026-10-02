const {chromium}=(()=>{try{return require('playwright')}catch(e){return require('/opt/node-tools/node_modules/playwright')}})();
let fail=0;const ok=(c,m)=>{console.log((c?'  OK  ':'  FAIL ')+m);if(!c)fail++;};
(async()=>{const b=await chromium.launch();const p=await (await b.newContext({viewport:{width:900,height:700},deviceScaleFactor:2})).newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
 await p.goto('file://'+process.cwd()+'/cur.html');await p.waitForTimeout(400);
 const r=await p.evaluate(()=>{const o={};newGame(undefined,'story');ui=null;
  const vs=npcs.filter(n=>n.t==='d');o.e1=vs.map(n=>VILL[n.vi].n);
  const n=vs[0];me.x=n.x;me.y=n.y+30;interact();o.dialog=ui&&ui.type+'/'+ui.id;drawUI();
  const g0=gold;rescueVillager(n);ui=null;o.gold=gold-g0;o.rv=me.rv.slice();o.weg=!npcs.includes(n);
  // Ebene neu laden: geretteter erscheint nicht wieder
  fl=2;gen();ui=null;o.e2=npcs.filter(n=>n.t==='d').map(n=>VILL[n.vi].n);saveGame();
  newGame(saves.story);ui=null;o.nachLaden=me.rv.slice();o.e2nachLaden=npcs.filter(n=>n.t==='d').map(n=>VILL[n.vi].n);
  fl=3;gen();ui=null;o.bossEbene=npcs.filter(n=>n.t==='d').length;
  fl=6;gen();ui=null;o.e6=npcs.filter(n=>n.t==='d').length;
  // alle retten
  for(const v of VILL){fl=v.f;gen();ui=null;const x=npcs.find(n=>n.t==='d');if(x)rescueVillager(x);}
  o.alle=me.rv.length;metaTick(1);o.erfolg=!!meta.ach.dorf;
  // Endlos: keine Dorfbewohner
  newGame(undefined,'endless');let c=0;for(let f=1;f<15;f++){fl=f;gen();c+=npcs.filter(n=>n.t==='d').length;}o.endlos=c;
  return o;});
 console.log(JSON.stringify(r));
 ok(r.e1.length===1&&r.e1[0]==='Bauer Henrik','Ebene 1: Bauer Henrik da');ok(r.dialog==='npc/d','Ansprechen öffnet Dialog');
 ok(r.gold>0&&r.weg&&r.rv.length===1,'Retten: Gold, verschwindet, gezählt');ok(r.e2[0]==='Magd Lina'&&r.nachLaden.length===1,'Ebene 2 + Speichern/Laden behält Gerettete');
 ok(r.bossEbene===0&&r.e6===0,'keine auf Boss-Ebenen');ok(r.alle===10&&r.erfolg,'alle 10 retten → Erfolg');ok(r.endlos===0,'im Endlos keine Dorfbewohner');
 // Bilder: Dorfbewohner im Spiel + Dialog + Englisch
 await p.evaluate(()=>{newGame(undefined,'story');ui=null;fl=5;gen();ui=null;const n=npcs.find(n=>n.t==='d');me.x=n.x+50;me.y=n.y+10;for(const e of en)e.hp=0;update(.016);});await p.waitForTimeout(400);await p.screenshot({path:'vill_play.png'});
 await p.evaluate(()=>{const n=npcs.find(n=>n.t==='d');me.x=n.x;me.y=n.y+30;interact();});await p.waitForTimeout(400);await p.screenshot({path:'vill_dlg.png'});
 await p.evaluate(()=>{cfg.lang='en';LG='en';langBuild();});await p.waitForTimeout(300);await p.screenshot({path:'vill_dlg_en.png'});
 ok(!errs.length,'keine JS-Fehler '+JSON.stringify(errs.slice(0,3)));console.log(fail?'FEHLER':'ALLE OK');await b.close();})();
