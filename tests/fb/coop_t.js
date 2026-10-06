const {chromium}=(()=>{try{return require('playwright')}catch(e){return require('/opt/node-tools/node_modules/playwright')}})();const fs=require('fs');
const GAME=fs.readFileSync('../cur.html');const URL='https://burgergoat23-cyber.github.io/Tiefenrausch/';
let fail=0;const ok=(c,m)=>{console.log((c?'  OK  ':'  FAIL ')+m);if(!c)fail++;};const wait=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{const b=await chromium.launch({args:['--no-proxy-server','--disable-features=PrivateNetworkAccessSendPreflights,BlockInsecurePrivateNetworkRequests,PrivateNetworkAccessRespectPreflightResults,LocalNetworkAccessChecks,WebRtcHideLocalIpsWithMdns']});const errs=[];
 async function page(){const ctx=await b.newContext({viewport:{width:900,height:700}});
  await ctx.route(URL+'**',r=>r.fulfill({contentType:'text/html',body:GAME}));
  await ctx.route('https://www.gstatic.com/firebasejs/**',r=>{const f=r.request().url().split('/').pop();r.fulfill({contentType:'text/javascript',body:fs.readFileSync('node_modules/firebase/'+f)});});
  await ctx.addInitScript(()=>{window.FB_TEST=(a,db)=>{a.useEmulator('http://127.0.0.1:9099',{disableWarnings:true});db.useEmulator('127.0.0.1',8080);};});
  const p=await ctx.newPage();p.on('pageerror',e=>errs.push(e.message));p.on('console',m=>{if(m.type()==='error')errs.push('console '+m.text());});await p.goto(URL);await p.waitForTimeout(1500);return p;}
 async function reg(p,u){await p.fill('#un',u);await p.fill('#pw','geheim1');await p.click('#br');for(let i=0;i<50;i++){await wait(200);if(await p.evaluate(()=>!!acct))return true;}return false;}
 const H=await page(),G=await page();ok(await reg(H,'hosti'),'Gastgeber angemeldet');ok(await reg(G,'gasti'),'Gast angemeldet');
 await H.evaluate(()=>{CO.lob={st:'menu'};coopHost();});
 let code=null;for(let i=0;i<40&&!code;i++){await wait(300);code=await H.evaluate(()=>CO.lob&&CO.lob.code);}ok(!!code,'Raum-Code erzeugt: '+code);
 ok(await H.evaluate(()=>{const L=[];const o=btn;btn=function(x,y,w,h,l){L.push(l);return o.apply(this,arguments);};try{draw();}finally{btn=o;}return L.includes('🔗 Einladungs-Link senden');}),'Gastgeber hat Einladungs-Link-Knopf');
 await H.screenshot({path:'../coop_lobby.png'});
 await G.evaluate(c=>coopJoin(c),code);
 let both=false;for(let i=0;i<60&&!both;i++){await wait(500);both=await H.evaluate(()=>CO.on&&st==='play')&&await G.evaluate(()=>CO.on&&st==='play');}
 ok(both,'beide im Spiel');
 const gs=await G.evaluate(()=>({fl,en:en.length,map:!!map,oh:!!CO.oh,pn:CO.pn,me:[me.x|0,me.y|0]}));const hs=await H.evaluate(()=>({fl,en:en.length,p2:[CO.p2.x|0,CO.p2.y|0],pn:CO.pn}));
 console.log('Gast sieht:',JSON.stringify(gs),' Gastgeber:',JSON.stringify(hs));ok(gs.fl===1&&gs.map&&gs.oh,'Gast hat Karte, Partner und Ebene');ok(hs.pn==='gasti'&&gs.pn==='hosti','Namen ausgetauscht');
 // Gast läuft nach rechts (Tastatur)
 await G.bringToFront();await G.keyboard.down('d');await wait(1200);await G.keyboard.up('d');await wait(400);
 const gp=await G.evaluate(()=>[me.x|0,me.y|0]),hp2=await H.evaluate(()=>[CO.p2.x|0,CO.p2.y|0]);ok(Math.abs(gp[0]-hp2[0])<20&&Math.abs(gp[1]-hp2[1])<20,'Gastgeber sieht Gast an seiner Position '+gp+' ~ '+hp2);
 // Gegner direkt neben den Gast setzen: Gast greift automatisch an, Gegner stirbt beim Gastgeber
 const kills0=await H.evaluate(()=>run.kills);
 await H.evaluate(()=>{const p=CO.p2;en=en.filter(e=>e.boss);const e=mkE(0,p.x+30,p.y);e.hp=e.mx=1;e.age=5;en.push(e);CO.me1.x=stairs.x+400;});
 await wait(1500);ok(await H.evaluate(()=>run.kills)>kills0,'Gast besiegt Gegner (beim Gastgeber gezählt)');
 // Gast bekommt Schaden
 await H.evaluate(()=>{const p=CO.p2;p.inv=0;const e=mkE(4,p.x+5,p.y);e.age=5;e.hp=e.mx=999;en.push(e);p.arm=[null,null,null];});await wait(1500);   // Gegner mit viel Leben: bleibt für „Gast sieht Gegner“ stehen
 const ghp=await G.evaluate(()=>[me.hp,me.mx]);ok(ghp[0]<ghp[1],'Gast nimmt Schaden: '+ghp);
 // Gegner beim Gast sichtbar
 ok(await G.evaluate(()=>en.length)>0,'Gast sieht Gegner');
 // Trank über Befehl
 await H.evaluate(()=>{en=[];CO.p2.hp=Math.max(1,CO.p2.hp);CO.p2.hp=Math.min(CO.p2.hp,CO.p2.mx-1);});await wait(300);
 const pots=await H.evaluate(()=>CO.p2.pots.heal);await G.evaluate(()=>usePot('heal'));await wait(800);ok(await H.evaluate(()=>CO.p2.pots.heal)===pots-1,'Gast trinkt Heiltrank (über Gastgeber)');
 // Nächste Ebene: Gastgeber geht zur Treppe
 await H.evaluate(()=>{en=[];CO.me1.x=stairs.x;CO.me1.y=stairs.y;});await wait(1500);
 ok(await G.evaluate(()=>fl)===2&&await H.evaluate(()=>fl)===2,'beide auf Ebene 2');await G.bringToFront();await wait(600);await G.screenshot({path:'../g_fl2.png'});console.log('G2',JSON.stringify(await G.evaluate(()=>{draw();const px=G_MAIN.getImageData(cv.width/2,cv.height/2,1,1).data;const ti=map[Math.floor(me.y/T)][Math.floor(me.x/T)];return {me:[me.x|0,me.y|0,me.hp],tile:ti,px:[...px],chunks:WD.ch.size,wdti:WD.ti,ready:WD.ready,G:g===G_MAIN,mapRows:map.length,mapType:typeof map[0][0],rooms:rooms.length,vis:vis.reduce((a,b)=>a+b,0),lob:!!CO.lob,stt:st};})));
 // Gast k.o., Gastgeber lebt weiter, Gast steht auf nächster Ebene wieder auf
 await H.evaluate(()=>{const s=me;me=CO.p2;me.inv=0;me.hp=1;hurt(5);me=s;});await wait(800);
 ok(await H.evaluate(()=>st==='play'&&CO.p2.hp===0),'Gast k.o., Spiel läuft weiter');await G.bringToFront();await wait(600);await G.screenshot({path:'../g_ko.png'});
 await H.evaluate(()=>{en=[];CO.me1.x=stairs.x;CO.me1.y=stairs.y;});await wait(1500);ok(await H.evaluate(()=>CO.p2.hp>0&&fl===3),'Gast steht auf Ebene 3 wieder auf');
 await G.bringToFront();await wait(800);console.log('GAST-ZUSTAND',JSON.stringify(await G.evaluate(()=>({me:[me.x,me.y,me.hp],vis:vis.reduce((a,b)=>a+b,0),WD:WD.ready,ti:WD.ti,fl,st,fade:fadeT,map0:map&&map[5]&&map[5].join('').slice(0,20),cfgfog:cfg.fog}))));await G.screenshot({path:'../coop_guest.png'});await H.screenshot({path:'../coop_host.png'});
 // beide k.o. -> Spielende bei beiden
 await H.evaluate(()=>{for(const h of heroes()){const s=me;me=h;me.inv=0;me.hp=1;me.arm=[null,null,null];hurt(9);me=s;}});await wait(1000);
 ok(await H.evaluate(()=>st)==='over'&&await G.evaluate(()=>st)==='over','beide k.o. -> Spielende bei beiden');
 // Verlassen
 await H.evaluate(()=>{coopEnd();st='ready';});await wait(1500);ok(await G.evaluate(()=>!CO.on),'Gast merkt, dass der Gastgeber weg ist');
 // Raum wurde gelöscht
 ok(await G.evaluate(async c=>{const d=await getDb();return !(await d.doc('rooms/'+c).get()).exists;},code),'Raum in Firebase gelöscht');
 console.log('JS-Fehler:',errs.length?errs.slice(0,6):'keine');console.log(fail?fail+' FEHLGESCHLAGEN':'ALLE TESTS BESTANDEN');await b.close();})();
