'use strict'
// Startpunkt des Bots: Konfiguration laden, Module einbinden, verbinden,
// bei Verbindungsende automatisch neu verbinden.
const path = require('path')
const readline = require('readline')
const mineflayer = require('mineflayer')

const { loadConfig } = require('./core/config')
const { Logger } = require('./core/logger')
const { State } = require('./core/state')
const { TaskManager, sleep } = require('./core/taskManager')
const { Commands } = require('./core/commands')
const { discoverLan } = require('./core/lanDiscovery')
const { chatText, fmtPos, dimName } = require('./core/util')

const ROOT = path.join(__dirname, '..')

// Reihenfolge = Reihenfolge, in der die Module eingebunden werden.
const MODULES = [
  require('./modules/movement'),
  require('./modules/info'),
  require('./modules/base'),
  require('./modules/auto'),
  require('./modules/recovery'),
  require('./modules/viewer'),
  require('./modules/placeholders')
]

let config
try {
  config = loadConfig(process.env.BOT_CONFIG || path.join(ROOT, 'config.json'))
} catch (e) {
  console.error('\x1b[31m' + e.message + '\x1b[0m')
  process.exit(1)
}

const log = new Logger({ ...config.log, dir: path.join(ROOT, 'logs') }, 'bot')
const state = new State(process.env.BOT_STATE || path.join(ROOT, 'data', 'state.json'), log.child('zustand')).load()
const tasks = new TaskManager({ log: log.child('aufgaben'), state })
const commands = new Commands({ log: log.child('chat'), config })

// Gemeinsamer Kontext für alle Module. ctx.bot wechselt bei jeder Neuverbindung.
const ctx = { config, log, state, tasks, commands, bot: null, say: (t) => commands.say(t) }

for (const m of MODULES) {
  try {
    if (m.init) m.init(ctx)
  } catch (e) {
    log.error(`Modul "${m.name}" konnte nicht starten:`, e)
  }
}
tasks.restore()

// ---------- Hinweise zu typischen Fehlern ----------
function hintFor (text) {
  const t = String(text).toLowerCase()
  if (t.includes('verify') || t.includes('unverified') || t.includes('authenticat')) {
    return 'Die LAN-Welt verlangt ein echtes Minecraft-Konto (Online-Modus). ' +
      'Lösung: Mod "Custom LAN" o. ä. installieren und Online-Modus AUS stellen, ' +
      'oder in config.json "auth": "microsoft" mit einem zweiten Konto. Siehe README → "Probleme".'
  }
  if (t.includes('outdated') || t.includes('version') || t.includes('incompatible')) {
    return 'Versionen passen nicht. Trage in config.json bei "version" deine Minecraft-Version ein (z. B. "1.21.4").'
  }
  if (t.includes('duplicate') || t.includes('already') || t.includes('same name')) {
    return 'Der Name ist schon im Spiel. Ändere "username" in config.json.'
  }
  if (t.includes('econnrefused')) {
    return 'Auf diesem Port läuft keine Welt. Ist die Welt "Für LAN geöffnet"? Stimmt der Port?'
  }
  if (t.includes('timed out') || t.includes('etimedout')) {
    return 'Keine Antwort von der Welt. Läuft Minecraft noch und ist das Spiel nicht pausiert?'
  }
  return null
}

// ---------- Verbinden ----------
let stopping = false

async function findTarget () {
  if (config.port !== 'auto') return { host: config.host, port: config.port }
  const L = log.child('lan')
  L.info('Suche geöffnete LAN-Welt … (In Minecraft: Esc → "Für LAN öffnen")')
  let tries = 0
  while (!stopping) {
    const res = await discoverLan({ timeoutMs: 20000, log: L })
    if (res) {
      L.info(`LAN-Welt gefunden: "${res.motd}" auf Port ${res.port} (von ${res.address})`)
      const host = config.host === 'auto' ? (res.host || res.address) : config.host
      return { host, port: res.port }
    }
    tries++
    L.warn(`Noch keine LAN-Welt gefunden (${tries}. Versuch). Suche weiter … ` +
      'Tipp: Port auch direkt in config.json bei "port" eintragbar.')
  }
  return null
}

