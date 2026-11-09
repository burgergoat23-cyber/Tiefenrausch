'use strict'
// Dauerhafter Zustand in data/state.json (übersteht Neustarts).
// Schreiben erfolgt verzögert (gebündelt) und "atomar" über eine Zwischendatei.
const fs = require('fs')
const path = require('path')

const EMPTY = () => ({
  version: 1,
  base: null, // { x, y, z, dimension }
  chests: [], // { x, y, z, category } (Phase 4)
  deaths: [], // { x, y, z, dimension, time, reason, recovered }
  completedGoals: [], // erledigte Ziele/Advancements (Phase 6)
  goals: [], // gespeicherte Aufgaben { type, args } für Neustart
  auto: false,
  stats: { deaths: 0, kills: 0, sessions: 0 }
})

class State {
  constructor (file, log) {
    this.file = file
    this.log = log
    this.data = EMPTY()
    this._timer = null
  }

  load () {
    try {
      if (fs.existsSync(this.file)) {
        const loaded = JSON.parse(fs.readFileSync(this.file, 'utf8'))
        const def = EMPTY()
        this.data = { ...def, ...loaded, stats: { ...def.stats, ...(loaded.stats || {}) } }
        this.log.info(`Zustand geladen (${path.basename(this.file)})`)
      } else {
        this.log.info('Kein gespeicherter Zustand – starte neu.')
      }
    } catch (e) {
      const backup = this.file + '.kaputt-' + Date.now()
      try { fs.renameSync(this.file, backup) } catch {}
      this.log.warn(`state.json war beschädigt und wurde nach ${path.basename(backup)} verschoben. Starte mit leerem Zustand.`)
      this.data = EMPTY()
    }
    return this
  }

  get (key) { return this.data[key] }

  set (key, value) {
    this.data[key] = value
    this.save()
  }

  // Für Änderungen an Listen/Objekten: state.update(d => d.deaths.push(...))
  update (fn) {
    fn(this.data)
    this.save()
  }

  save () {
    clearTimeout(this._timer)
    this._timer = setTimeout(() => this.saveNow(), 1000)
  }

  saveNow () {
    clearTimeout(this._timer)
    try {
      fs.mkdirSync(path.dirname(this.file), { recursive: true })
      const tmp = this.file + '.tmp'
      fs.writeFileSync(tmp, JSON.stringify(this.data, null, 2))
      fs.renameSync(tmp, this.file)
    } catch (e) {
      this.log.error('Konnte Zustand nicht speichern:', e.message)
    }
  }
}

module.exports = { State }
