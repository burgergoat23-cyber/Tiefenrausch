'use strict'
// Schnelle Selbsttests ohne Minecraft: npm run check
const assert = require('assert')
const fs = require('fs')
const os = require('os')
const path = require('path')

const { TaskManager, PRIORITY, sleep } = require('../src/core/taskManager')
const { State } = require('../src/core/state')
const { loadConfig } = require('../src/core/config')
const { parse } = require('../src/core/lanDiscovery')
const { chatText } = require('../src/core/util')
const { Logger } = require('../src/core/logger')

const log = new Logger({ level: 'warn', toFile: false })
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tiefenbot-'))
let failed = 0
const results = []

async function test (name, fn) {
  try {
    await fn()
    results.push(`  ✔ ${name}`)
  } catch (e) {
    failed++
    results.push(`  ✘ ${name}\n      ${e.stack.split('\n').slice(0, 3).join('\n      ')}`)
  }
}

;(async () => {
  await test('LAN-Ansage wird erkannt', () => {
    assert.deepStrictEqual(parse('[MOTD]Meine Welt[/MOTD][AD]54321[/AD]'), { motd: 'Meine Welt', port: 54321, host: null })
    assert.strictEqual(parse('[MOTD]x[/MOTD][AD]192.168.0.5:25565[/AD]').host, '192.168.0.5')
    assert.strictEqual(parse('Müll'), null)
    assert.strictEqual(parse('[AD]99999[/AD]'), null)
  })

  await test('config.json: Standardwerte und Prüfungen', () => {
    const f = path.join(tmp, 'c1.json')
    fs.writeFileSync(f, JSON.stringify({ port: '25565', owners: ['Steve'] }))
    const c = loadConfig(f)
    assert.strictEqual(c.port, 25565)
    assert.strictEqual(c.version, false)
    assert.deepStrictEqual(c.owners, ['steve'])
    assert.strictEqual(c.viewer.port, 3007)
    fs.writeFileSync(f, JSON.stringify({ username: 'Name mit Leerzeichen' }))
    assert.throws(() => loadConfig(f), /username/)
    fs.writeFileSync(f, '{ kaputt')
    assert.throws(() => loadConfig(f), /kein gültiges JSON/)
  })

  await test('Chat-Text aus JSON/Objekten', () => {
    assert.strictEqual(chatText('{"text":"Hallo ","extra":[{"text":"Welt"}]}'), 'Hallo Welt')
    assert.strictEqual(chatText({ translate: 'multiplayer.disconnect.unverified_username' }), 'multiplayer.disconnect.unverified_username')
    assert.strictEqual(chatText('einfach'), 'einfach')
  })

  await test('state.json: speichern, laden, kaputte Datei', () => {
    const f = path.join(tmp, 'state.json')
    const s = new State(f, log).load()
    s.update(d => { d.base = { x: 1, y: 2, z: 3 }; d.deaths.push({ x: 0 }) })
    s.saveNow()
    const s2 = new State(f, log).load()
    assert.deepStrictEqual(s2.get('base'), { x: 1, y: 2, z: 3 })
    assert.strictEqual(s2.get('deaths').length, 1)
    fs.writeFileSync(f, '{{{')
    const s3 = new State(f, log).load()
    assert.strictEqual(s3.get('base'), null)
  })

  await test('Task-Manager: höhere Priorität unterbricht, Ziel läuft danach weiter', async () => {
    const state = new State(path.join(tmp, 's2.json'), log)
    const tm = new TaskManager({ log, state, tickMs: 20 })
    const events = []
    let danger = false
    let goalRuns = 0
    tm.addProvider('gefahr', () => danger
      ? { name: 'fliehen', priority: PRIORITY.SURVIVAL, run: async ({ signal }) => { events.push('flieh-start'); await sleep(60, signal); danger = false; events.push('flieh-ende') } }
      : null)
    tm.add({
      name: 'holz',
      priority: PRIORITY.GOAL,
      run: async ({ signal }) => {
        goalRuns++
        events.push('holz-start')
        await sleep(goalRuns === 1 ? 1000 : 50, signal)
        events.push('holz-ende')
      }
    })
    tm.start()
    await sleep(80)
    danger = true
    await sleep(400)
    tm.pause()
    assert.deepStrictEqual(events, ['holz-start', 'flieh-start', 'flieh-ende', 'holz-start', 'holz-ende'])
    assert.strictEqual(tm.queue.length, 0)
  })

  await test('Task-Manager: gleiche Priorität unterbricht nicht, stopAll leert alles', async () => {
    const tm = new TaskManager({ log, state: new State(path.join(tmp, 's3.json'), log), tickMs: 20 })
    const events = []
    tm.add({ name: 'a', run: async ({ signal }) => { events.push('a'); await sleep(5000, signal) } })
    tm.start()
    await sleep(50)
    tm.add({ name: 'b', run: async () => { events.push('b') } })
    await sleep(100)
    assert.deepStrictEqual(events, ['a'])
    tm.stopAll()
    await sleep(100)
    assert.strictEqual(tm.current, null)
    assert.strictEqual(tm.queue.length, 0)
    tm.pause()
  })

  await test('Task-Manager: Befehl (3.5) geht vor Ziel (4), Fehler werden gemeldet', async () => {
    const tm = new TaskManager({ log, state: new State(path.join(tmp, 's4.json'), log), tickMs: 20 })
    const events = []
    let failedName = null
    tm.on('failed', (t) => { failedName = t.name })
    tm.add({ name: 'ziel', priority: PRIORITY.GOAL, run: async ({ signal }) => { events.push('ziel'); await sleep(5000, signal) } })
    tm.start()
    await sleep(50)
    tm.add({ name: 'befehl', priority: PRIORITY.COMMAND, run: async () => { events.push('befehl'); throw new Error('kein Weg') } })
    await sleep(150)
    assert.deepStrictEqual(events.slice(0, 3), ['ziel', 'befehl', 'ziel'])
    assert.strictEqual(failedName, 'befehl')
    tm.pause()
  })

  await test('Task-Manager: gespeicherte Ziele werden nach Neustart wiederhergestellt', async () => {
    const f = path.join(tmp, 's5.json')
    const st = new State(f, log)
    const tm = new TaskManager({ log, state: st })
    const factory = (args) => ({ name: `farm ${args.item}`, run: async () => {} })
    tm.registerType('farm', factory)
    tm.addType('farm', { item: 'holz', anzahl: 10 })
    st.saveNow()
    const st2 = new State(f, log).load()
    const tm2 = new TaskManager({ log, state: st2 })
    tm2.registerType('farm', factory)
    tm2.restore()
    assert.strictEqual(tm2.queue.length, 1)
    assert.strictEqual(tm2.queue[0].name, 'farm holz')
  })

  await test('Alle Module lassen sich laden', () => {
    for (const f of fs.readdirSync(path.join(__dirname, '..', 'src', 'modules'))) {
      const m = require(path.join(__dirname, '..', 'src', 'modules', f))
      assert.ok(m.name, `${f} hat keinen Namen`)
      assert.ok(m.init || m.onBot, `${f} hat weder init noch onBot`)
    }
  })

  console.log('Selbsttest Tiefenbot:\n' + results.join('\n'))
  fs.rmSync(tmp, { recursive: true, force: true })
  if (failed) { console.log(`\n${failed} Test(s) fehlgeschlagen.`); process.exit(1) }
  console.log('\nAlles in Ordnung.')
  process.exit(0)
})()
