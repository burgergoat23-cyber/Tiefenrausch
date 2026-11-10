// Minecraft-Bot "Kumpel" für die Java Edition (Einzelspieler-Welt, im LAN geöffnet).
// Start: start.bat doppelklicken. Befehle: im Minecraft-Chat "hilfe" schreiben.

const fs = require('fs')
const path = require('path')
const dgram = require('dgram')
const readline = require('readline')
const mineflayer = require('mineflayer')
const { pathfinder, Movements, goals } = require('mineflayer-pathfinder')
const pvp = require('mineflayer-pvp').plugin
const toolPlugin = require('mineflayer-tool').plugin
const armorManager = require('mineflayer-armor-manager')
const { norm, finde, deName, MOBS } = require('./namen')

// ---------- Einstellungen ----------
let cfg = { name: 'Kumpel', port: 0, adresse: '127.0.0.1', version: '', folgenBeimStart: true, beschuetzenBeimStart: true }
try {
  Object.assign(cfg, JSON.parse(fs.readFileSync(path.join(__dirname, 'einstellungen.json'), 'utf8')))
} catch (e) {
  console.log('Hinweis: einstellungen.json nicht lesbar, nehme Standardwerte. (' + e.message + ')')
}
if (process.argv[2]) cfg.port = parseInt(process.argv[2], 10) || 0

const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
const frage = (text) => new Promise(resolve => rl.question(text, a => resolve(a.trim())))
const schlaf = (ms) => new Promise(resolve => setTimeout(resolve, ms))

// ---------- Welt finden ----------
// Minecraft ruft eine im LAN geöffnete Welt alle 1,5 s im Heimnetz aus. Darauf hören wir.
function sucheLanWelt (ms) {
  return new Promise(resolve => {
    let fertig = false
    const sock = dgram.createSocket({ type: 'udp4', reuseAddr: true })
    const ende = (port) => {
      if (fertig) return
      fertig = true
      try { sock.close() } catch (e) {}
      resolve(port)
    }
    sock.on('error', () => ende(0))
    sock.on('message', (msg) => {
      const m = /\[AD\](\d+)\[\/AD\]/.exec(msg.toString())
      if (m) ende(parseInt(m[1], 10))
    })
    try {
      sock.bind(4445, () => {
        try { sock.addMembership('224.0.2.60') } catch (e) {}
      })
    } catch (e) { ende(0) }
    setTimeout(() => ende(0), ms)
  })
}

async function findePort () {
  if (cfg.port) return cfg.port
  console.log('\nSuche deine Minecraft-Welt ...')
  console.log('(In Minecraft: Esc -> "Im LAN öffnen" -> "LAN-Welt starten")')
  const p = await sucheLanWelt(8000)
  if (p) {
    console.log('Welt gefunden! Port ' + p)
    return p
  }
  console.log('\nIch habe die Welt nicht von allein gefunden.')
  console.log('In Minecraft steht im Chat: "Lokales Spiel auf Port 12345 gehostet".')
  for (;;) {
    const a = await frage('Tippe diese Zahl hier ein und drücke Enter: ')
    const n = parseInt(a.replace(/\D/g, ''), 10)
    if (n > 0 && n < 65536) return n
    console.log('Das war keine gültige Zahl. Beispiel: 54321')
  }
}

// ---------- Bot ----------
let bot = null
let laeuft = false

async function start () {
  const port = await findePort()
  console.log('\nVerbinde als "' + cfg.name + '" mit ' + cfg.adresse + ':' + port + ' ...')
  let grund = ''
  try {
    grund = await spiele(port)
  } catch (e) {
    grund = fehlerText(e)
  }
  console.log('\nVerbindung beendet. ' + grund)
  cfg.port = process.argv[2] ? cfg.port : 0
  await frage('\nEnter drücken, um es noch einmal zu versuchen (oder Fenster schließen) ...')
  start()
}

function fehlerText (e) {
  const t = String((e && e.message) || e)
  if (/ECONNREFUSED/.test(t)) return 'Unter diesem Port läuft keine Welt. Ist die Welt "im LAN geöffnet" und die Zahl richtig?'
  if (/ETIMEDOUT|ENOTFOUND|EHOSTUNREACH/.test(t)) return 'Die Welt ist nicht erreichbar. Läuft Minecraft auf diesem PC?'
  if (/unsupported|not supported|protocol version|is not a supported|Unknown version/i.test(t)) {
    return 'Diese Minecraft-Version kennt der Bot (noch) nicht.\n' +
      'Der Bot kann: ' + mineflayer.testedVersions.join(', ') + '\n' +
      'Tipp: Im Minecraft Launcher unter "Installationen" eine dieser Versionen anlegen und damit eine Welt spielen.'
  }
  return 'Fehler: ' + t
}

