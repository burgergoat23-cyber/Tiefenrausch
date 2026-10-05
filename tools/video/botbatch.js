// Rechnet die Werte der Ranglisten-Bots mit echten Autopilot-Läufen aus (botsim.js) und schreibt tools/video/bots_werte.json.
// Bestenliste: beste Ebene aus 5 Läufen je Bot. Tageslauf: ein Lauf je Bot und Tag (gleiches Tages-Dungeon wie für alle).
// Bots: 0 = Bruno (leicht: sieht Gefahren nicht, keine Tränke), 1 = Greta (mittel: sieht Gefahren nicht, spielt höchstens 3 min),
//       2 = Kuno (schwer: spielt sauber, höchstens 8 min). Aufruf: node tools/video/botbatch.js [bis=2026-12-31]
const {execFile}=require('child_process'),fs=require('fs'),path=require('path');
const BIS=process.argv[2]||'2026-12-31',SIM=path.join(__dirname,'botsim.js');
const ST=[{hc:'gefahr,traenke',min:40},{hc:'gefahr',min:3},{hc:'',min:8}];
const runs=[];
for(let l=0;l<3;l++)for(let k=1;k<=5;k++)runs.push({key:'top',l,args:['endless',String(l)],env:{HC:ST[l].hc,MAXMIN:String(ST[l].min),SEED:String(1000*l+k)}});
const heute=new Date().toISOString().slice(0,10);
for(let d=new Date(heute+'T12:00:00Z');d.toISOString().slice(0,10)<=BIS;d.setUTCDate(d.getUTCDate()+1)){const day=d.toISOString().slice(0,10);
  for(let l=0;l<3;l++)runs.push({key:day,l,args:['daily',String(l),day],env:{HC:ST[l].hc,MAXMIN:String(ST[l].min),SEED:String(+day.replace(/-/g,'')*3+l)}});}
const out={top:[0,0,0],day:{}};let i=0,done=0;
function next(){if(i>=runs.length)return null;const r=runs[i++];return new Promise(res=>execFile('node',[SIM,...r.args],{env:Object.assign({},process.env,r.env),timeout:600000},(e,so)=>{
  try{const j=JSON.parse(String(so).trim().split('\n').pop());if(r.key==='top')out.top[r.l]=Math.max(out.top[r.l],j.fl);else{(out.day[r.key]=out.day[r.key]||[0,0,0,0,0,0]);out.day[r.key][r.l*2]=j.s;out.day[r.key][r.l*2+1]=j.fl;}}catch(x){console.log('Fehler',r.key,r.l,String(e||'').slice(0,80));}
  if(++done%30===0)console.log(done,'/',runs.length);res();}));}
(async()=>{const w=async()=>{let p;while((p=next()))await p;};await Promise.all([w(),w(),w(),w()]);
  fs.writeFileSync(path.join(__dirname,'bots_werte.json'),JSON.stringify(out));console.log('fertig:',runs.length,'Läufe, Bestenliste',out.top,'Tage',Object.keys(out.day).length);})();
