// NUR FÜR ENTWICKLER: kleiner Test-Server (flying-squid) + LAN-Ansage wie bei "Für LAN öffnen".
// Einrichten:  cd tools/testserver && npm install
// Starten:     node server.js [version] [port]     (empfohlen: 1.18.2 – dort sehen sich Spieler gegenseitig)
const mcServer = require('flying-squid')
const dgram = require('dgram')
const version = process.argv[2] || '1.18.2'
const port = Number(process.argv[3] || 25599)
mcServer.createMCServer({
  motd: 'Testwelt', port, 'max-players': 10, 'online-mode': false, logging: false,
  gameMode: 0, difficulty: 1, generation: { name: 'superflat', options: { worldHeight: 80 } },
  kickTimeout: 30000, plugins: {}, modpe: false, 'view-distance': 4, 'everybody-op': true,
  'max-entities': 100, version, 'player-list-text': { header: { text: 'Test' }, footer: { text: 'Test' } }
})
const sock = dgram.createSocket('udp4')
setInterval(() => sock.send(Buffer.from(`[MOTD]Testwelt LAN[/MOTD][AD]${port}[/AD]`), 4445, '224.0.2.60', () => {}), 1500)
console.log(`Test-Server ${version} auf Port ${port} (LAN-Ansage aktiv)`)
