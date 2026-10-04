// Drehbücher für die Werbevideos (tools/video/rec.js).
// Szene: sec = Mindestdauer (wird bei Sprechertext verlängert), setup = JS im Spiel, cap = [Zeile, Unterzeile], cy = Höhe der Schrift (0–1),
// vo = Sprechertext (KI-Stimme), zoom = langsames Heranfahren bis Faktor, hook = große Aufhänger-Schrift, flash:false = kein Übergangsblitz.
// Szenen zeigen nur, was es im Spiel wirklich gibt (keine erfundenen Ranglisten-Einträge).
const T={
  de:{free:'Kostenlos im Browser',freeS:'PC, Tablet & Handy – ohne Download',fight:'Über 50 Waffen',fightS:'Von Gewöhnlich bis Kosmisch',
    boss:'Mächtige Bosse',bossS:'Warnkreise, Wutphase, seltene Beute',deep:'Endlos-Modus',deepS:'Jede Ebene wird schwerer',
    rank:'Tages-Rangliste',rankS:'Gleiches Dungeon für alle – auch ohne Konto',play:'Jetzt kostenlos spielen',url:'Link in der Beschreibung ↓',
    hook:'Wie tief kommst du?',title:'Tiefenrausch',titleS:'Ein Dungeon-Abenteuer im Browser',story:'Story-Modus',storyS:'15 Ebenen, Dorfbewohner, Endboss',
    var:'16 Gegner-Varianten',varS:'Immer neue Gegner',book:'Bestiarium & Erfolge',bookS:'Sammle alles, was dir begegnet',
    vo:{s1:'Wie tief kommst du in diesem Dungeon?',s2:'Besiege riesige Bosse – mit Wutphase und seltener Beute!',
      s3:'Über fünfzig Waffen, von gewöhnlich bis kosmisch.',s4:'Im Endlos-Modus wird jede Ebene härter.',
      s5:'Jeden Tag ein neues Dungeon, für alle gleich. Schaffst du Platz eins?',s6:'Kostenlos im Browser, ohne Download. Der Link ist in der Beschreibung!',
      t1:'Der Schattenfürst Vorath hat das Kristallherz gestohlen.',t2:'Du bist der letzte Wächter von Aldenheim. Steig hinab in die Tiefe!',
      t3:'Im Story-Modus kämpfst du dich durch fünfzehn Ebenen und rettest die Dorfbewohner.',
      t4:'Über fünfzig Waffen: Schwerter, Bögen und Zauberstäbe, von gewöhnlich bis kosmisch.',
      t5:'Jede dritte Ebene wartet ein Boss. Weich den Warnkreisen aus, sonst wird es eng!',
      t6:'Im Endlos-Modus tauchen immer neue Gegner-Varianten auf.',t7:'Und je tiefer du kommst, desto härter wird es. Wie weit schaffst du es?',
      t8:'Im Bestiarium sammelst du jeden Gegner und jeden Erfolg.',t9:'Beim Tageslauf spielen alle dasselbe Dungeon. Die Rangliste geht sogar ohne Konto.',
      t10:'Tiefenrausch. Kostenlos im Browser, allein oder zu zweit im Koop. Den Link findest du in der Beschreibung!'}},
  en:{free:'Free in your browser',freeS:'PC, tablet & phone – no download',fight:'Over 50 weapons',fightS:'From Common to Cosmic',
    boss:'Mighty bosses',bossS:'Warning circles, rage phase, rare loot',deep:'Endless mode',deepS:'Every floor gets harder',
    rank:'Daily leaderboard',rankS:'Same dungeon for everyone – no account needed',play:'Play now for free',url:'Link in the description ↓',
    hook:'How deep can you go?',title:'Tiefenrausch',titleS:'A dungeon adventure in your browser',story:'Story mode',storyS:'15 floors, villagers, final boss',
    var:'16 enemy variants',varS:'Always new enemies',book:'Bestiary & achievements',bookS:'Collect everything you meet',
    vo:{s1:'How deep can you go in this dungeon?',s2:'Defeat giant bosses, with rage phases and rare loot!',
      s3:'Over fifty weapons, from common to cosmic.',s4:'In endless mode, every floor gets harder.',
      s5:'A new dungeon every day, the same for everyone. Can you take first place?',s6:'Free in your browser, no download. The link is in the description!',
      t1:'The Shadow Lord Vorath has stolen the Crystal Heart.',t2:'You are the last Guardian of Aldenheim. Descend into the depths!',
      t3:'In story mode, you fight through fifteen floors and rescue the villagers.',
      t4:'Over fifty weapons: swords, bows and staffs, from common to cosmic.',
      t5:'Every third floor, a boss is waiting. Dodge the warning circles, or things get tight!',
      t6:'In endless mode, new enemy variants keep showing up.',t7:'And the deeper you go, the harder it gets. How far can you make it?',
      t8:'In the bestiary, you collect every enemy and every achievement.',t9:'In the daily run, everyone plays the same dungeon. The leaderboard even works without an account.',
      t10:'Tiefenrausch. Free in your browser, solo or with a friend in co-op. You will find the link in the description!'}}};
