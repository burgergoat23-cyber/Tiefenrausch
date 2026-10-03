// Baut aus einer Langaufnahme (long.js / bosse.js: <name>_roh.mkv + <name>_ereignisse.json) die fertigen Videos mit Einblendungen
// (Ebenen-Zähler, Boss-Namen, Meilensteine, besondere Waffen, Tode, gerettete Dorfbewohner) auf Deutsch und Englisch
// + Kapitel-Liste für die YouTube-Beschreibung.   Aufruf: node tools/video/long_mix.js <ordner>/<name> [de|en|beide]
const fs=require('fs'),path=require('path'),vm=require('vm'),{execSync}=require('child_process');
const BASE=process.argv[2],LANGS_=(process.argv[3]||'beide')==='beide'?['de','en']:[process.argv[3]],ROOT=path.join(__dirname,'..','..');
const NAME=path.basename(BASE),{dur,ev}=JSON.parse(fs.readFileSync(BASE+'_ereignisse.json','utf8'));
// englische Spielnamen (Bosse, Waffen) aus dem Spiel-Wörterbuch
const html=fs.readFileSync(path.join(ROOT,'index.html'),'utf8');let EN={};
{const i=html.indexOf('LANGS.en={'),j=html.indexOf('};',html.indexOf(',d:{',i))+2;try{const c={LANGS:{}};vm.runInNewContext(html.slice(i,j),c);EN=c.LANGS.en.d||{};}catch(e){console.log('Wörterbuch nicht lesbar',e.message);}}
const tr=(l,s)=>l==='en'&&s?(EN[s]||s):s;
const TN={de:['Gewöhnlich','Ungewöhnlich','Selten','Episch','Legendär','Mythisch','Göttlich','Kosmisch'],en:['Common','Uncommon','Rare','Epic','Legendary','Mythic','Divine','Cosmic']};
const TCOL=['cfd3e6','7be495','5cb8ff','c77dff','ffb347','ff5df0','fff3b0','7cf5ff'];
const X={de:{fl:'EBENE',floor:n=>'Ebene '+n,mile:n=>'EBENE '+n+'!',boss:'BOSS',dead:'GEFALLEN',deadS:'weiter vom letzten Speicherstand',deaths:'Tode',
    gun:(t,w)=>TN.de[t].toUpperCase()+'E WAFFE: '+w,vil:n=>'Dorfbewohner gerettet ('+n+'/10)',play:'Jetzt selbst spielen',url:'burgergoat44.itch.io/tiefenrausch',
    endlos100:['Endlos-Modus bis Ebene 100','Ohne Unverwundbarkeit – ein Autopilot spielt ehrlich'],story_komplett:['Story-Modus komplett','Alle 15 Ebenen · Dorfbewohner · Endboss Vorath'],
    bosse:['Alle Bosse in Tiefenrausch','Jeder Boss – ein ehrlicher Kampf'],
    done:{endlos100:n=>'GESCHAFFT: EBENE '+n,story_komplett:()=>'STORY GESCHAFFT!',bosse:()=>'ALLE BOSSE BESIEGT'},chap:{start:'Start',fl:n=>'Ebene '+n,end:'Ende'}},
  en:{fl:'FLOOR',floor:n=>'Floor '+n,mile:n=>'FLOOR '+n+'!',boss:'BOSS',dead:'DEFEATED',deadS:'continuing from the last save',deaths:'Deaths',
    gun:(t,w)=>TN.en[t].toUpperCase()+' WEAPON: '+w,vil:n=>'Villager rescued ('+n+'/10)',play:'Play it yourself',url:'burgergoat44.itch.io/tiefenrausch',
    endlos100:['Endless mode to floor 100','No invincibility – an autopilot plays it fair'],story_komplett:['Story mode – full playthrough','All 15 floors · villagers · final boss Vorath'],
    bosse:['Every boss in Tiefenrausch','Every boss – a fair fight'],
    done:{endlos100:n=>'MADE IT: FLOOR '+n,story_komplett:()=>'STORY COMPLETE!',bosse:()=>'ALL BOSSES DEFEATED'},chap:{start:'Start',fl:n=>'Floor '+n,end:'Ending'}}};
