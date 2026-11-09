'use strict'
// Prioritäts-basierter Task-Manager.
//
// Kleinere Zahl = wichtiger. Eine wichtigere Aufgabe unterbricht eine
// unwichtigere sofort (AbortSignal). Unterbrochene Ziele (Priorität GOAL)
// bleiben in der Warteschlange und laufen danach weiter.
//
// Zwei Quellen für Aufgaben:
//  1. "Provider": Funktionen, die bei jedem Takt prüfen, ob gerade etwas
//     nötig ist (z. B. Überleben: "Hunger -> essen"). Geben eine Aufgabe oder null zurück.
//  2. Warteschlange: ausdrücklich hinzugefügte Aufgaben (Chat-Befehle, Roadmap).
//
// Eine Aufgabe ist ein Objekt:
//   { name, priority, key?, persist?, type?, args?, run: async ({ signal, task }) => {} }

const PRIORITY = Object.freeze({
  SURVIVAL: 1,
  COMBAT: 2,
  RECOVERY: 3,
  COMMAND: 3.5, // direkte Chat-Befehle (!folge, !komm) gehen vor eigenen Zielen
  GOAL: 4,
  IDLE: 5
})
const PRIO_NAME = { 1: 'Überleben', 2: 'Kampf', 3: 'Tod-Recovery', 3.5: 'Befehl', 4: 'Ziel', 5: 'Idle' }

class AbortedError extends Error {
  constructor () { super('Aufgabe abgebrochen'); this.name = 'AbortedError' }
}

function sleep (ms, signal) {
  return new Promise((resolve, reject) => {
    if (signal && signal.aborted) return reject(new AbortedError())
    const t = setTimeout(() => { cleanup(); resolve() }, ms)
    const onAbort = () => { clearTimeout(t); cleanup(); reject(new AbortedError()) }
    const cleanup = () => signal && signal.removeEventListener('abort', onAbort)
    if (signal) signal.addEventListener('abort', onAbort, { once: true })
  })
}

function throwIfAborted (signal) {
  if (signal && signal.aborted) throw new AbortedError()
}

let nextId = 1

class TaskManager {
  constructor ({ log, state, tickMs = 500 }) {
    this.log = log
    this.state = state
    this.tickMs = tickMs
    this.providers = [] // { name, fn }
    this.queue = [] // ausdrücklich hinzugefügte Aufgaben
    this.types = {} // type -> factory(args) für gespeicherte Ziele
    this.current = null // { task, controller, promise }
    this.interruptHooks = [] // werden beim Abbrechen aufgerufen (z. B. Pathfinder stoppen)
    this.listeners = { done: [], failed: [], started: [] }
    this._switching = false
    this._timer = null
    this.paused = true // läuft erst nach dem Spawn
  }

  // ---------- Registrierung ----------
  addProvider (name, fn) { this.providers.push({ name, fn }) }
  onInterrupt (fn) { this.interruptHooks.push(fn) }
  on (event, fn) { this.listeners[event].push(fn) }
  registerType (type, factory) { this.types[type] = factory }

  // ---------- Steuerung ----------
  start () {
    this.paused = false
    clearInterval(this._timer)
    this._timer = setInterval(() => this.tick(), this.tickMs)
    this.tick()
  }

  // Beim Verbindungsende: alles anhalten, Warteschlange behalten.
  pause () {
    this.paused = true
    clearInterval(this._timer)
    this._interruptCurrent('Pause')
  }

  // Aufgabe in die Warteschlange stellen.
  add (task) {
    const t = {
      id: nextId++,
      priority: PRIORITY.GOAL,
      persist: false,
      ...task
    }
    if (!t.key) t.key = `q${t.id}`
    this.queue.push(t)
    this._sortQueue()
    this._persist()
    this.log.info(`Neue Aufgabe: "${t.name}" (${PRIO_NAME[t.priority] || t.priority})`)
    setImmediate(() => this.tick())
    return t
  }

  // Gespeicherte Aufgabe über einen registrierten Typ erzeugen.
  addType (type, args = {}, extra = {}) {
    const factory = this.types[type]
    if (!factory) throw new Error(`Unbekannter Aufgabentyp: ${type}`)
    const task = factory(args)
    return this.add({ ...task, type, args, persist: true, ...extra })
  }

  remove (predicate) {
    const before = this.queue.length
    const removed = this.queue.filter(predicate)
    this.queue = this.queue.filter(t => !predicate(t))
    if (this.current && removed.includes(this.current.task)) this._interruptCurrent('entfernt')
    if (before !== this.queue.length) this._persist()
    return removed.length
  }