const title="st='ready';bk=null;ui=null;CO.lob=null;",
  run=(md,f,w)=>`newGame(undefined,'${md}');${f>1?`fl=${f};gen();`:''}me.mx=Math.max(me.mx,${Math.min(12,4+Math.floor(f/3))});me.hp=me.mx;${w?`me.w=${w};`:''}ui=null;VAP.wig=0;`,
  rank=l=>`st='ready';ui=null;dKey=dayKey();gName='${l==='en'?'You':'Du'}';bk={tab:3,pg:0,lt:0};lb={st:'ok',rows:[],t:Date.now()+9e9,d:dayKey(),rank:0};`;
// Clip „Kosmische Waffe“: schwächstes Schwert gegen Boss → Boss-Truhe → kosmische Waffe in Zeitlupe → Ebene abräumen.
// Der Fund ist inszeniert (Waffe Sternenschmiede, Stufe Kosmisch, wird beim Fallen eingesetzt) – die Waffe gibt es im Spiel wirklich.
const CL={de:{a:'Boss mit dem schwächsten Schwert?',b:'Die Boss-Truhe …',c:'KOSMISCH?!',d:'Jetzt wird’s lustig',e:'Wie tief kommst du?',f:'Link in der Beschreibung ↓',
    va:'Ein Boss, aber ich habe nur das schwächste Schwert im Spiel.',vb:'Mal sehen, was in der Boss-Truhe ist …',vd:'Okay. Jetzt wird es lustig.',ve:'Wie tief kommst du? Der Link ist in der Beschreibung!'},
  en:{a:'Boss fight with the weakest sword?',b:'The boss chest …',c:'COSMIC?!',d:'Now it gets fun',e:'How deep can you go?',f:'Link in the description ↓',
    va:'A boss fight, and all I have is the weakest sword in the game.',vb:"Let's see what's in the boss chest …",vd:'Okay. Now this gets fun.',ve:'How deep can you go? The link is in the description!'}};
const NOI="it=it.filter(i=>i.t!=='armor'&&i.t!=='weapon');";   // keine Ausrüstungs-Hinweise im Bild
const RIG=`window.__sf=(window.__sf||0)+1;const b=en.find(e=>e.boss);if(b&&window.__sf>25)b.hp=0;
  for(const i of it)if(i.t==='weapon'&&!i._v&&!window.__rig){i._v=1;window.__rig=1;i.w=mkW(48,7);window.__slow=.3;window.__sl=40;window.__rt=0;
    CAP={a:CAP_C,b:'',len:2.2,y:.15,hook:1};}
  if(window.__sl>0&&--window.__sl===0)window.__slow=1;if(window.__rig)window.__rt=(window.__rt||0)+1;const nw=nearW();if(nw&&nw.w&&nw.w.i===48&&window.__rt>50){swapW(nw);window.__slow=1;}
  if(window.__rig)it=it.filter(i=>i.t!=='armor'&&!(i.t==='weapon'&&!(i.w&&i.w.i===48)));`;
