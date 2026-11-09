'use strict'
// Findet eine geöffnete LAN-Welt automatisch.
// Minecraft sendet bei "Für LAN öffnen" alle 1,5 s ein Paket an die
// Multicast-Adresse 224.0.2.60:4445 mit Inhalt "[MOTD]Name[/MOTD][AD]Port[/AD]".
const dgram = require('dgram')

const GROUP = '224.0.2.60'
const PORT = 4445

function parse (text) {
  const motd = /\[MOTD\]([\s\S]*?)\[\/MOTD\]/.exec(text)
  const ad = /\[AD\]([^[]*?)\[\/AD\]/.exec(text)
  if (!ad) return null
  // [AD] enthält normalerweise nur den Port, manchmal "host:port"
  const parts = ad[1].trim().split(':')
  const port = Number(parts[parts.length - 1])
  if (!Number.isInteger(port) || port < 1 || port > 65535) return null
  return { motd: motd ? motd[1] : '?', port, host: parts.length > 1 ? parts[0] : null }
}

// Wartet bis zu timeoutMs auf eine LAN-Welt. Ergebnis: { motd, port, address } oder null.
function discoverLan ({ timeoutMs = 30000, log } = {}) {
  return new Promise((resolve) => {
    let done = false
    const sock = dgram.createSocket({ type: 'udp4', reuseAddr: true })
    const finish = (result) => {
      if (done) return
      done = true
      clearTimeout(timer)
      try { sock.close() } catch {}
      resolve(result)
    }
    const timer = setTimeout(() => finish(null), timeoutMs)

    sock.on('error', (e) => {
      if (log) log.warn(`LAN-Suche nicht möglich (${e.message}). Trage den Port in config.json ein.`)
      finish(null)
    })
    sock.on('message', (msg, rinfo) => {
      const info = parse(msg.toString('utf8'))
      if (info) finish({ ...info, address: rinfo.address })
    })
    sock.bind(PORT, () => {
      try {
        sock.addMembership(GROUP)
      } catch (e) {
        if (log) log.debug('addMembership:', e.message)
      }
    })
  })
}

module.exports = { discoverLan, parse }