function kickText (r) {
  try {
    if (typeof r === 'string') {
      if (r[0] === '{') r = JSON.parse(r)
      else return r
    }
    if (r && r.value && r.value.translate) return r.value.translate.value || JSON.stringify(r.value)
    return r.translate || r.text || JSON.stringify(r)
  } catch (e) { return String(r) }
}

function spiele (port) {
  return new Promise((resolve) => {
    let ende = false
    let letzterFehler = ''
    const opt = { host: cfg.adresse, port, username: cfg.name, auth: 'offline', hideErrors: !process.env.BOT_DEBUG }
    if (cfg.version) opt.version = cfg.version
    try {
      bot = mineflayer.createBot(opt)
    } catch (e) {
      resolve(fehlerText(e))
      return
    }
    laeuft = true
    const b = bot
    b.on('error', e => { letzterFehler = fehlerText(e) })
    b.on('kicked', r => {
      const t = kickText(r)
      letzterFehler = 'Der Bot wurde hinausgeworfen: ' + t
      if (/duplicate_login|same name|logged in from another/i.test(t)) letzterFehler += '\nDer Bot darf nicht so heißen wie du. Ändere "name" in einstellungen.json.'
    })
    b.once('end', (r) => {
      if (ende) return
      ende = true
      laeuft = false
      if (b._takt) clearInterval(b._takt)
      resolve(letzterFehler || (r === 'socketClosed' ? 'Die Welt wurde geschlossen.' : ''))
    })
    try {
      richteEin(b)
    } catch (e) {
      console.log(e)
    }
  })
}

