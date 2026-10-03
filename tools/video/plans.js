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