async function connect () {
  const target = await findTarget()
  if (!target || stopping) return

  log.info(`Verbinde als "${config.username}" mit ${target.host}:${target.port} ` +
    `(Version: ${config.version || 'automatisch'}, Anmeldung: ${config.auth}) …`)

  let bot
  try {
    bot = mineflayer.createBot({
      host: target.host,
      port: target.port,
      username: config.username,
      auth: config.auth,
      version: config.version,
      profilesFolder: path.join(ROOT, 'data', 'auth'), // Login-Daten bei "microsoft"
      checkTimeoutInterval: 60 * 1000,
      hideErrors: true
    })
  } catch (e) {
    log.error('Bot konnte nicht erstellt werden:', e.message)
    const h = hintFor(e.message); if (h) log.warn('Tipp: ' + h)
    return scheduleReconnect()
  }

  ctx.bot = bot
  commands.attach(bot)
  for (const m of MODULES) {
    try {
      if (m.onBot) m.onBot(bot, ctx)
    } catch (e) {
      log.error(`Modul "${m.name}" (onBot) fehlgeschlagen:`, e)
    }
  }

  let lastKick = ''
  bot.once('login', () => log.info(`Eingeloggt (Minecraft ${bot.version}).`))
  bot.once('spawn', () => {
    log.info(`Gespawnt bei ${fmtPos(bot.entity.position)} (${dimName(bot)}). Schreib !hilfe im Chat.`)
    state.update(s => { s.stats.sessions++ })
    tasks.start()
    commands.say(`Hallo! Ich bin ${bot.username}. Schreib !hilfe für Befehle.`)
  })
  bot.on('spawn', () => log.debug('spawn-Event (auch nach Respawn).'))
  bot.on('health', () => log.debug(`Leben ${bot.health.toFixed(1)}/20, Hunger ${bot.food}/20`))
  bot.on('kicked', (reason) => {
    lastKick = chatText(reason)
    log.warn('Vom Server getrennt:', lastKick)
    const h = hintFor(lastKick); if (h) log.warn('Tipp: ' + h)
  })
  let lastErr = ''
  bot.on('error', (err) => {
    const msg = String(err.message || err)
    if (msg === lastErr) return // gleiche Meldung nicht doppelt
    lastErr = msg
    log.error('Verbindungsfehler:', msg)
    const h = hintFor(err.code || err.message || ''); if (h && !lastKick) log.warn('Tipp: ' + h)
  })
  bot.once('end', (reason) => {
    log.warn(`Verbindung beendet${reason ? ' (' + reason + ')' : ''}.`)
    tasks.pause()
    if (ctx.bot === bot) ctx.bot = null
    scheduleReconnect()
  })
}

async function scheduleReconnect () {
  if (stopping) return
  if (!config.reconnect.enabled) {
    log.info('Automatisches Neuverbinden ist aus. Beende.')
    return shutdown(0)
  }
  const sec = config.reconnect.delaySeconds || 15
  log.info(`Neuer Verbindungsversuch in ${sec} s … (Strg+C zum Beenden)`)
  await sleep(sec * 1000)
  if (!stopping) connect()
}

// ---------- Konsole: Befehle direkt im Terminal eintippen ----------
const rl = readline.createInterface({ input: process.stdin })
rl.on('line', (line) => {
  line = line.trim()
  if (!line) return
  if (line.startsWith(config.commandPrefix)) commands.run(line, { source: 'konsole' })
  else if (ctx.bot && ctx.bot.entity) ctx.bot.chat(line) // ohne "!" -> als Chat senden
  else log.info('Nicht verbunden – Befehle mit "!" funktionieren trotzdem (z. B. !hilfe).')
})

// ---------- Beenden & Absturzschutz ----------
function shutdown (code = 0) {
  stopping = true
  log.info('Beende Bot …')
  state.saveNow()
  try { if (ctx.bot) ctx.bot.quit('Bot beendet') } catch {}
  setTimeout(() => process.exit(code), 500)
}
process.on('SIGINT', () => shutdown(0))
process.on('SIGTERM', () => shutdown(0))
process.on('uncaughtException', (e) => log.error('Unerwarteter Fehler (Bot läuft weiter):', e))
process.on('unhandledRejection', (e) => log.error('Unerwarteter Fehler in Promise (Bot läuft weiter):', e))

log.info('Tiefenbot startet …')
connect()
