const {chromium}=(()=>{try{return require('playwright')}catch(e){return require('/opt/node-tools/node_modules/playwright')}})();
(async()=>{const b=await chromium.launch();const p=await (await b.newContext({viewport:{width:1024,height:768},deviceScaleFactor:2})).newPage();
 await p.goto('file://'+process.cwd()+'/cur.html');await p.waitForTimeout(400);
 const r=await p.evaluate(()=>{newGame(undefined,'endless');const res={a:[],b:[],c:[]};
  const setup=(kind)=>{fl=40;gen();ui=null;en=[];for(let i=0;i<20;i++){const e=kind==='a'?mkE(i%5,me.x+((i*37)%400)-200,me.y+((i*53)%300)-150):mkV(i%10,me.x+((i*37)%400)-200,me.y+((i*53)%300)-150);if(kind==='c')e.v=null;e.age=5;e.cd=99;e.at2=99;en.push(e);}me.inv=999;};
  const meas=()=>{for(let i=0;i<10;i++)draw();const t0=performance.now();for(let i=0;i<80;i++){tm+=.016;draw();}return (performance.now()-t0)/80;};
  for(let rep=0;rep<4;rep++)for(const k of ['a','b','c']){setup(k);res[k].push(meas());}
  const md=a=>a.sort((x,y)=>x-y)[Math.floor(a.length/2)].toFixed(1);return {alte:md(res.a),neue_getoent:md(res.b),neue_ohne_toenung:md(res.c)};});
 console.log('nur Zeichnen, 20 Gegner, Median ms/Bild:',r);await b.close();})();