  // Alle Aufgaben stoppen und Warteschlange leeren.
  stopAll () {
    this.queue = []
    this._persist()
    this._interruptCurrent('Stopp')
  }

  // Nach Neustart gespeicherte Ziele wiederherstellen.
  restore () {
    const saved = this.state.get('goals') || []
    let n = 0
    for (const g of saved) {
      if (!this.types[g.type]) { this.log.warn(`Gespeicherte Aufgabe "${g.type}" ist unbekannt – übersprungen.`); continue }
      try { this.addType(g.type, g.args); n++ } catch (e) { this.log.warn('Konnte Aufgabe nicht wiederherstellen:', e.message) }
    }
    if (n) this.log.info(`${n} gespeicherte Aufgabe(n) wiederhergestellt.`)
  }

  describe () {
    const cur = this.current ? `${this.current.task.name} (${PRIO_NAME[this.current.task.priority]})` : 'nichts'
    const waiting = this.queue.filter(t => !this.current || t !== this.current.task).map(t => t.name)
    return { current: cur, waiting }
  }

  // ---------- intern ----------
  _sortQueue () {
    this.queue.sort((a, b) => a.priority - b.priority || a.id - b.id)
  }

  _persist () {
    if (!this.state) return
    const goals = this.queue.filter(t => t.persist && t.type).map(t => ({ type: t.type, args: t.args }))
    this.state.set('goals', goals)
  }

  _candidates () {
    const list = []
    for (const p of this.providers) {
      try {
        const t = p.fn()
        if (t) list.push({ priority: PRIORITY.IDLE, key: `p:${p.name}`, ...t, fromProvider: true })
      } catch (e) {
        this.log.error(`Provider "${p.name}" fehlgeschlagen:`, e)
      }
    }
    if (this.queue.length) list.push(this.queue[0])
    list.sort((a, b) => a.priority - b.priority)
    return list
  }

  async tick () {
    if (this.paused || this._switching) return
    const best = this._candidates()[0]
    const cur = this.current

    if (!best) return
    if (cur) {
      if (cur.task.key === best.key) return // läuft schon
      if (best.priority >= cur.task.priority) return // nicht wichtiger -> weiterlaufen lassen
      this.log.info(`"${best.name}" unterbricht "${cur.task.name}"`)
      this._switching = true
      try { await this._interruptCurrent('unterbrochen', true) } finally { this._switching = false }
      if (this.paused) return
    }
    this._run(best)
  }

  _run (task) {
    const controller = new AbortController()
    const entry = { task, controller, promise: null }
    this.current = entry
    this.log.debug(`Start: "${task.name}"`)
    this.listeners.started.forEach(fn => fn(task))

    entry.promise = (async () => {
      try {
        await task.run({ signal: controller.signal, task })
        if (controller.signal.aborted) return 'aborted'
        this._finish(task)
        this.log.info(`Erledigt: "${task.name}"`)
        this.listeners.done.forEach(fn => fn(task))
        return 'done'
      } catch (e) {
        if (controller.signal.aborted || e instanceof AbortedError) return 'aborted'
        this._finish(task)
        this.log.warn(`Aufgabe "${task.name}" fehlgeschlagen: ${e && e.message ? e.message : e}`)
        this.log.debug(e)
        this.listeners.failed.forEach(fn => fn(task, e))
        return 'failed'
      } finally {
        if (this.current === entry) this.current = null
        if (!this.paused) setImmediate(() => this.tick())
      }
    })()
  }

  _finish (task) {
    const i = this.queue.indexOf(task)
    if (i >= 0) { this.queue.splice(i, 1); this._persist() }
  }

  async _interruptCurrent (reason, keepInQueue = false) {
    const cur = this.current
    if (!cur) return
    if (!keepInQueue || cur.task.resumable === false) this._finish(cur.task)
    this.log.debug(`Abbruch "${cur.task.name}": ${reason}`)
    cur.controller.abort()
    for (const fn of this.interruptHooks) { try { fn(cur.task) } catch {} }
    // Kurz warten, bis die Aufgabe wirklich beendet ist (max. 3 s).
    await Promise.race([cur.promise, sleep(3000)]).catch(() => {})
    if (this.current === cur) this.current = null
  }
}

module.exports = { TaskManager, PRIORITY, PRIO_NAME, AbortedError, sleep, throwIfAborted }