// ===== Weitere Shorts (ehrlicher Autopilot VAP.god=0, aber mit vorgegebener Ausrüstung für die Szene) =====
const H="VAP.god=0;me.mx=12;me.hp=12;me.pots.heal=9;me.pots.rage=3;me.arm=[{s:0,t:5},{s:1,t:5},{s:2,t:5}];";
const TNL={de:['Gewöhnlich','Ungewöhnlich','Selten','Episch','Legendär','Mythisch','Göttlich','Kosmisch'],en:['Common','Uncommon','Rare','Epic','Legendary','Mythic','Divine','Cosmic']},
  TCOL=['#cfd3e6','#7be495','#5cb8ff','#c77dff','#ffb347','#ff5df0','#fff3b0','#7cf5ff'];
const near1="{const c=ch.find(c=>!c.o);if(c){const q=freeNear(c.x-70,c.y,12);me.x=q.x;me.y=q.y;}}en=[];";
const S={de:{end:'Wie tief kommst du?',url:'Link in der Beschreibung ↓',
    e1:'Ebene 1',e1b:'Ein paar Schleime, ein rostiges Schwert',e100:'Ebene 100',e100b:'Totales Chaos',
    sel:'Von Gewöhnlich bis Kosmisch',
    aus:'Weich den Warnkreisen aus!',aus2:'Lavatitan: Meteorhagel',aus3:'Jetzt wird er wütend',
    tr:'Was ist in den Truhen?',tr2:'Noch eine …',tr3:'Und jetzt die Boss-Truhe!',
    ta:'Tageslauf',taS:'Gleiches Dungeon für alle',ta2:'Jeden Tag neu – mit Rangliste',ta3:'Auch ohne Konto',
    ch:'Endlos-Modus ab Ebene 60',ch2:'Ebene 70',ch3:'Ebene 80',ch4:'Ebene 90'},
  en:{end:'How deep can you go?',url:'Link in the description ↓',
    e1:'Floor 1',e1b:'A few slimes, a rusty sword',e100:'Floor 100',e100b:'Total chaos',
    sel:'From Common to Cosmic',
    aus:'Dodge the warning circles!',aus2:'Lava Titan: meteor storm',aus3:'Now he gets angry',
    tr:"What's in the chests?",tr2:'Another one …',tr3:'And now the boss chest!',
    ta:'Daily run',taS:'Same dungeon for everyone',ta2:'New every day – with a leaderboard',ta3:'No account needed',
    ch:'Endless mode, floor 60 and up',ch2:'Floor 70',ch3:'Floor 80',ch4:'Floor 90',
    v:{e1:'Floor one. A few slimes and a rusty sword.',e2:'Easy, right?',e100:'Floor one hundred.',e100b:'Total chaos.',end:'How deep can you go? The link is in the description!',
      sel:'Every weapon comes in eight rarities.',aus:'Dodge the warning circles!',aus2:'The Lava Titan rains meteors.',aus3:'And now he gets angry.',
      tr:"What's in the chests?",tr2:'Another one.',tr3:'And now, the boss chest!',
      ta:'The daily run. The same dungeon for everyone.',ta2:'A new one every day, with a leaderboard.',ta3:'No account needed.',
      ch:'Endless mode, floor sixty and up.',ch2:'Floor seventy.',ch3:'Floor eighty.',ch4:'Floor ninety.'}}};
