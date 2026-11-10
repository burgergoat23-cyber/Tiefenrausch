// Deutsche Wörter -> Minecraft-Namen (Blöcke, Gegenstände, Tiere/Monster).
// Alle Schlüssel sind klein geschrieben und ohne Umlaute (ä=ae, ö=oe, ü=ue, ß=ss),
// der Bot wandelt den Chat-Text vorher genauso um.

function norm (s) {
  return String(s).toLowerCase()
    .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
    .replace(/[^a-z0-9_ ]/g, ' ').replace(/\s+/g, ' ').trim()
}

// b = Blöcke (zum Abbauen), i = Gegenstände (im Inventar). Fehlt eins, gilt das andere für beides.
// Einträge: genauer Name oder regulärer Ausdruck.
const erz = (n) => new RegExp('^(deepslate_)?' + n + '_ore$')
const W = {}
function def (woerter, b, i) {
  for (const w of woerter.split(',')) W[w.trim()] = { b: b || i, i: i || b }
}

def('holz,stamm,staemme,baumstamm,baumstaemme,baum,baeume', [/_(log|stem)$/])
def('bretter,brett,planken,holzbretter', [/_planks$/])
def('stein,steine', ['stone'], ['cobblestone', 'stone'])
def('bruchstein,pflasterstein', ['cobblestone'])
def('tiefenschiefer', ['deepslate'], ['cobbled_deepslate', 'deepslate'])
def('erde,dreck', ['dirt', 'grass_block'], ['dirt'])
def('gras,grasblock', ['grass_block'], ['grass_block', 'dirt'])
def('sand', ['sand', 'red_sand'])
def('kies', ['gravel'])
def('ton,lehm', ['clay'], ['clay_ball', 'clay'])
def('sandstein', ['sandstone'])
def('kohle,kohleerz', [erz('coal')], ['coal'])
def('eisen,eisenerz', [erz('iron')], ['raw_iron', 'iron_ingot'])
def('kupfer,kupfererz', [erz('copper')], ['raw_copper', 'copper_ingot'])
def('gold,golderz', [erz('gold'), 'nether_gold_ore'], ['raw_gold', 'gold_ingot'])
def('diamant,diamanten,diamanterz,dias', [erz('diamond')], ['diamond'])
def('smaragd,smaragde,smaragderz', [erz('emerald')], ['emerald'])
def('redstone,redstoneerz', [erz('redstone')], ['redstone'])
def('lapis,lapislazuli', [erz('lapis')], ['lapis_lazuli'])
def('quarz', ['nether_quartz_ore'], ['quartz'])
def('obsidian', ['obsidian'])
def('netherrack', ['netherrack'])
def('leuchtstein,glowstone', ['glowstone'], ['glowstone_dust', 'glowstone'])
def('blaetter,laub', [/_leaves$/])
def('wolle', [/_wool$/])
def('glas', ['glass'])
def('schnee', ['snow_block', 'snow'], ['snowball', 'snow_block'])
def('eis', ['ice', 'packed_ice'])
def('kuerbis,kuerbisse', ['pumpkin'])
def('melone,melonen', ['melon'], ['melon_slice', 'melon'])
def('zuckerrohr', ['sugar_cane'])
def('kaktus,kakteen', ['cactus'])
def('bambus', ['bamboo'])
def('fackel,fackeln', ['torch', 'wall_torch'], ['torch'])
def('werkbank', ['crafting_table'])
def('ofen', ['furnace'])
def('truhe,kiste', ['chest'])
def('bett', [/_bed$/])
def('leiter,leitern', ['ladder'])
def('tuer', [/_door$/])
def('setzling,setzlinge', [/_sapling$/])
def('stock,stoecke,stab,staebe', null, ['stick'])
def('eimer', null, ['bucket'])
def('wassereimer', null, ['water_bucket'])
def('bogen', null, ['bow'])
def('pfeil,pfeile', null, ['arrow'])
def('schild', null, ['shield'])
def('angel', null, ['fishing_rod'])
def('feuerzeug', null, ['flint_and_steel'])
def('feuerstein', null, ['flint'])
def('knochen', null, ['bone'])
def('faden,faeden', null, ['string'])
def('leder', null, ['leather'])
def('feder,federn', null, ['feather'])
def('schwarzpulver', null, ['gunpowder'])
def('eisenbarren', null, ['iron_ingot'])
def('goldbarren', null, ['gold_ingot'])
def('brot', null, ['bread'])
def('apfel,aepfel', null, ['apple'])
def('weizen', ['wheat'], ['wheat'])
def('samen', null, ['wheat_seeds'])
def('karotte,karotten,moehre,moehren', ['carrots'], ['carrot'])
def('kartoffel,kartoffeln', ['potatoes'], ['potato', 'baked_potato'])
def('fleisch', null, [/^(cooked_)?(beef|porkchop|chicken|mutton|rabbit)$/])
def('steak', null, ['cooked_beef'])
def('fisch,fische', null, [/^(cooked_)?(cod|salmon)$/])
def('essen,nahrung,futter', null, ['__essen__'])

