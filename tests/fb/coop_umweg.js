// Koop-Umweg: klappt keine direkte Verbindung (z. B. zwei Apple-Geräte im selben WLAN), laufen die Koop-Nachrichten
// über die Firebase Realtime Database (relay/CODE). Hier wird die direkte Verbindung absichtlich verhindert
// (iceTransportPolicy 'relay' ohne TURN-Server → keine Kandidaten), dann muss der Umweg greifen.
// Aufruf über: bash tests/run.sh --firebase
const {chromium}=(()=>{try{return require('playwright')}catch(e){return require('/opt/node-tools/node_modules/playwright')}})();const fs=require('fs');
const GAME=fs.readFileSync('../cur.html');const URL='https://burgergoat23-cyber.github.io/Tiefenrausch/';
let fail=0;const ok=(c,m)=>{console.log((c?'  OK  ':'  FAIL ')+m);if(!c)fail++;};const wait=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{const b=await chromium.launch({args:['--no-proxy-server','--disable-features=PrivateNetworkAccessSendPreflights,BlockInsecurePrivateNetworkRequests,PrivateNetworkAccessRespectPreflightResults,LocalNetworkAccessChecks,WebRtcHideLocalIpsWithMdns']});const errs=[];
 async function page(){const ctx=await b.newContext({viewport:{width:900,height:700}});
  await ctx.route(URL+'**',r=>r.fulfill({contentType:'text/html',body:GAME}));
  await ctx.route('https://www.gstatic.com/firebasejs/**',r=>{const f=r.request().url().split('/').pop();r.fulfill({contentType:'text/javascript',body:fs.readFileSync('node_modules/firebase/'+f)});});
  await ctx.addInitScript(()=>{window.FB_TEST=(a,db)=>{a.useEmulator('http://127.0.0.1:9099',{disableWarnings:true});db.useEmulator('127.0.0.1',8080);};
   window.FB_TEST_RTDB=d=>d.useEmulator('127.0.0.1',9000);});
  const p=await ctx.newPage();p.on('pageerror',e=>errs.push(e.message));await p.goto(URL);await p.waitForTimeout(1500);
  await p.evaluate(()=>{RTC_CFG.iceServers=[];RTC_CFG.iceTransportPolicy='relay';   // direkte Verbindung unmöglich machen
   window.__msgs=new Set();setInterval(()=>{if(CO.lob&&CO.lob.msg)window.__msgs.add(CO.lob.msg);},20);});   // Lobby-Meldungen mitschreiben
  return p;}
 async function reg(p,u){await p.fill('#un',u);await p.fill('#pw','geheim1');await p.click('#br');for(let i=0;i<50;i++){await wait(200);if(await p.evaluate(()=>!!acct))return true;}return false;}
 const H=await page(),G=await page();ok(await reg(H,'umweghost'),'Gastgeber angemeldet');ok(await reg(G,'umweggast'),'Gast angemeldet');
 await H.evaluate(()=>{CO.lob={st:'menu'};coopHost();});
 let code=null;for(let i=0;i<40&&!code;i++){await wait(300);code=await H.evaluate(()=>CO.lob&&CO.lob.code);}ok(!!code,'Raum-Code erzeugt: '+code);
 await G.evaluate(c=>coopJoin(c),code);
 let msg='';for(let i=0;i<60&&!/Umweg/.test(msg);i++){await wait(500);msg=(await G.evaluate(()=>[...window.__msgs].join(' / ')))+' | '+(await H.evaluate(()=>[...window.__msgs].join(' / ')));}
 ok(/Umweg/.test(msg),'direkte Verbindung scheitert → Hinweis „Umweg über den Server“: '+msg);
 let both=false;for(let i=0;i<80&&!both;i++){await wait(500);both=await H.evaluate(()=>CO.on&&st==='play')&&await G.evaluate(()=>CO.on&&st==='play');}
 ok(both,'beide im Spiel '+JSON.stringify(await H.evaluate(()=>CO.lob))+' '+JSON.stringify(await G.evaluate(()=>CO.lob)));
 ok(await H.evaluate(()=>!!CO.rl&&!CO.pc)&&await G.evaluate(()=>!!CO.rl&&!CO.pc),'beide nutzen den Umweg (keine direkte Verbindung)');
 await wait(1500);
 const gs=await G.evaluate(()=>({fl,map:!!map,oh:!!CO.oh,pn:CO.pn,en:en.length})),hs=await H.evaluate(()=>({fl,pn:CO.pn}));
 ok(gs.fl===1&&gs.map&&gs.oh,'Gast hat Karte, Partner und Ebene '+JSON.stringify(gs));ok(hs.pn==='umweggast'&&gs.pn==='umweghost','Namen ausgetauscht '+hs.pn+'/'+gs.pn);
 // Gast läuft nach rechts → Gastgeber sieht ihn dort
 await G.bringToFront();await G.keyboard.down('d');await wait(1500);await G.keyboard.up('d');await wait(1200);
 const gp=await G.evaluate(()=>[me.x|0,me.y|0]),hp2=await H.evaluate(()=>[CO.p2.x|0,CO.p2.y|0]);ok(Math.abs(gp[0]-hp2[0])<30&&Math.abs(gp[1]-hp2[1])<30,'Gastgeber sieht Gast an seiner Position '+gp+' ~ '+hp2);
 // Gegner neben den Gast: Gast besiegt ihn, beim Gastgeber gezählt
 const k0=await H.evaluate(()=>run.kills);
 await H.evaluate(()=>{const p=CO.p2;en=en.filter(e=>e.boss);const e=mkE(0,p.x+30,p.y);e.hp=e.mx=1;e.age=5;en.push(e);CO.me1.x=stairs.x+400;});
 await wait(2500);ok(await H.evaluate(()=>run.kills)>k0,'Gast besiegt Gegner (über den Umweg)');
 // Trank über Befehl (zuverlässige Nachricht)
 await H.evaluate(()=>{en=[];CO.p2.hp=Math.min(Math.max(1,CO.p2.hp),CO.p2.mx-1);});await wait(500);
 const pots=await H.evaluate(()=>CO.p2.pots.heal);await G.evaluate(()=>usePot('heal'));await wait(1500);ok(await H.evaluate(()=>CO.p2.pots.heal)===pots-1,'Gast trinkt Heiltrank (Befehl über den Umweg)');
 // nächste Ebene
 await H.evaluate(()=>{en=[];CO.me1.x=stairs.x;CO.me1.y=stairs.y;});await wait(2500);
 ok(await G.evaluate(()=>fl)===2&&await H.evaluate(()=>fl)===2,'beide auf Ebene 2');
 // Gast verlässt das Spiel → Gastgeber merkt es und spielt allein weiter
 await G.evaluate(()=>{coopEnd();st='ready';});
 let gone=false;for(let i=0;i<30&&!gone;i++){await wait(400);gone=await H.evaluate(()=>!CO.on&&!CO.rl);}
 ok(gone,'Gastgeber merkt, dass der Partner weg ist');ok(await H.evaluate(()=>st==='play'),'Gastgeber spielt allein weiter');
 console.log('JS-Fehler:',errs.length?errs.slice(0,6):'keine');if(errs.length)fail++;
 console.log(fail?fail+' FEHLGESCHLAGEN':'ALLE TESTS BESTANDEN');await b.close();process.exit(fail?1:0);})();