S.de.v={};   // Deutsch ohne Stimme (Texte im Bild)
const sv=(l,k)=>l==='en'?S.en.v[k]:'';
const SH={
  short_ebene1_vs_100:l=>{const x=S[l];return[
    {sec:3.2,setup:run('endless',1,'{i:0,t:0}')+'VAP.god=0;',cap:[x.e1],hook:1,vo:sv(l,'e1'),zoom:1.2},
    {sec:2.5,cap:[x.e1b],vo:sv(l,'e2'),flash:false,zoom:1.25},
    {sec:3.5,setup:run('endless',100,'mkW(49,7)')+H,cap:[x.e100],hook:1,vo:sv(l,'e100'),zoom:1.15},
    {sec:4.5,cap:[x.e100b],vo:sv(l,'e100b'),flash:false,zoom:1.3},
    {sec:3.5,cap:[x.end,x.url],vo:sv(l,'end'),flash:false,zoom:1.2}];},
  short_seltenheiten:l=>{const x=S[l],L=TNL[l];const a=[{sec:2.4,setup:run('endless',8,'{i:19,t:0}')+H,cap:[x.sel],hook:1,vo:sv(l,'sel'),zoom:1.15}];
    for(let t=0;t<8;t++)a.push({sec:t===7?3.2:2.1,setup:`me.w=mkW(19,${t});burst(me.x,me.y,TC[${t}],${20+t*6},${160+t*20});shake=${t*1.5};`,cap:[L[t]],capCol:TCOL[t],hook:t===7?1:0,vo:l==='en'?L[t]+(t===7?'!':'.'):'',zoom:1.2+t*.03,flash:t===7});
    a.push({sec:3.2,cap:[x.end,x.url],vo:sv(l,'end'),flash:false,zoom:1.3});return a;},
  short_ausweichen:l=>{const x=S[l];return[
    {sec:4,setup:run('endless',33,'{i:24,t:3}')+H+'VAP.toBoss();{const b=en.find(e=>e.boss);if(b){b.mx*=3;b.hp=b.mx;}}',cap:[x.aus],hook:1,vo:sv(l,'aus'),zoom:1.15},
    {sec:5,cap:[x.aus2],vo:sv(l,'aus2'),flash:false,zoom:1.2},
    {sec:5,setup:"{const b=en.find(e=>e.boss);if(b)b.hp=Math.min(b.hp,Math.round(b.mx*.49));}",cap:[x.aus3],vo:sv(l,'aus3'),flash:false,zoom:1.3},
    {sec:3.5,cap:[x.end,x.url],vo:sv(l,'end'),flash:false,zoom:1.2}];},
  short_truhen:l=>{const x=S[l];return[
    {sec:3,setup:run('endless',20,'{i:24,t:4}')+H+near1,cap:[x.tr],hook:1,vo:sv(l,'tr'),zoom:1.3},
    {sec:2.6,setup:near1,cap:[x.tr2],vo:sv(l,'tr2'),zoom:1.3},
    {sec:2.6,setup:near1,cap:[x.tr2],vo:sv(l,'tr2'),zoom:1.3},
    {sec:6,setup:run('endless',45,'{i:24,t:5}')+H+"VAP.toBoss();{const b=en.find(e=>e.boss);if(b)b.hp=1;}en=en.filter(e=>e.boss);",cap:[x.tr3],hook:1,vo:sv(l,'tr3'),zoom:1.3},
    {sec:3.5,cap:[x.end,x.url],vo:sv(l,'end'),flash:false,zoom:1.2}];},
  short_tageslauf:l=>{const x=S[l];return[
    {sec:3.2,setup:rank(l),cap:[x.ta,x.taS],cy:.09,vo:sv(l,'ta')},
    {sec:5,setup:"meta.dplay=null;newGame(undefined,'daily');VAP.god=0;ui=null;",cap:[x.ta2],vo:sv(l,'ta2'),zoom:1.15},
    {sec:4,cap:[x.ta3],vo:sv(l,'ta3'),flash:false,zoom:1.25},
    {sec:3.5,cap:[x.end,x.url],vo:sv(l,'end'),flash:false,zoom:1.2}];},
  short_endlos_chaos:l=>{const x=S[l];return[
    {sec:3.6,setup:run('endless',60,'{i:35,t:6}')+H,cap:[x.ch],hook:1,vo:sv(l,'ch'),zoom:1.15},
    {sec:3,setup:run('endless',70,'{i:35,t:6}')+H,cap:[x.ch2],vo:sv(l,'ch2'),zoom:1.2},
    {sec:3,setup:run('endless',80,'mkW(50,7)')+H,cap:[x.ch3],vo:sv(l,'ch3'),zoom:1.2},
    {sec:3.5,setup:run('endless',90,'mkW(50,7)')+H,cap:[x.ch4],vo:sv(l,'ch4'),zoom:1.25},
    {sec:3.5,cap:[x.end,x.url],vo:sv(l,'end'),flash:false,zoom:1.2}];}};

