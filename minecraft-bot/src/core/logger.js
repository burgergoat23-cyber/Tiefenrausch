'use strict'
// Einfaches Logging in Konsole + Datei (logs/bot-JJJJ-MM-TT.log).
const fs = require('fs')
const path = require('path')

const LEVELS = { debug: 10, info: 20, warn: 30, error: 40 }
const COLORS = { debug: '\x1b[90m', info: '\x1b[36m', warn: '\x1b[33m', error: '\x1b[31m' }
const RESET = '\x1b[0m'
const LABEL = { debug: 'DEBUG', info: 'INFO ', warn: 'WARN ', error: 'FEHLER' }

function pad (n) { return String(n).padStart(2, '0') }
function day (d) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` }
function time (d) { return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}` }

function fmtArg (a) {
  if (a instanceof Error) return a.stack || a.message
  if (typeof a === 'object' && a !== null) {
    try { return JSON.stringify(a) } catch { return String(a) }
  }
  return String(a)
}

class Logger {
  constructor ({ level = 'info', toFile = true, dir } = {}, tag = 'bot', shared) {
    this.tag = tag
    // "shared" teilen sich alle Kind-Logger (gleiche Datei, gleiches Level)
    this.shared = shared || { level: LEVELS[level] ? level : 'info', toFile, dir, stream: null, streamDay: null }
  }

  child (tag) { return new Logger(undefined, tag, this.shared) }

  setLevel (level) { if (LEVELS[level]) this.shared.level = level }

  _stream () {
    const s = this.shared
    if (!s.toFile || !s.dir) return null
    const today = day(new Date())
    if (s.stream && s.streamDay === today) return s.stream
    try {
      fs.mkdirSync(s.dir, { recursive: true })
      if (s.stream) s.stream.end()
      s.stream = fs.createWriteStream(path.join(s.dir, `bot-${today}.log`), { flags: 'a' })
      s.stream.on('error', () => { s.toFile = false })
      s.streamDay = today
    } catch {
      s.toFile = false
      return null
    }
    return s.stream
  }

  _write (level, args) {
    if (LEVELS[level] < LEVELS[this.shared.level]) return
    const d = new Date()
    const msg = args.map(fmtArg).join(' ')
    const line = `${time(d)} ${LABEL[level]} [${this.tag}] ${msg}`
    const out = level === 'error' || level === 'warn' ? console.error : console.log
    out(`${COLORS[level]}${line}${RESET}`)
    const st = this._stream()
    if (st) st.write(`${day(d)} ${line}\n`)
  }

  debug (...a) { this._write('debug', a) }
  info (...a) { this._write('info', a) }
  warn (...a) { this._write('warn', a) }
  error (...a) { this._write('error', a) }
}

module.exports = { Logger }
