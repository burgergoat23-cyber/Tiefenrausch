'use strict'
// Bewegung: Pathfinder einrichten, !folge, !komm.
const { pathfinder, Movements, goals } = require('mineflayer-pathfinder')
const { PRIORITY, sleep, throwIfAborted, AbortedError } = require('../core/taskManager')
const { fmtPos } = require('../core/util')

function setupMovements (bot) {
  const m = new Movements(bot)
  m.canDig = true
  m.allowParkour = true
  m.allowSprinting = true
  m.dontCreateFlow = true // keine Flüssigkeiten freilegen
  m.dontMineUnderFallingBlock = true // nicht unter Sand/Kies graben
  m.allow1by1towers = true
  m.maxDropDown = 4 // nicht tiefer als 4 Blöcke springen
  return m
}

// Zu einem Ziel laufen; bricht sauber ab, wenn die Aufgabe unterbrochen wird.
async function goto (bot, goal, signal) {
  throwIfAborted(signal)
  const onAbort = () => { try { bot.pathfinder.stop() } catch {} }
  if (signal) signal.addEventListener('abort', onAbort, { once: true })
  try {
    await bot.pathfinder.goto(goal)
  } catch (e) {
    if (signal && signal.aborted) throw new AbortedError()
    throw e
  } finally {
    if (signal) signal.removeEventListener('abort', onAbort)
  }
  throwIfAborted(signal)
}

function init (ctx) {
  const { commands, tasks, log } = ctx
  const L = log.child('bewegung')

  ctx.move = {
    goals,
    goto: (goal, signal) => goto(ctx.bot, goal, signal),
    gotoPos: (pos, range = 1, signal) => goto(ctx.bot, new goals.GoalNear(pos.x, pos.y, pos.z, range), signal),
    stop: () => { const b = ctx.bot; if (b && b.pathfinder) { b.pathfinder.stop(); b.pathfinder.setGoal(null) } if (b) b.clearControlStates() }
  }

  // Bei jeder Unterbrechung Bewegung anhalten.
  tasks.onInterrupt(() => { try { ctx.move.stop() } catch {} })

  // Spieler-Entity finden (oder null, wenn außer Sichtweite).
  const playerEntity = (name) => {
    const b = ctx.bot
    if (!b || !name) return null
    const key = Object.keys(b.players).find(n => n.toLowerCase() === name.toLowerCase())
    return key && b.players[key].entity ? b.players[key].entity : null
  }
  const pickTarget = (args, username) => args[0] || username || (ctx.config.owners[0] || null)

  // ---------- !folge ----------
  commands.register('folge', {
    aliases: ['follow'],
    usage: '!folge [spieler]',
    help: 'Bot läuft dir hinterher, bis !stop.',
    handler: ({ args, username, reply }) => {
      const target = pickTarget(args, username)
      if (!target) return reply('Wem soll ich folgen? Schreib: !folge <name>')
      tasks.remove(t => t.key === 'folge' || t.key === 'komm')
      tasks.add({
        name: `${target} folgen`,
        key: 'folge',
        priority: PRIORITY.COMMAND,
        run: async ({ signal }) => {
          const bot = ctx.bot
          let lastPos = null
          let warned = false
          let following = null
          try {
            while (!signal.aborted) {
              const ent = playerEntity(target)
              if (ent) {
                lastPos = ent.position.clone()
                warned = false
                if (following !== ent) {
                  bot.pathfinder.setGoal(new goals.GoalFollow(ent, 2), true)
                  following = ent
                }
              } else {
                following = null
                if (lastPos) {
                  // zur letzten bekannten Position laufen
                  bot.pathfinder.setGoal(new goals.GoalNear(lastPos.x, lastPos.y, lastPos.z, 2))
                  lastPos = null
                } else if (!warned) {
                  reply(`Ich sehe ${target} nicht. Komm näher, dann folge ich.`)
                  warned = true
                }
              }
              await sleep(1000, signal)
            }
          } finally {
            try { bot.pathfinder.setGoal(null) } catch {}
          }
        }
      })
      reply(`Ich folge ${target}. (!stop zum Anhalten)`)
    }
  })

  // ---------- !komm ----------
  commands.register('komm', {
    aliases: ['come'],
    usage: '!komm [spieler | x y z]',
    help: 'Bot kommt einmal zu dir (oder zu Koordinaten).',
    handler: ({ args, username, reply }) => {
      let dest = null
      let label = ''
      if (args.length >= 3 && args.slice(0, 3).every(a => !isNaN(Number(a)))) {
        const [x, y, z] = args.slice(0, 3).map(Number)
        dest = { x, y, z }
        label = `${x} ${y} ${z}`
      } else {
        const target = pickTarget(args, username)
        const ent = playerEntity(target)
        if (!ent) return reply(`Ich kann ${target || 'dich'} nicht sehen. Komm näher oder nenne Koordinaten: !komm x y z`)
        dest = ent.position.clone()
        label = target
      }
      tasks.remove(t => t.key === 'folge' || t.key === 'komm')
      tasks.add({
        name: `zu ${label} laufen`,
        key: 'komm',
        priority: PRIORITY.COMMAND,
        run: async ({ signal }) => {
          await ctx.move.gotoPos(dest, 2, signal)
          reply('Bin da!')
        }
      })
      reply(`Komme zu ${label}.`)
    }
  })

  // Fehlgeschlagene Bewegungs-Befehle im Chat melden
  tasks.on('failed', (task, e) => {
    if (task.key === 'komm' || task.key === 'folge') {
      commands.say(`Ich komme nicht hin (${e.message}).`)
      L.warn(`Weg nicht gefunden: ${e.message}`)
    }
  })

  ctx.fmtPos = fmtPos
}

function onBot (bot, ctx) {
  bot.loadPlugin(pathfinder)
  bot.once('spawn', () => {
    bot.pathfinder.setMovements(setupMovements(bot))
    bot.pathfinder.thinkTimeout = 10000 // max. 10 s pro Wegberechnung
  })
}

module.exports = { name: 'bewegung', init, onBot, setupMovements }