// Werkzeuge: "spitzhacke" = jede, "eisenspitzhacke" = genau die aus Eisen.
const MAT = { holz: 'wooden', stein: 'stone', eisen: 'iron', gold: 'golden', diamant: 'diamond', netherit: 'netherite' }
const WKZ = { spitzhacke: 'pickaxe', axt: 'axe', schaufel: 'shovel', schwert: 'sword', hacke: 'hoe' }
for (const [dw, ew] of Object.entries(WKZ)) {
  def(dw, null, [new RegExp('^[a-z]+_' + ew + '$')])
  for (const [dm, em] of Object.entries(MAT)) def(dm + dw, null, [em + '_' + ew])
}
const RUE = { helm: 'helmet', brustplatte: 'chestplate', hose: 'leggings', stiefel: 'boots' }
for (const [dw, ew] of Object.entries(RUE)) def(dw, null, [new RegExp('_' + ew + '$')])
def('ruestung', null, [/_(helmet|chestplate|leggings|boots)$/])
def('werkzeug,werkzeuge', null, [/_(pickaxe|axe|shovel|hoe)$/])
def('waffe,waffen', null, [/_sword$/, 'bow'])

// Tiere und Monster
const MOBS = {
  zombie: ['zombie', 'husk', 'zombie_villager'],
  zombies: ['zombie', 'husk', 'zombie_villager'],
  skelett: ['skeleton', 'stray', 'bogged'],
  skelette: ['skeleton', 'stray', 'bogged'],
  spinne: ['spider', 'cave_spider'],
  spinnen: ['spider', 'cave_spider'],
  creeper: ['creeper'],
  hexe: ['witch'],
  schleim: ['slime'],
  enderman: ['enderman'],
  ertrunkener: ['drowned'],
  pluenderer: ['pillager'],
  phantom: ['phantom'],
  kuh: ['cow', 'mooshroom'],
  kuehe: ['cow', 'mooshroom'],
  schwein: ['pig'],
  schweine: ['pig'],
  schaf: ['sheep'],
  schafe: ['sheep'],
  huhn: ['chicken'],
  huehner: ['chicken'],
  hase: ['rabbit'],
  kaninchen: ['rabbit'],
  lachs: ['salmon'],
  kabeljau: ['cod']
}