// ===== Trauriger Edit: 1-Sekunden-Schnitte auf den Takt (eigene Musik, 60 BPM), erster/letzter Clip länger mit Ein-/Ausblenden =====
const ED={de:{a:'Er war der letzte Wächter …',z:'… und er gab niemals auf.'},en:{a:'He was the last guardian …',z:'… and he never gave up.'}};
const boss=(f,m,w)=>run(m||'endless',f,w||'{i:10,t:3}')+'VAP.toBoss();',
  story=n=>`ui={type:'story',t:STORY[${n}][0],l:STORY[${n}].slice(1)};`,
  die="VAP.god=0;me.inv=0;me.hp=1;hurt(9);",
  low="VAP.god=0;me.hp=1;me.inv=0;";
const EDIT=(l,K)=>{const e=ED[l],cs=K?.5:1;const c=(setup,o)=>Object.assign({sec:cs,setup,pre:40,zoom:1.15,flash:false},o||{});const A=[
  {sec:K?2.5:3,setup:run('story',1)+'VAP.god=1;',pre:50,slow:.5,zoom:1.3,cap:[e.a],cy:.16,flash:false},
  c(boss(3,'story')),
  c(run('story',6),{pre:25,after:story(6),zoom:1.05}),
  c(boss(6),{zoom:1.3}),
  c(boss(20,'endless','{i:10,t:4}'),{after:low,zoom:1.35}),
  c(boss(9)),
  c(run('endless',70,'{i:35,t:6}'),{pre:60,zoom:1.1}),
  c(boss(33,'endless','{i:10,t:4}'),{pre:50,after:'dash();',slow:.6}),
  c(boss(12),{pre:45,after:die,zoom:1.05}),
  c(boss(30,'endless','{i:10,t:4}'),{pre:50,zoom:1.3}),
  c(run('story',12),{pre:25,after:story(12),zoom:1.05}),
  c(boss(36,'endless','{i:10,t:4}'),{pre:60}),
  c(run('story',4),{pre:20,after:"it=[];{const n=npcs.find(n=>n.t==='d');if(n){const q=freeNear(n.x-40,n.y,12);me.x=q.x;me.y=q.y;interact();}}",zoom:1.3}),
  c(boss(15),{pre:30,after:"{const b=en.find(e=>e.boss);if(b)b.hp=1;}",zoom:1.25}),
  c(boss(39,'endless','{i:10,t:4}'),{pre:50}),
  c(boss(27,'endless','{i:10,t:4}'),{pre:45,after:die,zoom:1.05}),
  c(boss(15,'story','{i:10,t:4}'),{pre:50,zoom:1.3}),
  c(boss(15,'story','{i:10,t:4}')+"{const b=en.find(e=>e.boss);if(b)b.hp=Math.round(b.mx*.45);}",{pre:55,zoom:1.2}),
  c(boss(15,'story','{i:10,t:4}'),{pre:50,after:low,slow:.5,zoom:1.4}),
  ...(K?[c(run('endless',90,'mkW(50,7)')+H,{pre:60,zoom:1.2}),c(boss(24,'endless','{i:10,t:4}'),{pre:50,zoom:1.3})]:[]),
  {sec:K?3.5:4.5,setup:"newGame(undefined,'story');me.rv=[0,1,2,3,4,5,6,7,8];st='end';",pre:10,zoom:1.15,cap:[e.z],cy:.8,flash:false}];return A;};
