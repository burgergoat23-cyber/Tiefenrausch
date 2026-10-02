const {chromium}=(()=>{try{return require('playwright')}catch(e){return require('/opt/node-tools/node_modules/playwright')}})();
let fail=0;const ok=(c,m)=>{console.log((c?'  OK  ':'  FAIL ')+m);if(!c)fail++;};
(async()=>{const b=await chromium.launch();const p=await (await b.newContext({viewport:{width:900,height:800}})).newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
 await p.goto('file://'+process.cwd()+'/cur.html');await p.waitForTimeout(400);
 const r=await p.evaluate(()=>{const o={mix:{},err:[]};newGame(undefined,'endless');
  // Zusammensetzung der Gegner je Tiefe (Durchschnitt über 30 Ebenen-Erzeugungen)
  for(const F of [1,5,10,20,40,80,200]){let base=0,vari=0,tot=0,names={};for(let r=0;r<30;r++){fl=F;gen();for(const e of en){if(e.boss)continue;tot++;if(e.v!=null){vari++;const n=VAR[e.v].n;names[n]=(names[n]||0)+1;}else base++;}}
    const top=Object.entries(names).sort((a,b)=>b[1]-a[1]).slice(0,4).map(x=>x[0]).join(', ');o.mix['Ebene '+F]={proRaum:+(tot/30/ (rooms.length-1)).toFixed(1),alt:Math.round(base/tot*100)+'%',neu:Math.round(vari/tot*100)+'%',haeufig:top||'-',hpOrk:mkE(4,0,0).mx,elite:Math.round(Math.min(.35,.12+F*.002)*100)+'%'};}
  // jede Variante + jeden neuen Boss 20 s lang kämpfen lassen
  const done={};for(let v=0;v<VAR.length;v++){try{fl=VAR[v].boss?30:Math.max(VAR[v].from,5);gen();en=[];zp=[];eb=[];const e=VAR[v].boss?(function(){const x=mkB(VAR[v].k,me.x+120,me.y);x.v=v;x.at2=.5;return x;})():mkV(v,me.x+90,me.y);en.push(e);
     let shots=0,zaps=0,minis=0;for(let i=0;i<400;i++){me.hp=me.mx;me.inv=0;const n0=eb.length,z0=zp.length;update(.05);shots+=Math.max(0,eb.length-n0);zaps+=Math.max(0,zp.length-z0);if(i===200&&e.boss)e.hp=e.mx*.4;draw();}
     minis=en.filter(m=>m.sum||m.mini).length;done[VAR[v].n]={schuesse:shots,einschlaege:zaps,diener:minis,lebt:en.includes(e)};}catch(x){o.err.push(VAR[v].n+': '+x.message+' '+x.stack.split('\n')[1]);}}
  o.done=done;
  // Split + Bombe gezielt
  fl=10;gen();en=[];const s0=mkV(0,me.x+30,me.y);s0.hp=0;en.push(s0);update(.016);o.splitMinis=en.filter(m=>m.mini).length;
  fl=35;gen();en=[];const bo=mkV(7,me.x+20,me.y);en.push(bo);me.inv=0;me.hp=me.mx;const h=me.hp;update(.016);o.bombeSchaden=h-me.hp;o.bombeWeg=!en.includes(bo);
  // Boss-Abfolge im Endlos
  o.bosse=[];for(let F=3;F<=66;F+=3){fl=F;o.bosse.push(F+':'+bossTitle({k:bossK(F),v:bossV(F)}));}
  return o;});
 console.table(r.mix);console.log(JSON.stringify(r.done,null,0).replace(/},/g,'},\n'));console.log('Split:',r.splitMinis,'Bombe:',r.bombeSchaden,r.bombeWeg);console.log(r.bosse.join(' | '));
 ok(!r.err.length,'alle Varianten/Bosse ohne Fehler '+r.err.join('; '));ok(r.splitMinis===2,'Giftschleim teilt sich');ok(r.bombeSchaden>=2&&r.bombeWeg,'Irrlicht explodiert');
 await p.evaluate(()=>{meta.v=VAR.map(()=>3);meta.k=meta.k.map(()=>2);bk={tab:0,pg:1};st='ready';});await p.waitForTimeout(300);await p.screenshot({path:'best_var.png'});
 await p.evaluate(()=>{fl=42;gen();st='play';ui=null;en=en.filter(e=>!e.boss);const v=[];for(let i=0;i<10;i++)en.push(mkV(i,me.x-200+i*45,me.y+60));zp=[];zap(me.x+60,me.y-40,1,44,2,'#ff6a2a');for(const e of en)e.age=5;});await p.waitForTimeout(300);await p.screenshot({path:'mon_play.png'});
 console.log('JS-Fehler:',errs.length?errs.slice(0,5):'keine');console.log(fail?'FEHLER':'ALLE OK');await b.close();})();
