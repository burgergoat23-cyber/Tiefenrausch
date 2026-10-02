const {chromium}=(()=>{try{return require('playwright')}catch(e){return require('/opt/node-tools/node_modules/playwright')}})();
(async()=>{const b=await chromium.launch();const out={};
 for(const f of ['cur.html']){const p=await (await b.newContext()).newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
  await p.goto('file://'+process.cwd()+'/'+f);await p.waitForTimeout(400);if(await p.isVisible('#bg'))await p.click('#bg');
  out[f]=await p.evaluate(()=>{newGame(undefined,'endless');const R={};
   for(const F of [3,9,15,21,30,45,60,90]){fl=F;const c=[0,0,0,0,0,0,0,0];let ar=[0,0,0,0,0,0];
     for(let k=0;k<4000;k++){it=[];bossLoot0({x:100,y:100,k:5});const w=it.find(i=>i.t==='weapon'),a=it.find(i=>i.t==='armor');c[w.w.t]++;ar[a.ar.t]++;}
     const ch=[0,0,0,0,0,0,0];for(let k=0;k<4000;k++){it=[];openChest0({x:100,y:100,o:0,boss:1});const w=it.find(i=>i.t==='weapon');if(w)ch[w.w.t]++;}
     const pct=a=>a.map(x=>Math.round(x/40)+'%').join(' ');
     R['Ebene '+F]={bossHP:mkB(5,100,100).mx,waffe:pct(c),ruestung:pct(ar),bossTruhe:pct(ch)};}
   return R;});console.log('\n=== '+f+' ===  (Gew Ung Sel Epi Leg Myth Gött Kosm)');console.table(out[f]);if(errs.length)console.log(errs);}
 await b.close();})();