module.exports={
  shorts:{view:{width:432,height:768},dpr:2.5,file:l=>`youtube_short_${l}.mp4`,scenes:l=>{const t=T[l],v=t.vo;return[
    {sec:2.4,setup:run('endless',3,'{i:10,t:3}')+'VAP.toBoss();',cap:[t.hook],hook:1,vo:v.s1,zoom:1.18},     // Aufhänger mit Action
    {sec:3,cap:[t.boss,t.bossS],vo:v.s2,zoom:1.3,flash:false},
    {sec:3,setup:run('endless',2,'{i:19,t:4}'),cap:[t.fight,t.fightS],vo:v.s3,zoom:1.15},
    {sec:3,setup:run('endless',26,'{i:35,t:7}'),cap:[t.deep,t.deepS],vo:v.s4,zoom:1.2},
    {sec:3,setup:rank(l),cap:[t.rank,t.rankS],cy:.09,vo:v.s5},
    {sec:3.5,setup:title,cap:[t.play,t.url],cy:.84,vo:v.s6}];}},
  clip_kosmisch:{view:{width:432,height:768},dpr:2.5,file:l=>`clip_kosmische_waffe_${l}.mp4`,scenes:l=>{const c=CL[l];return[
    {sec:3,setup:run('endless',21,'{i:0,t:0}')+"VAP.toBoss();en=en.filter(e=>e.boss);{const b=en.find(e=>e.boss);if(b){b.hp=b.mx=Math.round(b.mx*.3);}}window.__rig=0;window.__sf=0;window.__slow=1;",
      cap:[c.a],hook:1,vo:c.va,zoom:1.3},
    {sec:5,setup:`window.CAP_C=${JSON.stringify(c.c)};window.__sf=0;en=en.filter(e=>e.boss);`,each:RIG,cap:[c.b],vo:c.vb,zoom:1.35,flash:false},
    {sec:6,setup:"window.__slow=1;window.__W=me.w;"+run('endless',22,'__W'),each:NOI,cap:[c.d],vo:c.vd,zoom:1.15},
    {sec:3.5,each:NOI,cap:[c.e,c.f],vo:c.ve,flash:false,zoom:1.2}];}},
  probe:{view:{width:432,height:768},dpr:2.5,file:l=>`probe_${l}.mp4`,scenes:l=>{const t=T[l],v=t.vo;return[
    {sec:2,setup:run('endless',3,'{i:10,t:3}')+'VAP.toBoss();',cap:[t.hook],hook:1,vo:v.s1,zoom:1.2},{sec:1.5,setup:title,cap:[t.play,t.url],cy:.84}];}},
  lang:{view:{width:960,height:540},dpr:2,hash:'#lade',file:l=>`youtube_trailer_${l}.mp4`,scenes:l=>{const t=T[l],v=t.vo;return[
    {sec:7,cap:[t.title,t.titleS],vo:v.t1,flash:false},                    // Ladebildschirm mit Story-Szene
    {sec:6,setup:title,cap:[t.free,t.freeS],vo:v.t2},
    {sec:12,setup:run('story',1),cap:[t.story,t.storyS],vo:v.t3,zoom:1.12},
    {sec:12,setup:"me.w={i:19,t:4};",cap:[t.fight,t.fightS],vo:v.t4,zoom:1.15,flash:false},
    {sec:16,setup:run('story',3,'{i:10,t:3}')+'VAP.toBoss();',cap:[t.boss,t.bossS],vo:v.t5,zoom:1.25},
    {sec:11,setup:run('endless',12,'{i:24,t:6}'),cap:[t.var,t.varS],vo:v.t6,zoom:1.15},
    {sec:12,setup:run('endless',30,'{i:35,t:7}'),cap:[t.deep,t.deepS],vo:v.t7,zoom:1.2},
    {sec:6,setup:"st='ready';ui=null;bk={tab:0,pg:0};",cap:[t.book,t.bookS],vo:v.t8},
    {sec:8,setup:rank(l),cap:[t.rank,t.rankS],vo:v.t9},
    {sec:9,setup:title,cap:[t.play,t.url],vo:v.t10}];}}};
// Hinweis: Rangliste/Name-Knopf gibt es nur online (LB_ON) → rec.js lädt das Spiel unter der GitHub-Adresse (ohne Netz).
for(const k in SH)module.exports[k]={view:{width:432,height:768},dpr:2.5,file:l=>`${k}_${l}.mp4`,scenes:SH[k]};
module.exports.edit_traurig={view:{width:432,height:768},dpr:2.5,file:l=>`edit_traurig_${l}.mp4`,music:1,fade:1,
  vf:'eq=saturation=0.7:contrast=1.06:brightness=-0.02,colorbalance=bs=0.07:bm=0.04:rs=-0.02,vignette=PI/4.2',scenes:EDIT};
