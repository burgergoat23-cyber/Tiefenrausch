const {chromium}=(()=>{try{return require('playwright')}catch(e){return require('/opt/node-tools/node_modules/playwright')}})();
(async()=>{const b=await chromium.launch();const errs=new Map();
 const p=await (await b.newContext({viewport:{width:1280,height:800}})).newPage();
 p.on('pageerror',e=>{const k=e.message+' | '+(e.stack||'').split('\n').slice(1,3).join(' ');errs.set(k,(errs.get(k)||0)+1);});
 p.on('console',m=>{if(m.type()==='error'){const k='console: '+m.text();errs.set(k,(errs.get(k)||0)+1);}});
 await p.goto('file://'+process.cwd()+'/'+(process.env.F||'cur.html'));await p.waitForTimeout(600);if(await p.isVisible('#bg'))await p.click('#bg');
 for(const md of ['story','endless','daily']){
  await p.evaluate(m=>newGame(undefined,m),md);
  for(let r=0;r<160;r++){
   const s=await p.evaluate(()=>{try{me.hp=me.mx;me.inv=1;
     if(ui){if(ui.type==='story'){const d=ui.done;ui=null;if(d)d();}else ui=null;}
     ch.forEach(c=>{if(!c.o){me.x=c.x;me.y=c.y;}});
     for(const e of en){e.hp=0;}
     if(!en.some(e=>e.boss)&&Math.random()<.5){me.x=stairs.x;me.y=stairs.y;}
     return {st,fl,ui:ui&&ui.type};}catch(e){return 'drv '+e.message}});
   if(s.st&&s.st!=='play')break;
   await p.waitForTimeout(60);
  }
  console.log(md,JSON.stringify(await p.evaluate(()=>({st,fl,best,gold,w:me.w,arm:me.arm,saves:Object.keys(saves).filter(k=>saves[k])}))));
  await p.evaluate(()=>{st='ready';});
 }
 // edge: weapon pickup equal, pots full, save/load roundtrip
 const r=await p.evaluate(()=>{const o={};try{newGame(undefined,'endless');fl=5;gen();saveGame();o.saved=JSON.stringify(saves.endless).length;newGame(saves.endless);o.loadFl=fl;}catch(e){o.err=e.message}return o;});
 console.log(JSON.stringify(r));
 for(const [k,v] of errs)console.log('ERR x'+v+': '+k);await b.close();})();
