// Hintergrundbilder aus dem Titelbild des Spiels (YouTube-Banner, iPad, PC) → promo/.  Aufruf: node tools/video/hintergrund.js
const {chromium}=require('/opt/node-tools/node_modules/playwright');
(async()=>{const b=await chromium.launch();
for(const [name,w,h,d,logo] of [['youtube_banner_2560x1440',1280,720,2,1],['hintergrund_ipad_2048x2732',1024,1366,2,1],['hintergrund_pc_1920x1080',1280,720,1.5,1]]){
 const p=await b.newPage({viewport:{width:w,height:h},deviceScaleFactor:d});
 await p.addInitScript(()=>{let now=0;performance.now=()=>now+=0;window.__adv=t=>{now=t};window.requestAnimationFrame=()=>1;});
 await p.goto('file:///home/user/Tiefenrausch/index.html');await p.waitForTimeout(600);
 await p.evaluate(([lg])=>{document.getElementById('lg').style.display='none';__adv(4200);resetTf();titleBG();
   if(lg){const L=W>H,fs=L?Math.min(92,W/9):Math.min(120,W/7.5);titleLogo(L?H*.47:H*.36,fs,false);}},[logo]);
 await p.waitForTimeout(300);
 await p.evaluate(()=>{__adv(4300);});
 await p.screenshot({path:'/home/user/Tiefenrausch/promo/'+name+'.png'});await p.close();}
await b.close();})();
