// Drehbücher für die Werbevideos (tools/video/rec.js). Jede Szene: Dauer, Vorbereitung (JS im Spiel), Untertitel [Zeile, Unterzeile].
// Szenen zeigen nur, was es im Spiel wirklich gibt (keine erfundenen Ranglisten-Einträge).
const T={
  de:{free:'Kostenlos im Browser',freeS:'PC, Tablet & Handy – ohne Download',fight:'Kämpfe dich in die Tiefe',fightS:'Über 50 Waffen',
    boss:'Besiege mächtige Bosse',bossS:'Warnkreise, Wutphase, seltene Beute',deep:'Endlos-Modus',deepS:'Wie tief kommst du?',
    rank:'Tages-Rangliste',rankS:'Gleiches Dungeon für alle – auch ohne Konto',play:'Jetzt kostenlos spielen',url:'burgergoat44.itch.io/tiefenrausch',
    title:'Tiefenrausch',titleS:'Ein Dungeon-Abenteuer im Browser',story:'Story: Rette Aldenheim',storyS:'15 Ebenen, Dorfbewohner, Endboss',
    var:'16 Gegner-Varianten',varS:'Jede Ebene wird schwerer',book:'Bestiarium & Erfolge',bookS:'Sammle alles, was dir begegnet',
    end2:'Story · Endlos · Tageslauf · Koop für 2'},
  en:{free:'Free in your browser',freeS:'PC, tablet & phone – no download',fight:'Fight your way down',fightS:'Over 50 weapons',
    boss:'Defeat mighty bosses',bossS:'Warning circles, rage phase, rare loot',deep:'Endless mode',deepS:'How deep can you go?',
    rank:'Daily leaderboard',rankS:'Same dungeon for everyone – no account needed',play:'Play now for free',url:'burgergoat44.itch.io/tiefenrausch',
    title:'Tiefenrausch',titleS:'A dungeon adventure in your browser',story:'Story: save Aldenheim',storyS:'15 floors, villagers, final boss',
    var:'16 enemy variants',varS:'Every floor gets harder',book:'Bestiary & achievements',bookS:'Collect everything you meet',
    end2:'Story · Endless · Daily run · 2-player co-op'}};
const title="st='ready';bk=null;ui=null;CO.lob=null;",
  run=(md,f,w)=>`newGame(undefined,'${md}');${f>1?`fl=${f};gen();`:''}me.mx=Math.max(me.mx,${Math.min(12,4+Math.floor(f/3))});me.hp=me.mx;${w?`me.w=${w};`:''}ui=null;VAP.wig=0;`,
  rank=l=>`st='ready';ui=null;dKey=dayKey();gName='${l==='en'?'You':'Du'}';bk={tab:3,pg:0,lt:0};lb={st:'ok',rows:[],t:Date.now()+9e9,d:dayKey(),rank:0};`;
module.exports={
  shorts:{view:{width:432,height:768},dpr:2.5,file:l=>`youtube_short_${l}.mp4`,scenes:l=>{const t=T[l];return[
    {sec:3,setup:run('endless',3,'{i:10,t:3}')+'VAP.toBoss();',cap:[t.free,t.freeS]},   // Einstieg mit Action (Shorts: erste Sekunden zählen)
    {sec:6,cap:[t.boss,t.bossS],capLen:4},
    {sec:7,setup:run('endless',2,'{i:19,t:4}'),cap:[t.fight,t.fightS],capLen:4},
    {sec:6,setup:run('endless',26,'{i:35,t:7}'),cap:[t.deep,t.deepS],capLen:4},
    {sec:3,setup:rank(l),cap:[t.rank,t.rankS],cy:.09},
    {sec:4,setup:title,cap:[t.play,t.url],cy:.84}];}},
  probe:{view:{width:432,height:768},dpr:2.5,file:l=>`probe_${l}.mp4`,scenes:l=>{const t=T[l];return[
    {sec:1.5,setup:title,cap:[t.free,t.freeS],cy:.84},{sec:3,setup:run('endless',3,'{i:21,t:6}'),cap:[t.boss,t.bossS]},{sec:1.5,setup:rank(l),cap:[t.rank,t.rankS],cy:.09}];}},
  lang:{view:{width:960,height:540},dpr:2,hash:'#lade',file:l=>`youtube_trailer_${l}.mp4`,scenes:l=>{const t=T[l];return[
    {sec:7,cap:[t.title,t.titleS]},                                   // Ladebildschirm mit Story-Szene
    {sec:5,setup:title,cap:[t.free,t.freeS]},
    {sec:14,setup:run('story',1),cap:[t.story,t.storyS],capLen:6},
    {sec:18,setup:"me.w={i:19,t:4};",cap:[t.fight,t.fightS],capLen:5},
    {sec:20,setup:run('story',3,'{i:10,t:3}')+'VAP.toBoss();',cap:[t.boss,t.bossS],capLen:6},
    {sec:14,setup:run('endless',12,'{i:24,t:6}'),cap:[t.var,t.varS],capLen:5},
    {sec:14,setup:run('endless',30,'{i:35,t:7}'),cap:[t.deep,t.deepS],capLen:5},
    {sec:6,setup:"st='ready';ui=null;bk={tab:0,pg:0};",cap:[t.book,t.bookS]},
    {sec:6,setup:rank(l),cap:[t.rank,t.rankS]},
    {sec:8,setup:title,cap:[t.play,t.url]}];}}};
// Hinweis: Rangliste/Name-Knopf gibt es nur online (LB_ON) → rec.js lädt das Spiel unter der GitHub-Adresse (ohne Netz).