module.exports.edit_traurig_kurz=Object.assign({},module.exports.edit_traurig,{file:l=>`edit_traurig_16s_${l}.mp4`,scenes:l=>EDIT(l,1)});
// ===== Phonk-Edits (sprachneutral, 120 BPM, Takt-Effekte: Zoom-Schlag, Wackeln, Farbverschiebung, Blitz, Glitch) =====
const BOSSES=[[3],[6],[9],[12],[15],[18],[21],[24],[27],[30],[33],[36],[39],[15,'story']];
const bs=(f,m,w)=>boss(f,m||'endless',w||'{i:10,t:4}')+H;
const END={sec:2,setup:"st='ready';bk=null;ui=null;CO.lob=null;",zoom:1.1};
const PH={
  edit_phonk_bosse:()=>{const a=[{sec:2,setup:bs(15,'story'),pre:40,ramp:[.3,.3],zoom:1.35}];
    for(let k=0;k<24;k++){const [f,m]=BOSSES[k%BOSSES.length];a.push({sec:.5,setup:bs(f,m)+(k%5===4?"{const b=en.find(e=>e.boss);if(b)b.hp=1;}":''),pre:35+(k*7)%30,zoom:1.15+(k%3)*.08,flash:false});}
    a.push(END);return a;},
  edit_phonk_speedramp:()=>{const a=[{sec:2,setup:run('endless',60,'{i:35,t:6}')+H,pre:50,ramp:[.25,.25],zoom:1.3}];
    const S=[()=>bs(33),()=>run('endless',70,'mkW(50,7)')+H,()=>bs(30),()=>run('endless',85,'mkW(49,7)')+H,()=>bs(15,'story'),()=>bs(36),()=>run('endless',95,'mkW(48,7)')+H,()=>bs(24),()=>bs(39),()=>run('endless',100,'mkW(50,7)')+H,()=>bs(27),()=>bs(21)];
    S.forEach((f,k)=>a.push({sec:1,setup:f(),pre:45,ramp:[.2,1.8],zoom:1.25,flash:false}));a.push(END);return a;},
  edit_phonk_glowup:()=>{const a=[{sec:2,setup:run('endless',1,'{i:0,t:0}')+'VAP.god=1;',pre:40,ramp:[.4,.4],zoom:1.3,cap:['1'],hook:1}];
    const F=[2,4,6,8,10,13,16,20,25,30,35,40,45,50,55,60,66,72,78,84,90,95,98,100];
    F.forEach((f,k)=>{const t=Math.min(7,Math.floor(f/14)),w=t>=7?'mkW(50,7)':`{i:${[0,10,19,24,35][Math.min(4,Math.floor(f/25))]},t:${t}}`;
      a.push({sec:.5,setup:run('endless',f,w)+(f>20?H:'VAP.god=1;'),pre:40,zoom:1.2,flash:false,cap:[String(f)],hook:1,capLen:.5});});
    a.push(END);return a;}};
for(const k in PH){module.exports[k]={view:{width:432,height:768},dpr:2.5,file:()=>`${k}.mp4`,music:'phonk',bpm:120,beatfx:1,fade:.3,
  vf:'eq=contrast=1.05:saturation=1.2,vignette=PI/5',scenes:PH[k]};
  module.exports[k+'_ohne_musik']=Object.assign({},module.exports[k],{file:()=>`${k}_ohne_musik.mp4`,music:'keine'});}
