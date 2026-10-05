// Koop: der Freund tritt erst nach 40 Sekunden bei (Code abtippen, anmelden …) – die Verbindung muss trotzdem klappen.
// Früher lief ab dem Erstellen des Raums eine 25-s-Uhr: wer später beitrat, bekam immer „Verbindung fehlgeschlagen“.
// Aufruf über: bash tests/run.sh --firebase
const {chromium}=(()=>{try{return require('playwright')}catch(e){return require('/opt/node-tools/node_modules/playwright')}})();const fs=require('fs');
const GAME=fs.readFileSync('../cur.html');const URL='https://burgergoat23-cyber.github.io/Tiefenrausch/';
let fail=0;const ok=(c,m)=>{console.log((c?'  OK  ':'  FAIL ')+m);if(!c)fail++;};const wait=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{const b=await chromium.launch({args:['--no-proxy-server','--disable-features=PrivateNetworkAccessSendPreflights,BlockInsecurePrivateNetworkRequests,PrivateNetworkAccessRespectPreflightResults,LocalNetworkAccessChecks,WebRtcHideLocalIpsWithMdns']});const errs=[];
 async function page(){const ctx=await b.newContext({viewport:{width:900,height:700}});
  await ctx.route(URL+'**',r=>r.fulfill({contentType:'text/html',body:GAME}));
  await ctx.route('https://www.gstatic.com/firebasejs/**',r=>{const f=r.request().url().split('/').pop();r.fulfill({contentType:'text/javascript',body:fs.readFileSync('node_modules/firebase/'+f)});});
  await ctx.addInitScript(()=>{window.FB_TEST=(a,db)=>{a.useEmulator('http://127.0.0.1:9099',{disableWarnings:true});db.useEmulator('127.0.0.1',8080);};});
  const p=await ctx.newPage();p.on('pageerror',e=>errs.push(e.message));await p.goto(URL);await p.waitForTimeout(1500);return p;}
 async function reg(p,u){await p.fill('#un',u);await p.fill('#pw','geheim1');await p.click('#br');for(let i=0;i<50;i++){await wait(200);if(await p.evaluate(()=>!!acct))return true;}return false;}
 const H=await page(),G=await page();ok(await reg(H,'spaethost'),'Gastgeber angemeldet');ok(await reg(G,'spaetgast'),'Gast angemeldet');
 await H.evaluate(()=>{CO.lob={st:'menu'};coopHost();});
 let code=null;for(let i=0;i<40&&!code;i++){await wait(300);code=await H.evaluate(()=>CO.lob&&CO.lob.code);}ok(!!code,'Raum-Code erzeugt: '+code);
 await wait(40000);   // Freund braucht 40 s
 ok(await H.evaluate(()=>!!(CO.lob&&CO.lob.st==='host')),'Gastgeber wartet nach 40 s immer noch auf den Mitspieler '+JSON.stringify(await H.evaluate(()=>CO.lob)));
 await G.evaluate(c=>coopJoin(c),code);
 let both=false;for(let i=0;i<60&&!both;i++){await wait(500);both=await H.evaluate(()=>CO.on&&st==='play')&&await G.evaluate(()=>CO.on&&st==='play');}
 ok(both,'nach spätem Beitritt beide im Spiel '+JSON.stringify(await H.evaluate(()=>CO.lob))+' '+JSON.stringify(await G.evaluate(()=>CO.lob)));
 await H.evaluate(()=>{coopEnd();st='ready';});await wait(800);
 console.log('JS-Fehler:',errs.length?errs.slice(0,6):'keine');console.log(fail?fail+' FEHLGESCHLAGEN':'ALLE TESTS BESTANDEN');await b.close();process.exit(fail?1:0);})();
