// Gast-Rangliste (Firebase-Emulator): Gäste wählen einen Namen und kommen ohne Konto in Tages-Rangliste und Bestenliste.
// Prüft auch die CrazyGames-Version (ohne Konten, nur Ranglisten) und die Sicherheitsregeln gegen Mogel-Versuche.
// Aufruf über  bash tests/run.sh --firebase
const {chromium}=(()=>{try{return require('playwright')}catch(e){return require('/opt/node-tools/node_modules/playwright')}})();
const fs=require('fs'),path=require('path'),os=require('os'),{execSync}=require('child_process');
const GAME=fs.readFileSync('../cur.html');const URL='https://burgergoat23-cyber.github.io/Tiefenrausch/';
const cgDir=fs.mkdtempSync(path.join(os.tmpdir(),'cgfb-'));execSync('python3 '+path.join(__dirname,'..','..','tools','build_crazygames.py')+' '+cgDir);
const CGAME=fs.readFileSync(path.join(cgDir,'index.html'));
const MOCK=`window.CrazyGames={SDK:{init:()=>Promise.resolve(),environment:'crazygames',user:{getUser:()=>Promise.resolve({username:'CrazyFuchs'})},game:{loadingStart(){},loadingStop(){},gameplayStart(){},gameplayStop(){},happytime(){}}}};`;
let fail=0;const ok=(c,m)=>{console.log((c?'  OK  ':'  FAIL ')+m);if(!c)fail++;};
const wait=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{const b=await chromium.launch({args:['--no-proxy-server','--disable-features=PrivateNetworkAccessSendPreflights,BlockInsecurePrivateNetworkRequests,PrivateNetworkAccessRespectPreflightResults,LocalNetworkAccessChecks']});const errs=[];
 async function page(body,vp){const ctx=await b.newContext({viewport:vp||{width:900,height:800}});
  await ctx.route(URL+'**',r=>r.fulfill({contentType:'text/html',body:body||GAME}));
  await ctx.route('https://sdk.crazygames.com/**',r=>r.fulfill({contentType:'text/javascript',body:MOCK}));
  await ctx.route('https://www.gstatic.com/firebasejs/**',r=>{const f=r.request().url().split('/').pop();r.fulfill({contentType:'text/javascript',body:fs.readFileSync('node_modules/firebase/'+f)});});
  await ctx.addInitScript(()=>{window.FB_TEST=(a,db)=>{a.useEmulator('http://127.0.0.1:9099',{disableWarnings:true});db.useEmulator('127.0.0.1',8080);};});
  const p=await ctx.newPage();p.on('pageerror',e=>errs.push(e.message));await p.goto(URL);await p.waitForTimeout(1500);return {ctx,p};}
 // Tageslauf spielen (3 Ebenen) und beenden
 const daily=p=>p.evaluate(()=>{meta.dplay=null;newGame(undefined,'daily');for(let i=0;i<3;i++){en=en.filter(e=>!e.boss);me.x=stairs.x;me.y=stairs.y;update(.016);}leaveGame();});
 const texts=p=>p.evaluate(()=>{const L=[];const o=CanvasRenderingContext2D.prototype.fillText;CanvasRenderingContext2D.prototype.fillText=function(s,...r){L.push(String(s));return o.call(this,s,...r);};draw();CanvasRenderingContext2D.prototype.fillText=o;return L.join('|');});

 console.log('1) Gast auf GitHub Pages wählt einen Namen');
 const G=await page();await G.p.click('#bg');await wait(300);
 ok(await G.p.evaluate(()=>LB_ON&&!acct&&guest),'Gast ohne Konto, Ranglisten erreichbar');
 await daily(G.p);await wait(300);
 ok(await G.p.isVisible('#gn'),'Namensfenster erscheint nach dem Tageslauf');
 await G.p.fill('#gnn','ab');await G.p.click('#gno');ok(/3–16/.test(await G.p.textContent('#gnm')),'zu kurzer Name abgelehnt');
 await G.p.fill('#gnn','admin');await G.p.click('#gno');ok(/reserviert/.test(await G.p.textContent('#gnm')),'reservierter Name abgelehnt');
 await G.p.fill('#gnn','Hitler 88');await G.p.click('#gno');ok(/anderen Namen/.test(await G.p.textContent('#gnm')),'Schimpf-/Nazi-Name abgelehnt');
 await G.p.fill('#gnn','Lena Süß');await G.p.click('#gno');await wait(3000);
 ok(!(await G.p.isVisible('#gn')),'Namensfenster schließt');
 const s1=await G.p.evaluate(()=>({sub:run.sub,n:gName}));ok(s1.sub==='Ergebnis eingetragen'&&s1.n==='Lena Süß','Gast-Ergebnis eingetragen '+JSON.stringify(s1));
 await G.p.evaluate(()=>lbLoad(1));await wait(1500);
 const l1=await G.p.evaluate(()=>({st:lb.st,rows:lb.rows.map(r=>lbNm(r)+':'+r.s+':'+r.g),me:lb.rows.some(lbMe)}));
 ok(l1.st==='ok'&&l1.rows.length===1&&/^Lena Süß \(Gast\):\d+:true$/.test(l1.rows[0])&&l1.me,'Rangliste zeigt Gast mit „(Gast)“ '+JSON.stringify(l1));
 await G.p.evaluate(()=>topLoad(1));await wait(1500);
 const t1=await G.p.evaluate(()=>tp.rows.map(r=>r.u+':'+r.fl+':'+r.g));ok(t1.length===1&&/^Lena Süß:\d+:true$/.test(t1[0]),'Bestenliste hat Gast-Eintrag '+JSON.stringify(t1));
 // Ranglisten-Seite: Knopf zum Ändern des Namens
 await G.p.evaluate(()=>{st='ready';bk={tab:3,pg:0,lt:0};});await wait(200);
 ok(/Name: Lena Süß \(Gast\)/.test(await texts(G.p)),'Ranglisten-Seite zeigt Namens-Knopf');
 ok(await G.p.evaluate(()=>{let f=null;const o=btn;btn=function(x,y,w,h,l,fn){if(/Name: /.test(l))f=fn;return o.apply(this,arguments);};try{draw();}finally{btn=o;}if(f)f();return!!f;}),'Namens-Knopf ist antippbar');
 ok(await G.p.isVisible('#gn'),'Namensfenster per Knopf');
 await G.p.fill('#gnn','LenaNeu');await G.p.click('#gno');await wait(300);await daily(G.p);await wait(3000);
 await G.p.evaluate(()=>lbLoad(1));await wait(1500);
 const l2=await G.p.evaluate(()=>lb.rows.map(r=>r.u));ok(l2.length===1&&l2[0]==='LenaNeu','Umbenennen ersetzt den Eintrag (kein Doppel) '+JSON.stringify(l2));
 const gid=await G.p.evaluate(async()=>await gUid());

 console.log('2) Mogel-Versuche als anonymer Gast');
 const deny=async(fn,m)=>{const r=await G.p.evaluate(fn).catch(e=>'ERR '+e.message);ok(/permission|PERMISSION|insufficient/i.test(String(r)),m+' → abgelehnt');};
 await deny(async()=>{const{db}=await fbLoad();const id=firebase.auth().currentUser.uid;try{await db.doc('daily/'+id).set({u:'alice',d:dayKey(),s:5,_j:'{}'});return'ok';}catch(e){return e.code;}},'Gast-Eintrag ohne Gast-Markierung');
 await deny(async()=>{const{db}=await fbLoad();try{await db.doc('daily/fremd123').set({u:'x',d:dayKey(),s:5,g:true,_j:'{}'});return'ok';}catch(e){return e.code;}},'Eintrag für fremde ID');
 await deny(async()=>{const{db}=await fbLoad();try{await db.doc('names/klaumich').set({id:firebase.auth().currentUser.uid,u:'klaumich'});return'ok';}catch(e){return e.code;}},'Gast reserviert Kontonamen');
 await deny(async()=>{const{db}=await fbLoad();const id=firebase.auth().currentUser.uid;try{await db.doc('players/'+id).set({u:'x'});return'ok';}catch(e){return e.code;}},'Gast in Admin-Spielerliste');
 await deny(async()=>{const{db}=await fbLoad();const id=firebase.auth().currentUser.uid;try{await db.doc('top/'+id).set({u:'x',fl:99999,g:true,k:1,t:1,a:1,b:2,c:3,d:4});return'ok';}catch(e){return e.code;}},'zu großer Bestenlisten-Eintrag');

 console.log('3) Konto darf sich nicht als Gast markieren, Gast kann sich danach anmelden');
 await G.p.evaluate(()=>{st='ready';guest=false;bk=null;});await wait(300);
 await G.p.fill('#un','tom');await G.p.fill('#pw','geheim1');await G.p.click('#br');
 for(let i=0;i<40;i++){await wait(200);if(await G.p.evaluate(()=>!!acct))break;}
 const a=await G.p.evaluate(async()=>({u:acct&&acct.u,id:await uid(),an:firebase.auth().currentUser.isAnonymous}));
 ok(a.u==='tom'&&a.id!==gid&&!a.an,'Gast meldet sich mit neuem Konto an '+JSON.stringify(a));
 await deny(async()=>{const{db}=await fbLoad();const id=firebase.auth().currentUser.uid;try{await db.doc('daily/'+id).set({u:'tom',d:dayKey(),s:5,g:true,_j:'{}'});return'ok';}catch(e){return e.code;}},'Konto-Eintrag mit Gast-Markierung');
 await daily(G.p);await wait(3000);ok(await G.p.evaluate(()=>run.sub)==='Ergebnis eingetragen','Konto trägt sich normal ein');
 await G.p.evaluate(()=>lbLoad(1));await wait(1500);
 const l3=await G.p.evaluate(()=>lb.rows.map(r=>lbNm(r)));ok(l3.includes('tom')&&l3.includes('LenaNeu (Gast)'),'Konto und Gast nebeneinander '+JSON.stringify(l3));

 console.log('4) CrazyGames-Version: keine Konten, aber Ranglisten');
 for(const vp of [{width:820,height:1180},{width:844,height:390}]){
  const C=await page(CGAME,vp);await wait(4500);
  const c=await C.p.evaluate(()=>({CG,FB_ON,LB_ON,guest,lg:document.getElementById('lg').style.display}));
  ok(c.CG&&!c.FB_ON&&c.LB_ON&&c.guest&&c.lg!=='block',vp.width+'x'+vp.height+': CrazyGames ohne Anmeldung, mit Ranglisten '+JSON.stringify(c));
  const tx=await texts(C.p);ok(/Ranglisten/.test(tx)&&!/Koop|Anmelden|Beenden/.test(tx),'Titel hat Ranglisten, kein Koop/Anmelden/Beenden');
  await daily(C.p);await wait(500);ok(await C.p.isVisible('#gn'),'Namensfenster nach dem Tageslauf');
  ok(await C.p.inputValue('#gnn')==='CrazyFuchs','Name aus dem CrazyGames-Konto vorgeschlagen');
  if(vp.width===820){await C.p.click('#gno');await wait(3000);ok(await C.p.evaluate(()=>run.sub)==='Ergebnis eingetragen','CrazyGames-Gast eingetragen');
   await C.p.evaluate(()=>lbLoad(1));await wait(1500);const l4=await C.p.evaluate(()=>lb.rows.map(r=>lbNm(r)));ok(l4.includes('CrazyFuchs (Gast)'),'CrazyGames-Gast in der Rangliste '+JSON.stringify(l4));}
  else{await C.p.click('#gnx');await wait(300);ok(!(await C.p.isVisible('#gn'))&&await C.p.evaluate(()=>!gName&&run.sub==='Ohne Namen kein Eintrag in die Rangliste'),'„Ohne Rangliste“ trägt nichts ein');}
  await C.p.screenshot({path:path.join(cgDir,'cg_gn_'+vp.width+'.png')});await C.ctx.close();}

 console.log('JS-Fehler:',errs.length?errs:'keine');if(errs.length)fail++;console.log(fail?fail+' FEHLGESCHLAGEN':'ALLE TESTS BESTANDEN');console.log('Bilder in',cgDir);await b.close();process.exit(fail?1:0);})();