// Deutsche Anzeigenamen für die häufigsten Dinge (für "inventar").
const HOLZ = { oak: 'Eichen', spruce: 'Fichten', birch: 'Birken', jungle: 'Tropen', acacia: 'Akazien', dark_oak: 'Schwarzeichen', mangrove: 'Mangroven', cherry: 'Kirsch', pale_oak: 'Blasseichen', crimson: 'Karmesin', warped: 'Wirr', bamboo: 'Bambus' }
const TEIL = { log: 'stamm', stem: 'stiel', planks: 'bretter', leaves: 'laub', sapling: 'setzling', door: 'tür', slab: 'stufe', stairs: 'treppe', fence: 'zaun' }
const DMAT = { wooden: 'Holz', stone: 'Stein', iron: 'Eisen', golden: 'Gold', diamond: 'Diamant', netherite: 'Netherit', leather: 'Leder', chainmail: 'Ketten' }
const DWKZ = { pickaxe: 'spitzhacke', axe: 'axt', shovel: 'schaufel', sword: 'schwert', hoe: 'hacke', helmet: 'helm', chestplate: 'brustplatte', leggings: 'hose', boots: 'stiefel' }
const DE = {
  stone: 'Stein', cobblestone: 'Bruchstein', dirt: 'Erde', grass_block: 'Grasblock', sand: 'Sand', gravel: 'Kies',
  deepslate: 'Tiefenschiefer', cobbled_deepslate: 'Bruchtiefenschiefer', coal: 'Kohle', raw_iron: 'Roheisen',
  iron_ingot: 'Eisenbarren', raw_gold: 'Rohgold', gold_ingot: 'Goldbarren', raw_copper: 'Rohkupfer',
  copper_ingot: 'Kupferbarren', diamond: 'Diamant', emerald: 'Smaragd', redstone: 'Redstone', lapis_lazuli: 'Lapislazuli',
  stick: 'Stock', torch: 'Fackel', crafting_table: 'Werkbank', furnace: 'Ofen', chest: 'Truhe', bread: 'Brot',
  apple: 'Apfel', wheat: 'Weizen', wheat_seeds: 'Samen', carrot: 'Karotte', potato: 'Kartoffel',
  baked_potato: 'Ofenkartoffel', beef: 'Rohes Rindfleisch', cooked_beef: 'Steak', porkchop: 'Rohes Schweinefleisch',
  cooked_porkchop: 'Gebratenes Schweinefleisch', chicken: 'Rohes Hühnchen', cooked_chicken: 'Gebratenes Hühnchen',
  mutton: 'Rohes Hammelfleisch', cooked_mutton: 'Gebratenes Hammelfleisch', cod: 'Roher Kabeljau',
  cooked_cod: 'Gebratener Kabeljau', salmon: 'Roher Lachs', cooked_salmon: 'Gebratener Lachs',
  rotten_flesh: 'Verrottetes Fleisch', bone: 'Knochen', string: 'Faden', arrow: 'Pfeil', bow: 'Bogen',
  shield: 'Schild', gunpowder: 'Schwarzpulver', leather: 'Leder', feather: 'Feder', flint: 'Feuerstein',
  bucket: 'Eimer', water_bucket: 'Wassereimer', fishing_rod: 'Angel', glass: 'Glas', obsidian: 'Obsidian',
  spider_eye: 'Spinnenauge', ender_pearl: 'Enderperle', egg: 'Ei', ladder: 'Leiter', clay_ball: 'Tonklumpen',
  snowball: 'Schneeball', sugar_cane: 'Zuckerrohr', oak_sapling: 'Eichensetzling', white_wool: 'Weiße Wolle',
  white_bed: 'Weißes Bett', red_bed: 'Rotes Bett', melon_slice: 'Melonenscheibe', pumpkin: 'Kürbis'
}

function deName (item) {
  const n = item.name
  if (DE[n]) return DE[n]
  let m = /^(?:stripped_)?(.+)_(log|stem|planks|leaves|sapling|door|slab|stairs|fence)$/.exec(n)
  if (m && HOLZ[m[1]]) return HOLZ[m[1]] + TEIL[m[2]]
  m = /^([a-z]+)_(pickaxe|axe|shovel|sword|hoe|helmet|chestplate|leggings|boots)$/.exec(n)
  if (m && DMAT[m[1]]) return DMAT[m[1]] + DWKZ[m[2]]
  return item.displayName || n
}

function passt (name, muster) {
  return muster.some(m => (m instanceof RegExp ? m.test(name) : m === name))
}

// Liefert passende Namen aus einer Liste (Blöcke oder Gegenstände der Spielversion).
function finde (wort, art, liste, istEssen) {
  const w = norm(wort)
  const e = W[w] || W[w.replace(/(e|en|n|s)$/, '')]
  if (e) {
    const muster = e[art]
    if (muster[0] === '__essen__') return liste.filter(x => istEssen(x.name)).map(x => x.name)
    const treffer = liste.filter(x => passt(x.name, muster)).map(x => x.name)
    if (treffer.length) return treffer
  }
  // Englischer Minecraft-Name, z. B. "oak_log" oder "oak log"
  const en = w.replace(/ /g, '_')
  const genau = liste.filter(x => x.name === en)
  if (genau.length) return genau.map(x => x.name)
  if (en.length >= 4) return liste.filter(x => x.name.includes(en)).map(x => x.name)
  return []
}

module.exports = { norm, finde, deName, MOBS }
