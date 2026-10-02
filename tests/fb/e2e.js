const {chromium}=(()=>{try{return require('playwright')}catch(e){return require('/opt/node-tools/node_modules/playwright')}})();const fs=require('fs');
const GAME=fs.readFileSync('../cur.html');const URL='https://burgergoat23-cyber.github.io/Tiefenrausch/';
let fail=0;const ok=(c,m)=>{console.log((c?'  OK  ':'  FAIL ')+m);if(!c)fail++;};
(async()=>{const b=await chromium.launch({args:['--no-proxy-server','--disable-features=PrivateNetworkAccessSendPreflights,BlockInsecurePrivateNetworkRequests,PrivateNetworkAccessRespectPreflightResults,LocalNetworkAccessChecks']});const errs=[];
 async function page(){const ctx=await b.newContext({viewport:{width:900,height:800}});
  await ctx.route(URL+'**',r=>r.fulfill({contentType:'text/html',body:GAME}));
  await ctx.route('https://www.gstatic.com/firebasejs/**',r=>{const f=r.request().url().split('/').pop();r.fulfill({contentType:'text/javascript',body:fs.readFileSync('node_modules/firebase/'+f)});});
  await ctx.addInitScript(()=>{window.FB_TEST=(a,db)=>{a.useEmulator('http://127.0.0.1:9099',{disableWarnings:true});db.useEmulator('127.0.0.1',8080);};});
  const p=await ctx.newPage();p.on('pageerror',e=>errs.push(e.message));await p.goto(URL);await p.waitForTimeout(1500);return {ctx,p};}
 const msg=p=>p.textContent('#lm');
 async function auth(p,u,pw,reg){await p.fill('#un',u);await p.fill('#pw',pw);await p.click(reg?'#br':'#bl');
  for(let i=0;i<60;i++){await p.waitForTimeout(200);const s=await p.evaluate(()=>({a:acct&&acct.u,m:document.getElementById('lm').textContent}));if(s.a||(s.m&&s.m!=='Bitte warten …'))return s;}return {a:null,m:'timeout'};}
 const wait=ms=>new Promise(r=>setTimeout(r,ms));

 console.log('1) Spielerin alice registriert sich');
 const A=await page();ok(await A.p.isVisible('#lg'),'Anmeldefenster ist auf github.io sichtbar');
 let r=await auth(A.p,'Alice','geheim1',true);ok(r.a==='alice','Konto erstellt ('+JSON.stringify(r)+')');
 ok(!(await A.p.isVisible('#lg')),'Anmeldefenster verschwindet');
 ok(!(await A.p.isVisible('#admb')),'alice sieht keinen Admin-Knopf');
 // Spielen + Tageslauf werten
 await A.p.evaluate(()=>{newGame(undefined,'endless');for(let i=0;i<3;i++){en=en.filter(e=>!e.boss);me.x=stairs.x;me.y=stairs.y;update(.016);}leaveGame();});
 await A.p.evaluate(()=>{newGame(undefined,'daily');for(let i=0;i<4;i++){en=en.filter(e=>!e.boss);me.x=stairs.x;me.y=stairs.y;update(.016);}leaveGame();});
 await wait(3000);
 const sub=await A.p.evaluate(()=>run.sub);ok(sub==='Ergebnis eingetragen','Tageslauf in Rangliste eingetragen ('+sub+')');
 await A.p.evaluate(()=>lbLoad(1));await wait(1500);
 const lbA=await A.p.evaluate(()=>({st:lb.st,rows:lb.rows.map(x=>x.u+':'+x.s),rank:lb.rank}));ok(lbA.st==='ok'&&lbA.rows.length===1,'Rangliste lädt '+JSON.stringify(lbA));
 const aId=await A.p.evaluate(()=>myId);

 console.log('2) Speichern in der Cloud: alice auf zweitem Gerät');
 const A2=await page();r=await auth(A2.p,'alice','geheim1',false);ok(r.a==='alice','Anmeldung auf 2. Gerät');
 await wait(1500);const sv=await A2.p.evaluate(()=>saves.endless&&saves.endless.fl);ok(sv===4,'Spielstand vom 1. Gerät da (Ebene '+sv+')');
 const dd=await A2.p.evaluate(()=>dDone());ok(dd===true,'Tageslauf-Sperre gilt auch auf dem 2. Gerät');

 console.log('3) Falsches Passwort / Name vergeben / reservierter Name');
 const B=await page();
 r=await auth(B.p,'alice','falsch99',false);ok(!r.a&&r.m==='Falsches Passwort','falsches Passwort: '+r.m);
 r=await auth(B.p,'gibtsnicht','geheim1',false);ok(!r.a&&/gibt es hier nicht/.test(r.m),'unbekanntes Konto: '+r.m);
 r=await auth(B.p,'alice','irgendwas',true);ok(!r.a&&/vergeben/.test(r.m),'Name vergeben: '+r.m);
 r=await auth(B.p,'admin','geheim1',true);ok(!r.a&&/reserviert/.test(r.m),'reservierter Name: '+r.m);
 r=await auth(B.p,'bob','geheim2',true);ok(r.a==='bob','bob registriert');

 console.log('4) Hacker-Versuche von bob (direkt an der Datenbank vorbei am Spiel)');
 const h=await B.p.evaluate(async aId=>{const d=await claude.use('db'),o={};const t=async(k,f)=>{try{await f();o[k]='ERLAUBT';}catch(e){o[k]='verweigert';}};
   await t('Spielerliste lesen',()=>d.collection('players').get());
   await t('alice sperren',()=>d.doc('banned/'+aId).set({u:'x',t:1}));
   await t('alices Ranglisten-Eintrag ändern',()=>d.doc('daily/'+aId).set({u:'alice',d:'2026-10-02',s:1,fl:1,k:0,t:1}));
   await t('alices Ranglisten-Eintrag löschen',()=>d.doc('daily/'+aId).delete());
   await t('alices Spielstand lesen',()=>d.doc('data/users/'+aId+'/a_alice').get());
   await t('Fantasie-Punktzahl 99 Mio',()=>d.doc('daily/'+myId).set({u:'bob',d:'2026-10-02',s:99000000,fl:1,k:0,t:1}));
   await t('Namen alice stehlen',()=>d.doc('names/alice').set({id:myId,u:'alice',t:1}));
   return o;},aId);
 for(const k in h)ok(h[k]==='verweigert',k+': '+h[k]);

 console.log('4b) Bestenliste');
 await A2.p.evaluate(async()=>{best=17;acct.tb=0;pBusy=0;await pingPlayer();});
 await B.p.evaluate(async()=>{best=9;acct.tb=0;pBusy=0;await pingPlayer();});
 const G0=await page();await G0.p.click('#bg');await wait(300);
 const tl=await G0.p.evaluate(async()=>{await topLoad(1);return{st:tp.st,rows:tp.rows.map(r=>r.u+':'+r.fl)};});
 ok(tl.st==='ok'&&tl.rows.join()==='alice:17,bob:9','Bestenliste für Gäste sichtbar, sortiert: '+JSON.stringify(tl));
 const hk=await B.p.evaluate(async aId=>{const d=await claude.use('db');try{await d.doc('top/'+aId).set({u:'alice',fl:1,k:0,t:1});return 'ERLAUBT';}catch(e){return 'verweigert';}},aId);
 ok(hk==='verweigert','fremden Bestenlisten-Eintrag ändern: '+hk);
 await G0.p.evaluate(()=>{bk={tab:3,pg:0,lt:1};st='ready';});await wait(500);await G0.p.screenshot({path:'../top.png'});
 console.log('5) Admin BurgerGoat44');
 const C=await page();r=await auth(C.p,'BurgerGoat44','adminpw1',true);ok(r.a==='burgergoat44','Admin-Konto erstellt');
 await C.p.evaluate(()=>{st='ready';});await wait(600);ok(await C.p.isVisible('#admb'),'Admin-Knopf sichtbar');
 await C.p.click('#admb');await wait(2500);
 const panel=await C.p.textContent('#adl');ok(/alice/.test(panel)&&/bob/.test(panel),'Admin sieht alice und bob');
 ok(!/Fehler/.test(await C.p.textContent('#adg')),'kein Fehler im Admin-Panel');
 // alice sperren (zweimal tippen = bestätigen)
 await C.p.evaluate(async aId=>{const r=admData.rows.find(x=>x.id===aId);await admAct('ban',r);await admAct('ban',r);},aId);await wait(1500);
 ok(await C.p.evaluate(aId=>admData.ban.has(aId),aId),'alice gesperrt');
 await C.p.evaluate(async aId=>{const r=admData.rows.find(x=>x.id===aId);await admAct('lb',r);await admAct('lb',r);},aId);await wait(1500);
 ok(await C.p.evaluate(aId=>admData.day[aId]===undefined,aId),'alices Ranglisten-Eintrag gelöscht');

 console.log('6) Gesperrte alice');
 const A3=await page();r=await auth(A3.p,'alice','geheim1',false);ok(!r.a&&/gesperrt/.test(r.m),'gesperrt: '+r.m);

 console.log('7) Automatisch angemeldet nach Neuladen, Abmelden');
 await B.p.reload();await wait(2500);ok(await B.p.evaluate(()=>acct&&acct.u)==='bob','bob nach Neuladen noch angemeldet');
 await B.p.evaluate(()=>logout());await wait(800);
 ok(await B.p.evaluate(async()=>{const u=await claude.use('user');return await u.id();})===null,'nach Abmelden bei Firebase abgemeldet');
 ok(await B.p.isVisible('#lg'),'Anmeldefenster wieder da');
 const G=await page();await G.p.click('#bg');await wait(300);
 ok(await G.p.evaluate(()=>{newGame(undefined,'endless');return st==='play';}),'Gast kann ohne Konto spielen');

 console.log('JS-Fehler:',errs.length?errs:'keine');console.log(fail?fail+' FEHLGESCHLAGEN':'ALLE TESTS BESTANDEN');await b.close();})();
