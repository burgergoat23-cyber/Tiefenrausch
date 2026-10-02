const {chromium}=(()=>{try{return require('playwright')}catch(e){return require('/opt/node-tools/node_modules/playwright')}})();
(async()=>{
 const b=await chromium.launch({executablePath:require('fs').existsSync('/opt/pw-browsers/chromium-1194/chrome-linux/chrome')?'/opt/pw-browsers/chromium-1194/chrome-linux/chrome':undefined}).catch(()=>chromium.launch());
 const errs=new Map();
 for(const [vw,vh,touch] of [[1280,800,false],[390,844,true],[820,1180,true],[844,390,true]]){
  const ctx=await b.newContext({viewport:{width:vw,height:vh},hasTouch:touch});
  const p=await ctx.newPage();
  p.on('pageerror',e=>{const k=e.message+' | '+(e.stack||'').split('\n')[1];errs.set(k,(errs.get(k)||0)+1);});
  p.on('console',m=>{if(m.type()==='error'){const k='console: '+m.text();errs.set(k,(errs.get(k)||0)+1);}});
  await p.goto('file://'+process.cwd()+'/'+(process.env.F||'cur.html'));await p.waitForTimeout(800);
  await p.click('#bg').catch(e=>errs.set('guest click '+e.message,1));
  await p.waitForTimeout(500);
  for(const md of ['endless','story','daily']){
   await p.evaluate(m=>{try{newGame(undefined,m)}catch(e){console.error('newGame '+m+': '+e.message)}},md);
   for(let r=0;r<40;r++){
     await p.evaluate(()=>{try{
       if(st==='over'||st==='end'){newGame(undefined,mode);}
       if(ui){ // click random button
         if(btns.length){const bb=btns[Math.floor(Math.random()*btns.length)];try{bb.fn()}catch(e){console.error('btn: '+e.message+' '+e.stack.split('\n')[1])}}
       }
       me.hp=me.mx; me.inv=1;
       if(Math.random()<.3){en.forEach(e=>e.hp=0);}
       if(Math.random()<.25){me.x=stairs.x;me.y=stairs.y;}
       if(Math.random()<.2){const n=npcs[Math.floor(Math.random()*npcs.length)];if(n){me.x=n.x;me.y=n.y+20;}}
       if(Math.random()<.1)gold+=500;
     }catch(e){console.error('drv: '+e.message+' '+(e.stack||'').split('\n')[1])}});
     for(const k of ['w','a','s','d']){await p.keyboard.down(k);await p.waitForTimeout(40);await p.keyboard.up(k);}
     if(Math.random()<.3) await p.keyboard.press(['e','i','Escape','Enter','q','1','2','3','Space','Tab'][Math.floor(Math.random()*10)]);
     await p.mouse.click(Math.random()*vw,Math.random()*vh);
   }
   const s=await p.evaluate(()=>({st,fl,mode,ui:ui&&ui.type}));console.log(vw,vh,md,JSON.stringify(s));
  }
  await ctx.close();
 }
 for(const [k,v] of errs)console.log('ERR x'+v+': '+k);
 await b.close();
})();
