'use strict'
// Basis-Koordinaten: !basis setzen | !basis | !basis hin
const { PRIORITY } = require('../core/taskManager')
const { fmtPos, dimName } = require('../core/util')

function init (ctx) {
  const { commands, state, tasks } = ctx

  commands.register('basis', {
    aliases: ['base'],
    usage: '!basis [setzen | hin]',
    help: 'Basis hier festlegen, anzeigen oder hinlaufen.',
    handler: ({ args, reply }) => {
      const bot = ctx.bot
      const sub = (args[0] || '').toLowerCase()
      if (sub === 'setzen' || sub === 'set') {
        if (!bot || !bot.entity) return reply('Bin gerade nicht verbunden.')
        const p = bot.entity.position
        state.set('base', { x: Math.floor(p.x), y: Math.floor(p.y), z: Math.floor(p.z), dimension: dimName(bot) })
        return reply(`Basis gesetzt: ${fmtPos(p)} (${dimName(bot)})`)
      }
      const base = state.get('base')
      if (!base) return reply('Noch keine Basis. Stell dich hin und schreib: !basis setzen')
      if (sub === 'hin' || sub === 'go') {
        tasks.remove(t => t.key === 'folge' || t.key === 'komm')
        tasks.add({
          name: 'zur Basis laufen',
          key: 'komm',
          priority: PRIORITY.COMMAND,
          run: async ({ signal }) => {
            await ctx.move.gotoPos(base, 2, signal)
            reply('Bin an der Basis.')
          }
        })
        return reply('Laufe zur Basis.')
      }
      reply(`Basis: ${fmtPos(base)} (${base.dimension || 'overworld'})`)
    }
  })
}

module.exports = { name: 'basis', init }