// ===== Halloween-Clips (Update 11): Event-Menü, Skins, Pass, Halloween-Dungeon, Glücksrad – alles echt im Spiel =====
const HW={de:{a:'HALLOWEEN 🎃',b:'Neue Skins',c:'Halloween-Dungeon',d:'Event-Pass',d2:'Am Ende: exklusiver Skin',e:'Glücksrad – 1× am Tag gratis',end:'Kostenlos im Browser',url:'Link in der Bio ↓',
    k1:'Kürbiskopf gegen den Boss?',k2:'Bonbons sammeln 🍬',k3:'Stufe 10 …',k4:'GEISTERWÄCHTER?!',k5:'Nur im Halloween-Pass',w1:'Gratis-Dreh am Glücksrad',w2:'Was gibt es heute?'},
  en:{a:'HALLOWEEN UPDATE 🎃',b:'New skins',c:'Halloween dungeon',d:'Event pass',d2:'Final tier: exclusive skin',e:'Lucky wheel – 1 free spin a day',end:'Free in your browser',url:'Link in bio ↓',
    k1:'Pumpkin head vs boss?',k2:'Collect candy 🍬',k3:'Tier 10 …',k4:'GHOST GUARDIAN?!',k5:'Only in the Halloween pass',w1:'Free lucky wheel spin',w2:'What do I get today?'}};
const HWM="u11Fix();meta.tk={e:2400,s:0};",HWD=(f,a,w)=>`${HWM}meta.sk={a:${a},w:${w}};meta.own.a.push(${a});meta.own.w.push(${w});`+run('hw',f,'{i:10,t:4}')+H;
const HWC={
  clip_halloween_update:l=>{const x=HW[l];return[
    {sec:3,setup:title+HWM,cap:[x.a],hook:1,zoom:1.15},
    {sec:3.2,setup:HWM+"shopOpen(0);shp.pg=1;shp.sel=8;",cap:[x.b],zoom:1.12},
    {sec:4,setup:HWD(3,8,7)+'VAP.toBoss();',cap:[x.c],zoom:1.25},
    {sec:3.2,setup:"st='ready';ui=null;"+HWM+"meta.hw.xp=640;shopOpen(4);",cap:[x.d,x.d2],cy:.86,zoom:1.08},
    {sec:4.2,setup:HWM+"meta.wh={d:'',n:0};shopOpen(2);window.__ws=0;",each:"if(++window.__ws===20)whSpin();",cap:[x.e],cy:.86,zoom:1.06},
    {sec:3,setup:title,cap:[x.end,x.url],cy:.84,flash:false,zoom:1.1}];},
  clip_halloween_geist:l=>{const x=HW[l];return[
    {sec:3.6,setup:HWD(6,8,7)+"VAP.toBoss();",cap:[x.k1],hook:1,zoom:1.3},
    {sec:3.4,cap:[x.k2],flash:false,zoom:1.35},
    {sec:2.6,setup:"st='ready';ui=null;"+HWM+"meta.hw.xp=880;meta.hw.cl=[0,1,2,3,4,5,6,7];meta.own.a=meta.own.a.filter(a=>a!==10);shopOpen(4);window.__ws=0;",each:"if(++window.__ws===25)hwXp(150,1);",cap:[x.k3],zoom:1.12},
    {sec:4.5,setup:HWD(9,10,9)+"VAP.toBoss();burst(me.x,me.y,'#bfffe8',40,220);shake=6;",cap:[x.k4],hook:1,capCol:'#ff5df0',zoom:1.3},
    {sec:3,cap:[x.k5,x.url],flash:false,zoom:1.35}];},
  clip_halloween_rad:l=>{const x=HW[l];return[
    {sec:2.6,setup:title+HWM,cap:[x.w1],hook:1,zoom:1.12},
    {sec:5.2,setup:HWM+"meta.wh={d:'',n:0};shopOpen(2);window.__ws=0;",each:"if(++window.__ws===15)whSpin();",cap:[x.w2],cy:.86,zoom:1.08},
    {sec:3.6,setup:HWD(4,3,5),cap:[x.c],zoom:1.25},
    {sec:3,setup:title,cap:[x.end,x.url],cy:.84,flash:false,zoom:1.1}];}};
for(const k in HWC)module.exports[k]={view:{width:432,height:768},dpr:2.5,file:l=>`${k}_${l}.mp4`,scenes:HWC[k]};