const ts=t=>{t=Math.max(0,t);const h=Math.floor(t/3600),m=Math.floor(t/60)%60,s=(t%60).toFixed(2).padStart(5,'0');return h+':'+String(m).padStart(2,'0')+':'+s;};
const yt=t=>{t=Math.floor(t);const m=Math.floor(t/60),s=t%60;return (m>=60?Math.floor(m/60)+':'+String(m%60).padStart(2,'0'):m)+':'+String(s).padStart(2,'0');};
const esc=s=>String(s).replace(/[{}]/g,'').replace(/\n/g,'\\N');
for(const l of LANGS_){const x=X[l],L=[];const D=(a,b,st,txt)=>L.push(`Dialogue: 0,${ts(a)},${ts(b)},${st},,0,0,0,,${txt}`);
  const ebs=ev.filter(e=>e.k==='ebene'),chap=[[0,x.chap.start]];
  // Ebenen-Zähler unten (bis zur nächsten Ebene)
  ebs.forEach((e,i)=>{const b=i+1<ebs.length?ebs[i+1].t:dur;if(NAME!=='bosse')D(e.t,b,'Zaehler',`${x.fl} ${e.fl}${NAME==='endlos100'?' / 100':NAME==='story_komplett'?' / 15':''}   {\\c&H8f9eff&}☠ ${e.deaths}`);
    if(e.boss)D(e.t+.3,e.t+3,'Boss',`{\\fs26\\c&Hb5a990&}${x.boss}\\N{\\fs44}${esc(tr(l,e.boss))}`);
    if(NAME==='endlos100'&&e.fl%10===0)D(e.t,e.t+2.4,'Meilenstein',x.mile(e.fl));
    if(NAME==='story_komplett'&&!e.boss&&i>0)D(e.t,e.t+2.2,'Meilenstein',x.mile(e.fl));
    if((NAME==='endlos100'&&(e.fl%10===0||e.fl===1))||NAME==='story_komplett'||(NAME==='bosse'&&e.boss))chap.push([e.t,NAME==='bosse'?tr(l,e.boss):x.chap.fl(e.fl)]);});
  for(const e of ev){
    if(e.k==='waffe'&&e.wt>=4)D(e.t,e.t+3,'Waffe',`{\\c&H${TCOL[e.wt].replace(/(..)(..)(..)/,'$3$2$1')}&}${esc(x.gun(e.wt,tr(l,e.w)))}`);
    if(e.k==='tod')D(e.t,e.t+2.6,'Tod',`${x.dead}${e.n>1?' ×'+e.n:''}\\N{\\fs24\\c&Hf4efe6&}${x.deadS}`);
    if(e.k==='gerettet')D(e.t,e.t+2.6,'Waffe',`{\\c&H66d1ff&}${esc(x.vil(e.n))}`);}
  const T0=x[NAME]||[NAME,''];D(0.2,4.6,'Titel',`${esc(T0[0])}\\N{\\fs30\\c&Hf4efe6&}${esc(T0[1])}`);
  const end=ev.find(e=>e.k==='ende')||{t:dur-3,fl:0,deaths:0};chap.push([Math.min(end.t,dur-4),x.chap.end]);
  D(Math.max(0,Math.min(end.t,dur-4)),dur,'Titel',`${esc(x.done[NAME]?x.done[NAME](end.fl):'')}\\N{\\fs28\\c&Hf4efe6&}${x.deaths}: ${end.deaths}\\N{\\fs30\\c&H8ad9ff&}${x.play}: ${x.url}`);
  const ass=`[Script Info]
ScriptType: v4.00+
PlayResX: 1280
PlayResY: 720
WrapStyle: 0

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Zaehler,Cinzel,30,&H008ad9ff,&H000000FF,&H00000000,&H90000000,-1,0,0,0,100,100,1,0,3,10,0,2,10,10,18,1
Style: Titel,Cinzel,58,&H008ad9ff,&H000000FF,&H00000000,&HA0000000,-1,0,0,0,100,100,1,0,1,4,3,5,40,40,10,1
Style: Meilenstein,Cinzel,76,&H008ad9ff,&H000000FF,&H00000000,&H80000000,-1,0,0,0,100,100,2,0,1,5,4,5,40,40,10,1
Style: Boss,Cinzel,44,&H007a8cff,&H000000FF,&H00000000,&H80000000,-1,0,0,0,100,100,1,0,1,4,3,8,40,40,150,1
Style: Waffe,Cinzel,36,&H008ad9ff,&H000000FF,&H00000000,&H80000000,-1,0,0,0,100,100,1,0,1,4,3,8,40,40,230,1
Style: Tod,Cinzel,60,&H008c7aff,&H000000FF,&H00000000,&H80000000,-1,0,0,0,100,100,2,0,1,5,4,5,40,40,10,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
${L.join('\n')}
`;
  const assF=BASE+'_'+l+'.ass';fs.writeFileSync(assF,ass);
  const out=path.join(path.dirname(BASE),NAME+'_'+l+'.mp4'),fonts=path.join(__dirname,'voice','fonts');
  // Lautheit auf ~-14 LUFS, Bild 720p
  const o=execSync(`ffmpeg -hide_banner -nostats -i ${BASE}_roh.mkv -map 0:a -af ebur128=framelog=quiet -f null - 2>&1`).toString();
  const I=+(/I:\s+(-?[\d.]+) LUFS/.exec(o.split('Summary')[1]||'')||[0,-20])[1],g=Math.max(0,Math.min(20,-14-I)).toFixed(1);
  execSync(`ffmpeg -y -loglevel error -i ${BASE}_roh.mkv -vf "ass=${assF}:fontsdir=${fonts}" -af "afade=t=in:d=0.5,afade=t=out:st=${(dur-2).toFixed(2)}:d=2,volume=${g}dB,alimiter=limit=0.89:level=false" `+
    `-c:v libx264 -preset medium -crf ${process.env.CRF||25} -pix_fmt yuv420p -c:a aac -b:a 160k -movflags +faststart ${out}`);
  // Kapitel (YouTube braucht 0:00 als erstes und mind. 10 s Abstand)
  const ch=[];for(const [t,n] of chap){if(!ch.length||t-ch[ch.length-1][0]>=10)ch.push([t,n]);}
  fs.writeFileSync(path.join(path.dirname(BASE),NAME+'_'+l+'_kapitel.txt'),ch.map(([t,n])=>yt(t)+' '+n).join('\n')+'\n');
  console.log('fertig:',out,(fs.statSync(out).size/1e6).toFixed(1)+' MB');}
