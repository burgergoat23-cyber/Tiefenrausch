'use strict'
// !status, !hilfe, !stop, !inventar
const { PRIO_NAME } = require('../core/taskManager')
const { fmtPos, dimName } = require('../core/util')

function init (ctx) {
  const { commands, tasks, state } = ctx

  commands.register('hilfe', {
    aliases: ['help', 'befehle'],
    usage: '!hilfe',
    help: 'Zeigt alle Befehle.',
    handler: ({ reply }) => {
      const lines = commands.unique().map(c => `${c.usage} – ${c.help}`)
      reply('Befehle:\n' + lines.join('\n'))
    }
  })

  commands.register('status', {
    usage: '!status',
    help: 'Leben, Hunger, Position, aktuelle Aufgabe.',
    handler: ({ reply }) => {
      const bot = ctx.bot
      if (!bot || !bot.entity) return reply('Bin gerade nicht verbunden.')
      const hearts = (bot.health / 2).toFixed(1)
      const food = (bot.food / 2).toFixed(1)
      const { current, waiting } = tasks.describe()
      const base = state.get('base')
      const t = bot.time ? bot.time.timeOfDay : 0
      const dayNight = t < 12542 || t > 23460 ? 'Tag' : 'Nacht'
      reply([
        `❤ ${hearts}/10  🍗 ${food}/10  📍 ${fmtPos(bot.entity.position)} (${dimName(bot)})  ${dayNight}`,
        `Aufgabe: ${current}${waiting.length ? ` | wartet: ${waiting.slice(0, 3).join(', ')}${waiting.length > 3 ? ' …' : ''}` : ''}`,
        `Auto: ${state.get('auto') ? 'an' : 'aus'} | Basis: ${base ? fmtPos(base) : 'nicht gesetzt'} | freie Plätze: ${bot.inventory.emptySlotCount()}`
      ].join('\n'))
    }
  })

  commands.register('stop', {
    aliases: ['halt'],
    usage: '!stop',
    help: 'Alles anhalten (Auto aus). Überleben bleibt aktiv.',
    handler: ({ reply }) => {
      tasks.stopAll()
      state.set('auto', false)
      if (ctx.move) ctx.move.stop()
      reply('Angehalten. Auto-Modus ist aus.')
    }
  })

  commands.register('inventar', {
    aliases: ['inv'],
    usage: '!inventar',
    help: 'Zeigt, was der Bot dabeihat.',
    handler: ({ reply }) => {
      const bot = ctx.bot
      if (!bot || !bot.entity) return reply('Bin gerade nicht verbunden.')
      const count = {}
      for (const it of bot.inventory.items()) count[it.name] = (count[it.name] || 0) + it.count
      const list = Object.entries(count).sort((a, b) => b[1] - a[1]).map(([n, c]) => `${c}x ${n}`)
      reply(list.length ? 'Inventar: ' + list.join(', ') : 'Inventar ist leer.')
    }
  })

  ctx.prioName = PRIO_NAME
}

module.exports = { name: 'info', init }
