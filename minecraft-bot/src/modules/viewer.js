'use strict'
// Live-Ansicht im Browser (prismarine-viewer): http://localhost:<port>
const net = require('net')

function portFree (port) {
  return new Promise((resolve) => {
    const srv = net.createServer()
    srv.once('error', () => resolve(false))
    srv.once('listening', () => srv.close(() => resolve(true)))
    srv.listen(port)
  })
}

function onBot (bot, ctx) {
  const cfg = ctx.config.viewer || {}
  if (!cfg.enabled) return
  const L = ctx.log.child('viewer')

  bot.once('spawn', async () => {
    let viewer
    try {
      viewer = require('prismarine-viewer').mineflayer
    } catch (e) {
      L.warn('prismarine-viewer nicht installiert – Live-Ansicht aus.', e.message)
      return
    }
    let port = cfg.port || 3007
    for (let i = 0; i < 10 && !(await portFree(port)); i++) port++
    try {
      viewer(bot, { port, firstPerson: !!cfg.firstPerson, viewDistance: cfg.viewDistance || 6 })
      L.info(`Live-Ansicht: http://localhost:${port}  (im Browser öffnen)`)
    } catch (e) {
      L.warn('Live-Ansicht konnte nicht starten:', e.message)
      return
    }

    // Geplanten Weg als Linie anzeigen
    bot.on('path_update', (r) => {
      if (!bot.viewer || !r.path || !r.path.length) return
      const pts = [bot.entity.position.offset(0, 0.5, 0), ...r.path.map(p => p.offset(0, 0.5, 0))]
      try { bot.viewer.drawLine('weg', pts, 0x00ff88) } catch {}
    })
    bot.on('goal_reached', () => { try { bot.viewer.erase('weg') } catch {} })
    bot.on('path_stop', () => { try { bot.viewer.erase('weg') } catch {} })
  })

  bot.once('end', () => {
    try { if (bot.viewer && bot.viewer.close) bot.viewer.close() } catch {}
  })
}

module.exports = { name: 'viewer', onBot }
