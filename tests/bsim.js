const {chromium}=(()=>{try{return require('playwright')}catch(e){return require('/opt/node-tools/node_modules/playwright')}})();
(async()=>{const b=await chromium.launch();const p=await (await b.newContext()).newPage();
 await p.goto('file://'+process.cwd()+'/'+(process.env.F||'cur.html'));await p.waitForTimeout(400);
 const r=await p.evaluate(()=>{newGame(undefined,'endless');const out={};
  const fight=(F,v,k,seed)=>{fl=F;gen();ui=null;en=[];eb=[];zp=[];
    const e=mkB(k,me.x+150,me.y);if(v!=null){e.v=v;e.at2=2;}en.push(e);
    me.w=mkW(UNIQ[seed%UNIQ.length]);me.arm=[{s:0,t:4},{s:1,t:4},{s:2,t:4}];me.mx=12;me.hp=1e6;me.db=0;
    let taken=0,t=0,ang=seed;const hurt0=hurt;
    // Bot: kreist in Nahkampf-/Fernkampfabstand um den Boss, weicht nicht gezielt aus
    while(t<120&&e.hp>0&&en.includes(e)){const R=WP[me.w.i].proj?200:70;ang+=.05*.6;const tx=e.x+Math.cos(ang)*R,ty=e.y+Math.sin(ang)*R;const dx=tx-me.x,dy=ty-me.y,d=Math.hypot(dx,dy)||1;
      me.x+=Math.max(-1,Math.min(1,dx/40))*150*.05*(Math.abs(dx)>3?1:0);me.y+=Math.max(-1,Math.min(1,dy/40))*150*.05*(Math.abs(dy)>3?1:0);
      const h=me.hp;update(.05);taken+=Math.max(0,h-me.hp);t+=.05;}
    return{t:+t.toFixed(1),taken,perMin:+(taken/t*60).toFixed(1),hp:e.mx,dead:!(e.hp>0)};};
  const cases=[];for(let k=5;k<=11;k++)cases.push([(k-4)*3,null,k,BN[k-5]]);for(const v of VBOSS)cases.push([24+3*VBOSS.indexOf(v),v,VAR[v].k,VAR[v].n]);
  for(const [F,v,k,n] of cases){let a=[];for(let s=0;s<4;s++)a.push(fight(F,v,k,s));out[n+' (E'+F+')']={HP:a[0].hp,Zeit_s:+(a.reduce((x,y)=>x+y.t,0)/4).toFixed(0),Schaden_pro_Min:+(a.reduce((x,y)=>x+y.perMin,0)/4).toFixed(0),besiegt:a.filter(x=>x.dead).length+'/4'};}
  return out;});console.table(r);await b.close();})();
