'use strict'
// Tod-Recovery. Phase 1: Todesort speichern und melden.
// (Hinlaufen und Items einsammeln kommt in Phase 3.)
const { fmtPos, dimName } = require('../core/util')

function init (ctx) {
  const { commands, state } = ctx
  commands.register('tode', {
    aliases: ['deaths'],
    usage: '!tode',
    help: 'Zeigt die letzten Todesorte.',
    handler: ({ reply }) => {
      const d = state.get('deaths') || []
      if (!d.length) return reply('Ich bin noch nie gestorben. 😎')
      reply('Letzte Tode: ' + d.slice(-3).reverse().map(x => `${fmtPos(x)} (${x.dimension})`).join(' | '))
    }
  })
}

function onBot (bot, ctx) {
  const L = ctx.log.child('tod')
  let lastPos = null
  // Position laufend merken: beim "death"-Event kann sie schon zurückgesetzt sein.
  bot.on('move', () => { if (bot.entity && bot.health > 0) lastPos = { ...bot.entity.position, dimension: dimName(bot) } })
  bot.on('death', () => {
    const p = lastPos || (bot.entity && bot.entity.position)
    if (!p) return
    const entry = { x: Math.floor(p.x), y: Math.floor(p.y), z: Math.floor(p.z), dimension: p.dimension || dimName(bot), time: Date.now(), recovered: false }
    ctx.state.update(s => {
      s.deaths.push(entry)
      if (s.deaths.length > 20) s.deaths.splice(0, s.deaths.length - 20)
      s.stats.deaths++
    })
    L.warn(`Gestorben bei ${fmtPos(entry)} (${entry.dimension})`)
    ctx.commands.say(`Ich bin gestorben bei ${fmtPos(entry)}. 💀`)
  })
  // Sicherheitsnetz: falls der automatische Respawn hängt, selbst wiederbeleben.
  const timer = setInterval(() => {
    if (bot.entity && bot.health <= 0 && Date.now() - (bot._deadSince || (bot._deadSince = Date.now())) > 5000) {
      L.info('Respawn hängt – versuche erneut.')
      bot._deadSince = Date.now()
      try { bot.respawn() } catch {}
    }
    if (bot.health > 0) bot._deadSince = null
  }, 1000)
  bot.once('end', () => clearInterval(timer))
}

module.exports = { name: 'recovery', init, onBot }
