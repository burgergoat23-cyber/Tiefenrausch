'use strict'
// Lädt config.json, ergänzt fehlende Werte und prüft die Eingaben.
const fs = require('fs')
const path = require('path')

const DEFAULTS = {
  host: 'localhost',
  port: 'auto',
  username: 'Tiefenbot',
  auth: 'offline',
  version: 'auto',
  owners: [],
  commandPrefix: '!',
  viewer: { enabled: true, port: 3007, firstPerson: false, viewDistance: 6 },
  reconnect: { enabled: true, delaySeconds: 15 },
  log: { level: 'info', toFile: true }
}

function merge (base, extra) {
  const out = { ...base }
  for (const [k, v] of Object.entries(extra || {})) {
    if (v && typeof v === 'object' && !Array.isArray(v) && base[k] && typeof base[k] === 'object') out[k] = merge(base[k], v)
    else out[k] = v
  }
  return out
}

function loadConfig (file) {
  let raw = {}
  if (fs.existsSync(file)) {
    try {
      raw = JSON.parse(fs.readFileSync(file, 'utf8'))
    } catch (e) {
      throw new Error(`config.json ist kein gültiges JSON (${e.message}). Tipp: Kommas und Anführungszeichen prüfen.`)
    }
  }
  const cfg = merge(DEFAULTS, raw)
  const errors = []

  if (cfg.port !== 'auto') {
    const p = Number(cfg.port)
    if (!Number.isInteger(p) || p < 1 || p > 65535) errors.push('"port" muss "auto" oder eine Zahl zwischen 1 und 65535 sein.')
    else cfg.port = p
  }
  if (!/^[A-Za-z0-9_]{3,16}$/.test(cfg.username)) errors.push('"username" darf nur Buchstaben, Zahlen und _ enthalten (3–16 Zeichen).')
  if (!['offline', 'microsoft'].includes(cfg.auth)) errors.push('"auth" muss "offline" oder "microsoft" sein.')
  if (!Array.isArray(cfg.owners)) errors.push('"owners" muss eine Liste sein, z. B. ["DeinName"].')
  if (cfg.version === 'auto' || cfg.version === '' || cfg.version == null) cfg.version = false
  if (errors.length) throw new Error('Fehler in config.json:\n - ' + errors.join('\n - '))

  cfg.owners = cfg.owners.map(o => String(o).toLowerCase())
  cfg.rootDir = path.dirname(path.resolve(file))
  return cfg
}

module.exports = { loadConfig, DEFAULTS }