// ---------- Verhalten ----------
function richteEin (bot) {
  bot.loadPlugin(pathfinder)
  bot.loadPlugin(pvp)
  bot.loadPlugin(toolPlugin)
  bot.loadPlugin(armorManager)

  let mc = null // Daten der Spielversion
  let sanft = null // Laufen ohne Blöcke abzubauen (folgen, kommen, kämpfen)
  let arbeit = null // Laufen mit Abbauen/Hochbauen (sammeln)
  let chef = null // Name des Spielers, dem der Bot folgt
  let folgen = false
  let schutz = !!cfg.beschuetzenBeimStart
  let jobNr = 0
  let jobName = ''
  let isst = false
  let angelt = false
  let bereit = false
  let letzteWarnung = {}

  // --- Reden (mit kleiner Pause, damit der Server nichts als Spam wertet) ---
  const reden = []
  let redet = false
  function sag (text) {
    for (const zeile of teile(String(text), 240)) reden.push(zeile)
    if (redet) return
    redet = true
    ;(async () => {
      while (reden.length && laeuft) {
        const z = reden.shift()
        console.log('[' + bot.username + '] ' + z)
        try { bot.chat(z) } catch (e) {}
        await schlaf(650)
      }
      redet = false
    })()
  }
  function teile (t, n) {
    const aus = []
    while (t.length > n) {
      let i = t.lastIndexOf(' ', n)
      if (i < 40) i = n
      aus.push(t.slice(0, i))
      t = t.slice(i).trim()
    }
    if (t) aus.push(t)
    return aus
  }
  function selten (schluessel, sek, text) {
    const jetzt = Date.now()
    if (letzteWarnung[schluessel] && jetzt - letzteWarnung[schluessel] < sek * 1000) return
    letzteWarnung[schluessel] = jetzt
    sag(text)
  }

  // --- Hilfen ---
  const spieler = (name) => (bot.players[name] && bot.players[name].entity) || null
  const istEssen = (name) => !!(mc.foodsByName && mc.foodsByName[name])
  const SCHLECHT = new Set(['rotten_flesh', 'spider_eye', 'pufferfish', 'poisonous_potato', 'chicken', 'suspicious_stew', 'chorus_fruit'])
  const KOSTBAR = new Set(['golden_apple', 'enchanted_golden_apple', 'golden_carrot'])
  const NICHT_ANGREIFEN = new Set(['creeper', 'enderman', 'zombified_piglin', 'piglin', 'ender_dragon', 'wither', 'warden', 'iron_golem'])

  function naechsterSpieler () {
    let best = null
    let d = Infinity
    for (const n of Object.keys(bot.players)) {
      if (n === bot.username) continue
      const e = bot.players[n].entity
      if (!e) continue
      const dd = e.position.distanceTo(bot.entity.position)
      if (dd < d) { d = dd; best = n }
    }
    return best
  }

  function stoppBewegung () {
    try { bot.pathfinder.setGoal(null) } catch (e) {}
    try { bot.pvp.forceStop() } catch (e) {}
    try { if (bot.targetDigBlock) bot.stopDigging() } catch (e) {}
    try { bot.clearControlStates() } catch (e) {}
    if (angelt) {
      angelt = false
      try { bot.activateItem() } catch (e) {}
    }
  }
  function neuerJob (name) {
    stoppBewegung()
    jobNr++
    jobName = name
    return jobNr
  }
  const aktiv = (nr) => nr === jobNr && laeuft
  function jobEnde (nr) {
    if (nr !== jobNr) return
    jobName = ''
    folgeWeiter()
  }

  // Läuft zu einem Ziel. Bricht nach einer Weile ab, statt ewig festzuhängen.
  async function geheZu (ziel, bewegung, maxMs = 45000) {
    bot.pathfinder.setMovements(bewegung)
    let zeit = null
    const t = new Promise((resolve, reject) => {
      zeit = setTimeout(() => {
        try { bot.pathfinder.setGoal(null) } catch (e) {}
        reject(new Error('zu lange'))
      }, maxMs)
    })
    try {
      await Promise.race([bot.pathfinder.goto(ziel), t])
    } finally {
      clearTimeout(zeit)
    }
  }

  function folgeWeiter () {
    if (!folgen || jobName || bot.pvp.target || bot.isSleeping) return
    const e = chef && spieler(chef)
    if (!e) return
    bot.pathfinder.setMovements(sanft)
    bot.pathfinder.setGoal(new goals.GoalFollow(e, 3), true)
    bot._folgt = e
  }

  // --- Kämpfen ---
  function besteWaffe () {
    const rang = ['wooden', 'golden', 'stone', 'iron', 'diamond', 'netherite']
    let best = null
    let wert = -1
    for (const it of bot.inventory.items()) {
      const m = /^([a-z]+)_(sword|axe)$/.exec(it.name)
      if (!m) continue
      const w = rang.indexOf(m[1]) * 2 + (m[2] === 'sword' ? 1 : 0)
      if (w > wert) { wert = w; best = it }
    }
    return best
  }
  async function greifAn (e) {
    const w = besteWaffe()
    if (w) { try { await bot.equip(w, 'hand') } catch (err) {} }
    if (!e.isValid) return
    bot.pvp.movements = sanft
    bot.pvp.attack(e)
  }
  function istFeind (e) {
    if (!e || !e.isValid || e === bot.entity) return false
    if (e.type !== 'hostile' && e.kind !== 'Hostile mobs') return false
    return !NICHT_ANGREIFEN.has(e.name)
  }
  function naechsterFeind () {
    const ich = bot.entity.position
    const c = chef && spieler(chef)
    let best = null
    let d = Infinity
    for (const id of Object.keys(bot.entities)) {
      const e = bot.entities[id]
      if (!istFeind(e)) continue
      const dIch = e.position.distanceTo(ich)
      const dChef = c ? e.position.distanceTo(c.position) : Infinity
      if (Math.abs(e.position.y - ich.y) > 6) continue
      if (!(dIch < 9 || (dChef < 9 && dIch < 24))) continue
      if (dIch < d) { d = dIch; best = e }
    }
    return best
  }

  // --- Essen ---
  async function essen (aufWunsch) {
    if (isst) return
    const liste = bot.inventory.items().filter(i => istEssen(i.name) && !SCHLECHT.has(i.name) && (aufWunsch || !KOSTBAR.has(i.name)))
    if (!liste.length) {
      if (aufWunsch) sag('Ich habe nichts zu essen. Wirf mir etwas hin!')
      else if (bot.food <= 8) selten('hunger', 120, 'Ich habe Hunger! Wirf mir bitte etwas zu essen hin.')
      return
    }
    if (bot.food >= 20) {
      if (aufWunsch) sag('Ich bin satt.')
      return
    }
    liste.sort((a, b) => (mc.foodsByName[b.name].foodPoints || 0) - (mc.foodsByName[a.name].foodPoints || 0))
    isst = true
    try {
      await bot.equip(liste[0], 'hand')
      await bot.consume()
      if (aufWunsch) sag('Mmh, lecker.')
    } catch (e) {
      if (aufWunsch) sag('Ich kann gerade nicht essen.')
    } finally {
      isst = false
    }
  }

  // --- Takt: zweimal pro Sekunde nachsehen, was zu tun ist ---
  function takt () {
    if (!bereit || !bot.entity || bot.isSleeping) return
    try {
      if (schutz && !bot.pvp.target && !isst) {
        const f = naechsterFeind()
        if (f) greifAn(f)
      }
      if (!bot.pvp.target && !isst && !bot.targetDigBlock && !angelt && (bot.food <= 14 || (bot.health < 12 && bot.food < 20))) essen(false)
      if (bot.health > 0 && bot.health <= 6) selten('leben', 30, 'Hilfe, ich habe nur noch wenig Leben!')
      if (folgen && !jobName && !bot.pvp.target) {
        const e = chef && spieler(chef)
        if (!e) {
          if (bot._folgt) { bot._folgt = null; try { bot.pathfinder.setGoal(null) } catch (err) {} }
          selten('weg', 60, 'Ich sehe dich nicht mehr. Hol mich mit: /tp ' + bot.username + ' ' + (chef || '@p'))
        } else if (bot._folgt !== e || !bot.pathfinder.goal) {
          folgeWeiter()
        }
      }
    } catch (e) {
      console.log('Takt-Fehler:', e.message)
    }
  }

  // --- Befehle ---
  const FUELL = new Set(['mir', 'mich', 'bitte', 'mal', 'den', 'die', 'das', 'dem', 'der', 'ein', 'eine', 'einen', 'paar', 'etwas', 'stueck', 'bloecke', 'block', 'x', 'mal', 'zu', 'von', 'deine', 'dein', 'deinen', 'noch', 'mehr', 'jetzt', 'schnell', 'du', 'ab', 'her', 'an'])
  function wortUndZahl (rest, standard) {
    let zahl = null
    const w = []
    for (const t of rest) {
      if (/^\d+$/.test(t)) zahl = parseInt(t, 10)
      else if (t === 'stack') zahl = 64
      else if (!FUELL.has(t)) w.push(t)
    }
    return { wort: w.join(' '), zahl: Math.max(1, Math.min(zahl || standard, 640)), zahlGenannt: zahl !== null }
  }

  async function befehl (wer, text) {
    let t = norm(text)
    const ich = norm(bot.username)
    let angesprochen = false
    if (t === ich || t.startsWith(ich + ' ')) { t = t.slice(ich.length).trim(); angesprochen = true }
    if (!t) { sag('Ja? Schreib "hilfe", dann zeige ich dir, was ich kann.'); return }
    const w = t.split(' ')
    const erst = w[0]
    const rest = w.slice(1)
    const hat = (...liste) => liste.some(x => t === x || t.startsWith(x + ' '))
    const nach = (...liste) => {
      for (const x of liste.sort((a, b) => b.length - a.length)) {
        if (t === x || t.startsWith(x + ' ')) return t.slice(x.length).trim().split(' ').filter(Boolean)
      }
      return rest
    }

    if (hat('hilfe', 'befehle', 'help', 'was kannst du')) return hilfe()

    if (hat('stopp', 'stop', 'halt', 'bleib', 'warte', 'hoer auf', 'aufhoeren')) {
      folgen = false
      neuerJob('')
      sag('Okay, ich bleibe hier stehen.')
      return
    }

    if (hat('folge', 'folg', 'komm mit', 'mitkommen', 'lauf mir nach')) {
      chef = wer
      folgen = true
      neuerJob('')
      if (!spieler(wer)) sag('Ich sehe dich nicht. Hol mich mit: /tp ' + bot.username + ' ' + wer)
      else { sag('Ich folge dir!'); folgeWeiter() }
      return
    }

    if (hat('geh zu', 'gehe zu', 'lauf zu', 'geh', 'gehe') && rest.filter(x => /^-?\d+$/.test(x)).length >= 2) {
      const z = t.match(/-?\d+/g).map(Number)
      const nr = neuerJob('gehen')
      folgen = false
      sag('Ich laufe los.')
      try {
        await geheZu(z.length >= 3 ? new goals.GoalNear(z[0], z[1], z[2], 1) : new goals.GoalNearXZ(z[0], z[1], 1), arbeit, 180000)
        if (aktiv(nr)) sag('Ich bin da.')
      } catch (e) {
        if (aktiv(nr)) sag('Da komme ich nicht hin.')
      }
      jobEnde(nr)
      return
    }

    if (hat('komm', 'hierher', 'hier her', 'zu mir')) {
      const e = spieler(wer)
      if (!e) { sag('Ich sehe dich nicht. Hol mich mit: /tp ' + bot.username + ' ' + wer); return }
      chef = wer
      const nr = neuerJob('kommen')
      sag('Ich komme!')
      try {
        await geheZu(new goals.GoalNear(e.position.x, e.position.y, e.position.z, 2), sanft)
      } catch (err) {
        if (aktiv(nr)) {
          try { await geheZu(new goals.GoalNear(e.position.x, e.position.y, e.position.z, 2), arbeit) } catch (err2) {
            if (aktiv(nr)) sag('Ich finde keinen Weg zu dir.')
          }
        }
      }
      jobEnde(nr)
      return
    }

    if (hat('bau ab', 'baue ab', 'abbauen', 'hol', 'hole', 'sammle', 'sammel', 'farme', 'farm', 'mine', 'besorge', 'besorg', 'faelle', 'faell', 'grabe', 'grab')) {
      const a = wortUndZahl(nach('bau ab', 'baue ab', 'abbauen', 'hol', 'hole', 'sammle', 'sammel', 'farme', 'farm', 'mine', 'besorge', 'besorg', 'faelle', 'faell', 'grabe', 'grab'), 10)
      if (!a.wort) { sag('Was soll ich holen? Zum Beispiel: hol 10 holz'); return }
      return sammle(wer, a.wort, a.zahl)
    }

    if (hat('gib', 'gebe', 'geb', 'wirf', 'schenk', 'schenke')) {
      const a = wortUndZahl(rest, 0)
      if (!a.wort) { sag('Was soll ich dir geben? Zum Beispiel: gib holz  oder  gib alles'); return }
      return gib(wer, a.wort, a.zahlGenannt ? a.zahl : 0)
    }

    if (hat('inventar', 'inv', 'was hast du', 'rucksack', 'tasche')) return inventar()

    if (hat('friedlich', 'schutz aus', 'nicht kaempfen', 'kaempfe nicht')) {
      schutz = false
      try { bot.pvp.forceStop() } catch (e) {}
      sag('Okay, ich kämpfe nicht mehr.')
      folgeWeiter()
      return
    }

    if (hat('beschuetze', 'beschuetz', 'kaempfe', 'kaempf', 'wache', 'schutz an', 'pass auf')) {
      chef = wer
      schutz = true
      sag('Ich passe auf uns auf und kämpfe gegen Monster.')
      return
    }
    if (hat('greif an', 'greife an', 'angriff', 'toete', 'jage', 'jag', 'attacke')) {
      return jage(wer, wortUndZahl(nach('greif an', 'greife an', 'angriff', 'toete', 'jage', 'jag', 'attacke'), 1))
    }

    if (hat('iss', 'esse', 'essen', 'friss')) return essen(true)

    if (hat('schlaf', 'schlafe', 'schlafen', 'ins bett', 'geh schlafen')) return schlafen()
    if (hat('wach auf', 'aufstehen', 'aufwachen', 'steh auf')) {
      try { await bot.wake(); sag('Guten Morgen!') } catch (e) { sag('Ich schlafe gar nicht.') }
      folgeWeiter()
      return
    }

    if (hat('wo bist du', 'wo', 'position', 'koordinaten')) {
      const p = bot.entity.position
      sag('Ich bin bei x ' + Math.round(p.x) + ', y ' + Math.round(p.y) + ', z ' + Math.round(p.z) + '.')
      return
    }
    if (hat('status', 'leben', 'wie geht', 'wie gehts', 'alles gut')) {
      sag('Leben: ' + Math.round(bot.health) + ' von 20, Hunger: ' + Math.round(bot.food) + ' von 20. ' +
        (folgen ? 'Ich folge ' + chef + '. ' : '') + (schutz ? 'Ich beschütze uns. ' : 'Ich kämpfe nicht. ') + (jobName ? 'Gerade: ' + jobName + '.' : ''))
      return
    }

    if (hat('angle', 'angeln', 'angel', 'fische', 'fischen')) return angeln()

    if (hat('craft', 'crafte', 'stelle her', 'stell her', 'herstellen', 'mach', 'mache', 'bau', 'baue')) {
      const a = wortUndZahl(nach('craft', 'crafte', 'stelle her', 'stell her', 'herstellen', 'mach', 'mache', 'bau', 'baue'), 1)
      if (!a.wort) { sag('Was soll ich herstellen? Zum Beispiel: mach bretter'); return }
      return stelleHer(a.wort, a.zahl)
    }

    if (hat('spring', 'springe', 'huepf')) {
      bot.setControlState('jump', true)
      setTimeout(() => { try { bot.setControlState('jump', false) } catch (e) {} }, 400)
      return
    }
    if (hat('tanz', 'tanze')) return tanze()
    if (hat('hallo', 'hi', 'hey', 'moin', 'servus')) { sag('Hallo ' + wer + '! Schreib "hilfe", dann zeige ich dir, was ich kann.'); return }
    if (hat('danke', 'dankeschoen', 'super', 'gut gemacht')) { sag('Gern!'); return }

    if (angesprochen || erst.length > 1) selten('unklar', 8, 'Das verstehe ich nicht. Schreib "hilfe" für alle Befehle.')
  }

  function hilfe () {
    sag('Das kann ich (einfach in den Chat schreiben):')
    sag('folge = ich laufe dir nach | komm = ich komme zu dir | stopp = ich bleibe stehen')
    sag('hol 10 holz = Blöcke abbauen (auch: stein, kohle, eisen, erde, sand ...)')
    sag('gib holz / gib alles = ich werfe dir Sachen hin | inventar = was ich dabei habe')
    sag('beschütze = ich kämpfe gegen Monster | friedlich = ich kämpfe nicht | jage kuh')
    sag('mach bretter / mach werkbank / mach holzspitzhacke = etwas herstellen')
    sag('iss | schlaf | wach auf | angeln | status | wo bist du | geh zu 100 64 -20')
  }

  function inventar () {
    const z = {}
    for (const it of bot.inventory.items()) {
      const n = deName(it)
      z[n] = (z[n] || 0) + it.count
    }
    const liste = Object.keys(z).map(n => z[n] + 'x ' + n)
    sag(liste.length ? 'Ich habe: ' + liste.join(', ') : 'Mein Inventar ist leer.')
  }

  // Abbauen: passende Blöcke suchen, hinlaufen, richtiges Werkzeug nehmen, abbauen, einsammeln.
  async function sammle (wer, wort, zahl) {
    const namen = finde(wort, 'b', mc.blocksArray, istEssen)
    if (!namen.length) { sag('Ich weiß nicht, was "' + wort + '" ist. Versuch es mit: holz, stein, kohle, eisen, erde, sand.'); return }
    const ids = namen.map(n => mc.blocksByName[n].id)
    const nr = neuerJob('sammeln (' + wort + ')')
    chef = wer
    const uebersprungen = new Set()
    let geschafft = 0
    let fehlschlaege = 0
    sag('Okay, ich hole ' + zahl + 'x ' + wort + '.')
    while (aktiv(nr) && geschafft < zahl) {
      while (aktiv(nr) && (bot.pvp.target || isst)) await schlaf(300)
      if (!aktiv(nr)) break
      const stellen = bot.findBlocks({ matching: ids, maxDistance: 48, count: 40 })
        .filter(p => !uebersprungen.has(p.toString()))
      if (!stellen.length) {
        sag(geschafft ? 'Hier gibt es nichts mehr davon. Ich habe ' + geschafft + ' geschafft.' : 'Ich finde hier in der Nähe kein ' + wort + '.')
        break
      }
      const ich = bot.entity.position
      stellen.sort((a, b) => a.distanceTo(ich) - b.distanceTo(ich))
      const pos = stellen[0]
      let block = bot.blockAt(pos)
      if (!block) { uebersprungen.add(pos.toString()); continue }
      if (block.harvestTools) {
        const kann = bot.inventory.items().some(it => block.harvestTools[it.type])
        if (!kann) { sag('Dafür brauche ich ein besseres Werkzeug (Spitzhacke). Wirf mir eins hin!'); break }
      }
      try {
        await geheZu(new goals.GoalLookAtBlock(pos, bot.world, { reach: 4 }), arbeit, 30000)
        block = bot.blockAt(pos)
        if (!block || !ids.includes(block.type)) continue
        try { await bot.tool.equipForBlock(block, {}) } catch (e) {}
        await bot.dig(block)
        geschafft++
        fehlschlaege = 0
        await schlaf(350)
        await hebeAuf(nr)
      } catch (e) {
        if (!aktiv(nr)) break
        if (bot.pvp.target) continue
        uebersprungen.add(pos.toString())
        if (++fehlschlaege >= 8) { sag('Ich komme an das ' + wort + ' nicht heran. Ich habe ' + geschafft + ' geschafft.'); break }
      }
    }
    if (aktiv(nr) && geschafft >= zahl) sag('Fertig! Ich habe ' + geschafft + 'x ' + wort + ' abgebaut. Schreib "gib ' + wort + '", dann bekommst du es.')
    jobEnde(nr)
  }

  async function hebeAuf (nr) {
    for (let i = 0; i < 3 && aktiv(nr); i++) {
      const ich = bot.entity.position
      const ding = Object.values(bot.entities)
        .filter(e => e.name === 'item' && e.isValid && e.position.distanceTo(ich) < 6)
        .sort((a, b) => a.position.distanceTo(ich) - b.position.distanceTo(ich))[0]
      if (!ding) return
      try {
        await geheZu(new goals.GoalNear(ding.position.x, ding.position.y, ding.position.z, 0.7), arbeit, 6000)
      } catch (e) { return }
      await schlaf(200)
    }
  }

  async function gib (wer, wort, zahl) {
    const e = spieler(wer)
    if (!e) { sag('Ich sehe dich nicht. Komm näher oder hol mich mit: /tp ' + bot.username + ' ' + wer); return }
    let sachen
    if (/^(alles|alle|alle sachen)$/.test(wort)) sachen = bot.inventory.items()
    else {
      const namen = new Set(finde(wort, 'i', mc.itemsArray, istEssen))
      sachen = bot.inventory.items().filter(it => namen.has(it.name))
    }
    if (!sachen.length) { sag('Ich habe kein ' + wort + '.'); return }
    const nr = neuerJob('geben')
    try {
      if (e.position.distanceTo(bot.entity.position) > 3.5) await geheZu(new goals.GoalNear(e.position.x, e.position.y, e.position.z, 2), sanft, 30000)
    } catch (err) {}
    if (!aktiv(nr)) return
    let offen = zahl || Infinity
    let summe = 0
    try { await bot.lookAt(e.position.offset(0, 1.2, 0), true) } catch (err) {}
    for (const it of sachen) {
      if (offen <= 0 || !aktiv(nr)) break
      const n = Math.min(it.count, offen)
      try {
        await bot.toss(it.type, null, n)
        offen -= n
        summe += n
      } catch (err) {
        if (genau) console.log(err)
      }
      await schlaf(150)
    }
    if (aktiv(nr)) sag(summe ? 'Hier, bitte! (' + summe + 'x)' : 'Das Werfen hat nicht geklappt.')
    await schlaf(2500) // kurz warten, damit ich die Sachen nicht selbst wieder aufhebe
    jobEnde(nr)
  }

  async function jage (wer, a) {
    let namen = null
    if (a.wort && !/^(monster|feind|feinde|gegner)$/.test(a.wort)) {
      namen = MOBS[a.wort] || [a.wort.replace(/ /g, '_')]
    }
    const suche = () => {
      const ich = bot.entity.position
      return Object.values(bot.entities)
        .filter(e => e.isValid && e !== bot.entity && e.type !== 'player' && (namen ? namen.includes(e.name) : istFeind(e)) && e.position.distanceTo(ich) < 40)
        .sort((x, y) => x.position.distanceTo(ich) - y.position.distanceTo(ich))[0]
    }
    if (!suche()) { sag(namen ? 'Ich sehe hier kein Tier oder Monster mit dem Namen "' + a.wort + '".' : 'Ich sehe keine Monster.'); return }
    const nr = neuerJob('jagen')
    chef = wer
    sag('Auf in den Kampf!')
    let erledigt = 0
    while (aktiv(nr) && erledigt < a.zahl) {
      const ziel = suche()
      if (!ziel) break
      await greifAn(ziel)
      const ende = Date.now() + 40000
      while (aktiv(nr) && ziel.isValid && Date.now() < ende) await schlaf(250)
      if (!ziel.isValid) erledigt++
      else { try { bot.pvp.forceStop() } catch (e) {} break }
    }
    if (aktiv(nr)) {
      await schlaf(400)
      await hebeAuf(nr)
      sag(erledigt ? 'Erledigt (' + erledigt + ').' : 'Das habe ich nicht geschafft.')
    }
    jobEnde(nr)
  }

  async function schlafen () {
    const bett = bot.findBlock({ matching: (b) => bot.isABed(b), maxDistance: 32 })
    if (!bett) { sag('Ich finde kein Bett. Stell bitte ein zweites Bett für mich hin.'); return }
    const nr = neuerJob('schlafen')
    try {
      await geheZu(new goals.GoalNear(bett.position.x, bett.position.y, bett.position.z, 2), sanft, 30000)
      await bot.sleep(bett)
      sag('Gute Nacht!')
    } catch (e) {
      if (aktiv(nr)) sag('Ich kann gerade nicht schlafen (das geht nur nachts, ohne Monster in der Nähe, und das Bett muss frei sein).')
    }
    if (aktiv(nr)) jobName = ''
  }

  async function angeln () {
    const rute = bot.inventory.items().find(i => i.name === 'fishing_rod')
    if (!rute) { sag('Ich habe keine Angel. Wirf mir eine hin!'); return }
    const nr = neuerJob('angeln')
    sag('Ich angle. Stell mich ans Wasser und schreib "stopp", wenn es reicht.')
    let n = 0
    while (aktiv(nr)) {
      try {
        await bot.equip(rute.type, 'hand')
        angelt = true
        await bot.fish()
        n++
      } catch (e) {
        if (!aktiv(nr)) break
        await schlaf(1500)
        if (!bot.inventory.items().some(i => i.name === 'fishing_rod')) { sag('Meine Angel ist kaputt.'); break }
      }
      angelt = false
    }
    angelt = false
    if (n) sag('Ich habe ' + n + ' Mal etwas gefangen.')
    jobEnde(nr)
  }

  async function stelleHer (wort, zahl) {
    const namen = finde(wort, 'i', mc.itemsArray, istEssen)
    if (!namen.length) { sag('Ich weiß nicht, was "' + wort + '" ist.'); return }
    const tischId = mc.blocksByName.crafting_table.id
    const tisch = bot.findBlock({ matching: tischId, maxDistance: 32 })
    let rezept = null
    let ding = null
    for (const n of namen) {
      const it = mc.itemsByName[n]
      const r = bot.recipesFor(it.id, null, 1, tisch || null)
      if (r && r.length) { rezept = r[0]; ding = it; break }
    }
    if (!rezept) {
      // Sagen, was fehlt
      const it = mc.itemsByName[namen[0]]
      const alle = bot.recipesAll(it.id, null, true)
      if (!alle || !alle.length) { sag('Dafür kenne ich kein Rezept.'); return }
      if (alle[0].requiresTable && !tisch) { sag('Dafür brauche ich eine Werkbank in der Nähe.'); return }
      const fehlt = alle[0].delta.filter(d => d.count < 0)
        .map(d => ({ it: mc.items[d.id], n: -d.count }))
        .filter(d => d.it && bot.inventory.count(d.it.id, null) < d.n)
        .map(d => d.n + 'x ' + deName(d.it))
      sag('Dafür fehlt mir etwas' + (fehlt.length ? ': ' + fehlt.join(', ') : '.'))
      return
    }
    const nr = neuerJob('herstellen')
    try {
      if (rezept.requiresTable) await geheZu(new goals.GoalNear(tisch.position.x, tisch.position.y, tisch.position.z, 2), sanft, 30000)
      const jeMal = (rezept.result && rezept.result.count) || 1
      const mal = Math.ceil(zahl / jeMal)
      let fertig = 0
      for (let i = 0; i < mal && aktiv(nr); i++) {
        try {
          await bot.craft(rezept, 1, rezept.requiresTable ? tisch : null)
          fertig += jeMal
        } catch (e) { break }
      }
      if (aktiv(nr)) sag(fertig ? 'Fertig: ' + fertig + 'x ' + deName(ding) + '.' : 'Das Herstellen hat nicht geklappt.')
    } catch (e) {
      if (aktiv(nr)) sag('Ich komme nicht zur Werkbank.')
    }
    jobEnde(nr)
  }

  async function tanze () {
    const nr = neuerJob('tanzen')
    for (let i = 0; i < 12 && aktiv(nr); i++) {
      bot.setControlState('sneak', i % 2 === 0)
      try { await bot.look(bot.entity.yaw + Math.PI / 3, 0, true) } catch (e) {}
      if (i % 3 === 0) bot.swingArm()
      await schlaf(250)
    }
    bot.setControlState('sneak', false)
    jobEnde(nr)
  }

  // --- Ereignisse ---
  bot.once('spawn', () => {
    mc = bot.registry
    sanft = new Movements(bot)
    sanft.canDig = false
    sanft.allow1by1towers = false
    sanft.scafoldingBlocks = []
    sanft.canOpenDoors = true
    arbeit = new Movements(bot)
    arbeit.canOpenDoors = true
    bot.pathfinder.thinkTimeout = 6000
    bot.pvp.movements = sanft
    bereit = true
    console.log('\nVerbunden! Minecraft-Version ' + bot.version + '. Der Bot heißt "' + bot.username + '".')
    console.log('Schreib jetzt im Minecraft-Chat (Taste T): hilfe')
    console.log('Du kannst Befehle auch hier in dieses Fenster tippen.\n')
    setTimeout(() => {
      if (!laeuft) return
      chef = naechsterSpieler()
      sag('Hallo! Ich bin ' + bot.username + ', dein Mitspieler. Schreib "hilfe", dann zeige ich dir, was ich kann.')
      if (chef && cfg.folgenBeimStart) { folgen = true; folgeWeiter() } else if (!chef) {
        sag('Ich sehe dich nicht. Hol mich zu dir mit: /tp ' + bot.username + ' @p')
        letzteWarnung.weg = Date.now()
        if (cfg.folgenBeimStart) folgen = true
      }
    }, 2500)
    bot._takt = setInterval(takt, 500)
  })

  bot.on('chat', (name, text) => {
    if (!bereit || name === bot.username || !bot.players[name]) return
    if (folgen && !chef) chef = name
    befehl(name, text).catch(e => { console.log('Fehler bei "' + text + '":', e.message); jobName = '' })
  })
  bot.on('whisper', (name, text) => {
    if (!bereit || name === bot.username) return
    befehl(name, text).catch(e => console.log('Fehler:', e.message))
  })
  bot.on('playerJoined', (p) => { if (bereit && !chef && p.username !== bot.username) chef = p.username })
  bot.on('stoppedAttacking', () => { setTimeout(() => { if (laeuft) folgeWeiter() }, 300) })
  bot.on('death', () => {
    jobNr++
    jobName = ''
    sag('Autsch, ich bin gestorben! Meine Sachen liegen dort, wo es passiert ist.')
  })
  bot.on('wake', () => { if (laeuft) folgeWeiter() })

  // Befehle direkt im Bot-Fenster
  if (!rl._botZeile) {
    rl._botZeile = true
    rl.on('line', (z) => {
      z = z.trim()
      if (!z || !laeuft || !globalBefehl) return
      globalBefehl(z)
    })
  }
  globalBefehl = (z) => {
    if (!bereit) return
    const wer = chef || naechsterSpieler() || bot.username
    befehl(wer, z).catch(e => console.log('Fehler:', e.message))
  }
}

let globalBefehl = null

const genau = !!process.env.BOT_DEBUG // dann werden Fehler ausführlich gezeigt
process.on('unhandledRejection', (e) => { console.log('Hinweis:', genau ? e : (e && e.message) || e) })
process.on('uncaughtException', (e) => { console.log('Fehler:', genau ? e : (e && e.message) || e) })

console.log('==============================================')
console.log('  Minecraft-Bot "' + cfg.name + '"  (Java Edition)')
console.log('==============================================')
start()
