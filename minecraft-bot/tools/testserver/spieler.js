// NUR FÜR ENTWICKLER: simulierter Spieler, der Befehle schreibt und herumläuft.
// node spieler.js [port]   (Bot und server.js müssen laufen)
const mineflayer = require('../../node_modules/mineflayer')
const p = mineflayer.createBot({ host: 'localhost', port: Number(process.argv[2] || 25599), username: 'Spieler', auth: 'offline' })
const wait = ms => new Promise(r => setTimeout(r, ms))
p.on('chat', (u, m) => { if (u !== 'Spieler') console.log(`<${u}> ${m}`) })
p.once('spawn', async () => {
  await wait(3000)
  for (const c of ['!status', '!basis setzen', '!komm 30 5 20']) { p.chat(c); await wait(5000) }
  p.setControlState('left', true); await wait(2500); p.setControlState('left', false)
  p.chat('!komm'); await wait(8000)
  p.chat('!folge'); await wait(2000)
  p.setControlState('back', true); await wait(3000); p.setControlState('back', false)
  await wait(6000)
  console.log('Spieler-Position:', p.entity.position)
  p.chat('!status'); await wait(2500)
  p.chat('!stop'); await wait(2500)
  p.quit(); process.exit(0)
})
